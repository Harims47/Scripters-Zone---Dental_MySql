import * as React from "react"
import type {
  ColumnDef,
  SortingState,
  ColumnFiltersState,
  VisibilityState,
  TableState,
} from "@tanstack/react-table"
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  getPaginationRowModel,
  getSortedRowModel,
  getFilteredRowModel,
} from "@tanstack/react-table"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../ui/table"
import { DataTablePagination } from "./data-table-pagination"
import { Search } from "lucide-react"

export function DataTableEmpty({ 
  icon: Icon = Search, 
  title = "No results found", 
  description = "Try adjusting your filters or search query.",
  action 
}: { 
  icon?: any, 
  title?: string, 
  description?: string,
  action?: React.ReactNode
}) {
  return (
    <div className="p-12 text-center flex flex-col items-center justify-center min-h-[300px]">
      <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4">
        <Icon className="w-8 h-8 text-slate-400" />
      </div>
      <h3 className="text-lg font-semibold text-slate-900 mb-1">{title}</h3>
      <p className="text-slate-500 max-w-sm mx-auto mb-6">{description}</p>
      {action}
    </div>
  )
}

export interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[]
  data: TData[]
  searchKey?: string
  searchPlaceholder?: string
  // External control props for future API integration
  manualPagination?: boolean
  pageCount?: number
  manualSorting?: boolean
  manualFiltering?: boolean
  state?: Partial<TableState>
  onStateChange?: (updater: any) => void
  selectable?: boolean
  loading?: boolean
  error?: Error | null
  emptyState?: React.ReactNode
  onRowClick?: (row: TData) => void
  totalRecords?: number
}

export function DataTable<TData, TValue>({
  columns,
  data,
  manualPagination = false,
  pageCount,
  manualSorting = false,
  manualFiltering = false,
  state: externalState,
  onStateChange,
  selectable = false,
  loading = false,
  error = null,
  emptyState,
  onRowClick,
  totalRecords,
}: DataTableProps<TData, TValue>) {
  // Internal state for demo/client-side mode
  const [sorting, setSorting] = React.useState<SortingState>([])
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([])
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({})
  const [rowSelection, setRowSelection] = React.useState({})
  const [pagination, setPagination] = React.useState({ pageIndex: 0, pageSize: 10 })

  // Inject checkbox column if selectable
  const finalColumns = React.useMemo(() => {
    if (!selectable) return columns;
    const selectColumn: ColumnDef<TData, any> = {
      id: "select",
      header: ({ table }) => (
        <div className="px-1">
          <input
            type="checkbox"
            className="translate-y-[2px] h-4 w-4 rounded-sm border border-primary focus:ring-2 focus:ring-ring focus:outline-none"
            checked={table.getIsAllPageRowsSelected()}
            onChange={(e) => table.toggleAllPageRowsSelected(!!e.target.checked)}
            aria-label="Select all"
          />
        </div>
      ),
      cell: ({ row }) => (
        <div className="px-1">
          <input
            type="checkbox"
            className="translate-y-[2px] h-4 w-4 rounded-sm border border-primary focus:ring-2 focus:ring-ring focus:outline-none"
            checked={row.getIsSelected()}
            onChange={(e) => row.toggleSelected(!!e.target.checked)}
            aria-label="Select row"
          />
        </div>
      ),
      enableSorting: false,
      enableHiding: false,
    };
    return [selectColumn, ...columns];
  }, [columns, selectable]);

  const table = useReactTable({
    data,
    columns: finalColumns,
    pageCount,
    manualPagination,
    manualSorting,
    manualFiltering,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      rowSelection,
      pagination,
      ...externalState,
    },
    onSortingChange: onStateChange || setSorting,
    onColumnFiltersChange: onStateChange || setColumnFilters,
    onColumnVisibilityChange: onStateChange || setColumnVisibility,
    onRowSelectionChange: onStateChange || setRowSelection,
    onPaginationChange: onStateChange || setPagination,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  })

  if (error) {
    return (
      <div className="rounded-md border border-destructive/50 bg-destructive/10 p-8 text-center text-destructive">
        <p className="font-medium">Error loading data</p>
        <p className="text-sm mt-1">{error.message}</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-100/60 bg-white shadow-[0_2px_12px_-4px_rgba(15,23,42,0.04)] overflow-hidden relative">
        {loading && (
          <div className="absolute inset-0 z-10 bg-background/50 flex items-center justify-center backdrop-blur-sm">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        )}
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header) => {
                    return (
                      <TableHead key={header.id}>
                        {header.isPlaceholder
                          ? null
                          : flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                      </TableHead>
                    )
                  })}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {table.getRowModel().rows?.length ? (
                table.getRowModel().rows.map((row) => (
                  <TableRow
                    key={row.id}
                    data-state={row.getIsSelected() && "selected"}
                    onClick={onRowClick ? () => onRowClick(row.original) : undefined}
                    className={onRowClick ? "cursor-pointer hover:bg-slate-50/80 transition-colors" : ""}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id}>
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext()
                        )}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell
                    colSpan={finalColumns.length}
                    className="h-32 p-0 text-center"
                  >
                    {emptyState || <DataTableEmpty />}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <DataTablePagination table={table} showSelection={selectable} totalRecords={totalRecords} />
    </div>
  )
}
