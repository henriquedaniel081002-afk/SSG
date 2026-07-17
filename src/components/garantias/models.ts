import { Cliente, Equipamento, Garantia, StatusGarantia, Usuario } from '../../types';

export type EntityDraftMode = 'select' | 'create' | 'edit';

export interface RequestedWarrantyAction {
  type: 'create' | 'edit';
  garantiaId?: string;
  nonce: number;
}

export interface WarrantyFiltersState {
  search: string;
  status: string;
  responsavel: string;
  dataInicio: string;
  dataFim: string;
}

export interface ClienteFormDraft {
  id: string | null;
  nome: string;
  contato: string;
  telefone: string;
  email: string;
  cidade: string;
  estado: string;
}

export interface EquipamentoFormDraft {
  id: string | null;
  numeroSerie: string;
  modelo: string;
  potencia: string;
  tensao: string;
  dataFabricacao: string;
  dataVenda: string;
}

export interface WarrantyDraft {
  editingGarantiaId: string | null;
  dataEntrada: string;
  clienteId: string;
  clienteMode: EntityDraftMode;
  clienteForm: ClienteFormDraft;
  equipamentoId: string;
  equipamentoMode: EntityDraftMode;
  equipamentoForm: EquipamentoFormDraft;
  descricaoReclamacao: string;
  responsavelId: string;
  status: StatusGarantia;
  observacoesGerais: string;
  dataEncerramento: string;
  prazoDias: number;
}

export interface WarrantySaveOutcome {
  ok: boolean;
  draft: WarrantyDraft;
  partial: boolean;
}

export const EMPTY_FILTERS: WarrantyFiltersState = {
  search: '',
  status: 'todos',
  responsavel: 'todos',
  dataInicio: '',
  dataFim: '',
};

export const FINAL_STATUSES = new Set<StatusGarantia>([
  StatusGarantia.CONCLUIDO,
  StatusGarantia.ENCERRADO,
]);

export const POTENCIA_POR_TERCEIRA_LETRA: Readonly<Record<string, string>> = {
  A: '5',
  B: '10',
  C: '15',
  D: '15',
  E: '30',
  F: '45',
  G: '75',
  H: '112,5',
  I: '150',
  J: '225',
  L: '300',
  M: '500',
  N: '750',
  O: '1000',
  P: '1500',
  Q: '2000',
  R: '2500',
  S: '3000',
  U: '5000',
  W: '37,5',
  Z: '25',
};

export function obterPotenciaSugerida(modelo: string): string | null {
  const modeloNormalizado = modelo.trim().toLocaleUpperCase('pt-BR');
  if (modeloNormalizado.length < 3) return null;

  const potencia = POTENCIA_POR_TERCEIRA_LETRA[modeloNormalizado.charAt(2)];
  return potencia ? `${potencia} kVA` : null;
}

export function getLocalDate(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function emptyClienteDraft(): ClienteFormDraft {
  return {
    id: null,
    nome: '',
    contato: '',
    telefone: '',
    email: '',
    cidade: '',
    estado: '',
  };
}

export function clienteToDraft(cliente: Cliente): ClienteFormDraft {
  return {
    id: cliente.id,
    nome: cliente.nome,
    contato: cliente.contato || '',
    telefone: cliente.telefone || '',
    email: cliente.email || '',
    cidade: cliente.cidade || '',
    estado: cliente.estado || '',
  };
}

export function emptyEquipamentoDraft(): EquipamentoFormDraft {
  return {
    id: null,
    numeroSerie: '',
    modelo: '',
    potencia: '',
    tensao: '',
    dataFabricacao: '',
    dataVenda: '',
  };
}

export function equipamentoToDraft(equipamento: Equipamento): EquipamentoFormDraft {
  return {
    id: equipamento.id,
    numeroSerie: equipamento.numeroSerie,
    modelo: equipamento.modelo,
    potencia: equipamento.potencia || '',
    tensao: equipamento.tensao || '',
    dataFabricacao: equipamento.dataFabricacao || '',
    dataVenda: equipamento.dataVenda || '',
  };
}

export function createWarrantyDraft(currentUser: Usuario | null): WarrantyDraft {
  return {
    editingGarantiaId: null,
    dataEntrada: getLocalDate(),
    clienteId: '',
    clienteMode: 'select',
    clienteForm: emptyClienteDraft(),
    equipamentoId: '',
    equipamentoMode: 'select',
    equipamentoForm: emptyEquipamentoDraft(),
    descricaoReclamacao: '',
    responsavelId: currentUser?.id || '',
    status: StatusGarantia.RECEBIDO,
    observacoesGerais: '',
    dataEncerramento: '',
    prazoDias: 30,
  };
}

export function garantiaToDraft(garantia: Garantia): WarrantyDraft {
  return {
    editingGarantiaId: garantia.id,
    dataEntrada: garantia.dataEntrada,
    clienteId: garantia.clienteId,
    clienteMode: 'select',
    clienteForm: emptyClienteDraft(),
    equipamentoId: garantia.equipamentoId,
    equipamentoMode: 'select',
    equipamentoForm: emptyEquipamentoDraft(),
    descricaoReclamacao: garantia.descricaoReclamacao,
    responsavelId: garantia.responsavelId,
    status: garantia.status,
    observacoesGerais: garantia.observacoesGerais || '',
    dataEncerramento: garantia.dataEncerramento || '',
    prazoDias: garantia.prazoDias,
  };
}

export function normalizeUniqueText(value: string): string {
  return value.trim().toLocaleUpperCase('pt-BR');
}

export function formatDate(date: string | undefined): string {
  if (!date) return '—';
  const [year, month, day] = date.slice(0, 10).split('-');
  if (!year || !month || !day) return date;
  return `${day}/${month}/${year}`;
}

export function getStatusTone(status: StatusGarantia): string {
  switch (status) {
    case StatusGarantia.RECEBIDO:
      return 'border-information/35 bg-information/10 text-information';
    case StatusGarantia.EM_ANALISE:
      return 'border-primary/40 bg-primary-soft text-primary';
    case StatusGarantia.AGUARDANDO_PECAS:
      return 'border-warning/35 bg-warning/10 text-warning';
    case StatusGarantia.EM_REPARO:
      return 'border-information/35 bg-information/10 text-information';
    case StatusGarantia.TESTE_FINAL:
      return 'border-primary/40 bg-primary-soft text-primary';
    case StatusGarantia.CONCLUIDO:
      return 'border-success/35 bg-success/10 text-success';
    case StatusGarantia.ENCERRADO:
      return 'border-border-strong bg-surface-elevated text-text-secondary';
  }
}
