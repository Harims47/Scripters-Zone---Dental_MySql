
export interface Patient {
  id: string;
  name: string;
  phone: string;
  age: number;
  gender: 'Male' | 'Female' | 'Other';
  lastVisit?: string;
  status: 'Active' | 'Inactive';
}
export const DEMO_PATIENTS: Patient[] = [
  {
    "id": "PT-0001",
    "name": "Sarah Lopez",
    "phone": "+91 9544542690",
    "age": 54,
    "gender": "Female",
    "status": "Active"
  },
  {
    "id": "PT-0002",
    "name": "Sarah Davis",
    "phone": "+91 9236176138",
    "age": 30,
    "gender": "Male",
    "status": "Active"
  },
  {
    "id": "PT-0003",
    "name": "Robert Miller",
    "phone": "+91 9869814766",
    "age": 52,
    "gender": "Female",
    "status": "Active"
  },
  {
    "id": "PT-0004",
    "name": "Charles Brown",
    "phone": "+91 9971321415",
    "age": 47,
    "gender": "Female",
    "status": "Active"
  },
  {
    "id": "PT-0005",
    "name": "Sarah Johnson",
    "phone": "+91 9714400773",
    "age": 70,
    "gender": "Male",
    "status": "Active"
  },
  {
    "id": "PT-0006",
    "name": "Elizabeth Smith",
    "phone": "+91 9733167278",
    "age": 57,
    "gender": "Female",
    "status": "Active"
  },
  {
    "id": "PT-0007",
    "name": "Sarah Garcia",
    "phone": "+91 9616634659",
    "age": 52,
    "gender": "Female",
    "status": "Active"
  },
  {
    "id": "PT-0008",
    "name": "David Johnson",
    "phone": "+91 9340939952",
    "age": 46,
    "gender": "Male",
    "status": "Active"
  },
  {
    "id": "PT-0009",
    "name": "Karen Lopez",
    "phone": "+91 9377651037",
    "age": 71,
    "gender": "Female",
    "status": "Active"
  },
  {
    "id": "PT-0010",
    "name": "John Lopez",
    "phone": "+91 9351174383",
    "age": 73,
    "gender": "Female",
    "status": "Active"
  },
  {
    "id": "PT-0011",
    "name": "William Lopez",
    "phone": "+91 9291650833",
    "age": 77,
    "gender": "Female",
    "status": "Active"
  },
  {
    "id": "PT-0012",
    "name": "Mary Brown",
    "phone": "+91 9163655275",
    "age": 70,
    "gender": "Male",
    "status": "Active"
  },
  {
    "id": "PT-0013",
    "name": "Patricia Jones",
    "phone": "+91 9559286512",
    "age": 56,
    "gender": "Female",
    "status": "Active"
  },
  {
    "id": "PT-0014",
    "name": "Robert Taylor",
    "phone": "+91 9204923934",
    "age": 69,
    "gender": "Male",
    "status": "Active"
  },
  {
    "id": "PT-0015",
    "name": "Mary Jones",
    "phone": "+91 9418690248",
    "age": 27,
    "gender": "Female",
    "status": "Active"
  },
  {
    "id": "PT-0016",
    "name": "Mary Taylor",
    "phone": "+91 9902761999",
    "age": 67,
    "gender": "Male",
    "status": "Active"
  },
  {
    "id": "PT-0017",
    "name": "Michael Johnson",
    "phone": "+91 9620727685",
    "age": 51,
    "gender": "Female",
    "status": "Active"
  },
  {
    "id": "PT-0018",
    "name": "Susan Taylor",
    "phone": "+91 9755168907",
    "age": 56,
    "gender": "Female",
    "status": "Active"
  },
  {
    "id": "PT-0019",
    "name": "John Rodriguez",
    "phone": "+91 9364139770",
    "age": 65,
    "gender": "Female",
    "status": "Active"
  },
  {
    "id": "PT-0020",
    "name": "Sarah Hernandez",
    "phone": "+91 9861839062",
    "age": 48,
    "gender": "Female",
    "status": "Active"
  },
  {
    "id": "PT-0021",
    "name": "Sarah Moore",
    "phone": "+91 9789684663",
    "age": 35,
    "gender": "Female",
    "status": "Active"
  },
  {
    "id": "PT-0022",
    "name": "Thomas Johnson",
    "phone": "+91 9851193926",
    "age": 55,
    "gender": "Male",
    "status": "Active"
  },
  {
    "id": "PT-0023",
    "name": "Mary Davis",
    "phone": "+91 9173159540",
    "age": 49,
    "gender": "Female",
    "status": "Active"
  },
  {
    "id": "PT-0024",
    "name": "Elizabeth Hernandez",
    "phone": "+91 9864327982",
    "age": 31,
    "gender": "Male",
    "status": "Active"
  },
  {
    "id": "PT-0025",
    "name": "Mary Martinez",
    "phone": "+91 9999809629",
    "age": 76,
    "gender": "Male",
    "status": "Active"
  },
  {
    "id": "PT-0026",
    "name": "William Hernandez",
    "phone": "+91 9518221771",
    "age": 21,
    "gender": "Female",
    "status": "Inactive"
  },
  {
    "id": "PT-0027",
    "name": "Karen Jones",
    "phone": "+91 9682163636",
    "age": 44,
    "gender": "Female",
    "status": "Active"
  },
  {
    "id": "PT-0028",
    "name": "David Rodriguez",
    "phone": "+91 9724026517",
    "age": 31,
    "gender": "Male",
    "status": "Active"
  },
  {
    "id": "PT-0029",
    "name": "Barbara Jackson",
    "phone": "+91 9918506715",
    "age": 74,
    "gender": "Female",
    "status": "Active"
  },
  {
    "id": "PT-0030",
    "name": "Susan Gonzalez",
    "phone": "+91 9732214853",
    "age": 28,
    "gender": "Female",
    "status": "Active"
  }
];
