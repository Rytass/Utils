import { useState, useCallback, useRef, useEffect } from 'react';
import { useReactFlow } from '@xyflow/react';
import { EditMode, DrawingMode } from '../../typings';

interface UsePenDrawingProps {
  editMode: EditMode;
  drawingMode: DrawingMode;
  onCreatePath: (points: { x: number; y: number }[]) => void;
}

interface DrawingState {
  isDrawing: boolean;
  points: { x: number; y: number }[];
  screenPoints: { x: number; y: number }[];
  currentMousePos: { x: number; y: number } | null;
  lastClickTime: number;
}

export const usePenDrawing = ({ 
  editMode, 
  drawingMode, 
  onCreatePath 
}: UsePenDrawingProps) => {
  const { screenToFlowPosition } = useReactFlow();
  const containerRef = useRef<HTMLDivElement>(null);
  
  const [drawingState, setDrawingState] = useState<DrawingState>({
    isDrawing: false,
    points: [],
    screenPoints: [],
    currentMousePos: null,
    lastClickTime: 0,
  });

  const handleClick = useCallback((event: MouseEvent) => {
    if (drawingMode !== DrawingMode.PEN || editMode !== EditMode.LAYER) return;
    
    // Prevent event from bubbling up to React Flow
    event.stopPropagation();
    event.preventDefault();
    
    const currentTime = Date.now();
    const wrapper = containerRef.current;
    if (!wrapper) return;
    
    const rect = wrapper.getBoundingClientRect();
    const screenX = event.clientX - rect.left;
    const screenY = event.clientY - rect.top;
    
    const position = screenToFlowPosition({ 
      x: event.clientX, 
      y: event.clientY
    });
    
    // Check for double-click (within 300ms)
    const isDoubleClick = currentTime - drawingState.lastClickTime < 300;
    
    if (isDoubleClick && drawingState.isDrawing) {
      // Complete and close the path if we have at least 3 points
      if (drawingState.points.length >= 3) {
        // Close the path by adding the first point at the end
        const closedPath = [...drawingState.points, drawingState.points[0]];
        onCreatePath(closedPath);
      } else if (drawingState.points.length >= 2) {
        // If only 2 points, create an open path
        onCreatePath(drawingState.points);
      }
      
      // Reset drawing state
      setDrawingState({
        isDrawing: false,
        points: [],
        screenPoints: [],
        currentMousePos: null,
        lastClickTime: 0,
      });
    } else {
      // Regular click - add point
      setDrawingState(prev => ({
        ...prev,
        isDrawing: true,
        points: [...prev.points, position],
        screenPoints: [...prev.screenPoints, { x: screenX, y: screenY }],
        lastClickTime: currentTime,
      }));
    }
  }, [drawingMode, editMode, screenToFlowPosition, drawingState.lastClickTime, drawingState.isDrawing, drawingState.points, onCreatePath]);

  const handleMouseMove = useCallback((event: MouseEvent) => {
    if (drawingMode !== DrawingMode.PEN || editMode !== EditMode.LAYER) return;
    
    const wrapper = containerRef.current;
    if (!wrapper) return;
    
    const rect = wrapper.getBoundingClientRect();
    const screenX = event.clientX - rect.left;
    const screenY = event.clientY - rect.top;
    
    setDrawingState(prev => ({
      ...prev,
      currentMousePos: { x: screenX, y: screenY },
    }));
  }, [drawingMode, editMode]);


  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (drawingMode !== DrawingMode.PEN || editMode !== EditMode.LAYER || !drawingState.isDrawing) return;
    
    // Escape key cancels current path
    if (event.key === 'Escape') {
      setDrawingState({
        isDrawing: false,
        points: [],
        screenPoints: [],
        currentMousePos: null,
        lastClickTime: 0,
      });
    }
    
    // Enter key completes and closes the path
    if (event.key === 'Enter' && drawingState.points.length >= 2) {
      if (drawingState.points.length >= 3) {
        // Close the path by adding the first point at the end
        const closedPath = [...drawingState.points, drawingState.points[0]];
        onCreatePath(closedPath);
      } else {
        // If only 2 points, create an open path
        onCreatePath(drawingState.points);
      }
      setDrawingState({
        isDrawing: false,
        points: [],
        screenPoints: [],
        currentMousePos: null,
        lastClickTime: 0,
      });
    }
  }, [drawingMode, editMode, drawingState.isDrawing, drawingState.points, onCreatePath]);

  // Reset drawing state when switching away from pen mode
  useEffect(() => {
    if (drawingMode !== DrawingMode.PEN) {
      setDrawingState(prev => ({
        ...prev,
        isDrawing: false,
        points: [],
        screenPoints: [],
        currentMousePos: null,
        lastClickTime: 0,
      }));
    }
  }, [drawingMode]);

  // Event listeners setup
  useEffect(() => {
    const wrapper = containerRef.current;
    if (!wrapper) return;

    wrapper.addEventListener('click', handleClick);
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      wrapper.removeEventListener('click', handleClick);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleClick, handleMouseMove, handleKeyDown]);

  // Calculate preview path including current mouse position
  const previewPath = drawingState.isDrawing && drawingState.screenPoints.length > 0
    ? drawingState.currentMousePos 
      ? [...drawingState.screenPoints, drawingState.currentMousePos]
      : drawingState.screenPoints
    : null;

  return {
    containerRef,
    isDrawing: drawingState.isDrawing,
    previewPath,
    currentPoints: drawingState.screenPoints,
  };
};