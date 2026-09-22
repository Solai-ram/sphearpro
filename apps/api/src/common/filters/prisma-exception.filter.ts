import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Response } from 'express';

/**
 * Global exception filter that:
 *  1. Passes through NestJS HttpExceptions as-is (e.g. NotFoundException, BadRequestException).
 *  2. Maps known Prisma client errors to meaningful HTTP responses.
 *  3. Returns a safe 500 for everything else — without leaking internals.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<{ method: string; url: string }>();

    const { status, message } = this.resolve(exception);

    if (status >= 500) {
      this.logger.error(
        `[${request.method}] ${request.url} → ${status}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    response.status(status).json({
      statusCode: status,
      message,
      path: request.url,
      timestamp: new Date().toISOString(),
    });
  }

  private resolve(exception: unknown): { status: number; message: string | string[] } {
    // ── NestJS HTTP exceptions ────────────────────────────────────────────────
    if (exception instanceof HttpException) {
      const res = exception.getResponse();
      const message =
        typeof res === 'string'
          ? res
          : (res as any)?.message ?? exception.message;
      return { status: exception.getStatus(), message };
    }

    // ── Prisma known request errors ───────────────────────────────────────────
    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      return this.handlePrismaKnownError(exception);
    }

    // ── Prisma validation errors (e.g. wrong enum value) ─────────────────────
    if (exception instanceof Prisma.PrismaClientValidationError) {
      return {
        status: HttpStatus.BAD_REQUEST,
        message: 'Invalid data supplied — please check your input.',
      };
    }

    // ── Prisma initialisation errors (misconfiguration) ───────────────────────
    if (exception instanceof Prisma.PrismaClientInitializationError) {
      this.logger.error('Prisma initialisation error', exception.message);
      return {
        status: HttpStatus.SERVICE_UNAVAILABLE,
        message: 'Database connection is unavailable. Please try again shortly.',
      };
    }

    // ── Generic / unexpected ──────────────────────────────────────────────────
    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'An unexpected error occurred. Please try again.',
    };
  }

  private handlePrismaKnownError(
    err: Prisma.PrismaClientKnownRequestError,
  ): { status: number; message: string } {
    switch (err.code) {
      // Unique constraint failed
      case 'P2002': {
        const fields = (err.meta?.target as string[] | undefined)?.join(', ') ?? 'field';
        return {
          status: HttpStatus.CONFLICT,
          message: `A record with the same ${fields} already exists.`,
        };
      }

      // Record not found (update/delete on non-existent row)
      case 'P2025':
        return {
          status: HttpStatus.NOT_FOUND,
          message: (err.meta?.cause as string) ?? 'The requested record was not found.',
        };

      // Foreign key constraint failed
      case 'P2003':
        return {
          status: HttpStatus.BAD_REQUEST,
          message: 'Related record not found. Please check the supplied IDs.',
        };

      // Required field is missing / null constraint
      case 'P2011':
      case 'P2012':
        return {
          status: HttpStatus.BAD_REQUEST,
          message: 'A required field is missing.',
        };

      // Value too large for column
      case 'P2000':
        return {
          status: HttpStatus.BAD_REQUEST,
          message: 'One of the values provided is too long.',
        };

      // Transaction timeout / deadlock
      case 'P2034':
        return {
          status: HttpStatus.CONFLICT,
          message: 'Transaction conflict — please retry.',
        };

      default:
        this.logger.error(`Unhandled Prisma error ${err.code}`, err.message);
        return {
          status: HttpStatus.INTERNAL_SERVER_ERROR,
          message: 'A database error occurred. Please try again.',
        };
    }
  }
}
