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

// Mock the storage layer
const mockStorage = {
  // Flange spec methods
  insertFlangeSpecs: jest.fn().mockImplementation((specs: any[]) => Promise.resolve(specs.map((_: any, i: number) => ({ ...mockFlangeSpec, id: `550e8400-e29b-41d4-a716-44665544000${i}` })))),
  getFlangeSpecs: jest.fn().mockResolvedValue([mockFlangeSpec]),
  getFlangeSpecById: jest.fn().mockImplementation((id: string) => Promise.resolve(id === '550e8400-e29b-41d4-a716-446655440001' ? mockFlangeSpec : null)),
  deleteFlangeSpecs: jest.fn().mockResolvedValue(undefined),
  
  // Stack methods
  createStack: jest.fn().mockImplementation((data: any) => Promise.resolve({ ...mockStack, id: '550e8400-e29b-41d4-a716-446655440002', title: data?.title || 'B.O.P Stack' })),
  getStack: jest.fn().mockImplementation((id: string) => Promise.resolve(id === '550e8400-e29b-41d4-a716-446655440002' ? mockStack : null)),
  getAllStacks: jest.fn().mockResolvedValue([mockStack]),
  deleteStack: jest.fn().mockResolvedValue(undefined),
  
  // Part selection methods
  addPartToStack: jest.fn().mockImplementation((partData: any) => {
    const result = { ...mockPartSelection, ...partData };
    // Geometry-driven parts should not have pressure values
    const geometryDrivenParts = ['ANACONDA_LINES', 'ROTATING_HEAD'];
    if (geometryDrivenParts.includes(partData.partType)) {
      result.pressureValue = null;
    }
    return Promise.resolve(result);
  }),
  removePartFromStack: jest.fn().mockResolvedValue(undefined),
  updateStackOrder: jest.fn().mockResolvedValue(undefined),
  getStackWithParts: jest.fn().mockImplementation((id: string) => Promise.resolve(id === '550e8400-e29b-41d4-a716-446655440002' ? {
    stack: { ...mockStack, id },
    parts: [{ ...mockPartSelection, flangeSpec: mockFlangeSpec }],
    orderedParts: [{ ...mockPartSelection, flangeSpec: mockFlangeSpec }]
  } : null)),
  
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
  getReport: jest.fn().mockImplementation((id: string) => Promise.resolve(id === '550e8400-e29b-41d4-a716-446655440004' ? mockReportExport : null)),
  updateReportExportPdf: jest.fn().mockResolvedValue(undefined),
};

jest.mock('../server/storage', () => ({
  storage: mockStorage
}));

// Mock PDF generation service
jest.mock('../server/services/pdfGenerator', () => ({
  generatePDF: jest.fn().mockResolvedValue('/tmp/test-report.pdf')
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

// Export the mock storage for test access
export { mockStorage };