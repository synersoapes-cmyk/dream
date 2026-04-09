'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Check,
  ChevronDown,
  Cloud,
  Loader2,
  LogOut,
  Pencil,
  Plus,
  Trash2,
  User,
} from 'lucide-react';
import { toast } from 'sonner';

import { signOut, useSession } from '@/core/auth/client';
import { useRouter } from '@/core/i18n/navigation';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/shared/components/ui/dropdown-menu';
import { useGameStore } from '@/features/simulator/store/gameStore';
import {
  clearSelectedSimulatorCharacterId,
  setSelectedSimulatorCharacterId,
} from '@/features/simulator/utils/characterSelection';
import { applySimulatorBundleToStore } from '@/features/simulator/utils/simulatorBundle';

type CharacterSummary = {
  id: string;
  name: string;
  school: string;
  level: number;
};

export function AccountSwitcher() {
  const router = useRouter();
  const { data: session } = useSession();
  const currentCharacter = useGameStore((state) => state.currentCharacter);
  const [characters, setCharacters] = useState<CharacterSummary[]>([]);
  const [isLoadingCharacters, setIsLoadingCharacters] = useState(false);
  const [isSwitchingCharacter, setIsSwitchingCharacter] = useState(false);
  const [isCreatingCharacter, setIsCreatingCharacter] = useState(false);
  const [isRenamingCharacter, setIsRenamingCharacter] = useState(false);
  const [isDeletingCharacter, setIsDeletingCharacter] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const sessionUser = session?.user;

  const fallbackCharacters = useMemo(() => {
    if (!currentCharacter) {
      return [] as CharacterSummary[];
    }

    return [
      {
        id: currentCharacter.id,
        name: currentCharacter.name,
        school: currentCharacter.school,
        level: currentCharacter.level,
      },
    ];
  }, [currentCharacter]);

  const characterOptions = characters.length > 0 ? characters : fallbackCharacters;
  const activeCharacter =
    characterOptions.find((character) => character.id === currentCharacter?.id) ??
    characterOptions[0] ??
    null;

  const loadCharacters = async () => {
    if (!session?.user?.id) {
      setCharacters([]);
      return;
    }

    setIsLoadingCharacters(true);
    try {
      const response = await fetch('/api/simulator/characters', {
        method: 'GET',
        cache: 'no-store',
      });
      const payload = await response.json();
      if (!response.ok || payload?.code !== 0 || !Array.isArray(payload?.data)) {
        throw new Error(payload?.message || '读取角色列表失败');
      }

      setCharacters(payload.data);
    } catch (error) {
      console.error('Failed to load simulator characters:', error);
    } finally {
      setIsLoadingCharacters(false);
    }
  };

  useEffect(() => {
    void loadCharacters();
  }, [session?.user?.id]);

  const handleCharacterSelect = async (characterId: string) => {
    if (!characterId || characterId === currentCharacter?.id || isSwitchingCharacter) {
      return;
    }

    setIsSwitchingCharacter(true);
    try {
      const response = await fetch(
        `/api/simulator/current?characterId=${encodeURIComponent(characterId)}`,
        {
          method: 'GET',
          cache: 'no-store',
        }
      );
      const payload = await response.json();
      if (!response.ok || payload?.code !== 0 || !payload?.data) {
        throw new Error(payload?.message || '切换角色失败');
      }

      applySimulatorBundleToStore(payload.data);
      setSelectedSimulatorCharacterId(payload.data.character.id);
      await loadCharacters();
      toast.success(`已切换到 ${payload.data.character.name}`);
    } catch (error) {
      console.error('Failed to switch simulator character:', error);
      toast.error(error instanceof Error ? error.message : '切换角色失败');
    } finally {
      setIsSwitchingCharacter(false);
    }
  };

  const handleCreateCharacter = async () => {
    if (isCreatingCharacter) {
      return;
    }

    const input = window.prompt('输入新角色名称');
    const name = String(input || '').trim();
    if (!name) {
      return;
    }

    setIsCreatingCharacter(true);
    try {
      const response = await fetch('/api/simulator/characters', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name }),
      });
      const payload = await response.json();
      if (!response.ok || payload?.code !== 0 || !payload?.data) {
        throw new Error(payload?.message || '创建角色失败');
      }

      applySimulatorBundleToStore(payload.data);
      setSelectedSimulatorCharacterId(payload.data.character.id);
      await loadCharacters();
      toast.success(`已创建角色 ${payload.data.character.name}`);
    } catch (error) {
      console.error('Failed to create simulator character:', error);
      toast.error(error instanceof Error ? error.message : '创建角色失败');
    } finally {
      setIsCreatingCharacter(false);
    }
  };

  const handleRenameCharacter = async () => {
    if (!activeCharacter?.id || isRenamingCharacter) {
      return;
    }

    const input = window.prompt('输入新的角色名称', activeCharacter.name);
    const name = String(input || '').trim();
    if (!name || name === activeCharacter.name) {
      return;
    }

    setIsRenamingCharacter(true);
    try {
      const renameResponse = await fetch(
        `/api/simulator/characters/${encodeURIComponent(activeCharacter.id)}`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ name }),
        }
      );
      const renamePayload = await renameResponse.json();
      if (!renameResponse.ok || renamePayload?.code !== 0) {
        throw new Error(renamePayload?.message || '重命名角色失败');
      }

      const bundleResponse = await fetch(
        `/api/simulator/current?characterId=${encodeURIComponent(activeCharacter.id)}`,
        {
          method: 'GET',
          cache: 'no-store',
        }
      );
      const bundlePayload = await bundleResponse.json();
      if (!bundleResponse.ok || bundlePayload?.code !== 0 || !bundlePayload?.data) {
        throw new Error(bundlePayload?.message || '刷新角色失败');
      }

      applySimulatorBundleToStore(bundlePayload.data);
      setSelectedSimulatorCharacterId(bundlePayload.data.character.id);
      await loadCharacters();
      toast.success(`已重命名为 ${bundlePayload.data.character.name}`);
    } catch (error) {
      console.error('Failed to rename simulator character:', error);
      toast.error(error instanceof Error ? error.message : '重命名角色失败');
    } finally {
      setIsRenamingCharacter(false);
    }
  };

  const handleSignOut = async () => {
    if (isSigningOut) {
      return;
    }

    setIsSigningOut(true);

    await signOut({
      fetchOptions: {
        onSuccess: () => {
          clearSelectedSimulatorCharacterId();
          router.push('/');
          router.refresh();
        },
        onError: () => {
          setIsSigningOut(false);
        },
      },
    });
  };

  const handleDeleteCharacter = async () => {
    if (!activeCharacter?.id || isDeletingCharacter) {
      return;
    }

    if (characterOptions.length <= 1) {
      toast.error('至少保留一个角色');
      return;
    }

    const confirmed = window.confirm(
      `确认删除角色「${activeCharacter.name}」吗？该角色将从当前角色列表中移除。`
    );
    if (!confirmed) {
      return;
    }

    setIsDeletingCharacter(true);
    try {
      const response = await fetch(
        `/api/simulator/characters/${encodeURIComponent(activeCharacter.id)}`,
        {
          method: 'DELETE',
        }
      );
      const payload = await response.json();
      if (!response.ok || payload?.code !== 0 || !payload?.data?.nextCharacterId) {
        throw new Error(payload?.message || '删除角色失败');
      }

      const nextCharacterId = String(payload.data.nextCharacterId);
      const bundleResponse = await fetch(
        `/api/simulator/current?characterId=${encodeURIComponent(nextCharacterId)}`,
        {
          method: 'GET',
          cache: 'no-store',
        }
      );
      const bundlePayload = await bundleResponse.json();
      if (!bundleResponse.ok || bundlePayload?.code !== 0 || !bundlePayload?.data) {
        throw new Error(bundlePayload?.message || '切换到下一个角色失败');
      }

      applySimulatorBundleToStore(bundlePayload.data);
      setSelectedSimulatorCharacterId(bundlePayload.data.character.id);
      await loadCharacters();
      toast.success(
        `已删除角色，当前切换到 ${payload.data.nextCharacterName || bundlePayload.data.character.name}`
      );
    } catch (error) {
      console.error('Failed to delete simulator character:', error);
      toast.error(error instanceof Error ? error.message : '删除角色失败');
    } finally {
      setIsDeletingCharacter(false);
    }
  };

  const isBusy =
    isLoadingCharacters ||
    isSwitchingCharacter ||
    isCreatingCharacter ||
    isRenamingCharacter ||
    isDeletingCharacter ||
    isSigningOut;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="h-auto rounded-xl border border-yellow-800/40 bg-slate-900/60 px-4 py-2 shadow-lg hover:bg-slate-900/80"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-yellow-500/15 text-yellow-400">
              <User className="h-4 w-4" />
            </div>

            <div className="min-w-0 text-left">
              <div className="truncate text-sm font-semibold text-yellow-100">
                {activeCharacter?.name || 'Current Character'}
              </div>
              <div className="text-[11px] text-slate-400">
                {activeCharacter
                  ? `${activeCharacter.school} · ${activeCharacter.level}级`
                  : 'Synced from Cloudflare D1'}
              </div>
            </div>

            <Badge
              variant="outline"
              className="border-emerald-700/40 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/10"
            >
              <Cloud className="mr-1 h-3 w-3" />
              Cloud
            </Badge>

            {isBusy ? (
              <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
            ) : (
              <ChevronDown className="h-4 w-4 text-slate-400" />
            )}
          </div>
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="start"
        className="w-80 border-yellow-800/40 bg-slate-950/95 text-slate-100"
      >
        <DropdownMenuLabel className="space-y-1">
          <div className="text-sm font-semibold text-yellow-100">
            {sessionUser?.name || '当前账号'}
          </div>
          <div className="truncate text-xs font-normal text-slate-400">
            {sessionUser?.email || '已连接 Cloudflare D1'}
          </div>
        </DropdownMenuLabel>

        <DropdownMenuSeparator className="bg-yellow-900/30" />

        <DropdownMenuLabel className="text-xs font-medium text-slate-400">
          云端角色
        </DropdownMenuLabel>
        {characterOptions.map((character) => {
          const isActive = character.id === currentCharacter?.id;
          return (
            <DropdownMenuItem
              key={character.id}
              className="cursor-pointer justify-between gap-3 focus:bg-slate-900/80"
              disabled={isSwitchingCharacter}
              onClick={() => {
                void handleCharacterSelect(character.id);
              }}
            >
              <div className="min-w-0">
                <div className="truncate text-sm text-yellow-100">{character.name}</div>
                <div className="text-[11px] text-slate-400">
                  {character.school} · {character.level}级
                </div>
              </div>
              {isActive ? <Check className="h-4 w-4 text-emerald-400" /> : null}
            </DropdownMenuItem>
          );
        })}

        <DropdownMenuSeparator className="bg-yellow-900/30" />

        <DropdownMenuItem
          className="cursor-pointer focus:bg-slate-900/80"
          disabled={isCreatingCharacter}
          onClick={() => {
            void handleCreateCharacter();
          }}
        >
          {isCreatingCharacter ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Plus className="mr-2 h-4 w-4" />
          )}
          <span>新建角色</span>
        </DropdownMenuItem>

        <DropdownMenuItem
          className="cursor-pointer focus:bg-slate-900/80"
          disabled={!activeCharacter || isRenamingCharacter}
          onClick={() => {
            void handleRenameCharacter();
          }}
        >
          {isRenamingCharacter ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Pencil className="mr-2 h-4 w-4" />
          )}
          <span>重命名当前角色</span>
        </DropdownMenuItem>

        <DropdownMenuItem
          className="cursor-pointer text-red-300 focus:bg-red-950/30 focus:text-red-200"
          disabled={!activeCharacter || isDeletingCharacter || characterOptions.length <= 1}
          onClick={() => {
            void handleDeleteCharacter();
          }}
        >
          {isDeletingCharacter ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Trash2 className="mr-2 h-4 w-4" />
          )}
          <span>
            {characterOptions.length <= 1 ? '至少保留一个角色' : '删除当前角色'}
          </span>
        </DropdownMenuItem>

        <DropdownMenuSeparator className="bg-yellow-900/30" />

        <DropdownMenuItem
          className="cursor-pointer text-red-300 focus:bg-red-950/40 focus:text-red-200"
          disabled={isSigningOut}
          onClick={() => {
            void handleSignOut();
          }}
        >
          {isSigningOut ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <LogOut className="mr-2 h-4 w-4" />
          )}
          <span>{isSigningOut ? '退出中...' : '退出登录'}</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
