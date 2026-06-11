import { createSlice } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';
import type { AnnotationFilters, ContextMenuState } from '@/types';

type UiState = {
  deployDrawerOpen: boolean;
  projectSettingsOpen: boolean;
  contextMenu: ContextMenuState | null;
  theme: 'dark' | 'light';
  commentMode: boolean;
  reviewMode: boolean;
  activeAnnotationId: string | null;
  annotationFilters: AnnotationFilters;
};

const getInitialTheme = (): 'dark' | 'light' => {
  if (typeof window !== 'undefined') {
    return (localStorage.getItem('theme') as 'dark' | 'light') || 'dark';
  }
  return 'dark';
};

const initialState: UiState = {
  deployDrawerOpen: false,
  projectSettingsOpen: false,
  contextMenu: null,
  theme: getInitialTheme(),
  commentMode: false,
  reviewMode: false,
  activeAnnotationId: null,
  annotationFilters: { status: 'open', onlyMine: false, onlyMentions: false },
};

export const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    setDeployDrawerOpen: (state, action: PayloadAction<boolean>) => {
      state.deployDrawerOpen = action.payload;
    },
    setProjectSettingsOpen: (state, action: PayloadAction<boolean>) => {
      state.projectSettingsOpen = action.payload;
    },
    setContextMenu: (state, action: PayloadAction<ContextMenuState | null>) => {
      state.contextMenu = action.payload;
    },
    setTheme: (state, action: PayloadAction<'dark' | 'light'>) => {
      state.theme = action.payload;
      if (typeof window !== 'undefined') {
        localStorage.setItem('theme', action.payload);
      }
    },
    toggleTheme: (state) => {
      const nextTheme = state.theme === 'dark' ? 'light' : 'dark';
      state.theme = nextTheme;
      if (typeof window !== 'undefined') {
        localStorage.setItem('theme', nextTheme);
      }
    },
    setCommentMode: (state, action: PayloadAction<boolean>) => {
      state.commentMode = action.payload;
      if (!action.payload) {
        state.reviewMode = false;
      }
    },
    toggleReviewMode: (state) => {
      state.reviewMode = !state.reviewMode;
      if (state.reviewMode) {
        state.commentMode = true;
        state.annotationFilters.status = 'all';
      } else if (state.annotationFilters.status === 'all') {
        state.annotationFilters.status = 'open';
      }
    },
    setActiveAnnotationId: (state, action: PayloadAction<string | null>) => {
      state.activeAnnotationId = action.payload;
    },
    setAnnotationFilters: (
      state,
      action: PayloadAction<Partial<AnnotationFilters>>,
    ) => {
      state.annotationFilters = {
        ...state.annotationFilters,
        ...action.payload,
      };
    },
  },
});

export const {
  setDeployDrawerOpen,
  setProjectSettingsOpen,
  setContextMenu,
  setTheme,
  toggleTheme,
  setCommentMode,
  toggleReviewMode,
  setActiveAnnotationId,
  setAnnotationFilters,
} = uiSlice.actions;

export default uiSlice.reducer;
