import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Key, Users, Plus, LogOut, Crown } from 'lucide-react'

export default function AdminDashboard() {
  const { user, logout, isAdmin } = useAuth()
  const navigate = useNavigate()
  const [roster, setRoster] = useState<any[]>([])
  const [newCode, setNewCode] = useState('')

  useEffect(() => {
    if (!user || !isAdmin) {
      navigate('/')
      return
    }
    loadRoster()
  }, [user, isAdmin, navigate])

  const loadRoster = async () => {
    const { data } = await supabase.from('alumni').select('*')
    if (data) setRoster(data)
  }

  const createCode = async () => {
    if (!newCode.trim()) return
    const { error } = await supabase.from('alumni').insert([{ placeholder_code: newCode.trim(), is_placeholder: true }])
    if (error) {
      alert('Creation Failed: ' + error.message)
      return
    }
    setNewCode('')
    loadRoster()
  }

  const handleLogout = () => {
    logout()
    navigate('/')
  }

  if (!user || !isAdmin) return null

  return (
    <div className="flex min-h-svh flex-col">
      <header className="flex items-center justify-between bg-card/80 backdrop-blur-xl border-b border-border/30 shadow-lg shadow-black/5 px-4 py-3">
        <h1 className="flex items-center gap-2 text-lg font-bold text-primary">
          <Crown className="h-5 w-5" />
          Admin Dashboard
        </h1>
        <Button variant="outline" size="sm" onClick={handleLogout} className="gap-1.5">
          <LogOut className="h-3.5 w-3.5" />
          Log Out
        </Button>
      </header>

      <main className="mx-auto grid w-full max-w-7xl flex-1 gap-6 p-6 md:grid-cols-3">
        <Card className="h-fit border-border/40 bg-card/60 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm text-primary">
              <Key className="h-4 w-4" />
              Generate Registration Code
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input value={newCode} onChange={e => setNewCode(e.target.value)} placeholder="Enter new passcode" />
            <Button onClick={createCode} className="w-full gold-gradient text-gold-foreground gap-2">
              <Plus className="h-4 w-4" />
              Create Code
            </Button>
          </CardContent>
        </Card>

        <Card className="md:col-span-2 border-border/40 bg-card/60 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm text-primary">
              <Users className="h-4 w-4" />
              Class Roster List
            </CardTitle>
          </CardHeader>
          <CardContent className="max-h-[500px] space-y-3 overflow-y-auto">
            {roster.map(m => (
              <div key={m.id} className="rounded-md border border-border/30 bg-muted/20 hover:bg-muted/30 transition-colors px-3 py-2 text-xs">
                {m.full_name || 'Empty Slot'} {m.is_placeholder && <span className="text-muted-foreground">(Unclaimed - Code: {m.placeholder_code})</span>}
              </div>
            ))}
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
