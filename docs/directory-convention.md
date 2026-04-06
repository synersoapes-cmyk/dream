# 目录规范

## 1. 文档目录

项目规范、设计说明、数据库说明、执行清单统一放在 `docs/`。

当前与梦幻实验室相关的文档放置如下：

- `docs/project-overview.md`
- `docs/d1-database-design.md`
- `docs/cloudflare-d1-deploy.md`
- `docs/implementation-task-list.md`
- `docs/directory-convention.md`

## 2. 梦幻实验室目录职责

梦幻实验室统一使用 `simulator` 作为业务主目录名。

### 2.1 游戏规则、store、默认数据

放在：

- `src/features/simulator/`

这里承载：

- 游戏规则
- 状态管理
- 默认数据
- 运行时种子
- 业务工具函数
- 模拟器专属 shell 和 overlay

### 2.2 游戏页面组件

放在：

- `src/shared/blocks/simulator/`

这里承载：

- `SimulatorApp`
- `CharacterPanel`
- `EquipmentPanel`
- `CombatPanel`
- `LaboratoryPanel`
- 后台规则管理相关的 simulator blocks

说明：

原先混在 `src/shared/blocks/generator/` 下的模拟器页面组件，已经迁入 `src/shared/blocks/simulator/`。
`generator/` 目录现在只保留真正属于 AI 生成器的页面块，例如图片、音乐、视频生成器。

### 2.3 游戏接口

放在：

- `src/app/api/simulator/`

这里承载：

- 当前角色读取
- 当前角色资料保存
- 装备保存
- 修炼保存
- 伤害计算

### 2.4 游戏页面路由

放在：

- `src/app/[locale]/(lab)/simulator/`

这是梦幻实验室的页面入口。

### 2.5 后台管理目录

放在：

- `src/app/[locale]/(admin)/admin/simulator/`
- `src/shared/blocks/simulator/`

这里承载两类内容：

1. 后台页面路由

- `src/app/[locale]/(admin)/admin/simulator/`

用于承接后台管理页入口，例如：

- 默认角色模板管理
- 规则管理
- 规则调试面板

2. 后台页面组件

- `src/shared/blocks/simulator/`

当前后台 simulator 相关组件也放在这里，例如：

- `defaults-editor`
- `rule-center`
- `rule-playground`

这样做的原因是后台 simulator 页面和前台 simulator 页面共享同一套业务语义，虽然入口路由不同，但组件仍然属于 simulator 域，不应放到通用 generator 或其他业务目录。

### 2.6 后台接口目录

放在：

- `src/app/api/admin/`

如果接口是 simulator 后台专用，统一放在：

- `src/app/api/admin/simulator/`

例如当前已有：

- `src/app/api/admin/simulator/defaults/route.ts`
- `src/app/api/admin/simulator/rule-versions/route.ts`
- `src/app/api/admin/simulator/rule-simulation-cases/route.ts`

放置规则如下：

1. 用户在实验室前台直接使用的接口，放 `src/app/api/simulator/`
2. 只有后台管理页使用的接口，放 `src/app/api/admin/`
3. 后台 simulator 专属接口，统一收口到 `src/app/api/admin/simulator/`

## 3. 基础设施约束

梦幻实验室当前固定采用以下技术边界：

- 数据库：`Cloudflare D1`
- 图片存储：`Cloudflare R2`
- 部署：`Cloudflare Workers`
- 图片识别：`Gemini`
- AI 对话：`Gemini`

相关基础设施代码建议放置如下：

- 数据库：`src/core/db/`、`src/config/db/`
- 存储：`src/extensions/storage/`
- AI：`src/extensions/ai/`

## 4. 新增文件时的放置规则

1. 如果是梦幻实验室专属业务逻辑，放 `src/features/simulator/`
2. 如果是梦幻实验室专属页面组件，放 `src/shared/blocks/simulator/`
3. 如果是梦幻实验室接口，放 `src/app/api/simulator/`
4. 如果是 simulator 后台页面入口，放 `src/app/[locale]/(admin)/admin/simulator/`
5. 如果是 simulator 后台专属接口，放 `src/app/api/admin/simulator/`
6. 如果是项目说明、规则说明、执行清单，放 `docs/`
7. 不要再把 simulator 专属页面组件放回 `src/shared/blocks/generator/`

## 5. 当前结论

梦幻实验室的目录主线现在是：

- 文档在 `docs/`
- 页面在 `src/app/[locale]/(lab)/simulator/`
- 后台页面在 `src/app/[locale]/(admin)/admin/simulator/`
- 接口在 `src/app/api/simulator/`
- 后台接口在 `src/app/api/admin/`
- 业务在 `src/features/simulator/`
- 页面组件在 `src/shared/blocks/simulator/`
