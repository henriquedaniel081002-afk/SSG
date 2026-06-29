import React, { useState } from 'react';
import { Lock, Mail, UserPlus, User, Eye, EyeOff, ShieldCheck, Clock } from 'lucide-react';
import { loginComEmail, solicitarCadastro } from '../services/api';
import { Usuario } from '../types';
import itamLogo from '../assets/itam-logo.png';

interface LoginProps {
  onLoginSuccess: (user: Usuario) => void;
}

export const Login: React.FC<LoginProps> = ({ onLoginSuccess }) => {
  const [mode, setMode] = useState<'login' | 'cadastro'>('login');
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [confirmarSenha, setConfirmarSenha] = useState('');
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const resetFeedback = () => {
    setMessage(null);
    setError(null);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    resetFeedback();
    setLoading(true);

    try {
      const usuario = await loginComEmail(email, senha);
      onLoginSuccess(usuario);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao entrar no sistema.');
    } finally {
      setLoading(false);
    }
  };

  const handleCadastro = async (e: React.FormEvent) => {
    e.preventDefault();
    resetFeedback();

    if (!nome.trim() || !email.trim() || !senha) {
      setError('Preencha nome, e-mail e senha.');
      return;
    }

    if (senha.length < 6) {
      setError('A senha precisa ter pelo menos 6 caracteres.');
      return;
    }

    if (senha !== confirmarSenha) {
      setError('As senhas não conferem.');
      return;
    }

    setLoading(true);
    try {
      await solicitarCadastro({ nome, email, senha });
      setMessage('Cadastro enviado. Aguarde um administrador aprovar seu acesso.');
      setMode('login');
      setNome('');
      setSenha('');
      setConfirmarSenha('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao solicitar cadastro.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-brand-gray flex items-center justify-center p-4">
      <div className="w-full max-w-5xl grid grid-cols-1 lg:grid-cols-2 bg-white rounded-3xl shadow-xl border border-slate-200 overflow-hidden">
        <div className="bg-brand-dark text-white p-8 lg:p-10 flex flex-col justify-between gap-10">
          <div>
            <div className="w-20 h-14 rounded-xl bg-white flex items-center justify-center mb-6 border border-brand-light/40 overflow-hidden p-1"><img src={itamLogo} alt="ITAM" className="w-full h-full object-contain" /></div>
            <h1 className="text-3xl font-black tracking-tight mb-3">Sistema de Garantia - ITAM</h1>
            <p className="text-green-100 text-sm leading-relaxed max-w-md">
              Acesso controlado ao sistema de gestão de garantias de transformadores. Novos cadastros ficam pendentes até aprovação administrativa.
            </p>
          </div>

          <div className="space-y-3 text-sm">
            <div className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-2xl p-4">
              <ShieldCheck className="w-5 h-5 text-emerald-300" />
              <span>Usuários aprovados acessam o sistema como usuário comum ou administrador.</span>
            </div>
            <div className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-2xl p-4">
              <Clock className="w-5 h-5 text-amber-300" />
              <span>Cadastros novos entram como pendentes e não acessam o sistema automaticamente.</span>
            </div>
          </div>
        </div>

        <div className="p-8 lg:p-10">
          <div className="mb-6">
            <h2 className="text-2xl font-black text-slate-900">
              {mode === 'login' ? 'Entrar no sistema' : 'Solicitar cadastro'}
            </h2>
            <p className="text-sm text-slate-500 mt-1">
              {mode === 'login'
                ? 'Informe seu e-mail e senha para continuar.'
                : 'Seu acesso será liberado somente após aprovação de um administrador.'}
            </p>
          </div>

          {message && <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-700 text-xs font-semibold p-3">{message}</div>}
          {error && <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 text-rose-700 text-xs font-semibold p-3">{error}</div>}

          <form onSubmit={mode === 'login' ? handleLogin : handleCadastro} className="space-y-4">
            {mode === 'cadastro' && (
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">Nome completo</label>
                <div className="relative">
                  <User className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    value={nome}
                    onChange={(e) => setNome(e.target.value)}
                    className="w-full pl-9 pr-3 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-brand-light/30 focus:border-brand-light"
                    placeholder="Seu nome"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">E-mail</label>
              <div className="relative">
                <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-9 pr-3 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-brand-light/30 focus:border-brand-light"
                  placeholder="usuario@empresa.com"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">Senha</label>
              <div className="relative">
                <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type={mostrarSenha ? 'text' : 'password'}
                  required
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  className="w-full pl-9 pr-10 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-brand-light/30 focus:border-brand-light"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setMostrarSenha(!mostrarSenha)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {mostrarSenha ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {mode === 'cadastro' && (
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">Confirmar senha</label>
                <input
                  type={mostrarSenha ? 'text' : 'password'}
                  required
                  value={confirmarSenha}
                  onChange={(e) => setConfirmarSenha(e.target.value)}
                  className="w-full px-3 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-brand-light/30 focus:border-brand-light"
                  placeholder="Repita a senha"
                />
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl bg-brand-light hover:bg-green-700 disabled:opacity-60 text-white text-sm font-black transition-colors flex items-center justify-center gap-2"
            >
              {mode === 'login' ? <Lock className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />}
              {loading ? 'Processando...' : mode === 'login' ? 'Entrar' : 'Enviar cadastro'}
            </button>
          </form>

          <div className="mt-6 text-center text-sm text-slate-500">
            {mode === 'login' ? 'Ainda não tem acesso?' : 'Já tem cadastro aprovado?'}{' '}
            <button
              onClick={() => {
                resetFeedback();
                setMode(mode === 'login' ? 'cadastro' : 'login');
              }}
              className="font-bold text-brand-light hover:underline"
            >
              {mode === 'login' ? 'Solicitar cadastro' : 'Entrar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
