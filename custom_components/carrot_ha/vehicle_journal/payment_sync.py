"""Durable, versioned payment bridge between the two HA-local databases."""
import json
from .store import encode, stamp
from ..charge_costs import PaymentConflict


def reconcile(archive, journal):
    """Recover legacy overrides and replay committed writes before projection."""
    with archive.connect() as db:
        groups={g['event_id']:g['data'] for g in archive._charge_groups(db,journal.device)}
        payment_times=dict(db.execute('SELECT id,updated FROM charge_payments WHERE device=?',(journal.device,)))
    with journal.connect() as db:
        rows=db.execute("SELECT id,source_id,extra_json,updated_at,status FROM records WHERE vehicle_id=? AND origin='automatic' AND kind='expense' AND source_fingerprint!='purged'",(journal.vehicle,)).fetchall()
        for key,source,body,updated,status in rows:
            extra=json.loads(body);group=groups.get(source)
            if not group or extra.get('payment_linked') or not extra.get('journal_override') or status!='active':continue
            local=extra.get('input',{})
            # A later dashboard payment must win over an older journal override.
            if (source not in payment_times or stamp(updated)>stamp(payment_times[source])) and local.get('category')=='charging' and local.get('actual_krw') is not None:
                db.execute('INSERT OR IGNORE INTO payment_outbox VALUES (?,?,?,?,?)',(key,source,encode(group['source_event_ids']),group['payment_version'],local['actual_krw']))
            extra.update(payment_linked=True,payment_source_ids=group['source_event_ids'])
            db.execute('UPDATE records SET extra_json=? WHERE vehicle_id=? AND id=?',(encode(extra),journal.vehicle,key))
        pending=db.execute('SELECT record_id,payment_id,source_ids,expected_version,actual FROM payment_outbox').fetchall()
    for key,payment,ids,expected,actual in pending:
        group=groups.get(payment)
        if group is None:raise PaymentConflict('Linked charge is unavailable; payment remains queued')
        if group['payment_version']==expected:
            if actual is not None or expected:
                archive.set_charge_payment(journal.device,payment,json.loads(ids),expected,actual)
        elif not (group['payment_version']==expected+1 and group['actual_cost_krw']==actual):
            # Another successfully committed edit is newer. Reproject its value.
            pass
        with journal.connect() as db:
            db.execute('DELETE FROM payment_outbox WHERE record_id=? AND expected_version=?',(key,expected))
