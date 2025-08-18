# B.O.P Stack Builder

## Overview

This is a web application for assembling Blowout Preventer (B.O.P) stacks in the oil and gas industry. The application allows field technicians to configure B.O.P stacks by selecting appropriate parts based on flange specifications, arranging them in the correct order, and generating detailed PDF reports for crew documentation.

The system processes flange specification data from CSV/XLSX files containing pressure ratings, bolt configurations, and part compatibility information. Users can build stacks by selecting from various part types (Annular, Single RAM, Double RAMs, Mud Cross, etc.) and the system automatically matches compatible flange specifications based on pressure requirements and physical constraints.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **React with TypeScript**: Modern component-based UI using functional components and hooks
- **Vite**: Fast build tool and development server with hot module replacement
- **Tailwind CSS + shadcn/ui**: Utility-first CSS framework with pre-built component library
- **TanStack Query**: Server state management for API calls and caching
- **Wouter**: Lightweight client-side routing
- **React Hook Form**: Form validation and management
- **DnD Kit**: Drag-and-drop functionality for stack reordering

### Backend Architecture
- **Express.js**: RESTful API server with middleware for logging and error handling
- **TypeScript**: Type-safe server-side development
- **Drizzle ORM**: Type-safe database interactions with PostgreSQL
- **Neon Database**: Serverless PostgreSQL database for production
- **Multer**: File upload middleware for CSV/XLSX processing
- **Puppeteer**: PDF generation from HTML templates

### Database Design
- **Flange Specifications**: Stores dimensional and pressure data for different flange types
- **Stack Headers**: Basic metadata for B.O.P stack configurations
- **Part Selections**: Individual components within a stack with references to flange specs
- **Stack Orders**: Maintains the sequence of parts in a stack
- **Report Exports**: Tracks generated PDF reports

### API Structure
- **POST /api/ingest**: Upload and parse CSV/XLSX flange specification files
- **POST /api/stack**: Create new B.O.P stack
- **GET /api/stack/:id**: Retrieve stack configuration with parts
- **POST /api/stack/:id/items**: Add parts to existing stack
- **POST /api/stack/:id/report**: Generate PDF report for stack
- **GET /api/options**: Retrieve available pressure options and specifications

### Data Processing Pipeline
- **CSV/XLSX Parser**: Extracts flange specifications from uploaded files
- **Pressure Classification**: Categorizes parts by pressure ratings (5K, 10K PSI)
- **Compatibility Engine**: Matches parts based on flange dimensions and pressure requirements
- **PDF Generator**: Creates detailed technical reports with part specifications

## External Dependencies

### Database Services
- **Neon Database**: Serverless PostgreSQL hosting with connection pooling
- **@neondatabase/serverless**: Database driver optimized for serverless environments

### File Processing
- **XLSX**: Excel file parsing for flange specification data
- **Multer**: Multipart form data handling for file uploads

### PDF Generation
- **Puppeteer**: Headless Chrome for PDF generation from HTML

### UI Components
- **Radix UI**: Accessible component primitives for dialogs, dropdowns, and form controls
- **Lucide React**: Icon library for industrial/technical interfaces

### Development Tools
- **ESBuild**: Fast JavaScript bundler for production builds
- **TSX**: TypeScript execution for development server
- **Replit Integration**: Development environment plugins for cartographer and error overlays

### Cloud Storage (Optional)
- **Google Cloud Storage**: File storage service integration (referenced but not actively used)
- **Uppy**: File upload interface components for future cloud storage features

The application follows a monorepo structure with shared TypeScript types and schemas between client and server, ensuring type safety across the full stack. The system is designed to be deployed on Replit with automatic database provisioning and no-login functionality for field use.