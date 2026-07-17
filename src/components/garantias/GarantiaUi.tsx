import type React from 'react';
import { useEffect, useRef } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Info,
  Loader2,
  X,
  XCircle,
} from 'lucide-react';
import { StatusGarantia } from '../../types';
import { getStatusTone } from './models';

export type ToastKind = 'success' | 'error' | 'warning' | 'info';

export interface WarrantyToast {
  id: number;
  message: string;
  kind: ToastKind;
}

const focusableSelector = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

export function trapFocus(event: React.KeyboardEvent<HTMLElement>, onEscape: () => void) {
  if (event.key === 'Escape') {
    event.preventDefault();
    event.stopPropagation();
    onEscape();
    return;
  }

  if (event.key !== 'Tab') return;
  const focusable = Array.from(event.currentTarget.querySelectorAll(focusableSelector)) as HTMLElement[];
  if (!focusable.length) {
    event.preventDefault();
    return;
  }

  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  const active = document.activeElement;
  if (event.shiftKey && active === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && active === last) {
    event.preventDefault();
    first.focus();
  }
}

export function useInitialDialogFocus(open: boolean) {
  const layerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const frame = requestAnimationFrame(() => {
      const initial = layerRef.current?.querySelector<HTMLElement>('[data-autofocus], button:not([disabled]), input:not([disabled])');
      initial?.focus();
    });

    return () => {
      cancelAnimationFrame(frame);
      previous?.focus();
    };
  }, [open]);

  return layerRef;
}

export function StatusBadge({ status }: { status: StatusGarantia }) {
  return (
    <span className={`inline-flex min-h-7 items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold ${getStatusTone(status)}`}>
      {status}
    </span>
  );
}

export function ToastRegion({ toasts, onDismiss }: { toasts: WarrantyToast[]; onDismiss: (id: number) => void }) {
  const icons = {
    success: CheckCircle2,
    error: XCircle,
    warning: AlertTriangle,
    info: Info,
  };
  const tones = {
    success: 'border-success/35 text-success',
    error: 'border-danger/35 text-danger',
    warning: 'border-warning/35 text-warning',
    info: 'border-information/35 text-information',
  };

  return (
    <div className="fixed bottom-4 right-4 z-[90] flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-2" aria-live="polite" aria-atomic="false">
      {toasts.map((toast) => {
        const Icon = icons[toast.kind];
        return (
          <div key={toast.id} role={toast.kind === 'error' ? 'alert' : 'status'} className={`flex items-start gap-3 rounded-xl border bg-surface-elevated p-3 shadow-panel ${tones[toast.kind]}`}>
            <Icon className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
            <p className="min-w-0 flex-1 text-sm font-medium text-text-primary">{toast.message}</p>
            <button type="button" onClick={() => onDismiss(toast.id)} className="grid h-11 w-11 shrink-0 place-items-center rounded-lg text-text-muted hover:bg-surface-hover hover:text-text-primary" aria-label="Fechar notificação">
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        );
      })}
    </div>
  );
}

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  destructive?: boolean;
  busy?: boolean;
  onCancel: () => void;
  onConfirm: () => void | Promise<void>;
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  destructive = false,
  busy = false,
  onCancel,
  onConfirm,
}: ConfirmDialogProps) {
  const layerRef = useInitialDialogFocus(open);
  if (!open) return null;

  return (
    <div
      ref={layerRef}
      className="fixed inset-0 z-[80] grid place-items-center bg-black/75 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="warranty-confirm-title"
      aria-describedby="warranty-confirm-description"
      onKeyDown={(event) => trapFocus(event, busy ? () => undefined : onCancel)}
    >
      <div className="w-full max-w-md rounded-2xl border border-border bg-surface-elevated p-5 shadow-panel">
        <div className={`mb-4 grid h-11 w-11 place-items-center rounded-xl ${destructive ? 'bg-danger/10 text-danger' : 'bg-warning/10 text-warning'}`}>
          <AlertTriangle className="h-5 w-5" aria-hidden="true" />
        </div>
        <h2 id="warranty-confirm-title" className="text-lg font-semibold text-text-primary">{title}</h2>
        <p id="warranty-confirm-description" className="mt-2 text-sm leading-6 text-text-secondary">{description}</p>
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" onClick={onCancel} disabled={busy} className="min-h-11 rounded-xl border border-border px-4 text-sm font-semibold text-text-secondary hover:bg-surface-hover hover:text-text-primary disabled:opacity-50">
            Cancelar
          </button>
          <button
            type="button"
            data-autofocus
            onClick={() => void onConfirm()}
            disabled={busy}
            className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold text-white disabled:opacity-50 ${destructive ? 'bg-danger hover:bg-danger/85' : 'bg-primary hover:bg-primary-hover'}`}
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
            {busy ? 'Processando…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

interface PaginationProps {
  page: number;
  pageCount: number;
  total: number;
  pageSize: number;
  onPageChange: (page: number) => void;
}

export function Pagination({ page, pageCount, total, pageSize, onPageChange }: PaginationProps) {
  if (total === 0) return null;
  const first = (page - 1) * pageSize + 1;
  const last = Math.min(page * pageSize, total);

  return (
    <nav className="flex flex-col gap-3 border-t border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between" aria-label="Paginação de garantias">
      <p className="text-xs text-text-muted">Exibindo {first}–{last} de {total}</p>
      <div className="flex items-center gap-2">
        <button type="button" onClick={() => onPageChange(page - 1)} disabled={page <= 1} className="inline-flex min-h-11 items-center gap-1 rounded-lg border border-border px-3 text-xs font-semibold text-text-secondary hover:bg-surface-hover disabled:cursor-not-allowed disabled:opacity-40" aria-label="Página anterior">
          <ChevronLeft className="h-4 w-4" aria-hidden="true" /> Anterior
        </button>
        <span className="min-w-20 text-center text-xs font-semibold text-text-secondary">{page} de {pageCount}</span>
        <button type="button" onClick={() => onPageChange(page + 1)} disabled={page >= pageCount} className="inline-flex min-h-11 items-center gap-1 rounded-lg border border-border px-3 text-xs font-semibold text-text-secondary hover:bg-surface-hover disabled:cursor-not-allowed disabled:opacity-40" aria-label="Próxima página">
          Próxima <ChevronRight className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </nav>
  );
}
