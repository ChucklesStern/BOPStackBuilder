import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { StackWithParts, PartSelectionData } from "@/types";

export function useStack() {
  const [currentStackId, setCurrentStackId] = useState<string | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Get current stack data
  const { data: currentStack, isLoading } = useQuery({
    queryKey: ["/api/stack", currentStackId],
    enabled: !!currentStackId,
  });

  const createStackMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/stack", { title: "B.O.P Stack" });
      return await response.json();
    },
    onSuccess: (stack) => {
      setCurrentStackId(stack.id);
      toast({
        title: "Stack Created",
        description: "New B.O.P stack created successfully.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to create stack",
        variant: "destructive",
      });
    },
  });

  const addPartMutation = useMutation({
    mutationFn: async (partData: PartSelectionData) => {
      console.log('DEBUG: addPartMutation mutationFn called with:', partData);
      console.log('DEBUG: currentStackId:', currentStackId);
      
      if (!currentStackId) {
        console.log('DEBUG: No stack selected, throwing error');
        throw new Error("No stack selected");
      }
      
      // Handle adapter spool with multiple sides
      if (partData.partType === "ADAPTER_SPOOL_SIDE" && partData.sides) {
        console.log('DEBUG: Handling adapter spool with multiple sides');
        const responses = [];
        for (const side of partData.sides) {
          console.log('DEBUG: Making API request for side:', side);
          const response = await apiRequest("POST", `/api/stack/${currentStackId}/items`, {
            partType: "ADAPTER_SPOOL_SIDE",
            spoolGroupId: partData.spoolGroupId,
            flangeSpecId: side.flangeSpecId,
            pressureValue: side.pressureValue,
          });
          responses.push(await response.json());
        }
        console.log('DEBUG: Adapter spool responses:', responses);
        return responses;
      } else {
        console.log('DEBUG: Making API request for regular part:', `/api/stack/${currentStackId}/items`);
        const response = await apiRequest("POST", `/api/stack/${currentStackId}/items`, partData);
        const result = await response.json();
        console.log('DEBUG: API response result:', result);
        return result;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/stack", currentStackId] });
      toast({
        title: "Part Added",
        description: "Part has been added to your stack successfully.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to add part",
        variant: "destructive",
      });
    },
  });

  const removePartMutation = useMutation({
    mutationFn: async (partId: string) => {
      if (!currentStackId) throw new Error("No stack selected");
      
      const response = await apiRequest("DELETE", `/api/stack/${currentStackId}/items/${partId}`);
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/stack", currentStackId] });
      toast({
        title: "Part Removed",
        description: "Part has been removed from your stack.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to remove part",
        variant: "destructive",
      });
    },
  });

  const reorderMutation = useMutation({
    mutationFn: async (orderedPartIds: string[]) => {
      if (!currentStackId) throw new Error("No stack selected");
      
      const response = await apiRequest("PATCH", `/api/stack/${currentStackId}/order`, {
        orderedPartIds,
      });
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/stack", currentStackId] });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to reorder parts",
        variant: "destructive",
      });
    },
  });

  const deleteStackMutation = useMutation({
    mutationFn: async () => {
      if (!currentStackId) throw new Error("No stack selected");
      
      const response = await apiRequest("DELETE", `/api/stack/${currentStackId}`);
      return await response.json();
    },
    onSuccess: () => {
      setCurrentStackId(null);
      queryClient.removeQueries({ queryKey: ["/api/stack"] });
      toast({
        title: "Stack Cleared",
        description: "Stack has been cleared and reset.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to clear stack",
        variant: "destructive",
      });
    },
  });

  const generateReportMutation = useMutation({
    mutationFn: async () => {
      if (!currentStackId) throw new Error("No stack selected");
      
      const response = await apiRequest("POST", `/api/stack/${currentStackId}/report`);
      return await response.json();
    },
    onSuccess: (report) => {
      // Download the PDF immediately
      const link = document.createElement('a');
      link.href = `/api/reports/${report.id}/pdf`;
      link.download = `bop-stack-report-${report.id}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      toast({
        title: "Report Generated",
        description: "PDF report has been generated and downloaded.",
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

  return {
    currentStack: currentStack as StackWithParts | null,
    isLoading,
    createNewStack: () => createStackMutation.mutate(),
    addPartToStack: (partData: PartSelectionData) => addPartMutation.mutateAsync(partData),
    removePartFromStack: (partId: string) => removePartMutation.mutate(partId),
    reorderStack: (orderedPartIds: string[]) => reorderMutation.mutate(orderedPartIds),
    clearStack: () => deleteStackMutation.mutate(),
    generateReport: (reportId: string) => generateReportMutation.mutate(),
    isAddingPart: addPartMutation.isPending,
    isGeneratingReport: generateReportMutation.isPending,
  };
}
