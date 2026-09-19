import { useMemo, useState } from 'react';
import { useClinicContext } from '../context/ClinicContext';
import { useAuth } from '../context/AuthContext';
import { DataTable } from '../components/data-table/data-table';
import { DataTableToolbar } from '../components/data-table/data-table-toolbar';
import type { ColumnDef } from '@tanstack/react-table';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { AlertTriangle, Banknote, CreditCard, Smartphone, CheckCircle, Eye, Receipt, Phone, User } from 'lucide-react';
import { API_BASE_URL, api } from '../lib/api';
import toast from 'react-hot-toast';

export function PartialPaymentAlertsPage() {
  const { currentUser } = useAuth();
  const isReceptionist = currentUser?.role === 'Receptionist';
  const { visits, payments, patients, staff, consultations, recordPayment } = useClinicContext();
  
  const [selectedAlert, setSelectedAlert] = useState<any | null>(null);
  const [viewDetailsAlert, setViewDetailsAlert] = useState<any | null>(null);
  const [paymentAmount, setPaymentAmount] = useState<number | ''>('');
  const [activeMethod, setActiveMethod] = useState<'Cash' | 'GPay' | 'Credit Card' | 'Debit Card'>('Cash');
  const [isProcessing, setIsProcessing] = useState(false);
  const [search, setSearch] = useState('');
  const [overdueFilter, setOverdueFilter] = useState('all');

  const alerts = useMemo(() => {
    let alertData: any[] = [];
    
    // We want to check all visits that aren't cancelled or completed for balances
    const activeVisits = visits.filter(v => 
      v.status !== 'CANCELLED' && 
      v.status !== 'COMPLETED' && 
      (!isReceptionist || v.paymentOwner !== 'DOCTOR')
    );

    for (const v of activeVisits) {
      const vPayments = payments.filter(p => p.visitId === v.id);
      
      if (vPayments.length > 0) {
        const totalPaid = vPayments.reduce((sum, p) => sum + p.amount, 0);
        const calculatedDue = (v.consultationFee || 0) + (v.treatmentFee || 0) + (v.medicineCost || 0);
        const amountDue = calculatedDue > 0 ? calculatedDue : (v.amountDue || 0);
        const balance = amountDue - totalPaid;

        if (balance > 0) {
          // Find the earliest payment to determine when partial payment started
          const earliestPayment = vPayments.reduce((prev, curr) => 
            new Date(prev.createdAt) < new Date(curr.createdAt) ? prev : curr
          );

          const earliestDate = new Date(earliestPayment.createdAt);
          const now = new Date();
          const diffTime = Math.abs(now.getTime() - earliestDate.getTime());
          const daysOutstanding = Math.floor(diffTime / (1000 * 60 * 60 * 24));

          const patient = patients.find(p => p.id === v.patientId);
          const doctor = staff.find(s => s.id === v.doctorId);
          const consultation = consultations.find(c => c.visitId === v.id);

          // Extract reason and alt phone from payments
          const partialPaymentWithNotes = vPayments.find(p => p.notes && (p.notes.includes('Alt Phone') || p.notes.includes('Reason') || p.amount < amountDue));
          let partialReason = 'Not specified';
          let altPhone = 'Not provided';
          if (partialPaymentWithNotes?.notes) {
            const parts = partialPaymentWithNotes.notes.split('|');
            if (parts.length > 0) partialReason = parts[0].trim();
            if (parts.length > 1 && parts[1].includes('Alt Phone:')) {
              altPhone = parts[1].replace('Alt Phone:', '').trim();
            }
          }

          alertData.push({
            visitId: v.id,
            patientId: v.patientId,
            patientName: patient?.name || 'Unknown',
            patientPhone: patient?.phone || '—',
            patientAge: patient?.age,
            patientGender: patient?.gender,
            patientAddress: patient?.address || '—',
            doctorName: doctor?.name || 'Unassigned',
            consultationFee: v.consultationFee || consultation?.consultationFee || 0,
            treatmentFee: v.treatmentFee || 0,
            medicineCost: v.medicineCost || 0,
            reasonForVisit: consultation?.reasonForVisit || v.reasonForVisit || 'General Consultation',
            clinicalNotes: consultation?.clinicalNotes || '',
            totalAmount: amountDue,
            paidAmount: totalPaid,
            balance: balance,
            partialPaymentDate: earliestDate.toLocaleDateString(),
            daysOutstanding: daysOutstanding,
            partialReason,
            altPhone,
            paymentHistory: vPayments
          });
        }
      }
    }
    
    if (overdueFilter === 'overdue') {
      alertData = alertData.filter(d => d.daysOutstanding >= 3);
    } else if (overdueFilter === 'normal') {
      alertData = alertData.filter(d => d.daysOutstanding < 3);
    }

    if (search) {
      const s = search.toLowerCase();
      alertData = alertData.filter(d =>
        d.patientName.toLowerCase().includes(s) ||
        d.doctorName.toLowerCase().includes(s)
      );
    }

    // Sort by days outstanding descending
    return alertData.sort((a, b) => b.daysOutstanding - a.daysOutstanding);
  }, [visits, payments, patients, staff, search, overdueFilter]);

  const handleCollect = async () => {
    if (selectedAlert && isReceptionist) {
      const v = visits.find(vis => vis.id === selectedAlert.visitId);
      if (v?.paymentOwner === 'DOCTOR') {
        toast.error('Payment for this visit is handled by Doctor');
        return;
      }
    }
    if (!selectedAlert || !paymentAmount || paymentAmount <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }
    if (paymentAmount > selectedAlert.balance) {
      toast.error(`Amount cannot exceed the balance of ₹${selectedAlert.balance}`);
      return;
    }

    setIsProcessing(true);
    // Since this is collecting the remaining balance, we will pass true if the balance is fully paid, or they are just paying some more.
    // If they pay less than the full balance, it's just another partial payment. 
    // We leave isFinalPayment as undefined unless they want to close it, but for simplicity, we don't need to force close it unless balance is 0.
    const isFinal = paymentAmount === selectedAlert.balance;

    const result = await recordPayment(
      selectedAlert.visitId,
      Number(paymentAmount),
      activeMethod,
      'Collecting outstanding balance',
      isFinal
    );

    setIsProcessing(false);

    if (result.success) {
      toast.success('Payment collected successfully!');
      setSelectedAlert(null);
      setPaymentAmount('');
    } else {
      toast.error(result.error || 'Failed to collect payment');
    }
  };

  const columns: ColumnDef<any>[] = [
    {
      header: () => <div className="text-center font-semibold text-slate-600">Patient Name</div>,
      accessorKey: 'patientName',
      cell: ({ row }) => <div className="text-center font-medium text-slate-900">{row.original.patientName}</div>
    },
    {
      header: () => <div className="text-center font-semibold text-slate-600">Doctor Name</div>,
      accessorKey: 'doctorName',
      cell: ({ row }) => <div className="text-center text-slate-600">{row.original.doctorName}</div>
    },
    {
      header: () => <div className="text-center font-semibold text-slate-600">Total Amount</div>,
      accessorKey: 'totalAmount',
      cell: ({ row }) => <div className="text-center text-slate-600">₹{row.original.totalAmount}</div>
    },
    {
      header: () => <div className="text-center font-semibold text-slate-600">Paid Amount</div>,
      accessorKey: 'paidAmount',
      cell: ({ row }) => <div className="text-center text-slate-600">₹{row.original.paidAmount}</div>
    },
    {
      header: () => <div className="text-center font-semibold text-slate-600">Balance</div>,
      accessorKey: 'balance',
      cell: ({ row }) => <div className="text-center font-semibold text-rose-600">₹{row.original.balance}</div>
    },
    {
      header: () => <div className="text-center font-semibold text-slate-600">Partial Payment Date</div>,
      accessorKey: 'partialPaymentDate',
      cell: ({ row }) => <div className="text-center text-slate-600">{row.original.partialPaymentDate}</div>
    },
    {
      header: () => <div className="text-center font-semibold text-slate-600">Days Outstanding</div>,
      accessorKey: 'daysOutstanding',
      cell: ({ row }) => {
        const days = row.original.daysOutstanding;
        const isOverdue = days >= 3;
        return (
          <div className="text-center flex justify-center">
            <Badge variant="outline" className={`flex items-center justify-center ${isOverdue ? 'bg-rose-50 text-rose-700 border-rose-200' : 'bg-slate-50 text-slate-700 border-slate-200'}`}>
              {isOverdue && <AlertTriangle className="w-3 h-3 mr-1" />}
              {days} days
            </Badge>
          </div>
        );
      }
    },
    {
      id: "actions",
      header: () => <div className="text-center font-semibold text-slate-600">Action</div>,
      cell: ({ row }) => (
        <div className="flex items-center justify-center gap-2">
          <Button
            size="icon"
            variant="ghost"
            className="w-8 h-8 text-blue-600 hover:bg-blue-50"
            title="View Payment & Partial Payment Details"
            onClick={() => setViewDetailsAlert(row.original)}
          >
            <Eye className="w-4 h-4" />
          </Button>

          <Button 
            size="sm" 
            variant="outline" 
            className="text-teal-700 border-teal-200 hover:bg-teal-50"
            onClick={() => {
              setSelectedAlert(row.original);
              setPaymentAmount(row.original.balance);
            }}
          >
            Collect Payment <CheckCircle className="w-4 h-4 ml-1.5" />
          </Button>
        </div>
      )
    }
  ];

  return (
    <div className="h-full flex flex-col gap-6 max-w-[1400px] mx-auto pb-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Partial Payments</h1>
          <p className="text-slate-500 mt-1">Monitor and follow-up on patients with outstanding balances.</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100/60 shadow-[0_2px_12px_-4px_rgba(15,23,42,0.04)] overflow-hidden flex-1">
        <DataTableToolbar
          searchQuery={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search by patient or doctor name..."
          filterSlot={
            <Select value={overdueFilter} onValueChange={setOverdueFilter}>
              <SelectTrigger className="h-9 w-[170px] bg-slate-50/50 border-slate-200 text-xs font-medium">
                <SelectValue placeholder="All Alerts" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Alerts</SelectItem>
                <SelectItem value="overdue">Overdue (≥ 3 days)</SelectItem>
                <SelectItem value="normal">Normal (&lt; 3 days)</SelectItem>
              </SelectContent>
            </Select>
          }
          exportOptions={{
            pdf: true,
            excel: true,
            csv: true,
            onExport: async (format) => {
              try {
                const query = new URLSearchParams();
                query.set('format', format);
                if (search) query.set('search', search);
                if (overdueFilter && overdueFilter !== 'all') query.set('overdue', overdueFilter);
                const ext = format === 'pdf' ? 'pdf' : format === 'xlsx' ? 'xlsx' : 'csv';
                await api.download(`/api/payments/export-partial?${query.toString()}`, `partial_payments_export.${ext}`);
                toast.success(`Exported ${format.toUpperCase()} successfully`);
              } catch (err: any) {
                toast.error(err.message || 'Failed to export data');
              }
            }
          }}
        />
        <div className="p-4">
          <DataTable 
            columns={columns} 
            data={alerts}
            totalRecords={alerts.length}
          />
        </div>
      </div>

      <Dialog open={!!selectedAlert} onOpenChange={(open) => !open && setSelectedAlert(null)}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="text-xl">Collect Outstanding Balance</DialogTitle>
          </DialogHeader>
          
          {selectedAlert && (
            <div className="space-y-6 pt-4">
              <div className="flex justify-between items-center bg-slate-50 p-4 rounded-xl">
                <span className="text-slate-600 font-medium">Remaining Balance</span>
                <span className="text-2xl font-bold text-slate-900">₹{selectedAlert.balance}</span>
              </div>

              <div className="space-y-3">
                <Label>Payment Amount (₹)</Label>
                <Input
                  type="number"
                  min="1"
                  max={selectedAlert.balance}
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value ? Number(e.target.value) : '')}
                />
              </div>

              <div className="space-y-3">
                <Label>Payment Method</Label>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { id: 'Cash', icon: Banknote, label: 'Cash' },
                    { id: 'GPay', icon: Smartphone, label: 'GPay' },
                    { id: 'Credit Card', icon: CreditCard, label: 'Credit Card' },
                    { id: 'Debit Card', icon: CreditCard, label: 'Debit Card' }
                  ].map((method) => {
                    const Icon = method.icon;
                    const isActive = activeMethod === method.id;
                    return (
                      <button
                        key={method.id}
                        type="button"
                        onClick={() => setActiveMethod(method.id as any)}
                        className={`flex flex-col items-center justify-center p-3 rounded-xl border-2 transition-all ${
                          isActive 
                            ? 'border-teal-500 bg-teal-50 text-teal-700' 
                            : 'border-slate-100 hover:border-slate-200 text-slate-500 hover:text-slate-700'
                        }`}
                      >
                        <Icon className="w-5 h-5 mb-1.5" />
                        <span className="text-xs font-medium">{method.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <Button 
                onClick={handleCollect} 
                disabled={isProcessing || !paymentAmount}
                className="w-full h-12 bg-teal-600 hover:bg-teal-700 text-white rounded-xl shadow-lg shadow-teal-600/20"
              >
                {isProcessing ? 'Processing...' : 'Confirm Payment'}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* View Partial Payment & Visit Details Modal */}
      <Dialog open={!!viewDetailsAlert} onOpenChange={(open) => !open && setViewDetailsAlert(null)}>
        <DialogContent className="sm:max-w-[560px] p-0 overflow-hidden bg-slate-50 flex flex-col max-h-[90vh]">
          <DialogHeader className="px-6 py-4 bg-white border-b border-slate-200 shrink-0 flex flex-row items-center justify-between">
            <div>
              <DialogTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Receipt className="w-5 h-5 text-teal-600" />
                Partial Payment Details
              </DialogTitle>
              <p className="text-xs text-slate-500 mt-0.5">
                Visit financial record & follow-up information
              </p>
            </div>
          </DialogHeader>

          {viewDetailsAlert && (
            <div className="flex-1 overflow-y-auto p-6 space-y-4 text-xs">
              {/* Patient & Doctor Card */}
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4 text-teal-600" />
                    <span className="font-bold text-slate-900 text-sm">{viewDetailsAlert.patientName}</span>
                    {viewDetailsAlert.patientAge && (
                      <span className="text-slate-500 text-xs">({viewDetailsAlert.patientAge}y, {viewDetailsAlert.patientGender})</span>
                    )}
                  </div>
                  <Badge variant="outline" className="bg-amber-50 text-amber-800 border-amber-300 font-semibold">
                    Outstanding: {viewDetailsAlert.daysOutstanding} days
                  </Badge>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wider">Doctor</span>
                    <span className="font-semibold text-slate-800 text-xs">{viewDetailsAlert.doctorName}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wider">Patient Phone</span>
                    <span className="font-semibold text-slate-800 text-xs flex items-center gap-1">
                      <Phone className="w-3 h-3 text-slate-400" />
                      {viewDetailsAlert.patientPhone}
                    </span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wider">Reason for Visit</span>
                    <span className="text-slate-700 text-xs">{viewDetailsAlert.reasonForVisit}</span>
                  </div>
                </div>
              </div>

              {/* Partial Payment Specific Reasons & Follow-up */}
              <div className="bg-amber-50/70 p-4 rounded-xl border border-amber-200/80 shadow-xs space-y-2.5">
                <h4 className="text-xs font-bold text-amber-900 uppercase tracking-wider flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-700" />
                  Partial Payment Information
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div className="bg-white p-2.5 rounded-lg border border-amber-100">
                    <span className="text-amber-800 text-[10px] font-bold uppercase block mb-0.5">Recorded Reason</span>
                    <span className="text-slate-800 font-medium">{viewDetailsAlert.partialReason}</span>
                  </div>
                  <div className="bg-white p-2.5 rounded-lg border border-amber-100">
                    <span className="text-amber-800 text-[10px] font-bold uppercase block mb-0.5">Alternative Phone (Follow-up)</span>
                    <span className="text-slate-900 font-mono font-bold flex items-center gap-1">
                      <Phone className="w-3 h-3 text-amber-600" />
                      {viewDetailsAlert.altPhone}
                    </span>
                  </div>
                </div>
              </div>

              {/* Financial Breakdown */}
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-2">
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Cost & Billing Breakdown</h4>
                <div className="space-y-1.5 pt-1 text-slate-600">
                  <div className="flex justify-between">
                    <span>Consultation Fee</span>
                    <span className="font-medium text-slate-800">₹{viewDetailsAlert.consultationFee}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Treatment Fee</span>
                    <span className="font-medium text-slate-800">₹{viewDetailsAlert.treatmentFee}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Medicine Cost</span>
                    <span className="font-medium text-slate-800">₹{viewDetailsAlert.medicineCost}</span>
                  </div>
                  <div className="pt-2 border-t border-slate-100 flex justify-between font-bold text-slate-900 text-sm">
                    <span>Total Bill</span>
                    <span>₹{viewDetailsAlert.totalAmount}</span>
                  </div>
                  <div className="flex justify-between font-bold text-emerald-600 text-sm">
                    <span>Total Paid</span>
                    <span>₹{viewDetailsAlert.paidAmount}</span>
                  </div>
                  <div className="pt-1 border-t border-slate-100 flex justify-between font-bold text-rose-600 text-sm">
                    <span>Remaining Balance</span>
                    <span>₹{viewDetailsAlert.balance}</span>
                  </div>
                </div>
              </div>

              {/* Recorded Payments History */}
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-2.5">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                    Payment Transactions ({viewDetailsAlert.paymentHistory?.length || 0})
                  </h4>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs border-teal-600 text-teal-700 hover:bg-teal-50 flex items-center gap-1"
                    onClick={async () => {
                      try {
                        const response = await fetch(`${API_BASE_URL}/api/documents/receipt/${viewDetailsAlert.visitId}`, {
                          method: 'GET',
                          credentials: 'include'
                        });
                        if (!response.ok) throw new Error('Failed to generate receipt');
                        const blob = await response.blob();
                        const url = window.URL.createObjectURL(blob);
                        window.open(url, '_blank');
                        setTimeout(() => window.URL.revokeObjectURL(url), 1000);
                        toast.success('Receipt opened for printing');
                      } catch (err) {
                        toast.error('Could not generate receipt PDF');
                      }
                    }}
                  >
                    <Receipt className="w-3.5 h-3.5" />
                    Print Receipt
                  </Button>
                </div>

                <div className="divide-y divide-slate-100 border border-slate-100 rounded-lg overflow-hidden">
                  {viewDetailsAlert.paymentHistory?.map((p: any, idx: number) => (
                    <div key={p.id || idx} className="p-2.5 bg-slate-50/50 flex justify-between items-start gap-2">
                      <div className="space-y-0.5 flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-slate-800">{p.method}</span>
                          <span className="text-[10px] text-slate-400">
                            {new Date(p.createdAt || p.date).toLocaleDateString()} {new Date(p.createdAt || p.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        {p.notes && (
                          <p className="text-[11px] text-slate-600 italic break-words">{p.notes}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="font-bold text-slate-900">₹{p.amount}</span>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 px-1.5 text-teal-600 hover:bg-teal-50 text-[11px] flex items-center gap-1"
                          title="Print receipt for this payment"
                          onClick={async () => {
                            try {
                              const response = await fetch(`${API_BASE_URL}/api/documents/receipt/${viewDetailsAlert.visitId}?paymentId=${encodeURIComponent(p.id)}`, {
                                method: 'GET',
                                credentials: 'include'
                              });
                              if (!response.ok) throw new Error('Failed to generate receipt');
                              const blob = await response.blob();
                              const url = window.URL.createObjectURL(blob);
                              window.open(url, '_blank');
                              setTimeout(() => window.URL.revokeObjectURL(url), 1000);
                            } catch (err) {
                              toast.error('Could not generate receipt PDF');
                            }
                          }}
                        >
                          <Receipt className="w-3 h-3" />
                          <span>Receipt</span>
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          <div className="p-4 bg-white border-t border-slate-200 shrink-0 flex items-center justify-end gap-3">
            <Button variant="outline" onClick={() => setViewDetailsAlert(null)}>
              Close
            </Button>
            <Button
              className="bg-teal-600 hover:bg-teal-700 text-white"
              onClick={() => {
                const alertToCollect = viewDetailsAlert;
                setViewDetailsAlert(null);
                setSelectedAlert(alertToCollect);
                setPaymentAmount(alertToCollect.balance);
              }}
            >
              Collect Remaining Balance (₹{viewDetailsAlert?.balance})
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
