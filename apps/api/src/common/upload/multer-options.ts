import { BadRequestException } from '@nestjs/common';
import { memoryStorage } from 'multer';
import type { Request } from 'express';

const AUDIO_EXT = new Set(['.webm', '.wav', '.mp3', '.m4a', '.ogg', '.mp4', '.aac']);
const DOC_EXT = new Set([
  '.pdf', '.png', '.jpg', '.jpeg', '.gif', '.webp',
  '.doc', '.docx', '.xls', '.xlsx', '.txt', '.csv',
]);

const AUDIO_MIME = /^(audio\/|video\/webm|video\/mp4)/i;
const DOC_MIME =
  /^(application\/pdf|image\/(png|jpeg|gif|webp)|application\/(msword|vnd\.)|text\/(plain|csv))/i;

function extOf(name: string) {
  const i = name.lastIndexOf('.');
  return i >= 0 ? name.slice(i).toLowerCase() : '';
}

export function sanitizeDownloadFilename(name: string) {
  return (name || 'download')
    .replace(/["\r\n\\]/g, '_')
    .replace(/[^\w.\- ()]/g, '_')
    .slice(0, 180);
}

function fileFilter(kind: 'audio' | 'document') {
  return (
    _req: Request,
    file: Express.Multer.File,
    cb: (error: Error | null, acceptFile: boolean) => void,
  ) => {
    const ext = extOf(file.originalname || '');
    const mime = file.mimetype || '';
    const ok =
      kind === 'audio'
        ? AUDIO_EXT.has(ext) || AUDIO_MIME.test(mime)
        : DOC_EXT.has(ext) || DOC_MIME.test(mime);
    if (!ok) {
      return cb(new BadRequestException(`File type not allowed (${ext || mime || 'unknown'})`), false);
    }
    cb(null, true);
  };
}

export function multerAudioOptions(maxBytes = 25 * 1024 * 1024) {
  return {
    storage: memoryStorage(),
    limits: { fileSize: maxBytes },
    fileFilter: fileFilter('audio'),
  };
}

export function multerDocumentOptions(maxBytes = 50 * 1024 * 1024) {
  return {
    storage: memoryStorage(),
    limits: { fileSize: maxBytes },
    fileFilter: fileFilter('document'),
  };
}

const IMAGE_EXT = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp']);
const IMAGE_MIME = /^image\/(png|jpeg|gif|webp)$/i;

export function multerImageOptions(maxBytes = 2 * 1024 * 1024) {
  return {
    storage: memoryStorage(),
    limits: { fileSize: maxBytes },
    fileFilter: (
      _req: Request,
      file: Express.Multer.File,
      cb: (error: Error | null, acceptFile: boolean) => void,
    ) => {
      const ext = extOf(file.originalname || '');
      const mime = file.mimetype || '';
      if (!IMAGE_EXT.has(ext) && !IMAGE_MIME.test(mime)) {
        return cb(new BadRequestException('Logo must be PNG, JPG, GIF, or WebP'), false);
      }
      cb(null, true);
    },
  };
}
