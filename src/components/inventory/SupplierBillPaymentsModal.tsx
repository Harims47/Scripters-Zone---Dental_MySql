import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '../ui/dialog';
import { Receipt } from 'lucide-react';
import type { SupplierBill } from '../../types/domain';

interface SupplierBillPaymentsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bill: SupplierBill | null;
}

export function SupplierBillPaymentsModal({
  open,
  onOpenChange,
  bill
}: SupplierBillPaymentsModalProps) {
  if (!bill) return null;

  const payments = bill.payments || [];
  const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);
  const remainingBalance = Math.max(0, Math.round((bill.amount - totalPaid) * 100) / 100);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px] bg-white rounded-2xl p-6 shadow-2xl">
        <DialogHeader className="mb-2">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-700 flex items-center justify-center font-bold">
              <Receipt className="w-5 h-5" />
            </div>
            <div>
              <DialogTitle className="text-xl font-bold text-slate-900">Payment History</DialogTitle>
              <DialogDescription className="text-xs text-slate-500 pt-0.5">
                Invoice <strong className="text-slate-800 font-mono">{bill.invoiceNumber}</strong> • {bill.supplier?.name || 'Supplier'}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Financial KPI Summary */}
        <div className="grid grid-cols-3 gap-2 p-3 bg-slate-50 rounded-xl border border-slate-200/80 text-xs">
          <div>
            <span className="font-medium text-slate-500 block">Total Bill</span>
            <span className="font-bold text-slate-900 font-mono">₹{bill.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
          </div>
          <div>
            <span className="font-medium text-slate-500 block">Total Paid</span>
            <span className="font-bold text-emerald-700 font-mono">₹{totalPaid.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
          </div>
          <div>
            <span className="font-medium text-slate-500 block">Balance</span>
            <span className="font-bold text-amber-700 font-mono">₹{remainingBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
          </div>
        </div>

        {/* Payments Table */}
        <div className="border border-slate-200 rounded-xl overflow-hidden bg-white mt-2">
          {payments.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-400">
              No payments recorded against this invoice yet.
            </div>
          ) : (
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                <tr>
                  <th className="py-2.5 px-3">Date</th>
                  <th className="py-2.5 px-3">Method</th>
                  <th className="py-2.5 px-3">Notes</th>
                  <th className="py-2.5 px-3 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {payments.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50/50">
                    <td className="py-2.5 px-3 font-medium text-slate-700">
                      {new Date(p.date).toLocaleDateString()}
                    </td>
                    <td className="py-2.5 px-3">
                      <Badge variant="outline" className="text-[10px] font-semibold bg-slate-50">
                        {p.method}
                      </Badge>
                    </td>
                    <td className="py-2.5 px-3 text-slate-500 max-w-[140px] truncate">
                      {p.notes || '—'}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">
                      ₹{p.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <DialogFooter className="pt-2">
          <DialogClose asChild>
            <Button variant="outline" className="font-medium text-xs">Close</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
