import type {
  AdminDashboardResponse,
  AttendanceRecord,
  AuthStatusResponse,
  GraphStatus,
  PublicInfoResponse,
  WorkshopConfig,
} from './types';

export class ApiError extends Error {
  status: number;
  payload?: Record<string, unknown>;

  constructor(message: string, status: number, payload?: Record<string, unknown>) {
    super(message);
    this.status = status;
    this.payload = payload;
  }
}

async function parseJsonSafe(res: Response): Promise<Record<string, unknown>> {
  try {
    return (await res.json()) as Record<string, unknown>;
  } catch {
    return {};
  }
}

export async function fetchPublicInfo(): Promise<PublicInfoResponse> {
  const res = await fetch('/api/public/info', { cache: 'no-store' });
  if (!res.ok) {
    throw new ApiError('No se pudo cargar la información de la jornada.', res.status);
  }
  return (await res.json()) as PublicInfoResponse;
}

export interface SubmitAttendancePayload {
  nombres: string;
  apellidos: string;
  codigo: string;
  jornada?: string;
  semesterTrend?: string;
  mochilaPeso?: string;
}

export interface SubmitAttendanceResponse {
  ok: true;
  message: string;
  record: AttendanceRecord;
  graphSynced: boolean;
  graphWarning: string | null;
  pulseStats?: import('./types').PulseStats;
}

export async function submitAttendance(
  payload: SubmitAttendancePayload
): Promise<SubmitAttendanceResponse> {
  const res = await fetch('/api/attendance', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await parseJsonSafe(res);
  if (!res.ok) {
    throw new ApiError(
      typeof data.error === 'string' ? data.error : 'No se pudo registrar la asistencia.',
      res.status,
      data
    );
  }
  return data as unknown as SubmitAttendanceResponse;
}

export async function fetchQrDataUrl(targetUrl: string): Promise<{ url: string; dataUrl: string }> {
  const res = await fetch(`/api/qr?url=${encodeURIComponent(targetUrl)}`);
  const data = await parseJsonSafe(res);
  if (!res.ok) {
    throw new ApiError(
      typeof data.error === 'string' ? data.error : 'No se pudo generar el código QR.',
      res.status
    );
  }
  return data as unknown as { url: string; dataUrl: string };
}

export async function fetchAuthStatus(token: string | null): Promise<AuthStatusResponse> {
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch('/api/auth/status', { headers, cache: 'no-store' });
  if (!res.ok) {
    throw new ApiError('Error al verificar sesión.', res.status);
  }
  return (await res.json()) as AuthStatusResponse;
}

export async function setupFirstRunAdmin(
  username: string,
  password: string
): Promise<{ token: string; username: string }> {
  const res = await fetch('/api/auth/setup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  const data = await parseJsonSafe(res);
  if (!res.ok) {
    throw new ApiError(
      typeof data.error === 'string' ? data.error : 'No se pudo configurar el acceso.',
      res.status
    );
  }
  return data as unknown as { token: string; username: string };
}

export async function loginAdmin(
  username: string,
  password: string
): Promise<{ token: string; username: string }> {
  const res = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  const data = await parseJsonSafe(res);
  if (!res.ok) {
    throw new ApiError(
      typeof data.error === 'string' ? data.error : 'Credenciales inválidas.',
      res.status
    );
  }
  return data as unknown as { token: string; username: string };
}

export async function fetchAdminDashboard(token: string): Promise<AdminDashboardResponse> {
  const res = await fetch('/api/admin/dashboard', {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  });
  const data = await parseJsonSafe(res);
  if (!res.ok) {
    throw new ApiError(
      typeof data.error === 'string' ? data.error : 'No se pudo cargar el panel.',
      res.status
    );
  }
  return data as unknown as AdminDashboardResponse;
}

export async function updateAdminConfig(
  token: string,
  patch: Partial<Pick<WorkshopConfig, 'activeJornada' | 'allowParticipantSessionSelect' | 'jornadas'>>
): Promise<WorkshopConfig> {
  const res = await fetch('/api/admin/config', {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(patch),
  });
  const data = await parseJsonSafe(res);
  if (!res.ok) {
    throw new ApiError(
      typeof data.error === 'string' ? data.error : 'No se pudo guardar la configuración.',
      res.status
    );
  }
  return data.config as WorkshopConfig;
}

export async function downloadExcelExport(
  token: string,
  filters?: { date?: string; jornada?: string; search?: string }
): Promise<void> {
  const params = new URLSearchParams();
  if (filters?.date) params.set('date', filters.date);
  if (filters?.jornada) params.set('jornada', filters.jornada);
  if (filters?.search) params.set('search', filters.search);

  const queryString = params.toString();
  const url = queryString ? `/api/admin/export?${queryString}` : '/api/admin/export';

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  });

  if (!res.ok) {
    const data = await parseJsonSafe(res);
    throw new ApiError(
      typeof data.error === 'string' ? data.error : 'No se pudo descargar el archivo Excel.',
      res.status
    );
  }

  const blob = await res.blob();
  const disposition = res.headers.get('Content-Disposition') || '';
  const match = disposition.match(/filename="([^"]+)"/);
  const filename = match?.[1] || 'BASE_DE_DATOS_ASISTENCIA_HUELLA_DE_BIENESTAR.xlsx';

  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 10_000);
}

export async function testGraphConnection(
  token: string
): Promise<{ ok: boolean; message: string; graphStatus?: GraphStatus }> {
  const res = await fetch('/api/admin/graph/test', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
  return (await res.json()) as { ok: boolean; message: string; graphStatus?: GraphStatus };
}

export async function syncGraphWorkbook(
  token: string
): Promise<{ ok: boolean; message: string; graphStatus?: GraphStatus }> {
  const res = await fetch('/api/admin/graph/sync', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
  return (await res.json()) as { ok: boolean; message: string; graphStatus?: GraphStatus };
}
