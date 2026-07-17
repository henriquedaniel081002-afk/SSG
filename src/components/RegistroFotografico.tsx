/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  Camera,
  Check,
  Download,
  FileImage,
  GitCompare,
  Image as ImageIcon,
  Loader2,
  Maximize2,
  Pencil,
  Search,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { DBState, Foto, Usuario } from '../types';
import { buscarEstadoCompleto, excluirFoto, salvarFoto } from '../services/api';
import {
  downloadPhotoAsset,
  formatSystemDate,
  isRenderablePhotoUrl,
  PhotoImage,
  PhotoLightbox,
  useDialogAccessibility,
} from './fotos/PhotoComponents';

type PhotoType = 'antes' | 'depois';
type NotifyType = 'success' | 'error' | 'warning' | 'info';
type PendingStatus = 'ready' | 'uploading' | 'error';

interface RegistroFotograficoProps {
  db: DBState;
  onUpdateState: (newState: DBState) => void;
  currentUser: Usuario | null;
  onNotify?: (message: string, type?: NotifyType) => void;
  initialGarantiaId?: string;
  onInitialGarantiaHandled?: () => void;
  /** @deprecated Compatibilidade com integrações anteriores. */
  garantiaIdInicial?: string;
}

interface PendingPhoto {
  localId: string;
  garantiaId: string;
  fileName: string;
  dataUrl: string;
  descricao: string;
  status: PendingStatus;
  error?: string;
}

interface UploadProgress {
  total: number;
  processed: number;
  succeeded: number;
  failed: number;
}

const EMPTY_PROGRESS: UploadProgress = { total: 0, processed: 0, succeeded: 0, failed: 0 };

const normalizeSearch = (value: string) => value
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .trim()
  .toLocaleLowerCase('pt-BR');

const fileToDataUrl = (file: File) => new Promise<string>((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(String(reader.result || ''));
  reader.onerror = () => reject(new Error(`Não foi possível ler o arquivo ${file.name}.`));
  reader.readAsDataURL(file);
});

const getErrorMessage = (error: unknown, fallback: string) => error instanceof Error && error.message
  ? error.message
  : fallback;

const getPersistedPhotoFromError = (error: unknown): Foto | null => {
  if (!error || typeof error !== 'object' || !('persistedPhoto' in error)) return null;
  const persistedPhoto = (error as { persistedPhoto?: Foto | null }).persistedPhoto;
  return persistedPhoto?.id ? persistedPhoto : null;
};

const buildLocalId = () => typeof crypto !== 'undefined' && 'randomUUID' in crypto
  ? crypto.randomUUID()
  : `foto-${Date.now()}-${Math.random().toString(36).slice(2)}`;

interface UploadQueuePanelProps {
  type: PhotoType;
  title: string;
  subtitle: string;
  items: PendingPhoto[];
  dragging: boolean;
  uploading: boolean;
  progress: UploadProgress;
  onDraggingChange: (dragging: boolean) => void;
  onFiles: (files: File[]) => void;
  onStartCamera: () => void;
  onDescriptionChange: (localId: string, description: string) => void;
  onRemove: (localId: string) => void;
  onUpload: () => void;
}

const UploadQueuePanel: React.FC<UploadQueuePanelProps> = ({
  type,
  title,
  subtitle,
  items,
  dragging,
  uploading,
  progress,
  onDraggingChange,
  onFiles,
  onStartCamera,
  onDescriptionChange,
  onRemove,
  onUpload,
}) => {
  const inputId = `photo-file-${type}`;
  const tone = type === 'antes'
    ? { text: 'text-danger', border: 'border-danger/30', soft: 'bg-danger/10' }
    : { text: 'text-success', border: 'border-success/30', soft: 'bg-success/10' };
  const availableItems = items.filter((item) => item.status !== 'uploading');
  const percentage = progress.total > 0 ? Math.round((progress.processed / progress.total) * 100) : 0;

  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-surface shadow-lg shadow-black/10">
      <div className={`border-b px-5 py-4 ${tone.border} ${tone.soft}`}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className={`text-[11px] font-bold uppercase tracking-[0.18em] ${tone.text}`}>{title}</p>
            <p className="mt-1 text-xs leading-relaxed text-text-secondary">{subtitle}</p>
          </div>
          <span className="rounded-full border border-border bg-surface px-2.5 py-1 font-mono text-[11px] font-bold text-text-secondary">
            {items.length} na fila
          </span>
        </div>
      </div>

      <div className="space-y-4 p-5">
        <div
          className={`rounded-2xl border-2 border-dashed px-4 py-6 text-center transition ${
            dragging ? 'border-primary bg-primary-soft' : 'border-border-strong bg-surface-elevated hover:border-primary/70'
          }`}
          onDragEnter={(event) => {
            event.preventDefault();
            onDraggingChange(true);
          }}
          onDragOver={(event) => {
            event.preventDefault();
            event.dataTransfer.dropEffect = 'copy';
            onDraggingChange(true);
          }}
          onDragLeave={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget as Node | null)) onDraggingChange(false);
          }}
          onDrop={(event) => {
            event.preventDefault();
            onDraggingChange(false);
            onFiles(Array.from(event.dataTransfer.files));
          }}
        >
          <Upload className={`mx-auto h-7 w-7 ${dragging ? 'text-primary' : 'text-text-muted'}`} aria-hidden="true" />
          <p className="mt-2 text-sm font-bold text-text-primary">Arraste imagens para esta área</p>
          <p className="mt-1 text-xs text-text-muted">ou escolha uma ou várias imagens do dispositivo</p>
          <div className="mt-4 flex flex-col justify-center gap-2 sm:flex-row">
            <label
              htmlFor={inputId}
              className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl bg-primary px-4 text-xs font-bold text-white transition hover:bg-primary-hover focus-within:ring-2 focus-within:ring-focus-ring"
            >
              <ImageIcon className="h-4 w-4" aria-hidden="true" />
              Escolher imagens
              <input
                id={inputId}
                type="file"
                accept="image/*"
                multiple
                className="sr-only"
                disabled={uploading}
                onChange={(event) => {
                  onFiles(Array.from(event.target.files || []));
                  event.target.value = '';
                }}
              />
            </label>
            <button
              type="button"
              onClick={onStartCamera}
              disabled={uploading}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-border-strong bg-surface px-4 text-xs font-bold text-text-primary transition hover:bg-surface-hover focus:outline-none focus:ring-2 focus:ring-focus-ring disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Camera className="h-4 w-4" aria-hidden="true" />
              Usar câmera
            </button>
          </div>
        </div>

        {items.length === 0 ? (
          <div className="rounded-xl border border-border bg-background/40 px-4 py-5 text-center">
            <FileImage className="mx-auto h-6 w-6 text-text-muted" aria-hidden="true" />
            <p className="mt-2 text-xs font-semibold text-text-secondary">Nenhuma imagem aguardando envio</p>
          </div>
        ) : (
          <ul className="space-y-3" aria-label={`Fila de fotos ${title.toLocaleLowerCase('pt-BR')}`}>
            {items.map((item, index) => (
              <li key={item.localId} className="grid gap-3 rounded-xl border border-border bg-surface-elevated p-3 sm:grid-cols-[96px_1fr_auto]">
                <PhotoImage
                  url={item.dataUrl}
                  alt={`Prévia de ${item.fileName}`}
                  className="h-24 w-full sm:w-24"
                />
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="truncate font-mono text-[11px] font-bold text-text-primary" title={item.fileName}>
                      {index + 1}. {item.fileName}
                    </span>
                    {item.status === 'uploading' && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-information/10 px-2 py-0.5 text-[10px] font-bold text-information">
                        <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" /> Enviando
                      </span>
                    )}
                    {item.status === 'error' && (
                      <span className="rounded-full bg-danger/10 px-2 py-0.5 text-[10px] font-bold text-danger">Falhou</span>
                    )}
                  </div>
                  <label className="mt-2 block text-[11px] font-semibold text-text-secondary" htmlFor={`description-${item.localId}`}>
                    Descrição técnica
                  </label>
                  <textarea
                    id={`description-${item.localId}`}
                    value={item.descricao}
                    disabled={uploading || item.status === 'uploading'}
                    onChange={(event) => onDescriptionChange(item.localId, event.target.value)}
                    rows={2}
                    placeholder={type === 'antes' ? 'Descreva a condição ou avaria observada.' : 'Descreva o serviço ou resultado registrado.'}
                    className="mt-1 w-full resize-y rounded-lg border border-border bg-background px-3 py-2 text-xs text-text-primary outline-none placeholder:text-text-muted focus:border-primary focus:ring-2 focus:ring-focus-ring disabled:opacity-60"
                  />
                  {item.error && <p className="mt-1 text-[11px] leading-relaxed text-danger">{item.error}</p>}
                </div>
                <button
                  type="button"
                  onClick={() => onRemove(item.localId)}
                  disabled={uploading || item.status === 'uploading'}
                  className="inline-flex min-h-11 min-w-11 items-center justify-center self-start rounded-xl border border-border bg-surface text-text-secondary transition hover:border-danger/50 hover:bg-danger/10 hover:text-danger focus:outline-none focus:ring-2 focus:ring-focus-ring disabled:cursor-not-allowed disabled:opacity-40"
                  aria-label={`Remover ${item.fileName} da fila`}
                >
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        )}

        {progress.total > 0 && (
          <div className="rounded-xl border border-border bg-background/50 p-3" aria-live="polite">
            <div className="flex items-center justify-between gap-3 text-[11px] font-semibold text-text-secondary">
              <span>{progress.processed} de {progress.total} processadas</span>
              <span>{progress.succeeded} salvas · {progress.failed} falhas</span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-surface-active" role="progressbar" aria-valuemin={0} aria-valuemax={progress.total} aria-valuenow={progress.processed}>
              <div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${percentage}%` }} />
            </div>
          </div>
        )}

        <button
          type="button"
          onClick={onUpload}
          disabled={uploading || availableItems.length === 0}
          className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-bold text-white transition hover:bg-primary-hover focus:outline-none focus:ring-2 focus:ring-focus-ring disabled:cursor-not-allowed disabled:opacity-45"
        >
          {uploading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Upload className="h-4 w-4" aria-hidden="true" />}
          {uploading ? 'Enviando e confirmando…' : `Enviar ${availableItems.length} ${availableItems.length === 1 ? 'imagem' : 'imagens'}`}
        </button>
      </div>
    </section>
  );
};

interface GallerySectionProps {
  type: PhotoType;
  photos: Foto[];
  garantiaId: string;
  editingId: string | null;
  editingDescription: string;
  savingId: string | null;
  onOpen: (photo: Foto) => void;
  onDownload: (photo: Foto) => void;
  onDelete: (photo: Foto) => void;
  onStartEdit: (photo: Foto) => void;
  onCancelEdit: () => void;
  onEditingDescriptionChange: (description: string) => void;
  onSaveDescription: (photo: Foto) => void;
}

const GallerySection: React.FC<GallerySectionProps> = ({
  type,
  photos,
  garantiaId,
  editingId,
  editingDescription,
  savingId,
  onOpen,
  onDownload,
  onDelete,
  onStartEdit,
  onCancelEdit,
  onEditingDescriptionChange,
  onSaveDescription,
}) => {
  const before = type === 'antes';
  const title = before ? 'Antes do reparo' : 'Depois do reparo';

  return (
    <section className="rounded-2xl border border-border bg-surface p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <p className={`text-[11px] font-bold uppercase tracking-[0.18em] ${before ? 'text-danger' : 'text-success'}`}>{title}</p>
          <p className="mt-1 text-xs text-text-muted">{photos.length} {photos.length === 1 ? 'registro' : 'registros'}</p>
        </div>
        <span className={`rounded-xl px-3 py-1.5 font-mono text-sm font-bold ${before ? 'bg-danger/10 text-danger' : 'bg-success/10 text-success'}`}>
          {photos.length}
        </span>
      </div>

      {photos.length === 0 ? (
        <div className="flex min-h-44 flex-col items-center justify-center rounded-xl border border-dashed border-border-strong bg-surface-elevated px-5 text-center">
          <ImageIcon className="h-7 w-7 text-text-muted" aria-hidden="true" />
          <p className="mt-2 text-xs font-semibold text-text-secondary">Nenhuma foto registrada</p>
        </div>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {photos.map((photo, index) => (
            <li key={photo.id} className="overflow-hidden rounded-xl border border-border bg-surface-elevated">
              <button
                type="button"
                onClick={() => onOpen(photo)}
                className="block w-full rounded-xl text-left focus:outline-none focus:ring-2 focus:ring-inset focus:ring-focus-ring"
                aria-label={`Ampliar foto ${index + 1} de ${title.toLocaleLowerCase('pt-BR')}`}
              >
                <PhotoImage
                  url={photo.url}
                  alt={`${title} da garantia ${garantiaId}. ${photo.descricao || 'Sem descrição técnica.'}`}
                  className="h-44 w-full rounded-none"
                />
              </button>

              <div className="space-y-3 p-3">
                <div className="flex items-center justify-between gap-2 text-[10px] text-text-muted">
                  <span className="font-mono">#{index + 1}</span>
                  <span>{formatSystemDate(photo.dataRegistro, true)}</span>
                </div>

                {editingId === photo.id ? (
                  <div className="space-y-2">
                    <label htmlFor={`gallery-description-${photo.id}`} className="text-[11px] font-semibold text-text-secondary">Descrição técnica</label>
                    <textarea
                      id={`gallery-description-${photo.id}`}
                      rows={3}
                      value={editingDescription}
                      onChange={(event) => onEditingDescriptionChange(event.target.value)}
                      className="w-full resize-y rounded-lg border border-border bg-background px-3 py-2 text-xs text-text-primary outline-none focus:border-primary focus:ring-2 focus:ring-focus-ring"
                    />
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => onSaveDescription(photo)}
                        disabled={savingId === photo.id}
                        className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-lg bg-primary px-3 text-xs font-bold text-white hover:bg-primary-hover focus:outline-none focus:ring-2 focus:ring-focus-ring disabled:opacity-50"
                      >
                        {savingId === photo.id ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Check className="h-4 w-4" aria-hidden="true" />}
                        Salvar
                      </button>
                      <button
                        type="button"
                        onClick={onCancelEdit}
                        disabled={savingId === photo.id}
                        className="min-h-11 rounded-lg border border-border px-3 text-xs font-bold text-text-secondary hover:bg-surface-hover focus:outline-none focus:ring-2 focus:ring-focus-ring disabled:opacity-50"
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <p className="min-h-10 text-xs leading-relaxed text-text-secondary">{photo.descricao || 'Sem descrição técnica.'}</p>
                    <p className="truncate text-[10px] text-text-muted" title={photo.usuarioResponsavel}>
                      Registrada por <strong className="text-text-secondary">{photo.usuarioResponsavel || 'usuário não identificado'}</strong>
                    </p>
                    <div className="grid grid-cols-4 gap-2 border-t border-border pt-3">
                      <button type="button" onClick={() => onOpen(photo)} className="inline-flex min-h-11 items-center justify-center rounded-lg border border-border bg-surface text-text-secondary hover:bg-surface-hover hover:text-text-primary focus:outline-none focus:ring-2 focus:ring-focus-ring" aria-label="Ampliar foto">
                        <Maximize2 className="h-4 w-4" aria-hidden="true" />
                      </button>
                      <button type="button" onClick={() => onDownload(photo)} className="inline-flex min-h-11 items-center justify-center rounded-lg border border-border bg-surface text-text-secondary hover:bg-surface-hover hover:text-text-primary focus:outline-none focus:ring-2 focus:ring-focus-ring" aria-label="Baixar foto">
                        <Download className="h-4 w-4" aria-hidden="true" />
                      </button>
                      <button type="button" onClick={() => onStartEdit(photo)} className="inline-flex min-h-11 items-center justify-center rounded-lg border border-border bg-surface text-text-secondary hover:bg-surface-hover hover:text-text-primary focus:outline-none focus:ring-2 focus:ring-focus-ring" aria-label="Editar descrição">
                        <Pencil className="h-4 w-4" aria-hidden="true" />
                      </button>
                      <button type="button" onClick={() => onDelete(photo)} className="inline-flex min-h-11 items-center justify-center rounded-lg border border-danger/30 bg-danger/10 text-danger hover:bg-danger/20 focus:outline-none focus:ring-2 focus:ring-focus-ring" aria-label="Excluir foto">
                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                      </button>
                    </div>
                  </>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};

interface ConfirmDeleteDialogProps {
  photo: Foto | null;
  deleting: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

const ConfirmDeleteDialog: React.FC<ConfirmDeleteDialogProps> = ({ photo, deleting, onCancel, onConfirm }) => {
  const dialogRef = useRef<HTMLDivElement>(null);
  useDialogAccessibility(Boolean(photo), onCancel, dialogRef);
  if (!photo) return null;

  return (
    <div className="fixed inset-0 z-[115] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm print:hidden" onMouseDown={(event) => {
      if (!deleting && event.target === event.currentTarget) onCancel();
    }}>
      <div ref={dialogRef} role="alertdialog" aria-modal="true" aria-labelledby="delete-photo-title" aria-describedby="delete-photo-description" tabIndex={-1} className="w-full max-w-md rounded-2xl border border-border-strong bg-surface p-6 shadow-2xl outline-none">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-danger/10 text-danger">
          <Trash2 className="h-6 w-6" aria-hidden="true" />
        </div>
        <h2 id="delete-photo-title" className="mt-4 text-lg font-bold text-text-primary">Excluir foto permanentemente?</h2>
        <p id="delete-photo-description" className="mt-2 text-sm leading-relaxed text-text-secondary">
          A foto “{photo.descricao || (photo.tipo === 'antes' ? 'Antes do reparo' : 'Depois do reparo')}” e seu arquivo no Storage serão removidos. Esta ação não pode ser desfeita.
        </p>
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" onClick={onCancel} disabled={deleting} className="min-h-11 rounded-xl border border-border px-4 text-sm font-bold text-text-secondary hover:bg-surface-hover focus:outline-none focus:ring-2 focus:ring-focus-ring disabled:opacity-50">Cancelar</button>
          <button type="button" onClick={onConfirm} disabled={deleting} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-danger px-4 text-sm font-bold text-white hover:brightness-110 focus:outline-none focus:ring-2 focus:ring-focus-ring disabled:opacity-50">
            {deleting && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
            {deleting ? 'Excluindo…' : 'Excluir foto'}
          </button>
        </div>
      </div>
    </div>
  );
};

interface CameraDialogProps {
  type: PhotoType | null;
  starting: boolean;
  ready: boolean;
  error: string | null;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  onCapture: () => void;
  onClose: () => void;
  onFiles: (files: File[]) => void;
}

const CameraDialog: React.FC<CameraDialogProps> = ({ type, starting, ready, error, videoRef, onCapture, onClose, onFiles }) => {
  const dialogRef = useRef<HTMLDivElement>(null);
  useDialogAccessibility(Boolean(type), onClose, dialogRef);
  if (!type) return null;

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/80 p-3 backdrop-blur-sm print:hidden" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="camera-dialog-title" tabIndex={-1} className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-border-strong bg-surface shadow-2xl outline-none">
        <div className="flex min-h-16 items-center justify-between gap-4 border-b border-border px-5 py-3">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-primary">Captura real</p>
            <h2 id="camera-dialog-title" className="text-sm font-bold text-text-primary">Foto {type === 'antes' ? 'antes do reparo' : 'depois do reparo'}</h2>
          </div>
          <button type="button" onClick={onClose} className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-border bg-surface-elevated text-text-secondary hover:bg-surface-hover hover:text-text-primary focus:outline-none focus:ring-2 focus:ring-focus-ring" aria-label="Fechar câmera">
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
          {starting && (
            <div className="flex min-h-72 flex-col items-center justify-center rounded-xl border border-border bg-background text-text-secondary" role="status">
              <Loader2 className="h-8 w-8 animate-spin text-primary" aria-hidden="true" />
              <p className="mt-3 text-sm font-semibold">Solicitando acesso à câmera…</p>
            </div>
          )}

          {error && (
            <div className="rounded-xl border border-warning/40 bg-warning/10 p-5" role="alert">
              <div className="flex gap-3">
                <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-warning" aria-hidden="true" />
                <div>
                  <p className="text-sm font-bold text-text-primary">A câmera não está disponível</p>
                  <p className="mt-1 text-xs leading-relaxed text-text-secondary">{error}</p>
                  <label className="mt-4 inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl bg-primary px-4 text-xs font-bold text-white hover:bg-primary-hover focus-within:ring-2 focus-within:ring-focus-ring">
                    <ImageIcon className="h-4 w-4" aria-hidden="true" />
                    Escolher arquivo no dispositivo
                    <input type="file" accept="image/*" multiple className="sr-only" onChange={(event) => {
                      onFiles(Array.from(event.target.files || []));
                      event.target.value = '';
                      onClose();
                    }} />
                  </label>
                </div>
              </div>
            </div>
          )}

          {!starting && !error && (
            <div className="overflow-hidden rounded-xl border border-border bg-black">
              <video ref={videoRef} autoPlay muted playsInline className="aspect-video w-full object-contain" aria-label="Prévia ao vivo da câmera" />
            </div>
          )}
        </div>

        <div className="flex flex-col-reverse gap-2 border-t border-border bg-surface-elevated px-4 py-3 sm:flex-row sm:justify-end sm:px-6">
          <button type="button" onClick={onClose} className="min-h-11 rounded-xl border border-border px-4 text-sm font-bold text-text-secondary hover:bg-surface-hover focus:outline-none focus:ring-2 focus:ring-focus-ring">Cancelar</button>
          <button type="button" onClick={onCapture} disabled={!ready || Boolean(error)} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-bold text-white hover:bg-primary-hover focus:outline-none focus:ring-2 focus:ring-focus-ring disabled:cursor-not-allowed disabled:opacity-45">
            <Camera className="h-4 w-4" aria-hidden="true" />
            Capturar foto
          </button>
        </div>
      </div>
    </div>
  );
};

export const RegistroFotografico: React.FC<RegistroFotograficoProps> = ({
  db,
  onUpdateState,
  currentUser,
  onNotify,
  initialGarantiaId,
  onInitialGarantiaHandled,
  garantiaIdInicial,
}) => {
  const { garantias, clientes, equipamentos, fotos } = db;
  const [selectedGarantiaId, setSelectedGarantiaId] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [queues, setQueues] = useState<Record<PhotoType, PendingPhoto[]>>({ antes: [], depois: [] });
  const [dragging, setDragging] = useState<Record<PhotoType, boolean>>({ antes: false, depois: false });
  const [uploadingType, setUploadingType] = useState<PhotoType | null>(null);
  const [uploadProgress, setUploadProgress] = useState<Record<PhotoType, UploadProgress>>({
    antes: EMPTY_PROGRESS,
    depois: EMPTY_PROGRESS,
  });
  const [localNotice, setLocalNotice] = useState<{ message: string; type: NotifyType } | null>(null);
  const [lightboxPhoto, setLightboxPhoto] = useState<Foto | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Foto | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingDescription, setEditingDescription] = useState('');
  const [savingId, setSavingId] = useState<string | null>(null);
  const [comparisonBeforeId, setComparisonBeforeId] = useState('');
  const [comparisonAfterId, setComparisonAfterId] = useState('');
  const [cameraType, setCameraType] = useState<PhotoType | null>(null);
  const [cameraStarting, setCameraStarting] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const cameraRequestRef = useRef(0);
  const handledInitialGarantiaRef = useRef<string | null>(null);

  const notify = useCallback((message: string, type: NotifyType = 'info') => {
    if (onNotify) onNotify(message, type);
    else setLocalNotice({ message, type });
  }, [onNotify]);

  const releaseCameraStream = useCallback(() => {
    cameraRequestRef.current += 1;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraStream(null);
  }, []);

  const closeCamera = useCallback(() => {
    releaseCameraStream();
    setCameraType(null);
    setCameraStarting(false);
    setCameraError(null);
  }, [releaseCameraStream]);

  useEffect(() => () => {
    cameraRequestRef.current += 1;
    streamRef.current?.getTracks().forEach((track) => track.stop());
  }, []);

  useEffect(() => {
    if (!cameraStream || !videoRef.current) return;
    const video = videoRef.current;
    video.srcObject = cameraStream;
    void video.play().catch(() => {
      setCameraError('O navegador recebeu a câmera, mas não conseguiu iniciar a prévia. Feche outros aplicativos que possam estar usando o dispositivo ou selecione um arquivo.');
    });
  }, [cameraStream, cameraType]);

  useEffect(() => {
    const requestedId = initialGarantiaId || garantiaIdInicial;
    if (!requestedId) {
      handledInitialGarantiaRef.current = null;
      return;
    }
    if (
      requestedId !== handledInitialGarantiaRef.current
      && garantias.some((garantia) => garantia.id === requestedId)
    ) {
      handledInitialGarantiaRef.current = requestedId;
      setSelectedGarantiaId(requestedId);
      onInitialGarantiaHandled?.();
    }
  }, [garantiaIdInicial, garantias, initialGarantiaId, onInitialGarantiaHandled]);

  const activeGarantia = garantias.find((garantia) => garantia.id === selectedGarantiaId) || null;
  const activeCliente = activeGarantia ? clientes.find((cliente) => cliente.id === activeGarantia.clienteId) || null : null;
  const activeEquipamento = activeGarantia ? equipamentos.find((equipamento) => equipamento.id === activeGarantia.equipamentoId) || null : null;
  const activePhotos = useMemo(() => fotos
    .filter((photo) => photo.garantiaId === selectedGarantiaId)
    .slice()
    .sort((a, b) => String(b.dataRegistro).localeCompare(String(a.dataRegistro))), [fotos, selectedGarantiaId]);
  const beforePhotos = activePhotos.filter((photo) => photo.tipo === 'antes');
  const afterPhotos = activePhotos.filter((photo) => photo.tipo === 'depois');
  const currentQueues = {
    antes: queues.antes.filter((item) => item.garantiaId === selectedGarantiaId),
    depois: queues.depois.filter((item) => item.garantiaId === selectedGarantiaId),
  };

  useEffect(() => {
    setComparisonBeforeId((current) => beforePhotos.some((photo) => photo.id === current) ? current : beforePhotos[0]?.id || '');
    setComparisonAfterId((current) => afterPhotos.some((photo) => photo.id === current) ? current : afterPhotos[0]?.id || '');
  }, [beforePhotos, afterPhotos]);

  const normalizedSearchTerm = normalizeSearch(searchTerm);
  const filteredGarantias = useMemo(() => garantias.filter((garantia) => {
    if (!normalizedSearchTerm) return true;
    const cliente = clientes.find((item) => item.id === garantia.clienteId);
    const equipamento = equipamentos.find((item) => item.id === garantia.equipamentoId);
    return normalizeSearch([
      garantia.id,
      garantia.status,
      cliente?.nome,
      cliente?.cidade,
      equipamento?.numeroSerie,
      equipamento?.modelo,
      equipamento?.potencia,
    ].filter(Boolean).join(' ')).includes(normalizedSearchTerm);
  }), [clientes, equipamentos, garantias, normalizedSearchTerm]);

  const addFiles = async (type: PhotoType, incomingFiles: File[]) => {
    if (!selectedGarantiaId) {
      notify('Selecione uma garantia antes de adicionar imagens.', 'warning');
      return;
    }

    const imageFiles = incomingFiles.filter((file) => file.type.startsWith('image/'));
    const rejectedCount = incomingFiles.length - imageFiles.length;
    if (rejectedCount > 0) notify(`${rejectedCount} ${rejectedCount === 1 ? 'arquivo foi ignorado porque não é uma imagem' : 'arquivos foram ignorados porque não são imagens'}.`, 'warning');
    if (imageFiles.length === 0) return;

    const results = await Promise.allSettled(imageFiles.map(async (file) => ({
      localId: buildLocalId(),
      garantiaId: selectedGarantiaId,
      fileName: file.name,
      dataUrl: await fileToDataUrl(file),
      descricao: '',
      status: 'ready' as const,
    })));
    const successful = results.flatMap((result) => result.status === 'fulfilled' ? [result.value] : []);
    const failed = results.length - successful.length;

    if (successful.length > 0) {
      setQueues((current) => ({ ...current, [type]: [...current[type], ...successful] }));
    }
    if (failed > 0) notify(`${failed} ${failed === 1 ? 'imagem não pôde ser lida' : 'imagens não puderam ser lidas'}.`, 'error');
  };

  const updatePending = (type: PhotoType, localId: string, update: Partial<PendingPhoto>) => {
    setQueues((current) => ({
      ...current,
      [type]: current[type].map((item) => item.localId === localId ? { ...item, ...update } : item),
    }));
  };

  const refreshState = async () => {
    const refreshed = await buscarEstadoCompleto(currentUser?.id || null);
    onUpdateState(refreshed);
  };

  const uploadQueue = async (type: PhotoType) => {
    if (!selectedGarantiaId || uploadingType) return;
    const items = queues[type].filter((item) => item.garantiaId === selectedGarantiaId && item.status !== 'uploading');
    if (items.length === 0) return;

    setUploadingType(type);
    setUploadProgress((current) => ({ ...current, [type]: { ...EMPTY_PROGRESS, total: items.length } }));
    const successfulIds = new Set<string>();
    let processed = 0;
    let succeeded = 0;
    let failed = 0;
    let historyWarnings = 0;

    for (const item of items) {
      updatePending(type, item.localId, { status: 'uploading', error: undefined });
      try {
        const savedPhoto = await salvarFoto({
          garantiaId: selectedGarantiaId,
          tipo: type,
          url: item.dataUrl,
          descricao: item.descricao.trim() || (type === 'antes' ? 'Registro visual antes do reparo.' : 'Registro visual depois do reparo.'),
          usuarioResponsavel: currentUser?.nome || 'Usuário',
          usuarioId: currentUser?.id,
        });
        if (!savedPhoto) throw new Error('O servidor não confirmou o registro da foto.');
        successfulIds.add(item.localId);
        succeeded += 1;
      } catch (error) {
        if (getPersistedPhotoFromError(error)) {
          successfulIds.add(item.localId);
          succeeded += 1;
          historyWarnings += 1;
        } else {
          failed += 1;
          updatePending(type, item.localId, {
            status: 'error',
            error: getErrorMessage(error, 'Não foi possível salvar esta foto.'),
          });
        }
      } finally {
        processed += 1;
        setUploadProgress((current) => ({
          ...current,
          [type]: { total: items.length, processed, succeeded, failed },
        }));
      }
    }

    let refreshError: unknown = null;
    if (succeeded > 0) {
      setQueues((current) => ({
        ...current,
        [type]: current[type].filter((item) => !successfulIds.has(item.localId)),
      }));
      try {
        await refreshState();
      } catch (error) {
        refreshError = error;
      }
    }

    if (refreshError) {
      notify(`${succeeded} ${succeeded === 1 ? 'foto foi salva' : 'fotos foram salvas'}, mas a galeria não pôde ser recarregada agora: ${getErrorMessage(refreshError, 'erro de atualização')}${historyWarnings ? ` O histórico de ${historyWarnings} ${historyWarnings === 1 ? 'item também não foi confirmado' : 'itens também não foi confirmado'}.` : ''}`, 'warning');
    } else if (historyWarnings > 0) {
      notify(`${succeeded} ${succeeded === 1 ? 'foto foi salva' : 'fotos foram salvas'}, mas o histórico de ${historyWarnings} ${historyWarnings === 1 ? 'item não pôde ser confirmado' : 'itens não pôde ser confirmado'}. Os arquivos não serão reenviados.`, 'warning');
    } else if (failed === 0) notify(`${succeeded} ${succeeded === 1 ? 'foto foi salva e confirmada' : 'fotos foram salvas e confirmadas'} com sucesso.`, 'success');
    else if (succeeded > 0) notify(`${succeeded} ${succeeded === 1 ? 'foto foi salva' : 'fotos foram salvas'}, mas ${failed} ${failed === 1 ? 'falhou' : 'falharam'}. Revise os itens mantidos na fila.`, 'warning');
    else notify('Nenhuma foto foi salva. Revise os erros exibidos na fila e tente novamente.', 'error');

    setUploadingType(null);
  };

  const startCamera = async (type: PhotoType) => {
    if (!selectedGarantiaId) return;
    releaseCameraStream();
    const requestId = cameraRequestRef.current;
    setCameraType(type);
    setCameraStarting(true);
    setCameraError(null);

    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraStarting(false);
      setCameraError('Este navegador não oferece acesso direto à câmera. Use o seletor de arquivos abaixo para escolher uma foto real do dispositivo.');
      return;
    }

    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: false,
      });
      if (requestId !== cameraRequestRef.current) {
        mediaStream.getTracks().forEach((track) => track.stop());
        return;
      }
      streamRef.current = mediaStream;
      setCameraStream(mediaStream);
      setCameraStarting(false);
    } catch (error) {
      if (requestId !== cameraRequestRef.current) return;
      setCameraStarting(false);
      const errorName = error instanceof DOMException ? error.name : '';
      setCameraError(errorName === 'NotAllowedError' || errorName === 'SecurityError'
        ? 'A permissão para usar a câmera foi negada. Autorize o acesso nas configurações do navegador ou selecione uma imagem real do dispositivo.'
        : 'Não foi possível acessar uma câmera disponível. Verifique se outro aplicativo está usando o dispositivo ou selecione uma imagem real.');
    }
  };

  const capturePhoto = () => {
    if (!cameraType || !selectedGarantiaId || !videoRef.current) return;
    const video = videoRef.current;
    if (!video.videoWidth || !video.videoHeight) {
      notify('A câmera ainda não produziu uma imagem. Aguarde a prévia aparecer e tente novamente.', 'warning');
      return;
    }

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext('2d');
    if (!context) {
      notify('Não foi possível preparar a captura da câmera.', 'error');
      return;
    }
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
    const targetType = cameraType;
    setQueues((current) => ({
      ...current,
      [targetType]: [...current[targetType], {
        localId: buildLocalId(),
        garantiaId: selectedGarantiaId,
        fileName: `camera-${targetType}-${Date.now()}.jpg`,
        dataUrl,
        descricao: '',
        status: 'ready',
      }],
    }));
    closeCamera();
    notify('Captura adicionada à fila. Inclua a descrição e confirme o envio.', 'info');
  };

  const downloadPhoto = async (photo: Foto) => {
    if (!isRenderablePhotoUrl(photo.url)) {
      notify('Este registro não possui um arquivo de imagem disponível para download.', 'warning');
      return;
    }
    try {
      await downloadPhotoAsset(photo.url, `Vistoria-${selectedGarantiaId}-${photo.tipo}-${photo.id}.webp`);
    } catch (error) {
      notify(getErrorMessage(error, 'Não foi possível baixar a fotografia.'), 'error');
    }
  };

  const saveDescription = async (photo: Foto) => {
    if (!selectedGarantiaId || savingId) return;
    setSavingId(photo.id);
    try {
      const updated = await salvarFoto({
        fotoId: photo.id,
        garantiaId: selectedGarantiaId,
        tipo: photo.tipo,
        url: photo.url,
        descricao: editingDescription.trim(),
        usuarioResponsavel: currentUser?.nome || photo.usuarioResponsavel || 'Usuário',
        usuarioId: currentUser?.id,
      });
      if (!updated) throw new Error('O servidor não confirmou a atualização da foto.');
      setEditingId(null);
      setEditingDescription('');
      try {
        await refreshState();
        notify('Descrição da foto atualizada com sucesso.', 'success');
      } catch (refreshError) {
        notify(`A descrição foi salva, mas a galeria não pôde ser recarregada agora: ${getErrorMessage(refreshError, 'erro de atualização')}`, 'warning');
      }
    } catch (error) {
      if (getPersistedPhotoFromError(error)) {
        setEditingId(null);
        setEditingDescription('');
        try {
          await refreshState();
        } catch (refreshError) {
          console.error('Descrição persistida, mas a galeria não pôde ser recarregada:', refreshError);
        }
        notify(getErrorMessage(error, 'A descrição foi salva, mas o histórico não pôde ser confirmado.'), 'warning');
      } else {
        notify(getErrorMessage(error, 'Não foi possível atualizar a descrição.'), 'error');
      }
    } finally {
      setSavingId(null);
    }
  };

  const deletePhoto = async () => {
    if (!deleteTarget || deleting) return;
    setDeleting(true);
    try {
      await excluirFoto(deleteTarget.id);
      if (lightboxPhoto?.id === deleteTarget.id) setLightboxPhoto(null);
      setDeleteTarget(null);
      try {
        await refreshState();
        notify('Foto e arquivo associados foram excluídos.', 'success');
      } catch (refreshError) {
        notify(`A foto foi excluída, mas a galeria não pôde ser recarregada agora: ${getErrorMessage(refreshError, 'erro de atualização')}`, 'warning');
      }
    } catch (error) {
      notify(getErrorMessage(error, 'Não foi possível excluir a foto.'), 'error');
    } finally {
      setDeleting(false);
    }
  };

  const comparisonBefore = beforePhotos.find((photo) => photo.id === comparisonBeforeId) || null;
  const comparisonAfter = afterPhotos.find((photo) => photo.id === comparisonAfterId) || null;
  const noticeClasses: Record<NotifyType, string> = {
    success: 'border-success/40 bg-success/10 text-success',
    error: 'border-danger/40 bg-danger/10 text-danger',
    warning: 'border-warning/40 bg-warning/10 text-warning',
    info: 'border-information/40 bg-information/10 text-information',
  };

  return (
    <div className="space-y-6 text-text-primary">
      <header className="rounded-2xl border border-border bg-surface p-5 shadow-lg shadow-black/10 sm:p-6">
        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-primary">Evidências técnicas</p>
        <div className="mt-2 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-text-primary">Registro fotográfico</h1>
            <p className="mt-1 max-w-2xl text-sm leading-relaxed text-text-secondary">Organize, descreva e compare todas as imagens reais de entrada e conclusão de uma garantia.</p>
          </div>
          <div className="flex items-center gap-2 rounded-xl border border-border bg-surface-elevated px-3 py-2 text-xs text-text-secondary">
            <ImageIcon className="h-4 w-4 text-primary" aria-hidden="true" />
            <strong className="text-text-primary">{fotos.length}</strong> fotos no sistema
          </div>
        </div>
      </header>

      {localNotice && (
        <div className={`flex items-start justify-between gap-3 rounded-xl border px-4 py-3 text-sm ${noticeClasses[localNotice.type]}`} role={localNotice.type === 'error' ? 'alert' : 'status'} aria-live="polite">
          <p className="leading-relaxed">{localNotice.message}</p>
          <button type="button" onClick={() => setLocalNotice(null)} className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-lg hover:bg-black/10 focus:outline-none focus:ring-2 focus:ring-focus-ring" aria-label="Fechar aviso">
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      )}

      <section className="rounded-2xl border border-border bg-surface p-5 shadow-lg shadow-black/10 sm:p-6">
        <label htmlFor="warranty-photo-search" className="text-[11px] font-bold uppercase tracking-[0.16em] text-text-secondary">Localizar garantia</label>
        <div className="relative mt-2">
          <Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-text-muted" aria-hidden="true" />
          <input
            id="warranty-photo-search"
            type="search"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Código, cliente, série, modelo, potência ou status"
            className="min-h-11 w-full rounded-xl border border-border bg-background py-2.5 pl-10 pr-11 text-sm text-text-primary outline-none placeholder:text-text-muted focus:border-primary focus:ring-2 focus:ring-focus-ring"
          />
          {searchTerm && (
            <button type="button" onClick={() => setSearchTerm('')} className="absolute right-0 top-0 inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg text-text-muted hover:bg-surface-hover hover:text-text-primary focus:outline-none focus:ring-2 focus:ring-focus-ring" aria-label="Limpar busca">
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          )}
        </div>

        <div className="mt-3 max-h-64 overflow-y-auto rounded-xl border border-border bg-background/40 p-2" role="listbox" aria-label="Garantias encontradas">
          {filteredGarantias.length === 0 ? (
            <div className="px-3 py-6 text-center text-xs text-text-muted">Nenhuma garantia corresponde à busca.</div>
          ) : filteredGarantias.map((garantia) => {
            const cliente = clientes.find((item) => item.id === garantia.clienteId);
            const equipamento = equipamentos.find((item) => item.id === garantia.equipamentoId);
            const selected = garantia.id === selectedGarantiaId;
            return (
              <button
                key={garantia.id}
                type="button"
                role="option"
                aria-selected={selected}
                disabled={Boolean(uploadingType)}
                onClick={() => setSelectedGarantiaId(garantia.id)}
                className={`mb-1 flex min-h-14 w-full items-center justify-between gap-3 rounded-lg border px-3 py-2 text-left transition last:mb-0 focus:outline-none focus:ring-2 focus:ring-focus-ring disabled:cursor-not-allowed disabled:opacity-60 ${selected ? 'border-primary bg-primary-soft' : 'border-transparent hover:border-border hover:bg-surface-hover'}`}
              >
                <div className="min-w-0">
                  <span className="block font-mono text-xs font-bold text-text-primary">{garantia.id}</span>
                  <span className="mt-0.5 block truncate text-[11px] text-text-secondary">{cliente?.nome || 'Cliente não localizado'} · Série {equipamento?.numeroSerie || 'não informada'} · {equipamento?.modelo || 'Modelo não informado'}</span>
                </div>
                <span className="shrink-0 rounded-full border border-border bg-surface-elevated px-2 py-1 text-[10px] font-bold text-text-secondary">{garantia.status}</span>
              </button>
            );
          })}
        </div>
        <p className="mt-2 text-[11px] text-text-muted">{filteredGarantias.length} de {garantias.length} garantias exibidas.</p>
      </section>

      {!activeGarantia ? (
        <div className="rounded-2xl border border-dashed border-border-strong bg-surface px-6 py-14 text-center">
          <ImageIcon className="mx-auto h-9 w-9 text-text-muted" aria-hidden="true" />
          <h2 className="mt-3 text-base font-bold text-text-primary">Selecione uma garantia</h2>
          <p className="mt-1 text-sm text-text-secondary">As filas de upload e as galerias aparecerão após a seleção.</p>
        </div>
      ) : (
        <>
          <section className="grid gap-4 rounded-2xl border border-border bg-surface p-5 sm:grid-cols-2 lg:grid-cols-5">
            <div className="sm:col-span-2 lg:col-span-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted">Garantia</span>
              <strong className="mt-1 block font-mono text-sm text-primary">{activeGarantia.id}</strong>
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted">Cliente</span>
              <strong className="mt-1 block truncate text-xs text-text-primary" title={activeCliente?.nome}>{activeCliente?.nome || 'Não localizado'}</strong>
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted">Equipamento</span>
              <strong className="mt-1 block font-mono text-xs text-text-primary">{activeEquipamento?.numeroSerie || 'Não localizado'}</strong>
              <span className="block truncate text-[10px] text-text-muted">{activeEquipamento?.modelo}</span>
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted">Status</span>
              <strong className="mt-1 block text-xs text-text-primary">{activeGarantia.status}</strong>
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted">Galeria</span>
              <strong className="mt-1 block text-xs text-text-primary">{activePhotos.length} {activePhotos.length === 1 ? 'foto' : 'fotos'}</strong>
              <span className="block text-[10px] text-text-muted">{beforePhotos.length} antes · {afterPhotos.length} depois</span>
            </div>
          </section>

          <div className="grid gap-6 xl:grid-cols-2">
            <UploadQueuePanel
              type="antes"
              title="Antes do reparo"
              subtitle="Registre avarias, condições de recebimento e evidências do diagnóstico."
              items={currentQueues.antes}
              dragging={dragging.antes}
              uploading={Boolean(uploadingType)}
              progress={uploadProgress.antes}
              onDraggingChange={(value) => setDragging((current) => ({ ...current, antes: value }))}
              onFiles={(files) => void addFiles('antes', files)}
              onStartCamera={() => void startCamera('antes')}
              onDescriptionChange={(id, description) => updatePending('antes', id, { descricao: description })}
              onRemove={(id) => setQueues((current) => ({ ...current, antes: current.antes.filter((item) => item.localId !== id) }))}
              onUpload={() => void uploadQueue('antes')}
            />
            <UploadQueuePanel
              type="depois"
              title="Depois do reparo"
              subtitle="Registre o serviço concluído, os testes e a condição final do equipamento."
              items={currentQueues.depois}
              dragging={dragging.depois}
              uploading={Boolean(uploadingType)}
              progress={uploadProgress.depois}
              onDraggingChange={(value) => setDragging((current) => ({ ...current, depois: value }))}
              onFiles={(files) => void addFiles('depois', files)}
              onStartCamera={() => void startCamera('depois')}
              onDescriptionChange={(id, description) => updatePending('depois', id, { descricao: description })}
              onRemove={(id) => setQueues((current) => ({ ...current, depois: current.depois.filter((item) => item.localId !== id) }))}
              onUpload={() => void uploadQueue('depois')}
            />
          </div>

          <div className="grid gap-6 xl:grid-cols-2">
            <GallerySection
              type="antes"
              photos={beforePhotos}
              garantiaId={activeGarantia.id}
              editingId={editingId}
              editingDescription={editingDescription}
              savingId={savingId}
              onOpen={setLightboxPhoto}
              onDownload={downloadPhoto}
              onDelete={setDeleteTarget}
              onStartEdit={(photo) => {
                setEditingId(photo.id);
                setEditingDescription(photo.descricao || '');
              }}
              onCancelEdit={() => {
                setEditingId(null);
                setEditingDescription('');
              }}
              onEditingDescriptionChange={setEditingDescription}
              onSaveDescription={(photo) => void saveDescription(photo)}
            />
            <GallerySection
              type="depois"
              photos={afterPhotos}
              garantiaId={activeGarantia.id}
              editingId={editingId}
              editingDescription={editingDescription}
              savingId={savingId}
              onOpen={setLightboxPhoto}
              onDownload={downloadPhoto}
              onDelete={setDeleteTarget}
              onStartEdit={(photo) => {
                setEditingId(photo.id);
                setEditingDescription(photo.descricao || '');
              }}
              onCancelEdit={() => {
                setEditingId(null);
                setEditingDescription('');
              }}
              onEditingDescriptionChange={setEditingDescription}
              onSaveDescription={(photo) => void saveDescription(photo)}
            />
          </div>

          <section className="rounded-2xl border border-border bg-surface p-5 sm:p-6">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary-soft text-primary"><GitCompare className="h-5 w-5" aria-hidden="true" /></div>
              <div>
                <h2 className="text-base font-bold text-text-primary">Comparação antes e depois</h2>
                <p className="text-xs text-text-secondary">Escolha uma evidência de cada etapa para análise lado a lado.</p>
              </div>
            </div>

            <div className="mt-5 grid gap-5 lg:grid-cols-2">
              <div>
                <label htmlFor="comparison-before" className="text-[11px] font-bold uppercase tracking-wider text-danger">Foto antes</label>
                <select id="comparison-before" value={comparisonBeforeId} onChange={(event) => setComparisonBeforeId(event.target.value)} className="mt-2 min-h-11 w-full rounded-xl border border-border bg-background px-3 text-sm text-text-primary outline-none focus:border-primary focus:ring-2 focus:ring-focus-ring">
                  <option value="">Nenhuma foto disponível</option>
                  {beforePhotos.map((photo, index) => <option key={photo.id} value={photo.id}>#{index + 1} · {photo.descricao || formatSystemDate(photo.dataRegistro, true)}</option>)}
                </select>
                <div className="mt-3">
                  {comparisonBefore ? (
                    <button type="button" onClick={() => setLightboxPhoto(comparisonBefore)} className="block w-full rounded-xl focus:outline-none focus:ring-2 focus:ring-focus-ring" aria-label="Ampliar foto antes selecionada">
                      <PhotoImage url={comparisonBefore.url} alt={`Comparação antes do reparo da garantia ${activeGarantia.id}`} className="h-72 w-full" contain />
                    </button>
                  ) : <div className="flex h-72 items-center justify-center rounded-xl border border-dashed border-border-strong bg-surface-elevated text-xs text-text-muted">Sem foto antes</div>}
                </div>
              </div>
              <div>
                <label htmlFor="comparison-after" className="text-[11px] font-bold uppercase tracking-wider text-success">Foto depois</label>
                <select id="comparison-after" value={comparisonAfterId} onChange={(event) => setComparisonAfterId(event.target.value)} className="mt-2 min-h-11 w-full rounded-xl border border-border bg-background px-3 text-sm text-text-primary outline-none focus:border-primary focus:ring-2 focus:ring-focus-ring">
                  <option value="">Nenhuma foto disponível</option>
                  {afterPhotos.map((photo, index) => <option key={photo.id} value={photo.id}>#{index + 1} · {photo.descricao || formatSystemDate(photo.dataRegistro, true)}</option>)}
                </select>
                <div className="mt-3">
                  {comparisonAfter ? (
                    <button type="button" onClick={() => setLightboxPhoto(comparisonAfter)} className="block w-full rounded-xl focus:outline-none focus:ring-2 focus:ring-focus-ring" aria-label="Ampliar foto depois selecionada">
                      <PhotoImage url={comparisonAfter.url} alt={`Comparação depois do reparo da garantia ${activeGarantia.id}`} className="h-72 w-full" contain />
                    </button>
                  ) : <div className="flex h-72 items-center justify-center rounded-xl border border-dashed border-border-strong bg-surface-elevated text-xs text-text-muted">Sem foto depois</div>}
                </div>
              </div>
            </div>
          </section>
        </>
      )}

      <CameraDialog
        type={cameraType}
        starting={cameraStarting}
        ready={Boolean(cameraStream)}
        error={cameraError}
        videoRef={videoRef}
        onCapture={capturePhoto}
        onClose={closeCamera}
        onFiles={(files) => {
          if (cameraType) void addFiles(cameraType, files);
        }}
      />
      <ConfirmDeleteDialog photo={deleteTarget} deleting={deleting} onCancel={() => !deleting && setDeleteTarget(null)} onConfirm={() => void deletePhoto()} />
      <PhotoLightbox
        photos={activePhotos}
        currentId={lightboxPhoto?.id || null}
        warrantyCode={activeGarantia?.id || ''}
        onChange={setLightboxPhoto}
        onClose={() => setLightboxPhoto(null)}
        onDownload={downloadPhoto}
      />
    </div>
  );
};
