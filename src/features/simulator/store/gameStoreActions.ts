import {
  buildEquipmentSetStatePatch,
  syncEquipmentSetsWithActiveEquipment,
} from './equipmentSetState';
import { computeCombatStatsWithPanelBaseline } from './gameLogic';
import { createDefaultManualTarget } from './gameRuntimeSeeds';
import { LABORATORY_MAX_COMPARE_SEATS } from '@/features/simulator/utils/simulatorExperimentSeats';
import type {
  Equipment,
  GameState,
  MeridianConfig,
  PotentialAllocationTarget,
} from './gameTypes';

type StoreSet = (
  updater:
    | Partial<GameState>
    | ((state: GameState) => Partial<GameState> | GameState)
) => void;
type StoreGet = () => GameState;

export const createExperimentSeatActions = (set: StoreSet) => ({
  syncSampleSeat: () => {
    set((state) => ({
      experimentSeats: state.experimentSeats.map((seat) =>
        seat.isSample ? { ...seat, equipment: state.equipment } : seat
      ),
    }));
  },
  addExperimentSeat: () => {
    set((state) => {
      const compSeats = state.experimentSeats.filter((s) => !s.isSample);
      if (compSeats.length >= LABORATORY_MAX_COMPARE_SEATS) return state;
      const newId = `comp_${Date.now()}`;
      return {
        experimentSeats: [
          ...state.experimentSeats,
          {
            id: newId,
            name: `对比席位${compSeats.length + 1}`,
            isSample: false,
            inheritGemstones: true,
            inheritRuneStones: true,
            equipment: state.equipment,
          },
        ],
      };
    });
  },
  removeExperimentSeat: (id: string) => {
    set((state) => {
      return {
        experimentSeats: state.experimentSeats.filter((s) => s.id !== id),
      };
    });
  },
  updateExperimentSeatEquipment: (
    seatId: string,
    equipment: Equipment,
    options?: {
      inheritGemstones?: boolean;
      inheritRuneStones?: boolean;
    }
  ) => {
    set((state) => ({
      experimentSeats: state.experimentSeats.map((seat) => {
        if (seat.id !== seatId || seat.isSample) return seat;
        const existingIndex = seat.equipment.findIndex(
          (e) =>
            e.type === equipment.type &&
            (equipment.slot === undefined || e.slot === equipment.slot)
        );
        const newEquipment = [...seat.equipment];
        if (existingIndex >= 0) newEquipment[existingIndex] = equipment;
        else newEquipment.push(equipment);
        return {
          ...seat,
          equipment: newEquipment,
          inheritGemstones:
            options?.inheritGemstones ?? seat.inheritGemstones ?? true,
          inheritRuneStones:
            options?.inheritRuneStones ?? seat.inheritRuneStones ?? true,
        };
      }),
    }));
  },
  removeExperimentSeatEquipment: (
    seatId: string,
    type: string,
    slot?: number
  ) => {
    set((state) => ({
      experimentSeats: state.experimentSeats.map((seat) => {
        if (seat.id !== seatId || seat.isSample) return seat;
        const newEquipment = seat.equipment.filter((e) => {
          if (e.type !== type) return true;
          if (slot !== undefined && e.slot !== slot) return true;
          return false;
        });
        return { ...seat, equipment: newEquipment };
      }),
    }));
  },
  updateExperimentSeatName: (seatId: string, name: string) => {
    set((state) => ({
      experimentSeats: state.experimentSeats.map((seat) =>
        seat.id === seatId && !seat.isSample ? { ...seat, name } : seat
      ),
    }));
  },
});

export const createPendingEquipmentActions = (
  set: StoreSet,
  get: StoreGet
) => ({
  addPendingEquipment: (equipment: Equipment, imagePreview?: string) => {
    const id = `pending_${Date.now()}`;
    set((state) => ({
      pendingEquipments: [
        ...state.pendingEquipments,
        {
          id,
          equipment,
          timestamp: Date.now(),
          imagePreview,
          status: 'pending',
        },
      ],
    }));
  },
  removePendingEquipment: (id: string) => {
    set((state) => ({
      pendingEquipments: state.pendingEquipments.filter((e) => e.id !== id),
    }));
  },
  updatePendingEquipment: (id: string, equipment: Equipment) => {
    set((state) => ({
      pendingEquipments: state.pendingEquipments.map((e) =>
        e.id === id ? { ...e, equipment } : e
      ),
    }));
  },
  confirmPendingEquipment: (id: string) => {
    const state = get();
    const pending = state.pendingEquipments.find((e) => e.id === id);
    if (!pending) return;
    set((current) => ({
      pendingEquipments: current.pendingEquipments.map((e) =>
        e.id === id ? { ...e, status: 'confirmed' } : e
      ),
    }));
  },
  replacePendingEquipment: (
    id: string,
    targetSetId?: string,
    targetEquipmentId?: string,
    targetRuneStoneSetIndex?: number
  ) => {
    const state = get();
    const pending = state.pendingEquipments.find((e) => e.id === id);
    if (!pending) return;

    set((current) => ({
      pendingEquipments: current.pendingEquipments.map((e) =>
        e.id === id ? { ...e, status: 'replaced' } : e
      ),
    }));

    get().updateEquipment(pending.equipment);
  },
  togglePendingSelection: (id: string) => {
    set((state) => {
      const index = state.selectedPendingIds.indexOf(id);
      if (index >= 0) {
        return {
          selectedPendingIds: state.selectedPendingIds.filter((e) => e !== id),
        };
      }
      return { selectedPendingIds: [...state.selectedPendingIds, id] };
    });
  },
  clearPendingSelections: () => set({ selectedPendingIds: [] }),
});

export const createCombatActions = (set: StoreSet, get: StoreGet) => ({
  setCombatTab: (tab: 'manual' | 'dungeon') => set({ combatTab: tab }),
  setSelectedDungeonIds: (ids: string[]) => set({ selectedDungeonIds: ids }),
  updateCombatTarget: (target: Partial<GameState['combatTarget']>) => {
    set((state) => ({
      combatTarget: { ...state.combatTarget, ...target },
    }));
  },
  addManualTarget: () => {
    set((state) => ({
      manualTargets: [
        ...state.manualTargets,
        createDefaultManualTarget(state.manualTargets.length + 1),
      ],
    }));
  },
  removeManualTarget: (id: string) => {
    set((state) => {
      if (state.manualTargets.length <= 1) return state;
      return { manualTargets: state.manualTargets.filter((t) => t.id !== id) };
    });
  },
  updateManualTarget: (
    id: string,
    updates: Partial<GameState['manualTargets'][number]>
  ) => {
    set((state) => ({
      manualTargets: state.manualTargets.map((t) =>
        t.id === id ? { ...t, ...updates } : t
      ),
    }));
  },
  selectSkill: (skill: GameState['selectedSkill']) =>
    set({ selectedSkill: skill }),
});

export const createHistoryAndLogActions = (set: StoreSet, get: StoreGet) => ({
  addOcrLog: (log: Omit<GameState['ocrLogs'][number], 'id' | 'timestamp'>) => {
    const newLog = {
      ...log,
      id: `log-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
    };
    set((state) => ({
      ocrLogs: [newLog, ...state.ocrLogs].slice(0, 50),
    }));
  },
  clearOcrLogs: () => set({ ocrLogs: [] }),
  addHistorySnapshot: (
    type: GameState['history'][number]['type'],
    name: string,
    changes: GameState['history'][number]['changes']
  ) => {
    const state = get();
    const snapshotState = {
      baseAttributes: { ...state.baseAttributes },
      combatStats: { ...state.combatStats },
      equipment: JSON.parse(JSON.stringify(state.equipment)),
      cultivation: { ...state.cultivation },
      meridian: { ...state.meridian },
      combatTarget: { ...state.combatTarget },
    };

    const newSnapshot: GameState['history'][number] = {
      id: `snap_${Date.now()}`,
      timestamp: Date.now(),
      name,
      type,
      changes,
      state: snapshotState,
    };

    set((current) => {
      const lastHistory = current.history[0];
      if (lastHistory?.state.combatStats) {
        newSnapshot.damageChange = {
          physical:
            snapshotState.combatStats.damage -
            lastHistory.state.combatStats.damage,
          magic:
            snapshotState.combatStats.magicDamage -
            lastHistory.state.combatStats.magicDamage,
          skill: 0,
        };
      }
      return {
        history: [newSnapshot, ...current.history].slice(0, 20),
      };
    });
  },
  undoToSnapshot: (id: string) => {
    const state = get();
    const snapshot = state.history.find((h) => h.id === id);
    if (!snapshot?.state) return;

    const {
      baseAttributes,
      combatStats,
      equipment,
      cultivation,
      meridian,
      combatTarget,
    } = snapshot.state;
    const updates: Partial<GameState> = {};
    if (baseAttributes) updates.baseAttributes = baseAttributes;
    if (combatStats) updates.combatStats = combatStats;
    if (equipment) updates.equipment = equipment;
    if (cultivation) updates.cultivation = cultivation;
    if (meridian) updates.meridian = meridian;
    if (combatTarget) updates.combatTarget = combatTarget;
    set((state) => {
      if (!equipment) {
        return updates;
      }

      const equipmentSets = syncEquipmentSetsWithActiveEquipment(
        state.equipmentSets,
        state.activeSetIndex,
        equipment
      );

      return {
        ...updates,
        ...buildEquipmentSetStatePatch(state, {
          equipment,
          equipmentSets,
          activeSetIndex: state.activeSetIndex,
        }),
      };
    });

    get().addHistorySnapshot('auto', `撤销至: ${snapshot.name}`, [
      { label: '操作', oldValue: '当前状态', newValue: '历史状态' },
    ]);
  },
});

export const createStatActions = (set: StoreSet, get: StoreGet) => ({
  updateTreasure: (treasure: GameState['treasure']) => {
    set({ treasure });
    if (get().autoRecalculateDerivedStats) {
      get().recalculateCombatStats();
    }
  },
  toggleTreasure: () => {
    const state = get();
    if (!state.treasure) return;
    set({
      treasure: { ...state.treasure, isActive: !state.treasure.isActive },
    });
    if (get().autoRecalculateDerivedStats) {
      get().recalculateCombatStats();
    }
  },
  recalculateCombatStats: () => {
    const {
      baseAttributes,
      cultivation,
      equipment,
      meridian,
      syncedCloudState,
      treasure,
      playerSetup,
      activeRegularSetRules,
    } = get();
    const newStats = computeCombatStatsWithPanelBaseline(
      {
        baseAttributes,
        equipment,
        treasure,
        bodyStrength: cultivation.bodyStrength,
        formation: playerSetup.formation,
        meridian,
        regularSetRules: activeRegularSetRules,
        runeSkillBaselineEquipment: syncedCloudState?.equipment ?? [],
      },
      syncedCloudState
        ? {
            panelStats: syncedCloudState.combatStats,
            baseAttributes: syncedCloudState.baseAttributes,
            equipment: syncedCloudState.equipment,
            treasure: syncedCloudState.treasure,
            bodyStrength: syncedCloudState.cultivation.bodyStrength,
            formation:
              syncedCloudState.playerSetup?.formation ??
              syncedCloudState.formation,
            meridian: syncedCloudState.meridian,
            regularSetRules: activeRegularSetRules,
            runeSkillBaselineEquipment: syncedCloudState.equipment,
          }
        : null
    );
    Object.keys(newStats).forEach((key) => {
      const k = key as keyof typeof newStats;
      newStats[k] = Math.round(newStats[k]);
    });
    set({ combatStats: newStats });
  },
  setCharacter: (updates: Partial<GameState['baseAttributes']>) => {
    set((state) => ({
      baseAttributes: { ...state.baseAttributes, ...updates },
    }));
  },
  setFormation: (formation: string) => set({ formation }),
  updateBaseAttribute: (
    key: keyof GameState['baseAttributes'],
    value: number
  ) => {
    set((state) => ({
      baseAttributes: { ...state.baseAttributes, [key]: value },
    }));
    if (get().autoRecalculateDerivedStats) {
      get().recalculateCombatStats();
    }
  },
  allocatePotentialPoints: (
    key: PotentialAllocationTarget,
    amount: number
  ) => {
    set((state) => {
      const available = Math.max(
        0,
        Math.floor(Number(state.baseAttributes.potentialPoints ?? 0))
      );
      const requested = Math.max(0, Math.floor(Number(amount ?? 0)));
      const applied = Math.min(available, requested);

      if (applied <= 0) {
        return state;
      }

      const currentValue = Number(state.baseAttributes[key] ?? 0);

      return {
        baseAttributes: {
          ...state.baseAttributes,
          [key]: currentValue + applied,
          potentialPoints: available - applied,
        },
      };
    });
    if (get().autoRecalculateDerivedStats) {
      get().recalculateCombatStats();
    }
  },
  updateCombatStat: (key: keyof GameState['combatStats'], value: number) => {
    set((state) => ({
      combatStats: { ...state.combatStats, [key]: value },
    }));
  },
  updateCultivation: (key: keyof GameState['cultivation'], value: number) => {
    set((state) => ({
      cultivation: { ...state.cultivation, [key]: value },
    }));
    if (get().autoRecalculateDerivedStats) {
      get().recalculateCombatStats();
    }
  },
  updateMeridian: (key: keyof MeridianConfig, value: number) => {
    set((state) => ({
      meridian: { ...state.meridian, [key]: value },
    }));
    if (get().autoRecalculateDerivedStats) {
      get().recalculateCombatStats();
    }
  },
});
