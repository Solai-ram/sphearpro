export type StockTxnType = 'PURCHASE' | 'SALE' | 'RETURN' | 'DAMAGE' | 'ADJUSTMENT';

export interface ProductCategory {
  id: string;
  name: string;
  parentId?: string | null;
  _count?: { products: number };
}

export interface Supplier {
  id: string;
  name: string;
  contact?: string | null;
  email?: string | null;
  phone?: string | null;
  isActive: boolean;
}

export interface Product {
  id: string;
  sku: string;
  name: string;
  categoryId: string;
  description?: string | null;
  unitPrice: number | string;
  taxRate: number | string;
  lowStockThreshold: number;
  isActive: boolean;
  currentStock?: number;
  isLowStock?: boolean;
  model?: string | null;
  serialNo?: string | null;
  warranty?: string | null;
  colour?: string | null;
  category?: ProductCategory;
  transactions?: StockTransaction[];
}

export interface StockTransaction {
  id: string;
  productId: string;
  supplierId?: string | null;
  type: StockTxnType;
  quantity: number;
  balance: number;
  unitCost?: number | string | null;
  reference?: string | null;
  note?: string | null;
  createdAt: string;
  product?: { id: string; sku: string; name: string };
  supplier?: { id: string; name: string } | null;
}

export type StockReturnStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface StockReturnRequest {
  id: string;
  productId: string;
  quantity: number;
  reason?: string | null;
  status: StockReturnStatus;
  requestedBy: string;
  requestedAt: string;
  reviewedBy?: string | null;
  reviewedAt?: string | null;
  reviewNote?: string | null;
  stockTransactionId?: string | null;
  product?: { id: string; sku: string; name: string; unitPrice?: number | string };
  requester?: { id: string; name: string; email?: string };
  reviewer?: { id: string; name: string; email?: string } | null;
  stockTransaction?: { id: string; quantity: number; balance: number; createdAt: string } | null;
}

export interface ProductSale {
  id: string;
  patientId: string;
  productId: string;
  quantity: number;
  unitPrice: number | string;
  totalPrice: number | string;
  soldAt: string;
  invoiceId?: string | null;
  product?: { id: string; sku: string; name: string };
  patient?: { id: string; name: string; patientNumber: string };
}
