import {
  Controller,
  Post,
  Get,
  Delete,
  Param,
  Query,
  Body,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiConsumes, ApiQuery, ApiParam } from '@nestjs/swagger';
import { DocumentsService, UploadDocumentInput } from './documents.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Authenticated } from '../../common/decorators/auth.decorator';
import { DocCategory } from '@prisma/client';
import { multerDocumentOptions } from '../../common/upload/multer-options';
import { requireClinicId } from '../../common/tenant/clinic-context';

@ApiTags('Documents')
@ApiBearerAuth()
@Controller('documents')
export class DocumentsController {
  constructor(private documentsService: DocumentsService) {}

  @Get()
  @Authenticated('documents.view')
  @ApiOperation({ summary: 'List clinic documents' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'category', required: false, type: String })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({ name: 'patientId', required: false, type: String })
  findAll(
    @CurrentUser() user: { clinicId?: string },
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('category') category?: string,
    @Query('search') search?: string,
    @Query('patientId') patientId?: string,
  ) {
    return this.documentsService.findAll({
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 20,
      category: category as DocCategory | undefined,
      search,
      patientId,
      clinicId: requireClinicId(user),
    });
  }

  @Get('categories')
  @Authenticated('documents.view')
  @ApiOperation({ summary: 'Get available document categories' })
  getCategories() {
    return this.documentsService.getCategories();
  }

  @Post('patients/:patientId')
  @Authenticated('documents.upload')
  @ApiOperation({ summary: 'Upload a document for a patient' })
  @ApiConsumes('multipart/form-data')
  @ApiParam({ name: 'patientId', description: 'Patient ID' })
  @UseInterceptors(FileInterceptor('file', multerDocumentOptions()))
  async uploadDocument(
    @Param('patientId') patientId: string,
    @UploadedFile() file: Express.Multer.File,
    @Query('category') categoryQuery: string,
    @Body() body: { category?: string },
    @CurrentUser() user: { sub?: string; clinicId?: string },
  ) {
    if (!file) throw new BadRequestException('No file provided');
    const category = body?.category || categoryQuery;
    if (!category) throw new BadRequestException('Category is required');

    const input: UploadDocumentInput = {
      patientId,
      category: category as DocCategory,
      fileName: file.originalname,
      mimeType: file.mimetype,
      sizeBytes: file.size,
      uploadedById: user.sub,
      fileBuffer: file.buffer,
      clinicId: requireClinicId(user),
    };

    return this.documentsService.uploadDocument(input);
  }

  @Get('patients/:patientId')
  @Authenticated('documents.view')
  @ApiOperation({ summary: 'List documents for a patient' })
  @ApiParam({ name: 'patientId', description: 'Patient ID' })
  findAllByPatient(
    @Param('patientId') patientId: string,
    @CurrentUser() user: { clinicId?: string },
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('category') category?: string,
  ) {
    return this.documentsService.findAllByPatient(patientId, {
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 20,
      category: category as DocCategory | undefined,
      clinicId: requireClinicId(user),
    });
  }

  @Get(':id/download')
  @Authenticated('documents.download')
  @ApiOperation({ summary: 'Get presigned download URL for a document' })
  @ApiParam({ name: 'id', description: 'Document ID' })
  getDownloadUrl(
    @Param('id') id: string,
    @CurrentUser() user: { sub?: string; clinicId?: string },
  ) {
    return this.documentsService.getDownloadUrl(id, requireClinicId(user), user.sub);
  }

  @Get(':id/access-logs')
  @Authenticated('documents.view')
  @ApiOperation({ summary: 'List document access logs' })
  getAccessLogs(@Param('id') id: string, @CurrentUser() user: { clinicId?: string }) {
    return this.documentsService.getAccessLogs(id, requireClinicId(user));
  }

  @Get(':id')
  @Authenticated('documents.view')
  @ApiOperation({ summary: 'Get document metadata by ID' })
  @ApiParam({ name: 'id', description: 'Document ID' })
  findById(@Param('id') id: string, @CurrentUser() user: { clinicId?: string }) {
    return this.documentsService.findById(id, requireClinicId(user));
  }

  @Delete(':id')
  @Authenticated('documents.delete')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Soft delete a document' })
  @ApiParam({ name: 'id', description: 'Document ID' })
  deleteDocument(
    @Param('id') id: string,
    @CurrentUser() user: { sub?: string; clinicId?: string },
  ) {
    return this.documentsService.deleteDocument(id, requireClinicId(user), user.sub);
  }
}
