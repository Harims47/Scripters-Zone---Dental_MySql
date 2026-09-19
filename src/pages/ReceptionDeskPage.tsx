import { useState, useMemo, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Users, Receipt, CheckCircle, Search, Calendar, CheckCircle2, Pencil, Eye, Send, CreditCard, Activity, XCircle, Camera, AlertTriangle, ArrowRightLeft, FileText } from 'lucide-react';
import { useClinicContext } from '../context/ClinicContext';
import { soundService } from '../lib/soundUtils';
import { api } from '../lib/api';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Checkbox } from '../components/ui/checkbox';
import { Badge } from '../components/ui/badge';
import { DataTable } from '../components/data-table/data-table';
import { DataTableToolbar } from '../components/data-table/data-table-toolbar';
import type { ColumnDef } from '@tanstack/react-table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '../components/ui/dialog';
import { Sheet, SheetContent, SheetTitle } from '../components/ui/sheet';
import { DrawerSection } from '../components/ui/drawer-patterns';
import { CameraCapture } from '../components/ui/camera-capture';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { toast } from 'react-hot-toast';
import { WhatsAppActionButton } from '../components/communication/WhatsAppActionButton';
import type { QueueEntry } from '../types/domain';

import { PaymentMethodSelector } from '../components/payment/payment-components';
import type { PaymentMethod } from '../components/payment/payment-components';
import { HistoricalVisitDetails } from '../components/history/HistoricalVisitDetails';
import { PatientClinicalSummary } from '../components/consultation/consultation-components';
import { API_BASE_URL } from '../lib/api';
import Swal from 'sweetalert2';
import withReactContent from 'sweetalert2-react-content';

const MySwal = withReactContent(Swal);

export function ReceptionDeskPage() {
  const { queue, visits, patients, staff, refreshClinicOperations, startVisit, updateVisit, assignDoctor, appointments, addAppointment, confirmAppointmentArrival, addPatient, updatePatient, prescriptions, dispensings, completeDispensing, recordPayment, medicines, payments, cancelVisit, consultations, transferVisitsToNextDay } = useClinicContext();

  // Selected Queue Date (defaults to today)
  const todayStr = new Date().toISOString().split('T')[0];
  const tomorrowDate = new Date();
  tomorrowDate.setDate(tomorrowDate.getDate() + 1);
  const tomorrowStr = tomorrowDate.toISOString().split('T')[0];

  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
  const [search, setSearch] = useState('');
  const [stageFilter, setStageFilter] = useState('all');
  const [visitTypeFilter, setVisitTypeFilter] = useState('all');

  // Multi-select for transferring waiting patients
  const [selectedWaitingIds, setSelectedWaitingIds] = useState<string[]>([]);
  const [isTransferDialogOpen, setIsTransferDialogOpen] = useState<boolean>(false);
  const [transferTargetDate, setTransferTargetDate] = useState<string>(tomorrowStr);
  const [transferReason, setTransferReason] = useState<string>('Clinic closing / High waiting time');
  const [isTransferring, setIsTransferring] = useState<boolean>(false);

  // Registration Drawer
  const location = useLocation();
  const navigate = useNavigate();
  const [isRegisterOpen, setIsRegisterOpen] = useState(false);

  useEffect(() => {
    if (location.state && (location.state as any).openRegister) {
      setIsRegisterOpen(true);
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.state, navigate, location.pathname]);

  const [isEditPatientOpen, setIsEditPatientOpen] = useState(false);
  const [editDrawerMode, setEditDrawerMode] = useState<'edit' | 'view'>('edit');
  const [editingPatientId, setEditingPatientId] = useState<string | null>(null);
  const [editingVisitId, setEditingVisitId] = useState<string | null>(null);


  const [regType, setRegType] = useState<'walk-in' | 'appointment'>('walk-in');
  const [isCameraOpen, setIsCameraOpen] = useState(false);

  const [regData, setRegData] = useState({ name: '', phone: '', age: '', gender: 'Male', address: '', reasonForVisit: '', photoUrl: '' });
  const [apptData, setApptData] = useState({ date: new Date().toISOString().split('T')[0], time: '10:00', type: 'Consultation', notes: '' });

  const [isNewPatient, setIsNewPatient] = useState(false);
  const [selectedExistingPatientId, setSelectedExistingPatientId] = useState('');
  const [patientSearch, setPatientSearch] = useState('');

  const resetRegistrationForm = () => {
    setRegData({ name: '', phone: '', age: '', gender: 'Male', address: '', reasonForVisit: '', photoUrl: '' });
    setApptData({ date: new Date().toISOString().split('T')[0], time: '10:00', type: 'Consultation', notes: '' });
    setIsNewPatient(false);
    setSelectedExistingPatientId('');
    setPatientSearch('');
    setRegType('walk-in');
    setIsCameraOpen(false);
  };

  // Payment States
  const [paymentAmount, setPaymentAmount] = useState<number | ''>('');
  const [paymentReason, setPaymentReason] = useState<string>('');
  const [paymentReasonOther, setPaymentReasonOther] = useState<string>('');
  const [altPhone, setAltPhone] = useState<string>('');
  const [hasPrintedReceipt, setHasPrintedReceipt] = useState<boolean>(false);
  const [pendingPaymentConfirmation, setPendingPaymentConfirmation] = useState<{
    visitId: string;
    amount: number;
    method: 'Cash' | 'GPay' | 'Credit Card' | 'Debit Card';
    finalNotes?: string;
    isPartial: boolean;
    remainingBalance: number;
    reasonText?: string;
    altPhoneText?: string;
  } | null>(null);
  const [isRecordingPayment, setIsRecordingPayment] = useState<boolean>(false);
  const [processTreatmentPlan, setProcessTreatmentPlan] = useState<any | null>(null);

  // Assignment Modal
  const [assignQueueId, setAssignQueueId] = useState<string | null>(null);

  // Process Visit Drawer
  const [processVisitId, setProcessVisitId] = useState<string | null>(null);

  // Completed View Drawer
  const [viewVisitId, setViewVisitId] = useState<string | null>(null);

  // Patient History Dialog
  const [historyPatientId, setHistoryPatientId] = useState<string | null>(null);

  // Modals for Phase 9.1
  const [deleteVisitId, setDeleteVisitId] = useState<string | null>(null);
  const [registrationSuccessData, setRegistrationSuccessData] = useState<{ patientId: string, name: string } | null>(null);
  const [confirmAssignData, setConfirmAssignData] = useState<{ queueId: string, doctorId: string, doctorName: string } | null>(null);

  // Dispensing State
  const [activeItems, setActiveItems] = useState<any[]>([]);

  // Payment State
  const [activeMethod, setActiveMethod] = useState<PaymentMethod>(null);

  // Derive Doctors and their Availability
  const doctors = useMemo(() => {
    return staff.filter(s => ['Head Doctor', 'Duty Doctor'].includes(s.role) && s.status === 'Active');
  }, [staff]);

  const doctorAvailability = useMemo(() => {
    const availability: Record<string, 'Available' | 'With Patient' | 'Leave'> = {};
    doctors.forEach(doc => {
      if (doc.attendance === 'Leave') {
        availability[doc.id] = 'Leave';
      } else {
        // A doctor is with a patient if they have ANY queue entry In Progress
        const hasActive = queue.some(q => q.assignedDoctorId === doc.id && q.status === 'In Progress');
        availability[doc.id] = hasActive ? 'With Patient' : 'Available';
      }
    });
    return availability;
  }, [doctors, queue]);

  // Audio & Doctor State Transition Detection (Feature 2)
  const previousDoctorStateRef = useRef<Record<string, 'Available' | 'With Patient' | 'Leave'> | null>(null);
  const isInitialMountRef = useRef(true);

  // Auto-unlock AudioContext on user interaction within ReceptionDesk
  useEffect(() => {
    const handleUserGesture = () => {
      soundService.unlock();
    };
    window.addEventListener('click', handleUserGesture, { once: true });
    window.addEventListener('keydown', handleUserGesture, { once: true });
    return () => {
      window.removeEventListener('click', handleUserGesture);
      window.removeEventListener('keydown', handleUserGesture);
    };
  }, []);

  // Real-time queue & doctor status sync on Reception Desk
  useEffect(() => {
    // 1. Immediate fetch on mount so Reception Desk never shows stale data
    refreshClinicOperations();

    // 2. Operational polling every 5 seconds
    const timer = setInterval(() => {
      refreshClinicOperations();
    }, 5000);

    // 3. Immediately refresh when user switches back to this tab/window
    const handleFocus = () => {
      if (!document.hidden) {
        refreshClinicOperations();
      }
    };
    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleFocus);

    return () => {
      clearInterval(timer);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleFocus);
    };
  }, [refreshClinicOperations]);

  // Doctor status transition tracking
  useEffect(() => {
    // 1. Initial silent load: Record baseline status for all doctors without playing sounds
    if (isInitialMountRef.current) {
      if (Object.keys(doctorAvailability).length > 0) {
        previousDoctorStateRef.current = { ...doctorAvailability };
        isInitialMountRef.current = false;
      }
      return;
    }

    const prevStates = previousDoctorStateRef.current;
    if (!prevStates) {
      previousDoctorStateRef.current = { ...doctorAvailability };
      return;
    }

    let shouldPlayAvailableSound = false;
    let shouldPlayOccupiedSound = false;

    // Compare each doctor's derived status against previous state
    doctors.forEach((doc) => {
      const currentStatus = doctorAvailability[doc.id];
      const prevStatus = prevStates[doc.id];

      // If status changed
      if (prevStatus && currentStatus && prevStatus !== currentStatus) {
        // Transition 1: Available -> With Patient (Doctor became occupied)
        if (prevStatus === 'Available' && currentStatus === 'With Patient') {
          shouldPlayOccupiedSound = true;
        }
        // Transition 2: With Patient -> Available (Doctor became free)
        else if (prevStatus === 'With Patient' && currentStatus === 'Available') {
          shouldPlayAvailableSound = true;
        }
        // Transition 3: Leave -> Available (Doctor returned and became available)
        else if (prevStatus === 'Leave' && currentStatus === 'Available') {
          shouldPlayAvailableSound = true;
        }
      }
    });

    // Trigger sound ONCE per batch of transitions if relevant
    if (shouldPlayAvailableSound) {
      soundService.playDoctorAvailableSound();
    } else if (shouldPlayOccupiedSound) {
      soundService.playDoctorOccupiedSound();
    }

    // Update reference to latest observed state
    previousDoctorStateRef.current = { ...doctorAvailability };
  }, [doctorAvailability, doctors]);

  // Unified Table Data
  const unifiedData = useMemo(() => {
    const isViewingToday = selectedDate === todayStr;

    // If viewing a future date (e.g. Tomorrow), show appointments scheduled for that date
    if (!isViewingToday) {
      const dateAppointments = appointments.filter(a => a.date === selectedDate && a.status !== 'Cancelled');
      let data = dateAppointments.map((appt, idx) => {
        const p = patients.find(pat => pat.id === appt.patientId);
        const d = doctors.find(doc => doc.id === appt.providerId);
        const isPriority = appt.notes?.includes('[Transferred');

        return {
          id: appt.id,
          visitId: '',
          patientId: appt.patientId,
          patientName: p?.name || 'Unknown',
          patientPhone: p?.phone || '',
          visitType: 'Appointment',
          token: `${idx + 1}`,
          doctor: d?.name || 'Unassigned',
          reasonForVisit: appt.notes || appt.type || 'Consultation',
          stage: isPriority ? 'Transferred' : 'Scheduled',
          paymentStatus: '—',
          rawStatus: appt.status,
          arrivalTime: appt.time || '09:00',
          rawVisit: null,
          rawQueue: null,
          isTransferred: isPriority
        };
      });

      if (stageFilter && stageFilter !== 'all') {
        data = data.filter(d => d.stage.toLowerCase().includes(stageFilter.toLowerCase()));
      }

      if (search) {
        const s = search.toLowerCase();
        data = data.filter(d =>
          d.patientName.toLowerCase().includes(s) ||
          d.patientPhone.includes(s) ||
          d.doctor.toLowerCase().includes(s)
        );
      }

      return data;
    }

    // Default: Today's live queue
    let data = queue.map(q => {
      const v = visits.find(v => v.id === q.visitId);
      const p = patients.find(p => p.id === q.patientId);
      const d = doctors.find(doc => doc.id === q.assignedDoctorId);
      const isAppointment = v?.appointmentId != null;
      const isTransferred = v?.reasonForVisit?.startsWith('[Transferred') || q.status === 'Transferred';

      // Translate queue status to receptionist stage
      let stage = 'Waiting';
      if (isTransferred) stage = 'Next Day';
      else if (q.status === 'Waiting') stage = 'Waiting';
      else if (q.status === 'In Progress' || q.status === 'With Doctor' || q.status === 'Called') stage = 'With Doctor';
      else if (q.status === 'Completed' && v?.status !== 'COMPLETED') stage = 'Ready at Reception';
      else if (q.status === 'Dispensing' || q.status === 'Payment' || q.status === 'Ready at Reception') stage = 'Ready at Reception';
      else if (q.status === 'Cancelled') stage = 'Cancelled';
      else stage = q.status; // fallback to raw status instead of incorrectly showing Waiting

      const isDoctorHandled = v?.paymentOwner === 'DOCTOR';
      const visitPayments = payments.filter(pay => pay.visitId === v?.id);
      const totalPaid = visitPayments.reduce((sum, pay) => sum + pay.amount, 0);
      const amountDue = v?.amountDue || 0;

      let paymentStatus = '—';
      if (isDoctorHandled) {
        paymentStatus = 'Handled by Doctor';
      } else if (stage === 'Ready at Reception' || stage === 'Completed') {
        paymentStatus = 'Unpaid';
        if (amountDue > 0 && totalPaid >= amountDue) paymentStatus = 'Paid';
        else if (totalPaid > 0) paymentStatus = 'Partial';
        else if (amountDue === 0 && v) paymentStatus = 'Paid';
      } else if (totalPaid > 0) {
        paymentStatus = 'Partial';
      }

      return {
        id: q.id,
        visitId: q.visitId,
        patientId: p?.id,
        patientName: p?.name || 'Unknown',
        patientPhone: p?.phone || '',
        visitType: isAppointment ? 'Appointment' : 'Walk-in',
        token: q.position || '-',
        doctor: d?.name || '-',
        reasonForVisit: v?.reasonForVisit,
        stage: stage,
        paymentStatus,
        rawStatus: isTransferred ? 'Transferred' : q.status, // keep raw for action logic
        arrivalTime: q.arrivalTime,
        rawVisit: v,
        rawQueue: q as (QueueEntry | null),
      };
    });

    // Also add completed and cancelled visits for today that are no longer in active queue
    const activeVisitIds = new Set(queue.map(q => q.visitId));
    const inactiveVisits = visits.filter(v => {
      if (v.status !== 'COMPLETED' && v.status !== 'CANCELLED') return false;
      if (activeVisitIds.has(v.id)) return false;
      const vIso = v.createdAt ? new Date(v.createdAt).toISOString().split('T')[0] : '';
      const vLocal = v.createdAt ? new Date(v.createdAt).toLocaleDateString('en-CA') : '';
      return vIso === selectedDate || vLocal === selectedDate;
    });

    inactiveVisits.forEach(v => {
      const p = patients.find(p => p.id === v.patientId);
      const d = doctors.find(doc => doc.id === v.doctorId);
      const isAppointment = v.appointmentId != null;
      const isTransferred = v.reasonForVisit?.startsWith('[Transferred');
      const oldQueueEntry = queue.find(q => q.visitId === v.id);

      const isDoctorHandled = v.paymentOwner === 'DOCTOR';
      const visitPayments = payments.filter(pay => pay.visitId === v.id);
      const totalPaid = visitPayments.reduce((sum, pay) => sum + pay.amount, 0);
      const amountDue = v.amountDue || 0;

      let paymentStatus = '—';
      if (isDoctorHandled) {
        paymentStatus = 'Handled by Doctor';
      } else if (v.status === 'COMPLETED') {
        paymentStatus = 'Unpaid';
        if (amountDue > 0 && totalPaid >= amountDue) paymentStatus = 'Paid';
        else if (totalPaid > 0) paymentStatus = 'Partial';
        else if (amountDue === 0 && v) paymentStatus = 'Paid';
      } else if (totalPaid > 0) {
        paymentStatus = 'Partial';
      }

      data.push({
        id: v.id,
        visitId: v.id,
        patientId: p?.id,
        patientName: p?.name || 'Unknown',
        patientPhone: p?.phone || '',
        visitType: isAppointment ? 'Appointment' : 'Walk-in',
        token: oldQueueEntry?.position || '-',
        doctor: d?.name || '-',
        reasonForVisit: v.reasonForVisit,
        stage: isTransferred ? 'Next Day' : (v.status === 'CANCELLED' ? 'Cancelled' : 'Completed'),
        paymentStatus,
        rawStatus: isTransferred ? 'Transferred' : (v.status === 'CANCELLED' ? 'Cancelled' : 'Completed'),
        arrivalTime: '-',
        rawVisit: v,
        rawQueue: oldQueueEntry || null,
      });
    });

    if (stageFilter && stageFilter !== 'all') {
      data = data.filter(d => {
        if (stageFilter.toLowerCase() === 'next day' || stageFilter.toLowerCase() === 'transferred') {
          return d.stage.toLowerCase() === 'next day' || d.stage.toLowerCase().includes('transferred');
        }
        return d.stage.toLowerCase() === stageFilter.toLowerCase();
      });
    }

    if (visitTypeFilter && visitTypeFilter !== 'all') {
      data = data.filter(d => d.visitType.toLowerCase() === visitTypeFilter.toLowerCase());
    }

    if (search) {
      const s = search.toLowerCase();
      data = data.filter(d =>
        d.patientName.toLowerCase().includes(s) ||
        d.patientPhone.includes(s)
      );
    }

    // Sort by token number descending (latest first)
    data.sort((a, b) => {
      const tokenA = typeof a.token === 'number' ? a.token : 0;
      const tokenB = typeof b.token === 'number' ? b.token : 0;
      return tokenB - tokenA;
    });

    return data;
  }, [queue, visits, patients, doctors, appointments, payments, search, stageFilter, visitTypeFilter, selectedDate, todayStr]);

  const columns: ColumnDef<any>[] = [
    {
      id: 'select',
      header: () => {
        const waitingPatients = unifiedData.filter(d => d.stage === 'Waiting');
        const isAllSelected = waitingPatients.length > 0 && waitingPatients.every(d => selectedWaitingIds.includes(d.visitId));
        const isSomeSelected = waitingPatients.some(d => selectedWaitingIds.includes(d.visitId));

        if (selectedDate !== todayStr) return null;

        return (
          <div className="flex justify-center items-center">
            <Checkbox
              checked={isAllSelected ? true : isSomeSelected ? 'indeterminate' : false}
              disabled={waitingPatients.length === 0}
              onCheckedChange={(checked) => {
                if (checked) {
                  setSelectedWaitingIds(waitingPatients.map(d => d.visitId));
                } else {
                  setSelectedWaitingIds([]);
                }
              }}
              aria-label="Select all waiting patients"
              title="Select all waiting patients to transfer"
            />
          </div>
        );
      },
      cell: ({ row }) => {
        const isWaiting = row.original.stage === 'Waiting';
        const visitId = row.original.visitId;

        if (selectedDate !== todayStr || !visitId) return null;

        return (
          <div className="flex justify-center items-center p-1 -m-1 min-h-[32px] min-w-[32px] cursor-pointer">
            <Checkbox
              className="h-4 w-4 data-[state=checked]:bg-teal-600 cursor-pointer"
              checked={selectedWaitingIds.includes(visitId)}
              disabled={!isWaiting}
              onCheckedChange={(checked) => {
                if (checked) {
                  setSelectedWaitingIds(prev => [...prev, visitId]);
                } else {
                  setSelectedWaitingIds(prev => prev.filter(id => id !== visitId));
                }
              }}
              aria-label={`Select patient ${row.original.patientName}`}
              title={isWaiting ? "Select to transfer to next day" : "Only waiting patients can be transferred"}
            />
          </div>
        );
      }
    },
    {
      accessorKey: 'token',
      header: () => <div className="text-center font-semibold text-slate-600">Token No.</div>,
      cell: ({ row }) => (
        <div className="text-center">
          <span className="font-semibold text-slate-700 bg-slate-100 px-2 py-1 rounded-md">
            #{row.original.token}
          </span>
        </div>
      )
    },
    {
      accessorKey: 'patientName',
      header: () => <div className="text-center font-semibold text-slate-600">Patient Name</div>,
      cell: ({ row }) => (
        <div className="flex justify-center">
          <div
            className="font-medium text-slate-900 truncate max-w-[150px] text-center"
            title={row.original.patientName}
          >
            {row.original.patientName}
          </div>
        </div>
      )
    },
    {
      accessorKey: 'doctor',
      header: () => <div className="text-center font-semibold text-slate-600">Doctor Name</div>,
      cell: ({ row }) => (
        <div className="flex justify-center">
          <div
            className="text-slate-600 truncate max-w-[120px] text-center"
            title={row.original.doctor === '-' ? '' : row.original.doctor}
          >
            {row.original.doctor === '-' ? '—' : row.original.doctor}
          </div>
        </div>
      )
    },
    {
      accessorKey: 'paymentStatus',
      header: () => <div className="text-center font-semibold text-slate-600">Payment Status</div>,
      cell: ({ row }) => {
        const s = row.original.paymentStatus;
        let badge = <span className="text-slate-400">—</span>;
        if (s === 'Handled by Doctor') badge = <Badge className="bg-indigo-100 text-indigo-800 border-indigo-200">Payment Not Required</Badge>;
        else if (s === 'Paid') badge = <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200">Paid</Badge>;
        else if (s === 'Partial') badge = <Badge className="bg-amber-100 text-amber-800 border-amber-200">Partial</Badge>;
        else if (s === 'Unpaid') badge = <Badge className="bg-rose-100 text-rose-800 border-rose-200">Unpaid</Badge>;

        return <div className="text-center">{badge}</div>;
      }
    },
    {
      accessorKey: 'stage',
      header: () => <div className="text-center font-semibold text-slate-600">Status</div>,
      cell: ({ row }) => {
        const s = row.original.stage;
        let badge = <Badge variant="outline" className="whitespace-nowrap">{s}</Badge>;
        if (s === 'Waiting') badge = <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100 whitespace-nowrap">🟡 Waiting</Badge>;
        else if (s === 'With Doctor') badge = <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100 whitespace-nowrap">🔵 With Doctor</Badge>;
        else if (s === 'Next Day' || s === 'Transferred') badge = <Badge className="bg-purple-100 text-purple-800 border-purple-200 hover:bg-purple-100 whitespace-nowrap">📅 Next Day</Badge>;
        else if (s === 'Transferred Priority') badge = <Badge className="bg-purple-100 text-purple-800 border-purple-200 hover:bg-purple-100 whitespace-nowrap">⚡ Priority Transferred</Badge>;
        else if (s === 'Scheduled') badge = <Badge className="bg-sky-100 text-sky-800 border-sky-200 hover:bg-sky-100 whitespace-nowrap">📅 Scheduled</Badge>;
        else if (s === 'Ready at Reception') badge = <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100 whitespace-nowrap">🟢 Ready at Reception</Badge>;
        else if (s === 'Completed') badge = <Badge className="bg-slate-100 text-slate-800 hover:bg-slate-100 whitespace-nowrap">✅ Completed</Badge>;
        else if (s === 'Cancelled') badge = <Badge className="bg-slate-100 text-slate-500 hover:bg-slate-100 whitespace-nowrap">🚫 Cancelled</Badge>;

        return <div className="text-center">{badge}</div>;
      }
    },
    {
      id: 'actions',
      header: () => <div className="text-center font-semibold text-slate-600">Action</div>,
      cell: ({ row }) => {
        const stage = row.original.stage;
        const isCancelledOrCompleted = stage === 'Cancelled' || stage === 'Completed' || stage === 'Next Day' || stage === 'Transferred';
        const isWaiting = stage === 'Waiting';
        const isReadyForReception = stage === 'Ready at Reception';

        return (
          <div className="flex items-center justify-center gap-2">
            {/* Edit Patient */}
            <Button
              size="icon"
              variant="ghost"
              className="w-8 h-8 text-teal-600 hover:bg-teal-50"
              title="Edit Patient"
              onClick={(e) => {
                e.preventDefault(); e.stopPropagation();
                const patient = patients.find(p => p.id === row.original.patientId);
                if (patient) {
                  setEditingPatientId(patient.id);
                  setEditingVisitId(row.original.visitId || null);
                  setRegData({
                    name: patient.name,
                    phone: patient.phone || '',
                    age: patient.age != null ? patient.age.toString() : '',
                    gender: patient.gender || '',
                    address: patient.address || '',
                    reasonForVisit: row.original.reasonForVisit || row.original.rawVisit?.reasonForVisit || 'Routine Checkup',
                    photoUrl: patient.photoUrl || ''
                  });
                  setEditDrawerMode('edit');
                  setIsEditPatientOpen(true);
                }
              }}
            >
              <Pencil className="w-4 h-4" />
            </Button>

            {/* View Patient Details */}
            <Button
              size="icon"
              variant="ghost"
              className="w-8 h-8 text-blue-600 hover:bg-blue-50"
              title="View Patient Details"
              onClick={(e) => {
                e.preventDefault(); e.stopPropagation();
                const patient = patients.find(p => p.id === row.original.patientId);
                if (patient) {
                  setEditingPatientId(patient.id);
                  setEditingVisitId(row.original.visitId || null);
                  setRegData({
                    name: patient.name,
                    phone: patient.phone || '',
                    age: patient.age != null ? patient.age.toString() : '',
                    gender: patient.gender || '',
                    address: patient.address || '',
                    reasonForVisit: row.original.reasonForVisit || row.original.rawVisit?.reasonForVisit || 'Routine Checkup',
                    photoUrl: patient.photoUrl || ''
                  });
                  setEditDrawerMode('view');
                  setIsEditPatientOpen(true);
                }
              }}
            >
              <Eye className="w-4 h-4" />
            </Button>

            {/* Send to Doctor (Share) */}
            <Button
              size="icon"
              variant="ghost"
              className={`w-8 h-8 text-indigo-600 ${isWaiting ? 'hover:bg-indigo-50 cursor-pointer' : 'cursor-not-allowed opacity-75 hover:bg-transparent'}`}
              title={isWaiting ? "Send to Doctor" : "Cannot send to doctor at this stage"}
              onClick={(e) => {
                e.preventDefault(); e.stopPropagation();
                if (isWaiting) setAssignQueueId(row.original.id);
              }}
            >
              <Send className="w-4 h-4" />
            </Button>

            {/* Process Visit / View Billing & Receipt / Dispensing */}
            {(() => {
              const canProcess = isReadyForReception || stage === 'Completed';
              return (
                <Button
                  size="icon"
                  variant="ghost"
                  className={`w-8 h-8 text-emerald-600 ${canProcess ? 'hover:bg-emerald-50 cursor-pointer' : 'cursor-not-allowed opacity-75 hover:bg-transparent'}`}
                  title={isReadyForReception ? "Process Visit" : stage === 'Completed' ? "View Billing & Receipt" : "Not ready for this stage"}
                  onClick={(e) => {
                    e.preventDefault(); e.stopPropagation();
                    if (canProcess) handleOpenProcess(row.original);
                  }}
                >
                  <CreditCard className="w-4 h-4" />
                </Button>
              );
            })()}

            {/* Cancel Visit */}
            {(() => {
              const canCancel = !(isCancelledOrCompleted || row.original.doctor !== '-');
              return (
                <Button
                  size="icon"
                  variant="ghost"
                  className={`w-8 h-8 text-rose-600 ${canCancel ? 'hover:bg-rose-50 cursor-pointer' : 'cursor-not-allowed opacity-75 hover:bg-transparent'}`}
                  title={canCancel ? "Cancel Visit" : isCancelledOrCompleted ? "Visit is already finished" : "Cannot cancel once doctor is assigned"}
                  onClick={(e) => {
                    e.preventDefault(); e.stopPropagation();
                    if (canCancel) handleCancelVisit(row.original.visitId);
                  }}
                >
                  <XCircle className="w-4 h-4" />
                </Button>
              );
            })()}
          </div>
        );
      }
    }
  ];

  const handleCancelVisit = async (visitId: string) => {
    const result = await MySwal.fire({
      title: 'Cancel this visit?',
      text: "This will cancel the patient's current visit. Patient history and records will be preserved.",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Cancel Visit',
      cancelButtonText: 'Keep Visit',
      confirmButtonColor: '#e11d48', // rose-600
      cancelButtonColor: '#94a3b8', // slate-400
      customClass: {
        popup: 'rounded-2xl',
        confirmButton: 'rounded-lg font-semibold px-6 py-2',
        cancelButton: 'rounded-lg font-semibold px-6 py-2'
      }
    });

    if (result.isConfirmed) {
      const res = await cancelVisit(visitId);
      if (res.success) {
        MySwal.fire({
          title: 'Cancelled',
          text: 'The visit has been successfully cancelled.',
          icon: 'success',
          confirmButtonColor: '#0d9488',
          customClass: { popup: 'rounded-2xl', confirmButton: 'rounded-lg font-semibold px-8 py-2' }
        });
      } else {
        MySwal.fire('Error', res.error || 'Failed to cancel the visit', 'error');
      }
    }
  };

  const handleRegister = async () => {
    let finalPatientId = selectedExistingPatientId;

    if (isNewPatient) {
      if (!regData.name || !regData.phone) {
        toast.error("Name and Phone are required");
        return;
      }

      const normPhone = regData.phone.replace(/\D/g, '').slice(-10);
      const existing = patients.find(p => p.phone && p.phone.replace(/\D/g, '').slice(-10) === normPhone);
      if (existing) {
        MySwal.fire({
          title: 'Duplicate Phone Number',
          html: `A patient is already registered with this phone number: <br/><br/><b>${existing.name}</b> (${existing.phone})<br/><br/>Please search for this patient instead of registering a new one to avoid duplicate records.`,
          icon: 'warning',
          confirmButtonText: 'Understood',
          confirmButtonColor: '#0d9488',
          customClass: {
            popup: 'rounded-2xl',
            confirmButton: 'rounded-lg font-semibold px-8 py-2'
          }
        });
        return;
      }

      try {
        const newPatient = await addPatient({
          name: regData.name,
          phone: regData.phone,
          age: parseInt(regData.age) || 30,
          gender: regData.gender as any,
          status: 'Active',
          address: (regData as any).address || '',
          photoUrl: (regData as any).photoUrl || ''
        });
        finalPatientId = newPatient.id;
      } catch (err: any) {
        toast.error(err.response?.data?.error || "Failed to register patient");
        return;
      }
    }

    if (!finalPatientId) {
      toast.error("Please select or register a patient.");
      return;
    }

    try {
      let patientDetails = patients.find(p => p.id === finalPatientId);
      if (!patientDetails && isNewPatient) {
        patientDetails = { name: regData.name, phone: regData.phone } as any;
      }

      const showSuccessModal = (title: string, subtext: string) => {
        MySwal.fire({
          title: `<span class="text-2xl font-bold text-slate-800">${title}</span>`,
          html: `
            <div class="text-left bg-slate-50 p-4 rounded-xl border border-slate-100 mt-2">
              <div class="grid grid-cols-3 gap-2 text-sm">
                <div class="text-slate-500 font-medium">Patient</div>
                <div class="col-span-2 font-semibold text-slate-900">${patientDetails?.name || 'N/A'}</div>
                <div class="text-slate-500 font-medium">Phone</div>
                <div class="col-span-2 font-mono text-slate-700">${patientDetails?.phone || 'N/A'}</div>
              </div>
              <div class="mt-4 pt-3 border-t border-slate-200 text-teal-600 font-medium text-center text-sm">
                ${subtext}
              </div>
            </div>
          `,
          icon: 'success',
          confirmButtonText: 'OK',
          confirmButtonColor: '#0d9488',
          customClass: {
            popup: 'rounded-2xl',
            confirmButton: 'rounded-lg font-semibold px-8 py-2'
          }
        });
      };

      if (regType === 'walk-in') {
        await startVisit(finalPatientId, undefined, false, regData.reasonForVisit || 'General Consultation');
        showSuccessModal('Registration Complete', isNewPatient ? "Patient registered and added to Waiting list" : "Walk-in added to Waiting list");
        setIsRegisterOpen(false);
        resetRegistrationForm();
      } else {
        const appointment = await addAppointment({
          patientId: finalPatientId,
          date: apptData.date,
          time: apptData.time,
          type: apptData.type as any,
          status: 'Scheduled',
          notes: apptData.notes
        });

        const today = new Date().toISOString().split('T')[0];
        if (apptData.date === today) {
          await confirmAppointmentArrival(appointment.id, apptData.type || 'General Consultation');
          showSuccessModal('Checked In', isNewPatient ? "Patient registered and checked in for today's appointment." : "Checked in for today's appointment.");
        } else {
          showSuccessModal('Appointment Booked', isNewPatient ? "Patient registered and appointment created." : "Appointment created successfully.");
        }

        setIsRegisterOpen(false);
        resetRegistrationForm();
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Failed to start walk-in visit");
    }
  };

  const handleAssignDoctor = async () => {
    if (!confirmAssignData) return;
    const { queueId, doctorId } = confirmAssignData;
    const result = await assignDoctor(queueId, doctorId);
    if (result.success) {
      const targetQ = queue.find(q => q.id === queueId);
      const doc = staff.find(d => d.id === doctorId);
      const patient = patients.find(p => p.id === targetQ?.patientId);

      MySwal.fire({
        title: `<span class="text-2xl font-bold text-slate-800">Doctor Assigned</span>`,
        html: `
          <div class="text-left bg-slate-50 p-4 rounded-xl border border-slate-100 mt-2">
            <div class="grid grid-cols-3 gap-2 text-sm">
              <div class="text-slate-500 font-medium">Patient</div>
              <div class="col-span-2 font-semibold text-slate-900">${patient?.name || 'N/A'}</div>
              <div class="text-slate-500 font-medium">Doctor</div>
              <div class="col-span-2 font-semibold text-slate-900">${doc?.name || 'N/A'}</div>
            </div>
            <div class="mt-4 pt-3 border-t border-slate-200 text-teal-600 font-medium text-center text-sm">
              Patient sent to doctor's queue.
            </div>
          </div>
        `,
        icon: 'success',
        confirmButtonText: 'OK',
        confirmButtonColor: '#0d9488',
        customClass: {
          popup: 'rounded-2xl',
          confirmButton: 'rounded-lg font-semibold px-8 py-2'
        }
      });

      setAssignQueueId(null);
      setConfirmAssignData(null);
    } else {
      toast.error(result.error || 'Failed to assign doctor');
    }
  };

  const handleOpenProcess = (row: any) => {
    const rx = prescriptions.find(r => r.visitId === row.visitId && r.status === 'Finalized');
    const disp = dispensings.find(d => d.visitId === row.visitId);

    if (rx) {
      const items = rx.items.map((ri, idx) => {
        const med = medicines.find(m => m.id === ri.medicineId);
        const dItem = disp?.items.find(di => di.medicineId === ri.medicineId);
        const availableStock = med?.currentStock || 0;
        const initialDispensed = dItem !== undefined ? dItem.dispensedQuantity : ri.quantity;
        const isDispensed = dItem !== undefined ? dItem.dispensedQuantity > 0 : true;

        return {
          id: `i${idx}`,
          medicineId: ri.medicineId,
          name: med?.name || 'Unknown',
          strength: med?.unit || '',
          categoryId: med?.categoryId || 'cat1',
          prescribedQty: ri.quantity,
          isDispensed: isDispensed,
          dispensedQty: isDispensed ? initialDispensed : 0,
          availableStock,
          unitPrice: med?.unitPrice || 0
        };
      });
      setActiveItems(items);
    } else {
      setActiveItems([]);
    }

    setActiveMethod(null);
    setPaymentAmount('');
    setPaymentReason('');
    setPaymentReasonOther('');
    setAltPhone('');
    setHasPrintedReceipt(false);
    setProcessTreatmentPlan(null);
    setProcessVisitId(row.visitId);

    const v = visits.find(vis => vis.id === row.visitId);
    const pId = row.patientId || v?.patientId;
    if (pId) {
      api.get<any>(`/api/patients/${pId}/treatment-plan`)
        .then(res => setProcessTreatmentPlan(res))
        .catch(() => setProcessTreatmentPlan(null));
    }
  };

  const handleCompleteDispensing = async () => {
    if (!processVisitId) return;
    const rx = prescriptions.find(r => r.visitId === processVisitId && r.status === 'Finalized');
    if (!rx) return;

    // Validate quantities for all items
    for (const item of activeItems) {
      if (item.isDispensed) {
        if (!item.dispensedQty || item.dispensedQty < 1) {
          toast.error(`Please enter a valid quantity (at least 1) for ${item.name} or uncheck Dispense.`);
          return;
        }
        if (item.dispensedQty > item.prescribedQty) {
          toast.error(`Dispense quantity for ${item.name} cannot exceed prescribed quantity (${item.prescribedQty}).`);
          return;
        }
        if (item.dispensedQty > item.availableStock) {
          toast.error(`Insufficient stock for ${item.name}. Available: ${item.availableStock}, Requested: ${item.dispensedQty}.`);
          return;
        }
      }
    }

    const mappedItems = activeItems.map(ai => ({
      medicineId: ai.medicineId,
      prescribedQuantity: ai.prescribedQty,
      dispensedQuantity: ai.isDispensed ? Number(ai.dispensedQty) : 0
    }));

    const result = await completeDispensing(processVisitId, rx.id, mappedItems);
    if (result.success) {
      toast.success('Dispensing completed');
    } else {
      toast.error(result.error || 'Failed to complete dispensing');
    }
  };

  const handleMarkAsPaid = async () => {
    if (activeProcessVisit?.paymentOwner === 'DOCTOR') {
      toast.error('Payment for this visit is handled by Doctor');
      return;
    }
    if (!processVisitId || !activeMethod) {
      toast.error('Please select a payment method');
      return;
    }
    const amt = Number(paymentAmount);
    if (!amt || amt <= 0) {
      toast.error('Please enter a valid payment amount');
      return;
    }

    const visitPayments = payments.filter(p => p.visitId === processVisitId);
    const totalPaid = visitPayments.reduce((sum, p) => sum + p.amount, 0);
    const calculatedDue = (activeProcessVisit?.consultationFee || 0) + (activeProcessVisit?.treatmentFee || 0) + (activeProcessVisit?.medicineCost || 0);
    const amountDue = calculatedDue > 0 ? calculatedDue : (activeProcessVisit?.amountDue || 0);
    const balance = amountDue - totalPaid;

    if (amt > balance) {
      toast.error(`Payment amount cannot exceed remaining balance (₹${balance})`);
      return;
    }

    const isPartial = amt < balance;
    let finalNotes: string | undefined;

    if (isPartial) {
      if (!paymentReason) {
        toast.error('A reason is required when leaving a balance.');
        return;
      }
      if (paymentReason === 'Other' && !paymentReasonOther.trim()) {
        toast.error('Please specify the reason for partial payment.');
        return;
      }
      if (!altPhone.trim()) {
        toast.error('Please provide an alternative phone number for partial payment.');
        return;
      }
      if (altPhone.trim().length !== 10) {
        toast.error('Please enter a valid 10-digit alternative phone number.');
        return;
      }

      const reasonText = paymentReason === 'Other' ? `Other: ${paymentReasonOther.trim()}` : paymentReason;
      finalNotes = `${reasonText} | Alt Phone: ${altPhone.trim()}`;
    }

    // Set pending confirmation modal state (clean React dialog, no DOM/portal or SweetAlert backdrop issues)
    setPendingPaymentConfirmation({
      visitId: processVisitId,
      amount: amt,
      method: activeMethod as 'Cash' | 'GPay' | 'Credit Card' | 'Debit Card',
      finalNotes,
      isPartial,
      remainingBalance: balance - amt,
      reasonText: paymentReason === 'Other' ? paymentReasonOther.trim() : paymentReason,
      altPhoneText: altPhone.trim()
    });
  };

  const handleConfirmPayment = async () => {
    if (!pendingPaymentConfirmation || isRecordingPayment) return;
    setIsRecordingPayment(true);

    try {
      const { visitId, amount, method, finalNotes } = pendingPaymentConfirmation;
      const result = await recordPayment(visitId, amount, method, finalNotes);
      if (result.success) {
        toast.success(`Payment of ₹${amount} via ${method} recorded successfully!`, { duration: 4000 });
        setPendingPaymentConfirmation(null);
        setPaymentAmount(''); // Reset for next payment if balance remains
        setPaymentReason('');
        setPaymentReasonOther('');
        setAltPhone('');
        setActiveMethod(null);
      } else {
        toast.error(result.error || 'Failed to record payment');
      }
    } catch (err) {
      console.error(err);
      toast.error('Unexpected error while recording payment');
    } finally {
      setIsRecordingPayment(false);
    }
  };

  const handlePrintDocument = async (type: 'prescription' | 'receipt' | 'invoice', paymentId?: string) => {
    try {
      const docUrl = paymentId
        ? `${API_BASE_URL}/api/documents/${type}/${processVisitId}?paymentId=${encodeURIComponent(paymentId)}`
        : `${API_BASE_URL}/api/documents/${type}/${processVisitId}`;
      const response = await fetch(docUrl, {
        method: 'GET',
        credentials: 'include'
      });
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || `Failed to print ${type}`);
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      window.open(url, '_blank');
      setTimeout(() => window.URL.revokeObjectURL(url), 1000);

      if (type === 'receipt') {
        setHasPrintedReceipt(true);
        toast.success('Receipt generated! You can now click Done to complete checkout.');
      } else if (type === 'invoice') {
        toast.success('Tax invoice generated successfully.');
      }
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || `Failed to load ${type} document.`);
    }
  };

  const handleCloseProcessVisit = () => {
    setProcessVisitId(null);
  };

  const activeProcessVisit = visits.find(v => v.id === processVisitId);
  const activeProcessPatient = patients.find(p => p.id === activeProcessVisit?.patientId);
  const activeProcessDoctor = doctors.find(d => d.id === activeProcessVisit?.doctorId);

  return (
    <div className="flex-1 bg-slate-50/50 flex flex-col h-screen overflow-hidden">
      <div className="h-auto py-3 shrink-0 px-4 sm:px-6 lg:px-8 flex flex-wrap items-center justify-between gap-3 sm:gap-4 border-b border-slate-200/80 bg-white/60 backdrop-blur-xs">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">Reception Desk</h1>
            {selectedDate !== todayStr && (
              <Badge className="bg-purple-100 text-purple-800 border-purple-200 font-semibold px-2.5 py-0.5 animate-pulse">
                Viewing: {selectedDate === tomorrowStr ? 'Tomorrow' : selectedDate}
              </Badge>
            )}
          </div>
          <p className="text-sm text-slate-500">
            {selectedDate === todayStr
              ? "Register patients, manage today's visits, and complete reception tasks."
              : `Reviewing scheduled queue and transferred patients for ${selectedDate}.`}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
          {/* Quick Date Switcher */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-semibold">
            <button
              type="button"
              onClick={() => setSelectedDate(todayStr)}
              className={`px-3 py-1.5 rounded-lg transition-all ${selectedDate === todayStr
                ? 'bg-white text-teal-700 shadow-xs font-bold'
                : 'text-slate-600 hover:text-slate-900'
                }`}
            >
              Today
            </button>
            <button
              type="button"
              onClick={() => setSelectedDate(tomorrowStr)}
              className={`px-3 py-1.5 rounded-lg transition-all ${selectedDate === tomorrowStr
                ? 'bg-white text-purple-700 shadow-xs font-bold'
                : 'text-slate-600 hover:text-slate-900'
                }`}
            >
              Tomorrow
            </button>
            <div className="relative flex items-center ml-1 border-l border-slate-200 pl-1">
              <Calendar className="w-3.5 h-3.5 text-slate-500 ml-1.5 pointer-events-none absolute" />
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => {
                  if (e.target.value) setSelectedDate(e.target.value);
                }}
                className="pl-7 pr-2 py-1 bg-transparent text-slate-700 font-medium text-xs focus:outline-none cursor-pointer"
                title="Choose custom date"
              />
            </div>
          </div>

          <Button
            onClick={() => {
              resetRegistrationForm();
              setIsRegisterOpen(true);
            }}
            className="bg-teal-600 hover:bg-teal-700 shadow-sm text-white shrink-0 font-medium"
          >
            <Users className="w-4 h-4 mr-2" />
            Register Patient
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-8">
        <div className="max-w-7xl mx-auto space-y-8">

          {/* Doctor Availability Section */}
          <section>
            <h2 className="text-sm font-semibold text-slate-900 uppercase tracking-wider mb-4 flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-slate-400" />
              Doctors
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {doctors.map(doc => {
                const avail = doctorAvailability[doc.id];
                const isLeave = avail === 'Leave';
                const isAvailable = avail === 'Available';

                const bgClass = isAvailable ? 'bg-emerald-600 border-emerald-700' : isLeave ? 'bg-slate-200 border-slate-300' : 'bg-rose-600 border-rose-700';
                const textClass = isLeave ? 'text-slate-700' : 'text-white';
                const textSubClass = isLeave ? 'text-slate-600' : 'text-white/90';

                return (
                  <div key={doc.id} className={`rounded-xl p-4 flex flex-col justify-between transition-all border shadow-md hover:shadow-lg ${bgClass} ${isLeave ? 'opacity-80' : ''} ${isAvailable ? 'animate-pulse' : ''}`}>
                    <div className="flex items-start justify-between mb-3 gap-2">
                      <div>
                        <h3 className={`font-bold text-lg leading-tight ${textClass}`}>{doc.name}</h3>
                        <p className={`font-bold text-sm ${textSubClass}`}>{doc.role}</p>
                        <p className={`font-bold text-sm ${textSubClass}`}>Room {doc.roomNumber || '—'}</p>
                      </div>
                      <Badge variant="outline"
                        className={`shrink-0 shadow-sm ${isAvailable ? 'bg-white/20 text-white border-white/20' : isLeave ? 'bg-slate-300 text-slate-700 border-slate-400' : 'bg-white/20 text-white border-white/20'}`}>
                        {isAvailable ? (
                          <span className="flex items-center gap-1.5 font-medium">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Available
                          </span>
                        ) : isLeave ? (
                          <span className="flex items-center gap-1.5 font-medium">
                            <XCircle className="w-3.5 h-3.5" />
                            Leave
                          </span>
                        ) : (
                          <span className="flex items-center gap-1.5 font-medium">
                            <Activity className="w-3.5 h-3.5" />
                            With Patient
                          </span>
                        )}
                      </Badge>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Unified Operations Table */}
          <section className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <DataTableToolbar
              searchQuery={search}
              onSearchChange={setSearch}
              searchPlaceholder="Search patients, doctors, tokens..."
              filterSlot={
                <>
                  <Select value={stageFilter} onValueChange={setStageFilter}>
                    <SelectTrigger className="h-9 w-[150px] bg-slate-50/50 border-slate-200 text-xs font-medium">
                      <SelectValue placeholder="All Stages" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Stages</SelectItem>
                      <SelectItem value="Waiting">Waiting</SelectItem>
                      <SelectItem value="With Doctor">With Doctor</SelectItem>
                      <SelectItem value="Next Day">Next Day</SelectItem>
                      <SelectItem value="Ready at Reception">Ready at Reception</SelectItem>
                      <SelectItem value="Completed">Completed</SelectItem>
                      <SelectItem value="Cancelled">Cancelled</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select value={visitTypeFilter} onValueChange={setVisitTypeFilter}>
                    <SelectTrigger className="h-9 w-[140px] bg-slate-50/50 border-slate-200 text-xs font-medium">
                      <SelectValue placeholder="All Types" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Types</SelectItem>
                      <SelectItem value="Walk-in">Walk-in</SelectItem>
                      <SelectItem value="Appointment">Appointment</SelectItem>
                    </SelectContent>
                  </Select>
                </>
              }
              exportOptions={{
                pdf: true,
                excel: true,
                csv: true,
                onExport: async (format) => {
                  try {
                    const query = new URLSearchParams();
                    query.set('format', format);
                    if (selectedDate) query.set('date', selectedDate);
                    if (search) query.set('search', search);
                    if (stageFilter && stageFilter !== 'all') query.set('stage', stageFilter);
                    if (visitTypeFilter && visitTypeFilter !== 'all') query.set('visitType', visitTypeFilter);
                    const ext = format === 'pdf' ? 'pdf' : format === 'xlsx' ? 'xlsx' : 'csv';
                    await api.download(`/api/visits/export?${query.toString()}`, `reception_desk_export_${selectedDate}.${ext}`);
                    toast.success(`Exported ${format.toUpperCase()} successfully`);
                  } catch (err: any) {
                    toast.error(err.message || 'Failed to export data');
                  }
                }
              }}
            />
            {/* Multi-select Action Bar for Transferring Patients */}
            {selectedWaitingIds.length > 0 && selectedDate === todayStr && (
              <div className="bg-purple-50 border-b border-purple-200 px-6 py-3 flex items-center justify-between flex-wrap gap-3 animate-in fade-in slide-in-from-top-2 duration-200">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-purple-600 text-white flex items-center justify-center font-bold text-sm">
                    {selectedWaitingIds.length}
                  </div>
                  <div>
                    <h4 className="font-bold text-purple-950 text-sm">
                      {selectedWaitingIds.length} Waiting Patient{selectedWaitingIds.length > 1 ? 's' : ''} Selected
                    </h4>
                    <p className="text-xs text-purple-700">
                      Unserved at closing? Transfer them directly to tomorrow's queue with allotted tokens.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-purple-700 hover:bg-purple-100 font-medium text-xs"
                    onClick={() => setSelectedWaitingIds([])}
                  >
                    Clear Selection
                  </Button>
                  <Button
                    size="sm"
                    className="bg-purple-600 hover:bg-purple-700 text-white font-semibold text-xs shadow-sm flex items-center gap-1.5"
                    onClick={() => setIsTransferDialogOpen(true)}
                  >
                    <ArrowRightLeft className="w-3.5 h-3.5" />
                    Transfer to Next Day
                  </Button>
                </div>
              </div>
            )}

            <div className="p-4">
              <DataTable
                columns={columns}
                data={unifiedData}
                totalRecords={unifiedData.length}
              />
            </div>
          </section>

        </div>
      </div>

      {/* Transfer to Next Day Dialog */}
      <Dialog open={isTransferDialogOpen} onOpenChange={open => !open && !isTransferring && setIsTransferDialogOpen(false)}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center mb-2">
              <ArrowRightLeft className="w-5 h-5" />
            </div>
            <DialogTitle className="text-lg font-bold text-slate-900">
              Transfer Patients to Next Day Queue
            </DialogTitle>
            <DialogDescription className="text-sm text-slate-500">
              Selected waiting patients will be transferred directly into tomorrow's queue with tokens allotted (no check-in needed).
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-3">
            {/* Selected Patients List */}
            <div className="bg-slate-50 rounded-xl p-3 border border-slate-200">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 block mb-2">
                Patients to Transfer ({selectedWaitingIds.length})
              </label>
              <div className="max-h-[140px] overflow-y-auto space-y-1.5 pr-1">
                {selectedWaitingIds.map((visitId, idx) => {
                  const item = unifiedData.find(d => d.visitId === visitId);
                  return (
                    <div key={visitId} className="flex items-center justify-between text-xs bg-white p-2 rounded-lg border border-slate-200/70">
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-purple-100 text-purple-700 font-bold flex items-center justify-center text-[10px]">
                          {idx + 1}
                        </span>
                        <span className="font-semibold text-slate-800">{item?.patientName || 'Patient'}</span>
                        <span className="text-slate-400">({item?.patientPhone})</span>
                      </div>
                      <span className="text-slate-500 font-medium">{item?.doctor || 'Any Doctor'}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Target Date Picker */}
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Target Date *
              </label>
              <Input
                type="date"
                min={tomorrowStr}
                value={transferTargetDate}
                onChange={(e) => setTransferTargetDate(e.target.value)}
                className="w-full"
              />
              <p className="text-[11px] text-slate-500 mt-1">
                Defaults to tomorrow ({tomorrowStr}). You can pick another date if needed.
              </p>
            </div>

            {/* Reason */}
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Transfer Reason
              </label>
              <Input
                value={transferReason}
                onChange={(e) => setTransferReason(e.target.value)}
                placeholder="Reason for transferring patients"
                className="w-full text-xs"
              />
            </div>

            {/* Notice / Priority Highlight */}
            <div className="bg-purple-50/70 border border-purple-200/80 rounded-lg p-3 text-xs text-purple-900 flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-purple-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold">Priority Booking Enabled:</span> These patients will appear at the top of tomorrow's queue with priority tags so they are served first without waiting again.
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsTransferDialogOpen(false)}
              disabled={isTransferring}
            >
              Cancel
            </Button>
            <Button
              type="button"
              className="bg-purple-600 hover:bg-purple-700 text-white font-semibold flex items-center gap-1.5"
              disabled={isTransferring || selectedWaitingIds.length === 0}
              onClick={async () => {
                if (!transferTargetDate) {
                  toast.error('Please choose a target date');
                  return;
                }
                setIsTransferring(true);
                try {
                  const res = await transferVisitsToNextDay(
                    selectedWaitingIds,
                    transferTargetDate,
                    transferReason,
                    true
                  );

                  if (res.success) {
                    toast.success(res.message || 'Transferred patients to next day successfully!');
                    setSelectedWaitingIds([]);
                    setIsTransferDialogOpen(false);

                    // Ask receptionist if they want to view tomorrow's queue
                    const checkTomorrow = await MySwal.fire({
                      title: 'Transferred Successfully!',
                      text: `${res.transferredCount || selectedWaitingIds.length} patients transferred to ${transferTargetDate}. Would you like to view that day's list now?`,
                      icon: 'success',
                      showCancelButton: true,
                      confirmButtonText: 'View Tomorrow',
                      cancelButtonText: 'Stay on Today',
                      confirmButtonColor: '#9333ea', // purple-600
                      cancelButtonColor: '#94a3b8',
                      customClass: {
                        popup: 'rounded-2xl',
                        confirmButton: 'rounded-lg font-semibold px-6 py-2',
                        cancelButton: 'rounded-lg font-semibold px-6 py-2'
                      }
                    });

                    if (checkTomorrow.isConfirmed) {
                      setSelectedDate(transferTargetDate);
                    }
                  } else {
                    toast.error(res.error || 'Failed to transfer patients');
                  }
                } catch (err: any) {
                  toast.error(err.message || 'Error occurred while transferring');
                } finally {
                  setIsTransferring(false);
                }
              }}
            >
              {isTransferring ? 'Transferring...' : `Transfer ${selectedWaitingIds.length} Patients`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Doctor Assignment Modal */}
      <Dialog open={!!assignQueueId && !confirmAssignData} onOpenChange={open => !open && setAssignQueueId(null)}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Send to Doctor</DialogTitle>
            <DialogDescription>Select an available doctor for this patient.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-4">
            {doctors.map(doc => {
              const avail = doctorAvailability[doc.id];
              const isAvail = avail === 'Available';
              const isLeave = avail === 'Leave';

              return (
                <div key={doc.id} className={`flex items-center justify-between p-3 rounded-lg border transition-all ${isAvail ? 'border-emerald-200 bg-emerald-50' : isLeave ? 'border-slate-200 bg-slate-50 opacity-60' : 'border-red-200 bg-red-50 opacity-70'}`}>
                  <div>
                    <h4 className={`font-medium ${isAvail ? 'text-emerald-900' : isLeave ? 'text-slate-600' : 'text-red-900'}`}>
                      {doc.name} {isLeave && <span className="text-xs font-normal ml-2">(On Leave)</span>}
                    </h4>
                    <span className={`text-xs ${isAvail ? 'text-emerald-600' : isLeave ? 'text-slate-500' : 'text-red-600'}`}>Room {doc.roomNumber || '—'}</span>
                  </div>
                  <Button
                    size="sm"
                    variant={isAvail ? "default" : "secondary"}
                    disabled={!isAvail}
                    onClick={() => setConfirmAssignData({ queueId: assignQueueId!, doctorId: doc.id, doctorName: doc.name })}
                    className={isAvail ? 'bg-teal-600 hover:bg-teal-700' : ''}
                  >
                    Send
                  </Button>
                </div>
              );
            })}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignQueueId(null)}>Cancel</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Payment Confirmation Modal */}
      <Dialog open={!!pendingPaymentConfirmation} onOpenChange={open => {
        if (!open && !isRecordingPayment) setPendingPaymentConfirmation(null);
      }}>
        <DialogContent className="sm:max-w-[440px] p-6">
          <DialogHeader className="text-center pb-2">
            <div className="w-12 h-12 rounded-full bg-teal-50 border border-teal-200 text-teal-600 flex items-center justify-center mx-auto mb-3">
              <CreditCard className="w-6 h-6" />
            </div>
            <DialogTitle className="text-lg font-bold text-slate-900">Confirm Payment</DialogTitle>
            <DialogDescription className="text-sm text-slate-500">
              Are you sure you want to record the following payment?
            </DialogDescription>
          </DialogHeader>

          {pendingPaymentConfirmation && (
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3 my-2 text-sm">
              <div className="flex justify-between items-center">
                <span className="text-slate-500 font-medium">Amount:</span>
                <strong className="text-slate-900 text-lg font-bold">₹{pendingPaymentConfirmation.amount}</strong>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500 font-medium">Payment Method:</span>
                <Badge className="bg-teal-100 text-teal-800 border-teal-200 font-semibold px-2.5 py-0.5">
                  {pendingPaymentConfirmation.method}
                </Badge>
              </div>
              {pendingPaymentConfirmation.isPartial && (
                <>
                  <div className="border-t border-dashed border-slate-200 pt-2.5 flex justify-between items-center">
                    <span className="text-amber-700 font-medium">Remaining Balance:</span>
                    <strong className="text-amber-700 font-bold">₹{pendingPaymentConfirmation.remainingBalance}</strong>
                  </div>
                  <div className="text-xs text-slate-500 space-y-1 pt-1 bg-amber-50/50 p-2.5 rounded-lg border border-amber-200/60">
                    <div><span className="font-semibold text-slate-700">Reason:</span> {pendingPaymentConfirmation.reasonText}</div>
                    <div><span className="font-semibold text-slate-700">Alt Phone:</span> {pendingPaymentConfirmation.altPhoneText}</div>
                  </div>
                </>
              )}
            </div>
          )}

          <DialogFooter className="mt-3 flex sm:justify-between gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setPendingPaymentConfirmation(null)}
              disabled={isRecordingPayment}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleConfirmPayment}
              disabled={isRecordingPayment}
              className="flex-1 bg-teal-600 hover:bg-teal-700 text-white font-semibold"
            >
              {isRecordingPayment ? 'Recording...' : 'Yes, Record Payment'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmation Modals */}
      <Dialog open={!!confirmAssignData} onOpenChange={open => !open && setConfirmAssignData(null)}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Confirm Assignment</DialogTitle>
            <DialogDescription>Are you sure you want to assign this patient to {confirmAssignData?.doctorName}?</DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setConfirmAssignData(null)}>Cancel</Button>
            <Button className="bg-teal-600 hover:bg-teal-700" onClick={handleAssignDoctor}>Confirm Assignment</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!registrationSuccessData} onOpenChange={open => {
        if (!open) {
          setRegistrationSuccessData(null);
          setIsRegisterOpen(false);
          resetRegistrationForm();
        }
      }}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-emerald-600"><CheckCircle2 className="w-5 h-5" /> Registration Successful</DialogTitle>
            <DialogDescription>{registrationSuccessData?.name} has been successfully registered and added to the queue.</DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4">
            <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={() => {
              setRegistrationSuccessData(null);
              setIsRegisterOpen(false);
              resetRegistrationForm();
            }}>OK</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteVisitId} onOpenChange={open => !open && setDeleteVisitId(null)}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Delete Visit</DialogTitle>
            <DialogDescription>
              Visit deletion is currently disabled to maintain financial and clinical audit trails. Please contact the administrator for corrections.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4">
            <Button variant="default" onClick={() => setDeleteVisitId(null)}>Understood</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Register Patient Sheet */}
      <Sheet open={isRegisterOpen} onOpenChange={(open) => {
        setIsRegisterOpen(open);
        resetRegistrationForm();
      }}>
        <SheetContent
          side="right"
          className="w-[400px] sm:w-[540px] p-0 flex flex-col bg-slate-50 h-full"
          onInteractOutside={(e) => {
            if (isCameraOpen) e.preventDefault();
          }}
        >
          <SheetTitle className="sr-only">Register Patient</SheetTitle>
          <div className="h-16 px-6 border-b border-slate-200 bg-white flex items-center justify-between shrink-0">
            <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
              <Users className="w-5 h-5 text-teal-600" />
              Register Patient
            </h2>
          </div>

          <div className="flex-1 overflow-y-auto p-6">
            <div className="space-y-6">
              <DrawerSection title="Registration Type">
                <div className="flex gap-4">
                  <Button
                    variant={regType === 'walk-in' ? 'default' : 'outline'}
                    className={regType === 'walk-in' ? 'bg-teal-600 text-white hover:bg-teal-700' : ''}
                    onClick={() => setRegType('walk-in')}
                  >
                    Walk-in
                  </Button>
                  <Button
                    variant={regType === 'appointment' ? 'default' : 'outline'}
                    className={regType === 'appointment' ? 'bg-teal-600 text-white hover:bg-teal-700' : ''}
                    onClick={() => setRegType('appointment')}
                  >
                    Appointment
                  </Button>
                </div>
              </DrawerSection>

              <DrawerSection title="Patient Selection">
                <div className="space-y-4">
                  <div className="flex gap-4">
                    <Button
                      variant={!isNewPatient ? 'default' : 'outline'}
                      className={!isNewPatient ? 'bg-indigo-600 text-white hover:bg-indigo-700' : ''}
                      onClick={() => setIsNewPatient(false)}
                    >
                      Existing Patient
                    </Button>
                    <Button
                      variant={isNewPatient ? 'default' : 'outline'}
                      className={isNewPatient ? 'bg-indigo-600 text-white hover:bg-indigo-700' : ''}
                      onClick={() => setIsNewPatient(true)}
                    >
                      New Patient
                    </Button>
                  </div>

                  {!isNewPatient ? (
                    <div className="space-y-3">
                      <label className="text-sm font-medium text-slate-700 block">Search & Select Patient *</label>

                      {selectedExistingPatientId ? (
                        <div className="flex items-center justify-between p-3 border border-teal-200 bg-teal-50/50 rounded-lg shadow-sm">
                          <div>
                            <div className="font-medium text-teal-900">
                              {patients.find(p => p.id === selectedExistingPatientId)?.name}
                            </div>
                            <div className="text-sm text-teal-700">
                              {patients.find(p => p.id === selectedExistingPatientId)?.phone || 'No phone recorded'}
                            </div>
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            className="border-teal-200 text-teal-700 hover:bg-teal-100"
                            onClick={() => {
                              setSelectedExistingPatientId('');
                              setPatientSearch('');
                            }}
                          >
                            Change
                          </Button>
                        </div>
                      ) : (
                        <>
                          <div className="relative">
                            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                            <Input
                              placeholder="Search by name or phone..."
                              className="pl-9 bg-white"
                              value={patientSearch}
                              onChange={e => setPatientSearch(e.target.value)}
                            />
                          </div>

                          <div className="border border-slate-200 rounded-md bg-white max-h-48 overflow-y-auto shadow-sm">
                            {patients
                              .filter(p => p.name.toLowerCase().includes(patientSearch.toLowerCase()) || (p.phone && p.phone.includes(patientSearch)))
                              .map(p => (
                                <div
                                  key={p.id}
                                  onClick={() => {
                                    setSelectedExistingPatientId(p.id);
                                    setPatientSearch('');
                                  }}
                                  className="px-3 py-2 text-sm cursor-pointer hover:bg-slate-50 border-b border-slate-100 last:border-0 text-slate-700"
                                >
                                  <div className="font-medium">{p.name}</div>
                                  <div className="text-xs text-slate-500 mt-0.5">{p.phone || 'No phone recorded'}</div>
                                </div>
                              ))}
                            {patients.filter(p => p.name.toLowerCase().includes(patientSearch.toLowerCase()) || (p.phone && p.phone.includes(patientSearch))).length === 0 && (
                              <div className="px-3 py-6 text-center text-sm text-slate-500">
                                No patients found.
                              </div>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-4 mt-4 border-t border-slate-100 pt-4">
                      {/* Photo Capture */}
                      <div className="mt-2 mb-4">
                        <label className="text-sm font-medium text-slate-700 mb-2 block">Patient Photo</label>

                        {isCameraOpen ? (
                          <CameraCapture
                            onCapture={(imageSrc) => {
                              setRegData({ ...regData, photoUrl: imageSrc });
                              setIsCameraOpen(false);
                            }}
                            onCancel={() => setIsCameraOpen(false)}
                          />
                        ) : (
                          <div className="flex flex-col items-center justify-center p-4 bg-slate-50 border border-slate-200 border-dashed rounded-xl">
                            {(regData as any).photoUrl ? (
                              <div className="flex flex-col items-center gap-3 mt-2 mb-2">
                                <img src={(regData as any).photoUrl} alt="Patient" className="w-24 h-24 rounded-md object-cover border-4 border-white shadow-sm" />
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() => setIsCameraOpen(true)}
                                  className="text-teal-600 border-teal-200 hover:bg-teal-50"
                                >
                                  <Camera className="w-4 h-4 mr-2" />
                                  Replace Photo
                                </Button>
                              </div>
                            ) : (
                              <div className="cursor-pointer flex flex-col items-center gap-2" onClick={() => setIsCameraOpen(true)}>
                                <div className="w-12 h-12 bg-slate-200 rounded-md flex items-center justify-center text-slate-500 hover:text-slate-700 hover:bg-slate-300 transition-colors shadow-inner">
                                  <Camera className="w-5 h-5" />
                                </div>
                                <span className="text-xs font-medium text-slate-600">Open Camera</span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      <div>
                        <label className="text-sm font-medium text-slate-700 mb-1 block">Full Name <span className="text-red-500">*</span></label>
                        <Input placeholder="Enter patient name" value={regData.name} onChange={e => setRegData({ ...regData, name: e.target.value })} />
                      </div>
                      <div>
                        <label className="text-sm font-medium text-slate-700 mb-1 block">Phone Number <span className="text-red-500">*</span></label>
                        <Input placeholder="10-digit mobile number" value={regData.phone} onChange={e => setRegData({ ...regData, phone: e.target.value.replace(/\D/g, '').slice(0, 10) })} maxLength={10} />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="text-sm font-medium text-slate-700 mb-1 block">Age <span className="text-red-500">*</span></label>
                          <Input placeholder="e.g. 30" value={regData.age} onChange={e => setRegData({ ...regData, age: e.target.value.replace(/\D/g, '').slice(0, 3) })} maxLength={3} />
                        </div>
                        <div>
                          <label className="text-sm font-medium text-slate-700 mb-1 block">Gender</label>
                          <Select value={regData.gender} onValueChange={(val) => setRegData({ ...regData, gender: val })}>
                            <SelectTrigger className="w-full bg-white border-slate-200">
                              <SelectValue placeholder="Select Gender" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Male">Male</SelectItem>
                              <SelectItem value="Female">Female</SelectItem>
                              <SelectItem value="Other">Other</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-slate-700 mb-1 block">Address (Optional)</label>
                        <textarea
                          placeholder="Patient address"
                          className="flex min-h-[80px] w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm ring-offset-white placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 resize-none"
                          value={(regData as any).address || ''}
                          onChange={e => setRegData({ ...regData, address: e.target.value })}
                        />
                      </div>

                    </div>
                  )}

                  {regType === 'walk-in' && (
                    <div className="mt-4 pt-4 border-t border-slate-100">
                      <label className="text-sm font-medium text-slate-700 mb-1 block">Reason for Visit</label>
                      <Select value={regData.reasonForVisit} onValueChange={(val) => setRegData({ ...regData, reasonForVisit: val })}>
                        <SelectTrigger className="w-full bg-white border-slate-200">
                          <SelectValue placeholder="Select Reason for Visit" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Routine Checkup">Routine Checkup</SelectItem>
                          <SelectItem value="Toothache">Toothache</SelectItem>
                          <SelectItem value="Cleaning">Cleaning</SelectItem>
                          <SelectItem value="Follow-up">Follow-up</SelectItem>
                          <SelectItem value="Emergency">Emergency</SelectItem>
                          <SelectItem value="Consultation">Consultation</SelectItem>
                          <SelectItem value="Surgery">Surgery</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>
              </DrawerSection>

              {regType === 'appointment' && (
                <DrawerSection title="Appointment Details">
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm font-medium text-slate-700 mb-1 block">Date <span className="text-red-500">*</span></label>
                        <Input type="date" min={new Date().toISOString().split('T')[0]} value={apptData.date} onChange={e => setApptData({ ...apptData, date: e.target.value })} />
                      </div>
                      <div>
                        <label className="text-sm font-medium text-slate-700 mb-1 block">Time</label>
                        <Input type="time" value={apptData.time} onChange={e => setApptData({ ...apptData, time: e.target.value })} />
                      </div>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-slate-700 mb-1 block">Reason for Visit</label>
                      <Select value={apptData.type} onValueChange={(val) => setApptData({ ...apptData, type: val })}>
                        <SelectTrigger className="w-full bg-white border-slate-200">
                          <SelectValue placeholder="Select Reason for Visit" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Routine Checkup">Routine Checkup</SelectItem>
                          <SelectItem value="Toothache">Toothache</SelectItem>
                          <SelectItem value="Cleaning">Cleaning</SelectItem>
                          <SelectItem value="Follow-up">Follow-up</SelectItem>
                          <SelectItem value="Emergency">Emergency</SelectItem>
                          <SelectItem value="Consultation">Consultation</SelectItem>
                          <SelectItem value="Surgery">Surgery</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-slate-700 mb-1 block">Notes (Optional)</label>
                      <Input placeholder="Enter any notes" value={apptData.notes} onChange={e => setApptData({ ...apptData, notes: e.target.value })} />
                    </div>
                  </div>
                </DrawerSection>
              )}
            </div>
          </div>

          <div className="border-t border-slate-200 bg-white p-4 shrink-0 flex items-center justify-end gap-3 shadow-[0_-4px_12px_rgba(0,0,0,0.02)]">
            <Button variant="outline" onClick={() => {
              setIsRegisterOpen(false);
              resetRegistrationForm();
            }}>
              Cancel
            </Button>
            <Button onClick={handleRegister} className="bg-teal-600 hover:bg-teal-700">
              {regType === 'appointment' ? 'Create Appointment' : 'Register Patient'}
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Edit/View Patient Sheet */}
      <Sheet open={isEditPatientOpen} onOpenChange={setIsEditPatientOpen}>
        <SheetContent
          side="right"
          className="w-[400px] sm:w-[540px] p-0 flex flex-col bg-slate-50 h-full"
          onInteractOutside={(e) => {
            if (isCameraOpen) e.preventDefault();
          }}
        >
          <SheetTitle className="sr-only">{editDrawerMode === 'view' ? 'View Patient Details' : 'Edit Patient Details'}</SheetTitle>
          <div className="h-16 px-6 border-b border-slate-200 bg-white flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2.5">
              <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                <Users className="w-5 h-5 text-teal-600" />
                {editDrawerMode === 'view' ? 'View Patient Details' : 'Edit Patient Details'}
              </h2>
              {(() => {
                const patVisits = visits.filter(v => v.patientId === editingPatientId && v.status !== 'CANCELLED');
                const isNew = patVisits.length <= 1;
                return (
                  <Badge
                    variant="outline"
                    className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${isNew
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                      : 'bg-blue-50 text-blue-700 border-blue-300'
                      }`}
                  >
                    {isNew ? 'New Patient' : 'Existing Patient'}
                  </Badge>
                );
              })()}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-6">
            <div className="space-y-6">
              <DrawerSection title="Patient Information">
                <div className="space-y-4">
                  <div className="flex flex-col items-center justify-center mb-6 gap-2">
                    {editDrawerMode === 'view' ? (
                      (regData as any).photoUrl ? (
                        <img src={(regData as any).photoUrl} alt="Patient" className="w-24 h-24 rounded-md object-cover border-4 border-white shadow-sm" />
                      ) : (
                        <div className="w-24 h-24 rounded-md bg-slate-200 flex items-center justify-center text-slate-400 border-4 border-white shadow-sm">
                          <Users className="w-10 h-10" />
                        </div>
                      )
                    ) : (
                      isCameraOpen ? (
                        <CameraCapture
                          onCapture={(photoUrl) => {
                            setRegData({ ...regData, photoUrl });
                            setIsCameraOpen(false);
                          }}
                          onCancel={() => setIsCameraOpen(false)}
                        />
                      ) : (
                        <div className="flex flex-col items-center justify-center p-4 bg-slate-50 border border-slate-200 border-dashed rounded-xl w-full">
                          {(regData as any).photoUrl ? (
                            <div className="flex flex-col items-center gap-3">
                              <img src={(regData as any).photoUrl} alt="Patient" className="w-24 h-24 rounded-md object-cover border-4 border-white shadow-sm" />
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => setIsCameraOpen(true)}
                                className="text-teal-600 border-teal-200 hover:bg-teal-50"
                              >
                                <Camera className="w-4 h-4 mr-2" />
                                Replace Photo
                              </Button>
                            </div>
                          ) : (
                            <div className="cursor-pointer flex flex-col items-center gap-2" onClick={() => setIsCameraOpen(true)}>
                              <div className="w-16 h-16 bg-slate-200 rounded-md flex items-center justify-center text-slate-500 hover:text-slate-700 hover:bg-slate-300 transition-colors shadow-inner">
                                <Camera className="w-8 h-8" />
                              </div>
                              <span className="text-sm font-medium text-slate-600">Capture Photo</span>
                            </div>
                          )}
                        </div>
                      )
                    )}
                  </div>
                  <div>
                    <label className="text-sm font-medium text-slate-700 mb-1 block">Full Name <span className="text-red-500">*</span></label>
                    <Input disabled={editDrawerMode === 'view'} placeholder="e.g. John Doe" value={regData.name} onChange={e => setRegData({ ...regData, name: e.target.value })} />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-slate-700 mb-1 block">Phone Number <span className="text-red-500">*</span></label>
                    <Input disabled={editDrawerMode === 'view'} placeholder="e.g. 9876543210" value={regData.phone} onChange={e => setRegData({ ...regData, phone: e.target.value.replace(/\D/g, '').slice(0, 10) })} maxLength={10} />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium text-slate-700 mb-1 block">Age <span className="text-red-500">*</span></label>
                      <Input disabled={editDrawerMode === 'view'} placeholder="e.g. 30" value={regData.age} onChange={e => setRegData({ ...regData, age: e.target.value.replace(/\D/g, '').slice(0, 3) })} maxLength={3} />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-slate-700 mb-1 block">Gender</label>
                      <Select disabled={editDrawerMode === 'view'} value={regData.gender} onValueChange={(val) => setRegData({ ...regData, gender: val })}>
                        <SelectTrigger className="w-full bg-white border-slate-200 disabled:opacity-50 disabled:cursor-not-allowed">
                          <SelectValue placeholder="Select Gender" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Male">Male</SelectItem>
                          <SelectItem value="Female">Female</SelectItem>
                          <SelectItem value="Other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-slate-700 mb-1 block">Address (Optional)</label>
                    <textarea
                      disabled={editDrawerMode === 'view'}
                      placeholder="Patient address"
                      className="flex min-h-[80px] w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm ring-offset-white placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 resize-none"
                      value={(regData as any).address || ''}
                      onChange={e => setRegData({ ...regData, address: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-slate-700 mb-1 block">Reason for Visit</label>
                    <Select disabled={editDrawerMode === 'view'} value={regData.reasonForVisit} onValueChange={(val) => setRegData({ ...regData, reasonForVisit: val })}>
                      <SelectTrigger className="w-full bg-white border-slate-200 disabled:opacity-50 disabled:cursor-not-allowed">
                        <SelectValue placeholder="Select Reason for Visit" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Routine Checkup">Routine Checkup</SelectItem>
                        <SelectItem value="Toothache">Toothache</SelectItem>
                        <SelectItem value="Cleaning">Cleaning</SelectItem>
                        <SelectItem value="Follow-up">Follow-up</SelectItem>
                        <SelectItem value="Emergency">Emergency</SelectItem>
                        <SelectItem value="Consultation">Consultation</SelectItem>
                        <SelectItem value="Surgery">Surgery</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </DrawerSection>
            </div>
          </div>

          <div className="p-6 bg-white border-t border-slate-200 shrink-0">
            <div className="flex gap-3">
              <Button variant={editDrawerMode === 'view' ? 'default' : 'outline'} className="flex-1" onClick={() => setIsEditPatientOpen(false)}>{editDrawerMode === 'view' ? 'Close' : 'Cancel'}</Button>
              {editDrawerMode === 'edit' && (
                <Button
                  className="flex-1 bg-teal-600 hover:bg-teal-700"
                  onClick={async () => {
                    if (editingPatientId && updatePatient) {
                      await updatePatient(editingPatientId, {
                        name: regData.name,
                        phone: regData.phone,
                        age: parseInt(regData.age as string) || 0,
                        gender: regData.gender as any,
                        photoUrl: (regData as any).photoUrl,
                        address: (regData as any).address
                      });
                      if (editingVisitId && updateVisit) {
                        await updateVisit(editingVisitId, {
                          reasonForVisit: regData.reasonForVisit
                        });
                      }
                      toast.success('Patient details updated successfully!');
                      setIsEditPatientOpen(false);
                    }
                  }}
                  disabled={!regData.name || !regData.phone}
                >
                  Save Details
                </Button>
              )}
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Process Visit Drawer */}
      <Sheet open={!!processVisitId} onOpenChange={open => {
        if (!open) {
          handleCloseProcessVisit();
        }
      }}>
        <SheetContent
          side="right"
          className="w-[480px] sm:w-[680px] p-0 flex flex-col bg-slate-50 h-full"
        >
          <SheetTitle className="sr-only">Checkout & Billing</SheetTitle>
          <div className="h-16 px-6 border-b border-slate-200 bg-white flex flex-col justify-center shrink-0">
            <h2 className="text-lg font-semibold text-slate-900">Checkout & Billing</h2>
            <p className="text-xs text-slate-500">
              {activeProcessPatient?.name ? `${activeProcessPatient.name} • ` : ''}Doctor: {activeProcessDoctor?.name || 'Not assigned'}
            </p>
          </div>

          <div className="flex-1 overflow-y-auto p-5 space-y-4">

            {/* Dynamic Step Calculations */}
            {(() => {
              const isDoctorHandled = activeProcessVisit?.paymentOwner === 'DOCTOR';
              const hasPrescription = prescriptions.some(p => p.visitId === processVisitId && p.status === 'Finalized');
              const hasCompletedDispensing = dispensings.some(d => d.visitId === processVisitId);
              const isDispensingStep = hasPrescription && !hasCompletedDispensing;

              const visitPayments = payments.filter(p => p.visitId === processVisitId);
              const totalPaid = visitPayments.reduce((sum, p) => sum + p.amount, 0);
              const calculatedDue = (activeProcessVisit?.consultationFee || 0) + (activeProcessVisit?.treatmentFee || 0) + (activeProcessVisit?.medicineCost || 0);
              const amountDue = calculatedDue > 0 ? calculatedDue : (activeProcessVisit?.amountDue || 0);
              const balance = amountDue - totalPaid;

              const hasCompletedPayment = isDoctorHandled || activeProcessVisit?.status === 'COMPLETED' || (balance <= 0 && (!hasPrescription || hasCompletedDispensing));
              // Only a step if dispensing is done AND balance is still > 0
              const isPaymentStep = !isDoctorHandled && (!hasPrescription || hasCompletedDispensing) && balance > 0;
              // Workflow is completed only when visit is COMPLETED or when both dispensing is done AND payment is completely paid (or handled by doctor)
              const isWorkflowCompleted = isDoctorHandled
                ? (!hasPrescription || hasCompletedDispensing)
                : (activeProcessVisit?.status === 'COMPLETED' || ((!hasPrescription || hasCompletedDispensing) && balance <= 0));
              const activeConsultation = consultations.find(c => c.visitId === processVisitId);

              return (
                <>
                  <DrawerSection title="Visit Details">
                    <div className="bg-white p-4 rounded-xl border border-slate-200 text-xs text-slate-700 space-y-3.5 shadow-xs">
                      {/* Key Details Grid */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {/* Reason for Visit */}
                        <div className="p-3 bg-slate-50/70 rounded-lg border border-slate-100 flex flex-col justify-center">
                          <span className="text-slate-400 text-[10px] font-bold uppercase tracking-wider mb-1">Reason for Visit</span>
                          <span className="text-slate-900 font-semibold text-sm truncate">
                            {activeConsultation?.reasonForVisit || activeProcessVisit?.reasonForVisit || 'Not specified'}
                          </span>
                        </div>

                        {/* Fees Breakdown */}
                        {!isDoctorHandled && (
                          <div className="p-3 bg-slate-50/70 rounded-lg border border-slate-100 flex flex-col justify-center">
                            <span className="text-slate-400 text-[10px] font-bold uppercase tracking-wider mb-1">Fees</span>
                            <div className="flex items-center justify-between gap-2 text-xs">
                              <span className="text-slate-600">
                                Consulting: <strong className="text-slate-900 font-semibold">₹{activeConsultation?.consultationFee || 0}</strong>
                              </span>
                              <span className="text-slate-300">•</span>
                              <span className="text-slate-600">
                                Treatment: <strong className="text-slate-900 font-semibold">₹{activeProcessVisit?.treatmentFee || 0}</strong>
                              </span>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Clinical Notes */}
                      {activeConsultation?.clinicalNotes && (
                        <div className="p-3 bg-slate-50/50 rounded-lg border border-slate-100">
                          <span className="text-slate-400 block text-[10px] font-bold uppercase tracking-wider mb-1">Clinical Notes</span>
                          <p className="text-slate-700 whitespace-pre-wrap leading-relaxed text-xs">
                            {activeConsultation.clinicalNotes}
                          </p>
                        </div>
                      )}

                      {/* Treatment Plan Section (if existed for this active visit) */}
                      {processTreatmentPlan && processTreatmentPlan.items && processTreatmentPlan.items.filter((item: any) => item.completedVisitId === activeProcessVisit?.id).length > 0 && (
                        <div className="pt-2 border-t border-slate-100 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-slate-500 text-[11px] font-bold uppercase tracking-wider flex items-center gap-1.5">
                              <Activity className="w-3.5 h-3.5 text-indigo-500" />
                              Treatment Procedures ({processTreatmentPlan.items.filter((item: any) => item.completedVisitId === activeProcessVisit?.id).length})
                            </span>
                          </div>
                          <div className="bg-slate-50/70 border border-slate-200/80 rounded-lg divide-y divide-slate-100 overflow-hidden">
                            {processTreatmentPlan.items.filter((item: any) => item.completedVisitId === activeProcessVisit?.id).map((item: any) => (
                              <div key={item.id} className="p-2.5 px-3 flex items-center justify-between gap-3 text-xs">
                                <div className="min-w-0 flex-1">
                                  <div className="font-medium text-slate-800 truncate">
                                    {item.catalogItem?.name || item.name || 'Treatment Procedure'}
                                  </div>
                                  {item.catalogItem?.category && (
                                    <span className="text-[10px] text-slate-400">
                                      {item.catalogItem.category}
                                      {item.catalogItem.variant ? ` • ${item.catalogItem.variant}` : ''}
                                    </span>
                                  )}
                                  {item.notes && (
                                    <p className="text-[11px] text-slate-500 italic mt-0.5">{item.notes}</p>
                                  )}
                                </div>
                                <Badge
                                  variant="outline"
                                  className={
                                    item.status === 'Completed'
                                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px] font-medium shrink-0'
                                      : 'bg-indigo-50 text-indigo-700 border-indigo-200 text-[10px] font-medium shrink-0'
                                  }
                                >
                                  {item.status || 'Planned'}
                                </Badge>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </DrawerSection>

                  <DrawerSection title="1. Medicines">
                    {isDispensingStep ? (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Prescribed Items</h4>
                          <span className="text-xs text-slate-400">Review & update dispensed quantities</span>
                        </div>

                        {activeItems.length > 0 ? (
                          <div className="border border-slate-200 rounded-lg overflow-hidden bg-white shadow-xs">
                            <table className="w-full text-xs">
                              <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-500">
                                <tr>
                                  <th className="py-2.5 px-3 text-left font-semibold">Medicine</th>
                                  <th className="py-2.5 px-2 text-center font-semibold w-12">Rx</th>
                                  <th className="py-2.5 px-2 text-center font-semibold w-12">Disp</th>
                                  <th className="py-2.5 px-2 text-center font-semibold w-14">Qty</th>
                                  {!isDoctorHandled && <th className="py-2.5 px-3 text-right font-semibold w-16">Cost</th>}
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100">
                                {activeItems.map((item, index) => {
                                  const exceedsStock = item.isDispensed && item.dispensedQty > item.availableStock;
                                  const exceedsPrescribed = item.isDispensed && item.dispensedQty > item.prescribedQty;
                                  const itemCost = item.isDispensed ? (item.dispensedQty || 0) * (item.unitPrice || 0) : 0;

                                  return (
                                    <tr key={item.id} className={item.isDispensed ? 'bg-white' : 'bg-slate-50/60 opacity-60'}>
                                      <td className="py-2.5 px-3 align-middle">
                                        <span className="font-semibold text-slate-900 line-clamp-1">{item.name}</span>
                                        <div className="text-[11px] text-slate-400">
                                          {item.strength}{!isDoctorHandled ? ` • ₹${item.unitPrice}` : ''}
                                        </div>
                                        {item.availableStock <= 5 && (
                                          <div className="mt-1 flex items-center gap-1 text-[10px] font-medium text-amber-700 bg-amber-50 border border-amber-200/80 rounded px-1.5 py-0.5 w-fit">
                                            <AlertTriangle className="w-2.5 h-2.5 text-amber-600 shrink-0" />
                                            <span>Stock: {item.availableStock}/{item.prescribedQty}</span>
                                          </div>
                                        )}
                                      </td>
                                      <td className="py-2.5 px-2 text-center align-middle whitespace-nowrap font-medium text-slate-700">
                                        {item.prescribedQty}
                                      </td>
                                      <td className="py-2.5 px-2 text-center align-middle whitespace-nowrap">
                                        <div className="flex justify-center">
                                          <Checkbox
                                            checked={item.isDispensed}
                                            onCheckedChange={(checked) => {
                                              const newItems = [...activeItems];
                                              const isChecked = !!checked;
                                              newItems[index] = {
                                                ...newItems[index],
                                                isDispensed: isChecked,
                                                dispensedQty: isChecked
                                                  ? (item.dispensedQty > 0 ? item.dispensedQty : Math.min(item.prescribedQty, item.availableStock > 0 ? item.prescribedQty : 0))
                                                  : 0
                                              };
                                              setActiveItems(newItems);
                                            }}
                                          />
                                        </div>
                                      </td>
                                      <td className="py-2.5 px-2 text-center align-middle whitespace-nowrap">
                                        {item.isDispensed ? (
                                          <div className="flex justify-center">
                                            <Input
                                              type="number"
                                              min={1}
                                              max={item.prescribedQty}
                                              value={item.dispensedQty === 0 ? '' : item.dispensedQty}
                                              onChange={(e) => {
                                                const val = e.target.value === '' ? 0 : parseInt(e.target.value, 10);
                                                const newItems = [...activeItems];
                                                newItems[index] = {
                                                  ...newItems[index],
                                                  dispensedQty: isNaN(val) ? 0 : val
                                                };
                                                setActiveItems(newItems);
                                              }}
                                              className={`h-7 w-14 text-center text-xs font-semibold px-1 py-0 ${exceedsStock || exceedsPrescribed || item.dispensedQty < 1
                                                ? 'border-rose-500 focus-visible:ring-rose-500 text-rose-600'
                                                : 'border-slate-200'
                                                }`}
                                            />
                                          </div>
                                        ) : (
                                          <span className="text-slate-400 font-mono text-xs">—</span>
                                        )}
                                      </td>
                                      {!isDoctorHandled && (
                                        <td className="py-2.5 px-3 text-right align-middle whitespace-nowrap font-semibold text-slate-900">
                                          ₹{itemCost}
                                        </td>
                                      )}
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>

                            {/* Medicine Total Summary Row */}
                            {!isDoctorHandled && (
                              <div className="bg-slate-50 border-t border-slate-200 px-3.5 py-2.5 flex justify-between items-center text-xs">
                                <span className="font-medium text-slate-600">Medicine Total</span>
                                <span className="font-bold text-slate-900 text-sm">
                                  ₹{activeItems.reduce((sum, item) => sum + (item.isDispensed ? (item.dispensedQty || 0) * (item.unitPrice || 0) : 0), 0)}
                                </span>
                              </div>
                            )}
                          </div>
                        ) : (
                          <p className="text-xs text-slate-500 p-3 text-center bg-white border border-slate-200 rounded-lg">No medicines prescribed.</p>
                        )}

                        {activeItems.some(item => item.isDispensed && (item.dispensedQty < 1 || item.dispensedQty > item.prescribedQty || item.dispensedQty > item.availableStock)) && (
                          <div className="text-xs text-rose-600 bg-rose-50 border border-rose-200 rounded-lg p-2 flex items-center gap-1.5">
                            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                            <span>Please resolve quantity or stock errors before completing dispensing.</span>
                          </div>
                        )}

                        <Button
                          onClick={handleCompleteDispensing}
                          disabled={activeItems.some(item => item.isDispensed && (item.dispensedQty < 1 || item.dispensedQty > item.prescribedQty || item.dispensedQty > item.availableStock))}
                          className="w-full bg-teal-600 hover:bg-teal-700 h-9 font-medium text-sm"
                        >
                          Complete Dispensing
                        </Button>
                      </div>
                    ) : (
                      <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center justify-between text-emerald-800">
                        <span className="text-sm font-medium flex items-center gap-2"><CheckCircle className="w-4 h-4" /> Medicines Processed</span>
                      </div>
                    )}
                  </DrawerSection>

                  <DrawerSection title="2. Payment">
                    {isDoctorHandled ? (
                      <div className="p-4 bg-indigo-50 border border-indigo-200 rounded-lg flex items-center justify-between text-indigo-800">
                        <span className="text-sm font-medium flex items-center gap-2"><CheckCircle className="w-4 h-4 text-indigo-600" /> Payment Not Required</span>
                      </div>
                    ) : (
                      <>
                        {visitPayments.length > 0 && (
                          <div className="mb-4 space-y-2">
                            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500">Payments</h4>
                            <div className="bg-white border border-slate-200 rounded-lg divide-y divide-slate-100 overflow-hidden shadow-xs">
                              {visitPayments.map((p, idx) => (
                                <div key={p.id || idx} className="p-3 flex justify-between items-start gap-2">
                                  <div className="space-y-0.5 flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                      <span className="font-semibold text-slate-800 text-sm">{p.method}</span>
                                      <span className="text-[11px] text-slate-400">
                                        {new Date(p.createdAt || p.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                      </span>
                                    </div>
                                    {p.notes && (
                                      <p className="text-xs text-slate-600 italic break-words">{p.notes}</p>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-2 shrink-0">
                                    <span className="font-bold text-slate-900 text-sm">₹{p.amount}</span>
                                    <Button
                                      type="button"
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => handlePrintDocument('receipt', p.id)}
                                      title="Print Receipt for this payment"
                                      className="h-7 px-2 text-teal-600 hover:bg-teal-50 text-xs flex items-center gap-1"
                                    >
                                      <Receipt className="w-3.5 h-3.5" />
                                      <span className="hidden sm:inline">Receipt</span>
                                    </Button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {isPaymentStep ? (
                          <div className="space-y-5 bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
                            <div className="space-y-2 text-xs">
                              <div className="flex justify-between text-slate-600">
                                <span>Consultation Fee</span>
                                <span className="font-medium text-slate-800">₹{activeProcessVisit?.consultationFee || 0}</span>
                              </div>
                              <div className="flex justify-between text-slate-600">
                                <span>Treatment Fee</span>
                                <span className="font-medium text-slate-800">₹{activeProcessVisit?.treatmentFee || 0}</span>
                              </div>
                              <div className="flex justify-between text-slate-600">
                                <span>Medicine Cost</span>
                                <span className="font-medium text-slate-800">₹{activeProcessVisit?.medicineCost || 0}</span>
                              </div>
                              <div className="pt-2 border-t border-slate-100 flex justify-between font-semibold text-slate-900 text-sm">
                                <span>Total Due</span>
                                <span>₹{amountDue}</span>
                              </div>
                              <div className="flex justify-between font-semibold text-emerald-600 text-sm">
                                <span>Total Paid</span>
                                <span>₹{totalPaid}</span>
                              </div>
                              <div className="pt-2 border-t border-slate-100 flex justify-between font-bold text-slate-900 text-base">
                                <span>Balance</span>
                                <span>₹{balance}</span>
                              </div>
                            </div>

                            <div className="pt-4 border-t border-slate-100 space-y-4">
                              <h4 className="text-sm font-semibold text-slate-900">Add Payment</h4>
                              <div>
                                <label className="text-xs font-medium text-slate-600 block mb-1">Payment Amount (₹)</label>
                                <Input
                                  type="number"
                                  min="1"
                                  max={balance}
                                  placeholder={`Max ₹${balance}`}
                                  value={paymentAmount}
                                  onChange={(e) => setPaymentAmount(e.target.value ? Number(e.target.value) : '')}
                                />
                              </div>

                              <PaymentMethodSelector value={activeMethod} onChange={setActiveMethod} />

                              {/* Dynamic Partial Payment Reason */}
                              {paymentAmount !== '' && Number(paymentAmount) > 0 && Number(paymentAmount) < balance && (
                                <div className="space-y-3 p-3 bg-amber-50/70 rounded-lg border border-amber-200">
                                  <label className="text-xs font-semibold text-amber-900 block">
                                    Reason for Partial Payment <span className="text-red-500">*</span>
                                  </label>
                                  <Select value={paymentReason} onValueChange={setPaymentReason}>
                                    <SelectTrigger className="bg-white border-amber-200 text-xs h-9">
                                      <SelectValue placeholder="Select reason..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="Patient requested partial payment">Patient requested partial payment</SelectItem>
                                      <SelectItem value="Will pay remaining amount later">Will pay remaining amount later</SelectItem>
                                      <SelectItem value="Financial difficulty">Financial difficulty</SelectItem>
                                      <SelectItem value="Insurance / reimbursement pending">Insurance / reimbursement pending</SelectItem>
                                      <SelectItem value="Other">Other</SelectItem>
                                    </SelectContent>
                                  </Select>

                                  {paymentReason === 'Other' && (
                                    <Input
                                      placeholder="Specify reason..."
                                      value={paymentReasonOther}
                                      onChange={(e) => setPaymentReasonOther(e.target.value)}
                                      className="bg-white border-amber-200 text-xs h-9"
                                    />
                                  )}

                                  <div>
                                    <label className="text-xs font-semibold text-amber-900 block mb-1">
                                      Alternative Phone Number <span className="text-red-500">*</span>
                                      <span className="text-[10px] font-normal text-amber-700 ml-1">(for pending balance follow-up)</span>
                                    </label>
                                    <Input
                                      type="tel"
                                      maxLength={10}
                                      placeholder="10-digit mobile number"
                                      value={altPhone}
                                      onChange={(e) => setAltPhone(e.target.value.replace(/\D/g, ''))}
                                      className="bg-white border-amber-200 text-xs h-9"
                                    />
                                  </div>
                                </div>
                              )}
                            </div>

                            <Button
                              onClick={handleMarkAsPaid}
                              disabled={
                                !activeMethod ||
                                paymentAmount === '' ||
                                Number(paymentAmount) <= 0 ||
                                Number(paymentAmount) > balance ||
                                (Number(paymentAmount) < balance && !paymentReason) ||
                                (Number(paymentAmount) < balance && paymentReason === 'Other' && !paymentReasonOther.trim()) ||
                                (Number(paymentAmount) < balance && altPhone.trim().length !== 10)
                              }
                              className="w-full bg-teal-600 hover:bg-teal-700 h-10 font-medium text-sm"
                            >
                              Add Payment
                            </Button>
                          </div>
                        ) : hasCompletedPayment ? (
                          <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center justify-between text-emerald-800">
                            <span className="text-sm font-medium flex items-center gap-2"><CheckCircle className="w-4 h-4" /> Payment Completed</span>
                          </div>
                        ) : (
                          <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg text-center text-slate-500 text-sm">
                            Complete dispensing first to unlock payment.
                          </div>
                        )}
                      </>
                    )}
                  </DrawerSection>

                  {!isDoctorHandled && (visitPayments.length > 0 || isWorkflowCompleted) && (
                    <DrawerSection title="3. Print">
                      <div className="p-5 bg-white border border-slate-200 rounded-lg space-y-4">
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center gap-2">
                            {isWorkflowCompleted ? (
                              <>
                                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                                <span className="font-semibold text-sm text-emerald-700">Workflow Completed</span>
                              </>
                            ) : (
                              <>
                                <CheckCircle className="w-5 h-5 text-teal-600" />
                                <span className="font-semibold text-sm text-slate-800">
                                  Payment Recorded (Balance: ₹{balance})
                                </span>
                              </>
                            )}
                          </div>
                          {hasPrintedReceipt ? (
                            <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 text-xs py-0.5">
                              Receipt Printed
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="bg-teal-50 text-teal-800 border-teal-300 text-xs py-0.5">
                              Receipt Ready
                            </Badge>
                          )}
                        </div>
                        <div className="flex gap-2">
                          {/* <Button
                            variant="outline"
                            className="flex-1 border-teal-600 text-teal-700 hover:bg-teal-50 font-medium shadow-xs"
                            onClick={() => handlePrintDocument('receipt')}
                          >
                            <Receipt className="w-4 h-4 mr-2 text-teal-600" />
                            {hasPrintedReceipt ? 'Reprint Receipt' : 'Print Receipt'}
                          </Button> */}
                          <Button
                            variant="outline"
                            className="border-slate-300 text-slate-700 hover:bg-slate-50 font-medium shadow-xs"
                            onClick={() => handlePrintDocument('invoice')}
                            title="Print Tax Invoice"
                          >
                            <FileText className="w-4 h-4 mr-1.5 text-blue-600" />
                            Invoice
                          </Button>
                          {activeProcessVisit && activeProcessPatient && (
                            <WhatsAppActionButton
                              type="PAYMENT_RECEIPT"
                              entityType="VISIT"
                              entityId={activeProcessVisit.id}
                              patientId={activeProcessPatient.id}
                              recipientName={activeProcessPatient.name}
                              recipientPhone={activeProcessPatient.phone}
                              paymentOwner={activeProcessVisit.paymentOwner}
                              preferredCommunicationChannel={activeProcessPatient.preferredCommunicationChannel}
                              whatsappAvailable={activeProcessPatient.whatsappAvailable}
                              variant="outline"
                              className="h-9 px-3"
                            />
                          )}
                        </div>
                      </div>
                    </DrawerSection>
                  )}
                </>
              );
            })()}

          </div>

          <div className="border-t border-slate-200 bg-white p-4 shrink-0 flex flex-col gap-2 shadow-[0_-4px_12px_rgba(0,0,0,0.02)]">
            {(() => {
              const isDoctorHandled = activeProcessVisit?.paymentOwner === 'DOCTOR';
              const visitPayments = payments.filter(p => p.visitId === processVisitId);
              const totalPaid = visitPayments.reduce((sum, p) => sum + p.amount, 0);
              const calculatedDue = (activeProcessVisit?.consultationFee || 0) + (activeProcessVisit?.treatmentFee || 0) + (activeProcessVisit?.medicineCost || 0);
              const amountDue = calculatedDue > 0 ? calculatedDue : (activeProcessVisit?.amountDue || 0);
              const balance = amountDue - totalPaid;
              const hasPrescription = prescriptions.some(p => p.visitId === processVisitId && p.status === 'Finalized');
              const hasCompletedDispensing = dispensings.some(d => d.visitId === processVisitId);

              // Only true when payment is fully completed (or doctor handled) and dispensing is done
              const isWorkflowCompleted = isDoctorHandled
                ? (!hasPrescription || hasCompletedDispensing)
                : (activeProcessVisit?.status === 'COMPLETED' || ((!hasPrescription || hasCompletedDispensing) && balance <= 0));

              return (
                <Button
                  onClick={handleCloseProcessVisit}
                  className="w-full bg-teal-600 hover:bg-teal-700 text-white font-medium"
                >
                  {isWorkflowCompleted ? 'Done' : 'Close'}
                </Button>
              );
            })()}
          </div>
        </SheetContent>
      </Sheet>

      {/* Completed View Drawer */}
      <Sheet open={!!viewVisitId} onOpenChange={open => !open && setViewVisitId(null)}>
        <SheetContent side="right" className="w-[400px] sm:w-[600px] p-0 flex flex-col bg-slate-50 h-full">
          <SheetTitle className="sr-only">View Visit</SheetTitle>
          <div className="h-16 px-6 border-b border-slate-200 bg-white flex flex-col justify-center shrink-0">
            <h2 className="text-lg font-semibold text-slate-900">Visit Details</h2>
          </div>

          <div className="flex-1 overflow-y-auto p-6">
            {viewVisitId && (
              <HistoricalVisitDetails
                visitId={viewVisitId}
                onViewHistory={() => {
                  const visit = visits.find(v => v.id === viewVisitId);
                  if (visit) setHistoryPatientId(visit.patientId);
                }}
              />
            )}
          </div>

          <div className="border-t border-slate-200 bg-white p-4 shrink-0">
            <Button variant="outline" onClick={() => setViewVisitId(null)} className="w-full">Close</Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Patient Details Dialog */}
      <Dialog open={!!historyPatientId} onOpenChange={open => !open && setHistoryPatientId(null)}>
        <DialogContent className="sm:max-w-[700px] h-[70vh] p-0 flex flex-col overflow-hidden bg-slate-50">
          <DialogHeader className="px-6 py-4 border-b border-slate-200 bg-white shrink-0">
            <DialogTitle>Patient Details</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto p-6">
            {historyPatientId && (() => {
              const patient = patients.find(p => p.id === historyPatientId);
              if (!patient) return null;

              return (
                <div className="space-y-6">
                  <PatientClinicalSummary
                    patientId={patient.id}
                    name={patient.name}
                    phone={patient.phone}
                    age={patient.age}
                    status={patient.status}
                    hideDetails={false}
                    photoUrl={patient.photoUrl}
                  />
                </div>
              );
            })()}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
