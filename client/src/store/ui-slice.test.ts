import { describe, it, expect } from 'vitest';

import reducer, { setAgentPanelOpen } from './ui-slice';

describe('ui-slice agent panel', () => {
  it('defaults agentPanelOpen to false', () => {
    const state = reducer(undefined, { type: '@@INIT' });
    expect(state.agentPanelOpen).toBe(false);
  });

  it('sets agentPanelOpen', () => {
    const state = reducer(undefined, setAgentPanelOpen(true));
    expect(state.agentPanelOpen).toBe(true);
  });
});
