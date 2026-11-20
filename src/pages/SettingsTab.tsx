import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import OneSignal from 'react-onesignal'
import { useAuth } from '@/context/AuthContext'
import { supabase } from '@/lib/supabase'
import { APP_VERSION_INFO, type AppVersionData, type VersionEntry } from '@/lib/appVersion'
import { getUserStorageUsage, formatBytes } from '@/lib/fenestriansCore'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Settings,
  Bell,
  CheckCircle2,
  Globe,
  Shield,
  Video,
  Mic,
  UserPlus,
  ArrowRight,
  RefreshCw,
  Smartphone,
  AlertCircle,
  History,
  ChevronDown,
  ChevronUp,
  Lock,
  HardDrive,
} from 'lucide-react'

type CheckResultState =
  | { status: 'idle' }
  | { status: 'checking' }
  | { status: 'not-installed' }
  | { status: 'up-to-date'; current: AppVersionData }
  | { status: 'update-available'; current: AppVersionData; latest: AppVersionData }
  | { status: 'reinstall-required'; current: AppVersionData; latest: AppVersionData }

export default function SettingsTab() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [pushEnabled, setPushEnabled] = useState(false)
  const [alertLoading, setAlertLoading] = useState(false)
  const [lang, setLang] = useState('en')
  const [updateState, setUpdateState] = useState<CheckResultState>({ status: 'idle' })
  const [applyingUpdate, setApplyingUpdate] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [versionHistory, setVersionHistory] = useState<VersionEntry[]>(
    APP_VERSION_INFO.history && APP_VERSION_INFO.history.length > 0
      ? APP_VERSION_INFO.history
      : [APP_VERSION_INFO]
  )

  // Privacy & storage states
  const [allowProfilePicDownload, setAllowProfilePicDownload] = useState(true)
  const [allowMediaDownload, setAllowMediaDownload] = useState(true)
  const [defaultMediaPrivate, setDefaultMediaPrivate] = useState(false)
  const [savingPrivacy, setSavingPrivacy] = useState(false)
  const [storageStats, setStorageStats] = useState({ usedBytes: 0, quotaMb: 100 })

  useEffect(() => {
    const saved = localStorage.getItem('pref_lang') || 'en'
    setLang(saved)
    checkOneSignalState()
    loadVersionHistory()
    if (user && !user.is_placeholder) {
      loadPrivacyAndStorage(user.id)
    }
  }, [user])

  const loadPrivacyAndStorage = async (userId: number) => {
    const [{ data }, usage] = await Promise.all([
      supabase
        .from('alumni')
        .select('allow_profile_pic_download, allow_media_download, default_media_private')
        .eq('id', userId)
        .maybeSingle(),
      getUserStorageUsage(userId),
    ])

    if (data) {
      setAllowProfilePicDownload(data.allow_profile_pic_download ?? true)
      setAllowMediaDownload(data.allow_media_download ?? true)
      setDefaultMediaPrivate(data.default_media_private ?? false)
    }
    setStorageStats({ usedBytes: usage.usedBytes, quotaMb: usage.quotaMb })
  }

  const handleSavePrivacy = async (
    nextProfilePic: boolean,
    nextMediaDl: boolean,
    nextDefaultPriv: boolean
  ) => {
    if (!user) return
    setAllowProfilePicDownload(nextProfilePic)
    setAllowMediaDownload(nextMediaDl)
    setDefaultMediaPrivate(nextDefaultPriv)
    setSavingPrivacy(true)

    await supabase
      .from('alumni')
      .update({
        allow_profile_pic_download: nextProfilePic,
        allow_media_download: nextMediaDl,
        default_media_private: nextDefaultPriv,
      })
      .eq('id', user.id)

    setSavingPrivacy(false)
  }

  const loadVersionHistory = async () => {
    try {
      const res = await fetch(`/version.json?t=${Date.now()}`, { cache: 'no-store' })
      if (res.ok) {
        const data: AppVersionData = await res.json()
        if (Array.isArray(data.history) && data.history.length > 0) {
          setVersionHistory(data.history)
        }
      }
    } catch {
      // Fallback to bundled APP_VERSION_INFO.history
    }
  }

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

  const detectStandaloneInstalled = async (): Promise<boolean> => {
    const isStandaloneDisplay =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true ||
      document.referrer.startsWith('android-app://') ||
      Boolean((window as any).Capacitor || (window as any).cordova)

    if (isStandaloneDisplay) return true

    if ('getInstalledRelatedApps' in navigator) {
      try {
        const relatedApps = await (navigator as any).getInstalledRelatedApps()
        if (Array.isArray(relatedApps) && relatedApps.length > 0) {
          return true
        }
      } catch {
        // Ignore if unsupported
      }
    }

    return false
  }

  const handleCheckAppAndUpdates = async () => {
    setUpdateState({ status: 'checking' })
    try {
      const installed = await detectStandaloneInstalled()
      if (!installed) {
        setUpdateState({ status: 'not-installed' })
        return
      }

      const res = await fetch(`/version.json?t=${Date.now()}`, { cache: 'no-store' })
      if (!res.ok) {
        setUpdateState({ status: 'up-to-date', current: APP_VERSION_INFO })
        return
      }

      const latest: AppVersionData = await res.json()
      if (Array.isArray(latest.history) && latest.history.length > 0) {
        setVersionHistory(latest.history)
      }

      if (latest.version !== APP_VERSION_INFO.version) {
        if (latest.requiresReinstall) {
          setUpdateState({
            status: 'reinstall-required',
            current: APP_VERSION_INFO,
            latest,
          })
        } else {
          setUpdateState({
            status: 'update-available',
            current: APP_VERSION_INFO,
            latest,
          })
        }
      } else {
        setUpdateState({ status: 'up-to-date', current: latest })
      }
    } catch {
      setUpdateState({ status: 'up-to-date', current: APP_VERSION_INFO })
    }
  }

  const handleApplyUpdate = async () => {
    setApplyingUpdate(true)
    try {
      if ('caches' in window) {
        const keys = await caches.keys()
        await Promise.all(keys.map(k => caches.delete(k)))
      }
      if ('serviceWorker' in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations()
        await Promise.all(regs.map(r => r.update()))
      }
    } catch {
      // Proceed to reload
    }
    window.location.reload()
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
          {/* Media & Profile Picture Privacy */}
          {user && !user.is_placeholder && (
            <div className="space-y-3 rounded-xl border border-primary/30 bg-primary/5 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="flex items-center gap-2 font-bold text-primary">
                  <Lock className="h-4 w-4" />
                  Media &amp; Profile Picture Privacy
                </h3>
                <span className="flex items-center gap-1 text-[11px] font-medium text-muted-foreground">
                  <HardDrive className="h-3.5 w-3.5 text-primary" />
                  {formatBytes(storageStats.usedBytes)} / {storageStats.quotaMb} MB used
                </span>
              </div>

              <p className="text-xs text-muted-foreground">
                Control how other members can view, save, or capture your profile picture and shared files.
              </p>

              <div className="space-y-2.5 pt-1">
                <label className="flex items-start gap-3 rounded-lg border border-border/30 bg-background/50 p-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={allowProfilePicDownload}
                    disabled={savingPrivacy}
                    onChange={e =>
                      handleSavePrivacy(e.target.checked, allowMediaDownload, defaultMediaPrivate)
                    }
                    className="mt-0.5 h-4 w-4 accent-amber-500"
                  />
                  <div className="text-xs">
                    <p className="font-semibold text-foreground">
                      Allow members to enlarge &amp; save my Profile Picture
                    </p>
                    <p className="text-muted-foreground">
                      When turned off, members cannot save or download your profile photo from the Member Directory.
                    </p>
                  </div>
                </label>

                <label className="flex items-start gap-3 rounded-lg border border-border/30 bg-background/50 p-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={allowMediaDownload}
                    disabled={savingPrivacy}
                    onChange={e =>
                      handleSavePrivacy(allowProfilePicDownload, e.target.checked, defaultMediaPrivate)
                    }
                    className="mt-0.5 h-4 w-4 accent-amber-500"
                  />
                  <div className="text-xs">
                    <p className="font-semibold text-foreground">
                      Allow members to download my shared Gallery &amp; Folder files
                    </p>
                    <p className="text-muted-foreground">
                      When turned off, shared media is view-only without a download option.
                    </p>
                  </div>
                </label>

                <label className="flex items-start gap-3 rounded-lg border border-border/30 bg-background/50 p-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={defaultMediaPrivate}
                    disabled={savingPrivacy}
                    onChange={e =>
                      handleSavePrivacy(allowProfilePicDownload, allowMediaDownload, e.target.checked)
                    }
                    className="mt-0.5 h-4 w-4 accent-amber-500"
                  />
                  <div className="text-xs">
                    <p className="font-semibold text-foreground">
                      Keep newly uploaded files &amp; media private by default
                    </p>
                    <p className="text-muted-foreground">
                      Private files stay hidden from all members (and cannot be opened by admins, though storage space used is counted toward your quota).
                    </p>
                  </div>
                </label>
              </div>
            </div>
          )}

          {/* App Installation, Updates & Version History */}
          <div className="space-y-3 rounded-xl border border-primary/30 bg-primary/5 p-4">
            <div className="flex items-center justify-between gap-2">
              <h3 className="flex items-center gap-2 font-bold text-primary">
                <Smartphone className="h-4 w-4" />
                App Installation &amp; Updates
              </h3>
              <span className="text-[11px] font-medium text-muted-foreground">
                {APP_VERSION_INFO.formatted}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              Check whether the standalone Fenestrians app is installed on this device and whether it has the latest updates.
            </p>

            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                title="Check App Status & Updates"
                onClick={handleCheckAppAndUpdates}
                disabled={updateState.status === 'checking'}
                variant="outline"
                className="gap-1.5 border-primary/40 text-primary hover:bg-primary/10"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${updateState.status === 'checking' ? 'animate-spin' : ''}`} />
                {updateState.status === 'checking' ? 'Checking Device...' : 'Check App Status & Updates'}
              </Button>

              <Button
                type="button"
                variant="ghost"
                size="sm"
                title="View Update History"
                onClick={() => setShowHistory(prev => !prev)}
                className="gap-1.5 text-xs text-muted-foreground hover:text-foreground"
              >
                <History className="h-3.5 w-3.5 text-primary" />
                {showHistory ? 'Hide Update History' : `View Update History (${versionHistory.length})`}
                {showHistory ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
              </Button>
            </div>

            {showHistory && (
              <div className="space-y-2 rounded-lg border border-border/40 bg-background/70 p-3 max-h-64 overflow-y-auto">
                <p className="text-[11px] font-bold uppercase tracking-wider text-primary">
                  Recent App Updates
                </p>
                <div className="space-y-2.5">
                  {versionHistory.map((item, idx) => (
                    <div
                      key={`${item.version}-${idx}`}
                      className="rounded-md border border-border/30 bg-muted/20 p-2.5 space-y-1"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-1.5">
                        <div className="flex items-center gap-1.5">
                          <span className="rounded bg-primary/20 px-1.5 py-0.5 text-[11px] font-bold text-primary">
                            {item.version}
                          </span>
                          <span
                            className={
                              item.type === 'major'
                                ? 'rounded bg-emerald-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-300'
                                : 'rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground'
                            }
                          >
                            {item.type === 'major' ? 'Major Update' : 'Minor Update'}
                          </span>
                          {item.requiresReinstall && (
                            <span className="rounded bg-red-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-red-300">
                              Reinstall Required
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] text-muted-foreground">{item.timestamp}</span>
                      </div>
                      <p className="text-xs text-foreground/90 leading-relaxed">{item.summary}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {updateState.status === 'not-installed' && (
              <div className="space-y-2.5 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3.5">
                <p className="text-xs font-semibold text-amber-200">
                  The Fenestrians app is not installed on this device. Would you like to install it now?
                </p>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => navigate('/install')}
                    className="gold-gradient text-gold-foreground font-semibold"
                  >
                    Yes, Install App
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => setUpdateState({ status: 'idle' })}
                    className="text-xs"
                  >
                    No, Later
                  </Button>
                </div>
              </div>
            )}

            {updateState.status === 'up-to-date' && (
              <div className="space-y-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3.5">
                <p className="flex items-center gap-1.5 text-xs font-semibold text-emerald-300">
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                  Your Fenestrians app is installed and completely up to date!
                </p>
                <p className="text-[11px] text-emerald-100/80">
                  Current Version: <span className="font-semibold">{updateState.current.formatted}</span>
                </p>
                <p className="text-[11px] text-muted-foreground">
                  Latest Change: {updateState.current.summary}
                </p>
              </div>
            )}

            {updateState.status === 'update-available' && (
              <div className="space-y-2.5 rounded-lg border border-primary/40 bg-background/80 p-3.5">
                <p className="text-xs font-bold text-primary">
                  A new update ({updateState.latest.version}) is available!
                </p>
                <p className="text-xs text-muted-foreground">
                  Installed: <span className="text-foreground">{updateState.current.formatted}</span>
                  <br />
                  Latest: <span className="text-foreground">{updateState.latest.formatted}</span>
                  <br />
                  What changed: <span className="text-foreground">{updateState.latest.summary}</span>
                </p>
                <p className="text-xs font-medium text-foreground">
                  Do you want to update the app now?
                </p>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    disabled={applyingUpdate}
                    onClick={handleApplyUpdate}
                    className="gold-gradient text-gold-foreground font-semibold"
                  >
                    {applyingUpdate ? 'Updating...' : 'Yes, Update Now'}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => setUpdateState({ status: 'idle' })}
                    className="text-xs"
                  >
                    Not Now
                  </Button>
                </div>
              </div>
            )}

            {updateState.status === 'reinstall-required' && (
              <div className="space-y-2.5 rounded-lg border border-red-500/40 bg-red-500/10 p-3.5">
                <p className="flex items-center gap-1.5 text-xs font-bold text-red-300">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  Reinstall Required for {updateState.latest.version}
                </p>
                <p className="text-xs text-foreground/90">
                  {updateState.latest.summary} — Please reinstall the app icon by following these steps:
                </p>
                <ol className="list-decimal list-inside space-y-1 text-xs text-muted-foreground">
                  <li>Press and hold the existing <span className="font-semibold text-foreground">Fenestrians</span> icon on your phone screen and tap <span className="font-semibold text-foreground">Uninstall</span> or <span className="font-semibold text-foreground">Remove</span>.</li>
                  <li>Tap the button below to open the installation guide and add the updated app icon back to your screen.</li>
                </ol>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => navigate('/install')}
                  className="gold-gradient text-gold-foreground font-semibold"
                >
                  Open Reinstall Guide
                </Button>
              </div>
            )}
          </div>

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
                title="Create Member Invite"
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
              title={pushEnabled ? 'Disable Alerts on This Device' : 'Enable Alerts on This Device'}
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
