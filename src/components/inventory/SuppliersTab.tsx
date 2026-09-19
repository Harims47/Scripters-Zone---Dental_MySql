import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '../../lib/api';
import { toast } from 'react-hot-toast';
import { Plus, Edit2, UserX, Search, Phone, Building2, PlusCircle, Layers, ChevronDown, X, Check } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Badge } from '../ui/badge';
import { Checkbox } from '../ui/checkbox';
import { Textarea } from '../ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Sheet, SheetContent, SheetScrollArea } from '../ui/sheet';
import { DrawerFooterActions } from '../ui/drawer-patterns';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '../ui/dialog';
import { DataTable } from '../data-table/data-table';
import { DataTableToolbar } from '../data-table/data-table-toolbar';
import { DataTableEmpty } from '../data-table/data-table';
import type { ColumnDef } from '@tanstack/react-table';
import type { Supplier, MedicineCategory } from '../../types/domain';

export function SuppliersTab() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');

  // Categories list for selector and filter
  const [categories, setCategories] = useState<MedicineCategory[]>([]);

  // Drawer state
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerMode, setDrawerMode] = useState<'create' | 'edit'>('create');
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);

  // Selected category IDs in drawer
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([]);
  const [categoryDropdownOpen, setCategoryDropdownOpen] = useState(false);
  const [categorySearch, setCategorySearch] = useState('');
  const categoryDropdownRef = useRef<HTMLDivElement>(null);

  // Quick Add Category Modal state
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [newCatDesc, setNewCatDesc] = useState('');
  const [isSavingCategory, setIsSavingCategory] = useState(false);

  // Deactivate confirmation modal
  const [deactivateTarget, setDeactivateTarget] = useState<Supplier | null>(null);
  const [isDeactivating, setIsDeactivating] = useState(false);

  // Form fields
  const [formData, setFormData] = useState({
    name: '',
    contactPerson: '',
    phone: '',
    email: '',
    address: ''
  });

  const fetchCategories = useCallback(async () => {
    try {
      const res = await api.get<MedicineCategory[]>('/api/medicine-categories?status=Active');
      setCategories(Array.isArray(res) ? res : (res as any).data || []);
    } catch (err) {
      console.error('Failed to load medicine categories:', err);
    }
  }, []);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  const fetchSuppliers = useCallback(async () => {
    setIsLoading(true);
    try {
      const query = new URLSearchParams();
      if (statusFilter && statusFilter !== 'all') query.set('status', statusFilter);
      if (categoryFilter && categoryFilter !== 'all') query.set('categoryId', categoryFilter);
      if (search) query.set('search', search);

      const res = await api.get<Supplier[]>(`/api/suppliers?${query.toString()}`);
      setSuppliers(Array.isArray(res) ? res : (res as any).data || []);
    } catch (err: any) {
      console.error('Failed to load suppliers:', err);
      toast.error(err.response?.data?.error || 'Failed to load suppliers');
    } finally {
      setIsLoading(false);
    }
  }, [search, statusFilter, categoryFilter]);

  useEffect(() => {
    fetchSuppliers();
  }, [fetchSuppliers]);

  // Close category dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (categoryDropdownRef.current && !categoryDropdownRef.current.contains(event.target as Node)) {
        setCategoryDropdownOpen(false);
      }
    };
    if (categoryDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [categoryDropdownOpen]);

  const openCreateDrawer = () => {
    setSelectedSupplier(null);
    setFormData({ name: '', contactPerson: '', phone: '', email: '', address: '' });
    setSelectedCategoryIds([]);
    setCategoryDropdownOpen(false);
    setCategorySearch('');
    setDrawerMode('create');
    setDrawerOpen(true);
  };

  const openEditDrawer = (s: Supplier) => {
    setSelectedSupplier(s);
    setFormData({
      name: s.name,
      contactPerson: s.contactPerson || '',
      phone: s.phone || '',
      email: s.email || '',
      address: s.address || ''
    });
    setSelectedCategoryIds(s.categories ? s.categories.map(c => c.id) : []);
    setCategoryDropdownOpen(false);
    setCategorySearch('');
    setDrawerMode('edit');
    setDrawerOpen(true);
  };

  const handleToggleCategory = (catId: string) => {
    setSelectedCategoryIds(prev =>
      prev.includes(catId) ? prev.filter(id => id !== catId) : [...prev, catId]
    );
  };

  const handleQuickAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newCatName.trim();
    if (!trimmed) {
      toast.error('Category name is required');
      return;
    }

    setIsSavingCategory(true);
    try {
      const created = await api.post<MedicineCategory>('/api/medicine-categories', {
        name: trimmed,
        description: newCatDesc.trim() || undefined
      });

      toast.success(`Category "${created.name}" created`);
      // Update local categories list
      setCategories(prev => [...prev.filter(c => c.id !== created.id), created]);
      // Auto-select the newly created category in the supplier drawer
      setSelectedCategoryIds(prev => Array.from(new Set([...prev, created.id])));

      // Reset & close Quick Add modal without closing supplier drawer
      setNewCatName('');
      setNewCatDesc('');
      setQuickAddOpen(false);
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to create category');
    } finally {
      setIsSavingCategory(false);
    }
  };

  const handleSaveSupplier = async () => {
    if (!formData.name.trim()) {
      toast.error('Supplier name is required');
      return;
    }

    const payload = {
      ...formData,
      medicineCategoryIds: selectedCategoryIds
    };

    try {
      if (drawerMode === 'create') {
        await api.post('/api/suppliers', payload);
        toast.success('Supplier created successfully');
      } else if (drawerMode === 'edit' && selectedSupplier) {
        await api.put(`/api/suppliers/${selectedSupplier.id}`, payload);
        toast.success('Supplier updated successfully');
      }
      setDrawerOpen(false);
      fetchSuppliers();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to save supplier');
    }
  };

  const handleConfirmDeactivate = async () => {
    if (!deactivateTarget) return;
    setIsDeactivating(true);
    try {
      await api.patch(`/api/suppliers/${deactivateTarget.id}/deactivate`);
      toast.success(`${deactivateTarget.name} marked as Inactive`);
      setDeactivateTarget(null);
      fetchSuppliers();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to deactivate supplier');
    } finally {
      setIsDeactivating(false);
    }
  };

  const columns: ColumnDef<Supplier>[] = [
    {
      accessorKey: 'name',
      header: 'Supplier',
      cell: ({ row }) => (
        <div className="flex items-center gap-2 max-w-[200px]">
          <Building2 className="w-4 h-4 text-slate-400 shrink-0" />
          <span className="font-semibold text-slate-900 truncate" title={row.original.name}>
            {row.original.name}
          </span>
        </div>
      )
    },
    {
      id: 'categories',
      header: 'Categories',
      cell: ({ row }) => {
        const cats = row.original.categories || [];
        if (cats.length === 0) {
          return <span className="text-slate-400 text-xs italic">None</span>;
        }
        return (
          <div className="flex flex-wrap gap-1 items-center max-w-[170px]">
            {cats.slice(0, 2).map(c => (
              <Badge key={c.id} variant="outline" className="bg-teal-50 text-teal-700 border-teal-200 text-[11px] py-0 px-1.5 font-medium">
                {c.name}
              </Badge>
            ))}
            {cats.length > 2 && (
              <Badge variant="outline" className="bg-slate-50 text-slate-600 border-slate-200 text-[10px] py-0 px-1">
                +{cats.length - 2}
              </Badge>
            )}
          </div>
        );
      }
    },
    {
      id: 'contact',
      header: 'Contact',
      cell: ({ row }) => {
        const person = row.original.contactPerson;
        const phone = row.original.phone;
        const email = row.original.email;
        if (!person && !phone && !email) {
          return <span className="text-slate-400 text-xs">—</span>;
        }
        return (
          <div className="text-xs space-y-0.5">
            {person && (
              <div className="font-medium text-slate-800 truncate max-w-[150px]" title={person}>
                {person}
              </div>
            )}
            <div className="flex items-center gap-2 text-[11px] text-slate-500 font-mono">
              {phone && (
                <span className="flex items-center gap-1" title={phone}>
                  <Phone className="w-3 h-3 text-slate-400" />
                  {phone}
                </span>
              )}
              {email && (
                <span className="text-slate-400 hover:text-slate-600 truncate max-w-[130px]" title={email}>
                  {email}
                </span>
              )}
            </div>
          </div>
        );
      }
    },
    {
      id: 'financials',
      header: () => <div className="text-right">Outstanding</div>,
      cell: ({ row }) => {
        const billed = row.original.financials?.totalBilled || 0;
        const balance = row.original.financials?.outstandingBalance || 0;
        return (
          <div className="text-right font-mono text-xs">
            <div className={`font-bold ${balance > 0 ? 'text-amber-700' : 'text-slate-700'}`}>
              ₹{balance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </div>
            {billed > 0 && (
              <div className="text-[10px] text-slate-400">
                Billed: ₹{billed.toLocaleString()}
              </div>
            )}
          </div>
        );
      }
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => {
        const s = row.original.status;
        return s === 'Active' ? (
          <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">Active</Badge>
        ) : (
          <Badge className="bg-slate-100 text-slate-600 hover:bg-slate-100">Inactive</Badge>
        );
      }
    },
    {
      id: 'actions',
      header: () => <div className="text-right">Actions</div>,
      cell: ({ row }) => {
        const s = row.original;
        return (
          <div className="flex items-center justify-end gap-1.5">
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8 text-indigo-600 hover:bg-indigo-50"
              title="Edit Supplier"
              onClick={() => openEditDrawer(s)}
            >
              <Edit2 className="w-4 h-4" />
            </Button>
            {s.status === 'Active' && (
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8 text-amber-600 hover:bg-amber-50"
                title="Deactivate Supplier"
                onClick={() => setDeactivateTarget(s)}
              >
                <UserX className="w-4 h-4" />
              </Button>
            )}
          </div>
        );
      }
    }
  ];

  return (
    <div className="space-y-4">
      <DataTableToolbar
        searchQuery={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search suppliers..."
        actionSlot={
          <Button onClick={openCreateDrawer} className="bg-teal-600 hover:bg-teal-700 shadow-sm text-white font-medium text-xs h-9">
            <Plus className="w-4 h-4 mr-1.5" /> Add Supplier
          </Button>
        }
        exportOptions={{
          pdf: true,
          excel: true,
          csv: true,
          onExport: (format) => {
            const query = new URLSearchParams({
              format,
              ...(search ? { search } : {}),
              ...(statusFilter && statusFilter !== 'all' ? { status: statusFilter } : {}),
              ...(categoryFilter && categoryFilter !== 'all' ? { categoryId: categoryFilter } : {})
            }).toString();
            api.download(`/api/suppliers/export?${query}`, `suppliers_export.${format === 'xlsx' ? 'xlsx' : format}`);
          }
        }}
        filterSlot={
          <div className="flex flex-wrap items-center gap-2">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[130px] h-9 bg-slate-50/50 text-xs font-medium">
                <SelectValue placeholder="All Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="Active">Active</SelectItem>
                <SelectItem value="Inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>

            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-[160px] h-9 bg-slate-50/50 text-xs font-medium">
                <SelectValue placeholder="All Categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {categories.map(c => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        }
      />

      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <DataTable
          columns={columns}
          data={suppliers}
          loading={isLoading}
          emptyState={
            <DataTableEmpty
              icon={Building2}
              title="No suppliers found"
              description="Add medicine suppliers to start creating Purchase Orders."
              action={
                <Button onClick={openCreateDrawer} size="sm" className="mt-2">
                  <Plus className="w-4 h-4 mr-1.5" /> Add Supplier
                </Button>
              }
            />
          }
        />
      </div>

      {/* Supplier Drawer */}
      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetContent side="right" size="lg" className="sm:max-w-md bg-white border-l shadow-2xl p-0 flex flex-col">
          <div className="px-6 py-5 border-b bg-slate-50/60">
            <h3 className="text-lg font-bold text-slate-900">
              {drawerMode === 'create' ? 'Add New Supplier' : 'Edit Supplier'}
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {drawerMode === 'create' ? 'Register a wholesale vendor for purchase orders.' : 'Update supplier contact and category information.'}
            </p>
          </div>

          <SheetScrollArea className="p-6 flex-1">
            <div className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="sup-name" className="text-xs font-semibold text-slate-600 uppercase">
                  Supplier Name <span className="text-rose-500">*</span>
                </Label>
                <Input
                  id="sup-name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. Apollo Pharma Distributors"
                  className="h-10 text-sm"
                  required
                />
              </div>

              {/* Medicine Categories Supplied Section - Multi-select Dropdown */}
              <div className="space-y-2 pt-2 border-t border-slate-100" ref={categoryDropdownRef}>
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold text-slate-700 uppercase flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-teal-600" />
                    Medicine Categories Supplied
                  </Label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setQuickAddOpen(true)}
                    className="text-teal-600 hover:text-teal-700 hover:bg-teal-50 h-7 text-xs px-2 font-medium"
                  >
                    <PlusCircle className="w-3.5 h-3.5 mr-1" /> Quick Add Category
                  </Button>
                </div>

                <p className="text-[11px] text-slate-400">
                  Select which types of medicines or supplies this vendor provides.
                </p>

                {/* Multiselect Dropdown Control */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setCategoryDropdownOpen(!categoryDropdownOpen)}
                    className={`w-full min-h-[42px] px-3 py-2 text-left bg-white border rounded-xl flex items-center justify-between gap-2 text-sm transition-all focus:outline-none focus:ring-2 focus:ring-teal-500/20 ${
                      categoryDropdownOpen
                        ? 'border-teal-500 ring-2 ring-teal-500/20 shadow-xs'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex flex-wrap items-center gap-1.5 flex-1 min-w-0">
                      {selectedCategoryIds.length === 0 ? (
                        <span className="text-slate-400 text-sm">Select medicine categories...</span>
                      ) : (
                        selectedCategoryIds.map((id) => {
                          const cat = categories.find((c) => c.id === id);
                          if (!cat) return null;
                          return (
                            <span
                              key={cat.id}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-teal-50 text-teal-700 text-xs font-medium border border-teal-200/60"
                            >
                              {cat.name}
                              <span
                                role="button"
                                tabIndex={0}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleToggleCategory(cat.id);
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter' || e.key === ' ') {
                                    e.stopPropagation();
                                    handleToggleCategory(cat.id);
                                  }
                                }}
                                className="hover:text-teal-900 rounded p-0.5 transition-colors cursor-pointer"
                              >
                                <X className="w-3 h-3" />
                              </span>
                            </span>
                          );
                        })
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0 text-slate-400">
                      {selectedCategoryIds.length > 0 && (
                        <span className="text-[11px] font-semibold text-teal-600 bg-teal-50 px-1.5 py-0.5 rounded-full">
                          {selectedCategoryIds.length}
                        </span>
                      )}
                      <ChevronDown
                        className={`w-4 h-4 transition-transform duration-200 ${
                          categoryDropdownOpen ? 'transform rotate-180 text-teal-600' : ''
                        }`}
                      />
                    </div>
                  </button>

                  {/* Dropdown Menu Popover */}
                  {categoryDropdownOpen && (
                    <div className="absolute z-50 left-0 right-0 mt-1.5 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden animate-in fade-in-0 zoom-in-95">
                      {/* Search & Actions Bar */}
                      <div className="p-2 border-b border-slate-100 bg-slate-50/70 space-y-2">
                        <div className="relative">
                          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                          <input
                            type="text"
                            placeholder="Filter categories..."
                            value={categorySearch}
                            onChange={(e) => setCategorySearch(e.target.value)}
                            onClick={(e) => e.stopPropagation()}
                            className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500 placeholder:text-slate-400"
                          />
                        </div>

                        <div className="flex items-center justify-between text-[11px] px-1 text-slate-500">
                          <span>
                            {selectedCategoryIds.length} of {categories.length} selected
                          </span>
                          <div className="flex items-center gap-2">
                            {categories.length > 0 && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const allIds = categories.map((c) => c.id);
                                  setSelectedCategoryIds(allIds);
                                }}
                                className="text-teal-600 hover:text-teal-700 font-medium hover:underline"
                              >
                                Select all
                              </button>
                            )}
                            {selectedCategoryIds.length > 0 && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedCategoryIds([]);
                                }}
                                className="text-slate-500 hover:text-rose-600 font-medium hover:underline"
                              >
                                Clear
                              </button>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Categories List */}
                      <div className="max-h-56 overflow-y-auto p-1.5 space-y-1">
                        {categories.length === 0 ? (
                          <div className="p-4 text-center">
                            <p className="text-xs text-slate-500">No active categories found.</p>
                            <button
                              type="button"
                              onClick={() => {
                                setCategoryDropdownOpen(false);
                                setQuickAddOpen(true);
                              }}
                              className="text-teal-600 text-xs font-semibold hover:underline mt-1 inline-block"
                            >
                              + Quick Add Category
                            </button>
                          </div>
                        ) : (
                          (() => {
                            const filtered = categories.filter((c) =>
                              c.name.toLowerCase().includes(categorySearch.toLowerCase())
                            );

                            if (filtered.length === 0) {
                              return (
                                <div className="p-4 text-center">
                                  <p className="text-xs text-slate-400">
                                    No category matching "{categorySearch}"
                                  </p>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setNewCatName(categorySearch);
                                      setCategoryDropdownOpen(false);
                                      setQuickAddOpen(true);
                                    }}
                                    className="text-teal-600 text-xs font-semibold hover:underline mt-1.5 inline-flex items-center gap-1"
                                  >
                                    <Plus className="w-3 h-3" /> Add "{categorySearch}"
                                  </button>
                                </div>
                              );
                            }

                            return filtered.map((cat) => {
                              const isChecked = selectedCategoryIds.includes(cat.id);
                              return (
                                <div
                                  key={cat.id}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleToggleCategory(cat.id);
                                  }}
                                  className={`flex items-center justify-between px-2.5 py-2 rounded-lg cursor-pointer text-xs transition-colors ${
                                    isChecked
                                      ? 'bg-teal-50 text-teal-900 font-medium'
                                      : 'hover:bg-slate-100 text-slate-700'
                                  }`}
                                >
                                  <div className="flex items-center gap-2.5">
                                    <Checkbox
                                      id={`popover-cat-${cat.id}`}
                                      checked={isChecked}
                                      onCheckedChange={() => handleToggleCategory(cat.id)}
                                      onClick={(e) => e.stopPropagation()}
                                    />
                                    <span>{cat.name}</span>
                                  </div>
                                  {isChecked && <Check className="w-3.5 h-3.5 text-teal-600 shrink-0" />}
                                </div>
                              );
                            });
                          })()
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-2 pt-2 border-t border-slate-100">
                <Label htmlFor="sup-contact" className="text-xs font-semibold text-slate-600 uppercase">
                  Contact Person
                </Label>
                <Input
                  id="sup-contact"
                  value={formData.contactPerson}
                  onChange={(e) => setFormData({ ...formData, contactPerson: e.target.value })}
                  placeholder="e.g. Mr. Rajesh Kumar"
                  className="h-10 text-sm"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="sup-phone" className="text-xs font-semibold text-slate-600 uppercase">
                    Phone Number
                  </Label>
                  <Input
                    id="sup-phone"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="e.g. 9876543210"
                    className="h-10 text-sm font-mono"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="sup-email" className="text-xs font-semibold text-slate-600 uppercase">
                    Email Address
                  </Label>
                  <Input
                    id="sup-email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="sales@supplier.com"
                    className="h-10 text-sm"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="sup-addr" className="text-xs font-semibold text-slate-600 uppercase">
                  Physical Address
                </Label>
                <Input
                  id="sup-addr"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  placeholder="Street, City, Postal Code"
                  className="h-10 text-sm"
                />
              </div>
            </div>
          </SheetScrollArea>

          <DrawerFooterActions>
            <Button variant="outline" onClick={() => setDrawerOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveSupplier} className="bg-teal-600 hover:bg-teal-700 text-white font-medium">
              {drawerMode === 'create' ? 'Save Supplier' : 'Update Supplier'}
            </Button>
          </DrawerFooterActions>
        </SheetContent>
      </Sheet>

      {/* Quick Add Medicine Category Modal */}
      <Dialog open={quickAddOpen} onOpenChange={setQuickAddOpen}>
        <DialogContent className="sm:max-w-[400px] bg-white rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Layers className="w-4 h-4 text-teal-600" /> Quick Add Medicine Category
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500 pt-1">
              Create a new category. It will be immediately selected for this supplier.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleQuickAddCategory} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label htmlFor="quick-cat-name" className="text-xs font-semibold text-slate-700 uppercase">
                Category Name <span className="text-rose-500">*</span>
              </Label>
              <Input
                id="quick-cat-name"
                value={newCatName}
                onChange={(e) => setNewCatName(e.target.value)}
                placeholder="e.g. Dental Materials, Anesthetics"
                className="h-9 text-xs"
                autoFocus
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="quick-cat-desc" className="text-xs font-semibold text-slate-700 uppercase">
                Description
              </Label>
              <Textarea
                id="quick-cat-desc"
                value={newCatDesc}
                onChange={(e) => setNewCatDesc(e.target.value)}
                placeholder="Optional description of this category..."
                className="text-xs resize-none"
                rows={2}
              />
            </div>

            <DialogFooter className="gap-2 sm:gap-0 pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setQuickAddOpen(false)}
                disabled={isSavingCategory}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={isSavingCategory || !newCatName.trim()}
                className="bg-teal-600 hover:bg-teal-700 text-white font-medium"
              >
                {isSavingCategory ? 'Saving...' : 'Save Category'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Deactivation Confirmation Modal */}
      <Dialog open={!!deactivateTarget} onOpenChange={(open) => !open && setDeactivateTarget(null)}>
        <DialogContent className="sm:max-w-[420px] bg-white rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-slate-900">Deactivate Supplier?</DialogTitle>
            <DialogDescription className="text-sm text-slate-500 pt-2 leading-relaxed">
              Are you sure you want to deactivate <strong className="text-slate-800">{deactivateTarget?.name}</strong>?
              <br /><br />
              Historical Purchase Orders and category associations will remain safely preserved. Inactive suppliers cannot be selected for new orders.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0 pt-3">
            <DialogClose asChild>
              <Button variant="outline" disabled={isDeactivating}>Cancel</Button>
            </DialogClose>
            <Button
              variant="destructive"
              onClick={handleConfirmDeactivate}
              disabled={isDeactivating}
              className="bg-amber-600 hover:bg-amber-700 text-white font-semibold"
            >
              {isDeactivating ? 'Deactivating...' : 'Yes, Deactivate'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
