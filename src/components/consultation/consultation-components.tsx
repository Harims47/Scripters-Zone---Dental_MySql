import { Clock } from 'lucide-react'
import { Badge } from '../ui/badge'

export function PatientClinicalSummary({
  patientId,
  name,
  phone,
  age,
  status,
  hideDetails = false,
  photoUrl
}: {
  patientId: string
  name: string
  phone: string
  age: number | string
  status?: string
  hideDetails?: boolean
  photoUrl?: string
}) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100/60 shadow-[0_2px_12px_-4px_rgba(15,23,42,0.04)] p-5">
      <h3 className="font-semibold text-slate-900 text-sm uppercase tracking-wider mb-4">Patient Summary</h3>
      <div className="flex gap-4">
        {photoUrl && (
          <div className="shrink-0">
            <img src={photoUrl} alt="Patient" className="w-16 h-16 rounded-full object-cover border-2 border-slate-100 shadow-sm" />
          </div>
        )}
        <div className="flex-1 grid grid-cols-2 gap-y-4 gap-x-2 text-sm">
          <div>
            <div className="text-slate-500 font-medium mb-1">Patient Name</div>
            <div className="font-semibold text-slate-900">{name}</div>
        </div>
        {!hideDetails && (
          <div>
            <div className="text-slate-500 font-medium mb-1">Patient ID</div>
            <div className="font-mono text-slate-700 bg-slate-50 px-1.5 py-0.5 rounded border inline-block">{patientId}</div>
          </div>
        )}
        <div>
          <div className="text-slate-500 font-medium mb-1">Phone</div>
          <div className="text-slate-700">{phone}</div>
        </div>
        <div>
          <div className="text-slate-500 font-medium mb-1">Age</div>
          <div className="text-slate-700">{age} Years</div>
        </div>
        {!hideDetails && status && (
          <div className="col-span-2 pt-2 border-t mt-1 flex items-center justify-between">
            <div className="text-slate-500 font-medium">Status</div>
            <Badge variant="statusWithDoctor"><span className="w-1.5 h-1.5 rounded-full bg-blue-500 mr-1.5" /> {status}</Badge>
          </div>
        )}
        </div>
      </div>
    </div>
  )
}

export function PatientVisitHistory({
  visits,
  onView
}: {
  visits: { id: string, date: string, title: string, status?: string }[]
  onView?: (visitId: string) => void
}) {
  return (
    <div className="bg-white border rounded-xl shadow-sm p-5">
      <h3 className="font-semibold text-slate-900 text-sm uppercase tracking-wider mb-4">Previous Visits</h3>
      <div className="space-y-4 max-h-[250px] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-slate-200">
        {visits.map((v, i) => (
          <div 
            key={v.id} 
            className={`flex gap-3 ${onView ? 'cursor-pointer hover:bg-slate-50 p-2 -mx-2 rounded-lg transition-colors' : ''}`}
            onClick={() => onView && onView(v.id)}
          >
            <div className="flex flex-col items-center">
              <div className="w-2 h-2 rounded-full bg-indigo-500 mt-1.5" />
              {i !== visits.length - 1 && <div className="w-px h-full bg-slate-200 my-1 min-h-[24px]" />}
            </div>
            <div className="pb-2">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="font-medium text-slate-900 text-sm">{v.date}</span>
                {v.status && <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{v.status}</Badge>}
              </div>
              <div className="text-sm text-slate-500">{v.title}</div>
            </div>
          </div>
        ))}
        {visits.length === 0 && (
          <div className="text-sm text-slate-500 flex items-center gap-2">
            <Clock className="h-4 w-4" /> No previous visits.
          </div>
        )}
      </div>
    </div>
  )
}
