import { useState, useEffect, useMemo } from 'react'
import { useAuth } from '@/context/AuthContext'
import { supabase } from '@/lib/supabase'
import { formatFullDate, formatISTDateTime } from '@/lib/formatters'
import {
  resolveOfficerDisplayName,
  fetchOfficerNamePrefixMap,
  buildSubItemsForTask,
  type TaskSubItem,
  type OfficerPrefixMap,
} from '@/lib/taskAuditService'
import { publishArchivedAlert } from '@/lib/notificationService'
import SmartDateInput from '@/components/shared/SmartDateInput'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import {
  ListTodo,
  Plus,
  Trash2,
  CheckCircle2,
  Clock,
  Lock,
  Globe,
  X,
  Send,
  UserCheck,
} from 'lucide-react'

interface TaskRow {
  id: number
  assigned_to_user_id: number
  assigned_by_user_id: number | null
  task_type: string
  field_key: string | null
  title: string
  description: string
  status: string
  due_date: string | null
  is_private: boolean
  batch_id: string | null
  sender_display_name: string | null
  task_items_json: TaskSubItem[] | null
  completion_summary: string | null
  deleted_by_assignee: boolean
  deleted_by_assigner: boolean
  created_at: string
  completed_at: string | null
}

interface CombinedPublicTask {
  groupKey: string
  title: string
  description: string
  senderName: string
  dueDate: string | null
  createdAt: string
  assignees: Array<{
    userId: number
    name: string
    status: string
    completedAt: string | null
    completionSummary: string | null
  }>
}

export default function TasksTab() {
  const { user } = useAuth()

  const [mainSection, setMainSection] = useState<'active' | 'completed' | 'public'>('active')
  const [subScope, setSubScope] = useState<'assigned_to_me' | 'assigned_by_me'>('assigned_to_me')
  const [showAssignForm, setShowAssignForm] = useState(false)

  const [tasks, setTasks] = useState<TaskRow[]>([])
  const [members, setMembers] = useState<Array<{ id: number; full_name: string }>>([])
  const [officerPrefixMap, setOfficerPrefixMap] = useState<OfficerPrefixMap>(() => new Map())
  const [loading, setLoading] = useState(true)

  const [inspectedTask, setInspectedTask] = useState<TaskRow | null>(null)
  const [inspectedPublicGroup, setInspectedPublicGroup] = useState<CombinedPublicTask | null>(null)

  const [taskTitle, setTaskTitle] = useState('')
  const [taskBulletsText, setTaskBulletsText] = useState('')
  const [taskDueDate, setTaskDueDate] = useState('')
  const [taskIsPrivate, setTaskIsPrivate] = useState(false)
  const [selectedAssigneeIds, setSelectedAssigneeIds] = useState<Record<number, boolean>>({})
  const [assigning, setAssigning] = useState(false)

  useEffect(() => {
    if (!user) return
    loadTasksAndMembers()

    const channel = supabase
      .channel(`tasks-live-${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'member_tasks' }, () => {
        loadTasksAndMembers()
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [user])

  const loadTasksAndMembers = async () => {
    setLoading(true)
    const [tasksRes, membersRes, prefixMap] = await Promise.all([
      supabase
        .from('member_tasks')
        .select('*')
        .neq('task_type', 'audit_staging')
        .neq('status', 'unsent')
        .order('created_at', { ascending: false }),
      supabase
        .from('alumni')
        .select('id, full_name')
        .eq('is_placeholder', false)
        .neq('full_name', 'System Administrator')
        .order('full_name', { ascending: true }),
      fetchOfficerNamePrefixMap(),
    ])

    setTasks((tasksRes.data ?? []) as TaskRow[])
    setMembers((membersRes.data ?? []) as Array<{ id: number; full_name: string }>)
    setOfficerPrefixMap(prefixMap)
    setLoading(false)
  }

  const getMemberName = (id: number | null | undefined, fallback = 'Member'): string => {
    if (!id) return fallback
    const found = members.find(m => m.id === Number(id))
    return found ? found.full_name : fallback
  }

  const getSenderLabel = (t: TaskRow): string => {
    if (t.assigned_by_user_id && officerPrefixMap.has(Number(t.assigned_by_user_id))) {
      return officerPrefixMap.get(Number(t.assigned_by_user_id))!
    }
    if (t.sender_display_name && t.sender_display_name.trim()) {
      return t.sender_display_name.trim()
    }
    return getMemberName(t.assigned_by_user_id, 'System / Admin')
  }

  const activeAssignedToMe = useMemo(
    () =>
      tasks.filter(
        t =>
          t.assigned_to_user_id === user?.id &&
          t.status !== 'completed' &&
          !t.deleted_by_assignee
      ),
    [tasks, user?.id]
  )

  const activeAssignedByMe = useMemo(
    () =>
      tasks.filter(
        t =>
          t.assigned_by_user_id === user?.id &&
          t.status !== 'completed' &&
          !t.deleted_by_assigner
      ),
    [tasks, user?.id]
  )

  const completedAssignedToMe = useMemo(
    () =>
      tasks.filter(
        t =>
          t.assigned_to_user_id === user?.id &&
          t.status === 'completed' &&
          !t.deleted_by_assignee
      ),
    [tasks, user?.id]
  )

  const completedAssignedByMe = useMemo(
    () =>
      tasks.filter(
        t =>
          t.assigned_by_user_id === user?.id &&
          t.status === 'completed' &&
          !t.deleted_by_assigner
      ),
    [tasks, user?.id]
  )

  const publicCombinedTasks = useMemo<CombinedPublicTask[]>(() => {
    const publicRows = tasks.filter(t => !t.is_private)
    const groups = new Map<string, CombinedPublicTask>()

    for (const row of publicRows) {
      const key = row.batch_id ? `batch_${row.batch_id}` : `single_${row.id}`
      const assigneeName = getMemberName(row.assigned_to_user_id)
      const senderLabel = getSenderLabel(row)

      if (!groups.has(key)) {
        groups.set(key, {
          groupKey: key,
          title: row.title,
          description: row.description,
          senderName: senderLabel,
          dueDate: row.due_date,
          createdAt: row.created_at,
          assignees: [],
        })
      }

      groups.get(key)!.assignees.push({
        userId: row.assigned_to_user_id,
        name: assigneeName,
        status: row.status,
        completedAt: row.completed_at,
        completionSummary: row.completion_summary,
      })
    }

    return Array.from(groups.values())
  }, [tasks, members, officerPrefixMap])

  const handleDeleteCompletedTask = async (task: TaskRow, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!user || !window.confirm('Delete this completed task from your list?')) return

    const updates: Record<string, boolean> = {}
    if (task.assigned_to_user_id === user.id) updates.deleted_by_assignee = true
    if (task.assigned_by_user_id === user.id) updates.deleted_by_assigner = true

    await supabase.from('member_tasks').update(updates).eq('id', task.id)
    await loadTasksAndMembers()
  }

  const handleCreateAndAssignTask = async () => {
    if (!user) return
    const chosenIds = members.filter(m => selectedAssigneeIds[m.id]).map(m => m.id)

    if (!taskTitle.trim()) {
      alert('Please enter a Task Title.')
      return
    }
    if (chosenIds.length === 0) {
      alert('Please select at least one member to assign this task to.')
      return
    }

    const rawLines = taskBulletsText
      .split('\n')
      .map(l => l.trim())
      .filter(Boolean)

    const checklistLines = rawLines.length > 0 ? rawLines : [taskTitle.trim()]
    const subItems: TaskSubItem[] = checklistLines.map((line, idx) => ({
      id: `custom_${Date.now()}_${idx}`,
      label: line,
      fieldKey: 'general',
      preferenceType: 'skip_missing_field',
      completed: false,
      optedOut: false,
    }))

    setAssigning(true)
    try {
      const senderTitledName = await resolveOfficerDisplayName(user.id, user.full_name)
      const batchId = chosenIds.length > 1 ? `COMMON-${Date.now()}-${user.id}` : null
      const bulletFormatted = checklistLines.map(l => `• ${l}`).join('\n')
      const dueNote = taskDueDate ? `\nDue Date: ${formatFullDate(taskDueDate)}` : ''
      const fullMessage = `${senderTitledName} assigned you a task: "${taskTitle.trim()}"${dueNote}\n\n${bulletFormatted}`

      for (const targetUserId of chosenIds) {
        const { data: created } = await supabase
          .from('member_tasks')
          .insert([
            {
              assigned_to_user_id: targetUserId,
              assigned_by_user_id: user.id,
              task_type: chosenIds.length > 1 ? 'common_assigned_task' : 'member_assigned_task',
              field_key: 'general',
              title: `${senderTitledName}: ${taskTitle.trim()}`,
              description: fullMessage,
              is_micromanaged: false,
              status: 'pending',
              due_date: taskDueDate || null,
              is_private: taskIsPrivate,
              batch_id: batchId,
              sender_display_name: senderTitledName,
              task_items_json: subItems,
            },
          ])
          .select('id')
          .single()

        await publishArchivedAlert({
          category: 'personal_task',
          shortTitle: `Task from ${senderTitledName}`,
          fullMessage,
          targetUserId,
          metadata: {
            task_id: created?.id,
            is_micromanaged: false,
            audit_items: [],
          },
        })
      }

      setTaskTitle('')
      setTaskBulletsText('')
      setTaskDueDate('')
      setTaskIsPrivate(false)
      setSelectedAssigneeIds({})
      setShowAssignForm(false)
      await loadTasksAndMembers()
    } finally {
      setAssigning(false)
    }
  }

  if (!user) return null

  const currentPersonalList =
    mainSection === 'active'
      ? subScope === 'assigned_to_me'
        ? activeAssignedToMe
        : activeAssignedByMe
      : subScope === 'assigned_to_me'
      ? completedAssignedToMe
      : completedAssignedByMe

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <Card className="border-border/40 bg-card/75 backdrop-blur-sm">
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle className="flex items-center gap-2 text-primary">
              <ListTodo className="h-5 w-5" />
              Tasks &amp; Action Items
            </CardTitle>

            <Button
              type="button"
              size="sm"
              onClick={() => setShowAssignForm(prev => !prev)}
              className="gold-gradient text-gold-foreground font-semibold gap-1.5 text-xs"
            >
              <Plus className="h-3.5 w-3.5" />
              {showAssignForm ? 'Close Assign Form' : 'Assign New Task'}
            </Button>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {showAssignForm && (
            <div className="rounded-xl border border-primary/35 bg-primary/5 p-4 space-y-3 text-xs">
              <p className="font-bold text-primary text-sm">Assign Task to Member(s)</p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-foreground">Task Title *</label>
                  <Input
                    value={taskTitle}
                    onChange={e => setTaskTitle(e.target.value)}
                    placeholder="e.g., Coordinate Alumni Reunion Venue"
                    className="mt-1 text-xs"
                  />
                </div>
                <div>
                  <label className="font-semibold text-foreground">Due Date (Optional)</label>
                  <SmartDateInput
                    value={taskDueDate}
                    onChange={setTaskDueDate}
                    className="mt-1"
                  />
                </div>
              </div>

              <div>
                <label className="font-semibold text-foreground">
                  Checklist / Action Steps (One item per line)
                </label>
                <Textarea
                  value={taskBulletsText}
                  onChange={e => setTaskBulletsText(e.target.value)}
                  placeholder={'Confirm hall booking\nShare quotation with committee'}
                  className="mt-1 h-20 text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="font-semibold text-foreground">
                    Select Assignee(s) * (Select multiple for a Common Task)
                  </label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        const all: Record<number, boolean> = {}
                        members.forEach(m => {
                          all[m.id] = true
                        })
                        setSelectedAssigneeIds(all)
                      }}
                      className="text-[11px] text-primary hover:underline"
                    >
                      Select All
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedAssigneeIds({})}
                      className="text-[11px] text-muted-foreground hover:underline"
                    >
                      Clear
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 max-h-40 overflow-y-auto rounded-lg border border-border/40 bg-background/70 p-2.5">
                  {members.map(m => (
                    <label
                      key={m.id}
                      className="flex items-center gap-2 text-xs cursor-pointer truncate"
                    >
                      <input
                        type="checkbox"
                        checked={Boolean(selectedAssigneeIds[m.id])}
                        onChange={e =>
                          setSelectedAssigneeIds(prev => ({
                            ...prev,
                            [m.id]: e.target.checked,
                          }))
                        }
                        className="h-3.5 w-3.5 accent-amber-500"
                      />
                      <span className="truncate">{m.full_name}</span>
                    </label>
                  ))}
                </div>
              </div>

              <label className="flex items-center gap-2 font-medium text-foreground cursor-pointer">
                <Checkbox
                  checked={taskIsPrivate}
                  onCheckedChange={v => setTaskIsPrivate(Boolean(v))}
                />
                <Lock className="h-3.5 w-3.5 text-amber-400" />
                <span>Mark as Private Task (hide from the public status board)</span>
              </label>

              <Button
                type="button"
                disabled={assigning}
                onClick={handleCreateAndAssignTask}
                className="w-full gold-gradient text-gold-foreground font-bold gap-2"
              >
                <Send className="h-4 w-4" />
                {assigning ? 'Assigning Task...' : 'Assign & Notify Member(s)'}
              </Button>
            </div>
          )}

          <div className="flex flex-wrap gap-1.5 rounded-xl border border-border/50 bg-background/60 p-1">
            <button
              type="button"
              onClick={() => setMainSection('active')}
              className={`flex-1 min-w-[110px] rounded-lg px-3 py-2 text-xs font-bold transition-all ${
                mainSection === 'active'
                  ? 'gold-gradient text-gold-foreground shadow'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Active Tasks ({activeAssignedToMe.length + activeAssignedByMe.length})
            </button>

            <button
              type="button"
              onClick={() => setMainSection('completed')}
              className={`flex-1 min-w-[110px] rounded-lg px-3 py-2 text-xs font-bold transition-all ${
                mainSection === 'completed'
                  ? 'gold-gradient text-gold-foreground shadow'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Completed Tasks ({completedAssignedToMe.length + completedAssignedByMe.length})
            </button>

            <button
              type="button"
              onClick={() => setMainSection('public')}
              className={`flex-1 min-w-[130px] rounded-lg px-3 py-2 text-xs font-bold transition-all ${
                mainSection === 'public'
                  ? 'gold-gradient text-gold-foreground shadow'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Public Task Status ({publicCombinedTasks.length})
            </button>
          </div>

          {mainSection !== 'public' && (
            <div className="flex gap-2 border-b border-border/30 pb-3">
              <Button
                type="button"
                size="sm"
                variant={subScope === 'assigned_to_me' ? 'default' : 'outline'}
                onClick={() => setSubScope('assigned_to_me')}
                className={
                  subScope === 'assigned_to_me'
                    ? 'bg-primary text-primary-foreground text-xs'
                    : 'text-xs'
                }
              >
                Tasks Assigned to Me (
                {mainSection === 'active'
                  ? activeAssignedToMe.length
                  : completedAssignedToMe.length}
                )
              </Button>

              <Button
                type="button"
                size="sm"
                variant={subScope === 'assigned_by_me' ? 'default' : 'outline'}
                onClick={() => setSubScope('assigned_by_me')}
                className={
                  subScope === 'assigned_by_me'
                    ? 'bg-primary text-primary-foreground text-xs'
                    : 'text-xs'
                }
              >
                Tasks I Assigned to Others (
                {mainSection === 'active'
                  ? activeAssignedByMe.length
                  : completedAssignedByMe.length}
                )
              </Button>
            </div>
          )}

          {loading ? (
            <p className="py-8 text-center text-xs text-muted-foreground">Loading tasks...</p>
          ) : mainSection !== 'public' ? (
            currentPersonalList.length === 0 ? (
              <div className="rounded-xl border border-border/30 bg-muted/10 p-8 text-center text-xs text-muted-foreground">
                No tasks found in this view.
              </div>
            ) : (
              <div className="space-y-2.5">
                {currentPersonalList.map(t => {
                  const senderLabel = getSenderLabel(t)
                  const assigneeLabel = getMemberName(t.assigned_to_user_id)
                  const isCompleted = t.status === 'completed'

                  return (
                    <div
                      key={t.id}
                      onClick={() => setInspectedTask(t)}
                      className="cursor-pointer rounded-xl border border-border/40 bg-muted/15 hover:border-primary/40 hover:bg-primary/5 p-3.5 transition-all flex items-start justify-between gap-3 text-xs"
                    >
                      <div className="space-y-1 min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-bold text-foreground">{t.title}</span>
                          <Badge
                            variant={isCompleted ? 'default' : 'secondary'}
                            className={
                              isCompleted
                                ? 'bg-emerald-600 text-white text-[10px]'
                                : 'text-[10px]'
                            }
                          >
                            {isCompleted ? 'Completed' : 'Pending'}
                          </Badge>
                          {t.is_private && (
                            <span className="inline-flex items-center gap-1 rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] text-amber-300">
                              <Lock className="h-2.5 w-2.5" /> Private
                            </span>
                          )}
                        </div>

                        <p className="text-[11px] text-muted-foreground">
                          From: <strong className="text-primary">{senderLabel}</strong> • To:{' '}
                          <strong className="text-foreground">{assigneeLabel}</strong>
                        </p>

                        <div className="flex flex-wrap gap-3 text-[10px] text-muted-foreground">
                          <span>Sent: {formatISTDateTime(t.created_at)}</span>
                          {t.due_date && (
                            <span className="text-amber-300 font-semibold">
                              Due: {formatFullDate(t.due_date)}
                            </span>
                          )}
                        </div>
                      </div>

                      {isCompleted && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          title="Delete Completed Task Details"
                          onClick={e => handleDeleteCompletedTask(t, e)}
                          className="h-8 w-8 text-destructive hover:bg-destructive/10 shrink-0"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  )
                })}
              </div>
            )
          ) : publicCombinedTasks.length === 0 ? (
            <div className="rounded-xl border border-border/30 bg-muted/10 p-8 text-center text-xs text-muted-foreground">
              No public tasks posted yet.
            </div>
          ) : (
            <div className="space-y-2.5">
              {publicCombinedTasks.map(group => {
                const completedCount = group.assignees.filter(
                  a => a.status === 'completed'
                ).length
                const isCommon = group.assignees.length > 1

                return (
                  <div
                    key={group.groupKey}
                    onClick={() => setInspectedPublicGroup(group)}
                    className="cursor-pointer rounded-xl border border-border/40 bg-muted/15 hover:border-primary/40 hover:bg-primary/5 p-3.5 transition-all space-y-2 text-xs"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <Globe className="h-4 w-4 text-primary shrink-0" />
                        <span className="text-sm font-bold text-foreground">{group.title}</span>
                        {isCommon && (
                          <Badge variant="outline" className="border-primary/40 text-primary text-[10px]">
                            Common Task ({group.assignees.length} Members)
                          </Badge>
                        )}
                      </div>

                      <span className="rounded-full bg-primary/15 px-2.5 py-0.5 text-[11px] font-semibold text-primary">
                        {completedCount} / {group.assignees.length} Completed
                      </span>
                    </div>

                    <p className="text-[11px] text-muted-foreground">
                      Assigned by: <strong className="text-primary">{group.senderName}</strong> •{' '}
                      {formatISTDateTime(group.createdAt)}
                      {group.dueDate ? ` • Due: ${formatFullDate(group.dueDate)}` : ''}
                    </p>

                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {group.assignees.map(a => (
                        <span
                          key={a.userId}
                          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                            a.status === 'completed'
                              ? 'bg-emerald-500/20 text-emerald-300'
                              : 'bg-muted text-muted-foreground'
                          }`}
                        >
                          {a.status === 'completed' ? (
                            <CheckCircle2 className="h-2.5 w-2.5" />
                          ) : (
                            <Clock className="h-2.5 w-2.5" />
                          )}
                          {a.name}
                        </span>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {inspectedTask && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
          onClick={() => setInspectedTask(null)}
        >
          <Card
            className="w-full max-w-lg border-primary/40 bg-card shadow-2xl max-h-[90vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between gap-2">
                <CardTitle className="text-base text-primary">{inspectedTask.title}</CardTitle>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => setInspectedTask(null)}
                  className="h-7 w-7 shrink-0"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>

            <CardContent className="space-y-3 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 rounded-xl border border-border/40 bg-muted/20 p-3">
                <div>
                  <p className="text-muted-foreground">Sender</p>
                  <p className="font-bold text-primary">{getSenderLabel(inspectedTask)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Assignee</p>
                  <p className="font-bold text-foreground">
                    {getMemberName(inspectedTask.assigned_to_user_id)}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Sending Date &amp; Time (IST)</p>
                  <p className="font-semibold text-foreground">
                    {formatISTDateTime(inspectedTask.created_at)}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Due Date</p>
                  <p className="font-semibold text-amber-300">
                    {inspectedTask.due_date ? formatFullDate(inspectedTask.due_date) : 'No due date'}
                  </p>
                </div>
                <div className="sm:col-span-2">
                  <p className="text-muted-foreground">Completed Date &amp; Time (IST)</p>
                  <p
                    className={`font-semibold ${
                      inspectedTask.completed_at ? 'text-emerald-400' : 'text-muted-foreground'
                    }`}
                  >
                    {inspectedTask.completed_at
                      ? formatISTDateTime(inspectedTask.completed_at)
                      : 'Pending completion'}
                  </p>
                </div>
              </div>

              <div className="rounded-xl border border-border/40 bg-background/60 p-3 space-y-1.5">
                <p className="font-bold text-primary">Task Details &amp; Checklist</p>
                {buildSubItemsForTask(inspectedTask).map(si => (
                  <div key={si.id} className="flex items-center justify-between gap-2 py-0.5">
                    <span className="text-foreground/90">• {si.label}</span>
                    <span
                      className={`text-[10px] font-bold ${
                        si.completed
                          ? 'text-emerald-400'
                          : si.optedOut
                          ? 'text-amber-300'
                          : 'text-muted-foreground'
                      }`}
                    >
                      {si.completed
                        ? 'Completed'
                        : si.optedOut
                        ? 'Preferred Not to Complete'
                        : 'Pending'}
                    </span>
                  </div>
                ))}
              </div>

              {inspectedTask.completion_summary && (
                <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 whitespace-pre-line text-emerald-200">
                  {inspectedTask.completion_summary}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {inspectedPublicGroup && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
          onClick={() => setInspectedPublicGroup(null)}
        >
          <Card
            className="w-full max-w-lg border-primary/40 bg-card shadow-2xl max-h-[90vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between gap-2">
                <CardTitle className="text-base text-primary">
                  {inspectedPublicGroup.title}
                </CardTitle>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => setInspectedPublicGroup(null)}
                  className="h-7 w-7 shrink-0"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>

            <CardContent className="space-y-3 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 rounded-xl border border-border/40 bg-muted/20 p-3">
                <div>
                  <p className="text-muted-foreground">Sender</p>
                  <p className="font-bold text-primary">{inspectedPublicGroup.senderName}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Assignees</p>
                  <p className="font-bold text-foreground">
                    {inspectedPublicGroup.assignees.length} Member(s)
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Sending Date &amp; Time (IST)</p>
                  <p className="font-semibold text-foreground">
                    {formatISTDateTime(inspectedPublicGroup.createdAt)}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Due Date</p>
                  <p className="font-semibold text-amber-300">
                    {inspectedPublicGroup.dueDate
                      ? formatFullDate(inspectedPublicGroup.dueDate)
                      : 'No due date'}
                  </p>
                </div>
              </div>

              <div className="rounded-xl border border-border/40 bg-background/60 p-3 whitespace-pre-line text-foreground/90">
                {inspectedPublicGroup.description}
              </div>

              <div className="space-y-1.5">
                <p className="font-bold text-primary flex items-center gap-1.5">
                  <UserCheck className="h-4 w-4" />
                  Assignee Status Breakdown
                </p>
                {inspectedPublicGroup.assignees.map(a => (
                  <div
                    key={a.userId}
                    className="flex items-center justify-between gap-2 rounded-lg border border-border/30 bg-muted/15 px-3 py-2"
                  >
                    <span className="font-semibold text-foreground">{a.name}</span>
                    <span
                      className={`text-[11px] font-semibold ${
                        a.status === 'completed' ? 'text-emerald-400' : 'text-amber-300'
                      }`}
                    >
                      {a.status === 'completed'
                        ? `Completed (${formatISTDateTime(a.completedAt)})`
                        : 'Pending'}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
