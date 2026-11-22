import { supabase } from '@/lib/supabase'
import { cleanPhoneNumber } from '@/lib/formatters'
import type { AuditActionItem } from '@/lib/notificationService'

export interface TaskSubItem {
  id: string
  label: string
  fieldKey: string
  preferenceType: 'skip_missing_field' | 'retain_duplicate'
  completed: boolean
  optedOut: boolean
}

export interface InstantAuditOutcome {
  auditable: boolean
  passed: boolean
  reason?: string
}

export type OfficerPrefixMap = Map<number, string>

export async function resolveOfficerDisplayName(
  userId: number,
  fallbackName: string
): Promise<string> {
  const { data } = await supabase
    .from('alumni_committee')
    .select('role_title, member_name')
    .eq('alumni_id', userId)
    .order('display_order', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (data?.role_title && String(data.role_title).trim()) {
    const title = String(data.role_title).trim()
    const baseName = fallbackName.trim() || String(data.member_name || '').trim()
    if (baseName.toLowerCase().startsWith(title.toLowerCase())) {
      return baseName
    }
    return `${title} ${baseName}`
  }

  return fallbackName.trim()
}

export async function fetchOfficerNamePrefixMap(): Promise<OfficerPrefixMap> {
  const { data } = await supabase
    .from('alumni_committee')
    .select('alumni_id, role_title, member_name')
    .not('alumni_id', 'is', null)
    .order('display_order', { ascending: true })

  const prefixMap: OfficerPrefixMap = new Map()
  for (const row of data ?? []) {
    if (row.alumni_id && row.role_title && !prefixMap.has(Number(row.alumni_id))) {
      prefixMap.set(
        Number(row.alumni_id),
        `${String(row.role_title).trim()} ${String(row.member_name).trim()}`
      )
    }
  }
  return prefixMap
}

export async function checkIsPresidentOrGenSec(userId: number): Promise<{
  hasExecutiveAdmin: boolean
  officeTitle: string | null
}> {
  const { data } = await supabase
    .from('alumni_committee')
    .select('role_title')
    .eq('alumni_id', userId)

  for (const row of data ?? []) {
    const role = String(row.role_title || '').trim()
    const lower = role.toLowerCase()
    if (lower === 'president' || lower === 'general secretary') {
      return { hasExecutiveAdmin: true, officeTitle: role }
    }
  }
  return { hasExecutiveAdmin: false, officeTitle: null }
}

export async function auditSingleTaskField(
  userId: number,
  fieldKey: string
): Promise<InstantAuditOutcome> {
  const key = (fieldKey || '').trim()
  if (!key || key === 'general' || key === 'custom') {
    return { auditable: false, passed: true }
  }

  const { data: member } = await supabase
    .from('alumni')
    .select('*')
    .eq('id', userId)
    .maybeSingle()

  if (!member) {
    return { auditable: false, passed: true }
  }

  switch (key) {
    case 'profile_picture_url':
      return member.profile_picture_url && String(member.profile_picture_url).trim()
        ? { auditable: true, passed: true }
        : {
            auditable: true,
            passed: false,
            reason:
              'Your Profile Picture has not been uploaded yet. Go to Profile → Edit Profile → Profile Picture.',
          }

    case 'dob':
      return member.dob
        ? { auditable: true, passed: true }
        : {
            auditable: true,
            passed: false,
            reason: 'Your Date of Birth is still blank in Profile → Edit Profile → Basic Details.',
          }

    case 'blood_group':
      return member.blood_group && String(member.blood_group).trim()
        ? { auditable: true, passed: true }
        : {
            auditable: true,
            passed: false,
            reason: 'Your Blood Group is still blank in Profile → Edit Profile → Basic Details.',
          }

    case 'education_level':
      return member.education_level && String(member.education_level).trim()
        ? { auditable: true, passed: true }
        : {
            auditable: true,
            passed: false,
            reason:
              'Your Education Level is still empty in Profile → Edit Profile → Education & Career Status.',
          }

    case 'contact_number':
      return cleanPhoneNumber(member.contact_number)
        ? { auditable: true, passed: true }
        : {
            auditable: true,
            passed: false,
            reason: 'Your Contact Number is still empty in Profile → Edit Profile → Contact Info.',
          }

    case 'whatsapp_number':
      return cleanPhoneNumber(member.whatsapp_number)
        ? { auditable: true, passed: true }
        : {
            auditable: true,
            passed: false,
            reason: 'Your WhatsApp Number is still empty in Profile → Edit Profile → Contact Info.',
          }

    case 'current_status':
      return member.current_status && String(member.current_status).trim()
        ? { auditable: true, passed: true }
        : {
            auditable: true,
            passed: false,
            reason:
              'Your Current Career Status is not filled in Profile → Edit Profile → Education & Career Status.',
          }

    case 'permanent_address':
      return member.permanent_address && String(member.permanent_address).trim()
        ? { auditable: true, passed: true }
        : {
            auditable: true,
            passed: false,
            reason: 'Your Permanent Address is still blank in Profile → Edit Profile → Addresses.',
          }

    case 'current_address':
      return member.current_address && String(member.current_address).trim()
        ? { auditable: true, passed: true }
        : {
            auditable: true,
            passed: false,
            reason: 'Your Current Address is still blank in Profile → Edit Profile → Addresses.',
          }

    case 'wedding_date':
      if ((member.marital_status || '').toLowerCase() !== 'married') {
        return { auditable: true, passed: true }
      }
      return member.wedding_date
        ? { auditable: true, passed: true }
        : {
            auditable: true,
            passed: false,
            reason: 'Your Wedding Date is still empty in Profile → Edit Profile → Basic Details.',
          }

    case 'spouse_name':
      if ((member.marital_status || '').toLowerCase() !== 'married') {
        return { auditable: true, passed: true }
      }
      return member.spouse_name && String(member.spouse_name).trim()
        ? { auditable: true, passed: true }
        : {
            auditable: true,
            passed: false,
            reason: 'Spouse Name is still empty in Profile → Edit Profile → Basic Details.',
          }

    case 'spouse_dob':
      if ((member.marital_status || '').toLowerCase() !== 'married') {
        return { auditable: true, passed: true }
      }
      return member.spouse_dob
        ? { auditable: true, passed: true }
        : {
            auditable: true,
            passed: false,
            reason: 'Spouse Date of Birth is still empty in Profile → Edit Profile → Basic Details.',
          }

    case 'divorce_date':
      if ((member.marital_status || '').toLowerCase() !== 'divorced') {
        return { auditable: true, passed: true }
      }
      return member.divorce_date
        ? { auditable: true, passed: true }
        : {
            auditable: true,
            passed: false,
            reason: 'Divorce Date is still empty in Profile → Edit Profile → Basic Details.',
          }

    case 'duplicate_phone_numbers': {
      const c = cleanPhoneNumber(member.contact_number)
      const w = cleanPhoneNumber(member.whatsapp_number)
      return !c || !w || c !== w
        ? { auditable: true, passed: true }
        : {
            auditable: true,
            passed: false,
            reason: 'Your Contact Number and WhatsApp Number are still identical.',
          }
    }

    case 'family_details': {
      const { count } = await supabase
        .from('family_members')
        .select('id', { count: 'exact', head: true })
        .eq('alumni_id', userId)
      return (count || 0) > 0
        ? { auditable: true, passed: true }
        : {
            auditable: true,
            passed: false,
            reason: 'No family members have been added yet under Profile → Edit Profile → Family.',
          }
    }

    case 'storage_overrun': {
      const { data: st } = await supabase
        .from('admin_user_storage_summary')
        .select('total_used_bytes, storage_quota_mb')
        .eq('user_id', userId)
        .maybeSingle()
      if (!st) return { auditable: true, passed: true }
      const withinLimit = Number(st.total_used_bytes) <= Number(st.storage_quota_mb) * 1024 * 1024
      return withinLimit
        ? { auditable: true, passed: true }
        : {
            auditable: true,
            passed: false,
            reason: 'Your folder/gallery storage still exceeds your quota limit.',
          }
    }
  }

  const famFieldMatch = /^family_(\d+)_(dob|blood_group|education_level)$/.exec(key)
  if (famFieldMatch) {
    const famId = Number(famFieldMatch[1])
    const col = famFieldMatch[2]
    const { data: fm } = await supabase
      .from('family_members')
      .select('*')
      .eq('id', famId)
      .maybeSingle()

    if (!fm) return { auditable: true, passed: true }
    const val = fm[col]
    return val && String(val).trim()
      ? { auditable: true, passed: true }
      : {
          auditable: true,
          passed: false,
          reason: `The ${col.replace('_', ' ')} for ${fm.name} is still empty in Profile → Edit Profile → Family.`,
        }
  }

  if (key.startsWith('family_name_')) {
    const targetLower = key.replace('family_name_', '').trim().toLowerCase()
    const { data: famRows } = await supabase
      .from('family_members')
      .select('name')
      .eq('alumni_id', userId)
    const matches = (famRows ?? []).filter(
      r => (r.name || '').trim().toLowerCase() === targetLower
    )
    return matches.length <= 1
      ? { auditable: true, passed: true }
      : {
          auditable: true,
          passed: false,
          reason: `Duplicate family entry for "${targetLower}" still exists.`,
        }
  }

  return { auditable: false, passed: true }
}

export function buildSubItemsForTask(
  taskRow: any | null,
  metaAuditItems: AuditActionItem[] = [],
  fallbackMessage = ''
): TaskSubItem[] {
  if (taskRow && Array.isArray(taskRow.task_items_json) && taskRow.task_items_json.length > 0) {
    return taskRow.task_items_json.map((item: any, idx: number) => ({
      id: item.id || `item_${idx}`,
      label: String(item.label || ''),
      fieldKey: String(item.fieldKey || 'general'),
      preferenceType:
        item.preferenceType === 'retain_duplicate' ? 'retain_duplicate' : 'skip_missing_field',
      completed: Boolean(item.completed),
      optedOut: Boolean(item.optedOut),
    }))
  }

  if (metaAuditItems.length > 0) {
    return metaAuditItems.map((ai, idx) => ({
      id: `audit_${idx}_${ai.targetKey}`,
      label: ai.label,
      fieldKey: ai.targetKey || 'general',
      preferenceType: ai.preferenceType || 'skip_missing_field',
      completed: false,
      optedOut: false,
    }))
  }

  const rawText = String(taskRow?.description || fallbackMessage || '')
  const bulletLines = rawText
    .split('\n')
    .map(l => l.trim())
    .filter(l => l.startsWith('• '))
    .map(l => l.replace(/^•\s*/, '').trim())

  if (bulletLines.length > 0) {
    return bulletLines.map((line, idx) => ({
      id: `bullet_${idx}`,
      label: line,
      fieldKey: 'general',
      preferenceType: 'skip_missing_field',
      completed: false,
      optedOut: false,
    }))
  }

  return [
    {
      id: 'single_0',
      label: String(taskRow?.title || rawText || 'Complete assigned task'),
      fieldKey: String(taskRow?.field_key || 'general'),
      preferenceType: 'skip_missing_field',
      completed: false,
      optedOut: false,
    },
  ]
}
