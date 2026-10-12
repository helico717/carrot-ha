"""Authenticated local journal WebSocket API. No browser tokens/webhooks."""
import voluptuous as vol
from homeassistant.components import websocket_api
from .store import Conflict


def fuel_sensor_supported(sensor, platform):
    unit=sensor.attributes.get('unit_of_measurement')
    return unit in ('원/L','KRW/L','원/ℓ') or (unit=='원' and platform=='gas_station_korea')


def discover_fuel_sensors(hass):
    from homeassistant.helpers import entity_registry as er
    registry=er.async_get(hass)
    found={}
    for fuel,entity_id in {'gasoline':'sensor.average_gasoline','diesel':'sensor.average_diesel','premium':'sensor.average_premium_gasoline'}.items():
        entity=registry.async_get(entity_id)
        sensor=hass.states.get(entity_id)
        if entity and entity.platform=='gas_station_korea' and sensor and fuel_sensor_supported(sensor,entity.platform):
            found[fuel]=entity_id
    return found


def runtime(hass, connection, msg):
    if not connection.user or not connection.user.is_admin:
        connection.send_error(msg['id'],'unauthorized','관리자 계정으로 확인해 주세요.')
        return None
    m=hass.data.get('carrot_ha_journal_manager')
    result=m.get(msg['entry_id']) if m else hass.data.get('carrot_ha',{}).get(msg['entry_id'])
    if not isinstance(result,dict) or 'journal' not in result:
        connection.send_error(msg['id'],'not_found',result.get('journal_error','차계부 통합을 찾을 수 없어요.') if isinstance(result,dict) else '차계부 통합을 찾을 수 없어요.')
        return None
    return result


async def execute(hass,connection,msg,method,*args):
    try:
        result=await hass.async_add_executor_job(method,*args)
        connection.send_result(msg['id'],result)
    except Conflict as error:
        connection.send_error(msg['id'],'conflict',str(error))
    except (ValueError,KeyError,TypeError,OverflowError):
        connection.send_error(msg['id'],'invalid_input','입력한 날짜·금액·측정값을 확인해 주세요.')
    except Exception:
        import logging
        logging.getLogger(__name__).exception('Journal operation failed')
        connection.send_error(msg['id'],'storage_failed','차계부 처리를 완료하지 못했어요. 다시 시도해 주세요.')


@websocket_api.websocket_command({vol.Required('type'):'carrot_ha/journal/entries',vol.Optional('include_deleted',default=False):bool})
@websocket_api.async_response
async def entries(hass,connection,msg):
    if not connection.user or not connection.user.is_admin:
        connection.send_error(msg['id'],'unauthorized','관리자 계정이 필요해요.');return
    from .vehicles import manager
    user_id=connection.user.id if connection.user else None
    connection.send_result(msg['id'],manager(hass).entries(msg.get('include_deleted',False),user_id=user_id))


@websocket_api.websocket_command({vol.Required('type'):'carrot_ha/journal/user_default/set',vol.Required('entry_id'):str})
@websocket_api.async_response
async def user_default_set(hass,connection,msg):
    if not connection.user or not connection.user.is_admin:
        connection.send_error(msg['id'],'unauthorized','관리자 계정이 필요해요.');return
    from .vehicles import manager
    try:
        await manager(hass).set_user_default(connection.user.id,msg['entry_id'])
        connection.send_result(msg['id'],{'success':True,'entry_id':msg['entry_id']})
    except Exception as e:
        connection.send_error(msg['id'],'storage_failed',str(e))


@websocket_api.websocket_command({vol.Required('type'):'carrot_ha/journal/query',vol.Required('entry_id'):str,
    vol.Required('from'):str,vol.Required('to'):str,vol.Optional('offset',default=0):int,
    vol.Optional('include_trips',default=True):bool,vol.Optional('record_categories',default=[]):[str],vol.Optional('expenses_only',default=False):bool,vol.Optional('record_sort',default='time'):vol.In(['time','amount_desc','amount_asc'])})
@websocket_api.async_response
async def query(hass,connection,msg):
    r=runtime(hass,connection,msg)
    if r:
        try:
            result=await hass.async_add_executor_job(r['journal'].query,msg['from'],msg['to'],100,msg['offset'],msg['include_trips'],msg['record_categories'],msg['expenses_only'],msg['record_sort'],bool(r.get('manual_vehicle')))
            from ..vehicle import values
            live={} if r.get('manual_vehicle') else values(r)
            if r.get('manual_vehicle'):result['status']={'phase':'complete','manual':True}
            result['latest']={key:live.get(key) for key in ('soc_percent','range_km','range_estimated','driving','onroad','charging','doors_locked','odometer_km','outside_temp_c','last_received','measured_at')}
            result['sync_error']=r.get('journal_error')
            result['fuel_sensors']=discover_fuel_sensors(hass)
            # Current fuel sensor values stay within HA; no external request.
            comparison=result.get('comparison')
            if comparison:
                import json
                from .store import number
                entities=json.loads(comparison['sensor_entities_json'])
                sensor=hass.states.get(entities.get(comparison['fuel'],''))
                from homeassistant.helpers import entity_registry as er
                entity=er.async_get(hass).async_get(sensor.entity_id) if sensor else None
                if sensor and fuel_sensor_supported(sensor,entity.platform if entity else None):
                    try:
                        price=number(float(sensor.state))
                        if price and price>0:result['fuel_price']={'price':price,'entity_id':sensor.entity_id,'observed_at':sensor.last_updated.isoformat()}
                    except (ValueError,TypeError):pass
            connection.send_result(msg['id'],result)
        except (ValueError,TypeError):connection.send_error(msg['id'],'invalid_input','조회 기간을 확인해 주세요.')
        except Exception:connection.send_error(msg['id'],'storage_failed','차계부를 읽지 못했어요.')


@websocket_api.websocket_command({vol.Required('type'):'carrot_ha/journal/record/save',vol.Required('entry_id'):str,
    vol.Required('record_id'):str,vol.Required('expected_version'):int,vol.Required('payload'):dict})
@websocket_api.async_response
async def save(hass,connection,msg):
    r=runtime(hass,connection,msg)
    if r:await execute(hass,connection,msg,r['journal'].save_manual,msg['record_id'],msg['expected_version'],msg['payload'])


@websocket_api.websocket_command({vol.Required('type'):'carrot_ha/journal/record/status',vol.Required('entry_id'):str,
    vol.Required('record_id'):str,vol.Required('expected_version'):int,vol.Required('status'):str})
@websocket_api.async_response
async def status(hass,connection,msg):
    r=runtime(hass,connection,msg)
    if r:await execute(hass,connection,msg,r['journal'].change_status,msg['record_id'],msg['expected_version'],msg['status'])


@websocket_api.websocket_command({vol.Required('type'):'carrot_ha/journal/comparison/save',vol.Required('entry_id'):str,
    vol.Required('fuel'):str,vol.Required('economy_km_l'):vol.Coerce(float),vol.Required('entity_id'):str})
@websocket_api.async_response
async def comparison_save(hass,connection,msg):
    r=runtime(hass,connection,msg)
    if not r:return
    def write():
        from .store import number,now,encode
        fuel=msg['fuel'];economy=msg['economy_km_l'];entity=msg['entity_id']
        if fuel not in ('gasoline','diesel','premium') or number(economy) is None or not 1<=economy<=50 or not entity.startswith('sensor.') or len(entity)>255:raise ValueError('Invalid comparison')
        with r['journal'].lock,r['journal'].connect() as db:
            import json
            previous=db.execute('SELECT sensor_entities_json FROM comparison_settings WHERE vehicle_id=?',(r['journal'].vehicle,)).fetchone()
            entities=json.loads(previous[0]) if previous else {}
            entities[fuel]=entity
            db.execute('''INSERT INTO comparison_settings VALUES (?,?,?,?,1,?) ON CONFLICT(vehicle_id)
                DO UPDATE SET fuel=excluded.fuel,economy_km_l=excluded.economy_km_l,
                sensor_entities_json=excluded.sensor_entities_json,version=comparison_settings.version+1,updated_at=excluded.updated_at''',
                (r['journal'].vehicle,fuel,economy,encode(entities),now()))
        return {'saved':True}
    await execute(hass,connection,msg,write)


@websocket_api.websocket_command({vol.Required('type'):'carrot_ha/journal/vehicle/create',vol.Required('title'):str,vol.Required('fuel'):vol.In(['gasoline','diesel','hybrid','electric']),vol.Optional('preview_token',default=''):str})
@websocket_api.async_response
async def vehicle_create(hass,connection,msg):
    if not connection.user or not connection.user.is_admin:
        connection.send_error(msg['id'],'unauthorized','관리자 계정이 필요해요.');return
    from .vehicles import manager
    try:
        result=await manager(hass).create(msg['title'],msg['fuel'],msg['preview_token'],connection.user.id)
        connection.send_result(msg['id'],result)
    except ValueError as error:connection.send_error(msg['id'],'invalid_input',str(error))
    except Exception:connection.send_error(msg['id'],'storage_failed','차량을 저장하지 못했어요.')


@websocket_api.websocket_command({vol.Required('type'):'carrot_ha/journal/vehicle/update',vol.Required('entry_id'):str,vol.Required('title'):str,vol.Required('fuel'):vol.In(['gasoline','diesel','hybrid','electric']),vol.Required('deleted'):bool})
@websocket_api.async_response
async def vehicle_update(hass,connection,msg):
    if not connection.user or not connection.user.is_admin:
        connection.send_error(msg['id'],'unauthorized','관리자 계정이 필요해요.');return
    from .vehicles import manager
    try:
        result=await manager(hass).change(msg['entry_id'],msg['title'],msg['fuel'],msg['deleted'])
        connection.send_result(msg['id'],result)
    except ValueError as error:connection.send_error(msg['id'],'invalid_input',str(error))
    except Exception:connection.send_error(msg['id'],'storage_failed','차량을 변경하지 못했어요.')


@websocket_api.websocket_command({vol.Required('type'):'carrot_ha/journal/vehicle/delete',vol.Required('entry_id'):str,vol.Required('confirm'):vol.In([True])})
@websocket_api.async_response
async def vehicle_delete(hass,connection,msg):
    if not connection.user or not connection.user.is_admin:
        connection.send_error(msg['id'],'unauthorized','관리자 계정이 필요해요.');return
    from .vehicles import manager
    try:connection.send_result(msg['id'],await manager(hass).purge(msg['entry_id']))
    except ValueError as error:connection.send_error(msg['id'],'invalid_input',str(error))
    except Exception:connection.send_error(msg['id'],'storage_failed','삭제 처리를 완료하지 못했어요. 다시 확인해 주세요.')


@websocket_api.websocket_command({vol.Required('type'):'carrot_ha/journal/map/config',vol.Optional('key'):str})
@websocket_api.async_response
async def map_config(hass,connection,msg):
    if not connection.user or not connection.user.is_admin:
        connection.send_error(msg['id'],'unauthorized','관리자 계정이 필요해요.');return
    from .vehicles import manager
    m=manager(hass)
    if 'key' in msg:
        import re
        if msg['key'] and not re.fullmatch('[0-9a-fA-F]{32}',msg['key']):
            connection.send_error(msg['id'],'invalid_input','카카오 JavaScript 키를 확인해 주세요.');return
        async with m.lock:
            old=m.map_key;m.map_key=msg['key']
            try:await m.persist()
            except Exception:
                m.map_key=old;connection.send_error(msg['id'],'storage_failed','지도 설정을 저장하지 못했어요.');return
    connection.send_result(msg['id'],{'key':m.map_key,'rest_configured':bool(m.kakao_rest_key)})


@websocket_api.websocket_command({vol.Required('type'):'carrot_ha/journal/record/location',vol.Required('entry_id'):str,vol.Required('record_id'):str,vol.Required('expected_version'):int,vol.Required('location'):vol.Any(dict,None)})
@websocket_api.async_response
async def record_location(hass,connection,msg):
    r=runtime(hass,connection,msg)
    if r:await execute(hass,connection,msg,r['journal'].change_location,msg['record_id'],msg['expected_version'],msg['location'])


@websocket_api.websocket_command({vol.Required('type'):'carrot_ha/journal/settings',vol.Optional('map_key'):str,vol.Optional('opinet_key'):str,vol.Optional('kakao_rest_key'):str})
@websocket_api.async_response
async def settings(hass,connection,msg):
    if not connection.user or not connection.user.is_admin:
        connection.send_error(msg['id'],'unauthorized','관리자 계정이 필요해요.');return
    from .vehicles import manager
    import re
    m=manager(hass)
    for name,pattern in [('map_key','[0-9a-fA-F]{32}'),('opinet_key','[A-Za-z0-9]{1,100}'),('kakao_rest_key','[0-9a-fA-F]{32}')]:
        if name in msg and msg[name] and not re.fullmatch(pattern,msg[name]):
            connection.send_error(msg['id'],'invalid_input','API 키 형식을 확인해 주세요.');return
    if 'map_key' in msg or 'opinet_key' in msg or 'kakao_rest_key' in msg:
        async with m.lock:
            old=(m.map_key,m.opinet_key,m.kakao_rest_key)
            m.map_key=msg.get('map_key',m.map_key);m.opinet_key=msg.get('opinet_key',m.opinet_key);m.kakao_rest_key=msg.get('kakao_rest_key',m.kakao_rest_key);m.search_cache.clear();m.stations.cache.clear()
            try:await m.persist()
            except Exception:
                m.map_key,m.opinet_key,m.kakao_rest_key=old;connection.send_error(msg['id'],'storage_failed','설정을 저장하지 못했어요.');return
    from homeassistant.helpers import entity_registry as er
    registry=er.async_get(hass)
    backup=[]
    for entity in registry.entities.values():
        if entity.platform!='backup':continue
        state=hass.states.get(entity.entity_id)
        if state:backup.append({'name':state.name,'state':state.state,'entity_id':entity.entity_id})
    connection.send_result(msg['id'],{'map_key':m.map_key,'opinet_configured':bool(m.opinet_key),'kakao_rest_configured':bool(m.kakao_rest_key),'kakao_rest_key':m.kakao_rest_key,'opinet_key':m.opinet_key,'backup_entities':backup,'nas_transfer_verified':bool(m.backup_state.get('restore_verified')),'backup_config':m.backup_config,'backup_state':m.nas.status or m.backup_state,'automatic_locations':m.automatic_locations})


@websocket_api.websocket_command({vol.Required('type'):'carrot_ha/journal/location/search',vol.Required('query'):str})
@websocket_api.async_response
async def location_search(hass,connection,msg):
    if not connection.user or not connection.user.is_admin:
        connection.send_error(msg['id'],'unauthorized','관리자 계정이 필요해요.');return
    from .vehicles import manager
    from homeassistant.helpers.aiohttp_client import async_get_clientsession
    import time
    import asyncio
    m=manager(hass);query=msg['query'].strip()
    if not m.kakao_rest_key:
        connection.send_error(msg['id'],'not_configured','설정에 카카오 REST API 키를 등록해 주세요.');return
    if not 2<=len(query)<=100:
        connection.send_error(msg['id'],'invalid_input','검색어를 2~100자로 입력해 주세요.');return
    now=time.monotonic();cached=m.search_cache.get(query)
    if cached and now-cached[0]<60:
        connection.send_result(msg['id'],cached[1]);return
    if now-m.search_last<1:
        connection.send_error(msg['id'],'rate_limited','잠시 후 다시 검색해 주세요.');return
    m.search_last=now
    try:
        async with asyncio.timeout(10):
            async with async_get_clientsession(hass).get('https://dapi.kakao.com/v2/local/search/keyword.json',params={'query':query,'size':10},headers={'Authorization':'KakaoAK '+m.kakao_rest_key}) as response:
                if response.status!=200:
                    connection.send_error(msg['id'],'provider_error','카카오 API 활성화·키·쿼터 설정을 확인해 주세요.');return
                result=await response.json()
        places=[{'name':p['place_name'],'address':p.get('road_address_name') or p.get('address_name',''),'latitude':float(p['y']),'longitude':float(p['x']),'provider':'kakao','station_id':str(p['id']),'selection_source':'manual'} for p in result.get('documents',[])[:10]]
        if len(m.search_cache)>=100:m.search_cache.clear();m.stations.cache.clear()
        m.search_cache[query]=(now,places);connection.send_result(msg['id'],places)
    except Exception:connection.send_error(msg['id'],'provider_error','장소 검색에 실패했어요. 잠시 후 다시 시도해 주세요.')


def register(hass):
    for method in (entries,query,save,status,comparison_save,vehicle_create,vehicle_update,vehicle_delete,map_config,record_location,settings,location_search,station_lookup,nas_config,nas_action,user_default_set):websocket_api.async_register_command(hass,method)


@websocket_api.websocket_command({vol.Required('type'):'carrot_ha/journal/stations/lookup',vol.Required('kind'):vol.In(['charging','refueling']),vol.Required('latitude'):vol.Coerce(float),vol.Required('longitude'):vol.Coerce(float),vol.Required('date'):str,vol.Optional('fuel',default='gasoline'):str,vol.Optional('price_only',default=False):bool})
@websocket_api.async_response
async def station_lookup(hass,connection,msg):
    if not connection.user or not connection.user.is_admin:
        connection.send_error(msg['id'],'unauthorized','관리자 계정이 필요해요.');return
    from datetime import datetime
    from zoneinfo import ZoneInfo
    from .vehicles import manager
    if msg['date']!=datetime.now(ZoneInfo('Asia/Seoul')).date().isoformat():
        connection.send_error(msg['id'],'historical_date','과거 기록에는 현재 위치·현재 단가를 적용하지 않아요.');return
    m=manager(hass)
    try:
        result=await (m.stations.price_at(msg['latitude'],msg['longitude'],msg['fuel']) if msg['price_only'] else m.stations.nearby(msg['kind'],msg['latitude'],msg['longitude'],msg['fuel']))
        connection.send_result(msg['id'],result)
    except ValueError as error:connection.send_error(msg['id'],'provider_error',str(error))


@websocket_api.websocket_command({vol.Required('type'):'carrot_ha/journal/nas/config',vol.Required('enabled'):bool,vol.Required('path'):str,vol.Required('automatic_locations'):bool})
@websocket_api.async_response
async def nas_config(hass,connection,msg):
    if not connection.user or not connection.user.is_admin:
        connection.send_error(msg['id'],'unauthorized','관리자 계정이 필요해요.');return
    from .vehicles import manager
    from .nas_backup import network_path
    m=manager(hass)
    try:
        if msg['enabled']:await hass.async_add_executor_job(network_path,msg['path'])
        async with m.lock:
            previous=m.backup_config,m.automatic_locations
            m.backup_config={'enabled':msg['enabled'],'path':msg['path']};m.automatic_locations=msg['automatic_locations']
            try:await m.persist()
            except Exception:m.backup_config,m.automatic_locations=previous;raise
        connection.send_result(msg['id'],{'saved':True})
    except Exception as error:connection.send_error(msg['id'],'storage_failed',str(error) if isinstance(error,ValueError) else '설정을 저장하지 못했어요.')


@websocket_api.websocket_command({vol.Required('type'):'carrot_ha/journal/nas/action',vol.Required('action'):vol.In(['run','list'])})
@websocket_api.async_response
async def nas_action(hass,connection,msg):
    if not connection.user or not connection.user.is_admin:
        connection.send_error(msg['id'],'unauthorized','관리자 계정이 필요해요.');return
    from .vehicles import manager
    try:
        nas=manager(hass).nas
        connection.send_result(msg['id'],await (nas.run() if msg['action']=='run' else nas.listing()))
    except Exception as error:connection.send_error(msg['id'],'storage_failed',str(error) if isinstance(error,ValueError) else 'NAS 연결·백업을 확인해 주세요.')
