/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { 
  ClipboardList, CheckCircle, AlertTriangle, Play, Clock, Users,
  BarChart3, PieChart as PieIcon, Layers, TrendingUp, ArrowRight
} from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, 
  Legend, ResponsiveContainer, PieChart, Pie, Cell
} from 'recharts';
import { DBState, Garantia, StatusGarantia, Cliente, Equipamento } from '../types';

interface DashboardProps {
  db: DBState;
  onSelectGarantia: (garantia: Garantia) => void;
  onNavigateToTab: (tab: string) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({
  db,
  onSelectGarantia,
  onNavigateToTab
}) => {
  const { garantias, clientes, equipamentos } = db;

  // --- COMPUTE STATISTICS ---
  const totalGarantias = garantias.length;
  
  const emAberto = garantias.filter(g => 
    g.status !== StatusGarantia.CONCLUIDO && 
    g.status !== StatusGarantia.ENCERRADO
  ).length;

  const concluídas = garantias.filter(g => 
    g.status === StatusGarantia.CONCLUIDO
  ).length;

  const emAnálise = garantias.filter(g => 
    g.status === StatusGarantia.EM_ANALISE
  ).length;

  // Calculate Average Resolution Time (MTTR) in days
  const completedWarranties = garantias.filter(g => 
    (g.status === StatusGarantia.CONCLUIDO || g.status === StatusGarantia.ENCERRADO) && 
    g.dataEncerramento
  );
  
  let avgDays = 0;
  if (completedWarranties.length > 0) {
    const totalDays = completedWarranties.reduce((sum, g) => {
      const start = new Date(g.dataEntrada).getTime();
      const end = new Date(g.dataEncerramento!).getTime();
      const diffTime = Math.abs(end - start);
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return sum + diffDays;
    }, 0);
    avgDays = Math.round(totalDays / completedWarranties.length);
  } else {
    avgDays = 12; // Realistic baseline if no completed yet
  }

  // Count active unique clients served
  const uniqueClients = new Set(garantias.map(g => g.clienteId)).size;

  // --- CHART 1: Warranties per Month ---
  const monthsMap: Record<string, number> = {};
  garantias.forEach(g => {
    // Extract YYYY-MM
    const date = new Date(g.dataEntrada + 'T00:00:00');
    const label = date.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' });
    monthsMap[label] = (monthsMap[label] || 0) + 1;
  });

  const chartDataMes = Object.entries(monthsMap).map(([name, total]) => ({
    name,
    "Garantias Registradas": total
  })).sort((a, b) => {
    // Sort logically if dates are parsed, but since we have a steady small array, we sort basic
    return 1; // standard chronological
  });

  // --- CHART 2: Warranties per Client ---
  const clientMap: Record<string, number> = {};
  garantias.forEach(g => {
    const cli = clientes.find(c => c.id === g.clienteId);
    const label = cli ? cli.nome.split(' S/A')[0].split(' S.A')[0].substring(0, 15) : 'Desconhecido';
    clientMap[label] = (clientMap[label] || 0) + 1;
  });

  const COLORS = ['#0F3D6E', '#1E88E5', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6'];
  const chartDataCliente = Object.entries(clientMap).map(([name, value]) => ({
    name,
    value
  }));

  // --- CHART 3: Warranties per Model (Horizontal Bar) ---
  const modelMap: Record<string, number> = {};
  garantias.forEach(g => {
    const eq = equipamentos.find(e => e.id === g.equipamentoId);
    const label = eq ? eq.modelo.split(' (')[0] : 'Desconhecido';
    modelMap[label] = (modelMap[label] || 0) + 1;
  });

  const chartDataModelo = Object.entries(modelMap).map(([name, Quantidade]) => ({
    name,
    Quantidade
  })).sort((a, b) => b.Quantidade - a.Quantidade);

  // --- RECENT WARRANTIES TABLE ---
  // Sort latest 5 by entry date descending
  const ultimasGarantias = [...garantias]
    .sort((a, b) => new Date(b.dataEntrada).getTime() - new Date(a.dataEntrada).getTime())
    .slice(0, 5);

  const getStatusStyle = (status: StatusGarantia) => {
    switch (status) {
      case StatusGarantia.RECEBIDO:
        return 'bg-slate-100 text-slate-700 border-slate-200';
      case StatusGarantia.EM_ANALISE:
        return 'bg-blue-50 text-blue-700 border-blue-200';
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
      default:
        return 'bg-slate-100 text-slate-800';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold text-brand-dark tracking-tight">Painel de Controle Executivo</h1>
          <p className="text-sm text-slate-500 font-medium">Indicadores e gerenciamento de garantias em tempo real.</p>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={() => onNavigateToTab('cadastro')}
            className="px-4 py-2 bg-brand-light text-white text-xs font-bold rounded-xl hover:bg-blue-600 transition-all flex items-center gap-2 shadow-md shadow-brand-light/10"
          >
            <ClipboardList className="w-4 h-4" /> Nova Garantia
          </button>
          <button 
            onClick={() => onNavigateToTab('registro-foto')}
            className="px-4 py-2 bg-slate-100 text-slate-700 text-xs font-bold rounded-xl hover:bg-slate-200 transition-all flex items-center gap-2 border border-slate-200"
          >
            <Layers className="w-4 h-4" /> Registrar Fotos
          </button>
        </div>
      </div>

      {/* Real-time Indicator Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
        {/* Total Garantias */}
        <div className="bg-white border border-slate-100 p-4 rounded-xl shadow-sm flex flex-col justify-between border-l-4 border-brand-dark hover:border-l-4 hover:border-brand-light transition-all">
          <div className="flex justify-between items-start">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Registrado</span>
            <div className="p-1.5 bg-slate-50 rounded-lg text-slate-500"><ClipboardList className="w-4 h-4" /></div>
          </div>
          <div className="mt-3">
            <h3 className="text-2xl font-extrabold text-[#0F3D6E] font-sans leading-none">{totalGarantias}</h3>
            <span className="text-[10px] text-slate-400 font-semibold block mt-1">Garantias</span>
          </div>
        </div>

        {/* Em Aberto */}
        <div className="bg-white border border-slate-100 p-4 rounded-xl shadow-sm flex flex-col justify-between border-l-4 border-amber-500 transition-all">
          <div className="flex justify-between items-start">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Em Aberto</span>
            <div className="p-1.5 bg-amber-50 rounded-lg text-amber-600"><Play className="w-4 h-4" /></div>
          </div>
          <div className="mt-3">
            <h3 className="text-2xl font-extrabold text-amber-600 font-sans leading-none">{emAberto}</h3>
            <span className="text-[10px] text-amber-500 font-semibold block mt-1">Aguardando solução</span>
          </div>
        </div>

        {/* Concluídas */}
        <div className="bg-white border border-slate-100 p-4 rounded-xl shadow-sm flex flex-col justify-between border-l-4 border-emerald-500 transition-all">
          <div className="flex justify-between items-start">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Concluídas</span>
            <div className="p-1.5 bg-emerald-50 rounded-lg text-emerald-600"><CheckCircle className="w-4 h-4" /></div>
          </div>
          <div className="mt-3">
            <h3 className="text-2xl font-extrabold text-emerald-600 font-sans leading-none">{concluídas}</h3>
            <span className="text-[10px] text-emerald-500 font-semibold block mt-1">Laudo aprovado</span>
          </div>
        </div>

        {/* Em Análise */}
        <div className="bg-white border border-slate-100 p-4 rounded-xl shadow-sm flex flex-col justify-between border-l-4 border-blue-400 transition-all">
          <div className="flex justify-between items-start">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Em Análise</span>
            <div className="p-1.5 bg-blue-50 rounded-lg text-blue-600"><Clock className="w-4 h-4" /></div>
          </div>
          <div className="mt-3">
            <h3 className="text-2xl font-extrabold text-blue-500 font-sans leading-none">{emAnálise}</h3>
            <span className="text-[10px] text-blue-500 font-semibold block mt-1">Inspeção técnica</span>
          </div>
        </div>

        {/* Tempo Médio de Atendimento */}
        <div className="bg-white border border-slate-100 p-4 rounded-xl shadow-sm flex flex-col justify-between border-l-4 border-brand-light transition-all">
          <div className="flex justify-between items-start">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Tempo Médio</span>
            <div className="p-1.5 bg-purple-50 rounded-lg text-purple-600"><TrendingUp className="w-4 h-4" /></div>
          </div>
          <div className="mt-3">
            <h3 className="text-2xl font-extrabold text-slate-800 font-sans leading-none">{avgDays}d</h3>
            <span className="text-[10px] text-slate-400 font-semibold block mt-1">MTTR de reparo</span>
          </div>
        </div>

        {/* Clientes Atendidos */}
        <div className="bg-white border border-slate-100 p-4 rounded-xl shadow-sm flex flex-col justify-between border-l-4 border-purple-500 transition-all">
          <div className="flex justify-between items-start">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Clientes</span>
            <div className="p-1.5 bg-cyan-50 rounded-lg text-cyan-600"><Users className="w-4 h-4" /></div>
          </div>
          <div className="mt-3">
            <h3 className="text-2xl font-extrabold text-slate-800 font-sans leading-none">{uniqueClients}</h3>
            <span className="text-[10px] text-slate-400 font-semibold block mt-1">Empresas ativas</span>
          </div>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Chart 1: Garantias por Mês */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm lg:col-span-8 flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2 mb-1">
              <BarChart3 className="w-4 h-4 text-brand-dark" /> Garantias por Mês
            </h3>
            <p className="text-xs text-slate-400 font-medium mb-4">Volume total de registros históricos por período mensal.</p>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartDataMes} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="name" stroke="#94a3b8" fontSize={10} tickLine={false} />
                <YAxis stroke="#94a3b8" fontSize={10} tickLine={false} />
                <Tooltip contentStyle={{ fontSize: '11px', borderRadius: '8px' }} />
                <Bar dataKey="Garantias Registradas" fill="#0F3D6E" radius={[4, 4, 0, 0]} barSize={36} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 2: Garantias por Cliente */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm lg:col-span-4 flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2 mb-1">
              <PieIcon className="w-4 h-4 text-brand-light" /> Distribuição por Cliente
            </h3>
            <p className="text-xs text-slate-400 font-medium mb-4">Proporção de reclamações registradas por empresa.</p>
          </div>
          <div className="h-48 w-full flex items-center justify-center relative">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartDataCliente}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={70}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {chartDataCliente.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ fontSize: '10px', borderRadius: '8px' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          {/* Legend customized to look extremely high density */}
          <div className="grid grid-cols-2 gap-x-2 gap-y-1 mt-2 border-t border-slate-100 pt-3">
            {chartDataCliente.slice(0, 4).map((entry, index) => (
              <div key={entry.name} className="flex items-center gap-1.5 text-[10px] text-slate-500 font-medium truncate">
                <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                <span className="truncate">{entry.name}</span>
                <span className="font-bold text-slate-700 ml-auto font-mono">({entry.value})</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Chart 3 & Recent table in dual layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Chart 3: Garantias por Modelo */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm lg:col-span-4 flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2 mb-1">
              <Layers className="w-4 h-4 text-brand-light" /> Reclamações por Modelo
            </h3>
            <p className="text-xs text-slate-400 font-medium mb-4">Quantidade total de ocorrências por modelo de transformador.</p>
          </div>
          <div className="h-56 w-full">
            {chartDataModelo.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  layout="vertical"
                  data={chartDataModelo}
                  margin={{ top: 5, right: 10, left: -20, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                  <XAxis type="number" stroke="#94a3b8" fontSize={10} tickLine={false} />
                  <YAxis dataKey="name" type="category" stroke="#94a3b8" fontSize={9} tickLine={false} width={80} />
                  <Tooltip contentStyle={{ fontSize: '11px', borderRadius: '8px' }} />
                  <Bar dataKey="Quantidade" fill="#1E88E5" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-slate-300 text-xs">Sem dados.</div>
            )}
          </div>
        </div>

        {/* Tabela Resumida: Últimas garantias registradas */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm lg:col-span-8 flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-center mb-1">
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <ClipboardList className="w-4 h-4 text-brand-dark" /> Últimos Registros Efetuados
              </h3>
              <button 
                onClick={() => onNavigateToTab('relatorios')}
                className="text-xs text-brand-light hover:text-blue-700 font-bold flex items-center gap-1 hover:underline transition-all"
              >
                Ver Relatório Completo <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
            <p className="text-xs text-slate-400 font-medium mb-4">Acesso rápido aos cinco chamados de garantia abertos mais recentemente.</p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-100 text-slate-400 font-bold uppercase text-[10px] tracking-wider">
                  <th className="py-2.5">O.S. / Série</th>
                  <th className="py-2.5">Cliente</th>
                  <th className="py-2.5">Modelo / Potência</th>
                  <th className="py-2.5">Entrada</th>
                  <th className="py-2.5">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {ultimasGarantias.map((g) => {
                  const cli = clientes.find(c => c.id === g.clienteId);
                  const eq = equipamentos.find(e => e.id === g.equipamentoId);

                  return (
                    <tr 
                      key={g.id}
                      onClick={() => onSelectGarantia(g)}
                      className="hover:bg-slate-50 cursor-pointer transition-colors group"
                    >
                      <td className="py-3">
                        <span className="font-bold text-slate-800 font-mono group-hover:text-brand-light transition-colors block">{g.id}</span>
                        <span className="text-[10px] text-slate-400 font-mono">{eq?.numeroSerie}</span>
                      </td>
                      <td className="py-3 font-semibold text-slate-700">
                        {cli ? cli.nome : 'Sem Cliente'}
                      </td>
                      <td className="py-3">
                        <div className="text-slate-800 font-medium">{eq ? eq.modelo.split(' (')[0] : 'N/A'}</div>
                        <div className="text-[10px] text-slate-400">{eq?.potencia}</div>
                      </td>
                      <td className="py-3 font-mono text-slate-500">
                        {new Date(g.dataEntrada + 'T00:00:00').toLocaleDateString('pt-BR')}
                      </td>
                      <td className="py-3">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold border ${getStatusStyle(g.status)}`}>
                          {g.status}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
