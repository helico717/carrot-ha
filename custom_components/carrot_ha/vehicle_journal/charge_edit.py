"""Read-only editing context; immutable charge facts stay separate from corrections."""
from collections import defaultdict


def project_charge_inputs(db, vehicle, records):
    ids=list({r['id'] for r in records if r.get('origin')=='automatic' and r.get('category')=='charging'})
    wanted=set(ids)
    members=defaultdict(list)
    for offset in range(0,len(ids),400):
        batch=ids[offset:offset+400]
        rows=db.execute("""SELECT x.expense_id,m.odometer_km,m.battery_charge_kwh,m.billed_charge_kwh
            FROM expense_members x JOIN mobility m ON m.vehicle_id=x.vehicle_id AND m.record_id=x.charge_id
            JOIN records r ON r.vehicle_id=m.vehicle_id AND r.id=m.record_id
            WHERE x.vehicle_id=? AND x.expense_id IN ("""+','.join('?' for _ in batch)+""" )
            AND r.status='active' ORDER BY m.started_at,m.record_id""",(vehicle,*batch))
        for expense,odo,battery,billed in rows:members[expense].append((odo,battery,billed))
    for record in records:
        if record['id'] not in wanted:continue
        values=members[record['id']]
        def total(index):
            return sum(r[index] for r in values) if values and all(r[index] is not None for r in values) else None
        # A grouped payment uses the last known session odometer, never today's live value.
        odo=next((r[0] for r in reversed(values) if r[0] is not None),None)
        facts={'odometer_km':odo,'battery_charge_kwh':total(1),'billed_charge_kwh':total(2),'session_count':len(values)}
        record['automatic_charge']=facts
        correction=record.get('input') or {}
        for field in ('odometer_km','billed_charge_kwh'):
            record[field]=correction.get(field,facts[field])
        record['battery_charge_kwh']=facts['battery_charge_kwh']
