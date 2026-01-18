import { useState, useEffect } from 'react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Progress } from '@/components/ui/progress'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import {
  Home as HomeIcon,
  FileText,
  CheckCircle,
  XCircle,
  Clock,
  Upload,
  DollarSign,
  Calendar,
  User,
  AlertTriangle,
  ChevronRight,
  Eye,
  ThumbsUp,
  ThumbsDown,
  Filter,
  Search,
  Plus,
  Receipt,
  Building,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Info
} from 'lucide-react'
import { callAIAgent, uploadFiles, type NormalizedAgentResponse } from '@/utils/aiAgent'

// =============================================================================
// TypeScript Interfaces from ACTUAL Test Response Schemas
// =============================================================================

// Expense Validation Manager Response (Manager Agent)
interface ValidationSummary {
  receipt_authentication: {
    passed: boolean
    score: number
    issues: string[]
  }
  policy_compliance: {
    passed: boolean
    violations: Array<{
      policy_name: string
      violation_type: string
      severity: string
      description: string
    }>
  }
  business_rules: {
    passed: boolean
    violations: Array<{
      rule_name: string
      violation_type: string
      severity: string
      description: string
    }>
  }
}

interface ExpenseValidationResult {
  final_decision: 'approved' | 'rejected' | 'escalated'
  validation_summary: ValidationSummary
  escalation_reasons: string[]
  aggregated_recommendation: string
  next_steps: string[]
}

// Receipt Authenticator Response
interface ReceiptAuthResult {
  authenticity_score: number
  is_authentic: boolean
  fraud_indicators: string[]
  duplicate_detected: boolean
  metadata_analysis: {
    receipt_date: string
    file_creation_date: string
    discrepancy: boolean
  }
  recommendation: string
}

// Policy Compliance Response
interface PolicyComplianceResult {
  is_compliant: boolean
  policy_violations: Array<{
    policy_name: string
    violation_type: string
    severity: string
    description: string
  }>
  spending_limit_check: {
    category: string
    amount: number
    limit: number
    within_limit: boolean
  }
  documentation_check: {
    required_documents: string[]
    provided_documents: string[]
    missing_documents: string[]
    is_complete: boolean
  }
  recommendation: string
}

// Business Rules Response
interface BusinessRulesResult {
  is_eligible: boolean
  business_rule_violations: Array<{
    rule_name: string
    violation_type: string
    severity: string
    description: string
  }>
  location_check: {
    work_location: string
    expense_location: string
    is_reasonable: boolean
    distance_km: number
  }
  authorization_check: {
    requires_authorization: boolean
    is_authorized: boolean
    authorization_details: string
  }
  budget_check: {
    department: string
    budget_available: number
    expense_amount: number
    within_budget: boolean
  }
  recommendation: string
}

// Manager Decision Response
interface ManagerDecisionResult {
  decision: 'approved' | 'rejected'
  expense_id: string
  manager_notes: string
  decision_timestamp: string
  employee_notified: boolean
  notification_details: {
    email_sent: boolean
    recipient: string
    subject: string
  }
  audit_trail: {
    decision_by: string
    previous_status: string
    new_status: string
    recorded_at: string
  }
  next_steps: string[]
}

// Local Expense Data Structure
interface Expense {
  id: string
  employee_name: string
  employee_id: string
  category: string
  amount: number
  date: string
  merchant: string
  description: string
  receipt_url?: string
  status: 'pending' | 'approved' | 'rejected' | 'escalated' | 'processing'
  validation_result?: ExpenseValidationResult
  manager_decision?: ManagerDecisionResult
  submitted_at: string
  days_pending?: number
}

// Agent IDs
const AGENT_IDS = {
  EXPENSE_VALIDATION_MANAGER: '696d54bcc3a33af8ef060e65',
  RECEIPT_AUTHENTICATOR: '696d5472c3a33af8ef060e5c',
  POLICY_COMPLIANCE: '696d5488c3a33af8ef060e60',
  BUSINESS_RULES: '696d549fc3a33af8ef060e61',
  MANAGER_DECISION: '696d54e8e1e4c42b224aff77'
}

// =============================================================================
// Mock Data
// =============================================================================

const INITIAL_EXPENSES: Expense[] = [
  {
    id: 'EXP-2026-001',
    employee_name: 'John Doe',
    employee_id: 'EMP-12345',
    category: 'Meals',
    amount: 85.50,
    date: '2026-01-15',
    merchant: 'Restaurant ABC',
    description: 'Client dinner meeting',
    status: 'escalated',
    submitted_at: '2026-01-16T10:30:00Z',
    days_pending: 2
  },
  {
    id: 'EXP-2026-002',
    employee_name: 'Jane Smith',
    employee_id: 'EMP-67890',
    category: 'Travel',
    amount: 450.00,
    date: '2026-01-12',
    merchant: 'Swiss Rail',
    description: 'Travel to Bern office',
    status: 'approved',
    submitted_at: '2026-01-13T09:15:00Z'
  },
  {
    id: 'EXP-2026-003',
    employee_name: 'Mike Johnson',
    employee_id: 'EMP-11111',
    category: 'Office Supplies',
    amount: 125.00,
    date: '2026-01-14',
    merchant: 'Office Depot',
    description: 'Team supplies',
    status: 'pending',
    submitted_at: '2026-01-15T14:20:00Z',
    days_pending: 3
  }
]

// =============================================================================
// Utility Functions
// =============================================================================

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('de-CH', {
    style: 'currency',
    currency: 'CHF'
  }).format(amount)
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('de-CH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  })
}

// =============================================================================
// Sub-Components
// =============================================================================

function StatusBadge({ status }: { status: Expense['status'] }) {
  const variants = {
    approved: 'bg-green-100 text-green-800 border-green-200',
    rejected: 'bg-[#F20505] text-white border-[#F20505]',
    escalated: 'bg-gradient-to-r from-[#0541FF] to-[#9428FF] text-white',
    pending: 'bg-amber-100 text-amber-800 border-amber-200',
    processing: 'bg-gradient-to-r from-[#0541FF] to-[#9428FF] text-white'
  }

  const labels = {
    approved: 'Approved',
    rejected: 'Rejected',
    escalated: 'Escalated',
    pending: 'Pending',
    processing: 'Processing'
  }

  return (
    <Badge className={cn('border', variants[status])}>
      {labels[status]}
    </Badge>
  )
}

function Sidebar({ currentView, onViewChange, userRole }: {
  currentView: string
  onViewChange: (view: string) => void
  userRole: 'employee' | 'manager'
}) {
  const employeeItems = [
    { id: 'dashboard', label: 'Dashboard', icon: HomeIcon },
    { id: 'submit', label: 'Submit Expense', icon: Plus },
    { id: 'history', label: 'My Expenses', icon: FileText }
  ]

  const managerItems = [
    { id: 'manager-queue', label: 'Review Queue', icon: AlertTriangle },
    { id: 'dashboard', label: 'Dashboard', icon: HomeIcon }
  ]

  const items = userRole === 'manager' ? managerItems : employeeItems

  return (
    <div className="w-64 h-screen bg-[#001155] text-white flex flex-col">
      <div className="p-6">
        <div className="flex items-center gap-2 mb-8">
          <Receipt className="h-8 w-8" />
          <div>
            <h1 className="text-xl font-bold">ExpenseFlow</h1>
            <p className="text-xs text-white/60">Swisscom</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 px-3">
        {items.map((item) => {
          const Icon = item.icon
          return (
            <button
              key={item.id}
              onClick={() => onViewChange(item.id)}
              className={cn(
                'w-full flex items-center gap-3 px-4 py-3 rounded-lg mb-1 transition-colors',
                currentView === item.id
                  ? 'bg-white/10 text-white'
                  : 'text-white/70 hover:bg-white/5 hover:text-white'
              )}
            >
              <Icon className="h-5 w-5" />
              <span className="text-sm font-medium">{item.label}</span>
            </button>
          )
        })}
      </nav>

      <div className="p-4 border-t border-white/10">
        <div className="flex items-center gap-3 px-2">
          <div className="h-10 w-10 rounded-full bg-white/10 flex items-center justify-center">
            <User className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium">
              {userRole === 'manager' ? 'Manager View' : 'Employee View'}
            </p>
            <p className="text-xs text-white/60">Role: {userRole}</p>
          </div>
        </div>
      </div>
    </div>
  )
}

function DashboardView({ expenses, onViewExpense, userRole }: {
  expenses: Expense[]
  onViewExpense: (expense: Expense) => void
  userRole: 'employee' | 'manager'
}) {
  const stats = {
    total: expenses.length,
    approved: expenses.filter(e => e.status === 'approved').length,
    pending: expenses.filter(e => e.status === 'pending' || e.status === 'processing').length,
    rejected: expenses.filter(e => e.status === 'rejected').length,
    escalated: expenses.filter(e => e.status === 'escalated').length
  }

  const totalAmount = expenses.reduce((sum, e) => sum + e.amount, 0)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-[#1A1A1A]">Dashboard</h1>
        <p className="text-[#666666]">Overview of expense submissions</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-[#F4F4F4]">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-[#666666]">Total Expenses</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-[#1A1A1A]">{stats.total}</div>
            <p className="text-xs text-[#666666] mt-1">{formatCurrency(totalAmount)}</p>
          </CardContent>
        </Card>

        <Card className="bg-[#F4F4F4]">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-[#666666]">Approved</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <div className="text-2xl font-bold text-green-600">{stats.approved}</div>
              <CheckCircle className="h-5 w-5 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-[#F4F4F4]">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-[#666666]">Pending</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <div className="text-2xl font-bold text-amber-600">{stats.pending}</div>
              <Clock className="h-5 w-5 text-amber-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-[#F4F4F4]">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-[#666666]">
              {userRole === 'manager' ? 'Escalated' : 'Rejected'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <div className="text-2xl font-bold text-[#F20505]">
                {userRole === 'manager' ? stats.escalated : stats.rejected}
              </div>
              {userRole === 'manager' ? (
                <AlertTriangle className="h-5 w-5 text-[#F20505]" />
              ) : (
                <XCircle className="h-5 w-5 text-[#F20505]" />
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-[#1A1A1A]">Recent Expenses</CardTitle>
          <CardDescription>Latest expense submissions</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Employee</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {expenses.slice(0, 5).map((expense) => (
                <TableRow key={expense.id} className="hover:bg-[#F4F4F4]">
                  <TableCell className="font-medium">{expense.id}</TableCell>
                  <TableCell>{expense.employee_name}</TableCell>
                  <TableCell>{expense.category}</TableCell>
                  <TableCell>{formatCurrency(expense.amount)}</TableCell>
                  <TableCell>{formatDate(expense.date)}</TableCell>
                  <TableCell>
                    <StatusBadge status={expense.status} />
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onViewExpense(expense)}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}

function SubmitExpenseView({ onSubmitComplete }: { onSubmitComplete: (expense: Expense) => void }) {
  const [category, setCategory] = useState('')
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState('')
  const [merchant, setMerchant] = useState('')
  const [description, setDescription] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [result, setResult] = useState<NormalizedAgentResponse | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (selectedFile) {
      if (selectedFile.size > 10 * 1024 * 1024) {
        setError('File size must be less than 10MB')
        return
      }
      setFile(selectedFile)
      setError(null)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setProgress(10)
    setError(null)
    setResult(null)

    try {
      // Upload receipt if provided
      let assetIds: string[] | undefined
      if (file) {
        setProgress(30)
        const uploadResult = await uploadFiles(file)
        if (!uploadResult.success) {
          throw new Error(uploadResult.error || 'File upload failed')
        }
        assetIds = uploadResult.asset_ids
      }

      setProgress(50)

      // Build message for Expense Validation Manager
      const message = `Process expense submission: Employee John Doe (ID: EMP-12345) uploaded a ${category} receipt for ${formatCurrency(parseFloat(amount))} from ${merchant} on ${date}. Category: ${category}. Employee location: Zurich office. ${description ? `Notes: ${description}` : ''}`

      // Call Expense Validation Manager
      const agentResult = await callAIAgent(
        message,
        AGENT_IDS.EXPENSE_VALIDATION_MANAGER,
        assetIds ? { assets: assetIds } : undefined
      )

      setProgress(90)

      if (!agentResult.success) {
        throw new Error(agentResult.error || 'Agent call failed')
      }

      setResult(agentResult.response)

      // Create expense record
      const validationResult = agentResult.response.result as ExpenseValidationResult
      const newExpense: Expense = {
        id: `EXP-2026-${String(Date.now()).slice(-3)}`,
        employee_name: 'John Doe',
        employee_id: 'EMP-12345',
        category,
        amount: parseFloat(amount),
        date,
        merchant,
        description,
        status: validationResult.final_decision === 'approved' ? 'approved' :
                validationResult.final_decision === 'rejected' ? 'rejected' : 'escalated',
        validation_result: validationResult,
        submitted_at: new Date().toISOString()
      }

      setProgress(100)

      // Save to localStorage
      const stored = localStorage.getItem('expenses')
      const expenses = stored ? JSON.parse(stored) : []
      expenses.unshift(newExpense)
      localStorage.setItem('expenses', JSON.stringify(expenses))

      setTimeout(() => {
        onSubmitComplete(newExpense)
      }, 500)

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Submission failed')
      setProgress(0)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-[#1A1A1A]">Submit Expense</h1>
        <p className="text-[#666666]">Upload receipt and expense details</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-[#1A1A1A]">Expense Details</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="receipt">Receipt Upload</Label>
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-[#0541FF] transition-colors">
                <Input
                  id="receipt"
                  type="file"
                  accept=".jpg,.jpeg,.png,.pdf"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <label htmlFor="receipt" className="cursor-pointer">
                  <Upload className="h-12 w-12 mx-auto mb-4 text-[#666666]" />
                  <p className="text-sm text-[#666666]">
                    {file ? file.name : 'Click to upload or drag and drop'}
                  </p>
                  <p className="text-xs text-[#666666] mt-1">JPG, PNG, PDF up to 10MB</p>
                </label>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="category">Category</Label>
                <Select value={category} onValueChange={setCategory} required>
                  <SelectTrigger id="category">
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Meals">Meals</SelectItem>
                    <SelectItem value="Travel">Travel</SelectItem>
                    <SelectItem value="Accommodation">Accommodation</SelectItem>
                    <SelectItem value="Office Supplies">Office Supplies</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="amount">Amount (CHF)</Label>
                <Input
                  id="amount"
                  type="number"
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="date">Date</Label>
                <Input
                  id="date"
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="merchant">Merchant</Label>
                <Input
                  id="merchant"
                  value={merchant}
                  onChange={(e) => setMerchant(e.target.value)}
                  placeholder="Restaurant ABC"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Notes (Optional)</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Additional details about this expense..."
                rows={3}
              />
            </div>

            {loading && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm text-[#666666]">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Processing expense validation...
                </div>
                <Progress value={progress} className="h-2 bg-gradient-to-r from-[#0541FF] to-[#9428FF]" />
              </div>
            )}

            {error && (
              <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                <AlertCircle className="h-5 w-5 text-[#F20505] mt-0.5" />
                <p className="text-sm text-[#F20505]">{error}</p>
              </div>
            )}

            {result && (
              <div className="p-4 bg-[#F4F4F4] rounded-lg space-y-3">
                <div className="flex items-center gap-2">
                  {result.status === 'success' ? (
                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                  ) : (
                    <AlertCircle className="h-5 w-5 text-[#F20505]" />
                  )}
                  <p className="font-medium text-[#1A1A1A]">
                    {result.status === 'success' ? 'Validation Complete' : 'Validation Error'}
                  </p>
                </div>
                {result.result && (
                  <div className="text-sm text-[#666666] space-y-1">
                    <p><strong>Decision:</strong> {(result.result as ExpenseValidationResult).final_decision}</p>
                    {(result.result as ExpenseValidationResult).aggregated_recommendation && (
                      <p className="mt-2">{(result.result as ExpenseValidationResult).aggregated_recommendation}</p>
                    )}
                  </div>
                )}
              </div>
            )}

            <Button
              type="submit"
              className="w-full bg-[#0541FF] hover:bg-[#0541FF]/90"
              disabled={loading || !category || !amount || !date || !merchant}
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                'Submit Expense'
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

function ExpenseDetailView({ expense, onBack, onManagerAction }: {
  expense: Expense
  onBack: () => void
  onManagerAction?: (decision: 'approved' | 'rejected', notes: string) => void
}) {
  const [managerNotes, setManagerNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleManagerDecision = async (decision: 'approved' | 'rejected') => {
    if (!onManagerAction) return
    setSubmitting(true)

    try {
      await new Promise(resolve => setTimeout(resolve, 1000))
      onManagerAction(decision, managerNotes)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-3xl font-bold text-[#1A1A1A]">{expense.id}</h1>
            <StatusBadge status={expense.status} />
          </div>
          <p className="text-[#666666]">{expense.employee_name} • {formatDate(expense.date)}</p>
        </div>
        <Button variant="outline" onClick={onBack}>
          Back
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card className="bg-[#F4F4F4]">
            <CardHeader>
              <CardTitle className="text-[#1A1A1A]">Expense Information</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-[#666666]">Category</p>
                <p className="font-medium text-[#1A1A1A]">{expense.category}</p>
              </div>
              <div>
                <p className="text-sm text-[#666666]">Amount</p>
                <p className="font-medium text-[#1A1A1A]">{formatCurrency(expense.amount)}</p>
              </div>
              <div>
                <p className="text-sm text-[#666666]">Merchant</p>
                <p className="font-medium text-[#1A1A1A]">{expense.merchant}</p>
              </div>
              <div>
                <p className="text-sm text-[#666666]">Date</p>
                <p className="font-medium text-[#1A1A1A]">{formatDate(expense.date)}</p>
              </div>
              <div className="col-span-2">
                <p className="text-sm text-[#666666]">Description</p>
                <p className="font-medium text-[#1A1A1A]">{expense.description || 'No description provided'}</p>
              </div>
            </CardContent>
          </Card>

          {expense.validation_result && (
            <Card>
              <CardHeader>
                <CardTitle className="text-[#1A1A1A]">Validation Results</CardTitle>
              </CardHeader>
              <CardContent>
                <Accordion type="single" collapsible className="w-full">
                  <AccordionItem value="receipt" className="bg-[#F4F4F4] px-4 rounded-lg mb-2">
                    <AccordionTrigger className="hover:no-underline">
                      <div className="flex items-center gap-3">
                        {expense.validation_result.validation_summary.receipt_authentication.passed ? (
                          <CheckCircle className="h-5 w-5 text-green-600" />
                        ) : (
                          <XCircle className="h-5 w-5 text-[#F20505]" />
                        )}
                        <span className="font-medium">Receipt Authentication</span>
                        <Badge variant="outline" className="ml-2">
                          Score: {(expense.validation_result.validation_summary.receipt_authentication.score * 100).toFixed(0)}%
                        </Badge>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="pt-3">
                      <div className="space-y-2 text-sm">
                        <p className="text-[#666666]">
                          Status: {expense.validation_result.validation_summary.receipt_authentication.passed ? 'Passed' : 'Failed'}
                        </p>
                        {expense.validation_result.validation_summary.receipt_authentication.issues.length > 0 && (
                          <div>
                            <p className="font-medium text-[#1A1A1A] mb-1">Issues:</p>
                            <ul className="list-disc list-inside text-[#666666] space-y-1">
                              {expense.validation_result.validation_summary.receipt_authentication.issues.map((issue, i) => (
                                <li key={i}>{issue}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    </AccordionContent>
                  </AccordionItem>

                  <AccordionItem value="policy" className="bg-[#F4F4F4] px-4 rounded-lg mb-2">
                    <AccordionTrigger className="hover:no-underline">
                      <div className="flex items-center gap-3">
                        {expense.validation_result.validation_summary.policy_compliance.passed ? (
                          <CheckCircle className="h-5 w-5 text-green-600" />
                        ) : (
                          <XCircle className="h-5 w-5 text-[#F20505]" />
                        )}
                        <span className="font-medium">Policy Compliance</span>
                        {!expense.validation_result.validation_summary.policy_compliance.passed && (
                          <Badge variant="outline" className="ml-2 text-[#F20505]">
                            {expense.validation_result.validation_summary.policy_compliance.violations.length} violations
                          </Badge>
                        )}
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="pt-3">
                      {expense.validation_result.validation_summary.policy_compliance.violations.length > 0 ? (
                        <div className="space-y-3">
                          {expense.validation_result.validation_summary.policy_compliance.violations.map((violation, i) => (
                            <div key={i} className="p-3 bg-white rounded border border-red-200">
                              <div className="flex items-start gap-2">
                                <Badge className={cn(
                                  violation.severity === 'high' ? 'bg-[#F20505]' : 'bg-amber-500'
                                )}>
                                  {violation.severity}
                                </Badge>
                                <div className="flex-1">
                                  <p className="font-medium text-[#1A1A1A]">{violation.policy_name}</p>
                                  <p className="text-sm text-[#666666] mt-1">{violation.description}</p>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-green-600">All policy checks passed</p>
                      )}
                    </AccordionContent>
                  </AccordionItem>

                  <AccordionItem value="business" className="bg-[#F4F4F4] px-4 rounded-lg">
                    <AccordionTrigger className="hover:no-underline">
                      <div className="flex items-center gap-3">
                        {expense.validation_result.validation_summary.business_rules.passed ? (
                          <CheckCircle className="h-5 w-5 text-green-600" />
                        ) : (
                          <XCircle className="h-5 w-5 text-[#F20505]" />
                        )}
                        <span className="font-medium">Business Rules</span>
                        {!expense.validation_result.validation_summary.business_rules.passed && (
                          <Badge variant="outline" className="ml-2 text-[#F20505]">
                            {expense.validation_result.validation_summary.business_rules.violations.length} violations
                          </Badge>
                        )}
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="pt-3">
                      {expense.validation_result.validation_summary.business_rules.violations.length > 0 ? (
                        <div className="space-y-3">
                          {expense.validation_result.validation_summary.business_rules.violations.map((violation, i) => (
                            <div key={i} className="p-3 bg-white rounded border border-red-200">
                              <div className="flex items-start gap-2">
                                <Badge className={cn(
                                  violation.severity === 'high' ? 'bg-[#F20505]' : 'bg-amber-500'
                                )}>
                                  {violation.severity}
                                </Badge>
                                <div className="flex-1">
                                  <p className="font-medium text-[#1A1A1A]">{violation.rule_name}</p>
                                  <p className="text-sm text-[#666666] mt-1">{violation.description}</p>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-green-600">All business rules passed</p>
                      )}
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>

                {expense.validation_result.escalation_reasons && expense.validation_result.escalation_reasons.length > 0 && (
                  <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-lg">
                    <h4 className="font-medium text-[#1A1A1A] mb-2 flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-amber-600" />
                      Escalation Reasons
                    </h4>
                    <ul className="space-y-1 text-sm text-[#666666]">
                      {expense.validation_result.escalation_reasons.map((reason, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <ChevronRight className="h-4 w-4 mt-0.5 flex-shrink-0" />
                          <span>{reason}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {expense.validation_result.aggregated_recommendation && (
                  <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <h4 className="font-medium text-[#1A1A1A] mb-2 flex items-center gap-2">
                      <Info className="h-4 w-4 text-blue-600" />
                      Recommendation
                    </h4>
                    <p className="text-sm text-[#666666]">{expense.validation_result.aggregated_recommendation}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-6">
          <Card className="bg-[#F4F4F4]">
            <CardHeader>
              <CardTitle className="text-[#1A1A1A]">Audit Timeline</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <div className="h-8 w-8 rounded-full bg-[#001155] flex items-center justify-center">
                      <CheckCircle className="h-4 w-4 text-white" />
                    </div>
                    <div className="h-full w-0.5 bg-[#001155] mt-2"></div>
                  </div>
                  <div className="flex-1 pb-4">
                    <p className="font-medium text-[#1A1A1A]">Submitted</p>
                    <p className="text-sm text-[#666666]">{formatDate(expense.submitted_at)}</p>
                  </div>
                </div>

                {expense.validation_result && (
                  <div className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <div className="h-8 w-8 rounded-full bg-[#001155] flex items-center justify-center">
                        <CheckCircle className="h-4 w-4 text-white" />
                      </div>
                      {(expense.status === 'escalated' || expense.manager_decision) && (
                        <div className="h-full w-0.5 bg-[#001155] mt-2"></div>
                      )}
                    </div>
                    <div className="flex-1 pb-4">
                      <p className="font-medium text-[#1A1A1A]">Validated</p>
                      <p className="text-sm text-[#666666]">Automated review complete</p>
                    </div>
                  </div>
                )}

                {expense.status === 'escalated' && (
                  <div className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <div className="h-8 w-8 rounded-full bg-amber-500 flex items-center justify-center">
                        <Clock className="h-4 w-4 text-white" />
                      </div>
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-[#1A1A1A]">Awaiting Manager Review</p>
                      <p className="text-sm text-[#666666]">
                        {expense.days_pending ? `${expense.days_pending} days pending` : 'Pending'}
                      </p>
                    </div>
                  </div>
                )}

                {expense.manager_decision && (
                  <div className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <div className={cn(
                        'h-8 w-8 rounded-full flex items-center justify-center',
                        expense.manager_decision.decision === 'approved' ? 'bg-green-600' : 'bg-[#F20505]'
                      )}>
                        {expense.manager_decision.decision === 'approved' ? (
                          <ThumbsUp className="h-4 w-4 text-white" />
                        ) : (
                          <ThumbsDown className="h-4 w-4 text-white" />
                        )}
                      </div>
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-[#1A1A1A]">
                        {expense.manager_decision.decision === 'approved' ? 'Approved' : 'Rejected'} by Manager
                      </p>
                      <p className="text-sm text-[#666666]">{formatDate(expense.manager_decision.decision_timestamp)}</p>
                      {expense.manager_decision.manager_notes && (
                        <p className="text-sm text-[#666666] mt-2 italic">"{expense.manager_decision.manager_notes}"</p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {onManagerAction && expense.status === 'escalated' && (
            <Card className="border-2 border-[#0541FF]">
              <CardHeader>
                <CardTitle className="text-[#1A1A1A]">Manager Decision</CardTitle>
                <CardDescription>Review and make a decision on this expense</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="notes">Rationale</Label>
                  <Textarea
                    id="notes"
                    value={managerNotes}
                    onChange={(e) => setManagerNotes(e.target.value)}
                    placeholder="Provide justification for your decision..."
                    rows={4}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <Button
                    onClick={() => handleManagerDecision('approved')}
                    disabled={submitting || !managerNotes}
                    className="bg-[#0541FF] hover:bg-[#0541FF]/90"
                  >
                    {submitting ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        <ThumbsUp className="h-4 w-4 mr-2" />
                        Approve
                      </>
                    )}
                  </Button>
                  <Button
                    onClick={() => handleManagerDecision('rejected')}
                    disabled={submitting || !managerNotes}
                    variant="outline"
                    className="border-[#F20505] text-[#F20505] hover:bg-[#F20505] hover:text-white"
                  >
                    {submitting ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        <ThumbsDown className="h-4 w-4 mr-2" />
                        Reject
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}

function ManagerQueueView({ expenses, onViewExpense }: {
  expenses: Expense[]
  onViewExpense: (expense: Expense) => void
}) {
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [searchTerm, setSearchTerm] = useState('')

  const escalatedExpenses = expenses.filter(e => e.status === 'escalated')

  const filteredExpenses = escalatedExpenses.filter(expense => {
    const matchesSearch = searchTerm === '' ||
      expense.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      expense.employee_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      expense.merchant.toLowerCase().includes(searchTerm.toLowerCase())

    return matchesSearch
  })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-[#1A1A1A]">Manager Review Queue</h1>
        <p className="text-[#666666]">Expenses requiring manager approval</p>
      </div>

      <Card className="bg-gradient-to-r from-[#0541FF] to-[#9428FF] text-white">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-white/80 text-sm">Pending Review</p>
              <p className="text-4xl font-bold">{escalatedExpenses.length}</p>
            </div>
            <AlertTriangle className="h-16 w-16 text-white/30" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="bg-[#001155] text-white rounded-t-lg">
          <div className="flex items-center justify-between">
            <CardTitle>Escalated Expenses</CardTitle>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-white/60" />
                <Input
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search..."
                  className="pl-9 bg-white/10 border-white/20 text-white placeholder:text-white/60 w-64"
                />
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Expense ID</TableHead>
                <TableHead>Employee</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Escalation Reasons</TableHead>
                <TableHead>Days Pending</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredExpenses.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-[#666666]">
                    No expenses requiring review
                  </TableCell>
                </TableRow>
              ) : (
                filteredExpenses.map((expense) => (
                  <TableRow key={expense.id} className="hover:bg-[#F4F4F4]">
                    <TableCell className="font-medium">{expense.id}</TableCell>
                    <TableCell>{expense.employee_name}</TableCell>
                    <TableCell>{expense.category}</TableCell>
                    <TableCell>{formatCurrency(expense.amount)}</TableCell>
                    <TableCell>{formatDate(expense.date)}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {expense.validation_result?.escalation_reasons?.slice(0, 2).map((reason, i) => (
                          <Badge key={i} variant="outline" className="text-xs">
                            {reason.substring(0, 30)}...
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className={cn(
                        'font-medium',
                        expense.days_pending && expense.days_pending > 3 ? 'text-[#F20505]' : 'text-[#666666]'
                      )}>
                        {expense.days_pending || 0} days
                      </span>
                    </TableCell>
                    <TableCell>
                      <Button
                        onClick={() => onViewExpense(expense)}
                        size="sm"
                        className="bg-[#0541FF] hover:bg-[#0541FF]/90"
                      >
                        Review
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}

// =============================================================================
// Main Component
// =============================================================================

export default function Home() {
  const [currentView, setCurrentView] = useState('dashboard')
  const [userRole, setUserRole] = useState<'employee' | 'manager'>('employee')
  const [expenses, setExpenses] = useState<Expense[]>(INITIAL_EXPENSES)
  const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null)

  // Load expenses from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem('expenses')
    if (stored) {
      try {
        const parsed = JSON.parse(stored)
        setExpenses([...parsed, ...INITIAL_EXPENSES])
      } catch (e) {
        console.error('Failed to parse stored expenses', e)
      }
    }
  }, [])

  const handleViewExpense = (expense: Expense) => {
    setSelectedExpense(expense)
    setCurrentView('detail')
  }

  const handleSubmitComplete = (newExpense: Expense) => {
    setExpenses(prev => [newExpense, ...prev])
    setSelectedExpense(newExpense)
    setCurrentView('detail')
  }

  const handleManagerAction = async (decision: 'approved' | 'rejected', notes: string) => {
    if (!selectedExpense) return

    // Build message for Manager Decision Agent
    const message = `Process manager decision: Expense ID ${selectedExpense.id} for ${selectedExpense.employee_name}, ${formatCurrency(selectedExpense.amount)} ${selectedExpense.category} expense. Manager decision: ${decision.toUpperCase()}. Rationale: '${notes}' Send ${decision} notification to employee.`

    try {
      const result = await callAIAgent(message, AGENT_IDS.MANAGER_DECISION)

      if (result.success) {
        const decisionResult = result.response.result as ManagerDecisionResult

        // Update expense with decision
        const updatedExpense: Expense = {
          ...selectedExpense,
          status: decision,
          manager_decision: decisionResult
        }

        setExpenses(prev => prev.map(e => e.id === selectedExpense.id ? updatedExpense : e))
        setSelectedExpense(updatedExpense)

        // Update localStorage
        const stored = localStorage.getItem('expenses')
        if (stored) {
          const parsed = JSON.parse(stored)
          const updated = parsed.map((e: Expense) => e.id === selectedExpense.id ? updatedExpense : e)
          localStorage.setItem('expenses', JSON.stringify(updated))
        }
      }
    } catch (error) {
      console.error('Manager decision failed:', error)
    }
  }

  const renderView = () => {
    if (selectedExpense && currentView === 'detail') {
      return (
        <ExpenseDetailView
          expense={selectedExpense}
          onBack={() => {
            setSelectedExpense(null)
            setCurrentView('dashboard')
          }}
          onManagerAction={userRole === 'manager' ? handleManagerAction : undefined}
        />
      )
    }

    switch (currentView) {
      case 'dashboard':
        return (
          <DashboardView
            expenses={expenses}
            onViewExpense={handleViewExpense}
            userRole={userRole}
          />
        )
      case 'submit':
        return <SubmitExpenseView onSubmitComplete={handleSubmitComplete} />
      case 'manager-queue':
        return (
          <ManagerQueueView
            expenses={expenses}
            onViewExpense={handleViewExpense}
          />
        )
      default:
        return (
          <DashboardView
            expenses={expenses}
            onViewExpense={handleViewExpense}
            userRole={userRole}
          />
        )
    }
  }

  return (
    <div className="flex min-h-screen bg-white">
      <Sidebar
        currentView={currentView}
        onViewChange={setCurrentView}
        userRole={userRole}
      />

      <div className="flex-1 overflow-auto">
        <header className="sticky top-0 z-10 bg-white border-b border-gray-200 px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Building className="h-6 w-6 text-[#001155]" />
              <div>
                <h2 className="font-semibold text-[#1A1A1A]">Swisscom Expense Management</h2>
                <p className="text-xs text-[#666666]">Automated validation & approval workflow</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant={userRole === 'employee' ? 'default' : 'outline'}
                size="sm"
                onClick={() => {
                  setUserRole('employee')
                  setCurrentView('dashboard')
                }}
                className={userRole === 'employee' ? 'bg-[#0541FF]' : ''}
              >
                Employee View
              </Button>
              <Button
                variant={userRole === 'manager' ? 'default' : 'outline'}
                size="sm"
                onClick={() => {
                  setUserRole('manager')
                  setCurrentView('manager-queue')
                }}
                className={userRole === 'manager' ? 'bg-[#0541FF]' : ''}
              >
                Manager View
              </Button>
            </div>
          </div>
        </header>

        <main className="p-8">
          {renderView()}
        </main>
      </div>
    </div>
  )
}
