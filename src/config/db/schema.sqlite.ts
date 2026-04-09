import { sql } from 'drizzle-orm';
import {
  index,
  integer,
  real,
  sqliteTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core';

// SQLite has no schema concept like Postgres. Keep a `table` alias to minimize diff with pg schema.
const table = sqliteTable;

// SQLite "now" in epoch milliseconds (same expression drizzle used in `defaultNow()`).
const sqliteNowMs = sql`(cast((julianday('now') - 2440587.5)*86400000 as integer))`;

export const user = table(
  'user',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    email: text('email').notNull().unique(),
    emailVerified: integer('email_verified', { mode: 'boolean' })
      .default(false)
      .notNull(),
    image: text('image'),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .default(sqliteNowMs)
      .notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
      .default(sqliteNowMs)
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
    // Track first-touch acquisition channel (e.g. google, twitter, newsletter)
    utmSource: text('utm_source').notNull().default(''),
    ip: text('ip').notNull().default(''),
    locale: text('locale').notNull().default(''),
  },
  (table) => [
    // Search users by name in admin dashboard
    index('idx_user_name').on(table.name),
    // Order users by registration time for latest users list
    index('idx_user_created_at').on(table.createdAt),
  ]
);

export const session = table(
  'session',
  {
    id: text('id').primaryKey(),
    expiresAt: integer('expires_at', { mode: 'timestamp_ms' }).notNull(),
    token: text('token').notNull().unique(),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .default(sqliteNowMs)
      .notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
      .default(sqliteNowMs)
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
  },
  (table) => [
    // Composite: Query user sessions and filter by expiration
    // Can also be used for: WHERE userId = ? (left-prefix)
    index('idx_session_user_expires').on(table.userId, table.expiresAt),
  ]
);

export const account = table(
  'account',
  {
    id: text('id').primaryKey(),
    accountId: text('account_id').notNull(),
    providerId: text('provider_id').notNull(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    accessToken: text('access_token'),
    refreshToken: text('refresh_token'),
    idToken: text('id_token'),
    accessTokenExpiresAt: integer('access_token_expires_at', {
      mode: 'timestamp_ms',
    }),
    refreshTokenExpiresAt: integer('refresh_token_expires_at', {
      mode: 'timestamp_ms',
    }),
    scope: text('scope'),
    password: text('password'),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .default(sqliteNowMs)
      .notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
      .default(sqliteNowMs)
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [
    // Query all linked accounts for a user
    index('idx_account_user_id').on(table.userId),
    // Composite: OAuth login (most critical)
    // Can also be used for: WHERE providerId = ? (left-prefix)
    index('idx_account_provider_account').on(table.providerId, table.accountId),
  ]
);

export const verification = table(
  'verification',
  {
    id: text('id').primaryKey(),
    identifier: text('identifier').notNull(),
    value: text('value').notNull(),
    expiresAt: integer('expires_at', { mode: 'timestamp_ms' }).notNull(),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .default(sqliteNowMs)
      .notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
      .default(sqliteNowMs)
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [
    // Find verification code by identifier (e.g., find code by email)
    index('idx_verification_identifier').on(table.identifier),
  ]
);

export const gameCharacter = table(
  'game_character',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    serverName: text('server_name').notNull().default(''),
    school: text('school').notNull().default('龙宫'),
    roleType: text('role_type').notNull().default('法师'),
    level: integer('level').notNull().default(89),
    race: text('race').notNull().default(''),
    status: text('status').notNull().default('active'),
    currentSnapshotId: text('current_snapshot_id'),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .default(sqliteNowMs)
      .notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
      .default(sqliteNowMs)
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [
    uniqueIndex('uidx_game_character_user_name').on(table.userId, table.name),
    index('idx_game_character_user_status').on(table.userId, table.status),
  ]
);

export const characterSnapshot = table(
  'character_snapshot',
  {
    id: text('id').primaryKey(),
    characterId: text('character_id')
      .notNull()
      .references(() => gameCharacter.id, { onDelete: 'cascade' }),
    snapshotType: text('snapshot_type').notNull().default('current'),
    name: text('name').notNull().default('????'),
    versionNo: integer('version_no').notNull().default(1),
    source: text('source').notNull().default('manual'),
    notes: text('notes').notNull().default(''),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .default(sqliteNowMs)
      .notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
      .default(sqliteNowMs)
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [
    index('idx_character_snapshot_character_created').on(
      table.characterId,
      table.createdAt
    ),
    index('idx_character_snapshot_character_type').on(
      table.characterId,
      table.snapshotType
    ),
  ]
);

export const characterProfile = table('character_profile', {
  snapshotId: text('snapshot_id')
    .primaryKey()
    .references(() => characterSnapshot.id, { onDelete: 'cascade' }),
  school: text('school').notNull().default('龙宫'),
  level: integer('level').notNull().default(89),
  physique: integer('physique').notNull().default(0),
  magic: integer('magic').notNull().default(0),
  strength: integer('strength').notNull().default(0),
  endurance: integer('endurance').notNull().default(0),
  agility: integer('agility').notNull().default(0),
  potentialPoints: integer('potential_points').notNull().default(0),
  hp: real('hp').notNull().default(0),
  mp: real('mp').notNull().default(0),
  damage: real('damage').notNull().default(0),
  defense: real('defense').notNull().default(0),
  magicDamage: real('magic_damage').notNull().default(0),
  magicDefense: real('magic_defense').notNull().default(0),
  speed: real('speed').notNull().default(0),
  hit: real('hit').notNull().default(0),
  sealHit: real('seal_hit').notNull().default(0),
  rawBodyJson: text('raw_body_json').notNull().default('{}'),
});

export const characterSkill = table(
  'character_skill',
  {
    id: text('id').primaryKey(),
    snapshotId: text('snapshot_id')
      .notNull()
      .references(() => characterSnapshot.id, { onDelete: 'cascade' }),
    skillCode: text('skill_code').notNull().default(''),
    skillName: text('skill_name').notNull(),
    baseLevel: integer('base_level').notNull().default(0),
    extraLevel: integer('extra_level').notNull().default(0),
    finalLevel: integer('final_level').notNull().default(0),
    sourceDetailJson: text('source_detail_json').notNull().default('{}'),
  },
  (table) => [
    uniqueIndex('uidx_character_skill_snapshot_code').on(
      table.snapshotId,
      table.skillCode
    ),
  ]
);

export const characterCultivation = table(
  'character_cultivation',
  {
    id: text('id').primaryKey(),
    snapshotId: text('snapshot_id')
      .notNull()
      .references(() => characterSnapshot.id, { onDelete: 'cascade' }),
    cultivationType: text('cultivation_type').notNull(),
    level: integer('level').notNull().default(0),
  },
  (table) => [
    uniqueIndex('uidx_character_cultivation_snapshot_type').on(
      table.snapshotId,
      table.cultivationType
    ),
  ]
);

export const equipmentItem = table(
  'equipment_item',
  {
    id: text('id').primaryKey(),
    characterId: text('character_id')
      .notNull()
      .references(() => gameCharacter.id, { onDelete: 'cascade' }),
    slot: text('slot').notNull(),
    name: text('name').notNull(),
    level: integer('level').notNull().default(0),
    quality: text('quality').notNull().default(''),
    price: integer('price').notNull().default(0),
    source: text('source').notNull().default('manual'),
    status: text('status').notNull().default('equipped'),
    isLocked: integer('is_locked', { mode: 'boolean' })
      .notNull()
      .default(false),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .default(sqliteNowMs)
      .notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
      .default(sqliteNowMs)
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [
    index('idx_equipment_item_character_slot_status').on(
      table.characterId,
      table.slot,
      table.status
    ),
  ]
);

export const equipmentBuild = table('equipment_build', {
  equipmentId: text('equipment_id')
    .primaryKey()
    .references(() => equipmentItem.id, { onDelete: 'cascade' }),
  holeCount: integer('hole_count').notNull().default(0),
  gemLevelTotal: integer('gem_level_total').notNull().default(0),
  refineLevel: integer('refine_level').notNull().default(0),
  specialEffectJson: text('special_effect_json').notNull().default('{}'),
  setEffectJson: text('set_effect_json').notNull().default('{}'),
  notesJson: text('notes_json').notNull().default('{}'),
});

export const equipmentAttr = table('equipment_attr', {
  id: text('id').primaryKey(),
  equipmentId: text('equipment_id')
    .notNull()
    .references(() => equipmentItem.id, { onDelete: 'cascade' }),
  attrGroup: text('attr_group').notNull().default('extra'),
  attrType: text('attr_type').notNull(),
  valueType: text('value_type').notNull().default('flat'),
  attrValue: real('attr_value').notNull().default(0),
  displayOrder: integer('display_order').notNull().default(0),
});

export const ornamentItem = table(
  'ornament_item',
  {
    id: text('id').primaryKey(),
    characterId: text('character_id')
      .notNull()
      .references(() => gameCharacter.id, { onDelete: 'cascade' }),
    slot: text('slot').notNull(),
    name: text('name').notNull(),
    level: integer('level').notNull().default(0),
    quality: text('quality').notNull().default(''),
    mainAttrType: text('main_attr_type').notNull().default(''),
    mainAttrValue: real('main_attr_value').notNull().default(0),
    price: integer('price').notNull().default(0),
    source: text('source').notNull().default('manual'),
    status: text('status').notNull().default('equipped'),
    specialEffectJson: text('special_effect_json').notNull().default('{}'),
    setEffectJson: text('set_effect_json').notNull().default('{}'),
    notesJson: text('notes_json').notNull().default('{}'),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .default(sqliteNowMs)
      .notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
      .default(sqliteNowMs)
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [
    index('idx_ornament_item_character_slot_status').on(
      table.characterId,
      table.slot,
      table.status
    ),
  ]
);

export const ornamentSubAttr = table('ornament_sub_attr', {
  id: text('id').primaryKey(),
  ornamentId: text('ornament_id')
    .notNull()
    .references(() => ornamentItem.id, { onDelete: 'cascade' }),
  attrType: text('attr_type').notNull(),
  attrValue: real('attr_value').notNull().default(0),
  displayOrder: integer('display_order').notNull().default(0),
});

export const ornamentSetEffect = table(
  'ornament_set_effect',
  {
    id: text('id').primaryKey(),
    snapshotId: text('snapshot_id')
      .notNull()
      .references(() => characterSnapshot.id, { onDelete: 'cascade' }),
    setName: text('set_name').notNull(),
    totalLevel: integer('total_level').notNull().default(0),
    tier: integer('tier').notNull().default(0),
    effectJson: text('effect_json').notNull().default('{}'),
  },
  (table) => [
    uniqueIndex('uidx_ornament_set_effect_snapshot_name').on(
      table.snapshotId,
      table.setName
    ),
  ]
);

export const jadeItem = table(
  'jade_item',
  {
    id: text('id').primaryKey(),
    characterId: text('character_id')
      .notNull()
      .references(() => gameCharacter.id, { onDelete: 'cascade' }),
    slot: text('slot').notNull(),
    name: text('name').notNull(),
    quality: text('quality').notNull().default(''),
    fitLevel: integer('fit_level').notNull().default(0),
    price: integer('price').notNull().default(0),
    source: text('source').notNull().default('manual'),
    status: text('status').notNull().default('equipped'),
    specialEffectJson: text('special_effect_json').notNull().default('{}'),
    setEffectJson: text('set_effect_json').notNull().default('{}'),
    notesJson: text('notes_json').notNull().default('{}'),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .default(sqliteNowMs)
      .notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
      .default(sqliteNowMs)
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [
    index('idx_jade_item_character_slot_status').on(
      table.characterId,
      table.slot,
      table.status
    ),
  ]
);

export const jadeAttr = table('jade_attr', {
  id: text('id').primaryKey(),
  jadeId: text('jade_id')
    .notNull()
    .references(() => jadeItem.id, { onDelete: 'cascade' }),
  attrType: text('attr_type').notNull(),
  valueType: text('value_type').notNull().default('flat'),
  attrValue: real('attr_value').notNull().default(0),
  displayOrder: integer('display_order').notNull().default(0),
});

export const snapshotEquipmentSlot = table(
  'snapshot_equipment_slot',
  {
    id: text('id').primaryKey(),
    snapshotId: text('snapshot_id')
      .notNull()
      .references(() => characterSnapshot.id, { onDelete: 'cascade' }),
    slot: text('slot').notNull(),
    equipmentId: text('equipment_id')
      .notNull()
      .references(() => equipmentItem.id, { onDelete: 'cascade' }),
  },
  (table) => [
    uniqueIndex('uidx_snapshot_equipment_slot').on(
      table.snapshotId,
      table.slot
    ),
  ]
);

export const snapshotOrnamentSlot = table(
  'snapshot_ornament_slot',
  {
    id: text('id').primaryKey(),
    snapshotId: text('snapshot_id')
      .notNull()
      .references(() => characterSnapshot.id, { onDelete: 'cascade' }),
    slot: text('slot').notNull(),
    ornamentId: text('ornament_id')
      .notNull()
      .references(() => ornamentItem.id, { onDelete: 'cascade' }),
  },
  (table) => [
    uniqueIndex('uidx_snapshot_ornament_slot').on(table.snapshotId, table.slot),
  ]
);

export const snapshotJadeSlot = table(
  'snapshot_jade_slot',
  {
    id: text('id').primaryKey(),
    snapshotId: text('snapshot_id')
      .notNull()
      .references(() => characterSnapshot.id, { onDelete: 'cascade' }),
    slot: text('slot').notNull(),
    jadeId: text('jade_id')
      .notNull()
      .references(() => jadeItem.id, { onDelete: 'cascade' }),
  },
  (table) => [
    uniqueIndex('uidx_snapshot_jade_slot').on(table.snapshotId, table.slot),
  ]
);

export const equipmentPlan = table(
  'equipment_plan',
  {
    id: text('id').primaryKey(),
    characterId: text('character_id')
      .notNull()
      .references(() => gameCharacter.id, { onDelete: 'cascade' }),
    name: text('name').notNull().default(''),
    sort: integer('sort').notNull().default(0),
    isActive: integer('is_active', { mode: 'boolean' })
      .notNull()
      .default(false),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .default(sqliteNowMs)
      .notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
      .default(sqliteNowMs)
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [
    index('idx_equipment_plan_character_sort').on(
      table.characterId,
      table.sort,
      table.updatedAt
    ),
    index('idx_equipment_plan_character_active').on(
      table.characterId,
      table.isActive,
      table.updatedAt
    ),
  ]
);

export const equipmentPlanItem = table(
  'equipment_plan_item',
  {
    id: text('id').primaryKey(),
    planId: text('plan_id')
      .notNull()
      .references(() => equipmentPlan.id, { onDelete: 'cascade' }),
    slotKey: text('slot_key').notNull().default(''),
    itemType: text('item_type').notNull().default('equipment'),
    payloadJson: text('payload_json').notNull().default('{}'),
    sort: integer('sort').notNull().default(0),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .default(sqliteNowMs)
      .notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
      .default(sqliteNowMs)
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [
    index('idx_equipment_plan_item_plan_sort').on(
      table.planId,
      table.sort,
      table.updatedAt
    ),
    uniqueIndex('uidx_equipment_plan_item_plan_slot').on(
      table.planId,
      table.slotKey
    ),
  ]
);

export const battleTargetTemplate = table(
  'battle_target_template',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').references(() => user.id, { onDelete: 'cascade' }),
    scope: text('scope').notNull().default('system'),
    name: text('name').notNull(),
    dungeonName: text('dungeon_name').notNull().default(''),
    targetType: text('target_type').notNull().default('mob'),
    school: text('school').notNull().default(''),
    level: integer('level').notNull().default(0),
    hp: real('hp').notNull().default(0),
    defense: real('defense').notNull().default(0),
    magicDefense: real('magic_defense').notNull().default(0),
    magicDefenseCultivation: integer('magic_defense_cultivation')
      .notNull()
      .default(0),
    speed: real('speed').notNull().default(0),
    element: text('element').notNull().default(''),
    formation: text('formation').notNull().default('普通阵'),
    notes: text('notes').notNull().default(''),
    payloadJson: text('payload_json').notNull().default('{}'),
    enabled: integer('enabled', { mode: 'boolean' }).notNull().default(true),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .default(sqliteNowMs)
      .notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
      .default(sqliteNowMs)
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [
    index('idx_battle_target_template_scope_enabled').on(
      table.scope,
      table.enabled,
      table.name
    ),
    index('idx_battle_target_template_user_enabled').on(
      table.userId,
      table.enabled,
      table.updatedAt
    ),
  ]
);

export const ruleVersion = table(
  'rule_version',
  {
    id: text('id').primaryKey(),
    ruleDomain: text('rule_domain').notNull().default('damage'),
    versionCode: text('version_code').notNull(),
    versionName: text('version_name').notNull(),
    status: text('status').notNull().default('draft'),
    isActive: integer('is_active', { mode: 'boolean' })
      .notNull()
      .default(false),
    sourceDocUrl: text('source_doc_url').notNull().default(''),
    notes: text('notes').notNull().default(''),
    createdBy: text('created_by').notNull().default('system'),
    publishedBy: text('published_by').notNull().default(''),
    publishedAt: integer('published_at', { mode: 'timestamp_ms' }),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .default(sqliteNowMs)
      .notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
      .default(sqliteNowMs)
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [
    uniqueIndex('uidx_rule_version_code').on(table.versionCode),
    index('idx_rule_version_domain_active').on(
      table.ruleDomain,
      table.isActive,
      table.status
    ),
  ]
);

export const ruleAttribute = table(
  'rule_attribute',
  {
    id: text('id').primaryKey(),
    versionId: text('version_id')
      .notNull()
      .references(() => ruleVersion.id, { onDelete: 'cascade' }),
    school: text('school').notNull(),
    roleType: text('role_type').notNull(),
    sourceAttr: text('source_attr').notNull(),
    targetAttr: text('target_attr').notNull(),
    coefficient: real('coefficient').notNull().default(0),
    valueType: text('value_type').notNull().default('linear'),
    conditionJson: text('condition_json').notNull().default('{}'),
    sort: integer('sort').notNull().default(0),
    enabled: integer('enabled', { mode: 'boolean' }).notNull().default(true),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .default(sqliteNowMs)
      .notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
      .default(sqliteNowMs)
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [
    uniqueIndex('uidx_rule_attribute_scope').on(
      table.versionId,
      table.school,
      table.roleType,
      table.sourceAttr,
      table.targetAttr
    ),
    index('idx_rule_attribute_lookup').on(
      table.versionId,
      table.school,
      table.roleType,
      table.enabled,
      table.sort
    ),
  ]
);

export const ruleSkillFormula = table(
  'rule_skill_formula',
  {
    id: text('id').primaryKey(),
    versionId: text('version_id')
      .notNull()
      .references(() => ruleVersion.id, { onDelete: 'cascade' }),
    school: text('school').notNull(),
    roleType: text('role_type').notNull(),
    skillCode: text('skill_code').notNull(),
    skillName: text('skill_name').notNull(),
    formulaKey: text('formula_key').notNull(),
    baseFormulaJson: text('base_formula_json').notNull().default('{}'),
    extraFormulaJson: text('extra_formula_json').notNull().default('{}'),
    conditionJson: text('condition_json').notNull().default('{}'),
    sort: integer('sort').notNull().default(0),
    enabled: integer('enabled', { mode: 'boolean' }).notNull().default(true),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .default(sqliteNowMs)
      .notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
      .default(sqliteNowMs)
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [
    uniqueIndex('uidx_rule_skill_formula_scope').on(
      table.versionId,
      table.skillCode
    ),
    index('idx_rule_skill_formula_lookup').on(
      table.versionId,
      table.school,
      table.roleType,
      table.enabled
    ),
  ]
);

export const ruleDamageModifier = table(
  'rule_damage_modifier',
  {
    id: text('id').primaryKey(),
    versionId: text('version_id')
      .notNull()
      .references(() => ruleVersion.id, { onDelete: 'cascade' }),
    modifierDomain: text('modifier_domain').notNull(),
    modifierKey: text('modifier_key').notNull(),
    modifierType: text('modifier_type').notNull(),
    sourceKey: text('source_key').notNull().default(''),
    targetKey: text('target_key').notNull().default(''),
    value: real('value').notNull().default(0),
    valueJson: text('value_json').notNull().default('{}'),
    conditionJson: text('condition_json').notNull().default('{}'),
    sort: integer('sort').notNull().default(0),
    enabled: integer('enabled', { mode: 'boolean' }).notNull().default(true),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .default(sqliteNowMs)
      .notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
      .default(sqliteNowMs)
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [
    index('idx_rule_damage_modifier_lookup').on(
      table.versionId,
      table.modifierDomain,
      table.modifierKey,
      table.enabled,
      table.sort
    ),
  ]
);

export const ruleSkillBonus = table(
  'rule_skill_bonus',
  {
    id: text('id').primaryKey(),
    versionId: text('version_id')
      .notNull()
      .references(() => ruleVersion.id, { onDelete: 'cascade' }),
    bonusGroup: text('bonus_group').notNull(),
    ruleCode: text('rule_code').notNull(),
    skillCode: text('skill_code').notNull(),
    skillName: text('skill_name').notNull(),
    bonusType: text('bonus_type').notNull().default('skill_level'),
    bonusValue: integer('bonus_value').notNull().default(0),
    conditionJson: text('condition_json').notNull().default('{}'),
    conflictPolicy: text('conflict_policy').notNull().default('take_max'),
    limitPolicyJson: text('limit_policy_json').notNull().default('{}'),
    sort: integer('sort').notNull().default(0),
    enabled: integer('enabled', { mode: 'boolean' }).notNull().default(true),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .default(sqliteNowMs)
      .notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
      .default(sqliteNowMs)
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [
    index('idx_rule_skill_bonus_lookup').on(
      table.versionId,
      table.skillCode,
      table.ruleCode,
      table.enabled,
      table.sort
    ),
  ]
);

export const rulePublishLog = table(
  'rule_publish_log',
  {
    id: text('id').primaryKey(),
    versionId: text('version_id')
      .notNull()
      .references(() => ruleVersion.id, { onDelete: 'cascade' }),
    action: text('action').notNull(),
    operatorId: text('operator_id').notNull().default('system'),
    beforeSnapshotJson: text('before_snapshot_json').notNull().default('{}'),
    afterSnapshotJson: text('after_snapshot_json').notNull().default('{}'),
    notes: text('notes').notNull().default(''),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .default(sqliteNowMs)
      .notNull(),
  },
  (table) => [
    index('idx_rule_publish_log_version_created').on(
      table.versionId,
      table.createdAt
    ),
  ]
);

export const ruleSimulationCase = table(
  'rule_simulation_case',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    versionId: text('version_id').references(() => ruleVersion.id, {
      onDelete: 'set null',
    }),
    inputJson: text('input_json').notNull().default('{}'),
    expectedResultJson: text('expected_result_json').notNull().default('{}'),
    notes: text('notes').notNull().default(''),
    enabled: integer('enabled', { mode: 'boolean' }).notNull().default(true),
    createdBy: text('created_by').notNull().default('system'),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .default(sqliteNowMs)
      .notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
      .default(sqliteNowMs)
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [
    index('idx_rule_simulation_case_enabled_created').on(
      table.enabled,
      table.createdAt
    ),
    index('idx_rule_simulation_case_version').on(table.versionId),
  ]
);

export const snapshotBattleContext = table(
  'snapshot_battle_context',
  {
    snapshotId: text('snapshot_id')
      .primaryKey()
      .references(() => characterSnapshot.id, { onDelete: 'cascade' }),
    ruleVersionId: text('rule_version_id').references(() => ruleVersion.id, {
      onDelete: 'set null',
    }),
    selfFormation: text('self_formation').notNull().default('天覆阵'),
    selfElement: text('self_element').notNull().default('水'),
    formationCounterState: text('formation_counter_state')
      .notNull()
      .default('无克/普通'),
    elementRelation: text('element_relation').notNull().default('无克/普通'),
    transformCardFactor: real('transform_card_factor').notNull().default(1),
    splitTargetCount: integer('split_target_count').notNull().default(1),
    shenmuValue: real('shenmu_value').notNull().default(0),
    magicResult: real('magic_result').notNull().default(0),
    targetTemplateId: text('target_template_id').references(
      () => battleTargetTemplate.id,
      {
        onDelete: 'set null',
      }
    ),
    targetName: text('target_name').notNull().default('默认目标'),
    targetLevel: integer('target_level').notNull().default(0),
    targetHp: real('target_hp').notNull().default(0),
    targetDefense: real('target_defense').notNull().default(0),
    targetMagicDefense: real('target_magic_defense').notNull().default(0),
    targetSpeed: real('target_speed').notNull().default(0),
    targetMagicDefenseCultivation: integer('target_magic_defense_cultivation')
      .notNull()
      .default(0),
    targetElement: text('target_element').notNull().default(''),
    targetFormation: text('target_formation').notNull().default('普通阵'),
    notesJson: text('notes_json').notNull().default('{}'),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .default(sqliteNowMs)
      .notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
      .default(sqliteNowMs)
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [
    index('idx_snapshot_battle_context_rule_version').on(table.ruleVersionId),
    index('idx_snapshot_battle_context_target_template').on(
      table.targetTemplateId
    ),
  ]
);

export const labSession = table(
  'lab_session',
  {
    id: text('id').primaryKey(),
    characterId: text('character_id')
      .notNull()
      .references(() => gameCharacter.id, { onDelete: 'cascade' }),
    baselineSnapshotId: text('baseline_snapshot_id')
      .notNull()
      .references(() => characterSnapshot.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    status: text('status').notNull().default('active'),
    notes: text('notes').notNull().default(''),
    createdBy: text('created_by').notNull().default('system'),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .default(sqliteNowMs)
      .notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
      .default(sqliteNowMs)
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [
    index('idx_lab_session_character_status').on(
      table.characterId,
      table.status,
      table.updatedAt
    ),
    index('idx_lab_session_baseline_snapshot').on(table.baselineSnapshotId),
  ]
);

export const labSessionEquipment = table(
  'lab_session_equipment',
  {
    id: text('id').primaryKey(),
    sessionId: text('session_id')
      .notNull()
      .references(() => labSession.id, { onDelete: 'cascade' }),
    seatType: text('seat_type').notNull().default('compare'),
    slot: text('slot').notNull(),
    equipmentId: text('equipment_id').references(() => equipmentItem.id, {
      onDelete: 'set null',
    }),
    payloadJson: text('payload_json').notNull().default('{}'),
    source: text('source').notNull().default('library'),
    inheritGemstones: integer('inherit_gemstones', { mode: 'boolean' })
      .notNull()
      .default(false),
    inheritRuneStones: integer('inherit_rune_stones', { mode: 'boolean' })
      .notNull()
      .default(false),
    sort: integer('sort').notNull().default(0),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .default(sqliteNowMs)
      .notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
      .default(sqliteNowMs)
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [
    uniqueIndex('uidx_lab_session_equipment_seat_slot').on(
      table.sessionId,
      table.seatType,
      table.slot
    ),
    index('idx_lab_session_equipment_session_sort').on(
      table.sessionId,
      table.seatType,
      table.sort
    ),
  ]
);

export const ocrJob = table(
  'ocr_job',
  {
    id: text('id').primaryKey(),
    characterId: text('character_id')
      .notNull()
      .references(() => gameCharacter.id, { onDelete: 'cascade' }),
    sceneType: text('scene_type').notNull().default('equipment'),
    imageUrl: text('image_url').notNull().default(''),
    status: text('status').notNull().default('pending'),
    rawResultJson: text('raw_result_json').notNull().default('{}'),
    errorMessage: text('error_message').notNull().default(''),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .default(sqliteNowMs)
      .notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
      .default(sqliteNowMs)
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [
    index('idx_ocr_job_character_created').on(
      table.characterId,
      table.createdAt
    ),
    index('idx_ocr_job_status_updated').on(table.status, table.updatedAt),
  ]
);

export const ocrDraftItem = table(
  'ocr_draft_item',
  {
    id: text('id').primaryKey(),
    ocrJobId: text('ocr_job_id')
      .notNull()
      .references(() => ocrJob.id, { onDelete: 'cascade' }),
    characterId: text('character_id')
      .notNull()
      .references(() => gameCharacter.id, { onDelete: 'cascade' }),
    itemType: text('item_type').notNull().default('equipment'),
    draftBodyJson: text('draft_body_json').notNull().default('{}'),
    confidenceScore: real('confidence_score').notNull().default(0),
    reviewStatus: text('review_status').notNull().default('pending'),
    reviewNote: text('review_note').notNull().default(''),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .default(sqliteNowMs)
      .notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
      .default(sqliteNowMs)
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [
    index('idx_ocr_draft_item_character_review_created').on(
      table.characterId,
      table.reviewStatus,
      table.createdAt
    ),
    index('idx_ocr_draft_item_job').on(table.ocrJobId, table.createdAt),
  ]
);

export const ocrDictionary = table(
  'ocr_dictionary',
  {
    id: text('id').primaryKey(),
    dictType: text('dict_type').notNull().default('equipment_name'),
    rawText: text('raw_text').notNull(),
    normalizedText: text('normalized_text').notNull(),
    priority: integer('priority').notNull().default(0),
    enabled: integer('enabled', { mode: 'boolean' }).notNull().default(true),
    createdBy: text('created_by').notNull().default('system'),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .default(sqliteNowMs)
      .notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
      .default(sqliteNowMs)
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [
    index('idx_ocr_dictionary_type_raw_text').on(table.dictType, table.rawText),
    index('idx_ocr_dictionary_enabled_priority').on(
      table.enabled,
      table.priority,
      table.updatedAt
    ),
  ]
);

export const inventoryEquipmentAsset = table(
  'inventory_equipment_asset',
  {
    id: text('id').primaryKey(),
    characterId: text('character_id')
      .notNull()
      .references(() => gameCharacter.id, { onDelete: 'cascade' }),
    itemType: text('item_type').notNull().default('equipment'),
    sourceCandidateId: text('source_candidate_id'),
    sourceDraftId: text('source_draft_id').references(() => ocrDraftItem.id, {
      onDelete: 'set null',
    }),
    itemName: text('item_name').notNull().default(''),
    itemSubtype: text('item_subtype').notNull().default(''),
    slotKey: text('slot_key').notNull().default(''),
    payloadJson: text('payload_json').notNull().default('{}'),
    priceSnapshot: integer('price_snapshot'),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .default(sqliteNowMs)
      .notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
      .default(sqliteNowMs)
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [
    index('idx_inventory_asset_character_type_status').on(
      table.characterId,
      table.itemType,
      table.updatedAt
    ),
    index('idx_inventory_asset_source_draft').on(table.sourceDraftId),
    uniqueIndex('uidx_inventory_asset_source_candidate').on(
      table.sourceCandidateId
    ),
  ]
);

export const inventoryEntry = table(
  'inventory_entry',
  {
    id: text('id').primaryKey(),
    characterId: text('character_id')
      .notNull()
      .references(() => gameCharacter.id, { onDelete: 'cascade' }),
    itemType: text('item_type').notNull().default('equipment'),
    itemRefId: text('item_ref_id').notNull(),
    sourceDraftId: text('source_draft_id').references(() => ocrDraftItem.id, {
      onDelete: 'set null',
    }),
    folderKey: text('folder_key').notNull().default('equipment'),
    price: integer('price'),
    status: text('status').notNull().default('active'),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .default(sqliteNowMs)
      .notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
      .default(sqliteNowMs)
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [
    index('idx_inventory_entry_character_type_status').on(
      table.characterId,
      table.itemType,
      table.status
    ),
    index('idx_inventory_entry_folder_status').on(
      table.folderKey,
      table.status
    ),
    uniqueIndex('uidx_inventory_entry_item_ref_type').on(
      table.itemRefId,
      table.itemType
    ),
  ]
);

export const candidateEquipment = table(
  'candidate_equipment',
  {
    id: text('id').primaryKey(),
    characterId: text('character_id')
      .notNull()
      .references(() => gameCharacter.id, { onDelete: 'cascade' }),
    status: text('status').notNull().default('pending'),
    source: text('source').notNull().default('manual'),
    equipmentJson: text('equipment_json').notNull().default('{}'),
    imageKey: text('image_key'),
    rawText: text('raw_text'),
    targetSetId: text('target_set_id'),
    targetEquipmentId: text('target_equipment_id'),
    targetRuneStoneSetIndex: integer('target_rune_stone_set_index'),
    ocrJobId: text('ocr_job_id').references(() => ocrJob.id, {
      onDelete: 'set null',
    }),
    ocrDraftItemId: text('ocr_draft_item_id').references(
      () => ocrDraftItem.id,
      {
        onDelete: 'set null',
      }
    ),
    sort: integer('sort').notNull().default(0),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .default(sqliteNowMs)
      .notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
      .default(sqliteNowMs)
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [
    index('idx_candidate_equipment_character_status').on(
      table.characterId,
      table.status,
      table.updatedAt
    ),
    index('idx_candidate_equipment_character_sort').on(
      table.characterId,
      table.sort
    ),
    index('idx_candidate_equipment_ocr_draft').on(table.ocrDraftItemId),
  ]
);

export const config = table('config', {
  name: text('name').unique().notNull(),
  value: text('value'),
});

export const taxonomy = table(
  'taxonomy',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    parentId: text('parent_id'),
    slug: text('slug').unique().notNull(),
    type: text('type').notNull(),
    title: text('title').notNull(),
    description: text('description'),
    image: text('image'),
    icon: text('icon'),
    status: text('status').notNull(),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .default(sqliteNowMs)
      .notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
      .default(sqliteNowMs)
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
    deletedAt: integer('deleted_at', { mode: 'timestamp_ms' }),
    sort: integer('sort').default(0).notNull(),
  },
  (table) => [
    // Composite: Query taxonomies by type and status
    // Can also be used for: WHERE type = ? (left-prefix)
    index('idx_taxonomy_type_status').on(table.type, table.status),
  ]
);

export const post = table(
  'post',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    parentId: text('parent_id'),
    slug: text('slug').unique().notNull(),
    type: text('type').notNull(),
    title: text('title'),
    description: text('description'),
    image: text('image'),
    content: text('content'),
    categories: text('categories'),
    tags: text('tags'),
    authorName: text('author_name'),
    authorImage: text('author_image'),
    status: text('status').notNull(),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .default(sqliteNowMs)
      .notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
      .default(sqliteNowMs)
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
    deletedAt: integer('deleted_at', { mode: 'timestamp_ms' }),
    sort: integer('sort').default(0).notNull(),
  },
  (table) => [
    // Composite: Query posts by type and status
    // Can also be used for: WHERE type = ? (left-prefix)
    index('idx_post_type_status').on(table.type, table.status),
  ]
);

export const order = table(
  'order',
  {
    id: text('id').primaryKey(),
    orderNo: text('order_no').unique().notNull(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    userEmail: text('user_email'), // checkout user email
    status: text('status').notNull(), // created, paid, failed
    amount: integer('amount').notNull(), // checkout amount in cents
    currency: text('currency').notNull(), // checkout currency
    productId: text('product_id'),
    paymentType: text('payment_type'), // one_time, subscription
    paymentInterval: text('payment_interval'), // day, week, month, year
    paymentProvider: text('payment_provider').notNull(),
    paymentSessionId: text('payment_session_id'),
    checkoutInfo: text('checkout_info').notNull(), // checkout request info
    checkoutResult: text('checkout_result'), // checkout result
    paymentResult: text('payment_result'), // payment result
    discountCode: text('discount_code'), // discount code
    discountAmount: integer('discount_amount'), // discount amount in cents
    discountCurrency: text('discount_currency'), // discount currency
    paymentEmail: text('payment_email'), // actual payment email
    paymentAmount: integer('payment_amount'), // actual payment amount
    paymentCurrency: text('payment_currency'), // actual payment currency
    paidAt: integer('paid_at', { mode: 'timestamp_ms' }), // paid at
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .default(sqliteNowMs)
      .notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
      .default(sqliteNowMs)
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
    deletedAt: integer('deleted_at', { mode: 'timestamp_ms' }),
    description: text('description'), // order description
    productName: text('product_name'), // product name
    subscriptionId: text('subscription_id'), // provider subscription id
    subscriptionResult: text('subscription_result'), // provider subscription result
    checkoutUrl: text('checkout_url'), // checkout url
    callbackUrl: text('callback_url'), // callback url, after handle callback
    creditsAmount: integer('credits_amount'), // credits amount
    creditsValidDays: integer('credits_valid_days'), // credits validity days
    planName: text('plan_name'), // subscription plan name
    paymentProductId: text('payment_product_id'), // payment product id
    invoiceId: text('invoice_id'),
    invoiceUrl: text('invoice_url'),
    subscriptionNo: text('subscription_no'), // order subscription no
    transactionId: text('transaction_id'), // payment transaction id
    paymentUserName: text('payment_user_name'), // payment user name
    paymentUserId: text('payment_user_id'), // payment user id
  },
  (table) => [
    // Composite: Query user orders by status (most common)
    // Can also be used for: WHERE userId = ? (left-prefix)
    index('idx_order_user_status_payment_type').on(
      table.userId,
      table.status,
      table.paymentType
    ),
    // Composite: Prevent duplicate payments
    // Can also be used for: WHERE transactionId = ? (left-prefix)
    index('idx_order_transaction_provider').on(
      table.transactionId,
      table.paymentProvider
    ),
    // Order orders by creation time for listing
    index('idx_order_created_at').on(table.createdAt),
  ]
);

export const subscription = table(
  'subscription',
  {
    id: text('id').primaryKey(),
    subscriptionNo: text('subscription_no').unique().notNull(), // subscription no
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    userEmail: text('user_email'), // subscription user email
    status: text('status').notNull(), // subscription status
    paymentProvider: text('payment_provider').notNull(),
    subscriptionId: text('subscription_id').notNull(), // provider subscription id
    subscriptionResult: text('subscription_result'), // provider subscription result
    productId: text('product_id'), // product id
    description: text('description'), // subscription description
    amount: integer('amount'), // subscription amount
    currency: text('currency'), // subscription currency
    interval: text('interval'), // subscription interval, day, week, month, year
    intervalCount: integer('interval_count'), // subscription interval count
    trialPeriodDays: integer('trial_period_days'), // subscription trial period days
    currentPeriodStart: integer('current_period_start', {
      mode: 'timestamp_ms',
    }), // subscription current period start
    currentPeriodEnd: integer('current_period_end', { mode: 'timestamp_ms' }), // subscription current period end
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .default(sqliteNowMs)
      .notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
      .default(sqliteNowMs)
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
    deletedAt: integer('deleted_at', { mode: 'timestamp_ms' }),
    planName: text('plan_name'),
    billingUrl: text('billing_url'),
    productName: text('product_name'), // subscription product name
    creditsAmount: integer('credits_amount'), // subscription credits amount
    creditsValidDays: integer('credits_valid_days'), // subscription credits valid days
    paymentProductId: text('payment_product_id'), // subscription payment product id
    paymentUserId: text('payment_user_id'), // subscription payment user id
    canceledAt: integer('canceled_at', { mode: 'timestamp_ms' }), // subscription canceled apply at
    canceledEndAt: integer('canceled_end_at', { mode: 'timestamp_ms' }), // subscription canceled end at
    canceledReason: text('canceled_reason'), // subscription canceled reason
    canceledReasonType: text('canceled_reason_type'), // subscription canceled reason type
  },
  (table) => [
    // Composite: Query user's subscriptions by status (most common)
    // Can also be used for: WHERE userId = ? (left-prefix)
    index('idx_subscription_user_status_interval').on(
      table.userId,
      table.status,
      table.interval
    ),
    // Composite: Prevent duplicate subscriptions
    // Can also be used for: WHERE paymentProvider = ? (left-prefix)
    index('idx_subscription_provider_id').on(
      table.subscriptionId,
      table.paymentProvider
    ),
    // Order subscriptions by creation time for listing
    index('idx_subscription_created_at').on(table.createdAt),
  ]
);

export const credit = table(
  'credit',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }), // user id
    userEmail: text('user_email'), // user email
    orderNo: text('order_no'), // payment order no
    subscriptionNo: text('subscription_no'), // subscription no
    transactionNo: text('transaction_no').unique().notNull(), // transaction no
    transactionType: text('transaction_type').notNull(), // transaction type, grant / consume
    transactionScene: text('transaction_scene'), // transaction scene, payment / subscription / gift / award
    credits: integer('credits').notNull(), // credits amount, n or -n
    remainingCredits: integer('remaining_credits').notNull().default(0), // remaining credits amount
    description: text('description'), // transaction description
    expiresAt: integer('expires_at', { mode: 'timestamp_ms' }), // transaction expires at
    status: text('status').notNull(), // transaction status
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .default(sqliteNowMs)
      .notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
      .default(sqliteNowMs)
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
    deletedAt: integer('deleted_at', { mode: 'timestamp_ms' }),
    consumedDetail: text('consumed_detail'), // consumed detail
    metadata: text('metadata'), // transaction metadata
  },
  (table) => [
    // Critical composite index for credit consumption (FIFO queue)
    // Query: WHERE userId = ? AND transactionType = 'grant' AND status = 'active'
    //        AND remainingCredits > 0 ORDER BY expiresAt
    // Can also be used for: WHERE userId = ? (left-prefix)
    index('idx_credit_consume_fifo').on(
      table.userId,
      table.status,
      table.transactionType,
      table.remainingCredits,
      table.expiresAt
    ),
    // Query credits by order number
    index('idx_credit_order_no').on(table.orderNo),
    // Query credits by subscription number
    index('idx_credit_subscription_no').on(table.subscriptionNo),
  ]
);

export const apikey = table(
  'apikey',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    key: text('key').notNull(),
    title: text('title').notNull(),
    status: text('status').notNull(),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .default(sqliteNowMs)
      .notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
      .default(sqliteNowMs)
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
    deletedAt: integer('deleted_at', { mode: 'timestamp_ms' }),
  },
  (table) => [
    // Composite: Query user's API keys by status
    // Can also be used for: WHERE userId = ? (left-prefix)
    index('idx_apikey_user_status').on(table.userId, table.status),
    // Composite: Validate active API key (most common for auth)
    // Can also be used for: WHERE key = ? (left-prefix)
    index('idx_apikey_key_status').on(table.key, table.status),
  ]
);

// RBAC Tables
export const role = table(
  'role',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull().unique(), // admin, editor, viewer
    title: text('title').notNull(),
    description: text('description'),
    status: text('status').notNull(),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .default(sqliteNowMs)
      .notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
      .default(sqliteNowMs)
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
    sort: integer('sort').default(0).notNull(),
  },
  (table) => [
    // Query active roles
    index('idx_role_status').on(table.status),
  ]
);

export const permission = table(
  'permission',
  {
    id: text('id').primaryKey(),
    code: text('code').notNull().unique(), // admin.users.read, admin.posts.write
    resource: text('resource').notNull(), // users, posts, categories
    action: text('action').notNull(), // read, write, delete
    title: text('title').notNull(),
    description: text('description'),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .default(sqliteNowMs)
      .notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
      .default(sqliteNowMs)
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [
    // Composite: Query permissions by resource and action
    // Can also be used for: WHERE resource = ? (left-prefix)
    index('idx_permission_resource_action').on(table.resource, table.action),
  ]
);

export const rolePermission = table(
  'role_permission',
  {
    id: text('id').primaryKey(),
    roleId: text('role_id')
      .notNull()
      .references(() => role.id, { onDelete: 'cascade' }),
    permissionId: text('permission_id')
      .notNull()
      .references(() => permission.id, { onDelete: 'cascade' }),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .default(sqliteNowMs)
      .notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
      .default(sqliteNowMs)
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
    deletedAt: integer('deleted_at', { mode: 'timestamp_ms' }),
  },
  (table) => [
    // Composite: Query permissions for a role
    // Can also be used for: WHERE roleId = ? (left-prefix)
    index('idx_role_permission_role_permission').on(
      table.roleId,
      table.permissionId
    ),
  ]
);

export const userRole = table(
  'user_role',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    roleId: text('role_id')
      .notNull()
      .references(() => role.id, { onDelete: 'cascade' }),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .default(sqliteNowMs)
      .notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
      .default(sqliteNowMs)
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
    expiresAt: integer('expires_at', { mode: 'timestamp_ms' }),
  },
  (table) => [
    // Composite: Query user's active roles (most critical for auth)
    // Can also be used for: WHERE userId = ? (left-prefix)
    index('idx_user_role_user_expires').on(table.userId, table.expiresAt),
  ]
);

export const aiTask = table(
  'ai_task',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    mediaType: text('media_type').notNull(),
    provider: text('provider').notNull(),
    model: text('model').notNull(),
    prompt: text('prompt').notNull(),
    options: text('options'),
    status: text('status').notNull(),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .default(sqliteNowMs)
      .notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
      .default(sqliteNowMs)
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
    deletedAt: integer('deleted_at', { mode: 'timestamp_ms' }),
    taskId: text('task_id'), // provider task id
    taskInfo: text('task_info'), // provider task info
    taskResult: text('task_result'), // provider task result
    costCredits: integer('cost_credits').notNull().default(0),
    scene: text('scene').notNull().default(''),
    creditId: text('credit_id'), // credit consumption record id
  },
  (table) => [
    // Composite: Query user's AI tasks by status
    // Can also be used for: WHERE userId = ? (left-prefix)
    index('idx_ai_task_user_media_type').on(table.userId, table.mediaType),
    // Composite: Query user's AI tasks by media type and provider
    // Can also be used for: WHERE mediaType = ? AND provider = ? (left-prefix)
    index('idx_ai_task_media_type_status').on(table.mediaType, table.status),
  ]
);

export const chat = table(
  'chat',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    status: text('status').notNull(),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .default(sqliteNowMs)
      .notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
      .default(sqliteNowMs)
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
    model: text('model').notNull(),
    provider: text('provider').notNull(),
    title: text('title').notNull().default(''),
    parts: text('parts').notNull(),
    metadata: text('metadata'),
    content: text('content'),
  },
  (table) => [index('idx_chat_user_status').on(table.userId, table.status)]
);

export const chatMessage = table(
  'chat_message',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    chatId: text('chat_id')
      .notNull()
      .references(() => chat.id, { onDelete: 'cascade' }),
    status: text('status').notNull(),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .default(sqliteNowMs)
      .notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
      .default(sqliteNowMs)
      .$onUpdate(() => new Date())
      .notNull(),
    role: text('role').notNull(),
    parts: text('parts').notNull(),
    metadata: text('metadata'),
    model: text('model').notNull(),
    provider: text('provider').notNull(),
  },
  (table) => [
    index('idx_chat_message_chat_id').on(table.chatId, table.status),
    index('idx_chat_message_user_id').on(table.userId, table.status),
  ]
);
