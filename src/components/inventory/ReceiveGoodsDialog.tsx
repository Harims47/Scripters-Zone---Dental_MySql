import React, { useState } from 'react';
import { api } from '../../lib/api';
import { toast } from 'react-hot-toast';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '../ui/dialog';
import { CheckCircle2, PackageCheck, AlertCircle } from 'lucide-react';
import type { PurchaseOrder } from '../../types/domain';

interface ReceiveGoodsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  purchaseOrder: PurchaseOrder | null;
  onSuccess?: () => void;
}

export function ReceiveGoodsDialog({
  open,
  onOpenChange,
  purchaseOrder,
  onSuccess
}: ReceiveGoodsDialogProps) {
  const [receiveQuantities, setReceiveQuantities] = useState<Record<string, number | ''>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Initialize or reset quantities whenever dialog opens
  React.useEffect(() => {
    if (purchaseOrder && open) {
      const initial: Record<string, number | ''> = {};
      purchaseOrder.items.forEach((item) => {
        const remaining = item.orderedQuantity - item.receivedQuantity;
        // Default to remaining quantity if > 0
        initial[item.id] = remaining > 0 ? remaining : '';
      });
      setReceiveQuantities(initial);
      setErrorMsg(null);
    }
  }, [purchaseOrder, open]);

  if (!purchaseOrder) return null;

  const handleQtyChange = (itemId: string, value: string) => {
    setErrorMsg(null);
    if (value === '') {
      setReceiveQuantities((prev) => ({ ...prev, [itemId]: '' }));
      return;
    }
    const num = parseInt(value, 10);
    if (isNaN(num)) return;
    setReceiveQuantities((prev) => ({ ...prev, [itemId]: num }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    // Build payload of items where receiveQuantity > 0
    const itemsToSubmit: { itemId: string; receiveQuantity: number }[] = [];

    for (const item of purchaseOrder.items) {
      const remaining = item.orderedQuantity - item.receivedQuantity;
      const qty = receiveQuantities[item.id];

      if (typeof qty === 'number' && qty > 0) {
        if (!Number.isInteger(qty)) {
          setErrorMsg(`Quantity for ${item.medicine?.name || 'Item'} must be a whole number.`);
          return;
        }
        if (qty > remaining) {
          setErrorMsg(
            `Cannot collect ${qty} for ${item.medicine?.name || 'Item'}. Remaining uncollected is only ${remaining}.`
          );
          return;
        }
        itemsToSubmit.push({ itemId: item.id, receiveQuantity: qty });
      }
    }

    if (itemsToSubmit.length === 0) {
      setErrorMsg('Please enter at least one positive quantity to collect.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await api.post<any>(`/api/purchase-orders/${purchaseOrder.id}/receive`, {
        items: itemsToSubmit
      });

      if (res.success || res.data) {
        toast.success('Stock collected successfully. Stock updated.');
        onOpenChange(false);
        onSuccess?.();
      } else {
        setErrorMsg(res.error || 'Failed to collect stock');
      }
    } catch (err: any) {
      console.error('Goods collection error:', err);
      setErrorMsg(err.response?.data?.error || err.message || 'Error occurred while collecting stock');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[660px] max-h-[90vh] overflow-y-auto bg-white rounded-2xl p-6 shadow-2xl">
        <DialogHeader className="mb-1">
          <div className="flex items-center gap-2">
            <PackageCheck className="w-5 h-5 text-emerald-600" />
            <DialogTitle className="text-xl font-bold text-slate-900">Receive Goods (Collect Stock)</DialogTitle>
          </div>
          <DialogDescription className="text-xs text-slate-500 pt-1">
            Physical stock delivery for Purchase Order <strong className="text-slate-800 font-mono">{purchaseOrder.orderNumber}</strong>.
            Collected items will atomically increase medicine stock.
          </DialogDescription>
        </DialogHeader>

        {/* PO Header Summary */}
        <div className="grid grid-cols-3 gap-2 p-3 bg-slate-50 rounded-xl border border-slate-200/80 text-xs">
          <div>
            <span className="font-semibold text-slate-500 uppercase tracking-wider block">Supplier</span>
            <span className="font-bold text-slate-800 truncate block">{purchaseOrder.supplier?.name || '—'}</span>
          </div>
          <div>
            <span className="font-semibold text-slate-500 uppercase tracking-wider block">Order Date</span>
            <span className="font-medium text-slate-700 block">
              {new Date(purchaseOrder.orderDate).toLocaleDateString()}
            </span>
          </div>
          <div>
            <span className="font-semibold text-slate-500 uppercase tracking-wider block">Current Status</span>
            <Badge className="bg-sky-100 text-sky-800 hover:bg-sky-100 font-medium text-[11px] mt-0.5">
              {purchaseOrder.status === 'Ordered' ? 'Waiting for Receive' : purchaseOrder.status}
            </Badge>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 pt-1">
          <div className="border border-slate-200/80 rounded-xl overflow-hidden bg-white shadow-xs">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/80 border-b border-slate-200/80 text-slate-600 font-semibold">
                <tr>
                  <th className="py-2.5 px-3">Medicine / Item</th>
                  <th className="py-2.5 px-3 text-center">Ordered</th>
                  <th className="py-2.5 px-3 text-center">Collected</th>
                  <th className="py-2.5 px-3 text-center">Remaining</th>
                  <th className="py-2.5 px-3 text-right">Collect Now</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {purchaseOrder.items.map((item) => {
                  const remaining = item.orderedQuantity - item.receivedQuantity;
                  const isFullyReceived = remaining <= 0;
                  const currentInput = receiveQuantities[item.id];

                  return (
                    <tr key={item.id} className={isFullyReceived ? 'bg-slate-50/50 opacity-60' : 'hover:bg-slate-50/30'}>
                      <td className="py-2.5 px-3">
                        <div className="font-semibold text-slate-900">{item.medicine?.name || 'Medicine'}</div>
                        <div className="text-[11px] text-slate-500">{item.medicine?.unit || ''}</div>
                      </td>
                      <td className="py-2.5 px-3 text-center font-medium text-slate-700">
                        {item.orderedQuantity}
                      </td>
                      <td className="py-2.5 px-3 text-center font-semibold text-emerald-700">
                        {item.receivedQuantity}
                      </td>
                      <td className="py-2.5 px-3 text-center font-bold text-amber-700">
                        {remaining}
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        {isFullyReceived ? (
                          <span className="text-[11px] font-semibold text-emerald-600 inline-flex items-center gap-1 justify-end">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Fully Collected
                          </span>
                        ) : (
                          <Input
                            type="number"
                            min="0"
                            max={remaining}
                            value={currentInput !== undefined ? currentInput : ''}
                            onChange={(e) => handleQtyChange(item.id, e.target.value)}
                            className="w-24 h-8 text-right font-bold text-slate-900 ml-auto"
                            placeholder="0"
                          />
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
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
              disabled={isSubmitting}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold shadow-sm"
            >
              {isSubmitting ? 'Collecting Stock...' : 'Confirm Goods Receive'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
