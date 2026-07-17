import React, { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, Clock3, Eye, EyeOff, LockKeyhole, Mail, ShieldCheck, User, UserPlus } from 'lucide-react';
import { loginComEmail, solicitarCadastro } from '../services/api';
import { Usuario } from '../types';
import itamLogo from '../assets/itam-logo.png';
import { Button, Card, FormField, IconButton } from './ui';

interface LoginProps {
  onLoginSuccess: (user: Usuario) => void | Promise<void>;
  initialError?: string | null;
}

type FieldErrors = Partial<Record<'nome' | 'email' | 'senha' | 'confirmarSenha', string>>;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function feedbackKind(message: string) {
  const normalized = message.toLocaleLowerCase('pt-BR');
  if (normalized.includes('pendente')) return { icon: Clock3, label: 'Acesso em análise', className: 'border-warning/40 bg-warning/10 text-amber-100' };
  if (normalized.includes('recusad')) return { icon: AlertTriangle, label: 'Solicitação recusada', className: 'border-danger/40 bg-danger/10 text-red-100' };
  if (normalized.includes('inativ')) return { icon: ShieldCheck, label: 'Usuário inativo', className: 'border-information/40 bg-information/10 text-sky-100' };
  return { icon: AlertTriangle, label: 'Não foi possível entrar', className: 'border-danger/40 bg-danger/10 text-red-100' };
}

function userFacingAuthError(error: unknown, context: 'login' | 'cadastro') {
  const message = error instanceof Error ? error.message : '';
  const normalized = message.toLocaleLowerCase('pt-BR');
  if (['pendente', 'recusad', 'inativ', 'ainda não está cadastrado'].some((term) => normalized.includes(term))) return message;
  if (normalized.includes('invalid login credentials') || normalized.includes('email or password')) return 'E-mail ou senha inválidos.';
  if (normalized.includes('email not confirmed')) return 'Confirme seu e-mail antes de entrar.';
  if (normalized.includes('already registered') || normalized.includes('already been registered')) return 'Este e-mail já possui cadastro. Tente entrar ou procure um administrador.';
  if (normalized.includes('fetch') || normalized.includes('network') || normalized.includes('supabase') || normalized.includes('conex')) return 'Não foi possível acessar o serviço agora. Verifique sua conexão e tente novamente.';
  return context === 'login' ? 'Não foi possível entrar. Revise suas credenciais e tente novamente.' : 'Não foi possível enviar a solicitação. Revise os dados e tente novamente.';
}

export const Login: React.FC<LoginProps> = ({ onLoginSuccess, initialError }) => {
  const [mode, setMode] = useState<'login' | 'cadastro'>('login');
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [confirmarSenha, setConfirmarSenha] = useState('');
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(initialError || null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  useEffect(() => {
    if (initialError) setError(initialError);
  }, [initialError]);

  const resetFeedback = () => {
    setMessage(null);
    setError(null);
    setFieldErrors({});
  };

  const clearFieldError = (field: keyof FieldErrors) => {
    setFieldErrors((current) => current[field] ? { ...current, [field]: undefined } : current);
  };

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    resetFeedback();
    const validation: FieldErrors = {};
    if (!email.trim()) validation.email = 'Informe seu e-mail.';
    else if (!EMAIL_PATTERN.test(email.trim())) validation.email = 'Informe um e-mail válido.';
    if (!senha) validation.senha = 'Informe sua senha.';
    if (Object.keys(validation).length) {
      setFieldErrors(validation);
      return;
    }
    setLoading(true);
    try {
      const usuario = await loginComEmail(email, senha);
      await onLoginSuccess(usuario);
    } catch (err) {
      setError(userFacingAuthError(err, 'login'));
    } finally {
      setLoading(false);
    }
  };

  const handleCadastro = async (event: React.FormEvent) => {
    event.preventDefault();
    resetFeedback();
    const validation: FieldErrors = {};
    if (!nome.trim()) validation.nome = 'Informe seu nome completo.';
    if (!email.trim()) validation.email = 'Informe seu e-mail.';
    else if (!EMAIL_PATTERN.test(email.trim())) validation.email = 'Informe um e-mail válido.';
    if (!senha) validation.senha = 'Informe uma senha.';
    else if (senha.length < 6) validation.senha = 'A senha precisa ter pelo menos 6 caracteres.';
    if (!confirmarSenha) validation.confirmarSenha = 'Repita a senha.';
    else if (senha !== confirmarSenha) validation.confirmarSenha = 'As senhas não conferem.';
    if (Object.keys(validation).length) {
      setFieldErrors(validation);
      return;
    }

    setLoading(true);
    try {
      await solicitarCadastro({ nome, email, senha });
      setMessage('Cadastro enviado. Aguarde a aprovação de um administrador.');
      setMode('login');
      setNome('');
      setSenha('');
      setConfirmarSenha('');
    } catch (err) {
      setError(userFacingAuthError(err, 'cadastro'));
    } finally {
      setLoading(false);
    }
  };

  const errorMeta = error ? feedbackKind(error) : null;

  return (
    <main className="surface-grid flex min-h-screen items-center justify-center bg-background p-3 sm:p-6">
      <Card className="grid w-full max-w-6xl overflow-hidden lg:grid-cols-[1.05fr_0.95fr]">
        <section className="relative overflow-hidden border-b border-border bg-[#07110b] p-6 lg:min-h-[680px] lg:border-b-0 lg:border-r lg:p-10">
          <div className="absolute -right-24 -top-24 h-80 w-80 rounded-full bg-primary/20 blur-3xl" aria-hidden="true" />
          <div className="relative flex h-full flex-col justify-between gap-8">
            <div>
              <div className="mb-6 flex h-16 w-24 items-center justify-center overflow-hidden rounded-2xl border border-border-strong bg-white p-2 shadow-xl">
                <img src={itamLogo} alt="ITAM Transformadores" className="h-full w-full object-contain" />
              </div>
              <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.24em] text-primary">Operação industrial</p>
              <h1 className="mt-3 max-w-xl text-balance text-3xl font-extrabold leading-tight text-text-primary sm:text-4xl lg:text-5xl">Gestão de garantias com rastreabilidade técnica.</h1>
              <p className="mt-4 max-w-lg text-sm leading-7 text-text-secondary">Clientes, equipamentos, evidências fotográficas e histórico de atendimento em um único ambiente seguro da ITAM.</p>
            </div>

            <div className="hidden space-y-3 sm:grid sm:grid-cols-2 lg:block">
              <div className="flex items-start gap-3 rounded-2xl border border-border bg-surface/80 p-4">
                <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-success" aria-hidden="true" />
                <div><p className="text-sm font-semibold text-text-primary">Acesso controlado</p><p className="mt-1 text-xs leading-relaxed text-text-muted">Perfis comuns e administrativos seguem as permissões existentes no Supabase.</p></div>
              </div>
              <div className="flex items-start gap-3 rounded-2xl border border-border bg-surface/80 p-4">
                <Clock3 className="mt-0.5 h-5 w-5 shrink-0 text-warning" aria-hidden="true" />
                <div><p className="text-sm font-semibold text-text-primary">Aprovação administrativa</p><p className="mt-1 text-xs leading-relaxed text-text-muted">Novos acessos permanecem pendentes até a análise de um administrador.</p></div>
              </div>
            </div>
          </div>
        </section>

        <section className="flex items-center bg-surface p-5 sm:p-8 lg:p-12">
          <div className="mx-auto w-full max-w-md">
            <div className="mb-7">
              <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-primary">Sistema de Garantias ITAM</p>
              <h2 className="mt-2 text-2xl font-bold text-text-primary">{mode === 'login' ? 'Acessar o sistema' : 'Solicitar acesso'}</h2>
              <p className="mt-1.5 text-sm text-text-secondary">{mode === 'login' ? 'Use suas credenciais corporativas para continuar.' : 'Preencha seus dados; o acesso será liberado após aprovação.'}</p>
            </div>

            {message ? (
              <div role="status" className="mb-5 flex items-start gap-3 rounded-2xl border border-success/40 bg-success/10 p-4 text-emerald-100">
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
                <div><p className="text-sm font-semibold">Solicitação enviada</p><p className="mt-1 text-xs leading-relaxed opacity-85">{message}</p></div>
              </div>
            ) : null}

            {error && errorMeta ? (
              <div role="alert" className={`mb-5 flex items-start gap-3 rounded-2xl border p-4 ${errorMeta.className}`}>
                <errorMeta.icon className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
                <div><p className="text-sm font-semibold">{errorMeta.label}</p><p className="mt-1 text-xs leading-relaxed opacity-85">{error}</p></div>
              </div>
            ) : null}

            <form onSubmit={mode === 'login' ? handleLogin : handleCadastro} className="space-y-4" noValidate>
              {mode === 'cadastro' ? (
                <FormField id="nome" label="Nome completo" error={fieldErrors.nome} required>
                  <div className="relative">
                    <User className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" aria-hidden="true" />
                    <input id="nome" name="name" autoComplete="name" value={nome} onChange={(event) => { setNome(event.target.value); clearFieldError('nome'); }} aria-invalid={Boolean(fieldErrors.nome)} aria-describedby={fieldErrors.nome ? 'nome-error' : undefined} className="w-full pl-10 pr-3" placeholder="Seu nome completo" required />
                  </div>
                </FormField>
              ) : null}

              <FormField id="email" label="E-mail" error={fieldErrors.email} required>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" aria-hidden="true" />
                  <input id="email" name="email" type="email" inputMode="email" autoComplete={mode === 'login' ? 'username' : 'email'} value={email} onChange={(event) => { setEmail(event.target.value); clearFieldError('email'); }} aria-invalid={Boolean(fieldErrors.email)} aria-describedby={fieldErrors.email ? 'email-error' : undefined} className="w-full pl-10 pr-3" placeholder="usuario@empresa.com" required />
                </div>
              </FormField>

              <FormField id="senha" label="Senha" hint={mode === 'cadastro' ? 'Use pelo menos 6 caracteres.' : undefined} error={fieldErrors.senha} required>
                <div className="relative">
                  <LockKeyhole className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" aria-hidden="true" />
                  <input id="senha" name="password" type={mostrarSenha ? 'text' : 'password'} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} value={senha} onChange={(event) => { setSenha(event.target.value); clearFieldError('senha'); }} aria-invalid={Boolean(fieldErrors.senha)} aria-describedby={fieldErrors.senha ? 'senha-error' : mode === 'cadastro' ? 'senha-hint' : undefined} className="w-full pl-10 pr-14" placeholder="••••••••" required />
                  <IconButton label={mostrarSenha ? 'Ocultar senha' : 'Mostrar senha'} icon={mostrarSenha ? EyeOff : Eye} onClick={() => setMostrarSenha((value) => !value)} className="absolute right-0 top-1/2 h-11 w-11 -translate-y-1/2 border-transparent" />
                </div>
              </FormField>

              {mode === 'cadastro' ? (
                <FormField id="confirmar-senha" label="Confirmar senha" error={fieldErrors.confirmarSenha} required>
                  <input id="confirmar-senha" name="password-confirmation" type={mostrarSenha ? 'text' : 'password'} autoComplete="new-password" value={confirmarSenha} onChange={(event) => { setConfirmarSenha(event.target.value); clearFieldError('confirmarSenha'); }} aria-invalid={Boolean(fieldErrors.confirmarSenha)} aria-describedby={fieldErrors.confirmarSenha ? 'confirmar-senha-error' : undefined} className="w-full px-3" placeholder="Repita a senha" required />
                </FormField>
              ) : null}

              <Button type="submit" size="lg" loading={loading} icon={mode === 'login' ? LockKeyhole : UserPlus} className="mt-2 w-full">
                {mode === 'login' ? 'Entrar no sistema' : 'Enviar solicitação'}
              </Button>
            </form>

            <div className="mt-6 border-t border-border pt-5 text-center text-sm text-text-muted">
              {mode === 'login' ? 'Ainda não possui acesso?' : 'Já possui cadastro aprovado?'}{' '}
              <button type="button" onClick={() => { resetFeedback(); setMode((value) => value === 'login' ? 'cadastro' : 'login'); }} className="min-h-11 font-semibold text-primary hover:text-emerald-300">
                {mode === 'login' ? 'Solicitar cadastro' : 'Voltar para o login'}
              </button>
            </div>
          </div>
        </section>
      </Card>
    </main>
  );
};
