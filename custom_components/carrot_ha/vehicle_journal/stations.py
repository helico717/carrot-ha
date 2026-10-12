"""Bounded official-place lookup and product-specific Opinet price suggestions."""
import asyncio
from datetime import datetime,timezone
from zoneinfo import ZoneInfo
import json
import math
import re
import time

PRODUCTS={'gasoline':'B027','diesel':'D047','premium':'B034'}


def coordinates(lat,lon):
    if type(lat)not in (int,float) or type(lon)not in (int,float) or not math.isfinite(lat) or not math.isfinite(lon) or not -90<=lat<=90 or not -180<=lon<=180:raise ValueError('위치 좌표를 확인해 주세요.')


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
                    if response.status!=200:raise ValueError('제공사 API 활성화·키·호출 한도를 확인해 주세요.')
                    body=await response.content.read(1048577)
                    if len(body)>1048576:raise ValueError('제공사 응답이 너무 커요.')
                    return json.loads(body)
        except ValueError:raise
        except Exception:raise ValueError('장소/가격 조회에 실패했어요. 기존 입력값은 유지합니다.') from None
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
            response=await self.cached(('chargers',round(lat,5),round(lon,5)),'kakao','search/keyword.json',{'query':'전기차 충전소','x':lon,'y':lat,'radius':2000,'sort':'distance','size':15})
            for place in response.get('documents',[])[:15]:
                a,b=float(place['y']),float(place['x']);coordinates(a,b)
                result.append({'location':{'name':place['place_name'][:200],'address':(place.get('road_address_name') or place.get('address_name',''))[:300],'latitude':a,'longitude':b,'provider':'kakao','station_id':str(place['id'])[:100],'station_type':'charging','selection_source':'automatic'},'distance_m':float(place.get('distance') or 0),'unit_price_krw':None,'price_basis':'existing_ev_tariff'})
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
        return {'candidates':result,'selected':result[0] if result else None,'message':'가장 가까운 후보를 자동 선택했어요. 실제 방문 장소와 단가를 확인해 주세요.' if result else '주변 장소를 찾지 못했어요. 직접 위치를 지정해 주세요.'}
    async def price_at(self,lat,lon,fuel):
        response=await self.nearby('refueling',lat,lon,fuel)
        selected=response['selected']
        if not selected or selected['distance_m']>150:return {'selected':None,'message':'지정 위치와 오피넷 주유소가 일치하지 않아 단가를 바꾸지 않았어요.'}
        return {'selected':selected,'message':'지정한 위치의 현재 오피넷 단가를 불러왔어요. 실제 단가로 수정할 수 있어요.'}
