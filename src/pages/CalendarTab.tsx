import { useState, useEffect } from 'react'
import { useAuth } from '@/context/AuthContext'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { MONTH_NAMES } from '@/lib/constants'
import { getOrdinalSuffix } from '@/lib/helpers'
import { CalendarDays, Plus, Video, CheckCircle2, ClipboardList, Lock } from 'lucide-react'

interface CalendarTabProps {
  onJoinCall: (roomName: string) => void
}

export default function CalendarTab({ onJoinCall }: CalendarTabProps) {
  const { user } = useAuth()
  const [year, setYear] = useState(2026)
  const [grouped, setGrouped] = useState<any[][]>(Array.from({ length: 12 }, () => []))
  const [assignees, setAssignees] = useState<any[]>([])
  const [eventTitle, setEventTitle] = useState('')
  const [eventType, setEventType] = useState('Anniversary')
  const [eventDate, setEventDate] = useState('')
  const [eventDesc, setEventDesc] = useState('')
  const [taskTitle, setTaskTitle] = useState('')
  const [taskAssignee, setTaskAssignee] = useState('')
  const [taskDeadline, setTaskDeadline] = useState('')
  const [taskPrivate, setTaskPrivate] = useState(false)

  useEffect(() => { loadCalendar() }, [year])

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
    setAssignees(users.filter(u => u.full_name !== 'System Administrator'))
    const structure: any[][] = Array.from({ length: 12 }, () => [])
    users.forEach(u => {
      if (u.dob) { const bd = new Date(u.dob); const m = bd.getMonth(); const count = year - bd.getFullYear(); if (m >= 0 && m <= 11) structure[m].push({ date: bd, text: `${getOrdinalSuffix(count)} Birthday: ${u.full_name}`, type: 'Birthday' }) }
      if (u.wedding_date) { const wd = new Date(u.wedding_date); const m = wd.getMonth(); const count = year - wd.getFullYear(); if (m >= 0 && m <= 11) structure[m].push({ date: wd, text: `${getOrdinalSuffix(count)} Anniversary: ${u.full_name}`, type: 'Anniversary' }) }
    })
    family.forEach(f => {
      if (f.dob) { const fd = new Date(f.dob); const m = fd.getMonth(); const count = year - fd.getFullYear(); const alumni = users.find(u => u.id === f.alumni_id); const alumniName = alumni ? alumni.full_name : 'Unknown'; if (m >= 0 && m <= 11) { if (f.is_private && f.alumni_id !== user.id) { structure[m].push({ date: fd, text: `${getOrdinalSuffix(count)} Birthday: Private ${f.relationship} of ${alumniName}`, type: 'Family' }) } else { structure[m].push({ date: fd, text: `${getOrdinalSuffix(count)} Birthday: ${f.name} (${f.relationship} of ${alumniName})`, type: 'Family' }) } } }
    })
    events.forEach(ev => {
      if (ev.start_date) { const ed = new Date(ev.start_date); const m = ed.getMonth(); let txt = `[${ev.classification}] ${ev.title}`; if (ev.classification === 'Anniversary') { const count = year - ed.getFullYear(); txt = `${getOrdinalSuffix(count)} Anniversary: ${ev.title}` } txt += ev.description ? ` - ${ev.description}` : ''; if (m >= 0 && m <= 11) structure[m].push({ date: ed, text: txt, type: ev.classification, room: ev.room_tag }) }
    })
    tasks.forEach(t => {
      if (t.deadline) { if (t.is_private && t.assignee_id != user.id && t.created_by != user.id) return; const td = new Date(t.deadline); const m = td.getMonth(); if (m >= 0 && m <= 11) { structure[m].push({ date: td, text: `Task: ${t.title} [For: ${t.assignee_name}] ${t.is_completed ? '(Completed)' : '(Pending)'}`, type: t.is_private ? 'Private' : 'Public', taskId: t.id, isTask: true, isCompleted: t.is_completed, assigneeId: t.assignee_id }) } }
    })
    structure.forEach(month => month.sort((a, b) => a.date.getDate() - b.date.getDate()))
    setGrouped(structure)
  }

  const handleCreateEvent = async () => {
    if (!user || !eventTitle || !eventDate) { alert('Please enter Title and Date.'); return }
    const roomTag = eventType === 'Online Meeting' ? 'Meeting-' + eventTitle.replace(/[^a-zA-Z0-9]/g, '-') : null
    await supabase.from('calendar_events').insert([{ title: eventTitle, classification: eventType, start_date: eventDate, description: eventDesc, room_tag: roomTag, created_by: user.id }])
    await supabase.from('chat_messages').insert([{ room_id: 'global', sender_id: 0, sender_name: '🛡️ System Bot', message_text: `🎟️ INVITATION: New Class ${eventType} Scheduled!\n📍 Event: ${eventTitle}\n📅 Date: ${eventDate}\n📝 Description: ${eventDesc}` }])
    setEventTitle(''); setEventDesc(''); alert('Event successfully posted!'); loadCalendar()
  }

  const handleCreateTask = async () => {
    if (!user || !taskTitle || !taskAssignee || !taskDeadline) { alert('Please fill out all task fields.'); return }
    const assignee = assignees.find(a => String(a.id) === taskAssignee)
    const assigneeName = assignee?.full_name || ''
    await supabase.from('tasks').insert([{ title: taskTitle, assignee_id: taskAssignee, assignee_name: assigneeName, deadline: taskDeadline, is_private: taskPrivate, created_by: user.id }])
    alert('Task assigned successfully.'); setTaskTitle(''); loadCalendar()
  }

  const handleCompleteTask = async (taskId: string) => {
    await supabase.from('tasks').update({ is_completed: true }).eq('id', taskId)
    alert('Task marked as done!'); loadCalendar()
  }

  if (!user) return null

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* Main Calendar Card */}
      <Card className="border-border/40 bg-card/60 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-primary">
            <CalendarDays className="h-5 w-5" />
            Class Calendar — {year}
          </CardTitle>
          <div className="flex items-center gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={() => setYear(y => y - 1)}>← Prev</Button>
            <Button variant="outline" size="sm" onClick={() => setYear(y => y + 1)}>Next →</Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {grouped.map((events, monthIndex) => (
            events.length > 0 && (
              <div key={monthIndex}>
                <h3 className="text-[11px] font-bold uppercase tracking-wider text-primary/60 mb-2">
                  {MONTH_NAMES[monthIndex]}
                </h3>
                <div className="space-y-1">
                  {events.map((ev: any, i: number) => (
                    <div key={i} className="flex items-center gap-2 rounded-lg border border-border/30 bg-muted/20 px-3 py-2 hover:bg-muted/40 transition-colors">
                      <span className="text-primary font-bold text-sm min-w-[2rem]">
                        {ev.date.getDate()}
                      </span>
                      <span className="flex-1 text-xs">{ev.text}</span>
                      <Badge variant="outline" className="text-[10px]">{ev.type}</Badge>
                      {ev.room && (
                        <Button
                          size="sm"
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
          ))}
        </CardContent>
      </Card>

      {/* Post Event Card */}
      <Card className="border-border/40 bg-card/60 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-primary">
            <Plus className="h-5 w-5" />
            Post Class Event
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <Label>Title</Label>
              <Input value={eventTitle} onChange={e => setEventTitle(e.target.value)} placeholder="Event title" />
            </div>
            <div>
              <Label>Type</Label>
              <select className="w-full rounded-md border bg-background px-3 py-2 text-sm" value={eventType} onChange={e => setEventType(e.target.value)}>
                <option>Anniversary</option>
                <option>Online Meeting</option>
                <option>Reunion</option>
                <option>Memorial</option>
                <option>Other</option>
              </select>
            </div>
            <div>
              <Label>Date</Label>
              <Input type="date" value={eventDate} onChange={e => setEventDate(e.target.value)} />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea value={eventDesc} onChange={e => setEventDesc(e.target.value)} placeholder="Optional description" />
            </div>
          </div>
          <Button onClick={handleCreateEvent} className="gold-gradient text-gold-foreground w-full">
            <Plus className="h-4 w-4 mr-2" />
            Post Event
          </Button>
        </CardContent>
      </Card>

      {/* Assign Task Card */}
      <Card className="border-border/40 bg-card/60 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-primary">
            <ClipboardList className="h-5 w-5" />
            Assign Task
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <Label>Task Title</Label>
              <Input value={taskTitle} onChange={e => setTaskTitle(e.target.value)} placeholder="Task name" />
            </div>
            <div>
              <Label>Assign To</Label>
              <select className="w-full rounded-md border bg-background px-3 py-2 text-sm" value={taskAssignee} onChange={e => setTaskAssignee(e.target.value)}>
                <option value="">Select member...</option>
                {assignees.map(a => <option key={a.id} value={a.id}>{a.full_name}</option>)}
              </select>
            </div>
            <div>
              <Label>Deadline</Label>
              <Input type="date" value={taskDeadline} onChange={e => setTaskDeadline(e.target.value)} />
            </div>
            <div className="flex items-center gap-2 pt-5">
              <Checkbox id="task-private" checked={taskPrivate} onCheckedChange={(v) => setTaskPrivate(!!v)} />
              <Label htmlFor="task-private" className="flex items-center gap-1 text-primary cursor-pointer">
                <Lock className="h-3 w-3" />
                Private Task
              </Label>
            </div>
          </div>
          <Button onClick={handleCreateTask} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white">
            <ClipboardList className="h-4 w-4 mr-2" />
            Assign Task
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
