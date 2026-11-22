import React, { useState, useEffect } from 'react'
import { useAuth } from '@/context/AuthContext'
import { supabase } from '@/lib/supabase'
import {
  fetchAllBloodGroups,
  syncCustomBloodGroupOnChange,
  saveAuditPreference,
  getDefaultSpouseGender,
  EDUCATION_LEVELS,
} from '@/lib/fenestriansCore'
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
} from 'lucide-react'

interface MyPendingTask {
  id: number
  title: string
  description: string
  is_micromanaged: boolean
  created_at: string
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
  const [showFamilyEditor, setShowFamilyEditor] = useState(false)
  const [saving, setSaving] = useState(false)
  const [uploadingPic, setUploadingPic] = useState(false)
  const [saveBanner, setSaveBanner] = useState('')

  const [profileData, setProfileData] = useState<any>(null)
  const [familyMembers, setFamilyMembers] = useState<any[]>([])
  const [myTasks, setMyTasks] = useState<MyPendingTask[]>([])

  // Profile fields
  const [nickname, setNickname] = useState('')
  const [gender, setGender] = useState('')
  const [dob, setDob] = useState('')
  const [blood, setBlood] = useState('')
  const [previousBlood, setPreviousBlood] = useState('')
  const [bloodOptions, setBloodOptions] = useState<string[]>([])
  const [educationLevel, setEducationLevel] = useState('')
  const [status, setStatus] = useState('Employed')
  const [pic, setPic] = useState('')
  const [previousPic, setPreviousPic] = useState('')
  const [permAddr, setPermAddr] = useState('')
  const [permGeo, setPermGeo] = useState('')
  const [currAddr, setCurrAddr] = useState('')
  const [currGeo, setCurrGeo] = useState('')
  const [marital, setMarital] = useState('Single')
  const [wedding, setWedding] = useState('')
  const [divorce, setDivorce] = useState('')
  const [spouseName, setSpouseName] = useState('')
  const [spouseDob, setSpouseDob] = useState('')
  const [spouseDetails, setSpouseDetails] = useState('')
  const [diary, setDiary] = useState('')
  const [hidePeers, setHidePeers] = useState(false)
  const [hideAdmin, setHideAdmin] = useState(false)

  // Phone & WhatsApp states
  const [phoneCC, setPhoneCC] = useState('+91')
  const [phoneNum, setPhoneNum] = useState('')
  const [waCC, setWaCC] = useState('+91')
  const [waNum, setWaNum] = useState('')
  const [waSameAsContact, setWaSameAsContact] = useState(false)

  const [showCamera, setShowCamera] = useState(false)

  // Credentials states (kept blank on open)
  const [currentUsername, setCurrentUsername] = useState('')
  const [currentPassword, setCurrentPassword] = useState('')
  const [newUsername, setNewUsername] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showNewPass, setShowNewPass] = useState(false)
  const [showConfirmPass, setShowConfirmPass] = useState(false)
  const [unlockCredentialInputs, setUnlockCredentialInputs] = useState(false)

  // Inline Family Member Form states
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

  const handleOpenEditProfile = () => {
    clearCredentialFields()
    setIsEditing(true)
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

  const openAddFamilyForm = () => {
    resetFamilyForm()
    setShowFamilyEditor(true)
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
    setShowFamilyEditor(true)
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

  const handleSaveFamilyMember = async () => {
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
    setShowFamilyEditor(false)
  }

  const handleDeleteFamilyMember = async (id: string) => {
    if (!user || !window.confirm('Are you sure you want to delete this family member?')) return
    await supabase.from('family_members').delete().eq('id', id)
    await loadFamily(user.id)
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

  const handleSave = async () => {
    if (!user) return

    if (newPassword && newPassword !== confirmPassword) {
      alert('New passwords do not match. Please resolve the error before saving.')
      return
    }

    const finalPh = cleanPhoneNumber(phoneNum, phoneCC)
    const finalWA = waSameAsContact ? finalPh : cleanPhoneNumber(waNum, waCC)

    if (finalPh && finalWA && finalPh === finalWA && !waSameAsContact) {
      await saveAuditPreference(user.id, 'retain_duplicate', 'duplicate_phone_numbers')
    }

    setSaving(true)
    try {
      let finalPicUrl = pic.trim()
      if (finalPicUrl.startsWith('data:') && finalPicUrl.length > 150000) {
        finalPicUrl = await processAndUploadProfileImage(finalPicUrl)
        setPic(finalPicUrl)
      }

      const updatePayload: any = {
        class_nickname: nickname,
        gender,
        dob: dob || null,
        whatsapp_number: finalWA,
        contact_number: finalPh,
        blood_group: blood.trim(),
        education_level: educationLevel,
        current_status: status,
        profile_picture_url: finalPicUrl || null,
        permanent_address: permAddr,
        permanent_geo_location: permGeo,
        current_address: currAddr,
        current_geo_location: currGeo,
        marital_status: marital,
        wedding_date: wedding || null,
        divorce_date: divorce || null,
        spouse_name: spouseName,
        spouse_dob: spouseDob || null,
        spouse_details: spouseDetails,
        diary_logs: diary,
        hide_from_peers: hidePeers,
        hide_from_admin: hideAdmin,
      }

      if (newUsername.trim()) updatePayload.custom_username = newUsername.trim()
      if (newPassword) updatePayload.custom_password = newPassword

      const { error } = await supabase.from('alumni').update(updatePayload).eq('id', user.id)

      if (error) {
        alert('Error updating profile: ' + error.message)
        return
      }

      await syncCustomBloodGroupOnChange({
        userId: user.id,
        newBloodGroup: blood.trim(),
        previousBloodGroup: previousBlood,
      })

      if (finalPicUrl && finalPicUrl !== previousPic) {
        await archiveProfilePictureCopy(finalPicUrl)
        setPreviousPic(finalPicUrl)
      }

      setPreviousBlood(blood.trim())
      if (newUsername.trim()) setCurrentUsername(newUsername.trim())
      clearCredentialFields()

      await fetchLatestProfile()

      try {
        const saved = localStorage.getItem('alumni_session')
        if (saved) {
          const parsed = JSON.parse(saved)
          localStorage.setItem(
            'alumni_session',
            JSON.stringify({
              ...parsed,
              ...updatePayload,
              custom_password: '',
            })
          )
        }
      } catch {
        // Ignore
      }

      setSaveBanner('Profile updated successfully!')
      setIsEditing(false)
      setShowFamilyEditor(false)
      window.scrollTo({ top: 0, behavior: 'smooth' })
      setTimeout(() => setSaveBanner(''), 4000)
    } catch (err: any) {
      alert('Error updating profile: ' + (err?.message || 'Unexpected error'))
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

  if (!user) return null

  const activeProfile = profileData || user
  const displayContact = cleanPhoneNumber(activeProfile.contact_number)
  const displayWhatsApp = cleanPhoneNumber(activeProfile.whatsapp_number)

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      {saveBanner && (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-500/40 bg-emerald-500/15 px-4 py-3 text-xs font-semibold text-emerald-300 shadow">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          {saveBanner}
        </div>
      )}

      {/* My Assigned Audit & Admin Tasks */}
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

      {/* 1. PROFILE VIEW */}
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
                onClick={handleOpenEditProfile}
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
      ) : showFamilyEditor ? (
        /* 2. ADD / EDIT FAMILY MEMBER VIEW */
        <Card className="border-primary/40 bg-card/75 backdrop-blur-sm shadow-xl">
          <CardHeader>
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="flex items-center gap-2 text-primary">
                <Heart className="h-5 w-5" />
                {editingFamilyId ? 'Edit' : 'Add'} Family Member
              </CardTitle>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  resetFamilyForm()
                  setShowFamilyEditor(false)
                }}
                className="gap-1.5 text-xs text-muted-foreground hover:text-foreground"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Back to Edit Profile
              </Button>
            </div>
          </CardHeader>

          <CardContent className="space-y-3 text-sm">
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

            <div className="flex gap-2 pt-1">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  resetFamilyForm()
                  setShowFamilyEditor(false)
                }}
                className="w-1/3 text-xs"
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={handleSaveFamilyMember}
                className="w-2/3 gold-gradient text-gold-foreground font-semibold gap-2 text-xs"
              >
                <Plus className="h-4 w-4" />
                Save Family Member
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        /* 3. EDIT PROFILE FORM */
        <Card className="border-border/40 bg-card/60 backdrop-blur-sm">
          <CardHeader>
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="flex items-center gap-2 text-primary">
                <User className="h-5 w-5" />
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
                Back to Profile View
              </Button>
            </div>
          </CardHeader>

          <CardContent className="space-y-4 text-sm">
            {/* Credentials Section — Password fields remain strictly blank on open */}
            <h3 className="flex items-center gap-2 font-bold text-primary">
              <Lock className="h-4 w-4" />
              Account Credentials
            </h3>
            <div className="space-y-3 rounded-lg border border-border/50 bg-background/40 p-4">
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
              <hr className="border-border/30 my-2" />
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
            </div>

            <hr className="border-border/30" />

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
              <div className="sm:col-span-2">
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

              {/* Smart Contact Number */}
              <div className="sm:col-span-2">
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

              {/* Smart WhatsApp Number + Same-as-Contact Checkbox */}
              <div className="sm:col-span-2 space-y-1.5">
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

              <div className="sm:col-span-2">
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

            <div>
              <Label className="flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5 text-primary" />
                Permanent Address
              </Label>
              <Textarea value={permAddr} onChange={e => setPermAddr(e.target.value)} className="mt-1 h-12" />
            </div>
            <div>
              <Label>Permanent Google Map Link</Label>
              <Input
                value={permGeo}
                onChange={e => setPermGeo(e.target.value)}
                className="mt-1"
                placeholder="https://maps.google.com/..."
              />
            </div>
            <div>
              <Label className="flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5 text-primary" />
                Current Address
              </Label>
              <Textarea value={currAddr} onChange={e => setCurrAddr(e.target.value)} className="mt-1 h-12" />
            </div>
            <div>
              <Label>Current Google Map Link</Label>
              <Input
                value={currGeo}
                onChange={e => setCurrGeo(e.target.value)}
                className="mt-1"
                placeholder="https://maps.google.com/..."
              />
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

            <div>
              <Label>Personal Timeline / Notes</Label>
              <Textarea
                value={diary}
                onChange={e => setDiary(e.target.value)}
                className="mt-1 h-24 font-mono text-xs"
                placeholder="Add important life events here..."
              />
            </div>

            {/* Family Members Management Inside Edit Profile */}
            <hr className="border-border/30" />
            <div className="space-y-2.5 rounded-xl border border-primary/25 bg-primary/5 p-3.5">
              <div className="flex items-center justify-between gap-2">
                <h3 className="flex items-center gap-2 font-bold text-primary text-xs">
                  <Heart className="h-4 w-4" />
                  Family Members ({familyMembers.length})
                </h3>
                <Button
                  type="button"
                  size="sm"
                  onClick={openAddFamilyForm}
                  className="h-8 gold-gradient text-gold-foreground font-semibold gap-1.5 text-xs"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add Family Member
                </Button>
              </div>

              {familyMembers.length === 0 ? (
                <p className="text-xs italic text-muted-foreground">No family members added yet.</p>
              ) : (
                <div className="space-y-1.5">
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
            </div>

            {/* Profile Photo Upload & Preview */}
            <div className="space-y-2 rounded-xl border border-primary/25 bg-primary/5 p-3.5">
              <Label>Profile Photo (Automatically saved in your Gallery &amp; Folder)</Label>
              <div className="flex items-center gap-3 pt-1">
                {pic ? (
                  <img
                    src={pic}
                    alt="Profile preview"
                    className="h-16 w-16 rounded-full border border-primary/40 object-cover shrink-0"
                  />
                ) : (
                  <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full border border-border/50 bg-muted text-lg font-bold text-primary">
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

            <hr className="border-border/30" />
            <h3 className="flex items-center gap-2 font-bold text-primary">
              <Shield className="h-4 w-4" />
              Privacy Settings
            </h3>
            <div className="flex flex-wrap gap-4">
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={hidePeers} onCheckedChange={v => setHidePeers(!!v)} />
                <EyeOff className="h-3.5 w-3.5 text-muted-foreground" />
                Hide my profile from classmates
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={hideAdmin} onCheckedChange={v => setHideAdmin(!!v)} />
                <EyeOff className="h-3.5 w-3.5 text-muted-foreground" />
                Hide my profile from Admin
              </label>
            </div>

            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={saving}
                onClick={() => {
                  clearCredentialFields()
                  setIsEditing(false)
                }}
                className="w-1/3"
              >
                Cancel
              </Button>
              <Button
                type="button"
                disabled={saving || uploadingPic}
                onClick={handleSave}
                className="w-2/3 gold-gradient text-gold-foreground gap-2 font-semibold"
              >
                <Save className="h-4 w-4" />
                {saving ? 'Updating Profile...' : 'Update Profile'}
              </Button>
            </div>
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
