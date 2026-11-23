import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { getSavedBiometricCredential } from '@/lib/biometricAuth'
import SmartDateInput from '@/components/shared/SmartDateInput'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { LogIn, ShieldCheck, UserPlus, Fingerprint, ArrowLeft } from 'lucide-react'

export default function LandingPage() {
  const navigate = useNavigate()
  const savedBio = getSavedBiometricCredential()

  return (
    <div className="flex min-h-svh items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md border-primary/40 bg-card/85 backdrop-blur-md shadow-2xl">
        <CardHeader className="text-center space-y-3">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl gold-border bg-background/70 p-1 shadow-lg">
            <img src="/icon.png" alt="Fenestrians" className="h-full w-full rounded-xl object-contain" />
          </div>
          <CardTitle className="text-2xl font-bold text-primary">Fenestrians</CardTitle>
          <CardDescription className="text-xs text-muted-foreground">
            Exclusive Batch Network, Directory &amp; Alumni Association
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-3">
          <Button
            type="button"
            onClick={() => navigate('/login')}
            className="w-full gold-gradient text-gold-foreground font-bold gap-2 py-5"
          >
            {savedBio ? <Fingerprint className="h-4 w-4" /> : <LogIn className="h-4 w-4" />}
            {savedBio ? `Member Sign In (${savedBio.fullName})` : 'Member Sign In'}
          </Button>

          <Button
            type="button"
            variant="outline"
            onClick={() => navigate('/register')}
            className="w-full border-primary/40 text-primary hover:bg-primary/10 font-semibold gap-2"
          >
            <UserPlus className="h-4 w-4" />
            New Member Registration (With Invite Code)
          </Button>

          <Button
            type="button"
            variant="ghost"
            onClick={() => navigate('/admin')}
            className="w-full text-xs text-muted-foreground hover:text-foreground gap-1.5"
          >
            <ShieldCheck className="h-3.5 w-3.5" />
            Administrator / Officer Sign In
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}

export function MemberLoginPage() {
  const { login, loginWithBiometrics } = useAuth()
  const navigate = useNavigate()
  const savedBio = getSavedBiometricCredential()

  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!identifier.trim() || !password) return
    setBusy(true)
    setErrorMsg('')
    const res = await login(identifier.trim(), password)
    setBusy(false)
    if (!res.success) {
      setErrorMsg(res.error || 'Invalid credentials.')
      return
    }
    navigate('/dashboard', { replace: true })
  }

  const handleBiometricLogin = async () => {
    setBusy(true)
    setErrorMsg('')
    const res = await loginWithBiometrics()
    setBusy(false)
    if (!res.success) {
      setErrorMsg(res.error || 'Biometric login failed.')
      return
    }
    navigate('/dashboard', { replace: true })
  }

  return (
    <div className="flex min-h-svh items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md border-primary/40 bg-card/85 backdrop-blur-md shadow-2xl">
        <CardHeader className="space-y-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => navigate('/')}
            className="w-fit px-0 text-xs text-muted-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5 mr-1" />
            Back
          </Button>
          <CardTitle className="text-xl text-primary">Member Sign In</CardTitle>
          <CardDescription className="text-xs">
            Sign in using your Username, Email, or Phone Number
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {savedBio && (
            <Button
              type="button"
              disabled={busy}
              onClick={handleBiometricLogin}
              className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold gap-2 py-5"
            >
              <Fingerprint className="h-5 w-5" />
              Sign In with Fingerprint / Face ID ({savedBio.fullName})
            </Button>
          )}

          {errorMsg && (
            <div className="rounded-lg border border-red-500/40 bg-red-500/15 p-2.5 text-xs text-red-300">
              {errorMsg}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3 text-xs">
            <div>
              <Label>Username, Email, or Contact Number</Label>
              <Input
                value={identifier}
                onChange={e => setIdentifier(e.target.value)}
                placeholder="Enter username, email, or +91..."
                className="mt-1"
              />
            </div>

            <div>
              <Label>Password</Label>
              <Input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Enter password"
                className="mt-1"
              />
            </div>

            <Button
              type="submit"
              disabled={busy}
              className="w-full gold-gradient text-gold-foreground font-bold gap-2"
            >
              <LogIn className="h-4 w-4" />
              {busy ? 'Signing In...' : 'Sign In'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

export function AdminLoginPage() {
  const { adminLogin } = useAuth()
  const navigate = useNavigate()

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!username.trim() || !password) return
    setBusy(true)
    setErrorMsg('')
    const res = await adminLogin(username.trim(), password)
    setBusy(false)
    if (!res.success) {
      setErrorMsg(res.error || 'Access Denied.')
      return
    }
    navigate('/dashboard', { replace: true })
  }

  return (
    <div className="flex min-h-svh items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md border-primary/40 bg-card/85 backdrop-blur-md shadow-2xl">
        <CardHeader className="space-y-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => navigate('/')}
            className="w-fit px-0 text-xs text-muted-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5 mr-1" />
            Back
          </Button>
          <CardTitle className="flex items-center gap-2 text-xl text-primary">
            <ShieldCheck className="h-5 w-5" />
            Administrator / Officer Sign In
          </CardTitle>
        </CardHeader>

        <CardContent className="space-y-3 text-xs">
          {errorMsg && (
            <div className="rounded-lg border border-red-500/40 bg-red-500/15 p-2.5 text-red-300">
              {errorMsg}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <Label>Username</Label>
              <Input
                value={username}
                onChange={e => setUsername(e.target.value)}
                className="mt-1"
              />
            </div>

            <div>
              <Label>Password</Label>
              <Input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="mt-1"
              />
            </div>

            <Button
              type="submit"
              disabled={busy}
              className="w-full gold-gradient text-gold-foreground font-bold"
            >
              {busy ? 'Verifying...' : 'Sign In as Officer / Admin'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

export function RegisterPage() {
  const { register } = useAuth()
  const navigate = useNavigate()

  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [gender, setGender] = useState('Male')
  const [dob, setDob] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!code.trim() || !name.trim() || !username.trim() || !password) {
      setErrorMsg('Please complete all required fields.')
      return
    }

    setBusy(true)
    setErrorMsg('')
    const res = await register(
      code.trim(),
      username.trim(),
      password,
      name.trim(),
      gender,
      dob,
      email.trim(),
      phone.trim()
    )
    setBusy(false)

    if (!res.success) {
      setErrorMsg(res.error || 'Registration failed.')
      return
    }

    alert('Registration successful! You can now sign in with your new credentials.')
    navigate('/login')
  }

  return (
    <div className="flex min-h-svh items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md border-primary/40 bg-card/85 backdrop-blur-md shadow-2xl">
        <CardHeader className="space-y-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => navigate('/')}
            className="w-fit px-0 text-xs text-muted-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5 mr-1" />
            Back
          </Button>
          <CardTitle className="text-xl text-primary">New Member Registration</CardTitle>
        </CardHeader>

        <CardContent className="space-y-3 text-xs">
          {errorMsg && (
            <div className="rounded-lg border border-red-500/40 bg-red-500/15 p-2.5 text-red-300">
              {errorMsg}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <Label>Invite Passcode *</Label>
              <Input
                value={code}
                onChange={e => setCode(e.target.value)}
                placeholder="e.g., FEN-XXXXXX"
                className="mt-1 font-mono"
              />
            </div>

            <div>
              <Label>Full Name *</Label>
              <Input value={name} onChange={e => setName(e.target.value)} className="mt-1" />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Gender</Label>
                <select
                  value={gender}
                  onChange={e => setGender(e.target.value)}
                  className="mt-1 w-full h-9 rounded-md border border-input bg-background px-3 text-xs"
                >
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                </select>
              </div>
              <div>
                <Label>Date of Birth (DD/MM/YYYY)</Label>
                <SmartDateInput value={dob} onChange={setDob} className="mt-1" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Email</Label>
                <Input type="email" value={email} onChange={e => setEmail(e.target.value)} className="mt-1" />
              </div>
              <div>
                <Label>Phone Number</Label>
                <Input value={phone} onChange={e => setPhone(e.target.value)} className="mt-1" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Choose Username *</Label>
                <Input value={username} onChange={e => setUsername(e.target.value)} className="mt-1" />
              </div>
              <div>
                <Label>Choose Password *</Label>
                <Input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="mt-1"
                />
              </div>
            </div>

            <Button
              type="submit"
              disabled={busy}
              className="w-full gold-gradient text-gold-foreground font-bold"
            >
              {busy ? 'Registering...' : 'Complete Registration'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
