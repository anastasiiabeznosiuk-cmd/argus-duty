import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Checkbox, InlineNotification, Modal, TextArea } from '@carbon/react';
import { api } from '../api.js';
import { useStore } from '../store.js';
import { useDraft, useNow } from '../ui/hooks.js';
import { DataState } from '../ui/DataState.jsx';
import { HealthTag, OverdueTag, PriorityTag, StatusTag } from '../ui/Tags.jsx';
import { buildHandoverDraft, composeReportText } from '../lib/handover.js';
import { formatDateTime, isOverdue } from '../lib/events.js';

function Stats({ counts }) {
  return (
    <dl className="stats">
      <div>
        <dt>Незакритих</dt>
        <dd>{counts.open}</dd>
      </div>
      <div>
        <dt>Нових</dt>
        <dd>{counts.new}</dd>
      </div>
      <div>
        <dt>Прострочених</dt>
        <dd>{counts.overdue}</dd>
      </div>
      <div>
        <dt>Критичних</dt>
        <dd>{counts.critical}</dd>
      </div>
    </dl>
  );
}

/** Приймання зміни (В-8): черговий має ознайомитися з кожною незакритою подією зі звіту. */
function AcceptView({ report, events, onDone }) {
  const [reviewed, setReviewed] = useState(() => new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const byId = useMemo(() => Object.fromEntries(events.map((e) => [e.id, e])), [events]);
  const pending = report.openEventIds.map((id) => byId[id]).filter((e) => e && e.status !== 'closed');
  const left = pending.filter((e) => !reviewed.has(e.id));

  const toggle = (id) =>
    setReviewed((cur) => {
      const next = new Set(cur);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const accept = async () => {
    setBusy(true);
    setError(null);
    try {
      await api.accept(report.id, [...reviewed]);
      onDone();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section aria-labelledby="accept-h">
      <h2 id="accept-h" className="section__title">
        Приймання зміни
      </h2>
      <p className="section__lead">
        Звіт від {report.from.rank} {report.from.name}, сформовано {formatDateTime(report.createdAt)}.
      </p>
      <Stats counts={report.counts} />
      <h3 className="section__h3">Примітки того, хто передає</h3>
      <p className="notes-box">{report.notes || '—'}</p>
      <h3 className="section__h3">Незакриті події ({pending.length})</h3>
      {pending.length === 0 ? (
        <p className="section__lead">Незакритих подій немає.</p>
      ) : (
        <ul className="review">
          {pending.map((e) => (
            <li key={e.id} className="review__item">
              <Checkbox id={`rv-${e.id}`} labelText={`Ознайомлений: ${e.id}`} checked={reviewed.has(e.id)} onChange={() => toggle(e.id)} hideLabel />
              <PriorityTag priority={e.priority} />
              <StatusTag status={e.status} />
              <span className="review__title">{e.title}</span>
            </li>
          ))}
        </ul>
      )}
      <h3 className="section__h3">Джерела на момент передавання</h3>
      <ul className="sources sources--plain">
        {report.sourcesSnapshot.map((s) => (
          <li key={s.id} className="sources__item">
            <span>{s.name}</span>
            <HealthTag health={s.health} />
          </li>
        ))}
      </ul>
      {error && <InlineNotification kind="error" lowContrast hideCloseButton title="Не вдалося прийняти зміну" subtitle={error} />}
      <div className="actions">
        <Button onClick={accept} disabled={busy || left.length > 0}>
          {busy ? 'Приймання…' : 'Прийняти зміну'}
        </Button>
        {left.length > 0 && <span className="actions__hint">Залишилось переглянути: {left.length}</span>}
      </div>
    </section>
  );
}

/** Передавання зміни (В-9): звіт формується автоматично з поточного стану, черговий додає примітки. */
function HandoverView({ officer, events, sources, now, onDone }) {
  const [notes, setNotes] = useDraft(`argus.notes.${officer.id}`);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);
  const draft = useMemo(() => buildHandoverDraft({ events, sources, now }), [events, sources, now]);

  const send = async () => {
    setBusy(true);
    setError(null);
    try {
      await api.handover(notes);
      onDone();
    } catch (e) {
      setError(e.message);
      setConfirm(false);
    } finally {
      setBusy(false);
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(composeReportText(draft, notes, officer, now));
      setCopied(true);
    } catch {
      setError('Не вдалося скопіювати: буфер обміну недоступний');
    }
  };

  return (
    <section aria-labelledby="handover-h">
      <h2 id="handover-h" className="section__title">
        Передавання зміни
      </h2>
      <p className="section__lead">Звіт сформовано автоматично за станом на {formatDateTime(new Date(now).toISOString())}.</p>
      <Stats counts={draft.counts} />
      {draft.unacked.length > 0 && (
        <InlineNotification
          kind="warning"
          lowContrast
          hideCloseButton
          title={`Нікому не передано подій: ${draft.unacked.length}`}
          subtitle="Нові події, які ніхто не взяв у роботу, потраплять у звіт як невирішені."
        />
      )}
      <h3 className="section__h3">Незакриті події</h3>
      <DataState status="ready" isEmpty={draft.open.length === 0} emptyTitle="Незакритих подій немає">
        <ul className="review">
          {draft.open.map((e) => (
            <li key={e.id} className="review__item">
              <PriorityTag priority={e.priority} />
              <StatusTag status={e.status} />
              {isOverdue(e, now) && <OverdueTag />}
              <span className="review__title">{e.title}</span>
            </li>
          ))}
        </ul>
      </DataState>
      <h3 className="section__h3">Джерела з відхиленням</h3>
      {draft.badSources.length === 0 ? (
        <p className="section__lead">Усі джерела справні.</p>
      ) : (
        <ul className="sources sources--plain">
          {draft.badSources.map((s) => (
            <li key={s.id} className="sources__item">
              <span>{s.name}</span>
              <HealthTag health={s.health} />
            </li>
          ))}
        </ul>
      )}
      <TextArea
        id="handover-notes"
        labelText="Примітки наступній зміні (чернетка зберігається автоматично)"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        rows={4}
      />
      {error && <InlineNotification kind="error" lowContrast hideCloseButton title="Помилка" subtitle={error} />}
      <div className="actions">
        <Button onClick={() => setConfirm(true)}>Передати зміну</Button>
        <Button kind="tertiary" onClick={copy}>
          {copied ? 'Скопійовано' : 'Скопіювати звіт'}
        </Button>
      </div>
      <Modal
        open={confirm}
        size="sm"
        modalHeading="Передати зміну?"
        primaryButtonText={busy ? 'Передавання…' : 'Передати'}
        secondaryButtonText="Скасувати"
        primaryButtonDisabled={busy}
        onRequestClose={() => setConfirm(false)}
        onRequestSubmit={send}
      >
        <p>
          У звіт потрапить {draft.counts.open} незакритих подій. Після передавання ви втратите право працювати з чергою до наступного приймання.
        </p>
      </Modal>
    </section>
  );
}

function History({ history }) {
  if (history.length === 0) return null;
  return (
    <section aria-labelledby="history-h" className="history">
      <h2 id="history-h" className="section__title">
        Журнал приймання і передавання
      </h2>
      <ul className="review">
        {history.map((r) => (
          <li key={r.id} className="review__item review__item--col">
            <span>
              <b>{r.id}</b> · {formatDateTime(r.createdAt)} · передав {r.from.name}, прийняв {r.acceptedBy?.name ?? '—'}
            </span>
            <span className="review__meta">
              Незакритих: {r.counts.open}, прострочених: {r.counts.overdue}. {r.notes}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function ShiftPage() {
  const navigate = useNavigate();
  const officer = useStore((s) => s.session.officer);
  const events = useStore((s) => s.events);
  const sources = useStore((s) => s.sources);
  const logout = useStore((s) => s.logout);
  const now = useNow();
  const [res, setRes] = useState({ status: 'loading', error: null, data: null });
  const [handedOver, setHandedOver] = useState(false);

  const load = useCallback(async () => {
    setRes((r) => ({ ...r, status: 'loading' }));
    try {
      setRes({ status: 'ready', error: null, data: await api.shift() });
    } catch (e) {
      setRes({ status: 'error', error: e.message, data: null });
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const shift = res.data;
  let body = null;
  if (handedOver) {
    body = (
      <div className="state state--done" data-testid="handover-done">
        <InlineNotification kind="success" lowContrast hideCloseButton title="Зміну передано" subtitle="Звіт збережено. Наступний черговий приймає зміну після входу." />
        <Button
          onClick={() => {
            logout();
            navigate('/login');
          }}
        >
          Вийти із системи
        </Button>
      </div>
    );
  } else if (shift?.pendingHandover) {
    body = (
      <AcceptView
        report={shift.pendingHandover}
        events={events}
        onDone={async () => {
          await load();
          navigate('/picture');
        }}
      />
    );
  } else if (shift?.active?.officerId === officer.id) {
    body = <HandoverView officer={officer} events={events} sources={sources} now={now} onDone={() => setHandedOver(true)} />;
  } else if (shift) {
    body = (
      <div className="state state--empty">
        <p className="state__title">Зміну веде {shift.active?.name ?? 'інший черговий'}</p>
        <p className="state__text">Ви можете переглядати обстановку, але передавати зміну може лише черговий, який її веде.</p>
      </div>
    );
  }

  return (
    <div className="shiftpage">
      <h1 className="page__title">Зміна</h1>
      {shift?.active && !handedOver && (
        <p className="section__lead" data-testid="on-duty">
          На зміні: {shift.active.rank} {shift.active.name}, з {formatDateTime(shift.active.startedAt)}
        </p>
      )}
      <DataState status={res.status} error={res.error} isEmpty={!shift} onRetry={load} rows={6}>
        {body}
      </DataState>
      {shift && <History history={shift.history} />}
    </div>
  );
}
