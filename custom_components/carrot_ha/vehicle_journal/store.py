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
CATEGORIES = {'charging','maintenance','tuning','washing','insurance','tax','parking','toll','other'}
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
            if exists and db.execute('SELECT version FROM journal_schema').fetchall() != [(1,)]:
                raise ValueError('Unsupported journal schema')
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

    @contextmanager
    def connect(self):
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
                    value = dict(date=data['accounting_date'],category='charging',actual_krw=data['actual_cost_krw'],
                                 estimated_krw=data['estimated_cost_krw'])
                    self._record(db,key,'expense','automatic',value,source,
                                 'excluded' if data.get('excluded') else 'active',{'origin':'automatic','cost_source':data['cost_source']})
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
                    db.execute("UPDATE records SET status='deleted' WHERE vehicle_id=? AND id=?",(self.vehicle,key))
                    self._dirty(db,[r[0] for r in db.execute('SELECT day FROM day_parts WHERE vehicle_id=? AND record_id=?',(self.vehicle,key))])
                self._dirty(db,old_days)
            self.aggregate()
            with self.connect() as db:
                db.execute('''INSERT INTO sync_state VALUES (?,?,?,'complete',NULL,?)
                    ON CONFLICT(vehicle_id,source_kind) DO UPDATE SET cursor_json=excluded.cursor_json,
                    phase='complete',last_error=NULL,updated_at=excluded.updated_at''',
                    (self.vehicle,'archive',encode({'generation':generation}),now()))

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
                qualities=[]
                for metrics,quality in parts:
                    metrics=json.loads(metrics);qualities.append(json.loads(quality))
                    for key in METRICS:
                        if key in metrics:
                            sums[key]=(sums[key] or 0)+metrics[key]
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
                         'energy_coverage_percent':coverage,'total_soc':'missing',
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

    def query(self, start, end, limit=100, offset=0, include_trips=True, record_categories=None, expenses_only=False, record_sort='time'):
        a,b=day(start),day(end)
        if b<a or (b-a).days>365 or type(limit) is not int or not 1<=limit<=100 or type(offset) is not int or offset<0:
            raise ValueError('조회 기간과 페이지를 확인해 주세요.')
        if record_sort not in ('time','amount_desc','amount_asc'):raise ValueError('정렬 기준을 확인해 주세요.')
        if type(expenses_only) is not bool or type(include_trips) is not bool or (record_categories is not None and
                (not isinstance(record_categories,list) or any(not isinstance(key,str) or key not in CATEGORIES|{'trip'} for key in record_categories))):
            raise ValueError('기록 필터를 확인해 주세요.')
        record_categories=sorted(set(record_categories or []))
        record_filter=" AND r.kind!='trip'" if not include_trips else ''
        if expenses_only:record_filter=" AND r.kind='expense'"
        time_order='COALESCE(e.accounting_date,m.started_at) DESC,r.id'
        record_order=time_order if record_sort=='time' else 'COALESCE(e.actual_krw,e.estimated_krw) IS NULL,COALESCE(e.actual_krw,e.estimated_krw) '+('DESC' if record_sort=='amount_desc' else 'ASC')+','+time_order
        filter_params=[]
        if record_categories:
            clauses=[]
            for key in record_categories:
                if key=='trip':clauses.append("r.kind='trip'")
                elif key=='charging':clauses.append("(r.kind='charge' OR e.category='charging')")
                else:
                    clauses.append('e.category=?');filter_params.append(key)
            record_filter+=' AND ('+' OR '.join(clauses)+')'
        with self.lock,self.connect() as db:
            db.row_factory=sqlite3.Row
            daily=[dict(row) for row in db.execute('''SELECT * FROM daily_summaries WHERE vehicle_id=?
                AND accounting_timezone=? AND day BETWEEN ? AND ? ORDER BY day''',
                (self.vehicle,self.time_zone,start,end))]
            record_sql='''SELECT r.id,r.kind,r.origin,r.status,r.version,r.quality_json,r.extra_json,
                m.started_at,m.ended_at,m.distance_km,m.drive_energy_kwh,m.battery_charge_kwh,m.billed_charge_kwh,
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
                (self.vehicle,self.time_zone,start,end,5,0))]
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
            total=db.execute('SELECT COUNT(*) FROM records WHERE vehicle_id=? AND status=?',(self.vehicle,'active')).fetchone()[0]
        for row in daily:
            row['cost_categories']=json.loads(row.pop('cost_categories_json'))
            row['quality']=json.loads(row.pop('quality_json'))
        for row in records+recent_records:
            row['input']=json.loads(row.pop('extra_json')).get('input');row['quality']=json.loads(row.pop('quality_json'));row['memo']=row.pop('expense_memo') or row.get('mobility_memo') or '';row.pop('mobility_memo',None)
        totals={key:sum(r[key] for r in daily if r[key] is not None) if any(r[key] is not None for r in daily) else None
                for key in (*METRICS,'charge_actual_krw','charge_estimated_krw','charge_effective_krw','slow_count','fast_count','unknown_count')}
        totals['efficiency_km_kwh']=totals['energy_distance_km']/totals['drive_energy_kwh'] if totals['drive_energy_kwh'] else None
        totals['energy_coverage_percent']=100*totals['energy_distance_km']/totals['distance_km'] if totals['distance_km'] and totals['energy_distance_km'] is not None else None
        cats={}
        for row in daily:
            for category,cost in row['cost_categories'].items():
                target=cats.setdefault(category,{'actual_krw':0,'estimated_krw':0,'effective_krw':0})
                for key in target:target[key]+=cost[key]
        totals['categories']=cats;totals['total_cost_krw']=sum(v['effective_krw'] for v in cats.values())
        return {'daily':daily,'records':records,'recent_records':recent_records,'expense_sort_supported':True,'expense_filters_supported':True,'record_filters_supported':True,'has_more':len(rows)>limit,'totals':totals,
                'timezone':self.time_zone,'status':dict(phase) if phase else {'phase':'pending'},
                'record_count':total,'comparison':dict(setting) if setting else None}

    def save_manual(self, key, expected, payload):
        UUID(key)
        if type(expected) is not int or expected<0 or not isinstance(payload,dict):raise ValueError('잘못된 기록이에요.')
        allowed={'kind','date','ended_date','started_at','ended_at','distance_km','drive_energy_kwh',
                 'battery_charge_kwh','billed_charge_kwh','charge_mode','category','subcategory','actual_krw',
                 'memo','odometer_km','soc_start_percent','soc_end_percent'}
        if set(payload)-allowed:raise ValueError('지원하지 않는 기록 항목이에요.')
        data=dict(payload);kind=data.get('kind')
        if kind not in ('trip','charge','expense'):raise ValueError('기록 종류를 확인해 주세요.')
        value=day(data['date']).isoformat()
        if day(value)>datetime.now(self.tz).date():raise ValueError('미래 날짜는 기록할 수 없어요.')
        if len(data.get('memo',''))>4000 or len(data.get('subcategory',''))>100:raise ValueError('메모가 너무 길어요.')
        for field in METRICS+('odometer_km','soc_start_percent','soc_end_percent'):
            if data.get(field) is not None and (number(data[field]) is None or data[field]>100000000):raise ValueError('측정값을 확인해 주세요.')
        for field in ('soc_start_percent','soc_end_percent'):
            if data.get(field) is not None and data[field]>100:raise ValueError('SOC는 0~100%예요.')
        if data.get('actual_krw') is not None and (type(data['actual_krw']) is not int or not 0<=data['actual_krw']<=1000000000):raise ValueError('금액은 0 이상의 정수로 입력해 주세요.')
        if data.get('charge_mode','unknown') not in ('slow','fast','unknown'):raise ValueError('충전 종류를 확인해 주세요.')
        if kind=='expense' and data.get('category') not in CATEGORIES:raise ValueError('비용 분류를 확인해 주세요.')
        if kind=='trip' and data.get('distance_km') is None:raise ValueError('주행거리를 입력해 주세요.')
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
            serialized=encode(payload)
            if old and expected==0 and old[1]=='manual' and json.loads(old[2]).get('input')==payload:return {'id':key,'version':old[0]}
            if old and (old[1]!='manual' or old[0]!=expected) or not old and expected!=0:raise Conflict('기록이 바뀌었어요. 새로고침해 주세요.')
            quality={'origin':'manual','energy':'manual','soc':'manual'}
            self._record(db,key,kind,'manual',data,quality=quality)
            db.execute('UPDATE records SET extra_json=? WHERE vehicle_id=? AND id=?',(encode({'input':payload}),self.vehicle,key))
            if kind=='expense':self._expense(db,key,data)
            else:
                self._mobility(db,key,data);self._parts(db,key,data,quality)
                if kind=='charge':
                    associated=self.identity('manual_charge_cost',key)
                    db.execute("UPDATE records SET status='deleted' WHERE vehicle_id=? AND id=?",(self.vehicle,associated))
                    old_dates=[r[0] for r in db.execute('SELECT accounting_date FROM expenses WHERE vehicle_id=? AND record_id=?',(self.vehicle,associated))]
                    self._dirty(db,old_dates)
                if kind=='charge' and data.get('actual_krw') is not None:
                    expense_id=self.identity('manual_charge_cost',key)
                    self._record(db,expense_id,'expense','manual',data,quality=quality)
                    self._expense(db,expense_id,dict(data,category='charging'))
                    db.execute('INSERT OR IGNORE INTO expense_members VALUES (?,?,?)',(self.vehicle,expense_id,key))
            db.execute('INSERT INTO change_log(vehicle_id,record_id,actor,operation,after_json,changed_at) VALUES (?,?,?,?,?,?)',
                       (self.vehicle,key,'administrator','save',serialized,now()))
            version=db.execute('SELECT version FROM records WHERE vehicle_id=? AND id=?',(self.vehicle,key)).fetchone()[0]
        self.aggregate()
        return {'id':key,'version':version}

    def change_status(self, key, expected, status):
        if status not in ('active','deleted') or type(expected) is not int or expected<1:raise ValueError('잘못된 상태예요.')
        with self.lock,self.connect() as db:
            row=db.execute('SELECT origin,version FROM records WHERE vehicle_id=? AND id=?',(self.vehicle,key)).fetchone()
            if row!=('manual',expected):raise Conflict('수동 기록만 변경할 수 있어요. 새로고침해 주세요.')
            db.execute('UPDATE records SET status=?,version=version+1,updated_at=? WHERE vehicle_id=? AND id=?',
                       (status,now(),self.vehicle,key))
            dates=[r[0] for r in db.execute('SELECT day FROM day_parts WHERE vehicle_id=? AND record_id=?',(self.vehicle,key))]
            dates += [r[0] for r in db.execute('SELECT accounting_date FROM expenses WHERE vehicle_id=? AND record_id=?',(self.vehicle,key))]
            associated=self.identity('manual_charge_cost',key)
            db.execute('UPDATE records SET status=? WHERE vehicle_id=? AND id=?',(status,self.vehicle,associated))
            dates += [r[0] for r in db.execute('SELECT accounting_date FROM expenses WHERE vehicle_id=? AND record_id=?',(self.vehicle,associated))]
            self._dirty(db,dates)
            db.execute('INSERT INTO change_log(vehicle_id,record_id,actor,operation,changed_at) VALUES (?,?,?,?,?)',
                       (self.vehicle,key,'administrator',status,now()))
        self.aggregate()
        return {'id':key,'version':expected+1}
