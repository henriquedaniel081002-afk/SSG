/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { 
  ClipboardList, Plus, Search, Edit2, Trash2, Check, X, 
  Info, AlertTriangle, Calendar, User, UserCheck, ShieldAlert
} from 'lucide-react';
import { DBState, Garantia, StatusGarantia, Usuario } from '../types';
import { atualizarGarantia, buscarEstadoCompleto, criarCliente, criarEquipamento, criarGarantia, excluirGarantia } from '../services/api';

interface CadastroGarantiasProps {
  db: DBState;
  onUpdateState: (newState: DBState) => void;
  currentUser: Usuario | null;
  onSelectGarantia: (garantia: Garantia) => void;
}

export const CadastroGarantias: React.FC<CadastroGarantiasProps> = ({
  db,
  onUpdateState,
  currentUser,
  onSelectGarantia
}) => {
  const { garantias, clientes, equipamentos, usuarios } = db;

  // Search and Filter State
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('todos');
  const [responsavelFilter, setResponsavelFilter] = useState<string>('todos');
  const [dataInicioFilter, setDataInicioFilter] = useState('');
  const [dataFimFilter, setDataFimFilter] = useState('');

  // Form states
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingGarantiaId, setEditingGarantiaId] = useState<string | null>(null);

  // New/Edit warranty fields
  const [dataEntrada, setDataEntrada] = useState(new Date().toISOString().split('T')[0]);
  const [selectedClienteId, setSelectedClienteId] = useState('');
  const [selectedEquipamentoId, setSelectedEquipamentoId] = useState('');
  const [descricaoReclamacao, setDescricaoReclamacao] = useState('');
  const [responsavelId, setResponsavelId] = useState(currentUser?.id || '');
  const [status, setStatus] = useState<StatusGarantia>(StatusGarantia.RECEBIDO);
  const [observacoesGerais, setObservacoesGerais] = useState('');
  const [prazoDias, setPrazoDias] = useState(30);

  // Client subform state (if adding a new client)
  const [addNewClientMode, setAddNewClientMode] = useState(false);
  const [newClientNome, setNewClientNome] = useState('');
  const [newClientContato, setNewClientContato] = useState('');
  const [newClientTelefone, setNewClientTelefone] = useState('');
  const [newClientEmail, setNewClientEmail] = useState('');
  const [newClientCidade, setNewClientCidade] = useState('');
  const [newClientEstado, setNewClientEstado] = useState('');

  // Equipment subform state (if adding a new equipment)
  const [addNewEquipMode, setAddNewEquipMode] = useState(false);
  const [newEquipSerie, setNewEquipSerie] = useState('');
  const [newEquipModelo, setNewEquipModelo] = useState('');
  const [newEquipPotencia, setNewEquipPotencia] = useState('500 kVA');
  const [newEquipTensao, setNewEquipTensao] = useState('13.8 kV / 380 V');
  const [newEquipFabricacao, setNewEquipFabricacao] = useState('2025-01-01');
  const [newEquipVenda, setNewEquipVenda] = useState('2025-02-15');

  const isQueryOnly = false;

  // --- FILTERED WARRANTIES ---
  const filteredGarantias = garantias.filter(g => {
    const cli = clientes.find(c => c.id === g.clienteId);
    const eq = equipamentos.find(e => e.id === g.equipamentoId);
    const search = searchTerm.trim().toLowerCase();
    
    const matchesSearch = 
      !search ||
      g.id.toLowerCase().includes(search) ||
      (cli?.nome || '').toLowerCase().includes(search) ||
      (eq?.numeroSerie || '').toLowerCase().includes(search) ||
      (eq?.modelo || '').toLowerCase().includes(search);

    const matchesStatus = statusFilter === 'todos' || g.status === statusFilter;
    const matchesResponsavel = responsavelFilter === 'todos' || g.responsavelId === responsavelFilter;
    const matchesDataInicio = !dataInicioFilter || g.dataEntrada >= dataInicioFilter;
    const matchesDataFim = !dataFimFilter || g.dataEntrada <= dataFimFilter;

    return matchesSearch && matchesStatus && matchesResponsavel && matchesDataInicio && matchesDataFim;
  });

  // --- RESET FORMS ---
  const resetForm = () => {
    setEditingGarantiaId(null);
    setDataEntrada(new Date().toISOString().split('T')[0]);
    setSelectedClienteId('');
    setSelectedEquipamentoId('');
    setDescricaoReclamacao('');
    setResponsavelId(currentUser?.id || '');
    setStatus(StatusGarantia.RECEBIDO);
    setObservacoesGerais('');
    setPrazoDias(30);

    setAddNewClientMode(false);
    setNewClientNome('');
    setNewClientContato('');
    setNewClientTelefone('');
    setNewClientEmail('');
    setNewClientCidade('');
    setNewClientEstado('');

    setAddNewEquipMode(false);
    setNewEquipSerie('');
    setNewEquipModelo('');
    setNewEquipPotencia('500 kVA');
    setNewEquipTensao('13.8 kV / 380 V');
    setNewEquipFabricacao('2025-01-01');
    setNewEquipVenda('2025-02-15');
  };

  // --- OPEN FOR CREATION ---
  const handleOpenCreate = () => {
    resetForm();
    setIsFormOpen(true);
  };

  // --- OPEN FOR EDITING ---
  const handleOpenEdit = (garantia: Garantia) => {
    resetForm();
    setEditingGarantiaId(garantia.id);
    setDataEntrada(garantia.dataEntrada);
    setSelectedClienteId(garantia.clienteId);
    setSelectedEquipamentoId(garantia.equipamentoId);
    setDescricaoReclamacao(garantia.descricaoReclamacao);
    setResponsavelId(garantia.responsavelId);
    setStatus(garantia.status);
    setObservacoesGerais(garantia.observacoesGerais || '');
    setPrazoDias(garantia.prazoDias);

    setIsFormOpen(true);
  };

  // --- DELETE WARRANTY ---
  const handleDelete = async (id: string) => {
    if (isQueryOnly) return;
    if (!window.confirm('Realmente deseja excluir esta garantia?')) return;

    try {
      await excluirGarantia(id, currentUser?.id);
      const refreshed = await buscarEstadoCompleto(currentUser?.id);
      onUpdateState(refreshed);
      alert('Garantia excluída com sucesso.');
    } catch (error) {
      console.error(error);
      alert(error instanceof Error ? error.message : 'Erro ao excluir garantia.');
    }
  };

  // --- SAVE FORM ---
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isQueryOnly) return;

    try {
      let finalClienteId = selectedClienteId;
      let finalEquipamentoId = selectedEquipamentoId;

      if (addNewClientMode) {
        if (!newClientNome) {
          alert('Nome do Cliente é obrigatório.');
          return;
        }

        const novoCliente = await criarCliente({
          nome: newClientNome,
          contato: newClientContato,
          telefone: newClientTelefone,
          email: newClientEmail,
          cidade: newClientCidade,
          estado: newClientEstado
        });

        finalClienteId = novoCliente.id;
      }

      if (addNewEquipMode) {
        if (!newEquipSerie || !newEquipModelo) {
          alert('Número de Série e Modelo são obrigatórios.');
          return;
        }

        if (equipamentos.some(eq => eq.numeroSerie.trim().toUpperCase() === newEquipSerie.trim().toUpperCase())) {
          alert(`O número de série "${newEquipSerie}" já está cadastrado em outro transformador.`);
          return;
        }

        const novoEquipamento = await criarEquipamento({
          numeroSerie: newEquipSerie.trim().toUpperCase(),
          modelo: newEquipModelo,
          potencia: newEquipPotencia,
          tensao: newEquipTensao,
          dataFabricacao: newEquipFabricacao,
          dataVenda: newEquipVenda
        });

        finalEquipamentoId = novoEquipamento.id;
      }

      if (!finalClienteId) {
        alert('Selecione ou cadastre um cliente.');
        return;
      }

      if (!finalEquipamentoId) {
        alert('Selecione ou cadastre um transformador.');
        return;
      }

      if (!descricaoReclamacao) {
        alert('Por favor, informe a descrição da reclamação.');
        return;
      }

      const garantiaPayload = {
        dataEntrada,
        clienteId: finalClienteId,
        equipamentoId: finalEquipamentoId,
        descricaoReclamacao,
        responsavelId,
        status,
        observacoesGerais,
        prazoDias
      };

      if (editingGarantiaId) {
        await atualizarGarantia(editingGarantiaId, garantiaPayload);
      } else {
        await criarGarantia(garantiaPayload);
      }

      const refreshed = await buscarEstadoCompleto(currentUser?.id);
      onUpdateState(refreshed);

      setIsFormOpen(false);
      resetForm();
      alert(editingGarantiaId ? 'Garantia atualizada com sucesso.' : 'Garantia cadastrada com sucesso.');
    } catch (error) {
      console.error(error);
      alert(error instanceof Error ? error.message : 'Erro ao salvar garantia.');
    }
  };

  const getStatusColor = (status: StatusGarantia) => {
    switch (status) {
      case StatusGarantia.RECEBIDO: return 'bg-slate-100 text-slate-700 border-slate-200';
      case StatusGarantia.EM_ANALISE: return 'bg-blue-50 text-blue-700 border-blue-200';
      case StatusGarantia.AGUARDANDO_PECAS: return 'bg-indigo-50 text-indigo-700 border-indigo-200';
      case StatusGarantia.EM_REPARO: return 'bg-amber-50 text-amber-700 border-amber-200';
      case StatusGarantia.TESTE_FINAL: return 'bg-purple-50 text-purple-700 border-purple-200';
      case StatusGarantia.CONCLUIDO: return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case StatusGarantia.ENCERRADO: return 'bg-zinc-100 text-zinc-700 border-zinc-200';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Panel */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-brand-dark tracking-tight">Cadastro de Garantias</h1>
          <p className="text-sm text-slate-500 font-medium">Registro e modificação de transformadores, clientes e vistorias de garantia.</p>
        </div>
        
        {!isQueryOnly ? (
          <button
            onClick={handleOpenCreate}
            className="px-4 py-2 bg-brand-light text-white text-xs font-bold rounded-xl hover:bg-blue-600 transition-all flex items-center justify-center gap-1.5 shadow-md shadow-brand-light/15"
          >
            <Plus className="w-4 h-4" /> Nova Garantia
          </button>
        ) : (
          <div className="bg-amber-50 border border-amber-200 p-2.5 rounded-xl flex items-center gap-2 text-xs text-amber-700">
            <ShieldAlert className="w-4 h-4 shrink-0" />
            <span>Cadastro desabilitado para este usuário.</span>
          </div>
        )}
      </div>

      {/* SEARCH AND FILTERS PANEL */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
          <div className="relative md:col-span-8">
            <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
            <input
              type="text"
              placeholder="Pesquisar por código, cliente, nº de série ou modelo..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-light focus:bg-white transition-all"
            />
          </div>

          <div className="md:col-span-4 flex justify-end">
            <button
              type="button"
              onClick={() => {
                setSearchTerm('');
                setStatusFilter('todos');
                setResponsavelFilter('todos');
                setDataInicioFilter('');
                setDataFimFilter('');
              }}
              className="px-3 py-2 bg-slate-100 text-slate-600 text-[10px] font-bold rounded-lg hover:bg-slate-200 transition-all uppercase"
            >
              Limpar filtros
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
              Status
            </label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-light focus:bg-white"
            >
              <option value="todos">Todos os Status</option>
              {Object.values(StatusGarantia).map((status) => (
                <option key={status} value={status}>{status}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
              Responsável
            </label>
            <select
              value={responsavelFilter}
              onChange={(e) => setResponsavelFilter(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-light focus:bg-white"
            >
              <option value="todos">Todos os Responsáveis</option>
              {usuarios.map((u) => (
                <option key={u.id} value={u.id}>{u.nome}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
              Entrada de
            </label>
            <input
              type="date"
              value={dataInicioFilter}
              onChange={(e) => setDataInicioFilter(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-light focus:bg-white"
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
              Entrada até
            </label>
            <input
              type="date"
              value={dataFimFilter}
              onChange={(e) => setDataFimFilter(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-light focus:bg-white"
            />
          </div>
        </div>
      </div>

      {/* WARRANTIES TABLE LIST */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
            Registrados Encontrados ({filteredGarantias.length})
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/20 text-slate-400 font-bold uppercase text-[10px] tracking-wider">
                <th className="p-4">Código / O.S.</th>
                <th className="p-4">Cliente / Contato</th>
                <th className="p-4">Transformador</th>
                <th className="p-4 text-center">Prazo (Dias)</th>
                <th className="p-4">Responsável</th>
                <th className="p-4">Status</th>
                {!isQueryOnly && <th className="p-4 text-right">Ações</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredGarantias.map((g) => {
                const cli = clientes.find(c => c.id === g.clienteId);
                const eq = equipamentos.find(e => e.id === g.equipamentoId);
                const resp = usuarios.find(u => u.id === g.responsavelId);

                return (
                  <tr 
                    key={g.id} 
                    className="hover:bg-slate-50/60 transition-colors group cursor-pointer"
                    onClick={() => onSelectGarantia(g)}
                  >
                    {/* ID */}
                    <td className="p-4 font-mono">
                      <span className="font-bold text-slate-800 text-sm block group-hover:text-brand-light transition-colors">{g.id}</span>
                      <span className="text-[10px] text-slate-400">Entrada: {new Date(g.dataEntrada + 'T00:00:00').toLocaleDateString('pt-BR')}</span>
                    </td>
                    
                    {/* Cliente */}
                    <td className="p-4">
                      <div className="font-semibold text-slate-800">{cli ? cli.nome : 'Sem vínculo'}</div>
                      <div className="text-[10px] text-slate-400">{cli?.contato} • {cli?.cidade}-{cli?.estado}</div>
                    </td>

                    {/* Equipamento */}
                    <td className="p-4">
                      <div className="font-bold text-slate-700 font-mono text-[11px] bg-slate-100 px-1.5 py-0.5 rounded inline-block mb-1">
                        {eq?.numeroSerie}
                      </div>
                      <div className="text-slate-800 font-medium">{eq?.modelo.split(' (')[0]}</div>
                      <div className="text-[10px] text-slate-400 font-medium">{eq?.potencia} • {eq?.tensao}</div>
                    </td>

                    {/* Prazo */}
                    <td className="p-4 text-center font-mono font-bold text-slate-600">
                      {g.prazoDias} dias
                    </td>

                    {/* Responsável */}
                    <td className="p-4 text-slate-600 font-medium">
                      <div className="flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5 text-slate-400" />
                        {resp ? resp.nome : 'Não atribuído'}
                      </div>
                    </td>

                    {/* Status */}
                    <td className="p-4">
                      <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${getStatusColor(g.status)}`}>
                        {g.status}
                      </span>
                    </td>

                    {/* Actions */}
                    {!isQueryOnly && (
                      <td className="p-4 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleOpenEdit(g)}
                            className="p-1.5 hover:bg-slate-100 text-slate-500 hover:text-brand-light rounded-lg transition-all"
                            title="Editar Garantia"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDelete(g.id)}
                            className="p-1.5 hover:bg-rose-50 text-slate-500 hover:text-rose-600 rounded-lg transition-all"
                            title="Excluir Registro"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}

              {filteredGarantias.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-400 font-medium">
                    Nenhum registro de garantia corresponde aos filtros atuais.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* DIALOG FOR NEW/EDIT WARRANTY FORM */}
      {isFormOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 overflow-y-auto backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl w-full max-w-4xl shadow-2xl border border-slate-200 my-8 overflow-hidden">
            
            {/* Form Header */}
            <div className="bg-brand-dark text-white p-5 flex justify-between items-center">
              <div>
                <span className="text-[10px] bg-slate-800 text-sky-300 px-2.5 py-0.5 rounded font-mono font-bold uppercase tracking-wider">
                  {editingGarantiaId ? 'Ajuste de Registro' : 'Inclusão de Chamado'}
                </span>
                <h2 className="text-lg font-bold tracking-tight font-sans mt-0.5">
                  {editingGarantiaId ? `Editar Garantia: ${editingGarantiaId}` : 'Abrir Nova Garantia de Transformador'}
                </h2>
              </div>
              <button 
                onClick={() => setIsFormOpen(false)}
                className="p-2 hover:bg-slate-800 rounded-lg text-slate-300 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-6 space-y-6 max-h-[75vh] overflow-y-auto text-xs text-slate-700">
              
              {/* SECTION 1: DATAS E RESPONSÁVEL */}
              <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Data de Entrada *</label>
                  <input
                    type="date"
                    required
                    value={dataEntrada}
                    onChange={(e) => setDataEntrada(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg font-mono text-xs focus:outline-none focus:ring-2 focus:ring-brand-light"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Prazo de Solução (Dias)</label>
                  <input
                    type="number"
                    min={1}
                    required
                    value={prazoDias}
                    onChange={(e) => setPrazoDias(parseInt(e.target.value) || 30)}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg font-mono text-xs focus:outline-none focus:ring-2 focus:ring-brand-light"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Responsável pela Análise *</label>
                  <select
                    required
                    value={responsavelId}
                    onChange={(e) => setResponsavelId(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-medium focus:outline-none focus:ring-2 focus:ring-brand-light"
                  >
                    <option value="">Selecione o Responsável...</option>
                    {usuarios.filter(u => u.ativo && (u.status || 'aprovado') === 'aprovado').map((u) => (
                      <option key={u.id} value={u.id}>{u.nome} ({u.funcao === 'admin' ? 'Admin' : 'Usuário'})</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Status do Processo *</label>
                  <select
                    required
                    value={status}
                    onChange={(e) => setStatus(e.target.value as StatusGarantia)}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-brand-light"
                  >
                    {Object.values(StatusGarantia).map((st) => (
                      <option key={st} value={st}>{st}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* SECTION 2: CLIENTE */}
              <div className="border border-slate-200 rounded-xl p-4 space-y-4">
                <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                  <h3 className="font-bold text-slate-800 text-xs flex items-center gap-1.5 uppercase">
                    <User className="w-4 h-4 text-brand-light" /> Dados do Cliente Solicitante
                  </h3>
                  <button
                    type="button"
                    onClick={() => {
                      setAddNewClientMode(!addNewClientMode);
                      setSelectedClienteId('');
                    }}
                    className="text-[10px] font-bold text-brand-light hover:underline"
                  >
                    {addNewClientMode ? ' Selecionar Cliente Existente' : '➕ Cadastrar Novo Cliente'}
                  </button>
                </div>

                {!addNewClientMode ? (
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Escolher Cliente do Sistema *</label>
                    <select
                      value={selectedClienteId}
                      onChange={(e) => setSelectedClienteId(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium focus:outline-none focus:ring-2 focus:ring-brand-light"
                    >
                      <option value="">Selecione o Cliente na lista...</option>
                      {clientes.map((c) => (
                        <option key={c.id} value={c.id}>{c.nome} ({c.cidade} - {c.estado})</option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 animate-in fade-in duration-150">
                    <div className="sm:col-span-2">
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Razão Social / Nome Fantasia *</label>
                      <input
                        type="text"
                        placeholder="Nome Fantasia S/A"
                        value={newClientNome}
                        onChange={(e) => setNewClientNome(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Nome do Contato Principal</label>
                      <input
                        type="text"
                        placeholder="Eng. Responsável"
                        value={newClientContato}
                        onChange={(e) => setNewClientContato(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Telefone Celular</label>
                      <input
                        type="text"
                        placeholder="(00) 00000-0000"
                        value={newClientTelefone}
                        onChange={(e) => setNewClientTelefone(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">E-mail para Notificações</label>
                      <input
                        type="email"
                        placeholder="contato@cliente.com"
                        value={newClientEmail}
                        onChange={(e) => setNewClientEmail(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Cidade</label>
                        <input
                          type="text"
                          placeholder="Cidade"
                          value={newClientCidade}
                          onChange={(e) => setNewClientCidade(e.target.value)}
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Estado</label>
                        <input
                          type="text"
                          maxLength={2}
                          placeholder="UF"
                          value={newClientEstado}
                          onChange={(e) => setNewClientEstado(e.target.value.toUpperCase())}
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* SECTION 3: EQUIPAMENTO */}
              <div className="border border-slate-200 rounded-xl p-4 space-y-4">
                <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                  <h3 className="font-bold text-slate-800 text-xs flex items-center gap-1.5 uppercase">
                    <ClipboardList className="w-4 h-4 text-brand-light" /> Equipamento sob Análise
                  </h3>
                  <button
                    type="button"
                    onClick={() => {
                      setAddNewEquipMode(!addNewEquipMode);
                      setSelectedEquipamentoId('');
                    }}
                    className="text-[10px] font-bold text-brand-light hover:underline"
                  >
                    {addNewEquipMode ? ' Selecionar Equipamento Existente' : '➕ Cadastrar Novo Equipamento'}
                  </button>
                </div>

                {!addNewEquipMode ? (
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Escolher por Nº de Série cadastrado *</label>
                    <select
                      value={selectedEquipamentoId}
                      onChange={(e) => setSelectedEquipamentoId(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono focus:outline-none focus:ring-2 focus:ring-brand-light"
                    >
                      <option value="">Selecione o Transformador...</option>
                      {equipamentos.map((eq) => (
                        <option key={eq.id} value={eq.id}>{eq.numeroSerie} - {eq.modelo.split(' (')[0]} ({eq.potencia})</option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 animate-in fade-in duration-150">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Número de Série *</label>
                      <input
                        type="text"
                        placeholder="TR-2026-X1"
                        value={newEquipSerie}
                        onChange={(e) => setNewEquipSerie(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Modelo / Tipo *</label>
                      <input
                        type="text"
                        placeholder="TF-Seco-Pred (Modelo)"
                        value={newEquipModelo}
                        onChange={(e) => setNewEquipModelo(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Potência Nominal</label>
                      <input
                        type="text"
                        placeholder="500 kVA"
                        value={newEquipPotencia}
                        onChange={(e) => setNewEquipPotencia(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Tensão Nominal (kV/V)</label>
                      <input
                        type="text"
                        placeholder="13.8 kV / 380 V"
                        value={newEquipTensao}
                        onChange={(e) => setNewEquipTensao(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Data de Fabricação</label>
                      <input
                        type="date"
                        value={newEquipFabricacao}
                        onChange={(e) => setNewEquipFabricacao(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Data da Venda</label>
                      <input
                        type="date"
                        value={newEquipVenda}
                        onChange={(e) => setNewEquipVenda(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* SECTION 4: RECLAMAÇÃO E OBSERVACÕES */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Descrição da Reclamação (Defeito) *</label>
                    {/* Simple Quick templates to write faster */}
                    <div className="flex gap-1">
                      <button
                        type="button"
                        onClick={() => setDescricaoReclamacao("Bobina queimada com forte cheiro de verniz e alteração na relação.")}
                        className="bg-rose-50 text-rose-700 border border-rose-200 px-1.5 py-0.5 rounded text-[8px] font-bold hover:bg-rose-100"
                      >
                        ⚡ Bobina Queimada
                      </button>
                      <button
                        type="button"
                        onClick={() => setDescricaoReclamacao("Vazamento de óleo isolante verificado no visor de nível óptico.")}
                        className="bg-amber-50 text-amber-700 border border-amber-200 px-1.5 py-0.5 rounded text-[8px] font-bold hover:bg-amber-100"
                      >
                        💧 Vazamento de Óleo
                      </button>
                    </div>
                  </div>
                  <textarea
                    required
                    rows={4}
                    placeholder="Escreva detalhadamente o problema relatado pelo cliente em campo..."
                    value={descricaoReclamacao}
                    onChange={(e) => setDescricaoReclamacao(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-brand-light focus:bg-white"
                  />
                </div>

                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Observações Gerais / Resolução Técnica</label>
                    <div className="flex gap-1">
                      <button
                        type="button"
                        onClick={() => setObservacoesGerais("Bobina substituída por completo. Feito teste térmico e reaperto geral.")}
                        className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-1.5 py-0.5 rounded text-[8px] font-bold hover:bg-emerald-100"
                      >
                        🔧 Bobina Trocada
                      </button>
                      <button
                        type="button"
                        onClick={() => setObservacoesGerais("Substituição de juntas de vedação desgastadas por vedações novas. Estanqueidade validada.")}
                        className="bg-blue-50 text-blue-700 border border-blue-200 px-1.5 py-0.5 rounded text-[8px] font-bold hover:bg-blue-100"
                      >
                        ✔️ Junta Vedada
                      </button>
                    </div>
                  </div>
                  <textarea
                    rows={4}
                    placeholder="Registrar laudo técnico, componentes de reposição encomendados ou serviços efetuados..."
                    value={observacoesGerais}
                    onChange={(e) => setObservacoesGerais(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-brand-light focus:bg-white"
                  />
                </div>
              </div>

              {/* Form Buttons */}
              <div className="border-t border-slate-200 pt-4 flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-brand-light hover:bg-blue-600 text-white font-bold rounded-lg shadow-sm transition-colors"
                >
                  Salvar Registro
                </button>
              </div>

            </form>
          </div>
        </div>
      )}
    </div>
  );
};
