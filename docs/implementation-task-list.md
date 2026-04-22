# 梦幻实验室执行任务清单

## 1. 文档目的

这份文档把《梦幻核心说明0326》的产品要求整理成可执行的工程任务清单，供后续排期、拆 issue、分工和验收使用。

当前策略不是从零重写，而是基于现有模拟器骨架继续补齐：

- `src/features/simulator`
- `src/shared/services/damage-engine.ts`
- `src/config/db/schema.sqlite.ts`

## 1.1 固定技术约束

以下选型视为当前阶段的固定前提，不再作为开放问题讨论：

- 数据库使用 `Cloudflare D1`
- 图片存储使用 `Cloudflare R2`
- 项目部署到 `Cloudflare Workers`
- 图片识别使用 `Gemini`
- AI 对话使用 `Gemini`

后续所有任务拆分、数据流设计和服务封装都要以这组约束为准，避免出现多套 provider 并存的额外复杂度。

## 2. 当前工程判断

仓库已经存在模拟器基础状态管理、部分装备与实验逻辑、以及伤害计算服务，因此本期重点是：

1. 统一规则源
2. 补齐 D1 数据模型
3. 打通“当前状态 -> 实验室 -> 结果解释 -> 持久化”主链路
4. 补齐测试与文档

## 2.0 当前统一架构结论

从 `2026-04-14` 起，任务文档统一采用以下产品与计算口径，不再继续沿“人物裸体属性全公式穷举”方向发散：

- 基线层：
  - 角色当前人物面板 OCR 结果视为真值基线
  - 创建角色时，人物属性 / 面板图 OCR 得到的结果直接作为当前档案基础面板
- 增量层：
  - 后续所有换装备、改加点、改修炼、改符石、改星石、改神器，全部在 OCR 基线之上做增量计算
  - 实验室本质上是“同一角色、不同增量方案”的对比系统，而不是重新反推一整套人物裸体属性

这条结论的直接影响如下：

- 角色创建优先做“多图导入 + OCR 确认页 + 面板基线化”
- 当前状态页优先保证“OCR 真值可维护、可确认、可回填”
- 实验室优先收口为“同角色双方案对比”，不继续扩展成更复杂的多席位横向铺开
- 符石 / 星石 / 最优解逻辑已按 `PRD V3.0` 接入首版正式规则源；后续若用户继续提供 CC 数据或更细规则，只做规则表升级，不再回到旧占位口径
- 真实装备素材已先接入本地 `素材/icons` 首批图片；后续只继续补用户提供的 CC 素材包与别名映射，不主动虚构额外图片
- 当前符石系统、星石系统、星相互合、最优符石组合默认解已经形成“PRD 默认规则 + 旧数据兼容 + 后续规则可配置升级”的主线；下一步重点是补更多线上验收与更细解释文案，而不是基础规则缺失

## 2.1 当前实现状态快照

以下状态以当前仓库代码为准，用于帮助后续排期时区分：

- 已实现：主链路已经可用，可继续增强
- 部分完成：已有主要代码，但建模、闭环或管理能力还没完全收口
- 未完成：任务清单中有规划，但当前仓库里还没有完整落地

### 已实现

#### A. 当前状态页最小可用闭环

对应任务：

- `P0-04`

当前状态：

- 已有首页 simulator 入口
- 登录后会自动读取 `/api/simulator/current`
- 当前角色资料、修炼、装备、战斗参数都已支持 D1 读写
- 若用户还没有角色，会自动补建默认角色

主要代码：

- `src/app/[locale]/page.tsx`
- `src/shared/blocks/simulator/SimulatorApp/index.tsx`
- `src/app/api/simulator/current/route.ts`
- `src/app/api/simulator/current/profile/route.ts`
- `src/app/api/simulator/current/cultivation/route.ts`
- `src/app/api/simulator/current/equipment/route.ts`
- `src/app/api/simulator/current/battle-context/route.ts`
- `src/shared/models/simulator.ts`

#### B. 统一规则源与伤害计算主链

对应任务：

- `P0-01`
- `P0-05`
- `P0-06`

当前状态：

- 服务端已有统一伤害计算入口
- 规则版本支持读取、发布、克隆、编辑
- 前台伤害面板和后台 rule playground 共用同一套规则链路
- 技能伤害面板会复用当前目标模板 / 副本目标参数
- 关键计算、实验估值、store hydration 已有测试

主要代码：

- `src/shared/services/damage-engine.ts`
- `src/shared/models/damage-rules.ts`
- `src/app/api/simulator/calculate-damage/route.ts`
- `src/shared/blocks/simulator/CombatPanel/SkillDamagePanel.tsx`
- `src/shared/blocks/simulator/rule-center/index.tsx`
- `src/shared/blocks/simulator/rule-playground/index.tsx`
- `src/shared/services/damage-engine.test.ts`
- `src/shared/services/lab-valuation.test.ts`

#### C. D1 表结构与 Cloudflare 边界收口

对应任务：

- `P0-03`
- `P0-03A`

当前状态：

- 项目运行时已固定走 Cloudflare Workers + D1
- `wrangler.toml` 已配置远端 D1 binding
- schema 与迁移目录已经存在
- 开发态会通过 Wrangler proxy 读取 D1 binding

主要代码：

- `wrangler.toml`
- `src/core/db/d1.ts`
- `src/core/db/index.ts`
- `src/config/db/schema.sqlite.ts`
- `src/config/db/migrations_d1/*`

#### D. 实验室席位、候选装备与同步决策主链

对应任务：

- `P1-04`
- `P1-05`
- `P2-04`

当前状态：

- 实验室已有样本席位和对比席位
- 候选装备支持 `pending / confirmed / replaced`
- 可将单件或整套实验结果同步到当前装备
- 同步前会生成应用前快照，并支持回滚最近一次应用
- 这条“应用 -> 快照 -> 回滚”链路已经做过真实页面验收

主要代码：

- `src/app/api/simulator/current/lab-session/route.ts`
- `src/app/api/simulator/current/candidate-equipment/route.ts`
- `src/app/api/simulator/current/equipment/rollback/route.ts`
- `src/shared/models/simulator.ts`
- `src/shared/blocks/simulator/LaboratoryPanel/index.tsx`
- `src/features/simulator/overlays/EquipmentReplaceDialog.tsx`

#### E. 目标模板、后台规则管理与运营 / 排障页

对应任务：

- `P1-03`
- `Admin-P0-01`
- `Admin-P0-02`
- `Admin-P0-03`
- `Admin-P0-04`
- `Admin-P0-05`
- `Admin-P1-01`
- `Admin-P1-02`
- `Admin-P1-03`
- `Admin-P1-04`
- `Admin-P2-01`

当前状态：

- 后台已有默认模板管理
- 后台已有规则中心、规则 playground、目标模板管理
- 后台已有 OCR 健康检查、OCR 作业、OCR 字典、候选装备库、入库台账
- 后台已有顾问配置页、实验室记录页、用户诊断页

主要代码：

- `src/shared/blocks/simulator/defaults-editor/index.tsx`
- `src/shared/blocks/simulator/rule-center/index.tsx`
- `src/shared/blocks/simulator/rule-playground/index.tsx`
- `src/shared/blocks/simulator/target-template-panel/index.tsx`
- `src/shared/blocks/simulator/ocr-config-panel/index.tsx`
- `src/shared/blocks/simulator/ocr-health-panel/index.tsx`
- `src/shared/blocks/simulator/ocr-job-admin-panel/index.tsx`
- `src/shared/blocks/simulator/ocr-dictionary-panel/index.tsx`
- `src/app/[locale]/(admin)/admin/simulator/candidate-equipment/page.tsx`
- `src/shared/blocks/simulator/inventory-admin-panel/index.tsx`
- `src/shared/blocks/simulator/lab-session-admin-panel/index.tsx`
- `src/shared/blocks/simulator/advisor-config-panel/index.tsx`
- `src/shared/blocks/simulator/user-diagnostics-panel/index.tsx`

#### F. Gemini 顾问链路

对应任务：

- `P2-06`
- `Admin-P1-02`

当前状态：

- 前端 AI 顾问入口已接入
- 会把当前角色、候选装备、实验室席位作为上下文传给 Gemini
- 后台已支持模型、系统提示词和开关项配置
- 实际使用仍依赖 `gemini_api_key`

主要代码：

- `src/features/simulator/shell/AiChat.tsx`
- `src/app/api/simulator/advisor/route.ts`
- `src/shared/services/simulator-advisor.ts`
- `src/shared/blocks/simulator/advisor-config-panel/index.tsx`

#### G. 灵饰 / 玉魄独立持久化与快照建模

对应任务：

- `P0-02`
- `P1-01`

当前状态：

- 灵饰已从“统一装备 JSON / 统一装备表兼容承载”收口到独立的 `ornament_item`、`ornament_sub_attr`、`snapshot_ornament_slot`
- 玉魄已收口到独立的 `jade_item`、`jade_attr`、`snapshot_jade_slot`
- 当前快照、历史回滚快照、默认角色补建链路都会统一读写这三组独立表
- 本地 D1 迁移 `0006_simulator_accessory_tables.sql` 已覆盖旧 `equipment_item` 附件数据迁移，并同步派生 `ornament_set_effect`

主要代码：

- `src/shared/models/simulator.ts`
- `src/shared/lib/simulator-equipment.ts`
- `src/config/db/schema.sqlite.ts`
- `src/config/db/migrations_d1/0006_simulator_accessory_tables.sql`
- `docs/d1-database-design.md`

#### H. 多角色云端管理与切换

对应任务：

- `P1-07`

当前状态：

- D1 `game_character` 模型已经支持一名用户拥有多个角色，且已有唯一索引约束同用户重名
- 顶部 `AccountSwitcher` 已支持云端角色列表读取、角色切换、新建、重命名、删除，以及切换后重新 hydrate 当前角色 bundle
- 当前主链路已经不再只固定单角色；本地选中的角色 ID 也会跟随保存，用于下次进入时恢复
- 新建角色入口已从 `prompt` 升级为结构化弹窗，支持在建档时一次挂载多张人物面板图与当前装备图；其中人物面板图会按顺序 OCR 到新角色档案，装备图会写入该角色的候选装备队列

主要代码：

- `src/app/api/simulator/characters/route.ts`
- `src/app/api/simulator/characters/[id]/route.ts`
- `src/features/simulator/shell/AccountSwitcher.tsx`
- `src/features/simulator/utils/characterSelection.ts`
- `src/shared/models/simulator-user.ts`

### 部分完成

#### A. 多套装备快照

对应任务：

- `P1-02`

当前状态：

- 前端 store 已支持多套装备方案切换、重命名和同步
- 服务端已新增 `equipment_plan / equipment_plan_item` 两张正式方案表
- 当前读写链路已切到正式方案表，不再依赖旧的上下文备注结构

主要代码：

- `src/features/simulator/store/gameStore.ts`
- `src/features/simulator/store/equipmentSetState.ts`
- `src/features/simulator/utils/simulatorBundle.ts`
- `src/shared/models/simulator.ts`

#### B. OCR 上传与待确认流

对应任务：

- `P2-01`
- `P2-02`
- `Admin-P0-05`
- `Admin-P1-01`

当前状态：

- 已有 Gemini OCR、上传校验、OCR 词典、OCR 作业页
- schema 里也已有 `ocr_job` 和 `ocr_draft_item`
- 前台候选装备 OCR 现在会统一先落 `ocr_job -> ocr_draft_item`
- OCR 成功后会自动把草稿标记为 `approved`，并同步生成 `candidate_equipment.pending`
- 当前仍保留后台查看页用于排障和审计，但主链路已不再依赖后台逐条人工处理

主要代码：

- `src/shared/services/simulator-ocr.ts`
- `src/config/db/schema.sqlite.ts`
- `src/shared/models/simulator.ts`
- `src/app/api/simulator/current/candidate-equipment/ocr/route.ts`
- `src/app/[locale]/(admin)/admin/simulator/candidate-equipment/page.tsx`
- `src/shared/blocks/simulator/ocr-job-admin-panel/index.tsx`

#### C. 灵饰套装规则配置化与数值消费

对应任务：

- `P1-06`
- `Admin-P1-05`

当前状态：

- 灵饰/玉魄的独立表建模和快照挂载已经落地
- 当前快照写入时已经会按灵饰套装名汇总 `total_level / tier / effect_json`，并收紧为“4 件同名且总等级 >= 8 才生成套装效果记录”
- 规则中心现已补充灵饰套装档位扩展配置区，可在 `equipment_extension / ornament_set_rules` 中维护档位 JSON
- 灵饰套装档位效果现已正式进入 `damage-engine`
  - 运行时会根据当前角色已穿戴的 4 件同名灵饰、总等级档位和 `ornament_set_rules` 配置自动命中效果
  - 当前支持 `panel_stat_bonus`、`attribute_source_bonus`、`skill_damage_addend` 三类运行时效果
  - 同时顺手补齐了面板加成对 `hp / mp / hit / damage / defense / speed / dodge` 等面板项的统一消费
- 玉魄百分比效果已不再只是展示字段：当前状态页 / 实验室编辑器都可直接维护结构化 `effectModifiers`；服务端伤害链路和实验室估值链路都已消费 `spell_ignore_percent`、`spell_damage_percent`，同时支持已持久化 `effectModifiers` 和 `法术忽视 % / 基础法术伤害 %` 文本解析
- `magic_upper_percent` 已开始进入前台 / 服务端面板 `mp` 计算；`element_overcome_percent` 已开始进入五行克制系数计算
- 玉魄百分比编辑器现已优先读取规则中心 `jade_percent_semantics` 配置，前台不再只依赖硬编码词条列表；同时修正了 `element_overcome_percent` 编辑时丢失所选五行的问题
- 玉魄属性池配置入口已在规则中心落地，并已开始进入编辑阶段：
  - 当前状态页玉魄编辑会按 `jade_attribute_pool` 的槽位配置过滤固定值词条
  - 若旧数据里已有超出属性池的固定值 / 百分比词条，编辑器会给出提示，但暂不强制清洗
  - 实验室玉魄百分比词条编辑器也会按属性池限制可选 code
- OCR 候选装备待确认弹窗现也会读取 `jade_attribute_pool`，在人工确认前提示当前玉魄是否存在超出槽位属性池的固定值 / 百分比词条
- 当前仍未完全收口的是 OCR / 入库阶段的统一强校验，以及更多百分比词条语义的完整数据化

主要代码：

- `src/shared/services/damage-engine.ts`
- `src/shared/services/lab-valuation.ts`
- `src/shared/services/damage-engine.test.ts`
- `src/shared/services/lab-valuation.test.ts`
- `src/shared/models/damage-rules.ts`
- `src/config/db/schema.sqlite.ts`
- `docs/d1-database-design.md`

#### D. 星石 / 星相互合正式建模与规则消费

对应任务：

- `P1-08`

当前状态：

- 当前装备详情弹窗里已经能编辑 `starPosition / starAlignment`
- `damage-engine` 已开始消费单件星位加成、单件互合属性和六件全套 `+2` 基础属性规则，并输出到伤害 breakdown
- D1 已新增 `star_stone_item / star_stone_attr / star_resonance_rule / character_star_resonance` 与 `0012_star_stone_and_resonance.sql`
- 但前台仍主要依赖临时文本字段录入，后台规则中心和正式星石回填链路还未完全接通

主要代码：

- `src/shared/blocks/simulator/EquipmentPanel/EquipmentDetailModal.tsx`
- `src/shared/blocks/simulator/LaboratoryPanel/LaboratoryEquipmentDetailModal.tsx`
- `src/shared/services/damage-engine.ts`
- `src/config/db/schema.sqlite.ts`
- `src/config/db/migrations_d1/0012_star_stone_and_resonance.sql`
- `docs/project-overview.md`
- `docs/d1-database-design.md`

#### E. 玉魄百分比属性规则化与属性池配置

对应任务：

- `P1-09`
- `Admin-P1-05`

当前状态：

- 玉魄独立表与快照挂载已经落地
- 服务端伤害链路已覆盖 `法术忽视 %`、`基础法术伤害 %` 这类关键百分比属性，并已有 `damage-engine` 回归测试
- 实验室估值链路也已覆盖上述两类百分比属性，并已有 `lab-valuation` 回归测试
- 当前装备、实验室席位和候选装备保存会保留 `effectModifiers`，服务端会优先消费持久化 modifier，同时兼容从特效文本解析百分比语义
- 规则中心已补充玉魄属性池与百分比语义扩展配置区
- 当前仍未完全收口的是：属性池尚未作为 OCR / 入库 / 编辑阶段的强校验来源，更多百分比词条语义尚未全部数据化，后台配置与完整公式消费之间还没有做到“配置即生效”的统一闭环

主要代码：

- `src/shared/services/damage-engine.ts`
- `src/shared/services/lab-valuation.ts`
- `src/shared/services/damage-engine.test.ts`
- `src/shared/services/lab-valuation.test.ts`
- `src/shared/models/damage-rules.ts`
- `src/config/db/schema.sqlite.ts`
- `docs/project-overview.md`
- `docs/d1-database-design.md`

### 未完成

#### A. OCR 质量统计

对应任务：

- `Admin-P2-02`

当前状态：

- 当前已具备 OCR 配置、作业、待确认 / 审计页面
- 但还未见完整的成功率、失败原因、错误字段统计能力

#### B. 顾问问答审计

对应任务：

- `Admin-P2-03`

当前状态：

- 当前已有顾问调用链和配置页
- 但还未见独立的问答落库、审计表或后台审计页面

#### C. 文档对照表

对应任务：

- `P2-05`

当前状态：

- 本节就是将该任务并入当前文档后的第一版实现
- 本次已补写 2026-04 的状态快照与线上验收结论
- 后续继续维护时，不再额外新建状态文档，统一在本文件更新

#### D. 非功能性能与批量识图验收

对应任务：

- `P2-07`

当前状态：

- 当前已有主链路功能回归测试，但还未见针对文档里明确提出的 `< 50ms` 伤害刷新、`10 张大图排队识别`、`1000 件装备加载`、`4K / 200% 缩放` 的专项验收基线
- 这部分能力目前更多依赖人工体验，尚未沉淀成稳定的压测 / 浏览器验收脚本

#### E. 用户安全中心

对应任务：

- 当前未在原任务号中单列

当前状态：

- `/settings/security` 已有页面与文案骨架
- 但重置密码逻辑仍为空实现，提交时没有真正更新密码
- 注销账号当前也只有入口文案与按钮，还没有删除前校验、二次确认、数据清理或退出流程

主要代码：

- `src/app/[locale]/(landing)/settings/security/page.tsx`
- `src/config/locale/messages/zh/settings/security.json`
- `src/config/locale/messages/en/settings/security.json`

#### F. 用户反馈入口

对应任务：

- 当前未在原任务号中单列

当前状态：

- `/activity/feedbacks` 仍是纯占位页
- 活动侧栏当前也没有把该页面作为正式入口挂出来，说明反馈闭环尚未进入可用状态

主要代码：

- `src/app/[locale]/(landing)/activity/feedbacks/page.tsx`
- `src/config/locale/messages/zh/activity/sidebar.json`
- `src/config/locale/messages/en/activity/sidebar.json`

#### G. 产品化与模板残留清理

对应任务：

- 当前未在原任务号中单列

当前状态：

- 仓库核心业务已经是“梦幻实验室”，但 README、包名、落地页、定价页、博客页、站点文案里仍大量保留 `ShipAny` 模板内容
- 这部分不会阻塞模拟器主链路，但会影响对外展示、产品定位和后续维护判断
- 适合单独作为一轮“品牌收口 / 外围页面清理”任务来做，而不是继续混在模拟器主链路里

主要代码：

- `README.md`
- `package.json`
- `src/config/locale/messages/zh/landing.json`
- `src/config/locale/messages/en/landing.json`
- `src/config/locale/messages/zh/pages/index.json`
- `src/config/locale/messages/en/pages/index.json`

## 2.2A 2026-04-12 前台规格差距判断补充

本节仅针对用户新增的页面级产品说明做对照判断：

- `3.1 当前状态`
- `3.2 实验室`

判断原则：

- `已完成`：前台链路已经打通，用户能直接使用
- `部分完成`：底层数据或局部交互已经存在，但还没完全达到文档要求
- `未完成`：当前前台还没有完整实现

### A. 3.1.1 个人档案

- 已完成：
  - 门派、等级、五围、核心面板、修炼编辑与云端保存
  - 属性截图上传与 OCR 主链
- 已完成补充：
  - 技能前台已消费 `baseLevel / extraLevel / finalLevel`，可展示 `180+2`
  - 潜力点已接入当前状态页前台展示与保存
  - 人物属性 OCR 已改为“先确认后写入”，并提供绿色提升 / 红色下降 diff 视图
- 未完成：
  - 当前无阻塞主链的前台缺口，后续主要是识别精度和规则解释继续细化

### B. 3.1.2 当前装备

- 已完成：
  - 6 件常规装备 + 4 件灵饰 + 2 件玉魄插槽
  - 多套装备方案的新建、复制、重命名、切换、保存
  - 当前装备、灵饰、玉魄详情弹窗
  - 装备方案切换区已去掉左右移动按钮，改为“点击切换 + 独立操作条”，减少悬停干扰与误触
  - 当前装备卡、待确认卡和新品装备卡已改为默认展示装备图，上传截图转为悬停对比用途
- 部分完成：
  - 等级、五行、耐久、锻炼/星辉、宝石、开孔、符石、星位、星相互合、符石组合等字段已基本具备
  - `specialEffect / setName / runeSetEffect / refinementEffect` 已能承载逆鳞、灵饰套装、健步如飞等效果文本，但仍偏展示字段，不是全部都已做成强规则对象
- 已完成补充：
  - 当前装备详情与实验室装备详情都已补出独立“初值”展示区，便于直接判断装备底子
  - 装备卡片已补统一“亮点标签”展示，会聚合亮点、特效、套装、开孔、修理失败等高关注字段
  - 装备图链路已从外部随机图切到统一 `equipment-art` resolver，当前支持“按装备名命中素材映射，不命中则按部位回退”
  - 已补统一 artwork helper，前台当前装备卡、待确认卡、新品卡、实验席位卡与相关详情弹窗都已统一走同一套 resolver；当前服务端会优先把命中的真实素材转到 R2 对象 URL，不再只依赖本地静态图
  - 已拆出独立 `simulator-equipment-artwork-manifest`，并已把本地 `素材/icons` 首批真实装备图批量导入到 `public/simulator/equipment-art/`
  - 已补 `data/simulator-equipment-artwork-manifest.source.json` 与 `scripts/build-simulator-equipment-artwork-manifest.ts`，后续可先维护 source JSON，再一键生成前台使用的 manifest 文件
  - 已补 `scripts/sync-simulator-equipment-artwork-source.ts`，可按目录扫描真实图片文件并回写 `source.json`，降低后续素材批量接入的人肉录入成本
  - 已补 `scripts/import-simulator-equipment-artwork.ts`，可直接从外部素材目录批量复制图片到项目标准目录，并自动串起 `sync-source + build`，减少后续从 CC 素材库手工搬运的成本
  - 已补 artwork 别名批量导入能力，支持在导图时同时合并 OCR / 藏宝阁 / CC 素材库命名别名，减少 `source.json` 的手工维护量
  - 已补接入说明文档 `docs/simulator-equipment-artwork-import.md`，明确目录命名约定、批量导入流程与校验命令
  - 已将当前 `public/simulator/equipment-art` 的 449 张素材同步到 R2 `equipment-art/` 目录，后续前台命中真实素材时会优先经由 R2 返回
  - 当前装备页已在玉魄区下方补出“神器加成”编辑与保存链路；当前支持单属性神器配置、云端持久化、刷新回填，以及同步进入实验室与伤害试算
  - 神器加成已补常用预设模板与亮点标签展示，当前可快速切换 `法伤 / 法结 / 法暴 / 速度 / 穿刺` 试验口径
  - 实验室样本席位与对比席位卡也已补出统一神器摘要，换装推演时不再需要回当前状态页确认神器配置
- 未完成：
  - 部分套装语义仍停留在文本承载，尚未全部做成统一校验与解释
  - 真实装备图已完成首批本地素材接入，后续仍需要继续补别名映射、补齐少量未覆盖装备名，并在用户补充更多图库后做二次导入

### C. 3.1.3 战斗参数

- 已完成：
  - 我方阵法 / 五行
  - 手动目标与副本目标模板
  - 选择目标后自动回填法防、防御、气血、五行等参数
  - “查看技能伤害”弹窗与公式解释链路
  - 当前状态主界面已把战斗参数收纳为右侧二级展开区，默认主视图改为“最终面板摘要”
- 部分完成：
  - 目标模板机制已完整接通，但“是否已内置完主流副本”取决于 D1 当前模板数据，而不是前端静态列表
- 未完成：
  - 无明确缺口阻塞主链，但仍需后续继续补齐模板数据覆盖率

### D. 3.2.1 装备库

- 已完成：
  - 待确认区 / 新品装备库双区
  - OCR 上传、待确认、确认入库、删除、保存到 D1
  - 待确认详情页的人工复核与改动比对
- 待确认区上传入口已支持批量选择 / 拖拽多张图片，按队列顺序 OCR 入库
- 候选列表默认按上传时间倒序显示，并补齐“最新 / 最早 / 总价最高 / 总价最低”排序
- 候选列表已支持按主类 / 部位筛选，待确认区和新品装备库共用同一套筛选口径
- 待确认区已支持多选后批量确认入库，适合处理一批 OCR 成功的候选装备
- 待确认详情弹窗已支持连续审核，可直接上一件 / 下一件，并支持“确认并看下一件”
- 角色页装备 OCR 确认弹窗已支持直接跳到实验室待确认详情，自动衔接连续审核
- OCR 确认弹窗与待确认详情都已支持“装备展示图 / OCR 原图”并排核对
- 已完成补充：
  - 装备 OCR 现已补充“截图类型提示”链路，角色页上传弹窗、实验室批量上传区和建角多图导入都支持 `自动识别 / 通用装备图 / 藏宝阁截图 / 聊天框预览`
  - 当前默认口径已切到 `自动识别`，即用户不手动选择时，也会先让模型按版式自行判断更像藏宝阁、聊天框预览还是普通装备图，再套对应识别重点
  - 服务端装备 OCR prompt 已开始消费该提示，当前会按截图类型偏重价格区、亮点区或小窗预览区
  - OCR 作业 raw 结果当前也会额外记录 `_ocrMeta.imageHint / routingMode`，便于后续做命中率统计与排障归因
  - 当前状态页识别记录与后台 OCR 作业详情已直接展示这层提示模式，可区分“自动识别 / 手动指定”以及具体命中的截图类型
  - 装备 OCR 结果确认弹窗与实验室待确认详情也已直接展示这层提示模式，人工复核时不需要再进原始 JSON 判断
- 未完成：
  - 当前自动识别仍属于 prompt 级布局判断，后续若继续增强，可再补独立的图片分类器、不同截图类型的识别效果统计，以及自动识别命中率看板

### E. 3.2.2 实验对比中心

- 已完成：
  - 样本席位默认跟随当前装备方案
  - 对比席位逐槽换装
  - 多维属性对比、符石差异、套装差异、服务端总伤对比
  - 从实验室覆盖到当前状态，并自动保留应用前快照与回滚入口
- 已完成补充：
  - 实验室正式支持口径已统一为“样本席位 + 1 个对比席位”
  - 前台已提供“继承旧宝石 / 继承旧符石”开关，并会在席位上显示当前继承策略
  - 删除局部替换装备时会恢复到样本席位对应栏位，而不是简单清空
- 未完成：
  - 当前仍以“逐槽替换”作为主要实验方式，尚未扩展成更高阶的批量局部变量工作流

### F. 3.2.3 预期效果预判

- 已完成：
  - 服务端总伤
  - 总价格
  - 1 点法伤成本
  - 总伤增益百分比
  - 收益摘要
  - 边际效益提醒
  - 确认替换到当前状态
- 部分完成：
  - 当前“收益摘要 / 低性比提醒”已可用，后续若继续增强，主要是更复杂的收益排序解释和分档策略
- 未完成：
  - 暂无阻塞主链的关键缺口，后续主要是收益摘要和排序解释增强

### G. 历史优先级归档

本节原本用于记录 `2026-04-14` 那一轮“先收主线、再扩系统”的阶段性优先级。

从 `2026-04-16` 起，这组优先级已经不再继续单独维护，统一并入 `Unified-Next-01 正式数据接入与实验室主链收口`。

### H. 上一轮 7 组优化任务归档

本节对应上一轮产品优化诉求的收尾结论。当前这 7 组内容已经不再作为独立进行中的任务维护，而是按“已收尾 / 剩余缺口迁移”归档。

#### H1. 多套装备切换交互

- 状态：已收尾
- 已完成：
  - 左右切换按钮已删除，方案区改成“点击切换 + 独立操作条”。
  - 方案切换、复制、重命名、删除已拆开，主链不再依赖 hover 触发。
  - 当前装备页的方案区已进一步收口为“信息卡 + 明确按钮”结构：卡片本体不再承担大面积 hover 交互，切换/复制/重命名/删除都改成独立按钮，降低误触和悬停干扰。
- 剩余迁移：
  - hover 态和点击热区的小幅打磨，统一迁入 `Unified-Next-01`。

#### H2. 新建角色多图导入 + OCR 基线口径

- 状态：已收尾
- 已完成：
  - 建角入口已升级为多图导入向导，支持面板图与当前装备图分步导入。
  - 人物面板已按 `OCR 真值基线` 保存，后续换装、加点、修炼、神器全部走“基线 + 增量”模型。
  - 装备 OCR 首屏确认弹窗与实验室待确认详情已补出统一“OCR 结果解释”区，会展示有效字段数、数值属性数、关键缺失项、置信度文案与建议优先核对项，减少用户二次进入详情前的判断成本。
  - OCR 解释区已进一步补出“已识别关键项 / 缺失关键项 / 疑似漏识别属性”三层提示，用户能直接判断这次识别是“字段没出”“数值漏了”还是“可以继续确认”。
- 剩余迁移：
  - OCR 结果解释和识别说明的进一步优化，统一迁入 `Unified-Next-01`。

#### H3. 装备展示体验

- 状态：主链收尾，剩余迁移
- 已完成：
  - 装备亮点标签、高关注字段聚合、OCR 确认弹窗、装备图与 OCR 原图对照链路已打通。
  - 当前装备卡、待确认卡、新品卡默认都以装备图为主图。
- 剩余迁移：
  - 真实梦幻装备素材文件正式入仓。
  - 首屏 OCR 确认弹窗如需更强 inline 编辑，再作为 `Unified-Next-01` 子项继续增强。

#### H4. 符石 / 星石 / 最优解

- 状态：主链收尾，剩余迁移
- 已完成：
  - 符石组合、部分全身限制、招云 / 腾蛟、技能等级联动、隔山打牛上限等核心规则已进入正式计算链。
  - 星石 / 星相互合已有正式建模基础。
- 剩余迁移：
  - 符石系统穷举
  - 星石系统穷举
  - 最优符石组合默认解
  - 以上内容统一迁入 `Unified-Next-01`，当前只做占位，不继续按现有猜测规则扩展；待用户提供正式数据后再一次性推进。

#### H5. 神器佩戴

- 状态：已收尾
- 已完成：
  - 玉魄下方独立“神器加成”区域已上线。
  - 单属性神器已支持录入、云端保存、刷新回填，并联动当前状态、实验室与伤害试算。
- 剩余迁移：
  - 若后续需要更多预设或更细规则说明，统一作为 `Unified-Next-01` 的补强子项处理。

#### H6. 面板布局调整

- 状态：主链收尾，剩余迁移
- 已完成：
  - 右侧战斗参数已收纳到二级面板。
  - 主界面已调整为“左侧角色资料 / 中间当前装备 / 右侧最终面板摘要”。
  - 右侧最终面板已展示关键结果字段。
  - 右侧最终面板已进一步重排为“角色速览 → 核心面板属性 → 进阶战斗指标 → 关键字段来源”的阅读顺序；核心区当前优先展示 `气血 / 魔法 / 伤害 / 防御 / 速度 / 法术伤害 / 法术防御`，更贴近真实梦幻角色截图的阅读习惯。
  - 右侧最终面板已新增“试算语境”摘要，当前会直接展示技能、我方阵法、我方五行、当前目标、目标阵法、法伤结果、目标法防结果，减少“数值看到了但不知道是按什么条件算出来的”理解成本。
- 剩余迁移：
- 右侧字段编排继续微调，例如后续若补到稳定的“法暴伤害 / 穿刺效果 / 抗封率”等百分比口径，再继续向真实梦幻角色截图靠齐。

#### H7. 装备库与实验席位

- 状态：主链收尾，剩余迁移
- 已完成：
  - 装备库已支持批量上传、倒序展示、主类 / 部位筛选。
  - 实验室已收口为“样本席位 + 1 个对比席位”。
  - 当前装备页与实验室都已接入统一装备总库，并支持来源筛选、方案占用提示、候选清理、送实验室、挂方案、正式库存生命周期筛选、批量状态动作和恢复待用。
  - 普通换装弹窗与实验室槽位选择器继续只消费 `active` 正式库存。
  - 普通换装弹窗与实验室槽位选择器已补出边界提示，明确说明 `已售出 / 已作废` 的正式库存不会进入换装选择器，如需继续使用需先到装备总库执行“恢复待用”。
  - 实验室席位卡已补“结论速览”区，会优先展示伤害结论、总伤增益、差价成本、1 点法伤成本，以及边际效益提醒，减少还没看明细前的判断负担。
  - 实验室席位栏位列表已补状态标签，当前会直接标出“沿用当前 / 替换当前 / 新增挂载 / 未挂载”，降低逐槽阅读成本。
- 剩余迁移：
  - 真实梦幻角色截图式的字段编排、hover 微调与视觉打磨，统一迁入 `Unified-Next-01`。

#### H 归档结论

- 上一轮 7 组优化诉求到这里正式关单。
- 已完成内容保持为当前基线能力。
- 所有还值得继续做的剩余项，统一迁入 `Unified-Next-01 正式数据接入与实验室主链收口`，后续不再单独按 `H1-H7` 继续开子主线。

## 2.2 测试验收索引

测试相关内容已从任务文档拆出，统一维护在 [simulator-test-report.md](/Users/czy/Documents/dream/docs/simulator-test-report.md)：

- 前台回归与线上验收
- OCR 专项
- `M3 / M4 / M5 / M6 / M7` 专项测试
- 后台联调验证
- 本地构建、D1 smoke test 与发布链路

当前任务文档只保留实现状态、缺口、优先级与开发任务，不再重复维护测试账号、验收版本、回归命令和结果表。

## 2.4 2026-04-11 龙宫法师新规则对照补充

本节仅针对用户最新补充的以下范围做实现状态判断：

- `2.1.1 属性转化规则`
- `2.1.2 伤害计算规则`
- `2.1.3 装备 / 宝石字段`

判断口径不是“仓库里是否存在类似功能”，而是“当前代码是否已经按这版新规则落地并联动生效”。

### 总结结论

- 当前功能未完全完成。
- 已有伤害公式主链、装备基础字段、技能试算入口。
- 本轮已补齐龙宫法师新属性换算、五行系数、战斗上下文透传、阵法枚举和基础阵法推导主链。
- 当前主要缺口集中在“图片版阵法克制矩阵”的完整文本化、阵法速度副作用是否纳入正式面板、以及宝石的完整对象模型。

### 已完成或基本完成

#### A. 龙卷雨击公式主骨架

当前状态：

- 已存在 `龙卷雨击` 技能公式。
- 基础项已采用二次项：`(技能等级² / 145) + (技能等级 * 1.4) + 39.5`。
- 最终公式已包含 `面板法伤`、`目标实际法防`、`阵法系数`、`变身卡系数`、`五行系数`、`分灵系数`、`修炼差`、`神木符`、`法伤结果` 等字段位。

主要代码：

- `scripts/init-damage-rules.ts`
- `src/shared/services/damage-engine.ts`

#### B. 分灵系数

当前状态：

- 当前 lookup 已实现 `1 -> 0.9`、`2 -> 0.8`、`3 -> 0.7`、`4 -> 0.6`、`5+ -> 0.5`。
- 与本次补充规则基本一致。

主要代码：

- `scripts/init-damage-rules.ts`

#### C. 单件装备的大部分基础字段

当前状态：

- 装备名称、图片、描述、可装备角色、等级、五行、耐久、锻炼、宝石、开运孔、星位、星相互合、门派条件、部位条件、特效、熔炼、价格、跨服费等字段，当前模型和 OCR 已覆盖大部分。
- 现有数据结构已经能支撑“装备卡片展示 + OCR 草稿识别 + 人工确认修改”的主链路。

主要代码：

- `src/features/simulator/store/gameTypes.ts`
- `src/shared/services/simulator-ocr.ts`

### 部分完成

#### A. 阵法与战斗上下文主链已基本接通

当前状态：

- 技能试算请求现已补传 `selfFormation / targetFormation / selfElement / targetElement`。
- `CombatPanel` 保存 battle context 时，会自动推导 `formationCounterState` 与 `elementRelation`，不再写死 `无克/普通`。
- 服务端在请求未显式传倍率时，也会按双方阵法和五行自动回退推导。
- `天覆阵 -10% 速度` 已并入前台本地面板与服务端试算速度口径。
- 当前尚未继续细化的是其他阵法的自身副作用与站位差异。

主要代码：

- `src/shared/services/damage-engine.ts`
- `src/shared/blocks/simulator/CombatPanel/SkillDamagePanel.tsx`

#### B. 法伤结果与战斗附加项继承已基本完成

当前状态：

- 服务端公式已支持 `magicResult` 作为最终固定加成。
- 当前技能试算面板会优先继承 battle context 中的 `transformCardFactor / shenmuValue / magicResult / targetMagicDefenseCultivation`。
- 实验室估值链路现也会继承 `selfFormation / selfElement / targetFormation / targetElement / transformCardFactor / shenmuValue / magicResult / targetMagicDefenseCultivation`，样本席位与对比席位不再默认走脱节的旧战斗条件。
- 在当前实现里，前台和服务端已不再各自维护一套明显脱节的默认战斗值。

主要代码：

- `src/shared/services/damage-engine.ts`
- `src/shared/blocks/simulator/CombatPanel/SkillDamagePanel.tsx`

#### C. 装备上的宝石信息可记录，但宝石系统不是完整对象模型

当前状态：

- 当前装备模型里已有 `gemstone` 摘要字段和 `gemstones` 结构化数组，构建表里也有 `holeCount`、`gemLevelTotal` 等摘要信息。
- 当前状态页与实验室装备弹窗都能直接编辑结构化宝石，至少支持名称、图片 URL、类型、五行、等级、数量和单颗宝石数值字段。
- 前台 `gameLogic` 与服务端 `simulator-domain` 已开始把 `gemstones[].stats` 纳入属性汇总，不再只做展示。
- 但当前还没有独立的宝石主数据表，也没有把宝石图片、类型、五行、吸收类百分比、基础属性类宝石规则全部收口为强校验数据源。

主要代码：

- `src/features/simulator/store/gameTypes.ts`
- `src/shared/lib/simulator-equipment-meta.ts`
- `src/shared/blocks/simulator/GemstoneEditor.tsx`
- `src/config/db/schema.sqlite.ts`

### 未完成或与新规则明显不一致

#### A. 属性转化规则已切到龙宫法师新口径

当前状态：

- 当前规则种子、服务端 `damage-engine`、前台 `gameLogic` 已同步切到本次龙宫法师新口径：
  - `体质 -> 气血 4.5 / 灵力 0.3 / 速度 0.1`
  - `魔力 -> 魔法 3.5 / 灵力 0.7`
  - `力量 -> 伤害 0.56 / 命中 1.7 / 灵力 0.4 / 速度 0.1`
  - `耐力 -> 防御 1.6 / 灵力 0.2 / 速度 0.1`
  - `敏捷 -> 速度 0.7 / 躲避 1`
  - `灵力 -> 法伤 1 / 法防 1`
- `baseHp` 的服务端反推也已改成新口径：`(面板气血 - 体质 * 4.5 - 装备气血) / 5`。

主要代码：

- `scripts/init-damage-rules.ts`

#### B. 五行系数已按新规则调整

当前状态：

- 当前伤害修正已调整为 `克制 = 1.05`、`被克制 = 0.95`、`无克 = 1.0`。
- 前台负责关系判断，倍率仍统一以服务端规则 lookup 为准。

主要代码：

- `scripts/init-damage-rules.ts`
- `src/shared/blocks/simulator/CombatPanel/index.tsx`

#### C. 阵法克制矩阵已落地 9 阵完整 pair

当前状态：

- 当前已按 `普通阵 / 天覆阵 / 地载阵 / 风扬阵 / 云垂阵 / 龙飞阵 / 虎翼阵 / 鸟翔阵 / 蛇蟠阵` 的完整 pair 表落地自动推导。
- `大克 / 小克 / 无克 / 被小克 / 被大克` 五种状态都会根据双方阵法实时回推，并进入保存链路与伤害试算。
- 若后续要支持 `鹰啸阵 / 雷绝阵`，仍需继续扩表；但本次 9 阵范围已不再依赖临时大克映射。

主要代码：

- `scripts/init-damage-rules.ts`
- `src/shared/blocks/simulator/CombatPanel/index.tsx`

#### D. 战斗参数保存时不再写死阵法克制状态

当前状态：

- 当前保存战斗上下文时，`formationCounterState` 与 `elementRelation` 已按双方阵法 / 五行自动推导。
- 技能试算请求也会优先传递当前前台选择值，避免使用陈旧 battle context。

主要代码：

- `src/shared/blocks/simulator/CombatPanel/index.tsx`

#### E. 阵法枚举与 9 阵克制矩阵已接通，但自身副作用仍待补全

当前状态：

- 当前前台阵法选择已补齐 `普通阵 / 天覆阵 / 地载阵 / 风扬阵 / 云垂阵 / 龙飞阵 / 虎翼阵 / 鸟翔阵 / 蛇蟠阵`，并统一收口到 `SIMULATOR_FORMATION_OPTIONS`。
- `普通阵 = 1.0`、`天覆阵 = 1.2` 已可直接进入伤害试算。
- 当前缺口主要是其余阵法“自身伤害倍率 / 速度副作用 / 站位差异”仍按 `1.0` 兜底，待完整规则确认后继续细化。

主要代码：

- `src/shared/blocks/simulator/CombatPanel/index.tsx`

### 建议优先级

若下一轮要按这版规则继续开发，建议按以下顺序推进：

1. 先确认其余阵法的自身副作用与站位差异是否需要进入正式面板和估值链路。
2. 然后决定宝石系统是继续维持轻量结构化字段，还是升级为正式对象模型。
3. 最后补一次前台真机 / 浏览器联调，确认当前状态页与技能试算页的阵法回显一致。

### 可执行开发任务拆分

以下任务面向“直接开工”，默认以本次新规则为新的验收标准。

#### Task LG-RULE-01 属性转化规则改造

**目标**

将 `龙宫-法师` 的属性转化规则更新为本次新口径，并保证服务端伤害引擎、前台面板展示、规则中心试算口径一致。

**改动范围**

- 更新规则种子中的属性转化系数
- 明确 `灵力 = 法术伤害 + 法术防御` 的映射口径
- 检查现有 `magicDamage / magicDefense / speed / hit / damage / dodge / hp / mp` 的派生链是否仍有旧系数残留
- 更新相关测试样例

**建议落点**

- `scripts/init-damage-rules.ts`
- `src/shared/services/damage-engine.ts`
- `src/shared/services/damage-engine.test.ts`
- 如规则中心展示依赖字段说明，也需同步检查 `src/shared/models/damage-rules.ts`

**交付物**

- 新版龙宫法师属性转化规则种子
- 至少 1 组覆盖新系数的单元测试
- 一份用于人工验收的样例输入输出

**验收标准**

- 按新规则录入 1 点体质 / 魔力 / 力量 / 耐力 / 敏捷时，派生属性与文档一致
- 伤害引擎与规则试算页输出一致
- 不再出现旧系数 `12 / 1.6 / 5 / 4 / 2 / 8`

**风险提醒**

- 现有角色面板数值可能整体变化，若线上已有历史数据，需要确认是否接受“同一角色在新规则下结果重算”

#### Task LG-RULE-02 五行系数修正

**目标**

将五行伤害修正从旧口径 `1.1 / 0.9` 调整为新口径 `1.05 / 0.95`，并保持前后端一致。

**改动范围**

- 更新规则种子中的五行 lookup
- 检查前台五行关系推导仅负责“关系判断”，不要重复编码具体倍率
- 补伤害试算回归用例

**建议落点**

- `scripts/init-damage-rules.ts`
- `src/shared/blocks/simulator/CombatPanel/index.tsx`
- `src/shared/services/damage-engine.test.ts`

**交付物**

- 新版五行倍率配置
- 覆盖 `克制 / 被克制 / 无克` 三种情况的测试

**验收标准**

- `水克火` 时最终乘区为 `1.05`
- `火被水克` 时最终乘区为 `0.95`
- 前台展示关系与后端实际计算一致

#### Task LG-RULE-03 阵法本身加成与阵法枚举补齐

**目标**

先把“阵法本身加成”从默认值收口为可配置、可枚举、可保存的正式规则，为后续克制矩阵打底。

**改动范围**

- 补齐前台阵法选项，至少纳入本次规则要求会用到的阵法
- 明确 `普通阵` 的存在和默认系数
- 将 `天覆阵 +20% 伤害、-10% 速度` 这类阵法自身效果整理为可消费配置
- 校验战斗上下文保存与读取链路

**建议落点**

- `src/shared/blocks/simulator/CombatPanel/index.tsx`
- `src/shared/services/damage-engine.ts`
- 如需正式配置化，可扩展 `scripts/init-damage-rules.ts` 或规则扩展表

**交付物**

- 补齐后的阵法枚举
- 至少一条“天覆阵”伤害加成的自动化回归
- 战斗参数保存后的回显验证

**验收标准**

- 前台可以选择 `普通阵`
- `天覆阵` 下伤害试算可反映 `1.2` 系数
- 若速度也参与阵法影响，需在面板或 breakdown 中体现

#### Task LG-RULE-04 阵法克制矩阵落地

**目标**

把图片中的“阵法对阵法克制矩阵”落成正式数据，不再依赖手写 `大克 / 小克 / 无克`。

**改动范围**

- 将阵法克制关系整理成矩阵表或明确的 pair lookup
- 根据 `selfFormation + targetFormation` 自动推导克制结果
- 保存战斗上下文时不再写死 `formationCounterState`
- 伤害试算请求与服务端计算统一走同一推导结果

**建议落点**

- `src/shared/blocks/simulator/CombatPanel/index.tsx`
- `src/shared/blocks/simulator/CombatPanel/SkillDamagePanel.tsx`
- `src/shared/services/damage-engine.ts`
- 如采用规则种子方式，也需更新 `scripts/init-damage-rules.ts`

**交付物**

- 阵法克制矩阵数据源
- 自动推导函数
- 覆盖典型阵法对阵法结果的测试

**验收标准**

- 我方阵法、敌方阵法变化后，克制结果会自动变化
- 保存后的 battle context 中不再固定为 `无克/普通`
- 技能试算与当前战斗面板保持一致

**风险提醒**

- 你提供的图片矩阵需要先人工转成文本表；若图片里某些值仍不明确，需先确认最终矩阵版本再编码

#### Task LG-RULE-05 技能试算面板继承真实战斗上下文

**目标**

让技能试算面板真正继承当前战斗参数，而不是用本地默认值部分覆盖。

**改动范围**

- 技能试算请求补传 `formationFactor` 或阵法来源字段
- 技能试算请求补传 `formationCounterState`
- 明确 `magicResult`、`elementRelation`、`transformCardFactor`、`shenmuValue` 的优先级
- 减少面板初始化默认值对真实上下文的覆盖

**建议落点**

- `src/shared/blocks/simulator/CombatPanel/SkillDamagePanel.tsx`
- `src/shared/services/damage-engine.ts`
- 如有需要，联动 `/api/simulator/current/battle-context`

**交付物**

- 新版技能试算请求结构
- 面板初始化与当前 battle context 对齐
- 至少 1 条“保存战斗参数后打开试算面板仍保持一致”的回归验证

**验收标准**

- 更改战斗参数并保存后，技能试算面板展示与实际计算一致
- `magicResult` 不会被无条件重置为 `0`
- 阵法、五行、变身卡等参数不再出现“面板显示一套、后端计算另一套”

#### Task LG-DATA-01 宝石系统升级方案评估

**目标**

决定宝石能力是维持轻量记录，还是升级成正式对象模型，并先产出明确的实现边界。

**改动范围**

- 梳理当前 `gemstone / holeCount / gemLevelTotal` 已支持内容
- 对照新规则列出缺失字段：宝石图片、类型、五行、具体属性、吸收类百分比等
- 给出两套方案：
  - 方案 A：维持轻量模式，仅补展示与 OCR 识别
  - 方案 B：正式建模宝石实体与规则消费

**建议落点**

- 文档优先
- 若进入正式开发，再落到 `src/config/db/schema.sqlite.ts`、`src/shared/models/simulator.ts`、OCR 和编辑弹窗

**交付物**

- 一份宝石建模决策说明
- 若选方案 B，补一版表结构草案和迁移清单

**验收标准**

- 团队明确知道“本期宝石做到哪一层”
- 后续开发不会在轻量字符串和正式实体之间来回摇摆

### 2.1.3 装备系统补充分析

本节针对用户新增的“装备 / 宝石 / 符石 / 符石组合 / 符石套装 / 星石 / 星相互合”详细规则，补一版更细的实现状态说明。

#### A. 单件装备字段

**已支持较完整**

- 当前 `Equipment` 模型已经覆盖大部分单件装备字段：
  - 名称、图片、描述、装备角色、等级、五行、耐久、锻炼
  - 主属性 / 附加属性
  - `hp / magic / hit / damage / magicDamage / defense / magicDefense / speed / dodge`
  - `physique / magicPower / strength / endurance / agility`
  - 镶嵌宝石、开运孔数、星位、星相互合、门派条件、部位条件、特效、熔炼、售价、跨服费
- OCR 结构化识别提示词也已经覆盖上述多数装备字段。
- 当前装备详情弹窗和实验室装备弹窗可对其中大量字段做编辑。

**当前仍不够正式的点**

- “品质颜色（白、蓝、紫、金）”当前有 `quality` 字段，但没有看到它被当作统一枚举规则管理。
- “特技”和“特效”目前更多还是字符串字段，没有正式拆分成独立能力对象。
- “符石每条属性最多 5 个”目前主要以前端数组承载，并未形成正式数据库子表。

#### B. 宝石

**当前已支持**

- 单件装备上已有 `gemstone` 摘要字段与 `gemstones` 结构化数组。
- 构建表已有 `holeCount`、`gemLevelTotal` 这类摘要字段。
- 当前状态 / 实验室弹窗都已有结构化宝石编辑入口，可维护名称、图片 URL、等级、数量和单颗数值。
- 前台推导与服务端汇总都已消费 `gemstones[].stats`。

**当前未完成**

- 宝石还不是正式独立实体，仍缺少：
  - 宝石主数据表 / 配置中心
  - OCR / 入库 / 编辑阶段统一复用的强校验字典
  - 吸收类宝石与基础属性类宝石的完整规则库
  - 不同宝石类型的默认数值模板与自动推导口径
- 也就是说，当前已经不是“只有一段宝石文本”，但还没完全升级成“正式宝石系统”。

**结论**

- 若按你这次规则验收，宝石部分已经进入“结构化可编辑 + 可参与汇总”的中间态，但距离完整完成还有主数据和强校验两层缺口。

#### C. 符石

**当前已支持**

- 当前前端已有 `RuneStone` 结构，包含：
  - 名称
  - 颜色 / 类型
  - 等级
  - 品质
  - 描述
  - 价格
  - `stats`
- 装备当前支持多套 `runeStoneSets`，并支持切换 `activeRuneStoneSet`。
- 装备详情和实验室详情弹窗都支持编辑每个孔位的符石。
- 服务端可从当前激活的符石集合里读取颜色序列，并用于符石组合 / 套装规则判断。

**当前未完成**

- 符石尚未形成正式数据库实体表，当前主要存在于装备的 `notesJson` / 前端对象里。
- 你这次定义的“伤害力 / 灵力 / 法伤 / 法防 / 气血 / 速度 / 命中 / 防御 / 躲避 / 五围 / 固伤”等字段，当前虽然可以借助 `stats` 容器表达，但没有“符石专用字段规范”。
- “天神符石伤害 +1.5 取整后累加”这类细规则，当前文档和代码里没有看到统一说明。

**结论**

- 当前符石属于“前端可编辑、引擎可部分消费”，但还不是完整、规范化的正式建模。

#### D. 符石组合

**当前已支持**

- 服务端规则种子里已经存在龙宫相关组合加成：
  - `九龙诀`
  - `呼风唤雨`
  - `龙腾`
- 伤害引擎已支持按当前装备激活符石颜色序列自动识别 `rune_combo`。
- 已有自动化测试覆盖“按符石颜色序列提升技能等级”的能力。

**当前部分支持**

- 前台已支持切换“符石组合”名称，且引擎会基于当前激活符石顺序识别颜色序列。
- 但你这次补充的完整龙宫法师组合清单里，还包括：
  - `破浪诀`
  - `逆鳞`
  - `隔山打牛`
- 这些并未全部在现有规则消费中完整落地。

**当前未完成**

- “全身上下仅生效 1 套，取等级最高一套”的门派加成类冲突规则，当前没有看到完整的全局 conflict policy。
- “隔山打牛全身最多生效 2 套，第 3 套完全失效”的全局上限规则，当前没有看到正式实现。
- “每件装备最多可镶嵌 2 套不同符石组合”目前也没有严格校验逻辑。

**结论**

- 当前符石组合已经有雏形，且比宝石成熟，但离你这版规则的“全局生效限制 + 全组合覆盖”还有差距。

#### E. 符石套装效果

**当前已支持**

- 服务端规则种子里已经有 `招云`、`腾蛟` 两套效果的核心消费：
  - `招云`：+6 灵力、+6 法伤、+6 法防、`龙卷雨击` 追加 `目标速度 * 4%`
  - `腾蛟`：+6 灵力、+6 法伤、+6 法防、`龙腾` 追加 `魔法消耗 * 4%`
- 伤害引擎支持按 6 件装备第一颗符石颜色序列做 `rune_full_set` 识别。
- 相关自动化测试已存在。

**当前未完成**

- 你这次规则里要求“6 件装备必须同时达成星相互合”才能触发套装效果。
- 当前 `rune_full_set` 识别只看第一颗符石颜色序列，没有把“6 件都满足星相互合”作为套装触发前置条件。
- 套装效果当前更多体现在服务端规则消费，没有看到前台明确展示“当前套装已激活 / 未激活及原因”的完整解释。

**结论**

- 当前符石套装效果已经进入“规则生效”阶段，但还没完全按你这次的触发条件严格实现。

#### F. 星石

**当前已支持**

- 已有 `star_stone_item / star_stone_attr` 正式表。
- 前台已有 `starPosition`、`starPositionConfig`，可表达星位属性。
- 服务端伤害引擎已经能消费星位加成，例如 `法伤 +2.5` 直接进入面板法伤。

**当前未完成**

- 你这次规则里的星石字段包括：
  - 名称
  - 类型
  - 颜色
  - 阴阳状态
  - 等级
  - 多类核心属性
- 当前正式表虽然存在，但前台主链路仍主要依赖 `starPosition / starPositionConfig`，还没有全面切到“正式星石实体驱动”。
- “阴 / 阳状态切换不同分支属性”这类规则，当前没有看到完整前台录入与服务端消费闭环。

**结论**

- 星石已经有正式建模基础，但目前仍处于“过渡态”，不是完整产品化状态。

#### G. 星相互合

**当前已支持**

- 已有 `star_resonance_rule / character_star_resonance` 正式表。
- 种子规则已覆盖你这次列出的 6 个部位：
  - 头盔 `九龙诀`
  - 项链 `龙腾`
  - 武器 `破浪诀`
  - 衣服 `呼风唤雨`
  - 腰带 `逆鳞`
  - 鞋子 `百步穿杨`
- 种子规则的颜色清单和单件加成也与本次规则基本一致：
  - 头盔 `法伤 +2`
  - 项链 `法伤 +2`
  - 武器 `五围 +1`
  - 衣服 `法防 +2`
  - 腰带 `气血 +15`
  - 鞋子 `速度 +1.5`
- 服务端伤害引擎已支持“6 件主装备都满足时，全基础属性 +2”的全套加成。
- 前台也已有星相互合规则选择入口，并从后台规则读取选项。

**当前未完成**

- 当前伤害引擎对“全套 +2”的判断，仍主要基于 6 件主装备都存在 `starAlignment`，并不是严格校验每件都命中了对应的 `comboName + requiredColors`。
- 也就是说，数据库规则表已经有了，但最终计算链路还没完全收口到“严格按规则表匹配”。
- “每件装备先满足对应符石组合，再满足颜色清单”这一层约束，目前没有看到完全统一的计算入口。

**结论**

- 星相互合是当前这块里最接近完整的模块之一，但最后一段“按正式规则严格匹配后再生效”的闭环还差一步。

### 2.1.3 对应新增开发任务建议

基于这次补充，建议在现有任务之外新增 4 个装备系统任务：

#### Task LG-EQUIP-01 装备字段正式化收口

**目标**

把当前已经存在的装备字段能力整理成明确的“正式字段清单”，区分展示字段、规则字段、OCR 字段和持久化字段，避免继续混用字符串与 notes 元数据。

**改动范围**

- 梳理 `Equipment` 当前字段与用户规则字段映射
- 明确 `quality / specialEffect / specialSkill / refinementEffect` 的边界
- 输出“哪些字段必须结构化、哪些字段允许文本兜底”

**验收标准**

- 单件装备字段清单完整
- OCR、前台编辑、持久化、服务端读取四端字段名称统一

#### Task LG-EQUIP-02 宝石正式建模

**目标**

将宝石从“装备上的字符串信息”升级为正式对象模型。

**改动范围**

- 增加宝石实体或装备-宝石子结构
- 支持宝石名称、图片、类型、五行、专属数值字段
- 明确吸收类宝石的百分比表示
- 联动 OCR 与前台编辑

**验收标准**

- 单件装备能结构化表达多颗宝石
- 服务端可读取宝石并进行属性汇总
- 不再只依赖 `gemstone` 文本字段

#### Task LG-EQUIP-03 符石与符石组合规则正式化

**目标**

让符石、符石组合、组合冲突规则、全身生效上限规则进入统一规则系统。

**改动范围**

- 定义符石实体字段规范
- 补齐 `破浪诀 / 逆鳞 / 隔山打牛`
- 实现“门派类全身只生效一套，取最高级”
- 实现“隔山打牛最多生效两套”
- 增加组合识别与冲突处理测试

**验收标准**

- 同时穿两件 `九龙诀` 时不会重复翻倍
- 第三套 `隔山打牛` 不再生效
- 颜色序列、部位限制、等级加成规则统一可测

#### Task LG-EQUIP-04 星石与星相互合正式闭环

**目标**

把星石 / 星相互合从“前台过渡态配置”收口到“按正式规则表匹配并生效”的统一链路。

**改动范围**

- 让伤害引擎优先使用 `star_resonance_rule`
- 全套 +2 判断改为严格按规则命中，不再只看是否填了 `starAlignment`
- 梳理星石正式实体与前台 `starPositionConfig` 的映射关系
- 视情况补齐阴阳状态与颜色校验

**验收标准**

- 单件星相互合必须满足正确组合与颜色清单才生效
- 六件全套 +2 只在 6 件都严格命中时触发
- 前台显示、后台规则、服务端计算三者一致

### 2.1.3 本轮落地进展（2026-04-11）

- `LG-EQUIP-01`：
  - 当前装备保存、实验室席位保存、云端回填三条链路，已经统一收口到结构化 `notes_json` 元数据。
  - 当前正式结构化字段包括 `gemstones`、`runeStoneSets`、`runeStoneSetsNames`、`activeRuneStoneSet`、`starPositionConfig`、`starAlignmentConfig`。
- `LG-EQUIP-02`：
  - 宝石已从单纯 `gemstone` 文本升级为结构化数组。
  - 保存时会自动计算 `holeCount / gemLevelTotal`，回填到前台时仍会同步派生 `gemstone` 摘要文本用于兼容展示。
- `LG-EQUIP-03`：
  - 当前已补齐 `破浪诀 / 逆鳞 / 隔山打牛` 的正式规则种子。
  - 服务端符石组合识别已支持“按命中件数计数后再套用 `globalMaxActive`”。
  - 门派技能类组合仍只取最高级；`隔山打牛` 当前按最多两套叠加面板加成生效。
- `LG-EQUIP-04`：
  - 星位、星相互合、6 件全套 +2 现优先消费结构化配置，不再只依赖旧文本字段。
  - 当前保留一个待确认假设：由于用户规则中 `招云` 武器首孔颜色与 `破浪诀` 颜色清单存在冲突，单件星相互合暂按“组合名命中 + 已存在结构化颜色配置”判定，full-set 的首孔颜色仍由套装规则单独校验。

相关后台联调、后台 CRUD 验收、本地构建验证和发布链路记录已迁移到 [simulator-test-report.md](/Users/czy/Documents/dream/docs/simulator-test-report.md)。

## 3. 优先级说明

- `P0`：必须优先完成，否则主链路不成立
- `P1`：主链路完成后马上跟进，决定产品是否真正可用
- `P2`：增强项，提升录入效率、决策能力和可维护性

## 4. P0 任务

### P0-01 统一龙宫法伤规则源

**目标**

把龙宫法师的属性转化、`龙卷雨击` 公式、阵法、五行、分灵、修炼差、法伤结果整理成单一规则入口。

**范围**

- 属性转化规则
- 技能基础项
- 目标法防扣减
- 阵法系数
- 五行系数
- 分灵系数
- 修炼差加成
- 法伤结果与神木符等固定值项

**建议落点**

- `src/shared/services/damage-engine.ts`
- `src/shared/models/damage-rules/*`
- `src/features/simulator/store/gameLogic.ts`

**验收标准**

- 同一输入下，多次计算结果一致
- UI 不再自己拼公式
- 规则能独立用于服务端或测试
- 计算结果输出可供后续 breakdown 使用

### P0-02 建立角色与战斗上下文数据模型

**目标**

把“角色静态档案”和“战斗环境参数”彻底分开建模，避免当前状态、实验室、目标参数互相污染。

**范围**

- 角色基础档案
- 技能与修炼
- 常规装备
- 灵饰
- 玉魄
- 战斗目标
- 战斗环境
- 实验方案上下文

**建议落点**

- `src/features/simulator/store/gameTypes.ts`
- `src/shared/models/simulator/*`
- `docs/d1-database-design.md`

**验收标准**

- 当前状态与实验室可共用同一套核心模型
- 角色属性和环境属性字段边界清晰
- 目标参数不再混进人物面板字段

### P0-03 D1 表结构与迁移

**目标**

把模拟器核心数据正式落入 D1，并建立可维护的迁移链。

**范围**

- 角色表
- 角色技能与修炼表
- 当前装备方案表
- 装备与灵饰明细表
- 玉魄表
- 目标预设表
- 实验记录表

**建议落点**

- `src/config/db/schema.sqlite.ts`
- `src/config/db/migrations_d1/*`
- `docs/d1-database-design.md`

**验收标准**

- schema 与 migration 一致
- 本地迁移成功
- 远端 D1 可正常建表、插入、查询、删除
- 数据库设计文档同步更新
- 不再引入新的数据库 provider 分叉

### P0-03A Cloudflare 基础设施边界收口

**目标**

把存储、部署和 AI provider 的边界收口到 Cloudflare + Gemini，避免后续实现分散。

**范围**

- D1 作为唯一业务数据库
- R2 作为唯一图片对象存储
- Cloudflare Workers 作为部署目标
- Gemini 作为图片识别与 AI 对话模型
- 环境变量与服务封装统一

**建议落点**

- `src/core/db/*`
- `src/extensions/storage/r2.ts`
- `src/extensions/ai/gemini.ts`
- `src/shared/services/ai.ts`
- `wrangler.toml`
- `docs/cloudflare-d1-deploy.md`

**验收标准**

- 图片上传走 R2
- 识别与聊天能力默认走 Gemini
- 部署配置不再依赖其他云运行时
- 本地与 Cloudflare 环境变量命名统一

### P0-04 当前状态页最小可用闭环

**目标**

用户可以维护一份“以 OCR 面板真值为基线”的真实角色档案。

**范围**

- 个人档案
- 技能与修炼
- 当前装备
- 战斗参数
- 保存与读取

**建议落点**

- `src/features/simulator/shell/*`
- `src/features/simulator/store/gameStore.ts`
- `src/features/simulator/store/gameStoreActions.ts`

**当前缺口补充**

- 本轮前台已补齐：
  - 人物属性 OCR 变更确认弹窗
  - 绿色提升 / 红色下降 diff 视图
  - 装备 OCR 成功后会先弹出识别确认页，只展示本次识别到的有效字段，并明确写入“候选装备待确认区”
  - 技能 `baseLevel / extraLevel / finalLevel` 展示
  - 潜力点前台展示与保存
  - 新建角色多图导入基础流，支持“面板图建基准 + 装备图进候选队列”
  - 当前状态页与实验室席位的面板计算已切换为“`OCR 面板真值基线 + 当前增量变化`”口径，不再在前台直接重算整套裸属性结果
  - 新建角色弹窗已收口为分步向导，支持“角色信息 -> 基线面板图 -> 当前装备图 -> 确认导入”完整流程，并提供建角导入进度条与结果摘要
  - 当前状态页、最终面板和实验室席位卡已补出“基线层 / 增量层”显式说明，用户能直接区分 OCR 真值与推演结果
  - 当前状态页与右侧最终面板已补出关键字段来源拆解与“主因 / 次因”摘要，能直接看到法伤 / 灵力 / 速度 / 法防 / 气血 / 命中 / 法爆等级 / 固伤 / 穿刺 的主要增量来自装备、经脉、修炼还是神器；点击字段还能展开查看完整来源明细，并细化到具体装备 / 神器 / 经脉项。当前“装备/符石”来源还能继续拆成“装备底子 / 宝石 / 符石”，并附简短规则说明
  - 实验室对比席位也已补出“相对样本位”的关键来源拆解，能直接看到法伤等涨跌主要来自装备底子、经脉还是神器；点击字段还能展开查看完整差异来源，并看到新增装备贡献与被替换装备损失。当前也能继续看到底子变化 / 宝石变化 / 符石变化
  - 当前装备详情与实验室装备详情已补出统一“规则解释”区，会对符石组合、星相互合、常规套装记录等显示“已激活 / 未激活 / 为什么这样判定”的说明；当前装备详情还能解释常规套装件数与阶梯，实验室详情则会提示“单件预览需挂载后再看整套件数”
- 当前剩余缺口已主要转移到：
  - 多图建角、OCR 确认页、当前基线回填在更细的措辞和结果解释上的统一表述
  - 继续把来源拆解从“摘要标签”深化为更细的逐字段查看入口与解释层级

**验收标准**

- 能录入门派、等级、五围、技能、修炼
- 能维护 6 件常规装备、4 件灵饰、2 件玉魄
- 能切换阵法、五行、目标后即时重算
- 人物面板 OCR 结果会被明确当作角色基线真值保存
- 后续装备 / 加点 / 修炼 / 神器改动都以该基线为增量计算起点

### P0-04A 人物属性 OCR 变更确认与彩色差异视图

**状态更新**

- `2026-04-12`：已完成前台落地，OCR 成功后会先展示变更确认，再决定是否写入当前状态。

**目标**

让“上传属性截图”从直接覆盖，升级为可确认、可回看的更新流程。

**范围**

- OCR 结果与当前档案 diff
- 变更确认弹窗
- 绿色提升 / 红色下降展示
- 用户确认后再写入当前状态
- 保留未识别字段不清空

**建议落点**

- `src/shared/blocks/simulator/CharacterPanel/UploadPopover.tsx`
- `src/app/api/simulator/current/profile/ocr/route.ts`
- `src/features/simulator/utils/simulatorBundle.ts`

**验收标准**

- OCR 成功后先展示变更确认，不直接覆盖前台状态
- 数值上升为绿色，下降为红色，未变更不高亮
- 用户确认后才真正写入当前角色档案

### P0-04B 技能额外等级展示与潜力点补齐

**状态更新**

- `2026-04-12`：已完成前台落地，技能可显示 `基础等级 + 额外等级`，潜力点已纳入当前状态页保存链路。

**目标**

把“角色档案已具备的后端语义”真正露出到前台，避免技能与档案信息残缺。

**范围**

- 技能展示消费 `baseLevel / extraLevel / finalLevel`
- 显示 `180+2` 一类等级格式
- 潜力点前台展示与保存
- 技能 / 修炼区域信息布局调整

**建议落点**

- `src/shared/blocks/simulator/CharacterPanel/index.tsx`
- `src/features/simulator/store/gameTypes.ts`
- `/api/simulator/current/profile`

**验收标准**

- 技能加成来源至少能在前台显示出额外等级
- 用户能看到潜力点当前值
- 技能与修炼展示不再与后端语义脱节

### P0-05 伤害计算结果可解释化

**目标**

除了输出最终伤害，还要输出用户能看懂的解释路径。

**范围**

- 基础项
- 面板法伤
- 目标法防
- 阵法
- 五行
- 分灵
- 修炼差
- 法伤结果
- 其他固定值项

**建议落点**

- `src/shared/services/damage-engine.ts`
- 模拟器结果展示组件

**验收标准**

- UI 可展示“为什么变化”
- 结果结构稳定，能用于测试和 debug
- 每个主要 modifier 都有独立字段

**当前状态**

- 已完成：
  - 服务端 `damage-engine` 已输出稳定的结构化 `breakdown`
  - 当前伤害详情弹窗已补出“过程分解”区，能按阶段展示主公式、环境修正、罗汉、法伤结果、波动、目标法防结果与最终取整伤害
  - 当前伤害详情弹窗已补出“生效规则与来源”区，能汇总技能加成、超上限失效规则、追加伤害、装备百分比词条、灵饰套装与常规套装来源
- 部分完成：
  - 现阶段解释层主要落在伤害详情弹窗，后续若继续增强，可再补到实验室收益解释与顾问问答引用口径

### P0-06 核心公式测试

**目标**

把最关键的数值规则钉死，防止后续改动破坏主链路。

**范围**

- 五围属性转化
- 龙卷雨击主公式
- 阵法影响
- 分灵影响
- 修炼差影响
- 法伤结果影响

**建议落点**

- `src/shared/services/__tests__/damage-engine.test.ts`
- `src/features/simulator/store/__tests__/gameLogic.test.ts`

**验收标准**

- 覆盖文档中已明确写死的规则
- 至少有一组黄金样例
- 测试能说明输入、过程和结果

## 5. P1 任务

### P1-01 当前装备详情弹窗补全

**状态更新**

- `2026-04-12`：已补齐当前装备详情与实验室装备详情里的独立“初值”展示区；当前剩余缺口主要是更强的套装语义解释，而不是字段缺失。
- `2026-04-14`：当前装备页已新增“神器加成”编辑区，支持在玉魄下方直接维护单一属性神器、单独保存到云端，并在刷新后自动回填到当前角色。

**目标**

让装备展示从“有名字和数值”提升到“能支撑判断”。

**范围**

- 初值
- 锻位
- 熔炼
- 开孔数
- 宝石
- 符石
- 套装效果
- 售价与跨服费

**建议落点**

- `src/features/simulator/overlays/EquipmentReplaceDialog.tsx`
- 新增装备详情组件

**验收标准**

- 常规装备、灵饰、玉魄都能显示核心业务字段
- 关键字段不依赖原始字符串人工阅读

### P1-02 多套装备快照

**目标**

支持任务套、PK 套等方案切换。

**范围**

- 新建方案
- 复制方案
- 重命名方案
- 激活方案
- 保存方案

**建议落点**

- `src/features/simulator/store/gameStore.ts`
- D1 方案表

**当前实现补充**

- 已落地到 D1 正式表：
  - `equipment_plan`
  - `equipment_plan_item`
- 现有前端方案切换、重命名、同步逻辑无需重写，但读源已切到正式方案表

**验收标准**

- 多套方案互不污染
- 切换方案后面板和伤害同步更新

### P1-03 目标预设系统

**目标**

让常见副本怪可以直接选择，不必每次手工录入。

**范围**

- 副本目标种子数据
- 目标选择器
- 自动回填目标属性
- 手动目标补录

**建议落点**

- `src/features/simulator/store/gameData.ts`
- `src/features/simulator/store/gameRuntimeSeeds.ts`
- D1 目标预设表

**验收标准**

- 选择目标后自动填充法防、防御、气血、五行等
- 预设目标与手动目标并存

### P1-03A 战斗环境与特殊目标规则

**状态更新**

- 当前可记为 `6 / 6` 已完成：
  - `M9-01` 已补 `乌鸡国 / 水陆大会 / 车迟国 / 大雁塔 / 通天河 / 平顶山 / 红孩儿 / 齐天大圣 / 石猴授徒` fallback 目标模板，并会在副本目标面板自动补齐缺失预置
  - `M9-02` 已按正式口径 `克制 +5% / 被克制 -5%` 进入服务端试算
  - `M9-03` 已新增“目标法防结果”独立字段，按最终结果固定扣减
  - `M9-04` 已新增天气字段，当前支持“雨天龙宫 +10%”
  - `M9-05` 已新增目标防御状态字段，并明确当前龙宫法伤不受影响
  - `M9-16` 已新增特殊目标法术减伤系数入口，可进入服务端试算

**目标**

把“目标模板、特殊怪物减伤、天气修正、目标状态修正”纳入统一战斗环境模型，避免当前伤害试算只能覆盖基础法防 / 五行 / 阵法。

**范围**

- `M9-01` BOSS 属性加载
  - 补齐 `通天河 / 平顶山 / 红孩儿 / 齐天大圣 / 石猴授徒` 等常用目标模板
  - 选择 BOSS 后自动回填法防、防御、气血、五行等
- `M9-02` 五行相克计算
  - 继续保留当前 `1.05 / 0.95` 正式口径
  - 作为后续特殊环境修正的基线测试
- `M9-03` 目标法防结果
  - 新增“目标法防结果”独立字段
  - 口径为最终伤害结果额外扣减固定值，例如 `+50` 就扣 `50`
- `M9-04` 天气系统联动
  - 新增天气字段与天气修正规则
  - 当前先支持“雨天龙宫伤害补偿 +10%”
- `M9-05` 目标防御指令
  - 新增目标状态字段
  - 明确“防御状态只影响物伤，不影响法伤”
- `M9-16` 地煞减伤系数
  - 新增特殊怪物减伤系数
  - 至少支持“6 星地煞法术减伤系数”进入试算

**当前判断**

- 新字段当前统一挂在 `snapshot_battle_context.notes_json`，避免为这一轮规则扩展先引入额外 migration。
- 伤害引擎已把天气、目标法防结果、目标防御状态、特殊法术减伤系数纳入同一条试算链路，并保留 breakdown 字段方便后续核账。
- `乌鸡国 / 水陆大会 / 车迟国 / 大雁塔 / 通天河 / 平顶山 / 红孩儿 / 齐天大圣 / 石猴授徒` 通过前端 fallback 模板与模板合并逻辑进入副本目标面板，不依赖后台模板预置是否已同步。
- 前台入口已补齐到“战斗参数”页与“技能伤害”弹窗，用户可直接调整并验证这组环境参数。

**建议落点**

- `src/features/simulator/store/gameData.ts`
- `src/features/simulator/utils/targetTemplates.ts`
- `src/shared/services/damage-engine.ts`
- `src/shared/lib/simulator-battle-context.ts`
- `snapshot_battle_context.notes_json`
- `src/app/api/simulator/current/battle-context/route.ts`
- `src/app/api/simulator/calculate-damage/route.ts`

**验收标准**

- `M9-01`
  - 选择“通天河 / 平顶山 / 红孩儿 / 齐天大圣 / 石猴授徒”等副本后，目标法防、防御、气血、五行自动填充
- `M9-02`
  - 水克火时，法伤结果按 `+5%` 稳定命中
- `M9-03`
  - 目标带“法防结果 +50”时，最终伤害结果固定额外扣减 `50`
- `M9-04`
  - 选择“雨天”后，龙宫法伤最终结果按规则抬升 `10%`
- `M9-05`
  - 目标切到“防御”状态时，物伤减半，法伤保持原口径
- `M9-16`
  - 6 星地煞目标的法术减伤系数能进入服务端试算与实验室估值

### P1-04 实验室样本席位与对比席位

**目标**

把实验室收口成“同一角色两套装备方案”的换装推演系统，而不是继续向多席位横向铺开。

**范围**

- 样本席位
- 对比席位
- 局部替换 1-2 件装备
- 是否继承旧宝石/符石
- 属性差异
- 伤害差异

**建议落点**

- `src/features/simulator/store/gameStoreActions.ts`
- `src/features/simulator/store/gameRuntimeSeeds.ts`

**当前缺口补充**

- 本轮前台已补齐：
  - 实验室正式口径统一为“样本席位 + 1 个对比席位”
  - 局部换装支持“继承旧宝石 / 继承旧符石”切换
  - 席位会显示当前继承策略
  - 删除局部替换会恢复到样本席位对应装备
- 当前剩余缺口主要是：
  - 进一步收口到“同角色双方案对比”的主视图与交互心智，减少用户把实验室当成多席位横向评测墙来理解
  - 更高阶的多槽位批量变量工作流
  - 与复杂套装 / 互合规则的严格联动解释

**验收标准**

- 可在不改当前状态的前提下做局部实验
- 可展示实验前后面板与伤害变化
- 用户能清楚理解“样本方案 vs 对比方案”的关系，不需要在多个横向席位之间来回找上下文

### P1-04A 实验席位数量与试算口径统一

**状态更新**

- `2026-04-12`：已完成当前轮口径统一，前台、store 与试算均以“样本席位 + 1 个对比席位”为正式能力边界。

**目标**

统一 store、前台展示和服务端试算对“实验席位数量”的理解，避免能力与实际行为不一致。

**范围**

- 明确正式支持的对比席位数量
- UI 展示席位数量与新增按钮策略
- `lab-valuation` 入参席位数量
- 对比表展示列数

**建议落点**

- `src/features/simulator/store/gameStoreActions.ts`
- `src/shared/blocks/simulator/LaboratoryPanel/index.tsx`
- `src/shared/blocks/simulator/LaboratoryPanel/LaboratoryComparisonTable.tsx`
- `/api/simulator/current/lab-valuation`

**验收标准**

- 前台可见席位数量与 store 限制一致
- 服务端试算不会静默忽略多余席位
- 文档中“1-2 件局部测试”的真实能力与交互口径一致

### P1-04B 局部换装继承旧宝石/符石开关

**状态更新**

- `2026-04-12`：已完成当前轮前台落地，用户可切换是否继承旧宝石 / 旧符石，席位会保留并展示该策略。

**目标**

让实验室局部对比更接近玩家实际决策，能区分“只比底子”和“带旧打造继承”。

**范围**

- 继承旧宝石开关
- 继承旧符石开关
- 局部替换时的默认继承策略
- 对比结果中的继承说明

**建议落点**

- `src/shared/blocks/simulator/LaboratoryPanel/LaboratorySlotSelectorModal.tsx`
- `src/shared/blocks/simulator/LaboratoryPanel/laboratory-utils.ts`
- `src/shared/services/lab-valuation.ts`

**验收标准**

- 用户可选择是否继承旧宝石 / 旧符石
- 继承与不继承两种模式下，面板 / 总伤 / 成本结果会同步变化
- UI 会明确标注当前席位采用了哪种继承策略

### P1-05 候选装备库

**目标**

把想买的装备沉淀为真正的总装备库，而不是一次性预览对象。

**范围**

- 待确认区
- 新品库
- 价格字段
- 跨服费字段
- 批量上传
- 按上传时间倒序
- 按类型筛选

**建议落点**

- `src/features/simulator/store/gameStore.ts`
- `src/features/simulator/store/gameStoreActions.ts`
- D1 候选装备表

**验收标准**

- 候选装备可独立于当前装备长期存在
- 可直接从装备库挂入实验室
- 候选装备图片和识别原图可关联到 R2 对象地址
- 待确认与已确认候选装备支持 D1 持久化

**当前补充判断**

- 待确认库识别：已实现
  - 实验室上传区已经支持点击上传、拖拽上传和全局粘贴图片；OCR 成功后会自动写入 `candidate_equipment.pending`，并立即出现在“待确认新品”列表。
- 入库审核流程：已实现
  - 待确认详情弹窗已经支持人工复核、编辑识别结果、确认入库；确认后会把候选状态改为 `confirmed`，并同步生成正式 `inventory_entry`，当前按 `deriveInventoryFolderKey(...)` 自动归档到对应部位分类。
- 当前/方案镜像入库：已实现
  - 当前装备保存、实验室覆盖同步，以及最近一次装备回滚，都会把“当前穿戴 + 其他装备方案”同步镜像到 `inventory_equipment_asset / inventory_entry`，后台台账可直接看到来源标签，不再只有候选确认入库这一条入口会进入正式库存。
- 属性手动修改：已实现
  - 待确认详情弹窗已提供 `Edit2` 编辑入口，可在确认入库前手动修正 OCR 结果，再写回候选装备记录。
- 批量删除：已实现
  - 新品装备库的多选删除现在按候选记录 `id` 操作，已确认候选不会再把 `equipment.id` 当成删除主键，库内批量删除链路已和 store / 持久化语义对齐。
- 倒序 / 排序 / 筛选：已实现
  - 候选装备现在默认按上传时间倒序显示；待确认区和新品装备库都支持按主类 / 部位筛选，并可切换“最新上传 / 最早上传 / 总价最高 / 总价最低”。
- 待确认批量确认：已实现
  - 待确认区现已支持多选后批量确认入库，适合一轮 OCR 后连续清理候选库存。
- 待确认连续审核：已实现
  - 待确认详情弹窗现在会显示当前筛选结果中的序号，支持上一件 / 下一件，以及“确认并看下一件”，减少来回关闭弹窗的重复操作。
- OCR 弹窗直达实验室：已实现
  - 当前状态页“上传装备截图”后的确认弹窗，主按钮会直接切到实验室，并自动打开对应待确认装备，减少在候选列表里二次查找。
- 并排核图：已实现
  - OCR 确认弹窗和待确认详情现在都会直接显示“装备展示图 / OCR 原图”对照区，审核时不再只依赖悬停小图。
- 库上限提醒：已实现
  - “待确认新品”数量从 50 以下跨到 50 及以上时会弹出一次前台预警，同时待确认列表顶部会显示红色提示条，提醒先确认入库或删除一部分再继续上传。

### P1-06 生效规则测试

**目标**

把最容易写错的装备规则和套装规则锁死。

**范围**

- 符石组合唯一性
- 套装触发条件
- 叠加上限
- 星相互合
- 灵饰套装档位

**建议落点**

- 规则服务测试目录

**验收标准**

- 规则边界条件可复现
- 新增装备逻辑时不会回归破坏

### P1-07 多角色管理与切换

**目标**

支持同一账号维护多个梦幻角色，并在前台完成新建、切换与独立存储。

**范围**

- 角色列表读取
- 新建角色
- 重命名角色
- 切换当前角色
- 同名校验
- 当前状态 / 实验室 / 候选装备跟随角色切换

**建议落点**

- `src/shared/models/simulator-main.ts`
- `src/app/api/simulator/current/*`
- `src/features/simulator/shell/AccountSwitcher.tsx`
- `src/features/simulator/store/gameStoreActions.ts`

**验收标准**

- 切换角色时，档案、装备、实验室数据瞬时更新
- 新建同名角色时提示名称已存在
- 不同角色的加点、装备、实验室数据独立存储，互不污染

### P1-08 星石与星相互合系统

**目标**

把文档中的星石结构与星相互合规则从“展示字段”升级为“正式数据模型 + 计算规则”。

**范围**

- 星石主表与属性表
- 阴 / 阳状态
- 星石颜色与等级
- 单件互合颜色命中规则
- 6 件全局互合加成
- 实验室与当前状态共用同一套互合计算口径

**建议落点**

- `src/config/db/schema.sqlite.ts`
- `src/config/db/migrations_d1/*`
- `src/shared/services/damage-engine.ts`
- `src/shared/models/damage-rules.ts`
- `src/shared/blocks/simulator/EquipmentPanel/*`

**验收标准**

- 星石不再只靠 `starPosition / starAlignment` 文本字段承载
- 单件互合加成与 6 件全局加成都能进入伤害链路
- 规则结果可在 UI 和测试里验证

### P1-09 玉魄百分比属性与属性池配置化

**目标**

让玉魄的固定值 / 百分比属性都能按统一规则参与实验室计算，并为后台配置化留出边界。

**范围**

- 玉魄固定值属性
- 玉魄百分比属性
- 属性池定义
- 百分比属性在公式中的挂载点
- 结果解释与审计字段

**建议落点**

- `src/shared/services/damage-engine.ts`
- `src/shared/models/damage-rules.ts`
- `src/config/db/schema.sqlite.ts`
- `docs/d1-database-design.md`

**验收标准**

- `法术忽视 %`、`基础法术伤害 %` 等百分比属性能真实参与公式
- OCR / 入库阶段不会把百分比属性拍平成固定值
- 计算结果能说明玉魄属性对最终伤害的影响

## 6. P2 任务

### P2-01 OCR 上传与图片分类

**目标**

支持通过截图录入信息，但先做稳，不追求一步到位全自动。

**范围**

- 图片上传入口
- R2 对象上传
- 图片类型判断
- Gemini 识别调用
- OCR 结果标准化
- 异常图提示

**建议落点**

- 上传 API route
- 模拟器上传组件
- OCR service 封装
- `src/extensions/storage/r2.ts`
- `src/extensions/ai/gemini.ts`

**验收标准**

- 能区分属性图、装备图、无效图
- 错误图不会污染正式数据
- 原图成功写入 R2
- Gemini 输出被规范映射到内部结构

### P2-02 待确认 / 审计流

**目标**

让 OCR 识别结果先进入可追溯的草稿 / 审计链，再决定是否沉淀为正式资产。

**范围**

- 待确认列表
- 确认
- 编辑
- 驳回
- 待确认 / 审计状态流转

**建议落点**

- 候选装备状态模型
- 对应 D1 表

**验收标准**

- OCR 结果不会直接写正式库存资产
- 每条识别记录都能追溯 `ocr_job -> ocr_draft_item -> candidate_equipment / inventory_entry`
- 前台自动同步到候选装备后，后台仍可做排障与状态核对

### P2-03 性价比模型

**目标**

把“值不值得换”量化成可对比结论。

**范围**

- 每点伤害提升成本
- 总成本
- 跨服费
- 收益排序

**建议落点**

- `src/shared/services/cost-model.ts`
- 实验室结果展示逻辑

**当前缺口补充**

- 已有服务端总伤、总价格、1 点法伤成本
- 当前也已补出“总伤增益百分比”独立指标
- 剩余缺口主要是“收益摘要标签 / 排序解释 / 百分比衍生口径”继续增强

**验收标准**

- 两个方案可直接比较
- 收益口径与成本口径一致

### P2-03A 总伤增益百分比与收益摘要

**状态更新**

- `2026-04-12`：已完成“总伤增益百分比”基础落地；本任务后续主要承接“单秒伤害提升百分比”和“收益摘要标签”。

**目标**

把实验结果从“看绝对值”提升到“能一眼判断收益幅度”。

**范围**

- 总伤增益百分比
- 单秒伤害提升百分比
- 收益摘要标签
- 与成本模型并排展示

**建议落点**

- `src/shared/blocks/simulator/LaboratoryPanel/LaboratorySeatCard.tsx`
- `src/shared/blocks/simulator/LaboratoryPanel/LaboratoryComparisonTable.tsx`
- `src/shared/services/lab-valuation.ts`

**验收标准**

- 对比席位能稳定展示相对样本席位的总伤增益百分比
- 百分比口径与服务端总伤使用同一分母 / 分子来源
- 页面同时保留绝对差值与百分比，不互相替代

### P2-06 Gemini 对话能力接入

**目标**

把 AI 对话能力固定到 Gemini，用于装备问答、结果解释和后续智能分析扩展。

**范围**

- Gemini 聊天接口封装
- 对话上下文结构
- 模拟器结果解释接入
- 错误处理与速率控制

**建议落点**

- `src/extensions/ai/gemini.ts`
- `src/shared/services/ai.ts`
- `src/app/api/ai/query/route.ts`
- `src/app/api/chat/route.ts`

**验收标准**

- 对话链路默认使用 Gemini
- 结果解释可复用模拟器计算结果
- provider 切换点只保留单一 Gemini 实现

**当前状态**

- 已新增 `src/app/api/simulator/advisor/route.ts`
- 已新增 `src/shared/services/simulator-advisor.ts`
- 前端 `AiChat` 已接入当前角色、候选装备、实验室席位上下文
- 仍依赖 `gemini_api_key` 配置完成后才可实际对话

### P2-04 同步决策

**目标**

把实验结果一键同步回当前状态，并保留历史快照。

**范围**

- 确认替换
- 历史快照
- 可回滚

**建议落点**

- `src/features/simulator/store/gameStore.ts`
- `src/features/simulator/store/gameStoreActions.ts`

**验收标准**

- 覆盖操作可追溯
- 用户误替换后可恢复

### P2-05 文档对照表

**目标**

减少“文档有，代码没做”或“代码做了，没人知道在哪”的长期漂移。

**范围**

- 规则项与代码文件映射
- 已实现项
- 未实现项
- 风险点

**建议落点**

- `docs/project-overview.md`
- 或新建规则实现对照文档

**验收标准**

- 新同学能快速定位某条规则的代码落点

### P2-07 非功能性能与稳定性验收

**目标**

把文档里写明的性能、批量上传和高分屏体验要求沉淀为可重复验证的工程任务。

**范围**

- 修改属性后伤害刷新时延
- 批量 OCR 排队与并发保护
- 大库存加载性能
- 高频操作稳定性
- `4K / 200%` 缩放视觉验收

**建议落点**

- `src/shared/blocks/simulator/*`
- `src/shared/services/simulator-ocr.ts`
- `src/shared/services/damage-engine.ts`
- 浏览器验收脚本 / QA 清单

**验收标准**

- 关键页面在高频编辑和批量上传场景下不会卡死
- 伤害刷新、候选装备加载、OCR 排队都有明确的性能基线
- 高分屏下文字、图片和弹层布局可正常使用

## 7. 后台专项任务

后台不需要重做一套系统，但需要补齐“规则管理、模板管理、待确认 / 审计与排障”能力，才能真正支撑前台模拟器长期演进。

建议目录继续保持当前结构：

- 后台页面：`src/app/[locale]/(admin)/admin/simulator`
- 后台接口：`src/app/api/admin/simulator`
- 共用业务逻辑：`src/features/simulator`
- 共用页面组件：`src/shared/blocks/simulator`

### Admin-P0-01 默认角色模板管理

**目标**

让后台能管理“新用户注册后自动补建”的默认龙宫角色模板。

**范围**

- 门派
- 等级
- 五围
- 技能
- 修炼
- 默认装备
- 默认战斗参数

**验收标准**

- 后台可修改默认模板
- 新注册用户补建角色时使用后台最新模板
- 模板改动不会影响已有用户历史数据
- 默认战斗参数也能通过后台模板维护，而不是只在服务端写死

### Admin-P0-02 数值规则版本管理

**目标**

让后台能管理属性转化、技能公式和各类战斗系数，而不是直接改代码。

**范围**

- 属性转化规则
- 伤害公式版本
- 阵法系数
- 五行系数
- 分灵系数
- 固定值项规则

**验收标准**

- 规则支持版本化
- 可启用/停用规则版本
- 前台计算链路能读取当前启用版本

### Admin-P0-03 目标怪模板管理

**目标**

后台维护副本怪和目标参数预设，供当前状态页和实验室复用。

**范围**

- 副本名称
- 怪物名称
- 等级
- 气血
- 防御
- 法防
- 五行
- 阵法

**验收标准**

- 后台可新增、编辑、停用目标模板
- 前台可读取模板并自动回填目标属性

### Admin-P0-04 OCR 配置与健康检查

**目标**

让后台能直接看到 OCR 所依赖的 Cloudflare / Gemini 配置是否齐全。

**范围**

- `gemini_api_key`
- `r2_account_id`
- `r2_access_key`
- `r2_secret_key`
- `r2_bucket_name`
- OCR 可用性提示

**验收标准**

- 页面能明确显示缺失配置项
- 配置完整时能显示 OCR 链路可用

### Admin-P0-05 OCR 审计与作业排障

**目标**

把 OCR 识图链路的作业、原图、草稿和同步状态集中展示出来，方便排障和审计。

**范围**

- 查看 OCR 作业
- 查看原图
- 查看 OCR 原始文本
- 查看结构化草稿
- 查看候选装备同步状态
- 查看失败原因与异常记录

**验收标准**

- 后台可按用户和状态查看 OCR 作业
- 能定位“为什么这次识图没有正确进入候选装备库”
- 能区分 OCR 识别成功、草稿生成成功、候选同步成功这几个阶段

### Admin-P1-01 候选装备库管理

**目标**

允许后台查看和清理用户候选装备库中的脏数据、重复数据和异常数据。

**范围**

- 用户维度筛选
- 状态筛选
- 重复项识别
- 手动修正或删除

**验收标准**

- 后台可按用户查看候选装备
- 可处理错误入库的数据

### Admin-P1-02 AI 顾问配置页

**目标**

管理 Gemini 顾问的模型、提示词和基础开关。

**范围**

- 模型名
- 系统提示词
- 开关项
- 基础限流位

**验收标准**

- 顾问相关配置可后台维护
- 前台顾问链路读取统一配置

### Admin-P1-03 实验室记录查看

**目标**

让后台能查看用户保存过的实验室会话，便于排查数值和用户反馈问题。

**范围**

- 当前实验室会话
- 席位列表
- 对比装备内容
- 最近更新时间

**验收标准**

- 后台可查看用户实验室配置
- 可定位某次实验的输入数据

### Admin-P1-04 规则模拟案例管理

**目标**

后台维护规则校验样例，作为改公式时的回归基线。

**范围**

- 输入样例
- 期望输出
- 对应规则版本

**验收标准**

- 后台可维护模拟案例
- 后续规则调整可对照案例验证

### Admin-P1-05 装备扩展规则配置

`2026-04-12`：已完成后台化补齐。新增独立的“装备扩展规则”后台页，支持在规则版本维度维护 `ornament_set_rules`、`regular_set_rules`、`jade_attribute_pool`、`jade_percent_semantics`，并联动现有“星相互合规则”工作台。
`2026-04-13`：已修复后台“装备扩展规则 / 规则中心”里的星相互合摘要来源，当前改为读取正式 `star_resonance_rule` 表；线上版本 `d6be7282-c559-4eab-b24b-be98e1d0bba9` 复测确认“星相互合工作台”摘要已正确显示 `6 条`，不再错误显示 `0 条`。

**目标**

把当前仍散落在文档或代码常量里的扩展装备规则纳入后台配置，补齐第一期规则中心缺口。

**范围**

- 星相互合规则
- 灵饰套装档位规则
- 常规套装档位规则
- 玉魄属性池
- 玉魄百分比属性语义

**验收标准**

- 后台可维护星相互合和灵饰套装档位
- 玉魄属性池不再只靠代码硬编码
- 前台 / 实验室读取统一生效版本

### Admin-P2-01 用户数据排障工具

**目标**

后台按用户查看 simulator 全量关键数据，提升线上问题排查效率。

**范围**

- 当前角色
- 当前快照
- 战斗参数
- 实验室席位
- 候选装备

**验收标准**

- 后台可快速查看用户 simulator 数据概况
- 能辅助排查“为什么用户页面出错”

### Admin-P2-02 OCR 质量统计

`2026-04-12`：已完成后台页与聚合 API。当前后台可直接查看 OCR 成功率、失败原因分布、常见缺失字段、草稿审核分布、候选同步分布与最近 14 天趋势。

**目标**

统计 OCR 成功率和常见失败模式，为后续提示词和识别规则优化提供依据。

**范围**

- 成功次数
- 失败次数
- 失败原因
- 常见错误字段

**验收标准**

- 能看出 OCR 的主要失败模式
- 能支持后续识别优化

### Admin-P2-03 顾问问答审计

`2026-04-12`：已完成问答落库和后台审计页。前台顾问成功 / 失败都会尽量写入 `simulator_advisor_audit`，后台可按状态、关键词查看问题、回答、失败原因与上下文摘要。

**目标**

为 Gemini 顾问提供最基础的答复审计能力，便于优化提示词和排查误导回答。

**范围**

- 用户问题
- 顾问回答
- 时间
- 基础上下文摘要

**验收标准**

- 可查看典型问答记录
- 可辅助 prompt 调整

## 8. 当前统一任务

从 `2026-04-16` 开始，后续继续推进不再按旧的“多项并行开工包”组织，而统一收口为 **1 条主任务**：

### Unified-Next-01 正式数据接入与实验室主链收口

**目标**

在不推翻现有“`OCR 基线真值 + 增量计算`”架构的前提下，把当前还未彻底收完的内容合并成一条连续任务，集中完成“素材、规则、展示、校准”四件事，让系统从“主链可用”推进到“正式可长期迭代”。

**范围**

- 真实梦幻装备素材正式入仓
  - 当前已先接入本地 `素材/icons` 首批真实装备图，前台默认展示已优先命中本地静态素材
  - 后续等用户继续提供 CC 素材包或更多别名映射后，再做第二轮批量导入和补齐
  - 继续沿用 import + alias-file 链路维护 artwork 静态映射表
  - 保持当前默认装备图、悬停 OCR 原图对照链路不回退
- 符石 / 星石 / 星相互合正式数据接入
  - 当前先写占位，不再继续用临时规则猜测补全
  - 等用户提供正式符石 / 星石 / 星相互合数据后，再统一接入正式规则中心
  - 不再继续做猜测型补丁
  - 收口“符石系统穷举 / 星石系统穷举 / 最优符石组合默认解”
- 伤害与面板联动校准
  - 基于正式规则校准面板联动与伤害试算
  - 优先保证“换装备、改加点、改修炼、改符石、改星石、改神器”后的增量结果稳定可信
- 前台展示收尾
  - 继续优化 OCR 结果解释
  - 继续微调方案区 hover 态
  - 继续优化右侧最终面板字段编排
  - 正式库存治理收尾已完成，后续只做体验级微调，不再扩新生命周期

**已完成补充**

- `2026-04-16` 已完成 `Unified-Next-01 / 正式库存治理收尾`
  - 正式库存生命周期继续固定为 `active / sold / discarded`
  - 当前装备总库与实验室总库已统一生命周期徽标、主动作、批量动作、空态文案与结果摘要条
  - 普通换装弹窗与实验室槽位选择器继续只消费 `active` 正式库存，并统一补出边界说明
  - 选择器中正式库存卡片已统一显示 `库存待用` 徽标，并与 `正式库存` 来源标签拆开展示
  - 登录态下已补当前装备总库、实验室总库的正式库存重读链路，刷新或重开后不再依赖本地残留

**当前边界**

- 不再回头做“人物裸体属性全公式穷举”
- 不再把实验室重新扩成多对比席位横向模型
- 普通换装弹窗与实验室槽位选择器继续只消费 `active` 正式库存
- 当前已接入首批本地真实装备素材；后续只继续补充用户提供的新素材与别名，不主动虚构额外图片
- 不主动穷举符石 / 星石 / 星相互合；正式规则数据未提供前，只保留现有可用链路与文档占位

**完成后应达到**

- 真实装备展示链路正式可用
- 符石 / 星石 / 星相互合不再依赖临时口径拼接
- 最终面板、实验室对比、伤害试算三处结果口径进一步统一
- 当前状态、装备总库、实验室、顾问上下文都建立在同一套正式规则之上

## 9. 当前建议执行方式

后续文档与开发跟进统一按 `Unified-Next-01 正式数据接入与实验室主链收口` 记录，不再额外拆成新的平行主任务。

如果需要继续拆解，也只在这条主任务下面补子项，而不再新开新的并行阶段包。

## 10. 后续可继续拆分的内容

这份文档已经适合继续拆成 GitHub Issues。后续建议再补两层：

1. 每个任务的依赖关系
2. 每个任务的预计改动文件与验收命令

## 11. 后台 Issue 模板

下面这组内容可以直接作为后台开发 issue 的初稿使用。

### Issue: Admin-P0-01 默认角色模板管理

**背景**

新用户注册后会自动补建默认 simulator 角色。当前模板依赖代码和配置，后台缺少直接维护入口。

**范围**

- 新增后台页面，展示默认角色模板
- 支持编辑门派、等级、五围、技能、修炼、默认装备、默认战斗参数
- 保存到现有默认配置来源

**建议落点**

- `src/app/[locale]/(admin)/admin/simulator/defaults/*`
- `src/app/api/admin/simulator/defaults/*`
- `src/shared/blocks/simulator/defaults-editor/*`

**验收标准**

- 后台可查看并保存默认模板
- 新注册用户使用最新模板补建角色
- 已有用户不受模板变更影响

### Issue: Admin-P0-02 数值规则版本管理

**背景**

当前数值规则已经开始结构化，但后台还缺少规则版本管理入口。

**范围**

- 查看规则版本列表
- 创建、复制、编辑、发布规则版本
- 支持启用单个版本作为当前生效版本

**建议落点**

- `src/app/[locale]/(admin)/admin/simulator/rules/*`
- `src/app/api/admin/simulator/rule-versions/*`
- `src/shared/blocks/simulator/rule-center/*`

**验收标准**

- 后台能管理规则版本生命周期
- 前台读取当前启用版本
- 发布后规则不需要改代码即可切换

### Issue: Admin-P0-03 目标怪模板管理

**背景**

前台需要稳定的副本怪与目标参数预设，当前缺少完整后台维护能力。

**范围**

- 新增目标模板列表页
- 支持新增、编辑、停用目标模板
- 支持维护气血、防御、法防、五行、阵法等字段

**建议落点**

- `src/app/[locale]/(admin)/admin/simulator/targets/*`
- `src/app/api/admin/simulator/targets/*`
- `src/shared/models/simulator.ts`

**验收标准**

- 后台能维护目标模板
- 前台能读取并自动回填目标参数

### Issue: Admin-P0-04 OCR 配置与健康检查

**背景**

OCR 依赖 `Gemini + R2`，一旦缺配置，前台只能报错，后台需要明确健康状态页。

**范围**

- 展示 `gemini_api_key`
- 展示 `r2_account_id`
- 展示 `r2_access_key`
- 展示 `r2_secret_key`
- 展示 `r2_bucket_name`
- 展示总体 OCR 可用状态

**建议落点**

- `src/app/[locale]/(admin)/admin/simulator/ocr-config/*`
- `src/app/api/admin/simulator/ocr-config/*`
- 复用 `src/shared/services/simulator-ocr.ts`

**验收标准**

- 缺失项能逐条提示
- 配齐后能显示 OCR 可用

### Issue: Admin-P0-05 OCR 审计与作业排障

**背景**

前台 OCR 现在已经自动进入候选装备库，不再依赖后台逐条人工处理；后台更需要的是作业可见性和问题排查能力。

**范围**

- 查看 OCR 作业列表
- 查看 OCR 原图与原始文本
- 查看结构化草稿与置信度
- 排查失败任务与异常识别结果

**建议落点**

- `src/app/[locale]/(admin)/admin/simulator/ocr-jobs/*`
- `src/app/api/admin/simulator/ocr-jobs/*`
- `src/shared/blocks/simulator/ocr-job-admin-panel/*`

**验收标准**

- 后台能按用户和状态查看 OCR 作业
- 能看到结构化草稿、候选装备状态和失败原因

### Issue: Admin-P1-01 候选装备库管理

**背景**

候选装备已经落到 D1，但后台还不能按用户查看和清理异常数据。

**范围**

- 按用户筛选候选装备
- 按状态筛选
- 支持删除或修正错误数据

**建议落点**

- `src/app/[locale]/(admin)/admin/simulator/candidate-equipment/*`
- `src/app/api/admin/simulator/candidate-equipment/*`

**验收标准**

- 后台可查看用户候选装备
- 可处理重复或错误记录
- 后台 `inventory` 台账可修正价格、分类键和正式库存状态

### Issue: Admin-P1-02 AI 顾问配置页

**背景**

Gemini 顾问已接入前台，但提示词和基础配置还没有后台维护入口。

**范围**

- 模型配置
- 系统提示词配置
- 顾问开关
- 基础限流位

**建议落点**

- `src/app/[locale]/(admin)/admin/simulator/advisor/*`
- `src/app/api/admin/simulator/advisor/*`
- `src/shared/services/simulator-advisor.ts`

**验收标准**

- 后台可维护顾问配置
- 前台顾问能读取统一配置

### Issue: Admin-P1-03 实验室记录查看

**背景**

实验室已经持久化，但后台还不能查看用户保存过的实验配置。

**范围**

- 查看实验室会话列表
- 查看席位详情
- 查看每个席位的装备内容

**建议落点**

- `src/app/[locale]/(admin)/admin/simulator/lab-sessions/*`
- `src/app/api/admin/simulator/lab-sessions/*`

**验收标准**

- 后台可查看某个用户的实验室会话
- 可定位某次实验的输入内容

### Issue: Admin-P1-04 规则模拟案例管理

**背景**

规则测试已经开始落地，但后台还没有维护模拟案例的入口。

**范围**

- 案例列表
- 输入参数
- 期望结果
- 关联规则版本

**建议落点**

- `src/app/[locale]/(admin)/admin/simulator/rule-cases/*`
- `src/app/api/admin/simulator/rule-simulation-cases/*`

**验收标准**

- 后台可维护模拟案例
- 规则变更时可据此做回归验证

### Issue: Admin-P2-01 用户数据排障工具

**背景**

线上排查 simulator 问题时，需要快速查看用户当前关键数据，而不是手工查多张表。

**范围**

- 查看当前角色
- 查看当前快照
- 查看战斗参数
- 查看实验室席位
- 查看候选装备

**建议落点**

- `src/app/[locale]/(admin)/admin/simulator/user-diagnostics/*`
- `src/app/api/admin/simulator/user-diagnostics/*`

**验收标准**

- 后台可快速汇总用户 simulator 数据
- 能辅助排查线上异常

### Issue: Admin-P2-02 OCR 质量统计

**背景**

OCR 链路后续一定要持续优化，需要先有质量统计视角。

**范围**

- 成功率
- 失败率
- 失败原因分布
- 常见错误字段

**建议落点**

- `src/app/[locale]/(admin)/admin/simulator/ocr-metrics/*`
- `src/app/api/admin/simulator/ocr-metrics/*`

**验收标准**

- 后台可查看 OCR 质量趋势
- 能识别主要失败模式

**当前进展**

- 已新增 `src/app/[locale]/(admin)/admin/simulator/ocr-metrics/*`
- 已新增 `src/app/api/admin/simulator/ocr-metrics/*`
- 已基于 `ocr_job + ocr_draft_item + candidate_equipment` 聚合成功率、失败原因、缺失字段和同步分布

### Issue: Admin-P2-03 顾问问答审计

**背景**

Gemini 顾问已经接入，后续需要观察答复质量和误导风险。

**范围**

- 用户问题
- 顾问回答
- 时间
- 上下文摘要

**建议落点**

- `src/app/[locale]/(admin)/admin/simulator/advisor-audit/*`
- `src/app/api/admin/simulator/advisor-audit/*`

**验收标准**

- 后台可查看典型问答记录
- 可支持后续 prompt 调整与问题排查

**当前进展**

- 已新增 `src/config/db/migrations_d1/0014_simulator_advisor_audit.sql`
- 已新增 `src/app/[locale]/(admin)/admin/simulator/advisor-audit/*`
- 已新增 `src/app/api/admin/simulator/advisor-audit/*`
- 前台 `/api/simulator/advisor` 已补充成功 / 失败审计落库
