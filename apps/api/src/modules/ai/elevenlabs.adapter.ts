import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ElevenLabsClient } from '@elevenlabs/elevenlabs-js';

export interface TranscriptionResult {
  text: string;
  languageCode?: string;
  provider: 'elevenlabs';
  model: string;
}

@Injectable()
export class ElevenLabsAdapter {
  private client: ElevenLabsClient | null = null;
  private readonly model: string;

  constructor(private config: ConfigService) {
    const apiKey = this.config.get<string>('ELEVENLABS_API_KEY');
    this.model = this.config.get<string>('ELEVENLABS_STT_MODEL') || 'scribe_v2';
    if (apiKey) {
      this.client = new ElevenLabsClient({ apiKey });
    }
  }

  async transcribe(input: {
    buffer: Buffer;
    mimeType: string;
    fileName?: string;
    languageCode?: string;
  }): Promise<TranscriptionResult> {
    if (!this.client) {
      throw new BadRequestException('ElevenLabs API key is not configured');
    }
    if (!input.buffer?.length) {
      throw new BadRequestException('Audio file is empty');
    }

    const blob = new Blob([input.buffer], { type: input.mimeType || 'audio/webm' });
    const file = new File([blob], input.fileName || 'voice-note.webm', {
      type: input.mimeType || 'audio/webm',
    });

    const response = await this.client.speechToText.convert({
      file,
      modelId: this.model === 'scribe_v1' ? 'scribe_v1' : 'scribe_v2',
      languageCode: input.languageCode,
    });

    const text = this.extractText(response);
    if (!text) {
      throw new BadRequestException('ElevenLabs returned an empty transcript');
    }

    return {
      text,
      languageCode: (response as { languageCode?: string }).languageCode,
      provider: 'elevenlabs',
      model: this.model,
    };
  }

  private extractText(response: unknown): string {
    if (!response || typeof response !== 'object') return '';
    const body = response as { text?: string; transcripts?: { text?: string }[] };
    if (typeof body.text === 'string' && body.text.trim()) return body.text.trim();
    if (Array.isArray(body.transcripts)) {
      return body.transcripts.map((t) => t.text || '').filter(Boolean).join('\n').trim();
    }
    return '';
  }
}
