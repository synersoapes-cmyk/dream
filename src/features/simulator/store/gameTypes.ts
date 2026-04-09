import type { SimulatorEquipmentType } from '@/shared/lib/simulator-equipment';
import type {
  SimulatorElement,
  SimulatorSchool,
} from '@/shared/models/simulator-domain';

export type Faction = SimulatorSchool;
export type EquipmentType = SimulatorEquipmentType;
export type CharacterStatMap = Partial<CombatStats & BaseAttributes>;

export interface BaseAttributes {
  level: number;
  hp: number;
  magic: number;
  physique: number;
  magicPower: number;
  strength: number;
  endurance: number;
  agility: number;
  faction: Faction;
}

export interface CombatStats {
  hp: number;
  magic: number;
  hit: number;
  damage: number;
  magicDamage: number;
  defense: number;
  magicDefense: number;
  speed: number;
  dodge: number;
  sealHit?: number;
  spiritualPower?: number;
  magicCritLevel?: number;
  fixedDamage?: number;
  pierceLevel?: number;
  elementalMastery?: number;
  block?: number;
  antiCritLevel?: number;
  sealResistLevel?: number;
  elementalResistance?: number;
}

export interface RuneStone {
  id: string;
  name?: string;
  type:
    | 'red'
    | 'blue'
    | 'yellow'
    | 'green'
    | 'purple'
    | 'black'
    | 'white'
    | 'orange'
    | string;
  level?: number;
  quality?: string;
  description?: string;
  price?: number;
  stats: CharacterStatMap;
}

export interface EquipmentEffectModifier {
  code: 'spell_ignore_percent' | 'spell_damage_percent' | (string & {});
  value: number;
  label?: string;
  source?: string;
}

export interface StarPositionConfig {
  id: string;
  label: string;
  attrType: string;
  attrValue: number;
  starType?: string;
  color?: string;
  yinYangState?: string;
}

export interface StarAlignmentConfig {
  id: string;
  label: string;
  attrType: string;
  attrValue: number;
  comboName?: string;
  colors?: string[];
}

export interface Equipment {
  id: string;
  name: string;
  type: EquipmentType;
  slot?: number;
  setName?: string;
  mainStat: string;
  extraStat?: string;
  highlights?: string[];
  effectModifiers?: EquipmentEffectModifier[];
  baseStats: CharacterStatMap;
  stats: CharacterStatMap;
  price?: number;
  crossServerFee?: number;
  imageUrl?: string;
  runeStoneSets?: RuneStone[][];
  runeStoneSetsNames?: string[];
  activeRuneStoneSet?: number;
  runeSetEffect?: string;
  description?: string;
  equippableRoles?: string;
  level?: number;
  element?: string;
  durability?: number;
  forgeLevel?: number;
  gemstone?: string;
  luckyHoles?: string;
  starPosition?: string;
  starPositionConfig?: StarPositionConfig;
  starAlignment?: string;
  starAlignmentConfig?: StarAlignmentConfig;
  factionRequirement?: string;
  positionRequirement?: string;
  specialEffect?: string;
  manufacturer?: string;
  refinementEffect?: string;
  quality?: string;
}

export type PreviewEquipment = Omit<Equipment, 'slot'> & {
  isReplacing?: string;
  slot: Equipment['type'] | number;
};

export interface EquipmentSet {
  id: string;
  name: string;
  items: Equipment[];
  isActive?: boolean;
}

export interface Skill {
  name: string;
  level: number;
  type: 'physical' | 'magic' | 'heal' | 'seal' | 'buff';
  targets: number;
  baseDamage?: number;
  manaCost?: number;
  description?: string;
}

export interface Cultivation {
  physicalAttack: number;
  physicalDefense: number;
  magicAttack: number;
  magicDefense: number;
  petPhysicalAttack: number;
  petPhysicalDefense: number;
  petMagicAttack: number;
  petMagicDefense: number;
}

export interface HistorySnapshotState {
  baseAttributes: BaseAttributes;
  combatStats: CombatStats;
  equipment: Equipment[];
  cultivation: Cultivation;
  combatTarget: CombatTarget;
}

export interface HistorySnapshot {
  id: string;
  timestamp: number;
  name: string;
  type:
    | 'base'
    | 'combat'
    | 'equipment'
    | 'cultivation'
    | 'target'
    | 'formation'
    | 'auto';
  changes: {
    label: string;
    oldValue: unknown;
    newValue: unknown;
  }[];
  damageChange?: {
    physical: number;
    magic: number;
    skill: number;
  };
  state: Partial<HistorySnapshotState>;
}

export interface DamageResult {
  physical?: number;
  magic?: number;
  skill?: number;
  total?: number;
  targetName?: string;
  timestamp?: number;
  [key: string]: unknown;
}

export interface CombatTarget {
  templateId?: string;
  name: string;
  level: number;
  hp: number;
  defense: number;
  magicDefense: number;
  speed?: number;
  faction?: Faction;
  isBoss?: boolean;
  dungeonName?: string;
  element?: SimulatorElement;
  formation?: string;
}

export interface EnemyTarget {
  id: string;
  name: string;
  element: SimulatorElement;
  formation: string;
  magicDamage: number;
  spiritualPower: number;
  magicCritLevel: number;
  speed: number;
  hit: number;
  fixedDamage: number;
  pierceLevel: number;
  elementalMastery: number;
  hp: number;
  magicDefense: number;
  defense: number;
  block: number;
  antiCritLevel: number;
  sealResistLevel: number;
  dodge: number;
  elementalResistance: number;
}

export interface DungeonTarget extends CombatTarget {
  id: string;
  description?: string;
}

export interface Dungeon {
  id: string;
  name: string;
  level: number;
  difficulty: 'easy' | 'normal' | 'hard' | 'nightmare';
  description: string;
  targets: DungeonTarget[];
}

export interface PlayerSetup {
  level: number;
  faction: Faction;
  baseStats: BaseAttributes;
  equipment: Equipment[];
  skills: Skill[];
  cultivation: Cultivation;
  element: SimulatorElement;
  formation: string;
}

export interface OcrLog {
  id: string;
  timestamp: number;
  type: 'success' | 'error' | 'info';
  message: string;
  details?: string;
  imagePreview?: string;
  rawText?: string;
  parsedData?: unknown;
}

export interface Treasure {
  id: string;
  name: string;
  type: '法宝';
  level: number;
  tier: 1 | 2 | 3 | 4;
  stats: Partial<CombatStats>;
  description: string;
  isActive: boolean;
}

export interface ExperimentSeat {
  id: string;
  name: string;
  isSample: boolean;
  equipment: Equipment[];
}

export interface PendingEquipment {
  id: string;
  equipment: Equipment;
  timestamp: number;
  imagePreview?: string;
  rawText?: string;
  targetSetId?: string;
  targetEquipmentId?: string;
  targetRuneStoneSetIndex?: number;
  status: 'pending' | 'confirmed' | 'replaced';
}

export interface CurrentCharacter {
  id: string;
  name: string;
  school: Faction;
  level: number;
}

export interface SyncedCloudState {
  currentCharacter: CurrentCharacter | null;
  baseAttributes: BaseAttributes;
  combatStats: CombatStats;
  equipment: Equipment[];
  equipmentSets: EquipmentSet[];
  activeSetIndex: number;
  skills: Skill[];
  cultivation: Cultivation;
  treasure: Treasure | null;
  combatTarget: CombatTarget;
  formation: string;
  playerSetup: PlayerSetup;
}

export interface GameState {
  currentCharacter: CurrentCharacter | null;
  baseAttributes: BaseAttributes;
  combatStats: CombatStats;
  equipment: Equipment[];
  equipmentSets: EquipmentSet[];
  activeSetIndex: number;
  skills: Skill[];
  cultivation: Cultivation;
  treasure: Treasure | null;
  combatTarget: CombatTarget;
  manualTargets: EnemyTarget[];
  selectedSkill: Skill | null;
  playerSetup: PlayerSetup;
  combatTab: 'manual' | 'dungeon';
  selectedDungeonIds: string[];
  setCombatTab: (tab: 'manual' | 'dungeon') => void;
  setSelectedDungeonIds: (ids: string[]) => void;
  updateCombatTarget: (target: Partial<CombatTarget>) => void;
  addManualTarget: () => void;
  removeManualTarget: (id: string) => void;
  updateManualTarget: (id: string, updates: Partial<EnemyTarget>) => void;
  selectSkill: (skill: Skill | null) => void;
  syncedCloudState: SyncedCloudState | null;
  autoRecalculateDerivedStats: boolean;
  setAutoRecalculateDerivedStats: (
    enabled: boolean,
    options?: { restoreCloudState?: boolean }
  ) => void;
  previewMode: boolean;
  previewEquipment: {
    current: Equipment | null;
    new: Equipment;
  } | null;
  enterPreviewMode: (
    current: Equipment | null,
    newEquip: Equipment,
    type: Equipment['type']
  ) => void;
  exitPreviewMode: () => void;
  confirmReplacement: () => void;
  updateEquipment: (equipment: Equipment) => void;
  removeEquipment: (id: string) => void;
  selectEquipmentSet: (index: number) => void;
  updateEquipmentSetName: (index: number, name: string) => void;
  addEquipmentSet: () => void;
  duplicateEquipmentSet: (index: number) => void;
  removeEquipmentSet: (index: number) => void;
  moveEquipmentSet: (index: number, direction: 'left' | 'right') => void;
  calculateStatsDiff: () => {
    attributes: Record<string, number>;
    damageChange: { physical: number; magic: number; skill: number };
  };
  history: HistorySnapshot[];
  ocrLogs: OcrLog[];
  addOcrLog: (log: Omit<OcrLog, 'id' | 'timestamp'>) => void;
  clearOcrLogs: () => void;
  pendingEquipments: PendingEquipment[];
  selectedPendingIds: string[];
  addPendingEquipment: (equipment: Equipment, imagePreview?: string) => void;
  removePendingEquipment: (id: string) => void;
  updatePendingEquipment: (id: string, equipment: Equipment) => void;
  confirmPendingEquipment: (id: string) => void;
  replacePendingEquipment: (
    id: string,
    targetSetId?: string,
    targetEquipmentId?: string,
    targetRuneStoneSetIndex?: number
  ) => void;
  togglePendingSelection: (id: string) => void;
  clearPendingSelections: () => void;
  experimentSeats: ExperimentSeat[];
  addExperimentSeat: () => void;
  removeExperimentSeat: (id: string) => void;
  updateExperimentSeatEquipment: (seatId: string, equipment: Equipment) => void;
  removeExperimentSeatEquipment: (
    seatId: string,
    type: string,
    slot?: number
  ) => void;
  updateExperimentSeatName: (seatId: string, name: string) => void;
  syncSampleSeat: () => void;
  updateTreasure: (treasure: Treasure | null) => void;
  toggleTreasure: () => void;
  recalculateCombatStats: () => void;
  addHistorySnapshot: (
    type: HistorySnapshot['type'],
    name: string,
    changes: HistorySnapshot['changes']
  ) => void;
  undoToSnapshot: (id: string) => void;
  currentBoss: string;
  damageResults: DamageResult | null;
  damageHistory: DamageResult[];
  formation: string;
  setCharacter: (updates: Partial<BaseAttributes>) => void;
  setFormation: (formation: string) => void;
  updateBaseAttribute: (key: keyof BaseAttributes, value: number) => void;
  updateCombatStat: (key: keyof CombatStats, value: number) => void;
  updateCultivation: (key: keyof Cultivation, value: number) => void;
}
