import type { ClinicRole, ClinicModule } from '../role-config';

export interface Staff {
  id: string;
  name: string;
  phone: string;
  role: ClinicRole;
  status: 'Active' | 'Inactive';
  attendance?: 'Present' | 'Leave';
  roomNumber?: string;
  permissions?: ClinicModule[] | null;
}

export const DEMO_STAFF: Staff[] = [
  { id: 'STF-001', name: 'Dr. Arun', phone: '+91 98765 43210', role: 'Head Doctor', status: 'Active' },
  { id: 'STF-111', name: 'Dr. Carter', phone: '+91 98765 43220', role: 'Duty Doctor', status: 'Active' },
  { id: 'STF-222', name: 'Reception User', phone: '+91 98765 43215', role: 'Receptionist', status: 'Active' }
];

export const DEMO_PROVIDERS = DEMO_STAFF.filter(s => 
  s.role === 'Head Doctor' || s.role === 'Duty Doctor'
);
