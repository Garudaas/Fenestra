import { useState, useEffect } from 'react'
import { useAuth } from '@/context/AuthContext'
import { supabase } from '@/lib/supabase'
import { formatFamilyBirthdayLabel, getDefaultSpouseGender } from '@/lib/fenestriansCore'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { MONTH_NAMES } from '@/lib/constants'
import { getOrdinalSuffix } from '@/lib/helpers'
import { CalendarDays, Video, CheckCircle2 } from 'lucide-react'

interface CalendarTabProps {
  onJoinCall: (roomName: string) => void
}

export default function CalendarTab({ onJoinCall }: CalendarTabProps) {
  const { user } = useAuth()
  const [year, setYear] = useState(2026)
  const [grouped, setGrouped] = useState<any[][]>(Array.from({ length: 12 }, () => []))

  useEffect(() => {
    loadCalendar()
  }, [year])

  const loadCalendar = async () => {
    if (!user) return
    const [usersRes, eventsRes, tasksRes, familyRes] = await Promise.all([
      supabase.from('alumni').select('*').eq('is_placeholder', false),
      supabase.from('calendar_events').select('*'),
      supabase.from('tasks').select('*'),
      supabase.from('family_members').select('*'),
    ])
    const users = usersRes.data || []
    const events = eventsRes.data || []
    const tasks = tasksRes.data || []
    const family = familyRes.data || []
    const structure: any[][] = Array.from({ length: 12 }, () => [])

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

    events.forEach(ev => {
      if (ev.start_date) {
        const ed = new Date(ev.start_date)
        const m = ed.getMonth()
        let txt = `[${ev.classification}] ${ev.title}`
        if (ev.classification === 'Anniversary') {
          const count = year - ed.getFullYear()
          txt = `${getOrdinalSuffix(count)} Anniversary: ${ev.title}`
        }
        txt += ev.description ? ` - ${ev.description}` : ''
        if (m >= 0 && m <= 11) {
          structure[m].push({ date: ed, text: txt, type: ev.classification, room: ev.room_tag })
        }
      }
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
          <CardTitle className="flex items-center gap-2 text-primary">
            <CalendarDays className="h-5 w-5" />
            Class Calendar — {year}
          </CardTitle>
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
                        className="flex items-center gap-2 rounded-lg border border-border/30 bg-muted/20 px-3 py-2 hover:bg-muted/40 transition-colors"
                      >
                        <span className="text-primary font-bold text-sm min-w-[2rem]">
                          {ev.date.getDate()}
                        </span>
                        <span className="flex-1 text-xs">{ev.text}</span>
                        <Badge variant="outline" className="text-[10px]">
                          {ev.type}
                        </Badge>
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
