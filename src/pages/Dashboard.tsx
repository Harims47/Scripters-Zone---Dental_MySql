import { useState, useEffect, useCallback, useRef } from "react"
import { 
  Users, UserCheck, Clock, CreditCard, CheckCircle2, 
  AlertCircle, PlayCircle, Stethoscope, RefreshCw, 
  DollarSign, Activity, CalendarPlus
} from "lucide-react"
import { 
  DashboardHeader, KpiCard, WaitingPatientsTable, AppointmentSummary, 
  ReadyForReceptionWidget, DoctorStatusWidget, type WaitingPatientItem
} from "../components/dashboard/dashboard-components"
import { useAuth } from "../context/AuthContext"
import { useClinicContext } from "../context/ClinicContext"
import { useNavigate } from "react-router-dom"
import { Button } from "../components/ui/button"
import { api } from "../lib/api"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select"
import { toast } from "react-hot-toast"
import { cn } from "../lib/utils"

interface DashboardPayload {
  role: string
  date: string
  kpis: {
    waitingNowCount: number
    todayAppointmentsCount: number
    readyForReceptionCount: number
    pendingPaymentsCount: number
    totalPendingBalance: number
    todayCollectionsAmount: number
    todayCollectionsCount: number
    withDoctorsCount: number
    completedTodayCount: number
    totalVisitsToday: number
  }
  waitingPatients: WaitingPatientItem[]
  todayAppointments: any[]
  readyForReception: any[]
  doctorAvailability: any[]
  dutyDoctor: {
    myWaitingPatients: WaitingPatientItem[]
    myWaitingCount: number
    currentPatient: {
      queueId: string
      visitId: string
      patientId: string
      patientName: string
      patientPhone: string
      status: string
    } | null
    completedTodayCount: number
    consultationsTodayCount: number
  } | null
}

export function Dashboard() {
  const { currentUser } = useAuth()
  const { refreshClinicOperations } = useClinicContext()
  const navigate = useNavigate()

  const [data, setData] = useState<DashboardPayload | null>(null)
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)

  // Assign Doctor Modal state
  const [assignModalOpen, setAssignModalOpen] = useState(false)
  const [selectedQueueItem, setSelectedQueueItem] = useState<WaitingPatientItem | null>(null)
  const [selectedDoctorId, setSelectedDoctorId] = useState<string>('')
  const [assigning, setAssigning] = useState(false)


  // Prevent duplicate requests during lifecycle (DASH-15)
  const isFetchingRef = useRef(false)

  const fetchDashboard = useCallback(async () => {
    if (isFetchingRef.current) return
    isFetchingRef.current = true
    try {
      const res = await api.get<DashboardPayload>('/api/dashboard')
      setData(res)
      setError(null)
    } catch (err: any) {
      console.error('Failed to fetch dashboard data:', err)
      setError(err?.message || 'Failed to load clinic dashboard')
    } finally {
      setLoading(false)
      isFetchingRef.current = false
    }
  }, [])

  useEffect(() => {
    fetchDashboard()
  }, [fetchDashboard])

  // Handle Call Patient from Reception Desk perspective
  const handleCallPatient = async (item: WaitingPatientItem) => {
    try {
      await api.patch(`/api/queue/${item.id}/transition`, { action: 'CALL_PATIENT' })
      toast.success(`Patient ${item.patientName} called`)
      refreshClinicOperations().catch(console.error)
      await fetchDashboard()
    } catch (err: any) {
      toast.error(err?.message || 'Failed to call patient')
    }
  }

  // Handle Start Consultation for Duty Doctor
  const handleStartConsultation = async (visitId: string, patientId: string) => {
    try {
      // Find queue entry if not given
      const qEntry = data?.waitingPatients.find(p => p.visitId === visitId) || data?.dutyDoctor?.currentPatient
      if (qEntry && ('status' in qEntry ? qEntry.status !== 'With Doctor' && qEntry.status !== 'In Progress' : true)) {
        const targetQueueId = 'queueId' in qEntry ? qEntry.queueId : qEntry.id
        if (targetQueueId) {
          await api.patch(`/api/queue/${targetQueueId}/transition`, { action: 'START_CONSULTATION' })
        }
      }
      refreshClinicOperations().catch(console.error)
      navigate(`/doctor/patient/${patientId}?visitId=${visitId}`)
    } catch (err: any) {
      console.error(err)
      refreshClinicOperations().catch(console.error)
      navigate(`/doctor/patient/${patientId}?visitId=${visitId}`)
    }
  }

  // Handle Assign Doctor
  const handleOpenAssignModal = (item: WaitingPatientItem) => {
    setSelectedQueueItem(item)
    setSelectedDoctorId('')
    setAssignModalOpen(true)
  }

  const handleConfirmAssign = async () => {
    if (!selectedQueueItem || !selectedDoctorId) return
    const targetDoc = (data?.doctorAvailability || []).find(d => d.id === selectedDoctorId)
    if (targetDoc && targetDoc.status !== 'Available') {
      toast.error(`${targetDoc.name} is currently occupied with a patient.`)
      return
    }
    try {
      setAssigning(true)
      await api.patch(`/api/queue/${selectedQueueItem.id}/assign`, { doctorId: selectedDoctorId })
      toast.success('Doctor assigned successfully')
      setAssignModalOpen(false)
      refreshClinicOperations().catch(console.error)
      await fetchDashboard()
    } catch (err: any) {
      toast.error(err?.message || 'Failed to assign doctor')
    } finally {
      setAssigning(false)
    }
  }


  const role = currentUser?.role || 'Receptionist'
  const isReceptionist = role === 'Receptionist'
  const isDutyDoctor = role === 'Duty Doctor'
  const isHeadDoctor = role === 'Head Doctor'

  if (loading && !data) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
        <RefreshCw className="w-8 h-8 text-primary animate-spin" />
        <p className="text-slate-500 font-medium text-sm">Loading clinic dashboard...</p>
      </div>
    )
  }

  if (error && !data) {
    return (
      <div className="p-8 text-center bg-rose-50 border border-rose-200 rounded-2xl max-w-lg mx-auto my-12">
        <AlertCircle className="w-10 h-10 text-rose-500 mx-auto mb-3" />
        <h3 className="text-rose-900 font-bold text-lg mb-1">Failed to load dashboard</h3>
        <p className="text-rose-700 text-sm mb-4">{error}</p>
        <Button onClick={fetchDashboard} variant="outline" className="border-rose-300 hover:bg-rose-100">
          Try Again
        </Button>
      </div>
    )
  }

  const kpis = data?.kpis || {
    waitingNowCount: 0,
    todayAppointmentsCount: 0,
    readyForReceptionCount: 0,
    pendingPaymentsCount: 0,
    totalPendingBalance: 0,
    todayCollectionsAmount: 0,
    todayCollectionsCount: 0,
    withDoctorsCount: 0,
    completedTodayCount: 0,
    totalVisitsToday: 0
  }

  const dutyDoctorSlice = data?.dutyDoctor

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <DashboardHeader 
        greetingOverride={currentUser ? `Good day, ${currentUser.name}` : undefined}
        onRegisterClick={() => navigate('/reception-desk', { state: { openRegister: true } })}
      />

      {/* Duty Doctor Next/Current Patient Banner */}
      {isDutyDoctor && dutyDoctorSlice?.currentPatient && (
        <div className="bg-gradient-to-r from-indigo-700 to-indigo-600 rounded-2xl p-1 shadow-lg shadow-indigo-600/15 animate-in slide-in-from-top-4 fade-in duration-300">
          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="bg-white/20 p-3 rounded-xl flex shrink-0 text-white shadow-inner">
                <Stethoscope className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-white font-bold text-lg">
                    {dutyDoctorSlice.currentPatient.status === 'With Doctor' ? 'Patient In Consultation' : 'Patient Called & Ready'}
                  </h3>
                  <span className="bg-white/20 text-white text-[11px] px-2 py-0.5 rounded-full font-semibold uppercase tracking-wider">
                    {dutyDoctorSlice.currentPatient.status}
                  </span>
                </div>
                <p className="text-indigo-100 text-sm mt-0.5">
                  <span className="font-semibold text-white">{dutyDoctorSlice.currentPatient.patientName}</span> is ready in your consultation room.
                </p>
              </div>
            </div>
            <Button 
              className="bg-white text-indigo-700 hover:bg-indigo-50 font-bold px-6 py-5 rounded-xl shadow-md w-full sm:w-auto transition-transform active:scale-95"
              onClick={() => handleStartConsultation(dutyDoctorSlice.currentPatient!.visitId, dutyDoctorSlice.currentPatient!.patientId)}
            >
              <PlayCircle className="w-5 h-5 mr-2" /> 
              {dutyDoctorSlice.currentPatient.status === 'With Doctor' ? 'Resume Consultation' : 'Start Consultation'}
            </Button>
          </div>
        </div>
      )}

      {/* Role-Specific KPI Grid */}
      {isReceptionist && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard 
            title="Waiting Now" 
            value={kpis.waitingNowCount} 
            icon={Clock} 
            trendLabel="Patients in clinic queue" 
            colorClass="text-amber-600" 
            bgClass="bg-amber-100" 
            onClick={() => navigate('/reception-desk')}
          />
          <KpiCard 
            title="Today's Appointments" 
            value={kpis.todayAppointmentsCount} 
            icon={CalendarPlus} 
            trendLabel="Booked for today" 
            colorClass="text-blue-600" 
            bgClass="bg-blue-100" 
            onClick={() => navigate('/reception-desk')}
          />
          <KpiCard 
            title="Ready for Reception" 
            value={kpis.readyForReceptionCount} 
            icon={UserCheck} 
            trendLabel="Finished consultation / billing ready" 
            colorClass="text-emerald-600" 
            bgClass="bg-emerald-100" 
            onClick={() => navigate('/reception-desk')}
          />
          <KpiCard 
            title="Pending Payments" 
            value={kpis.pendingPaymentsCount} 
            icon={CreditCard} 
            trendLabel={`Total: ₹${kpis.totalPendingBalance.toLocaleString()}`} 
            colorClass="text-rose-600" 
            bgClass="bg-rose-100" 
            onClick={() => navigate('/reception-desk')}
          />
        </div>
      )}

      {isDutyDoctor && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard 
            title="My Waiting Patients" 
            value={dutyDoctorSlice?.myWaitingCount || 0} 
            icon={Clock} 
            trendLabel="Assigned to you" 
            colorClass="text-amber-600" 
            bgClass="bg-amber-100" 
          />
          <KpiCard 
            title="Current Consultation" 
            value={dutyDoctorSlice?.currentPatient ? 1 : 0} 
            icon={Stethoscope} 
            trendLabel={dutyDoctorSlice?.currentPatient ? dutyDoctorSlice.currentPatient.patientName : "No active patient"} 
            colorClass="text-indigo-600" 
            bgClass="bg-indigo-100" 
          />
          <KpiCard 
            title="Consultations Today" 
            value={dutyDoctorSlice?.consultationsTodayCount || 0} 
            icon={Activity} 
            trendLabel="Total cases handled" 
            colorClass="text-blue-600" 
            bgClass="bg-blue-100" 
          />
          <KpiCard 
            title="Completed Today" 
            value={dutyDoctorSlice?.completedTodayCount || 0} 
            icon={CheckCircle2} 
            trendLabel="Visits fully discharged" 
            colorClass="text-emerald-600" 
            bgClass="bg-emerald-100" 
          />
        </div>
      )}

      {isHeadDoctor && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
          <KpiCard 
            title="Today's Visits" 
            value={kpis.totalVisitsToday} 
            icon={Users} 
            colorClass="text-indigo-600" 
            bgClass="bg-indigo-100" 
          />
          <KpiCard 
            title="Waiting Now" 
            value={kpis.waitingNowCount} 
            icon={Clock} 
            colorClass="text-amber-600" 
            bgClass="bg-amber-100" 
          />
          <KpiCard 
            title="With Doctors" 
            value={kpis.withDoctorsCount} 
            icon={Stethoscope} 
            colorClass="text-blue-600" 
            bgClass="bg-blue-100" 
          />
          <KpiCard 
            title="Ready at Reception" 
            value={kpis.readyForReceptionCount} 
            icon={UserCheck} 
            colorClass="text-teal-600" 
            bgClass="bg-teal-100" 
          />
          <KpiCard 
            title="Today's Collections" 
            value={`₹${kpis.todayCollectionsAmount.toLocaleString()}`} 
            icon={DollarSign} 
            trendLabel={`${kpis.todayCollectionsCount} payments received`}
            colorClass="text-emerald-600" 
            bgClass="bg-emerald-100" 
          />
          <KpiCard 
            title="Pending Balances" 
            value={`₹${kpis.totalPendingBalance.toLocaleString()}`} 
            icon={CreditCard} 
            trendLabel={`${kpis.pendingPaymentsCount} visits outstanding`}
            colorClass="text-rose-600" 
            bgClass="bg-rose-100" 
          />
        </div>
      )}

      {/* Main Operational Tables Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Waiting Queue (Dominant operational element) */}
        <div className={cn("flex flex-col gap-6", isHeadDoctor ? "lg:col-span-8" : "lg:col-span-7")}>
          <div className="min-h-[420px]">
            <WaitingPatientsTable 
              items={isDutyDoctor ? (dutyDoctorSlice?.myWaitingPatients || []) : (data?.waitingPatients || [])}
              isDoctor={isDutyDoctor}
              onCall={handleCallPatient}
              onAssign={handleOpenAssignModal}
              onStartConsultation={(item) => handleStartConsultation(item.visitId, item.patientId)}
            />
          </div>

          {/* If Receptionist: Show Ready for Reception widget */}
          {isReceptionist && (
            <div>
              <ReadyForReceptionWidget items={data?.readyForReception || []} />
            </div>
          )}
        </div>

        {/* Right Column: Appointments & Doctor Status */}
        <div className={cn("flex flex-col gap-6", isHeadDoctor ? "lg:col-span-4" : "lg:col-span-5")}>
          {/* Today's Appointments */}
          <div className="min-h-[360px]">
            <AppointmentSummary items={data?.todayAppointments || []} />
          </div>

          {/* Doctor Status / Availability widget (For Head Doctor & Receptionist) */}
          {(isHeadDoctor || isReceptionist) && (
            <div>
              <DoctorStatusWidget items={data?.doctorAvailability || []} />
            </div>
          )}
        </div>
      </div>

      {/* Assign Doctor Dialog */}
      <Dialog open={assignModalOpen} onOpenChange={setAssignModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Assign Doctor to Patient</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 text-sm">
              <div className="font-semibold text-slate-800">{selectedQueueItem?.patientName}</div>
              <div className="text-xs text-slate-500 mt-0.5">Reason: {selectedQueueItem?.reason}</div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700">Select Available Doctor</label>
              <Select value={selectedDoctorId} onValueChange={setSelectedDoctorId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a doctor" />
                </SelectTrigger>
                <SelectContent>
                  {(data?.doctorAvailability || []).map((doc) => {
                    const isOccupied = doc.status !== 'Available';
                    const statusText = doc.status === 'With Patient'
                      ? 'Occupied (With Patient)'
                      : doc.status === 'Available'
                      ? 'Available'
                      : doc.status;

                    return (
                      <SelectItem 
                        key={doc.id} 
                        value={doc.id}
                        disabled={isOccupied}
                        className={cn(
                          isOccupied && "opacity-60 cursor-not-allowed text-slate-400 bg-slate-50/60"
                        )}
                      >
                        <div className="flex items-center justify-between w-full gap-2">
                          <span className={cn(
                            isOccupied ? "line-through text-slate-400" : "font-medium text-slate-900"
                          )}>
                            {doc.name}
                          </span>
                          <span className={cn(
                            "text-[11px] font-medium px-2 py-0.5 rounded-full ml-auto",
                            doc.status === 'Available'
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              : doc.status === 'With Patient'
                              ? "bg-rose-50 text-rose-700 border border-rose-200"
                              : "bg-slate-100 text-slate-600 border border-slate-200"
                          )}>
                            {statusText}
                          </span>
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignModalOpen(false)}>Cancel</Button>
            <Button 
              onClick={handleConfirmAssign} 
              disabled={!selectedDoctorId || assigning}
              className="bg-indigo-600 hover:bg-indigo-700 text-white"
            >
              {assigning ? 'Assigning...' : 'Assign to Doctor'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>


    </div>
  )
}
