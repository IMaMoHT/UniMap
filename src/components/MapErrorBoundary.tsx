import React from 'react';

interface Props {
  children: React.ReactNode;
  /** Назва ділянки — потрапляє в лог, щоб було зрозуміло, що саме впало */
  section: string;
  /** Що показати замість збійного блоку (за замовчуванням — нічого) */
  fallback?: React.ReactNode;
  /**
   * Коли значення змінюється, межа скидається і пробує відрендерити знову.
   * Без цього одна тимчасова помилка (напр. під час перемикання поверху)
   * назавжди гасила цілий шар до перезавантаження сторінки.
   */
  resetKey?: string | number;
}

interface State {
  hasError: boolean;
  resetKey?: string | number;
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

  static getDerivedStateFromError(): Partial<State> {
    return { hasError: true };
  }

  static getDerivedStateFromProps(props: Props, state: State): Partial<State> | null {
    if (props.resetKey !== state.resetKey) {
      return { hasError: false, resetKey: props.resetKey };
    }
    return null;
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
