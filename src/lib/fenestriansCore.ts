import { supabase } from '@/lib/supabase'

export const COMMON_BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']

export const EDUCATION_LEVELS = [
  'High School',
  'Diploma',
  'Bachelor’s Degree',
  'Master’s Degree',
  'Doctorate (PhD)',
  'Professional Certification',
  'Other',
]

export const FAMILY_RELATIONSHIPS = [
  'Spouse',
  'Son',
  'Daughter',
  'Father',
  'Mother',
  'Brother',
  'Sister',
  'Other',
]

/**
 * Returns the opposite gender by default when adding a Spouse.
 */
export function getDefaultSpouseGender(memberGender?: string | null): string {
  if (!memberGender) return ''
  const g = memberGender.trim().toLowerCase()
  if (g === 'male') return 'Female'
  if (g === 'female') return 'Male'
  return ''
}

function getOrdinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return n + (s[(v - 20) % 10] || s[v] || s[0])
}

/**
 * Formats spouse or child birthdays with exact gender-aware wording:
 * e.g. "40th Birthday: Mrs. Priya (Wife of Balaji)"
 *      "19th Birthday: Shashwanth (Son of Balaji)"
 *      Falls back to "Spouse of Balaji" / "Child of Balaji" when gender is not specified.
 */
export function formatFamilyBirthdayLabel(params: {
  personName: string
  dob?: string | null
  relationship: 'spouse' | 'child' | string
  personGender?: string | null
  memberName: string
  referenceYear?: number
}): string {
  const year = params.referenceYear ?? new Date().getFullYear()
  let agePrefix = 'Birthday'

  if (params.dob && params.dob.length >= 4) {
    const birthYear = parseInt(params.dob.slice(0, 4), 10)
    if (!Number.isNaN(birthYear) && year > birthYear) {
      agePrefix = `${getOrdinal(year - birthYear)} Birthday`
    }
  }

  const rel = params.relationship.trim().toLowerCase()
  const gender = (params.personGender || '').trim().toLowerCase()

  if (rel === 'spouse') {
    if (gender === 'female') {
      return `${agePrefix}: Mrs. ${params.personName} (Wife of ${params.memberName})`
    }
    if (gender === 'male') {
      return `${agePrefix}: Mr. ${params.personName} (Husband of ${params.memberName})`
    }
    return `${agePrefix}: ${params.personName} (Spouse of ${params.memberName})`
  }

  if (rel === 'child' || rel === 'son' || rel === 'daughter') {
    if (gender === 'male' || rel === 'son') {
      return `${agePrefix}: ${params.personName} (Son of ${params.memberName})`
    }
    if (gender === 'female' || rel === 'daughter') {
      return `${agePrefix}: ${params.personName} (Daughter of ${params.memberName})`
    }
    return `${agePrefix}: ${params.personName} (Child of ${params.memberName})`
  }

  return `${agePrefix}: ${params.personName} (${params.relationship} of ${params.memberName})`
}

/**
 * Fetches common blood groups merged with valid custom blood groups from the database.
 */
export async function fetchAllBloodGroups(): Promise<string[]> {
  const { data } = await supabase
    .from('custom_blood_groups')
    .select('blood_group')
    .order('blood_group', { ascending: true })

  const customList = (data ?? []).map(r => r.blood_group.trim()).filter(Boolean)
  const merged = [...COMMON_BLOOD_GROUPS]

  for (const bg of customList) {
    if (!merged.some(existing => existing.toLowerCase() === bg.toLowerCase())) {
      merged.push(bg)
    }
  }
  return merged
}

/**
 * Saves a member's blood group. If they typed a custom blood group earlier and now edit it
 * (fixing a typo), removes the old custom blood group from the dropdown if unused by others.
 */
export async function syncCustomBloodGroupOnChange(params: {
  userId: number
  newBloodGroup: string
  previousBloodGroup?: string | null
}): Promise<void> {
  const nextBg = params.newBloodGroup.trim()
  const prevBg = (params.previousBloodGroup || '').trim()

  // 1. Clean up old custom blood group if user edited it away
  if (
    prevBg &&
    prevBg.toLowerCase() !== nextBg.toLowerCase() &&
    !COMMON_BLOOD_GROUPS.some(c => c.toLowerCase() === prevBg.toLowerCase())
  ) {
    const [{ count: alumniCount }, { count: familyCount }] = await Promise.all([
      supabase
        .from('alumni')
        .select('id', { count: 'exact', head: true })
        .ilike('blood_group', prevBg)
        .neq('id', params.userId),
      supabase
        .from('family_members')
        .select('id', { count: 'exact', head: true })
        .ilike('blood_group', prevBg),
    ])

    if ((alumniCount ?? 0) === 0 && (familyCount ?? 0) === 0) {
      await supabase
        .from('custom_blood_groups')
        .delete()
        .ilike('blood_group', prevBg)
    }
  }

  // 2. Add new custom blood group if not in standard list
  if (
    nextBg &&
    !COMMON_BLOOD_GROUPS.some(c => c.toLowerCase() === nextBg.toLowerCase())
  ) {
    await supabase.from('custom_blood_groups').upsert(
      [
        {
          blood_group: nextBg,
          created_by_user_id: params.userId,
        },
      ],
      { onConflict: 'blood_group', ignoreDuplicates: true }
    )
  }
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
}

export async function getUserStorageUsage(userId: number): Promise<{
  usedBytes: number
  quotaBytes: number
  quotaMb: number
}> {
  const [{ data: member }, { data: files }] = await Promise.all([
    supabase.from('alumni').select('storage_quota_mb').eq('id', userId).maybeSingle(),
    supabase.from('member_media_files').select('file_size_bytes').eq('owner_id', userId),
  ])

  const quotaMb = member?.storage_quota_mb ?? 100
  const usedBytes = (files ?? []).reduce((sum, f) => sum + Number(f.file_size_bytes || 0), 0)
  return {
    usedBytes,
    quotaBytes: quotaMb * 1024 * 1024,
    quotaMb,
  }
}

/**
 * Uploads a file or media item into the user's personal archive after verifying storage quota.
 */
export async function uploadMemberArchiveFile(params: {
  ownerId: number
  ownerName: string
  folderCategory: 'gallery' | 'folder'
  file: File
  isPrivate: boolean
  isProfilePicture?: boolean
}): Promise<{ success: boolean; error?: string; publicUrl?: string }> {
  const { usedBytes, quotaBytes, quotaMb } = await getUserStorageUsage(params.ownerId)

  if (usedBytes + params.file.size > quotaBytes) {
    return {
      success: false,
      error: `Storage space exceeded (${formatBytes(usedBytes)} used of ${quotaMb} MB limit). Further media/file sharing is not allowed until you delete older files.`,
    }
  }

  const safeName = params.file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
  const storagePath = `member_${params.ownerId}/${params.folderCategory}/${Date.now()}_${safeName}`

  const { error: uploadErr } = await supabase.storage
    .from('fenestrians-media')
    .upload(storagePath, params.file, { upsert: false })

  if (uploadErr) {
    return { success: false, error: uploadErr.message }
  }

  const { data: urlData } = supabase.storage
    .from('fenestrians-media')
    .getPublicUrl(storagePath)

  const { error: dbErr } = await supabase.from('member_media_files').insert([
    {
      owner_id: params.ownerId,
      owner_name: params.ownerName,
      folder_category: params.folderCategory,
      file_name: params.file.name,
      file_url: urlData.publicUrl,
      storage_path: storagePath,
      mime_type: params.file.type || 'application/octet-stream',
      file_size_bytes: params.file.size,
      is_private: params.isPrivate,
      is_profile_picture: Boolean(params.isProfilePicture),
    },
  ])

  if (dbErr) {
    return { success: false, error: dbErr.message }
  }

  return { success: true, publicUrl: urlData.publicUrl }
}

/**
 * Deletes an archive file (blocks deletion of profile pictures as required).
 */
export async function deleteMemberArchiveFile(fileId: number): Promise<{ success: boolean; error?: string }> {
  const { data: item } = await supabase
    .from('member_media_files')
    .select('id, storage_path, is_profile_picture')
    .eq('id', fileId)
    .maybeSingle()

  if (!item) return { success: false, error: 'File not found.' }
  if (item.is_profile_picture) {
    return {
      success: false,
      error: 'Profile pictures cannot be deleted. A member can only update their profile picture.',
    }
  }

  await supabase.storage.from('fenestrians-media').remove([item.storage_path])
  await supabase.from('member_media_files').delete().eq('id', fileId)
  return { success: true }
}

/**
 * Checks if a user has already opted to retain a duplicate or leave a field blank.
 */
export async function hasAuditPreference(
  userId: number,
  preferenceType: 'retain_duplicate' | 'skip_missing_field',
  targetKey: string
): Promise<boolean> {
  const { count } = await supabase
    .from('audit_preferences')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('preference_type', preferenceType)
    .eq('target_key', targetKey)

  return (count ?? 0) > 0
}

export async function saveAuditPreference(
  userId: number,
  preferenceType: 'retain_duplicate' | 'skip_missing_field',
  targetKey: string
): Promise<void> {
  await supabase.from('audit_preferences').upsert(
    [
      {
        user_id: userId,
        preference_type: preferenceType,
        target_key: targetKey,
      },
    ],
    { onConflict: 'user_id,preference_type,target_key', ignoreDuplicates: true }
  )
}
