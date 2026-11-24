import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { supabase } from '@/lib/supabase'
import { publishArchivedAlert } from '@/lib/notificationService'
import { formatFullDate } from '@/lib/formatters'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import {
  HandHeart,
  Plus,
  CheckCircle2,
  Briefcase,
  MapPin,
  ExternalLink,
  Trash2,
  Send,
} from 'lucide-react'

interface SupportTabProps {
  mode?: 'support' | 'opportunities'
}

interface SupportRequestItem {
  id: number
  member_id: number
  member_name: string
  title: string
  description: string
  status: string
  created_at: string
}

interface OpportunityItem {
  id: number
  posted_by_id: number
  posted_by_name: string
  opp_type: string
  title: string
  company_or_org: string | null
  location: string | null
  description: string
  contact_or_link: string | null
  created_at: string
}

export default function SupportTab({ mode }: SupportTabProps) {
  const { user, isAdmin } = useAuth()
  const [searchParams] = useSearchParams()
  const userIsAdmin = Boolean(isAdmin || user?.is_admin)

  const resolvedSection: 'support' | 'opportunities' =
    mode ?? (searchParams.get('view') === 'opportunities' ? 'opportunities' : 'support')

  // Family Support states
  const [requests, setRequests] = useState<SupportRequestItem[]>([])
  const [suppTitle, setSuppTitle] = useState('')
  const [suppDesc, setSuppDesc] = useState('')
  const [postingSupport, setPostingSupport] = useState(false)

  // Batch Job, Internship & Referral Board states
  const [opportunities, setOpportunities] = useState<OpportunityItem[]>([])
  const [oppType, setOppType] = useState('Job')
  const [oppTitle, setOppTitle] = useState('')
  const [oppCompany, setOppCompany] = useState('')
  const [oppLocation, setOppLocation] = useState('')
  const [oppDesc, setOppDesc] = useState('')
  const [oppLink, setOppLink] = useState('')
  const [postingOpp, setPostingOpp] = useState(false)

  useEffect(() => {
    loadSupportAndOpportunities()
  }, [])

  const loadSupportAndOpportunities = async () => {
    const [suppRes, oppRes] = await Promise.all([
      supabase
        .from('family_support_requests')
        .select('*')
        .order('created_at', { ascending: false }),
      supabase
        .from('batch_opportunities')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false }),
    ])
    setRequests((suppRes.data ?? []) as SupportRequestItem[])
    setOpportunities((oppRes.data ?? []) as OpportunityItem[])
  }

  const handlePostSupport = async () => {
    if (!user || !suppTitle.trim() || !suppDesc.trim()) {
      alert('Please enter both a Title and Description.')
      return
    }
    setPostingSupport(true)
    const { error } = await supabase.from('family_support_requests').insert([
      {
        member_id: user.id,
        member_name: user.full_name,
        title: suppTitle.trim(),
        description: suppDesc.trim(),
        status: 'open',
      },
    ])

    if (!error) {
      await publishArchivedAlert({
        category: 'help_needed',
        shortTitle: 'Your friend Needs help',
        fullMessage: `${user.full_name} posted a support request: ${suppTitle.trim()} — ${suppDesc.trim()}`,
        needsHelpFlag: true,
      })
    }

    setPostingSupport(false)
    if (error) {
      alert('Could not post request: ' + error.message)
      return
    }
    setSuppTitle('')
    setSuppDesc('')
    await loadSupportAndOpportunities()
  }

  const handleMarkAchieved = async (id: number) => {
    await supabase.from('family_support_requests').update({ status: 'achieved' }).eq('id', id)
    await loadSupportAndOpportunities()
  }

  const handlePostOpportunity = async () => {
    if (!user || !oppTitle.trim() || !oppDesc.trim()) {
      alert('Please enter the Role / Opportunity Title and Description.')
      return
    }
    setPostingOpp(true)
    const { error } = await supabase.from('batch_opportunities').insert([
      {
        posted_by_id: user.id,
        posted_by_name: user.full_name,
        opp_type: oppType,
        title: oppTitle.trim(),
        company_or_org: oppCompany.trim() || null,
        location: oppLocation.trim() || null,
        description: oppDesc.trim(),
        contact_or_link: oppLink.trim() || null,
        is_active: true,
      },
    ])

    if (!error) {
      await publishArchivedAlert({
        category: 'member_message',
        shortTitle: `New ${oppType} Opportunity`,
        fullMessage: `${user.full_name} shared a ${oppType} opportunity: ${oppTitle.trim()}${
          oppCompany.trim() ? ` at ${oppCompany.trim()}` : ''
        }.`,
      })
    }

    setPostingOpp(false)
    if (error) {
      alert('Could not post opportunity: ' + error.message)
      return
    }
    setOppTitle('')
    setOppCompany('')
    setOppLocation('')
    setOppDesc('')
    setOppLink('')
    await loadSupportAndOpportunities()
  }

  const handleDeleteOpportunity = async (id: number) => {
    if (!window.confirm('Remove this listing?')) return
    await supabase.from('batch_opportunities').delete().eq('id', id)
    await loadSupportAndOpportunities()
  }

  if (!user) return null

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      {resolvedSection === 'support' ? (
        <Card className="border-border/40 bg-card/75 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-primary">
              <HandHeart className="h-5 w-5" />
              Family &amp; Batch Support Requests
            </CardTitle>
            <CardDescription className="text-xs">
              Post medical, educational, or emergency assistance requests for immediate batch support.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4 text-xs">
            <div className="rounded-xl border border-primary/30 bg-primary/5 p-3.5 space-y-2.5">
              <Input
                value={suppTitle}
                onChange={e => setSuppTitle(e.target.value)}
                placeholder="Request Title (e.g., Medical Assistance / Hospital Reference)"
                className="text-xs"
              />
              <Textarea
                value={suppDesc}
                onChange={e => setSuppDesc(e.target.value)}
                placeholder="Provide full details so batchmates can step in quickly..."
                className="h-20 text-xs"
              />
              <Button
                type="button"
                disabled={postingSupport}
                onClick={handlePostSupport}
                className="gold-gradient text-gold-foreground font-semibold gap-1.5"
              >
                <Plus className="h-3.5 w-3.5" />
                {postingSupport ? 'Posting...' : 'Post Support Request'}
              </Button>
            </div>

            {requests.length === 0 ? (
              <p className="py-6 text-center text-muted-foreground">No support requests posted.</p>
            ) : (
              <div className="space-y-2.5">
                {requests.map(r => (
                  <div
                    key={r.id}
                    className="rounded-xl border border-border/40 bg-muted/15 p-3.5 space-y-2"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-foreground">{r.title}</span>
                          <Badge
                            variant={r.status === 'achieved' ? 'default' : 'destructive'}
                            className={
                              r.status === 'achieved'
                                ? 'bg-emerald-600 text-white text-[10px]'
                                : 'text-[10px]'
                            }
                          >
                            {r.status === 'achieved' ? 'Achieved' : 'Open'}
                          </Badge>
                        </div>
                        <p className="text-[11px] text-muted-foreground">
                          Posted by <strong className="text-primary">{r.member_name}</strong> •{' '}
                          {formatFullDate(r.created_at)}
                        </p>
                      </div>

                      {r.status !== 'achieved' && (r.member_id === user.id || userIsAdmin) && (
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => handleMarkAchieved(r.id)}
                          className="h-7 bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] gap-1"
                        >
                          <CheckCircle2 className="h-3 w-3" />
                          Mark Achieved
                        </Button>
                      )}
                    </div>
                    <p className="text-foreground/90 whitespace-pre-line">{r.description}</p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card className="border-border/40 bg-card/75 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-primary">
              <Briefcase className="h-5 w-5" />
              Batch Job, Internship &amp; Referral Board
            </CardTitle>
            <CardDescription className="text-xs">
              Share career openings, freelance consulting projects, internships, or company referrals for classmates and student mentees.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4 text-xs">
            <div className="rounded-xl border border-primary/30 bg-primary/5 p-3.5 space-y-2.5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <select
                  value={oppType}
                  onChange={e => setOppType(e.target.value)}
                  className="h-9 rounded-md border border-border/50 bg-background px-3 text-xs font-semibold"
                >
                  <option value="Job">Full-Time Job</option>
                  <option value="Internship">Student Internship</option>
                  <option value="Freelance / Project">Freelance / Consulting Project</option>
                  <option value="Referral">Employee Referral</option>
                </select>
                <Input
                  value={oppTitle}
                  onChange={e => setOppTitle(e.target.value)}
                  placeholder="Role / Opportunity Title *"
                  className="text-xs"
                />
                <Input
                  value={oppCompany}
                  onChange={e => setOppCompany(e.target.value)}
                  placeholder="Company / Organization Name"
                  className="text-xs"
                />
                <Input
                  value={oppLocation}
                  onChange={e => setOppLocation(e.target.value)}
                  placeholder="City / Remote / Hybrid"
                  className="text-xs"
                />
              </div>

              <Textarea
                value={oppDesc}
                onChange={e => setOppDesc(e.target.value)}
                placeholder="Skills required, experience level, and how to apply..."
                className="h-20 text-xs"
              />

              <div className="flex flex-wrap gap-2">
                <Input
                  value={oppLink}
                  onChange={e => setOppLink(e.target.value)}
                  placeholder="Application Link or HR Email / Phone"
                  className="flex-1 min-w-[200px] text-xs"
                />
                <Button
                  type="button"
                  disabled={postingOpp}
                  onClick={handlePostOpportunity}
                  className="gold-gradient text-gold-foreground font-semibold gap-1.5"
                >
                  <Send className="h-3.5 w-3.5" />
                  {postingOpp ? 'Posting...' : 'Post Opportunity'}
                </Button>
              </div>
            </div>

            {opportunities.length === 0 ? (
              <p className="py-6 text-center text-muted-foreground">
                No opportunities listed yet. Share an opening or internship above!
              </p>
            ) : (
              <div className="space-y-2.5">
                {opportunities.map(op => {
                  const isUrl =
                    op.contact_or_link &&
                    (op.contact_or_link.startsWith('http://') ||
                      op.contact_or_link.startsWith('https://'))
                  return (
                    <div
                      key={op.id}
                      className="rounded-xl border border-border/40 bg-muted/15 p-3.5 space-y-2"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="space-y-0.5">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge variant="outline" className="border-primary/40 text-primary text-[10px]">
                              {op.opp_type}
                            </Badge>
                            <span className="text-sm font-bold text-foreground">{op.title}</span>
                          </div>
                          <p className="text-[11px] text-muted-foreground">
                            {op.company_or_org ? `${op.company_or_org} • ` : ''}
                            {op.location && (
                              <span className="inline-flex items-center gap-1">
                                <MapPin className="h-3 w-3 text-primary" />
                                {op.location} •{' '}
                              </span>
                            )}
                            Posted by <strong className="text-primary">{op.posted_by_name}</strong> (
                            {formatFullDate(op.created_at)})
                          </p>
                        </div>

                        {(op.posted_by_id === user.id || userIsAdmin) && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDeleteOpportunity(op.id)}
                            className="h-7 w-7 text-destructive"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>

                      <p className="text-foreground/90 whitespace-pre-line">{op.description}</p>

                      {op.contact_or_link && (
                        <div className="pt-1">
                          {isUrl ? (
                            <a
                              href={op.contact_or_link}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 text-primary font-semibold hover:underline"
                            >
                              Apply / Open Link
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          ) : (
                            <p className="text-emerald-400 font-semibold">
                              Contact / Apply: {op.contact_or_link}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
