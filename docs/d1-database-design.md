# 梦幻实验室 D1 数据库设计

## 1. 文档目标

本文档基于 `梦幻核心说明0326` 提炼一版可直接落地到 Cloudflare D1 的数据库设计。

目标覆盖：

- 角色档案与当前状态
- 装备、灵饰、玉魄、星石、符石组合
- OCR 识别与入库审核
- 实验室换装推演
- 战斗参数与目标模板
- 伤害预估与性价比分析

本文档面向：

- Cloudflare D1
- SQLite 方言
- Drizzle ORM

## 2. 设计原则

### 2.1 面向 D1 的约束

- D1 基于 SQLite，字段类型尽量使用 `TEXT`、`INTEGER`、`REAL`、`BLOB`
- 不依赖 PostgreSQL 专属能力，例如 `jsonb`、数组类型、行级锁
- 所有复杂嵌套结构优先拆表，必要时才使用 `TEXT` 存 JSON
- 避免过多深事务，实验室计算结果尽量以幂等写入为主

### 2.2 业务原则

- 当前状态和实验状态必须分离
- OCR 识别结果不能直接进入正式装备库，必须经过审核
- 规则定义和角色实例分离
- 角色快照必须保留版本，不能只保留最后一份
- 计算结果可以缓存，但不能替代原始输入数据

### 2.3 命名与通用字段

推荐统一规则：

- 主键：`id TEXT`
- 外键：`xxx_id TEXT`
- 状态字段：`status TEXT`
- 时间字段：`created_at INTEGER`、`updated_at INTEGER`
- 软删除：`deleted_at INTEGER NULL`
- 来源字段：`source TEXT`

推荐 ID 方案：

- 应用层生成 `cuid2`、`uuid` 或 `nanoid`
- D1 中不使用自增 ID 作为跨表主标识

推荐时间方案：

- 统一使用 Unix epoch 毫秒时间戳，字段类型 `INTEGER`

## 3. 业务总览

核心数据流：

1. 用户创建或切换角色
2. 上传角色面板或装备截图
3. OCR 解析出角色/装备/灵饰/玉魄草稿
4. 草稿进入待确认区
5. 用户确认后写入正式库
6. 当前状态页从正式库装配角色全量状态
7. 实验室从当前状态生成基线快照
8. 用户挂载候选装备，执行伤害推演
9. 推演结果输出属性差值、伤害差值、性价比
10. 用户确认替换后，实验结果覆盖当前状态

## 4. 核心实体关系

### 4.1 主体关系

- 一个 `app_user` 可以拥有多个 `game_character`
- 一个 `game_character` 可以拥有多个 `character_snapshot`
- 一个 `character_snapshot` 对应一份完整角色状态
- 一份角色状态包含：
  - 6 件常规装备
  - 4 件灵饰
  - 2 件玉魄
  - 技能
  - 修炼
  - 战斗参数，当前落在 `snapshot_battle_context`
  - 候选装备库，当前落在 `candidate_equipment`
- `ocr_job` 产生多个 `ocr_draft_item`
- `ocr_draft_item` 审核通过后可落入：
  - `equipment_item`
  - `ornament_item`
  - `jade_item`
- `candidate_equipment` 保存实验室左侧候选装备库，覆盖 `pending / confirmed / replaced`
- `lab_session` 基于某个 `character_snapshot` 创建
- `lab_session_equipment` 记录实验室样本/对比席位挂载的装备

### 4.2 推荐分层

建议拆成五层：

- 账户层：用户、角色
- 资产层：装备、灵饰、玉魄、星石、符石
- 状态层：角色当前状态、角色快照、实验快照
- 规则层：符石组合规则、星相互合规则、套装规则、目标模板
- 计算层：实验输入、实验输出、伤害结果缓存

## 5. 表设计

### 规则中心（新增，2026-04）

为支持“伤害规则写到后台配置并持久化到 D1”，新增一组 `rule_*` 表，和现有角色/装备快照表解耦。第一期仅覆盖：

- 龙宫
- 法师
- 龙卷雨击
- 属性转化
- 分灵系数
- 阵法/阵法克制
- 五行克制
- 神木符
- 法伤结果
- 九龙诀 / 呼风唤雨 / 龙腾 技能等级加成

命名约定：

- 规则配置：`rule_*`
- 战斗模板：后续使用 `battle_*`
- 计算结果：后续使用 `calc_*`

#### `rule_version`

用途：一套伤害规则的版本主表，支持草稿、发布、生效、回滚。

| 字段             | 类型      | 说明                               |
| ---------------- | --------- | ---------------------------------- |
| `id`             | `TEXT PK` | 规则版本 ID                        |
| `rule_domain`    | `TEXT`    | 规则域，第一期固定 `damage`        |
| `version_code`   | `TEXT`    | 唯一编码，如 `damage_v1`           |
| `version_name`   | `TEXT`    | 展示名称                           |
| `status`         | `TEXT`    | `draft` / `published` / `archived` |
| `is_active`      | `INTEGER` | 是否当前生效                       |
| `source_doc_url` | `TEXT`    | 规则来源文档                       |
| `notes`          | `TEXT`    | 备注                               |
| `created_by`     | `TEXT`    | 创建人                             |
| `published_by`   | `TEXT`    | 发布人                             |
| `published_at`   | `INTEGER` | 发布时间                           |
| `created_at`     | `INTEGER` | 创建时间                           |
| `updated_at`     | `INTEGER` | 更新时间                           |

索引：

- `UNIQUE(version_code)`
- `INDEX(rule_domain, is_active, status)`

#### `rule_attribute_conversion`

用途：属性转化规则，如体质、魔力、灵力到最终面板属性的线性映射。

| 字段             | 类型      | 说明                                   |
| ---------------- | --------- | -------------------------------------- |
| `id`             | `TEXT PK` | 主键                                   |
| `version_id`     | `TEXT`    | 关联 `rule_version`                    |
| `school`         | `TEXT`    | 门派                                   |
| `role_type`      | `TEXT`    | 角色流派                               |
| `source_attr`    | `TEXT`    | 来源属性，如 `physique`                |
| `target_attr`    | `TEXT`    | 目标属性，如 `hp`                      |
| `coefficient`    | `REAL`    | 系数                                   |
| `value_type`     | `TEXT`    | 计算方式，如 `linear` / `floor_linear` |
| `condition_json` | `TEXT`    | 附加条件                               |
| `sort`           | `INTEGER` | 排序                                   |
| `enabled`        | `INTEGER` | 是否启用                               |
| `created_at`     | `INTEGER` | 创建时间                               |
| `updated_at`     | `INTEGER` | 更新时间                               |

索引/约束：

- `UNIQUE(version_id, school, role_type, source_attr, target_attr)`
- `INDEX(version_id, school, role_type, enabled, sort)`

#### `rule_skill_formula`

用途：技能主公式定义。当前版本已覆盖龙卷雨击、龙腾。

| 字段                 | 类型      | 说明                |
| -------------------- | --------- | ------------------- |
| `id`                 | `TEXT PK` | 主键                |
| `version_id`         | `TEXT`    | 关联 `rule_version` |
| `school`             | `TEXT`    | 门派                |
| `role_type`          | `TEXT`    | 角色流派            |
| `skill_code`         | `TEXT`    | 技能编码            |
| `skill_name`         | `TEXT`    | 技能名称            |
| `formula_key`        | `TEXT`    | 公式模板键          |
| `base_formula_json`  | `TEXT`    | 基础项参数          |
| `extra_formula_json` | `TEXT`    | 公式扩展参数        |
| `condition_json`     | `TEXT`    | 适用条件            |
| `sort`               | `INTEGER` | 排序                |
| `enabled`            | `INTEGER` | 是否启用            |
| `created_at`         | `INTEGER` | 创建时间            |
| `updated_at`         | `INTEGER` | 更新时间            |

索引/约束：

- `UNIQUE(version_id, skill_code)`
- `INDEX(version_id, school, role_type, enabled)`

#### `rule_damage_modifier`

用途：伤害修正项，如分灵系数、阵法系数、五行系数、神木符、法伤结果。

| 字段              | 类型      | 说明                               |
| ----------------- | --------- | ---------------------------------- |
| `id`              | `TEXT PK` | 主键                               |
| `version_id`      | `TEXT`    | 关联 `rule_version`                |
| `modifier_domain` | `TEXT`    | 修正域，如 `split_factor`          |
| `modifier_key`    | `TEXT`    | 修正键                             |
| `modifier_type`   | `TEXT`    | `multiplier` / `addend` / `lookup` |
| `source_key`      | `TEXT`    | 来源键                             |
| `target_key`      | `TEXT`    | 目标键                             |
| `value`           | `REAL`    | 直接数值                           |
| `value_json`      | `TEXT`    | lookup 表或结构化配置              |
| `condition_json`  | `TEXT`    | 条件                               |
| `sort`            | `INTEGER` | 排序                               |
| `enabled`         | `INTEGER` | 是否启用                           |
| `created_at`      | `INTEGER` | 创建时间                           |
| `updated_at`      | `INTEGER` | 更新时间                           |

索引：

- `INDEX(version_id, modifier_domain, modifier_key, enabled, sort)`

#### `rule_skill_bonus`

用途：技能等级加成规则，如九龙诀、呼风唤雨、龙腾。

| 字段                | 类型      | 说明                             |
| ------------------- | --------- | -------------------------------- |
| `id`                | `TEXT PK` | 主键                             |
| `version_id`        | `TEXT`    | 关联 `rule_version`              |
| `bonus_group`       | `TEXT`    | 规则分组，如 `school_skill_rune` |
| `rule_code`         | `TEXT`    | 规则编码                         |
| `skill_code`        | `TEXT`    | 技能编码                         |
| `skill_name`        | `TEXT`    | 技能名称                         |
| `bonus_type`        | `TEXT`    | 第一期固定 `skill_level`         |
| `bonus_value`       | `INTEGER` | 加成值                           |
| `condition_json`    | `TEXT`    | 颜色序列、孔数、部位范围等       |
| `conflict_policy`   | `TEXT`    | 冲突策略，如 `take_max`          |
| `limit_policy_json` | `TEXT`    | 全局生效限制                     |
| `sort`              | `INTEGER` | 排序                             |
| `enabled`           | `INTEGER` | 是否启用                         |
| `created_at`        | `INTEGER` | 创建时间                         |
| `updated_at`        | `INTEGER` | 更新时间                         |

索引：

- `INDEX(version_id, skill_code, rule_code, enabled, sort)`

#### `rule_publish_log`

用途：规则发布、回滚、启停审计。

| 字段                   | 类型      | 说明                                               |
| ---------------------- | --------- | -------------------------------------------------- |
| `id`                   | `TEXT PK` | 主键                                               |
| `version_id`           | `TEXT`    | 关联 `rule_version`                                |
| `action`               | `TEXT`    | `publish` / `rollback` / `activate` / `deactivate` |
| `operator_id`          | `TEXT`    | 操作人                                             |
| `before_snapshot_json` | `TEXT`    | 操作前快照                                         |
| `after_snapshot_json`  | `TEXT`    | 操作后快照                                         |
| `notes`                | `TEXT`    | 备注                                               |
| `created_at`           | `INTEGER` | 操作时间                                           |

索引：

- `INDEX(version_id, created_at)`

规则执行建议：

1. 先读取当前生效的 `rule_version`
2. 按版本加载 `rule_attribute_conversion`
3. 按版本加载 `rule_skill_formula`
4. 按版本加载 `rule_damage_modifier`
5. 按版本加载 `rule_skill_bonus`
6. 服务端统一执行伤害计算，前端不再持有正式公式

## 5.1 用户与角色

### `app_user`

用途：系统用户主表

| 字段           | 类型      | 说明                  |
| -------------- | --------- | --------------------- |
| `id`           | `TEXT PK` | 用户 ID               |
| `email`        | `TEXT`    | 邮箱，可空            |
| `display_name` | `TEXT`    | 显示名                |
| `status`       | `TEXT`    | `active` / `disabled` |
| `created_at`   | `INTEGER` | 创建时间              |
| `updated_at`   | `INTEGER` | 更新时间              |

索引：

- `UNIQUE(email)`

### `game_character`

用途：梦幻角色主表

| 字段                  | 类型      | 说明                  |
| --------------------- | --------- | --------------------- |
| `id`                  | `TEXT PK` | 角色 ID               |
| `user_id`             | `TEXT`    | 归属用户              |
| `name`                | `TEXT`    | 角色名                |
| `server_name`         | `TEXT`    | 所在服务器            |
| `school`              | `TEXT`    | 门派，如龙宫          |
| `level`               | `INTEGER` | 当前等级              |
| `race`                | `TEXT`    | 种族，可选            |
| `status`              | `TEXT`    | `active` / `archived` |
| `current_snapshot_id` | `TEXT`    | 当前状态快照          |
| `created_at`          | `INTEGER` | 创建时间              |
| `updated_at`          | `INTEGER` | 更新时间              |

约束建议：

- `UNIQUE(user_id, name)`

说明：

- 文档测试用例明确要求角色名有唯一性校验
- 如果未来支持跨服重名，可改成 `UNIQUE(user_id, server_name, name)`

## 5.2 角色状态与快照

### `character_snapshot`

用途：角色完整状态快照

| 字段            | 类型      | 说明                                                             |
| --------------- | --------- | ---------------------------------------------------------------- |
| `id`            | `TEXT PK` | 快照 ID                                                          |
| `character_id`  | `TEXT`    | 角色 ID                                                          |
| `snapshot_type` | `TEXT`    | `current` / `history` / `manual` / `lab_baseline` / `lab_result` |
| `name`          | `TEXT`    | 快照名，如任务套、PK套                                           |
| `version_no`    | `INTEGER` | 角色内部版本号                                                   |
| `source`        | `TEXT`    | `manual` / `ocr` / `lab_apply` / `equipment_backup`              |
| `notes`         | `TEXT`    | 备注                                                             |
| `created_at`    | `INTEGER` | 创建时间                                                         |
| `updated_at`    | `INTEGER` | 更新时间                                                         |

索引：

- `INDEX(character_id, created_at DESC)`
- `INDEX(character_id, snapshot_type)`

补充说明：

- 当前线上实现里，实验室将装备应用到当前角色前，会先插入一条 `snapshot_type = history`、`source = equipment_backup` 的历史快照。
- 这条历史快照会完整复制当时的 `character_profile / character_skill / character_cultivation / snapshot_battle_context / snapshot_equipment_slot`，用于“回滚最近一次应用”。
- 回滚时不是直接把 `game_character.current_snapshot_id` 指向历史快照，而是把历史快照内容重新覆写回当前 `current` 快照，保证历史快照保持只读语义。

### `character_profile`

用途：角色基础面板信息

| 字段               | 类型      | 说明           |
| ------------------ | --------- | -------------- |
| `snapshot_id`      | `TEXT PK` | 对应快照       |
| `school`           | `TEXT`    | 门派           |
| `level`            | `INTEGER` | 等级           |
| `physique`         | `INTEGER` | 体质加点       |
| `magic`            | `INTEGER` | 魔力加点       |
| `strength`         | `INTEGER` | 力量加点       |
| `endurance`        | `INTEGER` | 耐力加点       |
| `agility`          | `INTEGER` | 敏捷加点       |
| `potential_points` | `INTEGER` | 潜力点         |
| `hp`               | `REAL`    | 气血           |
| `mp`               | `REAL`    | 魔法           |
| `damage`           | `REAL`    | 伤害           |
| `defense`          | `REAL`    | 防御           |
| `magic_damage`     | `REAL`    | 法伤           |
| `magic_defense`    | `REAL`    | 法防           |
| `speed`            | `REAL`    | 速度           |
| `hit`              | `REAL`    | 命中           |
| `seal_hit`         | `REAL`    | 封印命中，可空 |
| `raw_body_json`    | `TEXT`    | 原始结构扩展   |

说明：

- 固定高频字段直接列出来，方便筛选和计算
- 不确定未来一定稳定的扩展字段收纳到 `raw_body_json`

### `character_skill`

用途：技能等级

| 字段                 | 类型      | 说明     |
| -------------------- | --------- | -------- |
| `id`                 | `TEXT PK` | 主键     |
| `snapshot_id`        | `TEXT`    | 对应快照 |
| `skill_code`         | `TEXT`    | 技能编码 |
| `skill_name`         | `TEXT`    | 技能名   |
| `base_level`         | `INTEGER` | 基础等级 |
| `extra_level`        | `INTEGER` | 额外等级 |
| `final_level`        | `INTEGER` | 最终等级 |
| `source_detail_json` | `TEXT`    | 来源拆解 |

约束建议：

- `UNIQUE(snapshot_id, skill_code)`

### `character_cultivation`

用途：修炼信息

| 字段               | 类型      | 说明             |
| ------------------ | --------- | ---------------- |
| `id`               | `TEXT PK` | 主键             |
| `snapshot_id`      | `TEXT`    | 对应快照         |
| `cultivation_type` | `TEXT`    | 攻修/法修/法抗等 |
| `level`            | `INTEGER` | 修炼等级         |

约束建议：

- `UNIQUE(snapshot_id, cultivation_type)`

## 5.3 装备主表

### `equipment_item`

用途：正式装备主表

| 字段           | 类型      | 说明                                                          |
| -------------- | --------- | ------------------------------------------------------------- |
| `id`           | `TEXT PK` | 装备 ID                                                       |
| `character_id` | `TEXT`    | 归属角色                                                      |
| `slot`         | `TEXT`    | `helmet` / `necklace` / `weapon` / `armor` / `belt` / `shoes` |
| `name`         | `TEXT`    | 装备名称                                                      |
| `level`        | `INTEGER` | 装备等级                                                      |
| `quality`      | `TEXT`    | 品质颜色                                                      |
| `price`        | `INTEGER` | 入库价格，可空                                                |
| `source`       | `TEXT`    | `ocr` / `manual` / `import`                                   |
| `status`       | `TEXT`    | `stored` / `equipped` / `archived`                            |
| `is_locked`    | `INTEGER` | 0/1                                                           |
| `created_at`   | `INTEGER` | 创建时间                                                      |
| `updated_at`   | `INTEGER` | 更新时间                                                      |

索引：

- `INDEX(character_id, slot, status)`
- `INDEX(character_id, updated_at DESC)`

### `equipment_attr`

用途：装备属性拆分表

| 字段            | 类型      | 说明                                 |
| --------------- | --------- | ------------------------------------ |
| `id`            | `TEXT PK` | 主键                                 |
| `equipment_id`  | `TEXT`    | 装备 ID                              |
| `attr_group`    | `TEXT`    | `base` / `extra` / `melt` / `refine` |
| `attr_type`     | `TEXT`    | 属性类型                             |
| `value_type`    | `TEXT`    | `flat` / `percent`                   |
| `attr_value`    | `REAL`    | 属性值                               |
| `display_order` | `INTEGER` | 排序                                 |

说明：

- 用行式属性表兼容梦幻装备属性种类多、未来扩展频繁的特点
- 例如法伤、法防、气血、速度、特技触发概率都可扩展

### `equipment_build`

用途：强化、开孔、镶嵌等构建信息

| 字段                  | 类型      | 说明       |
| --------------------- | --------- | ---------- |
| `equipment_id`        | `TEXT PK` | 装备 ID    |
| `hole_count`          | `INTEGER` | 开孔数     |
| `gem_level_total`     | `INTEGER` | 宝石总段数 |
| `refine_level`        | `INTEGER` | 强化等级   |
| `special_effect_json` | `TEXT`    | 特技特效   |
| `set_effect_json`     | `TEXT`    | 套装效果   |
| `notes_json`          | `TEXT`    | 其他扩展   |

补充说明：

- 当前线上实现里，`special_effect_json` 主要保存高亮标签、特效、精炼效果等展示字段。
- `set_effect_json` 保存符石套装文本、灵饰套装文本等摘要字段。
- `notes_json` 会额外持久化激活符石组、符石颜色序列、开孔数、跨服费等扩展元数据，供服务端规则链路自动命中 `rule_skill_bonus`，避免前端试算和正式保存口径分叉。

## 5.4 符石、符石组合、星石与星相互合

### `equipment_rune`

用途：单件装备上的符石孔位

| 字段           | 类型      | 说明     |
| -------------- | --------- | -------- |
| `id`           | `TEXT PK` | 主键     |
| `equipment_id` | `TEXT`    | 装备 ID  |
| `position_no`  | `INTEGER` | 第几孔   |
| `rune_name`    | `TEXT`    | 符石名称 |
| `rune_color`   | `TEXT`    | 符石颜色 |

约束建议：

- `UNIQUE(equipment_id, position_no)`

### `rune_set_rule`

用途：符石组合规则定义

| 字段               | 类型      | 说明                       |
| ------------------ | --------- | -------------------------- |
| `id`               | `TEXT PK` | 规则 ID                    |
| `set_name`         | `TEXT`    | 如九龙诀、龙腾、招云、腾蛟 |
| `slot`             | `TEXT`    | 对应部位                   |
| `first_hole_color` | `TEXT`    | 第一孔要求                 |
| `other_holes_json` | `TEXT`    | 后续孔颜色条件             |
| `effect_type`      | `TEXT`    | 技能加成/套装加成          |
| `effect_json`      | `TEXT`    | 规则效果                   |
| `enabled`          | `INTEGER` | 0/1                        |

### `equipment_rune_match`

用途：装备当前命中的符石组合

| 字段                | 类型      | 说明     |
| ------------------- | --------- | -------- |
| `id`                | `TEXT PK` | 主键     |
| `equipment_id`      | `TEXT`    | 装备 ID  |
| `rule_id`           | `TEXT`    | 规则 ID  |
| `matched`           | `INTEGER` | 0/1      |
| `match_detail_json` | `TEXT`    | 命中详情 |
| `computed_at`       | `INTEGER` | 计算时间 |

### `star_stone_item`

用途：星石主表

| 字段             | 类型      | 说明           |
| ---------------- | --------- | -------------- |
| `id`             | `TEXT PK` | 星石 ID        |
| `equipment_id`   | `TEXT`    | 所属装备       |
| `name`           | `TEXT`    | 星石名         |
| `star_type`      | `TEXT`    | 部位型星石     |
| `color`          | `TEXT`    | 星石颜色       |
| `yin_yang_state` | `TEXT`    | `yin` / `yang` |
| `level`          | `INTEGER` | 星石等级       |

### `star_stone_attr`

用途：星石属性

| 字段            | 类型      | 说明    |
| --------------- | --------- | ------- |
| `id`            | `TEXT PK` | 主键    |
| `star_stone_id` | `TEXT`    | 星石 ID |
| `attr_type`     | `TEXT`    | 属性名  |
| `attr_value`    | `REAL`    | 属性值  |

### `star_resonance_rule`

用途：星相互合规则

| 字段                   | 类型      | 说明         |
| ---------------------- | --------- | ------------ |
| `id`                   | `TEXT PK` | 规则 ID      |
| `slot`                 | `TEXT`    | 装备部位     |
| `combo_name`           | `TEXT`    | 对应符石组合 |
| `required_colors_json` | `TEXT`    | 所需颜色列表 |
| `bonus_attr_type`      | `TEXT`    | 奖励属性     |
| `bonus_attr_value`     | `REAL`    | 奖励值       |
| `enabled`              | `INTEGER` | 0/1          |

### `character_star_resonance`

用途：角色当前星相互合命中状态

| 字段          | 类型      | 说明     |
| ------------- | --------- | -------- |
| `id`          | `TEXT PK` | 主键     |
| `snapshot_id` | `TEXT`    | 角色快照 |
| `slot`        | `TEXT`    | 部位     |
| `rule_id`     | `TEXT`    | 命中规则 |
| `matched`     | `INTEGER` | 0/1      |
| `bonus_json`  | `TEXT`    | 奖励详情 |

## 5.5 灵饰

### `ornament_item`

用途：灵饰主表

| 字段              | 类型      | 说明                                       |
| ----------------- | --------- | ------------------------------------------ |
| `id`              | `TEXT PK` | 灵饰 ID                                    |
| `character_id`    | `TEXT`    | 归属角色                                   |
| `slot`            | `TEXT`    | `ring` / `earring` / `bracelet` / `amulet` |
| `name`            | `TEXT`    | 灵饰名                                     |
| `level`           | `INTEGER` | 等级                                       |
| `quality`         | `TEXT`    | 品质颜色                                   |
| `main_attr_type`  | `TEXT`    | 主属性类型                                 |
| `main_attr_value` | `REAL`    | 主属性值                                   |
| `status`          | `TEXT`    | `stored` / `equipped` / `archived`         |
| `source`          | `TEXT`    | 来源                                       |
| `created_at`      | `INTEGER` | 创建时间                                   |
| `updated_at`      | `INTEGER` | 更新时间                                   |

### `ornament_sub_attr`

用途：灵饰附加属性

| 字段            | 类型      | 说明    |
| --------------- | --------- | ------- |
| `id`            | `TEXT PK` | 主键    |
| `ornament_id`   | `TEXT`    | 灵饰 ID |
| `attr_type`     | `TEXT`    | 属性名  |
| `attr_value`    | `REAL`    | 数值    |
| `display_order` | `INTEGER` | 排序    |

### `ornament_set_effect`

用途：灵饰套装效果

| 字段          | 类型      | 说明               |
| ------------- | --------- | ------------------ |
| `id`          | `TEXT PK` | 主键               |
| `snapshot_id` | `TEXT`    | 角色快照           |
| `set_name`    | `TEXT`    | 套装名             |
| `total_level` | `INTEGER` | 总等级             |
| `tier`        | `INTEGER` | 8/16/24/28/32 档位 |
| `effect_json` | `TEXT`    | 套装效果           |

## 5.6 玉魄

### `jade_item`

用途：玉魄主表

| 字段           | 类型      | 说明                               |
| -------------- | --------- | ---------------------------------- |
| `id`           | `TEXT PK` | 玉魄 ID                            |
| `character_id` | `TEXT`    | 归属角色                           |
| `slot`         | `TEXT`    | 对应装备位                         |
| `name`         | `TEXT`    | 玉魄名称                           |
| `quality`      | `TEXT`    | 品质                               |
| `fit_level`    | `INTEGER` | 契合等级                           |
| `status`       | `TEXT`    | `stored` / `equipped` / `archived` |
| `source`       | `TEXT`    | 来源                               |
| `created_at`   | `INTEGER` | 创建时间                           |
| `updated_at`   | `INTEGER` | 更新时间                           |

### `jade_attr`

用途：玉魄属性

| 字段            | 类型      | 说明                     |
| --------------- | --------- | ------------------------ |
| `id`            | `TEXT PK` | 主键                     |
| `jade_id`       | `TEXT`    | 玉魄 ID                  |
| `attr_type`     | `TEXT`    | 法术伤害、法术暴击等级等 |
| `value_type`    | `TEXT`    | `flat` / `percent`       |
| `attr_value`    | `REAL`    | 属性值                   |
| `display_order` | `INTEGER` | 排序                     |

说明：

- 文档明确要求区分固定值与百分比
- 例如 `法术忽视 5%` 必须保留为百分比数据，不能写死到结果里
- 当前服务端试算已读取装备元数据中的 `spell_ignore_percent` / `spell_damage_percent`，以及 `法术忽视 %` / `基础法术伤害 %` 文本
  - `spell_ignore_percent` 在公式阶段修正目标法防
  - `spell_damage_percent` 在公式阶段修正最终参与计算的面板法伤

## 5.7 快照挂载关系

### `snapshot_equipment_slot`

用途：快照上的常规装备槽位

| 字段           | 类型      | 说明    |
| -------------- | --------- | ------- |
| `id`           | `TEXT PK` | 主键    |
| `snapshot_id`  | `TEXT`    | 快照    |
| `slot`         | `TEXT`    | 部位    |
| `equipment_id` | `TEXT`    | 装备 ID |

约束建议：

- `UNIQUE(snapshot_id, slot)`

补充说明：

- `snapshot_equipment_slot` 现在同时承载当前快照和历史回滚快照的装备引用。
- 覆写当前装备时，只会清理当前 `snapshot_id` 自身绑定的装备，以及没有被其他历史快照引用的孤儿 `equipment_item`；历史快照引用的装备不会被删除。

### `snapshot_ornament_slot`

用途：快照上的灵饰槽位

| 字段          | 类型      | 说明    |
| ------------- | --------- | ------- |
| `id`          | `TEXT PK` | 主键    |
| `snapshot_id` | `TEXT`    | 快照    |
| `slot`        | `TEXT`    | 部位    |
| `ornament_id` | `TEXT`    | 灵饰 ID |

### `snapshot_jade_slot`

用途：快照上的玉魄槽位

| 字段          | 类型      | 说明    |
| ------------- | --------- | ------- |
| `id`          | `TEXT PK` | 主键    |
| `snapshot_id` | `TEXT`    | 快照    |
| `slot`        | `TEXT`    | 部位    |
| `jade_id`     | `TEXT`    | 玉魄 ID |

## 5.8 OCR 与待确认入库

### `ocr_job`

用途：一次 OCR 任务

| 字段              | 类型      | 说明                                           |
| ----------------- | --------- | ---------------------------------------------- |
| `id`              | `TEXT PK` | OCR 任务 ID                                    |
| `character_id`    | `TEXT`    | 归属角色                                       |
| `scene_type`      | `TEXT`    | `profile` / `equipment` / `ornament` / `jade`  |
| `image_url`       | `TEXT`    | 图片地址                                       |
| `status`          | `TEXT`    | `pending` / `success` / `failed` / `reviewing` |
| `raw_result_json` | `TEXT`    | 原始 OCR 结果                                  |
| `error_message`   | `TEXT`    | 失败原因                                       |
| `created_at`      | `INTEGER` | 创建时间                                       |
| `updated_at`      | `INTEGER` | 更新时间                                       |

### `ocr_draft_item`

用途：OCR 识别出的草稿对象

| 字段               | 类型      | 说明                                           |
| ------------------ | --------- | ---------------------------------------------- |
| `id`               | `TEXT PK` | 草稿 ID                                        |
| `ocr_job_id`       | `TEXT`    | OCR 任务                                       |
| `character_id`     | `TEXT`    | 角色 ID                                        |
| `item_type`        | `TEXT`    | `equipment` / `ornament` / `jade` / `profile`  |
| `draft_body_json`  | `TEXT`    | 解析后的结构化草稿                             |
| `confidence_score` | `REAL`    | 识别置信度                                     |
| `review_status`    | `TEXT`    | `pending` / `approved` / `rejected` / `edited` |
| `review_note`      | `TEXT`    | 审核备注                                       |
| `created_at`       | `INTEGER` | 创建时间                                       |
| `updated_at`       | `INTEGER` | 更新时间                                       |

说明：

- 这张表就是文档里的“待确认区”
- 正式入库前不直接写正式资产表

### `inventory_entry`

用途：正式入库记录

| 字段              | 类型      | 说明                            |
| ----------------- | --------- | ------------------------------- |
| `id`              | `TEXT PK` | 入库记录 ID                     |
| `character_id`    | `TEXT`    | 角色 ID                         |
| `item_type`       | `TEXT`    | 资产类型                        |
| `item_ref_id`     | `TEXT`    | 指向正式资产表 ID               |
| `source_draft_id` | `TEXT`    | 来源草稿                        |
| `folder_key`      | `TEXT`    | 分类键，如按部位入库            |
| `price`           | `INTEGER` | 标价                            |
| `status`          | `TEXT`    | `active` / `sold` / `discarded` |
| `created_at`      | `INTEGER` | 创建时间                        |

## 5.9 实验室

### `lab_session`

用途：一次实验室会话

| 字段                   | 类型      | 说明                                          |
| ---------------------- | --------- | --------------------------------------------- |
| `id`                   | `TEXT PK` | 实验会话 ID                                   |
| `character_id`         | `TEXT`    | 角色 ID                                       |
| `baseline_snapshot_id` | `TEXT`    | 当前基线快照                                  |
| `name`                 | `TEXT`    | 会话名称                                      |
| `status`               | `TEXT`    | `draft` / `computed` / `applied` / `archived` |
| `created_at`           | `INTEGER` | 创建时间                                      |
| `updated_at`           | `INTEGER` | 更新时间                                      |

### `lab_session_equipment`

用途：实验室挂载的样本/对比装备项

| 字段                  | 类型      | 说明                              |
| --------------------- | --------- | --------------------------------- |
| `id`                  | `TEXT PK` | 主键                              |
| `session_id`          | `TEXT`    | 会话 ID                           |
| `seat_type`           | `TEXT`    | `sample` / `compare`              |
| `slot`                | `TEXT`    | 部位                              |
| `equipment_id`        | `TEXT`    | 关联正式装备，可为空              |
| `payload_json`        | `TEXT`    | 临时挂载内容或覆盖字段            |
| `source`              | `TEXT`    | `library` / `manual` / `snapshot` |
| `inherit_gemstones`   | `INTEGER` | 0/1                               |
| `inherit_rune_stones` | `INTEGER` | 0/1                               |
| `sort`                | `INTEGER` | 排序                              |
| `created_at`          | `INTEGER` | 创建时间                          |
| `updated_at`          | `INTEGER` | 更新时间                          |

说明：

- 文档要求支持“模拟老装备的符石/宝石”
- 所以继承策略需要单独落字段，不能只靠前端临时传参
- 当前版本已覆盖常规装备链路，并支持灵饰/玉魄通过持久化元数据接入百分比效果；灵饰套装档位的自动数值派生仍待补齐

### `snapshot_battle_context`

用途：当前快照绑定的战斗参数，也是实验室生成基线时的默认战斗上下文

| 字段                               | 类型      | 说明               |
| ---------------------------------- | --------- | ------------------ |
| `snapshot_id`                      | `TEXT PK` | 快照 ID            |
| `rule_version_id`                  | `TEXT`    | 规则版本           |
| `self_formation`                   | `TEXT`    | 我方阵法           |
| `self_element`                     | `TEXT`    | 我方五行           |
| `formation_counter_state`          | `TEXT`    | 阵法克制关系       |
| `element_relation`                 | `TEXT`    | 五行关系           |
| `transform_card_factor`            | `REAL`    | 变身卡系数         |
| `split_target_count`               | `INTEGER` | 分灵目标数         |
| `shenmu_value`                     | `REAL`    | 神木符值           |
| `magic_result`                     | `REAL`    | 法伤结果           |
| `target_template_id`               | `TEXT`    | 目标模板           |
| `target_name`                      | `TEXT`    | 目标名称           |
| `target_level`                     | `INTEGER` | 目标等级           |
| `target_hp`                        | `REAL`    | 目标气血           |
| `target_defense`                   | `REAL`    | 目标防御           |
| `target_magic_defense`             | `REAL`    | 目标法防           |
| `target_speed`                     | `REAL`    | 目标速度           |
| `target_magic_defense_cultivation` | `INTEGER` | 目标法抗修炼       |
| `target_element`                   | `TEXT`    | 目标五行           |
| `target_formation`                 | `TEXT`    | 目标阵法           |
| `notes_json`                       | `TEXT`    | 其他说明或扩展参数 |

说明：

- 当前版本优先把“当前状态”和“伤害计算”需要的战斗参数持久化
- `target_speed` 用于服务端执行 `招云` 套装的目标速度加伤规则；老数据迁移后默认补 `0`
- 更细粒度的实验结果表，如 `lab_result`、`lab_attr_delta`、`lab_apply_log`，后续再补

## 5.10 战斗目标与规则模板

### `battle_target_template`

用途：目标预设

| 字段                        | 类型      | 说明                                  |
| --------------------------- | --------- | ------------------------------------- |
| `id`                        | `TEXT PK` | 模板 ID                               |
| `user_id`                   | `TEXT`    | 用户 ID，可空，支持系统模板和个人模板 |
| `scope`                     | `TEXT`    | `system` / `user`                     |
| `name`                      | `TEXT`    | 模板名称                              |
| `dungeon_name`              | `TEXT`    | 副本或场景                            |
| `target_type`               | `TEXT`    | `mob` / `boss` / `manual`             |
| `school`                    | `TEXT`    | 门派或流派说明                        |
| `level`                     | `INTEGER` | 等级                                  |
| `hp`                        | `REAL`    | 气血                                  |
| `defense`                   | `REAL`    | 防御                                  |
| `magic_defense`             | `REAL`    | 法防                                  |
| `magic_defense_cultivation` | `INTEGER` | 法抗修炼                              |
| `speed`                     | `REAL`    | 速度                                  |
| `element`                   | `TEXT`    | 五行                                  |
| `formation`                 | `TEXT`    | 阵法                                  |
| `notes`                     | `TEXT`    | 备注                                  |
| `payload_json`              | `TEXT`    | 扩展字段                              |
| `enabled`                   | `INTEGER` | 是否启用                              |
| `created_at`                | `INTEGER` | 创建时间                              |
| `updated_at`                | `INTEGER` | 更新时间                              |
| `five_element`              | `TEXT`    | 五行                                  |
| `body_json`                 | `TEXT`    | 其他扩展字段                          |
| `enabled`                   | `INTEGER` | 0/1                                   |

### `damage_rule_version`

用途：伤害公式版本管理

| 字段         | 类型      | 说明     |
| ------------ | --------- | -------- |
| `id`         | `TEXT PK` | 版本 ID  |
| `rule_name`  | `TEXT`    | 规则名称 |
| `version_no` | `INTEGER` | 版本号   |
| `rule_json`  | `TEXT`    | 公式描述 |
| `enabled`    | `INTEGER` | 是否启用 |
| `created_at` | `INTEGER` | 创建时间 |

说明：

- 文档里的规则会持续迭代
- 单独做版本表可以保证旧实验记录仍能回放

## 5.11 后台管理与规则配置

数据库设计需要显式考虑后台，因为本项目不是纯前台录入系统，后台需要能够维护：

- 数值规则
- 套装规则
- 星相互合规则
- 怪物模板
- OCR 词典与纠错映射
- 规则发布版本
- 后台操作审计

### 后台能力边界

建议后台至少具备以下能力：

- 配置门派基础成长与属性转化
- 配置技能伤害公式
- 配置符石组合规则
- 配置星相互合规则
- 配置灵饰套装档位规则
- 配置玉魄属性池与百分比计算口径
- 配置目标怪物模板
- 配置 OCR 纠错词典
- 灰度发布和回滚规则版本
- 记录每次后台修改的审计日志

### `admin_user`

用途：后台账号

| 字段           | 类型      | 说明                  |
| -------------- | --------- | --------------------- |
| `id`           | `TEXT PK` | 后台用户 ID           |
| `email`        | `TEXT`    | 登录邮箱              |
| `display_name` | `TEXT`    | 显示名                |
| `status`       | `TEXT`    | `active` / `disabled` |
| `created_at`   | `INTEGER` | 创建时间              |
| `updated_at`   | `INTEGER` | 更新时间              |

索引：

- `UNIQUE(email)`

### `admin_role`

用途：后台角色定义

| 字段               | 类型      | 说明                                                  |
| ------------------ | --------- | ----------------------------------------------------- |
| `id`               | `TEXT PK` | 角色 ID                                               |
| `role_key`         | `TEXT`    | `super_admin` / `operator` / `rule_editor` / `viewer` |
| `role_name`        | `TEXT`    | 角色名称                                              |
| `permissions_json` | `TEXT`    | 权限集合                                              |
| `created_at`       | `INTEGER` | 创建时间                                              |
| `updated_at`       | `INTEGER` | 更新时间                                              |

### `admin_user_role`

用途：后台用户角色关系

| 字段            | 类型      | 说明     |
| --------------- | --------- | -------- |
| `id`            | `TEXT PK` | 主键     |
| `admin_user_id` | `TEXT`    | 后台用户 |
| `admin_role_id` | `TEXT`    | 后台角色 |
| `created_at`    | `INTEGER` | 创建时间 |

约束建议：

- `UNIQUE(admin_user_id, admin_role_id)`

### `rule_set`

用途：规则集合主表，表示一组可发布的业务规则

| 字段                 | 类型      | 说明                                                                                                             |
| -------------------- | --------- | ---------------------------------------------------------------------------------------------------------------- |
| `id`                 | `TEXT PK` | 规则集 ID                                                                                                        |
| `rule_domain`        | `TEXT`    | `attribute` / `skill` / `rune_set` / `star_resonance` / `ornament_set` / `jade` / `target_template` / `ocr_dict` |
| `rule_key`           | `TEXT`    | 规则唯一键                                                                                                       |
| `rule_name`          | `TEXT`    | 规则名称                                                                                                         |
| `description`        | `TEXT`    | 规则说明                                                                                                         |
| `status`             | `TEXT`    | `draft` / `active` / `archived`                                                                                  |
| `current_version_id` | `TEXT`    | 当前启用版本                                                                                                     |
| `created_by`         | `TEXT`    | 创建人                                                                                                           |
| `created_at`         | `INTEGER` | 创建时间                                                                                                         |
| `updated_at`         | `INTEGER` | 更新时间                                                                                                         |

索引：

- `UNIQUE(rule_domain, rule_key)`
- `INDEX(rule_domain, status)`

### `rule_version`

用途：规则版本表

| 字段             | 类型      | 说明                                 |
| ---------------- | --------- | ------------------------------------ |
| `id`             | `TEXT PK` | 版本 ID                              |
| `rule_set_id`    | `TEXT`    | 规则集 ID                            |
| `version_no`     | `INTEGER` | 版本号                               |
| `version_label`  | `TEXT`    | 版本标签                             |
| `status`         | `TEXT`    | `draft` / `published` / `deprecated` |
| `content_json`   | `TEXT`    | 规则完整定义                         |
| `change_summary` | `TEXT`    | 变更摘要                             |
| `published_by`   | `TEXT`    | 发布人                               |
| `published_at`   | `INTEGER` | 发布时间                             |
| `created_at`     | `INTEGER` | 创建时间                             |

约束建议：

- `UNIQUE(rule_set_id, version_no)`

说明：

- `content_json` 是后台规则编辑器的主载体
- 线上计算只读取 `published` 版本
- 一条规则可以保留多个历史版本，满足回溯和回滚

### `rule_release`

用途：规则发布批次

| 字段             | 类型      | 说明                                  |
| ---------------- | --------- | ------------------------------------- |
| `id`             | `TEXT PK` | 发布批次 ID                           |
| `release_name`   | `TEXT`    | 发布名称                              |
| `status`         | `TEXT`    | `draft` / `published` / `rolled_back` |
| `effective_at`   | `INTEGER` | 生效时间                              |
| `rolled_back_at` | `INTEGER` | 回滚时间                              |
| `created_by`     | `TEXT`    | 创建人                                |
| `created_at`     | `INTEGER` | 创建时间                              |

### `rule_release_item`

用途：规则发布批次中的版本明细

| 字段              | 类型      | 说明     |
| ----------------- | --------- | -------- |
| `id`              | `TEXT PK` | 主键     |
| `rule_release_id` | `TEXT`    | 发布批次 |
| `rule_version_id` | `TEXT`    | 规则版本 |
| `rule_domain`     | `TEXT`    | 规则域   |
| `rule_key`        | `TEXT`    | 规则键   |

约束建议：

- `UNIQUE(rule_release_id, rule_version_id)`

### `runtime_rule_binding`

用途：线上运行时绑定当前生效规则

| 字段              | 类型      | 说明                      |
| ----------------- | --------- | ------------------------- |
| `id`              | `TEXT PK` | 主键                      |
| `scene_key`       | `TEXT`    | 场景键，如 `prod_default` |
| `rule_domain`     | `TEXT`    | 规则域                    |
| `rule_key`        | `TEXT`    | 规则键                    |
| `rule_version_id` | `TEXT`    | 当前生效版本              |
| `effective_at`    | `INTEGER` | 生效时间                  |
| `updated_by`      | `TEXT`    | 操作人                    |
| `updated_at`      | `INTEGER` | 更新时间                  |

约束建议：

- `UNIQUE(scene_key, rule_domain, rule_key)`

说明：

- 这样可以支持多套环境
- 例如 `prod_default`、`staging`、`beta`

### `ocr_dictionary`

用途：OCR 纠错词典和映射规则

| 字段              | 类型      | 说明                                                       |
| ----------------- | --------- | ---------------------------------------------------------- |
| `id`              | `TEXT PK` | 主键                                                       |
| `dict_type`       | `TEXT`    | `equipment_name` / `skill_name` / `attr_name` / `set_name` |
| `raw_text`        | `TEXT`    | OCR 原文                                                   |
| `normalized_text` | `TEXT`    | 纠正后标准文案                                             |
| `priority`        | `INTEGER` | 优先级                                                     |
| `enabled`         | `INTEGER` | 0/1                                                        |
| `created_by`      | `TEXT`    | 创建人                                                     |
| `created_at`      | `INTEGER` | 创建时间                                                   |
| `updated_at`      | `INTEGER` | 更新时间                                                   |

索引：

- `INDEX(dict_type, raw_text)`

### `admin_audit_log`

用途：后台操作审计日志

| 字段            | 类型      | 说明                                                                |
| --------------- | --------- | ------------------------------------------------------------------- |
| `id`            | `TEXT PK` | 日志 ID                                                             |
| `admin_user_id` | `TEXT`    | 操作人                                                              |
| `action_type`   | `TEXT`    | `create` / `update` / `delete` / `publish` / `rollback` / `approve` |
| `target_type`   | `TEXT`    | 操作对象类型                                                        |
| `target_id`     | `TEXT`    | 操作对象 ID                                                         |
| `before_json`   | `TEXT`    | 修改前快照                                                          |
| `after_json`    | `TEXT`    | 修改后快照                                                          |
| `request_id`    | `TEXT`    | 请求链路 ID                                                         |
| `created_at`    | `INTEGER` | 创建时间                                                            |

索引：

- `INDEX(target_type, target_id, created_at DESC)`
- `INDEX(admin_user_id, created_at DESC)`

## 5.12 面向后台可配置的规则拆分建议

为了让后台能“设置规则”，建议把以下规则全部数据化，不写死在代码里：

### 属性成长规则

例如龙宫法师当前写死的规则：

- `1点基础气血来源(baseHp) -> 气血 +5`
- `1点体质 -> 气血 +12`
- `1点耐力 -> 气血 +4`
- `1点魔力 -> 魔法值 +1.6`
- `1点灵力 -> 魔法值 +0.25`
- `1点魔力 -> 面板法伤 +5`
- `1点灵力 -> 面板法伤 +1.2`
- `1级 -> 面板法伤 +3`
- `1点力量 -> 命中 +2`
- `1级 -> 命中 +6`
- `1点力量 -> 伤害 +8`
- `1级 -> 伤害 +6`
- `1点耐力 -> 防御 +4`
- `1点体质 -> 防御 +2`
- `1级 -> 防御 +3`
- `1点灵力 -> 法防 +0.6`
- `1点耐力 -> 法防 +2`
- `1级 -> 法防 +2.6`
- `1点敏捷 -> 速度 +4`
- `1级 -> 速度 +2`
- `1点敏捷 -> 躲避 +2`
- `躲避` 的等级项按 `floor(level * 0.8)` 计入

说明：

- 上述条目表示当前 `damage_v1` 生效版本已经落到 D1 的服务端规则口径。
- `baseHp` 为运行时来源属性，读取自 `character_profile.raw_body_json.baseHp`；历史快照缺失该字段时，服务端按当前面板气血、体质、耐力和装备气血反推。
- `躲避` 的等级项在规则表里通过 `value_type = 'floor_linear'` 表达 `floor(level * 0.8)`，用于和 `gameLogic` 保持一致。

这类规则建议落在：

- `rule_set(rule_domain='attribute')`
- `rule_version.content_json`

### 套装规则

例如：

- 招云
- 腾蛟
- 龙腾
- 九龙诀

建议规则内容至少包括：

- 作用部位
- 第一孔颜色序列
- 后续孔位条件
- 触发效果
- 公式参数

### 技能伤害公式

建议配置项包括：

- 技能名
- 基础公式
- 套装增益公式
- 玉魄穿透修正逻辑
- 目标属性引用字段

### 星相互合规则

建议配置项包括：

- 部位
- 组合名
- 颜色清单
- 单件奖励
- 全局奖励

### 灵饰套装规则

建议配置项包括：

- 套装名称
- 激活阈值
- 档位列表
- 各档位效果

### 玉魄规则

建议配置项包括：

- 允许属性池
- 固定值上下限
- 百分比上下限
- 计算时机
- 是否参与实时实验室公式

## 6. 推荐索引

## 6. 推荐索引

建议优先建立以下索引：

- `game_character(user_id, updated_at desc)`
- `character_snapshot(character_id, created_at desc)`
- `equipment_item(character_id, slot, status)`
- `ornament_item(character_id, slot, status)`
- `jade_item(character_id, slot, status)`
- `ocr_job(character_id, created_at desc)`
- `ocr_draft_item(character_id, review_status, created_at desc)`
- `inventory_entry(character_id, item_type, status)`
- `lab_session(character_id, updated_at desc)`
- `lab_slot_change(lab_session_id, slot_type)`
- `lab_attr_delta(lab_result_id, attr_type)`
- `rule_set(rule_domain, status)`
- `rule_version(rule_set_id, version_no desc)`
- `runtime_rule_binding(scene_key, rule_domain, rule_key)`
- `ocr_dictionary(dict_type, raw_text)`
- `admin_audit_log(target_type, target_id, created_at desc)`

## 7. 状态流设计

### 7.1 OCR 入库状态流

`ocr_job.pending`
-> `ocr_job.success`
-> `ocr_draft_item.pending`
-> 用户审核
-> `ocr_draft_item.approved`
-> 写入正式资产表
-> 写入 `inventory_entry`

### 7.2 实验室状态流

`lab_session.draft`
-> 挂载候选装备
-> 计算
-> `lab_session.computed`
-> 用户确认替换
-> 生成新 `character_snapshot`
-> 更新 `game_character.current_snapshot_id`
-> `lab_session.applied`

### 7.3 后台规则发布状态流

`rule_set.draft`
-> 编辑 `rule_version`
-> 校验规则内容
-> 加入 `rule_release`
-> 发布
-> 写入 `runtime_rule_binding`
-> 线上生效

### 7.4 后台规则回滚状态流

当前线上版本
-> 选择历史 `rule_version`
-> 创建回滚批次
-> 更新 `runtime_rule_binding`
-> 写入 `admin_audit_log`
-> 历史规则重新生效

## 8. D1 专项建议

### 8.1 JSON 字段使用建议

以下字段可使用 `TEXT` 存 JSON：

- `raw_body_json`
- `special_effect_json`
- `set_effect_json`
- `other_holes_json`
- `required_colors_json`
- `effect_json`
- `draft_body_json`
- `summary_json`
- `manual_target_json`

不建议直接把整份角色状态只塞到单个 JSON 中，因为：

- 难以筛选角色和装备
- 难以建立稳定索引
- 实验室对比时不利于按属性增量查询

### 8.2 外键策略

D1 支持 SQLite 外键，但线上高频写入和迁移时更需要控制兼容性。

建议：

- 关键主从表保留外键约束
- 同时在应用层做二次校验
- 批量导入和迁移阶段谨慎依赖级联删除

### 8.3 枚举策略

SQLite 没有原生枚举类型，建议：

- 状态字段统一使用 `TEXT`
- 应用层通过 zod / TypeScript 字面量约束
- 关键状态可增加 `CHECK(status in (...))`

### 8.4 金额与价格

如果需要同时支持：

- 梦幻币
- 人民币
- 平台价格

建议使用：

- `price_amount INTEGER`
- `price_currency TEXT`

若当前只存藏宝阁价格，也可以先保留单字段 `price`

## 9. 推荐的最小可用版本

如果第一期先做 MVP，建议只上线这些表：

- `app_user`
- `game_character`
- `character_snapshot`
- `character_profile`
- `character_skill`
- `character_cultivation`
- `equipment_item`
- `equipment_attr`
- `equipment_build`
- `equipment_rune`
- `ornament_item`
- `ornament_sub_attr`
- `jade_item`
- `jade_attr`
- `snapshot_equipment_slot`
- `snapshot_ornament_slot`
- `snapshot_jade_slot`
- `ocr_job`
- `ocr_draft_item`
- `inventory_entry`
- `lab_session`
- `lab_slot_change`
- `lab_battle_context`
- `lab_result`
- `lab_attr_delta`
- `battle_target_template`

第二期再补：

- `rune_set_rule`
- `equipment_rune_match`
- `star_stone_item`
- `star_stone_attr`
- `star_resonance_rule`
- `character_star_resonance`
- `ornament_set_effect`
- `damage_rule_version`
- `lab_apply_log`
- `admin_user`
- `admin_role`
- `admin_user_role`
- `rule_set`
- `rule_version`
- `rule_release`
- `rule_release_item`
- `runtime_rule_binding`
- `ocr_dictionary`
- `admin_audit_log`

## 10. 与文档需求的映射

文档中的关键需求，对应落表如下：

- 当前状态：`game_character` + `character_snapshot` + `character_profile`
- 技能/修炼：`character_skill` + `character_cultivation`
- 6件装备：`equipment_item` + `snapshot_equipment_slot`
- 4件灵饰：`ornament_item` + `snapshot_ornament_slot`
- 2件玉魄：`jade_item` + `snapshot_jade_slot`
- 符石组合：`equipment_rune` + `rune_set_rule` + `equipment_rune_match`
- 星石与互合：`star_stone_item` + `star_resonance_rule`
- OCR 与待确认：`ocr_job` + `ocr_draft_item`
- 装备库：`inventory_entry`
- 实验室对比：`lab_session` + `lab_slot_change` + `lab_result`
- 目标怪物模板：`battle_target_template`

## 11. 建表顺序建议

建议迁移顺序：

1. 用户与角色
2. 快照与角色面板
3. 装备、灵饰、玉魄主表
4. 属性子表
5. 快照挂载表
6. OCR 与入库表
7. 实验室表
8. 后台账号与权限表
9. 规则表与模板表
10. 审计与发布表

## 12. 后续落地建议

如果准备在当前仓库继续实现，推荐下一步按这个顺序推进：

1. 在 `src/config/db/schema.sqlite.ts` 中补充上述 D1/SQLite 表定义
2. 先完成 MVP 表结构
3. 先把后台规则表一起建好，哪怕第一期只接一小部分配置
4. 再写 `shared/models` 下的数据访问层
5. 最后接 OCR 审核流、实验室推演逻辑和后台规则发布

如果后续需要，我可以继续直接补：

- D1 建表 SQL 版本
- Drizzle schema 版本
- 实验室核心表的 ER 图
- 后台规则中心的数据结构草案
- 或按这个文档继续把第一版 schema 写进项目

## 13. 规则试算样例（新增，2026-04）

为支持后台规则回归验证，新增 `rule_simulation_case` 表，专门保存“试算输入 + 期望结果快照”。

字段建议：

- `id`: 样例 ID
- `name`: 样例名称
- `version_id`: 可选绑定的规则版本
- `input_json`: 试算输入参数
- `expected_result_json`: 期望结果快照
- `notes`: 备注
- `enabled`: 是否启用
- `created_by`: 创建人
- `created_at`: 创建时间
- `updated_at`: 更新时间

索引建议：

- `INDEX(enabled, created_at DESC)`
- `INDEX(version_id, enabled, created_at DESC)`

用途说明：

- 后台规则试算页可以将当前参数保存为回归样例
- 后续修改 `rule_damage_modifier`、`rule_skill_bonus`、`rule_skill_formula` 时，可以直接载入样例重跑
- 样例保存的是业务输入和期望输出，不绑定前端实现细节，方便后续继续扩展到更多技能
