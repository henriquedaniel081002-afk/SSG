import React, { useEffect, useRef, useState } from 'react';
import {
  Camera,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  FileSpreadsheet,
  LayoutDashboard,
  Loader2,
  LogOut,
  Menu,
  Settings,
  Shield,
  User,
  X,
} from 'lucide-react';
import { Usuario } from '../types';
import itamLogo from '../assets/itam-logo.png';

interface SidebarProps {
  currentTab: string;
  setCurrentTab: (tab: string) => void;
  currentUser: Usuario | null;
  onLogout: () => void | Promise<void>;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentTab, setCurrentTab, currentUser, onLogout }) => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [logoutBusy, setLogoutBusy] = useState(false);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const mobileDrawerRef = useRef<HTMLElement>(null);
  const isAdmin = currentUser?.funcao === 'admin';

  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'cadastro', label: 'Garantias', icon: ClipboardList },
    { id: 'registro-foto', label: 'Registro fotográfico', icon: Camera },
    { id: 'relatorios', label: 'Relatórios', icon: FileSpreadsheet },
    ...(isAdmin ? [{ id: 'configuracoes', label: 'Administração', icon: Settings }] : []),
  ];

  useEffect(() => {
    if (!mobileOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setMobileOpen(false);
        return;
      }
      if (event.key !== 'Tab' || !mobileDrawerRef.current) return;
      const focusable = Array.from(mobileDrawerRef.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      )) as HTMLElement[];
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    const frame = window.requestAnimationFrame(() => closeButtonRef.current?.focus());
    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
      menuButtonRef.current?.focus();
    };
  }, [mobileOpen]);

  const handleLogout = async () => {
    if (logoutBusy) return;
    setLogoutBusy(true);
    try {
      await onLogout();
    } finally {
      setLogoutBusy(false);
    }
  };

  const navigate = (tab: string) => {
    setCurrentTab(tab);
    setMobileOpen(false);
  };

  const asideContent = (mobile = false) => (
    <>
      <div>
        <div className={`flex h-20 items-center border-b border-border px-4 ${collapsed && !mobile ? 'justify-center' : 'justify-between'}`}>
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border-strong bg-white p-1 shadow-sm">
              <img src={itamLogo} alt="ITAM Transformadores" className="h-full w-full object-contain" />
            </div>
            {(!collapsed || mobile) && (
              <div className="min-w-0">
                <p className="font-mono text-[9px] font-semibold uppercase tracking-[0.18em] text-primary">ITAM</p>
                <p className="truncate text-xs font-bold text-text-primary">Gestão de Garantias</p>
              </div>
            )}
          </div>
          {mobile ? (
            <button ref={closeButtonRef} type="button" aria-label="Fechar menu" onClick={() => setMobileOpen(false)} className="flex h-11 w-11 items-center justify-center rounded-xl text-text-secondary hover:bg-surface-hover hover:text-text-primary">
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
          ) : null}
        </div>

        <nav aria-label="Navegação principal" className="space-y-1 p-3">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const active = currentTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => navigate(item.id)}
                aria-current={active ? 'page' : undefined}
                title={collapsed && !mobile ? item.label : undefined}
                className={`group relative flex min-h-11 w-full items-center rounded-xl transition-colors ${collapsed && !mobile ? 'justify-center px-2' : 'gap-3 px-3'} ${active ? 'bg-primary text-white shadow-[0_10px_28px_rgba(7,130,68,0.25)]' : 'text-text-secondary hover:bg-surface-hover hover:text-text-primary'}`}
              >
                <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
                {(!collapsed || mobile) && <span className="truncate text-sm font-semibold">{item.label}</span>}
                {collapsed && !mobile ? <span className="pointer-events-none absolute left-[calc(100%+0.75rem)] z-50 hidden whitespace-nowrap rounded-lg border border-border bg-surface-elevated px-2.5 py-1.5 text-xs text-text-primary shadow-xl group-hover:block">{item.label}</span> : null}
              </button>
            );
          })}
        </nav>
      </div>

      <div className="border-t border-border p-3">
        <div className={`rounded-2xl bg-surface-elevated p-3 ${collapsed && !mobile ? 'flex flex-col items-center gap-2' : ''}`}>
          <div className={`flex items-center ${collapsed && !mobile ? 'justify-center' : 'gap-3'}`}>
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border bg-primary-soft text-sm font-bold uppercase text-primary">
              {currentUser?.nome?.slice(0, 2) || 'US'}
            </div>
            {(!collapsed || mobile) && (
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-text-primary">{currentUser?.nome}</p>
                <p className="flex items-center gap-1.5 text-[11px] text-text-muted">
                  {isAdmin ? <Shield className="h-3.5 w-3.5" aria-hidden="true" /> : <User className="h-3.5 w-3.5" aria-hidden="true" />}
                  {isAdmin ? 'Administrador' : 'Usuário'}
                </p>
              </div>
            )}
          </div>
          <button type="button" onClick={() => void handleLogout()} disabled={logoutBusy} title="Sair do sistema" className={`mt-3 flex min-h-11 items-center justify-center rounded-xl border border-border text-sm font-semibold text-text-secondary transition-colors hover:border-danger/50 hover:bg-danger/10 hover:text-red-200 disabled:cursor-not-allowed disabled:opacity-55 ${collapsed && !mobile ? 'h-11 w-11' : 'w-full gap-2 px-3'}`}>
            {logoutBusy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <LogOut className="h-4 w-4" aria-hidden="true" />}
            {(!collapsed || mobile) && (logoutBusy ? 'Saindo…' : 'Sair do sistema')}
          </button>
        </div>
      </div>
    </>
  );

  return (
    <>
      <div className="app-navigation sticky top-0 z-40 flex h-16 items-center justify-between border-b border-border bg-surface/95 px-4 backdrop-blur-xl md:hidden">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-11 items-center justify-center overflow-hidden rounded-lg bg-white p-0.5"><img src={itamLogo} alt="ITAM" className="h-full w-full object-contain" /></div>
          <div><p className="text-xs font-bold text-text-primary">Gestão de Garantias</p><p className="font-mono text-[9px] uppercase tracking-widest text-primary">ITAM</p></div>
        </div>
        <button ref={menuButtonRef} type="button" aria-label="Abrir menu" aria-controls="mobile-navigation-drawer" aria-expanded={mobileOpen} onClick={() => setMobileOpen(true)} className="flex h-11 w-11 items-center justify-center rounded-xl border border-border bg-surface-elevated text-text-primary">
          <Menu className="h-5 w-5" aria-hidden="true" />
        </button>
      </div>

      {mobileOpen && <button type="button" aria-label="Fechar menu" className="app-navigation fixed inset-0 z-40 bg-black/70 backdrop-blur-sm md:hidden" onClick={() => setMobileOpen(false)} />}
      <aside id="mobile-navigation-drawer" ref={mobileDrawerRef} role="dialog" aria-modal="true" aria-label="Menu principal" aria-hidden={!mobileOpen} inert={!mobileOpen} className={`app-navigation fixed inset-y-0 left-0 z-50 flex w-72 flex-col justify-between border-r border-border bg-surface shadow-2xl transition-transform md:hidden ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        {asideContent(true)}
      </aside>

      <aside className={`app-navigation sticky top-0 hidden h-screen shrink-0 flex-col justify-between border-r border-border bg-surface transition-[width] duration-200 md:flex ${collapsed ? 'w-20' : 'w-72'}`}>
        {asideContent(false)}
        <button
          type="button"
          aria-label={collapsed ? 'Expandir barra lateral' : 'Recolher barra lateral'}
          onClick={() => setCollapsed((value) => !value)}
          className="absolute -right-[1.375rem] top-24 flex h-11 w-11 items-center justify-center rounded-full border border-border-strong bg-surface-elevated text-text-secondary shadow-lg hover:text-text-primary"
        >
          {collapsed ? <ChevronRight className="h-4 w-4" aria-hidden="true" /> : <ChevronLeft className="h-4 w-4" aria-hidden="true" />}
        </button>
      </aside>
    </>
  );
};
