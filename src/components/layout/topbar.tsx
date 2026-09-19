import { Menu, ChevronDown, Globe } from "lucide-react"
import { useNavigate } from "react-router-dom"
import { Button } from "../ui/button"
import { Sheet, SheetContent, SheetTrigger } from "../ui/sheet"
import { Sidebar } from "./sidebar"
import { useAuth } from "../../context/AuthContext"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu"


export function Topbar() {
  const { currentUser, logout } = useAuth()
  const navigate = useNavigate()
  
  const userName = currentUser?.name || "Unknown"
  const userRole = currentUser?.role || "Unknown Role"

  const changeLanguage = (langCode: string) => {
    const combo = document.querySelector('.goog-te-combo') as HTMLSelectElement;
    if (combo) {
      combo.value = langCode;
      combo.dispatchEvent(new Event('change', { bubbles: true }));
    }
    // Fallback if combo is not immediately available, or to enforce English reset
    if (langCode === 'en') {
      // To force reset to original English when Google Translate sometimes fails to switch back cleanly
      const iframe = document.querySelector('iframe.goog-te-menu-frame') as HTMLIFrameElement;
      if (!combo && !iframe) {
         // Google translate might not be active, which is fine, it's already English
      }
    }
  };

  return (
    <header className="h-[72px] bg-white/80 backdrop-blur-md border-b border-slate-100 px-8 flex items-center justify-between shrink-0 z-10 sticky top-0">
      <div className="flex items-center gap-4">
        {/* Mobile Navigation Toggle */}
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="md:hidden text-slate-500">
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="p-0 w-[260px] bg-white border-r-slate-100">
            <Sidebar />
          </SheetContent>
        </Sheet>
      </div>

      <div className="flex items-center gap-3">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-10 w-10 text-slate-500 hover:bg-slate-50 rounded-full">
              <Globe className="h-[18px] w-[18px]" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Language</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => changeLanguage('en')} className="font-medium cursor-pointer">English</DropdownMenuItem>
            <DropdownMenuItem onClick={() => changeLanguage('ta')} className="cursor-pointer">தமிழ்</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>



        <div className="h-6 w-[1px] bg-slate-200 hidden sm:block mx-2" />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <div className="flex items-center gap-3 cursor-pointer hover:bg-slate-50 p-1.5 pr-3 rounded-full transition-colors border border-transparent hover:border-slate-100">
              <div className="w-8 h-8 rounded-full bg-slate-900 flex items-center justify-center text-white font-bold text-sm shadow-md">
                {userName.substring(0, 2).toUpperCase().replace(/[^A-Z]/g, 'DA')}
              </div>
              <div className="hidden sm:flex flex-col">
                <span className="text-[13px] font-bold text-slate-900 leading-none mb-1">{userName}</span>
                <span className="text-[11px] font-medium text-slate-500 leading-none">{userRole}</span>
              </div>
              <ChevronDown className="h-4 w-4 text-slate-400 ml-1 hidden sm:block" />
            </div>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuLabel>My Account</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => navigate('/profile')}>Profile</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={logout} className="text-rose-600 focus:bg-rose-50 focus:text-rose-700 font-medium">Logout</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
