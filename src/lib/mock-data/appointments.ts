
export type AppointmentType = 'Consultation' | 'Surgery' | 'Follow-up' | 'Routine Checkup' | 'Emergency';
export type AppointmentStatus = 'Scheduled' | 'Checked In' | 'Completed' | 'Cancelled' | 'No Show';
export interface Appointment {
  id: string;
  patientId: string;
  providerId?: string;
  date: string;
  time: string;
  type: AppointmentType;
  status: AppointmentStatus;
  notes?: string;
}
export const DEMO_APPOINTMENTS: Appointment[] = [
  {
    "id": "APT-1001",
    "patientId": "PT-0001",
    "providerId": "STF-101",
    "date": "2026-08-25",
    "time": "10:00 AM",
    "type": "Routine Checkup",
    "status": "Completed",
    "notes": "Generated appointment reason."
  },
  {
    "id": "APT-1002",
    "patientId": "PT-0002",
    "providerId": "STF-102",
    "date": "2026-08-25",
    "time": "11:00 AM",
    "type": "Surgery",
    "status": "Completed",
    "notes": "Generated appointment reason."
  },
  {
    "id": "APT-1003",
    "patientId": "PT-0003",
    "providerId": "STF-101",
    "date": "2026-08-25",
    "time": "12:00 AM",
    "type": "Consultation",
    "status": "Completed",
    "notes": "Generated appointment reason."
  },
  {
    "id": "APT-1004",
    "patientId": "PT-0004",
    "providerId": "STF-101",
    "date": "2026-08-25",
    "time": "13:00 AM",
    "type": "Routine Checkup",
    "status": "Completed",
    "notes": "Generated appointment reason."
  },
  {
    "id": "APT-1005",
    "patientId": "PT-0005",
    "providerId": "STF-103",
    "date": "2026-08-25",
    "time": "14:00 AM",
    "type": "Consultation",
    "status": "Completed",
    "notes": "Generated appointment reason."
  },
  {
    "id": "APT-1006",
    "patientId": "PT-0006",
    "providerId": "STF-101",
    "date": "2026-08-28",
    "time": "15:00 AM",
    "type": "Consultation",
    "status": "Checked In",
    "notes": "Generated appointment reason."
  },
  {
    "id": "APT-1007",
    "patientId": "PT-0007",
    "providerId": "STF-103",
    "date": "2026-08-28",
    "time": "10:00 AM",
    "type": "Follow-up",
    "status": "Checked In",
    "notes": "Generated appointment reason."
  },
  {
    "id": "APT-1008",
    "patientId": "PT-0008",
    "providerId": "STF-103",
    "date": "2026-08-28",
    "time": "11:00 AM",
    "type": "Consultation",
    "status": "Checked In",
    "notes": "Generated appointment reason."
  },
  {
    "id": "APT-1009",
    "patientId": "PT-0009",
    "providerId": "STF-101",
    "date": "2026-08-28",
    "time": "12:00 AM",
    "type": "Consultation",
    "status": "Scheduled",
    "notes": "Generated appointment reason."
  },
  {
    "id": "APT-1010",
    "patientId": "PT-0010",
    "providerId": "STF-101",
    "date": "2026-08-28",
    "time": "13:00 AM",
    "type": "Consultation",
    "status": "Checked In",
    "notes": "Generated appointment reason."
  },
  {
    "id": "APT-1011",
    "patientId": "PT-0011",
    "providerId": "STF-102",
    "date": "2026-08-30",
    "time": "14:00 AM",
    "type": "Follow-up",
    "status": "Scheduled",
    "notes": "Generated appointment reason."
  },
  {
    "id": "APT-1012",
    "patientId": "PT-0012",
    "providerId": "STF-102",
    "date": "2026-08-30",
    "time": "15:00 AM",
    "type": "Follow-up",
    "status": "Scheduled",
    "notes": "Generated appointment reason."
  },
  {
    "id": "APT-1013",
    "patientId": "PT-0013",
    "providerId": "STF-102",
    "date": "2026-08-30",
    "time": "10:00 AM",
    "type": "Surgery",
    "status": "Scheduled",
    "notes": "Generated appointment reason."
  },
  {
    "id": "APT-1014",
    "patientId": "PT-0014",
    "providerId": "STF-103",
    "date": "2026-08-30",
    "time": "11:00 AM",
    "type": "Consultation",
    "status": "Scheduled",
    "notes": "Generated appointment reason."
  },
  {
    "id": "APT-1015",
    "patientId": "PT-0015",
    "providerId": "STF-103",
    "date": "2026-08-30",
    "time": "12:00 AM",
    "type": "Surgery",
    "status": "Scheduled",
    "notes": "Generated appointment reason."
  }
];
