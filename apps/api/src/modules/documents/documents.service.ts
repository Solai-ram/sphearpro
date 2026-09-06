import { Injectable, NotFoundException, Inject } from '@nestjs/common';
import { Prisma, DocCategory } from '@prisma/client';
import { S3Client, PutObjectCommand, GetObjectCommand, CreateBucketCommand, HeadBucketCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { sanitizeDownloadFilename } from '../../common/upload/multer-options';

export interface UploadDocumentInput {
  patientId: string;
  category: DocCategory;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  uploadedById?: string;
  fileBuffer: Buffer;
  clinicId: string;
}

export interface DocumentListParams {
  page?: number;
  limit?: number;
  category?: DocCategory;
  patientId?: string;
  search?: string;
  clinicId: string;
}

@Injectable()
export class DocumentsService {
  private s3Client: S3Client;
  private bucket: string;

  constructor(@Inject('PRISMA_CLIENT') private prisma: any) {
    const accessKey = process.env.S3_ACCESS_KEY;
    const secretKey = process.env.S3_SECRET_KEY;
    if (process.env.NODE_ENV === 'production' && (!accessKey || !secretKey)) {
      throw new Error('S3_ACCESS_KEY and S3_SECRET_KEY are required in production');
    }
    this.s3Client = new S3Client({
      region: process.env.S3_REGION || 'us-east-1',
      endpoint: process.env.S3_ENDPOINT || 'http://localhost:9000',
      credentials: {
        accessKeyId: accessKey || 'minioadmin',
        secretAccessKey: secretKey || 'minioadmin123',
      },
      forcePathStyle: true,
    });
    this.bucket = process.env.S3_BUCKET || 'hislite-documents';
  }

  private async ensureBucket() {
    try {
      await this.s3Client.send(new HeadBucketCommand({ Bucket: this.bucket }));
    } catch {
      await this.s3Client.send(new CreateBucketCommand({ Bucket: this.bucket }));
    }
  }

  async uploadDocument(input: UploadDocumentInput) {
    const patient = await this.prisma.patient.findFirst({
      where: { id: input.patientId, clinicId: input.clinicId, deletedAt: null },
    });
    if (!patient) {
      throw new NotFoundException('Patient not found');
    }

    const timestamp = Date.now();
    const sanitizedFileName = input.fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
    const s3Key = `patients/${input.patientId}/${timestamp}-${sanitizedFileName}`;

    await this.ensureBucket();

    await this.s3Client.send(new PutObjectCommand({
      Bucket: this.bucket,
      Key: s3Key,
      Body: input.fileBuffer,
      ContentType: input.mimeType,
    }));

    const document = await this.prisma.patientDocument.create({
      data: {
        clinicId: input.clinicId,
        patientId: input.patientId,
        category: input.category,
        fileName: input.fileName,
        s3Key,
        mimeType: input.mimeType,
        sizeBytes: input.sizeBytes,
        uploadedById: input.uploadedById,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        clinicId: input.clinicId,
        actorId: input.uploadedById,
        actorType: 'user',
        action: 'DOCUMENT_UPLOADED',
        entityType: 'patient_document',
        entityId: document.id,
        patientId: input.patientId,
        result: 'SUCCESS',
        metadata: {
          fileName: input.fileName,
          category: input.category,
          sizeBytes: input.sizeBytes,
          mimeType: input.mimeType,
        },
      },
    });

    return document;
  }

  async findAll(params: DocumentListParams) {
    const { page = 1, limit = 20, category, patientId, search, clinicId } = params;
    const skip = (page - 1) * limit;

    const where: Prisma.PatientDocumentWhereInput = { isDeleted: false, clinicId };
    if (category) where.category = category;
    if (patientId) where.patientId = patientId;
    if (search) {
      where.OR = [
        { fileName: { contains: search, mode: 'insensitive' } },
        { patient: { name: { contains: search, mode: 'insensitive' } } },
        { patient: { patientNumber: { contains: search, mode: 'insensitive' } } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.patientDocument.findMany({
        where,
        skip,
        take: limit,
        orderBy: { uploadedAt: 'desc' },
        include: {
          patient: { select: { id: true, name: true, patientNumber: true } },
          uploadedBy: { select: { id: true, name: true } },
        },
      }),
      this.prisma.patientDocument.count({ where }),
    ]);

    return {
      data,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async findAllByPatient(patientId: string, params: DocumentListParams) {
    const { page = 1, limit = 20, category, clinicId } = params;
    const skip = (page - 1) * limit;

    const patient = await this.prisma.patient.findFirst({
      where: { id: patientId, clinicId, deletedAt: null },
    });
    if (!patient) throw new NotFoundException('Patient not found');

    const where: Prisma.PatientDocumentWhereInput = {
      patientId,
      clinicId,
      isDeleted: false,
    };

    if (category) {
      where.category = category;
    }

    const [data, total] = await Promise.all([
      this.prisma.patientDocument.findMany({
        where,
        skip,
        take: limit,
        orderBy: { uploadedAt: 'desc' },
        include: {
          uploadedBy: { select: { id: true, name: true } },
        },
      }),
      this.prisma.patientDocument.count({ where }),
    ]);

    return {
      data,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async findById(id: string, clinicId: string) {
    const document = await this.prisma.patientDocument.findFirst({
      where: { id, clinicId },
      include: {
        patient: { select: { id: true, name: true, patientNumber: true } },
        uploadedBy: { select: { id: true, name: true } },
      },
    });

    if (!document || document.isDeleted) {
      throw new NotFoundException('Document not found');
    }

    return document;
  }

  async getDownloadUrl(id: string, clinicId: string, userId?: string) {
    const document = await this.findById(id, clinicId);

    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: document.s3Key,
      ResponseContentDisposition: `attachment; filename="${sanitizeDownloadFilename(document.fileName)}"`,
    });

    const url = await getSignedUrl(this.s3Client, command, { expiresIn: 3600 });

    await this.prisma.documentAccessLog.create({
      data: {
        documentId: id,
        accessedById: userId,
        action: 'DOWNLOAD',
      },
    });

    await this.prisma.auditLog.create({
      data: {
        clinicId,
        actorId: userId,
        actorType: 'user',
        action: 'DOCUMENT_DOWNLOADED',
        entityType: 'patient_document',
        entityId: id,
        patientId: document.patientId,
        result: 'SUCCESS',
        metadata: { fileName: document.fileName },
      },
    });

    return { url, fileName: document.fileName, mimeType: document.mimeType };
  }

  async deleteDocument(id: string, clinicId: string, userId?: string) {
    const document = await this.findById(id, clinicId);

    await this.prisma.patientDocument.update({
      where: { id },
      data: { isDeleted: true },
    });

    await this.prisma.auditLog.create({
      data: {
        clinicId,
        actorId: userId,
        actorType: 'user',
        action: 'DOCUMENT_DELETED',
        entityType: 'patient_document',
        entityId: id,
        patientId: document.patientId,
        result: 'SUCCESS',
        metadata: { fileName: document.fileName },
      },
    });

    return { success: true };
  }

  async getAccessLogs(id: string, clinicId: string) {
    await this.findById(id, clinicId);
    return this.prisma.documentAccessLog.findMany({
      where: { documentId: id },
      orderBy: { accessedAt: 'desc' },
      take: 50,
      include: { accessor: { select: { id: true, name: true } } },
    });
  }

  async getCategories() {
    return Object.values(DocCategory).map(category => ({
      value: category,
      label: category.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase()),
    }));
  }
}
