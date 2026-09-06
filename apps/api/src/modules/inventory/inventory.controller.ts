import { Controller, Get, Post, Patch, Param, Body, Query, BadRequestException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery, ApiParam } from '@nestjs/swagger';
import { InventoryService } from './inventory.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Authenticated } from '../../common/decorators/auth.decorator';
import { RequireFeature } from '../../common/decorators/subscription.decorator';
import { requireClinicId } from '../../common/tenant/clinic-context';

@ApiTags('Inventory')
@ApiBearerAuth()
@Controller('inventory')
@RequireFeature('INVENTORY')
export class InventoryController {
  constructor(private inventoryService: InventoryService) {}

  @Get('categories')
  @Authenticated('inventory.product.view')
  @ApiOperation({ summary: 'List product categories' })
  listCategories(@CurrentUser() user: { clinicId?: string }) {
    return this.inventoryService.listCategories(requireClinicId(user));
  }

  @Post('categories')
  @Authenticated('inventory.product.create')
  @ApiOperation({ summary: 'Create product category' })
  createCategory(
    @Body() body: { name: string; parentId?: string },
    @CurrentUser() user: { sub?: string; clinicId?: string },
  ) {
    return this.inventoryService.createCategory(
      { ...body, clinicId: requireClinicId(user) },
      user.sub,
    );
  }

  @Get('suppliers')
  @Authenticated('inventory.product.view')
  @ApiOperation({ summary: 'List suppliers' })
  @ApiQuery({ name: 'includeInactive', required: false })
  listSuppliers(
    @CurrentUser() user: { clinicId?: string },
    @Query('includeInactive') includeInactive?: string,
  ) {
    return this.inventoryService.listSuppliers(requireClinicId(user), includeInactive === 'true');
  }

  @Post('suppliers')
  @Authenticated('inventory.stock.manage')
  @ApiOperation({ summary: 'Create supplier' })
  createSupplier(
    @Body() body: { name: string; contact?: string; email?: string; phone?: string },
    @CurrentUser() user: { sub?: string; clinicId?: string },
  ) {
    return this.inventoryService.createSupplier(
      { ...body, clinicId: requireClinicId(user) },
      user.sub,
    );
  }

  @Patch('suppliers/:id')
  @Authenticated('inventory.stock.manage')
  @ApiOperation({ summary: 'Update supplier' })
  updateSupplier(
    @Param('id') id: string,
    @Body() body: { name?: string; contact?: string; email?: string; phone?: string; isActive?: boolean },
    @CurrentUser() user: { sub?: string; clinicId?: string },
  ) {
    return this.inventoryService.updateSupplier(id, requireClinicId(user), body, user.sub);
  }

  @Get('low-stock')
  @Authenticated('inventory.lowstock.view')
  @ApiOperation({ summary: 'List products at or below low-stock threshold' })
  lowStock(@CurrentUser() user: { clinicId?: string }) {
    return this.inventoryService.lowStock(requireClinicId(user));
  }

  @Get('reports/stock')
  @Authenticated('inventory.product.view')
  @ApiOperation({ summary: 'Stock report with on-hand qty and value' })
  stockReport(@CurrentUser() user: { clinicId?: string }) {
    return this.inventoryService.stockReport(requireClinicId(user));
  }

  @Get('reports/sales')
  @Authenticated('inventory.product.view')
  @ApiOperation({ summary: 'Sales report for a date range' })
  @ApiQuery({ name: 'period', required: false })
  @ApiQuery({ name: 'startDate', required: false })
  @ApiQuery({ name: 'endDate', required: false })
  salesReport(
    @CurrentUser() user: { clinicId?: string },
    @Query('period') period?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.inventoryService.salesReport(requireClinicId(user), period, startDate, endDate);
  }

  @Get('products')
  @Authenticated('inventory.product.view')
  @ApiOperation({ summary: 'List products with current stock' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({ name: 'categoryId', required: false, type: String })
  @ApiQuery({ name: 'activeOnly', required: false })
  @ApiQuery({ name: 'lowStockOnly', required: false })
  listProducts(
    @CurrentUser() user: { clinicId?: string },
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('search') search?: string,
    @Query('categoryId') categoryId?: string,
    @Query('activeOnly') activeOnly?: string,
    @Query('lowStockOnly') lowStockOnly?: string,
  ) {
    return this.inventoryService.findAllProducts({
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 20,
      search,
      categoryId,
      activeOnly: activeOnly === 'false' ? false : true,
      lowStockOnly: lowStockOnly === 'true',
      clinicId: requireClinicId(user),
    });
  }

  @Post('products')
  @Authenticated('inventory.product.create')
  @ApiOperation({ summary: 'Create product' })
  createProduct(
    @Body()
    body: {
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
    },
    @CurrentUser() user: { sub?: string; clinicId?: string },
  ) {
    return this.inventoryService.createProduct(
      { ...body, clinicId: requireClinicId(user) },
      user.sub,
    );
  }

  @Get('products/:id')
  @Authenticated('inventory.product.view')
  @ApiParam({ name: 'id' })
  @ApiOperation({ summary: 'Get product with stock and recent movements' })
  getProduct(@Param('id') id: string, @CurrentUser() user: { clinicId?: string }) {
    return this.inventoryService.findProductById(id, requireClinicId(user));
  }

  @Patch('products/:id')
  @Authenticated('inventory.product.create')
  @ApiParam({ name: 'id' })
  @ApiOperation({ summary: 'Update product' })
  updateProduct(
    @Param('id') id: string,
    @Body()
    body: {
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
    @CurrentUser() user: { sub?: string; clinicId?: string },
  ) {
    return this.inventoryService.updateProduct(id, requireClinicId(user), body, user.sub);
  }

  @Get('stock/transactions')
  @Authenticated('inventory.stock.manage')
  @ApiOperation({ summary: 'List stock movements' })
  @ApiQuery({ name: 'productId', required: false })
  @ApiQuery({ name: 'type', required: false })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  listStock(
    @CurrentUser() user: { clinicId?: string },
    @Query('productId') productId?: string,
    @Query('type') type?: 'PURCHASE' | 'SALE' | 'RETURN' | 'DAMAGE' | 'ADJUSTMENT',
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.inventoryService.listStockTransactions({
      clinicId: requireClinicId(user),
      productId,
      type,
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 30,
    });
  }

  @Post('stock/transactions')
  @Authenticated('inventory.stock.manage')
  @ApiOperation({ summary: 'Record purchase, return, damage, or adjustment' })
  recordStock(
    @Body()
    body: {
      productId: string;
      type: 'PURCHASE' | 'SALE' | 'RETURN' | 'DAMAGE' | 'ADJUSTMENT';
      quantity: number;
      supplierId?: string;
      unitCost?: number;
      reference?: string;
      note?: string;
      clinicId?: string;
    },
    @CurrentUser() user: { sub?: string; clinicId?: string },
  ) {
    if (body.type === 'SALE') {
      throw new BadRequestException('Use POST /inventory/sales to sell products so billing and stock stay in sync');
    }
    if (body.type === 'RETURN') {
      throw new BadRequestException('Use POST /inventory/returns to submit a return request for admin approval');
    }
    const { clinicId: _ignored, ...rest } = body;
    return this.inventoryService.recordStockMovement({
      ...rest,
      createdBy: user.sub,
      clinicId: requireClinicId(user),
    });
  }

  @Get('returns')
  @Authenticated('inventory.return.view')
  @ApiOperation({ summary: 'List item return requests' })
  @ApiQuery({ name: 'status', required: false, enum: ['PENDING', 'APPROVED', 'REJECTED'] })
  @ApiQuery({ name: 'productId', required: false })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  listReturns(
    @CurrentUser() user: { clinicId?: string | null },
    @Query('status') status?: 'PENDING' | 'APPROVED' | 'REJECTED',
    @Query('productId') productId?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.inventoryService.listReturnRequests({
      clinicId: requireClinicId(user),
      status,
      productId,
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 30,
    });
  }

  @Post('returns')
  @Authenticated('inventory.return.request')
  @ApiOperation({ summary: 'Submit item return request (awaiting admin approval)' })
  createReturn(
    @CurrentUser() user: { sub: string; clinicId?: string | null },
    @Body() body: { productId: string; quantity: number; reason?: string },
  ) {
    return this.inventoryService.createReturnRequest(
      { ...body, clinicId: requireClinicId(user) },
      user.sub,
    );
  }

  @Post('returns/:id/review')
  @Authenticated('inventory.return.approve')
  @ApiOperation({ summary: 'Approve or reject item return request (admin)' })
  reviewReturn(
    @Param('id') id: string,
    @CurrentUser() user: { sub: string; clinicId?: string | null },
    @Body() body: { approved: boolean; reviewNote?: string },
  ) {
    return this.inventoryService.reviewReturnRequest(
      id,
      requireClinicId(user),
      body,
      user.sub,
    );
  }

  @Get('reports/returns')
  @Authenticated('inventory.return.view')
  @ApiOperation({ summary: 'Item return report for a date range' })
  @ApiQuery({ name: 'period', required: false })
  @ApiQuery({ name: 'startDate', required: false })
  @ApiQuery({ name: 'endDate', required: false })
  returnsReport(
    @CurrentUser() user: { clinicId?: string | null },
    @Query('period') period?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.inventoryService.returnsReport(requireClinicId(user), period, startDate, endDate);
  }

  @Get('sales')
  @Authenticated('inventory.product.sale')
  @ApiOperation({ summary: 'List product sales' })
  @ApiQuery({ name: 'patientId', required: false })
  @ApiQuery({ name: 'productId', required: false })
  @ApiQuery({ name: 'page', required: false, type: Number })
  listSales(
    @CurrentUser() user: { clinicId?: string },
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('patientId') patientId?: string,
    @Query('productId') productId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.inventoryService.listSales({
      clinicId: requireClinicId(user),
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 20,
      patientId,
      productId,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
    });
  }

  @Post('sales')
  @Authenticated('inventory.product.sale')
  @ApiOperation({ summary: 'Sell a product to a patient (invoice + stock decrement)' })
  sell(
    @Body()
    body: {
      patientId: string;
      productId: string;
      quantity: number;
      unitPrice?: number;
      discount?: number;
    },
    @CurrentUser() user: { sub?: string; clinicId?: string },
  ) {
    return this.inventoryService.sellProduct({
      ...body,
      createdBy: user.sub,
      clinicId: requireClinicId(user),
    });
  }
}
