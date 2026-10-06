"""Authenticated local journal WebSocket API. No browser tokens/webhooks."""
import voluptuous as vol
from homeassistant.components import websocket_api
from .store import Conflict


def runtime(hass, connection, msg):
    if not connection.user or not connection.user.is_admin:
        connection.send_error(msg['id'],'unauthorized','관리자 계정으로 확인해 주세요.')
        return None
    result=hass.data.get('carrot_ha',{}).get(msg['entry_id'])
    if not isinstance(result,dict) or 'journal' not in result:
        connection.send_error(msg['id'],'not_found','차계부 통합을 찾을 수 없어요.')
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


@websocket_api.websocket_command({vol.Required('type'):'carrot_ha/journal/entries'})
@websocket_api.async_response
async def entries(hass,connection,msg):
    if not connection.user or not connection.user.is_admin:
        connection.send_error(msg['id'],'unauthorized','관리자 계정이 필요해요.');return
    connection.send_result(msg['id'],[{'entry_id':key,'title':r['entry'].title} for key,r in hass.data.get('carrot_ha',{}).items()
                                      if isinstance(r,dict) and 'journal' in r])


@websocket_api.websocket_command({vol.Required('type'):'carrot_ha/journal/query',vol.Required('entry_id'):str,
    vol.Required('from'):str,vol.Required('to'):str,vol.Optional('offset',default=0):int})
@websocket_api.async_response
async def query(hass,connection,msg):
    r=runtime(hass,connection,msg)
    if r:
        try:
            result=await hass.async_add_executor_job(r['journal'].query,msg['from'],msg['to'],100,msg['offset'])
            from ..vehicle import values
            live=values(r)
            result['latest']={key:live.get(key) for key in ('soc_percent','range_km','range_estimated','driving','onroad','charging','doors_locked','odometer_km','outside_temp_c','last_received','measured_at')}
            result['sync_error']=r.get('journal_error')
            # Current fuel sensor values stay within HA; no external request.
            comparison=result.get('comparison')
            if comparison:
                import json
                from .store import number
                entities=json.loads(comparison['sensor_entities_json'])
                sensor=hass.states.get(entities.get(comparison['fuel'],''))
                if sensor and sensor.attributes.get('unit_of_measurement') in ('원/L','KRW/L','원/ℓ'):
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
            db.execute('''INSERT INTO comparison_settings VALUES (?,?,?,?,1,?) ON CONFLICT(vehicle_id)
                DO UPDATE SET fuel=excluded.fuel,economy_km_l=excluded.economy_km_l,
                sensor_entities_json=excluded.sensor_entities_json,version=comparison_settings.version+1,updated_at=excluded.updated_at''',
                (r['journal'].vehicle,fuel,economy,encode({fuel:entity}),now()))
        return {'saved':True}
    await execute(hass,connection,msg,write)


def register(hass):
    for method in (entries,query,save,status,comparison_save):websocket_api.async_register_command(hass,method)
