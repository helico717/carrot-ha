"""Kakao keyword search falls back to address search without importing HA."""
import ast,asyncio,sys,types
from pathlib import Path
from types import SimpleNamespace
import unittest


class _NoTimeout:
    async def __aenter__(self):return self
    async def __aexit__(self,*args):return False


class FakeResponse:
    def __init__(self,status,payload):self.status,self.payload=status,payload
    async def __aenter__(self):return self
    async def __aexit__(self,*args):return False
    async def json(self):return self.payload


class FakeSession:
    def __init__(self,keyword,address):self.replies={'keyword':keyword,'address':address};self.calls=[]
    def get(self,url,params=None,headers=None):
        kind='keyword' if 'keyword' in url else 'address';self.calls.append(kind)
        return FakeResponse(*self.replies[kind])


class LocationSearchTests(unittest.TestCase):
    def setUp(self):
        tree=ast.parse(Path('custom_components/carrot_ha/vehicle_journal/api.py').read_text())
        tree.body=[n for n in tree.body if isinstance(n,ast.FunctionDef) and n.name=='address_places' or isinstance(n,ast.AsyncFunctionDef) and n.name=='location_search']
        for n in tree.body:n.decorator_list=[]
        self.ns={'__package__':'fakepkg'}
        exec(compile(tree,'api.py','exec'),self.ns)
        self.manager=SimpleNamespace(kakao_rest_key='key',search_cache={},search_last=-10,stations=SimpleNamespace(cache={}))
        helpers=types.ModuleType('homeassistant.helpers.aiohttp_client')
        self.session=None
        helpers.async_get_clientsession=lambda hass:self.session
        vehicles=types.ModuleType('fakepkg.vehicles');vehicles.manager=lambda hass:self.manager
        pkg=types.ModuleType('fakepkg');pkg.__path__=[]
        self.mods={'homeassistant':types.ModuleType('homeassistant'),'homeassistant.helpers':types.ModuleType('homeassistant.helpers'),'homeassistant.helpers.aiohttp_client':helpers,'fakepkg':pkg,'fakepkg.vehicles':vehicles}
        sys.modules.update(self.mods)
        # HA runs Python 3.12+; older local interpreters lack asyncio.timeout.
        self.patched_timeout=not hasattr(asyncio,'timeout')
        if self.patched_timeout:asyncio.timeout=lambda seconds:_NoTimeout()
        self.results=[];self.errors=[]
        self.connection=SimpleNamespace(user=SimpleNamespace(is_admin=True),send_result=lambda i,r:self.results.append(r),send_error=lambda *a:self.errors.append(a))

    def tearDown(self):
        for name in self.mods:sys.modules.pop(name,None)
        if self.patched_timeout:del asyncio.timeout

    def search(self,keyword,address,query='서해안고속도로 242'):
        self.session=FakeSession(keyword,address)
        asyncio.run(self.ns['location_search'](None,self.connection,{'id':1,'query':query}))

    def test_keyword_hit_skips_address_lookup(self):
        self.search((200,{'documents':[{'id':'7','place_name':'주유소','road_address_name':'도로 1','x':'127.1','y':'37.1'}]}),(200,{'documents':[]}))
        self.assertEqual(self.session.calls,['keyword'])
        self.assertEqual(self.results[0][0]['station_id'],'7')

    def test_keyword_miss_uses_road_address(self):
        doc={'address_name':'충남 서산시 해미면 반양리 1','address':{'address_name':'충남 서산시 해미면 반양리 1'},'road_address':{'address_name':'충남 서산시 해미면 서해안고속도로 242','building_name':''},'x':'126.5','y':'36.7'}
        self.search((200,{'documents':[]}),(200,{'documents':[doc]}))
        self.assertEqual(self.session.calls,['keyword','address'])
        place=self.results[0][0]
        self.assertEqual((place['name'],place['address'],place['latitude'],place['longitude']),('충남 서산시 해미면 서해안고속도로 242','충남 서산시 해미면 서해안고속도로 242',36.7,126.5))
        self.assertNotIn('station_id',place);self.assertEqual(place['provider'],'kakao')

    def test_building_name_and_lot_address_fallback(self):
        docs=[{'address_name':'지번 주소','address':{'address_name':'지번 주소'},'road_address':{'address_name':'도로명','building_name':'서산휴게소'},'x':'1','y':'2'},{'address_name':'지번만','address':None,'road_address':None,'x':'3','y':'4'},{'address_name':'좌표없음'}]
        places=self.ns['address_places'](docs)
        self.assertEqual([p['name'] for p in places],['서산휴게소','지번만'])

    def test_address_failure_is_empty_result_not_error(self):
        self.search((200,{'documents':[]}),(500,{}))
        self.assertEqual(self.results,[[]]);self.assertEqual(self.errors,[])

    def test_keyword_error_still_reported(self):
        self.search((401,{}),(200,{'documents':[]}))
        self.assertEqual(self.errors[0][1],'provider_error');self.assertEqual(self.session.calls,['keyword'])


if __name__=='__main__':unittest.main()
