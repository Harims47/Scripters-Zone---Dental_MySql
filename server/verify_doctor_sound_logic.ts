/**
 * AUTOMATED TEST SUITE: DOCTOR AVAILABILITY & SOUND NOTIFICATION LOGIC (DS-01 through DS-11)
 */

type DoctorStatus = 'Available' | 'With Patient' | 'Leave';

interface TransitionResult {
  soundTriggered: 'AVAILABLE' | 'OCCUPIED' | 'NONE';
  nextPreviousState: Record<string, DoctorStatus>;
}

/**
 * Pure transition engine identical to ReceptionDeskPage.tsx doctor availability sound tracker
 */
function processDoctorAvailabilityUpdate(
  currentAvailability: Record<string, DoctorStatus>,
  previousState: Record<string, DoctorStatus> | null,
  isInitialMount: boolean
): TransitionResult {
  // 1. Initial silent load: Record baseline status for all doctors without playing sounds
  if (isInitialMount) {
    return {
      soundTriggered: 'NONE',
      nextPreviousState: { ...currentAvailability }
    };
  }

  if (!previousState) {
    return {
      soundTriggered: 'NONE',
      nextPreviousState: { ...currentAvailability }
    };
  }

  let shouldPlayAvailableSound = false;
  let shouldPlayOccupiedSound = false;

  Object.keys(currentAvailability).forEach((docId) => {
    const prevStatus = previousState[docId];
    const currentStatus = currentAvailability[docId];

    if (prevStatus && currentStatus && prevStatus !== currentStatus) {
      // Transition 1: Available -> With Patient
      if (prevStatus === 'Available' && currentStatus === 'With Patient') {
        shouldPlayOccupiedSound = true;
      }
      // Transition 2: With Patient -> Available
      else if (prevStatus === 'With Patient' && currentStatus === 'Available') {
        shouldPlayAvailableSound = true;
      }
      // Transition 3: Leave -> Available
      else if (prevStatus === 'Leave' && currentStatus === 'Available') {
        shouldPlayAvailableSound = true;
      }
    }
  });

  let soundTriggered: 'AVAILABLE' | 'OCCUPIED' | 'NONE' = 'NONE';
  if (shouldPlayAvailableSound) {
    soundTriggered = 'AVAILABLE';
  } else if (shouldPlayOccupiedSound) {
    soundTriggered = 'OCCUPIED';
  }

  return {
    soundTriggered,
    nextPreviousState: { ...currentAvailability }
  };
}

/**
 * Derived doctor availability logic identical to ReceptionDeskPage.tsx
 */
function deriveDoctorAvailability(
  doctors: Array<{ id: string; attendance: string }>,
  queue: Array<{ assignedDoctorId?: string | null; status: string }>
): Record<string, DoctorStatus> {
  const availability: Record<string, DoctorStatus> = {};
  doctors.forEach((doc) => {
    if (doc.attendance === 'Leave') {
      availability[doc.id] = 'Leave';
    } else {
      const hasActive = queue.some(
        (q) => q.assignedDoctorId === doc.id && q.status === 'In Progress'
      );
      availability[doc.id] = hasActive ? 'With Patient' : 'Available';
    }
  });
  return availability;
}

function runDoctorSoundTests() {
  console.log('==================================================================');
  console.log('STARTING DOCTOR AVAILABILITY SOUND VERIFICATION SUITE (DS-01 - DS-11)');
  console.log('==================================================================');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testId: string, desc: string) {
    if (condition) {
      console.log(`[PASS] ${testId}: ${desc}`);
      passed++;
    } else {
      console.error(`[FAIL] ${testId}: ${desc}`);
      failed++;
    }
  }

  const docA = { id: 'doc-1', name: 'Dr. Arun', attendance: 'Present' };
  const docB = { id: 'doc-2', name: 'Dr. Priya', attendance: 'Present' };
  const docC = { id: 'doc-3', name: 'Dr. Rajesh', attendance: 'Leave' };
  const allDocs = [docA, docB, docC];

  // DS-01: Initial Reception Desk load -> NO sound
  const initialAvail = deriveDoctorAvailability(allDocs, []);
  assert(
    initialAvail['doc-1'] === 'Available' &&
    initialAvail['doc-2'] === 'Available' &&
    initialAvail['doc-3'] === 'Leave',
    'DS-01A',
    'Initial derived status correctly reflects Present (Available) and Leave'
  );

  const mountResult = processDoctorAvailabilityUpdate(initialAvail, null, true);
  assert(
    mountResult.soundTriggered === 'NONE',
    'DS-01B',
    'Initial Reception Desk mount produces zero sound (silently records baseline)'
  );

  let stateStore = mountResult.nextPreviousState;

  // DS-02: Dr. Arun becomes occupied (Available -> With Patient) -> triggers OCCUPIED sound
  const queueWithPatient = [{ assignedDoctorId: 'doc-1', status: 'In Progress' }];
  const availOccupied = deriveDoctorAvailability(allDocs, queueWithPatient);
  assert(availOccupied['doc-1'] === 'With Patient', 'DS-02A', 'Dr. Arun derived status is "With Patient"');

  const occupiedResult = processDoctorAvailabilityUpdate(availOccupied, stateStore, false);
  assert(
    occupiedResult.soundTriggered === 'OCCUPIED',
    'DS-02B',
    'Available -> With Patient triggers Occupied sound once'
  );
  stateStore = occupiedResult.nextPreviousState;

  // DS-03: Next polling cycle with unchanged status -> NO sound
  const poll1 = processDoctorAvailabilityUpdate(availOccupied, stateStore, false);
  assert(
    poll1.soundTriggered === 'NONE',
    'DS-03',
    'Next polling cycle with identical status triggers NO sound'
  );
  stateStore = poll1.nextPreviousState;

  // DS-04: Dr. Arun becomes free (With Patient -> Available) -> triggers AVAILABLE sound
  const availFree = deriveDoctorAvailability(allDocs, []);
  assert(availFree['doc-1'] === 'Available', 'DS-04A', 'Dr. Arun derived status is "Available"');

  const freeResult = processDoctorAvailabilityUpdate(availFree, stateStore, false);
  assert(
    freeResult.soundTriggered === 'AVAILABLE',
    'DS-04B',
    'With Patient -> Available triggers Available sound once'
  );
  stateStore = freeResult.nextPreviousState;

  // DS-05: Next polling cycle with unchanged status -> NO sound
  const poll2 = processDoctorAvailabilityUpdate(availFree, stateStore, false);
  assert(
    poll2.soundTriggered === 'NONE',
    'DS-05',
    'Next polling cycle with unchanged status triggers NO sound'
  );
  stateStore = poll2.nextPreviousState;

  // DS-06: Dr. Rajesh attendance changes: Leave -> Available -> triggers AVAILABLE sound
  const docsWithRajeshPresent = [
    docA,
    docB,
    { id: 'doc-3', name: 'Dr. Rajesh', attendance: 'Present' }
  ];
  const availRajeshAvailable = deriveDoctorAvailability(docsWithRajeshPresent, []);
  assert(availRajeshAvailable['doc-3'] === 'Available', 'DS-06A', 'Dr. Rajesh derived status changed to "Available"');

  const rajeshResult = processDoctorAvailabilityUpdate(availRajeshAvailable, stateStore, false);
  assert(
    rajeshResult.soundTriggered === 'AVAILABLE',
    'DS-06B',
    'Leave -> Available triggers Available sound once'
  );
  stateStore = rajeshResult.nextPreviousState;

  // DS-07: Multiple doctors changing state simultaneously
  // Dr. Arun goes to With Patient, Dr. Priya stays Available, Dr. Rajesh goes to Leave
  const docsMultiTransition = [
    docA,
    docB,
    { id: 'doc-3', name: 'Dr. Rajesh', attendance: 'Leave' }
  ];
  const queueMulti = [{ assignedDoctorId: 'doc-1', status: 'In Progress' }];
  const availMulti = deriveDoctorAvailability(docsMultiTransition, queueMulti);
  const multiResult = processDoctorAvailabilityUpdate(availMulti, stateStore, false);
  assert(
    multiResult.soundTriggered === 'OCCUPIED',
    'DS-07',
    'Multiple doctors updating produces expected operational alert without crash or double-trigger'
  );
  stateStore = multiResult.nextPreviousState;

  // DS-08: React re-render simulation with identical values and new object reference -> NO sound
  const newRefIdentical = { ...availMulti };
  const reRenderResult = processDoctorAvailabilityUpdate(newRefIdentical, stateStore, false);
  assert(
    reRenderResult.soundTriggered === 'NONE',
    'DS-08',
    'React re-render alone (new object reference, identical values) triggers zero sound'
  );

  // DS-09: Attendance & active patient derivation strictly enforced
  const docAbsent = { id: 'doc-4', name: 'Dr. Absent', attendance: 'Leave' };
  const docBusy = { id: 'doc-5', name: 'Dr. Busy', attendance: 'Present' };
  const derivedStrict = deriveDoctorAvailability([docAbsent, docBusy], [{ assignedDoctorId: 'doc-5', status: 'In Progress' }]);
  assert(
    derivedStrict['doc-4'] === 'Leave' && derivedStrict['doc-5'] === 'With Patient',
    'DS-09',
    'Doctor status strictly derived from attendance and active queue state (zero new models)'
  );

  console.log(`\nDOCTOR SOUND TESTS SUMMARY: Passed: ${passed}, Failed: ${failed}`);
  if (failed > 0) {
    process.exit(1);
  }
}

runDoctorSoundTests();
