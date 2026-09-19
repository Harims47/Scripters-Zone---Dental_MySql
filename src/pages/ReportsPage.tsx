import React, { useState } from 'react'
import { ReportDateRange, computeDatesForPreset, type DateRangeState } from '../components/reports/ReportDateRange'
import { OverviewReport } from '../components/reports/OverviewReport'
import { VisitsReport } from '../components/reports/VisitsReport'
import { PatientsReport } from '../components/reports/PatientsReport'
import { RevenueReport } from '../components/reports/RevenueReport'
import { TreatmentsReport } from '../components/reports/TreatmentsReport'
import { DoctorsReport } from '../components/reports/DoctorsReport'
import { MedicinesReport } from '../components/reports/MedicinesReport'
import { InventoryReport } from '../components/reports/InventoryReport'
import { ProcurementReport } from '../components/reports/ProcurementReport'
import {
  LayoutDashboard,
  Calendar,
  Users,
  IndianRupee,
  Activity,
  Stethoscope,
  Pill,
  Package,
  ShoppingBag
} from 'lucide-react'

export type ReportTab =
  | 'overview'
  | 'visits'
  | 'patients'
  | 'revenue'
  | 'treatments'
  | 'doctors'
  | 'medicines'
  | 'inventory'
  | 'procurement'

const TABS: { id: ReportTab; label: string; icon: React.ElementType }[] = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'visits', label: 'Visits', icon: Calendar },
  { id: 'patients', label: 'Patients', icon: Users },
  { id: 'revenue', label: 'Revenue', icon: IndianRupee },
  { id: 'treatments', label: 'Treatments', icon: Activity },
  { id: 'doctors', label: 'Doctors', icon: Stethoscope },
  { id: 'medicines', label: 'Medicines', icon: Pill },
  { id: 'inventory', label: 'Inventory', icon: Package },
  { id: 'procurement', label: 'Procurement', icon: ShoppingBag }
]

export function ReportsPage() {
  const [activeTab, setActiveTab] = useState<ReportTab>('overview')

  // Shared Global Date Range State across all tabs
  const initialDates = computeDatesForPreset('this_month', '', '')
  const [dateRange, setDateRange] = useState<DateRangeState>({
    preset: 'this_month',
    customStart: '',
    customEnd: '',
    startDate: initialDates.startDate,
    endDate: initialDates.endDate
  })

  return (
    <div className="space-y-6 max-w-[1440px] mx-auto pb-12 flex flex-col h-full">
      {/* 1. Header with Title & Global Date Controls */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-100 shadow-[0_2px_12px_-4px_rgba(15,23,42,0.04)]">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900">Clinic Reports</h1>
          <p className="text-sm text-slate-500 mt-1">Comprehensive clinical activity, revenue, and operations analytics.</p>
        </div>

        {/* Global Date Range Component */}
        <ReportDateRange
          value={dateRange}
          onChange={setDateRange}
        />
      </div>

      {/* 2. Horizontal Sub-Tabs */}
      <div className="border-b border-slate-200 overflow-x-auto scrollbar-none">
        <div className="flex items-center gap-2 min-w-max pb-0.5">
          {TABS.map((tab) => {
            const Icon = tab.icon
            const isActive = activeTab === tab.id
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-3 font-semibold text-xs rounded-t-xl transition-all border-b-2 ${
                  isActive
                    ? 'border-teal-600 text-teal-700 bg-teal-50/50'
                    : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-teal-600' : 'text-slate-400'}`} />
                <span>{tab.label}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* 3. Active Report Tab Body (Preserves dateRange when switching tabs) */}
      <div className="flex-1">
        {activeTab === 'overview' && <OverviewReport dateRange={dateRange} />}
        {activeTab === 'visits' && <VisitsReport dateRange={dateRange} />}
        {activeTab === 'patients' && <PatientsReport dateRange={dateRange} />}
        {activeTab === 'revenue' && <RevenueReport dateRange={dateRange} />}
        {activeTab === 'treatments' && <TreatmentsReport dateRange={dateRange} />}
        {activeTab === 'doctors' && <DoctorsReport dateRange={dateRange} />}
        {activeTab === 'medicines' && <MedicinesReport dateRange={dateRange} />}
        {activeTab === 'inventory' && <InventoryReport dateRange={dateRange} />}
        {activeTab === 'procurement' && <ProcurementReport dateRange={dateRange} />}
      </div>
    </div>
  )
}
export default ReportsPage
