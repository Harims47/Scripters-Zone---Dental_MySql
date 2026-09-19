import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { AlertTriangle, ChevronLeft, ChevronRight, ShoppingCart, ShieldAlert } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle, DialogFooter, DialogDescription } from '../ui/dialog';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../lib/api';

export interface LowStockAlertItem {
  id: string;
  name: string;
  genericName?: string | null;
  currentStock: number;
  stockWarningLevel: number;
  unit: string;
  categoryName: string;
  hasActivePO: boolean;
  activePO?: {
    poId: string;
    orderNumber: string;
    status: string;
  } | null;
}

const ONE_HOUR_MS = 60 * 60 * 1000;

export function LowStockAlertModal() {
  const { currentUser, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [alerts, setAlerts] = useState<LowStockAlertItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [isOpen, setIsOpen] = useState<boolean>(false);

  // Prevent spamming requests during rapid renders/navigation
  const lastCheckTimeRef = useRef<number>(0);

  const checkLowStockAlerts = useCallback(async (force = false) => {
    if (!isAuthenticated) return;
    const now = Date.now();
    // Throttle checks to at most once every 30 seconds unless forced (e.g. auth change)
    if (!force && now - lastCheckTimeRef.current < 30000) return;
    lastCheckTimeRef.current = now;

    try {
      const res = await api.get<{ data: LowStockAlertItem[] }>('/api/inventory/low-stock-alerts');
      const allLowStock = res.data || [];

      // Filter based on 1-hour dismissal rule & qualifying active PO suppression rule
      const activeUnaddressed = allLowStock.filter((item) => {
        // Condition 1: If there is an active PO (Ordered or Partially Received), alert is suppressed
        if (item.hasActivePO) {
          return false;
        }

        // Condition 2: Dismissal check from localStorage
        const dismissedKey = `dc_low_stock_dismissed_${item.id}`;
        const lastDismissedStr = localStorage.getItem(dismissedKey);
        if (lastDismissedStr) {
          const lastDismissedTime = parseInt(lastDismissedStr, 10);
          if (!isNaN(lastDismissedTime) && now - lastDismissedTime < ONE_HOUR_MS) {
            // Dismissed less than 1 hour ago -> suppress
            return false;
          }
        }

        return true;
      });

      if (activeUnaddressed.length > 0) {
        setAlerts(activeUnaddressed);
        setCurrentIndex(0);
        setIsOpen(true);
      } else {
        setAlerts([]);
        setIsOpen(false);
      }
    } catch (err) {
      // Backend error or unauthorized role; silently handle
    }
  }, [isAuthenticated]);

  // Check on auth state change or mount, plus periodic 2-minute polling
  useEffect(() => {
    if (isAuthenticated) {
      checkLowStockAlerts(true);
    }
    const interval = setInterval(() => checkLowStockAlerts(), 120000);
    return () => clearInterval(interval);
  }, [isAuthenticated, checkLowStockAlerts]);

  // If user is currently on the purchase order tab or creating a PO, don't obstruct them with modal
  const isOnPurchaseOrders = location.pathname === '/inventory' && location.search.includes('tab=orders');

  if (!isOpen || alerts.length === 0 || isOnPurchaseOrders) {
    return null;
  }

  const currentItem = alerts[currentIndex] || alerts[0];
  const canCreatePO = currentUser?.role === 'Head Doctor';

  const handleDismissCurrent = () => {
    // Record dismissal time in localStorage for all current alerts
    alerts.forEach((item) => {
      localStorage.setItem(`dc_low_stock_dismissed_${item.id}`, Date.now().toString());
    });
    setAlerts([]);
    setIsOpen(false);
  };

  const handleDismissAll = () => {
    alerts.forEach((item) => {
      localStorage.setItem(`dc_low_stock_dismissed_${item.id}`, Date.now().toString());
    });
    setAlerts([]);
    setIsOpen(false);
  };

  const handleCreatePurchaseOrder = () => {
    if (!currentItem) return;
    // Dismiss for now so it doesn't pop up while creating
    localStorage.setItem(`dc_low_stock_dismissed_${currentItem.id}`, Date.now().toString());
    setIsOpen(false);

    // Navigate to inventory with purchase orders tab and preselected medicine
    navigate(`/inventory?tab=orders&createForMedicine=${encodeURIComponent(currentItem.id)}`);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) handleDismissCurrent(); }}>
      <DialogContent className="sm:max-w-[480px] p-0 overflow-hidden border-amber-200 shadow-2xl rounded-2xl">
        {/* Header with high-visibility amber accent */}
        <div className="bg-gradient-to-r from-amber-500 to-amber-600 px-6 py-4 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-white/20 rounded-lg backdrop-blur-xs">
              <AlertTriangle className="w-5 h-5 text-white" />
            </div>
            <div>
              <DialogTitle className="text-white text-lg font-bold tracking-tight">
                Low Stock Alert
              </DialogTitle>
              <DialogDescription className="text-amber-100 text-xs font-medium">
                {alerts.length > 1
                  ? `Item ${currentIndex + 1} of ${alerts.length} requiring reorder`
                  : 'Operational inventory threshold reached'}
              </DialogDescription>
            </div>
          </div>
          {alerts.length > 1 && (
            <Badge className="bg-amber-700/60 hover:bg-amber-700/60 text-white border-amber-400/40 text-xs font-semibold px-2.5 py-0.5">
              {currentIndex + 1} / {alerts.length}
            </Badge>
          )}
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-5 bg-white">
          <div>
            <h3 className="text-xl font-bold text-slate-900 tracking-tight">
              {currentItem.name}
            </h3>
            {currentItem.genericName && (
              <p className="text-sm font-medium text-slate-500 mt-0.5">
                {currentItem.genericName}
              </p>
            )}
            <p className="text-xs text-amber-700 font-medium mt-1">
              Category: {currentItem.categoryName}
            </p>
          </div>

          {/* Stock Metrics Card */}
          <div className="grid grid-cols-2 gap-3 p-4 bg-amber-50/60 border border-amber-200/80 rounded-xl">
            <div className="space-y-1">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Current Stock
              </span>
              <div className="text-2xl font-black text-rose-600">
                {currentItem.currentStock} <span className="text-xs font-semibold text-slate-600">{currentItem.unit}</span>
              </div>
            </div>
            <div className="space-y-1">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Minimum Stock
              </span>
              <div className="text-2xl font-black text-slate-700">
                {currentItem.stockWarningLevel} <span className="text-xs font-semibold text-slate-600">{currentItem.unit}</span>
              </div>
            </div>
          </div>

          {/* Action guidance */}
          <div className="text-sm text-slate-600 bg-slate-50 border border-slate-200 rounded-lg p-3">
            <p className="font-semibold text-slate-800">Please order the stock now.</p>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">
              Stock has reached or fallen below the configured minimum threshold. An hourly reminder will continue until a purchase order is placed.
            </p>
          </div>

          {/* Multiple alerts navigation */}
          {alerts.length > 1 && (
            <div className="flex items-center justify-between pt-1 border-t border-slate-100 text-xs text-slate-500">
              <span>Navigate pending alerts:</span>
              <div className="flex items-center gap-1">
                <Button
                  size="icon"
                  variant="outline"
                  className="h-7 w-7"
                  disabled={currentIndex === 0}
                  onClick={() => setCurrentIndex((prev) => Math.max(0, prev - 1))}
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                </Button>
                <Button
                  size="icon"
                  variant="outline"
                  className="h-7 w-7"
                  disabled={currentIndex === alerts.length - 1}
                  onClick={() => setCurrentIndex((prev) => Math.min(alerts.length - 1, prev + 1))}
                >
                  <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <DialogFooter className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleDismissCurrent}
              className="text-slate-600 hover:bg-slate-100 text-xs font-medium"
            >
              Remind in 1 hr
            </Button>
            {alerts.length > 1 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleDismissAll}
                className="text-slate-500 hover:text-slate-800 text-xs font-medium hidden sm:inline-flex"
              >
                Dismiss All
              </Button>
            )}
          </div>

          <div className="flex items-center gap-2">
            {canCreatePO ? (
              <Button
                onClick={handleCreatePurchaseOrder}
                className="bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold shadow-sm flex items-center gap-1.5"
              >
                <ShoppingCart className="w-3.5 h-3.5" />
                Create Purchase Order
              </Button>
            ) : (
              <div className="flex items-center gap-1.5 text-xs text-slate-500 italic">
                <ShieldAlert className="w-3.5 h-3.5 text-amber-600" />
                Contact Head Doctor to Order
              </div>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
