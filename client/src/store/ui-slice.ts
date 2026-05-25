import { createSlice } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';
import type { ContextMenuState } from '@/types';

type UiState = {
  sidebarCollapsed: boolean;
  deployDrawerOpen: boolean;
  contextMenu: ContextMenuState | null;
};

const initialState: UiState = {
  sidebarCollapsed: false,
  deployDrawerOpen: false,
  contextMenu: null,
};

export const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    setSidebarCollapsed: (state, action: PayloadAction<boolean>) => {
      state.sidebarCollapsed = action.payload;
    },
    toggleSidebarCollapsed: (state) => {
      state.sidebarCollapsed = !state.sidebarCollapsed;
    },
    setDeployDrawerOpen: (state, action: PayloadAction<boolean>) => {
      state.deployDrawerOpen = action.payload;
    },
    setContextMenu: (state, action: PayloadAction<ContextMenuState | null>) => {
      state.contextMenu = action.payload;
    },
  },
});

export const {
  setSidebarCollapsed,
  toggleSidebarCollapsed,
  setDeployDrawerOpen,
  setContextMenu,
} = uiSlice.actions;

export default uiSlice.reducer;
