import React from 'react';

import { Lock, Unlock, Grid } from 'lucide-react';

import { useKeyboardShortcuts } from '@/hooks';
import { toast } from '@/hooks/use-toast';
import { useAppDispatch } from '@/store';
import { setIsLocked, setSnapToGrid } from '@/store/editor-slice';
import type { ServiceNodeData, DiagramNode } from '@/types';

import type { CanvasShortcut } from './canvas-utils';
import type { ReactFlowInstance } from 'reactflow';

type QuickAddState = {
  x: number;
  y: number;
  flowPosition: { x: number; y: number };
};

type UseCanvasShortcutsOptions = {
  isLocked: boolean;
  snapToGrid: boolean;
  reactFlowInstance: ReactFlowInstance<ServiceNodeData> | null;
  mouseRef: React.RefObject<{ clientX: number; clientY: number }>;
  nodesRef: React.RefObject<DiagramNode[]>;
  setNodes: React.Dispatch<React.SetStateAction<DiagramNode[]>>;
  setQuickAdd: React.Dispatch<React.SetStateAction<QuickAddState | null>>;
  setHelpOpen: React.Dispatch<React.SetStateAction<boolean>>;
  handleTriggerAutoLayout: () => void;
  handlePlan: () => void;
  saveCurrentDiagram: () => void;
  handleCopySelection: () => void;
  handlePasteSelection: () => void;
  deleteSelection: () => void;
  toggleCommentMode: () => void;
};

export function useCanvasShortcuts({
  isLocked,
  snapToGrid,
  reactFlowInstance,
  mouseRef,
  nodesRef,
  setNodes,
  setQuickAdd,
  setHelpOpen,
  handleTriggerAutoLayout,
  handlePlan,
  saveCurrentDiagram,
  handleCopySelection,
  handlePasteSelection,
  deleteSelection,
  toggleCommentMode,
}: UseCanvasShortcutsOptions): CanvasShortcut[] {
  const dispatch = useAppDispatch();

  const shortcuts = React.useMemo<CanvasShortcut[]>(
    () => [
      {
        key: '/',
        description: 'Open Quick Add catalog menu at cursor',
        category: 'canvas',
        handler: () => {
          const clientX = mouseRef.current?.clientX ?? 0;
          const clientY = mouseRef.current?.clientY ?? 0;
          const flowPosition = reactFlowInstance?.screenToFlowPosition({
            x: clientX,
            y: clientY,
          }) || { x: 0, y: 0 };
          setQuickAdd({ x: clientX, y: clientY, flowPosition });
        },
        disabled: isLocked,
      },
      {
        key: 'l',
        alt: true,
        description: 'Auto layout resources into clean columns and containers',
        category: 'canvas',
        handler: handleTriggerAutoLayout,
      },
      {
        key: 'l',
        alt: true,
        shift: true,
        description: 'Toggle canvas edit lock (Lock/Unlock drawing & moving)',
        category: 'canvas',
        handler: () => {
          dispatch(setIsLocked(!isLocked));
          toast({
            title: !isLocked ? 'Editor locked' : 'Editor unlocked',
            description: !isLocked
              ? 'Resource configurations and positions are frozen.'
              : 'You can now configure and move resources.',
            icon: !isLocked ? (
              <Lock className="size-4 text-primary" />
            ) : (
              <Unlock className="size-4 text-success" />
            ),
          });
        },
      },
      {
        key: 'g',
        alt: true,
        description: 'Toggle snapping elements to the canvas layout grid',
        category: 'canvas',
        handler: () => {
          dispatch(setSnapToGrid(!snapToGrid));
          toast({
            title: 'Grid snapping',
            description: !snapToGrid
              ? 'Elements will now align to the grid.'
              : 'Free dragging enabled.',
            icon: <Grid className="size-4 text-primary" />,
          });
        },
      },
      {
        key: 'd',
        alt: true,
        description: 'Open the Plan & Deploy workspace panel',
        category: 'general',
        handler: handlePlan,
      },
      {
        key: 's',
        meta: true,
        description: 'Manually save current architecture state to the cloud',
        category: 'general',
        handler: saveCurrentDiagram,
      },
      {
        key: 'a',
        meta: true,
        description: 'Select all resource nodes on the canvas',
        category: 'edit',
        handler: () => {
          setNodes((prevNodes) =>
            prevNodes.map((node) => ({ ...node, selected: true })),
          );
        },
        disabled: isLocked,
      },
      {
        key: 'c',
        meta: true,
        description: 'Copy selected resources to the clipboard',
        category: 'edit',
        handler: handleCopySelection,
      },
      {
        key: 'v',
        meta: true,
        description: 'Paste copied resources onto the canvas',
        category: 'edit',
        handler: handlePasteSelection,
        disabled: isLocked,
      },
      {
        key: 'c',
        description: 'Toggle comment mode (click anywhere to comment)',
        category: 'canvas',
        handler: toggleCommentMode,
      },
      {
        key: '1',
        description: 'Zoom to fit entire architecture in the view',
        category: 'view',
        handler: () => {
          reactFlowInstance?.fitView({ duration: 400 });
        },
      },
      {
        key: '2',
        description: 'Zoom to fit currently selected resources',
        category: 'view',
        handler: () => {
          const selected = (nodesRef.current ?? []).filter(
            (node) => node.selected,
          );
          if (selected.length > 0) {
            reactFlowInstance?.fitView({ nodes: selected, duration: 400 });
          } else {
            toast({
              title: 'No selection',
              description: 'Select at least one node to zoom to selection.',
            });
          }
        },
      },
      {
        key: 'Delete',
        description: 'Delete selected resources and connections',
        category: 'edit',
        handler: deleteSelection,
        disabled: isLocked,
      },
      {
        key: 'Backspace',
        description: 'Delete selected resources and connections',
        category: 'edit',
        handler: deleteSelection,
        disabled: isLocked,
      },
      {
        key: 'Escape',
        description: 'Cancel active action, clear selection or close menus',
        category: 'general',
        handler: () => {
          setQuickAdd(null);
          setNodes((prevNodes) =>
            prevNodes.map((node) => ({ ...node, selected: false })),
          );
        },
      },
      {
        key: '?',
        description: 'Open the Keyboard Shortcuts helper panel',
        category: 'general',
        handler: () => {
          setHelpOpen(true);
        },
      },
    ],
    [
      isLocked,
      snapToGrid,
      reactFlowInstance,
      handleTriggerAutoLayout,
      handlePlan,
      saveCurrentDiagram,
      handleCopySelection,
      handlePasteSelection,
      deleteSelection,
      toggleCommentMode,
      dispatch,
      setNodes,
      setQuickAdd,
      setHelpOpen,
      mouseRef,
      nodesRef,
    ],
  );

  useKeyboardShortcuts(shortcuts, [shortcuts]);

  return shortcuts;
}
