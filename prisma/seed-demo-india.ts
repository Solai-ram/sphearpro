import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';

const DEFAULT_CLINIC_ID = 'cldefault00000000000000001';

function atLocal(dayOffset: number, hour: number, minute = 0) {
  const d = new Date();
  d.setDate(d.getDate() + dayOffset);
  d.setHours(hour, minute, 0, 0);
  return d;
}

function yearsAgo(years: number, month = 3, day = 12) {
  const d = new Date();
  d.setFullYear(d.getFullYear() - years, month, day);
  d.setHours(0, 0, 0, 0);
  return d;
}

export async function seedHearingAidCatalog(prisma: PrismaClient) {
  const clinicId = DEFAULT_CLINIC_ID;
  const medplus = await prisma.supplier.findFirst({ where: { name: 'MedPlus Distributors Hyderabad' } })
    || await prisma.supplier.create({
      data: { clinicId, name: 'MedPlus Distributors Hyderabad', contact: 'Srinivas Rao', phone: '040-66778899', email: 'hyderabad@medplus.example.in', isActive: true },
    });
  const speechTools = await prisma.supplier.findFirst({ where: { name: 'Speech Tools India' } })
    || await prisma.supplier.create({
      data: { clinicId, name: 'Speech Tools India', contact: 'Lakshmi Narayanan', phone: '044-24567890', email: 'sales@speechtools.example.in', isActive: true },
    });
  const signia = await prisma.supplier.findFirst({ where: { name: 'Signia Hearing India' } })
    || await prisma.supplier.create({
      data: { clinicId, name: 'Signia Hearing India', contact: 'Rajesh Kumar', phone: '040-40112233', email: 'orders@signia.example.in', isActive: true },
    });

  const consumables = await prisma.productCategory.upsert({ where: { clinicId_name: { clinicId, name: 'Consumables' } }, update: {}, create: { clinicId, name: 'Consumables' } });
  const therapyAids = await prisma.productCategory.upsert({ where: { clinicId_name: { clinicId, name: 'Therapy Aids' } }, update: {}, create: { clinicId, name: 'Therapy Aids' } });
  const devices = await prisma.productCategory.upsert({ where: { clinicId_name: { clinicId, name: 'Clinic Devices' } }, update: {}, create: { clinicId, name: 'Clinic Devices' } });
  const hearingAids = await prisma.productCategory.upsert({ where: { clinicId_name: { clinicId, name: 'Hearing Aids' } }, update: {}, create: { clinicId, name: 'Hearing Aids' } });

  async function ensureProduct(data: {
    sku: string;
    name: string;
    categoryId: string;
    unitPrice: number;
    taxRate: number;
    threshold: number;
    opening: number;
    unitCost: number;
    supplierId: string;
    model?: string;
    serialNo?: string;
    warranty?: string;
    colour?: string;
    description?: string;
  }) {
    const existing = await prisma.product.findUnique({ where: { clinicId_sku: { clinicId, sku: data.sku } } });
    if (existing) {
      return prisma.product.update({
        where: { clinicId_sku: { clinicId, sku: data.sku } },
        data: {
          name: data.name,
          categoryId: data.categoryId,
          unitPrice: data.unitPrice,
          taxRate: data.taxRate,
          lowStockThreshold: data.threshold,
          model: data.model ?? null,
          serialNo: data.serialNo ?? null,
          warranty: data.warranty ?? null,
          colour: data.colour ?? null,
          description: data.description ?? null,
          isActive: true,
        },
      });
    }
    const product = await prisma.product.create({
      data: {
        clinicId,
        sku: data.sku,
        name: data.name,
        categoryId: data.categoryId,
        unitPrice: data.unitPrice,
        taxRate: data.taxRate,
        lowStockThreshold: data.threshold,
        model: data.model ?? null,
        serialNo: data.serialNo ?? null,
        warranty: data.warranty ?? null,
        colour: data.colour ?? null,
        description: data.description ?? null,
        isActive: true,
      },
    });
    await prisma.stockTransaction.create({
      data: {
        clinicId,
        productId: product.id,
        supplierId: data.supplierId,
        type: 'PURCHASE',
        quantity: data.opening,
        balance: data.opening,
        unitCost: data.unitCost,
        note: 'Opening stock — demo',
      },
    });
    return product;
  }

  await ensureProduct({
    sku: 'HA-SIGNIA-FUN-SP',
    name: 'Hearing Aid (A Complete Set)',
    categoryId: hearingAids.id,
    unitPrice: 13990,
    taxRate: 0,
    threshold: 1,
    opening: 3,
    unitCost: 8200,
    supplierId: signia.id,
    model: 'Signia Fun SP',
    serialNo: 'DLH7802',
    warranty: '2 years',
    colour: 'BG',
    description: 'BTE hearing aid complete set — matches tax invoice line fields',
  });
  await ensureProduct({
    sku: 'HA-PHONAK-AUDEO-P30',
    name: 'Hearing Aid (A Complete Set)',
    categoryId: hearingAids.id,
    unitPrice: 28500,
    taxRate: 0,
    threshold: 1,
    opening: 2,
    unitCost: 16800,
    supplierId: signia.id,
    model: 'Phonak Audeo P30',
    serialNo: 'PHK44118',
    warranty: '2 years',
    colour: 'Beige',
  });
  await ensureProduct({
    sku: 'HA-WIDEX-MOM-440',
    name: 'Hearing Aid (A Complete Set)',
    categoryId: hearingAids.id,
    unitPrice: 42000,
    taxRate: 0,
    threshold: 1,
    opening: 2,
    unitCost: 25500,
    supplierId: signia.id,
    model: 'Widex Moment 440',
    serialNo: 'WDX99821',
    warranty: '3 years',
    colour: 'Silver',
  });
  await ensureProduct({
    sku: 'HA-RESOUND-ONE9',
    name: 'Hearing Aid (A Complete Set)',
    categoryId: hearingAids.id,
    unitPrice: 31000,
    taxRate: 0,
    threshold: 1,
    opening: 2,
    unitCost: 18400,
    supplierId: signia.id,
    model: 'ReSound ONE 9',
    serialNo: 'RS55210A',
    warranty: '2 years',
    colour: 'Brown',
  });
  await ensureProduct({
    sku: 'HA-OTICON-MORE2',
    name: 'Hearing Aid (A Complete Set)',
    categoryId: hearingAids.id,
    unitPrice: 36500,
    taxRate: 0,
    threshold: 1,
    opening: 1,
    unitCost: 21900,
    supplierId: signia.id,
    model: 'Oticon More 2',
    serialNo: 'OT77102M',
    warranty: '2 years',
    colour: 'Grey',
  });
  await ensureProduct({
    sku: 'HA-BATT-13',
    name: 'Hearing aid batteries (pack of 6)',
    categoryId: consumables.id,
    unitPrice: 180,
    taxRate: 18,
    threshold: 10,
    opening: 48,
    unitCost: 90,
    supplierId: medplus.id,
  });
  await ensureProduct({
    sku: 'NS-SALINE',
    name: 'Nasal saline spray 20ml',
    categoryId: consumables.id,
    unitPrice: 95,
    taxRate: 12,
    threshold: 15,
    opening: 40,
    unitCost: 42,
    supplierId: medplus.id,
  });
  await ensureProduct({
    sku: 'EAR-PROBE',
    name: 'Otoscope specula pack (100)',
    categoryId: consumables.id,
    unitPrice: 220,
    taxRate: 12,
    threshold: 8,
    opening: 6,
    unitCost: 95,
    supplierId: medplus.id,
  });
  await ensureProduct({
    sku: 'ST-FLASH-01',
    name: 'Picture flashcards (Telugu/Hindi/English)',
    categoryId: therapyAids.id,
    unitPrice: 450,
    taxRate: 0,
    threshold: 5,
    opening: 18,
    unitCost: 180,
    supplierId: speechTools.id,
  });
  await ensureProduct({
    sku: 'TBAND-LT',
    name: 'TheraBand light resistance',
    categoryId: therapyAids.id,
    unitPrice: 380,
    taxRate: 12,
    threshold: 5,
    opening: 10,
    unitCost: 160,
    supplierId: speechTools.id,
  });
  await ensureProduct({
    sku: 'POX-FING',
    name: 'Finger pulse oximeter',
    categoryId: devices.id,
    unitPrice: 1250,
    taxRate: 18,
    threshold: 3,
    opening: 8,
    unitCost: 620,
    supplierId: medplus.id,
    model: 'MD300C2',
    serialNo: 'POX-8821',
    warranty: '1 year',
    colour: 'White',
  });
  console.log('   - Hearing aid catalog + inventory SKUs seeded (invoice fields included)');

  const lakshmi = await prisma.patient.findUnique({ where: { clinicId_email: { clinicId, email: 'lakshmi.v@example.in' } } });
  const signiaAid = await prisma.product.findUnique({ where: { clinicId_sku: { clinicId, sku: 'HA-SIGNIA-FUN-SP' } } });
  const admin = await prisma.user.findFirst({ where: { staffType: 'ADMIN' } });
  if (lakshmi && signiaAid && !(await prisma.invoice.findFirst({ where: { clinicId, invoiceNumber: 'INV-2026-900005' } }))) {
    const inv = await prisma.invoice.create({
      data: {
        clinicId,
        patientId: lakshmi.id,
        invoiceNumber: 'INV-2026-900005',
        issueDate: atLocal(-12, 18, 0),
        dueDate: atLocal(5, 18, 0),
        status: 'PAID',
        subtotal: 13990,
        discountTotal: 0,
        taxTotal: 0,
        grandTotal: 13990,
        notes: 'Demo tax invoice — Signia Fun SP',
        items: {
          create: [{
            billableType: 'PRODUCT',
            description: signiaAid.name,
            quantity: 1,
            unitPrice: 13990,
            discount: 0,
            tax: 0,
            lineTotal: 13990,
            productId: signiaAid.id,
            model: signiaAid.model,
            serialNo: signiaAid.serialNo,
            warranty: signiaAid.warranty,
            colour: signiaAid.colour,
          }],
        },
      },
    });
    const payment = await prisma.payment.create({
      data: {
        clinicId,
        invoiceId: inv.id,
        patientId: lakshmi.id,
        amount: 13990,
        method: 'UPI',
        status: 'SUCCESS',
        paidAt: atLocal(-11, 10, 15),
        reference: 'UPI/HYD/9283746510',
        createdBy: admin?.id,
      },
    });
    await prisma.paymentAllocation.create({ data: { paymentId: payment.id, invoiceId: inv.id, amount: 13990 } });
    const lastAid = await prisma.stockTransaction.findFirst({ where: { productId: signiaAid.id }, orderBy: { createdAt: 'desc' } });
    await prisma.stockTransaction.create({
      data: {
        clinicId,
        productId: signiaAid.id, type: 'SALE', quantity: -1, balance: (lastAid?.balance ?? 3) - 1, note: 'Hearing aid sale — Lakshmi Venkatesh' },
    });
    await prisma.productSale.create({
      data: {
        clinicId,
        patientId: lakshmi.id, productId: signiaAid.id, quantity: 1, unitPrice: 13990, totalPrice: 13990, createdBy: admin?.id },
    });
    console.log('   - Demo tax invoice INV-2026-900005 (Signia Fun SP) seeded');
  }
}

const ENT_THERAPY_TYPES: Array<{ name: string; description: string }> = [
  { name: 'Speech Therapy', description: 'Paediatric and adult speech-language therapy after ENT / audiology evaluation' },
  { name: 'Physiotherapy', description: 'Physical rehabilitation including ENT-linked cervical and balance work' },
  { name: 'Occupational Therapy', description: 'OT for daily living and sensory skills' },
  { name: 'Auditory Verbal Therapy', description: 'Listening and spoken language after hearing aid or cochlear implant (ENT audiology)' },
  { name: 'Voice Therapy', description: 'Hoarseness, vocal nodules, and muscle-tension dysphonia after laryngology review' },
  { name: 'Vestibular Rehabilitation', description: 'BPPV, labyrinthitis, and post-ENT balance rehab' },
  { name: 'Tinnitus Retraining', description: 'Habituation and sound-enrichment therapy for chronic tinnitus' },
  { name: 'Swallowing Therapy', description: 'Oropharyngeal dysphagia after ENT / head-and-neck assessment' },
];

const ENT_THERAPY_PACKAGES: Array<{
  type: string;
  name: string;
  totalSessions: number;
  frequency: 'WEEKLY' | 'TWICE_WEEKLY' | 'THREE_TIMES_WEEKLY';
  price: number;
  validityDays: number;
}> = [
  { type: 'Speech Therapy', name: 'Speech Therapy 20 Sessions', totalSessions: 20, frequency: 'WEEKLY', price: 15000, validityDays: 180 },
  { type: 'Speech Therapy', name: 'Paediatric Articulation 16 Sessions', totalSessions: 16, frequency: 'TWICE_WEEKLY', price: 14000, validityDays: 120 },
  { type: 'Speech Therapy', name: 'Fluency / Stuttering 12 Sessions', totalSessions: 12, frequency: 'WEEKLY', price: 12000, validityDays: 90 },
  { type: 'Physiotherapy', name: 'Physiotherapy 12 Sessions', totalSessions: 12, frequency: 'TWICE_WEEKLY', price: 12000, validityDays: 90 },
  { type: 'Occupational Therapy', name: 'Occupational Therapy 16 Sessions', totalSessions: 16, frequency: 'TWICE_WEEKLY', price: 14000, validityDays: 120 },
  { type: 'Auditory Verbal Therapy', name: 'AVT 24 Sessions (post-HA/CI)', totalSessions: 24, frequency: 'THREE_TIMES_WEEKLY', price: 28000, validityDays: 120 },
  { type: 'Auditory Verbal Therapy', name: 'Hearing Aid Acclimatization 8 Sessions', totalSessions: 8, frequency: 'WEEKLY', price: 8000, validityDays: 60 },
  { type: 'Voice Therapy', name: 'Voice Therapy 12 Sessions', totalSessions: 12, frequency: 'TWICE_WEEKLY', price: 15000, validityDays: 90 },
  { type: 'Vestibular Rehabilitation', name: 'Vestibular Rehab 10 Sessions', totalSessions: 10, frequency: 'TWICE_WEEKLY', price: 12000, validityDays: 60 },
  { type: 'Tinnitus Retraining', name: 'Tinnitus Retraining 8 Sessions', totalSessions: 8, frequency: 'WEEKLY', price: 10000, validityDays: 90 },
  { type: 'Swallowing Therapy', name: 'Dysphagia Therapy 12 Sessions', totalSessions: 12, frequency: 'TWICE_WEEKLY', price: 16000, validityDays: 90 },
];

export async function seedEntTherapyCatalog(prisma: PrismaClient) {
  const clinicId = DEFAULT_CLINIC_ID;
  const typeIds = new Map<string, string>();
  for (const type of ENT_THERAPY_TYPES) {
    const row = await prisma.therapyType.upsert({
      where: { clinicId_name: { clinicId, name: type.name } },
      update: { description: type.description, isActive: true },
      create: { clinicId, name: type.name, description: type.description, isActive: true },
    });
    typeIds.set(type.name, row.id);
  }

  let created = 0;
  for (const pkg of ENT_THERAPY_PACKAGES) {
    const therapyTypeId = typeIds.get(pkg.type);
    if (!therapyTypeId) continue;
    const existing = await prisma.therapyPackage.findFirst({ where: { clinicId, name: pkg.name } });
    if (existing) continue;
    await prisma.therapyPackage.create({
      data: {
        clinicId,
        therapyTypeId,
        name: pkg.name,
        totalSessions: pkg.totalSessions,
        frequency: pkg.frequency,
        price: pkg.price,
        validityDays: pkg.validityDays,
        isActive: true,
      },
    });
    created += 1;
  }
  console.log(`   - ENT therapy catalog: ${ENT_THERAPY_TYPES.length} types, ${created} new packages`);
}

const LAB_PROCEDURES: Array<{
  code: string;
  name: string;
  department: string;
  sampleType: 'NONE' | 'BLOOD' | 'SERUM' | 'URINE' | 'SWAB' | 'SPUTUM' | 'OTHER';
  price: number;
  tatHours: number;
  instructions?: string;
}> = [
  { code: 'PTA', name: 'Pure Tone Audiometry', department: 'Audiology', sampleType: 'NONE', price: 800, tatHours: 1 },
  { code: 'IMP', name: 'Impedance Audiometry', department: 'Audiology', sampleType: 'NONE', price: 700, tatHours: 1 },
  { code: 'OAE', name: 'Otoacoustic Emissions', department: 'Audiology', sampleType: 'NONE', price: 1200, tatHours: 1 },
  { code: 'BERA', name: 'BERA / ABR', department: 'Audiology', sampleType: 'NONE', price: 2500, tatHours: 2 },
  { code: 'VNG', name: 'Videonystagmography', department: 'Vestibular', sampleType: 'NONE', price: 3500, tatHours: 2 },
  { code: 'CBC', name: 'Complete Blood Count', department: 'Hematology', sampleType: 'BLOOD', price: 350, tatHours: 6, instructions: 'Fasting not required' },
  { code: 'TSH', name: 'Thyroid Stimulating Hormone', department: 'Biochemistry', sampleType: 'SERUM', price: 450, tatHours: 24 },
  { code: 'CULT', name: 'Ear Swab Culture', department: 'Microbiology', sampleType: 'SWAB', price: 600, tatHours: 48 },
];

export async function seedLabProcedures(prisma: PrismaClient) {
  const clinicId = DEFAULT_CLINIC_ID;
  let created = 0;
  for (const row of LAB_PROCEDURES) {
    const existing = await prisma.labProcedure.findUnique({ where: { clinicId_code: { clinicId, code: row.code } } });
    if (existing) continue;
    await prisma.labProcedure.create({ data: { ...row, clinicId, isActive: true } });
    created += 1;
  }
  console.log(`   - Lab catalog: ${LAB_PROCEDURES.length} procedures (${created} new)`);
}

export async function seedLabBilling(prisma: PrismaClient) {
  const clinicId = DEFAULT_CLINIC_ID;
  const procedures = await prisma.labProcedure.findMany();
  const patients = await prisma.patient.findMany({
    where: { deletedAt: null },
    orderBy: { createdAt: 'asc' },
    take: 8,
  });
  if (!procedures.length || !patients.length) {
    console.log('   - Lab billing skipped (need procedures and patients)');
    return;
  }

  const byCode = new Map(procedures.map((p) => [p.code, p]));
  const pick = (code: string) => byCode.get(code);
  const admin = await prisma.user.findFirst({ where: { email: 'admin@hislite.local' } });

  async function ensureInvoice(
    number: string,
    dayOffset: number,
    hour: number,
    patient: { id: string },
    codes: string[],
  ) {
    const existing = await prisma.invoice.findFirst({ where: { clinicId, invoiceNumber: number } });
    if (existing) return false;
    const items = codes
      .map((code) => pick(code))
      .filter(Boolean)
      .map((p) => ({
        billableType: 'LAB_TEST' as const,
        referenceId: p!.id,
        description: `${p!.code} — ${p!.name}`,
        quantity: 1,
        unitPrice: Number(p!.price),
        discount: 0,
        tax: 0,
        lineTotal: Number(p!.price),
      }));
    if (!items.length) return false;
    const subtotal = items.reduce((s, i) => s + i.unitPrice * i.quantity, 0);
    const issueDate = atLocal(dayOffset, hour, 15);
    const inv = await prisma.invoice.create({
      data: {
        clinicId,
        patientId: patient.id,
        invoiceNumber: number,
        issueDate,
        dueDate: atLocal(dayOffset + 7, hour, 0),
        status: 'PAID',
        subtotal,
        discountTotal: 0,
        taxTotal: 0,
        grandTotal: subtotal,
        notes: 'Lab tests',
        items: { create: items },
      },
    });
    if (admin) {
      const payment = await prisma.payment.create({
        data: {
          clinicId,
          invoiceId: inv.id,
          patientId: patient.id,
          amount: subtotal,
          method: 'UPI',
          status: 'SUCCESS',
          paidAt: issueDate,
          createdBy: admin.id,
        },
      });
      await prisma.paymentAllocation.create({
        data: { paymentId: payment.id, invoiceId: inv.id, amount: subtotal },
      });
    }
    return true;
  }

  const p0 = patients[0];
  const p1 = patients[1] || patients[0];
  const p2 = patients[2] || patients[0];
  const p3 = patients[3] || patients[0];

  const created = [
    await ensureInvoice('INV-LAB-TODAY-01', 0, 10, p0, ['PTA', 'IMP']),
    await ensureInvoice('INV-LAB-TODAY-02', 0, 15, p1, ['CBC', 'TSH']),
    await ensureInvoice('INV-LAB-WEEK-01', -1, 11, p2, ['OAE', 'BERA']),
    await ensureInvoice('INV-LAB-MONTH-01', -10, 12, p3, ['VNG', 'CULT']),
    await ensureInvoice('INV-LAB-MONTH-02', -14, 9, p0, ['PTA', 'CBC', 'TSH']),
  ].filter(Boolean).length;

  console.log(`   - Lab billing invoices: ${created} new`);
}

export async function seedEntTherapyDemoCases(prisma: PrismaClient) {
  const clinicId = DEFAULT_CLINIC_ID;
  const meera = await prisma.staffProfile.findFirst({ where: { email: 'ananya.reddy@hislite.local' } });
  const arjun = await prisma.staffProfile.findFirst({ where: { email: 'vikram.iyer@hislite.local' } });
  const doctor = meera;
  const doctorUser = await prisma.user.findUnique({ where: { email: 'ananya.reddy@hislite.local' } });
  if (!meera || !arjun || !doctor) {
    console.log('   - ENT therapy demo cases skipped (doctor staff not seeded yet)');
    return;
  }

  async function patientByEmail(email: string) {
    return prisma.patient.findUnique({ where: { clinicId_email: { clinicId, email } } });
  }

  async function ensureOp(patientId: string, chiefComplaint: string, diagnosis: { code: string; description: string }) {
    const existing = await prisma.opCase.findFirst({ where: { patientId }, orderBy: { createdAt: 'desc' } });
    if (existing) return existing;
    return prisma.opCase.create({
      data: {
        clinicId,
        patientId,
        providerId: doctor.id,
        chiefComplaint,
        status: 'OPEN',
        diagnoses: { create: { code: diagnosis.code, description: diagnosis.description, type: 'PRIMARY' } },
        notes: doctorUser
          ? { create: { content: `Referred to ENT-linked therapy. ${chiefComplaint}`, createdBy: doctorUser.id } }
          : undefined,
      },
    });
  }

  async function ensureCase(opts: {
    title: string;
    patientId: string;
    therapistId: string;
    assessment: string;
    goals: unknown;
    packageName: string;
    usedSessions?: number;
    sessions?: Array<{ offsetDays: number; status: 'COMPLETED' | 'SCHEDULED'; attendance?: 'PRESENT' | 'LATE' }>;
  }) {
    const existing = await prisma.therapyCase.findFirst({ where: { title: opts.title } });
    if (existing) return existing;
    await ensureOp(opts.patientId, opts.title, { code: 'H90.5', description: 'Sensorineural hearing loss / ENT therapy referral' });
    const therapyCase = await prisma.therapyCase.create({
      data: {
        clinicId,
        patientId: opts.patientId,
        therapistId: opts.therapistId,
        title: opts.title,
        assessment: opts.assessment,
        goals: opts.goals as object,
        status: 'ACTIVE',
      },
    });
    const catalog = await prisma.therapyPackage.findFirst({ where: { name: opts.packageName } });
    let patientPackageId: string | null = null;
    if (catalog) {
      const assigned = await prisma.patientPackage.create({
        data: {
        clinicId,
        patientId: opts.patientId,
          therapyCaseId: therapyCase.id,
          packageId: catalog.id,
          totalSessions: catalog.totalSessions,
          usedSessions: opts.usedSessions ?? 0,
          expiryDate: catalog.validityDays ? atLocal(catalog.validityDays, 0, 0) : undefined,
          purchasedAt: atLocal(-10, 11, 0),
        },
      });
      patientPackageId = assigned.id;
    }
    for (const session of opts.sessions || []) {
      const row = await prisma.therapySession.create({
        data: {
        clinicId,
        therapyCaseId: therapyCase.id,
          patientPackageId,
          therapistId: opts.therapistId,
          scheduledAt: atLocal(session.offsetDays, 16, 0),
          status: session.status,
        },
      });
      if (session.attendance) {
        await prisma.therapyAttendance.create({
          data: { sessionId: row.id, status: session.attendance, markedBy: meera.userId, markedAt: atLocal(session.offsetDays, 16, 30) },
        });
      }
    }
    await prisma.patientTimelineEvent.create({
      data: {
        patientId: opts.patientId,
        eventType: 'OTHER',
        referenceId: therapyCase.id,
        title: 'Therapy Case Opened',
        description: opts.title,
        occurredAt: atLocal(-10, 11, 0),
      },
    });
    return therapyCase;
  }

  const diya = await patientByEmail('diya.parent@example.in');
  const vihaan = await patientByEmail('vihaan.parent@example.in');
  const ishita = await patientByEmail('ishita.menon@example.in');
  const rohan = await patientByEmail('rohan.iyer@example.in');
  const kabir = await patientByEmail('kabir.parent@example.in');
  const lakshmi = await patientByEmail('lakshmi.v@example.in');
  const pooja = await patientByEmail('pooja.parent@example.in');

  let added = 0;
  if (diya) {
    await ensureCase({
      title: 'Paediatric articulation — Diya Reddy',
      patientId: diya.id,
      therapistId: meera.id,
      assessment: 'Age 4. Fronting of /k/ /g/. ENT exam: adenoid hypertrophy, recurrent SOM. PTA: mild conductive loss right.',
      goals: [{ goal: 'Produce /k/ in words with 80% accuracy', metric: 'k_accuracy' }],
      packageName: 'Paediatric Articulation 16 Sessions',
      usedSessions: 2,
      sessions: [
        { offsetDays: -7, status: 'COMPLETED', attendance: 'PRESENT' },
        { offsetDays: 0, status: 'SCHEDULED' },
      ],
    });
    added += 1;
  }
  if (vihaan) {
    await ensureCase({
      title: 'Fluency therapy — Vihaan Gupta',
      patientId: vihaan.id,
      therapistId: meera.id,
      assessment: 'Developmental stuttering, blocks on sentence-initial vowels. ENT: larynx NAD. Referred after OP for stuttering.',
      goals: [{ goal: 'Reduce block duration below 1 second in conversation', metric: 'block_ms' }],
      packageName: 'Fluency / Stuttering 12 Sessions',
      usedSessions: 1,
      sessions: [{ offsetDays: -3, status: 'COMPLETED', attendance: 'PRESENT' }, { offsetDays: 4, status: 'SCHEDULED' }],
    });
    added += 1;
  }
  if (ishita) {
    await ensureCase({
      title: 'Voice therapy — Ishita Menon',
      patientId: ishita.id,
      therapistId: meera.id,
      assessment: 'Teachers’ voice, hoarseness 6 weeks. ENT: early vocal nodules. Allergic rhinitis with ear fullness.',
      goals: [{ goal: 'Sustain comfortable phonation 10 seconds', metric: 'max_phonation' }],
      packageName: 'Voice Therapy 12 Sessions',
      usedSessions: 2,
      sessions: [{ offsetDays: -5, status: 'COMPLETED', attendance: 'PRESENT' }, { offsetDays: 2, status: 'SCHEDULED' }],
    });
    added += 1;
  }
  if (rohan) {
    await ensureCase({
      title: 'Tinnitus retraining — Rohan Iyer',
      patientId: rohan.id,
      therapistId: meera.id,
      assessment: 'Left tinnitus 3 weeks, mild high-frequency SNHL. Noise exposure at work. TRT counselling started.',
      goals: [{ goal: 'Tinnitus handicap inventory below 18', metric: 'thi' }],
      packageName: 'Tinnitus Retraining 8 Sessions',
      usedSessions: 1,
      sessions: [{ offsetDays: -4, status: 'COMPLETED', attendance: 'PRESENT' }, { offsetDays: 3, status: 'SCHEDULED' }],
    });
    added += 1;
  }
  if (kabir) {
    await ensureCase({
      title: 'Auditory verbal therapy — Kabir Khan',
      patientId: kabir.id,
      therapistId: meera.id,
      assessment: 'Age 11. Bilateral moderate SNHL, newly fitted BTE aids. Ling-6 sounds inconsistent without visual cues.',
      goals: [{ goal: 'Identify Ling-6 sounds at 3 metres unaided visually', metric: 'ling6' }],
      packageName: 'AVT 24 Sessions (post-HA/CI)',
      usedSessions: 3,
      sessions: [{ offsetDays: -6, status: 'COMPLETED', attendance: 'PRESENT' }, { offsetDays: 1, status: 'SCHEDULED' }],
    });
    added += 1;
  }
  if (lakshmi) {
    await ensureCase({
      title: 'Hearing aid acclimatization — Lakshmi Venkatesh',
      patientId: lakshmi.id,
      therapistId: meera.id,
      assessment: 'Presbycusis, Signia Fun SP fitted. Needs orientation to controls, battery, and noisy-restaurant strategies.',
      goals: [{ goal: 'Wear aids 8 hours/day for 5 consecutive days', metric: 'wear_hours' }],
      packageName: 'Hearing Aid Acclimatization 8 Sessions',
      usedSessions: 1,
      sessions: [{ offsetDays: -2, status: 'COMPLETED', attendance: 'PRESENT' }, { offsetDays: 5, status: 'SCHEDULED' }],
    });
    added += 1;
  }
  if (pooja) {
    await ensureCase({
      title: 'AVT / language stimulation — Pooja Deshmukh',
      patientId: pooja.id,
      therapistId: meera.id,
      assessment: 'Age 5. Delayed language after recurrent CSOM. ENT cleared ears; start listening-first therapy.',
      goals: [{ goal: 'Use 50 spoken words in play', metric: 'word_count' }],
      packageName: 'AVT 24 Sessions (post-HA/CI)',
      usedSessions: 0,
      sessions: [{ offsetDays: 1, status: 'SCHEDULED' }],
    });
    added += 1;
  }

  // Vestibular package already used by Sneha physio case — add a dedicated vestibular type case for Aditya if not present
  const aditya = await patientByEmail('aditya.rao@example.in');
  if (aditya) {
    await ensureCase({
      title: 'Vestibular rehab — Aditya Rao',
      patientId: aditya.id,
      therapistId: arjun.id,
      assessment: 'Presbycusis with reduced balance confidence and cervical stiffness. Dix-Hallpike negative. Brandt-Daroff home programme.',
      goals: [{ goal: 'Tandem stand 20 seconds eyes open', metric: 'tandem_sec' }],
      packageName: 'Vestibular Rehab 10 Sessions',
      usedSessions: 2,
      sessions: [{ offsetDays: -8, status: 'COMPLETED', attendance: 'PRESENT' }, { offsetDays: 2, status: 'SCHEDULED' }],
    });
    added += 1;
  }

  console.log(`   - ENT therapy demo cases ensured (${added} patient pathways)`);
  await seedEntTherapyNotes(prisma);
}

type SoapNote = {
  subjective: string;
  objective: string;
  activities: string;
  observations: string;
  progress: string;
  challenges: string;
  nextPlan: string;
};

function soapBank(title: string, patientName: string): SoapNote[] {
  const name = patientName.split(' ')[0];
  if (title.includes('articulation')) {
    return [
      {
        subjective: `Father reports ${name} still says “tat” for cat. Fewer ear infections after ENT review.`,
        objective: 'Stimulable for /k/ in isolation 7/10. Fronting persists in words. Attention 18 minutes with play break.',
        activities: 'Velar placement with tongue depressor cue, “car/key/cookie” picture naming, auditory bombardment.',
        observations: 'Better accuracy when looking at therapist’s mouth. Fatigue after 15 minutes.',
        progress: '/k/ isolation improved from 4/10 last week to 7/10.',
        challenges: 'Generalisation to conversation not yet seen. Mild right conductive dip may blur high-frequency cues.',
        nextPlan: 'Home: 5 minutes “k” words at snack time. Recheck middle ear if nasal congestion returns.',
      },
      {
        subjective: `${name} practised “car” at home. Mother says nursery teacher noticed clearer speech.`,
        objective: '/k/ in CV words 6/10 with cue, 3/10 spontaneous. /g/ still fronted.',
        activities: 'Minimal pairs (key/tea, coat/tote), bubble play for back-of-tongue awareness.',
        observations: 'Self-corrects when given a visual “throat” cue.',
        progress: 'Two spontaneous “cookie” productions in play.',
        challenges: 'Refuses table-top after school; keep sessions play-based.',
        nextPlan: 'Introduce /g/ in isolation. Share word list with preschool.',
      },
    ];
  }
  if (title.includes('Fluency') || title.includes('stuttering')) {
    return [
      {
        subjective: `Parents notice more blocks when ${name} is excited after cricket practice.`,
        objective: 'Average 8 blocks/100 syllables in conversation. Prolongations on initial vowels. No secondary struggle.',
        activities: 'Easy onset, pausing, slow modelled speech in picture description.',
        observations: 'Uses easy onset when cued; loses it in storytelling.',
        progress: 'Block duration shorter than last session (~1.5s vs 3s).',
        challenges: 'Classroom answering still stressful. Avoid putting on the spot.',
        nextPlan: 'Teacher note: extra 3 seconds wait time. Home: one slow-speech story at bedtime.',
      },
    ];
  }
  if (title.includes('Voice')) {
    return [
      {
        subjective: `${name} teaches two batches; hoarseness worse by Friday. ENT confirmed early nodules.`,
        objective: 'Maximum phonation time 6 seconds. Mild breathy quality. Pitch slightly low for age/sex.',
        activities: 'Confidential voice, hydration counselling, SOVT straw phonation, vocal hygiene.',
        observations: 'Throat clearing habit ~12 times in 20 minutes.',
        progress: 'MPT 6s (was 4s). Less glottal fry at end of phrases.',
        challenges: 'AC classroom + chalk dust. Reluctant to use lapel mic.',
        nextPlan: 'Request mic from school. Straw phonation 3×5 min daily. Review with laryngology in 6 weeks.',
      },
      {
        subjective: 'Weekend rest helped. Still clears throat while teaching maths.',
        objective: 'MPT 8 seconds. CAPE-V breathiness mild. No pain on phonation.',
        activities: 'Resonant voice /m/ hum, phrase-level carryover, reflux precautions review.',
        observations: 'Good self-monitoring when recording on phone.',
        progress: 'Can sustain /a/ at comfortable pitch without strain for a full sentence.',
        challenges: 'Festival functions this week — risk of yelling.',
        nextPlan: 'Voice rest after functions. Continue 12-session package twice weekly.',
      },
    ];
  }
  if (title.includes('Tinnitus')) {
    return [
      {
        subjective: `${name} rates tinnitus 6/10 at night, 3/10 at work. Sleep disrupted.`,
        objective: 'THI 38 (moderate). Residual inhibition 20 seconds after broadband noise.',
        activities: 'TRT counselling, sound enrichment (fan + app), relaxation breathing, hearing-protection plan.',
        observations: 'Anxious about “ear damage”. Reassured after explaining SNHL counselling from ENT.',
        progress: 'Using bedside sound for 4 nights. Anxiety slightly lower.',
        challenges: 'Works near HVAC; still skips earplugs “because they feel odd”.',
        nextPlan: 'Custom musician plugs quote. Diary of loudness 1–10 for two weeks.',
      },
    ];
  }
  if (title.includes('Auditory verbal') || title.includes('AVT')) {
    return [
      {
        subjective: `Mother says ${name} now turns to name at home with aids on. Aids worn ~5 hours/day.`,
        objective: 'Ling-6: /a/ /u/ /i/ /m/ detected at 1 m; /s/ /sh/ inconsistent. Detection without looking 3/6.',
        activities: 'Listening-first Ling-6, acoustic highlighting, closed-set toy identification, parent coaching.',
        observations: 'Removes right aid when tired. Mould slightly loose.',
        progress: 'Detection of vowels reliable at 1 metre this week.',
        challenges: 'Classroom noise. Needs FM/remote mic discussion with audiology.',
        nextPlan: 'Increase wear time toward 8 hours. Recheck mould. Next: open-set word identification.',
      },
      {
        subjective: 'Teacher reports better attention when sitting in front row with aids.',
        objective: 'Ling-6 5/6 at 2 m with both aids. Follows two-step spoken instruction in quiet.',
        activities: 'Auditory memory (2-item), story listening, sandwiching visual cues.',
        observations: 'Looks at face first; waiting 3 seconds before showing object helps.',
        progress: 'Two-step directions 4/5 in quiet room.',
        challenges: 'Telugu–English mix at home; keep one language per activity.',
        nextPlan: 'Home listening diary. Coordinate with Dr Reddy on aided audiogram.',
      },
    ];
  }
  if (title.includes('acclimatization') || title.includes('Hearing aid')) {
    return [
      {
        subjective: `${name} wore Signia aids 3 hours yesterday; “own voice too loud”. Family supportive.`,
        objective: 'Insertion independent with setup card. Battery door managed. Feedback when hugging grandchild.',
        activities: 'Orientation to programme button, battery change, wax trap, restaurant programme trial.',
        observations: 'Needs larger print on battery card. Slight tremor — clip pouch recommended.',
        progress: 'Can insert left aid in under 1 minute.',
        challenges: 'Temple of spectacles displaces BTE. Try slim tube check with audiologist.',
        nextPlan: 'Wear 6 hours/day. Return if pain or whistling. Son to attend next session.',
      },
    ];
  }
  if (title.includes('Vestibular') || title.includes('vertigo') || title.includes('gait') || title.includes('physio')) {
    return [
      {
        subjective: `${name} had one brief spin turning in bed. Neck stiffness after phone use.`,
        objective: 'Dix-Hallpike negative today. Tandem stand 8 seconds eyes open. Cervical rotation 60° right.',
        activities: 'Gaze stabilisation (VOR x1), Brandt-Daroff, cervical isometrics, gait with head turns.',
        observations: 'Holds furniture when turning quickly. Fear of falling in bathroom.',
        progress: 'Tandem stand 8s (was 4s).',
        challenges: 'Inconsistent home programme. Needs written Telugu instructions.',
        nextPlan: 'Bathroom night-light. Repeat VOR twice daily. Review hearing-aid balance together next visit.',
      },
    ];
  }
  return [
    {
      subjective: `Caregiver reports a good week for ${name}. Practised home programme 4 days.`,
      objective: 'Engaged for 20 minutes. Follows therapy routine with minimal prompting.',
      activities: 'Goal-directed drills, play/functional carryover, parent/caregiver coaching.',
      observations: 'Motivation high at start; needs a movement break mid-session.',
      progress: 'Measurable gain on this week’s target versus last session.',
      challenges: 'Generalisation outside clinic still limited.',
      nextPlan: 'Continue current goal. Short daily home practice. Review at next session.',
    },
  ];
}

export async function seedEntTherapyNotes(prisma: PrismaClient) {
  const cases = await prisma.therapyCase.findMany({
    include: {
      patient: { select: { name: true } },
      sessions: { include: { notes: true }, orderBy: { scheduledAt: 'asc' } },
      progress: true,
    },
  });

  let notesAdded = 0;
  let extraSessions = 0;
  let drafts = 0;
  let progressAdded = 0;

  for (const therapyCase of cases) {
    const patientName = therapyCase.patient?.name || 'Patient';
    const bank = soapBank(therapyCase.title, patientName);
    const completed = therapyCase.sessions.filter((s) => s.status === 'COMPLETED');

    for (let i = 0; i < completed.length; i++) {
      const session = completed[i];
      if (session.notes.length > 0) continue;
      const soap = bank[i % bank.length];
      await prisma.therapyNote.create({
        data: {
          sessionId: session.id,
          therapistId: session.therapistId,
          authoredById: session.therapistId,
          ...soap,
          isAiDraft: false,
          aiReviewed: true,
        },
      });
      notesAdded += 1;
    }

    if (completed.length === 0) {
      const pkg = await prisma.patientPackage.findFirst({ where: { therapyCaseId: therapyCase.id } });
      const session = await prisma.therapySession.create({
        data: {
        clinicId,
        therapyCaseId: therapyCase.id,
          patientPackageId: pkg?.id,
          therapistId: therapyCase.therapistId,
          scheduledAt: atLocal(-2, 16, 0),
          status: 'COMPLETED',
        },
      });
      await prisma.therapyAttendance.create({
        data: { sessionId: session.id, status: 'PRESENT', markedBy: therapyCase.therapistId, markedAt: atLocal(-2, 16, 25) },
      });
      const soap = bank[Math.min(1, bank.length - 1)];
      await prisma.therapyNote.create({
        data: {
          sessionId: session.id,
          therapistId: therapyCase.therapistId,
          authoredById: therapyCase.therapistId,
          ...soap,
          isAiDraft: false,
          aiReviewed: true,
        },
      });
      extraSessions += 1;
      notesAdded += 1;
    }

    const hasDraft = therapyCase.sessions.some((s) => s.notes.some((n) => n.isAiDraft && !n.aiReviewed));
    const latestCompleted = [...therapyCase.sessions]
      .filter((s) => s.status === 'COMPLETED')
      .sort((a, b) => b.scheduledAt.getTime() - a.scheduledAt.getTime())[0]
      || await prisma.therapySession.findFirst({
        where: { therapyCaseId: therapyCase.id, status: 'COMPLETED' },
        orderBy: { scheduledAt: 'desc' },
      });
    if (!hasDraft && latestCompleted) {
      const alreadyDraft = await prisma.therapyNote.findFirst({
        where: { sessionId: latestCompleted.id, isAiDraft: true },
      });
      if (!alreadyDraft) {
        await prisma.therapyNote.create({
          data: {
            sessionId: latestCompleted.id,
            therapistId: therapyCase.therapistId,
            authoredById: therapyCase.therapistId,
            subjective: `AI draft — ${patientName} attended therapy. Caregiver reported home practice.`,
            objective: 'Session engagement described from transcript; verify timings with therapist.',
            activities: 'Standard goal drills as per case plan.',
            observations: 'This paragraph was generated as an assistance draft only.',
            progress: 'Possible improvement on primary goal — confirm with SOAP above.',
            challenges: 'Needs human review before it is a clinical record.',
            nextPlan: 'Therapist to edit or reject this draft.',
            isAiDraft: true,
            aiReviewed: false,
          },
        });
        drafts += 1;
      }
    }

    if (therapyCase.progress.length === 0) {
      await prisma.therapyProgress.create({
        data: {
          therapyCaseId: therapyCase.id,
          metric: therapyCase.title.includes('Voice') ? 'max_phonation_sec'
            : therapyCase.title.includes('Tinnitus') ? 'thi'
            : therapyCase.title.includes('Vestibular') || therapyCase.title.includes('physio') ? 'tandem_sec'
            : therapyCase.title.includes('Fluency') ? 'blocks_per_100'
            : therapyCase.title.includes('articulation') ? 'k_accuracy_pct'
            : therapyCase.title.includes('Hearing aid') ? 'wear_hours'
            : 'goal_percent',
          value: therapyCase.title.includes('Tinnitus') ? 38
            : therapyCase.title.includes('Voice') ? 8
            : therapyCase.title.includes('Fluency') ? 8
            : 60,
          note: 'Demo baseline from latest completed session',
          recordedAt: atLocal(-2, 16, 40),
        },
      });
      progressAdded += 1;
    }
  }

  console.log(`   - Therapy notes: ${notesAdded} SOAP notes, ${drafts} AI drafts, ${extraSessions} extra sessions, ${progressAdded} progress rows`);
}

export async function seedIndianDemoData(prisma: PrismaClient) {
  const clinicId = DEFAULT_CLINIC_ID;
  const already = await prisma.patient.findUnique({ where: { clinicId_email: { clinicId, email: 'aarav.parent@example.in' } } });
  if (already) {
    console.log('Indian demo clinical data already present (Aarav Sharma). Skipping patients/clinical reseed.');
    return;
  }

  console.log('Seeding Indian demo clinic data...');

  const passwordHash = await argon2.hash('Staff@12345');
  const admin = await prisma.user.findFirst({ where: { staffType: 'ADMIN' } });
  const adminId = admin?.id;

  const role = async (name: string) => {
    const row = await prisma.role.findUnique({ where: { name } });
    if (!row) throw new Error(`Role ${name} missing — run core seed first`);
    return row.id;
  };

  async function upsertUser(data: {
    email: string;
    username: string;
    name: string;
    mobile: string;
    staffType: 'DOCTOR' | 'RECEPTIONIST' | 'BILLING' | 'INVENTORY';
    roleName: string;
  }) {
    const existing = await prisma.user.findUnique({ where: { email: data.email } });
    if (existing) return existing;
    return prisma.user.create({
      data: {
        clinicId,
        email: data.email,
        username: data.username,
        name: data.name,
        mobile: data.mobile,
        passwordHash,
        status: 'ACTIVE',
        staffType: data.staffType,
        roles: { create: { roleId: await role(data.roleName) } },
      },
    });
  }

  const doctorUser = await upsertUser({
    email: 'ananya.reddy@hislite.local',
    username: 'ananya.reddy',
    name: 'Dr. Ananya Reddy',
    mobile: '9849011101',
    staffType: 'DOCTOR',
    roleName: 'DOCTOR',
  });
  const doctor2User = await upsertUser({
    email: 'vikram.iyer@hislite.local',
    username: 'vikram.iyer',
    name: 'Dr. Vikram Iyer',
    mobile: '9849011102',
    staffType: 'DOCTOR',
    roleName: 'DOCTOR',
  });
  // No separate therapist logins — doctors own therapy cases
  const speechUser = doctorUser;
  const physioUser = doctor2User;
  const receptionUser = await upsertUser({
    email: 'priya.sharma@hislite.local',
    username: 'priya.sharma',
    name: 'Priya Sharma',
    mobile: '9849011105',
    staffType: 'RECEPTIONIST',
    roleName: 'RECEPTIONIST',
  });
  await upsertUser({
    email: 'kavya.menon@hislite.local',
    username: 'kavya.menon',
    name: 'Kavya Menon',
    mobile: '9849011106',
    staffType: 'BILLING',
    roleName: 'BILLING',
  });
  await upsertUser({
    email: 'rohit.gupta@hislite.local',
    username: 'rohit.gupta',
    name: 'Rohit Gupta',
    mobile: '9849011107',
    staffType: 'INVENTORY',
    roleName: 'INVENTORY',
  });

  // Disable any legacy therapist logins from older seeds
  await prisma.user.updateMany({
    where: {
      OR: [
        { staffType: 'THERAPIST' },
        { email: { in: ['meera.krishnan@hislite.local', 'arjun.nair@hislite.local'] } },
      ],
    },
    data: { status: 'INACTIVE', staffType: 'DOCTOR' },
  });
  await prisma.staffProfile.updateMany({
    where: { staffType: 'THERAPIST' },
    data: { staffType: 'DOCTOR' },
  });

  async function upsertStaff(userId: string, name: string, staffType: 'DOCTOR' | 'RECEPTIONIST', specialization: string, department: string, phone: string, email: string, isProvider: boolean) {
    const existing = await prisma.staffProfile.findUnique({ where: { userId } });
    if (existing) {
      if (existing.staffType === 'THERAPIST') {
        return prisma.staffProfile.update({
          where: { id: existing.id },
          data: { staffType: 'DOCTOR', name, specialization, department, phone, email, isProvider },
        });
      }
      return existing;
    }
    const staff = await prisma.staffProfile.create({
      data: { clinicId, userId, name, staffType, specialization, department, phone, email, isProvider },
    });
    if (isProvider) {
      for (const day of [1, 2, 3, 4, 5, 6]) {
        await prisma.providerSchedule.create({
          data: { staffId: staff.id, dayOfWeek: day, startTime: '09:00', endTime: '17:00', isAvailable: true },
        });
      }
    }
    return staff;
  }

  const drAnanya = await upsertStaff(doctorUser.id, 'Dr. Ananya Reddy', 'DOCTOR', 'ENT & Audiology', 'OPD', '9849011101', doctorUser.email, true);
  const drVikram = await upsertStaff(doctor2User.id, 'Dr. Vikram Iyer', 'DOCTOR', 'Paediatrics', 'OPD', '9849011102', doctor2User.email, true);
  const meera = drAnanya;
  const arjun = drVikram;
  await upsertStaff(receptionUser.id, 'Priya Sharma', 'RECEPTIONIST', 'Front desk', 'Reception', '9849011105', receptionUser.email, false);

  await prisma.setting.upsert({
    where: { clinicId_key: { clinicId, key: 'billing.defaultTaxRate' } },
    update: { value: 18 },
    create: { clinicId, key: 'billing.defaultTaxRate', group: 'billing', value: 18 },
  });

  const occ = await prisma.therapyType.upsert({
    where: { clinicId_name: { clinicId, name: 'Occupational Therapy' } },
    update: {},
    create: { clinicId, name: 'Occupational Therapy', description: 'OT for daily living and sensory skills', isActive: true },
  });
  if (!(await prisma.therapyPackage.findFirst({ where: { clinicId, name: 'Occupational Therapy 16 Sessions' } }))) {
    await prisma.therapyPackage.create({
      data: {
        clinicId,
        therapyTypeId: occ.id,
        name: 'Occupational Therapy 16 Sessions',
        totalSessions: 16,
        frequency: 'TWICE_WEEKLY',
        price: 14000,
        validityDays: 120,
        isActive: true,
      },
    });
  }
  const speechPkg = await prisma.therapyPackage.findFirst({ where: { name: 'Speech Therapy 20 Sessions' } });
  const physioPkg = await prisma.therapyPackage.findFirst({ where: { name: 'Physiotherapy 12 Sessions' } });

  const batteries = await prisma.product.findUniqueOrThrow({ where: { sku: 'HA-BATT-13' } });
  const flashcards = await prisma.product.findUniqueOrThrow({ where: { sku: 'ST-FLASH-01' } });
  const signiaAid = await prisma.product.findUniqueOrThrow({ where: { sku: 'HA-SIGNIA-FUN-SP' } });

  const patientsData = [
    { n: 'P100001', name: 'Aarav Sharma', gender: 'MALE' as const, years: 6, phone: '9876500001', email: 'aarav.parent@example.in', city: 'Hyderabad', area: 'Jubilee Hills', pin: '500033', em: 'Rakesh Sharma', rel: 'Father' },
    { n: 'P100002', name: 'Ananya Patel', gender: 'FEMALE' as const, years: 8, phone: '9876500002', email: 'ananya.parent@example.in', city: 'Hyderabad', area: 'Gachibowli', pin: '500032', em: 'Neha Patel', rel: 'Mother' },
    { n: 'P100003', name: 'Rohan Iyer', gender: 'MALE' as const, years: 42, phone: '9876500003', email: 'rohan.iyer@example.in', city: 'Secunderabad', area: 'West Marredpally', pin: '500026', em: 'Kavitha Iyer', rel: 'Spouse' },
    { n: 'P100004', name: 'Diya Reddy', gender: 'FEMALE' as const, years: 4, phone: '9876500004', email: 'diya.parent@example.in', city: 'Hyderabad', area: 'Madhapur', pin: '500081', em: 'Srinivas Reddy', rel: 'Father' },
    { n: 'P100005', name: 'Kabir Khan', gender: 'MALE' as const, years: 11, phone: '9876500005', email: 'kabir.parent@example.in', city: 'Hyderabad', area: 'Tolichowki', pin: '500008', em: 'Farah Khan', rel: 'Mother' },
    { n: 'P100006', name: 'Sneha Nair', gender: 'FEMALE' as const, years: 29, phone: '9876500006', email: 'sneha.nair@example.in', city: 'Hyderabad', area: 'Kukatpally', pin: '500072', em: 'Arun Nair', rel: 'Spouse' },
    { n: 'P100007', name: 'Vihaan Gupta', gender: 'MALE' as const, years: 7, phone: '9876500007', email: 'vihaan.parent@example.in', city: 'Hyderabad', area: 'Banjara Hills', pin: '500034', em: 'Amit Gupta', rel: 'Father' },
    { n: 'P100008', name: 'Ishita Menon', gender: 'FEMALE' as const, years: 35, phone: '9876500008', email: 'ishita.menon@example.in', city: 'Hyderabad', area: 'Hitec City', pin: '500081', em: 'Rajesh Menon', rel: 'Spouse' },
    { n: 'P100009', name: 'Aditya Rao', gender: 'MALE' as const, years: 58, phone: '9876500009', email: 'aditya.rao@example.in', city: 'Hyderabad', area: 'Ameerpet', pin: '500016', em: 'Lakshmi Rao', rel: 'Spouse' },
    { n: 'P100010', name: 'Meera Joshi', gender: 'FEMALE' as const, years: 9, phone: '9876500010', email: 'meera.parent@example.in', city: 'Hyderabad', area: 'Begumpet', pin: '500016', em: 'Pooja Joshi', rel: 'Mother' },
    { n: 'P100011', name: 'Arjun Pillai', gender: 'MALE' as const, years: 16, phone: '9876500011', email: 'arjun.pillai@example.in', city: 'Hyderabad', area: 'Manikonda', pin: '500089', em: 'Suresh Pillai', rel: 'Father' },
    { n: 'P100012', name: 'Lakshmi Venkatesh', gender: 'FEMALE' as const, years: 67, phone: '9876500012', email: 'lakshmi.v@example.in', city: 'Hyderabad', area: 'Himayatnagar', pin: '500029', em: 'Karthik Venkatesh', rel: 'Son' },
    { n: 'P100013', name: 'Mohammed Irfan', gender: 'MALE' as const, years: 33, phone: '9876500013', email: 'irfan.m@example.in', city: 'Hyderabad', area: 'Mehdipatnam', pin: '500028', em: 'Ayesha Irfan', rel: 'Spouse' },
    { n: 'P100014', name: 'Pooja Deshmukh', gender: 'FEMALE' as const, years: 5, phone: '9876500014', email: 'pooja.parent@example.in', city: 'Hyderabad', area: 'Kondapur', pin: '500084', em: 'Nikhil Deshmukh', rel: 'Father' },
  ];

  const patients = [];
  for (const p of patientsData) {
    const created = await prisma.patient.create({
      data: {
        clinicId,
        patientNumber: p.n,
        name: p.name,
        gender: p.gender,
        dateOfBirth: yearsAgo(p.years),
        phone: p.phone,
        email: p.email,
        createdBy: adminId,
        address: { street: `12, ${p.area}`, city: p.city, state: 'Telangana', pincode: p.pin, country: 'India' },
        emergencyContact: { name: p.em, phone: p.phone.replace('98765', '98850'), relationship: p.rel },
      },
    });
    await prisma.patientTimelineEvent.create({
      data: {
        patientId: created.id,
        eventType: 'OTHER',
        referenceId: created.id,
        title: 'Registered',
        description: `${created.name} registered (${created.patientNumber}).`,
        occurredAt: created.createdAt,
        metadata: { patientNumber: created.patientNumber },
      },
    });
    patients.push(created);
  }

  const [aarav, ananya, rohan, diya, kabir, sneha, vihaan, ishita, aditya, meeraJ, arjunP, lakshmi, irfan, pooja] = patients;

  const apptDefs: Array<{ patientId: string; providerId: string; when: Date; status: 'BOOKED' | 'CHECKED_IN' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED' | 'NO_SHOW'; reason: string }> = [
    { patientId: aarav.id, providerId: drAnanya.id, when: atLocal(-10, 10, 0), status: 'COMPLETED', reason: 'Hearing evaluation' },
    { patientId: ananya.id, providerId: drVikram.id, when: atLocal(-8, 11, 0), status: 'COMPLETED', reason: 'Speech delay review' },
    { patientId: rohan.id, providerId: drAnanya.id, when: atLocal(-5, 9, 30), status: 'COMPLETED', reason: 'Tinnitus / SNHL follow-up' },
    { patientId: aditya.id, providerId: drAnanya.id, when: atLocal(-3, 15, 0), status: 'NO_SHOW', reason: 'Hearing aid fitting' },
    { patientId: lakshmi.id, providerId: drAnanya.id, when: atLocal(-2, 12, 0), status: 'CANCELLED', reason: 'Ear pain' },
    { patientId: diya.id, providerId: drVikram.id, when: atLocal(0, 9, 0), status: 'CHECKED_IN', reason: 'Articulation concern' },
    { patientId: kabir.id, providerId: drAnanya.id, when: atLocal(0, 9, 30), status: 'IN_PROGRESS', reason: 'Audiometry' },
    { patientId: sneha.id, providerId: drAnanya.id, when: atLocal(0, 10, 30), status: 'BOOKED', reason: 'Vertigo' },
    { patientId: vihaan.id, providerId: drVikram.id, when: atLocal(0, 11, 0), status: 'BOOKED', reason: 'Stuttering' },
    { patientId: irfan.id, providerId: drAnanya.id, when: atLocal(0, 14, 0), status: 'BOOKED', reason: 'Ear wax / blocked ear' },
    { patientId: pooja.id, providerId: drVikram.id, when: atLocal(1, 10, 0), status: 'BOOKED', reason: 'Language delay' },
    { patientId: ishita.id, providerId: drAnanya.id, when: atLocal(2, 16, 0), status: 'BOOKED', reason: 'Allergic rhinitis + ear fullness' },
  ];

  const appointments = [];
  for (const a of apptDefs) {
    const appt = await prisma.appointment.create({
      data: {
        clinicId,
        patientId: a.patientId,
        providerId: a.providerId,
        appointmentAt: a.when,
        durationMin: 30,
        status: a.status,
        reason: a.reason,
        createdBy: receptionUser.id,
        statusHistory: { create: { status: a.status, changedBy: receptionUser.id, note: 'Demo seed' } },
      },
    });
    appointments.push(appt);
    await prisma.patientTimelineEvent.create({
      data: {
        patientId: a.patientId,
        eventType: 'APPOINTMENT',
        referenceId: appt.id,
        title: `Appointment ${a.status.toLowerCase().replace('_', ' ')}`,
        description: a.reason,
        occurredAt: a.when,
      },
    });
  }

  const todayQueue = appointments.filter((a) => a.appointmentAt.toDateString() === new Date().toDateString() && ['CHECKED_IN', 'IN_PROGRESS', 'BOOKED'].includes(a.status));
  let token = 1;
  for (const appt of todayQueue) {
    const status = appt.status === 'CHECKED_IN' ? 'WAITING' : appt.status === 'IN_PROGRESS' ? 'IN_CONSULTATION' : 'WAITING';
    await prisma.queueItem.create({
      data: {
        clinicId,
        appointmentId: appt.id,
        patientId: appt.patientId,
        tokenNumber: token,
        position: token,
        status: status as 'WAITING' | 'IN_CONSULTATION',
        checkedInAt: atLocal(0, 8, 40 + token),
        calledAt: status === 'IN_CONSULTATION' ? atLocal(0, 9, 25) : undefined,
      },
    });
    token += 1;
  }

  const completedAppt = appointments.find((a) => a.patientId === aarav.id && a.status === 'COMPLETED')!;
  const opAarav = await prisma.opCase.create({
      data: {
        clinicId,
        patientId: aarav.id,
      providerId: drAnanya.id,
      appointmentId: completedAppt.id,
      chiefComplaint: 'Not responding to name; suspected hearing loss',
      vitals: { temp: 36.7, bp: '90/60', hr: 92, weight: 18.4 },
      status: 'CLOSED',
      visits: { create: { visitedAt: completedAppt.appointmentAt, notes: 'Pure tone audiometry planned; parent counselling done.' } },
      diagnoses: {
        create: [
          { code: 'H90.5', description: 'Unspecified sensorineural hearing loss', type: 'PRIMARY' },
          { code: 'F80.1', description: 'Expressive language disorder', type: 'SECONDARY' },
        ],
      },
      notes: { create: { content: 'Bilateral SNHL likely. Referred to speech therapy for language stimulation. Repeat PTA in 3 months.', createdBy: doctorUser.id } },
      prescriptions: {
        create: {
          notes: 'No ototoxic meds. Return if ear discharge.',
          createdBy: doctorUser.id,
          items: {
            create: [
              { drugName: 'Otrivin Paediatric nasal drops', dosage: '1 drop', frequency: 'BD', duration: '5 days', instructions: 'Each nostril before PTA if congested' },
            ],
          },
        },
      },
      followUps: { create: { dueDate: atLocal(20, 10, 0), reason: 'Repeat audiogram + therapy review', status: 'PENDING' } },
    },
  });

  const opRohan = await prisma.opCase.create({
      data: {
        clinicId,
        patientId: rohan.id,
      providerId: drAnanya.id,
      chiefComplaint: 'Ringing in left ear for 3 weeks, office AC exposure',
      vitals: { temp: 36.8, bp: '128/82', hr: 76, weight: 78 },
      status: 'OPEN',
      visits: { create: { notes: 'PTA mild high-frequency SNHL left. Counselling for noise protection.' } },
      diagnoses: { create: { code: 'H93.1', description: 'Tinnitus', type: 'PRIMARY' } },
      notes: { create: { content: 'Advised hearing conservation. Trial of betahistine if vertigo appears.', createdBy: doctorUser.id } },
      prescriptions: {
        create: {
          createdBy: doctorUser.id,
          items: {
            create: [
              { drugName: 'Betahistine 16mg', dosage: '16mg', frequency: 'BD', duration: '14 days', instructions: 'After food' },
              { drugName: 'Ginkgo biloba 60mg', dosage: '60mg', frequency: 'OD', duration: '30 days', instructions: 'Optional' },
            ],
          },
        },
      },
      followUps: { create: { dueDate: atLocal(14, 11, 0), reason: 'Tinnitus diary review', status: 'PENDING' } },
    },
  });

  const opSneha = await prisma.opCase.create({
      data: {
        clinicId,
        patientId: sneha.id,
      providerId: drAnanya.id,
      chiefComplaint: 'Spinning sensation on getting up, worse in mornings',
      vitals: { temp: 36.6, bp: '112/74', hr: 80, weight: 58 },
      status: 'OPEN',
      diagnoses: { create: { code: 'H81.1', description: 'Benign paroxysmal vertigo', type: 'PRIMARY' } },
      notes: { create: { content: 'Dix-Hallpike positive right. Epley manoeuvre demonstrated. Physio for vestibular rehab.', createdBy: doctorUser.id } },
      followUps: { create: { dueDate: atLocal(7, 10, 0), reason: 'Vertigo check', status: 'PENDING' } },
    },
  });

  await prisma.patientTimelineEvent.createMany({
    data: [
      { patientId: aarav.id, eventType: 'OP_VISIT', referenceId: opAarav.id, title: 'OP visit — hearing evaluation', occurredAt: completedAppt.appointmentAt },
      { patientId: rohan.id, eventType: 'OP_VISIT', referenceId: opRohan.id, title: 'OP visit — tinnitus', occurredAt: atLocal(-5, 9, 30) },
      { patientId: sneha.id, eventType: 'OP_VISIT', referenceId: opSneha.id, title: 'OP visit — vertigo', occurredAt: atLocal(0, 10, 30) },
    ],
  });

  const speechCase = await prisma.therapyCase.create({
    data: {
        clinicId,
      patientId: aarav.id,
      therapistId: meera.id,
      title: 'Speech & language stimulation — Aarav Sharma',
      assessment: 'Limited vocabulary (~30 words), inconsistent response to name, uses gestures. PTA pending confirmation of SNHL.',
      goals: [
        { goal: 'Increase spoken vocabulary to 80 words', metric: 'word_count' },
        { goal: 'Respond to name in 4/5 trials', metric: 'name_response' },
      ],
      status: 'ACTIVE',
    },
  });
  const physioCase = await prisma.therapyCase.create({
    data: {
        clinicId,
      patientId: sneha.id,
      therapistId: arjun.id,
      title: 'Vestibular rehabilitation — Sneha Nair',
      assessment: 'BPPV right posterior canal. Mild cervical stiffness from IT posture.',
      goals: [{ goal: 'Reduce vertigo episodes to 0 per week', metric: 'vertigo_episodes' }],
      status: 'ACTIVE',
    },
  });
  const physioCase2 = await prisma.therapyCase.create({
    data: {
        clinicId,
      patientId: aditya.id,
      therapistId: arjun.id,
      title: 'Cervical & gait physio — Aditya Rao',
      assessment: 'Age-related hearing loss with neck stiffness and reduced balance confidence.',
      goals: [{ goal: 'Walk 20 min without support', metric: 'walk_minutes' }],
      status: 'ACTIVE',
    },
  });

  const aaravPkg = speechPkg
    ? await prisma.patientPackage.create({
      data: {
        clinicId,
        patientId: aarav.id,
        therapyCaseId: speechCase.id,
        packageId: speechPkg.id,
        totalSessions: 20,
        usedSessions: 4,
        expiryDate: atLocal(150, 0, 0),
        purchasedAt: atLocal(-28, 12, 0),
      },
    })
    : null;
  const snehaPkg = physioPkg
    ? await prisma.patientPackage.create({
      data: {
        clinicId,
        patientId: sneha.id,
        therapyCaseId: physioCase.id,
        packageId: physioPkg.id,
        totalSessions: 12,
        usedSessions: 3,
        expiryDate: atLocal(70, 0, 0),
        purchasedAt: atLocal(-14, 12, 0),
      },
    })
    : null;

  async function addSession(caseId: string, therapistId: string, when: Date, status: 'COMPLETED' | 'SCHEDULED' | 'NO_SHOW', pkgId: string | null, attendance?: 'PRESENT' | 'LATE' | 'ABSENT', note?: { subjective: string; objective: string; activities: string; progress: string; nextPlan: string }) {
    const session = await prisma.therapySession.create({
      data: {
        clinicId,
        therapyCaseId: caseId,
        patientPackageId: pkgId,
        therapistId,
        scheduledAt: when,
        status,
      },
    });
    if (attendance) {
      await prisma.therapyAttendance.create({
        data: { sessionId: session.id, status: attendance, markedBy: speechUser.id, markedAt: when },
      });
    }
    if (note) {
      await prisma.therapyNote.create({
        data: { sessionId: session.id, therapistId, authoredById: therapistId, ...note, isAiDraft: false, aiReviewed: true },
      });
    }
    return session;
  }

  await addSession(speechCase.id, meera.id, atLocal(-21, 16, 0), 'COMPLETED', aaravPkg?.id || null, 'PRESENT', {
    subjective: 'Amma reports Aarav copied 4 new animal names this week.',
    objective: 'Attended to picture cards for 12 minutes. Named ball, cat, water.',
    activities: 'Picture naming, auditory bombardment of /p/ /b/, play with kitchen set.',
    progress: 'Spontaneous words increased from 3 to 6 in session.',
    nextPlan: 'Home programme: name 5 kitchen items during dinner. Next: /m/ isolation.',
  });
  await addSession(speechCase.id, meera.id, atLocal(-14, 16, 0), 'COMPLETED', aaravPkg?.id || null, 'LATE', {
    subjective: 'Arrived 12 minutes late after school traffic on ORR.',
    objective: 'Responded to name 3/5 with visual cue.',
    activities: 'Joint attention book reading (Telugu + English).',
    progress: 'Better eye contact during shared book.',
    nextPlan: 'Continue bilingual labelling. Parent to reduce screen time to 30 min.',
  });
  await addSession(speechCase.id, meera.id, atLocal(-7, 16, 0), 'COMPLETED', aaravPkg?.id || null, 'PRESENT', {
    subjective: 'Father says he now says “amma, water”.',
    objective: 'Vocabulary probe: 11 words with picture support.',
    activities: 'Barrier game, bubble blowing for oral motor.',
    progress: 'Two-word attempt: “more bubble”.',
    nextPlan: 'Target two-word combinations. PTA follow-up with Dr Reddy.',
  });
  await addSession(speechCase.id, meera.id, atLocal(0, 16, 0), 'SCHEDULED', aaravPkg?.id || null);
  await addSession(speechCase.id, meera.id, atLocal(7, 16, 0), 'SCHEDULED', aaravPkg?.id || null);

  await addSession(physioCase.id, arjun.id, atLocal(-10, 15, 0), 'COMPLETED', snehaPkg?.id || null, 'PRESENT', {
    subjective: 'Vertigo milder; one episode while turning in bed.',
    objective: 'Dix-Hallpike mildly positive. Cervical ROM improved.',
    activities: 'Epley, gaze stabilisation, Brandt-Daroff education.',
    progress: 'Can sit-to-stand without holding table.',
    nextPlan: 'Home Epley once daily. Avoid sudden head turns on bike.',
  });
  await addSession(physioCase.id, arjun.id, atLocal(-3, 15, 0), 'COMPLETED', snehaPkg?.id || null, 'PRESENT', {
    subjective: 'No spinning for 4 days. Neck stiffness after laptop work.',
    objective: 'Romberg negative. Tandem walk 8 steps.',
    activities: 'Cervical isometrics, vestibular habituation.',
    progress: 'Confidence on stairs improved.',
    nextPlan: 'Ergonomics for WFH. Continue 12-session package.',
  });
  await addSession(physioCase.id, arjun.id, atLocal(4, 15, 0), 'SCHEDULED', snehaPkg?.id || null);
  await addSession(physioCase2.id, arjun.id, atLocal(3, 11, 0), 'SCHEDULED', null);

  await prisma.therapyProgress.createMany({
    data: [
      { therapyCaseId: speechCase.id, metric: 'word_count', value: 11, note: 'Picture-supported vocabulary', recordedAt: atLocal(-7, 16, 30) },
      { therapyCaseId: speechCase.id, metric: 'name_response', value: 60, note: 'Percent with visual cue', recordedAt: atLocal(-7, 16, 35) },
      { therapyCaseId: physioCase.id, metric: 'vertigo_episodes', value: 1, note: 'Per week', recordedAt: atLocal(-3, 15, 30) },
    ],
  });

  const aiReq = await prisma.aiRequest.create({
    data: {
        clinicId,
        type: 'THERAPY_SUMMARY',
      provider: 'google',
      model: 'gemini-3.5-flash',
      status: 'COMPLETED',
      createdBy: speechUser.id,
      inputRef: speechCase.id,
      outputs: {
        create: {
          contentType: 'summary',
          content: 'DRAFT — Aarav (6y) is in speech therapy for language stimulation with likely SNHL. Vocabulary has grown from isolated words to occasional two-word attempts. Name response is inconsistent without visual cues. Parents are engaged; screen time and bilingual labelling are part of the home plan. This is an AI draft and is not a clinical record until a therapist reviews and approves it.',
          isReviewed: false,
        },
      },
    },
  });
  await prisma.therapyAiSummary.create({
    data: {
      therapyCaseId: speechCase.id,
      content: 'DRAFT — Aarav is progressing in vocabulary and joint attention. Confirm hearing status with Dr Reddy before changing therapy intensity. AI draft only.',
      isReviewed: false,
      createdBy: speechUser.id,
      aiRequestId: aiReq.id,
    },
  });
  await prisma.aiUsage.create({
    data: {
        clinicId,
        provider: 'google', model: 'gemini-3.5-flash', requestType: 'THERAPY_SUMMARY', promptTokens: 420, completionTokens: 180 },
  });
  await prisma.aiRequest.create({
    data: {
        clinicId,
        type: 'VOICE_TRANSCRIPTION',
      provider: 'elevenlabs',
      model: 'scribe_v2',
      status: 'COMPLETED',
      createdBy: speechUser.id,
      outputs: {
        create: {
          contentType: 'transcript',
          content: 'Session note: Aarav sat for picture cards, said amma water, more bubble. Father mentioned PTA next week at Banjara Hills.',
          isReviewed: true,
        },
      },
    },
  });
  await prisma.aiUsage.create({
    data: {
        clinicId,
        provider: 'elevenlabs', model: 'scribe_v2', requestType: 'VOICE_TRANSCRIPTION', promptTokens: 0, completionTokens: 40 },
  });

  async function invoice(number: string, patientId: string, status: 'PAID' | 'PARTIALLY_PAID' | 'PENDING', items: Array<{ billableType: 'OP_VISIT' | 'THERAPY_PACKAGE' | 'THERAPY_SESSION' | 'PRODUCT'; description: string; qty: number; unit: number; tax: number; productId?: string; model?: string; serialNo?: string; warranty?: string; colour?: string; discount?: number }>, pay?: { amount: number; method: 'UPI' | 'CASH' | 'CARD' }) {
    const lineTotals = items.map((i) => i.qty * i.unit - (i.discount || 0) + i.tax);
    const subtotal = items.reduce((s, i) => s + i.qty * i.unit, 0);
    const discountTotal = items.reduce((s, i) => s + (i.discount || 0), 0);
    const taxTotal = items.reduce((s, i) => s + i.tax, 0);
    const grandTotal = subtotal - discountTotal + taxTotal;
    const inv = await prisma.invoice.create({
      data: {
        clinicId,
        patientId,
        invoiceNumber: number,
        issueDate: atLocal(-12, 18, 0),
        dueDate: atLocal(5, 18, 0),
        status,
        subtotal,
        discountTotal,
        taxTotal,
        grandTotal,
        notes: 'Demo invoice',
        items: {
          create: items.map((i, idx) => ({
            billableType: i.billableType,
            description: i.description,
            quantity: i.qty,
            unitPrice: i.unit,
            discount: i.discount || 0,
            tax: i.tax,
            lineTotal: lineTotals[idx],
            productId: i.productId,
            model: i.model,
            serialNo: i.serialNo,
            warranty: i.warranty,
            colour: i.colour,
          })),
        },
      },
    });
    await prisma.patientTimelineEvent.create({
      data: { patientId, eventType: 'INVOICE', referenceId: inv.id, title: `Invoice ${number}`, description: `₹${grandTotal.toFixed(2)}`, occurredAt: inv.issueDate },
    });
    if (pay) {
      const payment = await prisma.payment.create({
        data: {
          clinicId,
          invoiceId: inv.id,
          patientId,
          amount: pay.amount,
          method: pay.method,
          status: 'SUCCESS',
          paidAt: atLocal(-11, 10, 15),
          reference: pay.method === 'UPI' ? 'UPI/HYD/9283746510' : null,
          createdBy: adminId,
        },
      });
      await prisma.paymentAllocation.create({ data: { paymentId: payment.id, invoiceId: inv.id, amount: pay.amount } });
      await prisma.patientTimelineEvent.create({
        data: { patientId, eventType: 'PAYMENT', referenceId: payment.id, title: `Payment ${pay.method}`, description: `₹${pay.amount.toFixed(2)}`, occurredAt: payment.paidAt },
      });
    }
    return inv;
  }

  const inv1 = await invoice('INV-2026-900001', aarav.id, 'PAID', [
    { billableType: 'OP_VISIT', description: 'ENT consultation — Dr Ananya Reddy', qty: 1, unit: 800, tax: 0 },
    { billableType: 'THERAPY_PACKAGE', description: 'Speech Therapy 20 Sessions package', qty: 1, unit: 15000, tax: 0 },
  ], { amount: 15800, method: 'UPI' });

  await invoice('INV-2026-900002', sneha.id, 'PAID', [
    { billableType: 'OP_VISIT', description: 'ENT consultation — vertigo', qty: 1, unit: 800, tax: 0 },
    { billableType: 'THERAPY_PACKAGE', description: 'Physiotherapy 12 Sessions package', qty: 1, unit: 12000, tax: 0 },
  ], { amount: 12800, method: 'CARD' });

  await invoice('INV-2026-900003', rohan.id, 'PARTIALLY_PAID', [
    { billableType: 'OP_VISIT', description: 'Audiometry + consultation', qty: 1, unit: 1500, tax: 0 },
  ], { amount: 500, method: 'CASH' });

  await invoice('INV-2026-900004', aditya.id, 'PENDING', [
    { billableType: 'OP_VISIT', description: 'Hearing aid counselling', qty: 1, unit: 1000, tax: 0 },
    { billableType: 'PRODUCT', description: 'Hearing aid batteries (pack of 6)', qty: 2, unit: 180, tax: 64.8, productId: batteries.id },
  ]);

  await invoice('INV-2026-900005', lakshmi.id, 'PAID', [
    {
      billableType: 'PRODUCT',
      description: signiaAid.name,
      qty: 1,
      unit: 13990,
      tax: 0,
      productId: signiaAid.id,
      model: signiaAid.model || 'Signia Fun SP',
      serialNo: signiaAid.serialNo || 'DLH7802',
      warranty: signiaAid.warranty || '2 years',
      colour: signiaAid.colour || 'BG',
    },
  ], { amount: 13990, method: 'UPI' });

  const lastBatt = await prisma.stockTransaction.findFirst({ where: { productId: batteries.id }, orderBy: { createdAt: 'desc' } });
  const battBal = (lastBatt?.balance ?? 48) - 2;
  await prisma.stockTransaction.create({
      data: {
        clinicId,
        productId: batteries.id, type: 'SALE', quantity: -2, balance: battBal, note: 'OTC sale — Aditya Rao' },
  });
  await prisma.productSale.create({
      data: {
        clinicId,
        patientId: aditya.id, productId: batteries.id, quantity: 2, unitPrice: 180, totalPrice: 360, createdBy: adminId },
  });
  await prisma.productSale.create({
      data: {
        clinicId,
        patientId: aarav.id, productId: flashcards.id, quantity: 1, unitPrice: 450, totalPrice: 450, createdBy: adminId },
  });
  const lastAid = await prisma.stockTransaction.findFirst({ where: { productId: signiaAid.id }, orderBy: { createdAt: 'desc' } });
  const aidBal = (lastAid?.balance ?? 3) - 1;
  await prisma.stockTransaction.create({
      data: {
        clinicId,
        productId: signiaAid.id, type: 'SALE', quantity: -1, balance: aidBal, note: 'Hearing aid sale — Lakshmi Venkatesh' },
  });
  await prisma.productSale.create({
      data: {
        clinicId,
        patientId: lakshmi.id, productId: signiaAid.id, quantity: 1, unitPrice: 13990, totalPrice: 13990, createdBy: adminId },
  });

  await prisma.discount.createMany({
    data: [
      { clinicId, name: 'Senior citizen (60+)', type: 'PERCENTAGE', value: 10, isActive: true },
      { clinicId, name: 'Festival offer — Ganesh Chaturthi', type: 'FIXED', value: 500, isActive: true, validFrom: atLocal(-5, 0, 0), validTo: atLocal(20, 23, 0) },
    ],
  });

  await prisma.patientDocument.createMany({
    data: [
      { clinicId, patientId: aarav.id, category: 'AUDIOGRAM', fileName: 'Aarav_Sharma_PTA_Jul2026.pdf', s3Key: 'demo/P100001/pta.pdf', mimeType: 'application/pdf', sizeBytes: 184320, uploadedById: doctorUser.id },
      { clinicId, patientId: aarav.id, category: 'REFERRAL', fileName: 'Referral_speech_therapy.pdf', s3Key: 'demo/P100001/referral.pdf', mimeType: 'application/pdf', sizeBytes: 92160, uploadedById: doctorUser.id },
      { clinicId, patientId: rohan.id, category: 'AUDIOGRAM', fileName: 'Rohan_Iyer_audiogram.pdf', s3Key: 'demo/P100003/pta.pdf', mimeType: 'application/pdf', sizeBytes: 201000, uploadedById: doctorUser.id },
      { clinicId, patientId: sneha.id, category: 'THERAPY_ASSESSMENT', fileName: 'Vestibular_assessment.docx', s3Key: 'demo/P100006/vestibular.docx', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', sizeBytes: 45000, uploadedById: physioUser.id },
      { clinicId, patientId: diya.id, category: 'SCANNED', fileName: 'Aadhaar_parent_consent.jpg', s3Key: 'demo/P100004/consent.jpg', mimeType: 'image/jpeg', sizeBytes: 310000, uploadedById: receptionUser.id },
    ],
  });

  const confirmTpl = await prisma.messageTemplate.findUnique({ where: { clinicId_name: { clinicId, name: 'appointment_confirmation' } } });
  const invTpl = await prisma.messageTemplate.findUnique({ where: { clinicId_name: { clinicId, name: 'invoice_notification' } } });
  await prisma.communicationMessage.createMany({
    data: [
      { clinicId, patientId: diya.id,
        templateId: confirmTpl?.id,
        appointmentId: appointments.find((a) => a.patientId === diya.id)?.id,
        type: 'APPOINTMENT_REMINDER',
        channel: 'WHATSAPP',
        to: '9876500004',
        content: 'Hi Diya Reddy, your appointment with Dr. Vikram Iyer is confirmed for today 9:00 AM.',
        status: 'DELIVERED',
        sentAt: atLocal(0, 7, 0),
        deliveredAt: atLocal(0, 7, 1),
      },
      { clinicId, patientId: aarav.id,
        templateId: invTpl?.id,
        invoiceId: inv1.id,
        type: 'INVOICE',
        channel: 'WHATSAPP',
        to: '9876500001',
        content: 'Hi Aarav Sharma, invoice INV-2026-900001 for ₹15800.00 was generated.',
        status: 'READ',
        sentAt: atLocal(-12, 18, 5),
        deliveredAt: atLocal(-12, 18, 6),
        readAt: atLocal(-12, 18, 20),
      },
      { clinicId, patientId: sneha.id,
        type: 'THERAPY_REMINDER',
        channel: 'WHATSAPP',
        to: '9876500006',
        content: 'Reminder: Vestibular rehab with Dr. Vikram Iyer is in 2 hours.',
        status: 'DELIVERED',
        sentAt: atLocal(-3, 13, 0),
        deliveredAt: atLocal(-3, 13, 1),
      },
      { clinicId, patientId: aditya.id,
        type: 'GENERIC',
        channel: 'WHATSAPP',
        to: '9876500009',
        content: 'You missed your hearing-aid fitting. Please call 040-48551234 to reschedule.',
        status: 'FAILED',
        failedAt: atLocal(-3, 16, 0),
        failureReason: 'Demo: number not on WhatsApp',
      },
    ],
  });
  await prisma.communicationEvent.create({
    data: {
        clinicId,
        eventType: 'APPOINTMENT_BOOKED', payload: { clinic: 'Hyderabad', count: apptDefs.length } },
  });

  await prisma.auditLog.createMany({
    data: [
      { clinicId, actorId: receptionUser.id, actorType: 'user', action: 'PATIENT_CREATED', entityType: 'patient', entityId: aarav.id, patientId: aarav.id, result: 'SUCCESS', metadata: { clinicId, source: 'demo-seed' } },
      { clinicId, actorId: doctorUser.id, actorType: 'user', action: 'OP_CASE_CREATED', entityType: 'op_case', entityId: opAarav.id, patientId: aarav.id, result: 'SUCCESS' },
      { clinicId, actorId: speechUser.id, actorType: 'user', action: 'THERAPY_NOTE_CREATED', entityType: 'therapy_note', patientId: aarav.id, result: 'SUCCESS' },
      { clinicId, actorId: adminId, actorType: 'user', action: 'INVOICE_CREATED', entityType: 'Invoice', entityId: inv1.id, patientId: aarav.id, result: 'SUCCESS' },
      { clinicId, actorId: speechUser.id, actorType: 'ai', action: 'AI_SUMMARY_GENERATED', entityType: 'TherapyAiSummary', patientId: aarav.id, result: 'SUCCESS' },
    ],
  });

  console.log('   - Staff: Dr Ananya Reddy, Dr Vikram Iyer, Priya Sharma, Kavya Menon, Rohit Gupta (doctors deliver therapy — no therapist login)');
  console.log('   - 14 Hyderabad patients (P100001–P100014)');
  console.log('   - Appointments, queue, OP cases, therapy, invoices, inventory sales, WhatsApp, AI drafts, audit');
  console.log('   - Staff login: any @hislite.local staff email / Staff@12345');
}
