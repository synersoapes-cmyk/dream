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
- `2026-04-14` 已完成新一轮生产环境角色导入闭环复测，并已清理联调临时角色与待确认脏数据。
- 技能伤害弹层已经能跟随当前副本目标 / 目标模板联动。
- 顶部 `AccountSwitcher` 已支持云端角色切换、新建、重命名和删除。
- 玉魄百分比属性的服务端试算已覆盖 `法术忽视 %` 与 `基础法术伤害 %` 两类关键规则。
- 生产后台 `/zh/admin/simulator` 最近一轮验收中，`unlabeledCount = 0`、`missingIdOrNameCount = 0`。
- 同一轮后台页面 Lighthouse Accessibility = `100`。
- 最近静态核对确认：用户侧 `Security`、`Feedbacks` 和外围模板文案仍未完成产品化收口。
- 最近本地回归已通过：`pnpm test:simulator` 为 `90 / 90`，`pnpm build` 通过。
- 已确认的最新线上部署版本为 `fcdd8b5e-a28f-4766-bdcb-c6c00a80167b`。
- `2026-04-14` 补充验收版本为 `96416b55-a0cc-450a-8b3d-de2987107a98`。

### 0.2 2026-04-14 线上补充验收

- 验收站点：`https://dream.xiao64702.workers.dev/zh`
- 测试账号：`admin@gmail.com`
- 验收方式：生产站点真实操作 + 实际接口返回 + 当轮数据清理

| 测试项           | 状态     | 备注                                                                                                                                              |
| ---------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| 新建角色弹窗     | 测试成功 | 已在线上打开新建角色弹窗，支持填写角色名、上传人物属性截图、上传装备截图                                                                          |
| 新角色 OCR 导入  | 测试成功 | 使用 `QA多图导入测试` 完成多图导入后，角色按钮切换为新角色，说明 profile OCR 已正确写入新角色                                                     |
| 装备 OCR 归属    | 测试成功 | 新角色导入装备图后，实验室出现 `待确认新品 (1)`，候选装备显示 `沧海灵杖 / 法伤 +220 / 命中 +120`，说明 candidate equipment OCR 已正确写入当前角色 |
| 角色切换恢复     | 测试成功 | 已切回 `测试账号`，首页恢复为既有云端角色数据，右侧继续显示新的“最终面板 + 折叠战斗参数”结构                                                      |
| 临时联调数据清理 | 测试成功 | 已删除临时角色 `QA多图导入测试`；复核 `/api/simulator/characters` 后线上仅剩 `测试账号` 与 `admin的龙宫号` 两个角色                               |

## 3. 2026-04-10 测试任务列表

这份清单用于继续做线上回归与补测，统一约定如下：

- 后台测试账号固定使用：`admin@gmail.com / admin123123`
- 登录动作本轮不计入测试任务，不做通过 / 失败判定
- 状态只按已拿到的实际证据标记：
  - `测试成功`
  - `测试失败`
  - `还没有测试`

### 3.1 前台测试任务

| 测试项                                       | 状态     | 备注                                                                                                                                                                                                                                                                                                                                                                                                 |
| -------------------------------------------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 首页 simulator 可正常加载当前角色与当前装备  | 测试成功 | `Fresh Equip QA`、`Codex Star QA` 两个线上账号都已打开首页并加载云端角色数据                                                                                                                                                                                                                                                                                                                         |
| 默认整套装备角色首次点击“保存装备”           | 测试成功 | `Fresh Equip QA` 已验证，`PATCH /api/simulator/current/equipment = 200`                                                                                                                                                                                                                                                                                                                              |
| 历史老角色带默认整套装备点击“保存装备”       | 测试成功 | `Codex Star QA` 已验证，修复前的 `503` 已消失，当前返回 `200`                                                                                                                                                                                                                                                                                                                                        |
| 多套装备方案保存时不再复用前端临时 `set_1`   | 测试成功 | 远端 D1 已核对，`equipment_plan.id` 为真实 UUID，不再是前端临时 id                                                                                                                                                                                                                                                                                                                                   |
| 装备详情弹窗可正常打开                       | 测试成功 | 已打开 `流云法袍` 详情页                                                                                                                                                                                                                                                                                                                                                                             |
| 护甲部位互合规则可从真实后台读取             | 测试成功 | 页面已显示 `星相互合：法术防御 +2`，并命中 `/api/simulator/star-resonance-rules?slot=armor = 200`                                                                                                                                                                                                                                                                                                    |
| `流云法袍` 的互合配置可保存到云端            | 测试成功 | 已确认 `PATCH /api/simulator/current/equipment = 200`，远端 D1 `equipment_plan_item.payload_json` 包含 `starAlignmentConfig`                                                                                                                                                                                                                                                                         |
| 保存装备后重开 `流云法袍` 详情，互合状态仍在 | 测试成功 | 重新打开后仍显示 `法术防御 +2`                                                                                                                                                                                                                                                                                                                                                                       |
| 伤害试算接口可正常返回                       | 测试成功 | 已点击“查看技能伤害”，`POST /api/simulator/calculate-damage = 200`                                                                                                                                                                                                                                                                                                                                   |
| 伤害试算数值是否与文档黄金样例完全一致       | 测试成功 | 已按当前代码测试里的 `damage_v1 / lg_dragon_roll_v1` 黄金口径做线上接口核对：手动目标 `QA手动目标模板` 返回普通伤害 `706`、总伤 `4942`；副本 `大雁塔` 返回 `万年熊王 / 千年蛇魅 / 护塔灵兽 / 镇塔之神` 总伤分别为 `7 / 7 / 2324 / 1148`；对应 `POST /api/simulator/calculate-damage = 200`                                                                                                           |
| 当前状态里的属性保存                         | 测试成功 | 已将体质 `40 -> 41`，`PATCH /api/simulator/current/profile = 200`，重载后仍显示 `41`，随后已恢复为 `40`                                                                                                                                                                                                                                                                                              |
| 当前状态里的修炼保存                         | 测试成功 | 已将法攻修炼 `20 -> 21`，`PATCH /api/simulator/current/cultivation = 200`，重载后仍显示 `21`，随后已恢复为 `20`                                                                                                                                                                                                                                                                                      |
| 战斗参数保存                                 | 测试成功 | `Codex Star QA` 已验证，`PATCH /api/simulator/current/battle-context = 200`                                                                                                                                                                                                                                                                                                                          |
| 手动目标新增 / 编辑 / 删除                   | 测试成功 | 已确认“新增目标 -> 保存参数 -> 重载后仍在 -> 删除目标 -> 保存参数 -> 重载后消失”闭环成功；本轮又验证“编辑法术伤害 `1234 -> 1250` -> 保存参数 -> 重载后仍为 `1250`”，随后已恢复为 `1234`                                                                                                                                                                                                              |
| 副本目标切换与试算联动                       | 测试成功 | 线上版本 `ed88e2b8-e52c-44d3-87bb-f3de29ceeba4` 已验证：选中 `大雁塔 120级 噩梦` 后点击伤害试算，弹窗显示 `当前目标：大雁塔 - 万年熊王`，并命中 `POST /api/simulator/calculate-damage = 200`                                                                                                                                                                                                         |
| 多角色切换                                   | 测试成功 | 已在 `Codex Star QA的龙宫号` 与临时角色 `Codex Temp Role` 之间双向切换，命中 `GET /api/simulator/current?characterId=... = 200`                                                                                                                                                                                                                                                                      |
| 多角色新建 / 重命名 / 删除                   | 测试成功 | 已验证新建临时角色 `Codex Temp Role` 与删除该角色闭环成功，`POST /api/simulator/characters = 200`、`DELETE /api/simulator/characters/0a165d7c-1047-4fb7-a700-09903acb3670 = 200`；本轮又验证将主角色 `Codex Star QA的龙宫号 -> Codex Star QA改名测试 -> Codex Star QA的龙宫号` 双向重命名，命中 `PATCH /api/simulator/characters/d39b559c-99af-45db-9201-94afc989f82e = 200`，重载后名称仍正确       |
| 灵饰编辑与保存                               | 测试成功 | 已在线上打开 `灵符·潮声` 详情弹窗，将 `法伤 +86 速度 +16` 临时改为 `法伤 +87 速度 +16`，点击弹窗 `保存修改` 后页面卡片同步更新；随后点击 `保存装备`，命中 `PATCH /api/simulator/current/equipment = 200`；验收完成后已恢复原值 `法伤 +86 速度 +16`，并用远端 D1 确认 `equipment_plan_item.payload_json` 中 `trinket:1` 已恢复为 `magicDamage = 86`、`speed = 16`                                     |
| 玉魄编辑与保存                               | 测试成功 | 已在线上打开 `阳玉` 详情弹窗，将 `法伤 +55 速度 +12` 临时改为 `法伤 +56 速度 +12`，点击弹窗 `保存修改` 后页面卡片同步更新；随后点击 `保存装备`，命中 `PATCH /api/simulator/current/equipment = 200`；验收完成后已恢复原值 `法伤 +55 速度 +12`，并用远端 D1 确认 `equipment_plan_item.payload_json` 中 `jade:1` 已恢复为 `magicDamage = 55`、`speed = 12`                                             |
| 实验室入口与实验室页面加载                   | 测试成功 | 已进入实验室，看到样本席位、装备库和属性对比区；线上版本 `ed88e2b8-e52c-44d3-87bb-f3de29ceeba4` 复测确认样本席位可读取 `当前方案`，灵饰 / 玉魄、服务端总伤和目标 `大雁塔 - 万年熊王` 正常显示                                                                                                                                                                                                        |
| 实验室候选装备同步到当前装备                 | 测试成功 | 本轮先通过前台 OCR 上传样本图生成待确认候选 `沧海灵杖`，将候选武器临时改为 `法伤 +221` 后点击 `替换到当前状态`，命中 `PATCH /api/simulator/current/equipment = 200`；页面当前武器文案变为 `法伤 +221 命中 +120`，随后已回滚恢复                                                                                                                                                                      |
| 装备回滚最近一次应用                         | 测试成功 | 在实验室完成一次候选武器替换后，点击 `回滚最近一次应用`，命中 `POST /api/simulator/current/equipment/rollback = 200`；当前武器已恢复为 `法伤 +220 命中 +120`，明细属性中的法术伤害恢复为 `2630`，服务端总伤恢复为 `5263`                                                                                                                                                                             |
| 前台 OCR 上传识别                            | 测试成功 | 已在实验室上传样本图 `[tmp-equipment-weapon-row.png](/Users/czy/Documents/dream/tmp-equipment-weapon-row.png)`，命中 `GET /api/simulator/current/ocr/config = 200` 与 `POST /api/simulator/current/candidate-equipment/ocr = 200`；页面出现 `待确认新品 (1)`，识别出 `沧海灵杖 / 法伤 +220 / 命中 +120 / 售价 1880000`，随后已删除该临时候选                                                         |
| 候选装备库排序 / 筛选 / 批量确认             | 测试成功 | 本轮已执行 `pnpm exec tsc --noEmit` 与 `node --import tsx --test src/shared/lib/simulator-candidate-equipment-view.test.ts src/features/simulator/utils/simulatorCandidateEquipment.test.ts`；确认待确认区和新品装备库都支持按主类 / 部位筛选、按上传时间或总价排序，且待确认区支持多选后批量确认入库                                                                                                |
| 待确认连续审核流                             | 测试成功 | 本轮已执行 `pnpm exec tsc --noEmit` 与 `node --import tsx --test src/features/simulator/utils/simulatorCandidateEquipment.test.ts src/features/simulator/store/gameStore.test.ts src/features/simulator/utils/simulatorBundle.test.ts`；确认待确认详情弹窗支持显示当前筛选序号、上一件 / 下一件，以及“确认并看下一件”，且未破坏现有候选装备持久化链路                                                |
| 角色页 OCR 直达实验室待确认                  | 测试成功 | 本轮已执行 `pnpm exec tsc --noEmit` 与 `node --import tsx --test src/features/simulator/utils/simulatorCandidateEquipment.test.ts src/features/simulator/store/gameStore.test.ts src/features/simulator/utils/simulatorBundle.test.ts src/shared/lib/simulator-candidate-equipment-view.test.ts`；确认角色页“上传装备截图”后的确认弹窗主按钮会切到实验室，并自动命中对应待确认装备的连续审核入口     |
| OCR 并排核图区                               | 测试成功 | 本轮已执行 `pnpm exec tsc --noEmit` 与 `node --import tsx --test src/features/simulator/utils/simulatorCandidateEquipment.test.ts src/features/simulator/store/gameStore.test.ts src/features/simulator/utils/simulatorBundle.test.ts src/shared/lib/simulator-candidate-equipment-view.test.ts`；确认 OCR 确认弹窗和待确认详情都新增了“装备展示图 / OCR 原图”并排核对区，未影响原有候选装备审核链路 |
| AI 顾问页面加载与问答                        | 测试成功 | 已打开 AI 顾问面板，输入框、预设问题和欢迎语均正常显示；线上版本 `ed88e2b8-e52c-44d3-87bb-f3de29ceeba4` 复测确认面板可加载，未发送问题以避免额外消耗 Gemini                                                                                                                                                                                                                                          |
| 移动端首页与装备区渲染                       | 测试成功 | 已在 `390x844` 移动端视口打开 `/zh`，当前状态、装备组合、灵饰和玉魄均可渲染；控制台无报错，最近网络请求未发现 `4xx / 5xx`                                                                                                                                                                                                                                                                            |

### 3.2 OCR 识别引擎专项测试

本节专门对应文档里的 `M2-01 ~ M2-07`。本轮口径统一为：

- 测试环境：生产站点 `https://dream.xiao64702.workers.dev/zh`
- 验收时间：`2026-04-12`
- 验收版本：`1c9c4e2d-0da9-4c1e-b852-bff71bc3424e`
- 测试账号：`admin@gmail.com`
- 验收方式：生产站点真实上传 + 实际接口返回 + 当轮数据清理
- 清理原则：装备 OCR 产生的候选数据当轮即删，不保留远端 D1 脏数据

| 编号    | 测试项         | 状态     | 备注                                                                                                                                                                                                                                                                                                                                                 |
| ------- | -------------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `M2-01` | 项链灵力捕获   | 测试成功 | 线上真实命中 `POST /api/simulator/current/candidate-equipment/ocr = 200`；临时项链图识别出 `灵力 +235`，返回 `stats.magicPower = 235`，随后已删除该候选装备                                                                                                                                                                                          |
| `M2-02` | 熔炼属性识别   | 测试成功 | 本轮先发现线上旧版本会把 `防御 +180(+12)` 识别成 `defense = 180` 与 `forgeLevel = 12`；已在 [simulator-ocr.ts](/Users/czy/Documents/dream/src/shared/services/simulator-ocr.ts) 补最小后处理并重新发布。最新版线上复测 `POST /api/simulator/current/candidate-equipment/ocr = 200`，返回 `stats.defense = 192`、`magicDefense = 105`，候选数据已删除 |
| `M2-03` | 特效关键字提取 | 测试成功 | 临时项链图识别出 `无级别限制`、`神农`，返回同时写入 `highlights` 与 `specialEffect`                                                                                                                                                                                                                                                                  |
| `M2-04` | 灵饰属性分类   | 测试成功 | 临时戒指图识别为 `type = trinket`、`slot = 1`，主属性 `防御 +28`，下排两条 `法伤 +16` 合并为 `stats.defense = 28`、`stats.magicDamage = 32`                                                                                                                                                                                                          |
| `M2-05` | 移动端适配     | 测试成功 | 使用黑底移动端风格属性长图命中 `POST /api/simulator/current/profile/ocr = 200`，识别出 `89 / 龙宫 / 40 / 210 / 20 / 30 / 25 / 1460 / 540 / 990`；测试后已用 `PATCH /api/simulator/current/profile = 200` 恢复角色原值                                                                                                                                |
| `M2-06` | 图片自动分发   | 测试成功 | 前台“上传属性截图”真实命中 `/api/simulator/current/profile/ocr`；实验室“上传装备截图”真实命中 `/api/simulator/current/candidate-equipment/ocr`，分流正常                                                                                                                                                                                             |
| `M2-07` | 错误图片容错   | 测试成功 | 上传非游戏风景图后，线上接口返回 `code = -1`、`message = 未检测到游戏组件`                                                                                                                                                                                                                                                                           |

### 3.3 M3 属性转化与加点专项测试

本节对应用户补充的 `M3-01 ~ M3-08`。本轮口径统一为：

- 验收时间：`2026-04-12`
- 验收方式：前台单测 + 线上页面闭环 + 远端 D1 核对
- 备注：本节优先判断“规则和闭环是否已经真实存在”，不是只看字段是否预留

| 编号    | 测试项       | 状态     | 备注                                                                                                                                                                                                                                                                          |
| ------- | ------------ | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `M3-01` | 魔力转化率   | 测试成功 | 前台 [gameLogic.ts](/Users/czy/Documents/dream/src/features/simulator/store/gameLogic.ts) 已补前端回归测试，确认 `1 魔力 = 魔法 +3.5、法伤 +0.7、法防 +0.7`；见 [gameLogic.test.ts](/Users/czy/Documents/dream/src/features/simulator/store/gameLogic.test.ts)                |
| `M3-02` | 力量转化率   | 测试成功 | 本轮已补前台回归测试，确认 `1 力量 = 命中 +1.7、法伤 +0.4、法防 +0.4、速度 +0.1`；见 [gameLogic.test.ts](/Users/czy/Documents/dream/src/features/simulator/store/gameLogic.test.ts)                                                                                           |
| `M3-03` | 耐力物防转化 | 测试成功 | 本轮已补前台回归测试，确认 `1 耐力 = 物防 +1.6、法伤 +0.2、法防 +0.2、速度 +0.1`；前后端规则种子仍统一落在 [scripts/init-damage-rules.ts](/Users/czy/Documents/dream/scripts/init-damage-rules.ts)                                                                            |
| `M3-04` | 体质法防转化 | 测试成功 | 本轮已补前台回归测试，确认 `1 体质 = 气血 +4.5、法伤 +0.3、法防 +0.3、速度 +0.1`；见 [gameLogic.test.ts](/Users/czy/Documents/dream/src/features/simulator/store/gameLogic.test.ts)                                                                                           |
| `M3-05` | 敏捷速度转化 | 测试成功 | 本轮已补前台回归测试，确认 `1 敏捷 = 速度 +0.7`，并继续保留 `躲避 +1`；见 [gameLogic.test.ts](/Users/czy/Documents/dream/src/features/simulator/store/gameLogic.test.ts)                                                                                                      |
| `M3-06` | 潜力点分配   | 测试成功 | 当前状态页已补出“快速加点”区，支持拖动滑杆分配当前潜力点，并提供“一键全魔”；store 单测已验证 `10` 点潜力全加魔力后，面板 `魔法 +35 / 法伤 +7 / 法防 +7` 即时联动，见 [gameStore.test.ts](/Users/czy/Documents/dream/src/features/simulator/store/gameStore.test.ts)           |
| `M3-07` | 强身倍率联动 | 测试成功 | 当前状态页已补出“强身”修炼项，并打通 `/api/simulator/current/cultivation` 保存链路；本轮已完成“保存修炼 -> 强刷刷新 -> 页面复核 -> 远端 D1 复核”的线上闭环，确认 `强身 = 20` 时 `气血 = 4620` 保持稳定。期间还修复了 `baseHp` 在保存 profile 时误吃强身倍率导致的二次放大问题 |
| `M3-08` | 经脉属性补偿 | 测试成功 | 当前状态页已补出“经脉补偿”区，支持以结构化配置录入 `体质 / 魔力 / 力量 / 耐力 / 敏捷 / 灵力` 加成；本轮已完成线上即时联动与保存闭环，确认 `经脉魔力 10 -> 11` 时，页面即时变成 `法术伤害 1136 -> 1137`、`灵力 180 -> 181`、`法术防御 487 -> 488`，保存并刷新后仍保持正确      |

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

| 编号    | 测试项         | 状态             | 备注                                                                                                                                                                                                                                                                                                           |
| ------- | -------------- | ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `M4-01` | 门派组合唯一性 | 测试成功         | 已在 [damage-engine.test.ts](/Users/czy/Documents/dream/src/shared/services/damage-engine.test.ts) 新增“2 件 `九龙诀` 仅取最高一套”回归；当前规则仍按 `globalMaxActive = 1` 收口，不会重复叠加技能等级                                                                                                         |
| `M4-02` | 隔山打牛上限   | 测试成功         | 既有服务端测试已覆盖“穿 3 件仅按 2 套生效”，见 [damage-engine.test.ts](/Users/czy/Documents/dream/src/shared/services/damage-engine.test.ts) 中 `caps 隔山打牛 panel bonuses at two active sets`                                                                                                               |
| `M4-03` | 星石共鸣触发   | 测试成功         | 既有服务端测试已覆盖 6 件严格命中后的 `fullSetActive = true`、`fullSetAttributeBonus = 2` 与五围来源加成，见 [damage-engine.test.ts](/Users/czy/Documents/dream/src/shared/services/damage-engine.test.ts)                                                                                                     |
| `M4-04` | 武器法伤转换   | 测试成功         | 前台 [gameLogic.ts](/Users/czy/Documents/dream/src/features/simulator/store/gameLogic.ts) 已补入“武器伤害 / 4 -> 面板法伤”口径，并在 [gameLogic.test.ts](/Users/czy/Documents/dream/src/features/simulator/store/gameLogic.test.ts) 增加断言                                                                   |
| `M4-05` | 灵饰套装联动   | 测试成功         | 已在 [damage-engine.test.ts](/Users/czy/Documents/dream/src/shared/services/damage-engine.test.ts) 新增“4 件 4 级 `健步如飞` => 速度面板 +30”回归，验证档位命中和面板速度联动                                                                                                                                  |
| `M4-06` | 玉魄实时生效   | 测试成功         | 已在 [gameLogic.test.ts](/Users/czy/Documents/dream/src/features/simulator/store/gameLogic.test.ts) 补“阳玉法暴等级即时跳动”断言，当前前台面板会立即汇总 `magicCritLevel`                                                                                                                                      |
| `M4-07` | 开孔状态校验   | 测试成功         | [RuneStoneHelper.ts](/Users/czy/Documents/dream/src/shared/blocks/simulator/EquipmentPanel/RuneStoneHelper.ts) 现已把 `luckyHoles = 0` 或无激活符石的组合显示为 `未激活`，并在 [RuneStoneHelper.test.ts](/Users/czy/Documents/dream/src/shared/blocks/simulator/EquipmentPanel/RuneStoneHelper.test.ts) 补回归 |
| `M4-08` | 套装阶梯属性   | 已补临时规则定义 | 当前先按“动物套 / 变身套”处理，固定为 `3 件` 与 `5 件` 两档；本期只处理 `魔力` 阶梯增益，临时口径为 `3 件 +10 魔力`、`5 件 +20 魔力`，并要求同时进入当前装备面板、实验室对比和服务端伤害试算                                                                                                                   |
| `M4-09` | 双加属性统计   | 测试成功         | 已新增 [simulator-extra-attribute-summary.ts](/Users/czy/Documents/dream/src/shared/lib/simulator-extra-attribute-summary.ts) 汇总工具和对应测试；当前装备页与实验室席位都已开始显示 6 件装备双加汇总（如 `魔力 +24 / 耐力 +21`）                                                                              |

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

| 编号    | 测试项                     | 状态     | 备注                                                                                                                                          |
| ------- | -------------------------- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `M5-01` | 符石组合有效性             | 测试成功 | 武器位错误识别 `九龙诀` 时，只识别颜色，不会激活技能等级                                                                                      |
| `M5-02` | 符石组合有效性             | 测试成功 | 两件 `呼风唤雨 +6` 仅生效一件，服务端只保留一条 bonus rule                                                                                    |
| `M5-03` | 符石组合有效性             | 测试成功 | `3 孔 + 4 颗符石` 会按前三孔截断，并降成低阶组合                                                                                              |
| `M5-04` | 符石组合有效性             | 测试成功 | 第三套 `隔山打牛` 已在日志中标记 `超出上限失效`                                                                                               |
| `M5-05` | 符石组合有效性             | 测试成功 | `招云` 鞋子首孔颜色错误后，全套 `+6 灵力` 与速度追加伤害一起消失                                                                              |
| `M5-06` | 九龙诀 - 属性联动          | 测试成功 | 当前状态与实验室明细属性已接入 `九龙诀` 的符石额外等级差值；命中 `+6` 时会同步抬升 `灵力 / 法伤 / 法防`，并按云端基准装备避免重复叠加         |
| `M5-07` | 呼风唤雨 - 目标数校验      | 测试成功 | 实验室目标选择器与正式“技能伤害”面板都已按符石后的 `龙卷雨击` 最终等级动态刷新秒几上限；跨 `150` 门槛时会出现 `秒7`，失去加成后会回落到 `秒6` |
| `M5-08` | 位置错误拦截               | 测试成功 | 鞋子位 `九龙诀` 仍只算单颗符石属性，不激活技能等级                                                                                            |
| `M5-09` | 隔山打牛 - 叠加上限        | 测试成功 | 3 套仍只按 2 套进入伤害模拟与 breakdown                                                                                                       |
| `M5-10` | 龙腾 - 伤害期望计算        | 测试成功 | `龙腾 +6` 已补显式回归，确认单体伤害明显抬升                                                                                                  |
| `M5-11` | 符石等级降级测试           | 测试成功 | 五色改三色后，会从 `+6` 自动降为 `+2`                                                                                                         |
| `M5-12` | 招云 / 腾蛟 - 全身套装识别 | 测试成功 | 现已分别补齐 `招云` 与 `腾蛟` 的显式专项回归；`招云` 会命中 `+6 灵力 + 目标速度 * 4%`，`腾蛟` 会命中 `+6 灵力 + 龙腾魔法消耗 * 4%`            |
| `M5-13` | 技能等级跌落预警           | 测试成功 | 实验室“应用到当前装备”前已升级为统一预警框；当 `破浪诀 / 呼风唤雨 / 龙腾 / 九龙诀 / 逆鳞` 跌落时，会在确认弹窗里直接提示风险与生效后等级      |
| `M5-14` | 隔山打牛 - 灵力转化        | 测试成功 | `70 灵力` 已确认会同步进入法伤 / 法防                                                                                                         |
| `M5-15` | 符石颜色 / 孔数冲突        | 测试成功 | 当前装备详情、实验室装备详情与“应用到当前装备”确认框都已显示逻辑冲突提示，并继续强制按孔数上限截断降级计算                                    |
| `M5-16` | 等级跌落逻辑               | 测试成功 | 实验室除了席位卡红字外，现已补成统一警告框；卸下或替换符石导致的技能等级跌落会在应用前再次确认                                                |
| `M5-17` | 被动加成识别               | 测试成功 | 已补专项回归，确认“技能自带灵力”继续以内置面板基线为准；当前试算仅追加 `九龙诀` 符石带来的额外等级差值，不会把基线收益再算一遍                |
| `M5-18` | 组合颜色容错               | 测试成功 | 改错颜色后，技能等级会即时归零                                                                                                                |

### 3.6 M6 实验室对比与替换决策专项测试

本节对应用户补充的 `M6-01 / M6-02 / M6-03 / M6-04 / M6-05 / M6-06 / M6-17`。本轮口径统一为：

- 验收时间：`2026-04-12`
- 验收方式：生产站点真实页面复测 + 线上接口回写 + 代码链路核对
- 验收站点：`https://dream.xiao64702.workers.dev/zh`
- 测试账号：`admin@gmail.com`
- 清理原则：本轮为验收临时改动的项链数值、实验室席位和候选装备脏数据，已在收尾阶段恢复

| 编号    | 测试项         | 状态     | 备注                                                                                                                                                                                                                                                                                                                                                                               |
| ------- | -------------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `M6-01` | 样本位锁定     | 测试成功 | 线上已确认实验室继续固定“样本席位优先”；当前代码已通过 [simulatorExperimentSeats.ts](/Users/czy/Documents/dream/src/features/simulator/utils/simulatorExperimentSeats.ts) 与 [gameStore.test.ts](/Users/czy/Documents/dream/src/features/simulator/store/gameStore.test.ts) 锁住样本席位不可替换，同时当前正式口径只保留 `1` 个对比席位                                            |
| `M6-02` | 属性差值表格   | 测试成功 | 本轮在线上将对比席位项链临时从 `法伤 +128 魔力 +28` 调整到 `法伤 +138 魔力 +28`，实验室“明细属性对比”里已看到 `法术伤害 1136 -> 1146` 与 `+10` 差值，同时席位卡“属性及伤害变化”同步出现 `法伤: +10`                                                                                                                                                                                |
| `M6-03` | 涨跌颜色渲染   | 测试成功 | 本轮线上已复现正向差值节点；代码里差值节点明确使用 [LaboratoryComparisonTable.tsx](/Users/czy/Documents/dream/src/shared/blocks/simulator/LaboratoryPanel/LaboratoryComparisonTable.tsx) 的 `text-green-400 / text-red-400`，席位卡 [LaboratorySeatCard.tsx](/Users/czy/Documents/dream/src/shared/blocks/simulator/LaboratoryPanel/LaboratorySeatCard.tsx) 也走同样的绿升红降口径 |
| `M6-04` | 继承模拟测试   | 测试成功 | 已补自动化闭环回归：白板装备在“继承旧宝石”时会沿用老段数并真实抬升 `灵力 / 法伤`，在“继承旧符石”时会沿用旧符石属性并进入实验室总属性与面板计算；见 [laboratory-utils.test.ts](/Users/czy/Documents/dream/src/shared/blocks/simulator/LaboratoryPanel/laboratory-utils.test.ts)                                                                                                     |
| `M6-05` | 伤害差额显示   | 测试成功 | 实验室席位卡底部现已把绝对收益做成独立结果项，固定显示如“`伤害提升：+125点` / `伤害下降：-17点`”，并配套 `收益摘要 + 总伤增益百分比 + 1 点法伤成本`，便于快速做替换决策                                                                                                                                                                                                            |
| `M6-06` | 对比位横向对比 | 测试成功 | 实验室当前正式支持 `样本席位 + 1 个对比席位`；当前前台、store、云端实验室会话恢复与顾问上下文都已统一按这条正式口径收口                                                                                                                                                                                                                                                            |
| `M6-17` | 替换决策确认   | 测试成功 | 本轮已在线上完成“对比席位项链 +10 法伤 -> 点击 `应用` -> 弹出 `确认覆盖当前装备` -> `确认覆盖` -> 回到当前状态页复核”的闭环；当前状态页项链文案曾成功变为 `法伤 +138 魔力 +28`，面板法伤同步 `1136 -> 1146`，随后已恢复原值                                                                                                                                                        |

#### M6 本轮补充结论

- 当前 `M6` 共 `7` 项里，已完成 `7 / 7` 自动化或线上验收，当前这组主链已收口。
- 本轮额外发现一个线上问题：前台“待确认新品 -> 确认入库”后，候选装备状态在前台列表里仍可能回落为 `pending`，导致通过“装备库选择器”做人工挂载不稳定；本轮 `M6-02 / M6-17` 的线上验收因此改为直接复用云端实验室席位数据做闭环验证。

### 3.7 M7 性价比决策专项测试

本节对应用户新增的 `M7-01 / M7-02 / M7-03`。截至 `2026-04-13`，本轮实现与测试结论如下：

| 编号    | 测试项       | 状态     | 备注                                                                                                                                                                                                                                                                                                                   |
| ------- | ------------ | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `M7-01` | 单点提升成本 | 测试成功 | 实验室席位卡与“明细属性对比”表都已统一展示 `1 点法伤成本`，口径为 `差价 / 法伤提升`                                                                                                                                                                                                                                    |
| `M7-02` | 跨服费计算   | 测试成功 | 实验室本地总价与服务端估值 fallback 现已统一把 `售价 + 跨服费` 作为总价格；相关回归已覆盖 [laboratory-utils.test.ts](/Users/czy/Documents/dream/src/shared/blocks/simulator/LaboratoryPanel/laboratory-utils.test.ts) 与 [lab-valuation.test.ts](/Users/czy/Documents/dream/src/shared/services/lab-valuation.test.ts) |
| `M7-03` | 边际效益评估 | 测试成功 | 当前当 `多花 >= 5000` 且 `法伤仅提升 <= 2` 时，会在实验室席位卡和对比表直接显示“低性比”提醒，便于阻止高价低提升的替换决策                                                                                                                                                                                              |

#### M7 本轮补充结论

- 性价比链路现已补齐“跨服费并入总价”“1 点法伤成本”“低性比提醒”三项缺口。
- 当前规则仍是第一版执行阈值；若后续需要按装备部位、总伤百分比或人民币预算分档，再在此基础上继续细化。

### 3.8 M8 伤害细则专项测试

本节对应用户新增的 `M8-01 ~ M8-08`。截至 `2026-04-13`，本轮口径统一为：

- 验收方式：服务端伤害引擎单测 + 本地前台页面闭环 + 生产站点真实页面闭环
- 验收命令：`pnpm exec tsx --test src/shared/services/damage-engine.test.ts`
- 本轮结果：`M8-01 ~ M8-08` 共 `8 / 8` 测试成功；同时确认整份 [damage-engine.test.ts](/Users/czy/Documents/dream/src/shared/services/damage-engine.test.ts) 当前 `50 / 50` 通过

| 编号    | 测试项       | 状态     | 备注                                                                                                                                                                                                                   |
| ------- | ------------ | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `M8-01` | 基础对冲公式 | 测试成功 | 已在 [damage-engine.test.ts](/Users/czy/Documents/dream/src/shared/services/damage-engine.test.ts) 新增“法伤被完全对冲时仍保底 `1` 点伤害”回归，确认 `rawDamage < 0` 时最终仍会被钳到 `1`                              |
| `M8-02` | 分灵系数阶梯 | 测试成功 | 已补“`1.0 -> 0.54` 阶梯曲线”回归；同时修复 [damage-engine.ts](/Users/czy/Documents/dream/src/shared/services/damage-engine.ts) 里 `5+` 档位一刀切的问题，当前若 lookup 存在 `5 / 6 / 7` 精确档位，会优先按精确档位消费 |
| `M8-03` | 修炼压制计算 | 测试成功 | 已补 `25 修 vs 10 抗 = 35%` 放大量级样例；当前通过构造 `rawDamageBeforeVariance = 1500 -> 2025` 的精确样本，确认服务端公式可命中该口径                                                                                 |
| `M8-04` | 阵法增益计算 | 测试成功 | 已补“阵法系数 `1.3` 时非结果部分同步放大 `1.3x`”回归，确认伤害引擎对 `formationFactor` 的消费稳定                                                                                                                      |
| `M8-05` | 变身卡增益   | 测试成功 | 已补“魔之心卡 `1.2x` 只放大非结果部分”回归，确认 `magicResult` 不参与该乘区                                                                                                                                            |
| `M8-06` | 法爆期望计算 | 测试成功 | 已为伤害引擎新增 `criticalChance / criticalExpectationMultiplier` 的测试入口，当前 `10%` 法爆可输出 `+10%` 的长期期望伤害                                                                                              |
| `M8-07` | 随机波动模拟 | 测试成功 | 已为伤害引擎新增 `damageVarianceFactor` 测试入口，并补 `10` 组 `95% ~ 105%` 样本，确认波动因子会稳定进入最终伤害                                                                                                       |
| `M8-08` | 罗汉强制减伤 | 测试成功 | 已为伤害引擎新增 `luohanFactor` 测试入口，确认开启罗汉时只缩小非结果部分到 `0.5`，`magicResult` 保持原值                                                                                                               |

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

| 编号    | 测试项       | 状态     | 备注                                                                                                 |
| ------- | ------------ | -------- | ---------------------------------------------------------------------------------------------------- |
| `M9-01` | BOSS属性加载 | 测试成功 | 已补 `乌鸡国 / 水陆大会 / 车迟国 / 大雁塔 / 通天河 / 平顶山 / 红孩儿 / 齐天大圣 / 石猴授徒` fallback 模板，并通过 `mergeDungeonDatabases` 与模板覆盖单测确认副本面板可补齐 `灵感大王 / 金角大王 / 红孩儿 / 齐天大圣 / 灵明石猴` 等目标 |
| `M9-02` | 五行相克计算 | 测试成功 | 当前服务端会根据双方五行自动推导 `elementRelation`，并按新口径执行 `克制 +5% / 被克制 -5%`           |
| `M9-03` | 目标法防结果 | 测试成功 | `damage-engine` 单测已确认：目标带 `法防结果 +50` 时，最终结果固定额外扣减 `50`                      |
| `M9-04` | 天气系统联动 | 测试成功 | `damage-engine` 单测已确认：`雨天` 会对龙宫法伤施加 `1.1` 环境倍率                                   |
| `M9-05` | 目标防御指令 | 测试成功 | `damage-engine` 单测已确认：目标状态记为 `防御` 时，当前龙宫法伤保持原值，breakdown 中显式记录该状态 |
| `M9-16` | 地煞减伤系数 | 测试成功 | `damage-engine` 单测已确认：特殊目标法术减伤系数可压低非结果伤害区间，并进入最终试算                 |

#### M9 当前补充结论

- 这组规则已通过 `battleContext.notesJson + damage-engine` 的最小落地方案上线，不需要先做 schema migration。
- 当前已形成一条完整链路：目标模板 fallback、上下文持久化、试算 API、domain 解析、自动化单测。
- `2026-04-13` 已补做本地前台联调：在 `http://127.0.0.1:3000/` 实测确认“战场修正”中的 `雨天 / 防御 / 目标法防结果=50 / 法术减伤系数=0.6` 可成功保存，且会被“查看技能伤害”弹窗默认继承，并在公式详情中显示 `目标法防结果 / 天气 / 目标状态 / 法术减伤系数`；当前副本目标面板已能直接展示 `通天河 / 平顶山 / 红孩儿 / 齐天大圣 / 石猴授徒` 等 fallback 目标。

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

| 测试项         | 状态     | 备注                                                                                           |
| -------------- | -------- | ---------------------------------------------------------------------------------------------- |
| 数值变化动画   | 测试成功 | 属性值展示已补充平滑滚动与升降闪烁，差值徽标按 `绿升红降` 过渡                                 |
| 五围滑块拖动   | 测试成功 | 五围快速加点已切到统一 `Slider` 组件，拖动时按线性渐变轨道实时刷新                             |
| 伤害试算响应性 | 测试成功 | 技能伤害面板会中止上一轮未完成请求，只保留最新一次试算结果，避免旧请求回写卡顿                 |
| 网络异常提醒   | 测试成功 | 本地浏览器切到 `Offline` 后点击“保存参数”，会立即弹出 `请检查网络` toast，并提示尚未同步到云端 |
| 深浅色适配     | 测试成功 | 本地浏览器切到 `light` 模式后，模拟器外层背景与 toast 已切换为浅色高对比样式，页面文字保持可读 |

#### 新品装备库补测

- 验收时间：`2026-04-13`
- 验收环境：
  - 本地开发站 `http://localhost:3001/zh`
  - 生产站点 `https://dream.xiao64702.workers.dev/zh`
- 验收账号：`admin@gmail.com`
- 验收方式：真实页面操作 + `GET/PATCH /api/simulator/current/candidate-equipment` 直接核对

| 测试项                           | 状态     | 备注                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| -------------------------------- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 待确认库识别                     | 测试成功 | 线上真实命中 `POST /api/simulator/current/candidate-equipment/ocr = 200`，识别出 `沧海灵杖 / 法伤 +220 / 命中 +120 / 售价 1880000`，页面出现 `待确认新品 (1)`                                                                                                                                                                                                                                                                                                                                             |
| 属性手动修改                     | 测试成功 | 线上待确认弹窗已把名称改为 `沧海灵杖QA`、等级改为 `90`，并命中 `PATCH /api/simulator/current/candidate-equipment = 200`；接口返回 `equipment.name = 沧海灵杖QA`、`equipment.level = 90`                                                                                                                                                                                                                                                                                                                   |
| 入库审核流程                     | 测试成功 | 线上点击 `确认入库` 后，页面显示 `待确认新品 (0)`、`新品装备库 (1)`；接口返回该条记录 `status = confirmed`，并能在“新品装备库 -> 装备 -> 武器”看到 `沧海灵杖QA`                                                                                                                                                                                                                                                                                                                                           |
| 新品装备库批量删除只删除已选记录 | 测试成功 | 先用接口写入 `2` 条 `pending` + `1` 条 `confirmed` 测试数据；页面显示 `待确认新品 (2)`、`新品装备库 (1)`。在“新品装备库”中选择 `API测试武器3` 后点击删除，页面变为 `待确认新品 (2)`、`新品装备库 (0)`，接口返回仅剩 `api-test-1 / api-test-2` 两条 `pending`，确认不会误删待确认数据                                                                                                                                                                                                                      |
| 新品装备库批量删除线上回归       | 测试成功 | 旧线上版本曾出现“toast 提示已删除，但 `GET /api/simulator/current/candidate-equipment` 仍返回 `confirmed` 记录”的问题；已在 [index.tsx](/Users/czy/Documents/dream/src/shared/blocks/simulator/LaboratoryPanel/index.tsx) 做最小修补并发布到版本 `018e8565-503a-4060-a10d-c3585cdfde2e`。新版线上复测时，先写入 `1` 条 `pending` + `1` 条 `confirmed` 测试数据，再在“新品装备库”删除 `QA已入库武器`；页面从 `新品装备库 (1)` 变为 `新品装备库 (0)`，随后 `GET` 仅剩 `pending` 记录，确认已真正写回远端 D1 |
| 待确认 50 件预警                 | 测试成功 | 本轮本地已确认当待确认数量从 `< 50` 跨到 `>= 50` 时，会出现顶部红色预警 banner，并同步显示 `待确认新品 (50)`                                                                                                                                                                                                                                                                                                                                                                                              |
| 候选装备库测试数据清理           | 测试成功 | 本轮已对远端执行 `PATCH /api/simulator/current/candidate-equipment` 清空临时测试数据，并再次 `GET` 确认返回 `data: []`；远端候选库已恢复为干净状态                                                                                                                                                                                                                                                                                                                                                        |

| 测试项                                 | 状态     | 备注                                                                                                                                                                                                                                                                                                          |
| -------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 后台 simulator 侧边导航可正常展开      | 测试成功 | 已看到 `默认模板 / OCR 配置 / 规则中心 / 星相互合规则` 等菜单                                                                                                                                                                                                                                                 |
| 星相互合规则页可正常打开               | 测试成功 | `/zh/admin/simulator/star-resonance-rules` 已正常加载                                                                                                                                                                                                                                                         |
| 星相互合规则列表可正常显示             | 测试成功 | 已看到 `九龙诀 / 龙腾 / 破浪诀 / 呼风唤雨` 等规则                                                                                                                                                                                                                                                             |
| 星相互合规则编辑表单可正常显示真实数据 | 测试成功 | 已看到 `helmet / 九龙诀 / 白,红,黄,蓝,绿 / fullSetAttributeBonus` 等内容                                                                                                                                                                                                                                      |
| 星相互合规则保存                       | 测试成功 | 已使用管理员账号进入 `/zh/admin/simulator/star-resonance-rules`，将 `seed_star_resonance_helmet_jiulong` 的备注临时改为 `头盔星相互合，命中后法术伤害 +2。QA保存验证` 后保存成功，命中 `PATCH /api/admin/simulator/star-resonance-rules/seed_star_resonance_helmet_jiulong = 200`；随后已恢复原备注并重载确认 |
| 星相互合规则删除                       | 测试成功 | 已在后台新建临时规则 `QA删除验证规则0410` 后立即删除，命中 `POST /api/admin/simulator/star-resonance-rules = 200` 与 `DELETE /api/admin/simulator/star-resonance-rules/58a8b594-2c8c-4a0c-b8cd-457ac5e4e618 = 200`，页面提示 `星相互合规则已删除`，列表已恢复原状                                             |
| 规则中心页面                           | 测试成功 | 页面已加载规则版本、修正项 JSON、装备扩展规则配置；线上版本 `ed88e2b8-e52c-44d3-87bb-f3de29ceeba4` 已确认 `damage_v1`、属性转化、技能公式、修正项 JSON 和装备扩展规则配置可显示；`2026-04-13` 在版本 `d6be7282-c559-4eab-b24b-be98e1d0bba9` 追加复测确认“星相互合规则”摘要已正确显示 `6 条规则`               |
| 规则试算页面                           | 测试成功 | 页面已加载试算表单、版本选择器和样例区                                                                                                                                                                                                                                                                        |
| 默认模板管理页                         | 测试成功 | 页面已加载默认角色、技能、修炼、装备和战斗参数表单；线上版本 `ed88e2b8-e52c-44d3-87bb-f3de29ceeba4` 复测确认默认装备、灵饰、玉魄与默认战斗参数均可渲染                                                                                                                                                        |
| 目标模板管理页                         | 测试成功 | 页面已加载副本目标列表与编辑表单；线上版本 `ed88e2b8-e52c-44d3-87bb-f3de29ceeba4` 复测确认 `车迟国 / 大雁塔 / 水陆大会 / 乌鸡国` 目标模板均可显示                                                                                                                                                             |
| 候选装备库                             | 测试成功 | 页面已加载候选装备列表、状态筛选与详情编辑表单                                                                                                                                                                                                                                                                |
| 入库台账                               | 测试成功 | 页面可正常打开，当前为空状态但筛选和列表区域已正常渲染                                                                                                                                                                                                                                                        |
| OCR 配置页                             | 测试成功 | 页面已加载 Gemini / R2 配置与健康检查结果                                                                                                                                                                                                                                                                     |
| OCR 字典页                             | 测试成功 | 页面已加载字典类型切换、映射表单与空状态                                                                                                                                                                                                                                                                      |
| OCR 任务页                             | 测试成功 | 页面可正常打开，当前为空状态但任务筛选区已正常渲染                                                                                                                                                                                                                                                            |
| 实验室记录页                           | 测试成功 | 页面已加载实验室会话列表、用户信息和样本席位摘要                                                                                                                                                                                                                                                              |
| 用户排障页                             | 测试成功 | 页面已加载用户列表、角色摘要、战斗参数摘要与候选装备摘要；线上版本 `ed88e2b8-e52c-44d3-87bb-f3de29ceeba4` 复测确认 `admin` 用户、当前快照、目标 `万年熊王` 与候选装备摘要可显示                                                                                                                               |
| 顾问配置页                             | 测试成功 | 页面已加载模型、温度、提示词和启用状态配置                                                                                                                                                                                                                                                                    |

### 3.11 本地 / 发布链路测试任务

| 测试项                                | 状态     | 备注                                                                                                             |
| ------------------------------------- | -------- | ---------------------------------------------------------------------------------------------------------------- |
| `pnpm test:simulator`                 | 测试成功 | `90 / 90` 通过；当前已覆盖装备方案、实验室、伤害规则、OCR 标准化、目标模板与当前状态页 hydrate 主链              |
| `pnpm build`                          | 测试成功 | Next.js 16 生产构建通过                                                                                          |
| `pnpm d1:test -- --db dream --remote` | 测试成功 | 远端 D1 create / insert / select / delete smoke test 通过                                                        |
| `pnpm cf:deploy` 直接发布             | 测试成功 | 已用正确的 `CLOUDFLARE_API_TOKEN / CF_API_TOKEN` 直接发布到线上，最新版本 `fcdd8b5e-a28f-4766-bdcb-c6c00a80167b` |

### 3.12 2026-04-14 当前状态页结构调整回归

| 测试项                                            | 状态     | 备注                                                                                                                                                      |
| ------------------------------------------------- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 装备方案切换区去掉左右移动按钮后的编译回归        | 测试成功 | 已执行 `pnpm exec tsc --noEmit`，通过；本轮只保留 `切换 / 复制 / 重命名 / 删除` 交互，不再依赖悬停浮层里的左右移动按钮                                    |
| 当前状态页右侧“最终面板摘要 + 战斗参数折叠区”回归 | 测试成功 | 已执行 `pnpm test:simulator`，本轮为 `90 / 90` 通过；确认 store、装备方案、战斗上下文与派生面板相关单测未受布局调整影响                                   |
| 本地浏览器基础可达性检查                          | 部分验证 | 本地 `Next.js dev` 已启动并可打开 `/zh`；由于当前本地浏览器无登录会话，只验证到登录态前页面可正常加载，登录后的模拟器主界面仍需在已登录环境补一轮交互验收 |

### 3.13 2026-04-14 新建角色多图导入基础流回归

| 测试项                         | 状态       | 备注                                                                                                                                               |
| ------------------------------ | ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| 新建角色弹窗与多图导入类型回归 | 测试成功   | 已执行 `pnpm exec tsc --noEmit`，通过；确认 `AccountSwitcher` 新弹窗、批量图片状态与 OCR 导入流程无类型错误                                        |
| 多角色 OCR 接口改造回归        | 测试成功   | 已执行 `pnpm test:simulator`，本轮仍为 `90 / 90` 通过；确认 `characterId` 扩展未影响现有装备方案、试算与 OCR 标准化测试                            |
| 角色导入浏览器联调             | 还没有测试 | 本轮先完成代码与编译回归；由于当前本地浏览器没有登录会话，还没有在真实登录态下完成“新建角色 -> 上传多图 -> 自动切换 -> 候选装备入队”的整条前台验收 |

### 3.14 2026-04-14 装备展示与批量上传回归

| 测试项                      | 状态     | 备注                                                                                                                                                                                                                                                                                                                                                          |
| --------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 装备亮点标签聚合规则回归    | 测试成功 | 已执行 `pnpm exec tsx --test src/shared/lib/simulator-equipment-spotlight.test.ts`，确认亮点、特效、套装、开孔、修理失败、宝石、五行会去重合并输出                                                                                                                                                                                                            |
| 装备图片展示策略类型回归    | 测试成功 | 已执行 `pnpm exec tsc --noEmit`，确认当前装备卡、待确认卡、新品卡与详情弹窗切到“默认展示装备图 + 悬停查看 OCR 原图对比”后无类型错误                                                                                                                                                                                                                           |
| 装备库批量上传交互回归      | 测试成功 | 已执行 `pnpm exec tsc --noEmit`，确认待确认区上传入口支持 `multiple`，并新增顺序队列、进度文案与批量完成提示，无新增类型错误                                                                                                                                                                                                                                  |
| 本地装备图 resolver 回归    | 测试成功 | 已执行 `pnpm exec tsx --test src/features/simulator/utils/equipmentImage.test.ts`，确认已从外部随机图切换为本地 `equipment-art` resolver；已覆盖“已知装备名映射”“未知装备名回退”“无名称按部位回退”三类口径                                                                                                                                                    |
| artwork helper 展示链路回归 | 测试成功 | 已执行 `pnpm exec tsx --test src/features/simulator/utils/equipmentImage.test.ts src/features/simulator/utils/simulatorCandidateEquipment.test.ts src/features/simulator/store/gameStore.test.ts src/features/simulator/utils/simulatorBundle.test.ts`，确认 artwork 名称归一化、前台默认展示 URL 生成，以及候选装备/实验室相关链路未被新的本地展示策略破坏   |
| artwork manifest 校验回归   | 测试成功 | 已执行 `pnpm exec tsx --test src/shared/lib/simulator-equipment-artwork-manifest.test.ts`，确认真实素材 manifest 当前满足“路径合法、文件存在、键唯一、别名不冲突、目录内素材无漏挂”的接入约束，便于后续批量导入装备图片库                                                                                                                                     |
| artwork 生成脚本回归        | 测试成功 | 已执行 `pnpm exec tsx scripts/build-simulator-equipment-artwork-manifest.ts` 与 `node --import tsx --test scripts/build-simulator-equipment-artwork-manifest.test.ts`，确认可从 `data/simulator-equipment-artwork-manifest.source.json` 生成前台使用的 manifest，且脚本会正确处理排序、别名去重与重复键拦截                                                   |
| artwork 目录扫描同步回归    | 测试成功 | 已执行 `node --import tsx --test scripts/sync-simulator-equipment-artwork-source.test.ts`、`pnpm exec tsx scripts/sync-simulator-equipment-artwork-source.ts --check` 与 `pnpm exec tsx scripts/build-simulator-equipment-artwork-manifest.ts --check`，确认可从 `public/simulator/equipment-art/` 扫描目录回写 `source.json`，并与生成后的 manifest 保持一致 |
| artwork 外部目录导入回归    | 测试成功 | 已执行 `node --import tsx --test scripts/import-simulator-equipment-artwork.test.ts` 与 `pnpm exec tsc --noEmit`，确认新脚本可从“按类型分目录”或“文件名前缀带类型”的外部素材目录生成导入计划，并支持 `--type / --overwrite / --dry-run` 等安全导入口径，不会破坏既有 artwork 构建链路                                                                 |
| artwork 别名批量导入回归    | 测试成功 | 已执行 `node --import tsx --test scripts/import-simulator-equipment-artwork.test.ts scripts/sync-simulator-equipment-artwork-source.test.ts scripts/build-simulator-equipment-artwork-manifest.test.ts` 与 `pnpm exec tsc --noEmit`，确认导图脚本支持 `--alias-file` 合并命名别名，未命中 canonical 的条目会安全跳过，同时 manifest 已放开中文路径校验，适配真实梦幻素材文件名 |

### 3.58 2026-04-16 OCR 结果解释回归

| 测试项 | 状态 | 备注 |
| ------ | ---- | ---- |

### 3.59 2026-04-16 本地真实装备图接入回归

| 测试项 | 状态 | 备注 |
| ------ | ---- | ---- |
| `素材/icons` 首批导入回归 | 测试成功 | 已执行 `pnpm simulator:artwork:import -- --source /Users/czy/Documents/dream/素材/icons`，确认 448 张真实装备图已导入到 `public/simulator/equipment-art/`，2 张“属性说明图”被安全跳过 |
| 中文命名自动归类回归 | 测试成功 | 已执行 `node --import tsx --test scripts/import-simulator-equipment-artwork.test.ts`，确认平铺中文素材目录支持按装备名自动推断 `头盔 / 项链 / 衣服 / 腰带 / 鞋子 / 灵饰 / 玉魄 / 武器`，未知项安全回落到武器 |
| parenthetical 变体命中回归 | 测试成功 | 已执行 `node --import tsx --test src/features/simulator/utils/equipmentImage.test.ts`，确认像 `罗喉计都（乾坤）.png` 这类本地素材，前台传入基础名 `罗喉计都` 时仍能命中静态图片 |
| artwork 清单一致性回归 | 测试成功 | 已执行 `pnpm simulator:artwork:check-source`、`pnpm simulator:artwork:check` 与 `node --import tsx --test src/shared/lib/simulator-equipment-artwork-manifest.test.ts`，确认 source JSON、生成后的 manifest 与本地素材目录保持一致 |
| 类型与前台引用回归 | 测试成功 | 已执行 `pnpm exec tsc --noEmit`，确认导图脚本、resolver、测试用例和前台展示链路在接入真实素材后无新增类型错误 |
| R2 artwork 同步回归 | 测试成功 | 已执行并发上传脚本，将 `public/simulator/equipment-art/` 下 `449` 张素材同步到 R2 `dream/equipment-art/`；随后通过 `pnpm wrangler r2 object get` 抽样验证 `weapon/折扇.jpg`、`shoes/踏雪无痕.jpg`、`jade/上古玉魄·阳.jpg` 三个对象均可成功读回 |
| artwork R2 resolver 回归 | 测试成功 | 已执行 `node --import tsx --test src/features/simulator/utils/equipmentImage.test.ts src/shared/lib/simulator-equipment-artwork-manifest.test.ts` 与 `pnpm exec tsc --noEmit`，确认前台仍统一走 `equipment-art` resolver，但服务端已可优先把命中的真实素材转到 R2 对象 URL，命不中时继续安全回退 |
| OCR 解释 helper 回归 | 测试成功 | 已执行 `node --import tsx --test src/shared/lib/simulator-equipment-ocr-review.test.ts`，确认 helper 能稳定输出“有效字段数 / 数值属性数 / 已识别关键项 / 关键缺失项 / 疑似漏识别属性 / 建议优先核对项 / 置信度文案”这组统一解释口径。 |
| 前台接线类型检查 | 测试成功 | 已执行 `pnpm exec tsc --noEmit`，确认 `OcrEquipmentReviewDialog` 与 `PendingEquipmentDetailModal` 接入统一 OCR 解释区后无新增类型错误。 |

### 3.59 2026-04-16 最终面板编排优化回归

| 测试项 | 状态 | 备注 |
| ------ | ---- | ---- |
| 最终面板重排类型检查 | 测试成功 | 已执行 `pnpm exec tsc --noEmit`，确认右侧最终面板重排为“角色速览 / 核心三值 / 试算语境 / 输出面板 / 生存面板 / 辅助面板 / 关键字段来源”后无新增类型错误。 |

### 3.60 2026-04-16 装备方案区交互收口回归

| 测试项 | 状态 | 备注 |
| ------ | ---- | ---- |
| 方案区交互重排类型检查 | 测试成功 | 已执行 `pnpm exec tsc --noEmit`，确认当前装备页的多套方案区改为“信息卡 + 切换按钮 + 独立操作按钮”后无新增类型错误，交互不再依赖整卡 hover 热区。 |

### 3.61 2026-04-16 实验室席位卡结论速览回归

| 测试项 | 状态 | 备注 |
| ------ | ---- | ---- |
| 席位卡结论速览类型检查 | 测试成功 | 已执行 `pnpm exec tsc --noEmit`，确认实验室对比席位卡新增“结论速览”区后无新增类型错误；当前会优先展示伤害结论、总伤增益、差价成本、1点法伤成本和边际提醒。 |
| 席位栏位状态标签类型检查 | 测试成功 | 已执行 `pnpm exec tsc --noEmit`，确认实验室栏位列表新增“沿用当前 / 替换当前 / 新增挂载 / 未挂载”状态标签后无新增类型错误。 |

### 3.15 2026-04-14 神器加成持久化回归

| 测试项                            | 状态     | 备注                                                                                                                                                                                                                                                                        |
| --------------------------------- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 神器加成类型检查回归              | 测试成功 | 已执行 `pnpm exec tsc --noEmit`，确认当前装备页新增“神器加成”编辑区、角色档案保存链路与 bundle 回填无新增类型错误                                                                                                                                                           |
| 神器配置序列化 / 反序列化回归     | 测试成功 | 已执行 `pnpm exec tsx --test src/shared/lib/simulator-artifact.test.ts src/features/simulator/utils/simulatorBundle.test.ts src/shared/models/simulator-domain.test.ts`，验证 `artifactConfig -> treasure -> rawBodyJson -> bundle/store` 主链正常                          |
| 神器进入实验室 / 伤害规则主链回归 | 测试成功 | 已执行 `pnpm test:simulator`，本轮 `90 / 90` 通过；确认新增神器持久化没有破坏实验室估值、领域聚合与伤害规则既有回归                                                                                                                                                         |
| 神器预设与亮点标签回归            | 测试成功 | 已执行 `pnpm exec tsx --test src/shared/lib/simulator-artifact.test.ts`，确认常用预设模板存在且亮点标签能正确输出“属性值 / 生效状态 / 描述”三类摘要                                                                                                                         |
| 实验室席位神器摘要回归            | 测试成功 | 已执行 `pnpm exec tsc --noEmit` 与 `pnpm exec tsx --test src/shared/lib/simulator-artifact.test.ts src/features/simulator/utils/simulatorBundle.test.ts src/shared/models/simulator-domain.test.ts`，确认实验室席位卡新增神器摘要展示后无类型问题，且神器配置链路仍保持稳定 |

### 3.16 2026-04-15 伤害解释层增强回归

| 测试项               | 状态     | 备注                                                                                                                                                                                                                                     |
| -------------------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 伤害解释 helper 回归 | 测试成功 | 已执行 `node --import tsx --test src/shared/lib/simulator-damage-explanation.test.ts`，确认“过程分解”与“生效规则来源”两套解释数据能稳定从 `breakdown` 中提取，覆盖主公式阶段、忽略规则、追加伤害、装备百分比词条、灵饰套装与常规套装摘要 |
| 伤害详情面板类型回归 | 测试成功 | 已执行 `pnpm exec tsc --noEmit`，确认 `SkillDamagePanel` 接入新的解释 helper 后无类型错误                                                                                                                                                |
| 伤害服务主链回归     | 测试成功 | 已执行 `node --import tsx --test src/shared/services/damage-engine.test.ts`，确认在补充前台解释层后，现有伤害公式、符石、灵饰、玉魄、天气与特殊目标等主链测试仍保持全绿                                                                  |

### 3.17 2026-04-15 OCR 截图类型提示回归

| 测试项               | 状态     | 备注                                                                                                                                                                                    |
| -------------------- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| OCR 提示 helper 回归 | 测试成功 | 已执行 `node --import tsx --test src/shared/lib/simulator-ocr-image-hint.test.ts`，确认截图类型提示可稳定归一化为 `auto / general / cangbaoge / chat_preview`，并能生成对应 prompt 指引 |
| OCR 上传入口类型回归 | 测试成功 | 已执行 `pnpm exec tsc --noEmit`，确认角色页上传弹窗、实验室候选上传区、建角多图导入三处入口默认切到 `自动识别` 后无类型错误                                                             |
| OCR 主链接口回归     | 测试成功 | 已执行 `pnpm exec tsc --noEmit`，确认 `/api/simulator/current/candidate-equipment/ocr` 与 `simulator-ocr` 已能把缺省提示归一到 `auto`，不会破坏现有装备 OCR 主链                        |
| OCR 审计元信息回归   | 测试成功 | 已执行 `node --import tsx --test src/shared/lib/simulator-ocr-image-hint.test.ts`，确认 OCR raw 结果可稳定附带 `_ocrMeta.imageHint / routingMode`，为后续后台统计和排障保留证据         |
| OCR 提示展示回归     | 测试成功 | 已执行 `pnpm exec tsc --noEmit`，确认当前状态页 OCR 历史记录和后台 OCR 作业详情页新增提示模式展示后无类型错误，前台可直接看到“自动识别 / 手动指定 + 截图类型”                           |
| OCR 审核弹窗展示回归 | 测试成功 | 已执行 `pnpm exec tsc --noEmit`，确认刚识别完成的装备确认弹窗和实验室待确认详情新增提示模式展示后无类型错误，审核链能直接显示当前 OCR 口径                                              |

### 3.18 2026-04-15 装备总库视图回归

| 测试项                 | 状态     | 备注                                                                                                                                                                   |
| ---------------------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 总库合并逻辑单测回归   | 测试成功 | 已执行 `node --import tsx --test src/shared/blocks/simulator/LaboratoryPanel/laboratory-utils.test.ts`，确认实验室总库可合并“当前方案 / 其他方案 / 候选装备库”来源并去重 |
| 实验室总库类型检查回归 | 测试成功 | 已执行 `pnpm exec tsc --noEmit`，确认实验室左侧第二个 tab 改为“装备总库视图”并新增来源标签后无类型错误                                                               |

### 3.19 2026-04-15 当前装备页总库入口回归

| 测试项                     | 状态     | 备注                                                                                                                                                      |
| -------------------------- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 当前装备页总库来源回归     | 测试成功 | 已执行 `pnpm exec tsc --noEmit`，确认当前装备页“从装备库替换”弹窗改为共用统一总库来源聚合逻辑后无类型错误                                                |
| 实验室栏位选择来源标签回归 | 测试成功 | 已执行 `pnpm exec tsc --noEmit`，确认实验室栏位选择弹窗接入来源标签展示后无类型错误                                                                        |
| 总库合并逻辑单测复用回归   | 测试成功 | 已执行 `node --import tsx --test src/shared/blocks/simulator/LaboratoryPanel/laboratory-utils.test.ts`，确认共享后的总库合并规则仍保持“合并来源 + 候选优先”口径 |

### 3.20 2026-04-15 库存镜像语义回归

| 测试项                     | 状态     | 备注                                                                                                                                                                               |
| -------------------------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 库存镜像描述符单测回归     | 测试成功 | 已执行 `node --import tsx --test src/shared/lib/simulator-inventory-mirror.test.ts`，确认“当前方案 / 其他方案”会生成稳定的镜像资产描述符，并带正确来源标签与 folderKey         |
| 库存镜像元信息解析回归     | 测试成功 | 已执行 `node --import tsx --test src/shared/lib/simulator-inventory-mirror.test.ts`，确认库存 payload 中的 `_inventoryMeta` 可稳定解析，后台台账可据此识别来源                   |
| 库存镜像类型检查回归       | 测试成功 | 已执行 `pnpm exec tsc --noEmit`，确认当前装备保存链路、装备回滚链路、后台入库台账展示在接入库存镜像同步后无类型错误                                                             |

### 3.21 2026-04-15 当前装备页独立总库入口回归

| 测试项                     | 状态     | 备注                                                                                                                                                          |
| -------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 总库入口类型检查回归       | 测试成功 | 已执行 `pnpm exec tsc --noEmit`，确认当前装备区新增“装备总库”独立入口以及对应 modal 后无类型错误                                                             |
| 总库筛选逻辑复用回归       | 测试成功 | 已执行 `node --import tsx --test src/shared/blocks/simulator/LaboratoryPanel/laboratory-utils.test.ts`，确认前台总库入口继续复用既有总库聚合与筛选逻辑，没有破坏原实验室口径 |
| 总库快捷挂载类型检查回归   | 测试成功 | 已执行 `pnpm exec tsc --noEmit`，确认当前装备区总库卡片新增“挂到当前 / 查看详情 / 已穿戴”动作后无类型错误，且不会影响原有卡片组件在实验室中的使用             |
| 总库送实验室链路类型检查回归 | 测试成功 | 已执行 `pnpm exec tsc --noEmit`，确认当前装备区总库卡片新增“送去实验室”动作后，可复用现有实验室席位更新逻辑与切页事件，无新增类型错误                           |
| 总库状态徽标类型检查回归   | 测试成功 | 已执行 `pnpm exec tsc --noEmit`，确认当前装备区总库卡片新增“当前穿戴 / 实验室对比中 / 库存待用”状态徽标后无类型错误，且不会影响实验室中的卡片复用             |
| 总库移出实验室链路类型检查回归 | 测试成功 | 已执行 `pnpm exec tsc --noEmit`，确认当前装备区总库卡片可直接把“实验室对比中”的装备移出对比席位，复用既有 `removeExperimentSeatEquipment` 逻辑且无新增类型错误 |

### 3.22 2026-04-15 当前装备页总库状态筛选回归

| 测试项               | 状态     | 备注                                                                                                                                                                  |
| -------------------- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 状态筛选类型检查回归 | 测试成功 | 已执行 `pnpm exec tsc --noEmit`，确认当前装备区“装备总库”顶部汇总卡片改为可点击状态筛选后无类型错误                                                                  |
| 相关单测回归         | 测试成功 | 已执行 `node --import tsx --test src/shared/lib/simulator-inventory-mirror.test.ts src/shared/blocks/simulator/LaboratoryPanel/laboratory-utils.test.ts`，确认本轮状态筛选调整未破坏库存镜像与实验室总库工具链 |

### 3.23 2026-04-15 当前装备页总库挂到指定方案回归

| 测试项                 | 状态     | 备注                                                                                                                                                                                                 |
| ---------------------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 指定方案写入单测回归   | 测试成功 | 已执行 `node --import tsx --test src/features/simulator/store/gameStore.test.ts`，确认新增 `updateEquipmentInSet` 后，写入非当前方案不会污染当前穿戴；写入当前方案会同步更新当前装备 |
| 总库入口类型检查回归   | 测试成功 | 已执行 `pnpm exec tsc --noEmit`，确认当前装备区“装备总库”卡片新增“挂到方案”动作和方案选择层后无类型错误                                                                                           |
| 总库相关链路复测       | 测试成功 | 已执行 `node --import tsx --test src/features/simulator/store/gameStore.test.ts src/shared/lib/simulator-inventory-mirror.test.ts src/shared/blocks/simulator/LaboratoryPanel/laboratory-utils.test.ts`，确认本轮改动未破坏总库、库存镜像和实验室工具链 |

### 3.24 2026-04-15 当前装备页总库方案占用与覆盖提示回归

| 测试项                 | 状态     | 备注                                                                                                                                                                                                                           |
| ---------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 方案占用 helper 单测回归 | 测试成功 | 已执行 `node --import tsx --test src/shared/lib/simulator-equipment-plan-assignment.test.ts`，确认“方案占用摘要”与“同一件 / 覆盖替换 / 直接写入”判定稳定                                                                 |
| 总库入口类型检查回归   | 测试成功 | 已执行 `pnpm exec tsc --noEmit`，确认当前装备区总库卡片新增“方案占用”提示，以及“挂到指定方案”弹层补充覆盖语义提示后无类型错误                                                                                              |
| 相关链路复测           | 测试成功 | 已执行 `node --import tsx --test src/shared/lib/simulator-equipment-plan-assignment.test.ts src/features/simulator/store/gameStore.test.ts src/shared/lib/simulator-inventory-mirror.test.ts src/shared/blocks/simulator/LaboratoryPanel/laboratory-utils.test.ts`，确认本轮增强未破坏总库、方案写入和实验室链路 |

### 3.25 2026-04-15 当前装备页总库方案筛选回归

| 测试项               | 状态     | 备注                                                                                                                                                                                                                                          |
| -------------------- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 方案筛选类型检查回归 | 测试成功 | 已执行 `pnpm exec tsc --noEmit`，确认当前装备区“装备总库”新增顶部方案筛选条，并支持切到指定方案或“未写入方案”视角后无类型错误                                                                                                            |
| 相关链路复测         | 测试成功 | 已执行 `node --import tsx --test src/shared/lib/simulator-equipment-plan-assignment.test.ts src/features/simulator/store/gameStore.test.ts src/shared/lib/simulator-inventory-mirror.test.ts src/shared/blocks/simulator/LaboratoryPanel/laboratory-utils.test.ts`，确认方案筛选增强未破坏总库、方案写入和实验室链路 |

### 3.26 2026-04-15 当前装备页总库实验室样本方案联动回归

| 测试项                   | 状态     | 备注                                                                                                                                                                                                                                          |
| ------------------------ | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 样本方案共享状态单测回归 | 测试成功 | 已执行 `node --import tsx --test src/features/simulator/store/gameStore.test.ts`，确认实验室样本方案索引已收口为共享 store 状态，并具备越界兜底与云端状态恢复兼容                                                                 |
| 联动提示类型检查回归     | 测试成功 | 已执行 `pnpm exec tsc --noEmit`，确认当前装备区总库新增“当前方案 / 实验室样本方案”关系提示和一键切换按钮后无类型错误                                                                                                                        |
| 相关链路复测             | 测试成功 | 已执行 `node --import tsx --test src/features/simulator/store/gameStore.test.ts src/shared/lib/simulator-equipment-plan-assignment.test.ts src/shared/lib/simulator-inventory-mirror.test.ts src/shared/blocks/simulator/LaboratoryPanel/laboratory-utils.test.ts`，确认本轮联动增强未破坏总库、实验室和方案写入链路 |

### 3.27 2026-04-15 当前装备页总库差异部位筛选回归

| 测试项                   | 状态     | 备注                                                                                                                                                                                                                                          |
| ------------------------ | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 差异统计 helper 单测回归 | 测试成功 | 已执行 `node --import tsx --test src/shared/lib/simulator-equipment-plan-assignment.test.ts`，确认“当前方案 vs 实验室样本方案”的差异部位统计与差异栏位键计算稳定                                                                       |
| 差异筛选类型检查回归     | 测试成功 | 已执行 `pnpm exec tsc --noEmit`，确认当前装备区总库新增差异部位数量提示与“只看差异部位”筛选后无类型错误                                                                                                                                    |
| 相关链路复测             | 测试成功 | 已执行 `node --import tsx --test src/shared/lib/simulator-equipment-plan-assignment.test.ts src/features/simulator/store/gameStore.test.ts src/shared/lib/simulator-inventory-mirror.test.ts src/shared/blocks/simulator/LaboratoryPanel/laboratory-utils.test.ts`，确认本轮差异筛选增强未破坏总库、实验室和方案写入链路 |

### 3.28 2026-04-15 当前装备页总库差异三分类筛选回归

| 测试项                   | 状态     | 备注                                                                                                                                                                                                                                          |
| ------------------------ | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 差异分类 helper 单测回归 | 测试成功 | 已执行 `node --import tsx --test src/shared/lib/simulator-equipment-plan-assignment.test.ts`，确认差异位已能稳定拆成“当前方案独有 / 实验室样本独有 / 同部位不同装备”三类                                                             |
| 差异分类类型检查回归     | 测试成功 | 已执行 `pnpm exec tsc --noEmit`，确认当前装备区总库新增差异三分类筛选按钮后无类型错误                                                                                                                                                       |
| 相关链路复测             | 测试成功 | 已执行 `node --import tsx --test src/shared/lib/simulator-equipment-plan-assignment.test.ts src/features/simulator/store/gameStore.test.ts src/shared/lib/simulator-inventory-mirror.test.ts src/shared/blocks/simulator/LaboratoryPanel/laboratory-utils.test.ts`，确认本轮差异分类增强未破坏总库、实验室和方案写入链路 |

### 3.29 2026-04-15 当前装备页总库快捷处理视角回归

| 测试项                   | 状态     | 备注                                                                                                                                                                                                                                          |
| ------------------------ | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 快捷视角类型检查回归     | 测试成功 | 已执行 `pnpm exec tsc --noEmit`，确认当前装备区总库新增“待送实验室差异 / 当前方案独有且未进实验室 / 同部位替换候选”等快捷处理视角后无类型错误                                                                                           |
| 相关链路复测             | 测试成功 | 已执行 `node --import tsx --test src/shared/lib/simulator-equipment-plan-assignment.test.ts src/features/simulator/store/gameStore.test.ts src/shared/lib/simulator-inventory-mirror.test.ts src/shared/blocks/simulator/LaboratoryPanel/laboratory-utils.test.ts`，确认本轮快捷视角增强未破坏总库、实验室和方案写入链路 |

### 3.30 2026-04-15 当前装备页总库建议动作提示回归

| 测试项                     | 状态     | 备注                                                                                                                                                                                                                                          |
| -------------------------- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 建议动作 helper 单测回归   | 测试成功 | 已执行 `node --import tsx --test src/shared/lib/simulator-equipment-plan-assignment.test.ts`，确认快捷视角到“建议送实验室 / 建议补实验室样本 / 建议直接挂到当前 / 建议先写入方案”的推荐动作映射稳定                                                                 |
| 快捷视角独立筛选单测回归   | 测试成功 | 已执行 `node --import tsx --test src/shared/lib/simulator-equipment-plan-assignment.test.ts`，确认“待送实验室差异 / 当前方案独有且未进实验室”不再被“库存待用”状态误伤，当前穿戴但未进实验室的差异装备仍可命中推荐视角                                             |
| 建议动作类型检查回归       | 测试成功 | 已执行 `pnpm exec tsc --noEmit`，确认当前装备区总库卡片新增建议动作标签与按钮高亮后无类型错误                                                                                                                                               |
| 相关链路复测               | 测试成功 | 已执行 `node --import tsx --test src/shared/lib/simulator-equipment-plan-assignment.test.ts src/features/simulator/store/gameStore.test.ts src/shared/lib/simulator-inventory-mirror.test.ts src/shared/blocks/simulator/LaboratoryPanel/laboratory-utils.test.ts`，确认本轮增强未破坏总库、实验室和方案写入链路 |

### 3.31 2026-04-15 当前装备页总库批量送实验室回归

| 测试项                       | 状态     | 备注                                                                                                                                                                                                                                          |
| ---------------------------- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 部位去重 helper 单测回归     | 测试成功 | 已执行 `node --import tsx --test src/shared/lib/simulator-equipment-plan-assignment.test.ts`，确认批量动作会按当前排序保留每个部位的第一件装备，后续同部位候选会被稳定跳过                                                                 |
| 批量送实验室类型检查回归     | 测试成功 | 已执行 `pnpm exec tsc --noEmit`，确认当前装备区总库新增“批量送去实验室”入口与去重提示后无类型错误                                                                                                                                           |
| 相关链路复测                 | 测试成功 | 已执行 `node --import tsx --test src/shared/lib/simulator-equipment-plan-assignment.test.ts src/features/simulator/store/gameStore.test.ts src/shared/lib/simulator-inventory-mirror.test.ts src/shared/blocks/simulator/LaboratoryPanel/laboratory-utils.test.ts`，确认本轮增强未破坏总库、实验室和方案写入链路 |

### 3.32 2026-04-15 当前装备页总库批量移出实验室回归

| 测试项                         | 状态     | 备注                                                                                                                                                                                                                                          |
| ------------------------------ | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 批量移出实验室类型检查回归     | 测试成功 | 已执行 `pnpm exec tsc --noEmit`，确认当前装备区总库在“实验室对比中”视图下新增“批量移出实验室”入口后无类型错误                                                                                                                              |
| 相关链路复测                   | 测试成功 | 已执行 `node --import tsx --test src/shared/lib/simulator-equipment-plan-assignment.test.ts src/features/simulator/store/gameStore.test.ts src/shared/lib/simulator-inventory-mirror.test.ts src/shared/blocks/simulator/LaboratoryPanel/laboratory-utils.test.ts`，确认本轮增强未破坏总库、实验室和方案写入链路 |

### 3.33 2026-04-15 当前装备页总库批量写入方案回归

| 测试项                         | 状态     | 备注                                                                                                                                                                                                                                          |
| ------------------------------ | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 批量写方案 store 单测回归      | 测试成功 | 已执行 `node --import tsx --test src/features/simulator/store/gameStore.test.ts`，确认 `updateEquipmentListInSet` 可一次写入多件装备，并能正确区分活跃方案与非活跃方案的同步行为                                                           |
| 批量写方案摘要 helper 单测回归 | 测试成功 | 已执行 `node --import tsx --test src/shared/lib/simulator-equipment-plan-assignment.test.ts`，确认批量写入前的 `直接写入 / 覆盖替换 / 已一致` 数量拆分稳定                                                                                 |
| 批量写方案类型检查回归         | 测试成功 | 已执行 `pnpm exec tsc --noEmit`，确认当前装备区总库新增“批量写入方案”入口与批量方案选择层后无类型错误                                                                                                                                       |
| 相关链路复测                   | 测试成功 | 已执行 `node --import tsx --test src/shared/lib/simulator-equipment-plan-assignment.test.ts src/features/simulator/store/gameStore.test.ts src/shared/lib/simulator-inventory-mirror.test.ts src/shared/blocks/simulator/LaboratoryPanel/laboratory-utils.test.ts`，确认本轮增强未破坏总库、实验室和方案写入链路 |

### 3.34 2026-04-15 当前装备页总库批量写方案模式回归

| 测试项                           | 状态     | 备注                                                                                                                                                                                                                                          |
| -------------------------------- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 批量写方案模式 helper 单测回归   | 测试成功 | 已执行 `node --import tsx --test src/shared/lib/simulator-equipment-plan-assignment.test.ts`，确认 `全部可变动项 / 仅补空栏位 / 仅替换已有栏位` 三种模式下的可写数量与实际待写装备列表拆分稳定                                               |
| 批量写方案模式类型检查回归       | 测试成功 | 已执行 `pnpm exec tsc --noEmit`，确认当前装备区总库批量写方案弹层新增模式切换后无类型错误                                                                                                                                                   |
| 相关链路复测                     | 测试成功 | 已执行 `node --import tsx --test src/shared/lib/simulator-equipment-plan-assignment.test.ts src/features/simulator/store/gameStore.test.ts src/shared/lib/simulator-inventory-mirror.test.ts src/shared/blocks/simulator/LaboratoryPanel/laboratory-utils.test.ts`，确认本轮增强未破坏总库、实验室和方案写入链路 |

### 3.35 2026-04-15 当前装备页总库批量结果摘要回归

| 测试项                         | 状态     | 备注                                                                                                                                                                                                                                          |
| ------------------------------ | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 结果摘要类型检查回归           | 测试成功 | 已执行 `pnpm exec tsc --noEmit`，确认当前装备区总库新增批量动作结果摘要条、目标去向展示与自动视角联动后无类型错误                                                                                                                          |
| 相关链路复测                   | 测试成功 | 已执行 `node --import tsx --test src/shared/lib/simulator-equipment-plan-assignment.test.ts src/features/simulator/store/gameStore.test.ts src/shared/lib/simulator-inventory-mirror.test.ts src/shared/blocks/simulator/LaboratoryPanel/laboratory-utils.test.ts`，确认本轮增强未破坏总库、实验室和方案写入链路 |

### 3.36 2026-04-15 当前装备页总库结果摘要动作回归

| 测试项                         | 状态     | 备注                                                                                                                                                                                                                                          |
| ------------------------------ | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 结果摘要动作类型检查回归       | 测试成功 | 已执行 `pnpm exec tsc --noEmit`，确认当前装备区总库结果摘要条新增 `只看本次部位 / 回到目标视图` 动作，以及对应的结果聚焦筛选后无类型错误                                                                                                   |
| 相关链路复测                   | 测试成功 | 已执行 `node --import tsx --test src/shared/lib/simulator-equipment-plan-assignment.test.ts src/features/simulator/store/gameStore.test.ts src/shared/lib/simulator-inventory-mirror.test.ts src/shared/blocks/simulator/LaboratoryPanel/laboratory-utils.test.ts`，确认本轮增强未破坏总库、实验室和方案写入链路 |

### 3.37 2026-04-15 当前装备页总库结果摘要后续动作回归

| 测试项                         | 状态     | 备注                                                                                                                                                                                                                                          |
| ------------------------------ | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 结果摘要后续动作类型检查回归   | 测试成功 | 已执行 `pnpm exec tsc --noEmit`，确认当前装备区总库结果摘要条新增“继续处理本次部位”的批量动作入口后无类型错误                                                                                                                               |
| 相关链路复测                   | 测试成功 | 已执行 `node --import tsx --test src/shared/lib/simulator-equipment-plan-assignment.test.ts src/features/simulator/store/gameStore.test.ts src/shared/lib/simulator-inventory-mirror.test.ts src/shared/blocks/simulator/LaboratoryPanel/laboratory-utils.test.ts`，确认本轮增强未破坏总库、实验室和方案写入链路 |

### 3.38 2026-04-15 当前装备页总库结果摘要进度统计回归

| 测试项                         | 状态     | 备注                                                                                                                                                                                                                                          |
| ------------------------------ | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 结果摘要进度统计类型检查回归   | 测试成功 | 已执行 `pnpm exec tsc --noEmit`，确认当前装备区总库结果摘要条新增“本次部位处理进度”统计后无类型错误                                                                                                                                         |
| 相关链路复测                   | 测试成功 | 已执行 `node --import tsx --test src/shared/lib/simulator-equipment-plan-assignment.test.ts src/features/simulator/store/gameStore.test.ts src/shared/lib/simulator-inventory-mirror.test.ts src/shared/blocks/simulator/LaboratoryPanel/laboratory-utils.test.ts`，确认本轮增强未破坏总库、实验室和方案写入链路 |

### 3.39 2026-04-15 当前装备页总库结果摘要阶段状态回归

| 测试项                         | 状态     | 备注                                                                                                                                                                                                                                          |
| ------------------------------ | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 结果摘要阶段状态类型检查回归   | 测试成功 | 已执行 `pnpm exec tsc --noEmit`，确认当前装备区总库结果摘要条新增阶段状态与收尾进度条后无类型错误                                                                                                                                           |
| 相关链路复测                   | 测试成功 | 已执行 `node --import tsx --test src/shared/lib/simulator-equipment-plan-assignment.test.ts src/features/simulator/store/gameStore.test.ts src/shared/lib/simulator-inventory-mirror.test.ts src/shared/blocks/simulator/LaboratoryPanel/laboratory-utils.test.ts`，确认本轮增强未破坏总库、实验室和方案写入链路 |

### 3.40 2026-04-15 当前装备页总库结果摘要推荐动作回归

| 测试项                         | 状态     | 备注                                                                                                                                                                                                                                          |
| ------------------------------ | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 结果摘要推荐动作类型检查回归   | 测试成功 | 已执行 `pnpm exec tsc --noEmit`，确认当前装备区总库结果摘要条新增阶段驱动的“推荐下一步”标记与动作排序高亮后无类型错误                                                                                                                       |
| 相关链路复测                   | 测试成功 | 已执行 `node --import tsx --test src/shared/lib/simulator-equipment-plan-assignment.test.ts src/features/simulator/store/gameStore.test.ts src/shared/lib/simulator-inventory-mirror.test.ts src/shared/blocks/simulator/LaboratoryPanel/laboratory-utils.test.ts`，确认本轮增强未破坏总库、实验室和方案写入链路 |

### 3.41 2026-04-15 当前装备页总库结果摘要完成态回归

| 测试项                         | 状态     | 备注                                                                                                                                                                                                                                          |
| ------------------------------ | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 结果摘要完成态类型检查回归     | 测试成功 | 已执行 `pnpm exec tsc --noEmit`，确认当前装备区总库结果摘要条在 `已收尾` 阶段新增“完成本轮”入口与完成态展示后无类型错误                                                                                                                      |
| 相关链路复测                   | 测试成功 | 已执行 `node --import tsx --test src/shared/lib/simulator-equipment-plan-assignment.test.ts src/features/simulator/store/gameStore.test.ts src/shared/lib/simulator-inventory-mirror.test.ts src/shared/blocks/simulator/LaboratoryPanel/laboratory-utils.test.ts`，确认本轮增强未破坏总库、实验室和方案写入链路 |

### 3.42 2026-04-15 当前装备页总库结果摘要收尾辅助回归

| 测试项                             | 状态     | 备注                                                                                                                                                                                                                                                                      |
| ---------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 结果摘要收尾辅助类型检查回归       | 测试成功 | 已执行 `pnpm exec tsc --noEmit`，确认当前装备区总库结果摘要条在 `已收尾` 完成态新增“开始下一批”入口、并将阶段/推荐动作逻辑抽到独立 helper 后无类型错误                                                                                                                  |
| 结果摘要阶段 helper 单测回归       | 测试成功 | 已执行 `node --import tsx --test src/shared/lib/simulator-equipment-plan-assignment.test.ts src/features/simulator/store/gameStore.test.ts src/shared/lib/simulator-inventory-mirror.test.ts src/shared/blocks/simulator/LaboratoryPanel/laboratory-utils.test.ts`，确认阶段判定、推荐动作优先级、完成态判定及相关总库链路均通过 |

### 3.43 2026-04-15 当前装备页装备总库浏览器 QA

| 测试项                         | 状态         | 备注                                                                                                                                                                                                                   |
| ------------------------------ | ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 本地登录与主页面加载          | 测试成功     | 已在本地 `http://localhost:3000/zh` 使用管理员账号登录，确认可进入模拟器首页，并正常加载 `当前状态 / 实验室 / AI 顾问` 主导航与云端角色数据。                                                                      |
| 当前装备页打开装备总库        | 测试成功     | 已在“当前状态”页点击“装备总库”，确认弹层可正常展示统一库存、方案筛选、部位筛选、状态筛选与卡片动作。                                                                                                              |
| 装备送实验室通知去重回归      | 已修复并复测 | 浏览器实测发现“送去实验室”后同一条 toast 被渲染两次。根因是全局布局与 `SimulatorApp` 内部同时挂载了 `Toaster`。移除 [SimulatorApp/index.tsx](/Users/czy/Documents/dream/src/shared/blocks/simulator/SimulatorApp/index.tsx) 内部 Toaster 后，再次执行同一路径，通知仅保留一份。 |
| 修复后类型检查                | 测试成功     | 已执行 `pnpm exec tsc --noEmit`，确认移除重复 Toaster 后无类型错误。                                                                                                                                                  |
| 本轮浏览器 QA 额外关注        | 有风险提示   | 本地 dev 日志中仍出现过 `GET /api/auth/get-session 429` 与一次 D1 transient network error retry，但页面最终恢复并完成流程。本轮未继续扩展为后端稳定性专项排查。                                                    |

### 3.44 2026-04-15 当前装备页总库移出候选库回归

| 测试项                   | 状态     | 备注                                                                                                                                                                                                                                                                          |
| ------------------------ | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 总库移出候选库类型检查   | 测试成功 | 已执行 `pnpm exec tsc --noEmit`，确认当前装备页总库新增“移出候选库”危险动作、确认弹窗与候选库持久化回写后无类型错误。                                                                                                                                                      |
| 总库移出候选库回归集单测 | 测试成功 | 已执行 `node --import tsx --test src/shared/lib/simulator-equipment-plan-assignment.test.ts src/features/simulator/store/gameStore.test.ts src/shared/lib/simulator-inventory-mirror.test.ts src/shared/blocks/simulator/LaboratoryPanel/laboratory-utils.test.ts`，本轮 `45 / 45` 通过。 |
| 浏览器确认入库链路       | 测试成功 | 已在本地实验室把待确认装备 `碧霞彩云衣` 执行“确认入库”，确认 `待确认新品 (1) -> (0)`，`装备总库 (12) -> (13)`，并成功进入候选装备库视角。                                                                                                                                   |
| 当前状态总库移出候选库   | 测试成功 | 已在“当前状态 -> 装备总库”看到 `碧霞彩云衣` 卡片上的 `移出候选库` 按钮；确认删除后命中 `PATCH /api/simulator/current/candidate-equipment = 200`，返回 `data: []`。                                                                                                         |
| 移除后的库存计数联动     | 测试成功 | 浏览器复核确认移除完成后，顶部汇总从 `当前结果 7 / 库存待用 1 / 未写入方案 1` 回落到 `当前结果 6 / 库存待用 0 / 未写入方案 0`，候选装备卡片已消失。                                                                                                                        |

### 3.45 2026-04-15 当前状态候选库同步与批量清理回归

| 测试项                             | 状态     | 备注                                                                                                                                                                                                                                                                                                                                                                  |
| ---------------------------------- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 候选库同步 helper 类型检查         | 测试成功 | 已执行 `pnpm exec tsc --noEmit`，确认新增 `loadSimulatorCandidateEquipmentToStore` 统一加载 helper，并接入 `SimulatorApp` 启动链路与角色切换链路后无类型错误。                                                                                                                                                                                                     |
| 候选库同步 helper 单测回归         | 测试成功 | 已执行 `node --import tsx --test src/features/simulator/utils/simulatorCandidateEquipment.test.ts src/features/simulator/store/gameStore.test.ts src/shared/lib/simulator-inventory-mirror.test.ts src/shared/lib/simulator-equipment-plan-assignment.test.ts src/shared/blocks/simulator/LaboratoryPanel/laboratory-utils.test.ts`，本轮 `48 / 48` 通过。 |
| 当前状态刷新后候选库自动加载       | 测试成功 | 浏览器先向 `/api/simulator/current/candidate-equipment` 写入两件 QA 候选装备，再直接刷新本地 `http://localhost:3000/zh` 的“当前状态”页，不进入实验室；随后打开“装备总库”即看到 `库存待用 2`，并出现 `QA刷新候选鞋子 / QA刷新候选腰带` 两张候选卡片，说明刷新后已自动同步候选库存。                                                                 |
| 批量移出候选库浏览器链路           | 测试成功 | 在“当前状态 -> 装备总库 -> 候选装备库”来源下，已看到新的“候选库批量清理”面板；点击“批量移出候选库”后命中 `PATCH /api/simulator/current/candidate-equipment = 200`，确认弹窗关闭，候选卡片消失。                                                                                                                                                                   |
| 批量移除后的汇总计数与测试数据清理 | 测试成功 | 浏览器复核确认批量移除后顶部汇总回落到 `当前结果 0 / 库存待用 0 / 未写入方案 0`，同时 QA 测试候选数据已清理干净。                                                                                                                                                                                                                                                   |

### 3.46 2026-04-15 当前状态总库方案移出回归

| 测试项                   | 状态     | 备注                                                                                                                                                                                                                                                                                                                                                                                                              |
| ------------------------ | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 方案移出类型检查回归     | 测试成功 | 已执行 `pnpm exec tsc --noEmit`，确认当前装备页“装备总库”新增 `移出该方案 / 批量移出方案` 入口、方案移出确认弹窗，以及方案移出后的结果摘要联动后无类型错误。                                                                                                                                                                                                                                                |
| 方案移出回归集单测       | 测试成功 | 已执行 `node --import tsx --test src/features/simulator/store/gameStore.test.ts src/features/simulator/utils/simulatorCandidateEquipment.test.ts src/shared/lib/simulator-equipment-plan-assignment.test.ts src/shared/lib/simulator-inventory-mirror.test.ts src/shared/blocks/simulator/LaboratoryPanel/laboratory-utils.test.ts`，本轮 `50 / 50` 通过。 |
| 活跃方案同步语义单测     | 测试成功 | 本轮新增 `removeEquipmentInSet / removeEquipmentListInSet` store 回归，确认从活跃方案移出装备时会同步更新当前穿戴；从非活跃方案移出时不会误伤当前装备。                                                                                                                                                                                                                                                        |
| 浏览器链路               | 未执行   | 本轮先完成类型检查与单测回归，尚未单独补跑“当前状态 -> 装备总库 -> 指定方案 -> 移出该方案 / 批量移出方案”的浏览器 QA。                                                                                                                                                                                                                                                                                           |

### 3.47 2026-04-15 当前状态总库方案移出浏览器 QA 补录

| 测试项 | 状态 | 备注 |
| ------ | ---- | ---- |
| 单件移出方案浏览器链路 | 测试成功 | 已在本地 `http://localhost:3000/zh` 打开“当前状态 -> 装备总库 -> 高速方案”，对 `沧海灵杖` 执行 `移出该方案`。修复后该卡片会立刻从“高速方案”筛选结果里消失，顶部方案计数从 `6` 变为 `5`，批量面板同步变为“当前可从「高速方案」移出 5 件”。 |
| 批量移出方案浏览器链路 | 测试成功 | 延续同一链路，对“高速方案”剩余 5 件装备执行“方案批量清理”。确认成功后出现“已批量移出装备方案”结果摘要，`高速方案` 计数降为 `0`，筛选结果展示空态“当前方案筛选下还没有装备”。 |
| 方案移出回归问题定位 | 测试成功 | 浏览器 QA 中曾复现异常：单件移出后摘要与计数已更新，但卡片仍留在方案筛选列表。根因是总库列表构建时优先读取 `syncedCloudState` 的旧方案来源，而不是当前 workbench 的实时 `equipment / equipmentSets`。 |
| 方案移出回归修复验证 | 测试成功 | 已将总库列表来源切回实时 workbench 状态，再次执行同一路径后，方案移出会即时刷新筛选结果，不再残留旧来源标签。修复后已补跑 `pnpm exec tsc --noEmit`，结果通过。 |
| 方案来源实时性自动化回归 | 测试成功 | 已新增 `src/shared/lib/simulator-equipment-library.test.ts`，并执行 `node --import tsx --test src/shared/lib/simulator-equipment-library.test.ts`。本轮确认统一总库在输入的 `equipmentSets` 发生方案移出后，会只保留最新来源标签，不会继续保留已被移除的方案来源。 |

### 3.48 2026-04-15 实验室总库候选来源清理回归

| 测试项 | 状态 | 备注 |
| ------ | ---- | ---- |
| 实验室总库候选清理类型检查 | 测试成功 | 已执行 `pnpm exec tsc --noEmit`，确认实验室左侧“装备总库视图”新增卡片级 `移出候选库`、顶部 `批量移出候选库` 以及专用确认弹窗后无类型错误。 |
| 行为语义校对 | 测试成功 | 本轮实现明确将“移出候选库”限定为移除 `candidate_library` 来源；若该装备同时存在于当前方案或其他方案，实验室总库只会移除候选来源，不会误删方案装备。 |
| 单件移出候选来源浏览器链路 | 测试成功 | 已在本地 `http://localhost:3000/zh` 进入“实验室 -> 装备总库”，插入 QA 候选装备 `QA实验候选宝冠 / QA实验候选法杖` 后，对 `QA实验候选宝冠` 执行卡片级 `移出候选库`。确认后总库计数由 `14 -> 13`、装备类数量由 `8 -> 7`，顶部批量按钮也由 `批量移出候选库 (2)` 变为 `批量移出候选库 (1)`。 |
| 批量移出候选来源浏览器链路 | 测试成功 | 延续同一链路，对剩余 `QA实验候选法杖` 执行顶部 `批量移出候选库`。确认后总库计数由 `13 -> 12`、装备类数量由 `7 -> 6`，候选卡片全部消失，顶部也不再显示批量移出按钮。 |
| 候选库清理结果校验 | 测试成功 | 浏览器内再次请求 `/api/simulator/current/candidate-equipment`，返回 `length: 0`，确认本轮 QA 插入的候选数据已清理干净，没有残留到用户候选库。 |

### 3.49 2026-04-15 实验室总库来源筛选回归

| 测试项 | 状态 | 备注 |
| ------ | ---- | ---- |
| 来源筛选条类型检查 | 测试成功 | 已执行 `pnpm exec tsc --noEmit`，确认实验室总库新增 `全部来源 / 当前方案 / 其他方案 / 候选装备库` 四个来源筛选入口后无类型错误。 |
| 候选来源视角浏览器链路 | 测试成功 | 浏览器先向 `/api/simulator/current/candidate-equipment` 注入 `QA来源筛选腰带`，进入“实验室 -> 装备总库”后看到来源筛选条显示 `全部来源 (13) / 当前方案 (12) / 其他方案 (12) / 候选装备库 (1)`；点击 `候选装备库 (1)` 后，摘要切到“来源 候选装备库”，可见列表收口为 1 件，且只剩 `QA来源筛选腰带`。 |
| 当前方案来源视角浏览器链路 | 测试成功 | 在同一数据集下点击 `当前方案 (12)`，顶部摘要切到“来源 当前方案”，装备主类下显示 6 件装备，说明来源筛选和主类 / 部位筛选能同时生效。 |
| 其他方案来源视角浏览器链路 | 测试成功 | 在同一数据集下点击 `其他方案 (12)`，顶部摘要切到“来源 其他方案”，装备主类下同样显示 6 件装备。由于统一总库会对同一件装备去重，而当前这组测试数据里的 6 件常规装备同时带有 `current_plan + equipment_plan` 标签，所以两种来源视角都会命中同一批卡片，这属于当前合并库存语义而不是缺陷。 |
| 来源筛选清理收尾 | 测试成功 | 本轮在浏览器里通过 `PATCH /api/simulator/current/candidate-equipment` 将 QA 候选清空后，再次回到“实验室 -> 装备总库”，已确认来源筛选条回落到 `候选装备库 (0)`；点击后摘要仍显示“来源 候选装备库”，列表为空态“当前筛选下暂无可用装备”，说明筛选条和候选来源清理链路已经闭环。 |

### 3.50 2026-04-15 实验室总库详情来源归属回归

| 测试项 | 状态 | 备注 |
| ------ | ---- | ---- |
| 详情来源归属类型检查 | 测试成功 | 已执行 `pnpm exec tsc --noEmit`，确认实验室总库详情弹窗新增 `来源归属` 区、来源标签/类型展示，以及详情内 `移出候选库` 入口后无类型错误。 |
| 详情来源展示浏览器链路 | 测试成功 | 浏览器向 `/api/simulator/current/candidate-equipment` 注入 `QA详情候选腰带` 后，进入“实验室 -> 装备总库 -> 候选装备库”并打开详情。弹窗中已看到新增的 `来源归属` 区，且会展示 `具体来源：候选装备库` 与 `来源类型：候选装备库来源`。 |
| 详情内移出候选库链路 | 测试成功 | 在同一详情弹窗中点击 `移出候选库`，会弹出与卡片级一致的确认弹窗，文案明确说明“若同时属于当前方案或其他方案，只会移除候选来源，不会影响方案装备”。 |
| 详情移出后的收尾状态 | 测试成功 | 确认移出后，实验室总库顶部计数回落为 `装备总库 (12)`、`候选装备库 (0)`，候选来源视角展示空态“当前筛选下暂无可用装备”；保存完成后详情弹窗也会自动关闭，说明详情态与候选来源清理链路已打通。 |

### 3.51 2026-04-15 实验室总库方案占用摘要回归

| 测试项 | 状态 | 备注 |
| ------ | ---- | ---- |
| 方案占用摘要类型检查 | 测试成功 | 已执行 `pnpm exec tsc --noEmit`，确认实验室总库卡片新增 `helperText` 占用摘要与候选兜底展示后无类型错误。 |
| 方案占用摘要单测回归 | 测试成功 | 已执行 `node --import tsx --test src/shared/lib/simulator-equipment-preview.test.ts`，确认装备卡片主属性预览会优先读取 `mainStat`，缺失时回退到 `stats/baseStats`，全空时显示 `待补充属性`。 |
| 已写入方案卡片摘要浏览器链路 | 测试成功 | 在“实验室 -> 装备总库 -> 全部来源”里，`沧海灵杖` 等已写入多套方案的装备卡片会直接显示 `方案占用：当前方案 / 高速方案 等 5 套`，无需点开详情即可判断方案占用。 |
| 候选独立卡片摘要浏览器链路 | 测试成功 | 浏览器通过 `/api/simulator/current/candidate-equipment` 注入已确认候选 `QA摘要候选腰带` 后，实验室总库未再报 `mainStat.split` 客户端异常；卡片会显示 `候选装备库`、`当前未写入任何装备方案`，并在字段不完整时退化显示 `待补充属性`。 |
| 候选摘要收尾清理 | 测试成功 | 在同一回归链路中点击卡片级 `移出候选库` 并确认后，顶部计数回落为 `装备总库 (12)`、`候选装备库 (0)`；切到候选来源视角可见空态 `当前筛选下暂无可用装备`，说明 QA 注入数据已完成清理。 |

### 3.52 2026-04-15 实验室总库对比席位快捷操作回归

| 测试项 | 状态 | 备注 |
| ------ | ---- | ---- |
| 对比席位快捷操作类型检查与 helper 单测 | 测试成功 | 已执行 `pnpm exec tsc --noEmit` 与 `node --import tsx --test src/shared/lib/simulator-equipment-plan-assignment.test.ts`，确认实验室总库卡片新增 `挂到对比席位 / 移出对比位 / 样本已继承` 语义后无类型错误，且 helper 能稳定区分样本继承、显式对比命中与未命中状态。 |
| 候选差异装备挂载浏览器链路 | 测试成功 | 浏览器通过 `/api/simulator/current/candidate-equipment` 注入已确认候选 `QA实验室差异腰带` 后，进入“实验室 -> 装备总库”可直接看到该卡片展示 `候选装备库`、`当前未写入任何装备方案` 与主按钮 `挂到对比席位`。点击后卡片状态立即切换为 `实验室:对比席位1`，主按钮变成禁用态 `已在对比席位1`，副按钮切为 `移出对比位`。 |
| 样本继承语义浏览器链路 | 测试成功 | 同一页面中，`沧海灵杖`、`星河腰带` 等样本位本来就继承的装备卡片会保持 `样本已继承` 禁用态，不会再被误判成“已在对比席位”，说明当前已能区分“样本基线继承”和“显式挂入对比位”的两种语义。 |
| 移出对比位浏览器链路 | 测试成功 | 对 `QA实验室差异腰带` 点击 `移出对比位` 后，卡片重新回到可投递状态，主按钮恢复为 `挂到对比席位`；同时对比席位里的该腰带被移除，可继续做下一轮差异测试。 |
| QA 数据清理收尾 | 测试成功 | 回归结束后，已通过 `/api/simulator/current/candidate-equipment` 清空本轮注入的 QA 候选，并再次点击实验室顶部 `读取`。最终页面回落为 `装备总库 (12)`、`候选装备库 (0)`，说明本轮浏览器 QA 未残留测试数据。 |

### 3.53 2026-04-15 前台总库正式库存来源接入回归

| 测试项 | 状态 | 备注 |
| ------ | ---- | ---- |
| 正式库存聚合单测回归 | 测试成功 | 已执行 `node --import tsx --test src/shared/lib/simulator-equipment-library.test.ts`，确认总库聚合逻辑现可同时合并 `当前方案 / 正式库存 / 候选装备库` 来源，且若同一件装备同时存在于候选库与正式库存，仍会保留候选项的主键与可操作性。 |
| 方案占用摘要排除正式库存 | 测试成功 | 已执行 `node --import tsx --test src/shared/lib/simulator-equipment-plan-assignment.test.ts`，确认 `buildEquipmentPlanUsageSummary(...)` 在加入 `正式库存` 来源后，仍只统计真正的装备方案占用，不会把正式库存标签误算成“方案占用”。 |
| 前台接线类型检查 | 测试成功 | 已执行 `pnpm exec tsc --noEmit`，确认当前装备页总库、实验室总库、前台正式库存读取接口，以及 `inventory_asset` 来源类型扩展后无类型错误。 |
| 浏览器接口探测 | 测试成功 | 已在有效登录态下重新验证本地 `http://localhost:3000/zh`，浏览器直接探测 `/api/simulator/current/inventory`、`/api/simulator/current/candidate-equipment` 均返回 `200 + code=0`；此前的 `401 no auth, please sign in` 已确认是旧会话残留现象，不再视为当前阻塞。 |

### 3.54 2026-04-16 实验室总库正式库存状态动作回归

| 测试项 | 状态 | 备注 |
| ------ | ---- | ---- |
| 实验室正式库存动作类型检查 | 测试成功 | 已执行 `pnpm exec tsc --noEmit`，确认实验室总库卡片、详情弹窗、确认弹窗与 `PATCH /api/simulator/current/inventory/[id]` 动作接线后无类型错误。 |
| 总库聚合与方案摘要回归 | 测试成功 | 已执行 `node --import tsx --test src/shared/lib/simulator-equipment-library.test.ts src/shared/lib/simulator-equipment-plan-assignment.test.ts src/shared/blocks/simulator/LaboratoryPanel/laboratory-utils.test.ts`，确认加入正式库存动作语义后，总库聚合、方案占用摘要与实验室总库构建逻辑未回归。 |
| 浏览器入口可见性检查 | 测试成功 | 已在本地 `http://localhost:3000/zh` 打开“实验室 -> 装备总库”，确认来源筛选已包含 `正式库存`，且实验室总库仍可正常展示方案来源卡片、详情入口与对比席位动作。 |
| 浏览器正式库存动作验收 | 测试成功 | 已在有效登录态下重新跑实验室 `装备总库 -> 正式库存` 链路：先通过候选确认生成一条 QA 正式库存，再验证卡片与详情动作均能更新正式库存状态，并同步把关联候选状态回写为 `replaced`；动作完成后正式库存视图即时归零。 |

### 3.55 2026-04-16 当前装备总库正式库存批量状态回归

| 测试项 | 状态 | 备注 |
| ------ | ---- | ---- |
| 正式库存状态 helper 单测 | 测试成功 | 已执行 `node --import tsx --test src/shared/lib/simulator-inventory-status.test.ts`，确认系统只允许操作 `active + candidate_library` 的正式库存 ref，并会在批量状态更新前对 entry id 去重。 |
| 当前装备总库批量动作类型检查 | 测试成功 | 已执行 `pnpm exec tsc --noEmit`，确认当前装备总库新增 `正式库存批量状态` 面板、批量确认弹窗、单件状态重构为可批量状态后无类型错误。 |
| 总库相关回归 | 测试成功 | 已执行 `node --import tsx --test src/shared/lib/simulator-inventory-status.test.ts src/shared/lib/simulator-equipment-library.test.ts src/shared/lib/simulator-equipment-plan-assignment.test.ts src/shared/blocks/simulator/LaboratoryPanel/laboratory-utils.test.ts`，确认正式库存批量状态 helper、总库聚合、方案占用摘要和实验室总库构建逻辑未回归。 |
| 浏览器批量状态验收 | 测试成功 | 已在 `当前状态 -> 装备总库 -> 正式库存` 注入一条 QA 候选入库记录，确认出现 `正式库存批量状态` 面板与 `批量标记已售出` 按钮；执行后 `PATCH /api/simulator/current/inventory/[id]` 返回 `200`，正式库存列表清空，随后 `/api/simulator/current/candidate-equipment` 返回该条候选已回写为 `replaced`。 |

### 3.56 2026-04-16 实验室总库正式库存批量状态回归

| 测试项 | 状态 | 备注 |
| ------ | ---- | ---- |
| 实验室批量状态动作类型检查 | 测试成功 | 已执行 `pnpm exec tsc --noEmit`，确认实验室总库顶部工具条新增 `批量标记已售出 / 批量标记作废`、确认弹窗改为支持单件/批量双态文案后无类型错误。 |
| 正式库存批量 helper 回归 | 测试成功 | 已执行 `node --import tsx --test src/shared/lib/simulator-inventory-status.test.ts src/shared/lib/simulator-equipment-library.test.ts src/shared/lib/simulator-equipment-plan-assignment.test.ts src/shared/blocks/simulator/LaboratoryPanel/laboratory-utils.test.ts`，确认实验室总库批量状态动作与当前装备总库共用的去重 helper、来源聚合与实验室总库构建逻辑均未回归。 |
| 浏览器批量状态验收 | 测试成功 | 已在 `实验室 -> 装备总库 -> 正式库存` 验证顶部工具条 `批量标记已售出 / 批量标记作废` 可见，并实际执行 `批量标记作废 (1)`；请求返回 `200` 后，`正式库存 (1)` 立即回落为 `正式库存 (0)`，同时 `/api/simulator/current/candidate-equipment` 中关联候选状态同步变为 `replaced`。 |
| QA 数据清理收尾 | 测试成功 | 本轮用于联调的 `QA批量状态测试杖` 已通过 `/api/simulator/current/candidate-equipment` 清空；收尾复查 `/api/simulator/current/inventory` 与 `/api/simulator/current/candidate-equipment` 均返回空数组，确认没有残留 QA 正式库存或候选记录。 |

### 3.57 2026-04-16 正式库存生命周期筛选与恢复待用回归

| 测试项 | 状态 | 备注 |
| ------ | ---- | ---- |
| 生命周期 helper 回归 | 测试成功 | 已执行 `node --import tsx --test src/shared/lib/simulator-inventory-status.test.ts src/shared/lib/simulator-equipment-library.test.ts`，确认正式库存状态摘要、候选来源筛选与 `restore-to-active` draft 构建逻辑可同时覆盖 `active / sold / discarded` 三类生命周期。 |
| 前台接线类型检查 | 测试成功 | 已执行 `pnpm exec tsc --noEmit`，确认当前装备总库、实验室总库、正式库存详情弹窗与恢复待用文案接线后无类型错误。 |
| 浏览器恢复待用验收 | 测试成功 | 已在有效登录态下通过浏览器同源请求复核 `/api/simulator/current/inventory?status=all` 与 `PATCH /api/simulator/current/inventory/[id]`：将 QA 样本 `QA恢复待用测试杖` 从 `sold` 更新为 `active` 后，接口返回 `status: active`，库存汇总同步变为 `active: 1 / sold: 0 / discarded: 13`，并且 `/api/simulator/current/candidate-equipment` 中对应候选状态已回写为 `confirmed`。 |
| 生命周期清理收尾 | 测试成功 | 回归结束后，已通过 `/api/simulator/current/candidate-equipment` 移除本轮 QA 候选；复查结果为候选库 `0` 条，正式库存 `active: 0 / sold: 0 / discarded: 14`。说明本轮样本不再占用待用/已售出视角，但当前“移除候选”语义会把关联正式库存回落为 `discarded`，不会做物理删除。 |

### 3.58 2026-04-16 正式库存治理收尾与选择器边界回归

| 测试项 | 状态 | 备注 |
| ------ | ---- | ---- |
| 选择器状态 helper 回归 | 测试成功 | 已执行 `node --import tsx --test src/shared/lib/simulator-inventory-status.test.ts`，确认只有带 `inventory_asset` 来源且存在 `active` 正式库存 ref 的卡片才会生成 `库存待用` 选择器徽标；普通候选或方案来源不会伪造库存状态。 |
| 前台接线类型检查 | 测试成功 | 已执行 `pnpm exec tsc --noEmit`，确认当前装备替换弹窗、实验室槽位选择器、两处总库、详情弹窗与统一正式库存 helper 接线后无类型错误。 |
| 实验室槽位选择器浏览器验收 | 测试成功 | 已在有效登录态下打开本地 `http://localhost:3000/zh`，进入 `实验室 -> 新增对比席位 -> 武器槽位选择器`；弹窗内已显示“已售出 / 已作废不会出现在这里，需到装备总库恢复待用”的边界说明，`QA恢复待用测试杖` 同时展示独立 `库存待用` 徽标与 `正式库存` 来源标签。 |
| 当前装备替换弹窗浏览器验收 | 测试成功 | 已在当前装备页临时卸下武器但不保存云端，再点击空武器槽打开普通换装弹窗；弹窗内同样展示统一边界说明，并且 `QA恢复待用测试杖` 以 `库存待用` 徽标 + `正式库存` 来源标签分离展示。验证后已刷新页面恢复云端装备状态。 |
| 正式库存收尾清理 | 测试成功 | 本轮用于选择器验收的 `QA恢复待用测试杖` 已通过 `PATCH /api/simulator/current/inventory/[id]` 回落为 `discarded`；复查 `/api/simulator/current/inventory?status=all` 返回该样本状态为 `discarded`，当前正式库存汇总为 `discarded: 14`，不再占用可换装 `active` 池。 |

### 3.59 2026-04-16 PRD V3.0 核心数值规则接入回归

| 测试项 | 状态 | 备注 |
| ------ | ---- | ---- |
| PRD 底盘类型检查 | 测试成功 | 已执行 `pnpm exec tsc --noEmit`，确认前台 `gameLogic`、服务端 `damage-engine`、实验室估值与面板来源拆解在接入 `PRD V3.0` 后无类型错误。 |
| 面板底盘共享回归 | 测试成功 | 已执行 `node --import tsx --test src/features/simulator/store/gameLogic.test.ts src/features/simulator/store/gameStore.test.ts src/shared/lib/simulator-panel-source-breakdown.test.ts`，确认 `HP/MP/DEF` 基础常数、`强身/冥想/强壮/神速` 作用方式、武器伤害 `/4 -> 法伤`、以及当前状态页的本地增量面板口径已统一。 |
| 服务端伤害主链回归 | 测试成功 | 已执行 `node --import tsx --test src/shared/services/damage-engine.test.ts src/shared/services/lab-valuation.test.ts`，确认 `龙卷雨击 = 技能等级 × 2.5`、`龙腾 = 技能等级²/120 + 技能等级 × 1.5 + 55` 已接入正式试算，同时天气、五行、分灵、修炼差、法伤结果、目标法防结果、符石组合、灵饰套装与玉魄百分比词条均继续可叠加。 |
| 前后端同源验证 | 测试成功 | 本轮已新增“被动修炼”显式专项回归，确认前台与服务端都按同一口径处理：`强身/冥想/强壮` 只放大各自基础部分，`神速` 按固定 `+1.5/级` 生效；实验室总伤估值继续复用服务端正式试算结果。 |

### 3.60 2026-04-17 PRD V3.0 符石 / 星石 / 最优解正式接入回归

| 测试项 | 状态 | 备注 |
| ------ | ---- | ---- |
| PRD 规则接线类型检查 | 测试成功 | 已执行 `pnpm exec tsc --noEmit`，确认 `rune_stone_rules / star_stone_rules / rune_combo_rules / star_full_color_rules / rune_optimizer_profiles` 接入现有规则中心后，前台编辑器、规则后台、面板推导与伤害试算均无类型错误。 |
| 符石/星石规则专项回归 | 测试成功 | 已执行 `node --import tsx --test src/shared/lib/simulator-rune-combo.test.ts src/shared/lib/simulator-rune-bonus.test.ts src/shared/lib/simulator-rune-editor.test.ts src/shared/lib/simulator-rune-skill.test.ts src/shared/lib/simulator-rune-star-rules.test.ts`，共 `22/22` 通过；覆盖 `海市蜃楼` 正式命名、旧 `九龙诀` 兼容映射、龙宫部位默认推荐、符石前缀降级与星石全套同色奖励。 |
| 伤害主链符石/星石回归 | 测试成功 | 已执行 `node --import tsx --test src/shared/services/damage-engine.test.ts`，共 `51/51` 通过；确认符石单颗属性、门派组合上限、`隔山打牛` 双套上限、星石基础属性、星石全套同色奖励，以及现有天气/五行/分灵/玉魄/灵饰套装扩展规则均能继续叠加。 |
| 全量模拟器回归 | 测试成功 | 已执行 `pnpm test:simulator`，共 `99/99` 通过；确认当前状态页、最终面板、实验室席位、实验室估值与服务端试算对同一套符石/星石数据保持同源。 |
| 前台编辑器与来源拆解验证 | 测试成功 | 已确认当前装备详情和实验室详情改为规则驱动选项：星石可按颜色选择，符石组合默认按“龙宫总伤”推荐最优解；面板来源拆解中已区分“星石基础属性”“星石全套同色奖励”“星相互合”三层来源，避免混淆。 |

### 3.61 2026-04-27 装备综合提升汇总层回归

| 测试项 | 状态 | 备注 |
| ------ | ---- | ---- |
| 汇总层类型检查 | 测试成功 | 已执行 `pnpm exec tsc --noEmit`，确认新接入的 `EquipmentImprovementSummaryCard`、当前装备详情弹窗与实验室详情弹窗在接入“综合提升”解释层后无类型错误。 |
| 汇总 helper 单测回归 | 测试成功 | 已执行 `node --import tsx --test src/shared/lib/simulator-equipment-improvement-summary.test.ts`，覆盖 `法伤 / 法伤等级 / 法爆等级 / 法暴率 / 灵力等价 / 双加 / 特技特效 / 符石组合` 的单件摘要与差异摘要解析。 |
| 主链兼容回归 | 测试成功 | 已执行 `node --import tsx --test src/shared/lib/simulator-equipment-improvement-summary.test.ts src/features/simulator/store/gameLogic.test.ts src/shared/services/damage-engine.test.ts`，共 `76/76` 通过；确认新解释层未回退现有前台面板、武器伤害 `/4 -> 法伤`、法爆等级折算法暴率，以及服务端伤害主链。 |
| 浏览器详情验收 | 未执行 | 本轮先完成视图层接线、类型检查与单测沉淀，尚未单独补跑“当前装备详情 / 实验室详情”人工浏览器 QA。 |
