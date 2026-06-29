/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export enum StatusGarantia {
  RECEBIDO = 'Recebido',
  EM_ANALISE = 'Em Análise',
  AGUARDANDO_PECAS = 'Aguardando Peças',
  EM_REPARO = 'Em Reparo',
  TESTE_FINAL = 'Teste Final',
  CONCLUIDO = 'Concluído',
  ENCERRADO = 'Encerrado'
}

export type FuncaoUsuario = 'admin' | 'usuario';
export type StatusUsuario = 'pendente' | 'aprovado' | 'recusado';

export interface Usuario {
  id: string;
  nome: string;
  email: string;
  funcao: FuncaoUsuario;
  ativo: boolean;
  status?: StatusUsuario;
  authUserId?: string | null;
  motivoRecusa?: string;
}

export interface Cliente {
  id: string;
  nome: string;
  contato: string;
  telefone: string;
  email: string;
  cidade: string;
  estado: string;
}

export interface Equipamento {
  id: string;
  numeroSerie: string;
  modelo: string;
  potencia: string; // ex: "500 kVA", "1500 kVA"
  tensao: string; // ex: "13.8 kV / 380 V", "34.5 kV"
  dataFabricacao: string; // YYYY-MM-DD
  dataVenda: string; // YYYY-MM-DD
}

export interface Garantia {
  id: string; // ex: GAR-2026-0001
  dataEntrada: string; // YYYY-MM-DD
  clienteId: string;
  equipamentoId: string;
  descricaoReclamacao: string;
  responsavelId: string; // ID do responsável
  status: StatusGarantia;
  observacoesGerais: string;
  dataEncerramento?: string; // YYYY-MM-DD
  prazoDias: number; // ex: 30 dias para solução
}

export interface Foto {
  id: string;
  garantiaId: string;
  tipo: 'antes' | 'depois';
  url: string; // URL pública do Supabase Storage ou identificador visual legado
  descricao: string;
  dataRegistro: string; // YYYY-MM-DD HH:mm
  usuarioResponsavel: string; // nome do usuário
}

export interface Historico {
  id: string;
  garantiaId: string;
  usuarioId: string;
  usuarioNome: string;
  dataHora: string; // YYYY-MM-DD HH:mm:ss
  alteracaoRealizada: string;
}

export interface DBState {
  garantias: Garantia[];
  clientes: Cliente[];
  equipamentos: Equipamento[];
  fotos: Foto[];
  historicos: Historico[];
  usuarios: Usuario[];
  currentUser: Usuario | null;
}
