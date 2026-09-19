import { Search, Filter, PlayCircle, CheckCircle2, XCircle, Eye, AlertCircle } from "lucide-react"
import { cn } from "../../lib/utils"
import { Button } from "../ui/button"
import { Input } from "../ui/input"
import { Badge } from "../ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select"
import { PatientIdentity } from "../ui/patient-identity"

// --- STATUS HELPERS ---
export type QueueStatus = 'Waiting' | 'Called' | 'With Doctor' | 'Completed' | 'Cancelled'
export type QueuePriority = 'Normal' | 'Urgent'

export const getStatusBadge = (status: QueueStatus) => {
  switch (status) {
    case 'Waiting': return <Badge variant="statusWaiting"><span className="w-1.5 h-1.5 rounded-full bg-amber-500 mr-1.5" /> Waiting</Badge>;
    case 'Called': return <Badge variant="statusActive"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5" /> Called</Badge>;
    case 'With Doctor': return <Badge variant="statusWithDoctor"><span className="w-1.5 h-1.5 rounded-full bg-blue-500 mr-1.5" /> With Doctor</Badge>;
    case 'Completed': return <Badge variant="statusInactive"><span className="w-1.5 h-1.5 rounded-full bg-slate-400 mr-1.5" /> Completed</Badge>;
    case 'Cancelled': return <Badge variant="statusCancelled"><span className="w-1.5 h-1.5 rounded-full bg-rose-500 mr-1.5" /> Cancelled</Badge>;
    default: return <Badge variant="outline">{status}</Badge>;
  }
}

export const getPriorityBadge = (priority: QueuePriority) => {
  if (priority === 'Urgent') {
    return <Badge variant="priorityUrgent" className="shadow-sm"><AlertCircle className="w-3 h-3 mr-1" /> Urgent</Badge>
  }
  return null
}

// --- QUEUE HEADER ---
export function QueueHeader({ summary }: { summary: { waiting: number, called: number, withDoctor: number, completed: number } }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div>
        <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-slate-900">Clinic Queue</h1>
        <p className="text-sm text-slate-500 mt-1">Live patient orchestration.</p>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1.5 bg-amber-50 px-3 py-1.5 rounded-md border border-amber-100">
          <span className="text-xs font-semibold text-amber-700 uppercase">Waiting:</span>
          <span className="text-sm font-bold text-amber-900">{summary.waiting}</span>
        </div>
        <div className="flex items-center gap-1.5 bg-emerald-50 px-3 py-1.5 rounded-md border border-emerald-100">
          <span className="text-xs font-semibold text-emerald-700 uppercase">Called:</span>
          <span className="text-sm font-bold text-emerald-900">{summary.called}</span>
        </div>
        <div className="flex items-center gap-1.5 bg-blue-50 px-3 py-1.5 rounded-md border border-blue-100">
          <span className="text-xs font-semibold text-blue-700 uppercase">With Dr:</span>
          <span className="text-sm font-bold text-blue-900">{summary.withDoctor}</span>
        </div>
        <div className="flex items-center gap-1.5 bg-slate-50 px-3 py-1.5 rounded-md border border-slate-200">
          <span className="text-xs font-semibold text-slate-500 uppercase">Done:</span>
          <span className="text-sm font-bold text-slate-700">{summary.completed}</span>
        </div>
      </div>
    </div>
  )
}

// --- QUEUE FILTERS ---
export function QueueFilters({ onSearch }: { onSearch?: (val: string) => void }) {
  return (
    <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center gap-4 bg-white">
      <div className="relative flex-1 max-w-sm">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search patient, ID or phone..." className="pl-9 bg-slate-50/50 hover:bg-slate-50 h-9 transition-colors" onChange={(e) => onSearch?.(e.target.value)} />
      </div>
      <div className="flex items-center gap-3">
        <Select defaultValue="all-doctors">
          <SelectTrigger className="w-[140px] h-9 shadow-sm"><SelectValue placeholder="Doctor" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all-doctors">All Doctors</SelectItem>
            <SelectItem value="dr-smith">Dr. Smith</SelectItem>
            <SelectItem value="dr-adams">Dr. Adams</SelectItem>
            <SelectItem value="dr-lee">Dr. Lee</SelectItem>
          </SelectContent>
        </Select>
        <Select defaultValue="all-status">
          <SelectTrigger className="w-[130px] h-9 shadow-sm"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all-status">All Statuses</SelectItem>
            <SelectItem value="waiting">Waiting</SelectItem>
            <SelectItem value="called">Called</SelectItem>
            <SelectItem value="with-doctor">With Doctor</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" className="h-9 shadow-sm">
          <Filter className="mr-2 h-4 w-4 text-slate-400" /> Filters
        </Button>
      </div>
    </div>
  )
}

// --- QUEUE LIST/ENTRY ---
export interface QueueRow {
  id: string
  queueNumber: string
  name: string
  patientId: string
  visitId: string
  phone: string
  arrivalTime: string
  waitTimeMin: number
  doctor: string
  assignedDoctorId?: string
  status: QueueStatus
  priority: QueuePriority
  source?: 'Appointment' | 'Walk-in'
}

export function QueueEntry({ 
  item, 
  onAction,
  onView,
  canManageClinical = true
}: { 
  item: QueueRow, 
  onAction: (id: string, action: 'Call' | 'Start' | 'Complete' | 'Cancel') => void,
  onView: (id: string) => void,
  canManageClinical?: boolean
}) {
  const isUrgent = item.priority === 'Urgent'
  const needsAttention = item.waitTimeMin > 15 && item.status === 'Waiting'

  return (
    <div className={cn(
      "flex flex-col xl:flex-row xl:items-center gap-4 xl:gap-6 p-4 border-b border-slate-50 hover:bg-slate-50/80 transition-colors group",
      isUrgent && "bg-rose-50/30 hover:bg-rose-50/60"
    )}>
      
      {/* Number & Priority Mobile Wrapper */}
      <div className="flex items-center justify-between xl:w-24 shrink-0">
        <div className="flex items-center gap-3">
          <span className="font-mono text-xl font-bold text-slate-300 group-hover:text-primary transition-colors">#{item.queueNumber}</span>
          <div className="xl:hidden">{getPriorityBadge(item.priority)}</div>
        </div>
        <div className="xl:hidden">{getStatusBadge(item.status)}</div>
      </div>

      {/* Patient Identity */}
      <div className="flex-1 min-w-0" onClick={() => onView(item.id)}>
        <PatientIdentity name={item.name} patientId={item.patientId} phone={item.phone} size="sm" />
        <div className="text-[11px] font-medium text-slate-400 mt-1 uppercase tracking-wider">{item.source}</div>
      </div>

      {/* Wait Time & Arrival */}
      <div className="xl:w-32 shrink-0 flex flex-col justify-center">
        <div className={cn("text-sm font-bold", needsAttention ? "text-amber-600" : "text-slate-900")}>
          {item.waitTimeMin} min wait
        </div>
        <div className="text-xs text-slate-500 font-medium">Arr: {item.arrivalTime}</div>
      </div>

      {/* Doctor */}
      <div className="xl:w-36 shrink-0 flex items-center text-sm font-medium text-slate-700">
        {item.doctor}
      </div>

      {/* Badges Desktop */}
      <div className="hidden xl:flex xl:w-48 shrink-0 items-center gap-2">
        {getStatusBadge(item.status)}
        {getPriorityBadge(item.priority)}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 xl:w-48 shrink-0 xl:justify-end pt-3 xl:pt-0 border-t xl:border-t-0 mt-1 xl:mt-0">
        <Button variant="ghost" size="icon" className="text-slate-400 hover:text-slate-900 h-9 w-9" aria-label="View patient details" onClick={() => onView(item.id)}>
          <Eye className="h-4 w-4" />
        </Button>

        {item.status === 'Waiting' && (
          <Button size="sm" className="h-9 shadow-sm flex-1 xl:flex-none" onClick={() => onAction(item.id, 'Call')}>
            Call Patient
          </Button>
        )}
        
        {item.status === 'Called' && canManageClinical && (
          <Button size="sm" variant="default" className="h-9 bg-blue-600 hover:bg-blue-700 shadow-sm flex-1 xl:flex-none" onClick={() => onAction(item.id, 'Start')}>
            <PlayCircle className="mr-2 h-4 w-4" /> Start
          </Button>
        )}

        {item.status === 'With Doctor' && canManageClinical && (
          <Button size="sm" variant="outline" className="h-9 text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700 border-emerald-200 shadow-sm flex-1 xl:flex-none" onClick={() => onAction(item.id, 'Complete')}>
            <CheckCircle2 className="mr-2 h-4 w-4" /> Complete
          </Button>
        )}

        {['Waiting', 'Called'].includes(item.status) && (
          <Button variant="ghost" size="icon" className="text-slate-400 hover:text-rose-600 hover:bg-rose-50 h-9 w-9 xl:hidden" aria-label="Cancel queue entry" onClick={() => onAction(item.id, 'Cancel')}>
            <XCircle className="h-4 w-4" />
          </Button>
        )}
      </div>

    </div>
  )
}
