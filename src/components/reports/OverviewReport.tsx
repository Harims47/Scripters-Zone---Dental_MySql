import { useState, useEffect, useCallback, useMemo } from 'react'
import { KpiCard } from '../dashboard/dashboard-components'
import { Users, CheckCircle, Clock, IndianRupee, AlertCircle, Calendar } from 'lucide-react'
import { api } from '../../lib/api'
import { ReportChartCard, SvgDailyBarChart } from './ReportChartCard'
import { DataTable, DataTableEmpty } from '../data-table/data-table'
import { DataTableToolbar } from '../data-table/data-table-toolbar'
import type { ColumnDef, PaginationState } from '@tanstack/react-table'
import toast from 'react-hot-toast'
import type { OverviewReportResponse, OverviewDailyTrendItem } from '../../types/reports'
import type { DateRangeState } from './ReportDateRange'

interface OverviewReportProps {
  dateRange: DateRangeState
}

export function OverviewReport({ dateRange }: OverviewReportProps) {
  const [data, setData] = useState<OverviewReportResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Client-side pagination & search for the daily trend table
  const [search, setSearch] = useState('')
  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: 10 })

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (dateRange.startDate) params.set('startDate', dateRange.startDate)
      if (dateRange.endDate) params.set('endDate', dateRange.endDate)

      const res = await api.get<OverviewReportResponse>(`/api/reports/overview?${params.toString()}`)
      setData(res)
    } catch (err: any) {
      console.error('Failed to load overview report:', err)
      setError(err.message || 'Failed to load clinic overview')
      toast.error('Failed to load overview report')
    } finally {
      setLoading(false)
    }
  }, [dateRange.startDate, dateRange.endDate])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const trend = data?.trend || []
  // Sort table rows descending so the latest date appears first
  const sortedTrend = useMemo(() => {
    return [...trend].sort((a, b) => b.date.localeCompare(a.date))
  }, [trend])

  const filteredTrend = sortedTrend.filter(row => {
    if (!search) return true
    return row.date.includes(search)
  })

  // Paginate filtered trend
  const pageStart = pagination.pageIndex * pagination.pageSize
  const paginatedRows = filteredTrend.slice(pageStart, pageStart + pagination.pageSize)
  const totalPages = Math.ceil(filteredTrend.length / pagination.pageSize)

  const columns: ColumnDef<OverviewDailyTrendItem>[] = [
    {
      header: () => <div className="text-left font-semibold text-slate-600">Date</div>,
      accessorKey: 'date',
      cell: ({ row }) => (
        <span className="font-mono text-xs font-semibold text-slate-900">
          {row.original.date}
        </span>
      )
    },
    {
      header: () => <div className="text-center font-semibold text-slate-600">Total Visits</div>,
      accessorKey: 'visits',
      cell: ({ row }) => <div className="text-center font-bold text-slate-800">{row.original.visits}</div>
    },
    {
      header: () => <div className="text-center font-semibold text-slate-600">Walk-ins</div>,
      accessorKey: 'walkIns',
      cell: ({ row }) => <div className="text-center text-slate-600">{row.original.walkIns}</div>
    },
    {
      header: () => <div className="text-center font-semibold text-slate-600">Appointments</div>,
      accessorKey: 'appointments',
      cell: ({ row }) => <div className="text-center text-indigo-600 font-medium">{row.original.appointments}</div>
    },
    {
      header: () => <div className="text-center font-semibold text-slate-600">New Patients</div>,
      accessorKey: 'newPatients',
      cell: ({ row }) => <div className="text-center text-emerald-600 font-semibold">{row.original.newPatients}</div>
    },
    {
      header: () => <div className="text-center font-semibold text-slate-600">Existing Visits</div>,
      accessorKey: 'existingPatientVisits',
      cell: ({ row }) => <div className="text-center text-slate-500">{row.original.existingPatientVisits}</div>
    },
    {
      header: () => <div className="text-center font-semibold text-slate-600">Completed</div>,
      accessorKey: 'completedVisits',
      cell: ({ row }) => <div className="text-center text-emerald-700 font-medium">{row.original.completedVisits}</div>
    },
    {
      header: () => <div className="text-center font-semibold text-slate-600">Cancelled</div>,
      accessorKey: 'cancelledVisits',
      cell: ({ row }) => (
        <div className={`text-center font-medium ${row.original.cancelledVisits > 0 ? 'text-rose-600' : 'text-slate-400'}`}>
          {row.original.cancelledVisits}
        </div>
      )
    },
    {
      header: () => <div className="text-right font-semibold text-slate-600">Amount Due</div>,
      accessorKey: 'amountDue',
      cell: ({ row }) => <div className="text-right font-mono text-slate-700">₹{row.original.amountDue.toLocaleString()}</div>
    },
    {
      header: () => <div className="text-right font-semibold text-slate-600">Total Collected</div>,
      accessorKey: 'amountCollected',
      cell: ({ row }) => <div className="text-right font-mono font-bold text-emerald-600">₹{row.original.amountCollected.toLocaleString()}</div>
    },
    {
      header: () => <div className="text-right font-semibold text-slate-600">Outstanding</div>,
      accessorKey: 'outstanding',
      cell: ({ row }) => (
        <div className={`text-right font-mono font-semibold ${row.original.outstanding > 0 ? 'text-rose-600' : 'text-slate-400'}`}>
          ₹{row.original.outstanding.toLocaleString()}
        </div>
      )
    }
  ]

  if (error) {
    return (
      <div className="p-8 text-center bg-white rounded-2xl border border-rose-100 flex flex-col items-center">
        <AlertCircle className="w-10 h-10 text-rose-500 mb-2" />
        <h3 className="font-bold text-slate-900">Failed to load overview report</h3>
        <p className="text-xs text-slate-500 mt-1 mb-4">{error}</p>
        <button onClick={fetchData} className="px-4 py-2 bg-teal-600 text-white rounded-xl text-xs font-semibold hover:bg-teal-700">
          Retry
        </button>
      </div>
    )
  }

  const kpis = data?.summary
  const chartPoints = trend.map(d => ({
    label: d.date,
    value: d.visits,
    secondaryValue: d.completedVisits
  }))

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <KpiCard
          title="Total Visits"
          value={loading ? '...' : (kpis?.totalVisits ?? 0)}
          icon={Calendar}
          colorClass="text-teal-600"
          bgClass="bg-teal-100"
          trendLabel={`Walk-in: ${kpis?.walkInVisits || 0} | Appt: ${kpis?.appointmentVisits || 0}`}
        />
        <KpiCard
          title="New Patients"
          value={loading ? '...' : (kpis?.newPatients ?? 0)}
          icon={Users}
          colorClass="text-blue-600"
          bgClass="bg-blue-100"
          trendLabel="First-ever clinic visits"
        />
        <KpiCard
          title="Completed Visits"
          value={loading ? '...' : (kpis?.completedVisits ?? 0)}
          icon={CheckCircle}
          colorClass="text-emerald-600"
          bgClass="bg-emerald-100"
          trendLabel={`Cancelled: ${kpis?.cancelledVisits || 0}`}
        />
        <KpiCard
          title="Total Collected"
          value={loading ? '...' : `₹${(kpis?.totalAmountCollected || 0).toLocaleString()}`}
          icon={IndianRupee}
          colorClass="text-emerald-600"
          bgClass="bg-emerald-100"
          trendLabel={`Total Due: ₹${(kpis?.totalAmountDue || 0).toLocaleString()}`}
        />
        <KpiCard
          title="Outstanding"
          value={loading ? '...' : `₹${(kpis?.outstandingAmount || 0).toLocaleString()}`}
          icon={Clock}
          colorClass="text-rose-600"
          bgClass="bg-rose-100"
          trendLabel="Unpaid balance for period"
        />
      </div>

      {/* Chart Card */}
      <ReportChartCard
        title="Daily Clinic Visits Volume"
        subtitle="Daily consultation volume & completed consultations"
        loading={loading}
        empty={!loading && trend.length === 0}
      >
        <SvgDailyBarChart
          data={chartPoints}
          primaryLabel="Total Visits"
          secondaryLabel="Completed"
          primaryColor="#0d9488"
          secondaryColor="#10b981"
        />
      </ReportChartCard>

      {/* Daily Performance Table */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-[0_2px_12px_-4px_rgba(15,23,42,0.04)] overflow-hidden">
        <div className="p-5 border-b border-slate-100 bg-slate-50/50">
          <h3 className="text-base font-bold text-slate-900">Daily Clinic Performance</h3>
          <p className="text-xs text-slate-500 mt-0.5">Chronological summary of daily volume and collections.</p>
        </div>

        <DataTableToolbar
          searchQuery={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search by date (YYYY-MM-DD)..."
        />

        <div className="p-4">
          <DataTable
            columns={columns}
            data={paginatedRows}
            loading={loading}
            manualPagination={true}
            pageCount={totalPages}
            totalRecords={filteredTrend.length}
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
                title="No daily activity found"
                description="No clinic visits occurred in the selected date range."
              />
            }
          />
        </div>
      </div>
    </div>
  )
}
