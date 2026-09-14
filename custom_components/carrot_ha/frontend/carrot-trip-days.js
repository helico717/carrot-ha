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
    return {key, date, today:i===6, indices:events.flatMap((e,index) => tripDateKey(e.data.started_at || e.observed_at,timeZone) === key ? [index] : [])};
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
