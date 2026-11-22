import { supabase } from '@/lib/supabase'

export type NotificationCategory =
  | 'birthday'
  | 'anniversary'
  | 'member_message'
  | 'new_member'
  | 'app_update'
  | 'instruction'
  | 'important_member_message'
  | 'event'
  | 'common_task'
  | 'personal_task'
  | 'help_needed'
  | 'common_chat'
  | 'private_chat'
  | 'group_chat'
  | 'group_call'
  | 'video_call'

export interface AuditActionItem {
  label: string
  preferenceType: 'skip_missing_field' | 'retain_duplicate'
  targetKey: string
}

export interface NotificationArchiveMetadata {
  task_id?: number
  is_micromanaged?: boolean
  audit_items?: AuditActionItem[]
}

export interface UserNotificationItem {
  id: number
  user_id: number
  archive_id: number | null
  short_title: string
  category: NotificationCategory | string
  full_message: string
  status: 'unread' | 'read' | 'deleted'
  unread_count: number
  snooze_minutes: number
  snoozed_until: string | null
  snooze_notified: boolean
  created_at: string
  updated_at: string
}

const CHAT_CATEGORIES = new Set(['common_chat', 'private_chat', 'group_chat'])
const CALL_CATEGORIES = new Set(['group_call', 'video_call'])

export function isChatNotification(category: string): boolean {
  return CHAT_CATEGORIES.has(category)
}

export function isCallNotification(category: string): boolean {
  return CALL_CATEGORIES.has(category)
}

export function sendDevicePushNotification(params: {
  shortTitle: string
  fullMessage: string
  targetUserIds?: number[]
  launchUrl?: string
}): void {
  fetch('https://dojlbfnfhkfltlxggxiy.supabase.co/functions/v1/daily-notifications', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: 'sb_publishable_CmCFzsQ_L8dk7NxUmIVZ0g_pl_jq0fV',
    },
    body: JSON.stringify({
      event: 'push_only',
      shortTitle: params.shortTitle,
      fullMessage: params.fullMessage,
      targetUserIds: params.targetUserIds ?? [],
      launchUrl: params.launchUrl ?? 'https://fenestrians.salmaali.in/notifications',
    }),
  }).catch(() => {})
}

export async function fetchNotificationArchiveMetadata(
  archiveId: number | null
): Promise<NotificationArchiveMetadata> {
  if (!archiveId) return {}
  const { data } = await supabase
    .from('notifications_archive')
    .select('metadata')
    .eq('id', archiveId)
    .maybeSingle()

  if (!data || !data.metadata || typeof data.metadata !== 'object') return {}
  return data.metadata as NotificationArchiveMetadata
}

export async function syncArchivedNotificationsForUser(userId: number): Promise<void> {
  const { data: archives, error: archErr } = await supabase
    .from('notifications_archive')
    .select('id, short_title, category, full_message, target_user_id, created_at')
    .or(`target_user_id.is.null,target_user_id.eq.${userId}`)
    .order('created_at', { ascending: false })
    .limit(100)

  if (archErr || !archives || archives.length === 0) return

  const { data: existing } = await supabase
    .from('user_notifications')
    .select('archive_id')
    .eq('user_id', userId)
    .not('archive_id', 'is', null)

  const knownIds = new Set((existing ?? []).map(r => r.archive_id))
  const missing = archives.filter(a => !knownIds.has(a.id))

  if (missing.length > 0) {
    const rows = missing.map(a => ({
      user_id: userId,
      archive_id: a.id,
      short_title: a.short_title,
      category: a.category,
      full_message: a.full_message,
      status: 'unread',
      unread_count: 1,
      created_at: a.created_at,
    }))

    await supabase
      .from('user_notifications')
      .upsert(rows, { onConflict: 'user_id,archive_id', ignoreDuplicates: true })
  }
}

export async function fetchUserNotifications(userId: number): Promise<UserNotificationItem[]> {
  await syncArchivedNotificationsForUser(userId)

  const { data, error } = await supabase
    .from('user_notifications')
    .select('*')
    .eq('user_id', userId)
    .in('status', ['unread', 'read'])
    .order('created_at', { ascending: false })

  if (error || !data) return []
  return data as UserNotificationItem[]
}

export async function markNotificationRead(notificationId: number): Promise<void> {
  await supabase
    .from('user_notifications')
    .update({
      status: 'read',
      snoozed_until: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', notificationId)
}

/**
 * Marks all standard unread notifications as Read, leaving chat/call alerts
 * AND personal_task alerts untouched until their tasks are completed.
 */
export async function markAllStandardNotificationsRead(userId: number): Promise<void> {
  await supabase
    .from('user_notifications')
    .update({
      status: 'read',
      snoozed_until: null,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId)
    .eq('status', 'unread')
    .not(
      'category',
      'in',
      '("common_chat","private_chat","group_chat","group_call","video_call","personal_task")'
    )
}

export async function snoozeNotification(
  notificationId: number,
  minutes: number
): Promise<string> {
  const clampedMinutes = Math.min(480, Math.max(1, Math.round(minutes || 10)))
  const snoozedUntil = new Date(Date.now() + clampedMinutes * 60 * 1000).toISOString()

  await supabase
    .from('user_notifications')
    .update({
      status: 'unread',
      snooze_minutes: clampedMinutes,
      snoozed_until: snoozedUntil,
      snooze_notified: false,
      updated_at: new Date().toISOString(),
    })
    .eq('id', notificationId)

  return snoozedUntil
}

export async function deleteAllReadNotifications(userId: number): Promise<void> {
  await supabase
    .from('user_notifications')
    .update({
      status: 'deleted',
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId)
    .eq('status', 'read')
}

export async function recallNotificationHistory(userId: number): Promise<void> {
  const { data: archives } = await supabase
    .from('notifications_archive')
    .select('id, short_title, category, full_message, target_user_id, created_at')
    .or(`target_user_id.is.null,target_user_id.eq.${userId}`)
    .order('created_at', { ascending: false })

  if (!archives || archives.length === 0) return

  const { data: existingRows } = await supabase
    .from('user_notifications')
    .select('id, archive_id, status')
    .eq('user_id', userId)
    .not('archive_id', 'is', null)

  const unreadArchiveIds = new Set(
    (existingRows ?? []).filter(r => r.status === 'unread').map(r => r.archive_id)
  )
  const deletedArchiveIds = new Set(
    (existingRows ?? []).filter(r => r.status === 'deleted').map(r => r.archive_id)
  )
  const anyExistingIds = new Set((existingRows ?? []).map(r => r.archive_id))

  const toRestoreIds = [...deletedArchiveIds].filter(id => id && !unreadArchiveIds.has(id))
  if (toRestoreIds.length > 0) {
    await supabase
      .from('user_notifications')
      .update({ status: 'read', updated_at: new Date().toISOString() })
      .eq('user_id', userId)
      .in('archive_id', toRestoreIds)
  }

  const toInsert = archives
    .filter(a => !anyExistingIds.has(a.id) && !unreadArchiveIds.has(a.id))
    .map(a => ({
      user_id: userId,
      archive_id: a.id,
      short_title: a.short_title,
      category: a.category,
      full_message: a.full_message,
      status: 'read',
      unread_count: 1,
      created_at: a.created_at,
    }))

  if (toInsert.length > 0) {
    await supabase
      .from('user_notifications')
      .upsert(toInsert, { onConflict: 'user_id,archive_id', ignoreDuplicates: true })
  }
}

export async function recordIncomingChatNotification(params: {
  recipientUserId: number
  chatType: 'common_chat' | 'private_chat' | 'group_chat'
  senderName: string
  previewText: string
}): Promise<void> {
  const { data: existing } = await supabase
    .from('user_notifications')
    .select('id, unread_count')
    .eq('user_id', params.recipientUserId)
    .eq('status', 'unread')
    .in('category', ['common_chat', 'private_chat', 'group_chat'])
    .maybeSingle()

  const labelMap = {
    common_chat: 'Common chat message',
    private_chat: 'Private chat message',
    group_chat: 'Group chat',
  }
  const baseLabel = labelMap[params.chatType]

  if (existing) {
    const nextCount = (existing.unread_count || 1) + 1
    await supabase
      .from('user_notifications')
      .update({
        category: params.chatType,
        short_title: `${baseLabel} (${nextCount})`,
        full_message: `${nextCount} unread chat messages. Latest from ${params.senderName}: ${params.previewText}`,
        unread_count: nextCount,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existing.id)
  } else {
    await supabase.from('user_notifications').insert([
      {
        user_id: params.recipientUserId,
        archive_id: null,
        short_title: `${baseLabel} (1)`,
        category: params.chatType,
        full_message: `1 unread chat message from ${params.senderName}: ${params.previewText}`,
        status: 'unread',
        unread_count: 1,
      },
    ])
  }

  sendDevicePushNotification({
    shortTitle: baseLabel,
    fullMessage: `${params.senderName}: ${params.previewText}`,
    targetUserIds: [params.recipientUserId],
    launchUrl: 'https://fenestrians.salmaali.in/dashboard?tab=chat',
  })
}

export async function clearChatNotifications(userId: number): Promise<void> {
  await supabase
    .from('user_notifications')
    .delete()
    .eq('user_id', userId)
    .in('category', ['common_chat', 'private_chat', 'group_chat'])
}

export async function clearCallNotification(userId: number, notificationId?: number): Promise<void> {
  if (notificationId) {
    await supabase.from('user_notifications').delete().eq('id', notificationId)
  } else {
    await supabase
      .from('user_notifications')
      .delete()
      .eq('user_id', userId)
      .in('category', ['group_call', 'video_call'])
  }
}

export async function publishArchivedAlert(params: {
  category: NotificationCategory
  shortTitle?: string
  fullMessage: string
  targetUserId?: number | null
  needsHelpFlag?: boolean
  metadata?: NotificationArchiveMetadata
}): Promise<void> {
  const hasHelpTag =
    params.needsHelpFlag === true ||
    /\bhelp\b/i.test(params.fullMessage) ||
    params.category === 'help_needed'

  const defaultTitles: Record<string, string> = {
    birthday: 'Birthday alert',
    anniversary: 'Anniversary alert',
    member_message: 'Message to members',
    new_member: 'New member',
    app_update: 'Important app update',
    instruction: 'Important instruction',
    important_member_message: 'Important member message',
    event: 'Event alert',
    common_task: 'Common task alert',
    personal_task: 'Personal task alert',
    help_needed: 'Your friend Needs help',
    group_call: 'Group call',
    video_call: 'Video call',
  }

  const finalCategory = hasHelpTag ? 'help_needed' : params.category
  const finalTitle = hasHelpTag
    ? 'Your friend Needs help'
    : params.shortTitle || defaultTitles[finalCategory] || 'Message to members'

  if (finalCategory === 'group_call' || finalCategory === 'video_call') {
    if (params.targetUserId) {
      await supabase.from('user_notifications').insert([
        {
          user_id: params.targetUserId,
          archive_id: null,
          short_title: finalTitle,
          category: finalCategory,
          full_message: params.fullMessage,
          status: 'unread',
          unread_count: 1,
        },
      ])
      sendDevicePushNotification({
        shortTitle: finalTitle,
        fullMessage: params.fullMessage,
        targetUserIds: [params.targetUserId],
        launchUrl:
          finalCategory === 'video_call'
            ? 'https://fenestrians.salmaali.in/dashboard?tab=calls'
            : 'https://fenestrians.salmaali.in/dashboard?tab=calls',
      })
    }
    return
  }

  const { data: archived } = await supabase
    .from('notifications_archive')
    .insert([
      {
        short_title: finalTitle,
        category: finalCategory,
        full_message: params.fullMessage,
        target_user_id: params.targetUserId ?? null,
        metadata: params.metadata ?? {},
      },
    ])
    .select('id, created_at')
    .single()

  if (archived) {
    if (params.targetUserId) {
      await supabase.from('user_notifications').upsert(
        [
          {
            user_id: params.targetUserId,
            archive_id: archived.id,
            short_title: finalTitle,
            category: finalCategory,
            full_message: params.fullMessage,
            status: 'unread',
            unread_count: 1,
            created_at: archived.created_at,
          },
        ],
        { onConflict: 'user_id,archive_id', ignoreDuplicates: true }
      )
    } else {
      const { data: members } = await supabase
        .from('alumni')
        .select('id')
        .eq('is_placeholder', false)

      if (members && members.length > 0) {
        const rows = members.map(m => ({
          user_id: m.id,
          archive_id: archived.id,
          short_title: finalTitle,
          category: finalCategory,
          full_message: params.fullMessage,
          status: 'unread',
          unread_count: 1,
          created_at: archived.created_at,
        }))
        await supabase
          .from('user_notifications')
          .upsert(rows, { onConflict: 'user_id,archive_id', ignoreDuplicates: true })
      }
    }
  }

  window.dispatchEvent(new Event('fenestrians-notifications-updated'))

  sendDevicePushNotification({
    shortTitle: finalTitle,
    fullMessage: params.fullMessage,
    targetUserIds: params.targetUserId ? [params.targetUserId] : undefined,
    launchUrl: 'https://fenestrians.salmaali.in/notifications',
  })
}

export async function archiveDailyCelebrationAlert(params: {
  category: 'birthday' | 'anniversary'
  shortTitle: string
  fullMessage: string
  dateKey: string
}): Promise<void> {
  const dayStartIso = `${params.dateKey}T00:00:00.000Z`

  const { data: existing } = await supabase
    .from('notifications_archive')
    .select('id')
    .eq('category', params.category)
    .eq('full_message', params.fullMessage)
    .gte('created_at', dayStartIso)
    .limit(1)

  if (existing && existing.length > 0) return

  await publishArchivedAlert({
    category: params.category,
    shortTitle: params.shortTitle,
    fullMessage: params.fullMessage,
  })
}
