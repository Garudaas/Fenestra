import { useState, useEffect } from 'react'
import { useAuth } from '@/context/AuthContext'
import { supabase } from '@/lib/supabase'
import { publishArchivedAlert } from '@/lib/notificationService'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { HandHeart, PlusCircle, CheckCircle2, Clock } from 'lucide-react'

interface SupportRequestItem {
  id: number
  member_id: number
  member_name: string
  title: string
  description: string
  status: 'open' | 'achieved'
  created_at: string
  resolved_at: string | null
}

export default function SupportTab() {
  const { user, isAdmin } = useAuth()
  const [requests, setRequests] = useState<SupportRequestItem[]>([])
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [loading, setLoading] = useState(true)

  const userIsAdmin = Boolean(isAdmin || user?.is_admin)

  useEffect(() => {
    loadRequests()
  }, [])

  const loadRequests = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('family_support_requests')
      .select('*')
      .order('created_at', { ascending: false })

    if (data) setRequests(data as SupportRequestItem[])
    setLoading(false)
  }

  const handleSubmitRequest = async () => {
    if (!user) return
    if (!title.trim() || !description.trim()) {
      alert('Please enter both a subject and details of the support needed.')
      return
    }

    setSubmitting(true)
    const { error } = await supabase.from('family_support_requests').insert([
      {
        member_id: user.id,
        member_name: user.full_name,
        title: title.trim(),
        description: description.trim(),
        status: 'open',
      },
    ])

    if (error) {
      setSubmitting(false)
      alert(`Could not post support request: ${error.message}`)
      return
    }

    // Automatically broadcast & archive as "Your friend Needs help"
    await publishArchivedAlert({
      category: 'help_needed',
      shortTitle: 'Your friend Needs help',
      fullMessage: `${user.full_name} needs family support: ${title.trim()} — ${description.trim()}`,
      needsHelpFlag: true,
    })

    setTitle('')
    setDescription('')
    setSubmitting(false)
    await loadRequests()
  }

  const handleMarkAchieved = async (reqItem: SupportRequestItem) => {
    await supabase
      .from('family_support_requests')
      .update({
        status: 'achieved',
        resolved_at: new Date().toISOString(),
      })
      .eq('id', reqItem.id)

    await loadRequests()
  }

  if (!user) return null

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <Card className="border-border/40 bg-card/70 backdrop-blur-sm">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-primary">
            <HandHeart className="h-5 w-5" />
            Family Support Requests
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Request medical, educational, career, or emergency assistance for your family. Posting here immediately alerts all Fenestrians members under <span className="font-semibold text-primary">“Your friend Needs help”</span>.
          </p>

          <Input
            placeholder="Support Title (e.g., Blood donors needed, Career guidance for son) *"
            value={title}
            onChange={e => setTitle(e.target.value)}
            className="bg-input/50 border-border/50"
          />

          <textarea
            rows={3}
            placeholder="Describe how fellow members can help your family *"
            value={description}
            onChange={e => setDescription(e.target.value)}
            className="w-full rounded-md border border-border/50 bg-input/50 px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring/50"
          />

          <Button
            type="button"
            title="Post Family Support Request"
            disabled={submitting}
            onClick={handleSubmitRequest}
            className="gold-gradient text-gold-foreground font-semibold gap-2"
          >
            <PlusCircle className="h-4 w-4" />
            {submitting ? 'Sending Help Alert...' : 'Request Family Support'}
          </Button>
        </CardContent>
      </Card>

      <Card className="border-border/40 bg-card/70">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-primary">Active &amp; Fulfilled Support List</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {loading ? (
            <p className="py-6 text-center text-xs text-muted-foreground">Loading support requests...</p>
          ) : requests.length === 0 ? (
            <p className="py-6 text-center text-xs text-muted-foreground">
              No family support requests listed right now.
            </p>
          ) : (
            requests.map(item => (
              <div
                key={item.id}
                className={`rounded-xl border p-4 space-y-2 ${
                  item.status === 'achieved'
                    ? 'border-emerald-500/30 bg-emerald-500/5'
                    : 'border-amber-500/40 bg-amber-500/5'
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-bold text-foreground">{item.title}</p>
                    <p className="text-[11px] text-muted-foreground">
                      Requested by <span className="font-semibold text-primary">{item.member_name}</span> •{' '}
                      {new Date(item.created_at).toLocaleDateString('en-IN')}
                    </p>
                  </div>

                  {item.status === 'achieved' ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/20 px-2.5 py-1 text-[11px] font-semibold text-emerald-300">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Support Achieved
                    </span>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/20 px-2.5 py-1 text-[11px] font-semibold text-amber-300">
                        <Clock className="h-3.5 w-3.5" />
                        Needs Support
                      </span>
                      {(item.member_id === user.id || userIsAdmin) && (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          title="Mark Support Achieved"
                          onClick={() => handleMarkAchieved(item)}
                          className="h-7 text-xs border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/10"
                        >
                          Mark Achieved
                        </Button>
                      )}
                    </div>
                  )}
                </div>

                <p className="text-xs text-foreground/90 leading-relaxed">{item.description}</p>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  )
}
