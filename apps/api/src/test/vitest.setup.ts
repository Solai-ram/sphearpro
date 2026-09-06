import 'reflect-metadata';

process.env.NODE_ENV = process.env.NODE_ENV || 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-please-change';
process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'test-refresh-secret-please-change';
process.env.SUBSCRIPTION_JOBS_DISABLED = process.env.SUBSCRIPTION_JOBS_DISABLED || 'true';
process.env.WHATSAPP_ENABLED = process.env.WHATSAPP_ENABLED || 'false';
