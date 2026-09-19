import { useState, useEffect, useCallback } from 'react'
import { KpiCard } from '../dashboard/dashboard-components'
import { Pill, Package, AlertCircle } from 'lucide-react'
import { api } from '../../lib/api'
import { ReportChartCard, SvgBarChart } from './ReportChartCard'
import { DataTable, DataTableEmpty } from '../data-table/data-table'
import { DataTableToolbar } from '../data-table/data-table-toolbar'
import { Badge } from '../ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select'
import type { ColumnDef, PaginationState } from '@tanstack/react-table'
import toast from 'react-hot-toast'
import type { MedicinesReportResponse, MedicineReportItem } from '../../types/reports'
import type { DateRangeState } from './ReportDateRange'

interface MedicinesReportProps {
  dateRange: DateRangeState
}

export function MedicinesReport({ dateRange }: MedicinesReportProps) {
  const [data, setData] = useState<MedicinesReportResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: 10 })

  const [categories, setCategories] = useState<{ id: string; name: string }[]>([])

  useEffect(() => {
    api.get<any[]>('/api/medicine-categories')
      .then(res => setCategories(res.map(c => ({ id: c.id, name: c.name }))))
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
      if (categoryFilter !== 'all') params.set('categoryId', categoryFilter)
      if (dateRange.startDate) params.set('startDate', dateRange.startDate)
      if (dateRange.endDate) params.set('endDate', dateRange.endDate)

      const res = await api.get<MedicinesReportResponse>(`/api/reports/medicines?${params.toString()}`)
      setData(res)
    } catch (err: any) {
      console.error('Failed to load medicines report:', err)
      setError(err.message || 'Failed to load medicines report')
      toast.error('Failed to load medicines report')
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

  const handleExport = async (format: 'pdf' | 'xlsx' | 'csv') => {
    try {
      const params = new URLSearchParams()
      params.set('format', format)
      if (search.trim()) params.set('search', search.trim())
      if (categoryFilter !== 'all') params.set('categoryId', categoryFilter)
      if (dateRange.startDate) params.set('startDate', dateRange.startDate)
      if (dateRange.endDate) params.set('endDate', dateRange.endDate)

      const ext = format === 'xlsx' ? 'xlsx' : format === 'pdf' ? 'pdf' : 'csv'
      await api.download(`/api/reports/medicines/export?${params.toString()}`, `medicines_dispensing_report_${new Date().toISOString().split('T')[0]}.${ext}`)
      toast.success(`Exported ${format.toUpperCase()} successfully`)
    } catch (err: any) {
      toast.error(err.message || 'Failed to export medicines report')
    }
  }

  const rows = data?.data || []
  const totalDispensed = data?.summary.totalDispensedUnits || 0

  // Chart data: Top 10 dispensed medicines based on actual dispensed quantity
  const barChartData = [...rows]
    .sort((a, b) => b.totalDispensedQuantity - a.totalDispensedQuantity)
    .filter(m => m.totalDispensedQuantity > 0)
    .slice(0, 10)
    .map(m => ({
      label: m.medicineName,
      value: m.totalDispensedQuantity,
      displayValue: `${m.totalDispensedQuantity} units`,
      color: '#0d9488'
    }))

  const columns: ColumnDef<MedicineReportItem>[] = [
    {
      header: () => <div className="text-left font-semibold text-slate-600">Medicine</div>,
      accessorKey: 'medicineName',
      cell: ({ row }) => (
        <div>
          <span className="font-semibold text-slate-900 text-xs block">{row.original.medicineName}</span>
          <span className="text-[11px] text-slate-500 italic">{row.original.genericName}</span>
        </div>
      )
    },
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
      header: () => <div className="text-center font-semibold text-slate-600">Prescribed Qty</div>,
      accessorKey: 'totalPrescribedQuantity',
      cell: ({ row }) => (
        <div className="text-center font-mono text-xs text-slate-600">
          {row.original.totalPrescribedQuantity}
        </div>
      )
    },
    {
      header: () => <div className="text-center font-semibold text-slate-600">Actual Dispensed Qty</div>,
      accessorKey: 'totalDispensedQuantity',
      cell: ({ row }) => (
        <div className="text-center">
          <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 font-mono text-xs">
            {row.original.totalDispensedQuantity} units
          </Badge>
        </div>
      )
    },
    {
      header: () => <div className="text-center font-semibold text-slate-600">Current Stock*</div>,
      accessorKey: 'currentStock',
      cell: ({ row }) => {
        const cs = row.original.currentStock
        return (
          <div className="text-center">
            <span className={`font-mono text-xs font-semibold ${cs === 0 ? 'text-rose-600' : cs < 15 ? 'text-amber-600' : 'text-slate-700'}`}>
              {cs}
            </span>
          </div>
        )
      }
    }
  ]

  if (error) {
    return (
      <div className="p-8 text-center bg-white rounded-2xl border border-rose-100 flex flex-col items-center">
        <AlertCircle className="w-10 h-10 text-rose-500 mb-2" />
        <h3 className="font-bold text-slate-900">Failed to load medicines report</h3>
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
          title="Total Units Dispensed"
          value={loading ? '...' : `${totalDispensed} units`}
          icon={Pill}
          colorClass="text-teal-600"
          bgClass="bg-teal-100"
          trendLabel="Actual medicines handed to patients"
        />
        <KpiCard
          title="Active Formulations"
          value={loading ? '...' : (data?.pagination.totalRecords ?? 0)}
          icon={Package}
          colorClass="text-indigo-600"
          bgClass="bg-indigo-100"
          trendLabel="Medicines in clinic catalog"
        />
      </div>

      {/* Top 10 Dispensed Medicines Chart */}
      <ReportChartCard
        title="Top 10 Dispensed Medicines"
        subtitle="Ranked strictly by actual dispensed quantity (not prescribed quantity)"
        loading={loading}
        empty={!loading && barChartData.length === 0}
      >
        <SvgBarChart
          data={barChartData}
          maxItems={10}
        />
      </ReportChartCard>

      {/* Medicines DataTable */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-[0_2px_12px_-4px_rgba(15,23,42,0.04)] overflow-hidden">
        <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-base font-bold text-slate-900">Medicine Consumption & Dispensing Log</h3>
            <p className="text-xs text-slate-500 mt-0.5">Distinguishes doctor prescribed quantities from actual pharmacy dispenses.</p>
          </div>
          <span className="text-[11px] text-slate-400 bg-white px-2.5 py-1 rounded-lg border border-slate-200">
            *Current Stock is a point-in-time value, not historic stock
          </span>
        </div>

        <DataTableToolbar
          searchQuery={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search medicine name or generic..."
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
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
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
                title="No medicines found"
                description="No medicine dispenses match your filters."
              />
            }
          />
        </div>
      </div>
    </div>
  )
}
