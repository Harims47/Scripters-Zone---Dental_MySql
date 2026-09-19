import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { CheckCircle2, Search, FileText, Eye } from 'lucide-react'
import { DataTable } from '../components/data-table/data-table'
import type { ColumnDef } from '@tanstack/react-table'
import { Badge } from '../components/ui/badge'
import { Button } from '../components/ui/button'
import { DataTableToolbar } from '../components/data-table/data-table-toolbar'
import { DataTableEmpty } from '../components/data-table/data-table'
import { Sheet, SheetContent, SheetScrollArea } from '../components/ui/sheet'
import { PatientProfileHeader, DrawerFooterActions } from '../components/ui/drawer-patterns'
import { DispensingMedicineItem } from '../components/dispensing/dispensing-components'
import type { DispensingItem } from '../components/dispensing/dispensing-components'
import { useClinicContext } from '../context/ClinicContext'
import { api } from '../lib/api'

export function ReceptionDispensingPage() {
  const navigate = useNavigate()
  
  const { visits, patients, staff, prescriptions, dispensings, medicines, completeDispensing } = useClinicContext()

  // Build rows directly from ClinicContext based strictly on workflow state
  const dispensingData = useMemo(() => {
    // Only fetch visits that are READY_FOR_RECEPTION or READY_FOR_PAYMENT
    const eligibleVisits = visits.filter(v => 
      v.status === 'READY_FOR_RECEPTION' || v.status === 'READY_FOR_PAYMENT'
    )
    
    return eligibleVisits.map(v => {
      const p = patients.find(pt => pt.id === v.patientId)
      const doc = (staff || []).find((st: any) => st.id === v.doctorId)
      const rx = prescriptions.find(r => r.visitId === v.id && r.status === 'Finalized')
      const disp = dispensings.find(d => d.visitId === v.id)

      if (!rx) return null // Must have a Finalized prescription

      const items: DispensingItem[] = rx.items.map((ri, idx) => {
        const med = medicines.find(m => m.id === ri.medicineId)
        const dItem = disp?.items.find(di => di.medicineId === ri.medicineId)
        
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
      })

      return {
        id: v.id, // Using visitId as the unique row ID for isolation
        prescriptionId: rx.id,
        visitId: v.id,
        patientId: p?.id || 'Unknown',
        patientName: p?.name || 'Unknown',
        patientPhone: p?.phone || '-',
        doctorId: doc?.id || '-',
        doctorName: doc?.name || '-',
        time: 'Just now', 
        itemCount: items.length,
        status: disp ? 'Dispensed' : v.status === 'READY_FOR_RECEPTION' ? 'Ready for Dispensing' : v.status,
        items
      }
    }).filter(Boolean) as any[]
  }, [visits, patients, prescriptions, dispensings, medicines])

  const [search, setSearch] = useState('')
  const [selectedRow, setSelectedRow] = useState<any | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [dispenseState, setDispenseState] = useState<'reviewing' | 'completed'>('reviewing')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  // Editable local state for items inside the drawer
  const [activeItems, setActiveItems] = useState<DispensingItem[]>([])

  const handleOpenDrawer = (row: any) => {
    setSelectedRow(row)
    setActiveItems(row.items.map((item: any) => ({ ...item })))
    setDispenseState(row.status === 'Dispensed' ? 'completed' : 'reviewing')
    setErrorMsg(null)
    setDrawerOpen(true)
  }

  const handleQtyChange = (id: string, qty: number) => {
    setActiveItems(prev => prev.map(item => item.id === id ? { ...item, dispensedQty: qty } : item))
  }

  const handleComplete = async () => {
    if (selectedRow) {
      setErrorMsg(null)
      const mappedItems = activeItems.map(item => ({
        medicineId: item.medicineId,
        prescribedQuantity: item.prescribedQty,
        dispensedQuantity: item.dispensedQty
      }))

      const result = await completeDispensing(selectedRow.visitId, selectedRow.prescriptionId, mappedItems)
      
      if (result.success) {
        setDispenseState('completed')
      } else {
        setErrorMsg(result.error || 'Failed to dispense')
      }
    }
  }

  const handleProceedToPayment = () => {
    // Not implemented in Phase 0P.5, but navigate away to queue or placeholder payment
    setDrawerOpen(false)
    navigate('/queue')
  }

  const filteredData = useMemo(() => {
    return dispensingData.filter(d => 
      // Do not show in active dispensing list if it is already complete (unless searching)
      // Actually, rule 1: "Once dispensing is completed: Visit should leave the active dispensing queue."
      (search ? true : d.status !== 'Dispensed') &&
      (d.patientName.toLowerCase().includes(search.toLowerCase()) || 
       d.patientId.toLowerCase().includes(search.toLowerCase()))
    )
  }, [dispensingData, search])

  const columns: ColumnDef<any>[] = [
    {
      header: "Patient",
      accessorKey: "patientName",
      cell: ({ row }) => (
        <div>
          <div className="font-semibold text-slate-900">{row.original.patientName}</div>
          <div className="text-sm font-mono text-slate-500">{row.original.patientId}</div>
        </div>
      )
    },
    {
      header: "Items",
      accessorKey: "itemCount",
      cell: ({ row }) => <span className="font-medium text-slate-700">{row.original.itemCount} Medicines</span>
    },
    {
      header: "Status",
      accessorKey: "status",
      cell: ({ row }) => {
        const s = row.original.status
        if (s === 'Ready for Dispensing') return <Badge variant="statusWaiting">{s}</Badge>
        if (s === 'Dispensed') return <Badge variant="statusInactive">{s}</Badge>
        return <Badge variant="secondary">{s}</Badge>
      }
    },
    {
      id: "actions",
      header: "Actions",
      cell: ({ row }) => (
        <div className="flex justify-end gap-2">
          {row.original.status === 'Dispensed' ? (
            <Button 
              size="icon"
              onClick={() => handleOpenDrawer(row.original)}
              className="h-8 w-8 shadow-sm bg-slate-800 hover:bg-slate-900 text-white rounded-lg"
              aria-label="View dispensing"
            >
              <Eye className="h-4 w-4" />
            </Button>
          ) : (
            <Button 
              size="sm"
              onClick={() => handleOpenDrawer(row.original)}
              className="h-8 px-3 text-xs font-medium shadow-sm bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg"
            >
              Dispense
            </Button>
          )}
        </div>
      )
    }
  ]

  const totalPrescribed = activeItems.reduce((acc, item) => acc + item.prescribedQty, 0)
  const totalDispensed = activeItems.reduce((acc, item) => acc + item.dispensedQty, 0)

  return (
    <div className="h-full flex flex-col gap-6 max-w-[1400px] mx-auto pb-8">
      
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Dispensing</h1>
        <p className="text-slate-500 mt-1">Give prescribed medicines to patients.</p>
      </div>

      <DataTableToolbar
        searchQuery={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search patient, ID or visit..."
        exportOptions={{ 
          pdf: true, 
          excel: true, 
          csv: true,
          onExport: (format) => {
            const query = new URLSearchParams({
              format,
              ...(search ? { search } : {})
            }).toString();
            api.download(`/api/dispensings/export?${query}`, `dispensings_export.${format}`);
          }
        }}
      />

      {/* Data Table */}
      <div className="bg-white rounded-2xl border border-slate-100/60 shadow-[0_2px_12px_-4px_rgba(15,23,42,0.04)] overflow-hidden flex-1">
        <DataTable 
          columns={columns} 
          data={filteredData}
          totalRecords={filteredData.length}
          onRowClick={handleOpenDrawer}
          emptyState={
            search !== '' ? (
              <DataTableEmpty 
                icon={Search} 
                title="No dispensing tasks found" 
                description={`There are no records matching "${search}".`}
              />
            ) : (
              <DataTableEmpty 
                title="No pending dispensing" 
                description="All prescribed medicines have been dispensed." 
              />
            )
          }
        />
      </div>

      {/* Dispensing Drawer */}
      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetContent side="right" size="lg" className="sm:max-w-md bg-white border-l shadow-2xl p-0 flex flex-col gap-0 transition-transform duration-300">
          {selectedRow && (
            <>
              {dispenseState === 'completed' ? (
                // COMPLETION STATE
                <div className="flex-1 flex flex-col p-10 justify-center text-center space-y-6">
                  <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
                    <CheckCircle2 className="w-10 h-10" />
                  </div>
                  <div>
                    <h2 className="text-3xl font-bold text-slate-900 tracking-tight">Dispensing Completed</h2>
                    <p className="text-lg text-slate-500 mt-2">Ready for Payment</p>
                  </div>
                  <div className="bg-slate-50 p-6 rounded-xl inline-block mx-auto text-left min-w-[300px] space-y-3">
                    <div className="flex justify-between items-center pb-3 border-b">
                      <span className="text-slate-500">Patient</span>
                      <span className="font-semibold text-slate-900">{selectedRow.patientName}</span>
                    </div>
                    <div className="flex justify-between items-center pb-3 border-b">
                      <span className="text-slate-500">Prescription</span>
                      <span className="font-mono font-semibold text-slate-700">{selectedRow.prescriptionId}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500">Status</span>
                      <Badge variant="statusInactive">Dispensed</Badge>
                    </div>
                  </div>
                  <div className="pt-8 flex flex-col gap-3 max-w-sm mx-auto w-full">
                    <Button 
                      className="w-full bg-indigo-600 hover:bg-indigo-700" 
                      onClick={handleProceedToPayment}
                    >
                      Return to Queue (Payment Next)
                    </Button>
                    <Button variant="ghost" onClick={() => setDrawerOpen(false)}>
                      Close
                    </Button>
                  </div>
                </div>
              ) : (
                // DISPENSING WORKSPACE
                <>
                  <PatientProfileHeader 
                    name={selectedRow.patientName}
                    patientId={selectedRow.patientId}
                    phone={selectedRow.patientPhone}
                    statusElement={<Badge variant="statusWaiting">Reviewing</Badge>}
                    modeText="Prescription Handover"
                  />
                  <SheetScrollArea className="p-0 bg-slate-50 flex-1">
                    <div className="px-6 sm:px-8 py-8 space-y-8">
                      
                      <div className="flex items-center gap-2 mb-6">
                        <FileText className="w-5 h-5 text-indigo-500" />
                        <h3 className="text-lg font-semibold text-slate-900">
                          {selectedRow.prescriptionId} <span className="text-slate-400 font-normal text-sm ml-2">prescribed by {selectedRow.doctorName}</span>
                        </h3>
                      </div>

                      {errorMsg && (
                        <div className="bg-rose-50 border border-rose-200 text-rose-700 px-4 py-3 rounded-lg text-sm font-medium">
                          {errorMsg}
                        </div>
                      )}

                      <div className="space-y-4">
                        {activeItems.map(item => (
                          <DispensingMedicineItem 
                            key={item.id} 
                            item={item} 
                            onChange={handleQtyChange} 
                          />
                        ))}
                      </div>

                    </div>
                  </SheetScrollArea>
                  
                  {/* Fixed Footer */}
                  <div className="bg-white border-t px-6 py-4 flex flex-col gap-4">
                    <div className="flex items-center justify-between text-sm font-medium">
                      <span className="text-slate-500">Total Medicines: <span className="text-slate-900 ml-1">{activeItems.length}</span></span>
                      <span className="text-slate-500">
                        Dispensing: <span className={`ml-1 ${totalDispensed < totalPrescribed ? 'text-amber-600' : 'text-slate-900'}`}>{totalDispensed} / {totalPrescribed} units</span>
                      </span>
                    </div>
                    <DrawerFooterActions>
                      <Button variant="outline" onClick={() => setDrawerOpen(false)} className="w-full sm:w-auto">Cancel</Button>
                      <Button className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-700" onClick={handleComplete}>
                        Complete Dispensing
                      </Button>
                    </DrawerFooterActions>
                  </div>
                </>
              )}
            </>
          )}
        </SheetContent>
      </Sheet>

    </div>
  )
}
