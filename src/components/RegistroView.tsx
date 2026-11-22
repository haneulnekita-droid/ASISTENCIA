import { useEffect, useState, type FormEvent } from 'react';
import { motion } from 'motion/react';
import {
  AlertTriangle,
  Backpack,
  BatteryLow,
  BookOpen,
  Calendar,
  CheckCircle2,
  Clock,
  Heart,
  Leaf,
  Lock,
  Smile,
  Sparkles,
  TrendingUp,
  UserCheck,
} from 'lucide-react';
import { ApiError, fetchPublicInfo, submitAttendance } from '../api';
import type { AttendanceRecord, PublicInfoResponse, PulseStats } from '../types';
import { ImageWithFallback } from './ImageWithFallback';
import {
  CEREBRO_ESCENA_IMG,
  CEREBRO_ESTRESADO_IMG,
  CEREBRO_ZEN_IMG,
  MascotCompanion,
} from './MascotGuide';

const SEMESTER_TREND_OPTIONS = [
  {
    id: 'subioMucho',
    label: 'Subió como montaña rusa',
    hint: 'Se juntaron parciales, trabajos y prácticas',
    reaction: '¡Te entiendo totalmente! El V ciclo viene intenso, por eso hoy toca recargar herramientas.',
  },
  {
    id: 'porMomentos',
    label: 'Sube por ratos, pero lo manejo',
    hint: 'Hay semanas pesadas, pero aplico pausas',
    reaction: '¡Qué buen equilibrio! Reconocer cuándo parar ya es un gran avance.',
  },
  {
    id: 'masTranquilo',
    label: 'Más tranquilo que al inicio',
    hint: 'Las herramientas de bienestar sí ayudan',
    reaction: '¡Esooo! Qué alegría saber que lo aprendido te está ayudando este semestre.',
  },
] as const;

const MOCHILA_PESO_OPTIONS = [
  {
    id: 'examenesTrabajos',
    label: 'Exámenes y trabajos',
    icon: BookOpen,
  },
  {
    id: 'cansancioSueno',
    label: 'Falta de sueño / cansancio',
    icon: BatteryLow,
  },
  {
    id: 'practicasHorarios',
    label: 'Prácticas y horarios',
    icon: Clock,
  },
  {
    id: 'bajoControl',
    label: '¡Hoy vengo ligero/a!',
    icon: Smile,
  },
] as const;

function formatLiveTimeFromOffset(offsetMs: number, timezone: string): {
  fechaLegible: string;
  hora: string;
} {
  const now = new Date(Date.now() + offsetMs);
  try {
    const timeParts = new Intl.DateTimeFormat('en-GB', {
      timeZone: timezone,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).formatToParts(now);

    const pick = (t: string) => timeParts.find((p) => p.type === t)?.value || '00';
    let hh = pick('hour');
    if (hh === '24') hh = '00';
    const hora = `${hh}:${pick('minute')}:${pick('second')}`;

    const fechaRaw = new Intl.DateTimeFormat('es-PE', {
      timeZone: timezone,
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(now);

    return {
      fechaLegible: fechaRaw.charAt(0).toUpperCase() + fechaRaw.slice(1),
      hora,
    };
  } catch {
    return {
      fechaLegible: now.toLocaleDateString('es-PE'),
      hora: now.toLocaleTimeString('es-PE', { hour12: false }),
    };
  }
}

export function RegistroView() {
  const [info, setInfo] = useState<PublicInfoResponse | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [clockOffsetMs, setClockOffsetMs] = useState<number>(0);
  const [displayClock, setDisplayClock] = useState<{ fechaLegible: string; hora: string }>({
    fechaLegible: 'Sincronizando...',
    hora: '--:--:--',
  });

  const [nombres, setNombres] = useState('');
  const [apellidos, setApellidos] = useState('');
  const [codigo, setCodigo] = useState('');
  const [semesterTrend, setSemesterTrend] = useState<string>('');
  const [mochilaPeso, setMochilaPeso] = useState<string>('');

  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [duplicateNotice, setDuplicateNotice] = useState<{
    message: string;
    hora: string;
    fecha: string;
    jornada: string;
  } | null>(null);
  const [savedRecord, setSavedRecord] = useState<AttendanceRecord | null>(null);
  const [successMessage, setSuccessMessage] = useState<string>('');
  const [groupPulse, setGroupPulse] = useState<PulseStats | null>(null);

  const loadInfo = async () => {
    try {
      setLoadError(null);
      const data = await fetchPublicInfo();
      setInfo(data);
      const serverMs = new Date(data.clock.iso).getTime();
      const offset = Number.isFinite(serverMs) ? serverMs - Date.now() : 0;
      setClockOffsetMs(offset);
      setDisplayClock({
        fechaLegible: data.clock.fechaLegible,
        hora: data.clock.hora,
      });
    } catch {
      setLoadError(
        'No se pudo conectar con el servidor de asistencia. Verifica tu conexión e intenta de nuevo.'
      );
    }
  };

  useEffect(() => {
    void loadInfo();
  }, []);

  useEffect(() => {
    if (!info) return;
    const tz = info.clock.timezone || 'America/Lima';
    const interval = setInterval(() => {
      setDisplayClock(formatLiveTimeFromOffset(clockOffsetMs, tz));
    }, 1000);
    return () => clearInterval(interval);
  }, [info, clockOffsetMs]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setDuplicateNotice(null);

    if (nombres.trim().length < 2) {
      setFormError('Por favor escribe tus nombres completos.');
      return;
    }
    if (apellidos.trim().length < 2) {
      setFormError('Por favor escribe tus apellidos completos.');
      return;
    }
    if (codigo.trim().length < 1) {
      setFormError('Por favor ingresa tu código de estudiante o identificador.');
      return;
    }

    setSubmitting(true);
    try {
      const response = await submitAttendance({
        nombres: nombres.trim(),
        apellidos: apellidos.trim(),
        codigo: codigo.trim(),
        semesterTrend: semesterTrend || undefined,
        mochilaPeso: mochilaPeso || undefined,
      });
      setSavedRecord(response.record);
      setSuccessMessage(response.message);
      setGroupPulse(response.pulseStats || null);
      setNombres('');
      setApellidos('');
      setCodigo('');
      setSemesterTrend('');
      setMochilaPeso('');
    } catch (err) {
      if (err instanceof ApiError && err.status === 409 && err.payload?.duplicate) {
        setDuplicateNotice({
          message: err.message,
          hora: String(err.payload.existingHora || ''),
          fecha: String(err.payload.existingFecha || ''),
          jornada: String(err.payload.jornada || ''),
        });
      } else {
        setFormError(
          err instanceof Error ? err.message : 'Ocurrió un error al registrar tu asistencia.'
        );
      }
    } finally {
      setSubmitting(false);
    }
  };

  const resetForNext = () => {
    setSavedRecord(null);
    setSuccessMessage('');
    setGroupPulse(null);
    setFormError(null);
    setDuplicateNotice(null);
    void loadInfo();
  };

  const hasNombres = nombres.trim().length >= 2;
  const hasApellidos = apellidos.trim().length >= 2;
  const hasCodigo = codigo.trim().length >= 1;
  const formProgress =
    (hasNombres ? 33 : 0) + (hasApellidos ? 33 : 0) + (hasCodigo ? 34 : 0);

  const selectedTrendObj = SEMESTER_TREND_OPTIONS.find((o) => o.id === semesterTrend);
  const customReaction = selectedTrendObj ? selectedTrendObj.reaction : null;

  const totalTrendCount = groupPulse
    ? groupPulse.semesterTrend.subioMucho +
      groupPulse.semesterTrend.porMomentos +
      groupPulse.semesterTrend.masTranquilo
    : 0;
  const rollerPct =
    totalTrendCount > 0 && groupPulse
      ? Math.round(
          ((groupPulse.semesterTrend.subioMucho + groupPulse.semesterTrend.porMomentos) /
            totalTrendCount) *
            100
        )
      : null;

  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-[#EDE4FF] via-[#FAF8F5] to-[#E6FAF0] py-6 sm:py-10">
      {/* Atmospheric Glows */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-24 -left-24 w-[28rem] h-[28rem] rounded-full bg-[#C4B5FD]/45 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute top-32 -right-24 w-[28rem] h-[28rem] rounded-full bg-[#A7F3D0]/50 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute bottom-10 left-1/3 w-80 h-80 rounded-full bg-[#FDE68A]/45 blur-3xl"
      />

      <div className="relative max-w-6xl mx-auto px-4 sm:px-6 space-y-7">
        {/* Vibrant Color-Blocked Hero Showcase */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="rounded-[2rem] overflow-hidden border-2 border-[#CBB8FA] bg-gradient-to-br from-[#522FD6] via-[#6B46EC] to-[#8762FA] shadow-[0_18px_40px_-14px_rgba(82,47,214,0.42)] grid grid-cols-1 lg:grid-cols-12 items-stretch"
        >
          <div className="lg:col-span-6 p-6 sm:p-9 flex flex-col justify-center gap-4 text-white">
            <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-[#FDE68A]">
              <span>Mi Huella de Bienestar</span>
              <span aria-hidden="true">·</span>
              <span>V Ciclo de Trabajo Social</span>
            </div>

            <h1 className="text-2xl sm:text-4xl font-bold text-white leading-tight text-balance">
              ¡Bienvenido/a a nuestra jornada de evaluación!
            </h1>

            <p className="text-sm sm:text-base text-[#EDE8FF] leading-relaxed">
              Tu participación deja huella. Registra tu asistencia y acompáñanos en esta experiencia
            </p>

            <div className="pt-2 border-t border-white/20 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs font-medium text-[#F5F2FF]">
              <span className="inline-flex items-center gap-1.5">
                <Backpack className="w-4 h-4 text-[#FDE68A]" />
                De la mochila a las herramientas
              </span>
              <span aria-hidden="true">·</span>
              <span className="inline-flex items-center gap-1.5">
                <Leaf className="w-4 h-4 text-[#86EFAC]" />
                Evaluando lo aprendido
              </span>
              <span aria-hidden="true">·</span>
              <span className="inline-flex items-center gap-1.5">
                <Heart className="w-4 h-4 text-[#F9A8D4]" />
                Gestión del estrés
              </span>
            </div>
          </div>

          <div className="lg:col-span-6 bg-[#FAF6FE] min-h-[220px] lg:min-h-full overflow-hidden">
            <ImageWithFallback
              src={CEREBRO_ESCENA_IMG}
              alt="Transformación de un cerebro medio estresado con mochila pesada hacia un jardín luminoso de calma y herramientas de bienestar"
              className="w-full h-full object-cover"
              fallbackTitle="De la mochila a las herramientas"
            />
          </div>
        </motion.div>

        {/* Main 2-Column Workspace */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left Column: Interactive Stress Thermometer + Brain Facts */}
          <div className="lg:col-span-5 order-2 lg:order-1">
            <MascotCompanion
              formProgress={formProgress}
              isDuplicate={Boolean(duplicateNotice)}
              customReaction={customReaction}
            />
          </div>

          {/* Right Column: Registration Form (No #5 Jornada) + 2 Curious Questions */}
          <div className="lg:col-span-7 order-1 lg:order-2">
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: 0.05 }}
              className="bg-white rounded-[2rem] border-2 border-[#DECFFA] overflow-hidden shadow-[0_18px_40px_-14px_rgba(91,63,217,0.18)]"
            >
              <div className="h-2.5 w-full bg-gradient-to-r from-[#6D4AFF] via-[#FBBF24] to-[#10B981]" />

              <div className="p-6 sm:p-8">
                {savedRecord ? (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.96 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.35 }}
                    className="flex flex-col items-center text-center py-4 sm:py-6 gap-5 relative"
                  >
                    <div className="relative flex items-center justify-center">
                      <motion.span
                        animate={{ y: [-4, -14, -4], rotate: [-8, 8, -8] }}
                        transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
                        className="absolute -left-10 top-2 text-[#7C4DFF]"
                        aria-hidden="true"
                      >
                        <Heart className="w-6 h-6 fill-[#DDD1FF]" />
                      </motion.span>
                      <motion.span
                        animate={{ y: [-2, -12, -2], rotate: [8, -8, 8] }}
                        transition={{ duration: 2.8, repeat: Infinity, ease: 'easeInOut' }}
                        className="absolute -right-10 top-4 text-[#10B981]"
                        aria-hidden="true"
                      >
                        <Leaf className="w-6 h-6 fill-[#BBF7D0]" />
                      </motion.span>
                      <motion.span
                        animate={{ scale: [1, 1.2, 1] }}
                        transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                        className="absolute -right-6 bottom-2 text-[#F59E0B]"
                        aria-hidden="true"
                      >
                        <Sparkles className="w-5 h-5" />
                      </motion.span>

                      <motion.div
                        animate={{ y: [0, -7, 0] }}
                        transition={{ duration: 2.6, repeat: Infinity, ease: 'easeInOut' }}
                        className="w-40 h-40 rounded-3xl overflow-hidden border-2 border-[#8FE0BA] bg-[#E8FBF1] shadow-md"
                      >
                        <ImageWithFallback
                          src={CEREBRO_ZEN_IMG}
                          alt="Cerebrín feliz celebrando en su nube lavanda con audífonos y hojas de menta"
                          className="w-full h-full object-cover"
                        />
                      </motion.div>
                    </div>

                    <div className="max-w-lg space-y-2">
                      <div className="inline-flex items-center gap-2 text-sm font-bold text-[#0F7A53]">
                        <CheckCircle2 className="w-5 h-5" />
                        <span>Registro guardado en la base de datos Excel</span>
                      </div>
                      <h2 className="text-2xl sm:text-3xl font-bold text-[#241B35] text-balance">
                        {successMessage}
                      </h2>
                    </div>

                    {rollerPct !== null && (
                      <div className="w-full max-w-md rounded-2xl bg-[#F5F1FE] border border-[#DDD2FA] px-4 py-3 text-xs text-[#3C2B70]">
                        <span className="font-bold">Pulso del V ciclo hoy:</span> El{' '}
                        <span className="font-mono font-bold text-[#5B3FD9]">{rollerPct}%</span> de tus compañeros también sintió subidas de estrés este semestre. ¡Hoy soltamos la mochila juntos!
                      </div>
                    )}

                    <div className="w-full max-w-md bg-gradient-to-br from-[#F2FCF7] via-white to-[#F7F3FF] border-2 border-[#BFE8D4] rounded-2xl p-5 text-left space-y-3">
                      <div className="flex items-center justify-between gap-4 text-xs text-[#3C6252] border-b border-[#DCEEE5] pb-2.5">
                        <span className="font-semibold">Comprobante oficial</span>
                        <span className="font-mono font-bold text-[#0F7A53] tabular-nums">
                          {savedRecord.id}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div>
                          <p className="text-xs text-[#5E6E67]">Participante</p>
                          <p className="font-semibold text-[#1E2E27]">
                            {savedRecord.nombres} {savedRecord.apellidos}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-[#5E6E67]">Código</p>
                          <p className="font-mono font-semibold text-[#1E2E27] tabular-nums">
                            {savedRecord.codigo}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-[#5E6E67]">Fecha oficial</p>
                          <p className="font-mono font-medium text-[#1E2E27] tabular-nums">
                            {savedRecord.fecha}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-[#5E6E67]">Hora de ingreso</p>
                          <p className="font-mono font-medium text-[#1E2E27] tabular-nums">
                            {savedRecord.hora}
                          </p>
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={resetForNext}
                      className="px-6 py-3 min-h-[48px] rounded-xl bg-[#EFEAFD] text-[#3E2A8A] font-semibold text-sm hover:bg-[#E2D9FA] transition-colors cursor-pointer"
                    >
                      Registrar otra asistencia
                    </button>
                  </motion.div>
                ) : (
                  <div>
                    <div className="flex items-center justify-between gap-4 pb-4 mb-5 border-b border-[#EFE8FA]">
                      <div>
                        <h2 className="text-xl sm:text-2xl font-bold text-[#241B35]">
                          Registra tu huella de hoy
                        </h2>
                        <p className="text-xs sm:text-sm text-[#5A4E73] mt-0.5">
                          Completa tus datos y cuéntanos cómo viene tu semestre.
                        </p>
                      </div>
                      <div className="lg:hidden w-16 h-16 rounded-2xl overflow-hidden border-2 border-[#D9C7FC] bg-[#FFF8E6] shrink-0">
                        <ImageWithFallback
                          src={formProgress >= 80 ? CEREBRO_ZEN_IMG : CEREBRO_ESTRESADO_IMG}
                          alt="Cerebrín"
                          className="w-full h-full object-cover"
                        />
                      </div>
                    </div>

                    {/* Step Progress */}
                    <div className="mb-6 bg-[#F8F5FF] border border-[#E5DCFA] rounded-2xl p-3.5 space-y-2">
                      <div className="flex items-center justify-between text-xs font-semibold text-[#473380]">
                        <span>Progreso de tu registro</span>
                        <span className="font-mono tabular-nums text-[#5B3FD9]">
                          {formProgress}%
                        </span>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <div
                          className={`h-2 rounded-full transition-colors ${
                            hasNombres ? 'bg-[#10B981]' : 'bg-[#DFD4FA]'
                          }`}
                        />
                        <div
                          className={`h-2 rounded-full transition-colors ${
                            hasApellidos ? 'bg-[#10B981]' : 'bg-[#DFD4FA]'
                          }`}
                        />
                        <div
                          className={`h-2 rounded-full transition-colors ${
                            hasCodigo ? 'bg-[#10B981]' : 'bg-[#DFD4FA]'
                          }`}
                        />
                      </div>
                    </div>

                    {loadError && (
                      <div className="mb-5 p-4 rounded-2xl bg-[#FEF2F2] border border-[#FECACA] text-[#991B1B] text-sm flex items-start justify-between gap-3">
                        <span>{loadError}</span>
                        <button
                          type="button"
                          onClick={() => void loadInfo()}
                          className="text-xs font-semibold underline shrink-0 cursor-pointer"
                        >
                          Reintentar
                        </button>
                      </div>
                    )}

                    {duplicateNotice && (
                      <div className="mb-5 p-4 rounded-2xl bg-[#FEF9E7] border-2 border-[#F5D67B] text-[#6B4A00] text-sm flex items-start gap-3">
                        <AlertTriangle className="w-5 h-5 text-[#C2820A] shrink-0 mt-0.5" />
                        <div className="space-y-1">
                          <p className="font-bold">Registro ya existente</p>
                          <p>{duplicateNotice.message}</p>
                        </div>
                      </div>
                    )}

                    {formError && (
                      <div className="mb-5 p-4 rounded-2xl bg-[#FEF2F2] border border-[#FECACA] text-[#991B1B] text-sm">
                        {formError}
                      </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-5" noValidate>
                      {/* 1. Nombres y Apellidos */}
                      <div className="p-4 rounded-2xl bg-[#F8F5FF] border border-[#E5DCFA] space-y-2.5">
                        <span className="block text-sm font-bold text-[#241B35]">
                          1. Nombres y apellidos <span className="text-[#B42318]">*</span>
                        </span>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label htmlFor="nombres" className="block text-xs font-medium text-[#5A4E73] mb-1">
                              Nombres
                            </label>
                            <input
                              id="nombres"
                              name="nombres"
                              type="text"
                              required
                              autoComplete="given-name"
                              placeholder="Ej. María Fernanda"
                              value={nombres}
                              onChange={(e) => setNombres(e.target.value)}
                              className="w-full min-h-[48px] px-4 py-2.5 rounded-xl bg-white border border-[#D4C7F2] text-[#241B35] placeholder:text-[#968BAE] focus:outline-none focus:ring-2 focus:ring-[#5B3FD9] focus:border-transparent transition-shadow"
                            />
                          </div>
                          <div>
                            <label htmlFor="apellidos" className="block text-xs font-medium text-[#5A4E73] mb-1">
                              Apellidos
                            </label>
                            <input
                              id="apellidos"
                              name="apellidos"
                              type="text"
                              required
                              autoComplete="family-name"
                              placeholder="Ej. Quispe Mendoza"
                              value={apellidos}
                              onChange={(e) => setApellidos(e.target.value)}
                              className="w-full min-h-[48px] px-4 py-2.5 rounded-xl bg-white border border-[#D4C7F2] text-[#241B35] placeholder:text-[#968BAE] focus:outline-none focus:ring-2 focus:ring-[#5B3FD9] focus:border-transparent transition-shadow"
                            />
                          </div>
                        </div>
                      </div>

                      {/* 2. Código de estudiante */}
                      <div className="p-4 rounded-2xl bg-[#FFFBEB] border border-[#F5E0A3] space-y-1.5">
                        <label
                          htmlFor="codigo"
                          className="block text-sm font-bold text-[#241B35]"
                        >
                          2. Código de estudiante o identificador{' '}
                          <span className="text-[#B42318]">*</span>
                        </label>
                        <input
                          id="codigo"
                          name="codigo"
                          type="text"
                          required
                          placeholder="Ej. 202410458 o número de DNI"
                          value={codigo}
                          onChange={(e) => setCodigo(e.target.value)}
                          className="w-full min-h-[48px] px-4 py-2.5 rounded-xl bg-white border border-[#EAD085] text-[#241B35] font-mono placeholder:font-sans placeholder:text-[#968BAE] focus:outline-none focus:ring-2 focus:ring-[#5B3FD9] focus:border-transparent transition-shadow"
                        />
                      </div>

                      {/* 3 & 4. Fecha y Hora automáticas del servidor */}
                      <div className="p-4 rounded-2xl bg-[#EEFBF4] border border-[#CBEEDF] space-y-2.5">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="flex items-center gap-1.5 text-sm font-bold text-[#155E43] mb-1.5">
                              <Calendar className="w-4 h-4 text-[#0D9464]" />
                              <span>3. Fecha de asistencia</span>
                            </label>
                            <div className="min-h-[46px] px-4 py-2.5 rounded-xl bg-white border border-[#BFE8D4] text-[#1E3B2F] text-sm flex items-center justify-between gap-2 select-none">
                              <span className="truncate font-medium">{displayClock.fechaLegible}</span>
                              <Lock className="w-3.5 h-3.5 text-[#3B8265] shrink-0" aria-label="Automático" />
                            </div>
                          </div>

                          <div>
                            <label className="flex items-center gap-1.5 text-sm font-bold text-[#155E43] mb-1.5">
                              <Clock className="w-4 h-4 text-[#0D9464]" />
                              <span>4. Hora de registro</span>
                            </label>
                            <div className="min-h-[46px] px-4 py-2.5 rounded-xl bg-white border border-[#BFE8D4] text-[#1E3B2F] text-sm font-mono font-semibold tabular-nums flex items-center justify-between gap-2 select-none">
                              <span>{displayClock.hora}</span>
                              <Lock className="w-3.5 h-3.5 text-[#3B8265] shrink-0" aria-label="Automático" />
                            </div>
                          </div>
                        </div>
                        <p className="text-xs text-[#286B51]">
                          Fecha y hora sincronizadas automáticamente con el servidor (no modificables).
                        </p>
                      </div>

                      {/* 2 Preguntas Curiosas Anónimas para evaluar cómo están hoy y en el semestre */}
                      <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-[#FAF5FF] via-[#FFFDF5] to-[#F3FBF7] border-2 border-[#E2D6FA] space-y-4">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-bold text-[#35236B] flex items-center gap-1.5">
                            <TrendingUp className="w-4 h-4 text-[#6D4AFF]" />
                            Pulso rápido del semestre (opcional y anónimo)
                          </span>
                        </div>

                        {/* Pregunta curiosa 1 */}
                        <div className="space-y-2">
                          <p className="text-xs font-bold text-[#241B35]">
                            ¿Sientes que tu estrés incrementó conforme avanza este semestre?
                          </p>
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                            {SEMESTER_TREND_OPTIONS.map((opt) => {
                              const active = semesterTrend === opt.id;
                              return (
                                <button
                                  key={opt.id}
                                  type="button"
                                  onClick={() =>
                                    setSemesterTrend((prev) => (prev === opt.id ? '' : opt.id))
                                  }
                                  className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                                    active
                                      ? 'bg-[#5B3FD9] text-white border-[#5B3FD9] shadow-sm'
                                      : 'bg-white text-[#241B35] border-[#DCD2F4] hover:bg-[#F5F1FE]'
                                  }`}
                                >
                                  <p className="text-xs font-bold leading-snug">{opt.label}</p>
                                  <p
                                    className={`text-[11px] mt-1 leading-tight ${
                                      active ? 'text-[#E8E1FF]' : 'text-[#6B5F84]'
                                    }`}
                                  >
                                    {opt.hint}
                                  </p>
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        {/* Pregunta curiosa 2 */}
                        <div className="space-y-2 pt-2 border-t border-[#ECE4FA]">
                          <p className="text-xs font-bold text-[#241B35]">
                            ¿Qué pesa más en tu mochila emocional hoy?
                          </p>
                          <div className="grid grid-cols-2 gap-2">
                            {MOCHILA_PESO_OPTIONS.map((opt) => {
                              const Icon = opt.icon;
                              const active = mochilaPeso === opt.id;
                              return (
                                <button
                                  key={opt.id}
                                  type="button"
                                  onClick={() =>
                                    setMochilaPeso((prev) => (prev === opt.id ? '' : opt.id))
                                  }
                                  className={`min-h-[44px] px-3 py-2 rounded-xl border text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer ${
                                    active
                                      ? 'bg-[#0F7A53] text-white border-[#0F7A53]'
                                      : 'bg-white text-[#352661] border-[#DCD2F4] hover:bg-[#EEFBF4]'
                                  }`}
                                >
                                  <Icon className="w-4 h-4 shrink-0" />
                                  <span className="truncate">{opt.label}</span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      </div>

                      {/* Inline validation / duplicate feedback near submit CTA for mobile visibility */}
                      {duplicateNotice && (
                        <div className="p-4 rounded-2xl bg-[#FEF9E7] border-2 border-[#F5D67B] text-[#6B4A00] text-sm flex items-start gap-3">
                          <AlertTriangle className="w-5 h-5 text-[#C2820A] shrink-0 mt-0.5" />
                          <div className="space-y-1">
                            <p className="font-bold">Registro ya existente</p>
                            <p>{duplicateNotice.message}</p>
                          </div>
                        </div>
                      )}

                      {formError && (
                        <div className="p-4 rounded-2xl bg-[#FEF2F2] border border-[#FECACA] text-[#991B1B] text-sm">
                          {formError}
                        </div>
                      )}

                      {/* Vibrant Submit CTA */}
                      <div className="pt-1">
                        <button
                          type="submit"
                          disabled={submitting}
                          className="w-full min-h-[58px] px-6 py-3.5 rounded-2xl bg-gradient-to-r from-[#5B3FD9] via-[#6D4AFF] to-[#5B3FD9] hover:from-[#4C31C7] hover:to-[#4C31C7] active:scale-[0.99] disabled:opacity-60 text-white font-bold text-base tracking-wide shadow-[0_12px_24px_-8px_rgba(91,63,217,0.55)] flex items-center justify-center gap-2.5 transition-all cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#5B3FD9]"
                        >
                          <UserCheck className="w-5 h-5 shrink-0" />
                          <span>
                            {submitting ? 'GUARDANDO EN EXCEL...' : 'REGISTRAR MI ASISTENCIA'}
                          </span>
                        </button>
                      </div>
                    </form>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  );
}
