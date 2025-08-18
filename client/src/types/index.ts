export interface FlangeSpec {
  id: string;
  nominalBore: string;
  pressureClassLabel: string;
  pressureClassPsi: number;
  boltCount: number;
  sizeOfBolts: string;
  wrenchNo: number;
  truckUnitPsi: number;
  ringNeeded: string;
  flangeSizeRaw: string;
  annularPressure?: number | null;
  singleRamPressure?: number | null;
  doubleRamsPressure?: number | null;
  mudCrossPressure?: number | null;
  createdAt: string;
}

export interface StackHeader {
  id: string;
  title: string;
  createdAt: string;
}

export interface PartSelection {
  id: string;
  stackId: string;
  partType: string;
  spoolGroupId?: string | null;
  pressureValue?: number | null;
  flangeSpecId: string;
  createdAt: string;
}

export interface PartWithFlangeSpec extends PartSelection {
  flangeSpec: FlangeSpec;
}

export interface StackWithParts {
  stack: StackHeader;
  parts: PartWithFlangeSpec[];
}

export interface PartSelectionData {
  partType: string;
  flangeSpecId?: string;
  pressureValue?: number | null;
  spoolGroupId?: string;
  sides?: Array<{
    flangeSpecId: string;
    pressureValue: number | null;
  }>;
}

export type PartTypeValue = 
  | "ANNULAR"
  | "SINGLE_RAM"
  | "DOUBLE_RAMS"
  | "MUD_CROSS"
  | "ANACONDA_LINES"
  | "ROTATING_HEAD"
  | "ADAPTER_SPOOL";
