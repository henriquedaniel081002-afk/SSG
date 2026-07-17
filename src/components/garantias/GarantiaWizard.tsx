import type React from 'react';
import { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  CalendarDays,
  Check,
  CheckCircle2,
  ClipboardCheck,
  Cpu,
  FileText,
  Loader2,
  Pencil,
  Plus,
  Search,
  UserRound,
  X,
} from 'lucide-react';
import { Cliente, Equipamento, Garantia, StatusGarantia, Usuario } from '../../types';
import {
  FINAL_STATUSES,
  WarrantyDraft,
  WarrantySaveOutcome,
  clienteToDraft,
  emptyClienteDraft,
  emptyEquipamentoDraft,
  equipamentoToDraft,
  formatDate,
  getLocalDate,
  normalizeUniqueText,
  obterPotenciaSugerida,
} from './models';
import { StatusBadge, trapFocus, useInitialDialogFocus } from './GarantiaUi';

interface GarantiaWizardProps {
  initialDraft: WarrantyDraft;
  clientes: Cliente[];
  equipamentos: Equipamento[];
  garantias: Garantia[];
  usuarios: Usuario[];
  onRequestClose: (dirty: boolean) => void;
  onSave: (draft: WarrantyDraft) => Promise<WarrantySaveOutcome>;
  onSaved: () => void;
}

type DrawerKind = 'cliente' | 'equipamento' | null;

const STEPS = [
  { label: 'Garantia', icon: CalendarDays },
  { label: 'Cliente', icon: Building2 },
  { label: 'Equipamento', icon: Cpu },
  { label: 'Ocorrência', icon: FileText },
  { label: 'Revisão', icon: ClipboardCheck },
] as const;

const controlClass = 'min-h-11 w-full rounded-xl border border-border bg-surface-elevated px-3 text-sm text-text-primary outline-none placeholder:text-text-muted focus:border-primary focus:ring-2 focus:ring-focus-ring/30 disabled:cursor-not-allowed disabled:opacity-50';
const labelClass = 'mb-1.5 block text-xs font-medium text-text-secondary';
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CLIENT_LISTBOX_ID = 'warranty-client-options';
const EQUIPMENT_LISTBOX_ID = 'warranty-equipment-options';
const optionDomId = (prefix: string, value: string) => `${prefix}-${value.replace(/[^a-zA-Z0-9_-]/g, '-')}`;

export function GarantiaWizard({
  initialDraft,
  clientes,
  equipamentos,
  garantias,
  usuarios,
  onRequestClose,
  onSave,
  onSaved,
}: GarantiaWizardProps) {
  const [draft, setDraft] = useState<WarrantyDraft>(initialDraft);
  const [step, setStep] = useState(1);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [drawer, setDrawer] = useState<DrawerKind>(null);
  const [clienteSearch, setClienteSearch] = useState('');
  const [equipamentoSearch, setEquipamentoSearch] = useState('');
  const [clienteListOpen, setClienteListOpen] = useState(true);
  const [equipamentoListOpen, setEquipamentoListOpen] = useState(true);
  const [activeClienteId, setActiveClienteId] = useState<string | null>(null);
  const [activeEquipamentoId, setActiveEquipamentoId] = useState<string | null>(null);
  const layerRef = useInitialDialogFocus(true);

  const selectedCliente = clientes.find((cliente) => cliente.id === draft.clienteId);
  const selectedEquipamento = equipamentos.find((equipamento) => equipamento.id === draft.equipamentoId);
  const selectedResponsavel = usuarios.find((usuario) => usuario.id === draft.responsavelId);

  const visibleClientes = useMemo(() => {
    const search = clienteSearch.trim().toLocaleLowerCase('pt-BR');
    return clientes
      .filter((cliente) => !search || [cliente.nome, cliente.contato, cliente.cidade, cliente.estado].some((value) => (value || '').toLocaleLowerCase('pt-BR').includes(search)))
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  }, [clientes, clienteSearch]);

  const visibleEquipamentos = useMemo(() => {
    const search = equipamentoSearch.trim().toLocaleLowerCase('pt-BR');
    return equipamentos
      .filter((equipamento) => !search || [equipamento.numeroSerie, equipamento.modelo, equipamento.potencia].some((value) => (value || '').toLocaleLowerCase('pt-BR').includes(search)))
      .sort((a, b) => a.numeroSerie.localeCompare(b.numeroSerie, 'pt-BR'));
  }, [equipamentos, equipamentoSearch]);

  const updateDraft = (patch: Partial<WarrantyDraft>) => {
    setDraft((current) => ({ ...current, ...patch }));
    setDirty(true);
    setError('');
  };

  const updateClienteForm = (patch: Partial<WarrantyDraft['clienteForm']>) => {
    setDraft((current) => ({ ...current, clienteForm: { ...current.clienteForm, ...patch } }));
    setDirty(true);
    setError('');
  };

  const updateEquipamentoForm = (patch: Partial<WarrantyDraft['equipamentoForm']>) => {
    setDraft((current) => ({ ...current, equipamentoForm: { ...current.equipamentoForm, ...patch } }));
    setDirty(true);
    setError('');
  };

  const updateModeloEquipamento = (value: string) => {
    const modelo = value.toLocaleUpperCase('pt-BR');
    const potenciaSugerida = obterPotenciaSugerida(modelo);
    updateEquipamentoForm({
      modelo,
      ...(potenciaSugerida ? { potencia: potenciaSugerida } : {}),
    });
  };

  const selectStatus = (nextStatus: StatusGarantia) => {
    updateDraft({
      status: nextStatus,
      dataEncerramento: FINAL_STATUSES.has(nextStatus) ? (draft.dataEncerramento || getLocalDate()) : '',
    });
  };

  const getOccupyingWarranty = (equipamentoId: string) => garantias.find(
    (garantia) => garantia.equipamentoId === equipamentoId && garantia.id !== draft.editingGarantiaId,
  );

  const navigableEquipamentos = useMemo(() => visibleEquipamentos.filter((equipamento) => !garantias.some(
    (garantia) => garantia.equipamentoId === equipamento.id && garantia.id !== draft.editingGarantiaId,
  )), [draft.editingGarantiaId, garantias, visibleEquipamentos]);

  useEffect(() => {
    if (!clienteListOpen || visibleClientes.length === 0) {
      setActiveClienteId(null);
      return;
    }
    setActiveClienteId((current) => {
      if (current && visibleClientes.some((cliente) => cliente.id === current)) return current;
      if (draft.clienteId && visibleClientes.some((cliente) => cliente.id === draft.clienteId)) return draft.clienteId;
      return visibleClientes[0].id;
    });
  }, [clienteListOpen, draft.clienteId, visibleClientes]);

  useEffect(() => {
    if (!equipamentoListOpen || navigableEquipamentos.length === 0) {
      setActiveEquipamentoId(null);
      return;
    }
    setActiveEquipamentoId((current) => {
      if (current && navigableEquipamentos.some((equipamento) => equipamento.id === current)) return current;
      if (draft.equipamentoId && navigableEquipamentos.some((equipamento) => equipamento.id === draft.equipamentoId)) return draft.equipamentoId;
      return navigableEquipamentos[0].id;
    });
  }, [draft.equipamentoId, equipamentoListOpen, navigableEquipamentos]);

  const scrollActiveOption = (id: string) => {
    requestAnimationFrame(() => document.getElementById(id)?.scrollIntoView({ block: 'nearest' }));
  };

  const moveClienteOption = (direction: -1 | 1) => {
    if (!visibleClientes.length) return;
    setClienteListOpen(true);
    const currentIndex = visibleClientes.findIndex((cliente) => cliente.id === activeClienteId);
    const nextIndex = currentIndex < 0
      ? (direction === 1 ? 0 : visibleClientes.length - 1)
      : (currentIndex + direction + visibleClientes.length) % visibleClientes.length;
    const nextId = visibleClientes[nextIndex].id;
    setActiveClienteId(nextId);
    scrollActiveOption(optionDomId('warranty-client-option', nextId));
  };

  const moveEquipamentoOption = (direction: -1 | 1) => {
    if (!navigableEquipamentos.length) return;
    setEquipamentoListOpen(true);
    const currentIndex = navigableEquipamentos.findIndex((equipamento) => equipamento.id === activeEquipamentoId);
    const nextIndex = currentIndex < 0
      ? (direction === 1 ? 0 : navigableEquipamentos.length - 1)
      : (currentIndex + direction + navigableEquipamentos.length) % navigableEquipamentos.length;
    const nextId = navigableEquipamentos[nextIndex].id;
    setActiveEquipamentoId(nextId);
    scrollActiveOption(optionDomId('warranty-equipment-option', nextId));
  };

  const selectCliente = (cliente: Cliente) => {
    updateDraft({ clienteId: cliente.id, clienteMode: 'select', clienteForm: emptyClienteDraft() });
    setActiveClienteId(cliente.id);
    setClienteListOpen(false);
  };

  const selectEquipamento = (equipamento: Equipamento) => {
    updateDraft({ equipamentoId: equipamento.id, equipamentoMode: 'select', equipamentoForm: emptyEquipamentoDraft() });
    setActiveEquipamentoId(equipamento.id);
    setEquipamentoListOpen(false);
  };

  const handleClienteComboboxKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      moveClienteOption(event.key === 'ArrowDown' ? 1 : -1);
      return;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      if (!clienteListOpen) {
        setClienteListOpen(true);
        return;
      }
      const cliente = visibleClientes.find((item) => item.id === activeClienteId) || visibleClientes[0];
      if (cliente) selectCliente(cliente);
      return;
    }
    if (event.key === 'Escape' && clienteListOpen) {
      event.preventDefault();
      event.stopPropagation();
      setClienteListOpen(false);
      setActiveClienteId(null);
    }
  };

  const handleEquipamentoComboboxKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      moveEquipamentoOption(event.key === 'ArrowDown' ? 1 : -1);
      return;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      if (!equipamentoListOpen) {
        setEquipamentoListOpen(true);
        return;
      }
      const equipamento = navigableEquipamentos.find((item) => item.id === activeEquipamentoId) || navigableEquipamentos[0];
      if (equipamento) selectEquipamento(equipamento);
      return;
    }
    if (event.key === 'Escape' && equipamentoListOpen) {
      event.preventDefault();
      event.stopPropagation();
      setEquipamentoListOpen(false);
      setActiveEquipamentoId(null);
    }
  };

  const validateStep = (targetStep: number): string => {
    if (targetStep === 1) {
      if (!draft.dataEntrada) return 'Informe a data de entrada.';
      if (!draft.responsavelId) return 'Selecione o responsável pela garantia.';
      if (!Number.isFinite(draft.prazoDias) || draft.prazoDias < 1) return 'O prazo deve ser de pelo menos 1 dia.';
      if (FINAL_STATUSES.has(draft.status) && !draft.dataEncerramento) return 'Informe a data de encerramento.';
    }

    if (targetStep === 2) {
      if (draft.clienteMode === 'select' && !draft.clienteId) return 'Selecione um cliente ou cadastre um novo.';
      if (draft.clienteMode !== 'select') {
        const nome = draft.clienteForm.nome.trim();
        if (!nome) return 'O nome do cliente é obrigatório.';
        if (draft.clienteForm.email.trim() && !EMAIL_PATTERN.test(draft.clienteForm.email.trim())) return 'Informe um e-mail válido para o cliente.';
        const duplicado = clientes.some((cliente) => cliente.id !== draft.clienteForm.id && normalizeUniqueText(cliente.nome) === normalizeUniqueText(nome));
        if (duplicado) return `O cliente “${nome}” já está cadastrado. Selecione o registro existente.`;
      }
    }

    if (targetStep === 3) {
      if (draft.equipamentoMode === 'select') {
        if (!draft.equipamentoId) return 'Selecione um equipamento ou cadastre um novo.';
        const ocupada = getOccupyingWarranty(draft.equipamentoId);
        if (ocupada) return `Este equipamento já está vinculado à garantia ${ocupada.id}.`;
      } else {
        const serie = draft.equipamentoForm.numeroSerie.trim();
        const modelo = draft.equipamentoForm.modelo.trim();
        if (!serie || !modelo) return 'Número de série e modelo são obrigatórios.';
        if (draft.equipamentoForm.dataFabricacao && draft.equipamentoForm.dataVenda && draft.equipamentoForm.dataVenda < draft.equipamentoForm.dataFabricacao) return 'A data da venda não pode ser anterior à data de fabricação.';
        const duplicado = equipamentos.some((equipamento) => equipamento.id !== draft.equipamentoForm.id && normalizeUniqueText(equipamento.numeroSerie) === normalizeUniqueText(serie));
        if (duplicado) return `O número de série “${serie.toUpperCase()}” já está cadastrado.`;
        if (draft.equipamentoForm.id) {
          const ocupada = getOccupyingWarranty(draft.equipamentoForm.id);
          if (ocupada) return `Este equipamento já está vinculado à garantia ${ocupada.id}.`;
        }
      }
    }

    if (targetStep === 4 && !draft.descricaoReclamacao.trim()) return 'Descreva a reclamação informada pelo cliente.';
    return '';
  };

  const goNext = () => {
    const validationError = validateStep(step);
    if (validationError) {
      setError(validationError);
      return;
    }
    setError('');
    setStep((current) => Math.min(5, current + 1));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (step < 5) {
      goNext();
      return;
    }

    for (let targetStep = 1; targetStep <= 4; targetStep += 1) {
      const validationError = validateStep(targetStep);
      if (validationError) {
        setStep(targetStep);
        setError(validationError);
        return;
      }
    }

    setSaving(true);
    setError('');
    try {
      const outcome = await onSave(draft);
      setDraft(outcome.draft);
      if (outcome.ok) {
        setDirty(false);
        onSaved();
      } else {
        setDirty(true);
        if (outcome.partial) setStep(5);
      }
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Não foi possível salvar a garantia.');
    } finally {
      setSaving(false);
    }
  };

  const openNewCliente = () => {
    updateDraft({ clienteId: '', clienteMode: 'create', clienteForm: emptyClienteDraft() });
    setDrawer('cliente');
  };

  const openEditCliente = () => {
    if (!selectedCliente) return;
    updateDraft({ clienteMode: 'edit', clienteForm: clienteToDraft(selectedCliente) });
    setDrawer('cliente');
  };

  const openNewEquipamento = () => {
    updateDraft({ equipamentoId: '', equipamentoMode: 'create', equipamentoForm: emptyEquipamentoDraft() });
    setDrawer('equipamento');
  };

  const openEditEquipamento = () => {
    if (!selectedEquipamento) return;
    updateDraft({ equipamentoMode: 'edit', equipamentoForm: equipamentoToDraft(selectedEquipamento) });
    setDrawer('equipamento');
  };

  return (
    <div
      ref={layerRef}
      className="fixed inset-0 z-50 flex bg-black/80 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="warranty-wizard-title"
      onKeyDown={(event) => trapFocus(event, () => {
        if (!saving) onRequestClose(dirty);
      })}
    >
      <div className="flex min-h-0 w-full flex-col bg-background lg:m-4 lg:rounded-2xl lg:border lg:border-border lg:shadow-panel">
        <header className="flex shrink-0 items-center justify-between gap-3 border-b border-border bg-surface px-4 py-3 sm:px-6">
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-[0.14em] text-primary">{draft.editingGarantiaId ? 'Editar registro' : 'Novo registro'}</p>
            <h2 id="warranty-wizard-title" className="truncate text-lg font-semibold text-text-primary sm:text-xl">
              {draft.editingGarantiaId || 'Cadastrar garantia'}
            </h2>
          </div>
          <button type="button" onClick={() => onRequestClose(dirty)} disabled={saving} className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-border text-text-secondary hover:bg-surface-hover hover:text-text-primary disabled:opacity-50" aria-label="Fechar formulário">
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </header>

        <div className="shrink-0 overflow-x-auto border-b border-border bg-surface px-4 py-3 sm:px-6">
          <ol className="mx-auto flex min-w-[620px] max-w-5xl items-center" aria-label="Etapas do cadastro">
            {STEPS.map(({ label, icon: Icon }, index) => {
              const number = index + 1;
              const complete = step > number;
              const active = step === number;
              return (
                <li key={label} className="flex flex-1 items-center last:flex-none" aria-current={active ? 'step' : undefined}>
                  <button type="button" onClick={() => number < step && setStep(number)} disabled={number > step || saving} className="group flex min-h-11 items-center gap-2 rounded-lg px-1 disabled:cursor-default">
                    <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full border text-xs font-semibold ${complete ? 'border-primary bg-primary text-white' : active ? 'border-primary bg-primary-soft text-primary' : 'border-border bg-surface-elevated text-text-muted'}`}>
                      {complete ? <Check className="h-4 w-4" aria-hidden="true" /> : <Icon className="h-4 w-4" aria-hidden="true" />}
                    </span>
                    <span className={`text-xs font-semibold ${active || complete ? 'text-text-primary' : 'text-text-muted'}`}>{label}</span>
                  </button>
                  {number < STEPS.length && <span className={`mx-2 h-px flex-1 ${complete ? 'bg-primary' : 'bg-border'}`} aria-hidden="true" />}
                </li>
              );
            })}
          </ol>
        </div>

        <form onSubmit={(event) => void handleSubmit(event)} className="flex min-h-0 flex-1 flex-col">
          <div className="flex-1 overflow-y-auto px-4 py-5 sm:px-6 lg:px-10">
            <div className="mx-auto max-w-5xl">
              {step === 1 && (
                <StepSection eyebrow="Etapa 1 de 5" title="Dados da garantia" description="Defina a entrada, o responsável e o prazo de atendimento.">
                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                    <label><span className={labelClass}>Data de entrada *</span><input data-autofocus type="date" value={draft.dataEntrada} onChange={(event) => updateDraft({ dataEntrada: event.target.value })} className={controlClass} required /></label>
                    <label><span className={labelClass}>Responsável *</span><select value={draft.responsavelId} onChange={(event) => updateDraft({ responsavelId: event.target.value })} className={controlClass} required><option value="">Selecione</option>{usuarios.filter((usuario) => usuario.ativo).map((usuario) => <option key={usuario.id} value={usuario.id}>{usuario.nome}</option>)}</select></label>
                    <label><span className={labelClass}>Status *</span><select value={draft.status} onChange={(event) => selectStatus(event.target.value as StatusGarantia)} className={controlClass}>{Object.values(StatusGarantia).map((status) => <option key={status} value={status}>{status}</option>)}</select></label>
                    <label><span className={labelClass}>Prazo (dias) *</span><input type="number" min={1} max={3650} value={draft.prazoDias} onChange={(event) => updateDraft({ prazoDias: Number(event.target.value) })} className={controlClass} required /></label>
                    {FINAL_STATUSES.has(draft.status) && <label className="md:col-span-2"><span className={labelClass}>Data de encerramento *</span><input type="date" min={draft.dataEntrada || undefined} value={draft.dataEncerramento} onChange={(event) => updateDraft({ dataEncerramento: event.target.value })} className={controlClass} required /></label>}
                  </div>
                  <div className="mt-6 rounded-xl border border-border bg-surface-elevated p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs text-text-muted">Status atual</p><div className="mt-2"><StatusBadge status={draft.status} /></div></div><div className="text-right"><p className="text-xs text-text-muted">Previsão de atendimento</p><p className="mt-1 font-mono text-sm font-semibold text-text-primary">{calculateDueDate(draft.dataEntrada, draft.prazoDias)}</p></div></div>
                  </div>
                </StepSection>
              )}

              {step === 2 && (
                <StepSection eyebrow="Etapa 2 de 5" title="Cliente" description="Pesquise um cliente existente ou prepare um novo cadastro.">
                  <SearchField
                    id="warranty-client-search"
                    value={clienteSearch}
                    onChange={(value) => {
                      setClienteSearch(value);
                      setClienteListOpen(true);
                    }}
                    onFocus={() => setClienteListOpen(true)}
                    onKeyDown={handleClienteComboboxKeyDown}
                    placeholder="Pesquisar por nome, contato ou cidade"
                    label="Pesquisar clientes"
                    listboxId={CLIENT_LISTBOX_ID}
                    expanded={clienteListOpen}
                    activeDescendant={clienteListOpen && activeClienteId ? optionDomId('warranty-client-option', activeClienteId) : undefined}
                  />
                  <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(18rem,.65fr)]">
                    <div id={CLIENT_LISTBOX_ID} hidden={!clienteListOpen} className="max-h-[25rem] overflow-y-auto rounded-xl border border-border bg-surface-elevated p-2" role="listbox" aria-label="Clientes encontrados">
                      {visibleClientes.length ? visibleClientes.map((cliente) => {
                        const selected = draft.clienteMode === 'select' && cliente.id === draft.clienteId;
                        const active = cliente.id === activeClienteId;
                        return (
                          <button
                            key={cliente.id}
                            id={optionDomId('warranty-client-option', cliente.id)}
                            type="button"
                            role="option"
                            tabIndex={-1}
                            aria-selected={selected}
                            onMouseDown={(event) => event.preventDefault()}
                            onMouseEnter={() => setActiveClienteId(cliente.id)}
                            onClick={() => selectCliente(cliente)}
                            className={`mb-1 flex min-h-14 w-full items-center justify-between gap-3 rounded-lg border px-3 py-2 text-left last:mb-0 ${selected ? 'border-primary bg-primary-soft' : active ? 'border-primary/70 bg-surface-hover' : 'border-transparent hover:border-border hover:bg-surface-hover'}`}
                          >
                            <span className="min-w-0"><span className="block truncate text-sm font-semibold text-text-primary">{cliente.nome}</span><span className="mt-0.5 block truncate text-xs text-text-muted">{cliente.contato || 'Sem contato'} · {[cliente.cidade, cliente.estado].filter(Boolean).join(' / ') || 'Local não informado'}</span></span>
                            {selected && <CheckCircle2 className="h-5 w-5 shrink-0 text-primary" aria-hidden="true" />}
                          </button>
                        );
                      }) : <EmptySearch label="Nenhum cliente corresponde à pesquisa." />}
                    </div>
                    <SummaryCard icon={Building2} title="Cliente selecionado">
                      {draft.clienteMode === 'select' && selectedCliente ? <><SummaryLine label="Nome" value={selectedCliente.nome} /><SummaryLine label="Contato" value={selectedCliente.contato || 'Não informado'} /><SummaryLine label="Local" value={[selectedCliente.cidade, selectedCliente.estado].filter(Boolean).join(' / ') || 'Não informado'} /><button type="button" onClick={openEditCliente} className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-border text-xs font-semibold text-text-secondary hover:bg-surface-hover hover:text-text-primary"><Pencil className="h-4 w-4" aria-hidden="true" /> Editar cliente</button></> : draft.clienteMode !== 'select' ? <><p className="rounded-lg border border-warning/25 bg-warning/10 p-3 text-xs text-warning">{draft.clienteMode === 'create' ? 'Novo cliente será criado ao salvar.' : 'Alterações serão aplicadas ao salvar.'}</p><SummaryLine label="Nome" value={draft.clienteForm.nome || 'Preencha os dados'} /><button type="button" onClick={() => setDrawer('cliente')} className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-border text-xs font-semibold text-text-secondary hover:bg-surface-hover"><Pencil className="h-4 w-4" aria-hidden="true" /> Continuar edição</button></> : <p className="text-sm text-text-muted">Selecione um cliente na lista.</p>}
                      <button type="button" onClick={openNewCliente} className="mt-2 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-primary px-3 text-xs font-semibold text-white hover:bg-primary-hover"><Plus className="h-4 w-4" aria-hidden="true" /> Novo cliente</button>
                    </SummaryCard>
                  </div>
                </StepSection>
              )}

              {step === 3 && (
                <StepSection eyebrow="Etapa 3 de 5" title="Equipamento" description="Equipamentos já vinculados permanecem visíveis, mas não podem ser selecionados.">
                  <SearchField
                    id="warranty-equipment-search"
                    value={equipamentoSearch}
                    onChange={(value) => {
                      setEquipamentoSearch(value);
                      setEquipamentoListOpen(true);
                    }}
                    onFocus={() => setEquipamentoListOpen(true)}
                    onKeyDown={handleEquipamentoComboboxKeyDown}
                    placeholder="Pesquisar por série, modelo ou potência"
                    label="Pesquisar equipamentos"
                    listboxId={EQUIPMENT_LISTBOX_ID}
                    expanded={equipamentoListOpen}
                    activeDescendant={equipamentoListOpen && activeEquipamentoId ? optionDomId('warranty-equipment-option', activeEquipamentoId) : undefined}
                  />
                  <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(18rem,.65fr)]">
                    <div id={EQUIPMENT_LISTBOX_ID} hidden={!equipamentoListOpen} className="max-h-[25rem] overflow-y-auto rounded-xl border border-border bg-surface-elevated p-2" role="listbox" aria-label="Equipamentos encontrados">
                      {visibleEquipamentos.length ? visibleEquipamentos.map((equipamento) => {
                        const ocupada = getOccupyingWarranty(equipamento.id);
                        const selected = draft.equipamentoMode === 'select' && equipamento.id === draft.equipamentoId;
                        const active = equipamento.id === activeEquipamentoId;
                        return (
                          <button
                            key={equipamento.id}
                            id={optionDomId('warranty-equipment-option', equipamento.id)}
                            type="button"
                            role="option"
                            tabIndex={-1}
                            aria-selected={selected}
                            aria-disabled={Boolean(ocupada)}
                            disabled={Boolean(ocupada)}
                            onMouseDown={(event) => event.preventDefault()}
                            onMouseEnter={() => !ocupada && setActiveEquipamentoId(equipamento.id)}
                            onClick={() => selectEquipamento(equipamento)}
                            className={`mb-1 flex min-h-16 w-full items-center justify-between gap-3 rounded-lg border px-3 py-2 text-left last:mb-0 ${ocupada ? 'cursor-not-allowed border-transparent bg-surface opacity-55' : selected ? 'border-primary bg-primary-soft' : active ? 'border-primary/70 bg-surface-hover' : 'border-transparent hover:border-border hover:bg-surface-hover'}`}
                          >
                            <span className="min-w-0"><span className="block truncate font-mono text-sm font-semibold text-text-primary">{equipamento.numeroSerie}</span><span className="mt-0.5 block truncate text-xs text-text-muted">{equipamento.modelo} · {equipamento.potencia || 'Potência não informada'}</span>{ocupada && <span className="mt-1 block text-[11px] font-semibold text-warning">Indisponível · {ocupada.id}</span>}</span>
                            {selected && <CheckCircle2 className="h-5 w-5 shrink-0 text-primary" aria-hidden="true" />}
                          </button>
                        );
                      }) : <EmptySearch label="Nenhum equipamento corresponde à pesquisa." />}
                    </div>
                    <SummaryCard icon={Cpu} title="Equipamento selecionado">
                      {draft.equipamentoMode === 'select' && selectedEquipamento ? <><SummaryLine label="Série" value={selectedEquipamento.numeroSerie} mono /><SummaryLine label="Modelo" value={selectedEquipamento.modelo} /><SummaryLine label="Potência" value={selectedEquipamento.potencia || 'Não informada'} /><button type="button" onClick={openEditEquipamento} className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-border text-xs font-semibold text-text-secondary hover:bg-surface-hover hover:text-text-primary"><Pencil className="h-4 w-4" aria-hidden="true" /> Editar equipamento</button></> : draft.equipamentoMode !== 'select' ? <><p className="rounded-lg border border-warning/25 bg-warning/10 p-3 text-xs text-warning">{draft.equipamentoMode === 'create' ? 'Novo equipamento será criado ao salvar.' : 'Alterações serão aplicadas ao salvar.'}</p><SummaryLine label="Série" value={draft.equipamentoForm.numeroSerie || 'Preencha os dados'} mono /><button type="button" onClick={() => setDrawer('equipamento')} className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-border text-xs font-semibold text-text-secondary hover:bg-surface-hover"><Pencil className="h-4 w-4" aria-hidden="true" /> Continuar edição</button></> : <p className="text-sm text-text-muted">Selecione um equipamento disponível.</p>}
                      <button type="button" onClick={openNewEquipamento} className="mt-2 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-primary px-3 text-xs font-semibold text-white hover:bg-primary-hover"><Plus className="h-4 w-4" aria-hidden="true" /> Novo equipamento</button>
                    </SummaryCard>
                  </div>
                </StepSection>
              )}

              {step === 4 && (
                <StepSection eyebrow="Etapa 4 de 5" title="Ocorrência" description="Registre a reclamação original e as observações do atendimento.">
                  <div className="grid gap-6 lg:grid-cols-2">
                    <label><span className={labelClass}>Descrição da reclamação *</span><textarea data-autofocus rows={8} value={draft.descricaoReclamacao} onChange={(event) => updateDraft({ descricaoReclamacao: event.target.value })} placeholder="Descreva detalhadamente o problema relatado pelo cliente." className={`${controlClass} resize-y py-3`} required /><span className="mt-2 flex flex-wrap gap-2"><SuggestionButton onClick={() => updateDraft({ descricaoReclamacao: 'Bobina queimada com forte cheiro de verniz e alteração na relação.' })}>Bobina queimada</SuggestionButton><SuggestionButton onClick={() => updateDraft({ descricaoReclamacao: 'Vazamento de óleo isolante identificado durante inspeção visual.' })}>Vazamento de óleo</SuggestionButton></span></label>
                    <label><span className={labelClass}>Observações gerais / resolução</span><textarea rows={8} value={draft.observacoesGerais} onChange={(event) => updateDraft({ observacoesGerais: event.target.value })} placeholder="Registre laudo, peças solicitadas e serviços realizados." className={`${controlClass} resize-y py-3`} /><span className="mt-2 flex flex-wrap gap-2"><SuggestionButton onClick={() => updateDraft({ observacoesGerais: 'Bobina substituída. Teste térmico e reaperto geral concluídos.' })}>Bobina substituída</SuggestionButton><SuggestionButton onClick={() => updateDraft({ observacoesGerais: 'Juntas de vedação substituídas e estanqueidade validada.' })}>Vedação validada</SuggestionButton></span></label>
                  </div>
                </StepSection>
              )}

              {step === 5 && (
                <StepSection eyebrow="Etapa 5 de 5" title="Revisão" description="Confira todas as informações antes de confirmar a gravação.">
                  <div className="grid gap-4 lg:grid-cols-2">
                    <ReviewCard title="Garantia" onEdit={() => setStep(1)}><SummaryLine label="Código" value={draft.editingGarantiaId || 'Gerado automaticamente'} mono /><SummaryLine label="Entrada" value={formatDate(draft.dataEntrada)} /><SummaryLine label="Responsável" value={selectedResponsavel?.nome || 'Não selecionado'} /><SummaryLine label="Status" value={draft.status} /><SummaryLine label="Prazo" value={`${draft.prazoDias} dias`} />{FINAL_STATUSES.has(draft.status) && <SummaryLine label="Encerramento" value={formatDate(draft.dataEncerramento)} />}</ReviewCard>
                    <ReviewCard title="Cliente" onEdit={() => setStep(2)}><SummaryLine label="Operação" value={draft.clienteMode === 'create' ? 'Criar novo' : draft.clienteMode === 'edit' ? 'Atualizar existente' : 'Usar existente'} /><SummaryLine label="Nome" value={draft.clienteMode === 'select' ? selectedCliente?.nome || 'Não selecionado' : draft.clienteForm.nome || 'Não preenchido'} /><SummaryLine label="Contato" value={draft.clienteMode === 'select' ? selectedCliente?.contato || 'Não informado' : draft.clienteForm.contato || 'Não informado'} /></ReviewCard>
                    <ReviewCard title="Equipamento" onEdit={() => setStep(3)}><SummaryLine label="Operação" value={draft.equipamentoMode === 'create' ? 'Criar novo' : draft.equipamentoMode === 'edit' ? 'Atualizar existente' : 'Usar existente'} /><SummaryLine label="Série" value={draft.equipamentoMode === 'select' ? selectedEquipamento?.numeroSerie || 'Não selecionado' : draft.equipamentoForm.numeroSerie || 'Não preenchida'} mono /><SummaryLine label="Modelo" value={draft.equipamentoMode === 'select' ? selectedEquipamento?.modelo || 'Não informado' : draft.equipamentoForm.modelo || 'Não informado'} /></ReviewCard>
                    <ReviewCard title="Ocorrência" onEdit={() => setStep(4)}><SummaryLine label="Reclamação" value={draft.descricaoReclamacao || 'Não informada'} /><SummaryLine label="Observações" value={draft.observacoesGerais || 'Não informadas'} /></ReviewCard>
                  </div>
                  <div className="mt-4 flex gap-3 rounded-xl border border-information/25 bg-information/10 p-4 text-sm text-information"><ClipboardCheck className="h-5 w-5 shrink-0" aria-hidden="true" /><p>Cliente e equipamento são salvos antes da garantia. Se uma etapa posterior falhar, os dados já gravados serão recarregados e identificados antes de uma nova tentativa.</p></div>
                </StepSection>
              )}

              {error && <div id="warranty-form-error" role="alert" className="mt-5 rounded-xl border border-danger/35 bg-danger/10 p-3 text-sm font-medium text-danger">{error}</div>}
            </div>
          </div>

          <footer className="shrink-0 border-t border-border bg-surface px-4 py-3 sm:px-6">
            <div className="mx-auto flex max-w-5xl flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
              <button type="button" onClick={() => onRequestClose(dirty)} disabled={saving} className="min-h-11 rounded-xl border border-border px-4 text-sm font-semibold text-text-secondary hover:bg-surface-hover hover:text-text-primary disabled:opacity-50">Cancelar</button>
              <div className="flex gap-2">
                {step > 1 && <button type="button" onClick={() => { setError(''); setStep((current) => current - 1); }} disabled={saving} className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-border px-4 text-sm font-semibold text-text-secondary hover:bg-surface-hover hover:text-text-primary disabled:opacity-50 sm:flex-none"><ArrowLeft className="h-4 w-4" aria-hidden="true" /> Voltar</button>}
                <button type="submit" disabled={saving} className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-semibold text-white hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-55 sm:flex-none">{saving ? <><Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Salvando…</> : step < 5 ? <>Continuar <ArrowRight className="h-4 w-4" aria-hidden="true" /></> : <><Check className="h-4 w-4" aria-hidden="true" /> {draft.editingGarantiaId ? 'Salvar alterações' : 'Cadastrar garantia'}</>}</button>
              </div>
            </div>
          </footer>
        </form>
      </div>

      {drawer === 'cliente' && (
        <EntityDrawer title={draft.clienteMode === 'create' ? 'Novo cliente' : 'Editar cliente'} description="Os dados serão persistidos somente ao concluir a garantia." onClose={() => setDrawer(null)}>
          <div className="space-y-4">
            <label><span className={labelClass}>Razão social / nome fantasia *</span><input data-autofocus value={draft.clienteForm.nome} onChange={(event) => updateClienteForm({ nome: event.target.value })} className={controlClass} /></label>
            <label><span className={labelClass}>Contato principal</span><input value={draft.clienteForm.contato} onChange={(event) => updateClienteForm({ contato: event.target.value })} className={controlClass} /></label>
            <label><span className={labelClass}>Telefone</span><input type="tel" value={draft.clienteForm.telefone} onChange={(event) => updateClienteForm({ telefone: event.target.value })} className={controlClass} /></label>
            <label><span className={labelClass}>E-mail</span><input type="email" value={draft.clienteForm.email} onChange={(event) => updateClienteForm({ email: event.target.value })} className={controlClass} /></label>
            <div className="grid grid-cols-[minmax(0,1fr)_6rem] gap-3"><label><span className={labelClass}>Cidade</span><input value={draft.clienteForm.cidade} onChange={(event) => updateClienteForm({ cidade: event.target.value })} className={controlClass} /></label><label><span className={labelClass}>UF</span><input maxLength={2} value={draft.clienteForm.estado} onChange={(event) => updateClienteForm({ estado: event.target.value.toUpperCase() })} className={controlClass} /></label></div>
          </div>
        </EntityDrawer>
      )}

      {drawer === 'equipamento' && (
        <EntityDrawer title={draft.equipamentoMode === 'create' ? 'Novo equipamento' : 'Editar equipamento'} description="Número de série deve ser único. A gravação ocorrerá ao concluir a garantia." onClose={() => setDrawer(null)}>
          <div className="space-y-4">
            <label><span className={labelClass}>Número de série *</span><input data-autofocus value={draft.equipamentoForm.numeroSerie} onChange={(event) => updateEquipamentoForm({ numeroSerie: event.target.value.toUpperCase() })} className={`${controlClass} font-mono`} /></label>
            <label>
              <span className={labelClass}>Modelo / tipo *</span>
              <input value={draft.equipamentoForm.modelo} onChange={(event) => updateModeloEquipamento(event.target.value)} placeholder="Ex.: DMB525406" className={controlClass} />
            </label>
            <label>
              <span className={labelClass}>Potência nominal</span>
              <input value={draft.equipamentoForm.potencia} onChange={(event) => updateEquipamentoForm({ potencia: event.target.value })} placeholder="Ex.: 500 kVA" className={controlClass} />
              {draft.equipamentoForm.modelo.trim().length >= 3 && (
                <span className={`mt-1.5 block text-xs ${obterPotenciaSugerida(draft.equipamentoForm.modelo) ? 'text-success' : 'text-warning'}`}>
                  {obterPotenciaSugerida(draft.equipamentoForm.modelo)
                    ? `Potência sugerida pela 3ª letra do modelo: ${obterPotenciaSugerida(draft.equipamentoForm.modelo)}. O valor pode ser alterado.`
                    : 'Potência não identificada pelo modelo. Informe o valor manualmente.'}
                </span>
              )}
            </label>
            <label><span className={labelClass}>Tensão nominal</span><input value={draft.equipamentoForm.tensao} onChange={(event) => updateEquipamentoForm({ tensao: event.target.value })} placeholder="13.8 kV / 380 V" className={controlClass} /></label>
            <div className="grid gap-3 sm:grid-cols-2"><label><span className={labelClass}>Data de fabricação</span><input type="date" value={draft.equipamentoForm.dataFabricacao} onChange={(event) => updateEquipamentoForm({ dataFabricacao: event.target.value })} className={controlClass} /></label><label><span className={labelClass}>Data da venda</span><input type="date" min={draft.equipamentoForm.dataFabricacao || undefined} value={draft.equipamentoForm.dataVenda} onChange={(event) => updateEquipamentoForm({ dataVenda: event.target.value })} className={controlClass} /></label></div>
          </div>
        </EntityDrawer>
      )}
    </div>
  );
}

function StepSection({ eyebrow, title, description, children }: { eyebrow: string; title: string; description: string; children: React.ReactNode }) {
  return <section><p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">{eyebrow}</p><h3 className="mt-1 text-xl font-semibold text-text-primary sm:text-2xl">{title}</h3><p className="mt-2 max-w-2xl text-sm leading-6 text-text-secondary">{description}</p><div className="mt-6">{children}</div></section>;
}

function SearchField({
  id,
  value,
  onChange,
  onFocus,
  onKeyDown,
  placeholder,
  label,
  listboxId,
  expanded,
  activeDescendant,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  onFocus: () => void;
  onKeyDown: React.KeyboardEventHandler<HTMLInputElement>;
  placeholder: string;
  label: string;
  listboxId: string;
  expanded: boolean;
  activeDescendant?: string;
}) {
  return (
    <label htmlFor={id}>
      <span className="sr-only">{label}</span>
      <span className="relative block">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" aria-hidden="true" />
        <input
          id={id}
          data-autofocus
          type="search"
          role="combobox"
          aria-autocomplete="list"
          aria-haspopup="listbox"
          aria-expanded={expanded}
          aria-controls={listboxId}
          aria-activedescendant={expanded ? activeDescendant : undefined}
          autoComplete="off"
          value={value}
          onFocus={onFocus}
          onKeyDown={onKeyDown}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          className={`${controlClass} pl-10`}
        />
      </span>
    </label>
  );
}

function SummaryCard({ icon: Icon, title, children }: { icon: typeof Building2; title: string; children: React.ReactNode }) {
  return <aside className="rounded-xl border border-border bg-surface-elevated p-4"><div className="mb-4 flex items-center gap-2"><span className="grid h-9 w-9 place-items-center rounded-lg bg-primary-soft text-primary"><Icon className="h-4 w-4" aria-hidden="true" /></span><h4 className="text-sm font-semibold text-text-primary">{title}</h4></div>{children}</aside>;
}

function SummaryLine({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return <div className="border-b border-border py-2.5 last:border-0"><dt className="text-[11px] uppercase tracking-wide text-text-muted">{label}</dt><dd className={`mt-1 break-words text-sm text-text-primary ${mono ? 'font-mono' : ''}`}>{value}</dd></div>;
}

function ReviewCard({ title, onEdit, children }: { title: string; onEdit: () => void; children: React.ReactNode }) {
  return <section className="rounded-xl border border-border bg-surface-elevated p-4"><div className="mb-2 flex items-center justify-between"><h4 className="text-sm font-semibold text-text-primary">{title}</h4><button type="button" onClick={onEdit} className="inline-flex min-h-11 items-center gap-1 rounded-lg px-3 text-xs font-semibold text-primary hover:bg-primary-soft"><Pencil className="h-3.5 w-3.5" aria-hidden="true" /> Editar</button></div><dl>{children}</dl></section>;
}

function SuggestionButton({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return <button type="button" onClick={onClick} className="min-h-11 rounded-full border border-border bg-surface-elevated px-3 text-[11px] font-semibold text-text-secondary hover:border-primary/40 hover:bg-primary-soft hover:text-primary">{children}</button>;
}

function EmptySearch({ label }: { label: string }) {
  return <p className="px-4 py-10 text-center text-sm text-text-muted">{label}</p>;
}

function EntityDrawer({ title, description, onClose, children }: { title: string; description: string; onClose: () => void; children: React.ReactNode }) {
  const layerRef = useInitialDialogFocus(true);
  return (
    <div ref={layerRef} className="fixed inset-0 z-[70] flex justify-end bg-black/65 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="entity-drawer-title" onKeyDown={(event) => { event.stopPropagation(); trapFocus(event, onClose); }}>
      <div className="flex h-full w-full max-w-lg flex-col border-l border-border bg-surface shadow-panel">
        <header className="flex items-start justify-between gap-3 border-b border-border p-5"><div><h3 id="entity-drawer-title" className="text-lg font-semibold text-text-primary">{title}</h3><p className="mt-1 text-sm text-text-secondary">{description}</p></div><button type="button" onClick={onClose} className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-border text-text-secondary hover:bg-surface-hover hover:text-text-primary" aria-label="Fechar painel"><X className="h-5 w-5" aria-hidden="true" /></button></header>
        <div className="flex-1 overflow-y-auto p-5">{children}</div>
        <footer className="border-t border-border p-5"><button type="button" onClick={onClose} className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-white hover:bg-primary-hover"><Check className="h-4 w-4" aria-hidden="true" /> Usar estes dados</button></footer>
      </div>
    </div>
  );
}

function calculateDueDate(date: string, days: number): string {
  if (!date || !Number.isFinite(days)) return '—';
  const [year, month, day] = date.split('-').map(Number);
  if (!year || !month || !day) return '—';
  const due = new Date(year, month - 1, day);
  due.setDate(due.getDate() + days);
  return due.toLocaleDateString('pt-BR');
}
