import { useState, useEffect, useCallback } from 'react';
import { api } from '../../lib/api';
import { toast } from 'react-hot-toast';
import { Plus, Trash2, Eye, Edit2, Send, XCircle, ShoppingCart, Upload, Image as ImageIcon, FileText, X, Receipt, HandCoins } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Badge } from '../ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Sheet, SheetContent, SheetScrollArea } from '../ui/sheet';
import { DrawerSection, DrawerFooterActions, ReadOnlyField } from '../ui/drawer-patterns';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '../ui/dialog';
import { DataTable } from '../data-table/data-table';
import { DataTableToolbar } from '../data-table/data-table-toolbar';
import { DataTableEmpty } from '../data-table/data-table';
import { ReceiveGoodsDialog } from './ReceiveGoodsDialog';
import { RecordSupplierPaymentDialog } from './RecordSupplierPaymentDialog';
import { SupplierBillPaymentsModal } from './SupplierBillPaymentsModal';
import type { ColumnDef } from '@tanstack/react-table';
import type { PurchaseOrder, Supplier, PurchaseOrderStatus, SupplierBill } from '../../types/domain';
import type { Medicine } from '../../lib/mock-data/medicines';

interface CreatePOItemRow {
  medicineId: string;
  orderedQuantity: number;
  unitCost: number;
}

interface PurchaseOrdersTabProps {
  initialMedicineId?: string;
}

export function PurchaseOrdersTab({ initialMedicineId }: PurchaseOrdersTabProps = {}) {
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // Drawers & Dialogs
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerMode, setDrawerMode] = useState<'create' | 'view' | 'edit'>('create');
  const [selectedOrder, setSelectedOrder] = useState<PurchaseOrder | null>(null);

  // Receive modal
  const [receiveTargetOrder, setReceiveTargetOrder] = useState<PurchaseOrder | null>(null);

  // Unified Supplier Bill & Payment Modal
  const [billPaymentPO, setBillPaymentPO] = useState<PurchaseOrder | null>(null);
  const [newBillInvoiceNumber, setNewBillInvoiceNumber] = useState('');
  const [newBillDate, setNewBillDate] = useState(new Date().toISOString().split('T')[0]);
  const [newBillAmount, setNewBillAmount] = useState<number | ''>('');
  const [newBillNotes, setNewBillNotes] = useState('');
  const [newBillImageUrl, setNewBillImageUrl] = useState<string | null>(null);
  const [newBillImageName, setNewBillImageName] = useState<string>('');
  const [previewBillImage, setPreviewBillImage] = useState<string | null>(null);
  const [isSavingBillPayment, setIsSavingBillPayment] = useState(false);

  // Payment section inside unified modal
  const [recordPaymentNow, setRecordPaymentNow] = useState(true);
  const [payAmount, setPayAmount] = useState<number | ''>('');
  const [payMethod, setPayMethod] = useState<'Cash' | 'Bank Transfer' | 'UPI'>('Bank Transfer');
  const [payDate, setPayDate] = useState(new Date().toISOString().split('T')[0]);
  const [payNotes, setPayNotes] = useState('');

  // Selected existing bill to pay if PO already has bills
  const [selectedBillToPay, setSelectedBillToPay] = useState<string>('new');

  // Supplier Bill / Payment Modals (Phase C)
  const [paymentTargetBill, setPaymentTargetBill] = useState<SupplierBill | null>(null);
  const [viewPaymentsBill, setViewPaymentsBill] = useState<SupplierBill | null>(null);

  // Action confirmation modals
  const [confirmStatusAction, setConfirmStatusAction] = useState<{
    po: PurchaseOrder;
    targetStatus: 'Ordered' | 'Cancelled';
  } | null>(null);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

  // Create / Edit PO form state
  const [poSupplierId, setPoSupplierId] = useState('');
  const [poOrderDate, setPoOrderDate] = useState(new Date().toISOString().split('T')[0]);
  const [poNotes, setPoNotes] = useState('');
  const [poItems, setPoItems] = useState<CreatePOItemRow[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  const fetchOrders = useCallback(async () => {
    setIsLoading(true);
    try {
      const query = new URLSearchParams();
      if (statusFilter && statusFilter !== 'all') query.set('status', statusFilter);
      if (search) query.set('search', search);

      const res = await api.get<PurchaseOrder[]>(`/api/purchase-orders?${query.toString()}`);
      setOrders(Array.isArray(res) ? res : (res as any).data || []);
    } catch (err: any) {
      console.error('Failed to load POs:', err);
      toast.error(err.response?.data?.error || 'Failed to load purchase orders');
    } finally {
      setIsLoading(false);
    }
  }, [search, statusFilter]);

  const loadDependencies = async () => {
    try {
      const [supRes, medRes] = await Promise.all([
        api.get<Supplier[]>('/api/suppliers?status=Active'),
        api.get<any>('/api/inventory?limit=200')
      ]);
      setSuppliers(Array.isArray(supRes) ? supRes : (supRes as any).data || []);
      const meds = (medRes as any).data || (Array.isArray(medRes) ? medRes : []);
      setMedicines(meds);
    } catch (err) {
      console.error('Failed to load active suppliers / medicines', err);
    }
  };

  useEffect(() => {
    fetchOrders();
    loadDependencies();
  }, [fetchOrders]);

  // Preselect medicine and open PO creation drawer if initialMedicineId is provided
  useEffect(() => {
    if (initialMedicineId) {
      loadDependencies();
      setSelectedOrder(null);
      setPoSupplierId('');
      setPoOrderDate(new Date().toISOString().split('T')[0]);
      setPoNotes('Urgent low stock reorder');
      setPoItems([{ medicineId: initialMedicineId, orderedQuantity: 50, unitCost: 0 }]);
      setDrawerMode('create');
      setDrawerOpen(true);
    }
  }, [initialMedicineId]);

  const openCreateDrawer = () => {
    loadDependencies();
    setSelectedOrder(null);
    setPoSupplierId('');
    setPoOrderDate(new Date().toISOString().split('T')[0]);
    setPoNotes('');
    setPoItems([{ medicineId: '', orderedQuantity: 50, unitCost: 0 }]);
    setDrawerMode('create');
    setDrawerOpen(true);
  };

  const openViewDrawer = (po: PurchaseOrder) => {
    setSelectedOrder(po);
    setDrawerMode('view');
    setDrawerOpen(true);
  };

  const openEditDrawer = (po: PurchaseOrder) => {
    loadDependencies();
    setSelectedOrder(po);
    setPoSupplierId(po.supplierId);
    setPoOrderDate(new Date(po.orderDate).toISOString().split('T')[0]);
    setPoNotes(po.notes || '');
    setPoItems(
      po.items.map((i) => ({
        medicineId: i.medicineId,
        orderedQuantity: i.orderedQuantity,
        unitCost: i.unitCost || 0
      }))
    );
    setDrawerMode('edit');
    setDrawerOpen(true);
  };

  const openBillPaymentModal = (po: PurchaseOrder) => {
    setBillPaymentPO(po);
    // Calculate total cost of received goods
    const receivedCost = po.items.reduce((s, i) => s + (i.receivedQuantity * (i.unitCost || 0)), 0);

    // Check existing unpaid bill
    const unpaidBill = po.bills?.find((b) => b.status !== 'Paid' && b.status !== 'Cancelled');
    if (unpaidBill) {
      setSelectedBillToPay(unpaidBill.id);
      const totalPaid = unpaidBill.payments
        ? unpaidBill.payments.reduce((s, p) => s + p.amount, 0)
        : (unpaidBill.totalPaid || 0);
      const balance = Math.max(0, Math.round((unpaidBill.amount - totalPaid) * 100) / 100);
      setPayAmount(balance > 0 ? balance : '');
    } else {
      setSelectedBillToPay('new');
      setPayAmount(receivedCost > 0 ? receivedCost : '');
    }

    setNewBillInvoiceNumber('');
    setNewBillDate(new Date().toISOString().split('T')[0]);
    setNewBillAmount(receivedCost > 0 ? receivedCost : '');
    setNewBillNotes('');
    setNewBillImageUrl(null);
    setNewBillImageName('');
    setRecordPaymentNow(true);
    setPayMethod('Bank Transfer');
    setPayDate(new Date().toISOString().split('T')[0]);
    setPayNotes('');
  };

  const handleAddItemRow = () => {
    setPoItems((prev) => [...prev, { medicineId: '', orderedQuantity: 50, unitCost: 0 }]);
  };

  const handleRemoveItemRow = (idx: number) => {
    setPoItems((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleItemChange = (idx: number, field: keyof CreatePOItemRow, val: any) => {
    setPoItems((prev) => {
      const copy = [...prev];
      copy[idx] = { ...copy[idx], [field]: val };
      // Auto-populate unitCost from medicine unitPrice if available
      if (field === 'medicineId') {
        const med = medicines.find((m) => m.id === val);
        if (med && med.unitPrice) {
          copy[idx].unitCost = med.unitPrice;
        }
      }
      return copy;
    });
  };

  const handleSavePO = async () => {
    if (!poSupplierId) {
      toast.error('Please select an active supplier');
      return;
    }
    if (poItems.length === 0) {
      toast.error('Please add at least one medicine item');
      return;
    }

    for (const item of poItems) {
      if (!item.medicineId) {
        toast.error('Please select a medicine for all item rows');
        return;
      }
      if (!item.orderedQuantity || item.orderedQuantity <= 0) {
        toast.error('Ordered quantity must be greater than 0');
        return;
      }
    }

    setIsSaving(true);
    try {
      const payload = {
        supplierId: poSupplierId,
        orderDate: poOrderDate,
        notes: poNotes,
        items: poItems
      };

      if (drawerMode === 'create') {
        await api.post('/api/purchase-orders', payload);
        toast.success('Purchase Order created as Draft');
      } else if (drawerMode === 'edit' && selectedOrder) {
        await api.put(`/api/purchase-orders/${selectedOrder.id}`, payload);
        toast.success('Purchase Order updated successfully');
      }

      setDrawerOpen(false);
      fetchOrders();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to save purchase order');
    } finally {
      setIsSaving(false);
    }
  };

  const handleConfirmStatusTransition = async () => {
    if (!confirmStatusAction) return;
    setIsUpdatingStatus(true);
    const { po, targetStatus } = confirmStatusAction;

    try {
      await api.patch(`/api/purchase-orders/${po.id}/status`, { status: targetStatus });
      toast.success(
        targetStatus === 'Ordered'
          ? `PO ${po.orderNumber} placed successfully`
          : `PO ${po.orderNumber} has been cancelled`
      );
      setConfirmStatusAction(null);
      fetchOrders();
    } catch (err: any) {
      toast.error(err.response?.data?.error || `Failed to transition PO to ${targetStatus}`);
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const getStatusBadge = (status: PurchaseOrderStatus) => {
    switch (status) {
      case 'Draft':
        return <Badge variant="outline" className="bg-slate-100 text-slate-700 hover:bg-slate-100">Draft</Badge>;
      case 'Ordered':
        return <Badge className="bg-sky-100 text-sky-800 hover:bg-sky-100 border-sky-200">Waiting for Receive</Badge>;
      case 'Partially Received':
        return <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100 border-amber-200">Partially Collected</Badge>;
      case 'Received':
        return <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100 border-emerald-200">Collected</Badge>;
      case 'Cancelled':
        return <Badge className="bg-slate-100 text-slate-500 hover:bg-slate-100">Cancelled</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  // Helper to determine if all bills for a PO are paid
  const isPOFullyPaid = (po: PurchaseOrder): boolean => {
    const activeBills = (po.bills || []).filter((b) => b.status !== 'Cancelled');
    if (activeBills.length === 0) return false;
    return activeBills.every((b) => {
      const totalPaid = b.payments
        ? b.payments.reduce((s, p) => s + (Number(p.amount) || 0), 0)
        : (Number(b.totalPaid) || 0);
      const bAmt = Number(b.amount) || 0;
      return b.status === 'Paid' || totalPaid >= bAmt;
    });
  };

  const hasAnyUnpaidBill = (po: PurchaseOrder): boolean => {
    const activeBills = (po.bills || []).filter((b) => b.status !== 'Cancelled');
    return activeBills.some((b) => {
      const totalPaid = b.payments
        ? b.payments.reduce((s, p) => s + (Number(p.amount) || 0), 0)
        : (Number(b.totalPaid) || 0);
      const bAmt = Number(b.amount) || 0;
      return b.status !== 'Paid' && totalPaid < bAmt;
    });
  };

  // Compute a single most-specific badge for the PO status column
  const getPOStatusCell = (po: PurchaseOrder) => {
    if (po.status === 'Received' || po.status === 'Partially Received') {
      if (isPOFullyPaid(po)) {
        return <Badge className="bg-teal-100 text-teal-800 hover:bg-teal-100 border-teal-200">Paid</Badge>;
      }
      if (hasAnyUnpaidBill(po)) {
        return <Badge className="bg-orange-100 text-orange-800 hover:bg-orange-100 border-orange-200">Payment Pending</Badge>;
      }
    }
    return getStatusBadge(po.status);
  };

  const columns: ColumnDef<PurchaseOrder>[] = [
    {
      accessorKey: 'orderNumber',
      header: 'PO Number',
      cell: ({ row }) => (
        <span className="font-bold text-slate-900 font-mono text-xs">
          {row.original.orderNumber}
        </span>
      )
    },
    {
      accessorKey: 'supplier',
      header: 'Supplier',
      cell: ({ row }) => (
        <span className="font-semibold text-slate-800 text-sm">
          {row.original.supplier?.name || '—'}
        </span>
      )
    },
    {
      accessorKey: 'orderDate',
      header: 'Order Date',
      cell: ({ row }) => (
        <span className="text-slate-600 text-xs font-mono">
          {new Date(row.original.orderDate).toLocaleDateString()}
        </span>
      )
    },
    {
      id: 'itemCount',
      header: 'Items',
      cell: ({ row }) => {
        const count = row.original.items?.length || 0;
        return (
          <span className="text-slate-700 text-xs font-medium">
            {count} {count === 1 ? 'item' : 'items'}
          </span>
        );
      }
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => getPOStatusCell(row.original)
    },
    {
      id: 'actions',
      header: () => <div className="text-right">Actions</div>,
      cell: ({ row }) => {
        const po = row.original;
        return (
          <div className="flex items-center justify-end gap-1.5">
            {/* View PO */}
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8 text-slate-600 hover:bg-slate-100"
              title="View PO Details"
              onClick={() => openViewDrawer(po)}
            >
              <Eye className="w-4 h-4" />
            </Button>

            {/* Draft Actions: Edit, Place Order, Cancel */}
            {po.status === 'Draft' && (
              <>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8 text-indigo-600 hover:bg-indigo-50"
                  title="Edit Draft PO"
                  onClick={() => openEditDrawer(po)}
                >
                  <Edit2 className="w-4 h-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8 text-sky-600 hover:bg-sky-50"
                  title="Place Order (Draft → Ordered)"
                  onClick={() => setConfirmStatusAction({ po, targetStatus: 'Ordered' })}
                >
                  <Send className="w-4 h-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8 text-rose-500 hover:bg-rose-50"
                  title="Cancel Draft PO"
                  onClick={() => setConfirmStatusAction({ po, targetStatus: 'Cancelled' })}
                >
                  <XCircle className="w-4 h-4" />
                </Button>
              </>
            )}

            {/* Ordered Actions: Receive / Collect Goods, Cancel */}
            {po.status === 'Ordered' && (
              <>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                  title="Receive / Collect Goods"
                  onClick={() => setReceiveTargetOrder(po)}
                >
                  <Receipt className="w-4 h-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8 text-rose-500 hover:bg-rose-50"
                  title="Cancel Ordered PO"
                  onClick={() => setConfirmStatusAction({ po, targetStatus: 'Cancelled' })}
                >
                  <XCircle className="w-4 h-4" />
                </Button>
              </>
            )}

            {/* Partially Received Action: Receive Remaining Goods, Bill & Payment */}
            {po.status === 'Partially Received' && (
              <>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8 text-amber-600 hover:text-amber-700 hover:bg-amber-50"
                  title="Receive / Collect Remaining Goods"
                  onClick={() => setReceiveTargetOrder(po)}
                >
                  <Receipt className="w-4 h-4" />
                </Button>
                {!isPOFullyPaid(po) && (
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 text-teal-600 hover:text-teal-700 hover:bg-teal-50"
                    title="Bill & Payment"
                    onClick={() => openBillPaymentModal(po)}
                  >
                    <HandCoins className="w-4 h-4" />
                  </Button>
                )}
              </>
            )}

            {/* Collected (Received) Action: Bill & Payment — only if not yet fully paid */}
            {po.status === 'Received' && !isPOFullyPaid(po) && (
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8 text-teal-600 hover:text-teal-700 hover:bg-teal-50"
                title="Bill & Payment"
                onClick={() => openBillPaymentModal(po)}
              >
                <HandCoins className="w-4 h-4" />
              </Button>
            )}
          </div>
        );
      }
    }
  ];

  return (
    <div className="space-y-4">
      <DataTableToolbar
        searchQuery={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search POs..."
        actionSlot={
          <Button onClick={openCreateDrawer} className="bg-teal-600 hover:bg-teal-700 shadow-sm text-white font-medium text-xs h-9">
            <Plus className="w-4 h-4 mr-1.5" /> Create Purchase Order
          </Button>
        }
        exportOptions={{
          pdf: true,
          excel: true,
          csv: true,
          onExport: (format) => {
            const query = new URLSearchParams({
              format,
              ...(search ? { search } : {}),
              ...(statusFilter && statusFilter !== 'all' ? { status: statusFilter } : {})
            }).toString();
            api.download(`/api/purchase-orders/export?${query}`, `purchase_orders_export.${format === 'xlsx' ? 'xlsx' : format}`);
          }
        }}
        filterSlot={
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px] h-9 bg-slate-50/50 text-xs font-medium">
              <SelectValue placeholder="All Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="Draft">Draft</SelectItem>
              <SelectItem value="Ordered">Waiting for Receive</SelectItem>
              <SelectItem value="Partially Received">Partially Collected</SelectItem>
              <SelectItem value="Received">Collected</SelectItem>
              <SelectItem value="Cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
        }
      />

      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <DataTable
          columns={columns}
          data={orders}
          loading={isLoading}
          emptyState={
            <DataTableEmpty
              icon={ShoppingCart}
              title="No purchase orders found"
              description="Create a purchase order to request stock from approved suppliers."
              action={
                <Button onClick={openCreateDrawer} size="sm" className="mt-2">
                  <Plus className="w-4 h-4 mr-1.5" /> Create Purchase Order
                </Button>
              }
            />
          }
        />
      </div>

      {/* Receive Goods Dialog */}
      <ReceiveGoodsDialog
        open={!!receiveTargetOrder}
        onOpenChange={(open) => !open && setReceiveTargetOrder(null)}
        purchaseOrder={receiveTargetOrder}
        onSuccess={() => {
          fetchOrders();
        }}
      />

      {/* Create / Edit / View PO Drawer */}
      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetContent side="right" size="lg" className="sm:max-w-xl bg-white border-l shadow-2xl p-0 flex flex-col">
          <div className="px-6 py-5 border-b bg-slate-50/60">
            <h3 className="text-lg font-bold text-slate-900">
              {drawerMode === 'create'
                ? 'Create Purchase Order'
                : drawerMode === 'edit'
                  ? `Edit ${selectedOrder?.orderNumber}`
                  : `Purchase Order: ${selectedOrder?.orderNumber}`}
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {drawerMode === 'create' || drawerMode === 'edit'
                ? 'Creating or editing a PO does NOT increase stock. Stock increases upon delivery reception.'
                : `Order Date: ${selectedOrder ? new Date(selectedOrder.orderDate).toLocaleDateString() : ''}`}
            </p>
          </div>

          <SheetScrollArea className="p-6 flex-1">
            <div className="space-y-6">
              {drawerMode === 'view' && selectedOrder ? (
                <>
                  <DrawerSection title="Header Details">
                    <div className="grid grid-cols-2 gap-4">
                      <ReadOnlyField label="PO Number" value={selectedOrder.orderNumber} isMono />
                      <div className="space-y-1">
                        <Label className="text-xs text-slate-500">Status</Label>
                        <div>{getStatusBadge(selectedOrder.status)}</div>
                      </div>
                      <ReadOnlyField label="Supplier" value={selectedOrder.supplier?.name || '—'} />
                      <ReadOnlyField
                        label="Order Date"
                        value={new Date(selectedOrder.orderDate).toLocaleDateString()}
                      />
                      {selectedOrder.notes && (
                        <div className="col-span-2">
                          <ReadOnlyField label="Notes" value={selectedOrder.notes} />
                        </div>
                      )}
                    </div>
                  </DrawerSection>

                  <DrawerSection title="Order Line Items">
                    <div className="border border-slate-200 rounded-xl overflow-hidden text-xs">
                      <table className="w-full text-left">
                        <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                          <tr>
                            <th className="py-2.5 px-3">Medicine</th>
                            <th className="py-2.5 px-3 text-center">Ordered</th>
                            <th className="py-2.5 px-3 text-center">Received</th>
                            <th className="py-2.5 px-3 text-center">Remaining</th>
                            <th className="py-2.5 px-3 text-right">Unit Cost</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {selectedOrder.items?.map((item) => {
                            const rem = item.orderedQuantity - item.receivedQuantity;
                            return (
                              <tr key={item.id} className="hover:bg-slate-50/50">
                                <td className="py-2 px-3 font-semibold text-slate-800">
                                  {item.medicine?.name || 'Medicine'}
                                </td>
                                <td className="py-2 px-3 text-center font-medium text-slate-700">
                                  {item.orderedQuantity}
                                </td>
                                <td className="py-2 px-3 text-center font-bold text-emerald-700">
                                  {item.receivedQuantity}
                                </td>
                                <td className="py-2 px-3 text-center font-bold text-amber-700">
                                  {rem}
                                </td>
                                <td className="py-2 px-3 text-right text-slate-600 font-mono">
                                  ₹{item.unitCost.toFixed(2)}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </DrawerSection>

                  {/* Supplier Bills & Invoices Section (Phase C) */}
                  <DrawerSection title="Supplier Bills & Payments">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-slate-500">
                          Invoices and payments recorded against this Purchase Order.
                        </span>
                        {['Partially Received', 'Received'].includes(selectedOrder.status) && !isPOFullyPaid(selectedOrder) && (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs font-semibold text-teal-700 bg-teal-50 border-teal-200 hover:bg-teal-100"
                            onClick={() => openBillPaymentModal(selectedOrder)}
                          >
                            + Bill & Payment
                          </Button>
                        )}
                      </div>

                      {(!selectedOrder.bills || selectedOrder.bills.length === 0) ? (
                        <div className="p-4 border border-dashed border-slate-200 rounded-xl text-center text-xs text-slate-400 bg-slate-50/50">
                          No supplier bills captured yet for this purchase order.
                        </div>
                      ) : (
                        <div className="border border-slate-200 rounded-xl overflow-hidden text-xs">
                          <table className="w-full text-left">
                            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                              <tr>
                                <th className="py-2.5 px-3">Invoice #</th>
                                <th className="py-2.5 px-3">Date</th>
                                <th className="py-2.5 px-3 text-right">Bill Amount</th>
                                <th className="py-2.5 px-3 text-right">Paid</th>
                                <th className="py-2.5 px-3 text-right">Balance</th>
                                <th className="py-2.5 px-3 text-center">Status</th>

                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {selectedOrder.bills.map((bill) => {
                                const totalPaid = bill.payments ? bill.payments.reduce((s, p) => s + p.amount, 0) : (bill.totalPaid || 0);
                                const balance = Math.max(0, Math.round((bill.amount - totalPaid) * 100) / 100);

                                return (
                                  <tr key={bill.id} className="hover:bg-slate-50/50">
                                    <td className="py-2.5 px-3 font-mono font-bold text-slate-900">
                                      {bill.invoiceNumber}
                                    </td>
                                    <td className="py-2.5 px-3 text-slate-600">
                                      {new Date(bill.invoiceDate).toLocaleDateString()}
                                    </td>
                                    <td className="py-2.5 px-3 text-right font-mono font-semibold text-slate-800">
                                      ₹{bill.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                    </td>
                                    <td className="py-2.5 px-3 text-right font-mono font-semibold text-emerald-700">
                                      ₹{totalPaid.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                    </td>
                                    <td className="py-2.5 px-3 text-right font-mono font-bold text-amber-700">
                                      ₹{balance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                    </td>
                                    <td className="py-2.5 px-3 text-center">
                                      <Badge
                                        variant="outline"
                                        className={`text-[10px] font-bold ${bill.status === 'Paid'
                                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                            : bill.status === 'Partial'
                                              ? 'bg-amber-50 text-amber-700 border-amber-200'
                                              : bill.status === 'Cancelled'
                                                ? 'bg-slate-100 text-slate-500'
                                                : 'bg-rose-50 text-rose-700 border-rose-200'
                                          }`}
                                      >
                                        {bill.status}
                                      </Badge>
                                    </td>

                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  </DrawerSection>
                </>
              ) : (
                <>
                  {/* Create / Edit Form */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold text-slate-600 uppercase">
                        Supplier <span className="text-rose-500">*</span>
                      </Label>
                      <Select value={poSupplierId} onValueChange={setPoSupplierId}>
                        <SelectTrigger className="h-10 text-sm">
                          <SelectValue placeholder="Select active supplier" />
                        </SelectTrigger>
                        <SelectContent>
                          {suppliers.map((s) => (
                            <SelectItem key={s.id} value={s.id}>
                              {s.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold text-slate-600 uppercase">
                        Order Date <span className="text-rose-500">*</span>
                      </Label>
                      <Input
                        type="date"
                        value={poOrderDate}
                        onChange={(e) => setPoOrderDate(e.target.value)}
                        className="h-10 text-sm font-mono"
                      />
                    </div>

                    <div className="col-span-1 sm:col-span-2 space-y-1.5">
                      <Label className="text-xs font-semibold text-slate-600 uppercase">Notes</Label>
                      <Input
                        value={poNotes}
                        onChange={(e) => setPoNotes(e.target.value)}
                        placeholder="Optional remarks or delivery instructions"
                        className="h-10 text-sm"
                      />
                    </div>
                  </div>

                  {/* Line items table */}
                  <div className="space-y-3 pt-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                        Ordered Medicines ({poItems.length})
                      </Label>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleAddItemRow}
                        className="h-8 px-2.5 text-xs text-teal-700 hover:text-teal-800 hover:bg-teal-50"
                      >
                        <Plus className="w-3.5 h-3.5 mr-1" /> Add Row
                      </Button>
                    </div>

                    <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                          <tr>
                            <th className="py-2 px-3">Medicine</th>
                            <th className="py-2 px-3 w-28 text-center">Ordered Qty</th>
                            <th className="py-2 px-3 w-28 text-right">Unit Cost (₹)</th>
                            <th className="py-2 px-2 w-10 text-center"></th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {poItems.map((item, idx) => (
                            <tr key={idx}>
                              <td className="p-2">
                                <Select
                                  value={item.medicineId}
                                  onValueChange={(val) => handleItemChange(idx, 'medicineId', val)}
                                >
                                  <SelectTrigger className="h-8 text-xs">
                                    <SelectValue placeholder="Select medicine" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {medicines.filter(m => m.status !== 'Inactive').map((m) => (
                                      <SelectItem key={m.id} value={m.id}>
                                        {m.name} ({m.unit})
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </td>
                              <td className="p-2">
                                <Input
                                  type="number"
                                  min="1"
                                  value={item.orderedQuantity}
                                  onChange={(e) =>
                                    handleItemChange(idx, 'orderedQuantity', parseInt(e.target.value, 10) || 0)
                                  }
                                  className="h-8 text-center text-xs font-bold"
                                />
                              </td>
                              <td className="p-2">
                                <Input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  value={item.unitCost}
                                  onChange={(e) =>
                                    handleItemChange(idx, 'unitCost', parseFloat(e.target.value) || 0)
                                  }
                                  className="h-8 text-right text-xs font-mono"
                                />
                              </td>
                              <td className="p-2 text-center">
                                {poItems.length > 1 && (
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-7 w-7 text-rose-500 hover:bg-rose-50"
                                    onClick={() => handleRemoveItemRow(idx)}
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </Button>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              )}
            </div>
          </SheetScrollArea>

          <DrawerFooterActions>
            {drawerMode === 'view' ? (
              <div className="flex items-center justify-between w-full">
                <Button variant="outline" onClick={() => setDrawerOpen(false)}>
                  Close
                </Button>
                {selectedOrder && (selectedOrder.status === 'Ordered' || selectedOrder.status === 'Partially Received') && (
                  <Button
                    onClick={() => {
                      const po = selectedOrder;
                      setDrawerOpen(false);
                      setReceiveTargetOrder(po);
                    }}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold shadow-xs"
                  >
                    <Receipt className="w-4 h-4 mr-1.5" /> Collect Goods
                  </Button>
                )}
                {selectedOrder && selectedOrder.status === 'Draft' && (
                  <Button
                    onClick={() => {
                      setDrawerMode('edit');
                    }}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold shadow-xs"
                  >
                    <Edit2 className="w-4 h-4 mr-1.5" /> Edit Draft
                  </Button>
                )}
              </div>
            ) : (
              <>
                <Button variant="outline" onClick={() => setDrawerOpen(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={handleSavePO}
                  disabled={isSaving}
                  className="bg-teal-600 hover:bg-teal-700 text-white font-medium"
                >
                  {isSaving ? 'Saving...' : drawerMode === 'create' ? 'Save as Draft' : 'Update PO'}
                </Button>
              </>
            )}
          </DrawerFooterActions>
        </SheetContent>
      </Sheet>

      {/* Status Transition Confirmation Modal (Ordered or Cancelled) */}
      <Dialog open={!!confirmStatusAction} onOpenChange={(open) => !open && setConfirmStatusAction(null)}>
        <DialogContent className="sm:max-w-[420px] bg-white rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-slate-900">
              {confirmStatusAction?.targetStatus === 'Ordered' ? 'Place Purchase Order?' : 'Cancel Purchase Order?'}
            </DialogTitle>
            <DialogDescription className="text-sm text-slate-500 pt-2 leading-relaxed">
              {confirmStatusAction?.targetStatus === 'Ordered' ? (
                <>
                  Placing <strong className="text-slate-800">{confirmStatusAction.po.orderNumber}</strong> marks it as ordered from the supplier.
                  <br /><br />
                  Note: Medicine stock will NOT increase until goods are physically received.
                </>
              ) : (
                <>
                  Are you sure you want to cancel <strong className="text-slate-800">{confirmStatusAction?.po.orderNumber}</strong>?
                  <br /><br />
                  This action cannot be undone. Historical records will remain.
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0 pt-3">
            <DialogClose asChild>
              <Button variant="outline" disabled={isUpdatingStatus}>
                Back
              </Button>
            </DialogClose>
            <Button
              onClick={handleConfirmStatusTransition}
              disabled={isUpdatingStatus}
              className={
                confirmStatusAction?.targetStatus === 'Ordered'
                  ? 'bg-sky-600 hover:bg-sky-700 text-white font-semibold'
                  : 'bg-rose-600 hover:bg-rose-700 text-white font-semibold'
              }
            >
              {isUpdatingStatus ? 'Updating...' : confirmStatusAction?.targetStatus === 'Ordered' ? 'Yes, Place Order' : 'Yes, Cancel PO'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Record Supplier Payment Dialog */}
      <RecordSupplierPaymentDialog
        open={!!paymentTargetBill}
        onOpenChange={(open) => !open && setPaymentTargetBill(null)}
        bill={paymentTargetBill}
        onSuccess={() => {
          fetchOrders();
          if (selectedOrder) {
            api.get<PurchaseOrder>(`/api/purchase-orders/${selectedOrder.id}`).then((po) => {
              setSelectedOrder(po);
            }).catch(console.error);
          }
        }}
      />

      {/* View Payments Ledger Modal */}
      <SupplierBillPaymentsModal
        open={!!viewPaymentsBill}
        onOpenChange={(open) => !open && setViewPaymentsBill(null)}
        bill={viewPaymentsBill}
      />

      {/* Unified Supplier Bill & Payment Modal */}
      <Dialog open={!!billPaymentPO} onOpenChange={(open) => !open && setBillPaymentPO(null)}>
        <DialogContent className="sm:max-w-[560px] bg-white rounded-2xl p-6 shadow-2xl max-h-[92vh] overflow-y-auto">
          <DialogHeader className="mb-2">
            <DialogTitle className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <HandCoins className="w-5 h-5 text-teal-600" />
              Supplier Bill & Payment
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500 pt-0.5">
              Manage invoice and payment for PO <strong className="text-slate-800 font-mono">{billPaymentPO?.orderNumber}</strong> ({billPaymentPO?.supplier?.name})
            </DialogDescription>
          </DialogHeader>

          {/* If the PO already has bills, provide a selector: pay existing bill vs add new bill */}
          {billPaymentPO?.bills && billPaymentPO.bills.length > 0 && (
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-2 text-xs mb-2">
              <div className="font-semibold text-slate-800">Existing Bills for this PO:</div>
              <div className="space-y-1.5">
                {billPaymentPO.bills.map((b) => {
                  const bPaid = b.payments ? b.payments.reduce((s, p) => s + p.amount, 0) : (b.totalPaid || 0);
                  const bBal = Math.max(0, Math.round((b.amount - bPaid) * 100) / 100);
                  const isSelected = selectedBillToPay === b.id;
                  return (
                    <div
                      key={b.id}
                      onClick={() => {
                        setSelectedBillToPay(b.id);
                        setPayAmount(bBal > 0 ? bBal : '');
                        setRecordPaymentNow(true);
                      }}
                      className={`flex items-center justify-between p-2.5 rounded-lg border cursor-pointer transition-colors ${isSelected
                          ? 'border-teal-500 bg-teal-50/60 ring-1 ring-teal-500/20'
                          : 'border-slate-200 bg-white hover:border-slate-300'
                        }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <input
                          type="radio"
                          name="billSelection"
                          checked={isSelected}
                          onChange={() => { }}
                          className="accent-teal-600"
                        />
                        <span className="font-mono font-bold text-slate-900">{b.invoiceNumber}</span>
                        <span className="text-slate-500">({new Date(b.invoiceDate).toLocaleDateString()})</span>
                      </div>
                      <div className="flex items-center gap-2 text-right">
                        <span className="font-mono text-slate-600">₹{b.amount.toLocaleString()}</span>
                        <Badge
                          variant="outline"
                          className={`text-[10px] ${b.status === 'Paid'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : 'bg-amber-50 text-amber-700 border-amber-200'
                            }`}
                        >
                          Bal: ₹{bBal.toLocaleString()}
                        </Badge>
                      </div>
                    </div>
                  );
                })}

                {!isPOFullyPaid(billPaymentPO) && (
                  <div
                    onClick={() => {
                      setSelectedBillToPay('new');
                      const recTotal = billPaymentPO.items.reduce((s, i) => s + (i.receivedQuantity * (i.unitCost || 0)), 0);
                      setNewBillAmount(recTotal > 0 ? recTotal : '');
                      setPayAmount(recTotal > 0 ? recTotal : '');
                    }}
                    className={`flex items-center gap-2 p-2.5 rounded-lg border cursor-pointer transition-colors ${selectedBillToPay === 'new'
                        ? 'border-teal-500 bg-teal-50/60 ring-1 ring-teal-500/20'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                      }`}
                  >
                    <input
                      type="radio"
                      name="billSelection"
                      checked={selectedBillToPay === 'new'}
                      onChange={() => { }}
                      className="accent-teal-600"
                    />
                    <span className="font-semibold text-teal-800">+ Add Another / New Supplier Bill</span>
                  </div>
                )}
              </div>
            </div>
          )}

          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (!billPaymentPO) return;

              setIsSavingBillPayment(true);
              try {
                let targetBillId: string | null = null;

                // 1. If adding a new bill
                if (selectedBillToPay === 'new') {
                  if (!newBillInvoiceNumber.trim()) {
                    toast.error('Invoice number is required');
                    setIsSavingBillPayment(false);
                    return;
                  }
                  const bAmtNum = typeof newBillAmount === 'number' ? newBillAmount : parseFloat(String(newBillAmount));
                  if (isNaN(bAmtNum) || bAmtNum <= 0) {
                    toast.error('Bill amount must be greater than 0');
                    setIsSavingBillPayment(false);
                    return;
                  }

                  const billRes = await api.post<any>('/api/supplier-bills', {
                    supplierId: billPaymentPO.supplierId,
                    purchaseOrderId: billPaymentPO.id,
                    invoiceNumber: newBillInvoiceNumber.trim(),
                    invoiceDate: newBillDate,
                    amount: bAmtNum,
                    billImageUrl: newBillImageUrl || undefined,
                    notes: newBillNotes.trim() || undefined
                  });

                  targetBillId = billRes?.bill?.id || (billRes as any)?.data?.id || (billRes as any)?.id;
                } else {
                  targetBillId = selectedBillToPay;
                }

                // 2. If recording payment
                if (recordPaymentNow && targetBillId) {
                  const payNum = typeof payAmount === 'number' ? payAmount : parseFloat(String(payAmount));
                  if (!isNaN(payNum) && payNum > 0) {
                    await api.post(`/api/supplier-bills/${targetBillId}/payments`, {
                      amount: payNum,
                      method: payMethod,
                      date: payDate,
                      notes: payNotes.trim() || undefined
                    });
                    toast.success(selectedBillToPay === 'new' ? 'Bill uploaded and payment recorded successfully' : 'Payment recorded successfully');
                  } else {
                    toast.success('Bill saved successfully (no payment recorded)');
                  }
                } else {
                  toast.success('Supplier bill uploaded successfully');
                }

                setBillPaymentPO(null);
                fetchOrders();
                if (selectedOrder && selectedOrder.id === billPaymentPO.id) {
                  const refreshed = await api.get<PurchaseOrder>(`/api/purchase-orders/${selectedOrder.id}`);
                  setSelectedOrder(refreshed);
                }
              } catch (err: any) {
                toast.error(err.response?.data?.error || err.message || 'Operation failed');
              } finally {
                setIsSavingBillPayment(false);
              }
            }}
            className="space-y-4 pt-1 text-xs"
          >
            {/* Section 1: Bill Upload (visible when selectedBillToPay === 'new') */}
            {selectedBillToPay === 'new' && (
              <div className="space-y-3 p-3.5 bg-slate-50/70 border border-slate-200 rounded-xl">
                <div className="font-bold text-slate-800 text-xs flex items-center gap-1.5 uppercase tracking-wide">
                  <FileText className="w-3.5 h-3.5 text-teal-600" />
                  Bill / Invoice Details
                </div>

                {/* Bill Image Upload Dropzone */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-700">Upload Physical Bill Image</Label>
                  {!newBillImageUrl ? (
                    <label className="border-2 border-dashed border-teal-300 hover:border-teal-500 bg-white rounded-xl p-3 flex flex-col items-center justify-center cursor-pointer transition-colors group">
                      <div className="w-8 h-8 rounded-full bg-teal-50 flex items-center justify-center text-teal-600 group-hover:scale-105 transition-transform mb-1">
                        <Upload className="w-4 h-4" />
                      </div>
                      <span className="text-xs font-semibold text-slate-800">
                        Click to select bill image
                      </span>
                      <span className="text-[11px] text-slate-400">
                        PNG, JPG, JPEG up to 10MB
                      </span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          if (!file.type.startsWith('image/')) {
                            toast.error('Please upload an image file');
                            return;
                          }
                          setNewBillImageName(file.name);
                          const reader = new FileReader();
                          reader.onload = (event) => {
                            const base64 = event.target?.result as string;
                            setNewBillImageUrl(base64);
                            if (!newBillInvoiceNumber.trim()) {
                              const cleanName = file.name.replace(/\.[^/.]+$/, '');
                              setNewBillInvoiceNumber(cleanName.slice(0, 30));
                            }
                          };
                          reader.readAsDataURL(file);
                        }}
                        className="hidden"
                      />
                    </label>
                  ) : (
                    <div className="bg-teal-50/40 border border-teal-200 rounded-xl p-2 flex items-center justify-between">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <img
                          src={newBillImageUrl}
                          alt="Uploaded bill"
                          className="w-10 h-10 object-cover rounded-lg border border-teal-200 shrink-0"
                        />
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-slate-900 truncate">
                            {newBillImageName || 'Supplier Bill'}
                          </div>
                          <div className="text-[11px] text-teal-700 font-medium">Ready for saving</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setPreviewBillImage(newBillImageUrl)}
                          className="h-7 text-xs px-2 text-teal-700"
                        >
                          <Eye className="w-3.5 h-3.5 mr-1" /> Preview
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setNewBillImageUrl(null);
                            setNewBillImageName('');
                          }}
                          className="h-7 w-7 p-0 text-slate-400 hover:text-rose-600"
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  )}
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-slate-700">Invoice / Bill Number <span className="text-rose-500">*</span></Label>
                  <Input
                    type="text"
                    placeholder="e.g. INV-2026-041"
                    value={newBillInvoiceNumber}
                    onChange={(e) => setNewBillInvoiceNumber(e.target.value)}
                    className="h-8 text-xs bg-white"
                    required={selectedBillToPay === 'new'}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold text-slate-700">Invoice Date <span className="text-rose-500">*</span></Label>
                    <Input
                      type="date"
                      value={newBillDate}
                      onChange={(e) => setNewBillDate(e.target.value)}
                      className="h-8 text-xs bg-white"
                      required={selectedBillToPay === 'new'}
                    />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs font-semibold text-slate-700">Bill Amount (₹) <span className="text-rose-500">*</span></Label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0.01"
                      placeholder="0.00"
                      value={newBillAmount}
                      onChange={(e) => {
                        const val = e.target.value === '' ? '' : parseFloat(e.target.value);
                        setNewBillAmount(val);
                        // Also sync payAmount if recordPaymentNow is enabled and was matching
                        if (recordPaymentNow && selectedBillToPay === 'new') {
                          setPayAmount(val);
                        }
                      }}
                      className="h-8 text-xs font-mono font-bold bg-white"
                      required={selectedBillToPay === 'new'}
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-slate-700">Bill Notes</Label>
                  <Input
                    type="text"
                    placeholder="Optional invoice notes or reference"
                    value={newBillNotes}
                    onChange={(e) => setNewBillNotes(e.target.value)}
                    className="h-8 text-xs bg-white"
                  />
                </div>
              </div>
            )}

            {/* Section 2: Payment Details (Integrated in same modal) */}
            <div className="space-y-3 p-3.5 bg-indigo-50/50 border border-indigo-100 rounded-xl">
              <div className="flex items-center justify-between">
                <div className="font-bold text-slate-800 text-xs flex items-center gap-1.5 uppercase tracking-wide">
                  <HandCoins className="w-3.5 h-3.5 text-indigo-600" />
                  Supplier Payment
                </div>
                {selectedBillToPay === 'new' && (
                  <label className="flex items-center gap-1.5 cursor-pointer text-xs font-semibold text-slate-700 select-none">
                    <input
                      type="checkbox"
                      checked={recordPaymentNow}
                      onChange={(e) => setRecordPaymentNow(e.target.checked)}
                      className="rounded text-indigo-600 focus:ring-indigo-500 h-3.5 w-3.5"
                    />
                    Record payment now
                  </label>
                )}
              </div>

              {(recordPaymentNow || selectedBillToPay !== 'new') && (
                <div className="space-y-3 pt-1">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs font-semibold text-slate-700">Payment Amount (₹) <span className="text-rose-500">*</span></Label>
                      <Input
                        type="number"
                        step="0.01"
                        min="0.01"
                        placeholder="0.00"
                        value={payAmount}
                        onChange={(e) => setPayAmount(e.target.value === '' ? '' : parseFloat(e.target.value))}
                        className="h-8 text-xs font-mono font-bold bg-white"
                        required={recordPaymentNow || selectedBillToPay !== 'new'}
                      />
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs font-semibold text-slate-700">Payment Method <span className="text-rose-500">*</span></Label>
                      <Select value={payMethod} onValueChange={(val: any) => setPayMethod(val)}>
                        <SelectTrigger className="h-8 text-xs bg-white">
                          <SelectValue placeholder="Select method" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Bank Transfer">Bank Transfer (NEFT/RTGS/IMPS)</SelectItem>
                          <SelectItem value="UPI">UPI</SelectItem>
                          <SelectItem value="Cash">Cash</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs font-semibold text-slate-700">Payment Date <span className="text-rose-500">*</span></Label>
                      <Input
                        type="date"
                        value={payDate}
                        onChange={(e) => setPayDate(e.target.value)}
                        className="h-8 text-xs bg-white"
                        required={recordPaymentNow || selectedBillToPay !== 'new'}
                      />
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs font-semibold text-slate-700">Reference / Notes</Label>
                      <Input
                        type="text"
                        placeholder="e.g. UTR / Cheque #"
                        value={payNotes}
                        onChange={(e) => setPayNotes(e.target.value)}
                        className="h-8 text-xs bg-white"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            <DialogFooter className="gap-2 sm:gap-0 pt-2">
              <DialogClose asChild>
                <Button type="button" variant="outline" disabled={isSavingBillPayment}>
                  Cancel
                </Button>
              </DialogClose>
              <Button
                type="submit"
                disabled={isSavingBillPayment}
                className="bg-teal-600 hover:bg-teal-700 text-white font-semibold"
              >
                {isSavingBillPayment
                  ? 'Saving...'
                  : selectedBillToPay !== 'new'
                    ? 'Record Payment'
                    : recordPaymentNow
                      ? 'Save Bill & Record Payment'
                      : 'Save Bill Only'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Full Preview Modal for Bill Images */}
      {previewBillImage && (
        <Dialog open={!!previewBillImage} onOpenChange={(open) => !open && setPreviewBillImage(null)}>
          <DialogContent className="sm:max-w-[700px] p-4 bg-white rounded-2xl shadow-2xl">
            <DialogHeader>
              <DialogTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
                <ImageIcon className="w-4 h-4 text-teal-600" />
                Supplier Bill Image Preview
              </DialogTitle>
            </DialogHeader>
            <div className="max-h-[70vh] overflow-auto rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-center p-2">
              <img
                src={previewBillImage}
                alt="Supplier Bill Full Preview"
                className="max-w-full max-h-full object-contain rounded-lg shadow-xs"
              />
            </div>
            <DialogFooter className="pt-2">
              <Button variant="outline" size="sm" onClick={() => setPreviewBillImage(null)}>
                Close Preview
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
