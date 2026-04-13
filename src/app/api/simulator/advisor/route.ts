import { respData, respErr } from '@/shared/lib/resp';
import { findActiveCharacter } from '@/shared/models/simulator-core';
import {
  buildSimulatorAdvisorAuditContextSummary,
  createSimulatorAdvisorAudit,
} from '@/shared/models/simulator-advisor-audit';
import { getUserInfo } from '@/shared/models/user';
import {
  generateSimulatorAdvisorReply,
  getSimulatorAdvisorAdminConfig,
  getSimulatorAdvisorConfigStatus,
} from '@/shared/services/simulator-advisor';

export async function GET() {
  try {
    const user = await getUserInfo();
    if (!user) {
      return respErr('no auth, please sign in');
    }

    return respData(await getSimulatorAdvisorConfigStatus());
  } catch (error) {
    console.error('failed to load simulator advisor status:', error);
    return respErr('failed to load simulator advisor status');
  }
}

export async function POST(req: Request) {
  let currentUserId = '';
  let currentCharacterId: string | null = null;
  let currentQuestion = '';
  let currentHistory: Array<{ role: 'user' | 'assistant'; content: string }> =
    [];
  let currentContextSummary: Record<string, unknown> = {};

  try {
    const user = await getUserInfo();
    if (!user) {
      return respErr('no auth, please sign in');
    }
    currentUserId = user.id;

    const body = await req.json();
    const userMessage =
      typeof body?.message === 'string' ? body.message.trim() : '';
    const context =
      body?.context && typeof body.context === 'object' ? body.context : {};
    const history = Array.isArray(body?.history)
      ? body.history
          .filter(
            (item: unknown): item is { role: 'user' | 'assistant'; content: string } =>
              typeof item === 'object' &&
              item !== null &&
              (item as { role?: unknown }).role !== undefined &&
              ['user', 'assistant'].includes(String((item as { role?: unknown }).role)) &&
              typeof (item as { content?: unknown }).content === 'string'
          )
          .slice(-6)
      : [];
    currentQuestion = userMessage;
    currentHistory = history;

    if (!userMessage) {
      return respErr('message is required');
    }

    const activeCharacter = await findActiveCharacter(user.id);
    currentCharacterId = activeCharacter?.id ?? null;
    currentContextSummary = buildSimulatorAdvisorAuditContextSummary(context);

    const reply = await generateSimulatorAdvisorReply({
      userMessage,
      context,
      history,
    });

    await createSimulatorAdvisorAudit({
      userId: user.id,
      characterId: activeCharacter?.id ?? null,
      provider: reply.provider,
      model: reply.model,
      status: 'success',
      question: userMessage,
      answer: reply.reply,
      contextSummary: currentContextSummary,
      history,
    }).catch((auditError) => {
      console.error('failed to persist simulator advisor audit:', auditError);
    });

    return respData({ reply: reply.reply });
  } catch (error) {
    console.error('failed to ask simulator advisor:', error);

    if (currentUserId) {
      const advisorConfig = await getSimulatorAdvisorAdminConfig().catch(() => null);
      const errorMessage =
        error instanceof Error ? error.message : 'failed to ask simulator advisor';

      await createSimulatorAdvisorAudit({
        userId: currentUserId,
        characterId: currentCharacterId,
        provider: 'gemini',
        model: advisorConfig?.model ?? '',
        status: 'failed',
        question: currentQuestion,
        errorMessage,
        contextSummary: currentContextSummary,
        history: currentHistory,
      }).catch((auditError) => {
        console.error('failed to persist simulator advisor failure audit:', auditError);
      });
    }

    return respErr(
      error instanceof Error ? error.message : 'failed to ask simulator advisor'
    );
  }
}
