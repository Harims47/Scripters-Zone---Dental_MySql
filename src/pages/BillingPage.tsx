import { useState, useMemo, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Search, CheckCircle2, FileText, Receipt, Eye } from 'lucide-react'
import { DataTable, DataTableEmpty } from '../components/data-table/data-table'
import type { ColumnDef } from '@tanstack/react-table'
import { Badge } from '../components/ui/badge'
import { Button } from '../components/ui/button'
import { DataTableToolbar } from '../components/data-table/data-table-toolbar'
import { Dialog, DialogContent, DialogTitle } from '../components/ui/dialog'
import { PatientProfileHeader, DrawerSection } from '../components/ui/drawer-patterns'
import { DispensingMedicineItem } from '../components/dispensing/dispensing-components'
import type { DispensingItem } from '../components/dispensing/dispensing-components'
import { PaymentMethodSelector } from '../components/payment/payment-components'
import type { PaymentMethod } from '../components/payment/payment-components'
import { useClinicContext } from '../context/ClinicContext'
import { useAuth } from '../context/AuthContext'
import { api, API_BASE_URL } from '../lib/api'
import { WhatsAppActionButton } from '../components/communication/WhatsAppActionButton'

export function BillingPage() {
  const { currentUser } = useAuth()
  const isReceptionist = currentUser?.role === 'Receptionist'
  const [searchParams] = useSearchParams()
  const urlPatientId = searchParams.get('patientId')
  
  const { medicines, completeDispensing, recordPayment } = useClinicContext()

  const [billingVisits, setBillingVisits] = useState<any[]>([])
  const [meta, setMeta] = useState<any>({ currentPage: 1, pageSize: 10, totalRecords: 0, totalPages: 0 })
  const [isLoading, setIsLoading] = useState(false)
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 10 })

  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300)
    return () => clearTimeout(timer)
  }, [search])

  useEffect(() => {
    setPagination(prev => ({ ...prev, pageIndex: 0 }))
  }, [debouncedSearch, statusFilter])

  const fetchBilling = async (page: number, limit: number, query: string, statusFilterVal: string) => {
    setIsLoading(true)
    try {
      let statusQuery = '';
      if (statusFilterVal === 'pending') {
        statusQuery = '&status=READY_FOR_RECEPTION,READY_FOR_PAYMENT';
      } else if (statusFilterVal === 'completed') {
        statusQuery = '&status=COMPLETED';
      }
      const res = await api.get<any>(`/api/billing?page=${page}&limit=${limit}&search=${encodeURIComponent(query)}${statusQuery}`)
      if (res.data && res.meta) {
        setBillingVisits(res.data)
        setMeta(res.meta)
      } else {
        setBillingVisits(res)
      }
    } catch (error) {
      console.error(error)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchBilling(pagination.pageIndex + 1, pagination.pageSize, debouncedSearch, statusFilter)
  }, [pagination.pageIndex, pagination.pageSize, debouncedSearch, statusFilter])

  // 1. Data Aggregation
  const billingData = useMemo(() => {
    const list = isReceptionist ? billingVisits.filter(v => v.paymentOwner !== 'DOCTOR') : billingVisits
    return list.map(v => {
      const p = v.patient
      const rx = v.prescription
      const disp = v.dispensing
      const payRecord = v.payment

      let dispensingStatus = 'Not Required'
      if (rx && rx.items && rx.items.length > 0) {
        dispensingStatus = disp ? 'Dispensed' : 'Pending'
      }

      const paymentStatus = payRecord ? 'Paid' : 'Pending'

      let action = 'View'
      if (dispensingStatus === 'Pending') action = 'Process Billing'
      else if (paymentStatus === 'Pending') action = 'Collect Payment'

      // Build active items for dispensing if prescription exists
      const items: DispensingItem[] = rx && rx.items ? rx.items.map((ri: any, idx: number) => {
        const med = medicines.find(m => m.id === ri.medicineId)
        const dItem = disp?.items?.find((di: any) => di.medicineId === ri.medicineId)
        
        return {
          id: `i${idx}`,
          medicineId: ri.medicineId,
          name: med?.name || 'Unknown',
          strength: med?.unit || '',
          categoryId: med?.categoryId || 'cat1',
          prescribedQty: ri.quantity,
          dispensedQty: dItem ? dItem.dispensedQuantity : ri.quantity,
          availableStock: med?.currentStock || 0,
          unitPrice: med?.unitPrice || 0
        }
      }) : []

      return {
        id: v.id,
        visitId: v.id,
        prescriptionId: rx?.id,
        patientId: p?.id || 'Unknown',
        patientName: p?.name || 'Unknown',
        patientPhone: p?.phone || '-',
        amount: v.amountDue || 0,
        consultationFee: v.consultationFee || 0,
        treatmentFee: v.treatmentFee || 0,
        medicineCost: v.medicineCost || 0,
        dispensingStatus,
        paymentStatus,
        action,
        items,
        paymentMethod: payRecord?.method || null,
        paymentOwner: v.paymentOwner,
        preferredCommunicationChannel: p?.preferredCommunicationChannel,
        whatsappAvailable: p?.whatsappAvailable
      }
    })
  }, [billingVisits, medicines])

  const [selectedRow, setSelectedRow] = useState<any | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  
  // Dispensing State
  const [activeItems, setActiveItems] = useState<DispensingItem[]>([])
  const [dispenseError, setDispenseError] = useState<string | null>(null)
  
  // Payment State
  const [activeMethod, setActiveMethod] = useState<PaymentMethod>(null)
  const [paymentError, setPaymentError] = useState<string | null>(null)

  useEffect(() => {
    if (urlPatientId) setSearch(urlPatientId)
  }, [urlPatientId])

  const handleOpenDrawer = (row: any) => {
    setSelectedRow(row)
    setActiveItems(row.items.map((item: any) => ({ ...item })))
    setActiveMethod(row.paymentMethod)
    setDispenseError(null)
    setPaymentError(null)
    setDrawerOpen(true)
  }

  const handleQtyChange = (id: string, qty: number) => {
    setActiveItems(prev => prev.map(item => item.id === id ? { ...item, dispensedQty: qty } : item))
  }

  const handleCompleteDispensing = async () => {
    if (selectedRow) {
      setDispenseError(null)
      const mappedItems = activeItems.map(item => ({
        medicineId: item.medicineId,
        prescribedQuantity: item.prescribedQty,
        dispensedQuantity: item.dispensedQty
      }))

      const result = await completeDispensing(selectedRow.visitId, selectedRow.prescriptionId, mappedItems)
      
      if (result.success) {
        // Optimistically update the selected row state so the UI transitions smoothly
        setSelectedRow((prev: any) => ({ ...prev, dispensingStatus: 'Dispensed', action: 'Collect Payment' }))
        fetchBilling(pagination.pageIndex + 1, pagination.pageSize, debouncedSearch, statusFilter)
      } else {
        setDispenseError(result.error || 'Failed to dispense')
      }
    }
  }

  const handleCollectPayment = async () => {
    if (selectedRow && activeMethod) {
      setPaymentError(null)
      const res = await recordPayment(selectedRow.visitId, Number(selectedRow.amount) || 0, activeMethod)
      if (res.success) {
        await fetchBilling(pagination.pageIndex + 1, pagination.pageSize, debouncedSearch, statusFilter)
        setSelectedRow((prev: any) => ({ ...prev, paymentStatus: 'Paid', action: 'View' }))
      } else {
        setPaymentError(res.error || 'Payment failed')
      }
    } else {
       setPaymentError('Please select a valid payment method.')
    }
  }

  const handlePrintDocument = async (type: 'prescription' | 'receipt' | 'invoice') => {
    if (!selectedRow) return;
    try {
      const response = await fetch(`${API_BASE_URL}/api/documents/${type}/${selectedRow.visitId}`, {
        method: 'GET',
        credentials: 'include'
      });
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || `Failed to print ${type}`);
      }
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      window.open(url, '_blank');
      setTimeout(() => window.URL.revokeObjectURL(url), 1000);
    } catch (err: any) {
      console.error(err);
      alert(err.message || `Failed to load ${type} document. Please ensure you are authorized.`);
    }
  };



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
      header: "Amount",
      accessorKey: "amount",
      cell: ({ row }) => <span className="font-medium text-slate-900">₹{row.original.amount}</span>
    },

    {
      header: "Payment",
      accessorKey: "paymentStatus",
      cell: ({ row }) => {
        const s = row.original.paymentStatus
        if (s === 'Pending') return <Badge variant="statusWaiting">{s}</Badge>
        if (s === 'Paid') return <Badge variant="statusInactive">{s}</Badge>
        return <span className="text-sm text-slate-400">{s}</span>
      }
    },
    {
      header: "Method",
      accessorKey: "paymentMethod",
      cell: ({ row }) => {
        const m = row.original.paymentMethod
        if (!m) return <span className="text-sm text-slate-400">-</span>
        return <span className="text-sm font-medium text-slate-700 capitalize">{m}</span>
      }
    },
    {
      id: "actions",
      header: () => <div className="text-right pr-4">Actions</div>,
      cell: ({ row }) => {
        const isComplete = row.original.action === 'View'
        return (
          <div className="flex justify-end pr-4 gap-2">
            {isComplete ? (
              <Button 
                size="icon"
                onClick={(e) => { e.stopPropagation(); handleOpenDrawer(row.original); }}
                className="h-8 w-8 shadow-sm bg-slate-800 hover:bg-slate-900 text-white rounded-lg"
                aria-label="View"
              >
                <Eye className="w-4 h-4" />
              </Button>
            ) : (
              <Button 
                variant="default" 
                size="sm"
                onClick={(e) => { e.stopPropagation(); handleOpenDrawer(row.original); }}
                className="h-8 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg px-4 shadow-sm"
              >
                Collect
              </Button>
            )}
          </div>
        )
      }
    }
  ]

  const totalPrescribed = activeItems.reduce((acc, item) => acc + item.prescribedQty, 0)
  const totalDispensed = activeItems.reduce((acc, item) => acc + item.dispensedQty, 0)
  const isDispensingReady = selectedRow?.dispensingStatus === 'Dispensed' || selectedRow?.dispensingStatus === 'Not Required'
  const isFullyComplete = selectedRow?.paymentStatus === 'Paid'

  return (
    <div className="h-full flex flex-col gap-6 max-w-[1400px] mx-auto pb-8">
      
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Billing</h1>
        <p className="text-slate-500 mt-1">Manage dispensing and payment collection in one place.</p>
      </div>

      <DataTableToolbar
        searchQuery={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search patient or ID..."
        filterSlot={
          <select 
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="flex h-9 w-[150px] items-center justify-between rounded-xl border border-input bg-slate-50/50 hover:bg-slate-50 px-3 py-2 text-sm shadow-sm ring-offset-background focus:outline-none focus:ring-1 focus:ring-teal-500"
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
            const query = new URLSearchParams({
              format,
              ...(search ? { search } : {}),
              ...(statusFilter && statusFilter !== 'all' ? { status: statusFilter === 'pending' ? 'READY_FOR_RECEPTION,READY_FOR_PAYMENT' : 'COMPLETED' } : {})
            }).toString();
            api.download(`/api/billing/export?${query}`, `billing_export.${format}`);
          }
        }}
      />

      {/* Data Table */}
      <div className="bg-white rounded-2xl border border-slate-100/60 shadow-[0_2px_12px_-4px_rgba(15,23,42,0.04)] overflow-hidden flex-1">
        <DataTable 
          columns={columns} 
          data={billingData}
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
                title="No billing items found" 
                description={`There are no records matching "${search}".`}
              />
            ) : (
              <DataTableEmpty 
                icon={Receipt}
                title="No billing items" 
                description="Completed visits will appear here when they are ready for billing." 
              />
            )
          }
        />
      </div>

      {/* Unified Billing Modal */}
      <Dialog open={drawerOpen} onOpenChange={setDrawerOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] bg-white shadow-2xl p-0 flex flex-col gap-0 overflow-hidden">
          <DialogTitle className="sr-only">Billing Workflow</DialogTitle>
          {selectedRow && (
            <>
              {isFullyComplete ? (
                // COMPLETION STATE
                <div className="flex-1 flex flex-col p-10 justify-center text-center space-y-6">
                  <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
                    <CheckCircle2 className="w-10 h-10" />
                  </div>
                  <div>
                    <h2 className="text-3xl font-bold text-slate-900 tracking-tight">Billing Completed</h2>
                    <p className="text-lg text-slate-500 mt-2">Visit Finished</p>
                  </div>
                  <div className="bg-slate-50 p-6 rounded-xl inline-block mx-auto text-left min-w-[300px] space-y-3">
                    <div className="flex justify-between items-center pb-3 border-b">
                      <span className="text-slate-500">Patient</span>
                      <span className="font-semibold text-slate-900">{selectedRow.patientName}</span>
                    </div>
                    <div className="flex justify-between items-center pb-3 border-b">
                      <span className="text-slate-500">Amount Paid</span>
                      <span className="font-semibold text-emerald-600">₹{selectedRow.amount}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500">Method</span>
                      <span className="font-medium text-slate-900">{selectedRow.paymentMethod}</span>
                    </div>
                  </div>
                  <div className="pt-8 flex flex-col gap-3 max-w-sm mx-auto w-full">
                    <div className="flex gap-2">
                      <Button variant="default" className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => handlePrintDocument('receipt')}>
                        <FileText className="w-4 h-4 mr-2" />
                        Print Receipt
                      </Button>
                      <WhatsAppActionButton
                        type="PAYMENT_RECEIPT"
                        entityType="VISIT"
                        entityId={selectedRow.visitId}
                        patientId={selectedRow.patientId}
                        recipientName={selectedRow.patientName}
                        recipientPhone={selectedRow.patientPhone}
                        paymentOwner={selectedRow.paymentOwner}
                        preferredCommunicationChannel={selectedRow.preferredCommunicationChannel}
                        whatsappAvailable={selectedRow.whatsappAvailable}
                        variant="outline"
                        className="h-10 px-3"
                      />
                    </div>
                    {selectedRow.prescriptionId && (
                      <div className="flex gap-2">
                        <Button variant="outline" className="flex-1" onClick={() => handlePrintDocument('prescription')}>
                          <FileText className="w-4 h-4 mr-2 text-indigo-500" />
                          Print Prescription
                        </Button>
                        <WhatsAppActionButton
                          type="PRESCRIPTION"
                          entityType="VISIT"
                          entityId={selectedRow.visitId}
                          patientId={selectedRow.patientId}
                          recipientName={selectedRow.patientName}
                          recipientPhone={selectedRow.patientPhone}
                          preferredCommunicationChannel={selectedRow.preferredCommunicationChannel}
                          whatsappAvailable={selectedRow.whatsappAvailable}
                          variant="outline"
                          className="h-10 px-3"
                        />
                      </div>
                    )}
                    <Button variant="ghost" onClick={() => setDrawerOpen(false)}>Close</Button>
                  </div>
                </div>
              ) : (
                // ACTIVE WORKSPACE
                <>
                  <PatientProfileHeader 
                    name={selectedRow.patientName}
                    patientId={selectedRow.patientId}
                    phone={selectedRow.patientPhone}
                    statusElement={<Badge variant="statusWaiting">{selectedRow.action}</Badge>}
                    modeText="Billing Workflow"
                  />
                  <div className="overflow-y-auto p-0 bg-slate-50 flex-1">
                    <div className="px-6 sm:px-8 py-8 space-y-6">

                      {/* Step 1: Dispensing */}
                      {selectedRow.dispensingStatus !== 'Not Required' && (
                        <DrawerSection title="1. Dispensing">
                          <div className="flex items-center gap-2 mb-4">
                            <FileText className="w-5 h-5 text-indigo-500" />
                            <h3 className="text-sm font-semibold text-slate-900">
                              Prescription
                            </h3>
                          </div>
                          
                          {dispenseError && (
                            <div className="bg-rose-50 border border-rose-200 text-rose-700 px-4 py-3 rounded-lg text-sm font-medium mb-4">
                              {dispenseError}
                            </div>
                          )}

                          <div className="space-y-4 mb-4">
                            {activeItems.map(item => (
                              <DispensingMedicineItem 
                                key={item.id} 
                                item={item} 
                                onChange={selectedRow.dispensingStatus === 'Pending' ? handleQtyChange : undefined} 
                              />
                            ))}
                          </div>

                          {selectedRow.dispensingStatus === 'Pending' ? (
                            <div className="flex items-center justify-between border-t pt-4 mt-2">
                              <span className="text-sm text-slate-500">
                                Dispensing: {totalDispensed} / {totalPrescribed} units
                              </span>
                              <Button size="sm" className="bg-indigo-600 hover:bg-indigo-700" onClick={handleCompleteDispensing}>
                                Complete Dispensing
                              </Button>
                            </div>
                          ) : (
                            <div className="flex items-center justify-between border-t pt-4 mt-2">
                               <Badge variant="statusInactive">Dispensed</Badge>
                               <span className="text-sm text-slate-500">Inventory Deducted</span>
                            </div>
                          )}
                        </DrawerSection>
                      )}

                      {/* Step 2: Payment */}
                      <DrawerSection title={selectedRow.dispensingStatus !== 'Not Required' ? '2. Payment' : 'Payment'}>
                        <div className="bg-white p-5 rounded-xl border border-slate-200 mb-4">
                          <div className="flex items-center justify-between mb-4">
                            <div>
                              <p className="text-sm text-slate-500 font-medium mb-1">Total Due</p>
                              <div className="text-3xl font-bold text-slate-900">₹{selectedRow.amount}</div>
                            </div>
                            <Badge variant={selectedRow.paymentStatus === 'Paid' ? "statusInactive" : "statusWaiting"}>
                              {selectedRow.paymentStatus}
                            </Badge>
                          </div>
                          <div className="pt-4 border-t border-slate-100 flex flex-col gap-2">
                            <div className="flex justify-between items-center text-sm">
                              <span className="text-slate-500">Consultation Fees</span>
                              <span className="font-medium text-slate-700">₹{selectedRow.consultationFee}</span>
                            </div>
                            <div className="flex justify-between items-center text-sm">
                              <span className="text-slate-500">Treatment Fees</span>
                              <span className="font-medium text-slate-700">₹{selectedRow.treatmentFee}</span>
                            </div>
                            <div className="flex justify-between items-center text-sm">
                              <span className="text-slate-500">Medicine Cost</span>
                              <span className="font-medium text-slate-700">₹{selectedRow.medicineCost}</span>
                            </div>
                          </div>
                        </div>

                        {paymentError && (
                          <div className="bg-rose-50 border border-rose-200 text-rose-700 px-4 py-3 rounded-lg text-sm font-medium mb-4">
                            {paymentError}
                          </div>
                        )}

                        {selectedRow.paymentStatus === 'Pending' && isDispensingReady && (
                          <div className="space-y-4">
                            <PaymentMethodSelector value={activeMethod} onChange={setActiveMethod} />
                            <div className="flex justify-end pt-2">
                              <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={handleCollectPayment}>
                                Collect Payment
                              </Button>
                            </div>
                          </div>
                        )}
                        
                        {selectedRow.paymentStatus === 'Pending' && !isDispensingReady && (
                           <div className="text-sm text-slate-500 bg-slate-50 p-4 rounded-lg border text-center">
                             Please complete dispensing before collecting payment.
                           </div>
                        )}

                      </DrawerSection>

                    </div>
                  </div>
                  
                  {/* Fixed Footer */}
                  <div className="bg-white border-t px-6 py-4 flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handlePrintDocument('prescription')}
                        className="text-xs text-slate-700 border-slate-300 hover:bg-slate-50"
                      >
                        <FileText className="w-3.5 h-3.5 mr-1 text-teal-600" />
                        Prescription
                      </Button>
                      {(!isReceptionist || selectedRow.paymentOwner !== 'DOCTOR') && (
                        <>
                          {selectedRow.paymentStatus === 'Paid' && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handlePrintDocument('receipt')}
                              className="text-xs text-emerald-700 border-emerald-300 hover:bg-emerald-50"
                            >
                              <Receipt className="w-3.5 h-3.5 mr-1 text-emerald-600" />
                              Receipt
                            </Button>
                          )}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handlePrintDocument('invoice')}
                            className="text-xs text-blue-700 border-blue-300 hover:bg-blue-50"
                          >
                            <FileText className="w-3.5 h-3.5 mr-1 text-blue-600" />
                            Invoice
                          </Button>
                        </>
                      )}
                    </div>
                    <Button variant="outline" onClick={() => setDrawerOpen(false)}>Close</Button>
                  </div>
                </>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>

    </div>
  )
}

