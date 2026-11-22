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
import {
  Users,
  Heart,
  Image,
  Folder,
  HandHeart,
  CalendarDays,
  MessageCircle,
  Phone,
  Video,
  User,
  Settings,
  Wrench,
  LogOut,
  X,
  Crown,
  Building2,
} from 'lucide-react'
import DirectoryTab from '@/pages/DirectoryTab'
import ProfileTab from '@/pages/ProfileTab'
import FamilyTab from '@/pages/FamilyTab'
import GalleryTab from '@/pages/GalleryTab'
import FolderTab from '@/pages/FolderTab'
import SupportTab from '@/pages/SupportTab'
import CalendarTab from '@/pages/CalendarTab'
import ChatTab from '@/pages/ChatTab'
import VoiceTab from '@/pages/VoiceTab'
import VideoTab from '@/pages/VideoTab'
import SettingsTab from '@/pages/SettingsTab'
import MaintenanceTab from '@/pages/MaintenanceTab'

type TabName =
  | 'directory'
  | 'profile'
  | 'family'
  | 'gallery'
  | 'folder'
  | 'support'
  | 'calendar'
  | 'chat'
  | 'voice'
  | 'video'
  | 'settings'
  | 'maintenance'

export default function MemberDashboard() {
  const [searchParams] = useSearchParams()
  const [activeTab, setActiveTab] = useState<TabName>('directory')
  const [alerts, setAlerts] = useState<string[]>([])
  const [chatBadge, setChatBadge] = useState(0)
  const [voiceBadge, setVoiceBadge] = useState(0)
  const [videoBadge, setVideoBadge] = useState(0)
  const { user, logout, isAdmin } = useAuth()
  const navigate = useNavigate()

  const syncHeaderBadges = useCallback(async () => {
    if (!user || user.is_placeholder) return
    const list = await fetchUserNotifications(user.id)
    const unread = list.filter(i => i.status === 'unread')

    let chats = 0
    let voiceCalls = 0
    let videoCalls = 0

    for (const item of unread) {
      if (isChatNotification(item.category)) {
        chats += item.unread_count || 1
      } else if (item.category === 'group_call') {
        voiceCalls += item.unread_count || 1
      } else if (item.category === 'video_call') {
        videoCalls += item.unread_count || 1
      }
    }

    setChatBadge(chats)
    setVoiceBadge(voiceCalls)
    setVideoBadge(videoCalls)
  }, [user])

  useEffect(() => {
    const requestedTab = searchParams.get('tab') as TabName | null
    if (requestedTab) {
      setActiveTab(requestedTab)
    }
  }, [searchParams])

  useEffect(() => {
    if (!user) {
      navigate('/')
      return
    }
    triggerAlerts()
    syncHeaderBadges()

    const interval = setInterval(syncHeaderBadges, 20000)
    window.addEventListener('fenestrians-notifications-updated', syncHeaderBadges)
    return () => {
      clearInterval(interval)
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

    const celebrations: Array<{
      text: string
      category: 'birthday' | 'anniversary'
      shortTitle: string
    }> = []

    users.forEach(u => {
      if (u.dob && new Date(u.dob).getDate() === currentDay && new Date(u.dob).getMonth() === currentMonth) {
        celebrations.push({
          text: `Today is ${u.full_name}'s Birthday!`,
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
          text: `Happy Anniversary to ${u.full_name}!`,
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
    setActiveTab(tabId as TabName)

    if (!user) return
    if (tabId === 'chat') {
      await clearChatNotifications(user.id)
      setChatBadge(0)
      window.dispatchEvent(new Event('fenestrians-notifications-updated'))
    } else if (tabId === 'voice') {
      await supabase.from('user_notifications').delete().eq('user_id', user.id).eq('category', 'group_call')
      setVoiceBadge(0)
      window.dispatchEvent(new Event('fenestrians-notifications-updated'))
    } else if (tabId === 'video') {
      await supabase.from('user_notifications').delete().eq('user_id', user.id).eq('category', 'video_call')
      setVideoBadge(0)
      window.dispatchEvent(new Event('fenestrians-notifications-updated'))
    }
  }

  const handleLogout = () => {
    logout()
    navigate('/')
  }

  if (!user) return null

  const userIsAdmin = Boolean(isAdmin || user.is_admin)

  const navItems: { id: string; label: string; tooltip: string; icon: any; group: string; badge?: number }[] = [
    { id: 'alumni', label: 'Alumni', tooltip: 'Alumni Association Home', icon: Building2, group: 'Network' },
    { id: 'directory', label: 'Directory', tooltip: 'Member Directory', icon: Users, group: 'Network' },
    { id: 'family', label: 'Family', tooltip: 'Family Members', icon: Heart, group: 'Network' },
    { id: 'support', label: 'Support', tooltip: 'Family Support Requests', icon: HandHeart, group: 'Network' },
    { id: 'gallery', label: 'Gallery', tooltip: 'Photo Gallery', icon: Image, group: 'Network' },
    { id: 'folder', label: 'Folder', tooltip: 'Member Folders & Shared Files', icon: Folder, group: 'Network' },
    { id: 'calendar', label: 'Calendar', tooltip: 'Class Calendar', icon: CalendarDays, group: 'Network' },
    { id: 'chat', label: 'Chat', tooltip: 'Group & Private Chat', icon: MessageCircle, group: 'Comms', badge: chatBadge },
    { id: 'voice', label: 'Voice', tooltip: 'Voice Calls', icon: Phone, group: 'Comms', badge: voiceBadge },
    { id: 'video', label: 'Video', tooltip: 'Video Calls', icon: Video, group: 'Comms', badge: videoBadge },
    { id: 'profile', label: 'Profile', tooltip: 'My Profile', icon: User, group: 'Account' },
    { id: 'settings', label: 'Settings', tooltip: 'User Settings & Privacy', icon: Settings, group: 'Account' },
    ...(userIsAdmin
      ? [{ id: 'maintenance', label: 'Maintenance', tooltip: 'Admin Maintenance & Audits', icon: Wrench, group: 'Admin' }]
      : []),
  ]

  return (
    <div className="flex min-h-svh flex-col bg-background pt-14 overflow-x-hidden">
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
              handleTabSelect('video')
              setTimeout(() => window.dispatchEvent(new CustomEvent('join-video', { detail: { roomName } })), 100)
            }}
          />
        )}
        {activeTab === 'profile' && <ProfileTab />}
        {activeTab === 'family' && <FamilyTab />}
        {activeTab === 'support' && <SupportTab />}
        {activeTab === 'gallery' && <GalleryTab />}
        {activeTab === 'folder' && <FolderTab />}
        {activeTab === 'calendar' && (
          <CalendarTab
            onJoinCall={roomName => {
              handleTabSelect('video')
              setTimeout(() => window.dispatchEvent(new CustomEvent('join-video', { detail: { roomName } })), 100)
            }}
          />
        )}
        {activeTab === 'chat' && <ChatTab />}
        {activeTab === 'voice' && <VoiceTab />}
        {activeTab === 'video' && <VideoTab />}
        {activeTab === 'settings' && <SettingsTab />}
        {activeTab === 'maintenance' && userIsAdmin && <MaintenanceTab />}
      </main>
    </div>
  )
}
