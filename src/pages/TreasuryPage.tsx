import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { supabase } from '@/lib/supabase'
import { formatFullDate, formatISTDateTime } from '@/lib/formatters'
import { checkCanManageTreasury, resolveOfficerDisplayName } from '@/lib/taskAuditService'
import { exportRowsToCSV, openPrintableReport } from '@/lib/reportExporter'
import SmartDateInput from '@/components/shared/SmartDateInput'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import {
  Wallet,
  ArrowLeft,
  ArrowDownLeft,
  ArrowUpRight,
  Landmark,
  ShieldCheck,
  Eye,
  FileSpreadsheet,
  Printer,
  Pencil,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  PieChart,
  Clock,
  UserCheck,
  Filter,
} from 'lucide-react'

export const TREASURY_CATEGORIES = [
  'Department Maintenance',
  'University Maintenance',
  'Get-Together Expenses',
  'Event Expenses',
  'Alumni Family Support',
  'Alumni Project',
  'Association Fund',
  'Others',
] as const

interface TreasuryTransaction {
  id: number
  fund_id: number | null
  entry_type: 'contribution' | 'expense'
  category: string | null
  custom_category: string | null
  member_id: number | null
  person_name: string
  amount: number
  payment_mode: string | null
  reference_no: string | null
  note: string | null
  entry_date: string
  recorded_by_id: number | null
  recorded_by_name: string | null
  updated_by_name: string | null
  created_at: string
  updated_at: string | null
}

interface CategoryBudgetRow {
  category: string
  allocated_budget: number
  notes: string | null
  updated_by_name: string | null
  updated_at: string | null
}

interface AccountInfoRow {
  id: number
  account_holder_name: string
  bank_name: string
  account_number: string
  ifsc_code: string
  upi_id: string
  account_notes: string
  updated_by_name: string | null
  updated_at: string | null
}

export default function TreasuryPage() {
  const { user, isAdmin } = useAuth()
  const navigate = useNavigate()

  const userIsAdmin = Boolean(isAdmin || user?.is_admin)

  const [canManageTreasury, setCanManageTreasury] = useState(userIsAdmin)
  const [officerLabel, setOfficerLabel] = useState<string>('')
  const [members, setMembers] = useState<Array<{ id: number; full_name: string }>>([])
  const [transactions, setTransactions] = useState<TreasuryTransaction[]>([])
  const [budgets, setBudgets] = useState<CategoryBudgetRow[]>([])
  const [accountInfo, setAccountInfo] = useState<AccountInfoRow>({
    id: 1,
    account_holder_name: 'Fenestrians Alumni Association',
    bank_name: '',
    account_number: '',
    ifsc_code: '',
    upi_id: '',
    account_notes: '',
    updated_by_name: null,
    updated_at: null,
  })

  const [loading, setLoading] = useState(true)
  const [statusBanner, setStatusBanner] = useState('')

  // Account Info Edit Modal / Inline State (Treasurer Only)
  const [editingAccount, setEditingAccount] = useState(false)
  const [accHolder, setAccHolder] = useState('')
  const [accBank, setAccBank] = useState('')
  const [accNumber, setAccNumber] = useState('')
  const [accIfsc, setAccIfsc] = useState('')
  const [accUpi, setAccUpi] = useState('')
  const [accNotes, setAccNotes] = useState('')
  const [savingAccount, setSavingAccount] = useState(false)

  // Budget Edit State per Category (Treasurer Only)
  const [editingBudgetCategory, setEditingBudgetCategory] = useState<string | null>(null)
  const [budgetInputAmount, setBudgetInputAmount] = useState('')
  const [budgetInputNotes, setBudgetInputNotes] = useState('')
  const [savingBudget, setSavingBudget] = useState(false)

  // Transaction Entry Form State (Treasurer Only: 'none' | 'contribution' | 'expense')
  const [activeEntryForm, setActiveEntryForm] = useState<'none' | 'contribution' | 'expense'>('none')
  const [editingTxId, setEditingTxId] = useState<number | null>(null)
  const [txCategory, setTxCategory] = useState<string>(TREASURY_CATEGORIES[0])
  const [txCustomCategory, setTxCustomCategory] = useState('')
  const [txMemberId, setTxMemberId] = useState('')
  const [txPersonName, setTxPersonName] = useState('')
  const [txAmount, setTxAmount] = useState('')
  const [txDate, setTxDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [txPaymentMode, setTxPaymentMode] = useState('UPI / Bank Transfer')
  const [txRefNo, setTxRefNo] = useState('')
  const [txNote, setTxNote] = useState('')
  const [savingTx, setSavingTx] = useState(false)

  // Ledger Filter States (Available to all members)
  const [filterCategory, setFilterCategory] = useState<string>('ALL')
  const [filterType, setFilterType] = useState<'ALL' | 'contribution' | 'expense'>('ALL')
  const [filterSearch, setFilterSearch] = useState('')

  useEffect(() => {
    if (!user) {
      navigate('/')
      return
    }
    loadTreasuryData()

    const channel = supabase
      .channel('treasury-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'association_transactions' },
        () => loadTreasuryData()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'treasury_category_budgets' },
        () => loadTreasuryData()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'treasury_account_info' },
        () => loadTreasuryData()
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [user, navigate])

  const showToast = (msg: string) => {
    setStatusBanner(msg)
    window.scrollTo({ top: 0, behavior: 'smooth' })
    setTimeout(() => setStatusBanner(''), 4000)
  }

  const loadTreasuryData = async () => {
    if (!user) return
    setLoading(true)

    const [txRes, budgetRes, accRes, membersRes, treasuryCheck, titledName] = await Promise.all([
      supabase
        .from('association_transactions')
        .select('*')
        .order('entry_date', { ascending: false })
        .order('created_at', { ascending: false }),
      supabase.from('treasury_category_budgets').select('*'),
      supabase.from('treasury_account_info').select('*').eq('id', 1).maybeSingle(),
      supabase
        .from('alumni')
        .select('id, full_name')
        .eq('is_placeholder', false)
        .neq('full_name', 'System Administrator')
        .order('full_name', { ascending: true }),
      checkCanManageTreasury(user.id),
      resolveOfficerDisplayName(user.id, user.full_name),
    ])

    setTransactions((txRes.data ?? []) as TreasuryTransaction[])
    setBudgets((budgetRes.data ?? []) as CategoryBudgetRow[])
    setMembers((membersRes.data ?? []) as Array<{ id: number; full_name: string }>)
    setOfficerLabel(titledName)
    setCanManageTreasury(Boolean(userIsAdmin || treasuryCheck.canManageTreasury))

    if (accRes.data) {
      setAccountInfo(accRes.data as AccountInfoRow)
    }

    setLoading(false)
  }

  const recordAuditLog = async (actionType: string, targetName: string, details: string) => {
    if (!user) return
    await supabase.from('admin_audit_logs').insert([
      {
        actor_id: user.id,
        actor_name: officerLabel || user.full_name,
        action_type: actionType,
        target_name: targetName,
        details,
      },
    ])
  }

  // Category-by-Category Accounting Summary
  const categorySummaries = useMemo(() => {
    return TREASURY_CATEGORIES.map(cat => {
      const catTxs = transactions.filter(
        t => (t.category || 'Association Fund').trim().toLowerCase() === cat.toLowerCase()
      )
      const received = catTxs
        .filter(t => t.entry_type === 'contribution')
        .reduce((sum, t) => sum + Number(t.amount || 0), 0)
      const spent = catTxs
        .filter(t => t.entry_type === 'expense')
        .reduce((sum, t) => sum + Number(t.amount || 0), 0)
      const balance = received - spent

      const budgetRow = budgets.find(
        b => b.category.trim().toLowerCase() === cat.toLowerCase()
      )
      const allocatedBudget = Number(budgetRow?.allocated_budget || 0)
      const budgetRemaining = allocatedBudget > 0 ? allocatedBudget - spent : balance

      return {
        category: cat,
        received,
        spent,
        balance,
        allocatedBudget,
        budgetRemaining,
        notes: budgetRow?.notes || '',
        txCount: catTxs.length,
      }
    })
  }, [transactions, budgets])

  // Overall Totals
  const totals = useMemo(() => {
    const totalReceived = transactions
      .filter(t => t.entry_type === 'contribution')
      .reduce((sum, t) => sum + Number(t.amount || 0), 0)
    const totalSpent = transactions
      .filter(t => t.entry_type === 'expense')
      .reduce((sum, t) => sum + Number(t.amount || 0), 0)
    const netBalance = totalReceived - totalSpent
    const totalBudgeted = categorySummaries.reduce((sum, c) => sum + c.allocatedBudget, 0)
    return { totalReceived, totalSpent, netBalance, totalBudgeted }
  }, [transactions, categorySummaries])

  // Filtered Transactions for Ledger View
  const filteredTransactions = useMemo(() => {
    const q = filterSearch.trim().toLowerCase()
    return transactions.filter(tx => {
      const cat = (tx.category || 'Association Fund').trim()
      if (filterCategory !== 'ALL' && cat.toLowerCase() !== filterCategory.toLowerCase()) {
        return false
      }
      if (filterType !== 'ALL' && tx.entry_type !== filterType) {
        return false
      }
      if (q) {
        const hay = [
          tx.person_name,
          cat,
          tx.custom_category,
          tx.reference_no,
          tx.note,
          tx.recorded_by_name,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
  }, [transactions, filterCategory, filterType, filterSearch])

  // --- TREASURER: UPDATE BANK / UPI ACCOUNT DETAILS ---
  const openAccountEditor = () => {
    setAccHolder(accountInfo.account_holder_name || 'Fenestrians Alumni Association')
    setAccBank(accountInfo.bank_name || '')
    setAccNumber(accountInfo.account_number || '')
    setAccIfsc(accountInfo.ifsc_code || '')
    setAccUpi(accountInfo.upi_id || '')
    setAccNotes(accountInfo.account_notes || '')
    setEditingAccount(true)
  }

  const handleSaveAccountInfo = async () => {
    if (!user || !canManageTreasury) return
    setSavingAccount(true)
    const nowIso = new Date().toISOString()
    const actor = officerLabel || user.full_name

    const { error } = await supabase.from('treasury_account_info').upsert([
      {
        id: 1,
        account_holder_name: accHolder.trim() || 'Fenestrians Alumni Association',
        bank_name: accBank.trim(),
        account_number: accNumber.trim(),
        ifsc_code: accIfsc.trim().toUpperCase(),
        upi_id: accUpi.trim(),
        account_notes: accNotes.trim(),
        updated_by_name: actor,
        updated_at: nowIso,
      },
    ])

    setSavingAccount(false)
    if (error) {
      alert('Could not update account details: ' + error.message)
      return
    }

    await recordAuditLog(
      'treasury_update_account_info',
      'Official Account Details',
      'Updated official association bank & UPI account details'
    )
    setEditingAccount(false)
    showToast('Official Association Bank & UPI Account details updated!')
    await loadTreasuryData()
  }

  // --- TREASURER: SET CATEGORY BUDGET ---
  const openBudgetEditor = (catSummary: (typeof categorySummaries)[number]) => {
    setEditingBudgetCategory(catSummary.category)
    setBudgetInputAmount(
      catSummary.allocatedBudget > 0 ? String(catSummary.allocatedBudget) : ''
    )
    setBudgetInputNotes(catSummary.notes || '')
  }

  const handleSaveCategoryBudget = async (categoryName: string) => {
    if (!user || !canManageTreasury) return
    const amt = Math.max(0, Number(budgetInputAmount) || 0)
    setSavingBudget(true)
    const actor = officerLabel || user.full_name
    const nowIso = new Date().toISOString()

    const { error } = await supabase.from('treasury_category_budgets').upsert([
      {
        category: categoryName,
        allocated_budget: amt,
        notes: budgetInputNotes.trim() || null,
        updated_by_name: actor,
        updated_at: nowIso,
      },
    ])

    setSavingBudget(false)
    if (error) {
      alert('Could not update category budget: ' + error.message)
      return
    }

    await recordAuditLog(
      'treasury_set_budget',
      categoryName,
      `Set budget for "${categoryName}" to ₹${amt.toLocaleString('en-IN')}`
    )
    setEditingBudgetCategory(null)
    showToast(`Budget for "${categoryName}" updated to ₹${amt.toLocaleString('en-IN')}!`)
    await loadTreasuryData()
  }

  // --- TREASURER: LOG / EDIT FUNDS RECEIVED & EXPENSES ---
  const resetTxForm = () => {
    setActiveEntryForm('none')
    setEditingTxId(null)
    setTxCategory(TREASURY_CATEGORIES[0])
    setTxCustomCategory('')
    setTxMemberId('')
    setTxPersonName('')
    setTxAmount('')
    setTxDate(new Date().toISOString().slice(0, 10))
    setTxPaymentMode('UPI / Bank Transfer')
    setTxRefNo('')
    setTxNote('')
  }

  const openNewTxForm = (type: 'contribution' | 'expense', defaultCategory?: string) => {
    setEditingTxId(null)
    setActiveEntryForm(type)
    setTxCategory(defaultCategory || TREASURY_CATEGORIES[0])
    setTxCustomCategory('')
    setTxMemberId('')
    setTxPersonName('')
    setTxAmount('')
    setTxDate(new Date().toISOString().slice(0, 10))
    setTxPaymentMode('UPI / Bank Transfer')
    setTxRefNo('')
    setTxNote('')
  }

  const openEditTxForm = (tx: TreasuryTransaction) => {
    setEditingTxId(tx.id)
    setActiveEntryForm(tx.entry_type)
    setTxCategory(tx.category || TREASURY_CATEGORIES[0])
    setTxCustomCategory(tx.custom_category || '')
    setTxMemberId(tx.member_id ? String(tx.member_id) : '')
    setTxPersonName(tx.person_name)
    setTxAmount(String(tx.amount))
    setTxDate(tx.entry_date || new Date().toISOString().slice(0, 10))
    setTxPaymentMode(tx.payment_mode || 'UPI / Bank Transfer')
    setTxRefNo(tx.reference_no || '')
    setTxNote(tx.note || '')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleSaveTransaction = async () => {
    if (!user || !canManageTreasury || activeEntryForm === 'none') return

    const amt = Number(txAmount)
    if (!txPersonName.trim()) {
      alert(
        activeEntryForm === 'contribution'
          ? 'Please select or enter the "Received From" name.'
          : 'Please enter the Payee / Vendor / Beneficiary name.'
      )
      return
    }
    if (!amt || amt <= 0) {
      alert('Please enter a valid positive amount in ₹.')
      return
    }
    if (txCategory === 'Others' && !txCustomCategory.trim()) {
      alert('Please specify the custom category name under "Others".')
      return
    }

    // Warn Treasurer if Expense exceeds available funds in that category
    if (activeEntryForm === 'expense' && !editingTxId) {
      const catStat = categorySummaries.find(c => c.category === txCategory)
      if (catStat && amt > catStat.balance) {
        const proceed = window.confirm(
          `Category Balance Notice:\n"${txCategory}" currently has ₹${catStat.balance.toLocaleString(
            'en-IN'
          )} available, and you are logging an expense of ₹${amt.toLocaleString(
            'en-IN'
          )}.\n\nClick OK to proceed and record this expense anyway, or Cancel to adjust.`
        )
        if (!proceed) return
      }
    }

    setSavingTx(true)
    const actor = officerLabel || user.full_name
    const nowIso = new Date().toISOString()

    if (editingTxId) {
      const { error } = await supabase
        .from('association_transactions')
        .update({
          entry_type: activeEntryForm,
          category: txCategory,
          custom_category: txCategory === 'Others' ? txCustomCategory.trim() : null,
          member_id: txMemberId ? Number(txMemberId) : null,
          person_name: txPersonName.trim(),
          amount: amt,
          entry_date: txDate || nowIso.slice(0, 10),
          payment_mode: txPaymentMode,
          reference_no: txRefNo.trim() || null,
          note: txNote.trim() || null,
          updated_by_name: actor,
          updated_at: nowIso,
        })
        .eq('id', editingTxId)

      setSavingTx(false)
      if (error) {
        alert('Error updating entry: ' + error.message)
        return
      }

      await recordAuditLog(
        'treasury_edit_entry',
        txCategory,
        `Edited ${activeEntryForm === 'contribution' ? 'Fund Received' : 'Expense'} of ₹${amt.toLocaleString('en-IN')} (${txPersonName.trim()}) under "${txCategory}"`
      )
      showToast('Treasury entry updated!')
    } else {
      const { error } = await supabase.from('association_transactions').insert([
        {
          entry_type: activeEntryForm,
          category: txCategory,
          custom_category: txCategory === 'Others' ? txCustomCategory.trim() : null,
          member_id: txMemberId ? Number(txMemberId) : null,
          person_name: txPersonName.trim(),
          amount: amt,
          entry_date: txDate || nowIso.slice(0, 10),
          payment_mode: txPaymentMode,
          reference_no: txRefNo.trim() || null,
          note: txNote.trim() || null,
          recorded_by_id: user.id,
          recorded_by_name: actor,
        },
      ])

      setSavingTx(false)
      if (error) {
        alert('Error saving entry: ' + error.message)
        return
      }

      await recordAuditLog(
        activeEntryForm === 'contribution' ? 'treasury_fund_received' : 'treasury_expense_done',
        txCategory,
        `Logged ${
          activeEntryForm === 'contribution'
            ? `Fund Received from ${txPersonName.trim()}`
            : `Expense paid to ${txPersonName.trim()}`
        } of ₹${amt.toLocaleString('en-IN')} towards "${
          txCategory === 'Others' ? `Others (${txCustomCategory.trim()})` : txCategory
        }"`
      )
      showToast(
        activeEntryForm === 'contribution'
          ? `Fund Received (₹${amt.toLocaleString('en-IN')}) logged under ${txCategory}!`
          : `Expense (₹${amt.toLocaleString('en-IN')}) logged under ${txCategory}!`
      )
    }

    resetTxForm()
    await loadTreasuryData()
  }

  const handleDeleteTransaction = async (tx: TreasuryTransaction) => {
    if (!canManageTreasury) return
    if (
      !window.confirm(
        `Delete this ${
          tx.entry_type === 'contribution' ? 'Fund Received' : 'Expense'
        } entry of ₹${Number(tx.amount).toLocaleString('en-IN')} (${tx.person_name})?`
      )
    ) {
      return
    }

    await supabase.from('association_transactions').delete().eq('id', tx.id)
    await recordAuditLog(
      'treasury_delete_entry',
      tx.category || 'Association Fund',
      `Deleted ${
        tx.entry_type === 'contribution' ? 'Fund Received' : 'Expense'
      } of ₹${Number(tx.amount).toLocaleString('en-IN')} (${tx.person_name})`
    )
    showToast('Entry deleted from Treasury ledger.')
    await loadTreasuryData()
  }

  // --- CSV & PRINTABLE REPORTS ---
  const buildReportRows = () => {
    const headers = [
      'Entry Date',
      'Type',
      'Towards / Category',
      'Received From / Paid To',
      'Amount (INR)',
      'Mode & Ref No.',
      'Particulars / Note',
      'Logged By',
      'Logged Timestamp (IST)',
    ]
    const rows = filteredTransactions.map(tx => {
      const catDisplay =
        tx.category === 'Others' && tx.custom_category
          ? `Others (${tx.custom_category})`
          : tx.category || 'Association Fund'
      return [
        formatFullDate(tx.entry_date),
        tx.entry_type === 'contribution' ? 'FUND RECEIVED (+)' : 'EXPENSE (-)',
        catDisplay,
        tx.person_name,
        tx.amount,
        [tx.payment_mode, tx.reference_no ? `Ref: ${tx.reference_no}` : '']
          .filter(Boolean)
          .join(' | '),
        tx.note || '-',
        tx.recorded_by_name || 'Treasurer',
        formatISTDateTime(tx.created_at),
      ]
    })
    return { headers, rows }
  }

  const handleExportCsv = () => {
    const { headers, rows } = buildReportRows()
    exportRowsToCSV(
      `Fenestrians_Treasury_Accounts_${new Date().toISOString().slice(0, 10)}.csv`,
      headers,
      rows
    )
  }

  const handlePrintReport = () => {
    const { headers, rows } = buildReportRows()
    openPrintableReport(
      'Fenestrians Association Treasury & Account Statement',
      `Total Received: ₹${totals.totalReceived.toLocaleString('en-IN')} • Total Expenses: ₹${totals.totalSpent.toLocaleString('en-IN')} • Net Balance: ₹${totals.netBalance.toLocaleString('en-IN')}`,
      headers,
      rows
    )
  }

  if (!user) return null

  return (
    <div className="min-h-svh bg-background p-4 sm:p-6 pb-28">
      <div className="mx-auto max-w-6xl space-y-5">
        {/* Top Back Navigation */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => navigate('/dashboard')}
            className="gap-1.5 text-xs text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Dashboard
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => navigate('/alumni-association')}
            className="text-xs border-primary/40 text-primary hover:bg-primary/10"
          >
            Alumni Association Hub
          </Button>
        </div>

        {statusBanner && (
          <div className="flex items-center gap-2 rounded-xl border border-emerald-500/40 bg-emerald-500/15 px-4 py-3 text-xs font-semibold text-emerald-300 shadow">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            {statusBanner}
          </div>
        )}

        {/* HEADER & ROLE BANNER */}
        <Card className="border-primary/40 bg-card/85 backdrop-blur-md shadow-xl">
          <CardHeader className="pb-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="space-y-1">
                <CardTitle className="flex items-center gap-2 text-xl sm:text-2xl font-bold text-primary">
                  <Wallet className="h-6 w-6" />
                  Fenestrians Treasury &amp; Accounts
                </CardTitle>
                <CardDescription className="text-xs">
                  Official Association Bank Details, Category-Wise Funds, Budgets &amp; Audited Transaction Ledger
                </CardDescription>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {canManageTreasury ? (
                  <Badge className="bg-emerald-600/25 text-emerald-300 border border-emerald-500/40 gap-1 text-xs py-1 px-2.5">
                    <ShieldCheck className="h-3.5 w-3.5" />
                    Treasurer Accounting Access
                  </Badge>
                ) : (
                  <Badge
                    variant="outline"
                    className="border-border/60 text-muted-foreground gap-1 text-xs py-1 px-2.5"
                  >
                    <Eye className="h-3.5 w-3.5 text-primary" />
                    View-Only Member Access
                  </Badge>
                )}

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleExportCsv}
                  className="h-8 text-xs gap-1"
                >
                  <FileSpreadsheet className="h-3.5 w-3.5" />
                  Export CSV
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handlePrintReport}
                  className="h-8 text-xs gap-1"
                >
                  <Printer className="h-3.5 w-3.5" />
                  Print Statement
                </Button>
              </div>
            </div>

            {/* TREASURER PRIMARY ACTION BUTTONS */}
            {canManageTreasury && (
              <div className="flex flex-wrap gap-2.5 pt-3 border-t border-border/30">
                <Button
                  type="button"
                  onClick={() =>
                    activeEntryForm === 'contribution' && !editingTxId
                      ? resetTxForm()
                      : openNewTxForm('contribution')
                  }
                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold gap-1.5 text-xs"
                >
                  <ArrowDownLeft className="h-4 w-4" />
                  Log Fund Received (+)
                </Button>

                <Button
                  type="button"
                  onClick={() =>
                    activeEntryForm === 'expense' && !editingTxId
                      ? resetTxForm()
                      : openNewTxForm('expense')
                  }
                  className="bg-rose-600 hover:bg-rose-500 text-white font-bold gap-1.5 text-xs"
                >
                  <ArrowUpRight className="h-4 w-4" />
                  Log Expense Done (-)
                </Button>
              </div>
            )}
          </CardHeader>

          {/* OVERALL FINANCIAL SUMMARY */}
          <CardContent className="pt-0">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-center">
                <p className="text-[11px] text-muted-foreground">Total Funds Received</p>
                <p className="text-base sm:text-lg font-bold text-emerald-400">
                  ₹{totals.totalReceived.toLocaleString('en-IN')}
                </p>
              </div>

              <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-center">
                <p className="text-[11px] text-muted-foreground">Total Expenses Done</p>
                <p className="text-base sm:text-lg font-bold text-rose-400">
                  ₹{totals.totalSpent.toLocaleString('en-IN')}
                </p>
              </div>

              <div className="rounded-xl border border-primary/40 bg-primary/10 p-3 text-center">
                <p className="text-[11px] text-muted-foreground">Net Account Balance</p>
                <p className="text-base sm:text-lg font-bold text-primary">
                  ₹{totals.netBalance.toLocaleString('en-IN')}
                </p>
              </div>

              <div className="rounded-xl border border-sky-500/30 bg-sky-500/10 p-3 text-center">
                <p className="text-[11px] text-muted-foreground">Total Category Budgets</p>
                <p className="text-base sm:text-lg font-bold text-sky-300">
                  ₹{totals.totalBudgeted.toLocaleString('en-IN')}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* TREASURER ENTRY FORM: LOG FUND RECEIVED OR EXPENSE DONE */}
        {canManageTreasury && activeEntryForm !== 'none' && (
          <Card
            className={`border-2 ${
              activeEntryForm === 'contribution'
                ? 'border-emerald-500/50 bg-emerald-950/20'
                : 'border-rose-500/50 bg-rose-950/20'
            } shadow-xl`}
          >
            <CardHeader className="pb-2">
              <CardTitle
                className={`flex items-center gap-2 text-base ${
                  activeEntryForm === 'contribution' ? 'text-emerald-300' : 'text-rose-300'
                }`}
              >
                {activeEntryForm === 'contribution' ? (
                  <>
                    <ArrowDownLeft className="h-5 w-5" />
                    {editingTxId ? 'Edit Fund Received Entry' : 'Log Fund Received (+)'}
                  </>
                ) : (
                  <>
                    <ArrowUpRight className="h-5 w-5" />
                    {editingTxId ? 'Edit Expense Entry' : 'Log Expense Done (-)'}
                  </>
                )}
              </CardTitle>
            </CardHeader>

            <CardContent className="space-y-3 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Received From / Paid To Member Selector */}
                <div>
                  <Label>
                    {activeEntryForm === 'contribution'
                      ? 'Received From (Select Member)'
                      : 'Beneficiary / Member (Optional)'}
                  </Label>
                  <select
                    value={txMemberId}
                    onChange={e => {
                      const val = e.target.value
                      setTxMemberId(val)
                      const found = members.find(m => String(m.id) === val)
                      if (found) setTxPersonName(found.full_name)
                    }}
                    className="mt-1 w-full h-9 rounded-md border border-border/50 bg-background px-3 text-xs"
                  >
                    <option value="">-- Choose from Member Directory --</option>
                    {members.map(m => (
                      <option key={m.id} value={String(m.id)}>
                        {m.full_name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Received From / Paid To Text Name */}
                <div>
                  <Label>
                    {activeEntryForm === 'contribution'
                      ? 'Received From Name (Member / Sponsor) *'
                      : 'Paid To (Vendor / Payee / Beneficiary) *'}
                  </Label>
                  <Input
                    value={txPersonName}
                    onChange={e => setTxPersonName(e.target.value)}
                    placeholder={
                      activeEntryForm === 'contribution'
                        ? 'Enter donor or member name'
                        : 'Enter vendor, hospital, or recipient name'
                    }
                    className="mt-1 text-xs"
                  />
                </div>

                {/* Towards Category */}
                <div>
                  <Label>
                    {activeEntryForm === 'contribution'
                      ? 'Towards (Fund Category) *'
                      : 'Utilize From Category (Budget Head) *'}
                  </Label>
                  <select
                    value={txCategory}
                    onChange={e => setTxCategory(e.target.value)}
                    className="mt-1 w-full h-9 rounded-md border border-border/50 bg-background px-3 text-xs font-semibold"
                  >
                    {TREASURY_CATEGORIES.map(cat => {
                      const stat = categorySummaries.find(c => c.category === cat)
                      const balText =
                        activeEntryForm === 'expense' && stat
                          ? ` (Avail: ₹${stat.balance.toLocaleString('en-IN')})`
                          : ''
                      return (
                        <option key={cat} value={cat}>
                          {cat}
                          {balText}
                        </option>
                      )
                    })}
                  </select>
                </div>
              </div>

              {/* Custom Specification when "Others" is chosen */}
              {txCategory === 'Others' && (
                <div>
                  <Label className="text-primary">Specify “Others” Category / Purpose *</Label>
                  <Input
                    value={txCustomCategory}
                    onChange={e => setTxCustomCategory(e.target.value)}
                    placeholder="e.g., Guest Lecture Honorarium, Website Hosting, Printing"
                    className="mt-1 text-xs"
                  />
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div>
                  <Label>Amount (₹) *</Label>
                  <Input
                    type="number"
                    min={1}
                    value={txAmount}
                    onChange={e => setTxAmount(e.target.value)}
                    placeholder="e.g., 5000"
                    className="mt-1 text-xs font-bold"
                  />
                </div>

                <div>
                  <Label>Transaction Date *</Label>
                  <SmartDateInput value={txDate} onChange={setTxDate} className="mt-1" />
                </div>

                <div>
                  <Label>Payment Mode</Label>
                  <select
                    value={txPaymentMode}
                    onChange={e => setTxPaymentMode(e.target.value)}
                    className="mt-1 w-full h-9 rounded-md border border-border/50 bg-background px-3 text-xs"
                  >
                    <option value="UPI / Bank Transfer">UPI / Bank Transfer</option>
                    <option value="NEFT / IMPS">NEFT / IMPS</option>
                    <option value="Cash">Cash</option>
                    <option value="Cheque / DD">Cheque / DD</option>
                  </select>
                </div>

                <div>
                  <Label>UPI / Bank / Voucher Ref No.</Label>
                  <Input
                    value={txRefNo}
                    onChange={e => setTxRefNo(e.target.value)}
                    placeholder="Ref # / Receipt #"
                    className="mt-1 text-xs font-mono"
                  />
                </div>
              </div>

              <div>
                <Label>Particulars / Accounting Note</Label>
                <Input
                  value={txNote}
                  onChange={e => setTxNote(e.target.value)}
                  placeholder="Describe the purpose of receipt or expenditure..."
                  className="mt-1 text-xs"
                />
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                <span className="text-[11px] text-muted-foreground">
                  Will be logged by <strong className="text-primary">{officerLabel}</strong> with current IST timestamp.
                </span>

                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={resetTxForm}
                    className="text-xs"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    disabled={savingTx}
                    onClick={handleSaveTransaction}
                    className="gold-gradient text-gold-foreground font-bold text-xs"
                  >
                    {savingTx
                      ? 'Saving...'
                      : editingTxId
                      ? 'Update Entry'
                      : activeEntryForm === 'contribution'
                      ? 'Save Fund Received'
                      : 'Save Expense Entry'}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* OFFICIAL ASSOCIATION BANK & UPI ACCOUNT DETAILS */}
        <Card className="border-border/40 bg-card/75 backdrop-blur-sm">
          <CardHeader className="pb-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle className="flex items-center gap-2 text-base text-primary">
                <Landmark className="h-5 w-5" />
                Official Association Bank &amp; UPI Account Details
              </CardTitle>

              {canManageTreasury && !editingAccount && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={openAccountEditor}
                  className="h-7 text-xs gap-1 border-primary/40 text-primary"
                >
                  <Pencil className="h-3 w-3" />
                  Edit Account Details
                </Button>
              )}
            </div>
          </CardHeader>

          <CardContent className="text-xs">
            {canManageTreasury && editingAccount ? (
              <div className="space-y-3 rounded-xl border border-primary/30 bg-primary/5 p-3.5">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <div>
                    <Label>Account Holder Name</Label>
                    <Input
                      value={accHolder}
                      onChange={e => setAccHolder(e.target.value)}
                      className="mt-1 text-xs"
                    />
                  </div>
                  <div>
                    <Label>Bank Name &amp; Branch</Label>
                    <Input
                      value={accBank}
                      onChange={e => setAccBank(e.target.value)}
                      placeholder="e.g., State Bank of India, Main Branch"
                      className="mt-1 text-xs"
                    />
                  </div>
                  <div>
                    <Label>Account Number</Label>
                    <Input
                      value={accNumber}
                      onChange={e => setAccNumber(e.target.value)}
                      placeholder="Account Number"
                      className="mt-1 text-xs font-mono"
                    />
                  </div>
                  <div>
                    <Label>IFSC Code</Label>
                    <Input
                      value={accIfsc}
                      onChange={e => setAccIfsc(e.target.value)}
                      placeholder="e.g., SBIN0001234"
                      className="mt-1 text-xs font-mono uppercase"
                    />
                  </div>
                  <div>
                    <Label>Official UPI ID</Label>
                    <Input
                      value={accUpi}
                      onChange={e => setAccUpi(e.target.value)}
                      placeholder="e.g., fenestrians@sbi"
                      className="mt-1 text-xs font-mono"
                    />
                  </div>
                  <div>
                    <Label>Payment Instructions</Label>
                    <Input
                      value={accNotes}
                      onChange={e => setAccNotes(e.target.value)}
                      placeholder="e.g., Share UPI ref with Treasurer"
                      className="mt-1 text-xs"
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setEditingAccount(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    disabled={savingAccount}
                    onClick={handleSaveAccountInfo}
                    className="gold-gradient text-gold-foreground font-semibold"
                  >
                    {savingAccount ? 'Saving...' : 'Save Account Details'}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 rounded-xl border border-border/30 bg-muted/15 p-3">
                <div>
                  <p className="text-[10px] text-muted-foreground">Account Name</p>
                  <p className="font-bold text-foreground">
                    {accountInfo.account_holder_name || 'Fenestrians Alumni Association'}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground">Bank &amp; Account No.</p>
                  <p className="font-semibold text-foreground font-mono">
                    {accountInfo.bank_name || accountInfo.account_number
                      ? `${accountInfo.bank_name} ${
                          accountInfo.account_number ? `• A/C: ${accountInfo.account_number}` : ''
                        }`
                      : 'Not updated yet'}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground">IFSC / Official UPI ID</p>
                  <p className="font-semibold text-primary font-mono">
                    {[
                      accountInfo.ifsc_code ? `IFSC: ${accountInfo.ifsc_code}` : '',
                      accountInfo.upi_id ? `UPI: ${accountInfo.upi_id}` : '',
                    ]
                      .filter(Boolean)
                      .join(' • ') || 'Not updated yet'}
                  </p>
                </div>
                {accountInfo.account_notes && (
                  <div className="sm:col-span-3 border-t border-border/25 pt-1.5 text-[11px] text-muted-foreground">
                    Note: {accountInfo.account_notes}
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* CATEGORY-WISE BUDGET & ACCOUNTING LEDGER */}
        <Card className="border-border/40 bg-card/75 backdrop-blur-sm">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base text-primary">
              <PieChart className="h-5 w-5" />
              Category-Wise Funds, Budget &amp; Accounting
            </CardTitle>
            <CardDescription className="text-xs">
              Funds collected under each category are tracked separately for budgeting and expenditure control.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              {categorySummaries.map(cat => {
                const isOverspent = cat.balance < 0
                const pctUsed =
                  cat.received > 0
                    ? Math.min(100, Math.round((cat.spent / cat.received) * 100))
                    : cat.spent > 0
                    ? 100
                    : 0

                return (
                  <div
                    key={cat.category}
                    className="rounded-xl border border-border/40 bg-muted/15 p-3.5 space-y-2.5 text-xs"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="text-sm font-bold text-foreground">{cat.category}</h3>
                        <p className="text-[10px] text-muted-foreground">
                          {cat.txCount} transaction{cat.txCount === 1 ? '' : 's'}
                          {cat.notes ? ` • ${cat.notes}` : ''}
                        </p>
                      </div>

                      {canManageTreasury && (
                        <div className="flex items-center gap-1">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => openBudgetEditor(cat)}
                            className="h-6 px-2 text-[10px] border-primary/40 text-primary"
                          >
                            Set Budget
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            title={`Log Expense under ${cat.category}`}
                            onClick={() => openNewTxForm('expense', cat.category)}
                            className="h-6 w-6 text-rose-400 hover:bg-rose-500/15"
                          >
                            <ArrowUpRight className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-4 gap-1.5 rounded-lg border border-border/30 bg-background/60 p-2 text-center">
                      <div>
                        <p className="text-[9px] text-muted-foreground">Received</p>
                        <p className="font-bold text-emerald-400">
                          ₹{cat.received.toLocaleString('en-IN')}
                        </p>
                      </div>
                      <div>
                        <p className="text-[9px] text-muted-foreground">Budget</p>
                        <p className="font-bold text-sky-300">
                          ₹{cat.allocatedBudget.toLocaleString('en-IN')}
                        </p>
                      </div>
                      <div>
                        <p className="text-[9px] text-muted-foreground">Expenses</p>
                        <p className="font-bold text-rose-400">
                          ₹{cat.spent.toLocaleString('en-IN')}
                        </p>
                      </div>
                      <div>
                        <p className="text-[9px] text-muted-foreground">Available</p>
                        <p
                          className={`font-bold ${
                            isOverspent ? 'text-red-400' : 'text-primary'
                          }`}
                        >
                          ₹{cat.balance.toLocaleString('en-IN')}
                        </p>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <div className="flex justify-between text-[10px] text-muted-foreground">
                        <span>Fund Utilization ({pctUsed}%)</span>
                        {isOverspent && (
                          <span className="inline-flex items-center gap-1 text-red-400 font-semibold">
                            <AlertTriangle className="h-3 w-3" /> Deficit
                          </span>
                        )}
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-background overflow-hidden">
                        <div
                          style={{ width: `${pctUsed}%` }}
                          className={`h-full transition-all ${
                            isOverspent ? 'bg-red-500' : 'gold-gradient'
                          }`}
                        />
                      </div>
                    </div>

                    {/* Inline Budget Editor for Treasurer */}
                    {canManageTreasury && editingBudgetCategory === cat.category && (
                      <div className="rounded-lg border border-primary/40 bg-primary/5 p-2.5 space-y-2">
                        <p className="font-bold text-primary text-[11px]">
                          Allocate Budget for {cat.category}
                        </p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <Input
                            type="number"
                            min={0}
                            value={budgetInputAmount}
                            onChange={e => setBudgetInputAmount(e.target.value)}
                            placeholder="Budget Amount (₹)"
                            className="h-7 text-xs"
                          />
                          <Input
                            value={budgetInputNotes}
                            onChange={e => setBudgetInputNotes(e.target.value)}
                            placeholder="Budget note (optional)"
                            className="h-7 text-xs"
                          />
                        </div>
                        <div className="flex gap-1.5">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => setEditingBudgetCategory(null)}
                            className="h-7 text-[11px]"
                          >
                            Cancel
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            disabled={savingBudget}
                            onClick={() => handleSaveCategoryBudget(cat.category)}
                            className="h-7 gold-gradient text-gold-foreground font-semibold text-[11px]"
                          >
                            {savingBudget ? 'Saving...' : 'Save Budget'}
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>

        {/* COMPLETE AUDITED TRANSACTION LOG (WHO LOGGED IT & EXACT TIME IN IST) */}
        <Card className="border-border/40 bg-card/75 backdrop-blur-sm">
          <CardHeader className="pb-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle className="flex items-center gap-2 text-base text-primary">
                <Filter className="h-5 w-5" />
                Audited Receipts &amp; Expenses Log ({filteredTransactions.length})
              </CardTitle>
            </div>

            {/* Filters */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-2">
              <select
                value={filterCategory}
                onChange={e => setFilterCategory(e.target.value)}
                className="h-8 rounded-md border border-border/50 bg-background px-2.5 text-xs"
              >
                <option value="ALL">All Categories</option>
                {TREASURY_CATEGORIES.map(c => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>

              <select
                value={filterType}
                onChange={e =>
                  setFilterType(e.target.value as 'ALL' | 'contribution' | 'expense')
                }
                className="h-8 rounded-md border border-border/50 bg-background px-2.5 text-xs"
              >
                <option value="ALL">All Entries (Receipts &amp; Expenses)</option>
                <option value="contribution">Funds Received Only (+)</option>
                <option value="expense">Expenses Done Only (-)</option>
              </select>

              <Input
                value={filterSearch}
                onChange={e => setFilterSearch(e.target.value)}
                placeholder="Search donor, payee, ref #, or logger..."
                className="h-8 text-xs"
              />
            </div>
          </CardHeader>

          <CardContent className="space-y-2.5">
            {loading ? (
              <p className="py-8 text-center text-xs text-muted-foreground">
                Loading treasury ledger...
              </p>
            ) : filteredTransactions.length === 0 ? (
              <p className="rounded-xl border border-border/30 bg-muted/15 p-8 text-center text-xs text-muted-foreground">
                No treasury transactions found matching your filter.
              </p>
            ) : (
              filteredTransactions.map(tx => {
                const isReceipt = tx.entry_type === 'contribution'
                const catDisplay =
                  tx.category === 'Others' && tx.custom_category
                    ? `Others: ${tx.custom_category}`
                    : tx.category || 'Association Fund'

                return (
                  <div
                    key={tx.id}
                    className="rounded-xl border border-border/40 bg-muted/15 p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                  >
                    <div className="space-y-1 min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge
                          className={
                            isReceipt
                              ? 'bg-emerald-600/25 text-emerald-300 border border-emerald-500/40 text-[10px]'
                              : 'bg-rose-600/25 text-rose-300 border border-rose-500/40 text-[10px]'
                          }
                        >
                          {isReceipt ? 'FUND RECEIVED' : 'EXPENSE'}
                        </Badge>
                        <span className="font-bold text-sm text-foreground">{tx.person_name}</span>
                        <Badge variant="outline" className="border-primary/40 text-primary text-[10px]">
                          Towards: {catDisplay}
                        </Badge>
                      </div>

                      <div className="flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
                        <span>Entry Date: {formatFullDate(tx.entry_date)}</span>
                        {tx.payment_mode && <span>• Mode: {tx.payment_mode}</span>}
                        {tx.reference_no && (
                          <span className="font-mono text-foreground/80">
                            • Ref: {tx.reference_no}
                          </span>
                        )}
                      </div>

                      {tx.note && (
                        <p className="text-foreground/90 leading-snug">{tx.note}</p>
                      )}

                      {/* Audit Trail: Who Logged It and At What Time */}
                      <div className="flex flex-wrap items-center gap-3 pt-1 text-[10px] text-muted-foreground border-t border-border/20">
                        <span className="inline-flex items-center gap-1">
                          <UserCheck className="h-3 w-3 text-primary" />
                          Logged by: <strong className="text-foreground">{tx.recorded_by_name || 'Treasurer'}</strong>
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <Clock className="h-3 w-3 text-primary" />
                          Logged at: <strong className="text-foreground">{formatISTDateTime(tx.created_at)}</strong>
                        </span>
                        {tx.updated_by_name && tx.updated_at && (
                          <span>
                            • Edited by {tx.updated_by_name} ({formatISTDateTime(tx.updated_at)})
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-2 shrink-0">
                      <span
                        className={`text-base font-bold ${
                          isReceipt ? 'text-emerald-400' : 'text-rose-400'
                        }`}
                      >
                        {isReceipt ? '+' : '-'}₹{Number(tx.amount).toLocaleString('en-IN')}
                      </span>

                      {canManageTreasury && (
                        <div className="flex items-center gap-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            title="Edit Entry"
                            onClick={() => openEditTxForm(tx)}
                            className="h-7 w-7 text-primary hover:bg-primary/10"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            title="Delete Entry"
                            onClick={() => handleDeleteTransaction(tx)}
                            className="h-7 w-7 text-destructive hover:bg-destructive/10"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
