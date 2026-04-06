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

用户可以维护一份真实可计算的角色档案。

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

**验收标准**

- 能录入门派、等级、五围、技能、修炼
- 能维护 6 件常规装备、4 件灵饰、2 件玉魄
- 能切换阵法、五行、目标后即时重算

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

### P1-04 实验室样本席位与对比席位

**目标**

把实验室真正做成换装推演系统，而不是简单的替换预览。

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

**验收标准**

- 可在不改当前状态的前提下做局部实验
- 可展示实验前后面板与伤害变化

### P1-05 候选装备库

**目标**

把想买的装备沉淀为可管理资产，而不是一次性预览对象。

**范围**

- 待确认区
- 新品库
- 价格字段
- 跨服费字段
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

### P2-02 待确认流

**目标**

让 OCR 识别结果先进入人工审核，再进入正式数据。

**范围**

- 待确认列表
- 确认
- 编辑
- 驳回
- 审核状态流转

**建议落点**

- 候选装备状态模型
- 对应 D1 表

**验收标准**

- OCR 结果不会直接写正式库
- 每条识别记录都可追溯状态

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

**验收标准**

- 两个方案可直接比较
- 收益口径与成本口径一致

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

## 7. 后台专项任务

后台不需要重做一套系统，但需要补齐“规则管理、模板管理、审核与排障”能力，才能真正支撑前台模拟器长期演进。

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

### Admin-P0-05 OCR 待确认审核台

**目标**

把识图后的待确认装备集中放到后台审核，而不只依赖前台单用户操作。

**范围**

- 查看待确认装备
- 查看原图
- 查看 OCR 原始文本
- 编辑识别字段
- 确认入库
- 驳回删除

**验收标准**

- 待确认记录可集中审核
- 审核结果会同步影响候选装备库状态

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

## 8. 推荐实施顺序

### 第一阶段

- P0-01 统一龙宫法伤规则源
- P0-02 建立角色与战斗上下文数据模型
- P0-03 D1 表结构与迁移

### 第二阶段

- P0-04 当前状态页最小可用闭环
- P0-05 伤害计算结果可解释化
- P0-06 核心公式测试

### 第三阶段

- P1-01 当前装备详情弹窗补全
- P1-02 多套装备快照
- P1-03 目标预设系统

### 第四阶段

- P1-04 实验室样本席位与对比席位
- P1-05 候选装备库
- P1-06 生效规则测试

### 第五阶段

- P2-01 OCR 上传与图片分类
- P2-02 待确认流
- P2-03 性价比模型
- P2-04 同步决策
- P2-05 文档对照表
- P2-06 Gemini 对话能力接入

## 9. 第一批建议开工包

如果要最小风险启动，建议先开这 6 个任务：

1. `P0-01` 统一龙宫法伤规则源
2. `P0-02` 建立角色与战斗上下文数据模型
3. `P0-03` D1 表结构与迁移
4. `P0-03A` Cloudflare 基础设施边界收口
5. `P0-04` 当前状态页最小可用闭环
6. `P0-05` 伤害计算结果可解释化
7. `P0-06` 核心公式测试

这 7 个完成后，系统才真正具备：

- 能存
- 能传图
- 能算
- 能解释
- 能测试
- 能继续扩展实验室、OCR 和 AI 对话

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

### Issue: Admin-P0-05 OCR 待确认审核台

**背景**

识图结果已经能进入待确认区，但目前主要依赖前台单用户人工处理，不利于集中审核。

**范围**

- 查看待确认装备列表
- 查看原图
- 查看 OCR 原始文本
- 编辑字段
- 确认入库
- 驳回删除

**建议落点**

- `src/app/[locale]/(admin)/admin/simulator/pending-equipment/*`
- `src/app/api/admin/simulator/pending-equipment/*`
- 复用 `PendingEquipmentDetailModal` 里的编辑逻辑

**验收标准**

- 后台能集中审核待确认装备
- 审核结果会同步回候选装备库状态

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
