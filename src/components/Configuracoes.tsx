/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useId, useRef, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Database,
  Download,
  KeyRound,
  Loader2,
  Save,
  Settings,
  Shield,
  Trash2,
  User,
  UserCheck,
  UserMinus,
  UserPlus,
  Users,
  UserX,
  X,
  XCircle,
} from 'lucide-react';
import { DBState, FuncaoUsuario, Usuario } from '../types';
import {
  aprovarUsuario,
  atualizarUsuario,
  buscarEstadoCompleto,
  criarUsuario,
  excluirUsuario,
  recusarUsuario,
} from '../services/api';

type NotifyType = 'success' | 'error' | 'warning' | 'info';
type AdminTab = 'pending' | 'active' | 'inactive' | 'settings';
type NewUserErrors = Partial<Record<'nome' | 'email', string>>;

interface ConfiguracoesProps {
  db: DBState;
  onUpdateState: (newState: DBState) => void;
  currentUser: Usuario | null;
  onNotify?: (message: string, type?: NotifyType) => void;
}

type Confirmation = {
  title: string;
  description: string;
  confirmLabel: string;
  tone?: 'primary' | 'danger';
  action: () => Promise<boolean>;
};

const approvedStatus = (user: Usuario) => user.status || 'aprovado';
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const fileDate = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
};

export const Configuracoes: React.FC<ConfiguracoesProps> = ({
  db,
  onUpdateState,
  currentUser,
  onNotify,
}) => {
  const { usuarios } = db;
  const [activeTab, setActiveTab] = useState<AdminTab>('pending');
  const [newNome, setNewNome] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newFuncao, setNewFuncao] = useState<FuncaoUsuario>('usuario');
  const [newUserErrors, setNewUserErrors] = useState<NewUserErrors>({});
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [localNotice, setLocalNotice] = useState<{ message: string; type: NotifyType } | null>(null);
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);
  const [rejectTarget, setRejectTarget] = useState<Usuario | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [rejectError, setRejectError] = useState('');

  const isAdmin = currentUser?.funcao === 'admin';
  const pendingUsers = usuarios.filter((user) => approvedStatus(user) === 'pendente');
  const activeUsers = usuarios.filter((user) => approvedStatus(user) === 'aprovado' && user.ativo);
  const inactiveUsers = usuarios.filter((user) => approvedStatus(user) === 'recusado' || (approvedStatus(user) === 'aprovado' && !user.ativo));

  const notify = (message: string, type: NotifyType = 'info') => {
    if (onNotify) onNotify(message, type);
    else setLocalNotice({ message, type });
  };

  const refresh = async () => {
    const refreshed = await buscarEstadoCompleto(currentUser?.id || null);
    onUpdateState(refreshed);
  };

  const runMutation = async (key: string, operation: () => Promise<unknown>, successMessage: string) => {
    if (busyKey) return false;
    setBusyKey(key);
    try {
      await operation();
      await refresh();
      notify(successMessage, 'success');
      return true;
    } catch (error) {
      console.error(error);
      notify(error instanceof Error ? error.message : 'Não foi possível concluir a operação.', 'error');
      return false;
    } finally {
      setBusyKey(null);
    }
  };

  const askConfirmation = (options: Confirmation) => setConfirmation(options);

  const executeConfirmation = async () => {
    if (!confirmation || confirmBusy) return;
    setConfirmBusy(true);
    try {
      const completed = await confirmation.action();
      if (completed) setConfirmation(null);
    } finally {
      setConfirmBusy(false);
    }
  };

  const createDirectUser = async (nome: string, email: string, funcao: FuncaoUsuario) => {
    const created = await runMutation(
      'create-user',
      () => criarUsuario({ nome, email, funcao, ativo: true, status: 'aprovado' }),
      `Perfil de ${nome} cadastrado. O acesso só será possível depois que as credenciais forem vinculadas pelo cadastro.`,
    );
    if (created) {
      setNewNome('');
      setNewEmail('');
      setNewFuncao('usuario');
    }
    return created;
  };

  const handleAddUser = async (event: React.FormEvent) => {
    event.preventDefault();
    setNewUserErrors({});
    if (!isAdmin) {
      notify('Somente administradores podem cadastrar usuários.', 'error');
      return;
    }
    const nome = newNome.trim();
    const email = newEmail.trim().toLocaleLowerCase('pt-BR');
    const validation: NewUserErrors = {};
    if (!nome) validation.nome = 'Informe o nome completo.';
    if (!email) validation.email = 'Informe o e-mail.';
    else if (!EMAIL_PATTERN.test(email)) validation.email = 'Informe um e-mail válido.';
    if (Object.keys(validation).length) {
      setNewUserErrors(validation);
      return;
    }

    if (newFuncao === 'admin') {
      askConfirmation({
        title: 'Criar perfil administrador',
        description: `${nome} receberá permissões administrativas assim que as credenciais forem vinculadas. Confirme somente se esse nível de acesso for necessário.`,
        confirmLabel: 'Criar administrador',
        tone: 'danger',
        action: () => createDirectUser(nome, email, newFuncao),
      });
      return;
    }
    await createDirectUser(nome, email, newFuncao);
  };

  const requestApproval = (user: Usuario) => askConfirmation({
    title: 'Aprovar solicitação',
    description: `${user.nome} receberá acesso como usuário comum. Confirme após validar a identidade e o e-mail informado.`,
    confirmLabel: 'Aprovar acesso',
    action: () => runMutation(`approve-${user.id}`, () => aprovarUsuario(user.id, 'usuario'), `Cadastro de ${user.nome} aprovado.`),
  });

  const openRejectDialog = (user: Usuario) => {
    setRejectTarget(user);
    setRejectReason('');
    setRejectError('');
  };

  const submitRejection = async (event: React.FormEvent) => {
    event.preventDefault();
    const reason = rejectReason.trim();
    if (!rejectTarget) return;
    if (!reason) {
      setRejectError('O motivo da recusa é obrigatório.');
      return;
    }
    const target = rejectTarget;
    const rejected = await runMutation(`reject-${target.id}`, () => recusarUsuario(target.id, reason), `Cadastro de ${target.nome} recusado.`);
    if (rejected) {
      setRejectTarget(null);
      setRejectReason('');
    }
  };

  const requestToggleStatus = (user: Usuario) => {
    if (user.id === currentUser?.id) {
      notify('Você não pode desativar o próprio usuário da sessão atual.', 'warning');
      return;
    }
    const activate = !user.ativo;
    askConfirmation({
      title: activate ? 'Ativar usuário' : 'Desativar usuário',
      description: activate
        ? `${user.nome} voltará a acessar o sistema com a função atual.`
        : `${user.nome} perderá o acesso até ser ativado novamente. Os registros existentes serão preservados.`,
      confirmLabel: activate ? 'Ativar usuário' : 'Desativar usuário',
      tone: activate ? 'primary' : 'danger',
      action: () => runMutation(
        `${activate ? 'activate' : 'deactivate'}-${user.id}`,
        () => atualizarUsuario(user.id, { ativo: activate }),
        `${user.nome} foi ${activate ? 'ativado' : 'desativado'}.`,
      ),
    });
  };

  const requestToggleRole = (user: Usuario) => {
    if (user.id === currentUser?.id) {
      notify('Você não pode remover a própria permissão de administrador.', 'warning');
      return;
    }
    const newRole: FuncaoUsuario = user.funcao === 'admin' ? 'usuario' : 'admin';
    const promote = newRole === 'admin';
    askConfirmation({
      title: promote ? 'Promover a administrador' : 'Rebaixar para usuário comum',
      description: promote
        ? `${user.nome} poderá aprovar usuários, alterar permissões e administrar configurações.`
        : `${user.nome} deixará de acessar os controles administrativos.`,
      confirmLabel: promote ? 'Promover usuário' : 'Remover permissão',
      tone: promote ? 'primary' : 'danger',
      action: () => runMutation(
        `role-${user.id}`,
        () => atualizarUsuario(user.id, { funcao: newRole }),
        `${user.nome} agora é ${promote ? 'administrador' : 'usuário comum'}.`,
      ),
    });
  };

  const requestDelete = (user: Usuario) => {
    if (user.id === currentUser?.id) {
      notify('O usuário da sessão atual não pode ser excluído.', 'warning');
      return;
    }
    if (user.funcao === 'admin') {
      notify('Rebaixe o administrador para usuário comum antes de excluí-lo.', 'warning');
      return;
    }
    askConfirmation({
      title: 'Excluir usuário',
      description: `O perfil de ${user.nome} será removido permanentemente. A exclusão poderá falhar se houver garantias ou históricos vinculados.`,
      confirmLabel: 'Excluir permanentemente',
      tone: 'danger',
      action: () => runMutation(`delete-${user.id}`, () => excluirUsuario(user.id), `Usuário ${user.nome} excluído.`),
    });
  };

  const handleExportDB = () => {
    const blob = new Blob([JSON.stringify(db, null, 2)], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Backup-SSG-${fileDate()}.json`;
    document.body.appendChild(link);
    try {
      link.click();
      notify('Backup JSON gerado com os dados carregados nesta sessão.', 'success');
    } finally {
      link.remove();
      URL.revokeObjectURL(url);
    }
  };

  if (!isAdmin) {
    return (
      <section className="rounded-2xl border border-border bg-surface p-8 text-center shadow-sm">
        <Shield className="mx-auto h-10 w-10 text-text-muted" aria-hidden="true" />
        <h1 className="mt-3 text-lg font-semibold text-text-primary">Acesso restrito</h1>
        <p className="mt-1 text-sm text-text-secondary">Somente administradores podem gerenciar usuários e configurações.</p>
      </section>
    );
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-border bg-surface p-5 shadow-sm md:p-6">
        <p className="font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-primary">Controle de acesso</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-text-primary">Administração</h1>
        <p className="mt-1 max-w-2xl text-sm text-text-secondary">Aprove solicitações, gerencie permissões e mantenha uma cópia dos dados carregados.</p>
      </section>

      {localNotice && (
        <div className={`flex items-start justify-between gap-3 rounded-xl border px-4 py-3 text-xs ${
          localNotice.type === 'success' ? 'border-success/35 bg-success/10 text-success'
            : localNotice.type === 'error' ? 'border-danger/35 bg-danger/10 text-danger'
              : localNotice.type === 'warning' ? 'border-warning/35 bg-warning/10 text-warning'
                : 'border-information/35 bg-information/10 text-information'
        }`} role="status" aria-live="polite">
          <span>{localNotice.message}</span>
          <button type="button" onClick={() => setLocalNotice(null)} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary" aria-label="Fechar aviso"><X className="h-3.5 w-3.5" /></button>
        </div>
      )}

      <div className="overflow-x-auto border-b border-border" role="tablist" aria-label="Seções de administração">
        <div className="flex min-w-max gap-1">
          <AdminTabButton active={activeTab === 'pending'} onClick={() => setActiveTab('pending')} icon={<UserPlus className="h-4 w-4" />} label="Pendentes" count={pendingUsers.length} controls="admin-panel-pending" />
          <AdminTabButton active={activeTab === 'active'} onClick={() => setActiveTab('active')} icon={<UserCheck className="h-4 w-4" />} label="Ativos" count={activeUsers.length} controls="admin-panel-active" />
          <AdminTabButton active={activeTab === 'inactive'} onClick={() => setActiveTab('inactive')} icon={<UserX className="h-4 w-4" />} label="Inativos / recusados" count={inactiveUsers.length} controls="admin-panel-inactive" />
          <AdminTabButton active={activeTab === 'settings'} onClick={() => setActiveTab('settings')} icon={<Settings className="h-4 w-4" />} label="Configurações" controls="admin-panel-settings" />
        </div>
      </div>

      {activeTab === 'pending' && (
        <AdminPanel id="admin-panel-pending" title="Solicitações pendentes" description="Cadastros realizados na tela de acesso e que aguardam decisão administrativa." icon={<UserPlus className="h-5 w-5" />}>
          <UserListEmptyGuard users={pendingUsers} message="Nenhuma solicitação aguarda aprovação.">
            {pendingUsers.map((user) => (
              <UserCard key={user.id} user={user} currentUserId={currentUser?.id} busy={busyKey?.endsWith(user.id) === true}>
                <ActionButton onClick={() => requestApproval(user)} disabled={Boolean(busyKey)} icon={<CheckCircle2 className="h-3.5 w-3.5" />} label="Aprovar" tone="success" />
                <ActionButton onClick={() => openRejectDialog(user)} disabled={Boolean(busyKey)} icon={<XCircle className="h-3.5 w-3.5" />} label="Recusar" tone="danger" />
              </UserCard>
            ))}
          </UserListEmptyGuard>
        </AdminPanel>
      )}

      {activeTab === 'active' && (
        <AdminPanel id="admin-panel-active" title="Usuários ativos" description="Perfis aprovados com acesso liberado ao sistema." icon={<Users className="h-5 w-5" />}>
          <UserListEmptyGuard users={activeUsers} message="Nenhum usuário ativo encontrado.">
            {activeUsers.map((user) => {
              const isCurrent = user.id === currentUser?.id;
              return (
                <UserCard key={user.id} user={user} currentUserId={currentUser?.id} busy={busyKey?.endsWith(user.id) === true}>
                  {isCurrent ? (
                    <span className="inline-flex min-h-9 items-center rounded-lg border border-border px-3 text-[11px] text-text-muted">Sessão atual protegida</span>
                  ) : (
                    <>
                      <ActionButton onClick={() => requestToggleStatus(user)} disabled={Boolean(busyKey)} icon={<UserMinus className="h-3.5 w-3.5" />} label="Desativar" tone="danger" />
                      <ActionButton onClick={() => requestToggleRole(user)} disabled={Boolean(busyKey)} icon={<Shield className="h-3.5 w-3.5" />} label={user.funcao === 'admin' ? 'Rebaixar' : 'Promover'} tone="neutral" />
                      {user.funcao !== 'admin' && <ActionButton onClick={() => requestDelete(user)} disabled={Boolean(busyKey)} icon={<Trash2 className="h-3.5 w-3.5" />} label="Excluir" tone="danger" />}
                    </>
                  )}
                </UserCard>
              );
            })}
          </UserListEmptyGuard>
        </AdminPanel>
      )}

      {activeTab === 'inactive' && (
        <AdminPanel id="admin-panel-inactive" title="Inativos e recusados" description="Usuários sem acesso, separados visualmente pelo estado e motivo registrado." icon={<UserX className="h-5 w-5" />}>
          <UserListEmptyGuard users={inactiveUsers} message="Nenhum usuário inativo ou recusado.">
            {inactiveUsers.map((user) => (
              <UserCard key={user.id} user={user} currentUserId={currentUser?.id} busy={busyKey?.endsWith(user.id) === true}>
                {approvedStatus(user) === 'recusado' ? (
                  <ActionButton onClick={() => requestApproval(user)} disabled={Boolean(busyKey)} icon={<UserCheck className="h-3.5 w-3.5" />} label="Aprovar acesso" tone="success" />
                ) : (
                  <ActionButton onClick={() => requestToggleStatus(user)} disabled={Boolean(busyKey)} icon={<UserCheck className="h-3.5 w-3.5" />} label="Ativar" tone="success" />
                )}
                {user.funcao !== 'admin' && <ActionButton onClick={() => requestDelete(user)} disabled={Boolean(busyKey)} icon={<Trash2 className="h-3.5 w-3.5" />} label="Excluir" tone="danger" />}
              </UserCard>
            ))}
          </UserListEmptyGuard>
        </AdminPanel>
      )}

      {activeTab === 'settings' && (
        <div id="admin-panel-settings" role="tabpanel" className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <section className="rounded-2xl border border-border bg-surface p-5 shadow-sm">
            <div className="mb-5">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-text-primary"><UserPlus className="h-4 w-4 text-primary" aria-hidden="true" /> Cadastrar perfil diretamente</h2>
              <p className="mt-1 text-xs leading-relaxed text-text-muted">Este cadastro cria apenas o perfil aprovado. O usuário ainda precisa passar pelo fluxo de cadastro da tela de acesso para vincular credenciais de autenticação.</p>
            </div>
            <form onSubmit={handleAddUser} className="space-y-4" noValidate>
              <div>
                <label htmlFor="admin-user-name" className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.1em] text-text-muted">Nome completo</label>
                <input id="admin-user-name" value={newNome} onChange={(event) => { setNewNome(event.target.value); setNewUserErrors((current) => ({ ...current, nome: undefined })); }} autoComplete="name" className={FIELD_CLASS} aria-invalid={Boolean(newUserErrors.nome)} aria-describedby={newUserErrors.nome ? 'admin-user-name-error' : undefined} required />
                {newUserErrors.nome && <p id="admin-user-name-error" className="mt-1.5 text-xs text-danger" role="alert">{newUserErrors.nome}</p>}
              </div>
              <div>
                <label htmlFor="admin-user-email" className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.1em] text-text-muted">E-mail</label>
                <input id="admin-user-email" type="email" value={newEmail} onChange={(event) => { setNewEmail(event.target.value); setNewUserErrors((current) => ({ ...current, email: undefined })); }} autoComplete="email" className={FIELD_CLASS} aria-invalid={Boolean(newUserErrors.email)} aria-describedby={newUserErrors.email ? 'admin-user-email-error' : undefined} required />
                {newUserErrors.email && <p id="admin-user-email-error" className="mt-1.5 text-xs text-danger" role="alert">{newUserErrors.email}</p>}
              </div>
              <div>
                <label htmlFor="admin-user-role" className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.1em] text-text-muted">Função inicial</label>
                <select id="admin-user-role" value={newFuncao} onChange={(event) => setNewFuncao(event.target.value as FuncaoUsuario)} className={FIELD_CLASS}><option value="usuario">Usuário comum</option><option value="admin">Administrador</option></select>
              </div>
              <button type="submit" disabled={Boolean(busyKey)} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-white hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
                {busyKey === 'create-user' ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Save className="h-4 w-4" aria-hidden="true" />} Registrar perfil
              </button>
            </form>
          </section>

          <section className="rounded-2xl border border-border bg-surface p-5 shadow-sm">
            <div>
              <h2 className="flex items-center gap-2 text-sm font-semibold text-text-primary"><Database className="h-4 w-4 text-primary" aria-hidden="true" /> Dados e backup</h2>
              <p className="mt-1 text-xs text-text-muted">A exportação reflete o estado carregado nesta sessão. Nenhuma credencial ou arquivo `.env` é incluído.</p>
            </div>
            <div className="mt-5 space-y-3">
              <button type="button" onClick={handleExportDB} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-white hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"><Download className="h-4 w-4" aria-hidden="true" /> Baixar backup JSON</button>
              <button type="button" disabled className="flex min-h-12 w-full cursor-not-allowed items-center justify-center gap-2 rounded-xl border border-border bg-surface-elevated px-4 py-2 text-xs font-bold text-text-muted opacity-55" title="Importação indisponível para a base Supabase"><Database className="h-4 w-4" aria-hidden="true" /> Importar backup — indisponível</button>
              <button type="button" disabled className="flex min-h-12 w-full cursor-not-allowed items-center justify-center gap-2 rounded-xl border border-danger/25 bg-danger/5 px-4 py-2 text-xs font-bold text-danger opacity-55" title="Reset desativado para proteger os dados de homologação"><Trash2 className="h-4 w-4" aria-hidden="true" /> Resetar banco — indisponível</button>
            </div>
            <div className="mt-5 rounded-xl border border-warning/30 bg-warning/10 p-4 text-xs leading-relaxed text-warning"><strong>Proteção ativa:</strong> importação e reset permanecem desabilitados porque a fonte oficial é o Supabase.</div>
          </section>
        </div>
      )}

      {confirmation && (
        <AccessibleDialog title={confirmation.title} description={confirmation.description} onClose={() => !confirmBusy && setConfirmation(null)}>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button type="button" data-autofocus onClick={() => setConfirmation(null)} disabled={confirmBusy} className="min-h-11 rounded-xl border border-border-strong bg-surface-elevated px-4 py-2 text-xs font-bold text-text-secondary hover:bg-surface-hover disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">Cancelar</button>
            <button type="button" onClick={executeConfirmation} disabled={confirmBusy} className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 py-2 text-xs font-bold text-white disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 ${confirmation.tone === 'danger' ? 'bg-danger hover:bg-danger/85 focus-visible:ring-danger' : 'bg-primary hover:bg-primary-hover focus-visible:ring-primary'}`}>
              {confirmBusy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}{confirmation.confirmLabel}
            </button>
          </div>
        </AccessibleDialog>
      )}

      {rejectTarget && (
        <AccessibleDialog title="Recusar solicitação" description={`Informe por que o acesso de ${rejectTarget.nome} foi recusado. O motivo ficará visível no estado do cadastro.`} onClose={() => !busyKey && setRejectTarget(null)}>
          <form onSubmit={submitRejection} className="space-y-4">
            <div>
              <label htmlFor="reject-reason" className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.1em] text-text-muted">Motivo da recusa</label>
              <textarea id="reject-reason" data-autofocus value={rejectReason} onChange={(event) => { setRejectReason(event.target.value); setRejectError(''); }} rows={4} className={`${FIELD_CLASS} resize-y`} aria-describedby={rejectError ? 'reject-error' : undefined} aria-invalid={Boolean(rejectError)} placeholder="Descreva o motivo de forma objetiva" />
              {rejectError && <p id="reject-error" className="mt-2 text-xs text-danger" role="alert">{rejectError}</p>}
            </div>
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button type="button" onClick={() => setRejectTarget(null)} disabled={Boolean(busyKey)} className="min-h-11 rounded-xl border border-border-strong bg-surface-elevated px-4 py-2 text-xs font-bold text-text-secondary hover:bg-surface-hover disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">Cancelar</button>
              <button type="submit" disabled={Boolean(busyKey)} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-danger px-4 py-2 text-xs font-bold text-white hover:bg-danger/85 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger">
                {busyKey === `reject-${rejectTarget.id}` && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />} Confirmar recusa
              </button>
            </div>
          </form>
        </AccessibleDialog>
      )}
    </div>
  );
};

const FIELD_CLASS = 'min-h-11 w-full rounded-xl border border-border bg-surface-elevated px-3 py-2 text-xs text-text-primary placeholder:text-text-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30';

const AdminTabButton: React.FC<{ active: boolean; onClick: () => void; icon: React.ReactNode; label: string; count?: number; controls: string }> = ({ active, onClick, icon, label, count, controls }) => (
  <button type="button" role="tab" aria-selected={active} aria-controls={controls} onClick={onClick} className={`inline-flex min-h-12 items-center gap-2 border-b-2 px-4 py-2 text-xs font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${active ? 'border-primary text-primary' : 'border-transparent text-text-muted hover:bg-surface-hover hover:text-text-primary'}`}>
    {icon}<span>{label}</span>{count !== undefined && <span className={`rounded-full px-2 py-0.5 font-mono text-[10px] ${active ? 'bg-primary-soft text-primary' : 'bg-surface-elevated text-text-muted'}`}>{count}</span>}
  </button>
);

const AdminPanel: React.FC<{ id: string; title: string; description: string; icon: React.ReactNode; children: React.ReactNode }> = ({ id, title, description, icon, children }) => (
  <section id={id} role="tabpanel" className="overflow-hidden rounded-2xl border border-border bg-surface shadow-sm">
    <div className="flex items-start gap-3 border-b border-border p-5"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-primary/30 bg-primary-soft text-primary" aria-hidden="true">{icon}</span><div><h2 className="text-sm font-semibold text-text-primary">{title}</h2><p className="mt-1 text-xs text-text-muted">{description}</p></div></div>
    <div className="divide-y divide-border">{children}</div>
  </section>
);

const UserListEmptyGuard: React.FC<{ users: Usuario[]; message: string; children: React.ReactNode }> = ({ users, message, children }) => users.length ? <>{children}</> : (
  <div className="flex min-h-44 flex-col items-center justify-center gap-2 p-6 text-center"><Users className="h-8 w-8 text-text-muted" aria-hidden="true" /><p className="text-sm font-semibold text-text-secondary">{message}</p></div>
);

const UserCard: React.FC<{ user: Usuario; currentUserId?: string; busy: boolean; children: React.ReactNode }> = ({ user, currentUserId, busy, children }) => {
  const status = approvedStatus(user);
  const isRejected = status === 'recusado';
  const isPending = status === 'pendente';
  const statusLabel = isRejected ? 'Recusado' : isPending ? 'Pendente' : user.ativo ? 'Ativo' : 'Inativo';
  const statusTone = isRejected ? 'border-danger/30 bg-danger/10 text-danger' : isPending ? 'border-warning/30 bg-warning/10 text-warning' : user.ativo ? 'border-success/30 bg-success/10 text-success' : 'border-border-strong bg-surface-elevated text-text-muted';
  return (
    <article className="p-4 transition-colors hover:bg-surface-hover md:p-5">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border bg-surface-elevated text-text-secondary" aria-hidden="true">{user.funcao === 'admin' ? <Shield className="h-4 w-4" /> : <User className="h-4 w-4" />}</span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2"><h3 className="truncate text-sm font-semibold text-text-primary">{user.nome}</h3>{user.id === currentUserId && <span className="rounded-full bg-primary-soft px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-primary">Você</span>}</div>
            <p className="mt-1 truncate font-mono text-[11px] text-text-muted">{user.email}</p>
            <div className="mt-2 flex flex-wrap gap-2"><span className="rounded-full border border-border bg-surface-elevated px-2 py-1 text-[10px] font-bold text-text-secondary">{user.funcao === 'admin' ? 'Administrador' : 'Usuário comum'}</span><span className={`rounded-full border px-2 py-1 text-[10px] font-bold ${statusTone}`}>{statusLabel}</span>{!user.authUserId && <span className="inline-flex items-center gap-1 rounded-full border border-warning/25 bg-warning/10 px-2 py-1 text-[10px] font-bold text-warning"><KeyRound className="h-3 w-3" /> Sem credencial vinculada</span>}</div>
            {isRejected && <div className="mt-3 rounded-lg border border-danger/25 bg-danger/5 p-3 text-[11px] leading-relaxed text-text-secondary"><strong className="text-danger">Motivo da recusa:</strong> {user.motivoRecusa?.trim() || 'Motivo não informado.'}</div>}
          </div>
        </div>
        <div className="flex flex-wrap gap-2 xl:max-w-[46%] xl:justify-end">{busy && <span className="inline-flex min-h-9 items-center gap-2 px-2 text-[11px] text-text-muted"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Atualizando</span>}{children}</div>
      </div>
    </article>
  );
};

const ActionButton: React.FC<{ onClick: () => void; disabled?: boolean; icon: React.ReactNode; label: string; tone: 'success' | 'danger' | 'neutral' }> = ({ onClick, disabled, icon, label, tone }) => {
  const classes = tone === 'success' ? 'border-success/30 bg-success/10 text-success hover:bg-success/15' : tone === 'danger' ? 'border-danger/30 bg-danger/10 text-danger hover:bg-danger/15' : 'border-border-strong bg-surface-elevated text-text-secondary hover:bg-surface-active';
  return <button type="button" onClick={onClick} disabled={disabled} className={`inline-flex min-h-11 items-center justify-center gap-1.5 rounded-lg border px-3 py-1.5 text-[11px] font-bold disabled:cursor-not-allowed disabled:opacity-45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${classes}`}>{icon}{label}</button>;
};

const AccessibleDialog: React.FC<{ title: string; description: string; onClose: () => void; children: React.ReactNode }> = ({ title, description, onClose, children }) => {
  const titleId = useId();
  const descriptionId = useId();
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const panel = panelRef.current;
    const firstFocusable = panel?.querySelector<HTMLElement>('[data-autofocus], textarea, input, button:not([disabled]), select, [tabindex]:not([tabindex="-1"])');
    firstFocusable?.focus();
    return () => trigger?.focus();
  }, []);

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      onClose();
      return;
    }
    if (event.key !== 'Tab') return;
    const focusable = [...event.currentTarget.querySelectorAll<HTMLElement>('textarea, input, button:not([disabled]), select, [tabindex]:not([tabindex="-1"])')];
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div ref={panelRef} role="dialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={descriptionId} onKeyDown={handleKeyDown} className="w-full max-w-lg rounded-2xl border border-border-strong bg-surface p-5 shadow-2xl md:p-6">
        <div className="mb-5 flex items-start gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-warning/30 bg-warning/10 text-warning" aria-hidden="true"><AlertTriangle className="h-5 w-5" /></span><div className="min-w-0 flex-1"><h2 id={titleId} className="text-base font-semibold text-text-primary">{title}</h2><p id={descriptionId} className="mt-1 text-xs leading-relaxed text-text-secondary">{description}</p></div><button type="button" onClick={onClose} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-text-muted hover:bg-surface-hover hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary" aria-label="Fechar diálogo"><X className="h-4 w-4" /></button></div>
        {children}
      </div>
    </div>
  );
};
