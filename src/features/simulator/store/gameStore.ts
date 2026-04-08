import { create } from 'zustand';

import {
  buildEquipmentSetStatePatch,
  cloneEquipmentList,
  ensureEquipmentSets,
  syncEquipmentSetsWithActiveEquipment,
} from './equipmentSetState';
import {
  createDefaultAccounts,
  createDefaultPhysicalCultivation,
  createDefaultPhysicalSkills,
  createDefaultPhysicalTreasure,
} from './gameDefaults';
import { PRESET_EQUIPMENTS } from './gameEquipmentData';
import {
  createInitialEquipment,
  createInitialEquipmentSets,
  initialBaseAttributes as defaultInitialBaseAttributes,
  initialCombatStats as defaultInitialCombatStats,
} from './gameInitialState';
import {
  createCombatTargetFromManualTarget,
  createInitialExperimentSeats,
  createInitialManualTargets,
  createInitialPendingEquipments,
} from './gameRuntimeSeeds';
import {
  createAccountActions,
  createCombatActions,
  createExperimentSeatActions,
  createHistoryAndLogActions,
  createPendingEquipmentActions,
  createStatActions,
} from './gameStoreActions';
import type {
  BaseAttributes,
  CombatStats,
  Equipment,
  EquipmentSet,
  GameState,
} from './gameTypes';

const initialBaseAttributes: BaseAttributes = defaultInitialBaseAttributes;

const initialCombatStats: CombatStats = defaultInitialCombatStats;

const initialEquipment: Equipment[] = createInitialEquipment(PRESET_EQUIPMENTS);
const initialManualTargets = createInitialManualTargets();
const initialCombatTarget = createCombatTargetFromManualTarget(
  initialManualTargets[0]
);

// Seeded equipment sets used when the simulator boots.
const initialEquipmentSets: EquipmentSet[] =
  createInitialEquipmentSets(PRESET_EQUIPMENTS);

const defaultSeed = {
  baseAttributes: initialBaseAttributes,
  combatStats: initialCombatStats,
  equipment: initialEquipment,
  equipmentSets: initialEquipmentSets,
};

export const useGameStore = create<GameState>()((set, get) => ({
  // Account state
  accounts: createDefaultAccounts(defaultSeed),
  activeAccountId: 'default_account_1',
  ...createAccountActions(set, get, defaultSeed),
  baseAttributes: initialBaseAttributes,
  combatStats: initialCombatStats,
  equipment: initialEquipment,
  equipmentSets: initialEquipmentSets,
  activeSetIndex: 0,
  skills: createDefaultPhysicalSkills(),
  cultivation: createDefaultPhysicalCultivation(),
  treasure: createDefaultPhysicalTreasure(),

  // Combat state
  combatTarget: initialCombatTarget,
  selectedSkill: null,
  playerSetup: {
    level: initialBaseAttributes.level,
    faction: initialBaseAttributes.faction,
    baseStats: initialBaseAttributes,
    equipment: initialEquipment,
    skills: [], // 会在初始化后更新
    cultivation: {
      physicalAttack: 20,
      physicalDefense: 20,
      magicAttack: 25,
      magicDefense: 20,
      petPhysicalAttack: 20,
      petPhysicalDefense: 20,
      petMagicAttack: 20,
      petMagicDefense: 20,
    },
    element: '水',
    formation: '天覆阵',
  },
  manualTargets: initialManualTargets,
  combatTab: 'manual',
  selectedDungeonIds: [],
  ...createCombatActions(set, get),
  syncedCloudState: null,
  autoRecalculateDerivedStats: true,
  setAutoRecalculateDerivedStats: (enabled, options) => {
    set((state) => {
      if (!enabled && options?.restoreCloudState && state.syncedCloudState) {
        return {
          ...state.syncedCloudState,
          syncedCloudState: state.syncedCloudState,
          autoRecalculateDerivedStats: false,
        };
      }

      return {
        autoRecalculateDerivedStats: enabled,
      };
    });

    if (enabled) {
      get().recalculateCombatStats();
    }
  },
  previewMode: false,
  previewEquipment: null,
  enterPreviewMode: (current, newEquip, type) => {
    set({
      previewMode: true,
      previewEquipment: { current, new: newEquip },
    });
  },
  exitPreviewMode: () => {
    set({
      previewMode: false,
      previewEquipment: null,
    });
  },
  confirmReplacement: () => {
    const state = get();
    if (state.previewEquipment?.new) {
      state.updateEquipment(state.previewEquipment.new);
      state.addHistorySnapshot(
        'equipment',
        `更换装备：${state.previewEquipment.new.name}`,
        []
      );
    }
    set({ previewMode: false, previewEquipment: null });
  },

  // Equipment state
  updateEquipment: (equipment) => {
    set((state) => {
      const existingIndex = state.equipment.findIndex(
        (e) =>
          e.type === equipment.type &&
          (equipment.slot === undefined || e.slot === equipment.slot)
      );

      let newEquipment = cloneEquipmentList(state.equipment);
      if (existingIndex !== -1) {
        newEquipment[existingIndex] = equipment;
      } else {
        newEquipment = [...newEquipment, equipment];
      }

      const equipmentSets = syncEquipmentSetsWithActiveEquipment(
        state.equipmentSets,
        state.activeSetIndex,
        newEquipment
      );

      return buildEquipmentSetStatePatch(state, {
        equipment: newEquipment,
        equipmentSets,
        activeSetIndex: state.activeSetIndex,
      });
    });
    if (get().autoRecalculateDerivedStats) {
      get().recalculateCombatStats();
    }
  },

  removeEquipment: (id) => {
    set((state) => {
      const equipment = state.equipment.filter((e) => e.id !== id);
      const equipmentSets = syncEquipmentSetsWithActiveEquipment(
        state.equipmentSets,
        state.activeSetIndex,
        equipment
      );

      return buildEquipmentSetStatePatch(state, {
        equipment,
        equipmentSets,
        activeSetIndex: state.activeSetIndex,
      });
    });
    if (get().autoRecalculateDerivedStats) {
      get().recalculateCombatStats();
    }
  },

  selectEquipmentSet: (index) => {
    set((state) => {
      if (index < 0) return state;

      const persistedSets = syncEquipmentSetsWithActiveEquipment(
        state.equipmentSets,
        state.activeSetIndex,
        state.equipment
      );
      const normalizedSets = ensureEquipmentSets(
        persistedSets,
        index,
        state.equipment
      );
      const equipment = cloneEquipmentList(normalizedSets[index]?.items ?? []);
      const equipmentSets = normalizedSets.map((set, setIndex) => ({
        ...set,
        isActive: setIndex === index,
      }));

      return buildEquipmentSetStatePatch(state, {
        equipment,
        equipmentSets,
        activeSetIndex: index,
      });
    });
    if (get().autoRecalculateDerivedStats) {
      get().recalculateCombatStats();
    }
  },

  updateEquipmentSetName: (index, name) => {
    set((state) => {
      const equipmentSets = ensureEquipmentSets(
        state.equipmentSets,
        index,
        state.equipment
      ).map((set, setIndex) => ({
        ...set,
        name: setIndex === index ? name : set.name,
        isActive: setIndex === state.activeSetIndex,
      }));

      return buildEquipmentSetStatePatch(state, {
        equipment: state.equipment,
        equipmentSets,
        activeSetIndex: state.activeSetIndex,
      });
    });
  },

  calculateStatsDiff: () => {
    const state = get();
    const current = state.previewEquipment?.current;
    const newEquip = state.previewEquipment?.new;

    if (!newEquip)
      return {
        attributes: {},
        damageChange: { physical: 0, magic: 0, skill: 0 },
      };

    const attributes: Record<string, number> = {};
    const oldStats = current?.baseStats || {};
    const newStats = newEquip.baseStats || {};

    const allKeys = new Set([
      ...Object.keys(oldStats),
      ...Object.keys(newStats),
    ]);
    allKeys.forEach((key) => {
      const oldVal = (oldStats as Record<string, number | undefined>)[key] ?? 0;
      const newVal = (newStats as Record<string, number | undefined>)[key] ?? 0;
      if (oldVal !== newVal) {
        attributes[key] = newVal - oldVal;
      }
    });

    const magicDiff = attributes['magicDamage'] || 0;
    const physicalDiff = attributes['damage'] || 0;
    const skillDiff = magicDiff * 1.5;

    return {
      attributes,
      damageChange: {
        physical: physicalDiff * 1.2,
        magic: magicDiff * 1.5,
        skill: skillDiff,
      },
    };
  },

  // History state
  history: [],

  // OCR state
  ocrLogs: [],
  ...createHistoryAndLogActions(set, get),
  experimentSeats: createInitialExperimentSeats(),

  ...createExperimentSeatActions(set),
  pendingEquipments: createInitialPendingEquipments(),
  selectedPendingIds: [],
  ...createPendingEquipmentActions(set, get),
  currentBoss: 'boss1',
  damageResults: null,
  damageHistory: [],
  formation: '天覆阵',
  ...createStatActions(set, get),
}));
