import {
  getCurrentUserWithPermission,
  PERMISSIONS,
  requirePermission,
} from '@/core/rbac';
import type { Crumb, Tab } from '@/shared/types/blocks/common';

export const SIMULATOR_ADMIN_SECTIONS = [
  {
    slug: 'defaults',
    title: '默认模板',
    description:
      '管理新用户进入 Simulator 时使用的默认角色、技能、装备与战斗上下文模板。',
  },
  {
    slug: 'advisor',
    title: '顾问配置',
    description: '单独维护 AI 顾问的模型、开关、提示词与生成参数。',
  },
  {
    slug: 'ocr',
    title: 'OCR 配置',
    description:
      '维护 OCR 上传依赖的 Gemini / R2 配置，并实时检查整条识别链路是否可用。',
  },
  {
    slug: 'candidate-equipment',
    title: '候选装备库',
    description: '按状态查看所有候选装备，支持搜索、修正与清理异常记录。',
  },
  {
    slug: 'inventory',
    title: '入库台账',
    description:
      '查看正式入库记录、分类键和价格，确认候选装备是否已进入正式库存层。',
  },
  {
    slug: 'ocr-jobs',
    title: 'OCR 任务',
    description:
      '查看 OCR 上传任务的成功、失败与待审核分发情况，方便排查识别链路问题。',
  },
  {
    slug: 'ocr-dictionary',
    title: 'OCR 字典',
    description: '维护 OCR 纠错映射，统一装备名、属性词和套装词的归一化结果。',
  },
  {
    slug: 'target-templates',
    title: '目标模板',
    description: '维护副本怪物与目标模板，供伤害试算和实验室直接复用。',
  },
  {
    slug: 'user-diagnostics',
    title: '用户排障',
    description: '按用户、邮箱或角色检索 Simulator 数据，快速排查线上问题。',
  },
  {
    slug: 'lab-sessions',
    title: '实验室记录',
    description: '查看用户实验室会话、样本席位与对比席位，便于复盘换装过程。',
  },
  {
    slug: 'rule-center',
    title: '规则中心',
    description: '管理伤害规则版本、发布状态以及可编辑的规则片段。',
  },
  {
    slug: 'rule-playground',
    title: '规则试算',
    description:
      '在独立路由中执行规则回归试算与样例维护，减少和规则编辑页互相干扰。',
  },
] as const;

export type SimulatorAdminSectionSlug =
  (typeof SIMULATOR_ADMIN_SECTIONS)[number]['slug'];

export async function requireSimulatorAdminAccess(locale: string) {
  await requirePermission({
    code: PERMISSIONS.SETTINGS_READ,
    redirectUrl: '/admin/no-permission',
    locale,
  });

  const writableUser = await getCurrentUserWithPermission({
    code: PERMISSIONS.SETTINGS_WRITE,
    locale,
  });

  return {
    writableUser,
  };
}

export function getSimulatorAdminSection(slug: SimulatorAdminSectionSlug) {
  return SIMULATOR_ADMIN_SECTIONS.find((item) => item.slug === slug)!;
}

export function getSimulatorAdminTabs(
  activeSlug: SimulatorAdminSectionSlug
): Tab[] {
  return SIMULATOR_ADMIN_SECTIONS.map((section) => ({
    name: section.slug,
    title: section.title,
    url: `/admin/simulator/${section.slug}`,
    is_active: section.slug === activeSlug,
  }));
}

export function getSimulatorAdminCrumbs(
  activeSlug: SimulatorAdminSectionSlug
): Crumb[] {
  const section = getSimulatorAdminSection(activeSlug);

  return [
    { title: 'Admin', url: '/admin' },
    { title: 'Simulator', url: '/admin/simulator/defaults' },
    { title: section.title, is_active: true },
  ];
}
