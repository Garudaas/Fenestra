import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { APP_VERSION_INFO, type AppVersionData } from '@/lib/appVersion'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Smartphone,
  Download,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  Copy,
  Check,
} from 'lucide-react'

type LauncherPhase =
  | 'scanning'
  | 'not-installed'
  | 'installing'
  | 'checking-update'
  | 'updating'
  | 'reinstall-required'
  | 'up-to-date'

export default function SmartAppLauncher() {
  const { user } = useAuth()
  const navigate = useNavigate()

  const [phase, setPhase] = useState<LauncherPhase>('scanning')
  const [canOneTapInstall, setCanOneTapInstall] = useState<boolean>(() =>
    typeof window !== 'undefined' ? Boolean((window as any).deferredInstallPrompt) : false
  )
  const [showManualBackup, setShowManualBackup] = useState(false)
  const [latestInfo, setLatestInfo] = useState<AppVersionData>(APP_VERSION_INFO)
  const [copiedUrl, setCopiedUrl] = useState(false)

  const appSmartUrl = 'https://fenestrians.salmaali.in/app'
  const destinationRoute = user && !user.is_placeholder ? '/dashboard' : '/'

  const detectInstalled = async (): Promise<boolean> => {
    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true ||
      document.referrer.startsWith('android-app://') ||
      Boolean((window as any).Capacitor || (window as any).cordova)

    if (standalone) return true

    if ('getInstalledRelatedApps' in navigator) {
      try {
        const relatedApps = await (navigator as any).getInstalledRelatedApps()
        if (Array.isArray(relatedApps) && relatedApps.length > 0) {
          return true
        }
      } catch {
        // Ignore if unsupported by browser
      }
    }

    return false
  }

  const checkAndApplyUpdate = useCallback(async () => {
    setPhase('checking-update')
    try {
      const res = await fetch(`/version.json?t=${Date.now()}`, { cache: 'no-store' })
      if (!res.ok) {
        setPhase('up-to-date')
        setTimeout(() => navigate(destinationRoute, { replace: true }), 1000)
        return
      }

      const latest: AppVersionData = await res.json()
      setLatestInfo(latest)

      if (latest.version !== APP_VERSION_INFO.version) {
        if (latest.requiresReinstall) {
          setPhase('reinstall-required')
          return
        }

        setPhase('updating')
        if ('caches' in window) {
          const keys = await caches.keys()
          await Promise.all(keys.map(k => caches.delete(k)))
        }
        if ('serviceWorker' in navigator) {
          const regs = await navigator.serviceWorker.getRegistrations()
          await Promise.all(regs.map(r => r.update()))
        }
        window.location.reload()
        return
      }

      setPhase('up-to-date')
      setTimeout(() => navigate(destinationRoute, { replace: true }), 1000)
    } catch {
      setPhase('up-to-date')
      setTimeout(() => navigate(destinationRoute, { replace: true }), 1000)
    }
  }, [navigate, destinationRoute])

  useEffect(() => {
    let cancelled = false

    const handleBeforeInstall = (e: Event) => {
      e.preventDefault()
      ;(window as any).deferredInstallPrompt = e
      if (!cancelled) {
        setCanOneTapInstall(true)
        setPhase(prev => (prev === 'scanning' ? 'not-installed' : prev))
      }
    }

    const handleAppInstalled = () => {
      ;(window as any).deferredInstallPrompt = null
      if (!cancelled) {
        setCanOneTapInstall(false)
        setPhase('up-to-date')
        setTimeout(() => navigate(destinationRoute, { replace: true }), 1200)
      }
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstall)
    window.addEventListener('appinstalled', handleAppInstalled)

    const runSmartScan = async () => {
      const installed = await detectInstalled()
      if (cancelled) return

      if (installed) {
        await checkAndApplyUpdate()
        return
      }

      if ((window as any).deferredInstallPrompt) {
        setCanOneTapInstall(true)
        setPhase('not-installed')
        return
      }

      // Brief wait for browser's beforeinstallprompt event
      await new Promise(resolve => setTimeout(resolve, 800))
      if (cancelled) return

      if ((window as any).deferredInstallPrompt) {
        setCanOneTapInstall(true)
      }
      setPhase('not-installed')
    }

    runSmartScan()

    return () => {
      cancelled = true
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall)
      window.removeEventListener('appinstalled', handleAppInstalled)
    }
  }, [checkAndApplyUpdate, navigate, destinationRoute])

  const handleInstallClick = async () => {
    const promptEvent = (window as any).deferredInstallPrompt
    if (!promptEvent) {
      setCanOneTapInstall(false)
      setShowManualBackup(true)
      return
    }

    try {
      setPhase('installing')
      await promptEvent.prompt()

      const timeoutPromise = new Promise<{ outcome: string }>(resolve =>
        setTimeout(() => resolve({ outcome: 'timeout' }), 6000)
      )
      const choice = await Promise.race([promptEvent.userChoice, timeoutPromise])

      if (choice?.outcome === 'accepted') {
        ;(window as any).deferredInstallPrompt = null
        setCanOneTapInstall(false)
        setPhase('up-to-date')
        setTimeout(() => navigate(destinationRoute, { replace: true }), 1200)
      } else {
        setPhase('not-installed')
        setShowManualBackup(true)
      }
    } catch {
      setPhase('not-installed')
      setShowManualBackup(true)
    }
  }

  const handleCopyUrl = async () => {
    await navigator.clipboard.writeText(appSmartUrl)
    setCopiedUrl(true)
    setTimeout(() => setCopiedUrl(false), 2000)
  }

  return (
    <div className="flex min-h-svh items-center justify-center p-6 relative overflow-hidden">
      <div className="absolute inset-0 royal-gradient" />
      <Card className="relative w-full max-w-md border-border/50 bg-card/85 backdrop-blur-xl shadow-2xl shadow-black/40">
        <CardHeader className="text-center space-y-3">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-primary/40 bg-primary/10 overflow-hidden">
            <img src="/icon.png" alt="Fenestrians" className="h-full w-full object-cover" />
          </div>
          <CardTitle className="text-xl text-primary">Fenestrians App Launcher</CardTitle>
        </CardHeader>

        <CardContent className="space-y-4 text-center">
          {(phase === 'scanning' || phase === 'checking-update' || phase === 'updating') && (
            <div className="space-y-3 py-4">
              <RefreshCw className="mx-auto h-7 w-7 animate-spin text-primary" />
              <p className="text-sm font-semibold text-foreground">
                {phase === 'scanning' && 'Scanning device for Fenestrians app...'}
                {phase === 'checking-update' && 'App found! Checking for latest updates...'}
                {phase === 'updating' && `Updating app to ${latestInfo.version}...`}
              </p>
              <p className="text-xs text-muted-foreground">Please wait a moment.</p>
            </div>
          )}

          {phase === 'up-to-date' && (
            <div className="space-y-3 py-2">
              <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-400" />
              <p className="text-sm font-bold text-emerald-300">
                Fenestrians is installed and up to date ({latestInfo.version})!
              </p>
              <p className="text-xs text-muted-foreground">Opening your app now...</p>
              <Button
                type="button"
                onClick={() => navigate(destinationRoute, { replace: true })}
                className="w-full gold-gradient text-gold-foreground font-semibold gap-1.5"
              >
                Open Fenestrians Now
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          )}

          {phase === 'reinstall-required' && (
            <div className="space-y-3 text-left rounded-xl border border-red-500/40 bg-red-500/10 p-4">
              <p className="flex items-center gap-1.5 text-xs font-bold text-red-300">
                <AlertCircle className="h-4 w-4 shrink-0" />
                Reinstall Required ({latestInfo.version})
              </p>
              <p className="text-xs text-foreground/90">{latestInfo.summary}</p>
              <ol className="list-decimal list-inside space-y-1 text-xs text-muted-foreground">
                <li>Remove the old Fenestrians icon from your phone screen.</li>
                <li>Tap below to install the updated app icon.</li>
              </ol>
              <Button
                type="button"
                onClick={() => navigate('/install')}
                className="w-full gold-gradient text-gold-foreground font-semibold"
              >
                Install Updated App
              </Button>
            </div>
          )}

          {(phase === 'not-installed' || phase === 'installing') && (
            <div className="space-y-3 text-left">
              <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 space-y-3">
                <p className="flex items-center gap-2 text-xs font-bold text-primary">
                  <Smartphone className="h-4 w-4 shrink-0" />
                  Fenestrians is not installed on this device
                </p>

                {canOneTapInstall && (
                  <Button
                    type="button"
                    disabled={phase === 'installing'}
                    onClick={handleInstallClick}
                    className="w-full gold-gradient text-gold-foreground font-bold gap-2 py-5"
                  >
                    <Download className="h-4 w-4" />
                    {phase === 'installing' ? 'Opening Permission Window...' : 'Install Fenestrians App Now'}
                  </Button>
                )}

                {(!canOneTapInstall || showManualBackup) && (
                  <div className="space-y-2 text-xs text-muted-foreground pt-1">
                    <p>
                      • <span className="font-semibold text-foreground">Android (Chrome):</span> Tap the{' '}
                      <span className="font-semibold text-foreground">⋮</span> menu at the top right and select{' '}
                      <span className="font-semibold text-foreground">Install app</span> or{' '}
                      <span className="font-semibold text-foreground">Add to Home screen</span>.
                    </p>
                    <p>
                      • <span className="font-semibold text-foreground">iPhone (Safari):</span> Tap the{' '}
                      <span className="font-semibold text-foreground">Share</span> button at the bottom and select{' '}
                      <span className="font-semibold text-foreground">Add to Home Screen</span>.
                    </p>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleCopyUrl}
                      className="w-full gap-1.5 text-xs mt-1"
                    >
                      {copiedUrl ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                      {copiedUrl ? 'Link Copied!' : 'Copy Smart App Link'}
                    </Button>
                  </div>
                )}
              </div>

              <Button
                type="button"
                variant="ghost"
                onClick={() => navigate(destinationRoute)}
                className="w-full text-xs text-muted-foreground"
              >
                Continue in Web Browser
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
