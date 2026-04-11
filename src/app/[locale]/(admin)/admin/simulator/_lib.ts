import {
  getCurrentUserWithPermission,
  PERMISSIONS,
  requirePermission,
} from '@/core/rbac';
import type { Crumb, Tab } from '@/shared/types/blocks/common';

export type SimulatorAdminSectionGroup =
  | 'workspace'
  | 'setup'
  | 'ocr'
  | 'rules'
  | 'support';

export const SIMULATOR_ADMIN_SECTIONS = [
  {
    slug: 'overview',
    title: 'Simulator 工作台',
    description: '选择要处理的任务，按步骤进入对应功能。',
    group: 'workspace',
    url: '/admin/simulator',
  },
  {
    slug: 'defaults',
    title: '默认模板',
    description:
      '管理新用户进入 Simulator 时使用的默认角色、技能、装备与战斗上下文模板。',
    group: 'setup',
  },
  {
    slug: 'target-templates',
    title: '目标模板',
    description: '维护副本怪物与目标模板，供伤害试算和实验室直接复用。',
    group: 'setup',
  },
  {
    slug: 'advisor',
    title: '顾问配置',
    description: '单独维护 AI 顾问的模型、开关、提示词与生成参数。',
    group: 'setup',
  },
  {
    slug: 'ocr',
    title: 'OCR 配置',
    description:
      '维护 OCR 上传依赖的 Gemini / R2 配置，并实时检查整条识别链路是否可用。',
    group: 'setup',
  },
  {
    slug: 'candidate-equipment',
    title: '候选装备库',
    description: '按状态查看所有候选装备，支持搜索、修正与清理异常记录。',
    group: 'ocr',
  },
  {
    slug: 'inventory',
    title: '入库台账',
    description:
      '查看正式入库记录、分类键和价格，确认候选装备是否已进入正式库存层。',
    group: 'ocr',
  },
  {
    slug: 'ocr-jobs',
    title: 'OCR 任务',
    description:
      '查看 OCR 上传任务的成功、失败以及草稿留痕、候选同步情况，方便排查识别链路问题。',
    group: 'ocr',
  },
  {
    slug: 'ocr-dictionary',
    title: 'OCR 字典',
    description: '维护 OCR 纠错映射，统一装备名、属性词和套装词的归一化结果。',
    group: 'ocr',
  },
  {
    slug: 'rule-center',
    title: '规则中心',
    description: '管理伤害规则版本、发布状态以及可编辑的规则片段。',
    group: 'rules',
  },
  {
    slug: 'rule-playground',
    title: '规则试算',
    description:
      '在独立路由中执行规则回归试算与样例维护，减少和规则编辑页互相干扰。',
    group: 'rules',
  },
  {
    slug: 'star-resonance-rules',
    title: '星相互合规则',
    description:
      '维护部位、组合名、颜色清单、单件奖励与六件全套奖励，供星石链路复用。',
    group: 'rules',
  },
  {
    slug: 'user-diagnostics',
    title: '用户排障',
    description: '按用户、邮箱或角色检索 Simulator 数据，快速排查线上问题。',
    group: 'support',
  },
  {
    slug: 'lab-sessions',
    title: '实验室记录',
    description: '查看用户实验室会话、样本席位与对比席位，便于复盘换装过程。',
    group: 'support',
  },
] as const;

export type SimulatorAdminSectionSlug =
  (typeof SIMULATOR_ADMIN_SECTIONS)[number]['slug'];

export const SIMULATOR_ADMIN_WORKFLOWS: {
  id: string;
  label: string;
  title: string;
  description: string;
  primarySlug: SimulatorAdminSectionSlug;
  primaryText: string;
  steps: {
    title: string;
    slug: SimulatorAdminSectionSlug;
  }[];
}[] = [
  {
    id: 'intake',
    label: '日常',
    title: '处理 OCR 入库',
    description: '先修正候选装备，再核对正式台账；识别反复出错时补词典。',
    primarySlug: 'candidate-equipment',
    primaryText: '开始处理候选装备',
    steps: [
      { title: '修正候选装备', slug: 'candidate-equipment' },
      { title: '核对入库台账', slug: 'inventory' },
      { title: '查看失败任务', slug: 'ocr-jobs' },
      { title: '补充 OCR 字典', slug: 'ocr-dictionary' },
    ],
  },
  {
    id: 'support',
    label: '客服',
    title: '排查某个用户',
    description: '用邮箱、角色名或用户 ID 找到现场，再看实验室和装备流转。',
    primarySlug: 'user-diagnostics',
    primaryText: '搜索用户数据',
    steps: [
      { title: '定位用户档案', slug: 'user-diagnostics' },
      { title: '复盘实验室记录', slug: 'lab-sessions' },
      { title: '检查候选装备状态', slug: 'candidate-equipment' },
    ],
  },
  {
    id: 'rules',
    label: '调试',
    title: '调整伤害规则',
    description: '先用试算样例确认问题，再改规则版本和相关目标模板。',
    primarySlug: 'rule-playground',
    primaryText: '进入规则试算',
    steps: [
      { title: '跑规则试算', slug: 'rule-playground' },
      { title: '编辑规则版本', slug: 'rule-center' },
      { title: '维护目标模板', slug: 'target-templates' },
      { title: '维护星相互合', slug: 'star-resonance-rules' },
    ],
  },
  {
    id: 'setup',
    label: '配置',
    title: '调整新用户默认体验',
    description: '改默认角色和目标，再确认顾问、OCR 依赖是否可用。',
    primarySlug: 'defaults',
    primaryText: '编辑默认模板',
    steps: [
      { title: '编辑默认模板', slug: 'defaults' },
      { title: '维护目标模板', slug: 'target-templates' },
      { title: '调整顾问配置', slug: 'advisor' },
      { title: '检查 OCR 配置', slug: 'ocr' },
    ],
  },
];

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

export function getSimulatorAdminSectionUrl(
  slug: SimulatorAdminSectionSlug
): string {
  const section = getSimulatorAdminSection(slug);

  return 'url' in section ? section.url : `/admin/simulator/${section.slug}`;
}

export function getSimulatorAdminTabs(
  activeSlug: SimulatorAdminSectionSlug
): Tab[] {
  const activeSection = getSimulatorAdminSection(activeSlug);
  const groupSections = SIMULATOR_ADMIN_SECTIONS.filter(
    (section) => section.group === activeSection.group
  );

  return groupSections.map((section) => ({
    name: section.slug,
    title: section.title,
    url: getSimulatorAdminSectionUrl(section.slug),
    is_active: section.slug === activeSlug,
  }));
}

export function getSimulatorAdminCrumbs(
  activeSlug: SimulatorAdminSectionSlug
): Crumb[] {
  const section = getSimulatorAdminSection(activeSlug);

  return [
    { title: 'Admin', url: '/admin' },
    { title: 'Simulator', url: '/admin/simulator' },
    { title: section.title, is_active: true },
  ];
}
