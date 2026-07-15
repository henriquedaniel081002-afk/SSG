/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { buscarEstadoCompleto, obterUsuarioLogado, sairDoSistema } from './services/api';
import { DBState, Garantia, Usuario } from './types';

// Component imports
import { Sidebar } from './components/Sidebar';
import { Dashboard } from './components/Dashboard';
import { CadastroGarantias } from './components/CadastroGarantias';
import { RegistroFotografico } from './components/RegistroFotografico';
import { Relatorios } from './components/Relatorios';
import { Configuracoes } from './components/Configuracoes';
import { VisualizacaoGarantia } from './components/VisualizacaoGarantia';
import { Login } from './components/Login';

import { 
  Bell, HelpCircle, Shield, Wrench, Eye, Clock, 
  MapPin, CheckCircle, Info, Menu, X, ArrowUpRight, AlertTriangle
} from 'lucide-react';

export default function App() {
  const [db, setDb] = useState<DBState>({
    garantias: [],
    clientes: [],
    equipamentos: [],
    fotos: [],
    historicos: [],
    usuarios: [],
    currentUser: null
  });
  const [isLoading, setIsLoading] = useState(true);
  const [authChecked, setAuthChecked] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [currentTab, setCurrentTab] = useState<string>('dashboard');
  const [selectedGarantia, setSelectedGarantia] = useState<Garantia | null>(null);
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' | 'warning' | 'info' } | null>(null);


  // Substitui os alertas nativos do navegador por notificações modernas e não bloqueantes.
  useEffect(() => {
    const originalAlert = window.alert;
    let timer: number | undefined;

    window.alert = (message?: unknown) => {
      const text = String(message ?? '');
      const normalized = text.toLocaleLowerCase('pt-BR');
      const type: 'success' | 'error' | 'warning' | 'info' =
        normalized.includes('sucesso') || normalized.includes('aprovado') || normalized.includes('atualizada') || normalized.includes('vinculada')
          ? 'success'
          : normalized.includes('erro') || normalized.includes('não foi possível') || normalized.includes('já está cadastrad') || normalized.includes('já possui')
            ? 'error'
            : normalized.includes('obrigat') || normalized.includes('selecione') || normalized.includes('apenas administradores') || normalized.includes('desativada')
              ? 'warning'
              : 'info';

      setNotification({ message: text, type });
      if (timer) window.clearTimeout(timer);
      timer = window.setTimeout(() => setNotification(null), 4500);
    };

    return () => {
      window.alert = originalAlert;
      if (timer) window.clearTimeout(timer);
    };
  }, []);

  // Active User Synchronization
  const currentUser = db.currentUser;
  const isAdmin = currentUser?.funcao === 'admin';

  const loadStateFromApi = async (preferredUserId?: string | null) => {
    try {
      setApiError(null);
      const apiState = await buscarEstadoCompleto(preferredUserId || db.currentUser?.id || null);
      setDb((prev) => ({
        ...apiState,
        currentUser: apiState.usuarios.find((u) => u.id === (preferredUserId || prev.currentUser?.id)) || apiState.currentUser,
      }));
    } catch (error) {
      console.error(error);
      setApiError(error instanceof Error ? error.message : 'Erro ao conectar ao Supabase');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const bootstrap = async () => {
      try {
        setApiError(null);
        const usuario = await obterUsuarioLogado();
        if (usuario) {
          const apiState = await buscarEstadoCompleto(usuario.id);
          setDb({ ...apiState, currentUser: usuario });
        }
      } catch (error) {
        console.error(error);
      } finally {
        setAuthChecked(true);
        setIsLoading(false);
      }
    };

    bootstrap();
  }, []);

  // Atualiza somente o estado em tela. A gravação permanente acontece no Supabase.
  const handleUpdateState = (newState: DBState) => {
    setDb(newState);
  };

  const handleLoginSuccess = async (user: Usuario) => {
    setIsLoading(true);
    const apiState = await buscarEstadoCompleto(user.id);
    setDb({ ...apiState, currentUser: user });
    setApiError(null);
    setIsLoading(false);
  };

  const handleLogout = async () => {
    await sairDoSistema();
    setDb({
      garantias: [],
      clientes: [],
      equipamentos: [],
      fotos: [],
      historicos: [],
      usuarios: [],
      currentUser: null,
    });
    setCurrentTab('dashboard');
  };

  const handleSelectGarantia = (garantia: Garantia) => {
    setSelectedGarantia(garantia);
  };

  // Render current tab component
  const renderTabContent = () => {
    switch (currentTab) {
      case 'dashboard':
        return (
          <Dashboard 
            db={db} 
            onSelectGarantia={handleSelectGarantia} 
            onNavigateToTab={setCurrentTab}
          />
        );
      case 'cadastro':
        return (
          <CadastroGarantias 
            db={db} 
            onUpdateState={handleUpdateState} 
            currentUser={currentUser}
            onSelectGarantia={handleSelectGarantia}
          />
        );
      case 'registro-foto':
        return (
          <RegistroFotografico 
            db={db} 
            onUpdateState={handleUpdateState} 
            currentUser={currentUser}
          />
        );
      case 'relatorios':
        return (
          <Relatorios 
            db={db} 
            onSelectGarantia={handleSelectGarantia}
          />
        );
      case 'configuracoes':
        if (!isAdmin) {
          return (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8 text-center space-y-2">
              <Shield className="w-10 h-10 text-slate-300 mx-auto" />
              <h2 className="text-lg font-bold text-slate-800">Acesso restrito</h2>
              <p className="text-sm text-slate-500">A administração de usuários está disponível somente para administradores.</p>
            </div>
          );
        }
        return (
          <Configuracoes 
            db={db} 
            onUpdateState={handleUpdateState} 
            currentUser={currentUser}
          />
        );
      default:
        return (
          <Dashboard 
            db={db} 
            onSelectGarantia={handleSelectGarantia} 
            onNavigateToTab={setCurrentTab}
          />
        );
    }
  };

  // Get active user role label
  const getRoleLabel = (role?: string) => {
    switch (role) {
      case 'admin': return 'Administrador';
      default: return 'Usuário';
    }
  };


  if (isLoading) {
    return (
      <div className="min-h-screen bg-brand-gray flex items-center justify-center p-6">
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6 max-w-md w-full text-center space-y-2">
          <div className="w-8 h-8 rounded-full border-2 border-brand-light border-t-transparent animate-spin mx-auto" />
          <h1 className="text-sm font-bold text-slate-800">Carregando sistema...</h1>
          <p className="text-xs text-slate-500">Verificando autenticação, banco e storage.</p>
        </div>
      </div>
    );
  }

  if (apiError && currentUser) {
    return (
      <div className="min-h-screen bg-brand-gray flex items-center justify-center p-6">
        <div className="bg-white border border-rose-200 rounded-2xl shadow-sm p-6 max-w-xl w-full space-y-3">
          <h1 className="text-lg font-bold text-rose-700">Não foi possível conectar ao Supabase</h1>
          <p className="text-sm text-slate-600">{apiError}</p>
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-600 font-mono">
            <div>1. Verifique o arquivo .env na raiz do projeto</div>
            <div>2. Confirme VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY</div>
            <div>3. Execute os scripts SQL em /supabase</div>
          </div>
          <button
            onClick={() => loadStateFromApi()}
            className="px-4 py-2 bg-brand-light text-white text-xs font-bold rounded-lg hover:bg-green-700"
          >
            Tentar novamente
          </button>
        </div>
      </div>
    );
  }

  if (authChecked && !currentUser) {
    return <Login onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <div className="flex flex-col md:flex-row min-h-screen bg-brand-gray text-[#334155] antialiased font-sans">
      
      {/* Sidebar navigation */}
      <Sidebar 
        currentTab={currentTab} 
        setCurrentTab={setCurrentTab} 
        currentUser={currentUser}
        onLogout={handleLogout}
      />

      {/* Main content body */}
      <main className="flex-1 flex flex-col min-w-0 overflow-x-hidden">
        
        {/* Top bar header */}
        <header className="hidden md:flex h-16 bg-white border-b border-slate-200 px-8 items-center justify-between sticky top-0 z-20 shadow-xs">
          <div className="flex items-center gap-3">
            <span className="text-[10px] font-bold text-brand-light uppercase tracking-widest font-mono">Sistema de Garantia - ITAM</span>
          </div>

          <div className="flex items-center gap-6">
            {/* Quick stats indicators in header */}
            <div className="flex items-center gap-4 text-xs font-medium text-slate-500 border-r border-slate-200 pr-6">
              <div className="flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-slate-400" />
                <span>Hoje: <strong className="text-slate-700">25/06/2026</strong></span>
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle className="w-4 h-4 text-emerald-500" />
                <span>Atendidos: <strong className="text-slate-700">{db.garantias.filter(g => g.status === 'Concluído').length}</strong></span>
              </div>
            </div>

            {/* Active Operator info */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400 font-medium">Perfil:</span>
              <span className="text-xs font-bold text-brand-dark bg-slate-100 px-2.5 py-1 rounded-lg">
                {currentUser?.nome} ({getRoleLabel(currentUser?.funcao)})
              </span>
            </div>
          </div>
        </header>

        {/* Tab content wrapper with smooth motion layout transitions */}
        <div className="p-4 md:p-8 flex-1 max-w-7xl w-full mx-auto print:p-0">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.18, ease: 'easeOut' }}
              className="w-full h-full"
            >
              {renderTabContent()}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Footer info */}
        <footer className="py-6 px-8 border-t border-slate-200 text-center text-[10px] text-slate-400 bg-white font-medium flex flex-col sm:flex-row justify-between gap-2 mt-auto print:hidden">
          <span>Sistema de Garantia - ITAM • Gestão de Garantias de Transformadores Industriais</span>
          <span className="flex items-center justify-center gap-1">
            ITAM Transformadores <ArrowUpRight className="w-3 h-3 text-slate-300" />
          </span>
        </footer>

      </main>

      <AnimatePresence>
        {notification && (
          <motion.div
            initial={{ opacity: 0, y: -18, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -12, scale: 0.98 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="fixed top-5 right-5 z-[100] w-[calc(100%-2rem)] max-w-md print:hidden"
            role="status"
            aria-live="polite"
          >
            <div className={`rounded-2xl border bg-white shadow-2xl shadow-slate-900/15 overflow-hidden ${
              notification.type === 'success' ? 'border-emerald-200' :
              notification.type === 'error' ? 'border-rose-200' :
              notification.type === 'warning' ? 'border-amber-200' : 'border-sky-200'
            }`}>
              <div className="flex items-start gap-3 p-4">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                  notification.type === 'success' ? 'bg-emerald-50 text-emerald-600' :
                  notification.type === 'error' ? 'bg-rose-50 text-rose-600' :
                  notification.type === 'warning' ? 'bg-amber-50 text-amber-600' : 'bg-sky-50 text-sky-600'
                }`}>
                  {notification.type === 'success' ? <CheckCircle className="w-5 h-5" /> :
                   notification.type === 'error' || notification.type === 'warning' ? <AlertTriangle className="w-5 h-5" /> :
                   <Info className="w-5 h-5" />}
                </div>
                <div className="min-w-0 flex-1 pt-0.5">
                  <p className="text-sm font-bold text-slate-900">
                    {notification.type === 'success' ? 'Operação concluída' :
                     notification.type === 'error' ? 'Não foi possível concluir' :
                     notification.type === 'warning' ? 'Atenção necessária' : 'Informação'}
                  </p>
                  <p className="text-xs leading-relaxed text-slate-600 mt-1">{notification.message}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setNotification(null)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                  aria-label="Fechar notificação"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <motion.div
                key={notification.message}
                initial={{ width: '100%' }}
                animate={{ width: '0%' }}
                transition={{ duration: 4.5, ease: 'linear' }}
                className={`h-1 ${
                  notification.type === 'success' ? 'bg-emerald-500' :
                  notification.type === 'error' ? 'bg-rose-500' :
                  notification.type === 'warning' ? 'bg-amber-500' : 'bg-sky-500'
                }`}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* POPUP FULL-DETAIL DIALOG (OVERLAY WINDOW) */}
      <AnimatePresence>
        {selectedGarantia && (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 overflow-y-auto backdrop-blur-xs print:relative print:z-0 print:bg-white print:p-0 print:overflow-visible">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ duration: 0.22, ease: 'easeOut' }}
              className="w-full max-w-5xl my-8 print:my-0 print:max-w-full"
            >
              <VisualizacaoGarantia
                garantia={selectedGarantia}
                clientes={db.clientes}
                equipamentos={db.equipamentos}
                fotos={db.fotos}
                historicos={db.historicos}
                usuarios={db.usuarios}
                onClose={() => setSelectedGarantia(null)}
                onEdit={currentUser ? () => {
                  // Navigate to edit in registration tab
                  setCurrentTab('cadastro');
                  setSelectedGarantia(null);
                } : undefined}
              />
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
