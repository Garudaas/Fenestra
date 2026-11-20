import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import OneSignal from 'react-onesignal'
import { useAuth } from '@/context/AuthContext'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Settings, Bell, CheckCircle2, Globe, Shield, Video, Mic, UserPlus, ArrowRight } from 'lucide-react'

export default function SettingsTab() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [pushEnabled, setPushEnabled] = useState(false)
  const [alertLoading, setAlertLoading] = useState(false)
  const [lang, setLang] = useState('en')

  useEffect(() => {
    const saved = localStorage.getItem('pref_lang') || 'en'
    setLang(saved)
    checkOneSignalState()
  }, [])

  const checkOneSignalState = async () => {
    try {
      if ('serviceWorker' in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations()
        for (const reg of regs) {
          if (reg.active?.scriptURL.endsWith('/sw.js')) {
            await reg.unregister()
          }
        }
      }
      const optedIn = Boolean(OneSignal.User?.PushSubscription?.optedIn) && Notification.permission === 'granted'
      setPushEnabled(optedIn)
    } catch {
      setPushEnabled(false)
    }
  }

  const toggleAlerts = async () => {
    if (!('Notification' in window)) {
      alert('Notifications are not supported in this browser. On iPhone, please add this app to your Home Screen first and open it from there.')
      return
    }

    setAlertLoading(true)
    try {
      if (pushEnabled) {
        await OneSignal.User.PushSubscription.optOut()
        setPushEnabled(false)
        alert('Notifications turned off for this device.')
      } else {
        await OneSignal.Notifications.requestPermission()
        await OneSignal.User.PushSubscription.optIn()
        const granted = Notification.permission === 'granted'
        setPushEnabled(granted)
        if (granted) {
          alert('Notifications enabled on this device!')
        } else {
          alert('Permission was blocked. Please allow notifications for Fenestrians in your phone browser or app settings.')
        }
      }
    } catch (error) {
      console.error('OneSignal toggle error:', error)
      alert('Could not update notification settings. Please check your phone notification permissions.')
    } finally {
      setAlertLoading(false)
    }
  }

  const saveLang = (value: string) => {
    setLang(value)
    localStorage.setItem('pref_lang', value)
  }

  return (
    <div className="mx-auto max-w-2xl">
      <Card className="border-border/40 bg-card/60 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-primary">
            <Settings className="h-5 w-5" />
            User Settings
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {user && !user.is_placeholder && (
            <div className="space-y-2 rounded-xl border border-primary/30 bg-primary/5 p-4">
              <h3 className="flex items-center gap-2 font-bold text-primary">
                <UserPlus className="h-4 w-4" />
                Invite a New Member
              </h3>
              <p className="text-xs text-muted-foreground">
                Generate a phone install shortcut link and temporary passcode for a new friend to join Fenestrians.
              </p>
              <Button
                onClick={() => navigate('/invite')}
                className="gold-gradient text-gold-foreground font-semibold gap-1.5"
              >
                Create Member Invite
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}

          <div className="space-y-2.5 rounded-xl border border-border/30 bg-muted/20 p-4">
            <h3 className="flex items-center gap-2 font-bold text-primary">
              <Bell className="h-4 w-4" />
              Push Notifications
            </h3>
            <p className="text-xs text-muted-foreground">
              Receive birthday, anniversary, and new member alerts on this device.
            </p>
            {pushEnabled && (
              <p className="flex items-center gap-1.5 text-xs font-medium text-emerald-400">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Notifications are active on this device
              </p>
            )}
            <Button
              onClick={toggleAlerts}
              disabled={alertLoading}
              variant={pushEnabled ? 'outline' : 'default'}
              className={pushEnabled ? '' : 'gold-gradient text-gold-foreground font-semibold'}
            >
              {alertLoading ? 'Updating...' : pushEnabled ? 'Disable Alerts on This Device' : 'Enable Alerts on This Device'}
            </Button>
          </div>

          <div className="space-y-3 rounded-xl border border-border/30 bg-muted/20 p-4">
            <h3 className="flex items-center gap-2 font-bold text-primary">
              <Globe className="h-4 w-4" />
              Chat &amp; Translation Preferences
            </h3>
            <div>
              <Label>Default Translation Language</Label>
              <select
                value={lang}
                onChange={e => saveLang(e.target.value)}
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-bold"
              >
                <option value="en">English (Default)</option>
                <option value="ta">Tamil</option>
                <option value="ml">Malayalam</option>
              </select>
              <p className="mt-2 text-[10px] italic text-muted-foreground">
                Note: Chat hub voice messages are always enabled via the hybrid input system. You can freely type using English, Tamil, and Malayalam directly from your local keyboard.
              </p>
            </div>
          </div>

          <div className="space-y-2 rounded-xl border border-border/30 bg-muted/20 p-4">
            <h3 className="flex items-center gap-2 font-bold text-primary">
              <Shield className="h-4 w-4" />
              Voice &amp; Video Controls
            </h3>
            <p className="flex items-center gap-2 text-xs text-muted-foreground">
              <Mic className="h-3.5 w-3.5 shrink-0" />
              All ecosystem calls are secured. Voice calls will automatically launch in audio-only mode.
            </p>
            <p className="flex items-center gap-2 text-xs text-muted-foreground">
              <Video className="h-3.5 w-3.5 shrink-0" />
              Video calls require explicit camera permission per session.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
