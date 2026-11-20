import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { UserPlus, Copy, Check, Download, ArrowRight, ArrowLeft, Smartphone, KeyRound, Link2 } from 'lucide-react'

function generatePasscode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let token = ''
  for (let i = 0; i < 6; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return `FEN-${token}`
}

export default function InvitePage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const inviteCodeParam = searchParams.get('code')?.trim() || ''

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
    const trimmedName = inviteeName.trim()
    if (!trimmedName) {
      alert("Please enter the new member's name.")
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
      alert(`Failed to create invite: ${error.message}`)
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

  // Invitee opened the shared invite link on their phone
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
              Install the Fenestrians shortcut on your phone first, then complete your registration using the temporary passcode sent to you.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2.5 rounded-xl border border-primary/30 bg-primary/5 p-4">
              <p className="text-xs font-semibold text-primary">Step 1: Install App Shortcut</p>
              {installed ? (
                <p className="text-xs text-emerald-400 font-medium">
                  App shortcut installed! You can launch Fenestrians from your home screen.
                </p>
              ) : canPromptInstall ? (
                <Button
                  onClick={handleInstallShortcut}
                  className="w-full gold-gradient text-gold-foreground font-semibold gap-2"
                >
                  <Download className="h-4 w-4" />
                  Install App Shortcut
                </Button>
              ) : (
                <div className="space-y-1.5 text-xs text-muted-foreground">
                  <p>• <span className="font-semibold text-foreground">Android (Chrome):</span> Tap the <span className="font-semibold text-foreground">⋮</span> menu at top-right and select <span className="font-semibold text-foreground">Add to Home screen</span> or <span className="font-semibold text-foreground">Install app</span>.</p>
                  <p>• <span className="font-semibold text-foreground">iPhone (Safari):</span> Tap the <span className="font-semibold text-foreground">Share</span> icon at the bottom and select <span className="font-semibold text-foreground">Add to Home Screen</span>.</p>
                </div>
              )}
            </div>

            <div className="space-y-2 rounded-xl border border-border/40 bg-muted/20 p-4">
              <p className="text-xs font-semibold text-foreground">Step 2: Complete Registration</p>
              <p className="text-xs text-muted-foreground">
                Your name will be pre-filled automatically once you enter your temporary passcode.
              </p>
              <Button
                onClick={() => navigate(`/register?code=${encodeURIComponent(inviteCodeParam)}`)}
                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-semibold gap-1.5"
              >
                Continue to Registration
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Approved member creating an invite
  return (
    <div className="flex min-h-svh items-center justify-center p-6 relative overflow-hidden">
      <div className="absolute inset-0 royal-gradient" />
      <Card className="relative w-full max-w-md border-border/50 bg-card/85 backdrop-blur-xl shadow-2xl shadow-black/40">
        <CardHeader className="text-center space-y-3">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl border border-primary/30 bg-primary/10">
            <UserPlus className="h-5 w-5 text-primary" />
          </div>
          <CardTitle className="text-xl text-primary">Create Member Invite</CardTitle>
          <p className="text-xs text-muted-foreground">
            Enter the new member&apos;s name to reserve their registration slot and generate an install link and temporary passcode.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {!generatedUrl ? (
            <>
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground px-1">New Member&apos;s Full Name *</label>
                <Input
                  placeholder="Enter full name"
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
                {loading ? 'Preparing Invite...' : 'Generate Invite Link & Passcode'}
              </Button>
            </>
          ) : (
            <div className="space-y-4">
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-300">
                Slot prepared for <span className="font-bold">{inviteeName.trim()}</span>. Send both the install link and temporary passcode below to them.
              </div>

              <div className="space-y-1.5">
                <label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                  <Link2 className="h-3.5 w-3.5 text-primary" />
                  Phone Install &amp; Invite Link
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
                    {copiedUrl ? 'Copied' : 'Copy'}
                  </Button>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                  <KeyRound className="h-3.5 w-3.5 text-primary" />
                  Temporary Passcode
                </label>
                <div className="flex gap-2">
                  <Input
                    readOnly
                    value={generatedPasscode}
                    className="bg-input/50 border-border/50 font-mono font-bold tracking-wider text-primary"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => copyText(generatedPasscode, 'code')}
                    className="shrink-0 gap-1"
                  >
                    {copiedCode ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                    {copiedCode ? 'Copied' : 'Copy'}
                  </Button>
                </div>
              </div>

              <Button
                variant="outline"
                onClick={() => {
                  setInviteeName('')
                  setGeneratedUrl('')
                  setGeneratedPasscode('')
                }}
                className="w-full text-xs"
              >
                Invite Another Member
              </Button>
            </div>
          )}

          <Button
            variant="ghost"
            onClick={() => navigate('/dashboard')}
            className="w-full text-xs text-muted-foreground gap-1.5"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to Dashboard
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
