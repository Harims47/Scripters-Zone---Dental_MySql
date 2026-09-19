
export interface Payment {
  id: string;
  visitId: string;
  patientId: string;
  amount: number;
  method: 'Cash' | 'GPay' | 'GPay' | 'GPay';
  status: 'Pending' | 'Paid';
  date: string;
}
export const DEMO_PAYMENTS: Payment[] = [
  {
    "id": "PAY-1000",
    "visitId": "VIS-1000",
    "patientId": "PT-0006",
    "amount": 568,
    "method": "Cash",
    "status": "Paid",
    "date": "2026-08-28"
  },
  {
    "id": "PAY-1001",
    "visitId": "VIS-1001",
    "patientId": "PT-0007",
    "amount": 426,
    "method": "Cash",
    "status": "Paid",
    "date": "2026-08-28"
  },

];
