import { useState, useEffect } from 'react'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Plus, Check, Loader2, Trash2, ChevronDown, ChevronUp, History } from 'lucide-react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select'
import { api } from '../../lib/api'
import type { TreatmentPlan, TreatmentCatalog, TreatmentPlanItem } from '../../types/domain'

export function TreatmentPlanUI({
  patientId,
  currentVisitId,
  treatmentFee,
  onSaveTreatmentFee
}: {
  patientId: string
  currentVisitId?: string
  treatmentFee?: number
  onSaveTreatmentFee?: (fee: number) => void
}) {
  const [plan, setPlan] = useState<TreatmentPlan | null>(null)
  const [catalog, setCatalog] = useState<TreatmentCatalog[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [localTreatmentFee, setLocalTreatmentFee] = useState<number>(treatmentFee || 0)
  
  const [selectedCategory, setSelectedCategory] = useState<string>('')
  const [selectedProcedure, setSelectedProcedure] = useState<string>('')
  const [notes, setNotes] = useState('')
  const [isAdding, setIsAdding] = useState(false)

  useEffect(() => {
    if (treatmentFee !== undefined) {
      setLocalTreatmentFee(treatmentFee)
    }
  }, [treatmentFee])

  useEffect(() => {
    async function load() {
      try {
        const catRes = await api.get<any>('/api/treatments/catalog')
        const catList = Array.isArray(catRes) ? catRes : (catRes?.data || [])
        setCatalog(catList)
        
        const planRes = await api.get<any>(`/api/patients/${patientId}/treatment-plan`)
        const planData = planRes?.data || planRes
        setPlan(planData)
      } catch (err) {
        console.error("Failed to load treatment plan", err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [patientId])

  const categories = Array.from(new Set(catalog.map(c => c.category))).filter(Boolean)
  const procedures = catalog.filter(c => c.category === selectedCategory)

  const handleAdd = async () => {
    if (!selectedProcedure) return
    setSaving(true)
    try {
      const res = await api.post<TreatmentPlanItem>(`/api/patients/${patientId}/treatment-plan/items`, {
        treatmentCatalogId: selectedProcedure,
        notes: notes || undefined,
        completedVisitId: currentVisitId
      })
      setPlan(prev => prev ? { ...prev, items: [res, ...prev.items] } : null)
      setIsAdding(false)
      setSelectedCategory('')
      setSelectedProcedure('')
      setNotes('')
    } catch (err) {
      console.error(err)
    } finally {
      setSaving(false)
    }
  }

  const handleMarkCompleted = async (itemId: string) => {
    setSaving(true)
    try {
      const res = await api.patch<TreatmentPlanItem>(`/api/patients/${patientId}/treatment-plan/items/${itemId}`, {
        status: 'Completed',
        completedVisitId: currentVisitId
      })
      setPlan(prev => prev ? {
        ...prev,
        items: prev.items.map(i => i.id === itemId ? res : i)
      } : null)
    } catch (err) {
      console.error(err)
      alert("Failed to update status. Verify ownership and authorization.")
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (itemId: string) => {
    setSaving(true)
    try {
      await api.delete(`/api/patients/${patientId}/treatment-plan/items/${itemId}`)
      setPlan(prev => prev ? {
        ...prev,
        items: prev.items.filter(i => i.id !== itemId)
      } : null)
    } catch (err) {
      console.error(err)
      alert("Failed to delete treatment procedure.")
    } finally {
      setSaving(false)
    }
  }

  const [showPastHistory, setShowPastHistory] = useState(false)

  // Categorize items by visit context
  const currentVisitItems = currentVisitId 
    ? (plan?.items.filter(item => item.completedVisitId === currentVisitId) || [])
    : (plan?.items || [])
  const plannedItems = currentVisitId 
    ? (plan?.items.filter(item => item.status === 'Planned') || [])
    : []
  const pastCompletedItems = currentVisitId 
    ? (plan?.items.filter(item => item.status === 'Completed' && item.completedVisitId !== currentVisitId) || [])
    : []

  if (loading) {
    return <div className="py-4 text-center text-sm text-slate-500"><Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" /> Loading Treatment Plan...</div>
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-100/60 shadow-[0_2px_12px_-4px_rgba(15,23,42,0.04)] p-6 sm:p-8 space-y-6">
      <div className="flex items-center justify-between pb-4 border-b border-slate-100">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Treatment Plan</h2>
          <p className="text-sm text-slate-500">
            {currentVisitId ? "Record procedures and treatment fees for this visit." : "Long-term clinical roadmap for this patient."}
          </p>
        </div>
        {!isAdding && (
          <Button variant="outline" size="sm" onClick={() => setIsAdding(true)}>
            <Plus className="w-4 h-4 mr-1" /> Add
          </Button>
        )}
      </div>

      {isAdding && (
        <div className="bg-slate-50 p-4 rounded-xl space-y-4 border border-slate-200">
          <h4 className="text-sm font-semibold text-slate-900">Add Treatment</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-xs font-medium text-slate-700">Category</label>
              <Select value={selectedCategory} onValueChange={(val) => { setSelectedCategory(val); setSelectedProcedure(''); }}>
                <SelectTrigger className="bg-white"><SelectValue placeholder="Select Category" /></SelectTrigger>
                <SelectContent>
                  {categories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-medium text-slate-700">Procedure</label>
              <Select value={selectedProcedure} onValueChange={setSelectedProcedure} disabled={!selectedCategory}>
                <SelectTrigger className="bg-white"><SelectValue placeholder="Select Procedure" /></SelectTrigger>
                <SelectContent>
                  {procedures.map(p => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name} {p.variant ? `(${p.variant})` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
             <label className="text-xs font-medium text-slate-700">Tooth / Notes (Optional)</label>
             <Input placeholder="e.g. Tooth 36" value={notes} onChange={e => setNotes(e.target.value)} className="bg-white" />
          </div>
          <div className="flex justify-end gap-2 pt-2">
             <Button variant="ghost" size="sm" onClick={() => setIsAdding(false)}>Cancel</Button>
             <Button size="sm" disabled={!selectedProcedure || saving} onClick={handleAdd}>
               {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
               Save Treatment
             </Button>
          </div>
        </div>
      )}

      {/* Active Visit Procedures */}
      {currentVisitId ? (
        <div className="space-y-4">
          {currentVisitItems.length === 0 && !isAdding && (
            <div className="text-center py-6 text-sm text-slate-500 bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
              No procedures added for this visit yet. Click "+ Add" above to record a procedure.
            </div>
          )}

          {currentVisitItems.length > 0 && (
            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">Procedures in This Visit ({currentVisitItems.length})</h4>
              {currentVisitItems.map(item => (
                <div key={item.id} className="flex items-start justify-between p-4 rounded-xl border bg-emerald-50/50 border-emerald-100">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">Completed</span>
                      <span className="text-sm font-medium text-slate-900">{item.catalogItem?.name} {item.catalogItem?.variant ? `(${item.catalogItem.variant})` : ''}</span>
                    </div>
                    <div className="text-xs text-slate-500 ml-1">
                      {item.catalogItem?.category}
                      {item.notes && <span className="ml-2 text-slate-600 font-medium">| {item.notes}</span>}
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400 hover:text-rose-600 hover:bg-rose-50" onClick={() => handleDelete(item.id)} title="Remove procedure">
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          {/* Planned Roadmap Items (Pending) */}
          {plannedItems.length > 0 && (
            <div className="space-y-3 pt-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">Planned for Patient ({plannedItems.length})</h4>
              {plannedItems.map(item => (
                <div key={item.id} className="flex items-start justify-between p-4 rounded-xl border bg-white border-slate-200 shadow-xs">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">Planned</span>
                      <span className="text-sm font-medium text-slate-900">{item.catalogItem?.name} {item.catalogItem?.variant ? `(${item.catalogItem.variant})` : ''}</span>
                    </div>
                    <div className="text-xs text-slate-500 ml-1">
                      {item.catalogItem?.category}
                      {item.notes && <span className="ml-2 text-slate-600 font-medium">| {item.notes}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Button size="sm" variant="outline" className="h-8 text-xs border-emerald-300 text-emerald-700 hover:bg-emerald-50" disabled={saving} onClick={() => handleMarkCompleted(item.id)}>
                      <Check className="w-3.5 h-3.5 mr-1" /> Complete Today
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400 hover:text-rose-600 hover:bg-rose-50" onClick={() => handleDelete(item.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Past Completed History (Collapsed) */}
          {pastCompletedItems.length > 0 && (
            <div className="pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowPastHistory(!showPastHistory)}
                className="flex items-center justify-between w-full text-xs text-slate-500 hover:text-slate-800 py-1.5 font-medium transition-colors"
              >
                <span className="flex items-center gap-1.5">
                  <History className="w-3.5 h-3.5 text-slate-400" />
                  Past Visits History ({pastCompletedItems.length} previous {pastCompletedItems.length === 1 ? 'procedure' : 'procedures'})
                </span>
                {showPastHistory ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>
              {showPastHistory && (
                <div className="mt-2 space-y-2 pl-2 border-l-2 border-slate-200">
                  {pastCompletedItems.map(item => (
                    <div key={item.id} className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 text-xs flex justify-between items-center text-slate-600">
                      <div>
                        <div className="font-semibold text-slate-800">{item.catalogItem?.name} {item.catalogItem?.variant ? `(${item.catalogItem.variant})` : ''}</div>
                        <div className="text-[11px] text-slate-400">{item.catalogItem?.category} {item.notes ? `• ${item.notes}` : ''}</div>
                      </div>
                      <span className="text-[10px] bg-slate-200 text-slate-600 px-2 py-0.5 rounded font-medium">Past Visit</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        /* Full Longitudinal View (e.g. from Patients profile) */
        <div className="space-y-3">
          {plan?.items.length === 0 && !isAdding && (
            <div className="text-center py-6 text-sm text-slate-500 bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
              No active treatment plan items for this patient.
            </div>
          )}
          {plan && plan.items.length > 0 && (
            plan.items.map(item => (
              <div key={item.id} className={`flex items-start justify-between p-4 rounded-xl border ${item.status === 'Completed' ? 'bg-emerald-50/50 border-emerald-100' : 'bg-white border-slate-200 shadow-sm'}`}>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${item.status === 'Completed' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                      {item.status}
                    </span>
                    <span className="text-sm font-medium text-slate-900">{item.catalogItem?.name} {item.catalogItem?.variant ? `(${item.catalogItem.variant})` : ''}</span>
                  </div>
                  <div className="text-xs text-slate-500 ml-1">
                     {item.catalogItem?.category}
                     {item.notes && <span className="ml-2 text-slate-600 font-medium">| {item.notes}</span>}
                  </div>
                </div>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400 hover:text-rose-600 hover:bg-rose-50" onClick={() => handleDelete(item.id)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))
          )}
        </div>
      )}

      {/* Treatment Fee Section */}
      <div className="p-4 bg-slate-50 rounded-xl border border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-4 mt-4">
        <div className="space-y-0.5">
          <label className="text-sm font-semibold text-slate-800">Treatment Fee (₹)</label>
          <p className="text-xs text-slate-500">Applicable procedure or treatment charge for this visit</p>
        </div>
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-44">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-medium text-sm">₹</span>
            <Input
              type="number"
              min="0"
              step="50"
              className="pl-7 bg-white font-semibold text-slate-900"
              value={localTreatmentFee}
              onChange={(e) => {
                const val = Number(e.target.value) || 0
                setLocalTreatmentFee(val)
                if (onSaveTreatmentFee) onSaveTreatmentFee(val)
              }}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
