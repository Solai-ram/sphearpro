import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenAI } from '@google/genai';

export interface GeminiGenerationResult {
  text: string;
  provider: 'google';
  model: string;
}

@Injectable()
export class GeminiAdapter {
  private readonly logger = new Logger(GeminiAdapter.name);
  private client: GoogleGenAI | null = null;
  private readonly preferredModel: string;

  constructor(private config: ConfigService) {
    const apiKey = this.config.get<string>('GEMINI_API_KEY');
    this.preferredModel = this.config.get<string>('GEMINI_MODEL') || 'gemini-3.6-flash';
    if (apiKey) {
      this.client = new GoogleGenAI({ apiKey });
    }
  }

  async generateText(prompt: string, systemInstruction?: string): Promise<GeminiGenerationResult> {
    if (!this.client) {
      throw new BadRequestException('Gemini API key is not configured');
    }

    const models = this.modelCandidates();
    let lastError: unknown;

    for (const model of models) {
      try {
        const response = await this.client.models.generateContent({
          model,
          contents: prompt,
          config: systemInstruction
            ? { systemInstruction }
            : undefined,
        });

        const text = (response.text || '').trim();
        if (!text) {
          throw new BadRequestException('Gemini returned an empty response');
        }

        return { text, provider: 'google', model };
      } catch (error) {
        lastError = error;
        const message = this.errorMessage(error);
        this.logger.warn(`Gemini model ${model} failed: ${message}`);
        // Try next candidate for model/not-found style failures; keep trying on network too once
        continue;
      }
    }

    throw new BadRequestException(
      `Gemini summary failed: ${this.errorMessage(lastError)}. Check GEMINI_API_KEY / GEMINI_MODEL and network access to Google AI.`,
    );
  }

  private modelCandidates(): string[] {
    const fallbacks = [
      this.preferredModel,
      'gemini-3.6-flash',
      'gemini-3.5-flash',
      'gemini-2.5-flash',
      'gemini-2.0-flash',
    ];
    return [...new Set(fallbacks.filter(Boolean))];
  }

  private errorMessage(error: unknown): string {
    if (!error) return 'unknown error';
    if (error instanceof Error) {
      const anyErr = error as Error & { status?: number; code?: string; cause?: unknown };
      let message = anyErr.message || '';
      // Google GenAI sometimes puts JSON in message
      try {
        const parsed = JSON.parse(message) as { error?: { message?: string } };
        if (parsed?.error?.message) message = parsed.error.message;
      } catch {
        // not JSON
      }
      const cause =
        anyErr.cause instanceof Error
          ? anyErr.cause.message
          : typeof anyErr.cause === 'string'
            ? anyErr.cause
            : '';
      const parts = [message, cause].filter(Boolean);
      if (parts.join(' ').toLowerCase().includes('fetch failed')) {
        return 'cannot reach Google Gemini (network/API key/model). Verify GEMINI_API_KEY and outbound HTTPS.';
      }
      return parts.join(' — ');
    }
    return String(error);
  }
}
