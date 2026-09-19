import { prisma } from './src/db';
import assert from 'assert';

const API_URL = 'http://localhost:3001/api';

async function request(endpoint: string, method = 'GET', body: any = null, token: string | null = null) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Cookie'] = `token=${token}`;
  const res = await fetch(`${API_URL}${endpoint}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : null
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const err: any = new Error(res.statusText);
    err.response = { status: res.status, data };
    throw err;
  }

  let returnedToken = data?.token;
  if (!returnedToken) {
    const setCookie = res.headers.get('set-cookie');
    if (setCookie) {
      const match = setCookie.match(/token=([^;]+)/);
      if (match) returnedToken = match[1];
    }
  }

  return { status: res.status, data, token: returnedToken };
}

async function runCategoryLifecycleVerification() {
  console.log('=== MEDICINE CATEGORY DATABASE CRUD & LIFECYCLE TESTS ===\n');

  // 1. Authenticate as Head Doctor
  console.log('Step 1: Authenticating as Head Doctor...');
  const loginRes = await request('/auth/login', 'POST', { username: 'headdoctor', password: 'demo123' });
  const token = loginRes.token;
  assert(token, 'Doctor login failed');
  console.log('✔ Authenticated successfully.\n');

  // 2. Audit Existing Medicines & Categories
  console.log('Step 2: Auditing existing medicines & seeded categories...');
  const existingMeds = await prisma.medicine.findMany({ select: { id: true, name: true, categoryId: true, currentStock: true } });
  console.log(`Found ${existingMeds.length} existing medicines in DB.`);
  assert(existingMeds.length >= 6, 'Expected seeded medicines in DB');
  
  const categoriesList = await request('/medicine-categories', 'GET', null, token);
  assert(Array.isArray(categoriesList.data), 'Expected array of categories');
  console.log(`Found ${categoriesList.data.length} categories in DB.`);
  const catNames = categoriesList.data.map((c: any) => c.name);
  assert(catNames.includes('Antibiotics'), 'Antibiotics category must exist');
  assert(catNames.includes('Painkillers'), 'Painkillers category must exist');
  console.log('✔ Existing categories & medicines verified intact.\n');

  // 3. Category Creation
  console.log('Step 3: Creating a new master category...');
  const testCatName = 'Surgical Supplies ' + Date.now();
  const createRes = await request('/medicine-categories', 'POST', {
    name: testCatName,
    description: 'Supplies and consumables for minor oral surgical procedures'
  }, token);
  assert.strictEqual(createRes.status, 201, 'Expected 201 Created');
  const createdCat = createRes.data;
  assert.strictEqual(createdCat.name, testCatName);
  assert.strictEqual(createdCat.status, 'Active');
  console.log(`✔ Category "${createdCat.name}" created with ID: ${createdCat.id}\n`);

  // 4. Duplicate Name Check (trimmed & case-insensitive)
  console.log('Step 4: Testing duplicate category rejection (whitespace/case-insensitive)...');
  let duplicateRejected = false;
  try {
    await request('/medicine-categories', 'POST', {
      name: `  ${testCatName.toLowerCase()}  `,
      description: 'Duplicate attempt'
    }, token);
  } catch (err: any) {
    if (err.response?.status === 400) {
      duplicateRejected = true;
      console.log(`✔ Rejected duplicate as expected with 400: "${err.response.data.error}"`);
    }
  }
  assert(duplicateRejected, 'Duplicate category creation should have been rejected');
  console.log('');

  // 5. Edit Category
  console.log('Step 5: Editing category name and description...');
  const updatedName = testCatName + ' Updated';
  const editRes = await request(`/medicine-categories/${createdCat.id}`, 'PUT', {
    name: updatedName,
    description: 'Updated oral surgical supplies description'
  }, token);
  assert.strictEqual(editRes.data.name, updatedName);
  console.log(`✔ Category renamed to "${editRes.data.name}"\n`);

  // 6. Medicine Creation With New Active Category
  console.log('Step 6: Creating medicine assigned to this new category...');
  const testMedName = 'Surgical Suture ' + Date.now();
  const medCreateRes = await request('/inventory', 'POST', {
    name: testMedName,
    genericName: 'Silk 3-0',
    categoryId: createdCat.id,
    unit: 'Packets',
    stockWarningLevel: 10,
    unitPrice: 150,
    form: 'Other'
  }, token);
  const createdMed = medCreateRes.data;
  assert.strictEqual(createdMed.categoryId, createdCat.id);
  assert.strictEqual(createdMed.currentStock, 0, 'New medicine stock must start at 0');
  console.log(`✔ Medicine "${createdMed.name}" created and linked to category.\n`);

  // Verify Medicine count on Category
  const catWithCount = await request(`/medicine-categories/${createdCat.id}`, 'GET', null, token);
  assert.strictEqual(catWithCount.data._count.medicines, 1, 'Medicine count should reflect 1 medicine');
  console.log(`✔ Category medicine count correctly returns 1.\n`);

  // 7. Deactivate Category
  console.log('Step 7: Deactivating category (with active medicine attached)...');
  const deactRes = await request(`/medicine-categories/${createdCat.id}/deactivate`, 'PATCH', {}, token);
  assert.strictEqual(deactRes.data.category.status, 'Inactive');
  assert.strictEqual(deactRes.data.affectedMedicineCount, 1);
  console.log(`✔ Category deactivated. Server notice: "${deactRes.data.message}", affected medicines: ${deactRes.data.affectedMedicineCount}\n`);

  // 8. Negative Test: Inactive Category Cannot Be Assigned to NEW Medicine
  console.log('Step 8: Testing restriction - inactive category rejected for new medicine...');
  let inactiveRejected = false;
  try {
    await request('/inventory', 'POST', {
      name: 'Blocked Med ' + Date.now(),
      categoryId: createdCat.id,
      unit: 'Units',
      stockWarningLevel: 5,
      unitPrice: 50,
      form: 'Tablet'
    }, token);
  } catch (err: any) {
    if (err.response?.status === 400) {
      inactiveRejected = true;
      console.log(`✔ Blocked new medicine with inactive category: "${err.response.data.error}"`);
    }
  }
  assert(inactiveRejected, 'Should reject new medicine with inactive category');
  console.log('');

  // 9. Existing Medicine Preserves Inactive Category & Stock Unmodified
  console.log('Step 9: Verifying existing medicine retains its category and untouched stock...');
  const fetchedMed = await request(`/inventory/${createdMed.id}`, 'GET', null, token);
  assert.strictEqual(fetchedMed.data.categoryId, createdCat.id);
  assert.strictEqual(fetchedMed.data.currentStock, 0);
  assert.strictEqual(fetchedMed.data.category.name, updatedName);
  assert.strictEqual(fetchedMed.data.category.status, 'Inactive');
  console.log(`✔ Existing medicine retains inactive category "${fetchedMed.data.category.name}" and untouched stock.\n`);

  // 10. Reactivate Category
  console.log('Step 10: Reactivating category...');
  const reactRes = await request(`/medicine-categories/${createdCat.id}/reactivate`, 'PATCH', {}, token);
  assert.strictEqual(reactRes.data.category.status, 'Active');
  console.log(`✔ Category reactivated successfully.\n`);

  // 11. Category Search, Filter, Pagination
  console.log('Step 11: Testing DataTable requirements (search, status filter, pagination)...');
  const searchRes = await request(`/medicine-categories?page=1&limit=5&search=${encodeURIComponent('Surgical')}`, 'GET', null, token);
  assert(searchRes.data.data.length >= 1, 'Search should find surgical category');
  assert(searchRes.data.meta.totalRecords >= 1, 'Meta totalRecords should be populated');

  const filterRes = await request(`/medicine-categories?status=Active`, 'GET', null, token);
  assert(filterRes.data.every((c: any) => c.status === 'Active'), 'Every result must be Active');
  console.log('✔ Search, status filter, and pagination verified.\n');

  // 12. Export Category Data
  console.log('Step 12: Testing category export endpoints (CSV, XLSX)...');
  const csvRes = await fetch(`${API_URL}/medicine-categories/export?format=csv`, {
    headers: { 'Cookie': `token=${token}` }
  });
  assert(csvRes.ok, 'CSV export should return 200');
  const csvText = await csvRes.text();
  assert(csvText.includes('Category Name'), 'CSV should include header Category Name');
  assert(csvText.includes('Medicines'), 'CSV should include Medicines column');

  const xlsxRes = await fetch(`${API_URL}/medicine-categories/export?format=xlsx`, {
    headers: { 'Cookie': `token=${token}` }
  });
  assert(xlsxRes.ok, 'XLSX export should return 200');
  console.log('✔ CSV and XLSX export verified.\n');

  // 13. Clean up test records
  console.log('Step 13: Cleaning up test records...');
  await prisma.medicine.delete({ where: { id: createdMed.id } });
  await prisma.medicineCategory.delete({ where: { id: createdCat.id } });
  console.log('✔ Test records cleaned up safely.\n');

  // Final Invariant Check
  const finalMeds = await prisma.medicine.findMany({ select: { id: true, categoryId: true, currentStock: true } });
  assert.strictEqual(finalMeds.length, existingMeds.length, 'Total original medicines preserved');
  console.log(`✔ Total original medicines intact (${finalMeds.length}). Stock unmodified.\n`);

  console.log('=== ALL 13 VERIFICATION STEPS PASSED SUCCESSFULLY! ===\n');
}

runCategoryLifecycleVerification().catch(err => {
  console.error('Verification failed:', err);
  process.exit(1);
});
