import { useState, useEffect, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { supabase } from '@/lib/supabase'
import { publishArchivedAlert, type AuditActionItem } from '@/lib/notificationService'
import { resolveOfficerDisplayName } from '@/lib/taskAuditService'
import { formatFullDate, cleanPhoneNumber } from '@/lib/formatters'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  X,
  ArrowLeft,
  Video,
  MessageCircle,
  Phone,
  Mail,
  MapPin,
  Heart,
  GraduationCap,
  Briefcase,
  CalendarDays,
  Droplets,
  Lock,
  AlertTriangle,
  BellRing,
  CheckCircle2,
  Download,
  ExternalLink,
  Send,
} from 'lucide-react'

export default function MemberProfilePage() {
  const { id } = useParams<{ id: string }>()
  const { user, isAdmin } = useAuth()
  const navigate = useNavigate()

  const [member, setMember] = useState<any | null>(null)
  const [familyList, setFamilyList] = useState<any[]>([])
  const [skippedKeys, setSkippedKeys] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [showPhotoModal, setShowPhotoModal] = useState(false)

  const [sendingRequest, setSendingRequest] = useState(false)
  const [requestSent, setRequestSent] = useState(false)
  const [lastRequestMessage, setLastRequestMessage] = useState('')

  const userIsAdmin = Boolean(isAdmin || user?.is_admin)

  useEffect(() => {
    if (!user) {
      navigate('/')
      return
    }
    if (!id) {
      navigate('/dashboard')
      return
    }
    loadMemberProfile(Number(id))
  }, [id, user, navigate])

  const loadMemberProfile = async (memberId: number) => {
    setLoading(true)
    const [memberRes, familyRes, prefsRes] = await Promise.all([
      supabase
        .from('alumni_directory_safe')
        .select('*')
        .eq('id', memberId)
        .eq('is_placeholder', false)
        .maybeSingle(),
      supabase
        .from('family_members')
        .select('*')
        .eq('alumni_id', memberId),
      supabase
        .from('audit_preferences')
        .select('target_key')
        .eq('user_id', memberId)
        .eq('preference_type', 'skip_missing_field'),
    ])

    let profileRow = memberRes.data
    if (!profileRow) {
      const fallbackRes = await supabase
        .from('alumni')
        .select('*')
        .eq('id', memberId)
        .eq('is_placeholder', false)
        .maybeSingle()
      profileRow = fallbackRes.data
    }

    setMember(profileRow || null)
    setFamilyList(familyRes.data ?? [])
    setSkippedKeys(new Set((prefsRes.data ?? []).map((p: any) => String(p.target_key))))
    setLoading(false)
  }

  const incompleteItems = useMemo<AuditActionItem[]>(() => {
    if (!member) return []
    const items: AuditActionItem[] = []

    const addIfMissing = (isMissing: boolean, targetKey: string, label: string) => {
      if (isMissing && !skippedKeys.has(targetKey)) {
        items.push({
          label,
          preferenceType: 'skip_missing_field',
          targetKey,
        })
      }
    }

    addIfMissing(!member.profile_picture_url, 'profile_picture_url', 'Profile Picture')
    addIfMissing(!member.dob, 'dob', 'Date of Birth')
    addIfMissing(!member.blood_group || !String(member.blood_group).trim(), 'blood_group', 'Blood Group')
    addIfMissing(!member.education_level || !String(member.education_level).trim(), 'education_level', 'Education Level')
    addIfMissing(!cleanPhoneNumber(member.contact_number), 'contact_number', 'Contact Number')
    addIfMissing(!cleanPhoneNumber(member.whatsapp_number), 'whatsapp_number', 'WhatsApp Number')
    addIfMissing(!member.current_status || !String(member.current_status).trim(), 'current_status', 'Current Career Status / Profession')
    addIfMissing(!member.permanent_address || !String(member.permanent_address).trim(), 'permanent_address', 'Permanent Address')
    addIfMissing(!member.current_address || !String(member.current_address).trim(), 'current_address', 'Current Address')

    if (member.marital_status?.toLowerCase() === 'married') {
      addIfMissing(!member.wedding_date, 'wedding_date', 'Wedding Date')
    }

    if (familyList.length === 0) {
      addIfMissing(true, 'family_details', 'Family Details')
    } else {
      for (const fm of familyList) {
        if (fm.is_private) continue
        addIfMissing(!fm.dob, `family_${fm.id}_dob`, `Birthday for ${fm.name} (Family)`)
        addIfMissing(!fm.blood_group || !String(fm.blood_group).trim(), `family_${fm.id}_blood_group`, `Blood Group for ${fm.name} (Family)`)
        addIfMissing(!fm.education_level || !String(fm.education_level).trim(), `family_${fm.id}_education_level`, `Education Level for ${fm.name} (Family)`)
      }
    }

    return items
  }, [member, familyList, skippedKeys])

  const getMapLink = (loc: string | null) => {
    if (!loc) return null
    const clean = loc.trim()
    if (!clean) return null
    if (clean.startsWith('http://') || clean.startsWith('https://')) return clean
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(clean)}`
  }

  const handleSavePhoto = async () => {
    if (!member?.profile_picture_url) return
    try {
      const response = await fetch(member.profile_picture_url)
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${(member.full_name || 'member').replace(/\s+/g, '_')}_profile.jpg`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch {
      window.open(member.profile_picture_url, '_blank', 'noopener,noreferrer')
    }
  }

  const buildWhatsAppUrl = (cleanWaE164: string, text: string) => {
    const digits = cleanWaE164.replace(/[^0-9]/g, '')
    return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`
  }

  const buildMailtoUrl = (emailAddr: string, text: string) => {
    const subject = 'Request to Complete Profile Details - Fenestrians App'
    return `mailto:${encodeURIComponent(emailAddr)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(text)}`
  }

  const handleSendCompletionRequest = async () => {
    if (!user || !member || incompleteItems.length === 0) return

    const senderTitledName = await resolveOfficerDisplayName(user.id, user.full_name)
    const bulletList = incompleteItems.map(item => `• ${item.label}`).join('\n')
    const formattedMessage = `${senderTitledName} has requested you to complete the below details in your profile in the Fenestrians App:\n\n${bulletList}`

    const subItems = incompleteItems.map((item, idx) => ({
      id: `peer_${idx}_${item.targetKey}`,
      label: item.label,
      fieldKey: item.targetKey,
      preferenceType: item.preferenceType,
      completed: false,
      optedOut: false,
    }))

    setSendingRequest(true)
    try {
      const { data: createdTask } = await supabase
        .from('member_tasks')
        .insert([
          {
            assigned_to_user_id: member.id,
            assigned_by_user_id: user.id,
            task_type: 'peer_profile_request',
            field_key: incompleteItems.map(i => i.targetKey).join(','),
            title: `Profile Completion Request from ${senderTitledName}`,
            description: formattedMessage,
            is_micromanaged: false,
            status: 'pending',
            is_private: true,
            sender_display_name: senderTitledName,
            task_items_json: subItems,
          },
        ])
        .select('id')
        .single()

      await publishArchivedAlert({
        category: 'personal_task',
        shortTitle: 'Personal task alert',
        fullMessage: formattedMessage,
        targetUserId: member.id,
        metadata: {
          task_id: createdTask?.id,
          is_micromanaged: false,
          audit_items: incompleteItems,
        },
      })

      setLastRequestMessage(formattedMessage)
      setRequestSent(true)

      const cleanWa = cleanPhoneNumber(member.whatsapp_number)
      const hasEmail = Boolean(member.email && member.email.trim())

      if (cleanWa) {
        window.open(buildWhatsAppUrl(cleanWa, formattedMessage), '_blank', 'noopener,noreferrer')
      } else if (hasEmail) {
        window.location.href = buildMailtoUrl(member.email.trim(), formattedMessage)
      }
    } finally {
      setSendingRequest(false)
    }
  }

  if (!user) return null

  if (loading) {
    return (
      <div className="flex min-h-svh items-center justify-center p-6">
        <p className="text-sm text-muted-foreground">Loading member profile...</p>
      </div>
    )
  }

  if (!member || (member.hide_from_peers && member.id !== user.id && !userIsAdmin)) {
    return (
      <div className="flex min-h-svh items-center justify-center p-6">
        <Card className="w-full max-w-md border-border/40 bg-card/80 p-6 text-center space-y-4">
          <p className="text-sm font-semibold text-foreground">
            {!member ? 'Member profile not found.' : 'This member has set their profile to private.'}
          </p>
          <Button
            type="button"
            onClick={() => navigate('/dashboard')}
            className="w-full gold-gradient text-gold-foreground font-semibold gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Dashboard
          </Button>
        </Card>
      </div>
    )
  }

  const isOwnProfile = member.id === user.id
  const cleanContact = cleanPhoneNumber(member.contact_number)
  const cleanWa = cleanPhoneNumber(member.whatsapp_number)
  const waDigits = cleanWa.replace(/[^0-9]/g, '')
  const permMapUrl = getMapLink(member.permanent_geo_location || member.permanent_address)
  const currMapUrl = getMapLink(member.current_geo_location || member.current_address)
  const canDownloadPhoto = isOwnProfile || member.allow_profile_pic_download !== false
  const dmRoomName = `DM-${Math.min(user.id, member.id)}-${Math.max(user.id, member.id)}`

  return (
    <div className="min-h-svh bg-background p-4 sm:p-6 pb-28">
      <div className="mx-auto max-w-3xl space-y-4">
        <Card className="relative border-primary/30 bg-card/80 backdrop-blur-md shadow-2xl overflow-hidden">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            title="Close Profile & Return to Dashboard"
            onClick={() => navigate('/dashboard')}
            className="absolute right-3 top-3 z-10 h-9 w-9 rounded-full border border-border/50 bg-background/80 text-muted-foreground hover:border-primary/50 hover:text-primary"
          >
            <X className="h-5 w-5" />
          </Button>

          <CardHeader className="pb-4 pt-6">
            <div className="flex flex-col sm:flex-row items-center gap-5">
              {member.profile_picture_url ? (
                <button
                  type="button"
                  title="Click to View Full Photo"
                  onClick={() => setShowPhotoModal(true)}
                  className="shrink-0 rounded-full focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <img
                    src={member.profile_picture_url}
                    alt={member.full_name}
                    className="h-28 w-28 sm:h-32 sm:w-32 rounded-full border-2 border-primary/50 object-cover shadow-xl hover:scale-105 transition-transform"
                  />
                </button>
              ) : (
                <div className="flex h-28 w-28 sm:h-32 sm:w-32 shrink-0 items-center justify-center rounded-full border-2 border-primary/30 bg-gradient-to-br from-primary/20 to-accent text-4xl font-bold text-primary shadow-lg">
                  {member.full_name?.[0] || '?'}
                </div>
              )}

              <div className="text-center sm:text-left space-y-2 min-w-0 flex-1 pr-6">
                <CardTitle className="text-2xl font-bold text-foreground break-words">
                  {member.full_name}
                </CardTitle>

                <div className="flex flex-wrap justify-center sm:justify-start items-center gap-2">
                  {member.class_nickname && (
                    <Badge variant="outline" className="border-primary/40 text-primary text-xs">
                      “{member.class_nickname}”
                    </Badge>
                  )}
                  {member.gender && (
                    <Badge variant="secondary" className="text-xs">
                      {member.gender}
                    </Badge>
                  )}
                  {member.blood_group && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-red-500/15 px-2.5 py-0.5 text-xs font-bold text-red-400">
                      <Droplets className="h-3.5 w-3.5" />
                      {member.blood_group}
                    </span>
                  )}
                </div>

                {member.current_status && (
                  <p className="flex items-center justify-center sm:justify-start gap-1.5 text-xs font-medium text-muted-foreground">
                    <Briefcase className="h-3.5 w-3.5 text-primary" />
                    {member.current_status}
                  </p>
                )}
              </div>
            </div>

            {!isOwnProfile && (
              <div className="mt-5 flex flex-wrap items-center justify-center sm:justify-start gap-2 border-t border-border/30 pt-4">
                <Button
                  type="button"
                  size="sm"
                  onClick={() =>
                    navigate(
                      `/dashboard?tab=chat&dmId=${member.id}&dmName=${encodeURIComponent(member.full_name)}`
                    )
                  }
                  className="gold-gradient text-gold-foreground font-semibold gap-1.5 text-xs"
                >
                  <MessageCircle className="h-3.5 w-3.5" />
                  Message
                </Button>

                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    navigate(`/dashboard?tab=calls&roomName=${encodeURIComponent(dmRoomName)}`)
                  }
                  className="border-primary/40 text-primary hover:bg-primary/10 gap-1.5 text-xs"
                >
                  <Video className="h-3.5 w-3.5" />
                  Video Call
                </Button>

                {cleanContact && (
                  <a
                    href={`tel:${cleanContact}`}
                    className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border/50 bg-background/70 px-3 text-xs font-semibold text-foreground hover:border-primary/40 hover:text-primary transition-colors"
                  >
                    <Phone className="h-3.5 w-3.5 text-primary" />
                    Call
                  </a>
                )}

                {waDigits && (
                  <a
                    href={`https://wa.me/${waDigits}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex h-8 items-center gap-1.5 rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 text-xs font-semibold text-emerald-400 hover:bg-emerald-500/20 transition-colors"
                  >
                    <Phone className="h-3.5 w-3.5" />
                    WhatsApp
                  </a>
                )}

                {member.email && (
                  <a
                    href={`mailto:${member.email}`}
                    className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border/50 bg-background/70 px-3 text-xs font-semibold text-foreground hover:border-primary/40 hover:text-primary transition-colors"
                  >
                    <Mail className="h-3.5 w-3.5 text-primary" />
                    Email
                  </a>
                )}
              </div>
            )}
          </CardHeader>

          <CardContent className="space-y-4 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="rounded-xl border border-border/30 bg-muted/15 p-3 space-y-1">
                <p className="flex items-center gap-1.5 text-muted-foreground">
                  <CalendarDays className="h-3.5 w-3.5 text-primary" />
                  Date of Birth
                </p>
                <p className="text-sm font-semibold text-foreground">
                  {formatFullDate(member.dob, 'Not provided')}
                </p>
              </div>

              <div className="rounded-xl border border-border/30 bg-muted/15 p-3 space-y-1">
                <p className="flex items-center gap-1.5 text-muted-foreground">
                  <GraduationCap className="h-3.5 w-3.5 text-primary" />
                  Education Level
                </p>
                <p className="text-sm font-semibold text-foreground">
                  {member.education_level || 'Not provided'}
                </p>
              </div>

              <div className="rounded-xl border border-border/30 bg-muted/15 p-3 space-y-1">
                <p className="flex items-center gap-1.5 text-muted-foreground">
                  <Phone className="h-3.5 w-3.5 text-primary" />
                  Contact Number
                </p>
                {cleanContact ? (
                  <a
                    href={`tel:${cleanContact}`}
                    className="block text-sm font-semibold text-primary hover:underline"
                  >
                    {cleanContact}
                  </a>
                ) : (
                  <p className="text-sm font-semibold text-muted-foreground">Not provided</p>
                )}
              </div>

              <div className="rounded-xl border border-border/30 bg-muted/15 p-3 space-y-1">
                <p className="flex items-center gap-1.5 text-muted-foreground">
                  <Phone className="h-3.5 w-3.5 text-emerald-400" />
                  WhatsApp Number
                </p>
                {waDigits ? (
                  <a
                    href={`https://wa.me/${waDigits}`}
                    target="_blank"
                    rel="noreferrer"
                    className="block text-sm font-semibold text-emerald-400 hover:underline"
                  >
                    {cleanWa}
                  </a>
                ) : (
                  <p className="text-sm font-semibold text-muted-foreground">Not provided</p>
                )}
              </div>

              <div className="sm:col-span-2 rounded-xl border border-border/30 bg-muted/15 p-3 space-y-1">
                <p className="flex items-center gap-1.5 text-muted-foreground">
                  <Mail className="h-3.5 w-3.5 text-primary" />
                  Email Address
                </p>
                {member.email ? (
                  <a
                    href={`mailto:${member.email}`}
                    className="block text-sm font-semibold text-primary hover:underline break-all"
                  >
                    {member.email}
                  </a>
                ) : (
                  <p className="text-sm font-semibold text-muted-foreground">Not provided</p>
                )}
              </div>
            </div>

            <div className="space-y-3 rounded-xl border border-border/30 bg-muted/15 p-3.5">
              <div className="space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="flex items-center gap-1.5 font-semibold text-primary">
                    <MapPin className="h-3.5 w-3.5" />
                    Permanent Address
                  </p>
                  {permMapUrl && (
                    <a
                      href={permMapUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 rounded bg-primary/15 px-2 py-0.5 text-[11px] font-semibold text-primary hover:bg-primary/25"
                    >
                      Open in Maps
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>
                <p className="text-foreground/90 leading-relaxed">
                  {member.permanent_address || 'Not provided'}
                </p>
              </div>

              <hr className="border-border/30" />

              <div className="space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="flex items-center gap-1.5 font-semibold text-primary">
                    <MapPin className="h-3.5 w-3.5" />
                    Current Address
                  </p>
                  {currMapUrl && (
                    <a
                      href={currMapUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 rounded bg-primary/15 px-2 py-0.5 text-[11px] font-semibold text-primary hover:bg-primary/25"
                    >
                      Open in Maps
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>
                <p className="text-foreground/90 leading-relaxed">
                  {member.current_address || 'Not provided'}
                </p>
              </div>
            </div>

            {member.marital_status && (
              <div className="rounded-xl border border-border/30 bg-muted/15 p-3.5 space-y-1.5">
                <p className="flex items-center gap-1.5 font-semibold text-primary">
                  <Heart className="h-3.5 w-3.5" />
                  Marital Status: <span className="text-foreground">{member.marital_status}</span>
                </p>
                {member.wedding_date && (
                  <p className="text-muted-foreground">
                    Wedding Date:{' '}
                    <span className="font-medium text-foreground">{formatFullDate(member.wedding_date)}</span>
                  </p>
                )}
                {member.marital_status === 'Divorced' && member.divorce_date && (
                  <p className="text-muted-foreground">
                    Divorced Date:{' '}
                    <span className="font-medium text-foreground">{formatFullDate(member.divorce_date)}</span>
                  </p>
                )}
                {member.marital_status === 'Married' && member.spouse_name && (
                  <p className="text-muted-foreground">
                    Spouse: <span className="font-medium text-foreground">{member.spouse_name}</span>
                    {member.spouse_dob ? ` (${formatFullDate(member.spouse_dob)})` : ''}
                  </p>
                )}
              </div>
            )}

            <div className="rounded-xl border border-border/30 bg-muted/15 p-3.5 space-y-2">
              <h3 className="text-[11px] font-bold uppercase tracking-wider text-primary">
                Family Details
              </h3>
              {familyList.length === 0 ? (
                <p className="italic text-muted-foreground">No family details added yet.</p>
              ) : (
                <div className="space-y-2">
                  {familyList.map(f => {
                    if (f.is_private && !isOwnProfile) {
                      return (
                        <div
                          key={f.id}
                          className="flex items-center gap-1.5 rounded-lg border border-border/30 bg-background/50 px-3 py-2 italic text-muted-foreground"
                        >
                          <Lock className="h-3.5 w-3.5" />
                          Private {f.relationship || 'Family Member'}
                        </div>
                      )
                    }
                    return (
                      <div
                        key={f.id}
                        className="rounded-lg border border-border/30 bg-background/50 p-2.5 space-y-1"
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-bold text-foreground text-sm">{f.name}</span>
                          {f.relationship && (
                            <Badge variant="outline" className="text-[10px]">
                              {f.relationship}
                            </Badge>
                          )}
                          {f.gender && <span className="text-muted-foreground">({f.gender})</span>}
                          {f.blood_group && (
                            <span className="rounded bg-red-500/15 px-1.5 py-0.5 text-[10px] font-bold text-red-400">
                              Blood: {f.blood_group}
                            </span>
                          )}
                        </div>
                        {(f.dob || f.education_level || f.career) && (
                          <p className="text-[11px] text-muted-foreground">
                            {[
                              f.dob ? `DOB: ${formatFullDate(f.dob)}` : '',
                              f.education_level ? `Education: ${f.education_level}` : '',
                              f.career ? `Career: ${f.career}` : '',
                            ]
                              .filter(Boolean)
                              .join(' • ')}
                          </p>
                        )}
                        {f.needs_support && (
                          <div className="flex items-center gap-1.5 rounded bg-destructive/15 px-2 py-1 text-[11px] text-destructive">
                            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                            <span>{f.support_details || 'Support needed'}</span>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {!isOwnProfile && incompleteItems.length > 0 && (
              <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 space-y-3">
                <div className="flex items-start gap-2.5">
                  <BellRing className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <h3 className="text-sm font-bold text-amber-300">
                      Incomplete Profile Details ({incompleteItems.length})
                    </h3>
                    <p className="text-xs text-foreground/90">
                      Send a friendly reminder task &amp; alert to <span className="font-semibold">{member.full_name}</span> to complete the following details:
                    </p>
                  </div>
                </div>

                <ul className="list-disc list-inside space-y-1 pl-2 text-xs text-foreground/90">
                  {incompleteItems.map(item => (
                    <li key={item.targetKey}>{item.label}</li>
                  ))}
                </ul>

                {!requestSent ? (
                  <Button
                    type="button"
                    disabled={sendingRequest}
                    onClick={handleSendCompletionRequest}
                    className="w-full gold-gradient text-gold-foreground font-bold gap-2"
                  >
                    <Send className="h-4 w-4" />
                    {sendingRequest
                      ? 'Sending Request & Alert...'
                      : `Remind ${member.full_name} to Complete Profile`}
                  </Button>
                ) : (
                  <div className="space-y-2.5 rounded-lg border border-emerald-500/40 bg-emerald-500/15 p-3">
                    <p className="flex items-center gap-1.5 text-xs font-bold text-emerald-300">
                      <CheckCircle2 className="h-4 w-4 shrink-0" />
                      In-app task &amp; alert sent to {member.full_name}!
                    </p>

                    {(waDigits || member.email) && (
                      <div className="flex flex-wrap gap-2 pt-1">
                        {waDigits && (
                          <a
                            href={buildWhatsAppUrl(cleanWa, lastRequestMessage)}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex h-8 items-center gap-1.5 rounded-md bg-emerald-600 hover:bg-emerald-500 px-3 text-xs font-semibold text-white"
                          >
                            <Phone className="h-3.5 w-3.5" />
                            Send via WhatsApp
                          </a>
                        )}
                        {member.email && (
                          <a
                            href={buildMailtoUrl(member.email.trim(), lastRequestMessage)}
                            className="inline-flex h-8 items-center gap-1.5 rounded-md border border-primary/40 bg-background/80 px-3 text-xs font-semibold text-primary hover:bg-primary/10"
                          >
                            <Mail className="h-3.5 w-3.5" />
                            Send via Email
                          </a>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Button
          type="button"
          variant="outline"
          onClick={() => navigate('/dashboard')}
          className="w-full border-primary/40 bg-card/80 text-primary hover:bg-primary/10 font-semibold gap-2 py-5"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Dashboard
        </Button>
      </div>

      {showPhotoModal && member.profile_picture_url && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm"
          onClick={() => setShowPhotoModal(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-primary/40 bg-card p-4 shadow-2xl space-y-3"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-primary">{member.full_name}</h3>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => setShowPhotoModal(false)}
                className="h-7 w-7"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div
              className={`relative overflow-hidden rounded-xl border border-border/40 bg-black ${
                !canDownloadPhoto ? 'select-none' : ''
              }`}
              onContextMenu={e => {
                if (!canDownloadPhoto) e.preventDefault()
              }}
            >
              <img
                src={member.profile_picture_url}
                alt={member.full_name}
                draggable={Boolean(canDownloadPhoto)}
                className={`max-h-[70vh] w-full object-contain mx-auto ${
                  !canDownloadPhoto ? 'pointer-events-none select-none' : ''
                }`}
              />
            </div>

            {canDownloadPhoto ? (
              <Button
                type="button"
                onClick={handleSavePhoto}
                className="w-full gold-gradient text-gold-foreground font-semibold gap-2"
              >
                <Download className="h-4 w-4" />
                Save Picture to Device
              </Button>
            ) : (
              <div className="flex items-center justify-center gap-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 p-2.5 text-xs text-amber-300">
                <Lock className="h-3.5 w-3.5 shrink-0" />
                Saving or capturing this profile picture is disabled by {member.full_name}.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
