import {
  buildEquipmentSetStatePatch,
  syncEquipmentSetsWithActiveEquipment,
} from './equipmentSetState';
import { createNewMagicAccount } from './gameDefaults';
import { computeDerivedStats } from './gameLogic';
import { createDefaultManualTarget } from './gameRuntimeSeeds';
import type { AccountData, Equipment, GameState } from './gameTypes';

type StoreSet = (
  updater:
    | Partial<GameState>
    | ((state: GameState) => Partial<GameState> | GameState)
) => void;
type StoreGet = () => GameState;

type DefaultSeed = {
  baseAttributes: GameState['baseAttributes'];
  combatStats: GameState['combatStats'];
  equipment: GameState['equipment'];
  equipmentSets: GameState['equipmentSets'];
};

export const createAccountActions = (
  set: StoreSet,
  get: StoreGet,
  defaultSeed: DefaultSeed
) => ({
  switchAccount: (id: string) => {
    const state = get();
    if (state.activeAccountId === id) return;

    const currentAccountData: AccountData = {
      id: state.activeAccountId,
      name:
        state.accounts.find((a) => a.id === state.activeAccountId)?.name ||
        '未命名',
      baseAttributes: state.baseAttributes,
      combatStats: state.combatStats,
      equipment: state.equipment,
      equipmentSets: state.equipmentSets,
      activeSetIndex: state.activeSetIndex,
      skills: state.skills,
      cultivation: state.cultivation,
      treasure: state.treasure,
    };

    const updatedAccounts = state.accounts.map((a) =>
      a.id === state.activeAccountId ? currentAccountData : a
    );
    const nextAccount = updatedAccounts.find((a) => a.id === id);
    if (!nextAccount) return;

    set({
      accounts: updatedAccounts,
      activeAccountId: id,
      baseAttributes: nextAccount.baseAttributes,
      combatStats: nextAccount.combatStats,
      equipment: nextAccount.equipment,
      equipmentSets: nextAccount.equipmentSets,
      activeSetIndex: nextAccount.activeSetIndex,
      skills: nextAccount.skills,
      cultivation: nextAccount.cultivation,
      treasure: nextAccount.treasure,
    });
    get().recalculateCombatStats();
  },
  addAccount: (name: string) => {
    const newId = `account_${Date.now()}`;
    const newAccount: AccountData = createNewMagicAccount(
      newId,
      name,
      defaultSeed
    );
    set((state) => ({
      accounts: [...state.accounts, newAccount],
    }));
    get().switchAccount(newId);
  },
  updateAccountName: (id: string, name: string) => {
    set((state) => ({
      accounts: state.accounts.map((a) => (a.id === id ? { ...a, name } : a)),
    }));
  },
  deleteAccount: (id: string) => {
    set((state) => {
      const newAccounts = state.accounts.filter((a) => a.id !== id);
      if (newAccounts.length === 0) return state;
      if (state.activeAccountId === id) {
        const nextAccount = newAccounts[0];
        return {
          accounts: newAccounts,
          activeAccountId: nextAccount.id,
          baseAttributes: nextAccount.baseAttributes,
          combatStats: nextAccount.combatStats,
          equipment: nextAccount.equipment,
          equipmentSets: nextAccount.equipmentSets,
          activeSetIndex: nextAccount.activeSetIndex,
          skills: nextAccount.skills,
          cultivation: nextAccount.cultivation,
          treasure: nextAccount.treasure,
        };
      }
      return { accounts: newAccounts };
    });
    if (get().activeAccountId !== id) {
      get().recalculateCombatStats();
    }
  },
});

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
      if (compSeats.length >= 5) return state;
      const newId = `comp_${Date.now()}`;
      return {
        experimentSeats: [
          ...state.experimentSeats,
          {
            id: newId,
            name: `对比席位${compSeats.length + 1}`,
            isSample: false,
            equipment: state.equipment,
          },
        ],
      };
    });
  },
  removeExperimentSeat: (id: string) => {
    set((state) => {
      const compSeats = state.experimentSeats.filter((s) => !s.isSample);
      if (compSeats.length <= 1) return state;
      return {
        experimentSeats: state.experimentSeats.filter((s) => s.id !== id),
      };
    });
  },
  updateExperimentSeatEquipment: (seatId: string, equipment: Equipment) => {
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
        return { ...seat, equipment: newEquipment };
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
      combatTarget,
    } = snapshot.state;
    const updates: Partial<GameState> = {};
    if (baseAttributes) updates.baseAttributes = baseAttributes;
    if (combatStats) updates.combatStats = combatStats;
    if (equipment) updates.equipment = equipment;
    if (cultivation) updates.cultivation = cultivation;
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
    get().recalculateCombatStats();
  },
  toggleTreasure: () => {
    const state = get();
    if (!state.treasure) return;
    set({
      treasure: { ...state.treasure, isActive: !state.treasure.isActive },
    });
    get().recalculateCombatStats();
  },
  recalculateCombatStats: () => {
    const { baseAttributes, equipment, treasure } = get();
    const newStats = computeDerivedStats(baseAttributes, equipment, treasure);
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
    get().recalculateCombatStats();
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
    get().recalculateCombatStats();
  },
});
