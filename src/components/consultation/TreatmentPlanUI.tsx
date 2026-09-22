import { useState, useEffect } from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import {
  Plus,
  Check,
  Loader2,
  Trash2,
  ChevronDown,
  ChevronUp,
  History,
  X,
  Edit2,
  AlertCircle,
  CheckCircle2
} from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from '../ui/dialog';
import { api } from '../../lib/api';
import type { TreatmentPlan, TreatmentCatalog, TreatmentPlanItem } from '../../types/domain';
import { FdiToothChart } from './FdiToothChart';
import { getToothInfo } from '../../lib/toothMetadata';

export function TreatmentPlanUI({
  patientId,
  currentVisitId,
  treatmentFee,
  initialTreatmentZeroReason,
  onSaveTreatmentFee,
  onDone,
  initialEdit = false
}: {
  patientId: string;
  currentVisitId?: string;
  treatmentFee?: number;
  initialTreatmentZeroReason?: string;
  onSaveTreatmentFee?: (fee: number, zeroReason?: string) => void;
  onDone?: () => void;
  initialEdit?: boolean;
}) {
  const [plan, setPlan] = useState<TreatmentPlan | null>(null);
  const [catalog, setCatalog] = useState<TreatmentCatalog[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [localTreatmentFee, setLocalTreatmentFee] = useState<string>(
    treatmentFee !== undefined ? String(treatmentFee) : '0'
  );
  const [isFeeFocused, setIsFeeFocused] = useState<boolean>(false);
  const [treatmentZeroReason, setTreatmentZeroReason] = useState<string>(initialTreatmentZeroReason || '');
  const [treatmentZeroError, setTreatmentZeroError] = useState<string>('');
  const [isZeroFeeModalOpen, setIsZeroFeeModalOpen] = useState<boolean>(false);

  const ZERO_FEE_REASONS = [
    'Follow-up / Review',
    'Included in Package',
    'Warranty / Revision',
    'Complimentary / Courtesy',
    'Observation Only'
  ];

  // Tooth Selection state
  const [selectedTeeth, setSelectedTeeth] = useState<number[]>([]);

  // Treatment Form state
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [selectedProcedure, setSelectedProcedure] = useState<string>('');
  const [notes, setNotes] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Editing state for an existing planned item
  const [editingItem, setEditingItem] = useState<TreatmentPlanItem | null>(null);

  // Past visits history toggle
  const [showPastHistory, setShowPastHistory] = useState(false);

  useEffect(() => {
    if (treatmentFee !== undefined && !isFeeFocused) {
      setLocalTreatmentFee(String(treatmentFee));
    }
  }, [treatmentFee, isFeeFocused]);

  useEffect(() => {
    if (initialTreatmentZeroReason !== undefined) {
      setTreatmentZeroReason(initialTreatmentZeroReason);
    }
  }, [initialTreatmentZeroReason]);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setPlan(null);
      setSelectedTeeth([]);
      setSelectedCategory('');
      setSelectedProcedure('');
      setNotes('');
      setEditingItem(null);
      setErrorMsg(null);
      try {
        const [catRes, planRes] = await Promise.all([
          api.get<any>('/api/treatments/catalog'),
          api.get<any>(`/api/patients/${patientId}/treatment-plan`)
        ]);

        const catList = Array.isArray(catRes) ? catRes : catRes?.data || [];
        setCatalog(catList);

        const planData = planRes?.data || planRes;
        setPlan(planData);

        // Pre-fill form when opened in edit mode
        if (initialEdit && planData?.items?.length) {
          const itemToEdit = (currentVisitId
            ? planData.items.find((i: TreatmentPlanItem) => i.completedVisitId === currentVisitId)
            : null) || planData.items[0];

          if (itemToEdit) {
            const catItem = catList.find((c: any) => c.id === itemToEdit.treatmentCatalogId) || itemToEdit.catalogItem;
            setEditingItem(itemToEdit);
            setSelectedCategory(catItem?.category || '');
            setSelectedProcedure(itemToEdit.treatmentCatalogId);
            setNotes(itemToEdit.notes || '');
            setSelectedTeeth(itemToEdit.toothNumber ? [itemToEdit.toothNumber] : []);
          }
        }
      } catch (err) {
        console.error('Failed to load treatment plan', err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [patientId, initialEdit, currentVisitId]);

  const categories = Array.from(new Set(catalog.map((c) => c.category))).filter(Boolean);
  const procedures = catalog.filter((c) => c.category === selectedCategory);

  // Calculate teeth with existing treatments for chart badges
  const plannedTeeth = (plan?.items || [])
    .filter((item) => item.status === 'Planned' && item.toothNumber != null)
    .map((item) => item.toothNumber as number);

  const completedTeeth = (plan?.items || [])
    .filter((item) => item.status === 'Completed' && item.toothNumber != null)
    .map((item) => item.toothNumber as number);

  // Toggle tooth in multi-selection
  const handleToggleTooth = (fdi: number) => {
    setSelectedTeeth((prev) => {
      if (prev.includes(fdi)) {
        return prev.filter((t) => t !== fdi);
      } else {
        return [...prev, fdi];
      }
    });
    setErrorMsg(null);
  };

  const handleRemoveTooth = (fdi: number) => {
    setSelectedTeeth((prev) => prev.filter((t) => t !== fdi));
  };

  const handleClearSelection = () => {
    setSelectedTeeth([]);
  };

  // Handle Add to Plan (supports single or multi-tooth)
  const handleAddOrUpdate = async () => {
    if (!selectedProcedure) {
      setErrorMsg('Please select a treatment procedure.');
      return;
    }

    setSaving(true);
    setErrorMsg(null);

    try {
      if (editingItem) {
        // Update existing planned item
        const singleTooth = selectedTeeth.length > 0 ? selectedTeeth[0] : null;
        const res = await api.patch<TreatmentPlanItem>(
          `/api/patients/${patientId}/treatment-plan/items/${editingItem.id}`,
          {
            treatmentCatalogId: selectedProcedure,
            toothNumber: singleTooth,
            notes: notes || null
          }
        );

        setPlan((prev) =>
          prev
            ? {
              ...prev,
              items: prev.items.map((i) => (i.id === editingItem.id ? res : i))
            }
            : null
        );

        setEditingItem(null);
      } else {
        // Create new item(s)
        if (selectedTeeth.length > 1) {
          // Multi-tooth batch creation
          const res = await api.post<TreatmentPlanItem[]>(
            `/api/patients/${patientId}/treatment-plan/items`,
            {
              treatmentCatalogId: selectedProcedure,
              toothNumbers: selectedTeeth,
              notes: notes || undefined,
              completedVisitId: currentVisitId
            }
          );

          const newItems = Array.isArray(res) ? res : [res];
          setPlan((prev) =>
            prev ? { ...prev, items: [...newItems, ...prev.items] } : null
          );
        } else {
          // Single tooth or non-tooth creation
          const singleTooth = selectedTeeth.length === 1 ? selectedTeeth[0] : null;
          const res = await api.post<TreatmentPlanItem>(
            `/api/patients/${patientId}/treatment-plan/items`,
            {
              treatmentCatalogId: selectedProcedure,
              toothNumber: singleTooth,
              notes: notes || undefined,
              completedVisitId: currentVisitId
            }
          );

          setPlan((prev) =>
            prev ? { ...prev, items: [res, ...prev.items] } : null
          );
        }
      }

      // Reset form
      setSelectedCategory('');
      setSelectedProcedure('');
      setNotes('');
      setSelectedTeeth([]);
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'Failed to save treatment procedure.');
    } finally {
      setSaving(false);
    }
  };

  const handleStartEdit = (item: TreatmentPlanItem) => {
    const catItem = catalog.find((c) => c.id === item.treatmentCatalogId) || item.catalogItem;
    setEditingItem(item);
    setSelectedCategory(catItem?.category || '');
    setSelectedProcedure(item.treatmentCatalogId);
    setNotes(item.notes || '');
    setSelectedTeeth(item.toothNumber ? [item.toothNumber] : []);
    setErrorMsg(null);
  };

  const handleCancelEdit = () => {
    setEditingItem(null);
    setSelectedCategory('');
    setSelectedProcedure('');
    setNotes('');
    setSelectedTeeth([]);
    setErrorMsg(null);
  };

  const handleMarkCompleted = async (itemId: string) => {
    setSaving(true);
    try {
      const res = await api.patch<TreatmentPlanItem>(
        `/api/patients/${patientId}/treatment-plan/items/${itemId}`,
        {
          status: 'Completed',
          completedVisitId: currentVisitId
        }
      );
      setPlan((prev) =>
        prev
          ? {
            ...prev,
            items: prev.items.map((i) => (i.id === itemId ? res : i))
          }
          : null
      );
    } catch (err: any) {
      console.error(err);
      alert('Failed to update status. Verify ownership and authorization.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (itemId: string) => {
    if (!confirm('Are you sure you want to remove this treatment item?')) return;
    setSaving(true);
    try {
      await api.delete(`/api/patients/${patientId}/treatment-plan/items/${itemId}`);
      setPlan((prev) =>
        prev
          ? {
            ...prev,
            items: prev.items.filter((i) => i.id !== itemId)
          }
          : null
      );
      if (editingItem?.id === itemId) {
        handleCancelEdit();
      }
    } catch (err: any) {
      console.error(err);
      alert('Failed to delete treatment procedure.');
    } finally {
      setSaving(false);
    }
  };

  // Categorize items by visit context
  const currentVisitItems = currentVisitId
    ? plan?.items.filter((item) => item.completedVisitId === currentVisitId) || []
    : plan?.items || [];
  const plannedItems = currentVisitId
    ? plan?.items.filter((item) => item.status === 'Planned') || []
    : [];
  const pastCompletedItems = currentVisitId
    ? plan?.items.filter(
      (item) => item.status === 'Completed' && item.completedVisitId !== currentVisitId
    ) || []
    : [];

  if (loading) {
    return (
      <div className="py-12 text-center text-sm text-slate-500">
        <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-sky-600" />
        Loading FDI Treatment Workspace...
      </div>
    );
  }

  // Get Primary Selected Tooth info for display
  const primaryToothInfo = selectedTeeth.length === 1 ? getToothInfo(selectedTeeth[0]) : null;

  return (
    <div className="space-y-2.5">
      {/* Top 3-Column Treatment Planning Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-start">
        {/* =================================================================== */}
        {/* LEFT COLUMN (lg:col-span-5): Interactive FDI Tooth Chart            */}
        {/* =================================================================== */}
        <div className="lg:col-span-5 space-y-2">
          <FdiToothChart
            selectedTeeth={selectedTeeth}
            onToggleTooth={handleToggleTooth}
            plannedTeeth={plannedTeeth}
            completedTeeth={completedTeeth}
          />
        </div>

        {/* =================================================================== */}
        {/* MIDDLE COLUMN (lg:col-span-3): Selected Tooth Details & Entry Form  */}
        {/* =================================================================== */}
        <div className="lg:col-span-3 bg-white rounded-2xl border border-slate-200/80 p-3 shadow-xs space-y-2.5">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <h4 className="text-sm font-bold text-slate-900">
              {editingItem ? 'Edit Procedure' : 'Add Procedure'}
            </h4>
            {editingItem && (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 text-xs text-slate-500 hover:text-slate-800"
                onClick={handleCancelEdit}
              >
                Cancel Edit
              </Button>
            )}
          </div>

          {/* Selected Teeth Badges & Anatomical Details */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                Selected Teeth
              </label>
              {selectedTeeth.length > 0 && (
                <button
                  type="button"
                  onClick={handleClearSelection}
                  className="text-[11px] text-rose-600 hover:underline font-medium"
                >
                  Clear
                </button>
              )}
            </div>

            {selectedTeeth.length > 0 ? (
              <div className="flex flex-wrap gap-1.5 p-2 bg-slate-50 rounded-xl border border-slate-100">
                {selectedTeeth.map((fdi) => {
                  const info = getToothInfo(fdi);
                  return (
                    <span
                      key={fdi}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-sky-100 text-sky-800 font-bold text-xs border border-sky-200"
                      title={info?.name}
                    >
                      Tooth {fdi}
                      <button
                        type="button"
                        onClick={() => handleRemoveTooth(fdi)}
                        className="hover:text-rose-600 ml-0.5"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  );
                })}
              </div>
            ) : (
              <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100 text-xs text-slate-500 italic">
                No specific tooth selected. (Will be saved as general/whole-mouth procedure).
              </div>
            )}

            {/* Structured Tooth Anatomical Metadata (Strictly Independent from Notes) */}
            {primaryToothInfo && (
              <div className="p-3 bg-gradient-to-r from-sky-50/70 to-blue-50/50 rounded-xl border border-sky-100/80 space-y-1 text-xs">
                <div className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-sky-500"></span>
                  Tooth {primaryToothInfo.fdi}
                </div>
                <div className="font-medium text-slate-700">{primaryToothInfo.name}</div>
                <div className="flex items-center gap-2 text-[11px] text-slate-500 pt-0.5">
                  <span className="bg-white px-1.5 py-0.5 rounded border border-slate-200">
                    {primaryToothInfo.jaw} Jaw
                  </span>
                  <span className="bg-white px-1.5 py-0.5 rounded border border-slate-200">
                    {primaryToothInfo.quadrant}
                  </span>
                  <span className="bg-white px-1.5 py-0.5 rounded border border-slate-200">
                    {primaryToothInfo.type}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Treatment Category & Procedure Selectors */}
          <div className="space-y-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700">Treatment Category</label>
              <Select
                value={selectedCategory}
                onValueChange={(val) => {
                  setSelectedCategory(val);
                  setSelectedProcedure('');
                }}
              >
                <SelectTrigger className="bg-white text-xs h-9">
                  <SelectValue placeholder="Select Category" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={c} value={c} className="text-xs">
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700">Treatment Procedure</label>
              <Select
                value={selectedProcedure}
                onValueChange={setSelectedProcedure}
                disabled={!selectedCategory}
              >
                <SelectTrigger className="bg-white text-xs h-9">
                  <SelectValue placeholder="Select Procedure" />
                </SelectTrigger>
                <SelectContent>
                  {procedures.map((p) => (
                    <SelectItem key={p.id} value={p.id} className="text-xs">
                      {p.name} {p.variant ? `(${p.variant})` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Doctor Clinical Notes (Strictly Separate from Tooth Number) */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700">
                Doctor Notes (Optional)
              </label>
              <Textarea
                placeholder="Enter clinical notes, diagnosis, or instructions..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="bg-white text-xs min-h-[52px] resize-none"
              />
            </div>
          </div>

          {errorMsg && (
            <div className="flex items-center gap-1.5 text-xs text-rose-600 bg-rose-50 p-2 rounded-lg border border-rose-100">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <Button
            size="sm"
            className="w-full h-8 text-xs font-bold"
            disabled={!selectedProcedure || saving}
            onClick={handleAddOrUpdate}
          >
            {saving ? (
              <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
            ) : editingItem ? (
              <CheckCircle2 className="w-4 h-4 mr-1.5" />
            ) : (
              <Plus className="w-4 h-4 mr-1.5" />
            )}
            {editingItem ? 'Save Changes' : selectedTeeth.length > 1 ? `Add ${selectedTeeth.length} Procedures` : 'Add to Plan'}
          </Button>
        </div>

        {/* =================================================================== */}
        {/* RIGHT COLUMN (lg:col-span-4): Planned & Active Treatments List      */}
        {/* =================================================================== */}
        <div className="lg:col-span-4 bg-white rounded-2xl border border-slate-200/80 p-3 shadow-xs space-y-2.5 max-h-[410px] overflow-y-auto">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <h4 className="text-sm font-bold text-slate-900">Planned Treatments</h4>
            <span className="text-xs font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
              {currentVisitItems.length + plannedItems.length} items
            </span>
          </div>

          {/* Current Visit Procedures */}
          {currentVisitId && (
            <div className="space-y-2.5">
              <h5 className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Completed This Visit ({currentVisitItems.length})
              </h5>

              {currentVisitItems.length === 0 ? (
                <div className="text-center py-4 text-xs text-slate-400 bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
                  No procedures recorded for this visit yet.
                </div>
              ) : (
                currentVisitItems.map((item) => (
                  <div
                    key={item.id}
                    className="p-3 rounded-xl border bg-emerald-50/40 border-emerald-100 text-xs space-y-1.5 transition-all"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {item.toothNumber ? (
                            <span className="font-bold text-sky-800 bg-sky-100 px-1.5 py-0.5 rounded text-[11px]">
                              Tooth {item.toothNumber}
                            </span>
                          ) : (
                            <span className="font-medium text-slate-600 bg-slate-200/70 px-1.5 py-0.5 rounded text-[10px]">
                              General
                            </span>
                          )}
                          <span className="font-bold text-slate-900">
                            {item.catalogItem?.name}{' '}
                            {item.catalogItem?.variant ? `(${item.catalogItem.variant})` : ''}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          {item.catalogItem?.category}
                        </div>
                      </div>

                      <div className="flex items-center gap-0.5">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-slate-400 hover:text-sky-600 hover:bg-sky-50 cursor-pointer"
                          onClick={() => handleStartEdit(item)}
                          title="Edit procedure"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-slate-400 hover:text-rose-600 hover:bg-rose-50 cursor-pointer"
                          onClick={() => handleDelete(item.id)}
                          title="Remove procedure"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>

                    {item.notes && (
                      <div className="pt-1 text-[11px] text-slate-600 bg-white/70 p-1.5 rounded border border-emerald-100/70">
                        {item.notes}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          )}

          {/* Planned Roadmap Items (Pending Future / Complete Today) */}
          {plannedItems.length > 0 && (
            <div className="space-y-2.5 pt-2 border-t border-slate-100">
              <h5 className="text-[11px] font-bold uppercase tracking-wider text-amber-700">
                Planned Future Procedures ({plannedItems.length})
              </h5>

              {plannedItems.map((item) => (
                <div
                  key={item.id}
                  className="p-3 rounded-xl border bg-amber-50/30 border-amber-200/60 text-xs space-y-2 shadow-2xs"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {item.toothNumber ? (
                          <span className="font-bold text-sky-800 bg-sky-100 px-1.5 py-0.5 rounded text-[11px]">
                            Tooth {item.toothNumber}
                          </span>
                        ) : (
                          <span className="font-medium text-slate-600 bg-slate-200/70 px-1.5 py-0.5 rounded text-[10px]">
                            General
                          </span>
                        )}
                        <span className="font-bold text-slate-900">
                          {item.catalogItem?.name}{' '}
                          {item.catalogItem?.variant ? `(${item.catalogItem.variant})` : ''}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        {item.catalogItem?.category}
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-slate-400 hover:text-sky-600 hover:bg-sky-50"
                        onClick={() => handleStartEdit(item)}
                        title="Edit procedure"
                      >
                        <Edit2 className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                        onClick={() => handleDelete(item.id)}
                        title="Delete procedure"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>

                  {item.notes && (
                    <div className="text-[11px] text-slate-600 bg-white/70 p-1.5 rounded border border-amber-100">
                      {item.notes}
                    </div>
                  )}

                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full h-7 text-xs border-emerald-300 text-emerald-700 hover:bg-emerald-50"
                    disabled={saving}
                    onClick={() => handleMarkCompleted(item.id)}
                  >
                    <Check className="w-3 h-3 mr-1" /> Complete Today
                  </Button>
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
                  Past Visits History ({pastCompletedItems.length})
                </span>
                {showPastHistory ? (
                  <ChevronUp className="w-3.5 h-3.5" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5" />
                )}
              </button>

              {showPastHistory && (
                <div className="mt-2 space-y-2 pl-2 border-l-2 border-slate-200">
                  {pastCompletedItems.map((item) => (
                    <div
                      key={item.id}
                      className="p-2 rounded-lg bg-slate-50 border border-slate-200 text-xs flex justify-between items-center text-slate-600"
                    >
                      <div>
                        <div className="font-semibold text-slate-800 flex items-center gap-1">
                          {item.toothNumber && (
                            <span className="text-[10px] bg-sky-100 text-sky-800 px-1 py-0.2 rounded font-bold">
                              T{item.toothNumber}
                            </span>
                          )}
                          {item.catalogItem?.name}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          {item.catalogItem?.category} {item.notes ? `• ${item.notes}` : ''}
                        </div>
                      </div>
                      <span className="text-[9px] bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded font-medium">
                        Past Visit
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* =================================================================== */}
      {/* BOTTOM BAR: Total Treatment Fee & Done Action                       */}
      {/* =================================================================== */}
      <div className="py-2.5 px-3.5 bg-slate-50 rounded-xl border border-slate-200/80 flex flex-col gap-2.5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div className="space-y-0.5">
            <label className="text-xs font-bold text-slate-800">Total Treatment Fee (₹)</label>
            <p className="text-[10px] text-slate-500">
              Applicable procedure or treatment charge for this clinical consultation
            </p>
          </div>

          <div className="flex items-center gap-2.5 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-36">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-medium text-xs">
                ₹
              </span>
              <Input
                type="number"
                min="0"
                step="50"
                className="pl-6 h-8 text-xs bg-white font-semibold text-slate-900"
                value={localTreatmentFee}
                onFocus={() => setIsFeeFocused(true)}
                onBlur={() => {
                  setIsFeeFocused(false);
                  if (localTreatmentFee === '' || isNaN(Number(localTreatmentFee))) {
                    setLocalTreatmentFee('0');
                  } else {
                    const normalized = Number(localTreatmentFee);
                    setLocalTreatmentFee(String(normalized));
                  }
                }}
                onChange={(e) => {
                  const val = e.target.value;
                  setLocalTreatmentFee(val);
                  if (Number(val) > 0) {
                    setTreatmentZeroError('');
                  }
                }}
              />
            </div>
            {onDone && (
              <Button
                className="h-8 px-5 text-xs font-bold bg-teal-600 hover:bg-teal-700 text-white"
                onClick={async () => {
                  const feeNum = Number(localTreatmentFee) || 0;
                  if (feeNum === 0) {
                    setIsZeroFeeModalOpen(true);
                    return;
                  }
                  if (onSaveTreatmentFee) await onSaveTreatmentFee(feeNum, '');
                  if (onDone) onDone();
                }}
              >
                Done
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Modal for ₹0 Treatment Fee Reason (opens only when Done is clicked with ₹0) */}
      <Dialog open={isZeroFeeModalOpen} onOpenChange={setIsZeroFeeModalOpen}>
        <DialogContent className="max-w-md w-full p-5 gap-3.5 bg-white rounded-2xl shadow-xl">
          <DialogHeader className="space-y-1">
            <DialogTitle className="text-base font-bold text-slate-800 flex items-center gap-2">
              <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-amber-100 text-amber-700">
                <AlertCircle className="w-4 h-4" />
              </span>
              Reason for ₹0 Treatment Fee
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Please specify why no treatment fee is charged for this visit. Required for clinical audit and fee waiver records.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3.5 py-1">
            {/* Quick Tags */}
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1.5">
                Select Reason Tag
              </label>
              <div className="flex flex-wrap gap-1.5">
                {ZERO_FEE_REASONS.map((tag) => (
                  <button
                    type="button"
                    key={tag}
                    onClick={() => {
                      setTreatmentZeroReason(tag);
                      setTreatmentZeroError('');
                    }}
                    className={`text-xs px-2.5 py-1 rounded-lg border transition-all ${
                      treatmentZeroReason === tag
                        ? 'bg-amber-600 text-white border-amber-600 font-semibold shadow-xs'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-amber-50 hover:border-amber-300'
                    }`}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>

            {/* Detailed Reason Text Box */}
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Reason Details / Notes <span className="text-rose-500">*</span>
              </label>
              <Textarea
                placeholder="Enter reason for ₹0 treatment fee (e.g. Free checkup, warranty adjustment, package follow-up)..."
                value={treatmentZeroReason}
                onChange={(e) => {
                  setTreatmentZeroReason(e.target.value);
                  if (e.target.value.trim()) setTreatmentZeroError('');
                }}
                rows={3}
                className={`text-xs bg-white resize-none ${
                  treatmentZeroError ? 'border-rose-500 focus-visible:ring-rose-400' : 'border-slate-200'
                }`}
              />
              {treatmentZeroError && (
                <p className="text-[11px] text-rose-600 font-medium mt-1">{treatmentZeroError}</p>
              )}
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0 pt-2 border-t border-slate-100">
            <Button
              variant="outline"
              size="sm"
              className="text-xs"
              onClick={() => {
                setTreatmentZeroError('');
                setIsZeroFeeModalOpen(false);
              }}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              className="text-xs font-bold bg-teal-600 hover:bg-teal-700 text-white"
              onClick={async () => {
                if (!treatmentZeroReason.trim()) {
                  setTreatmentZeroError('Please select or provide a reason for ₹0 treatment fee.');
                  return;
                }
                setIsZeroFeeModalOpen(false);
                if (onSaveTreatmentFee) await onSaveTreatmentFee(0, treatmentZeroReason.trim());
                if (onDone) onDone();
              }}
            >
              Confirm & Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
