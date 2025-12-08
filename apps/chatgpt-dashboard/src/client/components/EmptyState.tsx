/**
 * Empty state component
 * Conforms to Apps SDK empty state guidelines
 */

import { type ReactNode } from 'react';

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
      {icon && (
        <div className="mb-4 text-cortex-muted opacity-50">
          {icon}
        </div>
      )}
      <h3 className="text-lg font-semibold text-cortex-text mb-2">
        {title}
      </h3>
      {description && (
        <p className="text-sm text-cortex-muted mb-4 max-w-md">
          {description}
        </p>
      )}
      {action && (
        <div className="mt-4">
          {action}
        </div>
      )}
    </div>
  );
}
