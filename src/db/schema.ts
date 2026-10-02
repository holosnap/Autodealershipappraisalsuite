import { relations, sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
};

// ---------- enums ----------
export const roleEnum = pgEnum("role", ["salesperson", "manager"]);
export const appraisalStatusEnum = pgEnum("appraisal_status", [
  "draft",
  "submitted",
  "approved",
  "rejected",
]);
export const titleStatusEnum = pgEnum("title_status", [
  "clean",
  "rebuilt",
  "salvage",
  "lien",
  "unknown",
]);
export const gradeEnum = pgEnum("overall_grade", ["excellent", "good", "fair", "poor"]);
export const photoSlotEnum = pgEnum("photo_slot", [
  "front",
  "rear",
  "driver_side",
  "passenger_side",
  "interior_front",
  "interior_rear",
  "odometer",
  "vin_plate",
  "engine",
  "tires",
  "damage",
  "other",
]);
export const photoStatusEnum = pgEnum("photo_status", ["pending", "uploaded"]);
export const noteCategoryEnum = pgEnum("note_category", [
  "exterior",
  "interior",
  "mechanical",
  "tires_brakes",
  "electrical",
  "paint_body",
  "history",
  "general",
]);
export const severityEnum = pgEnum("severity", ["info", "minor", "moderate", "major"]);
export const valuationSourceEnum = pgEnum("valuation_source", [
  "manual",
  "kbb",
  "black_book",
  "mmr",
  "nada",
  "other",
]);
export const valuationKindEnum = pgEnum("valuation_kind", [
  "wholesale",
  "retail",
  "trade_in",
  "market_avg",
  "offer_basis",
]);

// ---------- auth (shape required by Better Auth; plural table names) ----------
export const users = pgTable("users", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  role: roleEnum("role").notNull().default("salesperson"),
  active: boolean("active").notNull().default(true),
  lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
  ...timestamps,
});

export const sessions = pgTable("sessions", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  token: text("token").notNull().unique(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  ...timestamps,
});

export const accounts = pgTable("accounts", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true }),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { withTimezone: true }),
  scope: text("scope"),
  password: text("password"),
  ...timestamps,
});

export const verifications = pgTable("verifications", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  ...timestamps,
});

// ---------- domain ----------
export const vehicles = pgTable("vehicles", {
  id: uuid("id").primaryKey().defaultRandom(),
  vin: text("vin").notNull().unique(),
  year: integer("year"),
  make: text("make"),
  model: text("model"),
  trim: text("trim"),
  bodyStyle: text("body_style"),
  drivetrain: text("drivetrain"),
  engine: text("engine"),
  transmission: text("transmission"),
  exteriorColor: text("exterior_color"),
  interiorColor: text("interior_color"),
  decodedRaw: jsonb("decoded_raw"),
  ...timestamps,
});

export const appraisals = pgTable(
  "appraisals",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    vehicleId: uuid("vehicle_id")
      .notNull()
      .references(() => vehicles.id),
    createdBy: text("created_by")
      .notNull()
      .references(() => users.id),
    status: appraisalStatusEnum("status").notNull().default("draft"),
    odometer: integer("odometer"),
    odometerUnit: text("odometer_unit").notNull().default("mi"),
    customerName: text("customer_name"),
    customerPhone: text("customer_phone"),
    stockNumber: text("stock_number"),
    dealRef: text("deal_ref"),
    titleStatus: titleStatusEnum("title_status").notNull().default("unknown"),
    hasLien: boolean("has_lien").notNull().default(false),
    keysCount: integer("keys_count"),
    overallGrade: gradeEnum("overall_grade"),
    reconEstimateCents: integer("recon_estimate_cents"),
    offerCents: integer("offer_cents"), // final offer, set by a manager on approval
    decisionBy: text("decision_by").references(() => users.id),
    decidedAt: timestamp("decided_at", { withTimezone: true }),
    decisionReason: text("decision_reason"),
    // convenience pointer to the valuation in use; plain uuid to avoid a circular FK with valuation_snapshots
    currentValuationId: uuid("current_valuation_id"),
    submittedAt: timestamp("submitted_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    index("appraisals_status_created_idx").on(t.status, t.createdAt),
    index("appraisals_created_by_idx").on(t.createdBy),
    index("appraisals_vehicle_idx").on(t.vehicleId),
  ],
);

export const appraisalPhotos = pgTable(
  "appraisal_photos",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    appraisalId: uuid("appraisal_id")
      .notNull()
      .references(() => appraisals.id, { onDelete: "cascade" }),
    uploadedBy: text("uploaded_by")
      .notNull()
      .references(() => users.id),
    slot: photoSlotEnum("slot").notNull().default("other"),
    storageKey: text("storage_key").notNull().unique(),
    contentType: text("content_type").notNull(),
    width: integer("width"),
    height: integer("height"),
    sizeBytes: integer("size_bytes"),
    caption: text("caption"),
    sortOrder: integer("sort_order").notNull().default(0),
    status: photoStatusEnum("status").notNull().default("pending"),
    ...timestamps,
  },
  (t) => [index("appraisal_photos_appraisal_idx").on(t.appraisalId, t.sortOrder)],
);

export const conditionNotes = pgTable(
  "condition_notes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    appraisalId: uuid("appraisal_id")
      .notNull()
      .references(() => appraisals.id, { onDelete: "cascade" }),
    authorId: text("author_id")
      .notNull()
      .references(() => users.id),
    category: noteCategoryEnum("category").notNull().default("general"),
    severity: severityEnum("severity").notNull().default("info"),
    body: text("body").notNull(),
    estRepairCents: integer("est_repair_cents"),
    photoId: uuid("photo_id").references(() => appraisalPhotos.id, { onDelete: "set null" }),
    ...timestamps,
  },
  (t) => [index("condition_notes_appraisal_idx").on(t.appraisalId)],
);

// Immutable / append-only: application code must only INSERT.
export const valuationSnapshots = pgTable(
  "valuation_snapshots",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    appraisalId: uuid("appraisal_id")
      .notNull()
      .references(() => appraisals.id, { onDelete: "cascade" }),
    createdBy: text("created_by")
      .notNull()
      .references(() => users.id),
    source: valuationSourceEnum("source").notNull().default("manual"),
    kind: valuationKindEnum("kind").notNull(),
    valueCents: integer("value_cents").notNull(),
    lowCents: integer("low_cents"),
    highCents: integer("high_cents"),
    odometerAtValuation: integer("odometer_at_valuation"),
    inputs: jsonb("inputs"),
    rawResponse: jsonb("raw_response"),
    note: text("note"),
    valuedAt: timestamp("valued_at", { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("valuation_snapshots_appraisal_idx").on(t.appraisalId, t.valuedAt)],
);

export const appraisalEvents = pgTable(
  "appraisal_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    appraisalId: uuid("appraisal_id")
      .notNull()
      .references(() => appraisals.id, { onDelete: "cascade" }),
    actorId: text("actor_id").references(() => users.id),
    type: text("type").notNull(),
    payload: jsonb("payload").notNull().default(sql`'{}'::jsonb`),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("appraisal_events_appraisal_idx").on(t.appraisalId, t.createdAt)],
);

// ---------- relations ----------
export const appraisalsRelations = relations(appraisals, ({ one, many }) => ({
  vehicle: one(vehicles, { fields: [appraisals.vehicleId], references: [vehicles.id] }),
  creator: one(users, { fields: [appraisals.createdBy], references: [users.id] }),
  photos: many(appraisalPhotos),
  notes: many(conditionNotes),
  valuations: many(valuationSnapshots),
  events: many(appraisalEvents),
}));
export const vehiclesRelations = relations(vehicles, ({ many }) => ({ appraisals: many(appraisals) }));
export const photosRelations = relations(appraisalPhotos, ({ one }) => ({
  appraisal: one(appraisals, { fields: [appraisalPhotos.appraisalId], references: [appraisals.id] }),
}));
export const notesRelations = relations(conditionNotes, ({ one }) => ({
  appraisal: one(appraisals, { fields: [conditionNotes.appraisalId], references: [appraisals.id] }),
}));
export const valuationsRelations = relations(valuationSnapshots, ({ one }) => ({
  appraisal: one(appraisals, { fields: [valuationSnapshots.appraisalId], references: [appraisals.id] }),
}));

export type Role = (typeof roleEnum.enumValues)[number];
export const eventsRelations = relations(appraisalEvents, ({ one }) => ({
  appraisal: one(appraisals, { fields: [appraisalEvents.appraisalId], references: [appraisals.id] }),
}));
