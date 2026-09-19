import React, { createContext, useContext } from 'react'
import type { Patient, Appointment, Visit, QueueEntry, Consultation, Prescription, Dispensing, Payment } from '../types/domain'
import {
  type Medicine
} from '../lib/mock-data'
import { api } from '../lib/api'
import { useAuth } from './AuthContext'

interface ClinicContextType {
  patients: Patient[]
  appointments: Appointment[]
  visits: Visit[]
  queue: QueueEntry[]
  consultations: Consultation[]
  prescriptions: Prescription[]
  dispensings: Dispensing[]
  payments: Payment[]
  medicines: Medicine[]
  staff: any[]
  reloadStaff: () => Promise<void>
  reloadInventory: () => Promise<void>
  refreshClinicOperations: () => Promise<void>
  updateStaffAttendance: (staffId: string, attendance: string) => Promise<void>
  
  addPatient: (patientData: Omit<Patient, 'id'>) => Promise<Patient>
  updatePatient?: (id: string, updates: Partial<Patient>) => Promise<void>
  addAppointment: (appointment: Omit<Appointment, 'id'>) => Promise<Appointment>
  updateAppointment: (appointment: Partial<Appointment>) => Promise<void>
  confirmAppointmentArrival: (appointmentId: string, reasonForVisit?: string) => Promise<{ success: boolean, visitId?: string, error?: string }>
  startVisit: (patientId: string, doctorId?: string, isUrgent?: boolean, reasonForVisit?: string) => Promise<{ visit: Visit, queueEntry: QueueEntry }>
  updateVisit: (visitId: string, updates: Partial<Visit>) => Promise<{ success: boolean, error?: string }>
  cancelVisit: (visitId: string) => Promise<{ success: boolean, error?: string }>
  transferVisitsToNextDay: (visitIds: string[], targetDate: string, reason?: string, isPriority?: boolean) => Promise<{ success: boolean, count?: number, message?: string, transferredCount?: number, error?: string }>

  assignDoctor: (queueId: string, doctorId: string) => Promise<{ success: boolean, error?: string }>
  normalizePhone: (phone: string) => string

  // Phase 0P.3 Transitions
  callPatient: (visitId: string) => Promise<boolean>
  startConsultationFlow: (visitId: string) => Promise<boolean>
  saveConsultation: (visitId: string, data: { reasonForVisit: string, clinicalNotes: string, consultationFee?: number, treatmentFee?: number }, isComplete?: boolean, paymentOwner?: 'RECEPTION' | 'DOCTOR') => Promise<{ success: boolean, error?: string }>
  savePrescription: (prescription: Omit<Prescription, 'id'>) => Promise<{ success: boolean, error?: string }>

  // Phase 0P.5
  completeDispensing: (visitId: string, prescriptionId: string, items: { medicineId: string, prescribedQuantity: number, dispensedQuantity: number }[]) => Promise<{ success: boolean, error?: string }>
  recordPayment: (visitId: string, amount: number, method: 'Cash' | 'GPay' | 'Credit Card' | 'Debit Card', notes?: string, isFinalPayment?: boolean) => Promise<{ success: boolean, error?: string }>
  adjustMedicineStock: (id: string, adjustment: number | { quantity: number, type: 'ADD' | 'SUBTRACT', reason: string }, defaultReason?: string) => Promise<{ success: boolean, error?: string, medicine?: Medicine }>
}

const ClinicContext = createContext<ClinicContextType | null>(null)

export function ClinicProvider({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth()
  
  const [patients, setPatients] = React.useState<Patient[]>([])
  const [appointments, setAppointments] = React.useState<Appointment[]>([])
  const [visits, setVisits] = React.useState<Visit[]>([])
  const [queue, setQueue] = React.useState<QueueEntry[]>([])
  const [consultations, setConsultations] = React.useState<Consultation[]>([])
  const [prescriptions, setPrescriptions] = React.useState<Prescription[]>([])

  React.useEffect(() => {
    if (isAuthenticated) {
      api.get<Patient[]>('/api/patients').then(res => setPatients((res as any).data || res)).catch(console.error)
      api.get<Appointment[]>('/api/appointments').then(res => setAppointments((res as any).data || res)).catch(console.error)
      api.get<any[]>('/api/visits').then(res => {
        const visitsData = (res as any).data || res;
        setVisits(visitsData)
        
        const allConsultations: Consultation[] = []
        const allPrescriptions: Prescription[] = []
        const allDispensings: Dispensing[] = []
        
        visitsData.forEach((v: any) => {
          if (v.consultation) allConsultations.push(v.consultation)
          if (v.prescription) allPrescriptions.push(v.prescription)
          if (v.dispensing) allDispensings.push(v.dispensing)
        })
        
        setConsultations(allConsultations)
        setPrescriptions(allPrescriptions)
        setDispensings(allDispensings)
      }).catch(console.error)
      api.get<QueueEntry[]>('/api/queue').then(res => setQueue((res as any).data || res)).catch(console.error)
    } else {
      setPatients([])
      setAppointments([])
      setVisits([])
      setQueue([])
      setConsultations([])
      setPrescriptions([])
      setDispensings([])
    }
  }, [isAuthenticated])

  const [dispensings, setDispensings] = React.useState<Dispensing[]>([])
  const [payments, setPayments] = React.useState<Payment[]>([])
  
  const [medicines, setMedicines] = React.useState<Medicine[]>([])
  const [staff, setStaff] = React.useState<any[]>([])

  const reloadStaff = React.useCallback(async () => {
    try {
      const res = await api.get<any>('/api/staff?limit=100')
      setStaff(res.data?.data || res.data || res || [])
    } catch (e) {
      console.error('Failed to reload staff in ClinicContext', e)
    }
  }, [])

  const updateStaffAttendance = React.useCallback(async (staffId: string, attendance: string) => {
    // Optimistically update ClinicContext staff state immediately
    setStaff(prev => prev.map(s => s.id === staffId ? { ...s, attendance } : s))
    try {
      await api.put(`/api/staff/${staffId}/attendance`, { attendance })
    } catch (e) {
      console.error('Failed to update staff attendance', e)
      // Revert/refresh on failure
      reloadStaff()
      throw e
    }
  }, [reloadStaff])

  const reloadInventory = React.useCallback(async () => {
    try {
      const res = await api.get<{ data: Medicine[] }>('/api/inventory?limit=200')
      setMedicines((res as any).data || res || [])
    } catch (e) {
      console.error('Failed to reload inventory in ClinicContext', e)
    }
  }, [])

  const refreshClinicOperations = React.useCallback(async () => {
    try {
      const [queueRes, visitsRes, staffRes] = await Promise.all([
        api.get<QueueEntry[]>('/api/queue'),
        api.get<any[]>('/api/visits'),
        api.get<any>('/api/staff?limit=100')
      ])
      
      const newQueue = (queueRes as any).data || queueRes || []
      const newVisits = (visitsRes as any).data || visitsRes || []
      const newStaff = (staffRes as any).data?.data || (staffRes as any).data || staffRes || []

      setQueue(newQueue)
      setVisits(newVisits)
      setStaff(newStaff)

      const allConsultations: Consultation[] = []
      const allPrescriptions: Prescription[] = []
      const allDispensings: Dispensing[] = []
      newVisits.forEach((v: any) => {
        if (v.consultation) allConsultations.push(v.consultation)
        if (v.prescription) allPrescriptions.push(v.prescription)
        if (v.dispensing) allDispensings.push(v.dispensing)
      })
      setConsultations(allConsultations)
      setPrescriptions(allPrescriptions)
      setDispensings(allDispensings)
    } catch (e) {
      console.error('Failed to refresh clinic operations in ClinicContext', e)
    }
  }, [])

  React.useEffect(() => {
    if (isAuthenticated) {
      reloadInventory()
      api.get<Payment[]>('/api/payments?limit=200').then(res => setPayments((res as any).data || res)).catch(console.error)
      reloadStaff()
    } else {
      setMedicines([])
      setPayments([])
      setStaff([])
    }
  }, [isAuthenticated, reloadStaff, reloadInventory])

  // Remove old LocalStorage for migrated domains
  React.useEffect(() => {
    localStorage.removeItem('dc_v2_patients')
    localStorage.removeItem('dc_v2_appointments')
    localStorage.removeItem('dc_v2_visits')
    localStorage.removeItem('dc_v2_queue')
    localStorage.removeItem('dc_v2_consultations')
    localStorage.removeItem('dc_v2_prescriptions')
    localStorage.removeItem('dc_v2_medicines')
    localStorage.removeItem('dc_v2_dispensings')
    localStorage.removeItem('dc_v2_payments')
  }, [])

  const normalizePhone = (phone?: string | null) => {
    if (!phone) return ''
    return phone.replace(/[\s\-\(\)\+]/g, '')
  }

  const addPatient = async (patientData: Omit<Patient, 'id'>) => {
    const res = await api.post<Patient>('/api/patients', patientData)
    const patient = (res as any).data || res;
    setPatients(prev => [...prev, patient])
    return patient
  }

  const updatePatient = async (id: string, updates: Partial<Patient>) => {
    const res = await api.patch<Patient>(`/api/patients/${id}`, updates)
    const patient = (res as any).data || res;
    setPatients(prev => prev.map(p => p.id === id ? patient : p))
  }

  const addAppointment = async (appointmentData: Omit<Appointment, 'id'>) => {
    const res = await api.post<Appointment>('/api/appointments', appointmentData)
    const appointment = (res as any).data || res;
    setAppointments(prev => [appointment, ...prev])
    return appointment
  }

  const updateAppointment = async (appointmentData: Partial<Appointment>) => {
    const res = await api.patch<Appointment>(`/api/appointments/${appointmentData.id}`, appointmentData)
    const appointment = (res as any).data || res;
    setAppointments(prev => prev.map(a => a.id === appointmentData.id ? appointment : a))
  }

  const confirmAppointmentArrival = async (appointmentId: string, reasonForVisit?: string) => {
    // Try to find locally first, but don't fail immediately if not found because 
    // it might have just been created in the same render cycle
    const appointment = appointments.find(a => a.id === appointmentId)
    if (appointment && (appointment.status === 'Cancelled' || appointment.status === 'No Show')) {
      return { success: false, error: 'Cannot confirm arrival for a cancelled or no-show appointment.' }
    }

    // Phase 3.2: Complete the check-in transaction via backend
    const res = await api.post<{ data: { visit: Visit, queueEntry: QueueEntry } }>('/api/visits/check-in', { 
      appointmentId,
      reasonForVisit: reasonForVisit || appointment?.type || appointment?.notes
    })
    
    // Refetch queue and visits to maintain full context, or append directly
    const data = (res as any).data || res;
    // The backend returns the visit object with queueEntry nested inside it
    const visitObj = data;
    const queueEntryObj = visitObj.queueEntry;
    
    setVisits(prev => [visitObj, ...prev])
    if (queueEntryObj) {
      setQueue(prev => [...prev, queueEntryObj])
    }
    
    // Status update is bundled in the backend transaction, update local appt state
    setAppointments(prev => prev.map(a => a.id === appointmentId ? { ...a, status: 'Checked In' } as Appointment : a))
    
    return { success: true, visitId: visitObj.id }
  }

  const startVisit = async (patientId: string, doctorId?: string, isUrgent = false, reasonForVisit?: string) => {
    const res = await api.post<Visit & { queueEntry: QueueEntry }>('/api/visits/walk-in', {
      patientId, doctorId, isUrgent, reasonForVisit
    })
    
    const data = (res as any).data || res;

    const newVisit = { ...data, queueEntry: undefined } // Backend includes queueEntry inside visit response
    const newQueueEntry = data.queueEntry

    setVisits(prev => [newVisit as unknown as Visit, ...prev])
    if (newQueueEntry) {
      setQueue(prev => [...prev, newQueueEntry])
    }

    return { visit: newVisit as unknown as Visit, queueEntry: newQueueEntry as QueueEntry }
  }

  const updateVisit = async (visitId: string, updates: Partial<Visit>) => {
    try {
      const response = await api.patch(`/api/visits/${visitId}`, updates);
      const updatedVisit = (response as any).data || response;
      if (updatedVisit && updatedVisit.id) {
        setVisits(prev => prev.map(v => v.id === visitId ? { ...v, ...updatedVisit } : v));
        return { success: true };
      }
      return { success: false, error: 'Failed to update visit' };
    } catch (err: any) {
      console.error('Failed to update visit:', err);
      return { success: false, error: err.response?.data?.error || err.message || 'Error updating visit' };
    }
  }

  const cancelVisit = async (visitId: string) => {

    try {
      const response = await api.patch(`/api/visits/${visitId}/cancel`);
      const updatedVisit = (response as any).data || response;
      if (updatedVisit && updatedVisit.id) {
        setVisits(prev => prev.map(v => v.id === visitId ? updatedVisit : v));
        if (updatedVisit.queueEntry) {
          setQueue(prev => prev.map(q => q.visitId === visitId ? updatedVisit.queueEntry : q));
        }
        return { success: true };
      }
      return { success: false, error: 'Failed to cancel visit' };
    } catch (err: any) {
      console.error('Failed to cancel visit:', err);
      return { success: false, error: err.response?.data?.error || err.message || 'Error cancelling visit' };
    }
  }

  const transferVisitsToNextDay = async (visitIds: string[], targetDate: string, reason?: string, isPriority = true) => {
    try {
      const res = await api.post<{ success: boolean, message: string, data: any[] }>('/api/visits/transfer', {
        visitIds,
        targetDate,
        reason,
        isPriority
      });

      // Update visits and queue locally
      setVisits(prev => prev.map(v => {
        if (visitIds.includes(v.id)) {
          return {
            ...v,
            status: 'CANCELLED',
            reasonForVisit: `[Transferred to ${targetDate}] ${v.reasonForVisit || ''}`.trim()
          };
        }
        return v;
      }));

      setQueue(prev => prev.map(q => {
        if (visitIds.includes(q.visitId)) {
          return { ...q, status: 'Cancelled' };
        }
        return q;
      }));

      // Directly update appointments state from server response and also fetch latest appointments
      const returnedList = (res as any)?.data || (Array.isArray(res) ? res : []);
      if (Array.isArray(returnedList) && returnedList.length > 0) {
        setAppointments(prev => {
          const newIds = new Set(returnedList.map((a: any) => a.id));
          return [...returnedList, ...prev.filter(a => !newIds.has(a.id))];
        });
      }

      // Proactively re-fetch appointments to ensure 100% sync
      try {
        const freshAppts = await api.get<Appointment[]>('/api/appointments');
        const list = (freshAppts as any).data || freshAppts;
        if (Array.isArray(list)) {
          setAppointments(list);
        }
      } catch (fetchErr) {
        console.warn('Failed to re-fetch appointments after transfer:', fetchErr);
      }

      return { 
        success: true, 
        count: visitIds.length, 
        transferredCount: visitIds.length,
        message: (res as any)?.message || `${visitIds.length} patients successfully transferred to ${targetDate}`
      };
    } catch (err: any) {
      console.error('Failed to transfer visits:', err);
      return { success: false, error: err.response?.data?.error || err.message || 'Error transferring visits' };
    }
  }

  const assignDoctor = async (queueId: string, doctorId: string) => {
    try {
      const res = await api.patch<{ data: { queueEntry: QueueEntry, visit: Visit } }>(`/api/queue/${queueId}/assign`, {
        doctorId
      })
      const data = (res as any).data || res;
      setVisits(prev => prev.map(v => v.id === data.visit.id ? data.visit : v))
      setQueue(prev => prev.map(queueEntry => queueEntry.id === queueId ? data.queueEntry : queueEntry))
      return { success: true }
    } catch (error: any) {
      return { success: false, error: error.message || 'Failed to assign doctor' }
    }
  }

  // --- Phase 0P.3 Handlers ---
  const callPatient = async (visitId: string) => {
    const q = queue.find(q => q.visitId === visitId)
    if (!q) return false;

    const res = await api.patch<{ data: { queueEntry: QueueEntry, visit: Visit } }>(`/api/queue/${q.id}/transition`, {
      action: 'CALL_PATIENT'
    })
    
    const data = (res as any).data || res;
    setVisits(prev => prev.map(v => v.id === visitId ? data.visit : v))
    setQueue(prev => prev.map(queueEntry => queueEntry.id === q.id ? data.queueEntry : queueEntry))
    return true
  }

  const startConsultationFlow = async (visitId: string) => {
    const q = queue.find(q => q.visitId === visitId)
    if (!q) return false;

    const res = await api.patch<{ data: { queueEntry: QueueEntry, visit: Visit } }>(`/api/queue/${q.id}/transition`, {
      action: 'START_CONSULTATION'
    })
    
    const data = (res as any).data || res;
    setVisits(prev => prev.map(v => v.id === visitId ? data.visit : v))
    setQueue(prev => prev.map(queueEntry => queueEntry.id === q.id ? data.queueEntry : queueEntry))
    return true
  }

  const saveConsultation = async (visitId: string, data: { reasonForVisit: string, clinicalNotes: string, consultationFee?: number, treatmentFee?: number }, isComplete = false, paymentOwner: 'RECEPTION' | 'DOCTOR' = 'RECEPTION') => {
    try {
      if (isComplete) {
        await api.post<{ data: { visit: Visit } }>(`/api/consultations/visit/${visitId}/complete`, { paymentOwner })
        
        // Refresh visits data to pull updated consultation/prescription/queue statuses
        const freshVisitsRes = await api.get<{ data: any[] }>('/api/visits')
        const freshVisits = (freshVisitsRes as any).data || freshVisitsRes;
        setVisits(freshVisits)
        
        const allConsultations: Consultation[] = []
        const allPrescriptions: Prescription[] = []
        freshVisits.forEach((v: any) => {
          if (v.consultation) allConsultations.push(v.consultation)
          if (v.prescription) allPrescriptions.push(v.prescription)
        })
        setConsultations(allConsultations)
        setPrescriptions(allPrescriptions)
        
        // Also refresh queue list
        const queueRes = await api.get<{ data: QueueEntry[] }>('/api/queue')
        setQueue((queueRes as any).data || queueRes)
        
        return { success: true }
      } else {
        const existing = consultations.find(c => c.visitId === visitId)
        let savedConsultation;
        if (existing) {
          const res = await api.patch<{ data: Consultation }>(`/api/consultations/${existing.id}`, data)
          savedConsultation = (res as any).data || res;
        } else {
          const res = await api.post<{ data: Consultation }>('/api/consultations', { ...data, visitId })
          savedConsultation = (res as any).data || res;
        }
        
        setConsultations(prev => {
          const idx = prev.findIndex(c => c.id === savedConsultation.id)
          if (idx >= 0) {
            const next = [...prev]
            next[idx] = savedConsultation
            return next
          }
          return [...prev, savedConsultation]
        })

        if (data.consultationFee !== undefined || data.treatmentFee !== undefined) {
          setVisits(prev => prev.map(v => {
            if (v.id === visitId) {
              const consultationFee = data.consultationFee !== undefined ? data.consultationFee : (v.consultationFee || 0);
              const treatmentFee = data.treatmentFee !== undefined ? data.treatmentFee : (v.treatmentFee || 0);
              const medicineCost = v.medicineCost || 0;
              return {
                ...v,
                consultationFee,
                treatmentFee,
                amountDue: consultationFee + treatmentFee + medicineCost
              };
            }
            return v;
          }));
        }

        return { success: true }
      }
    } catch (err: any) {
      console.error(err)
      return { success: false, error: err.response?.data?.error || 'Failed to save consultation' }
    }
  }

  const savePrescription = async (prescriptionData: Omit<Prescription, 'id'>) => {
    try {
      const res = await api.post<{ data: Prescription }>('/api/prescriptions', prescriptionData)
      const savedPrescription = (res as any).data || res;
      setPrescriptions(prev => {
        const idx = prev.findIndex(p => p.id === savedPrescription.id)
        if (idx >= 0) {
          const next = [...prev]
          next[idx] = savedPrescription
          return next
        }
        return [...prev, savedPrescription]
      })
      return { success: true }
    } catch (err: any) {
      console.error(err)
      return { success: false, error: err.response?.data?.error || err.message || 'Failed to save prescription' }
    }
  }

  const adjustMedicineStock = async (id: string, adjustment: number | { quantity: number, type: 'ADD' | 'SUBTRACT', reason: string }, defaultReason?: string) => {
    try {
      let payload: { quantity: number, type: 'ADD' | 'SUBTRACT', reason: string };
      if (typeof adjustment === 'number') {
        payload = {
          quantity: Math.abs(adjustment),
          type: adjustment >= 0 ? 'ADD' : 'SUBTRACT',
          reason: defaultReason || (adjustment >= 0 ? 'Manual Stock Addition' : 'Manual Stock Deduction')
        };
      } else {
        payload = adjustment;
      }

      const res = await api.patch<{ medicine: Medicine, movement: any }>(`/api/inventory/${id}/adjust`, payload);
      const updatedMed = (res as any).medicine || (res as any).data?.medicine || (res as unknown as Medicine);
      setMedicines(prev => prev.map(m => m.id === id ? updatedMed : m));
      return { success: true, medicine: updatedMed };
    } catch (err: any) {
      console.error(err);
      return { success: false, error: err.response?.data?.error || err.message || 'Failed to adjust stock' };
    }
  }

  const completeDispensing = async (visitId: string, prescriptionId: string, items: { medicineId: string, prescribedQuantity: number, dispensedQuantity: number }[]) => {
    try {
      const res = await api.post<{ dispensing: Dispensing, visit: Visit }>('/api/dispensings/complete', {
        visitId,
        prescriptionId,
        items
      });
      
      const { dispensing, visit } = res;

      // Refresh data
      setDispensings(prev => [...prev, dispensing]);
      setVisits(prev => prev.map(v => v.id === visitId ? visit : v));
      
      // Also refresh inventory to get updated stock levels after dispensing
      const invRes = await api.get<{ data: Medicine[] }>('/api/inventory');
      setMedicines(invRes.data || (invRes as any));

      return { success: true }
    } catch (err: any) {
      console.error(err);
      const details = err.response?.data?.details ? ` - ${err.response.data.details}` : '';
      return { success: false, error: (err.response?.data?.error || err.message || 'Failed to record payment') + details }
    }
  }

  const recordPayment = async (visitId: string, amount: number, method: 'Cash' | 'GPay' | 'Credit Card' | 'Debit Card', notes?: string, isFinalPayment?: boolean) => {
    try {
      const res = await api.post<{ payment: Payment, visit: Visit }>('/api/payments', {
        visitId,
        amount,
        method,
        notes,
        isFinalPayment
      });

      const payment = res.payment || (res as any).data?.payment;
      const updatedVisit = res.visit || (res as any).data?.visit;

      if (payment) setPayments(prev => [...prev, payment]);
      if (updatedVisit) setVisits(prev => prev.map(v => v.id === visitId ? updatedVisit : v));

      return { success: true }
    } catch (err: any) {
      console.error(err);
      const details = err.response?.data?.details ? ` - ${err.response.data.details}` : '';
      return { success: false, error: (err.response?.data?.error || err.message || 'Failed to record payment') + details }
    }
  }

  return (
    <ClinicContext.Provider value={{
      patients, appointments, visits, queue, consultations, prescriptions, dispensings, payments, medicines,
      staff, reloadStaff, reloadInventory, refreshClinicOperations, updateStaffAttendance,
      addPatient, updatePatient, addAppointment, updateAppointment, confirmAppointmentArrival, startVisit, updateVisit, cancelVisit, transferVisitsToNextDay,
        assignDoctor,
        normalizePhone,
        callPatient, startConsultationFlow, saveConsultation, savePrescription, completeDispensing, recordPayment, adjustMedicineStock
    }}>
      {children}
    </ClinicContext.Provider>
  )
}

export function useClinicContext() {
  const context = useContext(ClinicContext)
  if (!context) {
    throw new Error('useClinicContext must be used within a ClinicProvider')
  }
  return context
}
