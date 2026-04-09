import { respData, respErr } from '@/shared/lib/resp';
import {
  deleteSimulatorCharacter,
  renameSimulatorCharacter,
} from '@/shared/models/simulator-user';
import { getUserInfo } from '@/shared/models/user';

export async function PATCH(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUserInfo();
    if (!user) {
      return respErr('no auth, please sign in');
    }

    const { id } = await context.params;
    const body = await req.json();
    const character = await renameSimulatorCharacter({
      userId: user.id,
      characterId: id,
      name: String(body?.name || ''),
    });

    if (!character) {
      return respErr('simulator character not found');
    }

    return respData(character);
  } catch (error) {
    console.error('failed to rename simulator character:', error);
    return respErr(
      error instanceof Error ? error.message : 'failed to rename simulator character'
    );
  }
}

export async function DELETE(
  _req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUserInfo();
    if (!user) {
      return respErr('no auth, please sign in');
    }

    const { id } = await context.params;
    const result = await deleteSimulatorCharacter({
      userId: user.id,
      characterId: id,
    });

    if (!result) {
      return respErr('simulator character not found');
    }

    return respData(result);
  } catch (error) {
    console.error('failed to delete simulator character:', error);
    return respErr(
      error instanceof Error ? error.message : 'failed to delete simulator character'
    );
  }
}
