import { useState, useEffect, useCallback } from 'react'
import { KpiCard } from '../dashboard/dashboard-components'
import { ShoppingBag, AlertCircle, FileText, CreditCard, DollarSign } from 'lucide-react'
import { api } from '../../lib/api'
import { ReportChartCard, SvgDonutChart } from './ReportChartCard'
import { DataTable, DataTableEmpty } from '../data-table/data-table'
import { DataTableToolbar } from '../data-table/data-table-toolbar'
import { Badge } from '../ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select'
import type { ColumnDef, PaginationState } from '@tanstack/react-table'
import toast from 'react-hot-toast'
import type { ProcurementReportResponse, ProcurementReportItem, ProcurementReportBillItem, ProcurementReportPaymentItem, SupplierProcurementSummary } from '../../types/reports'
import type { DateRangeState } from './ReportDateRange'

interface ProcurementReportProps {
  dateRange: DateRangeState
}

export function ProcurementReport({ dateRange }: ProcurementReportProps) {
  const [data, setData] = useState<ProcurementReportResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [activeTab, setActiveTab] = useState<'orders' | 'bills' | 'payments'>('orders')
  const [supplierFilter, setSupplierFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: 10 })

  const [suppliers, setSuppliers] = useState<{ id: string; name: string }[]>([])

  useEffect(() => {
    api.get<any[]>('/api/suppliers')
      .then(res => setSuppliers(res.map(s => ({ id: s.id, name: s.name }))))
      .catch(() => {})
  }, [])

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      params.set('page', String(pagination.pageIndex + 1))
      params.set('limit', String(pagination.pageSize))
      if (supplierFilter !== 'all') params.set('supplierId', supplierFilter)
      if (statusFilter !== 'all') params.set('status', statusFilter)
      if (dateRange.startDate) params.set('startDate', dateRange.startDate)
      if (dateRange.endDate) params.set('endDate', dateRange.endDate)

      const res = await api.get<ProcurementReportResponse>(`/api/reports/procurement?${params.toString()}`)
      setData(res)
    } catch (err: any) {
      console.error('Failed to load procurement report:', err)
      setError(err.message || 'Failed to load procurement report')
      toast.error('Failed to load procurement report')
    } finally {
      setLoading(false)
    }
  }, [dateRange.startDate, dateRange.endDate, pagination.pageIndex, pagination.pageSize, supplierFilter, statusFilter])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  useEffect(() => {
    setPagination(prev => ({ ...prev, pageIndex: 0 }))
  }, [supplierFilter, statusFilter, dateRange.startDate, dateRange.endDate, activeTab])

  const handleExport = async (format: 'pdf' | 'xlsx' | 'csv') => {
    try {
      const params = new URLSearchParams()
      params.set('format', format)
      params.set('section', activeTab)
      if (supplierFilter !== 'all') params.set('supplierId', supplierFilter)
      if (statusFilter !== 'all') params.set('status', statusFilter)
      if (dateRange.startDate) params.set('startDate', dateRange.startDate)
      if (dateRange.endDate) params.set('endDate', dateRange.endDate)

      const ext = format === 'xlsx' ? 'xlsx' : format === 'pdf' ? 'pdf' : 'csv'
      const filename = `${activeTab}_report_${new Date().toISOString().split('T')[0]}.${ext}`
      await api.download(`/api/reports/procurement/export?${params.toString()}`, filename)
      toast.success(`Exported ${format.toUpperCase()} successfully`)
    } catch (err: any) {
      toast.error(err.message || 'Failed to export report')
    }
  }

  const rows = data?.data || []
  const bills = data?.bills || []
  const payments = data?.payments || []
  const s = data?.summary
  const supplierRows = data?.supplierSummary || []

  // Donut data for PO status breakdown
  const donutData = [
    { label: 'Draft', value: s?.draftPOs || 0, color: '#94a3b8' },
    { label: 'Ordered', value: s?.orderedPOs || 0, color: '#3b82f6' },
    { label: 'Partially Received', value: s?.partiallyReceivedPOs || 0, color: '#f59e0b' },
    { label: 'Received', value: s?.receivedPOs || 0, color: '#10b981' },
    { label: 'Cancelled', value: s?.cancelledPOs || 0, color: '#f43f5e' }
  ].filter(d => d.value > 0)

  const poColumns: ColumnDef<ProcurementReportItem>[] = [
    {
      header: () => <div className="text-left font-semibold text-slate-600">PO Number</div>,
      accessorKey: 'orderNumber',
      cell: ({ row }) => <span className="font-mono text-xs font-semibold text-slate-900">{row.original.orderNumber}</span>
    },
    {
      header: () => <div className="text-left font-semibold text-slate-600">Supplier</div>,
      accessorKey: 'supplierName',
      cell: ({ row }) => <span className="font-medium text-slate-800 text-xs">{row.original.supplierName}</span>
    },
    {
      header: () => <div className="text-center font-semibold text-slate-600">Order Date</div>,
      accessorKey: 'orderDate',
      cell: ({ row }) => (
        <span className="font-mono text-xs text-slate-600">
          {new Date(row.original.orderDate).toLocaleDateString()}
        </span>
      )
    },
    {
      header: () => <div className="text-center font-semibold text-slate-600">Items</div>,
      accessorKey: 'lineItemsCount',
      cell: ({ row }) => <div className="text-center font-mono text-xs">{row.original.lineItemsCount}</div>
    },
    {
      header: () => <div className="text-center font-semibold text-slate-600">Ordered Qty</div>,
      accessorKey: 'orderedQuantity',
      cell: ({ row }) => <div className="text-center font-mono text-xs font-medium">{row.original.orderedQuantity}</div>
    },
    {
      header: () => <div className="text-center font-semibold text-slate-600">Received Qty</div>,
      accessorKey: 'receivedQuantity',
      cell: ({ row }) => (
        <div className="text-center">
          <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 font-mono text-xs">
            {row.original.receivedQuantity}
          </Badge>
        </div>
      )
    },
    {
      header: () => <div className="text-right font-semibold text-slate-600">Total Value</div>,
      accessorKey: 'totalCostValue',
      cell: ({ row }) => <div className="text-right font-mono font-bold text-slate-800 text-xs">₹{row.original.totalCostValue.toLocaleString()}</div>
    },
    {
      header: () => <div className="text-center font-semibold text-slate-600">Status</div>,
      accessorKey: 'status',
      cell: ({ row }) => {
        const st = row.original.status
        let badge = <Badge variant="outline">{st}</Badge>
        if (st === 'Received') badge = <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200">Collected</Badge>
        else if (st === 'Partially Received') badge = <Badge className="bg-amber-100 text-amber-800 border-amber-200">Partially Collected</Badge>
        else if (st === 'Ordered') badge = <Badge className="bg-blue-100 text-blue-800 border-blue-200">Waiting for Receive</Badge>
        else if (st === 'Cancelled') badge = <Badge className="bg-rose-100 text-rose-800 border-rose-200">Cancelled</Badge>
        return <div className="text-center">{badge}</div>
      }
    }
  ]

  const billColumns: ColumnDef<ProcurementReportBillItem>[] = [
    {
      header: () => <div className="text-left font-semibold text-slate-600">Invoice Number</div>,
      accessorKey: 'invoiceNumber',
      cell: ({ row }) => <span className="font-mono text-xs font-semibold text-slate-900">{row.original.invoiceNumber}</span>
    },
    {
      header: () => <div className="text-center font-semibold text-slate-600">Invoice Date</div>,
      accessorKey: 'invoiceDate',
      cell: ({ row }) => (
        <span className="font-mono text-xs text-slate-600">
          {new Date(row.original.invoiceDate).toLocaleDateString()}
        </span>
      )
    },
    {
      header: () => <div className="text-right font-semibold text-slate-600">Billed Amount</div>,
      accessorKey: 'amount',
      cell: ({ row }) => <div className="text-right font-mono font-bold text-slate-900 text-xs">₹{row.original.amount.toLocaleString()}</div>
    },
    {
      header: () => <div className="text-right font-semibold text-slate-600">Paid</div>,
      accessorKey: 'totalPaid',
      cell: ({ row }) => <div className="text-right font-mono font-semibold text-emerald-600 text-xs">₹{row.original.totalPaid.toLocaleString()}</div>
    },
    {
      header: () => <div className="text-right font-semibold text-slate-600">Outstanding Balance</div>,
      accessorKey: 'balance',
      cell: ({ row }) => <div className={`text-right font-mono font-bold text-xs ${row.original.balance > 0 ? 'text-amber-600' : 'text-slate-400'}`}>₹{row.original.balance.toLocaleString()}</div>
    },
    {
      header: () => <div className="text-center font-semibold text-slate-600">Status</div>,
      accessorKey: 'status',
      cell: ({ row }) => {
        const st = row.original.status
        let badge = <Badge variant="outline">{st}</Badge>
        if (st === 'Paid') badge = <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200">Paid</Badge>
        else if (st === 'Partial') badge = <Badge className="bg-amber-100 text-amber-800 border-amber-200">Partial</Badge>
        else if (st === 'Unpaid') badge = <Badge className="bg-rose-100 text-rose-800 border-rose-200">Unpaid</Badge>
        return <div className="text-center">{badge}</div>
      }
    }
  ]

  const paymentColumns: ColumnDef<ProcurementReportPaymentItem>[] = [
    {
      header: () => <div className="text-center font-semibold text-slate-600">Payment Date</div>,
      accessorKey: 'date',
      cell: ({ row }) => (
        <span className="font-mono text-xs text-slate-600">
          {new Date(row.original.date).toLocaleDateString()}
        </span>
      )
    },
    {
      header: () => <div className="text-left font-semibold text-slate-600">Invoice #</div>,
      accessorKey: 'invoiceNumber',
      cell: ({ row }) => <span className="font-mono text-xs font-semibold text-slate-900">{row.original.invoiceNumber}</span>
    },
    {
      header: () => <div className="text-left font-semibold text-slate-600">Supplier</div>,
      accessorKey: 'supplierName',
      cell: ({ row }) => <span className="font-medium text-slate-800 text-xs">{row.original.supplierName}</span>
    },
    {
      header: () => <div className="text-center font-semibold text-slate-600">Method</div>,
      accessorKey: 'method',
      cell: ({ row }) => (
        <div className="text-center">
          <Badge variant="outline" className="text-xs">{row.original.method}</Badge>
        </div>
      )
    },
    {
      header: () => <div className="text-right font-semibold text-slate-600">Amount Paid</div>,
      accessorKey: 'amount',
      cell: ({ row }) => <div className="text-right font-mono font-bold text-emerald-700 text-xs">₹{row.original.amount.toLocaleString()}</div>
    },
    {
      header: () => <div className="text-left font-semibold text-slate-600">Notes</div>,
      accessorKey: 'notes',
      cell: ({ row }) => <span className="text-xs text-slate-500 italic">{row.original.notes || '—'}</span>
    }
  ]

  const supplierColumns: ColumnDef<SupplierProcurementSummary>[] = [
    {
      header: () => <div className="text-left font-semibold text-slate-600">Supplier</div>,
      accessorKey: 'supplierName',
      cell: ({ row }) => <span className="font-semibold text-slate-900 text-xs">{row.original.supplierName}</span>
    },
    {
      header: () => <div className="text-left font-semibold text-slate-600">Contact</div>,
      accessorKey: 'contactPerson',
      cell: ({ row }) => (
        <div className="text-xs text-slate-600">
          <span>{row.original.contactPerson}</span>
          {row.original.phone !== '—' && <span className="block font-mono text-[10px] text-slate-400">{row.original.phone}</span>}
        </div>
      )
    },
    {
      header: () => <div className="text-center font-semibold text-slate-600">Total POs</div>,
      accessorKey: 'totalPOs',
      cell: ({ row }) => <div className="text-center font-mono font-bold text-xs">{row.original.totalPOs}</div>
    },
    {
      header: () => <div className="text-center font-semibold text-slate-600">Ordered Qty</div>,
      accessorKey: 'totalItemsOrdered',
      cell: ({ row }) => <div className="text-center font-mono text-xs">{row.original.totalItemsOrdered}</div>
    },
    {
      header: () => <div className="text-center font-semibold text-slate-600">Received Qty</div>,
      accessorKey: 'totalItemsReceived',
      cell: ({ row }) => <div className="text-center font-mono text-xs font-semibold text-emerald-700">{row.original.totalItemsReceived}</div>
    },
    {
      header: () => <div className="text-right font-semibold text-slate-600">Purchase Value</div>,
      accessorKey: 'totalPurchaseValue',
      cell: ({ row }) => <div className="text-right font-mono font-bold text-slate-900 text-xs">₹{row.original.totalPurchaseValue.toLocaleString()}</div>
    },
    {
      header: () => <div className="text-center font-semibold text-slate-600">Last Order</div>,
      accessorKey: 'lastOrderDate',
      cell: ({ row }) => (
        <span className="font-mono text-xs text-slate-500">
          {row.original.lastOrderDate ? new Date(row.original.lastOrderDate).toLocaleDateString() : '—'}
        </span>
      )
    }
  ]

  if (error) {
    return (
      <div className="p-8 text-center bg-white rounded-2xl border border-rose-100 flex flex-col items-center">
        <AlertCircle className="w-10 h-10 text-rose-500 mb-2" />
        <h3 className="font-bold text-slate-900">Failed to load procurement report</h3>
        <p className="text-xs text-slate-500 mt-1 mb-4">{error}</p>
        <button onClick={fetchData} className="px-4 py-2 bg-teal-600 text-white rounded-xl text-xs font-semibold hover:bg-teal-700">
          Retry
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Financial & Procurement KPI Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          title="Total Billed (Invoices)"
          value={loading ? '...' : `₹${(s?.totalBilledAmount ?? 0).toLocaleString()}`}
          icon={FileText}
          colorClass="text-blue-600"
          bgClass="bg-blue-100"
          trendLabel={`${s?.totalBillsCount ?? 0} bills in period`}
        />
        <KpiCard
          title="Total Paid to Suppliers"
          value={loading ? '...' : `₹${(s?.totalPaidAmount ?? 0).toLocaleString()}`}
          icon={CreditCard}
          colorClass="text-emerald-600"
          bgClass="bg-emerald-100"
          trendLabel="Actual disbursements"
        />
        <KpiCard
          title="Outstanding Payable Balance"
          value={loading ? '...' : `₹${(s?.totalOutstandingBalance ?? 0).toLocaleString()}`}
          icon={DollarSign}
          colorClass="text-amber-600"
          bgClass="bg-amber-100"
          trendLabel="Unpaid supplier liability"
        />
        <KpiCard
          title="Total Purchase Orders"
          value={loading ? '...' : (s?.totalPOs ?? 0)}
          icon={ShoppingBag}
          colorClass="text-teal-600"
          bgClass="bg-teal-100"
          trendLabel={`${s?.receivedPOs ?? 0} received`}
        />
      </div>

      {/* PO Status Donut Chart */}
      <ReportChartCard
        title="Purchase Order Status Distribution"
        subtitle="Breakdown of purchase orders by fulfillment state"
        loading={loading}
        empty={!loading && donutData.length === 0}
      >
        <SvgDonutChart
          data={donutData}
          centerLabel={String(s?.totalPOs || 0)}
          centerSub="Total Orders"
        />
      </ReportChartCard>

      {/* Section Selection Tabs */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-[0_2px_12px_-4px_rgba(15,23,42,0.04)] overflow-hidden">
        <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h3 className="text-base font-bold text-slate-900">Procurement & Financial Records</h3>
            <p className="text-xs text-slate-500 mt-0.5">Filter records by supplier, fulfillment status, and export full reports.</p>
          </div>
          <div className="flex items-center gap-1 bg-slate-200/70 p-1 rounded-xl w-fit">
            <button
              onClick={() => setActiveTab('orders')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${activeTab === 'orders' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
            >
              Purchase Orders ({s?.totalPOs ?? 0})
            </button>
            <button
              onClick={() => setActiveTab('bills')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${activeTab === 'bills' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
            >
              Supplier Bills ({s?.totalBillsCount ?? 0})
            </button>
            <button
              onClick={() => setActiveTab('payments')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${activeTab === 'payments' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
            >
              Supplier Payments ({payments.length})
            </button>
          </div>
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
              <Select value={supplierFilter} onValueChange={setSupplierFilter}>
                <SelectTrigger className="h-9 w-[160px] bg-slate-50/50 border-slate-200 text-xs font-medium">
                  <SelectValue placeholder="All Suppliers" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Suppliers</SelectItem>
                  {suppliers.map(s => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {activeTab === 'orders' && (
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="h-9 w-[160px] bg-slate-50/50 border-slate-200 text-xs font-medium">
                    <SelectValue placeholder="All Statuses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="Draft">Draft</SelectItem>
                    <SelectItem value="Ordered">Ordered</SelectItem>
                    <SelectItem value="Partially Received">Partially Received</SelectItem>
                    <SelectItem value="Received">Received</SelectItem>
                    <SelectItem value="Cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              )}
            </div>
          }
        />

        <div className="p-4">
          {activeTab === 'orders' && (
            <DataTable
              columns={poColumns}
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
                  title="No purchase orders found"
                  description="No orders match your criteria for the selected period."
                />
              }
            />
          )}

          {activeTab === 'bills' && (
            <DataTable
              columns={billColumns}
              data={bills}
              loading={loading}
              emptyState={
                <DataTableEmpty
                  title="No supplier bills found"
                  description="No supplier invoices recorded for the selected period."
                />
              }
            />
          )}

          {activeTab === 'payments' && (
            <DataTable
              columns={paymentColumns}
              data={payments}
              loading={loading}
              emptyState={
                <DataTableEmpty
                  title="No supplier payments found"
                  description="No disbursements made to suppliers for the selected period."
                />
              }
            />
          )}
        </div>
      </div>

      {/* Supplier Summary Table */}
      {supplierRows.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-[0_2px_12px_-4px_rgba(15,23,42,0.04)] overflow-hidden">
          <div className="p-5 border-b border-slate-100 bg-slate-50/50">
            <h3 className="text-base font-bold text-slate-900">Supplier Procurement Performance</h3>
            <p className="text-xs text-slate-500 mt-0.5">Purchasing volumes, quantities received, and spend by vendor.</p>
          </div>
          <div className="p-4">
            <DataTable
              columns={supplierColumns}
              data={supplierRows}
              loading={loading}
              emptyState={
                <DataTableEmpty
                  title="No supplier summary available"
                  description="No supplier orders in this timeframe."
                />
              }
            />
          </div>
        </div>
      )}
    </div>
  )
}
