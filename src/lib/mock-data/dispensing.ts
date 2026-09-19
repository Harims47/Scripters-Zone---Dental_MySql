
export interface DispensingItem {
  id: string;
  medicineId: string;
  prescribedQuantity: number;
  dispensedQuantity: number;
}
export interface Dispensing {
  id: string;
  visitId: string;
  prescriptionId: string;
  status: 'Pending' | 'Partial' | 'Completed';
  items: DispensingItem[];
}
export const DEMO_DISPENSING: Dispensing[] = [];
