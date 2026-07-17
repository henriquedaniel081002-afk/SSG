/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Download, ImageOff, X } from 'lucide-react';
import { Foto } from '../../types';

const FOCUSABLE_ELEMENTS = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

export function useDialogAccessibility<T extends HTMLElement>(
  open: boolean,
  onClose: () => void,
  containerRef: React.RefObject<T | null>,
) {
  const closeRef = useRef(onClose);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    closeRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return;

    previousFocusRef.current = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;

    const animationFrame = window.requestAnimationFrame(() => {
      const container = containerRef.current;
      const firstFocusable = container?.querySelector<HTMLElement>(FOCUSABLE_ELEMENTS);
      (firstFocusable || container)?.focus();
    });

    const handleKeyDown = (event: KeyboardEvent) => {
      const openDialogs = Array.from(document.querySelectorAll<HTMLElement>('[aria-modal="true"]')) as HTMLElement[];
      if (openDialogs.length > 0 && openDialogs[openDialogs.length - 1] !== containerRef.current) return;

      if (event.key === 'Escape') {
        event.preventDefault();
        closeRef.current();
        return;
      }

      if (event.key !== 'Tab') return;
      const container = containerRef.current;
      if (!container) return;

      const focusable = (Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_ELEMENTS)) as HTMLElement[])
        .filter((element) => !element.hasAttribute('hidden') && element.getAttribute('aria-hidden') !== 'true');

      if (focusable.length === 0) {
        event.preventDefault();
        container.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const activeElement = document.activeElement;

      if (event.shiftKey && (activeElement === first || !container.contains(activeElement))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      window.cancelAnimationFrame(animationFrame);
      document.removeEventListener('keydown', handleKeyDown);
      const previousFocus = previousFocusRef.current;
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, [open, containerRef]);
}

export function isRenderablePhotoUrl(url?: string | null) {
  if (!url) return false;
  return /^(data:image\/|https?:\/\/|blob:)/i.test(url.trim());
}

export async function downloadPhotoAsset(url: string, filename: string) {
  if (!isRenderablePhotoUrl(url)) throw new Error('O arquivo desta fotografia não está disponível.');

  let downloadUrl = url;
  let temporaryUrl: string | null = null;
  if (/^https?:\/\//i.test(url)) {
    const response = await fetch(url);
    if (!response.ok) throw new Error('Não foi possível obter o arquivo da fotografia.');
    temporaryUrl = URL.createObjectURL(await response.blob());
    downloadUrl = temporaryUrl;
  }

  const link = document.createElement('a');
  link.href = downloadUrl;
  link.download = filename;
  link.rel = 'noopener noreferrer';
  document.body.appendChild(link);
  try {
    link.click();
  } finally {
    link.remove();
    if (temporaryUrl) window.setTimeout(() => URL.revokeObjectURL(temporaryUrl), 0);
  }
}

export function parseSystemDate(value?: string | null) {
  if (!value) return null;

  const calendarMatch = value.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?/);
  if (calendarMatch) {
    const [, year, month, day, hour = '00', minute = '00', second = '00'] = calendarMatch;
    const parsed = new Date(
      Number(year),
      Number(month) - 1,
      Number(day),
      Number(hour),
      Number(minute),
      Number(second),
    );
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function formatSystemDate(value?: string | null, includeTime = false) {
  const date = parseSystemDate(value);
  if (!date) return 'Não informado';
  return new Intl.DateTimeFormat('pt-BR', includeTime
    ? { dateStyle: 'short', timeStyle: 'short' }
    : { dateStyle: 'short' }).format(date);
}

interface PhotoImageProps {
  url: string;
  alt: string;
  className?: string;
  contain?: boolean;
}

export const PhotoImage: React.FC<PhotoImageProps> = ({
  url,
  alt,
  className = 'h-48 w-full',
  contain = false,
}) => {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [url]);

  if (!isRenderablePhotoUrl(url) || failed) {
    return (
      <div
        className={`${className} flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border-strong bg-surface-elevated px-4 text-center text-text-muted`}
        role="img"
        aria-label={`${alt}. Arquivo indisponível.`}
      >
        <ImageOff className="h-7 w-7" aria-hidden="true" />
        <span className="text-xs font-semibold">Arquivo de imagem indisponível</span>
        <span className="max-w-xs text-[11px] leading-relaxed">O registro foi preservado, mas não contém uma URL de imagem válida.</span>
      </div>
    );
  }

  return (
    <img
      src={url}
      alt={alt}
      className={`${className} rounded-xl bg-surface-elevated ${contain ? 'object-contain' : 'object-cover'}`}
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
    />
  );
};

interface PhotoLightboxProps {
  photos: Foto[];
  currentId: string | null;
  warrantyCode: string;
  onChange: (photo: Foto) => void;
  onClose: () => void;
  onDownload?: (photo: Foto) => void;
}

export const PhotoLightbox: React.FC<PhotoLightboxProps> = ({
  photos,
  currentId,
  warrantyCode,
  onChange,
  onClose,
  onDownload,
}) => {
  const dialogRef = useRef<HTMLDivElement>(null);
  const currentIndex = photos.findIndex((photo) => photo.id === currentId);
  const currentPhoto = currentIndex >= 0 ? photos[currentIndex] : null;
  const canNavigate = photos.length > 1;

  useDialogAccessibility(Boolean(currentPhoto), onClose, dialogRef);

  const move = (direction: -1 | 1) => {
    if (!currentPhoto || photos.length === 0) return;
    const nextIndex = (currentIndex + direction + photos.length) % photos.length;
    onChange(photos[nextIndex]);
  };

  useEffect(() => {
    if (!currentPhoto) return;
    const handleArrowKeys = (event: KeyboardEvent) => {
      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        move(-1);
      }
      if (event.key === 'ArrowRight') {
        event.preventDefault();
        move(1);
      }
    };
    document.addEventListener('keydown', handleArrowKeys);
    return () => document.removeEventListener('keydown', handleArrowKeys);
  });

  if (!currentPhoto) return null;

  const typeLabel = currentPhoto.tipo === 'antes' ? 'Antes do reparo' : 'Depois do reparo';

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-black/90 p-3 backdrop-blur-sm print:hidden"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="photo-lightbox-title"
        tabIndex={-1}
        className="flex h-full max-h-[920px] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-border-strong bg-surface shadow-2xl outline-none"
      >
        <div className="flex min-h-16 items-center justify-between gap-4 border-b border-border px-4 py-3 sm:px-6">
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-primary">{typeLabel}</p>
            <h2 id="photo-lightbox-title" className="truncate text-sm font-bold text-text-primary">
              {warrantyCode} · Foto {currentIndex + 1} de {photos.length}
            </h2>
          </div>
          <div className="flex items-center gap-2">
            {onDownload && (
              <button
                type="button"
                onClick={() => onDownload(currentPhoto)}
                className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-border bg-surface-elevated text-text-secondary transition hover:bg-surface-hover hover:text-text-primary focus:outline-none focus:ring-2 focus:ring-focus-ring"
                aria-label="Baixar foto atual"
              >
                <Download className="h-5 w-5" aria-hidden="true" />
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-border bg-surface-elevated text-text-secondary transition hover:bg-surface-hover hover:text-text-primary focus:outline-none focus:ring-2 focus:ring-focus-ring"
              aria-label="Fechar visualização ampliada"
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>
        </div>

        <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden bg-background p-3 sm:p-6">
          {canNavigate && (
            <button
              type="button"
              onClick={() => move(-1)}
              className="absolute left-3 z-10 inline-flex min-h-12 min-w-12 items-center justify-center rounded-full border border-border-strong bg-surface/95 text-text-primary shadow-xl transition hover:bg-surface-hover focus:outline-none focus:ring-2 focus:ring-focus-ring sm:left-6"
              aria-label="Foto anterior"
            >
              <ChevronLeft className="h-6 w-6" aria-hidden="true" />
            </button>
          )}
          <PhotoImage
            url={currentPhoto.url}
            alt={`${typeLabel} da garantia ${warrantyCode}. ${currentPhoto.descricao || 'Sem descrição técnica.'}`}
            className="max-h-full w-full"
            contain
          />
          {canNavigate && (
            <button
              type="button"
              onClick={() => move(1)}
              className="absolute right-3 z-10 inline-flex min-h-12 min-w-12 items-center justify-center rounded-full border border-border-strong bg-surface/95 text-text-primary shadow-xl transition hover:bg-surface-hover focus:outline-none focus:ring-2 focus:ring-focus-ring sm:right-6"
              aria-label="Próxima foto"
            >
              <ChevronRight className="h-6 w-6" aria-hidden="true" />
            </button>
          )}
        </div>

        <div className="border-t border-border bg-surface-elevated px-4 py-3 text-xs text-text-secondary sm:px-6">
          <p className="font-semibold text-text-primary">{currentPhoto.descricao || 'Sem descrição técnica.'}</p>
          <p className="mt-1">Registrada por {currentPhoto.usuarioResponsavel || 'usuário não identificado'} em {formatSystemDate(currentPhoto.dataRegistro, true)}.</p>
          {canNavigate && <p className="mt-1 text-text-muted">Use as setas do teclado para navegar e Esc para fechar.</p>}
        </div>
      </div>
    </div>
  );
};
