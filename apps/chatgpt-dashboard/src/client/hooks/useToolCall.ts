/**
 * Hook for calling MCP tools with loading/error states
 * Conforms to Apps SDK tool calling guidelines
 */

import { useCallback, useEffect, useState } from 'react';
import { callTool } from './useOpenAi.js';
import { trackError } from '../lib/telemetry.js';

interface UseToolCallResult<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
  retry: () => void;
  refetch: () => Promise<void>;
}

export function useToolCall<T = unknown>(
  toolName: string,
  args?: Record<string, unknown>,
  options?: {
    enabled?: boolean;
    onSuccess?: (data: T) => void;
    onError?: (error: Error) => void;
  }
): UseToolCallResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  const enabled = options?.enabled ?? true;

  const fetchData = useCallback(async () => {
    if (!enabled) return;

    setLoading(true);
    setError(null);

    try {
      const result = await callTool(toolName, args || {});
      setData(result as T);
      options?.onSuccess?.(result as T);
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setError(error);
      options?.onError?.(error);
      trackError(error, { toolName, args });
    } finally {
      setLoading(false);
    }
  }, [toolName, JSON.stringify(args), enabled, retryCount]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const retry = useCallback(() => {
    setRetryCount(prev => prev + 1);
  }, []);

  return {
    data,
    loading,
    error,
    retry,
    refetch: fetchData,
  };
}
