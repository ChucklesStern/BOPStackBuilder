import XLSX from 'xlsx';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync } from 'fs';
import { db } from '../db';
import { flangeSpecs, partPressureOptions } from '../../shared/schema';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface FlangeRow {
  'Flange size': string;
  '# of bolts': number;
  'Size of bolts': string;
  'Wrench': number;
  'Truck Unit PSI': number;
  'Ring needed': string;
  'Annular Pressure'?: number;
  'Single B.O.P (RAM)'?: number;
  'Double B.O.P (Double Rams)'?: number;
  'Mud Cross'?: number;
}

interface WrenchRow {
  'Wrench #': number;
  'Stud diameter (inches)': string;
  'Truck Unit PSI setting': number;
}

async function importFlangeData() {
  try {
    const excelPath = join(__dirname, '../../attached_assets/Hammer_Torque_Wrench_Numbers (1)_1755490533262.xlsx');
    
    if (!existsSync(excelPath)) {
      console.error('Excel file not found at:', excelPath);
      return;
    }

    const workbook = XLSX.readFile(excelPath);
    
    // Read Common Flanges sheet
    const flangeSheet = workbook.Sheets['Common Flanges'];
    const flangeData: FlangeRow[] = XLSX.utils.sheet_to_json(flangeSheet);
    
    // Read Size Scale sheet for wrench data
    const wrenchSheet = workbook.Sheets['Size Scale'];
    const wrenchData: WrenchRow[] = XLSX.utils.sheet_to_json(wrenchSheet);
    
    console.log(`Found ${flangeData.length} flange records and ${wrenchData.length} wrench records`);
    
    // Create a map of wrench numbers to PSI settings for validation
    const wrenchMap = new Map<number, number>();
    wrenchData.forEach(row => {
      wrenchMap.set(row['Wrench #'], row['Truck Unit PSI setting']);
    });
    
    // Process flange data and insert into database
    const flangeSpecs_data = flangeData.map(row => {
      // Parse flange size to extract nominal bore and pressure class
      const flangeSize = row['Flange size'];
      const [nominalBore, pressureClass] = flangeSize.split(' ');
      
      // Extract PSI from pressure class (e.g., "5M" -> 5000, "10M" -> 10000, "3M" -> 3000)
      let pressureClassPsi = 0;
      if (pressureClass) {
        const match = pressureClass.match(/(\d+)M/);
        if (match) {
          pressureClassPsi = parseInt(match[1]) * 1000;
        }
      }
      
      // Validate wrench PSI matches expected value
      const expectedPSI = wrenchMap.get(row['Wrench']);
      if (expectedPSI && expectedPSI !== row['Truck Unit PSI']) {
        console.warn(`PSI mismatch for ${flangeSize}: expected ${expectedPSI}, got ${row['Truck Unit PSI']}`);
      }
      
      return {
        nominalBore: nominalBore,
        pressureClassLabel: pressureClass || 'Unknown',
        pressureClassPsi: pressureClassPsi,
        flangeSizeRaw: flangeSize,
        boltCount: row['# of bolts'],
        sizeOfBolts: row['Size of bolts'],
        wrenchNo: row['Wrench'],
        truckUnitPsi: row['Truck Unit PSI'],
        ringNeeded: row['Ring needed'],
        // Use pressure class PSI as the pressure rating for all part types since the Excel doesn't have specific values
        // This allows all pressure-driven parts to use this flange specification
        annularPressure: pressureClassPsi > 0 ? pressureClassPsi : null,
        singleRamPressure: pressureClassPsi > 0 ? pressureClassPsi : null,
        doubleRamsPressure: pressureClassPsi > 0 ? pressureClassPsi : null,
        mudCrossPressure: pressureClassPsi > 0 ? pressureClassPsi : null,
      };
    });
    
    // Clear existing data and insert new data
    console.log('Clearing existing flange specs...');
    await db.delete(flangeSpecs);
    
    console.log('Inserting flange specs...');
    const insertedSpecs = await db.insert(flangeSpecs).values(flangeSpecs_data).returning();
    console.log(`Inserted ${insertedSpecs.length} flange specifications`);
    
    // Extract unique pressure options for each part type
    const pressureSet = new Set<number>();
    
    flangeSpecs_data.forEach(spec => {
      if (spec.annularPressure) pressureSet.add(spec.annularPressure);
      if (spec.singleRamPressure) pressureSet.add(spec.singleRamPressure);
      if (spec.doubleRamsPressure) pressureSet.add(spec.doubleRamsPressure);
      if (spec.mudCrossPressure) pressureSet.add(spec.mudCrossPressure);
    });
    
    const uniquePressures = Array.from(pressureSet).sort((a, b) => a - b);
    console.log('Available pressure options:', uniquePressures);
    
    // Insert pressure options for each part type that can use these pressures
    console.log('Clearing existing pressure options...');
    await db.delete(partPressureOptions);
    
    const pressureOptions: Array<{ partType: string, pressureValue: number }> = [];
    const partTypes = ['ANNULAR', 'SINGLE_RAM', 'DOUBLE_RAMS', 'MUD_CROSS'];
    
    partTypes.forEach(partType => {
      uniquePressures.forEach(pressure => {
        pressureOptions.push({
          partType: partType,
          pressureValue: pressure
        });
      });
    });
    
    if (pressureOptions.length > 0) {
      console.log('Inserting pressure options...');
      const insertedOptions = await db.insert(partPressureOptions).values(pressureOptions).returning();
      console.log(`Inserted ${insertedOptions.length} pressure options`);
    }
    
    console.log('\n--- Import Summary ---');
    console.log(`✓ ${insertedSpecs.length} flange specifications imported`);
    console.log(`✓ ${pressureOptions.length} pressure options imported`);
    console.log('✓ Database successfully populated with real flange data');
    
    // Show sample of imported data
    console.log('\n--- Sample Flange Specs ---');
    const sampleSpecs = await db.select().from(flangeSpecs).limit(3);
    sampleSpecs.forEach((spec, index) => {
      console.log(`${index + 1}. ${spec.flangeSizeRaw} - ${spec.boltCount} bolts, Size: ${spec.sizeOfBolts}`);
      console.log(`   Wrench: #${spec.wrenchNo}, PSI: ${spec.truckUnitPsi}, Ring: ${spec.ringNeeded}`);
      console.log(`   Pressures - Annular: ${spec.annularPressure}, Single: ${spec.singleRamPressure}, Double: ${spec.doubleRamsPressure}, Mud: ${spec.mudCrossPressure}`);
    });
    
  } catch (error) {
    console.error('Error importing flange data:', error);
    throw error;
  }
}

// Run the import
importFlangeData().catch(console.error);