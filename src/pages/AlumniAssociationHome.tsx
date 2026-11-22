import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { supabase } from '@/lib/supabase'
import { publishArchivedAlert } from '@/lib/notificationService'
import { formatFullDate } from '@/lib/formatters'
import { checkIsPresidentOrGenSec } from '@/lib/taskAuditService'
import SmartDateInput from '@/components/shared/SmartDateInput'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import {
  Building2,
  ArrowLeft,
  Award,
  CalendarDays,
  GraduationCap,
  Plus,
  Trash2,
  MapPin,
  Users,
  HandHeart,
  CheckCircle2,
  ExternalLink,
  Megaphone,
  ShieldCheck,
} from 'lucide-react'

interface CommitteeMember {
  id: number
  alumni_id: number | null
  member_name: string
  role_title: string
  bio_note: string | null
  display_order: number
}

interface AnnouncementItem {
  id: number
  title: string
  meeting_date: string | null
  venue_or_link: string | null
  details: string
  created_by_name: string | null
  created_at: string
}

interface MentorshipEntry {
  id: number
  alumni_id: number
  member_name: string
  role_type: 'mentor' | 'mentee'
  domain_area: string
  availability_note: string | null
  created_at: string
}

const MENTORSHIP_DOMAINS = [
  'Civil & Structural Engineering',
  'Career Guidance & Leadership',
  'Higher Studies & Research',
  'Entrepreneurship & Business',
  'Software, AI & Digital Tools',
  'Public Speaking & Communication',
]

export default function AlumniAssociationHome() {
  const { user, isAdmin } = useAuth()
  const navigate = useNavigate()

  const userIsAdmin = Boolean(isAdmin || user?.is_admin)

  const [membersDirectory, setMembersDirectory] = useState<any[]>([])
  const [committee, setCommittee] = useState<CommitteeMember[]>([])
  const [announcements, setAnnouncements] = useState<AnnouncementItem[]>([])
  const [mentorships, setMentorships] = useState<MentorshipEntry[]>([])
  const [canManageAdmins, setCanManageAdmins] = useState(userIsAdmin)
  const [loading, setLoading] = useState(true)
  const [statusBanner, setStatusBanner] = useState('')

  // Admin: Add Committee Member state
  const [showAddCommittee, setShowAddCommittee] = useState(false)
  const [selectedAlumniId, setSelectedAlumniId] = useState('')
  const [customCommitteeName, setCustomCommitteeName] = useState('')
  const [roleTitle, setRoleTitle] = useState('')
  const [bioNote, setBioNote] = useState('')
  const [displayOrder, setDisplayOrder] = useState('1')
  const [savingCommittee, setSavingCommittee] = useState(false)

  // President / General Secretary: Assign Admin state
  const [adminTargetId, setAdminTargetId] = useState('')
  const [savingAdminRole, setSavingAdminRole] = useState(false)

  // Admin: Post Meeting Announcement state
  const [showAddAnnouncement, setShowAddAnnouncement] = useState(false)
  const [annTitle, setAnnTitle] = useState('')
  const [annDate, setAnnDate] = useState('')
  const [annVenue, setAnnVenue] = useState('')
  const [annDetails, setAnnDetails] = useState('')
  const [broadcastAlert, setBroadcastAlert] = useState(true)
  const [savingAnnouncement, setSavingAnnouncement] = useState(false)

  // Member: Mentorship Sign-Up state
  const [mentorRoleType, setMentorRoleType] = useState<'mentor' | 'mentee'>('mentor')
  const [domainArea, setDomainArea] = useState(MENTORSHIP_DOMAINS[0])
  const [customDomain, setCustomDomain] = useState('')
  const [availabilityNote, setAvailabilityNote] = useState('')
  const [savingMentorship, setSavingMentorship] = useState(false)
  const [mentorshipFilter, setMentorshipFilter] = useState<'all' | 'mentor' | 'mentee'>('all')

  useEffect(() => {
    if (!user) {
      navigate('/')
      return
    }
    loadAssociationData()
  }, [user, navigate])

  const showToastBanner = (msg: string) => {
    setStatusBanner(msg)
    setTimeout(() => setStatusBanner(''), 4000)
  }

  const loadAssociationData = async () => {
    if (!user) return
    setLoading(true)
    const [membersRes, commRes, annRes, mentorRes, execCheck] = await Promise.all([
      supabase
        .from('alumni')
        .select('id, full_name, profile_picture_url, current_status, is_admin')
        .eq('is_placeholder', false)
        .neq('full_name', 'System Administrator')
        .order('full_name', { ascending: true }),
      supabase
        .from('alumni_committee')
        .select('*')
        .order('display_order', { ascending: true })
        .order('id', { ascending: true }),
      supabase
        .from('alumni_announcements')
        .select('*')
        .order('meeting_date', { ascending: false })
        .order('created_at', { ascending: false }),
      supabase
        .from('mentorship_signups')
        .select('*')
        .order('created_at', { ascending: false }),
      checkIsPresidentOrGenSec(user.id),
    ])

    setMembersDirectory(membersRes.data ?? [])
    setCommittee((commRes.data ?? []) as CommitteeMember[])
    setAnnouncements((annRes.data ?? []) as AnnouncementItem[])
    setMentorships((mentorRes.data ?? []) as MentorshipEntry[])
    setCanManageAdmins(Boolean(userIsAdmin || execCheck.hasExecutiveAdmin))
    setLoading(false)
  }

  const handleToggleMemberAdmin = async (targetUserId: number, makeAdmin: boolean) => {
    if (!user || !canManageAdmins) return
    const target = membersDirectory.find(m => m.id === targetUserId)
    if (!target) return

    setSavingAdminRole(true)
    const { error } = await supabase.rpc('set_member_admin_status', {
      p_actor_id: user.id,
      p_target_user_id: targetUserId,
      p_make_admin: makeAdmin,
    })

    if (error) {
      await supabase.from('alumni').update({ is_admin: makeAdmin }).eq('id', targetUserId)
    }

    setSavingAdminRole(false)
    setAdminTargetId('')
    showToastBanner(
      makeAdmin
        ? `${target.full_name} has been granted Admin privileges!`
        : `Admin privileges removed from ${target.full_name}.`
    )
    await loadAssociationData()
  }

  const handleAddCommitteeMember = async () => {
    if (!canManageAdmins) return
    const matchedMember = membersDirectory.find(m => String(m.id) === selectedAlumniId)
    const finalName = matchedMember ? matchedMember.full_name : customCommitteeName.trim()

    if (!finalName || !roleTitle.trim()) {
      alert('Please select or enter a member name and specify their Role Title.')
      return
    }

    setSavingCommittee(true)
    const { error } = await supabase.from('alumni_committee').insert([
      {
        alumni_id: matchedMember ? matchedMember.id : null,
        member_name: finalName,
        role_title: roleTitle.trim(),
        bio_note: bioNote.trim() || null,
        display_order: Number(displayOrder) || 1,
      },
    ])

    // Automatically grant Admin privileges if role is President or General Secretary
    const lowerRole = roleTitle.trim().toLowerCase()
    if (!error && matchedMember && (lowerRole === 'president' || lowerRole === 'general secretary')) {
      await supabase.from('alumni').update({ is_admin: true }).eq('id', matchedMember.id)
    }

    setSavingCommittee(false)

    if (error) {
      alert('Could not add committee member: ' + error.message)
      return
    }

    setSelectedAlumniId('')
    setCustomCommitteeName('')
    setRoleTitle('')
    setBioNote('')
    setDisplayOrder(String(committee.length + 2))
    setShowAddCommittee(false)
    showToastBanner(`${finalName} added to the Executive Committee!`)
    await loadAssociationData()
  }

  const handleDeleteCommitteeMember = async (id: number) => {
    if (!canManageAdmins || !window.confirm('Remove this member from the Executive Committee?')) return
    await supabase.from('alumni_committee').delete().eq('id', id)
    await loadAssociationData()
  }

  const handlePostAnnouncement = async () => {
    if (!user || !canManageAdmins) return
    if (!annTitle.trim() || !annDetails.trim()) {
      alert('Please enter both an Announcement Title and Details.')
      return
    }

    setSavingAnnouncement(true)
    const { error } = await supabase.from('alumni_announcements').insert([
      {
        title: annTitle.trim(),
        meeting_date: annDate || null,
        venue_or_link: annVenue.trim() || null,
        details: annDetails.trim(),
        created_by_name: user.full_name,
      },
    ])

    if (!error && broadcastAlert) {
      const dateStr = annDate ? ` on ${formatFullDate(annDate)}` : ''
      const venueStr = annVenue.trim() ? ` (${annVenue.trim()})` : ''
      await publishArchivedAlert({
        category: 'event',
        shortTitle: 'Alumni Association Notice',
        fullMessage: `${annTitle.trim()}${dateStr}${venueStr}: ${annDetails.trim()}`,
      })
    }

    setSavingAnnouncement(false)

    if (error) {
      alert('Could not post announcement: ' + error.message)
      return
    }

    setAnnTitle('')
    setAnnDate('')
    setAnnVenue('')
    setAnnDetails('')
    setShowAddAnnouncement(false)
    showToastBanner('Alumni Association announcement published!')
    await loadAssociationData()
  }

  const handleDeleteAnnouncement = async (id: number) => {
    if (!canManageAdmins || !window.confirm('Delete this announcement?')) return
    await supabase.from('alumni_announcements').delete().eq('id', id)
    await loadAssociationData()
  }

  const handleMentorshipSignup = async () => {
    if (!user) return
    const finalDomain = domainArea === 'Other' ? customDomain.trim() : domainArea
    if (!finalDomain) {
      alert('Please choose or specify your area of expertise / interest.')
      return
    }

    setSavingMentorship(true)
    const { error } = await supabase.from('mentorship_signups').insert([
      {
        alumni_id: user.id,
        member_name: user.full_name,
        role_type: mentorRoleType,
        domain_area: finalDomain,
        availability_note: availabilityNote.trim() || null,
      },
    ])

    if (!error) {
      const roleLabel = mentorRoleType === 'mentor' ? 'Student & Peer Mentor' : 'Mentee'
      await publishArchivedAlert({
        category: 'member_message',
        shortTitle: 'Mentorship Sign-Up',
        fullMessage: `${user.full_name} registered as a ${roleLabel} in ${finalDomain}.`,
      })
    }

    setSavingMentorship(false)

    if (error) {
      alert('Could not complete mentorship registration: ' + error.message)
      return
    }

    setCustomDomain('')
    setAvailabilityNote('')
    showToastBanner(
      `Thank you! You are registered as a ${mentorRoleType === 'mentor' ? 'Mentor' : 'Mentee'}.`
    )
    await loadAssociationData()
  }

  const handleDeleteMentorship = async (id: number) => {
    if (!window.confirm('Remove this mentorship registration?')) return
    await supabase.from('mentorship_signups').delete().eq('id', id)
    await loadAssociationData()
  }

  if (!user) return null

  const filteredMentorships = mentorships.filter(m =>
    mentorshipFilter === 'all' ? true : m.role_type === mentorshipFilter
  )

  const currentAdmins = membersDirectory.filter(m => m.is_admin)

  return (
    <div className="min-h-svh bg-background p-4 sm:p-6 pb-28">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="flex items-center justify-between">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => navigate('/dashboard')}
            className="gap-1.5 text-xs text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Dashboard
          </Button>
        </div>

        {statusBanner && (
          <div className="flex items-center gap-2 rounded-xl border border-emerald-500/40 bg-emerald-500/15 px-4 py-3 text-xs font-semibold text-emerald-300 shadow">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            {statusBanner}
          </div>
        )}

        <Card className="border-primary/40 bg-card/80 backdrop-blur-md shadow-xl overflow-hidden">
          <CardHeader className="text-center space-y-3 py-6">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-primary/40 bg-primary/10 text-primary shadow-md">
              <Building2 className="h-7 w-7" />
            </div>
            <div className="space-y-1">
              <CardTitle className="text-2xl font-bold text-primary">
                Fenestrians Alumni Association
              </CardTitle>
              <CardDescription className="mx-auto max-w-2xl text-xs sm:text-sm text-muted-foreground">
                Uniting our batch to preserve lifelong friendships, coordinate departmental initiatives, and mentor the next generation of students and young professionals.
              </CardDescription>
            </div>
          </CardHeader>
        </Card>

        {/* PRESIDENT / GENERAL SECRETARY / ADMIN: ASSIGN ADMIN PRIVILEGES */}
        {canManageAdmins && (
          <Card className="border-amber-500/40 bg-amber-500/5 backdrop-blur-sm">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm text-amber-300">
                <ShieldCheck className="h-4 w-4" />
                Admin Privileges Management (President &amp; General Secretary Authority)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-xs">
              <p className="text-muted-foreground">
                The President and General Secretary automatically hold Admin privileges and can assign any member as an Admin below.
              </p>

              <div className="flex flex-wrap gap-2">
                <select
                  value={adminTargetId}
                  onChange={e => setAdminTargetId(e.target.value)}
                  className="flex-1 min-w-[200px] h-9 rounded-md border border-border/50 bg-background px-3 text-xs"
                >
                  <option value="">-- Select a member to grant Admin privileges --</option>
                  {membersDirectory
                    .filter(m => !m.is_admin)
                    .map(m => (
                      <option key={m.id} value={String(m.id)}>
                        {m.full_name}
                      </option>
                    ))}
                </select>

                <Button
                  type="button"
                  size="sm"
                  disabled={!adminTargetId || savingAdminRole}
                  onClick={() => handleToggleMemberAdmin(Number(adminTargetId), true)}
                  className="gold-gradient text-gold-foreground font-semibold"
                >
                  {savingAdminRole ? 'Updating...' : 'Assign as Admin'}
                </Button>
              </div>

              {currentAdmins.length > 0 && (
                <div className="flex flex-wrap gap-2 pt-1">
                  {currentAdmins.map(adm => (
                    <span
                      key={adm.id}
                      className="inline-flex items-center gap-1.5 rounded-full border border-primary/40 bg-primary/10 px-3 py-1 text-[11px] font-semibold text-primary"
                    >
                      {adm.full_name} (Admin)
                      {adm.id !== user.id && (
                        <button
                          type="button"
                          title="Revoke Admin"
                          onClick={() => handleToggleMemberAdmin(adm.id, false)}
                          className="ml-1 text-destructive hover:underline"
                        >
                          ×
                        </button>
                      )}
                    </span>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* 1. EXECUTIVE COMMITTEE SECTION */}
        <Card className="border-border/40 bg-card/70 backdrop-blur-sm">
          <CardHeader className="pb-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle className="flex items-center gap-2 text-base text-primary">
                <Award className="h-5 w-5" />
                Executive Committee ({committee.length})
              </CardTitle>

              {canManageAdmins && (
                <Button
                  type="button"
                  size="sm"
                  onClick={() => setShowAddCommittee(prev => !prev)}
                  className="gold-gradient text-gold-foreground font-semibold gap-1.5 text-xs"
                >
                  <Plus className="h-3.5 w-3.5" />
                  {showAddCommittee ? 'Close Form' : 'Add Committee Member'}
                </Button>
              )}
            </div>
          </CardHeader>

          <CardContent className="space-y-4">
            {canManageAdmins && showAddCommittee && (
              <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 space-y-3 text-xs">
                <p className="font-bold text-primary">Add Executive Committee Office Bearer</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <Label>Select Registered Member</Label>
                    <select
                      value={selectedAlumniId}
                      onChange={e => setSelectedAlumniId(e.target.value)}
                      className="mt-1 w-full h-9 rounded-md border border-border/50 bg-background px-3 text-xs"
                    >
                      <option value="">-- Choose from Directory (or type below) --</option>
                      {membersDirectory.map(m => (
                        <option key={m.id} value={String(m.id)}>
                          {m.full_name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {!selectedAlumniId && (
                    <div>
                      <Label>Or Enter Name Manually *</Label>
                      <Input
                        value={customCommitteeName}
                        onChange={e => setCustomCommitteeName(e.target.value)}
                        placeholder="Full Name"
                        className="mt-1 text-xs"
                      />
                    </div>
                  )}

                  <div>
                    <Label>Committee Role / Designation *</Label>
                    <Input
                      value={roleTitle}
                      onChange={e => setRoleTitle(e.target.value)}
                      placeholder="e.g., President, General Secretary, Treasurer"
                      className="mt-1 text-xs"
                    />
                  </div>

                  <div>
                    <Label>Display Order</Label>
                    <Input
                      type="number"
                      min={1}
                      value={displayOrder}
                      onChange={e => setDisplayOrder(e.target.value)}
                      className="mt-1 text-xs"
                    />
                  </div>
                </div>

                <div>
                  <Label>Portfolio / Responsibility Note</Label>
                  <Input
                    value={bioNote}
                    onChange={e => setBioNote(e.target.value)}
                    placeholder="e.g., Student Mentorship & Industry Liaison"
                    className="mt-1 text-xs"
                  />
                </div>

                <Button
                  type="button"
                  disabled={savingCommittee}
                  onClick={handleAddCommitteeMember}
                  className="gold-gradient text-gold-foreground font-semibold gap-1.5 text-xs"
                >
                  <Plus className="h-3.5 w-3.5" />
                  {savingCommittee ? 'Saving...' : 'Save Committee Member'}
                </Button>
              </div>
            )}

            {loading ? (
              <p className="py-4 text-center text-xs text-muted-foreground">Loading committee profiles...</p>
            ) : committee.length === 0 ? (
              <p className="rounded-xl border border-border/30 bg-muted/15 p-6 text-center text-xs text-muted-foreground">
                Executive Committee office bearers will appear here once added.
              </p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {committee.map(cm => {
                  const linked = membersDirectory.find(m => m.id === cm.alumni_id)
                  return (
                    <div
                      key={cm.id}
                      onClick={() => {
                        if (cm.alumni_id) navigate(`/member/${cm.alumni_id}`)
                      }}
                      className={`relative rounded-xl border border-border/40 bg-muted/15 p-4 flex items-start gap-3 transition-all ${
                        cm.alumni_id ? 'cursor-pointer hover:border-primary/40 hover:bg-primary/5' : ''
                      }`}
                    >
                      {linked?.profile_picture_url ? (
                        <img
                          src={linked.profile_picture_url}
                          alt={cm.member_name}
                          className="h-12 w-12 shrink-0 rounded-full border border-primary/40 object-cover"
                        />
                      ) : (
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-primary/30 bg-primary/15 text-base font-bold text-primary">
                          {cm.member_name?.[0] || '?'}
                        </div>
                      )}

                      <div className="min-w-0 flex-1 pr-6 space-y-1">
                        <Badge variant="outline" className="border-primary/40 text-primary text-[10px]">
                          {cm.role_title}
                        </Badge>
                        <h3 className="text-sm font-bold text-foreground truncate">{cm.member_name}</h3>
                        {cm.bio_note && (
                          <p className="text-[11px] text-muted-foreground leading-snug">{cm.bio_note}</p>
                        )}
                      </div>

                      {canManageAdmins && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          title="Remove Committee Member"
                          onClick={e => {
                            e.stopPropagation()
                            handleDeleteCommitteeMember(cm.id)
                          }}
                          className="absolute right-2 top-2 h-7 w-7 text-destructive hover:bg-destructive/10"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* 2. ASSOCIATION MEETINGS & ANNOUNCEMENTS */}
        <Card className="border-border/40 bg-card/70 backdrop-blur-sm">
          <CardHeader className="pb-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle className="flex items-center gap-2 text-base text-primary">
                <CalendarDays className="h-5 w-5" />
                Meetings &amp; Announcements ({announcements.length})
              </CardTitle>

              {canManageAdmins && (
                <Button
                  type="button"
                  size="sm"
                  onClick={() => setShowAddAnnouncement(prev => !prev)}
                  className="gold-gradient text-gold-foreground font-semibold gap-1.5 text-xs"
                >
                  <Plus className="h-3.5 w-3.5" />
                  {showAddAnnouncement ? 'Close Form' : 'Post Announcement'}
                </Button>
              )}
            </div>
          </CardHeader>

          <CardContent className="space-y-4">
            {canManageAdmins && showAddAnnouncement && (
              <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 space-y-3 text-xs">
                <p className="font-bold text-primary">Publish Association Notice or Meeting</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <Label>Title *</Label>
                    <Input
                      value={annTitle}
                      onChange={e => setAnnTitle(e.target.value)}
                      placeholder="e.g., Executive Committee Meeting / Alumni Meet"
                      className="mt-1 text-xs"
                    />
                  </div>
                  <div>
                    <Label>Meeting / Event Date (DD/MM/YYYY)</Label>
                    <SmartDateInput value={annDate} onChange={setAnnDate} className="mt-1" />
                  </div>
                </div>

                <div>
                  <Label>Venue or Online Meeting Link</Label>
                  <Input
                    value={annVenue}
                    onChange={e => setAnnVenue(e.target.value)}
                    placeholder="e.g., Department Seminar Hall or https://meet.jit.si/..."
                    className="mt-1 text-xs"
                  />
                </div>

                <div>
                  <Label>Details &amp; Agenda *</Label>
                  <Textarea
                    value={annDetails}
                    onChange={e => setAnnDetails(e.target.value)}
                    placeholder="Share key agenda points, resolutions, or instructions..."
                    className="mt-1 h-20 text-xs"
                  />
                </div>

                <label className="flex items-center gap-2 font-medium text-foreground cursor-pointer">
                  <input
                    type="checkbox"
                    checked={broadcastAlert}
                    onChange={e => setBroadcastAlert(e.target.checked)}
                    className="h-4 w-4 accent-amber-500"
                  />
                  <Megaphone className="h-3.5 w-3.5 text-primary" />
                  <span>Also send as a push notification &amp; alert to all members</span>
                </label>

                <Button
                  type="button"
                  disabled={savingAnnouncement}
                  onClick={handlePostAnnouncement}
                  className="gold-gradient text-gold-foreground font-semibold gap-1.5 text-xs"
                >
                  <Plus className="h-3.5 w-3.5" />
                  {savingAnnouncement ? 'Publishing...' : 'Publish Announcement'}
                </Button>
              </div>
            )}

            {announcements.length === 0 ? (
              <p className="rounded-xl border border-border/30 bg-muted/15 p-6 text-center text-xs text-muted-foreground">
                No upcoming meetings or notices posted yet.
              </p>
            ) : (
              <div className="space-y-3">
                {announcements.map(ann => {
                  const isLink =
                    ann.venue_or_link &&
                    (ann.venue_or_link.startsWith('http://') || ann.venue_or_link.startsWith('https://'))
                  return (
                    <div
                      key={ann.id}
                      className="rounded-xl border border-border/40 bg-muted/15 p-4 space-y-2 text-xs"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="space-y-1">
                          <h3 className="text-sm font-bold text-primary">{ann.title}</h3>
                          <div className="flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
                            {ann.meeting_date && (
                              <span className="flex items-center gap-1 font-semibold text-foreground">
                                <CalendarDays className="h-3.5 w-3.5 text-primary" />
                                {formatFullDate(ann.meeting_date)}
                              </span>
                            )}
                            {ann.venue_or_link && (
                              <span className="flex items-center gap-1">
                                <MapPin className="h-3.5 w-3.5 text-emerald-400" />
                                {isLink ? (
                                  <a
                                    href={ann.venue_or_link}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="inline-flex items-center gap-1 text-primary hover:underline font-medium"
                                  >
                                    Join Online Link
                                    <ExternalLink className="h-3 w-3" />
                                  </a>
                                ) : (
                                  <span>{ann.venue_or_link}</span>
                                )}
                              </span>
                            )}
                          </div>
                        </div>

                        {canManageAdmins && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            title="Delete Announcement"
                            onClick={() => handleDeleteAnnouncement(ann.id)}
                            className="h-7 w-7 text-destructive hover:bg-destructive/10 shrink-0"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>

                      <p className="text-foreground/90 whitespace-pre-line leading-relaxed">{ann.details}</p>

                      <p className="text-[10px] text-muted-foreground pt-1">
                        Posted {formatFullDate(ann.created_at)}
                        {ann.created_by_name ? ` by ${ann.created_by_name}` : ''}
                      </p>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* 3. STUDENT & PEER MENTORSHIP SIGN-UPS */}
        <Card className="border-border/40 bg-card/70 backdrop-blur-sm">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base text-primary">
              <GraduationCap className="h-5 w-5" />
              Student &amp; Peer Mentorship Initiative
            </CardTitle>
            <CardDescription className="text-xs">
              Volunteer to mentor final-year students and juniors in your domain, or sign up to connect with a batch mentor.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-5">
            <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 space-y-3 text-xs">
              <p className="font-bold text-primary">Register for Mentorship</p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label>I would like to join as *</Label>
                  <select
                    value={mentorRoleType}
                    onChange={e => setMentorRoleType(e.target.value as 'mentor' | 'mentee')}
                    className="mt-1 w-full h-9 rounded-md border border-border/50 bg-background px-3 text-xs font-semibold"
                  >
                    <option value="mentor">Mentor (Guide Students / Batchmates)</option>
                    <option value="mentee">Mentee (Seeking Guidance)</option>
                  </select>
                </div>

                <div>
                  <Label>Domain / Area of Expertise *</Label>
                  <select
                    value={domainArea}
                    onChange={e => setDomainArea(e.target.value)}
                    className="mt-1 w-full h-9 rounded-md border border-border/50 bg-background px-3 text-xs"
                  >
                    {MENTORSHIP_DOMAINS.map(d => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                    <option value="Other">Other Domain...</option>
                  </select>
                </div>
              </div>

              {domainArea === 'Other' && (
                <div>
                  <Label>Specify Domain / Topic *</Label>
                  <Input
                    value={customDomain}
                    onChange={e => setCustomDomain(e.target.value)}
                    placeholder="e.g., Project Management, Overseas Relocation"
                    className="mt-1 text-xs"
                  />
                </div>
              )}

              <div>
                <Label>Availability &amp; Focus Note</Label>
                <Input
                  value={availabilityNote}
                  onChange={e => setAvailabilityNote(e.target.value)}
                  placeholder="e.g., Available on weekends for 1-on-1 career calls or project reviews"
                  className="mt-1 text-xs"
                />
              </div>

              <Button
                type="button"
                disabled={savingMentorship}
                onClick={handleMentorshipSignup}
                className="gold-gradient text-gold-foreground font-semibold gap-2 text-xs"
              >
                <HandHeart className="h-4 w-4" />
                {savingMentorship
                  ? 'Registering...'
                  : `Sign Up as ${mentorRoleType === 'mentor' ? 'Mentor' : 'Mentee'}`}
              </Button>
            </div>

            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-primary">
                  <Users className="h-4 w-4" />
                  Registered Mentors &amp; Mentees ({filteredMentorships.length})
                </h3>

                <div className="flex rounded-lg border border-border/50 bg-background/60 p-0.5 text-[11px]">
                  {(['all', 'mentor', 'mentee'] as const).map(tab => (
                    <button
                      key={tab}
                      type="button"
                      onClick={() => setMentorshipFilter(tab)}
                      className={`rounded-md px-2.5 py-1 font-semibold capitalize transition-colors ${
                        mentorshipFilter === tab
                          ? 'gold-gradient text-gold-foreground'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      {tab === 'all' ? 'All' : tab === 'mentor' ? 'Mentors' : 'Mentees'}
                    </button>
                  ))}
                </div>
              </div>

              {filteredMentorships.length === 0 ? (
                <p className="rounded-xl border border-border/30 bg-muted/15 p-6 text-center text-xs text-muted-foreground">
                  No registrations in this category yet. Be the first to sign up above!
                </p>
              ) : (
                <div className="grid gap-2.5 sm:grid-cols-2">
                  {filteredMentorships.map(entry => {
                    const canRemove = entry.alumni_id === user.id || canManageAdmins
                    return (
                      <div
                        key={entry.id}
                        className="rounded-xl border border-border/40 bg-muted/15 p-3.5 flex items-start justify-between gap-2 text-xs"
                      >
                        <div className="space-y-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => navigate(`/member/${entry.alumni_id}`)}
                              className="font-bold text-foreground hover:text-primary hover:underline text-left"
                            >
                              {entry.member_name}
                            </button>
                            <Badge
                              variant={entry.role_type === 'mentor' ? 'default' : 'secondary'}
                              className={
                                entry.role_type === 'mentor'
                                  ? 'bg-emerald-600 text-white text-[10px]'
                                  : 'text-[10px]'
                              }
                            >
                              {entry.role_type === 'mentor' ? 'Mentor' : 'Mentee'}
                            </Badge>
                          </div>
                          <p className="font-semibold text-primary">{entry.domain_area}</p>
                          {entry.availability_note && (
                            <p className="text-[11px] text-muted-foreground">{entry.availability_note}</p>
                          )}
                          <p className="text-[10px] text-muted-foreground">
                            Registered {formatFullDate(entry.created_at)}
                          </p>
                        </div>

                        {canRemove && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            title="Remove Registration"
                            onClick={() => handleDeleteMentorship(entry.id)}
                            className="h-7 w-7 text-destructive hover:bg-destructive/10 shrink-0"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
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
    </div>
  )
}
