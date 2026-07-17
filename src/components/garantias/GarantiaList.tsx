import { CalendarDays, ClipboardX, Cpu, Eye, Pencil, Trash2, UserRound } from 'lucide-react';
import { Cliente, Equipamento, Garantia, Usuario } from '../../types';
import { formatDate } from './models';
import { StatusBadge } from './GarantiaUi';

interface GarantiaListProps {
  garantias: Garantia[];
  clientes: Cliente[];
  equipamentos: Equipamento[];
  usuarios: Usuario[];
  onView: (garantia: Garantia) => void;
  onEdit: (garantia: Garantia) => void;
  onDelete: (garantia: Garantia) => void;
}

export function GarantiaList({
  garantias,
  clientes,
  equipamentos,
  usuarios,
  onView,
  onEdit,
  onDelete,
}: GarantiaListProps) {
  const clienteMap = new Map(clientes.map((cliente) => [cliente.id, cliente]));
  const equipamentoMap = new Map(equipamentos.map((equipamento) => [equipamento.id, equipamento]));
  const usuarioMap = new Map(usuarios.map((usuario) => [usuario.id, usuario]));

  if (garantias.length === 0) {
    return (
      <div className="grid min-h-72 place-items-center px-6 py-12 text-center">
        <div>
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl border border-border bg-surface-elevated text-text-muted">
            <ClipboardX className="h-6 w-6" aria-hidden="true" />
          </div>
          <h3 className="mt-4 text-base font-semibold text-text-primary">Nenhuma garantia encontrada</h3>
          <p className="mx-auto mt-1 max-w-sm text-sm text-text-secondary">Ajuste os filtros ou crie uma nova garantia para iniciar o acompanhamento.</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="hidden overflow-x-auto lg:block">
        <table className="w-full min-w-[980px] border-collapse text-left">
          <thead>
            <tr className="border-b border-border bg-surface-elevated/70 text-[11px] uppercase tracking-[0.12em] text-text-muted">
              <th className="px-4 py-3 font-semibold">Garantia</th>
              <th className="px-4 py-3 font-semibold">Cliente</th>
              <th className="px-4 py-3 font-semibold">Equipamento</th>
              <th className="px-4 py-3 font-semibold">Responsável / prazo</th>
              <th className="px-4 py-3 font-semibold">Status</th>
              <th className="px-4 py-3 text-right font-semibold">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {garantias.map((garantia) => {
              const cliente = clienteMap.get(garantia.clienteId);
              const equipamento = equipamentoMap.get(garantia.equipamentoId);
              const responsavel = usuarioMap.get(garantia.responsavelId);
              return (
                <tr key={garantia.id} className="group bg-surface transition-colors hover:bg-surface-hover">
                  <td className="px-4 py-4">
                    <button type="button" onClick={() => onView(garantia)} className="text-left font-mono text-sm font-semibold text-primary hover:underline">
                      {garantia.id}
                    </button>
                    <p className="mt-1 text-xs text-text-muted">Entrada {formatDate(garantia.dataEntrada)}</p>
                  </td>
                  <td className="px-4 py-4">
                    <p className="max-w-52 truncate text-sm font-medium text-text-primary">{cliente?.nome || 'Cliente indisponível'}</p>
                    <p className="mt-1 max-w-52 truncate text-xs text-text-muted">{cliente?.contato || cliente?.cidade || 'Sem contato informado'}</p>
                  </td>
                  <td className="px-4 py-4">
                    <p className="font-mono text-sm font-medium text-text-primary">{equipamento?.numeroSerie || '—'}</p>
                    <p className="mt-1 max-w-48 truncate text-xs text-text-muted">{equipamento?.modelo || 'Equipamento indisponível'}</p>
                  </td>
                  <td className="px-4 py-4">
                    <p className="text-sm text-text-primary">{responsavel?.nome || 'Não atribuído'}</p>
                    <p className="mt-1 text-xs text-text-muted">Prazo: {garantia.prazoDias} dias</p>
                  </td>
                  <td className="px-4 py-4"><StatusBadge status={garantia.status} /></td>
                  <td className="px-4 py-4">
                    <div className="flex justify-end gap-1">
                      <ActionButton label={`Ver detalhes de ${garantia.id}`} onClick={() => onView(garantia)} icon={Eye} />
                      <ActionButton label={`Editar ${garantia.id}`} onClick={() => onEdit(garantia)} icon={Pencil} />
                      <ActionButton label={`Excluir ${garantia.id}`} onClick={() => onDelete(garantia)} icon={Trash2} danger />
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="grid gap-3 p-3 lg:hidden">
        {garantias.map((garantia) => {
          const cliente = clienteMap.get(garantia.clienteId);
          const equipamento = equipamentoMap.get(garantia.equipamentoId);
          const responsavel = usuarioMap.get(garantia.responsavelId);
          return (
            <article key={garantia.id} className="rounded-xl border border-border bg-surface-elevated p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <button type="button" onClick={() => onView(garantia)} className="font-mono text-sm font-semibold text-primary hover:underline">{garantia.id}</button>
                  <p className="mt-1 text-sm font-medium text-text-primary">{cliente?.nome || 'Cliente indisponível'}</p>
                </div>
                <StatusBadge status={garantia.status} />
              </div>
              <dl className="mt-4 grid gap-2 text-xs sm:grid-cols-2">
                <div className="flex items-start gap-2 rounded-lg bg-surface p-2.5">
                  <Cpu className="mt-0.5 h-4 w-4 shrink-0 text-text-muted" aria-hidden="true" />
                  <div><dt className="text-text-muted">Equipamento</dt><dd className="mt-0.5 font-mono text-text-primary">{equipamento?.numeroSerie || '—'} · {equipamento?.modelo || 'Indisponível'}</dd></div>
                </div>
                <div className="flex items-start gap-2 rounded-lg bg-surface p-2.5">
                  <UserRound className="mt-0.5 h-4 w-4 shrink-0 text-text-muted" aria-hidden="true" />
                  <div><dt className="text-text-muted">Responsável</dt><dd className="mt-0.5 text-text-primary">{responsavel?.nome || 'Não atribuído'}</dd></div>
                </div>
                <div className="flex items-start gap-2 rounded-lg bg-surface p-2.5 sm:col-span-2">
                  <CalendarDays className="mt-0.5 h-4 w-4 shrink-0 text-text-muted" aria-hidden="true" />
                  <div><dt className="text-text-muted">Entrada e prazo</dt><dd className="mt-0.5 text-text-primary">{formatDate(garantia.dataEntrada)} · {garantia.prazoDias} dias</dd></div>
                </div>
              </dl>
              <div className="mt-4 grid grid-cols-3 gap-2">
                <MobileAction label="Detalhes" onClick={() => onView(garantia)} icon={Eye} />
                <MobileAction label="Editar" onClick={() => onEdit(garantia)} icon={Pencil} />
                <MobileAction label="Excluir" onClick={() => onDelete(garantia)} icon={Trash2} danger />
              </div>
            </article>
          );
        })}
      </div>
    </>
  );
}

type IconComponent = typeof Eye;

function ActionButton({ label, onClick, icon: Icon, danger = false }: { label: string; onClick: () => void; icon: IconComponent; danger?: boolean }) {
  return (
    <button type="button" onClick={onClick} className={`grid h-11 w-11 place-items-center rounded-lg border border-transparent transition-colors ${danger ? 'text-text-muted hover:border-danger/30 hover:bg-danger/10 hover:text-danger' : 'text-text-muted hover:border-border hover:bg-surface-elevated hover:text-text-primary'}`} aria-label={label} title={label}>
      <Icon className="h-4 w-4" aria-hidden="true" />
    </button>
  );
}

function MobileAction({ label, onClick, icon: Icon, danger = false }: { label: string; onClick: () => void; icon: IconComponent; danger?: boolean }) {
  return (
    <button type="button" onClick={onClick} className={`inline-flex min-h-11 items-center justify-center gap-1.5 rounded-lg border text-xs font-semibold ${danger ? 'border-danger/25 text-danger hover:bg-danger/10' : 'border-border text-text-secondary hover:bg-surface-hover hover:text-text-primary'}`}>
      <Icon className="h-4 w-4" aria-hidden="true" /> {label}
    </button>
  );
}
