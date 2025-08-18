# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Essential Commands

### Development
- `npm run dev` - Start full-stack development server with hot reload
- `npm run check` - Run TypeScript type checking
- `npm run db:push` - Push database schema changes to Neon PostgreSQL

### Production Build
- `npm run build` - Build both client (Vite) and server (ESBuild) for production
- `npm start` - Start production server

## Project Architecture

### Monorepo Structure
- **client/**: React frontend with TypeScript, Vite, Tailwind CSS, shadcn/ui
- **server/**: Express.js API with TypeScript, Drizzle ORM
- **shared/**: Common TypeScript schemas and types used by both client and server
- **uploads/**: Temporary directory for CSV/XLSX file processing

### Database Schema (PostgreSQL via Neon)
Core tables managed by Drizzle ORM:
- `flange_spec`: Dimensional and pressure specifications for flange parts
- `stack_header`: B.O.P stack configurations 
- `part_selection`: Individual components within stacks
- `stack_order`: Maintains sequence of parts in stack
- `report_export`: Generated PDF report metadata

### Key Business Logic
This is a **B.O.P (Blowout Preventer) Stack Builder** for oil & gas industry:

- **Part Types**: ANNULAR, SINGLE_RAM, DOUBLE_RAMS, MUD_CROSS, ANACONDA_LINES, ROTATING_HEAD, ADAPTER_SPOOL_SIDE
- **Pressure Classifications**: Parts categorized by PSI ratings (5K, 10K)
- **Flange Compatibility**: Parts matched by flange dimensions, bolt patterns, and pressure requirements
- **Stack Assembly**: Drag-and-drop ordering of compatible parts
- **PDF Reports**: Technical documentation generated via Puppeteer

### API Endpoints
- `POST /api/ingest` - Upload CSV/XLSX flange specification files (10MB limit)
- `POST /api/stack` - Create new B.O.P stack configuration
- `GET /api/stack/:id` - Retrieve stack with ordered parts
- `POST /api/stack/:id/items` - Add parts to existing stack
- `PATCH /api/stack/:id/order` - Update part ordering within stack
- `POST /api/stack/:id/report` - Generate PDF report
- `GET /api/options/*` - Retrieve available parts, pressures, and flange specifications

### File Processing Pipeline
1. CSV/XLSX files contain flange specifications with pressure ratings and bolt configurations
2. Files parsed via `xlsx` library in `server/services/csvParser.ts`
3. Data validated and inserted into PostgreSQL via Drizzle ORM
4. Pressure options automatically updated for part compatibility engine

### Development Notes
- TypeScript paths configured: `@/` (client src), `@shared/` (shared schemas)
- Database migrations handled via `drizzle-kit` 
- PDF generation uses Puppeteer with HTML templates
- File uploads processed via Multer middleware
- Replit-specific plugins included for development environment