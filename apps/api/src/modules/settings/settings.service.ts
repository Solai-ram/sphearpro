import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';
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
  { key: 'invoice.title', group: 'invoice', value: 'Tax Invoice' },
  { key: 'invoice.terms', group: 'invoice', value: 'Exempted from Sales Tax.\nReceived the above goods in sound condition & correct quantity.\nGoods once sold cannot be taken back.' },
  { key: 'billing.defaultTaxRate', group: 'billing', value: 0 },
  { key: 'billing.currency', group: 'billing', value: 'INR' },
  { key: 'ui.theme', group: 'ui', value: 'clinical-blue' },
];

@Injectable()
export class SettingsService {
  constructor(
    @Inject('PRISMA_CLIENT') private prisma: PrismaClient,
    private audit: AuditService,
  ) {}

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
    const map = Object.fromEntries(
      rows.map((row) => {
        const raw = row.value;
        const value = typeof raw === 'string' ? raw.replace(/^"|"$/g, '') : raw == null ? '' : String(raw);
        return [row.key, value];
      }),
    );
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
    for (const item of items) {
      const group = item.group || item.key.split('.')[0] || 'general';
      const row = await this.prisma.setting.upsert({
        where: { clinicId_key: { clinicId, key: item.key } },
        update: { value: item.value as Prisma.InputJsonValue, group },
        create: {
          clinicId,
          key: item.key,
          value: item.value as Prisma.InputJsonValue,
          group,
        },
      });
      updated.push(row);
    }
    await this.audit.log({
      clinicId,
      actorId,
      action: 'SETTINGS_UPDATED',
      entityType: 'setting',
      metadata: { keys: items.map((i) => i.key) },
    });
    return updated;
  }
}
