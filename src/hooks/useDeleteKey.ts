import { useEffect } from 'react';

/**
 * Викликає onDelete, коли користувач тисне Delete/Backspace і щось виділено.
 * Ігнорує натискання, коли фокус у полі вводу (input/textarea/contentEditable),
 * щоб не заважати редагуванню тексту (напр. перейменуванню).
 */
export function useDeleteKey(selectedId: string | null, onDelete: () => void) {
  useEffect(() => {
    if (!selectedId) return;

    const handler = (e: KeyboardEvent) => {
      if (e.key !== 'Delete' && e.key !== 'Backspace') return;
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || target?.isContentEditable) return;

      e.preventDefault();
      onDelete();
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [selectedId, onDelete]);
}
