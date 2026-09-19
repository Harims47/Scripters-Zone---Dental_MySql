import { useEffect, useState } from 'react'
import { api, API_BASE_URL } from '../../lib/api'
import type { PatientHistoryData } from '../../types/domain'
import { 
  Calendar, 
  Clock, 
  User, 
  FileText, 
  Pill, 
  CreditCard, 
  CheckCircle2, 
  ChevronDown, 
  ChevronUp, 
  Loader2, 
  AlertCircle,
  MapPin,
  Phone,
  Activity,
  Printer
} from 'lucide-react'
import { Badge } from '../ui/badge'
import { Button } from '../ui/button'

interface PatientCompleteHistoryProps {
  patientId: string
  onEditPatient?: () => void
  onClose?: () => void
}
export function PatientCompleteHistory({
  patientId
}: PatientCompleteHistoryProps) {
  const [data, setData] = useState<PatientHistoryData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expandedVisits, setExpandedVisits] = useState<Record<string, boolean>>({})

  const loadHistory = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await api.get<PatientHistoryData>(`/api/patients/${patientId}/history`)
      setData(res)
      // By default, collapse all visits
      setExpandedVisits({})
    } catch (err: any) {
      console.error('Failed to load patient history', err)
      setError(err.response?.data?.error || 'Failed to load patient history')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (patientId) {
      loadHistory()
    }
  }, [patientId])

  const toggleVisit = (id: string) => {
    setExpandedVisits(prev => ({ ...prev, [id]: !prev[id] }))
  }

  const expandAll = () => {
    if (!data?.visits) return
    const allExpanded: Record<string, boolean> = {}
    data.visits.forEach(v => { allExpanded[v.id] = true })
    setExpandedVisits(allExpanded)
  }

  const collapseAll = () => {
    setExpandedVisits({})
  }

  const handlePrintDocument = async (type: 'prescription' | 'receipt', visitId: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/documents/${type}/${visitId}`, {
        method: 'GET',
        credentials: 'include'
      })
      if (!response.ok) throw new Error(`Failed to print ${type}`)
      
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      window.open(url, '_blank')
      setTimeout(() => window.URL.revokeObjectURL(url), 1000)
    } catch (err) {
      console.error(err)
      alert(`Failed to load ${type} document. Please ensure you are authorized.`)
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 space-y-4">
        <Loader2 className="w-8 h-8 animate-spin text-teal-600" />
        <p className="text-sm font-medium text-slate-500">Loading complete clinical history...</p>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="p-8 text-center space-y-4">
        <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-500 flex items-center justify-center mx-auto">
          <AlertCircle className="w-6 h-6" />
        </div>
        <h3 className="text-lg font-semibold text-slate-900">Unable to load patient history</h3>
        <p className="text-sm text-slate-500 max-w-md mx-auto">{error || 'Patient record could not be found.'}</p>
        <Button variant="outline" onClick={loadHistory} className="mt-2">Try Again</Button>
      </div>
    )
  }

  const { patient, visits } = data
  const isExisting = visits.some(v => v.status === 'COMPLETED')

  return (
    <div className="flex flex-col h-full bg-slate-50 overflow-y-auto">
      {/* 1. PATIENT HEADER / PROFILE CARD */}
      <div className="bg-white border-b border-slate-200/80 p-6 sticky top-0 z-20 shadow-sm">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            {/* 1:1 Square Photo with rounded corners (NEVER circular) */}
            <div className="shrink-0">
              {patient.photoUrl ? (
                <img 
                  src={patient.photoUrl} 
                  alt={patient.name} 
                  className="w-16 h-16 rounded-xl object-cover border-2 border-slate-200 shadow-sm aspect-square"
                />
              ) : (
                <div className="w-16 h-16 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center font-bold text-xl border-2 border-slate-200 shadow-sm aspect-square">
                  {patient.name.substring(0, 2).toUpperCase()}
                </div>
              )}
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-2.5 flex-wrap">
                <h2 className="text-xl font-bold text-slate-900 tracking-tight">{patient.name}</h2>
                <Badge className={isExisting ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'}>
                  {isExisting ? 'Existing Patient' : 'New Patient'}
                </Badge>
              </div>

              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600">
                <span className="font-medium">{patient.age} Yrs • {patient.gender}</span>
                <span className="flex items-center gap-1 font-medium">
                  <Phone className="w-3.5 h-3.5 text-slate-400" />
                  {patient.phone}
                </span>
                <span className="flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-slate-400" />
                  {patient.address || 'Address not provided'}
                </span>
              </div>
            </div>
          </div>


        </div>

        {/* Action Bar */}
        <div className="mt-4 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-3">
            <span className="text-slate-500">
              Total Visits: <strong className="text-slate-900 font-semibold">{visits.length}</strong>
            </span>
          </div>

          {visits.length > 0 && (
            <div className="flex items-center gap-2">
              <button 
                onClick={expandAll} 
                className="text-slate-500 hover:text-slate-800 font-medium hover:underline"
              >
                Expand All
              </button>
              <span className="text-slate-300">•</span>
              <button 
                onClick={collapseAll} 
                className="text-slate-500 hover:text-slate-800 font-medium hover:underline"
              >
                Collapse All
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 2. VISIT-BY-VISIT HISTORY */}
      <div className="p-6 space-y-6 max-w-5xl mx-auto w-full">
        {visits.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center shadow-xs">
            <Calendar className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <h3 className="text-base font-semibold text-slate-800">No visit history available</h3>
            <p className="text-sm text-slate-500 mt-1">This patient has not completed or started any visits yet.</p>
          </div>
        ) : (
          visits.map((visit) => {
            const isExpanded = !!expandedVisits[visit.id]
            const visitDate = (visit as any).visitDate ? new Date((visit as any).visitDate) : new Date(visit.createdAt)
            const formattedDate = visitDate.toLocaleDateString(undefined, { 
              year: 'numeric', 
              month: 'short', 
              day: 'numeric' 
            })
            const formattedTime = visitDate.toLocaleTimeString([], { 
              hour: '2-digit', 
              minute: '2-digit' 
            })

            const isAppointment = !!visit.appointmentId
            const doctorName = visit.doctor?.name || '—'
            const reason = visit.reasonForVisit || visit.consultation?.reasonForVisit || visit.appointment?.notes || 'General Consultation'
            const fin = visit.financialSummary

            return (
              <div 
                key={visit.id} 
                className={`bg-white rounded-2xl border transition-all duration-200 shadow-xs overflow-hidden ${
                  visit.status === 'CANCELLED' 
                    ? 'border-slate-200 opacity-90' 
                    : isExpanded 
                      ? 'border-slate-300 shadow-md ring-1 ring-slate-200' 
                      : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                {/* Visit Header Bar (Clickable Accordion) */}
                <div 
                  onClick={() => toggleVisit(visit.id)}
                  className="p-5 cursor-pointer flex items-center justify-between gap-4 select-none hover:bg-slate-50/50 transition-colors border-b border-transparent"
                >
                  <div className="flex items-start sm:items-center gap-4 flex-1 flex-wrap">
                    {/* Date Badge */}
                    <div className="flex flex-col shrink-0 min-w-[120px]">
                      <span className="text-sm font-bold text-slate-900">{formattedDate}</span>
                      <span className="text-xs text-slate-500 flex items-center gap-1">
                        <Clock className="w-3 h-3 text-slate-400" />
                        {formattedTime}
                      </span>
                    </div>

                    {/* Visit Type */}
                    <div className="shrink-0">
                      <Badge variant="outline" className={`text-xs font-medium ${isAppointment ? 'border-indigo-200 bg-indigo-50/60 text-indigo-700' : 'border-slate-200 bg-slate-50 text-slate-700'}`}>
                        {isAppointment ? 'Appointment' : 'Walk-in'}
                      </Badge>
                    </div>

                    {/* Doctor and Reason */}
                    <div className="flex-1 min-w-[180px]">
                      <div className="text-xs font-medium text-slate-500">
                        Doctor: <span className="text-slate-900 font-semibold">{doctorName}</span>
                      </div>
                      <div className="text-sm text-slate-700 font-medium truncate mt-0.5">
                        {reason}
                      </div>
                    </div>

                    {/* Status & Financial Badges */}
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge 
                        className={`text-xs font-medium ${
                          visit.status === 'COMPLETED' 
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                            : visit.status === 'CANCELLED'
                              ? 'bg-rose-50 text-rose-700 border-rose-200'
                              : 'bg-amber-50 text-amber-700 border-amber-200'
                        }`}
                      >
                        {visit.status}
                      </Badge>

                      <Badge 
                        className={`text-xs font-medium ${
                          fin.status === 'Paid' 
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-200' 
                            : fin.status === 'Partial'
                              ? 'bg-amber-50 text-amber-800 border-amber-200'
                              : 'bg-slate-100 text-slate-700 border-slate-200'
                        }`}
                      >
                        {fin.status} (₹{fin.totalPaid.toLocaleString()} / ₹{fin.amountDue.toLocaleString()})
                      </Badge>
                    </div>
                  </div>

                  {/* Accordion Arrow */}
                  <div className="text-slate-400 hover:text-slate-600 pl-2">
                    {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                  </div>
                </div>

                {/* Collapsible Visit Details */}
                {isExpanded && (
                  <div className="p-6 pt-2 border-t border-slate-100 space-y-6 bg-slate-50/40">
                    
                    {/* Cancellation notice if cancelled */}
                    {visit.status === 'CANCELLED' && (
                      <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                        <span>This visit was cancelled. Historical payments, prescriptions, and consultation records remain archived below for audit integrity.</span>
                      </div>
                    )}

                    {/* SECTION 1: DOCTOR / CONSULTATION INFORMATION */}
                    <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
                      <div className="bg-slate-50/80 px-4 py-2.5 border-b border-slate-200 flex items-center justify-between text-xs font-semibold text-slate-700">
                        <span className="flex items-center gap-1.5">
                          <User className="w-3.5 h-3.5 text-slate-500" />
                          Consultation & Clinical Notes
                        </span>
                        {visit.consultation?.consultationFee !== undefined && (
                          <span className="font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100">
                            Consultation Fee: ₹{visit.consultation.consultationFee.toLocaleString()}
                          </span>
                        )}
                      </div>
                      <div className="p-4 space-y-3 text-xs">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                            <span className="text-slate-400 font-medium block uppercase tracking-wider text-[10px]">Attending Doctor</span>
                            <span className="font-semibold text-slate-900 text-sm">{doctorName}</span>
                          </div>
                          <div>
                            <span className="text-slate-400 font-medium block uppercase tracking-wider text-[10px]">Reason for Visit</span>
                            <span className="font-medium text-slate-800">{reason}</span>
                          </div>
                        </div>

                        <div className="pt-2 border-t border-slate-100">
                          <span className="text-slate-400 font-medium block uppercase tracking-wider text-[10px] mb-1">Clinical Notes & Findings</span>
                          {visit.consultation?.clinicalNotes ? (
                            <p className="text-slate-700 whitespace-pre-wrap leading-relaxed bg-slate-50/60 p-3 rounded-lg border border-slate-100">
                              {visit.consultation.clinicalNotes}
                            </p>
                          ) : (
                            <p className="text-slate-400 italic">No clinical consultation notes recorded.</p>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* SECTION 2: TREATMENT INFORMATION */}
                    <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
                      <div className="bg-slate-50/80 px-4 py-2.5 border-b border-slate-200 flex items-center justify-between text-xs font-semibold text-slate-700">
                        <span className="flex items-center gap-1.5">
                          <Activity className="w-3.5 h-3.5 text-slate-500" />
                          Treatments Performed (This Visit)
                        </span>
                        {visit.treatmentFee !== undefined && visit.treatmentFee > 0 && (
                          <span className="font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100">
                            Treatment Fee: ₹{visit.treatmentFee.toLocaleString()}
                          </span>
                        )}
                      </div>
                      <div className="p-4 text-xs">
                        {visit.completedTreatmentItems && visit.completedTreatmentItems.length > 0 ? (
                          <div className="space-y-2">
                            {visit.completedTreatmentItems.map(item => (
                              <div key={item.id} className="flex items-start justify-between p-3 rounded-lg bg-emerald-50/40 border border-emerald-100">
                                <div className="flex items-start gap-2.5">
                                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                                  <div>
                                    <div className="font-semibold text-slate-900">
                                      {item.catalogItem?.name || 'Procedure'} {item.catalogItem?.variant ? `(${item.catalogItem.variant})` : ''}
                                    </div>
                                    {item.notes && <div className="text-slate-600 mt-1">{item.notes}</div>}
                                    {item.completedAt && (
                                      <div className="text-[11px] text-slate-400 mt-0.5">
                                        Completed: {new Date(item.completedAt).toLocaleDateString()} {new Date(item.completedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                      </div>
                                    )}
                                  </div>
                                </div>
                                <Badge className="bg-emerald-100 text-emerald-800 border border-emerald-200 text-[10px]">
                                  Completed
                                </Badge>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-slate-400 italic text-center py-2">No treatment recorded for this visit.</p>
                        )}
                      </div>
                    </div>

                    {/* SECTION 3: PRESCRIPTION INFORMATION */}
                    <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
                      <div className="bg-slate-50/80 px-4 py-2.5 border-b border-slate-200 flex items-center justify-between text-xs font-semibold text-slate-700">
                        <span className="flex items-center gap-1.5">
                          <FileText className="w-3.5 h-3.5 text-slate-500" />
                          Prescriptions
                        </span>
                        {visit.prescription && (
                          <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={() => handlePrintDocument('prescription', visit.id)}
                            className="h-6 text-[11px] px-2 bg-white text-indigo-600 border-indigo-200 hover:bg-indigo-50"
                          >
                            <Printer className="w-3 h-3 mr-1" /> Print Prescription
                          </Button>
                        )}
                      </div>
                      <div className="p-4 text-xs">
                        {visit.prescription && visit.prescription.items.length > 0 ? (
                          <div className="space-y-3">
                            <div className="border border-slate-200 rounded-lg overflow-hidden bg-white">
                              <table className="w-full text-left">
                                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-medium">
                                  <tr>
                                    <th className="px-3 py-2">Medicine</th>
                                    <th className="px-3 py-2">Dosage & Frequency</th>
                                    <th className="px-3 py-2">Duration</th>
                                    <th className="px-3 py-2 text-right">Quantity</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                  {visit.prescription.items.map(item => (
                                    <tr key={item.id} className="hover:bg-slate-50/50">
                                      <td className="px-3 py-2">
                                        <div className="font-semibold text-slate-900">{item.medicine?.name || 'Medicine'}</div>
                                        {item.instructions && (
                                          <div className="text-[11px] text-slate-500 mt-0.5">{item.instructions}</div>
                                        )}
                                      </td>
                                      <td className="px-3 py-2 text-slate-700">
                                        {item.dosage || '—'} • {item.frequency || '—'}
                                      </td>
                                      <td className="px-3 py-2 text-slate-700">
                                        {item.duration || '—'}
                                      </td>
                                      <td className="px-3 py-2 text-right font-semibold text-slate-900">
                                        {item.quantity}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                            {visit.prescription.notes && (
                              <div className="text-[11px] text-slate-600 bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                                <strong className="text-slate-700">Notes:</strong> {visit.prescription.notes}
                              </div>
                            )}
                          </div>
                        ) : (
                          <p className="text-slate-400 italic text-center py-2">No prescription recorded.</p>
                        )}
                      </div>
                    </div>

                    {/* SECTION 4: MEDICINE DISPENSING INFORMATION */}
                    <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
                      <div className="bg-slate-50/80 px-4 py-2.5 border-b border-slate-200 flex items-center justify-between text-xs font-semibold text-slate-700">
                        <span className="flex items-center gap-1.5">
                          <Pill className="w-3.5 h-3.5 text-slate-500" />
                          Medicine Dispensing Status
                        </span>
                        {visit.dispensing && (
                          <Badge variant="outline" className="text-[10px]">
                            {visit.dispensing.status}
                          </Badge>
                        )}
                      </div>
                      <div className="p-4 text-xs">
                        {visit.dispensing && visit.dispensing.items.length > 0 ? (
                          <div className="border border-slate-200 rounded-lg overflow-hidden bg-white">
                            <table className="w-full text-left">
                              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-medium">
                                <tr>
                                  <th className="px-3 py-2">Medicine</th>
                                  <th className="px-3 py-2 text-center">Prescribed Quantity</th>
                                  <th className="px-3 py-2 text-center">Actually Dispensed</th>
                                  <th className="px-3 py-2 text-right">Status</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100">
                                {visit.dispensing.items.map(item => {
                                  const fullyDispensed = item.dispensedQuantity >= item.prescribedQuantity
                                  return (
                                    <tr key={item.id} className="hover:bg-slate-50/50">
                                      <td className="px-3 py-2 font-medium text-slate-900">
                                        {item.medicine?.name || 'Medicine'}
                                      </td>
                                      <td className="px-3 py-2 text-center text-slate-700 font-medium">
                                        {item.prescribedQuantity}
                                      </td>
                                      <td className="px-3 py-2 text-center font-bold text-teal-700 bg-teal-50/40">
                                        {item.dispensedQuantity}
                                      </td>
                                      <td className="px-3 py-2 text-right">
                                        <Badge 
                                          variant="outline" 
                                          className={`text-[10px] ${
                                            fullyDispensed 
                                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                                              : item.dispensedQuantity > 0 
                                                ? 'bg-amber-50 text-amber-700 border-amber-200' 
                                                : 'bg-slate-50 text-slate-600 border-slate-200'
                                          }`}
                                        >
                                          {fullyDispensed ? 'Fully Dispensed' : item.dispensedQuantity > 0 ? 'Partially Dispensed' : 'Not Dispensed'}
                                        </Badge>
                                      </td>
                                    </tr>
                                  )
                                })}
                              </tbody>
                            </table>
                          </div>
                        ) : (
                          <p className="text-slate-400 italic text-center py-2">No medicine dispensing records.</p>
                        )}
                      </div>
                    </div>

                    {/* SECTION 5: PAYMENT INFORMATION & FINANCIAL SUMMARY */}
                    <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden border-l-4 border-l-teal-600">
                      <div className="bg-slate-50/80 px-4 py-2.5 border-b border-slate-200 flex items-center justify-between text-xs font-semibold text-slate-700">
                        <span className="flex items-center gap-1.5">
                          <CreditCard className="w-3.5 h-3.5 text-teal-700" />
                          Payment & Billing Ledger ({visit.payments.length} Transaction{visit.payments.length !== 1 ? 's' : ''})
                        </span>
                        {visit.payments.length > 0 && (
                          <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={() => handlePrintDocument('receipt', visit.id)}
                            className="h-6 text-[11px] px-2 bg-white text-teal-700 border-teal-200 hover:bg-teal-50"
                          >
                            <Printer className="w-3 h-3 mr-1" /> Print Receipt
                          </Button>
                        )}
                      </div>

                      <div className="p-4 space-y-4 text-xs">
                        {/* Financial Summary Card */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
                          <div>
                            <span className="text-slate-400 text-[10px] block uppercase font-medium">Consultation Fee</span>
                            <span className="font-semibold text-slate-800 text-sm">₹{fin.consultationFee.toLocaleString()}</span>
                          </div>
                          <div>
                            <span className="text-slate-400 text-[10px] block uppercase font-medium">Treatment Fee</span>
                            <span className="font-semibold text-slate-800 text-sm">₹{fin.treatmentFee.toLocaleString()}</span>
                          </div>
                          <div>
                            <span className="text-slate-400 text-[10px] block uppercase font-medium">Medicine Cost</span>
                            <span className="font-semibold text-slate-800 text-sm">₹{fin.medicineCost.toLocaleString()}</span>
                          </div>
                          <div>
                            <span className="text-slate-400 text-[10px] block uppercase font-medium">Amount Due</span>
                            <span className="font-bold text-slate-900 text-sm">₹{fin.amountDue.toLocaleString()}</span>
                          </div>
                          
                          <div className="col-span-2 pt-2 border-t border-slate-200/80 flex items-center justify-between">
                            <span className="text-slate-600 font-medium">Total Paid:</span>
                            <span className="font-bold text-emerald-700 text-sm">₹{fin.totalPaid.toLocaleString()}</span>
                          </div>
                          <div className="col-span-2 pt-2 border-t border-slate-200/80 flex items-center justify-between">
                            <span className="text-slate-600 font-medium">Outstanding Balance:</span>
                            <span className={`font-bold text-sm ${fin.balance > 0 ? 'text-rose-600' : 'text-slate-700'}`}>
                              ₹{fin.balance.toLocaleString()}
                            </span>
                          </div>
                        </div>

                        {/* Individual Payment Transactions */}
                        <div>
                          <span className="text-slate-500 font-semibold uppercase tracking-wider text-[10px] block mb-2">
                            Individual Payment Records
                          </span>
                          {visit.payments.length > 0 ? (
                            <div className="border border-slate-200 rounded-lg overflow-hidden bg-white">
                              <table className="w-full text-left">
                                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-medium">
                                  <tr>
                                    <th className="px-3 py-2">#</th>
                                    <th className="px-3 py-2">Date & Time</th>
                                    <th className="px-3 py-2">Method</th>
                                    <th className="px-3 py-2">Status</th>
                                    <th className="px-3 py-2">Notes</th>
                                    <th className="px-3 py-2 text-right">Amount</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                  {visit.payments.map((p, pIdx) => {
                                    const pDate = p.createdAt ? new Date(p.createdAt) : null
                                    return (
                                      <tr key={p.id || pIdx} className="hover:bg-slate-50/50">
                                        <td className="px-3 py-2 text-slate-400 font-mono">{pIdx + 1}</td>
                                        <td className="px-3 py-2 text-slate-700">
                                          {pDate ? `${pDate.toLocaleDateString()} ${pDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : p.date}
                                        </td>
                                        <td className="px-3 py-2">
                                          <Badge variant="secondary" className="text-[10px] font-medium">
                                            {p.method}
                                          </Badge>
                                        </td>
                                        <td className="px-3 py-2">
                                          <span className="inline-flex items-center text-emerald-700 font-medium">
                                            {p.status}
                                          </span>
                                        </td>
                                        <td className="px-3 py-2 text-slate-500 max-w-[200px] truncate">
                                          {p.notes || '—'}
                                        </td>
                                        <td className="px-3 py-2 text-right font-bold text-slate-900">
                                          ₹{p.amount.toLocaleString()}
                                        </td>
                                      </tr>
                                    )
                                  })}
                                </tbody>
                              </table>
                            </div>
                          ) : (
                            <p className="text-slate-400 italic text-center py-2 bg-slate-50 rounded-lg border border-slate-200">
                              No payment recorded for this visit.
                            </p>
                          )}
                        </div>
                      </div>
                    </div>

                  </div>
                )}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
