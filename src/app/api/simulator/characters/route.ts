import { respData, respErr } from '@/shared/lib/resp';
import {
  createSimulatorCharacter,
  listSimulatorCharacters,
} from '@/shared/models/simulator-user';
import { getUserInfo } from '@/shared/models/user';

export async function GET() {
  try {
    const user = await getUserInfo();
    if (!user) {
      return respErr('no auth, please sign in');
    }

    const characters = await listSimulatorCharacters(user.id);
    return respData(characters);
  } catch (error) {
    console.error('failed to list simulator characters:', error);
    return respErr('failed to load simulator characters');
  }
}

export async function POST(req: Request) {
  try {
    const user = await getUserInfo();
    if (!user) {
      return respErr('no auth, please sign in');
    }

    const body = await req.json();
    const bundle = await createSimulatorCharacter({
      userId: user.id,
      name: String(body?.name || ''),
    });

    return respData(bundle);
  } catch (error) {
    console.error('failed to create simulator character:', error);
    return respErr(
      error instanceof Error ? error.message : 'failed to create simulator character'
    );
  }
}
