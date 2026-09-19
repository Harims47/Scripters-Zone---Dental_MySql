
export interface PrescriptionItem {
  id: string;
  medicineId: string;
  quantity: number;
  instructions: string;
  frequency?: string;
  durationDays?: number;
  route?: string;
}
export interface Prescription {
  id: string;
  visitId: string;
  patientId: string;
  doctorId: string;
  date: string;
  status: 'Draft' | 'Finalized' | 'Dispensed';
  notes: string;
  items: PrescriptionItem[];
}
export const DEMO_PRESCRIPTIONS: Prescription[] = [
  {
    "id": "RX-1000",
    "visitId": "VIS-1000",
    "patientId": "PT-0006",
    "doctorId": "STF-101",
    "date": "2026-08-28",
    "status": "Finalized",
    "notes": "Generated notes.",
    "items": [
      {
        "id": "RXI-01",
        "medicineId": "MED-001",
        "quantity": 10,
        "instructions": "1 tablet twice daily",
        "frequency": "bd",
        "durationDays": 5,
        "route": "oral"
      },
      {
        "id": "RXI-02",
        "medicineId": "MED-003",
        "quantity": 5,
        "instructions": "1 tablet as needed",
        "frequency": "sos",
        "durationDays": 5,
        "route": "oral"
      }
    ]
  },
  {
    "id": "RX-1001",
    "visitId": "VIS-1001",
    "patientId": "PT-0007",
    "doctorId": "STF-103",
    "date": "2026-08-28",
    "status": "Finalized",
    "notes": "Generated notes.",
    "items": [
      {
        "id": "RXI-11",
        "medicineId": "MED-001",
        "quantity": 10,
        "instructions": "1 tablet twice daily",
        "frequency": "bd",
        "durationDays": 5,
        "route": "oral"
      },
      {
        "id": "RXI-12",
        "medicineId": "MED-003",
        "quantity": 5,
        "instructions": "1 tablet as needed",
        "frequency": "sos",
        "durationDays": 5,
        "route": "oral"
      }
    ]
  },
  {
    "id": "RX-1002",
    "visitId": "VIS-1002",
    "patientId": "PT-0008",
    "doctorId": "STF-103",
    "date": "2026-08-28",
    "status": "Draft",
    "notes": "Generated notes.",
    "items": [
      {
        "id": "RXI-21",
        "medicineId": "MED-001",
        "quantity": 10,
        "instructions": "1 tablet twice daily",
        "frequency": "bd",
        "durationDays": 5,
        "route": "oral"
      },
      {
        "id": "RXI-22",
        "medicineId": "MED-003",
        "quantity": 5,
        "instructions": "1 tablet as needed",
        "frequency": "sos",
        "durationDays": 5,
        "route": "oral"
      }
    ]
  }
];
