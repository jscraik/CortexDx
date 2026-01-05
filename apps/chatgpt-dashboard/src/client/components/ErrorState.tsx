/**
 * Error state component with retry capability
 * Conforms to Apps SDK error handling guidelines
 */

import { Button } from "@openai/apps-sdk-ui/components/Button";
import { AlertTriangle } from "lucide-react";
import { type ReactNode } from "react";

interface ErrorStateProps {
  title?: string;
  message: string;
  onRetry?: () => void;
  action?: ReactNode;
}

export function ErrorState({
  title = "Something went wrong",
  message,
  onRetry,
  action,
}: ErrorStateProps) {
  return (
    <div
      className="flex flex-col items-center justify-center py-12 px-4 text-center"
      role="alert"
      aria-live="assertive"
    >
      <div className="mb-4 text-red-500">
        <AlertTriangle size={48} />
      </div>
      <h3 className="text-lg font-semibold text-cortex-text mb-2">{title}</h3>
      <p className="text-sm text-cortex-muted mb-4 max-w-md">{message}</p>
      <div className="flex gap-2">
        {onRetry && (
          <Button onClick={onRetry} variant="outline" color="secondary">
            Retry
          </Button>
        )}
        {action}
      </div>
    </div>
  );
}
