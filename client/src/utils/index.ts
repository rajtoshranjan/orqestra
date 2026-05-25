import { EnvVariables } from '@/config';

/* Constants */
export const STORAGE_KEY = 'orqestra.projects.v1';
export const NODE_DRAG_TYPE = 'application/orqestra.node';
export const GRID: [number, number] = [24, 24];
export const API_BASE_URL = EnvVariables.apiUrl;

export * from './date';
export * from './diagram';
export * from './cloud';
