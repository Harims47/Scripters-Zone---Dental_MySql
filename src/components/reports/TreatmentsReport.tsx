import { useState, useEffect, useCallback } from 'react'
import { KpiCard } from '../dashboard/dashboard-components'
import { CheckCircle, Layers, AlertCircle } from 'lucide-react'
import { api } from '../../lib/api'
import { ReportChartCard, SvgBarChart } from './ReportChartCard'
import { DataTable, DataTableEmpty } from '../data-table/data-table'
import { DataTableToolbar } from '../data-table/data-table-toolbar'
import { Badge } from '../ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select'
import type { ColumnDef, PaginationState } from '@tanstack/react-table'
import toast from 'react-hot-toast'
import type { TreatmentsReportResponse, TreatmentReportItem } from '../../types/reports'
import type { DateRangeState } from './ReportDateRange'

interface TreatmentsReportProps {
  dateRange: DateRangeState
}

export function TreatmentsReport({ dateRange }: TreatmentsReportProps) {
  const [data, setData] = useState<TreatmentsReportResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: 10 })

  const [categories, setCategories] = useState<string[]>([])

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      params.set('page', String(pagination.pageIndex + 1))
      params.set('limit', String(pagination.pageSize))
      if (search.trim()) params.set('search', search.trim())
      if (categoryFilter !== 'all') params.set('category', categoryFilter)
      if (dateRange.startDate) params.set('startDate', dateRange.startDate)
      if (dateRange.endDate) params.set('endDate', dateRange.endDate)

      const res = await api.get<TreatmentsReportResponse>(`/api/reports/treatments?${params.toString()}`)
      setData(res)
    } catch (err: any) {
      console.error('Failed to load treatments report:', err)
      setError(err.message || 'Failed to load treatments report')
      toast.error('Failed to load treatments report')
    } finally {
      setLoading(false)
    }
  }, [dateRange.startDate, dateRange.endDate, pagination.pageIndex, pagination.pageSize, search, categoryFilter])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  useEffect(() => {
    setPagination(prev => ({ ...prev, pageIndex: 0 }))
  }, [search, categoryFilter, dateRange.startDate, dateRange.endDate])

  // Fetch unique categories once for filter
  useEffect(() => {
    api.get<string[]>('/api/reports/treatments/categories')
      .then(res => setCategories(res || []))
      .catch(() => setCategories([]))
  }, [])

  const handleExport = async (format: 'pdf' | 'xlsx' | 'csv') => {
    try {
      const params = new URLSearchParams()
      params.set('format', format)
      if (search.trim()) params.set('search', search.trim())
      if (categoryFilter !== 'all') params.set('category', categoryFilter)
      if (dateRange.startDate) params.set('startDate', dateRange.startDate)
      if (dateRange.endDate) params.set('endDate', dateRange.endDate)

      const ext = format === 'xlsx' ? 'xlsx' : format === 'pdf' ? 'pdf' : 'csv'
      await api.download(`/api/reports/treatments/export?${params.toString()}`, `treatments_report_${new Date().toISOString().split('T')[0]}.${ext}`)
      toast.success(`Exported ${format.toUpperCase()} successfully`)
    } catch (err: any) {
      toast.error(err.message || 'Failed to export treatments report')
    }
  }

  const rows = data?.data || []
  const s = data?.summary

  // Top treatments by completed volume for horizontal bar chart
  const barChartData = [...rows]
    .sort((a, b) => b.completedCount - a.completedCount)
    .filter(t => t.completedCount > 0)
    .slice(0, 7)
    .map(t => ({
      label: t.treatmentName,
      value: t.completedCount,
      displayValue: `${t.completedCount} completed`,
      color: '#0d9488'
    }))

  const columns: ColumnDef<TreatmentReportItem>[] = [
    {
      header: () => <div className="text-left font-semibold text-slate-600">Category</div>,
      accessorKey: 'category',
      cell: ({ row }) => (
        <Badge variant="outline" className="text-xs bg-slate-50 text-slate-700 border-slate-200">
          {row.original.category}
        </Badge>
      )
    },
    {
      header: () => <div className="text-left font-semibold text-slate-600">Treatment Name</div>,
      accessorKey: 'treatmentName',
      cell: ({ row }) => <span className="font-semibold text-slate-900 text-xs">{row.original.treatmentName}</span>
    },
    {
      header: () => <div className="text-center font-semibold text-slate-600">Completed</div>,
      accessorKey: 'completedCount',
      cell: ({ row }) => (
        <div className="text-center">
          <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 font-mono text-xs font-semibold">
            {row.original.completedCount}
          </Badge>
        </div>
      )
    }
  ]

  if (error) {
    return (
      <div className="p-8 text-center bg-white rounded-2xl border border-rose-100 flex flex-col items-center">
        <AlertCircle className="w-10 h-10 text-rose-500 mb-2" />
        <h3 className="font-bold text-slate-900">Failed to load treatments report</h3>
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
      <div className="grid gap-4 sm:grid-cols-2">
        <KpiCard
          title="Completed Treatments"
          value={loading ? '...' : (s?.totalCompleted ?? 0)}
          icon={CheckCircle}
          colorClass="text-emerald-600"
          bgClass="bg-emerald-100"
          trendLabel="Total procedures performed in period"
        />
        <KpiCard
          title="Active Categories"
          value={loading ? '...' : categories.length}
          icon={Layers}
          colorClass="text-teal-600"
          bgClass="bg-teal-100"
          trendLabel="Treatment categories in clinic catalog"
        />
      </div>

      {/* Top Treatments Bar Chart */}
      <ReportChartCard
        title="Top Treatments by Volume"
        subtitle="Ranked by total completed clinical procedures"
        loading={loading}
        empty={!loading && barChartData.length === 0}
      >
        <SvgBarChart
          data={barChartData}
          maxItems={7}
        />
      </ReportChartCard>

      {/* Treatments DataTable */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-[0_2px_12px_-4px_rgba(15,23,42,0.04)] overflow-hidden">
        <div className="p-5 border-b border-slate-100 bg-slate-50/50">
          <h3 className="text-base font-bold text-slate-900">Treatment Procedures Breakdown</h3>
          <p className="text-xs text-slate-500 mt-0.5">Clinical procedures and completed treatment counts by catalog item.</p>
        </div>

        <DataTableToolbar
          searchQuery={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search treatment name..."
          exportOptions={{
            pdf: true,
            excel: true,
            csv: true,
            onExport: handleExport
          }}
          filterSlot={
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="h-9 w-[160px] bg-slate-50/50 border-slate-200 text-xs font-medium">
                <SelectValue placeholder="All Categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {categories.map(c => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
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
                title="No treatments found"
                description="No procedures match your filter for this period."
              />
            }
          />
        </div>
      </div>
    </div>
  )
}
