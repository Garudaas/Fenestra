function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

function toIcsUtcString(dt: Date): string {
  return (
    dt.getUTCFullYear().toString() +
    pad2(dt.getUTCMonth() + 1) +
    pad2(dt.getUTCDate()) +
    'T' +
    pad2(dt.getUTCHours()) +
    pad2(dt.getUTCMinutes()) +
    pad2(dt.getUTCSeconds()) +
    'Z'
  )
}

function escapeIcsText(raw: string): string {
  return raw
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n')
}

export function downloadIcsEvent(params: {
  title: string
  description: string
  location?: string
  startIso: string
  durationMinutes?: number
}): void {
  const start = new Date(params.startIso)
  if (Number.isNaN(start.getTime())) return
  const end = new Date(start.getTime() + (params.durationMinutes || 60) * 60 * 1000)

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Fenestrians Network//Alumni Calendar//EN',
    'BEGIN:VEVENT',
    `UID:fenestrians-${Date.now()}@fenestrians.salmaali.in`,
    `DTSTAMP:${toIcsUtcString(new Date())}`,
    `DTSTART:${toIcsUtcString(start)}`,
    `DTEND:${toIcsUtcString(end)}`,
    `SUMMARY:${escapeIcsText(params.title)}`,
    `DESCRIPTION:${escapeIcsText(params.description)}`,
    ...(params.location ? [`LOCATION:${escapeIcsText(params.location)}`] : []),
    'END:VEVENT',
    'END:VCALENDAR',
  ]

  const blob = new Blob([lines.join('\r\n')], { type: 'text/calendar;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${params.title.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 40)}.ics`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export function buildGoogleCalendarUrl(params: {
  title: string
  description: string
  location?: string
  startIso: string
  durationMinutes?: number
}): string {
  const start = new Date(params.startIso)
  if (Number.isNaN(start.getTime())) {
    return 'https://calendar.google.com/calendar/render?action=TEMPLATE'
  }
  const end = new Date(start.getTime() + (params.durationMinutes || 60) * 60 * 1000)
  const dates = `${toIcsUtcString(start)}/${toIcsUtcString(end)}`

  const url = new URL('https://calendar.google.com/calendar/render')
  url.searchParams.set('action', 'TEMPLATE')
  url.searchParams.set('text', params.title)
  url.searchParams.set('dates', dates)
  url.searchParams.set('details', params.description)
  if (params.location) {
    url.searchParams.set('location', params.location)
  }
  return url.toString()
}
