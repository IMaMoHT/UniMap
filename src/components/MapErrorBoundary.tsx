import React from 'react';

interface Props {
  children: React.ReactNode;
  /** Назва ділянки — потрапляє в лог, щоб було зрозуміло, що саме впало */
  section: string;
  /** Що показати замість збійного блоку (за замовчуванням — нічого) */
  fallback?: React.ReactNode;
}

interface State {
  hasError: boolean;
}

/**
 * Локальна межа помилок для окремих шарів карти.
 *
 * Глобальний ErrorBoundary у main.tsx ховає ВЕСЬ застосунок, якщо впаде
 * будь-який декоративний шар. Ця межа ізолює збій: карта і маршрут
 * лишаються робочими, навіть якщо, наприклад, у sceneryItems.ts потрапили
 * биті дані після ручного редагування.
 */
export default class MapErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: unknown, info: unknown): void {
    console.error(`[UniMap] Збій у шарі "${this.props.section}":`, error, info);
  }

  render(): React.ReactNode {
    if (this.state.hasError) {
      return this.props.fallback ?? null;
    }
    return this.props.children;
  }
}
