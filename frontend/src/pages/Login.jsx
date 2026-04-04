import { useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, KeyRound, LockKeyhole, ShieldCheck, Zap } from 'lucide-react';

const CORE_USERS = [
  { nombre: 'Juanfran', email: 'juanfran@atomx.com', color: 'from-blue-600 to-cyan-700', desc: 'Analiza y decide', group: 'top', pin: '2571' },
  { nombre: 'Juanje', email: 'juanje@atomx.com', color: 'from-emerald-600 to-green-700', desc: 'Tienda / Facturacion', group: 'core' },
  { nombre: 'Papi', email: 'papi@atomx.com', color: 'from-orange-500 to-amber-600', desc: 'Tienda / Reparto', group: 'core' },
  { nombre: 'Lida', email: 'lida@atomx.com', color: 'from-fuchsia-600 to-pink-700', desc: 'Mallorca', group: 'core' },
];

const INDEPENDENT_USERS = [
  { nombre: 'Maria', email: 'maria@atomx.com', color: 'from-rose-500 to-pink-600', desc: 'Comercial', group: 'independent' },
  { nombre: 'Andrea', email: 'andrea@atomx.com', color: 'from-violet-500 to-purple-600', desc: 'Apoyo / Comercial', group: 'independent' },
];

const GATE_KEY = 'atomx_gate_passed';

function UserCard({ user, active, onClick, loading }) {
  return (
    <button
      onClick={() => onClick(user)}
      disabled={!!loading}
      className={`w-full rounded-2xl border p-3 text-left transition-all ${active ? 'border-atomx-400 shadow-lg shadow-atomx-500/15 scale-[1.01]' : 'border-white/10 hover:border-white/20'} bg-gradient-to-r ${user.color}`}
    >
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-2xl bg-white/15 flex items-center justify-center text-white text-sm font-bold">
          {user.nombre.charAt(0)}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-white font-bold text-sm">{user.nombre}</p>
          <p className="text-white/75 text-xs">{user.desc}</p>
        </div>
        {loading === user.nombre ? <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> : null}
      </div>
    </button>
  );
}

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(null);
  const [error, setError] = useState('');
  const [respuesta, setRespuesta] = useState('');
  const [gateOpen, setGateOpen] = useState(() => localStorage.getItem(GATE_KEY) === '1');
  const [selectedUser, setSelectedUser] = useState(null);
  const [pin, setPin] = useState('');

  const allUsers = useMemo(() => [...CORE_USERS, ...INDEPENDENT_USERS], []);

  async function elegir(usuario) {
    if (usuario.pin) {
      setSelectedUser(usuario);
      setPin('');
      setError('');
      return;
    }

    setLoading(usuario.nombre);
    setError('');
    try {
      await login(usuario.email, 'atomx2024');
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Error al entrar');
    } finally {
      setLoading(null);
    }
  }

  async function entrarConPin(e) {
    e.preventDefault();
    if (!selectedUser) return;
    if (pin.trim() !== selectedUser.pin) {
      setError('El PIN de Juanfran no es correcto.');
      return;
    }

    setLoading(selectedUser.nombre);
    setError('');
    try {
      await login(selectedUser.email, 'atomx2024');
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Error al entrar');
    } finally {
      setLoading(null);
    }
  }

  function desbloquear(e) {
    e.preventDefault();
    if (respuesta.trim().toLowerCase() !== 'sky') {
      setError('La respuesta no es correcta.');
      return;
    }

    localStorage.setItem(GATE_KEY, '1');
    setGateOpen(true);
    setError('');
  }

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4 py-6">
      <div className="w-full max-w-4xl">
        {!gateOpen ? (
          <div className="mx-auto max-w-md bg-slate-950 border border-slate-800 rounded-3xl p-6 shadow-2xl">
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-14 h-14 bg-atomx-500 rounded-2xl mb-4">
                <LockKeyhole size={26} className="text-white" />
              </div>
              <h1 className="text-white text-2xl font-bold tracking-wide">Acceso ATOM X OPS</h1>
              <p className="text-slate-400 text-sm mt-2">Antes de entrar, contesta la pregunta del equipo.</p>
            </div>

            <form onSubmit={desbloquear} className="space-y-4">
              <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4">
                <div className="flex items-center gap-2 mb-2 text-atomx-400">
                  <ShieldCheck size={16} />
                  <span className="text-xs uppercase tracking-[0.2em]">Pregunta</span>
                </div>
                <p className="text-white text-base font-semibold">Como se llama la perra de Juanfran?</p>
              </div>

              <input
                id="gate-answer"
                name="gate_answer"
                type="text"
                value={respuesta}
                onChange={(e) => setRespuesta(e.target.value)}
                autoComplete="off"
                className="w-full rounded-2xl border border-slate-700 bg-slate-900 px-4 py-3 text-white outline-none focus:border-atomx-500"
                placeholder="Escribe la respuesta"
              />

              <button
                type="submit"
                className="w-full rounded-2xl bg-atomx-500 hover:bg-atomx-600 text-white font-semibold px-4 py-3 flex items-center justify-center gap-2 transition-colors"
              >
                Entrar
                <ArrowRight size={16} />
              </button>
            </form>
          </div>
        ) : (
          <div className="space-y-5">
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-14 h-14 bg-atomx-500 rounded-2xl mb-4">
                <Zap size={28} className="text-white" />
              </div>
              <h1 className="text-white text-2xl font-bold tracking-wide">Elige tu usuario</h1>
              <p className="text-slate-400 text-sm mt-1">Entra con tu perfil y sigue currando.</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-[1.1fr,1fr] gap-4">
              <div className="rounded-3xl border border-slate-800 bg-slate-950/80 p-4">
                <p className="text-[11px] uppercase tracking-[0.24em] text-slate-500 mb-3 text-center">Cuenta principal</p>
                <UserCard user={CORE_USERS[0]} active={selectedUser?.nombre === 'Juanfran'} onClick={elegir} loading={loading} />

                {selectedUser?.nombre === 'Juanfran' && (
                  <form onSubmit={entrarConPin} className="mt-3 rounded-2xl border border-slate-800 bg-slate-900/70 p-3 space-y-3">
                    <div className="flex items-center gap-2 text-slate-300 text-sm">
                      <KeyRound size={15} className="text-amber-400" />
                      PIN de Juanfran
                    </div>
                    <input
                      value={pin}
                      onChange={(e) => setPin(e.target.value)}
                      type="password"
                      inputMode="numeric"
                      maxLength={4}
                      className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none focus:border-atomx-500"
                      placeholder="••••"
                    />
                    <button type="submit" className="w-full rounded-2xl bg-white text-slate-950 font-semibold px-4 py-3">
                      Entrar como Juanfran
                    </button>
                  </form>
                )}
              </div>

              <div className="rounded-3xl border border-slate-800 bg-slate-950/80 p-4">
                <p className="text-[11px] uppercase tracking-[0.24em] text-slate-500 mb-3 text-center">Esenciales</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {CORE_USERS.slice(1).map((user) => (
                    <UserCard key={user.nombre} user={user} active={false} onClick={elegir} loading={loading} />
                  ))}
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-slate-800 bg-slate-950/80 p-4">
              <p className="text-[11px] uppercase tracking-[0.24em] text-slate-500 mb-3 text-center">Independientes</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {INDEPENDENT_USERS.map((user) => (
                  <UserCard key={user.nombre} user={user} active={false} onClick={elegir} loading={loading} />
                ))}
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="mt-4 mx-auto max-w-lg bg-red-500/20 border border-red-500/40 rounded-xl px-4 py-3 text-red-300 text-sm text-center">
            {error}
          </div>
        )}
      </div>
    </div>
  );
}
