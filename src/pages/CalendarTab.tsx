import { useState, useEffect } from 'react'
import { useAuth } from '@/context/AuthContext'
import { supabase } from '@/lib/supabase'
import { formatFamilyBirthdayLabel, getDefaultSpouseGender } from '@/lib/fenestriansCore'
import { fetchCommitteeRolesMap, resolveMemberAssociationRole } from '@/lib/taskAuditService'
import { publishArchivedAlert, sendDevicePushNotification } from '@/lib/notificationService'
import { formatFullDate } from '@/lib/formatters'
import SmartDateInput from '@/components/shared/SmartDateInput'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { MONTH_NAMES } from '@/lib/constants'
import { getOrdinalSuffix } from '@/lib/helpers'
import { CalendarDays, Video, CheckCircle2, Plus, Sparkles, Trash2 } from 'lucide-react'

interface CalendarTabProps {
  onJoinCall: (roomName: string) => void
}

const BATCH_DAY_ORIGIN_DATE = '1997-09-22'
const BATCH_DAY_ORIGIN_YEAR = 1997

function parseCommonEventOriginYear(description?: string | null, startDate?: string | null): number {
  const match = /\[COMMON_EVENT_ORIGIN_YEAR:(\d{4})\]/.exec(String(description || ''))
  if (match?.[1]) return Number(match[1])
  if (startDate && /^\d{4}-\d{2}-\d{2}/.test(startDate)) {
    return Number(startDate.slice(0, 4))
  }
  return BATCH_DAY_ORIGIN_YEAR
}

function stripMetadataTags(description?: string | null): string {
  return String(description || '')
    .replace(/\[COMMON_EVENT_ORIGIN_YEAR:\d{4}\]/g, '')
    .replace(/\n{2,}/g, '\n')
    .trim()
}

export default function CalendarTab({ onJoinCall }: CalendarTabProps) {
  const { user, isAdmin } = useAuth()
  const [year, setYear] = useState(2026)
  const [grouped, setGrouped] = useState<any[][]>(Array.from({ length: 12 }, () => []))
  const [isOfficerRole, setIsOfficerRole] = useState(false)

  const [showCommonForm, setShowCommonForm] = useState(false)
  const [commonTitle, setCommonTitle] = useState('')
  const [commonDate, setCommonDate] = useState('')
  const [commonOriginYear, setCommonOriginYear] = useState('')
  const [commonDesc, setCommonDesc] = useState('')
  const [broadcastNow, setBroadcastNow] = useState(true)
  const [savingCommon, setSavingCommon] = useState(false)

  const userIsAdmin = Boolean(isAdmin || user?.is_admin)
  const canManageCommonEvents = userIsAdmin || isOfficerRole

  useEffect(() => {
    if (!user) return
    fetchCommitteeRolesMap()
      .then(rolesMap => {
        const badge = resolveMemberAssociationRole({
          userId: user.id,
          isAdmin: user.is_admin,
          committeeRolesMap: rolesMap,
        })
        setIsOfficerRole(badge.kind === 'office' || badge.kind === 'admin')
      })
      .catch(() => {})
  }, [user])

  useEffect(() => {
    loadCalendar()
  }, [year, user])

  const loadCalendar = async () => {
    if (!user) return
    const [usersRes, eventsRes, tasksRes, familyRes] = await Promise.all([
      supabase.from('alumni').select('*').eq('is_placeholder', false),
      supabase.from('calendar_events').select('*'),
      supabase.from('tasks').select('*'),
      supabase.from('family_members').select('*'),
    ])
    const users = usersRes.data || []
    let events = eventsRes.data || []
    const tasks = tasksRes.data || []
    const family = familyRes.data || []
    const structure: any[][] = Array.from({ length: 12 }, () => [])

    const hasBatchDay = events.some(
      (ev: any) =>
        String(ev.title || '').trim().toLowerCase() === 'batch day' &&
        String(ev.classification || '').trim() === 'Common Batch Event'
    )

    if (!hasBatchDay) {
      const batchDayRow = {
        title: 'Batch Day',
        classification: 'Common Batch Event',
        start_date: BATCH_DAY_ORIGIN_DATE,
        description:
          'First day in class (22nd September 1997). Counted inclusively each year (1998 = 2nd Batch Day, 2026 = 30th Batch Day).\n[COMMON_EVENT_ORIGIN_YEAR:1997]',
        room_tag: null,
        created_by: user.id,
      }
      const { data: inserted } = await supabase
        .from('calendar_events')
        .insert([batchDayRow])
        .select('*')
      if (inserted && inserted.length > 0) {
        events = [...events, ...inserted]
      } else {
        events = [...events, { id: 'batch-day-default', ...batchDayRow }]
      }
    }

    users.forEach(u => {
      if (u.dob) {
        const bd = new Date(u.dob)
        const m = bd.getMonth()
        const count = year - bd.getFullYear()
        if (m >= 0 && m <= 11) {
          structure[m].push({
            date: bd,
            text: `${getOrdinalSuffix(count)} Birthday: ${u.full_name}`,
            type: 'Birthday',
          })
        }
      }

      const isDivorced =
        u.marital_status?.toLowerCase() === 'divorced' || Boolean(u.divorce_date)

      if (!isDivorced && u.wedding_date) {
        const wd = new Date(u.wedding_date)
        const m = wd.getMonth()
        const count = year - wd.getFullYear()
        if (m >= 0 && m <= 11) {
          structure[m].push({
            date: wd,
            text: `${getOrdinalSuffix(count)} Anniversary: ${u.full_name}`,
            type: 'Anniversary',
          })
        }
      }

      if (!isDivorced && u.spouse_name && u.spouse_dob) {
        const hasSpouseInFamilyTable = family.some(
          f =>
            f.alumni_id === u.id &&
            (f.relationship || '').trim().toLowerCase() === 'spouse'
        )
        if (!hasSpouseInFamilyTable) {
          const sd = new Date(u.spouse_dob)
          const m = sd.getMonth()
          if (m >= 0 && m <= 11) {
            const label = formatFamilyBirthdayLabel({
              personName: u.spouse_name,
              dob: u.spouse_dob,
              relationship: 'Spouse',
              personGender: getDefaultSpouseGender(u.gender),
              memberName: u.full_name,
              referenceYear: year,
            })
            structure[m].push({ date: sd, text: label, type: 'Family' })
          }
        }
      }
    })

    family.forEach(f => {
      if (f.dob) {
        const fd = new Date(f.dob)
        const m = fd.getMonth()
        const count = year - fd.getFullYear()
        const alumni = users.find(u => u.id === f.alumni_id)
        const alumniName = alumni ? alumni.full_name : 'Unknown'

        if (m >= 0 && m <= 11) {
          if (f.is_private && f.alumni_id !== user.id) {
            structure[m].push({
              date: fd,
              text: `${getOrdinalSuffix(count)} Birthday: Private ${f.relationship || 'Family Member'} of ${alumniName}`,
              type: 'Family',
            })
          } else {
            const genderLabel = formatFamilyBirthdayLabel({
              personName: f.name,
              dob: f.dob,
              relationship: f.relationship || 'Child',
              personGender: f.gender,
              memberName: alumniName,
              referenceYear: year,
            })
            structure[m].push({
              date: fd,
              text: genderLabel,
              type: 'Family',
            })
          }
        }
      }
    })

    const seenCommonKeys = new Set<string>()
    events.forEach(ev => {
      if (!ev.start_date) return
      const ed = new Date(ev.start_date)
      const m = ed.getMonth()
      if (m < 0 || m > 11) return

      if (ev.classification === 'Common Batch Event') {
        const dedupeKey = `${String(ev.title || '').trim().toLowerCase()}_${m}_${ed.getDate()}`
        if (seenCommonKeys.has(dedupeKey)) return
        seenCommonKeys.add(dedupeKey)

        const originYr = parseCommonEventOriginYear(ev.description, ev.start_date)
        const edition = Math.max(1, year - originYr + 1)
        const cleanDesc = stripMetadataTags(ev.description)
        const isBatchDay = String(ev.title || '').trim().toLowerCase() === 'batch day'

        const txt = isBatchDay
          ? `${getOrdinalSuffix(edition)} Batch Day — Celebrating our first day in class (22nd Sep 1997)`
          : `${getOrdinalSuffix(edition)} ${ev.title}${cleanDesc ? ` — ${cleanDesc}` : ''}`

        structure[m].push({
          date: ed,
          text: txt,
          type: 'Common Batch Event',
          isCommonEvent: true,
          isBuiltInBatchDay: isBatchDay,
          eventId: ev.id,
          createdBy: ev.created_by,
        })
        return
      }

      let txt = `[${ev.classification}] ${ev.title}`
      if (ev.classification === 'Anniversary') {
        const count = year - ed.getFullYear()
        txt = `${getOrdinalSuffix(count)} Anniversary: ${ev.title}`
      }
      const cleanDesc = stripMetadataTags(ev.description)
      txt += cleanDesc ? ` - ${cleanDesc}` : ''
      structure[m].push({ date: ed, text: txt, type: ev.classification, room: ev.room_tag })
    })

    tasks.forEach(t => {
      if (t.deadline) {
        if (t.is_private && t.assignee_id != user.id && t.created_by != user.id) return
        const td = new Date(t.deadline)
        const m = td.getMonth()
        if (m >= 0 && m <= 11) {
          structure[m].push({
            date: td,
            text: `Task: ${t.title} [For: ${t.assignee_name}] ${t.is_completed ? '(Completed)' : '(Pending)'}`,
            type: t.is_private ? 'Private' : 'Public',
            taskId: t.id,
            isTask: true,
            isCompleted: t.is_completed,
            assigneeId: t.assignee_id,
          })
        }
      }
    })

    structure.forEach(month => month.sort((a, b) => a.date.getDate() - b.date.getDate()))
    setGrouped(structure)
  }

  const handleAddCommonEvent = async () => {
    if (!user || !canManageCommonEvents) return
    if (!commonTitle.trim() || !commonDate) {
      alert('Please enter the Common Event Name and Date.')
      return
    }

    setSavingCommon(true)
    const originYr = /^\d{4}$/.test(commonOriginYear.trim())
      ? Number(commonOriginYear.trim())
      : Number(commonDate.slice(0, 4))

    const editionNow = Math.max(1, new Date().getFullYear() - originYr + 1)
    const cleanNote = commonDesc.trim()
    const storedDesc = [cleanNote, `[COMMON_EVENT_ORIGIN_YEAR:${originYr}]`]
      .filter(Boolean)
      .join('\n')

    const { error } = await supabase.from('calendar_events').insert([
      {
        title: commonTitle.trim(),
        classification: 'Common Batch Event',
        start_date: commonDate,
        description: storedDesc,
        room_tag: null,
        created_by: user.id,
      },
    ])

    if (error) {
      setSavingCommon(false)
      alert('Could not save common event: ' + error.message)
      return
    }

    if (broadcastNow) {
      const formattedDate = formatFullDate(commonDate)
      const msg = `Common Batch Event Added: ${getOrdinalSuffix(editionNow)} ${commonTitle.trim()} (${formattedDate})${
        cleanNote ? ` — ${cleanNote}` : ''
      }`

      await supabase.from('chat_messages').insert([
        {
          room_id: 'global',
          sender_id: 0,
          sender_name: '🛡️ System Bot',
          message_text: `🎉 ${msg}`,
        },
      ])

      await publishArchivedAlert({
        category: 'event',
        shortTitle: `Common Event: ${commonTitle.trim()}`,
        fullMessage: msg,
      })

      const { data: allUsers } = await supabase
        .from('alumni')
        .select('id')
        .eq('is_placeholder', false)
      const targetIds = (allUsers || [])
        .map((u: any) => u.id)
        .filter((id: any) => Number.isFinite(Number(id)))

      if (targetIds.length > 0) {
        sendDevicePushNotification({
          shortTitle: `Common Event: ${commonTitle.trim()}`,
          fullMessage: msg,
          targetUserIds: targetIds,
          launchUrl: 'https://fenestrians.salmaali.in/calendar',
        })
      }
    }

    setSavingCommon(false)
    setCommonTitle('')
    setCommonDate('')
    setCommonOriginYear('')
    setCommonDesc('')
    setShowCommonForm(false)
    await loadCalendar()
  }

  const handleDeleteCommonEvent = async (eventId: any) => {
    if (!eventId || typeof eventId === 'string') return
    if (!window.confirm('Remove this Common Batch Event from the calendar?')) return
    await supabase.from('calendar_events').delete().eq('id', eventId)
    await loadCalendar()
  }

  const handleCompleteTask = async (taskId: string) => {
    await supabase.from('tasks').update({ is_completed: true }).eq('id', taskId)
    alert('Task marked as done!')
    loadCalendar()
  }

  if (!user) return null

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <Card className="border-border/40 bg-card/60 backdrop-blur-sm">
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="flex items-center gap-2 text-primary">
              <CalendarDays className="h-5 w-5" />
              Class Calendar — {year}
            </CardTitle>

            {canManageCommonEvents && (
              <Button
                type="button"
                size="sm"
                onClick={() => setShowCommonForm(prev => !prev)}
                className="gold-gradient text-gold-foreground font-semibold gap-1.5 text-xs"
              >
                <Plus className="h-3.5 w-3.5" />
                {showCommonForm ? 'Close Form' : 'Add Common Event'}
              </Button>
            )}
          </div>

          <div className="flex items-center gap-2 pt-2">
            <Button variant="outline" size="sm" title="Previous Year" onClick={() => setYear(y => y - 1)}>
              ← Prev
            </Button>
            <Button variant="outline" size="sm" title="Next Year" onClick={() => setYear(y => y + 1)}>
              Next →
            </Button>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {canManageCommonEvents && showCommonForm && (
            <div className="rounded-xl border border-primary/40 bg-primary/5 p-3.5 space-y-3 text-xs">
              <p className="font-bold text-primary flex items-center gap-1.5">
                <Sparkles className="h-4 w-4" />
                Add Common Batch Event (Graduation Day, Foundation Day, etc.)
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <div>
                  <Label className="text-xs">Event Name *</Label>
                  <Input
                    value={commonTitle}
                    onChange={e => setCommonTitle(e.target.value)}
                    placeholder="e.g., Graduation Day"
                    className="mt-1 text-xs"
                  />
                </div>
                <div>
                  <Label className="text-xs">Event Date *</Label>
                  <SmartDateInput
                    value={commonDate}
                    onChange={setCommonDate}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label className="text-xs">First / Origin Year (Inclusive Count)</Label>
                  <Input
                    type="number"
                    value={commonOriginYear}
                    onChange={e => setCommonOriginYear(e.target.value)}
                    placeholder="e.g., 2001 (Optional)"
                    className="mt-1 text-xs"
                  />
                </div>
              </div>

              <div>
                <Label className="text-xs">Note / Description (Optional)</Label>
                <Textarea
                  value={commonDesc}
                  onChange={e => setCommonDesc(e.target.value)}
                  placeholder="Optional celebration details..."
                  className="mt-1 h-16 text-xs"
                />
              </div>

              <label className="flex items-center gap-2 cursor-pointer">
                <Checkbox
                  checked={broadcastNow}
                  onCheckedChange={v => setBroadcastNow(Boolean(v))}
                />
                <span>Send announcement alert to all members now (automated wishes also fire on the event date)</span>
              </label>

              <Button
                type="button"
                size="sm"
                disabled={savingCommon}
                onClick={handleAddCommonEvent}
                className="w-full gold-gradient text-gold-foreground font-bold text-xs"
              >
                {savingCommon ? 'Saving Common Event...' : 'Save Common Batch Event'}
              </Button>
            </div>
          )}

          {grouped.map(
            (events, monthIndex) =>
              events.length > 0 && (
                <div key={monthIndex}>
                  <h3 className="text-[11px] font-bold uppercase tracking-wider text-primary/60 mb-2">
                    {MONTH_NAMES[monthIndex]}
                  </h3>
                  <div className="space-y-1">
                    {events.map((ev: any, i: number) => (
                      <div
                        key={i}
                        className={`flex items-center gap-2 rounded-lg border px-3 py-2 transition-colors ${
                          ev.isCommonEvent
                            ? 'border-primary/45 bg-primary/10 hover:bg-primary/15'
                            : 'border-border/30 bg-muted/20 hover:bg-muted/40'
                        }`}
                      >
                        <span className="text-primary font-bold text-sm min-w-[2rem]">
                          {ev.date.getDate()}
                        </span>
                        <span className={`flex-1 text-xs ${ev.isCommonEvent ? 'font-semibold text-foreground' : ''}`}>
                          {ev.text}
                        </span>
                        <Badge
                          variant="outline"
                          className={`text-[10px] ${
                            ev.isCommonEvent ? 'border-primary/50 text-primary' : ''
                          }`}
                        >
                          {ev.type}
                        </Badge>
                        {ev.isCommonEvent &&
                          !ev.isBuiltInBatchDay &&
                          canManageCommonEvents &&
                          (userIsAdmin || ev.createdBy === user.id) && (
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              title="Delete Common Event"
                              onClick={() => handleDeleteCommonEvent(ev.eventId)}
                              className="h-6 w-6 text-destructive hover:bg-destructive/10"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        {ev.room && (
                          <Button
                            size="sm"
                            title="Join Online Meeting"
                            className="gold-gradient text-gold-foreground animate-pulse text-xs h-7"
                            onClick={() => onJoinCall(ev.room)}
                          >
                            <Video className="h-3 w-3 mr-1" />
                            Join Call
                          </Button>
                        )}
                        {ev.isTask && !ev.isCompleted && ev.assigneeId === user.id && (
                          <Button
                            size="sm"
                            variant="outline"
                            title="Mark Task Done"
                            className="text-xs h-7"
                            onClick={() => handleCompleteTask(ev.taskId)}
                          >
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            Done
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )
          )}
        </CardContent>
      </Card>
    </div>
  )
}
