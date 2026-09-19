import React, { useState } from 'react';
import { api } from '../../lib/api';
import { toast } from 'react-hot-toast';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '../ui/dialog';
import { HandCoins, AlertCircle } from 'lucide-react';
import type { SupplierBill } from '../../types/domain';

interface RecordSupplierPaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bill: SupplierBill | null;
  onSuccess?: () => void;
}

export function RecordSupplierPaymentDialog({
  open,
  onOpenChange,
  bill,
  onSuccess
}: RecordSupplierPaymentDialogProps) {
  const [amount, setAmount] = useState<number | ''>('');
  const [method, setMethod] = useState<'Cash' | 'Bank Transfer' | 'UPI'>('Bank Transfer');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  React.useEffect(() => {
    if (bill && open) {
      const balance = bill.balance !== undefined ? bill.balance : Math.max(0, bill.amount - (bill.totalPaid || 0));
      // Pre-fill amount with remaining balance if > 0
      setAmount(balance > 0 ? balance : '');
      setMethod('Bank Transfer');
      setDate(new Date().toISOString().split('T')[0]);
      setNotes('');
      setErrorMsg(null);
    }
  }, [bill, open]);

  if (!bill) return null;

  const totalPaid = bill.totalPaid || (bill.payments ? bill.payments.reduce((s, p) => s + p.amount, 0) : 0);
  const remainingBalance = bill.balance !== undefined ? bill.balance : Math.max(0, bill.amount - totalPaid);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const payNum = typeof amount === 'number' ? amount : parseFloat(String(amount));
    if (isNaN(payNum) || payNum <= 0) {
      setErrorMsg('Payment amount must be greater than 0.');
      return;
    }

    if (payNum > remainingBalance) {
      setErrorMsg(`Payment amount ₹${payNum} cannot exceed remaining balance of ₹${remainingBalance}.`);
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await api.post<any>(`/api/supplier-bills/${bill.id}/payments`, {
        amount: payNum,
        method,
        date: date || undefined,
        notes: notes.trim() || undefined
      });

      if (res.success || res.data) {
        toast.success(`Payment of ₹${payNum.toLocaleString()} recorded successfully.`);
        onOpenChange(false);
        onSuccess?.();
      } else {
        setErrorMsg(res.error || 'Failed to record supplier payment');
      }
    } catch (err: any) {
      console.error('Record payment error:', err);
      setErrorMsg(err.response?.data?.error || err.message || 'Error occurred while recording payment');
    } finally {
      setIsSubmitting(false);
    }
  };

  const parsedAmt = typeof amount === 'number' ? amount : parseFloat(String(amount)) || 0;
  const simulatedBalanceAfter = Math.max(0, Math.round((remainingBalance - parsedAmt) * 100) / 100);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px] bg-white rounded-2xl p-6 shadow-2xl">
        <DialogHeader className="mb-2">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center font-bold">
              <HandCoins className="w-5 h-5" />
            </div>
            <div>
              <DialogTitle className="text-xl font-bold text-slate-900">Record Supplier Payment</DialogTitle>
              <DialogDescription className="text-xs text-slate-500 pt-0.5">
                Financial payment outflow for Invoice <strong className="text-slate-800 font-mono">{bill.invoiceNumber}</strong>
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Bill Financial Overview Card */}
        <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/80 space-y-2 text-xs">
          <div className="flex justify-between items-center text-slate-600">
            <span>Supplier</span>
            <span className="font-bold text-slate-900">{bill.supplier?.name || '—'}</span>
          </div>
          <div className="flex justify-between items-center text-slate-600">
            <span>Total Bill Amount</span>
            <span className="font-mono font-bold text-slate-900">₹{bill.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
          </div>
          <div className="flex justify-between items-center text-slate-600">
            <span>Already Paid</span>
            <span className="font-mono font-semibold text-emerald-700">₹{totalPaid.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
          </div>
          <div className="pt-2 border-t border-slate-200 flex justify-between items-center">
            <span className="font-semibold text-slate-700">Current Outstanding Balance</span>
            <span className="font-mono font-extrabold text-amber-700 text-sm">
              ₹{remainingBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 pt-1">
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-slate-700">Payment Amount (₹) <span className="text-rose-500">*</span></Label>
            <Input
              type="number"
              step="0.01"
              min="0.01"
              max={remainingBalance}
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value === '' ? '' : parseFloat(e.target.value))}
              className="h-10 text-base font-bold font-mono text-slate-900"
              required
            />
            {parsedAmt > 0 && parsedAmt <= remainingBalance && (
              <p className="text-[11px] text-slate-500">
                New balance after this payment: <strong className="font-mono text-slate-800">₹{simulatedBalanceAfter.toLocaleString(undefined, { minimumFractionDigits: 2 })}</strong>
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700">Payment Method <span className="text-rose-500">*</span></Label>
              <Select value={method} onValueChange={(val: any) => setMethod(val)}>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="Select Method" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Bank Transfer">Bank Transfer</SelectItem>
                  <SelectItem value="UPI">UPI</SelectItem>
                  <SelectItem value="Cash">Cash</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700">Payment Date <span className="text-rose-500">*</span></Label>
              <Input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="h-9 text-xs"
                required
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-slate-700">Payment Notes</Label>
            <Input
              type="text"
              placeholder="e.g. UTR number, cheque #, or partial payment advance"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="h-9 text-xs"
            />
          </div>

          {errorMsg && (
            <div className="flex items-center gap-2 p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium rounded-lg">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
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
              disabled={isSubmitting || remainingBalance <= 0}
              className="bg-teal-600 hover:bg-teal-700 text-white font-semibold shadow-sm"
            >
              {isSubmitting ? 'Recording...' : 'Record Payment'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
