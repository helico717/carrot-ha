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

      prev.data = {
        ...prev.data,
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

export function mergeConsecutiveTrips(rawTrips, timeZone, maxGapSeconds = 1800) {
  if (!Array.isArray(rawTrips) || rawTrips.length <= 1) return rawTrips || [];
  const getStart = e => new Date(e.data?.started_at || e.observed_at || 0).getTime();
  const getEnd = e => {
    if (e.data?.ended_at) return new Date(e.data.ended_at).getTime();
    const dur = Number(e.data?.duration_s) || 0;
    return getStart(e) + dur * 1000;
  };

  const sorted = [...rawTrips].sort((a, b) => getStart(a) - getStart(b));
  const merged = [];

  for (const trip of sorted) {
    if (!trip || !trip.data) continue;
    const td = trip.data;
    const startMs = getStart(trip);
    const endMs = getEnd(trip);
    const durS = Number(td.duration_s) || Math.round((endMs - startMs) / 1000);
    const startSoc = td.start_soc_percent != null ? Number(td.start_soc_percent) : null;
    const endSoc = td.end_soc_percent != null ? Number(td.end_soc_percent) : null;

    if (merged.length === 0) {
      merged.push({
        ...trip,
        data: {
          ...td,
          merged: false,
          merge_count: 1,
          started_at: td.started_at || new Date(startMs).toISOString(),
          ended_at: td.ended_at || new Date(endMs).toISOString(),
          duration_s: durS,
          merge_parts: [td]
        }
      });
      continue;
    }

    const prev = merged[merged.length - 1];
    const pd = prev.data;
    const prevEndMs = getEnd(prev);
    const gapS = (startMs - prevEndMs) / 1000;
    const prevEndSoc = pd.end_soc_percent != null ? Number(pd.end_soc_percent) : null;
    const isNoCharging = (startSoc == null || prevEndSoc == null) || (startSoc <= prevEndSoc + 1.0);
    const isSameDay = tripDateKey(startMs, timeZone) === tripDateKey(prevEndMs, timeZone);

    if (gapS >= 0 && gapS <= maxGapSeconds && isNoCharging && isSameDay) {
      pd.merged = true;
      pd.merge_count = (pd.merge_count || 1) + 1;
      pd.ended_at = td.ended_at || new Date(endMs).toISOString();
      pd.duration_s = (pd.duration_s || 0) + durS;
      pd.distance_m = (pd.distance_m || 0) + (Number(td.distance_m) || 0);
      pd.energy_wh = (pd.energy_wh || 0) + (Number(td.energy_wh) || 0);
      if (endSoc != null) pd.end_soc_percent = endSoc;
      if (td.end_battery_wh != null) pd.end_battery_wh = td.end_battery_wh;

      if (pd.distance_m > 0 && pd.energy_wh > 0) {
        pd.efficiency_km_kwh = Math.round((pd.distance_m / 1000) / (pd.energy_wh / 1000) * 10) / 10;
      } else if (td.efficiency_km_kwh != null) {
        pd.efficiency_km_kwh = Math.round(((pd.efficiency_km_kwh || td.efficiency_km_kwh) + td.efficiency_km_kwh) / 2 * 10) / 10;
      }

      pd.route = [...(pd.route || []), ...(td.route || [])];
      pd.merge_parts = [...(pd.merge_parts || []), td];
    } else {
      merged.push({
        ...trip,
        data: {
          ...td,
          merged: false,
          merge_count: 1,
          started_at: td.started_at || new Date(startMs).toISOString(),
          ended_at: td.ended_at || new Date(endMs).toISOString(),
          duration_s: durS,
          merge_parts: [td]
        }
      });
    }
  }

  return merged.sort((a, b) => getStart(b) - getStart(a));
}

