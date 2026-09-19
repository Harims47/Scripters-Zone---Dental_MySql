import { useState, useEffect, useCallback } from 'react'
import { KpiCard } from '../dashboard/dashboard-components'
import { Stethoscope, CheckCircle, AlertCircle } from 'lucide-react'
import { api } from '../../lib/api'
import { ReportChartCard, SvgBarChart } from './ReportChartCard'
import { DataTable, DataTableEmpty } from '../data-table/data-table'
import { DataTableToolbar } from '../data-table/data-table-toolbar'
import { Badge } from '../ui/badge'
import type { ColumnDef } from '@tanstack/react-table'
import toast from 'react-hot-toast'
import type { DoctorActivityItem } from '../../types/reports'
import type { DateRangeState } from './ReportDateRange'

interface DoctorsReportProps {
  dateRange: DateRangeState
}

export function DoctorsReport({ dateRange }: DoctorsReportProps) {
  const [data, setData] = useState<DoctorActivityItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (dateRange.startDate) params.set('startDate', dateRange.startDate)
      if (dateRange.endDate) params.set('endDate', dateRange.endDate)

      const res = await api.get<{ data: DoctorActivityItem[] }>(`/api/reports/doctors?${params.toString()}`)
      setData(res.data || [])
    } catch (err: any) {
      console.error('Failed to load doctor activity report:', err)
      setError(err.message || 'Failed to load doctor activity')
      toast.error('Failed to load doctor report')
    } finally {
      setLoading(false)
    }
  }, [dateRange.startDate, dateRange.endDate])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleExport = async (format: 'pdf' | 'xlsx' | 'csv') => {
    try {
      const params = new URLSearchParams()
      params.set('format', format)
      if (dateRange.startDate) params.set('startDate', dateRange.startDate)
      if (dateRange.endDate) params.set('endDate', dateRange.endDate)

      const ext = format === 'xlsx' ? 'xlsx' : format === 'pdf' ? 'pdf' : 'csv'
      await api.download(`/api/reports/doctors/export?${params.toString()}`, `doctor_activity_report_${new Date().toISOString().split('T')[0]}.${ext}`)
      toast.success(`Exported ${format.toUpperCase()} successfully`)
    } catch (err: any) {
      toast.error(err.message || 'Failed to export doctor report')
    }
  }

  const filteredData = data.filter(d => {
    if (!search.trim()) return true
    const q = search.toLowerCase()
    return d.doctorName.toLowerCase().includes(q) || d.role.toLowerCase().includes(q)
  })

  // Total clinical workload across doctors
  const totalVisits = data.reduce((sum, d) => sum + d.totalAssignedVisits, 0)
  const totalCompleted = data.reduce((sum, d) => sum + d.completedVisits, 0)

  // Visits by Doctor bar chart
  const barChartData = data.map(d => ({
    label: d.doctorName,
    value: d.totalAssignedVisits,
    displayValue: `${d.totalAssignedVisits} visits`,
    color: d.role === 'Head Doctor' ? '#0d9488' : '#6366f1'
  }))

  const columns: ColumnDef<DoctorActivityItem>[] = [
    {
      header: () => <div className="text-left font-semibold text-slate-600">Doctor</div>,
      accessorKey: 'doctorName',
      cell: ({ row }) => <span className="font-semibold text-slate-900 text-xs">{row.original.doctorName}</span>
    },
    {
      header: () => <div className="text-left font-semibold text-slate-600">Role</div>,
      accessorKey: 'role',
      cell: ({ row }) => (
        <Badge variant="outline" className={`text-xs ${row.original.role === 'Head Doctor' ? 'bg-teal-50 text-teal-700 border-teal-200' : 'bg-indigo-50 text-indigo-700 border-indigo-200'}`}>
          {row.original.role}
        </Badge>
      )
    },
    {
      header: () => <div className="text-center font-semibold text-slate-600">Total Assigned Visits</div>,
      accessorKey: 'totalAssignedVisits',
      cell: ({ row }) => <div className="text-center font-bold text-slate-900 text-xs">{row.original.totalAssignedVisits}</div>
    },
    {
      header: () => <div className="text-center font-semibold text-slate-600">Completed Visits</div>,
      accessorKey: 'completedVisits',
      cell: ({ row }) => <div className="text-center font-semibold text-emerald-700 text-xs">{row.original.completedVisits}</div>
    }
  ]

  if (error) {
    return (
      <div className="p-8 text-center bg-white rounded-2xl border border-rose-100 flex flex-col items-center">
        <AlertCircle className="w-10 h-10 text-rose-500 mb-2" />
        <h3 className="font-bold text-slate-900">Failed to load doctor activity report</h3>
        <p className="text-xs text-slate-500 mt-1 mb-4">{error}</p>
        <button onClick={fetchData} className="px-4 py-2 bg-teal-600 text-white rounded-xl text-xs font-semibold hover:bg-teal-700">
          Retry
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Workload Summary KPIs */}
      <div className="grid gap-4 sm:grid-cols-2">
        <KpiCard
          title="Clinical Workload (Visits)"
          value={loading ? '...' : totalVisits}
          icon={Stethoscope}
          colorClass="text-teal-600"
          bgClass="bg-teal-100"
          trendLabel="Total patient consultations"
        />
        <KpiCard
          title="Completed Consultations"
          value={loading ? '...' : totalCompleted}
          icon={CheckCircle}
          colorClass="text-emerald-600"
          bgClass="bg-emerald-100"
          trendLabel="Finished clinical visits"
        />
      </div>

      {/* Chart: Visits by Doctor */}
      <ReportChartCard
        title="Consultation Workload by Doctor"
        subtitle="Distribution of assigned visits across doctors"
        loading={loading}
        empty={!loading && barChartData.length === 0}
      >
        <SvgBarChart
          data={barChartData}
        />
      </ReportChartCard>

      {/* Doctor Activity DataTable */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-[0_2px_12px_-4px_rgba(15,23,42,0.04)] overflow-hidden">
        <div className="p-5 border-b border-slate-100 bg-slate-50/50">
          <h3 className="text-base font-bold text-slate-900">Doctor Activity & Workload Directory</h3>
          <p className="text-xs text-slate-500 mt-0.5">Objective operational workload metrics without arbitrary scores or employee rankings.</p>
        </div>

        <DataTableToolbar
          searchQuery={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search doctor name or role..."
          exportOptions={{
            pdf: true,
            excel: true,
            csv: true,
            onExport: handleExport
          }}
        />

        <div className="p-4">
          <DataTable
            columns={columns}
            data={filteredData}
            loading={loading}
            emptyState={
              <DataTableEmpty
                title="No doctor activity found"
                description="No doctor consultations recorded for the selected period."
              />
            }
          />
        </div>
      </div>
    </div>
  )
}
