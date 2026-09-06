-- Insert test provider
INSERT INTO staff_profiles (id, name, "staffType", specialization, department, phone, email, "isProvider", "createdAt", "updatedAt")
VALUES ('staff_doctor_001', 'Dr. Rajesh Sharma', 'DOCTOR', 'General Practice', 'Consultation', '+91-9876543211', 'rajesh@clinic.local', true, NOW(), NOW());

-- Insert provider schedule (Friday, 9 AM to 5 PM)
INSERT INTO provider_schedules (id, "staffId", "dayOfWeek", "startTime", "endTime", "isAvailable")
VALUES 
  ('sched_fri_001', 'staff_doctor_001', 5, '09:00', '17:00', true),
  ('sched_mon_001', 'staff_doctor_001', 1, '09:00', '17:00', true),
  ('sched_wed_001', 'staff_doctor_001', 3, '09:00', '17:00', true);

-- Verify data
SELECT id, name, "staffType", "isProvider" FROM staff_profiles LIMIT 5;
SELECT * FROM provider_schedules WHERE "staffId" = 'staff_doctor_001';
