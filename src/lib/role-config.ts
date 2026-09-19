export type ClinicRole = 'Head Doctor' | 'Duty Doctor' | 'Receptionist'

export type ClinicModule = 
  | 'Dashboard'
  | 'Reception Desk'
  | 'Patients'
  | 'Appointments'
  | 'Queue'
  | 'Doctor Workspace'
  | 'Prescriptions'
  | 'Inventory'
  | 'Dispensing'
  | 'Billing'
  | 'Payments'
  | 'Staff Management'
  | 'Settings'
  | 'Reports'
  | 'Partial Payments'
  | 'Reimbursement'

export interface RoleConfig {
  role: ClinicRole
  label: string
  description: string
  permissions: ClinicModule[]
}

export const ROLE_CONFIG: Record<ClinicRole, RoleConfig> = {
  'Head Doctor': {
    role: 'Head Doctor',
    label: 'Head Doctor (Super Admin)',
    description: 'Full clinic access including staff and settings management.',
    permissions: ['Dashboard', 'Reception Desk', 'Partial Payments', 'Patients', 'Appointments', 'Queue', 'Doctor Workspace', 'Prescriptions', 'Inventory', 'Dispensing', 'Billing', 'Payments', 'Staff Management', 'Settings', 'Reports', 'Reimbursement']
  },
  'Duty Doctor': {
    role: 'Duty Doctor',
    label: 'Duty Doctor',
    description: 'Clinical access for daily patient consultations.',
    permissions: ['Dashboard', 'Patients', 'Queue', 'Doctor Workspace', 'Prescriptions']
  },
  'Receptionist': {
    role: 'Receptionist',
    label: 'Receptionist',
    description: 'Front-desk operations, appointments, and payments.',
    permissions: ['Dashboard', 'Reception Desk', 'Partial Payments', 'Patients', 'Appointments', 'Queue', 'Dispensing', 'Billing', 'Payments']
  }
}

// All available modules for the preview UI
export const ALL_MODULES: ClinicModule[] = [
  'Dashboard', 'Reception Desk', 'Partial Payments', 'Patients', 'Appointments', 'Queue', 'Doctor Workspace', 
  'Prescriptions', 'Inventory', 'Dispensing', 'Billing', 'Payments', 
  'Staff Management', 'Settings', 'Reports', 'Reimbursement'
]

// Active modules corresponding strictly to the visible sidebar navigation menu items
export const SIDEBAR_MODULES: ClinicModule[] = [
  'Dashboard',
  'Reception Desk',
  'Partial Payments',
  'Patients',
  'Queue',
  'Reimbursement',
  'Inventory',
  'Staff Management',
  'Reports',
  'Settings'
]

