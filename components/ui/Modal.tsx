"use client";

import React, { useEffect, useId } from "react";
import { X } from "lucide-react";

interface ModalProps {
  title: string;
  description?: React.ReactNode;
  onClose: () => void;
  footer: React.ReactNode;
  children: React.ReactNode;
  width?: string;
}

export function Modal({ title, description, onClose, footer, children, width = "sm:max-w-lg" }: ModalProps) {
  const titleId = useId();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-black/40 dark:bg-black/70"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={`w-full ${width} max-h-[92vh] flex flex-col bg-ink-rail border border-ink-line rounded-t-2xl sm:rounded-2xl shadow-2xl overflow-hidden text-fg`}
      >
        <div className="flex items-start justify-between gap-4 px-6 pt-5 pb-4 border-b border-ink-hair">
          <div className="flex flex-col gap-1 min-w-0">
            <h2 id={titleId} className="text-lg font-semibold tracking-tight">
              {title}
            </h2>
            {description && <p className="text-[13px] text-fg-muted">{description}</p>}
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="w-9 h-9 -mr-2 shrink-0 flex items-center justify-center rounded-lg text-fg-muted hover:text-fg hover:bg-ink-raised transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-6">{children}</div>

        <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-ink-hair">{footer}</div>
      </div>
    </div>
  );
}

export function ModalSection({
  label,
  htmlFor,
  hint,
  children,
}: {
  label: string;
  htmlFor?: string;
  hint?: React.ReactNode;
  children: React.ReactNode;
}) {
  const Label = htmlFor ? "label" : "span";
  return (
    <section className="flex flex-col gap-2.5">
      <Label htmlFor={htmlFor} className="text-[11px] font-semibold uppercase tracking-[0.12em] text-fg-muted">
        {label}
      </Label>
      {children}
      {hint && <p className="text-xs text-fg-muted leading-relaxed">{hint}</p>}
    </section>
  );
}

export const inputClass =
  "w-full h-11 bg-ink-surface border border-ink-edge rounded-[10px] px-3.5 text-sm text-fg placeholder:text-fg-muted focus:outline-none focus:border-fg-muted transition";

export function PrimaryButton(props: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      {...props}
      className="h-10 px-4 rounded-lg bg-signal text-on-signal text-[13px] font-semibold transition hover:brightness-95 disabled:opacity-40"
    />
  );
}

export function GhostButton(props: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      {...props}
      className="h-10 px-4 rounded-lg border border-ink-edge text-[13px] text-fg transition hover:bg-ink-raised"
    />
  );
}

export function SavedNote({ show, children }: { show: boolean; children: React.ReactNode }) {
  return (
    <span role="status" className="flex items-center gap-1.5 text-xs text-fg-subtle">
      {show && (
        <>
          <span className="w-1.5 h-1.5 rounded-full bg-signal" />
          {children}
        </>
      )}
    </span>
  );
}
