import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { X, ChevronRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { PartTypeValue, FlangeSpec } from "@/types";

interface PartConfigurationProps {
  partType: PartTypeValue;
  onComplete: (partData: any) => void;
  onCancel: () => void;
  isAddingPart?: boolean;
}

const PRESSURE_DRIVEN_PARTS = ["ANNULAR", "SINGLE_RAM", "DOUBLE_RAMS", "MUD_CROSS"];
const PART_LABELS = {
  ANNULAR: "Annular",
  SINGLE_RAM: "Single B.O.P (RAM)",
  DOUBLE_RAMS: "Double B.O.P (RAMs)",
  MUD_CROSS: "Mud Cross",
  ANACONDA_LINES: "Anaconda Lines",
  ROTATING_HEAD: "Rotating Head",
  ADAPTER_SPOOL: "Adapter Spool",
};

interface ConfigState {
  pressure?: number;
  flangeSize?: string;
  boltCount?: number;
  boltSize?: string;
  selectedFlangeSpec?: FlangeSpec;
  side1Spec?: FlangeSpec;
  side2Spec?: FlangeSpec;
  currentSide?: 1 | 2;
}

export default function PartConfiguration({ partType, onComplete, onCancel, isAddingPart = false }: PartConfigurationProps) {
  const [config, setConfig] = useState<ConfigState>({});
  const [step, setStep] = useState(1);
  const { toast } = useToast();

  const isPressureDriven = PRESSURE_DRIVEN_PARTS.includes(partType);
  const isAdapterSpool = partType === "ADAPTER_SPOOL";

  // Get pressure options
  const { data: pressureOptions = [] } = useQuery({
    queryKey: ["/api/options/pressures", { part: partType }],
    enabled: isPressureDriven,
  });

  // Get flange options based on current filters
  const flangeFilters = {
    part: isAdapterSpool ? undefined : partType,
    pressure: config.pressure,
    flangeSize: config.flangeSize,
    boltCount: config.boltCount,
    boltSize: config.boltSize,
  };

  const { data: flangeOptions = [] } = useQuery({
    queryKey: ["/api/options/flanges", flangeFilters],
  });

  // Auto-select flange spec when we have exactly one option
  useEffect(() => {
    const specs = flangeOptions as FlangeSpec[];
    if (specs.length === 1 && !config.selectedFlangeSpec) {
      setConfig(prev => ({ ...prev, selectedFlangeSpec: specs[0] }));
    } else if (specs.length !== 1 && config.selectedFlangeSpec) {
      // Clear selection if we don't have exactly one match
      setConfig(prev => ({ ...prev, selectedFlangeSpec: undefined }));
    }
  }, [flangeOptions, config.selectedFlangeSpec]);

  // Get unique values for dropdowns
  const uniqueFlangeSizes = Array.from(new Set((flangeOptions as FlangeSpec[]).map((f: any) => f.flangeSizeRaw)));
  const uniqueBoltCounts = Array.from(new Set((flangeOptions as FlangeSpec[]).map((f: any) => f.boltCount)));
  const uniqueBoltSizes = Array.from(new Set((flangeOptions as FlangeSpec[]).map((f: any) => f.sizeOfBolts)));

  const handlePressureChange = (pressure: string) => {
    setConfig(prev => ({ ...prev, pressure: parseInt(pressure) }));
    setStep(2);
  };

  const handleFlangeSelectionChange = (field: string, value: string) => {
    setConfig(prev => ({ 
      ...prev, 
      [field]: value,
      // Clear selectedFlangeSpec when making new selections
      selectedFlangeSpec: undefined
    }));
  };

  const matchesPressure = (flange: FlangeSpec, partType: string, pressure: number): boolean => {
    switch (partType) {
      case "ANNULAR":
        return flange.annularPressure === pressure;
      case "SINGLE_RAM":
        return flange.singleRamPressure === pressure;
      case "DOUBLE_RAMS":
        return flange.doubleRamsPressure === pressure;
      case "MUD_CROSS":
        return flange.mudCrossPressure === pressure;
      default:
        return true;
    }
  };

  const handleAdapterSpoolSideComplete = (spec: FlangeSpec) => {
    if (config.currentSide === 1) {
      setConfig(prev => ({ 
        ...prev, 
        side1Spec: spec, 
        currentSide: 2,
        // Reset other fields for side 2
        flangeSize: undefined,
        boltCount: undefined,
        boltSize: undefined,
        selectedFlangeSpec: undefined,
      }));
    } else {
      setConfig(prev => ({ ...prev, side2Spec: spec }));
    }
  };

  const canComplete = () => {
    if (isAdapterSpool) {
      return config.side1Spec && config.side2Spec;
    }
    return config.selectedFlangeSpec;
  };

  const handleComplete = () => {
    if (!canComplete()) {
      toast({
        title: "Configuration Incomplete",
        description: "Please complete all required selections.",
        variant: "destructive",
      });
      return;
    }

    if (isAdapterSpool && config.side1Spec && config.side2Spec) {
      const spoolGroupId = Date.now().toString(); // Use timestamp as temporary ID
      onComplete({
        partType: "ADAPTER_SPOOL_SIDE",
        spoolGroupId,
        sides: [
          {
            flangeSpecId: config.side1Spec.id,
            pressureValue: null,
          },
          {
            flangeSpecId: config.side2Spec.id,
            pressureValue: null,
          }
        ]
      });
    } else if (config.selectedFlangeSpec) {
      onComplete({
        partType,
        flangeSpecId: config.selectedFlangeSpec.id,
        pressureValue: config.pressure || null,
      });
    }
  };

  const currentSpec = isAdapterSpool 
    ? (config.currentSide === 1 ? config.selectedFlangeSpec : config.selectedFlangeSpec)
    : config.selectedFlangeSpec;

  return (
    <div className="bg-neutral-50 rounded-lg p-6 border border-neutral-200">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold">
          Configuring {PART_LABELS[partType as keyof typeof PART_LABELS]}
          {isAdapterSpool && config.currentSide && ` - Side ${config.currentSide}`}
        </h3>
        <Button variant="ghost" size="sm" onClick={onCancel}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Progress Steps */}
      <div className="flex items-center space-x-4 mb-6">
        {isPressureDriven && (
          <>
            <div className="flex items-center">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                step >= 1 ? 'bg-industrial-600 text-white' : 'bg-neutral-300 text-neutral-600'
              }`}>
                1
              </div>
              <span className="ml-2 text-sm font-medium text-industrial-600">Pressure</span>
            </div>
            <ChevronRight className="h-4 w-4 text-neutral-400" />
          </>
        )}
        <div className="flex items-center">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
            step >= 2 ? 'bg-industrial-600 text-white' : 'bg-neutral-300 text-neutral-600'
          }`}>
            {isPressureDriven ? '2' : '1'}
          </div>
          <span className="ml-2 text-sm font-medium">Configuration</span>
        </div>
        <ChevronRight className="h-4 w-4 text-neutral-400" />
        <div className="flex items-center">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
            canComplete() ? 'bg-industrial-600 text-white' : 'bg-neutral-300 text-neutral-600'
          }`}>
            {isPressureDriven ? '3' : '2'}
          </div>
          <span className="ml-2 text-sm">Review</span>
        </div>
      </div>

      {/* Step 1: Pressure Selection */}
      {isPressureDriven && step === 1 && (
        <div className="mb-6">
          <Label className="text-sm font-medium text-neutral-700 mb-2">
            What is the pressure of your part?
          </Label>
          <Select onValueChange={handlePressureChange}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select pressure..." />
            </SelectTrigger>
            <SelectContent>
              {(pressureOptions as number[]).map((pressure: any) => (
                <SelectItem key={pressure} value={pressure.toString()}>
                  {pressure.toLocaleString()} PSI
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Step 2: Flange Configuration */}
      {(!isPressureDriven || step >= 2) && (
        <div className="space-y-4 mb-6">
          {/* Flange Size */}
          <div>
            <Label className="text-sm font-medium text-neutral-700 mb-2">
              Select your flange size
            </Label>
            <Select onValueChange={(value) => handleFlangeSelectionChange('flangeSize', value)}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select flange size..." />
              </SelectTrigger>
              <SelectContent>
                {uniqueFlangeSizes.map((size: any) => (
                  <SelectItem key={size as string} value={size}>
                    {size}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Bolt Count (if multiple options) */}
          {uniqueBoltCounts.length > 1 && (
            <div>
              <Label className="text-sm font-medium text-neutral-700 mb-2">
                How many bolts does your flange need?
              </Label>
              <Select onValueChange={(value) => handleFlangeSelectionChange('boltCount', value)}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select bolt count..." />
                </SelectTrigger>
                <SelectContent>
                  {uniqueBoltCounts.map((count: any) => (
                    <SelectItem key={count as string} value={count.toString()}>
                      {count} bolts
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Bolt Size (if multiple options) */}
          {uniqueBoltSizes.length > 1 && (
            <div>
              <Label className="text-sm font-medium text-neutral-700 mb-2">
                Select your bolt size
              </Label>
              <Select onValueChange={(value) => handleFlangeSelectionChange('boltSize', value)}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select bolt size..." />
                </SelectTrigger>
                <SelectContent>
                  {uniqueBoltSizes.map((size: any) => (
                    <SelectItem key={size as string} value={size}>
                      {size}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
      )}

      {/* Live Preview */}
      {currentSpec && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-sm">Preview Specifications</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-neutral-600">Part Type:</span>
              <span className="font-medium">
                {PART_LABELS[partType as keyof typeof PART_LABELS]}
                {isAdapterSpool && config.currentSide && ` - Side ${config.currentSide}`}
              </span>
            </div>
            {isPressureDriven && config.pressure && (
              <div className="flex justify-between">
                <span className="text-neutral-600">Pressure:</span>
                <span className="font-medium">{config.pressure.toLocaleString()} PSI</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-neutral-600">Ring Needed:</span>
              <span className="font-medium">{currentSpec.ringNeeded}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-neutral-600">Flange Size:</span>
              <span className="font-medium">{currentSpec.flangeSizeRaw}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-neutral-600">Bolt Count:</span>
              <span className="font-medium">{currentSpec.boltCount}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-neutral-600">Bolt Size:</span>
              <span className="font-medium">{currentSpec.sizeOfBolts}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-neutral-600">Wrench Required:</span>
              <span className="font-medium">{currentSpec.wrenchNo}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-neutral-600">Truck PSI:</span>
              <span className="font-medium">{currentSpec.truckUnitPsi}</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Action Buttons */}
      <div className="flex justify-end space-x-3">
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        {isAdapterSpool && config.selectedFlangeSpec && !config.side2Spec && (
          <Button 
            onClick={() => handleAdapterSpoolSideComplete(config.selectedFlangeSpec!)}
            className="bg-industrial-600 hover:bg-industrial-700"
          >
            Configure Side 2
          </Button>
        )}
        <Button 
          onClick={handleComplete}
          disabled={!canComplete() || isAddingPart}
          className="bg-industrial-600 hover:bg-industrial-700"
        >
          {isAddingPart ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
              Adding...
            </>
          ) : (
            "Add to Stack"
          )}
        </Button>
      </div>
    </div>
  );
}
