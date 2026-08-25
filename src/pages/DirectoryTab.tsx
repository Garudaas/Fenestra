import { useState, useEffect } from 'react'
import { useAuth } from '@/context/AuthContext'
import { supabase } from '@/lib/supabase'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Video, MessageCircle, Mail, MapPin, Phone, ChevronDown, ChevronUp, AlertTriangle, Lock } from 'lucide-react'

interface DirectoryTabProps {
  onStartDM: (id: number, name: string) => void
  onStartVideoCall: (roomName: string) => void
}

export default function DirectoryTab({ onStartDM, onStartVideoCall }: DirectoryTabProps) {
  const { user } = useAuth()
  const [members, setMembers] = useState<any[]>([])
  const [familyData, setFamilyData] = useState<any[]>([])
  const [expanded, setExpanded] = useState<Set<number>>(new Set())

  useEffect(() => {
    loadDirectory()
  }, [])

  const loadDirectory = async () => {
    const [usersRes, familyRes] = await Promise.all([
      supabase.from('alumni').select('*').eq('is_placeholder', false).eq('hide_from_peers', false).neq('full_name', 'System Administrator'),
      supabase.from('family_members').select('*'),
    ])
    if (usersRes.data) setMembers(usersRes.data)
    if (familyRes.data) setFamilyData(familyRes.data)
  }

  const toggleExpand = (id: number) => {
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const getMapLink = (loc: string | null) => {
    if (!loc) return null
    const clean = loc.trim()
    if (clean.startsWith('http://') || clean.startsWith('https://')) return clean
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(clean)}`
  }

  if (!user) return null

  return (
    <div className="mx-auto grid max-w-5xl gap-2 md:grid-cols-2">
      {members.map(m => {
        const memberFamily = familyData.filter(f => f.alumni_id === m.id)
        const isExpanded = expanded.has(m.id)
        const waClean = m.whatsapp_number ? m.whatsapp_number.replace(/[^0-9]/g, '') : ''

        return (
          <Card key={m.id} className="overflow-hidden border-border/40 bg-card/60 backdrop-blur-sm transition-all duration-300 hover:border-primary/30 hover:shadow-sm hover:shadow-primary/5">
            <div className="flex items-center gap-2 p-1.5">
              {m.profile_picture_url ? (
                <img src={m.profile_picture_url} className="h-8 w-8 rounded-full border border-primary/20 object-cover shadow-sm" alt="" />
              ) : (
                <div className="flex h-8 w-8 items-center justify-center rounded-full border border-primary/20 bg-gradient-to-br from-primary/20 to-accent text-xs font-bold text-primary shadow-sm">
                  {m.full_name?.[0] || '?'}
                </div>
              )}
              <div className="flex-1 min-w-0 cursor-pointer" onClick={() => toggleExpand(m.id)}>
                <h3 className="truncate text-sm font-bold text-foreground leading-tight">{m.full_name}</h3>
                <p className="truncate text-[10px] text-muted-foreground leading-tight">
                  {m.class_nickname && <span className="text-primary font-medium">{m.class_nickname}</span>}
                  {m.class_nickname && ' · '}
                  {m.current_status || 'Member'}
                </p>
              </div>
              
              <div className="flex items-center gap-0.5">
                {m.id !== user.id && (
                  <>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-primary/80 hover:text-primary hover:bg-primary/10" onClick={e => { e.stopPropagation(); onStartVideoCall(`DM-${Math.min(user.id, m.id)}-${Math.max(user.id, m.id)}`) }} title="Call">
                      <Video className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-emerald-500/80 hover:text-emerald-400 hover:bg-emerald-500/10" onClick={e => { e.stopPropagation(); onStartDM(m.id, m.full_name) }} title="DM">
                      <MessageCircle className="h-3.5 w-3.5" />
                    </Button>
                    {m.email && (
                      <a href={`mailto:${m.email}`} onClick={e => e.stopPropagation()} className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors" title="Email">
                        <Mail className="h-3.5 w-3.5" />
                      </a>
                    )}
                  </>
                )}
                <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground ml-1" onClick={() => toggleExpand(m.id)}>
                  {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            {isExpanded && (
              <CardContent className="space-y-2 border-t border-border/30 bg-muted/20 p-2 text-[11px]">
                <div className="grid grid-cols-2 gap-1.5">
                  {m.whatsapp_number && (
                    <div className="flex items-center gap-1">
                      <Phone className="h-3 w-3 text-emerald-500" />
                      <a href={`https://wa.me/${waClean}`} target="_blank" rel="noreferrer" className="font-medium text-emerald-500 hover:underline">{m.whatsapp_number}</a>
                    </div>
                  )}
                  <div><span className="text-muted-foreground">Blood: </span><span className="font-semibold text-destructive/80">{m.blood_group || '-'}</span></div>
                  {m.email && (
                    <div className="col-span-2 flex items-center gap-1">
                      <Mail className="h-3 w-3 text-primary/70" />
                      <a href={`mailto:${m.email}`} className="truncate font-medium text-primary/80 hover:underline">{m.email}</a>
                    </div>
                  )}
                  {m.contact_number && (
                    <div className="col-span-2 flex items-center gap-1">
                      <Phone className="h-3 w-3 text-primary/70" />
                      <a href={`tel:${m.contact_number.replace(/\s/g, '')}`} className="font-medium text-primary/80 hover:underline">{m.contact_number}</a>
                    </div>
                  )}
                </div>
                <div className="space-y-1 rounded border border-border/30 bg-background/50 p-1.5">
                  <div className="flex items-start gap-1">
                    <MapPin className="h-3 w-3 mt-0.5 shrink-0 text-muted-foreground" />
                    <div className="leading-tight">
                      <span className="text-muted-foreground">Permanent: </span>{m.permanent_address || '-'}
                      {m.permanent_geo_location && <a href={getMapLink(m.permanent_geo_location)!} target="_blank" rel="noreferrer" className="ml-1 text-primary hover:underline font-medium">View</a>}
                    </div>
                  </div>
                  <div className="flex items-start gap-1">
                    <MapPin className="h-3 w-3 mt-0.5 shrink-0 text-primary/70" />
                    <div className="leading-tight">
                      <span className="text-muted-foreground">Current: </span>{m.current_address || '-'}
                      {m.current_geo_location && <a href={getMapLink(m.current_geo_location)!} target="_blank" rel="noreferrer" className="ml-1 text-primary hover:underline font-medium">View</a>}
                    </div>
                  </div>
                </div>

                {memberFamily.length > 0 && (
                  <div className="border-t border-border/30 pt-1.5">
                    <h4 className="mb-1 text-[10px] font-bold uppercase tracking-wider text-primary/80">Family</h4>
                    <div className="space-y-1">
                      {memberFamily.map(f => {
                        if (f.is_private && m.id !== user.id) {
                          return <div key={f.id} className="flex items-center gap-1 rounded border border-border/20 bg-muted/30 px-1.5 py-0.5 text-[10px] italic text-muted-foreground"><Lock className="h-2.5 w-2.5" /> Private {f.relationship}</div>
                        }
                        return (
                          <div key={f.id} className="flex flex-wrap items-center gap-x-1.5 rounded border border-border/20 bg-muted/20 px-1.5 py-1 leading-tight">
                            <span className="font-semibold">{f.name}</span>
                            <Badge variant="outline" className="text-[8px] px-1 py-0 h-3.5 leading-none">{f.relationship}</Badge>
                            {f.blood_group && <span className="text-muted-foreground text-[9px]">Blood: {f.blood_group}</span>}
                            {f.needs_support && (
                              <div className="mt-0.5 flex w-full items-center gap-1 rounded bg-destructive/10 px-1.5 py-0.5 text-[9px] text-destructive">
                                <AlertTriangle className="h-2.5 w-2.5" /> {f.support_details || 'Support needed'}
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
                {memberFamily.length === 0 && (
                  <div className="border-t border-border/30 pt-1.5">
                    <p className="text-[10px] italic text-muted-foreground">No family details added yet</p>
                  </div>
                )}
              </CardContent>
            )}
          </Card>
        )
      })}
    </div>
  )
}
