import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { Button } from '@/components/ui/button'
import { supabase } from '@/lib/supabase'
import { Users, Heart, Image, CalendarDays, MessageCircle, Phone, Video, User, Settings, LogOut, X, Crown } from 'lucide-react'
import DirectoryTab from '@/pages/DirectoryTab'
import ProfileTab from '@/pages/ProfileTab'
import FamilyTab from '@/pages/FamilyTab'
import GalleryTab from '@/pages/GalleryTab'
import CalendarTab from '@/pages/CalendarTab'
import ChatTab from '@/pages/ChatTab'
import VoiceTab from '@/pages/VoiceTab'
import VideoTab from '@/pages/VideoTab'
import SettingsTab from '@/pages/SettingsTab'

type TabName = 'directory' | 'profile' | 'family' | 'gallery' | 'calendar' | 'chat' | 'voice' | 'video' | 'settings'

export default function MemberDashboard() {
  const [activeTab, setActiveTab] = useState<TabName>('directory')
  const [alerts, setAlerts] = useState<string[]>([])
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (!user) {
      navigate('/')
      return
    }
    triggerAlerts()
  }, [user, navigate])

  const triggerAlerts = async () => {
    if (!user) return
    const { data: users } = await supabase.from('alumni').select('*').eq('is_placeholder', false)
    if (!users) return

    const today = new Date()
    const currentDay = today.getDate()
    const currentMonth = today.getMonth()
    const datestampTodayStr = `${today.getFullYear()}-${String(currentMonth + 1).padStart(2, '0')}-${String(currentDay).padStart(2, '0')}`

    const celebrations: string[] = []
    users.forEach(u => {
      if (u.dob && new Date(u.dob).getDate() === currentDay && new Date(u.dob).getMonth() === currentMonth) {
        celebrations.push(`Today is ${u.full_name}'s Birthday!`)
      }
      if (u.wedding_date && new Date(u.wedding_date).getDate() === currentDay && new Date(u.wedding_date).getMonth() === currentMonth) {
        celebrations.push(`Happy Anniversary to ${u.full_name}!`)
      }
    })
    setAlerts(celebrations)

    for (const celeb of celebrations) {
      const uniqueTrace = `[AUTO-ALERT:${datestampTodayStr}]: ${celeb}`
      const { data: m } = await supabase.from('chat_messages').select('id').eq('room_id', 'global').eq('message_text', uniqueTrace).limit(1)
      if (!m || m.length === 0) {
        await supabase.from('chat_messages').insert([{ room_id: 'global', sender_id: 0, sender_name: '🛡️ System Bot', message_text: uniqueTrace }])
      }
    }
  }

  const handleLogout = () => {
    logout()
    navigate('/')
  }

  if (!user) return null

  const navItems: { id: TabName; label: string; icon: typeof Users; group: string }[] = [
    { id: 'directory', label: 'Directory', icon: Users, group: 'Network' },
    { id: 'family', label: 'Family', icon: Heart, group: 'Network' },
    { id: 'gallery', label: 'Gallery', icon: Image, group: 'Network' },
    { id: 'calendar', label: 'Calendar', icon: CalendarDays, group: 'Network' },
    { id: 'chat', label: 'Chat', icon: MessageCircle, group: 'Comms' },
    { id: 'voice', label: 'Voice', icon: Phone, group: 'Comms' },
    { id: 'video', label: 'Video', icon: Video, group: 'Comms' },
    { id: 'profile', label: 'Profile', icon: User, group: 'Account' },
    { id: 'settings', label: 'Settings', icon: Settings, group: 'Account' },
  ]

  return (
    <div className="flex min-h-svh flex-col bg-background">
      <header className="sticky top-0 z-40 border-b border-border/50 bg-card/80 backdrop-blur-xl shadow-lg shadow-black/10">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-2.5">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg gold-border bg-background/50 p-0.5 shadow-md">
              <img src="/icon.png" alt="Logo" className="h-full w-full rounded-md object-contain" />
            </div>
            <div className="hidden sm:block">
              <h1 className="text-sm font-bold text-primary leading-tight">Fenestrians</h1>
              <p className="text-[10px] text-muted-foreground">Exclusive Network</p>
            </div>
          </div>

          <nav className="flex items-center gap-1">
            {navItems.map(item => {
              const Icon = item.icon
              return (
                <Button
                  key={item.id}
                  size="sm"
                  variant={activeTab === item.id ? 'default' : 'ghost'}
                  className={`h-8 gap-1.5 px-2.5 text-xs transition-all duration-200 ${activeTab === item.id ? 'gold-gradient text-gold-foreground shadow-md' : 'text-muted-foreground hover:text-foreground'}`}
                  onClick={() => setActiveTab(item.id)}
                >
                  <Icon className="h-3.5 w-3.5" />
                  <span className="hidden lg:inline">{item.label}</span>
                </Button>
              )
            })}
            <div className="ml-2 h-6 w-px bg-border/50" />
            <Button size="sm" variant="ghost" className="h-8 gap-1.5 px-2.5 text-xs text-destructive/80 hover:text-destructive hover:bg-destructive/10" onClick={handleLogout}>
              <LogOut className="h-3.5 w-3.5" />
              <span className="hidden md:inline">Log Out</span>
            </Button>
          </nav>
        </div>
      </header>

      {alerts.length > 0 && (
        <div className="mx-auto w-full max-w-5xl space-y-1.5 px-4 pt-3">
          {alerts.map((a, i) => (
            <div key={i} className="flex items-center justify-between rounded-lg gold-border bg-primary/5 px-4 py-2.5 text-xs shadow-sm">
              <span className="flex items-center gap-2 text-primary font-medium">
                <Crown className="h-3.5 w-3.5" />
                {a}
              </span>
              <Button variant="ghost" size="sm" className="h-5 w-5 p-0 text-muted-foreground hover:text-foreground" onClick={() => setAlerts(prev => prev.filter((_, idx) => idx !== i))}>
                <X className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </div>
      )}

      <main className="flex-1 p-4">
        {activeTab === 'directory' && <DirectoryTab onStartDM={(id, name) => { setActiveTab('chat'); setTimeout(() => window.dispatchEvent(new CustomEvent('open-dm', { detail: { id, name } })), 100) }} onStartVideoCall={(roomName) => { setActiveTab('video'); setTimeout(() => window.dispatchEvent(new CustomEvent('join-video', { detail: { roomName } })), 100) }} />}
        {activeTab === 'profile' && <ProfileTab />}
        {activeTab === 'family' && <FamilyTab />}
        {activeTab === 'gallery' && <GalleryTab />}
        {activeTab === 'calendar' && <CalendarTab onJoinCall={(roomName) => { setActiveTab('video'); setTimeout(() => window.dispatchEvent(new CustomEvent('join-video', { detail: { roomName } })), 100) }} />}
        {activeTab === 'chat' && <ChatTab />}
        {activeTab === 'voice' && <VoiceTab />}
        {activeTab === 'video' && <VideoTab />}
        {activeTab === 'settings' && <SettingsTab />}
      </main>
    </div>
  )
}
