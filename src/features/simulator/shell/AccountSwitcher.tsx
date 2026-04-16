'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useGameStore } from '@/features/simulator/store/gameStore';
import {
  clearSelectedSimulatorCharacterId,
  setSelectedSimulatorCharacterId,
} from '@/features/simulator/utils/characterSelection';
import { validateImageFile } from '@/features/simulator/utils/fileValidation';
import { applySimulatorBundleToStore } from '@/features/simulator/utils/simulatorBundle';
import {
  applySimulatorCandidateEquipmentToStore,
  loadSimulatorCandidateEquipmentToStore,
} from '@/features/simulator/utils/simulatorCandidateEquipment';
import {
  Check,
  ChevronDown,
  Cloud,
  ImagePlus,
  Loader2,
  LogOut,
  Pencil,
  Plus,
  Trash2,
  User,
  X,
} from 'lucide-react';
import { toast } from 'sonner';

import { signOut, useSession } from '@/core/auth/client';
import { useRouter } from '@/core/i18n/navigation';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/shared/components/ui/dropdown-menu';
import { Input } from '@/shared/components/ui/input';
import { Progress } from '@/shared/components/ui/progress';
import {
  SIMULATOR_EQUIPMENT_OCR_IMAGE_HINT_OPTIONS,
  type SimulatorEquipmentOcrImageHint,
} from '@/shared/lib/simulator-ocr-image-hint';
import type { SimulatorCandidateEquipmentItem } from '@/shared/models/simulator-types';

type CharacterSummary = {
  id: string;
  name: string;
  school: string;
  level: number;
};

type PendingImportImage = {
  id: string;
  file: File;
  previewUrl: string;
};

type CreateCharacterStep = 'basic' | 'profile' | 'equipment' | 'review';

type CreateCharacterImportState = {
  stage:
    | 'idle'
    | 'creating'
    | 'importing-profile'
    | 'importing-equipment'
    | 'finishing'
    | 'success'
    | 'error';
  totalTasks: number;
  completedTasks: number;
  currentLabel: string | null;
  createdCharacterName: string | null;
  profileSuccessCount: number;
  equipmentSuccessCount: number;
  importErrors: string[];
};

const CREATE_CHARACTER_STEP_CONFIG: Array<{
  id: CreateCharacterStep;
  label: string;
  shortLabel: string;
  description: string;
}> = [
  {
    id: 'basic',
    label: '角色信息',
    shortLabel: '1',
    description: '先建立角色档案名称',
  },
  {
    id: 'profile',
    label: '基线面板图',
    shortLabel: '2',
    description: '人物属性图作为 OCR 基线',
  },
  {
    id: 'equipment',
    label: '当前装备图',
    shortLabel: '3',
    description: '装备图进入候选装备队列',
  },
  {
    id: 'review',
    label: '确认导入',
    shortLabel: '4',
    description: '核对本次建角导入范围',
  },
];

const DEFAULT_CREATE_IMPORT_STATE: CreateCharacterImportState = {
  stage: 'idle',
  totalTasks: 0,
  completedTasks: 0,
  currentLabel: null,
  createdCharacterName: null,
  profileSuccessCount: 0,
  equipmentSuccessCount: 0,
  importErrors: [],
};

function formatFileSize(size: number) {
  if (size >= 1024 * 1024) {
    return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  }

  return `${Math.max(1, Math.round(size / 1024))} KB`;
}

export function AccountSwitcher() {
  const router = useRouter();
  const { data: session } = useSession();
  const currentCharacter = useGameStore((state) => state.currentCharacter);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [createStep, setCreateStep] = useState<CreateCharacterStep>('basic');
  const [newCharacterName, setNewCharacterName] = useState('');
  const [profileImages, setProfileImages] = useState<PendingImportImage[]>([]);
  const [equipmentImages, setEquipmentImages] = useState<PendingImportImage[]>(
    []
  );
  const [equipmentImageHint, setEquipmentImageHint] =
    useState<SimulatorEquipmentOcrImageHint>('auto');
  const [characters, setCharacters] = useState<CharacterSummary[]>([]);
  const [isLoadingCharacters, setIsLoadingCharacters] = useState(false);
  const [isSwitchingCharacter, setIsSwitchingCharacter] = useState(false);
  const [isCreatingCharacter, setIsCreatingCharacter] = useState(false);
  const [createImportState, setCreateImportState] =
    useState<CreateCharacterImportState>(DEFAULT_CREATE_IMPORT_STATE);
  const [isRenamingCharacter, setIsRenamingCharacter] = useState(false);
  const [isDeletingCharacter, setIsDeletingCharacter] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const profileInputRef = useRef<HTMLInputElement>(null);
  const equipmentInputRef = useRef<HTMLInputElement>(null);
  const profileImagesRef = useRef<PendingImportImage[]>([]);
  const equipmentImagesRef = useRef<PendingImportImage[]>([]);
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

  const characterOptions =
    characters.length > 0 ? characters : fallbackCharacters;
  const activeCharacter =
    characterOptions.find(
      (character) => character.id === currentCharacter?.id
    ) ??
    characterOptions[0] ??
    null;

  const syncCandidateEquipment = async (options?: {
    toastErrorMessage?: string;
  }) => {
    try {
      await loadSimulatorCandidateEquipmentToStore();
      return true;
    } catch (error) {
      console.error('Failed to sync simulator candidate equipment:', error);
      if (options?.toastErrorMessage) {
        toast.error(options.toastErrorMessage);
      }
      return false;
    }
  };

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
      if (
        !response.ok ||
        payload?.code !== 0 ||
        !Array.isArray(payload?.data)
      ) {
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

  useEffect(() => {
    profileImagesRef.current = profileImages;
  }, [profileImages]);

  useEffect(() => {
    equipmentImagesRef.current = equipmentImages;
  }, [equipmentImages]);

  useEffect(() => {
    return () => {
      [...profileImagesRef.current, ...equipmentImagesRef.current].forEach(
        (item) => URL.revokeObjectURL(item.previewUrl)
      );
    };
  }, []);

  const handleCharacterSelect = async (characterId: string) => {
    if (
      !characterId ||
      characterId === currentCharacter?.id ||
      isSwitchingCharacter
    ) {
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
      await syncCandidateEquipment({
        toastErrorMessage: '角色已切换，但候选装备库同步失败',
      });
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

  const resetCreateDialog = () => {
    [...profileImages, ...equipmentImages].forEach((item) =>
      URL.revokeObjectURL(item.previewUrl)
    );
    setProfileImages([]);
    setEquipmentImages([]);
    setNewCharacterName('');
    setCreateStep('basic');
    setCreateImportState(DEFAULT_CREATE_IMPORT_STATE);
  };

  const appendImportImages = (
    kind: 'profile' | 'equipment',
    files: FileList | null
  ) => {
    if (!files || files.length === 0) {
      return;
    }

    const acceptedFiles: PendingImportImage[] = [];
    Array.from(files).forEach((file) => {
      const validation = validateImageFile(file);
      if (!validation.valid) {
        toast.error(validation.error || '图片不合法');
        return;
      }

      acceptedFiles.push({
        id: `${kind}_${file.name}_${file.size}_${Date.now()}_${Math.random()
          .toString(36)
          .slice(2, 8)}`,
        file,
        previewUrl: URL.createObjectURL(file),
      });
    });

    if (acceptedFiles.length === 0) {
      return;
    }

    if (kind === 'profile') {
      setProfileImages((current) => [...current, ...acceptedFiles]);
      return;
    }

    setEquipmentImages((current) => [...current, ...acceptedFiles]);
  };

  const removeImportImage = (kind: 'profile' | 'equipment', id: string) => {
    if (kind === 'profile') {
      setProfileImages((current) => {
        const target = current.find((item) => item.id === id);
        if (target) {
          URL.revokeObjectURL(target.previewUrl);
        }
        return current.filter((item) => item.id !== id);
      });
      return;
    }

    setEquipmentImages((current) => {
      const target = current.find((item) => item.id === id);
      if (target) {
        URL.revokeObjectURL(target.previewUrl);
      }
      return current.filter((item) => item.id !== id);
    });
  };

  const handleCreateCharacter = async () => {
    if (isCreatingCharacter) {
      return;
    }

    const name = newCharacterName.trim();
    if (!name) {
      toast.error('请输入角色名称');
      return;
    }

    setIsCreatingCharacter(true);
    const profileImageQueue = [...profileImages];
    const equipmentImageQueue = [...equipmentImages];
    const totalTasks =
      1 + profileImageQueue.length + equipmentImageQueue.length;
    setCreateImportState({
      stage: 'creating',
      totalTasks,
      completedTasks: 0,
      currentLabel: `正在创建角色「${name}」`,
      createdCharacterName: null,
      profileSuccessCount: 0,
      equipmentSuccessCount: 0,
      importErrors: [],
    });
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

      let latestBundle = payload.data;
      let latestCandidateItems: SimulatorCandidateEquipmentItem[] | null = null;
      const nextCharacterId = String(payload.data.character.id);
      let profileSuccessCount = 0;
      let equipmentSuccessCount = 0;
      const importErrors: string[] = [];
      let completedTasks = 1;

      applySimulatorBundleToStore(latestBundle);
      setSelectedSimulatorCharacterId(nextCharacterId);
      setCreateImportState((current) => ({
        ...current,
        stage:
          profileImageQueue.length > 0
            ? 'importing-profile'
            : equipmentImageQueue.length > 0
              ? 'importing-equipment'
              : 'finishing',
        completedTasks,
        createdCharacterName: latestBundle.character.name,
        currentLabel:
          profileImageQueue.length > 0
            ? `准备导入 ${profileImageQueue.length} 张基线面板图`
            : equipmentImageQueue.length > 0
              ? `准备导入 ${equipmentImageQueue.length} 张装备图`
              : '正在完成建角',
      }));

      for (const item of profileImageQueue) {
        const formData = new FormData();
        formData.append('file', item.file);
        formData.append('characterId', nextCharacterId);
        setCreateImportState((current) => ({
          ...current,
          stage: 'importing-profile',
          currentLabel: `识别基线面板图：${item.file.name}`,
        }));

        try {
          const ocrResponse = await fetch(
            '/api/simulator/current/profile/ocr',
            {
              method: 'POST',
              body: formData,
            }
          );
          const ocrPayload = await ocrResponse.json();
          if (
            !ocrResponse.ok ||
            ocrPayload?.code !== 0 ||
            !ocrPayload?.data?.bundle
          ) {
            throw new Error(ocrPayload?.message || '人物面板识别失败');
          }

          latestBundle = ocrPayload.data.bundle;
          profileSuccessCount += 1;
          setCreateImportState((current) => ({
            ...current,
            profileSuccessCount,
          }));
        } catch (error) {
          importErrors.push(
            `人物面板图「${item.file.name}」导入失败：${
              error instanceof Error ? error.message : '请稍后重试'
            }`
          );
          setCreateImportState((current) => ({
            ...current,
            importErrors: [
              ...current.importErrors,
              importErrors[importErrors.length - 1],
            ],
          }));
        } finally {
          completedTasks += 1;
          setCreateImportState((current) => ({
            ...current,
            completedTasks,
          }));
        }
      }

      for (const item of equipmentImageQueue) {
        const formData = new FormData();
        formData.append('file', item.file);
        formData.append('characterId', nextCharacterId);
        formData.append('imageHint', equipmentImageHint);
        setCreateImportState((current) => ({
          ...current,
          stage: 'importing-equipment',
          currentLabel: `识别装备图：${item.file.name}`,
        }));

        try {
          const ocrResponse = await fetch(
            '/api/simulator/current/candidate-equipment/ocr',
            {
              method: 'POST',
              body: formData,
            }
          );
          const ocrPayload = await ocrResponse.json();
          if (
            !ocrResponse.ok ||
            ocrPayload?.code !== 0 ||
            !Array.isArray(ocrPayload?.data?.items)
          ) {
            throw new Error(ocrPayload?.message || '装备截图识别失败');
          }

          latestCandidateItems = ocrPayload.data.items;
          equipmentSuccessCount += 1;
          setCreateImportState((current) => ({
            ...current,
            equipmentSuccessCount,
          }));
        } catch (error) {
          importErrors.push(
            `装备图「${item.file.name}」导入失败：${
              error instanceof Error ? error.message : '请稍后重试'
            }`
          );
          setCreateImportState((current) => ({
            ...current,
            importErrors: [
              ...current.importErrors,
              importErrors[importErrors.length - 1],
            ],
          }));
        } finally {
          completedTasks += 1;
          setCreateImportState((current) => ({
            ...current,
            completedTasks,
          }));
        }
      }

      setCreateImportState((current) => ({
        ...current,
        stage: 'finishing',
        currentLabel: '正在同步角色与候选装备数据',
      }));
      applySimulatorBundleToStore(latestBundle);
      if (Array.isArray(latestCandidateItems)) {
        applySimulatorCandidateEquipmentToStore(latestCandidateItems);
      }
      setSelectedSimulatorCharacterId(nextCharacterId);
      await loadCharacters();
      setCreateImportState((current) => ({
        ...current,
        stage: 'success',
        completedTasks: current.totalTasks,
        currentLabel: '建角完成',
        createdCharacterName: latestBundle.character.name,
        profileSuccessCount,
        equipmentSuccessCount,
        importErrors,
      }));
      setIsCreateDialogOpen(false);

      toast.success(`已创建角色 ${latestBundle.character.name}`, {
        description:
          [
            profileImages.length > 0
              ? `基准面板 ${profileSuccessCount}/${profileImages.length} 张`
              : null,
            equipmentImages.length > 0
              ? `装备图 ${equipmentSuccessCount}/${equipmentImages.length} 张`
              : null,
          ]
            .filter(Boolean)
            .join(' · ') || '已按默认模板建档',
      });

      if (importErrors.length > 0) {
        toast.error('部分图片导入失败', {
          description: importErrors[0],
        });
      }

      resetCreateDialog();
    } catch (error) {
      console.error('Failed to create simulator character:', error);
      setCreateImportState((current) => ({
        ...current,
        stage: 'error',
        currentLabel: error instanceof Error ? error.message : '创建角色失败',
      }));
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
      if (
        !bundleResponse.ok ||
        bundlePayload?.code !== 0 ||
        !bundlePayload?.data
      ) {
        throw new Error(bundlePayload?.message || '刷新角色失败');
      }

      applySimulatorBundleToStore(bundlePayload.data);
      await syncCandidateEquipment({
        toastErrorMessage: '角色已重命名，但候选装备库同步失败',
      });
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
      if (
        !response.ok ||
        payload?.code !== 0 ||
        !payload?.data?.nextCharacterId
      ) {
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
      if (
        !bundleResponse.ok ||
        bundlePayload?.code !== 0 ||
        !bundlePayload?.data
      ) {
        throw new Error(bundlePayload?.message || '切换到下一个角色失败');
      }

      applySimulatorBundleToStore(bundlePayload.data);
      await syncCandidateEquipment({
        toastErrorMessage: '角色已切换，但候选装备库同步失败',
      });
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
  const currentStepIndex = CREATE_CHARACTER_STEP_CONFIG.findIndex(
    (step) => step.id === createStep
  );
  const canMoveToNextStep =
    (createStep === 'basic' && newCharacterName.trim().length > 0) ||
    createStep === 'profile' ||
    createStep === 'equipment';
  const totalQueuedImages = profileImages.length + equipmentImages.length;
  const createProgressValue =
    createImportState.totalTasks > 0
      ? Math.min(
          100,
          Math.round(
            (createImportState.completedTasks / createImportState.totalTasks) *
              100
          )
        )
      : 0;
  const reviewItems = [
    {
      label: '角色名称',
      value: newCharacterName.trim() || '未填写',
      tone: 'text-yellow-100',
    },
    {
      label: '基线面板图',
      value:
        profileImages.length > 0
          ? `${profileImages.length} 张，按顺序补齐 OCR 基线`
          : '本次跳过，先建空角色',
      tone: profileImages.length > 0 ? 'text-emerald-200' : 'text-slate-400',
    },
    {
      label: '当前装备图',
      value:
        equipmentImages.length > 0
          ? `${equipmentImages.length} 张，导入候选装备队列`
          : '本次跳过，稍后再传',
      tone: equipmentImages.length > 0 ? 'text-amber-200' : 'text-slate-400',
    },
  ];

  const renderImportList = (
    kind: 'profile' | 'equipment',
    items: PendingImportImage[],
    emptyText: string
  ) => {
    if (items.length === 0) {
      return (
        <div className="rounded-xl border border-dashed border-slate-700/60 px-3 py-4 text-center text-xs text-slate-500">
          {emptyText}
        </div>
      );
    }

    return (
      <div className="space-y-2">
        {items.map((item) => (
          <div
            key={item.id}
            className="flex items-center gap-3 rounded-xl border border-yellow-800/30 bg-slate-900/50 p-2"
          >
            <img
              src={item.previewUrl}
              alt={item.file.name}
              className="h-14 w-14 rounded-lg border border-slate-800 object-cover"
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <Badge
                  variant="outline"
                  className="border-slate-700 bg-slate-950/80 text-[10px] text-slate-300"
                >
                  #{items.findIndex((current) => current.id === item.id) + 1}
                </Badge>
                <div className="truncate text-sm font-medium text-yellow-100">
                  {item.file.name}
                </div>
              </div>
              <div className="mt-1 text-[11px] text-slate-400">
                {formatFileSize(item.file.size)}
              </div>
            </div>
            <button
              type="button"
              onClick={() => removeImportImage(kind, item.id)}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-700 bg-slate-950/80 text-slate-400 transition hover:border-red-500/60 hover:text-red-300"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    );
  };

  return (
    <>
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
                  <div className="truncate text-sm text-yellow-100">
                    {character.name}
                  </div>
                  <div className="text-[11px] text-slate-400">
                    {character.school} · {character.level}级
                  </div>
                </div>
                {isActive ? (
                  <Check className="h-4 w-4 text-emerald-400" />
                ) : null}
              </DropdownMenuItem>
            );
          })}

          <DropdownMenuSeparator className="bg-yellow-900/30" />

          <DropdownMenuItem
            className="cursor-pointer focus:bg-slate-900/80"
            disabled={isCreatingCharacter}
            onClick={() => {
              setIsCreateDialogOpen(true);
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
            disabled={
              !activeCharacter ||
              isDeletingCharacter ||
              characterOptions.length <= 1
            }
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
              {characterOptions.length <= 1
                ? '至少保留一个角色'
                : '删除当前角色'}
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

      <Dialog
        open={isCreateDialogOpen}
        onOpenChange={(open) => {
          if (isCreatingCharacter) {
            return;
          }
          setIsCreateDialogOpen(open);
          if (!open) {
            resetCreateDialog();
          }
        }}
      >
        <DialogContent
          showCloseButton={false}
          className="max-w-4xl border-yellow-700/60 bg-slate-950 p-0 text-slate-100 shadow-2xl"
        >
          <DialogHeader className="border-b border-yellow-800/40 bg-slate-950/80 px-6 py-5">
            <DialogTitle className="flex items-center gap-2 text-yellow-100">
              <Plus className="h-5 w-5 text-yellow-500" />
              新建角色
            </DialogTitle>
            <DialogDescription className="text-slate-300">
              先建立一个角色档案，再把人物面板图作为基准值导入。当前装备图会进入这个角色的候选装备队列，方便后续确认。
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 px-6 py-5">
            <div className="space-y-3 rounded-xl border border-yellow-800/30 bg-slate-900/50 p-4">
              <div className="flex flex-wrap gap-2">
                {CREATE_CHARACTER_STEP_CONFIG.map((step, index) => {
                  const isActive = step.id === createStep;
                  const isCompleted = index < currentStepIndex;
                  return (
                    <button
                      key={step.id}
                      type="button"
                      disabled={isCreatingCharacter}
                      onClick={() => setCreateStep(step.id)}
                      className={`inline-flex min-w-[110px] items-center gap-2 rounded-xl border px-3 py-2 text-left text-xs transition ${
                        isActive
                          ? 'border-yellow-500/60 bg-yellow-500/15 text-yellow-100'
                          : isCompleted
                            ? 'border-emerald-700/50 bg-emerald-500/10 text-emerald-200'
                            : 'border-slate-700 bg-slate-950/70 text-slate-400 hover:border-slate-600'
                      } disabled:cursor-not-allowed disabled:opacity-70`}
                    >
                      <span
                        className={`flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-semibold ${
                          isActive
                            ? 'bg-yellow-500 text-slate-950'
                            : isCompleted
                              ? 'bg-emerald-500 text-slate-950'
                              : 'bg-slate-800 text-slate-300'
                        }`}
                      >
                        {step.shortLabel}
                      </span>
                      <span className="min-w-0">
                        <span className="block font-medium">{step.label}</span>
                        <span className="block truncate text-[10px] opacity-80">
                          {step.description}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>

              {isCreatingCharacter || createImportState.stage === 'error' ? (
                <div className="rounded-xl border border-cyan-800/30 bg-cyan-950/10 p-4">
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-cyan-100">
                        导入进度
                      </div>
                      <div className="text-xs text-slate-400">
                        {createImportState.createdCharacterName
                          ? `角色：${createImportState.createdCharacterName}`
                          : '正在准备角色档案'}
                      </div>
                    </div>
                    <Badge
                      variant="outline"
                      className="border-cyan-700/40 bg-cyan-500/10 text-cyan-200"
                    >
                      {createImportState.completedTasks}/
                      {createImportState.totalTasks}
                    </Badge>
                  </div>
                  <Progress
                    value={createProgressValue}
                    className="h-2 bg-slate-800 [&_[data-slot=progress-indicator]]:bg-cyan-400"
                  />
                  <div className="mt-2 text-xs text-slate-300">
                    {createImportState.currentLabel || '准备开始'}
                  </div>
                  {(createImportState.profileSuccessCount > 0 ||
                    createImportState.equipmentSuccessCount > 0) && (
                    <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-slate-300">
                      <span>
                        基线面板图成功 {createImportState.profileSuccessCount}{' '}
                        张
                      </span>
                      <span>
                        装备图成功 {createImportState.equipmentSuccessCount} 张
                      </span>
                    </div>
                  )}
                  {createImportState.importErrors.length > 0 && (
                    <div className="mt-3 rounded-lg border border-red-800/40 bg-red-950/20 p-3 text-xs text-red-200">
                      <div className="font-medium">部分导入失败</div>
                      <div className="mt-1 line-clamp-2">
                        {createImportState.importErrors[0]}
                      </div>
                    </div>
                  )}
                </div>
              ) : null}
            </div>

            <div className="grid gap-5 lg:grid-cols-[1.1fr_1.4fr]">
              <div className="space-y-4">
                {createStep === 'basic' ? (
                  <>
                    <div className="rounded-xl border border-yellow-800/40 bg-slate-900/50 p-4">
                      <div className="mb-2 text-sm font-semibold text-yellow-200">
                        角色信息
                      </div>
                      <Input
                        value={newCharacterName}
                        onChange={(event) =>
                          setNewCharacterName(event.target.value)
                        }
                        placeholder="例如：龙宫任务号"
                        className="border-yellow-800/40 bg-slate-950/70 text-yellow-50"
                      />
                      <div className="mt-2 text-xs leading-6 text-slate-400">
                        先用角色名称建档。人物面板图会在下一步作为当前角色基线导入。
                      </div>
                    </div>

                    <div className="rounded-xl border border-cyan-800/30 bg-cyan-950/10 p-4">
                      <div className="text-sm font-semibold text-cyan-100">
                        这一步会做什么
                      </div>
                      <div className="mt-2 space-y-1 text-xs leading-6 text-slate-300">
                        <div>1. 先创建云端角色档案。</div>
                        <div>2. 稍后把人物面板图写成基线真值。</div>
                        <div>3. 之后的换装和调点都只基于这个基线做增量。</div>
                      </div>
                    </div>
                  </>
                ) : null}

                {createStep === 'profile' ? (
                  <div className="rounded-xl border border-emerald-800/30 bg-emerald-950/10 p-4">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold text-emerald-100">
                          人物面板图
                        </div>
                        <div className="text-xs text-slate-400">
                          建议上传人物属性页、法伤面板、修炼相关截图
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => profileInputRef.current?.click()}
                        className="inline-flex items-center gap-1 rounded-lg border border-emerald-600/40 bg-emerald-600/10 px-3 py-2 text-xs font-medium text-emerald-100 transition hover:bg-emerald-600/20"
                      >
                        <ImagePlus className="h-3.5 w-3.5" />
                        添加图片
                      </button>
                      <input
                        ref={profileInputRef}
                        type="file"
                        accept="image/*"
                        multiple
                        className="hidden"
                        onChange={(event) => {
                          appendImportImages('profile', event.target.files);
                          event.currentTarget.value = '';
                        }}
                      />
                    </div>
                    {renderImportList(
                      'profile',
                      profileImages,
                      '还没有添加人物面板图'
                    )}
                  </div>
                ) : null}

                {createStep === 'equipment' ? (
                  <div className="rounded-xl border border-amber-800/30 bg-amber-950/10 p-4">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold text-amber-100">
                          当前装备图
                        </div>
                        <div className="text-xs text-slate-400">
                          可一次挂多张，创建后会自动送入这个角色的装备识别队列
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => equipmentInputRef.current?.click()}
                        className="inline-flex items-center gap-1 rounded-lg border border-amber-600/40 bg-amber-600/10 px-3 py-2 text-xs font-medium text-amber-100 transition hover:bg-amber-600/20"
                      >
                        <ImagePlus className="h-3.5 w-3.5" />
                        添加图片
                      </button>
                      <input
                        ref={equipmentInputRef}
                        type="file"
                        accept="image/*"
                        multiple
                        className="hidden"
                        onChange={(event) => {
                          appendImportImages('equipment', event.target.files);
                          event.currentTarget.value = '';
                        }}
                      />
                    </div>
                    <div className="mb-3 flex flex-wrap gap-2">
                      {SIMULATOR_EQUIPMENT_OCR_IMAGE_HINT_OPTIONS.map(
                        (option) => (
                          <button
                            key={option.value}
                            type="button"
                            onClick={() => setEquipmentImageHint(option.value)}
                            className={`rounded-full border px-3 py-1.5 text-xs transition-colors ${
                              equipmentImageHint === option.value
                                ? 'border-amber-500/60 bg-amber-900/30 text-amber-100'
                                : 'border-slate-700/70 bg-slate-950/40 text-slate-400 hover:border-amber-700/50 hover:text-amber-100'
                            }`}
                            title={option.description}
                          >
                            {option.label}
                          </button>
                        )
                      )}
                    </div>
                    {renderImportList(
                      'equipment',
                      equipmentImages,
                      '还没有添加当前装备图'
                    )}
                  </div>
                ) : null}

                {createStep === 'review' ? (
                  <div className="rounded-xl border border-yellow-800/40 bg-slate-900/50 p-4">
                    <div className="mb-3 text-sm font-semibold text-yellow-100">
                      本次建角确认
                    </div>
                    <div className="space-y-3">
                      {reviewItems.map((item) => (
                        <div
                          key={item.label}
                          className="rounded-lg border border-slate-800/80 bg-slate-950/60 px-3 py-2"
                        >
                          <div className="text-[11px] text-slate-500">
                            {item.label}
                          </div>
                          <div className={`mt-1 text-sm ${item.tone}`}>
                            {item.value}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="space-y-4">
                <div className="rounded-xl border border-cyan-800/30 bg-cyan-950/10 p-4">
                  <div className="text-sm font-semibold text-cyan-100">
                    本轮导入逻辑
                  </div>
                  <div className="mt-2 space-y-1 text-xs leading-6 text-slate-300">
                    <div>
                      1. 人物属性 / 面板图会作为当前角色的基准面板来源。
                    </div>
                    <div>
                      2. 多张面板图会按顺序依次
                      OCR，后上传的识别结果会继续补前一张。
                    </div>
                    <div>3. 当前装备图会进入候选装备库，便于后续逐件确认。</div>
                    <div>
                      4. 建角后若图片识别失败，也不会影响角色本身被创建。
                    </div>
                  </div>
                </div>

                <div className="rounded-xl border border-slate-800/80 bg-slate-900/50 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm font-semibold text-slate-100">
                      导入摘要
                    </div>
                    <Badge
                      variant="outline"
                      className="border-yellow-700/40 bg-yellow-500/10 text-yellow-200"
                    >
                      共 {totalQueuedImages} 张
                    </Badge>
                  </div>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-lg border border-emerald-800/30 bg-emerald-950/10 px-3 py-3">
                      <div className="text-[11px] text-emerald-300">
                        基线面板图
                      </div>
                      <div className="mt-1 text-lg font-semibold text-emerald-100">
                        {profileImages.length}
                      </div>
                      <div className="mt-1 text-xs text-slate-400">
                        直接进入当前角色基线 OCR
                      </div>
                    </div>
                    <div className="rounded-lg border border-amber-800/30 bg-amber-950/10 px-3 py-3">
                      <div className="text-[11px] text-amber-300">装备图</div>
                      <div className="mt-1 text-lg font-semibold text-amber-100">
                        {equipmentImages.length}
                      </div>
                      <div className="mt-1 text-xs text-slate-400">
                        导入候选装备队列等待确认
                      </div>
                    </div>
                  </div>
                  <div className="mt-3 rounded-lg border border-slate-800/70 bg-slate-950/60 px-3 py-3 text-xs leading-6 text-slate-300">
                    {totalQueuedImages > 0
                      ? '建议先传人物面板图，再传当前装备图。这样创建完成后，当前状态页和装备库会同时具备可核对数据。'
                      : '这次会创建一个空角色档案，后续仍可继续上传人物面板图和装备图。'}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="border-t border-slate-800 px-6 py-4 sm:justify-between">
            <button
              type="button"
              disabled={isCreatingCharacter}
              onClick={() => {
                setIsCreateDialogOpen(false);
                resetCreateDialog();
              }}
              className="inline-flex items-center justify-center rounded-lg border border-slate-700 bg-slate-900 px-4 py-2 text-sm text-slate-300 transition hover:border-slate-600 hover:text-white disabled:opacity-50"
            >
              取消
            </button>
            <div className="flex items-center gap-2">
              {currentStepIndex > 0 ? (
                <button
                  type="button"
                  disabled={isCreatingCharacter}
                  onClick={() => {
                    setCreateStep(
                      CREATE_CHARACTER_STEP_CONFIG[currentStepIndex - 1]?.id ??
                        'basic'
                    );
                  }}
                  className="inline-flex items-center justify-center rounded-lg border border-slate-700 bg-slate-900 px-4 py-2 text-sm text-slate-300 transition hover:border-slate-600 hover:text-white disabled:opacity-50"
                >
                  上一步
                </button>
              ) : null}
              {createStep !== 'review' ? (
                <button
                  type="button"
                  disabled={isCreatingCharacter || !canMoveToNextStep}
                  onClick={() => {
                    setCreateStep(
                      CREATE_CHARACTER_STEP_CONFIG[currentStepIndex + 1]?.id ??
                        'review'
                    );
                  }}
                  className="inline-flex items-center justify-center rounded-lg border border-yellow-700/50 bg-yellow-500/10 px-4 py-2 text-sm font-medium text-yellow-100 transition hover:bg-yellow-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  下一步
                </button>
              ) : (
                <button
                  type="button"
                  disabled={
                    isCreatingCharacter || newCharacterName.trim().length === 0
                  }
                  onClick={() => {
                    void handleCreateCharacter();
                  }}
                  className="inline-flex items-center justify-center rounded-lg bg-yellow-500 px-4 py-2 text-sm font-medium text-slate-950 transition hover:bg-yellow-400 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isCreatingCharacter ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      创建并导入中...
                    </>
                  ) : (
                    '创建角色并开始导入'
                  )}
                </button>
              )}
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
