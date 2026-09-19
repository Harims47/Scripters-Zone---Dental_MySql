import { useNavigate } from 'react-router-dom'
import { ShieldAlert } from 'lucide-react'
import { Button } from '../components/ui/button'
import { useAuth } from '../context/AuthContext'

export function UnauthorizedPage() {
  const navigate = useNavigate()
  const { currentUser, logout } = useAuth()

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center items-center p-4">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-xl shadow-slate-200/50 border border-slate-100 overflow-hidden text-center p-10 space-y-6">
        <div className="w-20 h-20 bg-rose-50 text-rose-500 rounded-full flex items-center justify-center mx-auto">
          <ShieldAlert className="w-10 h-10" />
        </div>
        
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Access Denied</h1>
          <p className="text-slate-500 mt-2 leading-relaxed">
            You don't have permission to access this page. Your role as <span className="font-semibold text-slate-700">{currentUser?.role || 'User'}</span> does not grant access to this module.
          </p>
        </div>

        <div className="pt-6 space-y-3">
          <Button onClick={() => navigate('/dashboard')} className="w-full bg-slate-900 hover:bg-slate-800">
            Back to Dashboard
          </Button>
          <Button 
            variant="ghost" 
            onClick={async () => {
              await logout()
              navigate('/login')
            }} 
            className="w-full text-slate-500"
          >
            Logout and Switch User
          </Button>
        </div>

        <div className="pt-6 border-t border-slate-100 text-center text-xs text-slate-400 font-medium">
          © {new Date().getFullYear()} Scripters Zone. All rights reserved.
        </div>
      </div>
    </div>
  )
}
