async function checkApi() {
  // 1. Login as receptionist
  const loginRes = await fetch('http://localhost:3001/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'receptionist', password: 'demo123' })
  });
  const cookie = loginRes.headers.get('set-cookie') || '';
  const loginData = await loginRes.json();
  console.log('Login status:', loginRes.status, 'User:', loginData.user?.username);

  // 2. Fetch /api/patients
  const patRes = await fetch('http://localhost:3001/api/patients', {
    headers: { 'Cookie': cookie }
  });
  const patData = await patRes.json();
  console.log('\n--- /api/patients ---');
  console.log('Total records:', patData.meta?.totalRecords);
  console.log('Returned count:', patData.data?.length);
  console.log('Patient names returned:', patData.data?.map((p: any) => p.name));

  // 3. Fetch /api/queue
  const queueRes = await fetch('http://localhost:3001/api/queue', {
    headers: { 'Cookie': cookie }
  });
  const queueData = await queueRes.json();
  console.log('\n--- /api/queue ---');
  console.log('Queue entries returned:', queueData.length);
  for (const q of queueData) {
    console.log({
      id: q.id,
      patientId: q.patientId,
      visitId: q.visitId,
      visitPatient: q.visit?.patient?.name,
      patientInPatData: patData.data?.some((p: any) => p.id === q.patientId)
    });
  }

  // 4. Fetch /api/visits
  const visitsRes = await fetch('http://localhost:3001/api/visits', {
    headers: { 'Cookie': cookie }
  });
  const visitsData = await visitsRes.json();
  console.log('\n--- /api/visits ---');
  console.log('Visits returned:', visitsData.length);
  for (const v of visitsData) {
    console.log({
      id: v.id,
      patientId: v.patientId,
      patientName: v.patient?.name || 'NO PATIENT FIELD ON VISIT',
      patientInPatData: patData.data?.some((p: any) => p.id === v.patientId)
    });
  }
}

checkApi().catch(console.error);
