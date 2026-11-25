import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, InlineNotification, Select, SelectItem } from '@carbon/react';
import { api } from '../api.js';
import { useStore } from '../store.js';
import { DataState } from '../ui/DataState.jsx';

/** Спрощений вхід (див. 3.4 записки): черговий обирає себе зі списку. У цільовій системі — OpenID Connect. */
export function LoginPage() {
  const navigate = useNavigate();
  const login = useStore((s) => s.login);
  const [res, setRes] = useState({ status: 'loading', error: null, officers: [] });
  const [officerId, setOfficerId] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setRes((r) => ({ ...r, status: 'loading' }));
    try {
      const { officers } = await api.officers();
      setRes({ status: 'ready', error: null, officers });
      setOfficerId((cur) => cur || officers[0]?.id || '');
    } catch (e) {
      setRes({ status: 'error', error: e.message, officers: [] });
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await login(officerId);
      const shift = await api.shift();
      navigate(shift.pendingHandover ? '/shift' : '/picture', { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login">
      <form className="login__card" onSubmit={submit}>
        <p className="shell__logo">ARGUS</p>
        <h1 className="login__title">АРМ чергового зміни</h1>
        <p className="login__text">Центр моніторингу надводної та повітряної обстановки</p>
        <DataState
          status={res.status}
          error={res.error}
          isEmpty={res.officers.length === 0}
          onRetry={load}
          emptyTitle="Список черговових порожній"
          rows={2}
        >
          <Select id="officer" labelText="Черговий" value={officerId} onChange={(e) => setOfficerId(e.target.value)}>
            {res.officers.map((o) => (
              <SelectItem key={o.id} value={o.id} text={`${o.rank} ${o.name} (${o.callsign})`} />
            ))}
          </Select>
          {error && <InlineNotification kind="error" lowContrast hideCloseButton title="Вхід неможливий" subtitle={error} />}
          <Button type="submit" disabled={busy || !officerId} className="login__submit">
            {busy ? 'Вхід…' : 'Увійти'}
          </Button>
        </DataState>
      </form>
    </div>
  );
}
