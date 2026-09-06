import {
  Injectable,
  Inject,
  NotFoundException,
  BadRequestException,
  ConflictException,
  forwardRef,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { BillingService } from '../billing/billing.service';
import { resolveRange } from '../dashboard/dashboard.service';

export type StockTxnType = 'PURCHASE' | 'SALE' | 'RETURN' | 'DAMAGE' | 'ADJUSTMENT';

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function signedQuantity(type: StockTxnType, quantity: number): number {
  if (!Number.isInteger(quantity) || quantity === 0) {
    throw new BadRequestException('quantity must be a non-zero integer');
  }
  const abs = Math.abs(quantity);
  switch (type) {
    case 'PURCHASE':
    case 'RETURN':
      return abs;
    case 'SALE':
    case 'DAMAGE':
      return -abs;
    case 'ADJUSTMENT':
      return quantity;
    default:
      throw new BadRequestException('Invalid stock transaction type');
  }
}

@Injectable()
export class InventoryService {
  constructor(
    @Inject('PRISMA_CLIENT') private prisma: any,
    private auditService: AuditService,
    @Inject(forwardRef(() => BillingService)) private billingService: BillingService,
  ) {}

  // ---------------------------------------------------------------------------
  // Categories
  // ---------------------------------------------------------------------------

  async listCategories(clinicId: string) {
    return this.prisma.productCategory.findMany({
      where: { clinicId },
      orderBy: { name: 'asc' },
      include: { _count: { select: { products: true } } },
    });
  }

  async createCategory(data: {
    name: string;
    clinicId: string;
    parentId?: string;
  }, createdBy?: string) {
    const existing = await this.prisma.productCategory.findUnique({
      where: { clinicId_name: { clinicId: data.clinicId, name: data.name } },
    });
    if (existing) throw new ConflictException('Category name already exists');
    if (data.parentId) {
      const parent = await this.prisma.productCategory.findFirst({
        where: { id: data.parentId, clinicId: data.clinicId },
      });
      if (!parent) throw new NotFoundException('Parent category not found');
    }
    const category = await this.prisma.productCategory.create({
      data: { clinicId: data.clinicId, name: data.name, parentId: data.parentId },
    });
    await this.auditService.log({
      actorId: createdBy,
      actorType: 'user',
      action: 'PRODUCT_CATEGORY_CREATED',
      entityType: 'ProductCategory',
      entityId: category.id,
      result: 'SUCCESS',
      metadata: { name: category.name },
    });
    return category;
  }

  // ---------------------------------------------------------------------------
  // Suppliers
  // ---------------------------------------------------------------------------

  async listSuppliers(clinicId: string, includeInactive = false) {
    return this.prisma.supplier.findMany({
      where: { clinicId, ...(includeInactive ? {} : { isActive: true }) },
      orderBy: { name: 'asc' },
    });
  }

  async createSupplier(
    data: { name: string; clinicId: string; contact?: string; email?: string; phone?: string },
    createdBy?: string,
  ) {
    const supplier = await this.prisma.supplier.create({
      data: {
        clinicId: data.clinicId,
        name: data.name,
        contact: data.contact,
        email: data.email,
        phone: data.phone,
        isActive: true,
      },
    });
    await this.auditService.log({
      actorId: createdBy,
      actorType: 'user',
      action: 'SUPPLIER_CREATED',
      entityType: 'Supplier',
      entityId: supplier.id,
      result: 'SUCCESS',
      metadata: { name: supplier.name },
    });
    return supplier;
  }

  async updateSupplier(
    id: string,
    clinicId: string,
    data: { name?: string; contact?: string; email?: string; phone?: string; isActive?: boolean },
    updatedBy?: string,
  ) {
    const existing = await this.prisma.supplier.findFirst({ where: { id, clinicId } });
    if (!existing) throw new NotFoundException('Supplier not found');
    const supplier = await this.prisma.supplier.update({ where: { id }, data });
    await this.auditService.log({
      actorId: updatedBy,
      actorType: 'user',
      action: 'SUPPLIER_UPDATED',
      entityType: 'Supplier',
      entityId: id,
      result: 'SUCCESS',
      metadata: data,
    });
    return supplier;
  }

  // ---------------------------------------------------------------------------
  // Products
  // ---------------------------------------------------------------------------

  async findAllProducts(params: {
    page?: number;
    limit?: number;
    search?: string;
    categoryId?: string;
    activeOnly?: boolean;
    lowStockOnly?: boolean;
    clinicId: string;
  }) {
    const { page = 1, limit = 20, search, categoryId, activeOnly = true } = params;
    const skip = (page - 1) * limit;
    const where: Prisma.ProductWhereInput = { clinicId: params.clinicId };
    if (activeOnly) where.isActive = true;
    if (categoryId) where.categoryId = categoryId;
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { sku: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        skip,
        take: limit,
        orderBy: { name: 'asc' },
        include: { category: true },
      }),
      this.prisma.product.count({ where }),
    ]);

    const withStock = await this.attachStock(data);
    const filtered = params.lowStockOnly ? withStock.filter((p) => p.isLowStock) : withStock;
    return {
      data: filtered,
      meta: {
        page,
        limit,
        total: params.lowStockOnly ? filtered.length : total,
        totalPages: Math.ceil((params.lowStockOnly ? filtered.length : total) / limit),
      },
    };
  }

  async findProductById(id: string, clinicId: string) {
    const product = await this.prisma.product.findFirst({
      where: { id, clinicId },
      include: { category: true },
    });
    if (!product) throw new NotFoundException('Product not found');
    const [withStock] = await this.attachStock([product]);
    const transactions = await this.prisma.stockTransaction.findMany({
      where: { productId: id },
      orderBy: { createdAt: 'desc' },
      take: 25,
      include: { supplier: { select: { id: true, name: true } } },
    });
    return { ...withStock, transactions };
  }

  async createProduct(
    data: {
      sku: string;
      name: string;
      categoryId: string;
      clinicId: string;
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
    },
    createdBy?: string,
  ) {
    const sku = data.sku.trim().toUpperCase();
    const existing = await this.prisma.product.findUnique({ where: { clinicId_sku: { clinicId: data.clinicId, sku } } });
    if (existing) throw new ConflictException('SKU already exists');
    const category = await this.prisma.productCategory.findFirst({
      where: { id: data.categoryId, clinicId: data.clinicId },
    });
    if (!category) throw new NotFoundException('Category not found');
    if (data.supplierId) {
      const supplier = await this.prisma.supplier.findFirst({
        where: { id: data.supplierId, clinicId: data.clinicId },
      });
      if (!supplier) throw new NotFoundException('Supplier not found');
    }
    if (data.unitPrice < 0) throw new BadRequestException('unitPrice cannot be negative');
    if (data.lowStockThreshold < 0) throw new BadRequestException('lowStockThreshold cannot be negative');

    const product = await this.prisma.product.create({
      data: {
        clinicId: data.clinicId,
        sku,
        name: data.name,
        categoryId: data.categoryId,
        description: data.description,
        unitPrice: roundMoney(data.unitPrice),
        taxRate: roundMoney(data.taxRate || 0),
        lowStockThreshold: data.lowStockThreshold,
        model: data.model || null,
        serialNo: data.serialNo || null,
        warranty: data.warranty || null,
        colour: data.colour || null,
        isActive: true,
      },
      include: { category: true },
    });

    if (data.initialStock && data.initialStock > 0) {
      await this.recordStockMovement({
        productId: product.id,
        clinicId: data.clinicId,
        type: 'PURCHASE',
        quantity: data.initialStock,
        supplierId: data.supplierId,
        unitCost: data.unitCost,
        note: 'Opening stock',
        createdBy,
      });
    }

    await this.auditService.log({
      actorId: createdBy,
      actorType: 'user',
      action: 'PRODUCT_CREATED',
      entityType: 'Product',
      entityId: product.id,
      result: 'SUCCESS',
      metadata: { sku, name: product.name },
    });

    const [withStock] = await this.attachStock([product]);
    return withStock;
  }

  async updateProduct(
    id: string,
    clinicId: string,
    data: {
      name?: string;
      categoryId?: string;
      description?: string;
      unitPrice?: number;
      taxRate?: number;
      lowStockThreshold?: number;
      isActive?: boolean;
      model?: string;
      serialNo?: string;
      warranty?: string;
      colour?: string;
    },
    updatedBy?: string,
  ) {
    const existing = await this.prisma.product.findFirst({ where: { id, clinicId } });
    if (!existing) throw new NotFoundException('Product not found');
    if (data.categoryId) {
      const category = await this.prisma.productCategory.findFirst({
        where: { id: data.categoryId, clinicId },
      });
      if (!category) throw new NotFoundException('Category not found');
    }
    const product = await this.prisma.product.update({
      where: { id },
      data: {
        name: data.name,
        categoryId: data.categoryId,
        description: data.description,
        unitPrice: data.unitPrice !== undefined ? roundMoney(data.unitPrice) : undefined,
        taxRate: data.taxRate !== undefined ? roundMoney(data.taxRate) : undefined,
        lowStockThreshold: data.lowStockThreshold,
        isActive: data.isActive,
        model: data.model,
        serialNo: data.serialNo,
        warranty: data.warranty,
        colour: data.colour,
      },
      include: { category: true },
    });
    await this.auditService.log({
      actorId: updatedBy,
      actorType: 'user',
      action: 'PRODUCT_UPDATED',
      entityType: 'Product',
      entityId: id,
      result: 'SUCCESS',
      metadata: data,
    });
    const [withStock] = await this.attachStock([product]);
    return withStock;
  }

  // ---------------------------------------------------------------------------
  // Stock
  // ---------------------------------------------------------------------------

  async currentStock(productId: string): Promise<number> {
    const last = await this.prisma.stockTransaction.findFirst({
      where: { productId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });
    return last?.balance ?? 0;
  }

  async listStockTransactions(params: {
    clinicId: string;
    productId?: string;
    type?: StockTxnType;
    page?: number;
    limit?: number;
  }) {
    const { page = 1, limit = 30, productId, type, clinicId } = params;
    const skip = (page - 1) * limit;
    const where: Prisma.StockTransactionWhereInput = { clinicId };
    if (productId) where.productId = productId;
    if (type) where.type = type;
    const [data, total] = await Promise.all([
      this.prisma.stockTransaction.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          product: { select: { id: true, sku: true, name: true } },
          supplier: { select: { id: true, name: true } },
        },
      }),
      this.prisma.stockTransaction.count({ where }),
    ]);
    return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async recordStockMovement(data: {
    productId: string;
    clinicId?: string;
    type: StockTxnType;
    quantity: number;
    supplierId?: string;
    unitCost?: number;
    reference?: string;
    note?: string;
    createdBy?: string;
    /** When true, allows RETURN without going through approval workflow (internal use). */
    fromApprovedReturn?: boolean;
  }) {
    if (data.type === 'RETURN' && !data.fromApprovedReturn) {
      throw new BadRequestException(
        'Direct stock returns are not allowed. Submit a return request for admin approval.',
      );
    }
    const productWhere = data.clinicId
      ? { id: data.productId, clinicId: data.clinicId }
      : { id: data.productId };
    const product = await this.prisma.product.findFirst({ where: productWhere });
    if (!product) throw new NotFoundException('Product not found');
    const clinicId = data.clinicId ?? product.clinicId;
    if (data.supplierId) {
      const supplier = await this.prisma.supplier.findFirst({
        where: { id: data.supplierId, clinicId },
      });
      if (!supplier) throw new NotFoundException('Supplier not found');
    }

    const delta = signedQuantity(data.type, data.quantity);

    const txn = await this.prisma.$transaction(async (tx: any) => {
      const last = await tx.stockTransaction.findFirst({
        where: { productId: data.productId },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      });
      const previous = last?.balance ?? 0;
      const balance = previous + delta;
      if (balance < 0) {
        throw new BadRequestException(`Insufficient stock for ${product.name} (available ${previous})`);
      }
      return tx.stockTransaction.create({
        data: {
          clinicId,
          productId: data.productId,
          supplierId: data.supplierId,
          type: data.type,
          quantity: delta,
          balance,
          unitCost: data.unitCost !== undefined ? roundMoney(data.unitCost) : undefined,
          reference: data.reference,
          note: data.note,
          createdBy: data.createdBy,
        },
        include: {
          product: { select: { id: true, sku: true, name: true } },
          supplier: { select: { id: true, name: true } },
        },
      });
    });

    await this.auditService.log({
      actorId: data.createdBy,
      actorType: 'user',
      action: 'STOCK_MOVEMENT_RECORDED',
      entityType: 'StockTransaction',
      entityId: txn.id,
      result: 'SUCCESS',
      metadata: {
        productId: data.productId,
        type: data.type,
        quantity: delta,
        balance: txn.balance,
      },
    });

    return txn;
  }

  async lowStock(clinicId: string) {
    const products = await this.prisma.product.findMany({
      where: { clinicId, isActive: true },
      include: { category: true },
      orderBy: { name: 'asc' },
    });
    const withStock = await this.attachStock(products);
    return withStock.filter((p) => p.isLowStock);
  }

  // ---------------------------------------------------------------------------
  // Sales (invoice + stock decrement)
  // ---------------------------------------------------------------------------

  async sellProduct(data: {
    patientId: string;
    productId: string;
    quantity: number;
    unitPrice?: number;
    discount?: number;
    createdBy?: string;
    clinicId: string;
  }) {
    if (!Number.isInteger(data.quantity) || data.quantity < 1) {
      throw new BadRequestException('quantity must be a positive integer');
    }

    const patient = await this.prisma.patient.findFirst({
      where: { id: data.patientId, clinicId: data.clinicId, deletedAt: null },
    });
    if (!patient) throw new NotFoundException('Patient not found');

    const product = await this.prisma.product.findFirst({
      where: { id: data.productId, clinicId: data.clinicId },
    });
    if (!product) throw new NotFoundException('Product not found');
    if (!product.isActive) throw new BadRequestException('Product is inactive');

    const available = await this.currentStock(product.id);
    if (available < data.quantity) {
      throw new BadRequestException(`Insufficient stock for ${product.name} (available ${available})`);
    }

    const unitPrice = roundMoney(data.unitPrice ?? Number(product.unitPrice));
    const discount = roundMoney(data.discount || 0);
    const taxRate = Number(product.taxRate || 0);
    const afterDiscount = unitPrice * data.quantity - discount;
    const tax = roundMoney(Math.max(0, afterDiscount) * (taxRate / 100));
    const totalPrice = roundMoney(afterDiscount + tax);

    const invoice = await this.billingService.createInvoice({
      clinicId: data.clinicId,
      patientId: patient.id,
      notes: `Product sale: ${product.name}`,
      createdBy: data.createdBy,
      items: [
        {
          billableType: 'PRODUCT',
          productId: product.id,
          referenceId: product.id,
          description: product.name,
          quantity: data.quantity,
          unitPrice,
          discount,
          tax,
          model: product.model || undefined,
          serialNo: product.serialNo || undefined,
          warranty: product.warranty || undefined,
          colour: product.colour || undefined,
        },
      ],
    });

    const sale = await this.prisma.productSale.create({
      data: {
        clinicId: data.clinicId,
        patientId: patient.id,
        productId: product.id,
        quantity: data.quantity,
        unitPrice,
        totalPrice,
        invoiceId: invoice.id,
        createdBy: data.createdBy,
      },
      include: {
        product: { select: { id: true, sku: true, name: true } },
        patient: { select: { id: true, name: true, patientNumber: true } },
      },
    });

    const stock = await this.recordStockMovement({
      clinicId: data.clinicId,
      productId: product.id,
      type: 'SALE',
      quantity: data.quantity,
      reference: invoice.id,
      note: `Sold to ${patient.name}`,
      createdBy: data.createdBy,
    });

    await this.auditService.log({
      actorId: data.createdBy,
      actorType: 'user',
      patientId: patient.id,
      action: 'PRODUCT_SOLD',
      entityType: 'ProductSale',
      entityId: sale.id,
      result: 'SUCCESS',
      metadata: {
        productId: product.id,
        quantity: data.quantity,
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
      },
    });

    return { sale, invoice, stock };
  }

  async listSales(params: {
    clinicId: string;
    page?: number;
    limit?: number;
    patientId?: string;
    productId?: string;
    startDate?: Date;
    endDate?: Date;
  }) {
    const { page = 1, limit = 20, patientId, productId, startDate, endDate, clinicId } = params;
    const skip = (page - 1) * limit;
    const where: Prisma.ProductSaleWhereInput = { clinicId };
    if (patientId) where.patientId = patientId;
    if (productId) where.productId = productId;
    if (startDate || endDate) {
      where.soldAt = {};
      if (startDate) where.soldAt.gte = startDate;
      if (endDate) where.soldAt.lte = endDate;
    }
    const [data, total] = await Promise.all([
      this.prisma.productSale.findMany({
        where,
        skip,
        take: limit,
        orderBy: { soldAt: 'desc' },
        include: {
          product: { select: { id: true, sku: true, name: true } },
          patient: { select: { id: true, name: true, patientNumber: true } },
        },
      }),
      this.prisma.productSale.count({ where }),
    ]);
    return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async stockReport(clinicId: string) {
    const products = await this.prisma.product.findMany({
      where: { clinicId },
      include: { category: true },
      orderBy: [{ name: 'asc' }],
    });
    const withStock: any[] = await this.attachStock(products);
    const rows = withStock.map((p) => {
      const qty = Number(p.currentStock || 0);
      const price = roundMoney(Number(p.unitPrice || 0));
      return {
        ...p,
        unitPrice: price,
        stockValue: roundMoney(qty * price),
      };
    });
    const byCategoryMap = new Map<string, { category: string; items: number; units: number; value: number; lowStock: number }>();
    for (const row of rows) {
      const category = row.category?.name || 'Uncategorised';
      const current = byCategoryMap.get(category) || { category, items: 0, units: 0, value: 0, lowStock: 0 };
      current.items += 1;
      current.units += Number(row.currentStock || 0);
      current.value = roundMoney(current.value + row.stockValue);
      if (row.isLowStock) current.lowStock += 1;
      byCategoryMap.set(category, current);
    }
    return {
      summary: {
        items: rows.length,
        active: rows.filter((p) => p.isActive).length,
        units: rows.reduce((s, p) => s + Number(p.currentStock || 0), 0),
        value: roundMoney(rows.reduce((s, p) => s + p.stockValue, 0)),
        lowStock: rows.filter((p) => p.isLowStock).length,
      },
      byCategory: [...byCategoryMap.values()].sort((a, b) => b.value - a.value),
      items: rows,
    };
  }

  async salesReport(clinicId: string, period?: string, startDate?: string, endDate?: string) {
    const range = resolveRange(period, startDate, endDate);
    const sales = await this.prisma.productSale.findMany({
      where: { clinicId, soldAt: { gte: range.from, lte: range.to } },
      orderBy: { soldAt: 'desc' },
      include: {
        product: { select: { id: true, sku: true, name: true, category: { select: { name: true } } } },
        patient: { select: { id: true, name: true, patientNumber: true } },
      },
    });

    const byProductMap = new Map<string, { name: string; sku: string; quantity: number; revenue: number }>();
    const byDayMap = new Map<string, { date: string; quantity: number; revenue: number; sales: number }>();
    let quantity = 0;
    let revenue = 0;
    for (const sale of sales) {
      const qty = Number(sale.quantity || 0);
      const total = roundMoney(Number(sale.totalPrice || 0));
      quantity += qty;
      revenue = roundMoney(revenue + total);
      const key = sale.productId;
      const current = byProductMap.get(key) || {
        name: sale.product?.name || 'Unknown',
        sku: sale.product?.sku || '',
        quantity: 0,
        revenue: 0,
      };
      current.quantity += qty;
      current.revenue = roundMoney(current.revenue + total);
      byProductMap.set(key, current);

      const day = new Date(sale.soldAt);
      const dateKey = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`;
      const dayRow = byDayMap.get(dateKey) || { date: dateKey, quantity: 0, revenue: 0, sales: 0 };
      dayRow.quantity += qty;
      dayRow.revenue = roundMoney(dayRow.revenue + total);
      dayRow.sales += 1;
      byDayMap.set(dateKey, dayRow);
    }

    return {
      period: range.period,
      from: range.from,
      to: range.to,
      summary: {
        sales: sales.length,
        quantity,
        revenue,
      },
      byProduct: [...byProductMap.values()].sort((a, b) => b.revenue - a.revenue),
      byDay: [...byDayMap.values()].sort((a, b) => a.date.localeCompare(b.date)),
      sales,
    };
  }

  private async attachStock<T extends { id: string; lowStockThreshold: number }>(products: T[]) {
    const ids = products.map((p) => p.id);
    if (!ids.length) return [];
    const lastTxns = await this.prisma.stockTransaction.findMany({
      where: { productId: { in: ids } },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });
    const stockByProduct = new Map<string, number>();
    for (const txn of lastTxns) {
      if (!stockByProduct.has(txn.productId)) stockByProduct.set(txn.productId, txn.balance);
    }
    return products.map((product) => {
      const currentStock = stockByProduct.get(product.id) ?? 0;
      return {
        ...product,
        currentStock,
        isLowStock: currentStock <= product.lowStockThreshold,
      };
    });
  }

  // ---------------------------------------------------------------------------
  // Item return requests (staff submit → admin approve → stock RETURN)
  // ---------------------------------------------------------------------------

  private returnRequestInclude = {
    product: { select: { id: true, sku: true, name: true, unitPrice: true, category: { select: { name: true } } } },
    requester: { select: { id: true, name: true, email: true } },
    reviewer: { select: { id: true, name: true, email: true } },
    stockTransaction: {
      select: { id: true, quantity: true, balance: true, createdAt: true },
    },
  };

  async createReturnRequest(
    data: { clinicId: string; productId: string; quantity: number; reason?: string },
    requestedBy: string,
  ) {
    if (!Number.isInteger(data.quantity) || data.quantity < 1) {
      throw new BadRequestException('quantity must be a positive integer');
    }
    const product = await this.prisma.product.findFirst({
      where: { id: data.productId, clinicId: data.clinicId, isActive: true },
    });
    if (!product) throw new NotFoundException('Product not found');

    const request = await this.prisma.stockReturnRequest.create({
      data: {
        clinicId: data.clinicId,
        productId: data.productId,
        quantity: data.quantity,
        reason: data.reason?.trim() || null,
        requestedBy,
        status: 'PENDING',
      },
      include: this.returnRequestInclude,
    });

    await this.auditService.log({
      actorId: requestedBy,
      actorType: 'user',
      action: 'STOCK_RETURN_REQUESTED',
      entityType: 'StockReturnRequest',
      entityId: request.id,
      result: 'SUCCESS',
      metadata: { productId: data.productId, quantity: data.quantity },
    });

    return request;
  }

  async listReturnRequests(params: {
    clinicId: string;
    status?: 'PENDING' | 'APPROVED' | 'REJECTED';
    productId?: string;
    page?: number;
    limit?: number;
  }) {
    const { page = 1, limit = 30, clinicId, status, productId } = params;
    const skip = (page - 1) * limit;
    const where: any = { clinicId };
    if (status) where.status = status;
    if (productId) where.productId = productId;

    const [data, total] = await Promise.all([
      this.prisma.stockReturnRequest.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ requestedAt: 'desc' }],
        include: this.returnRequestInclude,
      }),
      this.prisma.stockReturnRequest.count({ where }),
    ]);

    return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async reviewReturnRequest(
    id: string,
    clinicId: string,
    data: { approved: boolean; reviewNote?: string },
    reviewedBy: string,
  ) {
    const request = await this.prisma.stockReturnRequest.findFirst({
      where: { id, clinicId },
      include: { product: true },
    });
    if (!request) throw new NotFoundException('Return request not found');
    if (request.status !== 'PENDING') {
      throw new BadRequestException('Return request has already been reviewed');
    }

    const now = new Date();

    if (!data.approved) {
      const rejected = await this.prisma.stockReturnRequest.update({
        where: { id },
        data: {
          status: 'REJECTED',
          reviewedBy,
          reviewedAt: now,
          reviewNote: data.reviewNote?.trim() || null,
        },
        include: this.returnRequestInclude,
      });
      await this.auditService.log({
        actorId: reviewedBy,
        actorType: 'user',
        action: 'STOCK_RETURN_REJECTED',
        entityType: 'StockReturnRequest',
        entityId: id,
        result: 'SUCCESS',
        metadata: { reviewNote: data.reviewNote || null },
      });
      return rejected;
    }

    const txn = await this.recordStockMovement({
      clinicId,
      productId: request.productId,
      type: 'RETURN',
      quantity: request.quantity,
      note: request.reason
        ? `Approved return: ${request.reason}`
        : 'Approved item return',
      reference: request.id,
      createdBy: reviewedBy,
      fromApprovedReturn: true,
    });

    const approved = await this.prisma.stockReturnRequest.update({
      where: { id },
      data: {
        status: 'APPROVED',
        reviewedBy,
        reviewedAt: now,
        reviewNote: data.reviewNote?.trim() || null,
        stockTransactionId: txn.id,
      },
      include: this.returnRequestInclude,
    });

    await this.auditService.log({
      actorId: reviewedBy,
      actorType: 'user',
      action: 'STOCK_RETURN_APPROVED',
      entityType: 'StockReturnRequest',
      entityId: id,
      result: 'SUCCESS',
      metadata: {
        stockTransactionId: txn.id,
        quantity: request.quantity,
        balance: txn.balance,
      },
    });

    return approved;
  }

  async returnsReport(clinicId: string, period?: string, startDate?: string, endDate?: string) {
    const range = resolveRange(period, startDate, endDate);
    const requests = await this.prisma.stockReturnRequest.findMany({
      where: {
        clinicId,
        requestedAt: { gte: range.from, lte: range.to },
      },
      orderBy: { requestedAt: 'desc' },
      include: this.returnRequestInclude,
    });

    const byProductMap = new Map<
      string,
      { name: string; sku: string; requested: number; approved: number; rejected: number; pending: number }
    >();
    const byDayMap = new Map<
      string,
      { date: string; requested: number; approved: number; rejected: number; pending: number }
    >();

    let pending = 0;
    let approved = 0;
    let rejected = 0;
    let approvedQty = 0;

    for (const req of requests) {
      if (req.status === 'PENDING') pending += 1;
      else if (req.status === 'APPROVED') {
        approved += 1;
        approvedQty += req.quantity;
      } else rejected += 1;

      const prodKey = req.productId;
      const prodRow = byProductMap.get(prodKey) || {
        name: req.product?.name || 'Unknown',
        sku: req.product?.sku || '',
        requested: 0,
        approved: 0,
        rejected: 0,
        pending: 0,
      };
      prodRow.requested += req.quantity;
      if (req.status === 'APPROVED') prodRow.approved += req.quantity;
      else if (req.status === 'REJECTED') prodRow.rejected += req.quantity;
      else prodRow.pending += req.quantity;
      byProductMap.set(prodKey, prodRow);

      const day = new Date(req.requestedAt);
      const dateKey = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`;
      const dayRow = byDayMap.get(dateKey) || {
        date: dateKey,
        requested: 0,
        approved: 0,
        rejected: 0,
        pending: 0,
      };
      dayRow.requested += 1;
      if (req.status === 'APPROVED') dayRow.approved += 1;
      else if (req.status === 'REJECTED') dayRow.rejected += 1;
      else dayRow.pending += 1;
      byDayMap.set(dateKey, dayRow);
    }

    return {
      period: range.period,
      from: range.from,
      to: range.to,
      summary: {
        requests: requests.length,
        pending,
        approved,
        rejected,
        approvedQuantity: approvedQty,
      },
      byProduct: [...byProductMap.values()].sort((a, b) => b.approved - a.approved),
      byDay: [...byDayMap.values()].sort((a, b) => a.date.localeCompare(b.date)),
      requests,
    };
  }
}
