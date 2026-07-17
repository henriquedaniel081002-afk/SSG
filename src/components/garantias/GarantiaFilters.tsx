import { Search, SlidersHorizontal, X } from 'lucide-react';
import { StatusGarantia, Usuario } from '../../types';
import { EMPTY_FILTERS, WarrantyFiltersState, formatDate } from './models';

interface GarantiaFiltersProps {
  filters: WarrantyFiltersState;
  usuarios: Usuario[];
  resultCount: number;
  onChange: (filters: WarrantyFiltersState) => void;
}

export function GarantiaFilters({ filters, usuarios, resultCount, onChange }: GarantiaFiltersProps) {
  const update = <K extends keyof WarrantyFiltersState>(key: K, value: WarrantyFiltersState[K]) => {
    onChange({ ...filters, [key]: value });
  };

  const responsavelNome = usuarios.find((usuario) => usuario.id === filters.responsavel)?.nome;
  const chips = [
    filters.search ? { key: 'search' as const, label: `Busca: ${filters.search}` } : null,
    filters.status !== 'todos' ? { key: 'status' as const, label: `Status: ${filters.status}` } : null,
    filters.responsavel !== 'todos' ? { key: 'responsavel' as const, label: `Responsável: ${responsavelNome || filters.responsavel}` } : null,
    filters.dataInicio ? { key: 'dataInicio' as const, label: `Desde ${formatDate(filters.dataInicio)}` } : null,
    filters.dataFim ? { key: 'dataFim' as const, label: `Até ${formatDate(filters.dataFim)}` } : null,
  ].filter((chip): chip is NonNullable<typeof chip> => Boolean(chip));

  const removeChip = (key: keyof WarrantyFiltersState) => {
    update(key, key === 'status' || key === 'responsavel' ? 'todos' : '');
  };

  return (
    <section className="rounded-2xl border border-border bg-surface p-4 shadow-panel" aria-labelledby="warranty-filters-title">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="grid h-9 w-9 place-items-center rounded-lg bg-primary-soft text-primary">
            <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
          </div>
          <div>
            <h2 id="warranty-filters-title" className="text-sm font-semibold text-text-primary">Filtros</h2>
            <p className="text-xs text-text-muted">{resultCount} {resultCount === 1 ? 'registro encontrado' : 'registros encontrados'}</p>
          </div>
        </div>
        <button type="button" onClick={() => onChange(EMPTY_FILTERS)} disabled={!chips.length} className="min-h-11 rounded-lg border border-border px-3 text-xs font-semibold text-text-secondary hover:bg-surface-hover hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-40">
          Limpar filtros
        </button>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-12">
        <label className="xl:col-span-4">
          <span className="mb-1.5 block text-xs font-medium text-text-secondary">Pesquisar</span>
          <span className="relative block">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" aria-hidden="true" />
            <input
              type="search"
              value={filters.search}
              onChange={(event) => update('search', event.target.value)}
              placeholder="Código, cliente, série ou modelo"
              className="min-h-11 w-full rounded-xl border border-border bg-surface-elevated py-2 pl-10 pr-3 text-sm text-text-primary outline-none placeholder:text-text-muted focus:border-primary focus:ring-2 focus:ring-focus-ring/30"
            />
          </span>
        </label>

        <label className="xl:col-span-2">
          <span className="mb-1.5 block text-xs font-medium text-text-secondary">Status</span>
          <select value={filters.status} onChange={(event) => update('status', event.target.value)} className="min-h-11 w-full rounded-xl border border-border bg-surface-elevated px-3 text-sm text-text-primary outline-none focus:border-primary focus:ring-2 focus:ring-focus-ring/30">
            <option value="todos">Todos os status</option>
            {Object.values(StatusGarantia).map((status) => <option key={status} value={status}>{status}</option>)}
          </select>
        </label>

        <label className="xl:col-span-2">
          <span className="mb-1.5 block text-xs font-medium text-text-secondary">Responsável</span>
          <select value={filters.responsavel} onChange={(event) => update('responsavel', event.target.value)} className="min-h-11 w-full rounded-xl border border-border bg-surface-elevated px-3 text-sm text-text-primary outline-none focus:border-primary focus:ring-2 focus:ring-focus-ring/30">
            <option value="todos">Todos</option>
            {usuarios.map((usuario) => <option key={usuario.id} value={usuario.id}>{usuario.nome}</option>)}
          </select>
        </label>

        <label className="xl:col-span-2">
          <span className="mb-1.5 block text-xs font-medium text-text-secondary">Entrada de</span>
          <input type="date" value={filters.dataInicio} max={filters.dataFim || undefined} onChange={(event) => update('dataInicio', event.target.value)} className="min-h-11 w-full rounded-xl border border-border bg-surface-elevated px-3 text-sm text-text-primary outline-none focus:border-primary focus:ring-2 focus:ring-focus-ring/30" />
        </label>

        <label className="xl:col-span-2">
          <span className="mb-1.5 block text-xs font-medium text-text-secondary">Entrada até</span>
          <input type="date" value={filters.dataFim} min={filters.dataInicio || undefined} onChange={(event) => update('dataFim', event.target.value)} className="min-h-11 w-full rounded-xl border border-border bg-surface-elevated px-3 text-sm text-text-primary outline-none focus:border-primary focus:ring-2 focus:ring-focus-ring/30" />
        </label>
      </div>

      {chips.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2" aria-label="Filtros ativos">
          {chips.map((chip) => (
            <span key={chip.key} className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-primary/35 bg-primary-soft pl-3 pr-1 text-xs font-medium text-primary">
              {chip.label}
              <button type="button" onClick={() => removeChip(chip.key)} className="grid h-11 w-11 place-items-center rounded-full hover:bg-primary/15" aria-label={`Remover filtro ${chip.label}`}>
                <X className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </span>
          ))}
        </div>
      )}
    </section>
  );
}
