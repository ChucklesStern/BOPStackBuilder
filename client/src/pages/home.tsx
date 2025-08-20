import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Upload, HelpCircle, Factory } from "lucide-react";
import PartTypeModal from "@/components/PartTypeModal";
import PartConfiguration from "@/components/PartConfiguration";
import StackList from "@/components/StackList";
import ReportModal from "@/components/ReportModal";
import DataUploadModal from "@/components/DataUploadModal";
import { useStack } from "@/hooks/useStack";
import type { PartTypeValue } from "@/types";

export default function Home() {
  const [showPartTypeModal, setShowPartTypeModal] = useState(false);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [selectedPartType, setSelectedPartType] = useState<PartTypeValue | null>(null);
  
  const { 
    currentStack, 
    createNewStack, 
    addPartToStack, 
    removePartFromStack,
    reorderStack,
    clearStack,
    generateReport,
    isAddingPart
  } = useStack();

  const handleAddPart = async () => {
    if (!currentStack) {
      try {
        await createNewStack();
      } catch (error) {
        console.error('Failed to create stack:', error);
        return; // Don't show modal if stack creation failed
      }
    }
    setShowPartTypeModal(true);
  };

  const handleSelectPartType = (partType: PartTypeValue) => {
    setSelectedPartType(partType);
    setShowPartTypeModal(false);
    setShowConfigModal(true);
  };

  const handlePartConfigured = async (partData: any) => {
    console.log('DEBUG: handlePartConfigured called with:', partData);
    console.log('DEBUG: currentStack exists:', !!currentStack);
    
    if (currentStack) {
      try {
        console.log('DEBUG: Calling addPartToStack...');
        await addPartToStack(partData);
        console.log('DEBUG: addPartToStack successful');
        setShowConfigModal(false);
        setSelectedPartType(null);
      } catch (error) {
        console.error('DEBUG: Failed to add part:', error);
        // Error is already handled in useStack hook
      }
    } else {
      console.log('DEBUG: No current stack available');
    }
  };

  const handleGenerateReport = () => {
    setShowReportModal(true);
  };

  const handleClearStack = () => {
    clearStack();
    setShowReportModal(false);
  };

  const hasStackItems = currentStack?.parts && currentStack.parts.length > 0;

  return (
    <div className="min-h-screen bg-neutral-100">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-neutral-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <Factory className="text-industrial-600 h-8 w-8" />
              <h1 className="text-xl font-semibold text-neutral-800">B.O.P Stack Builder</h1>
              <span className="bg-neutral-200 text-neutral-700 px-2 py-1 rounded text-sm font-medium">
                Field Application
              </span>
            </div>
            <div className="flex items-center space-x-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowUploadModal(true)}
                className="text-neutral-600 hover:text-neutral-800"
              >
                <Upload className="h-4 w-4 mr-1" />
                <span className="hidden sm:inline">Upload Data</span>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="text-neutral-600 hover:text-neutral-800"
              >
                <HelpCircle className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Builder */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg shadow-sm border border-neutral-200 p-6 mb-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-semibold text-neutral-800">Build Your B.O.P Stack</h2>
                <Button
                  onClick={handleAddPart}
                  className="bg-industrial-600 hover:bg-industrial-700 text-white"
                >
                  <span className="mr-2">+</span>
                  Add Part
                </Button>
              </div>

              {/* Part Configuration */}
              {showConfigModal && selectedPartType && (
                <PartConfiguration
                  partType={selectedPartType}
                  onComplete={handlePartConfigured}
                  onCancel={() => {
                    setShowConfigModal(false);
                    setSelectedPartType(null);
                  }}
                  isAddingPart={isAddingPart}
                />
              )}

              {/* Empty State */}
              {!showConfigModal && !hasStackItems && (
                <div className="text-center py-12">
                  <div className="text-neutral-400 text-5xl mb-4">🏗️</div>
                  <h3 className="text-lg font-medium text-neutral-600 mb-2">
                    Your B.O.P stack is empty
                  </h3>
                  <p className="text-neutral-500 mb-6">
                    Add parts to start building your Blowout Preventer stack
                  </p>
                  <Button
                    onClick={handleAddPart}
                    className="bg-industrial-600 hover:bg-industrial-700 text-white"
                  >
                    <span className="mr-2">+</span>
                    Add Your First Part
                  </Button>
                </div>
              )}
            </div>
          </div>

          {/* Stack List */}
          <div className="lg:col-span-1">
            <StackList
              stack={currentStack}
              onRemovePart={removePartFromStack}
              onReorderParts={reorderStack}
              onGenerateReport={handleGenerateReport}
            />
          </div>
        </div>
      </div>

      {/* Modals */}
      <PartTypeModal
        isOpen={showPartTypeModal}
        onClose={() => setShowPartTypeModal(false)}
        onSelectPartType={handleSelectPartType}
      />

      <ReportModal
        isOpen={showReportModal}
        onClose={() => setShowReportModal(false)}
        stack={currentStack}
        onClearStack={handleClearStack}
        onGenerateReport={generateReport}
      />

      <DataUploadModal
        isOpen={showUploadModal}
        onClose={() => setShowUploadModal(false)}
      />
    </div>
  );
}
