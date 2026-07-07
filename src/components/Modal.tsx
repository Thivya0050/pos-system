"use client";

import { X } from "lucide-react";

type ModalSize = "default" | "wide" | "narrow";

function sizeClass(size: ModalSize) {
  if (size === "wide") return "modal-box--wide";
  if (size === "narrow") return "modal-box--narrow";
  return "";
}

type ModalShellProps = {
  title: string;
  onClose: () => void;
  size?: ModalSize;
  children: React.ReactNode;
  footer?: React.ReactNode;
};

function ModalShell({ title, onClose, size = "default", children, footer }: ModalShellProps) {
  return (
    <div className="modal-overlay" onClick={onClose} role="presentation">
      <div
        className={`modal-box ${sizeClass(size)}`}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        <div className="modal-header">
          <h2 id="modal-title" className="modal-title">
            {title}
          </h2>
          <button type="button" onClick={onClose} className="modal-close" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>
        {children}
        {footer ? <div className="modal-footer">{footer}</div> : null}
      </div>
    </div>
  );
}

type ModalProps = ModalShellProps & {
  open: boolean;
  bodyClassName?: string;
};

export function Modal({ open, title, onClose, size, children, footer, bodyClassName }: ModalProps) {
  if (!open) return null;
  return (
    <ModalShell title={title} onClose={onClose} size={size} footer={footer}>
      <div className={`modal-body${bodyClassName ? ` ${bodyClassName}` : ""}`}>{children}</div>
    </ModalShell>
  );
}

type ModalFormProps = ModalProps & {
  onSubmit: (e: React.FormEvent) => void;
};

export function ModalForm({
  open,
  title,
  onClose,
  size,
  onSubmit,
  children,
  footer,
}: ModalFormProps) {
  if (!open) return null;
  return (
    <div className="modal-overlay" onClick={onClose} role="presentation">
      <div
        className={`modal-box ${sizeClass(size ?? "default")}`}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        <form className="modal-form" onSubmit={onSubmit}>
          <div className="modal-header">
            <h2 id="modal-title" className="modal-title">
              {title}
            </h2>
            <button type="button" onClick={onClose} className="modal-close" aria-label="Close">
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="modal-body">{children}</div>
          {footer ? <div className="modal-footer">{footer}</div> : null}
        </form>
      </div>
    </div>
  );
}

export function ModalField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="modal-field">
      <label className="modal-label">{label}</label>
      {children}
    </div>
  );
}

export function ModalCancelButton({
  onClick,
  children = "Cancel",
}: {
  onClick: () => void;
  children?: React.ReactNode;
}) {
  return (
    <button type="button" onClick={onClick} className="btn-secondary">
      {children}
    </button>
  );
}
