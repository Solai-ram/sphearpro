# Staff Attendance — Production checklist

Branch: `feature/staff-attendance`

## Database

- [x] Prisma schema valid (`StaffAttendance`, shifts, devices, challenges)
- [x] Migrations applied (`20260910120000_staff_attendance`, `20260910180000_attendance_webauthn_counter`)
- [x] Unique `(clinicId, userId, date)` + P2002 → already checked in
- [x] Indexes on clinic/date/user
- [x] Tenant isolation on all queries

## Backend

- [x] Check-in / check-out (server GPS, device bind, one-time challenge)
- [x] Today + history
- [x] Admin dashboard / list / manual correct
- [x] Monthly report + CSV export
- [x] Device register / revoke
- [x] Settings + shifts + assignments
- [x] WebAuthn registration + assertion verify (`@simplewebauthn/server`)
- [x] Auto-absent hourly job (previous clinic day)
- [x] RBAC permissions seeded (`attendance.*`)
- [x] Audit events on punch / correct / device / settings

## Security

- [x] Client `employeeId` / `clinicId` ignored on punch
- [x] GPS distance computed server-side
- [x] Device key hashed; revoked devices rejected
- [x] Biometric: no templates stored; public key + counter verified
- [x] Cross-tenant access prevented in service layer
- [x] Manual correction requires `attendance.correct` + remarks

## Frontend

- [x] Mobile-friendly today punch + history calendar
- [x] GPS / biometric / device registration UX
- [x] Admin dashboard, settings, devices, reports (CSV)

## Tests / gate

- [x] Unit: geofence, late/overnight, tenancy, device, biometric missing assertion, P2002
- [x] HTTP: clinic scoping, ignore foreign employeeId, RBAC 403
- [x] `tsc --noEmit` (api + web)

## Ops notes

| Env | Purpose |
|-----|---------|
| `FRONTEND_URL` / `WEBAUTHN_ORIGINS` | Allowed WebAuthn origins |
| `WEBAUTHN_RP_ID` | RP ID (use hostname in prod, e.g. `app.example.com`) |
| `ATTENDANCE_JOBS_DISABLED=true` | Disable auto-absent scheduler |

### Plan feature

- Code: `STAFF_ATTENDANCE` (seeded on STANDARD monthly + yearly)
- API: `@RequireFeature('STAFF_ATTENDANCE')` on attendance controller
- Nav: hidden when clinic plan lacks the feature

### Auto day-close job (hourly)

- Previous clinic calendar day
- No punch → `ABSENT` (or `WEEK_OFF` on configured week-off days, or `HOLIDAY` if clinic holiday)
- Check-in without check-out → `HALF_DAY`

### Phase 6 — Leave & holidays

- [x] `ClinicHoliday` + `StaffLeaveRequest` (+ migration `20260913120000_attendance_leave_holidays`)
- [x] Holiday CRUD; creating a holiday marks staff `HOLIDAY` (no check-in yet)
- [x] Leave request / cancel / approve / reject; approve writes `ON_LEAVE` per day
- [x] Punch blocked on holiday or `ON_LEAVE`
- [x] Permissions: `attendance.request_leave`, `attendance.approve_leave`
- [x] UI: `/attendance/leave`, `/admin/attendance/leave`
- [x] Today payload includes `holiday`, `leave`, `punchBlocked`

After deploy: `npx prisma migrate deploy` + `npm run db:seed` (or re-seed roles) so leave permissions exist; enable attendance in Settings, set geofence + week-offs, create/assign shifts; staff register device (+ biometric if enabled).
