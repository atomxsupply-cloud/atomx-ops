import { NavLink } from 'react-router-dom';
import { Archive, BriefcaseBusiness, CheckSquare, Cloud, DollarSign, LayoutDashboard, Package, Palette, Route, Search, StickyNote, Store, TimerReset, Users, WalletCards } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { canAccessSection } from '../utils/permissions';

const items = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true, section: 'dashboard' },
  { to: '/direccion', label: 'Direccion', icon: BriefcaseBusiness, section: 'direccion' },
  { to: '/buscador', label: 'Buscador', icon: Search, section: 'buscador' },
  { to: '/design-ia', label: 'Design IA', icon: Palette, section: 'designia' },
  { to: '/clientes', label: 'Clientes', icon: Users, section: 'clientes' },
  { to: '/factusol', label: 'Factusol', icon: Cloud, section: 'factusol' },
  { to: '/pedidos', label: 'Pedidos', icon: Package, section: 'pedidos' },
  { to: '/tareas', label: 'Tareas', icon: CheckSquare, section: 'tareas' },
  { to: '/rutas', label: 'Rutas', icon: Route, section: 'rutas' },
  { to: '/notas', label: 'Notas', icon: StickyNote, section: 'notas' },
  { to: '/stock', label: 'Stock', icon: Archive, section: 'stock' },
  { to: '/prestashop', label: 'PrestaShop', icon: Store, section: 'prestashop' },
  { to: '/caja', label: 'Caja', icon: DollarSign, section: 'caja' },
  { to: '/salidas', label: 'Salidas', icon: WalletCards, section: 'salidas' },
  { to: '/fichajes', label: 'Fichajes', icon: TimerReset, section: 'fichajes' },
];

export default function TopNavTabs() {
  const { user } = useAuth();
  const visibleItems = items.filter((item) => canAccessSection(user, item.section));
  return (
    <div className="hidden overflow-x-auto pb-1 lg:block">
      <div className="flex gap-2 min-w-max">
        {visibleItems.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `inline-flex items-center gap-2 rounded-2xl px-4 py-2 text-sm font-medium border transition-colors ${
                isActive
                  ? 'bg-slate-900 text-white border-slate-900'
                  : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300 hover:text-slate-800'
              }`
            }
          >
            <Icon size={15} />
            {label}
          </NavLink>
        ))}
      </div>
    </div>
  );
}
