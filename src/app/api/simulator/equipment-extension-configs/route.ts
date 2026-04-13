import { respData, respErr } from '@/shared/lib/resp';
import { getDamageRuleSet } from '@/shared/models/damage-rules';
import { getUserInfo } from '@/shared/models/user';

export async function GET(req: Request) {
  try {
    const user = await getUserInfo();
    if (!user) {
      return respErr('no auth, please sign in');
    }

    const { searchParams } = new URL(req.url);
    const keys = searchParams
      .getAll('keys')
      .map((item) => item.trim())
      .filter(Boolean);
    const ruleSet = await getDamageRuleSet();

    if (!ruleSet) {
      return respData([]);
    }

    const filtered =
      keys.length > 0
        ? ruleSet.equipmentExtensionConfigs.filter((item) =>
            keys.includes(item.configKey)
          )
        : ruleSet.equipmentExtensionConfigs;

    return respData(
      filtered.map((item) => ({
        configKey: item.configKey,
        value: item.value,
        enabled: item.enabled,
      }))
    );
  } catch (error) {
    console.error('failed to load simulator equipment extension configs:', error);
    return respErr('failed to load simulator equipment extension configs');
  }
}
