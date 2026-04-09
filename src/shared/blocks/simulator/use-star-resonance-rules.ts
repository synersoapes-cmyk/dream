'use client';

import { useEffect, useMemo, useState } from 'react';

import type { AdminSimulatorStarResonanceRuleItem } from '@/shared/models/simulator-types';

type StarResonanceOption = {
  id: string;
  value: string;
  title: string;
  description: string;
  colors: string[];
  attrType: string;
  attrValue: number;
};

const PRIMARY_SLOTS = new Set(['weapon', 'helmet', 'necklace', 'armor', 'belt', 'shoes']);

function buildRuleLabel(rule: AdminSimulatorStarResonanceRuleItem) {
  const attrLabelMap: Record<string, string> = {
    physique: '体质',
    magic: '魔力',
    strength: '力量',
    endurance: '耐力',
    agility: '敏捷',
    hp: '气血',
    speed: '速度',
    magicDamage: '法术伤害',
    magicDefense: '法术防御',
    defense: '防御',
    hit: '命中',
    dodge: '躲避',
    spirit: '灵力',
    allAttributes: '全属性',
  };

  const attrType = String(rule.bonusAttrType || '').trim();
  const label = attrLabelMap[attrType] ?? attrType;
  return attrType ? `${label} +${rule.bonusAttrValue}` : '无';
}

function buildRuleDescription(rule: AdminSimulatorStarResonanceRuleItem) {
  const colors = rule.requiredColors.join(' / ');
  const globalBonus = typeof rule.globalBonus?.fullSetAttributeBonus === 'number'
    ? `六件全套 +${rule.globalBonus.fullSetAttributeBonus}`
    : '六件全套未配置';

  return `${rule.slot} · ${colors || '未配置颜色'} · ${globalBonus}`;
}

export function useSimulatorStarResonanceRules(slot?: string) {
  const [rules, setRules] = useState<AdminSimulatorStarResonanceRuleItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!slot || !PRIMARY_SLOTS.has(slot)) {
      setRules([]);
      return;
    }

    let cancelled = false;
    const load = async () => {
      setIsLoading(true);
      try {
        const response = await fetch(
          `/api/simulator/star-resonance-rules?slot=${encodeURIComponent(slot)}`,
          {
            method: 'GET',
            cache: 'no-store',
          }
        );
        const payload = await response.json();
        if (!response.ok || payload?.code !== 0 || !Array.isArray(payload?.data)) {
          throw new Error(payload?.message || 'failed to load star resonance rules');
        }
        if (!cancelled) {
          setRules(payload.data);
        }
      } catch (error) {
        console.error('Failed to load simulator star resonance rules:', error);
        if (!cancelled) {
          setRules([]);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [slot]);

  const options = useMemo<StarResonanceOption[]>(() => {
    const baseOption: StarResonanceOption = {
      id: 'none',
      value: '无',
      title: '无',
      description: '不设置星相互合奖励',
      colors: [],
      attrType: '',
      attrValue: 0,
    };

    return [
      baseOption,
      ...rules.map((rule) => ({
        id: rule.id,
        value: buildRuleLabel(rule),
        title: rule.comboName,
        description: buildRuleDescription(rule),
        colors: rule.requiredColors,
        attrType: rule.bonusAttrType,
        attrValue: rule.bonusAttrValue,
      })),
    ];
  }, [rules]);

  return {
    rules,
    options,
    isLoading,
    isPrimarySlot: Boolean(slot && PRIMARY_SLOTS.has(slot)),
  };
}
