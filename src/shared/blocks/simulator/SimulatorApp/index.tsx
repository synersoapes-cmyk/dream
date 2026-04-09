'use client';

import { useEffect, useMemo, useState } from 'react';
import { LogIn, MessageSquare, UserPlus, X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';

import { useSession } from '@/core/auth/client';
import { Link, usePathname } from '@/core/i18n/navigation';
import { CharacterPanel, CombatPanel, EquipmentPanel, LaboratoryPanel } from '@/shared/blocks/simulator';
import { SignModal } from '@/shared/blocks/sign/sign-modal';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import { Toaster } from '@/shared/components/ui/sonner';
import { useAppContext } from '@/shared/contexts/app';
import { EquipmentReplaceDialog } from '@/features/simulator/overlays/EquipmentReplaceDialog';
import { AiChat } from '@/features/simulator/shell/AiChat';
import { AccountSwitcher } from '@/features/simulator/shell/AccountSwitcher';
import { useGameStore } from '@/features/simulator/store/gameStore';
import {
  clearSelectedSimulatorCharacterId,
  getSelectedSimulatorCharacterId,
  setSelectedSimulatorCharacterId,
} from '@/features/simulator/utils/characterSelection';
import { applySimulatorBundleToStore } from '@/features/simulator/utils/simulatorBundle';

const BOOTSTRAP_TIMEOUT_MS = 15_000;
const DEV_BOOTSTRAP_TIMEOUT_MS = 30_000;
const BOOTSTRAP_RETRY_COUNT = 2;

type AuthViewState = 'checking-session' | 'signed-out' | 'bootstrapping' | 'ready' | 'error';

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
  const setAutoRecalculateDerivedStats = useGameStore(
    (state) => state.setAutoRecalculateDerivedStats
  );

  const [mainTab, setMainTab] = useState<'status' | 'lab'>('status');
  const [showAI, setShowAI] = useState(false);
  const [signModalMode, setSignModalMode] =
    useState<'sign-in' | 'sign-up'>('sign-in');
  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const [bootstrapError, setBootstrapError] = useState<string | null>(null);
  const [bootstrapNotice, setBootstrapNotice] = useState<string | null>(null);

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
          const timeoutId = window.setTimeout(
            () => {
              didTimeout = true;
              controller?.abort();
            },
            bootstrapTimeoutMs,
          );

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
              },
            );

            if (
              selectedCharacterId &&
              response.ok
            ) {
              const nextPayload = await response.clone().json().catch(() => null);
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
              const nextPayload = await response.clone().json().catch(() => null);
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
            if (attempt === BOOTSTRAP_RETRY_COUNT || !shouldRetryBootstrapRequest(error)) {
              throw error;
            }

            await new Promise((resolve) => window.setTimeout(resolve, attempt * 400));
          } finally {
            window.clearTimeout(timeoutId);
          }
        }

        if (!cancelled && payload?.code === 0 && payload?.data) {
          applySimulatorBundleToStore(payload.data);
          setBootstrapError(null);
          setBootstrapNotice('当前展示的是云端 D1 角色数据，实验室数据会在进入实验室后再加载');
          return;
        }

        if (!cancelled) {
          setBootstrapError(payload?.message || '云端角色数据不存在');
        }
      } catch (error) {
        if (!(error instanceof Error && error.name === 'AbortError' && !didTimeout)) {
          console.error('Failed to bootstrap simulator bundle:', error);
        }
        if (!cancelled) {
          setBootstrapError(
            error instanceof Error && error.name === 'AbortError' && didTimeout
              ? '云端角色数据加载超时，请稍后重试'
              : error instanceof Error && error.name === 'AbortError'
                ? null
                : '读取云端角色数据失败',
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
    if (authViewState !== 'ready') {
      return;
    }

    setAutoRecalculateDerivedStats(mainTab === 'lab', {
      restoreCloudState: mainTab === 'status',
    });
  }, [authViewState, mainTab, setAutoRecalculateDerivedStats]);

  if (authViewState === 'checking-session' || authViewState === 'bootstrapping') {
    return (
      <div className="dark flex h-screen items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
        <div className="rounded-2xl border border-yellow-800/50 bg-slate-950/70 px-6 py-4 text-yellow-100 shadow-2xl">
          {authViewState === 'checking-session'
            ? '正在确认登录状态...'
            : '正在加载云端角色数据...'}
        </div>
      </div>
    );
  }

  if (authViewState === 'signed-out') {
    return (
      <div className="dark flex h-screen items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6">
        <div className="w-full max-w-2xl rounded-3xl border border-yellow-700/40 bg-slate-950/85 p-8 shadow-2xl shadow-black/30">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-yellow-500 to-amber-700 text-lg font-bold text-slate-950">
              梦
            </div>
            <div>
              <h1 className="text-2xl font-bold text-yellow-100">梦幻数值实验室</h1>
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
              登录或注册成功后，页面会自动重新请求
              ` /api/simulator/current `并展示你的云端角色数据。
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
              <Link href={`/sign-in?callbackUrl=${encodeURIComponent(callbackUrl)}`}>
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
      <div className="dark flex h-screen items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6">
        <div className="max-w-xl rounded-2xl border border-red-700/50 bg-slate-950/80 px-6 py-5 text-center shadow-2xl">
          <h2 className="text-lg font-bold text-red-300">未能加载云端角色数据</h2>
          <p className="mt-2 text-sm text-slate-300">{bootstrapError}</p>
          <p className="mt-3 text-xs text-slate-500">
            如果这是刚注册的新用户，重新刷新一次页面即可触发懒创建；如果仍失败，再检查 D1
            连接和会话状态。
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="dark flex h-screen flex-col overflow-hidden bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <div className="h-1 flex-shrink-0 bg-gradient-to-r from-transparent via-yellow-500/80 to-transparent" />

      <div className="flex items-center justify-between border-b border-yellow-800/30 bg-slate-950/40 px-6 py-4">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-yellow-600 to-yellow-700 text-lg font-bold text-slate-900 shadow-lg">
              梦
            </div>
            <div>
              <h1 className="text-lg font-bold text-yellow-100">梦幻数值实验室</h1>
              <p className="text-xs text-yellow-600">
                Fantasy Westward Journey Combat Simulator
              </p>
            </div>
          </div>

          <div className="mx-2 h-6 w-px bg-yellow-800/40" />
          <AccountSwitcher />

          <div className="ml-4 flex rounded-xl border-2 border-purple-700/50 bg-slate-900/60 p-1.5 shadow-lg shadow-purple-900/30">
            <button
              className={`rounded-lg px-8 py-2.5 text-sm font-bold transition-all duration-200 ${
                mainTab === 'status'
                  ? 'scale-105 bg-gradient-to-r from-purple-600 to-purple-700 text-white shadow-lg shadow-purple-900/50'
                  : 'text-purple-300/70 hover:bg-purple-950/30 hover:text-purple-200'
              }`}
              onClick={() => setMainTab('status')}
            >
              当前状态
            </button>
            <button
              className={`rounded-lg px-8 py-2.5 text-sm font-bold transition-all duration-200 ${
                mainTab === 'lab'
                  ? 'scale-105 bg-gradient-to-r from-purple-600 to-purple-700 text-white shadow-lg shadow-purple-900/50'
                  : 'text-purple-300/70 hover:bg-purple-950/30 hover:text-purple-200'
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
              <CombatPanel />
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
              className="fixed left-1/2 top-1/2 z-[9999] h-[700px] w-[600px] -translate-x-1/2 -translate-y-1/2"
            >
              <div className="flex h-full flex-col overflow-hidden rounded-2xl border-2 border-yellow-700/60 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 shadow-2xl">
                <div className="flex items-center justify-between border-b border-yellow-700/60 bg-gradient-to-r from-yellow-900/50 to-yellow-800/30 px-5 py-4">
                  <div className="flex items-center gap-3">
                    <MessageSquare className="h-5 w-5 text-yellow-400" />
                    <h2 className="text-base font-bold text-yellow-100">AI 顾问</h2>
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

      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
            border: '2px solid rgba(202, 138, 4, 0.5)',
            borderRadius: '12px',
            color: '#fef3c7',
            boxShadow: '0 10px 40px rgba(202, 138, 4, 0.2)',
            fontWeight: '500',
          },
          className: 'toast-custom',
        }}
      />
    </div>
  );
}
