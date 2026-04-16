# 装备图片库接入说明

当前装备图片接入采用两层文件：

1. `public/simulator/equipment-art/`
   - 放真实装备图片文件
   - 推荐按部位分目录，例如：
     - `public/simulator/equipment-art/weapon/沧海灵杖.webp`
     - `public/simulator/equipment-art/trinket/灵符·潮声.webp`
2. `data/simulator-equipment-artwork-manifest.source.json`
   - 放可维护的素材源数据
   - 用于补充别名等人工信息

当前约定：

- 真实装备素材文件本体先空着
- 项目里先只保留目录占位、manifest 结构和导入脚本
- 等后续收到正式 CC 素材包和别名表后，再批量执行导入

## 推荐操作流程

### 方式一：直接放入项目目录

1. 先把真实图片放进 `public/simulator/equipment-art/<type>/`
2. 执行 `pnpm simulator:artwork:sync-source`
   - 自动扫描目录
   - 按文件名生成 `source.json`
   - 已存在条目的 `aliases` 会尽量保留
3. 如有需要，手动补充 `aliases`
4. 执行 `pnpm simulator:artwork:build`
   - 生成前台实际使用的 `src/shared/lib/simulator-equipment-artwork-manifest.ts`
5. 执行校验
   - `pnpm simulator:artwork:check-source`
   - `pnpm simulator:artwork:check`

### 方式二：从外部素材目录批量导入

如果真实素材还在 CC 爬取目录或其他外部目录中，优先使用导入脚本：

```bash
pnpm simulator:artwork:import -- --source /path/to/cc-artwork
```

脚本会完成：

- 复制图片到 `public/simulator/equipment-art/<type>/`
- 自动执行 `simulator:artwork:sync-source`
- 如提供别名文件，则自动合并进 `data/simulator-equipment-artwork-manifest.source.json`
- 自动执行 `simulator:artwork:build`

支持两种外部目录结构：

```text
/path/to/cc-artwork/
  weapon/
    沧海灵杖.webp
  necklace/
    碧海项链.png
```

或平铺目录加类型前缀：

```text
/path/to/cc-artwork/
  weapon-沧海灵杖.webp
  腰带 星河腰带.webp
```

如果外部目录全是同一类装备，可以显式指定类型：

```bash
pnpm simulator:artwork:import -- --source /path/to/weapons --type weapon
```

常用参数：

- `--dry-run`：只打印导入计划，不复制文件
- `--overwrite`：允许覆盖项目内已有同名素材
- `--skip-rebuild`：只复制文件，不自动同步 source 与 manifest
- `--alias-file /path/to/aliases.json`：批量导入 OCR / 藏宝阁命名别名
- `--source-json /path/to/source.json`：指定要写入的 artwork source 文件，便于本地演练或测试

## 别名文件格式

支持两种格式。

### 方式一：对象数组

```json
[
  {
    "type": "weapon",
    "canonicalName": "沧海灵杖",
    "aliases": ["沧海神杖", "CC库-沧海灵杖"]
  }
]
```

### 方式二：键值映射

```json
{
  "weapon:沧海灵杖": ["沧海神杖", "CC库-沧海灵杖"],
  "腰带:星河腰带": ["星河神带"]
}
```

说明：

- `type` 支持英文类型，也支持 `武器 / 头盔 / 项链 / 衣服 / 腰带 / 鞋子 / 灵饰 / 玉魄 / 符石`
- 未命中当前 `source.json` 的 `type + canonicalName` 会跳过，并在导入日志里标记为 `skipped`
- 与 canonical 名称归一化后重复的别名会自动去重
- 别名最终会写入 `source.json`，再由 `build` 生成前台 manifest

带别名一起导入的例子：

```bash
pnpm simulator:artwork:import -- \
  --source /path/to/cc-artwork \
  --alias-file /path/to/cc-artwork-aliases.json
```

## 目录命名约定

- 一级目录必须是系统支持的装备类型：
  - `weapon`
  - `helmet`
  - `necklace`
  - `armor`
  - `belt`
  - `shoes`
  - `trinket`
  - `jade`
  - `runeStone`
  - `rune`
- 文件名默认直接作为 `canonicalName`
- 文件扩展名支持：
  - `.png`
  - `.jpg`
  - `.jpeg`
  - `.webp`
  - `.avif`
  - `.svg`

## 当前校验能力

- `source.json` 与目录扫描结果不一致时，`check-source` 会报错
- `manifest` 与 `source.json` 不一致时，`check` 会报错
- 中文文件名、空格文件名当前都支持进入 manifest 校验
- manifest 测试会校验：
  - 资源路径合法
  - manifest 引用文件真实存在
  - 归一化键唯一
  - 别名不冲突
  - 目录中的素材没有漏挂
