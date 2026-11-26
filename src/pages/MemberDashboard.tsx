import { useState, useEffect, useCallback, useMemo } from 'react'
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { supabase } from '@/lib/supabase'
import {
  fetchUserNotifications,
  clearChatNotifications,
  isChatNotification,
  archiveDailyCelebrationAlert,
  publishArchivedAlert,
} from '@/lib/notificationService'
import { formatFullDate, cleanPhoneNumber } from '@/lib/formatters'
import { getDefaultSpouseGender } from '@/lib/fenestriansCore'
import { exportRowsToCSV, openPrintableReport } from '@/lib/reportExporter'
import { fetchCommitteeRolesMap, resolveMemberAssociationRole } from '@/lib/taskAuditService'
import SmartDateInput from '@/components/shared/SmartDateInput'
import {
  getPersistedExpandedTab,
  toggleExclusiveTab,
  recordPreviousRoute,
  consumePreviousRoute,
} from '@/lib/navigationState'
import {
  Users,
  Image,
  CalendarDays,
  MessageCircle,
  Phone,
  User,
  Settings,
  Wrench,
  LogOut,
  X,
  Crown,
  Building2,
  ListTodo,
  Wallet,
  Siren,
  Briefcase,
  FolderOpen,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  Video,
  Plane,
  HandHeart,
  ArrowLeft,
  Bell,
  Plus,
  CalendarClock,
  ExternalLink,
  FileSpreadsheet,
  Printer,
} from 'lucide-react'
import DirectoryTab from '@/pages/DirectoryTab'
import ProfileTab from '@/pages/ProfileTab'
import MediaArchiveTab from '@/pages/MediaArchiveTab'
import SupportTab from '@/pages/SupportTab'
import CalendarTab from '@/pages/CalendarTab'
import ChatTab from '@/pages/ChatTab'
import CallsTab from '@/pages/CallsTab'
import TasksTab from '@/pages/TasksTab'
import SettingsTab from '@/pages/SettingsTab'
import MaintenanceTab from '@/pages/MaintenanceTab'

type HubSectionKey =
  | 'landing'
  | 'roster'
  | 'emergency'
  | 'alumni'
  | 'activities'
  | 'tasks'
  | 'notifications'
  | 'drive'
  | 'settings_maintenance'

type ActivitySubTab = 'calendar' | 'post_event' | 'city_town' | 'opportunities' | 'communication'
type CommSubTab = 'chat' | 'video' | 'voice' | 'scheduled_calls' | 'external_calls'
type DriveSubTab = 'gallery' | 'folders'

const SCOPE_ROSTER = 'sub_roster'
const SCOPE_EMERGENCY = 'sub_emergency'
const SCOPE_ACTIVITIES = 'sub_activities'
const SCOPE_COMM = 'sub_communication'
const SCOPE_DRIVE = 'sub_drive'
const SCOPE_SETTINGS_MAINT = 'sub_settings_maintenance'
const WA_GROUPS_STORAGE_KEY = 'fenestrians_whatsapp_groups_v1'

interface FamilyMemberOption {
  id: number
  name: string
  relationship: string | null
  gender: string | null
  dob: string | null
}

function resolveHubFromPathname(pathname: string): HubSectionKey {
  switch (pathname) {
    case '/roster':
      return 'roster'
    case '/emergency':
      return 'emergency'
    case '/activities':
      return 'activities'
    case '/tasks':
      return 'tasks'
    case '/notifications':
      return 'notifications'
    case '/drive':
      return 'drive'
    case '/settings-maintenance':
      return 'settings_maintenance'
    default:
      return 'landing'
  }
}

function getTargetSubjectChoices(
  eventType: string,
  maritalStatus?: string | null,
  divorceDate?: string | null
): string[] {
  const isSingleOrDivorced =
    !maritalStatus ||
    ['single', 'unmarried', 'divorced'].includes(maritalStatus.trim().toLowerCase()) ||
    Boolean(divorceDate)

  switch (eventType) {
    case 'Birthday Party':
      return ['Self', 'spouse', 'child', 'Others']
    case 'Anniversary party':
      return ['Self', 'child', 'Others']
    case 'Wedding':
      return isSingleOrDivorced ? ['Self', 'child', 'Others'] : ['child', 'Others']
    case 'House Warming':
      return ['Self', 'child', 'Others']
    case 'child birth':
      return ['Self', 'child', 'Others']
    default:
      return ['Self', 'Others']
  }
}

export default function MemberDashboard() {
  const [searchParams] = useSearchParams()
  const location = useLocation()
  const navigate = useNavigate()
  const { user, logout, isAdmin } = useAuth()

  const [hubSection, setHubSection] = useState<HubSectionKey>(() =>
    resolveHubFromPathname(location.pathname)
  )
  const [alerts, setAlerts] = useState<string[]>([])
  const [notifBadge, setNotifBadge] = useState(0)
  const [chatBadge, setChatBadge] = useState(0)
  const [callsBadge, setCallsBadge] = useState(0)
  const [tasksBadge, setTasksBadge] = useState(0)

  const [eventTitle, setEventTitle] = useState('')
  const [eventType, setEventType] = useState('Birthday Party')
  const [isFullDayEvent, setIsFullDayEvent] = useState(false)
  const [eventStartDate, setEventStartDate] = useState('')
  const [eventStartTime, setEventStartTime] = useState('10:00')
  const [eventEndDate, setEventEndDate] = useState('')
  const [eventEndTime, setEventEndTime] = useState('12:00')
  const [eventDesc, setEventDesc] = useState('')
  const [eventSubject, setEventSubject] = useState('Self')
  const [familyList, setFamilyList] = useState<FamilyMemberOption[]>([])
  const [selectedFamilyId, setSelectedFamilyId] = useState<string>('')
  const [newFamilyName, setNewFamilyName] = useState('')
  const [newFamilyGender, setNewFamilyGender] = useState('')
  const [newFamilyDob, setNewFamilyDob] = useState('')
  const [spouseNameInput, setSpouseNameInput] = useState('')
  const [weddingDateInput, setWeddingDateInput] = useState('')
  const [updateProfilePermission, setUpdateProfilePermission] = useState(true)
  const [isOneTimeEvent, setIsOneTimeEvent] = useState(false)
  const [customAlertDraft, setCustomAlertDraft] = useState('')
  const [alertDraftEdited, setAlertDraftEdited] = useState(false)
  const [postingEvent, setPostingEvent] = useState(false)

  const [waGroupLink, setWaGroupLink] = useState<string>(() => {
    try {
      const saved = localStorage.getItem(WA_GROUPS_STORAGE_KEY)
      if (saved) {
        const parsed = JSON.parse(saved)
        return parsed.mainGroupUrlOrId || ''
      }
    } catch {
      // Ignore
    }
    return ''
  })
  const [gmeetLink, setGmeetLink] = useState('https://meet.google.com/new')
  const [zoomTopic, setZoomTopic] = useState('')
  const [zoomDate, setZoomDate] = useState('')
  const [zoomTime, setZoomTime] = useState('20:00')
  const [zoomLink, setZoomLink] = useState('https://zoom.us/j')

  const [expandedRosterTab, setExpandedRosterTab] = useState<string | null>(() =>
    getPersistedExpandedTab(SCOPE_ROSTER)
  )
  const [expandedEmergencyTab, setExpandedEmergencyTab] = useState<string | null>(() =>
    getPersistedExpandedTab(SCOPE_EMERGENCY)
  )
  const [expandedActivityTab, setExpandedActivityTab] = useState<ActivitySubTab | null>(() =>
    (getPersistedExpandedTab(SCOPE_ACTIVITIES) as ActivitySubTab | null)
  )
  const [expandedCommTab, setExpandedCommTab] = useState<CommSubTab | null>(() =>
    (getPersistedExpandedTab(SCOPE_COMM) as CommSubTab | null)
  )
  const [expandedDriveTab, setExpandedDriveTab] = useState<DriveSubTab | null>(() =>
    (getPersistedExpandedTab(SCOPE_DRIVE) as DriveSubTab | null)
  )
  const [expandedSettingsMaintTab, setExpandedSettingsMaintTab] = useState<string | null>(() =>
    getPersistedExpandedTab(SCOPE_SETTINGS_MAINT)
  )

  const subjectChoices = useMemo(
    () => getTargetSubjectChoices(eventType, user?.marital_status, user?.divorce_date),
    [eventType, user?.marital_status, user?.divorce_date]
  )

  useEffect(() => {
    if (!subjectChoices.includes(eventSubject)) {
      setEventSubject(subjectChoices[0] || 'Self')
    }
  }, [subjectChoices, eventSubject])

  useEffect(() => {
    if (!user) return
    setSpouseNameInput(user.spouse_name || '')
    setWeddingDateInput(user.wedding_date ? String(user.wedding_date).slice(0, 10) : '')
    supabase
      .from('family_members')
      .select('id, name, relationship, gender, dob')
      .eq('alumni_id', user.id)
      .then(({ data }) => {
        if (data) setFamilyList(data as FamilyMemberOption[])
      })
  }, [user])

  const buildSampleEventAlert = useCallback(() => {
    if (!user) return ''
    const titlePart = eventTitle.trim() || `${eventType} (${eventSubject})`
    const timingPart = isFullDayEvent
      ? `Date: ${eventStartDate || 'TBD'}${eventEndDate ? ` to ${eventEndDate}` : ''} (Full Day)`
      : `Start: ${eventStartDate || 'TBD'} ${eventStartTime || ''}${
          eventEndDate ? ` | End: ${eventEndDate} ${eventEndTime || ''}` : ''
        }`

    let personDetail = ''
    if (eventSubject === 'spouse' || eventType === 'Anniversary party' || eventType === 'Wedding') {
      const sp = spouseNameInput.trim() || user.spouse_name || ''
      const wd = weddingDateInput.trim() || (user.wedding_date ? String(user.wedding_date).slice(0, 10) : '')
      const parts = [sp ? `Partner/Spouse: ${sp}` : '', wd ? `Wedding Date: ${wd}` : ''].filter(Boolean)
      if (parts.length > 0) personDetail = `\nDetails: ${parts.join(' • ')}`
    } else if (eventSubject === 'child' || eventType === 'child birth') {
      const chosenFam = familyList.find(f => String(f.id) === selectedFamilyId)
      const childName =
        selectedFamilyId === 'other'
          ? newFamilyName.trim()
          : chosenFam?.name || newFamilyName.trim()
      const childDob =
        selectedFamilyId === 'other'
          ? newFamilyDob.trim()
          : chosenFam?.dob
          ? String(chosenFam.dob).slice(0, 10)
          : newFamilyDob.trim()
      const childGender =
        selectedFamilyId === 'other' ? newFamilyGender.trim() : chosenFam?.gender || newFamilyGender.trim()
      const parts = [
        childName ? `Name: ${childName}` : '',
        childGender ? `Gender: ${childGender}` : '',
        childDob ? `DOB: ${childDob}` : '',
      ].filter(Boolean)
      if (parts.length > 0) personDetail = `\nDetails: ${parts.join(' • ')}`
    }

    const descPart = eventDesc.trim() ? `\nNotes: ${eventDesc.trim()}` : ''
    return `Event Invite (${eventType}): ${titlePart}\nPosted by: ${user.full_name}\n${timingPart}${personDetail}${descPart}`
  }, [
    user,
    eventTitle,
    eventType,
    eventSubject,
    isFullDayEvent,
    eventStartDate,
    eventStartTime,
    eventEndDate,
    eventEndTime,
    spouseNameInput,
    weddingDateInput,
    familyList,
    selectedFamilyId,
    newFamilyName,
    newFamilyGender,
    newFamilyDob,
    eventDesc,
  ])

  useEffect(() => {
    if (!alertDraftEdited) {
      setCustomAlertDraft(buildSampleEventAlert())
    }
  }, [buildSampleEventAlert, alertDraftEdited])

  const syncHeaderBadges = useCallback(async () => {
    if (!user || user.is_placeholder) return
    const [list, pendingTasksRes] = await Promise.all([
      fetchUserNotifications(user.id),
      supabase
        .from('member_tasks')
        .select('id', { count: 'exact', head: true })
        .eq('assigned_to_user_id', user.id)
        .eq('status', 'pending'),
    ])
    const unread = list.filter(i => i.status === 'unread')

    let unreadTotal = 0
    let chats = 0
    let calls = 0

    for (const item of unread) {
      const cnt = item.unread_count || 1
      unreadTotal += cnt
      if (isChatNotification(item.category)) {
        chats += cnt
      } else if (item.category === 'group_call' || item.category === 'video_call') {
        calls += cnt
      }
    }

    setNotifBadge(unreadTotal)
    setChatBadge(chats)
    setCallsBadge(calls)
    setTasksBadge(pendingTasksRes.count || 0)
  }, [user])

  useEffect(() => {
    const nextHub = resolveHubFromPathname(location.pathname)
    setHubSection(nextHub)

    const rawTab = searchParams.get('tab')
    const viewParam = searchParams.get('view')

    if (rawTab) {
      if (rawTab === 'profile') {
        setHubSection('roster')
        setExpandedRosterTab('my_profile')
      } else if (rawTab === 'support') {
        setHubSection('emergency')
        setExpandedEmergencyTab(viewParam === 'opportunities' ? 'opportunities' : 'family_support')
      } else if (rawTab === 'calendar') {
        setHubSection('activities')
        setExpandedActivityTab('calendar')
      } else if (rawTab === 'tasks') {
        setHubSection('tasks')
      } else if (rawTab === 'chat') {
        setHubSection('activities')
        setExpandedActivityTab('communication')
        setExpandedCommTab('chat')
      } else if (rawTab === 'video' || rawTab === 'calls' || rawTab === 'voice') {
        setHubSection('activities')
        setExpandedActivityTab('communication')
        setExpandedCommTab(rawTab === 'voice' ? 'voice' : 'video')
      } else if (rawTab === 'gallery' || rawTab === 'folder' || rawTab === 'media') {
        setHubSection('drive')
        setExpandedDriveTab(rawTab === 'folder' ? 'folders' : 'gallery')
      } else if (rawTab === 'settings') {
        setHubSection('settings_maintenance')
        setExpandedSettingsMaintTab('common_settings')
      } else if (rawTab === 'maintenance') {
        setHubSection('settings_maintenance')
        setExpandedSettingsMaintTab('admin_maintenance')
      } else if (rawTab === 'directory') {
        setHubSection('roster')
        setExpandedRosterTab('directory')
      }
    } else {
      setExpandedRosterTab(getPersistedExpandedTab(SCOPE_ROSTER))
      setExpandedEmergencyTab(getPersistedExpandedTab(SCOPE_EMERGENCY))
      setExpandedActivityTab(getPersistedExpandedTab(SCOPE_ACTIVITIES) as ActivitySubTab | null)
      setExpandedCommTab(getPersistedExpandedTab(SCOPE_COMM) as CommSubTab | null)
      setExpandedDriveTab(getPersistedExpandedTab(SCOPE_DRIVE) as DriveSubTab | null)
      setExpandedSettingsMaintTab(getPersistedExpandedTab(SCOPE_SETTINGS_MAINT))
    }

    const dmId = searchParams.get('dmId')
    const dmName = searchParams.get('dmName')
    if (dmId && dmName) {
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('open-dm', { detail: { id: Number(dmId), name: dmName } }))
      }, 150)
    }

    const roomName = searchParams.get('roomName')
    if (roomName) {
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('join-video', { detail: { roomName } }))
      }, 150)
    }
  }, [location.pathname, searchParams])

  useEffect(() => {
    if (!user) {
      navigate('/')
      return
    }
    triggerAlerts()
    syncHeaderBadges()

    const channel = supabase
      .channel(`live-header-badges-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_notifications',
          filter: `user_id=eq.${user.id}`,
        },
        payload => {
          syncHeaderBadges()
          if (payload.eventType === 'INSERT') {
            const row = payload.new as any
            if (row?.category === 'group_call' || row?.category === 'video_call') {
              setAlerts(prev =>
                prev.includes(row.full_message) ? prev : [row.full_message, ...prev]
              )
            }
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'member_tasks',
          filter: `assigned_to_user_id=eq.${user.id}`,
        },
        () => {
          syncHeaderBadges()
        }
      )
      .subscribe()

    window.addEventListener('fenestrians-notifications-updated', syncHeaderBadges)
    return () => {
      supabase.removeChannel(channel)
      window.removeEventListener('fenestrians-notifications-updated', syncHeaderBadges)
    }
  }, [user, navigate, syncHeaderBadges])

  const triggerAlerts = async () => {
    if (!user) return
    const { data: users } = await supabase.from('alumni').select('*').eq('is_placeholder', false)
    if (!users) return

    const today = new Date()
    const currentDay = today.getDate()
    const currentMonth = today.getMonth()
    const datestampTodayStr = `${today.getFullYear()}-${String(currentMonth + 1).padStart(2, '0')}-${String(currentDay).padStart(2, '0')}`
    const fullTodayDisplay = formatFullDate(datestampTodayStr)

    const celebrations: Array<{
      text: string
      category: 'birthday' | 'anniversary'
      shortTitle: string
    }> = []

    users.forEach(u => {
      if (u.dob && new Date(u.dob).getDate() === currentDay && new Date(u.dob).getMonth() === currentMonth) {
        celebrations.push({
          text: `Today (${fullTodayDisplay}) is ${u.full_name}'s Birthday!`,
          category: 'birthday',
          shortTitle: 'Birthday alert',
        })
      }
      const isDivorced = u.marital_status?.toLowerCase() === 'divorced' || Boolean(u.divorce_date)
      if (
        !isDivorced &&
        u.wedding_date &&
        new Date(u.wedding_date).getDate() === currentDay &&
        new Date(u.wedding_date).getMonth() === currentMonth
      ) {
        celebrations.push({
          text: `Happy Anniversary to ${u.full_name}! (${fullTodayDisplay})`,
          category: 'anniversary',
          shortTitle: 'Anniversary alert',
        })
      }
    })

    setAlerts(celebrations.map(c => c.text))

    for (const celeb of celebrations) {
      const uniqueTrace = `[AUTO-ALERT:${datestampTodayStr}]: ${celeb.text}`
      const { data: m } = await supabase
        .from('chat_messages')
        .select('id')
        .eq('room_id', 'global')
        .eq('message_text', uniqueTrace)
        .limit(1)
      if (!m || m.length === 0) {
        await supabase
          .from('chat_messages')
          .insert([{ room_id: 'global', sender_id: 0, sender_name: '🛡️ System Bot', message_text: uniqueTrace }])
      }

      await archiveDailyCelebrationAlert({
        category: celeb.category,
        shortTitle: celeb.shortTitle,
        fullMessage: celeb.text,
        dateKey: datestampTodayStr,
      })
    }

    syncHeaderBadges()
  }

  const handleQuickDirectoryExport = async (e: React.MouseEvent) => {
    e.stopPropagation()
    const [usersRes, rolesMap] = await Promise.all([
      supabase
        .from('alumni')
        .select('*')
        .eq('is_placeholder', false)
        .eq('hide_from_peers', false)
        .neq('full_name', 'System Administrator')
        .order('full_name', { ascending: true }),
      fetchCommitteeRolesMap(),
    ])
    const list = usersRes.data ?? []
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
    const rows = list.map((m: any) => [
      m.full_name,
      resolveMemberAssociationRole({ userId: m.id, isAdmin: m.is_admin, committeeRolesMap: rolesMap }).label,
      m.class_nickname || '-',
      m.blood_group || '-',
      cleanPhoneNumber(m.contact_number) || '-',
      cleanPhoneNumber(m.whatsapp_number) || '-',
      m.email || '-',
      m.current_status || '-',
      m.current_address || '-',
    ])
    exportRowsToCSV(`Fenestrians_Directory_${new Date().toISOString().slice(0, 10)}.csv`, headers, rows)
  }

  const handleQuickDirectoryPrint = async (e: React.MouseEvent) => {
    e.stopPropagation()
    const [usersRes, rolesMap] = await Promise.all([
      supabase
        .from('alumni')
        .select('*')
        .eq('is_placeholder', false)
        .eq('hide_from_peers', false)
        .neq('full_name', 'System Administrator')
        .order('full_name', { ascending: true }),
      fetchCommitteeRolesMap(),
    ])
    const list = usersRes.data ?? []
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
    const rows = list.map((m: any) => [
      m.full_name,
      resolveMemberAssociationRole({ userId: m.id, isAdmin: m.is_admin, committeeRolesMap: rolesMap }).label,
      m.class_nickname || '-',
      m.blood_group || '-',
      cleanPhoneNumber(m.contact_number) || '-',
      cleanPhoneNumber(m.whatsapp_number) || '-',
      m.email || '-',
      m.current_status || '-',
      m.current_address || '-',
    ])
    openPrintableReport('Member & Emergency Donor Directory', `Total Listed: ${list.length} member(s)`, headers, rows)
  }

  const handleCreateClassEvent = async () => {
    if (!user || !eventTitle.trim() || !eventStartDate) {
      alert('Please enter Event Title and Start Date.')
      return
    }
    setPostingEvent(true)

    const roomTag =
      eventType === 'Online Meeting'
        ? 'Meeting-' + eventTitle.trim().replace(/[^a-zA-Z0-9]/g, '-')
        : null

    const finalAlertText = (customAlertDraft || buildSampleEventAlert()).trim()
    const fullDescWithTiming = [
      finalAlertText,
      !isFullDayEvent && eventStartTime ? `Start Time: ${eventStartTime}` : '',
      eventEndDate ? `End Date: ${eventEndDate}${!isFullDayEvent && eventEndTime ? ` ${eventEndTime}` : ''}` : '',
      isOneTimeEvent ? 'One-Time Event (This Year)' : 'Annual / Recurring Profile Event',
    ]
      .filter(Boolean)
      .join('\n')

    await supabase.from('calendar_events').insert([
      {
        title: eventTitle.trim(),
        classification: eventType,
        start_date: eventStartDate,
        description: fullDescWithTiming,
        room_tag: roomTag,
        created_by: user.id,
      },
    ])

    if (updateProfilePermission) {
      if (eventType === 'Birthday Party' && eventSubject === 'Self' && /^\d{4}-\d{2}-\d{2}$/.test(eventStartDate)) {
        await supabase.from('alumni').update({ dob: eventStartDate }).eq('id', user.id)
      }
      if ((eventType === 'Anniversary party' || eventType === 'Wedding') && /^\d{4}-\d{2}-\d{2}$/.test(weddingDateInput)) {
        const profileUpdates: Record<string, any> = { wedding_date: weddingDateInput }
        if (spouseNameInput.trim()) profileUpdates.spouse_name = spouseNameInput.trim()
        await supabase.from('alumni').update(profileUpdates).eq('id', user.id)
      }
      if (eventSubject === 'child' || eventType === 'child birth') {
        const nameToUse =
          selectedFamilyId === 'other'
            ? newFamilyName.trim()
            : familyList.find(f => String(f.id) === selectedFamilyId)?.name || newFamilyName.trim()
        const dobToUse =
          selectedFamilyId === 'other'
            ? newFamilyDob.trim()
            : /^\d{4}-\d{2}-\d{2}$/.test(eventStartDate)
            ? eventStartDate
            : newFamilyDob.trim()
        if (nameToUse && selectedFamilyId === 'other') {
          await supabase.from('family_members').insert([
            {
              alumni_id: user.id,
              name: nameToUse,
              relationship: newFamilyGender.trim().toLowerCase() === 'female' ? 'Daughter' : 'Son',
              gender: newFamilyGender.trim() || null,
              dob: /^\d{4}-\d{2}-\d{2}$/.test(dobToUse) ? dobToUse : null,
              is_private: false,
            },
          ])
        }
      }
    }

    await supabase.from('chat_messages').insert([
      {
        room_id: 'global',
        sender_id: 0,
        sender_name: '🛡️ System Bot',
        message_text: `🎟️ EVENT ALERT:\n${finalAlertText}`,
      },
    ])

    await publishArchivedAlert({
      category: 'event',
      shortTitle: `Event: ${eventType}`,
      fullMessage: finalAlertText,
    })

    setPostingEvent(false)
    setEventTitle('')
    setEventStartDate('')
    setEventEndDate('')
    setEventDesc('')
    setNewFamilyName('')
    setNewFamilyGender('')
    setNewFamilyDob('')
    setAlertDraftEdited(false)
    alert('Event posted to calendar, chat, and notifications!')
  }

  const openMainTabPage = (tabId: string) => {
    const currentFull = `${location.pathname}${location.search}`
    if (tabId === 'landing') {
      navigate('/dashboard')
      return
    }
    if (tabId === 'admin_dashboard') {
      recordPreviousRoute(currentFull)
      navigate('/admin-dashboard')
      return
    }
    if (tabId === 'roster') {
      recordPreviousRoute(currentFull)
      navigate('/roster')
      return
    }
    if (tabId === 'emergency') {
      recordPreviousRoute(currentFull)
      navigate('/emergency')
      return
    }
    if (tabId === 'alumni') {
      recordPreviousRoute(currentFull)
      navigate('/alumni-association')
      return
    }
    if (tabId === 'treasury') {
      recordPreviousRoute(currentFull)
      navigate('/treasury')
      return
    }
    if (tabId === 'activities') {
      recordPreviousRoute(currentFull)
      navigate('/activities')
      return
    }
    if (tabId === 'tasks') {
      recordPreviousRoute(currentFull)
      navigate('/tasks')
      return
    }
    if (tabId === 'notifications') {
      recordPreviousRoute(currentFull)
      navigate('/notifications')
      return
    }
    if (tabId === 'drive') {
      recordPreviousRoute(currentFull)
      navigate('/drive')
      return
    }
    if (tabId === 'settings_maintenance') {
      recordPreviousRoute(currentFull)
      navigate('/settings-maintenance')
    }
  }

  const handleCloseCurrentSubPage = async () => {
    if (user && expandedCommTab === 'chat') {
      await clearChatNotifications(user.id)
      setChatBadge(0)
      window.dispatchEvent(new Event('fenestrians-notifications-updated'))
    }
    const prev = consumePreviousRoute('/dashboard')
    navigate(prev)
  }

  const handleLogout = () => {
    logout()
    navigate('/')
  }

  if (!user) return null

  const userIsAdmin = Boolean(isAdmin || user.is_admin)
  const totalCommBadge = chatBadge + callsBadge

  const mainHubTabs: Array<{
    id: string
    label: string
    description: string
    icon: any
    badge?: number
    adminOnly?: boolean
  }> = [
    {
      id: 'roster',
      label: 'Roster',
      description: 'Member Directory & My Profile',
      icon: Users,
    },
    {
      id: 'emergency',
      label: 'Emergency',
      description: 'Blood Donor SOS & Family Support Requests',
      icon: Siren,
    },
    {
      id: 'alumni',
      label: 'Alumni Association',
      description: 'Committee, Meetings, Polls, Mentorship & Treasury',
      icon: Building2,
    },
    {
      id: 'activities',
      label: 'Activities',
      description: 'Calendar, Post an Event, City Map / In Town, Jobs & Comms',
      icon: CalendarDays,
      badge: totalCommBadge,
    },
    {
      id: 'tasks',
      label: 'Tasks and Action Items',
      description: 'Unfinished personal tasks & action checklists',
      icon: ListTodo,
      badge: tasksBadge,
    },
    {
      id: 'notifications',
      label: 'Notification Center',
      description: 'Unread alerts, messages, calls & task reminders',
      icon: Bell,
      badge: notifBadge,
    },
    {
      id: 'drive',
      label: 'Drive',
      description: 'Photo Gallery & Member Folders',
      icon: FolderOpen,
    },
    {
      id: 'settings_maintenance',
      label: 'Settings/Maintenance',
      description: 'Member Settings, Admin Privileges & Maintenance',
      icon: Settings,
    },
    ...(userIsAdmin
      ? [
          {
            id: 'admin_dashboard',
            label: 'Admin Dashboard',
            description: 'Roster Slots, Passcodes, Profile Audits & Maintenance',
            icon: Crown,
            adminOnly: true,
          },
        ]
      : []),
  ]

  const renderAccordionToggle = (
    title: string,
    subtitle: string,
    isOpen: boolean,
    onClick: () => void,
    icon: React.ReactNode,
    badgeCount?: number,
    rightActions?: React.ReactNode
  ) => (
    <div
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={e => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onClick()
        }
      }}
      className={`flex w-full cursor-pointer items-center justify-between gap-3 rounded-xl border p-3.5 text-left transition-all ${
        isOpen
          ? 'border-primary/60 bg-primary/10 shadow-sm'
          : 'border-border/40 bg-card/75 hover:border-primary/40 hover:bg-primary/5'
      }`}
    >
      <div className="flex items-start gap-3 min-w-0 flex-1">
        <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-primary/35 bg-primary/10 text-primary">
          {icon}
        </div>
        <div className="min-w-0 flex-1 space-y-0.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-bold text-foreground leading-snug break-words">{title}</span>
            {badgeCount && badgeCount > 0 ? (
              <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1.5 text-[10px] font-bold text-white">
                {badgeCount}
              </span>
            ) : null}
          </div>
          <p className="text-[11px] text-muted-foreground leading-snug break-words">{subtitle}</p>
        </div>
      </div>

      <div className="flex items-center gap-1.5 shrink-0">
        {rightActions}
        {isOpen ? (
          <ChevronUp className="h-4 w-4 text-primary shrink-0" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
        )}
      </div>
    </div>
  )

  return (
    <div className="flex min-h-svh flex-col bg-background pt-14 pb-28 overflow-x-hidden">
      <header className="fixed top-0 left-0 right-0 z-40 border-b border-border/50 bg-card/80 backdrop-blur-xl shadow-lg shadow-black/10">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-4 py-2.5">
          <button
            type="button"
            onClick={() => openMainTabPage('landing')}
            className="flex shrink-0 items-center gap-2.5 text-left"
            title="Fenestrians Dashboard"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-lg gold-border bg-background/50 p-0.5 shadow-md">
              <img src="/icon.png" alt="Fenestrians Logo" className="h-full w-full rounded-md object-contain" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-primary leading-tight">Fenestrians</h1>
              <p className="text-[10px] text-muted-foreground">Exclusive Network</p>
            </div>
          </button>

          <div className="flex items-center gap-1.5 overflow-x-auto">
            {hubSection !== 'landing' && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={handleCloseCurrentSubPage}
                className="h-8 gap-1.5 px-2.5 text-xs border-primary/40 text-primary hover:bg-primary/10 shrink-0"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                <span>Back</span>
              </Button>
            )}

            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => openMainTabPage('notifications')}
              className="relative h-8 gap-1 px-2.5 text-xs border-primary/40 text-primary hover:bg-primary/10 shrink-0"
              title="Notification Center"
            >
              <Bell className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Alerts</span>
              {notifBadge > 0 && (
                <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white">
                  {notifBadge}
                </span>
              )}
            </Button>

            <Button
              size="sm"
              title="Log Out"
              variant="ghost"
              className="shrink-0 h-8 gap-1.5 px-2.5 text-xs text-destructive/80 hover:text-destructive hover:bg-destructive/10"
              onClick={handleLogout}
            >
              <LogOut className="h-3.5 w-3.5" />
              <span className="hidden md:inline">Log Out</span>
            </Button>
          </div>
        </div>
      </header>

      {alerts.length > 0 && (
        <div className="mx-auto w-full max-w-5xl space-y-1.5 px-4 pt-3">
          {alerts.map((a, i) => (
            <div
              key={i}
              className="flex items-center justify-between rounded-lg gold-border bg-primary/5 px-4 py-2.5 text-xs shadow-sm"
            >
              <span className="flex items-center gap-2 text-primary font-medium">
                <Crown className="h-3.5 w-3.5" />
                {a}
              </span>
              <Button
                variant="ghost"
                size="sm"
                title="Dismiss Alert"
                className="h-5 w-5 p-0 text-muted-foreground hover:text-foreground"
                onClick={() => setAlerts(prev => prev.filter((_, idx) => idx !== i))}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </div>
      )}

      <main className="flex-1 p-4 sm:p-6">
        <div className="mx-auto max-w-5xl space-y-4">
          {hubSection === 'landing' && (
            <div className="space-y-5">
              <Card className="border-primary/40 bg-card/80 backdrop-blur-md shadow-xl">
                <CardContent className="p-6 text-center space-y-2">
                  <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl gold-border bg-background/70 p-1.5 shadow-lg">
                    <img
                      src="/icon.png"
                      alt="Fenestrians Logo"
                      className="h-full w-full rounded-xl object-contain"
                    />
                  </div>
                  <h2 className="text-xl sm:text-2xl font-bold text-primary">
                    Fenestrians Dashboard
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    Welcome, <strong className="text-foreground">{user.full_name}</strong> • Select a main section below
                  </p>
                </CardContent>
              </Card>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {mainHubTabs.map(tab => {
                  const Icon = tab.icon
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => openMainTabPage(tab.id)}
                      className={`group relative flex items-start justify-between gap-3 rounded-2xl border p-4 text-left shadow-md transition-all ${
                        tab.adminOnly
                          ? 'border-amber-500/45 bg-amber-500/5 hover:border-amber-400 hover:bg-amber-500/15'
                          : 'border-border/50 bg-card/75 hover:border-primary/60 hover:bg-primary/10'
                      }`}
                    >
                      <div className="flex items-start gap-3 min-w-0 flex-1">
                        <div
                          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border group-hover:scale-105 transition-transform ${
                            tab.adminOnly
                              ? 'border-amber-500/40 bg-amber-500/15 text-amber-300'
                              : 'border-primary/35 bg-primary/10 text-primary'
                          }`}
                        >
                          <Icon className="h-5 w-5" />
                        </div>
                        <div className="min-w-0 flex-1 space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span
                              className={`text-sm font-bold leading-snug break-words transition-colors ${
                                tab.adminOnly
                                  ? 'text-amber-300 group-hover:text-amber-200'
                                  : 'text-foreground group-hover:text-primary'
                              }`}
                            >
                              {tab.label}
                            </span>
                            {tab.badge && tab.badge > 0 ? (
                              <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1.5 text-[10px] font-bold text-white">
                                {tab.badge}
                              </span>
                            ) : null}
                          </div>
                          <p className="text-[11px] text-muted-foreground leading-snug break-words">
                            {tab.description}
                          </p>
                        </div>
                      </div>
                      <ChevronRight
                        className={`h-4 w-4 shrink-0 mt-1 ${
                          tab.adminOnly
                            ? 'text-amber-400/80 group-hover:text-amber-300'
                            : 'text-muted-foreground group-hover:text-primary'
                        }`}
                      />
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {hubSection === 'roster' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-primary flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Roster
                </h2>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleCloseCurrentSubPage}
                  className="text-xs gap-1"
                >
                  <X className="h-3.5 w-3.5" />
                  Close Page
                </Button>
              </div>

              {renderAccordionToggle(
                'Member Directory',
                'Browse classmates, blood donors, filters & quick actions',
                expandedRosterTab === 'directory',
                () =>
                  setExpandedRosterTab(
                    toggleExclusiveTab(SCOPE_ROSTER, expandedRosterTab, 'directory')
                  ),
                <Users className="h-4 w-4" />,
                undefined,
                <>
                  <button
                    type="button"
                    title="Export CSV Roster"
                    onClick={handleQuickDirectoryExport}
                    className="flex h-7 w-7 items-center justify-center rounded-md border border-primary/35 bg-background/80 text-primary hover:bg-primary/15"
                  >
                    <FileSpreadsheet className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    title="Print Roster / Donors"
                    onClick={handleQuickDirectoryPrint}
                    className="flex h-7 w-7 items-center justify-center rounded-md border border-primary/35 bg-background/80 text-primary hover:bg-primary/15"
                  >
                    <Printer className="h-3.5 w-3.5" />
                  </button>
                </>
              )}
              {expandedRosterTab === 'directory' && (
                <div className="pt-1">
                  <DirectoryTab
                    mode="directory"
                    onStartDM={(id, name) => {
                      recordPreviousRoute('/roster')
                      navigate(`/activities?tab=chat&dmId=${id}&dmName=${encodeURIComponent(name)}`)
                    }}
                    onStartVideoCall={roomName => {
                      recordPreviousRoute('/roster')
                      navigate(`/activities?tab=calls&roomName=${encodeURIComponent(roomName)}`)
                    }}
                  />
                </div>
              )}

              {renderAccordionToggle(
                'My Profile',
                'View or update your profile, family details, photo & privacy',
                expandedRosterTab === 'my_profile',
                () =>
                  setExpandedRosterTab(
                    toggleExclusiveTab(SCOPE_ROSTER, expandedRosterTab, 'my_profile')
                  ),
                <User className="h-4 w-4" />
              )}
              {expandedRosterTab === 'my_profile' && (
                <div className="pt-1">
                  <ProfileTab />
                </div>
              )}
            </div>
          )}

          {hubSection === 'emergency' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-primary flex items-center gap-2">
                  <Siren className="h-5 w-5 text-red-400" />
                  Emergency &amp; Support
                </h2>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleCloseCurrentSubPage}
                  className="text-xs gap-1"
                >
                  <X className="h-3.5 w-3.5" />
                  Close Page
                </Button>
              </div>

              {renderAccordionToggle(
                'Emergency Blood Donor SOS',
                'Find matching blood donors and dispatch instant SOS alerts',
                expandedEmergencyTab === 'blood_sos',
                () =>
                  setExpandedEmergencyTab(
                    toggleExclusiveTab(SCOPE_EMERGENCY, expandedEmergencyTab, 'blood_sos')
                  ),
                <Siren className="h-4 w-4 text-red-400" />
              )}
              {expandedEmergencyTab === 'blood_sos' && (
                <div className="pt-1">
                  <DirectoryTab
                    mode="sos"
                    onStartDM={(id, name) => {
                      recordPreviousRoute('/emergency')
                      navigate(`/activities?tab=chat&dmId=${id}&dmName=${encodeURIComponent(name)}`)
                    }}
                    onStartVideoCall={roomName => {
                      recordPreviousRoute('/emergency')
                      navigate(`/activities?tab=calls&roomName=${encodeURIComponent(roomName)}`)
                    }}
                  />
                </div>
              )}

              {renderAccordionToggle(
                'Family Support Requests Page',
                'View or post family medical, educational & emergency support requests',
                expandedEmergencyTab === 'family_support',
                () =>
                  setExpandedEmergencyTab(
                    toggleExclusiveTab(SCOPE_EMERGENCY, expandedEmergencyTab, 'family_support')
                  ),
                <HandHeart className="h-4 w-4" />
              )}
              {expandedEmergencyTab === 'family_support' && (
                <div className="pt-1">
                  <SupportTab mode="support" />
                </div>
              )}
            </div>
          )}

          {hubSection === 'tasks' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-primary flex items-center gap-2">
                  <ListTodo className="h-5 w-5" />
                  Tasks and Action Items
                  {tasksBadge > 0 && (
                    <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1.5 text-[11px] font-bold text-white">
                      {tasksBadge}
                    </span>
                  )}
                </h2>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleCloseCurrentSubPage}
                  className="text-xs gap-1"
                >
                  <X className="h-3.5 w-3.5" />
                  Close Page
                </Button>
              </div>
              <TasksTab />
            </div>
          )}

          {hubSection === 'activities' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-primary flex items-center gap-2">
                  <CalendarDays className="h-5 w-5" />
                  Activities
                </h2>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleCloseCurrentSubPage}
                  className="text-xs gap-1"
                >
                  <X className="h-3.5 w-3.5" />
                  Close Page
                </Button>
              </div>

              {renderAccordionToggle(
                'Alumni / Class Calendar',
                'Birthdays, anniversaries, meetings & class schedules',
                expandedActivityTab === 'calendar',
                () =>
                  setExpandedActivityTab(
                    toggleExclusiveTab(SCOPE_ACTIVITIES, expandedActivityTab, 'calendar') as ActivitySubTab | null
                  ),
                <CalendarDays className="h-4 w-4" />
              )}
              {expandedActivityTab === 'calendar' && (
                <div className="pt-1">
                  <CalendarTab
                    onJoinCall={roomName => {
                      recordPreviousRoute('/activities')
                      navigate(`/activities?tab=calls&roomName=${encodeURIComponent(roomName)}`)
                    }}
                  />
                </div>
              )}

              {renderAccordionToggle(
                'Post an Event',
                'Post party, birthday, anniversary, wedding, house warming, child birth or meeting',
                expandedActivityTab === 'post_event',
                () =>
                  setExpandedActivityTab(
                    toggleExclusiveTab(SCOPE_ACTIVITIES, expandedActivityTab, 'post_event') as ActivitySubTab | null
                  ),
                <Plus className="h-4 w-4" />
              )}
              {expandedActivityTab === 'post_event' && (
                <div className="pt-1">
                  <Card className="border-border/40 bg-card/60 backdrop-blur-sm">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-base text-primary">
                        <Plus className="h-5 w-5" />
                        Post an Event
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3 text-xs">
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <div>
                          <Label className="text-xs">Title *</Label>
                          <Input
                            value={eventTitle}
                            onChange={e => setEventTitle(e.target.value)}
                            placeholder="Event title"
                            className="mt-1 text-xs"
                          />
                        </div>
                        <div>
                          <Label className="text-xs">Type</Label>
                          <select
                            className="mt-1 w-full h-9 rounded-md border border-border/50 bg-background px-3 text-xs"
                            value={eventType}
                            onChange={e => setEventType(e.target.value)}
                          >
                            <option value="Family Party/Event">Family Party/Event</option>
                            <option value="Anniversary party">Anniversary party</option>
                            <option value="Birthday Party">Birthday Party</option>
                            <option value="Wedding">Wedding</option>
                            <option value="House Warming">House Warming</option>
                            <option value="child birth">child birth</option>
                            <option value="Online Meeting">Online Meeting</option>
                            <option value="Reunion">Reunion</option>
                            <option value="Memorial">Memorial</option>
                            <option value="Other">Other</option>
                          </select>
                        </div>

                        <div>
                          <Label className="text-xs">For Whom</Label>
                          <select
                            className="mt-1 w-full h-9 rounded-md border border-border/50 bg-background px-3 text-xs"
                            value={eventSubject}
                            onChange={e => setEventSubject(e.target.value)}
                          >
                            {subjectChoices.map(ch => (
                              <option key={ch} value={ch}>
                                {ch}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="flex items-center gap-2 pt-5">
                          <Checkbox
                            id="full-day-event"
                            checked={isFullDayEvent}
                            onCheckedChange={v => setIsFullDayEvent(Boolean(v))}
                          />
                          <Label htmlFor="full-day-event" className="text-xs cursor-pointer">
                            Full Day Event
                          </Label>
                        </div>

                        <div>
                          <Label className="text-xs">Start Date *</Label>
                          <SmartDateInput
                            value={eventStartDate}
                            onChange={setEventStartDate}
                            className="mt-1"
                          />
                        </div>

                        {!isFullDayEvent && (
                          <div>
                            <Label className="text-xs">Start Time</Label>
                            <Input
                              type="time"
                              value={eventStartTime}
                              onChange={e => setEventStartTime(e.target.value)}
                              className="mt-1 text-xs"
                            />
                          </div>
                        )}

                        <div>
                          <Label className="text-xs">End Date (Optional)</Label>
                          <SmartDateInput
                            value={eventEndDate}
                            onChange={setEventEndDate}
                            className="mt-1"
                          />
                        </div>

                        {!isFullDayEvent && (
                          <div>
                            <Label className="text-xs">End Time</Label>
                            <Input
                              type="time"
                              value={eventEndTime}
                              onChange={e => setEventEndTime(e.target.value)}
                              className="mt-1 text-xs"
                            />
                          </div>
                        )}
                      </div>

                      {(eventSubject === 'spouse' ||
                        eventType === 'Anniversary party' ||
                        eventType === 'Wedding') && (
                        <div className="rounded-xl border border-border/40 bg-background/60 p-3 space-y-2">
                          <p className="font-semibold text-primary">
                            Optional Spouse / Wedding Details (for Profile &amp; Alert)
                          </p>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <Input
                              value={spouseNameInput}
                              onChange={e => setSpouseNameInput(e.target.value)}
                              placeholder={
                                getDefaultSpouseGender(user.gender) === 'Female'
                                  ? 'Wife Name (Optional)'
                                  : getDefaultSpouseGender(user.gender) === 'Male'
                                  ? 'Husband Name (Optional)'
                                  : 'Spouse Name (Optional)'
                              }
                              className="text-xs"
                            />
                            <SmartDateInput
                              value={weddingDateInput}
                              onChange={setWeddingDateInput}
                              placeholder="Actual Wedding Date (YYYY-MM-DD)"
                            />
                          </div>
                        </div>
                      )}

                      {(eventSubject === 'child' || eventType === 'child birth') && (
                        <div className="rounded-xl border border-border/40 bg-background/60 p-3 space-y-2">
                          <p className="font-semibold text-primary">
                            Optional Child Details (Select existing or add new)
                          </p>
                          <select
                            value={selectedFamilyId}
                            onChange={e => setSelectedFamilyId(e.target.value)}
                            className="w-full h-9 rounded-md border border-border/50 bg-background px-3 text-xs"
                          >
                            <option value="">-- Select from existing family (Optional) --</option>
                            {familyList.map(fm => (
                              <option key={fm.id} value={String(fm.id)}>
                                {fm.name} ({fm.relationship || 'child'})
                                {fm.dob ? ` • ${String(fm.dob).slice(0, 4)}` : ''}
                              </option>
                            ))}
                            <option value="other">Other (Add new child)</option>
                          </select>

                          {(selectedFamilyId === 'other' || !selectedFamilyId) && (
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                              <Input
                                value={newFamilyName}
                                onChange={e => setNewFamilyName(e.target.value)}
                                placeholder="Child Name (Optional)"
                                className="text-xs"
                              />
                              <select
                                value={newFamilyGender}
                                onChange={e => setNewFamilyGender(e.target.value)}
                                className="h-9 rounded-md border border-border/50 bg-background px-2 text-xs"
                              >
                                <option value="">Gender (Optional)</option>
                                <option value="Male">Son / Male</option>
                                <option value="Female">Daughter / Female</option>
                              </select>
                              <SmartDateInput
                                value={newFamilyDob}
                                onChange={setNewFamilyDob}
                                placeholder="Birth Date (YYYY-MM-DD)"
                              />
                            </div>
                          )}
                        </div>
                      )}

                      <div>
                        <Label className="text-xs">Description</Label>
                        <Textarea
                          value={eventDesc}
                          onChange={e => setEventDesc(e.target.value)}
                          placeholder="Optional description"
                          className="mt-1 text-xs"
                        />
                      </div>

                      <div className="flex flex-wrap gap-4">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <Checkbox
                            checked={updateProfilePermission}
                            onCheckedChange={v => setUpdateProfilePermission(Boolean(v))}
                          />
                          <span>Update my profile details with permission</span>
                        </label>

                        <label className="flex items-center gap-2 cursor-pointer">
                          <Checkbox
                            checked={isOneTimeEvent}
                            onCheckedChange={v => setIsOneTimeEvent(Boolean(v))}
                          />
                          <span>One-time event this year (otherwise annual)</span>
                        </label>
                      </div>

                      <div className="rounded-xl border border-primary/30 bg-primary/5 p-3 space-y-1.5">
                        <div className="flex items-center justify-between">
                          <Label className="text-xs font-bold text-primary">
                            Sample Event Alert Preview (Editable before posting)
                          </Label>
                          {alertDraftEdited && (
                            <button
                              type="button"
                              onClick={() => setAlertDraftEdited(false)}
                              className="text-[11px] text-primary hover:underline"
                            >
                              Reset Sample
                            </button>
                          )}
                        </div>
                        <Textarea
                          value={customAlertDraft}
                          onChange={e => {
                            setAlertDraftEdited(true)
                            setCustomAlertDraft(e.target.value)
                          }}
                          className="h-24 text-xs bg-background/80"
                        />
                      </div>

                      <Button
                        type="button"
                        disabled={postingEvent}
                        onClick={handleCreateClassEvent}
                        title="Post Event"
                        className="gold-gradient text-gold-foreground font-bold w-full"
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        {postingEvent ? 'Posting...' : 'Post Event'}
                      </Button>
                    </CardContent>
                  </Card>
                </div>
              )}

              {renderAccordionToggle(
                'I Am In Town / City Map',
                'Check member permanent/current locations and broadcast travel visits',
                expandedActivityTab === 'city_town',
                () =>
                  setExpandedActivityTab(
                    toggleExclusiveTab(SCOPE_ACTIVITIES, expandedActivityTab, 'city_town') as ActivitySubTab | null
                  ),
                <Plane className="h-4 w-4" />
              )}
              {expandedActivityTab === 'city_town' && (
                <div className="pt-1">
                  <DirectoryTab
                    mode="city_travel"
                    onStartDM={(id, name) => {
                      recordPreviousRoute('/activities')
                      navigate(`/activities?tab=chat&dmId=${id}&dmName=${encodeURIComponent(name)}`)
                    }}
                    onStartVideoCall={roomName => {
                      recordPreviousRoute('/activities')
                      navigate(`/activities?tab=calls&roomName=${encodeURIComponent(roomName)}`)
                    }}
                  />
                </div>
              )}

              {renderAccordionToggle(
                'Job opportunities and employee referral Board',
                'Jobs, internships, freelance projects & referrals board',
                expandedActivityTab === 'opportunities',
                () =>
                  setExpandedActivityTab(
                    toggleExclusiveTab(SCOPE_ACTIVITIES, expandedActivityTab, 'opportunities') as ActivitySubTab | null
                  ),
                <Briefcase className="h-4 w-4" />
              )}
              {expandedActivityTab === 'opportunities' && (
                <div className="pt-1">
                  <SupportTab mode="opportunities" />
                </div>
              )}

              {renderAccordionToggle(
                'Communication',
                'Chat, Video Call, Voice Call, Scheduled Lobbies & External Calls',
                expandedActivityTab === 'communication',
                () =>
                  setExpandedActivityTab(
                    toggleExclusiveTab(SCOPE_ACTIVITIES, expandedActivityTab, 'communication') as ActivitySubTab | null
                  ),
                <MessageCircle className="h-4 w-4" />,
                totalCommBadge
              )}
              {expandedActivityTab === 'communication' && (
                <div className="space-y-2.5 rounded-xl border border-border/40 bg-card/60 p-3">
                  {renderAccordionToggle(
                    'Chat',
                    'Common batch chat, group rooms, @mentions, reply, forward, copy & polls',
                    expandedCommTab === 'chat',
                    () =>
                      setExpandedCommTab(
                        toggleExclusiveTab(SCOPE_COMM, expandedCommTab, 'chat') as CommSubTab | null
                      ),
                    <MessageCircle className="h-4 w-4" />,
                    chatBadge
                  )}
                  {expandedCommTab === 'chat' && <ChatTab />}

                  {renderAccordionToggle(
                    'Video Call',
                    'Start or join video rooms & share photo during call',
                    expandedCommTab === 'video',
                    () =>
                      setExpandedCommTab(
                        toggleExclusiveTab(SCOPE_COMM, expandedCommTab, 'video') as CommSubTab | null
                      ),
                    <Video className="h-4 w-4" />,
                    callsBadge
                  )}
                  {expandedCommTab === 'video' && <CallsTab mode="video" />}

                  {renderAccordionToggle(
                    'Voice Call',
                    'Join audio lounge or voice calls',
                    expandedCommTab === 'voice',
                    () =>
                      setExpandedCommTab(
                        toggleExclusiveTab(SCOPE_COMM, expandedCommTab, 'voice') as CommSubTab | null
                      ),
                    <Phone className="h-4 w-4" />
                  )}
                  {expandedCommTab === 'voice' && <CallsTab mode="voice" />}

                  {renderAccordionToggle(
                    'Scheduled Call Lobbies & Attendance Log',
                    'Schedule call lobbies and track live call attendance',
                    expandedCommTab === 'scheduled_calls',
                    () =>
                      setExpandedCommTab(
                        toggleExclusiveTab(SCOPE_COMM, expandedCommTab, 'scheduled_calls') as CommSubTab | null
                      ),
                    <CalendarClock className="h-4 w-4" />
                  )}
                  {expandedCommTab === 'scheduled_calls' && <CallsTab mode="scheduled" />}

                  {renderAccordionToggle(
                    'WhatsApp Group Call, Google Meet & Zoom',
                    'Initiate WhatsApp group call, open Google Meet or schedule Zoom',
                    expandedCommTab === 'external_calls',
                    () =>
                      setExpandedCommTab(
                        toggleExclusiveTab(SCOPE_COMM, expandedCommTab, 'external_calls') as CommSubTab | null
                      ),
                    <ExternalLink className="h-4 w-4" />
                  )}
                  {expandedCommTab === 'external_calls' && (
                    <Card className="border-border/40 bg-card/80">
                      <CardContent className="p-4 space-y-4 text-xs">
                        <div className="rounded-xl border border-emerald-500/35 bg-emerald-500/5 p-3 space-y-2">
                          <p className="font-bold text-emerald-300">WhatsApp Group Call / Group Link</p>
                          <Input
                            value={waGroupLink}
                            onChange={e => setWaGroupLink(e.target.value)}
                            placeholder="https://chat.whatsapp.com/... (configured in Admin Maintenance)"
                            className="h-8 text-xs"
                          />
                          <Button
                            type="button"
                            size="sm"
                            onClick={() => {
                              const target = waGroupLink.trim() || 'https://web.whatsapp.com'
                              window.open(target, '_blank', 'noopener,noreferrer')
                            }}
                            className="h-8 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold gap-1.5 text-xs"
                          >
                            <Phone className="h-3.5 w-3.5" />
                            Open WhatsApp Group for Call
                          </Button>
                        </div>

                        <div className="rounded-xl border border-sky-500/35 bg-sky-500/5 p-3 space-y-2">
                          <p className="font-bold text-sky-300">Google Meet</p>
                          <Input
                            value={gmeetLink}
                            onChange={e => setGmeetLink(e.target.value)}
                            placeholder="https://meet.google.com/..."
                            className="h-8 text-xs"
                          />
                          <Button
                            type="button"
                            size="sm"
                            onClick={() =>
                              window.open(
                                gmeetLink.trim() || 'https://meet.google.com/new',
                                '_blank',
                                'noopener,noreferrer'
                              )
                            }
                            className="h-8 bg-sky-600 hover:bg-sky-500 text-white font-semibold gap-1.5 text-xs"
                          >
                            <Video className="h-3.5 w-3.5" />
                            Start / Join Google Meet
                          </Button>
                        </div>

                        <div className="rounded-xl border border-indigo-500/35 bg-indigo-500/5 p-3 space-y-2.5">
                          <p className="font-bold text-indigo-300">Zoom Meeting Schedule</p>
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                            <Input
                              value={zoomTopic}
                              onChange={e => setZoomTopic(e.target.value)}
                              placeholder="Zoom Meeting Topic"
                              className="h-8 text-xs"
                            />
                            <SmartDateInput
                              value={zoomDate}
                              onChange={setZoomDate}
                              placeholder="Date"
                            />
                            <Input
                              type="time"
                              value={zoomTime}
                              onChange={e => setZoomTime(e.target.value)}
                              className="h-8 text-xs"
                            />
                          </div>
                          <Input
                            value={zoomLink}
                            onChange={e => setZoomLink(e.target.value)}
                            placeholder="https://zoom.us/j/..."
                            className="h-8 text-xs"
                          />
                          <div className="flex flex-wrap gap-2">
                            <Button
                              type="button"
                              size="sm"
                              onClick={async () => {
                                const msg = `Zoom Meeting Scheduled${
                                  zoomTopic.trim() ? `: ${zoomTopic.trim()}` : ''
                                }${zoomDate ? ` on ${zoomDate}` : ''} ${zoomTime || ''} — Link: ${
                                  zoomLink.trim() || 'https://zoom.us/j'
                                }`
                                await publishArchivedAlert({
                                  category: 'event',
                                  shortTitle: 'Zoom Meeting Scheduled',
                                  fullMessage: msg,
                                })
                                alert('Zoom meeting alert posted to notifications!')
                              }}
                              className="h-8 gold-gradient text-gold-foreground font-semibold text-xs"
                            >
                              Post Zoom Schedule Alert
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() =>
                                window.open(
                                  zoomLink.trim() || 'https://zoom.us/j',
                                  '_blank',
                                  'noopener,noreferrer'
                                )
                              }
                              className="h-8 text-xs gap-1"
                            >
                              <ExternalLink className="h-3.5 w-3.5" />
                              Open Zoom
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </div>
              )}
            </div>
          )}

          {hubSection === 'drive' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-primary flex items-center gap-2">
                  <FolderOpen className="h-5 w-5" />
                  Drive
                </h2>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleCloseCurrentSubPage}
                  className="text-xs gap-1"
                >
                  <X className="h-3.5 w-3.5" />
                  Close Page
                </Button>
              </div>

              {renderAccordionToggle(
                'Gallery',
                'Batch photo gallery and shared memories',
                expandedDriveTab === 'gallery',
                () =>
                  setExpandedDriveTab(
                    toggleExclusiveTab(SCOPE_DRIVE, expandedDriveTab, 'gallery') as DriveSubTab | null
                  ),
                <Image className="h-4 w-4" />
              )}
              {expandedDriveTab === 'gallery' && <MediaArchiveTab />}

              {renderAccordionToggle(
                'Folders',
                'Personal & shared member document folders',
                expandedDriveTab === 'folders',
                () =>
                  setExpandedDriveTab(
                    toggleExclusiveTab(SCOPE_DRIVE, expandedDriveTab, 'folders') as DriveSubTab | null
                  ),
                <FolderOpen className="h-4 w-4" />
              )}
              {expandedDriveTab === 'folders' && <MediaArchiveTab />}
            </div>
          )}

          {hubSection === 'settings_maintenance' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-primary flex items-center gap-2">
                  <Settings className="h-5 w-5" />
                  Settings / Maintenance
                </h2>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleCloseCurrentSubPage}
                  className="text-xs gap-1"
                >
                  <X className="h-3.5 w-3.5" />
                  Close Page
                </Button>
              </div>

              {renderAccordionToggle(
                'Common Member Settings',
                'Privacy, biometrics, app install link, invites, alerts & voice/video preferences',
                expandedSettingsMaintTab === 'common_settings',
                () =>
                  setExpandedSettingsMaintTab(
                    toggleExclusiveTab(SCOPE_SETTINGS_MAINT, expandedSettingsMaintTab, 'common_settings')
                  ),
                <Settings className="h-4 w-4" />
              )}
              {expandedSettingsMaintTab === 'common_settings' && <SettingsTab />}

              {renderAccordionToggle(
                'Alumni Association & Treasury Shortcuts',
                'Open Alumni Association governance or Fenestrians Treasury & Accounts',
                expandedSettingsMaintTab === 'association_links',
                () =>
                  setExpandedSettingsMaintTab(
                    toggleExclusiveTab(SCOPE_SETTINGS_MAINT, expandedSettingsMaintTab, 'association_links')
                  ),
                <Wallet className="h-4 w-4" />
              )}
              {expandedSettingsMaintTab === 'association_links' && (
                <div className="grid gap-2.5 sm:grid-cols-2 rounded-xl border border-border/40 bg-card/70 p-3.5">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      recordPreviousRoute('/settings-maintenance')
                      navigate('/alumni-association')
                    }}
                    className="justify-between text-xs h-10 border-primary/40 text-primary"
                  >
                    <span className="flex items-center gap-2">
                      <Building2 className="h-4 w-4" />
                      Alumni Association
                    </span>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      recordPreviousRoute('/settings-maintenance')
                      navigate('/treasury')
                    }}
                    className="justify-between text-xs h-10 border-primary/40 text-primary"
                  >
                    <span className="flex items-center gap-2">
                      <Wallet className="h-4 w-4" />
                      Fenestrians Treasury &amp; Accounts
                    </span>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              )}

              {userIsAdmin &&
                renderAccordionToggle(
                  'Admin & Officer Maintenance Tools',
                  'Profile audits, chat archive, call room cleanup, storage & governance logs',
                  expandedSettingsMaintTab === 'admin_maintenance',
                  () =>
                    setExpandedSettingsMaintTab(
                      toggleExclusiveTab(SCOPE_SETTINGS_MAINT, expandedSettingsMaintTab, 'admin_maintenance')
                    ),
                  <Wrench className="h-4 w-4" />
                )}
              {userIsAdmin && expandedSettingsMaintTab === 'admin_maintenance' && <MaintenanceTab />}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
