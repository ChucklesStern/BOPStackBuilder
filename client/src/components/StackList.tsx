import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  DndContext, 
  closestCenter, 
  KeyboardSensor, 
  PointerSensor, 
  useSensor, 
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import {
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Edit, Trash2, ChevronDown, FileText } from "lucide-react";
import type { StackWithParts, PartWithFlangeSpec } from "@/types";

interface StackListProps {
  stack: StackWithParts | null;
  onRemovePart: (partId: string) => void;
  onReorderParts: (orderedPartIds: string[]) => void;
  onGenerateReport: () => void;
}

interface SortableItemProps {
  part: PartWithFlangeSpec;
  onRemove: (partId: string) => void;
}

function SortableItem({ part, onRemove }: SortableItemProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: part.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const getPartDisplayName = () => {
    const names = {
      ANNULAR: "Annular",
      SINGLE_RAM: "Single B.O.P (RAM)",
      DOUBLE_RAMS: "Double B.O.P (RAMs)",
      MUD_CROSS: "Mud Cross",
      ANACONDA_LINES: "Anaconda Lines",
      ROTATING_HEAD: "Rotating Head",
      ADAPTER_SPOOL_SIDE: "Adapter Spool",
    };

    const baseName = names[part.partType as keyof typeof names] || part.partType;
    
    if (part.pressureValue) {
      return `${baseName} - ${part.pressureValue} PSI`;
    }
    
    return baseName;
  };

  const isAdapterSpool = part.partType === "ADAPTER_SPOOL_SIDE";

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="bg-neutral-50 border border-neutral-200 rounded-lg p-4 hover:shadow-sm transition-shadow"
    >
      <div className="flex items-center space-x-3">
        <div
          {...attributes}
          {...listeners}
          className="cursor-move text-neutral-400 hover:text-neutral-600"
        >
          <GripVertical className="h-4 w-4" />
        </div>
        
        <div className="flex-1">
          <div className="flex items-center justify-between">
            <h4 className="font-medium text-neutral-800">
              {getPartDisplayName()}
            </h4>
            <div className="flex items-center space-x-2">
              {isAdapterSpool && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsExpanded(!isExpanded)}
                >
                  <ChevronDown className={`h-4 w-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                className="text-neutral-400 hover:text-neutral-600"
              >
                <Edit className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onRemove(part.id)}
                className="text-red-400 hover:text-red-600"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
          
          <div className="text-sm text-neutral-600 mt-1">
            <div>Ring: {part.flangeSpec.ringNeeded}</div>
            <div>Flange: {part.flangeSpec.flangeSizeRaw}</div>
          </div>

          {/* Expandable Spool Details */}
          {isAdapterSpool && isExpanded && (
            <div className="mt-3 space-y-2 border-t border-neutral-200 pt-3">
              <div className="text-sm">
                <div className="font-medium text-neutral-700">Configuration:</div>
                <div className="text-neutral-600 ml-2">
                  Ring: {part.flangeSpec.ringNeeded} | 
                  Bolts: {part.flangeSpec.boltCount} × {part.flangeSpec.sizeOfBolts} |
                  Wrench: {part.flangeSpec.wrenchNo} |
                  Truck PSI: {part.flangeSpec.truckUnitPsi}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function StackList({ 
  stack, 
  onRemovePart, 
  onReorderParts, 
  onGenerateReport 
}: StackListProps) {
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const parts = stack?.parts || [];
  const partIds = parts.map(p => p.id);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = partIds.indexOf(active.id as string);
      const newIndex = partIds.indexOf(over.id as string);

      const newOrder = arrayMove(partIds, oldIndex, newIndex);
      onReorderParts(newOrder);
    }
  };

  return (
    <Card className="sticky top-6">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Stack Order</CardTitle>
          <span className="bg-neutral-200 text-neutral-700 px-2 py-1 rounded text-sm font-medium">
            {parts.length} part{parts.length !== 1 ? 's' : ''}
          </span>
        </div>
      </CardHeader>
      
      <CardContent>
        {parts.length === 0 ? (
          <div className="text-center py-8 text-neutral-500">
            <div className="text-neutral-400 text-3xl mb-2">📋</div>
            <p>No parts added yet</p>
          </div>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext items={partIds} strategy={verticalListSortingStrategy}>
              <div className="space-y-3 min-h-[200px]">
                {parts.map((part) => (
                  <SortableItem
                    key={part.id}
                    part={part}
                    onRemove={onRemovePart}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}

        {parts.length > 0 && (
          <div className="mt-6 pt-4 border-t border-neutral-200">
            <Button
              onClick={onGenerateReport}
              className="w-full bg-accent-500 hover:bg-accent-600 text-white"
            >
              <FileText className="h-4 w-4 mr-2" />
              Generate Report
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
