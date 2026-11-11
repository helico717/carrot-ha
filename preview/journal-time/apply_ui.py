"""Apply the record-time UI changes to a copy of the journal frontend.

Usage: python3 apply_ui.py <dir with carrot-vehicle-journal.js and carrot-journal-design.js>
The preview runs it on copies in this folder; after approval the same script is run on
custom_components/carrot_ha/frontend so the reviewed and shipped code are identical.

What it changes
- Ledger date cell and the recent-records list show the time next to the date when a real
  time is known: the backend's ``occurred_at`` (automatic trips/charges, charge payments
  through their charge session, manual records with an entered time). Records without a known
  time keep showing the date only; a 00:00 placeholder is never shown as a time.
- The record dialog gets an optional "시각" input next to the date. Expenses send it as
  ``time`` ("HH:MM"); manual trips send it as ``started_at``.
"""
import sys
from pathlib import Path

base = Path(sys.argv[1])


def patch(name, edits):
    path = base / name
    text = path.read_text()
    for old, new in edits:
        assert text.count(old) == 1, (name, text.count(old), old[:70])
        text = text.replace(old, new)
    path.write_text(text)


# Module-level helper, placed right after the design import.
HELPER_OLD = "const {journalDesign}=await import(journalModuleURL('./carrot-journal-design.js'));"
HELPER_NEW = HELPER_OLD + r"""
// Time of day a record happened, or '' when unknown. Never invents 00:00 for date-only records.
const recordClock=(r,tz)=>{
  const fmt=v=>{const d=new Date(v);return Number.isNaN(d.getTime())?'':d.toLocaleTimeString('ko-KR',{timeZone:tz||'Asia/Seoul',hour:'2-digit',minute:'2-digit',hour12:false});};
  if(r?.occurred_at)return fmt(r.occurred_at);
  if(/^\d{2}:\d{2}$/.test(r?.input?.time||''))return r.input.time;
  if(r?.input?.started_at)return fmt(r.input.started_at);
  if(r?.origin==='automatic'&&r?.started_at)return fmt(r.started_at);
  return '';
};
// Local accounting day; started_at is UTC, so slicing it shows the previous day for early-morning KST.
const recordDay=(r,tz)=>r?.accounting_date||(r?.started_at?new Date(r.started_at).toLocaleDateString('sv-SE',{timeZone:tz||'Asia/Seoul'}):'');"""

LEDGER_OLD = "return `<tr><td>${esc(r.accounting_date||r.started_at?.slice(0,10))}<small>"
LEDGER_NEW = "const clock=recordClock(r,d.timezone);\n      return `<tr><td>${esc(recordDay(r,d.timezone))}${clock?`<span class=\"ledger-time\">${clock}</span>`:''}<small>"

RECENT_OLD = "<small class=\"recent-date-sub\">${esc(record.accounting_date||'미확인')} · "
RECENT_NEW = "<small class=\"recent-date-sub\">${esc(record.accounting_date||'미확인')}${recordClock(record,this.data?.timezone)?` ${recordClock(record,this.data?.timezone)}`:''} · "

FIELD_OLD = '<label id="dateField">기록 날짜<input name="date" type="date" required></label>'
FIELD_NEW = FIELD_OLD + '<label id="timeField">시각 (선택)<input name="time" type="time" step="60"></label>'

VISIBLE_OLD = "if(mode==='trip'){visible.clear();for(const id of ['dateField','odometerField','recordPhotoField'])visible.add(id);}"
VISIBLE_NEW = "if(mode==='trip'){visible.clear();for(const id of ['dateField','timeField','odometerField','recordPhotoField'])visible.add(id);}"

# Every mode shows the time field; the visibility loop lists every toggled field id.
LOOP_OLD = "for(const id of ['memoField','recordPhotoField','importSourceDetails','categoryField',"
LOOP_NEW = "visible.add('timeField');for(const id of ['timeField','memoField','recordPhotoField','importSourceDetails','categoryField',"

# Prefill on edit: entered time, or the start time of a manual trip that had one.
PREFILL_OLD = "    if(!record){form.elements.kind.value=this.recordMode==='trip'?'trip':'expense';"
PREFILL_NEW = """    form.elements.time.value=record?(/^\\d{2}:\\d{2}$/.test(record.input?.time||'')?record.input.time:record.origin==='manual'&&record.input?.started_at?recordClock({input:{started_at:record.input.started_at}},this.data?.timezone):''):'';
    if(!record){form.elements.kind.value=this.recordMode==='trip'?'trip':'expense';"""

SAVE_OLD = "    if(this.recordMode==='trip'){delete payload.distance_km;delete payload.location;delete payload.memo;}"
SAVE_NEW = """    const clockValue=form.elements.time.value;
    if(clockValue){if(payload.kind==='expense')payload.time=clockValue;else if(payload.kind==='trip')payload.started_at=new Date(`${payload.date}T${clockValue}`).toISOString();}
""" + SAVE_OLD

patch('carrot-vehicle-journal.js', [
    (HELPER_OLD, HELPER_NEW),
    (LEDGER_OLD, LEDGER_NEW),
    (RECENT_OLD, RECENT_NEW),
    (FIELD_OLD, FIELD_NEW),
    (VISIBLE_OLD, VISIBLE_NEW),
    (LOOP_OLD, LOOP_NEW),
    (PREFILL_OLD, PREFILL_NEW),
    (SAVE_OLD, SAVE_NEW),
])

CSS_OLD = "#recordDialog[data-mode=trip] #dateField,#recordDialog[data-mode=trip] #odometerField{grid-column:1 / -1}"
CSS_NEW = CSS_OLD + """
#recordDialog[data-mode] .fields #dateField,#recordDialog[data-mode] .fields #timeField{grid-column:span 3!important}
#recordDialog[data-mode] .fields #timeField{order:2}
#recordDialog[data-mode=trip] .fields #odometerField{grid-column:1 / -1!important}
.ledger-table td:nth-child(1) .ledger-time{margin-left:6px;font-variant-numeric:tabular-nums;color:var(--j-sub);font-weight:600}"""

patch('carrot-journal-design.js', [(CSS_OLD, CSS_NEW)])
print('applied')
