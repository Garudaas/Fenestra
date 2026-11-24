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
  HandHeart,
  Phone,
  WifiOff,
  FileSpreadsheet,
  Printer,
  Siren,
  Plane,
  Building,
  ExternalLink,
  Send,
  Trash2,
  Award,
} from 'lucide-react'

interface DirectoryTabProps {
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

export default function DirectoryTab({
  onStartDM,
  onStartVideoCall,
  onOpenSupportRequests,
}: DirectoryTabProps) {
  const { user, isAdmin } = useAuth()
  const navigate = useNavigate()
  const [members, setMembers] = useState<any[]>([])
  const [committeeRolesMap, setCommitteeRolesMap] = useState<CommitteeRolesMap>(() => new Map())
  const [openSupportCount, setOpenSupportCount] = useState(0)
  const [offlineInfo, setOfflineInfo] = useState<{ isOffline: boolean; syncedAt: string | null }>({
    isOffline: false,
    syncedAt: null,
  })

  const [searchQuery, setSearchQuery] = useState('')
  const [bloodFilter, setBloodFilter] = useState('')
  const [cityFilter, setCityFilter] = useState('')
  const [professionFilter, setProfessionFilter] = useState('')
  const [bloodOptions, setBloodOptions] = useState<string[]>([])

  // Panels: 'none' | 'sos' | 'city_travel'
  const [activePanel, setActivePanel] = useState<'none' | 'sos' | 'city_travel'>('none')

  // Emergency Blood Donor SOS states
  const [sosBloodGroup, setSosBloodGroup] = useState('')
  const [sosCity, setSosCity] = useState('')
  const [sosNote, setSosNote] = useState('')
  const [sendingSos, setSendingSos] = useState(false)
  const [sosSentCount, setSosSentCount] = useState<number | null>(null)

  // Travel Alerts ("I'm In Town") states
  const [travelAlerts, setTravelAlerts] = useState<TravelAlertItem[]>([])
  const [travelCity, setTravelCity] = useState('')
  const [travelArrival, setTravelArrival] = useState('')
  const [travelDeparture, setTravelDeparture] = useState('')
  const [travelNote, setTravelNote] = useState('')
  const [savingTravel, setSavingTravel] = useState(false)

  const userIsAdmin = Boolean(isAdmin || user?.is_admin)

  useEffect(() => {
    loadDirectory()
    loadTravelAlerts()
  }, [])

  const loadDirectory = async () => {
    try {
      const [usersRes, bgs, supportRes, rolesMap] = await Promise.all([
        supabase
          .from('alumni_directory_safe')
          .select('*')
          .eq('is_placeholder', false)
          .eq('hide_from_peers', false)
          .neq('full_name', 'System Administrator')
          .order('full_name', { ascending: true }),
        fetchAllBloodGroups(),
        supabase
          .from('family_support_requests')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'open'),
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
        setOpenSupportCount(supportRes.count || 0)
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

  // Matching Donors for Emergency Blood SOS
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

  // City Clusters for Interactive Member City Map
  const cityClusters = useMemo(() => {
    const map = new Map<string, Array<{ id: number; name: string; address: string; mapUrl: string }>>()
    for (const m of members) {
      const addr = String(m.current_address || m.permanent_address || '').trim()
      if (!addr) continue
      const segments = addr
        .split(',')
        .map(s => s.trim())
        .filter(Boolean)
      const rawCity =
        segments.length >= 2
          ? segments[segments.length - 2].replace(/\d+/g, '').trim()
          : segments[0].replace(/\d+/g, '').trim()
      const cityLabel = rawCity || 'Other Location'

      const mapUrl =
        m.current_geo_location && String(m.current_geo_location).startsWith('http')
          ? m.current_geo_location
          : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addr)}`

      if (!map.has(cityLabel)) map.set(cityLabel, [])
      map.get(cityLabel)!.push({
        id: m.id,
        name: m.full_name,
        address: addr,
        mapUrl,
      })
    }
    return Array.from(map.entries()).sort((a, b) => b[1].length - a[1].length)
  }, [members])

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

      {/* Quick Action Bar */}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <Button
          type="button"
          variant={activePanel === 'sos' ? 'default' : 'outline'}
          onClick={() => {
            setSosSentCount(null)
            setActivePanel(prev => (prev === 'sos' ? 'none' : 'sos'))
          }}
          className={
            activePanel === 'sos'
              ? 'bg-red-600 hover:bg-red-500 text-white font-bold gap-1.5 text-xs'
              : 'border-red-500/40 bg-red-500/10 text-red-300 hover:bg-red-500/20 font-semibold gap-1.5 text-xs'
          }
        >
          <Siren className="h-4 w-4" />
          Emergency Blood Donor SOS
        </Button>

        <Button
          type="button"
          variant={activePanel === 'city_travel' ? 'default' : 'outline'}
          onClick={() => setActivePanel(prev => (prev === 'city_travel' ? 'none' : 'city_travel'))}
          className={
            activePanel === 'city_travel'
              ? 'gold-gradient text-gold-foreground font-bold gap-1.5 text-xs'
              : 'border-primary/40 bg-primary/10 text-primary hover:bg-primary/20 font-semibold gap-1.5 text-xs'
          }
        >
          <Plane className="h-4 w-4" />
          City Map &amp; “I’m In Town” ({travelAlerts.length})
        </Button>

        <Button
          type="button"
          variant="outline"
          onClick={() => navigate('/dashboard?tab=support&view=opportunities')}
          className="border-emerald-500/40 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20 font-semibold gap-1.5 text-xs"
        >
          <Briefcase className="h-4 w-4" />
          Batch Jobs &amp; Referrals
        </Button>
      </div>

      {/* PANEL 1: ONE-TAP EMERGENCY BLOOD DONOR SOS */}
      {activePanel === 'sos' && (
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
      )}

      {/* PANEL 2: INTERACTIVE MEMBER CITY MAP & "I'M IN TOWN" TRAVEL ALERTS */}
      {activePanel === 'city_travel' && (
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
                  {savingTravel ? 'Alerting...' : 'Alert Batchmates in City'}
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
              <p className="flex items-center gap-1.5 font-bold text-primary text-sm">
                <Building className="h-4 w-4" />
                Batch Locations &amp; City Map ({cityClusters.length} Cities)
              </p>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {cityClusters.map(([cityName, residents]) => (
                  <div
                    key={cityName}
                    className="rounded-xl border border-border/40 bg-muted/15 p-3 space-y-1.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-foreground truncate">{cityName}</span>
                      <a
                        href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(cityName)}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 rounded bg-primary/15 px-2 py-0.5 text-[10px] font-semibold text-primary hover:bg-primary/25 shrink-0"
                      >
                        Map ({residents.length})
                        <ExternalLink className="h-2.5 w-2.5" />
                      </a>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {residents.map(r => (
                        <button
                          key={r.id}
                          type="button"
                          onClick={() => navigate(`/member/${r.id}`)}
                          className="rounded bg-background/80 px-2 py-0.5 text-[11px] text-foreground/90 hover:text-primary hover:underline"
                        >
                          {r.name}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Search Bar & Filters */}
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

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-4">
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

            <div className="flex items-center justify-between sm:justify-end gap-2">
              <span className="text-[11px] font-medium text-muted-foreground">
                Showing <span className="font-bold text-primary">{filteredMembers.length}</span> of {members.length}
              </span>
              {hasActiveFilters && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={clearFilters}
                  className="h-8 px-2 text-xs text-primary hover:bg-primary/10 gap-1"
                >
                  <RotateCcw className="h-3 w-3" />
                  Reset
                </Button>
              )}
            </div>
          </div>

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
                    {/* Line 1: Full Name & Blood Group */}
                    <div className="flex items-center gap-1.5">
                      <h3 className="truncate text-sm font-bold text-foreground leading-tight">{m.full_name}</h3>
                      {m.blood_group && (
                        <span className="shrink-0 rounded bg-red-500/15 px-1.5 py-0.5 text-[9px] font-bold text-red-400">
                          {m.blood_group}
                        </span>
                      )}
                    </div>

                    {/* Line 2: Nickname & Career Status */}
                    <p className="truncate text-[11px] text-muted-foreground leading-tight mt-0.5">
                      {m.class_nickname && <span className="text-primary font-medium">{m.class_nickname}</span>}
                      {m.class_nickname && ' · '}
                      {m.current_status || 'Member'}
                    </p>

                    {/* Line 3: Association Office / App Admin / Member of Association */}
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

      <div className="pt-2">
        <Button
          type="button"
          variant="outline"
          onClick={() =>
            onOpenSupportRequests
              ? onOpenSupportRequests()
              : navigate('/dashboard?tab=support')
          }
          className="w-full border-primary/40 bg-card/80 text-primary hover:bg-primary/10 font-semibold gap-2 py-5"
        >
          <HandHeart className="h-4 w-4" />
          Display Family Support Requests Page
          {openSupportCount > 0 && (
            <span className="rounded-full bg-red-600 px-2 py-0.5 text-[11px] font-bold text-white">
              {openSupportCount} Open
            </span>
          )}
        </Button>
      </div>
    </div>
  )
}
