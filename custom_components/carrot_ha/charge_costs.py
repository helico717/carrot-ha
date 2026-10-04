"""Durable charge summaries and local payment overrides; no cloud writes."""
import copy
import json
import math
from datetime import datetime, timedelta, timezone
from uuid import NAMESPACE_URL, uuid5
from zoneinfo import ZoneInfo


class PaymentConflict(ValueError):
    """The displayed charge or payment changed since it was read."""


def stamp(value):
    result = datetime.fromisoformat(value.replace('Z', '+00:00'))
    if result.tzinfo is None:
        raise ValueError('Timezone required')
    return result.astimezone(timezone.utc)


def identity(device, ids):
    return str(uuid5(NAMESPACE_URL, json.dumps([device, sorted(ids)])))


class ChargeCosts:
    def init_charge_costs(self, db):
        self._charge_revision = 0
        self._charge_totals_cache = {}
        db.execute('''CREATE TABLE IF NOT EXISTS charge_summaries (
            device TEXT, id TEXT, started TEXT, ended TEXT, day TEXT, body TEXT, created TEXT, updated TEXT,
            PRIMARY KEY(device,id))''')
        db.execute('CREATE INDEX IF NOT EXISTS charge_summary_date ON charge_summaries(device,day,started)')
        db.execute('''CREATE TABLE IF NOT EXISTS charge_payments (
            device TEXT, id TEXT, actual INTEGER, version INTEGER NOT NULL,
            created TEXT, updated TEXT, PRIMARY KEY(device,id))''')
        db.execute('''CREATE TABLE IF NOT EXISTS charge_payment_parts (
            device TEXT, event_id TEXT, payment_id TEXT,
            PRIMARY KEY(device,event_id))''')
        db.execute('CREATE INDEX IF NOT EXISTS charge_payment_members ON charge_payment_parts(device,payment_id)')
        db.execute('''CREATE TABLE IF NOT EXISTS charge_exclusions (
            device TEXT, event_id TEXT, excluded INTEGER NOT NULL, updated TEXT,
            PRIMARY KEY(device,event_id))''')
        db.execute('''CREATE TABLE IF NOT EXISTS charge_deletions (
            device TEXT, event_id TEXT, correction TEXT NOT NULL, deleted TEXT NOT NULL,
            PRIMARY KEY(device,event_id))''')
        for (body,) in db.execute("SELECT body FROM events WHERE kind='charge'").fetchall():
            self.capture_charge(db, json.loads(body))

    def is_charge_deleted(self, db, event):
        return event['kind'] == 'charge' and db.execute(
            'SELECT 1 FROM charge_deletions WHERE device=? AND event_id=?',
            (event['device_id'], event['event_id'])).fetchone() is not None

    def delete_charge(self, device, payment_id, ids, expected_version):
        if (not isinstance(ids, list) or not ids or len(ids)>500 or len(set(ids))!=len(ids)
                or any(not isinstance(key,str) for key in ids)
                or type(expected_version) is not int or expected_version<0):
            raise ValueError('Invalid charge deletion')
        with self.connect() as db:
            db.execute('BEGIN IMMEDIATE')
            group=next((e['data'] for e in self._charge_groups(db,device) if e['event_id']==payment_id),None)
            if group is None or sorted(group['source_event_ids'])!=sorted(ids) or group['payment_version']!=expected_version:
                raise PaymentConflict('Charge changed; reload before deleting')
            for key in ids:
                row=db.execute('SELECT day,body FROM charge_summaries WHERE device=? AND id=?',(device,key)).fetchone()
                data=json.loads(row[1])
                correction={k:data[k] for k in ('started_at','ended_at','energy_kwh','duration_s','cost_krw') if k in data}
                correction['day']=row[0]
                db.execute('INSERT INTO charge_deletions VALUES (?,?,?,?)',
                    (device,key,json.dumps(correction),datetime.now(timezone.utc).isoformat()))
                for table,column in [('events','id'),('charge_summaries','id'),('charge_payment_parts','event_id'),('charge_exclusions','event_id')]:
                    db.execute(f'DELETE FROM {table} WHERE device=? AND {column}=?',(device,key))
            db.execute('DELETE FROM charge_payments WHERE device=? AND id=?',(device,payment_id))
        self.invalidate_charge_costs()
        self.revision+=1
        return dict(deleted=True)

    def capture_charge(self, db, event):
        if event['kind'] != 'charge':
            return
        if self.is_charge_deleted(db, event):
            return
        data = event['data']
        try:
            start = stamp(data['started_at'])
            duration = data.get('duration_s') or 0
            if not data.get('ended_at') and not duration:
                return
            end = stamp(data['ended_at']) if data.get('ended_at') else start + timedelta(seconds=duration)
            energy = data.get('energy_kwh')
            if end < start or type(energy) not in (int, float) or not math.isfinite(energy) or energy < 0:
                return
        except (KeyError, ValueError, TypeError, OverflowError):
            return  # Incomplete legacy records are not invented as completed charges.
        fast = bool(duration and energy / (duration / 3600) > 11)
        cost = data.get('cost_krw')
        unit = data.get('unit_price_krw')
        if type(unit) not in (int, float) or not math.isfinite(unit) or unit < 0:
            unit = 320 if fast else 280
        if type(cost) not in (int, float) or not math.isfinite(cost) or cost < 0:
            cost = energy * unit
        summary = {key: data[key] for key in (
            'duration_s', 'energy_kwh', 'start_soc_percent', 'end_soc_percent',
            'soc_charged_percent', 'soc_retroactive_estimated', 'partial') if key in data}
        summary.update(started_at=start.isoformat(), ended_at=end.isoformat(),
                       cost_krw=round(cost), unit_price_krw=unit, accounting_timezone=self.charge_timezone)
        day = start.astimezone(ZoneInfo(self.charge_timezone)).date().isoformat()
        body = json.dumps(summary, sort_keys=True)
        now = datetime.now(timezone.utc).isoformat()
        db.execute('''INSERT INTO charge_summaries VALUES (?,?,?,?,?,?,?,?)
            ON CONFLICT(device,id) DO UPDATE SET started=excluded.started,
            ended=excluded.ended, day=excluded.day, body=excluded.body, updated=excluded.updated
            WHERE charge_summaries.body != excluded.body OR charge_summaries.day != excluded.day''',
            (event['device_id'], event['event_id'], start.isoformat(), end.isoformat(), day, body, now, now))

    def _charge_groups(self, db, device):
        parts = {event: payment for event, payment in db.execute(
            'SELECT event_id,payment_id FROM charge_payment_parts WHERE device=?', (device,))}
        payments = {key: (actual, version, created, updated) for key, actual, version, created, updated in db.execute(
            'SELECT id,actual,version,created,updated FROM charge_payments WHERE device=?', (device,))}
        excluded_ids = {key for key, in db.execute(
            'SELECT event_id FROM charge_exclusions WHERE device=? AND excluded=1', (device,))}
        frozen, automatic = {}, []
        previous_automatic = False
        for key, day, body, created, updated in db.execute('SELECT id,day,body,created,updated FROM charge_summaries WHERE device=? ORDER BY started,id', (device,)):
            item = dict(event_id=key, day=day, data=json.loads(body), created=created, updated=updated)
            if key in parts:
                frozen.setdefault(parts[key], []).append(item)
                previous_automatic = False
            elif previous_automatic and automatic and -60 <= (stamp(item['data']['started_at']) - max(stamp(m['data']['ended_at']) for m in automatic[-1])).total_seconds() <= 900:
                automatic[-1].append(item)
            else:
                automatic.append([item])
            if key not in parts:
                previous_automatic = True
        groups = []
        for members in list(frozen.values()) + automatic:
            ids = [m['event_id'] for m in members]
            key = identity(device, ids)
            actual, version, created, updated = payments.get(key, (None, 0, None, None))
            data = copy.deepcopy(members[0]['data'])
            estimated = sum(m['data']['cost_krw'] for m in members)
            data.update(ended_at=max(m['data']['ended_at'] for m in members),
                        duration_s=sum(m['data'].get('duration_s', 0) or 0 for m in members),
                        energy_kwh=round(sum(m['data']['energy_kwh'] for m in members), 3),
                        source_event_ids=ids, payment_id=key, payment_version=version,
                        currency='KRW', accounting_date=members[0]['day'],
                        excluded=any(key in excluded_ids for key in ids),
                        created_at=created or min(m['created'] for m in members),
                        updated_at=max([m['updated'] for m in members] + ([updated] if updated else [])),
                        estimated_cost_krw=estimated, actual_cost_krw=actual,
                        effective_cost_krw=estimated if actual is None else actual,
                        cost_source='estimated' if actual is None else 'actual',
                        cost_krw=estimated, merged=len(members) > 1, merge_count=len(members),
                        merge_parts=[dict(m['data'], event_id=m['event_id']) for m in members])
            if len(members) > 1:
                if data['energy_kwh'] > 0:
                    data['unit_price_krw'] = estimated / data['energy_kwh']
                last = members[-1]['data']
                measured = all(not m['data'].get('soc_retroactive_estimated') for m in members)
                start_soc, end_soc = data.get('start_soc_percent'), last.get('end_soc_percent')
                if measured and start_soc is not None and end_soc is not None:
                    data.update(end_soc_percent=end_soc, soc_charged_percent=max(0, end_soc-start_soc))
                else:
                    gains = [m['data'].get('soc_charged_percent') for m in members]
                    data.update(start_soc_percent=None, end_soc_percent=None,
                                soc_retroactive_estimated=True,
                                soc_charged_percent=sum(gains) if all(g is not None for g in gains) else None)
            groups.append(dict(schema=1, device_id=device, event_id=key, kind='charge',
                               observed_at=data['ended_at'], data=data))
        return sorted(groups, key=lambda e: (e['data']['started_at'], e['event_id']), reverse=True)

    def charge_history(self, device, limit=100, offset=0, since=None, include_excluded=False):
        if not 1 <= limit <= 500 or offset < 0:
            raise ValueError('Invalid history query')
        boundary = stamp(since) if since else None
        with self.connect() as db:
            rows = self._charge_groups(db, device)
        if not include_excluded:
            rows = [e for e in rows if not e['data']['excluded']]
        if boundary:
            rows = [e for e in rows if stamp(e['data']['started_at']) >= boundary]
        return rows[offset:offset+limit]

    def invalidate_charge_costs(self):
        self._charge_revision += 1
        self._charge_totals_cache.clear()

    def charge_totals(self, device, month):
        key = (device, month, self._charge_revision)
        if key in self._charge_totals_cache:
            return dict(self._charge_totals_cache[key])
        with self.connect() as db:
            groups = self._charge_groups(db, device)
        items = [e['data'] for e in groups if e['data']['accounting_date'].startswith(month+'-')]
        excluded = [d for d in items if d['excluded']]
        with self.connect() as db:
            deleted=[json.loads(body) for body, in db.execute('SELECT correction FROM charge_deletions WHERE device=?',(device,))]
        deleted=[d for d in deleted if d['day'].startswith(month+'-')]
        items = [d for d in items if not d['excluded']]
        actual = sum(d['actual_cost_krw'] for d in items if d['actual_cost_krw'] is not None)
        estimated = sum(d['estimated_cost_krw'] for d in items if d['actual_cost_krw'] is None)
        count = sum(d['actual_cost_krw'] is not None for d in items)
        result = dict(effective_cost_krw=actual+estimated, actual_cost_krw=actual,
                    estimated_cost_krw=estimated, actual_count=count, count=len(items),
                    cost_source='mixed' if 0 < count < len(items) else ('actual' if count else 'estimated'))
        result.update(excluded_count=len(excluded),
                      excluded_estimated_cost_krw=sum(d['estimated_cost_krw'] for d in excluded)+sum(d['cost_krw'] for d in deleted),
                      excluded_slow_kwh=sum(d['energy_kwh'] for d in excluded+deleted if not (d.get('duration_s') and d['energy_kwh'] / (d['duration_s']/3600) > 11)),
                      excluded_fast_kwh=sum(d['energy_kwh'] for d in excluded+deleted if d.get('duration_s') and d['energy_kwh'] / (d['duration_s']/3600) > 11))
        self._charge_totals_cache[key] = result
        return dict(result)

    def set_charge_excluded(self, device, payment_id, ids, expected_version, excluded):
        if type(excluded) is not bool:
            raise ValueError('Invalid exclusion')
        return self.set_charge_payment(device, payment_id, ids, expected_version, None, excluded)

    def set_charge_payment(self, device, payment_id, ids, expected_version, actual, excluded=None):
        if (not isinstance(ids, list) or not ids or len(ids) > 500
                or any(not isinstance(key, str) for key in ids) or len(set(ids)) != len(ids)
                or type(expected_version) is not int or expected_version < 0
                or (excluded is not None and type(excluded) is not bool)
                or (actual is not None and (type(actual) is not int or not 0 <= actual <= 999999999))):
            raise ValueError('Invalid payment')
        now = datetime.now(timezone.utc).isoformat()
        with self.connect() as db:
            db.execute('BEGIN IMMEDIATE')
            group = next((e['data'] for e in self._charge_groups(db, device) if e['event_id'] == payment_id), None)
            if group is None or sorted(group['source_event_ids']) != sorted(ids) or group['payment_version'] != expected_version:
                raise PaymentConflict('Charge changed; reload before saving')
            if excluded is not None:
                actual = group['actual_cost_krw']
                for key in ids:
                    db.execute('''INSERT INTO charge_exclusions VALUES (?,?,?,?)
                        ON CONFLICT(device,event_id) DO UPDATE SET excluded=excluded.excluded, updated=excluded.updated''',
                        (device, key, int(excluded), now))
            if excluded is None and actual is None and not expected_version:
                raise PaymentConflict('No saved payment')
            db.execute('''INSERT INTO charge_payments VALUES (?,?,?,?,?,?)
                ON CONFLICT(device,id) DO UPDATE SET actual=excluded.actual,
                version=excluded.version,updated=excluded.updated''',
                (device, payment_id, actual, expected_version+1, now, now))
            for key in ids:
                db.execute('INSERT OR IGNORE INTO charge_payment_parts VALUES (?,?,?)', (device, key, payment_id))
        self.invalidate_charge_costs()
        if excluded is not None:
            self.revision += 1  # Invalidate shared battery-history calculations.
        return dict(payment_id=payment_id, payment_version=expected_version+1)


async def refresh_runtime_costs(hass, runtime):
    """Refresh local cached totals outside the latency-sensitive live endpoint."""
    month = datetime.now(ZoneInfo(hass.config.time_zone)).strftime('%Y-%m')
    totals = await hass.async_add_executor_job(runtime['archive'].charge_totals,
                                              runtime['entry'].data['device_id'], month)
    runtime['charge_cost_totals'] = dict(totals, month=month)
