import { ROLE_CONFIG } from './role-config'
import type { ClinicRole, ClinicModule } from './role-config'

// Mapping routes to required modules according to the UI flow
// This directly maps a URL path prefix to the Clinical Module permission it requires.
export const ROUTE_MODULE_MAP: Record<string, ClinicModule> = {
  '/dashboard': 'Dashboard',
  '/reception-desk': 'Reception Desk',
  '/patients': 'Patients',
  '/appointments': 'Appointments',
  '/queue': 'Queue',
  '/doctor': 'Doctor Workspace', // Matches /doctor/patient/:id
  '/inventory': 'Inventory',
  '/reception/dispensing': 'Dispensing',
  '/billing': 'Billing',
  '/reimbursement': 'Reimbursement',
  '/payments': 'Payments',
  '/partial-payments': 'Partial Payments',
  '/staff': 'Staff Management',
  '/settings': 'Settings',
  '/reports': 'Reports'
}

/**
 * Checks if a user is permitted to access a given URL path based on:
 * 1. Role baseline permissions (ROLE_CONFIG[role].permissions)
 * 2. User explicit module access (userPermissions)
 * Effective access: ROLE PERMISSION + MODULE ACCESS = ACTUAL ACCESS
 */
export function canAccessRoute(role: ClinicRole, path: string, userPermissions?: ClinicModule[] | null): boolean {
  const config = ROLE_CONFIG[role]
  if (!config) return false

  // Invariant: Historical Migration is strictly Head Doctor only
  if (path.startsWith('/historical-migration')) {
    return role === 'Head Doctor'
  }

  // Invariant: Reimbursement is strictly Head Doctor only
  if (path.startsWith('/reimbursement')) {
    return role === 'Head Doctor'
  }

  // Find the matching module for the path
  const matchingKey = Object.keys(ROUTE_MODULE_MAP).find(prefix => path.startsWith(prefix))
  
  // If the path doesn't map to a specific module, allow access (e.g. /login, /unauthorized)
  if (!matchingKey) return true 
  
  const requiredModule = ROUTE_MODULE_MAP[matchingKey]

  // Invariant: Reports is strictly Head Doctor only
  if (requiredModule === 'Reports' && role !== 'Head Doctor') {
    return false
  }

  // Invariant: Reimbursement is strictly Head Doctor only
  if (requiredModule === 'Reimbursement' && role !== 'Head Doctor') {
    return false
  }

  // If user has custom module access configured (non-null / non-undefined array)
  if (userPermissions !== null && userPermissions !== undefined && Array.isArray(userPermissions)) {
    // Head Doctor always retains Staff Management and Dashboard
    if (role === 'Head Doctor' && (requiredModule === 'Staff Management' || requiredModule === 'Dashboard')) {
      return true
    }
    
    if (userPermissions.includes(requiredModule)) {
      return true
    }

    // Sub-modules linked to visible sidebar menu modules:
    // Doctor Workspace is entered from Queue
    if (requiredModule === 'Doctor Workspace' && userPermissions.includes('Queue')) {
      return true
    }

    // Front-desk sub-modules integrated into Reception Desk
    if (
      (requiredModule === 'Appointments' || requiredModule === 'Billing' || requiredModule === 'Payments' || requiredModule === 'Dispensing') &&
      userPermissions.includes('Reception Desk')
    ) {
      return true
    }

    return false
  }

  // No custom permissions (null/undefined) -> allowed by role baseline
  return config.permissions.includes(requiredModule)
}
