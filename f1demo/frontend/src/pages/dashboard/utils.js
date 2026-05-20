export function getCountdown(targetDate) {
  if (!targetDate) return null;
  const diff = new Date(targetDate) - new Date();
  if (diff <= 0) return null;
  return {
    days: Math.floor(diff / 86400000),
    hours: Math.floor((diff / 3600000) % 24),
    mins: Math.floor((diff / 60000) % 60),
    secs: Math.floor((diff / 1000) % 60),
  };
}

export function eventName(event) {
  return event?.EventName || event?.meeting_name || 'Unknown Event';
}

export function eventLocation(event) {
  const location = event?.Location || event?.location;
  const country = event?.Country || event?.country_name;
  return [location, country].filter(Boolean).join(', ');
}

export function eventFirstSessionDate(event) {
  return event?.Session1DateUtc || event?.date_start || null;
}

export function eventLastSessionDate(event) {
  return event?.Session5DateUtc || event?.date_end || event?.EventDate || null;
}

export function eventSessionList(event) {
  if (!event) return [];
  const sessions = [];
  for (let index = 1; index <= 5; index += 1) {
    const name = event[`Session${index}`];
    const date = event[`Session${index}DateUtc`] || event[`Session${index}Date`];
    if (name && date) sessions.push({ name, date });
  }
  return sessions;
}

export function mergeDriverMaps(openF1Drivers, freeRoster) {
  const merged = {};

  freeRoster.forEach((driver) => {
    merged[driver.driver_number] = { ...driver };
  });

  openF1Drivers.forEach((driver) => {
    const current = merged[driver.driver_number] || {};
    merged[driver.driver_number] = {
      ...current,
      ...driver,
      full_name: driver.full_name || current.full_name,
      first_name: driver.first_name || current.first_name,
      last_name: driver.last_name || current.last_name,
      team_name: driver.team_name || current.team_name,
      name_acronym: driver.name_acronym || current.name_acronym,
    };
  });

  return merged;
}

export function driverDisplay(driver, fallback) {
  if (driver?.first_name || driver?.last_name) {
    return `${driver.first_name || ''} ${driver.last_name || ''}`.trim();
  }
  if (driver?.full_name) return driver.full_name;
  return fallback || 'Unknown Driver';
}

export function formatLapTime(seconds) {
  if (!seconds) return '—';
  return `${Math.floor(seconds / 60)}:${(seconds % 60).toFixed(3).padStart(6, '0')}`;
}

export function isSessionInProgress(session) {
  if (!session?.date_start || !session?.date_end) return false;
  const now = Date.now();
  const start = new Date(session.date_start).getTime();
  const end = new Date(session.date_end).getTime();
  return Number.isFinite(start) && Number.isFinite(end) && now >= start && now <= end;
}

export function sessionElapsedLabel(session) {
  if (!isSessionInProgress(session)) return null;
  const elapsedMs = Date.now() - new Date(session.date_start).getTime();
  const totalMinutes = Math.max(Math.floor(elapsedMs / 60000), 0);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return hours > 0 ? `${hours}h ${minutes}m elapsed` : `${minutes}m elapsed`;
}