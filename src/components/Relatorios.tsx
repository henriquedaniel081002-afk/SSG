/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { 
  FileSpreadsheet, FileText, Search, Filter, Calendar, 
  ChevronRight, Printer, RefreshCw, Sparkles, User, HelpCircle, Eye
} from 'lucide-react';
import { DBState, Garantia, StatusGarantia, Cliente, Equipamento, Usuario } from '../types';

interface RelatoriosProps {
  db: DBState;
  onSelectGarantia: (garantia: Garantia) => void;
}

export const Relatorios: React.FC<RelatoriosProps> = ({
  db,
  onSelectGarantia
}) => {
  const { garantias, clientes, equipamentos, usuarios } = db;

  // Filter States
  const [filterSerial, setFilterSerial] = useState('');
  const [filterCliente, setFilterCliente] = useState('');
  const [filterModelo, setFilterModelo] = useState('');
  const [filterPotencia, setFilterPotencia] = useState('');
  const [filterStatus, setFilterStatus] = useState('todos');
  const [filterResponsavel, setFilterResponsavel] = useState('todos');
  const [filterDataInicio, setFilterDataInicio] = useState('');
  const [filterDataFim, setFilterDataFim] = useState('');

  // --- FILTER CORE LOGIC ---
  const filteredRecords = garantias.filter(g => {
    const cli = clientes.find(c => c.id === g.clienteId);
    const eq = equipamentos.find(e => e.id === g.equipamentoId);

    const matchSerial = !filterSerial || (eq && eq.numeroSerie.toLowerCase().includes(filterSerial.toLowerCase()));
    const matchCliente = !filterCliente || (cli && cli.nome.toLowerCase().includes(filterCliente.toLowerCase()));
    const matchModelo = !filterModelo || (eq && eq.modelo.toLowerCase().includes(filterModelo.toLowerCase()));
    const matchPotencia = !filterPotencia || (eq && eq.potencia.toLowerCase().includes(filterPotencia.toLowerCase()));
    const matchStatus = filterStatus === 'todos' || g.status === filterStatus;
    const matchResponsavel = filterResponsavel === 'todos' || g.responsavelId === filterResponsavel;

    let matchDates = true;
    if (filterDataInicio) {
      matchDates = matchDates && new Date(g.dataEntrada).getTime() >= new Date(filterDataInicio).getTime();
    }
    if (filterDataFim) {
      matchDates = matchDates && new Date(g.dataEntrada).getTime() <= new Date(filterDataFim).getTime();
    }

    return matchSerial && matchCliente && matchModelo && matchPotencia && matchStatus && matchResponsavel && matchDates;
  });

  // --- EXPORT TO EXCEL (CSV UTF-8 with BOM) ---
  const handleExportExcel = () => {
    if (filteredRecords.length === 0) {
      alert("Nenhum registro para exportar.");
      return;
    }

    // CSV Header
    let csvContent = "\uFEFF"; // BOM for Excel Portuguese encoding (UTF-8)
    csvContent += "Nº O.S.;Data de Entrada;Cliente;Contato;Cidade;Estado;Número de Série;Modelo;Potência;Tensão;Fabricação;Venda;Reclamação;Status;Técnico;Data de Fechamento;Observações\n";

    // Build Rows
    filteredRecords.forEach(g => {
      const cli = clientes.find(c => c.id === g.clienteId);
      const eq = equipamentos.find(e => e.id === g.equipamentoId);
      const resp = usuarios.find(u => u.id === g.responsavelId);

      const row = [
        g.id,
        g.dataEntrada,
        cli ? cli.nome.replace(/;/g, ',') : '',
        cli ? cli.contato.replace(/;/g, ',') : '',
        cli ? cli.cidade : '',
        cli ? cli.estado : '',
        eq ? eq.numeroSerie : '',
        eq ? eq.modelo.replace(/;/g, ',') : '',
        eq ? eq.potencia : '',
        eq ? eq.tensao : '',
        eq ? eq.dataFabricacao : '',
        eq ? eq.dataVenda : '',
        g.descricaoReclamacao.replace(/\n/g, ' ').replace(/;/g, ','),
        g.status,
        resp ? resp.nome : '',
        g.dataEncerramento || '',
        g.observacoesGerais.replace(/\n/g, ' ').replace(/;/g, ',')
      ].join(';');

      csvContent += row + "\n";
    });

    // Create Download Link
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Relatório-Garantias-Transformadores-${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // --- EXPORT TO PDF (Uses window.print styled for reports) ---
  const handleExportPDF = () => {
    window.print();
  };

  // --- RESET FILTERS ---
  const handleClearFilters = () => {
    setFilterSerial('');
    setFilterCliente('');
    setFilterModelo('');
    setFilterPotencia('');
    setFilterStatus('todos');
    setFilterResponsavel('todos');
    setFilterDataInicio('');
    setFilterDataFim('');
  };

  const getStatusBadge = (status: StatusGarantia) => {
    switch (status) {
      case StatusGarantia.RECEBIDO:
        return 'bg-slate-100 text-slate-700 border-slate-200';
      case StatusGarantia.EM_ANALISE:
        return 'bg-green-950/60 text-green-400 border-green-700/60';
      case StatusGarantia.AGUARDANDO_PECAS:
        return 'bg-indigo-50 text-indigo-700 border-indigo-200';
      case StatusGarantia.EM_REPARO:
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case StatusGarantia.TESTE_FINAL:
        return 'bg-purple-50 text-purple-700 border-purple-200';
      case StatusGarantia.CONCLUIDO:
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case StatusGarantia.ENCERRADO:
        return 'bg-zinc-100 text-zinc-700 border-zinc-200';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header with Export buttons */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-brand-dark tracking-tight">Relatórios de Garantias</h1>
          <p className="text-sm text-slate-500 font-medium font-sans">Consulta estruturada e exportação de dados para análise de conformidade técnica.</p>
        </div>
        
        <div className="flex items-center gap-2">
          <button
            onClick={handleExportExcel}
            className="px-4 py-2 bg-emerald-600 text-white text-xs font-bold rounded-xl hover:bg-emerald-700 transition-all flex items-center gap-1.5 shadow-md shadow-emerald-600/10"
          >
            <FileSpreadsheet className="w-4 h-4" /> Exportar Excel
          </button>
          <button
            onClick={handleExportPDF}
            className="px-4 py-2 bg-slate-800 text-white text-xs font-bold rounded-xl hover:bg-slate-900 transition-all flex items-center gap-1.5 shadow-md"
          >
            <Printer className="w-4 h-4" /> Gerar PDF (Imprimir)
          </button>
        </div>
      </div>

      {/* FILTER CONTROLS GRID */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
          <Filter className="w-4 h-4 text-brand-light" /> Parâmetros de Filtragem Avançada
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs font-medium text-slate-600">
          {/* Col 1: Serial */}
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Nº de Série</label>
            <input
              type="text"
              placeholder="Ex: TR-2024-501"
              value={filterSerial}
              onChange={(e) => setFilterSerial(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-light font-mono"
            />
          </div>

          {/* Col 2: Cliente */}
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Cliente Solicitante</label>
            <input
              type="text"
              placeholder="Razão Social"
              value={filterCliente}
              onChange={(e) => setFilterCliente(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-light"
            />
          </div>

          {/* Col 3: Modelo */}
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Modelo do Transformador</label>
            <input
              type="text"
              placeholder="Ex: TF-Tri-Dist"
              value={filterModelo}
              onChange={(e) => setFilterModelo(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-light"
            />
          </div>

          {/* Col 4: Potência */}
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Potência Nominal</label>
            <input
              type="text"
              placeholder="Ex: 500 kVA"
              value={filterPotencia}
              onChange={(e) => setFilterPotencia(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-light font-mono"
            />
          </div>

          {/* Col 5: Status */}
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Status da Garantia</label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-light font-semibold"
            >
              <option value="todos">Todos os Status</option>
              {Object.values(StatusGarantia).map((st) => (
                <option key={st} value={st}>{st}</option>
              ))}
            </select>
          </div>

          {/* Col 6: Técnico Responsável */}
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Responsável</label>
            <select
              value={filterResponsavel}
              onChange={(e) => setFilterResponsavel(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-light"
            >
              <option value="todos">Todos os Responsáveis</option>
              {usuarios.filter(u => u.ativo && (u.status || 'aprovado') === 'aprovado').map((u) => (
                <option key={u.id} value={u.id}>{u.nome}</option>
              ))}
            </select>
          </div>

          {/* Col 7: Data Inicial */}
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Data Inicial (Entrada)</label>
            <input
              type="date"
              value={filterDataInicio}
              onChange={(e) => setFilterDataInicio(e.target.value)}
              className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-light font-mono"
            />
          </div>

          {/* Col 8: Data Final */}
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Data Final (Entrada)</label>
            <input
              type="date"
              value={filterDataFim}
              onChange={(e) => setFilterDataFim(e.target.value)}
              className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-light font-mono"
            />
          </div>
        </div>

        {/* Action filter buttons */}
        <div className="flex justify-end pt-2">
          <button
            type="button"
            onClick={handleClearFilters}
            className="px-4 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg text-xs transition-colors"
          >
            Limpar Todos os Filtros
          </button>
        </div>
      </div>

      {/* SEARCH RESULT GRID */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
            Laudos Técnicos Encontrados ({filteredRecords.length})
          </span>
          <div className="text-[10px] text-slate-400 italic">
            Clique na linha para visualizar a Linha do Tempo e Fotos completas.
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-100 text-slate-400 font-bold uppercase text-[10px] tracking-wider">
                <th className="p-4">CÓDIGO O.S.</th>
                <th className="p-4">CLIENTE SOLICITANTE</th>
                <th className="p-4">EQUIPAMENTO (SÉRIE)</th>
                <th className="p-4">POTÊNCIA / TENSÃO</th>
                <th className="p-4 text-center">DATA ENTRADA</th>
                <th className="p-4">TÉCNICO</th>
                <th className="p-4">STATUS</th>
                <th className="p-4 text-center">VISUALIZAR</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredRecords.map((g) => {
                const cli = clientes.find(c => c.id === g.clienteId);
                const eq = equipamentos.find(e => e.id === g.equipamentoId);
                const resp = usuarios.find(u => u.id === g.responsavelId);

                return (
                  <tr
                    key={g.id}
                    onClick={() => onSelectGarantia(g)}
                    className="hover:bg-slate-50/80 cursor-pointer transition-colors group"
                  >
                    {/* OS Code */}
                    <td className="p-4 font-mono">
                      <span className="font-bold text-slate-800 text-sm block group-hover:text-brand-light transition-colors">
                        {g.id}
                      </span>
                    </td>

                    {/* Client name & state */}
                    <td className="p-4">
                      <div className="font-semibold text-slate-800">{cli ? cli.nome : 'Sem Cliente'}</div>
                      <div className="text-[10px] text-slate-400 font-medium">{cli?.contato} • {cli?.cidade}-{cli?.estado}</div>
                    </td>

                    {/* Equipment details */}
                    <td className="p-4">
                      <div className="font-bold text-slate-700 font-mono text-[11px] bg-slate-100 px-1.5 py-0.2 rounded inline-block mb-1">
                        {eq?.numeroSerie}
                      </div>
                      <div className="text-slate-500 font-normal">{eq?.modelo.split(' (')[0]}</div>
                    </td>

                    {/* Power rating */}
                    <td className="p-4">
                      <div className="font-medium text-slate-800">{eq?.potencia}</div>
                      <div className="text-[10px] text-slate-400 font-mono">{eq?.tensao}</div>
                    </td>

                    {/* Entry Date */}
                    <td className="p-4 text-center font-mono text-slate-500 font-semibold">
                      {new Date(g.dataEntrada + 'T00:00:00').toLocaleDateString('pt-BR')}
                    </td>

                    {/* Technician */}
                    <td className="p-4 text-slate-600 font-semibold">
                      {resp ? resp.nome : 'N/A'}
                    </td>

                    {/* Status */}
                    <td className="p-4">
                      <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${getStatusBadge(g.status)}`}>
                        {g.status}
                      </span>
                    </td>

                    {/* Eye icon visual button */}
                    <td className="p-4 text-center">
                      <div className="inline-flex p-1.5 bg-slate-50 rounded-lg group-hover:bg-brand-light group-hover:text-white text-slate-400 transition-all shadow-xs">
                        <Eye className="w-3.5 h-3.5" />
                      </div>
                    </td>
                  </tr>
                );
              })}

              {filteredRecords.length === 0 && (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-slate-400 font-medium">
                    Nenhum laudo encontrado com as definições de filtro selecionadas.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
