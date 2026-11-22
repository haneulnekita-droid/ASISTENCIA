import { useMemo, useState } from 'react';
import { ArrowUpDown, Download, FileSpreadsheet, RefreshCw, Search } from 'lucide-react';
import { downloadExcelExport } from '../api';
import type { AdminDashboardResponse } from '../types';
import { ImageWithFallback } from './ImageWithFallback';
import { CEREBRO_ESTRESADO_IMG } from './MascotGuide';

interface HistorialViewProps {
  token: string;
  data: AdminDashboardResponse;
  initialDateFilter?: string;
  onRefresh: () => Promise<void>;
}

export function HistorialView({ token, data, initialDateFilter = '', onRefresh }: HistorialViewProps) {
  const [search, setSearch] = useState('');
  const [dateFilter, setDateFilter] = useState(initialDateFilter);
  const [jornadaFilter, setJornadaFilter] = useState('');
  const [ascending, setAscending] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const uniqueDates = useMemo(() => {
    return Array.from(new Set(data.records.map((r) => r.fecha))).sort((a, b) =>
      b.localeCompare(a)
    );
  }, [data.records]);

  const uniqueJornadas = useMemo(() => {
    const set = new Set<string>([...data.config.jornadas, ...data.records.map((r) => r.jornada)]);
    return Array.from(set);
  }, [data.config.jornadas, data.records]);

  const filteredRecords = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = data.records.filter((r) => {
      if (dateFilter && r.fecha !== dateFilter) return false;
      if (jornadaFilter && r.jornada !== jornadaFilter) return false;
      if (q) {
        const hay = `${r.id} ${r.codigo} ${r.nombres} ${r.apellidos} ${r.jornada}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    return list.sort((a, b) => {
      const cmp = `${a.fecha} ${a.hora}`.localeCompare(`${b.fecha} ${b.hora}`);
      return ascending ? cmp : -cmp;
    });
  }, [data.records, search, dateFilter, jornadaFilter, ascending]);

  const hasFilters = Boolean(dateFilter || jornadaFilter || search.trim());

  const handleRefresh = async () => {
    setRefreshing(true);
    setActionError(null);
    try {
      await onRefresh();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'No se pudo actualizar el historial.');
    } finally {
      setRefreshing(false);
    }
  };

  const handleExportFiltered = async () => {
    setExporting(true);
    setActionError(null);
    try {
      await downloadExcelExport(token, {
        date: dateFilter || undefined,
        jornada: jornadaFilter || undefined,
        search: search.trim() || undefined,
      });
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'No se pudo exportar el archivo Excel.');
    } finally {
      setExporting(false);
    }
  };

  const handleExportAll = async () => {
    setExporting(true);
    setActionError(null);
    try {
      await downloadExcelExport(token);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'No se pudo descargar el Excel completo.');
    } finally {
      setExporting(false);
    }
  };

  return (
    <section className="bg-gradient-to-b from-[#EDE4FF] via-[#FAF8F5] to-[#E6FAF0] py-6 sm:py-10 min-h-[calc(100vh-8rem)]">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 space-y-6">
        {/* Header with Cerebrín */}
        <div className="bg-gradient-to-r from-[#522FD6] via-[#6A45EA] to-[#7D5BF5] rounded-[2rem] p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 text-white shadow-[0_14px_34px_-12px_rgba(82,47,214,0.38)]">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl overflow-hidden border-2 border-[#FDE68A] bg-[#FFF8E6] shrink-0">
              <ImageWithFallback
                src={CEREBRO_ESTRESADO_IMG}
                alt="Cerebrín revisando el historial de asistencias"
                className="w-full h-full object-cover"
              />
            </div>
            <div>
              <p className="text-xs font-semibold text-[#FDE68A]">
                Archivo histórico · {data.excelMetadata.filename}
              </p>
              <h1 className="text-2xl sm:text-3xl font-bold text-white mt-0.5">
                Historial de Asistencias
              </h1>
              <p className="text-xs sm:text-sm text-[#EDE8FF] mt-1">
                Consulta el acumulado de todas las sesiones, filtra por día y descarga reportes en Excel.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <button
              type="button"
              disabled={refreshing}
              onClick={() => void handleRefresh()}
              className="min-h-[44px] px-4 py-2 rounded-xl bg-white/15 border border-white/30 text-white text-sm font-semibold inline-flex items-center gap-2 hover:bg-white/25 disabled:opacity-60 transition-colors cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
              <span>{refreshing ? 'Actualizando...' : 'Actualizar'}</span>
            </button>

            {hasFilters && (
              <button
                type="button"
                disabled={exporting || filteredRecords.length === 0}
                onClick={() => void handleExportFiltered()}
                className="min-h-[44px] px-4 py-2 rounded-xl bg-[#E6FAEF] hover:bg-[#D1F4E3] disabled:opacity-50 text-[#0F533B] text-sm font-bold inline-flex items-center gap-2 cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>
                  {dateFilter ? `Exportar día (${dateFilter})` : 'Exportar selección (.xlsx)'}
                </span>
              </button>
            )}

            <button
              type="button"
              disabled={exporting}
              onClick={() => void handleExportAll()}
              className="min-h-[44px] px-5 py-2 rounded-xl bg-[#FDE68A] hover:bg-[#FCD34D] disabled:opacity-60 text-[#241B35] text-sm font-bold inline-flex items-center gap-2 cursor-pointer"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Descargar Excel acumulado</span>
            </button>
          </div>
        </div>

        {actionError && (
          <div className="p-4 rounded-2xl bg-[#FEF2F2] border border-[#FECACA] text-[#991B1B] text-sm">
            {actionError}
          </div>
        )}

        {/* Filter Bar */}
        <div className="bg-white rounded-[2rem] border-2 border-[#DECFFA] p-5 space-y-4 shadow-[0_10px_28px_-14px_rgba(91,63,217,0.16)]">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
            <div className="md:col-span-5 relative">
              <Search className="w-4 h-4 text-[#7F719E] absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="search"
                placeholder="Buscar participante por nombre, apellido o código..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full min-h-[46px] pl-10 pr-4 py-2 rounded-xl bg-[#F8F5FF] border border-[#D4C7F2] text-sm text-[#241B35] focus:outline-none focus:ring-2 focus:ring-[#5B3FD9]"
              />
            </div>

            <div className="md:col-span-3">
              <input
                type="date"
                aria-label="Filtrar por día"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="w-full min-h-[46px] px-3.5 py-2 rounded-xl bg-[#F8F5FF] border border-[#D4C7F2] text-sm font-mono text-[#241B35] focus:outline-none focus:ring-2 focus:ring-[#5B3FD9]"
              />
            </div>

            <div className="md:col-span-4">
              <select
                aria-label="Filtrar por sesión"
                value={jornadaFilter}
                onChange={(e) => setJornadaFilter(e.target.value)}
                className="w-full min-h-[46px] px-3.5 py-2 rounded-xl bg-[#F8F5FF] border border-[#D4C7F2] text-sm text-[#241B35] focus:outline-none focus:ring-2 focus:ring-[#5B3FD9]"
              >
                <option value="">Todas las sesiones</option>
                {uniqueJornadas.map((j) => (
                  <option key={j} value={j}>
                    {j}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-[#F3EFFA]">
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => setDateFilter('')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                  dateFilter === ''
                    ? 'bg-[#5B3FD9] text-white'
                    : 'bg-[#F4F0FC] text-[#45395E] hover:bg-[#E7E0F8]'
                }`}
              >
                Todos los días
              </button>
              <button
                type="button"
                onClick={() => setDateFilter(data.clock.fecha)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                  dateFilter === data.clock.fecha
                    ? 'bg-[#5B3FD9] text-white'
                    : 'bg-[#F4F0FC] text-[#45395E] hover:bg-[#E7E0F8]'
                }`}
              >
                Hoy ({data.clock.fecha})
              </button>
              {uniqueDates
                .filter((d) => d !== data.clock.fecha)
                .slice(0, 5)
                .map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setDateFilter(d)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-mono font-semibold transition-colors cursor-pointer ${
                      dateFilter === d
                        ? 'bg-[#5B3FD9] text-white'
                        : 'bg-[#F4F0FC] text-[#45395E] hover:bg-[#E7E0F8]'
                    }`}
                  >
                    {d}
                  </button>
                ))}
            </div>

            <button
              type="button"
              onClick={() => setAscending((prev) => !prev)}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold text-[#3D2E61] bg-[#FAF8FC] border border-[#DCD4ED] inline-flex items-center gap-1.5 hover:bg-[#F1ECF9] cursor-pointer"
            >
              <ArrowUpDown className="w-3.5 h-3.5" />
              <span>{ascending ? 'Orden cronológico (1° → último)' : 'Más recientes primero'}</span>
            </button>
          </div>
        </div>

        {/* Full Chronological Table */}
        <div className="bg-white rounded-[2rem] border-2 border-[#DECFFA] overflow-hidden shadow-[0_14px_34px_-14px_rgba(91,63,217,0.16)]">
          <div className="h-2 bg-gradient-to-r from-[#6D4AFF] via-[#FBBF24] to-[#10B981]" />
          <div className="px-6 py-4 border-b border-[#EFEAF8] flex items-center justify-between text-xs text-[#5A4E73]">
            <span>
              Mostrando{' '}
              <strong className="text-[#241B35] font-mono tabular-nums">
                {filteredRecords.length}
              </strong>{' '}
              de{' '}
              <strong className="text-[#241B35] font-mono tabular-nums">
                {data.records.length}
              </strong>{' '}
              registros en hoja <span className="font-mono">{data.excelMetadata.worksheetName}</span>
            </span>
            {hasFilters && (
              <button
                type="button"
                onClick={() => {
                  setSearch('');
                  setDateFilter('');
                  setJornadaFilter('');
                }}
                className="font-semibold text-[#5B3FD9] hover:underline cursor-pointer"
              >
                Limpiar filtros
              </button>
            )}
          </div>

          {filteredRecords.length === 0 ? (
            <div className="p-12 text-center text-sm text-[#6B5F84]">
              No se encontraron registros que coincidan con tu búsqueda o filtros seleccionados.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="bg-[#F8F5FF] border-b border-[#E7E1F4] text-xs text-[#473380]">
                    <th className="py-3 px-4 font-semibold whitespace-nowrap">ID de registro</th>
                    <th className="py-3 px-4 font-semibold whitespace-nowrap">Código</th>
                    <th className="py-3 px-4 font-semibold">Nombres</th>
                    <th className="py-3 px-4 font-semibold">Apellidos</th>
                    <th className="py-3 px-4 font-semibold whitespace-nowrap">Fecha</th>
                    <th className="py-3 px-4 font-semibold whitespace-nowrap">Hora</th>
                    <th className="py-3 px-4 font-semibold">Sesión</th>
                    <th className="py-3 px-4 font-semibold whitespace-nowrap">Estado</th>
                    <th className="py-3 px-4 font-semibold whitespace-nowrap">Creación</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F3EFFA]">
                  {filteredRecords.map((r) => (
                    <tr key={r.id} className="hover:bg-[#FAF8FC]">
                      <td className="py-3 px-4 font-mono text-xs text-[#6B5F84] tabular-nums whitespace-nowrap">
                        {r.id}
                      </td>
                      <td className="py-3 px-4 font-mono text-xs font-semibold text-[#241B35] tabular-nums whitespace-nowrap">
                        {r.codigo}
                      </td>
                      <td className="py-3 px-4 font-medium text-[#241B35]">{r.nombres}</td>
                      <td className="py-3 px-4 font-medium text-[#241B35]">{r.apellidos}</td>
                      <td className="py-3 px-4 font-mono text-xs text-[#45395E] tabular-nums whitespace-nowrap">
                        {r.fecha}
                      </td>
                      <td className="py-3 px-4 font-mono text-xs font-semibold text-[#0F7A53] tabular-nums whitespace-nowrap">
                        {r.hora}
                      </td>
                      <td className="py-3 px-4 text-xs text-[#45395E] min-w-[200px]">{r.jornada}</td>
                      <td className="py-3 px-4 text-xs font-semibold text-[#0F7A53] whitespace-nowrap">
                        {r.estado}
                      </td>
                      <td className="py-3 px-4 font-mono text-xs text-[#6B5F84] tabular-nums whitespace-nowrap">
                        {r.createdAt}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
