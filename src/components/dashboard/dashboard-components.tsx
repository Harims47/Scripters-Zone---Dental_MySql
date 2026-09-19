import * as React from "react"
import { useState, useEffect } from "react"
import { cn } from "../../lib/utils"
import { Button } from "../ui/button"
import { Badge } from "../ui/badge"
import { 
  UserPlus, CalendarPlus, Clock, Phone, 
  CheckCircle2, TrendingUp, Calendar, UserCheck, 
  ArrowRight, Stethoscope
} from "lucide-react"
import { useNavigate } from "react-router-dom"
import { useAuth } from "../../context/AuthContext"

// --- HEADER ---
export function DashboardHeader({ 
  greetingOverride, 
  onRegisterClick 
}: { 
  greetingOverride?: string
  onRegisterClick?: () => void 
}) {
  const [currentDate, setCurrentDate] = useState('')
  const navigate = useNavigate()
  const { currentUser } = useAuth()
  const role = currentUser?.role

  useEffect(() => {
    const d = new Date()
    setCurrentDate(d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }))
  }, [])

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 py-4 md:py-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight">
          {greetingOverride || `Welcome back, ${currentUser?.name || 'Doctor'}`}
        </h1>
        <p className="text-sm md:text-base text-slate-500 mt-1.5 flex items-center gap-2">
          <Clock className="w-4 h-4 text-primary" />
          {currentDate}
        </p>
      </div>
      
      {/* Quick Actions */}
      <div className="flex items-center gap-3">
        {role === 'Head Doctor' && (
          <Button 
            onClick={() => navigate('/reception-desk')} 
            variant="outline" 
            className="gap-2 text-slate-700 bg-white shadow-sm border-slate-200 hover:bg-slate-50"
          >
            <Calendar className="w-4 h-4 text-primary" />
            Reception Desk
          </Button>
        )}
        {role !== 'Duty Doctor' && (
          <Button 
            onClick={() => onRegisterClick ? onRegisterClick() : navigate('/reception-desk', { state: { openRegister: true } })} 
            className="gap-2 shadow-sm transition-all duration-200"
          >
            <UserPlus className="w-4 h-4" />
            Register Patient
          </Button>
        )}
      </div>
    </div>
  )
}

// --- KPI CARDS ---
export function KpiCard({
  title,
  value,
  icon: Icon,
  trend,
  trendLabel,
  colorClass = "text-primary",
  bgClass = "bg-primary/10",
  onClick
}: {
  title: string
  value: string | number
  icon: React.ElementType
  trend?: string
  trendLabel?: string
  colorClass?: string
  bgClass?: string
  onClick?: () => void
}) {
  return (
    <div 
      onClick={onClick}
      className={cn(
        "bg-white rounded-2xl border border-slate-100/80 p-5 shadow-[0_2px_12px_-4px_rgba(15,23,42,0.04)] flex flex-col h-full relative group overflow-hidden transition-all duration-200",
        onClick && "cursor-pointer hover:border-slate-300 hover:shadow-md"
      )}
    >
      <div className={cn("absolute top-0 right-0 w-24 h-24 rounded-bl-full -mr-4 -mt-4 opacity-40 group-hover:scale-110 transition-transform duration-500", bgClass)}></div>
      <div className="flex justify-between items-start mb-4 relative z-10">
        <div className={cn("h-10 w-10 rounded-xl flex items-center justify-center shrink-0 shadow-sm", bgClass, colorClass)}>
          <Icon className="h-5 w-5" />
        </div>
        {trend && (
          <span className="flex items-center text-[12px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md">
            <TrendingUp className="h-3 w-3 mr-1" /> {trend}
          </span>
        )}
      </div>
      <div className="mt-auto relative z-10">
        <h3 className="text-slate-500 text-xs font-semibold uppercase tracking-wider mb-1">{title}</h3>
        <div className="text-3xl font-extrabold text-slate-900 tracking-tight">{value}</div>
        {trendLabel && <div className="text-xs text-slate-500 mt-2 flex items-center gap-1">{trendLabel}</div>}
      </div>
    </div>
  )
}

// --- WAITING PATIENTS TABLE / SUMMARY ---
export interface WaitingPatientItem {
  id: string
  visitId: string
  patientId: string
  patientName: string
  patientPhone: string
  visitType: string
  reason: string
  priority: boolean
  arrivalTime: string
  waitingSinceMinutes: number
  position: number
  assignedDoctorId: string | null
  doctorName: string | null
}

export function WaitingPatientsTable({ 
  items, 
  onCall, 
  onAssign,
  onStartConsultation,
  isDoctor = false
}: { 
  items: WaitingPatientItem[]
  onCall?: (item: WaitingPatientItem) => void
  onAssign?: (item: WaitingPatientItem) => void
  onStartConsultation?: (item: WaitingPatientItem) => void
  isDoctor?: boolean
}) {
  const navigate = useNavigate()

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-[0_2px_12px_-4px_rgba(15,23,42,0.04)] overflow-hidden flex flex-col h-full">
      <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/60">
        <div className="flex items-center gap-2">
          <Clock className="h-5 w-5 text-amber-500" />
          <h3 className="font-semibold text-slate-900 tracking-tight">
            {isDoctor ? "My Waiting Patients" : "Patients Waiting in Queue"}
          </h3>
        </div>
        <Badge variant="statusWaiting" className="px-2.5 py-0.5 text-xs font-medium">
          {items.length} waiting
        </Badge>
      </div>

      <div className="flex-1 overflow-x-auto">
        {items.length === 0 ? (
          <div className="p-10 text-center text-slate-400 text-sm">
            <UserCheck className="w-10 h-10 mx-auto mb-2 text-slate-300 opacity-60" />
            No patients currently waiting in queue.
          </div>
        ) : (
          <table className="w-full text-sm text-left">
            <thead className="text-[11px] uppercase tracking-wider text-slate-400 bg-slate-50/40 border-b border-slate-100 font-semibold">
              <tr>
                <th className="px-4 py-3">#</th>
                <th className="px-4 py-3">Patient</th>
                <th className="px-4 py-3">Reason / Type</th>
                <th className="px-4 py-3">Waiting</th>
                <th className="px-4 py-3">Assigned Doctor</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((item, idx) => (
                <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="px-4 py-3.5 font-mono text-xs font-semibold text-slate-400">
                    {String(item.position || idx + 1).padStart(2, '0')}
                  </td>
                  <td className="px-4 py-3.5">
                    <div className="font-semibold text-slate-900">{item.patientName}</div>
                    {item.priority && (
                      <Badge variant="outline" className="bg-rose-50 text-rose-600 border-rose-200 text-[10px] px-1.5 py-0 mt-0.5">
                        Urgent
                      </Badge>
                    )}
                  </td>
                  <td className="px-4 py-3.5 text-slate-600 text-xs">
                    <div className="font-medium text-slate-800">{item.reason}</div>
                    <div className="text-slate-400">{item.visitType}</div>
                  </td>
                  <td className="px-4 py-3.5">
                    <span className="inline-flex items-center text-xs font-medium text-amber-600 bg-amber-50 px-2 py-0.5 rounded-md">
                      {item.waitingSinceMinutes}m
                    </span>
                  </td>
                  <td className="px-4 py-3.5 text-xs font-medium text-slate-700">
                    {item.doctorName ? (
                      <span className="text-indigo-600 font-semibold">{item.doctorName}</span>
                    ) : (
                      <span className="text-slate-400 italic">— Unassigned —</span>
                    )}
                  </td>
                  <td className="px-4 py-3.5 text-right">
                    {isDoctor ? (
                      <Button 
                        size="sm" 
                        className="h-7 text-xs bg-indigo-600 hover:bg-indigo-700 text-white"
                        onClick={() => onStartConsultation?.(item)}
                      >
                        Start Consultation
                      </Button>
                    ) : item.doctorName ? (
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="h-7 text-xs border-slate-200 text-slate-700 hover:bg-slate-100"
                        onClick={() => onCall?.(item)}
                      >
                        <Phone className="h-3 w-3 mr-1 text-slate-500" /> Call
                      </Button>
                    ) : (
                      <Button 
                        size="sm" 
                        variant="outline" 
                        className="h-7 text-xs border-indigo-200 text-indigo-700 hover:bg-indigo-50"
                        onClick={() => onAssign?.(item)}
                      >
                        Assign Doctor
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="p-3 border-t border-slate-100 bg-slate-50/40 flex justify-end">
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={() => navigate('/reception-desk')}
          className="text-xs text-primary font-medium hover:bg-primary/5 gap-1"
        >
          Open Reception Desk <ArrowRight className="w-3.5 h-3.5" />
        </Button>
      </div>
    </div>
  )
}

// --- APPOINTMENTS SUMMARY ---
export interface AppointmentItem {
  id: string
  time: string
  patientName: string
  patientPhone: string
  doctorName: string
  type: string
  status: string
}

export function AppointmentSummary({ items, title }: { items: AppointmentItem[], title?: string }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-[0_2px_12px_-4px_rgba(15,23,42,0.04)] overflow-hidden flex flex-col h-full">
      <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/60">
        <h3 className="font-semibold text-slate-900 tracking-tight flex items-center gap-2">
          <CalendarPlus className="h-4 w-4 text-primary" />
          {title || "Today's Appointments"}
        </h3>
        <Badge variant="outline" className="text-xs bg-white text-slate-600">
          {items.length} booked
        </Badge>
      </div>
      <div className="divide-y divide-slate-100 flex-1 overflow-y-auto max-h-[380px]">
        {items.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-sm">
            No appointments scheduled for today.
          </div>
        ) : (
          items.map((item) => (
            <div key={item.id} className="p-3.5 px-5 flex items-center justify-between hover:bg-slate-50 transition-colors">
              <div className="flex items-center gap-3">
                <div className="w-16 text-xs font-bold text-slate-900 shrink-0 bg-slate-100 py-1 px-2 rounded-md text-center">
                  {item.time}
                </div>
                <div className="min-w-0">
                  <div className="font-semibold text-slate-900 text-sm leading-tight">{item.patientName}</div>
                  <div className="text-xs text-slate-500 flex items-center gap-1.5 mt-0.5">
                    <span>{item.doctorName}</span>
                    <span className="opacity-30">•</span>
                    <span className="text-slate-600 font-medium">{item.type}</span>
                  </div>
                </div>
              </div>
              <Badge variant="secondary" className="text-[11px] font-medium text-slate-600 bg-slate-100">
                {item.status}
              </Badge>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

// --- READY FOR RECEPTION LIST ---
export interface ReadyForReceptionItem {
  visitId: string
  patientId: string
  patientName: string
  patientPhone: string
  amountDue: number
}

export function ReadyForReceptionWidget({ items }: { items: ReadyForReceptionItem[] }) {
  const navigate = useNavigate()

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-[0_2px_12px_-4px_rgba(15,23,42,0.04)] overflow-hidden flex flex-col h-full">
      <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/60">
        <h3 className="font-semibold text-slate-900 tracking-tight flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          Ready at Reception
        </h3>
        <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-xs">
          {items.length} pending checkout
        </Badge>
      </div>
      <div className="divide-y divide-slate-100 flex-1 overflow-y-auto max-h-[300px]">
        {items.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-sm">
            No patients currently waiting at reception.
          </div>
        ) : (
          items.map((item) => (
            <div key={item.visitId} className="p-3.5 px-5 flex items-center justify-between hover:bg-slate-50 transition-colors">
              <div>
                <div className="font-semibold text-slate-900 text-sm">{item.patientName}</div>
                <div className="text-xs text-slate-500">₹{item.amountDue.toLocaleString()} due</div>
              </div>
              <Button 
                size="sm" 
                variant="outline" 
                className="h-7 text-xs border-emerald-300 text-emerald-700 hover:bg-emerald-50 font-medium"
                onClick={() => navigate('/reception-desk')}
              >
                Checkout & Bill
              </Button>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

// --- DOCTOR AVAILABILITY STATUS WIDGET ---
export interface DoctorAvailabilityItem {
  id: string
  name: string
  role: string
  attendance: string
  roomNumber: string | null
  status: 'Available' | 'With Patient' | 'On Break' | 'Off Duty'
  currentPatient: { patientName: string; visitId: string } | null
}

export function DoctorStatusWidget({ items }: { items: DoctorAvailabilityItem[] }) {
  const getStatusNode = (status: string) => {
    switch (status) {
      case 'Available':
        return (
          <span className="text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full text-xs font-semibold flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" /> Available
          </span>
        )
      case 'With Patient':
        return (
          <span className="text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-full text-xs font-semibold flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-blue-500" /> With Patient
          </span>
        )
      case 'On Break':
        return (
          <span className="text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full text-xs font-semibold flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500" /> On Break
          </span>
        )
      default:
        return (
          <span className="text-slate-500 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-full text-xs font-semibold flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-slate-400" /> Off Duty
          </span>
        )
    }
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-[0_2px_12px_-4px_rgba(15,23,42,0.04)] overflow-hidden flex flex-col h-full">
      <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/60">
        <h3 className="font-semibold text-slate-900 tracking-tight flex items-center gap-2">
          <Stethoscope className="h-4 w-4 text-indigo-600" />
          Doctor Availability
        </h3>
        <Badge variant="outline" className="text-xs bg-white text-slate-600">
          {items.filter(d => d.status === 'Available').length} / {items.length} free
        </Badge>
      </div>
      <div className="divide-y divide-slate-100 p-2 flex-1 overflow-y-auto">
        {items.length === 0 ? (
          <div className="p-6 text-center text-slate-400 text-sm">No doctors registered.</div>
        ) : (
          items.map(doc => (
            <div key={doc.id} className="p-3 flex items-center justify-between hover:bg-slate-50/60 rounded-xl transition-colors">
              <div>
                <div className="font-semibold text-slate-900 text-sm flex items-center gap-2">
                  {doc.name}
                  {doc.roomNumber && (
                    <span className="text-[10px] font-normal text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                      Room {doc.roomNumber}
                    </span>
                  )}
                </div>
                <div className="text-xs text-slate-500 mt-0.5">
                  {doc.status === 'With Patient' && doc.currentPatient ? (
                    <span className="text-blue-600 font-medium">Consulting: {doc.currentPatient.patientName}</span>
                  ) : (
                    <span>{doc.role}</span>
                  )}
                </div>
              </div>
              <div>{getStatusNode(doc.status)}</div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
