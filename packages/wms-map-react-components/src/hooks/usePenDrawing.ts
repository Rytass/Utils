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
  isShiftPressed: boolean;
}

// Utility function to constrain point to straight lines (horizontal, vertical, 45-degree)
const constrainToStraightLine = (
  currentPoint: { x: number; y: number },
  previousPoint: { x: number; y: number },
): { x: number; y: number } => {
  const dx = currentPoint.x - previousPoint.x;
  const dy = currentPoint.y - previousPoint.y;

  // Calculate angle in degrees
  const angle = Math.atan2(dy, dx) * (180 / Math.PI);

  // Normalize angle to 0-360 range
  const normalizedAngle = ((angle % 360) + 360) % 360;

  // Snap to nearest cardinal/diagonal direction (every 45 degrees)
  const snapAngle = Math.round(normalizedAngle / 45) * 45;

  // Calculate distance from previous point
  const distance = Math.sqrt(dx * dx + dy * dy);

  // Convert back to radians and calculate constrained position
  const constrainedAngle = (snapAngle * Math.PI) / 180;

  return {
    x: previousPoint.x + Math.cos(constrainedAngle) * distance,
    y: previousPoint.y + Math.sin(constrainedAngle) * distance,
  };
};

export const usePenDrawing = ({
  editMode,
  drawingMode,
  onCreatePath,
}: UsePenDrawingProps) => {
  const { screenToFlowPosition } = useReactFlow();
  const containerRef = useRef<HTMLDivElement>(null);
  const previousModeRef = useRef(drawingMode);
  const previousEditModeRef = useRef(editMode);

  const [drawingState, setDrawingState] = useState<DrawingState>({
    isDrawing: false,
    points: [],
    screenPoints: [],
    currentMousePos: null,
    lastClickTime: 0,
    isShiftPressed: false,
  });

  const handleClick = useCallback(
    (event: MouseEvent) => {
      if (drawingMode !== DrawingMode.PEN || editMode !== EditMode.LAYER)
        return;

      // IMMEDIATELY stop event propagation to prevent React Flow pane click
      event.stopPropagation();
      event.preventDefault();
      event.stopImmediatePropagation();

      // Debug log for shift key behavior
      if (event.shiftKey) {
        console.log(
          '🖱️ Pen tool click with Shift key pressed - event stopped',
          {
            isDrawing: drawingState.isDrawing,
            pointsCount: drawingState.points.length,
            lastClickTime: drawingState.lastClickTime,
            currentTime: Date.now(),
          },
        );
      }

      const currentTime = Date.now();
      const wrapper = containerRef.current;

      if (!wrapper) return;

      const rect = wrapper.getBoundingClientRect();
      const screenX = event.clientX - rect.left;
      const screenY = event.clientY - rect.top;

      let position = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      let constrainedScreenPos = { x: screenX, y: screenY };

      // Apply straight line constraint if Shift is pressed and we have a previous point
      if (event.shiftKey && drawingState.points.length > 0) {
        const previousPoint =
          drawingState.points[drawingState.points.length - 1];

        position = constrainToStraightLine(position, previousPoint);

        // Also constrain the screen position for consistent preview
        if (drawingState.screenPoints.length > 0) {
          const previousScreenPoint =
            drawingState.screenPoints[drawingState.screenPoints.length - 1];

          constrainedScreenPos = constrainToStraightLine(
            { x: screenX, y: screenY },
            previousScreenPoint,
          );
        }
      }

      // Check for double-click (within 300ms)
      const isDoubleClick = currentTime - drawingState.lastClickTime < 300;

      // Check if clicking on the first point to close the path (only if we have at least 3 points)
      // IMPORTANT: Use original screen position, not constrained position, to avoid accidental closing when using Shift
      let isClickingFirstPoint = false;

      if (drawingState.isDrawing && drawingState.points.length >= 3) {
        const firstPoint = drawingState.screenPoints[0];
        const distance = Math.sqrt(
          Math.pow(screenX - firstPoint.x, 2) +
            Math.pow(screenY - firstPoint.y, 2),
        );

        // Consider it a click on the first point if within 10 pixels
        isClickingFirstPoint = distance <= 10;
      }

      if (isClickingFirstPoint) {
        console.log('🔵 Pen tool: Closing path by clicking first point', {
          shiftKey: event.shiftKey,
          pointsCount: drawingState.points.length,
        });

        // Close the path by adding the first point at the end
        const closedPath = [...drawingState.points, drawingState.points[0]];

        onCreatePath(closedPath);

        // Reset drawing state
        setDrawingState({
          isDrawing: false,
          points: [],
          screenPoints: [],
          currentMousePos: null,
          lastClickTime: 0,
          isShiftPressed: false,
        });
      } else if (isDoubleClick && drawingState.isDrawing) {
        console.log('🔵 Pen tool: Completing path by double-click', {
          shiftKey: event.shiftKey,
          pointsCount: drawingState.points.length,
          timeDiff: currentTime - drawingState.lastClickTime,
        });

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
          isShiftPressed: false,
        });
      } else {
        // Regular click - add point
        setDrawingState((prev) => ({
          ...prev,
          isDrawing: true,
          points: [...prev.points, position],
          screenPoints: [...prev.screenPoints, constrainedScreenPos],
          lastClickTime: currentTime,
          isShiftPressed: event.shiftKey,
        }));
      }
    },
    [
      drawingMode,
      editMode,
      screenToFlowPosition,
      drawingState.lastClickTime,
      drawingState.isDrawing,
      drawingState.points,
      onCreatePath,
    ],
  );

  const handleMouseMove = useCallback(
    (event: MouseEvent) => {
      if (drawingMode !== DrawingMode.PEN || editMode !== EditMode.LAYER)
        return;

      const wrapper = containerRef.current;

      if (!wrapper) return;

      const rect = wrapper.getBoundingClientRect();
      let screenX = event.clientX - rect.left;
      let screenY = event.clientY - rect.top;

      // Apply constraint to mouse position if Shift is pressed and we're drawing
      if (event.shiftKey && drawingState.screenPoints.length > 0) {
        const previousScreenPoint =
          drawingState.screenPoints[drawingState.screenPoints.length - 1];

        const constrainedPos = constrainToStraightLine(
          { x: screenX, y: screenY },
          previousScreenPoint,
        );

        screenX = constrainedPos.x;
        screenY = constrainedPos.y;
      }

      setDrawingState((prev) => ({
        ...prev,
        currentMousePos: { x: screenX, y: screenY },
        isShiftPressed: event.shiftKey,
      }));
    },
    [drawingMode, editMode, drawingState.screenPoints],
  );

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (
        drawingMode !== DrawingMode.PEN ||
        editMode !== EditMode.LAYER ||
        !drawingState.isDrawing
      )
        return;

      // Escape key cancels current path
      if (event.key === 'Escape') {
        setDrawingState({
          isDrawing: false,
          points: [],
          screenPoints: [],
          currentMousePos: null,
          lastClickTime: 0,
          isShiftPressed: false,
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
          isShiftPressed: false,
        });
      }
    },
    [
      drawingMode,
      editMode,
      drawingState.isDrawing,
      drawingState.points,
      onCreatePath,
    ],
  );

  // Force complete current path (for auto-close on pane click)
  const forceComplete = useCallback(() => {
    console.log('🔴 forceComplete called', {
      isDrawing: drawingState.isDrawing,
      pointsLength: drawingState.points.length,
      willClose: drawingState.points.length >= 3,
    });

    if (!drawingState.isDrawing || drawingState.points.length < 2) return;

    // Auto-close the path if we have 3+ points, otherwise create open path
    if (drawingState.points.length >= 3) {
      console.log('🔴 Force completing with closed path');
      const closedPath = [...drawingState.points, drawingState.points[0]];

      onCreatePath(closedPath);
    } else {
      console.log('🔴 Force completing with open path');
      onCreatePath(drawingState.points);
    }

    // Reset drawing state
    setDrawingState({
      isDrawing: false,
      points: [],
      screenPoints: [],
      currentMousePos: null,
      lastClickTime: 0,
      isShiftPressed: false,
    });
  }, [drawingState.isDrawing, drawingState.points, onCreatePath]);

  // Reset drawing state when switching away from pen mode or LAYER mode
  useEffect(() => {
    const modeChanged = previousModeRef.current !== drawingMode;
    const editModeChanged = previousEditModeRef.current !== editMode;

    if (modeChanged || editModeChanged) {
      setDrawingState((prev) => {
        // Should we force complete before resetting?
        const shouldForceComplete =
          // Switching away from PEN mode
          ((previousModeRef.current === DrawingMode.PEN &&
            drawingMode !== DrawingMode.PEN) ||
            // Switching away from LAYER mode
            (previousEditModeRef.current === EditMode.LAYER &&
              editMode !== EditMode.LAYER)) &&
          prev.isDrawing &&
          prev.points.length >= 2;

        if (shouldForceComplete) {
          // Force complete the current path before switching
          if (prev.points.length >= 3) {
            const closedPath = [...prev.points, prev.points[0]];

            onCreatePath(closedPath);
          } else {
            onCreatePath(prev.points);
          }
        }

        // Reset drawing state
        return {
          isDrawing: false,
          points: [],
          screenPoints: [],
          currentMousePos: null,
          lastClickTime: 0,
          isShiftPressed: false,
        };
      });

      // Update refs
      previousModeRef.current = drawingMode;
      previousEditModeRef.current = editMode;
    }
  }, [drawingMode, editMode, onCreatePath]);

  // Event listeners setup
  useEffect(() => {
    const wrapper = containerRef.current;

    if (!wrapper) return;

    // Use capture phase to intercept clicks before React Flow processes them
    wrapper.addEventListener('click', handleClick, true);
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      wrapper.removeEventListener('click', handleClick, true);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleClick, handleMouseMove, handleKeyDown]);

  // Calculate preview path including current mouse position
  const previewPath =
    drawingState.isDrawing && drawingState.screenPoints.length > 0
      ? drawingState.currentMousePos
        ? [...drawingState.screenPoints, drawingState.currentMousePos]
        : drawingState.screenPoints
      : null;

  return {
    containerRef,
    isDrawing: drawingState.isDrawing,
    previewPath,
    currentPoints: drawingState.screenPoints,
    // 提供起始點資訊，用於顯示閉合提示
    firstPoint:
      drawingState.screenPoints.length > 0
        ? drawingState.screenPoints[0]
        : null,
    canClose: drawingState.isDrawing && drawingState.screenPoints.length >= 3,
    forceComplete,
  };
};
