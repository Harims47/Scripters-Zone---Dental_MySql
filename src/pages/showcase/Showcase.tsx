import { useState } from 'react';
import { Filter, Eye, Edit2, Trash2, FileText, FileSpreadsheet, FileIcon, Printer, User, Phone, Calendar } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Badge } from '../../components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../../components/ui/tooltip';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { DataTable } from '../../components/data-table/data-table';
import { DataTableColumnHeader } from '../../components/data-table/data-table-column-header';
import { StandardListPage } from '../../components/data-table/standard-list-page';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetScrollArea, SheetFooter } from '../../components/ui/sheet';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '../../components/ui/dialog';
import type { ColumnDef } from "@tanstack/react-table"

// --- DEMO DATA ---
const demoPatients = Array.from({ length: 20 }).map((_, i) => ({
  id: `${i + 1}`,
  name: ["James Wilson", "Mary Smith", "Robert Johnson", "Patricia Williams", "John Brown", "Jennifer Jones", "Michael Garcia", "Linda Miller", "William Davis", "Elizabeth Rodriguez", "David Martinez", "Barbara Hernandez", "Richard Lopez", "Susan Gonzalez", "Joseph Wilson", "Jessica Anderson", "Thomas Thomas", "Sarah Taylor", "Charles Moore", "Karen Jackson"][i],
  phone: `+1 555-${String(Math.floor(Math.random() * 9000) + 1000)}`,
  doctor: ["Dr. Smith", "Dr. Adams", "Dr. Lee"][i % 3],
  lastVisit: `2026-08-${String((i % 28) + 1).padStart(2, '0')}`,
  status: i % 5 === 0 ? "Inactive" : "Active"
}));
type Patient = typeof demoPatients[0];

export default function Showcase() {
  const [theme, setTheme] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  
  // --- DRAWER & DIALOG STATE ---
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerMode, setDrawerMode] = useState<'view' | 'edit' | 'create'>('view');
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  // --- ACTIONS ---
  const openViewDrawer = (patient: Patient) => {
    setSelectedPatient(patient);
    setDrawerMode('view');
    setDrawerOpen(true);
  };
  const openEditDrawer = (patient: Patient) => {
    setSelectedPatient(patient);
    setDrawerMode('edit');
    setDrawerOpen(true);
  };
  const openCreateDrawer = () => {
    setSelectedPatient(null);
    setDrawerMode('create');
    setDrawerOpen(true);
  };
  const openDeleteDialog = (patient: Patient) => {
    setSelectedPatient(patient);
    setDeleteDialogOpen(true);
  };

  // --- COLUMNS ---
  const patientColumns: ColumnDef<Patient>[] = [
    { accessorKey: "name", header: ({ column }) => <DataTableColumnHeader column={column} title="Patient Name" /> },
    { accessorKey: "phone", header: "Phone" },
    { accessorKey: "doctor", header: ({ column }) => <DataTableColumnHeader column={column} title="Assigned Doctor" /> },
    { accessorKey: "lastVisit", header: ({ column }) => <DataTableColumnHeader column={column} title="Last Visit" /> },
    {
      accessorKey: "status", header: "Status",
      cell: ({ row }) => <Badge variant={row.original.status === 'Active' ? 'statusActive' : 'secondary'}>{row.original.status}</Badge>,
    },
    {
      id: "actions", header: "Actions",
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary" onClick={() => openViewDrawer(row.original)}>
                  <Eye className="h-4 w-4" />
                  <span className="sr-only">View</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>View Patient</TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-blue-500" onClick={() => openEditDrawer(row.original)}>
                  <Edit2 className="h-4 w-4" />
                  <span className="sr-only">Edit</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>Edit Patient</TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10" onClick={() => openDeleteDialog(row.original)}>
                  <Trash2 className="h-4 w-4" />
                  <span className="sr-only">Delete</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>Delete Patient</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      )
    },
  ];

  const filteredData = demoPatients.filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase()));

  return (
    <div className="min-h-screen bg-background text-foreground p-4 sm:p-8">
      <div className="max-w-7xl mx-auto space-y-16">
        
        {/* Header */}
        <div>
          <h1 className="text-4xl font-bold tracking-tight mb-2">UI Showcase</h1>
          <p className="text-muted-foreground text-lg">Standard List Page & Drawer Workflow validation.</p>
        </div>

        {/* Theme Selector */}
        <section className="space-y-4 hidden sm:block">
          <h2 className="text-2xl font-semibold border-b pb-2">Themes</h2>
          <div className="flex gap-4">
            <Button variant={theme === '' ? 'default' : 'outline'} onClick={() => { setTheme(''); document.body.className = ''; }}>Theme 1: Medical Teal</Button>
            <Button variant={theme === 'theme-blue' ? 'default' : 'outline'} onClick={() => { setTheme('theme-blue'); document.body.className = 'theme-blue'; }}>Theme 2: Trust Navy</Button>
            <Button variant={theme === 'theme-emerald' ? 'default' : 'outline'} onClick={() => { setTheme('theme-emerald'); document.body.className = 'theme-emerald'; }}>Theme 3: Emerald</Button>
          </div>
        </section>

        {/* Application Shell & Dashboard Demonstration */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold border-b pb-2 text-primary">★ Dashboard Pattern & App Shell</h2>
          <p className="text-muted-foreground mb-4">
            The Dashboard Pattern and foundational Application Shell are now live! This establishes the responsive command center for clinic operations (Queue, Appointments, Doctor Status, etc.).
          </p>
          <div className="pt-2 p-6 border rounded-xl bg-slate-50 flex flex-col items-center justify-center text-center space-y-4">
            <div className="h-12 w-12 bg-primary/10 rounded-full flex items-center justify-center">
              <span className="font-bold text-primary text-xl">D</span>
            </div>
            <div>
              <h3 className="font-medium text-lg text-slate-900">Live Application View</h3>
              <p className="text-sm text-slate-500 max-w-md mx-auto mt-1">
                The Dashboard Pattern and AppShell are active on the main routes. Click below to view the operational dashboard.
              </p>
            </div>
            <div className="flex flex-wrap justify-center gap-4 pt-2">
              <a href="/dashboard">
                <Button>View Clinic Dashboard</Button>
              </a>
              <a href="/queue">
                <Button variant="default" className="bg-indigo-600 hover:bg-indigo-700">View Clinic Queue</Button>
              </a>
              <a href="/doctor/patient/PT-0001">
                <Button variant="default" className="bg-blue-600 hover:bg-blue-700">View Doctor Workspace</Button>
              </a>
              <a href="/prescriptions">
                <Button variant="default" className="bg-emerald-600 hover:bg-emerald-700">View Prescription UX</Button>
              </a>
              <a href="/reception/dispensing">
                <Button variant="default" className="bg-violet-600 hover:bg-violet-700">View Reception Dispensing</Button>
              </a>
              <a href="/payments">
                <Button variant="default" className="bg-rose-600 hover:bg-rose-700">View Payment Settlement</Button>
              </a>
              <a href="/appointments">
                <Button variant="default" className="bg-teal-600 hover:bg-teal-700">View Appointments / Doctor</Button>
              </a>
              <a href="/staff">
                <Button variant="default" className="bg-slate-800 hover:bg-slate-900">View Staff & Roles</Button>
              </a>
              <a href="/inventory">
                <Button variant="default" className="bg-amber-600 hover:bg-amber-700">View Inventory Pattern</Button>
              </a>
              <a href="/patients">
                <Button variant="outline">View Patients Workspace</Button>
              </a>
              <a href="/settings">
                <Button variant="default" className="bg-slate-600 hover:bg-slate-700">View Settings</Button>
              </a>
            </div>
          </div>
        </section>

        {/* Drawer Patterns Demo Buttons */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold border-b pb-2">Drawer Patterns (Direct Triggers)</h2>
          <div className="flex flex-wrap gap-3">
            <Button variant="outline" onClick={() => openViewDrawer(demoPatients[0])}>Demo View Drawer</Button>
            <Button variant="outline" onClick={() => openEditDrawer(demoPatients[0])}>Demo Edit Drawer</Button>
            <Button variant="default" onClick={openCreateDrawer}>Demo Create Drawer</Button>
          </div>
        </section>

        {/* Standard List Page Pattern */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold border-b pb-2 text-primary">★ Standard List Page Integration</h2>
          
          <div className="border rounded-xl p-4 sm:p-6 bg-background shadow-sm mt-8 overflow-hidden">
            <StandardListPage
              title="Patients"
              description="Manage and view clinic patients without leaving this page."
              primaryAction={<Button onClick={openCreateDrawer}>Add Patient</Button>}
              toolbar={
                <div className="flex flex-col xl:flex-row xl:items-center justify-between w-full gap-4">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
                    <Input placeholder="Search patients..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full sm:w-[250px]" />
                    <div className="flex items-center gap-2 w-full sm:w-auto">
                      <Select defaultValue="all">
                        <SelectTrigger className="w-[120px]"><SelectValue placeholder="Status" /></SelectTrigger>
                        <SelectContent><SelectItem value="all">All Statuses</SelectItem><SelectItem value="active">Active</SelectItem><SelectItem value="inactive">Inactive</SelectItem></SelectContent>
                      </Select>
                      <Select defaultValue="all-docs">
                        <SelectTrigger className="w-[140px]"><SelectValue placeholder="Doctor" /></SelectTrigger>
                        <SelectContent><SelectItem value="all-docs">All Doctors</SelectItem><SelectItem value="dr-smith">Dr. Smith</SelectItem></SelectContent>
                      </Select>
                      <Button variant="outline"><Filter className="mr-2 h-4 w-4" />More Filters</Button>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2 self-end xl:self-auto flex-wrap">
                    <Button variant="outline" className="flex items-center gap-2"><FileText className="h-4 w-4 text-red-500" /><span>PDF</span></Button>
                    <Button variant="outline" className="flex items-center gap-2"><FileSpreadsheet className="h-4 w-4 text-green-600" /><span>Excel</span></Button>
                    <Button variant="outline" className="flex items-center gap-2"><FileIcon className="h-4 w-4 text-slate-500" /><span>CSV</span></Button>
                    <div className="h-6 w-px bg-border mx-1 hidden sm:block"></div>
                    <Button variant="outline" className="flex items-center gap-2"><Printer className="h-4 w-4" /><span>Print</span></Button>
                  </div>
                </div>
              }
              dataTable={
                <div className="overflow-x-auto w-full">
                  <DataTable columns={patientColumns} data={filteredData} selectable={true} />
                </div>
              }
            />
          </div>
        </section>

      </div>

      {/* REUSABLE DRAWER SYSTEM */}
      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetContent side="right" size="lg">
          
          {/* HEADER */}
          <SheetHeader>
            <SheetTitle>
              {drawerMode === 'create' ? 'Add New Patient' : 
               drawerMode === 'edit' ? 'Edit Patient Profile' : 
               'Patient Details'}
            </SheetTitle>
            <SheetDescription>
              {drawerMode === 'view' ? 'Review patient information.' : 'Fill in the details below. Required fields are marked with an asterisk (*).'}
            </SheetDescription>
          </SheetHeader>

          {/* SCROLLABLE CONTENT */}
          <SheetScrollArea>
            {drawerMode === 'view' && selectedPatient ? (
              <div className="space-y-6">
                <div className="flex items-center gap-4 p-4 border rounded-lg bg-muted/30">
                  <div className="h-16 w-16 bg-primary/10 text-primary rounded-full flex items-center justify-center text-xl font-bold">
                    {selectedPatient.name.charAt(0)}
                  </div>
                  <div>
                    <h3 className="text-lg font-bold">{selectedPatient.name}</h3>
                    <p className="text-muted-foreground flex items-center mt-1"><Phone className="h-4 w-4 mr-2" /> {selectedPatient.phone}</p>
                  </div>
                </div>

                <div>
                  <h4 className="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wider">Clinical Context</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-3 border rounded-md">
                      <div className="text-xs text-muted-foreground mb-1 flex items-center"><User className="mr-1 h-3 w-3" /> Assigned Doctor</div>
                      <div className="font-medium">{selectedPatient.doctor}</div>
                    </div>
                    <div className="p-3 border rounded-md">
                      <div className="text-xs text-muted-foreground mb-1 flex items-center"><Calendar className="mr-1 h-3 w-3" /> Last Visit</div>
                      <div className="font-medium">{selectedPatient.lastVisit}</div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <form className="space-y-6">
                <div className="space-y-4">
                  <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider border-b pb-2">Basic Information</h4>
                  <div className="grid gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="name">Full Name *</Label>
                      <Input id="name" defaultValue={selectedPatient?.name} placeholder="e.g. Jane Doe" />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="phone">Phone Number *</Label>
                      <Input id="phone" defaultValue={selectedPatient?.phone} placeholder="+1 555-0000" />
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider border-b pb-2">Clinical Assignment</h4>
                  <div className="grid gap-4">
                    <div className="grid gap-2">
                      <Label>Primary Doctor</Label>
                      <Select defaultValue={selectedPatient?.doctor || "dr-smith"}>
                        <SelectTrigger><SelectValue placeholder="Select Doctor" /></SelectTrigger>
                        <SelectContent><SelectItem value="Dr. Smith">Dr. Smith</SelectItem><SelectItem value="Dr. Adams">Dr. Adams</SelectItem></SelectContent>
                      </Select>
                    </div>
                    <div className="grid gap-2">
                      <Label>Account Status</Label>
                      <Select defaultValue={selectedPatient?.status || "Active"}>
                        <SelectTrigger><SelectValue placeholder="Select Status" /></SelectTrigger>
                        <SelectContent><SelectItem value="Active">Active</SelectItem><SelectItem value="Inactive">Inactive</SelectItem></SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              </form>
            )}
          </SheetScrollArea>

          {/* FOOTER */}
          <SheetFooter>
            {drawerMode === 'view' ? (
              <Button onClick={() => setDrawerMode('edit')} className="w-full sm:w-auto">
                <Edit2 className="mr-2 h-4 w-4" /> Edit Patient
              </Button>
            ) : (
              <>
                <Button variant="outline" onClick={() => setDrawerOpen(false)} className="w-full sm:w-auto mt-2 sm:mt-0">Cancel</Button>
                <Button onClick={() => setDrawerOpen(false)} className="w-full sm:w-auto">
                  {drawerMode === 'create' ? 'Create Patient' : 'Save Changes'}
                </Button>
              </>
            )}
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* REUSABLE CONFIRMATION DIALOG */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Patient Record</DialogTitle>
            <DialogDescription>
              Are you absolutely sure you want to delete <strong>{selectedPatient?.name}</strong>? 
              This action cannot be undone and will permanently remove all associated data.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button variant="destructive" onClick={() => setDeleteDialogOpen(false)}>Yes, delete patient</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
