import React, { useCallback, useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { RefreshCw, WifiOff } from 'lucide-react';
import { buscarEstadoCompleto, obterUsuarioLogado, sairDoSistema } from './services/api';
import { DBState, Garantia, StatusGarantia, Usuario } from './types';
import { Sidebar } from './components/Sidebar';
import { Dashboard } from './components/Dashboard';
import { CadastroGarantias } from './components/CadastroGarantias';
import { RegistroFotografico } from './components/RegistroFotografico';
import { Relatorios } from './components/Relatorios';
import { Configuracoes } from './components/Configuracoes';
import { VisualizacaoGarantia } from './components/VisualizacaoGarantia';
import { Login } from './components/Login';
import { Button, Card, FeedbackProvider, useFeedback } from './components/ui';
import { AppShell } from './components/layout/AppShell';
import { Topbar } from './components/layout/Topbar';

export type AppView = 'dashboard' | 'cadastro' | 'registro-foto' | 'relatorios' | 'configuracoes';
export interface NavigationIntent {
  type: 'create' | 'edit';
  garantiaId?: string;
  nonce: number;
}

const emptyState: DBState = {
  garantias: [],
  clientes: [],
  equipamentos: [],
  fotos: [],
  historicos: [],
  usuarios: [],
  currentUser: null,
};

const viewMeta: Record<AppView, { eyebrow: string; title: string }> = {
  dashboard: { eyebrow: 'Visão geral', title: 'Dashboard operacional' },
  cadastro: { eyebrow: 'Operação', title: 'Gestão de garantias' },
  'registro-foto': { eyebrow: 'Documentação', title: 'Registro fotográfico' },
  relatorios: { eyebrow: 'Análise', title: 'Relatórios' },
  configuracoes: { eyebrow: 'Administração', title: 'Usuários e configurações' },
};

function AppContent() {
  const { notify } = useFeedback();
  const [db, setDb] = useState<DBState>(emptyState);
  const [isLoading, setIsLoading] = useState(true);
  const [authChecked, setAuthChecked] = useState(false);
  const [systemError, setSystemError] = useState<string | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [currentTab, setCurrentTab] = useState<AppView>('dashboard');
  const [selectedGarantiaId, setSelectedGarantiaId] = useState<string | null>(null);
  const [warrantyAction, setWarrantyAction] = useState<NavigationIntent | undefined>();
  const [photoTargetId, setPhotoTargetId] = useState<string | undefined>();

  const currentUser = db.currentUser;
  const isAdmin = currentUser?.funcao === 'admin';
  const selectedGarantia = selectedGarantiaId ? db.garantias.find((item) => item.id === selectedGarantiaId) || null : null;

  const applyRefreshedState = useCallback((nextState: DBState, preferredUser?: Usuario | null) => {
    setDb((previous) => {
      const authenticated = preferredUser || previous.currentUser;
      const refreshedUser = authenticated ? nextState.usuarios.find((item) => item.id === authenticated.id) : null;
      return { ...nextState, currentUser: refreshedUser || authenticated || null };
    });
  }, []);

  useEffect(() => {
    let cancelled = false;
    const bootstrap = async () => {
      setIsLoading(true);
      try {
        setSystemError(null);
        setAuthError(null);
        const usuario = await obterUsuarioLogado();
        if (cancelled) return;
        if (usuario) {
          setDb((previous) => ({ ...previous, currentUser: usuario }));
          const apiState = await buscarEstadoCompleto(usuario.id);
          if (!cancelled) setDb({ ...apiState, currentUser: usuario });
        }
      } catch (error) {
        if (cancelled) return;
        const message = error instanceof Error ? error.message : 'Não foi possível iniciar o sistema.';
        console.error('Falha ao iniciar o SSG:', error);
        const normalized = message.toLocaleLowerCase('pt-BR');
        const isAccessState = ['pendente', 'recusad', 'inativ', 'ainda não está cadastrado'].some((term) => normalized.includes(term));
        if (isAccessState) setAuthError(message);
        else setSystemError(message);
      } finally {
        if (!cancelled) {
          setAuthChecked(true);
          setIsLoading(false);
        }
      }
    };
    void bootstrap();
    return () => { cancelled = true; };
  }, []);

  const handleUpdateState = useCallback((newState: DBState) => {
    applyRefreshedState(newState);
  }, [applyRefreshedState]);

  const handleLoginSuccess = async (user: Usuario) => {
    setIsLoading(true);
    setSystemError(null);
    setAuthError(null);
    setDb((previous) => ({ ...previous, currentUser: user }));
    try {
      const apiState = await buscarEstadoCompleto(user.id);
      setDb({ ...apiState, currentUser: user });
      setCurrentTab('dashboard');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Não foi possível carregar os dados após o login.';
      console.error('Falha ao carregar o SSG após a autenticação:', error);
      setSystemError(message);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await sairDoSistema();
      setDb(emptyState);
      setCurrentTab('dashboard');
      setSelectedGarantiaId(null);
      setWarrantyAction(undefined);
      setPhotoTargetId(undefined);
      setSystemError(null);
      setAuthError(null);
      notify('Sessão encerrada com segurança.', 'info');
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Não foi possível sair do sistema.', 'error');
    }
  };

  const navigate = useCallback((tab: string, action?: string, garantiaId?: string) => {
    const nextTab = tab as AppView;
    if (nextTab === 'configuracoes' && !isAdmin) {
      notify('A administração de usuários é restrita a administradores.', 'warning');
      return;
    }
    setCurrentTab(nextTab);
    if (nextTab === 'cadastro' && (action === 'create' || action === 'edit')) {
      setWarrantyAction({ type: action, garantiaId, nonce: Date.now() });
    }
    if (nextTab === 'registro-foto') setPhotoTargetId(garantiaId);
  }, [isAdmin, notify]);

  const openEditWarranty = (garantia: Garantia) => {
    setSelectedGarantiaId(null);
    navigate('cadastro', 'edit', garantia.id);
  };

  const renderTabContent = () => {
    switch (currentTab) {
      case 'dashboard':
        return (
          <Dashboard
            db={db}
            onSelectGarantia={(garantia) => setSelectedGarantiaId(garantia.id)}
            onNavigateToTab={(tab) => navigate(tab)}
            onNavigate={navigate}
          />
        );
      case 'cadastro':
        return (
          <CadastroGarantias
            db={db}
            onUpdateState={handleUpdateState}
            currentUser={currentUser}
            onSelectGarantia={(garantia) => setSelectedGarantiaId(garantia.id)}
            requestedAction={warrantyAction}
            onActionHandled={() => setWarrantyAction(undefined)}
          />
        );
      case 'registro-foto':
        return (
          <RegistroFotografico
            db={db}
            onUpdateState={handleUpdateState}
            currentUser={currentUser}
            initialGarantiaId={photoTargetId}
            onInitialGarantiaHandled={() => setPhotoTargetId(undefined)}
            onNotify={notify}
          />
        );
      case 'relatorios':
        return <Relatorios db={db} onSelectGarantia={(garantia) => setSelectedGarantiaId(garantia.id)} onNotify={notify} />;
      case 'configuracoes':
        return isAdmin ? <Configuracoes db={db} onUpdateState={handleUpdateState} currentUser={currentUser} onNotify={notify} /> : null;
      default:
        return null;
    }
  };

  if (isLoading) {
    return (
      <main className="surface-grid flex min-h-screen items-center justify-center bg-background p-5">
        <Card className="w-full max-w-md p-7 text-center">
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-soft text-primary"><RefreshCw className="h-6 w-6 animate-spin" aria-hidden="true" /></div>
          <h1 className="text-lg font-bold text-text-primary">Preparando o ambiente</h1>
          <p className="mt-2 text-sm text-text-secondary">Verificando sessão e carregando os dados de garantias.</p>
        </Card>
      </main>
    );
  }

  if (systemError) {
    return (
      <main className="surface-grid flex min-h-screen items-center justify-center bg-background p-5">
        <Card className="w-full max-w-lg p-7">
          <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-danger/10 text-danger"><WifiOff className="h-6 w-6" aria-hidden="true" /></div>
          <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-danger">Conexão indisponível</p>
          <h1 className="mt-2 text-2xl font-bold text-text-primary">Não foi possível carregar o sistema</h1>
          <p className="mt-3 text-sm leading-relaxed text-text-secondary">O serviço está temporariamente indisponível. Verifique sua conexão e tente novamente em instantes.</p>
          <div className="mt-6 flex flex-wrap gap-2">
            <Button icon={RefreshCw} onClick={() => window.location.reload()}>Tentar novamente</Button>
            {currentUser ? <Button variant="secondary" onClick={() => void handleLogout()}>Sair</Button> : null}
          </div>
        </Card>
      </main>
    );
  }

  if (authChecked && !currentUser) return <Login onLoginSuccess={handleLoginSuccess} initialError={authError} />;

  const openCount = db.garantias.filter((item) => item.status !== StatusGarantia.CONCLUIDO && item.status !== StatusGarantia.ENCERRADO).length;
  const meta = viewMeta[currentTab];

  return (
    <>
      <AppShell
        navigation={<Sidebar currentTab={currentTab} setCurrentTab={(tab) => navigate(tab)} currentUser={currentUser} onLogout={handleLogout} />}
        topbar={<Topbar eyebrow={meta.eyebrow} title={meta.title} currentUser={currentUser} openCount={openCount} />}
        footer={<footer className="app-footer border-t border-border px-6 py-5 text-center text-[11px] text-text-muted md:flex md:justify-between md:text-left xl:px-8"><span>ITAM Transformadores · Sistema de Gestão de Garantias</span><span>Operação industrial com rastreabilidade</span></footer>}
      >
          <AnimatePresence mode="wait">
            <motion.div key={currentTab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.16 }}>
              {renderTabContent()}
            </motion.div>
          </AnimatePresence>
      </AppShell>

      {selectedGarantia ? (
        <VisualizacaoGarantia
          garantia={selectedGarantia}
          clientes={db.clientes}
          equipamentos={db.equipamentos}
          fotos={db.fotos}
          historicos={db.historicos}
          usuarios={db.usuarios}
          onClose={() => setSelectedGarantiaId(null)}
          onEdit={() => openEditWarranty(selectedGarantia)}
          onNotify={notify}
        />
      ) : null}
    </>
  );
}

export default function App() {
  return <FeedbackProvider><AppContent /></FeedbackProvider>;
}
