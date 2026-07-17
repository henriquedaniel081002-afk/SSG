/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  ArrowRight,
  Check,
  Clock,
  Download,
  FileText,
  GitCompare,
  History,
  Image as ImageIcon,
  Mail,
  MapPin,
  Maximize2,
  Pencil,
  Phone,
  Printer,
  Settings,
  User,
  Wrench,
  X,
} from 'lucide-react';
import { Cliente, Equipamento, Foto, Garantia, Historico, StatusGarantia, Usuario } from '../types';
import {
  downloadPhotoAsset,
  formatSystemDate,
  isRenderablePhotoUrl,
  parseSystemDate,
  PhotoImage,
  PhotoLightbox,
  useDialogAccessibility,
} from './fotos/PhotoComponents';

type NotifyType = 'success' | 'error' | 'warning' | 'info';
type DetailTab = 'overview' | 'client' | 'equipment' | 'photos' | 'history';

interface VisualizacaoGarantiaProps {
  garantia: Garantia;
  clientes: Cliente[];
  equipamentos: Equipamento[];
  fotos: Foto[];
  historicos: Historico[];
  usuarios: Usuario[];
  onClose: () => void;
  onEdit?: () => void;
  onNotify?: (message: string, type?: NotifyType) => void;
}

interface TabDefinition {
  id: DetailTab;
  label: string;
  icon: React.ComponentType<{ className?: string; 'aria-hidden'?: boolean }>;
}

const TABS: TabDefinition[] = [
  { id: 'overview', label: 'Visão geral', icon: FileText },
  { id: 'client', label: 'Cliente', icon: User },
  { id: 'equipment', label: 'Equipamento', icon: Settings },
  { id: 'photos', label: 'Fotografias', icon: ImageIcon },
  { id: 'history', label: 'Histórico', icon: History },
];

const STATUS_STAGES = [
  StatusGarantia.RECEBIDO,
  StatusGarantia.EM_ANALISE,
  StatusGarantia.AGUARDANDO_PECAS,
  StatusGarantia.EM_REPARO,
  StatusGarantia.TESTE_FINAL,
  StatusGarantia.CONCLUIDO,
  StatusGarantia.ENCERRADO,
];

const normalizeText = (value: string) => value
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLocaleLowerCase('pt-BR');

const getStatusClasses = (status: StatusGarantia) => {
  switch (status) {
    case StatusGarantia.RECEBIDO:
      return 'border-information/40 bg-information/10 text-information';
    case StatusGarantia.EM_ANALISE:
      return 'border-primary/40 bg-primary-soft text-primary';
    case StatusGarantia.AGUARDANDO_PECAS:
      return 'border-warning/40 bg-warning/10 text-warning';
    case StatusGarantia.EM_REPARO:
      return 'border-warning/40 bg-warning/10 text-warning';
    case StatusGarantia.TESTE_FINAL:
      return 'border-information/40 bg-information/10 text-information';
    case StatusGarantia.CONCLUIDO:
      return 'border-success/40 bg-success/10 text-success';
    case StatusGarantia.ENCERRADO:
      return 'border-border-strong bg-surface-active text-text-secondary';
    default:
      return 'border-border bg-surface-elevated text-text-secondary';
  }
};

const addCalendarDays = (dateValue: string, days: number) => {
  const parsed = parseSystemDate(dateValue);
  if (!parsed) return null;
  const result = new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
  result.setDate(result.getDate() + Math.max(0, Number(days) || 0));
  return result;
};

const formatDateObject = (date: Date | null) => date
  ? new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short' }).format(date)
  : 'Não informado';

const hasValue = (value?: string | null) => value?.trim() || 'Não informado';

interface DefinitionItemProps {
  label: string;
  value?: React.ReactNode;
  mono?: boolean;
}

const DefinitionItem: React.FC<DefinitionItemProps> = ({ label, value, mono }) => (
  <div className="rounded-xl border border-border bg-surface-elevated p-4">
    <dt className="text-[10px] font-bold uppercase tracking-[0.14em] text-text-muted">{label}</dt>
    <dd className={`mt-1.5 break-words text-sm font-semibold text-text-primary ${mono ? 'font-mono' : ''}`}>{value || 'Não informado'}</dd>
  </div>
);

interface ReadOnlyGalleryProps {
  title: string;
  type: 'antes' | 'depois';
  photos: Foto[];
  warrantyCode: string;
  onOpen: (photo: Foto) => void;
  onDownload: (photo: Foto) => void;
}

const ReadOnlyGallery: React.FC<ReadOnlyGalleryProps> = ({ title, type, photos, warrantyCode, onOpen, onDownload }) => (
  <section className="rounded-2xl border border-border bg-surface-elevated p-4 sm:p-5">
    <div className="mb-4 flex items-center justify-between gap-3">
      <div>
        <p className={`text-[11px] font-bold uppercase tracking-[0.17em] ${type === 'antes' ? 'text-danger' : 'text-success'}`}>{title}</p>
        <p className="mt-1 text-xs text-text-muted">{photos.length} {photos.length === 1 ? 'evidência' : 'evidências'}</p>
      </div>
      <span className={`rounded-xl px-3 py-1.5 font-mono text-sm font-bold ${type === 'antes' ? 'bg-danger/10 text-danger' : 'bg-success/10 text-success'}`}>{photos.length}</span>
    </div>

    {photos.length === 0 ? (
      <div className="flex min-h-44 flex-col items-center justify-center rounded-xl border border-dashed border-border-strong bg-background px-5 text-center">
        <ImageIcon className="h-7 w-7 text-text-muted" aria-hidden="true" />
        <p className="mt-2 text-xs font-semibold text-text-secondary">Nenhuma fotografia registrada</p>
      </div>
    ) : (
      <ul className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-3">
        {photos.map((photo, index) => (
          <li key={photo.id} className="overflow-hidden rounded-xl border border-border bg-surface">
            <button type="button" onClick={() => onOpen(photo)} className="block w-full rounded-xl focus:outline-none focus:ring-2 focus:ring-inset focus:ring-focus-ring" aria-label={`Ampliar ${title.toLocaleLowerCase('pt-BR')} ${index + 1}`}>
              <PhotoImage url={photo.url} alt={`${title} da garantia ${warrantyCode}. ${photo.descricao || 'Sem descrição técnica.'}`} className="h-44 w-full rounded-none" />
            </button>
            <div className="space-y-2 p-3">
              <div className="flex items-center justify-between gap-2 text-[10px] text-text-muted">
                <span className="font-mono">#{index + 1}</span>
                <span>{formatSystemDate(photo.dataRegistro, true)}</span>
              </div>
              <p className="text-xs leading-relaxed text-text-secondary">{photo.descricao || 'Sem descrição técnica.'}</p>
              <p className="truncate text-[10px] text-text-muted">Por {photo.usuarioResponsavel || 'usuário não identificado'}</p>
              <div className="grid grid-cols-2 gap-2 border-t border-border pt-3 print:hidden">
                <button type="button" onClick={() => onOpen(photo)} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-border bg-surface-elevated text-xs font-bold text-text-secondary hover:bg-surface-hover hover:text-text-primary focus:outline-none focus:ring-2 focus:ring-focus-ring">
                  <Maximize2 className="h-4 w-4" aria-hidden="true" /> Ampliar
                </button>
                <button type="button" onClick={() => onDownload(photo)} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-border bg-surface-elevated text-xs font-bold text-text-secondary hover:bg-surface-hover hover:text-text-primary focus:outline-none focus:ring-2 focus:ring-focus-ring">
                  <Download className="h-4 w-4" aria-hidden="true" /> Baixar
                </button>
              </div>
            </div>
          </li>
        ))}
      </ul>
    )}
  </section>
);

interface PrintReportProps {
  garantia: Garantia;
  cliente: Cliente | null;
  equipamento: Equipamento | null;
  responsavel: Usuario | null;
  deadline: Date | null;
  statusObservations: Array<{ status: StatusGarantia; date: string | null; current: boolean; observed: boolean }>;
  photos: Foto[];
  history: Historico[];
}

const PrintReport: React.FC<PrintReportProps> = ({ garantia, cliente, equipamento, responsavel, deadline, statusObservations, photos, history }) => (
  <article className="hidden bg-white p-8 text-black print:block">
    <header className="flex items-end justify-between border-b-2 border-black pb-4">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.2em]">ITAM Transformadores</p>
        <h1 className="mt-1 text-2xl font-bold">Ficha técnica de garantia</h1>
        <p className="mt-1 font-mono text-lg font-bold">{garantia.id}</p>
      </div>
      <div className="text-right text-xs">
        <p>Status: <strong>{garantia.status}</strong></p>
        <p>Emitido em {new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date())}</p>
      </div>
    </header>

    <section className="mt-5 grid grid-cols-4 gap-3 text-xs">
      <div><strong className="block uppercase">Entrada</strong>{formatSystemDate(garantia.dataEntrada)}</div>
      <div><strong className="block uppercase">Prazo</strong>{garantia.prazoDias} dias</div>
      <div><strong className="block uppercase">Data-limite</strong>{formatDateObject(deadline)}</div>
      <div><strong className="block uppercase">Encerramento</strong>{garantia.dataEncerramento ? formatSystemDate(garantia.dataEncerramento) : 'Em aberto'}</div>
    </section>

    <section className="mt-6 grid grid-cols-2 gap-6 text-xs">
      <div>
        <h2 className="border-b border-black pb-1 text-sm font-bold">Cliente</h2>
        <p className="mt-2"><strong>{hasValue(cliente?.nome)}</strong></p>
        <p>Contato: {hasValue(cliente?.contato)}</p>
        <p>Telefone: {hasValue(cliente?.telefone)}</p>
        <p>E-mail: {hasValue(cliente?.email)}</p>
        <p>Localização: {cliente ? `${hasValue(cliente.cidade)} - ${hasValue(cliente.estado)}` : 'Não informado'}</p>
      </div>
      <div>
        <h2 className="border-b border-black pb-1 text-sm font-bold">Equipamento</h2>
        <p className="mt-2"><strong>Série {hasValue(equipamento?.numeroSerie)}</strong></p>
        <p>Modelo: {hasValue(equipamento?.modelo)}</p>
        <p>Potência: {hasValue(equipamento?.potencia)}</p>
        <p>Tensão: {hasValue(equipamento?.tensao)}</p>
        <p>Responsável: {hasValue(responsavel?.nome)}</p>
      </div>
    </section>

    <section className="mt-6 text-xs">
      <h2 className="border-b border-black pb-1 text-sm font-bold">Ocorrência e laudo</h2>
      <p className="mt-2"><strong>Reclamação:</strong> {hasValue(garantia.descricaoReclamacao)}</p>
      <p className="mt-2 whitespace-pre-wrap"><strong>Observações:</strong> {hasValue(garantia.observacoesGerais)}</p>
    </section>

    <section className="mt-6 text-xs">
      <h2 className="border-b border-black pb-1 text-sm font-bold">Sete status do processo</h2>
      <div className="mt-2 grid grid-cols-4 gap-2">
        {statusObservations.map((item) => (
          <div key={item.status} className="border border-gray-400 p-2">
            <strong className="block">{item.status}</strong>
            <span>{item.date ? formatSystemDate(item.date, true) : item.current ? 'Status atual; sem data no histórico' : 'Não observado'}</span>
          </div>
        ))}
      </div>
    </section>

    {photos.length > 0 && (
      <section className="mt-6 break-before-page text-xs">
        <h2 className="border-b border-black pb-1 text-sm font-bold">Registro fotográfico ({photos.length})</h2>
        <div className="mt-3 grid grid-cols-2 gap-4">
          {photos.map((photo, index) => (
            <figure key={photo.id} className="break-inside-avoid border border-gray-400 p-2">
              <PhotoImage url={photo.url} alt={`Foto ${photo.tipo} da garantia ${garantia.id}`} className="h-52 w-full" contain />
              <figcaption className="mt-2"><strong>#{index + 1} · {photo.tipo === 'antes' ? 'Antes' : 'Depois'}:</strong> {photo.descricao || 'Sem descrição.'}<br />{formatSystemDate(photo.dataRegistro, true)} · {photo.usuarioResponsavel}</figcaption>
            </figure>
          ))}
        </div>
      </section>
    )}

    <section className="mt-6 break-before-page text-xs">
      <h2 className="border-b border-black pb-1 text-sm font-bold">Histórico completo ({history.length})</h2>
      {history.length === 0 ? <p className="mt-2">Nenhuma alteração registrada.</p> : (
        <table className="mt-2 w-full border-collapse text-left">
          <thead><tr><th className="border border-black p-1">Data</th><th className="border border-black p-1">Usuário</th><th className="border border-black p-1">Alteração</th></tr></thead>
          <tbody>{history.map((item) => <tr key={item.id}><td className="border border-black p-1 align-top">{formatSystemDate(item.dataHora, true)}</td><td className="border border-black p-1 align-top">{item.usuarioNome || 'Não identificado'}</td><td className="border border-black p-1">{item.alteracaoRealizada}</td></tr>)}</tbody>
        </table>
      )}
    </section>
  </article>
);

export const VisualizacaoGarantia: React.FC<VisualizacaoGarantiaProps> = ({
  garantia,
  clientes,
  equipamentos,
  fotos,
  historicos,
  usuarios,
  onClose,
  onEdit,
  onNotify,
}) => {
  const [activeTab, setActiveTab] = useState<DetailTab>('overview');
  const [lightboxPhoto, setLightboxPhoto] = useState<Foto | null>(null);
  const [comparisonBeforeId, setComparisonBeforeId] = useState('');
  const [comparisonAfterId, setComparisonAfterId] = useState('');
  const [localNotice, setLocalNotice] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  useDialogAccessibility(true, onClose, dialogRef);

  const cliente = clientes.find((item) => item.id === garantia.clienteId) || null;
  const equipamento = equipamentos.find((item) => item.id === garantia.equipamentoId) || null;
  const responsavel = usuarios.find((item) => item.id === garantia.responsavelId) || null;
  const warrantyPhotos = useMemo(() => fotos
    .filter((photo) => photo.garantiaId === garantia.id)
    .slice()
    .sort((a, b) => String(b.dataRegistro).localeCompare(String(a.dataRegistro))), [fotos, garantia.id]);
  const beforePhotos = warrantyPhotos.filter((photo) => photo.tipo === 'antes');
  const afterPhotos = warrantyPhotos.filter((photo) => photo.tipo === 'depois');
  const warrantyHistory = useMemo(() => historicos
    .filter((item) => item.garantiaId === garantia.id)
    .slice()
    .sort((a, b) => String(a.dataHora).localeCompare(String(b.dataHora))), [garantia.id, historicos]);
  const deadline = addCalendarDays(garantia.dataEntrada, garantia.prazoDias);
  const finalized = garantia.status === StatusGarantia.CONCLUIDO || garantia.status === StatusGarantia.ENCERRADO;
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const overdue = Boolean(deadline && !finalized && deadline.getTime() < today.getTime());

  const notify = useCallback((message: string, type: NotifyType = 'info') => {
    if (onNotify) onNotify(message, type);
    else setLocalNotice(message);
  }, [onNotify]);

  const statusObservations = useMemo(() => STATUS_STAGES.map((status) => {
    const normalizedStatus = normalizeText(status);
    const exactTarget = warrantyHistory.find((item) => {
      const text = normalizeText(item.alteracaoRealizada || '');
      return text.includes(`para [${normalizedStatus}]`) || text.includes(`status ${normalizedStatus}`);
    });
    const fallbackMention = warrantyHistory.find((item) => normalizeText(item.alteracaoRealizada || '').includes(normalizedStatus));
    const historyEntry = exactTarget || (status === StatusGarantia.RECEBIDO ? fallbackMention : undefined);
    const current = garantia.status === status;
    let date = historyEntry?.dataHora || null;
    if (!date && status === StatusGarantia.RECEBIDO) date = garantia.dataEntrada;
    if (!date && current && (status === StatusGarantia.CONCLUIDO || status === StatusGarantia.ENCERRADO)) date = garantia.dataEncerramento || null;
    return { status, date, current, observed: Boolean(historyEntry || status === StatusGarantia.RECEBIDO) };
  }), [garantia.dataEncerramento, garantia.dataEntrada, garantia.status, warrantyHistory]);

  useEffect(() => {
    setComparisonBeforeId((current) => beforePhotos.some((photo) => photo.id === current) ? current : beforePhotos[0]?.id || '');
    setComparisonAfterId((current) => afterPhotos.some((photo) => photo.id === current) ? current : afterPhotos[0]?.id || '');
  }, [beforePhotos, afterPhotos]);

  const comparisonBefore = beforePhotos.find((photo) => photo.id === comparisonBeforeId) || null;
  const comparisonAfter = afterPhotos.find((photo) => photo.id === comparisonAfterId) || null;

  const downloadPhoto = async (photo: Foto) => {
    if (!isRenderablePhotoUrl(photo.url)) {
      notify('Este registro não possui um arquivo de imagem disponível para download.', 'warning');
      return;
    }
    try {
      await downloadPhotoAsset(photo.url, `Foto-${photo.tipo}-${garantia.id}-${photo.id}.webp`);
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Não foi possível baixar a fotografia.', 'error');
    }
  };

  const handlePrint = () => {
    const printClass = 'ssg-printing-warranty';
    const cleanup = () => document.body.classList.remove(printClass);
    document.body.classList.add(printClass);
    window.addEventListener('afterprint', cleanup, { once: true });
    window.print();
    window.setTimeout(cleanup, 60_000);
  };

  const handleTabKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, currentIndex: number) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    let nextIndex = currentIndex;
    if (event.key === 'ArrowLeft') nextIndex = (currentIndex - 1 + TABS.length) % TABS.length;
    if (event.key === 'ArrowRight') nextIndex = (currentIndex + 1) % TABS.length;
    if (event.key === 'Home') nextIndex = 0;
    if (event.key === 'End') nextIndex = TABS.length - 1;
    setActiveTab(TABS[nextIndex].id);
    document.getElementById(`warranty-tab-${TABS[nextIndex].id}`)?.focus();
  };

  const renderOverview = () => (
    <div className="space-y-6">
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <DefinitionItem label="Status atual" value={<span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-bold ${getStatusClasses(garantia.status)}`}>{garantia.status}</span>} />
        <DefinitionItem label="Responsável técnico" value={responsavel?.nome || 'Não designado'} />
        <DefinitionItem label="Prazo de atendimento" value={`${garantia.prazoDias} dias · ${formatDateObject(deadline)}`} />
        <DefinitionItem label="Encerramento" value={garantia.dataEncerramento ? formatSystemDate(garantia.dataEncerramento) : 'Em aberto'} />
      </section>

      {overdue && (
        <div className="rounded-xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger" role="status">
          <strong>Prazo vencido.</strong> A data-limite desta garantia foi {formatDateObject(deadline)}.
        </div>
      )}

      <section className="rounded-2xl border border-border bg-surface-elevated p-5">
        <div className="flex items-center gap-2">
          <Clock className="h-5 w-5 text-primary" aria-hidden="true" />
          <div>
            <h2 className="text-sm font-bold text-text-primary">Status observados no histórico</h2>
            <p className="text-xs text-text-muted">Os sete estados permanecem separados; datas só aparecem quando registradas.</p>
          </div>
        </div>
        <ol className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 2xl:grid-cols-7">
          {statusObservations.map((item, index) => (
            <li key={item.status} className={`rounded-xl border p-3 ${item.current ? getStatusClasses(item.status) : item.observed ? 'border-border-strong bg-surface text-text-primary' : 'border-border bg-background/40 text-text-muted'}`}>
              <div className="flex items-center justify-between gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-full border border-current/30 font-mono text-[11px] font-bold">{index + 1}</span>
                {item.current && <span className="rounded-full bg-current/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider">Atual</span>}
                {!item.current && item.observed && <Check className="h-4 w-4 text-success" aria-label="Status observado" />}
              </div>
              <strong className="mt-3 block text-xs leading-tight">{item.status}</strong>
              <span className="mt-1 block text-[10px] leading-relaxed opacity-80">{item.date ? formatSystemDate(item.date, true) : item.current ? 'Sem data no histórico' : 'Não observado'}</span>
            </li>
          ))}
        </ol>
      </section>

      <section className="grid gap-5 lg:grid-cols-2">
        <div className="rounded-2xl border border-danger/30 bg-danger/10 p-5">
          <div className="flex items-center gap-2 text-danger"><FileText className="h-4 w-4" aria-hidden="true" /><h2 className="text-xs font-bold uppercase tracking-wider">Reclamação do cliente</h2></div>
          <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-text-primary">{garantia.descricaoReclamacao || 'Nenhuma reclamação registrada.'}</p>
        </div>
        <div className="rounded-2xl border border-success/30 bg-success/10 p-5">
          <div className="flex items-center gap-2 text-success"><Wrench className="h-4 w-4" aria-hidden="true" /><h2 className="text-xs font-bold uppercase tracking-wider">Laudo e observações</h2></div>
          <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-text-primary">{garantia.observacoesGerais || 'Nenhuma observação técnica registrada.'}</p>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <button type="button" onClick={() => setActiveTab('client')} className="group flex min-h-24 items-center justify-between gap-4 rounded-2xl border border-border bg-surface-elevated p-5 text-left hover:border-primary/50 hover:bg-surface-hover focus:outline-none focus:ring-2 focus:ring-focus-ring">
          <div><span className="text-[10px] font-bold uppercase tracking-wider text-text-muted">Cliente</span><strong className="mt-1 block text-sm text-text-primary">{cliente?.nome || 'Não localizado'}</strong><span className="mt-1 block text-xs text-text-secondary">{cliente ? `${cliente.cidade} - ${cliente.estado}` : 'Dados indisponíveis'}</span></div>
          <ArrowRight className="h-5 w-5 text-text-muted transition-transform group-hover:translate-x-1 group-hover:text-primary" aria-hidden="true" />
        </button>
        <button type="button" onClick={() => setActiveTab('equipment')} className="group flex min-h-24 items-center justify-between gap-4 rounded-2xl border border-border bg-surface-elevated p-5 text-left hover:border-primary/50 hover:bg-surface-hover focus:outline-none focus:ring-2 focus:ring-focus-ring">
          <div><span className="text-[10px] font-bold uppercase tracking-wider text-text-muted">Equipamento</span><strong className="mt-1 block font-mono text-sm text-text-primary">Série {equipamento?.numeroSerie || 'não informada'}</strong><span className="mt-1 block text-xs text-text-secondary">{equipamento?.modelo || 'Dados indisponíveis'}</span></div>
          <ArrowRight className="h-5 w-5 text-text-muted transition-transform group-hover:translate-x-1 group-hover:text-primary" aria-hidden="true" />
        </button>
      </section>
    </div>
  );

  const renderClient = () => (
    <section className="rounded-2xl border border-border bg-surface-elevated p-5 sm:p-6">
      <div className="flex items-center gap-3 border-b border-border pb-5">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary-soft text-primary"><User className="h-6 w-6" aria-hidden="true" /></div>
        <div><p className="text-[11px] font-bold uppercase tracking-[0.17em] text-primary">Solicitante</p><h2 className="text-xl font-bold text-text-primary">{cliente?.nome || 'Cliente não localizado'}</h2></div>
      </div>
      {cliente ? (
        <dl className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <DefinitionItem label="Razão social" value={cliente.nome} />
          <DefinitionItem label="Responsável / contato" value={cliente.contato} />
          <DefinitionItem label="Telefone" value={<span className="inline-flex items-center gap-2"><Phone className="h-4 w-4 text-text-muted" aria-hidden="true" />{hasValue(cliente.telefone)}</span>} mono />
          <DefinitionItem label="E-mail" value={<span className="inline-flex items-center gap-2"><Mail className="h-4 w-4 text-text-muted" aria-hidden="true" />{hasValue(cliente.email)}</span>} />
          <DefinitionItem label="Cidade" value={<span className="inline-flex items-center gap-2"><MapPin className="h-4 w-4 text-text-muted" aria-hidden="true" />{hasValue(cliente.cidade)}</span>} />
          <DefinitionItem label="Estado" value={cliente.estado} />
        </dl>
      ) : <p className="mt-5 rounded-xl border border-warning/40 bg-warning/10 p-4 text-sm text-warning">A referência do cliente não foi encontrada no estado atual do sistema.</p>}
    </section>
  );

  const renderEquipment = () => (
    <section className="rounded-2xl border border-border bg-surface-elevated p-5 sm:p-6">
      <div className="flex items-center gap-3 border-b border-border pb-5">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary-soft text-primary"><Settings className="h-6 w-6" aria-hidden="true" /></div>
        <div><p className="text-[11px] font-bold uppercase tracking-[0.17em] text-primary">Ativo vinculado</p><h2 className="font-mono text-xl font-bold text-text-primary">{equipamento?.numeroSerie || 'Equipamento não localizado'}</h2></div>
      </div>
      {equipamento ? (
        <dl className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <DefinitionItem label="Número de série" value={equipamento.numeroSerie} mono />
          <DefinitionItem label="Modelo / tipo" value={equipamento.modelo} />
          <DefinitionItem label="Potência nominal" value={equipamento.potencia} />
          <DefinitionItem label="Tensão de operação" value={equipamento.tensao} mono />
          <DefinitionItem label="Data de fabricação" value={formatSystemDate(equipamento.dataFabricacao)} />
          <DefinitionItem label="Data de venda" value={formatSystemDate(equipamento.dataVenda)} />
        </dl>
      ) : <p className="mt-5 rounded-xl border border-warning/40 bg-warning/10 p-4 text-sm text-warning">A referência do equipamento não foi encontrada no estado atual do sistema.</p>}
    </section>
  );

  const renderPhotos = () => (
    <div className="space-y-6">
      <div className="grid gap-6 xl:grid-cols-2">
        <ReadOnlyGallery title="Antes do reparo" type="antes" photos={beforePhotos} warrantyCode={garantia.id} onOpen={setLightboxPhoto} onDownload={downloadPhoto} />
        <ReadOnlyGallery title="Depois do reparo" type="depois" photos={afterPhotos} warrantyCode={garantia.id} onOpen={setLightboxPhoto} onDownload={downloadPhoto} />
      </div>

      <section className="rounded-2xl border border-border bg-surface-elevated p-5 sm:p-6">
        <div className="flex items-center gap-3"><div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary-soft text-primary"><GitCompare className="h-5 w-5" aria-hidden="true" /></div><div><h2 className="text-base font-bold text-text-primary">Comparação lado a lado</h2><p className="text-xs text-text-secondary">Selecione uma foto de cada momento.</p></div></div>
        <div className="mt-5 grid gap-5 lg:grid-cols-2">
          <div>
            <label htmlFor="detail-comparison-before" className="text-[11px] font-bold uppercase tracking-wider text-danger">Antes</label>
            <select id="detail-comparison-before" value={comparisonBeforeId} onChange={(event) => setComparisonBeforeId(event.target.value)} className="mt-2 min-h-11 w-full rounded-xl border border-border bg-background px-3 text-sm text-text-primary outline-none focus:border-primary focus:ring-2 focus:ring-focus-ring"><option value="">Nenhuma foto disponível</option>{beforePhotos.map((photo, index) => <option key={photo.id} value={photo.id}>#{index + 1} · {photo.descricao || formatSystemDate(photo.dataRegistro, true)}</option>)}</select>
            <div className="mt-3">{comparisonBefore ? <button type="button" onClick={() => setLightboxPhoto(comparisonBefore)} className="block w-full rounded-xl focus:outline-none focus:ring-2 focus:ring-focus-ring" aria-label="Ampliar foto antes selecionada"><PhotoImage url={comparisonBefore.url} alt={`Comparação antes da garantia ${garantia.id}`} className="h-72 w-full" contain /></button> : <div className="flex h-72 items-center justify-center rounded-xl border border-dashed border-border-strong bg-background text-xs text-text-muted">Sem foto antes</div>}</div>
          </div>
          <div>
            <label htmlFor="detail-comparison-after" className="text-[11px] font-bold uppercase tracking-wider text-success">Depois</label>
            <select id="detail-comparison-after" value={comparisonAfterId} onChange={(event) => setComparisonAfterId(event.target.value)} className="mt-2 min-h-11 w-full rounded-xl border border-border bg-background px-3 text-sm text-text-primary outline-none focus:border-primary focus:ring-2 focus:ring-focus-ring"><option value="">Nenhuma foto disponível</option>{afterPhotos.map((photo, index) => <option key={photo.id} value={photo.id}>#{index + 1} · {photo.descricao || formatSystemDate(photo.dataRegistro, true)}</option>)}</select>
            <div className="mt-3">{comparisonAfter ? <button type="button" onClick={() => setLightboxPhoto(comparisonAfter)} className="block w-full rounded-xl focus:outline-none focus:ring-2 focus:ring-focus-ring" aria-label="Ampliar foto depois selecionada"><PhotoImage url={comparisonAfter.url} alt={`Comparação depois da garantia ${garantia.id}`} className="h-72 w-full" contain /></button> : <div className="flex h-72 items-center justify-center rounded-xl border border-dashed border-border-strong bg-background text-xs text-text-muted">Sem foto depois</div>}</div>
          </div>
        </div>
      </section>
    </div>
  );

  const renderHistory = () => (
    <section className="rounded-2xl border border-border bg-surface-elevated p-5 sm:p-6">
      <div className="flex items-center justify-between gap-3 border-b border-border pb-5">
        <div className="flex items-center gap-3"><div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary-soft text-primary"><History className="h-5 w-5" aria-hidden="true" /></div><div><h2 className="text-base font-bold text-text-primary">Histórico de alterações</h2><p className="text-xs text-text-secondary">{warrantyHistory.length} {warrantyHistory.length === 1 ? 'evento registrado' : 'eventos registrados'}</p></div></div>
      </div>
      {warrantyHistory.length === 0 ? (
        <div className="py-14 text-center"><History className="mx-auto h-8 w-8 text-text-muted" aria-hidden="true" /><p className="mt-2 text-sm font-semibold text-text-secondary">Nenhuma alteração registrada</p></div>
      ) : (
        <ol className="relative mt-6 space-y-0 before:absolute before:bottom-4 before:left-[19px] before:top-4 before:w-px before:bg-border">
          {warrantyHistory.slice().reverse().map((entry) => (
            <li key={entry.id} className="relative grid grid-cols-[40px_1fr] gap-3 pb-5 last:pb-0">
              <span className="z-10 mt-1 flex h-10 w-10 items-center justify-center rounded-full border border-border-strong bg-surface text-primary"><History className="h-4 w-4" aria-hidden="true" /></span>
              <article className="rounded-xl border border-border bg-surface p-4">
                <div className="flex flex-col justify-between gap-1 sm:flex-row sm:items-center"><strong className="text-xs text-text-primary">{entry.usuarioNome || 'Usuário não identificado'}</strong><time className="font-mono text-[10px] text-text-muted">{formatSystemDate(entry.dataHora, true)}</time></div>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-text-secondary">{entry.alteracaoRealizada}</p>
              </article>
            </li>
          ))}
        </ol>
      )}
    </section>
  );

  const activeTabContent = activeTab === 'overview'
    ? renderOverview()
    : activeTab === 'client'
      ? renderClient()
      : activeTab === 'equipment'
        ? renderEquipment()
        : activeTab === 'photos'
          ? renderPhotos()
          : renderHistory();

  const portalContent = (
    <div id="ssg-warranty-detail-portal" ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="warranty-detail-title" tabIndex={-1} className="fixed inset-0 z-[100] flex h-screen w-screen flex-col bg-background text-text-primary outline-none print:static print:z-0 print:block print:h-auto print:w-auto print:bg-white">
      <header className="shrink-0 border-b border-border bg-surface px-4 py-3 shadow-lg shadow-black/10 print:hidden sm:px-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-primary-soft px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.15em] text-primary">Garantia técnica</span>
              <span className={`rounded-full border px-2.5 py-1 text-[10px] font-bold ${getStatusClasses(garantia.status)}`}>{garantia.status}</span>
              {overdue && <span className="rounded-full border border-danger/40 bg-danger/10 px-2.5 py-1 text-[10px] font-bold text-danger">Prazo vencido</span>}
            </div>
            <h1 id="warranty-detail-title" className="mt-1 truncate font-mono text-xl font-bold tracking-tight text-text-primary sm:text-2xl">{garantia.id}</h1>
          </div>

          <dl className="grid min-w-0 flex-1 grid-cols-2 gap-x-5 gap-y-2 text-[10px] sm:grid-cols-3 xl:max-w-3xl xl:grid-cols-5">
            <div><dt className="font-bold uppercase tracking-wider text-text-muted">Responsável</dt><dd className="mt-0.5 truncate text-xs font-semibold text-text-primary" title={responsavel?.nome}>{responsavel?.nome || 'Não designado'}</dd></div>
            <div><dt className="font-bold uppercase tracking-wider text-text-muted">Entrada</dt><dd className="mt-0.5 font-mono text-xs font-semibold text-text-primary">{formatSystemDate(garantia.dataEntrada)}</dd></div>
            <div><dt className="font-bold uppercase tracking-wider text-text-muted">Prazo</dt><dd className="mt-0.5 font-mono text-xs font-semibold text-text-primary">{garantia.prazoDias} dias</dd></div>
            <div><dt className="font-bold uppercase tracking-wider text-text-muted">Data-limite</dt><dd className={`mt-0.5 font-mono text-xs font-semibold ${overdue ? 'text-danger' : 'text-text-primary'}`}>{formatDateObject(deadline)}</dd></div>
            <div><dt className="font-bold uppercase tracking-wider text-text-muted">Encerramento</dt><dd className="mt-0.5 font-mono text-xs font-semibold text-text-primary">{garantia.dataEncerramento ? formatSystemDate(garantia.dataEncerramento) : 'Em aberto'}</dd></div>
          </dl>

          <div className="flex shrink-0 items-center gap-2">
            <button type="button" onClick={handlePrint} className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-border bg-surface-elevated text-text-secondary hover:bg-surface-hover hover:text-text-primary focus:outline-none focus:ring-2 focus:ring-focus-ring" aria-label="Imprimir ficha completa"><Printer className="h-5 w-5" aria-hidden="true" /></button>
            {onEdit && <button type="button" onClick={onEdit} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-xs font-bold text-white hover:bg-primary-hover focus:outline-none focus:ring-2 focus:ring-focus-ring"><Pencil className="h-4 w-4" aria-hidden="true" />Editar registro</button>}
            <button type="button" onClick={onClose} className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-border bg-surface-elevated text-text-secondary hover:bg-surface-hover hover:text-text-primary focus:outline-none focus:ring-2 focus:ring-focus-ring" aria-label="Fechar detalhes"><X className="h-5 w-5" aria-hidden="true" /></button>
          </div>
        </div>
      </header>

      <nav className="shrink-0 overflow-x-auto border-b border-border bg-surface print:hidden" aria-label="Seções da garantia">
        <div className="mx-auto flex w-max min-w-full max-w-7xl px-2 sm:px-4" role="tablist" aria-label="Detalhes da garantia">
          {TABS.map((tab, index) => {
            const Icon = tab.icon;
            const selected = activeTab === tab.id;
            return (
              <button key={tab.id} id={`warranty-tab-${tab.id}`} type="button" role="tab" aria-selected={selected} aria-controls="warranty-tab-panel" tabIndex={selected ? 0 : -1} onClick={() => setActiveTab(tab.id)} onKeyDown={(event) => handleTabKeyDown(event, index)} className={`relative inline-flex min-h-14 flex-1 items-center justify-center gap-2 whitespace-nowrap border-b-2 px-4 text-xs font-bold transition focus:outline-none focus:ring-2 focus:ring-inset focus:ring-focus-ring ${selected ? 'border-primary bg-primary-soft text-primary' : 'border-transparent text-text-secondary hover:bg-surface-hover hover:text-text-primary'}`}>
                <Icon className="h-4 w-4" aria-hidden="true" />{tab.label}{tab.id === 'photos' && <span className="rounded-full bg-surface-active px-1.5 py-0.5 font-mono text-[9px] text-text-secondary">{warrantyPhotos.length}</span>}
              </button>
            );
          })}
        </div>
      </nav>

      {localNotice && (
        <div className="mx-auto mt-4 flex w-[calc(100%-2rem)] max-w-7xl items-start justify-between gap-3 rounded-xl border border-warning/40 bg-warning/10 px-4 py-3 text-sm text-warning print:hidden" role="status" aria-live="polite"><p>{localNotice}</p><button type="button" onClick={() => setLocalNotice(null)} className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-lg hover:bg-black/10 focus:outline-none focus:ring-2 focus:ring-focus-ring" aria-label="Fechar aviso"><X className="h-4 w-4" aria-hidden="true" /></button></div>
      )}

      <main id="warranty-tab-panel" role="tabpanel" aria-labelledby={`warranty-tab-${activeTab}`} tabIndex={0} className="min-h-0 flex-1 overflow-y-auto bg-background px-4 py-5 outline-none print:hidden sm:px-6 sm:py-6">
        <div className="mx-auto max-w-7xl">{activeTabContent}</div>
      </main>

      <PrintReport garantia={garantia} cliente={cliente} equipamento={equipamento} responsavel={responsavel} deadline={deadline} statusObservations={statusObservations} photos={warrantyPhotos} history={warrantyHistory} />

      <PhotoLightbox photos={warrantyPhotos} currentId={lightboxPhoto?.id || null} warrantyCode={garantia.id} onChange={setLightboxPhoto} onClose={() => setLightboxPhoto(null)} onDownload={downloadPhoto} />
    </div>
  );

  return createPortal(portalContent, document.body);
};
