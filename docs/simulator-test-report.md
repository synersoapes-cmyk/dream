# 梦幻实验室测试报告

## 1. 文档目的

这份文档单独维护模拟器相关的测试验收、专项回归、后台联调和发布链路记录。

从当前版本开始：

- [implementation-task-list.md](/Users/czy/Documents/dream/docs/implementation-task-list.md) 只保留实现状态、缺口、优先级和开发任务。
- 测试账号、验收版本、回归命令、专项用例和结果表统一收口到本文件。

## 2. 2026-04 当前验收补充

截至 `2026-04-13`，最近一轮前后台验收结论如下：

- 线上前台 `实验室` 白屏已修复。
- 线上前台 `AI 顾问` 白屏已修复。
- 技能伤害弹层已经能跟随当前副本目标 / 目标模板联动。
- 顶部 `AccountSwitcher` 已支持云端角色切换、新建、重命名和删除。
- 玉魄百分比属性的服务端试算已覆盖 `法术忽视 %` 与 `基础法术伤害 %` 两类关键规则。
- 生产后台 `/zh/admin/simulator` 最近一轮验收中，`unlabeledCount = 0`、`missingIdOrNameCount = 0`。
- 同一轮后台页面 Lighthouse Accessibility = `100`。
- 最近静态核对确认：用户侧 `Security`、`Feedbacks` 和外围模板文案仍未完成产品化收口。
- 最近本地回归已通过：`pnpm test:simulator` 为 `34 / 34`，`pnpm build` 通过。
- 已确认的最新线上部署版本为 `fcdd8b5e-a28f-4766-bdcb-c6c00a80167b`。

## 3. 2026-04-10 测试任务列表

这份清单用于继续做线上回归与补测，统一约定如下：

- 后台测试账号固定使用：`admin@gmail.com / admin123123`
- 登录动作本轮不计入测试任务，不做通过 / 失败判定
- 状态只按已拿到的实际证据标记：
  - `测试成功`
  - `测试失败`
  - `还没有测试`

### 3.1 前台测试任务

| 测试项 | 状态 | 备注 |
| --- | --- | --- |
| 首页 simulator 可正常加载当前角色与当前装备 | 测试成功 | `Fresh Equip QA`、`Codex Star QA` 两个线上账号都已打开首页并加载云端角色数据 |
| 默认整套装备角色首次点击“保存装备” | 测试成功 | `Fresh Equip QA` 已验证，`PATCH /api/simulator/current/equipment = 200` |
| 历史老角色带默认整套装备点击“保存装备” | 测试成功 | `Codex Star QA` 已验证，修复前的 `503` 已消失，当前返回 `200` |
| 多套装备方案保存时不再复用前端临时 `set_1` | 测试成功 | 远端 D1 已核对，`equipment_plan.id` 为真实 UUID，不再是前端临时 id |
| 装备详情弹窗可正常打开 | 测试成功 | 已打开 `流云法袍` 详情页 |
| 护甲部位互合规则可从真实后台读取 | 测试成功 | 页面已显示 `星相互合：法术防御 +2`，并命中 `/api/simulator/star-resonance-rules?slot=armor = 200` |
| `流云法袍` 的互合配置可保存到云端 | 测试成功 | 已确认 `PATCH /api/simulator/current/equipment = 200`，远端 D1 `equipment_plan_item.payload_json` 包含 `starAlignmentConfig` |
| 保存装备后重开 `流云法袍` 详情，互合状态仍在 | 测试成功 | 重新打开后仍显示 `法术防御 +2` |
| 伤害试算接口可正常返回 | 测试成功 | 已点击“查看技能伤害”，`POST /api/simulator/calculate-damage = 200` |
| 伤害试算数值是否与文档黄金样例完全一致 | 测试成功 | 已按当前代码测试里的 `damage_v1 / lg_dragon_roll_v1` 黄金口径做线上接口核对：手动目标 `QA手动目标模板` 返回普通伤害 `706`、总伤 `4942`；副本 `大雁塔` 返回 `万年熊王 / 千年蛇魅 / 护塔灵兽 / 镇塔之神` 总伤分别为 `7 / 7 / 2324 / 1148`；对应 `POST /api/simulator/calculate-damage = 200` |
| 当前状态里的属性保存 | 测试成功 | 已将体质 `40 -> 41`，`PATCH /api/simulator/current/profile = 200`，重载后仍显示 `41`，随后已恢复为 `40` |
| 当前状态里的修炼保存 | 测试成功 | 已将法攻修炼 `20 -> 21`，`PATCH /api/simulator/current/cultivation = 200`，重载后仍显示 `21`，随后已恢复为 `20` |
| 战斗参数保存 | 测试成功 | `Codex Star QA` 已验证，`PATCH /api/simulator/current/battle-context = 200` |
| 手动目标新增 / 编辑 / 删除 | 测试成功 | 已确认“新增目标 -> 保存参数 -> 重载后仍在 -> 删除目标 -> 保存参数 -> 重载后消失”闭环成功；本轮又验证“编辑法术伤害 `1234 -> 1250` -> 保存参数 -> 重载后仍为 `1250`”，随后已恢复为 `1234` |
| 副本目标切换与试算联动 | 测试成功 | 线上版本 `ed88e2b8-e52c-44d3-87bb-f3de29ceeba4` 已验证：选中 `大雁塔 120级 噩梦` 后点击伤害试算，弹窗显示 `当前目标：大雁塔 - 万年熊王`，并命中 `POST /api/simulator/calculate-damage = 200` |
| 多角色切换 | 测试成功 | 已在 `Codex Star QA的龙宫号` 与临时角色 `Codex Temp Role` 之间双向切换，命中 `GET /api/simulator/current?characterId=... = 200` |
| 多角色新建 / 重命名 / 删除 | 测试成功 | 已验证新建临时角色 `Codex Temp Role` 与删除该角色闭环成功，`POST /api/simulator/characters = 200`、`DELETE /api/simulator/characters/0a165d7c-1047-4fb7-a700-09903acb3670 = 200`；本轮又验证将主角色 `Codex Star QA的龙宫号 -> Codex Star QA改名测试 -> Codex Star QA的龙宫号` 双向重命名，命中 `PATCH /api/simulator/characters/d39b559c-99af-45db-9201-94afc989f82e = 200`，重载后名称仍正确 |
| 灵饰编辑与保存 | 测试成功 | 已在线上打开 `灵符·潮声` 详情弹窗，将 `法伤 +86 速度 +16` 临时改为 `法伤 +87 速度 +16`，点击弹窗 `保存修改` 后页面卡片同步更新；随后点击 `保存装备`，命中 `PATCH /api/simulator/current/equipment = 200`；验收完成后已恢复原值 `法伤 +86 速度 +16`，并用远端 D1 确认 `equipment_plan_item.payload_json` 中 `trinket:1` 已恢复为 `magicDamage = 86`、`speed = 16` |
| 玉魄编辑与保存 | 测试成功 | 已在线上打开 `阳玉` 详情弹窗，将 `法伤 +55 速度 +12` 临时改为 `法伤 +56 速度 +12`，点击弹窗 `保存修改` 后页面卡片同步更新；随后点击 `保存装备`，命中 `PATCH /api/simulator/current/equipment = 200`；验收完成后已恢复原值 `法伤 +55 速度 +12`，并用远端 D1 确认 `equipment_plan_item.payload_json` 中 `jade:1` 已恢复为 `magicDamage = 55`、`speed = 12` |
| 实验室入口与实验室页面加载 | 测试成功 | 已进入实验室，看到样本席位、装备库和属性对比区；线上版本 `ed88e2b8-e52c-44d3-87bb-f3de29ceeba4` 复测确认样本席位可读取 `当前方案`，灵饰 / 玉魄、服务端总伤和目标 `大雁塔 - 万年熊王` 正常显示 |
| 实验室候选装备同步到当前装备 | 测试成功 | 本轮先通过前台 OCR 上传样本图生成待确认候选 `沧海灵杖`，将候选武器临时改为 `法伤 +221` 后点击 `替换到当前状态`，命中 `PATCH /api/simulator/current/equipment = 200`；页面当前武器文案变为 `法伤 +221 命中 +120`，随后已回滚恢复 |
| 装备回滚最近一次应用 | 测试成功 | 在实验室完成一次候选武器替换后，点击 `回滚最近一次应用`，命中 `POST /api/simulator/current/equipment/rollback = 200`；当前武器已恢复为 `法伤 +220 命中 +120`，明细属性中的法术伤害恢复为 `2630`，服务端总伤恢复为 `5263` |
| 前台 OCR 上传识别 | 测试成功 | 已在实验室上传样本图 `[tmp-equipment-weapon-row.png](/Users/czy/Documents/dream/tmp-equipment-weapon-row.png)`，命中 `GET /api/simulator/current/ocr/config = 200` 与 `POST /api/simulator/current/candidate-equipment/ocr = 200`；页面出现 `待确认新品 (1)`，识别出 `沧海灵杖 / 法伤 +220 / 命中 +120 / 售价 1880000`，随后已删除该临时候选 |
| AI 顾问页面加载与问答 | 测试成功 | 已打开 AI 顾问面板，输入框、预设问题和欢迎语均正常显示；线上版本 `ed88e2b8-e52c-44d3-87bb-f3de29ceeba4` 复测确认面板可加载，未发送问题以避免额外消耗 Gemini |
| 移动端首页与装备区渲染 | 测试成功 | 已在 `390x844` 移动端视口打开 `/zh`，当前状态、装备组合、灵饰和玉魄均可渲染；控制台无报错，最近网络请求未发现 `4xx / 5xx` |

### 3.2 OCR 识别引擎专项测试

本节专门对应文档里的 `M2-01 ~ M2-07`。本轮口径统一为：

- 测试环境：生产站点 `https://dream.xiao64702.workers.dev/zh`
- 验收时间：`2026-04-12`
- 验收版本：`1c9c4e2d-0da9-4c1e-b852-bff71bc3424e`
- 测试账号：`admin@gmail.com`
- 验收方式：生产站点真实上传 + 实际接口返回 + 当轮数据清理
- 清理原则：装备 OCR 产生的候选数据当轮即删，不保留远端 D1 脏数据

| 编号 | 测试项 | 状态 | 备注 |
| --- | --- | --- | --- |
| `M2-01` | 项链灵力捕获 | 测试成功 | 线上真实命中 `POST /api/simulator/current/candidate-equipment/ocr = 200`；临时项链图识别出 `灵力 +235`，返回 `stats.magicPower = 235`，随后已删除该候选装备 |
| `M2-02` | 熔炼属性识别 | 测试成功 | 本轮先发现线上旧版本会把 `防御 +180(+12)` 识别成 `defense = 180` 与 `forgeLevel = 12`；已在 [simulator-ocr.ts](/Users/czy/Documents/dream/src/shared/services/simulator-ocr.ts) 补最小后处理并重新发布。最新版线上复测 `POST /api/simulator/current/candidate-equipment/ocr = 200`，返回 `stats.defense = 192`、`magicDefense = 105`，候选数据已删除 |
| `M2-03` | 特效关键字提取 | 测试成功 | 临时项链图识别出 `无级别限制`、`神农`，返回同时写入 `highlights` 与 `specialEffect` |
| `M2-04` | 灵饰属性分类 | 测试成功 | 临时戒指图识别为 `type = trinket`、`slot = 1`，主属性 `防御 +28`，下排两条 `法伤 +16` 合并为 `stats.defense = 28`、`stats.magicDamage = 32` |
| `M2-05` | 移动端适配 | 测试成功 | 使用黑底移动端风格属性长图命中 `POST /api/simulator/current/profile/ocr = 200`，识别出 `89 / 龙宫 / 40 / 210 / 20 / 30 / 25 / 1460 / 540 / 990`；测试后已用 `PATCH /api/simulator/current/profile = 200` 恢复角色原值 |
| `M2-06` | 图片自动分发 | 测试成功 | 前台“上传属性截图”真实命中 `/api/simulator/current/profile/ocr`；实验室“上传装备截图”真实命中 `/api/simulator/current/candidate-equipment/ocr`，分流正常 |
| `M2-07` | 错误图片容错 | 测试成功 | 上传非游戏风景图后，线上接口返回 `code = -1`、`message = 未检测到游戏组件` |

### 3.3 M3 属性转化与加点专项测试

本节对应用户补充的 `M3-01 ~ M3-08`。本轮口径统一为：

- 验收时间：`2026-04-12`
- 验收方式：前台单测 + 线上页面闭环 + 远端 D1 核对
- 备注：本节优先判断“规则和闭环是否已经真实存在”，不是只看字段是否预留

| 编号 | 测试项 | 状态 | 备注 |
| --- | --- | --- | --- |
| `M3-01` | 魔力转化率 | 测试成功 | 前台 [gameLogic.ts](/Users/czy/Documents/dream/src/features/simulator/store/gameLogic.ts) 已补前端回归测试，确认 `1 魔力 = 魔法 +3.5、法伤 +0.7、法防 +0.7`；见 [gameLogic.test.ts](/Users/czy/Documents/dream/src/features/simulator/store/gameLogic.test.ts) |
| `M3-02` | 力量转化率 | 测试成功 | 本轮已补前台回归测试，确认 `1 力量 = 命中 +1.7、法伤 +0.4、法防 +0.4、速度 +0.1`；见 [gameLogic.test.ts](/Users/czy/Documents/dream/src/features/simulator/store/gameLogic.test.ts) |
| `M3-03` | 耐力物防转化 | 测试成功 | 本轮已补前台回归测试，确认 `1 耐力 = 物防 +1.6、法伤 +0.2、法防 +0.2、速度 +0.1`；前后端规则种子仍统一落在 [scripts/init-damage-rules.ts](/Users/czy/Documents/dream/scripts/init-damage-rules.ts) |
| `M3-04` | 体质法防转化 | 测试成功 | 本轮已补前台回归测试，确认 `1 体质 = 气血 +4.5、法伤 +0.3、法防 +0.3、速度 +0.1`；见 [gameLogic.test.ts](/Users/czy/Documents/dream/src/features/simulator/store/gameLogic.test.ts) |
| `M3-05` | 敏捷速度转化 | 测试成功 | 本轮已补前台回归测试，确认 `1 敏捷 = 速度 +0.7`，并继续保留 `躲避 +1`；见 [gameLogic.test.ts](/Users/czy/Documents/dream/src/features/simulator/store/gameLogic.test.ts) |
| `M3-06` | 潜力点分配 | 测试成功 | 当前状态页已补出“快速加点”区，支持拖动滑杆分配当前潜力点，并提供“一键全魔”；store 单测已验证 `10` 点潜力全加魔力后，面板 `魔法 +35 / 法伤 +7 / 法防 +7` 即时联动，见 [gameStore.test.ts](/Users/czy/Documents/dream/src/features/simulator/store/gameStore.test.ts) |
| `M3-07` | 强身倍率联动 | 测试成功 | 当前状态页已补出“强身”修炼项，并打通 `/api/simulator/current/cultivation` 保存链路；本轮已完成“保存修炼 -> 强刷刷新 -> 页面复核 -> 远端 D1 复核”的线上闭环，确认 `强身 = 20` 时 `气血 = 4620` 保持稳定。期间还修复了 `baseHp` 在保存 profile 时误吃强身倍率导致的二次放大问题 |
| `M3-08` | 经脉属性补偿 | 测试成功 | 当前状态页已补出“经脉补偿”区，支持以结构化配置录入 `体质 / 魔力 / 力量 / 耐力 / 敏捷 / 灵力` 加成；本轮已完成线上即时联动与保存闭环，确认 `经脉魔力 10 -> 11` 时，页面即时变成 `法术伤害 1136 -> 1137`、`灵力 180 -> 181`、`法术防御 487 -> 488`，保存并刷新后仍保持正确 |

### 3.4 M4 装备联动与规则上限专项测试

本节对应用户补充的 `M4-01 ~ M4-09`。本轮口径统一为：

- 验收时间：`2026-04-12`
- 验收方式：自动化回归测试 + 代码链路核对 + 当前前后台落地状态复核
- 本轮实际执行命令：
  - `pnpm exec tsx --test src/features/simulator/store/gameLogic.test.ts src/shared/services/damage-engine.test.ts src/shared/blocks/simulator/EquipmentPanel/RuneStoneHelper.test.ts src/shared/lib/simulator-extra-attribute-summary.test.ts src/shared/blocks/simulator/LaboratoryPanel/laboratory-utils.test.ts`
- 本轮结果：
  - 上述目标回归集 `35 / 35` 通过
  - 当前可确认为 `8 / 9` 已落地，其中 `M4-01 ~ M4-07` 与 `M4-09` 为 `测试成功`
  - `M4-08` 仍是“临时规则已定义，待正式规则确认后再转正式验收”
  - `pnpm exec tsc --noEmit` 仍被仓内既有 `bodyStrength` 类型缺口阻塞，本轮未新增这类错误

| 编号 | 测试项 | 状态 | 备注 |
| --- | --- | --- | --- |
| `M4-01` | 门派组合唯一性 | 测试成功 | 已在 [damage-engine.test.ts](/Users/czy/Documents/dream/src/shared/services/damage-engine.test.ts) 新增“2 件 `九龙诀` 仅取最高一套”回归；当前规则仍按 `globalMaxActive = 1` 收口，不会重复叠加技能等级 |
| `M4-02` | 隔山打牛上限 | 测试成功 | 既有服务端测试已覆盖“穿 3 件仅按 2 套生效”，见 [damage-engine.test.ts](/Users/czy/Documents/dream/src/shared/services/damage-engine.test.ts) 中 `caps 隔山打牛 panel bonuses at two active sets` |
| `M4-03` | 星石共鸣触发 | 测试成功 | 既有服务端测试已覆盖 6 件严格命中后的 `fullSetActive = true`、`fullSetAttributeBonus = 2` 与五围来源加成，见 [damage-engine.test.ts](/Users/czy/Documents/dream/src/shared/services/damage-engine.test.ts) |
| `M4-04` | 武器法伤转换 | 测试成功 | 前台 [gameLogic.ts](/Users/czy/Documents/dream/src/features/simulator/store/gameLogic.ts) 已补入“武器伤害 / 4 -> 面板法伤”口径，并在 [gameLogic.test.ts](/Users/czy/Documents/dream/src/features/simulator/store/gameLogic.test.ts) 增加断言 |
| `M4-05` | 灵饰套装联动 | 测试成功 | 已在 [damage-engine.test.ts](/Users/czy/Documents/dream/src/shared/services/damage-engine.test.ts) 新增“4 件 4 级 `健步如飞` => 速度面板 +30”回归，验证档位命中和面板速度联动 |
| `M4-06` | 玉魄实时生效 | 测试成功 | 已在 [gameLogic.test.ts](/Users/czy/Documents/dream/src/features/simulator/store/gameLogic.test.ts) 补“阳玉法暴等级即时跳动”断言，当前前台面板会立即汇总 `magicCritLevel` |
| `M4-07` | 开孔状态校验 | 测试成功 | [RuneStoneHelper.ts](/Users/czy/Documents/dream/src/shared/blocks/simulator/EquipmentPanel/RuneStoneHelper.ts) 现已把 `luckyHoles = 0` 或无激活符石的组合显示为 `未激活`，并在 [RuneStoneHelper.test.ts](/Users/czy/Documents/dream/src/shared/blocks/simulator/EquipmentPanel/RuneStoneHelper.test.ts) 补回归 |
| `M4-08` | 套装阶梯属性 | 已补临时规则定义 | 当前先按“动物套 / 变身套”处理，固定为 `3 件` 与 `5 件` 两档；本期只处理 `魔力` 阶梯增益，临时口径为 `3 件 +10 魔力`、`5 件 +20 魔力`，并要求同时进入当前装备面板、实验室对比和服务端伤害试算 |
| `M4-09` | 双加属性统计 | 测试成功 | 已新增 [simulator-extra-attribute-summary.ts](/Users/czy/Documents/dream/src/shared/lib/simulator-extra-attribute-summary.ts) 汇总工具和对应测试；当前装备页与实验室席位都已开始显示 6 件装备双加汇总（如 `魔力 +24 / 耐力 +21`） |

#### M4-08 套装阶梯属性临时规则定义

当前先采用一版可执行的临时口径，后续若产品确认有新规则，再整体替换。

**临时规则**

- 套装对象：
  - 暂按 `动物套 / 变身套` 处理
- 激活维度：
  - 暂按“同名套装穿戴件数”处理
- 阶梯档位：
  - 固定 `3 件`
  - 固定 `5 件`
- 阶梯效果：
  - `3 件套 = 魔力 +10`
  - `5 件套 = 魔力 +20`
- 生效范围：
  - 当前装备面板
  - 实验室属性对比
  - 服务端伤害试算
- 本期边界：
  - 先只处理 `魔力` 阶梯增益
  - 暂不额外扩展其他隐藏效果、变身卡联动或额外技能效果

**自动化验收**

- `M4-08A`
  - `3 件套` 时命中低档位，显示正确的档位标签和属性值
- `M4-08B`
  - `5 件套` 时自动升级到高档位，不再停留在 `3 件套`
- `M4-08C`
  - 从 `3 件 -> 5 件` 的换装实验里，面板 `魔力` 和相关派生值同步跳动
- `M4-08D`
  - `3 件 / 5 件` 对实验室总伤和伤害预览同步产生变化

### 3.5 M5 符石组合有效性与实验室预警专项测试

本轮继续推进 `M5-01 ~ M5-18`，截至 `2026-04-12` 的最新结论如下：

- 已补齐并通过自动化回归：
  - `M5-01 / M5-08` 位置错误时只识别颜色、不激活组合
  - `M5-02` 同类门派技能组合全身只取最高一套
  - `M5-03` 孔数不足时按开孔数截断并自动降级
  - `M5-04 / M5-09` 三套隔山打牛仅按两套生效，并记录“超出上限失效”
  - `M5-05` 招云鞋子首孔颜色错误时，全套效果失效
  - `M5-10` 龙腾四级组合能显著抬高单体伤害
  - `M5-11 / M5-18` 改色后会自动降级或直接失效
  - `M5-12` 招云整套识别后会激活 `+6 灵力` 和 `目标速度 * 4%`
  - `M5-14` 隔山打牛提供的灵力会自动拆入法伤 / 法防
- 已补前台可见性：
  - 实验室席位新增“符石技能变化”区
  - 当换装导致 `破浪诀 / 呼风唤雨 / 龙腾 / 九龙诀 / 逆鳞 / 隔山打牛` 跌落时，会出现红字差值和预警文案
  - 实验室目标选择器会按样本席位的符石技能等级动态刷新“秒几”上限
  - 当前装备详情 / 实验室装备详情会对“孔数不足但录入高阶符石颜色”的情况显示冲突提示
- 当前剩余说明：
  - 本组主链已完成当前轮实现与验收；后续若继续增强，重点会转向更细的规则解释和更强的提示文案，而不是主功能缺失

**本轮自动化命令**

- `pnpm exec tsx --test src/shared/lib/simulator-rune-bonus.test.ts src/shared/services/damage-engine.test.ts src/shared/blocks/simulator/EquipmentPanel/RuneStoneHelper.test.ts src/shared/lib/simulator-rune-combo.test.ts src/shared/blocks/simulator/LaboratoryPanel/laboratory-utils.test.ts`
- `pnpm exec tsc --noEmit`

**本轮结果**

- 上述回归集 `49 / 49` 通过
- `tsc` 本轮无新增类型错误

| 编号 | 测试项 | 状态 | 备注 |
| --- | --- | --- | --- |
| `M5-01` | 符石组合有效性 | 测试成功 | 武器位错误识别 `九龙诀` 时，只识别颜色，不会激活技能等级 |
| `M5-02` | 符石组合有效性 | 测试成功 | 两件 `呼风唤雨 +6` 仅生效一件，服务端只保留一条 bonus rule |
| `M5-03` | 符石组合有效性 | 测试成功 | `3 孔 + 4 颗符石` 会按前三孔截断，并降成低阶组合 |
| `M5-04` | 符石组合有效性 | 测试成功 | 第三套 `隔山打牛` 已在日志中标记 `超出上限失效` |
| `M5-05` | 符石组合有效性 | 测试成功 | `招云` 鞋子首孔颜色错误后，全套 `+6 灵力` 与速度追加伤害一起消失 |
| `M5-06` | 九龙诀 - 属性联动 | 测试成功 | 当前状态与实验室明细属性已接入 `九龙诀` 的符石额外等级差值；命中 `+6` 时会同步抬升 `灵力 / 法伤 / 法防`，并按云端基准装备避免重复叠加 |
| `M5-07` | 呼风唤雨 - 目标数校验 | 测试成功 | 实验室目标选择器与正式“技能伤害”面板都已按符石后的 `龙卷雨击` 最终等级动态刷新秒几上限；跨 `150` 门槛时会出现 `秒7`，失去加成后会回落到 `秒6` |
| `M5-08` | 位置错误拦截 | 测试成功 | 鞋子位 `九龙诀` 仍只算单颗符石属性，不激活技能等级 |
| `M5-09` | 隔山打牛 - 叠加上限 | 测试成功 | 3 套仍只按 2 套进入伤害模拟与 breakdown |
| `M5-10` | 龙腾 - 伤害期望计算 | 测试成功 | `龙腾 +6` 已补显式回归，确认单体伤害明显抬升 |
| `M5-11` | 符石等级降级测试 | 测试成功 | 五色改三色后，会从 `+6` 自动降为 `+2` |
| `M5-12` | 招云 / 腾蛟 - 全身套装识别 | 测试成功 | 现已分别补齐 `招云` 与 `腾蛟` 的显式专项回归；`招云` 会命中 `+6 灵力 + 目标速度 * 4%`，`腾蛟` 会命中 `+6 灵力 + 龙腾魔法消耗 * 4%` |
| `M5-13` | 技能等级跌落预警 | 测试成功 | 实验室“应用到当前装备”前已升级为统一预警框；当 `破浪诀 / 呼风唤雨 / 龙腾 / 九龙诀 / 逆鳞` 跌落时，会在确认弹窗里直接提示风险与生效后等级 |
| `M5-14` | 隔山打牛 - 灵力转化 | 测试成功 | `70 灵力` 已确认会同步进入法伤 / 法防 |
| `M5-15` | 符石颜色 / 孔数冲突 | 测试成功 | 当前装备详情、实验室装备详情与“应用到当前装备”确认框都已显示逻辑冲突提示，并继续强制按孔数上限截断降级计算 |
| `M5-16` | 等级跌落逻辑 | 测试成功 | 实验室除了席位卡红字外，现已补成统一警告框；卸下或替换符石导致的技能等级跌落会在应用前再次确认 |
| `M5-17` | 被动加成识别 | 测试成功 | 已补专项回归，确认“技能自带灵力”继续以内置面板基线为准；当前试算仅追加 `九龙诀` 符石带来的额外等级差值，不会把基线收益再算一遍 |
| `M5-18` | 组合颜色容错 | 测试成功 | 改错颜色后，技能等级会即时归零 |

### 3.6 M6 实验室对比与替换决策专项测试

本节对应用户补充的 `M6-01 / M6-02 / M6-03 / M6-04 / M6-05 / M6-06 / M6-17`。本轮口径统一为：

- 验收时间：`2026-04-12`
- 验收方式：生产站点真实页面复测 + 线上接口回写 + 代码链路核对
- 验收站点：`https://dream.xiao64702.workers.dev/zh`
- 测试账号：`admin@gmail.com`
- 清理原则：本轮为验收临时改动的项链数值、实验室席位和候选装备脏数据，已在收尾阶段恢复

| 编号 | 测试项 | 状态 | 备注 |
| --- | --- | --- | --- |
| `M6-01` | 样本位锁定 | 测试成功 | 线上已确认实验室继续固定“样本席位优先”；当前代码已通过 [simulatorExperimentSeats.ts](/Users/czy/Documents/dream/src/features/simulator/utils/simulatorExperimentSeats.ts) 与 [gameStore.test.ts](/Users/czy/Documents/dream/src/features/simulator/store/gameStore.test.ts) 锁住样本席位不可替换，同时允许最多 `2` 个对比席位 |
| `M6-02` | 属性差值表格 | 测试成功 | 本轮在线上将对比席位项链临时从 `法伤 +128 魔力 +28` 调整到 `法伤 +138 魔力 +28`，实验室“明细属性对比”里已看到 `法术伤害 1136 -> 1146` 与 `+10` 差值，同时席位卡“属性及伤害变化”同步出现 `法伤: +10` |
| `M6-03` | 涨跌颜色渲染 | 测试成功 | 本轮线上已复现正向差值节点；代码里差值节点明确使用 [LaboratoryComparisonTable.tsx](/Users/czy/Documents/dream/src/shared/blocks/simulator/LaboratoryPanel/LaboratoryComparisonTable.tsx) 的 `text-green-400 / text-red-400`，席位卡 [LaboratorySeatCard.tsx](/Users/czy/Documents/dream/src/shared/blocks/simulator/LaboratoryPanel/LaboratorySeatCard.tsx) 也走同样的绿升红降口径 |
| `M6-04` | 继承模拟测试 | 测试成功 | 已补自动化闭环回归：白板装备在“继承旧宝石”时会沿用老段数并真实抬升 `灵力 / 法伤`，在“继承旧符石”时会沿用旧符石属性并进入实验室总属性与面板计算；见 [laboratory-utils.test.ts](/Users/czy/Documents/dream/src/shared/blocks/simulator/LaboratoryPanel/laboratory-utils.test.ts) |
| `M6-05` | 伤害差额显示 | 测试成功 | 实验室席位卡底部现已把绝对收益做成独立结果项，固定显示如“`伤害提升：+125点` / `伤害下降：-17点`”，并配套 `收益摘要 + 总伤增益百分比 + 1 点法伤成本`，便于快速做替换决策 |
| `M6-06` | 对比位横向对比 | 测试成功 | 实验室当前正式支持 `样本席位 + 2 个对比席位`；前台新增按钮可连续拉起两个对比位，store / 云端实验室会话恢复 / 顾问上下文摘要也都已同步放宽到 `2` 个席位 |
| `M6-17` | 替换决策确认 | 测试成功 | 本轮已在线上完成“对比席位项链 +10 法伤 -> 点击 `应用` -> 弹出 `确认覆盖当前装备` -> `确认覆盖` -> 回到当前状态页复核”的闭环；当前状态页项链文案曾成功变为 `法伤 +138 魔力 +28`，面板法伤同步 `1136 -> 1146`，随后已恢复原值 |

#### M6 本轮补充结论

- 当前 `M6` 共 `7` 项里，已完成 `7 / 7` 自动化或线上验收，当前这组主链已收口。
- 本轮额外发现一个线上问题：前台“待确认新品 -> 确认入库”后，候选装备状态在前台列表里仍可能回落为 `pending`，导致通过“装备库选择器”做人工挂载不稳定；本轮 `M6-02 / M6-17` 的线上验收因此改为直接复用云端实验室席位数据做闭环验证。

### 3.7 M7 性价比决策专项测试

本节对应用户新增的 `M7-01 / M7-02 / M7-03`。截至 `2026-04-13`，本轮实现与测试结论如下：

| 编号 | 测试项 | 状态 | 备注 |
| --- | --- | --- | --- |
| `M7-01` | 单点提升成本 | 测试成功 | 实验室席位卡与“明细属性对比”表都已统一展示 `1 点法伤成本`，口径为 `差价 / 法伤提升` |
| `M7-02` | 跨服费计算 | 测试成功 | 实验室本地总价与服务端估值 fallback 现已统一把 `售价 + 跨服费` 作为总价格；相关回归已覆盖 [laboratory-utils.test.ts](/Users/czy/Documents/dream/src/shared/blocks/simulator/LaboratoryPanel/laboratory-utils.test.ts) 与 [lab-valuation.test.ts](/Users/czy/Documents/dream/src/shared/services/lab-valuation.test.ts) |
| `M7-03` | 边际效益评估 | 测试成功 | 当前当 `多花 >= 5000` 且 `法伤仅提升 <= 2` 时，会在实验室席位卡和对比表直接显示“低性比”提醒，便于阻止高价低提升的替换决策 |

#### M7 本轮补充结论

- 性价比链路现已补齐“跨服费并入总价”“1 点法伤成本”“低性比提醒”三项缺口。
- 当前规则仍是第一版执行阈值；若后续需要按装备部位、总伤百分比或人民币预算分档，再在此基础上继续细化。

### 3.8 M8 伤害细则专项测试

本节对应用户新增的 `M8-01 ~ M8-08`。截至 `2026-04-13`，本轮口径统一为：

- 验收方式：服务端伤害引擎单测 + 本地前台页面闭环 + 生产站点真实页面闭环
- 验收命令：`pnpm exec tsx --test src/shared/services/damage-engine.test.ts`
- 本轮结果：`M8-01 ~ M8-08` 共 `8 / 8` 测试成功；同时确认整份 [damage-engine.test.ts](/Users/czy/Documents/dream/src/shared/services/damage-engine.test.ts) 当前 `50 / 50` 通过

| 编号 | 测试项 | 状态 | 备注 |
| --- | --- | --- | --- |
| `M8-01` | 基础对冲公式 | 测试成功 | 已在 [damage-engine.test.ts](/Users/czy/Documents/dream/src/shared/services/damage-engine.test.ts) 新增“法伤被完全对冲时仍保底 `1` 点伤害”回归，确认 `rawDamage < 0` 时最终仍会被钳到 `1` |
| `M8-02` | 分灵系数阶梯 | 测试成功 | 已补“`1.0 -> 0.54` 阶梯曲线”回归；同时修复 [damage-engine.ts](/Users/czy/Documents/dream/src/shared/services/damage-engine.ts) 里 `5+` 档位一刀切的问题，当前若 lookup 存在 `5 / 6 / 7` 精确档位，会优先按精确档位消费 |
| `M8-03` | 修炼压制计算 | 测试成功 | 已补 `25 修 vs 10 抗 = 35%` 放大量级样例；当前通过构造 `rawDamageBeforeVariance = 1500 -> 2025` 的精确样本，确认服务端公式可命中该口径 |
| `M8-04` | 阵法增益计算 | 测试成功 | 已补“阵法系数 `1.3` 时非结果部分同步放大 `1.3x`”回归，确认伤害引擎对 `formationFactor` 的消费稳定 |
| `M8-05` | 变身卡增益 | 测试成功 | 已补“魔之心卡 `1.2x` 只放大非结果部分”回归，确认 `magicResult` 不参与该乘区 |
| `M8-06` | 法爆期望计算 | 测试成功 | 已为伤害引擎新增 `criticalChance / criticalExpectationMultiplier` 的测试入口，当前 `10%` 法爆可输出 `+10%` 的长期期望伤害 |
| `M8-07` | 随机波动模拟 | 测试成功 | 已为伤害引擎新增 `damageVarianceFactor` 测试入口，并补 `10` 组 `95% ~ 105%` 样本，确认波动因子会稳定进入最终伤害 |
| `M8-08` | 罗汉强制减伤 | 测试成功 | 已为伤害引擎新增 `luohanFactor` 测试入口，确认开启罗汉时只缩小非结果部分到 `0.5`，`magicResult` 保持原值 |

#### M8 本轮补充结论

- `2026-04-13` 已追加完成本地前台与生产站点双端复测。
- 本地 `http://localhost:3001/zh` 已验证技能伤害面板真实消费新参数：将“伤害波动 %”改为 `105`、将“法爆率 %”改为 `10` 后，`羊力大仙` 从 `1616` 提升到 `1697`，并出现 `法爆期望 1866.7`。
- 同一轮本地复测继续勾选“开启罗汉减伤”后，`羊力大仙` 进一步降到 `848`，`法爆期望` 变成 `932.8`；详情弹窗同时显示 `罗汉 0.50 / 波动 1.05 / 法爆率 10.0%`。
- 本地复测期间还修复了 [SkillDamagePanel.tsx](/Users/czy/Documents/dream/src/shared/blocks/simulator/CombatPanel/SkillDamagePanel.tsx) 的前台竞态问题，避免旧的试算请求晚返回后把新的页面结果覆盖。
- 生产站点 `https://dream.xiao64702.workers.dev/zh` 已在版本 `fcdd8b5e-a28f-4766-bdcb-c6c00a80167b` 用测试账号 `admin@gmail.com / admin123123` 完成同样闭环：`105` 波动 + `10%` 法爆时 `羊力大仙 = 1697 / 1866.7`，开启罗汉后变为 `848 / 932.8`。
- 线上接口也已同步核对：`POST /api/simulator/calculate-damage = 200`，请求体和返回 breakdown 均包含 `luohanFactor`、`damageVarianceFactor`、`criticalChance`，与页面显示一致。

### 3.9 M9 战斗环境与特殊目标专项测试

本节对应用户新增的 `M9-01 / M9-02 / M9-03 / M9-04 / M9-05 / M9-16`。截至 `2026-04-13`，当前状态如下：

- `M9-01 / M9-02 / M9-03 / M9-04 / M9-05 / M9-16` 已全部补入代码并完成自动化单测验收
- 本组当前主要用于记录“目标模板补齐 + 战斗环境规则扩展”这一轮的最终落地结果

| 编号 | 测试项 | 状态 | 备注 |
| --- | --- | --- | --- |
| `M9-01` | BOSS属性加载 | 测试成功 | 已补 `通天河` fallback 模板，并通过 `mergeDungeonDatabases` 单测确认副本面板可补齐 `灵感大王` 等目标 |
| `M9-02` | 五行相克计算 | 测试成功 | 当前服务端会根据双方五行自动推导 `elementRelation`，并按新口径执行 `克制 +5% / 被克制 -5%` |
| `M9-03` | 目标法防结果 | 测试成功 | `damage-engine` 单测已确认：目标带 `法防结果 +50` 时，最终结果固定额外扣减 `50` |
| `M9-04` | 天气系统联动 | 测试成功 | `damage-engine` 单测已确认：`雨天` 会对龙宫法伤施加 `1.1` 环境倍率 |
| `M9-05` | 目标防御指令 | 测试成功 | `damage-engine` 单测已确认：目标状态记为 `防御` 时，当前龙宫法伤保持原值，breakdown 中显式记录该状态 |
| `M9-16` | 地煞减伤系数 | 测试成功 | `damage-engine` 单测已确认：特殊目标法术减伤系数可压低非结果伤害区间，并进入最终试算 |

#### M9 当前补充结论

- 这组规则已通过 `battleContext.notesJson + damage-engine` 的最小落地方案上线，不需要先做 schema migration。
- 当前已形成一条完整链路：目标模板 fallback、上下文持久化、试算 API、domain 解析、自动化单测。
- `2026-04-13` 已补做本地前台联调：在 `http://127.0.0.1:3000/` 实测确认“战场修正”中的 `雨天 / 防御 / 目标法防结果=50 / 法术减伤系数=0.6` 可成功保存，且会被“查看技能伤害”弹窗默认继承，并在公式详情中显示 `目标法防结果 / 天气 / 目标状态 / 法术减伤系数`；同时“通天河”按钮已能在副本目标面板直接展示 `灵感大王` 等 fallback 目标。

### 3.10 后台测试任务

本节对应最近一轮后台 `Simulator` 功能验收。当前口径统一为：

- 验收时间：`2026-04-12`
- 验收环境：生产后台 `/zh/admin/simulator`
- 测试账号：`admin@gmail.com / admin123123`
- 验收方式：后台页面可访问性 + 关键页面渲染 + 核心 CRUD / 保存动作复核
- 当前结果：`18 / 18` 核心页面与主操作 `测试成功`
- `2026-04-13` 补充复测：已修复 `规则中心 / 装备扩展规则` 中“星相互合”摘要误显示 `0 条` 的线上问题；当前统一改读正式 `star_resonance_rule` 表，线上版本 `d6be7282-c559-4eab-b24b-be98e1d0bba9` 已复测确认两页均显示 `6 条`。

### 3.11 交互体验补丁复测

本节对应最近一轮前台交互体验补丁，主要覆盖“数值变化观感、滑块手感、网络异常提醒、亮色模式可读性”。

| 测试项 | 状态 | 备注 |
| --- | --- | --- |
| 数值变化动画 | 测试成功 | 属性值展示已补充平滑滚动与升降闪烁，差值徽标按 `绿升红降` 过渡 |
| 五围滑块拖动 | 测试成功 | 五围快速加点已切到统一 `Slider` 组件，拖动时按线性渐变轨道实时刷新 |
| 伤害试算响应性 | 测试成功 | 技能伤害面板会中止上一轮未完成请求，只保留最新一次试算结果，避免旧请求回写卡顿 |
| 网络异常提醒 | 测试成功 | 本地浏览器切到 `Offline` 后点击“保存参数”，会立即弹出 `请检查网络` toast，并提示尚未同步到云端 |
| 深浅色适配 | 测试成功 | 本地浏览器切到 `light` 模式后，模拟器外层背景与 toast 已切换为浅色高对比样式，页面文字保持可读 |

#### 新品装备库补测

- 验收时间：`2026-04-13`
- 验收环境：
  - 本地开发站 `http://localhost:3001/zh`
  - 生产站点 `https://dream.xiao64702.workers.dev/zh`
- 验收账号：`admin@gmail.com`
- 验收方式：真实页面操作 + `GET/PATCH /api/simulator/current/candidate-equipment` 直接核对

| 测试项 | 状态 | 备注 |
| --- | --- | --- |
| 待确认库识别 | 测试成功 | 线上真实命中 `POST /api/simulator/current/candidate-equipment/ocr = 200`，识别出 `沧海灵杖 / 法伤 +220 / 命中 +120 / 售价 1880000`，页面出现 `待确认新品 (1)` |
| 属性手动修改 | 测试成功 | 线上待确认弹窗已把名称改为 `沧海灵杖QA`、等级改为 `90`，并命中 `PATCH /api/simulator/current/candidate-equipment = 200`；接口返回 `equipment.name = 沧海灵杖QA`、`equipment.level = 90` |
| 入库审核流程 | 测试成功 | 线上点击 `确认入库` 后，页面显示 `待确认新品 (0)`、`新品装备库 (1)`；接口返回该条记录 `status = confirmed`，并能在“新品装备库 -> 装备 -> 武器”看到 `沧海灵杖QA` |
| 新品装备库批量删除只删除已选记录 | 测试成功 | 先用接口写入 `2` 条 `pending` + `1` 条 `confirmed` 测试数据；页面显示 `待确认新品 (2)`、`新品装备库 (1)`。在“新品装备库”中选择 `API测试武器3` 后点击删除，页面变为 `待确认新品 (2)`、`新品装备库 (0)`，接口返回仅剩 `api-test-1 / api-test-2` 两条 `pending`，确认不会误删待确认数据 |
| 新品装备库批量删除线上回归 | 测试成功 | 旧线上版本曾出现“toast 提示已删除，但 `GET /api/simulator/current/candidate-equipment` 仍返回 `confirmed` 记录”的问题；已在 [index.tsx](/Users/czy/Documents/dream/src/shared/blocks/simulator/LaboratoryPanel/index.tsx) 做最小修补并发布到版本 `018e8565-503a-4060-a10d-c3585cdfde2e`。新版线上复测时，先写入 `1` 条 `pending` + `1` 条 `confirmed` 测试数据，再在“新品装备库”删除 `QA已入库武器`；页面从 `新品装备库 (1)` 变为 `新品装备库 (0)`，随后 `GET` 仅剩 `pending` 记录，确认已真正写回远端 D1 |
| 待确认 50 件预警 | 测试成功 | 本轮本地已确认当待确认数量从 `< 50` 跨到 `>= 50` 时，会出现顶部红色预警 banner，并同步显示 `待确认新品 (50)` |
| 候选装备库测试数据清理 | 测试成功 | 本轮已对远端执行 `PATCH /api/simulator/current/candidate-equipment` 清空临时测试数据，并再次 `GET` 确认返回 `data: []`；远端候选库已恢复为干净状态 |

| 测试项 | 状态 | 备注 |
| --- | --- | --- |
| 后台 simulator 侧边导航可正常展开 | 测试成功 | 已看到 `默认模板 / OCR 配置 / 规则中心 / 星相互合规则` 等菜单 |
| 星相互合规则页可正常打开 | 测试成功 | `/zh/admin/simulator/star-resonance-rules` 已正常加载 |
| 星相互合规则列表可正常显示 | 测试成功 | 已看到 `九龙诀 / 龙腾 / 破浪诀 / 呼风唤雨` 等规则 |
| 星相互合规则编辑表单可正常显示真实数据 | 测试成功 | 已看到 `helmet / 九龙诀 / 白,红,黄,蓝,绿 / fullSetAttributeBonus` 等内容 |
| 星相互合规则保存 | 测试成功 | 已使用管理员账号进入 `/zh/admin/simulator/star-resonance-rules`，将 `seed_star_resonance_helmet_jiulong` 的备注临时改为 `头盔星相互合，命中后法术伤害 +2。QA保存验证` 后保存成功，命中 `PATCH /api/admin/simulator/star-resonance-rules/seed_star_resonance_helmet_jiulong = 200`；随后已恢复原备注并重载确认 |
| 星相互合规则删除 | 测试成功 | 已在后台新建临时规则 `QA删除验证规则0410` 后立即删除，命中 `POST /api/admin/simulator/star-resonance-rules = 200` 与 `DELETE /api/admin/simulator/star-resonance-rules/58a8b594-2c8c-4a0c-b8cd-457ac5e4e618 = 200`，页面提示 `星相互合规则已删除`，列表已恢复原状 |
| 规则中心页面 | 测试成功 | 页面已加载规则版本、修正项 JSON、装备扩展规则配置；线上版本 `ed88e2b8-e52c-44d3-87bb-f3de29ceeba4` 已确认 `damage_v1`、属性转化、技能公式、修正项 JSON 和装备扩展规则配置可显示；`2026-04-13` 在版本 `d6be7282-c559-4eab-b24b-be98e1d0bba9` 追加复测确认“星相互合规则”摘要已正确显示 `6 条规则` |
| 规则试算页面 | 测试成功 | 页面已加载试算表单、版本选择器和样例区 |
| 默认模板管理页 | 测试成功 | 页面已加载默认角色、技能、修炼、装备和战斗参数表单；线上版本 `ed88e2b8-e52c-44d3-87bb-f3de29ceeba4` 复测确认默认装备、灵饰、玉魄与默认战斗参数均可渲染 |
| 目标模板管理页 | 测试成功 | 页面已加载副本目标列表与编辑表单；线上版本 `ed88e2b8-e52c-44d3-87bb-f3de29ceeba4` 复测确认 `车迟国 / 大雁塔 / 水陆大会 / 乌鸡国` 目标模板均可显示 |
| 候选装备库 | 测试成功 | 页面已加载候选装备列表、状态筛选与详情编辑表单 |
| 入库台账 | 测试成功 | 页面可正常打开，当前为空状态但筛选和列表区域已正常渲染 |
| OCR 配置页 | 测试成功 | 页面已加载 Gemini / R2 配置与健康检查结果 |
| OCR 字典页 | 测试成功 | 页面已加载字典类型切换、映射表单与空状态 |
| OCR 任务页 | 测试成功 | 页面可正常打开，当前为空状态但任务筛选区已正常渲染 |
| 实验室记录页 | 测试成功 | 页面已加载实验室会话列表、用户信息和样本席位摘要 |
| 用户排障页 | 测试成功 | 页面已加载用户列表、角色摘要、战斗参数摘要与候选装备摘要；线上版本 `ed88e2b8-e52c-44d3-87bb-f3de29ceeba4` 复测确认 `admin` 用户、当前快照、目标 `万年熊王` 与候选装备摘要可显示 |
| 顾问配置页 | 测试成功 | 页面已加载模型、温度、提示词和启用状态配置 |

### 3.11 本地 / 发布链路测试任务

| 测试项 | 状态 | 备注 |
| --- | --- | --- |
| `pnpm test:simulator` | 测试成功 | `34 / 34` 通过；本轮修复了远端 D1 proxy 抖动后的重试与测试清理 |
| `pnpm build` | 测试成功 | Next.js 16 生产构建通过 |
| `pnpm d1:test -- --db dream --remote` | 测试成功 | 远端 D1 create / insert / select / delete smoke test 通过 |
| `pnpm cf:deploy` 直接发布 | 测试成功 | 已用正确的 `CLOUDFLARE_API_TOKEN / CF_API_TOKEN` 直接发布到线上，最新版本 `fcdd8b5e-a28f-4766-bdcb-c6c00a80167b` |
