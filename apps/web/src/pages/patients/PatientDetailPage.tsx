import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { User, Phone, Mail, MapPin, Calendar, Stethoscope, Pill, DollarSign, FileText, Clock, ArrowLeft, Loader2, Edit, AlertCircle } from 'lucide-react';
import { patientsApi } from '../../services/patients';

interface PatientDetail {
  id: string;
  patientNumber: string;
  name: string;
  dateOfBirth?: string;
  gender?: string;
  phone?: string;
  alternatePhone?: string;
  email?: string;
  address?: {
    street?: string;
    city?: string;
    state?: string;
    pincode?: string;
    country?: string;
  };
  emergencyContact?: {
    name?: string;
    phone?: string;
    relationship?: string;
  };
  createdAt: string;
  updatedAt: string;
  opCases: any[];
  therapyCases: any[];
  invoices: any[];
  documents: any[];
  timelineEvents: any[];
}

function calculateAge(dateOfBirth: string | undefined): string {
  if (!dateOfBirth) return 'Unknown';
  const today = new Date();
  const birthDate = new Date(dateOfBirth);
  let age = today.getFullYear() - birthDate.getFullYear();
  const m = today.getMonth() - birthDate.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return `${age} years`;
}

function formatDate(date: string | undefined): string {
  if (!date) return 'Not specified';
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function PatientDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [patient, setPatient] = useState<PatientDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchPatient = async () => {
      try {
        if (!id) return;
        setPatient(await patientsApi.getById<PatientDetail>(id));
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load patient');
      } finally {
        setIsLoading(false);
      }
    };

    if (id) {
      fetchPatient();
    }
  }, [id]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="p-4 rounded-lg bg-red-50 border border-red-200 text-red-700 flex items-center gap-2">
          <AlertCircle className="w-5 h-5" />
          <span>{error}</span>
          <Link to="/patients" className="ml-4 text-blue-600 hover:text-blue-500">
            Back to patients
          </Link>
        </div>
      </div>
    );
  }

  if (!patient) {
    return <div className="text-center py-12 text-gray-500">Patient not found</div>;
  }

  const stats = [
    { label: 'OP Cases', value: patient.opCases?.length || 0, icon: Stethoscope, color: 'text-green-600 bg-green-100' },
    { label: 'Therapy Cases', value: patient.therapyCases?.length || 0, icon: Pill, color: 'text-purple-600 bg-purple-100' },
    { label: 'Documents', value: patient.documents?.length || 0, icon: FileText, color: 'text-orange-600 bg-orange-100' },
    { label: 'Invoices', value: patient.invoices?.length || 0, icon: DollarSign, color: 'text-red-600 bg-red-100' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate(-1)} className="p-2 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-gray-900">{patient.name}</h1>
              <span className="font-mono text-sm text-gray-500 bg-gray-100 rounded-lg px-2 py-1">
                {patient.patientNumber}
              </span>
            </div>
            <p className="text-gray-500">Patient registered {formatDate(patient.createdAt)}</p>
          </div>
        </div>
        <Link to={`/patients/${patient.id}/edit`} className="btn-outline">
          <Edit className="w-4 h-4 mr-2" />
          Edit
        </Link>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {stats.map((stat) => (
          <div key={stat.label} className="card p-4">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${stat.color} mb-3`}>
              <stat.icon className="w-5 h-5" />
            </div>
            <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
            <p className="text-sm text-gray-500">{stat.label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Patient info */}
        <div className="card p-6 lg:col-span-1">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Patient Details</h2>
          <dl className="space-y-4">
            <div>
              <dt className="text-sm text-gray-500 flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                Date of Birth
              </dt>
              <dd className="text-sm font-medium text-gray-900 mt-1">{formatDate(patient.dateOfBirth)} ({calculateAge(patient.dateOfBirth)})</dd>
            </div>
            <div>
              <dt className="text-sm text-gray-500">Gender</dt>
              <dd className="text-sm font-medium text-gray-900 mt-1">{patient.gender || 'Unspecified'}</dd>
            </div>
            <div>
              <dt className="text-sm text-gray-500 flex items-center gap-2">
                <Phone className="w-4 h-4" />
                Phone
              </dt>
              <dd className="text-sm font-medium text-gray-900 mt-1">{patient.phone || 'Not provided'}</dd>
              {patient.alternatePhone && (
                <dd className="text-sm text-gray-600 mt-1">Alt: {patient.alternatePhone}</dd>
              )}
            </div>
            <div>
              <dt className="text-sm text-gray-500 flex items-center gap-2">
                <Mail className="w-4 h-4" />
                Email
              </dt>
              <dd className="text-sm font-medium text-gray-900 mt-1">{patient.email || 'Not provided'}</dd>
            </div>
            {patient.address && (
              <div>
                <dt className="text-sm text-gray-500 flex items-center gap-2">
                  <MapPin className="w-4 h-4" />
                  Address
                </dt>
                <dd className="text-sm font-medium text-gray-900 mt-1">
                  {[patient.address.street, patient.address.city, patient.address.state]
                    .filter(Boolean)
                    .join(', ')}
                  {patient.address.pincode ? ` - ${patient.address.pincode}` : ''}
                </dd>
              </div>
            )}
            {patient.emergencyContact && (
              <div>
                <dt className="text-sm text-gray-500 flex items-center gap-2">
                  <User className="w-4 h-4" />
                  Emergency Contact
                </dt>
                <dd className="text-sm font-medium text-gray-900 mt-1">
                  {patient.emergencyContact.name}
                  {patient.emergencyContact.relationship ? ` (${patient.emergencyContact.relationship})` : ''}
                </dd>
                {patient.emergencyContact.phone && (
                  <dd className="text-sm text-gray-600 mt-1">{patient.emergencyContact.phone}</dd>
                )}
              </div>
            )}
          </dl>
        </div>

        {/* Timeline and recent activity */}
        <div className="lg:col-span-2 space-y-6">
          <div className="card p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Clock className="w-5 h-5 text-blue-600" />
              Recent Activity
            </h2>
            {patient.timelineEvents?.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <p>No activity yet for this patient</p>
                <Link to="/patients/op-new" className="text-blue-600 hover:text-blue-500 mt-2 inline-block">
                  Register OP visit
                </Link>
              </div>
            ) : (
              <div className="space-y-4">
                {patient.timelineEvents?.slice(0, 5).map((event: any) => (
                  <div key={event.id} className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
                      <Clock className="w-4 h-4 text-gray-500" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">{event.title || event.eventType}</p>
                      {event.description && (
                        <p className="text-sm text-gray-500">{event.description}</p>
                      )}
                      <p className="text-xs text-gray-400 mt-1">{formatDate(event.occurredAt)}</p>
                    </div>
                  </div>
                ))}
                <Link to={`/patients/${patient.id}`} className="text-sm text-blue-600 hover:text-blue-500">
                  View full timeline
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}