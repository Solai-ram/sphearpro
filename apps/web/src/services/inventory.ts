import type { Product, ProductCategory, ProductSale, StockTransaction, StockTxnType, Supplier } from '../types/inventory';
import { fetchApi } from '../lib/api';

export const inventoryApi = {
  getCategories(): Promise<ProductCategory[]> {
    return fetchApi('/inventory/categories');
  },
  createCategory(data: { name: string }): Promise<ProductCategory> {
    return fetchApi('/inventory/categories', { method: 'POST', body: JSON.stringify(data) });
  },
  getSuppliers(): Promise<Supplier[]> {
    return fetchApi('/inventory/suppliers');
  },
  createSupplier(data: { name: string; contact?: string; email?: string; phone?: string }): Promise<Supplier> {
    return fetchApi('/inventory/suppliers', { method: 'POST', body: JSON.stringify(data) });
  },
  getProducts(filters?: { search?: string; categoryId?: string; lowStockOnly?: boolean; limit?: number }) {
    const params = new URLSearchParams();
    if (filters?.search) params.append('search', filters.search);
    if (filters?.categoryId) params.append('categoryId', filters.categoryId);
    if (filters?.lowStockOnly) params.append('lowStockOnly', 'true');
    params.append('limit', String(filters?.limit || 50));
    params.append('activeOnly', 'false');
    return fetchApi<{ data: Product[]; meta: { total: number } }>(`/inventory/products?${params.toString()}`);
  },
  getProduct(id: string): Promise<Product> {
    return fetchApi(`/inventory/products/${id}`);
  },
  createProduct(data: {
    sku: string;
    name: string;
    categoryId: string;
    description?: string;
    unitPrice: number;
    taxRate?: number;
    lowStockThreshold: number;
    initialStock?: number;
    supplierId?: string;
    unitCost?: number;
    model?: string;
    serialNo?: string;
    warranty?: string;
    colour?: string;
  }): Promise<Product> {
    return fetchApi('/inventory/products', { method: 'POST', body: JSON.stringify(data) });
  },
  updateProduct(id: string, data: Partial<Product>): Promise<Product> {
    return fetchApi(`/inventory/products/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
  },
  getLowStock(): Promise<Product[]> {
    return fetchApi('/inventory/low-stock');
  },
  getStockTransactions(productId?: string) {
    const params = new URLSearchParams();
    if (productId) params.append('productId', productId);
    params.append('limit', '40');
    return fetchApi<{ data: StockTransaction[] }>(`/inventory/stock/transactions?${params.toString()}`);
  },
  recordStock(data: {
    productId: string;
    type: Exclude<StockTxnType, 'SALE' | 'RETURN'>;
    quantity: number;
    supplierId?: string;
    unitCost?: number;
    note?: string;
  }): Promise<StockTransaction> {
    return fetchApi('/inventory/stock/transactions', { method: 'POST', body: JSON.stringify(data) });
  },
  getReturnRequests(filters?: { status?: string; productId?: string; page?: number; limit?: number }) {
    const params = new URLSearchParams();
    if (filters?.status) params.append('status', filters.status);
    if (filters?.productId) params.append('productId', filters.productId);
    params.append('limit', String(filters?.limit || 50));
    if (filters?.page) params.append('page', String(filters.page));
    return fetchApi<{ data: import('../types/inventory').StockReturnRequest[]; meta: { total: number } }>(
      `/inventory/returns?${params.toString()}`,
    );
  },
  createReturnRequest(data: { productId: string; quantity: number; reason?: string }) {
    return fetchApi<import('../types/inventory').StockReturnRequest>('/inventory/returns', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
  reviewReturnRequest(id: string, data: { approved: boolean; reviewNote?: string }) {
    return fetchApi<import('../types/inventory').StockReturnRequest>(`/inventory/returns/${id}/review`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
  getReturnsReport(filters?: { period?: string; startDate?: string; endDate?: string }) {
    const params = new URLSearchParams();
    if (filters?.period) params.append('period', filters.period);
    if (filters?.startDate) params.append('startDate', filters.startDate);
    if (filters?.endDate) params.append('endDate', filters.endDate);
    return fetchApi<{
      period: string;
      from: string;
      to: string;
      summary: {
        requests: number;
        pending: number;
        approved: number;
        rejected: number;
        approvedQuantity: number;
      };
      byProduct: { name: string; sku: string; requested: number; approved: number; rejected: number; pending: number }[];
      byDay: { date: string; requested: number; approved: number; rejected: number; pending: number }[];
      requests: import('../types/inventory').StockReturnRequest[];
    }>(`/inventory/reports/returns?${params.toString()}`);
  },
  getSales(filters?: { limit?: number; startDate?: string; endDate?: string }) {
    const params = new URLSearchParams();
    params.append('limit', String(filters?.limit || 40));
    if (filters?.startDate) params.append('startDate', filters.startDate);
    if (filters?.endDate) params.append('endDate', filters.endDate);
    return fetchApi<{ data: ProductSale[] }>(`/inventory/sales?${params.toString()}`);
  },
  getStockReport() {
    return fetchApi<{
      summary: { items: number; active: number; units: number; value: number; lowStock: number };
      byCategory: { category: string; items: number; units: number; value: number; lowStock: number }[];
      items: Product[];
    }>('/inventory/reports/stock');
  },
  getSalesReport(filters?: { period?: string; startDate?: string; endDate?: string }) {
    const params = new URLSearchParams();
    if (filters?.period) params.append('period', filters.period);
    if (filters?.startDate) params.append('startDate', filters.startDate);
    if (filters?.endDate) params.append('endDate', filters.endDate);
    return fetchApi<{
      period: string;
      from: string;
      to: string;
      summary: { sales: number; quantity: number; revenue: number };
      byProduct: { name: string; sku: string; quantity: number; revenue: number }[];
      byDay: { date: string; quantity: number; revenue: number; sales: number }[];
      sales: ProductSale[];
    }>(`/inventory/reports/sales?${params.toString()}`);
  },
  sell(data: { patientId: string; productId: string; quantity: number; unitPrice?: number; discount?: number }) {
    return fetchApi<{ sale: ProductSale; invoice: { id: string; invoiceNumber: string } }>('/inventory/sales', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
};
