"""Authenticated, decoded and metadata-free journal photographs."""
from hashlib import sha256
from io import BytesIO
from pathlib import Path
from uuid import uuid4
from aiohttp import web
from homeassistant.components.http import HomeAssistantView
from .store import now


def save_photo(journal, record_id, content, filename):
    from PIL import Image
    if not 0<len(content)<=2097152:raise ValueError('Photo too large')
    with Image.open(BytesIO(content)) as image:
        if image.format not in ('JPEG','PNG','WEBP') or image.width*image.height>20000000:raise ValueError('Unsupported photo')
        image.load()
        format=image.format
        # Re-encode pixels only: no EXIF/GPS, script or appended payload metadata.
        clean=Image.new('RGBA' if image.mode in ('RGBA','LA','P') and format!='JPEG' else 'RGB',image.size)
        clean.paste(image.convert(clean.mode))
        output=BytesIO();clean.save(output,format=format)
        content=output.getvalue()
    if len(content)>2097152:raise ValueError('Decoded photo too large')
    mime={'JPEG':'image/jpeg','PNG':'image/png','WEBP':'image/webp'}[format]
    extension={'JPEG':'jpg','PNG':'png','WEBP':'webp'}[format]
    digest=sha256(content).hexdigest()
    directory=Path(journal.path).with_suffix('')/'attachments'
    directory.mkdir(parents=True,exist_ok=True)
    with journal.lock,journal.connect() as db:
        if not db.execute("SELECT 1 FROM records WHERE vehicle_id=? AND id=? AND origin='manual' AND status='active'",(journal.vehicle,record_id)).fetchone():raise ValueError('Manual record required')
        existing=db.execute("SELECT id FROM attachments WHERE vehicle_id=? AND record_id=? AND sha256=? AND status='active'",(journal.vehicle,record_id,digest)).fetchone()
        if existing:return {'attachment_id':existing[0]}
        key=str(uuid4());name=key+'.'+extension;path=directory/name
        temporary=directory/(name+'.partial')
        try:
            temporary.write_bytes(content);temporary.chmod(0o600);temporary.replace(path)
            db.execute('INSERT INTO attachments VALUES (?,?,?,?,?,?,?,?,?,?)',
                       (journal.vehicle,key,record_id,name,Path(filename or 'photo').name[:200],mime,len(content),digest,'active',now()))
        except Exception:
            temporary.unlink(missing_ok=True);path.unlink(missing_ok=True);raise
    return {'attachment_id':key}


def load_photo(journal, key):
    with journal.lock,journal.connect() as db:
        row=db.execute('''SELECT a.relative_path,a.content_type FROM attachments a JOIN records r
            ON r.vehicle_id=a.vehicle_id AND r.id=a.record_id WHERE a.vehicle_id=? AND a.id=?
            AND a.status='active' AND r.status='active' ''',(journal.vehicle,key)).fetchone()
    if not row:raise FileNotFoundError()
    base=Path(journal.path).with_suffix('')/'attachments'
    path=(base/row[0]).resolve()
    if path.parent!=base.resolve():raise ValueError('Invalid photo path')
    return path.read_bytes(),row[1]


class PhotoUpload(HomeAssistantView):
    url='/api/carrot_ha/v1/journal/{entry_id}/attachments'
    name='api:carrot_ha:journal:attachments'
    requires_auth=True

    def __init__(self,hass):self.hass=hass

    def _runtime(self,request,entry_id):
        user=request.get('hass_user')
        if not user or not user.is_admin:raise web.HTTPForbidden()
        runtime=self.hass.data.get('carrot_ha',{}).get(entry_id)
        if not isinstance(runtime,dict) or 'journal' not in runtime:raise web.HTTPNotFound()
        return runtime['journal']

    async def post(self,request,entry_id):
        journal=self._runtime(request,entry_id)
        try:
            reader=await request.multipart();record_id=None;content=None;filename=None
            async for part in reader:
                if part.name=='record_id':
                    raw=await part.read_chunk()
                    if len(raw)>128:raise ValueError('Invalid record ID')
                    record_id=raw.decode()
                elif part.name=='file':
                    filename=part.filename
                    chunks=[];size=0
                    while True:
                        chunk=await part.read_chunk()
                        if not chunk:break
                        size+=len(chunk)
                        if size>2097152:raise ValueError('Photo too large')
                        chunks.append(chunk)
                    content=b''.join(chunks)
                else:raise ValueError('Unsupported field')
            if not record_id or not content:raise ValueError('Missing photo')
            result=await self.hass.async_add_executor_job(save_photo,journal,record_id,content,filename)
            return web.json_response(result)
        except (ValueError,OSError,UnicodeError):
            return web.json_response({'error':'invalid_photo'},status=400)
        except Exception:
            return web.json_response({'error':'photo_save_failed'},status=400)


class PhotoDownload(PhotoUpload):
    url='/api/carrot_ha/v1/journal/{entry_id}/attachments/{attachment_id}'
    name='api:carrot_ha:journal:attachment'

    async def get(self,request,entry_id,attachment_id):
        journal=self._runtime(request,entry_id)
        try:content,mime=await self.hass.async_add_executor_job(load_photo,journal,attachment_id)
        except (ValueError,FileNotFoundError):raise web.HTTPNotFound()
        return web.Response(body=content,content_type=mime,headers={'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'})
