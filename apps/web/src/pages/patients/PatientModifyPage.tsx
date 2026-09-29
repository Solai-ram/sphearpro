import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Search,
  Loader2,
  AlertCircle,
  User,
  Phone,
  X,
  BookOpen,
  ArrowUpDown,
  Edit3,
  CheckCircle,
  MapPin,
  Calendar,
  Save,
  Mail,
  UserCheck,
} from 'lucide-react';
import { patientsApi, type PatientSearchHit } from '../../services/patients';
import { appointmentsApi } from '../../services/appointments';
import { ageFromDob, dobFromAgeYears, formatAddress } from '../../lib/age';

type DoctorOption = { id: string; name: string };

function formatDate(value?: string) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export function PatientModifyPage() {
  // Search filter states
  const [matchMode, setMatchMode] = useState<'startsWith' | 'contains'>('startsWith');
  const [name, setName] = useState('');
  const [regNo, setRegNo] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [relationName, setRelationName] = useState('');
  const [mobile, setMobile] = useState('');
  const [age, setAge] = useState('');
  const [gender, setGender] = useState<'ALL' | 'MALE' | 'FEMALE'>('ALL');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [doctorId, setDoctorId] = useState('');
  const [visitType, setVisitType] = useState<'ALL' | 'OP' | 'THERAPY'>('ALL');

  // Doctors list for dropdown
  const [doctors, setDoctors] = useState<DoctorOption[]>([]);

  // Results & UI states
  const [results, setResults] = useState<PatientSearchHit[]>([]);
  const [tableFilter, setTableFilter] = useState('');
  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Selected patient for modification modal
  const [editingPatient, setEditingPatient] = useState<PatientSearchHit | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // Edit form state
  const [editForm, setEditForm] = useState({
    name: '',
    dob: '',
    age: '',
    gender: 'MALE',
    phone: '',
    alternatePhone: '',
    email: '',
    relationName: '',
    relationType: 'Father',
    street: '',
    city: '',
    state: '',
    pincode: '',
  });

  // Load doctors on mount
  useEffect(() => {
    appointmentsApi
      .getDoctors()
      .then((docs) => setDoctors([...docs].sort((a, b) => a.name.localeCompare(b.name))))
      .catch(() => setDoctors([]));
  }, []);

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setIsLoading(true);
    setError(null);
    setSuccessMessage(null);
    setHasSearched(true);
    setCurrentPage(1);

    try {
      const hits = await patientsApi.search('', 100, {
        matchMode,
        name: name.trim() || undefined,
        regNo: regNo.trim() || undefined,
        phone: mobile.trim() || undefined,
        gender: gender !== 'ALL' ? gender : undefined,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        doctorId: doctorId || undefined,
        address: (address.trim() || city.trim()) ? `${address} ${city}`.trim() : undefined,
        relationName: relationName.trim() || undefined,
        visitType: visitType !== 'ALL' ? visitType : undefined,
      });

      let filtered = hits;
      if (age.trim()) {
        const targetAge = parseInt(age.trim(), 10);
        if (!isNaN(targetAge)) {
          filtered = hits.filter((p) => {
            const pAge = ageFromDob(p.dateOfBirth);
            return pAge === targetAge;
          });
        }
      }

      setResults(filtered);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed. Please try again.');
      setResults([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClear = () => {
    setName('');
    setRegNo('');
    setDateFrom('');
    setDateTo('');
    setRelationName('');
    setMobile('');
    setAge('');
    setGender('ALL');
    setAddress('');
    setCity('');
    setDoctorId('');
    setVisitType('ALL');
    setMatchMode('startsWith');
    setResults([]);
    setTableFilter('');
    setError(null);
    setSuccessMessage(null);
    setHasSearched(false);
    setEditingPatient(null);
  };

  // Open modal and populate edit form
  const handleOpenModify = (p: PatientSearchHit) => {
    setEditingPatient(p);
    setEditError(null);

    const pAge = ageFromDob(p.dateOfBirth);
    const dobString = p.dateOfBirth ? new Date(p.dateOfBirth).toISOString().split('T')[0] : '';
    const addr = p.address || {};
    const rel = (p.emergencyContact as any) || {};

    setEditForm({
      name: p.name || '',
      dob: dobString,
      age: pAge != null ? String(pAge) : '',
      gender: p.gender || 'MALE',
      phone: p.phone || '',
      alternatePhone: p.alternatePhone || '',
      email: p.email || '',
      relationName: rel.name || '',
      relationType: rel.relationship || 'Father',
      street: addr.line || addr.street || '',
      city: addr.city || '',
      state: addr.state || '',
      pincode: addr.pincode || '',
    });
  };

  // Synchronize Age -> DOB
  const handleAgeChange = (val: string) => {
    const numeric = parseInt(val, 10);
    if (!isNaN(numeric) && numeric >= 0 && numeric <= 125) {
      setEditForm((prev) => ({
        ...prev,
        age: val,
        dob: dobFromAgeYears(numeric),
      }));
    } else {
      setEditForm((prev) => ({ ...prev, age: val }));
    }
  };

  // Synchronize DOB -> Age
  const handleDobChange = (val: string) => {
    if (val) {
      const calculatedAge = ageFromDob(val);
      setEditForm((prev) => ({
        ...prev,
        dob: val,
        age: calculatedAge != null ? String(calculatedAge) : '',
      }));
    } else {
      setEditForm((prev) => ({ ...prev, dob: val }));
    }
  };

  // Save modified patient
  const handleSavePatient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPatient) return;

    if (!editForm.name.trim()) {
      setEditError('Patient name is required');
      return;
    }

    setIsSaving(true);
    setEditError(null);

    try {
      const finalDob = editForm.dob
        ? editForm.dob
        : editForm.age.trim()
        ? dobFromAgeYears(parseInt(editForm.age.trim(), 10))
        : undefined;

      const addressPayload = {
        line: editForm.street.trim() || undefined,
        street: editForm.street.trim() || undefined,
        city: editForm.city.trim() || undefined,
        state: editForm.state.trim() || undefined,
        pincode: editForm.pincode.trim() || undefined,
      };

      const emergencyContactPayload = (editForm.relationName.trim() || editForm.relationType)
        ? {
            name: editForm.relationName.trim() || undefined,
            relationship: editForm.relationType || undefined,
            phone: editForm.alternatePhone.trim() || undefined,
          }
        : undefined;

      await patientsApi.update(editingPatient.id, {
        name: editForm.name.trim(),
        dateOfBirth: finalDob,
        gender: editForm.gender,
        phone: editForm.phone.trim() || undefined,
        alternatePhone: editForm.alternatePhone.trim() || undefined,
        email: editForm.email.trim() || undefined,
        address: Object.values(addressPayload).some(Boolean) ? addressPayload : undefined,
        emergencyContact: emergencyContactPayload,
      });

      // Update local item in the results list
      setResults((prev) =>
        prev.map((item) => {
          if (item.id === editingPatient.id) {
            return {
              ...item,
              name: editForm.name.trim(),
              dateOfBirth: finalDob,
              gender: editForm.gender,
              phone: editForm.phone.trim() || undefined,
              alternatePhone: editForm.alternatePhone.trim() || undefined,
              email: editForm.email.trim() || undefined,
              address: addressPayload,
              emergencyContact: emergencyContactPayload,
            };
          }
          return item;
        }),
      );

      setSuccessMessage(`Patient ${editForm.name.trim()} (${editingPatient.patientNumber}) updated successfully.`);
      setEditingPatient(null);
    } catch (err) {
      setEditError(err instanceof Error ? err.message : 'Failed to update patient');
    } finally {
      setIsSaving(false);
    }
  };

  // In-table quick search filter
  const filteredResults = useMemo(() => {
    if (!tableFilter.trim()) return results;
    const q = tableFilter.toLowerCase().trim();
    return results.filter((p) => {
      const pName = p.name.toLowerCase();
      const pNum = p.patientNumber.toLowerCase();
      const pPhone = (p.phone || '').toLowerCase();
      const pAlt = (p.alternatePhone || '').toLowerCase();
      const pAddr = formatAddress(p.address).toLowerCase();
      const pRel = ((p.emergencyContact as any)?.name || '').toLowerCase();
      const doc = (p.opCases?.[0]?.provider?.name || p.appointments?.[0]?.provider?.name || '').toLowerCase();
      return (
        pName.includes(q) ||
        pNum.includes(q) ||
        pPhone.includes(q) ||
        pAlt.includes(q) ||
        pAddr.includes(q) ||
        pRel.includes(q) ||
        doc.includes(q)
      );
    });
  }, [results, tableFilter]);

  // Pagination
  const totalPages = Math.ceil(filteredResults.length / pageSize) || 1;
  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredResults.slice(start, start + pageSize);
  }, [filteredResults, currentPage, pageSize]);

  return (
    <div className="space-y-4">
      {/* Top Header with PATIENT MODIFY title and Search / Clear buttons */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-gray-200 pb-3">
        <div className="flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-rose-600" />
          <h1 className="text-xl font-bold tracking-wide text-rose-600 uppercase">
            Patient Modify
          </h1>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => handleSearch()}
            disabled={isLoading}
            className="inline-flex items-center px-4 py-1.5 rounded bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs uppercase tracking-wider shadow-xs transition-colors cursor-pointer disabled:opacity-50"
          >
            {isLoading ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Search className="w-3.5 h-3.5 mr-1.5" />}
            Search
          </button>
          <button
            type="button"
            onClick={handleClear}
            className="inline-flex items-center px-4 py-1.5 rounded bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs uppercase tracking-wider shadow-xs transition-colors cursor-pointer"
          >
            <X className="w-3.5 h-3.5 mr-1.5" />
            Clear
          </button>
        </div>
      </div>

      {successMessage && (
        <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 flex items-center justify-between text-sm animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{successMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setSuccessMessage(null)}
            className="text-emerald-700 hover:text-emerald-900"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Hospital Filter Panel */}
      <div className="card p-4 space-y-4 bg-white border border-gray-200 rounded-lg shadow-2xs">
        {/* Match mode radios */}
        <div className="flex flex-wrap items-center gap-6 text-xs text-gray-700 font-medium">
          <label className="inline-flex items-center gap-1.5 cursor-pointer">
            <input
              type="radio"
              name="modifyMatchMode"
              checked={matchMode === 'startsWith'}
              onChange={() => setMatchMode('startsWith')}
              className="text-emerald-600 focus:ring-emerald-500"
            />
            <span>Starts With</span>
          </label>
          <label className="inline-flex items-center gap-1.5 cursor-pointer">
            <input
              type="radio"
              name="modifyMatchMode"
              checked={matchMode === 'contains'}
              onChange={() => setMatchMode('contains')}
              className="text-emerald-600 focus:ring-emerald-500"
            />
            <span>Contains (Name, Relation Name and Address)</span>
          </label>
        </div>

        {/* Row 1: Name, Reg No, Reg Date-From, Reg Date-To */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Name</label>
            <input
              type="text"
              className="w-full text-sm py-1.5 px-2 bg-transparent border-b-2 border-cyan-500 focus:border-cyan-600 focus:outline-hidden transition-colors"
              placeholder="Patient Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            />
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1">Reg No</label>
            <input
              type="text"
              className="w-full text-sm py-1.5 px-2 bg-transparent border-b-2 border-cyan-500 focus:border-cyan-600 focus:outline-hidden font-mono uppercase transition-colors"
              placeholder="e.g. P000001"
              value={regNo}
              onChange={(e) => setRegNo(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            />
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1">Reg Date-From</label>
            <input
              type="date"
              className="w-full text-sm py-1 px-2 bg-transparent border-b-2 border-cyan-500 focus:border-cyan-600 focus:outline-hidden text-gray-700 transition-colors"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1">Reg Date-To</label>
            <input
              type="date"
              className="w-full text-sm py-1 px-2 bg-transparent border-b-2 border-cyan-500 focus:border-cyan-600 focus:outline-hidden text-gray-700 transition-colors"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
            />
          </div>
        </div>

        {/* Row 2: Relation Name, Mobile, Age, Gender */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 items-end">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Relation Name</label>
            <input
              type="text"
              className="w-full text-sm py-1.5 px-2 bg-transparent border-b-2 border-cyan-500 focus:border-cyan-600 focus:outline-hidden transition-colors"
              placeholder="Father / Guardian Name"
              value={relationName}
              onChange={(e) => setRelationName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            />
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1">Mobile</label>
            <input
              type="text"
              className="w-full text-sm py-1.5 px-2 bg-transparent border-b-2 border-cyan-500 focus:border-cyan-600 focus:outline-hidden font-mono transition-colors"
              placeholder="Phone Number"
              value={mobile}
              onChange={(e) => setMobile(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            />
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1">Age</label>
            <input
              type="number"
              min={0}
              className="w-full text-sm py-1.5 px-2 bg-transparent border-b-2 border-cyan-500 focus:border-cyan-600 focus:outline-hidden transition-colors"
              placeholder="Age"
              value={age}
              onChange={(e) => setAge(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            />
          </div>

          <div className="pb-1">
            <label className="block text-xs text-gray-500 mb-1">Gender</label>
            <div className="flex items-center gap-4 text-xs text-gray-700">
              <label className="inline-flex items-center gap-1 cursor-pointer">
                <input
                  type="radio"
                  name="modifyGender"
                  checked={gender === 'MALE'}
                  onChange={() => setGender('MALE')}
                  className="text-cyan-600"
                />
                <span>Male</span>
              </label>
              <label className="inline-flex items-center gap-1 cursor-pointer">
                <input
                  type="radio"
                  name="modifyGender"
                  checked={gender === 'FEMALE'}
                  onChange={() => setGender('FEMALE')}
                  className="text-cyan-600"
                />
                <span>Female</span>
              </label>
              <label className="inline-flex items-center gap-1 cursor-pointer">
                <input
                  type="radio"
                  name="modifyGender"
                  checked={gender === 'ALL'}
                  onChange={() => setGender('ALL')}
                  className="text-cyan-600"
                />
                <span>All</span>
              </label>
            </div>
          </div>
        </div>

        {/* Row 3: Address, City, Doctor, Visit Type */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 items-end">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Address</label>
            <input
              type="text"
              className="w-full text-sm py-1.5 px-2 bg-transparent border-b-2 border-cyan-500 focus:border-cyan-600 focus:outline-hidden transition-colors"
              placeholder="Street / Area"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            />
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1">City</label>
            <input
              type="text"
              className="w-full text-sm py-1.5 px-2 bg-transparent border-b-2 border-cyan-500 focus:border-cyan-600 focus:outline-hidden transition-colors"
              placeholder="City / District"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            />
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1">Doctor</label>
            <select
              className="w-full text-sm py-1.5 px-2 bg-transparent border-b-2 border-cyan-500 focus:border-cyan-600 focus:outline-hidden text-gray-700 transition-colors"
              value={doctorId}
              onChange={(e) => setDoctorId(e.target.value)}
            >
              <option value="">All Doctors / Providers</option>
              {doctors.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name.startsWith('Dr') ? d.name : `Dr. ${d.name}`}
                </option>
              ))}
            </select>
          </div>

          <div className="pb-1">
            <label className="block text-xs text-gray-500 mb-1">Type</label>
            <div className="flex items-center gap-3 text-xs text-gray-700">
              <label className="inline-flex items-center gap-1 cursor-pointer">
                <input
                  type="radio"
                  name="modifyVisitType"
                  checked={visitType === 'OP'}
                  onChange={() => setVisitType('OP')}
                  className="text-cyan-600"
                />
                <span>OP</span>
              </label>
              <label className="inline-flex items-center gap-1 cursor-pointer">
                <input
                  type="radio"
                  name="modifyVisitType"
                  checked={visitType === 'THERAPY'}
                  onChange={() => setVisitType('THERAPY')}
                  className="text-cyan-600"
                />
                <span>Therapy</span>
              </label>
              <label className="inline-flex items-center gap-1 cursor-pointer">
                <input
                  type="radio"
                  name="modifyVisitType"
                  checked={visitType === 'ALL'}
                  onChange={() => setVisitType('ALL')}
                  className="text-cyan-600"
                />
                <span>All</span>
              </label>
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 flex items-center gap-2 text-sm">
          <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
          <span>{error}</span>
        </div>
      )}

      {/* Records Bar & Quick In-Table Filter */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-2">
        <div className="flex items-center gap-2 text-xs text-gray-600">
          <select
            className="border border-gray-300 rounded px-2 py-1 text-xs bg-white focus:outline-hidden"
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value));
              setCurrentPage(1);
            }}
          >
            <option value={10}>10</option>
            <option value={25}>25</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
          <span>records per page</span>
          {hasSearched && (
            <span className="font-semibold text-gray-700">
              ({filteredResults.length} patient{filteredResults.length === 1 ? '' : 's'} found)
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 text-xs">
          <span className="text-gray-600 font-medium">Search:</span>
          <input
            type="text"
            className="border border-gray-300 rounded px-2.5 py-1 text-xs focus:ring-1 focus:ring-cyan-500 focus:outline-hidden bg-white w-48"
            placeholder="Quick table filter..."
            value={tableFilter}
            onChange={(e) => {
              setTableFilter(e.target.value);
              setCurrentPage(1);
            }}
          />
        </div>
      </div>

      {/* Hospital Patient Records Table with Modify Action */}
      <div className="border border-gray-200 rounded-lg overflow-hidden shadow-2xs bg-white">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-[#487eb0] text-white font-semibold">
              <tr>
                <th className="px-3 py-2.5 whitespace-nowrap">
                  <div className="flex items-center gap-1">
                    <span>Reg No</span>
                    <ArrowUpDown className="w-3 h-3 opacity-70" />
                  </div>
                </th>
                <th className="px-3 py-2.5 whitespace-nowrap">
                  <div className="flex items-center gap-1">
                    <span>Reg Date</span>
                    <ArrowUpDown className="w-3 h-3 opacity-70" />
                  </div>
                </th>
                <th className="px-3 py-2.5 whitespace-nowrap">
                  <div className="flex items-center gap-1">
                    <span>Name</span>
                    <ArrowUpDown className="w-3 h-3 opacity-70" />
                  </div>
                </th>
                <th className="px-3 py-2.5 whitespace-nowrap">
                  <div className="flex items-center gap-1">
                    <span>Age/Gender</span>
                    <ArrowUpDown className="w-3 h-3 opacity-70" />
                  </div>
                </th>
                <th className="px-3 py-2.5 whitespace-nowrap">
                  <div className="flex items-center gap-1">
                    <span>Mobile</span>
                    <ArrowUpDown className="w-3 h-3 opacity-70" />
                  </div>
                </th>
                <th className="px-3 py-2.5 whitespace-nowrap">Alternative No</th>
                <th className="px-3 py-2.5 whitespace-nowrap">Address</th>
                <th className="px-3 py-2.5 whitespace-nowrap">Relation Name</th>
                <th className="px-3 py-2.5 whitespace-nowrap">Doctor</th>
                <th className="px-3 py-2.5 text-right whitespace-nowrap">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {isLoading ? (
                <tr>
                  <td colSpan={10} className="px-4 py-12 text-center text-gray-500">
                    <Loader2 className="w-6 h-6 animate-spin text-cyan-600 mx-auto mb-2" />
                    Searching patient records…
                  </td>
                </tr>
              ) : paginatedData.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-4 py-12 text-center text-gray-400">
                    {hasSearched
                      ? 'No patient records match your criteria'
                      : 'Enter filter parameters and click SEARCH above to find patients to modify'}
                  </td>
                </tr>
              ) : (
                paginatedData.map((p) => {
                  const patientAge = ageFromDob(p.dateOfBirth);
                  const formattedAddr = formatAddress(p.address);
                  const relData = p.emergencyContact as Record<string, string> | undefined;
                  const relName = relData?.name || '—';
                  const docName =
                    p.opCases?.[0]?.provider?.name ||
                    p.appointments?.[0]?.provider?.name ||
                    '—';

                  return (
                    <tr
                      key={p.id}
                      className="hover:bg-cyan-50/50 transition-colors group cursor-pointer"
                      onClick={() => handleOpenModify(p)}
                    >
                      <td className="px-3 py-2 font-mono font-medium text-blue-700 whitespace-nowrap">
                        {p.patientNumber}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap text-gray-600">
                        {formatDate(p.createdAt)}
                      </td>
                      <td className="px-3 py-2 font-medium text-gray-900 whitespace-nowrap">
                        {p.name}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap text-gray-700">
                        {[patientAge != null ? `${patientAge} Y` : null, p.gender]
                          .filter(Boolean)
                          .join(' / ') || '—'}
                      </td>
                      <td className="px-3 py-2 font-mono text-gray-700 whitespace-nowrap">
                        {p.phone || '—'}
                      </td>
                      <td className="px-3 py-2 font-mono text-gray-500 whitespace-nowrap">
                        {p.alternatePhone || '—'}
                      </td>
                      <td className="px-3 py-2 text-gray-600 max-w-xs truncate" title={formattedAddr}>
                        {formattedAddr || '—'}
                      </td>
                      <td className="px-3 py-2 text-gray-600 whitespace-nowrap">
                        {relName}
                      </td>
                      <td className="px-3 py-2 text-gray-600 whitespace-nowrap">
                        {docName.startsWith('Dr') || docName === '—' ? docName : `Dr. ${docName}`}
                      </td>
                      <td className="px-3 py-2 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenModify(p);
                          }}
                          className="px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs inline-flex items-center gap-1 shadow-xs transition-colors cursor-pointer"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          Modify
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination bar */}
        {filteredResults.length > 0 && (
          <div className="px-4 py-2.5 bg-gray-50 border-t border-gray-200 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-gray-600">
            <span>
              Showing {Math.min((currentPage - 1) * pageSize + 1, filteredResults.length)} to{' '}
              {Math.min(currentPage * pageSize, filteredResults.length)} of {filteredResults.length} records
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="px-2.5 py-1 rounded border border-gray-300 bg-white hover:bg-gray-50 disabled:opacity-40 cursor-pointer"
              >
                Previous
              </button>
              <span className="px-2 font-medium">
                {currentPage} / {totalPages}
              </span>
              <button
                type="button"
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                className="px-2.5 py-1 rounded border border-gray-300 bg-white hover:bg-gray-50 disabled:opacity-40 cursor-pointer"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modify Patient Details Modal */}
      {editingPatient && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/45 backdrop-blur-xs">
          <div className="bg-white rounded-xl shadow-2xl border border-gray-200 w-full max-w-3xl max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95">
            {/* Modal Header */}
            <div className="px-5 py-3.5 bg-[#487eb0] text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <UserCheck className="w-5 h-5 text-white" />
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-bold text-white">Modify Patient Details</h2>
                    <span className="font-mono text-xs font-semibold bg-white/20 text-white px-2 py-0.5 rounded">
                      {editingPatient.patientNumber}
                    </span>
                  </div>
                  <p className="text-xs text-blue-100">
                    Update demographic, guardian, and contact information
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Link
                  to={`/patients/${editingPatient.id}`}
                  target="_blank"
                  className="px-2.5 py-1 rounded bg-white text-blue-900 font-semibold text-xs hover:bg-blue-50 inline-flex items-center gap-1"
                >
                  <User className="w-3.5 h-3.5" /> Full profile
                </Link>
                <button
                  type="button"
                  onClick={() => setEditingPatient(null)}
                  className="p-1 rounded text-white/80 hover:text-white hover:bg-white/10"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSavePatient} className="flex-1 overflow-y-auto p-5 space-y-4">
              {editError && (
                <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 flex items-center gap-2 text-xs">
                  <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
                  <span>{editError}</span>
                </div>
              )}

              {/* Section 1: Demographics */}
              <div className="border border-gray-200 rounded-lg p-3.5 space-y-3 bg-gray-50/50">
                <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wider flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-blue-600" />
                  Basic Demographics
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Full Name *
                    </label>
                    <input
                      type="text"
                      required
                      className="input h-9 text-xs"
                      placeholder="e.g. Ramesh Kumar"
                      value={editForm.name}
                      onChange={(e) => setEditForm((p) => ({ ...p, name: e.target.value }))}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Gender *
                    </label>
                    <select
                      className="input h-9 text-xs"
                      value={editForm.gender}
                      onChange={(e) => setEditForm((p) => ({ ...p, gender: e.target.value }))}
                    >
                      <option value="MALE">Male</option>
                      <option value="FEMALE">Female</option>
                      <option value="OTHER">Other</option>
                      <option value="UNKNOWN">Unknown</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Age (Years)
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={125}
                      className="input h-9 text-xs"
                      placeholder="e.g. 45"
                      value={editForm.age}
                      onChange={(e) => handleAgeChange(e.target.value)}
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Date of Birth
                    </label>
                    <div className="relative">
                      <Calendar className="w-4 h-4 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        type="date"
                        className="input h-9 text-xs pl-8"
                        max={new Date().toISOString().split('T')[0]}
                        value={editForm.dob}
                        onChange={(e) => handleDobChange(e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Section 2: Contact Information */}
              <div className="border border-gray-200 rounded-lg p-3.5 space-y-3 bg-gray-50/50">
                <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wider flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5 text-blue-600" />
                  Contact Information
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Mobile Number
                    </label>
                    <input
                      type="text"
                      className="input h-9 text-xs font-mono"
                      placeholder="e.g. 9876543210"
                      value={editForm.phone}
                      onChange={(e) => setEditForm((p) => ({ ...p, phone: e.target.value }))}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Alternative Number
                    </label>
                    <input
                      type="text"
                      className="input h-9 text-xs font-mono"
                      placeholder="e.g. 9123456789"
                      value={editForm.alternatePhone}
                      onChange={(e) => setEditForm((p) => ({ ...p, alternatePhone: e.target.value }))}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Email Address
                    </label>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        type="email"
                        className="input h-9 text-xs pl-8"
                        placeholder="patient@example.com"
                        value={editForm.email}
                        onChange={(e) => setEditForm((p) => ({ ...p, email: e.target.value }))}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Section 3: Guardian / Relation Information */}
              <div className="border border-gray-200 rounded-lg p-3.5 space-y-3 bg-gray-50/50">
                <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wider flex items-center gap-1.5">
                  <UserCheck className="w-3.5 h-3.5 text-blue-600" />
                  Relation / Guardian Details
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Relationship
                    </label>
                    <select
                      className="input h-9 text-xs"
                      value={editForm.relationType}
                      onChange={(e) => setEditForm((p) => ({ ...p, relationType: e.target.value }))}
                    >
                      <option value="Father">Father</option>
                      <option value="Mother">Mother</option>
                      <option value="Spouse">Spouse</option>
                      <option value="Son">Son</option>
                      <option value="Daughter">Daughter</option>
                      <option value="Guardian">Guardian</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Relation Name
                    </label>
                    <input
                      type="text"
                      className="input h-9 text-xs"
                      placeholder="Father / Husband / Guardian Name"
                      value={editForm.relationName}
                      onChange={(e) => setEditForm((p) => ({ ...p, relationName: e.target.value }))}
                    />
                  </div>
                </div>
              </div>

              {/* Section 4: Address Details */}
              <div className="border border-gray-200 rounded-lg p-3.5 space-y-3 bg-gray-50/50">
                <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wider flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-blue-600" />
                  Address Details
                </h3>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Street / Area Address
                    </label>
                    <textarea
                      rows={2}
                      className="input text-xs"
                      placeholder="Door No, Street Name, Area..."
                      value={editForm.street}
                      onChange={(e) => setEditForm((p) => ({ ...p, street: e.target.value }))}
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        City / District
                      </label>
                      <input
                        type="text"
                        className="input h-9 text-xs"
                        placeholder="City"
                        value={editForm.city}
                        onChange={(e) => setEditForm((p) => ({ ...p, city: e.target.value }))}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        State
                      </label>
                      <input
                        type="text"
                        className="input h-9 text-xs"
                        placeholder="State"
                        value={editForm.state}
                        onChange={(e) => setEditForm((p) => ({ ...p, state: e.target.value }))}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Pincode
                      </label>
                      <input
                        type="text"
                        className="input h-9 text-xs font-mono"
                        placeholder="600001"
                        value={editForm.pincode}
                        onChange={(e) => setEditForm((p) => ({ ...p, pincode: e.target.value }))}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Form Action Footer */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => setEditingPatient(null)}
                  className="px-4 py-2 rounded border border-gray-300 text-gray-700 text-xs font-semibold hover:bg-gray-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-5 py-2 rounded bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold uppercase tracking-wider inline-flex items-center gap-1.5 shadow-sm cursor-pointer disabled:opacity-50"
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      Save Changes
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
