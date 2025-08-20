import { 
  type FlangeSpec, 
  type InsertFlangeSpec,
  type StackHeader,
  type InsertStackHeader,
  type PartSelection,
  type InsertPartSelection,
  type ReportExport,
  type InsertReportExport,
  flangeSpecs,
  stackHeaders,
  partSelections,
  stackOrders,
  reportExports,
  partPressureOptions,
  PartType
} from "@shared/schema";
import { db } from "./db";
import { eq, and, inArray, asc, or, isNotNull, sql } from "drizzle-orm";
import { randomUUID } from "crypto";

export interface FlangeFilterOptions {
  partType?: string;
  pressure?: number;
  flangeSize?: string;
  boltCount?: number;
  boltSize?: string;
}

export interface IStorage {
  // Flange specs
  insertFlangeSpecs(specs: InsertFlangeSpec[]): Promise<FlangeSpec[]>;
  getFlangeSpecs(filters?: FlangeFilterOptions): Promise<FlangeSpec[]>;
  getFlangeSpecById(id: string): Promise<FlangeSpec | undefined>;
  
  // Pressure options
  getPressureOptions(partType: string): Promise<number[]>;
  upsertPressureOptions(partType: string, pressures: number[]): Promise<void>;
  
  // Stack management
  createStack(stack: InsertStackHeader): Promise<StackHeader>;
  getStack(id: string): Promise<StackHeader | undefined>;
  getStackWithParts(id: string): Promise<{
    stack: StackHeader;
    parts: Array<PartSelection & { flangeSpec: FlangeSpec }>;
  } | undefined>;
  deleteStack(id: string): Promise<void>;
  
  // Part selections
  addPartToStack(part: InsertPartSelection): Promise<PartSelection>;
  removePartFromStack(partId: string): Promise<void>;
  updateStackOrder(stackId: string, orderedPartIds: string[]): Promise<void>;
  
  // Reports
  createReport(report: InsertReportExport, id?: string): Promise<ReportExport>;
  getReport(id: string): Promise<ReportExport | undefined>;
  updateReportPdfPath(id: string, pdfPath: string): Promise<void>;
  deleteReport(id: string): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  async insertFlangeSpecs(specs: InsertFlangeSpec[]): Promise<FlangeSpec[]> {
    if (specs.length === 0) return [];
    
    return await db
      .insert(flangeSpecs)
      .values(specs)
      .onConflictDoUpdate({
        target: [flangeSpecs.nominalBore, flangeSpecs.pressureClassLabel, flangeSpecs.boltCount, flangeSpecs.sizeOfBolts],
        set: {
          wrenchNo: sql`excluded.wrench_no`,
          truckUnitPsi: sql`excluded.truck_unit_psi`,
          ringNeeded: sql`excluded.ring_needed`,
          annularPressure: sql`excluded.annular_pressure`,
          singleRamPressure: sql`excluded.single_ram_pressure`,
          doubleRamsPressure: sql`excluded.double_rams_pressure`,
          mudCrossPressure: sql`excluded.mud_cross_pressure`,
        }
      })
      .returning();
  }

  async getFlangeSpecs(filters?: FlangeFilterOptions): Promise<FlangeSpec[]> {
    if (!filters) {
      return await db.select().from(flangeSpecs);
    }

    const conditions = [];
    
    // Handle part type filtering with pressure requirements
    if (filters.partType) {
      switch (filters.partType) {
        case PartType.ANNULAR:
          // For pressure-driven parts, filter by pressure if provided
          if (filters.pressure !== undefined) {
            conditions.push(eq(flangeSpecs.annularPressure, filters.pressure));
          } else {
            // Show all flanges that have annular pressure data
            conditions.push(isNotNull(flangeSpecs.annularPressure));
          }
          break;
          
        case PartType.SINGLE_RAM:
          if (filters.pressure !== undefined) {
            conditions.push(eq(flangeSpecs.singleRamPressure, filters.pressure));
          } else {
            conditions.push(isNotNull(flangeSpecs.singleRamPressure));
          }
          break;
          
        case PartType.DOUBLE_RAMS:
          if (filters.pressure !== undefined) {
            conditions.push(eq(flangeSpecs.doubleRamsPressure, filters.pressure));
          } else {
            conditions.push(isNotNull(flangeSpecs.doubleRamsPressure));
          }
          break;
          
        case PartType.MUD_CROSS:
          if (filters.pressure !== undefined) {
            conditions.push(eq(flangeSpecs.mudCrossPressure, filters.pressure));
          } else {
            conditions.push(isNotNull(flangeSpecs.mudCrossPressure));
          }
          break;
          
        // Geometry-driven parts - no pressure filtering needed
        case PartType.ANACONDA_LINES:
        case PartType.ROTATING_HEAD:
        case PartType.ADAPTER_SPOOL_SIDE:
          // These parts don't filter by pressure - all flanges are valid
          break;
          
        default:
          // Unknown part type - return empty results
          return [];
      }
    }
    
    // Apply additional filters for progressive narrowing
    if (filters.flangeSize) {
      conditions.push(eq(flangeSpecs.flangeSizeRaw, filters.flangeSize));
    }
    
    if (filters.boltCount !== undefined) {
      conditions.push(eq(flangeSpecs.boltCount, filters.boltCount));
    }
    
    if (filters.boltSize) {
      conditions.push(eq(flangeSpecs.sizeOfBolts, filters.boltSize));
    }

    // Execute query with conditions
    if (conditions.length > 0) {
      return await db
        .select()
        .from(flangeSpecs)
        .where(and(...conditions))
        .orderBy(asc(flangeSpecs.flangeSizeRaw));
    }

    // No conditions means return all flanges
    return await db
      .select()
      .from(flangeSpecs)
      .orderBy(asc(flangeSpecs.flangeSizeRaw));
  }

  async getFlangeSpecById(id: string): Promise<FlangeSpec | undefined> {
    const [spec] = await db
      .select()
      .from(flangeSpecs)
      .where(eq(flangeSpecs.id, id));
    return spec;
  }

  async getPressureOptions(partType: string): Promise<number[]> {
    let pressureColumn;
    
    switch (partType) {
      case PartType.ANNULAR:
        pressureColumn = flangeSpecs.annularPressure;
        break;
      case PartType.SINGLE_RAM:
        pressureColumn = flangeSpecs.singleRamPressure;
        break;
      case PartType.DOUBLE_RAMS:
        pressureColumn = flangeSpecs.doubleRamsPressure;
        break;
      case PartType.MUD_CROSS:
        pressureColumn = flangeSpecs.mudCrossPressure;
        break;
      default:
        return [];
    }

    const results = await db
      .selectDistinct({ pressure: pressureColumn })
      .from(flangeSpecs)
      .where(isNotNull(pressureColumn))
      .orderBy(asc(pressureColumn));

    return results.map(r => r.pressure!).filter(p => p > 0);
  }

  async upsertPressureOptions(partType: string, pressures: number[]): Promise<void> {
    if (pressures.length === 0) return;
    
    const values = pressures.map(pressure => ({ partType, pressureValue: pressure }));
    
    await db
      .insert(partPressureOptions)
      .values(values)
      .onConflictDoNothing();
  }

  async createStack(stack: InsertStackHeader): Promise<StackHeader> {
    const [created] = await db
      .insert(stackHeaders)
      .values(stack)
      .returning();
    return created;
  }

  async getStack(id: string): Promise<StackHeader | undefined> {
    const [stack] = await db
      .select()
      .from(stackHeaders)
      .where(eq(stackHeaders.id, id));
    return stack;
  }

  async getStackWithParts(id: string): Promise<{
    stack: StackHeader;
    parts: Array<PartSelection & { flangeSpec: FlangeSpec }>;
  } | undefined> {
    const stack = await this.getStack(id);
    if (!stack) return undefined;

    const parts = await db
      .select({
        id: partSelections.id,
        stackId: partSelections.stackId,
        partType: partSelections.partType,
        spoolGroupId: partSelections.spoolGroupId,
        pressureValue: partSelections.pressureValue,
        flangeSpecId: partSelections.flangeSpecId,
        createdAt: partSelections.createdAt,
        flangeSpec: flangeSpecs,
        position: stackOrders.position,
      })
      .from(partSelections)
      .innerJoin(flangeSpecs, eq(partSelections.flangeSpecId, flangeSpecs.id))
      .leftJoin(stackOrders, eq(partSelections.id, stackOrders.partSelectionId))
      .where(eq(partSelections.stackId, id))
      .orderBy(asc(stackOrders.position));

    return {
      stack,
      parts: parts.map(p => ({
        id: p.id,
        stackId: p.stackId,
        partType: p.partType,
        spoolGroupId: p.spoolGroupId,
        pressureValue: p.pressureValue,
        flangeSpecId: p.flangeSpecId,
        createdAt: p.createdAt,
        flangeSpec: p.flangeSpec,
      }))
    };
  }

  async deleteStack(id: string): Promise<void> {
    await db.delete(stackHeaders).where(eq(stackHeaders.id, id));
  }

  async addPartToStack(part: InsertPartSelection): Promise<PartSelection> {
    const [created] = await db
      .insert(partSelections)
      .values(part)
      .returning();

    // Add to stack order at the end
    const existingOrders = await db
      .select({ position: stackOrders.position })
      .from(stackOrders)
      .where(eq(stackOrders.stackId, part.stackId))
      .orderBy(asc(stackOrders.position));

    const nextPosition = existingOrders.length > 0 
      ? Math.max(...existingOrders.map(o => o.position)) + 1 
      : 0;

    await db
      .insert(stackOrders)
      .values({
        stackId: part.stackId,
        partSelectionId: created.id,
        position: nextPosition,
      });

    return created;
  }

  async removePartFromStack(partId: string): Promise<void> {
    await db.delete(partSelections).where(eq(partSelections.id, partId));
  }

  async updateStackOrder(stackId: string, orderedPartIds: string[]): Promise<void> {
    // Delete existing orders
    await db.delete(stackOrders).where(eq(stackOrders.stackId, stackId));
    
    // Insert new orders
    if (orderedPartIds.length > 0) {
      const values = orderedPartIds.map((partId, index) => ({
        stackId,
        partSelectionId: partId,
        position: index,
      }));
      
      await db.insert(stackOrders).values(values);
    }
  }

  async createReport(report: InsertReportExport, id?: string): Promise<ReportExport> {
    const values = id ? { ...report, id } : report;
    const [created] = await db
      .insert(reportExports)
      .values(values)
      .returning();
    return created;
  }

  async getReport(id: string): Promise<ReportExport | undefined> {
    const [report] = await db
      .select()
      .from(reportExports)
      .where(eq(reportExports.id, id));
    return report;
  }

  async updateReportPdfPath(id: string, pdfPath: string): Promise<void> {
    await db
      .update(reportExports)
      .set({ pdfPath })
      .where(eq(reportExports.id, id));
  }

  async deleteReport(id: string): Promise<void> {
    await db
      .delete(reportExports)
      .where(eq(reportExports.id, id));
  }
}

export const storage = new DatabaseStorage();
