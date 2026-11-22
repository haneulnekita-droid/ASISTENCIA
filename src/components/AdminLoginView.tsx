import { useState } from 'react';
import { motion } from 'motion/react';
import { signInWithPopup, signOut, type User } from 'firebase/auth';
import { AlertCircle, LogIn, LogOut, ShieldCheck } from 'lucide-react';
import { auth, googleProvider, PRIMARY_ADMIN_EMAIL } from '../firebase';
import { ImageWithFallback } from './ImageWithFallback';
import { CEREBRO_ESCENA_IMG, CEREBRO_ZEN_IMG } from './MascotGuide';

interface AdminLoginViewProps {
  currentUser: User | null;
  unauthorizedEmail: string | null;
}

export function AdminLoginView({ currentUser, unauthorizedEmail }: AdminLoginViewProps) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unauthorizedDomainHost, setUnauthorizedDomainHost] = useState<string | null>(null);

  const handleGoogleSignIn = async () => {
    setError(null);
    setUnauthorizedDomainHost(null);
    setSubmitting(true);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      const code = (err as { code?: string })?.code || '';
      if (code === 'auth/popup-closed-by-user') {
        setError('Cerraste la ventana de Google antes de completar el ingreso. Intenta de nuevo.');
      } else if (code === 'auth/popup-blocked') {
        setError(
          'Tu navegador bloqueó la ventana emergente de Google. Permite las ventanas emergentes para este sitio e intenta nuevamente.'
        );
      } else if (code === 'auth/unauthorized-domain') {
        const host = typeof window !== 'undefined' ? window.location.hostname : '';
        setUnauthorizedDomainHost(host);
        setError(
          `Este dominio (${host}) aún no está autorizado en Firebase Authentication. Agrégalo en Firebase Console → Authentication → Settings → Authorized domains.`
        );
      } else {
        setError('No se pudo iniciar sesión con Google. Verifica tu conexión e intenta nuevamente.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleSwitchAccount = async () => {
    setError(null);
    await signOut(auth);
    await handleGoogleSignIn();
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
                    <p className="text-xs font-bold text-[#FDE68A]">Sincronizado en tiempo real</p>
                    <p className="text-sm font-bold text-white">Acceso desde cualquier dispositivo</p>
                  </div>
                </div>
                <p className="text-xs text-[#EDE8FF] leading-relaxed">
                  Al ingresar con tu cuenta de Google autorizada verás en vivo todas las asistencias enviadas desde cualquier celular, sin importar el dispositivo desde donde abras el panel.
                </p>
              </div>
            </div>

            <div className="lg:col-span-6 p-6 sm:p-10 flex flex-col justify-center space-y-6">
              <div className="space-y-2">
                <div className="inline-flex items-center gap-2 text-xs font-semibold text-[#5B3FD9]">
                  <ShieldCheck className="w-4 h-4" />
                  <span>Panel privado para facilitadoras</span>
                </div>
                <h1 className="text-2xl sm:text-3xl font-bold text-[#241B35] text-balance">
                  Ingresa con 1 clic con Google
                </h1>
                <p className="text-sm text-[#5A4E73] leading-relaxed">
                  Sin contraseñas que recordar ni bloqueos entre dispositivos. Inicia sesión con tu cuenta autorizada (<span className="font-mono text-xs font-semibold text-[#3E2A8A]">{PRIMARY_ADMIN_EMAIL}</span>) para abrir el Panel y el Historial desde cualquier celular o computadora.
                </p>
              </div>

              {currentUser && unauthorizedEmail && (
                <div className="p-4 rounded-2xl bg-[#FFFBEB] border-2 border-[#F5E0A3] text-[#6B4A00] text-xs space-y-2">
                  <div className="flex items-start gap-2 font-bold text-sm">
                    <AlertCircle className="w-4 h-4 text-[#B47B00] shrink-0 mt-0.5" />
                    <span>Cuenta sin permisos de facilitadora</span>
                  </div>
                  <p>
                    Iniciaste sesión como <span className="font-mono font-semibold">{unauthorizedEmail}</span>. Por privacidad de los estudiantes, solo la cuenta autorizada (<span className="font-mono">{PRIMARY_ADMIN_EMAIL}</span>) o co-facilitadoras agregadas pueden ver el Panel y el Historial.
                  </p>
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={() => void handleSwitchAccount()}
                    className="min-h-[40px] px-4 py-2 rounded-xl bg-[#5B3FD9] text-white font-semibold inline-flex items-center gap-2 cursor-pointer"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Cambiar de cuenta de Google</span>
                  </button>
                </div>
              )}

              {error && (
                <div className="p-4 rounded-2xl bg-[#FEF2F2] border border-[#FECACA] text-[#991B1B] text-sm space-y-2">
                  <p>{error}</p>
                  {unauthorizedDomainHost && (
                    <p className="text-xs font-mono bg-white/80 p-2 rounded-lg border border-[#FECACA]">
                      Dominio a agregar: {unauthorizedDomainHost}
                    </p>
                  )}
                </div>
              )}

              <div className="space-y-3">
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => void handleGoogleSignIn()}
                  className="w-full min-h-[54px] px-6 py-3.5 rounded-2xl bg-gradient-to-r from-[#5B3FD9] to-[#6D4AFF] hover:from-[#4C31C7] hover:to-[#4C31C7] disabled:opacity-60 text-white font-bold text-sm shadow-[0_12px_24px_-8px_rgba(91,63,217,0.48)] inline-flex items-center justify-center gap-2.5 transition-all cursor-pointer"
                >
                  <LogIn className="w-5 h-5" />
                  <span>
                    {submitting
                      ? 'Conectando con Google...'
                      : 'Ingresar con Google (Panel e Historial)'}
                  </span>
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
