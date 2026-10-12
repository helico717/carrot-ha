"""Admin-only, bounded local import previews and snapshot downloads."""
from aiohttp import web
from homeassistant.components.http import HomeAssistantView
from .vehicles import manager
from .snapshots import MAX_SNAPSHOT


class ImportPreview(HomeAssistantView):
    url='/api/carrot_ha/v1/journal/import-preview'
    name='api:carrot_ha:journal:import_preview'
    requires_auth=True
    def __init__(self,hass):self.hass=hass
    async def post(self,request):
        user=request.get('hass_user')
        if not user or not user.is_admin:raise web.HTTPForbidden()
        try:
            fields={};content=None
            reader=await request.multipart()
            async for part in reader:
                if part.name=='file':
                    if content is not None:raise ValueError('파일을 하나만 선택해 주세요.')
                    chunks=[];size=0
                    while True:
                        chunk=await part.read_chunk()
                        if not chunk:break
                        size+=len(chunk)
                        if size>MAX_SNAPSHOT:raise ValueError('파일이 너무 커요.')
                        chunks.append(chunk)
                    content=b''.join(chunks)
                elif part.name in ('kind','fuel'):
                    value=await part.read_chunk()
                    if len(value)>32 or part.name in fields:raise ValueError('입력 형식을 확인해 주세요.')
                    fields[part.name]=value.decode()
                else:raise ValueError('지원하지 않는 항목이에요.')
            if not content:raise ValueError('파일을 선택해 주세요.')
            result=await manager(self.hass).preview(content,fields.get('kind'),fields.get('fuel'),user.id)
            return web.json_response(result)
        except ValueError as error:
            return web.json_response({'error':str(error)},status=400)
        except (KeyError,TypeError,UnicodeError):
            return web.json_response({'error':'파일 또는 이관 내용을 확인해 주세요.'},status=400)
        except Exception:
            return web.json_response({'error':'파일을 읽지 못했어요. 저장하지 않았어요.'},status=400)


class SnapshotDownload(HomeAssistantView):
    url='/api/carrot_ha/v1/journal/{entry_id}/snapshot'
    name='api:carrot_ha:journal:snapshot'
    requires_auth=True
    def __init__(self,hass):self.hass=hass
    async def get(self,request,entry_id):
        user=request.get('hass_user')
        if not user or not user.is_admin:raise web.HTTPForbidden()
        try:content=await manager(self.hass).export(entry_id)
        except (ValueError,OSError):return web.json_response({'error':'스냅샷을 만들지 못했어요.'},status=400)
        return web.Response(body=content,content_type='application/zip',headers={'Content-Disposition':'attachment; filename="carrot-journal-snapshot.zip"','Cache-Control':'no-store'})


class NasDownload(HomeAssistantView):
    url='/api/carrot_ha/v1/journal/nas/{filename}'
    name='api:carrot_ha:journal:nas_snapshot'
    requires_auth=True
    def __init__(self,hass):self.hass=hass
    async def get(self,request,filename):
        user=request.get('hass_user')
        if not user or not user.is_admin:raise web.HTTPForbidden()
        try:
            m=manager(self.hass)
            content=await self.hass.async_add_executor_job(m.nas.io,'read',filename)
            return web.Response(body=content,content_type='application/zip',headers={'Content-Disposition':'attachment; filename="carrot-journal-snapshot.zip"','Cache-Control':'no-store'})
        except (ValueError,OSError):return web.json_response({'error':'NAS 스냅샷 검증 또는 다운로드에 실패했어요.'},status=400)
