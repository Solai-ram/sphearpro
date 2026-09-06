import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, Download, FileText, Loader2, Search, Trash2, Upload } from 'lucide-react';
import { documentsApi, type PatientDocument } from '../../services/documents';
import { patientsApi } from '../../services/patients';

export function DocumentsPage() {
  const [documents, setDocuments] = useState<PatientDocument[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [categories, setCategories] = useState<Array<{ value: string; label: string }>>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [patientQuery, setPatientQuery] = useState('');
  const [patients, setPatients] = useState<Array<{ id: string; name: string; patientNumber: string }>>([]);
  const [upload, setUpload] = useState({ patientId: '', patientName: '', category: 'OTHER', file: null as File | null });

  const load = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [list, cats] = await Promise.all([
        documentsApi.list({ page, search, category: category || undefined }),
        documentsApi.categories(),
      ]);
      setDocuments(list.data);
      setTotal(list.meta.total);
      setCategories(cats);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load documents');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { load(); }, [page]);

  useEffect(() => {
    const timer = setTimeout(async () => {
      if (patientQuery.length < 2) { setPatients([]); return; }
      setPatients(await patientsApi.search(patientQuery, 8));
    }, 300);
    return () => clearTimeout(timer);
  }, [patientQuery]);

  const submitUpload = async (e: FormEvent) => {
    e.preventDefault();
    if (!upload.patientId || !upload.file) {
      setError('Choose a patient and a file');
      return;
    }
    setIsUploading(true);
    setError(null);
    try {
      await documentsApi.upload(upload.patientId, upload.file, upload.category);
      setUpload({ patientId: '', patientName: '', category: 'OTHER', file: null });
      setPatientQuery('');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setIsUploading(false);
    }
  };

  const onFile = (e: ChangeEvent<HTMLInputElement>) => {
    setUpload((prev) => ({ ...prev, file: e.target.files?.[0] || null }));
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Documents</h1>
        <p className="text-gray-500">Patient files stored outside the database; access is audited</p>
      </div>

      {error && <div className="p-4 rounded-lg bg-red-50 text-red-700 flex gap-2"><AlertCircle className="w-5 h-5" />{error}</div>}

      <form className="card p-4 grid gap-3 md:grid-cols-4" onSubmit={submitUpload}>
        <div className="relative md:col-span-2">
          <label className="label">Patient</label>
          <input className="input" placeholder="Search patient" value={patientQuery} onChange={(e) => setPatientQuery(e.target.value)} />
          {upload.patientName && <p className="text-xs text-green-700 mt-1">{upload.patientName}</p>}
          {patients.length > 0 && (
            <div className="absolute z-10 bg-white border rounded shadow w-full mt-1">
              {patients.map((patient) => (
                <button
                  key={patient.id}
                  type="button"
                  className="block w-full text-left px-3 py-2 hover:bg-gray-50"
                  onClick={() => {
                    setUpload((prev) => ({ ...prev, patientId: patient.id, patientName: `${patient.name} (${patient.patientNumber})` }));
                    setPatientQuery(`${patient.name} (${patient.patientNumber})`);
                    setPatients([]);
                  }}
                >
                  {patient.name} · {patient.patientNumber}
                </button>
              ))}
            </div>
          )}
        </div>
        <div>
          <label className="label">Category</label>
          <select className="input" value={upload.category} onChange={(e) => setUpload((prev) => ({ ...prev, category: e.target.value }))}>
            {categories.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </select>
        </div>
        <div>
          <label className="label">File</label>
          <input className="input" type="file" onChange={onFile} />
        </div>
        <div className="md:col-span-4">
          <button className="btn-primary" disabled={isUploading} type="submit">
            <Upload className="w-4 h-4 mr-2" /> {isUploading ? 'Uploading…' : 'Upload'}
          </button>
        </div>
      </form>

      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
          <input className="input pl-9" placeholder="Search file or patient" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <select className="input w-auto" value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="">All categories</option>
          {categories.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
        </select>
        <button className="btn-secondary" onClick={() => { setPage(1); load(); }}>Filter</button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-blue-600" /></div>
      ) : documents.length === 0 ? (
        <div className="card py-16 text-center text-gray-500">
          <FileText className="w-12 h-12 mx-auto mb-3 text-gray-300" />
          No documents yet
        </div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left">
              <tr>
                <th className="p-3">File</th>
                <th className="p-3">Patient</th>
                <th className="p-3">Category</th>
                <th className="p-3">Uploaded</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody>
              {documents.map((doc) => (
                <tr key={doc.id} className="border-t">
                  <td className="p-3 font-medium">{doc.fileName}</td>
                  <td className="p-3">
                    {doc.patient ? (
                      <Link className="text-blue-700" to={`/patients/${doc.patient.id}`}>{doc.patient.name}</Link>
                    ) : '—'}
                  </td>
                  <td className="p-3">{doc.category.replace(/_/g, ' ')}</td>
                  <td className="p-3 text-gray-600">{new Date(doc.uploadedAt).toLocaleString()}</td>
                  <td className="p-3 text-right space-x-2 whitespace-nowrap">
                    <button className="text-blue-700 inline-flex items-center gap-1" onClick={() => documentsApi.download(doc.id).catch((err) => setError(err.message))}>
                      <Download className="w-4 h-4" /> Download
                    </button>
                    <button
                      className="text-red-600 inline-flex items-center gap-1"
                      onClick={async () => {
                        if (!confirm(`Delete ${doc.fileName}?`)) return;
                        await documentsApi.remove(doc.id);
                        await load();
                      }}
                    >
                      <Trash2 className="w-4 h-4" /> Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-sm text-gray-500">{total} documents</p>
      <div className="flex gap-2">
        <button className="btn-secondary" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</button>
        <button className="btn-secondary" onClick={() => setPage((p) => p + 1)}>Next</button>
      </div>
    </div>
  );
}
