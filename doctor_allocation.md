# ENT Booking App — User Stories

## Overview

The ENT Booking App is a web-based appointment management system for ENT (Ear, Nose & Throat) clinics. It supports two user roles — **Admin** and **Doctor** — each with a dedicated portal. The system handles doctor onboarding, schedule management, appointment booking, and day-to-day scheduling operations.

---

## Actors

| Actor  | Description |
|--------|-------------|
| Admin  | Clinic staff member who manages doctors, schedules, and all appointments |
| Doctor | An ENT specialist who views and manages their own appointments |

---

## 1. Authentication

### US-01 — Login
**As a** user (admin or doctor),  
**I want to** sign in with my email and password,  
**So that** I can access my role-specific dashboard securely.

**Acceptance Criteria:**
- Login form accepts email and password.
- Incorrect credentials show an "Invalid email or password" error.
- Doctors with a `pending` account see a message that their account is awaiting admin approval.
- Doctors with a `rejected` account see a message to contact the administrator.
- On success, admins are redirected to `/admin/dashboard.php` and doctors to `/doctor/dashboard.php`.
- Already-logged-in users are automatically redirected to their dashboard.

---

### US-02 — Doctor Self-Registration
**As a** doctor,  
**I want to** register for an account by providing my details,  
**So that** I can request access to the system.

**Acceptance Criteria:**
- Registration form collects: full name, email, phone, specialization, password, and confirm password.
- Specialization is selected from a predefined list: ENT (General), Otology, Rhinology, Laryngology, Pediatric ENT, Head & Neck Surgery, Audiology, Sleep Medicine.
- Duplicate email addresses are rejected with a validation error.
- Password must be at least 6 characters; a strength indicator is shown in real time.
- Confirm password field validates match in real time.
- On success, the account is created with `pending` status and a success message is shown.
- The doctor cannot log in until an admin approves the account.

---

### US-03 — Forgot Password
**As a** user,  
**I want to** request a password reset link via email,  
**So that** I can regain access if I forget my password.

**Acceptance Criteria:**
- User enters their registered email address.
- A secure, time-limited (1 hour) reset token is generated and stored.
- A password reset email is sent with a clickable link.
- The response message is the same whether or not the email exists (to prevent user enumeration).

---

### US-04 — Reset Password
**As a** user,  
**I want to** set a new password using the reset link,  
**So that** I can log back into my account.

**Acceptance Criteria:**
- The reset link contains a unique token that is validated on load.
- Expired or already-used tokens show an error with a link to request a new one.
- The user is greeted by name on the reset page.
- New password must be at least 6 characters and confirmed.
- On success, the token is deleted and the user is directed to the login page.

---

### US-05 — Logout
**As a** logged-in user,  
**I want to** log out of the system,  
**So that** my session is ended securely.

**Acceptance Criteria:**
- Clicking logout destroys the session and redirects to the login page.
- A "You have been logged out successfully" message is shown on the login page.

---

## 2. Admin — Doctor Management

### US-06 — View All Doctors
**As an** admin,  
**I want to** see a list of all registered doctors,  
**So that** I can manage the clinic's medical staff.

**Acceptance Criteria:**
- Table displays doctor name, email, phone, and specialization.
- Live search filters the list in real time.
- Paginated at 10 records per page.

---

### US-07 — Add a Doctor
**As an** admin,  
**I want to** manually add a doctor to the system,  
**So that** I can onboard staff without requiring self-registration.

**Acceptance Criteria:**
- Modal form collects: full name, email, phone, and specialization.
- Duplicate email addresses are rejected.
- A user account and doctor profile are created in a single transaction.
- Default login password is set to `doctor123` and displayed as a notice.
- Success/error flash messages are shown after submission.

---

### US-08 — Edit a Doctor
**As an** admin,  
**I want to** update a doctor's profile details,  
**So that** the system reflects accurate information.

**Acceptance Criteria:**
- Edit modal is pre-populated with the doctor's current name, email, phone, and specialization.
- Email uniqueness is validated (excluding the current doctor).
- Both the `users` and `doctors` tables are updated atomically.

---

### US-09 — Delete a Doctor
**As an** admin,  
**I want to** remove a doctor from the system,  
**So that** inactive or incorrect records are cleaned up.

**Acceptance Criteria:**
- A confirmation modal warns that all associated schedules and appointments will also be deleted (cascade).
- Deletion is protected by a CSRF token.

---

## 3. Admin — Doctor Approval Workflow

### US-10 — Review Doctor Registration Requests
**As an** admin,  
**I want to** see all doctor self-registration requests with their status,  
**So that** I can decide who gets access to the system.

**Acceptance Criteria:**
- Requests are listed in a table with name, email, phone, specialization, registration date, and status.
- Filter tabs allow viewing All, Pending, Approved, and Rejected requests with counts.
- Live search filters the list by name.

---

### US-11 — Approve a Doctor
**As an** admin,  
**I want to** approve a pending doctor registration,  
**So that** the doctor can log in and use the system.

**Acceptance Criteria:**
- Clicking "Approve" shows a confirmation modal.
- On confirmation, the doctor's status is set to `approved`.
- An approval email notification is sent to the doctor with a login link.
- The flash message confirms approval and whether the email was sent.

---

### US-12 — Reject a Doctor
**As an** admin,  
**I want to** reject a doctor registration request,  
**So that** unauthorized individuals cannot access the system.

**Acceptance Criteria:**
- Clicking "Reject" shows a confirmation modal.
- On confirmation, the doctor's status is set to `rejected`.
- A rejection email notification is sent to the doctor.
- Previously approved doctors can also be revoked, and rejected doctors can be re-approved.

---

## 4. Admin — Schedule Management

### US-13 — Assign Doctor Schedules
**As an** admin,  
**I want to** assign working days and time windows to each doctor,  
**So that** appointments can only be booked within valid availability.

**Acceptance Criteria:**
- Schedule form collects: doctor, day of week, start time, and end time.
- End time must be after start time.
- Overlapping schedules for the same doctor on the same day are rejected.
- Schedules are listed in a table grouped by doctor and ordered by day.

---

### US-14 — Delete a Schedule
**As an** admin,  
**I want to** remove a doctor's schedule entry,  
**So that** I can update availability when it changes.

**Acceptance Criteria:**
- A confirmation modal is shown before deletion.
- Deletion is protected by a CSRF token.

---

## 5. Admin — Appointment Management

### US-15 — View All Appointments
**As an** admin,  
**I want to** see all appointments across all doctors,  
**So that** I have a complete picture of the clinic's bookings.

**Acceptance Criteria:**
- Table shows patient name, age, phone, doctor, specialization, date, time range, and status.
- Notes are shown as a truncated preview.
- Filterable by date, doctor, and status.
- Live search filters by patient name.
- Paginated at 10 records per page.

---

### US-16 — Create an Appointment
**As an** admin,  
**I want to** book an appointment for a patient,  
**So that** the patient is scheduled with the correct doctor.

**Acceptance Criteria:**
- Form collects: patient name, age, phone, doctor, date, from time, to time, and optional notes.
- Date cannot be in the past.
- From time must be before to time.
- Overlapping appointments for the same doctor on the same date are rejected.
- Appointment is created with `Pending` status.
- Time inputs use 15-minute step intervals.

---

### US-17 — Update Appointment Status
**As an** admin,  
**I want to** change the status of an appointment,  
**So that** the system reflects the current state of each booking.

**Acceptance Criteria:**
- Status can be changed to Pending, Completed, or Cancelled via an inline dropdown.
- Changing the dropdown immediately submits the form and updates the record.
- The dropdown styling updates to reflect the new status color.

---

### US-18 — View Appointment Details
**As an** admin,  
**I want to** view the full details of an appointment,  
**So that** I can review all patient and booking information in one place.

**Acceptance Criteria:**
- Clicking the eye icon opens a read-only modal.
- Modal shows: patient name, age, phone, doctor, specialization, date, time range, status badge, and notes.

---

### US-19 — Delete an Appointment
**As an** admin,  
**I want to** delete an appointment record,  
**So that** erroneous or cancelled bookings can be removed permanently.

**Acceptance Criteria:**
- A browser confirmation dialog is shown before deletion.
- Deletion is protected by a CSRF token.

---

## 6. Admin — Calendar View

### US-20 — View Monthly Calendar
**As an** admin,  
**I want to** see all appointments on a monthly calendar,  
**So that** I can get a visual overview of the clinic's schedule.

**Acceptance Criteria:**
- Calendar renders the current month with appointment indicators on each day.
- Clicking a date navigates to the Day View Scheduler for that date.

---

## 7. Admin — Day View Scheduler

### US-21 — View Day Schedule
**As an** admin,  
**I want to** see all appointments for a specific day in a timeline grid,  
**So that** I can manage the day's schedule at a glance.

**Acceptance Criteria:**
- Scheduler loads appointments for the selected date in a visual time-block grid.
- Filterable by doctor, status, and patient name search.
- Navigation buttons (Prev, Today, Next) and a date picker allow moving between days.
- Each appointment block shows patient name, time, and status.

---

### US-22 — Add Appointment from Day Scheduler
**As an** admin,  
**I want to** create an appointment directly from the day scheduler,  
**So that** I can quickly fill time slots without leaving the day view.

**Acceptance Criteria:**
- Clicking "Add Appointment" opens a modal pre-filled with the current date.
- Form collects: patient name, age, phone, doctor, date, from/to time, status, and notes.
- Overlap detection prevents double-booking the same doctor.
- The grid refreshes after a successful save.

---

### US-23 — Edit Appointment from Day Scheduler
**As an** admin,  
**I want to** edit an existing appointment from the day scheduler,  
**So that** I can correct or update booking details inline.

**Acceptance Criteria:**
- Clicking an appointment block opens the edit modal pre-populated with its data.
- All fields are editable.
- Overlap detection excludes the current appointment being edited.
- The grid refreshes after saving.

---

### US-24 — Delete Appointment from Day Scheduler
**As an** admin,  
**I want to** delete an appointment from the day scheduler,  
**So that** I can remove cancelled or erroneous bookings from the timeline.

**Acceptance Criteria:**
- A delete button is available in the edit modal.
- Deletion requires confirmation and is protected by a CSRF token.
- The grid refreshes after deletion.

---

### US-25 — Quick Import Appointments via Text
**As an** admin,  
**I want to** paste a list of patient names and times in plain text and have them imported as appointments,  
**So that** I can quickly convert manually written schedules into the system.

**Acceptance Criteria:**
- Import modal accepts a doctor selection and a multi-line text input.
- Each line must follow the format: `Patient Name - HH:MM - HH:MM`.
- Lines with invalid format or overlapping times are reported as errors.
- Valid lines are inserted as `Pending` appointments.
- A summary of created records and errors is returned.

---

## 8. Doctor — Dashboard

### US-26 — View Doctor Dashboard
**As a** doctor,  
**I want to** see a summary of my appointments when I log in,  
**So that** I can quickly understand my workload for the day.

**Acceptance Criteria:**
- Stats cards show: today's appointment count, pending count, and total appointment count.
- Today's appointments are listed in a time-slot view with patient name, age, phone, notes, and a status dropdown.
- Upcoming appointments for the next 7 days are shown in a table.

---

### US-27 — Update Appointment Status from Dashboard
**As a** doctor,  
**I want to** update the status of today's appointments directly from my dashboard,  
**So that** I can mark patients as seen without navigating away.

**Acceptance Criteria:**
- Each appointment in the today's list has an inline status dropdown.
- Changing the status immediately submits and updates the record.
- Only appointments belonging to the logged-in doctor can be updated.

---

## 9. Doctor — Appointments

### US-28 — View My Appointments
**As a** doctor,  
**I want to** see all my appointments with filtering options,  
**So that** I can review my full booking history and upcoming schedule.

**Acceptance Criteria:**
- Table shows: patient name, age, phone, date, time, notes, and status.
- Filterable by date and status.
- Live search filters by patient name.
- Paginated at 10 records per page.

---

### US-29 — Update Appointment Status from Appointments List
**As a** doctor,  
**I want to** update the status of any of my appointments,  
**So that** I can keep records accurate over time.

**Acceptance Criteria:**
- Inline status dropdown is available on each row.
- Only appointments belonging to the logged-in doctor can be modified (server-side check).
- A flash message confirms the update.

---

## 10. Doctor — Day View Scheduler

### US-30 — View My Day Schedule (Read-Only)
**As a** doctor,  
**I want to** see my appointments for any given day in a timeline view,  
**So that** I can plan my day visually.

**Acceptance Criteria:**
- Scheduler loads only the logged-in doctor's appointments.
- Navigation buttons and date picker allow browsing days.
- Filterable by status and patient name search.
- The scheduler is read-only — doctors cannot create, edit, or delete appointments.

---

## 11. Security & Cross-Cutting Concerns

### US-31 — CSRF Protection
**As a** system,  
**I want to** validate CSRF tokens on all state-changing form submissions,  
**So that** cross-site request forgery attacks are prevented.

**Acceptance Criteria:**
- All POST forms include a hidden `csrf_token` field.
- Server-side validation rejects requests with missing or invalid tokens.

---

### US-32 — Role-Based Access Control
**As a** system,  
**I want to** restrict pages to the appropriate role,  
**So that** doctors cannot access admin pages and vice versa.

**Acceptance Criteria:**
- Admin pages call `requireAdmin()` — unauthenticated or doctor users are redirected to login with an `unauthorized` error.
- Doctor pages call `requireDoctor()` — unauthenticated or admin users are redirected to login.
- Doctors can only read/update their own appointments via server-side ownership checks.

---

### US-33 — Input Sanitization
**As a** system,  
**I want to** sanitize all user-supplied input before rendering or storing it,  
**So that** XSS and injection attacks are mitigated.

**Acceptance Criteria:**
- All output is passed through `htmlspecialchars` via the `sanitize()` helper.
- All database queries use prepared statements with bound parameters.

---

### US-34 — Email Notifications
**As a** system,  
**I want to** send HTML email notifications for account approval and rejection,  
**So that** doctors are informed of their registration status automatically.

**Acceptance Criteria:**
- Approval email includes a login button linking to the system.
- Rejection email informs the doctor and suggests contacting administration.
- Emails use a branded HTML template with the clinic name.
- The system supports both PHP `mail()` fallback and direct SMTP (configurable via constants).
- Password reset emails include a time-limited link that expires in 1 hour.
