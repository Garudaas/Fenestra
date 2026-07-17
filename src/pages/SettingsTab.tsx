import { useState, useEffect } from 'react'
import { useAuth } from '@/context/AuthContext'
import { supabase } from '@/lib/supabase'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { VAPID_PUBLIC_KEY } from '@/lib/constants'
import { Settings, Bell, BellOff, Globe, Shield, Video, Mic } from 'lucide-react'

export default function SettingsTab() {
  const { user } = useAuth()
  const [alertState, setAlertState] = useState<'enabled' | 'disabled' | 'unsupported'>('disabled')
  const [alertLoading, setAlertLoading] = useState(false)
  const [lang, setLang] = useState('en')

  useEffect(() => {
    checkAlertState()
    const saved = localStorage.getItem('pref_lang') || 'en'
    setLang(saved)
  }, [])

  const checkAlertState = async () => {
    if (!('serviceWorker' in navigator && 'PushManager' in window)) {
      setAlertState('unsupported')
      return
    }
    const registration = await navigator.serviceWorker.register('/sw.js')
    const existing = await registration.pushManager.getSubscription()
    setAlertState(existing ? 'enabled' : 'disabled')
  }

  const toggleAlerts = async () => {
    if (!user) return
    if (!('serviceWorker' in navigator && 'PushManager' in window)) {
      alert('Push notifications are not supported in this browser.')
      return
    }

    setAlertLoading(true)
    try {
      const registration = await navigator.serviceWorker.register('/sw.js')
      const existing = await registration.pushManager.getSubscription()

      if (existing) {
        await existing.unsubscribe()
        await supabase.from('push_subscriptions').delete().eq('alumni_id', user.id)
        alert('Alerts Disabled.')
      } else {
        const permission = await Notification.requestPermission()
        if (permission !== 'granted') throw new Error('Permission not granted')

        const newSub = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: VAPID_PUBLIC_KEY,
        })

        await supabase.from('push_subscriptions').delete().eq('alumni_id', user.id)
        await supabase.from('push_subscriptions').insert([{
          alumni_id: user.id,
          sub_data: JSON.parse(JSON.stringify(newSub)),
        }])
        alert('Push Notifications enabled!')
      }
      await checkAlertState()
    } catch (error: any) {
      console.error('Push error:', error)
      alert('Failed to process request. Check console.')
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
          <div className="space-y-2 rounded-xl border border-border/30 bg-muted/20 p-4">
            <h3 className="flex items-center gap-2 font-bold text-primary">
              <Bell className="h-4 w-4" />
              Push Notifications
            </h3>
            <p className="text-xs text-muted-foreground">Receive background alerts for new chat messages and ecosystem events.</p>
            {alertState === 'unsupported' ? (
              <p className="flex items-center gap-1.5 text-xs text-destructive">
                <BellOff className="h-3.5 w-3.5" />
                Push notifications are not supported in this browser.
              </p>
            ) : (
              <Button
                onClick={toggleAlerts}
                disabled={alertLoading}
                variant={alertState === 'enabled' ? 'outline' : 'default'}
                className={alertState === 'enabled' ? '' : 'gold-gradient text-gold-foreground'}
              >
                {alertState === 'enabled' ? 'Disable Alerts' : 'Enable Alerts'}
              </Button>
            )}
          </div>

          <div className="space-y-3 rounded-xl border border-border/30 bg-muted/20 p-4">
            <h3 className="flex items-center gap-2 font-bold text-primary">
              <Globe className="h-4 w-4" />
              Chat & Translation Preferences
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
              Voice & Video Controls
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
