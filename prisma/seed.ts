import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';
import { seedHearingAidCatalog, seedIndianDemoData, seedEntTherapyCatalog, seedEntTherapyDemoCases, seedLabProcedures, seedLabBilling } from './seed-demo-india.ts';
import { seedUpcomingTherapyAppointments } from './seed-upcoming-appointments.ts';
import { seedFortyFiveMinuteSlots } from './seed-slot-templates.ts';
import { seedSubscriptionCatalog } from './seed-subscription.ts';

const prisma = new PrismaClient();

/** Stable default tenant for local/dev seed (matches apps/api clinic-context). */
export const DEFAULT_CLINIC_ID = 'cldefault00000000000000001';
const DEFAULT_CLINIC_SLUG = 'default';
const DEFAULT_CLINIC_NAME = 'Default Clinic';

// Permission matrix from docs/security/rbac_matrix.md
const PERMISSIONS = [
  // AUTH / USERS / ROLES / PERMISSIONS
  { name: 'users.view', module: 'users', action: 'view', description: 'View users' },
  { name: 'users.create', module: 'users', action: 'create', description: 'Create users' },
  { name: 'users.edit', module: 'users', action: 'edit', description: 'Edit users' },
  { name: 'users.manage', module: 'users', action: 'manage', description: 'Full user management' },
  { name: 'users.disable', module: 'users', action: 'disable', description: 'Disable users' },
  { name: 'roles.view', module: 'roles', action: 'view', description: 'View roles' },
  { name: 'roles.manage', module: 'roles', action: 'manage', description: 'Full role management' },
  { name: 'permissions.view', module: 'permissions', action: 'view', description: 'View permissions' },
  { name: 'permissions.manage', module: 'permissions', action: 'manage', description: 'Full permission management' },
  { name: 'auth.reset_password', module: 'auth', action: 'reset_password', description: 'Reset user password' },

  // PATIENTS
  { name: 'patients.view', module: 'patients', action: 'view', description: 'View patients' },
  { name: 'patients.create', module: 'patients', action: 'create', description: 'Create patients' },
  { name: 'patients.edit', module: 'patients', action: 'edit', description: 'Edit patients' },
  { name: 'patients.delete', module: 'patients', action: 'delete', description: 'Delete patients (soft delete)' },
  { name: 'patients.timeline.view', module: 'patients', action: 'timeline.view', description: 'View patient timeline' },

  // APPOINTMENTS / RECEPTION
  { name: 'appointments.view', module: 'appointments', action: 'view', description: 'View appointments' },
  { name: 'appointments.create', module: 'appointments', action: 'create', description: 'Create appointments' },
  { name: 'appointments.edit', module: 'appointments', action: 'edit', description: 'Edit appointments' },
  { name: 'appointments.cancel', module: 'appointments', action: 'cancel', description: 'Cancel appointments' },
  { name: 'reception.check_in', module: 'reception', action: 'check_in', description: 'Check-in patients' },
  { name: 'reception.queue.view', module: 'reception', action: 'queue.view', description: 'View reception queue' },
  { name: 'reception.queue.manage', module: 'reception', action: 'queue.manage', description: 'Manage queue' },
  { name: 'reception.token.manage', module: 'reception', action: 'token.manage', description: 'Manage tokens' },
  { name: 'staff.view', module: 'staff', action: 'view', description: 'View staff profiles' },
  { name: 'staff.create', module: 'staff', action: 'create', description: 'Create staff profiles' },
  { name: 'staff.edit', module: 'staff', action: 'edit', description: 'Edit staff profiles' },
  { name: 'staff.delete', module: 'staff', action: 'delete', description: 'Delete staff profiles' },

  // CLINICAL
  { name: 'clinical.op.create', module: 'clinical', action: 'op.create', description: 'Create OP cases' },
  { name: 'clinical.op.view', module: 'clinical', action: 'op.view', description: 'View OP cases' },
  { name: 'clinical.diagnosis.create', module: 'clinical', action: 'diagnosis.create', description: 'Create diagnoses' },
  { name: 'clinical.prescription.create', module: 'clinical', action: 'prescription.create', description: 'Create prescriptions' },
  { name: 'clinical.followup.create', module: 'clinical', action: 'followup.create', description: 'Create follow-ups' },

  // THERAPY
  { name: 'therapy.case.view', module: 'therapy', action: 'case.view', description: 'View therapy cases' },
  { name: 'therapy.case.create', module: 'therapy', action: 'case.create', description: 'Create therapy cases' },
  { name: 'therapy.package.view', module: 'therapy', action: 'package.view', description: 'View therapy packages' },
  { name: 'therapy.package.create', module: 'therapy', action: 'package.create', description: 'Create therapy packages' },
  { name: 'therapy.package.assign', module: 'therapy', action: 'package.assign', description: 'Assign packages to patients' },
  { name: 'therapy.session.view', module: 'therapy', action: 'session.view', description: 'View therapy sessions' },
  { name: 'therapy.session.create', module: 'therapy', action: 'session.create', description: 'Create therapy sessions' },
  { name: 'therapy.session.reschedule', module: 'therapy', action: 'session.reschedule', description: 'Reschedule therapy sessions' },
  { name: 'therapy.attendance.mark', module: 'therapy', action: 'attendance.mark', description: 'Mark attendance' },
  { name: 'therapy.note.create', module: 'therapy', action: 'note.create', description: 'Create therapy notes' },
  { name: 'therapy.note.edit', module: 'therapy', action: 'note.edit', description: 'Edit therapy notes' },
  { name: 'therapy.progress.record', module: 'therapy', action: 'progress.record', description: 'Record therapy progress' },

  // BILLING / INVENTORY
  { name: 'billing.invoice.create', module: 'billing', action: 'invoice.create', description: 'Create invoices' },
  { name: 'billing.invoice.view', module: 'billing', action: 'invoice.view', description: 'View invoices' },
  { name: 'billing.payment.create', module: 'billing', action: 'payment.create', description: 'Create payments' },
  { name: 'billing.payment.view', module: 'billing', action: 'payment.view', description: 'View payments' },
  { name: 'billing.refund', module: 'billing', action: 'refund', description: 'Process refunds' },
  { name: 'inventory.product.view', module: 'inventory', action: 'product.view', description: 'View products' },
  { name: 'inventory.product.create', module: 'inventory', action: 'product.create', description: 'Create products' },
  { name: 'inventory.stock.manage', module: 'inventory', action: 'stock.manage', description: 'Manage stock' },
  { name: 'inventory.product.sale', module: 'inventory', action: 'product.sale', description: 'Sell products' },
  { name: 'inventory.lowstock.view', module: 'inventory', action: 'lowstock.view', description: 'View low stock alerts' },
  { name: 'inventory.return.request', module: 'inventory', action: 'return.request', description: 'Submit item return requests' },
  { name: 'inventory.return.approve', module: 'inventory', action: 'return.approve', description: 'Approve or reject item returns (admin)' },
  { name: 'inventory.return.view', module: 'inventory', action: 'return.view', description: 'View item returns and return report' },

  // LAB
  { name: 'lab.view', module: 'lab', action: 'view', description: 'View lab dashboard and procedures' },
  { name: 'lab.procedure.create', module: 'lab', action: 'procedure.create', description: 'Create lab procedures' },
  { name: 'lab.procedure.edit', module: 'lab', action: 'procedure.edit', description: 'Edit lab procedures' },

  // DOCUMENTS
  { name: 'documents.view', module: 'documents', action: 'view', description: 'View documents' },
  { name: 'documents.upload', module: 'documents', action: 'upload', description: 'Upload documents' },
  { name: 'documents.download', module: 'documents', action: 'download', description: 'Download documents' },
  { name: 'documents.delete', module: 'documents', action: 'delete', description: 'Delete documents (soft delete)' },

  // COMMUNICATION / AI
  { name: 'communication.view', module: 'communication', action: 'view', description: 'View communications' },
  { name: 'communication.send', module: 'communication', action: 'send', description: 'Send communications' },
  { name: 'ai.summary.generate', module: 'ai', action: 'summary.generate', description: 'Generate AI summaries' },
  { name: 'ai.transcribe', module: 'ai', action: 'transcribe', description: 'Transcribe voice' },
  { name: 'ai.note_draft', module: 'ai', action: 'note_draft', description: 'Draft AI notes' },
  { name: 'ai.review', module: 'ai', action: 'review', description: 'Review AI outputs' },

  // DASHBOARD / REPORTS / AUDIT / SETTINGS
  { name: 'dashboard.view', module: 'dashboard', action: 'view', description: 'View dashboard' },
  { name: 'dashboard.manage', module: 'dashboard', action: 'manage', description: 'Manage dashboard' },
  { name: 'reports.view', module: 'reports', action: 'view', description: 'View reports' },
  { name: 'reports.export', module: 'reports', action: 'export', description: 'Export reports' },
  { name: 'audit.view', module: 'audit', action: 'view', description: 'View audit logs' },
  { name: 'settings.view', module: 'settings', action: 'view', description: 'View settings' },
  { name: 'settings.manage', module: 'settings', action: 'manage', description: 'Manage settings' },
];

const SYSTEM_ROLES = [
  { name: 'ADMIN', description: 'Full access; can create custom roles, manage users, view audit', isSystem: true },
  { name: 'SUPER_ADMIN', description: 'Platform operator — all clinics SaaS billing console (not clinic staff)', isSystem: true },
  { name: 'DOCTOR', description: 'Clinical access: OP, prescriptions, patient view', isSystem: true },
  { name: 'THERAPIST', description: 'Deprecated — doctors deliver therapy; do not assign this role for login', isSystem: true },
  { name: 'RECEPTIONIST', description: 'Patient registration, appointments, check-in, queue', isSystem: true },
  { name: 'BILLING', description: 'Invoices, payments, refunds, product sales', isSystem: true },
  { name: 'INVENTORY', description: 'Products, stock, suppliers', isSystem: true },
];

const ROLE_PERMISSIONS: Record<string, string[]> = {
  ADMIN: PERMISSIONS.map(p => p.name),
  SUPER_ADMIN: [
    'audit.view',
    'dashboard.view',
    'reports.view',
  ],
  DOCTOR: [
    'users.view',
    'staff.view',
    'patients.view',
    'patients.create',
    'patients.edit',
    'patients.delete',
    'patients.timeline.view',
    'appointments.view',
    'appointments.create',
    'appointments.edit',
    'appointments.cancel',
    'clinical.op.create',
    'clinical.op.view',
    'clinical.diagnosis.create',
    'clinical.prescription.create',
    'clinical.followup.create',
    'therapy.case.view',
    'therapy.case.create',
    'therapy.package.view',
    'therapy.package.create',
    'therapy.package.assign',
    'therapy.session.view',
    'therapy.session.create',
    'therapy.session.reschedule',
    'therapy.attendance.mark',
    'therapy.note.create',
    'therapy.note.edit',
    'therapy.progress.record',
    'billing.invoice.view',
    'billing.payment.view',
    'inventory.product.view',
    'lab.view',
    'lab.procedure.create',
    'lab.procedure.edit',
    'documents.view',
    'documents.upload',
    'documents.download',
    'documents.delete',
    'communication.view',
    'communication.send',
    'ai.summary.generate',
    'ai.transcribe',
    'ai.note_draft',
    'ai.review',
    'dashboard.view',
    'reports.view',
    'reports.export',
  ],
  THERAPIST: [
    'users.view',
    'staff.view',
    'patients.view',
    'patients.edit',
    'patients.delete',
    'patients.timeline.view',
    'appointments.view',
    'appointments.create',
    'appointments.edit',
    'appointments.cancel',
    'clinical.op.view',
    'therapy.case.view',
    'therapy.case.create',
    'therapy.package.view',
    'therapy.package.create',
    'therapy.package.assign',
    'therapy.session.view',
    'therapy.session.create',
    'therapy.session.reschedule',
    'therapy.attendance.mark',
    'therapy.note.create',
    'therapy.note.edit',
    'therapy.progress.record',
    'billing.invoice.view',
    'billing.payment.view',
    'inventory.product.view',
    'lab.view',
    'lab.procedure.create',
    'lab.procedure.edit',
    'documents.view',
    'documents.upload',
    'documents.download',
    'documents.delete',
    'communication.view',
    'communication.send',
    'ai.summary.generate',
    'ai.transcribe',
    'ai.note_draft',
    'ai.review',
    'dashboard.view',
    'reports.view',
    'reports.export',
  ],
  RECEPTIONIST: [
    'users.view',
    'staff.view',
    'patients.view',
    'patients.create',
    'patients.edit',
    'patients.delete',
    'patients.timeline.view',
    'appointments.view',
    'appointments.create',
    'appointments.edit',
    'appointments.cancel',
    'reception.check_in',
    'reception.queue.view',
    'reception.queue.manage',
    'reception.token.manage',
    'clinical.op.view',
    'therapy.case.view',
    'therapy.package.view',
    'therapy.package.create',
    'therapy.package.assign',
    'therapy.session.view',
    'therapy.session.create',
    'therapy.session.reschedule',
    'billing.invoice.view',
    'billing.payment.view',
    'inventory.product.view',
    'lab.view',
    'lab.procedure.create',
    'lab.procedure.edit',
    'documents.view',
    'documents.upload',
    'documents.download',
    'documents.delete',
    'communication.view',
    'communication.send',
    'dashboard.view',
    'reports.view',
  ],
  BILLING: [
    'users.view',
    'patients.view',
    'patients.timeline.view',
    'clinical.op.view',
    'therapy.case.view',
    'therapy.package.view',
    'therapy.package.create',
    'therapy.package.assign',
    'therapy.session.view',
    'billing.invoice.create',
    'billing.invoice.view',
    'billing.payment.create',
    'billing.payment.view',
    'billing.refund',
    'inventory.product.view',
    'inventory.product.sale',
    'documents.view',
    'documents.download',
    'communication.view',
    'communication.send',
    'dashboard.view',
    'reports.view',
    'reports.export',
  ],
  INVENTORY: [
    'users.view',
    'patients.view',
    'patients.timeline.view',
    'clinical.op.view',
    'therapy.case.view',
    'therapy.package.view',
    'therapy.session.view',
    'billing.invoice.view',
    'billing.payment.view',
    'inventory.product.view',
    'inventory.product.create',
    'inventory.stock.manage',
    'inventory.product.sale',
    'inventory.lowstock.view',
    'inventory.return.request',
    'inventory.return.view',
    'documents.view',
    'dashboard.view',
    'reports.view',
    'reports.export',
  ],
};

async function main() {

  console.log('Upserting default clinic...');
  await prisma.clinic.upsert({
    where: { id: DEFAULT_CLINIC_ID },
    update: {
      name: DEFAULT_CLINIC_NAME,
      slug: DEFAULT_CLINIC_SLUG,
      status: 'ACTIVE',
      email: process.env.ADMIN_EMAIL || 'admin@hislite.local',
    },
    create: {
      id: DEFAULT_CLINIC_ID,
      name: DEFAULT_CLINIC_NAME,
      slug: DEFAULT_CLINIC_SLUG,
      status: 'ACTIVE',
      email: process.env.ADMIN_EMAIL || 'admin@hislite.local',
    },
  });
  const clinicId = DEFAULT_CLINIC_ID;

  // 1. Create permissions
  console.log('���� Creating permissions...');
  const permissionMap = new Map<string, string>();
  for (const perm of PERMISSIONS) {
    const created = await prisma.permission.upsert({
      where: { name: perm.name },
      update: { description: perm.description, module: perm.module, action: perm.action },
      create: perm,
    });
    permissionMap.set(perm.name, created.id);
  }
  console.log(`��� Created ${PERMISSIONS.length} permissions`);

  // 2. Create system roles
  console.log('���� Creating system roles...');
  const roleMap = new Map<string, string>();
  for (const role of SYSTEM_ROLES) {
    const created = await prisma.role.upsert({
      where: { name: role.name },
      update: { description: role.description, isSystem: role.isSystem },
      create: role,
    });
    roleMap.set(role.name, created.id);
  }
  console.log(`��� Created ${SYSTEM_ROLES.length} system roles`);

  // 3. Assign permissions to roles
  console.log('���� Assigning permissions to roles...');
  for (const [roleName, permissionNames] of Object.entries(ROLE_PERMISSIONS)) {
    const roleId = roleMap.get(roleName);
    if (!roleId) {
      console.warn(`������ Role ${roleName} not found, skipping`);
      continue;
    }

    // Clear existing role permissions
    await prisma.rolePermission.deleteMany({ where: { roleId } });

    // Create new role permissions
    for (const permName of permissionNames) {
      const permId = permissionMap.get(permName);
      if (!permId) {
        console.warn(`������ Permission ${permName} not found, skipping`);
        continue;
      }
      await prisma.rolePermission.create({
        data: { roleId, permissionId: permId, granted: true },
      });
    }
    console.log(`��� Assigned ${permissionNames.length} permissions to ${roleName}`);
  }

  // 4. Create default ADMIN user
  console.log('���� Creating default ADMIN user...');
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@hislite.local';
  const adminPassword = process.env.ADMIN_PASSWORD || 'Admin@12345';
  const adminName = process.env.ADMIN_NAME || 'System Administrator';

  const existingAdmin = await prisma.user.findUnique({ where: { email: adminEmail } });
  if (!existingAdmin) {
    const passwordHash = await argon2.hash(adminPassword);
    const adminRoleId = roleMap.get('ADMIN');

    await prisma.user.create({
      data: {
        clinicId,
        email: adminEmail,
        username: 'admin',
        name: adminName,
        passwordHash,
        status: 'ACTIVE',
        staffType: 'ADMIN',
        roles: adminRoleId ? { create: { roleId: adminRoleId } } : undefined,
      },
    });
    console.log(`��� Created ADMIN user: ${adminEmail}`);
    console.log(`   Default password: ${adminPassword}`);
    console.log('   CHANGE THIS PASSWORD IMMEDIATELY IN PRODUCTION!');
  } else {
    console.log(`ADMIN user already exists: ${adminEmail}`);
  }

  // Per-clinic support ADMIN (platform console login-as)
  {
    const { supportEmailForSlug, generateSupportPassword, encryptSupportPassword } = await import(
      '../apps/api/src/modules/auth/support-credentials'
    );
    const supportEmail = supportEmailForSlug(DEFAULT_CLINIC_SLUG);
    const adminRoleId = roleMap.get('ADMIN');
    const existingSupport = await prisma.user.findFirst({
      where: { clinicId, isSystemSupport: true },
    });
    if (!existingSupport && adminRoleId) {
      const password = generateSupportPassword();
      const passwordHash = await argon2.hash(password);
      await prisma.user.create({
        data: {
          clinicId,
          email: supportEmail,
          name: `${DEFAULT_CLINIC_NAME} Support Admin`,
          passwordHash,
          supportPasswordEnc: encryptSupportPassword(password),
          isSystemSupport: true,
          status: 'ACTIVE',
          staffType: 'ADMIN',
          roles: { create: { roleId: adminRoleId } },
        },
      });
      console.log(`Created clinic support ADMIN: ${supportEmail}`);
      console.log(`   Password shown on platform clinic card (encrypted at rest).`);
    } else if (existingSupport) {
      console.log(`Clinic support ADMIN already exists: ${existingSupport.email}`);
    }
  }

  // Platform SUPER_ADMIN (optional email via PLATFORM_ADMIN_EMAIL)
  const platformEmail = process.env.PLATFORM_ADMIN_EMAIL || 'platform@hislite.local';
  const platformPassword = process.env.PLATFORM_ADMIN_PASSWORD || 'Platform@12345';
  const superRoleId = roleMap.get('SUPER_ADMIN');
  if (superRoleId) {
    const existingPlatform = await prisma.user.findUnique({ where: { email: platformEmail } });
    if (!existingPlatform) {
      const passwordHash = await argon2.hash(platformPassword);
      await prisma.user.create({
        data: {
          clinicId,
          email: platformEmail,
          username: 'platform',
          name: 'Platform Operator',
          passwordHash,
          status: 'ACTIVE',
          staffType: null,
          roles: { create: { roleId: superRoleId } },
        },
      });
      console.log(`Created SUPER_ADMIN user: ${platformEmail}`);
      console.log(`   Default password: ${platformPassword}`);
    } else {
      const hasSuper = await prisma.userRole.findFirst({
        where: { userId: existingPlatform.id, roleId: superRoleId },
      });
      if (!hasSuper) {
        await prisma.userRole.create({
          data: { userId: existingPlatform.id, roleId: superRoleId },
        });
        console.log(`Linked SUPER_ADMIN role to ${platformEmail}`);
      } else {
        console.log(`SUPER_ADMIN user already exists: ${platformEmail}`);
      }
    }
  }

  console.log('Seeding ENT therapy catalog...');
  await seedEntTherapyCatalog(prisma);

  console.log('Seeding lab procedures...');
  await seedLabProcedures(prisma);
  await seedLabBilling(prisma);

  console.log('Seeding WhatsApp message templates...');
  const templates = [
    {
      name: 'appointment_confirmation',
      type: 'GENERIC' as const,
      body: 'Hi {{patientName}}, your appointment with {{providerName}} is confirmed for {{when}}.',
    },
    {
      name: 'appointment_reminder_24h',
      type: 'APPOINTMENT_REMINDER' as const,
      body: 'Reminder: {{patientName}}, you have an appointment {{timing}} with {{providerName}} at {{when}}.',
    },
    {
      name: 'appointment_reminder_1h',
      type: 'APPOINTMENT_REMINDER' as const,
      body: 'Your appointment with {{providerName}} is {{timing}} at {{when}}. Please arrive 10 mins early.',
    },
    {
      name: 'therapy_session_confirmation',
      type: 'GENERIC' as const,
      body: 'Hi {{patientName}}, your therapy session "{{title}}" is scheduled for {{when}} with {{therapistName}}.',
    },
    {
      name: 'therapy_reminder',
      type: 'THERAPY_REMINDER' as const,
      body: 'Reminder: Therapy session "{{title}}" with {{therapistName}} is {{timing}} ({{when}}).',
    },
    {
      name: 'invoice_notification',
      type: 'INVOICE' as const,
      body: 'Hi {{patientName}}, invoice {{invoiceNumber}} for ₹{{amount}} was generated on {{date}}.',
    },
    {
      name: 'payment_receipt',
      type: 'PAYMENT_RECEIPT' as const,
      body: 'Hi {{patientName}}, payment of ₹{{amount}} received for invoice {{invoiceNumber}} on {{date}}. Method: {{method}}.',
    },
  ];
  for (const template of templates) {
    await prisma.messageTemplate.upsert({
      where: { clinicId_name: { clinicId, name: template.name } },
      update: { body: template.body, type: template.type, isActive: true },
      create: { ...template, clinicId, language: 'en', isActive: true },
    });
  }
  console.log(`   - ${templates.length} WhatsApp templates seeded`);

  console.log('Seeding inventory catalog...');
  const consumables = await prisma.productCategory.upsert({
    where: { clinicId_name: { clinicId, name: 'Consumables' } },
    update: {},
    create: { clinicId, name: 'Consumables' },
  });
  const therapyAids = await prisma.productCategory.upsert({
    where: { clinicId_name: { clinicId, name: 'Therapy Aids' } },
    update: {},
    create: { clinicId, name: 'Therapy Aids' },
  });

  const supplier = await prisma.supplier.findFirst({ where: { clinicId, name: 'Clinic Supplies Co' } });
  const clinicSupplier = supplier || await prisma.supplier.create({
    data: {
      clinicId,
      name: 'Clinic Supplies Co',
      contact: 'Procurement',
      phone: '9000000000',
      email: 'supplies@hislite.local',
      isActive: true,
    },
  });

  async function seedProduct(data: {
    sku: string;
    name: string;
    categoryId: string;
    unitPrice: number;
    taxRate: number;
    lowStockThreshold: number;
    opening: number;
    unitCost: number;
  }) {
    const existing = await prisma.product.findUnique({ where: { clinicId_sku: { clinicId, sku: data.sku } } });
    if (existing) return existing;
    const product = await prisma.product.create({
      data: {
        clinicId,
        sku: data.sku,
        name: data.name,
        categoryId: data.categoryId,
        unitPrice: data.unitPrice,
        taxRate: data.taxRate,
        lowStockThreshold: data.lowStockThreshold,
        isActive: true,
      },
    });
    await prisma.stockTransaction.create({
      data: {
        clinicId,
        productId: product.id,
        supplierId: clinicSupplier.id,
        type: 'PURCHASE',
        quantity: data.opening,
        balance: data.opening,
        unitCost: data.unitCost,
        note: 'Opening stock',
      },
    });
    return product;
  }

  await seedProduct({
    sku: 'HA-BATT-13',
    name: 'Hearing aid batteries (pack of 6)',
    categoryId: consumables.id,
    unitPrice: 180,
    taxRate: 18,
    lowStockThreshold: 10,
    opening: 48,
    unitCost: 90,
  });
  await seedProduct({
    sku: 'TBAND-MED',
    name: 'TheraBand medium resistance',
    categoryId: therapyAids.id,
    unitPrice: 450,
    taxRate: 12,
    lowStockThreshold: 5,
    opening: 12,
    unitCost: 220,
  });
  await seedProduct({
    sku: 'ST-WS-01',
    name: 'Speech therapy worksheet pack',
    categoryId: therapyAids.id,
    unitPrice: 250,
    taxRate: 0,
    lowStockThreshold: 8,
    opening: 6,
    unitCost: 80,
  });
  console.log('   - Inventory catalog seeded');

  console.log('Seeding dashboard widgets...');
  const widgets = [
    { key: 'total_patients', title: 'Total Patients', category: 'PATIENT' as const },
    { key: 'today_appointments', title: "Today's Appointments", category: 'OPERATIONS' as const },
    { key: 'waiting_queue', title: 'Waiting Queue', category: 'OPERATIONS' as const },
    { key: 'today_op', title: 'OP Cases Today', category: 'OPERATIONS' as const },
    { key: 'active_therapy', title: 'Active Therapy Cases', category: 'THERAPY' as const },
    { key: 'today_revenue', title: "Today's Revenue", category: 'FINANCE' as const },
    { key: 'outstanding', title: 'Outstanding', category: 'FINANCE' as const },
    { key: 'low_stock', title: 'Low Stock', category: 'INVENTORY' as const },
    { key: 'whatsapp', title: 'WhatsApp Queue', category: 'COMMUNICATION' as const },
    { key: 'ai_usage', title: 'AI Usage Today', category: 'AI' as const },
  ];
  for (const widget of widgets) {
    await prisma.dashboardWidget.upsert({
      where: { key: widget.key },
      update: { title: widget.title, category: widget.category, isSystem: true },
      create: { ...widget, isSystem: true },
    });
  }
  console.log(`   - ${widgets.length} dashboard widgets seeded`);

  console.log('Seeding invoice letterhead settings...');
  const settings = [
    { key: 'clinic.name', group: 'clinic', value: '' },
    { key: 'clinic.address', group: 'clinic', value: '' },
    { key: 'clinic.phone', group: 'clinic', value: '' },
    { key: 'clinic.email', group: 'clinic', value: '' },
    { key: 'clinic.gstin', group: 'clinic', value: '' },
    { key: 'clinic.state', group: 'clinic', value: '' },
    { key: 'clinic.logoText', group: 'clinic', value: '' },
    { key: 'invoice.title', group: 'invoice', value: 'Tax Invoice' },
    { key: 'invoice.terms', group: 'invoice', value: 'Exempted from Sales Tax.\nReceived the above goods in sound condition & correct quantity.\nGoods once sold cannot be taken back.' },
    { key: 'billing.defaultTaxRate', group: 'billing', value: 18 },
    { key: 'billing.currency', group: 'billing', value: 'INR' },
  ];
  for (const setting of settings) {
    await prisma.setting.upsert({
      where: { clinicId_key: { clinicId, key: setting.key } },
      update: { value: setting.value, group: setting.group },
      create: { ...setting, clinicId },
    });
  }
  console.log(`   - ${settings.length} settings seeded`);

  await seedSubscriptionCatalog(prisma);

  await seedHearingAidCatalog(prisma);
  await seedIndianDemoData(prisma);
  await seedEntTherapyDemoCases(prisma);
  await seedFortyFiveMinuteSlots(prisma);
  await seedUpcomingTherapyAppointments(prisma);
}

main()
  .catch((e) => {
    console.error('��� Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });