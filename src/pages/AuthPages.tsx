import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { UserPlus, Eye, EyeOff, LogIn, ShieldAlert } from 'lucide-react'

export function MemberLoginPage() {
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)
  const { login } = useAuth()
  const navigate = useNavigate()

  const handleLogin = async () => {
    if (!identifier || !password) {
      alert('Please fill in both fields')
      return
    }
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
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl border border-primary/30 bg-primary/10">
            <LogIn className="h-5 w-5 text-primary" />
          </div>
          <CardTitle className="text-xl text-primary">Member Login</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input
            placeholder="Username"
            value={identifier}
            onChange={e => setIdentifier(e.target.value)}
            className="bg-input/50 border-border/50"
          />
          <div className="relative">
            <Input
              type={showPass ? 'text' : 'password'}
              placeholder="Password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="bg-input/50 border-border/50 pr-10"
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
          <Button onClick={handleLogin} className="w-full gold-gradient text-gold-foreground font-semibold shadow-lg" disabled={loading}>
            {loading ? 'Logging in...' : 'Login'}
          </Button>
          <div className="text-center mt-4">
            <Button variant="link" onClick={() => navigate('/register')} className="text-sm text-muted-foreground">
              First time? Register here
            </Button>
          </div>
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
    if (!username || !password) {
      alert('Please fill in both fields')
      return
    }
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
      <Card className="relative w-full max-w-md border-border/50 bg-card/80 backdrop-blur-xl shadow-2xl shadow-black/40">
        <CardHeader className="text-center space-y-3">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl border border-amber-500/30 bg-amber-500/10">
            <ShieldAlert className="h-5 w-5 text-amber-400" />
          </div>
          <CardTitle className="text-xl text-amber-400">Admin Login</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input
            placeholder="Admin Username"
            value={username}
            onChange={e => setUsername(e.target.value)}
            className="bg-input/50 border-border/50"
          />
          <div className="relative">
            <Input
              type={showPass ? 'text' : 'password'}
              placeholder="Password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="bg-input/50 border-border/50 pr-10"
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
          <Button onClick={handleLogin} className="w-full bg-amber-600 hover:bg-amber-500 text-white font-semibold shadow-lg transition-all" disabled={loading}>
            {loading ? 'Logging in...' : 'Admin Login'}
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
  const [searchParams] = useSearchParams()
  const [code, setCode] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [name, setName] = useState('')
  const [nameManuallyEdited, setNameManuallyEdited] = useState(false)
  const [gender, setGender] = useState('')
  const [dob, setDob] = useState('')
  const [email, setEmail] = useState('')
  const [cc, setCc] = useState('+91')
  const [phone, setPhone] = useState('')
  const [showCode, setShowCode] = useState(false)
  const [showPass, setShowPass] = useState(false)
  const [showConfirmPass, setShowConfirmPass] = useState(false)
  const [loading, setLoading] = useState(false)
  const { register } = useAuth()
  const navigate = useNavigate()

  const lookupInviteSlot = async (passcodeToCheck: string) => {
    const trimmed = passcodeToCheck.trim()
    if (!trimmed) return
    const { data } = await supabase
      .from('alumni')
      .select('full_name')
      .eq('placeholder_code', trimmed)
      .eq('is_placeholder', true)
      .maybeSingle()

    if (data?.full_name && !nameManuallyEdited) {
      setName(data.full_name)
    }
  }

  useEffect(() => {
    const linkCode = searchParams.get('code')?.trim() || localStorage.getItem('pending_invite_code') || ''
    if (linkCode) {
      lookupInviteSlot(linkCode)
    }
  }, [searchParams])

  useEffect(() => {
    if (code.trim().length >= 4) {
      lookupInviteSlot(code)
    }
  }, [code])

  const handleRegister = async () => {
    if (!
