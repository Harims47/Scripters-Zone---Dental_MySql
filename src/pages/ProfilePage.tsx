import { useState } from 'react'
import { User, Edit2, Loader2 } from 'lucide-react'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Sheet, SheetContent, SheetScrollArea } from '../components/ui/sheet'
import { EntityDrawerHeader, DrawerSection, DrawerFooterActions, ReadOnlyField } from '../components/ui/drawer-patterns'
import { useAuth } from '../context/AuthContext'
import { useClinicContext } from '../context/ClinicContext'
import toast from 'react-hot-toast'

export function ProfilePage() {
  const { currentUser, updateProfile } = useAuth()
  const { reloadStaff } = useClinicContext()
  
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  // Current profile values directly from active session
  const displayName = currentUser?.staff?.name || currentUser?.name || 'Staff Member'
  const displayRole = currentUser?.role || 'Staff'
  const displayPhone = currentUser?.staff?.phone || ''

  // Drawer draft state
  const [draftName, setDraftName] = useState('')
  const [draftPhone, setDraftPhone] = useState('')

  const handleOpenDrawer = () => {
    setDraftName(displayName)
    setDraftPhone(displayPhone)
    setDrawerOpen(true)
  }

  const handleSave = async () => {
    if (!draftName.trim()) {
      toast.error('Full Name is required')
      return
    }

    try {
      setIsSaving(true)
      const res = await updateProfile({
        name: draftName.trim(),
        phone: draftPhone.trim()
      })

      if (res.success) {
        toast.success('Profile updated successfully')
        setDrawerOpen(false)
        if (reloadStaff) {
          reloadStaff().catch(() => {})
        }
      } else {
        toast.error(res.error || 'Failed to update profile')
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to update profile')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="h-full flex flex-col gap-6 max-w-[800px] mx-auto pb-8 pt-4">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">My Profile</h1>
        <p className="text-slate-500 mt-1">Manage your personal account details and credentials.</p>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100/60 shadow-[0_2px_12px_-4px_rgba(15,23,42,0.04)] p-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-xl font-bold text-slate-900">Personal Information</h2>
            <p className="text-slate-500 text-sm mt-1">Your identity and contact details in the system.</p>
          </div>
          <Button onClick={handleOpenDrawer} variant="outline" className="shadow-sm">
            <Edit2 className="w-4 h-4 mr-2 text-slate-400" /> Edit Profile
          </Button>
        </div>
        
        <div className="flex items-start gap-8">
          <div className="w-24 h-24 rounded-full bg-slate-100 text-slate-500 text-3xl font-bold flex items-center justify-center shrink-0">
            {displayName.charAt(0).toUpperCase()}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-6 gap-x-12 flex-1 pt-2">
            <div className="space-y-1.5">
              <div className="text-[13px] font-semibold text-slate-500">Full Name</div>
              <div className="text-[15px] font-medium text-slate-900">{displayName}</div>
            </div>
            <div className="space-y-1.5">
              <div className="text-[13px] font-semibold text-slate-500">Role</div>
              <div className="text-[15px] text-slate-900">{displayRole}</div>
            </div>
            <div className="space-y-1.5">
              <div className="text-[13px] font-semibold text-slate-500">Phone Number</div>
              <div className="text-[15px] text-slate-900">{displayPhone || '—'}</div>
            </div>
          </div>
        </div>
      </div>

      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetContent side="right" className="sm:max-w-md bg-white border-l shadow-2xl p-0 flex flex-col gap-0 transition-transform duration-300">
          <EntityDrawerHeader 
            name={draftName || displayName} 
            metadata={displayRole}
            icon={<User className="w-6 h-6" />}
            modeText="Edit My Profile"
          />
          <SheetScrollArea>
            <DrawerSection title="Personal Information">
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700">Full Name</label>
                  <Input
                    value={draftName}
                    onChange={e => setDraftName(e.target.value)}
                    placeholder="Enter full name"
                    className="bg-white"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700">Phone</label>
                  <Input
                    value={draftPhone}
                    onChange={e => setDraftPhone(e.target.value)}
                    placeholder="Enter phone number"
                    className="bg-white"
                  />
                </div>
                <ReadOnlyField label="Role" value={displayRole} />
              </div>
            </DrawerSection>
          </SheetScrollArea>
          <DrawerFooterActions>
            <Button
              variant="outline"
              onClick={() => setDrawerOpen(false)}
              disabled={isSaving}
              className="bg-white w-full sm:w-auto"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={isSaving}
              className="bg-teal-600 hover:bg-teal-700 w-full sm:w-auto text-white shadow-sm flex items-center justify-center gap-1.5"
            >
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
              Save Changes
            </Button>
          </DrawerFooterActions>
        </SheetContent>
      </Sheet>
    </div>
  )
}
