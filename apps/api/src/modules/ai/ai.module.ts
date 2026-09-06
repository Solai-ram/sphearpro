import { Module } from '@nestjs/common';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import { ElevenLabsAdapter } from './elevenlabs.adapter';
import { GeminiAdapter } from './gemini.adapter';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [AuditModule],
  controllers: [AiController],
  providers: [AiService, ElevenLabsAdapter, GeminiAdapter],
  exports: [AiService],
})
export class AiModule {}
