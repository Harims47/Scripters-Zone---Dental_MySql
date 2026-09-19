import { useState, useEffect, useCallback } from 'react'
import { KpiCard } from '../dashboard/dashboard-components'
import { ArrowDownRight, ArrowUpRight, SlidersHorizontal, AlertCircle } from 'lucide-react'
import { api } from '../../lib/api'
import { ReportChartCard, SvgBarChart } from './ReportChartCard'
import { DataTable, DataTableEmpty } from '../data-table/data-table'
import { DataTableToolbar } from '../data-table/data-table-toolbar'
import { Badge } from '../ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select'
import type { ColumnDef, PaginationState } from '@tanstack/react-table'
import toast from 'react-hot-toast'
import type { InventoryMovementsResponse, InventoryMovementItem } from '../../types/reports'
import type { DateRangeState } from './ReportDateRange'

interface InventoryReportProps {
  dateRange: DateRangeState
}

export function InventoryReport({ dateRange }: InventoryReportProps) {
  const [data, setData] = useState<InventoryMovementsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [movementTypeFilter, setMovementTypeFilter] = useState('all')
  const [medicineFilter, setMedicineFilter] = useState('all')
  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: 10 })

  const [medicines, setMedicines] = useState<{ id: string; name: string }[]>([])

  useEffect(() => {
    api.get<{ data: any[] }>('/api/inventory?limit=100')
      .then(res => setMedicines((res.data || []).map(m => ({ id: m.id, name: m.name }))))
      .catch(() => {})
  }, [])

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      params.set('page', String(pagination.pageIndex + 1))
      params.set('limit', String(pagination.pageSize))
      if (movementTypeFilter !== 'all') params.set('movementType', movementTypeFilter)
      if (medicineFilter !== 'all') params.set('medicineId', medicineFilter)
      if (dateRange.startDate) params.set('startDate', dateRange.startDate)
      if (dateRange.endDate) params.set('endDate', dateRange.endDate)

      const res = await api.get<InventoryMovementsResponse>(`/api/reports/inventory-movements?${params.toString()}`)
      setData(res)
    } catch (err: any) {
      console.error('Failed to load inventory report:', err)
      setError(err.message || 'Failed to load inventory report')
      toast.error('Failed to load inventory movements report')
    } finally {
      setLoading(false)
    }
  }, [dateRange.startDate, dateRange.endDate, pagination.pageIndex, pagination.pageSize, movementTypeFilter, medicineFilter])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  useEffect(() => {
    setPagination(prev => ({ ...prev, pageIndex: 0 }))
  }, [movementTypeFilter, medicineFilter, dateRange.startDate, dateRange.endDate])

  const handleExport = async (format: 'pdf' | 'xlsx' | 'csv') => {
    try {
      const params = new URLSearchParams()
      params.set('format', format)
      if (movementTypeFilter !== 'all') params.set('movementType', movementTypeFilter)
      if (medicineFilter !== 'all') params.set('medicineId', medicineFilter)
      if (dateRange.startDate) params.set('startDate', dateRange.startDate)
      if (dateRange.endDate) params.set('endDate', dateRange.endDate)

      const ext = format === 'xlsx' ? 'xlsx' : format === 'pdf' ? 'pdf' : 'csv'
      await api.download(`/api/reports/inventory-movements/export?${params.toString()}`, `inventory_movements_report_${new Date().toISOString().split('T')[0]}.${ext}`)
      toast.success(`Exported ${format.toUpperCase()} successfully`)
    } catch (err: any) {
      toast.error(err.message || 'Failed to export inventory movements report')
    }
  }

  const rows = data?.data || []
  const s = data?.summary

  // Stock In vs Stock Out Comparison Bar Chart
  const comparisonData = [
    {
      label: 'Stock In (Received)',
      value: s?.stockReceived || 0,
      displayValue: `+${s?.stockReceived || 0} units`,
      color: '#10b981'
    },
    {
      label: 'Stock Out (Dispensed)',
      value: s?.stockDispensed || 0,
      displayValue: `-${s?.stockDispensed || 0} units`,
      color: '#f43f5e'
    },
    {
      label: 'Net Adjustments',
      value: Math.abs(s?.netAdjustmentQuantity || 0),
      displayValue: `${(s?.netAdjustmentQuantity || 0) >= 0 ? '+' : ''}${s?.netAdjustmentQuantity || 0} units`,
      color: '#6366f1'
    }
  ]

  const columns: ColumnDef<InventoryMovementItem>[] = [
    {
      header: () => <div className="text-left font-semibold text-slate-600">Date & Time</div>,
      accessorKey: 'dateTime',
      cell: ({ row }) => (
        <span className="font-mono text-xs text-slate-600">
          {new Date(row.original.dateTime).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
        </span>
      )
    },
    {
      header: () => <div className="text-left font-semibold text-slate-600">Medicine</div>,
      accessorKey: 'medicineName',
      cell: ({ row }) => <span className="font-semibold text-slate-900 text-xs">{row.original.medicineName}</span>
    },
    {
      header: () => <div className="text-center font-semibold text-slate-600">Movement Type</div>,
      accessorKey: 'movementType',
      cell: ({ row }) => {
        const t = row.original.movementType
        let badge = <Badge variant="outline">{t}</Badge>
        if (t === 'PURCHASE_RECEIPT') badge = <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200">Purchase Receipt</Badge>
        else if (t === 'DISPENSING') badge = <Badge className="bg-rose-50 text-rose-700 border-rose-200">Dispensing</Badge>
        else if (t === 'ADJUSTMENT') badge = <Badge className="bg-amber-50 text-amber-700 border-amber-200">Adjustment</Badge>
        return <div className="text-center">{badge}</div>
      }
    },
    {
      header: () => <div className="text-center font-semibold text-slate-600">Quantity</div>,
      accessorKey: 'quantity',
      cell: ({ row }) => {
        const q = row.original.quantity
        const isPos = q > 0
        return (
          <div className="text-center font-mono font-bold text-xs">
            <span className={isPos ? 'text-emerald-600' : 'text-rose-600'}>
              {isPos ? `+${q}` : q}
            </span>
          </div>
        )
      }
    },
    {
      header: () => <div className="text-center font-semibold text-slate-600">Balance After</div>,
      accessorKey: 'balanceAfter',
      cell: ({ row }) => <div className="text-center font-mono font-semibold text-slate-800 text-xs">{row.original.balanceAfter}</div>
    },
    {
      header: () => <div className="text-center font-semibold text-slate-600">Performed By</div>,
      accessorKey: 'performedBy',
      cell: ({ row }) => <div className="text-center text-slate-600 text-xs">{row.original.performedBy}</div>
    },
    {
      header: () => <div className="text-left font-semibold text-slate-600">Reason / Notes</div>,
      accessorKey: 'reason',
      cell: ({ row }) => <div className="text-slate-600 text-xs italic truncate max-w-[180px]" title={row.original.reason}>{row.original.reason}</div>
    }
  ]

  if (error) {
    return (
      <div className="p-8 text-center bg-white rounded-2xl border border-rose-100 flex flex-col items-center">
        <AlertCircle className="w-10 h-10 text-rose-500 mb-2" />
        <h3 className="font-bold text-slate-900">Failed to load inventory report</h3>
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
      <div className="grid gap-4 sm:grid-cols-4">
        <KpiCard
          title="Stock Received"
          value={loading ? '...' : `+${s?.stockReceived || 0}`}
          icon={ArrowDownRight}
          colorClass="text-emerald-600"
          bgClass="bg-emerald-100"
          trendLabel="Purchase receipts"
        />
        <KpiCard
          title="Stock Dispensed"
          value={loading ? '...' : `-${s?.stockDispensed || 0}`}
          icon={ArrowUpRight}
          colorClass="text-rose-600"
          bgClass="bg-rose-100"
          trendLabel="Patient pharmacy usage"
        />
        <KpiCard
          title="Manual Adjustments"
          value={loading ? '...' : (s?.adjustmentCount ?? 0)}
          icon={SlidersHorizontal}
          colorClass="text-amber-600"
          bgClass="bg-amber-100"
          trendLabel="Controlled reconciliation events"
        />
        <KpiCard
          title="Net Adjustment Qty"
          value={loading ? '...' : `${(s?.netAdjustmentQuantity || 0) >= 0 ? '+' : ''}${s?.netAdjustmentQuantity || 0}`}
          icon={SlidersHorizontal}
          colorClass="text-indigo-600"
          bgClass="bg-indigo-100"
          trendLabel="Net adjustment delta"
        />
      </div>

      {/* Stock In vs Out Chart */}
      <ReportChartCard
        title="Stock Intake vs Outflow Velocity"
        subtitle="Receipts vs patient dispensing consumption"
        loading={loading}
        empty={!loading && (s?.stockReceived === 0 && s?.stockDispensed === 0)}
      >
        <SvgBarChart
          data={comparisonData}
        />
      </ReportChartCard>

      {/* Stock Movement Ledger Table */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-[0_2px_12px_-4px_rgba(15,23,42,0.04)] overflow-hidden">
        <div className="p-5 border-b border-slate-100 bg-slate-50/50">
          <h3 className="text-base font-bold text-slate-900">Stock Movement Audit Ledger</h3>
          <p className="text-xs text-slate-500 mt-0.5">Authoritative append-only log of every inventory addition, deduction, and reconciliation.</p>
        </div>

        <DataTableToolbar
          searchQuery=""
          onSearchChange={() => {}}
          exportOptions={{
            pdf: true,
            excel: true,
            csv: true,
            onExport: handleExport
          }}
          filterSlot={
            <div className="flex flex-wrap items-center gap-2">
              <Select value={movementTypeFilter} onValueChange={setMovementTypeFilter}>
                <SelectTrigger className="h-9 w-[160px] bg-slate-50/50 border-slate-200 text-xs font-medium">
                  <SelectValue placeholder="All Movements" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Movements</SelectItem>
                  <SelectItem value="PURCHASE_RECEIPT">Purchase Receipt</SelectItem>
                  <SelectItem value="DISPENSING">Dispensing</SelectItem>
                  <SelectItem value="ADJUSTMENT">Adjustment</SelectItem>
                </SelectContent>
              </Select>

              <Select value={medicineFilter} onValueChange={setMedicineFilter}>
                <SelectTrigger className="h-9 w-[160px] bg-slate-50/50 border-slate-200 text-xs font-medium">
                  <SelectValue placeholder="All Medicines" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Medicines</SelectItem>
                  {medicines.map(m => (
                    <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
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
                title="No stock movements recorded"
                description="No inventory transactions match your criteria in this period."
              />
            }
          />
        </div>
      </div>
    </div>
  )
}
