
export interface Visit {
  id: string;
  patientId: string;
  doctorId: string;
  appointmentId?: string;
  status: 'ARRIVED' | 'WAITING' | 'CALLED' | 'WITH_DOCTOR' | 'READY_FOR_RECEPTION' | 'READY_FOR_PAYMENT' | 'PAID' | 'COMPLETED' | 'CANCELLED';
  startTime?: string;
  endTime?: string;
  amountDue: number;
}
export const DEMO_VISITS: Visit[] = [
  {
    "id": "VIS-1000",
    "patientId": "PT-0006",
    "doctorId": "STF-101",
    "appointmentId": "APT-1006",
    "status": "READY_FOR_RECEPTION",
    "startTime": "10:00 AM",
    "amountDue": 568
  },
  {
    "id": "VIS-1001",
    "patientId": "PT-0007",
    "doctorId": "STF-103",
    "appointmentId": "APT-1007",
    "status": "READY_FOR_RECEPTION",
    "startTime": "11:00 AM",
    "amountDue": 426
  },
  {
    "id": "VIS-1002",
    "patientId": "PT-0008",
    "doctorId": "STF-103",
    "appointmentId": "APT-1008",
    "status": "READY_FOR_PAYMENT",
    "startTime": "12:00 AM",
    "amountDue": 158
  },
  {
    "id": "VIS-1003",
    "patientId": "PT-0010",
    "doctorId": "STF-101",
    "appointmentId": "APT-1010",
    "status": "READY_FOR_PAYMENT",
    "startTime": "10:00 AM",
    "amountDue": 119
  }
];
