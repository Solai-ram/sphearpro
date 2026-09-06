import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery, ApiParam } from '@nestjs/swagger';
import { ClinicalService } from './clinical.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Authenticated } from '../../common/decorators/auth.decorator';
import { requireClinicId } from '../../common/tenant/clinic-context';

@ApiTags('Clinical')
@ApiBearerAuth()
@Controller('clinical')
export class ClinicalController {
  constructor(private clinicalService: ClinicalService) {}

  // ---------------------------------------------------------------------------
  // OP CASE
  // ---------------------------------------------------------------------------

  @Get()
  @Authenticated('clinical.op.view')
  @ApiOperation({ summary: 'List all OP cases' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({ name: 'providerId', required: false, type: String })
  @ApiQuery({ name: 'status', required: false, type: String })
  @ApiQuery({ name: 'startDate', required: false, type: String })
  @ApiQuery({ name: 'endDate', required: false, type: String })
  async findAll(
    @CurrentUser() user: { clinicId?: string },
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('search') search?: string,
    @Query('providerId') providerId?: string,
    @Query('status') status?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.clinicalService.findAll({
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 20,
      search,
      providerId,
      status,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      clinicId: requireClinicId(user),
    });
  }

  @Get('patient/:patientId')
  @Authenticated('clinical.op.view')
  @ApiOperation({ summary: 'List OP cases for a patient' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'status', required: false, type: String })
  async findByPatient(
    @Param('patientId') patientId: string,
    @CurrentUser() user: { clinicId?: string },
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('status') status?: string,
  ) {
    return this.clinicalService.findByPatient(patientId, {
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 20,
      status,
      clinicId: requireClinicId(user),
    });
  }

  @Get('icd10/search')
  @Authenticated('clinical.diagnosis.create')
  @ApiOperation({ summary: 'Search ICD-10 codes' })
  @ApiQuery({ name: 'q', required: true, type: String })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async searchIcd10(@Query('q') q: string, @Query('limit') limit?: number) {
    return this.clinicalService.searchIcd10(q, limit ? Number(limit) : 20);
  }

  @Get(':id')
  @Authenticated('clinical.op.view')
  @ApiOperation({ summary: 'Get OP case by ID' })
  @ApiParam({ name: 'id', description: 'OP Case ID' })
  async findById(@Param('id') id: string, @CurrentUser() user: { clinicId?: string }) {
    return this.clinicalService.findById(id, requireClinicId(user));
  }

  @Post()
  @Authenticated('clinical.op.create')
  @ApiOperation({ summary: 'Create new OP case' })
  async create(
    @Body() body: {
      patientId: string;
      providerId?: string;
      appointmentId?: string;
      chiefComplaint?: string;
      vitals?: Record<string, any>;
      consultationFee?: number;
      paymentMethod?: 'CASH' | 'CARD' | 'UPI' | 'NET_BANKING' | 'WALLET' | 'OTHER';
      paymentReference?: string;
    },
    @CurrentUser() user: { sub?: string; clinicId?: string },
  ) {
    return this.clinicalService.createOpCase({ ...body, createdBy: user.sub, clinicId: requireClinicId(user) });
  }

  @Post('review')
  @Authenticated('clinical.op.create')
  @ApiOperation({ summary: 'Register a returning OP visit for a previously registered OP patient' })
  async createReview(
    @Body() body: {
      patientId: string;
      providerId?: string;
      chiefComplaint?: string;
      vitals?: Record<string, any>;
      consultationFee?: number;
      paymentMethod?: 'CASH' | 'CARD' | 'UPI' | 'NET_BANKING' | 'WALLET' | 'OTHER';
      paymentReference?: string;
    },
    @CurrentUser() user: { sub?: string; clinicId?: string },
  ) {
    return this.clinicalService.createOpReview({ ...body, createdBy: user.sub, clinicId: requireClinicId(user) });
  }

  @Patch(':id')
  @Authenticated('clinical.op.create')
  @ApiOperation({ summary: 'Update OP case' })
  async update(
    @Param('id') id: string,
    @Body() body: {
      chiefComplaint?: string;
      vitals?: Record<string, any>;
      status?: 'OPEN' | 'CLOSED';
    },
    @CurrentUser() user: { sub?: string; clinicId?: string },
  ) {
    return this.clinicalService.updateOpCase(id, requireClinicId(user), {
      ...body,
      updatedBy: user.sub,
    });
  }

  @Post(':id/invoice')
  @Authenticated('billing.invoice.create')
  @ApiOperation({ summary: 'Create a billing invoice for this OP consultation' })
  async invoiceOpCase(
    @Param('id') id: string,
    @Body() body: {
      unitPrice?: number;
      paymentMethod?: 'CASH' | 'CARD' | 'UPI' | 'NET_BANKING' | 'WALLET' | 'OTHER';
      paymentReference?: string;
    },
    @CurrentUser() user: { sub?: string; clinicId?: string },
  ) {
    return this.clinicalService.invoiceOpCase(id, requireClinicId(user), {
      ...body,
      createdBy: user.sub,
    });
  }

  // ---------------------------------------------------------------------------
  // OP VISIT
  // ---------------------------------------------------------------------------

  @Post(':id/visits')
  @Authenticated('clinical.op.create')
  @ApiOperation({ summary: 'Add visit to OP case' })
  @ApiParam({ name: 'id', description: 'OP Case ID' })
  async addVisit(
    @Param('id') id: string,
    @Body() body: {
      visitedAt?: string;
      notes?: string;
    },
    @CurrentUser() user: { clinicId?: string },
  ) {
    return this.clinicalService.addVisit(id, requireClinicId(user), body);
  }

  // ---------------------------------------------------------------------------
  // DIAGNOSIS
  // ---------------------------------------------------------------------------

  @Post(':id/diagnoses')
  @Authenticated('clinical.diagnosis.create')
  @ApiOperation({ summary: 'Add diagnosis to OP case' })
  @ApiParam({ name: 'id', description: 'OP Case ID' })
  async addDiagnosis(
    @Param('id') id: string,
    @Body() body: {
      code?: string;
      description: string;
      type?: 'PRIMARY' | 'SECONDARY';
    },
    @CurrentUser() user: { clinicId?: string },
  ) {
    return this.clinicalService.addDiagnosis(id, requireClinicId(user), body);
  }

  @Patch('diagnoses/:diagnosisId')
  @Authenticated('clinical.diagnosis.create')
  @ApiOperation({ summary: 'Update diagnosis' })
  async updateDiagnosis(
    @Param('diagnosisId') diagnosisId: string,
    @Body() body: {
      code?: string;
      description?: string;
      type?: 'PRIMARY' | 'SECONDARY';
    },
    @CurrentUser() user: { clinicId?: string },
  ) {
    return this.clinicalService.updateDiagnosis(diagnosisId, requireClinicId(user), body);
  }

  @Delete('diagnoses/:diagnosisId')
  @Authenticated('clinical.diagnosis.create')
  @ApiOperation({ summary: 'Delete diagnosis' })
  async deleteDiagnosis(
    @Param('diagnosisId') diagnosisId: string,
    @CurrentUser() user: { clinicId?: string },
  ) {
    return this.clinicalService.deleteDiagnosis(diagnosisId, requireClinicId(user));
  }

  // ---------------------------------------------------------------------------
  // CLINICAL NOTE
  // ---------------------------------------------------------------------------

  @Post(':id/notes')
  @Authenticated('clinical.op.create')
  @ApiOperation({ summary: 'Add clinical note to OP case' })
  @ApiParam({ name: 'id', description: 'OP Case ID' })
  async addClinicalNote(
    @Param('id') id: string,
    @Body() body: { content: string },
    @CurrentUser() user: { sub?: string; clinicId?: string },
  ) {
    return this.clinicalService.addClinicalNote(id, requireClinicId(user), {
      content: body.content,
      createdBy: user.sub,
    });
  }

  // ---------------------------------------------------------------------------
  // PRESCRIPTION
  // ---------------------------------------------------------------------------

  @Post(':id/prescriptions')
  @Authenticated('clinical.prescription.create')
  @ApiOperation({ summary: 'Add prescription to OP case' })
  @ApiParam({ name: 'id', description: 'OP Case ID' })
  async addPrescription(
    @Param('id') id: string,
    @Body() body: {
      notes?: string;
      items: {
        drugName: string;
        dosage?: string;
        frequency?: string;
        duration?: string;
        instructions?: string;
      }[];
    },
    @CurrentUser() user: { sub?: string; clinicId?: string },
  ) {
    return this.clinicalService.addPrescription(id, requireClinicId(user), {
      ...body,
      createdBy: user.sub,
    });
  }

  @Get('prescriptions/:prescriptionId')
  @Authenticated('clinical.op.view')
  @ApiOperation({ summary: 'Get prescription by ID' })
  async getPrescription(
    @Param('prescriptionId') prescriptionId: string,
    @CurrentUser() user: { clinicId?: string },
  ) {
    return this.clinicalService.getPrescription(prescriptionId, requireClinicId(user));
  }

  // ---------------------------------------------------------------------------
  // FOLLOW-UP
  // ---------------------------------------------------------------------------

  @Post(':id/followups')
  @Authenticated('clinical.followup.create')
  @ApiOperation({ summary: 'Add follow-up to OP case' })
  @ApiParam({ name: 'id', description: 'OP Case ID' })
  async addFollowUp(
    @Param('id') id: string,
    @Body() body: {
      dueDate: string;
      reason?: string;
    },
    @CurrentUser() user: { clinicId?: string },
  ) {
    return this.clinicalService.addFollowUp(id, requireClinicId(user), body);
  }

  @Patch('followups/:followUpId')
  @Authenticated('clinical.followup.create')
  @ApiOperation({ summary: 'Update follow-up' })
  async updateFollowUp(
    @Param('followUpId') followUpId: string,
    @Body() body: {
      dueDate?: string;
      reason?: string;
      status?: 'PENDING' | 'COMPLETED' | 'CANCELLED';
    },
    @CurrentUser() user: { clinicId?: string },
  ) {
    return this.clinicalService.updateFollowUp(followUpId, requireClinicId(user), body);
  }
}