import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select'
import { Input } from '../ui/input'
import { Calendar } from 'lucide-react'

export type DatePreset = 'today' | 'yesterday' | 'this_week' | 'this_month' | 'last_month' | 'this_year' | 'all_time' | 'custom'

export interface DateRangeState {
  preset: DatePreset
  startDate?: string
  endDate?: string
  customStart: string
  customEnd: string
}

interface ReportDateRangeProps {
  value: DateRangeState
  onChange: (state: DateRangeState) => void
}

export function computeDatesForPreset(preset: DatePreset, customStart: string, customEnd: string): { startDate?: string; endDate?: string } {
  if (preset === 'all_time') {
    return { startDate: undefined, endDate: undefined }
  }

  if (preset === 'custom') {
    if (customStart && customEnd) {
      const s = new Date(customStart)
      s.setHours(0, 0, 0, 0)
      const e = new Date(customEnd)
      e.setHours(23, 59, 59, 999)
      return { startDate: s.toISOString(), endDate: e.toISOString() }
    }
    return { startDate: undefined, endDate: undefined }
  }

  const now = new Date()
  const start = new Date(now)
  const end = new Date(now)

  switch (preset) {
    case 'today':
      start.setHours(0, 0, 0, 0)
      end.setHours(23, 59, 59, 999)
      break
    case 'yesterday':
      start.setDate(start.getDate() - 1)
      start.setHours(0, 0, 0, 0)
      end.setDate(end.getDate() - 1)
      end.setHours(23, 59, 59, 999)
      break
    case 'this_week':
      // Start of week (Sunday)
      start.setDate(start.getDate() - start.getDay())
      start.setHours(0, 0, 0, 0)
      end.setHours(23, 59, 59, 999)
      break
    case 'this_month':
      start.setDate(1)
      start.setHours(0, 0, 0, 0)
      end.setHours(23, 59, 59, 999)
      break
    case 'last_month':
      start.setMonth(start.getMonth() - 1)
      start.setDate(1)
      start.setHours(0, 0, 0, 0)
      end.setDate(0) // Last day of previous month
      end.setHours(23, 59, 59, 999)
      break
    case 'this_year':
      start.setMonth(0, 1)
      start.setHours(0, 0, 0, 0)
      end.setHours(23, 59, 59, 999)
      break
  }

  return { startDate: start.toISOString(), endDate: end.toISOString() }
}

export function ReportDateRange({ value, onChange }: ReportDateRangeProps) {
  const handlePresetChange = (newPreset: DatePreset) => {
    const dates = computeDatesForPreset(newPreset, value.customStart, value.customEnd)
    onChange({
      ...value,
      preset: newPreset,
      startDate: dates.startDate,
      endDate: dates.endDate
    })
  }

  const handleCustomStartChange = (startStr: string) => {
    // If customEnd exists and startStr > customEnd, adjust customEnd
    let endStr = value.customEnd
    if (endStr && startStr > endStr) {
      endStr = startStr
    }
    const dates = computeDatesForPreset('custom', startStr, endStr)
    onChange({
      ...value,
      preset: 'custom',
      customStart: startStr,
      customEnd: endStr,
      startDate: dates.startDate,
      endDate: dates.endDate
    })
  }

  const handleCustomEndChange = (endStr: string) => {
    let startStr = value.customStart
    if (startStr && endStr < startStr) {
      startStr = endStr
    }
    const dates = computeDatesForPreset('custom', startStr, endStr)
    onChange({
      ...value,
      preset: 'custom',
      customStart: startStr,
      customEnd: endStr,
      startDate: dates.startDate,
      endDate: dates.endDate
    })
  }

  return (
    <div className="flex flex-wrap items-center gap-2.5">
      <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 bg-slate-50 border border-slate-200 px-3 py-2 rounded-xl">
        <Calendar className="w-3.5 h-3.5 text-teal-600" />
        <span>Period:</span>
      </div>

      <Select value={value.preset} onValueChange={(val) => handlePresetChange(val as DatePreset)}>
        <SelectTrigger className="w-[150px] h-9 bg-white border-slate-200 text-xs font-medium rounded-xl">
          <SelectValue placeholder="Select Range" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="today">Today</SelectItem>
          <SelectItem value="yesterday">Yesterday</SelectItem>
          <SelectItem value="this_week">This Week</SelectItem>
          <SelectItem value="this_month">This Month</SelectItem>
          <SelectItem value="last_month">Last Month</SelectItem>
          <SelectItem value="this_year">This Year</SelectItem>
          <SelectItem value="all_time">All Time</SelectItem>
          <SelectItem value="custom">Custom Range...</SelectItem>
        </SelectContent>
      </Select>

      {value.preset === 'custom' && (
        <div className="flex items-center gap-1.5">
          <Input
            type="date"
            className="h-9 w-36 text-xs bg-white border-slate-200 rounded-xl"
            value={value.customStart}
            onChange={(e) => handleCustomStartChange(e.target.value)}
          />
          <span className="text-xs text-slate-400 font-bold px-0.5">to</span>
          <Input
            type="date"
            className="h-9 w-36 text-xs bg-white border-slate-200 rounded-xl"
            value={value.customEnd}
            min={value.customStart}
            onChange={(e) => handleCustomEndChange(e.target.value)}
          />
        </div>
      )}
    </div>
  )
}
