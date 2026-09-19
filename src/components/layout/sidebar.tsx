import { useState, useRef, useEffect } from "react"
import { NavLink } from "react-router-dom"
import { 
  LayoutDashboard, Users, Calendar, Clock, 
  Package, Stethoscope, Settings, Receipt,
  LogOut, Menu, BarChart3, FolderArchive, FileText
} from "lucide-react"
import { cn } from "../../lib/utils"
import { t } from "../../lib/i18n"
import { useAuth } from "../../context/AuthContext"
import { canAccessRoute } from "../../lib/route-permissions"

export type ClinicRole = 'head-doctor' | 'duty-doctor' | 'receptionist'

interface NavItem {
  title: string
  href: string
  icon: React.ElementType
  roles?: ClinicRole[]
}

const navItems: NavItem[] = [
  { title: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { title: "Reception Desk", href: "/reception-desk", icon: Users },
  { title: "Partial Payments", href: "/partial-payments", icon: Receipt },
  { title: "Patients", href: "/patients", icon: Users },
  { title: "Appointments", href: "/appointments", icon: Calendar },
  { title: "Queue", href: "/queue", icon: Clock },
  { title: "Billing", href: "/billing", icon: Receipt },
  { title: "Reimbursement", href: "/reimbursement", icon: FileText },
  { title: "Inventory", href: "/inventory", icon: Package },
  { title: "Staff", href: "/staff", icon: Stethoscope },
  { title: "Reports", href: "/reports", icon: BarChart3 },
  { title: "Historical Migration", href: "/historical-migration", icon: FolderArchive },
  { title: "Settings", href: "/settings", icon: Settings },
]

interface SidebarProps {
  currentRole?: ClinicRole
  className?: string
  onNavigate?: () => void
  isCollapsed?: boolean
  onToggleCollapse?: () => void
}

export function Sidebar({ className, onNavigate, isCollapsed = false, onToggleCollapse }: SidebarProps) {
  const { currentUser, logout } = useAuth()
  const [isScrolling, setIsScrolling] = useState(false)
  const scrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleScroll = () => {
    setIsScrolling(true)
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current)
    }
    scrollTimeoutRef.current = setTimeout(() => {
      setIsScrolling(false)
    }, 1000)
  }

  useEffect(() => {
    return () => {
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current)
      }
    }
  }, [])
  
  // Filter navItems based on the current user's role and the centralized permission map
  const filteredNav = navItems.filter(item => {
    if (!currentUser) return false
    
    // Phase 9: Hide modules that are merged into Reception Desk
    if (currentUser.role === 'Receptionist') {
      const hiddenForMerged = ['/appointments', '/queue', '/billing']
      if (hiddenForMerged.includes(item.href)) {
        return false
      }
    }
    
    // Head Doctor uses Reception Desk for Billing/Appointments
    if (currentUser.role === 'Head Doctor') {
      const hiddenForMerged = ['/appointments', '/billing']
      if (hiddenForMerged.includes(item.href)) {
        return false
      }
    }
    
    return canAccessRoute(currentUser.role, item.href, currentUser.permissions)
  })

  return (
    <div className={cn("flex flex-col h-full bg-white border-r border-slate-100 shadow-[4px_0_24px_rgba(0,0,0,0.01)]", className)}>
      <div className={cn("h-[72px] flex items-center border-b border-slate-100 shrink-0 relative", isCollapsed ? "justify-center px-3" : "pl-4 pr-3 justify-between gap-2")}>
        <div className={cn("flex items-center min-w-0", isCollapsed ? "justify-center w-full" : "flex-1 overflow-hidden")}>
          <img
            src={isCollapsed ? "/dental-icon.png" : "/dental-logo-trimmed.png"}
            alt="Rafi Dental Clinic"
            className={cn(
              "object-contain transition-all duration-200",
              isCollapsed ? "h-11 w-11 shrink-0" : "h-[56px] w-auto max-w-[195px] object-left"
            )}
          />
        </div>
        
        {onToggleCollapse && (
          <button
            onClick={onToggleCollapse}
            title={isCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
            className={cn(
              "hidden md:flex items-center justify-center rounded-lg p-1.5 transition-colors text-slate-400 hover:bg-slate-100 hover:text-slate-900",
              isCollapsed && "absolute -right-3.5 top-1/2 -translate-y-1/2 bg-white border border-slate-200 shadow-sm rounded-full z-50 h-7 w-7 p-0 hover:text-teal-600 hover:border-teal-300"
            )}
          >
            <Menu className="h-4 w-4 shrink-0" />
          </button>
        )}
      </div>
      
      <div 
        onScroll={handleScroll}
        className={cn(
          "flex-1 overflow-y-auto py-5 px-3 space-y-1 sidebar-scrollbar",
          isScrolling && "is-scrolling"
        )}
      >
        {!isCollapsed && (
          <div className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-3 px-3 mt-2 whitespace-nowrap">
            {t('sidebar.clinic', 'Main Menu')}
          </div>
        )}
        {filteredNav.map((item) => (
          <NavLink
            key={item.href}
            to={item.href}
            onClick={onNavigate}
            title={isCollapsed ? t(`sidebar.${item.title.toLowerCase()}`, item.title) : undefined}
            className={({ isActive }) =>
              cn(
                "flex items-center rounded-xl font-medium transition-colors w-full group relative",
                isCollapsed ? "justify-center py-3" : "px-3 py-2.5 gap-3",
                isActive
                  ? "bg-teal-50 text-teal-700 font-semibold"
                  : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
              )
            }
          >
            {({ isActive }) => (
              <>
                <item.icon className={cn("h-5 w-5 shrink-0", isActive ? "text-teal-600" : "")} />
                {!isCollapsed && <span className="truncate">{t(`sidebar.${item.title.toLowerCase()}`, item.title)}</span>}
                {isActive && !isCollapsed && (
                  <div className="ml-auto w-1.5 h-1.5 rounded-full bg-teal-500 shadow-[0_0_6px_rgba(20,184,166,0.6)] shrink-0" />
                )}
                {isActive && isCollapsed && (
                  <div className="absolute right-2 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-teal-500 shadow-[0_0_6px_rgba(20,184,166,0.6)] shrink-0" />
                )}
              </>
            )}
          </NavLink>
        ))}
      </div>

      <div className="p-3 border-t border-slate-100 space-y-1 shrink-0">
        <button
          onClick={logout}
          title={isCollapsed ? "Logout" : undefined}
          className={cn(
            "flex items-center w-full rounded-xl font-medium transition-colors text-rose-600 hover:bg-rose-50",
            isCollapsed ? "justify-center py-3" : "px-3 py-2.5 gap-3"
          )}
        >
          <LogOut className="h-5 w-5 shrink-0" />
          {!isCollapsed && <span>Logout</span>}
        </button>
      </div>
    </div>
  )
}
