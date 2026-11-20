import { useState, useEffect } from 'react'
import { useAuth } from '@/context/AuthContext'
import { supabase } from '@/lib/supabase'
import { hasAuditPreference, formatBytes } from '@/lib/fenestriansCore'
import { publishArchivedAlert } from '@/lib/notificationService'
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
} from 'lucide-react'

interface MissingFieldEntry {
  key: string
  userId: number
  memberName: string
  fieldKey: string
  label: string
}

export default function MaintenanceTab() {
  const { user, isAdmin } = useAuth()
  const [busyAction, setBusyAction] = useState<string | null>(null)
  const [statusMessage, setStatusMessage] = useState<string>('')
  const [staleGroups, setStaleGroups] = useState<Array<{ room_id: string; last_active: string }>>([])
  const [missingEntries, setMissingEntries] = useState<MissingFieldEntry[]>([])
  const [selectedMissingKeys, setSelectedMissingKeys] = useState<Record<string, boolean>>({})

  const userIsAdmin = Boolean(isAdmin || user?.is_admin)

  useEffect(() => {
    if (userIsAdmin) {
      scanMissingDetails()
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

  const scanMissingDetails = async () => {
    const [{ data: members }, { data: familyRows }] = await Promise.all([
      supabase.from('alumni').select('*').eq('is_placeholder', false),
      supabase.from('family_members').select('*'),
    ])

    const list: MissingFieldEntry[] = []
    const checkFields: Array<{ col: string; label: string }> = [
      { col: 'profile_picture_url', label: 'Profile Picture' },
      { col: 'dob', label: 'Date of Birth' },
      { col: 'blood_group', label: 'Blood Group' },
      { col: 'education_level', label: 'Education Level' },
      { col: 'contact_number', label: 'Contact Number' },
      { col: 'whatsapp_number', label: 'WhatsApp Number' },
      { col: 'current_address', label: 'Current Address' },
      { col: 'permanent_address', label: 'Permanent Address' },
      { col: 'current_status', label: 'Current Profession / Status' },
    ]

    for (const m of members ?? []) {
      for (const f of checkFields) {
        if (!m[f.col] || String(m[f.col]).trim() === '') {
          list.push({
            key: `member_${m.id}_${f.col}`,
            userId: m.id,
            memberName: m.full_name,
            fieldKey: f.col,
            label: `${f.label} (Own Profile)`,
          })
        }
      }
      if (m.marital_status?.toLowerCase() === 'married' && !m.wedding_date) {
        list.push({
          key: `member_${m.id}_wedding_date`,
          userId: m.id,
          memberName: m.full_name,
          fieldKey: 'wedding_date',
          label: 'Wedding Date (Own Profile)',
        })
      }
    }

    for (const fm of familyRows ?? []) {
      const owner = (members ?? []).find(m => m.id === fm.alumni_id)
      if (!owner) continue
      const famChecks: Array<{ col: string; label: string }> = [
        { col: 'relationship', label: `Relationship for ${fm.name}` },
        { col: 'gender', label: `Gender for ${fm.name}` },
        { col: 'dob', label: `Birthday for ${fm.name}` },
        { col: 'blood_group', label: `Blood Group for ${fm.name}` },
        { col: 'education_level', label: `Education Level for ${fm.name}` },
      ]
      for (const fc of famChecks) {
        if (!fm[fc.col] || String(fm[fc.col]).trim() === '') {
          list.push({
            key: `family_${fm.id}_${fc.col}`,
            userId: owner.id,
            memberName: owner.full_name,
            fieldKey: `family_${fm.id}_${fc.col}`,
            label: `${fc.label} (Family Profile)`,
          })
        }
      }
    }

    setMissingEntries(list)
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

  const runProfileAudits = async () => {
    setBusyAction('audit')
    setStatusMessage('')

    const [{ data: members }, { data: storageRows }, { data: familyRows }] = await Promise.all([
      supabase.from('alumni').select('*').eq('is_placeholder', false),
      supabase.from('admin_user_storage_summary').select('*'),
      supabase.from('family_members').select('*'),
    ])

    let tasksCreated = 0

    for (const m of members ?? []) {
      const issues: string[] = []

      if (!m.profile_picture_url) {
        const skipped = await hasAuditPreference(m.id, 'skip_missing_field', 'profile_picture_url')
        if (!skipped) {
          issues.push('• Missing Profile Picture')
        }
      }

      const fieldsToAudit = [
        { col: 'dob', name: 'Date of Birth' },
        { col: 'blood_group', name: 'Blood Group' },
        { col: 'education_level', name: 'Education Level' },
        { col: 'current_address', name: 'Current Address' },
      ]
      for (const f of fieldsToAudit) {
        if (!m[f.col] || String(m[f.col]).trim() === '') {
          const skipped = await hasAuditPreference(m.id, 'skip_missing_field', f.col)
          if (!skipped) {
            issues.push(`• Missing ${f.name}`)
          }
        }
      }

      if (
        m.contact_number &&
        m.whatsapp_number &&
        m.contact_number.replace(/\D/g, '') === m.whatsapp_number.replace(/\D/g, '')
      ) {
        const retained = await hasAuditPreference(m.id, 'retain_duplicate', 'duplicate_phone_numbers')
        if (!retained) {
          issues.push('• Duplicate entry: Contact Number and WhatsApp Number are identical')
        }
      }

      const myFamily = (familyRows ?? []).filter(fm => fm.alumni_id === m.id)
      const seenNames = new Set<string>()
      for (const fm of myFamily) {
        const lowerName = (fm.name || '').trim().toLowerCase()
        if (lowerName && seenNames.has(lowerName)) {
          const retained = await hasAuditPreference(m.id, 'retain_duplicate', `family_name_${lowerName}`)
          if (!retained) {
            issues.push(`• Duplicate family member entry: "${fm.name}" appears twice`)
          }
        }
        if (lowerName) seenNames.add(lowerName)
      }

      const st = (storageRows ?? []).find(s => s.user_id === m.id)
      if (st && Number(st.total_used_bytes) > Number(st.storage_quota_mb) * 1024 * 1024) {
        issues.push(
          `• Storage overrun: Using ${formatBytes(Number(st.total_used_bytes))} of ${st.storage_quota_mb} MB limit`
        )
      }

      if (issues.length > 0) {
        const summaryText = `Profile Audit found ${issues.length} item(s):\n${issues.join('\n')}`
        await supabase.from('member_tasks').insert([
          {
            assigned_to_user_id: m.id,
            assigned_by_user_id: user.id,
            task_type: 'profile_audit',
            title: 'Personal task alert: Profile Audit',
            description: summaryText,
            is_micromanaged: false,
            status: 'pending',
          },
        ])

        await publishArchivedAlert({
          category: 'personal_task',
          shortTitle: 'Personal task alert',
          fullMessage: summaryText,
          targetUserId: m.id,
        })
        tasksCreated += 1
      }
    }

    setBusyAction(null)
    setStatusMessage(`Profile Audit complete: Sent ${tasksCreated} personalized audit task(s).`)
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

  const handleSendBulkMissingTasks = async () => {
    const chosen = missingEntries.filter(e => selectedMissingKeys[e.key])
    if (chosen.length === 0) {
      alert('Select at least one missing detail checkbox first.')
      return
    }

    setBusyAction('tool9')
    const byUser = new Map<number, { memberName: string; items: MissingFieldEntry[] }>()
    for (const item of chosen) {
      if (!byUser.has(item.userId)) {
        byUser.set(item.userId, { memberName: item.memberName, items: [] })
      }
      byUser.get(item.userId)!.items.push(item)
    }

    for (const [targetUserId, group] of byUser.entries()) {
      const bulletList = group.items.map(i => `• ${i.label}`).join('\n')
      const message = `Admin Request: Please update the following missing detail(s) in your profile:\n${bulletList}`

      await supabase.from('member_tasks').insert([
        {
          assigned_to_user_id: targetUserId,
          assigned_by_user_id: user.id,
          task_type: 'admin_micromanaged',
          field_key: group.items.map(i => i.fieldKey).join(','),
          title: 'Personal task alert: Missing Profile Details',
          description: message,
          is_micromanaged: true,
          status: 'pending',
        },
      ])

      await publishArchivedAlert({
        category: 'personal_task',
        shortTitle: 'Personal task alert',
        fullMessage: message,
        targetUserId,
      })
    }

    setSelectedMissingKeys({})
    setBusyAction(null)
    setStatusMessage(`Sent ${byUser.size} bulk private task(s) for ${chosen.length} selected missing field(s).`)
  }

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
              disabled={busyAction === 'audit'}
              onClick={runProfileAudits}
              className="gold-gradient text-gold-foreground font-semibold gap-2"
            >
              <ClipboardCheck className="h-4 w-4" />
              {busyAction === 'audit' ? 'Running Profile Audits...' : 'Profile Audits'}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Run automated member audits (respecting members’ saved preferences for retained duplicates or intentionally blank fields) or execute system cleanup tasks below.
          </p>
          {statusMessage && (
            <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3.5 py-2 text-xs font-semibold text-emerald-300">
              {statusMessage}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Button
          type="button"
          variant="outline"
          title="Archive all chats and clear from all devices"
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
          title="Remove auto alerts from general chat window"
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
          title="Clear unused or closed audio/video rooms"
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
          title="Clear recorded meeting videos"
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
          title="Clear accessible folders and alert users with large files"
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
          title="Clear support requirements marked achieved"
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
          title="Clear completed tasks"
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
                    Last active: {new Date(g.last_active).toLocaleDateString('en-IN')}
                  </span>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="destructive"
                  title="Delete Inactive Private Group"
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

      <Card className="border-border/40 bg-card/70">
        <CardHeader className="pb-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="text-sm text-primary">
              9. Missing Member &amp; Family Details ({missingEntries.length})
            </CardTitle>
            <Button
              type="button"
              size="sm"
              title="Send Selected Bulk Tasks Privately"
              disabled={busyAction === 'tool9'}
              onClick={handleSendBulkMissingTasks}
              className="gold-gradient text-gold-foreground font-semibold gap-1.5 text-xs"
            >
              <Send className="h-3.5 w-3.5" />
              Send Selected Bulk Tasks
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-2 max-h-80 overflow-y-auto">
          {missingEntries.length === 0 ? (
            <p className="text-xs text-muted-foreground">All member and family profiles are complete.</p>
          ) : (
            missingEntries.map(entry => (
              <label
                key={entry.key}
                className="flex items-center gap-3 rounded-lg border border-border/30 bg-muted/15 px-3 py-2 text-xs cursor-pointer hover:bg-muted/25"
              >
                <input
                  type="checkbox"
                  checked={Boolean(selectedMissingKeys[entry.key])}
                  onChange={e =>
                    setSelectedMissingKeys(prev => ({
                      ...prev,
                      [entry.key]: e.target.checked,
                    }))
                  }
                  className="h-4 w-4 accent-amber-500"
                />
                <span className="font-bold text-primary">{entry.memberName}:</span>
                <span className="text-foreground/90">{entry.label}</span>
              </label>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  )
}
