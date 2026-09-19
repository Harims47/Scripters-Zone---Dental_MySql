export interface Medicine {
  id: string;
  name: string;
  genericName?: string;
  categoryId: string;
  category?: {
    id: string;
    name: string;
    status: 'Active' | 'Inactive';
    description?: string | null;
  };
  form: 'Tablet' | 'Capsule' | 'Syrup' | 'Injection' | 'Ointment' | 'Liquid' | 'Mouthwash' | 'Other' | 'Material' | 'Dental Material' | 'Consumable' | 'Instrument / Tool' | 'Disposable' | 'Equipment' | string;
  unit: string;
  stockWarningLevel: number;
  currentStock: number;
  unitPrice: number;
  status?: 'Active' | 'Inactive';
  _count?: {
    prescriptionItems?: number;
    dispensingItems?: number;
    purchaseOrderItems?: number;
    stockMovements?: number;
  };
}

export const DEMO_MEDICINES: Medicine[] = [
  { id: 'MED-001', name: 'Amoxicillin 500mg', categoryId: 'cat1', currentStock: 150, stockWarningLevel: 50, unit: 'Tablets', form: 'Tablet', unitPrice: 15 },
  { id: 'MED-002', name: 'Ibuprofen 400mg', categoryId: 'cat2', currentStock: 200, stockWarningLevel: 100, unit: 'Tablets', form: 'Tablet', unitPrice: 8 },
  { id: 'MED-003', name: 'Lidocaine 2%', categoryId: 'cat3', currentStock: 45, stockWarningLevel: 20, unit: 'Vials', form: 'Injection', unitPrice: 120 },
  { id: 'MED-004', name: 'Chlorhexidine', categoryId: 'cat4', currentStock: 30, stockWarningLevel: 15, unit: 'Bottles', form: 'Mouthwash', unitPrice: 85 },
  { id: 'MED-005', name: 'Paracetamol 500mg', categoryId: 'cat2', currentStock: 300, stockWarningLevel: 100, unit: 'Tablets', form: 'Tablet', unitPrice: 5 },
  { id: 'MED-006', name: 'Diclofenac Gel', categoryId: 'cat2', currentStock: 25, stockWarningLevel: 10, unit: 'Tubes', form: 'Ointment', unitPrice: 45 },
];
