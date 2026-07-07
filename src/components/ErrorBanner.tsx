"use client";

import { getFriendlyErrorMessage, isConnectionError } from "@/lib/utils";

type ErrorBannerProps = {
  error: string;
  onRetry?: () => void;
  className?: string;
};

export function ErrorBanner({ error, onRetry, className = "mb-4" }: ErrorBannerProps) {
  const message = getFriendlyErrorMessage(error);
  const showRetry = onRetry && isConnectionError(error);

  return (
    <div
      className={`rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600 ${className}`}
    >
      <p>{message}</p>
      {showRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-2 font-medium text-red-700 underline hover:text-red-800"
        >
          Retry connection
        </button>
      )}
    </div>
  );
}
