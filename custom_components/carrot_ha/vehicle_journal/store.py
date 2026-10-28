"""Durable local facts, daily allocations and administrator manual records."""
from contextlib import contextmanager
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from uuid import UUID, uuid4, uuid5, NAMESPACE_URL
from zoneinfo import ZoneInfo
import hashlib
import json
import math
import sqlite3
import threading

UTC = timezone.utc
CATEGORIES = {'charging','refueling','maintenance','tuning','washing','insurance','tax','parking','toll','accident','other'}
METRICS = ('distance_km','energy_distance_km','drive_energy_kwh','drive_soc_used_pp',
           'parked_soc_used_pp','battery_charge_kwh','billed_charge_kwh')


class Conflict(ValueError):
    pass


def now():
    return datetime.now(UTC).isoformat()


def encode(value):
    return json.dumps(value, sort_keys=True, ensure_ascii=False, allow_nan=False, separators=(',', ':'))


def number(value):
    return value if type(value) in (int,float) and math.isfinite(value) and value >= 0 else None


def stamp(value):
    parsed = datetime.fromisoformat(value.replace('Z', '+00:00'))
    if parsed.tzinfo is None:
        raise ValueError('시각에 시간대가 필요해요.')
    return parsed.astimezone(UTC)


def day(value):
    result = date.fromisoformat(value)
    if result.isoformat() != value:
        raise ValueError('날짜 형식을 확인해 주세요.')
    return result


class Journal:
    def __init__(self, path, entry_id, device_id, time_zone):
        self.path = str(path)
        self.lock = threading.RLock()
        Path(path).parent.mkdir(parents=True, exist_ok=True)
        with self.connect() as db:
            exists = db.execute("SELECT 1 FROM sqlite_master WHERE name='journal_schema'").fetchone()
            if exists and db.execute('SELECT version FROM journal_schema').fetchall() in ([(1,)],[(2,)]):
                self._migrate_v1(db)
            if exists and db.execute('SELECT version FROM journal_schema').fetchall() != [(3,)]:
                raise ValueError('Unsupported journal schema')
        # Durable journal-to-archive payment writes survive either DB failing.
        with self.connect() as db:
            db.execute('''CREATE TABLE IF NOT EXISTS payment_outbox (
                record_id TEXT PRIMARY KEY, payment_id TEXT NOT NULL,
                source_ids TEXT NOT NULL, expected_version INTEGER NOT NULL, actual INTEGER)''')
        # SQL is copied into the integration package for HACS distributions.
        with self.connect() as db:
            db.executescript(Path(__file__).with_name('schema.sql').read_text())
            row = db.execute('SELECT id,entry_id,device_id,accounting_timezone FROM vehicles').fetchall()
            if row:
                if len(row) != 1 or row[0][1:3] != (entry_id, device_id):
                    raise ValueError('Journal vehicle mapping mismatch')
                self.vehicle, _, _, self.time_zone = row[0]
            else:
                self.vehicle, self.time_zone = str(uuid4()), time_zone
                db.execute('INSERT INTO vehicles VALUES (?,?,?,?,?,?)',
                           (self.vehicle, entry_id, device_id, time_zone, 'KRW', now()))
        self.tz = ZoneInfo(self.time_zone)
        self.device = device_id
        self.cleanup_purged_photos()

    def _migrate_v1(self, db):
        """Back up and atomically expand the expense category constraint."""
        import re
        backup=Path(self.path+'.before-schema3.sqlite3')
        if not backup.exists():
            temporary=Path(str(backup)+'.partial')
            target=sqlite3.connect(str(temporary))
            try:
                db.backup(target)
                if target.execute('PRAGMA quick_check').fetchone()!=('ok',):raise ValueError('스키마 변경 전 백업 검증에 실패했어요.')
            finally:target.close()
            temporary.replace(backup)
        with sqlite3.connect(backup.resolve().as_uri()+'?mode=ro',uri=True) as check:
            if check.execute('PRAGMA quick_check').fetchone()!=('ok',):raise ValueError('기존 스키마 백업을 확인해 주세요.')
        schema=Path(__file__).with_name('schema.sql').read_text()
        sql=re.search(r'CREATE TABLE IF NOT EXISTS expenses \(.*?\);',schema,re.S).group(0)
        db.execute('BEGIN IMMEDIATE')
        db.execute('DROP TRIGGER IF EXISTS attachments_limit_insert')
        db.execute('DROP TRIGGER IF EXISTS attachments_limit_update')
        db.execute(sql.replace('expenses (','expenses_new (',1))
        db.execute('INSERT INTO expenses_new SELECT * FROM expenses')
        members=db.execute('SELECT * FROM expense_members').fetchall()
        db.execute('DELETE FROM expense_members')
        db.execute('DROP TABLE expenses')
        db.execute('ALTER TABLE expenses_new RENAME TO expenses')
        db.executemany('INSERT INTO expense_members VALUES (?,?,?)',members)
        if db.execute('PRAGMA foreign_key_check').fetchall():raise ValueError('지출 연결 검증에 실패했어요.')
        db.execute('DELETE FROM journal_schema')
        db.execute('INSERT INTO journal_schema(version) VALUES(3)')
        db.commit()

    def import_michael(self, rows):
        """Commit a previewed batch as one transaction, preserving source fields."""
        from datetime import time
        counts={'imported':0,'skipped':0}
        with self.lock,self.connect() as db:
            for row in rows:
                key=self.identity('michael',row['source_key'])
                if db.execute('SELECT 1 FROM records WHERE vehicle_id=? AND id=?',(self.vehicle,key)).fetchone():
                    counts['skipped']+=1;continue
                data=dict(row['payload']);kind=data['kind']
                start=datetime.combine(day(data['date']),time(),self.tz).astimezone(UTC).isoformat()
                if kind=='trip':data.update(started_at=start,ended_at=start)
                quality={'origin':'manual','provider':'michael','distance':'unknown'}
                self._record(db,key,kind,'manual',data,quality=quality)
                db.execute('UPDATE records SET extra_json=? WHERE vehicle_id=? AND id=?',
                           (encode({'input':data,'import_source':row['source']}),self.vehicle,key))
                if kind=='expense':self._expense(db,key,data)
                else:self._mobility(db,key,data);self._parts(db,key,data,quality)
                db.execute('INSERT INTO change_log(vehicle_id,record_id,actor,operation,after_json,changed_at) VALUES (?,?,?,?,?,?)',
                           (self.vehicle,key,'administrator','import_michael',encode(data),now()))
                counts['imported']+=1
        self.aggregate()
        return counts

    @contextmanager
    def connect(self):
        with self.lock:
            if getattr(self,'permanently_deleted',False):raise ValueError('영구 삭제된 차량이에요.')
            db = sqlite3.connect(self.path, timeout=15)
            db.execute('PRAGMA foreign_keys=ON')
            db.row_factory = None
            try:
                with db:
                    yield db
            finally:
                db.close()

    def identity(self, kind, source):
        return str(uuid5(NAMESPACE_URL, encode([self.vehicle,kind,source])))

    def _record(self, db, key, kind, origin, payload, source=None, status='active', quality=None):
        fingerprint = hashlib.sha256(encode(payload).encode()).hexdigest()
        old = db.execute('SELECT source_fingerprint,status FROM records WHERE vehicle_id=? AND id=?',
                         (self.vehicle,key)).fetchone()
        if old and old[0]=='purged':return False
        if old == (fingerprint,status):
            return False
        db.execute('''INSERT INTO records
            (vehicle_id,id,kind,origin,source_kind,source_id,source_fingerprint,status,quality_json,created_at,updated_at)
            VALUES (?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(vehicle_id,id) DO UPDATE SET
            source_fingerprint=excluded.source_fingerprint,status=excluded.status,
            quality_json=excluded.quality_json,updated_at=excluded.updated_at,version=records.version+1''',
            (self.vehicle,key,kind,origin,kind if source else None,source,fingerprint,status,
             encode(quality or {}),now(),now()))
        return True

    def _mobility(self, db, key, data):
        fields = ('started_at','ended_at','distance_km','drive_energy_kwh','battery_charge_kwh',
                  'billed_charge_kwh','soc_start_percent','soc_end_percent','drive_soc_used_pp',
                  'parked_soc_used_pp','charged_soc_pp','odometer_km','charge_mode','location_name','memo')
        values = [data.get(k) for k in fields]
        values[12] = data.get('charge_mode','unknown')
        values[14] = data.get('memo','')
        db.execute('INSERT OR REPLACE INTO mobility VALUES ('+','.join('?' for _ in range(17))+')',
                   (self.vehicle,key,*values))

    def _dirty(self, db, dates):
        for value in dates:
            db.execute('''INSERT INTO dirty_days VALUES (?,?,?,1,?,?)
                ON CONFLICT(vehicle_id,day,accounting_timezone) DO UPDATE SET
                generation=dirty_days.generation+1,updated_at=excluded.updated_at''',
                (self.vehicle,value,self.time_zone,'record_changed',now()))

    def _parts(self, db, key, data, quality):
        previous = [r[0] for r in db.execute('SELECT day FROM day_parts WHERE vehicle_id=? AND record_id=?',
                                            (self.vehicle,key))]
        db.execute('DELETE FROM day_parts WHERE vehicle_id=? AND record_id=?',(self.vehicle,key))
        start,end = stamp(data['started_at']),stamp(data['ended_at'])
        if end < start:
            raise ValueError('종료 시각을 확인해 주세요.')
        current = start
        dates = []
        while current < end or not dates:
            local_day = current.astimezone(self.tz).date()
            next_midnight = datetime.combine(local_day+timedelta(days=1),datetime.min.time(),self.tz).astimezone(UTC)
            stop = min(end,next_midnight)
            ratio = (stop-current).total_seconds()/(end-start).total_seconds() if end > start else 1
            metrics = {k:data[k]*ratio for k in METRICS if data.get(k) is not None}
            if data.get('drive_energy_kwh') is not None and data.get('distance_km') is not None:
                metrics['energy_distance_km'] = data['distance_km']*ratio
            if data.get('kind') == 'charge' and not dates:
                metrics[data.get('charge_mode','unknown')+'_count'] = 1
            value = local_day.isoformat()
            method = 'manual' if quality.get('origin')=='manual' else ('time_prorated' if start.astimezone(self.tz).date()!=end.astimezone(self.tz).date() else 'start_date')
            db.execute('INSERT INTO day_parts VALUES (?,?,?,?,?,?,?,1)',
                (self.vehicle,key,value,self.time_zone,method,encode(metrics),encode(quality)))
            dates.append(value)
            if stop >= end:
                break
            current = stop
        self._dirty(db,set(previous+dates))

    def _expense(self, db, key, data, owner='journal', payment=None, version=None):
        if db.execute("SELECT 1 FROM records WHERE vehicle_id=? AND id=? AND source_fingerprint='purged'",(self.vehicle,key)).fetchone():return False
        self._dirty(db,[r[0] for r in db.execute('SELECT accounting_date FROM expenses WHERE vehicle_id=? AND record_id=?',(self.vehicle,key))])
        db.execute('''INSERT OR REPLACE INTO expenses VALUES (?,?,?,?,?,?,?,?,?,?,?,?)''',
            (self.vehicle,key,data['date'],data.get('paid_date'),data['category'],data.get('subcategory'),
             data.get('actual_krw'),data.get('estimated_krw'),owner,payment,version,data.get('memo','')))
        self._dirty(db,[data['date']])

    def import_snapshot(self, trips, charges, groups, deleted, generation):
        """Consume a consistent local source snapshot. Raw retention is not deletion."""
        with self.lock:
            for offset in range(0,len(trips),200):
                with self.connect() as db:
                    for source, data, quality in trips[offset:offset+200]:
                        key = self.identity('trip',source)
                        if self._record(db,key,'trip','automatic',data,source,quality=quality):
                            self._mobility(db,key,data)
                            self._parts(db,key,dict(data,kind='trip'),quality)
            for offset in range(0,len(charges),200):
                with self.connect() as db:
                    for source, data, quality, status in charges[offset:offset+200]:
                        key = self.identity('charge',source)
                        if self._record(db,key,'charge','automatic',data,source,status,quality):
                            self._mobility(db,key,data)
                            self._parts(db,key,dict(data,kind='charge'),quality)
            # Payment groups/exclusions are replaced together to avoid double costs.
            with self.connect() as db:
                old_days = [r[0] for r in db.execute('''SELECT accounting_date FROM expenses
                    WHERE vehicle_id=? AND payment_owner='ha_charge_payment' ''',(self.vehicle,))]
                live_group_ids=[]
                for group in groups:
                    data = group['data']; source = group['event_id']; key = self.identity('expense',source)
                    live_group_ids.append(key)
                    override = db.execute('SELECT extra_json,status FROM records WHERE vehicle_id=? AND id=?',(self.vehicle,key)).fetchone()
                    extra=json.loads(override[0]) if override else {}
                    if extra.get('journal_override') and not extra.get('payment_linked'):
                        continue
                    value = dict(date=data['accounting_date'],category='charging',actual_krw=data['actual_cost_krw'],
                                 estimated_krw=data['estimated_cost_krw'])
                    if extra.get('payment_linked') and extra.get('input'):
                        local=extra['input']
                        value.update(date=local.get('date',value['date']),memo=local.get('memo',''),subcategory=local.get('subcategory'))
                        local['actual_krw']=data['actual_cost_krw']
                        extra['input']=local
                        db.execute('UPDATE records SET extra_json=? WHERE vehicle_id=? AND id=?',(encode(extra),self.vehicle,key))
                    self._record(db,key,'expense','automatic',value,source,
                                 override[1] if override and extra.get('journal_override') and override[1]=='deleted' else ('excluded' if data.get('excluded') else 'active'),{'origin':'automatic','cost_source':data['cost_source']})
                    extra.update(payment_linked=True,payment_source_ids=data['source_event_ids'])
                    db.execute('UPDATE records SET extra_json=? WHERE vehicle_id=? AND id=?',(encode(extra),self.vehicle,key))
                    self._expense(db,key,value,'ha_charge_payment',source,data['payment_version'])
                    db.execute('DELETE FROM expense_members WHERE vehicle_id=? AND expense_id=?',(self.vehicle,key))
                    for member in data['source_event_ids']:
                        charge_key=self.identity('charge',member)
                        if db.execute('SELECT 1 FROM mobility WHERE vehicle_id=? AND record_id=?',(self.vehicle,charge_key)).fetchone():
                            db.execute('INSERT INTO expense_members VALUES (?,?,?)',(self.vehicle,key,charge_key))
                for (old_key,) in db.execute("SELECT id FROM records WHERE vehicle_id=? AND kind='expense' AND origin='automatic' AND status!='superseded'",(self.vehicle,)).fetchall():
                    if old_key not in live_group_ids:
                        db.execute("UPDATE records SET status='superseded',version=version+1 WHERE vehicle_id=? AND id=?",(self.vehicle,old_key))
                for source in deleted:
                    key=self.identity('charge',source)
                    db.execute("UPDATE records SET status='deleted' WHERE vehicle_id=? AND id=? AND source_fingerprint!='purged'",(self.vehicle,key))
                    self._dirty(db,[r[0] for r in db.execute('SELECT day FROM day_parts WHERE vehicle_id=? AND record_id=?',(self.vehicle,key))])
                self._dirty(db,old_days)
                basis=getattr(self,'soc_capacity_kwh',None)
                if basis!=self.synced_soc_basis(db):
                    # Re-aggregate every day so SOC coverage follows the new basis.
                    self._dirty(db,[r[0] for r in db.execute('SELECT DISTINCT day FROM day_parts WHERE vehicle_id=?',(self.vehicle,))])
            self.aggregate()
            with self.connect() as db:
                db.execute('''INSERT INTO sync_state VALUES (?,?,?,'complete',NULL,?)
                    ON CONFLICT(vehicle_id,source_kind) DO UPDATE SET cursor_json=excluded.cursor_json,
                    phase='complete',last_error=NULL,updated_at=excluded.updated_at''',
                    (self.vehicle,'archive',encode({'generation':generation,'soc_capacity_kwh':basis}),now()))

    def synced_soc_basis(self, db=None):
        if db is None:
            with self.connect() as db:return self.synced_soc_basis(db)
        row=db.execute("SELECT cursor_json FROM sync_state WHERE vehicle_id=? AND source_kind='archive'",(self.vehicle,)).fetchone()
        return json.loads(row[0]).get('soc_capacity_kwh') if row else None

    def aggregate(self):
        """Rebuild affected dates from compact facts; never read the source/cloud."""
        with self.lock, self.connect() as db:
            dirty = db.execute('SELECT day FROM dirty_days WHERE vehicle_id=? AND accounting_timezone=?',
                               (self.vehicle,self.time_zone)).fetchall()
            for (value,) in dirty:
                parts=db.execute('''SELECT p.metrics_json,p.quality_json FROM day_parts p JOIN records r
                    ON r.vehicle_id=p.vehicle_id AND r.id=p.record_id WHERE p.vehicle_id=?
                    AND p.day=? AND p.accounting_timezone=? AND r.status='active' ''',
                    (self.vehicle,value,self.time_zone)).fetchall()
                sums={k:None for k in METRICS}
                counts={k:0 for k in ('slow_count','fast_count','unknown_count')}
                qualities=[];soc_distance=None
                for metrics,quality in parts:
                    metrics=json.loads(metrics);qualities.append(json.loads(quality))
                    for key in METRICS:
                        if key in metrics:
                            sums[key]=(sums[key] or 0)+metrics[key]
                    # Distance that has measured SOC: the denominator for SOC per distance.
                    if 'drive_soc_used_pp' in metrics:
                        soc_distance=(soc_distance or 0)+metrics.get('distance_km',0)
                    for key in counts:
                        counts[key]+=metrics.get(key,0)
                categories={}; actual=estimated=effective=None; cost_sources=set()
                expenses=db.execute('''SELECT e.category,e.actual_krw,e.estimated_krw FROM expenses e JOIN records r
                    ON r.vehicle_id=e.vehicle_id AND r.id=e.record_id WHERE e.vehicle_id=?
                    AND e.accounting_date=? AND r.status='active' ''',(self.vehicle,value)).fetchall()
                for category,a,b in expenses:
                    cost=a if a is not None else b
                    cat=categories.setdefault(category,{'actual_krw':0,'estimated_krw':0,'effective_krw':0})
                    cat['actual_krw']+=a or 0; cat['estimated_krw']+=b or 0;cat['effective_krw']+=cost or 0
                    if category=='charging':
                        if cost is not None:cost_sources.add('actual' if a is not None else 'estimated')
                        if a is not None: actual=(actual or 0)+a
                        if b is not None: estimated=(estimated or 0)+b
                        if cost is not None: effective=(effective or 0)+cost
                coverage=100*(sums['energy_distance_km'] or 0)/sums['distance_km'] if sums['distance_km'] else None
                quality={'origins':sorted({q.get('origin','automatic') for q in qualities}),
                         'energy_coverage_percent':coverage,'soc_distance_km':soc_distance,'total_soc':'missing',
                         'allocation':'boundary_or_time_prorated','parking':'not_available',
                         'cost_source':'mixed' if len(cost_sources)>1 else next(iter(cost_sources),'missing')}
                columns=['vehicle_id','day','accounting_timezone',*METRICS,'total_soc_used_pp',
                         'charge_actual_krw','charge_estimated_krw','charge_effective_krw',*counts,
                         'cost_categories_json','quality_json','provisional','aggregation_version','updated_at']
                values=[self.vehicle,value,self.time_zone,*[sums[k] for k in METRICS],None,
                        actual,estimated,effective,*counts.values(),encode(categories),encode(quality),
                        int(value>=datetime.now(self.tz).date().isoformat()),1,now()]
                db.execute('INSERT OR REPLACE INTO daily_summaries ('+','.join(columns)+') VALUES ('+','.join('?' for _ in values)+')',values)
                db.execute('DELETE FROM dirty_days WHERE vehicle_id=? AND day=? AND accounting_timezone=?',
                           (self.vehicle,value,self.time_zone))

    def query(self, start, end, limit=100, offset=0, include_trips=True, record_categories=None, expenses_only=False, record_sort='time',manual_records=False,place=None):
        a,b=day(start),day(end)
        if b<a or (b-a).days>365 or type(limit) is not int or not 1<=limit<=100 or type(offset) is not int or offset<0:
            raise ValueError('조회 기간과 페이지를 확인해 주세요.')
        if record_sort not in ('time','amount_desc','amount_asc'):raise ValueError('정렬 기준을 확인해 주세요.')
        if type(expenses_only) is not bool or type(include_trips) is not bool or (record_categories is not None and
                (not isinstance(record_categories,list) or any(not isinstance(key,str) or key not in CATEGORIES|{'trip'} for key in record_categories))):
            raise ValueError('기록 필터를 확인해 주세요.')
        record_categories=sorted(set(record_categories or []))
        record_filter=" AND r.kind!='trip'" if not include_trips else ''
        if manual_records:record_filter=" AND (r.kind='expense' OR (r.kind='trip' AND r.origin='manual'))"
        elif expenses_only:record_filter=" AND r.kind='expense'"
        time_order=('COALESCE(e.accounting_date,m.started_at) DESC,COALESCE(m.started_at,(SELECT MAX(m3.started_at) FROM expense_members em3 '
                    'JOIN mobility m3 ON m3.vehicle_id=em3.vehicle_id AND m3.record_id=em3.charge_id WHERE em3.vehicle_id=r.vehicle_id AND em3.expense_id=r.id),r.created_at) DESC,r.rowid DESC')
        record_order=time_order if record_sort=='time' else 'COALESCE(e.actual_krw,e.estimated_krw) IS NULL,COALESCE(e.actual_krw,e.estimated_krw) '+('DESC' if record_sort=='amount_desc' else 'ASC')+','+time_order
        filter_params=[]
        if place is not None and (not isinstance(place,str) or not 1<=len(place)<=400):raise ValueError('장소 필터를 확인해 주세요.')
        if record_categories:
            clauses=[]
            for key in record_categories:
                if key=='trip':clauses.append("r.kind='trip'")
                elif key=='charging':clauses.append("(r.kind='charge' OR e.category='charging')")
                elif key=='other' and expenses_only:clauses.append("e.category NOT IN ('charging','refueling','maintenance','washing','tuning')")
                else:
                    clauses.append('e.category=?');filter_params.append(key)
            record_filter+=' AND ('+' OR '.join(clauses)+')'
        with self.lock,self.connect() as db:
            db.row_factory=sqlite3.Row
            if place:
                from .station_stats import place_record_ids
                ids=sorted(place_record_ids(db,self.vehicle,start,end,place))
                record_filter+=' AND r.id IN ('+','.join('?' for _ in ids)+')' if ids else ' AND 0'
                filter_params.extend(ids)
            daily=[dict(row) for row in db.execute('''SELECT * FROM daily_summaries WHERE vehicle_id=?
                AND accounting_timezone=? AND day BETWEEN ? AND ? ORDER BY day''',
                (self.vehicle,self.time_zone,start,end))]
            record_sql='''SELECT r.id,r.kind,r.origin,r.status,r.version,r.quality_json,r.extra_json,
                m.started_at,m.ended_at,m.odometer_km,m.distance_km,m.drive_energy_kwh,m.battery_charge_kwh,m.billed_charge_kwh,
                COALESCE(m.charge_mode,(SELECT m2.charge_mode FROM expense_members em JOIN mobility m2 ON m2.vehicle_id=em.vehicle_id AND m2.record_id=em.charge_id WHERE em.vehicle_id=r.vehicle_id AND em.expense_id=r.id LIMIT 1)) AS charge_mode,
                m.memo AS mobility_memo,e.accounting_date,e.category,e.subcategory,
                e.actual_krw,e.estimated_krw,e.memo AS expense_memo,e.payment_owner,e.payment_id,e.payment_version
                FROM records r LEFT JOIN mobility m ON m.vehicle_id=r.vehicle_id AND m.record_id=r.id
                LEFT JOIN expenses e ON e.vehicle_id=r.vehicle_id AND e.record_id=r.id
                WHERE r.vehicle_id=? AND r.status IN ('active','excluded','deleted') AND
                COALESCE(e.accounting_date,(SELECT MIN(p.day) FROM day_parts p WHERE p.vehicle_id=r.vehicle_id AND p.record_id=r.id AND p.accounting_timezone=?)) BETWEEN ? AND ?
                {record_filter}
                ORDER BY {record_order} LIMIT ? OFFSET ?'''
            rows=db.execute(record_sql.format(record_filter=record_filter,record_order=record_order),
                (self.vehicle,self.time_zone,start,end,*filter_params,limit+1,offset)).fetchall()
            recent_records=[dict(row) for row in db.execute(record_sql.format(record_filter=" AND r.kind='expense' AND r.status='active'",record_order=time_order),
                (self.vehicle,self.time_zone,start,end,-1,0))]
            # SQL date offset is only a prefilter; exact timezone dates are persisted below.
            records=[dict(r) for r in rows[:limit]]
            for record in records:
                record['duplicate_candidates']=[]
                if record['origin']=='manual' and record['kind'] in ('trip','charge'):
                    record['duplicate_candidates']=[{'id':r[0],'started_at':r[1]} for r in db.execute('''SELECT a.id,m.started_at FROM records a JOIN mobility m ON m.vehicle_id=a.vehicle_id AND m.record_id=a.id WHERE a.vehicle_id=? AND a.origin='automatic' AND a.kind=? AND a.status='active' AND EXISTS (SELECT 1 FROM day_parts x JOIN day_parts y ON x.vehicle_id=y.vehicle_id AND x.day=y.day AND x.accounting_timezone=y.accounting_timezone WHERE x.vehicle_id=a.vehicle_id AND x.record_id=a.id AND y.record_id=?)''',(self.vehicle,record['kind'],record['id']))]
                record['attachments']=[{'id':r[0],'name':r[1]} for r in db.execute("SELECT id,original_name FROM attachments WHERE vehicle_id=? AND record_id=? AND status='active'",(self.vehicle,record['id']))]
            setting=db.execute('SELECT * FROM comparison_settings WHERE vehicle_id=?',(self.vehicle,)).fetchone()
            phase=db.execute('SELECT phase,updated_at FROM sync_state WHERE vehicle_id=? AND source_kind=?',
                             (self.vehicle,'archive')).fetchone()
            from .fuel_metrics import facts,odometer
            fuel_facts=facts(db,self.vehicle,start,end)
            odometer_facts=odometer(db,self.vehicle,start,end)
            from .efficiency import calculate
            efficiency_facts=calculate(db,self.vehicle,start,end)
            from .station_stats import facts as place_facts
            station_stats=place_facts(db,self.vehicle,start,end)
            counts=dict(db.execute('''SELECT e.category, count(*) FROM expenses e
                JOIN records r ON r.vehicle_id=e.vehicle_id AND r.id=e.record_id
                WHERE e.vehicle_id=? AND r.status='active' AND e.accounting_date BETWEEN ? AND ?
                GROUP BY e.category''',(self.vehicle,start,end)).fetchall())
            total=db.execute('SELECT COUNT(*) FROM records WHERE vehicle_id=? AND status=?',(self.vehicle,'active')).fetchone()[0]
        for row in daily:
            row['cost_categories']=json.loads(row.pop('cost_categories_json'))
            row['quality']=json.loads(row.pop('quality_json'))
        for row in records+recent_records:
            extra=json.loads(row.pop('extra_json'));row['input']=extra.get('input');row['odometer_km']=(row['input'] or {}).get('odometer_km');row['location']=extra['location'] if 'location' in extra else (row['input'] or {}).get('location');row['import_source']=extra.get('import_source');row['quality']=json.loads(row.pop('quality_json'));row['memo']=row.pop('expense_memo') or row.get('mobility_memo') or '';row.pop('mobility_memo',None)
        with self.lock,self.connect() as db:
            from .station_stats import unit_price
            for row in records+recent_records:
                price=unit_price(db,self.vehicle,row)
                if price:row['unit_price']=price
            from .automatic_locations import diagnostics
            diagnostics(db,self.vehicle,records)
        totals={key:sum(r[key] for r in daily if r[key] is not None) if any(r[key] is not None for r in daily) else None
                for key in (*METRICS,'charge_actual_krw','charge_estimated_krw','charge_effective_krw','slow_count','fast_count','unknown_count')}
        totals['efficiency_km_kwh']=totals['energy_distance_km']/totals['drive_energy_kwh'] if totals['drive_energy_kwh'] else None
        totals['energy_coverage_percent']=100*totals['energy_distance_km']/totals['distance_km'] if totals['distance_km'] and totals['energy_distance_km'] is not None else None
        cats={}
        for row in daily:
            for category,cost in row['cost_categories'].items():
                target=cats.setdefault(category,{'actual_krw':0,'estimated_krw':0,'effective_krw':0,'count':0})
                for key in ('actual_krw','estimated_krw','effective_krw'):target[key]+=cost.get(key,0)
        for category,count in counts.items():
            cats.setdefault(category,{'actual_krw':0,'estimated_krw':0,'effective_krw':0})['count']=count
        totals['categories']=cats;totals['total_cost_krw']=sum(v['effective_krw'] for v in cats.values())
        return {'manual_trip_records_supported':True,'station_stats':station_stats,'efficiency_facts':efficiency_facts,'odometer_facts':odometer_facts,'fuel_facts':fuel_facts,'daily':daily,'records':records,'recent_records':recent_records,'expense_category_groups_supported':True,'expense_sort_supported':True,'expense_filters_supported':True,'record_filters_supported':True,'has_more':len(rows)>limit,'totals':totals,
                'timezone':self.time_zone,'status':dict(phase) if phase else {'phase':'pending'},
                'record_count':total,'comparison':dict(setting) if setting else None}

    def save_manual(self, key, expected, payload):
        UUID(key)
        if type(expected) is not int or expected<0 or not isinstance(payload,dict):raise ValueError('잘못된 기록이에요.')
        allowed={'kind','date','ended_date','started_at','ended_at','distance_km','drive_energy_kwh',
                 'battery_charge_kwh','billed_charge_kwh','charge_mode','category','subcategory','actual_krw',
                 'memo','unit_price_source','unit_price_observed_at','fuel_quantity_source','fuel_type','fuel_liters','unit_price_krw','full_tank','wash_cost_krw','odometer_km','soc_start_percent','soc_end_percent','location','remove_attachment_ids'}
        if set(payload)-allowed:raise ValueError('지원하지 않는 기록 항목이에요.')
        removals=payload.get('remove_attachment_ids',[])
        if not isinstance(removals,list) or len(removals)>10 or any(not isinstance(x,str) for x in removals) or len(set(removals))!=len(removals):raise ValueError('사진 삭제 항목을 확인해 주세요.')
        for attachment in removals:UUID(attachment)
        payload={k:v for k,v in payload.items() if k!='remove_attachment_ids'}
        data=dict(payload);kind=data.get('kind')
        if 'location' in data:self.validate_location(data['location'])
        if kind not in ('trip','charge','expense'):raise ValueError('기록 종류를 확인해 주세요.')
        value=day(data['date']).isoformat()
        if day(value)>datetime.now(self.tz).date():raise ValueError('미래 날짜는 기록할 수 없어요.')
        if len(data.get('memo',''))>4000 or len(data.get('subcategory',''))>100:raise ValueError('메모가 너무 길어요.')
        for field in METRICS+('fuel_liters','unit_price_krw','wash_cost_krw','odometer_km','soc_start_percent','soc_end_percent'):
            if data.get(field) is not None and (number(data[field]) is None or data[field]>100000000):raise ValueError('측정값을 확인해 주세요.')
        for field in ('soc_start_percent','soc_end_percent'):
            if data.get(field) is not None and data[field]>100:raise ValueError('SOC는 0~100%예요.')
        if data.get('actual_krw') is not None and (type(data['actual_krw']) is not int or not 0<=data['actual_krw']<=1000000000):raise ValueError('금액은 0 이상의 정수로 입력해 주세요.')
        if data.get('charge_mode','unknown') not in ('slow','fast','unknown'):raise ValueError('충전 종류를 확인해 주세요.')
        if 'unit_price_source' in data and data['unit_price_source'] not in ('manual','opinet','receipt'):raise ValueError('단가 출처를 확인해 주세요.')
        if 'unit_price_observed_at' in data:stamp(data['unit_price_observed_at'])
        if data.get('fuel_quantity_source','reported') not in ('reported','estimated'):raise ValueError('주유량 출처를 확인해 주세요.')
        if 'fuel_type' in data and data['fuel_type'] not in ('gasoline','diesel','premium'):raise ValueError('유종을 확인해 주세요.')
        if 'full_tank' in data and type(data['full_tank']) is not bool:raise ValueError('가득 주유 여부를 확인해 주세요.')
        if data.get('wash_cost_krw') is not None and type(data['wash_cost_krw']) is not int:raise ValueError('세차 금액은 정수로 입력해 주세요.')
        if kind=='expense' and data.get('category') not in CATEGORIES:raise ValueError('비용 분류를 확인해 주세요.')
        if kind=='trip' and data.get('distance_km') is None and data.get('odometer_km') is None:raise ValueError('주행거리를 입력해 주세요.')
        if kind=='charge' and data.get('battery_charge_kwh') is None:raise ValueError('충전량을 입력해 주세요.')
        if kind!='expense':
            start=stamp(data['started_at']) if data.get('started_at') else datetime.combine(day(value),datetime.min.time(),self.tz).astimezone(UTC)
            end=stamp(data['ended_at']) if data.get('ended_at') else start
            if end<start or (end-start).days>30 or start.astimezone(self.tz).date().isoformat()!=value:raise ValueError('기록 시각을 확인해 주세요.')
            data.update(started_at=start.isoformat(),ended_at=end.isoformat())
            a,b=data.get('soc_start_percent'),data.get('soc_end_percent')
            if a is not None and b is not None:
                if kind=='trip':data['drive_soc_used_pp']=max(0,a-b)
                else:data['charged_soc_pp']=max(0,b-a)
        with self.lock,self.connect() as db:
            old=db.execute('SELECT version,origin,extra_json,kind FROM records WHERE vehicle_id=? AND id=?',(self.vehicle,key)).fetchone()
            if old and old[3]!=kind:raise ValueError('기록 종류는 바꿀 수 없어요.')
            if old and json.loads(old[2]).get('purged'):raise Conflict('영구 삭제된 기록이에요.')
            serialized=encode(payload)
            if not removals and old and expected==0 and old[1]=='manual' and json.loads(old[2]).get('input')==payload:return {'id':key,'version':old[0]}
            if old and ((old[1]!='manual' and kind!='expense') or old[0]!=expected) or not old and expected!=0:raise Conflict('기록이 바뀌었어요. 새로고침해 주세요.')
            quality={'origin':'manual','energy':'manual','soc':'manual'}
            if removals:
                if not old or old[1] not in ('manual','automatic'):raise ValueError('사진을 수정할 수 없는 기록이에요.')
                for attachment in removals:
                    if not db.execute("SELECT 1 FROM attachments WHERE vehicle_id=? AND record_id=? AND id=? AND status='active'",(self.vehicle,key,attachment)).fetchone():raise Conflict('사진이 바뀌었어요. 새로고침해 주세요.')
                for attachment in removals:db.execute("UPDATE attachments SET status='deleted' WHERE vehicle_id=? AND record_id=? AND id=?",(self.vehicle,key,attachment))
            changed=self._record(db,key,kind,'manual',data,quality=quality)
            if removals and not changed:db.execute('UPDATE records SET version=version+1,updated_at=? WHERE vehicle_id=? AND id=?',(now(),self.vehicle,key))
            extra=json.loads(old[2]) if old else {}
            linked=bool(old and old[1]=='automatic' and kind=='expense' and extra.get('payment_linked'))
            if linked and (data.get('category')!='charging' or (data.get('actual_krw') is not None and data['actual_krw']>999999999)):raise ValueError('자동 충전 결제의 분류는 바꿀 수 없어요.')
            extra.update(input=payload, journal_override=bool(old and old[1]=='automatic'))
            if 'location' in payload:extra['location']=payload['location']
            db.execute('UPDATE records SET extra_json=? WHERE vehicle_id=? AND id=?',(encode(extra),self.vehicle,key))
            if kind=='trip' and db.execute("SELECT COUNT(*) FROM attachments WHERE vehicle_id=? AND record_id=? AND status='active'",(self.vehicle,key)).fetchone()[0]>1:raise ValueError('주행 기록 사진은 최대 1장이에요.')
            if kind=='expense':
                count=db.execute("SELECT COUNT(*) FROM attachments WHERE vehicle_id=? AND record_id=? AND status='active'",(self.vehicle,key)).fetchone()[0]
                limit=25 if data.get('category') in ('maintenance','tuning') else 10 if data.get('category')=='accident' else 5
                if count>limit:raise ValueError(f'사진이 {limit}장을 초과하는 기록의 분류는 바꿀 수 없어요.')
                if linked:
                    payment=db.execute('SELECT payment_id,payment_version,estimated_krw FROM expenses WHERE vehicle_id=? AND record_id=?',(self.vehicle,key)).fetchone()
                    db.execute('INSERT OR REPLACE INTO payment_outbox VALUES (?,?,?,?,?)',(key,payment[0],encode(extra['payment_source_ids']),payment[1],data.get('actual_krw')))
                    self._expense(db,key,dict(data,estimated_krw=payment[2]),'ha_charge_payment',payment[0],payment[1])
                else:self._expense(db,key,data)
                if data.get('category')=='refueling' or old:
                    wash_id=self.identity('refueling_wash_cost',key)
                    old_wash=db.execute('SELECT accounting_date FROM expenses WHERE vehicle_id=? AND record_id=?',(self.vehicle,wash_id)).fetchall()
                    self._dirty(db,[r[0] for r in old_wash])
                    if data.get('category')=='refueling' and data.get('wash_cost_krw',0)>0:
                        wash=dict(kind='expense',date=data['date'],category='washing',subcategory='주유와 함께 세차',memo='',actual_krw=data['wash_cost_krw'])
                        self._record(db,wash_id,'expense','manual',wash,quality=quality);self._expense(db,wash_id,wash)
                    else:db.execute("UPDATE records SET status='deleted' WHERE vehicle_id=? AND id=? AND source_fingerprint!='purged'",(self.vehicle,wash_id))
            else:
                self._mobility(db,key,data);self._parts(db,key,data,quality)
                if kind=='charge':
                    associated=self.identity('manual_charge_cost',key)
                    db.execute("UPDATE records SET status='deleted' WHERE vehicle_id=? AND id=? AND source_fingerprint!='purged'",(self.vehicle,associated))
                    old_dates=[r[0] for r in db.execute('SELECT accounting_date FROM expenses WHERE vehicle_id=? AND record_id=?',(self.vehicle,associated))]
                    self._dirty(db,old_dates)
                if kind=='charge' and data.get('actual_krw') is not None:
                    expense_id=self.identity('manual_charge_cost',key)
                    self._record(db,expense_id,'expense','manual',data,quality=quality)
                    self._expense(db,expense_id,dict(data,category='charging'))
                    if db.execute('SELECT 1 FROM expenses WHERE vehicle_id=? AND record_id=?',(self.vehicle,expense_id)).fetchone():
                        db.execute('INSERT OR IGNORE INTO expense_members VALUES (?,?,?)',(self.vehicle,expense_id,key))
            db.execute('INSERT INTO change_log(vehicle_id,record_id,actor,operation,after_json,changed_at) VALUES (?,?,?,?,?,?)',
                       (self.vehicle,key,'administrator','save',serialized,now()))
            version=db.execute('SELECT version FROM records WHERE vehicle_id=? AND id=?',(self.vehicle,key)).fetchone()[0]
        self.aggregate()
        return {'id':key,'version':version}

    @staticmethod
    def validate_location(location):
        import math
        if location is None:return
        if not isinstance(location,dict) or set(location)-{'name','address','latitude','longitude','provider','station_id','station_type','selection_source'}:raise ValueError('위치 항목을 확인해 주세요.')
        for key,limit in [('name',200),('address',300)]:
            if not isinstance(location.get(key,''),str) or len(location.get(key,''))>limit:raise ValueError('위치 이름이 너무 길어요.')
        if 'provider' in location and location['provider'] not in ('kakao','opinet','manual'):raise ValueError('장소 제공사를 확인해 주세요.')
        if 'station_id' in location and (not isinstance(location['station_id'],str) or not 1<=len(location['station_id'])<=100):raise ValueError('장소 ID를 확인해 주세요.')
        if 'station_type' in location and location['station_type'] not in ('charging','refueling'):raise ValueError('장소 종류를 확인해 주세요.')
        if 'selection_source' in location and location['selection_source'] not in ('automatic','automatic_address','manual'):raise ValueError('장소 선택 출처를 확인해 주세요.')
        lat,lon=location.get('latitude'),location.get('longitude')
        if (lat is None)!=(lon is None):raise ValueError('위도와 경도를 함께 입력해 주세요.')
        if lat is not None and (type(lat) not in (float,int) or type(lon) not in (float,int) or not math.isfinite(lat) or not math.isfinite(lon) or not -90<=lat<=90 or not -180<=lon<=180):raise ValueError('좌표 범위를 확인해 주세요.')

    def change_location(self,key,expected,location):
        self.validate_location(location)
        with self.lock,self.connect() as db:
            row=db.execute('SELECT version,extra_json FROM records WHERE vehicle_id=? AND id=?',(self.vehicle,key)).fetchone()
            if not row or row[0]!=expected:raise Conflict('기록이 바뀌었어요. 새로고침해 주세요.')
            extra=json.loads(row[1])
            if extra.get('purged'):raise Conflict('영구 삭제된 기록이에요.')
            extra['location']=location;extra['location_user_override']=True
            db.execute('UPDATE records SET extra_json=?,version=version+1,updated_at=? WHERE vehicle_id=? AND id=?',(encode(extra),now(),self.vehicle,key))
            db.execute('INSERT INTO change_log(vehicle_id,record_id,actor,operation,after_json,changed_at) VALUES (?,?,?,?,?,?)',(self.vehicle,key,'administrator','location',encode(location),now()))
        return {'id':key,'version':expected+1}

    def cleanup_purged_photos(self):
        base=(Path(self.path).with_suffix('')/'attachments').resolve()
        with self.lock,self.connect() as db:
            row=db.execute("SELECT cursor_json FROM sync_state WHERE vehicle_id=? AND source_kind='photo_cleanup'",(self.vehicle,)).fetchone()
            if not row:return 0
            remaining=[]
            for name in json.loads(row[0]).get('paths',[]):
                path=(base/name).resolve()
                if path.parent!=base or path.name!=name:raise ValueError('Invalid photo cleanup path')
                try:path.unlink(missing_ok=True)
                except OSError:remaining.append(name)
            db.execute("UPDATE sync_state SET cursor_json=?,phase=?,updated_at=? WHERE vehicle_id=? AND source_kind='photo_cleanup'",(encode({'paths':remaining}),'pending' if remaining else 'complete',now(),self.vehicle))
        return len(remaining)

    def purge_record(self,key,expected,confirm):
        UUID(key)
        if confirm is not True or type(expected) is not int or expected<1:raise ValueError('영구 삭제 확인이 필요해요.')
        with self.lock,self.connect() as db:
            row=db.execute('SELECT version,status,origin,kind,extra_json FROM records WHERE vehicle_id=? AND id=?',(self.vehicle,key)).fetchone()
            if not row or row[0]!=expected:raise Conflict('기록이 바뀌었어요. 새로고침해 주세요.')
            if row[1]!='deleted' or (row[2]!='manual' and row[3]!='expense'):raise ValueError('삭제된 기록만 영구 삭제할 수 있어요.')
            keys=[key]
            for kind in ('refueling_wash_cost','manual_charge_cost'):
                child=self.identity(kind,key)
                if db.execute("SELECT 1 FROM records WHERE vehicle_id=? AND id=? AND status='deleted'",(self.vehicle,child)).fetchone():keys.append(child)
            queued=db.execute("SELECT cursor_json FROM sync_state WHERE vehicle_id=? AND source_kind='photo_cleanup'",(self.vehicle,)).fetchone()
            paths=json.loads(queued[0]).get('paths',[]) if queued else []
            for rid in keys:
                self._dirty(db,[r[0] for r in db.execute('SELECT day FROM day_parts WHERE vehicle_id=? AND record_id=?',(self.vehicle,rid))]+[r[0] for r in db.execute('SELECT accounting_date FROM expenses WHERE vehicle_id=? AND record_id=?',(self.vehicle,rid))])
                paths.extend(r[0] for r in db.execute('SELECT relative_path FROM attachments WHERE vehicle_id=? AND record_id=?',(self.vehicle,rid)))
                db.execute('DELETE FROM expense_members WHERE vehicle_id=? AND (expense_id=? OR charge_id=?)',(self.vehicle,rid,rid))
                db.execute('DELETE FROM record_links WHERE vehicle_id=? AND (manual_id=? OR automatic_id=?)',(self.vehicle,rid,rid))
                for table in ('attachments','corrections','change_log','day_parts','expenses','mobility'):
                    db.execute('DELETE FROM '+table+' WHERE vehicle_id=? AND record_id=?',(self.vehicle,rid))
                # Minimal tombstone prevents archive synchronization from resurrecting it.
                db.execute("UPDATE records SET status='superseded',extra_json=?,quality_json='{}',source_revision=NULL,source_fingerprint='purged',version=version+1,updated_at=? WHERE vehicle_id=? AND id=?",(encode({'purged':True,'journal_override':True}),now(),self.vehicle,rid))
            db.execute("INSERT INTO sync_state VALUES (?, 'photo_cleanup', ?, 'pending', NULL, ?) ON CONFLICT(vehicle_id,source_kind) DO UPDATE SET cursor_json=excluded.cursor_json,phase=excluded.phase,updated_at=excluded.updated_at",(self.vehicle,encode({'paths':sorted(set(paths))}),now()))
        pending=self.cleanup_purged_photos();self.aggregate()
        return {'id':key,'purged':True,'photo_cleanup_pending':pending}

    def change_status(self, key, expected, status):
        if status not in ('active','deleted') or type(expected) is not int or expected<1:raise ValueError('잘못된 상태예요.')
        with self.lock,self.connect() as db:
            row=db.execute('SELECT origin,version,kind,extra_json FROM records WHERE vehicle_id=? AND id=?',(self.vehicle,key)).fetchone()
            if not row or row[1]!=expected or (row[0]!='manual' and row[2]!='expense'):raise Conflict('기록이 바뀌었어요. 새로고침해 주세요.')
            if json.loads(row[3]).get('purged'):raise Conflict('영구 삭제된 기록이에요.')
            if row[0]=='automatic':
                extra=json.loads(row[3]);extra['journal_override']=True
                db.execute('UPDATE records SET extra_json=? WHERE vehicle_id=? AND id=?',(encode(extra),self.vehicle,key))
            db.execute('UPDATE records SET status=?,version=version+1,updated_at=? WHERE vehicle_id=? AND id=?',
                       (status,now(),self.vehicle,key))
            dates=[r[0] for r in db.execute('SELECT day FROM day_parts WHERE vehicle_id=? AND record_id=?',(self.vehicle,key))]
            dates += [r[0] for r in db.execute('SELECT accounting_date FROM expenses WHERE vehicle_id=? AND record_id=?',(self.vehicle,key))]
            wash_id=self.identity('refueling_wash_cost',key)
            wash_status=status if status=='deleted' or (json.loads(row[3]).get('input') or {}).get('wash_cost_krw',0)>0 else 'deleted'
            db.execute("UPDATE records SET status=? WHERE vehicle_id=? AND id=? AND source_fingerprint!='purged'",(wash_status,self.vehicle,wash_id))
            dates += [r[0] for r in db.execute('SELECT accounting_date FROM expenses WHERE vehicle_id=? AND record_id=?',(self.vehicle,wash_id))]
            associated=self.identity('manual_charge_cost',key)
            db.execute("UPDATE records SET status=? WHERE vehicle_id=? AND id=? AND source_fingerprint!='purged'",(status,self.vehicle,associated))
            dates += [r[0] for r in db.execute('SELECT accounting_date FROM expenses WHERE vehicle_id=? AND record_id=?',(self.vehicle,associated))]
            self._dirty(db,dates)
            db.execute('INSERT INTO change_log(vehicle_id,record_id,actor,operation,changed_at) VALUES (?,?,?,?,?)',
                       (self.vehicle,key,'administrator',status,now()))
        self.aggregate()
        return {'id':key,'version':expected+1}
