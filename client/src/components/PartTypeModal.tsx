import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { 
  Settings, 
  Wrench, 
  Gavel, 
  Plus, 
  Grip, 
  RotateCcw, 
  ArrowLeftRight 
} from "lucide-react";
import type { PartTypeValue } from "@/types";

interface PartTypeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectPartType: (partType: PartTypeValue) => void;
}

const partTypes = [
  {
    type: "ANNULAR" as PartTypeValue,
    label: "Annular",
    description: "Pressure-driven selection",
    icon: Settings,
  },
  {
    type: "SINGLE_RAM" as PartTypeValue,
    label: "Single B.O.P (RAM)",
    description: "Pressure-driven selection",
    icon: Wrench,
  },
  {
    type: "DOUBLE_RAMS" as PartTypeValue,
    label: "Double B.O.P (RAMs)",
    description: "Pressure-driven selection",
    icon: Gavel,
  },
  {
    type: "MUD_CROSS" as PartTypeValue,
    label: "Mud Cross",
    description: "Pressure-driven selection",
    icon: Plus,
  },
  {
    type: "ANACONDA_LINES" as PartTypeValue,
    label: "Anaconda Lines",
    description: "Geometry-driven selection",
    icon: Grip,
  },
  {
    type: "ROTATING_HEAD" as PartTypeValue,
    label: "Rotating Head",
    description: "Geometry-driven selection",
    icon: RotateCcw,
  },
  {
    type: "ADAPTER_SPOOL" as PartTypeValue,
    label: "Adapter Spool",
    description: "Dual-side configuration",
    icon: ArrowLeftRight,
  },
];

export default function PartTypeModal({ isOpen, onClose, onSelectPartType }: PartTypeModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Select Part Type</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-3">
          {partTypes.map((partType) => {
            const IconComponent = partType.icon;
            
            return (
              <Button
                key={partType.type}
                variant="outline"
                className="w-full justify-start p-3 h-auto hover:border-industrial-300 hover:bg-industrial-50"
                onClick={() => onSelectPartType(partType.type)}
              >
                <div className="flex items-center space-x-3">
                  <IconComponent className="h-5 w-5 text-industrial-600" />
                  <div className="text-left">
                    <div className="font-medium">{partType.label}</div>
                    <div className="text-sm text-neutral-600">{partType.description}</div>
                  </div>
                </div>
              </Button>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
