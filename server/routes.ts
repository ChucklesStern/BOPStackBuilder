import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { z } from "zod";
import { insertStackHeaderSchema, insertPartSelectionSchema, PartType } from "@shared/schema";
import { parseCSV, parseXLSX } from "./services/csvParser";
import { generatePDF } from "./services/pdfGenerator";
import multer from "multer";
import { randomUUID } from "crypto";
import path from "path";
import fs from "fs";

const upload = multer({ 
  dest: "uploads/",
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['.csv', '.xlsx', '.xls'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedTypes.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only CSV and XLSX files are allowed.'));
    }
  },
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  }
});

export async function registerRoutes(app: Express): Promise<Server> {
  
  // Upload and parse CSV/XLSX
  app.post("/api/ingest", (req, res, next) => {
    upload.single('file')(req, res, (err) => {
      if (err) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({ error: 'File too large. Maximum size is 10MB.' });
        }
        if (err.message.includes('Invalid file type')) {
          return res.status(400).json({ error: err.message });
        }
        return res.status(500).json({ error: 'File upload failed' });
      }
      next();
    });
  }, async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      const filePath = req.file.path;
      const ext = path.extname(req.file.originalname).toLowerCase();
      
      let flangeSpecs;
      if (ext === '.csv') {
        flangeSpecs = await parseCSV(filePath);
      } else if (ext === '.xlsx' || ext === '.xls') {
        flangeSpecs = await parseXLSX(filePath);
      } else {
        return res.status(400).json({ error: "Unsupported file format" });
      }

      // Insert into database
      const inserted = await storage.insertFlangeSpecs(flangeSpecs);
      
      // Update pressure options
      const pressureTypes = [PartType.ANNULAR, PartType.SINGLE_RAM, PartType.DOUBLE_RAMS, PartType.MUD_CROSS];
      for (const partType of pressureTypes) {
        const pressures = await storage.getPressureOptions(partType);
        await storage.upsertPressureOptions(partType, pressures);
      }

      // Clean up uploaded file
      fs.unlinkSync(filePath);

      res.json({ 
        message: "Data ingested successfully",
        count: inserted.length,
        warnings: []
      });
    } catch (error) {
      console.error("Ingestion error:", error);
      
      // Clean up file if it exists
      if (req.file?.path && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      
      res.status(500).json({ 
        error: error instanceof Error ? error.message : "Failed to process file" 
      });
    }
  });

  // Get part types
  app.get("/api/options/parts", async (req, res) => {
    try {
      const partTypes = [
        { type: PartType.ANNULAR, label: "Annular", category: "pressure" },
        { type: PartType.SINGLE_RAM, label: "Single B.O.P (RAM)", category: "pressure" },
        { type: PartType.DOUBLE_RAMS, label: "Double B.O.P (RAMs)", category: "pressure" },
        { type: PartType.MUD_CROSS, label: "Mud Cross", category: "pressure" },
        { type: PartType.ANACONDA_LINES, label: "Anaconda Lines", category: "geometry" },
        { type: PartType.ROTATING_HEAD, label: "Rotating Head", category: "geometry" },
        { type: "ADAPTER_SPOOL", label: "Adapter Spool", category: "spool" },
      ];
      
      res.json(partTypes);
    } catch (error) {
      console.error("Error getting part types:", error);
      res.status(500).json({ error: "Failed to get part types" });
    }
  });

  // Get pressure options for a part type
  app.get("/api/options/pressures", async (req, res) => {
    try {
      const partType = req.query.part as string;
      if (!partType) {
        return res.status(400).json({ error: "Part type is required" });
      }

      const pressures = await storage.getPressureOptions(partType);
      res.json(pressures);
    } catch (error) {
      console.error("Error getting pressures:", error);
      res.status(500).json({ error: "Failed to get pressure options" });
    }
  });

  // Get flange options with filters
  app.get("/api/options/flanges", async (req, res) => {
    try {
      const filters = {
        partType: req.query.part as string,
        pressure: req.query.pressure ? parseInt(req.query.pressure as string) : undefined,
        flangeSize: req.query.flangeSize as string,
        boltCount: req.query.boltCount ? parseInt(req.query.boltCount as string) : undefined,
        boltSize: req.query.boltSize as string,
      };

      // Remove undefined values
      const cleanFilters = Object.fromEntries(
        Object.entries(filters).filter(([_, value]) => value !== undefined)
      );

      const flanges = await storage.getFlangeSpecs(cleanFilters);
      res.json(flanges);
    } catch (error) {
      console.error("Error getting flanges:", error);
      res.status(500).json({ error: "Failed to get flange options" });
    }
  });

  // Create new stack
  app.post("/api/stack", async (req, res) => {
    try {
      const stackData = insertStackHeaderSchema.parse(req.body);
      const stack = await storage.createStack(stackData);
      res.json(stack);
    } catch (error) {
      console.error("Error creating stack:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid stack data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to create stack" });
    }
  });

  // Add part to stack
  app.post("/api/stack/:id/items", async (req, res) => {
    try {
      const stackId = req.params.id;
      const partData = { ...req.body, stackId };
      
      // Validate part data
      const validatedPart = insertPartSelectionSchema.parse(partData);
      
      // Verify flange spec exists
      const flangeSpec = await storage.getFlangeSpecById(validatedPart.flangeSpecId);
      if (!flangeSpec) {
        return res.status(400).json({ error: "Invalid flange specification" });
      }

      const part = await storage.addPartToStack(validatedPart);
      res.json(part);
    } catch (error) {
      console.error("Error adding part to stack:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid part data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to add part to stack" });
    }
  });

  // Update stack order
  app.patch("/api/stack/:id/order", async (req, res) => {
    try {
      const stackId = req.params.id;
      const { orderedPartIds } = req.body;
      
      if (!Array.isArray(orderedPartIds)) {
        return res.status(400).json({ error: "orderedPartIds must be an array" });
      }

      await storage.updateStackOrder(stackId, orderedPartIds);
      res.json({ success: true });
    } catch (error) {
      console.error("Error updating stack order:", error);
      res.status(500).json({ error: "Failed to update stack order" });
    }
  });

  // Get stack with parts
  app.get("/api/stack/:id", async (req, res) => {
    try {
      const stackId = req.params.id;
      const stackData = await storage.getStackWithParts(stackId);
      
      if (!stackData) {
        return res.status(404).json({ error: "Stack not found" });
      }

      res.json(stackData);
    } catch (error) {
      console.error("Error getting stack:", error);
      res.status(500).json({ error: "Failed to get stack" });
    }
  });

  // Generate report
  app.post("/api/stack/:id/report", async (req, res) => {
    try {
      const stackId = req.params.id;
      const stackData = await storage.getStackWithParts(stackId);
      
      if (!stackData) {
        return res.status(404).json({ error: "Stack not found" });
      }

      const reportId = randomUUID();
      const pdfPath = `reports/${reportId}.pdf`;
      
      // Ensure reports directory exists
      const reportsDir = path.join(process.cwd(), 'reports');
      if (!fs.existsSync(reportsDir)) {
        fs.mkdirSync(reportsDir, { recursive: true });
      }

      const fullPdfPath = path.join(reportsDir, `${reportId}.pdf`);
      await generatePDF(stackData, fullPdfPath);

      const report = await storage.createReport({
        stackId,
        pdfPath,
        renderedHtml: null, // Could store HTML if needed
      });

      res.json(report);
    } catch (error) {
      console.error("Error generating report:", error);
      res.status(500).json({ error: "Failed to generate report" });
    }
  });

  // Download PDF report
  app.get("/api/reports/:reportId/pdf", async (req, res) => {
    try {
      const reportId = req.params.reportId;
      const report = await storage.getReport(reportId);
      
      if (!report || !report.pdfPath) {
        return res.status(404).json({ error: "Report not found" });
      }

      const fullPath = path.join(process.cwd(), report.pdfPath);
      
      if (!fs.existsSync(fullPath)) {
        return res.status(404).json({ error: "PDF file not found" });
      }

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="bop-stack-report-${reportId}.pdf"`);
      
      const stream = fs.createReadStream(fullPath);
      stream.pipe(res);
    } catch (error) {
      console.error("Error downloading report:", error);
      res.status(500).json({ error: "Failed to download report" });
    }
  });

  // Delete stack
  app.delete("/api/stack/:id", async (req, res) => {
    try {
      const stackId = req.params.id;
      await storage.deleteStack(stackId);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting stack:", error);
      res.status(500).json({ error: "Failed to delete stack" });
    }
  });

  // Remove part from stack
  app.delete("/api/stack/:stackId/items/:partId", async (req, res) => {
    try {
      const partId = req.params.partId;
      await storage.removePartFromStack(partId);
      res.json({ success: true });
    } catch (error) {
      console.error("Error removing part:", error);
      res.status(500).json({ error: "Failed to remove part" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
