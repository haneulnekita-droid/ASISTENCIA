import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Backpack, Coffee, Headphones, Lightbulb, RefreshCw, Sparkles, Wind } from 'lucide-react';
import { ImageWithFallback } from './ImageWithFallback';

export const CEREBRO_ESTRESADO_IMG = '/src/assets/images/cerebro_medio_estresado_1795359448258.jpg';
export const CEREBRO_ZEN_IMG = '/src/assets/images/cerebro_calma_zen_1795359448675.jpg';
export const CEREBRO_ESCENA_IMG = '/src/assets/images/cerebro_escena_vibrante_1795359449219.jpg';

interface StressTool {
  id: string;
  label: string;
  tip: string;
  calmBoost: number;
  icon: 'wind' | 'backpack' | 'coffee' | 'music';
  colorClass: string;
}

const STRESS_TOOLS: StressTool[] = [
  {
    id: 'respirar',
    label: 'Respiro 4-4-4',
    tip: 'Inhala 4 seg, sostén 4 seg, exhala lento. ¡Tu sistema nervioso te lo agradece!',
    calmBoost: 35,
    icon: 'wind',
    colorClass: 'bg-[#E6F9F0] border-[#A7E8CB] text-[#0F533B] hover:bg-[#D1F4E4]',
  },
  {
    id: 'mochila',
    label: 'Soltar mochila',
    tip: 'No tienes que cargar todo hoy. Deja los pendientes un momento y enfócate en ti.',
    calmBoost: 35,
    icon: 'backpack',
    colorClass: 'bg-[#F0EBFF] border-[#D0C1FA] text-[#3E2A8A] hover:bg-[#E4DBFE]',
  },
  {
    id: 'pausa',
    label: 'Té o agüita',
    tip: 'Hidrátate y relaja la mandíbula y los hombros. Pequeñas pausas cambian el día.',
    calmBoost: 30,
    icon: 'coffee',
    colorClass: 'bg-[#FEF7DF] border-[#F6DF8F] text-[#6B4A00] hover:bg-[#FCEFB8]',
  },
  {
    id: 'musica',
    label: 'Modo calma',
    tip: '¡Activaste el modo zen! Tu cerebro está listo para disfrutar la jornada.',
    calmBoost: 40,
    icon: 'music',
    colorClass: 'bg-[#FCEEF7] border-[#F5C5E2] text-[#7A1D56] hover:bg-[#FADFF0]',
  },
];

const BRAIN_FACTS: string[] = [
  '¿Sabías que 6 respiraciones lentas avisan al cerebro que no hay peligro y bajan el cortisol en menos de 90 segundos?',
  'Tu cerebro consume cerca del 20% de tu energía diaria: tomar agua y descansar 5 minutos entre lecturas sí mejora la memoria.',
  'Escribir lo que te preocupa en papel libera espacio mental y reduce la sensación de sobrecarga antes de dormir.',
  'Reír o compartir cómo te sientes con tus compañeros activa oxitocina, el antídoto natural frente al estrés académico.',
  'En Trabajo Social cuidamos a otros, pero tu propio bienestar es la primera herramienta de tu mochila profesional.',
];

function ToolIcon({ kind }: { kind: StressTool['icon'] }) {
  if (kind === 'wind') return <Wind className="w-4 h-4 shrink-0" />;
  if (kind === 'backpack') return <Backpack className="w-4 h-4 shrink-0" />;
  if (kind === 'coffee') return <Coffee className="w-4 h-4 shrink-0" />;
  return <Headphones className="w-4 h-4 shrink-0" />;
}

interface MascotCompanionProps {
  formProgress: number;
  isDuplicate: boolean;
  customReaction?: string | null;
}

export function MascotCompanion({
  formProgress,
  isDuplicate,
  customReaction,
}: MascotCompanionProps) {
  const [usedTools, setUsedTools] = useState<string[]>([]);
  const [lastTip, setLastTip] = useState<string>(
    '¡Uff! Entre parciales, lecturas y prácticas mi cerebro anda medio estresado. ¡Prueba una herramienta o cuéntame cómo va tu semestre!'
  );
  const [breathingActive, setBreathingActive] = useState(false);
  const [breathPhase, setBreathPhase] = useState<'Inhala suave...' | 'Sostén...' | 'Exhala lento...'>(
    'Inhala suave...'
  );
  const [factIndex, setFactIndex] = useState(0);

  useEffect(() => {
    if (!breathingActive) return;
    const phases: ('Inhala suave...' | 'Sostén...' | 'Exhala lento...')[] = [
      'Inhala suave...',
      'Sostén...',
      'Exhala lento...',
    ];
    let step = 0;
    setBreathPhase(phases[0]);
    const timer = setInterval(() => {
      step += 1;
      if (step >= 6) {
        setBreathingActive(false);
        return;
      }
      setBreathPhase(phases[step % 3]);
    }, 3200);
    return () => clearInterval(timer);
  }, [breathingActive]);

  const toolCalm = usedTools.reduce((acc, id) => {
    const found = STRESS_TOOLS.find((t) => t.id === id);
    return acc + (found?.calmBoost || 0);
  }, 0);

  const totalCalm = Math.min(100, Math.round(toolCalm * 0.65 + formProgress * 0.45));
  const isZen = totalCalm >= 65;

  const handleUseTool = (tool: StressTool) => {
    setUsedTools((prev) => (prev.includes(tool.id) ? prev : [...prev, tool.id]));
    setLastTip(tool.tip);
    if (tool.id === 'respirar') {
      setBreathingActive(true);
    }
  };

  let stateLabel = 'Modo: Medio estresado';
  if (totalCalm >= 65) stateLabel = 'Modo: ¡Cerebro en calma!';
  else if (totalCalm >= 30) stateLabel = 'Modo: Soltando la mochila';

  const activeMessage = isDuplicate
    ? '¡Tranquilo/a! Ya tengo tu asistencia guardada en Excel para esta sesión. Respira hondo y disfruta la jornada.'
    : customReaction
      ? customReaction
      : isZen && formProgress >= 80
        ? '¡Qué maravilla! Cerebro en calma y datos completos. Presiona el botón morado para dejar tu huella.'
        : lastTip;

  return (
    <div className="space-y-5">
      <div className="bg-white rounded-[2rem] border-2 border-[#DECFFA] overflow-hidden shadow-[0_14px_34px_-12px_rgba(91,63,217,0.18)]">
        {/* Top Colorful Companion Bar */}
        <div
          className={`px-5 py-3.5 flex items-center justify-between gap-3 border-b ${
            isZen
              ? 'bg-gradient-to-r from-[#E6FAEF] via-[#F2F0FF] to-[#FEF7DF] border-[#CBEEDF]'
              : 'bg-gradient-to-r from-[#F3ECFF] via-[#FFF6E5] to-[#F7F1FF] border-[#E6DCF9]'
          }`}
        >
          <div className="flex items-center gap-2 text-xs font-bold text-[#35236B]">
            <Sparkles className="w-4 h-4 text-[#6D4AFF]" />
            <span>Cerebrín · Termómetro de Estrés</span>
          </div>
          <span
            className={`text-xs font-bold font-mono tabular-nums ${
              isZen ? 'text-[#0F7A53]' : 'text-[#7C4DFF]'
            }`}
          >
            {totalCalm}% calma
          </span>
        </div>

        <div className="p-5 space-y-5">
          {/* Interactive Brain Character Stage */}
          <div className="flex items-center gap-4">
            <motion.div
              key={isZen ? 'zen' : 'stressed'}
              initial={{ scale: 0.9, opacity: 0.85 }}
              animate={
                isZen
                  ? { scale: 1, opacity: 1, y: [0, -5, 0] }
                  : { scale: 1, opacity: 1, rotate: [-1.2, 1.2, -1.2] }
              }
              transition={{
                y: { duration: 3, repeat: Infinity, ease: 'easeInOut' },
                rotate: { duration: 1.8, repeat: Infinity, ease: 'easeInOut' },
                scale: { duration: 0.25 },
              }}
              className={`w-28 h-28 rounded-3xl overflow-hidden border-2 shrink-0 ${
                isZen ? 'border-[#8FE0BA] bg-[#E8FBF1]' : 'border-[#D9C7FC] bg-[#FFF8E6]'
              }`}
            >
              <ImageWithFallback
                src={isZen ? CEREBRO_ZEN_IMG : CEREBRO_ESTRESADO_IMG}
                alt={
                  isZen
                    ? 'Cerebrín relajado flotando en calma con audífonos y hojas de menta'
                    : 'Cerebrín medio estresado con mochila de estudios, lentes y taza de café'
                }
                className="w-full h-full object-cover"
                fallbackTitle="Cerebrín"
              />
            </motion.div>

            <div className="flex-1 min-w-0 space-y-2">
              <p className="text-xs font-bold text-[#5B3FD9]">{stateLabel}</p>
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeMessage}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.2 }}
                  className="p-3 rounded-2xl rounded-tl-sm bg-[#F6F2FF] border border-[#E2D6FA] text-xs sm:text-sm text-[#2D204D] leading-relaxed"
                >
                  {activeMessage}
                </motion.div>
              </AnimatePresence>
            </div>
          </div>

          {/* Calmness Progress Bar */}
          <div className="space-y-1.5">
            <div className="h-3 w-full rounded-full bg-[#F1ECFA] overflow-hidden border border-[#E4DCF4]">
              <motion.div
                className="h-full rounded-full bg-gradient-to-r from-[#7C4DFF] via-[#FBBF24] to-[#10B981]"
                initial={{ width: '10%' }}
                animate={{ width: `${Math.max(12, totalCalm)}%` }}
                transition={{ duration: 0.45, ease: 'easeOut' }}
              />
            </div>
            <div className="flex justify-between text-[11px] font-medium text-[#6B5F84]">
              <span>Mochila pesada</span>
              <span>Equilibrio</span>
              <span className="text-[#0F7A53] font-semibold">Calma total</span>
            </div>
          </div>

          {/* Interactive Self-Care Tools */}
          <div className="pt-3 border-t border-[#F0E9FB] space-y-2.5">
            <p className="text-xs font-bold text-[#241B35]">
              Dale herramientas de autocuidado a tu cerebro:
            </p>
            <div className="grid grid-cols-2 gap-2">
              {STRESS_TOOLS.map((tool) => {
                const selected = usedTools.includes(tool.id);
                return (
                  <button
                    key={tool.id}
                    type="button"
                    onClick={() => handleUseTool(tool)}
                    className={`min-h-[42px] px-3 py-2 rounded-xl border text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer active:scale-[0.98] ${
                      selected ? 'ring-2 ring-[#5B3FD9]/40 ' + tool.colorClass : tool.colorClass
                    }`}
                  >
                    <ToolIcon kind={tool.icon} />
                    <span className="truncate">{tool.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Live Breathing Pulse Indicator */}
          {breathingActive && (
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              className="p-3.5 rounded-2xl bg-gradient-to-r from-[#E6FAF0] to-[#F3EEFF] border border-[#BFE8D4] flex items-center justify-between gap-3"
            >
              <div className="flex items-center gap-3">
                <motion.div
                  animate={{ scale: [1, 1.35, 1] }}
                  transition={{ duration: 3.2, repeat: Infinity, ease: 'easeInOut' }}
                  className="w-8 h-8 rounded-full bg-[#10B981]/20 border-2 border-[#10B981] flex items-center justify-center shrink-0"
                >
                  <Wind className="w-4 h-4 text-[#0F7A53]" />
                </motion.div>
                <div>
                  <p className="text-xs font-bold text-[#0F533B]">{breathPhase}</p>
                  <p className="text-[11px] text-[#2B6650]">Pausa breve junto a Cerebrín</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setBreathingActive(false)}
                className="text-xs font-semibold text-[#5B3FD9] hover:underline cursor-pointer shrink-0"
              >
                Listo
              </button>
            </motion.div>
          )}
        </div>
      </div>

      {/* Dato curioso del cerebro card */}
      <div className="bg-gradient-to-br from-[#FFFBEB] via-white to-[#F5F1FE] rounded-3xl border-2 border-[#F5E0A3] p-5 space-y-3 shadow-[0_10px_24px_-12px_rgba(245,158,11,0.22)]">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs font-bold text-[#7A5200]">
            <Lightbulb className="w-4 h-4 text-[#D97706]" />
            <span>Dato curioso del cerebro</span>
          </div>
          <button
            type="button"
            onClick={() => setFactIndex((prev) => (prev + 1) % BRAIN_FACTS.length)}
            className="text-xs font-semibold text-[#5B3FD9] inline-flex items-center gap-1 hover:underline cursor-pointer"
          >
            <RefreshCw className="w-3 h-3" />
            <span>Otro dato</span>
          </button>
        </div>

        <AnimatePresence mode="wait">
          <motion.p
            key={factIndex}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.2 }}
            className="text-xs sm:text-sm text-[#423210] leading-relaxed"
          >
            {BRAIN_FACTS[factIndex]}
          </motion.p>
        </AnimatePresence>
      </div>
    </div>
  );
}
