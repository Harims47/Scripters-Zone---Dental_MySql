import { useState, useEffect, useCallback } from 'react'
import { KpiCard } from '../dashboard/dashboard-components'
import { Calendar, Users, CheckCircle, XCircle, AlertCircle } from 'lucide-react'
import { api } from '../../lib/api'
import { ReportChartCard, SvgDonutChart } from './ReportChartCard'
import { DataTable, DataTableEmpty } from '../data-table/data-table'
import { DataTableToolbar } from '../data-table/data-table-toolbar'
import { Badge } from '../ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select'
import type { ColumnDef, PaginationState } from '@tanstack/react-table'
import toast from 'react-hot-toast'
import type { VisitsReportResponse, VisitReportItem } from '../../types/reports'
import type { DateRangeState } from './ReportDateRange'

interface VisitsReportProps {
  dateRange: DateRangeState
}

export function VisitsReport({ dateRange }: VisitsReportProps) {
  const [data, setData] = useState<VisitsReportResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [search, setSearch] = useState('')
  const [doctorFilter, setDoctorFilter] = useState('all')
  const [visitTypeFilter, setVisitTypeFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: 10 })

  // Doctors list for filter
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
      if (doctorFilter !== 'all') params.set('doctorId', doctorFilter)
      if (visitTypeFilter !== 'all') params.set('visitType', visitTypeFilter)
      if (statusFilter !== 'all') params.set('status', statusFilter)
      if (dateRange.startDate) params.set('startDate', dateRange.startDate)
      if (dateRange.endDate) params.set('endDate', dateRange.endDate)

      const res = await api.get<VisitsReportResponse>(`/api/reports/visits?${params.toString()}`)
      setData(res)
    } catch (err: any) {
      console.error('Failed to load visits report:', err)
      setError(err.message || 'Failed to load visits report')
      toast.error('Failed to load visits report')
    } finally {
      setLoading(false)
    }
  }, [dateRange.startDate, dateRange.endDate, pagination.pageIndex, pagination.pageSize, search, doctorFilter, visitTypeFilter, statusFilter])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Reset pagination on filter change
  useEffect(() => {
    setPagination(prev => ({ ...prev, pageIndex: 0 }))
  }, [search, doctorFilter, visitTypeFilter, statusFilter, dateRange.startDate, dateRange.endDate])

  const handleExport = async (format: 'pdf' | 'xlsx' | 'csv') => {
    try {
      const params = new URLSearchParams()
      params.set('format', format)
      if (search.trim()) params.set('search', search.trim())
      if (doctorFilter !== 'all') params.set('doctorId', doctorFilter)
      if (visitTypeFilter !== 'all') params.set('visitType', visitTypeFilter)
      if (statusFilter !== 'all') params.set('status', statusFilter)
      if (dateRange.startDate) params.set('startDate', dateRange.startDate)
      if (dateRange.endDate) params.set('endDate', dateRange.endDate)

      const ext = format === 'xlsx' ? 'xlsx' : format === 'pdf' ? 'pdf' : 'csv'
      await api.download(`/api/reports/visits/export?${params.toString()}`, `visits_report_${new Date().toISOString().split('T')[0]}.${ext}`)
      toast.success(`Exported ${format.toUpperCase()} successfully`)
    } catch (err: any) {
      toast.error(err.message || 'Failed to export visits report')
    }
  }

  const columns: ColumnDef<VisitReportItem>[] = [
    {
      header: () => <div className="text-left font-semibold text-slate-600">Patient</div>,
      accessorKey: 'patientName',
      cell: ({ row }) => (
        <span className="font-semibold text-slate-900 block">{row.original.patientName}</span>
      )
    },
    {
      header: () => <div className="text-center font-semibold text-slate-600">Visit Date & Time</div>,
      accessorKey: 'visitDateTime',
      cell: ({ row }) => (
        <div className="text-center text-slate-600 text-xs font-mono">
          {new Date(row.original.visitDateTime).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
        </div>
      )
    },
    {
      header: () => <div className="text-center font-semibold text-slate-600">Type</div>,
      accessorKey: 'visitType',
      cell: ({ row }) => (
        <div className="text-center">
          <Badge variant="outline" className={row.original.visitType === 'Appointment' ? 'text-indigo-600 border-indigo-200 bg-indigo-50' : 'text-slate-600'}>
            {row.original.visitType}
          </Badge>
        </div>
      )
    },
    {
      header: () => <div className="text-center font-semibold text-slate-600">Doctor</div>,
      accessorKey: 'doctorName',
      cell: ({ row }) => <div className="text-center text-slate-700 text-xs">{row.original.doctorName}</div>
    },
    {
      header: () => <div className="text-left font-semibold text-slate-600">Reason for Visit</div>,
      accessorKey: 'reasonForVisit',
      cell: ({ row }) => <div className="text-slate-600 text-xs truncate max-w-[160px]" title={row.original.reasonForVisit}>{row.original.reasonForVisit}</div>
    },
    {
      header: () => <div className="text-center font-semibold text-slate-600">Status</div>,
      accessorKey: 'status',
      cell: ({ row }) => {
        const s = row.original.status
        let badge = <Badge variant="outline">{s}</Badge>
        if (s === 'COMPLETED') badge = <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200">Completed</Badge>
        else if (s === 'CANCELLED') badge = <Badge className="bg-slate-100 text-slate-500 border-slate-200">Cancelled</Badge>
        else badge = <Badge className="bg-amber-100 text-amber-800 border-amber-200">Active</Badge>
        return <div className="text-center">{badge}</div>
      }
    },
    {
      header: () => <div className="text-right font-semibold text-slate-600">Amount Due</div>,
      accessorKey: 'amountDue',
      cell: ({ row }) => <div className="text-right font-medium text-slate-900 font-mono text-xs">₹{row.original.amountDue.toLocaleString()}</div>
    },
    {
      header: () => <div className="text-right font-semibold text-slate-600">Total Paid</div>,
      accessorKey: 'totalPaid',
      cell: ({ row }) => <div className="text-right font-medium text-emerald-600 font-mono text-xs">₹{row.original.totalPaid.toLocaleString()}</div>
    },
    {
      header: () => <div className="text-right font-semibold text-slate-600">Balance</div>,
      accessorKey: 'balance',
      cell: ({ row }) => (
        <div className={`text-right font-semibold font-mono text-xs ${row.original.balance > 0 ? 'text-rose-600' : 'text-slate-400'}`}>
          ₹{row.original.balance.toLocaleString()}
        </div>
      )
    }
  ]

  if (error) {
    return (
      <div className="p-8 text-center bg-white rounded-2xl border border-rose-100 flex flex-col items-center">
        <AlertCircle className="w-10 h-10 text-rose-500 mb-2" />
        <h3 className="font-bold text-slate-900">Failed to load visits report</h3>
        <p className="text-xs text-slate-500 mt-1 mb-4">{error}</p>
        <button onClick={fetchData} className="px-4 py-2 bg-teal-600 text-white rounded-xl text-xs font-semibold hover:bg-teal-700">
          Retry
        </button>
      </div>
    )
  }

  const s = data?.summary
  const donutData = [
    { label: 'Walk-ins', value: s?.walkIns || 0, color: '#0d9488' },
    { label: 'Appointments', value: s?.appointments || 0, color: '#6366f1' }
  ]

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <KpiCard
          title="Total Visits"
          value={loading ? '...' : (s?.totalVisits ?? 0)}
          icon={Calendar}
          colorClass="text-teal-600"
          bgClass="bg-teal-100"
        />
        <KpiCard
          title="Walk-ins"
          value={loading ? '...' : (s?.walkIns ?? 0)}
          icon={Users}
          colorClass="text-teal-600"
          bgClass="bg-teal-100"
          trendLabel="Spontaneous visits"
        />
        <KpiCard
          title="Appointments"
          value={loading ? '...' : (s?.appointments ?? 0)}
          icon={Calendar}
          colorClass="text-indigo-600"
          bgClass="bg-indigo-100"
          trendLabel="Scheduled visits"
        />
        <KpiCard
          title="Completed"
          value={loading ? '...' : (s?.completed ?? 0)}
          icon={CheckCircle}
          colorClass="text-emerald-600"
          bgClass="bg-emerald-100"
          trendLabel="Finished visits"
        />
        <KpiCard
          title="Cancelled"
          value={loading ? '...' : (s?.cancelled ?? 0)}
          icon={XCircle}
          colorClass="text-rose-600"
          bgClass="bg-rose-100"
          trendLabel="Cancelled visits"
        />
      </div>

      {/* Chart: Walk-in vs Appointment */}
      <div className="grid gap-6 md:grid-cols-2">
        <ReportChartCard
          title="Walk-in vs Appointment Distribution"
          subtitle="Proportion of spontaneous walk-ins vs scheduled appointments"
          loading={loading}
          empty={!loading && (s?.totalVisits === 0)}
        >
          <SvgDonutChart
            data={donutData}
            centerLabel={String(s?.totalVisits || 0)}
            centerSub="Total Visits"
          />
        </ReportChartCard>

        {/* Visit Status Card */}
        <ReportChartCard
          title="Visit Status Overview"
          subtitle="Completed consultations vs active and cancelled"
          loading={loading}
          empty={!loading && (s?.totalVisits === 0)}
        >
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs font-semibold">
                <span className="text-emerald-700">Completed ({s?.completed || 0})</span>
                <span className="font-mono">{s?.totalVisits ? Math.round(((s?.completed || 0) / s.totalVisits) * 100) : 0}%</span>
              </div>
              <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${s?.totalVisits ? Math.round(((s?.completed || 0) / s.totalVisits) * 100) : 0}%` }} />
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between text-xs font-semibold">
                <span className="text-amber-700">Active / In Progress ({Math.max(0, (s?.totalVisits || 0) - (s?.completed || 0) - (s?.cancelled || 0))})</span>
                <span className="font-mono">{s?.totalVisits ? Math.round((Math.max(0, (s?.totalVisits || 0) - (s?.completed || 0) - (s?.cancelled || 0)) / s.totalVisits) * 100) : 0}%</span>
              </div>
              <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full bg-amber-500 rounded-full" style={{ width: `${s?.totalVisits ? Math.round((Math.max(0, (s?.totalVisits || 0) - (s?.completed || 0) - (s?.cancelled || 0)) / s.totalVisits) * 100) : 0}%` }} />
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between text-xs font-semibold">
                <span className="text-rose-700">Cancelled ({s?.cancelled || 0})</span>
                <span className="font-mono">{s?.totalVisits ? Math.round(((s?.cancelled || 0) / s.totalVisits) * 100) : 0}%</span>
              </div>
              <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full bg-rose-500 rounded-full" style={{ width: `${s?.totalVisits ? Math.round(((s?.cancelled || 0) / s.totalVisits) * 100) : 0}%` }} />
              </div>
            </div>
          </div>
        </ReportChartCard>
      </div>

      {/* Visits DataTable */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-[0_2px_12px_-4px_rgba(15,23,42,0.04)] overflow-hidden">
        <div className="p-5 border-b border-slate-100 bg-slate-50/50">
          <h3 className="text-base font-bold text-slate-900">Detailed Visits</h3>
          <p className="text-xs text-slate-500 mt-0.5">Filter by doctor, type, and status with complete export support.</p>
        </div>

        <DataTableToolbar
          searchQuery={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search patient, doctor, reason..."
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

              <Select value={visitTypeFilter} onValueChange={setVisitTypeFilter}>
                <SelectTrigger className="h-9 w-[130px] bg-slate-50/50 border-slate-200 text-xs font-medium">
                  <SelectValue placeholder="All Types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="Walk-in">Walk-in</SelectItem>
                  <SelectItem value="Appointment">Appointment</SelectItem>
                </SelectContent>
              </Select>

              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="h-9 w-[140px] bg-slate-50/50 border-slate-200 text-xs font-medium">
                  <SelectValue placeholder="All Statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="WAITING">Waiting</SelectItem>
                  <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
                  <SelectItem value="READY_FOR_PAYMENT">Ready for Payment</SelectItem>
                  <SelectItem value="COMPLETED">Completed</SelectItem>
                  <SelectItem value="CANCELLED">Cancelled</SelectItem>
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
                title="No visits found"
                description="No clinic visits match your active filters and selected date range."
              />
            }
          />
        </div>
      </div>
    </div>
  )
}
