import { useState, useCallback, useRef } from 'react';
import { Node, Edge } from '@xyflow/react';

interface HistoryState {
  nodes: Node[];
  edges: Edge[];
  operation: string;
  timestamp: number;
}

interface UseDirectStateHistoryOptions {
  maxHistorySize?: number;
  debugMode?: boolean;
}

/**
 * 直接狀態歷史系統
 *
 * 核心概念：
 * - 直接記錄 nodes 和 edges 的完整狀態
 * - 每個用戶操作後保存一份狀態快照
 * - undo/redo 就是直接設置 nodes 和 edges
 * - 簡單、直接、可靠
 */
export const useDirectStateHistory = ({
  maxHistorySize = 50,
  debugMode = false,
}: UseDirectStateHistoryOptions = {}) => {
  const [history, setHistory] = useState<HistoryState[]>([]);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const isRestoringRef = useRef(false);

  const canUndo = currentIndex > 0;
  const canRedo = currentIndex < history.length - 1;

  // 初始化歷史記錄
  const initializeHistory = useCallback(
    (initialNodes: Node[], initialEdges: Edge[]) => {
      const initialState: HistoryState = {
        nodes: JSON.parse(JSON.stringify(initialNodes)),
        edges: JSON.parse(JSON.stringify(initialEdges)),
        operation: 'init',
        timestamp: Date.now(),
      };

      setHistory([initialState]);
      setCurrentIndex(0);

      if (debugMode) {
        console.log('🎯 直接狀態歷史系統初始化:', {
          nodes: initialNodes.length,
          edges: initialEdges.length,
        });
      }
    },
    [debugMode],
  );

  // 保存狀態快照
  const saveState = useCallback(
    (nodes: Node[], edges: Edge[], operation: string) => {
      if (isRestoringRef.current) {
        if (debugMode) {
          console.log('🚫 跳過保存 - 正在執行 undo/redo');
        }

        return;
      }

      const newState: HistoryState = {
        nodes: JSON.parse(JSON.stringify(nodes)), // 深拷貝
        edges: JSON.parse(JSON.stringify(edges)), // 深拷貝
        operation,
        timestamp: Date.now(),
      };

      setHistory((prevHistory) => {
        let newHistory = [...prevHistory];

        // 如果當前不在最後位置，截斷後續歷史
        if (currentIndex < newHistory.length - 1) {
          newHistory = newHistory.slice(0, currentIndex + 1);
        }

        // 添加新狀態
        newHistory.push(newState);

        // 限制歷史大小
        if (newHistory.length > maxHistorySize) {
          const removeCount = newHistory.length - maxHistorySize;

          newHistory = newHistory.slice(removeCount);
          setCurrentIndex(newHistory.length - 1);
        } else {
          setCurrentIndex(newHistory.length - 1);
        }

        if (debugMode) {
          console.log(`📸 保存狀態 [${operation}]:`, {
            nodes: nodes.length,
            edges: edges.length,
            historyIndex: newHistory.length - 1,
            totalHistory: newHistory.length,
          });
        }

        return newHistory;
      });
    },
    [currentIndex, maxHistorySize, debugMode],
  );

  // Undo 操作
  const undo = useCallback(() => {
    if (!canUndo) {
      if (debugMode) {
        console.log('⚠️ 無法 undo - 已在歷史開始');
      }

      return null;
    }

    const targetIndex = currentIndex - 1;
    const targetState = history[targetIndex];

    if (!targetState) return null;

    isRestoringRef.current = true;
    setCurrentIndex(targetIndex);

    if (debugMode) {
      console.log(`↶ Undo 到 [${targetState.operation}]:`, {
        fromIndex: currentIndex,
        toIndex: targetIndex,
        nodes: targetState.nodes.length,
        edges: targetState.edges.length,
      });
    }

    // 下一個事件循環解除恢復標記
    setTimeout(() => {
      isRestoringRef.current = false;
    }, 0);

    return {
      nodes: targetState.nodes,
      edges: targetState.edges,
    };
  }, [canUndo, currentIndex, history, debugMode]);

  // Redo 操作
  const redo = useCallback(() => {
    if (!canRedo) {
      if (debugMode) {
        console.log('⚠️ 無法 redo - 已在歷史末端');
      }

      return null;
    }

    const targetIndex = currentIndex + 1;
    const targetState = history[targetIndex];

    if (!targetState) return null;

    isRestoringRef.current = true;
    setCurrentIndex(targetIndex);

    if (debugMode) {
      console.log(`↷ Redo 到 [${targetState.operation}]:`, {
        fromIndex: currentIndex,
        toIndex: targetIndex,
        nodes: targetState.nodes.length,
        edges: targetState.edges.length,
      });
    }

    // 下一個事件循環解除恢復標記
    setTimeout(() => {
      isRestoringRef.current = false;
    }, 0);

    return {
      nodes: targetState.nodes,
      edges: targetState.edges,
    };
  }, [canRedo, currentIndex, history, debugMode]);

  // 獲取歷史摘要
  const getHistorySummary = useCallback(() => {
    return {
      canUndo,
      canRedo,
      historyLength: history.length,
      currentIndex,
      currentOperation:
        currentIndex >= 0 ? history[currentIndex]?.operation : undefined,
      operations: debugMode
        ? history.map((h, index) => ({
            index,
            operation: h.operation,
            nodes: h.nodes.length,
            edges: h.edges.length,
            isCurrent: index === currentIndex,
          }))
        : undefined,
    };
  }, [canUndo, canRedo, history, currentIndex, debugMode]);

  // 清除歷史
  const clearHistory = useCallback(() => {
    setHistory([]);
    setCurrentIndex(-1);

    if (debugMode) {
      console.log('🗑️ 清除歷史記錄');
    }
  }, [debugMode]);

  return {
    // 核心功能
    saveState,
    undo,
    redo,

    // 狀態查詢
    canUndo,
    canRedo,

    // 工具函數
    initializeHistory,
    clearHistory,
    getHistorySummary,

    // 調試信息
    history: debugMode ? history : undefined,
    currentIndex: debugMode ? currentIndex : undefined,
  };
};
