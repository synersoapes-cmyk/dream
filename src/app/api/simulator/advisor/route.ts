import { respData, respErr } from '@/shared/lib/resp';
import { getUserInfo } from '@/shared/models/user';
import {
  generateSimulatorAdvisorReply,
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
  try {
    const user = await getUserInfo();
    if (!user) {
      return respErr('no auth, please sign in');
    }

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

    if (!userMessage) {
      return respErr('message is required');
    }

    const reply = await generateSimulatorAdvisorReply({
      userMessage,
      context,
      history,
    });

    return respData({ reply });
  } catch (error) {
    console.error('failed to ask simulator advisor:', error);
    return respErr(
      error instanceof Error ? error.message : 'failed to ask simulator advisor'
    );
  }
}
