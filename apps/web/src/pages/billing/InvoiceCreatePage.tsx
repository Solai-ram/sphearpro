import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, FlaskConical, Loader2, Package, Pill, Plus, Search, Stethoscope, Trash2 } from 'lucide-react';
import { billingApi } from '../../services/billing';
import { inventoryApi } from '../../services/inventory';
import { patientsApi } from '../../services/patients';
import { labApi } from '../../services/lab';
import { therapyApi } from '../../services/therapy';
import { servicesApi, type ServiceMaster } from '../../services/services';
import type { InvoiceItemInput, PaymentMethod } from '../../types/billing';
import type { Product } from '../../types/inventory';
import type { LabProcedure } from '../../types/lab';
import type { TherapyPackage } from '../../types/therapy';

type Category = 'SERVICE' | 'PRODUCT' | 'LAB' | 'THERAPY';

const CATEGORIES: { id: Category; title: string; hint: string; icon: typeof Package }[] = [
  { id: 'SERVICE', title: 'Clinic service', hint: 'OP consultations & procedures', icon: Stethoscope },
  { id: 'PRODUCT', title: 'Product sale', hint: 'Hearing aids, accessories, stock items', icon: Package },
  { id: 'LAB', title: 'Audio test', hint: 'Audiology and diagnostic tests', icon: FlaskConical },
  { id: 'THERAPY', title: 'Therapy package', hint: 'Therapy packages and sessions', icon: Pill },
];

const PAY_METHODS: { id: PaymentMethod; label: string }[] = [
  { id: 'CASH', label: 'Cash' },
  { id: 'UPI', label: 'UPI' },
  { id: 'CARD', label: 'Card' },
];

const TYPE_FOR: Record<Category, InvoiceItemInput['billableType']> = {
  SERVICE: 'OTHER',
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
  const [servicesList, setServicesList] = useState<ServiceMaster[]>([]);
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
    servicesApi.list({ limit: 100, activeOnly: true }).then((res) => setServicesList(res.data || [])).catch(() => undefined);
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

  const applyService = (index: number, serviceId: string) => {
    const s = servicesList.find((item) => item.id === serviceId);
    if (!s) return;
    updateItem(index, {
      billableType: 'OTHER',
      referenceId: s.id,
      description: s.name,
      unitPrice: Number(s.price || 0),
      discount: 0,
      tax: 0,
    });
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
      discount: 0,
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
      discount: 0,
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
      discount: 0,
      quantity: 1,
      tax: 0,
    });
  };

  const { subtotal, discountTotal, taxTotal, total } = useMemo(() => {
    let sub = 0, disc = 0, tax = 0;
    for (const item of items) {
      const qty = item.quantity && item.quantity > 0 ? item.quantity : 1;
      sub += qty * Number(item.unitPrice || 0);
      disc += Number(item.discount || 0);
      tax += Number(item.tax || 0);
    }
    return { subtotal: sub, discountTotal: disc, taxTotal: tax, total: Math.max(0, sub - disc + tax) };
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
    <div className="max-w-4xl mx-auto space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">New billing</h1>
        <p className="text-sm text-gray-500">Choose a service category, select the patient, apply discounts if needed, and collect payment.</p>
      </div>
      {error && (
        <div className="p-3 rounded-lg bg-red-50 text-red-700 flex gap-2 text-sm">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />{error}
        </div>
      )}

      <div>
        <label className="label text-xs uppercase font-semibold text-gray-500 mb-1.5 block">1. Select Service Category</label>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {CATEGORIES.map((item) => {
            const Icon = item.icon;
            const active = category === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => pickCategory(item.id)}
                className={`card p-3 text-left transition-all ${active ? 'ring-2 ring-blue-600 bg-blue-50/30' : 'hover:border-blue-200'}`}
              >
                <Icon className={`w-5 h-5 mb-1 ${active ? 'text-blue-600' : 'text-gray-500'}`} />
                <p className="font-semibold text-sm text-gray-900">{item.title}</p>
                <p className="text-xs text-gray-500">{item.hint}</p>
              </button>
            );
          })}
        </div>
      </div>

      {category && (
        <div className="card p-4 space-y-2">
          <label className="label text-xs uppercase font-semibold text-gray-500 block">2. Select Patient *</label>
          {patientId ? (
            <div className="flex justify-between items-center p-3 bg-green-50 border border-green-200 rounded-lg text-sm">
              <span className="font-medium text-green-900">{selectedName}</span>
              <button type="button" className="text-blue-600 font-semibold hover:underline" onClick={() => { setPatientId(''); setSelectedName(''); }}>Change Patient</button>
            </div>
          ) : (
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input className="input pl-9" value={patientQuery} onChange={(e) => setPatientQuery(e.target.value)} placeholder="Search patient name, UHID / patient number, or phone..." autoFocus />
              {patients.length > 0 && (
                <div className="absolute z-10 mt-1 w-full bg-white border rounded-lg shadow-lg divide-y max-h-60 overflow-y-auto">
                  {patients.map((p) => (
                    <button type="button" key={p.id} className="w-full text-left px-3 py-2.5 hover:bg-blue-50/50 flex justify-between items-center" onClick={() => {
                      setPatientId(p.id);
                      setSelectedName(`${p.name} (${p.patientNumber})`);
                      setPatients([]);
                      setPatientQuery('');
                    }}>
                      <span className="font-medium text-gray-900">{p.name}</span>
                      <span className="font-mono text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded">{p.patientNumber}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {category && patientId && (
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="label text-xs uppercase font-semibold text-gray-500">3. Bill Line Items &amp; Discounts</label>
              <span className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full font-medium">
                Discounts supported per service
              </span>
            </div>

            {items.map((item, index) => (
              <div key={index} className="card p-4 space-y-3 bg-white border border-gray-200 shadow-sm">
                {category === 'SERVICE' && (
                  <div>
                    <label className="label text-xs">Select Service</label>
                    <select className="input" value={item.referenceId || ''} onChange={(e) => applyService(index, e.target.value)} required>
                      <option value="">-- Choose clinic service --</option>
                      {servicesList.map((s) => (
                        <option key={s.id} value={s.id}>{s.name} · ₹{Number(s.price).toFixed(2)}</option>
                      ))}
                    </select>
                  </div>
                )}
                {category === 'PRODUCT' && (
                  <div>
                    <label className="label text-xs">Select Product</label>
                    <select className="input" value={item.productId || ''} onChange={(e) => applyProduct(index, e.target.value)} required>
                      <option value="">-- Choose product --</option>
                      {catalog.filter((p) => p.isActive).map((p) => (
                        <option key={p.id} value={p.id}>{p.sku} — {p.name} · ₹{Number(p.unitPrice).toFixed(2)}</option>
                      ))}
                    </select>
                  </div>
                )}
                {category === 'LAB' && (
                  <div>
                    <label className="label text-xs">Select Audio Lab Procedure</label>
                    <select className="input" value={item.referenceId || ''} onChange={(e) => applyLab(index, e.target.value)} required>
                      <option value="">-- Choose audio test --</option>
                      {labCatalog.filter((p) => p.isActive !== false).map((p) => (
                        <option key={p.id} value={p.id}>{p.code} — {p.name} · {p.department} · ₹{Number(p.price).toFixed(2)}</option>
                      ))}
                    </select>
                  </div>
                )}
                {category === 'THERAPY' && (
                  <div>
                    <label className="label text-xs">Select Therapy Package</label>
                    <select className="input" value={item.referenceId || ''} onChange={(e) => applyPackage(index, e.target.value)} required>
                      <option value="">-- Choose therapy package --</option>
                      {packages.map((p) => (
                        <option key={p.id} value={p.id}>{p.name} · {p.totalSessions} sessions · ₹{Number(p.price).toFixed(2)}</option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
                  <div className="md:col-span-4">
                    <label className="label text-xs">Description *</label>
                    <input className="input" placeholder="Description" value={item.description} onChange={(e) => updateItem(index, { description: e.target.value })} required />
                  </div>
                  <div className="md:col-span-2">
                    <label className="label text-xs">Quantity</label>
                    <input className="input" type="number" min={1} value={item.quantity || 1} onChange={(e) => updateItem(index, { quantity: Number(e.target.value) })} />
                  </div>
                  <div className="md:col-span-2">
                    <label className="label text-xs">Price (₹)</label>
                    <input className="input" type="number" min={0} step="0.01" placeholder="0.00" value={item.unitPrice === 0 ? '' : (item.unitPrice ?? '')} onChange={(e) => updateItem(index, { unitPrice: e.target.value === '' ? 0 : Number(e.target.value) })} />
                  </div>
                  <div className="md:col-span-2">
                    <label className="label text-xs font-semibold text-emerald-700 flex items-center gap-1">
                      Discount (₹)
                    </label>
                    <input
                      className="input border-emerald-300 focus:border-emerald-500 focus:ring-emerald-500 bg-emerald-50/40 font-medium text-emerald-900"
                      type="number"
                      min={0}
                      step="0.01"
                      placeholder="0.00"
                      value={item.discount === 0 ? '' : (item.discount ?? '')}
                      onChange={(e) => updateItem(index, { discount: e.target.value === '' ? 0 : Number(e.target.value) })}
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="label text-xs text-gray-500">Net Amount</label>
                    <div className="input bg-gray-50 font-semibold text-gray-800 flex items-center">
                      {money(Math.max(0, (item.quantity || 1) * Number(item.unitPrice || 0) - Number(item.discount || 0)))}
                    </div>
                  </div>
                </div>

                {category === 'PRODUCT' && (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 pt-1 border-t">
                    <input className="input text-xs" placeholder="Model" value={item.model || ''} onChange={(e) => updateItem(index, { model: e.target.value })} />
                    <input className="input text-xs" placeholder="Serial no." value={item.serialNo || ''} onChange={(e) => updateItem(index, { serialNo: e.target.value })} />
                    <input className="input text-xs" placeholder="Warranty" value={item.warranty || ''} onChange={(e) => updateItem(index, { warranty: e.target.value })} />
                    <input className="input text-xs" placeholder="Colour" value={item.colour || ''} onChange={(e) => updateItem(index, { colour: e.target.value })} />
                  </div>
                )}

                <div className="flex justify-end pt-1">
                  <button type="button" className="btn-ghost text-xs text-red-600 hover:bg-red-50 flex items-center gap-1" onClick={() => setItems(items.filter((_, i) => i !== index))} disabled={items.length === 1}>
                    <Trash2 className="w-3.5 h-3.5" /> Remove item
                  </button>
                </div>
              </div>
            ))}

            <button type="button" className="btn-secondary text-sm" onClick={() => setItems([...items, emptyLine(category)])}>
              <Plus className="w-4 h-4 mr-1.5" /> Add another item
            </button>
          </div>

          <div className="card p-4 space-y-3 bg-white">
            <p className="text-xs uppercase font-semibold text-gray-500">4. Payment &amp; Total</p>
            <div className="space-y-1.5">
              <p className="text-sm font-medium text-gray-700">Payment method *</p>
              <div className="flex flex-wrap gap-2">
                {PAY_METHODS.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    className={`h-9 px-4 rounded-lg text-sm font-medium transition-colors ${payMethod === m.id ? 'btn-primary' : 'btn-ghost border border-gray-200'}`}
                    onClick={() => setPayMethod(m.id)}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>

            {(payMethod === 'UPI' || payMethod === 'CARD') && (
              <input className="input" placeholder={payMethod === 'UPI' ? 'UPI reference / UTR number' : 'Card approval code / last 4 digits'} value={payRef} onChange={(e) => setPayRef(e.target.value)} />
            )}

            <textarea className="input" rows={2} placeholder="Notes / Remarks (optional)" value={notes} onChange={(e) => setNotes(e.target.value)} />

            <div className="space-y-2 border-t pt-3 mt-2 bg-gray-50/70 p-3 rounded-lg border border-gray-200">
              <div className="flex justify-between text-sm text-gray-600">
                <span>Subtotal</span>
                <span className="font-mono">{money(subtotal)}</span>
              </div>
              <div className="flex justify-between text-sm items-center text-emerald-700 font-medium">
                <span className="flex items-center gap-1.5">
                  <span className="inline-block w-2 h-2 rounded-full bg-emerald-500"></span>
                  Total Discount
                </span>
                <span className="font-mono font-semibold">− {money(discountTotal)}</span>
              </div>
              {taxTotal > 0 && (
                <div className="flex justify-between text-sm text-gray-600">
                  <span>Tax</span>
                  <span className="font-mono">{money(taxTotal)}</span>
                </div>
              )}
              <div className="flex justify-between items-center pt-2 border-t border-gray-200 text-base font-bold text-gray-900">
                <span>Total Amount Payable</span>
                <span className="text-xl text-blue-600 font-mono">{money(total)}</span>
              </div>
            </div>

            <div className="flex items-center justify-end pt-2">
              <button type="submit" className="btn-primary px-6 py-2.5" disabled={isLoading || total < 0 || items.length === 0 || !items.some(it => it.description)}>
                {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : `Collect ${money(total)} (${PAY_METHODS.find((m) => m.id === payMethod)?.label})`}
              </button>
            </div>
          </div>
        </form>
      )}
    </div>
  );
}
