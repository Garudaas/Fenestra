const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]

export function getDayOrdinal(day: number): string {
  const mod100 = day % 100
  if (mod100 >= 11 && mod100 <= 13) return `${day}th`
  switch (day % 10) {
    case 1:
      return `${day}st`
    case 2:
      return `${day}nd`
    case 3:
      return `${day}rd`
    default:
      return `${day}th`
  }
}

function isValidCalendarDate(year: number, month: number, day: number): boolean {
  if (year < 1900 || year > 2100) return false
  if (month < 1 || month > 12) return false
  if (day < 1 || day > 31) return false
  const dt = new Date(Date.UTC(year, month - 1, day))
  return (
    dt.getUTCFullYear() === year &&
    dt.getUTCMonth() === month - 1 &&
    dt.getUTCDate() === day
  )
}

function resolveTwoDigitYear(yy: number): number {
  const currentTwoDigitYear = new Date().getFullYear() % 100
  return yy <= currentTwoDigitYear ? 2000 + yy : 1900 + yy
}

/**
 * Formats any YYYY-MM-DD string, ISO timestamp, or Date into "18th November 1979".
 */
export function formatFullDate(value?: string | Date | null, fallback = ''): string {
  if (!value) return fallback

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return fallback
    const d = value.getDate()
    const m = value.getMonth()
    const y = value.getFullYear()
    return `${getDayOrdinal(d)} ${MONTH_NAMES[m]} ${y}`
  }

  const str = String(value).trim()
  if (!str) return fallback

  // Match YYYY-MM-DD at start (avoids timezone day shifts)
  const isoMatch = /^(\d{4})-(\d{2})-(\d{2})/.exec(str)
  if (isoMatch) {
    const y = Number(isoMatch[1])
    const m = Number(isoMatch[2])
    const d = Number(isoMatch[3])
    if (isValidCalendarDate(y, m, d)) {
      return `${getDayOrdinal(d)} ${MONTH_NAMES[m - 1]} ${y}`
    }
  }

  const parsed = parseFlexibleDateInput(str)
  if (parsed) return parsed.display

  const fallbackDate = new Date(str)
  if (!Number.isNaN(fallbackDate.getTime())) {
    return `${getDayOrdinal(fallbackDate.getDate())} ${MONTH_NAMES[fallbackDate.getMonth()]} ${fallbackDate.getFullYear()}`
  }

  return str
}

/**
 * Formats an ISO timestamp into "18th November 1979, 02:53 AM".
 */
export function formatFullDateTime(value?: string | Date | null): string {
  if (!value) return ''
  const dt = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(dt.getTime())) return formatFullDate(value)
  const datePart = `${getDayOrdinal(dt.getDate())} ${MONTH_NAMES[dt.getMonth()]} ${dt.getFullYear()}`
  const timePart = dt.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
  return `${datePart}, ${timePart}`
}

/**
 * Converts YYYY-MM-DD to DD/MM/YYYY for text input editing.
 */
export function formatIsoToTypedDDMMYYYY(iso?: string | null): string {
  if (!iso) return ''
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso).trim())
  if (!m) return String(iso)
  return `${m[3]}/${m[2]}/${m[1]}`
}

/**
 * Parses DD/MM/YYYY, DD/MM/YY, DDMMYYYY, DDMMYY, DD-MM-YYYY, or YYYY-MM-DD
 * into { iso: '1979-11-18', typed: '18/11/1979', display: '18th November 1979' }.
 */
export function parseFlexibleDateInput(
  raw: string
): { iso: string; typed: string; display: string } | null {
  const clean = raw.trim()
  if (!clean) return null

  let day = 0
  let month = 0
  let year = 0

  // 1. ISO YYYY-MM-DD
  const isoMatch = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(clean)
  if (isoMatch) {
    year = Number(isoMatch[1])
    month = Number(isoMatch[2])
    day = Number(isoMatch[3])
  } else if (/^\d{6}$/.test(clean)) {
    // 2. Compact DDMMYY (e.g. 181179)
    day = Number(clean.slice(0, 2))
    month = Number(clean.slice(2, 4))
    year = resolveTwoDigitYear(Number(clean.slice(4, 6)))
  } else if (/^\d{8}$/.test(clean)) {
    // 3. Compact DDMMYYYY (e.g. 18111979)
    day = Number(clean.slice(0, 2))
    month = Number(clean.slice(2, 4))
    year = Number(clean.slice(4, 8))
  } else {
    // 4. Separated DD/MM/YYYY, DD/MM/YY, DD-MM-YYYY, DD.MM.YY
    const sepMatch = /^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2}|\d{4})$/.exec(clean)
    if (!sepMatch) return null
    day = Number(sepMatch[1])
    month = Number(sepMatch[2])
    const rawYear = Number(sepMatch[3])
    year = sepMatch[3].length === 2 ? resolveTwoDigitYear(rawYear) : rawYear
  }

  if (!isValidCalendarDate(year, month, day)) return null

  const dd = String(day).padStart(2, '0')
  const mm = String(month).padStart(2, '0')
  const yyyy = String(year).padStart(4, '0')

  return {
    iso: `${yyyy}-${mm}-${dd}`,
    typed: `${dd}/${mm}/${yyyy}`,
    display: `${getDayOrdinal(day)} ${MONTH_NAMES[month - 1]} ${yyyy}`,
  }
}

export interface CountryDialOption {
  name: string
  code: string
}

export const COUNTRY_CODES: CountryDialOption[] = [
  { name: 'India', code: '+91' },
  { name: 'Saudi Arabia', code: '+966' },
  { name: 'United Arab Emirates', code: '+971' },
  { name: 'United States / Canada', code: '+1' },
  { name: 'United Kingdom', code: '+44' },
  { name: 'Qatar', code: '+974' },
  { name: 'Kuwait', code: '+965' },
  { name: 'Bahrain', code: '+973' },
  { name: 'Oman', code: '+968' },
  { name: 'Singapore', code: '+65' },
  { name: 'Malaysia', code: '+60' },
  { name: 'Australia', code: '+61' },
  { name: 'New Zealand', code: '+64' },
  { name: 'Germany', code: '+49' },
  { name: 'France', code: '+33' },
  { name: 'Italy', code: '+39' },
  { name: 'Spain', code: '+34' },
  { name: 'Netherlands', code: '+31' },
  { name: 'Switzerland', code: '+41' },
  { name: 'Sweden', code: '+46' },
  { name: 'Norway', code: '+47' },
  { name: 'Denmark', code: '+45' },
  { name: 'Ireland', code: '+353' },
  { name: 'Japan', code: '+81' },
  { name: 'South Korea', code: '+82' },
  { name: 'China', code: '+86' },
  { name: 'Hong Kong', code: '+852' },
  { name: 'Thailand', code: '+66' },
  { name: 'Indonesia', code: '+62' },
  { name: 'Philippines', code: '+63' },
  { name: 'Vietnam', code: '+84' },
  { name: 'Sri Lanka', code: '+94' },
  { name: 'Bangladesh', code: '+880' },
  { name: 'Nepal', code: '+977' },
  { name: 'Pakistan', code: '+92' },
  { name: 'Maldives', code: '+960' },
  { name: 'South Africa', code: '+27' },
  { name: 'Nigeria', code: '+234' },
  { name: 'Kenya', code: '+254' },
  { name: 'Egypt', code: '+20' },
  { name: 'Brazil', code: '+55' },
  { name: 'Mexico', code: '+52' },
  { name: 'Argentina', code: '+54' },
  { name: 'Russia', code: '+7' },
  { name: 'Turkey', code: '+90' },
  { name: 'Israel', code: '+972' },
]

const SORTED_DIAL_CODES = [...COUNTRY_CODES]
  .map(c => c.code.replace('+', ''))
  .sort((a, b) => b.length - a.length)

/**
 * Resolves user input in the country box (either country name like "India" or code like "91" / "+91")
 * into a clean "+XX" dial code.
 */
export function resolveCountryCodeInput(raw: string): string {
  const trimmed = raw.trim()
  if (!trimmed) return '+91'

  // Extract "+XX" if chosen from datalist like "India (+91)"
  const parenMatch = /\(\+(\d{1,4})\)/.exec(trimmed)
  if (parenMatch) return `+${parenMatch[1]}`

  // Exact or partial country name match
  const lower = trimmed.toLowerCase()
  const exactCountry = COUNTRY_CODES.find(c => c.name.toLowerCase() === lower)
  if (exactCountry) return exactCountry.code

  const startsWithCountry = COUNTRY_CODES.find(c => c.name.toLowerCase().startsWith(lower))
  if (startsWithCountry && !/^\+?\d+$/.test(trimmed)) return startsWithCountry.code

  // Numeric dial code
  const digits = trimmed.replace(/\D/g, '')
  if (digits) return `+${digits}`

  return '+91'
}

/**
 * Cleans any phone string (e.g. "+91 +91 94426-98934" or "00919442698934")
 * into a single valid dialable E.164 number ("+919442698934").
 */
export function cleanPhoneNumber(
  rawPhone?: string | null,
  preferredCountryCode?: string
): string {
  if (!rawPhone) return ''
  let str = String(rawPhone).trim()
  if (!str) return ''

  // Convert leading 00 to +
  str = str.replace(/^00+/, '+')

  const hasLeadingPlus = str.startsWith('+')
  let digits = str.replace(/\D/g, '')
  if (!digits) return ''

  let ccDigits = preferredCountryCode ? preferredCountryCode.replace(/\D/g, '') : ''

  if (!ccDigits) {
    if (hasLeadingPlus) {
      const matched = SORTED_DIAL_CODES.find(code => digits.startsWith(code))
      ccDigits = matched || '91'
    } else if (digits.length > 10) {
      const matched = SORTED_DIAL_CODES.find(code => digits.startsWith(code))
      ccDigits = matched || '91'
    } else {
      ccDigits = '91'
    }
  }

  // Repeatedly strip duplicate country code prefixes (e.g. +91 +919442698934 -> 9442698934)
  let localDigits = digits
  while (
    ccDigits &&
    localDigits.startsWith(ccDigits) &&
    localDigits.length - ccDigits.length >= 7
  ) {
    localDigits = localDigits.slice(ccDigits.length)
  }

  // Strip trunk leading zero (e.g. 09442698934 -> 9442698934)
  if (localDigits.startsWith('0') && localDigits.length > 7) {
    localDigits = localDigits.replace(/^0+/, '')
  }

  if (!localDigits) return ''
  return `+${ccDigits}${localDigits}`
}

/**
 * Splits a stored phone number into { countryCode: '+91', localNumber: '9442698934' }
 * without ever duplicating the country code.
 */
export function splitPhoneForEditor(rawPhone?: string | null): {
  countryCode: string
  localNumber: string
} {
  const cleaned = cleanPhoneNumber(rawPhone)
  if (!cleaned) return { countryCode: '+91', localNumber: '' }

  const digits = cleaned.replace(/^\+/, '')
  const matched = SORTED_DIAL_CODES.find(
    code => digits.startsWith(code) && digits.length - code.length >= 7
  )

  if (matched) {
    return {
      countryCode: `+${matched}`,
      localNumber: digits.slice(matched.length),
    }
  }

  return {
    countryCode: '+91',
    localNumber: digits,
  }
}
