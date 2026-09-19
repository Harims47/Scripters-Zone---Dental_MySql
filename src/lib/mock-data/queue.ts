
export interface QueueEntry {
  id: string;
  queueNumber: string;
  patientId: string;
  visitId: string;
  arrivalTime: string;
  waitTimeMin: number;
  doctorId: string;
  status: 'Waiting' | 'With Doctor' | 'Completed' | 'Cancelled';
  priority: 'Normal' | 'Urgent';
}
export const DEMO_QUEUE: QueueEntry[] = [
  {
    "id": "Q-001",
    "queueNumber": "01",
    "patientId": "PT-0006",
    "visitId": "VIS-1000",
    "arrivalTime": "9:0 AM",
    "waitTimeMin": 12,
    "doctorId": "STF-101",
    "status": "Waiting",
    "priority": "Normal"
  },
  {
    "id": "Q-002",
    "queueNumber": "02",
    "patientId": "PT-0007",
    "visitId": "VIS-1001",
    "arrivalTime": "10:15 AM",
    "waitTimeMin": 4,
    "doctorId": "STF-103",
    "status": "Waiting",
    "priority": "Normal"
  },
  {
    "id": "Q-003",
    "queueNumber": "03",
    "patientId": "PT-0008",
    "visitId": "VIS-1002",
    "arrivalTime": "11:30 AM",
    "waitTimeMin": 9,
    "doctorId": "STF-103",
    "status": "Waiting",
    "priority": "Normal"
  },
  {
    "id": "Q-004",
    "queueNumber": "04",
    "patientId": "PT-0010",
    "visitId": "VIS-1003",
    "arrivalTime": "9:45 AM",
    "waitTimeMin": 16,
    "doctorId": "STF-101",
    "status": "With Doctor",
    "priority": "Normal"
  }
];
