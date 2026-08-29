require('dotenv').config();
const mongoose = require('mongoose');
const { Terminal, AtmInstallation, AtmAgreement, AtmRemoval } = require('../src/models');

async function seedFake() {
  await mongoose.connect(process.env.MONGODB_URI);
  
  const FAKE_ID = 'FAKE9999';

  // 1. Delete if exists
  await Terminal.deleteOne({ terminalId: FAKE_ID });
  await AtmInstallation.deleteMany({ terminalId: FAKE_ID });
  await AtmAgreement.deleteMany({ terminalId: FAKE_ID });
  await AtmRemoval.deleteMany({ terminalId: FAKE_ID });

  // 2. Create Terminal
  const term = await Terminal.create({
    terminalId: FAKE_ID,
    official: {
      status: 'Active',
      name: 'FAKE TERMINAL FOR TESTING',
      address: '123 Fake Street',
      city: 'Fake City',
      locationArea: 'FAKE AREA',
    },
    current: {
      businessName: 'Fake Business',
      address: '123 Fake Street',
      city: 'Fake City',
    }
  });

  // 3. Create Installation Form
  await AtmInstallation.create({
    terminalId: FAKE_ID,
    date: new Date(),
    locationName: 'Fake Location',
    locationStreet: '123 Fake Street',
    locationCity: 'Fake City',
    contactPersonName: 'John Doe',
    phone: '555-1234',
    machineModel: 'Triton Fake',
    machineSerialNo: 'SN12345678',
    remarks: 'Seeded dummy installation form.'
  });

  // 4. Create 15 Agreement Forms
  for (let i = 1; i <= 15; i++) {
    await AtmAgreement.create({
      terminalId: FAKE_ID,
      customerName: `Fake Customer ${i}`,
      address: `123 Fake Street ${i}`,
      postalCode: 'L4M 1X1',
      telephone: '555-123-4567',
      email: `contact${i}@fakebusiness.com`,
      fax: '555-999-8888',
      date: new Date(Date.now() - i * 2 * 24 * 60 * 60 * 1000), // different dates
      cellPhone: '555-000-1111',
      atmModelOrLocation: `Triton Argo / Location ${i}`,
      surchargeRate: `$${(1 + i * 0.1).toFixed(2)}`,
      remitAmount: '$1.50',
      remitTo: `Fake Customer ${i}`,
      mhSignature: 'Signed by MH',
      mhName: 'Admin',
      mhDesignation: 'Manager',
      customerSignature: 'Signed by Customer',
      customerNameOwner: 'Fake Owner',
      customerDriversLic: 'DL-123456789',
      customerTelephone: '555-123-4567',
      customerHomeAddress: '123 Home Street, City',
      remarks: `Fully filled agreement form #${i} for testing.`
    });
  }

  // 5. Create 15 Removal Forms
  for (let i = 1; i <= 15; i++) {
    await AtmRemoval.create({
      terminalId: FAKE_ID,
      date: new Date(Date.now() - (i * 2 + 1) * 24 * 60 * 60 * 1000), // different dates
      time: '15:30',
      locationName: `Fake Location ${i}`,
      address: `123 Fake Street, Fake City ${i}`,
      reasonForRemoval: `Testing timeline scrolling (Form #${i}).`,
      machineModelNo: 'Triton Fake',
      machineSerialNo: `SN12345678-${i}`,
      cashInCassette: `$${(400 + i * 10).toFixed(2)}`,
      rejectBin: '$20.00',
      totalNumberOfBills: `${20 + i}`,
      inventoryNumber: `INV-999-${i}`,
      removedBy: 'Agent Smith',
      receiverSignature: 'Signed by Receiver',
      dateReceived: new Date(Date.now() - (i * 2 + 2) * 24 * 60 * 60 * 1000),
      remarks: `Fully filled removal form #${i} for testing.`
    });
  }

  // 6. Create 2nd Installation Form (New - Reinstalled)
  await AtmInstallation.create({
    terminalId: FAKE_ID,
    date: new Date(), // Today
    locationName: 'Fake Location (Renovated)',
    locationStreet: '123 Fake Street',
    locationCity: 'Fake City',
    locationPostalCode: 'L4M 1X1',
    contactPersonName: 'John Doe',
    phone: '555-987-6543',
    email: 'johndoe@fakebusiness.com',
    chequePayableTo: 'John Doe',
    mailingStreet: '123 Fake Street',
    mailingCity: 'Fake City',
    mailingPostalCode: 'L4M 1X1',
    machineOwnershipMH: 'Yes',
    atmSurcharge: '$3.50',
    merchant: 'Fake Merchant LLC',
    cashLoadByMH: 'Yes',
    machineModel: 'Triton Argo',
    machineSerialNo: 'SN-999-888-777',
    communicationInternet: 'Yes',
    safeCode: '10-20-30',
    masterCode: '123456',
    pinpadModel: 'Standard',
    installationDate: new Date(),
    timeOfActivation: '14:00',
    installedBy: 'Agent Smith',
    boltToGroundYes: 'Yes',
    machineVacuumedYes: 'Yes',
    remarks: 'Fully filled re-installation form after renovation.'
  });

  console.log(`\n✅ Fake ATM (${FAKE_ID}) and its forms have been successfully created!`);
  console.log(`\n🗑️  TO DELETE THIS DATA LATER, RUN THIS IN YOUR DATABASE:`);
  console.log(`---------------------------------------------------------`);
  console.log(`db.terminals.deleteOne({ terminalId: "${FAKE_ID}" });`);
  console.log(`db.atminstallations.deleteMany({ terminalId: "${FAKE_ID}" });`);
  console.log(`db.atmagreements.deleteMany({ terminalId: "${FAKE_ID}" });`);
  console.log(`db.atmremovals.deleteMany({ terminalId: "${FAKE_ID}" });`);
  console.log(`---------------------------------------------------------\n`);

  mongoose.disconnect();
}

seedFake().catch(err => {
  console.error(err);
  mongoose.disconnect();
});
