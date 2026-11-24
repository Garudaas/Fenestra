import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { supabase } from '@/lib/supabase'
import {
  fetchUserNotifications,
  clearChatNotifications,
  isChatNotification,
  archiveDailyCelebrationAlert,
} from '@/lib/notificationService'
import { formatFullDate } from '@/lib/formatters'
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
  | 'drive'
  | 'settings_maintenance'

type ActivitySubTab = 'calendar' | 'city_town' | 'tasks' | 'opportunities' | 'communication'
type CommSubTab = 'chat' | 'video' | 'voice'
type DriveSubTab = 'gallery' | 'folders'

const SCOPE_ROSTER = 'sub_roster'
const SCOPE_EMERGENCY = 'sub_emergency'
const SCOPE_ACTIVITIES = 'sub_activities'
const SCOPE_COMM = 'sub_communication'
const SCOPE_DRIVE = 'sub_drive'
const SCOPE_SETTINGS_MAINT = 'sub_settings_maintenance'

function resolveHubFromPathname(pathname: string): HubSectionKey {
  switch (pathname) {
    case '/roster':
      return 'roster'
    case '/emergency':
      return 'emergency'
    case '/activities':
      return 'activities'
    case '/drive':
      return 'drive'
    case '/settings-maintenance':
      return 'settings_maintenance'
    default:
      return 'landing'
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
  const [chatBadge, setChatBadge] = useState(0)
  const [callsBadge, setCallsBadge] = useState(0)
  const [tasksBadge, setTasksBadge] = useState(0)

  // All collapsible sub-tabs start collapsed by default (or restored when returning from another page)
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

    let chats = 0
    let calls = 0

    for (const item of unread) {
      if (isChatNotification(item.category)) {
        chats += item.unread_count || 1
      } else if (item.category === 'group_call' || item.category === 'video_call') {
        calls += item.unread_count || 1
      }
    }

    setChatBadge(chats)
    setCallsBadge(calls)
    setTasksBadge(pendingTasksRes.count || 0)
  }, [user])

  useEffect(() => {
    const nextHub = resolveHubFromPathname(location.pathname)
    setHubSection(nextHub)

    const rawTab = searchParams.get('tab')
    const viewParam = searchParams.get('view')

    if (location.pathname === '/dashboard' && rawTab) {
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
        setHubSection('activities')
        setExpandedActivityTab('tasks')
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
    }

    // Refresh persisted tab states on route return
    setExpandedRosterTab(getPersistedExpandedTab(SCOPE_ROSTER))
    setExpandedEmergencyTab(getPersistedExpandedTab(SCOPE_EMERGENCY))
    setExpandedActivityTab(getPersistedExpandedTab(SCOPE_ACTIVITIES) as ActivitySubTab | null)
    setExpandedCommTab(getPersistedExpandedTab(SCOPE_COMM) as CommSubTab | null)
    setExpandedDriveTab(getPersistedExpandedTab(SCOPE_DRIVE) as DriveSubTab | null)
    setExpandedSettingsMaintTab(getPersistedExpandedTab(SCOPE_SETTINGS_MAINT))

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

  const openMainTabPage = (tabId: string) => {
    const currentFull = `${location.pathname}${location.search}`
    if (tabId === 'landing') {
      navigate('/dashboard')
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
    id: Exclude<HubSectionKey, 'landing'>
    label: string
    description: string
    icon: any
    badge?: number
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
      description: 'Calendar, City Map / In Town, Tasks, Jobs & Comms',
      icon: CalendarDays,
      badge: tasksBadge + totalCommBadge,
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
  ]

  const renderAccordionToggle = (
    title: string,
    subtitle: string,
    isOpen: boolean,
    onClick: () => void,
    icon: React.ReactNode,
    badgeCount?: number
  ) => (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center justify-between gap-3 rounded-xl border p-3.5 text-left transition-all ${
        isOpen
          ? 'border-primary/60 bg-primary/10 shadow-sm'
          : 'border-border/40 bg-card/75 hover:border-primary/40 hover:bg-primary/5'
      }`}
    >
      <div className="flex items-center gap-3 min-w-0">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-primary/35 bg-primary/10 text-primary">
          {icon}
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-foreground truncate">{title}</span>
            {badgeCount && badgeCount > 0 ? (
              <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1.5 text-[10px] font-bold text-white">
                {badgeCount}
              </span>
            ) : null}
          </div>
          <p className="text-[11px] text-muted-foreground truncate">{subtitle}</p>
        </div>
      </div>
      {isOpen ? (
        <ChevronUp className="h-4 w-4 text-primary shrink-0" />
      ) : (
        <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
      )}
    </button>
  )

  return (
    <div className="flex min-h-svh flex-col bg-background pt-14 pb-28 overflow-x-hidden">
      {/* Top Bar */}
      <header className="fixed top-0 left-0 right-0 z-40 border-b border-border/50 bg-card/80 backdrop-blur-xl shadow-lg shadow-black/10">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-4 py-2.5">
          <button
            type="button"
            onClick={() => openMainTabPage('landing')}
            className="flex shrink-0 items-center gap-2.5 text-left"
            title="Dashboard Landing"
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

            {userIsAdmin && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => {
                  recordPreviousRoute(`${location.pathname}${location.search}`)
                  navigate('/admin-dashboard')
                }}
                className="h-8 gap-1.5 px-2.5 text-xs border-amber-500/40 text-amber-300 hover:bg-amber-500/10 shrink-0"
              >
                <Crown className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Admin</span>
              </Button>
            )}

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

      {/* Celebration Alerts */}
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
          {/* DASHBOARD LANDING PAGE: LOGO AT TOP + ALL MAIN TABS BELOW */}
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
                      className="group relative flex items-start justify-between gap-3 rounded-2xl border border-border/50 bg-card/75 hover:border-primary/60 hover:bg-primary/10 p-4 text-left shadow-md transition-all"
                    >
                      <div className="flex items-start gap-3 min-w-0">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-primary/35 bg-primary/10 text-primary group-hover:scale-105 transition-transform">
                          <Icon className="h-5 w-5" />
                        </div>
                        <div className="min-w-0 space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-foreground group-hover:text-primary transition-colors">
                              {tab.label}
                            </span>
                            {tab.badge && tab.badge > 0 ? (
                              <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1.5 text-[10px] font-bold text-white">
                                {tab.badge}
                              </span>
                            ) : null}
                          </div>
                          <p className="text-[11px] text-muted-foreground leading-snug">
                            {tab.description}
                          </p>
                        </div>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary shrink-0 mt-1" />
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* MAIN PAGE 1: ROSTER (Member Directory & My Profile — Collapsed by Default) */}
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
                <Users className="h-4 w-4" />
              )}
              {expandedRosterTab === 'directory' && (
                <div className="pt-1">
                  <DirectoryTab
                    onStartDM={(id, name) => {
                      recordPreviousRoute('/roster')
                      navigate(`/dashboard?tab=chat&dmId=${id}&dmName=${encodeURIComponent(name)}`)
                    }}
                    onStartVideoCall={roomName => {
                      recordPreviousRoute('/roster')
                      navigate(`/dashboard?tab=calls&roomName=${encodeURIComponent(roomName)}`)
                    }}
                    onOpenSupportRequests={() => {
                      recordPreviousRoute('/roster')
                      navigate('/emergency')
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

          {/* MAIN PAGE 2: EMERGENCY (Emergency Blood SOS & Family Support — Collapsed by Default) */}
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
                    onStartDM={(id, name) => {
                      recordPreviousRoute('/emergency')
                      navigate(`/dashboard?tab=chat&dmId=${id}&dmName=${encodeURIComponent(name)}`)
                    }}
                    onStartVideoCall={roomName => {
                      recordPreviousRoute('/emergency')
                      navigate(`/dashboard?tab=calls&roomName=${encodeURIComponent(roomName)}`)
                    }}
                    onOpenSupportRequests={() => {
                      setExpandedEmergencyTab(
                        toggleExclusiveTab(SCOPE_EMERGENCY, expandedEmergencyTab, 'family_support')
                      )
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
                  <SupportTab />
                </div>
              )}
            </div>
          )}

          {/* MAIN PAGE 3: ACTIVITIES (Calendar, City Map/In Town, Tasks, Jobs & Communication — Collapsed by Default) */}
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

              {/* 1. Alumni / Class Calendar */}
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
                      navigate(`/dashboard?tab=calls&roomName=${encodeURIComponent(roomName)}`)
                    }}
                  />
                </div>
              )}

              {/* 2. I Am In Town / City Map */}
              {renderAccordionToggle(
                'I Am In Town / City Map',
                'Browse batch city clusters and broadcast travel visits',
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
                    onStartDM={(id, name) => {
                      recordPreviousRoute('/activities')
                      navigate(`/dashboard?tab=chat&dmId=${id}&dmName=${encodeURIComponent(name)}`)
                    }}
                    onStartVideoCall={roomName => {
                      recordPreviousRoute('/activities')
                      navigate(`/dashboard?tab=calls&roomName=${encodeURIComponent(roomName)}`)
                    }}
                  />
                </div>
              )}

              {/* 3. Tasks and Action Items */}
              {renderAccordionToggle(
                'Tasks and Action Items',
                'Assigned personal tasks, recurring tasks & action checklists',
                expandedActivityTab === 'tasks',
                () =>
                  setExpandedActivityTab(
                    toggleExclusiveTab(SCOPE_ACTIVITIES, expandedActivityTab, 'tasks') as ActivitySubTab | null
                  ),
                <ListTodo className="h-4 w-4" />,
                tasksBadge
              )}
              {expandedActivityTab === 'tasks' && (
                <div className="pt-1">
                  <TasksTab />
                </div>
              )}

              {/* 4. Batch Jobs and Referrals */}
              {renderAccordionToggle(
                'Batch Jobs and Referrals',
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
                  <SupportTab />
                </div>
              )}

              {/* 5. Communication (with sub-tabs for Chat, Video Call, Voice Call — collapsed by default) */}
              {renderAccordionToggle(
                'Communication',
                'Sub-tabs: Chat, Video Call & Voice Call',
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
                    'Common batch chat, group rooms & private messages',
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
                    'Start or join video rooms with batchmates',
                    expandedCommTab === 'video',
                    () =>
                      setExpandedCommTab(
                        toggleExclusiveTab(SCOPE_COMM, expandedCommTab, 'video') as CommSubTab | null
                      ),
                    <Video className="h-4 w-4" />,
                    callsBadge
                  )}
                  {expandedCommTab === 'video' && <CallsTab />}

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
                  {expandedCommTab === 'voice' && <CallsTab />}
                </div>
              )}
            </div>
          )}

          {/* MAIN PAGE 4: DRIVE (Gallery & Folders — Collapsed by Default) */}
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

          {/* MAIN PAGE 5: SETTINGS / MAINTENANCE (Collapsed by Default) */}
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
