import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { Button } from '@/components/ui/button'
import { supabase } from '@/lib/supabase'
import {
  fetchUserNotifications,
  clearChatNotifications,
  isChatNotification,
  archiveDailyCelebrationAlert,
} from '@/lib/notificationService'
import { formatFullDate } from '@/lib/formatters'
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

type TabName =
  | 'directory'
  | 'calendar'
  | 'chat'
  | 'calls'
  | 'tasks'
  | 'media'
  | 'profile'
  | 'settings'
  | 'support'
  | 'maintenance'

export default function MemberDashboard() {
  const [searchParams] = useSearchParams()
  const [activeTab, setActiveTab] = useState<TabName>('directory')
  const [alerts, setAlerts] = useState<string[]>([])
  const [chatBadge, setChatBadge] = useState(0)
  const [callsBadge, setCallsBadge] = useState(0)
  const [tasksBadge, setTasksBadge] = useState(0)
  const { user, logout, isAdmin } = useAuth()
  const navigate = useNavigate()

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
    const rawTab = searchParams.get('tab')
    if (rawTab === 'voice' || rawTab === 'video' || rawTab === 'calls') {
      setActiveTab('calls')
    } else if (rawTab === 'gallery' || rawTab === 'folder' || rawTab === 'media') {
      setActiveTab('media')
    } else if (
      rawTab === 'directory' ||
      rawTab === 'calendar' ||
      rawTab === 'chat' ||
      rawTab === 'tasks' ||
      rawTab === 'profile' ||
      rawTab === 'settings' ||
      rawTab === 'support' ||
      rawTab === 'maintenance'
    ) {
      setActiveTab(rawTab)
    }

    const dmId = searchParams.get('dmId')
    const dmName = searchParams.get('dmName')
    if (rawTab === 'chat' && dmId && dmName) {
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('open-dm', { detail: { id: Number(dmId), name: dmName } }))
      }, 150)
    }

    const roomName = searchParams.get('roomName')
    if ((rawTab === 'video' || rawTab === 'calls') && roomName) {
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('join-video', { detail: { roomName } }))
      }, 150)
    }
  }, [searchParams])

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

  const handleTabSelect = async (tabId: string) => {
    if (tabId === 'alumni') {
      navigate('/alumni-association')
      return
    }
    if (tabId === 'treasury') {
      navigate('/treasury')
      return
    }
    setActiveTab(tabId as TabName)

    if (!user) return
    if (tabId === 'chat') {
      await clearChatNotifications(user.id)
      setChatBadge(0)
      window.dispatchEvent(new Event('fenestrians-notifications-updated'))
    } else if (tabId === 'calls') {
      await supabase
        .from('user_notifications')
        .delete()
        .eq('user_id', user.id)
        .in('category', ['group_call', 'video_call'])
      setCallsBadge(0)
      window.dispatchEvent(new Event('fenestrians-notifications-updated'))
    }
  }

  const handleLogout = () => {
    logout()
    navigate('/')
  }

  if (!user) return null

  const userIsAdmin = Boolean(isAdmin || user.is_admin)

  const navItems: { id: string; label: string; tooltip: string; icon: any; badge?: number }[] = [
    { id: 'directory', label: 'Directory', tooltip: 'Member Directory', icon: Users },
    { id: 'calendar', label: 'Calendar', tooltip: 'Class Calendar', icon: CalendarDays },
    { id: 'chat', label: 'Chat', tooltip: 'Group & Private Chat', icon: MessageCircle, badge: chatBadge },
    { id: 'calls', label: 'Calls', tooltip: 'Voice & Video Calls', icon: Phone, badge: callsBadge },
    { id: 'tasks', label: 'Tasks', tooltip: 'Assigned & Public Tasks', icon: ListTodo, badge: tasksBadge },
    { id: 'media', label: 'Gallery & Files', tooltip: 'Photo Gallery & Member Folders', icon: Image },
    { id: 'profile', label: 'Profile', tooltip: 'My Profile & Family', icon: User },
    { id: 'settings', label: 'Settings', tooltip: 'User Settings & Privacy', icon: Settings },
    { id: 'alumni', label: 'Alumni', tooltip: 'Alumni Association Home', icon: Building2 },
    { id: 'treasury', label: 'Treasury', tooltip: 'Association Treasury & Accounts', icon: Wallet },
    ...(userIsAdmin
      ? [{ id: 'maintenance', label: 'Maintenance', tooltip: 'Admin Maintenance & Audits', icon: Wrench }]
      : []),
  ]

  return (
    <div className="flex min-h-svh flex-col bg-background pt-14 pb-28 overflow-x-hidden">
      <header className="fixed top-0 left-0 right-0 z-40 border-b border-border/50 bg-card/80 backdrop-blur-xl shadow-lg shadow-black/10">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-4 py-2.5">
          <div className="flex shrink-0 items-center gap-3" title="Fenestrians Exclusive Network">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg gold-border bg-background/50 p-0.5 shadow-md">
              <img src="/icon.png" alt="Logo" className="h-full w-full rounded-md object-contain" />
            </div>
            <div className="hidden sm:block">
              <h1 className="text-sm font-bold text-primary leading-tight">Fenestrians</h1>
              <p className="text-[10px] text-muted-foreground">Exclusive Network</p>
            </div>
          </div>

          <nav className="flex flex-1 items-center gap-1 overflow-x-auto touch-pan-x pb-1 scrollbar-hide">
            {navItems.map(item => {
              const Icon = item.icon
              return (
                <Button
                  key={item.id}
                  size="sm"
                  title={item.tooltip}
                  variant={activeTab === item.id ? 'default' : 'ghost'}
                  className={`relative shrink-0 h-8 gap-1.5 px-2.5 text-xs transition-all duration-200 ${
                    activeTab === item.id
                      ? 'gold-gradient text-gold-foreground shadow-md'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                  onClick={() => handleTabSelect(item.id)}
                >
                  <Icon className="h-3.5 w-3.5" />
                  <span className="hidden lg:inline">{item.label}</span>
                  {item.badge && item.badge > 0 ? (
                    <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white">
                      {item.badge}
                    </span>
                  ) : null}
                </Button>
              )
            })}
            <div className="ml-2 h-6 w-px shrink-0 bg-border/50" />
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
          </nav>
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

      <main className="flex-1 p-4">
        {activeTab === 'directory' && (
          <DirectoryTab
            onStartDM={(id, name) => {
              handleTabSelect('chat')
              setTimeout(() => window.dispatchEvent(new CustomEvent('open-dm', { detail: { id, name } })), 100)
            }}
            onStartVideoCall={roomName => {
              handleTabSelect('calls')
              setTimeout(() => window.dispatchEvent(new CustomEvent('join-video', { detail: { roomName } })), 100)
            }}
            onOpenSupportRequests={() => setActiveTab('support')}
          />
        )}
        {activeTab === 'calendar' && (
          <CalendarTab
            onJoinCall={roomName => {
              handleTabSelect('calls')
              setTimeout(() => window.dispatchEvent(new CustomEvent('join-video', { detail: { roomName } })), 100)
            }}
          />
        )}
        {activeTab === 'chat' && <ChatTab />}
        {activeTab === 'calls' && <CallsTab />}
        {activeTab === 'tasks' && <TasksTab />}
        {activeTab === 'media' && <MediaArchiveTab />}
        {activeTab === 'profile' && <ProfileTab />}
        {activeTab === 'settings' && <SettingsTab />}
        {activeTab === 'support' && (
          <div className="space-y-3">
            <div className="mx-auto max-w-4xl">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setActiveTab('directory')}
                className="text-xs"
              >
                ← Back to Member Directory
              </Button>
            </div>
            <SupportTab />
          </div>
        )}
        {activeTab === 'maintenance' && userIsAdmin && <MaintenanceTab />}
      </main>
    </div>
  )
}
