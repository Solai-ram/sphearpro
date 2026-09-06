import { Injectable, Inject, BadRequestException } from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import { ElevenLabsAdapter } from './elevenlabs.adapter';
import { GeminiAdapter } from './gemini.adapter';

const CLINICAL_DRAFT_RULES =
  'You are assisting a clinician. Output is an AI DRAFT only — never a final clinical record. Do not invent facts. If information is missing, say so. Do not give medication advice. Use clear clinical language.';

@Injectable()
export class AiService {
  constructor(
    @Inject('PRISMA_CLIENT') private prisma: any,
    private elevenLabs: ElevenLabsAdapter,
    private gemini: GeminiAdapter,
    private auditService: AuditService,
  ) {}

  async transcribeAudio(input: {
    buffer: Buffer;
    mimeType: string;
    fileName?: string;
    languageCode?: string;
    createdBy?: string;
    inputRef?: string;
    clinicId: string;
  }) {
    const request = await this.prisma.aiRequest.create({
      data: {
        clinicId: input.clinicId,
        type: 'VOICE_TRANSCRIPTION',
        provider: 'elevenlabs',
        model: process.env.ELEVENLABS_STT_MODEL || 'scribe_v2',
        inputRef: input.inputRef,
        status: 'PROCESSING',
        createdBy: input.createdBy,
      },
    });

    try {
      const result = await this.elevenLabs.transcribe({
        buffer: input.buffer,
        mimeType: input.mimeType,
        fileName: input.fileName,
        languageCode: input.languageCode,
      });

      const output = await this.prisma.aiOutput.create({
        data: {
          requestId: request.id,
          contentType: 'transcript',
          content: result.text,
          isReviewed: false,
        },
      });

      await this.prisma.aiRequest.update({
        where: { id: request.id },
        data: { status: 'COMPLETED' },
      });

      await this.prisma.aiUsage.create({
        data: {
          clinicId: input.clinicId,
          provider: 'elevenlabs',
          model: result.model,
          requestType: 'VOICE_TRANSCRIPTION',
          promptTokens: 0,
          completionTokens: Math.ceil(result.text.length / 4),
        },
      });

      await this.auditService.log({
        actorId: input.createdBy,
        actorType: 'ai',
        action: 'AI_TRANSCRIPT_GENERATED',
        entityType: 'AiRequest',
        entityId: request.id,
        result: 'SUCCESS',
        metadata: { provider: 'elevenlabs', model: result.model, languageCode: result.languageCode },
      });

      return {
        requestId: request.id,
        outputId: output.id,
        text: result.text,
        languageCode: result.languageCode,
        provider: result.provider,
        model: result.model,
        isDraft: true,
      };
    } catch (error) {
      await this.prisma.aiRequest.update({
        where: { id: request.id },
        data: { status: 'FAILED' },
      });
      const message = error instanceof Error ? error.message : 'Transcription failed';
      throw new BadRequestException(message);
    }
  }

  /**
   * ElevenLabs STT → English clinical note draft (not a final record until human confirms).
   */
  async transcribeToEnglishDraft(input: {
    buffer: Buffer;
    mimeType: string;
    fileName?: string;
    languageCode?: string;
    createdBy?: string;
    inputRef?: string;
    clinicId: string;
  }) {
    const transcript = await this.transcribeAudio(input);
    const prompt = [
      `You are converting a clinician's voice transcript into a clear English clinical session note DRAFT.`,
      `Rules:`,
      `- Translate into English if the transcript is in another language.`,
      `- Keep clinical meaning; do not invent findings.`,
      `- Output a single continuous clinical note (paragraphs OK). No JSON. No SOAP headings unless they were clearly spoken.`,
      `- If unclear audio, note uncertainty briefly.`,
      `Transcript (may be non-English):`,
      transcript.text,
    ].join('\n');

    const drafted = await this.runGemini({
      type: 'NOTE_DRAFT',
      contentType: 'english_note_draft',
      prompt,
      createdBy: input.createdBy,
      inputRef: input.inputRef || transcript.requestId,
    });

    await this.auditService.log({
      actorId: input.createdBy,
      actorType: 'ai',
      action: 'AI_NOTE_DRAFT_GENERATED',
      entityType: 'AiRequest',
      entityId: drafted.requestId,
      result: 'SUCCESS',
      metadata: {
        fromTranscriptRequestId: transcript.requestId,
        sourceLanguage: transcript.languageCode,
        pipeline: 'elevenlabs_stt_then_english_draft',
      },
    });

    return {
      requestId: drafted.requestId,
      outputId: drafted.outputId,
      transcriptRequestId: transcript.requestId,
      originalText: transcript.text,
      text: drafted.text,
      languageCode: transcript.languageCode,
      provider: 'elevenlabs+gemini',
      model: drafted.model,
      isDraft: true,
    };
  }

  async summarizeTherapy(input: {
    caseTitle: string;
    patientName: string;
    assessment?: string;
    goals?: unknown;
    attendanceRate: number;
    present: number;
    total: number;
    notes: Array<{
      subjective?: string;
      objective?: string;
      activities?: string;
      observations?: string;
      progress?: string;
      challenges?: string;
      nextPlan?: string;
    }>;
    createdBy?: string;
    inputRef?: string;
  }) {
    const notesBlock = input.notes
      .map((n, i) => {
        const bits = [n.subjective, n.objective, n.activities, n.observations, n.progress, n.challenges, n.nextPlan]
          .filter(Boolean)
          .join(' | ');
        return `${i + 1}. ${bits || '(empty note)'}`;
      })
      .join('\n');

    const prompt = [
      `Write ONE short overall clinical summary of ALL the session notes below.`,
      `Audience: the attending doctor reviewing this patient's therapy history.`,
      `Case: ${input.caseTitle}`,
      `Patient: ${input.patientName}`,
      `Attendance: ${input.present}/${input.total} sessions present/late (${input.attendanceRate}%)`,
      `Assessment: ${input.assessment || 'Not recorded'}`,
      `Goals: ${JSON.stringify(input.goals ?? [])}`,
      `All session notes (${input.notes.length}):`,
      notesBlock || 'No notes yet.',
      '',
      `Requirements:`,
      `- Produce a single concise summary only (about 1–3 short paragraphs).`,
      `- Cover overall progress, main findings, recurring issues, and current status across ALL notes.`,
      `- Do NOT use section headings, bullet lists, or SOAP labels.`,
      `- Do not invent facts that are not in the notes.`,
      `- End with this exact sentence: This is an AI draft and is not a clinical record until a doctor reviews and approves it.`,
    ].join('\n');

    return this.runGemini({
      type: 'THERAPY_SUMMARY',
      contentType: 'summary',
      prompt,
      createdBy: input.createdBy,
      inputRef: input.inputRef,
    });
  }

  async draftSoapFromTranscript(input: {
    transcript: string;
    createdBy?: string;
    inputRef?: string;
    clinicId: string;
  }) {
    const prompt = [
      `Turn this therapy session voice transcript into a SOAP-style draft.`,
      `Return ONLY valid JSON with keys: subjective, objective, activities, observations, progress, challenges, nextPlan.`,
      `Use empty strings for unknown fields. Do not add extra keys.`,
      `Transcript:`,
      input.transcript,
    ].join('\n');

    const generated = await this.runGemini({
      type: 'NOTE_DRAFT',
      contentType: 'note_draft',
      prompt,
      createdBy: input.createdBy,
      inputRef: input.inputRef,
    });

    return { ...generated, soap: this.parseSoap(generated.text) };
  }

  private parseSoap(text: string): Record<string, string> {
    const empty = {
      subjective: '',
      objective: '',
      activities: '',
      observations: '',
      progress: '',
      challenges: '',
      nextPlan: '',
    };
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) {
      return { ...empty, subjective: text };
    }
    try {
      const parsed = JSON.parse(match[0]) as Record<string, unknown>;
      return {
        subjective: String(parsed.subjective ?? ''),
        objective: String(parsed.objective ?? ''),
        activities: String(parsed.activities ?? ''),
        observations: String(parsed.observations ?? ''),
        progress: String(parsed.progress ?? ''),
        challenges: String(parsed.challenges ?? ''),
        nextPlan: String(parsed.nextPlan ?? ''),
      };
    } catch {
      return { ...empty, subjective: text };
    }
  }

  private async runGemini(input: {
    type: 'THERAPY_SUMMARY' | 'NOTE_DRAFT' | 'PROGRESS_SUMMARY';
    contentType: string;
    prompt: string;
    createdBy?: string;
    inputRef?: string;
    clinicId: string;
  }) {
    const request = await this.prisma.aiRequest.create({
      data: {
        clinicId: input.clinicId,
        type: input.type,
        provider: 'google',
        model: process.env.GEMINI_MODEL || 'gemini-3.5-flash',
        inputRef: input.inputRef,
        status: 'PROCESSING',
        createdBy: input.createdBy,
      },
    });

    try {
      const result = await this.gemini.generateText(input.prompt, CLINICAL_DRAFT_RULES);

      const output = await this.prisma.aiOutput.create({
        data: {
          requestId: request.id,
          contentType: input.contentType,
          content: result.text,
          isReviewed: false,
        },
      });

      await this.prisma.aiRequest.update({
        where: { id: request.id },
        data: { status: 'COMPLETED' },
      });

      await this.prisma.aiUsage.create({
        data: {
          clinicId: input.clinicId,
          provider: 'google',
          model: result.model,
          requestType: input.type,
          promptTokens: Math.ceil(input.prompt.length / 4),
          completionTokens: Math.ceil(result.text.length / 4),
        },
      });

      await this.auditService.log({
        actorId: input.createdBy,
        actorType: 'ai',
        action: input.type === 'THERAPY_SUMMARY' ? 'AI_SUMMARY_GENERATED' : 'AI_NOTE_DRAFT_GENERATED',
        entityType: 'AiRequest',
        entityId: request.id,
        result: 'SUCCESS',
        metadata: { provider: 'google', model: result.model },
      });

      return {
        requestId: request.id,
        outputId: output.id,
        text: result.text,
        provider: result.provider,
        model: result.model,
        isDraft: true,
      };
    } catch (error) {
      await this.prisma.aiRequest.update({
        where: { id: request.id },
        data: { status: 'FAILED' },
      });
      const message = error instanceof Error ? error.message : 'Gemini generation failed';
      throw new BadRequestException(message);
    }
  }

  getStatus() {
    return {
      pipeline: 'AI → Draft → human review → clinical record',
      writesClinicalRecords: false,
      gemini: {
        configured: Boolean(process.env.GEMINI_API_KEY),
        model: process.env.GEMINI_MODEL || 'gemini-3.5-flash',
      },
      elevenlabs: {
        configured: Boolean(process.env.ELEVENLABS_API_KEY),
        model: process.env.ELEVENLABS_STT_MODEL || 'scribe_v2',
      },
    };
  }

  async listRequests(params: { page?: number; limit?: number; type?: string; status?: string }) {
    const page = params.page || 1;
    const limit = params.limit || 20;
    const where: Record<string, unknown> = {};
    if (params.type) where.type = params.type;
    if (params.status) where.status = params.status;

    const [data, total] = await Promise.all([
      this.prisma.aiRequest.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { outputs: { orderBy: { createdAt: 'desc' } } },
      }),
      this.prisma.aiRequest.count({ where }),
    ]);

    return {
      data,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async reviewOutput(outputId: string, reviewedBy?: string) {
    const output = await this.prisma.aiOutput.findUnique({
      where: { id: outputId },
      include: { request: true },
    });
    if (!output) throw new BadRequestException('AI output not found');
    if (output.isReviewed) throw new BadRequestException('Output already reviewed');

    const updated = await this.prisma.aiOutput.update({
      where: { id: outputId },
      data: { isReviewed: true },
      include: { request: true },
    });

    await this.auditService.log({
      actorId: reviewedBy,
      actorType: 'user',
      action: 'AI_OUTPUT_REVIEWED',
      entityType: 'AiOutput',
      entityId: outputId,
      result: 'SUCCESS',
      metadata: {
        requestId: output.requestId,
        contentType: output.contentType,
        clinicalWrite: false,
      },
    });

    return {
      ...updated,
      isDraft: true,
      writesClinicalRecords: false,
    };
  }

  async usage(days = 30) {
    const from = new Date(Date.now() - days * 86400000);
    const [requests, usageRows, pendingReview] = await Promise.all([
      this.prisma.aiRequest.groupBy({
        by: ['type', 'status'],
        where: { createdAt: { gte: from } },
        _count: { _all: true },
      }),
      this.prisma.aiUsage.groupBy({
        by: ['provider', 'requestType'],
        where: { recordedAt: { gte: from } },
        _sum: { promptTokens: true, completionTokens: true },
        _count: { _all: true },
      }),
      this.prisma.aiOutput.count({ where: { isReviewed: false, createdAt: { gte: from } } }),
    ]);

    return {
      from,
      pendingReview,
      requests: requests.map((r: any) => ({ type: r.type, status: r.status, count: r._count._all })),
      usage: usageRows.map((r: any) => ({
        provider: r.provider,
        requestType: r.requestType,
        requests: r._count._all,
        promptTokens: r._sum.promptTokens || 0,
        completionTokens: r._sum.completionTokens || 0,
      })),
    };
  }
}
