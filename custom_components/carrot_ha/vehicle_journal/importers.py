"""Bounded, read-only Michael XLSX decoding; no macros, formulas or external links."""
from collections import Counter
from datetime import date, datetime, timedelta
from decimal import Decimal, InvalidOperation
from hashlib import sha256
from io import BytesIO
import json
import re
import posixpath
from xml.etree import ElementTree as ET
from zipfile import ZipFile, BadZipFile

NS={'s':'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
MAX_UPLOAD=20*1024*1024


def xml(content):
    if b'<!DOCTYPE' in content or b'<!ENTITY' in content:raise ValueError('지원하지 않는 XML 파일이에요.')
    return ET.fromstring(content)


def worksheets(content):
    if not content or len(content)>MAX_UPLOAD:raise ValueError('20MiB 이하 XLSX 파일을 선택해 주세요.')
    if content.startswith(b'\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1'):return xls_worksheets(content)
    try:
        with ZipFile(BytesIO(content)) as z:
            infos=z.infolist()
            if len(infos)>500 or sum(i.file_size for i in infos)>40*1024*1024:raise ValueError('엑셀 파일이 너무 커요.')
            if len({i.filename for i in infos})!=len(infos):raise ValueError('중복 ZIP 항목이에요.')
            if any(i.flag_bits&1 for i in infos):raise ValueError('암호 없는 XLSX 파일을 선택해 주세요.')
            shared=[]
            if 'xl/sharedStrings.xml' in z.namelist():
                shared=[''.join(si.itertext()) for si in xml(z.read('xl/sharedStrings.xml')).findall('s:si',NS)]
            rels={e.attrib['Id']:e.attrib.get('Target','') for e in xml(z.read('xl/_rels/workbook.xml.rels')) if e.attrib.get('TargetMode')!='External'}
            sheets={}
            cells=0
            for sheet in xml(z.read('xl/workbook.xml')).findall('s:sheets/s:sheet',NS):
                target=rels.get(sheet.attrib.get('{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id'))
                if not target:raise ValueError('시트 연결을 확인해 주세요.')
                path=posixpath.normpath(posixpath.join('xl',target)) if not target.startswith('/') else target.lstrip('/')
                if not path.startswith('xl/worksheets/'):raise ValueError('지원하지 않는 시트 경로예요.')
                rows=[]
                for row in xml(z.read(path)).findall('s:sheetData/s:row',NS):
                    values={}
                    for cell in row.findall('s:c',NS):
                        cells+=1
                        if cells>100000:raise ValueError('최대 100,000개 셀까지 지원해요.')
                        if cell.find('s:f',NS) is not None:raise ValueError('수식이 있는 파일은 이관할 수 없어요. 마이클 원본 export를 사용해 주세요.')
                        column=''.join(c for c in cell.attrib.get('r','') if c.isalpha())
                        v=cell.find('s:v',NS)
                        value=v.text if v is not None else ''
                        if cell.attrib.get('t')=='s':value=shared[int(value)]
                        elif cell.attrib.get('t')=='inlineStr':value=''.join(cell.find('s:is',NS).itertext())
                        values[column]=value or ''
                    if any(values.values()):rows.append((int(row.attrib['r']),values))
                sheets[sheet.attrib['name']]=rows
            return sheets
    except (BadZipFile,KeyError,ET.ParseError,IndexError,TypeError) as e:
        raise ValueError('마이클 XLSX 형식을 확인해 주세요.') from e


def xls_worksheets(content):
    import xlrd
    try:
        workbook=xlrd.open_workbook(file_contents=content,on_demand=True,logfile=__import__('io').StringIO())
        if workbook.nsheets>15:raise ValueError('시트가 너무 많아요.')
        result={};cells=0
        for sheet in workbook.sheets():
            cells+=sheet.nrows*sheet.ncols
            if cells>100000:raise ValueError('최대 100,000개 셀까지 지원해요.')
            rows=[]
            for r in range(sheet.nrows):
                values={}
                for c in range(sheet.ncols):
                    if c>=26:raise ValueError('지원하지 않는 열 구성이에요.')
                    cell=sheet.cell(r,c)
                    if cell.ctype==xlrd.XL_CELL_DATE:value=xlrd.xldate_as_datetime(cell.value,workbook.datemode).date().isoformat()
                    elif cell.ctype==xlrd.XL_CELL_NUMBER:value=str(int(cell.value)) if cell.value==int(cell.value) else str(cell.value)
                    elif cell.ctype in (xlrd.XL_CELL_EMPTY,xlrd.XL_CELL_BLANK):value=''
                    else:value=str(cell.value)
                    values[chr(65+c)]=value
                if any(values.values()):rows.append((r+1,values))
            result[sheet.name]=rows
        workbook.release_resources()
        return result
    except (xlrd.XLRDError,OverflowError,IndexError) as e:raise ValueError('마이클 XLS 형식을 확인해 주세요.') from e


def numeric(value,integer=False):
    if value in ('',None):return None
    try:
        n=Decimal(str(value).replace(',','').strip())
        if not n.is_finite() or n<0 or n>1000000000 or (integer and n!=n.to_integral()):raise ValueError('숫자 범위를 확인해 주세요.')
        return int(n) if integer else float(n)
    except InvalidOperation as e:raise ValueError('숫자 형식을 확인해 주세요.') from e


def accounting_date(value):
    text=str(value).strip().replace('.','-').replace('/','-')
    try:
        d=date.fromisoformat(text) if '-' in text else (datetime(1899,12,30)+timedelta(days=float(text))).date()
        if d<date(1900,1,1) or d>date.today():raise ValueError('날짜 범위를 확인해 주세요.')
        return d.isoformat()
    except (ValueError,OverflowError) as e:raise ValueError('날짜 형식을 확인해 주세요.') from e


def michael_preview(content,fuel):
    sheets=worksheets(content)
    supported={'주유(충전)','주유','충전','정비','기타','주행'}
    if not supported.intersection(sheets):raise ValueError('마이클 export 시트를 찾지 못했어요.')
    records=[];warnings=[]
    info={row.get('B'):row.get('C') for _,row in sheets.get('내차정보',sheets.get('리포트',[]))}
    source_fuel={'전기':'electric','휘발유':'gasoline','경유':'diesel','디젤':'diesel','하이브리드':'hybrid'}.get(info.get('연료'))
    if source_fuel and source_fuel!=fuel:raise ValueError('선택한 유종과 파일의 연료가 달라요. 유종을 확인해 주세요.')
    for sheet,rows in sheets.items():
        if sheet not in supported:
            if sheet not in ('내차정보','리포트'):warnings.append(f'{sheet}: 지원하지 않는 시트예요.')
            continue
        if not rows:continue
        headers={column:re.sub(r'\([^)]*\)','',value.strip()) for column,value in rows[0][1].items()}
        if '날짜' not in headers.values():raise ValueError(f'{sheet}: 날짜 열을 찾지 못했어요.')
        for row_number,values in rows[1:]:
            raw={headers[c]:v for c,v in values.items() if c in headers}
            if not raw.get('날짜'):continue
            try:
                d=accounting_date(raw['날짜']);amount=numeric(raw.get('금액'),True)
                category='other';details=raw.get('지출항목') or raw.get('정비항목') or raw.get('항목') or raw.get('구분') or ''
                if sheet=='정비':category='maintenance'
                elif sheet in ('주유(충전)','주유','충전'):category='charging' if fuel=='electric' else 'refueling'
                elif sheet=='기타':
                    if '보험' in details:category='insurance'
                    elif '세금' in details or '자동차세' in details:category='tax'
                    elif '세차' in details:category='washing'
                    elif '주차' in details:category='parking'
                    elif '통행' in details or '하이패스' in details:category='toll'
                data={'kind':'expense','date':d,'category':category,'subcategory':details[:100],'memo':raw.get('메모','')}
                if amount is not None:data['actual_krw']=amount
                if raw.get('장소명'):data['location']={'name':raw['장소명'][:200],'address':'','latitude':None,'longitude':None}
                for field in ('누적주행거리','구간거리','구간연비','단가','충전량','주유량','배터리잔량'):
                    if field in raw:numeric(raw[field])
                # Odometer-only entries are preserved as facts, without synthetic distance.
                if sheet=='주행':data={'kind':'trip','date':d,'memo':raw.get('메모',''),'odometer_km':numeric(raw.get('누적주행거리'))}
                identity=json.dumps([sheet,raw],ensure_ascii=False,sort_keys=True,separators=(',',':'))
                records.append({'payload':data,'source':{'provider':'michael','sheet':sheet,'row':row_number,'fields':raw},'fingerprint':sha256(identity.encode()).hexdigest()})
            except ValueError as e:raise ValueError(f'{sheet} {row_number}행: {e}') from e
    if not records:raise ValueError('이관할 기록이 없어요.')
    # Keep identical rows with stable occurrence IDs rather than dropping valid same-day entries.
    seen=Counter()
    for r in records:
        seen[r['fingerprint']]+=1;r['source_key']=r['fingerprint']+':'+str(seen[r['fingerprint']])
    dates=[r['payload']['date'] for r in records]
    return {'format':'michael','records':records,'summary':{'count':len(records),'from':min(dates),'to':max(dates),'total_krw':sum(r['payload'].get('actual_krw',0) for r in records),'categories':dict(Counter(r['payload'].get('category','odometer') for r in records))},'warnings':warnings+['누적주행거리·구간거리·연비는 원본으로 보존하며 불확실한 주행거리는 합산하지 않아요.','엑셀에는 사진이 포함되지 않아요.']}
