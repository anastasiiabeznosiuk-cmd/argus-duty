import { DataState } from '../ui/DataState.jsx';

const content = <p>Тут відображаються дані представлення.</p>;

export const Loading = () => (
  <DataState status="loading" isEmpty>
    {content}
  </DataState>
);
export const ErrorState = () => (
  <DataState status="error" error="Немає зв’язку із сервером" onRetry={() => {}}>
    {content}
  </DataState>
);
export const Empty = () => (
  <DataState status="ready" isEmpty emptyTitle="Незакритих подій немає" emptyText="Усі події опрацьовано. Нові з’являтимуться тут автоматично.">
    {content}
  </DataState>
);
export const Data = () => (
  <DataState status="ready" isEmpty={false}>
    {content}
  </DataState>
);

export default { title: 'DataState' };
