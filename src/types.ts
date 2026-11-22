export interface ServerClock {
  iso: string;
  fecha: string;
  fechaLegible: string;
  hora: string;
  createdAt: string;
  timezone: string;
}

export interface WorkshopConfig {
  workshopTitle: string;
  cycleLabel: string;
  activeJornada: string;
  allowParticipantSessionSelect: boolean;
  jornadas: string[];
}

export interface PublicInfoResponse {
  clock: ServerClock;
  config: WorkshopConfig;
  publicAppUrl: string | null;
}

export interface AttendanceRecord {
  id: string;
  codigo: string;
  nombres: string;
  apellidos: string;
  fecha: string;
  hora: string;
  jornada: string;
  estado: string;
  createdAt: string;
}

export interface DuplicateAttempt {
  id: string;
  codigo: string;
  nombresIngresados: string;
  apellidosIngresados: string;
  jornada: string;
  fecha: string;
  horaIntento: string;
  originalRecordId: string;
  originalHora: string;
  originalFecha: string;
  createdAt: string;
}

export interface DailyBreakdownItem {
  fecha: string;
  total: number;
  jornadas: string[];
}

export interface GraphStatus {
  configured: boolean;
  missingVars: string[];
  worksheetName: string;
  tableName: string;
  lastSyncAt: string | null;
  lastSyncError: string | null;
  lastSyncOk: boolean | null;
}

export interface PulseStats {
  totalResponses: number;
  semesterTrend: {
    subioMucho: number;
    porMomentos: number;
    masTranquilo: number;
  };
  mochilaPeso: {
    examenesTrabajos: number;
    cansancioSueno: number;
    practicasHorarios: number;
    bajoControl: number;
  };
}

export interface AdminDashboardResponse {
  clock: ServerClock;
  stats: {
    totalRegistrados: number;
    asistenciasDelDia: number;
    jornadasRealizadas: number;
    participantesUnicos: number;
    intentosDuplicados: number;
  };
  pulseStats: PulseStats;
  records: AttendanceRecord[];
  duplicateAttempts: DuplicateAttempt[];
  dailyBreakdown: DailyBreakdownItem[];
  config: WorkshopConfig;
  excelMetadata: {
    filename: string;
    worksheetName: string;
    tableName: string;
  };
  graphStatus: GraphStatus;
}

export interface AuthStatusResponse {
  initialized: boolean;
  envConfigured: boolean;
  usernameHint: string;
  authenticated: boolean;
  username: string | null;
}
