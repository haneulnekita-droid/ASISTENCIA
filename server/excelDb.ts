import ExcelJS from 'exceljs';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fetchRecordsFromGraphTable, getGraphStatus } from './microsoftGraph.ts';
import { getDataDir, isKvConfigured, isVercelRuntime, kvGetJson, kvSetJson } from './storage.ts';
import { getServerTimeSnapshot } from './time.ts';
import type { AttendanceRecord, DuplicateAttempt, PulseStats, WorkshopConfig } from './types.ts';

export const EXCEL_FILENAME = 'BASE_DE_DATOS_ASISTENCIA_HUELLA_DE_BIENESTAR.xlsx';
export const WORKSHEET_NAME = 'REGISTRO_ASISTENCIA';
export const TABLE_NAME = 'TablaRegistroAsistencia';

const KV_KEYS = {
  records: 'huella:records',
  config: 'huella:config',
  duplicates: 'huella:duplicates',
  pulse: 'huella:pulse',
} as const;

function paths() {
  const dir = getDataDir();
  return {
    dir,
    excel: path.join(dir, EXCEL_FILENAME),
    recordsBackup: path.join(dir, 'records_backup.json'),
    config: path.join(dir, 'config.json'),
    duplicates: path.join(dir, 'duplicate_attempts.json'),
    pulse: path.join(dir, 'pulse_stats.json'),
  };
}

const EXCEL_HEADERS = [
  'ID de registro',
  'Código del participante',
  'Nombres',
  'Apellidos',
  'Fecha',
  'Hora',
  'Jornada',
  'Estado de asistencia',
  'Fecha y hora de creación del registro',
] as const;

const DEFAULT_CONFIG: WorkshopConfig = {
  workshopTitle: 'De la mochila a las herramientas: evaluando lo que aprendimos para gestionar el estrés',
  cycleLabel: 'V ciclo de Trabajo Social',
  activeJornada: 'Jornada 1: Apertura y diagnóstico emocional',
  allowParticipantSessionSelect: false,
  jornadas: [
    'Jornada 1: Apertura y diagnóstico emocional',
    'Jornada 2: Herramientas prácticas de autocuidado',
    'Jornada 3: Evaluación de impacto y cierre',
  ],
};

const DEFAULT_PULSE_STATS: PulseStats = {
  totalResponses: 0,
  semesterTrend: {
    subioMucho: 0,
    porMomentos: 0,
    masTranquilo: 0,
  },
  mochilaPeso: {
    examenesTrabajos: 0,
    cansancioSueno: 0,
    practicasHorarios: 0,
    bajoControl: 0,
  },
};

let operationQueue: Promise<unknown> = Promise.resolve();

function withLock<T>(task: () => Promise<T>): Promise<T> {
  const next = operationQueue.then(task, task);
  operationQueue = next.then(
    () => undefined,
    () => undefined
  );
  return next;
}

async function ensureDataDir(): Promise<void> {
  await fs.mkdir(getDataDir(), { recursive: true });
}

function styleWorksheet(worksheet: ExcelJS.Worksheet): void {
  worksheet.views = [{ state: 'frozen', ySplit: 1 }];
  const widths = [20, 24, 24, 24, 14, 12, 42, 20, 28];
  widths.forEach((width, index) => {
    worksheet.getColumn(index + 1).width = width;
  });

  const headerRow = worksheet.getRow(1);
  headerRow.height = 28;
  headerRow.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11, name: 'Calibri' };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF5B3FD9' },
    };
    cell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FFD8D2EA' } },
      bottom: { style: 'medium', color: { argb: 'FF472EB8' } },
      left: { style: 'thin', color: { argb: 'FFD8D2EA' } },
      right: { style: 'thin', color: { argb: 'FFD8D2EA' } },
    };
  });
}

function buildWorkbookFromRecords(records: AttendanceRecord[]): ExcelJS.Workbook {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Mi Huella de Bienestar';
  workbook.created = new Date();
  workbook.modified = new Date();

  const worksheet = workbook.addWorksheet(WORKSHEET_NAME);

  const rows = records.map((r) => [
    r.id,
    r.codigo,
    r.nombres,
    r.apellidos,
    r.fecha,
    r.hora,
    r.jornada,
    r.estado,
    r.createdAt,
  ]);

  worksheet.addTable({
    name: TABLE_NAME,
    ref: 'A1',
    headerRow: true,
    totalsRow: false,
    style: {
      theme: 'TableStyleMedium2',
      showRowStripes: true,
    },
    columns: EXCEL_HEADERS.map((name) => ({ name, filterButton: true })),
    rows: rows.length > 0 ? rows : [],
  });

  styleWorksheet(worksheet);

  for (let i = 2; i <= rows.length + 1; i++) {
    const row = worksheet.getRow(i);
    row.height = 22;
    row.eachCell((cell) => {
      cell.font = { size: 10.5, name: 'Calibri', color: { argb: 'FF241B35' } };
      cell.alignment = { vertical: 'middle', horizontal: 'left' };
      cell.border = {
        bottom: { style: 'thin', color: { argb: 'FFE9E4F5' } },
      };
    });
  }

  return workbook;
}

function extractRecordsFromWorkbook(workbook: ExcelJS.Workbook): AttendanceRecord[] {
  const worksheet = workbook.getWorksheet(WORKSHEET_NAME);
  if (!worksheet) {
    return [];
  }

  const records: AttendanceRecord[] = [];
  worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber === 1) return;
    const cellText = (idx: number): string => {
      const val = row.getCell(idx).value;
      if (val === null || val === undefined) return '';
      if (typeof val === 'object' && 'text' in val && typeof val.text === 'string') {
        return val.text.trim();
      }
      if (val instanceof Date) {
        return val.toISOString();
      }
      return String(val).trim();
    };

    const id = cellText(1);
    const codigo = cellText(2);
    const nombres = cellText(3);
    const apellidos = cellText(4);
    const fecha = cellText(5);
    const hora = cellText(6);
    const jornada = cellText(7);
    const estado = cellText(8) || 'Asistió';
    const createdAt = cellText(9);

    if (id && codigo) {
      records.push({
        id,
        codigo,
        nombres,
        apellidos,
        fecha,
        hora,
        jornada,
        estado,
        createdAt,
      });
    }
  });

  return records;
}

async function readRecordsBackupUnsafe(): Promise<AttendanceRecord[]> {
  try {
    const raw = await fs.readFile(paths().recordsBackup, 'utf8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as AttendanceRecord[]) : [];
  } catch {
    return [];
  }
}

function mergeRecordLists(primary: AttendanceRecord[], secondary: AttendanceRecord[]): AttendanceRecord[] {
  const map = new Map<string, AttendanceRecord>();
  for (const r of secondary) {
    if (r && r.id && r.codigo) map.set(r.id, r);
  }
  for (const r of primary) {
    if (r && r.id && r.codigo) map.set(r.id, r);
  }
  return Array.from(map.values()).sort((a, b) =>
    `${a.fecha} ${a.hora} ${a.createdAt}`.localeCompare(`${b.fecha} ${b.hora} ${b.createdAt}`)
  );
}

async function readLocalExcelRecordsUnsafe(): Promise<AttendanceRecord[]> {
  await ensureDataDir();
  const { excel } = paths();
  let excelRecords: AttendanceRecord[] = [];
  let hasExcel = true;

  try {
    await fs.access(excel);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(excel);
    excelRecords = extractRecordsFromWorkbook(workbook);
  } catch {
    hasExcel = false;
  }

  const backupRecords = await readRecordsBackupUnsafe();

  if (!hasExcel) {
    const initial = backupRecords;
    const wb = buildWorkbookFromRecords(initial);
    await wb.xlsx.writeFile(excel);
    return initial;
  }

  if (backupRecords.length > excelRecords.length) {
    const merged = mergeRecordLists(excelRecords, backupRecords);
    const wb = buildWorkbookFromRecords(merged);
    await wb.xlsx.writeFile(excel);
    return merged;
  }

  return excelRecords;
}

async function readRecordsUnsafe(): Promise<AttendanceRecord[]> {
  let kvRecords: AttendanceRecord[] | null = null;
  if (isKvConfigured()) {
    const fromKv = await kvGetJson<AttendanceRecord[]>(KV_KEYS.records);
    if (Array.isArray(fromKv)) {
      kvRecords = fromKv;
    }
  }

  const localRecords = kvRecords ?? (await readLocalExcelRecordsUnsafe());

  if (getGraphStatus().configured) {
    const remoteRecords = await fetchRecordsFromGraphTable();
    if (remoteRecords) {
      return mergeRecordLists(remoteRecords, localRecords);
    }
  }

  return localRecords;
}

async function writeRecordsUnsafe(records: AttendanceRecord[]): Promise<void> {
  if (isKvConfigured()) {
    const ok = await kvSetJson(KV_KEYS.records, records);
    if (!ok) {
      console.warn('Warning: kvSetJson failed while saving attendance records.');
    }
  }

  await ensureDataDir();
  const { dir, excel, recordsBackup } = paths();
  await fs.writeFile(recordsBackup, JSON.stringify(records, null, 2), 'utf8');

  const workbook = buildWorkbookFromRecords(records);
  const tempPath = path.join(dir, `.${EXCEL_FILENAME}.${process.pid}.${Date.now()}.tmp.xlsx`);
  await workbook.xlsx.writeFile(tempPath);
  await fs.rename(tempPath, excel);
}

export async function initializeExcelDatabase(): Promise<void> {
  await withLock(async () => {
    await readLocalExcelRecordsUnsafe();
  });
}

export async function getAllAttendanceRecords(): Promise<AttendanceRecord[]> {
  return withLock(async () => {
    return readRecordsUnsafe();
  });
}

export interface AppendAttendanceInput {
  codigo: string;
  nombres: string;
  apellidos: string;
  jornada: string;
}

export type AppendAttendanceResult =
  | { ok: true; record: AttendanceRecord }
  | { ok: false; reason: 'duplicate'; existingRecord: AttendanceRecord; attempt: DuplicateAttempt };

async function readDuplicateAttemptsUnsafe(): Promise<DuplicateAttempt[]> {
  if (isKvConfigured()) {
    const fromKv = await kvGetJson<DuplicateAttempt[]>(KV_KEYS.duplicates);
    if (Array.isArray(fromKv)) return fromKv;
  }

  await ensureDataDir();
  try {
    const raw = await fs.readFile(paths().duplicates, 'utf8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as DuplicateAttempt[]) : [];
  } catch {
    return [];
  }
}

async function appendDuplicateAttemptUnsafe(attempt: DuplicateAttempt): Promise<void> {
  const attempts = await readDuplicateAttemptsUnsafe();
  attempts.unshift(attempt);
  const trimmed = attempts.slice(0, 500);
  if (isKvConfigured()) {
    await kvSetJson(KV_KEYS.duplicates, trimmed);
  }
  await ensureDataDir();
  await fs.writeFile(paths().duplicates, JSON.stringify(trimmed, null, 2), 'utf8');
}

export async function getDuplicateAttempts(): Promise<DuplicateAttempt[]> {
  return withLock(async () => {
    return readDuplicateAttemptsUnsafe();
  });
}

export async function registerAttendance(input: AppendAttendanceInput): Promise<AppendAttendanceResult> {
  return withLock(async () => {
    const records = await readRecordsUnsafe();
    const normalizedCode = input.codigo.trim().toUpperCase();
    const normalizedJornada = input.jornada.trim().toLowerCase();

    const serverClock = getServerTimeSnapshot();
    const existing = records.find(
      (r) =>
        r.codigo.trim().toUpperCase() === normalizedCode &&
        r.jornada.trim().toLowerCase() === normalizedJornada &&
        r.fecha.trim() === serverClock.fecha
    );

    if (existing) {
      const attempt: DuplicateAttempt = {
        id: `DUP-${crypto.randomBytes(3).toString('hex').toUpperCase()}`,
        codigo: input.codigo.trim(),
        nombresIngresados: input.nombres.trim(),
        apellidosIngresados: input.apellidos.trim(),
        jornada: input.jornada.trim(),
        fecha: serverClock.fecha,
        horaIntento: serverClock.hora,
        originalRecordId: existing.id,
        originalHora: existing.hora,
        originalFecha: existing.fecha,
        createdAt: serverClock.createdAt,
      };
      await appendDuplicateAttemptUnsafe(attempt);
      return {
        ok: false,
        reason: 'duplicate',
        existingRecord: existing,
        attempt,
      };
    }

    const sequenceNum = String(records.length + 1).padStart(4, '0');
    const suffix = crypto.randomBytes(2).toString('hex').toUpperCase();
    const record: AttendanceRecord = {
      id: `HB-${sequenceNum}-${suffix}`,
      codigo: input.codigo.trim(),
      nombres: input.nombres.trim(),
      apellidos: input.apellidos.trim(),
      fecha: serverClock.fecha,
      hora: serverClock.hora,
      jornada: input.jornada.trim(),
      estado: 'Asistió',
      createdAt: serverClock.createdAt,
    };

    const nextRecords = [...records, record];
    await writeRecordsUnsafe(nextRecords);

    return {
      ok: true,
      record,
    };
  });
}

export async function buildExportBuffer(records: AttendanceRecord[]): Promise<Buffer> {
  const workbook = buildWorkbookFromRecords(records);
  const arrayBuffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}

export async function readRawWorkbookBuffer(): Promise<Buffer> {
  return withLock(async () => {
    const records = await readRecordsUnsafe();
    return buildExportBuffer(records);
  });
}

export async function getWorkshopConfig(): Promise<WorkshopConfig> {
  return withLock(async () => {
    let parsed: Partial<WorkshopConfig> | null = null;

    if (isKvConfigured()) {
      parsed = await kvGetJson<Partial<WorkshopConfig>>(KV_KEYS.config);
    }

    if (!parsed) {
      await ensureDataDir();
      try {
        const raw = await fs.readFile(paths().config, 'utf8');
        parsed = JSON.parse(raw) as Partial<WorkshopConfig>;
      } catch {
        await fs.writeFile(paths().config, JSON.stringify(DEFAULT_CONFIG, null, 2), 'utf8');
        return DEFAULT_CONFIG;
      }
    }

    const jornadas =
      Array.isArray(parsed.jornadas) && parsed.jornadas.length > 0
        ? parsed.jornadas.map((j) => String(j).trim()).filter(Boolean)
        : DEFAULT_CONFIG.jornadas;
    const activeJornada =
      parsed.activeJornada && jornadas.includes(parsed.activeJornada)
        ? parsed.activeJornada
        : jornadas[0];
    return {
      workshopTitle: parsed.workshopTitle || DEFAULT_CONFIG.workshopTitle,
      cycleLabel: parsed.cycleLabel || DEFAULT_CONFIG.cycleLabel,
      activeJornada,
      allowParticipantSessionSelect: Boolean(parsed.allowParticipantSessionSelect),
      jornadas,
    };
  });
}

export async function updateWorkshopConfig(
  patch: Partial<Pick<WorkshopConfig, 'activeJornada' | 'allowParticipantSessionSelect' | 'jornadas'>>
): Promise<WorkshopConfig> {
  const current = await getWorkshopConfig();
  return withLock(async () => {
    const nextJornadas =
      Array.isArray(patch.jornadas) && patch.jornadas.length > 0
        ? Array.from(new Set(patch.jornadas.map((j) => j.trim()).filter(Boolean)))
        : current.jornadas;

    let nextActive =
      typeof patch.activeJornada === 'string' && patch.activeJornada.trim()
        ? patch.activeJornada.trim()
        : current.activeJornada;

    if (!nextJornadas.includes(nextActive)) {
      nextJornadas.push(nextActive);
    }

    const updated: WorkshopConfig = {
      workshopTitle: current.workshopTitle,
      cycleLabel: current.cycleLabel,
      activeJornada: nextActive,
      allowParticipantSessionSelect:
        typeof patch.allowParticipantSessionSelect === 'boolean'
          ? patch.allowParticipantSessionSelect
          : current.allowParticipantSessionSelect,
      jornadas: nextJornadas,
    };

    if (isKvConfigured()) {
      await kvSetJson(KV_KEYS.config, updated);
    }
    await ensureDataDir();
    await fs.writeFile(paths().config, JSON.stringify(updated, null, 2), 'utf8');
    return updated;
  });
}

async function readPulseUnsafe(): Promise<PulseStats> {
  let parsed: Partial<PulseStats> | null = null;
  if (isKvConfigured()) {
    parsed = await kvGetJson<Partial<PulseStats>>(KV_KEYS.pulse);
  }
  if (!parsed) {
    await ensureDataDir();
    try {
      const raw = await fs.readFile(paths().pulse, 'utf8');
      parsed = JSON.parse(raw) as Partial<PulseStats>;
    } catch {
      return structuredClone(DEFAULT_PULSE_STATS);
    }
  }
  return {
    totalResponses: Number(parsed.totalResponses) || 0,
    semesterTrend: {
      subioMucho: Number(parsed.semesterTrend?.subioMucho) || 0,
      porMomentos: Number(parsed.semesterTrend?.porMomentos) || 0,
      masTranquilo: Number(parsed.semesterTrend?.masTranquilo) || 0,
    },
    mochilaPeso: {
      examenesTrabajos: Number(parsed.mochilaPeso?.examenesTrabajos) || 0,
      cansancioSueno: Number(parsed.mochilaPeso?.cansancioSueno) || 0,
      practicasHorarios: Number(parsed.mochilaPeso?.practicasHorarios) || 0,
      bajoControl: Number(parsed.mochilaPeso?.bajoControl) || 0,
    },
  };
}

export async function getPulseStats(): Promise<PulseStats> {
  return withLock(async () => {
    return readPulseUnsafe();
  });
}

export async function recordAnonymousPulse(input: {
  semesterTrend?: string;
  mochilaPeso?: string;
}): Promise<void> {
  const validTrend =
    input.semesterTrend === 'subioMucho' ||
    input.semesterTrend === 'porMomentos' ||
    input.semesterTrend === 'masTranquilo'
      ? input.semesterTrend
      : null;

  const validMochila =
    input.mochilaPeso === 'examenesTrabajos' ||
    input.mochilaPeso === 'cansancioSueno' ||
    input.mochilaPeso === 'practicasHorarios' ||
    input.mochilaPeso === 'bajoControl'
      ? input.mochilaPeso
      : null;

  if (!validTrend && !validMochila) return;

  await withLock(async () => {
    const stats = await readPulseUnsafe();
    stats.totalResponses += 1;
    if (validTrend) {
      stats.semesterTrend[validTrend] += 1;
    }
    if (validMochila) {
      stats.mochilaPeso[validMochila] += 1;
    }
    if (isKvConfigured()) {
      await kvSetJson(KV_KEYS.pulse, stats);
    }
    await ensureDataDir();
    await fs.writeFile(paths().pulse, JSON.stringify(stats, null, 2), 'utf8');
  });
}

export function getPersistenceSummary(): {
  isVercel: boolean;
  mode: 'graph-excel' | 'upstash-kv' | 'local-file' | 'vercel-tmp';
} {
  if (getGraphStatus().configured) {
    return { isVercel: isVercelRuntime(), mode: 'graph-excel' };
  }
  if (isKvConfigured()) {
    return { isVercel: isVercelRuntime(), mode: 'upstash-kv' };
  }
  if (isVercelRuntime()) {
    return { isVercel: true, mode: 'vercel-tmp' };
  }
  return { isVercel: false, mode: 'local-file' };
}
