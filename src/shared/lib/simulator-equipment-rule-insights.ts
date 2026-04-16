import type { Equipment } from '@/features/simulator/store/gameTypes';
import {
  findRuneComboDefinitionByName,
  getRuneComboTierLabel,
  resolveRuneComboActivation,
  analyzeRuneComboConflict,
} from '@/shared/lib/simulator-rune-combo';
import {
  buildActiveRegularSetSummaries,
  type RegularSetRuntimeRule,
} from '@/shared/lib/simulator-regular-set';
import {
  findSimulatorSlotDefinition,
  getSimulatorSlotLabel,
} from '@/shared/lib/simulator-slot-config';

export type EquipmentRuleInsight = {
  id: string;
  title: string;
  tone: 'success' | 'warning' | 'neutral';
  summary: string;
  details: string[];
};

type BuildEquipmentRuleInsightOptions = {
  allEquipment?: Equipment[];
  regularSetRules?: RegularSetRuntimeRule[];
};

function getSlotLabel(type: Equipment['type'], slot?: number) {
  const definition = findSimulatorSlotDefinition(type, slot);
  return definition ? getSimulatorSlotLabel(definition) : type;
}

function getAllowedSlotLabels(equipmentTypes: Equipment['type'][]) {
  return equipmentTypes.map((type) => getSlotLabel(type)).join(' / ');
}

function formatRuneColors(colors: string[]) {
  return colors.length > 0 ? colors.join(' / ') : '未配置';
}

export function buildEquipmentRuleInsights(
  equipment: Equipment,
  options: BuildEquipmentRuleInsightOptions = {}
): EquipmentRuleInsight[] {
  const insights: EquipmentRuleInsight[] = [];

  const activation = resolveRuneComboActivation(equipment);
  const conflict = analyzeRuneComboConflict(equipment);
  const comboDefinition = findRuneComboDefinitionByName(activation.setName);
  const hasRuneContext =
    Boolean(activation.normalizedSetName) ||
    (equipment.runeStoneSets?.some((set) => set.length > 0) ?? false) ||
    Number(equipment.luckyHoles ?? 0) > 0;

  if (hasRuneContext) {
    const slotLabel = getSlotLabel(equipment.type, equipment.slot);
    const details = [
      `当前部位：${slotLabel}`,
      `当前孔数：${equipment.luckyHoles || '0'}`,
      `当前颜色：${formatRuneColors(activation.activeColors)}`,
    ];

    if (comboDefinition) {
      details.push(`允许部位：${getAllowedSlotLabels(comboDefinition.allowedSlots)}`);
    }

    if (conflict?.matchedTier) {
      details.push(`当前按 ${getRuneComboTierLabel(conflict.matchedTier)} 计算`);
    } else if (activation.matchedTier) {
      details.push(`当前按 ${getRuneComboTierLabel(activation.matchedTier)} 生效`);
    }

    let tone: EquipmentRuleInsight['tone'] = 'neutral';
    let summary = '当前还没有形成可判定的符石组合。';

    if (conflict?.reason === 'hole_capacity_conflict') {
      tone = 'warning';
      summary = conflict.message;
    } else if (activation.reason === 'activated') {
      tone = 'success';
      summary = activation.matchedTier
        ? `${activation.normalizedSetName} 已生效，当前按 ${getRuneComboTierLabel(
            activation.matchedTier
          )} 计算。`
        : `${activation.normalizedSetName || '当前组合'} 已记录，当前按组合名称保留。`;
    } else if (activation.reason === 'slot_invalid') {
      tone = 'warning';
      summary = `${activation.normalizedSetName || '当前组合'} 部位不对，当前不会激活，只按单颗符石属性计算。`;
    } else if (activation.reason === 'color_invalid') {
      tone = 'warning';
      summary = `${activation.normalizedSetName || '当前组合'} 颜色或顺序不匹配，当前判定为未激活。`;
    }

    if (conflict && conflict.reason !== 'hole_capacity_conflict') {
      details.push(conflict.message);
    }

    insights.push({
      id: 'rune-combo',
      title: '符石组合判定',
      tone,
      summary,
      details,
    });
  }

  if (equipment.runeSetEffect) {
    insights.push({
      id: 'rune-set-effect',
      title: '符石套装效果',
      tone: 'neutral',
      summary: `当前配置了符石套装效果「${equipment.runeSetEffect}」。`,
      details: ['该效果当前作为结构化字段保留，后续会继续补充更完整的成因说明。'],
    });
  }

  if (equipment.starAlignment || equipment.starAlignmentConfig) {
    insights.push({
      id: 'star-alignment',
      title: '星相互合判定',
      tone: equipment.starAlignmentConfig ? 'success' : 'neutral',
      summary: equipment.starAlignmentConfig
        ? `${equipment.starAlignmentConfig.comboName || equipment.starAlignment || '当前互合'} 已挂载。`
        : `当前已记录星相互合「${equipment.starAlignment}」。`,
      details: [
        equipment.starAlignmentConfig?.colors?.length
          ? `需求颜色：${equipment.starAlignmentConfig.colors.join(' / ')}`
          : '需求颜色：待补充',
        equipment.starAlignmentConfig?.attrType
          ? `加成效果：${equipment.starAlignmentConfig.attrType} +${equipment.starAlignmentConfig.attrValue}`
          : '加成效果：待补充',
        '六件都满足时，才会继续触发全基础属性 +2 的全套加成。',
      ],
    });
  }

  if (equipment.setName) {
    const currentEquipment = options.allEquipment ?? [];
    const countedPrimaryEquipment =
      currentEquipment.length > 0
        ? currentEquipment
        : [equipment];
    const activeSet = buildActiveRegularSetSummaries(
      countedPrimaryEquipment.map((item) => ({
        slot: item.type,
        setName: item.setName,
      })),
      options.regularSetRules
    ).find((item) => item.setName === equipment.setName);

    if (currentEquipment.length > 0) {
      const sameSetCount = countedPrimaryEquipment.filter(
        (item) => item.setName === equipment.setName
      ).length;
      const nextTarget = sameSetCount < 3 ? 3 : sameSetCount < 5 ? 5 : null;

      insights.push({
        id: 'regular-set',
        title: '常规套装判定',
        tone: activeSet ? 'success' : 'neutral',
        summary: activeSet
          ? `${equipment.setName} 当前已穿 ${sameSetCount} 件，按 ${activeSet.tier} 件效果生效。`
          : `${equipment.setName} 当前已穿 ${sameSetCount} 件，暂未命中套装阶梯。`,
        details: [
          nextTarget
            ? `距离下一档还差 ${Math.max(0, nextTarget - sameSetCount)} 件`
            : '当前已达到已配置的最高阶梯',
          activeSet && activeSet.effects.length > 0
            ? `当前效果：${activeSet.effects
                .map((effect) => `${effect.targetKey === 'magic' ? '魔力' : effect.targetKey} +${effect.value}`)
                .join(' / ')}`
            : '当前效果：未触发',
        ],
      });
    } else {
      insights.push({
        id: 'regular-set',
        title: '常规套装记录',
        tone: 'neutral',
        summary: `当前已挂载常规套装「${equipment.setName}」。`,
        details: ['实验室详情当前是单件预览，套装件数要在挂载到整套后才能准确判断。'],
      });
    }
  }

  return insights;
}
