import { useState, useMemo, useEffect, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Search, CheckCircle2, AlertCircle, Eye } from 'lucide-react'
import { DataTable } from '../components/data-table/data-table'
import type { ColumnDef, PaginationState } from '@tanstack/react-table'
import { Badge } from '../components/ui/badge'
import { Button } from '../components/ui/button'
import { DataTableToolbar } from '../components/data-table/data-table-toolbar'
import { DataTableEmpty } from '../components/data-table/data-table'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog'
import { PaymentMethodSelector } from '../components/payment/payment-components'
import type { PaymentMethod } from '../components/payment/payment-components'
import { useClinicContext } from '../context/ClinicContext'
import { useAuth } from '../context/AuthContext'
import { api } from '../lib/api'
import type { PaginationMeta } from '../types/domain'
import { WhatsAppActionButton } from '../components/communication/WhatsAppActionButton'

export function PaymentPage() {
  const { currentUser } = useAuth()
  const isReceptionist = currentUser?.role === 'Receptionist'
  const [searchParams] = useSearchParams()
  const urlPatientId = searchParams.get('patientId')
  
  const { recordPayment } = useClinicContext()

  const [paymentVisits, setPaymentVisits] = useState<any[]>([])
  const [meta, setMeta] = useState<PaginationMeta>({ currentPage: 1, pageSize: 10, totalRecords: 0, totalPages: 0 })
  const [isLoading, setIsLoading] = useState(false)
  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: 10 })

  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')

  const [selectedRow, setSelectedRow] = useState<any | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [activeMethod, setActiveMethod] = useState<PaymentMethod>(null)
  const [paymentState, setPaymentState] = useState<'pending' | 'completed'>('pending')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  useEffect(() => {
    if (urlPatientId) setSearch(urlPatientId)
  }, [urlPatientId])

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300)
    return () => clearTimeout(timer)
  }, [search])

  useEffect(() => {
    setPagination(prev => ({ ...prev, pageIndex: 0 }))
  }, [debouncedSearch, filterStatus])

  const fetchPayments = useCallback(async (page: number, limit: number, query: string, status: string) => {
    setIsLoading(true)
    try {
      let statusParam = 'READY_FOR_PAYMENT,COMPLETED'
      if (status === 'pending') statusParam = 'READY_FOR_PAYMENT'
      if (status === 'completed') statusParam = 'COMPLETED'

      const res = await api.get<any>(`/api/billing?status=${statusParam}&page=${page}&limit=${limit}&search=${encodeURIComponent(query)}`)
      if (res.data && res.meta) {
        setPaymentVisits(res.data)
        setMeta(res.meta)
      } else {
        setPaymentVisits(res)
      }
    } catch (e) {
      console.error(e)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchPayments(pagination.pageIndex + 1, pagination.pageSize, debouncedSearch, filterStatus)
  }, [pagination.pageIndex, pagination.pageSize, debouncedSearch, filterStatus, fetchPayments])

  const paymentData = useMemo(() => {
    const list = isReceptionist ? paymentVisits.filter(v => v.paymentOwner !== 'DOCTOR') : paymentVisits
    return list.map(v => {
      const p = v.patient
      const payRecord = v.payment
      
      return {
        paymentId: payRecord?.id || '',
        visitId: v.id,
        paymentOwner: v.paymentOwner,
        patientId: p?.id || 'Unknown',
        patientName: p?.name || 'Unknown',
        patientPhone: p?.phone || '-',
        amount: v.amountDue || 0,
        consultationFee: v.consultationFee || 0,
        medicineCost: v.medicineCost || 0,
        method: payRecord?.method || null,
        status: payRecord ? 'Paid' : 'Pending',
        preferredCommunicationChannel: p?.preferredCommunicationChannel,
        whatsappAvailable: p?.whatsappAvailable
      }
    })
  }, [paymentVisits, isReceptionist])

  const handleOpenDrawer = (row: any) => {
    setSelectedRow(row)
    setActiveMethod(row.method)
    setPaymentState(row.status === 'Paid' ? 'completed' : 'pending')
    setErrorMsg(null)
    setDrawerOpen(true)
  }

  const handleMarkAsPaid = async () => {
    if (selectedRow && activeMethod && (activeMethod === 'Cash' || activeMethod === 'GPay')) {
      setErrorMsg(null)
      const result = await recordPayment(selectedRow.visitId, selectedRow.amountDue, activeMethod as 'Cash' | 'GPay')
      
      if (result.success) {
        setPaymentState('completed')
        fetchPayments(pagination.pageIndex + 1, pagination.pageSize, debouncedSearch, filterStatus)
      } else {
        setErrorMsg(result.error || 'Failed to record payment')
      }
    } else {
       setErrorMsg('Please select a valid payment method.')
    }
  }

  const columns: ColumnDef<any>[] = [
    {
      header: "Patient",
      accessorKey: "patientName",
      cell: ({ row }) => (
        <div>
          <div className="font-semibold text-slate-900">{row.original.patientName}</div>
        </div>
      )
    },
    {
      header: "Amount Due",
      accessorKey: "amount",
      cell: ({ row }) => <span className="font-semibold text-slate-900">₹{row.original.amount.toLocaleString('en-IN')}</span>
    },
    {
      header: "Status",
      accessorKey: "status",
      cell: ({ row }) => {
        const s = row.original.status
        if (s === 'Pending') return <Badge variant="statusWaiting">{s}</Badge>
        if (s === 'Paid') return <Badge variant="statusActive">{s}</Badge>
        return <Badge variant="secondary">{s}</Badge>
      }
    },
    {
      id: "actions",
      header: "Actions",
      cell: ({ row }) => (
        <div className="flex justify-end gap-2">
          {row.original.status === 'Paid' ? (
            <>
              <WhatsAppActionButton
                type="PAYMENT_RECEIPT"
                entityType="VISIT"
                entityId={row.original.visitId}
                patientId={row.original.patientId}
                recipientName={row.original.patientName}
                recipientPhone={row.original.patientPhone}
                paymentOwner={row.original.paymentOwner}
                preferredCommunicationChannel={row.original.preferredCommunicationChannel}
                whatsappAvailable={row.original.whatsappAvailable}
                variant="icon"
                label="Send Receipt via WhatsApp"
              />
              <Button 
                size="icon"
                onClick={() => handleOpenDrawer(row.original)}
                className="h-8 w-8 shadow-sm bg-slate-800 hover:bg-slate-900 text-white rounded-lg"
                aria-label="View payment"
              >
                <Eye className="h-4 w-4" />
              </Button>
            </>
          ) : (
            <Button 
              size="sm"
              onClick={() => handleOpenDrawer(row.original)}
              className="h-8 px-3 text-xs font-medium shadow-sm bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg"
            >
              Collect Payment
            </Button>
          )}
        </div>
      )
    }
  ]

  return (
    <div className="h-full flex flex-col gap-6 max-w-[1400px] mx-auto pb-8">
      
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Collect Payment</h1>
        <p className="text-slate-500 mt-1">Collect payment for visits ready for payment.</p>
      </div>

      <DataTableToolbar
        searchQuery={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search patient, ID or visit..."
        filterSlot={
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="flex h-9 w-[150px] items-center justify-between rounded-xl border border-input bg-slate-50/50 hover:bg-slate-50 px-3 py-1.5 text-sm shadow-sm ring-offset-background focus:outline-none focus:ring-1 focus:ring-teal-500"
          >
            <option value="all">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="completed">Completed</option>
          </select>
        }
        exportOptions={{ 
          pdf: true, 
          excel: true, 
          csv: true,
          onExport: (format) => {
            let statusParam = 'READY_FOR_PAYMENT,COMPLETED'
            if (filterStatus === 'pending') statusParam = 'READY_FOR_PAYMENT'
            if (filterStatus === 'completed') statusParam = 'COMPLETED'

            const query = new URLSearchParams({
              format,
              ...(search ? { search } : {}),
              status: statusParam
            }).toString();
            api.download(`/api/billing/export?${query}`, `payments_export.${format}`);
          }
        }}
      />

      {/* Data Table */}
      <div className="bg-white rounded-2xl border border-slate-100/60 shadow-[0_2px_12px_-4px_rgba(15,23,42,0.04)] overflow-hidden flex-1">
        <DataTable 
          columns={columns} 
          data={paymentData}
          onRowClick={handleOpenDrawer}
          loading={isLoading}
          manualPagination={true}
          pageCount={meta.totalPages}
          totalRecords={meta.totalRecords}
          state={{ pagination }}
          onStateChange={(updater: any) => {
            if (typeof updater === 'function') {
              setPagination(updater(pagination));
            } else if (updater.pagination) {
              setPagination(updater.pagination);
            }
          }}
          emptyState={
            search !== '' ? (
              <DataTableEmpty 
                icon={Search} 
                title="No payments found" 
                description={`There are no payment records matching "${search}".`}
              />
            ) : (
              <DataTableEmpty 
                title="No pending payments" 
                description="All visits are settled." 
              />
            )
          }
        />
      </div>

      {/* Collect Payment Dialog */}
      <Dialog open={drawerOpen} onOpenChange={setDrawerOpen}>
        <DialogContent className="sm:max-w-md p-0 overflow-hidden bg-white">
          {selectedRow && (
            <>
              {paymentState === 'completed' ? (
                // COMPLETION STATE
                <div className="flex flex-col p-8 justify-center text-center space-y-5">
                  <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
                    <CheckCircle2 className="w-8 h-8" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Payment Received</h2>
                    <p className="text-emerald-600 mt-1 font-medium">Visit completed.</p>
                  </div>
                  <div className="bg-slate-50 p-4 rounded-xl text-left space-y-2 mt-4">
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-slate-500">Patient</span>
                      <span className="font-semibold text-slate-900">{selectedRow.patientName}</span>
                    </div>
                    {selectedRow.consultationFee > 0 && (
                      <div className="flex justify-between items-center text-sm text-slate-600">
                        <span>Consultation Fee</span>
                        <span>₹{selectedRow.consultationFee.toLocaleString('en-IN')}</span>
                      </div>
                    )}
                    {selectedRow.medicineCost > 0 && (
                      <div className="flex justify-between items-center text-sm text-slate-600">
                        <span>Pharmacy / Medicines</span>
                        <span>₹{selectedRow.medicineCost.toLocaleString('en-IN')}</span>
                      </div>
                    )}
                    <div className="flex justify-between items-center text-sm pt-2 border-t border-slate-200">
                      <span className="text-slate-500">Total Amount</span>
                      <span className="font-semibold text-emerald-600">₹{selectedRow.amount.toLocaleString('en-IN')}</span>
                    </div>
                  </div>
                  <div className="pt-4 flex flex-col gap-2">
                    <Button variant="outline" onClick={() => setDrawerOpen(false)} className="w-full">
                      Close
                    </Button>
                  </div>
                </div>
              ) : (
                // PAYMENT WORKSPACE
                <>
                  <DialogHeader className="px-6 py-5 border-b bg-slate-50">
                    <DialogTitle className="text-xl flex justify-between items-center">
                      Collect Payment
                      <Badge variant="statusWaiting">Pending</Badge>
                    </DialogTitle>
                    <div className="text-sm text-slate-500 mt-1">
                      <span className="font-medium text-slate-900">{selectedRow.patientName}</span> • Amount Due: <span className="font-bold text-slate-900">₹{selectedRow.amount.toLocaleString('en-IN')}</span>
                    </div>
                  </DialogHeader>
                  
                  <div className="p-6 space-y-6">
                    {errorMsg && (
                      <div className="p-3 bg-red-50 text-red-600 text-sm rounded-lg flex items-start gap-2">
                        <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                        <span>{errorMsg}</span>
                      </div>
                    )}

                    <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 space-y-2">
                      <h4 className="text-sm font-semibold text-slate-900 mb-3">Bill Breakdown</h4>
                      {selectedRow.consultationFee > 0 && (
                        <div className="flex justify-between text-sm text-slate-600">
                          <span>Consultation Fee</span>
                          <span>₹{selectedRow.consultationFee.toLocaleString('en-IN')}</span>
                        </div>
                      )}
                      {selectedRow.medicineCost > 0 && (
                        <div className="flex justify-between text-sm text-slate-600">
                          <span>Pharmacy / Medicines</span>
                          <span>₹{selectedRow.medicineCost.toLocaleString('en-IN')}</span>
                        </div>
                      )}
                      <div className="flex justify-between font-semibold text-slate-900 pt-2 border-t border-slate-200 mt-2">
                        <span>Total Due</span>
                        <span>₹{selectedRow.amount.toLocaleString('en-IN')}</span>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <PaymentMethodSelector 
                        value={activeMethod} 
                        onChange={setActiveMethod} 
                      />
                    </div>
                  </div>
                  
                  <DialogFooter className="px-6 py-4 border-t bg-slate-50 gap-2 sm:gap-0">
                    <Button variant="outline" onClick={() => setDrawerOpen(false)} className="bg-white">Cancel</Button>
                    <Button 
                      className="bg-indigo-600 hover:bg-indigo-700" 
                      onClick={handleMarkAsPaid}
                      disabled={!activeMethod}
                    >
                      Payment Received
                    </Button>
                  </DialogFooter>
                </>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>

    </div>
  )
}

