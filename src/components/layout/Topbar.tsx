import React from 'react';
import { CheckCircle2, Clock3, Shield } from 'lucide-react';
import { Usuario } from '../../types';

export interface TopbarProps {
  eyebrow: string;
  title: string;
  currentUser: Usuario | null;
  openCount: number;
}

export function Topbar({ eyebrow, title, currentUser, openCount }: TopbarProps) {
  const isAdmin = currentUser?.funcao === 'admin';
  const today = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' }).format(new Date());
  return (
    <header className="app-topbar sticky top-0 z-30 hidden h-20 items-center justify-between border-b border-border bg-background/90 px-6 backdrop-blur-xl md:flex xl:px-8">
      <div>
        <div className="flex items-center gap-2 font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-text-muted">
          <span>Sistema de Garantias</span><span className="text-border-strong">/</span><span className="text-primary">{eyebrow}</span>
        </div>
        <p className="mt-1 text-lg font-bold text-text-primary">{title}</p>
      </div>
      <div className="flex items-center gap-5">
        <div className="text-right">
          <p className="text-xs capitalize text-text-secondary">{today}</p>
          <p className="mt-1 flex items-center justify-end gap-1.5 text-[11px] text-text-muted"><Clock3 className="h-3.5 w-3.5" aria-hidden="true" />{openCount} garantia{openCount === 1 ? '' : 's'} aberta{openCount === 1 ? '' : 's'}</p>
        </div>
        <div className="h-9 w-px bg-border" />
        <div className="flex items-center gap-2 rounded-xl border border-border bg-surface px-3 py-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-soft text-primary">{isAdmin ? <Shield className="h-4 w-4" aria-hidden="true" /> : <CheckCircle2 className="h-4 w-4" aria-hidden="true" />}</div>
          <div><p className="max-w-40 truncate text-xs font-semibold text-text-primary">{currentUser?.nome}</p><p className="text-[10px] text-text-muted">{isAdmin ? 'Administrador' : 'Usuário'}</p></div>
        </div>
      </div>
    </header>
  );
}
