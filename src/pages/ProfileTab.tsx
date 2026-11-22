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
    if (
