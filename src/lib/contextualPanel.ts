import type { ContextualPanelId } from './settings';

export const PINNED_PANEL_MIN_WIDTH = 1100;

export type PanelState = { active: ContextualPanelId | null; pinned: boolean };
export type PanelAction =
  | { type: 'open'; panel: ContextualPanelId; wide: boolean; preferPinned?: boolean }
  | { type: 'pin'; wide: boolean }
  | { type: 'unpin' }
  | { type: 'close' }
  | { type: 'viewport'; wide: boolean };

/** One state machine owns every contextual surface, so pinned panels can never stack. */
export function panelReducer(state: PanelState, action: PanelAction): PanelState {
  switch (action.type) {
    case 'open': return { active: action.panel, pinned: action.wide && Boolean(action.preferPinned ?? state.pinned) };
    case 'pin': return { ...state, pinned: Boolean(state.active && action.wide) };
    case 'unpin': return { ...state, pinned: false };
    case 'close': return { active: null, pinned: false };
    case 'viewport': return action.wide ? state : { ...state, pinned: false };
  }
}

export function restorePanel(panelPinned: boolean, lastPinnedPanel: ContextualPanelId | null, wide: boolean): PanelState {
  return wide && panelPinned && lastPinnedPanel ? { active: lastPinnedPanel, pinned: true } : { active: null, pinned: false };
}
