import { useState, useEffect, useCallback } from 'react'
import { KpiCard } from '../dashboard/dashboard-components'
import { IndianRupee, Banknote, Clock, CheckCircle2, AlertCircle } from 'lucide-react'
import { api } from '../../lib/api'
import { ReportChartCard, SvgDailyBarChart, SvgDonutChart } from './ReportChartCard'
import { DataTable, DataTableEmpty } from '../data-table/data-table'
import { DataTableToolbar } from '../data-table/data-table-toolbar'
import { Badge } from '../ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select'
import type { ColumnDef, PaginationState } from '@tanstack/react-table'
import toast from 'react-hot-toast'
import type { RevenueReportResponse, RevenueReportItem } from '../../types/reports'
import type { DateRangeState } from './ReportDateRange'

interface RevenueReportProps {
  dateRange: DateRangeState
}

export function RevenueReport({ dateRange }: RevenueReportProps) {
  const [data, setData] = useState<RevenueReportResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [search, setSearch] = useState('')
  const [methodFilter, setMethodFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [doctorFilter, setDoctorFilter] = useState('all')
  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: 10 })

  const [doctors, setDoctors] = useState<{ id: string; name: string }[]>([])

  useEffect(() => {
    api.get<{ data: any[] }>('/api/reports/doctors')
      .then(res => setDoctors(res.data.map(d => ({ id: d.doctorId, name: d.doctorName }))))
      .catch(() => {})
  }, [])

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      params.set('page', String(pagination.pageIndex + 1))
      params.set('limit', String(pagination.pageSize))
      if (search.trim()) params.set('search', search.trim())
      if (methodFilter !== 'all') params.set('method', methodFilter)
      if (statusFilter !== 'all') params.set('status', statusFilter)
      if (doctorFilter !== 'all') params.set('doctorId', doctorFilter)
      if (dateRange.startDate) params.set('startDate', dateRange.startDate)
      if (dateRange.endDate) params.set('endDate', dateRange.endDate)

      const res = await api.get<RevenueReportResponse>(`/api/reports/revenue?${params.toString()}`)
      setData(res)
    } catch (err: any) {
      console.error('Failed to load revenue report:', err)
      setError(err.message || 'Failed to load revenue report')
      toast.error('Failed to load revenue report')
    } finally {
      setLoading(false)
    }
  }, [dateRange.startDate, dateRange.endDate, pagination.pageIndex, pagination.pageSize, search, methodFilter, statusFilter, doctorFilter])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  useEffect(() => {
    setPagination(prev => ({ ...prev, pageIndex: 0 }))
  }, [search, methodFilter, statusFilter, doctorFilter, dateRange.startDate, dateRange.endDate])

  const handleExport = async (format: 'pdf' | 'xlsx' | 'csv') => {
    try {
      const params = new URLSearchParams()
      params.set('format', format)
      if (search.trim()) params.set('search', search.trim())
      if (methodFilter !== 'all') params.set('method', methodFilter)
      if (statusFilter !== 'all') params.set('status', statusFilter)
      if (doctorFilter !== 'all') params.set('doctorId', doctorFilter)
      if (dateRange.startDate) params.set('startDate', dateRange.startDate)
      if (dateRange.endDate) params.set('endDate', dateRange.endDate)

      const ext = format === 'xlsx' ? 'xlsx' : format === 'pdf' ? 'pdf' : 'csv'
      await api.download(`/api/reports/revenue/export?${params.toString()}`, `revenue_payments_report_${new Date().toISOString().split('T')[0]}.${ext}`)
      toast.success(`Exported ${format.toUpperCase()} successfully`)
    } catch (err: any) {
      toast.error(err.message || 'Failed to export revenue report')
    }
  }

  const columns: ColumnDef<RevenueReportItem>[] = [
    {
      header: () => <div className="text-left font-semibold text-slate-600">Payment Date & Time</div>,
      accessorKey: 'paymentDate',
      cell: ({ row }) => (
        <div className="text-slate-600 text-xs font-mono">
          {new Date(row.original.paymentDate).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
        </div>
      )
    },
    {
      header: () => <div className="text-left font-semibold text-slate-600">Patient</div>,
      accessorKey: 'patientName',
      cell: ({ row }) => (
        <span className="font-semibold text-slate-900 block">{row.original.patientName}</span>
      )
    },
    {
      header: () => <div className="text-center font-semibold text-slate-600">Doctor</div>,
      accessorKey: 'doctorName',
      cell: ({ row }) => <div className="text-center text-slate-700 text-xs">{row.original.doctorName}</div>
    },
    {
      header: () => <div className="text-center font-semibold text-slate-600">Method</div>,
      accessorKey: 'paymentMethod',
      cell: ({ row }) => (
        <div className="text-center">
          <Badge variant="outline" className="font-medium bg-slate-50 text-slate-700 border-slate-200">
            {row.original.paymentMethod}
          </Badge>
        </div>
      )
    },
    {
      header: () => <div className="text-right font-semibold text-slate-600">Amount</div>,
      accessorKey: 'amount',
      cell: ({ row }) => <div className="text-right font-bold text-emerald-600 font-mono text-xs">₹{row.original.amount.toLocaleString()}</div>
    },
    {
      header: () => <div className="text-center font-semibold text-slate-600">Status</div>,
      accessorKey: 'paymentStatus',
      cell: ({ row }) => (
        <div className="text-center">
          <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200">{row.original.paymentStatus}</Badge>
        </div>
      )
    },
    {
      header: () => <div className="text-left font-semibold text-slate-600">Notes / Reason</div>,
      accessorKey: 'notes',
      cell: ({ row }) => <div className="text-slate-600 text-xs italic truncate max-w-[180px]" title={row.original.notes}>{row.original.notes}</div>
    }
  ]

  if (error) {
    return (
      <div className="p-8 text-center bg-white rounded-2xl border border-rose-100 flex flex-col items-center">
        <AlertCircle className="w-10 h-10 text-rose-500 mb-2" />
        <h3 className="font-bold text-slate-900">Failed to load revenue report</h3>
        <p className="text-xs text-slate-500 mt-1 mb-4">{error}</p>
        <button onClick={fetchData} className="px-4 py-2 bg-teal-600 text-white rounded-xl text-xs font-semibold hover:bg-teal-700">
          Retry
        </button>
      </div>
    )
  }

  const s = data?.summary
  const mb = data?.methodBreakdown || {}
  const donutData = [
    { label: 'Cash', value: mb.Cash?.amount || 0, count: mb.Cash?.transactionCount || 0, color: '#10b981' },
    { label: 'GPay', value: mb.GPay?.amount || 0, count: mb.GPay?.transactionCount || 0, color: '#3b82f6' },
    { label: 'Credit Card', value: mb['Credit Card']?.amount || 0, count: mb['Credit Card']?.transactionCount || 0, color: '#6366f1' },
    { label: 'Debit Card', value: mb['Debit Card']?.amount || 0, count: mb['Debit Card']?.transactionCount || 0, color: '#f59e0b' }
  ].filter(d => d.value > 0)

  const linePoints = (data?.trend || []).map(t => ({
    label: t.date,
    value: t.amountCollected
  }))

  return (
    <div className="space-y-6">
      {/* Financial KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <KpiCard
          title="Total Amount Due"
          value={loading ? '...' : `₹${(s?.totalAmountDue || 0).toLocaleString()}`}
          icon={IndianRupee}
          colorClass="text-slate-700"
          bgClass="bg-slate-100"
          trendLabel="Authoritative visit receivables"
        />
        <KpiCard
          title="Total Collected"
          value={loading ? '...' : `₹${(s?.totalCollected || 0).toLocaleString()}`}
          icon={Banknote}
          colorClass="text-emerald-600"
          bgClass="bg-emerald-100"
          trendLabel="Directly verified payments"
        />
        <KpiCard
          title="Outstanding Amount"
          value={loading ? '...' : `₹${(s?.outstandingAmount || 0).toLocaleString()}`}
          icon={Clock}
          colorClass="text-rose-600"
          bgClass="bg-rose-100"
          trendLabel="Unpaid balance across visits"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="bg-white p-4 rounded-xl border border-slate-100 flex items-center justify-between">
          <div>
            <div className="text-xs font-semibold text-slate-500 uppercase">Paid Visits</div>
            <div className="text-xl font-bold text-emerald-700">{s?.paidVisits || 0}</div>
          </div>
          <CheckCircle2 className="w-6 h-6 text-emerald-500 opacity-70" />
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-100 flex items-center justify-between">
          <div>
            <div className="text-xs font-semibold text-slate-500 uppercase">Partial Payment Visits</div>
            <div className="text-xl font-bold text-amber-700">{s?.partialPaymentVisits || 0}</div>
          </div>
          <Clock className="w-6 h-6 text-amber-500 opacity-70" />
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-100 flex items-center justify-between">
          <div>
            <div className="text-xs font-semibold text-slate-500 uppercase">Unpaid Visits</div>
            <div className="text-xl font-bold text-rose-700">{s?.unpaidVisits || 0}</div>
          </div>
          <AlertCircle className="w-6 h-6 text-rose-500 opacity-70" />
        </div>
      </div>

      {/* Revenue Charts */}
      <div className="grid gap-6 md:grid-cols-2">
        <ReportChartCard
          title="Daily Revenue Collections"
          subtitle="Daily collected payments breakdown"
          loading={loading}
          empty={!loading && linePoints.length === 0}
        >
          <SvgDailyBarChart
            data={linePoints}
            primaryLabel="Daily Collection"
            valuePrefix="₹"
            primaryColor="#10b981"
          />
        </ReportChartCard>

        <ReportChartCard
          title="Payment Method Distribution"
          subtitle="Transaction count & total amount by payment mode"
          loading={loading}
          empty={!loading && donutData.length === 0}
        >
          <SvgDonutChart
            data={donutData}
            centerLabel={`₹${(s?.totalCollected || 0).toLocaleString()}`}
            centerSub="Total Collected"
          />
        </ReportChartCard>
      </div>

      {/* Detailed Payments DataTable */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-[0_2px_12px_-4px_rgba(15,23,42,0.04)] overflow-hidden">
        <div className="p-5 border-b border-slate-100 bg-slate-50/50">
          <h3 className="text-base font-bold text-slate-900">Detailed Payment Transactions</h3>
          <p className="text-xs text-slate-500 mt-0.5">Every individual payment record is preserved (never collapsed into single visit totals).</p>
        </div>

        <DataTableToolbar
          searchQuery={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search patient, notes..."
          exportOptions={{
            pdf: true,
            excel: true,
            csv: true,
            onExport: handleExport
          }}
          filterSlot={
            <div className="flex flex-wrap items-center gap-2">
              <Select value={doctorFilter} onValueChange={setDoctorFilter}>
                <SelectTrigger className="h-9 w-[150px] bg-slate-50/50 border-slate-200 text-xs font-medium">
                  <SelectValue placeholder="All Doctors" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Doctors</SelectItem>
                  {doctors.map(d => (
                    <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={methodFilter} onValueChange={setMethodFilter}>
                <SelectTrigger className="h-9 w-[130px] bg-slate-50/50 border-slate-200 text-xs font-medium">
                  <SelectValue placeholder="All Methods" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Methods</SelectItem>
                  <SelectItem value="Cash">Cash</SelectItem>
                  <SelectItem value="GPay">GPay</SelectItem>
                  <SelectItem value="Credit Card">Credit Card</SelectItem>
                  <SelectItem value="Debit Card">Debit Card</SelectItem>
                </SelectContent>
              </Select>

              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="h-9 w-[130px] bg-slate-50/50 border-slate-200 text-xs font-medium">
                  <SelectValue placeholder="All Statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="Completed">Completed</SelectItem>
                  <SelectItem value="Pending">Pending</SelectItem>
                </SelectContent>
              </Select>
            </div>
          }
        />

        <div className="p-4">
          <DataTable
            columns={columns}
            data={data?.data || []}
            loading={loading}
            manualPagination={true}
            pageCount={data?.pagination.totalPages || 0}
            totalRecords={data?.pagination.totalRecords || 0}
            state={{ pagination }}
            onStateChange={(updater: any) => {
              if (typeof updater === 'function') {
                setPagination(updater(pagination))
              } else if (updater.pagination) {
                setPagination(updater.pagination)
              }
            }}
            emptyState={
              <DataTableEmpty
                title="No payment records found"
                description="No transactions match your search, filters, or selected date range."
              />
            }
          />
        </div>
      </div>
    </div>
  )
}
