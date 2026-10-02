export const DEFAULT_SOC_CAPACITY_KWH = 64.0;
// Use the Home Assistant timezone for both date labels and trip grouping.
export function tripDateKey(value, timeZone) {
  const date = new Date(value);
  if (!value || !Number.isFinite(+date)) return '';
  const parts = new Intl.DateTimeFormat('en-CA', {timeZone, year:'numeric', month:'2-digit', day:'2-digit'}).formatToParts(date);
  return ['year','month','day'].map(type => parts.find(p => p.type === type).value).join('-');
}
export function tripDays(events, timeZone, now = new Date()) {
  const today = tripDateKey(now, timeZone);
  const anchor = new Date(today + 'T12:00:00Z');
  return Array.from({length:7}, (_, i) => {
    const date = new Date(+anchor - (6-i)*86400000);
    const key = date.toISOString().slice(0,10);
    return {
      key,
      date,
      today: i === 6,
      indices: (events || []).flatMap((e, index) => {
        const timeVal = e?.data?.started_at || e?.started_at || e?.observed_at || e?.data?.observed_at;
        return tripDateKey(timeVal, timeZone) === key ? [index] : [];
      })
    };
  });
}
export async function loadRecentTrips(api, id, now = new Date()) {
  // Eight UTC days cover seven calendar days in every HA timezone, including DST.
  const since = encodeURIComponent(new Date(+now-8*86400000).toISOString());
  const events = [];
  for (let offset=0;;offset+=100) {
    const page = await api('GET',`carrot_ha/v1/history/${id}?kind=trip&limit=100&offset=${offset}&since=${since}`);
    events.push(...page.events);
    if (page.events.length < 100) break;
  }
  if (!events.length) {
    const latest = await api('GET',`carrot_ha/v1/history/${id}?kind=trip&limit=1&offset=0`);
    events.push(...latest.events);
  }
  return {events};
}

export function mergeConsecutiveCharges(events, maxGapSeconds = 900) {
  if (!Array.isArray(events) || events.length <= 1) return events || [];
  const getStart = e => new Date(e.data?.started_at || e.observed_at || 0).getTime();
  const getEnd = e => {
    if (e.data?.ended_at) return new Date(e.data.ended_at).getTime();
    const dur = Number(e.data?.duration_s) || 0;
    return getStart(e) + dur * 1000;
  };

  // Sort ascending by start time for merging
  const sorted = [...events].sort((a, b) => getStart(a) - getStart(b));
  const merged = [];

  for (const event of sorted) {
    if (!event || !event.data) continue;
    if (merged.length === 0) {
      merged.push({
        ...event,
        data: {
          ...event.data,
          merge_parts: [{
            started_at: event.data.started_at,
            duration_s: event.data.duration_s,
            energy_kwh: event.data.energy_kwh
          }]
        }
      });
      continue;
    }

    const prev = merged[merged.length - 1];
    const prevEnd = getEnd(prev);
    const currStart = getStart(event);
    const gapSeconds = (currStart - prevEnd) / 1000;

    if (gapSeconds >= -60 && gapSeconds <= maxGapSeconds) {
      const prevDur = Number(prev.data.duration_s) || 0;
      const currDur = Number(event.data.duration_s) || 0;
      const prevKwh = Number(prev.data.energy_kwh) || 0;
      const currKwh = Number(event.data.energy_kwh) || 0;
      const endMs = Math.max(prevEnd, getEnd(event));

      const startSoc = prev.data.start_soc_percent;
      const endSoc = event.data.end_soc_percent;
      const measured = Number.isFinite(startSoc) && Number.isFinite(endSoc)
        && !prev.data.soc_retroactive_estimated && !event.data.soc_retroactive_estimated;
      const gain = measured ? Math.max(0, endSoc - startSoc)
        : (Number.isFinite(prev.data.soc_charged_percent) && Number.isFinite(event.data.soc_charged_percent)
          ? prev.data.soc_charged_percent + event.data.soc_charged_percent : null);
      prev.data = {
        ...prev.data,
        start_soc_percent: measured ? startSoc : null,
        end_soc_percent: measured ? endSoc : null,
        soc_charged_percent: gain == null ? null : Math.round(gain * 10) / 10,
        soc_retroactive_estimated: !measured,
        ended_at: new Date(endMs).toISOString(),
        duration_s: prevDur + currDur,
        energy_kwh: Math.round((prevKwh + currKwh) * 1000) / 1000,
        partial: Boolean(prev.data.partial || event.data.partial),
        merged: true,
        merge_count: (prev.data.merge_count || 1) + 1,
        merge_gap_s: Math.max(0, Math.round(gapSeconds)),
        merge_parts: [
          ...(prev.data.merge_parts || [{
            started_at: prev.data.started_at,
            duration_s: prevDur,
            energy_kwh: prevKwh
          }]),
          {
            started_at: event.data.started_at,
            duration_s: currDur,
            energy_kwh: currKwh
          }
        ]
      };
    } else {
      merged.push({
        ...event,
        data: {
          ...event.data,
          merge_parts: [{
            started_at: event.data.started_at,
            duration_s: event.data.duration_s,
            energy_kwh: event.data.energy_kwh
          }]
        }
      });
    }
  }

  // Preserve original descending order (newest first)
  return merged.sort((a, b) => getStart(b) - getStart(a));
}

// Only energy belonging to this entire trip can represent its efficiency.
export function tripEnergyWh(data) {
  if (data.energy_rejected || data.energy_complete === false) return null;
  if (Number.isFinite(data.energy_wh)) return data.energy_wh;
  if (Number.isFinite(data.energy_kwh)) return data.energy_kwh * 1000;
  return null;
}
export function tripEfficiency(data) {
  const wh = tripEnergyWh(data);
  if (wh != null) return wh > 0 && data.distance_m > 0 ? data.distance_m / wh : null;
  return !data.energy_rejected && data.energy_complete !== false && !data.merged
    && Number.isFinite(data.efficiency_km_kwh) && data.efficiency_km_kwh > 0 ? data.efficiency_km_kwh : null;
}
export function tripEnergyLabel(data, english = false) {
  const energy = tripEnergyWh(data);
  if (energy == null) return english ? 'Efficiency missing' : '전비 기록 누락';
  if (energy < 0) return english ? 'Net regeneration' : '순회생';
  if (energy === 0) return english ? 'No net consumption' : '순소비 없음';
  return english ? 'Efficiency missing' : '전비 기록 누락';
}
export function tripSoc(data, boundary, capacity = DEFAULT_SOC_CAPACITY_KWH) {
  const wh = data[boundary + '_battery_wh'];
  const soc = Number.isFinite(wh) && wh >= 0 && capacity > 0
    ? wh / (capacity * 1000) * 100 : data[boundary + '_soc_percent'];
  return Number.isFinite(soc) && soc >= 0 && soc <= 100 ? soc : null;
}
export function mergeConsecutiveTrips(rawTrips, timeZone, maxGapSeconds = 1800) {
  const start = e => new Date(e.data?.started_at || e.observed_at).getTime();
  const end = e => e.data?.ended_at ? new Date(e.data.ended_at).getTime() : start(e) + (e.data?.duration_s || 0) * 1000;
  const seen = new Set();
  const sorted = (rawTrips || []).filter(e => {
    if (!e?.data || !Number.isFinite(start(e)) || !Number.isFinite(end(e))) return false;
    const id = e.event_id || e.id;
    if (id && seen.has(id)) return false;
    if (id) seen.add(id);
    return true;
  }).sort((a,b) => start(a)-start(b));
  const merged = [];
  for (const event of sorted) {
    const td = event.data, prev = merged.at(-1), pd = prev?.data;
    const gap = prev ? (start(event)-end(prev))/1000 : Infinity;
    // Preserve the existing day boundary and charging discontinuity guard.
    const a = pd?.end_soc_percent, b = td.start_soc_percent;
    const noCharge = !Number.isFinite(a) || !Number.isFinite(b) || b <= a + 1;
    if (!prev || gap < 0 || gap > maxGapSeconds || !noCharge
        || tripDateKey(start(event),timeZone) !== tripDateKey(start(prev),timeZone)) {
      merged.push({...event, data:{...td, merged:false, merge_count:1,
        started_at:td.started_at || new Date(start(event)).toISOString(),
        ended_at:td.ended_at || new Date(end(event)).toISOString(), merge_parts:[td]}});
      continue;
    }
    pd.merged = true;
    pd.merge_parts = [...pd.merge_parts, td];
    pd.merge_count = pd.merge_parts.length;
    pd.ended_at = td.ended_at || new Date(end(event)).toISOString();
    pd.duration_s = pd.merge_parts.reduce((sum,p)=>sum+(p.duration_s || 0),0);
    pd.distance_m = pd.merge_parts.reduce((sum,p)=>sum+(p.distance_m || 0),0);
    // Never substitute an intermediate boundary for a missing outer endpoint.
    pd.end_soc_percent = td.end_soc_percent ?? null;
    pd.end_battery_wh = td.end_battery_wh ?? null;
    pd.soc_used_percent = Number.isFinite(pd.start_soc_percent) && Number.isFinite(pd.end_soc_percent)
      ? Math.round((pd.start_soc_percent-pd.end_soc_percent)*10)/10 : null;
    pd.distance_estimated = pd.merge_parts.some(p=>p.distance_estimated);
    pd.route = pd.merge_parts.flatMap(p=>p.route || []);
    const energies = pd.merge_parts.map(tripEnergyWh);
    pd.energy_complete = energies.every(e=>e != null);
    pd.energy_wh = pd.energy_complete ? energies.reduce((sum,e)=>sum+e,0) : null;
    pd.energy_kwh = pd.energy_wh == null ? null : pd.energy_wh/1000;
    pd.energy_rejected = pd.merge_parts.some(p=>p.energy_rejected);
    const efficiency = tripEfficiency(pd);
    pd.efficiency_km_kwh = efficiency == null ? null : Math.round(efficiency*10)/10;
  }
  return merged.sort((a,b)=>start(b)-start(a));
}

// Position a trip on a local 24-hour clock; driving duration excludes stops.
export function tripTimeline(event, timeZone) {
  const data = event.data || {};
  const start = new Date(data.started_at || event.observed_at);
  const end = new Date(data.ended_at || (+start + (data.duration_s || 0) * 1000));
  const minutes = date => {
    const parts = new Intl.DateTimeFormat('en-GB', {timeZone, hourCycle:'h23', hour:'2-digit', minute:'2-digit', second:'2-digit'}).formatToParts(date);
    const value = type => Number(parts.find(p => p.type === type).value);
    return value('hour') * 60 + value('minute') + value('second') / 60;
  };
  if (!Number.isFinite(+start) || !Number.isFinite(+end)) return {leftPct:0, widthPct:0};
  const startMins = minutes(start);
  const endMins = tripDateKey(end, timeZone) > tripDateKey(start, timeZone) ? 1440 : minutes(end);
  const leftPct = startMins / 1440 * 100;
  return {leftPct, widthPct:Math.min(100 - leftPct, Math.max(0, endMins - startMins) / 1440 * 100)};
}
