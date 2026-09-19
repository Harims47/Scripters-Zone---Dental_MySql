import { useState, useEffect } from 'react';
import { api } from '../../lib/api';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { ArrowUpRight, ArrowDownLeft, SlidersHorizontal, RefreshCw } from 'lucide-react';
import type { StockMovement } from '../../types/domain';

interface StockHistoryTableProps {
  medicineId: string;
}

export function StockHistoryTable({ medicineId }: StockHistoryTableProps) {
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);

  const fetchHistory = async (pageNum: number) => {
    setIsLoading(true);
    try {
      const res = await api.get<any>(`/api/inventory/${medicineId}/history?page=${pageNum}&limit=10`);
      const payload = res as any;
      if (payload.data) {
        setMovements(payload.data);
        if (payload.meta) {
          setTotalPages(payload.meta.totalPages || 1);
          setTotalRecords(payload.meta.totalRecords || 0);
          setPage(payload.meta.currentPage || pageNum);
        }
      }
    } catch (err) {
      console.error('Failed to fetch stock history:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (medicineId) {
      fetchHistory(1);
    }
  }, [medicineId]);

  const getMovementBadge = (type: string) => {
    switch (type) {
      case 'PURCHASE_RECEIPT':
        return (
          <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
            <ArrowUpRight className="w-3 h-3" /> Purchase Receipt
          </span>
        );
      case 'DISPENSING':
        return (
          <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
            <ArrowDownLeft className="w-3 h-3" /> Dispensing
          </span>
        );
      case 'ADJUSTMENT':
        return (
          <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200">
            <SlidersHorizontal className="w-3 h-3" /> Adjustment
          </span>
        );
      default:
        return <Badge variant="outline">{type}</Badge>;
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
          Audit Ledger ({totalRecords} movements)
        </h4>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => fetchHistory(page)}
          className="h-7 px-2 text-xs text-slate-500 hover:text-slate-900"
          title="Refresh History"
        >
          <RefreshCw className={`w-3.5 h-3.5 mr-1 ${isLoading ? 'animate-spin' : ''}`} /> Refresh
        </Button>
      </div>

      {isLoading ? (
        <div className="text-center py-8 text-sm text-slate-400">Loading stock history...</div>
      ) : movements.length === 0 ? (
        <div className="text-center py-8 px-4 border border-dashed rounded-xl bg-slate-50/50">
          <p className="text-sm font-medium text-slate-600">No stock movements yet.</p>
          <p className="text-xs text-slate-400 mt-1">
            Goods receive, patient dispensing, and adjustments will automatically be logged here.
          </p>
        </div>
      ) : (
        <div className="border border-slate-200/80 rounded-xl overflow-hidden bg-white shadow-xs">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50/80 border-b border-slate-200/80 text-slate-600 font-semibold">
              <tr>
                <th className="py-2.5 px-3">Date / Time</th>
                <th className="py-2.5 px-3">Movement</th>
                <th className="py-2.5 px-3 text-right">Quantity</th>
                <th className="py-2.5 px-3 text-right">Balance</th>
                <th className="py-2.5 px-3">Reference / Reason</th>
                <th className="py-2.5 px-3">User</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {movements.map((m) => {
                const isPositive = m.quantity > 0;
                const formattedDate = new Date(m.createdAt).toLocaleString([], {
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                });

                return (
                  <tr key={m.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="py-2.5 px-3 whitespace-nowrap text-slate-500 font-mono">
                      {formattedDate}
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      {getMovementBadge(m.movementType)}
                    </td>
                    <td className="py-2.5 px-3 text-right font-bold whitespace-nowrap">
                      <span className={isPositive ? 'text-emerald-700' : 'text-rose-600'}>
                        {isPositive ? `+${m.quantity}` : m.quantity}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right font-semibold text-slate-800 whitespace-nowrap">
                      {m.balanceAfter}
                    </td>
                    <td className="py-2.5 px-3 text-slate-600 max-w-[200px] truncate" title={m.reason || m.referenceId || '-'}>
                      {m.reason || (m.referenceType ? `${m.referenceType}: ${m.referenceId?.slice(0, 8)}` : '-')}
                    </td>
                    <td className="py-2.5 px-3 text-slate-500 whitespace-nowrap">
                      {m.performedBy || 'System'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {totalPages > 1 && (
            <div className="flex items-center justify-between px-3 py-2 border-t border-slate-100 bg-slate-50/50">
              <span className="text-xs text-slate-500">
                Page {page} of {totalPages}
              </span>
              <div className="flex gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => fetchHistory(page - 1)}
                  className="h-6 px-2 text-xs"
                >
                  Prev
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages}
                  onClick={() => fetchHistory(page + 1)}
                  className="h-6 px-2 text-xs"
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
