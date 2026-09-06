import { useEffect, useState, type ChangeEvent } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Upload, FileText, Download, Loader2, AlertCircle, Trash2 } from 'lucide-react';
import { documentsApi, type PatientDocument } from '../../services/documents';
import { patientsApi } from '../../services/patients';

export function PatientDocumentsPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [documents, setDocuments] = useState<PatientDocument[]>([]);
  const [categories, setCategories] = useState<Array<{ value: string; label: string }>>([]);
  const [category, setCategory] = useState('OTHER');
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [patientName, setPatientName] = useState('');

  const load = async () => {
    if (!id) return;
    setIsLoading(true);
    setError(null);
    try {
      const [patient, docs, cats] = await Promise.all([
        patientsApi.getById<{ name: string }>(id),
        documentsApi.listByPatient(id),
        documentsApi.categories(),
      ]);
      setPatientName(patient.name);
      setDocuments(docs.data || []);
      setCategories(cats);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load documents');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { load(); }, [id]);

  const handleUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !id) return;
    setIsUploading(true);
    setError(null);
    try {
      await documentsApi.upload(id, file, category);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setIsUploading(false);
      e.target.value = '';
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate(-1)} className="p-2 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Documents</h1>
            <p className="text-gray-500">{patientName || 'Patient'}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <select className="input w-auto" value={category} onChange={(e) => setCategory(e.target.value)}>
            {categories.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </select>
          <label className="btn-primary cursor-pointer">
            <Upload className="w-4 h-4 mr-2" />
            {isUploading ? 'Uploading…' : 'Upload'}
            <input type="file" className="hidden" onChange={handleUpload} disabled={isUploading} />
          </label>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-lg bg-red-50 border border-red-200 text-red-700 flex items-center gap-2">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="card overflow-hidden">
        {documents.length === 0 ? (
          <div className="py-16 text-center">
            <FileText className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">No documents uploaded yet</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {documents.map((doc) => (
              <div key={doc.id} className="flex items-center gap-4 p-4 hover:bg-gray-50 transition-colors">
                <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
                  <FileText className="w-5 h-5 text-blue-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{doc.fileName}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="badge-info">{doc.category.replace(/_/g, ' ')}</span>
                    <span className="text-xs text-gray-400">{(doc.sizeBytes / 1024).toFixed(1)} KB</span>
                    <span className="text-xs text-gray-400">{new Date(doc.uploadedAt).toLocaleDateString()}</span>
                  </div>
                </div>
                <button
                  onClick={() => documentsApi.download(doc.id).catch((err) => setError(err.message))}
                  className="p-2 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50"
                  aria-label={`Download ${doc.fileName}`}
                >
                  <Download className="w-5 h-5" />
                </button>
                <button
                  onClick={async () => {
                    if (!confirm(`Delete ${doc.fileName}?`)) return;
                    await documentsApi.remove(doc.id);
                    await load();
                  }}
                  className="p-2 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50"
                  aria-label={`Delete ${doc.fileName}`}
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
