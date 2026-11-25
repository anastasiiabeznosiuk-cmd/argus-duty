import { useState } from 'react';
import { EventQueue } from '../components/EventQueue.jsx';
import { ResolveDialog } from '../components/ResolveDialog.jsx';
import { NOW, events } from './fixtures.js';

const Queue = (props) => {
  const [selectedId, setSelectedId] = useState('E-0002');
  return (
    <div style={{ width: 400, height: 640, display: 'flex', flexDirection: 'column' }}>
      <EventQueue events={events} status="ready" now={NOW} selectedId={selectedId} onSelect={setSelectedId} onResolve={() => {}} {...props} />
    </div>
  );
};

export const Data = () => <Queue />;
export const Loading = () => <Queue events={[]} status="loading" />;
export const ErrorState = () => <Queue events={[]} status="error" error="Тестовий збій сервера" onRetry={() => {}} />;
export const Empty = () => <Queue events={[]} />;
export const LateEvents = () => <Queue now={NOW + 20 * 60_000} />;

export const AckDialogCritical = () => (
  <ResolveDialog event={{ ...events[0], priorityLabel: 'критична' }} action="ack" onClose={() => {}} onSubmit={async () => {}} />
);
export const CloseDialog = () => (
  <ResolveDialog event={{ ...events[4], priorityLabel: 'низька' }} action="close" onClose={() => {}} onSubmit={async () => {}} />
);

export default { title: 'Черга подій' };
