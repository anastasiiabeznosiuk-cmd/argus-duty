import { Navigate, Route, Routes } from 'react-router-dom';
import { useStore } from './store.js';
import { Shell } from './ui/Shell.jsx';
import { LoginPage } from './views/LoginPage.jsx';
import { PicturePage } from './views/PicturePage.jsx';
import { EventsPage } from './views/EventsPage.jsx';
import { ShiftPage } from './views/ShiftPage.jsx';

/** Захищені маршрути доступні лише після входу; без сеансу — перехід на /login. */
function RequireAuth({ children }) {
  const session = useStore((s) => s.session);
  return session ? children : <Navigate to="/login" replace />;
}

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        element={
          <RequireAuth>
            <Shell />
          </RequireAuth>
        }
      >
        <Route path="/picture" element={<PicturePage />} />
        <Route path="/events" element={<EventsPage />} />
        <Route path="/shift" element={<ShiftPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/picture" replace />} />
    </Routes>
  );
}
