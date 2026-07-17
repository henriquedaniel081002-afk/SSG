import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { AlertTriangle, CheckCircle2, Info, XCircle } from 'lucide-react';
import { Button, IconButton } from './Primitives';
import { Dialog } from './Dialog';
import { X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastOptions {
  message: string;
  type?: ToastType;
  title?: string;
  duration?: number;
}

export interface ConfirmOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
}

interface FeedbackValue {
  notify: (message: string | ToastOptions, type?: ToastType) => void;
  confirm: (options: ConfirmOptions) => Promise<boolean>;
}

interface ToastItem extends Required<Pick<ToastOptions, 'message' | 'type' | 'duration'>> {
  id: number;
  title?: string;
}

interface PendingConfirm extends ConfirmOptions {
  resolve: (value: boolean) => void;
}

const FeedbackContext = createContext<FeedbackValue | null>(null);

const toastMeta: Record<ToastType, { title: string; icon: typeof Info; className: string }> = {
  success: { title: 'Operação concluída', icon: CheckCircle2, className: 'border-success/45 bg-emerald-950/95 text-emerald-100' },
  error: { title: 'Não foi possível concluir', icon: XCircle, className: 'border-danger/45 bg-red-950/95 text-red-100' },
  warning: { title: 'Atenção necessária', icon: AlertTriangle, className: 'border-warning/45 bg-amber-950/95 text-amber-100' },
  info: { title: 'Informação', icon: Info, className: 'border-information/45 bg-sky-950/95 text-sky-100' },
};

export function FeedbackProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [pendingConfirm, setPendingConfirm] = useState<PendingConfirm | null>(null);
  const idRef = useRef(0);

  const dismiss = useCallback((id: number) => setToasts((current) => current.filter((item) => item.id !== id)), []);

  const notify = useCallback((input: string | ToastOptions, legacyType?: ToastType) => {
    const options: ToastOptions = typeof input === 'string' ? { message: input, type: legacyType } : input;
    const item: ToastItem = {
      id: ++idRef.current,
      message: options.message,
      type: options.type || 'info',
      title: options.title,
      duration: options.duration ?? 4800,
    };
    setToasts((current) => [...current.slice(-3), item]);
    window.setTimeout(() => dismiss(item.id), item.duration);
  }, [dismiss]);

  const confirm = useCallback((options: ConfirmOptions) => new Promise<boolean>((resolve) => {
    setPendingConfirm({ ...options, resolve });
  }), []);

  const settleConfirm = (value: boolean) => {
    const current = pendingConfirm;
    setPendingConfirm(null);
    current?.resolve(value);
  };

  const value = useMemo(() => ({ notify, confirm }), [notify, confirm]);

  return (
    <FeedbackContext.Provider value={value}>
      {children}
      <div className="fixed right-3 top-3 z-[150] flex w-[calc(100%-1.5rem)] max-w-sm flex-col gap-2 no-print sm:right-5 sm:top-5" aria-live="polite" aria-atomic="false">
        <AnimatePresence initial={false}>
          {toasts.map((toast) => {
            const meta = toastMeta[toast.type];
            const Icon = meta.icon;
            return (
              <motion.div
                key={toast.id}
                layout
                initial={{ opacity: 0, x: 24, scale: 0.98 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, x: 20, scale: 0.98 }}
                className={`overflow-hidden rounded-2xl border shadow-[0_20px_60px_rgba(0,0,0,0.38)] backdrop-blur-xl ${meta.className}`}
                role={toast.type === 'error' ? 'alert' : 'status'}
              >
                <div className="flex items-start gap-3 p-4">
                  <Icon className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold">{toast.title || meta.title}</p>
                    <p className="mt-0.5 text-xs leading-relaxed opacity-85">{toast.message}</p>
                  </div>
                  <IconButton label="Fechar notificação" icon={X} className="h-11 w-11 border-white/10 text-current hover:bg-white/10" onClick={() => dismiss(toast.id)} />
                </div>
                <motion.div initial={{ width: '100%' }} animate={{ width: '0%' }} transition={{ duration: toast.duration / 1000, ease: 'linear' }} className="h-0.5 bg-current opacity-55" />
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
      <Dialog
        open={Boolean(pendingConfirm)}
        onClose={() => settleConfirm(false)}
        title={pendingConfirm?.title || 'Confirmar operação'}
        description={pendingConfirm?.message}
        size="sm"
        closeOnBackdrop={false}
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => settleConfirm(false)}>{pendingConfirm?.cancelLabel || 'Cancelar'}</Button>
            <Button variant={pendingConfirm?.destructive ? 'danger' : 'primary'} onClick={() => settleConfirm(true)}>{pendingConfirm?.confirmLabel || 'Confirmar'}</Button>
          </div>
        }
      >
        <div className="px-6 py-5 text-sm text-text-secondary">Revise as informações antes de continuar.</div>
      </Dialog>
    </FeedbackContext.Provider>
  );
}

export function useFeedback() {
  const context = useContext(FeedbackContext);
  if (!context) throw new Error('useFeedback deve ser utilizado dentro de FeedbackProvider.');
  return context;
}
