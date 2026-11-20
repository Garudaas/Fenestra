import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { UserPlus, Copy, Check, Download, ArrowRight, ArrowLeft, Smartphone, KeyRound, Link2 } from 'lucide-react'

type LangCode = 'en' | 'ta' | 'ml'

const INVITER_TEXT: Record<LangCode, {
  title: string
  subtitle: string
  howToTitle: string
  steps: string[]
  nameLabel: string
  namePlaceholder: string
  emptyNameAlert: string
  createBtn: string
  creatingBtn: string
  readyPrefix: string
  readySuffix: string
  linkLabel: string
  passcodeLabel: string
  copyBtn: string
  copiedBtn: string
  inviteAnotherBtn: string
  backBtn: string
}> = {
  en: {
    title: 'Invite a New Member',
    subtitle: 'Follow these four simple steps to bring a new friend into Fenestrians.',
    howToTitle: 'How to Invite Someone',
    steps: [
      'Type your friend’s full name in the box below and tap "Create Invite Link & Passcode".',
      'Copy the Invite Link that appears and send it to your friend on WhatsApp or text message.',
      'Copy the Temporary Passcode that appears and send it to your friend.',
      'Ask your friend to open the link on their phone to add the app icon to their screen, and then type the temporary passcode to finish signing up.',
    ],
    nameLabel: 'New Member’s Full Name *',
    namePlaceholder: 'Type full name here',
    emptyNameAlert: 'Please type the new member’s full name first.',
    createBtn: 'Create Invite Link & Passcode',
    creatingBtn: 'Preparing Invite...',
    readyPrefix: 'Ready for ',
    readySuffix: '! Now copy both items below and send them to your friend:',
    linkLabel: '1. Invite Link (Send this first)',
    passcodeLabel: '2. Temporary Passcode (Send this to complete sign-up)',
    copyBtn: 'Copy',
    copiedBtn: 'Copied',
    inviteAnotherBtn: 'Invite Another Friend',
    backBtn: 'Back to Dashboard',
  },
  ta: {
    title: 'புதிய உறுப்பினரை அழைக்கவும்',
    subtitle: 'உங்கள் நண்பரை Fenestrians குழுவில் இணைக்க கீழே உள்ள நான்கு எளிய வழிமுறைகளைப் பின்பற்றவும்.',
    howToTitle: 'புதியவரை அழைக்கும் முறை',
    steps: [
      'கீழே உள்ள கட்டத்தில் உங்கள் நண்பரின் முழுப் பெயரை எழுதி "அழைப்பு இணைப்பு & கடவுச்சொல் உருவாக்கு" என்பதை அழுத்தவும்.',
      'திரையில் தோன்றும் அழைப்பு இணைப்பை (Invite Link) நகலெடுத்து வாட்ஸ்அப் அல்லது குறுஞ்செய்தி மூலம் உங்கள் நண்பருக்கு அனுப்பவும்.',
      'அதன் கீழே தோன்றும் தற்காலிக கடவுச்சொல்லை (Temporary Passcode) நகலெடுத்து உங்கள் நண்பருக்கு அனுப்பவும்.',
      'உங்கள் நண்பர் அந்த இணைப்பைத் தன் கைபேசியில் திறந்து முகப்புத் திரையில் செயலியைச் சேர்த்துக் கொண்டு, பின்னர் அந்தத் தற்காலிக கடவுச்சொல்லை உள்ளிட்டுப் பதிவு செய்யச் சொல்லவும்.',
    ],
    nameLabel: 'புதிய உறுப்பினரின் முழுப் பெயர் *',
    namePlaceholder: 'முழுப் பெயரை இங்கே எழுதவும்',
    emptyNameAlert: 'முதலில் புதிய உறுப்பினரின் முழுப் பெயரை எழுதவும்.',
    createBtn: 'அழைப்பு இணைப்பு & கடவுச்சொல் உருவாக்கு',
    creatingBtn: 'தயாராகிறது...',
    readyPrefix: '',
    readySuffix: ' அவர்களுக்கான அழைப்பு தயார்! கீழே உள்ள இரண்டையும் நகலெடுத்து உங்கள் நண்பருக்கு அனுப்பவும்:',
    linkLabel: '1. அழைப்பு இணைப்பு (இதை முதலில் அனுப்பவும்)',
    passcodeLabel: '2. தற்காலிக கடவுச்சொல் (பதிவு செய்வதற்கு இதை அனுப்பவும்)',
    copyBtn: 'நகலெடு',
    copiedBtn: 'நகலெடுக்கப்பட்டது',
    inviteAnotherBtn: 'மற்றொரு நண்பரை அழைக்கவும்',
    backBtn: 'முகப்புப் பக்கத்திற்குத் திரும்பு',
  },
  ml: {
    title: 'പുതിയ അംഗത്തെ ക്ഷണിക്കുക',
    subtitle: 'നിങ്ങളുടെ സുഹൃത്തിനെ Fenestrians-ലേക്ക് ചേർക്കാൻ താഴെ പറയുന്ന നാല് ലളിതമായ ഘട്ടങ്ങൾ പാലിക്കുക.',
    howToTitle: 'പുതിയ ആളെ ക്ഷണിക്കേണ്ട വിധം',
    steps: [
      'താഴെയുള്ള കോളത്തിൽ നിങ്ങളുടെ സുഹൃത്തിന്റെ മുഴുവൻ പേര് എഴുതി "ക്ഷണ ലിങ്കും പാസ്‌കോഡും ഉണ്ടാക്കുക" എന്നതിൽ അമർത്തുക.',
      'സ്ക്രീനിൽ വരുന്ന ക്ഷണ ലിങ്ക് (Invite Link) പകർത്തി വാട്സ്ആപ്പ് വഴിയോ സന്ദേശം വഴിയോ സുഹൃത്തിന് അയച്ചുകൊടുക്കുക.',
      'അതിനു താഴെ വരുന്ന താൽക്കാലിക പാസ്‌കോഡ് (Temporary Passcode) പകർത്തി സുഹൃത്തിന് അയച്ചുകൊടുക്കുക.',
      'സുഹൃത്തിനോട് ആ ലിങ്ക് ഫോണിൽ തുറന്ന് ഹോം സ്ക്രീനിൽ ആപ്പ് ഐക്കൺ ചേർക്കാനും, തുടർന്ന് ഈ താൽക്കാലിക പാസ്‌കോഡ് നൽകി രജിസ്ട്രേഷൻ പൂർത്തിയാക്കാനും പറയുക.',
    ],
    nameLabel: 'പുതിയ അംഗത്തിന്റെ മുഴുവൻ പേര് *',
    namePlaceholder: 'മുഴുവൻ പേര് ഇവിടെ എഴുതുക',
    emptyNameAlert: 'ദയവായി പുതിയ അംഗത്തിന്റെ മുഴുവൻ പേര് ആദ്യം എഴുതുക.',
    createBtn: 'ക്ഷണ ലിങ്കും പാസ്‌കോഡും ഉണ്ടാക്കുക',
    creatingBtn: 'തയ്യാറാക്കുന്നു...',
    readyPrefix: '',
    readySuffix: ' എന്നയാൾക്കുള്ള ക്ഷണം തയ്യാറായി! താഴെ കാണുന്ന രണ്ടും പകർത്തി സുഹൃത്തിന് അയച്ചുകൊടുക്കുക:',
    linkLabel: '1. ക്ഷണ ലിങ്ക് (ഇത് ആദ്യം അയക്കുക)',
    passcodeLabel: '2. താൽക്കാലിക പാസ്‌കോഡ് (രജിസ്റ്റർ ചെയ്യാനായി ഇത് അയക്കുക)',
    copyBtn: 'പകർത്തുക',
    copiedBtn: 'പകർത്തി',
    inviteAnotherBtn: 'മറ്റൊരു സുഹൃത്തിനെ ക്ഷണിക്കുക',
    backBtn: 'ഡാഷ്ബോർഡിലേക്ക് മടങ്ങുക',
  },
}

function generatePasscode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let token = ''
  for (let i = 0; i < 6; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return `FEN-${token}`
}

function getSavedLang(): LangCode {
  const saved = localStorage.getItem('pref_lang')
  if (saved === 'ta' || saved === 'ml') return saved
  return 'en'
}

export default function InvitePage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const inviteCodeParam = searchParams.get('code')?.trim() || ''

  const [lang, setLang] = useState<LangCode>(getSavedLang)

  // Inviter state
  const [inviteeName, setInviteeName] = useState('')
  const [loading, setLoading] = useState(false)
  const [generatedUrl, setGeneratedUrl] = useState('')
  const [generatedPasscode, setGeneratedPasscode] = useState('')
  const [copiedUrl, setCopiedUrl] = useState(false)
  const [copiedCode, setCopiedCode] = useState(false)

  // Invitee landing state
  const [invitedMemberName, setInvitedMemberName] = useState('')
  const [canPromptInstall, setCanPromptInstall] = useState(false)
  const [installed, setInstalled] = useState(false)

  useEffect(() => {
    const syncLang = () => setLang(getSavedLang())
    syncLang()
    window.addEventListener('focus', syncLang)
    window.addEventListener('storage', syncLang)
    return () => {
      window.removeEventListener('focus', syncLang)
      window.removeEventListener('storage', syncLang)
    }
  }, [])

  useEffect(() => {
    if (inviteCodeParam) {
      localStorage.setItem('pending_invite_code', inviteCodeParam)
      supabase
        .from('alumni')
        .select('full_name')
        .eq('placeholder_code', inviteCodeParam)
        .eq('is_placeholder', true)
        .maybeSingle()
        .then(({ data }) => {
          if (data?.full_name) setInvitedMemberName(data.full_name)
        })
    } else if (!user || user.is_placeholder) {
      navigate('/')
    }

    const checkPrompt = () => {
      if ((window as any).deferredInstallPrompt) {
        setCanPromptInstall(true)
      }
    }
    checkPrompt()
    window.addEventListener('beforeinstallprompt', checkPrompt)
    window.addEventListener('appinstalled', () => setInstalled(true))
    return () => window.removeEventListener('beforeinstallprompt', checkPrompt)
  }, [inviteCodeParam, user, navigate])

  const handleCreateInvite = async () => {
    const t = INVITER_TEXT[lang]
    const trimmedName = inviteeName.trim()
    if (!trimmedName) {
      alert(t.emptyNameAlert)
      return
    }

    setLoading(true)
    const passcode = generatePasscode()

    const { error } = await supabase.from('alumni').insert([
      {
        full_name: trimmedName,
        placeholder_code: passcode,
        is_placeholder: true,
        custom_username: `pending_${passcode.toLowerCase().replace(/[^a-z0-9]/g, '')}`,
        custom_password: '',
        gender: '',
        hide_from_peers: false,
        hide_from_admin: false,
        is_admin: false,
      },
    ])

    setLoading(false)

    if (error) {
      alert(`Could not create invite: ${error.message}`)
      return
    }

    const url = `${window.location.origin}/invite?code=${encodeURIComponent(passcode)}`
    setGeneratedPasscode(passcode)
    setGeneratedUrl(url)
  }

  const copyText = async (text: string, type: 'url' | 'code') => {
    await navigator.clipboard.writeText(text)
    if (type === 'url') {
      setCopiedUrl(true)
      setTimeout(() => setCopiedUrl(false), 2000)
    } else {
      setCopiedCode(true)
      setTimeout(() => setCopiedCode(false), 2000)
    }
  }

  const handleInstallShortcut = async () => {
    const promptEvent = (window as any).deferredInstallPrompt
    if (promptEvent) {
      promptEvent.prompt()
      const choice = await promptEvent.userChoice
      if (choice?.outcome === 'accepted') {
        setInstalled(true)
      }
      ;(window as any).deferredInstallPrompt = null
      setCanPromptInstall(false)
    }
  }

  // Screen seen by the new friend when they open the invite link on their phone
  if (inviteCodeParam) {
    return (
      <div className="flex min-h-svh items-center justify-center p-6 relative overflow-hidden">
        <div className="absolute inset-0 royal-gradient" />
        <Card className="relative w-full max-w-md border-border/50 bg-card/85 backdrop-blur-xl shadow-2xl shadow-black/40">
          <CardHeader className="text-center space-y-3">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl border border-primary/30 bg-primary/10">
              <Smartphone className="h-5 w-5 text-primary" />
            </div>
            <CardTitle className="text-xl text-primary">
              {invitedMemberName ? `Welcome, ${invitedMemberName}!` : 'Welcome to Fenestrians!'}
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              Add the Fenestrians icon to your phone screen first, then complete your sign-up using the temporary passcode sent to you.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2.5 rounded-xl border border-primary/30 bg-primary/5 p-4">
              <p className="text-xs font-semibold text-primary">Step 1: Add App Icon to Your Phone</p>
              {installed ? (
                <p className="text-xs text-emerald-400 font-medium">
                  App icon added! You can open Fenestrians anytime from your phone screen.
                </p>
              ) : canPromptInstall ? (
                <Button
                  onClick={handleInstallShortcut}
                  className="w-full gold-gradient text-gold-foreground font-semibold gap-2"
                >
                  <Download className="h-4 w-4" />
                  Add App Icon to Phone
                </Button>
              ) : (
                <div className="space-y-1.5 text-xs text-muted-foreground">
                  <p>• <span className="font-semibold text-foreground">Android phone:</span> Tap the <span className="font-semibold text-foreground">⋮</span> three-dot menu at the top right and choose <span className="font-semibold text-foreground">Add to Home screen</span> or <span className="font-semibold text-foreground">Install app</span>.</p>
                  <p>• <span className="font-semibold text-foreground">iPhone:</span> Tap the <span className="font-semibold text-foreground">Share</span> button at the bottom and choose <span className="font-semibold text-foreground">Add to Home Screen</span>.</p>
                </div>
              )}
            </div>

            <div className="space-y-2 rounded-xl border border-border/40 bg-muted/20 p-4">
              <p className="text-xs font-semibold text-foreground">Step 2: Complete Your Sign-Up</p>
              <p className="text-xs text-muted-foreground">
                Your name will appear automatically on the next screen once you enter your temporary passcode.
              </p>
              <Button
                onClick={() => navigate(`/register?code=${encodeURIComponent(inviteCodeParam)}`)}
                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-semibold gap-1.5"
              >
                Continue to Sign-Up
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  const t = INVITER_TEXT[lang]

  // Screen seen by an approved member creating an invite
  return (
    <div className="flex min-h-svh items-center justify-center p-6 relative overflow-hidden">
      <div className="absolute inset-0 royal-gradient" />
      <Card className="relative w-full max-w-md border-border/50 bg-card/85 backdrop-blur-xl shadow-2xl shadow-black/40 max-h-[92vh] overflow-y-auto">
        <CardHeader className="text-center space-y-2">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl border border-primary/30 bg-primary/10">
            <UserPlus className="h-5 w-5 text-primary" />
          </div>
          <CardTitle className="text-xl text-primary">{t.title}</CardTitle>
          <p className="text-xs text-muted-foreground">{t.subtitle}</p>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Step-by-step plain-language instructions in the user's chosen Settings language */}
          <div className="space-y-2.5 rounded-xl border border-primary/25 bg-primary/5 p-4">
            <p className="text-xs font-bold text-primary">{t.howToTitle}</p>
            <ol className="space-y-2 text-xs text-foreground/90">
              {t.steps.map((stepText, idx) => (
                <li key={idx} className="flex items-start gap-2.5">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/20 text-[11px] font-bold text-primary">
                    {idx + 1}
                  </span>
                  <span className="leading-relaxed">{stepText}</span>
                </li>
              ))}
            </ol>
          </div>

          {!generatedUrl ? (
            <>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground px-1">{t.nameLabel}</label>
                <Input
                  placeholder={t.namePlaceholder}
                  value={inviteeName}
                  onChange={e => setInviteeName(e.target.value)}
                  className="bg-input/50 border-border/50"
                />
              </div>
              <Button
                onClick={handleCreateInvite}
                disabled={loading}
                className="w-full gold-gradient text-gold-foreground font-semibold shadow-lg"
              >
                {loading ? t.creatingBtn : t.createBtn}
              </Button>
            </>
          ) : (
            <div className="space-y-4">
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-300 leading-relaxed">
                {t.readyPrefix}
                <span className="font-bold">{inviteeName.trim()}</span>
                {t.readySuffix}
              </div>

              <div className="space-y-1.5">
                <label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                  <Link2 className="h-3.5 w-3.5 text-primary" />
                  {t.linkLabel}
                </label>
                <div className="flex gap-2">
                  <Input
                    readOnly
                    value={generatedUrl}
                    className="bg-input/50 border-border/50 text-xs"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => copyText(generatedUrl, 'url')}
                    className="shrink-0 gap-1"
                  >
                    {copiedUrl ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                    {copiedUrl ? t.copiedBtn : t.copyBtn}
                  </Button>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                  <KeyRound className="h-3.5 w-3.5 text-primary" />
                  {t.passcodeLabel}
                </label>
                <div className="flex gap-2">
                  <Input
                    readOnly
                    value={generatedPasscode}
                    className="bg-input/50 border-border/50 font-mono
