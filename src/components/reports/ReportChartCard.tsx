import React from 'react'
import type { LucideIcon } from 'lucide-react'
import { BarChart2 } from 'lucide-react'

interface ReportChartCardProps {
  title: string
  subtitle?: string
  icon?: LucideIcon
  children: React.ReactNode
  loading?: boolean
  empty?: boolean
  emptyMessage?: string
  actionSlot?: React.ReactNode
}

export function ReportChartCard({
  title,
  subtitle,
  icon: Icon = BarChart2,
  children,
  loading,
  empty,
  emptyMessage = "No data for the selected period",
  actionSlot
}: ReportChartCardProps) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-[0_2px_12px_-4px_rgba(15,23,42,0.04)] p-5 flex flex-col h-full">
      <div className="flex items-center justify-between gap-2 mb-4">
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-lg bg-teal-50 text-teal-600 flex items-center justify-center shrink-0">
            <Icon className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900 tracking-tight">{title}</h3>
            {subtitle && <p className="text-xs text-slate-500">{subtitle}</p>}
          </div>
        </div>
        {actionSlot}
      </div>

      <div className="flex-1 flex flex-col justify-center min-h-[200px]">
        {loading ? (
          <div className="h-48 flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600" />
          </div>
        ) : empty ? (
          <div className="h-48 flex flex-col items-center justify-center text-center p-4">
            <BarChart2 className="h-8 w-8 text-slate-300 mb-2" />
            <p className="text-xs text-slate-500 font-medium">{emptyMessage}</p>
          </div>
        ) : (
          children
        )}
      </div>
    </div>
  )
}

/**
 * Responsive SVG Line Chart for trends over time
 */
export interface LinePoint {
  label: string
  value: number
  secondaryValue?: number
}

interface SvgLineChartProps {
  data: LinePoint[]
  valuePrefix?: string
  lineColor?: string
  secondaryColor?: string
  primaryLabel?: string
  secondaryLabel?: string
  height?: number
}

export function SvgLineChart({
  data,
  valuePrefix = '',
  lineColor = '#0d9488', // teal-600
  secondaryColor = '#6366f1', // indigo-500
  primaryLabel = 'Value',
  secondaryLabel,
  height = 200
}: SvgLineChartProps) {
  if (!data || data.length === 0) return null

  const width = 600
  const padX = 40
  const padY = 30

  const primaryValues = data.map(d => d.value)
  const secondaryValues = data.map(d => d.secondaryValue || 0)
  const maxVal = Math.max(1, ...primaryValues, ...(secondaryLabel ? secondaryValues : [0]))

  const getX = (index: number) => {
    if (data.length <= 1) return width / 2
    return padX + (index / (data.length - 1)) * (width - padX * 2)
  }

  const getY = (val: number) => {
    return (height - padY) - (val / maxVal) * (height - padY * 2)
  }

  const primaryPoints = data.map((d, i) => `${getX(i)},${getY(d.value)}`).join(' ')
  const secondaryPoints = secondaryLabel ? data.map((d, i) => `${getX(i)},${getY(d.secondaryValue || 0)}`).join(' ') : ''

  return (
    <div className="w-full flex flex-col">
      {(primaryLabel || secondaryLabel) && (
        <div className="flex items-center justify-end gap-4 text-xs font-medium text-slate-600 mb-2">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-1 rounded-full inline-block" style={{ backgroundColor: lineColor }} />
            <span>{primaryLabel}</span>
          </div>
          {secondaryLabel && (
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-1 rounded-full inline-block" style={{ backgroundColor: secondaryColor }} />
              <span>{secondaryLabel}</span>
            </div>
          )}
        </div>
      )}

      <div className="relative w-full overflow-hidden">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto overflow-visible">
          {/* Background Grid Lines */}
          {[0, 0.25, 0.5, 0.75, 1].map((ratio, i) => {
            const y = (height - padY) - ratio * (height - padY * 2)
            const val = Math.round(ratio * maxVal)
            return (
              <g key={i}>
                <line x1={padX} y1={y} x2={width - padX} y2={y} stroke="#f1f5f9" strokeWidth="1" strokeDasharray="3 3" />
                <text x={padX - 8} y={y + 3} fontSize="9" fill="#94a3b8" textAnchor="end">{valuePrefix}{val}</text>
              </g>
            )
          })}

          {/* Secondary Line */}
          {secondaryLabel && (
            <polyline fill="none" stroke={secondaryColor} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" points={secondaryPoints} />
          )}

          {/* Primary Line */}
          <polyline fill="none" stroke={lineColor} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" points={primaryPoints} />

          {/* Primary Data Points */}
          {data.map((d, i) => {
            const x = getX(i)
            const y = getY(d.value)
            return (
              <g key={i} className="group cursor-pointer">
                <circle cx={x} cy={y} r="3.5" fill="white" stroke={lineColor} strokeWidth="2.5" className="transition-transform group-hover:scale-150" />
                <title>{`${d.label}: ${valuePrefix}${d.value}${secondaryLabel ? ` | ${secondaryLabel}: ${d.secondaryValue || 0}` : ''}`}</title>
              </g>
            )
          })}

          {/* X Axis Labels */}
          {data.map((d, i) => {
            // Show every Nth label if too many items
            const step = Math.ceil(data.length / 7)
            if (i % step !== 0 && i !== data.length - 1) return null
            const x = getX(i)
            return (
              <text key={i} x={x} y={height - 8} fontSize="9" fill="#64748b" textAnchor="middle" fontWeight="500">
                {d.label.length > 5 ? d.label.slice(5) : d.label}
              </text>
            )
          })}
        </svg>
      </div>
    </div>
  )
}

/**
 * Modern Responsive Daily Bar Chart for volume and collections over time
 */
export interface DailyBarPoint {
  label: string
  value: number
  secondaryValue?: number
}

interface SvgDailyBarChartProps {
  data: DailyBarPoint[]
  valuePrefix?: string
  primaryColor?: string
  secondaryColor?: string
  primaryLabel?: string
  secondaryLabel?: string
  height?: number
}

export function SvgDailyBarChart({
  data,
  valuePrefix = '',
  primaryColor = '#0d9488', // teal-600
  secondaryColor = '#10b981', // emerald-500
  primaryLabel = 'Visits',
  secondaryLabel,
  height = 200
}: SvgDailyBarChartProps) {
  if (!data || data.length === 0) return null

  const width = 640
  const padLeft = 45
  const padRight = 20
  const padTop = 20
  const padBottom = 32

  const chartWidth = width - padLeft - padRight
  const chartHeight = height - padTop - padBottom

  const primaryValues = data.map(d => d.value || 0)
  const secondaryValues = data.map(d => d.secondaryValue || 0)
  const maxVal = Math.max(1, ...primaryValues, ...(secondaryLabel ? secondaryValues : [0]))

  const count = data.length
  const slotWidth = chartWidth / count

  // Calculate bar widths based on available slot
  const isDual = !!secondaryLabel
  const barWidth = isDual
    ? Math.min(18, Math.max(3, (slotWidth - 4) / 2))
    : Math.min(28, Math.max(4, slotWidth * 0.65))

  return (
    <div className="w-full flex flex-col">
      {(primaryLabel || secondaryLabel) && (
        <div className="flex items-center justify-end gap-4 text-xs font-medium text-slate-600 mb-2">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm inline-block" style={{ backgroundColor: primaryColor }} />
            <span>{primaryLabel}</span>
          </div>
          {secondaryLabel && (
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm inline-block" style={{ backgroundColor: secondaryColor }} />
              <span>{secondaryLabel}</span>
            </div>
          )}
        </div>
      )}

      <div className="relative w-full overflow-hidden">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto overflow-visible">
          {/* Background Grid Lines */}
          {[0, 0.25, 0.5, 0.75, 1].map((ratio, i) => {
            const y = (padTop + chartHeight) - ratio * chartHeight
            const val = Math.round(ratio * maxVal)
            return (
              <g key={i}>
                <line x1={padLeft} y1={y} x2={width - padRight} y2={y} stroke="#f1f5f9" strokeWidth="1" strokeDasharray="3 3" />
                <text x={padLeft - 8} y={y + 3} fontSize="9" fill="#94a3b8" textAnchor="end" className="font-mono">
                  {valuePrefix}{val >= 1000 ? `${(val / 1000).toFixed(val % 1000 === 0 ? 0 : 1)}k` : val}
                </text>
              </g>
            )
          })}

          {/* Bars */}
          {data.map((d, i) => {
            const slotX = padLeft + i * slotWidth
            const primaryH = (Math.max(0, d.value) / maxVal) * chartHeight
            const secondaryH = isDual ? (Math.max(0, d.secondaryValue || 0) / maxVal) * chartHeight : 0

            const totalGroupWidth = isDual ? (barWidth * 2 + 2) : barWidth
            const startX = slotX + (slotWidth - totalGroupWidth) / 2

            const primaryX = startX
            const primaryY = (padTop + chartHeight) - primaryH

            const secondaryX = startX + barWidth + 2
            const secondaryY = (padTop + chartHeight) - secondaryH

            return (
              <g key={i} className="group cursor-pointer">
                {/* Primary Bar */}
                <rect
                  x={primaryX}
                  y={primaryH > 0 ? primaryY : padTop + chartHeight - 1}
                  width={barWidth}
                  height={Math.max(1, primaryH)}
                  rx={Math.min(3, barWidth / 2)}
                  fill={primaryColor}
                  className="transition-all duration-300 group-hover:brightness-90 group-hover:opacity-95"
                />

                {/* Secondary Bar if dual */}
                {isDual && (
                  <rect
                    x={secondaryX}
                    y={secondaryH > 0 ? secondaryY : padTop + chartHeight - 1}
                    width={barWidth}
                    height={Math.max(1, secondaryH)}
                    rx={Math.min(3, barWidth / 2)}
                    fill={secondaryColor}
                    className="transition-all duration-300 group-hover:brightness-90 group-hover:opacity-95"
                  />
                )}

                <title>
                  {`${d.label}: ${primaryLabel} = ${valuePrefix}${d.value.toLocaleString()}${secondaryLabel ? ` | ${secondaryLabel} = ${d.secondaryValue || 0}` : ''}`}
                </title>
              </g>
            )
          })}

          {/* X Axis Date Labels */}
          {data.map((d, i) => {
            const step = Math.ceil(data.length / 8)
            if (i % step !== 0 && i !== data.length - 1) return null
            const x = padLeft + i * slotWidth + slotWidth / 2
            const formattedLabel = d.label.length > 5 ? d.label.slice(5) : d.label
            return (
              <text key={i} x={x} y={height - 8} fontSize="9" fill="#64748b" textAnchor="middle" fontWeight="500" className="font-mono">
                {formattedLabel}
              </text>
            )
          })}
        </svg>
      </div>
    </div>
  )
}

/**
 * Responsive Bar Chart for category comparisons
 */
export interface BarItem {
  label: string
  value: number
  color?: string
  displayValue?: string
}

interface SvgBarChartProps {
  data: BarItem[]
  horizontal?: boolean
  maxItems?: number
  valuePrefix?: string
}

export function SvgBarChart({ data, horizontal = false, maxItems = 10, valuePrefix = '' }: SvgBarChartProps) {
  const items = data.slice(0, maxItems)
  const rawMax = Math.max(...items.map(d => Math.abs(d.value)))
  const maxVal = rawMax > 0 ? rawMax : 1

  if (!items || items.length === 0) {
    return (
      <div className="h-44 flex items-center justify-center text-xs text-slate-400 font-medium">
        No volume recorded for this period
      </div>
    )
  }

  // If explicitly horizontal is requested, render a modern progress card layout
  if (horizontal) {
    return (
      <div className="space-y-3.5 w-full py-2">
        {items.map((item, i) => {
          const val = Math.abs(item.value)
          const pct = Math.round((val / maxVal) * 100)
          return (
            <div key={i} className="space-y-1.5 group">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-800 truncate max-w-[280px]" title={item.label}>
                  {item.label}
                </span>
                <span className="font-mono font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded-md text-[11px]">
                  {item.displayValue || `${valuePrefix}${item.value}`}
                </span>
              </div>
              <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden p-0.5">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${val > 0 ? Math.max(5, pct) : 0}%`,
                    backgroundColor: item.color || '#0d9488'
                  }}
                />
              </div>
            </div>
          )
        })}
      </div>
    )
  }

  // Premium Vertical Column Bar Chart
  return (
    <div className="w-full flex flex-col pt-3 pb-1">
      <div className="relative w-full min-h-[220px] flex items-end justify-center px-2 sm:px-4 pb-1 border-b border-slate-200/80">
        {/* Background Grid Lines & Y-Axis Scale */}
        <div className="absolute inset-0 pointer-events-none flex flex-col justify-between pb-1 z-0">
          {[1, 0.66, 0.33, 0].map((ratio, i) => {
            const val = Math.round(ratio * maxVal)
            return (
              <div key={i} className="w-full flex items-center gap-2">
                <span className="w-8 text-[10px] font-mono text-slate-400 text-right shrink-0 select-none">
                  {val > 0 ? (valuePrefix ? `${valuePrefix}${val}` : val) : ''}
                </span>
                <div className="w-full border-b border-dashed border-slate-100" />
              </div>
            )
          })}
        </div>

        {/* Vertical Columns */}
        <div className="relative z-10 w-full flex items-end justify-center gap-3 sm:gap-6 h-full pl-8">
          {items.map((item, i) => {
            const val = Math.abs(item.value)
            const hPct = val > 0 ? Math.max(10, Math.round((val / maxVal) * 82)) : 2
            const barColor = item.color || '#0d9488'

            return (
              <div
                key={i}
                className="flex-1 max-w-[90px] sm:max-w-[110px] flex flex-col items-center h-full justify-end group transition-all"
              >
                {/* Value pill badge on top of bar */}
                <div className="mb-2 shrink-0 transition-transform duration-200 group-hover:-translate-y-1">
                  <span className={`inline-block px-2 py-0.5 rounded-md text-[11px] font-mono font-bold shadow-xs whitespace-nowrap ${
                    val > 0 ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-400'
                  }`}>
                    {item.displayValue || (valuePrefix ? `${valuePrefix}${item.value}` : item.value)}
                  </span>
                </div>

                {/* The Column Bar */}
                <div className="w-full flex items-end justify-center h-[135px]">
                  <div
                    className="w-full max-w-[42px] rounded-t-lg transition-all duration-500 shadow-sm group-hover:brightness-95 relative overflow-hidden"
                    style={{
                      height: `${hPct}%`,
                      backgroundColor: val > 0 ? barColor : '#e2e8f0',
                      minHeight: val > 0 ? '10px' : '2px'
                    }}
                  >
                    {val > 0 && (
                      <div className="absolute inset-0 bg-gradient-to-t from-black/15 to-white/25 pointer-events-none" />
                    )}
                  </div>
                </div>

                {/* X-Axis Category/Item Label */}
                <div className="mt-3 text-center w-full px-0.5">
                  <span
                    className="block text-xs font-semibold text-slate-700 leading-snug line-clamp-2 break-words group-hover:text-slate-900"
                    title={item.label}
                  >
                    {item.label}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

/**
 * Donut Chart for simple distribution breakdown
 */
export interface DonutSlice {
  label: string
  value: number
  color: string
  count?: number
}

interface SvgDonutChartProps {
  data: DonutSlice[]
  centerLabel?: string
  centerSub?: string
}

export function SvgDonutChart({ data, centerLabel, centerSub }: SvgDonutChartProps) {
  const total = data.reduce((sum, d) => sum + d.value, 0)
  if (total === 0) return null

  const size = 160
  const strokeWidth = 24
  const radius = (size - strokeWidth) / 2
  const circ = 2 * Math.PI * radius

  let currentAngle = 0

  return (
    <div className="flex flex-col sm:flex-row items-center justify-center gap-6 py-2">
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
          {data.map((slice, i) => {
            const pct = slice.value / total
            const strokeDasharray = `${pct * circ} ${circ}`
            const strokeDashoffset = -currentAngle * circ
            currentAngle += pct

            return (
              <circle
                key={i}
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="transparent"
                stroke={slice.color}
                strokeWidth={strokeWidth}
                strokeDasharray={strokeDasharray}
                strokeDashoffset={strokeDashoffset}
                className="transition-all duration-500"
              />
            )
          })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="text-base font-extrabold text-slate-900 tracking-tight leading-none">
            {centerLabel || total}
          </span>
          {centerSub && <span className="text-[10px] font-semibold text-slate-400 mt-0.5">{centerSub}</span>}
        </div>
      </div>

      <div className="space-y-2 text-xs w-full max-w-[200px]">
        {data.map((slice, i) => {
          const pct = Math.round((slice.value / total) * 100)
          return (
            <div key={i} className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 truncate">
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: slice.color }} />
                <span className="text-slate-600 font-medium truncate">{slice.label}</span>
              </div>
              <div className="flex items-center gap-2 font-mono shrink-0">
                <span className="font-bold text-slate-800">{slice.count !== undefined ? `${slice.count} tx` : `₹${slice.value.toLocaleString()}`}</span>
                <span className="text-slate-400 text-[11px] font-normal">({pct}%)</span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
