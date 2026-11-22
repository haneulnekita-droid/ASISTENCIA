import { useState, type FormEvent } from 'react';
import { motion } from 'motion/react';
import { Eye, EyeOff, KeyRound, ShieldCheck } from 'lucide-react';
import { loginAdmin, setupFirstRunAdmin } from '../api';
import type { AuthStatusResponse } from '../types';
import { ImageWithFallback } from './ImageWithFallback';
import { CEREBRO_ESCENA_IMG, CEREBRO_ZEN_IMG } from './MascotGuide';

interface AdminLoginViewProps {
  authStatus: AuthStatusResponse;
  onAuthenticated: (token: string, username: string) => void;
}

export function AdminLoginView({ authStatus, onAuthenticated }: AdminLoginViewProps) {
  const isSetupMode = !authStatus.initialized;
  const [username, setUsername] = useState(authStatus.usernameHint || 'facilitadora');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (username.trim().length < 3) {
      setError('Ingresa un nombre de usuario válido (mínimo 3 caracteres).');
      return;
    }

    if (isSetupMode) {
      if (password.length < 6) {
        setError('La contraseña debe tener al menos 6 caracteres.');
        return;
      }
      if (password !== confirmPassword) {
        setError('Las contraseñas no coinciden.');
        return;
      }
      setSubmitting(true);
      try {
        const res = await setupFirstRunAdmin(username.trim(), password);
        onAuthenticated(res.token, res.username);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'No se pudo completar el registro inicial.');
      } finally {
        setSubmitting(false);
      }
      return;
    }

    if (!password) {
      setError('Ingresa tu contraseña.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await loginAdmin(username.trim(), password);
      onAuthenticated(res.token, res.username);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Usuario o contraseña incorrectos.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-[#EDE4FF] via-[#FAF8F5] to-[#E6FAF0] py-8 sm:py-12 min-h-[calc(100vh-8rem)]">
      <div className="max-w-5xl mx-auto px-4 sm:px-6">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="bg-white rounded-[2rem] border-2 border-[#DECFFA] overflow-hidden shadow-[0_18px_40px_-14px_rgba(91,63,217,0.2)]"
        >
          <div className="h-2.5 w-full bg-gradient-to-r from-[#6D4AFF] via-[#FBBF24] to-[#10B981]" />

          <div className="grid grid-cols-1 lg:grid-cols-12 items-stretch">
            <div className="lg:col-span-6 bg-gradient-to-br from-[#522FD6] via-[#6B46EC] to-[#8762FA] text-white flex flex-col justify-between">
              <div className="aspect-[16/10] lg:aspect-auto lg:flex-1 overflow-hidden bg-[#FAF6FE]">
                <ImageWithFallback
                  src={CEREBRO_ESCENA_IMG}
                  alt="Escena de bienestar de Cerebrín para el equipo de facilitadoras"
                  className="w-full h-full object-cover"
                  fallbackTitle="Panel de Facilitadoras"
                />
              </div>
              <div className="p-6 space-y-2">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-xl overflow-hidden border-2 border-[#8FE0BA] bg-[#E8FBF1] shrink-0">
                    <ImageWithFallback
                      src={CEREBRO_ZEN_IMG}
                      alt="Cerebrín Zen"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-[#FDE68A]">Privacidad y protección</p>
                    <p className="text-sm font-bold text-white">Espacio exclusivo para facilitadoras</p>
                  </div>
                </div>
                <p className="text-xs text-[#EDE8FF] leading-relaxed">
                  Aquí podrás revisar el pulso emocional del semestre, consultar asistencias por fecha y descargar los reportes en Excel.
                </p>
              </div>
            </div>

            <div className="lg:col-span-6 p-6 sm:p-10 flex flex-col justify-center">
              <div className="space-y-2 mb-6">
                <div className="inline-flex items-center gap-2 text-xs font-semibold text-[#5B3FD9]">
                  {isSetupMode ? <KeyRound className="w-4 h-4" /> : <ShieldCheck className="w-4 h-4" />}
                  <span>
                    {isSetupMode
                      ? 'Configuración inicial de acceso privado'
                      : 'Acceso privado para facilitadoras'}
                  </span>
                </div>
                <h1 className="text-2xl sm:text-3xl font-bold text-[#241B35] text-balance">
                  {isSetupMode ? 'Crea la clave de facilitadora' : 'Inicia sesión en el panel'}
                </h1>
                <p className="text-sm text-[#5A4E73] leading-relaxed">
                  {isSetupMode
                    ? 'Es el primer uso del panel. Define el usuario y contraseña que usarán las facilitadoras para consultar asistencias y descargar el Excel.'
                    : 'Ingresa tus credenciales para ver estadísticas, pulso del semestre y descargar los registros en Excel.'}
                </p>
              </div>

              {error && (
                <div className="mb-5 p-4 rounded-2xl bg-[#FEF2F2] border border-[#FECACA] text-[#991B1B] text-sm">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label htmlFor="admin-user" className="block text-sm font-semibold text-[#241B35] mb-1.5">
                    Usuario
                  </label>
                  <input
                    id="admin-user"
                    type="text"
                    autoComplete="username"
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full min-h-[48px] px-4 py-2.5 rounded-xl bg-[#F8F5FF] border border-[#D4C7F2] text-[#241B35] focus:outline-none focus:ring-2 focus:ring-[#5B3FD9]"
                  />
                </div>

                <div>
                  <label htmlFor="admin-pass" className="block text-sm font-semibold text-[#241B35] mb-1.5">
                    Contraseña
                  </label>
                  <div className="relative">
                    <input
                      id="admin-pass"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete={isSetupMode ? 'new-password' : 'current-password'}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full min-h-[48px] pl-4 pr-12 py-2.5 rounded-xl bg-[#F8F5FF] border border-[#D4C7F2] text-[#241B35] focus:outline-none focus:ring-2 focus:ring-[#5B3FD9]"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((prev) => !prev)}
                      aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                      className="absolute right-2 top-1/2 -translate-y-1/2 min-w-[40px] min-h-[40px] flex items-center justify-center text-[#6B5F84] hover:text-[#241B35] cursor-pointer"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {isSetupMode && (
                  <div>
                    <label
                      htmlFor="admin-pass-confirm"
                      className="block text-sm font-semibold text-[#241B35] mb-1.5"
                    >
                      Confirmar contraseña
                    </label>
                    <input
                      id="admin-pass-confirm"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="new-password"
                      required
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="w-full min-h-[48px] px-4 py-2.5 rounded-xl bg-[#F8F5FF] border border-[#D4C7F2] text-[#241B35] focus:outline-none focus:ring-2 focus:ring-[#5B3FD9]"
                    />
                  </div>
                )}

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full min-h-[52px] mt-2 px-6 py-3 rounded-2xl bg-gradient-to-r from-[#5B3FD9] to-[#6D4AFF] hover:from-[#4C31C7] hover:to-[#4C31C7] disabled:opacity-60 text-white font-bold text-sm shadow-[0_10px_22px_-8px_rgba(91,63,217,0.45)] transition-all cursor-pointer"
                >
                  {submitting
                    ? 'Verificando...'
                    : isSetupMode
                      ? 'Guardar acceso y entrar al panel'
                      : 'Ingresar al panel administrativo'}
                </button>
              </form>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
