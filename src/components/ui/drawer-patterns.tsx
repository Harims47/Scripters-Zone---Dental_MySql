import * as React from "react"
import { cn } from "../../lib/utils"
import { SheetHeader, SheetFooter } from "./sheet"

export function PatientProfileHeader({
  name,
  patientId,
  phone,
  statusElement,
  modeText = "Patient Profile",
}: {
  name: string
  patientId?: string
  phone?: string
  statusElement?: React.ReactNode
  modeText?: string
}) {
  return (
    <SheetHeader className="bg-white border-b border-slate-100/60 px-8 py-6 space-y-0 text-left relative flex-shrink-0 z-10">
      <div className="flex justify-between items-start mb-5 pr-8">
        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">
          {modeText}
        </span>
        {statusElement}
      </div>
      
      <div className="flex items-start gap-4">
        <div className="h-14 w-14 rounded-full bg-gradient-to-br from-teal-50 to-emerald-50 text-teal-700 flex items-center justify-center text-xl font-bold shadow-[0_2px_8px_-2px_rgba(15,23,42,0.05)] border border-teal-100/50 shrink-0">
          {name.charAt(0)}
        </div>
        <div className="flex flex-col pt-0.5 min-w-0">
          <h2 className="text-xl font-bold tracking-tight text-slate-900 mb-0.5 truncate">
            {name}
          </h2>
          <div className="flex items-center gap-2.5 text-[13px] font-medium text-slate-500 truncate flex-wrap">
            {patientId && <span className="font-mono text-slate-400">{patientId}</span>}
            {patientId && phone && <span>•</span>}
            {phone && <span>{phone}</span>}
          </div>
        </div>
      </div>
    </SheetHeader>
  )
}

export function EntityDrawerHeader({
  name,
  id,
  metadata,
  icon,
  statusElement,
  modeText = "Settings",
}: {
  name: string
  id?: string
  metadata?: string
  icon?: React.ReactNode
  statusElement?: React.ReactNode
  modeText?: string
}) {
  return (
    <SheetHeader className="bg-white border-b border-slate-100/60 px-8 py-6 space-y-0 text-left relative flex-shrink-0 z-10">
      <div className="flex justify-between items-start mb-5 pr-8">
        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">
          {modeText}
        </span>
        {statusElement}
      </div>
      
      <div className="flex items-start gap-4">
        <div className="h-14 w-14 rounded-xl bg-slate-50 text-slate-600 flex items-center justify-center text-xl font-bold shadow-[0_2px_8px_-2px_rgba(15,23,42,0.05)] border border-slate-200/50 shrink-0">
          {icon || name.charAt(0)}
        </div>
        <div className="flex flex-col pt-0.5 min-w-0">
          <h2 className="text-xl font-bold tracking-tight text-slate-900 mb-0.5 truncate">
            {name}
          </h2>
          <div className="flex items-center gap-2.5 text-[13px] font-medium text-slate-500 truncate flex-wrap">
            {id && <span className="font-mono text-slate-400">{id}</span>}
            {id && metadata && <span>•</span>}
            {metadata && <span>{metadata}</span>}
          </div>
        </div>
      </div>
    </SheetHeader>
  )
}

export function DrawerSection({
  title,
  children,
  className,
}: {
  title: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <section className={cn("space-y-6", className)}>
      <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-3">
        {title}
        <div className="h-[1px] flex-1 bg-slate-100/60"></div>
      </h3>
      <div className="space-y-6">
        {children}
      </div>
    </section>
  )
}

export function DrawerFooterActions({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <SheetFooter className={className}>
      <div className="flex gap-3 w-full sm:justify-end flex-col-reverse sm:flex-row">
        {children}
      </div>
    </SheetFooter>
  )
}

export function ReadOnlyField({
  label,
  value,
  isMono = false,
}: {
  label: string
  value?: string | number
  isMono?: boolean
}) {
  return (
    <div className="space-y-1.5">
      <div className="text-[13px] font-semibold text-slate-500">{label}</div>
      <div className={cn("text-[15px] text-slate-900", isMono && "font-mono")}>
        {value || "—"}
      </div>
    </div>
  )
}
