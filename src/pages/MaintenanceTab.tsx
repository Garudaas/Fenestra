import { useState, useEffect, useMemo } from 'react'
import { useAuth } from '@/context/AuthContext'
import { supabase } from '@/lib/supabase'
import { formatBytes } from '@/lib/fenestriansCore'
import { cleanPhoneNumber, formatFullDate } from '@/lib/formatters'
import { resolveOfficerDisplayName, type TaskSubItem } from '@/lib/taskAuditService'
import { publishArchivedAlert, type AuditActionItem } from '@/lib/notificationService'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Wrench,
  ClipboardCheck,
  Archive,
  BellOff,
  Users,
  Video,
  Film,
  FolderX,
  HandHeart,
  CheckSquare,
  Send,
  Trash2,
  UserCheck,
} from 'lucide-react'

interface StagedAuditTask {
  id: number
  userId: number
  memberName: string
  fieldKey: string
  label: string
  preferenceType: 'skip_missing_field' | 'retain_duplicate'
  createdAt: string
}

interface MemberAuditGroup {
  userId: number
  memberName: string
  items: StagedAuditTask[]
}

function inferPreferenceType(fieldKey: string): 'skip_missing_field' | 'retain_duplicate' {
  if (fieldKey === 'duplicate_phone_numbers' || fieldKey.startsWith('family_name_')) {
    return 'retain_duplicate'
  }
  return 'skip_missing_field'
}

export default function MaintenanceTab() {
  const { user, isAdmin } = useAuth()
  const [busyAction, setBusyAction] = useState<string | null>(null)
  const [statusMessage, setStatusMessage] = useState<string>('')
  const [staleGroups, setStaleGroups] = useState<Array<{ room_id: string; last_active: string }>>([])
  const [unsentTasks, setUnsentTasks] = useState<StagedAuditTask[]>([])
  const [selectedTaskIds, setSelectedTaskIds] = useState<Record<number, boolean>>({})

  const userIsAdmin = Boolean(isAdmin || user?.is_admin)

  useEffect(() => {
    if (userIsAdmin) {
      loadUnsentAuditTasks()
      scanStalePrivateGroups()
    }
  }, [userIsAdmin])

  if (!user || !userIsAdmin) {
    return (
      <div className="mx-auto max-w-xl p-6 text-center text-sm text-destructive">
        Access restricted to administrators only.
      </div>
    )
  }

  const loadUnsentAuditTasks = async () => {
    const [{ data: stagedRows }, { data: members }, { data: prefs }] = await Promise.all([
      supabase
        .from('member_tasks')
        .select('*')
        .eq('task_type', 'audit_staging')
        .eq('status', 'unsent')
        .order('created_at', { ascending: true }),
      supabase
        .from('alumni')
        .select('id, full_name, is_placeholder')
        .eq('is_placeholder', false)
        .neq('full_name', 'System Administrator'),
      supabase.from('audit_preferences').select('user_id, preference_type, target_key'),
    ])

    const memberNameMap = new Map<number, string>()
    for (const m of members ?? []) {
      memberNameMap.set(m.id, m.full_name)
    }

    const ignoredSet = new Set<string>()
    for (const p of prefs ?? []) {
      ignoredSet.add(`${p.user_id}::${p.preference_type}::${p.target_key}`)
    }

    const validItems: StagedAuditTask[] = []
    const idsToDelete: number[] = []

    for (const row of stagedRows ?? []) {
      const uid = Number(row.assigned_to_user_id)
      const fKey = String(row.field_key || '')
      const prefType = inferPreferenceType(fKey)
      const memberName = memberNameMap.get(uid)

      if (!memberName || ignoredSet.has(`${uid}::${prefType}::${fKey}`)) {
        idsToDelete.push(row.id)
        continue
      }

      validItems.push({
        id: row.id,
        userId: uid,
        memberName,
        fieldKey: fKey,
        label: String(row.description || row.title || fKey),
        preferenceType: prefType,
        createdAt: row.created_at,
      })
    }

    if (idsToDelete.length > 0) {
      await supabase.from('member_tasks').delete().in('id', idsToDelete)
    }

    setUnsentTasks(validItems)
  }

  const runProfileAudits = async () => {
    setBusyAction('audit')
    setStatusMessage('')

    const [
      { data: members },
      { data: storageRows },
      { data: familyRows },
      { data: prefs },
      { data: existingUnsent },
    ] = await Promise.all([
      supabase
        .from('alumni')
        .select('*')
        .eq('is_placeholder', false)
        .neq('full_name', 'System Administrator')
        .order('full_name', { ascending: true }),
      supabase.from('admin_user_storage_summary').select('*'),
      supabase.from('family_members').select('*'),
      supabase.from('audit_preferences').select('user_id, preference_type, target_key'),
      supabase
        .from('member_tasks')
        .select('id, assigned_to_user_id, field_key')
        .eq('task_type', 'audit_staging')
        .eq('status', 'unsent'),
    ])

    const ignoredSet = new Set<string>()
    for (const p of prefs ?? []) {
      ignoredSet.add(`${p.user_id}::${p.preference_type}::${p.target_key}`)
    }

    const existingStagedMap = new Map<string, number[]>()
    for (const row of existingUnsent ?? []) {
      const key = `${row.assigned_to_user_id}::${row.field_key}`
      const arr = existingStagedMap.get(key) ?? []
      arr.push(row.id)
      existingStagedMap.set(key, arr)
    }

    const activeFindingKeys = new Set<string>()
    const toInsert: any[] = []
    const idsToReplaceOrPurge: number[] = []

    for (const m of members ?? []) {
      const addAuditPoint = (
        isIssue: boolean,
        fieldKey: string,
        label: string,
        preferenceType: 'skip_missing_field' | 'retain_duplicate' = 'skip_missing_field'
      ) => {
        const composite = `${m.id}::${fieldKey}`
        const isIgnoredByMember = ignoredSet.has(`${m.id}::${preferenceType}::${fieldKey}`)

        if (!isIssue || isIgnoredByMember) {
          const staleIds = existingStagedMap.get(composite)
          if (staleIds && staleIds.length > 0) {
            idsToReplaceOrPurge.push(...staleIds)
          }
          return
        }

        activeFindingKeys.add(composite)

        const oldIds = existingStagedMap.get(composite)
        if (oldIds && oldIds.length > 0) {
          idsToReplaceOrPurge.push(...oldIds)
        }

        toInsert.push({
          assigned_to_user_id: m.id,
          assigned_by_user_id: user.id,
          task_type: 'audit_staging',
          field_key: fieldKey,
          title: `Missing / Audit Detail: ${label}`,
          description: label,
          is_micromanaged: false,
          status: 'unsent',
        })
      }

      addAuditPoint(!m.profile_picture_url, 'profile_picture_url', 'Profile Picture')
      addAuditPoint(!m.dob, 'dob', 'Date of Birth')
      addAuditPoint(!m.blood_group || !String(m.blood_group).trim(), 'blood_group', 'Blood Group')
      addAuditPoint(
        !m.education_level || !String(m.education_level).trim(),
        'education_level',
        'Education Level'
      )
      addAuditPoint(!cleanPhoneNumber(m.contact_number), 'contact_number', 'Contact Number')
      addAuditPoint(!cleanPhoneNumber(m.whatsapp_number), 'whatsapp_number', 'WhatsApp Number')
      addAuditPoint(
        !m.current_status || !String(m.current_status).trim(),
        'current_status',
        'Current Career Status / Profession'
      )
      addAuditPoint(
        !m.permanent_address || !String(m.permanent_address).trim(),
        'permanent_address',
        'Permanent Address'
      )
      addAuditPoint(
        !m.current_address || !String(m.current_address).trim(),
        'current_address',
        'Current Address'
      )

      const maritalLower = (m.marital_status || '').trim().toLowerCase()
      if (maritalLower === 'married') {
        addAuditPoint(!m.wedding_date, 'wedding_date', 'Wedding Date')
        addAuditPoint(!m.spouse_name || !String(m.spouse_name).trim(), 'spouse_name', 'Spouse Name')
        addAuditPoint(!m.spouse_dob, 'spouse_dob', 'Spouse Date of Birth')
      } else if (maritalLower === 'divorced') {
        addAuditPoint(!m.divorce_date, 'divorce_date', 'Divorce Date')
      }

      const cleanC = cleanPhoneNumber(m.contact_number)
      const cleanW = cleanPhoneNumber(m.whatsapp_number)
      addAuditPoint(
        Boolean(cleanC && cleanW && cleanC === cleanW),
        'duplicate_phone_numbers',
        'Duplicate entry: Contact Number and WhatsApp Number are identical',
        'retain_duplicate'
      )

      const myFamily = (familyRows ?? []).filter(fm => fm.alumni_id === m.id)
      addAuditPoint(myFamily.length === 0, 'family_details', 'Family Details')

      const seenNames = new Set<string>()
      for (const fm of myFamily) {
        const lowerName = (fm.name || '').trim().toLowerCase()
        if (lowerName) {
          addAuditPoint(
            seenNames.has(lowerName),
            `family_name_${lowerName}`,
            `Duplicate family member entry: "${fm.name}" appears twice`,
            'retain_duplicate'
          )
          seenNames.add(lowerName)
        }

        addAuditPoint(
          !fm.dob,
          `family_${fm.id}_dob`,
          `Date of Birth for ${fm.name} (${fm.relationship || 'Family'})`
        )
        addAuditPoint(
          !fm.blood_group || !String(fm.blood_group).trim(),
          `family_${fm.id}_blood_group`,
          `Blood Group for ${fm.name} (${fm.relationship || 'Family'})`
        )
        addAuditPoint(
          !fm.education_level || !String(fm.education_level).trim(),
          `family_${fm.id}_education_level`,
          `Education Level for ${fm.name} (${fm.relationship || 'Family'})`
        )
      }

      const st = (storageRows ?? []).find(s => s.user_id === m.id)
      const isOverQuota = Boolean(
        st && Number(st.total_used_bytes) > Number(st.storage_quota_mb) * 1024 * 1024
      )
      addAuditPoint(
        isOverQuota,
        'storage_overrun',
        st
          ? `Storage limit exceeded: Using ${formatBytes(Number(st.total_used_bytes))} of ${st.storage_quota_mb} MB`
          : 'Storage limit exceeded'
      )
    }

    for (const [composite, ids] of existingStagedMap.entries()) {
      if (!activeFindingKeys.has(composite)) {
        idsToReplaceOrPurge.push(...ids)
      }
    }

    const uniqueDeleteIds = Array.from(new Set(idsToReplaceOrPurge))
    if (uniqueDeleteIds.length > 0) {
      await supabase.from('member_tasks').delete().in('id', uniqueDeleteIds)
    }

    if (toInsert.length > 0) {
      await supabase.from('member_tasks').insert(toInsert)
    }

    setSelectedTaskIds({})
    await loadUnsentAuditTasks()
    setBusyAction(null)
    setStatusMessage(
      `Profile Audit complete: ${toInsert.length} unsent audit point(s) staged below for your review.`
    )
  }

  const groupedByMember = useMemo<MemberAuditGroup[]>(() => {
    const map = new Map<number, MemberAuditGroup>()
    for (const item of unsentTasks) {
      if (!map.has(item.userId)) {
        map.set(item.userId, {
          userId: item.userId,
          memberName: item.memberName,
          items: [],
        })
      }
      map.get(item.userId)!.items.push(item)
    }
    return Array.from(map.values()).sort((a, b) => a.memberName.localeCompare(b.memberName))
  }, [unsentTasks])

  const toggleMemberAll = (group: MemberAuditGroup, checked: boolean) => {
    setSelectedTaskIds(prev => {
      const next = { ...prev }
      for (const item of group.items) {
        next[item.id] = checked
      }
      return next
    })
  }

  const sendTasksForItems = async (chosenItems: StagedAuditTask[]) => {
    if (chosenItems.length === 0) {
      alert('Please select at least one audit point to send.')
      return
    }

    setBusyAction('send_tasks')
    const senderTitledName = await resolveOfficerDisplayName(user.id, user.full_name)

    const byMember = new Map<number, { memberName: string; items: StagedAuditTask[] }>()
    for (const item of chosenItems) {
      if (!byMember.has(item.userId)) {
        byMember.set(item.userId, { memberName: item.memberName, items: [] })
      }
      byMember.get(item.userId)!.items.push(item)
    }

    for (const [targetUserId, group] of byMember.entries()) {
      const bulletList = group.items.map(i => `• ${i.label}`).join('\n')
      const formattedMessage = `${senderTitledName} has requested you to complete the below details in your profile in the Fenestrians App:\n\n${bulletList}`

      const auditActionItems: AuditActionItem[] = group.items.map(i => ({
        label: i.label,
        preferenceType: i.preferenceType,
        targetKey: i.fieldKey,
      }))

      const subItems: TaskSubItem[] = group.items.map((i, idx) => ({
        id: `audit_${idx}_${i.fieldKey}`,
        label: i.label,
        fieldKey: i.fieldKey,
        preferenceType: i.preferenceType,
        completed: false,
        optedOut: false,
      }))

      const { data: createdTask } = await supabase
        .from('member_tasks')
        .insert([
          {
            assigned_to_user_id: targetUserId,
            assigned_by_user_id: user.id,
            task_type: 'admin_profile_audit',
            field_key: group.items.map(i => i.fieldKey).join(','),
            title: `Profile Completion Request from ${senderTitledName}`,
            description: formattedMessage,
            is_micromanaged: false,
            status: 'pending',
            is_private: true,
            sender_display_name: senderTitledName,
            task_items_json: subItems,
          },
        ])
        .select('id')
        .single()

      await publishArchivedAlert({
        category: 'personal_task',
        shortTitle: 'Personal task alert',
        fullMessage: formattedMessage,
        targetUserId,
        metadata: {
          task_id: createdTask?.id,
          is_micromanaged: false,
          audit_items: auditActionItems,
        },
      })
    }

    const sentStagingIds = chosenItems.map(i => i.id)
    await supabase.from('member_tasks').delete().in('id', sentStagingIds)

    setSelectedTaskIds(prev => {
      const next = { ...prev }
      for (const id of sentStagingIds) delete next[id]
      return next
    })

    await loadUnsentAuditTasks()
    setBusyAction(null)
    setStatusMessage(
      `Sent profile completion alert(s) to ${byMember.size} member(s) for ${chosenItems.length} item(s).`
    )
  }

  const deleteStagedItems = async (itemsToDelete: StagedAuditTask[]) => {
    if (itemsToDelete.length === 0) return
    if (
      !window.confirm(
        `Delete ${itemsToDelete.length} unsent audit item(s) so they will not be sent?`
      )
    ) {
      return
    }

    setBusyAction('delete_staged')
    const ids = itemsToDelete.map(i => i.id)
    await supabase.from('member_tasks').delete().in('id', ids)

    setSelectedTaskIds(prev => {
      const next = { ...prev }
      for (const id of ids) delete next[id]
      return next
    })

    await loadUnsentAuditTasks()
    setBusyAction(null)
    setStatusMessage(`Removed ${ids.length} unsent audit item(s).`)
  }

  const scanStalePrivateGroups = async () => {
    const cutoffIso = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
    const { data: msgs } = await supabase
      .from('chat_messages')
      .select('room_id, created_at')
      .neq('room_id', 'global')
      .order('created_at', { ascending: false })

    const latestByRoom = new Map<string, string>()
    for (const msg of msgs ?? []) {
      if (!latestByRoom.has(msg.room_id)) {
        latestByRoom.set(msg.room_id, msg.created_at)
      }
    }

    const stale: Array<{ room_id: string; last_active: string }> = []
    for (const [roomId, lastActive] of latestByRoom.entries()) {
      if (lastActive < cutoffIso) {
        stale.push({ room_id: roomId, last_active: lastActive })
      }
    }
    setStaleGroups(stale)
  }

  const handleArchiveAndClearChats = async () => {
    if (!window.confirm('Archive all chats and clear chat history from all devices?')) return
    setBusyAction('tool1')
    const { data: allMsgs } = await supabase.from('chat_messages').select('*')
    if (allMsgs && allMsgs.length > 0) {
      await supabase.from('chat_archives').insert([{ archived_by: user.id, messages_json: allMsgs }])
      await supabase.from('chat_messages').delete().neq('id', 0)
    }
    setBusyAction(null)
    setStatusMessage(`Archived ${allMsgs?.length ?? 0} chat message(s) and cleared all chat windows.`)
  }

  const handleRemoveGeneralAutoAlerts = async () => {
    setBusyAction('tool2')
    const { data: autoRows } = await supabase
      .from('chat_messages')
      .select('id')
      .eq('room_id', 'global')
      .like('message_text', '[AUTO-ALERT:%')

    if (autoRows && autoRows.length > 0) {
      await supabase
        .from('chat_messages')
        .delete()
        .in('id', autoRows.map(r => r.id))
    }
    setBusyAction(null)
    setStatusMessage(`Removed ${autoRows?.length ?? 0} auto-alert message(s) from general chat.`)
  }

  const handleDeleteStaleGroup = async (roomId: string) => {
    if (!window.confirm(`Delete private group "${roomId}" (inactive for over 30 days)?`)) return
    setBusyAction('tool3')
    await supabase.from('chat_messages').delete().eq('room_id', roomId)
    await scanStalePrivateGroups()
    setBusyAction(null)
    setStatusMessage(`Deleted inactive private group "${roomId}".`)
  }

  const handleClearUnusedAVRooms = async () => {
    setBusyAction('tool4')
    await supabase.from('user_notifications').delete().in('category', ['group_call', 'video_call'])
    setBusyAction(null)
    setStatusMessage('Cleared inactive and ended audio/video call room alerts.')
  }

  const handleClearMeetingVideos = async () => {
    if (!window.confirm('Delete all recorded meeting videos from storage?')) return
    setBusyAction('tool5')
    const { data: vids } = await supabase.from('meeting_recordings').select('id, storage_path')
    if (vids && vids.length > 0) {
      await supabase.storage
        .from('fenestrians-media')
        .remove(vids.map(v => v.storage_path).filter(Boolean))
      await supabase.from('meeting_recordings').delete().neq('id', 0)
    }
    setBusyAction(null)
    setStatusMessage(`Cleared ${vids?.length ?? 0} meeting video recording(s).`)
  }

  const handleClearPrivateFolders = async () => {
    if (!window.confirm('Delete accessible folder files and send alerts to members with large or private files?')) {
      return
    }
    setBusyAction('tool6')
    const { data: allFiles } = await supabase
      .from('member_media_files')
      .select('*')
      .eq('is_profile_picture', false)

    const accessible = (allFiles ?? []).filter(f => !f.is_private)
    if (accessible.length > 0) {
      await supabase.storage
        .from('fenestrians-media')
        .remove(accessible.map(f => f.storage_path).filter(Boolean))
      await supabase
        .from('member_media_files')
        .delete()
        .in('id', accessible.map(f => f.id))
    }

    const { data: summaries } = await supabase.from('admin_user_storage_summary').select('*')
    let alertedCount = 0
    for (const s of summaries ?? []) {
      if (Number(s.private_used_bytes) > 0 || Number(s.total_used_bytes) > 25 * 1024 * 1024) {
        await publishArchivedAlert({
          category: 'personal_task',
          shortTitle: 'Personal task alert',
          fullMessage: `Admin Maintenance Notice: Please review your private folder (${formatBytes(Number(s.total_used_bytes))} used) and remove any large files you no longer need.`,
          targetUserId: s.user_id,
        })
        alertedCount += 1
      }
    }

    setBusyAction(null)
    setStatusMessage(
      `Deleted ${accessible.length} accessible folder file(s) and sent cleanup alerts to ${alertedCount} member(s).`
    )
  }

  const handleClearAchievedSupport = async () => {
    setBusyAction('tool7')
    const { data: doneRows } = await supabase
      .from('family_support_requests')
      .select('id')
      .eq('status', 'achieved')

    if (doneRows && doneRows.length > 0) {
      await supabase
        .from('family_support_requests')
        .delete()
        .in('id', doneRows.map(r => r.id))
    }
    setBusyAction(null)
    setStatusMessage(`Cleared ${doneRows?.length ?? 0} achieved family support request(s).`)
  }

  const handleClearCompletedTasks = async () => {
    setBusyAction('tool8')
    const [{ data: doneMemberTasks }, { data: doneCalTasks }] = await Promise.all([
      supabase.from('member_tasks').select('id').eq('status', 'completed'),
      supabase.from('tasks').select('id').eq('is_completed', true),
    ])

    if (doneMemberTasks && doneMemberTasks.length > 0) {
      await supabase.from('member_tasks').delete().in('id', doneMemberTasks.map(t => t.id))
    }
    if (doneCalTasks && doneCalTasks.length > 0) {
      await supabase.from('tasks').delete().in('id', doneCalTasks.map(t => t.id))
    }

    const totalCleared = (doneMemberTasks?.length ?? 0) + (doneCalTasks?.length ?? 0)
    setBusyAction(null)
    setStatusMessage(`Cleared ${totalCleared} completed task(s).`)
  }

  const allChosenItems = unsentTasks.filter(t => selectedTaskIds[t.id])

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <Card className="border-primary/40 bg-card/75 backdrop-blur-sm">
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle className="flex items-center gap-2 text-primary">
              <Wrench className="h-5 w-5" />
              Admin Maintenance &amp; Audits
            </CardTitle>
            <Button
              type="button"
              title="Run Profile Audits for All Members"
              disabled={busyAction !== null}
              onClick={runProfileAudits}
              className="gold-gradient text-gold-foreground font-semibold gap-2"
            >
              <ClipboardCheck className="h-4 w-4" />
              {busyAction === 'audit' ? 'Scanning Profiles...' : 'Profile Audits'}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Click <strong>Profile Audits</strong> to scan member &amp; family profiles. Audit points are grouped under each member below so you can review, delete unneeded items, or send selected reminders.
          </p>
          {statusMessage && (
            <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3.5 py-2 text-xs font-semibold text-emerald-300">
              {statusMessage}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-primary/30 bg-card/75">
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="flex items-center gap-2 text-sm text-primary">
              <UserCheck className="h-4 w-4" />
              Unsent Profile Audit Tasks ({unsentTasks.length} item{unsentTasks.length === 1 ? '' : 's'} across{' '}
              {groupedByMember.length} member{groupedByMember.length === 1 ? '' : 's'})
            </CardTitle>

            {allChosenItems.length > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="destructive"
                  disabled={busyAction !== null}
                  onClick={() => deleteStagedItems(allChosenItems)}
                  className="h-8 gap-1.5 text-xs"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Delete Selected ({allChosenItems.length})
                </Button>
                <Button
                  type="button"
                  size="sm"
                  disabled={busyAction !== null}
                  onClick={() => sendTasksForItems(allChosenItems)}
                  className="h-8 gold-gradient text-gold-foreground font-semibold gap-1.5 text-xs"
                >
                  <Send className="h-3.5 w-3.5" />
                  Send Selected ({allChosenItems.length})
                </Button>
              </div>
            )}
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {groupedByMember.length === 0 ? (
            <p className="rounded-xl border border-border/30 bg-muted/15 p-6 text-center text-xs text-muted-foreground">
              No unsent audit tasks pending review. Click <strong>Profile Audits</strong> above to scan all member profiles.
            </p>
          ) : (
            groupedByMember.map(group => {
              const memberSelectedItems = group.items.filter(i => selectedTaskIds[i.id])
              const allMemberChecked =
                group.items.length > 0 && memberSelectedItems.length === group.items.length

              return (
                <div
                  key={group.userId}
                  className="rounded-xl border border-border/40 bg-muted/15 p-3.5 space-y-2.5"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/30 pb-2">
                    <label className="flex items-center gap-2.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={allMemberChecked}
                        onChange={e => toggleMemberAll(group, e.target.checked)}
                        className="h-4 w-4 accent-amber-500"
                      />
                      <span className="text-sm font-bold text-primary">{group.memberName}</span>
                      <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[11px] font-semibold text-primary">
                        {group.items.length} item{group.items.length === 1 ? '' : 's'}
                      </span>
                    </label>

                    <div className="flex items-center gap-2">
                      {memberSelectedItems.length > 0 && (
                        <Button
                          type="button"
                          size="sm"
                          disabled={busyAction !== null}
                          onClick={() => sendTasksForItems(memberSelectedItems)}
                          className="h-7 gold-gradient text-gold-foreground font-semibold gap-1 text-[11px]"
                        >
                          <Send className="h-3 w-3" />
                          Send ({memberSelectedItems.length}) to {group.memberName.split(' ')[0]}
                        </Button>
                      )}
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        title={`Delete all unsent audit items for ${group.memberName}`}
                        disabled={busyAction !== null}
                        onClick={() => deleteStagedItems(group.items)}
                        className="h-7 px-2 text-[11px] text-destructive hover:bg-destructive/10 gap-1"
                      >
                        <Trash2 className="h-3 w-3" />
                        Clear Member
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-1.5 pl-1">
                    {group.items.map(item => (
                      <div
                        key={item.id}
                        className="flex items-center justify-between gap-2 rounded-lg border border-border/30 bg-background/60 px-3 py-2 text-xs hover:border-primary/30"
                      >
                        <label className="flex items-center gap-2.5 flex-1 min-w-0 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={Boolean(selectedTaskIds[item.id])}
                            onChange={e =>
                              setSelectedTaskIds(prev => ({
                                ...prev,
                                [item.id]: e.target.checked,
                              }))
                            }
                            className="h-4 w-4 accent-amber-500 shrink-0"
                          />
                          <span className="text-foreground/95 truncate">{item.label}</span>
                        </label>

                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          title="Delete this audit item if it need not be sent"
                          disabled={busyAction !== null}
                          onClick={() => deleteStagedItems([item])}
                          className="h-7 w-7 text-destructive hover:bg-destructive/10 shrink-0"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })
          )}
        </CardContent>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Button
          type="button"
          variant="outline"
          disabled={busyAction !== null}
          onClick={handleArchiveAndClearChats}
          className="h-auto justify-start gap-2.5 p-3.5 text-left text-xs font-semibold"
        >
          <Archive className="h-4 w-4 text-primary shrink-0" />
          <span>1. Archive &amp; Clear All Chats</span>
        </Button>

        <Button
          type="button"
          variant="outline"
          disabled={busyAction !== null}
          onClick={handleRemoveGeneralAutoAlerts}
          className="h-auto justify-start gap-2.5 p-3.5 text-left text-xs font-semibold"
        >
          <BellOff className="h-4 w-4 text-amber-400 shrink-0" />
          <span>2. Remove General Auto Alerts</span>
        </Button>

        <Button
          type="button"
          variant="outline"
          disabled={busyAction !== null}
          onClick={handleClearUnusedAVRooms}
          className="h-auto justify-start gap-2.5 p-3.5 text-left text-xs font-semibold"
        >
          <Video className="h-4 w-4 text-purple-400 shrink-0" />
          <span>4. Clear Audio/Video Rooms</span>
        </Button>

        <Button
          type="button"
          variant="outline"
          disabled={busyAction !== null}
          onClick={handleClearMeetingVideos}
          className="h-auto justify-start gap-2.5 p-3.5 text-left text-xs font-semibold"
        >
          <Film className="h-4 w-4 text-rose-400 shrink-0" />
          <span>5. Clear Meeting Videos</span>
        </Button>

        <Button
          type="button"
          variant="outline"
          disabled={busyAction !== null}
          onClick={handleClearPrivateFolders}
          className="h-auto justify-start gap-2.5 p-3.5 text-left text-xs font-semibold"
        >
          <FolderX className="h-4 w-4 text-red-400 shrink-0" />
          <span>6. Clear Folders &amp; Alert Large Files</span>
        </Button>

        <Button
          type="button"
          variant="outline"
          disabled={busyAction !== null}
          onClick={handleClearAchievedSupport}
          className="h-auto justify-start gap-2.5 p-3.5 text-left text-xs font-semibold"
        >
          <HandHeart className="h-4 w-4 text-emerald-400 shrink-0" />
          <span>7. Clear Achieved Support</span>
        </Button>

        <Button
          type="button"
          variant="outline"
          disabled={busyAction !== null}
          onClick={handleClearCompletedTasks}
          className="h-auto justify-start gap-2.5 p-3.5 text-left text-xs font-semibold"
        >
          <CheckSquare className="h-4 w-4 text-sky-400 shrink-0" />
          <span>8. Clear Completed Tasks</span>
        </Button>
      </div>

      <Card className="border-border/40 bg-card/70">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm text-primary">
            <Users className="h-4 w-4" />
            3. Private Groups Inactive for Over 1 Month ({staleGroups.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {staleGroups.length === 0 ? (
            <p className="text-xs text-muted-foreground">No private chat groups inactive for over 30 days.</p>
          ) : (
            staleGroups.map(g => (
              <div
                key={g.room_id}
                className="flex items-center justify-between rounded-lg border border-border/30 bg-muted/20 px-3 py-2 text-xs"
              >
                <div>
                  <span className="font-bold text-foreground">{g.room_id}</span>
                  <span className="ml-2 text-muted-foreground">
                    Last active: {formatFullDate(g.last_active)}
                  </span>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="destructive"
                  onClick={() => handleDeleteStaleGroup(g.room_id)}
                  className="h-7 gap-1 text-xs"
                >
                  <Trash2 className="h-3 w-3" />
                  Delete Group
                </Button>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  )
}
