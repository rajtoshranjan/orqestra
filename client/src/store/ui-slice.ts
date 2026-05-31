import { createSlice } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';
import type { ContextMenuState } from '@/types';

type UiState = {
  deployDrawerOpen: boolean;
  contextMenu: ContextMenuState | null;
  theme: 'dark' | 'light';
};

const getInitialTheme = (): 'dark' | 'light' => {
  if (typeof window !== 'undefined') {
    return (localStorage.getItem('theme') as 'dark' | 'light') || 'dark';
  }
  return 'dark';
};

const initialState: UiState = {
  deployDrawerOpen: false,
  contextMenu: null,
  theme: getInitialTheme(),
};

export const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    setDeployDrawerOpen: (state, action: PayloadAction<boolean>) => {
      state.deployDrawerOpen = action.payload;
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
  },
});

export const { setDeployDrawerOpen, setContextMenu, setTheme, toggleTheme } =
  uiSlice.actions;

export default uiSlice.reducer;
