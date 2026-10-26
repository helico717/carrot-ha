"""Bounded official-place lookup and product-specific Opinet price suggestions."""
import asyncio
from datetime import datetime,timezone
from zoneinfo import ZoneInfo
import json
import math
import re
import time

from ..http_body import read_limited

PRODUCTS={'gasoline':'B027','diesel':'D047','premium':'B034'}


class ProviderError(ValueError):
    """Transient provider/transport failure; callers retry soon instead of treating it as a lookup result."""


def coordinates(lat,lon):
    if type(lat)not in (int,float) or type(lon)not in (int,float) or not math.isfinite(lat) or not math.isfinite(lon) or not -90<=lat<=90 or not -180<=lon<=180:raise ValueError('위치 좌표를 확인해 주세요.')


def distance_m(lat,lon,other_lat,other_lon):
    a,b=math.radians(lat),math.radians(other_lat)
    h=math.sin((b-a)/2)**2+math.cos(a)*math.cos(b)*math.sin(math.radians(other_lon-lon)/2)**2
    return 6371000*2*math.asin(min(1,math.sqrt(h)))


class Stations:
    def __init__(self,manager):self.manager=manager;self.cache={};self.lock=asyncio.Lock();self.requests=0;self.day=''
    async def get(self,service,path,params):
        from homeassistant.helpers.aiohttp_client import async_get_clientsession
        if service=='kakao':
            key=self.manager.kakao_rest_key
            if not key:raise ValueError('카카오 REST API 키가 필요해요.')
            url='https://dapi.kakao.com/v2/local/'+path;headers={'Authorization':'KakaoAK '+key}
        else:
            key=self.manager.opinet_key
            if not key:raise ValueError('오피넷 일반 API 키가 필요해요.')
            url='https://www.opinet.co.kr/api/'+path;headers={};params={**params,('code' if key.startswith('F') else 'certkey'):key,'out':'json'}
            today=datetime.now(ZoneInfo('Asia/Seoul')).date().isoformat()
            if self.day!=today:self.day=today;self.requests=0
            if self.requests>=250:raise ValueError('오늘 차계부 오피넷 호출 한도에 도달했어요.')
            self.requests+=1
        try:
            async with asyncio.timeout(12):
                async with async_get_clientsession(self.manager.hass).get(url,params=params,headers=headers,allow_redirects=False) as response:
                    if response.status!=200:raise ProviderError('제공사 API 활성화·키·호출 한도를 확인해 주세요.')
                    # Read to EOF: a single read() can stop at the first network chunk and truncate JSON.
                    body=await read_limited(response,1048576)
                    if body is None:raise ProviderError('제공사 응답이 너무 커요.')
                    try:return json.loads(body)
                    except ValueError:raise ProviderError('제공사 응답을 끝까지 확인하지 못했어요. 잠시 뒤 다시 조회할게요.') from None
        except ValueError:raise
        except Exception:raise ProviderError('장소/가격 조회에 실패했어요. 기존 입력값은 유지합니다.') from None
    async def cached(self,key,service,path,params,ttl=900):
        now=time.monotonic();item=self.cache.get(key)
        if item and now-item[0]<ttl:return item[1]
        async with self.lock:
            item=self.cache.get(key)
            if item and time.monotonic()-item[0]<ttl:return item[1]
            result=await self.get(service,path,params)
            if len(self.cache)>=200:self.cache.clear()
            self.cache[key]=(time.monotonic(),result);return result
    async def transform(self,x,y,input_coord,output_coord):
        result=await self.cached(('coord',x,y,input_coord,output_coord),'kakao','geo/transcoord.json',{'x':x,'y':y,'input_coord':input_coord,'output_coord':output_coord},86400)
        documents=result.get('documents',[])
        if not documents:raise ValueError('좌표계를 변환하지 못했어요.')
        return float(documents[0]['x']),float(documents[0]['y'])
    async def nearby(self,kind,lat,lon,fuel='gasoline'):
        coordinates(lat,lon)
        if kind not in ('charging','refueling'):raise ValueError('장소 종류를 확인해 주세요.')
        result=[];observed=datetime.now(timezone.utc).isoformat()
        if kind=='charging':
            places={};incomplete=False;frontier=math.inf
            # Combine spelling variants, but exclude LPG and unrelated keyword matches.
            for query in ('전기차 충전소','전기차충전소','전기자동차 충전소'):
                for page in range(1,4):
                    response=await self.cached(('chargers',round(lat,5),round(lon,5),query,page),'kakao','search/keyword.json',{'query':query,'x':lon,'y':lat,'radius':2000,'sort':'distance','size':15,'page':page})
                    documents=response.get('documents',[])[:15]
                    for place in documents:
                        category=re.sub(r'\s+','',str(place.get('category_name','')))
                        if '전기차충전소' not in category and '전기자동차충전소' not in category:continue
                        try:
                            a,b=float(place['y']),float(place['x']);coordinates(a,b)
                            key=str(place['id'])
                            places[key]={'location':{'name':place['place_name'][:200],'address':(place.get('road_address_name') or place.get('address_name',''))[:300],'latitude':a,'longitude':b,'provider':'kakao','station_id':key[:100],'station_type':'charging','selection_source':'automatic'},'distance_m':distance_m(lat,lon,a,b),'unit_price_krw':None,'price_basis':'existing_ev_tariff'}
                        except (ValueError,TypeError,KeyError):continue
                    if response.get('meta',{}).get('is_end',True) or not documents:break
                    if page==3:
                        incomplete=True
                        # Distance-sorted: every unseen place is at least as far as the last returned one.
                        try:frontier=min(frontier,distance_m(lat,lon,float(documents[-1]['y']),float(documents[-1]['x'])))
                        except (ValueError,TypeError,KeyError):frontier=0
            result=list(places.values())

        else:
            if fuel not in PRODUCTS:raise ValueError('실제 주유 유종을 선택해 주세요.')
            x,y=await self.transform(lon,lat,'WGS84','KTM')
            response=await self.cached(('gas',round(lat,5),round(lon,5),fuel),'opinet','aroundAll.do',{'x':x,'y':y,'radius':5000,'sort':2,'prodcd':PRODUCTS[fuel]})
            oils=response.get('RESULT',{}).get('OIL',[])
            if not isinstance(oils,list):raise ValueError('오피넷 응답을 확인해 주세요.')
            for oil in oils[:10]:
                b,a=await self.transform(float(oil['GIS_X_COOR']),float(oil['GIS_Y_COOR']),'KTM','WGS84');coordinates(a,b)
                price=float(oil.get('PRICE') or 0)
                result.append({'location':{'name':str(oil['OS_NM'])[:200],'address':str(oil.get('NEW_ADR') or oil.get('VAN_ADR') or '')[:300],'latitude':a,'longitude':b,'provider':'opinet','station_id':str(oil['UNI_ID'])[:100],'station_type':'refueling','selection_source':'automatic'},'distance_m':float(oil.get('DISTANCE') or 0),'unit_price_krw':price if math.isfinite(price) and price>0 else None,'price_observed_at':observed,'price_basis':'opinet_current','fuel_type':fuel})
        result.sort(key=lambda p:p['distance_m'])
        selected=result[0] if result else None
        # Truncation only matters when an unseen place could be nearer than, or ambiguous with, the selection.
        if kind=='charging' and incomplete and not (selected and selected['distance_m']<=150 and selected['distance_m']+25<=frontier):
            return {'reason':'incomplete','candidates':result,'selected':None,'message':'주변 충전소 검색 결과가 많아 전체 후보를 확인하지 못했어요. 실제 충전소를 검색해 선택해 주세요.'}
        if kind=='charging' and selected and selected['distance_m']>150:
            return {'reason':'far','candidates':result,'selected':None,'message':'150m 이내 충전소 후보가 없어 자동 지정하지 않았어요. 실제 충전소를 검색해 선택해 주세요.'}
        if kind=='charging' and selected and len(result)>1 and result[1]['distance_m']-selected['distance_m']<25:
            return {'reason':'ambiguous','candidates':result,'selected':None,'message':'비슷한 거리에 여러 충전소가 있어 자동 확정하지 않았어요. 실제 이용한 충전소를 검색해 선택해 주세요.'}
        return {'candidates':result,'selected':selected,'message':'가장 가까운 후보를 자동 선택했어요. 실제 방문 장소와 단가를 확인해 주세요.' if result else '주변 장소를 찾지 못했어요. 직접 위치를 지정해 주세요.'}
    async def address_location(self,lat,lon):
        """Road-address place for a verified GPS point; the coordinate is the geocoded address, so one address is one map place."""
        coordinates(lat,lon)
        response=await self.cached(('coord2address',round(lat,5),round(lon,5)),'kakao','geo/coord2address.json',{'x':lon,'y':lat},86400)
        documents=response.get('documents',[])
        if not documents:return None
        road=documents[0].get('road_address') or {};lot=documents[0].get('address') or {}
        address=(road.get('address_name') or lot.get('address_name') or '')[:300]
        if not address:return None
        found=await self.cached(('address',address),'kakao','search/address.json',{'query':address,'size':1},86400)
        try:a,b=float(found['documents'][0]['y']),float(found['documents'][0]['x']);coordinates(a,b)
        except (KeyError,IndexError,TypeError,ValueError):return None
        # A geocoded address far from the verified GPS fix is a wrong match, never a place to show on the map.
        if distance_m(lat,lon,a,b)>300:return None
        return {'name':(road.get('building_name') or address)[:200],'address':address,'latitude':a,'longitude':b,'provider':'kakao','station_type':'charging','selection_source':'automatic_address'}
    async def price_at(self,lat,lon,fuel):
        response=await self.nearby('refueling',lat,lon,fuel)
        selected=response['selected']
        if not selected or selected['distance_m']>150:return {'selected':None,'message':'지정 위치와 오피넷 주유소가 일치하지 않아 단가를 바꾸지 않았어요.'}
        return {'selected':selected,'message':'지정한 위치의 현재 오피넷 단가를 불러왔어요. 실제 단가로 수정할 수 있어요.'}
