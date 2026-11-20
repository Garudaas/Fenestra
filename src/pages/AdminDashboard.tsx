import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Key, Users, Plus, LogOut, Crown, Wrench } from 'lucide-react'
import MaintenanceTab from '@/pages/MaintenanceTab'

export default function AdminDashboard() {
  const { user, logout, isAdmin } = useAuth()
  const navigate = useNavigate()
  const [roster, setRoster] = useState<any[]>([])
  const [newCode, setNewCode] = useState('')
  const [adminView, setAdminView] = useState<'roster' | 'maintenance'>('roster')

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
    const { error } = await supabase
      .from('alumni')
      .insert([{ placeholder_code: newCode.trim(), is_placeholder: true }])
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
      <header className="flex flex-wrap items-center justify-between gap-2 bg-card/80 backdrop-blur-xl border-b border-border/30 shadow-lg shadow-black/5 px-4 py-3">
        <h1 className="flex items-center gap-2 text-lg font-bold text-primary">
          <Crown className="h-5 w-5" />
          Admin Dashboard
        </h1>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            title="Class Roster & Registration Codes"
            variant={adminView === 'roster' ? 'default' : 'ghost'}
            onClick={() => setAdminView('roster')}
            className={adminView === 'roster' ? 'gold-gradient text-gold-foreground gap-1.5' : 'gap-1.5'}
          >
            <Users className="h-3.5 w-3.5" />
            Roster
          </Button>
          <Button
            size="sm"
            title="Admin Maintenance & Profile Audits"
            variant={adminView === 'maintenance' ? 'default' : 'ghost'}
            onClick={() => setAdminView('maintenance')}
            className={adminView === 'maintenance' ? 'gold-gradient text-gold-foreground gap-1.5' : 'gap-1.5'}
          >
            <Wrench className="h-3.5 w-3.5" />
            Maintenance
          </Button>
          <Button variant="outline" size="sm" title="Log Out" onClick={handleLogout} className="gap-1.5">
            <LogOut className="h-3.5 w-3.5" />
            Log Out
          </Button>
        </div>
      </header>

      {adminView === 'maintenance' ? (
        <main className="flex-1 p-6">
          <MaintenanceTab />
        </main>
      ) : (
        <main className="mx-auto grid w-full max-w-7xl flex-1 gap-6 p-6 md:grid-cols-3">
          <Card className="h-fit border-border/40 bg-card/60 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm text-primary">
                <Key className="h-4 w-4" />
                Generate Registration Code
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Input
                value={newCode}
                onChange={e => setNewCode(e.target.value)}
                placeholder="Enter new passcode"
              />
              <Button
                onClick={createCode}
                title="Create Registration Code"
                className="w-full gold-gradient text-gold-foreground gap-2"
              >
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
                <div
                  key={m.id}
                  className="rounded-md border border-border/30 bg-muted/20 hover:bg-muted/30 transition-colors px-3 py-2 text-xs"
                >
                  {m.full_name || 'Empty Slot'}{' '}
                  {m.is_placeholder && (
                    <span className="text-muted-foreground">(Unclaimed - Code: {m.placeholder_code})</span>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        </main>
      )}
    </div>
  )
}
