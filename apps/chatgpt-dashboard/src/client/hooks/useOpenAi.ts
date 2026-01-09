import { useCallback, useEffect, useState, useSyncExternalStore } from "react";

interface WindowWithOpenAi extends Window {
  openai?: {
    theme?: "light" | "dark";
    displayMode?: "inline" | "fullscreen" | "pip";
    locale?: string;
    maxHeight?: number;
    userAgent?: {
      device: { type: "mobile" | "tablet" | "desktop" | "unknown" };
      capabilities: { hover: boolean; touch: boolean };
    };
    safeArea?: {
      insets: { top: number; bottom: number; left: number; right: number };
    };
    toolInput?: unknown;
    toolOutput?: unknown;
    toolResponseMetadata?: unknown;
    widgetState?: unknown;
    setWidgetState?: (state: unknown) => void;
    callTool?: (
      name: string,
      args: Record<string, unknown>,
    ) => Promise<unknown>;
    sendFollowUpMessage?: (params: { prompt: string }) => Promise<void>;
    requestDisplayMode?: (params: {
      mode: "inline" | "fullscreen" | "pip";
    }) => Promise<{ mode: "inline" | "fullscreen" | "pip" }>;
    requestClose?: () => void;
  };
}

declare const window: WindowWithOpenAi;

/**
 * OpenAI ChatGPT iframe runtime globals
 */
export type OpenAiGlobals = {
  theme: "light" | "dark";
  displayMode: "inline" | "fullscreen" | "pip";
  locale: string;
  maxHeight: number;
  userAgent: {
    device: { type: "mobile" | "tablet" | "desktop" | "unknown" };
    capabilities: { hover: boolean; touch: boolean };
  };
  safeArea: {
    insets: { top: number; bottom: number; left: number; right: number };
  };
  toolInput: unknown;
  toolOutput: unknown;
  toolResponseMetadata: unknown;
  widgetState: unknown;
};

const SET_GLOBALS_EVENT = "openai:set_globals";

/**
 * Subscribe to a single global value from window.openai
 */
export function useOpenAiGlobal<K extends keyof OpenAiGlobals>(
  key: K,
): OpenAiGlobals[K] | undefined {
  return useSyncExternalStore(
    (onChange) => {
      const handler = (event: Event) => {
        const customEvent = event as CustomEvent<{
          globals: Partial<OpenAiGlobals>;
        }>;
        if (customEvent.detail?.globals[key] !== undefined) {
          onChange();
        }
      };
      window.addEventListener(SET_GLOBALS_EVENT, handler);
      return () => window.removeEventListener(SET_GLOBALS_EVENT, handler);
    },
    () => window.openai?.[key] as OpenAiGlobals[K] | undefined,
  );
}

/**
 * Get current theme (light/dark)
 */
export function useTheme(): "light" | "dark" {
  return useOpenAiGlobal("theme") ?? "dark";
}

/**
 * Get current display mode (inline/fullscreen/pip)
 */
export function useDisplayMode(): "inline" | "fullscreen" | "pip" {
  return useOpenAiGlobal("displayMode") ?? "inline";
}

/**
 * Get tool output data
 */
export function useToolOutput<T = unknown>(): T | null {
  return (useOpenAiGlobal("toolOutput") as T) ?? null;
}

/**
 * Sync React state with ChatGPT widget state
 */
export function useWidgetState<T>(
  defaultState: T,
): readonly [T, (state: T | ((prev: T) => T)) => void] {
  const stateFromWindow = useOpenAiGlobal("widgetState") as T | null;
  const [state, setState] = useState<T>(stateFromWindow ?? defaultState);

  useEffect(() => {
    if (stateFromWindow !== null) {
      setState(stateFromWindow);
    }
  }, [stateFromWindow]);

  const updateState = useCallback((newState: T | ((prev: T) => T)) => {
    setState((prev) => {
      const next =
        typeof newState === "function"
          ? (newState as (prev: T) => T)(prev)
          : newState;
      if (window.openai?.setWidgetState) {
        window.openai.setWidgetState(next);
      }
      return next;
    });
  }, []);

  return [state, updateState] as const;
}

/**
 * Call an MCP tool
 */
export async function callTool(
  name: string,
  args: Record<string, unknown>,
): Promise<unknown> {
  if (!window.openai?.callTool) {
    throw new Error("Not running in ChatGPT iframe");
  }
  return window.openai.callTool(name, args);
}

/**
 * Send a follow-up message to ChatGPT
 */
export async function sendFollowUp(prompt: string): Promise<void> {
  if (!window.openai?.sendFollowUpMessage) {
    throw new Error("Not running in ChatGPT iframe");
  }
  return window.openai.sendFollowUpMessage({ prompt });
}

/**
 * Request display mode change
 */
export async function requestDisplayMode(
  mode: "inline" | "fullscreen" | "pip",
): Promise<{ mode: "inline" | "fullscreen" | "pip" }> {
  if (!window.openai?.requestDisplayMode) {
    throw new Error("Not running in ChatGPT iframe");
  }
  return window.openai.requestDisplayMode({ mode });
}

/**
 * Close the widget
 */
export function requestClose(): void {
  if (window.openai?.requestClose) {
    window.openai.requestClose();
  }
}
