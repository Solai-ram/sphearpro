import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';

const DEFAULT_CLINIC_ID = 'cldefault00000000000000001';

function atLocal(dayOffset: number, hour: number, minute = 0) {
  const d = new Date();
  d.setDate(d.getDate() + dayOffset);
  d.setHours(hour, minute, 0, 0);
  return d;
}

function ymd(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

const EXTRA_DOCTORS = [
  { email: 'rajesh.sharma@hislite.local', name: 'Dr. Rajesh Sharma', specialization: 'General Practice', phone: '9849011110' },
  { email: 'neha.kapoor@hislite.local', name: 'Dr. Neha Kapoor', specialization: 'Audiology', phone: '9849011111' },
  { email: 'suresh.nair@hislite.local', name: 'Dr. Suresh Nair', specialization: 'ENT', phone: '9849011112' },
  { email: 'priya.desai@hislite.local', name: 'Dr. Priya Desai', specialization: 'Speech & Hearing', phone: '9849011113' },
  { email: 'arun.mehta@hislite.local', name: 'Dr. Arun Mehta', specialization: 'Paediatric ENT', phone: '9849011114' },
];

/**
 * Ensures ~7 provider doctors, then reseeds upcoming SCHEDULED therapy sessions
 * with no doctor+time double-booking. Same patient may see different doctors on
 * the same day at different times.
 */
export async function seedUpcomingTherapyAppointments(prisma: PrismaClient) {
  const clinicId = DEFAULT_CLINIC_ID;
  const doctorRole = await prisma.role.findFirst({ where: { name: 'DOCTOR' } });
  const staffPassword = await argon2.hash(process.env.STAFF_PASSWORD || 'Staff@12345');

  for (const doctor of EXTRA_DOCTORS) {
    let user = await prisma.user.findUnique({ where: { email: doctor.email } });
    if (!user) {
      user = await prisma.user.create({
        data: {
          clinicId,
          email: doctor.email,
          username: doctor.email.split('@')[0],
          name: doctor.name,
          passwordHash: staffPassword,
          status: 'ACTIVE',
          staffType: 'DOCTOR',
        },
      });
    }
    if (doctorRole) {
      await prisma.userRole.upsert({
        where: { userId_roleId: { userId: user.id, roleId: doctorRole.id } },
        update: {},
        create: { userId: user.id, roleId: doctorRole.id },
      });
    }
    const existingStaff = await prisma.staffProfile.findFirst({
      where: { clinicId, OR: [{ userId: user.id }, { email: doctor.email }, { name: doctor.name }] },
    });
    if (existingStaff) {
      await prisma.staffProfile.update({
        where: { id: existingStaff.id },
        data: {
          userId: user.id,
          name: doctor.name,
          staffType: 'DOCTOR',
          specialization: doctor.specialization,
          department: 'OPD',
          phone: doctor.phone,
          email: doctor.email,
          isProvider: true,
        },
      });
    } else {
      await prisma.staffProfile.create({
        data: {
          clinicId,
          userId: user.id,
          name: doctor.name,
          staffType: 'DOCTOR',
          specialization: doctor.specialization,
          department: 'OPD',
          phone: doctor.phone,
          email: doctor.email,
          isProvider: true,
        },
      });
    }
  }

  const doctors = await prisma.staffProfile.findMany({
    where: { clinicId, staffType: 'DOCTOR', isProvider: true },
    orderBy: { name: 'asc' },
  });

  // Weekly hours so day board / availability show them
  for (const doctor of doctors) {
    for (let dayOfWeek = 1; dayOfWeek <= 6; dayOfWeek += 1) {
      const row = await prisma.providerSchedule.findFirst({
        where: { staffId: doctor.id, dayOfWeek },
      });
      if (!row) {
        await prisma.providerSchedule.create({
          data: {
            staffId: doctor.id,
            dayOfWeek,
            startTime: '09:00',
            endTime: '17:00',
            isAvailable: true,
          },
        });
      }
    }
  }

  const cases = await prisma.therapyCase.findMany({
    where: { clinicId, status: 'ACTIVE' },
    include: {
      patient: { select: { id: true, name: true, patientNumber: true } },
      packages: { orderBy: { purchasedAt: 'desc' }, take: 1 },
    },
    orderBy: { createdAt: 'asc' },
  });

  if (!cases.length || !doctors.length) {
    console.log('   - Need active therapy cases and doctors — skip upcoming appointment seed');
    return { created: 0, cleared: 0 };
  }

  const from = atLocal(0, 0, 0);
  const cleared = await prisma.therapySession.deleteMany({
    where: {
      status: 'SCHEDULED',
      scheduledAt: { gte: from },
    },
  });

  // Build conflict-free plan on 45-minute clinic slots.
  // Same patient may appear under different doctors on the same day at different times.
  const dayPlan: Array<{ day: number; starts: Array<{ hour: number; minute: number }> }> = [
    {
      day: 0,
      starts: [
        { hour: 9, minute: 0 }, { hour: 9, minute: 45 }, { hour: 10, minute: 30 }, { hour: 11, minute: 15 },
        { hour: 12, minute: 0 }, { hour: 14, minute: 15 }, { hour: 15, minute: 0 }, { hour: 15, minute: 45 }, { hour: 16, minute: 30 },
      ],
    },
    {
      day: 1,
      starts: [
        { hour: 9, minute: 0 }, { hour: 9, minute: 45 }, { hour: 10, minute: 30 }, { hour: 11, minute: 15 },
        { hour: 14, minute: 15 }, { hour: 15, minute: 45 },
      ],
    },
    {
      day: 2,
      starts: [
        { hour: 9, minute: 0 }, { hour: 10, minute: 30 }, { hour: 11, minute: 15 }, { hour: 15, minute: 0 }, { hour: 16, minute: 30 },
      ],
    },
    {
      day: 3,
      starts: [
        { hour: 9, minute: 45 }, { hour: 11, minute: 15 }, { hour: 14, minute: 15 }, { hour: 16, minute: 30 },
      ],
    },
    {
      day: 4,
      starts: [{ hour: 9, minute: 0 }, { hour: 11, minute: 15 }, { hour: 15, minute: 0 }],
    },
    {
      day: 5,
      starts: [{ hour: 10, minute: 30 }, { hour: 14, minute: 15 }, { hour: 16, minute: 30 }],
    },
    {
      day: 7,
      starts: [
        { hour: 9, minute: 0 }, { hour: 9, minute: 45 }, { hour: 10, minute: 30 }, { hour: 15, minute: 0 },
      ],
    },
    {
      day: 8,
      starts: [{ hour: 10, minute: 30 }, { hour: 14, minute: 15 }],
    },
    {
      day: 10,
      starts: [{ hour: 9, minute: 0 }, { hour: 11, minute: 15 }, { hour: 16, minute: 30 }],
    },
    {
      day: 14,
      starts: [{ hour: 10, minute: 30 }, { hour: 11, minute: 15 }, { hour: 15, minute: 0 }],
    },
  ];

  const occupied = new Set<string>(); // doctorId|iso
  const patientOccupied = new Set<string>(); // patientId|iso
  let created = 0;
  let caseCursor = 0;
  let doctorCursor = 0;

  for (const plan of dayPlan) {
    for (const start of plan.starts) {
      const scheduledAt = atLocal(plan.day, start.hour, start.minute);
      const timeKey = scheduledAt.toISOString();

      let assigned = false;
      for (let attempt = 0; attempt < doctors.length; attempt += 1) {
        const doctor = doctors[(doctorCursor + attempt) % doctors.length];
        const doctorKey = `${doctor.id}|${timeKey}`;
        if (occupied.has(doctorKey)) continue;

        let therapyCase = null as (typeof cases)[number] | null;
        for (let c = 0; c < cases.length; c += 1) {
          const candidate = cases[(caseCursor + c) % cases.length];
          const patientKey = `${candidate.patientId}|${timeKey}`;
          if (!patientOccupied.has(patientKey)) {
            therapyCase = candidate;
            caseCursor = (caseCursor + c + 1) % cases.length;
            break;
          }
        }
        if (!therapyCase) break;

        await prisma.therapySession.create({
          data: {
            clinicId,
            therapyCaseId: therapyCase.id,
            patientPackageId: therapyCase.packages[0]?.id || null,
            therapistId: therapyCase.therapistId,
            doctorId: doctor.id,
            scheduledAt,
            status: 'SCHEDULED',
          },
        });
        occupied.add(doctorKey);
        patientOccupied.add(`${therapyCase.patientId}|${timeKey}`);
        doctorCursor = (doctorCursor + attempt + 1) % doctors.length;
        created += 1;
        assigned = true;
        break;
      }

      if (!assigned) {
        doctorCursor = (doctorCursor + 1) % doctors.length;
      }
    }
  }

  // Demo: same patient, same day, two different doctors at different 45-min slots
  if (cases[0] && doctors.length >= 2) {
    const demoCase = cases[0];
    const demoSlots = [
      { hour: 9, minute: 0, doctor: doctors[0] },
      { hour: 11, minute: 15, doctor: doctors[1] },
    ];
    for (const slot of demoSlots) {
      const scheduledAt = atLocal(0, slot.hour, slot.minute);
      const timeKey = scheduledAt.toISOString();
      const doctorKey = `${slot.doctor.id}|${timeKey}`;
      const patientKey = `${demoCase.patientId}|${timeKey}`;
      if (occupied.has(doctorKey) || patientOccupied.has(patientKey)) continue;

      await prisma.therapySession.create({
        data: {
          clinicId,
          therapyCaseId: demoCase.id,
          patientPackageId: demoCase.packages[0]?.id || null,
          therapistId: demoCase.therapistId,
          doctorId: slot.doctor.id,
          scheduledAt,
          status: 'SCHEDULED',
        },
      });
      occupied.add(doctorKey);
      patientOccupied.add(patientKey);
      created += 1;
    }
  }

  console.log(
    `   - Doctors ready: ${doctors.length}; cleared ${cleared.count} old upcoming; created ${created} clash-free 45-min sessions (${ymd(from)} → ${ymd(atLocal(14, 0, 0))})`,
  );
  return { created, cleared: cleared.count, doctors: doctors.length };
}
