import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, timestamp, uuid, jsonb, index, unique } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";

// Flange specifications table
export const flangeSpecs = pgTable("flange_spec", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  nominalBore: text("nominal_bore").notNull(),
  pressureClassLabel: text("pressure_class_label").notNull(),
  pressureClassPsi: integer("pressure_class_psi").notNull(),
  boltCount: integer("bolt_count").notNull(),
  sizeOfBolts: text("size_of_bolts").notNull(),
  wrenchNo: integer("wrench_no").notNull(),
  truckUnitPsi: integer("truck_unit_psi").notNull(),
  ringNeeded: text("ring_needed").notNull(),
  flangeSizeRaw: text("flange_size_raw").notNull(),
  
  // Pressure columns for different part types
  annularPressure: integer("annular_pressure"),
  singleRamPressure: integer("single_ram_pressure"),
  doubleRamsPressure: integer("double_rams_pressure"),
  mudCrossPressure: integer("mud_cross_pressure"),
  
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  uniqueSpec: unique().on(table.nominalBore, table.pressureClassLabel, table.boltCount, table.sizeOfBolts),
  nominalBoreIdx: index("nominal_bore_idx").on(table.nominalBore),
  pressureClassIdx: index("pressure_class_idx").on(table.pressureClassPsi),
}));

// Stack header table
export const stackHeaders = pgTable("stack_header", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").default("B.O.P Stack"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Part selection table
export const partSelections = pgTable("part_selection", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  stackId: uuid("stack_id").references(() => stackHeaders.id, { onDelete: "cascade" }).notNull(),
  partType: text("part_type").notNull(), // ANNULAR, SINGLE_RAM, DOUBLE_RAMS, MUD_CROSS, ANACONDA_LINES, ROTATING_HEAD, ADAPTER_SPOOL_SIDE
  spoolGroupId: uuid("spool_group_id"), // For grouping adapter spool sides
  pressureValue: integer("pressure_value"),
  flangeSpecId: uuid("flange_spec_id").references(() => flangeSpecs.id).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Stack order table
export const stackOrders = pgTable("stack_order", {
  stackId: uuid("stack_id").references(() => stackHeaders.id, { onDelete: "cascade" }).notNull(),
  partSelectionId: uuid("part_selection_id").references(() => partSelections.id, { onDelete: "cascade" }).notNull(),
  position: integer("position").notNull(),
}, (table) => ({
  pk: { primaryKey: [table.stackId, table.partSelectionId] },
}));

// Report export table
export const reportExports = pgTable("report_export", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  stackId: uuid("stack_id").references(() => stackHeaders.id, { onDelete: "cascade" }).notNull(),
  renderedHtml: text("rendered_html"),
  pdfPath: text("pdf_path"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Part pressure options config table
export const partPressureOptions = pgTable("part_pressure_option", {
  partType: text("part_type").notNull(),
  pressureValue: integer("pressure_value").notNull(),
}, (table) => ({
  pk: { primaryKey: [table.partType, table.pressureValue] },
}));

// Relations
export const stackHeadersRelations = relations(stackHeaders, ({ many }) => ({
  partSelections: many(partSelections),
  stackOrders: many(stackOrders),
  reportExports: many(reportExports),
}));

export const partSelectionsRelations = relations(partSelections, ({ one }) => ({
  stackHeader: one(stackHeaders, {
    fields: [partSelections.stackId],
    references: [stackHeaders.id],
  }),
  flangeSpec: one(flangeSpecs, {
    fields: [partSelections.flangeSpecId],
    references: [flangeSpecs.id],
  }),
}));

export const flangeSpecsRelations = relations(flangeSpecs, ({ many }) => ({
  partSelections: many(partSelections),
}));

// Insert schemas
export const insertFlangeSpecSchema = createInsertSchema(flangeSpecs).omit({
  id: true,
  createdAt: true,
});

export const insertStackHeaderSchema = createInsertSchema(stackHeaders).omit({
  id: true,
  createdAt: true,
});

export const insertPartSelectionSchema = createInsertSchema(partSelections).omit({
  id: true,
  createdAt: true,
});

export const insertReportExportSchema = createInsertSchema(reportExports).omit({
  id: true,
  createdAt: true,
});

// Types
export type FlangeSpec = typeof flangeSpecs.$inferSelect;
export type InsertFlangeSpec = z.infer<typeof insertFlangeSpecSchema>;
export type StackHeader = typeof stackHeaders.$inferSelect;
export type InsertStackHeader = z.infer<typeof insertStackHeaderSchema>;
export type PartSelection = typeof partSelections.$inferSelect;
export type InsertPartSelection = z.infer<typeof insertPartSelectionSchema>;
export type ReportExport = typeof reportExports.$inferSelect;
export type InsertReportExport = z.infer<typeof insertReportExportSchema>;

// Enums
export const PartType = {
  ANNULAR: "ANNULAR",
  SINGLE_RAM: "SINGLE_RAM", 
  DOUBLE_RAMS: "DOUBLE_RAMS",
  MUD_CROSS: "MUD_CROSS",
  ANACONDA_LINES: "ANACONDA_LINES",
  ROTATING_HEAD: "ROTATING_HEAD",
  ADAPTER_SPOOL_SIDE: "ADAPTER_SPOOL_SIDE",
} as const;

export type PartTypeValue = typeof PartType[keyof typeof PartType];
