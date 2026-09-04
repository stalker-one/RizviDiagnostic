const bcrypt = require('bcryptjs');
const { readTable, writeTable, generateId } = require('./db');

function seed() {
  // ---- Settings ----
  const defaultSettings = {
    clinicName: 'Rizvi Diagnostic Center',
    address: '547-A Jinnah Colony Faisalabad',
    phone1: '0320-2616216',
    phone2: '041-2616216',
    invoicePrefix: 'RDC',
    footerNote: 'Thank you for choosing Rizvi Diagnostic Center',
    printFormat: 'both', // thermal | simple | both
    discountEnabled: true,

    // ---- Logo ----
    logoUrl: '', // base64 data URI, set via Settings page upload
    logoWidth: 90, // px, applies to simple/A4 print + on-site display
    logoHeight: 90,
    thermalLogoWidth: 60, // px, thermal receipts are narrow (80mm) so logo is usually smaller
    thermalLogoHeight: 60,

    // ---- Thermal (80mm) print settings ----
    thermalShowLogo: true,
    thermalPaperWidth: 80, // mm
    thermalFontSize: 11, // px
    thermalFooterNote: 'Thank you for choosing Rizvi Diagnostic Center',
    thermalShowReferredBy: true,

    // ---- Simple (A4) print settings ----
    simpleShowLogo: true,
    simpleFooterNote: 'Thank you for choosing Rizvi Diagnostic Center',
    simpleShowReferredBy: true,
    simpleAccentColor: '#0a4a93',

    // ---- Staff data visibility ----
    // Staff always see only today's data with no way to filter by date or
    // view other days — that ability belongs to admin/superadmin only.
    staffReportRangeDays: 1,
    staffReportMaxEntries: 20,
    morningStartHour: 8,
    eveningStartHour: 14,

    // ---- Superadmin site kill-switch ----
    // When siteDisabled is true, every admin/staff session is locked out
    // (login and every API call) and shown siteDisabledMessage. Only the
    // superadmin can ever see or flip this — see routes/site.routes.js.
    siteDisabled: false,
    siteDisabledReason: null,
    siteDisabledMessage: null,
  };
  const settings = readTable('settings');
  const mergedSettings = { ...defaultSettings, ...settings };
  writeTable('settings', mergedSettings);
  console.log('✔ Settings up to date');

  // ---- Users ----
  const users = readTable('users');
  if (users.length === 0) {
    const superadminPass = bcrypt.hashSync('SuperAdmin@123', 10);
    const adminPass = bcrypt.hashSync('Admin@123', 10);
    const staffPass = bcrypt.hashSync('Staff@123', 10);
    writeTable('users', [
      {
        id: generateId('user'),
        name: 'Super Administrator',
        email: 'superadmin@rizvidiagnostic.com',
        phone: '0320-2616216',
        role: 'superadmin',
        password: superadminPass,
        active: true,
        // `permanent` accounts can never be deleted, deactivated, or have
        // their role changed by anyone (including another superadmin) — this
        // guarantees there is always at least one way back into the system.
        permanent: true,
        createdAt: new Date().toISOString(),
        lastSignedIn: null,
      },
      {
        id: generateId('user'),
        name: 'Administrator',
        email: 'admin@rizvidiagnostic.com',
        phone: '0320-2616216',
        role: 'admin',
        password: adminPass,
        active: true,
        permanent: false,
        createdAt: new Date().toISOString(),
        lastSignedIn: null,
      },
      {
        id: generateId('user'),
        name: 'Front Desk Staff',
        email: 'staff@rizvidiagnostic.com',
        phone: '0320-2616216',
        role: 'staff',
        password: staffPass,
        active: true,
        permanent: false,
        createdAt: new Date().toISOString(),
        lastSignedIn: null,
      },
    ]);
    console.log('✔ Users seeded (superadmin@rizvidiagnostic.com / SuperAdmin@123, admin@rizvidiagnostic.com / Admin@123, staff@rizvidiagnostic.com / Staff@123)');
  } else if (!users.some((u) => u.role === 'superadmin')) {
    // Upgrading an existing install that predates the superadmin role: add
    // the permanent superadmin account without touching existing users.
    const superadminPass = bcrypt.hashSync('SuperAdmin@123', 10);
    users.push({
      id: generateId('user'),
      name: 'Super Administrator',
      email: 'superadmin@rizvidiagnostic.com',
      phone: '',
      role: 'superadmin',
      password: superadminPass,
      active: true,
      permanent: true,
      createdAt: new Date().toISOString(),
      lastSignedIn: null,
    });
    writeTable('users', users);
    console.log('✔ Superadmin account added (superadmin@rizvidiagnostic.com / SuperAdmin@123) — please change this password after first login.');
  }

  // ---- Procedures ----
  {
    const procedures = readTable('procedures');
    const existingNames = new Set(procedures.map((p) => p.name.trim().toLowerCase()));
    
    // Complete procedure list from the Excel file
    const list = [
      // X-Ray procedures
      ['Abdomen Erect & Supine View', 2400, 'X-Ray'],
      ['Ankle Joint AP& Lateral Views', 1200, 'X-Ray'],
      ['Both Heel Lateral Views', 1200, 'X-Ray'],
      ['Both Knee Joint Only AP', 1200, 'X-Ray'],
      ['Both Knee Joints AP& Lateral Views', 2000, 'X-Ray'],
      ['Both Mastoid AP & Lateral View', 1200, 'X-Ray'],
      ['BOTH ORBIT AP& LAT VIEW', 1500, 'X-Ray'],
      ['Both T.M Joint Open and Cloesd Mouth', 1500, 'X-Ray'],
      ['Cervical Spine AP& Lateral Views', 1500, 'X-Ray'],
      ['Cervical Spine Only Lateral', 1200, 'X-Ray'],
      ['Chest AP View', 1200, 'X-Ray'],
      ['Chest Lateral View', 1200, 'X-Ray'],
      ['CHEST LAT VIEW', 1200, 'X-Ray'],
      ['Chest Oblique View', 1200, 'X-Ray'],
      ['Chest PA View', 1200, 'X-Ray'],
      ['Elbow Joint AP& Lateral View', 1200, 'X-Ray'],
      ['Femur Bone AP& Lateral Views', 2000, 'X-Ray'],
      ['Femur Bone Child AP & Lateral View', 1500, 'X-Ray'],
      ['Foot Ankle Joint AP& Lateral Views', 1200, 'X-Ray'],
      ['Foot AP Lat View', 1200, 'X-Ray'],
      ['Fore-Arm AP& Lateral View', 1200, 'X-Ray'],
      ['Hand AP& Lateral View', 1200, 'X-Ray'],
      ['Hip Joint AP& Lateral Views', 1500, 'X-Ray'],
      ['Humerus Bone AP& Lateral View', 1200, 'X-Ray'],
      ['KUB / Abdomen x-Ray', 1200, 'X-Ray'],
      ['Left Knee AP& Lateral Views', 1200, 'X-Ray'],
      ['Left Leg', 1200, 'X-Ray'],
      ['liver Abscess', 3000, 'X-Ray'],
      ['Lumbo Sacral Spine AP&Lateral Views', 2000, 'X-Ray'],
      ['Lumbo Sacral Spine Lateral Flexion and extension views', 2000, 'X-Ray'],
      ['Lumbo Sacral Spine Lateral Views', 1200, 'X-Ray'],
      ['Mandible AP& Lateral View', 1500, 'X-Ray'],
      ['Mendible x ray', 1200, 'X-Ray'],
      ['Nasal Bone AP & Lateral View', 1200, 'X-Ray'],
      ['Naso-Pharynx / Soft Tissue', 1200, 'X-Ray'],
      ['Orbit AP & Lateral View', 1500, 'X-Ray'],
      ['Pelvic with uterine sounds', 2000, 'X-Ray'],
      ['Pelvis / Both Hip Joint AP', 1200, 'X-Ray'],
      ['P.N.S', 1200, 'X-Ray'],
      ['Ribs', 1200, 'X-Ray'],
      ['Right Knee AP& Lateral Views', 1200, 'X-Ray'],
      ['Right leg', 1200, 'X-Ray'],
      ['Sacrum / Coccyx AP& Lateral Views', 1500, 'X-Ray'],
      ['Shoulder Joint AP', 1200, 'X-Ray'],
      ['Shoulder Joint AP & Lateral', 1500, 'X-Ray'],
      ['Skull AP& Lateral View', 1500, 'X-Ray'],
      ['S.M.V X-RAY', 1200, 'X-Ray'],
      ['Thoracic Spine AP& Lateral Views', 2000, 'X-Ray'],
      ['Thoracic Spine Lateral Views', 1200, 'X-Ray'],
      ['Thoracolumbar spine x-rays AP& Lat View', 2000, 'X-Ray'],
      ['Tibia / Fibula AP& Lateral Views', 1200, 'X-Ray'],
      ['T.M. Joint', 1200, 'X-Ray'],
      ['T.M Joint x rya', 1200, 'X-Ray'],
      ['Whole Spine Child', 1500, 'X-Ray'],
      ['Wrist Joint AP& Lateral View', 1200, 'X-Ray'],
      ['X- ray Pelvimetry', 1200, 'X-Ray'],

      // Ultrasound procedures
      ['Anomaly Scan', 2500, 'Ultrasound'],
      ['Carotid Doppler', 3000, 'Ultrasound'],
      ['Fetal Color Doppler Ultrasound', 3000, 'Ultrasound'],
      ['Lower Limb Doppler', 3000, 'Ultrasound'],
      ['OBS Ultrasound', 2000, 'Ultrasound'],
      ['Scrotal Doppler Ultrasound', 3000, 'Ultrasound'],
      ['Single Leg Ultrasound', 3000, 'Ultrasound'],
      ['T.V.S', 3000, 'Ultrasound'],
      ['Ultrasound Abdomen', 2000, 'Ultrasound'],
      ['Ultrasound Both Breast', 3000, 'Ultrasound'],
      ['Ultrasound Both Legs', 5000, 'Ultrasound'],
      ['Ultrasound Breast', 2000, 'Ultrasound'],
      ['Ultrasound early Pregnancy', 2000, 'Ultrasound'],
      ['Ultrasound KUB', 2000, 'Ultrasound'],
      ['Ultrasound Neck Thyroid', 2500, 'Ultrasound'],
      ['Ultrasound Pelvis', 2000, 'Ultrasound'],
      ['Umbilical Color Doppler', 3000, 'Ultrasound'],
      ['Upper limb usg doppler', 3000, 'Ultrasound'],

      // Procedure / Interventional
      ['Ascitic Tap', 3500, 'Procedure'],
      ['Barium Anema', 7000, 'Procedure'],
      ['Barium Meal', 7000, 'Procedure'],
      ['Barium Swallow', 7000, 'Procedure'],
      ['H.S.G Hysterosalpingogram', 10000, 'Procedure'],
      ['I.V.U/ IVP With Contrast', 10000, 'Procedure'],
      ['I.V.U/ IVP Without Contrast', 7000, 'Procedure'],
      ['Loopogram Cologram', 6000, 'Procedure'],
      ['M.C.U.G with Contrast', 10000, 'Procedure'],
      ['M.C.U.G withOut Contrast', 7000, 'Procedure'],
      ['Pleural Tap', 3500, 'Procedure'],
      ['Retrograde Urethrogram with Contrast', 10000, 'Procedure'],
      ['Retrograde Urethrogram withOut Contrast', 7000, 'Procedure'],
      ['Sinogram Fistulogram', 5000, 'Procedure'],
      ['Therapeutic Ascitic Tap', 8000, 'Procedure'],
      ['USG guided', 7000, 'Procedure'],
    ];

    const toAdd = list.filter(([name]) => !existingNames.has(name.trim().toLowerCase()));
    if (toAdd.length > 0) {
      const now = new Date().toISOString();
      const newProcs = toAdd.map(([name, price, department]) => ({
        id: generateId('proc'),
        name,
        price,
        department,
        active: true,
        doctorsSharePercent: 0,
        createdAt: now,
        updatedAt: now,
      }));
      writeTable('procedures', [...procedures, ...newProcs]);
      console.log(`✔ Procedures: added ${newProcs.length} new procedure(s) from the master list`);
    } else {
      console.log('✔ Procedures already up to date');
    }
  }

  // ---- Referrals ----
  const referrals = readTable('referrals');
  if (referrals.length === 0) {
    writeTable('referrals', [
      {
        id: generateId('ref'),
        name: 'Self / Walk-in',
        department: '',
        phone: '',
        address: '',
        sharePercent: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ]);
    console.log('✔ Referrals seeded');
  }

  // ---- Doctors ----
  const doctors = readTable('doctors');
  if (doctors.length === 0) {
    const now = new Date().toISOString();
    writeTable('doctors', [
      { id: generateId('doc'), name: 'Dr. Ahmed Rizvi', department: 'X-Ray', phone: '', active: true, createdAt: now, updatedAt: now },
      { id: generateId('doc'), name: 'Dr. Sana Malik', department: 'Ultrasound', phone: '', active: true, createdAt: now, updatedAt: now },
      { id: generateId('doc'), name: 'Dr. Bilal Hussain', department: 'CT Scan', phone: '', active: true, createdAt: now, updatedAt: now },
      { id: generateId('doc'), name: 'Dr. Farah Iqbal', department: 'MRI', phone: '', active: true, createdAt: now, updatedAt: now },
    ]);
    console.log('✔ Doctors seeded');
  }

  console.log('Seeding complete.');
}

seed();
