"use client";

import { useEffect, useRef, useState } from "react";
import { Lock, X } from "lucide-react";
import { DEFAULT_MANAGER_PIN, verifyManagerPin } from "@/lib/managerPin";
import { ModalCancelButton } from "@/components/Modal";

const MAX_ATTEMPTS = 3;
const LOCK_MS = 30_000;

type PinConfirmModalProps = {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
};

export function PinConfirmModal({ open, onClose, onSuccess }: PinConfirmModalProps) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [shake, setShake] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [lockedUntil, setLockedUntil] = useState<number | null>(null);
  const [lockSeconds, setLockSeconds] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const isLocked = lockedUntil != null && Date.now() < lockedUntil;

  useEffect(() => {
    if (!open) return;
    setPin("");
    setError("");
    setShake(false);
    setTimeout(() => inputRef.current?.focus(), 100);
  }, [open]);

  useEffect(() => {
    if (!lockedUntil) {
      setLockSeconds(0);
      return;
    }
    const tick = () => {
      const remaining = Math.ceil((lockedUntil - Date.now()) / 1000);
      if (remaining <= 0) {
        setLockedUntil(null);
        setAttempts(0);
        setError("");
        setLockSeconds(0);
      } else {
        setLockSeconds(remaining);
        setError(`Too many attempts. Wait ${remaining} seconds.`);
      }
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [lockedUntil]);

  function resetAndClose() {
    setPin("");
    setError("");
    onClose();
  }

  function handlePinChange(value: string) {
    if (isLocked) return;
    const digits = value.replace(/\D/g, "").slice(0, 4);
    setPin(digits);
    setError("");
  }

  function handleConfirm() {
    if (isLocked) return;
    if (pin.length !== 4) {
      setError("Enter a 4-digit PIN");
      setShake(true);
      setTimeout(() => setShake(false), 500);
      return;
    }
    if (verifyManagerPin(pin)) {
      setPin("");
      setError("");
      setAttempts(0);
      onSuccess();
      return;
    }
    const nextAttempts = attempts + 1;
    setAttempts(nextAttempts);
    setShake(true);
    setPin("");
    if (nextAttempts >= MAX_ATTEMPTS) {
      setLockedUntil(Date.now() + LOCK_MS);
      setAttempts(0);
      setError(`Too many attempts. Wait ${LOCK_MS / 1000} seconds.`);
    } else {
      setError("Incorrect PIN. Try again.");
    }
    setTimeout(() => setShake(false), 500);
    inputRef.current?.focus();
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    handleConfirm();
  }

  if (!open) return null;

  return (
    <div className="modal-overlay" onClick={resetAndClose} role="presentation">
      <div
        className="modal-box modal-box--narrow pin-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <form className="modal-form" onSubmit={handleSubmit}>
          <div className="modal-header pin-modal-header">
            <div>
              <div className="pin-modal-icon">
                <Lock className="h-5 w-5 text-[#2563eb]" />
              </div>
              <h2 className="modal-title">Manager Authorization Required</h2>
              <p className="pin-modal-subtitle">Enter manager PIN to continue</p>
            </div>
            <button type="button" onClick={resetAndClose} className="modal-close self-start" aria-label="Close">
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="modal-body pin-modal-body">
            <div
              className={`pin-boxes ${shake ? "pin-shake" : ""}`}
              onClick={() => !isLocked && inputRef.current?.focus()}
              role="presentation"
            >
              {[0, 1, 2, 3].map((i) => (
                <div
                  key={i}
                  className={`pin-box ${pin.length === i ? "pin-box--active" : ""} ${pin[i] ? "pin-box--filled" : ""}`}
                >
                  {pin[i] ? "●" : ""}
                </div>
              ))}
            </div>
            <input
              ref={inputRef}
              type="password"
              inputMode="numeric"
              pattern="[0-9]*"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              readOnly={false}
              maxLength={4}
              value={pin}
              onChange={(e) => handlePinChange(e.target.value)}
              className="pin-hidden-input"
              disabled={isLocked}
              aria-hidden="true"
              tabIndex={-1}
              style={{
                position: "absolute",
                opacity: 0,
                width: "1px",
                height: "1px",
                border: "none",
                outline: "none",
                background: "transparent",
                color: "transparent",
                pointerEvents: "none",
                overflow: "hidden",
                top: "-9999px",
                left: "-9999px",
              }}
            />
            {error && (
              <p className={`pin-error ${isLocked ? "pin-error--locked" : ""}`}>{error}</p>
            )}
            <p className="pin-hint">Default PIN: {DEFAULT_MANAGER_PIN} (change in Settings)</p>
          </div>

          <div className="modal-footer">
            <ModalCancelButton onClick={resetAndClose} />
            <button
              type="submit"
              disabled={isLocked || pin.length !== 4}
              className="btn-primary px-4 py-2 text-sm disabled:opacity-50"
            >
              {isLocked ? `Locked (${lockSeconds}s)` : "Confirm"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
