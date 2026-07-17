/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Eye,
  FileSpreadsheet,
  Filter,
  Printer,
  SearchX,
  X,
} from 'lucide-react';
import { DBState, Garantia, StatusGarantia } from '../types';

type NotifyType = 'success' | 'error' | 'warning' | 'info';

interface RelatoriosProps {
  db: DBState;
  onSelectGarantia: (garantia: Garantia) => void;
  onNotify?: (message: string, type?: NotifyType) => void;
}

type Filters = {
  serial: string;
  cliente: string;
  modelo: string;
  potencia: string;
  status: string;
  responsavel: string;
  dataInicio: string;
  dataFim: string;
};

type FilterKey = keyof Filters;

const EMPTY_FILTERS: Filters = {
  serial: '',
  cliente: '',
  modelo: '',
  potencia: '',
  status: 'todos',
  responsavel: 'todos',
  dataInicio: '',
  dataFim: '',
};

const PAGE_SIZE = 10;

const formatCalendarDate = (value?: string) => {
  if (!value) return '—';
  const [year, month, day] = value.slice(0, 10).split('-').map(Number);
  if (!year || !month || !day) return value;
  return new Date(year, month - 1, day).toLocaleDateString('pt-BR');
};

const fileDate = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const csvCell = (value: unknown) => {
  const normalized = String(value ?? '').replace(/\r?\n/g, ' ').trim();
  return `"${normalized.replace(/"/g, '""')}"`;
};

const statusTone = (status: StatusGarantia) => {
  switch (status) {
    case StatusGarantia.RECEBIDO:
      return 'border-border-strong bg-surface-elevated text-text-secondary';
    case StatusGarantia.EM_ANALISE:
      return 'border-information/35 bg-information/10 text-information';
    case StatusGarantia.AGUARDANDO_PECAS:
      return 'border-warning/35 bg-warning/10 text-warning';
    case StatusGarantia.EM_REPARO:
      return 'border-primary/35 bg-primary-soft text-primary';
    case StatusGarantia.TESTE_FINAL:
      return 'border-information/35 bg-information/10 text-information';
    case StatusGarantia.CONCLUIDO:
      return 'border-success/35 bg-success/10 text-success';
    case StatusGarantia.ENCERRADO:
      return 'border-border-strong bg-surface-active text-text-muted';
    default:
      return 'border-border bg-surface-elevated text-text-secondary';
  }
};

export const Relatorios: React.FC<RelatoriosProps> = ({ db, onSelectGarantia, onNotify }) => {
  const { garantias, clientes, equipamentos, usuarios } = db;
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [page, setPage] = useState(1);
  const [localNotice, setLocalNotice] = useState<{ message: string; type: NotifyType } | null>(null);

  const notify = (message: string, type: NotifyType = 'info') => {
    if (onNotify) onNotify(message, type);
    else setLocalNotice({ message, type });
  };

  const setFilter = (key: FilterKey, value: string) => {
    setFilters((current) => ({ ...current, [key]: value }));
  };

  useEffect(() => {
    setPage(1);
  }, [filters]);

  const filteredRecords = useMemo(() => garantias.filter((garantia) => {
    const cliente = clientes.find((item) => item.id === garantia.clienteId);
    const equipamento = equipamentos.find((item) => item.id === garantia.equipamentoId);
    const normalizedSerial = filters.serial.trim().toLocaleLowerCase('pt-BR');
    const normalizedClient = filters.cliente.trim().toLocaleLowerCase('pt-BR');
    const normalizedModel = filters.modelo.trim().toLocaleLowerCase('pt-BR');
    const normalizedPower = filters.potencia.trim().toLocaleLowerCase('pt-BR');

    return (
      (!normalizedSerial || equipamento?.numeroSerie.toLocaleLowerCase('pt-BR').includes(normalizedSerial))
      && (!normalizedClient || cliente?.nome.toLocaleLowerCase('pt-BR').includes(normalizedClient))
      && (!normalizedModel || equipamento?.modelo.toLocaleLowerCase('pt-BR').includes(normalizedModel))
      && (!normalizedPower || equipamento?.potencia.toLocaleLowerCase('pt-BR').includes(normalizedPower))
      && (filters.status === 'todos' || garantia.status === filters.status)
      && (filters.responsavel === 'todos' || garantia.responsavelId === filters.responsavel)
      && (!filters.dataInicio || garantia.dataEntrada >= filters.dataInicio)
      && (!filters.dataFim || garantia.dataEntrada <= filters.dataFim)
    );
  }), [clientes, equipamentos, filters, garantias]);

  const totalPages = Math.max(1, Math.ceil(filteredRecords.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageRecords = filteredRecords.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const activeFilters = useMemo(() => {
    const statusLabel = filters.status === 'todos' ? '' : filters.status;
    const responsibleLabel = filters.responsavel === 'todos'
      ? ''
      : usuarios.find((item) => item.id === filters.responsavel)?.nome || filters.responsavel;
    return [
      { key: 'serial' as FilterKey, label: 'Série', value: filters.serial },
      { key: 'cliente' as FilterKey, label: 'Cliente', value: filters.cliente },
      { key: 'modelo' as FilterKey, label: 'Modelo', value: filters.modelo },
      { key: 'potencia' as FilterKey, label: 'Potência', value: filters.potencia },
      { key: 'status' as FilterKey, label: 'Status', value: statusLabel },
      { key: 'responsavel' as FilterKey, label: 'Responsável', value: responsibleLabel },
      { key: 'dataInicio' as FilterKey, label: 'Desde', value: filters.dataInicio ? formatCalendarDate(filters.dataInicio) : '' },
      { key: 'dataFim' as FilterKey, label: 'Até', value: filters.dataFim ? formatCalendarDate(filters.dataFim) : '' },
    ].filter((item) => item.value);
  }, [filters, usuarios]);

  const clearFilter = (key: FilterKey) => {
    setFilter(key, key === 'status' || key === 'responsavel' ? 'todos' : '');
  };

  const handleExportCsv = () => {
    if (!filteredRecords.length) {
      notify('Nenhum registro corresponde aos filtros atuais.', 'warning');
      return;
    }

    const headers = [
      'Nº O.S.', 'Data de Entrada', 'Cliente', 'Contato', 'Cidade', 'Estado',
      'Número de Série', 'Modelo', 'Potência', 'Tensão', 'Fabricação', 'Venda',
      'Reclamação', 'Status', 'Técnico', 'Data de Fechamento', 'Observações',
    ];
    const rows = filteredRecords.map((garantia) => {
      const cliente = clientes.find((item) => item.id === garantia.clienteId);
      const equipamento = equipamentos.find((item) => item.id === garantia.equipamentoId);
      const responsavel = usuarios.find((item) => item.id === garantia.responsavelId);
      return [
        garantia.id,
        garantia.dataEntrada,
        cliente?.nome,
        cliente?.contato,
        cliente?.cidade,
        cliente?.estado,
        equipamento?.numeroSerie,
        equipamento?.modelo,
        equipamento?.potencia,
        equipamento?.tensao,
        equipamento?.dataFabricacao,
        equipamento?.dataVenda,
        garantia.descricaoReclamacao,
        garantia.status,
        responsavel?.nome,
        garantia.dataEncerramento,
        garantia.observacoesGerais,
      ].map(csvCell).join(';');
    });
    const csvContent = `\uFEFF${headers.map(csvCell).join(';')}\r\n${rows.join('\r\n')}\r\n`;
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Relatorio-Garantias-Transformadores-${fileDate()}.csv`;
    document.body.appendChild(link);
    try {
      link.click();
      notify(`${filteredRecords.length} registro(s) exportado(s) em CSV.`, 'success');
    } finally {
      link.remove();
      URL.revokeObjectURL(url);
    }
  };

  const handlePrint = () => {
    const printClass = 'ssg-printing-report';
    const cleanup = () => document.body.classList.remove(printClass);
    document.body.classList.add(printClass);
    window.addEventListener('afterprint', cleanup, { once: true });
    window.print();
    window.setTimeout(cleanup, 60_000);
  };

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-border bg-surface p-5 shadow-sm md:p-6 print:hidden">
        <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-primary">Análise e conformidade</p>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight text-text-primary">Relatórios de garantias</h1>
            <p className="mt-1 max-w-2xl text-sm text-text-secondary">Consulte os registros com oito filtros combináveis e exporte o conjunto completo filtrado.</p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <button type="button" onClick={handleExportCsv} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-white transition-colors hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
              <FileSpreadsheet className="h-4 w-4" aria-hidden="true" /> Exportar CSV
            </button>
            <button type="button" onClick={handlePrint} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-border-strong bg-surface-elevated px-4 py-2 text-xs font-bold text-text-primary transition-colors hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
              <Printer className="h-4 w-4" aria-hidden="true" /> Imprimir / PDF
            </button>
          </div>
        </div>
      </section>

      {localNotice && (
        <div className={`flex items-start justify-between gap-3 rounded-xl border px-4 py-3 text-xs print:hidden ${
          localNotice.type === 'success' ? 'border-success/35 bg-success/10 text-success'
            : localNotice.type === 'error' ? 'border-danger/35 bg-danger/10 text-danger'
              : localNotice.type === 'warning' ? 'border-warning/35 bg-warning/10 text-warning'
                : 'border-information/35 bg-information/10 text-information'
        }`} role="status" aria-live="polite">
          <span>{localNotice.message}</span>
          <button type="button" onClick={() => setLocalNotice(null)} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary" aria-label="Fechar aviso"><X className="h-3.5 w-3.5" /></button>
        </div>
      )}

      <section className="space-y-4 rounded-2xl border border-border bg-surface p-5 shadow-sm print:hidden" aria-labelledby="filter-title">
        <div className="flex items-center justify-between gap-3">
          <h2 id="filter-title" className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.12em] text-text-secondary"><Filter className="h-4 w-4 text-primary" aria-hidden="true" /> Filtros avançados</h2>
          {activeFilters.length > 0 && <span className="font-mono text-[10px] text-text-muted">{activeFilters.length} ativo(s)</span>}
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <FilterInput id="report-serial" label="Nº de série" placeholder="Ex.: TR-2024-501" value={filters.serial} onChange={(value) => setFilter('serial', value)} mono />
          <FilterInput id="report-client" label="Cliente solicitante" placeholder="Razão social" value={filters.cliente} onChange={(value) => setFilter('cliente', value)} />
          <FilterInput id="report-model" label="Modelo" placeholder="Modelo do transformador" value={filters.modelo} onChange={(value) => setFilter('modelo', value)} />
          <FilterInput id="report-power" label="Potência nominal" placeholder="Ex.: 500 kVA" value={filters.potencia} onChange={(value) => setFilter('potencia', value)} mono />
          <FilterSelect id="report-status" label="Status" value={filters.status} onChange={(value) => setFilter('status', value)}>
            <option value="todos">Todos os status</option>
            {Object.values(StatusGarantia).map((status) => <option key={status} value={status}>{status}</option>)}
          </FilterSelect>
          <FilterSelect id="report-owner" label="Responsável" value={filters.responsavel} onChange={(value) => setFilter('responsavel', value)}>
            <option value="todos">Todos os responsáveis</option>
            {usuarios.filter((usuario) => usuario.ativo && (usuario.status || 'aprovado') === 'aprovado').map((usuario) => <option key={usuario.id} value={usuario.id}>{usuario.nome}</option>)}
          </FilterSelect>
          <FilterInput id="report-start" label="Data inicial" type="date" value={filters.dataInicio} onChange={(value) => setFilter('dataInicio', value)} mono />
          <FilterInput id="report-end" label="Data final" type="date" value={filters.dataFim} onChange={(value) => setFilter('dataFim', value)} mono />
        </div>

        <div className="flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap gap-2" aria-label="Filtros ativos">
            {activeFilters.map((filter) => (
              <button key={filter.key} type="button" onClick={() => clearFilter(filter.key)} className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-primary/30 bg-primary-soft px-3 py-1 text-[11px] font-semibold text-primary hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary" aria-label={`Remover filtro ${filter.label}: ${filter.value}`}>
                <span>{filter.label}: {filter.value}</span><X className="h-3 w-3" aria-hidden="true" />
              </button>
            ))}
            {!activeFilters.length && <span className="text-xs text-text-muted">Nenhum filtro aplicado.</span>}
          </div>
          <button type="button" onClick={() => setFilters(EMPTY_FILTERS)} disabled={!activeFilters.length} className="min-h-11 shrink-0 rounded-xl border border-border-strong bg-surface-elevated px-4 py-2 text-xs font-bold text-text-secondary hover:bg-surface-hover disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">Limpar filtros</button>
        </div>
      </section>

      <section id="relatorio-impressao" className="overflow-hidden rounded-2xl border border-border bg-surface shadow-sm">
        <div className="report-print-header hidden border-b border-border p-5">
          <h1>Relatório de garantias — ITAM</h1>
          <p>Emitido em {new Date().toLocaleString('pt-BR')} · {filteredRecords.length} registro(s)</p>
        </div>
        <div className="flex flex-col gap-2 border-b border-border bg-surface-elevated px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xs font-bold uppercase tracking-[0.12em] text-text-secondary">Registros encontrados</h2>
            <p className="mt-1 font-mono text-[10px] text-text-muted">{filteredRecords.length} resultado(s) · página {currentPage} de {totalPages}</p>
          </div>
          <p className="text-[11px] text-text-muted print:hidden">Selecione um registro para abrir o detalhe completo.</p>
        </div>

        <div className="report-screen-content">
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full border-collapse text-left text-xs">
              <thead><ReportHead /></thead>
              <tbody className="divide-y divide-border">
                {pageRecords.map((garantia) => <ReportRow key={garantia.id} garantia={garantia} db={db} onSelect={() => onSelectGarantia(garantia)} />)}
              </tbody>
            </table>
          </div>

          <div className="divide-y divide-border md:hidden">
            {pageRecords.map((garantia) => {
              const cliente = clientes.find((item) => item.id === garantia.clienteId);
              const equipamento = equipamentos.find((item) => item.id === garantia.equipamentoId);
              const responsavel = usuarios.find((item) => item.id === garantia.responsavelId);
              return (
                <button key={garantia.id} type="button" onClick={() => onSelectGarantia(garantia)} className="block min-h-28 w-full p-4 text-left hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary">
                  <div className="flex items-start justify-between gap-3">
                    <div><p className="font-mono text-sm font-bold text-text-primary">{garantia.id}</p><p className="mt-1 text-xs font-semibold text-text-secondary">{cliente?.nome || 'Cliente não localizado'}</p></div>
                    <span className={`rounded-full border px-2 py-1 text-[10px] font-bold ${statusTone(garantia.status)}`}>{garantia.status}</span>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] text-text-muted">
                    <span>Série: <strong className="font-mono text-text-secondary">{equipamento?.numeroSerie || '—'}</strong></span>
                    <span>Entrada: <strong className="font-mono text-text-secondary">{formatCalendarDate(garantia.dataEntrada)}</strong></span>
                    <span className="col-span-2">Responsável: <strong className="text-text-secondary">{responsavel?.nome || 'Não localizado'}</strong></span>
                  </div>
                </button>
              );
            })}
          </div>

          {!pageRecords.length && <EmptyReport />}
          <Pagination currentPage={currentPage} totalPages={totalPages} totalRecords={filteredRecords.length} onPage={setPage} />
        </div>

        <div className="report-print-table hidden overflow-visible">
          <table className="w-full border-collapse text-left text-[9px]">
            <thead><ReportHead /></thead>
            <tbody>
              {filteredRecords.map((garantia) => <PrintReportRow key={garantia.id} garantia={garantia} db={db} />)}
            </tbody>
          </table>
          {!filteredRecords.length && <EmptyReport />}
        </div>
      </section>
    </div>
  );
};

const FIELD_CLASS = 'min-h-11 w-full rounded-xl border border-border bg-surface-elevated px-3 py-2 text-xs text-text-primary placeholder:text-text-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30';

const FilterInput: React.FC<{
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
  mono?: boolean;
}> = ({ id, label, value, onChange, placeholder, type = 'text', mono }) => (
  <div>
    <label htmlFor={id} className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.1em] text-text-muted">{label}</label>
    <input id={id} type={type} value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} className={`${FIELD_CLASS} ${mono ? 'font-mono' : ''}`} />
  </div>
);

const FilterSelect: React.FC<{
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
}> = ({ id, label, value, onChange, children }) => (
  <div>
    <label htmlFor={id} className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.1em] text-text-muted">{label}</label>
    <select id={id} value={value} onChange={(event) => onChange(event.target.value)} className={FIELD_CLASS}>{children}</select>
  </div>
);

const ReportHead = () => (
  <tr className="border-b border-border bg-surface-elevated text-[10px] font-bold uppercase tracking-[0.08em] text-text-muted">
    <th className="p-4">Código O.S.</th><th className="p-4">Cliente</th><th className="p-4">Equipamento</th><th className="p-4">Potência / tensão</th><th className="p-4">Entrada</th><th className="p-4">Responsável</th><th className="p-4">Status</th><th className="p-4 print:hidden"><span className="sr-only">Abrir</span></th>
  </tr>
);

const ReportRow: React.FC<{ garantia: Garantia; db: DBState; onSelect: () => void }> = ({ garantia, db, onSelect }) => {
  const cliente = db.clientes.find((item) => item.id === garantia.clienteId);
  const equipamento = db.equipamentos.find((item) => item.id === garantia.equipamentoId);
  const responsavel = db.usuarios.find((item) => item.id === garantia.responsavelId);
  return (
    <tr className="group hover:bg-surface-hover">
      <td className="p-4 font-mono text-sm font-bold text-text-primary">{garantia.id}</td>
      <td className="p-4"><p className="font-semibold text-text-primary">{cliente?.nome || 'Cliente não localizado'}</p><p className="mt-1 text-[10px] text-text-muted">{cliente ? `${cliente.contato || 'Sem contato'} · ${cliente.cidade || '—'}-${cliente.estado || '—'}` : '—'}</p></td>
      <td className="p-4"><p className="font-mono text-[11px] font-bold text-text-secondary">{equipamento?.numeroSerie || '—'}</p><p className="mt-1 text-[10px] text-text-muted">{equipamento?.modelo || 'Modelo não localizado'}</p></td>
      <td className="p-4"><p className="text-text-secondary">{equipamento?.potencia || '—'}</p><p className="mt-1 font-mono text-[10px] text-text-muted">{equipamento?.tensao || '—'}</p></td>
      <td className="p-4 font-mono text-text-secondary">{formatCalendarDate(garantia.dataEntrada)}</td>
      <td className="p-4 text-text-secondary">{responsavel?.nome || 'Não localizado'}</td>
      <td className="p-4"><span className={`inline-flex rounded-full border px-2 py-1 text-[10px] font-bold ${statusTone(garantia.status)}`}>{garantia.status}</span></td>
      <td className="p-4"><button type="button" onClick={onSelect} className="flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-border bg-surface-elevated text-text-muted hover:border-primary/50 hover:bg-primary-soft hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary" aria-label={`Abrir garantia ${garantia.id}`}><Eye className="h-4 w-4" aria-hidden="true" /></button></td>
    </tr>
  );
};

const PrintReportRow: React.FC<{ garantia: Garantia; db: DBState }> = ({ garantia, db }) => {
  const cliente = db.clientes.find((item) => item.id === garantia.clienteId);
  const equipamento = db.equipamentos.find((item) => item.id === garantia.equipamentoId);
  const responsavel = db.usuarios.find((item) => item.id === garantia.responsavelId);
  return (
    <tr><td>{garantia.id}</td><td>{cliente?.nome || '—'}</td><td>{equipamento ? `${equipamento.numeroSerie} · ${equipamento.modelo}` : '—'}</td><td>{equipamento ? `${equipamento.potencia} · ${equipamento.tensao}` : '—'}</td><td>{formatCalendarDate(garantia.dataEntrada)}</td><td>{responsavel?.nome || '—'}</td><td>{garantia.status}</td></tr>
  );
};

const EmptyReport = () => (
  <div className="flex min-h-48 flex-col items-center justify-center gap-2 p-6 text-center"><SearchX className="h-8 w-8 text-text-muted" aria-hidden="true" /><p className="text-sm font-semibold text-text-secondary">Nenhum registro encontrado</p><p className="text-xs text-text-muted">Revise ou remova alguns filtros para ampliar a consulta.</p></div>
);

const Pagination: React.FC<{ currentPage: number; totalPages: number; totalRecords: number; onPage: (page: number) => void }> = ({ currentPage, totalPages, totalRecords, onPage }) => {
  if (!totalRecords) return null;
  const first = (currentPage - 1) * PAGE_SIZE + 1;
  const last = Math.min(currentPage * PAGE_SIZE, totalRecords);
  return (
    <nav className="flex flex-col gap-3 border-t border-border bg-surface-elevated px-4 py-3 sm:flex-row sm:items-center sm:justify-between print:hidden" aria-label="Paginação do relatório">
      <p className="text-[11px] text-text-muted">Exibindo <strong className="text-text-secondary">{first}–{last}</strong> de {totalRecords}</p>
      <div className="flex items-center gap-2">
        <button type="button" onClick={() => onPage(currentPage - 1)} disabled={currentPage === 1} className="flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-border bg-surface text-text-secondary hover:bg-surface-hover disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary" aria-label="Página anterior"><ChevronLeft className="h-4 w-4" /></button>
        <span className="min-w-20 text-center font-mono text-[11px] text-text-secondary">{currentPage} / {totalPages}</span>
        <button type="button" onClick={() => onPage(currentPage + 1)} disabled={currentPage === totalPages} className="flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-border bg-surface text-text-secondary hover:bg-surface-hover disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary" aria-label="Próxima página"><ChevronRight className="h-4 w-4" /></button>
      </div>
    </nav>
  );
};
