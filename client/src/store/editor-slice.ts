import { createSlice } from '@reduxjs/toolkit';

import type {
  DiagramNode,
  DiagramEdge,
  ClipboardSelection,
  PersistedDiagram,
} from '@/types';

import type { PayloadAction } from '@reduxjs/toolkit';

type EditorState = {
  projectId: string;
  projectName: string;
  projectDescription: string;
  awsAccountId: string | null;
  nodes: DiagramNode[];
  edges: DiagramEdge[];
  lastSavedAt: string | null;
  snapToGrid: boolean;
  isLocked: boolean;
  clipboard: ClipboardSelection | null;
};

const initialState: EditorState = {
  projectId: '',
  projectName: '',
  projectDescription: '',
  awsAccountId: null,
  nodes: [],
  edges: [],
  lastSavedAt: null,
  snapToGrid: false,
  isLocked: false,
  clipboard: null,
};

export const editorSlice = createSlice({
  name: 'editor',
  initialState,
  reducers: {
    setProject: (state, action: PayloadAction<PersistedDiagram>) => {
      state.projectId = action.payload.projectId;
      state.projectName = action.payload.projectName;
      state.projectDescription = action.payload.projectDescription;
      state.awsAccountId = action.payload.awsAccountId;
      state.nodes = action.payload.nodes;
      state.edges = action.payload.edges;
      state.lastSavedAt = action.payload.lastSavedAt;
    },
    setProjectName: (state, action: PayloadAction<string>) => {
      state.projectName = action.payload;
    },
    setProjectDescription: (state, action: PayloadAction<string>) => {
      state.projectDescription = action.payload;
    },
    setAwsAccountId: (state, action: PayloadAction<string | null>) => {
      state.awsAccountId = action.payload;
    },
    setNodes: (state, action: PayloadAction<DiagramNode[]>) => {
      state.nodes = action.payload;
    },
    setEdges: (state, action: PayloadAction<DiagramEdge[]>) => {
      state.edges = action.payload;
    },
    setLastSavedAt: (state, action: PayloadAction<string | null>) => {
      state.lastSavedAt = action.payload;
    },
    setSnapToGrid: (state, action: PayloadAction<boolean>) => {
      state.snapToGrid = action.payload;
    },
    setIsLocked: (state, action: PayloadAction<boolean>) => {
      state.isLocked = action.payload;
    },
    setClipboard: (state, action: PayloadAction<ClipboardSelection | null>) => {
      state.clipboard = action.payload;
    },
  },
});

export const {
  setProject,
  setProjectName,
  setProjectDescription,
  setAwsAccountId,
  setNodes,
  setEdges,
  setLastSavedAt,
  setSnapToGrid,
  setIsLocked,
  setClipboard,
} = editorSlice.actions;

export default editorSlice.reducer;
