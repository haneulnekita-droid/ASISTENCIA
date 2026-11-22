import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  type Unsubscribe,
} from 'firebase/firestore';
import { fetchPublicInfo } from '../api';
import { db, handleFirestoreError, OperationType, PRIMARY_ADMIN_EMAIL } from '../firebase';
import type {
  AdminDashboardResponse,
  AttendanceRecord,
  DuplicateAttempt,
  PulseStats,
  ServerClock,
  WorkshopConfig,
} from '../types';

export const EXCEL_FILENAME = 'BASE_DE_DATOS_ASISTENCIA_HUELLA_DE_BIENESTAR.xlsx';
export const WORKSHEET_NAME = 'REGISTRO_ASISTENCIA';
export const TABLE_NAME = 'TablaRegistroAsistencia';

export const DEFAULT_WORKSHOP_CONFIG: WorkshopConfig = {
  workshopTitle:
    'De la mochila a las herramientas: evaluando lo que aprendimos para gestionar el estrés',
  cycleLabel: 'V ciclo de Trabajo Social',
  activeJornada: 'Jornada 1: Apertura y diagnóstico emocional',
  allowParticipantSessionSelect: false,
  jornadas: [
    'Jornada 1: Apertura y diagnóstico emocional',
    'Jornada 2: Herramientas prácticas de autocuidado',
    'Jornada 3: Evaluación de impacto y cierre',
  ],
};

function sanitizeStr(value: string, maxLen: number): string {
  return value.replace(/\s+/g, ' ').trim().slice(0, maxLen);
}

function stableHash(input: string): string {
  let h1 = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h1 ^= input.charCodeAt(i);
    h1 = Math.imul(h1, 0x01000193);
  }
  return (h1 >>> 0).toString(36).toUpperCase();
}

function randomToken(len = 6): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < len; i++) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

export function getLimaClockSnapshot(serverIso?: string): ServerClock {
  const now = serverIso ? new Date(serverIso) : new Date();
  const safeNow = Number.isFinite(now.getTime()) ? now : new Date();
  const timezone = 'America/Lima';

  const dateParts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(safeNow);

  const timeParts = new Intl.DateTimeFormat('en-GB', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(safeNow);

  const pick = (parts: Intl.DateTimeFormatPart[], type: string) =>
    parts.find((p) => p.type === type)?.value || '00';

  const year = pick(dateParts, 'year');
  const month = pick(dateParts, 'month');
  const day = pick(dateParts, 'day');
  let hh = pick(timeParts, 'hour');
  if (hh === '24') hh = '00';
  const mm = pick(timeParts, 'minute');
  const ss = pick(timeParts, 'second');

  const fecha = `${year}-${month}-${day}`;
  const hora = `${hh}:${mm}:${ss}`;
  const fechaRaw = new Intl.DateTimeFormat('es-PE', {
    timeZone: timezone,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(safeNow);

  return {
    iso: safeNow.toISOString(),
    fecha,
    fechaLegible: fechaRaw.charAt(0).toUpperCase() + fechaRaw.slice(1),
    hora,
    createdAt: `${fecha} ${hora}`,
    timezone,
  };
}

function buildDeterministicAttendanceId(codigo: string, fecha: string, jornada: string): string {
  const safeCode = codigo
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9_-]/g, '_')
    .slice(0, 24);
  const codeHash = stableHash(codigo.trim().toUpperCase());
  const jHash = stableHash(jornada.trim().toLowerCase());
  return `ATT_${fecha}_${safeCode || 'ID'}_${codeHash}_${jHash}`.slice(0, 120);
}

function formatTimestampField(value: unknown, fallbackDate: string, fallbackTime: string): string {
  if (value instanceof Timestamp) {
    return getLimaClockSnapshot(value.toDate().toISOString()).createdAt;
  }
  if (typeof value === 'string' && value.trim()) {
    return value.trim();
  }
  return `${fallbackDate} ${fallbackTime}`;
}

export async function getPublicWorkshopConfig(): Promise<WorkshopConfig> {
  const path = 'config/workshop';
  try {
    const snap = await getDoc(doc(db, 'config', 'workshop'));
    if (!snap.exists()) {
      return DEFAULT_WORKSHOP_CONFIG;
    }
    const d = snap.data();
    const jornadas =
      Array.isArray(d.jornadas) && d.jornadas.length > 0
        ? d.jornadas.map((j: unknown) => sanitizeStr(String(j), 140)).filter(Boolean)
        : DEFAULT_WORKSHOP_CONFIG.jornadas;
    const activeJornada =
      typeof d.activeJornada === 'string' && jornadas.includes(d.activeJornada)
        ? d.activeJornada
        : jornadas[0];

    return {
      workshopTitle:
        typeof d.workshopTitle === 'string' && d.workshopTitle.trim()
          ? d.workshopTitle.trim()
          : DEFAULT_WORKSHOP_CONFIG.workshopTitle,
      cycleLabel:
        typeof d.cycleLabel === 'string' && d.cycleLabel.trim()
          ? d.cycleLabel.trim()
          : DEFAULT_WORKSHOP_CONFIG.cycleLabel,
      activeJornada,
      allowParticipantSessionSelect: Boolean(d.allowParticipantSessionSelect),
      jornadas,
    };
  } catch {
    return DEFAULT_WORKSHOP_CONFIG;
  }
}

export async function updateFirestoreWorkshopConfig(
  current: WorkshopConfig,
  patch: Partial<Pick<WorkshopConfig, 'activeJornada' | 'allowParticipantSessionSelect' | 'jornadas'>>
): Promise<WorkshopConfig> {
  const nextJornadas =
    Array.isArray(patch.jornadas) && patch.jornadas.length > 0
      ? Array.from(
          new Set(patch.jornadas.map((j) => sanitizeStr(j, 140)).filter((j) => j.length >= 3))
        ).slice(0, 30)
      : current.jornadas;

  const candidateActive =
    typeof patch.activeJornada === 'string' && patch.activeJornada.trim().length >= 3
      ? sanitizeStr(patch.activeJornada, 140)
      : current.activeJornada;

  if (!nextJornadas.includes(candidateActive) && nextJornadas.length < 30) {
    nextJornadas.push(candidateActive);
  }

  const nextConfig: WorkshopConfig = {
    workshopTitle: sanitizeStr(current.workshopTitle, 200),
    cycleLabel: sanitizeStr(current.cycleLabel, 100),
    activeJornada: nextJornadas.includes(candidateActive) ? candidateActive : nextJornadas[0],
    allowParticipantSessionSelect:
      typeof patch.allowParticipantSessionSelect === 'boolean'
        ? patch.allowParticipantSessionSelect
        : current.allowParticipantSessionSelect,
    jornadas: nextJornadas,
  };

  const docPath = 'config/workshop';
  try {
    await setDoc(doc(db, 'config', 'workshop'), {
      ...nextConfig,
      updatedAt: serverTimestamp(),
    });
    return nextConfig;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, docPath);
  }
}

export interface CloudSubmitInput {
  nombres: string;
  apellidos: string;
  codigo: string;
  semesterTrend?: string;
  mochilaPeso?: string;
}

export type CloudSubmitResult =
  | {
      ok: true;
      message: string;
      record: AttendanceRecord;
    }
  | {
      ok: false;
      duplicate: true;
      message: string;
      fecha: string;
      jornada: string;
    };

export async function submitAttendanceToFirestore(
  input: CloudSubmitInput
): Promise<CloudSubmitResult> {
  const nombres = sanitizeStr(input.nombres, 80);
  const apellidos = sanitizeStr(input.apellidos, 80);
  const codigo = sanitizeStr(input.codigo, 40);

  if (nombres.length < 2) {
    throw new Error('Por favor ingresa tus nombres completos.');
  }
  if (apellidos.length < 2) {
    throw new Error('Por favor ingresa tus apellidos completos.');
  }
  if (codigo.length < 1) {
    throw new Error('Por favor ingresa tu código de estudiante o identificador.');
  }

  let serverIso: string | undefined;
  try {
    const publicInfo = await fetchPublicInfo();
    serverIso = publicInfo.clock.iso;
  } catch {
    // Fallback to device clock formatted in America/Lima
  }

  const [clock, config] = await Promise.all([
    Promise.resolve(getLimaClockSnapshot(serverIso)),
    getPublicWorkshopConfig(),
  ]);

  const jornada = sanitizeStr(config.activeJornada, 140);
  const recordDocId = buildDeterministicAttendanceId(codigo, clock.fecha, jornada);
  const receiptId = `HB-${clock.fecha.replace(/-/g, '').slice(2)}-${randomToken(5)}`;

  const payload = {
    id: receiptId,
    codigo,
    nombres,
    apellidos,
    fecha: clock.fecha,
    hora: clock.hora,
    jornada,
    estado: 'Asistió' as const,
    createdAt: serverTimestamp(),
  };

  try {
    await setDoc(doc(db, 'attendance_records', recordDocId), payload);
  } catch (err) {
    const code = (err as { code?: string })?.code;
    if (code === 'permission-denied') {
      // Deterministic doc already exists -> immutable duplicate protection triggered
      const dupId = `DUP_${clock.fecha.replace(/-/g, '')}_${randomToken(6)}`;
      try {
        await setDoc(doc(db, 'duplicate_attempts', dupId), {
          id: dupId,
          codigo,
          nombresIngresados: nombres,
          apellidosIngresados: apellidos,
          jornada,
          fecha: clock.fecha,
          horaIntento: clock.hora,
          createdAt: serverTimestamp(),
        });
      } catch {
        // Ignore logging failures on duplicate notice
      }

      return {
        ok: false,
        duplicate: true,
        message: `Tu asistencia para "${jornada}" ya fue registrada hoy (${clock.fecha}).`,
        fecha: clock.fecha,
        jornada,
      };
    }

    handleFirestoreError(err, OperationType.CREATE, `attendance_records/${recordDocId}`);
  }

  // Record anonymous pulse response independently if answered
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

  if (validTrend || validMochila) {
    const pulseId = `PLS_${Date.now().toString(36).toUpperCase()}_${randomToken(5)}`;
    const pulseDoc: Record<string, unknown> = {
      id: pulseId,
      createdAt: serverTimestamp(),
    };
    if (validTrend) pulseDoc.semesterTrend = validTrend;
    if (validMochila) pulseDoc.mochilaPeso = validMochila;

    try {
      await setDoc(doc(db, 'pulse_responses', pulseId), pulseDoc);
    } catch {
      // Non-blocking for attendance confirmation
    }
  }

  return {
    ok: true,
    message: '¡Asistencia registrada con éxito! 💜 Gracias por ser parte de esta experiencia',
    record: {
      id: receiptId,
      codigo,
      nombres,
      apellidos,
      fecha: clock.fecha,
      hora: clock.hora,
      jornada,
      estado: 'Asistió',
      createdAt: clock.createdAt,
    },
  };
}

export async function checkIsFacilitatorAuthorized(
  uid: string,
  email: string | null | undefined,
  emailVerified: boolean
): Promise<boolean> {
  if (!emailVerified) return false;
  if (email && email.toLowerCase() === PRIMARY_ADMIN_EMAIL.toLowerCase()) {
    return true;
  }
  try {
    const snap = await getDoc(doc(db, 'admins', uid));
    return snap.exists();
  } catch {
    return false;
  }
}

export function subscribeToDashboardData(
  onData: (data: AdminDashboardResponse) => void,
  onError: (err: Error) => void
): Unsubscribe {
  let records: AttendanceRecord[] = [];
  let duplicateAttempts: DuplicateAttempt[] = [];
  let config: WorkshopConfig = DEFAULT_WORKSHOP_CONFIG;
  let pulseStats: PulseStats = {
    totalResponses: 0,
    semesterTrend: { subioMucho: 0, porMomentos: 0, masTranquilo: 0 },
    mochilaPeso: {
      examenesTrabajos: 0,
      cansancioSueno: 0,
      practicasHorarios: 0,
      bajoControl: 0,
    },
  };

  let readyFlags = { records: false, duplicates: false, pulse: false, config: false };

  const emit = () => {
    if (!readyFlags.records) return;

    const clock = getLimaClockSnapshot();
    const today = clock.fecha;
    const todayRecords = records.filter((r) => r.fecha === today);
    const uniqueParticipants = new Set(records.map((r) => r.codigo.trim().toUpperCase())).size;
    const distinctJornadasInRecords = new Set(records.map((r) => r.jornada.trim())).size;

    const dailyMap = new Map<string, { fecha: string; total: number; jornadas: Set<string> }>();
    for (const r of records) {
      const entry = dailyMap.get(r.fecha) || {
        fecha: r.fecha,
        total: 0,
        jornadas: new Set<string>(),
      };
      entry.total += 1;
      entry.jornadas.add(r.jornada);
      dailyMap.set(r.fecha, entry);
    }

    const dailyBreakdown = Array.from(dailyMap.values())
      .map((item) => ({
        fecha: item.fecha,
        total: item.total,
        jornadas: Array.from(item.jornadas),
      }))
      .sort((a, b) => b.fecha.localeCompare(a.fecha));

    onData({
      clock,
      stats: {
        totalRegistrados: records.length,
        asistenciasDelDia: todayRecords.length,
        jornadasRealizadas: distinctJornadasInRecords,
        participantesUnicos: uniqueParticipants,
        intentosDuplicados: duplicateAttempts.length,
      },
      pulseStats,
      records,
      duplicateAttempts,
      dailyBreakdown,
      config,
      excelMetadata: {
        filename: EXCEL_FILENAME,
        worksheetName: WORKSHEET_NAME,
        tableName: TABLE_NAME,
      },
      graphStatus: {
        configured: false,
        missingVars: [],
        worksheetName: WORKSHEET_NAME,
        tableName: TABLE_NAME,
        lastSyncAt: null,
        lastSyncError: null,
        lastSyncOk: null,
      },
      persistence: {
        isVercel: false,
        mode: 'firestore-cloud',
      },
    });
  };

  const unsubRecords = onSnapshot(
    query(collection(db, 'attendance_records'), orderBy('createdAt', 'asc')),
    (snap) => {
      records = snap.docs.map((d) => {
        const raw = d.data();
        const fecha = String(raw.fecha || '');
        const hora = String(raw.hora || '');
        return {
          id: String(raw.id || d.id),
          codigo: String(raw.codigo || ''),
          nombres: String(raw.nombres || ''),
          apellidos: String(raw.apellidos || ''),
          fecha,
          hora,
          jornada: String(raw.jornada || ''),
          estado: String(raw.estado || 'Asistió'),
          createdAt: formatTimestampField(raw.createdAt, fecha, hora),
        };
      });
      readyFlags.records = true;
      emit();
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, 'attendance_records');
      } catch (wrapped) {
        onError(wrapped instanceof Error ? wrapped : new Error(String(wrapped)));
      }
    }
  );

  const unsubDuplicates = onSnapshot(
    query(collection(db, 'duplicate_attempts'), orderBy('createdAt', 'desc')),
    (snap) => {
      duplicateAttempts = snap.docs.map((d) => {
        const raw = d.data();
        const fecha = String(raw.fecha || '');
        const horaIntento = String(raw.horaIntento || '');
        return {
          id: String(raw.id || d.id),
          codigo: String(raw.codigo || ''),
          nombresIngresados: String(raw.nombresIngresados || ''),
          apellidosIngresados: String(raw.apellidosIngresados || ''),
          jornada: String(raw.jornada || ''),
          fecha,
          horaIntento,
          originalRecordId: '',
          originalHora: '',
          originalFecha: fecha,
          createdAt: formatTimestampField(raw.createdAt, fecha, horaIntento),
        };
      });
      readyFlags.duplicates = true;
      emit();
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, 'duplicate_attempts');
      } catch (wrapped) {
        onError(wrapped instanceof Error ? wrapped : new Error(String(wrapped)));
      }
    }
  );

  const unsubPulse = onSnapshot(
    collection(db, 'pulse_responses'),
    (snap) => {
      const next: PulseStats = {
        totalResponses: snap.size,
        semesterTrend: { subioMucho: 0, porMomentos: 0, masTranquilo: 0 },
        mochilaPeso: {
          examenesTrabajos: 0,
          cansancioSueno: 0,
          practicasHorarios: 0,
          bajoControl: 0,
        },
      };
      for (const d of snap.docs) {
        const raw = d.data();
        const trend: unknown = raw.semesterTrend;
        if (
          trend === 'subioMucho' ||
          trend === 'porMomentos' ||
          trend === 'masTranquilo'
        ) {
          next.semesterTrend[trend] += 1;
        }
        const mochila: unknown = raw.mochilaPeso;
        if (
          mochila === 'examenesTrabajos' ||
          mochila === 'cansancioSueno' ||
          mochila === 'practicasHorarios' ||
          mochila === 'bajoControl'
        ) {
          next.mochilaPeso[mochila] += 1;
        }
      }
      pulseStats = next;
      readyFlags.pulse = true;
      emit();
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, 'pulse_responses');
      } catch (wrapped) {
        onError(wrapped instanceof Error ? wrapped : new Error(String(wrapped)));
      }
    }
  );

  const unsubConfig = onSnapshot(
    doc(db, 'config', 'workshop'),
    (snap) => {
      if (snap.exists()) {
        const d = snap.data();
        const jornadas =
          Array.isArray(d.jornadas) && d.jornadas.length > 0
            ? d.jornadas.map((j: unknown) => sanitizeStr(String(j), 140)).filter(Boolean)
            : DEFAULT_WORKSHOP_CONFIG.jornadas;
        const activeJornada =
          typeof d.activeJornada === 'string' && jornadas.includes(d.activeJornada)
            ? d.activeJornada
            : jornadas[0];
        config = {
          workshopTitle:
            typeof d.workshopTitle === 'string' && d.workshopTitle.trim()
              ? d.workshopTitle.trim()
              : DEFAULT_WORKSHOP_CONFIG.workshopTitle,
          cycleLabel:
            typeof d.cycleLabel === 'string' && d.cycleLabel.trim()
              ? d.cycleLabel.trim()
              : DEFAULT_WORKSHOP_CONFIG.cycleLabel,
          activeJornada,
          allowParticipantSessionSelect: Boolean(d.allowParticipantSessionSelect),
          jornadas,
        };
      }
      readyFlags.config = true;
      emit();
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.GET, 'config/workshop');
      } catch (wrapped) {
        onError(wrapped instanceof Error ? wrapped : new Error(String(wrapped)));
      }
    }
  );

  return () => {
    unsubRecords();
    unsubDuplicates();
    unsubPulse();
    unsubConfig();
  };
}
