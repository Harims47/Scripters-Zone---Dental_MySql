import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { canAccessRoute } from '../../lib/route-permissions'

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, currentUser, isLoading } = useAuth()
  const location = useLocation()

  if (isLoading) {
    return <div className="h-screen w-screen flex items-center justify-center bg-slate-50"><div className="w-8 h-8 rounded-full border-4 border-teal-200 border-t-teal-600 animate-spin"></div></div>
  }

  if (!isAuthenticated || !currentUser) {
    // Redirect them to the /login page, but save the current location they were
    // trying to go to when they were redirected. This allows us to send them
    // along to that page after they login, which is a nicer user experience
    // than dropping them off on the home page.
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  // Check role and module-based route permissions
  if (!canAccessRoute(currentUser.role, location.pathname, currentUser.permissions)) {
    return <Navigate to="/unauthorized" replace />
  }

  return <>{children}</>
}
