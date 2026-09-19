import { test, expect } from '@playwright/test';

test.describe('Round 2: Inventory, Goods Receiving & Medicine Lifecycle Integrity', () => {

  test('INV-1: Purchase Order Lifecycle & Partial Goods Receiving with StockAudit', async ({ request }) => {
    // 1. Authenticate as Head Doctor
    await request.post('http://localhost:3001/api/auth/login', {
      data: { username: 'headdoctor', password: 'demo123' }
    });

    // 2. Fetch suppliers and medicines
    const supRes = await request.get('http://localhost:3001/api/suppliers');
    const suppliers = (await supRes.json()).data || (await supRes.json());
    const supplierId = suppliers[0].id;

    const medRes = await request.get('http://localhost:3001/api/inventory');
    const medicines = (await medRes.json()).data;
    const testMed = medicines.find((m: any) => m.status === 'Active') || medicines[0];

    const initialStock = testMed.currentStock;

    // 3. Create PO with 20 units @ ₹50 each (Total: ₹1,000)
    const createRes = await request.post('http://localhost:3001/api/purchase-orders', {
      data: {
        supplierId,
        orderDate: new Date().toISOString().split('T')[0],
        notes: 'QA PO Lifecycle Test',
        items: [
          {
            medicineId: testMed.id,
            orderedQuantity: 20,
            unitCost: 50
          }
        ]
      }
    });
    expect(createRes.status()).toBe(201);
    const po = await createRes.json();
    expect(po.status).toBe('Draft');
    const calculatedTotal = po.items.reduce((sum: number, i: any) => sum + (i.orderedQuantity * i.unitCost), 0);
    expect(calculatedTotal).toBe(1000);

    const poItemId = po.items[0].id;

    // 4. Transition Draft -> Ordered
    const orderRes = await request.patch(`http://localhost:3001/api/purchase-orders/${po.id}/status`, {
      data: { status: 'Ordered' }
    });
    expect(orderRes.status()).toBe(200);
    const orderedPo = await orderRes.json();
    expect(orderedPo.status).toBe('Ordered');

    // 5. Partial Receiving: Receive 8 units out of 20
    const receivePartRes = await request.post(`http://localhost:3001/api/purchase-orders/${po.id}/receive`, {
      data: {
        items: [
          {
            itemId: poItemId,
            receiveQuantity: 8
          }
        ]
      }
    });
    expect(receivePartRes.status()).toBe(200);
    const partPo = (await receivePartRes.json()).data.purchaseOrder;
    expect(partPo.status).toBe('Partially Received');
    expect(partPo.items[0].receivedQuantity).toBe(8);

    // Verify stock increased by exactly 8
    const medAfterPart = await request.get(`http://localhost:3001/api/inventory/${testMed.id}`);
    const medData1 = await medAfterPart.json();
    expect(medData1.currentStock).toBe(initialStock + 8);

    // 6. Over-Receiving Attempt: Try to receive 15 units (Remaining is 12) -> MUST BE REJECTED
    const overReceiveRes = await request.post(`http://localhost:3001/api/purchase-orders/${po.id}/receive`, {
      data: {
        items: [
          {
            itemId: poItemId,
            receiveQuantity: 15
          }
        ]
      }
    });
    expect(overReceiveRes.status()).toBe(400);

    // Verify stock did NOT change after rejected over-receive
    const medAfterReject = await request.get(`http://localhost:3001/api/inventory/${testMed.id}`);
    expect((await medAfterReject.json()).currentStock).toBe(initialStock + 8);

    // 7. Receive remaining 12 units
    const receiveFinalRes = await request.post(`http://localhost:3001/api/purchase-orders/${po.id}/receive`, {
      data: {
        items: [
          {
            itemId: poItemId,
            receiveQuantity: 12
          }
        ]
      }
    });
    expect(receiveFinalRes.status()).toBe(200);
    const finalPo = (await receiveFinalRes.json()).data.purchaseOrder;
    expect(finalPo.status).toBe('Received');
    expect(finalPo.items[0].receivedQuantity).toBe(20);

    // Verify final stock increased by total of 20
    const medAfterFinal = await request.get(`http://localhost:3001/api/inventory/${testMed.id}`);
    expect((await medAfterFinal.json()).currentStock).toBe(initialStock + 20);

    // 8. Attempt receiving on already 'Received' PO -> MUST BE REJECTED
    const receiveOnDoneRes = await request.post(`http://localhost:3001/api/purchase-orders/${po.id}/receive`, {
      data: {
        items: [
          {
            itemId: poItemId,
            receiveQuantity: 1
          }
        ]
      }
    });
    expect(receiveOnDoneRes.status()).toBe(400);
  });

  test('INV-2: Stock Warning Level & Low-Stock Boundary Conditions', async ({ request }) => {
    // 1. Authenticate as Head Doctor
    await request.post('http://localhost:3001/api/auth/login', {
      data: { username: 'headdoctor', password: 'demo123' }
    });

    const catRes = await request.get('http://localhost:3001/api/medicine-categories');
    const categories = (await catRes.json()).data || (await catRes.json());
    const categoryId = categories[0].id;

    // Create a dedicated QA medicine with stock = 0, warning level = 10
    const medRes = await request.post('http://localhost:3001/api/inventory', {
      data: {
        name: `QA-Boundary-Med-${Date.now()}`,
        genericName: 'QA Test Generic',
        categoryId,
        form: 'Tablet',
        unit: 'Strip',
        stockWarningLevel: 10,
        unitPrice: 25
      }
    });
    expect(medRes.status()).toBe(201);
    const newMed = await medRes.json();
    expect(newMed.currentStock).toBe(0); // Starts at 0 per requirements

    // Stock starts at 0, warning level 10 -> Must appear in low-stock alerts
    const alertsRes = await request.get('http://localhost:3001/api/inventory/low-stock-alerts');
    expect(alertsRes.status()).toBe(200);
    const alerts = (await alertsRes.json()).data || (await alertsRes.json());
    const hasMed = alerts.some((a: any) => a.id === newMed.id || a.name === newMed.name);
    expect(hasMed).toBe(true);

    // Deactivate medicine -> Verify inactive medicine does NOT appear in active low-stock alerts
    const deactRes = await request.patch(`http://localhost:3001/api/inventory/${newMed.id}/deactivate`);
    expect(deactRes.status()).toBe(200);

    const alertsAfterDeact = await request.get('http://localhost:3001/api/inventory/low-stock-alerts');
    expect(alertsAfterDeact.status()).toBe(200);
    const alerts2 = (await alertsAfterDeact.json()).data || (await alertsAfterDeact.json());
    const hasMed2 = alerts2.some((a: any) => (a.id === newMed.id || a.name === newMed.name) && a.status === 'Active');
    expect(hasMed2).toBe(false);

    // Reactivate medicine
    const reactRes = await request.patch(`http://localhost:3001/api/inventory/${newMed.id}/reactivate`);
    expect(reactRes.status()).toBe(200);
  });

  test('INV-3: Medicine Deletion Safety Invariants (Stock > 0 and Historical Dependencies)', async ({ request }) => {
    // 1. Authenticate as Head Doctor
    await request.post('http://localhost:3001/api/auth/login', {
      data: { username: 'headdoctor', password: 'demo123' }
    });

    const catRes = await request.get('http://localhost:3001/api/medicine-categories');
    const categories = (await catRes.json()).data || (await catRes.json());
    const categoryId = categories[0].id;

    // Create a new medicine
    const medRes = await request.post('http://localhost:3001/api/inventory', {
      data: {
        name: `QA-DeleteSafety-${Date.now()}`,
        genericName: 'Safety Check',
        categoryId,
        form: 'Syrup',
        unit: 'Bottle',
        stockWarningLevel: 5,
        unitPrice: 50
      }
    });
    const med = await medRes.json();

    // Adjust stock to 10
    const adjRes = await request.patch(`http://localhost:3001/api/inventory/${med.id}/adjust`, {
      data: {
        quantity: 10,
        type: 'ADD',
        reason: 'Initial test stock'
      }
    });
    expect(adjRes.status()).toBe(200);

    // CASE 1: Attempt to delete medicine when currentStock > 0 -> MUST BE REJECTED with 400
    const delStockRes = await request.delete(`http://localhost:3001/api/inventory/${med.id}`);
    expect(delStockRes.status()).toBe(400);

    // Adjust stock back to 0
    const zeroAdjRes = await request.patch(`http://localhost:3001/api/inventory/${med.id}/adjust`, {
      data: {
        quantity: 10,
        type: 'SUBTRACT',
        reason: 'Zero out stock for test'
      }
    });
    expect(zeroAdjRes.status()).toBe(200);

    // CASE 3: Attempt to delete when currentStock = 0 but historical StockMovement exists -> MUST BE REJECTED with 409
    const delDepRes = await request.delete(`http://localhost:3001/api/inventory/${med.id}`);
    expect(delDepRes.status()).toBe(409);
    const depJson = await delDepRes.json();
    expect(depJson.error).toContain('stock movement');
  });

});
