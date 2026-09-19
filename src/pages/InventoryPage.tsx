import { useState, useEffect, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { toast } from 'react-hot-toast'
import { Package, Search, Eye, Edit2, Trash2, Plus, Power, RotateCcw } from 'lucide-react'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Badge } from '../components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select'
import { useAuth } from '../context/AuthContext'

import { DataTable } from '../components/data-table/data-table'
import { DataTableToolbar } from '../components/data-table/data-table-toolbar'
import { DataTableEmpty } from '../components/data-table/data-table'
import { DataTableColumnHeader } from '../components/data-table/data-table-column-header'
import { Sheet, SheetContent, SheetScrollArea } from '../components/ui/sheet'
import { Label } from '../components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '../components/ui/dialog'
import { DrawerSection, DrawerFooterActions, ReadOnlyField } from '../components/ui/drawer-patterns'
import { MedicineCategoryBadge } from '../components/prescription/prescription-components'
import type { ColumnDef, PaginationState } from "@tanstack/react-table"
import { cn } from '../lib/utils'
import { type Medicine } from '../lib/mock-data'
import { api } from '../lib/api'
import type { PaginationMeta, PaginatedResponse, MedicineCategory } from '../types/domain'

import { StockAdjustmentDialog } from '../components/inventory/StockAdjustmentDialog'
import { StockHistoryTable } from '../components/inventory/StockHistoryTable'
import { SuppliersTab } from '../components/inventory/SuppliersTab'
import { PurchaseOrdersTab } from '../components/inventory/PurchaseOrdersTab'
import { MedicineCategoriesTab } from '../components/inventory/MedicineCategoriesTab'

type InventoryItem = Medicine

export function InventoryPage() {
  const { currentUser } = useAuth()
  const [searchParams] = useSearchParams()
  const initialTab = (searchParams.get('tab') as 'items' | 'orders' | 'suppliers' | 'categories') || 'items'
  const preselectedMedicineId = searchParams.get('createForMedicine') || undefined

  const [activeTab, setActiveTab] = useState<'items' | 'orders' | 'suppliers' | 'categories'>(initialTab)

  useEffect(() => {
    const tabParam = searchParams.get('tab') as 'items' | 'orders' | 'suppliers' | 'categories'
    if (tabParam && ['items', 'orders', 'suppliers', 'categories'].includes(tabParam)) {
      setActiveTab(tabParam)
    }
  }, [searchParams])

  const [searchQuery, setSearchQuery] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [filterCategory] = useState('all')
  const [filterStatus, setFilterStatus] = useState('all-status')
  const [filterType, setFilterType] = useState<'all' | 'medicine' | 'material'>('all')

  // Dynamic database-backed categories
  const [dbCategories, setDbCategories] = useState<MedicineCategory[]>([])

  const [data, setData] = useState<InventoryItem[]>([])
  const [meta, setMeta] = useState<PaginationMeta & { stats?: any }>({ currentPage: 1, pageSize: 10, totalRecords: 0, totalPages: 0 })
  const [isLoading, setIsLoading] = useState(false)
  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: 10 })

  const [drawerOpen, setDrawerOpen] = useState(false)
  const [drawerMode, setDrawerMode] = useState<'view' | 'edit' | 'create'>('view')
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [adjustmentDialogOpen, setAdjustmentDialogOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  const [formData, setFormData] = useState({
    itemType: 'MEDICINE' as 'MEDICINE' | 'MATERIAL',
    name: '',
    genericName: '',
    categoryId: 'cat1',
    unit: '',
    stockWarningLevel: 10,
    unitPrice: 0,
    form: 'Tablet'
  })

  const isMaterialItem = (item: { form?: string; category?: { name?: string } } | null | undefined): boolean => {
    if (!item) return false
    const f = (item.form || '').toLowerCase()
    if (f.includes('material') || f.includes('equipment') || f.includes('consumable') || f.includes('instrument') || f.includes('disposable') || f.includes('tool')) {
      return true
    }
    const catName = (item.category?.name || '').toLowerCase()
    return catName.includes('material') || catName.includes('equipment') || catName.includes('consumable')
  }

  const handleItemTypeChange = (newType: 'MEDICINE' | 'MATERIAL') => {
    setFormData(prev => ({
      ...prev,
      itemType: newType,
      form: newType === 'MEDICINE' ? 'Tablet' : 'Dental Material',
      unit: (prev.unit === 'Tablets' || prev.unit === 'Units') ? '' : prev.unit
    }))
  }

  const fetchDbCategories = useCallback(async () => {
    try {
      const res = await api.get<MedicineCategory[] | { data: MedicineCategory[] }>('/api/medicine-categories')
      const list = Array.isArray(res) ? res : (res as any)?.data || []
      setDbCategories(list)
    } catch (err) {
      console.error('Failed to load medicine categories:', err)
    }
  }, [])

  useEffect(() => {
    fetchDbCategories()
  }, [fetchDbCategories])

  const openDrawer = (item: InventoryItem | null, mode: 'view' | 'edit' | 'create') => {
    setSelectedItem(item)
    setDrawerMode(mode)
    if (mode === 'create') {
      const firstActiveCat = dbCategories.find(c => c.status === 'Active')?.id || 'cat1'
      const initialType = filterType === 'material' ? 'MATERIAL' : 'MEDICINE'
      setFormData({
        itemType: initialType,
        name: '',
        genericName: '',
        categoryId: firstActiveCat,
        unit: '',
        stockWarningLevel: 10,
        unitPrice: 0,
        form: initialType === 'MATERIAL' ? 'Dental Material' : 'Tablet'
      })
    } else if (item) {
      const isMat = isMaterialItem(item)
      setFormData({
        itemType: isMat ? 'MATERIAL' : 'MEDICINE',
        name: item.name,
        genericName: item.genericName || '',
        categoryId: item.categoryId,
        unit: item.unit,
        stockWarningLevel: item.stockWarningLevel,
        unitPrice: item.unitPrice || 0,
        form: item.form || (isMat ? 'Dental Material' : 'Tablet')
      })
    }
    setDrawerOpen(true)
  }

  const handleSaveItem = async () => {
    if (!formData.name.trim() || !formData.categoryId || !formData.unit.trim()) {
      toast.error('Please fill out all mandatory fields.');
      return;
    }
    const payload = {
      name: formData.name.trim(),
      genericName: formData.genericName?.trim() || undefined,
      categoryId: formData.categoryId,
      unit: formData.unit.trim(),
      stockWarningLevel: Number(formData.stockWarningLevel) || 0,
      unitPrice: Number(formData.unitPrice) || 0,
      form: formData.form || (formData.itemType === 'MATERIAL' ? 'Dental Material' : 'Tablet')
    }
    try {
      if (drawerMode === 'create') {
        await api.post('/api/inventory', payload);
        toast.success(`${formData.itemType === 'MATERIAL' ? 'Material' : 'Medicine'} added successfully`);
      } else if (drawerMode === 'edit' && selectedItem) {
        await api.put(`/api/inventory/${selectedItem.id}`, payload);
        toast.success(`${formData.itemType === 'MATERIAL' ? 'Material' : 'Medicine'} updated successfully`);
      }
      setDrawerOpen(false);
      fetchInventory(pagination.pageIndex + 1, pagination.pageSize, debouncedSearch, filterCategory, filterStatus, filterType);
    } catch (e: any) {
      console.error(e);
      toast.error(e.response?.data?.error || e.message || 'Failed to save item');
    }
  }

  const handleDeleteItem = async () => {
    if (!selectedItem) return
    setIsDeleting(true)
    try {
      await api.delete(`/api/inventory/${selectedItem.id}`)
      toast.success(`${selectedItem.name} has been permanently deleted`)
      setDeleteDialogOpen(false)
      setSelectedItem(null)
      fetchInventory(pagination.pageIndex + 1, pagination.pageSize, debouncedSearch, filterCategory, filterStatus, filterType)
    } catch (e: any) {
      console.error(e)
      const errorMsg = e.response?.data?.error || e.message || 'Failed to delete item'
      toast.error(errorMsg)
    } finally {
      setIsDeleting(false)
    }
  }

  const handleDeactivateItem = async (item: InventoryItem) => {
    try {
      await api.patch(`/api/inventory/${item.id}/deactivate`)
      toast.success(`${item.name} has been deactivated`)
      fetchInventory(pagination.pageIndex + 1, pagination.pageSize, debouncedSearch, filterCategory, filterStatus, filterType)
    } catch (e: any) {
      console.error(e)
      toast.error(e.response?.data?.error || e.message || 'Failed to deactivate item')
    }
  }

  const handleReactivateItem = async (item: InventoryItem) => {
    try {
      await api.patch(`/api/inventory/${item.id}/reactivate`)
      toast.success(`${item.name} has been reactivated`)
      fetchInventory(pagination.pageIndex + 1, pagination.pageSize, debouncedSearch, filterCategory, filterStatus, filterType)
    } catch (e: any) {
      console.error(e)
      toast.error(e.response?.data?.error || e.message || 'Failed to reactivate item')
    }
  }

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery), 300)
    return () => clearTimeout(timer)
  }, [searchQuery])

  useEffect(() => {
    setPagination(prev => ({ ...prev, pageIndex: 0 }))
  }, [debouncedSearch, filterCategory, filterStatus, filterType])

  const fetchInventory = useCallback(async (page: number, limit: number, query: string, category: string, status: string, itemType: string) => {
    setIsLoading(true)
    try {
      const res = await api.get<PaginatedResponse<InventoryItem>>(`/api/inventory?page=${page}&limit=${limit}&search=${encodeURIComponent(query)}&category=${category}&status=${status}&type=${itemType}`)
      const payload = res as any
      if (payload.data && payload.meta) {
        setData(payload.data)
        setMeta(payload.meta)
      }
    } catch (e) {
      console.error(e)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchInventory(pagination.pageIndex + 1, pagination.pageSize, debouncedSearch, filterCategory, filterStatus, filterType)
  }, [pagination.pageIndex, pagination.pageSize, debouncedSearch, filterCategory, filterStatus, filterType, fetchInventory])

  const getStockStatus = (current: number, min: number) => {
    if (current === 0) return 'Out of Stock'
    if (current < min) return 'Low Stock'
    return 'In Stock'
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'In Stock': return <Badge variant="statusActive"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5" /> In Stock</Badge>
      case 'Low Stock': return <Badge variant="statusWaiting"><span className="w-1.5 h-1.5 rounded-full bg-amber-500 mr-1.5" /> Low Stock</Badge>
      case 'Out of Stock': return <Badge variant="statusCancelled"><span className="w-1.5 h-1.5 rounded-full bg-rose-500 mr-1.5" /> Out of Stock</Badge>
      default: return <Badge variant="outline">{status}</Badge>
    }
  }

  const columns: ColumnDef<InventoryItem>[] = [
    {
      accessorKey: "name",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Item / Material" />,
      cell: ({ row }) => {
        const isMat = isMaterialItem(row.original)
        return (
          <div className="flex flex-col min-w-0 py-0.5">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="font-semibold text-slate-900 text-sm leading-tight truncate">{row.original.name}</span>
              <span className={cn(
                "text-[10px] font-semibold px-1.5 py-0.5 rounded border inline-flex items-center gap-1",
                isMat
                  ? "bg-emerald-50 text-emerald-700 border-emerald-200/80"
                  : "bg-indigo-50 text-indigo-700 border-indigo-200/80"
              )}>
                <span>{isMat ? '📦' : '💊'}</span>
                {isMat ? 'Material' : 'Medicine'}
              </span>
            </div>
            {!isMat && row.original.genericName && (
              <span className="text-[11px] text-slate-400 truncate leading-tight mt-0.5">{row.original.genericName}</span>
            )}
          </div>
        )
      }
    },
    {
      accessorKey: "categoryId",
      header: "Category",
      cell: ({ row }) => (
        <MedicineCategoryBadge
          categoryId={row.original.categoryId}
          categoryName={row.original.category?.name || dbCategories.find(c => c.id === row.original.categoryId)?.name}
        />
      )
    },
    {
      accessorKey: "unit",
      header: "Unit",
      cell: ({ row }) => <span className="text-xs text-slate-500 whitespace-nowrap">{row.original.unit}</span>
    },
    {
      accessorKey: "unitPrice",
      header: "Price",
      cell: ({ row }) => (
        <span className="font-medium text-slate-700 font-mono text-xs whitespace-nowrap">
          ₹{(row.original.unitPrice || 0).toFixed(2)}
        </span>
      )
    },
    {
      id: "stock",
      header: "Stock Level",
      cell: ({ row }) => {
        const { currentStock, stockWarningLevel } = row.original
        return (
          <div className="flex items-baseline gap-1 whitespace-nowrap">
            <span className={cn("font-semibold text-xs", currentStock === 0 ? "text-rose-600" : currentStock < stockWarningLevel ? "text-amber-600" : "text-slate-800")}>
              {currentStock}
            </span>
            <span className="text-[11px] text-slate-400">/ min {stockWarningLevel}</span>
          </div>
        )
      }
    },
    {
      id: "status",
      header: "Status",
      cell: ({ row }) => {
        const isInactive = row.original.status === 'Inactive'
        if (isInactive) {
          return (
            <Badge variant="outline" className="bg-slate-100 text-slate-600 border-slate-300">
              <span className="w-1.5 h-1.5 rounded-full bg-slate-400 mr-1.5" /> Inactive
            </Badge>
          )
        }
        return getStatusBadge(getStockStatus(row.original.currentStock, row.original.stockWarningLevel))
      }
    },
    {
      id: "actions",
      header: () => <div className="text-right pr-1">Actions</div>,
      cell: ({ row }) => {
        const item = row.original
        const isHeadDoctor = currentUser?.role === 'Head Doctor'
        const canDeactivateReactivate = currentUser?.role === 'Head Doctor' || currentUser?.role === 'Duty Doctor'
        const isInactive = item.status === 'Inactive'

        // Dependency counts
        const depCount = (item._count?.prescriptionItems || 0) +
          (item._count?.dispensingItems || 0) +
          (item._count?.purchaseOrderItems || 0) +
          (item._count?.stockMovements || 0)

        // Delete button rules (Correction 4):
        // If currentStock > 0: Delete disabled ("Cannot delete while stock is available")
        // If currentStock = 0 but historical records exist: Delete disabled ("Historical records exist — deactivate instead")
        // If currentStock = 0 and no dependencies: Delete enabled
        let deleteDisabled = false
        let deleteTooltip = "Delete item"

        if (!isHeadDoctor) {
          deleteDisabled = true
          deleteTooltip = "Only Head Doctor can delete medicines"
        } else if (item.currentStock > 0) {
          deleteDisabled = true
          deleteTooltip = "Cannot delete while stock is available"
        } else if (depCount > 0) {
          deleteDisabled = true
          deleteTooltip = "Historical records exist — deactivate instead"
        }

        return (
          <div className="flex items-center justify-end gap-1">
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7 text-slate-700 hover:text-slate-950 hover:bg-slate-100 rounded-md"
              title="View item"
              onClick={() => openDrawer(item, 'view')}
            >
              <Eye className="h-3.5 w-3.5" />
            </Button>

            {/* Edit allowed for active medicine */}
            {!isInactive && (
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7 text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 rounded-md"
                title="Edit item"
                onClick={() => openDrawer(item, 'edit')}
              >
                <Edit2 className="h-3.5 w-3.5" />
              </Button>
            )}

            {/* Adjust stock allowed for active medicine */}
            {!isInactive && (
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 rounded-md"
                title="Adjust stock"
                onClick={() => { setSelectedItem(item); setAdjustmentDialogOpen(true); }}
              >
                <Plus className="h-3.5 w-3.5" />
              </Button>
            )}

            {/* Inactive medicine: Reactivate action */}
            {isInactive && canDeactivateReactivate && (
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 rounded-md"
                title="Reactivate medicine"
                onClick={() => handleReactivateItem(item)}
              >
                <RotateCcw className="h-3.5 w-3.5" />
              </Button>
            )}

            {/* Active medicine: Deactivate action */}
            {!isInactive && canDeactivateReactivate && (
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7 text-amber-600 hover:text-amber-700 hover:bg-amber-50 rounded-md"
                title="Deactivate medicine"
                onClick={() => handleDeactivateItem(item)}
              >
                <Power className="h-3.5 w-3.5" />
              </Button>
            )}

            {/* Delete button (Only for active medicines or when deletable) */}
            <Button
              size="icon"
              variant="ghost"
              disabled={deleteDisabled}
              className={cn(
                "h-7 w-7 rounded-md transition-colors",
                deleteDisabled
                  ? "text-slate-300 hover:bg-transparent cursor-not-allowed"
                  : "text-rose-500 hover:text-rose-600 hover:bg-rose-50"
              )}
              title={deleteTooltip}
              onClick={() => {
                if (!deleteDisabled) {
                  setSelectedItem(item);
                  setDeleteDialogOpen(true);
                }
              }}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        )
      }
    },
  ]

  return (
    <div className="space-y-6">

      {/* Header & KPI Summary */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-slate-900">Inventory</h1>
          <p className="text-sm text-slate-500 mt-1">Manage clinic medicines, dental materials, and stock levels.</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-6 border-b border-slate-200">
        <button
          onClick={() => setActiveTab('items')}
          className={`pb-3 font-semibold text-sm transition-colors ${activeTab === 'items' ? 'border-b-2 border-indigo-600 text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}
        >
          Items & Stock
        </button>
        <button
          onClick={() => setActiveTab('orders')}
          className={`pb-3 font-semibold text-sm transition-colors ${activeTab === 'orders' ? 'border-b-2 border-indigo-600 text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}
        >
          Purchase Orders
        </button>
        <button
          onClick={() => setActiveTab('suppliers')}
          className={`pb-3 font-semibold text-sm transition-colors ${activeTab === 'suppliers' ? 'border-b-2 border-indigo-600 text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}
        >
          Suppliers
        </button>
        <button
          onClick={() => setActiveTab('categories')}
          className={`pb-3 font-semibold text-sm transition-colors ${activeTab === 'categories' ? 'border-b-2 border-indigo-600 text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}
        >
          Categories
        </button>
      </div>

      {activeTab === 'orders' && <PurchaseOrdersTab initialMedicineId={preselectedMedicineId} />}
      {activeTab === 'suppliers' && <SuppliersTab />}

      {activeTab === 'items' && (
        <>
          <DataTableToolbar
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            searchPlaceholder="Search inventory..."
            actionSlot={
              <Button className="shadow-sm font-medium" onClick={() => openDrawer(null, 'create')}>
                <Package className="mr-2 h-4 w-4" /> Add Item
              </Button>
            }
            exportOptions={{
              pdf: true,
              excel: true,
              csv: true,
              onExport: (format) => {
                const query = new URLSearchParams({
                  format,
                  ...(searchQuery ? { search: searchQuery } : {}),
                  category: filterCategory,
                  status: filterStatus,
                  type: filterType
                }).toString();
                api.download(`/api/inventory/export?${query}`, `inventory_export.${format}`);
              }
            }}
            filterSlot={
              <>
                <Select value={filterType} onValueChange={(v: any) => setFilterType(v)}>
                  <SelectTrigger className="w-[145px] h-9 bg-slate-50/50 hover:bg-slate-50 transition-colors">
                    <SelectValue placeholder="All Types" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="medicine">💊 Medicines</SelectItem>
                    <SelectItem value="material">📦 Materials</SelectItem>
                  </SelectContent>
                </Select>
                {/* <Select value={filterCategory} onValueChange={setFilterCategory}>
                  <SelectTrigger className="w-[160px] h-9 bg-slate-50/50 hover:bg-slate-50 transition-colors"><SelectValue placeholder="Category" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    {dbCategories.map(cat => (
                      <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select> */}
                <Select value={filterStatus} onValueChange={setFilterStatus}>
                  <SelectTrigger className="w-[140px] h-9 bg-slate-50/50 hover:bg-slate-50 transition-colors"><SelectValue placeholder="Status" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all-status">All Statuses</SelectItem>
                    <SelectItem value="in-stock">In Stock</SelectItem>
                    <SelectItem value="low-stock">Low Stock</SelectItem>
                    <SelectItem value="out-of-stock">Out of Stock</SelectItem>
                  </SelectContent>
                </Select>
              </>
            }
          />

          {/* List Surface */}
          <div className="bg-white rounded-2xl border border-slate-100/60 shadow-[0_2px_12px_-4px_rgba(15,23,42,0.04)] overflow-hidden flex flex-col">

            <DataTable
              columns={columns}
              data={data}
              selectable={false}

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
                searchQuery !== '' ? (
                  <DataTableEmpty
                    icon={Search}
                    title="No items found"
                    description={`There are no inventory items matching "${searchQuery}".`}
                  />
                ) : (
                  <DataTableEmpty
                    icon={Package}
                    title="Inventory is empty"
                    description="Add items to track your clinic's stock."
                    action={<Button onClick={() => openDrawer(null, 'create')} className="shadow-sm">Add Item</Button>}
                  />
                )
              }
            />
          </div>
        </>
      )}

      {activeTab === 'categories' && (
        <MedicineCategoriesTab
          onCategoriesChanged={() => {
            fetchDbCategories();
            fetchInventory(pagination.pageIndex + 1, pagination.pageSize, debouncedSearch, filterCategory, filterStatus, filterType);
          }}
        />
      )}

      {/* DRAWER */}
      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetContent side="right" size="lg" className="sm:max-w-md bg-white border-l shadow-2xl p-0 flex flex-col gap-0 transition-transform duration-300">

          <div className="px-6 sm:px-8 py-6 border-b bg-slate-50/50 flex flex-col gap-2">
            <h2 className="text-xl font-semibold text-slate-900">
              {drawerMode === 'view' && (isMaterialItem(selectedItem) ? 'Material Details' : 'Medicine Details')}
              {drawerMode === 'edit' && (formData.itemType === 'MATERIAL' ? 'Edit Material' : 'Edit Medicine')}
              {drawerMode === 'create' && (formData.itemType === 'MATERIAL' ? 'Add Dental Material' : 'Add Medicine')}
            </h2>
          </div>

          <SheetScrollArea className="p-0 bg-white flex-1">
            <div className="px-6 sm:px-8 py-8 space-y-10">

              {(drawerMode === 'view' || drawerMode === 'edit' || drawerMode === 'create') && (
                <DrawerSection title="Basic Information">
                  {drawerMode === 'view' && selectedItem ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-6 gap-x-4">
                      <div className="sm:col-span-2 flex items-center gap-2">
                        <span className={cn(
                          "text-xs font-semibold px-2.5 py-1 rounded-full border flex items-center gap-1.5",
                          isMaterialItem(selectedItem)
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : "bg-indigo-50 text-indigo-700 border-indigo-200"
                        )}>
                          <span>{isMaterialItem(selectedItem) ? '📦' : '💊'}</span>
                          {isMaterialItem(selectedItem) ? 'Dental Material / Supply' : 'Medicine / Drug'}
                        </span>
                      </div>
                      <ReadOnlyField label={isMaterialItem(selectedItem) ? "Material Name" : "Item Name"} value={selectedItem.name} />
                      {!isMaterialItem(selectedItem) && (
                        <ReadOnlyField label="Generic Name" value={selectedItem.genericName || '—'} />
                      )}
                      <div className="space-y-1">
                        <Label className="text-[13px] text-slate-500 font-medium">Category</Label>
                        <div>
                          <MedicineCategoryBadge
                            categoryId={selectedItem.categoryId}
                            categoryName={selectedItem.category?.name || dbCategories.find(c => c.id === selectedItem.categoryId)?.name}
                          />
                        </div>
                      </div>
                      <ReadOnlyField label={isMaterialItem(selectedItem) ? "Material Type" : "Dosage Form"} value={selectedItem.form || (isMaterialItem(selectedItem) ? 'Dental Material' : 'Tablet')} />
                      <ReadOnlyField label={isMaterialItem(selectedItem) ? "Unit / Packaging" : "Strength / Unit"} value={selectedItem.unit} />
                      <ReadOnlyField label="Unit Price" value={`₹${(selectedItem.unitPrice || 0).toFixed(2)}`} />
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                      {/* Classification Toggle */}
                      <div className="sm:col-span-2 space-y-2">
                        <Label className="text-[12px] text-slate-500 font-semibold uppercase tracking-wider">Item Classification</Label>
                        <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100/90 rounded-xl border border-slate-200/80">
                          <button
                            type="button"
                            onClick={() => handleItemTypeChange('MEDICINE')}
                            className={cn(
                              "py-2 px-3 text-xs font-semibold rounded-lg flex items-center justify-center gap-2 transition-all cursor-pointer",
                              formData.itemType === 'MEDICINE'
                                ? "bg-white text-indigo-700 shadow-xs border border-indigo-100 font-bold"
                                : "text-slate-600 hover:text-slate-900"
                            )}
                          >
                            <span>💊</span> Medicine / Tablet
                          </button>
                          <button
                            type="button"
                            onClick={() => handleItemTypeChange('MATERIAL')}
                            className={cn(
                              "py-2 px-3 text-xs font-semibold rounded-lg flex items-center justify-center gap-2 transition-all cursor-pointer",
                              formData.itemType === 'MATERIAL'
                                ? "bg-white text-emerald-700 shadow-xs border border-emerald-100 font-bold"
                                : "text-slate-600 hover:text-slate-900"
                            )}
                          >
                            <span>📦</span> Material / Supply
                          </button>
                        </div>
                      </div>

                      <div className="sm:col-span-2 space-y-2.5">
                        <Label className="text-[13px] text-slate-600 font-medium">
                          {formData.itemType === 'MATERIAL' ? 'Material Name' : 'Item Name'} <span className="text-rose-500">*</span>
                        </Label>
                        <Input
                          value={formData.name}
                          onChange={e => setFormData({ ...formData, name: e.target.value })}
                          placeholder={formData.itemType === 'MATERIAL' ? "e.g. Composite Resin Syringe, Latex Gloves, Scaler Tips" : "e.g. Amoxicillin 500mg, Paracetamol 650"}
                          className="shadow-xs bg-white transition-all focus:ring-primary/20"
                        />
                      </div>

                      {formData.itemType === 'MEDICINE' && (
                        <div className="sm:col-span-2 space-y-2.5">
                          <Label className="text-[13px] text-slate-600 font-medium">Generic Name</Label>
                          <Input
                            value={formData.genericName}
                            onChange={e => setFormData({ ...formData, genericName: e.target.value })}
                            placeholder="e.g. Amoxicillin Trihydrate"
                            className="shadow-xs bg-white transition-all focus:ring-primary/20"
                          />
                        </div>
                      )}

                      <div className="space-y-2.5">
                        <Label className="text-[13px] text-slate-600 font-medium">Category <span className="text-rose-500">*</span></Label>
                        <Select value={formData.categoryId} onValueChange={v => setFormData({ ...formData, categoryId: v })}>
                          <SelectTrigger className="shadow-xs bg-white transition-all focus:ring-primary/20"><SelectValue placeholder="Select Category" /></SelectTrigger>
                          <SelectContent>
                            {dbCategories
                              .filter(cat => cat.status === 'Active' || cat.id === formData.categoryId)
                              .map(cat => (
                                <SelectItem key={cat.id} value={cat.id}>
                                  {cat.name} {cat.status === 'Inactive' ? '(Inactive)' : ''}
                                </SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2.5">
                        <Label className="text-[13px] text-slate-600 font-medium">
                          {formData.itemType === 'MATERIAL' ? 'Material Form / Type' : 'Dosage Form'} <span className="text-rose-500">*</span>
                        </Label>
                        <Select value={formData.form} onValueChange={v => setFormData({ ...formData, form: v })}>
                          <SelectTrigger className="shadow-xs bg-white transition-all focus:ring-primary/20"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {formData.itemType === 'MATERIAL'
                              ? ['Dental Material', 'Consumable', 'Instrument / Tool', 'Disposable', 'Equipment', 'Other'].map(f => (
                                <SelectItem key={f} value={f}>{f}</SelectItem>
                              ))
                              : ['Tablet', 'Capsule', 'Syrup', 'Injection', 'Ointment', 'Liquid', 'Mouthwash', 'Other'].map(f => (
                                <SelectItem key={f} value={f}>{f}</SelectItem>
                              ))
                            }
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2.5">
                        <Label className="text-[13px] text-slate-600 font-medium">
                          {formData.itemType === 'MATERIAL' ? 'Unit / Packaging' : 'Strength / Unit'} <span className="text-rose-500">*</span>
                        </Label>
                        <Input
                          value={formData.unit}
                          onChange={e => setFormData({ ...formData, unit: e.target.value })}
                          placeholder={formData.itemType === 'MATERIAL' ? "e.g. Box, Pcs, Syringe, Kit, Pack, Set" : "e.g. 500mg, 10ml, Tablets"}
                          className="shadow-xs bg-white transition-all focus:ring-primary/20"
                        />
                      </div>

                      <div className="space-y-2.5">
                        <Label className="text-[13px] text-slate-600 font-medium">Unit Price (₹) <span className="text-rose-500">*</span></Label>
                        <Input type="number" step="0.01" value={formData.unitPrice} onChange={e => setFormData({ ...formData, unitPrice: parseFloat(e.target.value) || 0 })} className="shadow-xs bg-white transition-all focus:ring-primary/20" />
                      </div>
                    </div>
                  )}
                </DrawerSection>
              )}

              {(drawerMode === 'view' || drawerMode === 'edit' || drawerMode === 'create') && (
                <DrawerSection title="Stock Overview">
                  {drawerMode === 'view' && selectedItem ? (
                    <div className="space-y-6">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-6 gap-x-4">
                        <ReadOnlyField label="Current Stock" value={String(selectedItem.currentStock)} />
                        <ReadOnlyField label="Minimum Level" value={String(selectedItem.stockWarningLevel)} />
                        <div className="space-y-1 sm:col-span-2">
                          <Label className="text-[13px] text-slate-500 font-medium">Status</Label>
                          <div>{getStatusBadge(getStockStatus(selectedItem.currentStock, selectedItem.stockWarningLevel))}</div>
                        </div>
                      </div>

                      <div className="pt-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setAdjustmentDialogOpen(true)}
                          className="w-full sm:w-auto font-medium text-emerald-700 bg-emerald-50/50 border-emerald-200 hover:bg-emerald-100/50 shadow-xs"
                        >
                          <Plus className="mr-1.5 h-3.5 w-3.5" /> Adjust Stock
                        </Button>
                      </div>

                      <div className="pt-4 border-t border-slate-100">
                        <h4 className="text-sm font-semibold text-slate-900 mb-3">Stock Movement History</h4>
                        <StockHistoryTable medicineId={selectedItem.id} />
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                      <div className="space-y-2.5">
                        <Label className="text-[13px] text-slate-600 font-medium">Current Stock</Label>
                        <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-800 font-semibold">
                          {drawerMode === 'create' ? '0' : String(selectedItem?.currentStock || 0)}
                        </div>
                      </div>
                      <div className="space-y-2.5">
                        <Label className="text-[13px] text-slate-600 font-medium">Minimum Stock Level</Label>
                        <Input type="number" value={formData.stockWarningLevel} onChange={e => setFormData({ ...formData, stockWarningLevel: parseInt(e.target.value) || 0 })} className="shadow-xs bg-white transition-all focus:ring-primary/20" />
                      </div>
                    </div>
                  )}
                </DrawerSection>
              )}

            </div>
          </SheetScrollArea>

          <DrawerFooterActions>
            {drawerMode === 'view' ? (
              <Button onClick={() => setDrawerMode('edit')} className="w-full sm:w-auto shadow-sm font-medium transition-all hover:shadow-md">
                <Edit2 className="mr-2 h-4 w-4" /> Edit Item
              </Button>
            ) : (
              <>
                <Button variant="outline" onClick={() => setDrawerOpen(false)} className="w-full sm:w-auto font-medium transition-all hover:bg-slate-50">Cancel</Button>
                <Button onClick={handleSaveItem} className="w-full sm:w-auto shadow-sm font-medium transition-all hover:shadow-md">{drawerMode === 'create' ? 'Add Item' : 'Save Changes'}</Button>
              </>
            )}
          </DrawerFooterActions>
        </SheetContent>
      </Sheet>

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader className="mb-4">
            <DialogTitle className="text-xl">Delete Item</DialogTitle>
            <DialogDescription className="pt-2 text-slate-500 leading-relaxed">
              Are you sure you want to delete <strong className="text-slate-700">{selectedItem?.name}</strong>? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <DialogClose asChild><Button variant="outline" className="font-medium" disabled={isDeleting}>Cancel</Button></DialogClose>
            <Button variant="destructive" className="font-medium shadow-sm" disabled={isDeleting} onClick={handleDeleteItem}>
              {isDeleting ? 'Deleting...' : 'Yes, delete item'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {selectedItem && (
        <StockAdjustmentDialog
          open={adjustmentDialogOpen}
          onOpenChange={setAdjustmentDialogOpen}
          medicine={selectedItem}
          onSuccess={() => {
            fetchInventory(pagination.pageIndex + 1, pagination.pageSize, debouncedSearch, filterCategory, filterStatus, filterType);
            setDrawerOpen(false);
          }}
        />
      )}
    </div>
  )
}

