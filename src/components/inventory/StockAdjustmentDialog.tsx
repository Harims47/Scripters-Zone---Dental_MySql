import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { toast } from 'react-hot-toast';
import { Plus, Minus, AlertTriangle } from 'lucide-react';
import { useClinicContext } from '../../context/ClinicContext';
import type { Medicine } from '../../lib/mock-data/medicines';

interface StockAdjustmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  medicine: Medicine | null;
  onSuccess?: () => void;
}

const ADJUSTMENT_REASONS = [
  'Damaged',
  'Expired',
  'Physical Count Correction',
  'Opening Stock',
  'Other'
];

export function StockAdjustmentDialog({
  open,
  onOpenChange,
  medicine,
  onSuccess
}: StockAdjustmentDialogProps) {
  const { adjustMedicineStock } = useClinicContext();

  const [direction, setDirection] = useState<'ADD' | 'SUBTRACT'>('ADD');
  const [quantity, setQuantity] = useState<number | ''>(5);
  const [reasonCategory, setReasonCategory] = useState<string>('Physical Count Correction');
  const [otherExplanation, setOtherExplanation] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!medicine) return null;

  const currentStock = medicine.currentStock || 0;
  const numQty = typeof quantity === 'number' ? quantity : 0;
  const resultingStock = direction === 'ADD' ? currentStock + numQty : currentStock - numQty;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (typeof quantity !== 'number' || quantity <= 0 || !Number.isInteger(quantity)) {
      setErrorMsg('Quantity must be a positive whole number.');
      return;
    }

    if (direction === 'SUBTRACT' && resultingStock < 0) {
      setErrorMsg(`Cannot subtract ${quantity}. Maximum available to subtract is ${currentStock}.`);
      return;
    }

    if (!reasonCategory) {
      setErrorMsg('Please select an adjustment reason.');
      return;
    }

    if (reasonCategory === 'Other' && !otherExplanation.trim()) {
      setErrorMsg('Please provide an explanation for "Other".');
      return;
    }

    const finalReason = reasonCategory === 'Other' ? `Other: ${otherExplanation.trim()}` : reasonCategory;

    setIsSubmitting(true);
    try {
      const res = await adjustMedicineStock(medicine.id, {
        quantity,
        type: direction,
        reason: finalReason
      });

      if (res.success) {
        toast.success(`Stock adjusted successfully to ${resultingStock} units`);
        onOpenChange(false);
        setQuantity(5);
        setDirection('ADD');
        setReasonCategory('Physical Count Correction');
        setOtherExplanation('');
        onSuccess?.();
      } else {
        setErrorMsg(res.error || 'Failed to adjust stock');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Error occurred while adjusting stock');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[460px] bg-white rounded-2xl p-6 shadow-2xl">
        <DialogHeader className="mb-2">
          <DialogTitle className="text-xl font-bold text-slate-900">Adjust Stock Quantity</DialogTitle>
          <DialogDescription className="text-sm text-slate-500">
            {numQty > 0 ? (
              <span>
                {direction === 'SUBTRACT' ? 'Subtract' : 'Add'}{' '}
                <strong className={direction === 'SUBTRACT' ? 'text-rose-600' : 'text-emerald-600'}>
                  {numQty} units
                </strong>{' '}
                {direction === 'SUBTRACT' ? 'from' : 'to'} current stock for{' '}
                <strong className="text-slate-800">{medicine.name}</strong>.
              </span>
            ) : (
              <span>
                Make a controlled stock adjustment for <strong className="text-slate-800">{medicine.name}</strong>.
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Current vs Resulting summary */}
          <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200/70 text-center">
            <div>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Current Stock</span>
              <div className="text-xl font-bold text-slate-900 mt-0.5">{currentStock}</div>
            </div>
            <div className={`border-l border-slate-200 pl-3 ${resultingStock < 0 ? 'text-rose-600' : 'text-emerald-700'}`}>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Resulting Stock</span>
              <div className="text-xl font-bold mt-0.5">{resultingStock}</div>
            </div>
          </div>

          {/* Direction Toggle */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Direction</Label>
            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant={direction === 'ADD' ? 'default' : 'outline'}
                onClick={() => { setDirection('ADD'); setErrorMsg(null); }}
                className={direction === 'ADD' ? 'bg-emerald-600 hover:bg-emerald-700 text-white font-semibold' : 'text-slate-700 font-medium'}
              >
                <Plus className="w-4 h-4 mr-1.5" /> Add Stock (+)
              </Button>
              <Button
                type="button"
                variant={direction === 'SUBTRACT' ? 'default' : 'outline'}
                onClick={() => { setDirection('SUBTRACT'); setErrorMsg(null); }}
                className={direction === 'SUBTRACT' ? 'bg-rose-600 hover:bg-rose-700 text-white font-semibold' : 'text-slate-700 font-medium'}
              >
                <Minus className="w-4 h-4 mr-1.5" /> Subtract Stock (-)
              </Button>
            </div>
          </div>

          {/* Quantity Input */}
          <div className="space-y-2">
            <Label htmlFor="adj-qty" className="text-xs font-semibold text-slate-600 uppercase tracking-wider">
              Quantity <span className="text-rose-500">*</span>
            </Label>
            <Input
              id="adj-qty"
              type="number"
              min="1"
              step="1"
              value={quantity}
              onChange={(e) => {
                const val = e.target.value === '' ? '' : parseInt(e.target.value, 10);
                setQuantity(val);
                setErrorMsg(null);
              }}
              placeholder="e.g. 10"
              className="h-10 text-base font-medium"
              required
            />
          </div>

          {/* Reason Selection */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold text-slate-600 uppercase tracking-wider">
              Reason for Adjustment <span className="text-rose-500">*</span>
            </Label>
            <Select value={reasonCategory} onValueChange={(val) => { setReasonCategory(val); setErrorMsg(null); }}>
              <SelectTrigger className="h-10 text-sm font-medium">
                <SelectValue placeholder="Select a reason" />
              </SelectTrigger>
              <SelectContent>
                {ADJUSTMENT_REASONS.map((r) => (
                  <SelectItem key={r} value={r}>{r}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Conditional "Other" field */}
          {reasonCategory === 'Other' && (
            <div className="space-y-2 animate-in fade-in duration-200">
              <Label htmlFor="adj-other" className="text-xs font-semibold text-slate-600 uppercase tracking-wider">
                Explanation <span className="text-rose-500">*</span>
              </Label>
              <Input
                id="adj-other"
                type="text"
                value={otherExplanation}
                onChange={(e) => { setOtherExplanation(e.target.value); setErrorMsg(null); }}
                placeholder="Explain the reason for adjustment"
                className="h-10 text-sm"
                required
              />
            </div>
          )}

          {errorMsg && (
            <div className="flex items-center gap-2 p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium rounded-lg">
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{errorMsg}</span>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0 pt-2">
            <DialogClose asChild>
              <Button type="button" variant="outline" disabled={isSubmitting}>
                Cancel
              </Button>
            </DialogClose>
            <Button
              type="submit"
              disabled={isSubmitting || resultingStock < 0 || !quantity || quantity <= 0}
              className={direction === 'ADD' ? 'bg-emerald-600 hover:bg-emerald-700 text-white font-semibold' : 'bg-rose-600 hover:bg-rose-700 text-white font-semibold'}
            >
              {isSubmitting
                ? 'Applying...'
                : numQty > 0
                ? `${direction === 'ADD' ? 'Add' : 'Subtract'} ${numQty} ${numQty === 1 ? 'Unit' : 'Units'}`
                : 'Confirm Adjustment'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
