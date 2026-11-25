import { Button, InlineNotification, SkeletonText } from '@carbon/react';

/**
 * Єдина обгортка чотирьох станів представлення: завантаження, помилка, відсутність даних, дані.
 * status: 'idle' | 'loading' | 'error' | 'ready'. Під час повторного завантаження вже наявні дані не ховаємо.
 */
export function DataState({ status, error, isEmpty, onRetry, emptyTitle = 'Даних немає', emptyText, rows = 5, children }) {
  if (status === 'error') {
    return (
      <div className="state state--error" data-testid="state-error" role="alert">
        <InlineNotification
          kind="error"
          lowContrast
          hideCloseButton
          title="Не вдалося завантажити дані"
          subtitle={error ?? 'Невідома помилка'}
        />
        {onRetry && (
          <Button kind="tertiary" size="sm" onClick={onRetry}>
            Повторити
          </Button>
        )}
      </div>
    );
  }
  if ((status === 'idle' || status === 'loading') && isEmpty !== false) {
    return (
      <div className="state state--loading" data-testid="state-loading" aria-busy="true" aria-live="polite">
        <span className="visually-hidden">Завантаження…</span>
        <SkeletonText paragraph lineCount={rows} />
      </div>
    );
  }
  if (isEmpty) {
    return (
      <div className="state state--empty" data-testid="state-empty">
        <p className="state__title">{emptyTitle}</p>
        {emptyText && <p className="state__text">{emptyText}</p>}
      </div>
    );
  }
  return children;
}
