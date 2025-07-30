import { useState, useCallback, useRef, useEffect } from 'react';
import { useReactFlow } from '@xyflow/react';
import { EditMode, DrawingMode } from '../../typings';
import { MIN_RECTANGLE_SIZE } from '../constants';

interface UseRectangleDrawingProps {
  editMode: EditMode;
  drawingMode: DrawingMode;
  onCreateRectangle: (startX: number, startY: number, endX: number, endY: number) => void;
}

interface DrawingState {
  isDrawing: boolean;
  startPos: { x: number; y: number };
  currentPos: { x: number; y: number };
  startScreenPos: { x: number; y: number };
  currentScreenPos: { x: number; y: number };
}

export const useRectangleDrawing = ({ 
  editMode, 
  drawingMode, 
  onCreateRectangle 
}: UseRectangleDrawingProps) => {
  const { screenToFlowPosition } = useReactFlow();
  const containerRef = useRef<HTMLDivElement>(null);
  
  const [drawingState, setDrawingState] = useState<DrawingState>({
    isDrawing: false,
    startPos: { x: 0, y: 0 },
    currentPos: { x: 0, y: 0 },
    startScreenPos: { x: 0, y: 0 },
    currentScreenPos: { x: 0, y: 0 },
  });

  const handleMouseDown = useCallback((event: MouseEvent) => {
    if (drawingMode !== DrawingMode.RECTANGLE || editMode !== EditMode.LAYER) return;
    
    const wrapper = containerRef.current;
    if (!wrapper) return;
    
    const rect = wrapper.getBoundingClientRect();
    const screenX = event.clientX - rect.left;
    const screenY = event.clientY - rect.top;
    
    const position = screenToFlowPosition({ 
      x: event.clientX, 
      y: event.clientY
    });
    
    setDrawingState({
      isDrawing: true,
      startPos: position,
      currentPos: position,
      startScreenPos: { x: screenX, y: screenY },
      currentScreenPos: { x: screenX, y: screenY },
    });
  }, [drawingMode, editMode, screenToFlowPosition]);

  const handleMouseMove = useCallback((event: MouseEvent) => {
    if (!drawingState.isDrawing || drawingMode !== DrawingMode.RECTANGLE) return;
    
    const wrapper = containerRef.current;
    if (!wrapper) return;
    
    const rect = wrapper.getBoundingClientRect();
    const screenX = event.clientX - rect.left;
    const screenY = event.clientY - rect.top;
    
    const position = screenToFlowPosition({ 
      x: event.clientX, 
      y: event.clientY
    });
    
    setDrawingState(prev => ({
      ...prev,
      currentPos: position,
      currentScreenPos: { x: screenX, y: screenY },
    }));
  }, [drawingState.isDrawing, drawingMode, screenToFlowPosition]);

  const handleMouseUp = useCallback((event: MouseEvent) => {
    if (!drawingState.isDrawing || drawingMode !== DrawingMode.RECTANGLE) return;
    
    const wrapper = containerRef.current;
    if (!wrapper) return;
    
    const rect = wrapper.getBoundingClientRect();
    const endPosition = screenToFlowPosition({ 
      x: event.clientX, 
      y: event.clientY
    });
    
    const width = Math.abs(endPosition.x - drawingState.startPos.x);
    const height = Math.abs(endPosition.y - drawingState.startPos.y);
    
    if (width > MIN_RECTANGLE_SIZE && height > MIN_RECTANGLE_SIZE) {
      onCreateRectangle(drawingState.startPos.x, drawingState.startPos.y, endPosition.x, endPosition.y);
    }
    
    setDrawingState(prev => ({ ...prev, isDrawing: false }));
  }, [drawingState.isDrawing, drawingState.startPos, drawingMode, screenToFlowPosition, onCreateRectangle]);

  // Event listeners setup
  useEffect(() => {
    const wrapper = containerRef.current;
    if (!wrapper) return;

    wrapper.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      wrapper.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [handleMouseDown, handleMouseMove, handleMouseUp]);

  // Calculate preview rectangle for drawing using screen coordinates
  const previewRect = drawingState.isDrawing ? {
    x: Math.min(drawingState.startScreenPos.x, drawingState.currentScreenPos.x),
    y: Math.min(drawingState.startScreenPos.y, drawingState.currentScreenPos.y),
    width: Math.abs(drawingState.currentScreenPos.x - drawingState.startScreenPos.x),
    height: Math.abs(drawingState.currentScreenPos.y - drawingState.startScreenPos.y),
  } : null;

  return {
    containerRef,
    isDrawing: drawingState.isDrawing,
    previewRect,
  };
};