import { useState, useEffect, useCallback } from 'react';
import { api } from '../../lib/api';
import { toast } from 'react-hot-toast';
import { Plus, Edit2, Eye, Search, Tags, Ban, CheckCircle2, AlertTriangle } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Badge } from '../ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Sheet, SheetContent, SheetScrollArea } from '../ui/sheet';
import { DrawerSection, DrawerFooterActions, ReadOnlyField } from '../ui/drawer-patterns';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '../ui/dialog';
import { DataTable } from '../data-table/data-table';
import { DataTableToolbar } from '../data-table/data-table-toolbar';
import { DataTableEmpty } from '../data-table/data-table';
import { DataTableColumnHeader } from '../data-table/data-table-column-header';
import type { ColumnDef, PaginationState } from '@tanstack/react-table';
import type { MedicineCategory, PaginationMeta } from '../../types/domain';

interface MedicineCategoriesTabProps {
  onCategoriesChanged?: () => void;
}

export function MedicineCategoriesTab({ onCategoriesChanged }: MedicineCategoriesTabProps) {
  const [categories, setCategories] = useState<MedicineCategory[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: 10 });
  const [meta, setMeta] = useState<PaginationMeta>({ currentPage: 1, pageSize: 10, totalRecords: 0, totalPages: 0 });

  // Drawer state
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerMode, setDrawerMode] = useState<'create' | 'edit' | 'view'>('create');
  const [selectedCategory, setSelectedCategory] = useState<MedicineCategory | null>(null);

  // Deactivate confirmation modal
  const [deactivateTarget, setDeactivateTarget] = useState<MedicineCategory | null>(null);
  const [isDeactivating, setIsDeactivating] = useState(false);

  // Form fields
  const [formData, setFormData] = useState({
    name: '',
    description: ''
  });

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    setPagination(prev => ({ ...prev, pageIndex: 0 }));
  }, [debouncedSearch, statusFilter]);

  const fetchCategories = useCallback(async () => {
    setIsLoading(true);
    try {
      const page = pagination.pageIndex + 1;
      const limit = pagination.pageSize;
      const query = new URLSearchParams({
        page: String(page),
        limit: String(limit)
      });
      if (statusFilter && statusFilter !== 'all') query.set('status', statusFilter);
      if (debouncedSearch) query.set('search', debouncedSearch);

      const res = await api.get<{ data: MedicineCategory[]; meta: PaginationMeta }>(`/api/medicine-categories?${query.toString()}`);
      if (res && res.data && res.meta) {
        setCategories(res.data);
        setMeta(res.meta);
      } else if (Array.isArray(res)) {
        setCategories(res);
      }
    } catch (err: any) {
      console.error('Failed to load categories:', err);
      toast.error(err.response?.data?.error || 'Failed to load medicine categories');
    } finally {
      setIsLoading(false);
    }
  }, [debouncedSearch, statusFilter, pagination.pageIndex, pagination.pageSize]);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  const openCreateDrawer = () => {
    setSelectedCategory(null);
    setFormData({ name: '', description: '' });
    setDrawerMode('create');
    setDrawerOpen(true);
  };

  const openEditDrawer = (cat: MedicineCategory) => {
    setSelectedCategory(cat);
    setFormData({
      name: cat.name,
      description: cat.description || ''
    });
    setDrawerMode('edit');
    setDrawerOpen(true);
  };

  const openViewDrawer = (cat: MedicineCategory) => {
    setSelectedCategory(cat);
    setDrawerMode('view');
    setDrawerOpen(true);
  };

  const handleSaveCategory = async () => {
    const trimmedName = formData.name.trim();
    if (!trimmedName) {
      toast.error('Category name is required');
      return;
    }

    try {
      if (drawerMode === 'create') {
        await api.post('/api/medicine-categories', {
          name: trimmedName,
          description: formData.description.trim() || undefined
        });
        toast.success('Category created successfully');
      } else if (drawerMode === 'edit' && selectedCategory) {
        await api.put(`/api/medicine-categories/${selectedCategory.id}`, {
          name: trimmedName,
          description: formData.description.trim() || undefined
        });
        toast.success('Category updated successfully');
      }
      setDrawerOpen(false);
      fetchCategories();
      onCategoriesChanged?.();
    } catch (err: any) {
      console.error('Save category failed:', err);
      toast.error(err.response?.data?.error || 'Failed to save category');
    }
  };

  const handleDeactivate = async () => {
    if (!deactivateTarget) return;
    setIsDeactivating(true);
    try {
      const res: any = await api.patch(`/api/medicine-categories/${deactivateTarget.id}/deactivate`, {});
      toast.success(res.message || 'Category deactivated successfully');
      setDeactivateTarget(null);
      fetchCategories();
      onCategoriesChanged?.();
    } catch (err: any) {
      console.error('Deactivation failed:', err);
      toast.error(err.response?.data?.error || 'Failed to deactivate category');
    } finally {
      setIsDeactivating(false);
    }
  };

  const handleReactivate = async (cat: MedicineCategory) => {
    try {
      const res: any = await api.patch(`/api/medicine-categories/${cat.id}/reactivate`, {});
      toast.success(res.message || 'Category reactivated successfully');
      fetchCategories();
      onCategoriesChanged?.();
    } catch (err: any) {
      console.error('Reactivation failed:', err);
      toast.error(err.response?.data?.error || 'Failed to reactivate category');
    }
  };

  const columns: ColumnDef<MedicineCategory>[] = [
    {
      accessorKey: 'name',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Category Name" />,
      cell: ({ row }) => {
        const cat = row.original;
        const isActive = cat.status === 'Active';
        return (
          <div className="flex items-center gap-3">
            <div className={`w-2.5 h-2.5 rounded-full ${isActive ? 'bg-emerald-500' : 'bg-slate-300'}`} />
            <div className="font-semibold text-slate-900 text-sm">{cat.name}</div>
          </div>
        );
      }
    },
    {
      accessorKey: 'description',
      header: 'Description',
      cell: ({ row }) => (
        <span className="text-sm text-slate-600 line-clamp-1 max-w-sm">
          {row.original.description || <span className="text-slate-400">—</span>}
        </span>
      )
    },
    {
      accessorKey: 'medicines',
      header: 'Medicines',
      cell: ({ row }) => {
        const count = row.original._count?.medicines ?? 0;
        return (
          <Badge variant="outline" className="bg-slate-50 text-slate-700 border-slate-200 font-medium">
            {count} {count === 1 ? 'medicine' : 'medicines'}
          </Badge>
        );
      }
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => {
        const status = row.original.status;
        return status === 'Active' ? (
          <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 border hover:bg-emerald-100/60 font-medium text-xs shadow-none">
            Active
          </Badge>
        ) : (
          <Badge className="bg-slate-100 text-slate-600 border-slate-200 border hover:bg-slate-200/60 font-medium text-xs shadow-none">
            Inactive
          </Badge>
        );
      }
    },
    {
      id: 'actions',
      header: () => <div className="text-right">Actions</div>,
      cell: ({ row }) => {
        const cat = row.original;
        return (
          <div className="flex items-center justify-end gap-1.5">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => openViewDrawer(cat)}
              className="h-8 w-8 p-0 text-slate-700 hover:text-slate-950 hover:bg-slate-100 rounded-md"
              title="View Category"
            >
              <Eye className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => openEditDrawer(cat)}
              className="h-8 w-8 p-0 text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 rounded-md"
              title="Edit Category"
            >
              <Edit2 className="h-4 w-4" />
            </Button>
            {cat.status === 'Active' ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setDeactivateTarget(cat)}
                className="h-8 w-8 p-0 text-rose-500 hover:text-rose-600 hover:bg-rose-50 rounded-md"
                title="Deactivate Category"
              >
                <Ban className="h-4 w-4" />
              </Button>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleReactivate(cat)}
                className="h-8 w-8 p-0 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 rounded-md"
                title="Reactivate Category"
              >
                <CheckCircle2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        );
      }
    }
  ];

  return (
    <div className="space-y-6">
      {/* Category Toolbar */}
      <DataTableToolbar
        searchPlaceholder="Search categories by name or description..."
        searchQuery={search}
        onSearchChange={setSearch}
        filterSlot={
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[140px] h-9 bg-slate-50/50 hover:bg-slate-50 transition-colors">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="Active">Active</SelectItem>
              <SelectItem value="Inactive">Inactive</SelectItem>
            </SelectContent>
          </Select>
        }
        exportOptions={{
          pdf: true,
          excel: true,
          csv: true,
          onExport: (format) => {
            const query = new URLSearchParams({
              format,
              ...(search ? { search } : {}),
              status: statusFilter
            }).toString();
            api.download(`/api/medicine-categories/export?${query}`, `medicine_categories_export.${format}`);
          }
        }}
        actionSlot={
          <Button onClick={openCreateDrawer} className="shadow-sm font-medium">
            <Plus className="mr-2 h-4 w-4" /> Add Category
          </Button>
        }
      />

      {/* Table Container */}
      <div className="bg-white rounded-2xl border border-slate-100/60 shadow-[0_2px_12px_-4px_rgba(15,23,42,0.04)] overflow-hidden flex flex-col">
        <DataTable
          columns={columns}
          data={categories}
          loading={isLoading}
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
                title="No categories found"
                description={`There are no categories matching "${search}".`}
              />
            ) : (
              <DataTableEmpty
                icon={Tags}
                title="No categories registered"
                description="Create master medicine categories to classify clinical stock items."
                action={
                  <Button onClick={openCreateDrawer} className="shadow-sm">
                    <Plus className="mr-2 h-4 w-4" /> Add Category
                  </Button>
                }
              />
            )
          }
        />
      </div>

      {/* Add / Edit / View Category Drawer */}
      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetContent side="right" size="lg" className="sm:max-w-md bg-white border-l shadow-2xl p-0 flex flex-col gap-0 transition-transform duration-300">
          <div className="px-6 sm:px-8 py-6 border-b bg-slate-50/50 flex flex-col gap-1">
            <h2 className="text-xl font-semibold text-slate-900">
              {drawerMode === 'create' && 'Add Medicine Category'}
              {drawerMode === 'edit' && 'Edit Medicine Category'}
              {drawerMode === 'view' && 'Category Details'}
            </h2>
            <p className="text-xs text-slate-500">
              {drawerMode === 'create' && 'Create a new classification category for clinic medicines.'}
              {drawerMode === 'edit' && 'Update category information.'}
              {drawerMode === 'view' && 'View category details and medicine usage.'}
            </p>
          </div>

          <SheetScrollArea className="p-0 bg-white flex-1">
            <div className="px-6 sm:px-8 py-8 space-y-8">
              {drawerMode === 'view' && selectedCategory ? (
                <DrawerSection title="Category Information">
                  <div className="space-y-6">
                    <ReadOnlyField label="Category Name" value={selectedCategory.name} />
                    <ReadOnlyField label="Description" value={selectedCategory.description || '—'} />
                    <div className="space-y-1">
                      <Label className="text-[13px] text-slate-500 font-medium">Status</Label>
                      <div>
                        {selectedCategory.status === 'Active' ? (
                          <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 border">Active</Badge>
                        ) : (
                          <Badge className="bg-slate-100 text-slate-600 border-slate-200 border">Inactive</Badge>
                        )}
                      </div>
                    </div>
                    <ReadOnlyField label="Associated Medicines" value={`${selectedCategory._count?.medicines ?? 0} medicines assigned`} />
                    <ReadOnlyField
                      label="Created At"
                      value={new Date(selectedCategory.createdAt).toLocaleDateString(undefined, {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric'
                      })}
                    />
                  </div>
                </DrawerSection>
              ) : (
                <DrawerSection title="Category Information">
                  <div className="space-y-5">
                    <div className="space-y-2">
                      <Label className="text-[13px] text-slate-600 font-medium">
                        Category Name <span className="text-rose-500">*</span>
                      </Label>
                      <Input
                        value={formData.name}
                        onChange={e => setFormData({ ...formData, name: e.target.value })}
                        placeholder="e.g. Antibiotics, Analgesics, Consumables"
                        className="shadow-xs bg-white focus:ring-primary/20"
                      />
                      <p className="text-xs text-slate-400">Category names must be unique across the clinic.</p>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-[13px] text-slate-600 font-medium">
                        Description <span className="text-slate-400 font-normal">(Optional)</span>
                      </Label>
                      <textarea
                        rows={3}
                        value={formData.description}
                        onChange={e => setFormData({ ...formData, description: e.target.value })}
                        placeholder="Brief summary of what medicines belong in this category..."
                        className="w-full rounded-md border border-input bg-white px-3 py-2 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/20 disabled:cursor-not-allowed disabled:opacity-50"
                      />
                    </div>
                  </div>
                </DrawerSection>
              )}
            </div>
          </SheetScrollArea>

          <DrawerFooterActions>
            {drawerMode === 'view' ? (
              <>
                <Button variant="outline" onClick={() => setDrawerOpen(false)} className="w-full sm:w-auto font-medium">
                  Close
                </Button>
                {selectedCategory && (
                  <Button onClick={() => setDrawerMode('edit')} className="w-full sm:w-auto shadow-sm font-medium">
                    <Edit2 className="mr-2 h-4 w-4" /> Edit Category
                  </Button>
                )}
              </>
            ) : (
              <>
                <Button variant="outline" onClick={() => setDrawerOpen(false)} className="w-full sm:w-auto font-medium">
                  Cancel
                </Button>
                <Button onClick={handleSaveCategory} className="w-full sm:w-auto shadow-sm font-medium">
                  {drawerMode === 'create' ? 'Save Category' : 'Save Changes'}
                </Button>
              </>
            )}
          </DrawerFooterActions>
        </SheetContent>
      </Sheet>

      {/* Deactivate Confirmation Dialog */}
      <Dialog open={!!deactivateTarget} onOpenChange={open => !open && setDeactivateTarget(null)}>
        <DialogContent className="sm:max-w-[460px]">
          <DialogHeader className="mb-2">
            <div className="flex items-center gap-2 text-amber-600 mb-1">
              <AlertTriangle className="h-5 w-5" />
              <DialogTitle className="text-lg">Deactivate {deactivateTarget?.name}?</DialogTitle>
            </div>
            <DialogDescription className="pt-2 text-slate-600 leading-relaxed text-sm">
              {(deactivateTarget?._count?.medicines ?? 0) > 0 ? (
                <span>
                  This category is currently used by{' '}
                  <strong className="text-slate-900 font-semibold">{deactivateTarget?._count?.medicines}</strong>{' '}
                  {(deactivateTarget?._count?.medicines ?? 0) === 1 ? 'medicine' : 'medicines'}. Deactivating it will keep
                  existing medicines unchanged, but it will no longer be available for new medicine assignments.
                </span>
              ) : (
                <span>
                  Deactivating this category will make it unavailable for new medicine creation. You can reactivate it at any
                  time.
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0 mt-4">
            <DialogClose asChild>
              <Button variant="outline" className="font-medium" disabled={isDeactivating}>
                Cancel
              </Button>
            </DialogClose>
            <Button
              variant="destructive"
              className="font-medium shadow-sm"
              onClick={handleDeactivate}
              disabled={isDeactivating}
            >
              {isDeactivating ? 'Deactivating...' : 'Deactivate'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
