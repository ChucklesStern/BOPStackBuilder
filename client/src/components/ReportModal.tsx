import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Download, ArrowLeft, Trash2, FileText } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { StackWithParts, PartWithFlangeSpec } from "@/types";

interface ReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  stack: StackWithParts | null;
  onClearStack: () => void;
  onGenerateReport: (reportId: string) => void;
}

export default function ReportModal({ 
  isOpen, 
  onClose, 
  stack, 
  onClearStack,
  onGenerateReport 
}: ReportModalProps) {
  const { toast } = useToast();

  const generateReportMutation = useMutation({
    mutationFn: async () => {
      if (!stack) throw new Error("No stack selected");
      
      const response = await apiRequest("POST", `/api/stack/${stack.stack.id}/report`);
      return await response.json();
    },
    onSuccess: (report) => {
      onGenerateReport(report.id);
      toast({
        title: "Report Generated",
        description: "Your B.O.P stack report has been generated successfully.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to generate report",
        variant: "destructive",
      });
    },
  });

  const downloadPDFMutation = useMutation({
    mutationFn: async (reportId: string) => {
      const response = await fetch(`/api/reports/${reportId}/pdf`);
      if (!response.ok) throw new Error("Failed to download PDF");
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `bop-stack-report-${reportId}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    },
    onSuccess: () => {
      toast({
        title: "Download Started",
        description: "Your PDF report is being downloaded.",
      });
    },
    onError: (error) => {
      toast({
        title: "Download Failed",
        description: error instanceof Error ? error.message : "Failed to download PDF",
        variant: "destructive",
      });
    },
  });

  const generateReportLines = (parts: PartWithFlangeSpec[]): string[] => {
    const lines: string[] = [];
    const spoolGroups = new Map<string, PartWithFlangeSpec[]>();
    let spoolLetter = 'A';

    // Separate regular parts and adapter spool sides
    const regularParts = parts.filter(p => p.partType !== "ADAPTER_SPOOL_SIDE");
    const spoolSides = parts.filter(p => p.partType === "ADAPTER_SPOOL_SIDE");

    // Group spool sides by spoolGroupId
    spoolSides.forEach(side => {
      if (side.spoolGroupId) {
        if (!spoolGroups.has(side.spoolGroupId)) {
          spoolGroups.set(side.spoolGroupId, []);
        }
        spoolGroups.get(side.spoolGroupId)!.push(side);
      }
    });

    // Generate lines for regular parts
    regularParts.forEach(part => {
      const partName = getPartDisplayName(part);
      const { flangeSpec } = part;
      
      const line = `${partName} – Ring: ${flangeSpec.ringNeeded} | Size of Bolts: ${flangeSpec.sizeOfBolts} | # Bolts: ${flangeSpec.boltCount} | Flange: ${flangeSpec.flangeSizeRaw} | Wrench Required: ${flangeSpec.wrenchNo} | Set Truck PSI to: ${flangeSpec.truckUnitPsi}`;
      lines.push(line);
    });

    // Generate lines for adapter spools
    spoolGroups.forEach(sides => {
      sides.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      
      sides.forEach((side, index) => {
        const sideNumber = index + 1;
        const { flangeSpec } = side;
        
        const line = `Adapter Spool ${spoolLetter} — Side ${sideNumber} – Ring: ${flangeSpec.ringNeeded} | Size of Bolts: ${flangeSpec.sizeOfBolts} | # Bolts: ${flangeSpec.boltCount} | Flange: ${flangeSpec.flangeSizeRaw} | Wrench Required: ${flangeSpec.wrenchNo} | Set Truck PSI to: ${flangeSpec.truckUnitPsi}`;
        lines.push(line);
      });
      
      spoolLetter = String.fromCharCode(spoolLetter.charCodeAt(0) + 1);
    });

    return lines;
  };

  const getPartDisplayName = (part: PartWithFlangeSpec): string => {
    const names = {
      ANNULAR: "Annular",
      SINGLE_RAM: "Single B.O.P (RAM)",
      DOUBLE_RAMS: "Double B.O.P (RAMs)",
      MUD_CROSS: "Mud Cross",
      ANACONDA_LINES: "Anaconda Lines",
      ROTATING_HEAD: "Rotating Head",
    };

    const baseName = names[part.partType as keyof typeof names] || part.partType;
    
    const pressureDrivenParts = ["ANNULAR", "SINGLE_RAM", "DOUBLE_RAMS", "MUD_CROSS"];
    if (pressureDrivenParts.includes(part.partType) && part.pressureValue) {
      return `${baseName} – Pressure ${part.pressureValue}`;
    }
    
    return baseName;
  };

  const getPressureRanges = (parts: PartWithFlangeSpec[]): string => {
    const pressures = parts
      .map(p => p.pressureValue)
      .filter(p => p && p > 0)
      .sort((a, b) => a! - b!);
    
    if (pressures.length === 0) return 'N/A';
    
    const min = Math.min(...pressures as number[]);
    const max = Math.max(...pressures as number[]);
    
    return min === max ? `${min} PSI` : `${min}-${max} PSI`;
  };

  const getFlangeClasses = (parts: PartWithFlangeSpec[]): string => {
    const classes = Array.from(new Set(
      parts.map(p => p.flangeSpec.pressureClassLabel)
    )).sort();
    
    return classes.join(', ') || 'N/A';
  };

  if (!stack) return null;

  const reportLines = generateReportLines(stack.parts);
  const timestamp = new Date().toLocaleString();

  const handleGenerateAndDownload = async () => {
    try {
      const report = await generateReportMutation.mutateAsync();
      await downloadPDFMutation.mutateAsync(report.id);
    } catch (error) {
      // Error handling is done in the mutations
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <FileText className="h-5 w-5" />
            <span>B.O.P Stack Report</span>
          </DialogTitle>
        </DialogHeader>
        
        <div className="overflow-y-auto max-h-[calc(90vh-140px)]">
          {/* Report Header */}
          <div className="mb-6 pb-4 border-b border-neutral-200">
            <h4 className="text-lg font-semibold mb-2">Stack Configuration Report</h4>
            <div className="text-sm text-neutral-600">
              <span>Generated: </span>
              <span>{timestamp}</span>
            </div>
          </div>

          {/* Report Content */}
          <div className="space-y-4 font-mono text-sm mb-6">
            {reportLines.map((line, index) => {
              const isAdapterSpool = line.includes('Adapter Spool');
              return (
                <div
                  key={index}
                  className={`p-3 rounded border-l-4 ${
                    isAdapterSpool 
                      ? 'bg-accent-50 border-accent-500' 
                      : 'bg-industrial-50 border-industrial-500'
                  }`}
                >
                  {line}
                </div>
              );
            })}
          </div>

          {/* Report Summary */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-industrial-50 rounded p-4">
                  <div className="text-sm text-industrial-700 font-medium">Total Parts</div>
                  <div className="text-2xl font-bold text-industrial-800">{stack.parts.length}</div>
                </div>
                <div className="bg-neutral-50 rounded p-4">
                  <div className="text-sm text-neutral-700 font-medium">Pressure Ranges</div>
                  <div className="text-sm text-neutral-800">{getPressureRanges(stack.parts)}</div>
                </div>
                <div className="bg-neutral-50 rounded p-4">
                  <div className="text-sm text-neutral-700 font-medium">Flange Classes</div>
                  <div className="text-sm text-neutral-800">{getFlangeClasses(stack.parts)}</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-between pt-4 border-t border-neutral-200 bg-neutral-50 -mx-6 -mb-6 px-6 py-4">
          <Button variant="ghost" onClick={onClose}>
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back to Builder
          </Button>
          
          <div className="flex items-center space-x-3">
            <Button variant="outline" onClick={onClearStack}>
              <Trash2 className="h-4 w-4 mr-1" />
              Clear & Start New
            </Button>
            <Button
              onClick={handleGenerateAndDownload}
              disabled={generateReportMutation.isPending || downloadPDFMutation.isPending}
              className="bg-accent-500 hover:bg-accent-600 text-white"
            >
              <Download className="h-4 w-4 mr-2" />
              {generateReportMutation.isPending || downloadPDFMutation.isPending 
                ? 'Generating...' 
                : 'Download PDF'
              }
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
