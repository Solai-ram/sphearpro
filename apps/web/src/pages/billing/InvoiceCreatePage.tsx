import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, FlaskConical, Loader2, Package, Pill, Plus, Search, Trash2 } from 'lucide-react';
import { billingApi } from '../../services/billing';
import { inventoryApi } from '../../services/inventory';
import { patientsApi } from '../../services/patients';
import { labApi } from '../../services/lab';
import { therapyApi } from '../../services/therapy';
import type { InvoiceItemInput, PaymentMethod } from '../../types/billing';
import type { Product } from '../../types/inventory';
import type { LabProcedure } from '../../types/lab';
import type { TherapyPackage } from '../../types/therapy';

type Category = 'PRODUCT' | 'LAB' | 'THERAPY';

const CATEGORIES: { id: Category; title: string; hint: string; icon: typeof Package }[] = [
  { id: 'PRODUCT', title: 'Product', hint: 'Hearing aids, accessories, stock items', icon: Package },
  { id: 'LAB', title: 'Lab', hint: 'Audiology and diagnostic tests', icon: FlaskConical },
  { id: 'THERAPY', title: 'Therapy', hint: 'Therapy packages and sessions', icon: Pill },
];

const PAY_METHODS: { id: PaymentMethod; label: string }[] = [
  { id: 'CASH', label: 'Cash' },
  { id: 'UPI', label: 'UPI' },
  { id: 'CARD', label: 'Card' },
];

const TYPE_FOR: Record<Category, InvoiceItemInput['billableType']> = {
  PRODUCT: 'PRODUCT',
  LAB: 'LAB_TEST',
  THERAPY: 'THERAPY_PACKAGE',
};

function money(n: number) {
  return `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function emptyLine(category: Category): InvoiceItemInput {
  return {
    billableType: TYPE_FOR[category],
    description: '',
    quantity: 1,
    unitPrice: 0,
    discount: 0,
    tax: 0,
    model: '',
    serialNo: '',
    warranty: '',
    colour: '',
  };
}

export function InvoiceCreatePage() {
  const navigate = useNavigate();
  const [category, setCategory] = useState<Category | null>(null);
  const [patientQuery, setPatientQuery] = useState('');
  const [patients, setPatients] = useState<{ id: string; name: string; patientNumber: string }[]>([]);
  const [patientId, setPatientId] = useState('');
  const [selectedName, setSelectedName] = useState('');
  const [catalog, setCatalog] = useState<Product[]>([]);
  const [labCatalog, setLabCatalog] = useState<LabProcedure[]>([]);
  const [packages, setPackages] = useState<TherapyPackage[]>([]);
  const [items, setItems] = useState<InvoiceItemInput[]>([]);
  const [payMethod, setPayMethod] = useState<PaymentMethod>('CASH');
  const [payRef, setPayRef] = useState('');
  const [notes, setNotes] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    inventoryApi.getProducts({ limit: 100 }).then((res) => setCatalog(res.data || [])).catch(() => undefined);
    labApi.getProcedures({ limit: 100 }).then((res) => setLabCatalog(res.data || [])).catch(() => undefined);
    therapyApi.getPackages().then((res) => setPackages((res.data || []).filter((p) => p.isActive !== false))).catch(() => undefined);
  }, []);

  useEffect(() => {
    const timer = setTimeout(async () => {
      if (patientQuery.length < 2) { setPatients([]); return; }
      setPatients(await patientsApi.search(patientQuery, 8));
    }, 250);
    return () => clearTimeout(timer);
  }, [patientQuery]);

  const pickCategory = (id: Category) => {
    setCategory(id);
    setItems([emptyLine(id)]);
    setError(null);
  };

  const updateItem = (index: number, patch: Partial<InvoiceItemInput>) => {
    setItems(items.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  };

  const applyProduct = (index: number, productId: string) => {
    const product = catalog.find((p) => p.id === productId);
    if (!product) return;
    const unitPrice = Number(product.unitPrice || 0);
    const taxRate = Number(product.taxRate || 0);
    const qty = items[index].quantity || 1;
    updateItem(index, {
      billableType: 'PRODUCT',
      productId: product.id,
      description: product.name,
      unitPrice,
      tax: Math.round(unitPrice * qty * (taxRate / 100) * 100) / 100,
      model: product.model || '',
      serialNo: product.serialNo || '',
      warranty: product.warranty || '',
      colour: product.colour || '',
    });
  };

  const applyLab = (index: number, procedureId: string) => {
    const procedure = labCatalog.find((p) => p.id === procedureId);
    if (!procedure) return;
    updateItem(index, {
      billableType: 'LAB_TEST',
      referenceId: procedure.id,
      description: `${procedure.code} — ${procedure.name}`,
      unitPrice: Number(procedure.price || 0),
      tax: 0,
    });
  };

  const applyPackage = (index: number, packageId: string) => {
    const pkg = packages.find((p) => p.id === packageId);
    if (!pkg) return;
    updateItem(index, {
      billableType: 'THERAPY_PACKAGE',
      referenceId: pkg.id,
      description: pkg.name,
      unitPrice: Number(pkg.price || 0),
      quantity: 1,
      tax: 0,
    });
  };

  const total = useMemo(() => {
    return items.reduce((sum, item) => {
      const qty = item.quantity && item.quantity > 0 ? item.quantity : 1;
      return sum + qty * Number(item.unitPrice || 0) - Number(item.discount || 0) + Number(item.tax || 0);
    }, 0);
  }, [items]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!category || !patientId) return;
    setIsLoading(true);
    setError(null);
    try {
      const invoice = await billingApi.createInvoice({
        patientId,
        notes: notes || undefined,
        items: items.filter((item) => item.description && item.unitPrice >= 0),
        payment: {
          method: payMethod,
          amount: Math.round(total * 100) / 100,
          reference: payRef.trim() || undefined,
        },
      });
      navigate(`/billing/${invoice.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create bill');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-3">
      <div>
        <h1 className="text-xl font-bold">New billing</h1>
        <p className="text-sm text-gray-500">Choose a category, find the patient, then complete the bill.</p>
      </div>
      {error && (
        <div className="p-3 rounded-lg bg-red-50 text-red-700 flex gap-2 text-sm">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />{error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
        {CATEGORIES.map((item) => {
          const Icon = item.icon;
          const active = category === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => pickCategory(item.id)}
              className={`card p-3 text-left ${active ? 'ring-2 ring-blue-600' : 'hover:border-blue-200'}`}
            >
              <Icon className={`w-5 h-5 mb-1 ${active ? 'text-blue-600' : 'text-gray-500'}`} />
              <p className="font-semibold">{item.title}</p>
              <p className="text-xs text-gray-500">{item.hint}</p>
            </button>
          );
        })}
      </div>

      {category && (
        <div className="card p-3 space-y-2">
          <label className="label">Patient *</label>
          {patientId ? (
            <div className="flex justify-between p-2 bg-green-50 rounded-lg text-sm">
              <span>{selectedName}</span>
              <button type="button" className="text-blue-600" onClick={() => { setPatientId(''); setSelectedName(''); }}>Change</button>
            </div>
          ) : (
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input className="input pl-9" value={patientQuery} onChange={(e) => setPatientQuery(e.target.value)} placeholder="Search patient name, ID, or phone..." />
              {patients.length > 0 && (
                <div className="absolute z-10 mt-1 w-full bg-white border rounded-lg shadow">
                  {patients.map((p) => (
                    <button type="button" key={p.id} className="w-full text-left px-3 py-2 hover:bg-gray-50" onClick={() => {
                      setPatientId(p.id);
                      setSelectedName(`${p.name} (${p.patientNumber})`);
                      setPatients([]);
                      setPatientQuery('');
                    }}>
                      {p.name} <span className="font-mono text-sm text-gray-500">{p.patientNumber}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {category && patientId && (
        <form onSubmit={onSubmit} className="space-y-3">
          {items.map((item, index) => (
            <div key={index} className="card p-3 space-y-2">
              {category === 'PRODUCT' && (
                <select className="input" value={item.productId || ''} onChange={(e) => applyProduct(index, e.target.value)} required>
                  <option value="">Select product</option>
                  {catalog.filter((p) => p.isActive).map((p) => (
                    <option key={p.id} value={p.id}>{p.sku} — {p.name} · ₹{Number(p.unitPrice).toFixed(2)}</option>
                  ))}
                </select>
              )}
              {category === 'LAB' && (
                <select className="input" value={item.referenceId || ''} onChange={(e) => applyLab(index, e.target.value)} required>
                  <option value="">Select lab test</option>
                  {labCatalog.filter((p) => p.isActive !== false).map((p) => (
                    <option key={p.id} value={p.id}>{p.code} — {p.name} · {p.department} · ₹{Number(p.price).toFixed(2)}</option>
                  ))}
                </select>
              )}
              {category === 'THERAPY' && (
                <select className="input" value={item.referenceId || ''} onChange={(e) => applyPackage(index, e.target.value)} required>
                  <option value="">Select therapy package</option>
                  {packages.map((p) => (
                    <option key={p.id} value={p.id}>{p.name} · {p.totalSessions} sessions · ₹{Number(p.price).toFixed(2)}</option>
                  ))}
                </select>
              )}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                <input className="input col-span-2" placeholder="Description" value={item.description} onChange={(e) => updateItem(index, { description: e.target.value })} required />
                <input className="input" type="number" min={1} value={item.quantity || 1} onChange={(e) => updateItem(index, { quantity: Number(e.target.value) })} />
                <input className="input" type="number" min={0} step="0.01" placeholder="Price" value={item.unitPrice} onChange={(e) => updateItem(index, { unitPrice: Number(e.target.value) })} />
              </div>
              {category === 'PRODUCT' && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  <input className="input" placeholder="Model" value={item.model || ''} onChange={(e) => updateItem(index, { model: e.target.value })} />
                  <input className="input" placeholder="Serial no." value={item.serialNo || ''} onChange={(e) => updateItem(index, { serialNo: e.target.value })} />
                  <input className="input" placeholder="Warranty" value={item.warranty || ''} onChange={(e) => updateItem(index, { warranty: e.target.value })} />
                  <input className="input" placeholder="Colour" value={item.colour || ''} onChange={(e) => updateItem(index, { colour: e.target.value })} />
                </div>
              )}
              <div className="flex justify-end">
                <button type="button" className="btn-ghost" onClick={() => setItems(items.filter((_, i) => i !== index))} disabled={items.length === 1}>
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
          <button type="button" className="btn-secondary" onClick={() => setItems([...items, emptyLine(category)])}>
            <Plus className="w-4 h-4 mr-1" /> Add line
          </button>

          <div className="card p-3 space-y-2">
            <p className="text-sm font-semibold">Mode of payment *</p>
            <div className="flex flex-wrap gap-2">
              {PAY_METHODS.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  className={`h-9 px-3 rounded-lg text-sm font-medium ${payMethod === m.id ? 'btn-primary' : 'btn-ghost'}`}
                  onClick={() => setPayMethod(m.id)}
                >
                  {m.label}
                </button>
              ))}
            </div>
            {(payMethod === 'UPI' || payMethod === 'CARD') && (
              <input className="input" placeholder={payMethod === 'UPI' ? 'UPI reference' : 'Card approval / last 4'} value={payRef} onChange={(e) => setPayRef(e.target.value)} />
            )}
            <textarea className="input" rows={2} placeholder="Notes (optional)" value={notes} onChange={(e) => setNotes(e.target.value)} />
            <div className="flex items-center justify-between pt-1">
              <p className="text-lg font-bold">Total {money(total)}</p>
              <button className="btn-primary" disabled={isLoading || total <= 0}>
                {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : `Collect ${PAY_METHODS.find((m) => m.id === payMethod)?.label}`}
              </button>
            </div>
          </div>
        </form>
      )}
    </div>
  );
}
