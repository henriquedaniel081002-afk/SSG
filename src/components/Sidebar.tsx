/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { 
  LayoutDashboard, ClipboardList, Camera, FileSpreadsheet, 
  Settings, Menu, X, Shield, User, LogOut
} from 'lucide-react';
import { Usuario } from '../types';
import itamLogo from '../assets/itam-logo.png';

interface SidebarProps {
  currentTab: string;
  setCurrentTab: (tab: string) => void;
  currentUser: Usuario | null;
  onLogout: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  setCurrentTab,
  currentUser,
  onLogout
}) => {
  const [isOpen, setIsOpen] = useState(false);

  const isAdmin = currentUser?.funcao === 'admin';

  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'cadastro', label: 'Cadastro de Garantias', icon: ClipboardList },
    { id: 'registro-foto', label: 'Registro Fotográfico', icon: Camera },
    { id: 'relatorios', label: 'Relatórios', icon: FileSpreadsheet },
    ...(isAdmin ? [{ id: 'configuracoes', label: 'Administração', icon: Settings }] : []),
  ];

  const getRoleIcon = (role?: string) => {
    switch (role) {
      case 'admin':
        return <Shield className="w-4 h-4 text-rose-500" />;
      default:
        return <User className="w-4 h-4 text-slate-500" />;
    }
  };

  const getRoleLabel = (role?: string) => {
    switch (role) {
      case 'admin': return 'Administrador';
      default: return 'Usuário';
    }
  };

  const toggleSidebar = () => setIsOpen(!isOpen);

  return (
    <>
      {/* Mobile Top Navbar */}
      <div className="md:hidden bg-brand-dark text-white h-16 px-4 flex items-center justify-between sticky top-0 z-30 shadow-md">
        <div className="flex items-center gap-2">
          {/* Visual logo */}
          <div className="w-10 h-8 rounded-lg bg-white flex items-center justify-center border border-brand-light/40 overflow-hidden p-0.5">
            <img src={itamLogo} alt="ITAM" className="w-full h-full object-contain" />
          </div>
          <span className="font-bold text-sm font-sans tracking-tight">Sistema de Garantia - ITAM</span>
        </div>
        <button 
          onClick={toggleSidebar}
          className="p-2 hover:bg-slate-800 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-brand-light"
          aria-label="Abrir Menu"
        >
          {isOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {/* Sidebar Overlay for Mobile */}
      {isOpen && (
        <div 
          onClick={toggleSidebar}
          className="fixed inset-0 bg-black/50 z-40 md:hidden transition-opacity"
        />
      )}

      {/* Sidebar Panel */}
      <aside className={`
        fixed md:static inset-y-0 left-0 w-64 bg-brand-dark text-white z-50 transform md:transform-none transition-transform duration-300 ease-in-out flex flex-col justify-between shadow-2xl md:shadow-none
        ${isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
      `}>
        {/* Header Logo */}
        <div>
          <div className="h-16 px-6 border-b border-brand-light/20 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-11 h-9 rounded bg-white flex items-center justify-center shadow-sm border border-brand-light/40 overflow-hidden p-0.5 shrink-0">
                <img src={itamLogo} alt="ITAM" className="w-full h-full object-contain" />
              </div>
              <div className="flex flex-col">
                <span className="font-bold text-[11px] leading-tight text-white tracking-tight uppercase font-sans">Sistema de Garantia - ITAM</span>
              </div>
            </div>
            {/* Close button inside mobile sidebar */}
            <button 
              onClick={toggleSidebar}
              className="p-1 hover:bg-slate-800 rounded md:hidden text-slate-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Navigation Links */}
          <nav className="py-4">
            {menuItems.map((item) => {
              const IconComponent = item.icon;
              const isActive = currentTab === item.id;

              return (
                <button
                  key={item.id}
                  onClick={() => {
                    setCurrentTab(item.id);
                    setIsOpen(false);
                  }}
                  className={`
                    w-full flex items-center gap-3 px-6 py-3.5 text-sm font-medium transition-all duration-150 relative group text-left
                    ${isActive 
                      ? 'bg-brand-light text-white font-semibold border-r-4 border-white' 
                      : 'text-green-100 hover:bg-brand-light/10 hover:text-white'
                    }
                  `}
                >
                  <IconComponent className={`w-5 h-5 shrink-0 transition-transform group-hover:scale-105 ${isActive ? 'text-white' : 'text-green-200/60 group-hover:text-white'}`} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Footer User Info */}
        <div className="p-6 border-t border-brand-light/20 bg-slate-950/20 relative">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider font-mono">Usuário Logado</span>
            <button 
              onClick={onLogout}
              className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-rose-300 transition-colors"
              title="Sair do sistema"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="flex items-center gap-2.5 p-1">
            <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center border border-slate-700 font-semibold text-slate-200 uppercase text-xs">
              {currentUser?.nome ? currentUser.nome.substring(0, 2) : 'US'}
            </div>
            <div className="flex flex-col min-w-0 flex-1">
              <span className="text-xs font-semibold text-slate-100 truncate block">{currentUser?.nome}</span>
              <span className="text-[10px] text-slate-400 flex items-center gap-1">
                {getRoleIcon(currentUser?.funcao)}
                {getRoleLabel(currentUser?.funcao)}
              </span>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
};
