/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type React from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ClipboardList, Plus, ShieldCheck } from 'lucide-react';
import { DBState, Garantia, StatusGarantia, Usuario } from '../types';
import {
  atualizarCliente,
  atualizarEquipamento,
  atualizarGarantia,
  buscarEstadoCompleto,
  criarCliente,
  criarEquipamento,
  criarGarantia,
  excluirGarantia,
} from '../services/api';
import { GarantiaFilters } from './garantias/GarantiaFilters';
import { GarantiaList } from './garantias/GarantiaList';
import { GarantiaWizard } from './garantias/GarantiaWizard';
import { ConfirmDialog, Pagination, ToastKind, ToastRegion, WarrantyToast } from './garantias/GarantiaUi';
import {
  EMPTY_FILTERS,
  FINAL_STATUSES,
  RequestedWarrantyAction,
  WarrantyDraft,
  WarrantyFiltersState,
  WarrantySaveOutcome,
  createWarrantyDraft,
  emptyClienteDraft,
  emptyEquipamentoDraft,
  garantiaToDraft,
  getLocalDate,
  normalizeUniqueText,
} from './garantias/models';

interface CadastroGarantiasProps {
  db: DBState;
  onUpdateState: (newState: DBState) => void;
  currentUser: Usuario | null;
  onSelectGarantia: (garantia: Garantia) => void;
  requestedAction?: RequestedWarrantyAction;
  onActionHandled?: () => void;
}

type ConfirmationState =
  | { type: 'discard' }
  | { type: 'delete'; garantia: Garantia }
  | null;

const PAGE_SIZE = 10;

export const CadastroGarantias: React.FC<CadastroGarantiasProps> = ({
  db,
  onUpdateState,
  currentUser,
  onSelectGarantia,
  requestedAction,
  onActionHandled,
}) => {
  const { garantias, clientes, equipamentos, usuarios } = db;
  const [filters, setFilters] = useState<WarrantyFiltersState>(EMPTY_FILTERS);
  const [page, setPage] = useState(1);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardDraft, setWizardDraft] = useState<WarrantyDraft>(() => createWarrantyDraft(currentUser));
  const [confirmation, setConfirmation] = useState<ConfirmationState>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [toasts, setToasts] = useState<WarrantyToast[]>([]);
  const toastId = useRef(0);
  const handledActionNonce = useRef<number | null>(null);

  const notify = useCallback((message: string, kind: ToastKind = 'info') => {
    const id = ++toastId.current;
    setToasts((current) => [...current, { id, message, kind }]);
    globalThis.setTimeout(() => {
      setToasts((current) => current.filter((toast) => toast.id !== id));
    }, 5000);
  }, []);

  const dismissToast = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const filteredGarantias = useMemo(() => {
    const search = filters.search.trim().toLocaleLowerCase('pt-BR');
    return garantias.filter((garantia) => {
      const cliente = clientes.find((item) => item.id === garantia.clienteId);
      const equipamento = equipamentos.find((item) => item.id === garantia.equipamentoId);
      const matchesSearch = !search || [
        garantia.id,
        cliente?.nome,
        equipamento?.numeroSerie,
        equipamento?.modelo,
      ].some((value) => (value || '').toLocaleLowerCase('pt-BR').includes(search));
      const matchesStatus = filters.status === 'todos' || garantia.status === filters.status;
      const matchesResponsavel = filters.responsavel === 'todos' || garantia.responsavelId === filters.responsavel;
      const matchesStart = !filters.dataInicio || garantia.dataEntrada >= filters.dataInicio;
      const matchesEnd = !filters.dataFim || garantia.dataEntrada <= filters.dataFim;
      return matchesSearch && matchesStatus && matchesResponsavel && matchesStart && matchesEnd;
    });
  }, [clientes, equipamentos, filters, garantias]);

  const pageCount = Math.max(1, Math.ceil(filteredGarantias.length / PAGE_SIZE));
  const pagedGarantias = filteredGarantias.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  useEffect(() => {
    if (page > pageCount) setPage(pageCount);
  }, [page, pageCount]);

  const handleFiltersChange = (nextFilters: WarrantyFiltersState) => {
    setFilters(nextFilters);
    setPage(1);
  };

  const openCreate = useCallback(() => {
    setWizardDraft(createWarrantyDraft(currentUser));
    setWizardOpen(true);
  }, [currentUser]);

  const openEdit = useCallback((garantia: Garantia) => {
    setWizardDraft(garantiaToDraft(garantia));
    setWizardOpen(true);
  }, []);

  useEffect(() => {
    if (!requestedAction || handledActionNonce.current === requestedAction.nonce) return;
    handledActionNonce.current = requestedAction.nonce;

    if (requestedAction.type === 'create') {
      openCreate();
    } else {
      const garantia = garantias.find((item) => item.id === requestedAction.garantiaId);
      if (garantia) openEdit(garantia);
      else notify('A garantia solicitada para edição não foi encontrada.', 'error');
    }
    onActionHandled?.();
  }, [garantias, notify, onActionHandled, openCreate, openEdit, requestedAction]);

  const requestWizardClose = (dirty: boolean) => {
    if (dirty) setConfirmation({ type: 'discard' });
    else setWizardOpen(false);
  };

  const validateBeforeSave = (draft: WarrantyDraft): string | null => {
    if (!draft.dataEntrada || !draft.responsavelId) return 'Data de entrada e responsável são obrigatórios.';
    if (!draft.descricaoReclamacao.trim()) return 'A descrição da reclamação é obrigatória.';
    if (draft.clienteMode === 'select' && !draft.clienteId) return 'Selecione um cliente.';
    if (draft.equipamentoMode === 'select' && !draft.equipamentoId) return 'Selecione um equipamento.';

    if (draft.clienteMode !== 'select') {
      const nome = draft.clienteForm.nome.trim();
      if (!nome) return 'O nome do cliente é obrigatório.';
      const duplicado = clientes.some((cliente) => cliente.id !== draft.clienteForm.id && normalizeUniqueText(cliente.nome) === normalizeUniqueText(nome));
      if (duplicado) return `O cliente “${nome}” já está cadastrado.`;
    }

    if (draft.equipamentoMode !== 'select') {
      const serie = draft.equipamentoForm.numeroSerie.trim();
      const modelo = draft.equipamentoForm.modelo.trim();
      if (!serie || !modelo) return 'Número de série e modelo são obrigatórios.';
      const duplicado = equipamentos.some((equipamento) => equipamento.id !== draft.equipamentoForm.id && normalizeUniqueText(equipamento.numeroSerie) === normalizeUniqueText(serie));
      if (duplicado) return `O número de série “${serie.toUpperCase()}” já está cadastrado.`;
    }

    const equipamentoId = draft.equipamentoMode === 'select' ? draft.equipamentoId : draft.equipamentoForm.id;
    if (equipamentoId) {
      const ocupada = garantias.find((garantia) => garantia.equipamentoId === equipamentoId && garantia.id !== draft.editingGarantiaId);
      if (ocupada) return `Este equipamento já possui a garantia ${ocupada.id}.`;
    }
    return null;
  };

  const saveWarranty = async (originalDraft: WarrantyDraft): Promise<WarrantySaveOutcome> => {
    const validationError = validateBeforeSave(originalDraft);
    if (validationError) {
      notify(validationError, 'error');
      return { ok: false, draft: originalDraft, partial: false };
    }

    let nextDraft: WarrantyDraft = {
      ...originalDraft,
      clienteForm: { ...originalDraft.clienteForm },
      equipamentoForm: { ...originalDraft.equipamentoForm },
    };
    let partial = false;
    let warrantyPersisted = false;
    const wasEditing = Boolean(originalDraft.editingGarantiaId);

    try {
      let clienteId = nextDraft.clienteId;
      if (nextDraft.clienteMode !== 'select') {
        const payload = {
          nome: nextDraft.clienteForm.nome.trim(),
          contato: nextDraft.clienteForm.contato.trim(),
          telefone: nextDraft.clienteForm.telefone.trim(),
          email: nextDraft.clienteForm.email.trim(),
          cidade: nextDraft.clienteForm.cidade.trim(),
          estado: nextDraft.clienteForm.estado.trim().toUpperCase(),
        };
        const saved = nextDraft.clienteMode === 'edit' && nextDraft.clienteForm.id
          ? await atualizarCliente(nextDraft.clienteForm.id, payload)
          : await criarCliente(payload);
        clienteId = saved.id;
        partial = true;
        nextDraft = { ...nextDraft, clienteId, clienteMode: 'select', clienteForm: emptyClienteDraft() };
      }

      let equipamentoId = nextDraft.equipamentoId;
      if (nextDraft.equipamentoMode !== 'select') {
        const payload = {
          numeroSerie: nextDraft.equipamentoForm.numeroSerie.trim().toUpperCase(),
          modelo: nextDraft.equipamentoForm.modelo.trim(),
          potencia: nextDraft.equipamentoForm.potencia.trim(),
          tensao: nextDraft.equipamentoForm.tensao.trim(),
          dataFabricacao: nextDraft.equipamentoForm.dataFabricacao,
          dataVenda: nextDraft.equipamentoForm.dataVenda,
        };
        const saved = nextDraft.equipamentoMode === 'edit' && nextDraft.equipamentoForm.id
          ? await atualizarEquipamento(nextDraft.equipamentoForm.id, payload)
          : await criarEquipamento(payload);
        equipamentoId = saved.id;
        partial = true;
        nextDraft = { ...nextDraft, equipamentoId, equipamentoMode: 'select', equipamentoForm: emptyEquipamentoDraft() };
      }

      const isFinal = FINAL_STATUSES.has(nextDraft.status);
      const payload = {
        dataEntrada: nextDraft.dataEntrada,
        clienteId,
        equipamentoId,
        descricaoReclamacao: nextDraft.descricaoReclamacao.trim(),
        responsavelId: nextDraft.responsavelId,
        status: nextDraft.status,
        observacoesGerais: nextDraft.observacoesGerais.trim(),
        prazoDias: nextDraft.prazoDias,
        dataEncerramento: isFinal ? (nextDraft.dataEncerramento || getLocalDate()) : undefined,
      };

      if (nextDraft.editingGarantiaId) {
        await atualizarGarantia(nextDraft.editingGarantiaId, payload);
      } else {
        const saved = await criarGarantia(payload);
        nextDraft = { ...nextDraft, editingGarantiaId: saved.id };
      }
      warrantyPersisted = true;
      partial = true;

      const refreshed = await buscarEstadoCompleto(currentUser?.id);
      onUpdateState(refreshed);
      notify(wasEditing ? 'Garantia atualizada com sucesso.' : 'Garantia cadastrada com sucesso.', 'success');
      return { ok: true, draft: nextDraft, partial };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Não foi possível salvar a garantia.';
      if (!warrantyPersisted && nextDraft.equipamentoId) {
        try {
          const refreshed = await buscarEstadoCompleto(currentUser?.id);
          onUpdateState(refreshed);
          const persistedAfterError = refreshed.garantias.find((garantia) =>
            (!wasEditing || garantia.id === nextDraft.editingGarantiaId)
            && garantia.equipamentoId === nextDraft.equipamentoId
            && garantia.clienteId === nextDraft.clienteId
            && garantia.dataEntrada === nextDraft.dataEntrada
            && garantia.status === nextDraft.status
            && garantia.descricaoReclamacao === nextDraft.descricaoReclamacao.trim()
          );
          if (persistedAfterError) {
            const recoveredDraft = garantiaToDraft(persistedAfterError);
            notify(`A garantia ${persistedAfterError.id} foi ${wasEditing ? 'atualizada' : 'gravada'}, mas uma etapa posterior falhou: ${message} O estado foi recarregado; revise o registro antes de tentar novamente.`, 'warning');
            return { ok: false, draft: recoveredDraft, partial: true };
          }
        } catch (refreshError) {
          console.error('Não foi possível conferir uma possível gravação parcial da garantia:', refreshError);
        }
      }
      if (warrantyPersisted) {
        try {
          const refreshed = await buscarEstadoCompleto(currentUser?.id);
          onUpdateState(refreshed);
          notify(wasEditing ? 'Garantia atualizada com sucesso.' : 'Garantia cadastrada com sucesso.', 'success');
          return { ok: true, draft: nextDraft, partial: true };
        } catch (refreshError) {
          console.error('Garantia gravada, mas o estado não pôde ser recarregado:', refreshError);
          notify(`A garantia foi gravada, mas a atualização da tela falhou: ${message} Evite criar outro registro e tente recarregar o sistema.`, 'warning');
          return { ok: false, draft: nextDraft, partial: true };
        }
      }
      if (partial) {
        try {
          const refreshed = await buscarEstadoCompleto(currentUser?.id);
          onUpdateState(refreshed);
        } catch (refreshError) {
          console.error('Falha ao recarregar estado após gravação parcial:', refreshError);
        }
        notify(`Parte dos dados foi gravada, mas a garantia não foi concluída: ${message} Revise e tente novamente.`, 'warning');
      } else {
        notify(message, 'error');
      }
      return { ok: false, draft: nextDraft, partial };
    }
  };

  const handleDelete = async () => {
    if (confirmation?.type !== 'delete') return;
    setDeleteBusy(true);
    try {
      await excluirGarantia(confirmation.garantia.id, currentUser?.id);
      const refreshed = await buscarEstadoCompleto(currentUser?.id);
      onUpdateState(refreshed);
      notify(`Garantia ${confirmation.garantia.id} excluída com sucesso.`, 'success');
      setConfirmation(null);
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Não foi possível excluir a garantia.', 'error');
    } finally {
      setDeleteBusy(false);
    }
  };

  const abertas = garantias.filter((garantia) => !FINAL_STATUSES.has(garantia.status)).length;
  const emAtendimento = garantias.filter((garantia) => [StatusGarantia.EM_ANALISE, StatusGarantia.AGUARDANDO_PECAS, StatusGarantia.EM_REPARO, StatusGarantia.TESTE_FINAL].includes(garantia.status)).length;

  return (
    <div className="space-y-5">
      <header className="rounded-2xl border border-border bg-surface p-5 shadow-panel sm:p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-4">
            <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-primary-soft text-primary">
              <ClipboardList className="h-6 w-6" aria-hidden="true" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.15em] text-primary">Operação de garantia</p>
              <h1 className="mt-1 text-2xl font-semibold tracking-tight text-text-primary">Garantias</h1>
              <p className="mt-1 max-w-2xl text-sm text-text-secondary">Cadastre, localize e acompanhe cada transformador recebido para análise.</p>
            </div>
          </div>
          <button type="button" onClick={openCreate} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-white shadow-lg shadow-primary/15 hover:bg-primary-hover focus:outline-none focus:ring-2 focus:ring-focus-ring/50">
            <Plus className="h-4 w-4" aria-hidden="true" /> Nova garantia
          </button>
        </div>
        <div className="mt-5 grid gap-3 border-t border-border pt-5 sm:grid-cols-3">
          <Metric label="Total registrado" value={garantias.length} />
          <Metric label="Garantias abertas" value={abertas} />
          <Metric label="Em atendimento" value={emAtendimento} />
        </div>
      </header>

      <GarantiaFilters filters={filters} usuarios={usuarios} resultCount={filteredGarantias.length} onChange={handleFiltersChange} />

      <section className="overflow-hidden rounded-2xl border border-border bg-surface shadow-panel" aria-labelledby="warranty-list-title">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
          <div>
            <h2 id="warranty-list-title" className="text-sm font-semibold text-text-primary">Registros de garantia</h2>
            <p className="mt-0.5 text-xs text-text-muted">Página {page} de {pageCount}</p>
          </div>
          <div className="inline-flex items-center gap-2 rounded-full border border-success/25 bg-success/10 px-3 py-1.5 text-xs font-medium text-success">
            <ShieldCheck className="h-4 w-4" aria-hidden="true" /> Regras de vínculo protegidas
          </div>
        </div>
        <GarantiaList garantias={pagedGarantias} clientes={clientes} equipamentos={equipamentos} usuarios={usuarios} onView={onSelectGarantia} onEdit={openEdit} onDelete={(garantia) => setConfirmation({ type: 'delete', garantia })} />
        <Pagination page={page} pageCount={pageCount} total={filteredGarantias.length} pageSize={PAGE_SIZE} onPageChange={setPage} />
      </section>

      {wizardOpen && (
        <GarantiaWizard
          initialDraft={wizardDraft}
          clientes={clientes}
          equipamentos={equipamentos}
          garantias={garantias}
          usuarios={usuarios}
          onRequestClose={requestWizardClose}
          onSave={saveWarranty}
          onSaved={() => setWizardOpen(false)}
        />
      )}

      <ConfirmDialog
        open={confirmation?.type === 'discard'}
        title="Descartar alterações?"
        description="O rascunho desta garantia será perdido. Registros já persistidos após uma falha parcial não serão removidos."
        confirmLabel="Descartar rascunho"
        destructive
        onCancel={() => setConfirmation(null)}
        onConfirm={() => { setConfirmation(null); setWizardOpen(false); }}
      />

      <ConfirmDialog
        open={confirmation?.type === 'delete'}
        title={`Excluir ${confirmation?.type === 'delete' ? confirmation.garantia.id : 'garantia'}?`}
        description="A garantia e seus vínculos de histórico e fotografias serão removidos conforme as regras do sistema. Esta ação não pode ser desfeita."
        confirmLabel="Excluir garantia"
        destructive
        busy={deleteBusy}
        onCancel={() => !deleteBusy && setConfirmation(null)}
        onConfirm={handleDelete}
      />

      <ToastRegion toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
};

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-border bg-surface-elevated px-4 py-3">
      <p className="text-xs text-text-muted">{label}</p>
      <p className="mt-1 font-mono text-xl font-semibold text-text-primary">{value}</p>
    </div>
  );
}
