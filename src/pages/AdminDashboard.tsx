import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { supabase } from '@/lib/supabase'
import MaintenanceTab from '@/pages/MaintenanceTab'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Crown,
  Users,
  Wrench,
  LogOut,
  KeyRound,
  Plus,
  LayoutDashboard,
  Building2,
  Wallet,
  Trash2,
  HardDrive,
} from 'lucide-react'

interface RosterMemberRow {
  id: number
  full_name: string
  is_placeholder: boolean
  placeholder_code: string | null
  is_admin: boolean
  storage_quota_mb: number | null
}

export default function AdminDashboard() {
  const { user, logout, isAdmin } = useAuth()
  const navigate = useNavigate()

  const [activeTab, setActiveTab] = useState<'roster' | 'maintenance'>('roster')
  const [passcodeInput, setPasscodeInput] = useState('')
  const [creatingCode, setCreatingCode] = useState(false)
  const [roster, setRoster] = useState<RosterMemberRow[]>([])
  const [loadingRoster, setLoadingRoster] = useState(true)

  const [quotaEditId, setQuotaEditId] = useState<number | null>(null)
  const [quotaValue, setQuotaValue] = useState('100')
  const [savingQuota, setSavingQuota] = useState(false)

  const userIsAdmin = Boolean(isAdmin || user?.is_admin)

  useEffect(() => {
    if (!user || !userIsAdmin) {
      navigate('/')
      return
    }
    loadRoster()
  }, [user, userIsAdmin, navigate])

  const loadRoster = async () => {
    setLoadingRoster(true)
    const { data } = await supabase
      .from('alumni')
      .select('id, full_name, is_placeholder, placeholder_code, is_admin, storage_quota_mb')
      .order('id', { ascending: true })

    setRoster((data ?? []) as RosterMemberRow[])
    setLoadingRoster(false)
  }

  const handleCreateCode = async () => {
    const cleanCode = passcodeInput.trim()
    if (!cleanCode) {
      alert('Please enter a new registration passcode.')
      return
    }

    setCreatingCode(true)
    const { error } = await supabase.from('alumni').insert([
      {
        full_name: 'Empty Slot',
        placeholder_code: cleanCode,
        is_placeholder: true,
        custom_username: `pending_${cleanCode.toLowerCase().replace(/[^a-z0-9]/g, '')}_${Date.now()}`,
        custom_password: '',
        gender: 'Male',
        hide_from_peers: false,
        hide_from_admin: false,
        is_admin: false,
      },
    ])
    setCreatingCode(false)

    if (error) {
      alert('Could not create registration code: ' + error.message)
      return
    }

    setPasscodeInput('')
    await loadRoster()
  }

  const handleDeletePlaceholder = async (slot: RosterMemberRow) => {
    if (!slot.is_placeholder) return
    if (!window.confirm(`Delete unclaimed slot (Code: ${slot.placeholder_code})?`)) return
    await supabase.from('alumni').delete().eq('id', slot.id)
    await loadRoster()
  }

  const handleSaveQuota = async (targetUserId: number) => {
    if (!user) return
    const mb = Number(quotaValue)
    if (!Number.isFinite(mb) || mb < 10 || mb > 102400) {
      alert('Enter a valid quota between 10 MB and 102400 MB.')
      return
    }

    setSavingQuota(true)
    const { error } = await supabase.rpc('admin_update_member_quota', {
      p_admin_id: user.id,
      p_target_user_id: targetUserId,
      p_new_quota_mb: Math.round(mb),
    })

    if (error) {
      await supabase
        .from('alumni')
        .update({ storage_quota_mb: Math.round(mb) })
        .eq('id', targetUserId)
    }

    setSavingQuota(false)
    setQuotaEditId(null)
    await loadRoster()
  }

  const handleLogout = () => {
    logout()
    navigate('/')
  }

  if (!user || !userIsAdmin) return null

  return (
    <div className="min-h-svh bg-background pt-16 pb-28">
      <header className="fixed top-0 left-0 right-0 z-40 border-b border-border/50 bg-card/90 backdrop-blur-xl shadow-lg">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-2 px-4 py-2.5">
          <div className="flex shrink-0 items-center gap-2">
            <Crown className="h-5 w-5 text-primary" />
            <span className="text-sm sm:text-base font-bold text-primary">Admin Dashboard</span>
          </div>

          <nav className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => navigate('/dashboard')}
              className="h-8 gap-1.5 px-2.5 text-xs border-primary/40 text-primary hover:bg-primary/10 shrink-0"
            >
              <LayoutDashboard className="h-3.5 w-3.5" />
              <span>Activities</span>
            </Button>

            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => navigate('/alumni-association')}
              className="h-8 gap-1.5 px-2.5 text-xs border-primary/40 text-primary hover:bg-primary/10 shrink-0"
            >
              <Building2 className="h-3.5 w-3.5" />
              <span>Alumni</span>
            </Button>

            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => navigate('/treasury')}
              className="h-8 gap-1.5 px-2.5 text-xs border-primary/40 text-primary hover:bg-primary/10 shrink-0"
            >
              <Wallet className="h-3.5 w-3.5" />
              <span>Treasury</span>
            </Button>

            <div className="mx-1 h-5 w-px bg-border/50 shrink-0" />

            <Button
              type="button"
              size="sm"
              variant={activeTab === 'roster' ? 'default' : 'ghost'}
              onClick={() => setActiveTab('roster')}
              className={`h-8 gap-1.5 px-2.5 text-xs shrink-0 ${
                activeTab === 'roster'
                  ? 'gold-gradient text-gold-foreground font-semibold'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Users className="h-3.5 w-3.5" />
              <span>Roster</span>
            </Button>

            <Button
              type="button"
              size="sm"
              variant={activeTab === 'maintenance' ? 'default' : 'ghost'}
              onClick={() => setActiveTab('maintenance')}
              className={`h-8 gap-1.5 px-2.5 text-xs shrink-0 ${
                activeTab === 'maintenance'
                  ? 'gold-gradient text-gold-foreground font-semibold'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Wrench className="h-3.5 w-3.5" />
              <span>Maintenance</span>
            </Button>

            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={handleLogout}
              className="h-8 gap-1.5 px-2.5 text-xs text-destructive hover:bg-destructive/10 shrink-0"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span>Log Out</span>
            </Button>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 pt-3">
        {activeTab === 'roster' ? (
          <div className="space-y-5">
            <Card className="border-border/40 bg-card/75 backdrop-blur-sm">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base text-primary">
                  <KeyRound className="h-4 w-4" />
                  Generate Registration Code
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Input
                  value={passcodeInput}
                  onChange={e => setPasscodeInput(e.target.value)}
                  placeholder="Enter new passcode"
                  className="text-xs"
                />
                <Button
                  type="button"
                  disabled={creatingCode}
                  onClick={handleCreateCode}
                  className="w-full gold-gradient text-gold-foreground font-bold gap-1.5 text-xs"
                >
                  <Plus className="h-4 w-4" />
                  {creatingCode ? 'Creating...' : 'Create Code'}
                </Button>
              </CardContent>
            </Card>

            <Card className="border-border/40 bg-card/75 backdrop-blur-sm">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base text-primary">
                  <Users className="h-4 w-4" />
                  Class Roster List ({roster.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {loadingRoster ? (
                  <p className="py-6 text-center text-xs text-muted-foreground">Loading roster...</p>
                ) : (
                  roster.map(row => (
                    <div
                      key={row.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border/35 bg-muted/15 px-3.5 py-2.5 text-xs"
                    >
                      {row.is_placeholder ? (
                        <div className="flex items-center justify-between w-full gap-2">
                          <span className="text-muted-foreground">
                            Empty Slot{' '}
                            <span className="font-mono text-foreground/80">
                              (Unclaimed - Code: {row.placeholder_code})
                            </span>
                          </span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDeletePlaceholder(row)}
                            className="h-7 w-7 text-destructive hover:bg-destructive/10"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={() => navigate(`/member/${row.id}`)}
                            className="font-semibold text-foreground hover:text-primary hover:underline text-left"
                          >
                            {row.full_name}
                            {row.is_admin && (
                              <span className="ml-2 rounded bg-primary/15 px-1.5 py-0.5 text-[10px] font-bold text-primary">
                                Admin
                              </span>
                            )}
                          </button>

                          <div className="flex items-center gap-1.5">
                            {quotaEditId === row.id ? (
                              <div className="flex items-center gap-1">
                                <Input
                                  type="number"
                                  min={10}
                                  max={102400}
                                  value={quotaValue}
                                  onChange={e => setQuotaValue(e.target.value)}
                                  className="h-7 w-20 text-xs"
                                />
                                <Button
                                  type="button"
                                  size="sm"
                                  disabled={savingQuota}
                                  onClick={() => handleSaveQuota(row.id)}
                                  className="h-7 px-2 text-[11px] gold-gradient text-gold-foreground font-semibold"
                                >
                                  Save
                                </Button>
                              </div>
                            ) : (
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setQuotaEditId(row.id)
                                  setQuotaValue(String(row.storage_quota_mb || 100))
                                }}
                                className="h-7 px-2 text-[11px] text-muted-foreground hover:text-primary gap-1"
                              >
                                <HardDrive className="h-3 w-3" />
                                {row.storage_quota_mb || 100} MB
                              </Button>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>
        ) : (
          <MaintenanceTab />
        )}
      </main>
    </div>
  )
}
