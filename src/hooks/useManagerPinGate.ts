"use client";

import { useCallback, useState } from "react";

export function useManagerPinGate() {
  const [pinOpen, setPinOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);

  const requestPin = useCallback((action: () => void) => {
    setPendingAction(() => action);
    setPinOpen(true);
  }, []);

  const closePin = useCallback(() => {
    setPinOpen(false);
    setPendingAction(null);
  }, []);

  const onPinSuccess = useCallback(() => {
    setPinOpen(false);
    const action = pendingAction;
    setPendingAction(null);
    action?.();
  }, [pendingAction]);

  return { pinOpen, requestPin, closePin, onPinSuccess };
}
