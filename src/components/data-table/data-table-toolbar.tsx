import * as React from "react"
import { Search, FileText, FileSpreadsheet, File } from "lucide-react"
import { Input } from "../ui/input"
import { Button } from "../ui/button"
import { cn } from "../../lib/utils"

interface DataTableToolbarProps extends React.HTMLAttributes<HTMLDivElement> {
  searchQuery: string
  onSearchChange: (value: string) => void
  searchPlaceholder?: string
  filterSlot?: React.ReactNode
  actionSlot?: React.ReactNode
  exportOptions?: {
    pdf?: boolean
    excel?: boolean
    csv?: boolean
    onExport?: (format: 'pdf' | 'xlsx' | 'csv') => void
  }
}

export function DataTableToolbar({
  searchQuery,
  onSearchChange,
  searchPlaceholder = "Search...",
  filterSlot,
  actionSlot,
  exportOptions,
  className,
  ...props
}: DataTableToolbarProps) {
  return (
    <div className={cn("p-4 sm:p-5 border-b border-slate-100 flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white", className)} {...props}>
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 flex-1">
        <div className="relative w-full sm:w-72 lg:w-80 shrink-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input 
            placeholder={searchPlaceholder}
            className="pl-9 bg-slate-50/50 hover:bg-slate-50 focus:bg-white transition-colors"
            value={searchQuery}
            onChange={e => onSearchChange(e.target.value)}
          />
        </div>
        {filterSlot && (
          <div className="flex items-center gap-2 flex-wrap">
            {filterSlot}
          </div>
        )}
      </div>
      {(actionSlot || exportOptions) && (
        <div className="flex items-center gap-2 flex-wrap shrink-0">
          {actionSlot}
          {exportOptions && (
            <div className="flex items-center gap-1.5 bg-slate-50/80 p-1 rounded-xl border border-slate-200/80">
              {exportOptions.pdf !== false && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => exportOptions.onExport?.('pdf')}
                  className="h-8 px-2.5 text-xs font-semibold text-rose-700 hover:text-rose-800 hover:bg-rose-50 rounded-lg transition-colors border border-transparent hover:border-rose-200"
                  title="Download PDF"
                >
                  <FileText className="mr-1.5 h-3.5 w-3.5 text-rose-500" />
                  PDF
                </Button>
              )}
              {exportOptions.excel !== false && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => exportOptions.onExport?.('xlsx')}
                  className="h-8 px-2.5 text-xs font-semibold text-emerald-700 hover:text-emerald-800 hover:bg-emerald-50 rounded-lg transition-colors border border-transparent hover:border-emerald-200"
                  title="Download Excel"
                >
                  <FileSpreadsheet className="mr-1.5 h-3.5 w-3.5 text-emerald-600" />
                  Excel
                </Button>
              )}
              {exportOptions.csv !== false && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => exportOptions.onExport?.('csv')}
                  className="h-8 px-2.5 text-xs font-semibold text-blue-700 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition-colors border border-transparent hover:border-blue-200"
                  title="Download CSV"
                >
                  <File className="mr-1.5 h-3.5 w-3.5 text-blue-600" />
                  CSV
                </Button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
