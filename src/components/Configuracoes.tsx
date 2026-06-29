import React, { useState } from 'react';
import { Users, Shield, User, Database, Trash2, Download, Upload, Save, CheckCircle, XCircle } from 'lucide-react';
import { DBState, FuncaoUsuario, Usuario } from '../types';
import { aprovarUsuario, atualizarUsuario, buscarEstadoCompleto, criarUsuario, excluirUsuario, recusarUsuario } from '../services/api';

interface ConfiguracoesProps {
  db: DBState;
  onUpdateState: (newState: DBState) => void;
  currentUser: Usuario | null;
}

export const Configuracoes: React.FC<ConfiguracoesProps> = ({ db, onUpdateState, currentUser }) => {
  const { usuarios } = db;
  const [activeTab, setActiveTab] = useState<'usuarios' | 'database'>('usuarios');
  const [newNome, setNewNome] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newFuncao, setNewFuncao] = useState<FuncaoUsuario>('usuario');

  const isAdmin = currentUser?.funcao === 'admin';
  const pendentes = usuarios.filter((u) => (u.status || 'aprovado') === 'pendente');
  const demaisUsuarios = usuarios.filter((u) => (u.status || 'aprovado') !== 'pendente');

  const refresh = async () => {
    const refreshed = await buscarEstadoCompleto(currentUser?.id);
    onUpdateState(refreshed);
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return alert('Apenas administradores podem adicionar novos usuários.');
    if (!newNome || !newEmail) return alert('Nome e e-mail são obrigatórios.');

    try {
      await criarUsuario({ nome: newNome, email: newEmail, funcao: newFuncao, ativo: true, status: 'aprovado' });
      await refresh();
      setNewNome('');
      setNewEmail('');
      setNewFuncao('usuario');
      alert(`Usuário "${newNome}" cadastrado com sucesso.`);
    } catch (error) {
      console.error(error);
      alert(error instanceof Error ? error.message : 'Erro ao cadastrar usuário.');
    }
  };

  const handleApprove = async (user: Usuario) => {
    if (!isAdmin) return alert('Apenas administradores podem aprovar usuários.');

    try {
      await aprovarUsuario(user.id, 'usuario');
      await refresh();
      alert(`Cadastro de ${user.nome} aprovado como usuário comum.`);
    } catch (error) {
      console.error(error);
      alert(error instanceof Error ? error.message : 'Erro ao aprovar cadastro.');
    }
  };

  const handleReject = async (user: Usuario) => {
    if (!isAdmin) return alert('Apenas administradores podem recusar usuários.');
    const motivo = window.prompt(`Motivo da recusa para ${user.nome}:`, 'Cadastro não autorizado.');
    if (motivo === null) return;

    try {
      await recusarUsuario(user.id, motivo);
      await refresh();
      alert(`Cadastro de ${user.nome} recusado.`);
    } catch (error) {
      console.error(error);
      alert(error instanceof Error ? error.message : 'Erro ao recusar cadastro.');
    }
  };

  const handleToggleUserStatus = async (userId: string) => {
    if (!isAdmin) return alert('Apenas administradores podem suspender ou ativar usuários.');
    if (userId === currentUser?.id) return alert('Você não pode desativar seu próprio usuário logado.');
    const user = usuarios.find((u) => u.id === userId);
    if (!user) return;

    try {
      await atualizarUsuario(userId, { ativo: !user.ativo });
      await refresh();
    } catch (error) {
      console.error(error);
      alert(error instanceof Error ? error.message : 'Erro ao alterar status do usuário.');
    }
  };

  const handleToggleAdmin = async (user: Usuario) => {
    if (!isAdmin) return alert('Apenas administradores podem alterar permissões.');
    if (user.id === currentUser?.id) return alert('Você não pode remover sua própria permissão de administrador.');

    const novaFuncao: FuncaoUsuario = user.funcao === 'admin' ? 'usuario' : 'admin';
    const label = novaFuncao === 'admin' ? 'tornar administrador' : 'remover administrador';
    if (!window.confirm(`Deseja ${label} de "${user.nome}"?`)) return;

    try {
      await atualizarUsuario(user.id, { funcao: novaFuncao });
      await refresh();
    } catch (error) {
      console.error(error);
      alert(error instanceof Error ? error.message : 'Erro ao alterar permissão do usuário.');
    }
  };

  const handleDeleteUser = async (userId: string, userNome: string) => {
    if (!isAdmin) return alert('Apenas administradores podem excluir colaboradores.');
    if (!window.confirm(`Realmente deseja excluir o usuário "${userNome}"?`)) return;

    try {
      await excluirUsuario(userId);
      await refresh();
      alert(`Usuário "${userNome}" excluído com sucesso.`);
    } catch (error) {
      console.error(error);
      alert(error instanceof Error ? error.message : 'Erro ao excluir usuário.');
    }
  };

  const handleExportDB = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(db, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `Backup-SGG-Database-${new Date().toISOString().split('T')[0]}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    document.body.removeChild(downloadAnchor);
  };

  const handleImportDB = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.target.value = '';
    alert('Importação direta de JSON está desativada porque a base principal está no Supabase.');
  };

  const roleIcon = (role: string) => role === 'admin' ? <Shield className="w-4 h-4" /> : <User className="w-4 h-4" />;
  const roleLabel = (role: string) => role === 'admin' ? 'Administrador' : 'Usuário';

  if (!isAdmin) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8 text-center space-y-2">
        <Shield className="w-10 h-10 text-slate-300 mx-auto" />
        <h1 className="text-lg font-bold text-slate-800">Acesso restrito</h1>
        <p className="text-sm text-slate-500">Somente administradores podem gerenciar usuários.</p>
      </div>
    );
  }

  const renderUserTable = (lista: Usuario[], showPendingActions = false) => (
    <div className="overflow-x-auto border border-slate-100 rounded-xl">
      <table className="w-full text-xs text-left">
        <thead className="bg-slate-50 text-slate-400 uppercase tracking-wider font-bold">
          <tr>
            <th className="px-3 py-3">Nome</th>
            <th className="px-3 py-3">E-mail</th>
            <th className="px-3 py-3">Tipo</th>
            <th className="px-3 py-3">Status</th>
            <th className="px-3 py-3 text-right">Ações</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {lista.length === 0 ? (
            <tr><td colSpan={5} className="px-3 py-8 text-center text-slate-400 font-semibold">Nenhum registro encontrado.</td></tr>
          ) : lista.map((usr) => (
            <tr key={usr.id} className="hover:bg-slate-50/70">
              <td className="px-3 py-3 font-semibold text-slate-800">{usr.nome}</td>
              <td className="px-3 py-3 text-slate-500 font-mono text-[11px]">{usr.email}</td>
              <td className="px-3 py-3">
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-700">
                  {roleIcon(usr.funcao)} {roleLabel(usr.funcao)}
                </span>
              </td>
              <td className="px-3 py-3">
                <span className={`inline-flex items-center gap-1 text-[10px] font-bold ${usr.status === 'recusado' ? 'text-rose-600' : usr.ativo ? 'text-emerald-600' : 'text-amber-600'}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${usr.status === 'recusado' ? 'bg-rose-600' : usr.ativo ? 'bg-emerald-600' : 'bg-amber-500'}`} />
                  {usr.status === 'pendente' ? 'Pendente' : usr.status === 'recusado' ? 'Recusado' : usr.ativo ? 'Ativo' : 'Suspenso'}
                </span>
              </td>
              <td className="px-3 py-3 text-right">
                {showPendingActions ? (
                  <div className="flex justify-end gap-1.5">
                    <button onClick={() => handleApprove(usr)} className="px-2 py-1 bg-emerald-50 text-emerald-700 border border-emerald-100 rounded text-[10px] font-bold flex items-center gap-1 hover:bg-emerald-100"><CheckCircle className="w-3 h-3" /> Aprovar</button>
                    <button onClick={() => handleReject(usr)} className="px-2 py-1 bg-rose-50 text-rose-700 border border-rose-100 rounded text-[10px] font-bold flex items-center gap-1 hover:bg-rose-100"><XCircle className="w-3 h-3" /> Recusar</button>
                  </div>
                ) : usr.id !== currentUser?.id ? (
                  <div className="flex justify-end gap-1.5 flex-wrap">
                    <button onClick={() => handleToggleUserStatus(usr.id)} className={`px-2 py-1 rounded text-[10px] font-bold border ${usr.ativo ? 'bg-rose-50 text-rose-700 border-rose-100' : 'bg-emerald-50 text-emerald-700 border-emerald-100'}`}>{usr.ativo ? 'Suspender' : 'Ativar'}</button>
                    <button onClick={() => handleToggleAdmin(usr)} className="px-2 py-1 bg-green-950/60 text-green-400 border border-green-700/60 rounded text-[10px] font-bold">{usr.funcao === 'admin' ? 'Remover ADM' : 'Tornar ADM'}</button>
                    {usr.funcao !== 'admin' && <button onClick={() => handleDeleteUser(usr.id, usr.nome)} className="px-2 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded text-[10px] font-bold flex items-center gap-0.5"><Trash2 className="w-3 h-3" /> Excluir</button>}
                  </div>
                ) : <span className="text-[10px] text-slate-300 italic">Usuário atual</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <h1 className="text-2xl font-bold text-brand-dark tracking-tight">Administração</h1>
        <p className="text-sm text-slate-500 font-medium">Aprovação de cadastros e definição de administradores.</p>
      </div>

      <div className="flex border-b border-slate-200 gap-2">
        <button onClick={() => setActiveTab('usuarios')} className={`px-4 py-2 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 ${activeTab === 'usuarios' ? 'border-brand-light text-brand-light font-extrabold' : 'border-transparent text-slate-400 hover:text-slate-600'}`}><Users className="w-4 h-4" /> Usuários</button>
        <button onClick={() => setActiveTab('database')} className={`px-4 py-2 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 ${activeTab === 'database' ? 'border-brand-light text-brand-light font-extrabold' : 'border-transparent text-slate-400 hover:text-slate-600'}`}><Database className="w-4 h-4" /> Banco de Dados & Backup</button>
      </div>

      {activeTab === 'usuarios' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-8 bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-6">
            <div>
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2 mb-1"><Users className="w-4.5 h-4.5 text-brand-dark" /> Solicitações Pendentes</h3>
              <p className="text-xs text-slate-400 font-medium">Cadastros feitos pela tela de login aguardando aprovação administrativa.</p>
            </div>
            {renderUserTable(pendentes, true)}

            <div className="pt-2">
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2 mb-1"><Shield className="w-4.5 h-4.5 text-brand-dark" /> Usuários Cadastrados</h3>
              <p className="text-xs text-slate-400 font-medium mb-3">Existem somente dois tipos: usuário comum e administrador.</p>
              {renderUserTable(demaisUsuarios)}
            </div>

            <form onSubmit={handleAddUser} className="border-t border-slate-100 pt-5 space-y-3.5">
              <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Cadastrar usuário diretamente como aprovado</h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <input required placeholder="Nome completo" value={newNome} onChange={(e) => setNewNome(e.target.value)} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs" />
                <input type="email" required placeholder="email@empresa.com" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs" />
                <select value={newFuncao} onChange={(e) => setNewFuncao(e.target.value as FuncaoUsuario)} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold">
                  <option value="usuario">Usuário</option>
                  <option value="admin">Administrador</option>
                </select>
              </div>
              <button type="submit" className="px-4 py-1.5 bg-brand-light text-white text-xs font-bold rounded-lg hover:bg-green-700 transition-colors shadow-sm flex items-center gap-1"><Save className="w-4 h-4" /> Registrar Usuário</button>
            </form>
          </div>

          <div className="lg:col-span-4 bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2"><Shield className="w-4.5 h-4.5 text-brand-light" /> Regra de Acesso</h3>
            <div className="space-y-3 text-[11px] text-slate-600 leading-relaxed">
              <div className="border rounded-xl p-4 bg-emerald-50 border-emerald-200"><strong>Usuário comum:</strong> acessa o sistema de garantias normalmente, mas não gerencia usuários.</div>
              <div className="border rounded-xl p-4 bg-green-950/60 border-green-700/60"><strong>Administrador:</strong> acessa o sistema e também aprova, recusa e promove usuários.</div>
              <div className="border rounded-xl p-4 bg-amber-50 border-amber-200"><strong>Pendente:</strong> usuário se cadastrou, mas ainda não entra no sistema.</div>
              <div className="border rounded-xl p-4 bg-rose-50 border-rose-200"><strong>Recusado:</strong> acesso negado. O usuário não consegue entrar.</div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'database' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-6 max-w-3xl">
          <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2"><Database className="w-4.5 h-4.5 text-brand-dark" /> Ferramentas de Manutenção do Banco de Dados</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="border border-slate-200 rounded-xl p-4 flex flex-col justify-between space-y-3 bg-slate-50/55">
              <span className="text-xs font-bold text-slate-700 block">Exportar Banco de Dados</span>
              <button onClick={handleExportDB} className="w-full px-4 py-2 bg-brand-dark text-white font-bold rounded-lg hover:bg-slate-800 text-xs flex items-center justify-center gap-1.5"><Download className="w-4 h-4" /> Baixar Backup (.json)</button>
            </div>
            <div className="border border-slate-200 rounded-xl p-4 flex flex-col justify-between space-y-3 bg-slate-50/55">
              <span className="text-xs font-bold text-slate-700 block">Restaurar de arquivo backup</span>
              <label className="w-full px-4 py-2 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 font-bold rounded-lg cursor-pointer text-xs flex items-center justify-center gap-1.5"><Upload className="w-4 h-4" /> Selecionar Arquivo JSON<input type="file" accept=".json" className="hidden" onChange={handleImportDB} /></label>
            </div>
          </div>
          <div className="border-t border-slate-100 pt-6 space-y-4">
            <span className="text-xs font-bold text-rose-700 flex items-center gap-1.5 uppercase">⚠️ Zona de Risco</span>
            <button onClick={() => alert('Reset desativado para evitar apagar dados reais do Supabase.')} className="px-4 py-2.5 bg-rose-600 text-white font-bold rounded-lg hover:bg-rose-700 text-xs flex items-center gap-1.5"><Trash2 className="w-4 h-4" /> Resetar Banco de Dados de Fábrica</button>
          </div>
        </div>
      )}
    </div>
  );
};
