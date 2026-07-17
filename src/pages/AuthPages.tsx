import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Shield, LogIn, UserPlus, Lock, Eye, EyeOff } from 'lucide-react'

export default function LandingPage() {
  const navigate = useNavigate()

  return (
    <div className="flex min-h-svh items-center justify-center p-6 relative overflow-hidden">
      <div className="absolute inset-0 royal-gradient" />
      <div className="absolute inset-0 animate-shimmer opacity-40" />

      <Card className="relative w-full max-w-md border-border/50 bg-card/80 backdrop-blur-xl shadow-2xl shadow-black/40">
        <CardHeader className="text-center space-y-4 pb-2">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-2xl border gold-border bg-background/50 p-1 shadow-lg animate-glow">
            <img src="/icon.png" alt="Alumni Inner Circle" className="h-full w-full rounded-xl object-contain" />
          </div>
          <div>
            <CardTitle className="text-2xl font-bold tracking-tight text-primary">Alumni Inner Circle</CardTitle>
            <CardDescription className="mt-1 text-muted-foreground">Private and secure network for classmates</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 pt-4">
          <Button onClick={() => navigate('/login')} className="w-full gold-gradient text-gold-foreground font-semibold shadow-lg hover:opacity-90 transition-all duration-300 hover:shadow-xl" size="lg">
            <LogIn className="mr-2 h-4 w-4" />
            Member Log In
          </Button>
          <div className="text-center">
            <Button variant="link" onClick={() => navigate('/register')} className="text-sm text-emerald-400 hover:text-emerald-300 transition-colors">
              <UserPlus className="mr-1.5 h-3.5 w-3.5" />
              Register (First Time)
            </Button>
          </div>
          <div className="pt-4 border-t border-border/50">
            <Button variant="ghost" onClick={() => navigate('/admin')} className="w-full text-xs text-muted-foreground/70 hover:text-destructive transition-colors">
              <Shield className="mr-1.5 h-3 w-3" />
              Admin Dashboard Access
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export function MemberLoginPage() {
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)
  const { login } = useAuth()
  const navigate = useNavigate()

  const handleLogin = async () => {
    if (!identifier || !password) return
    setLoading(true)
    const result = await login(identifier, password)
    setLoading(false)
    if (result.success) {
      navigate('/dashboard')
    } else {
      alert(result.error)
    }
  }

  return (
    <div className="flex min-h-svh items-center justify-center p-6 relative overflow-hidden">
      <div className="absolute inset-0 royal-gradient" />
      <Card className="relative w-full max-w-md border-border/50 bg-card/80 backdrop-blur-xl shadow-2xl shadow-black/40">
        <CardHeader className="text-center space-y-3">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl gold-border bg-primary/10">
            <LogIn className="h-5 w-5 text-primary" />
          </div>
          <CardTitle className="text-xl text-primary">Member Log In</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input
            placeholder="Username, Email, or Phone"
            value={identifier}
            onChange={e => setIdentifier(e.target.value)}
            className="bg-input/50 border-border/50 focus:border-primary/50"
          />
          <div className="relative">
            <Input
              type={showPass ? 'text' : 'password'}
              placeholder="Password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleLogin()}
              className="bg-input/50 border-border/50 pr-10 focus:border-primary/50"
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="absolute right-1 top-1 h-7 w-7 p-0 text-muted-foreground hover:text-primary"
              onClick={() => setShowPass(!showPass)}
            >
              {showPass ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            </Button>
          </div>
          <Button onClick={handleLogin} className="w-full gold-gradient text-gold-foreground font-semibold shadow-lg hover:opacity-90 transition-all" disabled={loading}>
            {loading ? 'Authenticating...' : 'Log In'}
          </Button>
          <Button variant="ghost" onClick={() => navigate('/')} className="w-full text-xs text-muted-foreground">
            Back to Home
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}

export function AdminLoginPage() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)
  const { adminLogin } = useAuth()
  const navigate = useNavigate()

  const handleLogin = async () => {
    if (!username || !password) return
    setLoading(true)
    const result = await adminLogin(username, password)
    setLoading(false)
    if (result.success) {
      navigate('/admin-dashboard')
    } else {
      alert(result.error)
    }
  }

  return (
    <div className="flex min-h-svh items-center justify-center p-6 relative overflow-hidden">
      <div className="absolute inset-0 royal-gradient" />
      <Card className="relative w-full max-w-md border-destructive/20 bg-card/80 backdrop-blur-xl shadow-2xl shadow-black/40">
        <CardHeader className="text-center space-y-3">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl border border-destructive/30 bg-destructive/10">
            <Shield className="h-5 w-5 text-destructive" />
          </div>
          <CardTitle className="text-xl text-destructive">Admin Access</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input
            placeholder="Admin Username"
            value={username}
            onChange={e => setUsername(e.target.value)}
            className="bg-input/50 border-border/50 focus:border-destructive/50"
          />
          <div className="relative">
            <Input
              type={showPass ? 'text' : 'password'}
              placeholder="Admin Password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleLogin()}
              className="bg-input/50 border-border/50 pr-10 focus:border-destructive/50"
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="absolute right-1 top-1 h-7 w-7 p-0 text-muted-foreground"
              onClick={() => setShowPass(!showPass)}
            >
              {showPass ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            </Button>
          </div>
          <Button onClick={handleLogin} variant="destructive" className="w-full font-semibold shadow-lg" disabled={loading}>
            <Lock className="mr-2 h-4 w-4" />
            {loading ? 'Authenticating...' : 'Log In as Admin'}
          </Button>
          <Button variant="ghost" onClick={() => navigate('/')} className="w-full text-xs text-muted-foreground">
            Back to Home
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}

export function RegisterPage() {
  const [code, setCode] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [gender, setGender] = useState('')
  const [dob, setDob] = useState('')
  const [email, setEmail] = useState('')
  const [cc, setCc] = useState('+91')
  const [phone, setPhone] = useState('')
  const [showCode, setShowCode] = useState(false)
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)
  const { register } = useAuth()
  const navigate = useNavigate()

  const handleRegister = async () => {
    if (!code || !username || !password || !name || !gender || !dob || !email || !phone) {
      alert('Please fill all fields.')
      return
    }
    const fullPhone = `${cc} ${phone}`
    setLoading(true)
    const result = await register(code, username, password, name, gender, dob, email, fullPhone)
    setLoading(false)
    if (result.success) {
      alert('Registration successful!')
      navigate('/')
    } else {
      alert(result.error)
    }
  }

  return (
    <div className="flex min-h-svh items-center justify-center p-6 relative overflow-hidden">
      <div className="absolute inset-0 royal-gradient" />
      <Card className="relative w-full max-w-md border-border/50 bg-card/80 backdrop-blur-xl shadow-2xl shadow-black/40 max-h-[90vh] overflow-y-auto">
        <CardHeader className="text-center space-y-3">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl border border-emerald-500/30 bg-emerald-500/10">
            <UserPlus className="h-5 w-5 text-emerald-400" />
          </div>
          <CardTitle className="text-xl text-emerald-400">First Time Registration</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="relative">
            <Input type={showCode ? 'text' : 'password'} placeholder="Temporary Passcode *" value={code} onChange={e => setCode(e.target.value)} className="bg-input/50 border-border/50 pr-10" />
            <Button type="button" variant="ghost" size="sm" className="absolute right-1 top-1 h-7 w-7 p-0 text-muted-foreground" onClick={() => setShowCode(!showCode)}>
              {showCode ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            </Button>
          </div>
          <Input placeholder="Create Username *" value={username} onChange={e => setUsername(e.target.value)} className="bg-input/50 border-border/50" />
          <div className="relative">
            <Input type={showPass ? 'text' : 'password'} placeholder="Create Password *" value={password} onChange={e => setPassword(e.target.value)} className="bg-input/50 border-border/50 pr-10" />
            <Button type="button" variant="ghost" size="sm" className="absolute right-1 top-1 h-7 w-7 p-0 text-muted-foreground" onClick={() => setShowPass(!showPass)}>
              {showPass ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            </Button>
          </div>
          <div className="border-t border-border/30 my-1" />
          <Input placeholder="Full Name *" value={name} onChange={e => setName(e.target.value)} className="bg-input/50 border-border/50" />
          <select value={gender} onChange={e => setGender(e.target.value)} className="w-full rounded-lg border border-border/50 bg-input/50 px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring/50">
            <option value="">Select Gender *</option>
            <option value="Male">Male</option>
            <option value="Female">Female</option>
          </select>
          <Input type="date" value={dob} onChange={e => setDob(e.target.value)} className="bg-input/50 border-border/50" />
          <Input type="email" placeholder="Email Address *" value={email} onChange={e => setEmail(e.target.value)} className="bg-input/50 border-border/50" />
          <div className="flex gap-2">
            <Input className="w-1/4 text-center bg-input/50 border-border/50" value={cc} onChange={e => setCc(e.target.value)} />
            <Input className="w-3/4 bg-input/50 border-border/50" placeholder="Contact Number *" value={phone} onChange={e => setPhone(e.target.value)} />
          </div>
          <Button onClick={handleRegister} className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-semibold shadow-lg transition-all" disabled={loading}>
            {loading ? 'Creating Account...' : 'Create Account'}
          </Button>
          <Button variant="ghost" onClick={() => navigate('/')} className="w-full text-xs text-muted-foreground">Cancel</Button>
        </CardContent>
      </Card>
    </div>
  )
}
