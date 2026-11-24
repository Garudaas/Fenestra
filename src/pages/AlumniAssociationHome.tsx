import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { supabase } from '@/lib/supabase'
import { publishArchivedAlert } from '@/lib/notificationService'
import { formatFullDate } from '@/lib/formatters'
import { checkIsPresidentOrGenSec, checkCanManageTreasury } from '@/lib/taskAuditService'
import { downloadIcsEvent, buildGoogleCalendarUrl } from '@/lib/calendarSync'
import { exportRowsToCSV, openPrintableReport } from '@/lib/reportExporter'
import SmartDateInput from '@/components/shared/SmartDateInput'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import {
  Building2,
  ArrowLeft,
  Award,
  CalendarDays,
  GraduationCap,
  Plus,
  Trash2,
  MapPin,
  Users,
  HandHeart,
  CheckCircle2,
  ExternalLink,
  Megaphone,
  ShieldCheck,
  Vote,
  Wallet,
  FileText,
  Download,
  CalendarPlus,
  FileSpreadsheet,
  Printer,
  Upload,
  Pencil,
  Eye,
  ArrowDownLeft,
  ArrowUpRight,
} from 'lucide-react'

interface CommitteeMember {
  id: number
  alumni_id: number | null
  member_name: string
  role_title: string
  bio_note: string | null
  display_order: number
}

interface AnnouncementItem {
  id: number
  title: string
  meeting_date: string | null
  venue_or_link: string | null
  details: string
  minutes_url: string | null
  minutes_file_name: string | null
  resolution_summary: string | null
  created_by_name: string | null
  created_at: string
}

interface RsvpRecord {
  id: number
  event_key: string
  user_id: number
  member_name: string
  response: 'going' | 'maybe' | 'not_going'
}

interface PollItem {
  id: number
  question: string
  options_json: string[]
  closes_at: string | null
  is_closed: boolean
  created_by_name: string | null
  created_at: string
}

interface PollVoteRecord {
  id: number
  poll_id: number
  user_id: number
  member_name: string
  option_index: number
}

interface FundItem {
  id: number
  title: string
  category: string
  target_amount: number
  description: string | null
  status: string
  created_at: string
}

interface TransactionItem {
  id: number
  fund_id: number
  entry_type: 'contribution' | 'expense'
  member_id: number | null
  person_name: string
  amount: number
  reference_no: string | null
  note: string | null
  entry_date: string
  recorded_by_name: string | null
}

interface MentorshipEntry {
  id: number
  alumni_id: number
  member_name: string
  role_type: 'mentor' | 'mentee'
  domain_area: string
