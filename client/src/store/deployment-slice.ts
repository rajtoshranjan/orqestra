import { createSlice } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';
import type {
  DeploymentSettings,
  DeploymentResult,
  DeploymentLogEntry,
} from '@/types';
import { DeploymentStatus } from '@/types';

type DeploymentState = {
  settings: DeploymentSettings;
  result: DeploymentResult;
  activeDeploymentId: string | null;
};

const initialState: DeploymentState = {
  settings: {
    region: 'us-east-1',
    executionRoleArn: '',
  },
  result: {
    status: DeploymentStatus.Idle,
    logs: [],
    lastRunAt: null,
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
    setDeploymentResult: (state, action: PayloadAction<DeploymentResult>) => {
      state.result = action.payload;
    },
    setDeploymentStatus: (state, action: PayloadAction<DeploymentStatus>) => {
      state.result.status = action.payload;
    },
    setDeploymentLogs: (state, action: PayloadAction<DeploymentLogEntry[]>) => {
      state.result.logs = action.payload;
    },
    addDeploymentLog: (state, action: PayloadAction<DeploymentLogEntry>) => {
      state.result.logs.push(action.payload);
    },
    setActiveDeploymentId: (state, action: PayloadAction<string | null>) => {
      state.activeDeploymentId = action.payload;
    },
  },
});

export const {
  setDeploymentSettings,
  patchDeploymentSettings,
  setDeploymentResult,
  setDeploymentStatus,
  setDeploymentLogs,
  addDeploymentLog,
  setActiveDeploymentId,
} = deploymentSlice.actions;

export default deploymentSlice.reducer;
