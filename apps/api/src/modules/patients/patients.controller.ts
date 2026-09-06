import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery, ApiConsumes } from '@nestjs/swagger';
import { PatientsService } from './patients.service';
import { DocumentsService } from '../documents/documents.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { multerDocumentOptions } from '../../common/upload/multer-options';
import { Authenticated } from '../../common/decorators/auth.decorator';
import { requireClinicId } from '../../common/tenant/clinic-context';

@ApiTags('Patients')
@ApiBearerAuth()
@Controller('patients')
export class PatientsController {
  constructor(
    private patientsService: PatientsService,
    private documentsService: DocumentsService,
  ) {}

  @Get()
  @Authenticated('patients.view')
  @ApiOperation({ summary: 'List all patients' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({ name: 'gender', required: false, type: String })
  async findAll(
    @CurrentUser() user: { clinicId?: string },
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('search') search?: string,
    @Query('gender') gender?: string,
  ) {
    return this.patientsService.findAll({
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 20,
      search,
      gender,
      clinicId: requireClinicId(user),
    });
  }

  @Get('search')
  @Authenticated('patients.view')
  @ApiOperation({ summary: 'Search patients (autocomplete)' })
  @ApiQuery({ name: 'q', required: true, type: String })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'opRegistered', required: false, type: Boolean })
  async search(
    @CurrentUser() user: { clinicId?: string },
    @Query('q') q: string,
    @Query('limit') limit?: number,
    @Query('opRegistered') opRegistered?: string,
  ) {
    return this.patientsService.search(q, limit ? Number(limit) : 10, {
      opRegistered: opRegistered === 'true' || opRegistered === '1',
      clinicId: requireClinicId(user),
    });
  }

  @Get('number/:patientNumber')
  @Authenticated('patients.view')
  @ApiOperation({ summary: 'Get patient by patient number' })
  async findByPatientNumber(
    @Param('patientNumber') patientNumber: string,
    @CurrentUser() user: { clinicId?: string },
  ) {
    return this.patientsService.findByPatientNumber(patientNumber, requireClinicId(user));
  }

  @Get(':id')
  @Authenticated('patients.view')
  @ApiOperation({ summary: 'Get patient by ID' })
  async findById(@Param('id') id: string, @CurrentUser() user: { clinicId?: string }) {
    return this.patientsService.findById(id, requireClinicId(user));
  }

  @Get(':id/stats')
  @Authenticated('patients.view')
  @ApiOperation({ summary: 'Get patient statistics' })
  async getStats(@Param('id') id: string, @CurrentUser() user: { clinicId?: string }) {
    return this.patientsService.getStats(id, requireClinicId(user));
  }

  @Get(':id/timeline')
  @Authenticated('patients.timeline.view')
  @ApiOperation({ summary: 'Get patient timeline' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'eventType', required: false, type: String })
  @ApiQuery({ name: 'startDate', required: false, type: String })
  @ApiQuery({ name: 'endDate', required: false, type: String })
  async getTimeline(
    @Param('id') id: string,
    @CurrentUser() user: { clinicId?: string },
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('eventType') eventType?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.patientsService.getTimeline(id, {
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 50,
      eventType,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      clinicId: requireClinicId(user),
    });
  }

  @Get(':id/documents')
  @Authenticated('documents.view')
  @ApiOperation({ summary: 'List documents for a patient' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'category', required: false, type: String })
  async getDocuments(
    @Param('id') id: string,
    @CurrentUser() user: { clinicId?: string },
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('category') category?: string,
  ) {
    return this.patientsService.getDocuments(id, {
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 20,
      category,
      clinicId: requireClinicId(user),
    });
  }

  @Get(':id/documents/categories')
  @Authenticated('documents.view')
  @ApiOperation({ summary: 'Get available document categories' })
  async getDocumentCategories() {
    return this.patientsService.getDocumentCategories();
  }

  @Post(':id/documents')
  @Authenticated('documents.upload')
  @ApiOperation({ summary: 'Upload a document for a patient' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file', multerDocumentOptions()))
  async uploadDocument(
    @Param('id') patientId: string,
    @UploadedFile() file: Express.Multer.File,
    @Query('category') categoryQuery: string,
    @Body() body: { category?: string },
    @CurrentUser() user: { sub?: string; clinicId?: string },
  ) {
    if (!file) {
      throw new BadRequestException('No file provided');
    }

    const category = body?.category || categoryQuery;
    if (!category) {
      throw new BadRequestException('Category is required');
    }

    const clinicId = requireClinicId(user);
    await this.patientsService.findById(patientId, clinicId);

    const input: import('../documents/documents.service').UploadDocumentInput = {
      patientId,
      category: category as any,
      fileName: file.originalname,
      mimeType: file.mimetype,
      sizeBytes: file.size,
      uploadedById: user.sub!,
      fileBuffer: file.buffer,
      clinicId,
    };

    return this.documentsService.uploadDocument(input);
  }

  @Post()
  @Authenticated('patients.create')
  @ApiOperation({ summary: 'Create new patient' })
  async create(
    @Body() body: {
      name: string;
      dateOfBirth?: Date | string;
      gender?: string;
      phone?: string;
      alternatePhone?: string;
      email?: string;
      address?: Record<string, any>;
      emergencyContact?: Record<string, any>;
      clinicId?: string;
    },
    @CurrentUser() user: { sub?: string; clinicId?: string },
  ) {
    const { clinicId: _ignored, ...rest } = body;
    return this.patientsService.create({
      ...rest,
      createdBy: user.sub,
      clinicId: requireClinicId(user),
    });
  }

  @Patch(':id')
  @Authenticated('patients.edit')
  @ApiOperation({ summary: 'Update patient' })
  async update(
    @Param('id') id: string,
    @Body() body: {
      name?: string;
      dateOfBirth?: Date | string;
      gender?: string;
      phone?: string;
      alternatePhone?: string;
      email?: string;
      address?: Record<string, any>;
      emergencyContact?: Record<string, any>;
    },
    @CurrentUser() user: { sub?: string; clinicId?: string },
  ) {
    return this.patientsService.update(
      id,
      { ...body, updatedBy: user.sub },
      requireClinicId(user),
    );
  }

  @Delete(':id')
  @Authenticated('patients.delete')
  @ApiOperation({ summary: 'Delete patient (soft delete)' })
  async delete(@Param('id') id: string, @CurrentUser() user: { sub?: string; clinicId?: string }) {
    return this.patientsService.delete(id, user.sub!, requireClinicId(user));
  }
}
