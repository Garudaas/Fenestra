import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { supabase } from '@/lib/supabase'
import { APP_VERSION_INFO, type AppVersionData } from '@/lib/appVersion'
import { formatFullDate } from '@/lib/formatters'
import {
  isBiometricSupported,
  getSavedBiometricCredential,
  registerBiometricPasskey,
  removeBiometricCredential,
  type SavedBiometricCredential,
} from '@/lib/biometricAuth'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Settings,
  Shield,
  Download,
  UserPlus,
  Bell,
  Video,
  ChevronDown,
  ChevronUp,
  Save,
  RefreshCw,
  Copy,
  Check,
  ExternalLink,
  Fingerprint,
  Trash2,
} from 'lucide-react'

type SettingsSectionId =
  | 'privacy'
  | 'biometrics'
  | 'updates'
  | 'invite'
  | 'notifications_chat'
  | 'voice_video'

function generateQuickPasscode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let token = ''
  for (let i = 0; i < 6; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return `FEN-${token}`
}

export default function SettingsTab() {
  const { user } = useAuth()
  const navigate = useNavigate()

  const [openSection, setOpenSection] = useState<SettingsSectionId | null>('privacy')

  // 1. Media & Profile Picture Privacy
  const [allowPicDownload, setAllowPicDownload] = useState(true)
  const [allowMediaDownload, setAllowMediaDownload] = useState(true)
  const [defaultMediaPrivate, setDefaultMediaPrivate] = useState(false)
  const [savingPrivacy, setSavingPrivacy] = useState(false)

  // 2. Biometric Login
  const [savedBiometric, setSavedBiometric] = useState<SavedBiometricCredential | null>(() =>
    getSavedBiometricCredential()
  )
  const [bioBusy, setBioBusy] = useState(false)

  // 3. App Installation & Updates
  const [latestVersion, setLatestVersion] = useState<AppVersionData>(APP_VERSION_INFO)
  const [checkingUpdate, setCheckingUpdate] = useState(false)

  // 4. Invite New Member
  const [inviteName, setInviteName] = useState('')
  const [creatingInvite, setCreatingInvite] = useState(false)
  const [inviteUrl, setInviteUrl] = useState('')
  const [inviteCode, setInviteCode] = useState('')
  const [copiedInvite, setCopiedInvite] = useState<'url' | 'code' | null>(null)

  // 5. Push Notifications, Chat & Translation Preferences
  const [prefLang, setPrefLang] = useState(() => localStorage.getItem('pref_lang') || 'en')
  const [mentionToneEnabled, setMentionToneEnabled] = useState(
    () => localStorage.getItem('fenestrians_mention_tone') !== 'off'
  )

  // 6. Voice & Video Controls
  const [defaultVoiceRoom, setDefaultVoiceRoom] = useState(
    () => localStorage.getItem('fenestrians_default_voice_room') || 'Audio-Lounge'
  )
  const [defaultVideoRoom, setDefaultVideoRoom] = useState(
    () => localStorage.getItem('fenestrians_default_video_room') || 'Main-Room'
  )
  const [savedMediaPrefs, setSavedMediaPrefs] = useState(false)

  useEffect(() => {
    if (!user) return
    supabase
      .from('alumni')
      .select('allow_profile_pic_download, allow_media_download, default_media_private')
      .eq('id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setAllowPicDownload(data.allow_profile_pic_download ?? true)
          setAllowMediaDownload(data.allow_media_download ?? true)
          setDefaultMediaPrivate(data.default_media_private ?? false)
        }
      })
  }, [user])

  const toggleSection = (id: SettingsSectionId) => {
    setOpenSection(prev => (prev === id ? null : id))
  }

  const handleSavePrivacy = async () => {
    if (!user) return
    setSavingPrivacy(true)
    await supabase
      .from('alumni')
      .update({
        allow_profile_pic_download: allowPicDownload,
        allow_media_download: allowMediaDownload,
        default_media_private: defaultMediaPrivate,
      })
      .eq('id', user.id)
    setSavingPrivacy(false)
    alert('Media & profile picture privacy saved!')
  }

  const handleEnableBiometrics = async () => {
    if (!user) return
    setBioBusy(true)
    const res = await registerBiometricPasskey({
      userId: user.id,
      username: user.custom_username,
      fullName: user.full_name,
    })
    setBioBusy(false)
    if (!res.success) {
      alert(res.error || 'Biometric setup failed.')
      return
    }
    setSavedBiometric(getSavedBiometricCredential())
    alert('Fingerprint / Face ID login enabled on this device!')
  }

  const handleDisableBiometrics = () => {
    removeBiometricCredential()
    setSavedBiometric(null)
  }

  const handleCheckUpdate = async () => {
    setCheckingUpdate(true)
    try {
      const res = await fetch(`/version.json?t=${Date.now()}`, { cache: 'no-store' })
      if (res.ok) {
        const data: AppVersionData = await res.json()
        setLatestVersion(data)
        if (data.version !== APP_VERSION_INFO.version) {
          if ('caches' in window) {
            const keys = await caches.keys()
            await Promise.all(keys.map(k => caches.delete(k)))
          }
          window.location.reload()
          return
        }
      }
      alert(`App is up to date (${APP_VERSION_INFO.version})!`)
    } finally {
      setCheckingUpdate(false)
    }
  }

  const handleQuickInvite = async () => {
    const trimmed = inviteName.trim()
    if (!trimmed) {
      alert('Please enter the new member’s full name.')
      return
    }
    setCreatingInvite(true)
    const code = generateQuickPasscode()
    const { error } = await supabase.from('alumni').insert([
      {
        full_name: trimmed,
        placeholder_code: code,
        is_placeholder: true,
        custom_username: `pending_${code.toLowerCase().replace(/[^a-z0-9]/g, '')}`,
        custom_password: '',
        gender: 'Male',
        hide_from_peers: false,
        hide_from_admin: false,
        is_admin: false,
      },
    ])
    setCreatingInvite(false)
    if (error) {
      alert('Error creating invite: ' + error.message)
      return
    }
    setInviteCode(code)
    setInviteUrl(`${window.location.origin}/invite?code=${encodeURIComponent(code)}`)
  }

  const handleSaveChatAndNotifPrefs = () => {
    localStorage.setItem('pref_lang', prefLang)
    localStorage.setItem('fenestrians_mention_tone', mentionToneEnabled ? 'on' : 'off')
    alert('Push notification, chat & translation preferences saved!')
  }

  const handleSaveVoiceVideoPrefs = () => {
    localStorage.setItem('fenestrians_default_voice_room', defaultVoiceRoom.trim() || 'Audio-Lounge')
    localStorage.setItem('fenestrians_default_video_room', defaultVideoRoom.trim() || 'Main-Room')
    setSavedMediaPrefs(true)
    setTimeout(() => setSavedMediaPrefs(false), 2500)
  }

  if (!user) return null

  const renderAccordionHeader = (
    id: SettingsSectionId,
    title: string,
    subtitle: string,
    icon: React.ReactNode
  ) => {
    const isOpen = openSection === id
    return (
      <button
        type="button"
        onClick={() => toggleSection(id)}
        className="flex w-full items-center justify-between gap-3 p-4 text-left transition-colors hover:bg-primary/5"
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-primary/30 bg-primary/10 text-primary">
            {icon}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-foreground truncate">{title}</p>
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
  }

  return (
    <div className="mx-auto max-w-2xl space-y-3">
      <Card className="border-border/40 bg-card/70 backdrop-blur-sm">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-primary">
            <Settings className="h-5 w-5" />
            User Settings &amp; Privacy
          </CardTitle>
        </CardHeader>
        <CardContent className="text-xs text-muted-foreground">
          Tap any category below to expand and configure your preferences.
        </CardContent>
      </Card>

      {/* Tab 1: Media & Profile Picture Privacy */}
      <Card className="overflow-hidden border-border/40 bg-card/70">
        {renderAccordionHeader(
          'privacy',
          'Media & Profile Picture Privacy',
          'Control who can download your profile picture or shared files',
          <Shield className="h-4 w-4" />
        )}
        {openSection === 'privacy' && (
          <CardContent className="space-y-3 border-t border-border/30 pt-4 text-xs">
            <label className="flex items-center gap-2.5 cursor-pointer">
              <Checkbox
                checked={allowPicDownload}
                onCheckedChange={v => setAllowPicDownload(Boolean(v))}
              />
              <span>Allow other members to save/download my profile picture</span>
            </label>

            <label className="flex items-center gap-2.5 cursor-pointer">
              <Checkbox
                checked={allowMediaDownload}
                onCheckedChange={v => setAllowMediaDownload(Boolean(v))}
              />
              <span>Allow other members to download my shared photos &amp; folder files by default</span>
            </label>

            <label className="flex items-center gap-2.5 cursor-pointer">
              <Checkbox
                checked={defaultMediaPrivate}
                onCheckedChange={v => setDefaultMediaPrivate(Boolean(v))}
              />
              <span>Keep newly uploaded photos and folder files private by default</span>
            </label>

            <Button
              type="button"
              size="sm"
              disabled={savingPrivacy}
              onClick={handleSavePrivacy}
              className="gold-gradient text-gold-foreground font-semibold gap-1.5"
            >
              <Save className="h-3.5 w-3.5" />
              {savingPrivacy ? 'Saving...' : 'Save Privacy Settings'}
            </Button>
          </CardContent>
        )}
      </Card>

      {/* Tab 2: Fingerprint / Face ID Biometric Login */}
      <Card className="overflow-hidden border-border/40 bg-card/70">
        {renderAccordionHeader(
          'biometrics',
          'Fingerprint / Face ID Biometric Login',
          savedBiometric && savedBiometric.userId === user.id
            ? `Enabled for ${savedBiometric.fullName}`
            : 'Enable one-touch biometric sign-in on this device',
          <Fingerprint className="h-4 w-4" />
        )}
        {openSection === 'biometrics' && (
          <CardContent className="space-y-3 border-t border-border/30 pt-4 text-xs">
            {!isBiometricSupported() ? (
              <p className="text-muted-foreground">
                This browser or device does not support WebAuthn Fingerprint / Face ID login.
              </p>
            ) : savedBiometric && savedBiometric.userId === user.id ? (
              <div className="space-y-2.5">
                <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-3 text-emerald-300">
                  Fingerprint / Face ID is active for <strong>{savedBiometric.fullName}</strong> (Linked on{' '}
                  {formatFullDate(savedBiometric.registeredAt)}).
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="destructive"
                  onClick={handleDisableBiometrics}
                  className="gap-1.5"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Remove Biometric Link from This Device
                </Button>
              </div>
            ) : (
              <div className="space-y-2.5">
                <p className="text-muted-foreground">
                  Link your phone or computer’s Fingerprint sensor or Face ID so you can sign in with one touch without typing your password.
                </p>
                <Button
                  type="button"
                  size="sm"
                  disabled={bioBusy}
                  onClick={handleEnableBiometrics}
                  className="gold-gradient text-gold-foreground font-semibold gap-1.5"
                >
                  <Fingerprint className="h-4 w-4" />
                  {bioBusy ? 'Setting up...' : 'Link Fingerprint / Face ID Now'}
                </Button>
              </div>
            )}
          </CardContent>
        )}
      </Card>

      {/* Tab 3: App Installation & Updates */}
      <Card className="overflow-hidden border-border/40 bg-card/70">
        {renderAccordionHeader(
          'updates',
          'App Installation & Updates',
          `Current Version: ${APP_VERSION_INFO.version} • Smart install & update tools`,
          <Download className="h-4 w-4" />
        )}
        {openSection === 'updates' && (
          <CardContent className="space-y-3 border-t border-border/30 pt-4 text-xs">
            <div className="rounded-lg border border-border/40 bg-muted/20 p-3 space-y-1">
              <p>
                Installed App Version: <strong className="text-primary">{APP_VERSION_INFO.version}</strong>
              </p>
              <p>
                Latest Server Version: <strong className="text-foreground">{latestVersion.version}</strong>
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                disabled={checkingUpdate}
                onClick={handleCheckUpdate}
                className="gold-gradient text-gold-foreground font-semibold gap-1.5"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${checkingUpdate ? 'animate-spin' : ''}`} />
                {checkingUpdate ? 'Checking...' : 'Check & Apply Latest Update'}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => navigate('/app')}
                className="gap-1.5"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                Open Smart App Launcher
              </Button>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Tab 4: Invite New Member */}
      <Card className="overflow-hidden border-border/40 bg-card/70">
        {renderAccordionHeader(
          'invite',
          'Invite New Member',
          'Generate an invite link and temporary passcode for a classmate',
          <UserPlus className="h-4 w-4" />
        )}
        {openSection === 'invite' && (
          <CardContent className="space-y-3 border-t border-border/30 pt-4 text-xs">
            <div className="flex gap-2">
              <Input
                value={inviteName}
                onChange={e => setInviteName(e.target.value)}
                placeholder="Enter new member's full name..."
                className="text-xs"
              />
              <Button
                type="button"
                size="sm"
                disabled={creatingInvite}
                onClick={handleQuickInvite}
                className="gold-gradient text-gold-foreground font-semibold shrink-0"
              >
                {creatingInvite ? 'Creating...' : 'Generate Invite'}
              </Button>
            </div>

            {inviteUrl && (
              <div className="space-y-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate font-mono text-[11px] text-foreground">{inviteUrl}</span>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={async () => {
                      await navigator.clipboard.writeText(inviteUrl)
                      setCopiedInvite('url')
                      setTimeout(() => setCopiedInvite(null), 2000)
                    }}
                    className="h-7 gap-1 shrink-0"
                  >
                    {copiedInvite === 'url' ? (
                      <Check className="h-3 w-3 text-emerald-400" />
                    ) : (
                      <Copy className="h-3 w-3" />
                    )}
                    Copy Link
                  </Button>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono font-bold text-primary">Passcode: {inviteCode}</span>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={async () => {
                      await navigator.clipboard.writeText(inviteCode)
                      setCopiedInvite('code')
                      setTimeout(() => setCopiedInvite(null), 2000)
                    }}
                    className="h-7 gap-1 shrink-0"
                  >
                    {copiedInvite === 'code' ? (
                      <Check className="h-3 w-3 text-emerald-400" />
                    ) : (
                      <Copy className="h-3 w-3" />
                    )}
                    Copy Code
                  </Button>
                </div>
              </div>
            )}

            <Button
              type="button"
              size="sm"
              variant="link"
              onClick={() => navigate('/invite')}
              className="h-auto p-0 text-primary text-xs"
            >
              Open Full Multi-Language Invite Guide →
            </Button>
          </CardContent>
        )}
      </Card>

      {/* Tab 5: Push Notifications, Chat & Translation Preferences */}
      <Card className="overflow-hidden border-border/40 bg-card/70">
        {renderAccordionHeader(
          'notifications_chat',
          'Push Notifications, Chat & Translation Preferences',
          'Configure device alerts, mention sounds, and chat translation language',
          <Bell className="h-4 w-4" />
        )}
        {openSection === 'notifications_chat' && (
          <CardContent className="space-y-3 border-t border-border/30 pt-4 text-xs">
            <div className="space-y-1">
              <label className="font-semibold text-foreground">Preferred Language for Chat Translation</label>
              <select
                value={prefLang}
                onChange={e => setPrefLang(e.target.value)}
                className="w-full h-9 rounded-md border border-border/50 bg-background px-3 text-xs"
              >
                <option value="en">English</option>
                <option value="ta">Tamil (தமிழ்)</option>
                <option value="ml">Malayalam (മലയാളം)</option>
              </select>
            </div>

            <label className="flex items-center gap-2.5 cursor-pointer">
              <Checkbox
                checked={mentionToneEnabled}
                onCheckedChange={v => setMentionToneEnabled(Boolean(v))}
              />
              <span>Play chime tone when someone mentions me with @ in Chat</span>
            </label>

            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                onClick={handleSaveChatAndNotifPrefs}
                className="gold-gradient text-gold-foreground font-semibold gap-1.5"
              >
                <Save className="h-3.5 w-3.5" />
                Save Chat &amp; Alert Preferences
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => navigate('/notifications')}
              >
                Open Notifications Center
              </Button>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Tab 6: Voice & Video Controls */}
      <Card className="overflow-hidden border-border/40 bg-card/70">
        {renderAccordionHeader(
          'voice_video',
          'Voice & Video Controls',
          'Default audio lounge & video room settings',
          <Video className="h-4 w-4" />
        )}
        {openSection === 'voice_video' && (
          <CardContent className="space-y-3 border-t border-border/30 pt-4 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="font-semibold text-foreground">Default Voice Lounge Room</label>
                <Input
                  value={defaultVoiceRoom}
                  onChange={e => setDefaultVoiceRoom(e.target.value)}
                  className="text-xs font-mono"
                />
              </div>
              <div className="space-y-1">
                <label className="font-semibold text-foreground">Default Video Chat Room</label>
                <Input
                  value={defaultVideoRoom}
                  onChange={e => setDefaultVideoRoom(e.target.value)}
                  className="text-xs font-mono"
                />
              </div>
            </div>

            <Button
              type="button"
              size="sm"
              onClick={handleSaveVoiceVideoPrefs}
              className="gold-gradient text-gold-foreground font-semibold gap-1.5"
            >
              <Save className="h-3.5 w-3.5" />
              {savedMediaPrefs ? 'Saved!' : 'Save Voice & Video Settings'}
            </Button>
          </CardContent>
        )}
      </Card>
    </div>
  )
}
