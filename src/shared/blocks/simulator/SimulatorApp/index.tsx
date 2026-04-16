'use client';

import { useEffect, useMemo, useState } from 'react';
import { EquipmentReplaceDialog } from '@/features/simulator/overlays/EquipmentReplaceDialog';
import { AccountSwitcher } from '@/features/simulator/shell/AccountSwitcher';
import { AiChat } from '@/features/simulator/shell/AiChat';
import { useGameStore } from '@/features/simulator/store/gameStore';
import {
  clearSelectedSimulatorCharacterId,
  getSelectedSimulatorCharacterId,
  setSelectedSimulatorCharacterId,
} from '@/features/simulator/utils/characterSelection';
import { applySimulatorBundleToStore } from '@/features/simulator/utils/simulatorBundle';
import { loadSimulatorCandidateEquipmentToStore } from '@/features/simulator/utils/simulatorCandidateEquipment';
import {
  ChevronDown,
  ChevronUp,
  Compass,
  Crosshair,
  Heart,
  LogIn,
  MessageSquare,
  Shield,
  Sparkles,
  Swords,
  TrendingUp,
  UserPlus,
  Wind,
  X,
  Zap,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useTheme } from 'next-themes';
import { toast } from 'sonner';

import { useSession } from '@/core/auth/client';
import { Link, usePathname } from '@/core/i18n/navigation';
import { SignModal } from '@/shared/blocks/sign/sign-modal';
import {
  CharacterPanel,
  CombatPanel,
  EquipmentPanel,
  LaboratoryPanel,
} from '@/shared/blocks/simulator';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import { useAppContext } from '@/shared/contexts/app';
import { isNavigatorOffline } from '@/shared/lib/simulator-network';
import {
  buildPanelSourceBreakdownSummary,
  buildSimulatorPanelSourceBreakdowns,
  formatPanelSourceSignedValue,
  sortPanelSourceValueItems,
} from '@/shared/lib/simulator-panel-source-breakdown';
import { SIMULATOR_OPEN_LAB_EVENT } from '@/shared/lib/simulator-pending-review-request';

const BOOTSTRAP_TIMEOUT_MS = 15_000;
const DEV_BOOTSTRAP_TIMEOUT_MS = 30_000;
const BOOTSTRAP_RETRY_COUNT = 2;

const FINAL_PANEL_FOCUS_STATS = [
  {
    key: 'magicDamage',
    label: '法伤',
    sublabel: '龙宫输出核心',
    accent: 'amber',
  },
  {
    key: 'speed',
    label: '速度',
    sublabel: '出手节奏',
    accent: 'emerald',
  },
  {
    key: 'hp',
    label: '气血',
    sublabel: '站场生存',
    accent: 'rose',
  },
] as const;

const FINAL_PANEL_SECTIONS = [
  {
    title: '输出面板',
    description: '先看法系伤害、命中和补充输出词条',
    accent: 'amber',
    stats: [
      { key: 'magicDamage', label: '法伤' },
      { key: 'spiritualPower', label: '灵力' },
      { key: 'magicCritLevel', label: '法爆等级' },
      { key: 'fixedDamage', label: '固伤' },
      { key: 'pierceLevel', label: '穿刺' },
      { key: 'hit', label: '命中' },
      { key: 'damage', label: '伤害' },
    ],
  },
  {
    title: '生存面板',
    description: '再看气血、防御、法防和承伤词条',
    accent: 'cyan',
    stats: [
      { key: 'hp', label: '气血' },
      { key: 'magicDefense', label: '法防' },
      { key: 'defense', label: '物防' },
      { key: 'block', label: '格挡' },
      { key: 'antiCritLevel', label: '抗暴' },
      { key: 'sealResistLevel', label: '抗封等级' },
      { key: 'dodge', label: '躲避' },
    ],
  },
  {
    title: '辅助面板',
    description: '最后看蓝量、速度和环境向补充属性',
    accent: 'sky',
    stats: [
      { key: 'speed', label: '速度' },
      { key: 'magic', label: '魔法' },
      { key: 'elementalMastery', label: '五行克制' },
    ],
  },
] as const;

const ACCENT_CLASS_MAP = {
  amber: 'border-amber-500/35 bg-amber-500/10 text-amber-100',
  sky: 'border-sky-500/35 bg-sky-500/10 text-sky-100',
  fuchsia: 'border-fuchsia-500/35 bg-fuchsia-500/10 text-fuchsia-100',
  emerald: 'border-emerald-500/35 bg-emerald-500/10 text-emerald-100',
  rose: 'border-rose-500/35 bg-rose-500/10 text-rose-100',
  cyan: 'border-cyan-500/35 bg-cyan-500/10 text-cyan-100',
  indigo: 'border-indigo-500/35 bg-indigo-500/10 text-indigo-100',
  yellow: 'border-yellow-500/35 bg-yellow-500/10 text-yellow-100',
} as const;

const SECTION_ACCENT_CLASS_MAP = {
  amber: {
    icon: 'border-amber-700/40 bg-amber-500/10 text-amber-100',
    card: 'border-amber-800/30 bg-amber-950/10',
    text: 'text-amber-200/75',
  },
  cyan: {
    icon: 'border-cyan-700/40 bg-cyan-500/10 text-cyan-100',
    card: 'border-cyan-800/30 bg-cyan-950/10',
    text: 'text-cyan-200/75',
  },
  sky: {
    icon: 'border-sky-700/40 bg-sky-500/10 text-sky-100',
    card: 'border-sky-800/30 bg-sky-950/10',
    text: 'text-sky-200/75',
  },
} as const;

type AuthViewState =
  | 'checking-session'
  | 'signed-out'
  | 'bootstrapping'
  | 'ready'
  | 'error';

function shouldRetryBootstrapRequest(error: unknown) {
  if (error instanceof Error && error.name === 'AbortError') {
    return true;
  }

  if (!(error instanceof Error)) {
    return false;
  }

  return /status:\s*5\d{2}/i.test(error.message);
}

export default function SimulatorApp() {
  const pathname = usePathname();
  const callbackUrl = useMemo(() => pathname || '/', [pathname]);
  const { setIsShowSignModal } = useAppContext();
  const { data: session, isPending: isSessionPending } = useSession();
  const { resolvedTheme } = useTheme();
  const setAutoRecalculateDerivedStats = useGameStore(
    (state) => state.setAutoRecalculateDerivedStats
  );
  const currentCharacter = useGameStore((state) => state.currentCharacter);
  const baseAttributes = useGameStore((state) => state.baseAttributes);
  const combatStats = useGameStore((state) => state.combatStats);
  const cultivation = useGameStore((state) => state.cultivation);
  const equipment = useGameStore((state) => state.equipment);
  const meridian = useGameStore((state) => state.meridian);
  const treasure = useGameStore((state) => state.treasure);
  const playerSetup = useGameStore((state) => state.playerSetup);
  const combatTarget = useGameStore((state) => state.combatTarget);
  const syncedCloudState = useGameStore((state) => state.syncedCloudState);
  const activeRegularSetRules = useGameStore(
    (state) => state.activeRegularSetRules
  );
  const equipmentSets = useGameStore((state) => state.equipmentSets);
  const activeSetIndex = useGameStore((state) => state.activeSetIndex);
  const selectedSkill = useGameStore((state) => state.selectedSkill);

  const [mainTab, setMainTab] = useState<'status' | 'lab'>('status');
  const [showAI, setShowAI] = useState(false);
  const [isCombatPanelExpanded, setIsCombatPanelExpanded] = useState(false);
  const [expandedFinalSourceKey, setExpandedFinalSourceKey] = useState<
    string | null
  >(null);
  const [signModalMode, setSignModalMode] = useState<'sign-in' | 'sign-up'>(
    'sign-in'
  );
  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const [bootstrapError, setBootstrapError] = useState<string | null>(null);
  const [bootstrapNotice, setBootstrapNotice] = useState<string | null>(null);
  const isLightTheme = resolvedTheme === 'light';
  const activeEquipmentSet = equipmentSets[activeSetIndex];
  const cultivationSummary = useMemo(
    () => [
      { label: '法修', value: cultivation.magicAttack ?? 0 },
      { label: '法抗', value: cultivation.magicDefense ?? 0 },
      { label: '物抗', value: cultivation.physicalDefense ?? 0 },
      { label: '强身', value: cultivation.bodyStrength ?? 0 },
    ],
    [cultivation]
  );
  const panelSummaryBadges = useMemo(
    () => [
      {
        icon: TrendingUp,
        label: '当前方案',
        value: activeEquipmentSet?.name || `配置${activeSetIndex + 1}`,
      },
      {
        icon: Sparkles,
        label: '门派',
        value: baseAttributes.faction,
      },
      {
        icon: Zap,
        label: '等级',
        value: `${baseAttributes.level}级`,
      },
      {
        icon: Swords,
        label: '当前技能',
        value: selectedSkill?.name || '龙卷雨击',
      },
    ],
    [
      activeEquipmentSet?.name,
      activeSetIndex,
      baseAttributes.faction,
      baseAttributes.level,
      selectedSkill?.name,
    ]
  );
  const battleQuickFacts = useMemo(
    () => [
      {
        label: '我方阵法',
        value:
          syncedCloudState?.battleContext?.selfFormation ||
          playerSetup.formation ||
          '天覆阵',
      },
      {
        label: '我方五行',
        value:
          syncedCloudState?.battleContext?.selfElement ||
          playerSetup.element ||
          '水',
      },
      {
        label: '当前目标',
        value:
          combatTarget?.dungeonName && combatTarget?.name
            ? `${combatTarget.dungeonName} · ${combatTarget.name}`
            : combatTarget?.name || '手动目标',
      },
      {
        label: '目标阵法',
        value:
          syncedCloudState?.battleContext?.targetFormation ||
          combatTarget?.formation ||
          '普通阵',
      },
      {
        label: '法伤结果',
        value: String(syncedCloudState?.battleContext?.magicResult ?? 0),
      },
      {
        label: '目标法防结果',
        value: String(
          syncedCloudState?.battleContext?.targetMagicDefenseResult ?? 0
        ),
      },
    ],
    [
      combatTarget?.dungeonName,
      combatTarget?.formation,
      combatTarget?.name,
      playerSetup.element,
      playerSetup.formation,
      syncedCloudState?.battleContext?.magicResult,
      syncedCloudState?.battleContext?.selfElement,
      syncedCloudState?.battleContext?.selfFormation,
      syncedCloudState?.battleContext?.targetFormation,
      syncedCloudState?.battleContext?.targetMagicDefenseResult,
    ]
  );
  const finalPanelSectionStats = useMemo(
    () =>
      FINAL_PANEL_SECTIONS.map((section) => ({
        ...section,
        stats: section.stats.map((item) => ({
          ...item,
          value: combatStats[item.key] ?? 0,
        })),
      })),
    [combatStats]
  );
  const panelSourceBreakdowns = useMemo(
    () =>
      buildSimulatorPanelSourceBreakdowns({
        baseAttributes,
        equipment,
        treasure,
        bodyStrength: cultivation.bodyStrength || 0,
        formation: playerSetup.formation,
        meridian,
        regularSetRules: activeRegularSetRules,
        syncedCloudState,
      }).slice(0, 6),
    [
      activeRegularSetRules,
      baseAttributes,
      cultivation.bodyStrength,
      equipment,
      meridian,
      playerSetup.formation,
      syncedCloudState,
      treasure,
    ]
  );

  const authViewState: AuthViewState = isSessionPending
    ? 'checking-session'
    : !session?.user?.id
      ? 'signed-out'
      : isBootstrapping
        ? 'bootstrapping'
        : bootstrapError
          ? 'error'
          : 'ready';

  useEffect(() => {
    if (isSessionPending) {
      setIsBootstrapping(true);
      return;
    }

    if (!session?.user?.id) {
      setBootstrapError(null);
      setBootstrapNotice(null);
      setIsBootstrapping(false);
      return;
    }

    let cancelled = false;
    let controller: AbortController | null = null;

    const bootstrap = async () => {
      setIsBootstrapping(true);
      setBootstrapError(null);
      setBootstrapNotice(null);

      let didTimeout = false;

      try {
        let payload: any = null;
        const selectedCharacterId = getSelectedSimulatorCharacterId();

        for (let attempt = 1; attempt <= BOOTSTRAP_RETRY_COUNT; attempt += 1) {
          controller = new AbortController();
          const activeController = controller;
          didTimeout = false;
          const bootstrapTimeoutMs =
            process.env.NODE_ENV === 'development'
              ? DEV_BOOTSTRAP_TIMEOUT_MS
              : BOOTSTRAP_TIMEOUT_MS;
          const timeoutId = window.setTimeout(() => {
            didTimeout = true;
            controller?.abort();
          }, bootstrapTimeoutMs);

          try {
            const params = new URLSearchParams();
            if (selectedCharacterId) {
              params.set('characterId', selectedCharacterId);
            }

            let response = await fetch(
              `/api/simulator/current${params.size > 0 ? `?${params.toString()}` : ''}`,
              {
                method: 'GET',
                cache: 'no-store',
                signal: activeController.signal,
              }
            );

            if (selectedCharacterId && response.ok) {
              const nextPayload = await response
                .clone()
                .json()
                .catch(() => null);
              if (nextPayload?.code !== 0) {
                clearSelectedSimulatorCharacterId();
                response = await fetch('/api/simulator/current', {
                  method: 'GET',
                  cache: 'no-store',
                  signal: activeController.signal,
                });
              }
            }

            if (response.ok && !selectedCharacterId) {
              const nextPayload = await response
                .clone()
                .json()
                .catch(() => null);
              if (nextPayload?.code === 0 && nextPayload?.data?.character?.id) {
                setSelectedSimulatorCharacterId(nextPayload.data.character.id);
              }
            }

            if (!response.ok) {
              throw new Error(`request failed with status: ${response.status}`);
            }

            payload = await response.json();

            if (payload?.code === 0 && payload?.data?.character?.id) {
              setSelectedSimulatorCharacterId(payload.data.character.id);
            }
            break;
          } catch (error) {
            if (
              attempt === BOOTSTRAP_RETRY_COUNT ||
              !shouldRetryBootstrapRequest(error)
            ) {
              throw error;
            }

            await new Promise((resolve) =>
              window.setTimeout(resolve, attempt * 400)
            );
          } finally {
            window.clearTimeout(timeoutId);
          }
        }

        if (!cancelled && payload?.code === 0 && payload?.data) {
          applySimulatorBundleToStore(payload.data);
          try {
            await loadSimulatorCandidateEquipmentToStore();
            if (cancelled) {
              return;
            }
            setBootstrapNotice(
              '当前展示的是云端 D1 角色数据，候选装备库也会在当前状态同步加载；实验室数据会在进入实验室后再加载'
            );
          } catch (candidateError) {
            console.error(
              'Failed to bootstrap simulator candidate equipment:',
              candidateError
            );
            if (cancelled) {
              return;
            }
            setBootstrapNotice(
              '当前展示的是云端 D1 角色数据，但候选装备库这次没有同步成功；进入实验室后可再次拉取'
            );
          }
          setBootstrapError(null);
          return;
        }

        if (!cancelled) {
          setBootstrapError(payload?.message || '云端角色数据不存在');
        }
      } catch (error) {
        if (
          !(
            error instanceof Error &&
            error.name === 'AbortError' &&
            !didTimeout
          )
        ) {
          console.error('Failed to bootstrap simulator bundle:', error);
        }
        if (!cancelled) {
          setBootstrapError(
            error instanceof Error && error.name === 'AbortError' && didTimeout
              ? '云端角色数据加载超时，请稍后重试'
              : error instanceof Error && error.name === 'AbortError'
                ? null
                : '读取云端角色数据失败'
          );
        }
      } finally {
        if (!cancelled) {
          setIsBootstrapping(false);
        }
      }
    };

    void bootstrap();

    return () => {
      cancelled = true;
      controller?.abort();
    };
  }, [isSessionPending, session?.user?.id]);

  useEffect(() => {
    const handleOpenLab = () => {
      setMainTab('lab');
    };

    window.addEventListener(SIMULATOR_OPEN_LAB_EVENT, handleOpenLab);
    return () => {
      window.removeEventListener(SIMULATOR_OPEN_LAB_EVENT, handleOpenLab);
    };
  }, []);

  useEffect(() => {
    if (authViewState !== 'ready') {
      return;
    }

    setAutoRecalculateDerivedStats(true, {
      restoreCloudState: mainTab === 'status',
    });
  }, [authViewState, mainTab, setAutoRecalculateDerivedStats]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const handleOffline = () => {
      toast.error('请检查网络', {
        description: '当前网络不可用，云端同步会在网络恢复后继续。',
      });
    };

    const handleOnline = () => {
      toast.success('网络已恢复', {
        description: '现在可以继续同步角色、装备和战斗参数。',
      });
    };

    if (isNavigatorOffline()) {
      handleOffline();
    }

    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);

    return () => {
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
    };
  }, []);

  if (
    authViewState === 'checking-session' ||
    authViewState === 'bootstrapping'
  ) {
    return (
      <div
        className={`flex h-screen items-center justify-center ${
          isLightTheme
            ? 'bg-gradient-to-br from-amber-50 via-stone-100 to-amber-100'
            : 'bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900'
        }`}
      >
        <div
          className={`rounded-2xl border px-6 py-4 shadow-2xl ${
            isLightTheme
              ? 'border-amber-300 bg-white/90 text-amber-950'
              : 'border-yellow-800/50 bg-slate-950/70 text-yellow-100'
          }`}
        >
          {authViewState === 'checking-session'
            ? '正在确认登录状态...'
            : '正在加载云端角色数据...'}
        </div>
      </div>
    );
  }

  if (authViewState === 'signed-out') {
    return (
      <div
        className={`flex h-screen items-center justify-center p-6 ${
          isLightTheme
            ? 'bg-gradient-to-br from-amber-50 via-stone-100 to-amber-100'
            : 'bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900'
        }`}
      >
        <div
          className={`w-full max-w-2xl rounded-3xl border p-8 shadow-2xl ${
            isLightTheme
              ? 'border-amber-300 bg-white/92 shadow-amber-950/10'
              : 'border-yellow-700/40 bg-slate-950/85 shadow-black/30'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-yellow-500 to-amber-700 text-lg font-bold text-slate-950">
              梦
            </div>
            <div>
              <h1 className="text-2xl font-bold text-yellow-100">
                梦幻数值实验室
              </h1>
              <p className="mt-1 text-sm text-slate-400">
                登录后即可从云端 D1 读取角色快照、装备与技能数据。
              </p>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Badge
              className="border-yellow-600/40 bg-yellow-500/10 text-yellow-200 hover:bg-yellow-500/10"
              variant="outline"
            >
              需要登录
            </Badge>
            <Badge
              className="border-slate-600/40 bg-slate-800/70 text-slate-200 hover:bg-slate-800/70"
              variant="outline"
            >
              数据源: Cloudflare D1
            </Badge>
          </div>

          <div className="mt-8 grid gap-4 rounded-2xl border border-slate-800 bg-slate-900/60 p-5 text-sm text-slate-300">
            <p>这个页面已经接入真实数据库，但当前浏览器还没有登录会话。</p>
            <p>
              登录或注册成功后，页面会自动重新请求 ` /api/simulator/current
              `并展示你的云端角色数据。
            </p>
          </div>

          <div className="mt-8 flex flex-wrap gap-3">
            <Button
              className="bg-yellow-500 text-slate-950 hover:bg-yellow-400"
              onClick={() => {
                setSignModalMode('sign-in');
                setIsShowSignModal(true);
              }}
            >
              <LogIn className="mr-2 h-4 w-4" />
              登录
            </Button>

            <Button
              variant="outline"
              className="border-yellow-700/50 bg-slate-900/40 text-yellow-100 hover:bg-slate-800"
              onClick={() => {
                setSignModalMode('sign-up');
                setIsShowSignModal(true);
              }}
            >
              <UserPlus className="mr-2 h-4 w-4" />
              注册
            </Button>

            <Button
              asChild
              variant="ghost"
              className="text-slate-300 hover:bg-slate-800 hover:text-yellow-100"
            >
              <Link
                href={`/sign-in?callbackUrl=${encodeURIComponent(callbackUrl)}`}
              >
                前往登录页
              </Link>
            </Button>
          </div>

          <p className="mt-6 text-xs text-slate-500">
            如果你已经登录但还停留在这里，通常是会话还没建立完成，刷新一次页面即可。
          </p>
        </div>
        <SignModal callbackUrl={callbackUrl} initialMode={signModalMode} />
      </div>
    );
  }

  if (authViewState === 'error') {
    return (
      <div
        className={`flex h-screen items-center justify-center p-6 ${
          isLightTheme
            ? 'bg-gradient-to-br from-amber-50 via-stone-100 to-amber-100'
            : 'bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900'
        }`}
      >
        <div
          className={`max-w-xl rounded-2xl border px-6 py-5 text-center shadow-2xl ${
            isLightTheme
              ? 'border-red-300 bg-white/92'
              : 'border-red-700/50 bg-slate-950/80'
          }`}
        >
          <h2 className="text-lg font-bold text-red-300">
            未能加载云端角色数据
          </h2>
          <p className="mt-2 text-sm text-slate-300">{bootstrapError}</p>
          <p className="mt-3 text-xs text-slate-500">
            如果这是刚注册的新用户，重新刷新一次页面即可触发懒创建；如果仍失败，再检查
            D1 连接和会话状态。
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`flex h-screen flex-col overflow-hidden ${
        isLightTheme
          ? 'bg-gradient-to-br from-amber-50 via-stone-100 to-amber-100'
          : 'bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900'
      }`}
    >
      <div className="h-1 flex-shrink-0 bg-gradient-to-r from-transparent via-yellow-500/80 to-transparent" />

      <div className="flex items-center justify-between border-b border-yellow-800/30 bg-slate-950/40 px-6 py-4">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-yellow-600 to-yellow-700 text-lg font-bold text-slate-900 shadow-lg">
              梦
            </div>
            <div>
              <h1 className="text-lg font-bold text-yellow-100">
                梦幻数值实验室
              </h1>
              <p className="text-xs text-yellow-600">
                Fantasy Westward Journey Combat Simulator
              </p>
            </div>
          </div>

          <div className="mx-2 h-6 w-px bg-yellow-800/40" />
          <AccountSwitcher />

          <div className="ml-4 flex rounded-xl border-2 border-yellow-700/35 bg-slate-900/60 p-1.5 shadow-lg shadow-black/20">
            <button
              className={`rounded-lg px-8 py-2.5 text-sm font-bold transition-all duration-200 ${
                mainTab === 'status'
                  ? 'scale-105 bg-gradient-to-r from-yellow-500 to-amber-600 text-slate-950 shadow-lg shadow-amber-950/30'
                  : 'text-yellow-100/72 hover:bg-yellow-950/20 hover:text-yellow-100'
              }`}
              onClick={() => setMainTab('status')}
            >
              当前状态
            </button>
            <button
              className={`rounded-lg px-8 py-2.5 text-sm font-bold transition-all duration-200 ${
                mainTab === 'lab'
                  ? 'scale-105 bg-gradient-to-r from-yellow-500 to-amber-600 text-slate-950 shadow-lg shadow-amber-950/30'
                  : 'text-yellow-100/72 hover:bg-yellow-950/20 hover:text-yellow-100'
              }`}
              onClick={() => setMainTab('lab')}
            >
              实验室
            </button>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setShowAI(!showAI)}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 transition-all ${
              showAI
                ? 'bg-yellow-600 text-slate-900'
                : 'border border-yellow-700/60 bg-slate-900/60 text-yellow-400 hover:border-yellow-600/80'
            }`}
          >
            <MessageSquare className="h-4 w-4" />
            <span className="text-sm font-medium">AI 顾问</span>
          </motion.button>
        </div>
      </div>

      {bootstrapNotice && (
        <div className="border-b border-yellow-800/20 bg-slate-950/30 px-6 py-3">
          <div className="text-xs text-yellow-200/90">{bootstrapNotice}</div>
        </div>
      )}

      <div className="flex min-h-0 flex-1 gap-6 overflow-hidden px-6 py-5">
        {mainTab === 'status' ? (
          <>
            <div className="flex h-full flex-1 flex-col overflow-hidden">
              <CharacterPanel />
            </div>
            <div className="flex h-full flex-1 flex-col overflow-hidden">
              <EquipmentPanel />
            </div>
            <div className="flex h-full flex-1 flex-col overflow-hidden">
              <div className="flex h-full flex-col gap-4 overflow-hidden">
                <div className="rounded-2xl border border-yellow-800/60 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 shadow-2xl">
                  <div className="flex items-center justify-between border-b border-yellow-700/60 bg-gradient-to-r from-yellow-900/50 to-yellow-800/30 px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-yellow-600">
                        <TrendingUp className="h-5 w-5 text-slate-900" />
                      </div>
                      <div>
                        <h2 className="text-base font-bold text-yellow-100">
                          最终面板
                        </h2>
                        <p className="text-xs text-yellow-400/80">
                          OCR 基准面板 + 当前增量联动结果
                        </p>
                      </div>
                    </div>
                    <div className="rounded-lg border border-yellow-700/40 bg-slate-900/60 px-3 py-1.5 text-xs text-yellow-100">
                      {currentCharacter?.name || '未命名角色'}
                    </div>
                  </div>

                  <div className="space-y-4 p-4">
                    <div className="grid grid-cols-2 gap-2">
                      <div className="rounded-xl border border-cyan-800/30 bg-cyan-950/10 px-3 py-3">
                        <div className="text-[11px] text-cyan-200/70">
                          基线来源
                        </div>
                        <div className="mt-1 text-sm font-semibold text-cyan-100">
                          {currentCharacter
                            ? '当前角色 OCR 面板真值'
                            : '当前角色档案'}
                        </div>
                      </div>
                      <div className="rounded-xl border border-yellow-800/30 bg-yellow-950/10 px-3 py-3">
                        <div className="text-[11px] text-yellow-200/70">
                          增量来源
                        </div>
                        <div className="mt-1 text-sm font-semibold text-yellow-100">
                          装备 / 修炼 / 经脉 / 神器联动结果
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {panelSummaryBadges.map((item) => {
                        const Icon = item.icon;

                        return (
                          <div
                            key={item.label}
                            className="inline-flex min-w-[calc(50%-0.25rem)] flex-1 items-center gap-2 rounded-xl border border-yellow-800/30 bg-slate-900/50 px-3 py-2"
                          >
                            <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-yellow-700/30 bg-yellow-500/10 text-yellow-200">
                              <Icon className="h-4 w-4" />
                            </div>
                            <div className="min-w-0">
                              <div className="text-[11px] text-yellow-300/70">
                                {item.label}
                              </div>
                              <div className="truncate text-sm font-semibold text-yellow-100">
                                {item.value}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                      {FINAL_PANEL_FOCUS_STATS.map((item) => (
                        <div
                          key={item.key}
                          className={`rounded-xl border px-3 py-3 ${
                            ACCENT_CLASS_MAP[item.accent]
                          }`}
                        >
                          <div className="text-[11px] opacity-75">
                            {item.label}
                          </div>
                          <div className="mt-1 text-2xl leading-none font-bold">
                            {combatStats[item.key] ?? 0}
                          </div>
                          <div className="mt-2 text-[10px] opacity-70">
                            {item.sublabel}
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="rounded-xl border border-indigo-800/30 bg-indigo-950/10 p-3">
                      <div className="mb-3 flex items-start justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-indigo-700/40 bg-indigo-500/10 text-indigo-100">
                            <Compass className="h-4 w-4" />
                          </div>
                          <div>
                            <div className="text-sm font-semibold text-slate-100">
                              试算语境
                            </div>
                            <div className="text-[11px] leading-5 text-indigo-200/75">
                              当前右侧结论面板所采用的战斗环境与目标上下文
                            </div>
                          </div>
                        </div>
                        <div className="rounded-md border border-indigo-800/40 bg-slate-950/50 px-2 py-1 text-[10px] text-indigo-100/80">
                          技能：{selectedSkill?.name || '龙卷雨击'}
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2 xl:grid-cols-3">
                        {battleQuickFacts.map((item) => (
                          <div
                            key={item.label}
                            className="rounded-lg border border-slate-800/70 bg-slate-950/55 px-3 py-2"
                          >
                            <div className="text-[11px] text-slate-400">
                              {item.label}
                            </div>
                            <div className="mt-1 text-sm font-semibold text-slate-100">
                              {item.value}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="grid gap-3">
                      {finalPanelSectionStats.map((section, index) => {
                        const accent =
                          SECTION_ACCENT_CLASS_MAP[
                            section.accent as keyof typeof SECTION_ACCENT_CLASS_MAP
                          ];
                        const Icon =
                          index === 0
                            ? Crosshair
                            : index === 1
                              ? Heart
                              : Wind;

                        return (
                          <div
                            key={section.title}
                            className={`rounded-xl border p-3 ${accent.card}`}
                          >
                            <div className="mb-3 flex items-start justify-between gap-3">
                              <div className="flex items-center gap-2">
                                <div
                                  className={`flex h-8 w-8 items-center justify-center rounded-lg border ${accent.icon}`}
                                >
                                  <Icon className="h-4 w-4" />
                                </div>
                                <div>
                                  <div className="text-sm font-semibold text-slate-100">
                                    {section.title}
                                  </div>
                                  <div
                                    className={`text-[11px] leading-5 ${accent.text}`}
                                  >
                                    {section.description}
                                  </div>
                                </div>
                              </div>
                            </div>
                            <div className="grid grid-cols-2 gap-2 xl:grid-cols-3">
                              {section.stats.map((item) => (
                                <div
                                  key={item.key}
                                  className="rounded-lg border border-slate-800/70 bg-slate-950/55 px-3 py-2"
                                >
                                  <div className="text-[11px] text-slate-400">
                                    {item.label}
                                  </div>
                                  <div className="mt-1 text-lg font-semibold text-slate-100">
                                    {item.value}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <div className="rounded-xl border border-cyan-800/30 bg-cyan-950/10 p-3">
                      <div className="mb-2 flex items-center justify-between gap-3">
                        <div>
                          <div className="text-sm font-semibold text-cyan-100">
                            关键字段来源
                          </div>
                          <div className="mt-1 text-[11px] text-cyan-200/70">
                            当前只展开最关键的 6 项，方便快速判断这轮提升来自哪里
                          </div>
                        </div>
                        <div className="rounded-md border border-cyan-800/40 bg-slate-950/50 px-2 py-1 text-[10px] text-cyan-100/80">
                          点击右侧箭头查看完整来源
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        {panelSourceBreakdowns.map((item) => (
                          <div
                            key={item.key}
                            className="rounded-lg border border-cyan-900/40 bg-slate-950/40 px-3 py-2"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-slate-300">
                                {item.label}
                              </span>
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-cyan-100">
                                  {item.total}
                                </span>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setExpandedFinalSourceKey((current) =>
                                      current === item.key ? null : item.key
                                    )
                                  }
                                  className="rounded border border-cyan-700/30 bg-cyan-500/10 px-1.5 py-0.5 text-[10px] text-cyan-100 transition-colors hover:border-cyan-500/50 hover:bg-cyan-500/15"
                                >
                                  {expandedFinalSourceKey === item.key ? (
                                    <ChevronUp className="h-3 w-3" />
                                  ) : (
                                    <ChevronDown className="h-3 w-3" />
                                  )}
                                </button>
                              </div>
                            </div>
                            <div className="mt-1 text-[10px] text-slate-500">
                              基线 {item.baseline}
                            </div>
                            <div className="mt-1 text-[10px] leading-5 text-cyan-100/75">
                              {buildPanelSourceBreakdownSummary(item, 1)}
                            </div>
                            <div className="mt-2 flex flex-wrap gap-1">
                              {item.sources.length > 0 ? (
                                item.sources.slice(0, 2).map((source) => (
                                  <span
                                    key={`${item.key}-${source.label}`}
                                    className={`rounded border px-1.5 py-0.5 text-[10px] ${
                                      source.value > 0
                                        ? 'border-emerald-700/30 bg-emerald-500/10 text-emerald-200'
                                        : 'border-red-700/30 bg-red-500/10 text-red-200'
                                    }`}
                                  >
                                    {source.label}
                                    {source.value > 0 ? ' +' : ' '}
                                    {source.value}
                                  </span>
                                ))
                              ) : (
                                <span className="text-[10px] text-slate-500">
                                  无增量
                                </span>
                              )}
                            </div>
                            {expandedFinalSourceKey === item.key && (
                              <div className="mt-2 rounded-md border border-cyan-900/30 bg-cyan-950/10 p-2 text-[10px]">
                                <div className="flex items-center justify-between text-slate-400">
                                  <span>总增量</span>
                                  <span
                                    className={
                                      item.delta > 0
                                        ? 'text-emerald-300'
                                        : item.delta < 0
                                          ? 'text-red-300'
                                          : 'text-slate-200'
                                    }
                                  >
                                    {formatPanelSourceSignedValue(item.delta)}
                                  </span>
                                </div>
                                <div className="mt-2 space-y-1">
                                  {item.sourceDetails.length > 0 ? (
                                    item.sourceDetails.map(
                                      (group, groupIndex) => (
                                        <div
                                          key={`${item.key}-final-group-${group.label}`}
                                          className="rounded border border-slate-800/80 bg-slate-950/55 p-1.5"
                                        >
                                          <div className="mb-1 flex items-center justify-between text-[10px] text-slate-400">
                                            <span className="text-cyan-100/80">
                                              {groupIndex === 0
                                                ? `主因来源 · ${group.label}`
                                                : groupIndex === 1
                                                  ? `次因来源 · ${group.label}`
                                                  : group.label}
                                            </span>
                                            <span>{group.items.length} 项</span>
                                          </div>
                                          <div className="space-y-1">
                                            {sortPanelSourceValueItems(
                                              group.items
                                            ).map((source) => (
                                              <div
                                                key={`${item.key}-final-${group.label}-${source.label}`}
                                                className="rounded border border-slate-800/80 bg-slate-950/70 px-2 py-1"
                                              >
                                                <div className="flex items-center justify-between gap-2">
                                                  <span className="text-slate-300">
                                                    {source.label}
                                                  </span>
                                                  <span
                                                    className={
                                                      source.value > 0
                                                        ? 'text-emerald-300'
                                                        : 'text-red-300'
                                                    }
                                                  >
                                                    {formatPanelSourceSignedValue(
                                                      source.value
                                                    )}
                                                  </span>
                                                </div>
                                                {source.note ? (
                                                  <div className="mt-1 text-[9px] leading-4 text-slate-500">
                                                    {source.note}
                                                  </div>
                                                ) : null}
                                              </div>
                                            ))}
                                          </div>
                                        </div>
                                      )
                                    )
                                  ) : item.sources.length > 0 ? (
                                    sortPanelSourceValueItems(item.sources).map(
                                      (source, index) => (
                                        <div
                                          key={`${item.key}-final-${source.label}`}
                                          className="flex items-center justify-between rounded border border-slate-800/80 bg-slate-950/60 px-2 py-1"
                                        >
                                          <span className="text-slate-300">
                                            {index === 0
                                              ? `主因 · ${source.label}`
                                              : index === 1
                                                ? `次因 · ${source.label}`
                                                : source.label}
                                          </span>
                                          <span
                                            className={
                                              source.value > 0
                                                ? 'text-emerald-300'
                                                : 'text-red-300'
                                            }
                                          >
                                            {formatPanelSourceSignedValue(
                                              source.value
                                            )}
                                          </span>
                                        </div>
                                      )
                                    )
                                  ) : (
                                    <div className="text-slate-500">
                                      当前没有更多来源明细
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="grid grid-cols-4 gap-2">
                      {cultivationSummary.map((item) => (
                        <div
                          key={item.label}
                          className="rounded-xl border border-cyan-800/30 bg-cyan-950/10 px-3 py-2"
                        >
                          <div className="text-[11px] text-cyan-200/70">
                            {item.label}
                          </div>
                          <div className="mt-1 text-lg font-semibold text-cyan-100">
                            {item.value}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="min-h-0 rounded-2xl border border-yellow-800/60 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 shadow-2xl">
                  <button
                    type="button"
                    onClick={() =>
                      setIsCombatPanelExpanded((current) => !current)
                    }
                    className="flex w-full items-center justify-between border-b border-yellow-700/60 bg-gradient-to-r from-yellow-900/50 to-yellow-800/30 px-5 py-4 text-left"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-yellow-600">
                        <Shield className="h-5 w-5 text-slate-900" />
                      </div>
                      <div>
                        <h2 className="text-base font-bold text-yellow-100">
                          战斗参数
                        </h2>
                        <p className="text-xs text-yellow-400/80">
                          默认收起，需要推演时再展开
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-yellow-100/80">
                      <span>
                        {isCombatPanelExpanded
                          ? '收起参数面板'
                          : '展开参数面板'}
                      </span>
                      {isCombatPanelExpanded ? (
                        <ChevronUp className="h-4 w-4" />
                      ) : (
                        <ChevronDown className="h-4 w-4" />
                      )}
                    </div>
                  </button>

                  {isCombatPanelExpanded ? (
                    <div className="h-[calc(100%-73px)] min-h-0 p-3">
                      <CombatPanel />
                    </div>
                  ) : (
                    <div className="space-y-3 p-4">
                      <div className="rounded-xl border border-yellow-800/30 bg-slate-900/40 p-4">
                        <div className="text-sm font-semibold text-yellow-200">
                          当前主界面先聚焦角色与面板结果
                        </div>
                        <div className="mt-1 text-xs leading-6 text-slate-400">
                          阵法、五行、目标、防御状态、副本模板这些推演参数已经收进这里，只有在做伤害试算时再打开，平时不会抢占主操作区域。
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="rounded-xl border border-emerald-800/30 bg-emerald-950/10 p-3">
                          <div className="text-[11px] text-emerald-200/70">
                            当前法伤
                          </div>
                          <div className="mt-1 text-xl font-semibold text-emerald-100">
                            {combatStats.magicDamage ?? 0}
                          </div>
                        </div>
                        <div className="rounded-xl border border-sky-800/30 bg-sky-950/10 p-3">
                          <div className="text-[11px] text-sky-200/70">
                            当前速度
                          </div>
                          <div className="mt-1 text-xl font-semibold text-sky-100">
                            {combatStats.speed ?? 0}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </>
        ) : (
          <LaboratoryPanel />
        )}
      </div>

      <div className="h-1 flex-shrink-0 bg-gradient-to-r from-transparent via-yellow-500/80 to-transparent" />

      <EquipmentReplaceDialog />

      <AnimatePresence>
        {showAI && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowAI(false)}
              className="fixed inset-0 z-[9998] bg-black/60 backdrop-blur-sm"
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: -20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: -20 }}
              transition={{ type: 'spring', duration: 0.5, bounce: 0.3 }}
              className="fixed top-1/2 left-1/2 z-[9999] h-[700px] w-[600px] -translate-x-1/2 -translate-y-1/2"
            >
              <div className="flex h-full flex-col overflow-hidden rounded-2xl border-2 border-yellow-700/60 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 shadow-2xl">
                <div className="flex items-center justify-between border-b border-yellow-700/60 bg-gradient-to-r from-yellow-900/50 to-yellow-800/30 px-5 py-4">
                  <div className="flex items-center gap-3">
                    <MessageSquare className="h-5 w-5 text-yellow-400" />
                    <h2 className="text-base font-bold text-yellow-100">
                      AI 顾问
                    </h2>
                  </div>
                  <button
                    onClick={() => setShowAI(false)}
                    className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-900/60 text-yellow-400 transition-all hover:bg-slate-800/80"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                <div className="flex-1 overflow-hidden">
                  <AiChat />
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

    </div>
  );
}
