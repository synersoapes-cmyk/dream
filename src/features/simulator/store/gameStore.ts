import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  createInitialEquipment,
  createInitialEquipmentSets,
  initialBaseAttributes as defaultInitialBaseAttributes,
  initialCombatStats as defaultInitialCombatStats,
} from './gameInitialState';
import { getRandomDungeonTargets } from './gameLogic';
import { PRESET_EQUIPMENTS } from './gameEquipmentData';
import {
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
import {
  createDefaultAccounts,
  createDefaultPhysicalCultivation,
  createDefaultPhysicalSkills,
  createDefaultPhysicalTreasure,
} from './gameDefaults';
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

// Seeded equipment sets used when the simulator boots.
const initialEquipmentSets: EquipmentSet[] =
  createInitialEquipmentSets(PRESET_EQUIPMENTS);

const defaultSeed = {
  baseAttributes: initialBaseAttributes,
  combatStats: initialCombatStats,
  equipment: initialEquipment,
  equipmentSets: initialEquipmentSets,
};

export const useGameStore = create<GameState>()(persist((set, get) => ({
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
  combatTarget: {
    name: '测试木桩',
    level: 175,
    hp: 100000,
    defense: 1500,
    magicDefense: 1200,
  },
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
    formation: '天覆阵'
  },
  manualTargets: createInitialManualTargets(),
  combatTab: 'manual',
  selectedDungeonIds: getRandomDungeonTargets(),
  ...createCombatActions(set, get),
  previewMode: false,
  previewEquipment: null,
  enterPreviewMode: (current, newEquip, type) => {
    set({
      previewMode: true,
      previewEquipment: { current, new: newEquip }
    });
  },
  exitPreviewMode: () => {
    set({
      previewMode: false,
      previewEquipment: null
    });
  },
  confirmReplacement: () => {
    const state = get();
    if (state.previewEquipment?.new) {
      state.updateEquipment(state.previewEquipment.new);
      state.addHistorySnapshot('equipment', `更换装备：${state.previewEquipment.new.name}`, []);
    }
    set({ previewMode: false, previewEquipment: null });
  },

  // Equipment state
  updateEquipment: (equipment) => {
    set((state) => {
      const existingIndex = state.equipment.findIndex(e => 
        e.type === equipment.type && 
        (equipment.slot === undefined || e.slot === equipment.slot)
      );
      
      let newEquipment = [...state.equipment];
      if (existingIndex !== -1) {
        newEquipment[existingIndex] = equipment;
      } else {
        newEquipment = [...state.equipment, equipment];
      }
      
      return { equipment: newEquipment };
    });
    get().recalculateCombatStats();
  },
  
  removeEquipment: (id) => {
    set((state) => ({
      equipment: state.equipment.filter(e => e.id !== id)
    }));
    get().recalculateCombatStats();
  },
  
  updateEquipmentSetName: (index, name) => {
    set((state) => {
      const newSets = [...state.equipmentSets];
      if (newSets[index]) {
        newSets[index] = { ...newSets[index], name };
      } else {
        newSets[index] = { id: `set_${index}`, name, items: [] };
      }
      return { equipmentSets: newSets };
    });
  },

  calculateStatsDiff: () => {
    const state = get();
    const current = state.previewEquipment?.current;
    const newEquip = state.previewEquipment?.new;
    
    if (!newEquip) return { attributes: {}, damageChange: { physical: 0, magic: 0, skill: 0 } };
    
    const attributes: Record<string, number> = {};
    const oldStats = current?.baseStats || {};
    const newStats = newEquip.baseStats || {};
    
    const allKeys = new Set([...Object.keys(oldStats), ...Object.keys(newStats)]);
    allKeys.forEach(key => {
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
        skill: skillDiff
      }
    };
  },
  
  // History state
  history: [],
  
  // OCR state
  ocrLogs: [],
  ...createHistoryAndLogActions(set, get),
  experimentSeats: createInitialExperimentSeats(initialEquipment),
  
  ...createExperimentSeatActions(set),
  pendingEquipments: createInitialPendingEquipments(),
  selectedPendingIds: [],
  ...createPendingEquipmentActions(set, get),
  currentBoss: 'boss1',
  damageResults: null,
  damageHistory: [],
  formation: '天覆阵',
  ...createStatActions(set, get),
}), {
  name: 'mhxy-sim-store',
  version: 3, // Changed version to 3 to invalidate cache and show new multi-account mock data
  migrate: (persistedState: unknown, version: number) => {
    if (version < 3) {
      // Drop older persisted payloads and rebuild from current seeds.
      return undefined;
    }
    return persistedState as GameState;
  },
  // Persist only the slices that are meaningful across sessions.
  partialize: (state) => ({
    accounts: state.accounts,
    activeAccountId: state.activeAccountId,
    baseAttributes: state.baseAttributes,
    equipment: state.equipment,
    equipmentSets: state.equipmentSets,
    pendingEquipments: state.pendingEquipments,
    experimentSeats: state.experimentSeats,
    cultivation: state.cultivation,
    treasure: state.treasure,
  }) as unknown as GameState,
}));
