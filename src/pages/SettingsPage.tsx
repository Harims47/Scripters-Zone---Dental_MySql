import { useState } from 'react'
import { Building2, Phone, Mail, MapPin, Edit2, Globe, MessageSquare, CheckCircle2, ShieldCheck, Clock } from 'lucide-react'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Badge } from '../components/ui/badge'
import { Sheet, SheetContent, SheetScrollArea } from '../components/ui/sheet'
import { EntityDrawerHeader, DrawerSection, DrawerFooterActions } from '../components/ui/drawer-patterns'
import { 
  DEMO_CLINIC_PROFILE, 
  type ClinicProfile
} from '../lib/mock-data'
import toast from 'react-hot-toast'

const STORAGE_KEY = 'dentalcore_clinic_profile'

export function SettingsPage() {
  // Initialize state with local storage fallback or default demo profile
  const [clinic, setClinic] = useState<ClinicProfile>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) {
        const parsed = JSON.parse(saved)
        return { ...DEMO_CLINIC_PROFILE, ...parsed }
      }
    } catch {
      // Fallback
    }
    return DEMO_CLINIC_PROFILE
  })

  // Drawer state for editing clinic profile
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editFormData, setEditFormData] = useState<ClinicProfile>(clinic)

  const handleOpenEdit = () => {
    setEditFormData({ ...clinic })
    setDrawerOpen(true)
  }

  const handleSave = () => {
    if (!editFormData.name.trim()) {
      toast.error('Clinic Name is required.')
      return
    }
    if (!editFormData.phone.trim()) {
      toast.error('Phone number is required.')
      return
    }

    setClinic(editFormData)
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(editFormData))
    } catch (err) {
      console.error('Failed to save clinic profile to localStorage', err)
    }

    setDrawerOpen(false)
    toast.success('Clinic profile updated successfully.')
  }

  return (
    <div className="h-full flex flex-col gap-6 max-w-[1100px] mx-auto pb-12">
      
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Settings</h1>
        <p className="text-slate-500 text-sm mt-1">
          Manage your clinic configuration and preferences.
        </p>
      </div>

      {/* Redesigned Clean Clinic Profile Card */}
      <div className="bg-white rounded-2xl border border-slate-100/80 shadow-[0_2px_16px_-4px_rgba(15,23,42,0.04)] overflow-hidden">
        
        {/* Card Header with Edit Action */}
        <div className="p-6 sm:p-8 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-teal-500 to-emerald-600 text-white font-bold text-lg flex items-center justify-center shadow-md shadow-teal-500/20 shrink-0">
              {clinic.name ? clinic.name.charAt(0).toUpperCase() : 'D'}
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h2 className="text-xl font-bold text-slate-900 tracking-tight">Clinic Profile</h2>
                <Badge variant="statusActive" className="text-[11px] font-semibold px-2 py-0.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5" />
                  Active
                </Badge>
              </div>
              <p className="text-slate-500 text-sm mt-0.5">Manage core clinic details and contact information.</p>
            </div>
          </div>

          <Button 
            onClick={handleOpenEdit} 
            variant="outline" 
            className="shadow-sm border-slate-200 hover:bg-slate-50 text-slate-700 font-medium self-start sm:self-auto gap-2"
          >
            <Edit2 className="w-4 h-4 text-slate-500" />
            Edit Profile
          </Button>
        </div>

        {/* Clean Fields Display */}
        <div className="p-6 sm:p-8 space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-6 gap-x-10">
            
            {/* Clinic Name */}
            <div className="space-y-1.5">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">Clinic Name</span>
              <div className="text-[15px] font-semibold text-slate-900 flex items-center gap-2">
                <Building2 className="w-4 h-4 text-slate-400 shrink-0" />
                <span>{clinic.name}</span>
              </div>
            </div>

            {/* Default Language */}
            <div className="space-y-1.5">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">Default Language</span>
              <div className="text-[15px] font-medium text-slate-900 flex items-center gap-2">
                <Globe className="w-4 h-4 text-slate-400 shrink-0" />
                <span>{clinic.language || 'English'}</span>
              </div>
            </div>

            {/* Phone Number */}
            <div className="space-y-1.5">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">Phone Number</span>
              <div className="text-[15px] font-medium text-slate-900 flex items-center gap-2">
                <Phone className="w-4 h-4 text-teal-600 shrink-0" />
                <a href={`tel:${clinic.phone}`} className="hover:text-teal-600 transition-colors">
                  {clinic.phone}
                </a>
              </div>
            </div>

            {/* Email Address */}
            <div className="space-y-1.5">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">Email Address</span>
              <div className="text-[15px] font-medium text-slate-900 flex items-center gap-2">
                <Mail className="w-4 h-4 text-slate-400 shrink-0" />
                <a href={`mailto:${clinic.email}`} className="hover:text-teal-600 transition-colors">
                  {clinic.email}
                </a>
              </div>
            </div>

            {/* Clinic Address */}
            <div className="col-span-full pt-2 border-t border-slate-100 space-y-1.5">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">Clinic Address</span>
              <div className="text-[15px] text-slate-900 leading-relaxed flex items-start gap-2">
                <MapPin className="w-4 h-4 text-slate-400 shrink-0 mt-1" />
                <div>
                  <div>{clinic.address}</div>
                  <div className="text-slate-600">{clinic.city} - {clinic.pin}</div>
                </div>
              </div>
            </div>

          </div>
        </div>

      </div>

      {/* Automated Communications & Messaging Card */}
      <div className="bg-white rounded-2xl border border-slate-100/80 shadow-[0_2px_16px_-4px_rgba(15,23,42,0.04)] overflow-hidden">
        <div className="p-6 sm:p-8 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white font-bold text-lg flex items-center justify-center shadow-md shadow-blue-500/20 shrink-0">
              <MessageSquare className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h2 className="text-xl font-bold text-slate-900 tracking-tight">Automated Communication & Messaging</h2>
                <Badge variant="statusActive" className="text-[11px] font-semibold px-2 py-0.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5" />
                  Active
                </Badge>
              </div>
              <p className="text-slate-500 text-sm mt-0.5">
                Automated multichannel delivery for appointment confirmations, receipts, invoices, and digital prescriptions.
              </p>
            </div>
          </div>
        </div>

        {/* Communication Channels Grid */}
        <div className="p-6 sm:p-8 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            
            {/* WhatsApp */}
            <div className="p-5 rounded-xl border border-slate-200/80 bg-slate-50/50 flex flex-col justify-between space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-teal-700 bg-teal-50 px-2 py-0.5 rounded border border-teal-200/50">
                    Primary Channel
                  </span>
                  <span className="flex items-center text-xs font-semibold text-emerald-600 gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Ready
                  </span>
                </div>
                <h3 className="font-bold text-slate-900 text-base">WhatsApp Messaging</h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Sends instant appointment confirmations, 24-hour visit reminders, digital prescriptions, and official payment receipts directly to patient devices.
                </p>
              </div>
              <div className="pt-3 border-t border-slate-200/60 text-[11px] text-slate-500 font-medium">
                Auto-detected contact validation enabled
              </div>
            </div>

            {/* SMS */}
            <div className="p-5 rounded-xl border border-slate-200/80 bg-slate-50/50 flex flex-col justify-between space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200/50">
                    Fallback & Direct
                  </span>
                  <span className="flex items-center text-xs font-semibold text-emerald-600 gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Ready
                  </span>
                </div>
                <h3 className="font-bold text-slate-900 text-base">SMS Notifications</h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Automated fallback dispatch for patients without WhatsApp, as well as direct transactional SMS alerts and emergency notifications.
                </p>
              </div>
              <div className="pt-3 border-t border-slate-200/60 text-[11px] text-slate-500 font-medium">
                Instant delivery with guaranteed coverage
              </div>
            </div>

            {/* Email */}
            <div className="p-5 rounded-xl border border-slate-200/80 bg-slate-50/50 flex flex-col justify-between space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-purple-700 bg-purple-50 px-2 py-0.5 rounded border border-purple-200/50">
                    Documents & Vendor
                  </span>
                  <span className="flex items-center text-xs font-semibold text-emerald-600 gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Ready
                  </span>
                </div>
                <h3 className="font-bold text-slate-900 text-base">Email Dispatch</h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Transmits formal Purchase Orders to medical suppliers with attached purchase order PDFs, detailed patient invoices, and treatment documentation.
                </p>
              </div>
              <div className="pt-3 border-t border-slate-200/60 text-[11px] text-slate-500 font-medium">
                High-deliverability transactional server
              </div>
            </div>

          </div>

          {/* System Security & Reliability Badges */}
          <div className="pt-5 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs text-slate-600">
            <div className="flex items-center gap-2.5">
              <Clock className="w-4 h-4 text-teal-600 shrink-0" />
              <span><strong>24-Hour Reminder Sweep:</strong> Automatically runs in background</span>
            </div>
            <div className="flex items-center gap-2.5">
              <ShieldCheck className="w-4 h-4 text-indigo-600 shrink-0" />
              <span><strong>Duplicate Guard:</strong> Atomic PostgreSQL locking & 60s cooldown</span>
            </div>
            <div className="flex items-center gap-2.5">
              <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
              <span><strong>Doctor-Owned Privacy:</strong> Sensitive payment data masked</span>
            </div>
          </div>
        </div>
      </div>

      {/* Slide-out Edit Profile Drawer */}
      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetContent side="right" className="sm:max-w-md bg-white border-l shadow-2xl p-0 flex flex-col gap-0 transition-transform duration-300">
          <EntityDrawerHeader 
            name={editFormData.name || 'Clinic Profile'} 
            metadata={editFormData.city}
            icon={<Building2 className="w-6 h-6 text-teal-600" />}
            modeText="Edit Clinic Profile"
          />

          <SheetScrollArea className="flex-1">
            <div className="p-6 space-y-6">
              
              <DrawerSection title="Basic Information">
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                      Clinic Name <span className="text-red-500">*</span>
                    </label>
                    <Input 
                      value={editFormData.name} 
                      onChange={e => setEditFormData({ ...editFormData, name: e.target.value })} 
                      placeholder="e.g. DentalCore Dental Clinic" 
                      className="bg-white border-slate-200"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                      Default Language
                    </label>
                    <Input 
                      value={editFormData.language} 
                      onChange={e => setEditFormData({ ...editFormData, language: e.target.value })} 
                      placeholder="e.g. English" 
                      className="bg-white border-slate-200"
                    />
                  </div>
                </div>
              </DrawerSection>

              <DrawerSection title="Contact Details">
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                      Phone Number <span className="text-red-500">*</span>
                    </label>
                    <Input 
                      value={editFormData.phone} 
                      onChange={e => setEditFormData({ ...editFormData, phone: e.target.value })} 
                      placeholder="e.g. +91 98765 43210" 
                      className="bg-white border-slate-200"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                      Email Address
                    </label>
                    <Input 
                      type="email"
                      value={editFormData.email} 
                      onChange={e => setEditFormData({ ...editFormData, email: e.target.value })} 
                      placeholder="e.g. clinic@dentalcore.demo" 
                      className="bg-white border-slate-200"
                    />
                  </div>
                </div>
              </DrawerSection>

              <DrawerSection title="Location">
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                      Address
                    </label>
                    <Input 
                      value={editFormData.address} 
                      onChange={e => setEditFormData({ ...editFormData, address: e.target.value })} 
                      placeholder="e.g. 12 MG Road" 
                      className="bg-white border-slate-200"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">City</label>
                      <Input 
                        value={editFormData.city} 
                        onChange={e => setEditFormData({ ...editFormData, city: e.target.value })} 
                        placeholder="e.g. Bengaluru" 
                        className="bg-white border-slate-200"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">PIN / Postal Code</label>
                      <Input 
                        value={editFormData.pin} 
                        onChange={e => setEditFormData({ ...editFormData, pin: e.target.value })} 
                        placeholder="e.g. 560001" 
                        className="bg-white border-slate-200 font-mono"
                      />
                    </div>
                  </div>
                </div>
              </DrawerSection>

            </div>
          </SheetScrollArea>

          <DrawerFooterActions>
            <Button 
              variant="outline" 
              onClick={() => setDrawerOpen(false)} 
              className="bg-white w-full sm:w-auto"
            >
              Cancel
            </Button>
            <Button 
              onClick={handleSave} 
              className="bg-teal-600 hover:bg-teal-700 text-white shadow-sm w-full sm:w-auto"
            >
              Save Changes
            </Button>
          </DrawerFooterActions>
        </SheetContent>
      </Sheet>

      {/* System Information & Copyright Card */}
      <div className="bg-white rounded-2xl border border-slate-100/80 shadow-[0_2px_16px_-4px_rgba(15,23,42,0.04)] p-6 sm:p-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-base font-bold text-slate-900 tracking-tight">DentalCore Clinic Management System</h3>
          <p className="text-slate-500 text-sm mt-0.5">Version 1.0.0 • Production Ready</p>
        </div>
        <div className="text-left sm:text-right text-xs text-slate-500 font-medium">
          <div>Developed & Maintained by <span className="font-semibold text-slate-700">Scripters Zone</span></div>
          <div className="text-slate-400 mt-0.5">© {new Date().getFullYear()} Scripters Zone. All rights reserved.</div>
        </div>
      </div>

    </div>
  )
}
