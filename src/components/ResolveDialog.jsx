import { useState } from 'react';
import { InlineNotification, Modal, TextArea } from '@carbon/react';

const COPY = {
  ack: { heading: 'Взяти подію в роботу', primary: 'Взяти в роботу' },
  close: { heading: 'Закрити подію', primary: 'Закрити подію' },
};

/** Підтвердження події з коментарем. Для критичної події коментар обов’язковий (В-4). */
export function ResolveDialog({ event, action, onClose, onSubmit }) {
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  if (!event) return null;
  const copy = COPY[action];
  const required = event.priority === 'critical';
  const missing = required && comment.trim() === '';

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await onSubmit(comment.trim());
      setComment('');
      onClose();
    } catch (e) {
      setError(e?.message ?? 'Не вдалося зберегти');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open
      size="sm"
      modalHeading={copy.heading}
      modalLabel={`${event.id} · ${event.priorityLabel ?? event.priority}`}
      primaryButtonText={busy ? 'Збереження…' : copy.primary}
      secondaryButtonText="Скасувати"
      primaryButtonDisabled={busy || missing}
      onRequestClose={onClose}
      onRequestSubmit={submit}
    >
      <p className="dialog__title">{event.title}</p>
      <TextArea
        id="resolve-comment"
        labelText={required ? 'Коментар (обов’язковий для критичної події)' : 'Коментар (необов’язково)'}
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        rows={3}
        invalid={missing && comment !== ''}
        invalidText="Опишіть, що зроблено"
        data-modal-primary-focus
      />
      {error && <InlineNotification kind="error" lowContrast hideCloseButton title="Помилка" subtitle={error} />}
    </Modal>
  );
}
