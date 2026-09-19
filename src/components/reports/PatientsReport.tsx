import { useState, useEffect, useCallback } from 'react'
import { KpiCard } from '../dashboard/dashboard-components'
import { Users, UserPlus, UserCheck, AlertCircle } from 'lucide-react'
import { api } from '../../lib/api'
import { ReportChartCard, SvgDonutChart } from './ReportChartCard'
import { DataTable, DataTableEmpty } from '../data-table/data-table'
import { DataTableToolbar } from '../data-table/data-table-toolbar'
import { Badge } from '../ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select'
import type { ColumnDef, PaginationState } from '@tanstack/react-table'
import toast from 'react-hot-toast'
import type { PatientsReportResponse, PatientReportItem } from '../../types/reports'
import type { DateRangeState } from './ReportDateRange'

interface PatientsReportProps {
  dateRange: DateRangeState
}

export function PatientsReport({ dateRange }: PatientsReportProps) {
  const [data, setData] = useState<PatientsReportResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [search, setSearch] = useState('')
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
      if (doctorFilter !== 'all') params.set('doctorId', doctorFilter)
      if (dateRange.startDate) params.set('startDate', dateRange.startDate)
      if (dateRange.endDate) params.set('endDate', dateRange.endDate)

      const res = await api.get<PatientsReportResponse>(`/api/reports/patients?${params.toString()}`)
      setData(res)
    } catch (err: any) {
      console.error('Failed to load patients report:', err)
      setError(err.message || 'Failed to load patients report')
      toast.error('Failed to load patients report')
    } finally {
      setLoading(false)
    }
  }, [dateRange.startDate, dateRange.endDate, pagination.pageIndex, pagination.pageSize, search, doctorFilter])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  useEffect(() => {
    setPagination(prev => ({ ...prev, pageIndex: 0 }))
  }, [search, doctorFilter, dateRange.startDate, dateRange.endDate])

  const handleExport = async (format: 'pdf' | 'xlsx' | 'csv') => {
    try {
      const params = new URLSearchParams()
      params.set('format', format)
      if (search.trim()) params.set('search', search.trim())
      if (doctorFilter !== 'all') params.set('doctorId', doctorFilter)
      if (dateRange.startDate) params.set('startDate', dateRange.startDate)
      if (dateRange.endDate) params.set('endDate', dateRange.endDate)

      const ext = format === 'xlsx' ? 'xlsx' : format === 'pdf' ? 'pdf' : 'csv'
      await api.download(`/api/reports/patients/export?${params.toString()}`, `patients_report_${new Date().toISOString().split('T')[0]}.${ext}`)
      toast.success(`Exported ${format.toUpperCase()} successfully`)
    } catch (err: any) {
      toast.error(err.message || 'Failed to export patients report')
    }
  }

  const rows = data?.data || []
  const newPatientsCount = rows.filter(r => r.patientType === 'New').length
  const returningPatientsCount = rows.filter(r => r.patientType === 'Returning').length

  const donutData = [
    { label: 'New Patients', value: newPatientsCount, color: '#3b82f6' },
    { label: 'Returning Patients', value: returningPatientsCount, color: '#0d9488' }
  ].filter(d => d.value > 0)

  const columns: ColumnDef<PatientReportItem>[] = [
    {
      header: () => <div className="text-left font-semibold text-slate-600">Patient Name</div>,
      accessorKey: 'patientName',
      cell: ({ row }) => (
        <span className="font-semibold text-slate-900 block">{row.original.patientName}</span>
      )
    },
    {
      header: () => <div className="text-left font-semibold text-slate-600">Phone</div>,
      accessorKey: 'phone',
      cell: ({ row }) => <span className="font-mono text-xs text-slate-700">{row.original.phone}</span>
    },
    {
      header: () => <div className="text-center font-semibold text-slate-600">Age / Gender</div>,
      accessorKey: 'age',
      cell: ({ row }) => <div className="text-center text-xs text-slate-600">{row.original.age} yrs / {row.original.gender}</div>
    },
    {
      header: () => <div className="text-center font-semibold text-slate-600">Patient Type</div>,
      accessorKey: 'patientType',
      cell: ({ row }) => {
        const isNew = row.original.patientType === 'New'
        return (
          <div className="text-center">
            <Badge variant="outline" className={isNew ? 'bg-blue-50 text-blue-700 border-blue-200 font-semibold' : 'bg-slate-50 text-slate-700 border-slate-200'}>
              {row.original.patientType}
            </Badge>
          </div>
        )
      }
    },
    {
      header: () => <div className="text-center font-semibold text-slate-600">Total Visits (All Time)</div>,
      accessorKey: 'totalVisitsAllTime',
      cell: ({ row }) => <div className="text-center font-bold text-slate-800 text-xs">{row.original.totalVisitsAllTime}</div>
    },
    {
      header: () => <div className="text-center font-semibold text-slate-600">Last Visit</div>,
      accessorKey: 'lastVisitDate',
      cell: ({ row }) => (
        <div className="text-center text-xs text-slate-500 font-mono">
          {row.original.lastVisitDate !== '—' ? new Date(row.original.lastVisitDate).toLocaleDateString() : '—'}
        </div>
      )
    },
    {
      header: () => <div className="text-center font-semibold text-slate-600">Registered Date</div>,
      accessorKey: 'registeredDate',
      cell: ({ row }) => (
        <div className="text-center text-xs text-slate-500 font-mono">
          {new Date(row.original.registeredDate).toLocaleDateString()}
        </div>
      )
    }
  ]

  if (error) {
    return (
      <div className="p-8 text-center bg-white rounded-2xl border border-rose-100 flex flex-col items-center">
        <AlertCircle className="w-10 h-10 text-rose-500 mb-2" />
        <h3 className="font-bold text-slate-900">Failed to load patients report</h3>
        <p className="text-xs text-slate-500 mt-1 mb-4">{error}</p>
        <button onClick={fetchData} className="px-4 py-2 bg-teal-600 text-white rounded-xl text-xs font-semibold hover:bg-teal-700">
          Retry
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <KpiCard
          title="Active Patients in Period"
          value={loading ? '...' : (data?.pagination.totalRecords ?? 0)}
          icon={Users}
          colorClass="text-teal-600"
          bgClass="bg-teal-100"
          trendLabel="Unique patients with visits"
        />
        <KpiCard
          title="New Patients"
          value={loading ? '...' : newPatientsCount}
          icon={UserPlus}
          colorClass="text-blue-600"
          bgClass="bg-blue-100"
          trendLabel="First clinic visit is in this period"
        />
        <KpiCard
          title="Returning Patients"
          value={loading ? '...' : returningPatientsCount}
          icon={UserCheck}
          colorClass="text-emerald-600"
          bgClass="bg-emerald-100"
          trendLabel="Prior visit history exists"
        />
      </div>

      {/* Chart Card */}
      <ReportChartCard
        title="New vs Returning Patient Breakdown"
        subtitle="Chronological classification based on first-ever visit date"
        loading={loading}
        empty={!loading && donutData.length === 0}
      >
        <SvgDonutChart
          data={donutData}
          centerLabel={String(data?.pagination.totalRecords || 0)}
          centerSub="Active Patients"
        />
      </ReportChartCard>

      {/* Patients DataTable */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-[0_2px_12px_-4px_rgba(15,23,42,0.04)] overflow-hidden">
        <div className="p-5 border-b border-slate-100 bg-slate-50/50">
          <h3 className="text-base font-bold text-slate-900">Patients Directory for Period</h3>
          <p className="text-xs text-slate-500 mt-0.5">Patients who attended visits in the selected timeframe.</p>
        </div>

        <DataTableToolbar
          searchQuery={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search patient name, phone, ID..."
          exportOptions={{
            pdf: true,
            excel: true,
            csv: true,
            onExport: handleExport
          }}
          filterSlot={
            <Select value={doctorFilter} onValueChange={setDoctorFilter}>
              <SelectTrigger className="h-9 w-[160px] bg-slate-50/50 border-slate-200 text-xs font-medium">
                <SelectValue placeholder="All Doctors" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Doctors</SelectItem>
                {doctors.map(d => (
                  <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          }
        />

        <div className="p-4">
          <DataTable
            columns={columns}
            data={rows}
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
                title="No patients found"
                description="No patients had visits matching your filters for this period."
              />
            }
          />
        </div>
      </div>
    </div>
  )
}
