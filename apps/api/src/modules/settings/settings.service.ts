import { Injectable, Inject, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  CreateBucketCommand,
  HeadBucketCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { AuditService } from '../audit/audit.service';
import { DEFAULT_CLINIC_ID } from '../../common/tenant/clinic-context';

const DEFAULT_SETTINGS: Array<{ key: string; group: string; value: unknown }> = [
  { key: 'clinic.name', group: 'clinic', value: '' },
  { key: 'clinic.address', group: 'clinic', value: '' },
  { key: 'clinic.phone', group: 'clinic', value: '' },
  { key: 'clinic.email', group: 'clinic', value: '' },
  { key: 'clinic.gstin', group: 'clinic', value: '' },
  { key: 'clinic.state', group: 'clinic', value: '' },
  { key: 'clinic.logoText', group: 'clinic', value: '' },
  { key: 'clinic.logoS3Key', group: 'clinic', value: '' },
  { key: 'clinic.logoMimeType', group: 'clinic', value: '' },
  { key: 'clinic.logoFileName', group: 'clinic', value: '' },
  /** New clinics set this to false at signup; existing clinics default true so they are not forced through setup. */
  { key: 'clinic.setupComplete', group: 'clinic', value: true },
  { key: 'invoice.title', group: 'invoice', value: 'Tax Invoice' },
  {
    key: 'invoice.terms',
    group: 'invoice',
    value:
      'Exempted from Sales Tax.\nReceived the above goods in sound condition & correct quantity.\nGoods once sold cannot be taken back.',
  },
  { key: 'billing.defaultTaxRate', group: 'billing', value: 0 },
  { key: 'billing.currency', group: 'billing', value: 'INR' },
  { key: 'billing.invoicePrefix', group: 'billing', value: 'INV' },
  { key: 'billing.invoiceIncludeYear', group: 'billing', value: true },
  { key: 'billing.invoiceSeparator', group: 'billing', value: '-' },
  { key: 'billing.invoiceDigits', group: 'billing', value: 6 },
  { key: 'patient.idPrefix', group: 'patient', value: 'P' },
  { key: 'patient.idIncludeYear', group: 'patient', value: false },
  { key: 'patient.idSeparator', group: 'patient', value: '' },
  { key: 'patient.idDigits', group: 'patient', value: 6 },
  { key: 'patient.idLabel', group: 'patient', value: 'UHID' },
  { key: 'receipt.opTitle', group: 'receipt', value: 'OP Registration Receipt' },
  { key: 'receipt.reviewTitle', group: 'receipt', value: 'OP Review Receipt' },
  { key: 'ui.theme', group: 'ui', value: 'clinical-blue' },
];

function settingString(value: unknown) {
  if (value == null) return '';
  if (typeof value === 'string') return value.replace(/^"|"$/g, '');
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return '';
}

@Injectable()
export class SettingsService {
  private readonly logger = new Logger(SettingsService.name);
  private s3Client: S3Client;
  private bucket: string;

  constructor(
    @Inject('PRISMA_CLIENT') private prisma: PrismaClient,
    private audit: AuditService,
  ) {
    const accessKey = process.env.S3_ACCESS_KEY;
    const secretKey = process.env.S3_SECRET_KEY;
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

  private async readSettingValue(clinicId: string, key: string) {
    const row = await this.prisma.setting.findUnique({
      where: { clinicId_key: { clinicId, key } },
    });
    return settingString(row?.value);
  }

  async ensureDefaults(clinicId: string) {
    for (const item of DEFAULT_SETTINGS) {
      await this.prisma.setting.upsert({
        where: { clinicId_key: { clinicId, key: item.key } },
        update: {},
        create: {
          clinicId,
          key: item.key,
          group: item.group,
          value: item.value as Prisma.InputJsonValue,
        },
      });
    }
  }

  async findAll(clinicId: string, group?: string) {
    await this.ensureDefaults(clinicId);
    return this.prisma.setting.findMany({
      where: { clinicId, ...(group ? { group } : {}) },
      orderBy: [{ group: 'asc' }, { key: 'asc' }],
    });
  }

  async getAppearance(clinicId: string = DEFAULT_CLINIC_ID) {
    await this.ensureDefaults(clinicId);
    const keys = ['ui.theme', 'clinic.name', 'clinic.logoText'];
    const rows = await this.prisma.setting.findMany({
      where: { clinicId, key: { in: keys } },
    });
    const map = Object.fromEntries(rows.map((row) => [row.key, settingString(row.value)]));
    return {
      theme: map['ui.theme'] || 'clinical-blue',
      clinicName: map['clinic.name'] || '',
      clinicLogoText: map['clinic.logoText'] || '',
    };
  }

  async findByKey(key: string, clinicId: string) {
    await this.ensureDefaults(clinicId);
    const setting = await this.prisma.setting.findUnique({
      where: { clinicId_key: { clinicId, key } },
    });
    if (!setting) throw new NotFoundException(`Setting ${key} not found`);
    return setting;
  }

  async upsertMany(
    items: Array<{ key: string; value: unknown; group?: string }>,
    clinicId: string,
    actorId?: string,
  ) {
    const updated = [];
    const clinicUpdates: Prisma.ClinicUpdateInput = {};

    for (const item of items) {
      // Logo binary metadata is managed only via upload/remove endpoints.
      if (
        item.key === 'clinic.logoS3Key' ||
        item.key === 'clinic.logoMimeType' ||
        item.key === 'clinic.logoFileName'
      ) {
        continue;
      }

      const group = item.group || item.key.split('.')[0] || 'general';
      const safeVal = (item.value === undefined || item.value === null) ? '' : item.value;

      // Track clinic entity fields to keep Clinic record synchronized
      if (item.key === 'clinic.name' && typeof safeVal === 'string' && safeVal.trim()) {
        clinicUpdates.name = safeVal.trim();
      } else if (item.key === 'clinic.phone' && typeof safeVal === 'string') {
        clinicUpdates.phone = safeVal.trim() || null;
      } else if (item.key === 'clinic.email' && typeof safeVal === 'string') {
        clinicUpdates.email = safeVal.trim() || null;
      } else if (item.key === 'clinic.gstin' && typeof safeVal === 'string') {
        clinicUpdates.gstin = safeVal.trim() || null;
      } else if (item.key === 'clinic.address' && typeof safeVal === 'string') {
        clinicUpdates.address = { line: safeVal.trim() };
      }

      const row = await this.prisma.setting.upsert({
        where: { clinicId_key: { clinicId, key: item.key } },
        update: { value: safeVal as Prisma.InputJsonValue, group },
        create: {
          clinicId,
          key: item.key,
          value: safeVal as Prisma.InputJsonValue,
          group,
        },
      });
      updated.push(row);
    }

    if (Object.keys(clinicUpdates).length > 0) {
      await this.prisma.clinic.update({
        where: { id: clinicId },
        data: clinicUpdates,
      }).catch((err) => {
        this.logger.warn(`Failed to sync clinic model with settings: ${err.message}`);
      });
    }

    await this.audit.log({
      clinicId,
      actorId,
      action: 'SETTINGS_UPDATED',
      entityType: 'setting',
      metadata: { keys: items.map((i) => i.key) },
    }).catch(() => undefined);

    return updated;
  }

  async getLogoUrl(clinicId: string) {
    await this.ensureDefaults(clinicId);
    const s3Key = await this.readSettingValue(clinicId, 'clinic.logoS3Key');
    if (!s3Key) {
      return { url: null as string | null, fileName: '', mimeType: '' };
    }
    const fileName = await this.readSettingValue(clinicId, 'clinic.logoFileName');
    const mimeType = await this.readSettingValue(clinicId, 'clinic.logoMimeType');
    try {
      const command = new GetObjectCommand({
        Bucket: this.bucket,
        Key: s3Key,
        ResponseContentType: mimeType || undefined,
        ResponseContentDisposition: 'inline',
      });
      const url = await getSignedUrl(this.s3Client, command, { expiresIn: 3600 });
      return { url, fileName, mimeType };
    } catch (err) {
      this.logger.warn(`Failed to get signed logo URL: ${err instanceof Error ? err.message : err}`);
      return { url: null as string | null, fileName, mimeType };
    }
  }

  async uploadLogo(
    clinicId: string,
    file: { buffer: Buffer; originalname: string; mimetype: string; size: number },
    actorId?: string,
  ) {
    if (!file?.buffer?.length) throw new BadRequestException('No file provided');
    if (file.size > 2 * 1024 * 1024) {
      throw new BadRequestException('Logo must be 2 MB or smaller');
    }

    await this.ensureDefaults(clinicId);
    const previousKey = await this.readSettingValue(clinicId, 'clinic.logoS3Key');

    const timestamp = Date.now();
    const sanitized = (file.originalname || 'logo.png').replace(/[^a-zA-Z0-9.-]/g, '_');
    const s3Key = `clinics/${clinicId}/letterhead/${timestamp}-${sanitized}`;

    try {
      await this.ensureBucket();
      await this.s3Client.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: s3Key,
          Body: file.buffer,
          ContentType: file.mimetype || 'image/png',
        }),
      );
    } catch (err) {
      this.logger.error(`Failed to store logo in S3: ${err instanceof Error ? err.message : err}`);
      throw new BadRequestException(
        `Failed to store logo: ${err instanceof Error ? err.message : 'Storage service unavailable'}`,
      );
    }

    for (const item of [
      { key: 'clinic.logoS3Key', value: s3Key },
      { key: 'clinic.logoMimeType', value: file.mimetype || 'image/png' },
      { key: 'clinic.logoFileName', value: file.originalname || 'logo.png' },
    ]) {
      await this.prisma.setting.upsert({
        where: { clinicId_key: { clinicId, key: item.key } },
        update: { value: item.value as Prisma.InputJsonValue, group: 'clinic' },
        create: {
          clinicId,
          key: item.key,
          value: item.value as Prisma.InputJsonValue,
          group: 'clinic',
        },
      });
    }

    if (previousKey && previousKey !== s3Key) {
      try {
        await this.s3Client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: previousKey }));
      } catch (err) {
        this.logger.warn(
          `Failed to delete previous logo ${previousKey}: ${err instanceof Error ? err.message : err}`,
        );
      }
    }

    await this.audit.log({
      clinicId,
      actorId,
      action: 'CLINIC_LOGO_UPLOADED',
      entityType: 'setting',
      result: 'SUCCESS',
      metadata: { fileName: file.originalname, mimeType: file.mimetype, sizeBytes: file.size },
    }).catch(() => undefined);

    return this.getLogoUrl(clinicId);
  }

  async removeLogo(clinicId: string, actorId?: string) {
    await this.ensureDefaults(clinicId);
    const previousKey = await this.readSettingValue(clinicId, 'clinic.logoS3Key');

    for (const key of ['clinic.logoS3Key', 'clinic.logoMimeType', 'clinic.logoFileName']) {
      await this.prisma.setting.upsert({
        where: { clinicId_key: { clinicId, key } },
        update: { value: '' as Prisma.InputJsonValue, group: 'clinic' },
        create: { clinicId, key, value: '' as Prisma.InputJsonValue, group: 'clinic' },
      });
    }

    if (previousKey) {
      try {
        await this.s3Client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: previousKey }));
      } catch (err) {
        this.logger.warn(
          `Failed to delete logo ${previousKey}: ${err instanceof Error ? err.message : err}`,
        );
      }
    }

    await this.audit.log({
      clinicId,
      actorId,
      action: 'CLINIC_LOGO_REMOVED',
      entityType: 'setting',
      result: 'SUCCESS',
    });

    return { url: null as string | null, fileName: '', mimeType: '' };
  }
}
