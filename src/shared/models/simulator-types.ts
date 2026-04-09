import {
  battleTargetTemplate,
  candidateEquipment,
  characterCultivation,
  characterProfile,
  characterSkill,
  characterSnapshot,
  equipmentItem,
  equipmentPlan,
  equipmentPlanItem,
  gameCharacter,
  inventoryEntry,
  inventoryEquipmentAsset,
  jadeAttr,
  jadeItem,
  labSession,
  labSessionEquipment,
  ocrDictionary,
  ocrDraftItem,
  ocrJob,
  ornamentItem,
  ornamentSubAttr,
  ruleAttribute,
  snapshotBattleContext,
  snapshotEquipmentSlot,
  snapshotJadeSlot,
  snapshotOrnamentSlot,
} from '@/config/db/schema';

export type SimulatorCharacter = typeof gameCharacter.$inferSelect;
export type SimulatorSnapshot = typeof characterSnapshot.$inferSelect;
export type SimulatorProfile = typeof characterProfile.$inferSelect;
export type SimulatorSkill = typeof characterSkill.$inferSelect;
export type SimulatorCultivation = typeof characterCultivation.$inferSelect;
export type SimulatorRule = typeof ruleAttribute.$inferSelect;
export type SimulatorBattleContext = typeof snapshotBattleContext.$inferSelect;
export type SimulatorBattleTargetTemplate =
  typeof battleTargetTemplate.$inferSelect;
export type SimulatorLabSession = typeof labSession.$inferSelect;
export type SimulatorLabSessionEquipment =
  typeof labSessionEquipment.$inferSelect;
export type SimulatorCandidateEquipment =
  typeof candidateEquipment.$inferSelect;
export type SimulatorOcrJob = typeof ocrJob.$inferSelect;
export type SimulatorOcrDraftItem = typeof ocrDraftItem.$inferSelect;
export type SimulatorOcrDictionary = typeof ocrDictionary.$inferSelect;
export type SimulatorInventoryEquipmentAsset =
  typeof inventoryEquipmentAsset.$inferSelect;
export type SimulatorInventoryEntry = typeof inventoryEntry.$inferSelect;
export type SimulatorEquipmentPlan = typeof equipmentPlan.$inferSelect;
export type SimulatorEquipmentPlanItem = typeof equipmentPlanItem.$inferSelect;

export type SimulatorEquipmentBuild = {
  equipmentId: string;
  holeCount: number;
  gemLevelTotal: number;
  refineLevel: number;
  specialEffectJson: string;
  setEffectJson: string;
  notesJson: string;
};

export type SimulatorEquipmentAttr = {
  id: string;
  equipmentId: string;
  attrGroup: string;
  attrType: string;
  valueType: string;
  attrValue: number;
  displayOrder: number;
};

export type SimulatorSnapshotSlot = typeof snapshotEquipmentSlot.$inferSelect;
export type SimulatorEquipmentRow = typeof equipmentItem.$inferSelect;
export type SimulatorOrnamentRow = typeof ornamentItem.$inferSelect;
export type SimulatorOrnamentSubAttrRow = typeof ornamentSubAttr.$inferSelect;
export type SimulatorJadeRow = typeof jadeItem.$inferSelect;
export type SimulatorJadeAttrRow = typeof jadeAttr.$inferSelect;
export type SimulatorSnapshotOrnamentSlot =
  typeof snapshotOrnamentSlot.$inferSelect;
export type SimulatorSnapshotJadeSlot = typeof snapshotJadeSlot.$inferSelect;

export type SimulatorEquipment = {
  id: string;
  characterId: string;
  slot: string;
  name: string;
  level: number;
  quality: string;
  price: number;
  source: string;
  status: string;
  isLocked: boolean;
  createdAt: Date;
  updatedAt: Date;
  build: SimulatorEquipmentBuild | null;
  attrs: SimulatorEquipmentAttr[];
  snapshotSlot: string | null;
};

export type SimulatorEquipmentPlanState = {
  equipmentSets: Array<{
    id: string;
    name: string;
    items: Array<Record<string, unknown>>;
    isActive?: boolean;
  }>;
  activeSetIndex: number;
};

export type SimulatorCharacterBundle = {
  character: SimulatorCharacter;
  snapshot: SimulatorSnapshot | null;
  profile: SimulatorProfile | null;
  skills: SimulatorSkill[];
  cultivations: SimulatorCultivation[];
  battleContext: SimulatorBattleContext | null;
  battleTargetTemplate: SimulatorBattleTargetTemplate | null;
  rules: SimulatorRule[];
  equipments: SimulatorEquipment[];
  equipmentPlan?: SimulatorEquipmentPlanState | null;
};

export type SimulatorRollbackSnapshotSummary = Pick<
  SimulatorSnapshot,
  'id' | 'name' | 'source' | 'notes' | 'createdAt'
>;

export type SimulatorLabSeatPayload = {
  id: string;
  name: string;
  isSample: boolean;
  sort?: number;
  equipment: Array<Record<string, unknown>>;
};

export type SimulatorLabSessionBundle = {
  session: SimulatorLabSession | null;
  seats: SimulatorLabSeatPayload[];
};

export type SimulatorCandidateEquipmentItem = {
  id: string;
  equipment: Record<string, unknown>;
  timestamp: number;
  imagePreview?: string;
  rawText?: string;
  targetSetId?: string;
  targetEquipmentId?: string;
  targetRuneStoneSetIndex?: number;
  status: 'pending' | 'confirmed' | 'replaced';
};

export type AdminSimulatorPendingReviewItem =
  SimulatorCandidateEquipmentItem & {
    characterId: string;
    characterName: string;
    userId: string;
    userName: string;
    userEmail: string;
    source: string;
  };

export type AdminSimulatorOcrJobItem = {
  id: string;
  characterId: string;
  characterName: string;
  userId: string;
  userName: string;
  userEmail: string;
  sceneType: string;
  status: string;
  imageUrl: string;
  errorMessage: string;
  rawResult: Record<string, unknown>;
  createdAt: number;
  updatedAt: number;
  draftItems: Array<{
    id: string;
    itemType: string;
    reviewStatus: string;
    confidenceScore: number;
    candidateStatus: string | null;
  }>;
};

export type AdminSimulatorOcrDictionaryItem = {
  id: string;
  dictType: string;
  rawText: string;
  normalizedText: string;
  priority: number;
  enabled: boolean;
  createdBy: string;
  createdAt: number;
  updatedAt: number;
};

export type AdminSimulatorInventoryEntryItem = {
  id: string;
  characterId: string;
  characterName: string;
  userId: string;
  userName: string;
  userEmail: string;
  itemType: string;
  itemRefId: string;
  sourceCandidateId: string | null;
  sourceDraftId: string | null;
  folderKey: string;
  price: number | null;
  status: string;
  createdAt: number;
  updatedAt: number;
  equipmentName: string;
  equipmentType: string;
  candidateStatus: string | null;
};

export type AdminSimulatorLabSessionItem = {
  sessionId: string;
  sessionName: string;
  status: string;
  notes: string;
  createdAt: number;
  updatedAt: number;
  baselineSnapshotId: string;
  characterId: string;
  characterName: string;
  userId: string;
  userName: string;
  userEmail: string;
  seatCount: number;
  compareSeatCount: number;
  seats: Array<{
    id: string;
    name: string;
    isSample: boolean;
    equipmentCount: number;
    equipmentNames: string[];
  }>;
};

export type AdminBattleTargetTemplateItem = {
  id: string;
  userId: string | null;
  scope: string;
  name: string;
  dungeonName: string;
  targetType: string;
  school: string;
  level: number;
  hp: number;
  defense: number;
  magicDefense: number;
  magicDefenseCultivation: number;
  speed: number;
  element: string;
  formation: string;
  notes: string;
  payload: Record<string, unknown>;
  enabled: boolean;
  createdAt: number;
  updatedAt: number;
};

export type AdminSimulatorUserDiagnosticItem = {
  userId: string;
  userName: string;
  userEmail: string;
  userCreatedAt: number;
  characterId: string;
  characterName: string;
  school: string;
  roleType: string;
  level: number;
  snapshotId: string | null;
  snapshotName: string | null;
  profileSummary: {
    hp: number;
    mp: number;
    magicDamage: number;
    magicDefense: number;
    speed: number;
  } | null;
  battleContextSummary: {
    selfFormation: string;
    selfElement: string;
    targetName: string;
    targetFormation: string;
    targetElement: string;
    targetMagicDefense: number;
    splitTargetCount: number;
  } | null;
  candidateSummary: {
    total: number;
    pending: number;
    confirmed: number;
    replaced: number;
  };
  labSummary: {
    hasActiveSession: boolean;
    sessionName: string | null;
    compareSeatCount: number;
    updatedAt: number | null;
  };
};
