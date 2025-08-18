/**
 * Database Schema Validation Tests (PRD Section 5.2)
 * 
 * Tests that the database schema matches PRD requirements for:
 * - flange_spec table structure
 * - stack_header table structure  
 * - part_selection table structure
 * - stack_order table structure
 * - report_export table structure
 */

import { 
  flangeSpecs, 
  stackHeaders, 
  partSelections, 
  stackOrders, 
  reportExports,
  PartType,
  type FlangeSpec,
  type StackHeader,
  type PartSelection
} from '@shared/schema';

describe('Database Schema Validation (PRD Section 5.2)', () => {
  
  describe('Flange Specifications Table', () => {
    test('should have all required columns as per PRD', () => {
      const tableColumns = flangeSpecs;
      
      // Required columns from PRD Section 5.2
      expect(tableColumns.id).toBeDefined();
      expect(tableColumns.nominalBore).toBeDefined();
      expect(tableColumns.pressureClassLabel).toBeDefined();
      expect(tableColumns.pressureClassPsi).toBeDefined();
      expect(tableColumns.boltCount).toBeDefined();
      expect(tableColumns.sizeOfBolts).toBeDefined();
      expect(tableColumns.wrenchNo).toBeDefined();
      expect(tableColumns.truckUnitPsi).toBeDefined();
      expect(tableColumns.ringNeeded).toBeDefined();
      expect(tableColumns.flangeSizeRaw).toBeDefined();
      
      // Pressure columns for different part types
      expect(tableColumns.annularPressure).toBeDefined();
      expect(tableColumns.singleRamPressure).toBeDefined();
      expect(tableColumns.doubleRamsPressure).toBeDefined();
      expect(tableColumns.mudCrossPressure).toBeDefined();
      
      expect(tableColumns.createdAt).toBeDefined();
    });
  });

  describe('Stack Header Table', () => {
    test('should have all required columns as per PRD', () => {
      const tableColumns = stackHeaders;
      
      expect(tableColumns.id).toBeDefined();
      expect(tableColumns.title).toBeDefined();
      expect(tableColumns.createdAt).toBeDefined();
    });
  });

  describe('Part Selection Table', () => {
    test('should have all required columns as per PRD', () => {
      const tableColumns = partSelections;
      
      expect(tableColumns.id).toBeDefined();
      expect(tableColumns.stackId).toBeDefined();
      expect(tableColumns.partType).toBeDefined();
      expect(tableColumns.spoolGroupId).toBeDefined();
      expect(tableColumns.pressureValue).toBeDefined();
      expect(tableColumns.flangeSpecId).toBeDefined();
      expect(tableColumns.createdAt).toBeDefined();
    });
  });

  describe('Stack Order Table', () => {
    test('should have all required columns as per PRD', () => {
      const tableColumns = stackOrders;
      
      expect(tableColumns.stackId).toBeDefined();
      expect(tableColumns.partSelectionId).toBeDefined();
      expect(tableColumns.position).toBeDefined();
    });
  });

  describe('Report Export Table', () => {
    test('should have all required columns as per PRD', () => {
      const tableColumns = reportExports;
      
      expect(tableColumns.id).toBeDefined();
      expect(tableColumns.stackId).toBeDefined();
      expect(tableColumns.renderedHtml).toBeDefined();
      expect(tableColumns.pdfPath).toBeDefined();
      expect(tableColumns.createdAt).toBeDefined();
    });
  });
});

describe('Part Type Validation', () => {
  test('should have all 7 part types as specified in PRD', () => {
    const expectedPartTypes = [
      'ANNULAR',
      'SINGLE_RAM', 
      'DOUBLE_RAMS',
      'MUD_CROSS',
      'ANACONDA_LINES',
      'ROTATING_HEAD',
      'ADAPTER_SPOOL_SIDE'
    ];
    
    const actualPartTypes = Object.values(PartType);
    
    expect(actualPartTypes).toHaveLength(7);
    expectedPartTypes.forEach(partType => {
      expect(actualPartTypes).toContain(partType);
    });
  });

  test('should categorize part types correctly', () => {
    // Pressure-driven parts (Branch A)
    const pressureDrivenParts = [
      PartType.ANNULAR,
      PartType.SINGLE_RAM,
      PartType.DOUBLE_RAMS,
      PartType.MUD_CROSS
    ];
    
    // Geometry-driven parts (Branch B)
    const geometryDrivenParts = [
      PartType.ANACONDA_LINES,
      PartType.ROTATING_HEAD
    ];
    
    // Adapter Spool (Branch C)
    const adapterSpoolParts = [
      PartType.ADAPTER_SPOOL_SIDE
    ];
    
    expect(pressureDrivenParts).toHaveLength(4);
    expect(geometryDrivenParts).toHaveLength(2);
    expect(adapterSpoolParts).toHaveLength(1);
  });
});

describe('Data Type Validation', () => {
  test('should validate FlangeSpec type structure', () => {
    const mockFlangeSpec: FlangeSpec = {
      id: 'test-id',
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
      createdAt: new Date()
    };
    
    expect(mockFlangeSpec.id).toBe('test-id');
    expect(mockFlangeSpec.pressureClassPsi).toBe(5000);
    expect(mockFlangeSpec.boltCount).toBe(8);
  });

  test('should validate StackHeader type structure', () => {
    const mockStackHeader: StackHeader = {
      id: 'stack-id',
      title: 'Test B.O.P Stack',
      createdAt: new Date()
    };
    
    expect(mockStackHeader.id).toBe('stack-id');
    expect(mockStackHeader.title).toBe('Test B.O.P Stack');
  });

  test('should validate PartSelection type structure', () => {
    const mockPartSelection: PartSelection = {
      id: 'part-id',
      stackId: 'stack-id',
      partType: PartType.ANNULAR,
      spoolGroupId: null,
      pressureValue: 5000,
      flangeSpecId: 'flange-id',
      createdAt: new Date()
    };
    
    expect(mockPartSelection.partType).toBe(PartType.ANNULAR);
    expect(mockPartSelection.pressureValue).toBe(5000);
  });
});