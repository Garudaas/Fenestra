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
    <div className="mx-auto grid max-w-5xl gap-4 md:grid-cols-2">
      {members.map(m => {
        const memberFamily = familyData.filter(f => f.alumni_id === m.id)
        const isExpanded = expanded.has(m.id)
        const waClean = m.whatsapp_number ? m.whatsapp_number.replace(/[^0-9]/g, '') : ''

        return (
          <Card key={m.id} className="overflow-hidden border-border/40 bg-card/60 backdrop-blur-sm transition-all duration-300 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5">
            <div className="flex items-center gap-3 p-4">
              {m.profile_picture_url ? (
                <img src={m.profile_picture_url} className="h-12 w-12 rounded-full border-2 border-primary/20 object-cover shadow-md" alt="" />
              ) : (
                <div className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-primary/20 bg-gradient-to-br from-primary/20 to-accent text-lg font-bold text-primary shadow-md">
                  {m.full_name?.[0] || '?'}
                </div>
              )}
              <div className="flex-1 cursor-pointer" onClick={() => toggleExpand(m.id)}>
                <h3 className="text-sm font-bold text-foreground">{m.full_name}</h3>
                <p className="text-[11px] text-muted-foreground">
                  {m.class_nickname && <span className="text-primary font-medium">{m.class_nickname}</span>}
                  {m.class_nickname && ' · '}
                  {m.current_status || 'Member'}
                </p>
                {m.id !== user.id && (
                  <div className="mt-1.5 flex items-center gap-2">
                    <Button variant="ghost" size="sm" className="h-6 gap-1 px-2 text-[10px] text-primary/80 hover:text-primary hover:bg-primary/10" onClick={e => { e.stopPropagation(); onStartVideoCall(`DM-${Math.min(user.id, m.id)}-${Math.max(user.id, m.id)}`) }}>
                      <Video className="h-3 w-3" /> Call
                    </Button>
                    <Button variant="ghost" size="sm" className="h-6 gap-1 px-2 text-[10px] text-emerald-500/80 hover:text-emerald-400 hover:bg-emerald-500/10" onClick={e => { e.stopPropagation(); onStartDM(m.id, m.full_name) }}>
                      <MessageCircle className="h-3 w-3" /> DM
                    </Button>
                    {m.email && (
                      <a href={`mailto:${m.email}`} onClick={e => e.stopPropagation()} className="flex items-center gap-1 rounded px-2 py-0.5 text-[10px] text-muted-foreground hover:text-foreground transition-colors">
                        <Mail className="h-3 w-3" />
                      </a>
                    )}
                  </div>
                )}
              </div>
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-muted-foreground" onClick={() => toggleExpand(m.id)}>
                {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </Button>
            </div>

            {isExpanded && (
              <CardContent className="space-y-3 border-t border-border/30 bg-muted/20 pt-4 text-xs">
                <div className="grid grid-cols-2 gap-2">
                  {m.whatsapp_number && (
                    <div className="flex items-center gap-1.5">
                      <Phone className="h-3 w-3 text-emerald-500" />
                      <a href={`https://wa.me/${waClean}`} target="_blank" rel="noreferrer" className="font-medium text-emerald-500 hover:underline">{m.whatsapp_number}</a>
                    </div>
                  )}
                  <div><span className="text-muted-foreground">Blood: </span><span className="font-semibold text-destructive/80">{m.blood_group || '-'}</span></div>
                  {m.email && (
                    <div className="col-span-2 flex items-center gap-1.5">
                      <Mail className="h-3 w-3 text-primary/70" />
                      <a href={`mailto:${m.email}`} className="font-medium text-primary/80 hover:underline">{m.email}</a>
                    </div>
                  )}
                  {m.contact_number && (
                    <div className="col-span-2 flex items-center gap-1.5">
                      <Phone className="h-3 w-3 text-primary/70" />
                      <a href={`tel:${m.contact_number.replace(/\s/g, '')}`} className="font-medium text-primary/80 hover:underline">{m.contact_number}</a>
                    </div>
                  )}
                </div>
                <div className="space-y-1.5 rounded-lg border border-border/30 bg-background/50 p-2.5">
                  <div className="flex items-start gap-1.5">
                    <MapPin className="h-3 w-3 mt-0.5 text-muted-foreground" />
                    <div>
                      <span className="text-muted-foreground">Permanent: </span>{m.permanent_address || '-'}
                      {m.permanent_geo_location && <a href={getMapLink(m.permanent_geo_location)!} target="_blank" rel="noreferrer" className="ml-1.5 text-primary hover:underline font-medium">View</a>}
                    </div>
                  </div>
                  <div className="flex items-start gap-1.5">
                    <MapPin className="h-3 w-3 mt-0.5 text-primary/70" />
                    <div>
                      <span className="text-muted-foreground">Current: </span>{m.current_address || '-'}
                      {m.current_geo_location && <a href={getMapLink(m.current_geo_location)!} target="_blank" rel="noreferrer" className="ml-1.5 text-primary hover:underline font-medium">View</a>}
                    </div>
                  </div>
                </div>

                {memberFamily.length > 0 && (
                  <div className="border-t border-border/30 pt-2">
                    <h4 className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-primary/80">Family Members</h4>
                    <div className="space-y-1">
                      {memberFamily.map(f => {
                        if (f.is_private && m.id !== user.id) {
                          return <div key={f.id} className="flex items-center gap-1.5 rounded border border-border/20 bg-muted/30 px-2 py-1 text-[11px] italic text-muted-foreground"><Lock className="h-3 w-3" /> Private {f.relationship}</div>
                        }
                        return (
                          <div key={f.id} className="rounded border border-border/20 bg-muted/20 px-2.5 py-1.5">
                            <span className="font-semibold">{f.name}</span>
                            <Badge variant="outline" className="ml-1.5 text-[9px] px-1.5 py-0">{f.relationship}</Badge>
                            {f.blood_group && <span className="ml-2 text-muted-foreground">Blood: {f.blood_group}</span>}
                            {f.needs_support && (
                              <div className="mt-1 flex items-center gap-1 rounded bg-destructive/10 px-2 py-0.5 text-[10px] text-destructive">
                                <AlertTriangle className="h-3 w-3" /> {f.support_details || 'Support needed'}
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
                {memberFamily.length === 0 && (
                  <div className="border-t border-border/30 pt-2">
                    <p className="text-[11px] italic text-muted-foreground">No family details added yet</p>
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
