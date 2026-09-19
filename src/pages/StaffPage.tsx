import { useState, useEffect, useCallback } from 'react'
import { toast } from 'react-hot-toast'
import { Plus, Search, User, Phone, Edit2, ShieldOff, Eye } from 'lucide-react'
import { DataTable } from '../components/data-table/data-table'
import { DataTableToolbar } from '../components/data-table/data-table-toolbar'
import { DataTableEmpty } from '../components/data-table/data-table'
import type { ColumnDef, PaginationState } from '@tanstack/react-table'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Sheet, SheetContent, SheetScrollArea } from '../components/ui/sheet'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../components/ui/dialog'
import { DrawerFooterActions } from '../components/ui/drawer-patterns'
import { StaffStatusBadge, ModuleAccessEditor } from '../components/staff/staff-components'
import { type ClinicRole, type ClinicModule, ROLE_CONFIG, SIDEBAR_MODULES } from '../lib/role-config'
import type { Staff } from '../lib/mock-data'
import { api } from '../lib/api'
import { useClinicContext } from '../context/ClinicContext'
import { useAuth } from '../context/AuthContext'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select'
import type { PaginationMeta, PaginatedResponse } from '../types/domain'

type StaffStatus = 'Active' | 'Inactive'

export function StaffPage() {
  const { currentUser, refreshSession } = useAuth()
  const { reloadStaff, updateStaffAttendance } = useClinicContext()
  const [data, setData] = useState<Staff[]>([])
  const [meta, setMeta] = useState<PaginationMeta>({ currentPage: 1, pageSize: 10, totalRecords: 0, totalPages: 0 })
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [filterRole, setFilterRole] = useState('all')
  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: 10 })

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300)
    return () => clearTimeout(timer)
  }, [search])

  useEffect(() => {
    setPagination(prev => ({ ...prev, pageIndex: 0 }))
  }, [debouncedSearch, filterRole])

  const fetchStaff = useCallback(async (page: number, limit: number, query: string, role: string) => {
    try {
      const roleQuery = role && role !== 'all' ? `&role=${encodeURIComponent(role)}` : ''
      const res = await api.get<PaginatedResponse<Staff>>(`/api/staff?page=${page}&limit=${limit}&search=${encodeURIComponent(query)}${roleQuery}`)
      const payload = res as any
      if (payload.data && payload.meta) {
        setData(payload.data)
        setMeta(payload.meta)
      } else {
        // Fallback for old controller if server not restarted
        setData((res as any).data || [])
      }
    } catch (e) {
      console.error(e)
    }
  }, [])

  useEffect(() => {
    fetchStaff(pagination.pageIndex + 1, pagination.pageSize, debouncedSearch, filterRole)
  }, [pagination.pageIndex, pagination.pageSize, debouncedSearch, filterRole, fetchStaff])
  
  // Drawer state
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [drawerMode, setDrawerMode] = useState<'create' | 'view' | 'edit'>('create')
  
  // Edit/Create form state
  const [activeItem, setActiveItem] = useState<Partial<Staff>>({})

  // Deactivate dialog state
  const [deactivateId, setDeactivateId] = useState<string | null>(null)

  const handleOpenCreate = () => {
    const defaultRole: ClinicRole = 'Duty Doctor'
    const sidebarDefaults = SIDEBAR_MODULES.filter(m => ROLE_CONFIG[defaultRole]?.permissions.includes(m))
    setActiveItem({
      status: 'Active',
      role: defaultRole,
      permissions: [...sidebarDefaults]
    })
    setDrawerMode('create')
    setDrawerOpen(true)
  }

  const handleOpenView = (row: Staff) => {
    const roleBaseline = ROLE_CONFIG[row.role]?.permissions || []
    const sidebarBaseline = SIDEBAR_MODULES.filter(m => roleBaseline.includes(m))
    const effectivePerms = (row.permissions !== null && row.permissions !== undefined && Array.isArray(row.permissions))
      ? row.permissions
      : [...sidebarBaseline]
    setActiveItem({ ...row, permissions: effectivePerms })
    setDrawerMode('view')
    setDrawerOpen(true)
  }

  const handleOpenEdit = (row: Staff) => {
    const cleanedPhone = (row.phone || '').replace(/\D/g, '').slice(-10)
    const roleBaseline = ROLE_CONFIG[row.role]?.permissions || []
    const sidebarBaseline = SIDEBAR_MODULES.filter(m => roleBaseline.includes(m))
    const effectivePerms = (row.permissions !== null && row.permissions !== undefined && Array.isArray(row.permissions))
      ? row.permissions
      : [...sidebarBaseline]
    setActiveItem({ ...row, phone: cleanedPhone, permissions: effectivePerms })
    setDrawerMode('edit')
    setDrawerOpen(true)
  }

  const handleSave = async () => {
    const cleanedPhone = (activeItem.phone || '').replace(/\D/g, '').slice(-10)
    if (!activeItem.name || !cleanedPhone || !activeItem.role) {
      toast.error('Please fill out all mandatory fields.');
      return;
    }
    if (cleanedPhone.length !== 10) {
      toast.error('Phone number must be exactly 10 digits.');
      return;
    }
    const itemToSave = {
      ...activeItem,
      phone: cleanedPhone,
      permissions: Array.isArray(activeItem.permissions) ? activeItem.permissions : []
    };
    if ((activeItem as any).hasAccess && (!(activeItem as any).username || !(activeItem as any).password)) {
      toast.error('System Username and Password are required when granting system access.');
      return;
    }

    try {
      if (drawerMode === 'create') {
        await api.post('/api/staff', itemToSave)
        toast.success('Staff member created successfully.')
      } else if (drawerMode === 'edit') {
        await api.put(`/api/staff/${activeItem.id}`, itemToSave)
        toast.success('Staff member updated successfully.')
      }
      if (activeItem.id && currentUser && (activeItem.id === currentUser.staffId || activeItem.id === currentUser.id)) {
        if (refreshSession) {
          await refreshSession()
        }
      }
      await reloadStaff()
      await fetchStaff(pagination.pageIndex + 1, pagination.pageSize, debouncedSearch, filterRole)
      setDrawerOpen(false)
    } catch (error: any) {
      console.error(error)
      toast.error(error.message || "Failed to save staff member")
    }
  }

  const handleConfirmDeactivate = async () => {
    if (deactivateId) {
      try {
        await api.put(`/api/staff/${deactivateId}/status`, { status: 'Inactive' })
        await reloadStaff()
        await fetchStaff(pagination.pageIndex + 1, pagination.pageSize, debouncedSearch, filterRole)
        setDeactivateId(null)
        toast.success('Staff member deactivated.')
      } catch (error: any) {
        console.error(error)
        toast.error(error.message || "Failed to deactivate staff")
      }
    }
  }

  const handleAttendanceChange = async (id: string, attendance: string) => {
    try {
      await updateStaffAttendance(id, attendance);
      toast.success("Attendance updated");
      await fetchStaff(pagination.pageIndex + 1, pagination.pageSize, debouncedSearch, filterRole);
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || "Failed to update attendance");
    }
  };

  // Remove filteredData since search is on backend

  const columns: ColumnDef<Staff>[] = [
    {
      header: "Staff Member",
      accessorKey: "name",
      cell: ({ row }) => (
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-indigo-50 text-indigo-700 flex items-center justify-center font-bold text-sm shrink-0">
            {row.original.name.substring(0, 2).toUpperCase()}
          </div>
          <div>
            <div className="font-semibold text-slate-900">{row.original.name}</div>
          </div>
        </div>
      )
    },
    {
      header: "Role",
      accessorKey: "role",
      cell: ({ row }) => <span className="font-medium text-slate-700">{row.original.role}</span>
    },
    {
      header: "Phone",
      accessorKey: "phone",
      cell: ({ row }) => <span className="text-slate-600">{row.original.phone}</span>
    },
    {
      header: "Status",
      accessorKey: "status",
      cell: ({ row }) => <StaffStatusBadge status={row.original.status} />
    },
    {
      header: "Attendance",
      accessorKey: "attendance",
      cell: ({ row }) => {
        if (row.original.status !== 'Active') return <span className="text-slate-400 text-sm">—</span>;
        
        const canEditAttendance = currentUser?.role === 'Head Doctor';
        
        return (
          <Select 
            value={row.original.attendance || 'Present'} 
            onValueChange={(val) => handleAttendanceChange(row.original.id, val)}
            disabled={!canEditAttendance}
          >
            <SelectTrigger className="h-8 w-32 border-slate-200" title={!canEditAttendance ? "Only Head Doctor can change attendance" : undefined}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Present">Present</SelectItem>
              <SelectItem value="Leave">Leave</SelectItem>
            </SelectContent>
          </Select>
        );
      }
    },
    {
      id: "actions",
      header: "Actions",
      cell: ({ row }) => (
        <div className="flex items-center justify-end gap-2">
          {row.original.status === 'Active' && (
            <>
              <Button size="icon" variant="ghost" className="h-8 w-8 rounded-lg text-blue-600 hover:text-blue-700 hover:bg-blue-50 transition-colors" aria-label="Edit staff" title="Edit Staff" onClick={() => handleOpenEdit(row.original)}>
                <Edit2 className="w-4 h-4" />
              </Button>
              <Button size="icon" variant="ghost" className="h-8 w-8 rounded-lg text-rose-500 hover:text-rose-600 hover:bg-rose-50 transition-colors" aria-label="Deactivate staff" title="Deactivate Staff" onClick={() => setDeactivateId(row.original.id)}>
                <ShieldOff className="w-4 h-4" />
              </Button>
            </>
          )}
          <Button size="icon" variant="ghost" onClick={() => handleOpenView(row.original)} className="h-8 w-8 rounded-lg text-slate-500 hover:text-teal-600 hover:bg-teal-50 transition-colors" aria-label="View staff" title="View Staff">
            <Eye className="w-4 h-4" />
          </Button>
        </div>
      )
    }
  ]

  // Derived for drawer
  const isCreating = drawerMode === 'create'
  
  return (
    <div className="h-full flex flex-col gap-6 max-w-[1400px] mx-auto pb-8">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Staff & Roles</h1>
          <p className="text-slate-500 mt-1">Manage clinic staff and role assignments.</p>
        </div>
        <Button onClick={handleOpenCreate} className="shadow-sm w-full sm:w-auto">
          <Plus className="w-4 h-4 mr-2" />
          Add Staff
        </Button>
      </div>

      <DataTableToolbar
        searchQuery={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search name or phone..."
        filterSlot={
          <select
            value={filterRole}
            onChange={(e) => setFilterRole(e.target.value)}
            className="flex h-9 w-[150px] items-center justify-between rounded-xl border border-input bg-slate-50/50 hover:bg-slate-50 px-3 py-1.5 text-sm shadow-sm ring-offset-background focus:outline-none focus:ring-1 focus:ring-teal-500"
          >
            <option value="all">All Roles</option>
            <option value="Head Doctor">Head Doctor</option>
            <option value="Duty Doctor">Duty Doctor</option>
            <option value="Receptionist">Receptionist</option>
          </select>
        }
        exportOptions={{ 
          pdf: true, 
          excel: true, 
          csv: true,
          onExport: (format) => {
            const query = new URLSearchParams({
              format,
              ...(debouncedSearch ? { search: debouncedSearch } : {}),
              ...(filterRole && filterRole !== 'all' ? { role: filterRole } : {})
            }).toString();
            api.download(`/api/staff/export?${query}`, `staff_export.${format}`);
          }
        }}
      />

      {/* Data Table */}
      <div className="bg-white rounded-2xl border border-slate-100/60 shadow-[0_2px_12px_-4px_rgba(15,23,42,0.04)] overflow-hidden flex-1">
        <DataTable 
          columns={columns} 
          data={data}
          manualPagination={true}
          pageCount={meta.totalPages}
          totalRecords={meta.totalRecords}
          state={{ pagination }}
          onStateChange={(updater: any) => {
            if (typeof updater === 'function') {
              setPagination(updater(pagination));
            } else if (updater.pagination) {
              setPagination(updater.pagination);
            }
          }}
          emptyState={
            search !== '' ? (
              <DataTableEmpty 
                icon={Search} 
                title="No staff found" 
                description={`There are no staff matching "${search}".`}
              />
            ) : (
              <DataTableEmpty 
                icon={User}
                title="No staff members" 
                description="Add staff members to get started." 
                action={<Button onClick={handleOpenCreate} className="shadow-sm">Add Staff</Button>}
              />
            )
          }
        />
      </div>

      {/* Deactivate Dialog */}
      <Dialog open={!!deactivateId} onOpenChange={(open) => !open && setDeactivateId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Deactivate Staff?</DialogTitle>
            <DialogDescription>
              This staff member will no longer be active or have access to the system.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0 mt-4">
            <Button variant="outline" onClick={() => setDeactivateId(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleConfirmDeactivate}>Deactivate Staff</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Staff Drawer */}
      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetContent side="right" size="lg" className="sm:max-w-md bg-white border-l shadow-2xl p-0 flex flex-col gap-0 transition-transform duration-300">
          
          {/* Drawer Header */}
          <div className="px-6 py-6 bg-white border-b border-slate-100">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-xl font-bold tracking-tight text-slate-900">
                  {isCreating ? 'Add Staff Member' : activeItem.name}
                </h2>
                <p className="text-slate-500 mt-1">
                  {isCreating ? 'Configure new clinic personnel.' : 'Manage staff member details.'}
                </p>
              </div>
              <div className="mt-1 pr-6">
                {!isCreating && <StaffStatusBadge status={activeItem.status as StaffStatus} />}
              </div>
            </div>
          </div>

          {/* Drawer Body */}
          <SheetScrollArea className="p-0 bg-white flex-1">
            <div className="px-6 sm:px-8 py-8 space-y-8">
              
              {/* Form Fields */}
              <div className="space-y-6">
                
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700">Full Name <span className="text-red-500">*</span></label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input 
                      className="pl-9 bg-slate-50" 
                      placeholder="e.g. Dr. John Doe"
                      value={activeItem.name || ''}
                      onChange={e => setActiveItem(prev => ({ ...prev, name: e.target.value }))}
                      readOnly={drawerMode === 'view'}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700">Phone Number <span className="text-red-500">*</span></label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input 
                      className="pl-9 bg-slate-50" 
                      placeholder="10 digit number"
                      value={activeItem.phone || ''}
                      onChange={e => {
                        const val = e.target.value.replace(/\D/g, '').slice(0, 10);
                        setActiveItem(prev => ({ ...prev, phone: val }))
                      }}
                      maxLength={10}
                      readOnly={drawerMode === 'view'}
                    />
                  </div>
                </div>

                {isCreating && (
                  <div className="pt-2 pb-1">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input 
                        type="checkbox" 
                        className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
                        checked={(activeItem as any).hasAccess || false}
                        onChange={e => setActiveItem(prev => ({ ...prev, hasAccess: e.target.checked }))}
                      />
                      <span className="text-sm font-semibold text-slate-700">Grant System Access</span>
                    </label>
                    <p className="text-xs text-slate-500 mt-1 ml-6">Allow this staff member to log in to the DentalCore system.</p>
                  </div>
                )}

                {isCreating && (activeItem as any).hasAccess && (
                  <div className="grid grid-cols-2 gap-4 ml-6 pl-4 border-l-2 border-indigo-100">
                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-slate-700">System Username <span className="text-red-500">*</span></label>
                      <Input 
                        className="bg-white border-slate-200" 
                        placeholder="e.g. jdoe"
                        value={(activeItem as any).username || ''}
                        onChange={e => setActiveItem(prev => ({ ...prev, username: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-slate-700">Initial Password <span className="text-red-500">*</span></label>
                      <Input 
                        type="password"
                        className="bg-white border-slate-200" 
                        placeholder="Enter password"
                        value={(activeItem as any).password || ''}
                        onChange={e => setActiveItem(prev => ({ ...prev, password: e.target.value }))}
                      />
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700">Assigned Role <span className="text-red-500">*</span></label>
                  <select 
                    className="flex h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-[14px] text-slate-900 shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-all focus-visible:outline-none focus-visible:border-teal-300 focus-visible:ring-4 focus-visible:ring-teal-50 hover:border-slate-300 disabled:opacity-50"
                    value={activeItem.role || ''}
                    onChange={e => {
                      const newRole = e.target.value as ClinicRole
                      const newBaseline = ROLE_CONFIG[newRole]?.permissions || []
                      const sidebarDefaults = SIDEBAR_MODULES.filter(m => newBaseline.includes(m))
                      setActiveItem(prev => ({
                        ...prev,
                        role: newRole,
                        permissions: [...sidebarDefaults]
                      }))
                    }}
                    disabled={drawerMode === 'view'}
                  >
                    {Object.keys(ROLE_CONFIG).map(r => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                </div>

                {(activeItem.role === 'Head Doctor' || activeItem.role === 'Duty Doctor') && (
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-slate-700">Room Number</label>
                    <Input 
                      className="bg-white border-slate-200" 
                      placeholder="e.g. Room 101"
                      value={activeItem.roomNumber || ''}
                      onChange={e => setActiveItem(prev => ({ ...prev, roomNumber: e.target.value }))}
                      disabled={drawerMode === 'view'}
                    />
                  </div>
                )}

                {!isCreating && drawerMode === 'edit' && (
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-slate-700">Account Status</label>
                    <select 
                      className="flex h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-[14px] text-slate-900 shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-all focus-visible:outline-none focus-visible:border-teal-300 focus-visible:ring-4 focus-visible:ring-teal-50 hover:border-slate-300 disabled:opacity-50"
                      value={activeItem.status || 'Active'}
                      onChange={e => setActiveItem(prev => ({ ...prev, status: e.target.value as StaffStatus }))}
                    >
                      <option value="Active">Active</option>
                      <option value="Inactive">Inactive</option>
                    </select>
                  </div>
                )}

              </div>
              
              {/* Module Access Control */}
              <div className="pt-4 border-t">
                <ModuleAccessEditor
                  role={activeItem.role as ClinicRole || 'Duty Doctor'}
                  selectedPermissions={(activeItem.permissions as ClinicModule[]) || []}
                  onChange={(newPerms) => setActiveItem(prev => ({ ...prev, permissions: newPerms }))}
                  readOnly={drawerMode === 'view'}
                />
              </div>

            </div>
          </SheetScrollArea>
          
          {/* Drawer Footer */}
          <div className="bg-slate-50 border-t px-6 py-4">
            {drawerMode === 'view' ? (
              <DrawerFooterActions>
                <Button onClick={() => setDrawerOpen(false)} className="w-full sm:w-auto bg-rose-500 hover:bg-rose-600 text-white border-0">Close</Button>
                {activeItem.status === 'Active' && (
                  <Button className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-700 text-white border-0" onClick={() => setDrawerMode('edit')}>
                    Edit Profile
                  </Button>
                )}
              </DrawerFooterActions>
            ) : (
              <DrawerFooterActions>
                <Button variant="outline" onClick={() => setDrawerOpen(false)} className="w-full sm:w-auto bg-white">Cancel</Button>
                <Button 
                  className="w-full sm:w-auto" 
                  onClick={handleSave}
                  disabled={!activeItem.name}
                >
                  {isCreating ? 'Save Staff Member' : 'Save Changes'}
                </Button>
              </DrawerFooterActions>
            )}
          </div>

        </SheetContent>
      </Sheet>

    </div>
  )
}
