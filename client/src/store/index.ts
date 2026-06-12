import { configureStore } from '@reduxjs/toolkit';
import { useDispatch, useSelector } from 'react-redux';

import deploymentReducer from './deployment-slice';
import editorReducer from './editor-slice';
import uiReducer from './ui-slice';

import type { TypedUseSelectorHook } from 'react-redux';

export const store = configureStore({
  reducer: {
    editor: editorReducer,
    deployment: deploymentReducer,
    ui: uiReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

// Strongly-typed dispatch and selector hooks for TS safety.
export const useAppDispatch: () => AppDispatch = useDispatch;
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;
