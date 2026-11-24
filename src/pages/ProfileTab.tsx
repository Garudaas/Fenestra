import React, { useState, useEffect, useMemo } from 'react'
import { useAuth } from '@/context/AuthContext'
import { supabase } from '@/lib/supabase'
import {
  fetchAllBloodGroups,
  syncCustomBloodGroupOnChange,
  saveAuditPreference,
  getDefaultSpouseGender,
  EDUCATION_LEVELS,
} from '@/lib/fenestriansCore'
import {
  fetchSingleMemberAssociationRole,
  type AssociationRoleBadgeInfo,
} from '@/lib/taskAuditService'
import { publishArchivedAlert } from '@/lib/notificationService'
import {
  formatFullDate,
  cleanPhoneNumber,
  splitPhoneForEditor,
} from '@/lib/formatters'
import SmartDateInput from '@/components/shared/SmartDateInput'
import SmartPhoneInput from '@/components/shared/SmartPhoneInput'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import CameraModal from '@/components/shared/CameraModal'
import {
  User,
  Camera,
  Upload,
  MapPin,
  Heart,
  Shield,
  EyeOff,
  Eye,
  Lock,
  Save,
  ClipboardCheck,
  CheckCircle2,
  Pencil,
  Phone,
  Mail,
  Droplets,
  GraduationCap,
  Briefcase,
  CalendarDays,
  ArrowLeft,
  Plus,
  Trash2,
  AlertTriangle,
  Users,
  FileText,
  ChevronRight,
  Award,
  ExternalLink,
  ZoomIn,
  ZoomOut,
} from 'lucide-react'

interface MyPendingTask {
  id: number
  title: string
  description: string
  is_micromanaged: boolean
  created_at: string
}

type EditSectionKey =
  | 'credentials'
  | 'basic'
  | 'contact'
  | 'addresses'
  | 'education_career'
  | 'family'
  | 'about_me'
  | 'profile_picture'
  | 'privacy'

const GOOGLE_MAPS_HELP_URL = 'https://support.google.com/maps/answer/144361'

function extractMapQuery(raw: string): string {
  const trimmed = raw.trim()
  if (!trimmed) return 'Coimbatore, Tamil Nadu'
  const qMatch = /[?&](?:q|query|ll|center)=([^&]+)/i.exec(trimmed)
  if (qMatch?.[1]) return decodeURIComponent(qMatch[1])
  const atMatch = /@(-?\d+\.\d+,-?\d+\.\d+)/.exec(trimmed)
  if (atMatch?.[1]) return atMatch[1]
  return trimmed
}

async function compressImageToJpegBlob(source: File | string, maxDimension = 800, quality = 0.82): Promise<Blob> {
  const objectUrl = typeof source === 'string' ? source : URL.createObjectURL(source)
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image()
      el.onload = () => resolve(el)
      el.onerror = () => reject(new Error('Could not load image for compression.'))
      el.src = objectUrl
    })

    let width = img.naturalWidth || img.width
    let height = img.naturalHeight || img.height
    if (width > maxDimension || height > maxDimension) {
      if (width >= height) {
        height = Math.round((height * maxDimension) / width)
        width = maxDimension
      } else {
        width = Math.round((width * maxDimension) / height)
        height = maxDimension
      }
    }

    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, width)
    canvas.height = Math.max(1, height)
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Canvas not supported.')
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height)

    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        b => (b ? resolve(b) : reject(new Error('Image compression failed.'))),
        'image/jpeg',
        quality
      )
    })
    return blob
  } finally {
    if (typeof source !== 'string') {
      URL.revokeObjectURL(objectUrl)
    }
  }
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => resolve(reader.result as string)
    reader.onerror = () => reject(new Error('Failed to read image data.'))
    reader.readAsDataURL(blob)
  })
}

export default function ProfileTab() {
  const { user } = useAuth()

  const [isEditing, setIsEditing] = useState(false)
  const [activeSection, setActiveSection] = useState<EditSectionKey | null>(null)
  const [saving, setSaving] = useState(false)
  const [uploadingPic, setUploadingPic] = useState(false)
  const [saveBanner, setSaveBanner] = useState('')

  const [profileData, setProfileData] = useState<any>(null)
  const [associationRole, setAssociationRole] = useState<AssociationRoleBadgeInfo>({
    label: 'Member of Association',
    kind: 'member',
  })
  const [familyMembers, setFamilyMembers] = useState<any[]>([])
  const [myTasks, setMyTasks] = useState<MyPendingTask[]>([])

  // Basic Details fields
  const [nickname, setNickname] = useState('')
  const [gender, setGender] = useState('')
  const [dob, setDob] = useState('')
  const [blood, setBlood] = useState('')
  const [previousBlood, setPreviousBlood] = useState('')
  const [bloodOptions, setBloodOptions] = useState<string[]>([])
  const [marital, setMarital] = useState('Single')
  const [wedding, setWedding] = useState('')
  const [divorce, setDivorce] = useState('')
  const [spouseName, setSpouseName] = useState('')
  const [spouseDob, setSpouseDob] = useState('')
  const [spouseDetails, setSpouseDetails] = useState('')

  // Contact Info fields
  const [phoneCC, setPhoneCC] = useState('+91')
  const [phoneNum, setPhoneNum] = useState('')
  const [waCC, setWaCC] = useState('+91')
  const [waNum, setWaNum] = useState('')
  const [waSameAsContact, setWaSameAsContact] = useState(false)
  const [email, setEmail] = useState('')

  // Addresses fields + interactive map picker
  const [permAddr, setPermAddr] = useState('')
  const [permGeo, setPermGeo] = useState('')
  const [currAddr, setCurrAddr] = useState('')
  const [currGeo, setCurrGeo] = useState('')
  const [addrPickerTarget, setAddrPickerTarget] = useState<'permanent' | 'current'>('permanent')
  const [addrMapSatellite, setAddrMapSatellite] = useState(true)
  const [addrMapZoom, setAddrMapZoom] = useState(14)

  // Education & Career Status fields
  const [educationLevel, setEducationLevel] = useState('')
  const [status, setStatus] = useState('Employed')

  // About Me field
  const [diary, setDiary] = useState('')

  // Profile Picture fields
  const [pic, setPic] = useState('')
  const [previousPic, setPreviousPic] = useState('')
  const [showCamera, setShowCamera] = useState(false)

  // Profile Privacy Settings fields
  const [hidePeers, setHidePeers] = useState(false)
  const [hideAdmin, setHideAdmin] = useState(false)

  // Credentials states
  const [currentUsername, setCurrentUsername] = useState('')
  const [currentPassword, setCurrentPassword] = useState('')
  const [newUsername, setNewUsername] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showNewPass, setShowNewPass] = useState(false)
  const [showConfirmPass, setShowConfirmPass] = useState(false)
  const [unlockCredentialInputs, setUnlockCredentialInputs] = useState(false)

  // Family Member Form states
  const [editingFamilyId, setEditingFamilyId] = useState<string | null>(null)
  const [previousFamBlood, setPreviousFamBlood] = useState('')
  const [famGenderAutoSet, setFamGenderAutoSet] = useState(false)
  const [famRelationship, setFamRelationship] = useState('')
  const [famCustomRel, setFamCustomRel] = useState('')
  const [famName, setFamName] = useState('')
  const [famGender, setFamGender] = useState('')
  const [famDob, setFamDob] = useState('')
  const [famBloodGroup, setFamBloodGroup] = useState('')
  const [famEdu, setFamEdu] = useState('')
  const [famEduSpec, setFamEduSpec] = useState('')
  const [famGradYear, setFamGradYear] = useState('')
  const [famCareer, setFamCareer] = useState('')
  const [famBio, setFamBio] = useState('')
  const [famNeedsSupport, setFamNeedsSupport] = useState(false)
  const [famSupportDetails, setFamSupportDetails] = useState('')
  const [famIsPrivate, setFamIsPrivate] = useState(false)

  const activeAddressQuery = useMemo(() => {
    if (addrPickerTarget === 'permanent') {
      return extractMapQuery(permGeo || permAddr)
    }
    return extractMapQuery(currGeo || currAddr)
  }, [addrPickerTarget, permGeo, permAddr, currGeo, currAddr])

  const addressMapEmbedSrc = useMemo(() => {
    const typeFlag = addrMapSatellite ? '&t=k' : '&t=m'
    return `https://maps.google.com/maps?q=${encodeURIComponent(activeAddressQuery)}&z=${addrMapZoom}${typeFlag}&output=embed`
  }, [activeAddressQuery, addrMapZoom, addrMapSatellite])

  const showToast = (msg: string) => {
    setSaveBanner(msg)
    window.scrollTo({ top: 0, behavior: 'smooth' })
    setTimeout(() => setSaveBanner(''), 4000)
  }

  const loadMyPendingTasks = async (userId: number) => {
    const { data } = await supabase
      .from('member_tasks')
      .select('id, title, description, is_micromanaged, created_at')
      .eq('assigned_to_user_id', userId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })

    setMyTasks((data ?? []) as MyPendingTask[])
  }

  const loadFamily = async (userId: number) => {
    const { data } = await supabase.from('family_members').select('*').eq('alumni_id', userId)
    if (data) setFamilyMembers(data)
  }

  const fetchLatestProfile = async () => {
    if (!user) return

    const [profileRes, bgs] = await Promise.all([
      supabase.from('alumni').select('*').eq('id', user.id).single(),
      fetchAllBloodGroups(),
    ])

    setBloodOptions(bgs)
    await Promise.all([loadMyPendingTasks(user.id), loadFamily(user.id)])

    const effectiveAdminFlag =
      profileRes.data && !profileRes.error ? Boolean(profileRes.data.is_admin) : Boolean(user.is_admin)
    const roleInfo = await fetchSingleMemberAssociationRole(user.id, effectiveAdminFlag)
    setAssociationRole(roleInfo)

    if (profileRes.data && !profileRes.error) {
      const merged = { ...user, ...profileRes.data }
      setProfileData(merged)
      hydrate(merged)
    } else {
      setProfileData(user)
      hydrate(user)
    }
  }

  useEffect(() => {
    fetchLatestProfile()
  }, [user])

  const handleCompleteMyTask = async (taskId: number) => {
    if (!user) return
    await supabase
      .from('member_tasks')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
      })
      .eq('id', taskId)

    await loadMyPendingTasks(user.id)
  }

  const clearCredentialFields = () => {
    setCurrentPassword('')
    setNewUsername('')
    setNewPassword('')
    setConfirmPassword('')
    setShowPassword(false)
    setShowNewPass(false)
    setShowConfirmPass(false)
    setUnlockCredentialInputs(false)
  }

  const hydrate = (d: any) => {
    setCurrentUsername(d.custom_username || '')
    clearCredentialFields()

    setNickname(d.class_nickname || '')
    setGender(d.gender || '')
    setDob(d.dob || '')
    setBlood(d.blood_group || '')
    setPreviousBlood(d.blood_group || '')
    setEducationLevel(d.education_level || '')
    setStatus(d.current_status || 'Employed')
    setPic(d.profile_picture_url || '')
    setPreviousPic(d.profile_picture_url || '')
    setPermAddr(d.permanent_address || '')
    setPermGeo(d.permanent_geo_location || '')
    setCurrAddr(d.current_address || '')
    setCurrGeo(d.current_geo_location || '')
    setMarital(d.marital_status || 'Single')
    setWedding(d.wedding_date || '')
    setDivorce(d.divorce_date || '')
    setSpouseName(d.spouse_name || '')
    setSpouseDob(d.spouse_dob || '')
    setSpouseDetails(d.spouse_details || '')
    setDiary(d.diary_logs || '')
    setEmail(d.email || '')
    setHidePeers(d.hide_from_peers || false)
    setHideAdmin(d.hide_from_admin || false)

    const splitContact = splitPhoneForEditor(d.contact_number)
    const splitWa = splitPhoneForEditor(d.whatsapp_number)
    setPhoneCC(splitContact.countryCode)
    setPhoneNum(splitContact.localNumber)

    const cleanC = cleanPhoneNumber(d.contact_number)
    const cleanW = cleanPhoneNumber(d.whatsapp_number)
    if (cleanC && cleanW && cleanC === cleanW) {
      setWaSameAsContact(true)
      setWaCC(splitContact.countryCode)
      setWaNum(splitContact.localNumber)
    } else {
      setWaSameAsContact(false)
      setWaCC(splitWa.countryCode)
      setWaNum(splitWa.localNumber)
    }
  }

  const syncLocalSession = (partialUpdate: Record<string, any>) => {
    try {
      const saved = localStorage.getItem('alumni_session')
      if (saved) {
        const parsed = JSON.parse(saved)
        const nextSession = { ...parsed, ...partialUpdate, custom_password: '' }
        if (
          typeof nextSession.profile_picture_url === 'string' &&
          nextSession.profile_picture_url.startsWith('data:') &&
          nextSession.profile_picture_url.length > 50000
        ) {
          nextSession.profile_picture_url = null
        }
        localStorage.setItem('alumni_session', JSON.stringify(nextSession))
      }
    } catch {
      // Ignore storage errors
    }
  }

  const savePartialAlumniUpdate = async (
    payload: Record<string, any>,
    successMsg: string
  ): Promise<boolean> => {
    if (!user) return false
    setSaving(true)
    try {
      const { error } = await supabase.from('alumni').update(payload).eq('id', user.id)
      if (error) {
        alert('Error updating profile: ' + error.message)
        return false
      }
      syncLocalSession(payload)
      await fetchLatestProfile()
      setActiveSection(null)
      showToast(successMsg)
      return true
    } catch (err: any) {
      alert('Error updating profile: ' + (err?.message || 'Unexpected error'))
      return false
    } finally {
      setSaving(false)
    }
  }

  const handleSubmitCredentials = async () => {
    if (newPassword && newPassword !== confirmPassword) {
      alert('New passwords do not match. Please retype carefully.')
      return
    }
    const payload: Record<string, any> = {}
    if (newUsername.trim()) payload.custom_username = newUsername.trim()
    if (newPassword) payload.custom_password = newPassword

    if (Object.keys(payload).length === 0) {
      clearCredentialFields()
      setActiveSection(null)
      return
    }

    const ok = await savePartialAlumniUpdate(payload, 'Account credentials updated successfully!')
    if (ok && newUsername.trim()) {
      setCurrentUsername(newUsername.trim())
    }
    clearCredentialFields()
  }

  const handleSubmitBasicDetails = async () => {
    if (!user) return
    const payload = {
      class_nickname: nickname,
      gender,
      dob: dob || null,
      blood_group: blood.trim(),
      marital_status: marital,
      wedding_date: wedding || null,
      divorce_date: divorce || null,
      spouse_name: spouseName,
      spouse_dob: spouseDob || null,
      spouse_details: spouseDetails,
    }
    const ok = await savePartialAlumniUpdate(payload, 'Basic details updated successfully!')
    if (ok) {
      await syncCustomBloodGroupOnChange({
        userId: user.id,
        newBloodGroup: blood.trim(),
        previousBloodGroup: previousBlood,
      })
      setPreviousBlood(blood.trim())
    }
  }

  const handleSubmitContactInfo = async () => {
    if (!user) return
    const finalPh = cleanPhoneNumber(phoneNum, phoneCC)
    const finalWA = waSameAsContact ? finalPh : cleanPhoneNumber(waNum, waCC)

    if (finalPh && finalWA && finalPh === finalWA && !waSameAsContact) {
      await saveAuditPreference(user.id, 'retain_duplicate', 'duplicate_phone_numbers')
    }

    const payload = {
      contact_number: finalPh,
      whatsapp_number: finalWA,
      email: email.trim() || null,
    }
    await savePartialAlumniUpdate(payload, 'Contact info updated successfully!')
  }

  const handleSubmitAddresses = async () => {
    const payload = {
      permanent_address: permAddr,
      permanent_geo_location: permGeo,
      current_address: currAddr,
      current_geo_location: currGeo,
    }
    await savePartialAlumniUpdate(payload, 'Addresses updated successfully!')
  }

  const handleSubmitEducationCareer = async () => {
    const payload = {
      education_level: educationLevel,
      current_status: status,
    }
    await savePartialAlumniUpdate(payload, 'Education & career status updated successfully!')
  }

  const resetFamilyForm = () => {
    setEditingFamilyId(null)
    setPreviousFamBlood('')
    setFamGenderAutoSet(false)
    setFamRelationship('')
    setFamCustomRel('')
    setFamName('')
    setFamGender('')
    setFamDob('')
    setFamBloodGroup('')
    setFamEdu('')
    setFamEduSpec('')
    setFamGradYear('')
    setFamCareer('')
    setFamBio('')
    setFamNeedsSupport(false)
    setFamSupportDetails('')
    setFamIsPrivate(false)
  }

  const openEditFamilyForm = (fm: any) => {
    setEditingFamilyId(String(fm.id))
    setFamGenderAutoSet(false)
    setFamName(fm.name || '')
    setFamRelationship(fm.relationship || '')
    setFamGender(fm.gender || '')
    setFamDob(fm.dob || '')
    setFamBloodGroup(fm.blood_group || '')
    setPreviousFamBlood(fm.blood_group || '')
    setFamEdu(fm.education_level || '')
    setFamEduSpec(fm.education_details || '')
    setFamGradYear(fm.graduation_year || '')
    setFamCareer(fm.career || '')
    setFamBio(fm.bio || '')
    setFamSupportDetails(fm.support_details || '')
    setFamNeedsSupport(Boolean(fm.needs_support))
    setFamIsPrivate(Boolean(fm.is_private))
  }

  const handleFamRelationshipChange = (nextRel: string) => {
    setFamRelationship(nextRel)
    if (editingFamilyId) return

    if (nextRel === 'Spouse') {
      const opposite = getDefaultSpouseGender(gender || profileData?.gender || '')
      setFamGender(opposite)
      setFamGenderAutoSet(Boolean(opposite))
    } else if (nextRel === 'Son') {
      setFamGender('Male')
      setFamGenderAutoSet(true)
    } else if (nextRel === 'Daughter') {
      setFamGender('Female')
      setFamGenderAutoSet(true)
    } else if (famGenderAutoSet) {
      setFamGender('')
      setFamGenderAutoSet(false)
    }
  }

  const handleSubmitFamilyMember = async () => {
    if (!user || !famName.trim() || !famRelationship) {
      alert('Please select Relationship and enter Full Name.')
      return
    }

    const finalRelationship = famRelationship === 'Other' ? famCustomRel.trim() || 'Other' : famRelationship
    const trimmedName = famName.trim()

    const duplicateMatches = familyMembers.filter(m => {
      if (editingFamilyId && String(m.id) === String(editingFamilyId)) return false
      const sameName = (m.name || '').trim().toLowerCase() === trimmedName.toLowerCase()
      const sameSpouse =
        finalRelationship.toLowerCase() === 'spouse' &&
        (m.relationship || '').trim().toLowerCase() === 'spouse'
      return sameName || sameSpouse
    })

    if (duplicateMatches.length > 0) {
      const existing = duplicateMatches[0]
      const removeDuplicate = window.confirm(
        `Duplicate Entry Detected: "${existing.name}" (${existing.relationship}) is already listed.\n\nClick OK to DELETE the earlier duplicate entry and keep this one, or click Cancel to RETAIN both entries.`
      )
      if (removeDuplicate) {
        await supabase.from('family_members').delete().eq('id', existing.id)
      } else {
        await saveAuditPreference(
          user.id,
          'retain_duplicate',
          `family_name_${trimmedName.toLowerCase()}`
        )
      }
    }

    setSaving(true)
    try {
      const payload = {
        alumni_id: user.id,
        relationship: finalRelationship,
        name: trimmedName,
        gender: famGender.trim(),
        dob: famDob || null,
        blood_group: famBloodGroup.trim(),
        education_level: famEdu,
        education_details: famEduSpec.trim(),
        graduation_year: famGradYear || null,
        career: famCareer.trim(),
        bio: famBio.trim(),
        is_private: famIsPrivate,
        needs_support: famNeedsSupport,
        support_details: famSupportDetails.trim(),
      }

      if (editingFamilyId) {
        const { alumni_id, ...updatePayload } = payload
        await supabase.from('family_members').update(updatePayload).eq('id', editingFamilyId)
      } else {
        await supabase.from('family_members').insert([payload])
      }

      await syncCustomBloodGroupOnChange({
        userId: user.id,
        newBloodGroup: famBloodGroup.trim(),
        previousBloodGroup: previousFamBlood,
      })

      if (famNeedsSupport && famSupportDetails.trim()) {
        await supabase.from('family_support_requests').insert([
          {
            member_id: user.id,
            member_name: user.full_name,
            title: `Support needed for ${trimmedName} (${finalRelationship})`,
            description: famSupportDetails.trim(),
            status: 'open',
          },
        ])
        await publishArchivedAlert({
          category: 'help_needed',
          shortTitle: 'Your friend Needs help',
          fullMessage: `${user.full_name}'s ${finalRelationship} (${trimmedName}) needs support: ${famSupportDetails.trim()}`,
          needsHelpFlag: true,
        })
      }

      resetFamilyForm()
      const [refreshedBgs] = await Promise.all([fetchAllBloodGroups(), loadFamily(user.id)])
      setBloodOptions(refreshedBgs)
      setActiveSection(null)
      showToast('Family details updated successfully!')
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteFamilyMember = async (id: string) => {
    if (!user || !window.confirm('Are you sure you want to delete this family member?')) return
    await supabase.from('family_members').delete().eq('id', id)
    await loadFamily(user.id)
  }

  const handleSubmitAboutMe = async () => {
    await savePartialAlumniUpdate({ diary_logs: diary }, 'About Me updated successfully!')
  }

  const processAndUploadProfileImage = async (source: File | string): Promise<string> => {
    if (!user) return ''
    const compressedBlob = await compressImageToJpegBlob(source, 800, 0.82)
    const storagePath = `member_${user.id}/profile/avatar_${Date.now()}.jpg`

    const { error: uploadErr } = await supabase.storage
      .from('fenestrians-media')
      .upload(storagePath, compressedBlob, {
        contentType: 'image/jpeg',
        upsert: true,
      })

    if (!uploadErr) {
      const { data: urlData } = supabase.storage
        .from('fenestrians-media')
        .getPublicUrl(storagePath)
      if (urlData?.publicUrl) {
        return urlData.publicUrl
      }
    }

    return await blobToDataUrl(compressedBlob)
  }

  const archiveProfilePictureCopy = async (imageUrl: string) => {
    if (!user || !imageUrl) return
    const approxSizeBytes = imageUrl.startsWith('data:')
      ? Math.round(imageUrl.length * 0.75)
      : 85000

    await supabase.from('member_media_files').insert([
      {
        owner_id: user.id,
        owner_name: user.full_name,
        folder_category: 'gallery',
        file_name: `${user.full_name}_profile_picture_${new Date().toISOString().slice(0, 10)}.jpg`,
        file_url: imageUrl,
        storage_path: `profile_copy_${user.id}_${Date.now()}`,
        mime_type: 'image/jpeg',
        file_size_bytes: approxSizeBytes,
        is_private: false,
        is_profile_picture: true,
      },
    ])

    await supabase.from('photo_gallery').insert([
      {
        alumni_id: user.id,
        image_url: imageUrl,
        description: `${user.full_name} — Profile Picture Copy`,
      },
    ])
  }

  const handleSubmitProfilePicture = async () => {
    if (!user) return
    setSaving(true)
    try {
      let finalPicUrl = pic.trim()
      if (finalPicUrl.startsWith('data:') && finalPicUrl.length > 150000) {
        finalPicUrl = await processAndUploadProfileImage(finalPicUrl)
        setPic(finalPicUrl)
      }

      const { error } = await supabase
        .from('alumni')
        .update({ profile_picture_url: finalPicUrl || null })
        .eq('id', user.id)

      if (error) {
        alert('Error updating profile picture: ' + error.message)
        return
      }

      if (finalPicUrl && finalPicUrl !== previousPic) {
        await archiveProfilePictureCopy(finalPicUrl)
        setPreviousPic(finalPicUrl)
      }

      syncLocalSession({ profile_picture_url: finalPicUrl || null })
      await fetchLatestProfile()
      setActiveSection(null)
      showToast('Profile picture updated successfully!')
    } finally {
      setSaving(false)
    }
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return

    setUploadingPic(true)
    try {
      const uploadedUrl = await processAndUploadProfileImage(file)
      setPic(uploadedUrl)
    } catch (err: any) {
      alert('Could not process image: ' + (err?.message || 'Invalid image file'))
    } finally {
      setUploadingPic(false)
    }
  }

  const handleCameraCapture = async (dataUrl: string) => {
    setShowCamera(false)
    setUploadingPic(true)
    try {
      const uploadedUrl = await processAndUploadProfileImage(dataUrl)
      setPic(uploadedUrl)
    } catch {
      setPic(dataUrl)
    } finally {
      setUploadingPic(false)
    }
  }

  const handleSubmitPrivacy = async () => {
    await savePartialAlumniUpdate(
      {
        hide_from_peers: hidePeers,
        hide_from_admin: hideAdmin,
      },
      'Profile privacy settings updated successfully!'
    )
  }

  if (!user) return null

  const activeProfile = profileData || user
  const displayContact = cleanPhoneNumber(activeProfile.contact_number)
  const displayWhatsApp = cleanPhoneNumber(activeProfile.whatsapp_number)

  const roleColorClass =
    associationRole.kind === 'office'
      ? 'text-amber-400'
      : associationRole.kind === 'admin'
      ? 'text-sky-400'
      : 'text-emerald-400'

  const editSections: Array<{
    key: EditSectionKey
    title: string
    subtitle: string
    icon: React.ReactNode
  }> = [
    {
      key: 'credentials',
      title: 'Credentials',
      subtitle: 'Update username and password',
      icon: <Lock className="h-4 w-4" />,
    },
    {
      key: 'basic',
      title: 'Basic Details',
      subtitle: 'Nickname, gender, birth date, blood group & marital details',
      icon: <User className="h-4 w-4" />,
    },
    {
      key: 'contact',
      title: 'Contact Info',
      subtitle: 'Phone number, WhatsApp number & email',
      icon: <Phone className="h-4 w-4" />,
    },
    {
      key: 'addresses',
      title: 'Addresses',
      subtitle: 'Permanent & current addresses with Google Maps links',
      icon: <MapPin className="h-4 w-4" />,
    },
    {
      key: 'education_career',
      title: 'Education & Career Status',
      subtitle: 'Academic qualification & current profession',
      icon: <GraduationCap className="h-4 w-4" />,
    },
    {
      key: 'family',
      title: 'Family',
      subtitle: `Add, edit or remove family members (${familyMembers.length} listed)`,
      icon: <Heart className="h-4 w-4" />,
    },
    {
      key: 'about_me',
      title: 'About Me',
      subtitle: 'Personal timeline, milestones & bio notes',
      icon: <FileText className="h-4 w-4" />,
    },
    {
      key: 'profile_picture',
      title: 'Profile Picture',
      subtitle: 'Upload photo or capture with camera',
      icon: <Camera className="h-4 w-4" />,
    },
    {
      key: 'privacy',
      title: 'Profile Privacy Settings',
      subtitle: 'Control visibility to classmates and Admin',
      icon: <Shield className="h-4 w-4" />,
    },
  ]

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      {saveBanner && (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-500/40 bg-emerald-500/15 px-4 py-3 text-xs font-semibold text-emerald-300 shadow">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          {saveBanner}
        </div>
      )}

      {myTasks.length > 0 && (
        <Card className="border-amber-500/40 bg-amber-500/5 backdrop-blur-sm">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm text-amber-300">
              <ClipboardCheck className="h-4 w-4" />
              My Assigned Tasks ({myTasks.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2.5">
            {myTasks.map(t => (
              <div
                key={t.id}
                className="rounded-xl border border-border/40 bg-background/70 p-3 space-y-2 text-xs"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold text-primary">{t.title}</span>
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => handleCompleteMyTask(t.id)}
                    className="h-7 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold gap-1 text-[11px]"
                  >
                    <CheckCircle2 className="h-3 w-3" />
                    Mark Completed
                  </Button>
                </div>
                <p className="text-foreground/90 whitespace-pre-line leading-relaxed">{t.description}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {!isEditing ? (
        <Card className="border-border/40 bg-card/70 backdrop-blur-sm shadow-xl">
          <CardHeader className="pb-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <CardTitle className="flex items-center gap-2 text-primary">
                <User className="h-5 w-5" />
                My Profile
              </CardTitle>
              <Button
                type="button"
                size="sm"
                title="Edit Your Profile"
                onClick={() => {
                  clearCredentialFields()
                  setActiveSection(null)
                  setIsEditing(true)
                }}
                className="gold-gradient text-gold-foreground font-semibold gap-1.5 text-xs"
              >
                <Pencil className="h-3.5 w-3.5" />
                Edit Profile
              </Button>
            </div>
          </CardHeader>

          <CardContent className="space-y-5 text-sm">
            <div className="flex flex-col sm:flex-row items-center gap-4 rounded-xl border border-primary/25 bg-primary/5 p-4">
              {activeProfile.profile_picture_url ? (
                <img
                  src={activeProfile.profile_picture_url}
                  alt={activeProfile.full_name}
                  className="h-24 w-24 rounded-full border-2 border-primary/50 object-cover shadow-lg shrink-0"
                />
              ) : (
                <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-full border-2 border-primary/40 bg-primary/15 text-3xl font-bold text-primary">
                  {activeProfile.full_name?.[0] || '?'}
                </div>
              )}

              <div className="text-center sm:text-left space-y-1.5 min-w-0 flex-1">
                <h2 className="text-xl font-bold text-foreground truncate">{activeProfile.full_name}</h2>
                <div className="flex flex-wrap justify-center sm:justify-start items-center gap-2">
                  {activeProfile.class_nickname && (
                    <Badge variant="outline" className="border-primary/40 text-primary text-xs">
                      “{activeProfile.class_nickname}”
                    </Badge>
                  )}
                  {activeProfile.gender && (
                    <Badge variant="secondary" className="text-xs">
                      {activeProfile.gender}
                    </Badge>
                  )}
                  {activeProfile.blood_group && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-red-500/15 px-2.5 py-0.5 text-xs font-bold text-red-400">
                      <Droplets className="h-3 w-3" />
                      {activeProfile.blood_group}
                    </span>
                  )}
                </div>

                <p className={`flex items-center justify-center sm:justify-start gap-1.5 text-xs font-bold pt-0.5 ${roleColorClass}`}>
                  <Award className="h-3.5 w-3.5 shrink-0" />
                  <span>{associationRole.label}</span>
                </p>

                <p className="text-xs text-muted-foreground pt-0.5">
                  Username: <span className="font-semibold text-foreground">{activeProfile.custom_username || '-'}</span>
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="rounded-lg border border-border/30 bg-muted/15 p-3 space-y-1">
                <p className="flex items-center gap-1.5 text-muted-foreground">
                  <CalendarDays className="h-3.5 w-3.5 text-primary" />
                  Date of Birth
                </p>
                <p className="font-semibold text-foreground text-sm">
                  {formatFullDate(activeProfile.dob, 'Not provided')}
                </p>
              </div>

              <div className="rounded-lg border border-border/30 bg-muted/15 p-3 space-y-1">
                <p className="flex items-center gap-1.5 text-muted-foreground">
                  <GraduationCap className="h-3.5 w-3.5 text-primary" />
                  Education Level
                </p>
                <p className="font-semibold text-foreground text-sm">{activeProfile.education_level || 'Not provided'}</p>
              </div>

              <div className="rounded-lg border border-border/30 bg-muted/15 p-3 space-y-1">
                <p className="flex items-center gap-1.5 text-muted-foreground">
                  <Phone className="h-3.5 w-3.5 text-primary" />
                  Contact Number
                </p>
                <p className="font-semibold text-foreground text-sm">{displayContact || 'Not provided'}</p>
              </div>

              <div className="rounded-lg border border-border/30 bg-muted/15 p-3 space-y-1">
                <p className="flex items-center gap-1.5 text-muted-foreground">
                  <Phone className="h-3.5 w-3.5 text-emerald-400" />
                  WhatsApp Number
                </p>
                <p className="font-semibold text-emerald-400 text-sm">{displayWhatsApp || 'Not provided'}</p>
              </div>

              <div className="rounded-lg border border-border/30 bg-muted/15 p-3 space-y-1">
                <p className="flex items-center gap-1.5 text-muted-foreground">
                  <Briefcase className="h-3.5 w-3.5 text-primary" />
                  Current Career Status
                </p>
                <p className="font-semibold text-foreground text-sm">{activeProfile.current_status || '-'}</p>
              </div>

              <div className="rounded-lg border border-border/30 bg-muted/15 p-3 space-y-1">
                <p className="flex items-center gap-1.5 text-muted-foreground">
                  <Mail className="h-3.5 w-3.5 text-primary" />
                  Email
                </p>
                <p className="font-semibold text-foreground text-sm truncate">{activeProfile.email || '-'}</p>
              </div>
            </div>

            <div className="space-y-2 rounded-xl border border-border/30 bg-muted/15 p-3.5 text-xs">
              <div>
                <p className="flex items-center gap-1.5 font-semibold text-primary">
                  <MapPin className="h-3.5 w-3.5" />
                  Permanent Address
                </p>
                <p className="text-foreground/90 mt-0.5">{activeProfile.permanent_address || 'Not provided'}</p>
              </div>

              <hr className="border-border/30" />

              <div>
                <p className="flex items-center gap-1.5 font-semibold text-primary">
                  <MapPin className="h-3.5 w-3.5" />
                  Current Address
                </p>
                <p className="text-foreground/90 mt-0.5">{activeProfile.current_address || 'Not provided'}</p>
              </div>
            </div>

            <div className="rounded-xl border border-border/30 bg-muted/15 p-3.5 text-xs space-y-1.5">
              <p className="flex items-center gap-1.5 font-semibold text-primary">
                <Heart className="h-3.5 w-3.5" />
                Marital Status: <span className="text-foreground">{activeProfile.marital_status || 'Single'}</span>
              </p>
              {activeProfile.wedding_date && (
                <p className="text-muted-foreground">
                  Wedding Date:{' '}
                  <span className="font-medium text-foreground">{formatFullDate(activeProfile.wedding_date)}</span>
                </p>
              )}
              {activeProfile.marital_status === 'Divorced' && activeProfile.divorce_date && (
                <p className="text-muted-foreground">
                  Divorce Date:{' '}
                  <span className="font-medium text-foreground">{formatFullDate(activeProfile.divorce_date)}</span>
                </p>
              )}
              {activeProfile.marital_status === 'Married' && activeProfile.spouse_name && (
                <p className="text-muted-foreground">
                  Spouse: <span className="font-medium text-foreground">{activeProfile.spouse_name}</span>
                  {activeProfile.spouse_dob ? ` (${formatFullDate(activeProfile.spouse_dob)})` : ''}
                </p>
              )}
            </div>

            {activeProfile.diary_logs && (
              <div className="rounded-xl border border-border/30 bg-muted/15 p-3.5 text-xs space-y-1">
                <p className="font-semibold text-primary">About Me</p>
                <p className="whitespace-pre-line font-mono text-foreground/90">{activeProfile.diary_logs}</p>
              </div>
            )}

            <div className="rounded-xl border border-border/30 bg-muted/15 p-3.5 text-xs space-y-2">
              <p className="flex items-center gap-1.5 font-semibold text-primary">
                <Users className="h-3.5 w-3.5" />
                Family Members ({familyMembers.length})
              </p>
              {familyMembers.length === 0 ? (
                <p className="italic text-muted-foreground">No family members added yet.</p>
              ) : (
                <div className="space-y-1.5">
                  {familyMembers.map(f => (
                    <div
                      key={f.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/30 bg-background/50 px-3 py-2"
                    >
                      <div>
                        <span className="font-bold text-foreground">{f.name}</span>{' '}
                        <span className="text-muted-foreground">({f.relationship})</span>
                        {f.dob && (
                          <span className="ml-2 text-primary/90">• {formatFullDate(f.dob)}</span>
                        )}
                      </div>
                      {f.is_private && <Lock className="h-3.5 w-3.5 text-primary" />}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      ) : activeSection === null ? (
        <Card className="border-border/40 bg-card/75 backdrop-blur-sm shadow-xl">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="flex items-center gap-2 text-primary">
                <Pencil className="h-5 w-5" />
                Update Profile
              </CardTitle>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  clearCredentialFields()
                  setIsEditing(false)
                }}
                className="gap-1.5 text-xs text-muted-foreground hover:text-foreground"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Back to My Profile
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Select a section below to edit and submit your updates.
            </p>
          </CardHeader>

          <CardContent className="space-y-2">
            {editSections.map(sec => (
              <button
                key={sec.key}
                type="button"
                onClick={() => {
                  if (sec.key === 'credentials') clearCredentialFields()
                  if (sec.key === 'family') resetFamilyForm()
                  setActiveSection(sec.key)
                }}
                className="flex w-full items-center justify-between gap-3 rounded-xl border border-border/40 bg-muted/15 hover:border-primary/40 hover:bg-primary/5 p-3.5 text-left transition-all"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-primary/30 bg-primary/10 text-primary">
                    {sec.icon}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-foreground truncate">{sec.title}</p>
                    <p className="text-[11px] text-muted-foreground truncate">{sec.subtitle}</p>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-primary shrink-0" />
              </button>
            ))}
          </CardContent>
        </Card>
      ) : (
        <Card className="border-primary/30 bg-card/75 backdrop-blur-sm shadow-xl">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="flex items-center gap-2 text-primary text-base">
                {editSections.find(s => s.key === activeSection)?.icon}
                {editSections.find(s => s.key === activeSection)?.title}
              </CardTitle>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  clearCredentialFields()
                  resetFamilyForm()
                  setActiveSection(null)
                }}
                className="gap-1.5 text-xs text-muted-foreground hover:text-foreground"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Back to Profile Update
              </Button>
            </div>
          </CardHeader>

          <CardContent className="space-y-4 text-sm">
            {activeSection === 'credentials' && (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <Label>Current Username</Label>
                    <Input
                      name="profile_curr_user_display"
                      autoComplete="off"
                      value={currentUsername}
                      readOnly
                      className="mt-1 bg-input/30 text-muted-foreground"
                      placeholder="No username set"
                    />
                  </div>
                  <div>
                    <Label>Current Password</Label>
                    <div className="relative mt-1">
                      <Input
                        name="profile_curr_pwd_blank"
                        autoComplete="new-password"
                        type={showPassword ? 'text' : 'password'}
                        value={currentPassword}
                        readOnly
                        className="bg-input/30 text-muted-foreground pr-10"
                        placeholder=""
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute right-1 top-1 h-7 w-7 p-0 text-muted-foreground"
                        onClick={() => setShowPassword(!showPassword)}
                      >
                        {showPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                      </Button>
                    </div>
                  </div>
                </div>

                <hr className="border-border/30" />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="col-span-1 md:col-span-2">
                    <Label>Update Username</Label>
                    <Input
                      name="profile_new_user_blank"
                      autoComplete="off"
                      readOnly={!unlockCredentialInputs}
                      onFocus={() => setUnlockCredentialInputs(true)}
                      onTouchStart={() => setUnlockCredentialInputs(true)}
                      value={newUsername}
                      onChange={e => setNewUsername(e.target.value)}
                      placeholder="Leave blank to keep current"
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label>Update Password</Label>
                    <div className="relative mt-1">
                      <Input
                        name="profile_new_pwd_blank"
                        autoComplete="new-password"
                        readOnly={!unlockCredentialInputs}
                        onFocus={() => setUnlockCredentialInputs(true)}
                        onTouchStart={() => setUnlockCredentialInputs(true)}
                        type={showNewPass ? 'text' : 'password'}
                        value={newPassword}
                        onChange={e => setNewPassword(e.target.value)}
                        placeholder="New Password"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute right-1 top-1 h-7 w-7 p-0 text-muted-foreground"
                        onClick={() => setShowNewPass(!showNewPass)}
                      >
                        {showNewPass ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                      </Button>
                    </div>
                  </div>
                  <div>
                    <Label>Retype New Password</Label>
                    <div className="relative mt-1">
                      <Input
                        name="profile_confirm_pwd_blank"
                        autoComplete="new-password"
                        readOnly={!unlockCredentialInputs}
                        onFocus={() => setUnlockCredentialInputs(true)}
                        onTouchStart={() => setUnlockCredentialInputs(true)}
                        type={showConfirmPass ? 'text' : 'password'}
                        value={confirmPassword}
                        onChange={e => setConfirmPassword(e.target.value)}
                        placeholder="Confirm New Password"
                        className={
                          confirmPassword && newPassword !== confirmPassword
                            ? 'border-red-500 focus-visible:ring-red-500'
                            : ''
                        }
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute right-1 top-1 h-7 w-7 p-0 text-muted-foreground"
                        onClick={() => setShowConfirmPass(!showConfirmPass)}
                      >
                        {showConfirmPass ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                      </Button>
                    </div>
                    {confirmPassword && newPassword !== confirmPassword && (
                      <p className="mt-1 text-xs text-red-500 font-medium">Passwords do not match</p>
                    )}
                  </div>
                </div>

                <Button
                  type="button"
                  disabled={saving}
                  onClick={handleSubmitCredentials}
                  className="w-full gold-gradient text-gold-foreground gap-2 font-semibold"
                >
                  <Save className="h-4 w-4" />
                  {saving ? 'Submitting...' : 'Submit Credentials'}
                </Button>
              </>
            )}

            {activeSection === 'basic' && (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <Label>Nickname</Label>
                    <Input value={nickname} onChange={e => setNickname(e.target.value)} className="mt-1" />
                  </div>
                  <div>
                    <Label>Gender</Label>
                    <select
                      value={gender}
                      onChange={e => setGender(e.target.value)}
                      className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    >
                      <option value="">Select Gender...</option>
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                    </select>
                  </div>
                  <div>
                    <Label>Date of Birth (DD/MM/YYYY)</Label>
                    <SmartDateInput value={dob} onChange={setDob} className="mt-1" />
                  </div>
                  <div>
                    <Label>Blood Group</Label>
                    <Input
                      list="profile-blood-groups"
                      value={blood}
                      onChange={e => setBlood(e.target.value)}
                      placeholder="Select or type..."
                      className="mt-1"
                    />
                    <datalist id="profile-blood-groups">
                      {bloodOptions.map(bg => (
                        <option key={bg} value={bg} />
                      ))}
                    </datalist>
                  </div>
                </div>

                <hr className="border-border/30" />

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div>
                    <Label className="flex items-center gap-1.5">
                      <Heart className="h-3.5 w-3.5 text-primary" />
                      Marital Status
                    </Label>
                    <select
                      value={marital}
                      onChange={e => setMarital(e.target.value)}
                      className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    >
                      <option value="Single">Single</option>
                      <option value="Married">Married</option>
                      <option value="Divorced">Divorced</option>
                    </select>
                  </div>
                  {marital !== 'Single' && (
                    <div>
                      <Label>Wedding Date</Label>
                      <SmartDateInput value={wedding} onChange={setWedding} className="mt-1" />
                    </div>
                  )}
                  {marital === 'Divorced' && (
                    <div>
                      <Label>Divorce Date</Label>
                      <SmartDateInput value={divorce} onChange={setDivorce} className="mt-1" />
                    </div>
                  )}
                </div>

                {marital === 'Married' && (
                  <Card className="border-primary/20 bg-primary/5">
                    <CardContent className="space-y-2 p-3">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <div>
                          <Label>Spouse Name</Label>
                          <Input value={spouseName} onChange={e => setSpouseName(e.target.value)} className="mt-1" />
                        </div>
                        <div>
                          <Label>Spouse DOB</Label>
                          <SmartDateInput value={spouseDob} onChange={setSpouseDob} className="mt-1" />
                        </div>
                      </div>
                      <div>
                        <Label>Spouse Details</Label>
                        <Input value={spouseDetails} onChange={e => setSpouseDetails(e.target.value)} className="mt-1" />
                      </div>
                    </CardContent>
                  </Card>
                )}

                <Button
                  type="button"
                  disabled={saving}
                  onClick={handleSubmitBasicDetails}
                  className="w-full gold-gradient text-gold-foreground gap-2 font-semibold"
                >
                  <Save className="h-4 w-4" />
                  {saving ? 'Submitting...' : 'Submit Basic Details'}
                </Button>
              </>
            )}

            {activeSection === 'contact' && (
              <>
                <div className="space-y-3">
                  <div>
                    <Label>Contact Number</Label>
                    <div className="mt-1">
                      <SmartPhoneInput
                        countryCode={phoneCC}
                        localNumber={phoneNum}
                        onChange={(nextCC, nextLocal) => {
                          setPhoneCC(nextCC)
                          setPhoneNum(nextLocal)
                          if (waSameAsContact) {
                            setWaCC(nextCC)
                            setWaNum(nextLocal)
                          }
                        }}
                        placeholder="Enter mobile number"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <Label>WhatsApp Number</Label>
                      <label className="flex items-center gap-2 text-xs font-medium text-primary cursor-pointer">
                        <Checkbox
                          checked={waSameAsContact}
                          onCheckedChange={v => {
                            const checked = Boolean(v)
                            setWaSameAsContact(checked)
                            if (checked) {
                              setWaCC(phoneCC)
                              setWaNum(phoneNum)
                            }
                          }}
                        />
                        <span>Same as Contact Number</span>
                      </label>
                    </div>
                    <SmartPhoneInput
                      countryCode={waSameAsContact ? phoneCC : waCC}
                      localNumber={waSameAsContact ? phoneNum : waNum}
                      disabled={waSameAsContact}
                      onChange={(nextCC, nextLocal) => {
                        if (!waSameAsContact) {
                          setWaCC(nextCC)
                          setWaNum(nextLocal)
                        }
                      }}
                      placeholder="Enter WhatsApp number"
                    />
                  </div>

                  <div>
                    <Label>Email Address</Label>
                    <Input
                      type="email"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      placeholder="name@example.com"
                      className="mt-1"
                    />
                  </div>
                </div>

                <Button
                  type="button"
                  disabled={saving}
                  onClick={handleSubmitContactInfo}
                  className="w-full gold-gradient text-gold-foreground gap-2 font-semibold"
                >
                  <Save className="h-4 w-4" />
                  {saving ? 'Submitting...' : 'Submit Contact Info'}
                </Button>
              </>
            )}

            {/* TAB 4: ADDRESSES + GOOGLE MAP / SATELLITE PICKER */}
            {activeSection === 'addresses' && (
              <>
                <div className="space-y-3">
                  <div>
                    <Label className="flex items-center gap-1.5">
                      <MapPin className="h-3.5 w-3.5 text-primary" />
                      Permanent Address
                    </Label>
                    <Textarea value={permAddr} onChange={e => setPermAddr(e.target.value)} className="mt-1 h-16" />
                  </div>
                  <div>
                    <Label>Permanent Google Map Link / Plus Code</Label>
                    <Input
                      value={permGeo}
                      onChange={e => {
                        setPermGeo(e.target.value)
                        setAddrPickerTarget('permanent')
                      }}
                      onFocus={() => setAddrPickerTarget('permanent')}
                      className="mt-1"
                      placeholder="https://maps.google.com/... or Plus Code (e.g., 7J4VXF22+22)"
                    />
                  </div>

                  <hr className="border-border/30" />

                  <div>
                    <Label className="flex items-center gap-1.5">
                      <MapPin className="h-3.5 w-3.5 text-primary" />
                      Current Address
                    </Label>
                    <Textarea value={currAddr} onChange={e => setCurrAddr(e.target.value)} className="mt-1 h-16" />
                  </div>
                  <div>
                    <Label>Current Google Map Link / Plus Code</Label>
                    <Input
                      value={currGeo}
                      onChange={e => {
                        setCurrGeo(e.target.value)
                        setAddrPickerTarget('current')
                      }}
                      onFocus={() => setAddrPickerTarget('current')}
                      className="mt-1"
                      placeholder="https://maps.google.com/... or Plus Code (e.g., 7J4VXF22+22)"
                    />
                  </div>

                  {/* Interactive Google Map / Satellite View */}
                  <div className="rounded-xl border border-primary/35 bg-primary/5 p-3 space-y-2.5 text-xs">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setAddrPickerTarget('permanent')}
                          className={`rounded-md px-2.5 py-1 text-[11px] font-semibold ${
                            addrPickerTarget === 'permanent'
                              ? 'gold-gradient text-gold-foreground'
                              : 'bg-background/70 text-foreground'
                          }`}
                        >
                          Preview Permanent
                        </button>
                        <button
                          type="button"
                          onClick={() => setAddrPickerTarget('current')}
                          className={`rounded-md px-2.5 py-1 text-[11px] font-semibold ${
                            addrPickerTarget === 'current'
                              ? 'gold-gradient text-gold-foreground'
                              : 'bg-background/70 text-foreground'
                          }`}
                        >
                          Preview Current
                        </button>
                      </div>

                      <a
                        href={GOOGLE_MAPS_HELP_URL}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-[11px] font-semibold text-sky-400 hover:underline"
                      >
                        Google Maps Help (Links / Coordinates / Plus Codes)
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <Button
                          type="button"
                          size="sm"
                          variant={addrMapSatellite ? 'default' : 'outline'}
                          onClick={() => setAddrMapSatellite(true)}
                          className="h-7 text-[11px]"
                        >
                          Satellite
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant={!addrMapSatellite ? 'default' : 'outline'}
                          onClick={() => setAddrMapSatellite(false)}
                          className="h-7 text-[11px]"
                        >
                          Map
                        </Button>
                      </div>

                      <div className="flex items-center gap-1">
                        <Button
                          type="button"
                          size="icon"
                          variant="outline"
                          onClick={() => setAddrMapZoom(z => Math.max(4, z - 2))}
                          className="h-7 w-7"
                          title="Zoom Out"
                        >
                          <ZoomOut className="h-3.5 w-3.5" />
                        </Button>
                        <span className="px-1.5 text-[11px] font-mono">z:{addrMapZoom}</span>
                        <Button
                          type="button"
                          size="icon"
                          variant="outline"
                          onClick={() => setAddrMapZoom(z => Math.min(20, z + 2))}
                          className="h-7 w-7"
                          title="Zoom In"
                        >
                          <ZoomIn className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>

                    <div className="h-52 w-full overflow-auto rounded-lg border border-primary/40 bg-background">
                      <iframe
                        title="Profile Address Google Map"
                        src={addressMapEmbedSrc}
                        className="h-full w-full min-h-[200px] border-0"
                        loading="lazy"
                        referrerPolicy="no-referrer-when-downgrade"
                      />
                    </div>
                  </div>
                </div>

                <Button
                  type="button"
                  disabled={saving}
                  onClick={handleSubmitAddresses}
                  className="w-full gold-gradient text-gold-foreground gap-2 font-semibold"
                >
                  <Save className="h-4 w-4" />
                  {saving ? 'Submitting...' : 'Submit Addresses'}
                </Button>
              </>
            )}

            {activeSection === 'education_career' && (
              <>
                <div className="space-y-3">
                  <div>
                    <Label>Education Level</Label>
                    <select
                      value={educationLevel}
                      onChange={e => setEducationLevel(e.target.value)}
                      className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    >
                      <option value="">Select Education Level...</option>
                      {EDUCATION_LEVELS.map(level => (
                        <option key={level} value={level}>
                          {level}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <Label>Current Career Status</Label>
                    <select
                      value={status}
                      onChange={e => setStatus(e.target.value)}
                      className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    >
                      <option value="Noble Services">Noble Services</option>
                      <option value="Freelancer">Freelancer</option>
                      <option value="Business">Business</option>
                      <option value="Self-Employed">Self-Employed</option>
                      <option value="Employed">Employed</option>
                    </select>
                  </div>
                </div>

                <Button
                  type="button"
                  disabled={saving}
                  onClick={handleSubmitEducationCareer}
                  className="w-full gold-gradient text-gold-foreground gap-2 font-semibold"
                >
                  <Save className="h-4 w-4" />
                  {saving ? 'Submitting...' : 'Submit Education & Career Status'}
                </Button>
              </>
            )}

            {activeSection === 'family' && (
              <div className="space-y-4">
                {familyMembers.length > 0 && (
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-primary">
                      Existing Family Members ({familyMembers.length})
                    </Label>
                    {familyMembers.map(f => (
                      <div
                        key={f.id}
                        className="flex items-center justify-between gap-2 rounded-lg border border-border/30 bg-background/70 px-3 py-2 text-xs"
                      >
                        <div className="min-w-0">
                          <span className="font-bold text-foreground">{f.name}</span>{' '}
                          <span className="text-muted-foreground">({f.relationship})</span>
                          {f.dob && (
                            <span className="ml-1.5 text-primary/90">• {formatFullDate(f.dob)}</span>
                          )}
                          {f.is_private && <Lock className="inline ml-1.5 h-3 w-3 text-primary" />}
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            title="Edit Family Member"
                            onClick={() => openEditFamilyForm(f)}
                            className="h-7 w-7 p-0 text-primary hover:bg-primary/10"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            title="Delete Family Member"
                            onClick={() => handleDeleteFamilyMember(f.id)}
                            className="h-7 w-7 p-0 text-destructive hover:bg-destructive/10"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <div className="space-y-3 rounded-xl border border-primary/25 bg-primary/5 p-3.5">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-bold text-primary">
                      {editingFamilyId ? 'Edit Family Member' : 'Add Family Member'}
                    </p>
                    {editingFamilyId && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={resetFamilyForm}
                        className="h-6 text-[11px] text-muted-foreground"
                      >
                        Clear Form
                      </Button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <Label>Relationship *</Label>
                      <select
                        value={famRelationship}
                        onChange={e => handleFamRelationshipChange(e.target.value)}
                        className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-xs"
                      >
                        <option value="">Select Relationship...</option>
                        <option value="Spouse">Spouse</option>
                        <option value="Child">Child</option>
                        <option value="Son">Son</option>
                        <option value="Daughter">Daughter</option>
                        <option value="Parent">Parent</option>
                        <option value="Other">Other Relation</option>
                      </select>
                    </div>
                    <div>
                      <Label>Full Name *</Label>
                      <Input
                        value={famName}
                        onChange={e => setFamName(e.target.value)}
                        className="mt-1 text-xs"
                      />
                    </div>
                  </div>

                  {famRelationship === 'Other' && (
                    <div>
                      <Label className="text-primary">Specify Custom Relationship *</Label>
                      <Input
                        value={famCustomRel}
                        onChange={e => setFamCustomRel(e.target.value)}
                        className="mt-1 text-xs"
                        placeholder="e.g., Father-in-law, Cousin"
                      />
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <Label>Gender</Label>
                      <select
                        value={famGender}
                        onChange={e => {
                          setFamGender(e.target.value)
                          setFamGenderAutoSet(false)
                        }}
                        className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-xs"
                      >
                        <option value="">Select Gender...</option>
                        <option value="Male">Male</option>
                        <option value="Female">Female</option>
                      </select>
                    </div>
                    <div>
                      <Label>Date of Birth (DD/MM/YYYY)</Label>
                      <SmartDateInput
                        value={famDob}
                        onChange={setFamDob}
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label>Blood Group</Label>
                      <Input
                        list="inline-family-blood-groups"
                        value={famBloodGroup}
                        onChange={e => setFamBloodGroup(e.target.value)}
                        placeholder="Select or type..."
                        className="mt-1 text-xs"
                      />
                      <datalist id="inline-family-blood-groups">
                        {bloodOptions.map(bg => (
                          <option key={bg} value={bg} />
                        ))}
                      </datalist>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <Label>Education Level</Label>
                      <select
                        value={famEdu}
                        onChange={e => setFamEdu(e.target.value)}
                        className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-xs"
                      >
                        <option value="">Select Education Level...</option>
                        <option value="Toddler">Toddler</option>
                        <option value="At School">At School</option>
                        {EDUCATION_LEVELS.map(level => (
                          <option key={level} value={level}>
                            {level}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <Label>Education Details</Label>
                      <Input
                        value={famEduSpec}
                        onChange={e => setFamEduSpec(e.target.value)}
                        className="mt-1 text-xs"
                      />
                    </div>
                  </div>

                  {famRelationship && !['Child', 'Son', 'Daughter', 'Spouse'].includes(famRelationship) && (
                    <div>
                      <Label>Graduation Year</Label>
                      <Input
                        type="number"
                        value={famGradYear}
                        onChange={e => setFamGradYear(e.target.value)}
                        className="mt-1 text-xs"
                      />
                    </div>
                  )}

                  <div>
                    <Label>Career Profile</Label>
                    <Textarea
                      value={famCareer}
                      onChange={e => setFamCareer(e.target.value)}
                      className="mt-1 h-12 text-xs"
                    />
                  </div>

                  <div>
                    <Label>Personal Notes</Label>
                    <Textarea
                      value={famBio}
                      onChange={e => setFamBio(e.target.value)}
                      className="mt-1 h-12 text-xs"
                    />
                  </div>

                  <Card className="border-destructive/20 bg-destructive/5">
                    <CardContent className="space-y-2 p-3">
                      <label className="flex items-center gap-2 font-bold text-destructive text-xs">
                        <Checkbox checked={famNeedsSupport} onCheckedChange={v => setFamNeedsSupport(!!v)} />
                        <AlertTriangle className="h-4 w-4" />
                        Highlight: This member needs assistance/support
                      </label>
                      <Input
                        value={famSupportDetails}
                        onChange={e => setFamSupportDetails(e.target.value)}
                        placeholder="Describe the help needed..."
                        className="text-xs"
                      />
                    </CardContent>
                  </Card>

                  <label className="flex items-center gap-2 font-bold text-primary text-xs">
                    <Checkbox checked={famIsPrivate} onCheckedChange={v => setFamIsPrivate(!!v)} />
                    <Lock className="h-4 w-4" />
                    Keep this family member's details private
                  </label>

                  <Button
                    type="button"
                    disabled={saving}
                    onClick={handleSubmitFamilyMember}
                    className="w-full gold-gradient text-gold-foreground font-semibold gap-2 text-xs"
                  >
                    <Plus className="h-4 w-4" />
                    {saving ? 'Submitting...' : 'Submit Family Member'}
                  </Button>
                </div>

                {familyMembers.length > 0 && !famName.trim() && !famRelationship && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      resetFamilyForm()
                      setActiveSection(null)
                    }}
                    className="w-full text-xs border-primary/40 text-primary"
                  >
                    Done &amp; Return to Profile Update
                  </Button>
                )}
              </div>
            )}

            {activeSection === 'about_me' && (
              <>
                <div>
                  <Label>About Me / Personal Timeline &amp; Notes</Label>
                  <Textarea
                    value={diary}
                    onChange={e => setDiary(e.target.value)}
                    className="mt-1 h-32 font-mono text-xs"
                    placeholder="Share a brief introduction, achievements, or important life events..."
                  />
                </div>

                <Button
                  type="button"
                  disabled={saving}
                  onClick={handleSubmitAboutMe}
                  className="w-full gold-gradient text-gold-foreground gap-2 font-semibold"
                >
                  <Save className="h-4 w-4" />
                  {saving ? 'Submitting...' : 'Submit About Me'}
                </Button>
              </>
            )}

            {activeSection === 'profile_picture' && (
              <>
                <div className="space-y-3 rounded-xl border border-primary/25 bg-primary/5 p-4">
                  <Label>Profile Photo (Automatically saved in your Gallery &amp; Folder)</Label>
                  <div className="flex items-center gap-4 pt-1">
                    {pic ? (
                      <img
                        src={pic}
                        alt="Profile preview"
                        className="h-20 w-20 rounded-full border-2 border-primary/40 object-cover shrink-0"
                      />
                    ) : (
                      <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full border border-border/50 bg-muted text-xl font-bold text-primary">
                        {user.full_name?.[0] || '?'}
                      </div>
                    )}
                    <div className="flex flex-wrap gap-2">
                      <input type="file" accept="image/*" id="profile-pic-file" className="hidden" onChange={handleFileUpload} />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={uploadingPic}
                        onClick={() => document.getElementById('profile-pic-file')?.click()}
                        className="gap-1.5 border-primary/30 hover:shadow-primary/5"
                      >
                        <Upload className="h-3.5 w-3.5" />
                        {uploadingPic ? 'Optimizing Photo...' : 'Upload Image'}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={uploadingPic}
                        onClick={() => setShowCamera(true)}
                        className="gap-1.5 border-primary/30 hover:shadow-primary/5"
                      >
                        <Camera className="h-3.5 w-3.5" />
                        Use Camera
                      </Button>
                    </div>
                  </div>
                  <Input
                    value={pic}
                    onChange={e => setPic(e.target.value)}
                    className="mt-1 text-xs"
                    placeholder="Image URL"
                  />
                </div>

                <Button
                  type="button"
                  disabled={saving || uploadingPic}
                  onClick={handleSubmitProfilePicture}
                  className="w-full gold-gradient text-gold-foreground gap-2 font-semibold"
                >
                  <Save className="h-4 w-4" />
                  {saving ? 'Submitting...' : 'Submit Profile Picture'}
                </Button>
              </>
            )}

            {activeSection === 'privacy' && (
              <>
                <div className="space-y-3 rounded-xl border border-border/40 bg-muted/15 p-4">
                  <label className="flex items-center gap-2.5 text-sm cursor-pointer">
                    <Checkbox checked={hidePeers} onCheckedChange={v => setHidePeers(!!v)} />
                    <EyeOff className="h-4 w-4 text-muted-foreground" />
                    <span>Hide my profile from classmates</span>
                  </label>
                  <label className="flex items-center gap-2.5 text-sm cursor-pointer">
                    <Checkbox checked={hideAdmin} onCheckedChange={v => setHideAdmin(!!v)} />
                    <EyeOff className="h-4 w-4 text-muted-foreground" />
                    <span>Hide my profile from Admin</span>
                  </label>
                </div>

                <Button
                  type="button"
                  disabled={saving}
                  onClick={handleSubmitPrivacy}
                  className="w-full gold-gradient text-gold-foreground gap-2 font-semibold"
                >
                  <Save className="h-4 w-4" />
                  {saving ? 'Submitting...' : 'Submit Privacy Settings'}
                </Button>
              </>
            )}
          </CardContent>

          {showCamera && (
            <CameraModal
              onCapture={handleCameraCapture}
              onClose={() => setShowCamera(false)}
            />
          )}
        </Card>
      )}
    </div>
  )
}
