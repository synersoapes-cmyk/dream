'use client';

import { useMemo, useState } from 'react';

import { Button } from '@/shared/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/shared/components/ui/card';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select';
import { Textarea } from '@/shared/components/ui/textarea';
import type {
  SimulatorSeedBattleContext,
  SimulatorSeedCharacterMeta,
  SimulatorSeedCultivation,
  SimulatorSeedEquipment,
  SimulatorSeedEquipmentAttr,
  SimulatorSeedProfile,
  SimulatorSeedSkill,
} from '@/shared/models/simulator-template';

type EditorProps = {
  canEdit?: boolean;
  initialConfig: {
    characterMeta: string;
    profile: string;
    skills: string;
    cultivations: string;
    equipments: string;
    battleContext: string;
  };
};

type EquipmentScalarKey =
  | 'slot'
  | 'snapshotSlot'
  | 'name'
  | 'quality'
  | 'level'
  | 'price'
  | 'refineLevel';

type EquipmentAttrScalarKey = 'attrType' | 'attrValue' | 'attrGroup';

const EMPTY_CHARACTER_META: SimulatorSeedCharacterMeta = {
  roleType: '',
  race: '',
  serverName: '',
  snapshotName: '',
  snapshotNotes: '',
};

const EMPTY_PROFILE: SimulatorSeedProfile = {
  school: '',
  level: 0,
  physique: 0,
  magic: 0,
  strength: 0,
  endurance: 0,
  agility: 0,
  potentialPoints: 0,
  hp: 0,
  mp: 0,
  damage: 0,
  defense: 0,
  magicDamage: 0,
  magicDefense: 0,
  speed: 0,
  hit: 0,
  sealHit: 0,
  rawBodyJson: '{}',
};

const EMPTY_SKILL: SimulatorSeedSkill = {
  skillCode: '',
  skillName: '',
  baseLevel: 0,
  extraLevel: 0,
  finalLevel: 0,
};

const EMPTY_CULTIVATION: SimulatorSeedCultivation = {
  cultivationType: 'physicalAttack',
  level: 0,
};

const EMPTY_EQUIPMENT_ATTR: SimulatorSeedEquipmentAttr = {
  attrType: '',
  attrValue: 0,
  attrGroup: 'base',
};

const EMPTY_EQUIPMENT: SimulatorSeedEquipment = {
  slot: 'weapon',
  snapshotSlot: 'weapon',
  name: '',
  level: 0,
  quality: '',
  price: 0,
  refineLevel: 0,
  attrs: [],
};

const EMPTY_BATTLE_CONTEXT: SimulatorSeedBattleContext = {
  selfFormation: '天覆阵',
  selfElement: '水',
  formationCounterState: '无克/普通',
  elementRelation: '无克/普通',
  transformCardFactor: 1,
  splitTargetCount: 1,
  shenmuValue: 0,
  magicResult: 0,
  targetName: '默认目标',
  targetLevel: 0,
  targetHp: 0,
  targetDefense: 0,
  targetMagicDefense: 0,
  targetSpeed: 0,
  targetMagicDefenseCultivation: 0,
  targetElement: '',
  targetFormation: '普通阵',
};

const EQUIPMENT_SLOT_OPTIONS: string[] = [
  'weapon',
  'helmet',
  'necklace',
  'armor',
  'belt',
  'shoes',
  'trinket1',
  'trinket2',
  'trinket3',
  'trinket4',
  'jade1',
  'jade2',
];

const ATTR_GROUP_OPTIONS: string[] = ['base', 'extra'];

const CULTIVATION_TYPE_OPTIONS: string[] = [
  'physicalAttack',
  'physicalDefense',
  'magicAttack',
  'magicDefense',
  'petPhysicalAttack',
  'petPhysicalDefense',
  'petMagicAttack',
  'petMagicDefense',
];

const PROFILE_NUMBER_FIELDS: Array<{
  key: keyof SimulatorSeedProfile;
  label: string;
}> = [
  { key: 'level', label: '等级' },
  { key: 'physique', label: '体质' },
  { key: 'magic', label: '魔力' },
  { key: 'strength', label: '力量' },
  { key: 'endurance', label: '耐力' },
  { key: 'agility', label: '敏捷' },
  { key: 'potentialPoints', label: '潜力点' },
  { key: 'hp', label: '气血' },
  { key: 'mp', label: '魔法' },
  { key: 'damage', label: '伤害' },
  { key: 'defense', label: '防御' },
  { key: 'magicDamage', label: '法伤' },
  { key: 'magicDefense', label: '法防' },
  { key: 'speed', label: '速度' },
  { key: 'hit', label: '命中' },
  { key: 'sealHit', label: '封印命中' },
];

const BATTLE_CONTEXT_FIELDS: Array<{
  key: keyof SimulatorSeedBattleContext;
  label: string;
  type?: 'number' | 'text';
}> = [
  { key: 'selfFormation', label: '我方阵法' },
  { key: 'selfElement', label: '我方五行' },
  { key: 'formationCounterState', label: '阵法克制关系' },
  { key: 'elementRelation', label: '五行关系' },
  { key: 'transformCardFactor', label: '变身卡系数', type: 'number' },
  { key: 'splitTargetCount', label: '分灵目标数', type: 'number' },
  { key: 'shenmuValue', label: '神木符数值', type: 'number' },
  { key: 'magicResult', label: '法伤结果', type: 'number' },
  { key: 'targetName', label: '目标名称' },
  { key: 'targetLevel', label: '目标等级', type: 'number' },
  { key: 'targetHp', label: '目标气血', type: 'number' },
  { key: 'targetDefense', label: '目标防御', type: 'number' },
  { key: 'targetMagicDefense', label: '目标法防', type: 'number' },
  { key: 'targetSpeed', label: '目标速度', type: 'number' },
  {
    key: 'targetMagicDefenseCultivation',
    label: '目标法抗修炼',
    type: 'number',
  },
  { key: 'targetElement', label: '目标五行' },
  { key: 'targetFormation', label: '目标阵法' },
];

function parseJson<T>(value: string, fallback: T): T {
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function toNumber(value: string): number {
  return Number(value || 0);
}

function buildFieldId(...parts: Array<string | number>) {
  return parts
    .map((part) => String(part).replace(/[^a-zA-Z0-9_-]+/g, '-'))
    .join('-');
}

export function SimulatorDefaultsEditor({
  canEdit = true,
  initialConfig,
}: EditorProps) {
  const initialCharacterMeta = useMemo(
    () =>
      parseJson<SimulatorSeedCharacterMeta>(
        initialConfig.characterMeta,
        EMPTY_CHARACTER_META
      ),
    [initialConfig.characterMeta]
  );

  const initialProfile = useMemo(
    () => parseJson<SimulatorSeedProfile>(initialConfig.profile, EMPTY_PROFILE),
    [initialConfig.profile]
  );

  const initialSkills = useMemo(
    () => parseJson<SimulatorSeedSkill[]>(initialConfig.skills, []),
    [initialConfig.skills]
  );

  const initialCultivations = useMemo(
    () => parseJson<SimulatorSeedCultivation[]>(initialConfig.cultivations, []),
    [initialConfig.cultivations]
  );

  const initialEquipments = useMemo(
    () => parseJson<SimulatorSeedEquipment[]>(initialConfig.equipments, []),
    [initialConfig.equipments]
  );
  const initialBattleContext = useMemo(
    () =>
      parseJson<SimulatorSeedBattleContext>(
        initialConfig.battleContext,
        EMPTY_BATTLE_CONTEXT
      ),
    [initialConfig.battleContext]
  );

  const [characterMeta, setCharacterMeta] =
    useState<SimulatorSeedCharacterMeta>(initialCharacterMeta);
  const [profile, setProfile] = useState<SimulatorSeedProfile>(initialProfile);
  const [skills, setSkills] = useState<SimulatorSeedSkill[]>(initialSkills);
  const [cultivations, setCultivations] =
    useState<SimulatorSeedCultivation[]>(initialCultivations);
  const [equipments, setEquipments] =
    useState<SimulatorSeedEquipment[]>(initialEquipments);
  const [battleContext, setBattleContext] =
    useState<SimulatorSeedBattleContext>(initialBattleContext);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const isReadOnly = !canEdit;
  const editorLockClass = isReadOnly ? 'pointer-events-none opacity-70' : '';

  const updateProfileNumber = (
    key: keyof SimulatorSeedProfile,
    value: string
  ) => {
    setProfile((current) => ({
      ...current,
      [key]: toNumber(value),
    }));
  };

  const updateSkill = (
    index: number,
    key: keyof SimulatorSeedSkill,
    value: string
  ) => {
    setSkills((current) =>
      current.map((item, itemIndex) =>
        itemIndex === index
          ? {
              ...item,
              [key]:
                key === 'skillCode' || key === 'skillName'
                  ? value
                  : toNumber(value),
            }
          : item
      )
    );
  };

  const updateCultivation = (
    index: number,
    key: keyof SimulatorSeedCultivation,
    value: string
  ) => {
    setCultivations((current) =>
      current.map((item, itemIndex) =>
        itemIndex === index
          ? {
              ...item,
              [key]: key === 'cultivationType' ? value : toNumber(value),
            }
          : item
      )
    );
  };

  const updateEquipment = (
    index: number,
    key: EquipmentScalarKey,
    value: string
  ) => {
    setEquipments((current) =>
      current.map((item, itemIndex) =>
        itemIndex === index
          ? {
              ...item,
              [key]:
                key === 'slot' ||
                key === 'snapshotSlot' ||
                key === 'name' ||
                key === 'quality'
                  ? value
                  : toNumber(value),
            }
          : item
      )
    );
  };

  const updateEquipmentAttr = (
    equipmentIndex: number,
    attrIndex: number,
    key: EquipmentAttrScalarKey,
    value: string
  ) => {
    setEquipments((current) =>
      current.map((item, itemIndex) =>
        itemIndex === equipmentIndex
          ? {
              ...item,
              attrs: item.attrs.map((attr, currentAttrIndex) =>
                currentAttrIndex === attrIndex
                  ? {
                      ...attr,
                      [key]:
                        key === 'attrType' || key === 'attrGroup'
                          ? value
                          : toNumber(value),
                    }
                  : attr
              ),
            }
          : item
      )
    );
  };

  const updateBattleContext = (
    key: keyof SimulatorSeedBattleContext,
    value: string
  ) => {
    setBattleContext((current) => ({
      ...current,
      [key]:
        BATTLE_CONTEXT_FIELDS.find((field) => field.key === key)?.type ===
        'number'
          ? toNumber(value)
          : value,
    }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    setError(null);
    setSuccess(null);

    try {
      for (const item of cultivations) {
        if (!CULTIVATION_TYPE_OPTIONS.includes(item.cultivationType)) {
          throw new Error(`非法修炼类型: ${item.cultivationType || '空值'}`);
        }
        if (item.level < 0) {
          throw new Error(`修炼等级不能为负数: ${item.cultivationType}`);
        }
      }

      for (const item of equipments) {
        if (!EQUIPMENT_SLOT_OPTIONS.includes(item.slot)) {
          throw new Error(`非法装备槽位: ${item.slot || '空值'}`);
        }
        if (!EQUIPMENT_SLOT_OPTIONS.includes(item.snapshotSlot)) {
          throw new Error(`非法快照槽位: ${item.snapshotSlot || '空值'}`);
        }
        if (item.level < 0 || item.price < 0 || item.refineLevel < 0) {
          throw new Error(`装备数值不能为负数: ${item.name || item.slot}`);
        }

        for (const attr of item.attrs) {
          if (!ATTR_GROUP_OPTIONS.includes(attr.attrGroup)) {
            throw new Error(`非法属性分组: ${attr.attrGroup || '空值'}`);
          }
          if (attr.attrValue < 0) {
            throw new Error(
              `属性值不能为负数: ${attr.attrType || '未命名属性'}`
            );
          }
        }
      }

      const response = await fetch('/api/admin/simulator/defaults', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          characterMeta: JSON.stringify(characterMeta, null, 2),
          profile: JSON.stringify(profile, null, 2),
          skills: JSON.stringify(skills, null, 2),
          cultivations: JSON.stringify(cultivations, null, 2),
          equipments: JSON.stringify(equipments, null, 2),
          battleContext: JSON.stringify(battleContext, null, 2),
        }),
      });

      const payload = await response.json();
      if (!response.ok || payload?.code !== 0 || !payload?.data) {
        throw new Error(payload?.message || '保存失败');
      }

      setSkills(
        parseJson<SimulatorSeedSkill[]>(
          payload.data['simulator.default.skills'],
          []
        )
      );
      setCultivations(
        parseJson<SimulatorSeedCultivation[]>(
          payload.data['simulator.default.cultivations'],
          []
        )
      );
      setEquipments(
        parseJson<SimulatorSeedEquipment[]>(
          payload.data['simulator.default.equipments'],
          []
        )
      );
      setBattleContext(
        parseJson<SimulatorSeedBattleContext>(
          payload.data['simulator.default.battle_context'],
          EMPTY_BATTLE_CONTEXT
        )
      );
      setSuccess('默认模板已保存到 D1 config');
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : '保存失败');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {isReadOnly && (
        <Card>
          <CardContent className="text-muted-foreground pt-6 text-sm">
            当前账号只能查看默认模板，保存修改需要后台设置写入权限。
          </CardContent>
        </Card>
      )}
      <Card>
        <CardHeader>
          <CardTitle>默认角色信息</CardTitle>
          <CardDescription>
            这部分决定新用户自动建档时的角色元信息。
          </CardDescription>
        </CardHeader>
        <CardContent className={`grid gap-4 md:grid-cols-2 ${editorLockClass}`}>
          <div className="space-y-2">
            <Label htmlFor="roleType">职业类型</Label>
            <Input
              id="roleType"
              value={characterMeta.roleType}
              onChange={(e) =>
                setCharacterMeta((current) => ({
                  ...current,
                  roleType: e.target.value,
                }))
              }
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="race">种族</Label>
            <Input
              id="race"
              value={characterMeta.race}
              onChange={(e) =>
                setCharacterMeta((current) => ({
                  ...current,
                  race: e.target.value,
                }))
              }
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="serverName">服务器名</Label>
            <Input
              id="serverName"
              value={characterMeta.serverName}
              onChange={(e) =>
                setCharacterMeta((current) => ({
                  ...current,
                  serverName: e.target.value,
                }))
              }
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="snapshotName">默认快照名</Label>
            <Input
              id="snapshotName"
              value={characterMeta.snapshotName}
              onChange={(e) =>
                setCharacterMeta((current) => ({
                  ...current,
                  snapshotName: e.target.value,
                }))
              }
            />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="snapshotNotes">默认快照备注</Label>
            <Textarea
              id="snapshotNotes"
              rows={4}
              value={characterMeta.snapshotNotes}
              onChange={(e) =>
                setCharacterMeta((current) => ({
                  ...current,
                  snapshotNotes: e.target.value,
                }))
              }
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>默认基础属性</CardTitle>
          <CardDescription>
            这里是新角色首次生成时使用的面板和加点默认值。
          </CardDescription>
        </CardHeader>
        <CardContent className={`grid gap-4 md:grid-cols-4 ${editorLockClass}`}>
          <div className="space-y-2">
            <Label htmlFor="school">门派</Label>
            <Input
              id="school"
              value={profile.school}
              onChange={(e) =>
                setProfile((current) => ({
                  ...current,
                  school: e.target.value,
                }))
              }
            />
          </div>
          {PROFILE_NUMBER_FIELDS.map((field) => (
            <div key={field.key} className="space-y-2">
              <Label htmlFor={field.key}>{field.label}</Label>
              <Input
                id={field.key}
                type="number"
                value={profile[field.key] as number}
                onChange={(e) => updateProfileNumber(field.key, e.target.value)}
              />
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>默认技能</CardTitle>
          <CardDescription>
            逐行维护新角色默认技能，保存后会用于后续新用户。
          </CardDescription>
        </CardHeader>
        <CardContent className={`space-y-4 ${editorLockClass}`}>
          {skills.map((skill, index) => {
            const skillFieldId = (field: string) =>
              buildFieldId('simulator-defaults-skill', index, field);

            return (
              <div
                key={`${skill.skillCode}-${index}`}
                className="grid gap-3 rounded-lg border p-4 md:grid-cols-5"
              >
                <div className="space-y-2">
                  <Label htmlFor={skillFieldId('code')}>技能代码</Label>
                  <Input
                    id={skillFieldId('code')}
                    name={skillFieldId('code')}
                    value={skill.skillCode}
                    onChange={(e) =>
                      updateSkill(index, 'skillCode', e.target.value)
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor={skillFieldId('name')}>技能名称</Label>
                  <Input
                    id={skillFieldId('name')}
                    name={skillFieldId('name')}
                    value={skill.skillName}
                    onChange={(e) =>
                      updateSkill(index, 'skillName', e.target.value)
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor={skillFieldId('base-level')}>基础等级</Label>
                  <Input
                    id={skillFieldId('base-level')}
                    name={skillFieldId('base-level')}
                    type="number"
                    value={skill.baseLevel}
                    onChange={(e) =>
                      updateSkill(index, 'baseLevel', e.target.value)
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor={skillFieldId('extra-level')}>额外等级</Label>
                  <Input
                    id={skillFieldId('extra-level')}
                    name={skillFieldId('extra-level')}
                    type="number"
                    value={skill.extraLevel}
                    onChange={(e) =>
                      updateSkill(index, 'extraLevel', e.target.value)
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor={skillFieldId('final-level')}>最终等级</Label>
                  <div className="flex gap-2">
                    <Input
                      id={skillFieldId('final-level')}
                      name={skillFieldId('final-level')}
                      type="number"
                      value={skill.finalLevel}
                      onChange={(e) =>
                        updateSkill(index, 'finalLevel', e.target.value)
                      }
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() =>
                        setSkills((current) =>
                          current.filter((_, itemIndex) => itemIndex !== index)
                        )
                      }
                    >
                      删除
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
          <Button
            type="button"
            variant="outline"
            onClick={() =>
              setSkills((current) => [...current, { ...EMPTY_SKILL }])
            }
          >
            新增技能
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>默认修炼</CardTitle>
          <CardDescription>
            这里也改成了可增删行编辑，后续扩字段会更轻松。
          </CardDescription>
        </CardHeader>
        <CardContent className={`space-y-4 ${editorLockClass}`}>
          {cultivations.map((cultivation, index) => {
            const cultivationTypeLabelId = buildFieldId(
              'simulator-defaults-cultivation',
              index,
              'type-label'
            );
            const cultivationTypeId = buildFieldId(
              'simulator-defaults-cultivation',
              index,
              'type'
            );
            const cultivationLevelId = buildFieldId(
              'simulator-defaults-cultivation',
              index,
              'level'
            );

            return (
              <div
                key={`${cultivation.cultivationType}-${index}`}
                className="grid gap-3 rounded-lg border p-4 md:grid-cols-[2fr_1fr_auto]"
              >
                <div className="space-y-2">
                  <Label id={cultivationTypeLabelId}>修炼类型</Label>
                  <Select
                    value={cultivation.cultivationType}
                    onValueChange={(value) =>
                      updateCultivation(index, 'cultivationType', value)
                    }
                  >
                    <SelectTrigger
                      id={cultivationTypeId}
                      aria-labelledby={cultivationTypeLabelId}
                      className="w-full"
                    >
                      <SelectValue placeholder="选择修炼类型" />
                    </SelectTrigger>
                    <SelectContent>
                      {CULTIVATION_TYPE_OPTIONS.map((option) => (
                        <SelectItem key={option} value={option}>
                          {option}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor={cultivationLevelId}>等级</Label>
                  <Input
                    id={cultivationLevelId}
                    name={cultivationLevelId}
                    type="number"
                    value={cultivation.level}
                    onChange={(e) =>
                      updateCultivation(index, 'level', e.target.value)
                    }
                  />
                </div>
                <div className="flex items-end">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() =>
                      setCultivations((current) =>
                        current.filter((_, itemIndex) => itemIndex !== index)
                      )
                    }
                  >
                    删除
                  </Button>
                </div>
              </div>
            );
          })}
          <Button
            type="button"
            variant="outline"
            onClick={() =>
              setCultivations((current) => [
                ...current,
                { ...EMPTY_CULTIVATION },
              ])
            }
          >
            新增修炼
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>默认装备</CardTitle>
          <CardDescription>
            这里已经改成按装备逐条编辑，装备属性也支持增删行。
          </CardDescription>
        </CardHeader>
        <CardContent className={`space-y-4 ${editorLockClass}`}>
          {equipments.map((equipment, index) => {
            const equipmentFieldId = (...parts: Array<string | number>) =>
              buildFieldId('simulator-defaults-equipment', index, ...parts);
            const slotLabelId = equipmentFieldId('slot-label');
            const snapshotSlotLabelId = equipmentFieldId('snapshot-slot-label');

            return (
              <div
                key={`${equipment.slot}-${index}`}
                className="space-y-4 rounded-lg border p-4"
              >
                <div className="grid gap-3 md:grid-cols-4">
                  <div className="space-y-2">
                    <Label id={slotLabelId}>槽位</Label>
                    <Select
                      value={equipment.slot}
                      onValueChange={(value) =>
                        updateEquipment(index, 'slot', value)
                      }
                    >
                      <SelectTrigger
                        id={equipmentFieldId('slot')}
                        aria-labelledby={slotLabelId}
                        className="w-full"
                      >
                        <SelectValue placeholder="选择槽位" />
                      </SelectTrigger>
                      <SelectContent>
                        {EQUIPMENT_SLOT_OPTIONS.map((option) => (
                          <SelectItem key={option} value={option}>
                            {option}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label id={snapshotSlotLabelId}>快照槽位</Label>
                    <Select
                      value={equipment.snapshotSlot}
                      onValueChange={(value) =>
                        updateEquipment(index, 'snapshotSlot', value)
                      }
                    >
                      <SelectTrigger
                        id={equipmentFieldId('snapshot-slot')}
                        aria-labelledby={snapshotSlotLabelId}
                        className="w-full"
                      >
                        <SelectValue placeholder="选择快照槽位" />
                      </SelectTrigger>
                      <SelectContent>
                        {EQUIPMENT_SLOT_OPTIONS.map((option) => (
                          <SelectItem key={option} value={option}>
                            {option}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={equipmentFieldId('name')}>名称</Label>
                    <Input
                      id={equipmentFieldId('name')}
                      name={equipmentFieldId('name')}
                      value={equipment.name}
                      onChange={(e) =>
                        updateEquipment(index, 'name', e.target.value)
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={equipmentFieldId('quality')}>品质</Label>
                    <Input
                      id={equipmentFieldId('quality')}
                      name={equipmentFieldId('quality')}
                      value={equipment.quality}
                      onChange={(e) =>
                        updateEquipment(index, 'quality', e.target.value)
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={equipmentFieldId('level')}>等级</Label>
                    <Input
                      id={equipmentFieldId('level')}
                      name={equipmentFieldId('level')}
                      type="number"
                      value={equipment.level}
                      onChange={(e) =>
                        updateEquipment(index, 'level', e.target.value)
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={equipmentFieldId('price')}>价格</Label>
                    <Input
                      id={equipmentFieldId('price')}
                      name={equipmentFieldId('price')}
                      type="number"
                      value={equipment.price}
                      onChange={(e) =>
                        updateEquipment(index, 'price', e.target.value)
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={equipmentFieldId('refine-level')}>
                      精炼等级
                    </Label>
                    <Input
                      id={equipmentFieldId('refine-level')}
                      name={equipmentFieldId('refine-level')}
                      type="number"
                      value={equipment.refineLevel}
                      onChange={(e) =>
                        updateEquipment(index, 'refineLevel', e.target.value)
                      }
                    />
                  </div>
                  <div className="flex items-end">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() =>
                        setEquipments((current) =>
                          current.filter((_, itemIndex) => itemIndex !== index)
                        )
                      }
                    >
                      删除
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>属性项</Label>
                  <div className="space-y-3">
                    {equipment.attrs.map((attr, attrIndex) => {
                      const attrFieldId = (...parts: Array<string | number>) =>
                        equipmentFieldId('attr', attrIndex, ...parts);
                      const attrGroupLabelId = attrFieldId('group-label');

                      return (
                        <div
                          key={`${attr.attrType}-${attrIndex}`}
                          className="grid gap-3 rounded-md border p-3 md:grid-cols-[2fr_1fr_1fr_auto]"
                        >
                          <div className="space-y-2">
                            <Label htmlFor={attrFieldId('type')}>
                              属性类型
                            </Label>
                            <Input
                              id={attrFieldId('type')}
                              name={attrFieldId('type')}
                              value={attr.attrType}
                              onChange={(e) =>
                                updateEquipmentAttr(
                                  index,
                                  attrIndex,
                                  'attrType',
                                  e.target.value
                                )
                              }
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor={attrFieldId('value')}>属性值</Label>
                            <Input
                              id={attrFieldId('value')}
                              name={attrFieldId('value')}
                              type="number"
                              value={attr.attrValue}
                              onChange={(e) =>
                                updateEquipmentAttr(
                                  index,
                                  attrIndex,
                                  'attrValue',
                                  e.target.value
                                )
                              }
                            />
                          </div>
                          <div className="space-y-2">
                            <Label id={attrGroupLabelId}>分组</Label>
                            <Select
                              value={attr.attrGroup}
                              onValueChange={(value) =>
                                updateEquipmentAttr(
                                  index,
                                  attrIndex,
                                  'attrGroup',
                                  value
                                )
                              }
                            >
                              <SelectTrigger
                                id={attrFieldId('group')}
                                aria-labelledby={attrGroupLabelId}
                                className="w-full"
                              >
                                <SelectValue placeholder="选择分组" />
                              </SelectTrigger>
                              <SelectContent>
                                {ATTR_GROUP_OPTIONS.map((option) => (
                                  <SelectItem key={option} value={option}>
                                    {option}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="flex items-end">
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() =>
                                setEquipments((current) =>
                                  current.map((item, itemIndex) =>
                                    itemIndex === index
                                      ? {
                                          ...item,
                                          attrs: item.attrs.filter(
                                            (_, currentAttrIndex) =>
                                              currentAttrIndex !== attrIndex
                                          ),
                                        }
                                      : item
                                  )
                                )
                              }
                            >
                              删除属性
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() =>
                        setEquipments((current) =>
                          current.map((item, itemIndex) =>
                            itemIndex === index
                              ? {
                                  ...item,
                                  attrs: [
                                    ...item.attrs,
                                    { ...EMPTY_EQUIPMENT_ATTR },
                                  ],
                                }
                              : item
                          )
                        )
                      }
                    >
                      新增属性
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
          <Button
            type="button"
            variant="outline"
            onClick={() =>
              setEquipments((current) => [...current, { ...EMPTY_EQUIPMENT }])
            }
          >
            新增装备
          </Button>
        </CardContent>
        <CardFooter className="justify-between">
          <div className="text-muted-foreground text-sm">
            只影响后续新建档案，不会覆盖已有用户角色数据。
          </div>
          <div className="flex items-center gap-3">
            {error && <span className="text-sm text-red-500">{error}</span>}
            {!error && success && (
              <span className="text-sm text-emerald-600">{success}</span>
            )}
            <Button onClick={handleSave} disabled={isSaving || isReadOnly}>
              {isSaving ? '保存中...' : '保存模板'}
            </Button>
          </div>
        </CardFooter>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>默认战斗参数</CardTitle>
          <CardDescription>
            这部分用于新用户首次进入实验室时的战斗环境基线。
          </CardDescription>
        </CardHeader>
        <CardContent className={`grid gap-4 md:grid-cols-4 ${editorLockClass}`}>
          {BATTLE_CONTEXT_FIELDS.map((field) => (
            <div
              key={field.key}
              className={
                field.key === 'targetName'
                  ? 'space-y-2 md:col-span-2'
                  : 'space-y-2'
              }
            >
              <Label htmlFor={field.key}>{field.label}</Label>
              <Input
                id={field.key}
                type={field.type === 'number' ? 'number' : 'text'}
                value={String(battleContext[field.key] ?? '')}
                onChange={(e) => updateBattleContext(field.key, e.target.value)}
              />
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
