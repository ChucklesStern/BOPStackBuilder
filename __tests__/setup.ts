/**
 * Server-side test setup with database and service mocking
 */

// Mock the database connection
jest.mock('../server/db', () => ({
  db: {
    select: jest.fn(),
    insert: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    from: jest.fn(),
    where: jest.fn(),
    orderBy: jest.fn(),
    limit: jest.fn(),
    offset: jest.fn(),
  }
}));

// Sample test data
const mockFlangeSpec = {
  id: '550e8400-e29b-41d4-a716-446655440001',
  nominalBore: '13-5/8',
  pressureClassLabel: '5M',
  pressureClassPsi: 5000,
  boltCount: 8,
  sizeOfBolts: '1-1/8',
  wrenchNo: 1,
  truckUnitPsi: 5000,
  ringNeeded: 'BX-158',
  flangeSizeRaw: '13-5/8 5M',
  annularPressure: 5000,
  singleRamPressure: 5000,
  doubleRamsPressure: 5000,
  mudCrossPressure: 5000,
  createdAt: new Date(),
};

const mockStack = {
  id: '550e8400-e29b-41d4-a716-446655440002',
  title: 'Test B.O.P Stack',
  createdAt: new Date(),
};

const mockPartSelection = {
  id: '550e8400-e29b-41d4-a716-446655440003',
  stackId: '550e8400-e29b-41d4-a716-446655440002',
  partType: 'ANNULAR',
  spoolGroupId: null,
  pressureValue: 5000,
  flangeSpecId: '550e8400-e29b-41d4-a716-446655440001',
  createdAt: new Date(),
};

const mockReportExport = {
  id: '550e8400-e29b-41d4-a716-446655440004',
  stackId: '550e8400-e29b-41d4-a716-446655440002',
  renderedHtml: '<html><body>Test Report</body></html>',
  pdfPath: '/tmp/test-report.pdf',
  createdAt: new Date(),
};

// Track created parts and deleted stacks across test runs
let createdParts: any[] = [];
let deletedStackIds: Set<string> = new Set();
let partIdCounter = 3; // Start after the base mockPartSelection ID

// Mock the storage layer
const mockStorage = {
  // Flange spec methods
  insertFlangeSpecs: jest.fn().mockImplementation((specs: any[]) => Promise.resolve(specs.map((_: any, i: number) => ({ ...mockFlangeSpec, id: `550e8400-e29b-41d4-a716-44665544000${i}` })))),
  getFlangeSpecs: jest.fn().mockResolvedValue([mockFlangeSpec]),
  getFlangeSpecById: jest.fn().mockImplementation((id: string) => Promise.resolve(id === '550e8400-e29b-41d4-a716-446655440001' ? mockFlangeSpec : null)),
  deleteFlangeSpecs: jest.fn().mockResolvedValue(undefined),
  
  // Stack methods
  createStack: jest.fn().mockImplementation((data: any) => Promise.resolve({ ...mockStack, id: '550e8400-e29b-41d4-a716-446655440002', title: data?.title || 'B.O.P Stack' })),
  getStack: jest.fn().mockImplementation((id: string) => {
    if (deletedStackIds.has(id)) {
      return Promise.resolve(null);
    }
    return Promise.resolve(id === '550e8400-e29b-41d4-a716-446655440002' ? mockStack : null);
  }),
  getAllStacks: jest.fn().mockResolvedValue([mockStack]),
  deleteStack: jest.fn().mockImplementation((id: string) => {
    deletedStackIds.add(id);
    // Also clean up related parts
    createdParts = createdParts.filter(part => part.stackId !== id);
    return Promise.resolve(undefined);
  }),
  
  // Part selection methods
  addPartToStack: jest.fn().mockImplementation((partData: any) => {
    // Generate unique ID for each part
    const uniqueId = `550e8400-e29b-41d4-a716-44665544000${partIdCounter++}`;
    const result = { ...mockPartSelection, ...partData, id: uniqueId };
    
    // Geometry-driven parts should not have pressure values
    const geometryDrivenParts = ['ANACONDA_LINES', 'ROTATING_HEAD'];
    if (geometryDrivenParts.includes(partData.partType)) {
      result.pressureValue = null;
    }
    
    // Add to created parts tracking
    createdParts.push(result);
    
    return Promise.resolve(result);
  }),
  removePartFromStack: jest.fn().mockResolvedValue(undefined),
  updateStackOrder: jest.fn().mockImplementation((stackId: string, orderedPartIds: string[]) => {
    // Reorder the createdParts array to match the new order
    const stackParts = createdParts.filter(part => part.stackId === stackId);
    const reorderedParts = orderedPartIds.map(partId => 
      stackParts.find(part => part.id === partId)
    ).filter(Boolean);
    
    // Update the createdParts array
    createdParts = createdParts.filter(part => part.stackId !== stackId);
    createdParts.push(...reorderedParts);
    
    return Promise.resolve(undefined);
  }),
  getStackWithParts: jest.fn().mockImplementation((id: string) => {
    // Check if stack has been deleted
    if (deletedStackIds.has(id)) {
      return Promise.resolve(null);
    }
    
    if (id !== '550e8400-e29b-41d4-a716-446655440002') {
      return Promise.resolve(null);
    }
    
    // Return all created parts for this stack
    const stackParts = createdParts
      .filter(part => part.stackId === id)
      .map(part => ({ ...part, flangeSpec: mockFlangeSpec }));
    
    return Promise.resolve({
      stack: { ...mockStack, id },
      parts: stackParts
    });
  }),
  
  // Pressure options
  getPressureOptions: jest.fn().mockImplementation((partType: string) => {
    const pressureDrivenParts = ['ANNULAR', 'SINGLE_RAM', 'DOUBLE_RAMS', 'MUD_CROSS'];
    if (pressureDrivenParts.includes(partType)) {
      return Promise.resolve([3000, 5000, 10000]);
    }
    return Promise.resolve([]); // Geometry-driven parts return empty array
  }),
  upsertPressureOptions: jest.fn().mockResolvedValue(undefined),
  
  // Report methods
  createReport: jest.fn().mockImplementation((data: any) => Promise.resolve({ ...mockReportExport, ...data })),
  getReport: jest.fn().mockImplementation((id: string) => {
    if (id) {
      // Return a report with the correct path structure for any valid ID
      return Promise.resolve({
        ...mockReportExport,
        id,
        pdfPath: `reports/${id}.pdf`
      });
    }
    return Promise.resolve(null);
  }),
  updateReportExportPdf: jest.fn().mockResolvedValue(undefined),
};

jest.mock('../server/storage', () => ({
  storage: mockStorage
}));

// Mock PDF generation service - create actual file at the specified path
jest.mock('../server/services/pdfGenerator', () => ({
  generatePDF: jest.fn().mockImplementation(async (stackData: any, outputPath: string) => {
    const fs = jest.requireActual('fs');
    const path = jest.requireActual('path');
    
    // Ensure the directory exists
    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    // Create a simple test PDF file at the specified path
    const pdfContent = `%PDF-1.4
1 0 obj
<<
/Type /Catalog
/Pages 2 0 R
>>
endobj

2 0 obj
<<
/Type /Pages
/Kids [3 0 R]
/Count 1
>>
endobj

3 0 obj
<<
/Type /Page
/Parent 2 0 R
/MediaBox [0 0 612 792]
/Contents 4 0 R
>>
endobj

4 0 obj
<<
/Length 44
>>
stream
BT
/F1 12 Tf
100 700 Td
(Test PDF Report) Tj
ET
endstream
endobj

xref
0 5
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000199 00000 n 
trailer
<<
/Size 5
/Root 1 0 R
>>
startxref
295
%%EOF`;
    
    fs.writeFileSync(outputPath, pdfContent);
    
    // Return undefined (void) to match the actual function signature
    return;
  })
}));

// Mock Puppeteer for environments without browser dependencies
jest.mock('puppeteer', () => ({
  launch: jest.fn().mockResolvedValue({
    newPage: jest.fn().mockResolvedValue({
      setContent: jest.fn(),
      pdf: jest.fn().mockResolvedValue(Buffer.from('mock-pdf')),
      close: jest.fn(),
    }),
    close: jest.fn(),
  }),
}));

// Mock WebSocket connections and external services
jest.mock('ws', () => ({
  WebSocket: jest.fn().mockImplementation(() => ({
    on: jest.fn(),
    send: jest.fn(),
    close: jest.fn(),
    readyState: 1, // OPEN
  }))
}));

// Mock file system operations for cleanup
jest.mock('fs', () => ({
  ...jest.requireActual('fs'),
  unlinkSync: jest.fn(), // Prevent actual file deletion during tests
}));

// Reset function for test isolation
const resetMockState = () => {
  createdParts = [];
  deletedStackIds.clear();
  partIdCounter = 3;
};

// Reset before each test
beforeEach(() => {
  resetMockState();
});

// Export the mock storage for test access
export { mockStorage, resetMockState };