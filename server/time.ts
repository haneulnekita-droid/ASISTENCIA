export interface ServerTimeSnapshot {
  iso: string;
  fecha: string;
  fechaLegible: string;
  hora: string;
  createdAt: string;
  timezone: string;
}

function resolveTimezone(): string {
  const candidate = (process.env.APP_TIMEZONE || 'America/Lima').trim();
  try {
    new Intl.DateTimeFormat('es-PE', { timeZone: candidate }).format(new Date());
    return candidate;
  } catch {
    return 'UTC';
  }
}

export function getServerTimeSnapshot(now: Date = new Date()): ServerTimeSnapshot {
  const timezone = resolveTimezone();

  const dateParts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);

  const timeParts = new Intl.DateTimeFormat('en-GB', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(now);

  const pick = (parts: Intl.DateTimeFormatPart[], type: string): string =>
    parts.find((p) => p.type === type)?.value || '00';

  const year = pick(dateParts, 'year');
  const month = pick(dateParts, 'month');
  const day = pick(dateParts, 'day');

  let hour = pick(timeParts, 'hour');
  if (hour === '24') hour = '00';
  const minute = pick(timeParts, 'minute');
  const second = pick(timeParts, 'second');

  const fecha = `${year}-${month}-${day}`;
  const hora = `${hour}:${minute}:${second}`;
  const createdAt = `${fecha} ${hora}`;

  const fechaLegible = new Intl.DateTimeFormat('es-PE', {
    timeZone: timezone,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(now);

  return {
    iso: now.toISOString(),
    fecha,
    fechaLegible: fechaLegible.charAt(0).toUpperCase() + fechaLegible.slice(1),
    hora,
    createdAt,
    timezone,
  };
}
