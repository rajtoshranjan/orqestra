import { createSlice } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';
import type { DeploymentSettings } from '@/types';

type DeploymentState = {
  settings: DeploymentSettings;
  activeDeploymentId: string | null;
};

const initialState: DeploymentState = {
  settings: {
    region: 'us-east-1',
    executionRoleArn: '',
  },
  activeDeploymentId: null,
};

export const deploymentSlice = createSlice({
  name: 'deployment',
  initialState,
  reducers: {
    setDeploymentSettings: (
      state,
      action: PayloadAction<DeploymentSettings>,
    ) => {
      state.settings = action.payload;
    },
    patchDeploymentSettings: (
      state,
      action: PayloadAction<Partial<DeploymentSettings>>,
    ) => {
      state.settings = { ...state.settings, ...action.payload };
    },
    setActiveDeploymentId: (state, action: PayloadAction<string | null>) => {
      state.activeDeploymentId = action.payload;
    },
  },
});

export const {
  setDeploymentSettings,
  patchDeploymentSettings,
  setActiveDeploymentId,
} = deploymentSlice.actions;

export default deploymentSlice.reducer;
