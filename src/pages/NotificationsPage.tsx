import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { supabase } from '@/lib/supabase'
import { saveAuditPreference } from '@/lib/fenestriansCore'
import { formatISTDateTime } from '@/lib/formatters'
import { consumePreviousRoute, recordPreviousRoute } from '@/lib/navigationState'
import {
  auditSingleTaskField,
  buildSubItemsForTask,
  resolveOfficerDisplayName,
  type TaskSubItem,
} from '@/lib/taskAuditService'
import {
  fetchUserNotifications,
  fetchNotificationArchiveMetadata,
  markNotificationRead,
  markAllStandardNotificationsRead,
  snoozeNotification,
  deleteAllReadNotifications,
  recallNotificationHistory,
  clearChatNotifications,
  clearCallNotification,
  publishArchivedAlert,
  isChatNotification,
  isCallNotification,
  type UserNotificationItem,
} from '@/lib/notificationService'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Bell,
  CheckCheck,
  Clock,
  X,
  RefreshCw,
  Trash2,
  History,
  MessageSquare,
  Phone,
  Video,
  AlertTriangle,
  Sparkles,
  Users,
  Calendar,
  Heart,
  Cake,
  HelpCircle,
  CheckCircle2,
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  UserCog,
  ClipboardCheck,
  ListTodo,
} from 'lucide-react'

interface ExpandedPersonalTaskState {
  taskRecord: any | null
  subItems: TaskSubItem[]
  isMicromanaged: boolean
  loading: boolean
}

function getCategoryIcon(category: string) {
  switch (category) {
    case 'birthday':
      return <Cake className="h-4 w-4 text-pink-400 shrink-0" />
    case 'anniversary':
      return <Heart className="h-4 w-4 text-rose-400 shrink-0" />
    case 'new_member':
      return <Users className="h-4 w-4 text-emerald-400 shrink-0" />
    case 'app_update':
      return <Sparkles className="h-4 w-4 text-amber-400 shrink-0" />
    case 'help_needed':
      return <HelpCircle className="h-4 w-4 text-red-400 shrink-0" />
    case 'event':
      return <Calendar className="h-4 w-4 text-sky-400 shrink-0" />
    case 'common_task':
    case 'personal_task':
      return <ClipboardCheck className="h-4 w-4 text-indigo-400 shrink-0" />
    case 'common_chat':
    case 'private_chat':
    case 'group_chat':
      return <MessageSquare className="h-4 w-4 text-emerald-400 shrink-0" />
    case 'group_call':
      return <Phone className="h-4 w-4 text-amber-400 shrink-0" />
    case 'video_call':
      return <Video className="h-4 w-4 text-purple-400 shrink-0" />
    case 'instruction':
    case 'important_member_message':
      return <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0" />
    default:
      return <Bell className="h-4 w-4 text-primary shrink-0" />
  }
}

export default function NotificationsPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState<'unread' | 'read'>('unread')
  const [items, setItems] = useState<UserNotificationItem[]>([])
  const [loading, setLoading] = useState(true)
  const [actionBusy, setActionBusy] = useState(false)

  const [expandedTaskIds, setExpandedTaskIds] = useState<Record<number, boolean>>({})
  const [personalTaskDetails, setPersonalTaskDetails] = useState<
    Record<number, ExpandedPersonalTaskState>
  >({})
  const [auditFeedbackBanner, setAuditFeedbackBanner] = useState<{
    type: 'success' | 'error'
    text: string
  } | null>(null)

  const [selectedItem, setSelectedItem] = useState<UserNotificationItem | null>(null)
  const [snoozeValue, setSnoozeValue] = useState<number>(10)
  const [snoozeUnit, setSnoozeUnit] = useState<'minutes' | 'hours'>('minutes')

  const loadAll = useCallback(async () => {
    if (!user) return
    setLoading(true)
    const list = await fetchUserNotifications(user.id)
    setItems(list)
    setLoading(false)
    window.dispatchEvent(new Event('fenestrians-notifications-updated'))
  }, [user])

  useEffect(() => {
    if (!user) {
      navigate('/')
      return
    }
    loadAll()
  }, [user, navigate, loadAll])

  const loadPersonalTaskChecklist = useCallback(
    async (notif: UserNotificationItem) => {
      if (!user) return
      setPersonalTaskDetails(prev => ({
        ...prev,
        [notif.id]: {
          taskRecord: prev[notif.id]?.taskRecord ?? null,
          subItems: prev[notif.id]?.subItems ?? [],
          isMicromanaged: prev[notif.id]?.isMicromanaged ?? false,
          loading: true,
        },
      }))

      const meta = await fetchNotificationArchiveMetadata(notif.archive_id)
      let taskRow: any = null

      if (meta.task_id) {
        const { data } = await supabase
          .from('member_tasks')
          .select('*')
          .eq('id', meta.task_id)
          .maybeSingle()
        taskRow = data
      } else {
        const { data } = await supabase
          .from('member_tasks')
          .select('*')
          .eq('assigned_to_user_id', user.id)
          .eq('description', notif.full_message)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()
        taskRow = data
      }

      const subItems = buildSubItemsForTask(
        taskRow,
        meta.audit_items ?? [],
        notif.full_message
      )

      setPersonalTaskDetails(prev => ({
        ...prev,
        [notif.id]: {
          taskRecord: taskRow,
          subItems,
          isMicromanaged: Boolean(meta.is_micromanaged || taskRow?.is_micromanaged),
          loading: false,
        },
      }))
    },
    [user]
  )

  const toggleExpandPersonalTask = async (notif: UserNotificationItem) => {
    const nextOpen = !expandedTaskIds[notif.id]
    setExpandedTaskIds(prev => ({ ...prev, [notif.id]: nextOpen }))
    if (nextOpen) {
      await loadPersonalTaskChecklist(notif)
    }
  }

  const handleToggleSubTaskCheckbox = async (
    notif: UserNotificationItem,
    subItem: TaskSubItem,
    checked: boolean
  ) => {
    if (!user) return
    const state = personalTaskDetails[notif.id]
    if (!state) return

    if (!checked) {
      const updatedItems = state.subItems.map(i =>
        i.id === subItem.id ? { ...i, completed: false } : i
      )
      setPersonalTaskDetails(prev => ({
        ...prev,
        [notif.id]: { ...state, subItems: updatedItems },
      }))
      if (state.taskRecord?.id) {
        await supabase
          .from('member_tasks')
          .update({ task_items_json: updatedItems })
          .eq('id', state.taskRecord.id)
      }
      return
    }

    setActionBusy(true)
    const outcome = await auditSingleTaskField(user.id, subItem.fieldKey)

    if (outcome.auditable && !outcome.passed) {
      setActionBusy(false)
      const msg = `Task Incomplete: ${outcome.reason}\n\nNote: If you do not wish to fill this detail, you still have the option to click "Prefer not to complete" so you need not be bothered by reminders.`
      setAuditFeedbackBanner({ type: 'error', text: msg })
      alert(msg)
      return
    }

    const updatedItems = state.subItems.map(i =>
      i.id === subItem.id ? { ...i, completed: true, optedOut: false } : i
    )

    setPersonalTaskDetails(prev => ({
      ...prev,
      [notif.id]: { ...state, subItems: updatedItems },
    }))

    if (state.taskRecord?.id) {
      await supabase
        .from('member_tasks')
        .update({ task_items_json: updatedItems })
        .eq('id', state.taskRecord.id)
    }

    setActionBusy(false)
    const ackText = outcome.auditable
      ? `Task Verified & Completed: "${subItem.label}" has been audited and confirmed!`
      : `Task Completed: "${subItem.label}" marked as completed!`
    setAuditFeedbackBanner({ type: 'success', text: ackText })
  }

  const handlePreferNotToComplete = async (
    notif: UserNotificationItem,
    subItem: TaskSubItem
  ) => {
    if (!user) return
    const state = personalTaskDetails[notif.id]
    if (!state) return

    setActionBusy(true)
    if (subItem.fieldKey && subItem.fieldKey !== 'general') {
      await saveAuditPreference(user.id, subItem.preferenceType, subItem.fieldKey)
      await supabase
        .from('member_tasks')
        .delete()
        .eq('assigned_to_user_id', user.id)
        .eq('task_type', 'audit_staging')
        .eq('field_key', subItem.fieldKey)
    }

    const updatedItems = state.subItems.map(i =>
      i.id === subItem.id ? { ...i, optedOut: true, completed: false } : i
    )

    setPersonalTaskDetails(prev => ({
      ...prev,
      [notif.id]: { ...state, subItems: updatedItems },
    }))

    if (state.taskRecord?.id) {
      await supabase
        .from('member_tasks')
        .update({ task_items_json: updatedItems })
        .eq('id', state.taskRecord.id)
    }

    setActionBusy(false)
    setAuditFeedbackBanner({
      type: 'success',
      text: `Preference saved for "${subItem.label}". Future audits will skip this detail.`,
    })
  }

  const handleFinalizeAllTasksCompleted = async (notif: UserNotificationItem) => {
    if (!user) return
    const state = personalTaskDetails[notif.id]
    if (!state) return

    const completedList = state.subItems.filter(i => i.completed).map(i => `• ${i.label}`)
    const optedOutList = state.subItems.filter(i => i.optedOut).map(i => `• ${i.label}`)

    const analysisParts: string[] = [
      `Task Completion Analysis for ${user.full_name}:`,
      `Total Assigned Items: ${state.subItems.length} | Completed: ${completedList.length} | Preferred Not to Complete: ${optedOutList.length}`,
    ]
    if (completedList.length > 0) {
      analysisParts.push(`\nCompleted Details:\n${completedList.join('\n')}`)
    }
    if (optedOutList.length > 0) {
      analysisParts.push(`\nPreferred Not to Complete:\n${optedOutList.join('\n')}`)
    }
    const summaryText = analysisParts.join('\n')

    setActionBusy(true)
    const nowIso = new Date().toISOString()

    if (state.taskRecord?.id) {
      await supabase
        .from('member_tasks')
        .update({
          status: 'completed',
          completed_at: nowIso,
          task_items_json: state.subItems,
          completion_summary: summaryText,
        })
        .eq('id', state.taskRecord.id)
    }

    const recurRule = String(state.taskRecord?.recurrence_rule || 'none').toLowerCase()
    if (state.taskRecord && (recurRule === 'monthly' || recurRule === 'quarterly')) {
      const monthsToAdd = recurRule === 'quarterly' ? 3 : 1
      const baseDate = state.taskRecord.due_date
        ? new Date(`${state.taskRecord.due_date}T00:00:00`)
        : new Date()
      baseDate.setMonth(baseDate.getMonth() + monthsToAdd)
      const nextDueIso = baseDate.toISOString().slice(0, 10)
      const resetItems = state.subItems.map(si => ({
        ...si,
        completed: false,
        optedOut: false,
      }))

      const { data: nextTask } = await supabase
        .from('member_tasks')
        .insert([
          {
            assigned_to_user_id: user.id,
            assigned_by_user_id: state.taskRecord.assigned_by_user_id,
            task_type: state.taskRecord.task_type,
            field_key: state.taskRecord.field_key,
            title: state.taskRecord.title,
            description: state.taskRecord.description,
            is_micromanaged: false,
            status: 'pending',
            due_date: nextDueIso,
            recurrence_rule: recurRule,
            is_private: Boolean(state.taskRecord.is_private),
            sender_display_name: state.taskRecord.sender_display_name,
            task_items_json: resetItems,
          },
        ])
        .select('id')
        .single()

      await publishArchivedAlert({
        category: 'personal_task',
        shortTitle: `Next Recurring Task (${recurRule.toUpperCase()})`,
        fullMessage: `${state.taskRecord.title} (Next cycle scheduled for ${nextDueIso})`,
        targetUserId: user.id,
        metadata: { task_id: nextTask?.id, is_micromanaged: false, audit_items: [] },
      })
    }

    const assignerId = Number(state.taskRecord?.assigned_by_user_id || 0)
    if (assignerId && assignerId !== user.id) {
      const assigneeTitledName = await resolveOfficerDisplayName(user.id, user.full_name)
      await publishArchivedAlert({
        category: 'member_message',
        shortTitle: `Tasks Completed by ${assigneeTitledName}`,
        fullMessage: `${assigneeTitledName} has completed all assigned tasks (${formatISTDateTime(nowIso)}).\n\n${summaryText}`,
        targetUserId: assignerId,
      })
    }

    await markNotificationRead(notif.id)
    setExpandedTaskIds(prev => {
      const next = { ...prev }
      delete next[notif.id]
      return next
    })
    await loadAll()
    setActionBusy(false)
    setAuditFeedbackBanner({
      type: 'success',
      text: 'All tasks completed! A completion summary has been sent to the assigner.',
    })
  }

  const openStandardPopup = (item: UserNotificationItem) => {
    setSelectedItem(item)
    const defaultMins = item.snooze_minutes || 10
    if (defaultMins >= 60 && defaultMins % 60 === 0) {
      setSnoozeValue(defaultMins / 60)
      setSnoozeUnit('hours')
    } else {
      setSnoozeValue(defaultMins)
      setSnoozeUnit('minutes')
    }
  }

  useEffect(() => {
    const handleSnoozeTrigger = (e: Event) => {
      const detail = (e as CustomEvent<UserNotificationItem>).detail
      if (detail) {
        if (detail.category === 'personal_task') {
          setExpandedTaskIds(prev => ({ ...prev, [detail.id]: true }))
          loadPersonalTaskChecklist(detail)
        } else {
          openStandardPopup(detail)
        }
      }
    }
    window.addEventListener('fenestrians-open-snoozed', handleSnoozeTrigger)
    return () => window.removeEventListener('fenestrians-open-snoozed', handleSnoozeTrigger)
  }, [loadPersonalTaskChecklist])

  const unreadRaw = items.filter(i => i.status === 'unread')
  const personalTaskUnread = unreadRaw.filter(i => i.category === 'personal_task')
  const otherUnread = unreadRaw.filter(i => i.category !== 'personal_task')
  const unreadList = [...personalTaskUnread, ...otherUnread]

  const readList = items.filter(i => i.status === 'read')

  const totalUnreadBadgeCount = unreadList.reduce(
    (sum, item) => sum + (item.unread_count || 1),
    0
  )

  const handleCloseNotificationsPage = () => {
    const prev = consumePreviousRoute('/dashboard')
    navigate(prev === '/notifications' || prev === '/tasks' ? '/dashboard' : prev)
  }

  const handleStandardItemClick = async (item: UserNotificationItem) => {
    if (!user) return

    if (isChatNotification(item.category)) {
      await clearChatNotifications(user.id)
      window.dispatchEvent(new Event('fenestrians-notifications-updated'))
      recordPreviousRoute('/notifications')
      navigate('/dashboard?tab=chat')
      return
    }

    if (isCallNotification(item.category)) {
      await clearCallNotification(user.id, item.id)
      window.dispatchEvent(new Event('fenestrians-notifications-updated'))
      recordPreviousRoute('/notifications')
      navigate('/dashboard?tab=calls')
      return
    }

    openStandardPopup(item)
  }

  const handlePopupCloseToRead = async () => {
    if (!selectedItem || selectedItem.category === 'personal_task') return
    setActionBusy(true)
    await markNotificationRead(selectedItem.id)
    setSelectedItem(null)
    await loadAll()
    setActionBusy(false)
  }

  const handlePopupKeepUnread = () => {
    setSelectedItem(null)
  }

  const handlePopupSnooze = async () => {
    if (!selectedItem) return
    const rawMinutes = snoozeUnit === 'hours' ? snoozeValue * 60 : snoozeValue
    const clampedMinutes = Math.min(480, Math.max(1, Math.round(rawMinutes || 10)))

    setActionBusy(true)
    await snoozeNotification(selectedItem.id, clampedMinutes)
    setSelectedItem(null)
    await loadAll()
    setActionBusy(false)

    const label =
      clampedMinutes >= 60
        ? `${(clampedMinutes / 60).toFixed(clampedMinutes % 60 === 0 ? 0 : 1)} hour(s)`
        : `${clampedMinutes} minute(s)`
    alert(`Notification snoozed for ${label}. It remains in your Unread list and will alert your device again when time is up.`)
  }

  const handleMarkAllRead = async () => {
    if (!user) return
    setActionBusy(true)
    await markAllStandardNotificationsRead(user.id)
    await loadAll()
    setActionBusy(false)
  }

  const handleDeleteAllRead = async () => {
    if (!user) return
    if (!window.confirm('Delete all notifications from your Read list? You can restore them anytime using Recall History.')) {
      return
    }
    setActionBusy(true)
    await deleteAllReadNotifications(user.id)
    await loadAll()
    setActionBusy(false)
  }

  const handleRecallHistory = async () => {
    if (!user) return
    setActionBusy(true)
    await recallNotificationHistory(user.id)
    await loadAll()
    setActionBusy(false)
  }

  return (
    <div className="min-h-svh p-4 sm:p-6 pb-28 relative">
      <div className="mx-auto max-w-3xl space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleCloseNotificationsPage}
            className="gap-1.5 text-xs text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              recordPreviousRoute('/dashboard')
              navigate('/tasks')
            }}
            className="gap-1.5 text-xs border-primary/40 text-primary hover:bg-primary/10"
          >
            <ListTodo className="h-3.5 w-3.5" />
            Open Tasks Page
          </Button>
        </div>

        {auditFeedbackBanner && (
          <div
            className={`flex items-start justify-between gap-2 rounded-xl border p-3.5 text-xs whitespace-pre-line ${
              auditFeedbackBanner.type === 'success'
                ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-300'
                : 'border-red-500/40 bg-red-500/15 text-red-200'
            }`}
          >
            <span>{auditFeedbackBanner.text}</span>
            <button
              type="button"
              onClick={() => setAuditFeedbackBanner(null)}
              className="text-muted-foreground hover:text-foreground shrink-0"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        <Card className="border-border/40 bg-card/80 backdrop-blur-md shadow-xl">
          <CardHeader className="pb-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <CardTitle className="flex items-center gap-2 text-primary">
                <Bell className="h-5 w-5" />
                Notifications Center
              </CardTitle>

              <div className="flex rounded-lg border border-border/50 bg-background/60 p-1">
                <button
                  type="button"
                  onClick={() => setActiveTab('unread')}
                  className={`flex items-center gap-2 rounded-md px-3.5 py-1.5 text-xs font-semibold transition-all ${
                    activeTab === 'unread'
                      ? 'gold-gradient text-gold-foreground shadow'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Unread
                  {totalUnreadBadgeCount > 0 && (
                    <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1.5 text-[11px] font-bold text-white">
                      {totalUnreadBadgeCount}
                    </span>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('read')}
                  className={`flex items-center gap-2 rounded-md px-3.5 py-1.5 text-xs font-semibold transition-all ${
                    activeTab === 'read'
                      ? 'gold-gradient text-gold-foreground shadow'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Read ({readList.length})
                </button>
              </div>
            </div>
          </CardHeader>

          <CardContent className="space-y-4">
            {activeTab === 'unread' && (
              <>
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/30 pb-3">
                  <p className="text-xs text-muted-foreground">
                    Personal tasks stay pinned at the top until all checklist items are completed.
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={actionBusy || loading}
                      onClick={loadAll}
                      className="gap-1.5 text-xs"
                    >
                      <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
                      Refresh
                    </Button>
                    {otherUnread.length > 0 && (
                      <Button
                        type="button"
                        size="sm"
                        disabled={actionBusy}
                        onClick={handleMarkAllRead}
                        className="gold-gradient text-gold-foreground font-semibold gap-1.5 text-xs"
                      >
                        <CheckCheck className="h-3.5 w-3.5" />
                        Mark standard alerts read
                      </Button>
                    )}
                  </div>
                </div>

                {loading ? (
                  <p className="py-8 text-center text-xs text-muted-foreground">Loading unread notifications...</p>
                ) : unreadList.length === 0 ? (
                  <div className="rounded-xl border border-border/30 bg-muted/10 p-8 text-center space-y-1">
                    <p className="text-sm font-semibold text-foreground">No unread notifications</p>
                    <p className="text-xs text-muted-foreground">You are all caught up!</p>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {unreadList.map(item => {
                      if (item.category === 'personal_task') {
                        const isOpen = Boolean(expandedTaskIds[item.id])
                        const state = personalTaskDetails[item.id]
                        const subItems = state?.subItems ?? []
                        const allResolved =
                          subItems.length > 0 &&
                          subItems.every(si => si.completed || si.optedOut)

                        return (
                          <div
                            key={item.id}
                            className="rounded-xl border-2 border-indigo-500/50 bg-indigo-500/10 overflow-hidden shadow-md"
                          >
                            <button
                              type="button"
                              onClick={() => toggleExpandPersonalTask(item)}
                              className="w-full text-left p-3.5 flex items-center justify-between gap-3 hover:bg-indigo-500/15 transition-colors"
                            >
                              <div className="flex items-center gap-3 min-w-0">
                                <ClipboardCheck className="h-5 w-5 text-indigo-400 shrink-0" />
                                <div className="min-w-0">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span className="text-sm font-bold text-foreground truncate">
                                      {item.short_title}
                                    </span>
                                    <span className="rounded bg-indigo-500/25 px-2 py-0.5 text-[10px] font-bold text-indigo-200">
                                      Pinned • Action Required
                                    </span>
                                  </div>
                                  <p className="text-[11px] text-muted-foreground mt-0.5">
                                    {formatISTDateTime(item.created_at)}
                                  </p>
                                </div>
                              </div>

                              <span className="inline-flex items-center gap-1 rounded-full bg-indigo-500/20 px-2.5 py-1 text-[11px] font-semibold text-indigo-200 shrink-0">
                                {isOpen ? 'Collapse' : 'Expand'}
                                {isOpen ? (
                                  <ChevronUp className="h-3.5 w-3.5" />
                                ) : (
                                  <ChevronDown className="h-3.5 w-3.5" />
                                )}
                              </span>
                            </button>

                            {isOpen && (
                              <div className="border-t border-indigo-500/30 bg-card/90 p-4 space-y-3.5 text-xs">
                                <p className="text-foreground/90 whitespace-pre-line leading-relaxed">
                                  {item.full_message}
                                </p>

                                {state?.loading ? (
                                  <p className="text-muted-foreground">Loading task checklist...</p>
                                ) : (
                                  <div className="space-y-2">
                                    <p className="font-bold text-indigo-300">
                                      Check each completed item below (app verifies profile details automatically):
                                    </p>

                                    {subItems.map(si => {
                                      const isAuditableField =
                                        si.fieldKey && si.fieldKey !== 'general' && si.fieldKey !== 'custom'
                                      return (
                                        <div
                                          key={si.id}
                                          className={`flex flex-wrap items-center justify-between gap-2 rounded-lg border p-2.5 ${
                                            si.completed
                                              ? 'border-emerald-500/40 bg-emerald-500/10'
                                              : si.optedOut
                                              ? 'border-amber-500/40 bg-amber-500/10'
                                              : 'border-border/40 bg-background/70'
                                          }`}
                                        >
                                          <label className="flex items-center gap-2.5 flex-1 min-w-[180px] cursor-pointer">
                                            <Checkbox
                                              checked={si.completed}
                                              disabled={actionBusy || si.optedOut}
                                              onCheckedChange={v =>
                                                handleToggleSubTaskCheckbox(item, si, Boolean(v))
                                              }
                                            />
                                            <span
                                              className={
                                                si.completed
                                                  ? 'line-through text-emerald-300 font-medium'
                                                  : si.optedOut
                                                  ? 'italic text-amber-300'
                                                  : 'text-foreground'
                                              }
                                            >
                                              {si.label}
                                            </span>
                                          </label>

                                          {si.completed ? (
                                            <span className="rounded bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold text-emerald-300">
                                              Completed
                                            </span>
                                          ) : si.optedOut ? (
                                            <span className="rounded bg-amber-500/20 px-2 py-0.5 text-[10px] font-bold text-amber-300">
                                              Preferred Not to Complete
                                            </span>
                                          ) : (
                                            isAuditableField && (
                                              <Button
                                                type="button"
                                                size="sm"
                                                variant="outline"
                                                disabled={actionBusy}
                                                onClick={() => handlePreferNotToComplete(item, si)}
                                                className="h-7 text-[11px] border-amber-400/40 text-amber-300 hover:bg-amber-500/15"
                                              >
                                                {si.preferenceType === 'retain_duplicate'
                                                  ? 'Retain Duplicate'
                                                  : 'Prefer not to complete'}
                                              </Button>
                                            )
                                          )}
                                        </div>
                                      )
                                    })}
                                  </div>
                                )}

                                <div className="flex flex-wrap items-center gap-2 pt-1">
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    onClick={() => {
                                      recordPreviousRoute('/notifications')
                                      navigate('/dashboard?tab=profile')
                                    }}
                                    className="gap-1.5 text-xs"
                                  >
                                    <UserCog className="h-3.5 w-3.5" />
                                    Open My Profile
                                  </Button>

                                  <Button
                                    type="button"
                                    size="sm"
                                    disabled={actionBusy || !allResolved}
                                    onClick={() => handleFinalizeAllTasksCompleted(item)}
                                    className="ml-auto bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-bold gap-1.5 text-xs"
                                  >
                                    <CheckCircle2 className="h-3.5 w-3.5" />
                                    Tasks Completed
                                  </Button>
                                </div>

                                {!allResolved && (
                                  <p className="text-[11px] text-muted-foreground">
                                    This personal task alert cannot be closed until every item above is checked and verified (or marked “Prefer not to complete”).
                                  </p>
                                )}
                              </div>
                            )}
                          </div>
                        )
                      }

                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => handleStandardItemClick(item)}
                          className="w-full text-left rounded-xl border border-primary/30 bg-primary/5 hover:bg-primary/10 p-3.5 transition-all flex items-center justify-between gap-3"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            {getCategoryIcon(item.category)}
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-bold text-foreground truncate">
                                  {item.short_title}
                                </span>
                                {item.snoozed_until && new Date(item.snoozed_until) > new Date() && (
                                  <span className="inline-flex items-center gap-1 rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-medium text-amber-300">
                                    <Clock className="h-2.5 w-2.5" />
                                    Snoozed
                                  </span>
                                )}
                              </div>
                              <p className="text-[11px] text-muted-foreground mt-0.5">
                                {formatISTDateTime(item.created_at)}
                              </p>
                            </div>
                          </div>
                          <span className="shrink-0 rounded-full bg-primary/20 px-2.5 py-1 text-[11px] font-semibold text-primary">
                            {isChatNotification(item.category)
                              ? 'Open Chat'
                              : isCallNotification(item.category)
                              ? 'Join Call'
                              : 'Open'}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                )}
              </>
            )}

            {activeTab === 'read' && (
              <>
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/30 pb-3">
                  <p className="text-xs text-muted-foreground">
                    Archived notification history ({readList.length})
                  </p>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={actionBusy || loading}
                      onClick={loadAll}
                      className="gap-1.5 text-xs"
                    >
                      <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
                      Refresh
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={actionBusy}
                      onClick={handleRecallHistory}
                      className="gap-1.5 text-xs border-primary/40 text-primary hover:bg-primary/10"
                    >
                      <History className="h-3.5 w-3.5" />
                      Recall History
                    </Button>
                    {readList.length > 0 && (
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        disabled={actionBusy}
                        onClick={handleDeleteAllRead}
                        className="gap-1.5 text-xs"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Delete All
                      </Button>
                    )}
                  </div>
                </div>

                {loading ? (
                  <p className="py-8 text-center text-xs text-muted-foreground">Loading read history...</p>
                ) : readList.length === 0 ? (
                  <div className="rounded-xl border border-border/30 bg-muted/10 p-8 text-center space-y-2">
                    <p className="text-sm font-semibold text-foreground">No read notifications</p>
                    <p className="text-xs text-muted-foreground">
                      Tap <span className="font-semibold text-primary">Recall History</span> above to restore archived notifications from the database.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {readList.map(item => (
                      <div
                        key={item.id}
                        className="rounded-xl border border-border/30 bg-muted/15 p-3.5 space-y-1"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            {getCategoryIcon(item.category)}
                            <span className="text-xs font-bold text-primary">{item.short_title}</span>
                          </div>
                          <span className="text-[10px] text-muted-foreground">
                            {formatISTDateTime(item.created_at)}
                          </span>
                        </div>
                        <p className="text-xs text-foreground/90 leading-relaxed pl-6 whitespace-pre-line">
                          {item.full_message}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {selectedItem && selectedItem.category !== 'personal_task' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <Card className="w-full max-w-md border-primary/40 bg-card shadow-2xl max-h-[90vh] overflow-y-auto">
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                {getCategoryIcon(selectedItem.category)}
                <CardTitle className="text-base text-primary">{selectedItem.short_title}</CardTitle>
              </div>
              <p className="text-[11px] text-muted-foreground">
                {formatISTDateTime(selectedItem.created_at)}
              </p>
            </CardHeader>

            <CardContent className="space-y-4">
              <div className="rounded-xl border border-border/40 bg-muted/20 p-3.5 text-sm text-foreground leading-relaxed whitespace-pre-line">
                {selectedItem.full_message}
              </div>

              <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 space-y-2">
                <label className="flex items-center gap-1.5 text-xs font-semibold text-amber-300">
                  <Clock className="h-3.5 w-3.5" />
                  Snooze Timer (Default: 10 mins • Max: 8 hours)
                </label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min={1}
                    max={snoozeUnit === 'hours' ? 8 : 480}
                    value={snoozeValue}
                    onChange={e => {
                      const val = Number(e.target.value)
                      const maxVal = snoozeUnit === 'hours' ? 8 : 480
                      setSnoozeValue(Math.min(maxVal, Math.max(1, val || 1)))
                    }}
                    className="w-24 bg-input/50 border-border/50 text-sm font-bold"
                  />
                  <select
                    value={snoozeUnit}
                    onChange={e => {
                      const nextUnit = e.target.value as 'minutes' | 'hours'
                      setSnoozeUnit(nextUnit)
                      if (nextUnit === 'hours' && snoozeValue > 8) {
                        setSnoozeValue(8)
                      }
                    }}
                    className="rounded-md border border-border/50 bg-background px-3 py-2 text-xs font-semibold"
                  >
                    <option value="minutes">Minutes</option>
                    <option value="hours">Hours (Max 8)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 pt-1">
                <Button
                  type="button"
                  disabled={actionBusy}
                  onClick={handlePopupCloseToRead}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold gap-1 text-xs"
                >
                  <X className="h-3.5 w-3.5" />
                  Close
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  disabled={actionBusy}
                  onClick={handlePopupKeepUnread}
                  className="font-semibold gap-1 text-xs"
                >
                  <Bell className="h-3.5 w-3.5" />
                  Unread
                </Button>

                <Button
                  type="button"
                  disabled={actionBusy}
                  onClick={handlePopupSnooze}
                  className="gold-gradient text-gold-foreground font-semibold gap-1 text-xs"
                >
                  <Clock className="h-3.5 w-3.5" />
                  Snooze
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
