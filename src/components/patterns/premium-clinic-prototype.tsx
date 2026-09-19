import { useState } from 'react';
import {
  Users, Calendar, Clock, Settings, Search, Bell, Menu, UserCircle,
  ChevronDown, FileText, FileSpreadsheet, Printer, Filter, Eye, Edit2, Trash2
} from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui/tooltip';
import { DataTable } from '../data-table/data-table';
import { DataTableColumnHeader } from '../data-table/data-table-column-header';
import { Sheet, SheetContent, SheetHeader, SheetScrollArea, SheetFooter } from '../ui/sheet';
import { Label } from '../ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '../ui/dialog';
import { PatientIdentity } from '../ui/patient-identity';
import type { ColumnDef } from "@tanstack/react-table";

// --- DEMO DATA ---
const demoPatients = Array.from({ length: 15 }).map((_, i) => {
  const names = ["James Wilson", "Mary Smith", "Robert Johnson", "Patricia Williams", "John Brown"];
  const statuses = ["Active", "Waiting", "With Doctor", "Inactive", "Completed"];
  return {
    id: `PT-${String(i + 1).padStart(4, '0')}`,
    name: names[i % 5] + (i > 4 ? ` ${i}` : ''),
    phone: `+1 555-${String(Math.floor(Math.random() * 9000) + 1000)}`,
    doctor: ["Dr. Smith", "Dr. Adams", "Dr. Lee"][i % 3],
    lastVisit: `2026-08-${String((i % 28) + 1).padStart(2, '0')}`,
    status: statuses[i % 5],
    age: 20 + (i * 3)
  };
});
type Patient = typeof demoPatients[0];

const getStatusBadge = (status: string) => {
  switch (status) {
    case 'Active': return <Badge variant="statusActive"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5" /> Active</Badge>;
    case 'Waiting': return <Badge variant="statusWaiting"><span className="w-1.5 h-1.5 rounded-full bg-amber-500 mr-1.5" /> Waiting</Badge>;
    case 'With Doctor': return <Badge variant="statusWithDoctor"><span className="w-1.5 h-1.5 rounded-full bg-blue-500 mr-1.5" /> With Doctor</Badge>;
    case 'Inactive': return <Badge variant="statusInactive"><span className="w-1.5 h-1.5 rounded-full bg-slate-400 mr-1.5" /> Inactive</Badge>;
    case 'Completed': return <Badge variant="statusActive"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5" /> Completed</Badge>;
    default: return <Badge variant="outline">{status}</Badge>;
  }
};

export function PremiumClinicPrototype() {
  const [searchQuery, setSearchQuery] = useState('');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerMode, setDrawerMode] = useState<'view' | 'edit'>('view');
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const openDrawer = (patient: Patient, mode: 'view' | 'edit') => {
    setSelectedPatient(patient);
    setDrawerMode(mode);
    setDrawerOpen(true);
  };

  const columns: ColumnDef<Patient>[] = [
    {
      accessorKey: "name",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Patient" />,
      cell: ({ row }) => (
        <PatientIdentity
          name={row.original.name}
          patientId={row.original.id}
          phone={row.original.phone}
          size="sm"
        />
      )
    },
    { accessorKey: "doctor", header: ({ column }) => <DataTableColumnHeader column={column} title="Assigned Doctor" />, cell: ({ row }) => <span className="font-medium text-muted-foreground">{row.original.doctor}</span> },
    { accessorKey: "lastVisit", header: ({ column }) => <DataTableColumnHeader column={column} title="Last Visit" />, cell: ({ row }) => <span className="text-muted-foreground">{row.original.lastVisit}</span> },
    { accessorKey: "status", header: "Status", cell: ({ row }) => getStatusBadge(row.original.status) },
    {
      id: "actions", header: "Actions",
      cell: ({ row }) => (
        <div className="flex items-center gap-1">
          <TooltipProvider><Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary" onClick={() => openDrawer(row.original, 'view')}><Eye className="h-4 w-4" /></Button></TooltipTrigger><TooltipContent>View</TooltipContent></Tooltip></TooltipProvider>
          <TooltipProvider><Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-blue-500" onClick={() => openDrawer(row.original, 'edit')}><Edit2 className="h-4 w-4" /></Button></TooltipTrigger><TooltipContent>Edit</TooltipContent></Tooltip></TooltipProvider>
          <TooltipProvider><Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10" onClick={() => { setSelectedPatient(row.original); setDeleteDialogOpen(true); }}><Trash2 className="h-4 w-4" /></Button></TooltipTrigger><TooltipContent>Delete</TooltipContent></Tooltip></TooltipProvider>
        </div>
      )
    },
  ];

  const filteredData = demoPatients.filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase()));

  return (
    <div className="flex h-[800px] border rounded-xl overflow-hidden bg-slate-50 shadow-sm relative text-slate-900">

      {/* SIDEBAR */}
      <aside className="w-64 bg-slate-900 text-slate-300 flex flex-col flex-shrink-0 relative z-20">
        <div className="h-16 flex items-center px-6 border-b border-slate-800">
          <div className="flex items-center gap-2 text-white">
            <div className="h-8 w-8 bg-primary rounded-md flex items-center justify-center font-bold">D</div>
            <span className="font-semibold text-lg tracking-tight">DentalCore</span>
          </div>
        </div>
        <div className="p-4 flex-1 space-y-1">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 px-2 mt-4">Reception</div>
          <button className="w-full flex items-center gap-3 px-3 py-2 rounded-md bg-primary/10 text-primary font-medium transition-colors">
            <Users className="h-4 w-4" /> Patients
          </button>
          <button className="w-full flex items-center gap-3 px-3 py-2 rounded-md hover:bg-slate-800 transition-colors">
            <Calendar className="h-4 w-4" /> Appointments
          </button>
          <button className="w-full flex items-center justify-between px-3 py-2 rounded-md hover:bg-slate-800 transition-colors">
            <div className="flex items-center gap-3"><Clock className="h-4 w-4" /> Queue</div>
            <span className="bg-slate-800 text-slate-300 text-xs px-1.5 py-0.5 rounded-full">4</span>
          </button>
        </div>
        <div className="p-4 border-t border-slate-800">
          <button className="w-full flex items-center gap-3 px-3 py-2 rounded-md hover:bg-slate-800 transition-colors">
            <Settings className="h-4 w-4" /> Settings
          </button>
        </div>
      </aside>

      {/* MAIN CONTENT WORKSPACE */}
      <div className="flex-1 flex flex-col min-w-0 bg-slate-50/50 relative z-10">

        {/* TOPBAR */}
        <header className="h-16 bg-white border-b px-6 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" className="md:hidden"><Menu className="h-5 w-5" /></Button>
            <div className="relative hidden sm:block w-64">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search system..." className="pl-8 bg-slate-50 border-none shadow-none h-9" />
            </div>
          </div>
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" className="text-slate-500 relative">
              <Bell className="h-5 w-5" />
              <span className="absolute top-1.5 right-2 h-2 w-2 bg-red-500 rounded-full ring-2 ring-white" />
            </Button>
            <div className="h-8 w-px bg-slate-200" />
            <div className="flex items-center gap-2 cursor-pointer hover:bg-slate-50 py-1 px-2 rounded-md transition-colors">
              <UserCircle className="h-8 w-8 text-slate-400" />
              <div className="hidden sm:block text-sm">
                <div className="font-medium leading-none mb-1 text-slate-700">Sarah Jenkins</div>
                <div className="text-xs text-slate-500 leading-none">Front Desk</div>
              </div>
              <ChevronDown className="h-4 w-4 text-slate-400" />
            </div>
          </div>
        </header>

        {/* PAGE CONTENT */}
        <main className="flex-1 overflow-auto p-6">
          <div className="max-w-6xl mx-auto space-y-6">

            {/* Page Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Patients</h1>
                <p className="text-sm text-slate-500 mt-1">Manage patient records and clinic history.</p>
              </div>
              <Button>Add New Patient</Button>
            </div>

            {/* List Surface */}
            <div className="bg-white border rounded-xl shadow-sm overflow-hidden flex flex-col">

              {/* Toolbar */}
              <div className="p-4 border-b flex flex-col xl:flex-row xl:items-center justify-between gap-4 bg-white">
                <div className="flex items-center gap-2">
                  <Input placeholder="Search patients..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-[250px] bg-slate-50 h-9" />
                  <Select defaultValue="all">
                    <SelectTrigger className="w-[120px] h-9 bg-slate-50"><SelectValue placeholder="Status" /></SelectTrigger>
                    <SelectContent><SelectItem value="all">All Statuses</SelectItem><SelectItem value="active">Active</SelectItem><SelectItem value="waiting">Waiting</SelectItem></SelectContent>
                  </Select>
                  <Button variant="outline" className="h-9"><Filter className="mr-2 h-4 w-4" />Filters</Button>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <Button variant="outline" size="sm" className="h-9 text-slate-600 font-medium"><FileText className="mr-2 h-4 w-4 text-red-500" />PDF</Button>
                  <Button variant="outline" size="sm" className="h-9 text-slate-600 font-medium"><FileSpreadsheet className="mr-2 h-4 w-4 text-green-600" />Excel</Button>
                  <Button variant="outline" size="sm" className="h-9 text-slate-600 font-medium"><Printer className="mr-2 h-4 w-4" />Print</Button>
                </div>
              </div>

              {/* Table */}
              <DataTable columns={columns} data={filteredData} selectable={true} />
            </div>
          </div>
        </main>
      </div>

      {/* PREMIUM DRAWER IMPLEMENTATION */}
      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetContent side="right" size="lg" className="sm:max-w-[500px] bg-white border-l shadow-2xl p-0 flex flex-col gap-0">

          {/* PROFILE HEADER (Massive upgrade from generic modal header) */}
          <SheetHeader className="bg-slate-50 border-b p-6 pb-8 space-y-0 text-left">
            <div className="flex justify-between items-start mb-6">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-widest">{drawerMode === 'view' ? 'Patient Profile' : 'Edit Profile'}</span>
            </div>
            {selectedPatient && (
              <PatientIdentity
                name={selectedPatient.name}
                patientId={selectedPatient.id}
                phone={selectedPatient.phone}
                size="lg"
              />
            )}
            {selectedPatient && (
              <div className="mt-4 pt-4 border-t flex items-center gap-4">
                {getStatusBadge(selectedPatient.status)}
              </div>
            )}
          </SheetHeader>

          {/* STRUCTURED CONTENT */}
          <SheetScrollArea className="p-0 space-y-0 bg-white">
            {selectedPatient && (
              <div className="p-6 space-y-8">

                {/* Section 1 */}
                <section>
                  <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-4">Basic Information</h3>
                  <div className="space-y-4">
                    {drawerMode === 'view' ? (
                      <div className="grid grid-cols-2 gap-y-4">
                        <div><div className="text-sm text-slate-500 mb-1">Full Name</div><div className="font-medium text-slate-900">{selectedPatient.name}</div></div>
                        <div><div className="text-sm text-slate-500 mb-1">Patient ID</div><div className="font-mono text-slate-900">{selectedPatient.id}</div></div>
                        <div><div className="text-sm text-slate-500 mb-1">Phone</div><div className="font-medium text-slate-900">{selectedPatient.phone}</div></div>
                        <div><div className="text-sm text-slate-500 mb-1">Age</div><div className="font-medium text-slate-900">{selectedPatient.age} Yrs</div></div>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-4">
                        <div className="col-span-2 space-y-2"><Label>Full Name</Label><Input defaultValue={selectedPatient.name} /></div>
                        <div className="space-y-2"><Label>Patient ID</Label><Input defaultValue={selectedPatient.id} disabled /></div>
                        <div className="space-y-2"><Label>Phone</Label><Input defaultValue={selectedPatient.phone} /></div>
                      </div>
                    )}
                  </div>
                </section>
                <hr className="border-slate-100" />

                {/* Section 2 */}
                <section>
                  <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-4">Clinical Information</h3>
                  <div className="space-y-4">
                    {drawerMode === 'view' ? (
                      <div className="grid grid-cols-2 gap-y-4">
                        <div><div className="text-sm text-slate-500 mb-1">Assigned Doctor</div><div className="font-medium text-slate-900">{selectedPatient.doctor}</div></div>
                        <div><div className="text-sm text-slate-500 mb-1">Last Visit</div><div className="font-medium text-slate-900">{selectedPatient.lastVisit}</div></div>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Assigned Doctor</Label>
                          <Select defaultValue={selectedPatient.doctor}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent><SelectItem value="Dr. Smith">Dr. Smith</SelectItem><SelectItem value="Dr. Adams">Dr. Adams</SelectItem><SelectItem value="Dr. Lee">Dr. Lee</SelectItem></SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>Status</Label>
                          <Select defaultValue={selectedPatient.status}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent><SelectItem value="Active">Active</SelectItem><SelectItem value="Waiting">Waiting</SelectItem><SelectItem value="Inactive">Inactive</SelectItem></SelectContent>
                          </Select>
                        </div>
                      </div>
                    )}
                  </div>
                </section>

              </div>
            )}
          </SheetScrollArea>

          {/* FOOTER ACTIONS */}
          <SheetFooter className="bg-slate-50 border-t p-4 px-6 flex-shrink-0">
            {drawerMode === 'view' ? (
              <Button onClick={() => setDrawerMode('edit')} className="w-full sm:w-auto">
                <Edit2 className="mr-2 h-4 w-4" /> Edit Patient Profile
              </Button>
            ) : (
              <div className="flex gap-2 w-full justify-end">
                <Button variant="outline" onClick={() => setDrawerMode('view')} className="w-full sm:w-auto">Cancel</Button>
                <Button onClick={() => setDrawerMode('view')} className="w-full sm:w-auto">Save Changes</Button>
              </div>
            )}
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Delete Patient</DialogTitle><DialogDescription>Are you sure you want to delete {selectedPatient?.name}?</DialogDescription></DialogHeader>
          <DialogFooter><DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose><Button variant="destructive" onClick={() => setDeleteDialogOpen(false)}>Delete</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
