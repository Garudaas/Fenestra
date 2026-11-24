import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { supabase } from '@/lib/supabase'
import { publishArchivedAlert } from '@/lib/notificationService'
import { formatFullDate } from '@/lib/formatters'
import { checkIsPresidentOrGenSec, checkCanManageTreasury } from '@/lib/taskAuditService'
import { downloadIcsEvent, buildGoogleCalendarUrl } from '@/lib/calendarSync'
import { exportRowsToCSV, openPrintableReport } from '@/lib/reportExporter'
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
  Vote,
  Wallet,
  FileText,
  Download,
  CalendarPlus,
  FileSpreadsheet,
  Printer,
  Upload,
  Pencil,
  Eye,
  ArrowDownLeft,
  ArrowUpRight,
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
  minutes_url: string | null
  minutes_file_name: string | null
  resolution_summary: string | null
  created_by_name: string | null
  created_at: string
}

interface RsvpRecord {
  id: number
  event_key: string
  user_id: number
  member_name: string
  response: 'going' | 'maybe' | 'not_going'
}

interface PollItem {
  id: number
  question: string
  options_json: string[]
  closes_at: string | null
  is_closed: boolean
  created_by_name: string | null
  created_at: string
}

interface PollVoteRecord {
  id: number
  poll_id: number
  user_id: number
  member_name: string
  option_index: number
}

interface FundItem {
  id: number
  title: string
  category: string
  target_amount: number
  description: string | null
  status: string
  created_at: string
}

interface TransactionItem {
  id: number
  fund_id: number
  entry_type: 'contribution' | 'expense'
  member_id: number | null
  person_name: string
  amount: number
  reference_no: string | null
  note: string | null
  entry_date: string
  recorded_by_name: string | null
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

type RsvpByEventMap = Record<string, RsvpRecord[]>
type VotesByPollMap = Record<number, PollVoteRecord[]>
type AssociationTab = 'meetings' | 'polls' | 'treasury' | 'committee' | 'mentorship'

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

  const [activeSubTab, setActiveSubTab] = useState<AssociationTab>('meetings')
  const [membersDirectory, setMembersDirectory] = useState<any[]>([])
  const [committee, setCommittee] = useState<CommitteeMember[]>([])
  const [announcements, setAnnouncements] = useState<AnnouncementItem[]>([])
  const [rsvpsByEvent, setRsvpsByEvent] = useState<RsvpByEventMap>({})
  const [polls, setPolls] = useState<PollItem[]>([])
  const [votesByPoll, setVotesByPoll] = useState<VotesByPollMap>({})
  const [funds, setFunds] = useState<FundItem[]>([])
  const [transactions, setTransactions] = useState<TransactionItem[]>([])
  const [mentorships, setMentorships] = useState<MentorshipEntry[]>([])
  const [canManageAdmins, setCanManageAdmins] = useState(userIsAdmin)
  const [canManageTreasury, setCanManageTreasury] = useState(userIsAdmin)
  const [treasurerRoleLabel, setTreasurerRoleLabel] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [statusBanner, setStatusBanner] = useState('')

  // Committee Form state
  const [showAddCommittee, setShowAddCommittee] = useState(false)
  const [selectedAlumniId, setSelectedAlumniId] = useState('')
  const [customCommitteeName, setCustomCommitteeName] = useState('')
  const [roleTitle, setRoleTitle] = useState('')
  const [bioNote, setBioNote] = useState('')
  const [displayOrder, setDisplayOrder] = useState('1')
  const [savingCommittee, setSavingCommittee] = useState(false)

  // Assign Admin state
  const [adminTargetId, setAdminTargetId] = useState('')
  const [savingAdminRole, setSavingAdminRole] = useState(false)

  // Announcement + Minutes PDF state
  const [showAddAnnouncement, setShowAddAnnouncement] = useState(false)
  const [annTitle, setAnnTitle] = useState('')
  const [annDate, setAnnDate] = useState('')
  const [annVenue, setAnnVenue] = useState('')
  const [annDetails, setAnnDetails] = useState('')
  const [annResolution, setAnnResolution] = useState('')
  const [minutesFile, setMinutesFile] = useState<File | null>(null)
  const [broadcastAlert, setBroadcastAlert] = useState(true)
  const [savingAnnouncement, setSavingAnnouncement] = useState(false)

  // Poll Form state
  const [showAddPoll, setShowAddPoll] = useState(false)
  const [pollQuestion, setPollQuestion] = useState('')
  const [pollOptionsText, setPollOptionsText] = useState('')
  const [pollCloseDate, setPollCloseDate] = useState('')
  const [savingPoll, setSavingPoll] = useState(false)

  // Treasury Fund Form states (Create & Edit Fund)
  const [showFundForm, setShowFundForm] = useState(false)
  const [editingFundId, setEditingFundId] = useState<number | null>(null)
  const [fundTitle, setFundTitle] = useState('')
  const [fundCategory, setFundCategory] = useState('Reunion & Events')
  const [fundTarget, setFundTarget] = useState('')
  const [fundDesc, setFundDesc] = useState('')
  const [savingFund, setSavingFund] = useState(false)

  // Treasury Ledger Entry Form states (Log & Edit Fund Received / Expense Done)
  const [selectedFundIdForEntry, setSelectedFundIdForEntry] = useState<number | null>(null)
  const [editingTxId, setEditingTxId] = useState<number | null>(null)
  const [entryType, setEntryType] = useState<'contribution' | 'expense'>('contribution')
  const [entryMemberId, setEntryMemberId] = useState('')
  const [entryPersonName, setEntryPersonName] = useState('')
  const [entryAmount, setEntryAmount] = useState('')
  const [entryDate, setEntryDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [entryRefNo, setEntryRefNo] = useState('')
  const [entryNote, setEntryNote] = useState('')
  const [savingEntry, setSavingEntry] = useState(false)

  // Mentorship state
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

  const logTreasuryGovernanceAction = async (
    actionType: string,
    targetName: string,
    details: string
  ) => {
    if (!user) return
    const actorLabel = treasurerRoleLabel ? `${treasurerRoleLabel} ${user.full_name}` : user.full_name
    await supabase.from('admin_audit_logs').insert([
      {
        actor_id: user.id,
        actor_name: actorLabel,
        action_type: actionType,
        target_name: targetName,
        details,
      },
    ])
  }

  const loadAssociationData = async () => {
    if (!user) return
    setLoading(true)
    const [
      membersRes,
      commRes,
      annRes,
      rsvpRes,
      pollsRes,
      votesRes,
      fundsRes,
      txRes,
      mentorRes,
      execCheck,
      treasuryCheck,
    ] = await Promise.all([
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
      supabase.from('event_rsvps').select('*'),
      supabase.from('association_polls').select('*').order('created_at', { ascending: false }),
      supabase.from('association_poll_votes').select('*'),
      supabase.from('association_funds').select('*').order('created_at', { ascending: false }),
      supabase
        .from('association_transactions')
        .select('*')
        .order('entry_date', { ascending: false })
        .order('created_at', { ascending: false }),
      supabase.from('mentorship_signups').select('*').order('created_at', { ascending: false }),
      checkIsPresidentOrGenSec(user.id),
      checkCanManageTreasury(user.id),
    ])

    setMembersDirectory(membersRes.data ?? [])
    setCommittee((commRes.data ?? []) as CommitteeMember[])
    setAnnouncements((annRes.data ?? []) as AnnouncementItem[])

    const rsvpMap: RsvpByEventMap = {}
    for (const r of (rsvpRes.data ?? []) as RsvpRecord[]) {
      if (!rsvpMap[r.event_key]) rsvpMap[r.event_key] = []
      rsvpMap[r.event_key].push(r)
    }
    setRsvpsByEvent(rsvpMap)

    setPolls((pollsRes.data ?? []) as PollItem[])
    const voteMap: VotesByPollMap = {}
    for (const v of (votesRes.data ?? []) as PollVoteRecord[]) {
      if (!voteMap[v.poll_id]) voteMap[v.poll_id] = []
      voteMap[v.poll_id].push(v)
    }
    setVotesByPoll(voteMap)

    setFunds((fundsRes.data ?? []) as FundItem[])
    setTransactions((txRes.data ?? []) as TransactionItem[])
    setMentorships((mentorRes.data ?? []) as MentorshipEntry[])

    const hasAdminAuthority = Boolean(userIsAdmin || execCheck.hasExecutiveAdmin)
    setCanManageAdmins(hasAdminAuthority)
    setCanManageTreasury(Boolean(hasAdminAuthority || treasuryCheck.canManageTreasury))
    setTreasurerRoleLabel(treasuryCheck.treasurerTitle || execCheck.officeTitle || null)
    setLoading(false)
  }

  // --- ADMIN PRIVILEGES ---
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

  // --- COMMITTEE ---
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

  // --- ANNOUNCEMENTS, RSVPs & MINUTES PDF ---
  const handlePostAnnouncement = async () => {
    if (!user || !canManageAdmins) return
    if (!annTitle.trim() || !annDetails.trim()) {
      alert('Please enter both an Announcement Title and Details.')
      return
    }

    setSavingAnnouncement(true)
    let uploadedMinutesUrl: string | null = null
    let uploadedMinutesName: string | null = null

    if (minutesFile) {
      const safeName = `${Date.now()}_${minutesFile.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`
      const storagePath = `association_minutes/${safeName}`
      const { error: upErr } = await supabase.storage
        .from('fenestrians-media')
        .upload(storagePath, minutesFile, { upsert: true })

      if (!upErr) {
        const { data: pubData } = supabase.storage
          .from('fenestrians-media')
          .getPublicUrl(storagePath)
        uploadedMinutesUrl = pubData?.publicUrl || null
        uploadedMinutesName = minutesFile.name
      }
    }

    const { error } = await supabase.from('alumni_announcements').insert([
      {
        title: annTitle.trim(),
        meeting_date: annDate || null,
        venue_or_link: annVenue.trim() || null,
        details: annDetails.trim(),
        minutes_url: uploadedMinutesUrl,
        minutes_file_name: uploadedMinutesName,
        resolution_summary: annResolution.trim() || null,
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
    setAnnResolution('')
    setMinutesFile(null)
    setShowAddAnnouncement(false)
    showToastBanner('Alumni Association announcement published!')
    await loadAssociationData()
  }

  const handleDeleteAnnouncement = async (id: number) => {
    if (!canManageAdmins || !window.confirm('Delete this announcement?')) return
    await supabase.from('alumni_announcements').delete().eq('id', id)
    await loadAssociationData()
  }

  const handleRsvp = async (ann: AnnouncementItem, response: 'going' | 'maybe' | 'not_going') => {
    if (!user) return
    const eventKey = `ann_${ann.id}`
    await supabase.from('event_rsvps').upsert(
      [
        {
          event_key: eventKey,
          event_title: ann.title,
          event_date: ann.meeting_date || null,
          user_id: user.id,
          member_name: user.full_name,
          response,
        },
      ],
      { onConflict: 'event_key,user_id' }
    )
    await loadAssociationData()
  }

  // --- POLLS & VOTING ---
  const handleCreatePoll = async () => {
    if (!user || !canManageAdmins) return
    const opts = pollOptionsText
      .split('\n')
      .map(o => o.trim())
      .filter(Boolean)

    if (!pollQuestion.trim() || opts.length < 2) {
      alert('Enter a poll question and at least 2 options (one per line).')
      return
    }

    setSavingPoll(true)
    const closesAtIso = pollCloseDate ? `${pollCloseDate}T23:59:59+05:30` : null

    const { error } = await supabase.from('association_polls').insert([
      {
        question: pollQuestion.trim(),
        options_json: opts,
        closes_at: closesAtIso,
        is_closed: false,
        created_by_id: user.id,
        created_by_name: user.full_name,
      },
    ])

    if (!error) {
      await publishArchivedAlert({
        category: 'event',
        shortTitle: 'New Batch Poll Open',
        fullMessage: `${user.full_name} started a batch poll: "${pollQuestion.trim()}". Cast your vote in Alumni Association!`,
      })
    }

    setSavingPoll(false)
    if (error) {
      alert('Could not create poll: ' + error.message)
      return
    }

    setPollQuestion('')
    setPollOptionsText('')
    setPollCloseDate('')
    setShowAddPoll(false)
    showToastBanner('Batch poll published!')
    await loadAssociationData()
  }

  const handleCastVote = async (pollId: number, optionIndex: number) => {
    if (!user) return
    await supabase.from('association_poll_votes').upsert(
      [
        {
          poll_id: pollId,
          user_id: user.id,
          member_name: user.full_name,
          option_index: optionIndex,
        },
      ],
      { onConflict: 'poll_id,user_id' }
    )
    await loadAssociationData()
  }

  const handleToggleClosePoll = async (poll: PollItem) => {
    if (!canManageAdmins) return
    await supabase
      .from('association_polls')
      .update({ is_closed: !poll.is_closed })
      .eq('id', poll.id)
    await loadAssociationData()
  }

  // --- TREASURER ACCOUNT MANAGEMENT (FUNDS RECEIVED & EXPENSES DONE) ---
  const resetFundForm = () => {
    setEditingFundId(null)
    setFundTitle('')
    setFundCategory('Reunion & Events')
    setFundTarget('')
    setFundDesc('')
    setShowFundForm(false)
  }

  const openEditFundForm = (fund: FundItem) => {
    setEditingFundId(fund.id)
    setFundTitle(fund.title)
    setFundCategory(fund.category || 'Reunion & Events')
    setFundTarget(fund.target_amount ? String(fund.target_amount) : '')
    setFundDesc(fund.description || '')
    setShowFundForm(true)
  }

  const handleSaveFund = async () => {
    if (!user || !canManageTreasury) return
    if (!fundTitle.trim()) {
      alert('Please enter a Fund / Account Title.')
      return
    }
    setSavingFund(true)
    const recorderName = treasurerRoleLabel
      ? `${treasurerRoleLabel} ${user.full_name}`
      : user.full_name

    if (editingFundId) {
      const { error } = await supabase
        .from('association_funds')
        .update({
          title: fundTitle.trim(),
          category: fundCategory,
          target_amount: Number(fundTarget) || 0,
          description: fundDesc.trim() || null,
        })
        .eq('id', editingFundId)

      setSavingFund(false)
      if (error) {
        alert('Could not update fund: ' + error.message)
        return
      }
      await logTreasuryGovernanceAction(
        'treasury_edit_fund',
        fundTitle.trim(),
        `Updated fund account "${fundTitle.trim()}"`
      )
      showToastBanner('Association fund updated!')
    } else {
      const { error } = await supabase.from('association_funds').insert([
        {
          title: fundTitle.trim(),
          category: fundCategory,
          target_amount: Number(fundTarget) || 0,
          description: fundDesc.trim() || null,
          status: 'active',
          created_by_name: recorderName,
        },
      ])

      setSavingFund(false)
      if (error) {
        alert('Could not create fund: ' + error.message)
        return
      }
      await logTreasuryGovernanceAction(
        'treasury_create_fund',
        fundTitle.trim(),
        `Created association fund "${fundTitle.trim()}" (Target: ₹${Number(fundTarget) || 0})`
      )
      showToastBanner('Association fund created!')
    }

    resetFundForm()
    await loadAssociationData()
  }

  const handleToggleFundStatus = async (fund: FundItem) => {
    if (!canManageTreasury) return
    const nextStatus = fund.status === 'closed' ? 'active' : 'closed'
    await supabase
      .from('association_funds')
      .update({ status: nextStatus })
      .eq('id', fund.id)
    await logTreasuryGovernanceAction(
      'treasury_fund_status',
      fund.title,
      `Marked fund "${fund.title}" as ${nextStatus.toUpperCase()}`
    )
    await loadAssociationData()
  }

  const handleDeleteFund = async (fund: FundItem) => {
    if (!canManageTreasury) return
    if (
      !window.confirm(
        `Delete fund "${fund.title}" and all of its recorded transactions? This cannot be undone.`
      )
    ) {
      return
    }
    await supabase.from('association_funds').delete().eq('id', fund.id)
    await logTreasuryGovernanceAction(
      'treasury_delete_fund',
      fund.title,
      `Deleted fund "${fund.title}"`
    )
    showToastBanner(`Deleted fund "${fund.title}".`)
    await loadAssociationData()
  }

  const resetTransactionForm = () => {
    setSelectedFundIdForEntry(null)
    setEditingTxId(null)
    setEntryType('contribution')
    setEntryMemberId('')
    setEntryPersonName('')
    setEntryAmount('')
    setEntryDate(new Date().toISOString().slice(0, 10))
    setEntryRefNo('')
    setEntryNote('')
  }

  const openNewTransactionForm = (fundId: number, defaultType: 'contribution' | 'expense') => {
    setSelectedFundIdForEntry(fundId)
    setEditingTxId(null)
    setEntryType(defaultType)
    setEntryMemberId('')
    setEntryPersonName('')
    setEntryAmount('')
    setEntryDate(new Date().toISOString().slice(0, 10))
    setEntryRefNo('')
    setEntryNote('')
  }

  const openEditTransactionForm = (tx: TransactionItem) => {
    setSelectedFundIdForEntry(tx.fund_id)
    setEditingTxId(tx.id)
    setEntryType(tx.entry_type)
    setEntryMemberId(tx.member_id ? String(tx.member_id) : '')
    setEntryPersonName(tx.person_name)
    setEntryAmount(String(tx.amount))
    setEntryDate(tx.entry_date || new Date().toISOString().slice(0, 10))
    setEntryRefNo(tx.reference_no || '')
    setEntryNote(tx.note || '')
  }

  const handleSaveTransaction = async (fund: FundItem) => {
    if (!user || !canManageTreasury) return
    const amt = Number(entryAmount)
    if (!entryPersonName.trim() || !amt || amt <= 0) {
      alert(
        entryType === 'contribution'
          ? 'Please enter the Donor / Member Name and valid Amount Received.'
          : 'Please enter the Payee / Vendor Name and valid Expense Amount.'
      )
      return
    }

    setSavingEntry(true)
    const recorderName = treasurerRoleLabel
      ? `${treasurerRoleLabel} ${user.full_name}`
      : user.full_name

    const payload = {
      fund_id: fund.id,
      entry_type: entryType,
      member_id: entryType === 'contribution' && entryMemberId ? Number(entryMemberId) : null,
      person_name: entryPersonName.trim(),
      amount: amt,
      entry_date: entryDate || new Date().toISOString().slice(0, 10),
      reference_no: entryRefNo.trim() || null,
      note: entryNote.trim() || null,
      recorded_by_name: recorderName,
    }

    if (editingTxId) {
      const { error } = await supabase
        .from('association_transactions')
        .update(payload)
        .eq('id', editingTxId)

      setSavingEntry(false)
      if (error) {
        alert('Could not update entry: ' + error.message)
        return
      }
      await logTreasuryGovernanceAction(
        'treasury_edit_entry',
        fund.title,
        `Edited ${entryType === 'contribution' ? 'Fund Received' : 'Expense'} of ₹${amt.toLocaleString('en-IN')} (${entryPersonName.trim()}) in "${fund.title}"`
      )
      showToastBanner('Ledger entry updated!')
    } else {
      const { error } = await supabase.from('association_transactions').insert([payload])

      setSavingEntry(false)
      if (error) {
        alert('Could not record entry: ' + error.message)
        return
      }
      await logTreasuryGovernanceAction(
        entryType === 'contribution' ? 'treasury_fund_received' : 'treasury_expense_done',
        fund.title,
        `Logged ${entryType === 'contribution' ? 'Fund Received' : 'Expense Done'} of ₹${amt.toLocaleString('en-IN')} (${entryPersonName.trim()}) in "${fund.title}"`
      )
      showToastBanner(
        entryType === 'contribution'
          ? `Fund received (₹${amt.toLocaleString('en-IN')}) logged!`
          : `Expense (₹${amt.toLocaleString('en-IN')}) recorded!`
      )
    }

    resetTransactionForm()
    await loadAssociationData()
  }

  const handleDeleteTransaction = async (tx: TransactionItem, fundTitleLabel: string) => {
    if (!canManageTreasury) return
    if (
      !window.confirm(
        `Delete this ${tx.entry_type === 'contribution' ? 'Fund Received' : 'Expense'} entry of ₹${Number(tx.amount).toLocaleString('en-IN')} (${tx.person_name})?`
      )
    ) {
      return
    }
    await supabase.from('association_transactions').delete().eq('id', tx.id)
    await logTreasuryGovernanceAction(
      'treasury_delete_entry',
      fundTitleLabel,
      `Deleted ${tx.entry_type === 'contribution' ? 'Fund Received' : 'Expense'} entry of ₹${Number(tx.amount).toLocaleString('en-IN')} (${tx.person_name})`
    )
    showToastBanner('Ledger entry deleted.')
    await loadAssociationData()
  }

  const handleExportTreasuryCsv = () => {
    const headers = [
      'Date',
      'Fund Account',
      'Entry Type',
      'Member / Payee',
      'Amount (INR)',
      'UPI / Voucher Ref',
      'Note / Particulars',
      'Recorded By',
    ]
    const rows = transactions.map(tx => {
      const fund = funds.find(f => f.id === tx.fund_id)
      return [
        formatFullDate(tx.entry_date),
        fund?.title || 'General',
        tx.entry_type === 'contribution' ? 'FUND RECEIVED (+)' : 'EXPENSE DONE (-)',
        tx.person_name,
        tx.amount,
        tx.reference_no || '-',
        tx.note || '-',
        tx.recorded_by_name || '-',
      ]
    })
    exportRowsToCSV(
      `Fenestrians_Treasury_Ledger_${new Date().toISOString().slice(0, 10)}.csv`,
      headers,
      rows
    )
  }

  const handlePrintTreasury = () => {
    const headers = [
      'Date',
      'Fund Account',
      'Entry Type',
      'Member / Payee',
      'Amount (INR)',
      'UPI / Voucher Ref',
      'Note / Particulars',
      'Recorded By',
    ]
    const rows = transactions.map(tx => {
      const fund = funds.find(f => f.id === tx.fund_id)
      return [
        formatFullDate(tx.entry_date),
        fund?.title || 'General',
        tx.entry_type === 'contribution' ? 'FUND RECEIVED (+)' : 'EXPENSE DONE (-)',
        tx.person_name,
        tx.amount,
        tx.reference_no || '-',
        tx.note || '-',
        tx.recorded_by_name || '-',
      ]
    })
    openPrintableReport(
      'Association Treasury & Account Statement',
      `Total Entries: ${transactions.length} • Net Balance: ₹${overallNetBalance.toLocaleString('en-IN')}`,
      headers,
      rows
    )
  }

  // --- MENTORSHIP ---
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

  const handleExportMentorshipCsv = () => {
    const headers = ['Member Name', 'Role', 'Domain / Expertise', 'Availability Note', 'Registered Date']
    const rows = mentorships.map(m => [
      m.member_name,
      m.role_type.toUpperCase(),
      m.domain_area,
      m.availability_note || '-',
      formatFullDate(m.created_at),
    ])
    exportRowsToCSV(
      `Fenestrians_Mentorship_Roster_${new Date().toISOString().slice(0, 10)}.csv`,
      headers,
      rows
    )
  }

  if (!user) return null

  const filteredMentorships = mentorships.filter(m =>
    mentorshipFilter === 'all' ? true : m.role_type === mentorshipFilter
  )

  const currentAdmins = membersDirectory.filter(m => m.is_admin)

  // Overall Treasury Totals across all funds
  const overallFundsReceived = transactions
    .filter(t => t.entry_type === 'contribution')
    .reduce((sum, t) => sum + Number(t.amount || 0), 0)
  const overallExpensesDone = transactions
    .filter(t => t.entry_type === 'expense')
    .reduce((sum, t) => sum + Number(t.amount || 0), 0)
  const overallNetBalance = overallFundsReceived - overallExpensesDone

  return (
    <div className="min-h-svh bg-background p-4 sm:p-6 pb-28">
      <div className="mx-auto max-w-5xl space-y-5">
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
          <CardHeader className="text-center space-y-2 py-5">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-primary/40 bg-primary/10 text-primary shadow-md">
              <Building2 className="h-6 w-6" />
            </div>
            <CardTitle className="text-xl sm:text-2xl font-bold text-primary">
              Fenestrians Alumni Association
            </CardTitle>
            <CardDescription className="mx-auto max-w-2xl text-xs text-muted-foreground">
              Governance, Meetings &amp; RSVPs, Batch Polls, Treasury Ledger &amp; Student Mentorship
            </CardDescription>
          </CardHeader>

          <CardContent className="pt-0 pb-4">
            <div className="flex flex-wrap gap-1.5 rounded-xl border border-border/50 bg-background/60 p-1">
              {(
                [
                  { id: 'meetings', label: `Meetings & RSVPs (${announcements.length})` },
                  { id: 'polls', label: `Batch Polls (${polls.length})` },
                  { id: 'treasury', label: `Treasury & Funds (${funds.length})` },
                  { id: 'committee', label: `Executive Committee (${committee.length})` },
                  { id: 'mentorship', label: `Mentorship (${mentorships.length})` },
                ] as const
              ).map(tab => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveSubTab(tab.id)}
                  className={`flex-1 min-w-[120px] rounded-lg px-3 py-2 text-xs font-bold transition-all ${
                    activeSubTab === tab.id
                      ? 'gold-gradient text-gold-foreground shadow'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* SUB-TAB 1: MEETINGS, ANNOUNCEMENTS, RSVPS & MINUTES PDFs */}
        {activeSubTab === 'meetings' && (
          <Card className="border-border/40 bg-card/70 backdrop-blur-sm">
            <CardHeader className="pb-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <CardTitle className="flex items-center gap-2 text-base text-primary">
                  <CalendarDays className="h-5 w-5" />
                  Meetings, Announcements &amp; Minutes Archive
                </CardTitle>

                {canManageAdmins && (
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => setShowAddAnnouncement(prev => !prev)}
                    className="gold-gradient text-gold-foreground font-semibold gap-1.5 text-xs"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    {showAddAnnouncement ? 'Close Form' : 'Post Meeting / Notice'}
                  </Button>
                )}
              </div>
            </CardHeader>

            <CardContent className="space-y-4">
              {canManageAdmins && showAddAnnouncement && (
                <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 space-y-3 text-xs">
                  <p className="font-bold text-primary">Publish Association Meeting or Notice</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <Label>Title *</Label>
                      <Input
                        value={annTitle}
                        onChange={e => setAnnTitle(e.target.value)}
                        placeholder="e.g., Executive Committee Meeting / Silver Jubilee Meet"
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
                    <Label>Agenda &amp; Details *</Label>
                    <Textarea
                      value={annDetails}
                      onChange={e => setAnnDetails(e.target.value)}
                      placeholder="Share agenda points, schedule, or instructions..."
                      className="mt-1 h-20 text-xs"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <Label>Resolution Summary (Optional)</Label>
                      <Input
                        value={annResolution}
                        onChange={e => setAnnResolution(e.target.value)}
                        placeholder="Key decisions passed..."
                        className="mt-1 text-xs"
                      />
                    </div>
                    <div>
                      <Label>Attach Meeting Minutes PDF (Optional)</Label>
                      <div className="mt-1 flex items-center gap-2">
                        <input
                          type="file"
                          accept=".pdf,.doc,.docx"
                          id="minutes-pdf-input"
                          onChange={e => setMinutesFile(e.target.files?.[0] || null)}
                          className="hidden"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => document.getElementById('minutes-pdf-input')?.click()}
                          className="gap-1.5 text-xs"
                        >
                          <Upload className="h-3.5 w-3.5" />
                          {minutesFile ? minutesFile.name : 'Choose Minutes PDF'}
                        </Button>
                      </div>
                    </div>
                  </div>

                  <label className="flex items-center gap-2 font-medium text-foreground cursor-pointer">
                    <input
                      type="checkbox"
                      checked={broadcastAlert}
                      onChange={e => setBroadcastAlert(e.target.checked)}
                      className="h-4 w-4 accent-amber-500"
                    />
                    <Megaphone className="h-3.5 w-3.5 text-primary" />
                    <span>Send push &amp; WhatsApp alert to all members</span>
                  </label>

                  <Button
                    type="button"
                    disabled={savingAnnouncement}
                    onClick={handlePostAnnouncement}
                    className="gold-gradient text-gold-foreground font-semibold gap-1.5 text-xs"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    {savingAnnouncement ? 'Publishing...' : 'Publish Meeting / Notice'}
                  </Button>
                </div>
              )}

              {loading ? (
                <p className="py-6 text-center text-xs text-muted-foreground">Loading meetings...</p>
              ) : announcements.length === 0 ? (
                <p className="rounded-xl border border-border/30 bg-muted/15 p-6 text-center text-xs text-muted-foreground">
                  No meetings or notices posted yet.
                </p>
              ) : (
                <div className="space-y-3">
                  {announcements.map(ann => {
                    const isLink =
                      ann.venue_or_link &&
                      (ann.venue_or_link.startsWith('http://') ||
                        ann.venue_or_link.startsWith('https://'))
                    const eventKey = `ann_${ann.id}`
                    const rsvpList = rsvpsByEvent[eventKey] ?? []
                    const myRsvp = rsvpList.find(r => r.user_id === user.id)?.response
                    const goingCount = rsvpList.filter(r => r.response === 'going').length
                    const maybeCount = rsvpList.filter(r => r.response === 'maybe').length
                    const startIso = ann.meeting_date
                      ? `${ann.meeting_date}T10:00:00+05:30`
                      : new Date().toISOString()

                    return (
                      <div
                        key={ann.id}
                        className="rounded-xl border border-border/40 bg-muted/15 p-4 space-y-3 text-xs"
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
                              onClick={() => handleDeleteAnnouncement(ann.id)}
                              className="h-7 w-7 text-destructive hover:bg-destructive/10 shrink-0"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>

                        <p className="text-foreground/90 whitespace-pre-line leading-relaxed">
                          {ann.details}
                        </p>

                        {(ann.resolution_summary || ann.minutes_url) && (
                          <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 space-y-2">
                            {ann.resolution_summary && (
                              <p className="text-foreground">
                                <strong className="text-primary">Resolution Summary:</strong>{' '}
                                {ann.resolution_summary}
                              </p>
                            )}
                            {ann.minutes_url && (
                              <a
                                href={ann.minutes_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 rounded-md border border-primary/40 bg-background/80 px-3 py-1.5 text-[11px] font-semibold text-primary hover:bg-primary/15"
                              >
                                <FileText className="h-3.5 w-3.5" />
                                Download Minutes ({ann.minutes_file_name || 'Minutes.pdf'})
                                <Download className="h-3 w-3" />
                              </a>
                            )}
                          </div>
                        )}

                        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/30 pt-2.5">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="font-semibold text-muted-foreground mr-1">RSVP:</span>
                            {(
                              [
                                { val: 'going', label: `Going (${goingCount})` },
                                { val: 'maybe', label: `Maybe (${maybeCount})` },
                                { val: 'not_going', label: "Can't Make It" },
                              ] as const
                            ).map(opt => (
                              <button
                                key={opt.val}
                                type="button"
                                onClick={() => handleRsvp(ann, opt.val)}
                                className={`rounded-full px-2.5 py-1 text-[11px] font-semibold transition-all ${
                                  myRsvp === opt.val
                                    ? 'bg-emerald-600 text-white shadow'
                                    : 'border border-border/50 bg-background/60 text-foreground hover:border-primary/40'
                                }`}
                              >
                                {opt.label}
                              </button>
                            ))}
                          </div>

                          {ann.meeting_date && (
                            <div className="flex items-center gap-1.5">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() =>
                                  downloadIcsEvent({
                                    title: ann.title,
                                    description: ann.details,
                                    location: ann.venue_or_link || undefined,
                                    startIso,
                                  })
                                }
                                className="h-7 px-2 text-[11px] gap-1"
                              >
                                <CalendarPlus className="h-3 w-3" />
                                .ICS File
                              </Button>
                              <a
                                href={buildGoogleCalendarUrl({
                                  title: ann.title,
                                  description: ann.details,
                                  location: ann.venue_or_link || undefined,
                                  startIso,
                                })}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex h-7 items-center gap-1 rounded-md border border-primary/40 bg-primary/10 px-2 text-[11px] font-semibold text-primary hover:bg-primary/20"
                              >
                                Google Calendar
                              </a>
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* SUB-TAB 2: BATCH POLLS & RESOLUTIONS VOTING */}
        {activeSubTab === 'polls' && (
          <Card className="border-border/40 bg-card/70 backdrop-blur-sm">
            <CardHeader className="pb-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <CardTitle className="flex items-center gap-2 text-base text-primary">
                  <Vote className="h-5 w-5" />
                  Batch Polls &amp; Resolutions Voting
                </CardTitle>

                {canManageAdmins && (
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => setShowAddPoll(prev => !prev)}
                    className="gold-gradient text-gold-foreground font-semibold gap-1.5 text-xs"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    {showAddPoll ? 'Close Form' : 'Create Batch Poll'}
                  </Button>
                )}
              </div>
            </CardHeader>

            <CardContent className="space-y-4">
              {canManageAdmins && showAddPoll && (
                <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 space-y-3 text-xs">
                  <p className="font-bold text-primary">Create One-Member-One-Vote Batch Poll</p>
                  <div>
                    <Label>Poll Question / Resolution *</Label>
                    <Input
                      value={pollQuestion}
                      onChange={e => setPollQuestion(e.target.value)}
                      placeholder="e.g., Preferred Month for Annual Batch Reunion?"
                      className="mt-1 text-xs"
                    />
                  </div>
                  <div>
                    <Label>Voting Options (One option per line) *</Label>
                    <Textarea
                      value={pollOptionsText}
                      onChange={e => setPollOptionsText(e.target.value)}
                      placeholder={'December 2026\nJanuary 2027\nFebruary 2027'}
                      className="mt-1 h-24 text-xs"
                    />
                  </div>
                  <div>
                    <Label>Auto-Close Date (Optional)</Label>
                    <SmartDateInput value={pollCloseDate} onChange={setPollCloseDate} className="mt-1" />
                  </div>
                  <Button
                    type="button"
                    disabled={savingPoll}
                    onClick={handleCreatePoll}
                    className="gold-gradient text-gold-foreground font-semibold gap-1.5 text-xs"
                  >
                    <Vote className="h-3.5 w-3.5" />
                    {savingPoll ? 'Publishing Poll...' : 'Publish Poll'}
                  </Button>
                </div>
              )}

              {polls.length === 0 ? (
                <p className="rounded-xl border border-border/30 bg-muted/15 p-6 text-center text-xs text-muted-foreground">
                  No batch polls created yet.
                </p>
              ) : (
                <div className="space-y-3">
                  {polls.map(poll => {
                    const pollVotes = votesByPoll[poll.id] ?? []
                    const myVote = pollVotes.find(v => v.user_id === user.id)
                    const isExpired = Boolean(
                      poll.closes_at && new Date(poll.closes_at).getTime() < Date.now()
                    )
                    const closed = poll.is_closed || isExpired
                    const totalVotes = pollVotes.length

                    return (
                      <div
                        key={poll.id}
                        className="rounded-xl border border-border/40 bg-muted/15 p-4 space-y-3 text-xs"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="space-y-1">
                            <h3 className="text-sm font-bold text-foreground">{poll.question}</h3>
                            <p className="text-[11px] text-muted-foreground">
                              {totalVotes} vote{totalVotes === 1 ? '' : 's'} cast
                              {poll.closes_at ? ` • Closes ${formatFullDate(poll.closes_at)}` : ''}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant={closed ? 'secondary' : 'default'} className="text-[10px]">
                              {closed ? 'Closed' : 'Open for Voting'}
                            </Badge>
                            {canManageAdmins && (
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => handleToggleClosePoll(poll)}
                                className="h-7 text-[11px]"
                              >
                                {poll.is_closed ? 'Reopen' : 'Close Poll'}
                              </Button>
                            )}
                          </div>
                        </div>

                        <div className="space-y-2">
                          {(poll.options_json ?? []).map((optLabel, idx) => {
                            const count = pollVotes.filter(v => v.option_index === idx).length
                            const pct = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0
                            const isMyChoice = myVote?.option_index === idx

                            return (
                              <button
                                key={idx}
                                type="button"
                                disabled={closed}
                                onClick={() => handleCastVote(poll.id, idx)}
                                className={`w-full text-left rounded-lg border p-2.5 transition-all relative overflow-hidden ${
                                  isMyChoice
                                    ? 'border-emerald-500 bg-emerald-500/10'
                                    : 'border-border/40 bg-background/60 hover:border-primary/40'
                                }`}
                              >
                                <div
                                  style={{ width: `${pct}%` }}
                                  className="absolute inset-y-0 left-0 bg-primary/15 pointer-events-none transition-all"
                                />
                                <div className="relative flex items-center justify-between gap-2">
                                  <span className="font-semibold text-foreground">
                                    {optLabel}{' '}
                                    {isMyChoice && (
                                      <span className="text-emerald-400 font-bold">(Your Vote)</span>
                                    )}
                                  </span>
                                  <span className="font-bold text-primary">
                                    {count} ({pct}%)
                                  </span>
                                </div>
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* SUB-TAB 3: TREASURY — TREASURER ACCOUNT MANAGEMENT & READ-ONLY MEMBER VIEW */}
        {activeSubTab === 'treasury' && (
          <Card className="border-border/40 bg-card/70 backdrop-blur-sm">
            <CardHeader className="pb-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="space-y-1">
                  <CardTitle className="flex items-center gap-2 text-base text-primary">
                    <Wallet className="h-5 w-5" />
                    Association Treasury &amp; Account Statement
                  </CardTitle>
                  <div>
                    {canManageTreasury ? (
                      <Badge className="bg-emerald-600/25 text-emerald-300 border border-emerald-500/40 text-[10px]">
                        Treasurer Account Access Enabled
                      </Badge>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full border border-border/50 bg-muted/40 px-2.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
                        <Eye className="h-3 w-3 text-primary" />
                        View-Only Transparency Ledger (Maintained by Treasurer)
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleExportTreasuryCsv}
                    className="h-8 text-xs gap-1"
                  >
                    <FileSpreadsheet className="h-3.5 w-3.5" />
                    CSV Statement
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handlePrintTreasury}
                    className="h-8 text-xs gap-1"
                  >
                    <Printer className="h-3.5 w-3.5" />
                    Print Statement
                  </Button>
                  {canManageTreasury && (
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => {
                        if (showFundForm) {
                          resetFundForm()
                        } else {
                          resetFundForm()
                          setShowFundForm(true)
                        }
                      }}
                      className="h-8 gold-gradient text-gold-foreground font-semibold gap-1 text-xs"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      {showFundForm ? 'Close Fund Form' : 'New Fund Account'}
                    </Button>
                  )}
                </div>
              </div>
            </CardHeader>

            <CardContent className="space-y-4">
              {/* Overall Treasury Account Summary */}
              <div className="grid grid-cols-3 gap-2.5 rounded-xl border border-primary/30 bg-primary/5 p-3 text-center">
                <div>
                  <p className="text-[11px] text-muted-foreground">Total Funds Received</p>
                  <p className="text-sm sm:text-base font-bold text-emerald-400">
                    ₹{overallFundsReceived.toLocaleString('en-IN')}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] text-muted-foreground">Total Expenses Done</p>
                  <p className="text-sm sm:text-base font-bold text-rose-400">
                    ₹{overallExpensesDone.toLocaleString('en-IN')}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] text-muted-foreground">Net Account Balance</p>
                  <p className="text-sm sm:text-base font-bold text-primary">
                    ₹{overallNetBalance.toLocaleString('en-IN')}
                  </p>
                </div>
              </div>

              {/* Treasurer Only: Create / Edit Fund Account Form */}
              {canManageTreasury && showFundForm && (
                <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 space-y-3 text-xs">
                  <p className="font-bold text-primary">
                    {editingFundId
                      ? 'Edit Association Fund Account'
                      : 'Create Association Fund Account'}
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <Label>Fund Account Title *</Label>
                      <Input
                        value={fundTitle}
                        onChange={e => setFundTitle(e.target.value)}
                        placeholder="e.g., Reunion 2027 / Student Scholarship"
                        className="mt-1 text-xs"
                      />
                    </div>
                    <div>
                      <Label>Category</Label>
                      <select
                        value={fundCategory}
                        onChange={e => setFundCategory(e.target.value)}
                        className="mt-1 w-full h-9 rounded-md border border-border/50 bg-background px-3 text-xs"
                      >
                        <option value="Reunion & Events">Reunion &amp; Events</option>
                        <option value="Student Scholarship">Student Scholarship</option>
                        <option value="Batch Welfare & Support">Batch Welfare &amp; Support</option>
                        <option value="Department Development">Department Development</option>
                        <option value="General Association Fund">General Association Fund</option>
                      </select>
                    </div>
                    <div>
                      <Label>Target Amount (₹)</Label>
                      <Input
                        type="number"
                        min={0}
                        value={fundTarget}
                        onChange={e => setFundTarget(e.target.value)}
                        placeholder="e.g., 100000"
                        className="mt-1 text-xs"
                      />
                    </div>
                  </div>
                  <div>
                    <Label>Account Details / Official UPI ID / Bank Info</Label>
                    <Input
                      value={fundDesc}
                      onChange={e => setFundDesc(e.target.value)}
                      placeholder="Purpose & official association UPI / bank details..."
                      className="mt-1 text-xs"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={resetFundForm}
                      className="text-xs"
                    >
                      Cancel
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      disabled={savingFund}
                      onClick={handleSaveFund}
                      className="gold-gradient text-gold-foreground font-semibold gap-1.5 text-xs"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      {savingFund
                        ? 'Saving...'
                        : editingFundId
                        ? 'Update Fund Account'
                        : 'Create Fund Account'}
                    </Button>
                  </div>
                </div>
              )}

              {funds.length === 0 ? (
                <p className="rounded-xl border border-border/30 bg-muted/15 p-6 text-center text-xs text-muted-foreground">
                  No association fund accounts created yet.
                </p>
              ) : (
                <div className="space-y-4">
                  {funds.map(fund => {
                    const fundTxs = transactions.filter(t => t.fund_id === fund.id)
                    const totalCollected = fundTxs
                      .filter(t => t.entry_type === 'contribution')
                      .reduce((sum, t) => sum + Number(t.amount || 0), 0)
                    const totalExpense = fundTxs
                      .filter(t => t.entry_type === 'expense')
                      .reduce((sum, t) => sum + Number(t.amount || 0), 0)
                    const netBalance = totalCollected - totalExpense
                    const target = Number(fund.target_amount || 0)
                    const pct =
                      target > 0 ? Math.min(100, Math.round((totalCollected / target) * 100)) : 0
                    const isClosed = fund.status === 'closed'

                    return (
                      <div
                        key={fund.id}
                        className="rounded-xl border border-border/40 bg-muted/15 p-4 space-y-3 text-xs"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div className="space-y-0.5">
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="text-sm font-bold text-primary">{fund.title}</h3>
                              <Badge variant="outline" className="text-[10px]">
                                {fund.category}
                              </Badge>
                              {isClosed && (
                                <Badge variant="secondary" className="text-[10px]">
                                  Closed Account
                                </Badge>
                              )}
                            </div>
                            {fund.description && (
                              <p className="text-muted-foreground">{fund.description}</p>
                            )}
                          </div>

                          {/* Treasurer Only Controls */}
                          {canManageTreasury && (
                            <div className="flex flex-wrap items-center gap-1.5">
                              <Button
                                type="button"
                                size="sm"
                                onClick={() => openNewTransactionForm(fund.id, 'contribution')}
                                className="h-7 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold gap-1 text-[11px]"
                              >
                                <ArrowDownLeft className="h-3 w-3" />
                                + Fund Received
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                onClick={() => openNewTransactionForm(fund.id, 'expense')}
                                className="h-7 bg-rose-600 hover:bg-rose-500 text-white font-semibold gap-1 text-[11px]"
                              >
                                <ArrowUpRight className="h-3 w-3" />
                                - Expense Done
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                title="Edit Fund Details"
                                onClick={() => openEditFundForm(fund)}
                                className="h-7 w-7 text-primary hover:bg-primary/10"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => handleToggleFundStatus(fund)}
                                className="h-7 px-2 text-[10px]"
                              >
                                {isClosed ? 'Reopen' : 'Close'}
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                title="Delete Fund Account"
                                onClick={() => handleDeleteFund(fund)}
                                className="h-7 w-7 text-destructive hover:bg-destructive/10"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          )}
                        </div>

                        <div className="grid grid-cols-3 gap-2 rounded-lg border border-border/30 bg-background/60 p-2.5 text-center">
                          <div>
                            <p className="text-[10px] text-muted-foreground">Funds Received</p>
                            <p className="font-bold text-emerald-400">
                              ₹{totalCollected.toLocaleString('en-IN')}
                            </p>
                          </div>
                          <div>
                            <p className="text-[10px] text-muted-foreground">Expenses Done</p>
                            <p className="font-bold text-rose-400">
                              ₹{totalExpense.toLocaleString('en-IN')}
                            </p>
                          </div>
                          <div>
                            <p className="text-[10px] text-muted-foreground">Balance in Hand</p>
                            <p className="font-bold text-primary">
                              ₹{netBalance.toLocaleString('en-IN')}
                            </p>
                          </div>
                        </div>

                        {target > 0 && (
                          <div className="space-y-1">
                            <div className="flex justify-between text-[11px]">
                              <span>Target Progress ({pct}%)</span>
                              <span>
                                ₹{totalCollected.toLocaleString('en-IN')} / ₹
                                {target.toLocaleString('en-IN')}
                              </span>
                            </div>
                            <div className="h-2 w-full rounded-full bg-background overflow-hidden">
                              <div
                                style={{ width: `${pct}%` }}
                                className="h-full gold-gradient transition-all"
                              />
                            </div>
                          </div>
                        )}

                        {/* Treasurer Only: Log or Edit Transaction Form */}
                        {canManageTreasury && selectedFundIdForEntry === fund.id && (
                          <div className="rounded-lg border border-primary/35 bg-primary/5 p-3.5 space-y-2.5">
                            <p className="font-bold text-primary">
                              {editingTxId
                                ? 'Edit Ledger Entry'
                                : entryType === 'contribution'
                                ? 'Log Fund Received (+)'
                                : 'Log Expense Done (-)'}
                            </p>

                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                              <div>
                                <Label className="text-[11px]">Entry Type</Label>
                                <select
                                  value={entryType}
                                  onChange={e =>
                                    setEntryType(e.target.value as 'contribution' | 'expense')
                                  }
                                  className="mt-1 w-full h-8 rounded-md border border-border/50 bg-background px-2 text-xs font-semibold"
                                >
                                  <option value="contribution">Fund Received (+)</option>
                                  <option value="expense">Expense Done (-)</option>
                                </select>
                              </div>

                              <div>
                                <Label className="text-[11px]">Date</Label>
                                <SmartDateInput
                                  value={entryDate}
                                  onChange={setEntryDate}
                                  className="mt-1"
                                />
                              </div>

                              <div>
                                <Label className="text-[11px]">Amount (₹) *</Label>
                                <Input
                                  type="number"
                                  min={1}
                                  value={entryAmount}
                                  onChange={e => setEntryAmount(e.target.value)}
                                  placeholder="Amount in ₹"
                                  className="mt-1 h-8 text-xs font-bold"
                                />
                              </div>
                            </div>

                            {entryType === 'contribution' && (
                              <div>
                                <Label className="text-[11px]">
                                  Select Registered Member (or type external donor below)
                                </Label>
                                <select
                                  value={entryMemberId}
                                  onChange={e => {
                                    const chosenId = e.target.value
                                    setEntryMemberId(chosenId)
                                    const found = membersDirectory.find(
                                      m => String(m.id) === chosenId
                                    )
                                    if (found) setEntryPersonName(found.full_name)
                                  }}
                                  className="mt-1 w-full h-8 rounded-md border border-border/50 bg-background px-2 text-xs"
                                >
                                  <option value="">-- Choose Member from Directory --</option>
                                  {membersDirectory.map(m => (
                                    <option key={m.id} value={String(m.id)}>
                                      {m.full_name}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            )}

                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                              <div>
                                <Label className="text-[11px]">
                                  {entryType === 'contribution'
                                    ? 'Contributor / Donor Name *'
                                    : 'Payee / Vendor Name *'}
                                </Label>
                                <Input
                                  value={entryPersonName}
                                  onChange={e => setEntryPersonName(e.target.value)}
                                  placeholder={
                                    entryType === 'contribution'
                                      ? 'Member or Donor Name'
                                      : 'Vendor / Purpose Payee'
                                  }
                                  className="mt-1 h-8 text-xs"
                                />
                              </div>
                              <div>
                                <Label className="text-[11px]">UPI / Bank / Bill Ref No.</Label>
                                <Input
                                  value={entryRefNo}
                                  onChange={e => setEntryRefNo(e.target.value)}
                                  placeholder="UPI Ref / Receipt #"
                                  className="mt-1 h-8 text-xs"
                                />
                              </div>
                              <div>
                                <Label className="text-[11px]">Particulars / Note</Label>
                                <Input
                                  value={entryNote}
                                  onChange={e => setEntryNote(e.target.value)}
                                  placeholder="e.g., Reunion contribution / Hall advance"
                                  className="mt-1 h-8 text-xs"
                                />
                              </div>
                            </div>

                            <div className="flex gap-2 pt-1">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={resetTransactionForm}
                                className="h-8 text-xs"
                              >
                                Cancel
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                disabled={savingEntry}
                                onClick={() => handleSaveTransaction(fund)}
                                className="h-8 gold-gradient text-gold-foreground font-semibold text-xs"
                              >
                                {savingEntry
                                  ? 'Saving...'
                                  : editingTxId
                                  ? 'Update Entry'
                                  : 'Save to Account Ledger'}
                              </Button>
                            </div>
                          </div>
                        )}

                        {/* Itemized Account Ledger (Visible to all members; Edit/Delete only for Treasurer) */}
                        {fundTxs.length > 0 && (
                          <div className="space-y-1.5 max-h-64 overflow-y-auto pt-1">
                            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                              Account Ledger Entries ({fundTxs.length})
                            </p>
                            {fundTxs.map(tx => (
                              <div
                                key={tx.id}
                                className="flex items-center justify-between gap-2 rounded-lg border border-border/30 bg-background/60 px-3 py-2 text-[11px]"
                              >
                                <div className="min-w-0 space-y-0.5">
                                  <div className="flex flex-wrap items-center gap-1.5">
                                    <span className="font-bold text-foreground">
                                      {tx.person_name}
                                    </span>
                                    <span className="text-[10px] text-muted-foreground">
                                      • {formatFullDate(tx.entry_date)}
                                    </span>
                                    {tx.reference_no && (
                                      <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                                        Ref: {tx.reference_no}
                                      </span>
                                    )}
                                  </div>
                                  {(tx.note || tx.recorded_by_name) && (
                                    <p className="text-[10px] text-muted-foreground truncate">
                                      {tx.note ? `${tx.note} ` : ''}
                                      {tx.recorded_by_name
                                        ? `(Logged by ${tx.recorded_by_name})`
                                        : ''}
                                    </p>
                                  )}
                                </div>

                                <div className="flex items-center gap-1.5 shrink-0">
                                  <span
                                    className={`font-bold text-xs ${
                                      tx.entry_type === 'contribution'
                                        ? 'text-emerald-400'
                                        : 'text-rose-400'
                                    }`}
                                  >
                                    {tx.entry_type === 'contribution' ? '+' : '-'}₹
                                    {Number(tx.amount).toLocaleString('en-IN')}
                                  </span>

                                  {canManageTreasury && (
                                    <>
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        title="Edit Entry"
                                        onClick={() => openEditTransactionForm(tx)}
                                        className="h-6 w-6 text-primary hover:bg-primary/10"
                                      >
                                        <Pencil className="h-3 w-3" />
                                      </Button>
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        title="Delete Entry"
                                        onClick={() => handleDeleteTransaction(tx, fund.title)}
                                        className="h-6 w-6 text-destructive hover:bg-destructive/10"
                                      >
                                        <Trash2 className="h-3 w-3" />
                                      </Button>
                                    </>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* SUB-TAB 4: EXECUTIVE COMMITTEE & ADMIN PRIVILEGES */}
        {activeSubTab === 'committee' && (
          <div className="space-y-4">
            {canManageAdmins && (
              <Card className="border-amber-500/40 bg-amber-500/5 backdrop-blur-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-sm text-amber-300">
                    <ShieldCheck className="h-4 w-4" />
                    Admin Privileges Management (President &amp; General Secretary Authority)
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-xs">
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
                        placeholder="e.g., Association Accounts & Treasury"
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

                {committee.length === 0 ? (
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
          </div>
        )}

        {/* SUB-TAB 5: STUDENT & PEER MENTORSHIP */}
        {activeSubTab === 'mentorship' && (
          <Card className="border-border/40 bg-card/70 backdrop-blur-sm">
            <CardHeader className="pb-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <CardTitle className="flex items-center gap-2 text-base text-primary">
                  <GraduationCap className="h-5 w-5" />
                  Student &amp; Peer Mentorship Initiative
                </CardTitle>
                {mentorships.length > 0 && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleExportMentorshipCsv}
                    className="h-8 text-xs gap-1"
                  >
                    <FileSpreadsheet className="h-3.5 w-3.5" />
                    Export Mentorship CSV
                  </Button>
                )}
              </div>
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
                    placeholder="e.g., Available on weekends for 1-on-1 career calls"
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
                    No registrations in this category yet.
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
        )}

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
