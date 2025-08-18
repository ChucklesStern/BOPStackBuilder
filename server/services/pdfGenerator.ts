import puppeteer from 'puppeteer';
import { StackHeader, PartSelection, FlangeSpec, PartType } from '@shared/schema';

interface StackData {
  stack: StackHeader;
  parts: Array<PartSelection & { flangeSpec: FlangeSpec }>;
}

function getPartDisplayName(partType: string, pressure?: number | null): string {
  const names = {
    [PartType.ANNULAR]: 'Annular',
    [PartType.SINGLE_RAM]: 'Single B.O.P (RAM)',
    [PartType.DOUBLE_RAMS]: 'Double B.O.P (RAMs)', 
    [PartType.MUD_CROSS]: 'Mud Cross',
    [PartType.ANACONDA_LINES]: 'Anaconda Lines',
    [PartType.ROTATING_HEAD]: 'Rotating Head',
    [PartType.ADAPTER_SPOOL_SIDE]: 'Adapter Spool',
  };

  const baseName = names[partType as keyof typeof names] || partType;
  
  // Add pressure for pressure-driven parts
  const pressureDrivenParts = [
    PartType.ANNULAR, 
    PartType.SINGLE_RAM, 
    PartType.DOUBLE_RAMS, 
    PartType.MUD_CROSS
  ];
  
  if (pressureDrivenParts.includes(partType as any) && pressure) {
    return `${baseName} – Pressure ${pressure}`;
  }
  
  return baseName;
}

function generateReportLines(stackData: StackData): string[] {
  const lines: string[] = [];
  const spoolGroups = new Map<string, Array<PartSelection & { flangeSpec: FlangeSpec }>>();
  let spoolLetter = 'A';

  // Group adapter spool sides
  const regularParts: Array<PartSelection & { flangeSpec: FlangeSpec }> = [];
  
  for (const part of stackData.parts) {
    if (part.partType === PartType.ADAPTER_SPOOL_SIDE && part.spoolGroupId) {
      if (!spoolGroups.has(part.spoolGroupId)) {
        spoolGroups.set(part.spoolGroupId, []);
      }
      spoolGroups.get(part.spoolGroupId)!.push(part);
    } else {
      regularParts.push(part);
    }
  }

  // Generate lines for regular parts
  for (const part of regularParts) {
    const partName = getPartDisplayName(part.partType, part.pressureValue);
    const { flangeSpec } = part;
    
    const line = `${partName} – Ring: ${flangeSpec.ringNeeded} | Size of Bolts: ${flangeSpec.sizeOfBolts} | # Bolts: ${flangeSpec.boltCount} | Flange: ${flangeSpec.flangeSizeRaw} | Wrench Required: ${flangeSpec.wrenchNo} | Set Truck PSI to: ${flangeSpec.truckUnitPsi}`;
    
    lines.push(line);
  }

  // Generate lines for adapter spools
  for (const [groupId, spoolSides] of Array.from(spoolGroups.entries())) {
    spoolSides.sort((a: any, b: any) => (a.createdAt?.getTime() || 0) - (b.createdAt?.getTime() || 0)); // Sort by creation time
    
    spoolSides.forEach((side: any, index: number) => {
      const sideNumber = index + 1;
      const { flangeSpec } = side;
      
      const line = `Adapter Spool ${spoolLetter} — Side ${sideNumber} – Ring: ${flangeSpec.ringNeeded} | Size of Bolts: ${flangeSpec.sizeOfBolts} | # Bolts: ${flangeSpec.boltCount} | Flange: ${flangeSpec.flangeSizeRaw} | Wrench Required: ${flangeSpec.wrenchNo} | Set Truck PSI to: ${flangeSpec.truckUnitPsi}`;
      
      lines.push(line);
    });
    
    spoolLetter = String.fromCharCode(spoolLetter.charCodeAt(0) + 1);
  }

  return lines;
}

function generateReportHTML(stackData: StackData): string {
  const reportLines = generateReportLines(stackData);
  const timestamp = new Date().toLocaleString();
  
  return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>B.O.P Stack Report</title>
    <style>
        @page {
            margin: 1in;
            size: letter;
        }
        
        body {
            font-family: 'Times New Roman', serif;
            font-size: 12px;
            line-height: 1.4;
            color: #000;
            margin: 0;
            padding: 0;
        }
        
        .header {
            text-align: center;
            margin-bottom: 30px;
            border-bottom: 2px solid #000;
            padding-bottom: 15px;
        }
        
        .header h1 {
            font-size: 18px;
            font-weight: bold;
            margin: 0 0 10px 0;
        }
        
        .header .subtitle {
            font-size: 14px;
            color: #666;
        }
        
        .meta-info {
            display: flex;
            justify-content: space-between;
            margin-bottom: 25px;
            font-size: 11px;
        }
        
        .report-content {
            margin-bottom: 30px;
        }
        
        .part-line {
            margin-bottom: 8px;
            padding: 8px;
            background-color: #f9f9f9;
            border-left: 4px solid #1565C0;
            font-family: 'Courier New', monospace;
            font-size: 10px;
            line-height: 1.3;
            word-wrap: break-word;
        }
        
        .adapter-spool {
            border-left-color: #FF6F00;
        }
        
        .summary {
            margin-top: 30px;
            padding-top: 20px;
            border-top: 1px solid #ccc;
        }
        
        .summary h3 {
            font-size: 14px;
            margin-bottom: 10px;
        }
        
        .summary-grid {
            display: grid;
            grid-template-columns: 1fr 1fr 1fr;
            gap: 15px;
        }
        
        .summary-item {
            padding: 10px;
            background-color: #f5f5f5;
            border-radius: 4px;
        }
        
        .summary-label {
            font-weight: bold;
            font-size: 11px;
            color: #666;
        }
        
        .summary-value {
            font-size: 14px;
            font-weight: bold;
            color: #000;
        }
        
        @media print {
            .header {
                break-inside: avoid;
            }
            
            .part-line {
                break-inside: avoid;
            }
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>B.O.P Stack Configuration Report</h1>
        <div class="subtitle">Blowout Preventer Stack Assembly Specifications</div>
    </div>
    
    <div class="meta-info">
        <div>
            <strong>Stack ID:</strong> ${stackData.stack.id}<br>
            <strong>Stack Title:</strong> ${stackData.stack.title}
        </div>
        <div style="text-align: right;">
            <strong>Generated:</strong> ${timestamp}<br>
            <strong>Total Parts:</strong> ${stackData.parts.length}
        </div>
    </div>
    
    <div class="report-content">
        ${reportLines.map(line => {
          const isAdapterSpool = line.includes('Adapter Spool');
          return `<div class="part-line ${isAdapterSpool ? 'adapter-spool' : ''}">${line}</div>`;
        }).join('')}
    </div>
    
    <div class="summary">
        <h3>Summary</h3>
        <div class="summary-grid">
            <div class="summary-item">
                <div class="summary-label">Total Parts</div>
                <div class="summary-value">${stackData.parts.length}</div>
            </div>
            <div class="summary-item">
                <div class="summary-label">Pressure Ranges</div>
                <div class="summary-value">${getPressureRanges(stackData.parts)}</div>
            </div>
            <div class="summary-item">
                <div class="summary-label">Flange Classes</div>
                <div class="summary-value">${getFlangeClasses(stackData.parts)}</div>
            </div>
        </div>
    </div>
</body>
</html>
  `;
}

function getPressureRanges(parts: Array<PartSelection & { flangeSpec: FlangeSpec }>): string {
  const pressures = parts
    .map(p => p.pressureValue)
    .filter(p => p && p > 0)
    .sort((a, b) => a! - b!);
  
  if (pressures.length === 0) return 'N/A';
  
  const min = Math.min(...pressures as number[]);
  const max = Math.max(...pressures as number[]);
  
  return min === max ? `${min} PSI` : `${min}-${max} PSI`;
}

function getFlangeClasses(parts: Array<PartSelection & { flangeSpec: FlangeSpec }>): string {
  const classes = Array.from(new Set(
    parts.map(p => p.flangeSpec.pressureClassLabel)
  )).sort();
  
  return classes.join(', ') || 'N/A';
}

export async function generatePDF(stackData: StackData, outputPath: string): Promise<void> {
  const html = generateReportHTML(stackData);
  
  const browser = await puppeteer.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--disable-web-security',
      '--disable-features=VizDisplayCompositor',
      '--single-process'
    ],
  });
  
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    
    await page.pdf({
      path: outputPath,
      format: 'letter',
      margin: {
        top: '1in',
        right: '1in', 
        bottom: '1in',
        left: '1in',
      },
      printBackground: true,
    });
  } finally {
    await browser.close();
  }
}
