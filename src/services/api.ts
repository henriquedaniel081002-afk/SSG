import { supabase, assertSupabaseConfigured, SUPABASE_STORAGE_BUCKET } from '../lib/supabase';
import { Cliente, DBState, Equipamento, Foto, Garantia, Historico, StatusGarantia, Usuario } from '../types';

const toDateOnly = (value?: string | null) => {
  if (!value) return undefined;
  return String(value).split('T')[0];
};

const toDateText = (value?: string | null) => toDateOnly(value) || '';

const toDateTimeText = (value?: string | null) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value).replace('T', ' ').substring(0, 19);
  return date.toISOString().replace('T', ' ').substring(0, 19);
};

const normalizeNumber = (value: string | number | null | undefined) => {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isNaN(parsed) ? null : parsed;
};

const mapUsuario = (row: any): Usuario => ({
  id: String(row.id),
  nome: row.nome || '',
  email: row.email || '',
  funcao: row.funcao === 'admin' ? 'admin' : 'usuario',
  ativo: Boolean(row.ativo),
  status: row.status || (row.ativo ? 'aprovado' : 'pendente'),
  authUserId: row.auth_user_id || null,
  motivoRecusa: row.motivo_recusa || '',
});

const mapCliente = (row: any): Cliente => ({
  id: String(row.id),
  nome: row.nome || '',
  contato: row.contato || '',
  telefone: row.telefone || '',
  email: row.email || '',
  cidade: row.cidade || '',
  estado: row.estado || '',
});

const mapEquipamento = (row: any): Equipamento => ({
  id: String(row.id),
  numeroSerie: row.numero_serie || '',
  modelo: row.modelo || '',
  potencia: row.potencia || '',
  tensao: row.tensao || '',
  dataFabricacao: toDateText(row.data_fabricacao),
  dataVenda: toDateText(row.data_venda),
});

const mapGarantia = (row: any): Garantia => ({
  id: row.codigo_garantia || '',
  dataEntrada: toDateText(row.data_entrada),
  clienteId: row.cliente_id ? String(row.cliente_id) : '',
  equipamentoId: row.equipamento_id ? String(row.equipamento_id) : '',
  descricaoReclamacao: row.descricao_reclamacao || '',
  responsavelId: row.responsavel_id ? String(row.responsavel_id) : '',
  status: (row.status_garantia?.nome || row.status || StatusGarantia.RECEBIDO) as StatusGarantia,
  observacoesGerais: row.observacoes_gerais || '',
  dataEncerramento: toDateOnly(row.data_encerramento),
  prazoDias: Number(row.prazo_dias || 30),
});

const mapHistorico = (row: any): Historico => ({
  id: String(row.id),
  garantiaId: row.garantias?.codigo_garantia || row.garantia_id || '',
  usuarioId: row.usuario_id ? String(row.usuario_id) : '',
  usuarioNome: row.usuarios?.nome || 'Sistema',
  dataHora: toDateTimeText(row.data_hora),
  alteracaoRealizada: row.alteracao_realizada || '',
});

const mapFoto = (row: any): Foto => ({
  id: String(row.id),
  garantiaId: row.garantias?.codigo_garantia || row.garantia_id || '',
  tipo: row.tipo,
  url: row.caminho_arquivo || '',
  descricao: row.descricao || '',
  dataRegistro: toDateTimeText(row.data_registro).substring(0, 16),
  usuarioResponsavel: row.usuarios?.nome || 'Sistema',
});

function raise(error: any, fallback: string): never {
  if (error?.message) throw new Error(error.message);
  throw new Error(fallback);
}

async function getStatusIdByName(nome: string) {
  const { data, error } = await supabase
    .from('status_garantia')
    .select('id')
    .eq('nome', nome)
    .single();

  if (error || !data) raise(error, `Status não encontrado: ${nome}`);
  return data.id;
}

async function getGarantiaRowByCodigo(codigoGarantia: string) {
  const { data, error } = await supabase
    .from('garantias')
    .select('id, codigo_garantia, status_garantia(nome)')
    .eq('codigo_garantia', codigoGarantia)
    .single();

  if (error || !data) raise(error, `Garantia não encontrada: ${codigoGarantia}`);
  return data as any;
}

async function gerarCodigoGarantia(dataEntrada?: string) {
  const year = String(dataEntrada || new Date().toISOString().split('T')[0]).split('-')[0];
  const { data, error } = await supabase
    .from('garantias')
    .select('codigo_garantia')
    .like('codigo_garantia', `GAR-${year}-%`);

  if (error) raise(error, 'Erro ao gerar código da garantia');

  const ultimoNumero = (data || []).reduce((max: number, row: any) => {
    const match = String(row.codigo_garantia || '').match(/(\d{4})$/);
    const value = match ? Number(match[1]) : 0;
    return Math.max(max, value);
  }, 0);

  return `GAR-${year}-${String(ultimoNumero + 1).padStart(4, '0')}`;
}

async function insertHistorico(garantiaInternalId: number, usuarioId: string | number | null | undefined, alteracaoRealizada: string) {
  const { error } = await supabase.from('historico_garantia').insert({
    garantia_id: garantiaInternalId,
    usuario_id: normalizeNumber(usuarioId),
    alteracao_realizada: alteracaoRealizada,
  });

  if (error) raise(error, 'Erro ao registrar histórico');
}

export async function buscarEstadoCompleto(preferredUserId?: string | null): Promise<DBState> {
  assertSupabaseConfigured();

  const [usuariosResult, clientesResult, equipamentosResult, garantiasResult, historicosResult, fotosResult] = await Promise.all([
    supabase.from('usuarios').select('*').order('nome', { ascending: true }),
    supabase.from('clientes').select('*').order('nome', { ascending: true }),
    supabase.from('equipamentos').select('*').order('numero_serie', { ascending: true }),
    supabase
      .from('garantias')
      .select('*, status_garantia(nome)')
      .order('data_entrada', { ascending: false })
      .order('id', { ascending: false }),
    supabase
      .from('historico_garantia')
      .select('*, garantias!inner(codigo_garantia), usuarios(nome)')
      .order('data_hora', { ascending: false }),
    supabase
      .from('fotos_garantia')
      .select('*, garantias!inner(codigo_garantia), usuarios(nome)')
      .order('data_registro', { ascending: false }),
  ]);

  if (usuariosResult.error) raise(usuariosResult.error, 'Erro ao buscar usuários');
  if (clientesResult.error) raise(clientesResult.error, 'Erro ao buscar clientes');
  if (equipamentosResult.error) raise(equipamentosResult.error, 'Erro ao buscar equipamentos');
  if (garantiasResult.error) raise(garantiasResult.error, 'Erro ao buscar garantias');
  if (historicosResult.error) raise(historicosResult.error, 'Erro ao buscar históricos');
  if (fotosResult.error) raise(fotosResult.error, 'Erro ao buscar fotos');

  const usuarios = (usuariosResult.data || []).map(mapUsuario);
  const activeUsers = usuarios.filter((u) => u.ativo && (u.status || 'aprovado') === 'aprovado');
  const preferredUser = preferredUserId ? activeUsers.find((u) => u.id === preferredUserId) : null;

  return {
    garantias: (garantiasResult.data || []).map(mapGarantia),
    clientes: (clientesResult.data || []).map(mapCliente),
    equipamentos: (equipamentosResult.data || []).map(mapEquipamento),
    fotos: (fotosResult.data || []).map(mapFoto),
    historicos: (historicosResult.data || []).map(mapHistorico),
    usuarios,
    currentUser:
      preferredUser ||
      activeUsers.find((u) => u.funcao === 'admin') ||
      activeUsers[0] ||
      null,
  };
}


export async function obterUsuarioLogado(): Promise<Usuario | null> {
  assertSupabaseConfigured();

  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) raise(sessionError, 'Erro ao verificar sessão');
  const authUser = sessionData.session?.user;
  if (!authUser) return null;

  const { data, error } = await supabase
    .from('usuarios')
    .select('*')
    .or(`auth_user_id.eq.${authUser.id},email.eq.${authUser.email}`)
    .maybeSingle();

  if (error) raise(error, 'Erro ao buscar usuário logado');
  if (!data) {
    await supabase.auth.signOut();
    throw new Error('Seu e-mail ainda não está cadastrado no sistema. Solicite cadastro ou fale com um administrador.');
  }

  const usuario = mapUsuario(data);
  if (!usuario.ativo || usuario.status === 'pendente') {
    await supabase.auth.signOut();
    throw new Error('Seu cadastro ainda está pendente de aprovação por um administrador.');
  }
  if (usuario.status === 'recusado') {
    await supabase.auth.signOut();
    throw new Error(usuario.motivoRecusa ? `Cadastro recusado: ${usuario.motivoRecusa}` : 'Seu cadastro foi recusado pelo administrador.');
  }

  if (!usuario.authUserId) {
    await atualizarUsuario(usuario.id, { authUserId: authUser.id });
    return { ...usuario, authUserId: authUser.id };
  }

  return usuario;
}

export async function loginComEmail(email: string, senha: string): Promise<Usuario> {
  assertSupabaseConfigured();

  const { error } = await supabase.auth.signInWithPassword({
    email: email.trim().toLowerCase(),
    password: senha,
  });

  if (error) raise(error, 'E-mail ou senha inválidos');
  const usuario = await obterUsuarioLogado();
  if (!usuario) throw new Error('Não foi possível carregar o usuário logado.');
  return usuario;
}

export async function sairDoSistema() {
  assertSupabaseConfigured();
  const { error } = await supabase.auth.signOut();
  if (error) raise(error, 'Erro ao sair do sistema');
}

export async function solicitarCadastro(data: { nome: string; email: string; senha: string }) {
  assertSupabaseConfigured();

  const email = data.email.trim().toLowerCase();
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email,
    password: data.senha,
    options: {
      data: { nome: data.nome.trim() },
    },
  });

  if (authError) raise(authError, 'Erro ao criar usuário de autenticação');

  const { data: existing, error: existingError } = await supabase
    .from('usuarios')
    .select('*')
    .eq('email', email)
    .maybeSingle();

  if (existingError) raise(existingError, 'Erro ao verificar e-mail existente');

  if (existing) {
    if ((existing.status || 'aprovado') === 'recusado') {
      await supabase.auth.signOut();
      throw new Error('Este cadastro já foi recusado. Fale com um administrador para reavaliar o acesso.');
    }

    const payload: Record<string, any> = {
      auth_user_id: authData.user?.id || existing.auth_user_id || null,
      atualizado_em: new Date().toISOString(),
    };

    const { error: updateError } = await supabase.from('usuarios').update(payload).eq('id', existing.id);
    if (updateError) raise(updateError, 'Erro ao vincular cadastro existente');

    await supabase.auth.signOut();
    return;
  }

  const { error } = await supabase.from('usuarios').insert({
    nome: data.nome.trim(),
    email,
    funcao: 'usuario',
    ativo: false,
    status: 'pendente',
    auth_user_id: authData.user?.id || null,
  });

  if (error) raise(error, 'Erro ao registrar solicitação de cadastro');

  await supabase.auth.signOut();
}

export async function aprovarUsuario(id: string | number, funcao: 'admin' | 'usuario' = 'usuario') {
  return atualizarUsuario(id, {
    funcao,
    ativo: true,
    status: 'aprovado',
    motivoRecusa: '',
  });
}

export async function recusarUsuario(id: string | number, motivo?: string) {
  return atualizarUsuario(id, {
    ativo: false,
    status: 'recusado',
    motivoRecusa: motivo || 'Cadastro recusado pelo administrador.',
  });
}

export async function criarCliente(data: any) {
  assertSupabaseConfigured();

  const { data: inserted, error } = await supabase
    .from('clientes')
    .insert({
      nome: data.nome,
      contato: data.contato || null,
      telefone: data.telefone || null,
      email: data.email || null,
      cidade: data.cidade || null,
      estado: data.estado || null,
    })
    .select('*')
    .single();

  if (error) raise(error, 'Erro ao cadastrar cliente');
  return mapCliente(inserted);
}

export async function criarEquipamento(data: any) {
  assertSupabaseConfigured();

  const { data: inserted, error } = await supabase
    .from('equipamentos')
    .insert({
      numero_serie: String(data.numeroSerie || '').trim().toUpperCase(),
      modelo: data.modelo,
      potencia: data.potencia || null,
      tensao: data.tensao || null,
      data_fabricacao: data.dataFabricacao || null,
      data_venda: data.dataVenda || null,
    })
    .select('*')
    .single();

  if (error) raise(error, 'Erro ao cadastrar equipamento');
  return mapEquipamento(inserted);
}

export async function criarGarantia(data: any) {
  assertSupabaseConfigured();

  const codigo = await gerarCodigoGarantia(data.dataEntrada);
  const statusId = await getStatusIdByName(data.status || StatusGarantia.RECEBIDO);

  const { data: inserted, error } = await supabase
    .from('garantias')
    .insert({
      codigo_garantia: codigo,
      data_entrada: data.dataEntrada,
      cliente_id: normalizeNumber(data.clienteId),
      equipamento_id: normalizeNumber(data.equipamentoId),
      responsavel_id: normalizeNumber(data.responsavelId),
      status_id: statusId,
      descricao_reclamacao: data.descricaoReclamacao,
      observacoes_gerais: data.observacoesGerais || null,
      prazo_dias: Number(data.prazoDias || 30),
      data_encerramento: data.dataEncerramento || null,
    })
    .select('*, status_garantia(nome)')
    .single();

  if (error) raise(error, 'Erro ao cadastrar garantia');

  await insertHistorico(inserted.id, data.responsavelId, 'Cadastro inicial da garantia com status Recebido.');
  return mapGarantia(inserted);
}

export async function atualizarGarantia(codigo: string, data: any) {
  assertSupabaseConfigured();

  const garantia = await getGarantiaRowByCodigo(codigo);
  const statusId = await getStatusIdByName(data.status || StatusGarantia.RECEBIDO);
  const originalStatus = garantia.status_garantia?.nome;
  const statusFinalizado = data.status === StatusGarantia.CONCLUIDO || data.status === StatusGarantia.ENCERRADO;
  const dataEncerramento = statusFinalizado ? (data.dataEncerramento || new Date().toISOString().split('T')[0]) : null;

  const { data: updated, error } = await supabase
    .from('garantias')
    .update({
      data_entrada: data.dataEntrada,
      cliente_id: normalizeNumber(data.clienteId),
      equipamento_id: normalizeNumber(data.equipamentoId),
      responsavel_id: normalizeNumber(data.responsavelId),
      status_id: statusId,
      descricao_reclamacao: data.descricaoReclamacao,
      observacoes_gerais: data.observacoesGerais || null,
      prazo_dias: Number(data.prazoDias || 30),
      data_encerramento: dataEncerramento,
      atualizado_em: new Date().toISOString(),
    })
    .eq('id', garantia.id)
    .select('*, status_garantia(nome)')
    .single();

  if (error) raise(error, 'Erro ao editar garantia');

  const diffText = originalStatus && originalStatus !== data.status
    ? `Alteração de status de [${originalStatus}] para [${data.status}].`
    : 'Edição geral.';

  await insertHistorico(garantia.id, data.responsavelId, diffText);
  return mapGarantia(updated);
}

export async function excluirGarantia(codigo: string, _usuarioId?: string | number | null) {
  assertSupabaseConfigured();

  const garantia = await getGarantiaRowByCodigo(codigo);
  const { data: fotos, error: fotosError } = await supabase
    .from('fotos_garantia')
    .select('storage_path')
    .eq('garantia_id', garantia.id);

  if (fotosError) raise(fotosError, 'Erro ao buscar fotos da garantia');

  const { error } = await supabase.from('garantias').delete().eq('id', garantia.id);
  if (error) raise(error, 'Erro ao excluir garantia');

  const storagePaths = (fotos || []).map((foto: any) => foto.storage_path).filter(Boolean);
  if (storagePaths.length > 0) {
    await supabase.storage.from(SUPABASE_STORAGE_BUCKET).remove(storagePaths);
  }
}

export async function criarUsuario(data: any) {
  assertSupabaseConfigured();

  const { data: inserted, error } = await supabase
    .from('usuarios')
    .insert({
      nome: data.nome,
      email: data.email,
      funcao: data.funcao,
      ativo: data.ativo ?? true,
      status: data.status || (data.ativo === false ? 'pendente' : 'aprovado'),
      auth_user_id: data.authUserId || null,
      motivo_recusa: data.motivoRecusa || null,
    })
    .select('*')
    .single();

  if (error) raise(error, 'Erro ao cadastrar usuário');
  return mapUsuario(inserted);
}

export async function atualizarUsuario(id: string | number, data: any) {
  assertSupabaseConfigured();

  const payload: Record<string, any> = { atualizado_em: new Date().toISOString() };
  if (data.nome !== undefined) payload.nome = data.nome;
  if (data.email !== undefined) payload.email = data.email;
  if (data.funcao !== undefined) payload.funcao = data.funcao;
  if (data.ativo !== undefined) payload.ativo = data.ativo;
  if (data.status !== undefined) payload.status = data.status;
  if (data.authUserId !== undefined) payload.auth_user_id = data.authUserId;
  if (data.motivoRecusa !== undefined) payload.motivo_recusa = data.motivoRecusa || null;

  const { data: updated, error } = await supabase
    .from('usuarios')
    .update(payload)
    .eq('id', id)
    .select('*')
    .single();

  if (error) raise(error, 'Erro ao atualizar usuário');
  return mapUsuario(updated);
}

export async function excluirUsuario(id: string | number) {
  assertSupabaseConfigured();

  const { error } = await supabase.from('usuarios').delete().eq('id', id);
  if (error) raise(error, 'Erro ao excluir usuário. Verifique se ele está vinculado a garantias/históricos.');
}

function dataUrlToBlob(dataUrl: string) {
  const [metadata, base64] = dataUrl.split(',');
  const mimeType = metadata.match(/data:(.*?);base64/)?.[1] || 'image/jpeg';
  const binary = atob(base64 || '');
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return {
    blob: new Blob([bytes], { type: mimeType }),
    mimeType,
    extension: mimeType.split('/')[1]?.replace('jpeg', 'jpg') || 'jpg',
  };
}

async function uploadFotoToStorage(garantiaId: string, tipo: 'antes' | 'depois', dataUrl: string) {
  const { blob, mimeType, extension } = dataUrlToBlob(dataUrl);
  const safeGarantiaId = garantiaId.replace(/[^a-zA-Z0-9-_]/g, '_');
  const path = `${safeGarantiaId}/${tipo}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${extension}`;

  const { error } = await supabase.storage
    .from(SUPABASE_STORAGE_BUCKET)
    .upload(path, blob, {
      contentType: mimeType,
      upsert: true,
    });

  if (error) raise(error, 'Erro ao enviar foto para o Supabase Storage');

  const { data } = supabase.storage.from(SUPABASE_STORAGE_BUCKET).getPublicUrl(path);
  return {
    publicUrl: data.publicUrl,
    storagePath: path,
  };
}

export async function salvarFoto(data: any) {
  assertSupabaseConfigured();

  const garantia = await getGarantiaRowByCodigo(data.garantiaId);
  const usuarioId = normalizeNumber(data.usuarioId);

  const { data: existing, error: existingError } = await supabase
    .from('fotos_garantia')
    .select('id, storage_path, caminho_arquivo')
    .eq('garantia_id', garantia.id)
    .eq('tipo', data.tipo)
    .maybeSingle();

  if (existingError) raise(existingError, 'Erro ao verificar foto existente');

  let caminhoArquivo = data.url || '';
  let storagePath = existing?.storage_path || null;
  let oldStoragePath: string | null = null;

  if (caminhoArquivo.startsWith('data:image/')) {
    const uploaded = await uploadFotoToStorage(data.garantiaId, data.tipo, caminhoArquivo);
    caminhoArquivo = uploaded.publicUrl;
    storagePath = uploaded.storagePath;
    oldStoragePath = existing?.storage_path || null;
  }

  if (existing) {
    const { error } = await supabase
      .from('fotos_garantia')
      .update({
        caminho_arquivo: caminhoArquivo,
        storage_path: storagePath,
        descricao: data.descricao || null,
        usuario_id: usuarioId,
        data_registro: new Date().toISOString(),
      })
      .eq('id', existing.id);

    if (error) raise(error, 'Erro ao atualizar foto');
  } else {
    const { error } = await supabase.from('fotos_garantia').insert({
      garantia_id: garantia.id,
      tipo: data.tipo,
      caminho_arquivo: caminhoArquivo,
      storage_path: storagePath,
      descricao: data.descricao || null,
      usuario_id: usuarioId,
    });

    if (error) raise(error, 'Erro ao salvar foto');
  }

  if (oldStoragePath && oldStoragePath !== storagePath) {
    await supabase.storage.from(SUPABASE_STORAGE_BUCKET).remove([oldStoragePath]);
  }

  await insertHistorico(
    garantia.id,
    usuarioId,
    `Vinculada foto de vistoria [${String(data.tipo).toUpperCase()}] com descrição técnica.`
  );

  const refreshed = await buscarEstadoCompleto(data.usuarioId ? String(data.usuarioId) : null);
  return refreshed.fotos.find((foto) => foto.garantiaId === data.garantiaId && foto.tipo === data.tipo) || null;
}

export async function excluirFoto(id: string | number) {
  assertSupabaseConfigured();

  const { data: foto, error: fotoError } = await supabase
    .from('fotos_garantia')
    .select('storage_path')
    .eq('id', id)
    .maybeSingle();

  if (fotoError) raise(fotoError, 'Erro ao buscar foto');

  const { error } = await supabase.from('fotos_garantia').delete().eq('id', id);
  if (error) raise(error, 'Erro ao excluir foto');

  if (foto?.storage_path) {
    await supabase.storage.from(SUPABASE_STORAGE_BUCKET).remove([foto.storage_path]);
  }
}
