import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Smartphone, Download, Copy, Check, ArrowLeft, Camera, ExternalLink } from 'lucide-react'

type LangCode = 'en' | 'ta' | 'ml'

const INSTALL_GUIDE_TEXT: Record<LangCode, {
  title: string
  subtitle: string
  screenshotTitle: string
  screenshotBody: string
  linkHeading: string
  stepsHeading: string
  androidTitle: string
  androidSteps: string[]
  iphoneTitle: string
  iphoneSteps: string[]
  copyBtn: string
  copiedBtn: string
  autoInstallBtn: string
  installedDoneMsg: string
  manualFallbackAlert: string
  backBtn: string
}> = {
  en: {
    title: 'Install Fenestrians App',
    subtitle: 'Add Fenestrians to your phone home screen for one-tap access and instant alerts.',
    screenshotTitle: 'Important: Take a Screenshot Now',
    screenshotBody: 'Please take a screenshot of this page before you begin, so you can easily read the steps while opening your phone browser menu.',
    linkHeading: 'Official App Web Link (Tap to Open)',
    stepsHeading: 'How to Install on Your Phone',
    androidTitle: 'For Android Phones (Chrome)',
    androidSteps: [
      'Open the clickable link below in your Chrome browser.',
      'Tap the "Install Fenestrians App Automatically" button at the top of this page.',
      'If no pop-up appears, tap the three dots (⋮) at the top-right corner of Chrome and tap "Install app" or "Add to Home screen".',
      'Tap "Install" or "Add" to place the Fenestrians icon on your home screen.',
    ],
    iphoneTitle: 'For iPhones (Safari)',
    iphoneSteps: [
      'Open the clickable link below in the Safari browser.',
      'Tap the Share button (square with an upward arrow) at the bottom of the screen.',
      'Scroll down the menu and tap "Add to Home Screen".',
      'Tap "Add" at the top-right corner to place the Fenestrians icon on your home screen.',
    ],
    copyBtn: 'Copy Instructions & Web Link',
    copiedBtn: 'Instructions & Link Copied!',
    autoInstallBtn: 'Install Fenestrians App Automatically',
    installedDoneMsg: 'Fenestrians is now installed on your device! You can open it from your home screen.',
    manualFallbackAlert: 'Your browser requires using its menu button to finish installing. Please follow the 4 steps shown below on this page (or use the screenshot you took).',
    backBtn: 'Back to App',
  },
  ta: {
    title: 'Fenestrians செயலியை நிறுவவும்',
    subtitle: 'எளிதாகப் பயன்படுத்தவும் உடனடி அறிவிப்புகளைப் பெறவும் உங்கள் கைபேசி முகப்புத் திரையில் Fenestrians செயலியைச் சேர்க்கவும்.',
    screenshotTitle: 'முக்கியம்: இப்போதே ஸ்கிரீன்ஷாட் (Screenshot) எடுக்கவும்',
    screenshotBody: 'தொடங்குவதற்கு முன் இந்தப் பக்கத்தை ஸ்கிரீன்ஷாட் எடுத்து வைத்துக்கொள்ளவும். அப்போதுதான் உலாவியின் (Browser) மெனுவைத் திறக்கும்போது வழிமுறைகளைப் பார்த்துச் செய்ய முடியும்.',
    linkHeading: 'செயலியின் இணைய இணைப்பு (திறக்கத் தொடவும்)',
    stepsHeading: 'கைபேசியில் நிறுவும் வழிமுறைகள்',
    androidTitle: 'ஆண்ட்ராய்டு கைபேசிகளுக்கு (Chrome)',
    androidSteps: [
      'கீழே உள்ள இணைய இணைப்பை Chrome உலாவியில் திறக்கவும்.',
      'இந்தப் பக்கத்தின் மேலே உள்ள "தானாகவே செயலியை நிறுவு" பொத்தானை அழுத்தவும்.',
      'திரையில் அறிவிப்பு வரவில்லை என்றால், Chrome மேல் வலது மூலையில் உள்ள மூன்று புள்ளிகளை (⋮) அழுத்தி "Install app" அல்லது "Add to Home screen" என்பதைத் தேர்ந்தெடுக்கவும்.',
      '"Install" அல்லது "Add" என்பதை அழுத்தினால் முகப்புத் திரையில் Fenestrians ஐகான் சேர்ந்துவிடும்.',
    ],
    iphoneTitle: 'ஐபோன்களுக்கு (Safari)',
    iphoneSteps: [
      'கீழே உள்ள இணைய இணைப்பை Safari உலாவியில் திறக்கவும்.',
      'திரையின் கீழே உள்ள Share பொத்தானை (மேல் நோக்கிய அம்புக்குறி கொண்ட சதுரம்) அழுத்தவும்.',
      'கீழே நகர்த்தி "Add to Home Screen" என்பதைத் தேர்ந்தெடுக்கவும்.',
      'மேல் வலது மூலையில் உள்ள "Add" என்பதை அழுத்தினால் முகப்புத் திரையில் Fenestrians ஐகான் சேர்ந்துவிடும்.',
    ],
    copyBtn: 'வழிமுறைகள் & இணைப்பை நகலெடு',
    copiedBtn: 'நகலெடுக்கப்பட்டது!',
    autoInstallBtn: 'தானாகவே செயலியை நிறுவு',
    installedDoneMsg: 'Fenestrians செயலி உங்கள் கைபேசியில் நிறுவப்பட்டுவிட்டது!',
    manualFallbackAlert: 'உங்கள் உலாவியின் மேல் அல்லது கீழ் உள்ள மெனுவைப் பயன்படுத்தி நிறுவ வேண்டும். கீழே உள்ள வழிமுறைகளைப் பின்பற்றவும்.',
    backBtn: 'பின்செல்க',
  },
  ml: {
    title: 'Fenestrians ആപ്പ് ഇൻസ്റ്റാൾ ചെയ്യുക',
    subtitle: 'വേഗത്തിൽ തുറക്കാനും അറിയിപ്പുകൾ ലഭിക്കാനും നിങ്ങളുടെ ഫോണിന്റെ ഹോം സ്ക്രീനിൽ Fenestrians ആപ്പ് ചേർക്കുക.',
    screenshotTitle: 'പ്രധാനം: ഇപ്പോൾ തന്നെ ഒരു സ്ക്രീൻഷോട്ട് എടുക്കുക',
    screenshotBody: 'തുടങ്ങുന്നതിന് മുൻപ് ഈ പേജിന്റെ ഒരു സ്ക്രീൻഷോട്ട് എടുത്തു വെക്കുക. ബ്രൗസർ മെനു തുറക്കുമ്പോൾ നിർദ്ദേശങ്ങൾ നോക്കി ചെയ്യാൻ ഇത് സഹായിക്കും.',
    linkHeading: 'ആപ്പ് വെബ് ലിങ്ക് (തുറക്കാൻ തൊടുക)',
    stepsHeading: 'ഫോണിൽ ഇൻസ്റ്റാൾ ചെയ്യുന്ന വിധം',
    androidTitle: 'ആൻഡ്രോയിഡ് ഫോണുകൾക്ക് (Chrome)',
    androidSteps: [
      'താഴെ കാണുന്ന വെബ് ലിങ്ക് Chrome ബ്രൗസറിൽ തുറക്കുക.',
      'ഈ പേജിന്റെ മുകളിലുള്ള "ആപ്പ് സ്വയമേവ ഇൻസ്റ്റാൾ ചെയ്യുക" എന്ന ബട്ടൺ അമർത്തുക.',
      'പോപ്പ്-അപ്പ് വന്നില്ലെങ്കിൽ Chrome-ന്റെ മുകളിൽ വലതുവശത്തുള്ള മൂന്ന് കുത്തുകളിൽ (⋮) അമർത്തി "Install app" അല്ലെങ്കിൽ "Add to Home screen" തിരഞ്ഞെടുക്കുക.',
      '"Install" അല്ലെങ്കിൽ "Add" അമർത്തിയാൽ ഹോം സ്ക്രീനിൽ Fenestrians ഐക്കൺ വരും.',
    ],
    iphoneTitle: 'ഐഫോണുകൾക്ക് (Safari)',
    iphoneSteps: [
      'താഴെ കാണുന്ന വെബ് ലിങ്ക് Safari ബ്രൗസറിൽ തുറക്കുക.',
      'സ്ക്രീനിന്റെ താഴെയുള്ള Share ബട്ടൺ (മുകളിലേക്ക് അമ്പടയാളമുള്ള ചതുരം) അമർത്തുക.',
      'താഴേക്ക് നീക്കി "Add to Home Screen" തിരഞ്ഞെടുക്കുക.',
      'മുകളിൽ വലതുവശത്തുള്ള "Add" അമർത്തിയാൽ ഹോം സ്ക്രീനിൽ Fenestrians ഐക്കൺ വരും.',
    ],
    copyBtn: 'നിർദ്ദേശങ്ങളും ലിങ്കും പകർത്തുക',
    copiedBtn: 'പകർത്തി!',
    autoInstallBtn: 'ആപ്പ് സ്വയമേവ ഇൻസ്റ്റാൾ ചെയ്യുക',
    installedDoneMsg: 'Fenestrians ആപ്പ് നിങ്ങളുടെ ഫോണിൽ ഇൻസ്റ്റാൾ ചെയ്തു കഴിഞ്ഞു!',
    manualFallbackAlert: 'ഇൻസ്റ്റാൾ ചെയ്യാൻ ബ്രൗസർ മെനു ഉപയോഗിക്കേണ്ടതുണ്ട്. താഴെ നൽകിയിരിക്കുന്ന ഘട്ടങ്ങൾ പാലിക്കുക.',
    backBtn: 'തിരികെ പോകുക',
  },
}

function getSavedLang(): LangCode {
  const saved = localStorage.getItem('pref_lang')
  if (saved === 'ta' || saved === 'ml') return saved
  return 'en'
}

export default function InstallAppPage() {
  const navigate = useNavigate()
  const [lang, setLang] = useState<LangCode>(getSavedLang)
  const [copied, setCopied] = useState(false)
  const [installed, setInstalled] = useState(false)

  const appUrl = 'https://fenestrians.salmaali.in'

  useEffect(() => {
    const syncLang = () => setLang(getSavedLang())
    window.addEventListener('focus', syncLang)
    window.addEventListener('storage', syncLang)
    window.addEventListener('appinstalled', () => setInstalled(true))
    return () => {
      window.removeEventListener('focus', syncLang)
      window.removeEventListener('storage', syncLang)
    }
  }, [])

  const t = INSTALL_GUIDE_TEXT[lang]

  const handleCopyAll = async () => {
    const fullText = [
      `${t.title}`,
      `${t.linkHeading}: ${appUrl}`,
      ``,
      `${t.androidTitle}:`,
      ...t.androidSteps.map((s, i) => `${i + 1}. ${s}`),
      ``,
      `${t.iphoneTitle}:`,
      ...t.iphoneSteps.map((s, i) => `${i + 1}. ${s}`),
    ].join('\n')

    await navigator.clipboard.writeText(fullText)
    setCopied(true)
    setTimeout(() => setCopied(false), 2500)
  }

  const handleAutomaticInstall = async () => {
    const promptEvent = (window as any).deferredInstallPrompt
    if (promptEvent) {
      promptEvent.prompt()
      const choice = await promptEvent.userChoice
      if (choice?.outcome === 'accepted') {
        setInstalled(true)
      }
      ;(window as any).deferredInstallPrompt = null
    } else {
      alert(t.manualFallbackAlert)
    }
  }

  return (
    <div className="flex min-h-svh items-center justify-center p-4 sm:p-6 relative overflow-hidden">
      <div className="absolute inset-0 royal-gradient" />
      <Card className="relative w-full max-w-lg border-border/50 bg-card/85 backdrop-blur-xl shadow-2xl shadow-black/40 max-h-[92vh] overflow-y-auto">
        <CardHeader className="text-center space-y-2">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl border border-primary/30 bg-primary/10">
            <Smartphone className="h-5 w-5 text-primary" />
          </div>
          <CardTitle className="text-xl text-primary">{t.title}</CardTitle>
          <p className="text-xs text-muted-foreground">{t.subtitle}</p>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Top Automatic Install Button */}
          {installed ? (
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-center text-xs font-semibold text-emerald-300">
              {t.installedDoneMsg}
            </div>
          ) : (
            <Button
              type="button"
              onClick={handleAutomaticInstall}
              className="w-full gold-gradient text-gold-foreground font-bold shadow-lg gap-2 py-5"
            >
              <Download className="h-4 w-4" />
              {t.autoInstallBtn}
            </Button>
          )}

          {/* Screenshot Reminder */}
          <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3.5 space-y-1">
            <p className="flex items-center gap-2 text-xs font-bold text-amber-300">
              <Camera className="h-4 w-4 shrink-0" />
              {t.screenshotTitle}
            </p>
            <p className="text-xs text-amber-100/90 leading-relaxed">{t.screenshotBody}</p>
          </div>

          {/* Clickable URL */}
          <div className="rounded-xl border border-primary/30 bg-primary/5 p-3.5 space-y-1.5">
            <p className="text-xs font-semibold text-primary">{t.linkHeading}</p>
            <a
              href={appUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm font-bold text-emerald-400 underline break-all hover:text-emerald-300"
            >
              {appUrl}
              <ExternalLink className="h-3.5 w-3.5 shrink-0" />
            </a>
          </div>

          {/* Step-by-step Instructions */}
          <div className="space-y-3 rounded-xl border border-border/40 bg-muted/20 p-4">
            <p className="text-xs font-bold text-primary">{t.stepsHeading}</p>

            <div className="space-y-1.5">
              <p className="text-xs font-semibold text-foreground">{t.androidTitle}</p>
              <ol className="space-y-1.5 text-xs text-muted-foreground list-decimal list-inside">
                {t.androidSteps.map((step, idx) => (
                  <li key={idx} className="leading-relaxed">{step}</li>
                ))}
              </ol>
            </div>

            <div className="border-t border-border/30 pt-2.5 space-y-1.5">
              <p className="text-xs font-semibold text-foreground">{t.iphoneTitle}</p>
              <ol className="space-y-1.5 text-xs text-muted-foreground list-decimal list-inside">
                {t.iphoneSteps.map((step, idx) => (
                  <li key={idx} className="leading-relaxed">{step}</li>
                ))}
              </ol>
            </div>
          </div>

          {/* Copy Procedure & Link Button */}
          <Button
            type="button"
            variant="outline"
            onClick={handleCopyAll}
            className="w-full gap-2 text-xs font-semibold"
          >
            {copied ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
            {copied ? t.copiedBtn : t.copyBtn}
          </Button>

          <Button
            type="button"
            variant="ghost"
            onClick={() => navigate(-1)}
            className="w-full text-xs text-muted-foreground gap-1.5"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            {t.backBtn}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
