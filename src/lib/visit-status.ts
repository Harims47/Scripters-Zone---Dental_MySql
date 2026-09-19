export type VisitStatus = 
  | 'ARRIVED' 
  | 'WAITING' 
  | 'CALLED' 
  | 'WITH_DOCTOR' 
  | 'READY_FOR_RECEPTION' 
  | 'READY_FOR_PAYMENT' 
  | 'PAID' 
  | 'COMPLETED'
  | 'CANCELLED'

// Canonical allowed status transitions for a visit
export const ALLOWED_VISIT_TRANSITIONS: Record<VisitStatus, VisitStatus[]> = {
  'ARRIVED': ['WAITING', 'CANCELLED'],
  'WAITING': ['CALLED', 'WITH_DOCTOR', 'CANCELLED'],
  'CALLED': ['WITH_DOCTOR', 'WAITING', 'CANCELLED'], // Can go back to waiting if they missed the call
  'WITH_DOCTOR': ['READY_FOR_RECEPTION', 'READY_FOR_PAYMENT', 'COMPLETED'], // Sometimes skips reception if no meds
  'READY_FOR_RECEPTION': ['READY_FOR_PAYMENT'],
  'READY_FOR_PAYMENT': ['PAID'],
  'PAID': ['COMPLETED'],
  'COMPLETED': [],
  'CANCELLED': []
}

export function canTransitionVisit(currentStatus: VisitStatus, targetStatus: VisitStatus): boolean {
  return ALLOWED_VISIT_TRANSITIONS[currentStatus].includes(targetStatus)
}
