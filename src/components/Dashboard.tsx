/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  CameraOff,
  CheckCircle2,
  ClipboardList,
  Clock3,
  History,
  Layers3,
  PackageOpen,
  Play,
  Search,
  TimerReset,
  Wrench,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { DBState, Garantia, StatusGarantia } from '../types';

interface DashboardProps {
  db: DBState;
  onSelectGarantia: (garantia: Garantia) => void;
  onNavigateToTab: (tab: string) => void;
  onNavigate?: (tab: string, action?: string, garantiaId?: string) => void;
}

const CHART_COLORS = ['#22C55E', '#10B981', '#38BDF8', '#FBBF24', '#A78BFA', '#FB7185'];
const CLOSED_STATUSES = new Set<StatusGarantia>([
  StatusGarantia.CONCLUIDO,
  StatusGarantia.ENCERRADO,
]);

const parseCalendarDate = (value?: string) => {
  if (!value) return null;
  const [year, month, day] = value.slice(0, 10).split('-').map(Number);
  if (!year || !month || !day) return null;
  const parsed = new Date(year, month - 1, day);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const formatCalendarDate = (value?: string) => {
  const date = parseCalendarDate(value);
  return date ? date.toLocaleDateString('pt-BR') : '—';
};

const formatDateTime = (value?: string) => {
  if (!value) return '—';
  const normalized = value.includes('T') ? value : value.replace(' ', 'T');
  const date = new Date(normalized);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
};

const dueDateFor = (garantia: Garantia) => {
  const entry = parseCalendarDate(garantia.dataEntrada);
  if (!entry) return null;
  const due = new Date(entry);
  due.setDate(due.getDate() + Math.max(0, Number(garantia.prazoDias) || 0));
  return due;
};

const isRealPhoto = (url?: string) => Boolean(
  url && /^(https?:\/\/|data:image\/|blob:)/i.test(url.trim()),
);

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

type MetricCardProps = {
  label: string;
  value: number | string;
  hint: string;
  icon: React.ReactNode;
  tone?: 'primary' | 'success' | 'warning' | 'information' | 'neutral';
};

const MetricCard: React.FC<MetricCardProps> = ({ label, value, hint, icon, tone = 'neutral' }) => {
  const tones = {
    primary: 'border-primary/35 bg-primary-soft text-primary',
    success: 'border-success/35 bg-success/10 text-success',
    warning: 'border-warning/35 bg-warning/10 text-warning',
    information: 'border-information/35 bg-information/10 text-information',
    neutral: 'border-border bg-surface-elevated text-text-secondary',
  };

  return (
    <article className="rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-text-muted">{label}</p>
        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border ${tones[tone]}`} aria-hidden="true">
          {icon}
        </span>
      </div>
      <p className="mt-4 font-mono text-3xl font-semibold tracking-tight text-text-primary">{value}</p>
      <p className="mt-1 text-xs text-text-muted">{hint}</p>
    </article>
  );
};

export const Dashboard: React.FC<DashboardProps> = ({
  db,
  onSelectGarantia,
  onNavigateToTab,
  onNavigate,
}) => {
  const { garantias, clientes, equipamentos, fotos, historicos } = db;

  const navigate = (tab: string, action?: string, garantiaId?: string) => {
    if (onNavigate) onNavigate(tab, action, garantiaId);
    else onNavigateToTab(tab);
  };

  const analytics = useMemo(() => {
    const abertas = garantias.filter((garantia) => !CLOSED_STATUSES.has(garantia.status));
    const encerradasComDatas = garantias.filter((garantia) => (
      CLOSED_STATUSES.has(garantia.status)
      && parseCalendarDate(garantia.dataEntrada)
      && parseCalendarDate(garantia.dataEncerramento)
    ));

    const mttr = encerradasComDatas.length
      ? Math.round(encerradasComDatas.reduce((sum, garantia) => {
          const start = parseCalendarDate(garantia.dataEntrada)!;
          const end = parseCalendarDate(garantia.dataEncerramento)!;
          return sum + Math.max(0, Math.round((end.getTime() - start.getTime()) / 86_400_000));
        }, 0) / encerradasComDatas.length)
      : null;

    const monthMap = new Map<string, number>();
    const clientMap = new Map<string, number>();
    const modelMap = new Map<string, number>();

    garantias.forEach((garantia) => {
      const monthKey = garantia.dataEntrada.slice(0, 7);
      if (/^\d{4}-\d{2}$/.test(monthKey)) monthMap.set(monthKey, (monthMap.get(monthKey) || 0) + 1);

      const cliente = clientes.find((item) => item.id === garantia.clienteId);
      const clienteNome = cliente?.nome || 'Cliente não localizado';
      clientMap.set(clienteNome, (clientMap.get(clienteNome) || 0) + 1);

      const equipamento = equipamentos.find((item) => item.id === garantia.equipamentoId);
      const modelo = equipamento?.modelo || 'Modelo não localizado';
      modelMap.set(modelo, (modelMap.get(modelo) || 0) + 1);
    });

    const monthData = [...monthMap.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, total]) => {
        const [year, month] = key.split('-').map(Number);
        return {
          key,
          name: new Date(year, month - 1, 1).toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }),
          total,
        };
      });

    const clientData = [...clientMap.entries()]
      .map(([name, value]) => ({ name, value }))
      .sort((left, right) => right.value - left.value);

    const modelData = [...modelMap.entries()]
      .map(([name, total]) => ({ name, total }))
      .sort((left, right) => right.total - left.total);

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const expired = abertas
      .filter((garantia) => {
        const dueDate = dueDateFor(garantia);
        return dueDate !== null && dueDate.getTime() < today.getTime();
      })
      .sort((left, right) => (dueDateFor(left)?.getTime() || 0) - (dueDateFor(right)?.getTime() || 0));

    const withoutPhotos = garantias.filter((garantia) => (
      !fotos.some((foto) => foto.garantiaId === garantia.id && isRealPhoto(foto.url))
    ));

    return {
      abertas: abertas.length,
      emAnalise: garantias.filter((item) => item.status === StatusGarantia.EM_ANALISE).length,
      aguardando: garantias.filter((item) => item.status === StatusGarantia.AGUARDANDO_PECAS).length,
      emReparo: garantias.filter((item) => item.status === StatusGarantia.EM_REPARO).length,
      concluidas: garantias.filter((item) => item.status === StatusGarantia.CONCLUIDO).length,
      mttr,
      monthData,
      clientData,
      modelData,
      expired,
      waitingParts: garantias.filter((item) => item.status === StatusGarantia.AGUARDANDO_PECAS),
      withoutPhotos,
      recentHistory: [...historicos]
        .sort((left, right) => right.dataHora.localeCompare(left.dataHora))
        .slice(0, 5),
      recentWarranties: [...garantias]
        .sort((left, right) => right.dataEntrada.localeCompare(left.dataEntrada))
        .slice(0, 5),
    };
  }, [clientes, equipamentos, fotos, garantias, historicos]);

  const openGuarantee = (garantia: Garantia) => onSelectGarantia(garantia);
  const openById = (garantiaId: string) => {
    const garantia = garantias.find((item) => item.id === garantiaId);
    if (garantia) openGuarantee(garantia);
  };

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-border bg-surface p-5 shadow-sm md:p-6">
        <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-primary">Operação de garantias</p>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight text-text-primary">Visão executiva</h1>
            <p className="mt-1 max-w-2xl text-sm text-text-secondary">Indicadores calculados a partir dos registros atuais, com atenção imediata aos chamados que exigem ação.</p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={() => navigate('cadastro', 'create')}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-white transition-colors hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <ClipboardList className="h-4 w-4" aria-hidden="true" /> Nova garantia
            </button>
            <button
              type="button"
              onClick={() => navigate('registro-foto')}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-border-strong bg-surface-elevated px-4 py-2 text-xs font-bold text-text-primary transition-colors hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <Layers3 className="h-4 w-4" aria-hidden="true" /> Registrar fotos
            </button>
          </div>
        </div>
      </section>

      <section aria-labelledby="dashboard-metrics-title">
        <h2 id="dashboard-metrics-title" className="sr-only">Indicadores principais</h2>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 xl:grid-cols-7">
          <MetricCard label="Total" value={garantias.length} hint="registros" icon={<ClipboardList className="h-4 w-4" />} />
          <MetricCard label="Em aberto" value={analytics.abertas} hint="não finalizadas" icon={<Play className="h-4 w-4" />} tone="warning" />
          <MetricCard label="Em análise" value={analytics.emAnalise} hint="inspeção técnica" icon={<Search className="h-4 w-4" />} tone="information" />
          <MetricCard label="Aguardando" value={analytics.aguardando} hint="aguardando peças" icon={<PackageOpen className="h-4 w-4" />} tone="warning" />
          <MetricCard label="Em reparo" value={analytics.emReparo} hint="intervenção ativa" icon={<Wrench className="h-4 w-4" />} tone="primary" />
          <MetricCard label="Concluídas" value={analytics.concluidas} hint="laudo concluído" icon={<CheckCircle2 className="h-4 w-4" />} tone="success" />
          <MetricCard label="Tempo médio" value={analytics.mttr === null ? '—' : `${analytics.mttr}d`} hint="MTTR real" icon={<TimerReset className="h-4 w-4" />} />
        </div>
      </section>

      <section className="grid grid-cols-1 gap-6 lg:grid-cols-12" aria-label="Análises consolidadas">
        <article className="rounded-2xl border border-border bg-surface p-5 shadow-sm lg:col-span-7">
          <div className="mb-5">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-text-primary"><BarChart3 className="h-4 w-4 text-primary" aria-hidden="true" /> Garantias por mês</h2>
            <p className="mt-1 text-xs text-text-muted">Registros ordenados cronologicamente pelo mês de entrada.</p>
          </div>
          <div className="h-64 w-full">
            {analytics.monthData.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={analytics.monthData} margin={{ top: 8, right: 8, left: -22, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1F3A2A" vertical={false} />
                  <XAxis dataKey="name" stroke="#8EA394" fontSize={10} tickLine={false} axisLine={false} />
                  <YAxis allowDecimals={false} stroke="#8EA394" fontSize={10} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={{ background: '#101A13', border: '1px solid #1F3A2A', borderRadius: 12, fontSize: 11 }} cursor={{ fill: '#132018' }} />
                  <Bar dataKey="total" name="Garantias" fill="#22C55E" radius={[5, 5, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : <EmptyChart />}
          </div>
        </article>

        <article className="rounded-2xl border border-border bg-surface p-5 shadow-sm lg:col-span-5">
          <div className="mb-4">
            <h2 className="text-sm font-semibold text-text-primary">Distribuição por cliente</h2>
            <p className="mt-1 text-xs text-text-muted">Nomes preservados integralmente nos dados.</p>
          </div>
          {analytics.clientData.length ? (
            <>
              <div className="h-44">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={analytics.clientData} dataKey="value" nameKey="name" innerRadius={48} outerRadius={68} paddingAngle={3}>
                      {analytics.clientData.map((item, index) => <Cell key={item.name} fill={CHART_COLORS[index % CHART_COLORS.length]} />)}
                    </Pie>
                    <Tooltip contentStyle={{ background: '#101A13', border: '1px solid #1F3A2A', borderRadius: 12, fontSize: 11 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="grid gap-2 border-t border-border pt-4 sm:grid-cols-2">
                {analytics.clientData.slice(0, 6).map((item, index) => (
                  <div key={item.name} className="flex min-w-0 items-center gap-2 text-xs text-text-secondary" title={item.name}>
                    <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: CHART_COLORS[index % CHART_COLORS.length] }} />
                    <span className="truncate">{item.name}</span>
                    <span className="ml-auto font-mono font-semibold text-text-primary">{item.value}</span>
                  </div>
                ))}
              </div>
            </>
          ) : <div className="h-64"><EmptyChart /></div>}
        </article>
      </section>

      <section className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <article className="rounded-2xl border border-border bg-surface p-5 shadow-sm lg:col-span-5">
          <div className="mb-5">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-text-primary"><Layers3 className="h-4 w-4 text-primary" aria-hidden="true" /> Ocorrências por modelo</h2>
            <p className="mt-1 text-xs text-text-muted">Quantidade total por modelo, sem agrupar nomes diferentes.</p>
          </div>
          <div className="h-64">
            {analytics.modelData.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart layout="vertical" data={analytics.modelData.slice(0, 8)} margin={{ top: 0, right: 8, left: 12, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1F3A2A" horizontal={false} />
                  <XAxis type="number" allowDecimals={false} stroke="#8EA394" fontSize={10} tickLine={false} axisLine={false} />
                  <YAxis dataKey="name" type="category" stroke="#8EA394" fontSize={9} tickLine={false} axisLine={false} width={112} tickFormatter={(value: string) => value.length > 18 ? `${value.slice(0, 17)}…` : value} />
                  <Tooltip contentStyle={{ background: '#101A13', border: '1px solid #1F3A2A', borderRadius: 12, fontSize: 11 }} />
                  <Bar dataKey="total" name="Garantias" fill="#10B981" radius={[0, 5, 5, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : <EmptyChart />}
          </div>
        </article>

        <article className="overflow-hidden rounded-2xl border border-border bg-surface shadow-sm lg:col-span-7">
          <div className="flex items-start justify-between gap-3 border-b border-border p-5">
            <div>
              <h2 className="text-sm font-semibold text-text-primary">Últimos registros</h2>
              <p className="mt-1 text-xs text-text-muted">Acesso direto aos cinco registros mais recentes.</p>
            </div>
            <button type="button" onClick={() => navigate('relatorios')} className="inline-flex min-h-11 shrink-0 items-center gap-1 rounded-lg px-2 text-xs font-bold text-primary hover:bg-primary-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
              Ver relatório <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </div>
          <div className="divide-y divide-border">
            {analytics.recentWarranties.length ? analytics.recentWarranties.map((garantia) => {
              const cliente = clientes.find((item) => item.id === garantia.clienteId);
              const equipamento = equipamentos.find((item) => item.id === garantia.equipamentoId);
              return (
                <button key={garantia.id} type="button" onClick={() => openGuarantee(garantia)} className="flex min-h-16 w-full items-center gap-3 px-5 py-3 text-left transition-colors hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs font-bold text-text-primary">{garantia.id}</span>
                      <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${statusTone(garantia.status)}`}>{garantia.status}</span>
                    </div>
                    <p className="mt-1 truncate text-xs text-text-secondary">{cliente?.nome || 'Cliente não localizado'} · {equipamento?.numeroSerie || 'Série não localizada'}</p>
                  </div>
                  <time className="shrink-0 font-mono text-[11px] text-text-muted">{formatCalendarDate(garantia.dataEntrada)}</time>
                  <ArrowRight className="h-4 w-4 shrink-0 text-text-muted" aria-hidden="true" />
                </button>
              );
            }) : <EmptyList label="Nenhuma garantia registrada." />}
          </div>
        </article>
      </section>

      <section aria-labelledby="operational-title" className="space-y-3">
        <div>
          <h2 id="operational-title" className="text-base font-semibold text-text-primary">Atenção operacional</h2>
          <p className="mt-1 text-xs text-text-muted">Somente situações objetivas presentes nos dados; não há classificação de “próximo do prazo”.</p>
        </div>
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-4">
          <OperationalCard title="Garantias vencidas" count={analytics.expired.length} icon={<AlertTriangle className="h-4 w-4" />} tone="danger">
            {analytics.expired.slice(0, 4).map((garantia) => (
              <OperationalButton key={garantia.id} title={garantia.id} detail={`Prazo: ${dueDateFor(garantia)?.toLocaleDateString('pt-BR') || '—'}`} onClick={() => openGuarantee(garantia)} />
            ))}
          </OperationalCard>
          <OperationalCard title="Aguardando peças" count={analytics.waitingParts.length} icon={<Clock3 className="h-4 w-4" />} tone="warning">
            {analytics.waitingParts.slice(0, 4).map((garantia) => (
              <OperationalButton key={garantia.id} title={garantia.id} detail={`Entrada: ${formatCalendarDate(garantia.dataEntrada)}`} onClick={() => openGuarantee(garantia)} />
            ))}
          </OperationalCard>
          <OperationalCard title="Sem fotografias reais" count={analytics.withoutPhotos.length} icon={<CameraOff className="h-4 w-4" />} tone="information">
            {analytics.withoutPhotos.slice(0, 4).map((garantia) => (
              <OperationalButton key={garantia.id} title={garantia.id} detail="Registro fotográfico necessário" onClick={() => navigate('registro-foto', 'open', garantia.id)} />
            ))}
          </OperationalCard>
          <OperationalCard title="Alterações recentes" count={historicos.length} icon={<History className="h-4 w-4" />} tone="primary">
            {analytics.recentHistory.map((historico) => (
              <OperationalButton key={historico.id} title={historico.garantiaId} detail={`${historico.usuarioNome} · ${formatDateTime(historico.dataHora)}`} onClick={() => openById(historico.garantiaId)} />
            ))}
          </OperationalCard>
        </div>
      </section>
    </div>
  );
};

const EmptyChart = () => (
  <div className="flex h-full items-center justify-center rounded-xl border border-dashed border-border text-xs text-text-muted">Sem dados para este período.</div>
);

const EmptyList: React.FC<{ label: string }> = ({ label }) => (
  <div className="flex min-h-28 items-center justify-center p-5 text-center text-xs text-text-muted">{label}</div>
);

type OperationalCardProps = {
  title: string;
  count: number;
  icon: React.ReactNode;
  tone: 'danger' | 'warning' | 'information' | 'primary';
  children: React.ReactNode;
};

const OperationalCard: React.FC<OperationalCardProps> = ({ title, count, icon, tone, children }) => {
  const toneClass = {
    danger: 'bg-danger/10 text-danger border-danger/30',
    warning: 'bg-warning/10 text-warning border-warning/30',
    information: 'bg-information/10 text-information border-information/30',
    primary: 'bg-primary-soft text-primary border-primary/30',
  }[tone];

  return (
    <article className="overflow-hidden rounded-2xl border border-border bg-surface shadow-sm">
      <div className="flex items-center gap-2 border-b border-border p-4">
        <span className={`flex h-8 w-8 items-center justify-center rounded-lg border ${toneClass}`} aria-hidden="true">{icon}</span>
        <h3 className="min-w-0 flex-1 text-xs font-semibold text-text-primary">{title}</h3>
        <span className="rounded-full bg-surface-elevated px-2 py-1 font-mono text-[10px] font-bold text-text-secondary">{count}</span>
      </div>
      <div className="divide-y divide-border">
        {count ? children : <EmptyList label="Nenhum item nesta categoria." />}
      </div>
    </article>
  );
};

const OperationalButton: React.FC<{ title: string; detail: string; onClick: () => void }> = ({ title, detail, onClick }) => (
  <button type="button" onClick={onClick} className="flex min-h-14 w-full items-center gap-2 px-4 py-3 text-left transition-colors hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary">
    <span className="min-w-0 flex-1">
      <span className="block font-mono text-[11px] font-bold text-text-primary">{title}</span>
      <span className="mt-0.5 block truncate text-[10px] text-text-muted">{detail}</span>
    </span>
    <ArrowRight className="h-3.5 w-3.5 shrink-0 text-text-muted" aria-hidden="true" />
  </button>
);
