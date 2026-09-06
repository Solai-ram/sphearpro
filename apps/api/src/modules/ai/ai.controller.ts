import {
  Controller,
  Post,
  Get,
  Param,
  UploadedFile,
  UseInterceptors,
  Query,
  Body,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AiService } from './ai.service';
import { Authenticated } from '../../common/decorators/auth.decorator';
import { requireClinicId } from '../../common/tenant/clinic-context';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { multerAudioOptions } from '../../common/upload/multer-options';
import { RequireFeature } from '../../common/decorators/subscription.decorator';

@ApiTags('AI')
@ApiBearerAuth()
@Controller('ai')
@RequireFeature('AI_ASSIST')
export class AiController {
  constructor(private aiService: AiService) {}

  @Get('status')
  @Authenticated('ai.review')
  @ApiOperation({ summary: 'AI provider status (no secrets)' })
  status() {
    return this.aiService.getStatus();
  }

  @Get('usage')
  @Authenticated('ai.review')
  @ApiOperation({ summary: 'AI usage and pending review counts' })
  usage(
    @CurrentUser() user: { clinicId?: string },
    @Query('days') days?: string,
  ) {
    return this.aiService.usage(requireClinicId(user), days ? Number(days) : 30);
  }

  @Get('requests')
  @Authenticated('ai.review')
  @ApiOperation({ summary: 'List AI requests and drafts' })
  listRequests(
    @CurrentUser() user: { clinicId?: string },
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('type') type?: string,
    @Query('status') status?: string,
  ) {
    return this.aiService.listRequests({
      clinicId: requireClinicId(user),
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 20,
      type,
      status,
    });
  }

  @Post('transcribe')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Authenticated('ai.transcribe')
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Transcribe audio with ElevenLabs (draft only)' })
  @UseInterceptors(FileInterceptor('file', multerAudioOptions()))
  async transcribe(
    @UploadedFile() file: Express.Multer.File,
    @Query('languageCode') languageCode: string | undefined,
    @Query('toEnglish') toEnglish: string | undefined,
    @CurrentUser() user: { sub?: string; clinicId?: string },
  ) {
    if (!file) throw new BadRequestException('Audio file is required');
    const payload = {
      buffer: file.buffer,
      mimeType: file.mimetype,
      fileName: file.originalname,
      languageCode,
      createdBy: user.sub,
      clinicId: requireClinicId(user),
    };
    if (toEnglish === '1' || toEnglish === 'true') {
      return this.aiService.transcribeToEnglishDraft(payload);
    }
    return this.aiService.transcribeAudio(payload);
  }

  @Post('summarize')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Authenticated('ai.summary.generate')
  @ApiOperation({ summary: 'Generate a therapy summary draft with Gemini (not a clinical record until reviewed)' })
  async summarize(
    @CurrentUser() user: { sub?: string; clinicId?: string },
    @Body()
    body: {
      caseTitle: string;
      patientName: string;
      assessment?: string;
      goals?: unknown;
      attendanceRate: number;
      present: number;
      total: number;
      notes: Array<Record<string, string | undefined>>;
      inputRef?: string;
    },
  ) {
    return this.aiService.summarizeTherapy({
      ...body,
      createdBy: user.sub,
      clinicId: requireClinicId(user),
    });
  }

  @Post('note-draft')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Authenticated('ai.note_draft')
  @ApiOperation({ summary: 'Draft SOAP fields from a transcript (not a clinical record)' })
  noteDraft(
    @CurrentUser() user: { sub?: string; clinicId?: string },
    @Body() body: { transcript: string; inputRef?: string },
  ) {
    if (!body?.transcript?.trim()) throw new BadRequestException('Transcript is required');
    return this.aiService.draftSoapFromTranscript({
      transcript: body.transcript,
      createdBy: user.sub,
      clinicId: requireClinicId(user),
      inputRef: body.inputRef,
    });
  }

  @Post('outputs/:id/review')
  @Authenticated('ai.review')
  @ApiOperation({ summary: 'Mark an AI draft as reviewed (does not write a clinical record)' })
  reviewOutput(
    @Param('id') id: string,
    @CurrentUser() user: { sub?: string; clinicId?: string },
  ) {
    return this.aiService.reviewOutput(id, requireClinicId(user), user.sub);
  }
}
