/**
 * Telemetry infrastructure for tracking user interactions and debugging
 * Conforms to Apps SDK telemetry guidelines
 */

import React, { useCallback } from 'react';
import { useOpenAiGlobal } from '../hooks/useOpenAi.js';

export interface TelemetryEvent {
  event: string;
  properties?: Record<string, unknown>;
  toolCallId?: string;
  timestamp: string;
}

/**
 * Hook for tracking telemetry events
 * Automatically includes tool call ID from window.openai context
 */
export function useTelemetry() {
  const toolMetadata = useOpenAiGlobal('toolResponseMetadata');

  return useCallback(
    (event: string, properties?: Record<string, unknown>) => {
      const telemetryEvent: TelemetryEvent = {
        event,
        properties,
        toolCallId: (toolMetadata as { toolCallId?: string })?.toolCallId,
        timestamp: new Date().toISOString(),
      };

      // Log to console in development
      if (process.env.NODE_ENV === 'development') {
        console.log('[Telemetry]', telemetryEvent);
      }

      // TODO: Send to analytics service in production
      // Example: analytics.track(event, properties);
    },
    [toolMetadata]
  );
}

/**
 * Track component mount
 */
export function useComponentMount(componentName: string) {
  const track = useTelemetry();

  // Track on mount
  React.useEffect(() => {
    track('component_mounted', { component: componentName });
  }, [componentName, track]);
}

/**
 * Track errors
 */
export function trackError(error: Error, context?: Record<string, unknown>) {
  const telemetryEvent: TelemetryEvent = {
    event: 'error',
    properties: {
      message: error.message,
      stack: error.stack,
      ...context,
    },
    timestamp: new Date().toISOString(),
  };

  console.error('[Telemetry Error]', telemetryEvent);
  // TODO: Send to error tracking service
}
