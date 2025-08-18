import fs from 'fs';
import path from 'path';

// Mock PDF content - a minimal valid PDF structure
const mockPdfContent = Buffer.from([
  '%PDF-1.4',
  '1 0 obj',
  '<<',
  '/Type /Pages',
  '/Count 1',
  '/Kids [2 0 R]',
  '>>',
  'endobj',
  '2 0 obj',
  '<<',
  '/Type /Page',
  '/Parent 1 0 R',
  '/MediaBox [0 0 612 792]',
  '>>',
  'endobj',
  'xref',
  '0 3',
  '0000000000 65535 f ',
  '0000000009 00000 n ',
  '0000000058 00000 n ',
  'trailer',
  '<<',
  '/Size 3',
  '/Root 1 0 R',
  '>>',
  'startxref',
  '173',
  '%%EOF'
].join('\n'));

export async function generateMockPDF(stackData: any, outputPath: string): Promise<void> {
  // Create directory if it doesn't exist
  const dir = path.dirname(outputPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  
  // Write mock PDF content
  fs.writeFileSync(outputPath, mockPdfContent);
  
  console.log(`Mock PDF generated at: ${outputPath}`);
}