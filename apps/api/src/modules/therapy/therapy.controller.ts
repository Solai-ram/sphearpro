import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery, ApiParam, ApiConsumes } from '@nestjs/swagger';
import { TherapyService } from './therapy.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Authenticated } from '../../common/decorators/auth.decorator';
import { requireClinicId } from '../../common/tenant/clinic-context';
import { multerAudioOptions } from '../../common/upload/multer-options';

@ApiTags('Therapy')
@ApiBearerAuth()
@Controller('therapy')
export class TherapyController {
  constructor(private therapyService: TherapyService) {}

  // ---------------------------------------------------------------------------
  // Types & catalog packages
  // ---------------------------------------------------------------------------

  @Get('types')
  @Authenticated('therapy.package.view')
  @ApiOperation({ summary: 'List therapy types' })
  async listTypes(@CurrentUser() user: { clinicId?: string }) {
    return this.therapyService.listTypes(requireClinicId(user));
  }

  @Post('types')
  @Authenticated('therapy.package.create')
  @ApiOperation({ summary: 'Create therapy type' })
  async createType(
    @Body() body: { name: string; description?: string; clinicId?: string },
    @CurrentUser() user: { sub?: string; clinicId?: string },
  ) {
    const { clinicId: _i, ...rest } = body;
    return this.therapyService.createType({ ...rest, clinicId: requireClinicId(user) }, user.sub);
  }

  @Get('packages')
  @Authenticated('therapy.package.view')
  @ApiOperation({ summary: 'List therapy package catalog' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'therapyTypeId', required: false, type: String })
  async listPackages(
    @CurrentUser() user: { clinicId?: string },
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('therapyTypeId') therapyTypeId?: string,
  ) {
    return this.therapyService.listPackages({
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 50,
      therapyTypeId,
      clinicId: requireClinicId(user),
    });
  }

  @Post('packages')
  @Authenticated('therapy.package.create')
  @ApiOperation({ summary: 'Create therapy package' })
  async createPackage(
    @Body() body: {
      therapyTypeId: string;
      name: string;
      totalSessions: number;
      frequency: 'WEEKLY' | 'TWICE_WEEKLY' | 'THREE_TIMES_WEEKLY' | 'DAILY' | 'EVERY_TWO_WEEKS' | 'MONTHLY' | 'CUSTOM';
      price: number;
      validityDays?: number;
      clinicId?: string;
    },
    @CurrentUser() user: { sub?: string; clinicId?: string },
  ) {
    return this.therapyService.createPackage({ ...body, clinicId: requireClinicId(user) }, user.sub);
  }

  @Get('packages/:id')
  @Authenticated('therapy.package.view')
  @ApiOperation({ summary: 'Get therapy package' })
  async getPackage(@Param('id') id: string, @CurrentUser() user: { clinicId?: string }) {
    return this.therapyService.getPackage(id, requireClinicId(user));
  }

  @Patch('packages/:id')
  @Authenticated('therapy.package.create')
  @ApiOperation({ summary: 'Update therapy package' })
  async updatePackage(
    @Param('id') id: string,
    @Body() body: {
      name?: string;
      totalSessions?: number;
      frequency?: 'WEEKLY' | 'TWICE_WEEKLY' | 'THREE_TIMES_WEEKLY' | 'DAILY' | 'EVERY_TWO_WEEKS' | 'MONTHLY' | 'CUSTOM';
      price?: number;
      validityDays?: number;
      isActive?: boolean;
    },
    @CurrentUser() user: { clinicId?: string },
  ) {
    return this.therapyService.updatePackage(id, requireClinicId(user), body);
  }

  // ---------------------------------------------------------------------------
  // Sessions
  // ---------------------------------------------------------------------------

  @Get('doctor/sessions')
  @Authenticated('therapy.session.view')
  @ApiOperation({ summary: 'List upcoming therapy sessions assigned to the logged-in doctor' })
  async listMyDoctorSessions(
    @CurrentUser() user: { sub?: string; clinicId?: string },
  ) {
    return this.therapyService.listMyDoctorSessions(user.sub!, requireClinicId(user));
  }

  @Get('doctor/sessions/:id')
  @Authenticated('therapy.session.view')
  @ApiOperation({ summary: 'Doctor workspace for one assigned session (current + prior notes)' })
  async getDoctorSessionWorkspace(
    @Param('id') id: string,
    @CurrentUser() user: { sub?: string; clinicId?: string },
  ) {
    return this.therapyService.getDoctorSessionWorkspace(id, user.sub!, requireClinicId(user));
  }

  @Post('doctor/sessions/:id/outcome')
  @Authenticated('therapy.attendance.mark')
  @ApiOperation({
    summary: 'Assigned doctor records session outcome (Completed requires SOAP note; Cancelled/Absent do not)',
  })
  async recordDoctorSessionOutcome(
    @Param('id') id: string,
    @Body() body: {
      outcome: 'COMPLETED' | 'CANCELLED' | 'ABSENT';
      subjective?: string;
      objective?: string;
      activities?: string;
      observations?: string;
      progress?: string;
      challenges?: string;
      nextPlan?: string;
      unitPrice?: number;
    },
    @CurrentUser() user: { sub?: string; clinicId?: string },
  ) {
    return this.therapyService.recordDoctorSessionOutcome(id, requireClinicId(user), {
      ...body,
      createdBy: user.sub,
    });
  }

  @Get('sessions')
  @Authenticated('therapy.session.view')
  @ApiOperation({ summary: 'List therapy sessions' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'therapyCaseId', required: false, type: String })
  @ApiQuery({ name: 'therapistId', required: false, type: String })
  @ApiQuery({ name: 'doctorId', required: false, type: String })
  @ApiQuery({ name: 'status', required: false, type: String })
  @ApiQuery({ name: 'startDate', required: false, type: String })
  @ApiQuery({ name: 'endDate', required: false, type: String })
  @ApiQuery({ name: 'search', required: false, type: String })
  async findAllSessions(
    @CurrentUser() user: { clinicId?: string },
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('therapyCaseId') therapyCaseId?: string,
    @Query('therapistId') therapistId?: string,
    @Query('doctorId') doctorId?: string,
    @Query('status') status?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('search') search?: string,
  ) {
    return this.therapyService.findAllSessions({
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 20,
      therapyCaseId,
      therapistId,
      doctorId,
      status,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      search,
      clinicId: requireClinicId(user),
    });
  }

  @Patch('sessions/:id/assign')
  @Post('sessions/:id/assign')
  @Authenticated('therapy.session.create')
  @ApiOperation({ summary: 'Assign a doctor to a therapy session (optional slot time)' })
  async assignSession(
    @Param('id') id: string,
    @Body() body: { doctorId?: string; therapistId?: string; scheduledAt?: string },
    @CurrentUser() user: { sub?: string; clinicId?: string },
  ) {
    const doctorId = body.doctorId || body.therapistId;
    if (!doctorId) throw new BadRequestException('doctorId is required');
    return this.therapyService.assignSession(id, requireClinicId(user), {
      doctorId,
      scheduledAt: body.scheduledAt,
      createdBy: user.sub,
    });
  }

  @Get('sessions/:id')
  @Authenticated('therapy.session.view')
  @ApiOperation({ summary: 'Get therapy session' })
  async findSessionById(
    @Param('id') id: string,
    @CurrentUser() user: { clinicId?: string },
  ) {
    return this.therapyService.findSessionById(id, requireClinicId(user));
  }

  @Patch('sessions/:id/reschedule')
  @Authenticated('therapy.session.reschedule')
  @ApiOperation({ summary: 'Reschedule therapy session' })
  async rescheduleSession(
    @Param('id') id: string,
    @Body() body: { scheduledAt: string; note?: string },
    @CurrentUser() user: { sub?: string; clinicId?: string },
  ) {
    return this.therapyService.rescheduleSession(id, requireClinicId(user), {
      ...body,
      createdBy: user.sub,
    });
  }

  @Patch('sessions/:id/attendance')
  @Authenticated('therapy.attendance.mark')
  @ApiOperation({ summary: 'Mark session attendance' })
  async markAttendance(
    @Param('id') id: string,
    @Body() body: {
      status: 'PRESENT' | 'ABSENT' | 'CANCELLED' | 'RESCHEDULED' | 'LATE';
      unitPrice?: number;
    },
    @CurrentUser() user: { sub?: string; clinicId?: string },
  ) {
    return this.therapyService.markAttendance(id, requireClinicId(user), {
      ...body,
      createdBy: user.sub,
    });
  }

  @Get('sessions/:id/notes')
  @Authenticated('therapy.note.create')
  @ApiOperation({ summary: 'List notes for a session' })
  async getSessionNotes(
    @Param('id') id: string,
    @CurrentUser() user: { clinicId?: string },
  ) {
    const session = await this.therapyService.findSessionById(id, requireClinicId(user));
    return session.notes;
  }

  @Post('sessions/:id/notes')
  @Authenticated('therapy.note.create')
  @ApiOperation({ summary: 'Add SOAP therapy note' })
  async addNote(
    @Param('id') id: string,
    @Body() body: {
      therapistId?: string;
      subjective?: string;
      objective?: string;
      activities?: string;
      observations?: string;
      progress?: string;
      challenges?: string;
      nextPlan?: string;
      isAiDraft?: boolean;
    },
    @CurrentUser() user: { sub?: string; clinicId?: string },
  ) {
    return this.therapyService.addNote(id, requireClinicId(user), {
      ...body,
      createdBy: user.sub,
    });
  }

  @Post('sessions/:id/voice-note')
  @Authenticated('ai.transcribe')
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Transcribe a voice note with ElevenLabs and save as an AI draft SOAP note' })
  @UseInterceptors(FileInterceptor('file', multerAudioOptions()))
  async addVoiceNote(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
    @Query('languageCode') languageCode: string | undefined,
    @CurrentUser() user: { sub?: string; clinicId?: string },
  ) {
    if (!file) throw new BadRequestException('Audio file is required');
    return this.therapyService.addVoiceNote(id, requireClinicId(user), {
      buffer: file.buffer,
      mimeType: file.mimetype,
      fileName: file.originalname,
      languageCode,
      createdBy: user.sub,
    });
  }

  @Patch('notes/:id')
  @Authenticated('therapy.note.edit')
  @ApiOperation({ summary: 'Update or approve a therapy note' })
  async updateNote(
    @Param('id') id: string,
    @Body() body: {
      subjective?: string;
      objective?: string;
      activities?: string;
      observations?: string;
      progress?: string;
      challenges?: string;
      nextPlan?: string;
      aiReviewed?: boolean;
    },
    @CurrentUser('sub') userId: string,
  ) {
    return this.therapyService.updateNote(id, { ...body, updatedBy: userId });
  }

  @Post('summaries/:id/review')
  @Authenticated('ai.review')
  @ApiOperation({ summary: 'Approve or reject an AI therapy summary' })
  async reviewSummary(
    @Param('id') id: string,
    @Body() body: { approved: boolean },
    @CurrentUser('sub') userId: string,
  ) {
    return this.therapyService.reviewSummary(id, { approved: body.approved, reviewedBy: userId });
  }

  // ---------------------------------------------------------------------------
  // Patient-scoped
  // ---------------------------------------------------------------------------

  @Get('patients/:patientId/packages')
  @Authenticated('therapy.package.view')
  @ApiOperation({ summary: 'List packages assigned to a patient' })
  async listPatientPackages(
    @Param('patientId') patientId: string,
    @CurrentUser() user: { clinicId?: string },
  ) {
    return this.therapyService.listPatientPackages(patientId, requireClinicId(user));
  }

  @Get('patients/:patientId/cases')
  @Authenticated('therapy.case.view')
  @ApiOperation({ summary: 'List therapy cases for a patient' })
  async findCasesByPatient(
    @Param('patientId') patientId: string,
    @CurrentUser() user: { clinicId?: string },
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.therapyService.findAllCases({
      patientId,
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 20,
      clinicId: requireClinicId(user),
    });
  }

  // ---------------------------------------------------------------------------
  // Cases
  // ---------------------------------------------------------------------------

  @Get('cases')
  @Authenticated('therapy.case.view')
  @ApiOperation({ summary: 'List therapy cases' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({ name: 'therapistId', required: false, type: String })
  @ApiQuery({ name: 'doctorId', required: false, type: String })
  @ApiQuery({ name: 'status', required: false, type: String })
  async findAllCases(
    @CurrentUser() user: { sub?: string; clinicId?: string },
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('search') search?: string,
    @Query('therapistId') therapistId?: string,
    @Query('doctorId') doctorId?: string,
    @Query('status') status?: string,
  ) {
    return this.therapyService.findAllCases({
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 20,
      search,
      therapistId,
      doctorId,
      status,
      requestingUserId: user.sub,
      clinicId: requireClinicId(user),
    });
  }

  @Post('cases')
  @Authenticated('therapy.case.create')
  @ApiOperation({ summary: 'Create therapy case from an existing OP patient' })
  async createCase(
    @Body() body: {
      patientId: string;
      therapistId: string;
      title: string;
      assessment?: string;
      goals?: unknown;
      opCaseId?: string;
    },
    @CurrentUser() user: { sub?: string; clinicId?: string },
  ) {
    return this.therapyService.createCase({
      ...body,
      createdBy: user.sub,
      clinicId: requireClinicId(user),
    });
  }

  @Get('cases/:id')
  @Authenticated('therapy.case.view')
  @ApiOperation({ summary: 'Get therapy case' })
  @ApiParam({ name: 'id', description: 'Therapy Case ID' })
  async findCaseById(
    @Param('id') id: string,
    @CurrentUser() user: { clinicId?: string },
  ) {
    return this.therapyService.findCaseById(id, requireClinicId(user));
  }

  @Patch('cases/:id')
  @Authenticated('therapy.case.create')
  @ApiOperation({ summary: 'Update therapy case' })
  async updateCase(
    @Param('id') id: string,
    @Body() body: {
      title?: string;
      assessment?: string;
      goals?: unknown;
      status?: 'ACTIVE' | 'COMPLETED' | 'DISCONTINUED';
    },
    @CurrentUser() user: { sub?: string; clinicId?: string },
  ) {
    return this.therapyService.updateCase(id, requireClinicId(user), {
      ...body,
      updatedBy: user.sub,
    });
  }

  @Post('cases/:id/packages')
  @Authenticated('therapy.package.assign')
  @ApiOperation({ summary: 'Assign catalog package and generate sessions' })
  async assignPackage(
    @Param('id') id: string,
    @Body() body: { packageId: string; startDate?: string },
    @CurrentUser() user: { sub?: string; clinicId?: string },
  ) {
    return this.therapyService.assignPackage(id, requireClinicId(user), {
      ...body,
      createdBy: user.sub,
    });
  }

  @Post('cases/:id/sessions/manual')
  @Authenticated('therapy.session.create')
  @ApiOperation({ summary: 'Add one therapy session slot for a case (appointments assign flow)' })
  async createManualSession(
    @Param('id') id: string,
    @Body() body: { scheduledAt: string; doctorId?: string; patientPackageId?: string },
    @CurrentUser() user: { sub?: string; clinicId?: string },
  ) {
    return this.therapyService.createManualSession(id, requireClinicId(user), {
      ...body,
      createdBy: user.sub,
    });
  }

  @Post('cases/:id/sessions')
  @Authenticated('therapy.session.create')
  @ApiOperation({ summary: 'Generate sessions for a case' })
  async generateSessions(
    @Param('id') id: string,
    @Body() body: {
      patientPackageId?: string;
      totalSessions?: number;
      frequency?: 'WEEKLY' | 'TWICE_WEEKLY' | 'THREE_TIMES_WEEKLY' | 'DAILY' | 'EVERY_TWO_WEEKS' | 'MONTHLY' | 'CUSTOM';
      startDate?: string;
      therapistId?: string;
    },
    @CurrentUser() user: { sub?: string; clinicId?: string },
  ) {
    return this.therapyService.generateSessionsForCase(id, requireClinicId(user), {
      ...body,
      createdBy: user.sub,
    });
  }

  @Get('cases/:id/progress')
  @Authenticated('therapy.progress.record')
  @ApiOperation({ summary: 'List progress records' })
  async listProgress(
    @Param('id') id: string,
    @CurrentUser() user: { clinicId?: string },
  ) {
    return this.therapyService.listProgress(id, requireClinicId(user));
  }

  @Post('cases/:id/progress')
  @Authenticated('therapy.progress.record')
  @ApiOperation({ summary: 'Record therapy progress metric' })
  async addProgress(
    @Param('id') id: string,
    @Body() body: { metric: string; value?: number; note?: string },
    @CurrentUser('sub') userId: string,
  ) {
    return this.therapyService.addProgress(id, { ...body, createdBy: userId });
  }

  @Get('cases/:id/summary')
  @Authenticated('therapy.case.view')
  @ApiOperation({ summary: 'List AI summaries for a case' })
  async listSummaries(
    @Param('id') id: string,
    @CurrentUser() user: { clinicId?: string },
  ) {
    const therapyCase = await this.therapyService.findCaseById(id, requireClinicId(user));
    return therapyCase.aiSummaries;
  }

  @Post('cases/:id/summary')
  @Authenticated('ai.summary.generate')
  @ApiOperation({ summary: 'Generate AI therapy summary draft (requires human review)' })
  async generateSummary(
    @Param('id') id: string,
    @CurrentUser() user: { sub?: string; clinicId?: string },
  ) {
    return this.therapyService.generateSummary(id, requireClinicId(user), user.sub);
  }
}
