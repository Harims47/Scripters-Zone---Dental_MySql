import { prisma } from './src/db';
import { NotificationService } from './src/services/communication/NotificationService';
import { ChannelRouter } from './src/services/communication/ChannelRouter';
import fs from 'fs';
import path from 'path';

async function main() {
  console.log('===========================================================');
  console.log('🧪 VERIFYING WHATSAPP UI INTERACTIONS & SECURITY CONTRACTS');
  console.log('===========================================================');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    if (condition) {
      console.log(`✅ [PASS] ${testName}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${testName}: ${detail || 'Condition false'}`);
      failed++;
    }
  }

  // Check 1: Invariant - No new communication hub or /communication route
  const appTsx = fs.readFileSync(path.join(__dirname, '../src/App.tsx'), 'utf8');
  assert(!appTsx.includes('CommunicationPage') && !appTsx.includes('/communication'), 'Check 1: No /communication route or CommunicationPage added to App.tsx');

  const pagesDir = fs.readdirSync(path.join(__dirname, '../src/pages'));
  assert(!pagesDir.includes('CommunicationPage.tsx') && !pagesDir.includes('CommunicationHub.tsx'), 'Check 2: No CommunicationPage.tsx file created');

  // Check 3: WhatsAppActionButton component exists and uses existing Dialog & toast
  const componentPath = path.join(__dirname, '../src/components/communication/WhatsAppActionButton.tsx');
  assert(fs.existsSync(componentPath), 'Check 3: WhatsAppActionButton.tsx exists');
  const componentContent = fs.readFileSync(componentPath, 'utf8');
  assert(componentContent.includes('../ui/dialog') && componentContent.includes('react-hot-toast'), 'Check 4: Component uses existing Dialog and toast system');
  assert(componentContent.includes('isSending') && componentContent.includes('disabled={isSending'), 'Check 5: Component prevents double-clicks with isSending guard');
  assert(componentContent.includes('WhatsApp message queued'), 'Check 6: Accurate backend queue semantics ("WhatsApp message queued")');
  assert(!componentContent.includes('AiSensy') && !componentContent.includes('MSG91') && !componentContent.includes('Brevo'), 'Check 7: Zero provider internals exposed in UI component');

  // Check 8: Preference Override behavior - does not modify patient DB preference
  let patient = await prisma.patient.findFirst({
    where: { preferredCommunicationChannel: 'SMS' }
  });
  if (!patient) {
    patient = await prisma.patient.create({
      data: {
        name: 'SMS Preferred Patient',
        phone: '+919876543333',
        age: 35,
        gender: 'Female',
        preferredCommunicationChannel: 'SMS',
      }
    });
  }

  const initialPref = patient.preferredCommunicationChannel;
  // Send manual override
  const result = await NotificationService.requestNotification(
    {
      type: 'APPOINTMENT_CONFIRMATION',
      channel: 'WHATSAPP', // explicit manual override
      patientId: patient.id,
      recipientPhone: patient.phone,
      isManualSend: true,
      variables: { doctorName: 'Dr. Test', date: 'Tomorrow', time: '10:00 AM' }
    },
    { role: 'Head Doctor', userId: 'test-doctor' }
  );

  assert(result.status === 'QUEUED', 'Check 8: Explicit WhatsApp manual override successfully queues notification');

  // Verify saved patient preference in database was NOT changed
  const refreshedPatient = await prisma.patient.findUnique({ where: { id: patient.id } });
  assert(refreshedPatient?.preferredCommunicationChannel === initialPref, 'Check 9: Patient preference remains strictly unchanged in database');

  // Check 10: PaymentOwner Security - Receptionist cannot send doctor-owned payment receipt
  try {
    await NotificationService.requestNotification(
      {
        type: 'PAYMENT_RECEIPT',
        channel: 'WHATSAPP',
        entityType: 'VISIT',
        entityId: 'dummy-doctor-visit',
        paymentOwner: 'DOCTOR',
        recipientPhone: '+919876543333',
        isManualSend: true,
      },
      { role: 'Receptionist', userId: 'reception-user' }
    );
    assert(false, 'Check 10: Receptionist sending doctor-owned receipt should be rejected');
  } catch (err: any) {
    assert(err.message.includes('restricted from Reception') || err.message.includes('Unauthorized'), 'Check 10: Receptionist rejected from sending doctor-owned payment receipt');
  }

  // Check 11: Doctor can send doctor-owned payment receipt
  const doctorSend = await NotificationService.requestNotification(
    {
      type: 'PAYMENT_RECEIPT',
      channel: 'WHATSAPP',
      entityType: 'VISIT',
      entityId: `doc_visit_${Date.now()}`,
      paymentOwner: 'DOCTOR',
      recipientPhone: '+919876543333',
      isManualSend: true,
      variables: { amount: 500, invoiceNumber: 'INV-101' }
    },
    { role: 'Doctor', userId: 'doc-user' }
  );
  assert(doctorSend.status === 'QUEUED', 'Check 11: Doctor authorized to send doctor-owned payment receipt');

  // Check 12: Appointment state purpose mapping in AppointmentsPage
  const aptsContent = fs.readFileSync(path.join(__dirname, '../src/pages/AppointmentsPage.tsx'), 'utf8');
  assert(aptsContent.includes('APPOINTMENT_REMINDER') && aptsContent.includes('APPOINTMENT_CONFIRMATION'), 'Check 12: AppointmentsPage distinguishes confirmation vs reminder by appointment state');

  console.log('===========================================================');
  console.log(`🏁 VERIFICATION RESULTS: ${passed} PASSED | ${failed} FAILED`);
  console.log('===========================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
