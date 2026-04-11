import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import ErrorOverlay from './components/ErrorOverlay';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Pedidos from './pages/Pedidos';
import Tareas from './pages/Tareas';
import Notas from './pages/Notas';
import Stock from './pages/Stock';
import Prestashop from './pages/Prestashop';
import Caja from './pages/Caja';
import Salidas from './pages/Salidas';
import Rutas from './pages/Rutas';
import Fichajes from './pages/Fichajes';
import Direccion from './pages/Direccion';
import Clientes from './pages/Clientes';
import Factusol from './pages/Factusol';
import Buscador from './pages/Buscador';
import DesignIA from './pages/DesignIA';
import StencilTool from './pages/StencilTool';
import { canAccessSection } from './utils/permissions';

function PrivateRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900">
      <div className="text-white text-lg">Cargando...</div>
    </div>
  );
  return user ? children : <Navigate to="/login" replace />;
}

function PublicRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  return user ? <Navigate to="/" replace /> : children;
}

function SectionRoute({ section, children }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  return canAccessSection(user, section) ? children : <Navigate to="/" replace />;
}

export default function App() {
  return (
    <AuthProvider>
      <ErrorOverlay />
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
          <Route path="/" element={<PrivateRoute><Layout /></PrivateRoute>}>
            <Route index element={<SectionRoute section="dashboard"><Dashboard /></SectionRoute>} />
            <Route path="dashboard" element={<SectionRoute section="dashboard"><Dashboard /></SectionRoute>} />
            <Route path="pedidos" element={<SectionRoute section="pedidos"><Pedidos /></SectionRoute>} />
            <Route path="tareas" element={<SectionRoute section="tareas"><Tareas /></SectionRoute>} />
            <Route path="notas" element={<SectionRoute section="notas"><Notas /></SectionRoute>} />
            <Route path="stock" element={<SectionRoute section="stock"><Stock /></SectionRoute>} />
            <Route path="prestashop" element={<SectionRoute section="prestashop"><Prestashop /></SectionRoute>} />
            <Route path="caja" element={<SectionRoute section="caja"><Caja /></SectionRoute>} />
            <Route path="salidas" element={<SectionRoute section="salidas"><Salidas /></SectionRoute>} />
            <Route path="rutas" element={<SectionRoute section="rutas"><Rutas /></SectionRoute>} />
            <Route path="fichajes" element={<SectionRoute section="fichajes"><Fichajes /></SectionRoute>} />
            <Route path="direccion" element={<SectionRoute section="direccion"><Direccion /></SectionRoute>} />
            <Route path="buscador" element={<SectionRoute section="buscador"><Buscador /></SectionRoute>} />
            <Route path="design-ia" element={<SectionRoute section="designia"><DesignIA /></SectionRoute>} />
            <Route path="stencil" element={<SectionRoute section="stencil"><StencilTool /></SectionRoute>} />
            <Route path="clientes" element={<SectionRoute section="clientes"><Clientes /></SectionRoute>} />
            <Route path="factusol" element={<SectionRoute section="factusol"><Factusol /></SectionRoute>} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
