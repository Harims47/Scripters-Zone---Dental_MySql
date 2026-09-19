import React, { useState } from 'react'
import { 
  Search, Bell, Globe, ChevronDown, 
  LayoutDashboard, Users, Calendar, Clock,
  ArrowUpRight, Edit2, Plus,
  Eye, FileText, CheckCircle2, Clock3, AlertCircle, Play
} from 'lucide-react'
import { cn } from '../lib/utils'
import { Button } from '../components/ui/button'
import { Badge } from '../components/ui/badge'
import { Sheet, SheetContent, SheetScrollArea } from '../components/ui/sheet'

// ----------------------------------------------------------------------
// MOCK DATA FOR DEMONSTRATION
// ----------------------------------------------------------------------
const DEMO_PATIENTS = [
  { id: 'PT-0001', name: 'James Wilson', phone: '+91 98765 43210', lastVisit: '10 Aug 2026', nextAppointment: '15 Sep 2026', status: 'Active' },
  { id: 'PT-0002', name: 'Sarah Connor', phone: '+91 98765 43211', lastVisit: '15 Aug 2026', nextAppointment: 'Today, 10:30 AM', status: 'Waiting' },
  { id: 'PT-0003', name: 'Michael Brown', phone: '+91 98765 43212', lastVisit: '20 Aug 2026', nextAppointment: 'Today, 11:45 AM', status: 'With Doctor' },
  { id: 'PT-0004', name: 'Emily Clark', phone: '+91 98765 43213', lastVisit: '22 Aug 2026', nextAppointment: '-', status: 'Active' },
  { id: 'PT-0005', name: 'John Doe', phone: '+91 98765 43214', lastVisit: '25 Aug 2026', nextAppointment: 'Tomorrow, 09:00 AM', status: 'Scheduled' },
]

// ----------------------------------------------------------------------
// REUSABLE PREMIUM UI PATTERNS (LOCALIZED)
// ----------------------------------------------------------------------

// 1. Premium Card
function PremiumCard({ children, className }: { children: React.ReactNode, className?: string }) {
  return (
    <div className={cn("bg-white rounded-2xl border border-slate-100/60 shadow-[0_2px_12px_-4px_rgba(15,23,42,0.04)] overflow-hidden", className)}>
      {children}
    </div>
  )
}

// 2. Patient Identity Block
function PatientIdentity({ name, id, phone, size = 'default' }: { name: string, id: string, phone: string, size?: 'sm' | 'default' | 'lg' }) {
  const avatarSize = size === 'sm' ? 'w-8 h-8 text-xs' : size === 'lg' ? 'w-14 h-14 text-xl' : 'w-10 h-10 text-sm'
  const titleSize = size === 'sm' ? 'text-sm' : size === 'lg' ? 'text-xl font-bold' : 'text-base font-semibold'
  const metaSize = size === 'sm' ? 'text-[11px]' : size === 'lg' ? 'text-sm' : 'text-xs'

  return (
    <div className="flex items-center gap-3.5">
      <div className={cn("rounded-full bg-slate-100 text-slate-600 flex items-center justify-center font-bold shrink-0 ring-1 ring-slate-200/50 shadow-inner", avatarSize)}>
        {name.substring(0, 2).toUpperCase()}
      </div>
      <div className="flex flex-col justify-center">
        <span className={cn("text-slate-900 leading-tight tracking-tight", titleSize)}>{name}</span>
        <div className={cn("text-slate-500 font-medium tracking-wide flex items-center gap-1.5 mt-0.5", metaSize)}>
          <span className="text-slate-400">{id}</span>
          <span className="w-1 h-1 rounded-full bg-slate-300" />
          <span>{phone}</span>
        </div>
      </div>
    </div>
  )
}

// 3. Premium Status Badge
function PremiumStatus({ status }: { status: string }) {
  const config: Record<string, { bg: string, text: string, dot: string }> = {
    'Waiting': { bg: 'bg-amber-50', text: 'text-amber-700', dot: 'bg-amber-500' },
    'With Doctor': { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500' },
    'Scheduled': { bg: 'bg-blue-50', text: 'text-blue-700', dot: 'bg-blue-500' },
    'Active': { bg: 'bg-slate-50', text: 'text-slate-700', dot: 'bg-slate-400' },
  }
  const c = config[status] || config['Active']
  
  return (
    <div className={cn("inline-flex items-center px-2.5 py-1 rounded-full text-[12px] font-semibold border border-transparent shadow-sm", c.bg, c.text)}>
      <span className={cn("w-1.5 h-1.5 rounded-full mr-1.5 shadow-[0_0_4px_rgba(0,0,0,0.1)]", c.dot)} />
      {status}
    </div>
  )
}

// ----------------------------------------------------------------------
// PREMIUM REFERENCE SCREEN MAIN
// ----------------------------------------------------------------------
export function PremiumReferencePage() {
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [selectedPatient, setSelectedPatient] = useState<typeof DEMO_PATIENTS[0] | null>(null)

  const openDrawer = (pt: typeof DEMO_PATIENTS[0]) => {
    setSelectedPatient(pt)
    setDrawerOpen(true)
  }

  return (
    <div className="flex h-screen w-full bg-[#f8fafc] text-slate-900 font-sans overflow-hidden">
      
      {/* SIDEBAR */}
      <aside className="w-[260px] flex-shrink-0 bg-white border-r border-slate-100 shadow-[4px_0_24px_rgba(0,0,0,0.01)] flex flex-col z-20">
        <div className="h-[72px] flex items-center px-6 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 bg-gradient-to-br from-teal-500 to-emerald-600 rounded-xl flex items-center justify-center text-white font-bold shadow-lg shadow-teal-500/20">
              D
            </div>
            <span className="font-bold text-xl tracking-tight text-slate-900">DentalCore</span>
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto py-5 px-3 space-y-1">
          <div className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-3 px-3 mt-2">
            Main Menu
          </div>
          <a href="#" className="flex items-center gap-3 px-3 py-2.5 rounded-xl font-semibold bg-teal-50 text-teal-700 transition-colors w-full group">
            <LayoutDashboard className="h-5 w-5 text-teal-600" />
            <span>Dashboard</span>
            <div className="ml-auto w-1.5 h-1.5 rounded-full bg-teal-500 shadow-[0_0_6px_rgba(20,184,166,0.6)]"></div>
          </a>
          <a href="#" className="flex items-center gap-3 px-3 py-2.5 rounded-xl font-medium text-slate-500 hover:bg-slate-50 hover:text-slate-900 transition-colors w-full">
            <Users className="h-5 w-5" />
            <span>Patients</span>
          </a>
          <a href="#" className="flex items-center gap-3 px-3 py-2.5 rounded-xl font-medium text-slate-500 hover:bg-slate-50 hover:text-slate-900 transition-colors w-full">
            <Clock className="h-5 w-5" />
            <span>Queue</span>
          </a>
          <a href="#" className="flex items-center gap-3 px-3 py-2.5 rounded-xl font-medium text-slate-500 hover:bg-slate-50 hover:text-slate-900 transition-colors w-full">
            <Calendar className="h-5 w-5" />
            <span>Appointments</span>
          </a>
        </div>
      </aside>

      {/* MAIN CONTAINER */}
      <div className="flex-1 flex flex-col min-w-0 relative z-10">
        
        {/* TOPBAR */}
        <header className="h-[72px] bg-white/80 backdrop-blur-md border-b border-slate-100 px-8 flex items-center justify-between shrink-0 z-10 sticky top-0">
          <div className="flex items-center gap-4">
            <div className="relative group">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-[18px] w-[18px] text-slate-400 group-focus-within:text-teal-600 transition-colors" />
              <input 
                type="text"
                placeholder="Search patients, doctors..."
                className="w-[320px] h-10 pl-10 pr-4 bg-slate-50 hover:bg-slate-100/50 focus:bg-white border border-transparent focus:border-teal-200 focus:ring-4 focus:ring-teal-50 rounded-full text-[14px] text-slate-700 transition-all outline-none"
              />
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" className="h-10 w-10 text-slate-500 hover:bg-slate-50 rounded-full">
              <Globe className="h-[18px] w-[18px]" />
            </Button>
            <Button variant="ghost" size="icon" className="h-10 w-10 text-slate-500 hover:bg-slate-50 rounded-full relative">
              <Bell className="h-[18px] w-[18px]" />
              <span className="absolute top-2.5 right-2.5 h-2 w-2 bg-rose-500 rounded-full ring-2 ring-white" />
            </Button>
            <div className="h-6 w-[1px] bg-slate-200 mx-2" />
            <div className="flex items-center gap-3 cursor-pointer hover:bg-slate-50 p-1.5 pr-3 rounded-full transition-colors">
              <div className="w-8 h-8 rounded-full bg-slate-900 flex items-center justify-center text-white font-bold text-sm shadow-md">
                DA
              </div>
              <div className="hidden sm:flex flex-col">
                <span className="text-[13px] font-bold text-slate-900 leading-none mb-1">Dr. Arun</span>
                <span className="text-[11px] font-medium text-slate-500 leading-none">Head Doctor</span>
              </div>
              <ChevronDown className="h-4 w-4 text-slate-400 ml-1" />
            </div>
          </div>
        </header>

        {/* PAGE CONTENT */}
        <main className="flex-1 overflow-auto p-8">
          <div className="max-w-[1200px] mx-auto space-y-8">
            
            {/* PAGE HEADER */}
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
              <div>
                <h1 className="text-[28px] font-bold text-slate-900 tracking-tight leading-tight">Clinic Overview</h1>
                <p className="text-[15px] text-slate-500 mt-1.5 font-medium">Here's what's happening at the clinic today.</p>
              </div>
              <div className="flex items-center gap-3">
                <Button className="h-10 px-5 bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 shadow-sm rounded-xl font-semibold">
                  <FileText className="w-[18px] h-[18px] mr-2 text-slate-400" />
                  View Reports
                </Button>
                <Button className="h-10 px-5 bg-teal-600 hover:bg-teal-700 text-white shadow-md shadow-teal-600/20 rounded-xl font-semibold">
                  <Plus className="w-[18px] h-[18px] mr-2" />
                  New Patient
                </Button>
              </div>
            </div>

            {/* KPI GRID */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
              <PremiumCard className="p-5 relative group">
                <div className="absolute top-0 right-0 w-24 h-24 bg-teal-50 rounded-bl-full -mr-4 -mt-4 opacity-50 group-hover:scale-110 transition-transform duration-500"></div>
                <div className="flex items-center justify-between mb-4 relative z-10">
                  <div className="w-10 h-10 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center">
                    <Users className="w-5 h-5" />
                  </div>
                  <span className="flex items-center text-[13px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md">
                    <ArrowUpRight className="w-3 h-3 mr-1" /> 12%
                  </span>
                </div>
                <div className="relative z-10">
                  <h3 className="text-slate-500 text-[13px] font-semibold uppercase tracking-wider mb-1">Total Patients</h3>
                  <div className="text-3xl font-extrabold text-slate-900 tracking-tight">1,248</div>
                </div>
              </PremiumCard>

              <PremiumCard className="p-5 relative group">
                <div className="absolute top-0 right-0 w-24 h-24 bg-amber-50 rounded-bl-full -mr-4 -mt-4 opacity-50 group-hover:scale-110 transition-transform duration-500"></div>
                <div className="flex items-center justify-between mb-4 relative z-10">
                  <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                    <Clock3 className="w-5 h-5" />
                  </div>
                </div>
                <div className="relative z-10">
                  <h3 className="text-slate-500 text-[13px] font-semibold uppercase tracking-wider mb-1">In Queue Today</h3>
                  <div className="text-3xl font-extrabold text-slate-900 tracking-tight">24</div>
                </div>
              </PremiumCard>

              <PremiumCard className="p-5 relative group">
                <div className="absolute top-0 right-0 w-24 h-24 bg-blue-50 rounded-bl-full -mr-4 -mt-4 opacity-50 group-hover:scale-110 transition-transform duration-500"></div>
                <div className="flex items-center justify-between mb-4 relative z-10">
                  <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                    <Calendar className="w-5 h-5" />
                  </div>
                </div>
                <div className="relative z-10">
                  <h3 className="text-slate-500 text-[13px] font-semibold uppercase tracking-wider mb-1">Upcoming</h3>
                  <div className="text-3xl font-extrabold text-slate-900 tracking-tight">8</div>
                </div>
              </PremiumCard>

              <PremiumCard className="p-5 relative group">
                <div className="absolute top-0 right-0 w-24 h-24 bg-rose-50 rounded-bl-full -mr-4 -mt-4 opacity-50 group-hover:scale-110 transition-transform duration-500"></div>
                <div className="flex items-center justify-between mb-4 relative z-10">
                  <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
                    <AlertCircle className="w-5 h-5" />
                  </div>
                  <span className="flex items-center text-[13px] font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-md">
                    2 Action Req
                  </span>
                </div>
                <div className="relative z-10">
                  <h3 className="text-slate-500 text-[13px] font-semibold uppercase tracking-wider mb-1">Pending Payments</h3>
                  <div className="text-3xl font-extrabold text-slate-900 tracking-tight">₹4,500</div>
                </div>
              </PremiumCard>
            </div>

            {/* DATA TABLE SECTION */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-[17px] font-bold text-slate-900">Today's Schedule</h2>
                <Button variant="link" className="text-teal-600 font-semibold h-auto p-0">View All</Button>
              </div>
              
              <PremiumCard className="flex flex-col">
                <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-center gap-4 bg-slate-50/50">
                  <div className="relative w-full sm:w-[320px]">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-[16px] w-[16px] text-slate-400" />
                    <input 
                      type="text"
                      placeholder="Search patient..."
                      className="w-full h-9 pl-9 pr-4 bg-white border border-slate-200 focus:border-teal-400 focus:ring-4 focus:ring-teal-50 rounded-lg text-[13px] font-medium text-slate-700 outline-none shadow-sm"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" className="h-9 px-4 rounded-lg border-slate-200 text-slate-600 font-semibold shadow-sm hover:bg-slate-50 text-[13px]">
                      Filter
                    </Button>
                  </div>
                </div>
                
                <div className="w-full overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr>
                        <th className="h-11 px-6 text-[12px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-100 bg-white">Patient</th>
                        <th className="h-11 px-6 text-[12px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-100 bg-white">Next Appointment</th>
                        <th className="h-11 px-6 text-[12px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-100 bg-white">Status</th>
                        <th className="h-11 px-6 text-[12px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-100 bg-white text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {DEMO_PATIENTS.map((pt) => (
                        <tr key={pt.id} className="group border-b border-slate-50 hover:bg-slate-50/80 transition-colors last:border-0 cursor-pointer" onClick={() => openDrawer(pt)}>
                          <td className="px-6 py-4 align-middle">
                            <PatientIdentity name={pt.name} id={pt.id} phone={pt.phone} />
                          </td>
                          <td className="px-6 py-4 align-middle">
                            <div className="flex flex-col">
                              <span className="text-[13.5px] font-semibold text-slate-800">{pt.nextAppointment}</span>
                              <span className="text-[12px] text-slate-500 font-medium mt-0.5">Dr. Arun</span>
                            </div>
                          </td>
                          <td className="px-6 py-4 align-middle">
                            <PremiumStatus status={pt.status} />
                          </td>
                          <td className="px-6 py-4 align-middle text-right">
                            <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-teal-600 hover:bg-white shadow-sm rounded-lg border border-transparent hover:border-slate-200" onClick={(e) => { e.stopPropagation(); openDrawer(pt) }}>
                                <Eye className="h-[15px] w-[15px]" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-emerald-600 hover:bg-white shadow-sm rounded-lg border border-transparent hover:border-slate-200" onClick={(e) => e.stopPropagation()}>
                                <Edit2 className="h-[15px] w-[15px]" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </PremiumCard>
            </div>
          </div>
        </main>
      </div>

      {/* PREMIUM DRAWER PATTERN */}
      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetContent side="right" className="w-full sm:max-w-md p-0 bg-[#f8fafc] border-l-0 shadow-[-10px_0_40px_rgba(0,0,0,0.06)] flex flex-col gap-0 transition-transform duration-300">
          
          <div className="px-8 py-8 bg-white border-b border-slate-100 flex flex-col gap-5 shrink-0 z-10 shadow-sm relative">
            <div className="absolute top-4 right-4">
              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full text-slate-400 hover:bg-slate-100" onClick={() => setDrawerOpen(false)}>
                <CheckCircle2 className="w-5 h-5 text-emerald-500 opacity-0" />
              </Button>
            </div>
            
            {selectedPatient && (
              <>
                <PatientIdentity name={selectedPatient.name} id={selectedPatient.id} phone={selectedPatient.phone} size="lg" />
                <div className="flex items-center gap-2">
                  <PremiumStatus status={selectedPatient.status} />
                  <Badge variant="outline" className="text-slate-500 border-slate-200 bg-white font-medium text-[11px] rounded-md px-2 py-0.5 shadow-sm">
                    Last Visit: {selectedPatient.lastVisit}
                  </Badge>
                </div>
              </>
            )}
          </div>

          <SheetScrollArea className="flex-1 p-0">
            <div className="px-8 py-8 space-y-6">
              
              <div className="space-y-4">
                <h3 className="text-[13px] font-bold text-slate-400 uppercase tracking-widest ml-1">Clinical Details</h3>
                
                <PremiumCard className="p-0 border-slate-200 shadow-sm rounded-xl overflow-hidden divide-y divide-slate-100">
                  <div className="p-5 flex flex-col gap-1.5 hover:bg-slate-50 transition-colors">
                    <span className="text-[12px] font-semibold text-slate-500 uppercase tracking-wider">Medical History</span>
                    <span className="text-[14px] font-medium text-slate-900 leading-relaxed">No known allergies. Patient reported sensitivity to cold.</span>
                  </div>
                  <div className="p-5 flex flex-col gap-1.5 hover:bg-slate-50 transition-colors">
                    <span className="text-[12px] font-semibold text-slate-500 uppercase tracking-wider">Current Treatment</span>
                    <span className="text-[14px] font-medium text-slate-900 leading-relaxed">Root canal (Tooth 14) in progress.</span>
                  </div>
                </PremiumCard>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <button className="flex flex-col items-center justify-center p-5 bg-white border border-slate-200 rounded-xl hover:border-teal-400 hover:shadow-md hover:-translate-y-0.5 transition-all group">
                  <div className="w-10 h-10 rounded-full bg-teal-50 text-teal-600 flex items-center justify-center mb-3 group-hover:bg-teal-500 group-hover:text-white transition-colors">
                    <Play className="w-4 h-4 fill-current ml-0.5" />
                  </div>
                  <span className="text-[13px] font-bold text-slate-700 group-hover:text-teal-700">Start Consultation</span>
                </button>
                <button className="flex flex-col items-center justify-center p-5 bg-white border border-slate-200 rounded-xl hover:border-blue-400 hover:shadow-md hover:-translate-y-0.5 transition-all group">
                  <div className="w-10 h-10 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center mb-3 group-hover:bg-blue-500 group-hover:text-white transition-colors">
                    <FileText className="w-4 h-4" />
                  </div>
                  <span className="text-[13px] font-bold text-slate-700 group-hover:text-blue-700">View Prescriptions</span>
                </button>
              </div>

            </div>
          </SheetScrollArea>

          <div className="px-8 py-5 bg-white border-t border-slate-100 shrink-0 flex items-center justify-end gap-3 z-10 shadow-[0_-4px_12px_rgba(0,0,0,0.02)]">
            <Button variant="outline" onClick={() => setDrawerOpen(false)} className="h-10 px-6 rounded-xl font-bold text-slate-600 border-slate-200 hover:bg-slate-50 hover:text-slate-900 shadow-sm">
              Close
            </Button>
            <Button className="h-10 px-6 rounded-xl font-bold bg-slate-900 text-white hover:bg-slate-800 shadow-md">
              Save Notes
            </Button>
          </div>

        </SheetContent>
      </Sheet>

    </div>
  )
}
