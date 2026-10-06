"""Project HA-local archive facts into the journal; never fetch remote history."""
from datetime import timedelta
import json
from .store import number, stamp
from .. import trip_repair, archive_codec
from ..charge_costs import is_fast_charge


def snapshot(archive, journal):
    trips=[]; charges=[]
    with archive.connect() as db:
        db.execute('BEGIN')
        generation=(db.execute('SELECT generation FROM journal_outbox WHERE device=?',(journal.device,)).fetchone()
                    if db.execute("SELECT 1 FROM sqlite_master WHERE name='journal_outbox'").fetchone() else None)
        generation=generation[0] if generation else 0
        derived={key:json.loads(body) for key,body in db.execute('SELECT id,body FROM trip_derivations WHERE device=?',(journal.device,))}
        energy={key:(distance,kwh) for key,distance,kwh in db.execute('SELECT id,distance_km,energy_kwh FROM trip_energy WHERE device=?',(journal.device,))}
        rows=db.execute('''SELECT id,json_remove(carrot_unpack(body),'$.data.route','$.data.cloud_raw_trip.route')
            FROM events WHERE device=? AND kind='trip' ORDER BY observed,id''',(journal.device,))
        for source,body in rows:
            event=json.loads(body);data=event['data']
            trip_repair.apply(event,derived.get(source))
            try:
                start=stamp(data['started_at'])
                end=stamp(data['ended_at']) if data.get('ended_at') else start+timedelta(seconds=data.get('duration_s',0))
                if end<start:continue
            except (KeyError,ValueError,TypeError,OverflowError):continue
            distance=number(data.get('distance_m'))
            distance=distance/1000 if distance is not None else None
            kwh=None
            if not data.get('energy_rejected'):
                if data.get('energy_verified_for_summary'):
                    wh=number(data.get('energy_wh'));kwh=wh/1000 if wh is not None else None
                elif source in energy and not data.get('partial'):
                    distance,kwh=energy[source]
                    kwh=number(kwh)
            a,b=data.get('start_soc_percent'),data.get('end_soc_percent')
            valid_soc=number(a) is not None and number(b) is not None and a<=100 and b<=100
            quality={'origin':'automatic','energy':'measured' if kwh is not None else 'missing',
                     'distance':'estimated' if data.get('distance_estimated') else 'measured',
                     'soc':'boundary' if valid_soc else 'missing','partial':bool(data.get('partial'))}
            value=dict(started_at=start.isoformat(),ended_at=end.isoformat(),distance_km=distance,
                       drive_energy_kwh=kwh,drive_soc_used_pp=max(0,a-b) if valid_soc else None,
                       soc_start_percent=a if valid_soc else None,soc_end_percent=b if valid_soc else None)
            trips.append((source,value,quality))
        excluded={key for key, in db.execute('SELECT event_id FROM charge_exclusions WHERE device=? AND excluded=1',(journal.device,))}
        deleted=[key for key, in db.execute('SELECT event_id FROM charge_deletions WHERE device=?',(journal.device,))]
        for source,body in db.execute('SELECT id,body FROM charge_summaries WHERE device=? ORDER BY started,id',(journal.device,)):
            data=json.loads(body)
            mode='fast' if data.get('can_mode')==6 else 'slow' if data.get('can_mode')==4 else (
                ('fast' if is_fast_charge(data) else 'slow') if data.get('duration_s',0)>0 and number(data.get('energy_kwh')) is not None else 'unknown')
            value=dict(started_at=data['started_at'],ended_at=data['ended_at'],battery_charge_kwh=number(data.get('energy_kwh')),
                       charge_mode=mode,charged_soc_pp=number(data.get('soc_charged_percent')) if not data.get('soc_retroactive_estimated') else None)
            quality={'origin':'automatic','charge_mode':'measured' if data.get('can_mode') in (4,6) else 'estimated',
                     'energy':data.get('source','estimated'),'partial':bool(data.get('partial'))}
            charges.append((source,value,quality,'excluded' if source in excluded else 'active'))
        groups=archive._charge_groups(db,journal.device)
    return trips,charges,groups,deleted,generation


def sync(archive, journal, force=False):
    """ACK only after facts AND daily summary are committed. Replay is safe."""
    with journal.lock:
        with archive.connect() as db:
            row=db.execute('SELECT generation,acknowledged FROM journal_outbox WHERE device=?',(journal.device,)).fetchone()
        if not force and row and row[0]==row[1]:return False
        archive._ensure_derivations(journal.device)
        facts=snapshot(archive,journal)
        journal.import_snapshot(*facts)
        # Bypass Archive.connect tracking for queue acknowledgement itself.
        import sqlite3
        with sqlite3.connect(archive.path,timeout=15) as db:
            db.execute('UPDATE journal_outbox SET acknowledged=? WHERE device=? AND generation=?',
                       (facts[-1],journal.device,facts[-1]))
        return True
