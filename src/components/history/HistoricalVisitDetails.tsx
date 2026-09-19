import { useEffect, useState } from 'react'
import { useClinicContext } from '../../context/ClinicContext'
import { useAuth } from '../../context/AuthContext'
import { Button } from '../ui/button'
import { FileText, Loader2, Check } from 'lucide-react'
import { Badge } from '../ui/badge'
import { API_BASE_URL, api } from '../../lib/api'
import type { TreatmentPlan } from '../../types/domain'

export function HistoricalVisitDetails({ visitId, onViewHistory }: { visitId: string, onViewHistory?: () => void }) {
  const { currentUser } = useAuth()
  const { visits, consultations, prescriptions, dispensings, payments, medicines, staff } = useClinicContext()

  const visit = visits.find(v => v.id === visitId)
  const isDoctorHandled = visit?.paymentOwner === 'DOCTOR'
  const isReceptionist = currentUser?.role === 'Receptionist'
  const consultation = consultations.find(c => c.visitId === visitId)
  const prescription = prescriptions.find(p => p.visitId === visitId)
  const dispensing = dispensings.find(d => d.visitId === visitId)
  const visitPayments = payments.filter(p => p.visitId === visitId)
  const doctor = staff?.find((d: any) => d.id === visit?.doctorId)

  const [treatmentPlan, setTreatmentPlan] = useState<TreatmentPlan | null>(null)
  const [loadingPlan, setLoadingPlan] = useState(false)

  useEffect(() => {
    if (visit?.patientId) {
      setLoadingPlan(true)
      api.get<TreatmentPlan>(`/api/patients/${visit.patientId}/treatment-plan`)
        .then(res => setTreatmentPlan(res))
        .catch(err => console.error(err))
        .finally(() => setLoadingPlan(false))
    }
  }, [visit?.patientId])

  if (!visit) {
    return <div className="p-4 text-slate-500">Visit not found.</div>
  }

  const handlePrintDocument = async (type: 'prescription' | 'receipt' | 'invoice') => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/documents/${type}/${visitId}`, {
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

  return (
    <div className="space-y-6 pb-8 bg-slate-50 min-h-full">
      <div className="bg-white p-6 border-b border-slate-200 shadow-sm flex items-center justify-between">
        <div>
          <h3 className="text-sm font-medium text-slate-500 uppercase tracking-wider">Visit Summary</h3>
          <p className="text-xl font-semibold text-slate-900 mt-1">{doctor?.name || 'Unassigned Doctor'}</p>
        </div>
        <Badge className="bg-emerald-100 text-emerald-800 border border-emerald-200 px-3 py-1 text-sm">{visit.status}</Badge>
      </div>

      <div className="px-6 space-y-6">
        {consultation && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="bg-slate-50/80 border-b border-slate-100 px-4 py-3 font-medium text-slate-700 flex justify-between items-center">
              <span>Consultation Details</span>
              {!(isDoctorHandled && isReceptionist) ? (
                <span className="text-emerald-600 font-semibold bg-emerald-50 px-2 py-1 rounded-md text-sm border border-emerald-100">Fee: ₹{consultation.consultationFee}</span>
              ) : (
                <span className="text-indigo-600 font-medium bg-indigo-50 px-2 py-1 rounded-md text-xs border border-indigo-100">Handled by Doctor</span>
              )}
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="text-xs font-medium text-slate-500 uppercase tracking-wider block mb-1">Reason for Visit</label>
                <p className="text-slate-900 font-medium">{consultation.reasonForVisit || 'Not provided'}</p>
              </div>
              <div className="pt-3 border-t border-slate-100">
                <label className="text-xs font-medium text-slate-500 uppercase tracking-wider block mb-1">Clinical Notes</label>
                <p className="text-slate-700 text-sm whitespace-pre-wrap">{consultation.clinicalNotes || 'No notes added'}</p>
              </div>
            </div>
          </div>
        )}

        {treatmentPlan && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="bg-slate-50/80 border-b border-slate-100 px-4 py-3 font-medium text-slate-700">Treatments Performed</div>
            <div className="p-4">
              {loadingPlan ? (
                <div className="flex items-center gap-2 text-sm text-slate-500 justify-center py-4"><Loader2 className="w-4 h-4 animate-spin" /> Loading treatments...</div>
              ) : (
                treatmentPlan.items.filter(item => item.completedVisitId === visitId).length > 0 ? (
                  <div className="space-y-3">
                    {treatmentPlan.items.filter(item => item.completedVisitId === visitId).map(item => (
                      <div key={item.id} className="flex items-start justify-between text-sm text-slate-700 bg-emerald-50/30 p-3 rounded-lg border border-emerald-100/50">
                        <div className="flex items-start gap-3">
                          <Check className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
                          <div>
                            <span className="font-semibold text-slate-900">{item.catalogItem?.name} {item.catalogItem?.variant ? `(${item.catalogItem.variant})` : ''}</span>
                            {item.notes && <p className="text-slate-500 mt-1">{item.notes}</p>}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-slate-400 italic text-center py-2">No treatments were performed during this visit.</p>
                )
              )}
            </div>
          </div>
        )}

        {prescription && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="bg-slate-50/80 border-b border-slate-100 px-4 py-3 font-medium text-slate-700 flex justify-between items-center">
              <span>Prescription</span>
              <Button variant="outline" size="sm" onClick={() => handlePrintDocument('prescription')} className="h-7 text-xs bg-white">
                <FileText className="w-3 h-3 mr-1.5 text-indigo-500" /> Print
              </Button>
            </div>
            
            <div className="p-4">
              {prescription.items.length > 0 ? (
                <div className="border border-slate-200 rounded-lg overflow-hidden bg-white">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 border-b border-slate-200">
                      <tr>
                        <th className="px-3 py-2.5 text-left font-medium text-slate-600">Medicine</th>
                        <th className="px-3 py-2.5 text-left font-medium text-slate-600">Dosage</th>
                        <th className="px-3 py-2.5 text-left font-medium text-slate-600">Qty</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {prescription.items.map(item => {
                        const med = medicines.find(m => m.id === item.medicineId)
                        return (
                          <tr key={item.id}>
                            <td className="px-3 py-2.5">
                              <p className="text-slate-900 font-medium">{med?.name || 'Unknown'}</p>
                              {item.instructions && <p className="text-xs text-slate-500 mt-0.5">{item.instructions}</p>}
                            </td>
                            <td className="px-3 py-2.5 text-slate-700 align-top">{item.dosage || '-'} x {item.frequency || '-'} <br/><span className="text-xs text-slate-500">({item.duration || '-'})</span></td>
                            <td className="px-3 py-2.5 text-slate-900 font-medium align-top">{item.quantity}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-sm text-slate-400 italic text-center py-2">No medicines prescribed.</p>
              )}
              {prescription.notes && (
                <div className="mt-4 pt-3 border-t border-slate-100">
                  <label className="text-xs font-medium text-slate-500 uppercase tracking-wider block mb-1">Prescription Notes</label>
                  <p className="text-slate-700 text-sm">{prescription.notes}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {dispensing && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="bg-slate-50/80 border-b border-slate-100 px-4 py-3 font-medium text-slate-700">Dispensing Status</div>
            <div className="p-4">
              {dispensing.items.length > 0 ? (
                <div className="border border-slate-200 rounded-lg overflow-hidden bg-white">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 border-b border-slate-200">
                      <tr>
                        <th className="px-3 py-2.5 text-left font-medium text-slate-600">Medicine</th>
                        <th className="px-3 py-2.5 text-center font-medium text-slate-600">Prescribed</th>
                        <th className="px-3 py-2.5 text-center font-medium text-slate-600">Dispensed</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {dispensing.items.map(item => {
                        const med = medicines.find(m => m.id === item.medicineId)
                        return (
                          <tr key={item.id}>
                            <td className="px-3 py-2.5 text-slate-900 font-medium">{med?.name || 'Unknown'}</td>
                            <td className="px-3 py-2.5 text-center text-slate-700">{item.prescribedQuantity}</td>
                            <td className="px-3 py-2.5 text-center font-medium text-emerald-600 bg-emerald-50/50">{item.dispensedQuantity}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-sm text-slate-400 italic text-center py-2">No items dispensed.</p>
              )}
            </div>
          </div>
        )}

        {isDoctorHandled && isReceptionist ? (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden border-l-4 border-l-indigo-500">
            <div className="bg-slate-50/80 border-b border-slate-100 px-4 py-3 font-medium text-slate-700 flex justify-between items-center">
              <span>Payment Details</span>
              <Badge className="bg-indigo-100 text-indigo-800 border-indigo-200">Handled by Doctor</Badge>
            </div>
            <div className="p-4 text-sm text-slate-600">
              Handled by Doctor
            </div>
          </div>
        ) : visitPayments.length > 0 && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden border-l-4 border-l-teal-500">
            <div className="bg-slate-50/80 border-b border-slate-100 px-4 py-3 font-medium text-slate-700 flex justify-between items-center">
              <span>Payment Details ({visitPayments.length})</span>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => handlePrintDocument('receipt')} className="h-7 text-xs bg-white">
                  <FileText className="w-3 h-3 mr-1.5 text-teal-600" /> Print Receipt
                </Button>
                <Button variant="outline" size="sm" onClick={() => handlePrintDocument('invoice')} className="h-7 text-xs bg-white">
                  <FileText className="w-3 h-3 mr-1.5 text-blue-600" /> Print Invoice
                </Button>
              </div>
            </div>
            <div className="divide-y divide-slate-100">
              {visitPayments.map((p, idx) => (
                <div key={p.id || idx} className="p-4 grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-medium text-slate-500 uppercase tracking-wider block mb-1">
                      {visitPayments.length > 1 ? `Payment #${idx + 1}` : 'Total Amount'}
                    </label>
                    <p className="text-lg font-bold text-slate-900">₹{p.amount}</p>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-500 uppercase tracking-wider block mb-1">Method</label>
                    <Badge variant="secondary" className="mt-1">{p.method}</Badge>
                  </div>
                  <div className="col-span-2 pt-2 border-t border-slate-50 flex items-center justify-between text-xs text-slate-500">
                    <span>Status: <span className="font-medium text-slate-700">{p.status}</span></span>
                    {p.createdAt && <span>{new Date(p.createdAt).toLocaleDateString()} {new Date(p.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      
      {onViewHistory && (
        <div className="px-6 pt-2">
          <Button 
            variant="outline" 
            className="w-full text-indigo-600 border-indigo-200 hover:bg-indigo-50"
            onClick={onViewHistory}
          >
            View Full Patient History
          </Button>
        </div>
      )}
    </div>
  )
}
