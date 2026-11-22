import { useState } from 'react';
import {
  AlertTriangle,
  Backpack,
  CalendarDays,
  CheckCircle2,
  Cloud,
  Download,
  FileSpreadsheet,
  Plus,
  RefreshCw,
  Search,
  Settings2,
  TrendingUp,
  Users,
} from 'lucide-react';
import {
  downloadExcelExport,
  syncGraphWorkbook,
  testGraphConnection,
  updateAdminConfig,
} from '../api';
import type { AdminDashboardResponse } from '../types';
import { ImageWithFallback } from './ImageWithFallback';
import { CEREBRO_ZEN_IMG } from './MascotGuide';

interface AdminDashboardViewProps {
  token: string;
  username: string;
  data: AdminDashboardResponse;
  onRefresh: () => Promise<void>;
  onOpenHistorialForDate: (fecha: string) => void;
}

function pct(value: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((value / total) * 100);
}

export function AdminDashboardView({
  token,
  username,
  data,
  onRefresh,
  onOpenHistorialForDate,
}: AdminDashboardViewProps) {
  const [selectedDate, setSelectedDate] = useState<string>(data.clock.fecha);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [newJornada, setNewJornada] = useState<string>('');
  const [savingConfig, setSavingConfig] = useState<boolean>(false);
  const [configFeedback, setConfigFeedback] = useState<string | null>(null);
  const [exporting, setExporting] = useState<boolean>(false);
  const [graphMessage, setGraphMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [graphBusy, setGraphBusy] = useState<boolean>(false);
  const [showGraphGuide, setShowGraphGuide] = useState<boolean>(!data.graphStatus.configured);

  const filteredRecords = data.records
    .filter((r) => {
      if (selectedDate && r.fecha !== selectedDate) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const hay = `${r.nombres} ${r.apellidos} ${r.codigo} ${r.jornada}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    })
    .slice()
    .reverse();

  const handleSetActiveJornada = async (jornada: string) => {
    setSavingConfig(true);
    setConfigFeedback(null);
    try {
      await updateAdminConfig(token, { activeJornada: jornada });
      await onRefresh();
      setConfigFeedback('Sesión activa actualizada para el registro en Excel.');
    } catch (err) {
      setConfigFeedback(err instanceof Error ? err.message : 'Error al actualizar sesión.');
    } finally {
      setSavingConfig(false);
    }
  };

  const handleAddJornada = async () => {
    const clean = newJornada.trim();
    if (clean.length < 3) return;
    setSavingConfig(true);
    setConfigFeedback(null);
    try {
      const nextList = Array.from(new Set([...data.config.jornadas, clean]));
      await updateAdminConfig(token, {
        jornadas: nextList,
        activeJornada: clean,
      });
      setNewJornada('');
      await onRefresh();
      setConfigFeedback(`Jornada "${clean}" agregada y activada.`);
    } catch (err) {
      setConfigFeedback(err instanceof Error ? err.message : 'No se pudo agregar la jornada.');
    } finally {
      setSavingConfig(false);
    }
  };

  const handleExportAll = async () => {
    setExporting(true);
    try {
      await downloadExcelExport(token);
    } finally {
      setExporting(false);
    }
  };

  const handleExportDay = async (fecha: string) => {
    setExporting(true);
    try {
      await downloadExcelExport(token, { date: fecha });
    } finally {
      setExporting(false);
    }
  };

  const handleTestGraph = async () => {
    setGraphBusy(true);
    setGraphMessage(null);
    try {
      const res = await testGraphConnection(token);
      setGraphMessage({ ok: res.ok, text: res.message });
      await onRefresh();
    } finally {
      setGraphBusy(false);
    }
  };

  const handleSyncGraph = async () => {
    setGraphBusy(true);
    setGraphMessage(null);
    try {
      const res = await syncGraphWorkbook(token);
      setGraphMessage({ ok: res.ok, text: res.message });
      await onRefresh();
    } finally {
      setGraphBusy(false);
    }
  };

  const trend = data.pulseStats?.semesterTrend || {
    subioMucho: 0,
    porMomentos: 0,
    masTranquilo: 0,
  };
  const totalTrend = trend.subioMucho + trend.porMomentos + trend.masTranquilo;

  const mochila = data.pulseStats?.mochilaPeso || {
    examenesTrabajos: 0,
    cansancioSueno: 0,
    practicasHorarios: 0,
    bajoControl: 0,
  };
  const totalMochila =
    mochila.examenesTrabajos +
    mochila.cansancioSueno +
    mochila.practicasHorarios +
    mochila.bajoControl;

  return (
    <section className="bg-gradient-to-b from-[#EDE4FF] via-[#FAF8F5] to-[#E6FAF0] py-6 sm:py-10">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 space-y-8">
        {/* Header with Cerebrín */}
        <div className="bg-gradient-to-r from-[#522FD6] via-[#6A45EA] to-[#7D5BF5] rounded-[2rem] p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-white shadow-[0_14px_34px_-12px_rgba(82,47,214,0.38)]">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl overflow-hidden border-2 border-[#8FE0BA] bg-[#E8FBF1] shrink-0">
              <ImageWithFallback
                src={CEREBRO_ZEN_IMG}
                alt="Cerebrín acompañando el panel administrativo"
                className="w-full h-full object-cover"
              />
            </div>
            <div>
              <p className="text-xs font-semibold text-[#FDE68A]">
                Panel privado · Facilitadora: {username} · Hoy: {data.clock.fecha}
              </p>
              <h1 className="text-2xl sm:text-3xl font-bold text-white mt-0.5">
                Control de Asistencias y Pulso Emocional
              </h1>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => void onRefresh()}
              className="min-h-[44px] px-4 py-2 rounded-xl bg-white/15 border border-white/30 text-white text-sm font-semibold inline-flex items-center gap-2 hover:bg-white/25 transition-colors cursor-pointer"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Actualizar</span>
            </button>

            <button
              type="button"
              onClick={() => void handleExportAll()}
              disabled={exporting}
              className="min-h-[44px] px-5 py-2 rounded-xl bg-[#FDE68A] hover:bg-[#FCD34D] disabled:opacity-60 text-[#241B35] text-sm font-bold inline-flex items-center gap-2 transition-colors cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>{exporting ? 'Exportando...' : 'Descargar Excel completo'}</span>
            </button>
          </div>
        </div>

        {/* 4 Vibrant KPI Stat Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white rounded-3xl border-2 border-[#DECFFA] overflow-hidden">
            <div className="h-1.5 bg-[#6D4AFF]" />
            <div className="p-5">
              <p className="text-xs font-semibold text-[#5A4E73]">
                Total de participantes registrados
              </p>
              <p className="text-3xl font-bold text-[#241B35] mt-2 font-mono tabular-nums">
                {data.stats.totalRegistrados}
              </p>
              <p className="text-xs text-[#6B5F84] mt-1">Asistencias acumuladas</p>
            </div>
          </div>

          <div className="bg-[#F2FCF7] rounded-3xl border-2 border-[#BFE8D4] overflow-hidden">
            <div className="h-1.5 bg-[#10B981]" />
            <div className="p-5">
              <p className="text-xs font-semibold text-[#155E43]">
                Total de asistencias del día
              </p>
              <p className="text-3xl font-bold text-[#0F533B] mt-2 font-mono tabular-nums">
                {data.stats.asistenciasDelDia}
              </p>
              <p className="text-xs text-[#2B7358] mt-1 font-mono tabular-nums">
                Fecha: {data.clock.fecha}
              </p>
            </div>
          </div>

          <div className="bg-[#F5F1FE] rounded-3xl border-2 border-[#D4C5FA] overflow-hidden">
            <div className="h-1.5 bg-[#8B5CF6]" />
            <div className="p-5">
              <p className="text-xs font-semibold text-[#463096]">
                Número de jornadas realizadas
              </p>
              <p className="text-3xl font-bold text-[#5B3FD9] mt-2 font-mono tabular-nums">
                {data.stats.jornadasRealizadas}
              </p>
              <p className="text-xs text-[#5A46A3] mt-1">
                De {data.config.jornadas.length} configuradas
              </p>
            </div>
          </div>

          <div className="bg-[#FFFBEB] rounded-3xl border-2 border-[#F5E0A3] overflow-hidden">
            <div className="h-1.5 bg-[#F59E0B]" />
            <div className="p-5">
              <p className="text-xs font-semibold text-[#6B4A00]">
                Participantes únicos acumulados
              </p>
              <p className="text-3xl font-bold text-[#4D3400] mt-2 font-mono tabular-nums">
                {data.stats.participantesUnicos}
              </p>
              <p className="text-xs text-[#7D5B12] mt-1">Códigos distintos registrados</p>
            </div>
          </div>
        </div>

        {/* Radiografía Emocional del Semestre (from the 2 curious questions!) */}
        <div className="bg-white rounded-[2rem] border-2 border-[#DECFFA] overflow-hidden shadow-[0_12px_30px_-14px_rgba(91,63,217,0.14)]">
          <div className="h-2 bg-gradient-to-r from-[#6D4AFF] via-[#FBBF24] to-[#10B981]" />
          <div className="p-6 space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-base font-bold text-[#241B35]">
                <TrendingUp className="w-5 h-5 text-[#6D4AFF]" />
                <h2>Radiografía Emocional del V Ciclo (Respuestas Anónimas)</h2>
              </div>
              <span className="text-xs font-mono font-semibold text-[#5B3FD9] tabular-nums">
                {data.pulseStats?.totalResponses || 0} respuestas recibidas
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Question 1 breakdown */}
              <div className="p-4 rounded-2xl bg-[#F8F5FF] border border-[#E5DCFA] space-y-3">
                <p className="text-xs font-bold text-[#35236B]">
                  1. ¿El estrés incrementó conforme avanza este semestre?
                </p>
                {[
                  {
                    label: 'Subió como montaña rusa',
                    count: trend.subioMucho,
                    bar: 'bg-[#7C4DFF]',
                  },
                  {
                    label: 'Sube por ratos, pero lo manejo',
                    count: trend.porMomentos,
                    bar: 'bg-[#F59E0B]',
                  },
                  {
                    label: 'Más tranquilo que al inicio',
                    count: trend.masTranquilo,
                    bar: 'bg-[#10B981]',
                  },
                ].map((item) => {
                  const percent = pct(item.count, totalTrend);
                  return (
                    <div key={item.label} className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="font-medium text-[#241B35]">{item.label}</span>
                        <span className="font-mono font-semibold text-[#45395E] tabular-nums">
                          {item.count} ({percent}%)
                        </span>
                      </div>
                      <div className="h-2.5 w-full rounded-full bg-white border border-[#E6DCF9] overflow-hidden">
                        <div
                          className={`h-full rounded-full ${item.bar} transition-all`}
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Question 2 breakdown */}
              <div className="p-4 rounded-2xl bg-[#EEFBF4] border border-[#CBEEDF] space-y-3">
                <p className="text-xs font-bold text-[#0F533B] flex items-center gap-1.5">
                  <Backpack className="w-4 h-4 text-[#0D9464]" />
                  2. ¿Qué pesa más en su mochila emocional hoy?
                </p>
                {[
                  {
                    label: 'Exámenes y trabajos',
                    count: mochila.examenesTrabajos,
                    bar: 'bg-[#6D4AFF]',
                  },
                  {
                    label: 'Falta de sueño / cansancio',
                    count: mochila.cansancioSueno,
                    bar: 'bg-[#F59E0B]',
                  },
                  {
                    label: 'Prácticas y horarios',
                    count: mochila.practicasHorarios,
                    bar: 'bg-[#EC4899]',
                  },
                  {
                    label: '¡Hoy vienen ligeros!',
                    count: mochila.bajoControl,
                    bar: 'bg-[#10B981]',
                  },
                ].map((item) => {
                  const percent = pct(item.count, totalMochila);
                  return (
                    <div key={item.label} className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="font-medium text-[#1E3B2F]">{item.label}</span>
                        <span className="font-mono font-semibold text-[#155E43] tabular-nums">
                          {item.count} ({percent}%)
                        </span>
                      </div>
                      <div className="h-2.5 w-full rounded-full bg-white border border-[#CBEEDF] overflow-hidden">
                        <div
                          className={`h-full rounded-full ${item.bar} transition-all`}
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Session configuration + Daily summary split */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Configure Active Jornada (internal Excel tagging) */}
          <div className="lg:col-span-5 bg-white rounded-[2rem] border-2 border-[#DECFFA] p-6 space-y-5">
            <div className="flex items-center gap-2 text-sm font-bold text-[#241B35]">
              <Settings2 className="w-4 h-4 text-[#5B3FD9]" />
              <h2>Sesión activa registrada en Excel</h2>
            </div>

            <div className="space-y-2">
              <label htmlFor="active-jornada" className="block text-xs font-medium text-[#5A4E73]">
                Esta sesión se guarda automáticamente en la columna Jornada (oculta al estudiante)
              </label>
              <select
                id="active-jornada"
                value={data.config.activeJornada}
                disabled={savingConfig}
                onChange={(e) => void handleSetActiveJornada(e.target.value)}
                className="w-full min-h-[46px] px-3.5 py-2 rounded-xl bg-[#FAF8FC] border border-[#DCD4ED] text-sm text-[#241B35] font-medium focus:outline-none focus:ring-2 focus:ring-[#5B3FD9]"
              >
                {data.config.jornadas.map((j) => (
                  <option key={j} value={j}>
                    {j}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2 pt-2 border-t border-[#F0EBF8]">
              <label htmlFor="new-jornada" className="block text-xs font-medium text-[#5A4E73]">
                Agregar nueva sesión para futuras fechas
              </label>
              <div className="flex gap-2">
                <input
                  id="new-jornada"
                  type="text"
                  placeholder="Ej. Sesión de cierre y seguimiento"
                  value={newJornada}
                  onChange={(e) => setNewJornada(e.target.value)}
                  className="flex-1 min-h-[44px] px-3.5 py-2 rounded-xl bg-[#FAF8FC] border border-[#DCD4ED] text-sm text-[#241B35] focus:outline-none focus:ring-2 focus:ring-[#5B3FD9]"
                />
                <button
                  type="button"
                  disabled={savingConfig || newJornada.trim().length < 3}
                  onClick={() => void handleAddJornada()}
                  className="min-h-[44px] px-4 py-2 rounded-xl bg-[#EFEAFD] hover:bg-[#E2D9FA] disabled:opacity-50 text-[#3E2A8A] text-sm font-semibold inline-flex items-center gap-1.5 cursor-pointer shrink-0"
                >
                  <Plus className="w-4 h-4" />
                  <span>Agregar</span>
                </button>
              </div>
            </div>

            {configFeedback && (
              <p className="text-xs font-medium text-[#0F7A53]">{configFeedback}</p>
            )}
          </div>

          {/* Daily Breakdown */}
          <div className="lg:col-span-7 bg-white rounded-[2rem] border-2 border-[#DECFFA] p-6 space-y-4">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2 text-sm font-bold text-[#241B35]">
                <CalendarDays className="w-4 h-4 text-[#0D9464]" />
                <h2>Resumen de participantes por día</h2>
              </div>
              <span className="text-xs text-[#6B5F84]">
                {data.dailyBreakdown.length} días con registros
              </span>
            </div>

            {data.dailyBreakdown.length === 0 ? (
              <div className="py-10 text-center text-sm text-[#6B5F84]">
                Aún no hay asistencias registradas. Cuando los estudiantes escaneen el código QR aparecerán aquí agrupados por fecha.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-[#E7E1F4] text-xs text-[#5A4E73]">
                      <th className="py-2.5 pr-4 font-semibold">Fecha</th>
                      <th className="py-2.5 pr-4 font-semibold">Total</th>
                      <th className="py-2.5 pr-4 font-semibold">Sesiones</th>
                      <th className="py-2.5 text-right font-semibold">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F3EFFA]">
                    {data.dailyBreakdown.map((day) => (
                      <tr key={day.fecha} className="hover:bg-[#FAF8FC]">
                        <td className="py-3 pr-4 font-mono text-xs font-semibold text-[#241B35] tabular-nums whitespace-nowrap">
                          {day.fecha}
                          {day.fecha === data.clock.fecha ? ' (Hoy)' : ''}
                        </td>
                        <td className="py-3 pr-4 font-mono font-bold text-[#5B3FD9] tabular-nums">
                          {day.total}
                        </td>
                        <td className="py-3 pr-4 text-xs text-[#5A4E73] max-w-[260px] truncate">
                          {day.jornadas.join(' · ')}
                        </td>
                        <td className="py-3 text-right whitespace-nowrap space-x-3">
                          <button
                            type="button"
                            onClick={() => onOpenHistorialForDate(day.fecha)}
                            className="text-xs font-semibold text-[#5B3FD9] hover:underline cursor-pointer"
                          >
                            Ver registros
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleExportDay(day.fecha)}
                            className="text-xs font-semibold text-[#0F7A53] hover:underline cursor-pointer"
                          >
                            Excel día
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Consult today's / filtered records */}
        <div className="bg-white rounded-[2rem] border-2 border-[#DECFFA] p-6 space-y-5">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-base font-bold text-[#241B35]">
              <Users className="w-5 h-5 text-[#5B3FD9]" />
              <h2>Consulta rápida de asistencias</h2>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <div className="relative">
                <Search className="w-4 h-4 text-[#7F719E] absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="search"
                  placeholder="Buscar por nombre o código..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="min-h-[42px] pl-10 pr-4 py-2 rounded-xl bg-[#FAF8FC] border border-[#DCD4ED] text-sm text-[#241B35] w-full sm:w-64 focus:outline-none focus:ring-2 focus:ring-[#5B3FD9]"
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="date"
                  aria-label="Filtrar por fecha"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="min-h-[42px] px-3 py-2 rounded-xl bg-[#FAF8FC] border border-[#DCD4ED] text-sm font-mono text-[#241B35] focus:outline-none focus:ring-2 focus:ring-[#5B3FD9]"
                />
                {selectedDate && (
                  <button
                    type="button"
                    onClick={() => setSelectedDate('')}
                    className="min-h-[42px] px-3 py-2 rounded-xl bg-[#EFEAFD] text-[#3E2A8A] text-xs font-semibold hover:bg-[#E2D9FA] cursor-pointer whitespace-nowrap"
                  >
                    Ver todas
                  </button>
                )}
              </div>
            </div>
          </div>

          {filteredRecords.length === 0 ? (
            <div className="py-10 text-center text-sm text-[#6B5F84]">
              No hay asistencias registradas para el filtro actual
              {selectedDate ? ` (${selectedDate})` : ''}.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="border-b border-[#E7E1F4] text-xs text-[#5A4E73]">
                    <th className="py-2.5 pr-4 font-semibold">Código</th>
                    <th className="py-2.5 pr-4 font-semibold">Nombres y apellidos</th>
                    <th className="py-2.5 pr-4 font-semibold">Fecha</th>
                    <th className="py-2.5 pr-4 font-semibold">Hora de ingreso</th>
                    <th className="py-2.5 pr-4 font-semibold">Sesión</th>
                    <th className="py-2.5 font-semibold">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F3EFFA]">
                  {filteredRecords.map((r) => (
                    <tr key={r.id} className="hover:bg-[#FAF8FC]">
                      <td className="py-3 pr-4 font-mono text-xs font-semibold text-[#241B35] tabular-nums whitespace-nowrap">
                        {r.codigo}
                      </td>
                      <td className="py-3 pr-4 font-medium text-[#241B35]">
                        {r.nombres} {r.apellidos}
                      </td>
                      <td className="py-3 pr-4 font-mono text-xs text-[#5A4E73] tabular-nums whitespace-nowrap">
                        {r.fecha}
                      </td>
                      <td className="py-3 pr-4 font-mono text-xs font-semibold text-[#0F7A53] tabular-nums whitespace-nowrap">
                        {r.hora}
                      </td>
                      <td className="py-3 pr-4 text-xs text-[#45395E]">{r.jornada}</td>
                      <td className="py-3 text-xs font-semibold text-[#0F7A53] whitespace-nowrap">
                        {r.estado}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Duplicate Registration Attempts */}
        <div className="bg-white rounded-[2rem] border-2 border-[#F5E0A3] p-6 space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-base font-bold text-[#241B35]">
              <AlertTriangle className="w-5 h-5 text-[#C2820A]" />
              <h2>Intentos de registro duplicados o repetidos</h2>
            </div>
            <span className="text-xs font-mono font-semibold text-[#7D5B12] tabular-nums">
              {data.duplicateAttempts.length} bloqueados
            </span>
          </div>

          {data.duplicateAttempts.length === 0 ? (
            <p className="text-sm text-[#6B5F84]">
              No se han detectado intentos de registro repetidos.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="border-b border-[#E7E1F4] text-xs text-[#5A4E73]">
                    <th className="py-2.5 pr-4 font-semibold">Código</th>
                    <th className="py-2.5 pr-4 font-semibold">Datos ingresados</th>
                    <th className="py-2.5 pr-4 font-semibold">Sesión</th>
                    <th className="py-2.5 pr-4 font-semibold">Registro original</th>
                    <th className="py-2.5 font-semibold">Intento repetido</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F3EFFA]">
                  {data.duplicateAttempts.map((dup) => (
                    <tr key={dup.id} className="hover:bg-[#FEFBF2]">
                      <td className="py-3 pr-4 font-mono text-xs font-semibold text-[#241B35] tabular-nums">
                        {dup.codigo}
                      </td>
                      <td className="py-3 pr-4 text-xs text-[#45395E]">
                        {dup.nombresIngresados} {dup.apellidosIngresados}
                      </td>
                      <td className="py-3 pr-4 text-xs text-[#5A4E73]">{dup.jornada}</td>
                      <td className="py-3 pr-4 font-mono text-xs text-[#0F7A53] tabular-nums whitespace-nowrap">
                        {dup.originalFecha} {dup.originalHora}
                      </td>
                      <td className="py-3 font-mono text-xs text-[#9A5B00] tabular-nums whitespace-nowrap">
                        {dup.fecha} {dup.horaIntento}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Excel Database & Microsoft Graph OneDrive / SharePoint Connection */}
        <div className="bg-white rounded-[2rem] border-2 border-[#BFE8D4] p-6 space-y-5">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-base font-bold text-[#241B35]">
                <FileSpreadsheet className="w-5 h-5 text-[#0D9464]" />
                <h2>Base de Datos Excel y Conexión OneDrive / SharePoint</h2>
              </div>
              <p className="text-xs text-[#5A4E73] font-mono">
                Archivo: {data.excelMetadata.filename} · Hoja: {data.excelMetadata.worksheetName} · Tabla:{' '}
                {data.excelMetadata.tableName}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                disabled={graphBusy}
                onClick={() => void handleTestGraph()}
                className="min-h-[42px] px-4 py-2 rounded-xl bg-[#EFEAFD] hover:bg-[#E2D9FA] disabled:opacity-60 text-[#3E2A8A] text-xs font-semibold inline-flex items-center gap-2 cursor-pointer"
              >
                <Cloud className="w-4 h-4" />
                <span>Probar OneDrive / SharePoint</span>
              </button>

              <button
                type="button"
                disabled={graphBusy || !data.graphStatus.configured}
                onClick={() => void handleSyncGraph()}
                className="min-h-[42px] px-4 py-2 rounded-xl bg-[#EAF9F2] hover:bg-[#D5F3E5] disabled:opacity-50 text-[#135D41] text-xs font-semibold inline-flex items-center gap-2 cursor-pointer border border-[#BFE8D4]"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Sincronizar Excel en la nube</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {data.persistence?.mode === 'vercel-tmp' ? (
              <div className="p-4 rounded-2xl bg-[#FFFBEB] border border-[#F5E0A3] flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-[#B47B00] shrink-0 mt-0.5" />
                <div className="space-y-1 text-xs">
                  <p className="font-bold text-[#6B4A00]">
                    Modo Vercel temporal (/tmp) — configura almacenamiento permanente
                  </p>
                  <p className="text-[#7D5B12] leading-relaxed">
                    En Vercel las funciones serverless reinician <span className="font-mono">/tmp</span> al actualizar o hibernar. Para que tus asistencias nunca se pierdan en la nube, agrega en Vercel las variables de <strong>OneDrive/SharePoint (MS_*)</strong> o de <strong>Upstash Redis (UPSTASH_REDIS_REST_URL y UPSTASH_REDIS_REST_TOKEN)</strong>.
                  </p>
                </div>
              </div>
            ) : (
              <div className="p-4 rounded-2xl bg-[#F4FBF7] border border-[#CBEEDF] flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-[#0F7A53] shrink-0 mt-0.5" />
                <div className="space-y-1 text-xs">
                  <p className="font-bold text-[#0F533B]">
                    {data.persistence?.mode === 'graph-excel'
                      ? 'Persistencia permanente activa en OneDrive / SharePoint'
                      : data.persistence?.mode === 'upstash-kv'
                        ? 'Persistencia permanente en nube activa (Upstash Redis) + Excel'
                        : 'Base de datos Excel permanente activa en servidor'}
                  </p>
                  <p className="text-[#2B6650] leading-relaxed">
                    Cada registro se guarda inmediatamente en el libro estructurado{' '}
                    <span className="font-mono">{data.excelMetadata.filename}</span> (sin usar almacenamiento temporal del navegador) y persiste entre sesiones y dispositivos.
                  </p>
                </div>
              </div>
            )}

            <div
              className={`p-4 rounded-2xl border flex items-start gap-3 ${
                data.graphStatus.configured
                  ? 'bg-[#F4F0FC] border-[#DCD4ED]'
                  : 'bg-[#FEF9EC] border-[#F5E0A3]'
              }`}
            >
              <Cloud
                className={`w-5 h-5 shrink-0 mt-0.5 ${
                  data.graphStatus.configured ? 'text-[#5B3FD9]' : 'text-[#B47B00]'
                }`}
              />
              <div className="space-y-1 text-xs">
                <p className="font-bold text-[#241B35]">
                  {data.graphStatus.configured
                    ? 'Sincronización automática con Microsoft Graph configurada'
                    : 'OneDrive / SharePoint requiere credenciales de Microsoft Graph'}
                </p>
                <p className="text-[#5A4E73] leading-relaxed">
                  {data.graphStatus.configured
                    ? data.graphStatus.lastSyncAt
                      ? `Última sincronización: ${data.graphStatus.lastSyncAt}`
                      : 'Listo para sincronizar filas en tiempo real con la tabla en la nube.'
                    : `Faltan variables de entorno: ${data.graphStatus.missingVars.join(', ')}.`}
                </p>
                <button
                  type="button"
                  onClick={() => setShowGraphGuide((prev) => !prev)}
                  className="font-semibold text-[#5B3FD9] hover:underline pt-1 cursor-pointer"
                >
                  {showGraphGuide
                    ? 'Ocultar guía de conexión OneDrive / SharePoint'
                    : 'Ver cómo conectar OneDrive / SharePoint'}
                </button>
              </div>
            </div>
          </div>

          {graphMessage && (
            <div
              className={`p-4 rounded-2xl text-xs font-medium border ${
                graphMessage.ok
                  ? 'bg-[#F4FBF7] border-[#CBEEDF] text-[#0F533B]'
                  : 'bg-[#FEF2F2] border-[#FECACA] text-[#991B1B]'
              }`}
            >
              {graphMessage.text}
            </div>
          )}

          {showGraphGuide && (
            <div className="p-5 rounded-2xl bg-[#FAF8FC] border border-[#E7E1F4] space-y-3 text-xs text-[#45395E] leading-relaxed">
              <h3 className="text-sm font-bold text-[#241B35]">
                Guía para conectar directamente con Excel en OneDrive o SharePoint
              </h3>
              <ol className="list-decimal pl-5 space-y-2">
                <li>
                  Sube el archivo descargado{' '}
                  <span className="font-mono font-semibold">{data.excelMetadata.filename}</span> a tu
                  carpeta de OneDrive o biblioteca de documentos en SharePoint. Asegúrate de que conserve la hoja{' '}
                  <span className="font-mono font-semibold">{data.excelMetadata.worksheetName}</span> y la
                  tabla <span className="font-mono font-semibold">{data.excelMetadata.tableName}</span>.
                </li>
                <li>
                  En Microsoft Entra ID (Azure Portal), registra una aplicación y en{' '}
                  <strong>API Permissions → Microsoft Graph → Application permissions</strong> asigna{' '}
                  <span className="font-mono font-semibold">Files.ReadWrite.All</span> (y{' '}
                  <span className="font-mono font-semibold">Sites.ReadWrite.All</span> si usas SharePoint)
                  con consentimiento de administrador.
                </li>
                <li>
                  Configura las siguientes variables secretas en el entorno del servidor:{' '}
                  <span className="font-mono">
                    MS_TENANT_ID, MS_CLIENT_ID, MS_CLIENT_SECRET, MS_DRIVE_ID, MS_ITEM_ID
                  </span>
                  .
                </li>
                <li>
                  Una vez configuradas, haz clic en <strong>Probar OneDrive / SharePoint</strong>. Cada nueva asistencia se agregará automáticamente como fila en la tabla de OneDrive/SharePoint.
                </li>
              </ol>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
