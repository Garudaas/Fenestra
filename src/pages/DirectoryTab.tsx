import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { supabase } from '@/lib/supabase'
import { fetchAllBloodGroups } from '@/lib/fenestriansCore'
import { cleanPhoneNumber, formatFullDateTime, formatFullDate } from '@/lib/formatters'
import { saveOfflineDirectory, loadOfflineDirectory } from '@/lib/offlineCache'
import { exportRowsToCSV, openPrintableReport } from '@/lib/reportExporter'
import { publishArchivedAlert, sendDevicePushNotification } from '@/lib/notificationService'
import {
  fetchCommitteeRolesMap,
  resolveMemberAssociationRole,
  type CommitteeRolesMap,
} from '@/lib/taskAuditService'
import SmartDateInput from '@/components/shared/SmartDateInput'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Video,
  MessageCircle,
  Mail,
  MapPin,
  Search,
  Droplets,
  Briefcase,
  RotateCcw,
  ChevronRight,
  Phone,
  WifiOff,
  FileSpreadsheet,
  Printer,
  Siren,
  Plane,
  Send,
  Trash2,
  Award,
  SlidersHorizontal,
  Navigation,
  X,
  CheckCircle2,
  ExternalLink,
  ZoomIn,
  ZoomOut,
} from 'lucide-react'

interface DirectoryTabProps {
  mode?: 'directory' | 'sos' | 'city_travel'
  onStartDM: (id: number, name: string) => void
  onStartVideoCall: (roomName: string) => void
  onOpenSupportRequests?: () => void
}

interface TravelAlertItem {
  id: number
  user_id: number
  member_name: string
  visiting_city: string
  arrival_date: string
  departure_date: string | null
  note: string | null
}

interface MissingLocationPrompt {
  targetMember: any
  locationType: 'permanent' | 'current'
}

const PLUS_CODE_REGEX = /\b[23456789CFGHJMPQRVWX]{4,8}\+[23456789CFGHJMPQRVWX]{2,3}\b/i
const WA_GROUPS_STORAGE_KEY = 'fenestrians_whatsapp_groups_v1'
const GOOGLE_MAPS_HELP_URL = 'https://support.google.com/maps/answer/144361'
const APP_PROFILE_URL = 'https://fenestrians.salmaali.in/dashboard?tab=profile'
const APP_INSTALL_URL = 'https://fenestrians.salmaali.in/dashboard'

function resolveMapTarget(
  geoValue: string | null | undefined,
  fallbackAddress: string | null | undefined
): string | null {
  const geo = String(geoValue || '').trim()
  if (geo) {
    if (geo.startsWith('http://') || geo.startsWith('https://')) {
      return geo
    }
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(geo)}`
  }
  const addr = String(fallbackAddress || '').trim()
  if (addr && PLUS_CODE_REGEX.test(addr)) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addr)}`
  }
  return null
}

function extractMapQueryFromInput(raw: string): string {
  const trimmed = raw.trim()
  if (!trimmed) return '11.0168,76.9558'
  const qMatch = /[?&](?:q|query|ll|center)=([^&]+)/i.exec(trimmed)
  if (qMatch?.[1]) {
    return decodeURIComponent(qMatch[1])
  }
  const atMatch = /@(-?\d+\.\d+,-?\d+\.\d+)/.exec(trimmed)
  if (atMatch?.[1]) {
    return atMatch[1]
  }
  const isShortLink = /https?:\/\/(maps\.app\.goo\.gl|goo\.gl\/maps)/i.test(trimmed)
  if (isShortLink || /^https?:\/\//i.test(trimmed)) {
    return '11.0168,76.9558'
  }
  return trimmed
}

function isReadableLocationInput(raw: string): { ok: boolean; normalizedQuery: string; error?: string } {
  const trimmed = raw.trim()
  if (!trimmed) {
    return {
      ok: false,
      normalizedQuery: '',
      error: 'Please choose a spot on the map or enter a Google Maps link, coordinates, or Plus Code.',
    }
  }
  const isHttp = trimmed.startsWith('http://') || trimmed.startsWith('https://')
  const hasPlusCode = PLUS_CODE_REGEX.test(trimmed)
  const hasCoords = /^-?\d{1,2}\.\d+\s*,\s*-?\d{1,3}\.\d+$/.test(trimmed)
  const hasPlaceText = trimmed.length >= 6 && /[a-zA-Z]/.test(trimmed)

  if (isHttp || hasPlusCode || hasCoords || hasPlaceText) {
    return { ok: true, normalizedQuery: trimmed }
  }

  return {
    ok: false,
    normalizedQuery: '',
    error:
      'Could not read the link, coordinates, or Plus Code. Paste a Google Maps link, LAT/LONG, full Plus Code, or pick a location on the map.',
  }
}

export default function DirectoryTab({
  mode = 'directory',
  onStartDM,
  onStartVideoCall,
}: DirectoryTabProps) {
  const { user, isAdmin } = useAuth()
  const navigate = useNavigate()
  const [members, setMembers] = useState<any[]>([])
  const [committeeRolesMap, setCommitteeRolesMap] = useState<CommitteeRolesMap>(() => new Map())
  const [offlineInfo, setOfflineInfo] = useState<{ isOffline: boolean; syncedAt: string | null }>({
    isOffline: false,
    syncedAt: null,
  })

  const [searchQuery, setSearchQuery] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const [bloodFilter, setBloodFilter] = useState('')
  const [cityFilter, setCityFilter] = useState('')
  const [professionFilter, setProfessionFilter] = useState('')
  const [bloodOptions, setBloodOptions] = useState<string[]>([])

  const [sosBloodGroup, setSosBloodGroup] = useState('')
  const [sosCity, setSosCity] = useState('')
  const [sosNote, setSosNote] = useState('')
  const [sendingSos, setSendingSos] = useState(false)
  const [sosSentCount, setSosSentCount] = useState<number | null>(null)

  const [travelAlerts, setTravelAlerts] = useState<TravelAlertItem[]>([])
  const [travelCity, setTravelCity] = useState('')
  const [travelArrival, setTravelArrival] = useState('')
  const [travelDeparture, setTravelDeparture] = useState('')
  const [travelNote, setTravelNote] = useState('')
  const [savingTravel, setSavingTravel] = useState(false)

  const [missingPrompt, setMissingPrompt] = useState<MissingLocationPrompt | null>(null)
  const [provideLocationOpen, setProvideLocationOpen] = useState(false)
  const [locationLinkOrPlusCode, setLocationLinkOrPlusCode] = useState('')
  const [pickedCoords, setPickedCoords] = useState<{ lat: number; lng: number } | null>(null)
  const [mapZoom, setMapZoom] = useState<number>(14)
  const [mapSatellite, setMapSatellite] = useState<boolean>(true)
  const [locationError, setLocationError] = useState('')
  const [submittingLocation, setSubmittingLocation] = useState(false)
  const [locationFeedback, setLocationFeedback] = useState('')

  const userIsAdmin = Boolean(isAdmin || user?.is_admin)

  useEffect(() => {
    loadDirectory()
    if (mode === 'city_travel') {
      loadTravelAlerts()
    }
  }, [mode])

  const loadDirectory = async () => {
    try {
      const [usersRes, bgs, rolesMap] = await Promise.all([
        supabase
          .from('alumni')
          .select('*')
          .eq('is_placeholder', false)
          .eq('hide_from_peers', false)
          .neq('full_name', 'System Administrator')
          .order('full_name', { ascending: true }),
        fetchAllBloodGroups(),
        fetchCommitteeRolesMap(),
      ])

      if (usersRes.data && usersRes.data.length > 0) {
        const enrichedMembers = usersRes.data.map((m: any) => {
          const badge = resolveMemberAssociationRole({
            userId: m.id,
            isAdmin: m.is_admin,
            committeeRolesMap: rolesMap,
          })
          return {
            ...m,
            _associationRoleLabel: badge.label,
            _associationRoleKind: badge.kind,
          }
        })

        setMembers(enrichedMembers)
        setCommitteeRolesMap(rolesMap)
        setBloodOptions(bgs)
        setOfflineInfo({ isOffline: false, syncedAt: new Date().toISOString() })
        await saveOfflineDirectory(enrichedMembers)
        return
      }
    } catch {
      // Fallback to offline cache
    }

    const cached = await loadOfflineDirectory()
    if (cached.members.length > 0) {
      setMembers(cached.members)
      const cachedBgs = Array.from(
        new Set(cached.members.map((m: any) => m.blood_group).filter(Boolean))
      ) as string[]
      setBloodOptions(cachedBgs)
      setOfflineInfo({ isOffline: true, syncedAt: cached.syncedAt })
    }
  }

  const loadTravelAlerts = async () => {
    const todayIso = new Date().toISOString().slice(0, 10)
    const { data } = await supabase
      .from('member_travel_alerts')
      .select('*')
      .gte('arrival_date', todayIso)
      .order('arrival_date', { ascending: true })
    if (data) setTravelAlerts(data as TravelAlertItem[])
  }

  const getRoleDisplay = (m: any): { label: string; kind: 'office' | 'admin' | 'member' } => {
    if (committeeRolesMap.size > 0 || !m._associationRoleLabel) {
      return resolveMemberAssociationRole({
        userId: m.id,
        isAdmin: m.is_admin,
        committeeRolesMap,
      })
    }
    return {
      label: m._associationRoleLabel,
      kind: m._associationRoleKind || 'member',
    }
  }

  const professionOptions = useMemo(() => {
    const set = new Set<string>()
    for (const m of members) {
      if (m.current_status && String(m.current_status).trim()) {
        set.add(String(m.current_status).trim())
      }
    }
    return Array.from(set).sort()
  }, [members])

  const filteredMembers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    const cityQ = cityFilter.trim().toLowerCase()

    return members.filter(m => {
      if (bloodFilter && (m.blood_group || '').trim().toLowerCase() !== bloodFilter.toLowerCase()) {
        return false
      }
      if (
        professionFilter &&
        (m.current_status || '').trim().toLowerCase() !== professionFilter.toLowerCase()
      ) {
        return false
      }
      if (cityQ) {
        const addrBlob = `${m.current_address || ''} ${m.permanent_address || ''}`.toLowerCase()
        if (!addrBlob.includes(cityQ)) return false
      }
      if (q) {
        const roleInfo = getRoleDisplay(m)
        const haystack = [
          m.full_name,
          m.class_nickname,
          m.blood_group,
          m.current_status,
          roleInfo.label,
          m.current_address,
          m.permanent_address,
          cleanPhoneNumber(m.contact_number),
          cleanPhoneNumber(m.whatsapp_number),
          m.email,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
        if (!haystack.includes(q)) return false
      }
      return true
    })
  }, [members, searchQuery, bloodFilter, cityFilter, professionFilter, committeeRolesMap])

  const matchingSosDonors = useMemo(() => {
    if (!sosBloodGroup) return []
    const bgLower = sosBloodGroup.trim().toLowerCase()
    const cityLower = sosCity.trim().toLowerCase()

    return members.filter(m => {
      if (m.id === user?.id) return false
      if ((m.blood_group || '').trim().toLowerCase() !== bgLower) return false
      if (cityLower) {
        const addr = `${m.current_address || ''} ${m.permanent_address || ''}`.toLowerCase()
        if (!addr.includes(cityLower)) return false
      }
      return true
    })
  }, [members, sosBloodGroup, sosCity, user?.id])

  const handleDispatchBloodSos = async () => {
    if (!user || !sosBloodGroup) {
      alert('Please select the required Blood Group first.')
      return
    }
    if (matchingSosDonors.length === 0) {
      alert('No matching donors found for that Blood Group / City combination.')
      return
    }

    setSendingSos(true)
    const cityPart = sosCity.trim() ? ` in ${sosCity.trim()}` : ''
    const notePart = sosNote.trim() ? `\nDetails: ${sosNote.trim()}` : ''
    const contactPart = cleanPhoneNumber(user.contact_number)
      ? `\nContact ${user.full_name}: ${cleanPhoneNumber(user.contact_number)}`
      : ''
    const sosMsg = `URGENT BLOOD SOS (${sosBloodGroup}${cityPart}): ${user.full_name} urgently needs ${sosBloodGroup} blood donors.${notePart}${contactPart}`

    for (const donor of matchingSosDonors) {
      await publishArchivedAlert({
        category: 'help_needed',
        shortTitle: `URGENT ${sosBloodGroup} Blood SOS`,
        fullMessage: sosMsg,
        targetUserId: donor.id,
        needsHelpFlag: true,
      })
    }

    sendDevicePushNotification({
      shortTitle: `URGENT ${sosBloodGroup} Blood SOS`,
      fullMessage: sosMsg,
      targetUserIds: matchingSosDonors.map(d => d.id),
      launchUrl: 'https://fenestrians.salmaali.in/notifications',
    })

    setSendingSos(false)
    setSosSentCount(matchingSosDonors.length)
  }

  const handleBroadcastTravelAlert = async () => {
    if (!user) return
    if (!travelCity.trim() || !travelArrival) {
      alert('Please enter the Visiting City and Arrival Date.')
      return
    }

    setSavingTravel(true)
    const { error } = await supabase.from('member_travel_alerts').insert([
      {
        user_id: user.id,
        member_name: user.full_name,
        visiting_city: travelCity.trim(),
        arrival_date: travelArrival,
        departure_date: travelDeparture || null,
        note: travelNote.trim() || null,
      },
    ])

    if (!error) {
      const cityLower = travelCity.trim().toLowerCase()
      const localBatchmates = members.filter(m => {
        if (m.id === user.id) return false
        const addr = `${m.current_address || ''} ${m.permanent_address || ''}`.toLowerCase()
        return addr.includes(cityLower)
      })

      const dateRange = travelDeparture
        ? `${formatFullDate(travelArrival)} to ${formatFullDate(travelDeparture)}`
        : formatFullDate(travelArrival)
      const noteText = travelNote.trim() ? ` — "${travelNote.trim()}"` : ''
      const alertText = `I'm In Town! ${user.full_name} is visiting ${travelCity.trim()} (${dateRange})${noteText}`

      if (localBatchmates.length > 0) {
        for (const bm of localBatchmates) {
          await publishArchivedAlert({
            category: 'event',
            shortTitle: `I'm In Town: ${user.full_name}`,
            fullMessage: alertText,
            targetUserId: bm.id,
          })
        }
      } else {
        await publishArchivedAlert({
          category: 'event',
          shortTitle: `I'm In Town: ${user.full_name}`,
          fullMessage: alertText,
        })
      }

      try {
        await navigator.clipboard.writeText(alertText)
      } catch {
        // Ignore
      }
      try {
        const waRaw = localStorage.getItem(WA_GROUPS_STORAGE_KEY)
        const waObj = waRaw ? JSON.parse(waRaw) : null
        if (waObj?.mainGroupUrlOrId && String(waObj.mainGroupUrlOrId).startsWith('http')) {
          window.open(waObj.mainGroupUrlOrId, '_blank', 'noopener,noreferrer')
        }
      } catch {
        // Ignore
      }
    }

    setSavingTravel(false)
    if (error) {
      alert('Could not post travel alert: ' + error.message)
      return
    }

    setTravelCity('')
    setTravelArrival('')
    setTravelDeparture('')
    setTravelNote('')
    await loadTravelAlerts()
  }

  const handleDeleteTravelAlert = async (id: number) => {
    await supabase.from('member_travel_alerts').delete().eq('id', id)
    await loadTravelAlerts()
  }

  const handleOpenMemberLocation = (member: any, locationType: 'permanent' | 'current') => {
    const geoVal =
      locationType === 'permanent' ? member.permanent_geo_location : member.current_geo_location
    const addrVal =
      locationType === 'permanent' ? member.permanent_address : member.current_address

    const resolvedUrl = resolveMapTarget(geoVal, addrVal)
    if (resolvedUrl) {
      window.open(resolvedUrl, '_blank', 'noopener,noreferrer')
      return
    }

    setMissingPrompt({ targetMember: member, locationType })
    setProvideLocationOpen(false)
    setLocationLinkOrPlusCode('')
    setPickedCoords(null)
    setMapZoom(14)
    setMapSatellite(true)
    setLocationError('')
  }

  const handleAskMemberForLocation = async () => {
    if (!user || !missingPrompt) return
    const { targetMember, locationType } = missingPrompt
    const locLabel = locationType === 'permanent' ? 'Permanent Location' : 'Current Location'

    const isInstalledPwa =
      window.matchMedia?.('(display-mode: standalone)')?.matches ||
      Boolean((window.navigator as any)?.standalone)

    const guidanceLines = [
      `Hi ${targetMember.full_name}, ${user.full_name} requested your ${locLabel} (Google Maps link or Plus Code) for the Fenestrians directory.`,
      '',
      `Direct App Link: ${APP_PROFILE_URL}`,
      'How to submit in the app:',
      '1. Open the link above (opens directly in the Fenestrians app if installed, or in your browser).',
      '2. Go to My Profile -> Edit Profile -> Addresses.',
      `3. Paste your ${locLabel} link/Plus Code or pick on the map and tap Submit Addresses.`,
      !isInstalledPwa
        ? `App not installed yet? Open ${APP_INSTALL_URL} in your browser and tap "Install App / Add to Home Screen" to install the webapp.`
        : '',
    ]
      .filter(Boolean)
      .join('\n')

    await supabase.from('member_tasks').insert([
      {
        assigned_to_user_id: targetMember.id,
        assigned_by_user_id: user.id,
        task_type: 'member_assigned_task',
        field_key: locationType === 'permanent' ? 'permanent_geo_location' : 'current_geo_location',
        title: `Provide ${locLabel}`,
        description: guidanceLines,
        status: 'pending',
        sender_display_name: user.full_name,
      },
    ])

    await publishArchivedAlert({
      category: 'personal_task',
      shortTitle: `${locLabel} Requested`,
      fullMessage: guidanceLines,
      targetUserId: targetMember.id,
    })

    const waDigits = cleanPhoneNumber(targetMember.whatsapp_number || targetMember.contact_number).replace(/\D/g, '')
    if (waDigits) {
      window.open(
        `https://wa.me/${waDigits}?text=${encodeURIComponent(guidanceLines)}`,
        '_blank',
        'noopener,noreferrer'
      )
    }

    setLocationFeedback(
      `Sent WhatsApp guidance & created a task for ${targetMember.full_name} to share their ${locLabel}.`
    )
    setMissingPrompt(null)
    setProvideLocationOpen(false)
  }

  const handleSubmitProvidedLocation = async () => {
    if (!user || !missingPrompt) return
    const { targetMember, locationType } = missingPrompt
    const locLabel = locationType === 'permanent' ? 'Permanent Location' : 'Current Location'

    const rawCandidate =
      locationLinkOrPlusCode.trim() ||
      (pickedCoords ? `${pickedCoords.lat.toFixed(6)},${pickedCoords.lng.toFixed(6)}` : '')

    const check = isReadableLocationInput(rawCandidate)
    if (!check.ok) {
      setLocationError(check.error || 'Unreadable location input.')
      return
    }

    const mapLink =
      check.normalizedQuery.startsWith('http://') || check.normalizedQuery.startsWith('https://')
        ? check.normalizedQuery
        : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(check.normalizedQuery)}`

    const proposalPayload = JSON.stringify({
      type: 'location_suggestion',
      location_type: locationType,
      suggested_value: check.normalizedQuery,
      map_link: mapLink,
      suggested_by_id: user.id,
      suggested_by_name: user.full_name,
    })

    const isInstalledPwa =
      window.matchMedia?.('(display-mode: standalone)')?.matches ||
      Boolean((window.navigator as any)?.standalone)

    const guidanceText =
      `${user.full_name} has provided your ${locLabel} (${check.normalizedQuery}) to be updated in the app. Shall this be accepted?\n` +
      `Map Link: ${mapLink}\n` +
      `App Link: https://fenestrians.salmaali.in/notifications\n\n` +
      `How to review:\n` +
      `1. Open Notifications or Tasks in the Fenestrians app (or tap the Map Link above to verify).\n` +
      `2. To ACCEPT: open My Profile -> Addresses and save ${check.normalizedQuery}.\n` +
      `3. To CORRECT: enter your preferred link/Plus Code in My Profile -> Addresses.\n` +
      `4. To DECLINE: mark the task completed without updating your address.\n` +
      (!isInstalledPwa
        ? `If the app is not installed on your device, open ${APP_INSTALL_URL} in your browser and install the webapp.`
        : '')

    setSubmittingLocation(true)
    await supabase.from('member_tasks').insert([
      {
        assigned_to_user_id: targetMember.id,
        assigned_by_user_id: user.id,
        task_type: 'member_assigned_task',
        field_key: locationType === 'permanent' ? 'permanent_geo_location' : 'current_geo_location',
        title: `Review ${locLabel} Suggested by ${user.full_name}`,
        description: `${guidanceText}\n\n[SUGGESTION_DATA]: ${proposalPayload}`,
        status: 'pending',
        sender_display_name: user.full_name,
      },
    ])

    await publishArchivedAlert({
      category: 'personal_task',
      shortTitle: `${locLabel} Suggested by ${user.full_name}`,
      fullMessage: guidanceText,
      targetUserId: targetMember.id,
    })

    const waDigits = cleanPhoneNumber(targetMember.whatsapp_number || targetMember.contact_number).replace(/\D/g, '')
    const waMessage =
      `Hi ${targetMember.full_name}, ${user.full_name} has provided your ${locLabel} (${check.normalizedQuery}) to be updated in the app. Shall this be accepted?\n` +
      `Review Map Link: ${mapLink}\n` +
      `Open App Notifications: https://fenestrians.salmaali.in/notifications\n` +
      `Steps: Open the app's Notification or Task page -> verify the pin -> Accept by saving in My Profile -> Addresses, Correct with your own link/Plus Code, or Decline.\n` +
      (!isInstalledPwa ? `Install WebApp: ${APP_INSTALL_URL}` : '')

    if (waDigits) {
      window.open(
        `https://wa.me/${waDigits}?text=${encodeURIComponent(waMessage)}`,
        '_blank',
        'noopener,noreferrer'
      )
    }

    setSubmittingLocation(false)
    setLocationFeedback(
      `Location sent via app alert and WhatsApp to ${targetMember.full_name} for review (${locLabel}).`
    )
    setMissingPrompt(null)
    setProvideLocationOpen(false)
    setLocationLinkOrPlusCode('')
    setPickedCoords(null)
  }

  const applyCoordinateFromPoint = (clientX: number, clientY: number, rect: DOMRect) => {
    if (rect.width <= 0 || rect.height <= 0) return
    const relX = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width))
    const relY = Math.min(1, Math.max(0, (clientY - rect.top) / rect.height))
    const lat = 8.0883 + (1 - relY) * (28.6139 - 8.0883)
    const lng = 76.9558 + relX * (88.3639 - 76.9558)
    const formatted = `${lat.toFixed(6)},${lng.toFixed(6)}`
    setPickedCoords({ lat, lng })
    setLocationLinkOrPlusCode(formatted)
    setLocationError('')
  }

  const activeMapQuery = useMemo(() => {
    if (pickedCoords) {
      return `${pickedCoords.lat.toFixed(6)},${pickedCoords.lng.toFixed(6)}`
    }
    if (locationLinkOrPlusCode.trim()) {
      return extractMapQueryFromInput(locationLinkOrPlusCode)
    }
    return '11.0168,76.9558'
  }, [locationLinkOrPlusCode, pickedCoords])

  const googleEmbedSrc = useMemo(() => {
    const mapTypeParam = mapSatellite ? '&t=k' : '&t=m'
    return `https://maps.google.com/maps?q=${encodeURIComponent(activeMapQuery)}&z=${mapZoom}${mapTypeParam}&output=embed`
  }, [activeMapQuery, mapZoom, mapSatellite])

  const hasActiveFilters = Boolean(searchQuery || bloodFilter || cityFilter || professionFilter)

  const clearFilters = () => {
    setSearchQuery('')
    setBloodFilter('')
    setCityFilter('')
    setProfessionFilter('')
  }

  const buildReportRows = () => {
    const headers = [
      'Full Name',
      'Association Role',
      'Nickname',
      'Blood Group',
      'Contact Number',
      'WhatsApp Number',
      'Email',
      'Profession / Status',
      'Current Address',
    ]
    const rows = filteredMembers.map(m => [
      m.full_name,
      getRoleDisplay(m).label,
      m.class_nickname || '-',
      m.blood_group || '-',
      cleanPhoneNumber(m.contact_number) || '-',
      cleanPhoneNumber(m.whatsapp_number) || '-',
      m.email || '-',
      m.current_status || '-',
      m.current_address || '-',
    ])
    return { headers, rows }
  }

  const handleExportCsv = () => {
    const { headers, rows } = buildReportRows()
    exportRowsToCSV(
      `Fenestrians_Directory_${new Date().toISOString().slice(0, 10)}.csv`,
      headers,
      rows
    )
  }

  const handlePrintReport = () => {
    const { headers, rows } = buildReportRows()
    openPrintableReport(
      'Member & Emergency Donor Directory',
      `Total Listed: ${filteredMembers.length} member(s)`,
      headers,
      rows
    )
  }

  if (!user) return null

  if (mode === 'sos') {
    return (
      <div className="mx-auto max-w-5xl space-y-3">
        <Card className="border-red-500/50 bg-red-950/20 backdrop-blur-sm">
          <CardContent className="p-4 space-y-3 text-xs">
            <div className="flex items-center justify-between">
              <p className="flex items-center gap-1.5 text-sm font-bold text-red-300">
                <Siren className="h-4 w-4" />
                One-Tap Emergency Blood Donor SOS
              </p>
              <span className="text-[11px] text-muted-foreground">
                Alerts only matching donors
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <select
                value={sosBloodGroup}
                onChange={e => {
                  setSosBloodGroup(e.target.value)
                  setSosSentCount(null)
                }}
                className="h-9 rounded-md border border-red-500/40 bg-background px-3 text-xs font-bold"
              >
                <option value="">Select Required Blood Group *</option>
                {bloodOptions.map(bg => (
                  <option key={bg} value={bg}>
                    {bg}
                  </option>
                ))}
              </select>

              <Input
                value={sosCity}
                onChange={e => {
                  setSosCity(e.target.value)
                  setSosSentCount(null)
                }}
                placeholder="City / Hospital Location (Optional)"
                className="h-9 text-xs"
              />

              <Input
                value={sosNote}
                onChange={e => setSosNote(e.target.value)}
                placeholder="Units / Hospital / Patient Note..."
                className="h-9 text-xs"
              />
            </div>

            {sosBloodGroup && (
              <div className="space-y-2 rounded-lg border border-border/40 bg-background/70 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-bold text-foreground">
                    Matching {sosBloodGroup} Donors Found:{' '}
                    <span className="text-red-400">{matchingSosDonors.length}</span>
                  </span>

                  {matchingSosDonors.length > 0 && (
                    <Button
                      type="button"
                      size="sm"
                      disabled={sendingSos}
                      onClick={handleDispatchBloodSos}
                      className="bg-red-600 hover:bg-red-500 text-white font-bold gap-1.5 text-xs"
                    >
                      <Send className="h-3.5 w-3.5" />
                      {sendingSos
                        ? 'Sending SOS...'
                        : `Send Instant Push & WhatsApp SOS to ${matchingSosDonors.length} Donor(s)`}
                    </Button>
                  )}
                </div>

                {sosSentCount !== null && (
                  <p className="text-emerald-400 font-semibold">
                    High-priority SOS alert sent to {sosSentCount} matching donor(s)!
                  </p>
                )}

                <div className="grid gap-1.5 sm:grid-cols-2 pt-1">
                  {matchingSosDonors.map(donor => {
                    const ph = cleanPhoneNumber(donor.contact_number)
                    const wa = cleanPhoneNumber(donor.whatsapp_number).replace(/\D/g, '')
                    const waText = encodeURIComponent(
                      `URGENT BLOOD SOS (${sosBloodGroup}): Hi ${donor.full_name}, ${user.full_name} urgently needs ${sosBloodGroup} blood${
                        sosCity ? ` in ${sosCity}` : ''
                      }. ${sosNote}`
                    )
                    return (
                      <div
                        key={donor.id}
                        className="flex items-center justify-between gap-2 rounded border border-border/30 bg-muted/20 px-2.5 py-1.5"
                      >
                        <div className="min-w-0">
                          <p className="font-bold text-foreground truncate">{donor.full_name}</p>
                          <p className="text-[10px] text-muted-foreground truncate">
                            {donor.current_address || 'City not set'}
                          </p>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          {ph && (
                            <a
                              href={`tel:${ph}`}
                              className="rounded bg-primary/15 px-2 py-1 text-[10px] font-bold text-primary hover:bg-primary/25"
                            >
                              Call
                            </a>
                          )}
                          {wa && (
                            <a
                              href={`https://wa.me/${wa}?text=${waText}`}
                              target="_blank"
                              rel="noreferrer"
                              className="rounded bg-emerald-600 px-2 py-1 text-[10px] font-bold text-white hover:bg-emerald-500"
                            >
                              WhatsApp
                            </a>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    )
  }

  if (mode === 'city_travel') {
    return (
      <div className="mx-auto max-w-5xl space-y-4">
        {locationFeedback && (
          <div className="flex items-center justify-between gap-2 rounded-xl border border-emerald-500/40 bg-emerald-500/15 px-4 py-3 text-xs font-semibold text-emerald-300">
            <span className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              {locationFeedback}
            </span>
            <button type="button" onClick={() => setLocationFeedback('')}>
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        <Card className="border-primary/40 bg-card/85 backdrop-blur-sm">
          <CardContent className="p-4 space-y-4 text-xs">
            <div className="rounded-xl border border-primary/30 bg-primary/5 p-3.5 space-y-2.5">
              <p className="flex items-center gap-1.5 font-bold text-primary text-sm">
                <Plane className="h-4 w-4" />
                Broadcast “I’m In Town” Travel Alert
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <Input
                  value={travelCity}
                  onChange={e => setTravelCity(e.target.value)}
                  placeholder="Visiting City (e.g., Chennai, Dubai) *"
                  className="text-xs"
                />
                <SmartDateInput
                  value={travelArrival}
                  onChange={setTravelArrival}
                  placeholder="Arrival Date *"
                />
                <SmartDateInput
                  value={travelDeparture}
                  onChange={setTravelDeparture}
                  placeholder="Departure Date (Optional)"
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <Input
                  value={travelNote}
                  onChange={e => setTravelNote(e.target.value)}
                  placeholder="Optional meetup note (e.g., Free for dinner near T. Nagar)..."
                  className="flex-1 min-w-[200px] text-xs"
                />
                <Button
                  type="button"
                  size="sm"
                  disabled={savingTravel}
                  onClick={handleBroadcastTravelAlert}
                  className="gold-gradient text-gold-foreground font-semibold gap-1.5"
                >
                  <Send className="h-3.5 w-3.5" />
                  {savingTravel ? 'Alerting...' : 'Alert classmates in city'}
                </Button>
              </div>

              {travelAlerts.length > 0 && (
                <div className="space-y-1.5 pt-2 border-t border-border/30">
                  <p className="font-semibold text-foreground">Upcoming Batch Visits:</p>
                  {travelAlerts.map(tr => (
                    <div
                      key={tr.id}
                      className="flex items-center justify-between gap-2 rounded-lg border border-border/30 bg-background/70 px-3 py-2"
                    >
                      <div>
                        <span className="font-bold text-primary">{tr.member_name}</span> is visiting{' '}
                        <strong className="text-foreground">{tr.visiting_city}</strong> on{' '}
                        <span className="text-emerald-400 font-semibold">
                          {formatFullDate(tr.arrival_date)}
                          {tr.departure_date ? ` – ${formatFullDate(tr.departure_date)}` : ''}
                        </span>
                        {tr.note && <span className="text-muted-foreground"> • {tr.note}</span>}
                      </div>
                      {(tr.user_id === user.id || userIsAdmin) && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteTravelAlert(tr.id)}
                          className="h-6 w-6 text-destructive"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <p className="font-bold text-primary text-sm">
                Member Locations ({members.length})
              </p>

              <div className="space-y-2">
                {members.map(m => (
                  <div
                    key={m.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border/40 bg-muted/15 px-3.5 py-2.5"
                  >
                    <span className="text-xs font-bold text-foreground">{m.full_name}</span>

                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => handleOpenMemberLocation(m, 'permanent')}
                        className="h-7 text-[11px] gap-1 border-primary/40 text-primary hover:bg-primary/10"
                      >
                        <MapPin className="h-3 w-3" />
                        Permanent Location
                      </Button>

                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => handleOpenMemberLocation(m, 'current')}
                        className="h-7 text-[11px] gap-1 border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/10"
                      >
                        <Navigation className="h-3 w-3" />
                        Current Location
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {missingPrompt && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
            <Card className="w-full max-w-xl border-primary/40 bg-card shadow-2xl max-h-[90vh] overflow-y-auto">
              <CardContent className="p-4 space-y-3.5 text-xs">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-bold text-primary">
                    Location Not Provided
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setMissingPrompt(null)
                      setProvideLocationOpen(false)
                    }}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <p className="text-foreground leading-relaxed">
                  <strong>{missingPrompt.targetMember.full_name}</strong> has not provided this detail (
                  {missingPrompt.locationType === 'permanent' ? 'Permanent Location' : 'Current Location'}).
                </p>

                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleAskMemberForLocation}
                    className="gold-gradient text-gold-foreground font-semibold text-xs"
                  >
                    Ask for location
                  </Button>

                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setProvideLocationOpen(prev => !prev)}
                    className="border-primary/40 text-primary font-semibold text-xs"
                  >
                    I can provide the location
                  </Button>

                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setMissingPrompt(null)
                      setProvideLocationOpen(false)
                    }}
                    className="text-xs"
                  >
                    Close
                  </Button>
                </div>

                {provideLocationOpen && (
                  <div className="rounded-xl border border-primary/35 bg-primary/5 p-3 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-semibold text-primary">
                        Tap on the map to pick coordinates or paste link / Plus Code:
                      </p>
                      <a
                        href={GOOGLE_MAPS_HELP_URL}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-[11px] font-semibold text-sky-400 hover:underline"
                      >
                        Google Maps Help (Coordinates / Links / Plus Codes)
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <Button
                          type="button"
                          size="sm"
                          variant={mapSatellite ? 'default' : 'outline'}
                          onClick={() => setMapSatellite(true)}
                          className="h-7 text-[11px]"
                        >
                          Satellite
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant={!mapSatellite ? 'default' : 'outline'}
                          onClick={() => setMapSatellite(false)}
                          className="h-7 text-[11px]"
                        >
                          Map
                        </Button>
                      </div>

                      <div className="flex items-center gap-1">
                        <Button
                          type="button"
                          size="icon"
                          variant="outline"
                          onClick={() => setMapZoom(z => Math.max(4, z - 2))}
                          className="h-7 w-7"
                          title="Zoom Out"
                        >
                          <ZoomOut className="h-3.5 w-3.5" />
                        </Button>
                        <span className="px-1.5 text-[11px] font-mono">z:{mapZoom}</span>
                        <Button
                          type="button"
                          size="icon"
                          variant="outline"
                          onClick={() => setMapZoom(z => Math.min(20, z + 2))}
                          className="h-7 w-7"
                          title="Zoom In"
                        >
                          <ZoomIn className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>

                    <div
                      onClick={e =>
                        applyCoordinateFromPoint(
                          e.clientX,
                          e.clientY,
                          e.currentTarget.getBoundingClientRect()
                        )
                      }
                      onTouchEnd={e => {
                        const touch = e.changedTouches?.[0]
                        if (touch) {
                          applyCoordinateFromPoint(
                            touch.clientX,
                            touch.clientY,
                            e.currentTarget.getBoundingClientRect()
                          )
                        }
                      }}
                      className="relative h-36 w-full cursor-crosshair rounded-lg border border-dashed border-primary/50 bg-gradient-to-br from-emerald-950/60 via-slate-900 to-sky-950/60 overflow-hidden select-none"
                      title="Click anywhere on this grid to pick coordinates directly"
                    >
                      <div className="absolute inset-0 opacity-25 bg-[linear-gradient(to_right,#94a3b8_1px,transparent_1px),linear-gradient(to_bottom,#94a3b8_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none" />
                      <span className="absolute left-2 top-2 rounded bg-background/85 px-2 py-0.5 text-[10px] text-primary font-semibold pointer-events-none">
                        Tap on map to pick coordinates
                      </span>
                      {pickedCoords && (
                        <div
                          style={{
                            left: `${Math.min(
                              95,
                              Math.max(5, ((pickedCoords.lng - 76.9558) / (88.3639 - 76.9558)) * 100)
                            )}%`,
                            top: `${Math.min(
                              92,
                              Math.max(8, (1 - (pickedCoords.lat - 8.0883) / (28.6139 - 8.0883)) * 100)
                            )}%`,
                          }}
                          className="absolute -translate-x-1/2 -translate-y-full flex flex-col items-center pointer-events-none"
                        >
                          <MapPin className="h-6 w-6 text-red-500 drop-shadow" />
                          <span className="rounded bg-black/80 px-1.5 py-0.5 text-[9px] font-mono text-white">
                            {pickedCoords.lat.toFixed(4)}, {pickedCoords.lng.toFixed(4)}
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="relative h-48 w-full overflow-auto rounded-lg border border-primary/40 bg-background">
                      <iframe
                        title="Google Map Location Preview"
                        src={googleEmbedSrc}
                        className="h-full w-full min-h-[180px] border-0"
                        loading="lazy"
                        referrerPolicy="no-referrer-when-downgrade"
                      />
                    </div>

                    <Input
                      value={locationLinkOrPlusCode}
                      onChange={e => {
                        setLocationLinkOrPlusCode(e.target.value)
                        setLocationError('')
                      }}
                      placeholder="Paste Google Maps link, LAT/LONG, or complete Plus Code (e.g., 7J4VXF22+22)..."
                      className="text-xs"
                    />

                    {locationError && (
                      <p className="text-[11px] font-semibold text-red-400">{locationError}</p>
                    )}

                    <Button
                      type="button"
                      size="sm"
                      disabled={submittingLocation}
                      onClick={handleSubmitProvidedLocation}
                      className="w-full gold-gradient text-gold-foreground font-bold text-xs"
                    >
                      {submittingLocation ? 'Verifying & Sending...' : 'Submit Location for Review'}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-5xl space-y-3">
      {offlineInfo.isOffline && (
        <div className="flex items-center gap-2 rounded-xl border border-amber-500/40 bg-amber-500/15 px-3.5 py-2.5 text-xs text-amber-200">
          <WifiOff className="h-4 w-4 shrink-0 text-amber-400" />
          <span>
            <strong>Offline Emergency Mode:</strong> Showing cached directory contacts
            {offlineInfo.syncedAt ? ` (Last synced: ${formatFullDateTime(offlineInfo.syncedAt)})` : ''}.
          </span>
        </div>
      )}

      <Card className="border-primary/30 bg-card/75 backdrop-blur-sm">
        <CardContent className="p-3 space-y-2.5">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search members by name, office/role, nickname, phone, city, or status..."
              className="pl-9 bg-background/60 border-border/50 text-xs h-9"
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <button
              type="button"
              onClick={() => setShowFilters(prev => !prev)}
              className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline cursor-pointer"
            >
              <SlidersHorizontal className="h-3 w-3" />
              filters
            </button>

            <div className="flex items-center gap-2">
              <span className="text-[11px] font-medium text-muted-foreground">
                Showing <span className="font-bold text-primary">{filteredMembers.length}</span> of {members.length}
              </span>
              {hasActiveFilters && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={clearFilters}
                  className="h-7 px-2 text-xs text-primary hover:bg-primary/10 gap-1"
                >
                  <RotateCcw className="h-3 w-3" />
                  Reset
                </Button>
              )}
            </div>
          </div>

          {showFilters && (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 pt-1 border-t border-border/30">
              <div className="relative flex items-center">
                <Droplets className="absolute left-2.5 h-3.5 w-3.5 text-red-400 pointer-events-none" />
                <select
                  value={bloodFilter}
                  onChange={e => setBloodFilter(e.target.value)}
                  className="w-full h-8 rounded-md border border-border/50 bg-background/80 pl-8 pr-2 text-xs"
                >
                  <option value="">All Blood Groups</option>
                  {bloodOptions.map(bg => (
                    <option key={bg} value={bg}>
                      Blood: {bg}
                    </option>
                  ))}
                </select>
              </div>

              <div className="relative flex items-center">
                <MapPin className="absolute left-2.5 h-3.5 w-3.5 text-primary pointer-events-none" />
                <Input
                  value={cityFilter}
                  onChange={e => setCityFilter(e.target.value)}
                  placeholder="Filter by Current City..."
                  className="h-8 pl-8 bg-background/80 border-border/50 text-xs"
                />
              </div>

              <div className="relative flex items-center">
                <Briefcase className="absolute left-2.5 h-3.5 w-3.5 text-emerald-400 pointer-events-none" />
                <select
                  value={professionFilter}
                  onChange={e => setProfessionFilter(e.target.value)}
                  className="w-full h-8 rounded-md border border-border/50 bg-background/80 pl-8 pr-2 text-xs"
                >
                  <option value="">All Professions</option>
                  {professionOptions.map(prof => (
                    <option key={prof} value={prof}>
                      {prof}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {(userIsAdmin || filteredMembers.length > 0) && (
            <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border/25 pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleExportCsv}
                className="h-7 text-[11px] gap-1.5 border-primary/30 text-primary hover:bg-primary/10"
              >
                <FileSpreadsheet className="h-3 w-3" />
                Export CSV Roster
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handlePrintReport}
                className="h-7 text-[11px] gap-1.5 border-primary/30 text-primary hover:bg-primary/10"
              >
                <Printer className="h-3 w-3" />
                Print Roster / Donors
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {filteredMembers.length === 0 ? (
        <div className="rounded-xl border border-border/30 bg-card/50 p-8 text-center space-y-2">
          <p className="text-sm font-semibold text-foreground">No matching members found</p>
          <p className="text-xs text-muted-foreground">Try clearing or adjusting your search filters.</p>
        </div>
      ) : (
        <div className="grid gap-2 md:grid-cols-2">
          {filteredMembers.map(m => {
            const cleanDial = cleanPhoneNumber(m.contact_number)
            const roleInfo = getRoleDisplay(m)
            const roleTextColor =
              roleInfo.kind === 'office'
                ? 'text-amber-400'
                : roleInfo.kind === 'admin'
                ? 'text-sky-400'
                : 'text-emerald-400/90'

            return (
              <Card
                key={m.id}
                onClick={() => navigate(`/member/${m.id}`)}
                className="cursor-pointer overflow-hidden border-border/40 bg-card/60 backdrop-blur-sm transition-all duration-300 hover:border-primary/40 hover:bg-primary/5 hover:shadow-sm hover:shadow-primary/5"
              >
                <div className="flex items-center gap-2.5 p-2.5">
                  {m.profile_picture_url ? (
                    <img
                      src={m.profile_picture_url}
                      className="h-11 w-11 shrink-0 rounded-full border border-primary/30 object-cover shadow-sm"
                      alt={m.full_name}
                    />
                  ) : (
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-primary/20 bg-gradient-to-br from-primary/20 to-accent text-sm font-bold text-primary shadow-sm">
                      {m.full_name?.[0] || '?'}
                    </div>
                  )}

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <h3 className="truncate text-sm font-bold text-foreground leading-tight">{m.full_name}</h3>
                      {m.blood_group && (
                        <span className="shrink-0 rounded bg-red-500/15 px-1.5 py-0.5 text-[9px] font-bold text-red-400">
                          {m.blood_group}
                        </span>
                      )}
                    </div>

                    <p className="truncate text-[11px] text-muted-foreground leading-tight mt-0.5">
                      {m.class_nickname && <span className="text-primary font-medium">{m.class_nickname}</span>}
                      {m.class_nickname && ' · '}
                      {m.current_status || 'Member'}
                    </p>

                    <p className={`flex items-center gap-1 truncate text-[10px] font-semibold leading-tight mt-0.5 ${roleTextColor}`}>
                      <Award className="h-3 w-3 shrink-0" />
                      <span className="truncate">{roleInfo.label}</span>
                    </p>
                  </div>

                  <div className="flex items-center gap-0.5">
                    {m.id !== user.id && (
                      <>
                        {cleanDial && (
                          <a
                            href={`tel:${cleanDial}`}
                            onClick={e => e.stopPropagation()}
                            className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                            title={`Call ${cleanDial}`}
                          >
                            <Phone className="h-3.5 w-3.5" />
                          </a>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-primary/80 hover:text-primary hover:bg-primary/10"
                          onClick={e => {
                            e.stopPropagation()
                            onStartVideoCall(`DM-${Math.min(user.id, m.id)}-${Math.max(user.id, m.id)}`)
                          }}
                          title="Video Call"
                        >
                          <Video className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-emerald-500/80 hover:text-emerald-400 hover:bg-emerald-500/10"
                          onClick={e => {
                            e.stopPropagation()
                            onStartDM(m.id, m.full_name)
                          }}
                          title="Direct Message"
                        >
                          <MessageCircle className="h-3.5 w-3.5" />
                        </Button>
                        {m.email && (
                          <a
                            href={`mailto:${m.email}`}
                            onClick={e => e.stopPropagation()}
                            className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                            title="Send Email"
                          >
                            <Mail className="h-3.5 w-3.5" />
                          </a>
                        )}
                      </>
                    )}
                    <ChevronRight className="h-4 w-4 text-muted-foreground ml-1" />
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
