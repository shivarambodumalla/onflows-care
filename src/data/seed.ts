import { addDays, addMinutes, now, startOfDay, toISODate } from '@/lib/dates'
import { createRandom, type Random } from '@/lib/id'
import type {
  AppNotification,
  Appointment,
  AppointmentStatus,
  Branch,
  CalendarBlock,
  ClinicSettings,
  Database,
  Gender,
  ID,
  Lead,
  LeadSource,
  LeadStage,
  Note,
  Patient,
  PatientDocument,
  PrescriptionItem,
  Reminder,
  ReminderRule,
  Task,
  TimelineEvent,
  Treatment,
  TreatmentType,
  User,
} from './types'
import { runFollowUpEngine } from './followUpEngine'

/**
 * Deterministic demo data.
 *
 * Two rules govern everything here:
 *   1. Fixed PRNG seed — every reset produces the identical dataset, so PRD
 *      examples and acceptance criteria stay valid.
 *   2. All dates are relative to *today* — a demo opened six months from now
 *      still shows a busy clinic day, overdue follow-ups and a full history,
 *      rather than a frozen snapshot of the day it was written.
 */

export const SEED_VERSION = 1

const FIRST_NAMES = [
  'Aarav', 'Vivaan', 'Aditya', 'Vihaan', 'Arjun', 'Reyansh', 'Krishna', 'Ishaan',
  'Rohan', 'Kabir', 'Ananya', 'Diya', 'Aadhya', 'Saanvi', 'Pari', 'Anika',
  'Navya', 'Kiara', 'Myra', 'Sara', 'Rahul', 'Priya', 'Neha', 'Vikram',
  'Sneha', 'Karthik', 'Meera', 'Ravi', 'Divya', 'Suresh', 'Lakshmi', 'Ganesh',
  'Deepa', 'Manoj', 'Kavya', 'Sanjay', 'Pooja', 'Nikhil', 'Shreya', 'Amit',
]

const LAST_NAMES = [
  'Sharma', 'Verma', 'Patel', 'Reddy', 'Nair', 'Menon', 'Iyer', 'Rao',
  'Gupta', 'Singh', 'Kumar', 'Desai', 'Joshi', 'Kulkarni', 'Pillai', 'Shetty',
  'Bhat', 'Naidu', 'Chopra', 'Malhotra', 'Bose', 'Ghosh', 'Mehta', 'Agarwal',
]

const CONDITIONS = [
  'Hypertension', 'Type 2 diabetes', 'Chronic lower back pain', 'Migraine',
  'Cervical spondylosis', 'Asthma', 'Hypothyroidism', 'Osteoarthritis',
  'Frozen shoulder', 'Sciatica', 'Plantar fasciitis', 'Anxiety',
]

const ALLERGIES = ['Penicillin', 'Sulfa drugs', 'Latex', 'Peanuts', 'Dust mites', 'Aspirin']

const TAGS = ['VIP', 'Corporate', 'Insurance', 'Senior citizen', 'Package', 'Referral partner']

const STREETS = [
  '100 Feet Road', '12th Main', 'CMH Road', '80 Feet Road', 'Church Street',
  '5th Cross', 'Sarjapur Road', 'Bannerghatta Road', 'Old Airport Road',
]

const AREAS = ['Indiranagar', 'Koramangala', 'HSR Layout', 'Jayanagar', 'Whitefield', 'BTM Layout']

const MEDICATIONS: { name: string; dosage: string; frequency: string }[] = [
  { name: 'Ibuprofen', dosage: '400mg', frequency: 'Twice daily after food' },
  { name: 'Paracetamol', dosage: '650mg', frequency: 'Three times daily' },
  { name: 'Chlorzoxazone', dosage: '250mg', frequency: 'Twice daily' },
  { name: 'Vitamin D3', dosage: '60000 IU', frequency: 'Once weekly' },
  { name: 'Calcium + D3', dosage: '500mg', frequency: 'Once daily' },
  { name: 'Pantoprazole', dosage: '40mg', frequency: 'Once daily before food' },
  { name: 'Methylcobalamin', dosage: '1500mcg', frequency: 'Once daily' },
]

const OBSERVATIONS = [
  'Reduced tenderness compared to previous visit. Range of motion improving.',
  'Patient reports pain down from 7/10 to 4/10 since last session.',
  'Mild inflammation persists. Advised to continue home exercises.',
  'Good progress. Posture correction showing measurable improvement.',
  'Stiffness on waking reported. Adjusted the exercise plan accordingly.',
  'No new complaints. Vitals within normal range.',
  'Patient compliant with the plan. Recommend continuing current protocol.',
]

const ADJUSTMENTS = [
  'Reduced session intensity — patient reported soreness after the last visit.',
  'Added heat therapy before the main session.',
  'Extended session by 10 minutes to cover the lumbar region.',
  'Switched to a gentler technique given the reported flare-up.',
]

const LOST_REASONS = [
  'Chose a clinic closer to home',
  'Cost concerns',
  'No response after repeated follow-ups',
  'Went ahead with a different treatment',
  'Relocated out of the city',
]

const LEAD_NOTE_BODIES = [
  'Called and explained the treatment plan. Asked for time to decide.',
  'Sent the price list over WhatsApp.',
  'Interested but wants a weekend slot.',
  'Asked about instalment options.',
  'Requested a callback next week.',
  'Walked in for an enquiry, took a brochure.',
]

const DEVICES = [
  'Chrome on macOS',
  'Chrome on Windows',
  'Safari on iPhone',
  'Edge on Windows',
  'Firefox on Ubuntu',
]

/* -------------------------------------------------------------------------- */

function phone(random: Random): string {
  return `+91 ${random.int(70, 99)}${random.int(100, 999)} ${random.int(10000, 99999)}`
}

function personName(random: Random): string {
  return `${random.pick(FIRST_NAMES)} ${random.pick(LAST_NAMES)}`
}

function emailFor(name: string, random: Random): string {
  const handle = name.toLowerCase().replace(/[^a-z]/g, '.')
  return `${handle}${random.int(1, 99)}@example.com`
}

/* -------------------------------------------------------------------------- */

export function buildSeed(): Database {
  const random = createRandom(20260726)
  const today = startOfDay(new Date())
  const nowISO = now()
  const events: TimelineEvent[] = []

  const event = (e: Omit<TimelineEvent, 'id'>) => {
    events.push({ ...e, id: `evt_${events.length.toString(36)}` })
  }

  /* --- Branches --------------------------------------------------------- */

  const branches: Branch[] = [
    {
      id: 'br_indiranagar',
      name: 'Indiranagar',
      code: 'IND',
      address: '221, 100 Feet Road, Indiranagar, Bengaluru 560038',
      phone: '+91 80 4123 5566',
      opensAt: '09:00',
      closesAt: '19:00',
      // Open seven days. Deliberate: the demo must never open on a dead
      // dashboard just because someone happened to look at it on a Sunday.
      closedDays: [],
      active: true,
    },
    {
      id: 'br_koramangala',
      name: 'Koramangala',
      code: 'KOR',
      address: '48, 5th Block, Koramangala, Bengaluru 560095',
      phone: '+91 80 4123 7788',
      opensAt: '10:00',
      closesAt: '20:00',
      closedDays: [0],
      active: true,
    },
  ]

  const [indiranagar, koramangala] = branches as [Branch, Branch]
  const branchIds = branches.map((b) => b.id)

  /* --- Users ------------------------------------------------------------ */

  const users: User[] = [
    {
      id: 'usr_owner',
      name: 'Dr. Meera Krishnan',
      email: 'meera@onflowscare.com',
      phone: phone(random),
      role: 'owner',
      branchIds,
      active: true,
      lastActiveAt: addMinutes(nowISO, -4).toISOString(),
      createdAt: addDays(today, -900).toISOString(),
    },
    {
      id: 'usr_admin',
      name: 'Rajesh Nair',
      email: 'rajesh@onflowscare.com',
      phone: phone(random),
      role: 'admin',
      branchIds,
      active: true,
      lastActiveAt: addMinutes(nowISO, -22).toISOString(),
      createdAt: addDays(today, -820).toISOString(),
    },
    {
      id: 'usr_doc_1',
      name: 'Dr. Anil Deshpande',
      email: 'anil@onflowscare.com',
      phone: phone(random),
      role: 'doctor',
      branchIds: [indiranagar.id],
      specialisation: 'Musculoskeletal & rehabilitation',
      active: true,
      lastActiveAt: addMinutes(nowISO, -11).toISOString(),
      createdAt: addDays(today, -640).toISOString(),
    },
    {
      id: 'usr_doc_2',
      name: 'Dr. Shalini Rao',
      email: 'shalini@onflowscare.com',
      phone: phone(random),
      role: 'doctor',
      branchIds: [indiranagar.id, koramangala.id],
      specialisation: 'Pain management',
      active: true,
      lastActiveAt: addMinutes(nowISO, -57).toISOString(),
      createdAt: addDays(today, -430).toISOString(),
    },
    {
      id: 'usr_doc_3',
      name: 'Dr. Farhan Qureshi',
      email: 'farhan@onflowscare.com',
      phone: phone(random),
      role: 'doctor',
      branchIds: [koramangala.id],
      specialisation: 'Sports injury',
      active: true,
      lastActiveAt: addMinutes(nowISO, -180).toISOString(),
      createdAt: addDays(today, -300).toISOString(),
    },
    {
      id: 'usr_recep_1',
      name: 'Divya Suresh',
      email: 'divya@onflowscare.com',
      phone: phone(random),
      role: 'receptionist',
      branchIds: [indiranagar.id],
      active: true,
      lastActiveAt: addMinutes(nowISO, -2).toISOString(),
      createdAt: addDays(today, -510).toISOString(),
    },
    {
      id: 'usr_recep_2',
      name: 'Prakash Menon',
      email: 'prakash@onflowscare.com',
      phone: phone(random),
      role: 'receptionist',
      branchIds: [koramangala.id],
      active: true,
      lastActiveAt: addMinutes(nowISO, -35).toISOString(),
      createdAt: addDays(today, -280).toISOString(),
    },
    {
      id: 'usr_manager',
      name: 'Sunita Bhat',
      email: 'sunita@onflowscare.com',
      phone: phone(random),
      role: 'branch_manager',
      branchIds: [koramangala.id],
      active: true,
      lastActiveAt: addMinutes(nowISO, -90).toISOString(),
      createdAt: addDays(today, -390).toISOString(),
    },
    {
      id: 'usr_recep_3',
      name: 'Anjali Pillai',
      email: 'anjali@onflowscare.com',
      phone: phone(random),
      role: 'receptionist',
      branchIds: [indiranagar.id],
      active: false,
      lastActiveAt: addDays(today, -74).toISOString(),
      createdAt: addDays(today, -600).toISOString(),
    },
  ]

  const doctors = users.filter((u) => u.role === 'doctor')
  const receptionists = users.filter((u) => u.role === 'receptionist' && u.active)
  const doctorsByBranch = (branchId: ID) => doctors.filter((d) => d.branchIds.includes(branchId))

  /* --- Sessions --------------------------------------------------------- */

  const sessions: Session_[] = users
    .filter((u) => u.active)
    .flatMap((user, i) => {
      const count = i === 0 ? 2 : 1
      return Array.from({ length: count }, (_, k) => ({
        id: `ses_${user.id}_${k}`,
        userId: user.id,
        device: random.pick(DEVICES),
        ipAddress: `49.${random.int(30, 250)}.${random.int(1, 250)}.${random.int(1, 250)}`,
        startedAt: addMinutes(nowISO, -random.int(30, 2000)).toISOString(),
        lastSeenAt: user.lastActiveAt,
        current: user.id === 'usr_owner' && k === 0,
      }))
    })

  /* --- Treatment catalogue (domain-neutral, configurable) --------------- */

  const treatmentTypes: TreatmentType[] = [
    { id: 'tt_consult', name: 'Initial consultation', category: 'Consultation', durationMinutes: 30, price: 800, defaultFollowUpDays: 7, requiresDoctor: true, colour: 'brand', active: true },
    { id: 'tt_review', name: 'Review consultation', category: 'Consultation', durationMinutes: 20, price: 500, defaultFollowUpDays: 14, requiresDoctor: true, colour: 'info', active: true },
    { id: 'tt_session', name: 'Therapy session', category: 'Treatment', durationMinutes: 45, price: 1200, defaultFollowUpDays: 3, requiresDoctor: false, colour: 'accent', active: true },
    { id: 'tt_adjustment', name: 'Manual adjustment', category: 'Treatment', durationMinutes: 30, price: 1500, defaultFollowUpDays: 7, requiresDoctor: true, colour: 'success', active: true },
    { id: 'tt_assessment', name: 'Full assessment', category: 'Diagnostics', durationMinutes: 60, price: 2500, defaultFollowUpDays: 30, requiresDoctor: true, colour: 'warning', active: true },
    { id: 'tt_package', name: 'Package session', category: 'Treatment', durationMinutes: 45, price: 900, defaultFollowUpDays: 3, requiresDoctor: false, colour: 'accent', active: true },
    { id: 'tt_teleconsult', name: 'Teleconsultation', category: 'Consultation', durationMinutes: 15, price: 400, defaultFollowUpDays: 10, requiresDoctor: true, colour: 'info', active: false },
  ]

  const activeTypes = treatmentTypes.filter((t) => t.active)

  /* --- Reminder rules --------------------------------------------------- */

  const reminderRules: ReminderRule[] = [
    {
      id: 'rr_post_treatment',
      name: 'Post-treatment check-in',
      trigger: 'after_treatment',
      offsetDays: 3,
      channels: ['in_app', 'whatsapp'],
      assigneeRole: 'receptionist',
      escalateAfterDays: 2,
      treatmentTypeIds: [],
      active: true,
      createdAt: addDays(today, -400).toISOString(),
    },
    {
      id: 'rr_review_due',
      name: 'Review consultation due',
      trigger: 'after_treatment',
      offsetDays: 14,
      channels: ['in_app', 'email'],
      assigneeRole: 'receptionist',
      escalateAfterDays: 3,
      treatmentTypeIds: ['tt_consult', 'tt_assessment'],
      active: true,
      createdAt: addDays(today, -400).toISOString(),
    },
    {
      id: 'rr_appointment_reminder',
      name: 'Appointment reminder',
      trigger: 'before_appointment',
      offsetDays: -1,
      channels: ['whatsapp', 'sms'],
      assigneeRole: 'receptionist',
      escalateAfterDays: 0,
      treatmentTypeIds: [],
      active: true,
      createdAt: addDays(today, -350).toISOString(),
    },
    {
      id: 'rr_lapsed',
      name: 'Lapsed patient win-back',
      trigger: 'no_visit_since',
      offsetDays: 90,
      channels: ['in_app', 'email'],
      assigneeRole: 'branch_manager',
      escalateAfterDays: 7,
      treatmentTypeIds: [],
      active: true,
      createdAt: addDays(today, -200).toISOString(),
    },
    {
      id: 'rr_lead_weekly',
      name: 'Weekly lead follow-up',
      trigger: 'lead_follow_up',
      offsetDays: 7,
      channels: ['in_app'],
      assigneeRole: 'receptionist',
      escalateAfterDays: 4,
      treatmentTypeIds: [],
      active: true,
      createdAt: addDays(today, -300).toISOString(),
    },
    {
      id: 'rr_annual',
      name: 'Annual health check nudge',
      trigger: 'no_visit_since',
      offsetDays: 365,
      channels: ['email'],
      assigneeRole: 'admin',
      escalateAfterDays: 0,
      treatmentTypeIds: [],
      active: false,
      createdAt: addDays(today, -120).toISOString(),
    },
  ]

  /* --- Patients --------------------------------------------------------- */

  const patients: Patient[] = []
  const notes: Note[] = []
  const documents: PatientDocument[] = []

  const PATIENT_COUNT = 124
  const sources: LeadSource[] = ['walk_in', 'phone', 'referral', 'google', 'instagram', 'facebook', 'camp', 'other']

  for (let i = 0; i < PATIENT_COUNT; i++) {
    const name = personName(random)
    const branch = random.chance(0.58) ? indiranagar : koramangala
    const branchDoctors = doctorsByBranch(branch.id)
    // Registration dates spread over ~2 years, weighted towards recent.
    const registeredDaysAgo = Math.floor(Math.pow(random.next(), 1.6) * 700) + 1
    const createdAt = addDays(today, -registeredDaysAgo).toISOString()
    const archived = random.chance(0.05)

    const patient: Patient = {
      id: `pat_${i.toString(36).padStart(3, '0')}`,
      code: `OC-${String(1000 + i)}`,
      name,
      phone: phone(random),
      email: random.chance(0.7) ? emailFor(name, random) : undefined,
      dob: toISODate(addDays(today, -random.int(18, 78) * 365 - random.int(0, 364))),
      gender: random.pick<Gender>(['male', 'female', 'female', 'male', 'other']),
      address: `${random.int(1, 300)}, ${random.pick(STREETS)}, ${random.pick(AREAS)}`,
      branchId: branch.id,
      primaryDoctorId: branchDoctors.length > 0 ? random.pick(branchDoctors).id : undefined,
      status: archived ? 'archived' : 'active',
      tags: random.chance(0.3) ? random.sample(TAGS, random.int(1, 2)) : [],
      allergies: random.chance(0.25) ? random.sample(ALLERGIES, random.int(1, 2)) : [],
      conditions: random.chance(0.6) ? random.sample(CONDITIONS, random.int(1, 3)) : [],
      emergencyContactName: random.chance(0.45) ? personName(random) : undefined,
      emergencyContactPhone: random.chance(0.45) ? phone(random) : undefined,
      source: random.pick(sources),
      referredBy: random.chance(0.15) ? personName(random) : undefined,
      createdAt,
      updatedAt: createdAt,
      archivedAt: archived ? addDays(createdAt, random.int(30, 200)).toISOString() : undefined,
      archiveReason: archived
        ? random.pick(['Moved out of the city', 'Duplicate record', 'Requested closure', 'No contact for 2 years'])
        : undefined,
    }

    patients.push(patient)

    event({
      at: createdAt,
      actorId: random.pick(receptionists).id,
      branchId: branch.id,
      entity: 'patient',
      entityId: patient.id,
      action: 'created',
      summary: `Registered ${patient.name} (${patient.code})`,
      patientId: patient.id,
      audit: false,
    })

    if (patient.archivedAt) {
      event({
        at: patient.archivedAt,
        actorId: 'usr_admin',
        branchId: branch.id,
        entity: 'patient',
        entityId: patient.id,
        action: 'archived',
        summary: `Archived ${patient.name} — ${patient.archiveReason}`,
        patientId: patient.id,
        audit: true,
      })
    }

    // Notes on roughly a third of patients.
    if (random.chance(0.35)) {
      const count = random.int(1, 3)
      for (let n = 0; n < count; n++) {
        const at = addDays(createdAt, random.int(1, Math.max(2, registeredDaysAgo))).toISOString()
        notes.push({
          id: `note_${patient.id}_${n}`,
          patientId: patient.id,
          authorId: random.pick([...doctors, ...receptionists]).id,
          body: random.pick([
            'Patient prefers morning appointments.',
            'Requested the same doctor for all future visits.',
            'Insurance claim under process — collect documents at next visit.',
            'Difficult to reach on phone; prefers WhatsApp.',
            'Accompanied by a family member, needs wheelchair access.',
            'Follow-up call made, patient reports improvement.',
          ]),
          pinned: n === 0 && random.chance(0.3),
          createdAt: at,
        })
      }
    }

    // Documents on roughly a quarter.
    if (random.chance(0.28)) {
      const count = random.int(1, 3)
      for (let d = 0; d < count; d++) {
        const kind = random.pick(['report', 'scan', 'prescription', 'consent', 'invoice'] as const)
        documents.push({
          id: `doc_${patient.id}_${d}`,
          patientId: patient.id,
          name: `${kind === 'scan' ? 'MRI' : kind === 'report' ? 'Blood report' : kind === 'invoice' ? 'Invoice' : kind === 'consent' ? 'Consent form' : 'Prescription'} ${toISODate(addDays(createdAt, random.int(1, 90)))}.pdf`,
          kind,
          sizeKb: random.int(80, 4200),
          uploadedById: random.pick([...doctors, ...receptionists]).id,
          uploadedAt: addDays(createdAt, random.int(1, Math.max(2, registeredDaysAgo))).toISOString(),
          simulated: true,
        })
      }
    }
  }

  const activePatients = patients.filter((p) => p.status === 'active')

  /* --- Appointments & treatments ---------------------------------------- */

  const appointments: Appointment[] = []
  const treatments: Treatment[] = []
  let appointmentIndex = 0

  /**
   * Books one appointment on `day`, always inside the branch's opening hours.
   *
   * Today's statuses fall out of comparing the slot to the real clock, so a
   * demo opened at 2pm shows a live clinic and one opened at 9pm shows a day
   * that has finished — which is the truth, rather than inventing 11pm slots
   * to keep the screen busy.
   */
  const book = (day: Date, patient: Patient): Appointment | null => {
    const branch = branches.find((b) => b.id === patient.branchId)!
    if (branch.closedDays.includes(day.getDay())) return null

    const branchDoctors = doctorsByBranch(branch.id)
    if (branchDoctors.length === 0) return null

    const doctor = patient.primaryDoctorId && random.chance(0.75)
      ? (users.find((u) => u.id === patient.primaryDoctorId) ?? random.pick(branchDoctors))
      : random.pick(branchDoctors)

    const type = random.pick(activeTypes)
    const [openHour, openMinute] = branch.opensAt.split(':').map(Number)
    const slotIndex = random.int(0, Math.floor(((Number(branch.closesAt.split(':')[0]) - (openHour ?? 9)) * 60) / 30) - 2)
    const start = new Date(day)
    start.setHours(openHour ?? 9, (openMinute ?? 0) + slotIndex * 30, 0, 0)

    const walkIn = random.chance(0.14)
    const createdAt = walkIn
      ? addMinutes(start, -random.int(5, 25)).toISOString()
      : addDays(start, -random.int(1, 21)).toISOString()

    // The clerk who took the booking works at that branch.
    const branchReception = receptionists.filter((r) => r.branchIds.includes(branch.id))
    const bookedBy = random.pick(branchReception.length > 0 ? branchReception : receptionists)

    const appointment: Appointment = {
      id: `apt_${(appointmentIndex++).toString(36).padStart(4, '0')}`,
      patientId: patient.id,
      doctorId: doctor.id,
      branchId: branch.id,
      treatmentTypeId: type.id,
      startAt: start.toISOString(),
      endAt: addMinutes(start, type.durationMinutes).toISOString(),
      status: 'scheduled',
      kind: walkIn ? 'walk_in' : 'scheduled',
      reason: random.chance(0.4)
        ? random.pick(['Persistent pain', 'Routine review', 'New complaint', 'Package session', 'Post-injury check'])
        : undefined,
      createdById: bookedBy.id,
      createdAt,
    }

    appointments.push(appointment)
    return appointment
  }

  const HISTORY_DAYS = 120
  const FUTURE_DAYS = 35

  for (let offset = -HISTORY_DAYS; offset <= FUTURE_DAYS; offset++) {
    const day = addDays(today, offset)
    const weekday = day.getDay()

    // Busier midweek, quieter at weekends. `book()` drops anything landing on
    // a day its branch is closed, so Sundays naturally fall to Indiranagar.
    let volume =
      weekday === 0 ? random.int(4, 8) : weekday === 6 ? random.int(5, 9) : random.int(7, 14)
    // Today is always busy — the dashboard is the first thing anyone sees.
    if (offset === 0) volume = random.int(14, 19)
    if (offset > 14) volume = random.int(2, 5) // the far future is only partly booked

    for (let n = 0; n < volume; n++) {
      const patient = random.pick(activePatients)

      const appointment = book(day, patient)
      if (!appointment) continue

      const type = treatmentTypes.find((t) => t.id === appointment.treatmentTypeId)!

      /* Past appointments resolve to a realistic mix of outcomes. */
      if (offset < 0) {
        const roll = random.next()
        let status: AppointmentStatus
        if (roll < 0.8) status = 'completed'
        else if (roll < 0.89) status = 'no_show'
        else if (roll < 0.97) status = 'cancelled'
        else status = 'completed'

        appointment.status = status

        if (status === 'completed') {
          appointment.checkedInAt = addMinutes(appointment.startAt, -random.int(0, 12)).toISOString()
          appointment.startedAt = addMinutes(appointment.startAt, random.int(0, 15)).toISOString()
          appointment.completedAt = addMinutes(appointment.endAt, random.int(-5, 15)).toISOString()

          const nextVisit = random.chance(0.72)
            ? type.defaultFollowUpDays + random.int(-2, 7)
            : undefined

          const treatment: Treatment = {
            id: `trt_${appointment.id.slice(4)}`,
            patientId: patient.id,
            appointmentId: appointment.id,
            doctorId: appointment.doctorId,
            branchId: appointment.branchId,
            treatmentTypeId: type.id,
            performedAt: appointment.completedAt,
            observations: random.pick(OBSERVATIONS),
            adjustment: random.chance(0.22) ? random.pick(ADJUSTMENTS) : undefined,
            doctorNotes: random.chance(0.4)
              ? random.pick([
                  'Continue current plan. Reassess in two weeks.',
                  'Consider imaging if no improvement by the next visit.',
                  'Patient is anxious about the prognosis — reassured.',
                  'Home exercise compliance is poor. Reinforced at this visit.',
                ])
              : undefined,
            prescription: random.chance(0.55)
              ? Array.from({ length: random.int(1, 3) }, (_, k): PrescriptionItem => {
                  const med = random.pick(MEDICATIONS)
                  return {
                    id: `rx_${appointment.id}_${k}`,
                    medication: med.name,
                    dosage: med.dosage,
                    frequency: med.frequency,
                    durationDays: random.pick([3, 5, 7, 10, 14, 30]),
                    instructions: random.chance(0.3) ? 'Stop if any discomfort and call the clinic.' : undefined,
                  }
                })
              : [],
            nextVisitInDays: nextVisit && nextVisit > 0 ? nextVisit : undefined,
            attachmentIds: [],
            createdAt: appointment.completedAt,
          }

          treatments.push(treatment)
          appointment.treatmentId = treatment.id

          event({
            at: treatment.performedAt,
            actorId: treatment.doctorId,
            branchId: treatment.branchId,
            entity: 'treatment',
            entityId: treatment.id,
            action: 'recorded',
            summary: `${type.name} recorded for ${patient.name}`,
            patientId: patient.id,
            audit: false,
          })
        }

        if (status === 'no_show') {
          event({
            at: appointment.endAt,
            actorId: random.pick(receptionists).id,
            branchId: appointment.branchId,
            entity: 'appointment',
            entityId: appointment.id,
            action: 'no_show',
            summary: `${patient.name} did not attend ${type.name}`,
            patientId: patient.id,
            audit: false,
          })
        }

        if (status === 'cancelled') {
          appointment.cancelledAt = addDays(appointment.startAt, -random.int(0, 3)).toISOString()
          appointment.cancelReason = random.pick([
            'Patient unavailable',
            'Doctor on leave',
            'Rescheduled by patient',
            'Personal emergency',
          ])
          event({
            at: appointment.cancelledAt,
            actorId: random.pick(receptionists).id,
            branchId: appointment.branchId,
            entity: 'appointment',
            entityId: appointment.id,
            action: 'cancelled',
            summary: `Cancelled ${type.name} for ${patient.name} — ${appointment.cancelReason}`,
            patientId: patient.id,
            audit: false,
          })
        }
      } else if (offset === 0) {
        /* Today: a live clinic — some done, some waiting, one in progress. */
        const startMs = new Date(appointment.startAt).getTime()
        const nowMs = Date.now()
        if (startMs < nowMs - 45 * 60_000) {
          appointment.status = random.chance(0.85) ? 'completed' : 'no_show'
          if (appointment.status === 'completed') {
            appointment.checkedInAt = addMinutes(appointment.startAt, -5).toISOString()
            appointment.completedAt = appointment.endAt
            const treatment: Treatment = {
              id: `trt_${appointment.id.slice(4)}`,
              patientId: patient.id,
              appointmentId: appointment.id,
              doctorId: appointment.doctorId,
              branchId: appointment.branchId,
              treatmentTypeId: type.id,
              performedAt: appointment.completedAt,
              observations: random.pick(OBSERVATIONS),
              prescription: [],
              nextVisitInDays: type.defaultFollowUpDays,
              attachmentIds: [],
              createdAt: appointment.completedAt,
            }
            treatments.push(treatment)
            appointment.treatmentId = treatment.id
          }
        } else if (startMs < nowMs) {
          appointment.status = random.chance(0.5) ? 'in_progress' : 'checked_in'
          appointment.checkedInAt = addMinutes(appointment.startAt, -8).toISOString()
          if (appointment.status === 'in_progress') {
            appointment.startedAt = appointment.startAt
          }
        } else if (startMs < nowMs + 30 * 60_000 && random.chance(0.5)) {
          appointment.status = 'checked_in'
          appointment.checkedInAt = addMinutes(nowISO, -random.int(1, 15)).toISOString()
        }
      }

      event({
        at: appointment.createdAt,
        actorId: appointment.createdById,
        branchId: appointment.branchId,
        entity: 'appointment',
        entityId: appointment.id,
        action: appointment.kind === 'walk_in' ? 'walk_in_registered' : 'booked',
        summary:
          appointment.kind === 'walk_in'
            ? `Walk-in registered for ${patient.name}`
            : `Booked ${type.name} for ${patient.name}`,
        patientId: patient.id,
        audit: false,
      })
    }
  }

  /* A few reschedules, linked in both directions. */
  const reschedulable = appointments.filter((a) => a.status === 'cancelled').slice(0, 12)
  for (const original of reschedulable) {
    const patient = patients.find((p) => p.id === original.patientId)!
    const replacement = book(addDays(original.startAt, random.int(2, 10)), patient)
    if (!replacement) continue
    replacement.rescheduledFromId = original.id
    replacement.treatmentTypeId = original.treatmentTypeId
    original.rescheduledToId = replacement.id
    if (new Date(replacement.startAt).getTime() < Date.now()) replacement.status = 'completed'
  }

  /* --- Leads ------------------------------------------------------------ */

  const leads: Lead[] = []
  const LEAD_COUNT = 46
  const stages: LeadStage[] = ['enquiry', 'enquiry', 'interested', 'interested', 'booked', 'converted', 'lost']

  for (let i = 0; i < LEAD_COUNT; i++) {
    const name = personName(random)
    const branch = random.chance(0.55) ? indiranagar : koramangala
    const createdAt = addDays(today, -random.int(1, 90)).toISOString()
    const stage = random.pick(stages)
    const owner = random.pick(receptionists.filter((r) => r.branchIds.includes(branch.id)).length > 0
      ? receptionists.filter((r) => r.branchIds.includes(branch.id))
      : receptionists)

    const noteCount = stage === 'enquiry' ? random.int(0, 1) : random.int(1, 4)
    const lead: Lead = {
      id: `lead_${i.toString(36).padStart(3, '0')}`,
      name,
      phone: phone(random),
      email: random.chance(0.55) ? emailFor(name, random) : undefined,
      source: random.pick(sources),
      interestedInTypeId: random.chance(0.8) ? random.pick(activeTypes).id : undefined,
      stage,
      ownerId: owner.id,
      branchId: branch.id,
      notes: Array.from({ length: noteCount }, (_, n) => ({
        id: `lnote_${i}_${n}`,
        authorId: owner.id,
        body: random.pick(LEAD_NOTE_BODIES),
        createdAt: addDays(createdAt, n * random.int(2, 6)).toISOString(),
      })),
      // Open leads carry a next-follow-up date; some are already overdue.
      nextFollowUpAt:
        stage === 'converted' || stage === 'lost'
          ? undefined
          : addDays(today, random.int(-9, 12)).toISOString(),
      lostReason: stage === 'lost' ? random.pick(LOST_REASONS) : undefined,
      createdAt,
      updatedAt: addDays(createdAt, random.int(0, 20)).toISOString(),
    }

    // Converted leads point at a real patient, so the journey is traceable.
    if (stage === 'converted') {
      const patient = random.pick(activePatients)
      lead.patientId = patient.id
      patient.convertedFromLeadId = lead.id
      patient.source = lead.source
    }
    if (stage === 'booked') {
      const upcoming = appointments.find(
        (a) => a.status === 'scheduled' && a.branchId === branch.id,
      )
      if (upcoming) lead.appointmentId = upcoming.id
    }

    leads.push(lead)

    event({
      at: createdAt,
      actorId: owner.id,
      branchId: branch.id,
      entity: 'lead',
      entityId: lead.id,
      action: 'created',
      summary: `New enquiry from ${lead.name}`,
      leadId: lead.id,
      audit: false,
    })

    if (stage === 'converted') {
      event({
        at: lead.updatedAt,
        actorId: owner.id,
        branchId: branch.id,
        entity: 'lead',
        entityId: lead.id,
        action: 'converted',
        summary: `${lead.name} converted to a patient`,
        leadId: lead.id,
        patientId: lead.patientId,
        audit: false,
      })
    }
  }

  /* --- Reminders from history ------------------------------------------- */

  const reminders: Reminder[] = []
  const postRule = reminderRules.find((r) => r.id === 'rr_post_treatment')!
  const reviewRule = reminderRules.find((r) => r.id === 'rr_review_due')!
  const leadRule = reminderRules.find((r) => r.id === 'rr_lead_weekly')!

  // Only recent treatments generate live follow-ups; older ones are settled.
  for (const treatment of treatments) {
    if (!treatment.nextVisitInDays) continue
    const ageDays = Math.abs(Math.round((Date.now() - new Date(treatment.performedAt).getTime()) / 86_400_000))
    if (ageDays > 40) continue

    const rule =
      treatment.treatmentTypeId === 'tt_consult' || treatment.treatmentTypeId === 'tt_assessment'
        ? reviewRule
        : postRule

    reminders.push({
      id: `rem_${treatment.id.slice(4)}`,
      ruleId: rule.id,
      patientId: treatment.patientId,
      branchId: treatment.branchId,
      dueAt: addDays(treatment.performedAt, treatment.nextVisitInDays).toISOString(),
      status: 'pending',
      channels: rule.channels,
      sourceType: 'treatment',
      sourceId: treatment.id,
      escalated: false,
      createdAt: treatment.performedAt,
    })
  }

  for (const lead of leads) {
    if (!lead.nextFollowUpAt) continue
    reminders.push({
      id: `rem_${lead.id}`,
      ruleId: leadRule.id,
      leadId: lead.id,
      branchId: lead.branchId,
      dueAt: lead.nextFollowUpAt,
      status: 'pending',
      channels: leadRule.channels,
      sourceType: 'lead',
      sourceId: lead.id,
      escalated: false,
      createdAt: lead.updatedAt,
    })
  }

  /* Mark a handful as already handled or snoozed, so the screens aren't uniform. */
  reminders.forEach((reminder, i) => {
    if (i % 11 === 0 && new Date(reminder.dueAt).getTime() < Date.now()) {
      reminder.status = 'completed'
      reminder.completedAt = addDays(reminder.dueAt, 1).toISOString()
    } else if (i % 17 === 0) {
      reminder.status = 'snoozed'
      reminder.snoozedUntil = addDays(today, random.int(1, 6)).toISOString()
      reminder.snoozeReason = random.pick([
        'Patient travelling this week',
        'Asked to be called next month',
        'Waiting on the insurance approval',
      ])
    }
  })

  /* --- Manual tasks ------------------------------------------------------ */

  const tasks: Task[] = []
  const MANUAL_TASKS = 14
  for (let i = 0; i < MANUAL_TASKS; i++) {
    const branch = random.chance(0.5) ? indiranagar : koramangala
    const assignee = random.pick(users.filter((u) => u.active && u.branchIds.includes(branch.id)))
    const patient = random.chance(0.7) ? random.pick(activePatients) : undefined
    const dueOffset = random.int(-6, 10)
    tasks.push({
      id: `task_m_${i.toString(36)}`,
      title: random.pick([
        'Collect insurance documents',
        'Call to confirm tomorrow’s schedule',
        'Chase pending lab report',
        'Send treatment plan over email',
        'Verify address for the home visit',
        'Reconcile yesterday’s payments',
        'Order consumables for the therapy room',
      ]),
      description: random.chance(0.5) ? 'Raised during the morning huddle.' : undefined,
      branchId: branch.id,
      assigneeId: assignee?.id,
      patientId: patient?.id,
      dueAt: addDays(today, dueOffset).toISOString(),
      status: dueOffset < -3 && random.chance(0.6) ? 'completed' : 'open',
      priority: random.pick(['low', 'normal', 'normal', 'high']),
      origin: 'manual',
      escalated: false,
      createdById: random.pick(users.filter((u) => u.active)).id,
      createdAt: addDays(today, dueOffset - random.int(1, 5)).toISOString(),
      completedAt: undefined,
      outcome: undefined,
    })
  }
  tasks.forEach((task) => {
    if (task.status === 'completed') {
      task.completedAt = addDays(task.dueAt, random.int(0, 2)).toISOString()
      task.completedById = task.assigneeId
      task.outcome = 'Done.'
    }
  })

  /* --- Calendar blocks --------------------------------------------------- */

  const blocks: CalendarBlock[] = [
    {
      id: 'blk_1',
      userId: 'usr_doc_1',
      branchId: indiranagar.id,
      kind: 'leave',
      reason: 'Annual leave',
      startAt: addDays(today, 9).toISOString(),
      endAt: addDays(today, 13).toISOString(),
      createdById: 'usr_admin',
      createdAt: addDays(today, -20).toISOString(),
    },
    {
      id: 'blk_2',
      userId: 'usr_doc_2',
      branchId: koramangala.id,
      kind: 'blocked',
      reason: 'Conference — Pain Management Summit',
      startAt: addDays(today, 3).toISOString(),
      endAt: addDays(today, 4).toISOString(),
      createdById: 'usr_manager',
      createdAt: addDays(today, -8).toISOString(),
    },
    {
      id: 'blk_3',
      branchId: koramangala.id,
      kind: 'holiday',
      reason: 'Independence Day — clinic closed',
      startAt: addDays(today, 18).toISOString(),
      endAt: addDays(today, 18).toISOString(),
      createdById: 'usr_admin',
      createdAt: addDays(today, -40).toISOString(),
    },
    {
      id: 'blk_4',
      userId: 'usr_doc_3',
      branchId: koramangala.id,
      kind: 'blocked',
      reason: 'Admin block — case reviews',
      startAt: addDays(today, 1).toISOString(),
      endAt: addDays(today, 1).toISOString(),
      createdById: 'usr_doc_3',
      createdAt: addDays(today, -3).toISOString(),
    },
  ]

  /* --- Settings ---------------------------------------------------------- */

  const settings: ClinicSettings = {
    name: 'ONFLOWS CARE',
    tagline: 'Never miss a patient',
    supportEmail: 'hello@onflowscare.com',
    supportPhone: '+91 80 4123 5566',
    appointmentSlotMinutes: 30,
    channels: { in_app: true, email: true, sms: false, whatsapp: true },
  }

  /* --- Assemble, then run the engine over it ----------------------------- */

  events.sort((a, b) => (a.at < b.at ? 1 : -1))

  const db: Database = {
    version: SEED_VERSION,
    seededAt: nowISO,
    settings,
    branches,
    users,
    sessions,
    patients,
    notes,
    documents,
    treatmentTypes,
    appointments,
    treatments,
    reminderRules,
    reminders,
    tasks,
    leads,
    events,
    notifications: [],
    blocks,
  }

  // The engine — not the seed — decides which reminders have become tasks and
  // which are overdue. Same code path the running app uses, so the demo state
  // is always something the app could actually have produced itself.
  const result = runFollowUpEngine(db)
  db.reminders = result.reminders
  db.tasks = result.tasks

  db.notifications = buildNotifications(db, random)

  return db
}

/* -------------------------------------------------------------------------- */

type Session_ = Database['sessions'][number]

function buildNotifications(db: Database, random: Random): AppNotification[] {
  const notifications: AppNotification[] = []
  const overdue = db.tasks.filter((t) => t.status === 'open' && t.escalated).slice(0, 4)

  for (const task of overdue) {
    if (!task.assigneeId) continue
    notifications.push({
      id: `ntf_esc_${task.id}`,
      userId: task.assigneeId,
      title: 'Follow-up escalated',
      body: `${task.title} is past its escalation window.`,
      href: '/tasks',
      tone: 'warning',
      read: false,
      createdAt: task.dueAt,
    })
  }

  const upcoming = db.appointments
    .filter((a) => a.status === 'scheduled' && new Date(a.startAt).getTime() > Date.now())
    .slice(0, 3)

  for (const appointment of upcoming) {
    const patient = db.patients.find((p) => p.id === appointment.patientId)
    notifications.push({
      id: `ntf_apt_${appointment.id}`,
      userId: appointment.doctorId,
      title: 'Upcoming appointment',
      body: `${patient?.name ?? 'A patient'} is booked with you.`,
      href: '/appointments',
      tone: 'info',
      read: random.chance(0.5),
      createdAt: appointment.createdAt,
    })
  }

  const converted = db.leads.filter((l) => l.stage === 'converted').slice(0, 2)
  for (const lead of converted) {
    notifications.push({
      id: `ntf_lead_${lead.id}`,
      userId: 'usr_owner',
      title: 'Lead converted',
      body: `${lead.name} is now a registered patient.`,
      href: '/leads',
      tone: 'success',
      read: true,
      createdAt: lead.updatedAt,
    })
  }

  return notifications.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
}
