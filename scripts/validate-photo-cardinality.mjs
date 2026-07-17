import { createClient } from '@supabase/supabase-js';
import { existsSync, readFileSync } from 'node:fs';

if (existsSync('.env')) {
  for (const line of readFileSync('.env', 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (!match || match[1].startsWith('#') || process.env[match[1]] !== undefined) continue;
    const rawValue = match[2];
    process.env[match[1]] = rawValue.replace(/^(['"])(.*)\1$/, '$2');
  }
}

const required = ['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY', 'SSG_TEST_EMAIL', 'SSG_TEST_PASSWORD'];
const missing = required.filter((name) => !process.env[name]);

if (missing.length > 0) {
  console.error(`Gate não executado. Variáveis ausentes: ${missing.join(', ')}`);
  process.exit(2);
}

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);
let probeId = null;
let probeGarantiaId = null;
let probeTipo = null;
const probeMarker = `[GATE CODEX ${new Date().toISOString()} ${Math.random().toString(36).slice(2)}]`;

try {
  const { error: authError } = await supabase.auth.signInWithPassword({
    email: process.env.SSG_TEST_EMAIL,
    password: process.env.SSG_TEST_PASSWORD,
  });
  if (authError) throw authError;

  const { data: fixture, error: fixtureError } = await supabase
    .from('fotos_garantia')
    .select('garantia_id, tipo, caminho_arquivo, storage_path, usuario_id')
    .not('caminho_arquivo', 'is', null)
    .limit(1)
    .maybeSingle();

  if (fixtureError) throw fixtureError;
  if (!fixture) {
    throw new Error('A homologação precisa de ao menos uma fotografia descartável para o teste reversível.');
  }
  probeGarantiaId = fixture.garantia_id;
  probeTipo = fixture.tipo;

  const { data: inserted, error: insertError } = await supabase
    .from('fotos_garantia')
    .insert({
      garantia_id: fixture.garantia_id,
      tipo: fixture.tipo,
      caminho_arquivo: fixture.caminho_arquivo,
      storage_path: fixture.storage_path,
      descricao: probeMarker,
      usuario_id: fixture.usuario_id,
    })
    .select('id')
    .single();

  if (insertError) throw insertError;
  probeId = inserted.id;
  console.log('GATE_APROVADO: fotos_garantia aceita múltiplos registros do mesmo tipo por garantia.');
} catch (error) {
  console.error('GATE_REPROVADO:', error?.message || error);
  process.exitCode = 1;
} finally {
  if (probeGarantiaId !== null && probeTipo !== null) {
    let cleanup = supabase
      .from('fotos_garantia')
      .delete()
      .eq('garantia_id', probeGarantiaId)
      .eq('tipo', probeTipo)
      .eq('descricao', probeMarker);
    if (probeId !== null) cleanup = cleanup.eq('id', probeId);
    const { error: cleanupError } = await cleanup;
    if (cleanupError) {
      console.error('ATENÇÃO: falha ao remover o registro de gate:', cleanupError.message);
      process.exitCode = 1;
    } else {
      console.log('CLEANUP_OK: registro temporário removido.');
    }
  }
  await supabase.auth.signOut();
}
