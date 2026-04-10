import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useState, useEffect } from 'react';
import api from '../api/client';
import { canAccessSection } from '../utils/permissions';
import {
  LayoutDashboard, Package, CheckSquare,
  Archive, DollarSign, LogOut, X, Circle, WalletCards, Route, TimerReset, CheckCircle2, Coffee, Store, StickyNote, Zap, BriefcaseBusiness, Users, Cloud, Search, Palette
} from 'lucide-react';

const nav = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard', end: true, section: 'dashboard' },
  { to: '/direccion', icon: BriefcaseBusiness, label: 'Direccion', section: 'direccion' },
  { to: '/buscador', icon: Search, label: 'Buscador', section: 'buscador' },
  { to: '/design-ia', icon: Palette, label: 'Design IA', section: 'designia' },
  { to: '/clientes', icon: Users, label: 'Clientes', section: 'clientes' },
  { to: '/factusol', icon: Cloud, label: 'Factusol', section: 'factusol' },
  { to: '/pedidos', icon: Package, label: 'Pedidos', section: 'pedidos' },
  { to: '/tareas', icon: CheckSquare, label: 'Tareas', section: 'tareas' },
  { to: '/rutas', icon: Route, label: 'Rutas', section: 'rutas' },
  { to: '/notas', icon: StickyNote, label: 'Notas', section: 'notas' },
  { to: '/stock', icon: Archive, label: 'Stock', section: 'stock' },
  { to: '/prestashop', icon: Store, label: 'PrestaShop', section: 'prestashop' },
  { to: '/caja', icon: DollarSign, label: 'Caja', section: 'caja' },
  { to: '/salidas', icon: WalletCards, label: 'Salidas', section: 'salidas' },
  { to: '/fichajes', icon: TimerReset, label: 'Fichajes', section: 'fichajes' },
];

const rolColors = { admin: 'bg-yellow-500', encargado: 'bg-blue-500', empleado: 'bg-slate-500' };

export default function Sidebar({ onClose }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [online, setOnline] = useState([]);

  useEffect(() => {
    function fetchOnline() {
      api.get('/auth/online').then(r => setOnline(r.data)).catch(() => {});
    }
    fetchOnline();
    const t = setInterval(fetchOnline, 30000);
    return () => clearInterval(t);
  }, []);

  function handleLogout() {
    logout();
    navigate('/login');
  }

  const visibleNav = nav.filter((item) => canAccessSection(user, item.section));

  return (
    <div className="w-64 h-full bg-slate-950 flex flex-col">
      {/* Logo */}
      <div className="flex items-center justify-between px-5 py-5 border-b border-slate-700">
        <div className="flex items-center gap-2">
          <Zap size={20} className="text-atomx-500" />
          <span className="text-white font-bold text-lg tracking-wider">ATOM X OPS</span>
        </div>
        <button onClick={onClose} className="lg:hidden text-slate-400 hover:text-white">
          <X size={18} />
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {visibleNav.map(({ to, icon: Icon, label, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            onClick={onClose}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-white text-slate-950'
                  : 'text-slate-400 hover:text-white hover:bg-slate-900'
              }`
            }
          >
            <Icon size={18} />
            {label}
          </NavLink>
        ))}
      </nav>

      {/* Quién está online */}
      {online.length > 0 && (
        <div className="px-4 pb-2">
          <p className="text-xs text-slate-500 mb-1.5 uppercase tracking-wide">Conectados ahora</p>
          <div className="space-y-1">
            {online.map(u => (
              <div key={u.id} className="flex items-center gap-2">
                {u.fichaje_estado === 'pausa' ? (
                  <Coffee size={12} className="text-amber-400 flex-shrink-0" />
                ) : u.fichaje_estado === 'trabajando' ? (
                  <CheckCircle2 size={12} className="text-green-400 flex-shrink-0" />
                ) : (
                  <Circle size={7} className="text-green-400 fill-green-400 flex-shrink-0" />
                )}
                <span className="text-slate-300 text-xs">{u.nombre}</span>
                {u.fichaje_estado === 'trabajando' ? <span className="text-[10px] text-green-400">trabajando</span> : null}
                {u.fichaje_estado === 'pausa' ? <span className="text-[10px] text-amber-400">pausa</span> : null}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* User */}
      <div className="px-3 py-4 border-t border-slate-700">
        <div className="flex items-center gap-3 px-3 py-2 rounded-lg">
          <div className="w-8 h-8 rounded-full bg-atomx-500 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
            {user?.nombre?.[0]?.toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white text-sm font-medium truncate">{user?.nombre}</p>
            <span className={`text-xs px-1.5 py-0.5 rounded text-white ${rolColors[user?.rol] || 'bg-slate-500'}`}>
              {user?.rol}
            </span>
          </div>
          <button onClick={handleLogout} className="text-slate-400 hover:text-red-400 transition-colors">
            <LogOut size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
