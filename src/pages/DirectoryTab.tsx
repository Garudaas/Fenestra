import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { supabase } from '@/lib/supabase'
import { fetchAllBloodGroups } from '@/lib/fenestriansCore'
import { cleanPhoneNumber } from '@/lib/formatters'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Video,
  MessageCircle,
  Mail,
  MapPin,
  Search,
  Droplets,
  Briefcase,
  RotateCcw,
  ChevronRight,
  HandHeart,
  Phone,
} from 'lucide-react'

interface DirectoryTabProps {
  onStartDM: (id: number, name: string) => void
  onStartVideoCall: (roomName: string) => void
  onOpenSupportRequests?: () => void
}

export default function DirectoryTab({
  onStartDM,
  onStartVideoCall,
  onOpenSupportRequests,
}: DirectoryTabProps) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [members, setMembers] = useState<any[]>([])
  const [openSupportCount, setOpenSupportCount] = useState(0)

  const [searchQuery, setSearchQuery] = useState('')
  const [bloodFilter, setBloodFilter] = useState('')
  const [cityFilter, setCityFilter] = useState('')
  const [professionFilter, setProfessionFilter] = useState('')
  const [bloodOptions, setBloodOptions] = useState<string[]>([])

  useEffect(() => {
    loadDirectory()
  }, [])

  const loadDirectory = async () => {
    const [usersRes, bgs, supportRes] = await Promise.all([
      supabase
        .from('alumni')
        .select('*')
        .eq('is_placeholder', false)
        .eq('hide_from_peers', false)
        .neq('full_name', 'System Administrator'),
      fetchAllBloodGroups(),
      supabase
        .from('family_support_requests')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'open'),
    ])
    if (usersRes.data) setMembers(usersRes.data)
    setBloodOptions(bgs)
    setOpenSupportCount(supportRes.count || 0)
  }

  const professionOptions = useMemo(() => {
    const set = new Set<string>()
    for (const m of members) {
      if (m.current_status && String(m.current_status).trim()) {
        set.add(String(m.current_status).trim())
      }
    }
    return Array.from(set).sort()
  }, [members])

  const filteredMembers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    const cityQ = cityFilter.trim().toLowerCase()

    return members.filter(m => {
      if (bloodFilter && (m.blood_group || '').trim().toLowerCase() !== bloodFilter.toLowerCase()) {
        return false
      }
      if (
        professionFilter &&
        (m.current_status || '').trim().toLowerCase() !== professionFilter.toLowerCase()
      ) {
        return false
      }
      if (cityQ) {
        const addrBlob = `${m.current_address || ''} ${m.permanent_address || ''}`.toLowerCase()
        if (!addrBlob.includes(cityQ)) return false
      }
      if (q) {
        const haystack = [
          m.full_name,
          m.class_nickname,
          m.blood_group,
          m.current_status,
          m.current_address,
          m.permanent_address,
          cleanPhoneNumber(m.contact_number),
          cleanPhoneNumber(m.whatsapp_number),
          m.email,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
        if (!haystack.includes(q)) return false
      }
      return true
    })
  }, [members, searchQuery, bloodFilter, cityFilter, professionFilter])

  const hasActiveFilters = Boolean(searchQuery || bloodFilter || cityFilter || professionFilter)

  const clearFilters = () => {
    setSearchQuery('')
    setBloodFilter('')
    setCityFilter('')
    setProfessionFilter('')
  }

  if (!user) return null

  return (
    <div className="mx-auto max-w-5xl space-y-3">
      {/* Search Bar & Emergency Donor / Location / Profession Filters */}
      <Card className="border-primary/30 bg-card/75 backdrop-blur-sm">
        <CardContent className="p-3 space-y-2.5">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search members by name, nickname, phone, city, or status..."
              className="pl-9 bg-background/60 border-border/50 text-xs h-9"
            />
          </div>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-4">
            <div className="relative flex items-center">
              <Droplets className="absolute left-2.5 h-3.5 w-3.5 text-red-400 pointer-events-none" />
              <select
                value={bloodFilter}
                onChange={e => setBloodFilter(e.target.value)}
                className="w-full h-8 rounded-md border border-border/50 bg-background/80 pl-8 pr-2 text-xs"
              >
                <option value="">All Blood Groups</option>
                {bloodOptions.map(bg => (
                  <option key={bg} value={bg}>
                    Blood: {bg}
                  </option>
                ))}
              </select>
            </div>

            <div className="relative flex items-center">
              <MapPin className="absolute left-2.5 h-3.5 w-3.5 text-primary pointer-events-none" />
              <Input
                value={cityFilter}
                onChange={e => setCityFilter(e.target.value)}
                placeholder="Filter by Current City..."
                className="h-8 pl-8 bg-background/80 border-border/50 text-xs"
              />
            </div>

            <div className="relative flex items-center">
              <Briefcase className="absolute left-2.5 h-3.5 w-3.5 text-emerald-400 pointer-events-none" />
              <select
                value={professionFilter}
                onChange={e => setProfessionFilter(e.target.value)}
                className="w-full h-8 rounded-md border border-border/50 bg-background/80 pl-8 pr-2 text-xs"
              >
                <option value="">All Professions</option>
                {professionOptions.map(prof => (
                  <option key={prof} value={prof}>
                    {prof}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center justify-between sm:justify-end gap-2">
              <span className="text-[11px] font-medium text-muted-foreground">
                Showing <span className="font-bold text-primary">{filteredMembers.length}</span> of {members.length}
              </span>
              {hasActiveFilters && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={clearFilters}
                  className="h-8 px-2 text-xs text-primary hover:bg-primary/10 gap-1"
                >
                  <RotateCcw className="h-3 w-3" />
                  Reset
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {filteredMembers.length === 0 ? (
        <div className="rounded-xl border border-border/30 bg-card/50 p-8 text-center space-y-2">
          <p className="text-sm font-semibold text-foreground">No matching members found</p>
          <p className="text-xs text-muted-foreground">Try clearing or adjusting your search filters.</p>
        </div>
      ) : (
        <div className="grid gap-2 md:grid-cols-2">
          {filteredMembers.map(m => {
            const cleanDial = cleanPhoneNumber(m.contact_number)
            return (
              <Card
                key={m.id}
                onClick={() => navigate(`/member/${m.id}`)}
                className="cursor-pointer overflow-hidden border-border/40 bg-card/60 backdrop-blur-sm transition-all duration-300 hover:border-primary/40 hover:bg-primary/5 hover:shadow-sm hover:shadow-primary/5"
              >
                <div className="flex items-center gap-2.5 p-2">
                  {m.profile_picture_url ? (
                    <img
                      src={m.profile_picture_url}
                      className="h-10 w-10 shrink-0 rounded-full border border-primary/30 object-cover shadow-sm"
                      alt={m.full_name}
                    />
                  ) : (
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-primary/20 bg-gradient-to-br from-primary/20 to-accent text-sm font-bold text-primary shadow-sm">
                      {m.full_name?.[0] || '?'}
                    </div>
                  )}

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <h3 className="truncate text-sm font-bold text-foreground leading-tight">{m.full_name}</h3>
                      {m.blood_group && (
                        <span className="shrink-0 rounded bg-red-500/15 px-1.5 py-0.5 text-[9px] font-bold text-red-400">
                          {m.blood_group}
                        </span>
                      )}
                    </div>
                    <p className="truncate text-[11px] text-muted-foreground leading-tight mt-0.5">
                      {m.class_nickname && <span className="text-primary font-medium">{m.class_nickname}</span>}
                      {m.class_nickname && ' · '}
                      {m.current_status || 'Member'}
                    </p>
                  </div>

                  <div className="flex items-center gap-0.5">
                    {m.id !== user.id && (
                      <>
                        {cleanDial && (
                          <a
                            href={`tel:${cleanDial}`}
                            onClick={e => e.stopPropagation()}
                            className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                            title={`Call ${cleanDial}`}
                          >
                            <Phone className="h-3.5 w-3.5" />
                          </a>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-primary/80 hover:text-primary hover:bg-primary/10"
                          onClick={e => {
                            e.stopPropagation()
                            onStartVideoCall(`DM-${Math.min(user.id, m.id)}-${Math.max(user.id, m.id)}`)
                          }}
                          title="Video Call"
                        >
                          <Video className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-emerald-500/80 hover:text-emerald-400 hover:bg-emerald-500/10"
                          onClick={e => {
                            e.stopPropagation()
                            onStartDM(m.id, m.full_name)
                          }}
                          title="Direct Message"
                        >
                          <MessageCircle className="h-3.5 w-3.5" />
                        </Button>
                        {m.email && (
                          <a
                            href={`mailto:${m.email}`}
                            onClick={e => e.stopPropagation()}
                            className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                            title="Send Email"
                          >
                            <Mail className="h-3.5 w-3.5" />
                          </a>
                        )}
                      </>
                    )}
                    <ChevronRight className="h-4 w-4 text-muted-foreground ml-1" />
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
      )}

      {/* Family Support Requests Button at Bottom of Member Directory */}
      <div className="pt-2">
        <Button
          type="button"
          variant="outline"
          onClick={() =>
            onOpenSupportRequests
              ? onOpenSupportRequests()
              : navigate('/dashboard?tab=support')
          }
          className="w-full border-primary/40 bg-card/80 text-primary hover:bg-primary/10 font-semibold gap-2 py-5"
        >
          <HandHeart className="h-4 w-4" />
          Display Family Support Requests Page
          {openSupportCount > 0 && (
            <span className="rounded-full bg-red-600 px-2 py-0.5 text-[11px] font-bold text-white">
              {openSupportCount} Open
            </span>
          )}
        </Button>
      </div>
    </div>
  )
}
