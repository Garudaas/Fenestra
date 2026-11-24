import { useState, useEffect, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { supabase } from '@/lib/supabase'
import { publishArchivedAlert, type AuditActionItem } from '@/lib/notificationService'
import {
  resolveOfficerDisplayName,
  fetchSingleMemberAssociationRole,
  type AssociationRoleBadgeInfo,
} from '@/lib/taskAuditService'
import { formatFullDate, cleanPhoneNumber } from '@/lib/formatters'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  X,
  ArrowLeft,
  Video,
  MessageCircle,
  Phone,
  Mail,
  MapPin,
  Heart,
  GraduationCap,
  Briefcase,
  CalendarDays,
  Droplets,
  Lock,
  AlertTriangle,
  BellRing,
  CheckCircle2,
  Download,
  ExternalLink,
  Send,
  Award,
} from 'lucide-react'

export default function MemberProfilePage() {
  const { id } = useParams<{ id: string }>()
  const { user, isAdmin } = useAuth()
  const navigate = useNavigate()

  const [member, setMember] = useState<any | null>(null)
  const [associationRole, setAssociationRole] = useState<AssociationRoleBadgeInfo>({
    label: 'Member of Association',
    kind: 'member',
  })
  const [familyList, setFamilyList] = useState<any[]>([])
  const [skippedKeys, setSkippedKeys] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [showPhotoModal, setShowPhotoModal] = useState(false)

  const [sendingRequest, setSendingRequest] = useState(false)
  const [requestSent, setRequestSent] = useState(false)
  const [lastRequestMessage, setLastRequestMessage] = useState('')

  const userIsAdmin = Boolean(isAdmin || user?.is_admin)

  useEffect(() => {
    if (!user) {
      navigate('/')
      return
    }
    if (!id) {
      navigate('/dashboard')
      return
    }
    loadMemberProfile(Number(id))
  }, [id, user, navigate])

  const loadMemberProfile = async (memberId: number) => {
    setLoading(true)
    const [memberRes, familyRes, prefsRes] = await Promise.all([
      supabase
        .from('alumni_directory_safe')
        .select('*')
        .eq('id', memberId)
        .eq('is_placeholder', false)
        .maybeSingle(),
      supabase
        .from('family_members')
        .select('*')
        .eq('alumni_id', memberId),
      supabase
        .from('audit_preferences')
        .select('target_key')
        .eq('user_id', memberId)
        .eq('preference_type', 'skip_missing_field'),
    ])

    let profileRow = memberRes.data
    if (!profileRow) {
      const fallbackRes = await supabase
        .from('alumni')
        .select('*')
        .eq('id', memberId)
        .eq('is_placeholder', false)
        .maybeSingle()
      profileRow = fallbackRes.data
    }

    if (profileRow) {
      const roleInfo = await fetchSingleMemberAssociationRole(memberId, profileRow.is_admin)
      setAssociationRole(roleInfo)
    }

    setMember(profileRow || null)
    setFamilyList(familyRes.data ?? [])
    setSkippedKeys(new Set((prefsRes.data ?? []).map((p: any) => String(p.target_key))))
    setLoading(false)
  }

  const incompleteItems = useMemo<AuditActionItem[]>(() => {
    if (!member) return []
    const items: AuditActionItem[] = []

    const addIfMissing = (isMissing: boolean, targetKey: string, label: string) => {
      if (isMissing && !skippedKeys.has(targetKey)) {
        items.push({
          label,
          preferenceType: 'skip_missing_field',
          targetKey,
        })
      }
    }

    addIfMissing(!member.profile_picture_url, 'profile_picture_url', 'Profile Picture')
    addIfMissing(!member.dob, 'dob', 'Date of Birth')
    addIfMissing(!member.blood_group || !String(member.blood_group).trim(), 'blood_group', 'Blood Group')
    addIfMissing(!member.education_level || !String(member.education_level).trim(), 'education_level', 'Education Level')
    addIfMissing(!cleanPhoneNumber(member.contact_number), 'contact_number', 'Contact Number')
    addIfMissing(!cleanPhoneNumber(member.whatsapp_number), 'whatsapp_number', 'WhatsApp Number')
    addIfMissing(!member.current_status || !String(member.current_status).trim(), 'current_status', 'Current Career Status / Profession')
    addIfMissing(!member.permanent_address || !String(member.permanent_address).trim(), 'permanent_address', 'Permanent Address')
    addIfMissing(!member.current_address || !String(member.current_address).trim(), 'current_address', 'Current Address')

    if (member.marital_status?.toLowerCase() === 'married') {
      addIfMissing(!member.wedding_date, 'wedding_date', 'Wedding Date')
    }

    if (familyList.length === 0) {
      addIfMissing(true, 'family_details', 'Family Details')
    } else {
      for (const fm of familyList) {
        if (fm.is_private) continue
        addIfMissing(!fm.dob, `family_${fm.id}_dob`, `Birthday for ${fm.name} (Family)`)
        addIfMissing(!fm.blood_group || !String(fm.blood_group).trim(), `family_${fm.id}_blood_group`, `Blood Group for ${fm.name} (Family)`)
        addIfMissing(!fm.education_level || !String(fm.education_level).trim(), `family_${fm.id}_education_level`, `Education Level for ${fm.name} (Family)`)
      }
    }

    return items
  }, [member, familyList, skippedKeys])

  const getMapLink = (loc: string | null) => {
    if (!loc) return null
    const clean = loc.trim()
    if (!clean) return null
    if (clean.startsWith('http://') || clean.startsWith('https://')) return clean
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(clean)}`
  }

  const handleSavePhoto = async () => {
    if (!member?.profile_picture_url) return
    try {
      const response = await fetch(member.profile_picture_url)
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${(member.full_name || 'member').replace(/\s+/g, '_')}_profile.jpg`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch {
      window.open(member.profile_picture_url, '_blank', 'noopener,noreferrer')
    }
  }

  const buildWhatsAppUrl = (cleanWaE164: string, text: string) => {
    const digits = cleanWaE164.replace(/[^0-9]/g, '')
    return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`
  }

  const buildMailtoUrl = (emailAddr: string, text: string) => {
    const subject = 'Request to Complete Profile Details - Fenestrians App'
    return `mailto:${encodeURIComponent(emailAddr)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(text)}`
  }

  const handleSendCompletionRequest = async () => {
    if (!user || !member || incompleteItems.length === 0) return

    const senderTitledName = await resolveOfficerDisplayName(user.id, user.full_name)
    const bulletList = incompleteItems.map(item => `• ${item.label}`).join('\n')
    const formattedMessage = `${senderTitledName} has requested you to complete the below details in your profile in the Fenestrians App:\n\n${bulletList}`

    const subItems = incompleteItems.map((item, idx) => ({
      id: `peer_${idx}_${item.targetKey}`,
      label: item.label,
      fieldKey: item.targetKey,
      preferenceType: item.preferenceType,
      completed: false,
      optedOut: false,
    }))

    setSendingRequest(true)
    try {
      const { data: createdTask } = await supabase
        .from('member_tasks')
        .insert([
          {
            assigned_to_user_id: member.id,
            assigned_by_user_id: user.id,
            task_type: 'peer_profile_request',
            field_key: incompleteItems.map(i => i.targetKey).join(','),
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
        targetUserId: member.id,
        metadata: {
          task_id: createdTask?.id,
          is_micromanaged: false,
          audit_items: incompleteItems,
        },
      })

      setLastRequestMessage(formattedMessage)
      setRequestSent(true)

      const cleanWa = cleanPhoneNumber(member.whatsapp_number)
      const hasEmail = Boolean(member.email && member.email.trim())

      if (clean
