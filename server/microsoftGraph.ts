import type { AttendanceRecord, GraphStatus } from './types.ts';

interface GraphRuntimeState {
  lastSyncAt: string | null;
  lastSyncError: string | null;
  lastSyncOk: boolean | null;
}

const runtimeState: GraphRuntimeState = {
  lastSyncAt: null,
  lastSyncError: null,
  lastSyncOk: null,
};

function getGraphEnv() {
  const tenantId = (process.env.MS_TENANT_ID || '').trim();
  const clientId = (process.env.MS_CLIENT_ID || '').trim();
  const clientSecret = (process.env.MS_CLIENT_SECRET || '').trim();
  const driveId = (process.env.MS_DRIVE_ID || '').trim();
  const itemId = (process.env.MS_ITEM_ID || '').trim();
  const worksheetName = (process.env.MS_WORKSHEET_NAME || 'REGISTRO_ASISTENCIA').trim();
  const tableName = (process.env.MS_TABLE_NAME || 'TablaRegistroAsistencia').trim();

  const missingVars: string[] = [];
  if (!tenantId) missingVars.push('MS_TENANT_ID');
  if (!clientId) missingVars.push('MS_CLIENT_ID');
  if (!clientSecret) missingVars.push('MS_CLIENT_SECRET');
  if (!driveId) missingVars.push('MS_DRIVE_ID');
  if (!itemId) missingVars.push('MS_ITEM_ID');

  return {
    tenantId,
    clientId,
    clientSecret,
    driveId,
    itemId,
    worksheetName,
    tableName,
    missingVars,
    configured: missingVars.length === 0,
  };
}

export function getGraphStatus(): GraphStatus {
  const env = getGraphEnv();
  return {
    configured: env.configured,
    missingVars: env.missingVars,
    worksheetName: env.worksheetName,
    tableName: env.tableName,
    lastSyncAt: runtimeState.lastSyncAt,
    lastSyncError: runtimeState.lastSyncError,
    lastSyncOk: runtimeState.lastSyncOk,
  };
}

async function acquireGraphToken(): Promise<string> {
  const { tenantId, clientId, clientSecret, configured, missingVars } = getGraphEnv();
  if (!configured) {
    throw new Error(`Faltan variables de configuración de Microsoft Graph: ${missingVars.join(', ')}`);
  }

  const tokenUrl = `https://login.microsoftonline.com/${encodeURIComponent(tenantId)}/oauth2/v2.0/token`;
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    scope: 'https://graph.microsoft.com/.default',
    grant_type: 'client_credentials',
  });

  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Error al autenticar con Microsoft Entra ID (${response.status}): ${errText.slice(0, 200)}`);
  }

  const data = (await response.json()) as { access_token?: string };
  if (!data.access_token) {
    throw new Error('Microsoft Entra ID no devolvió un token de acceso válido.');
  }
  return data.access_token;
}

export async function testGraphConnection(): Promise<{ ok: boolean; message: string }> {
  const env = getGraphEnv();
  if (!env.configured) {
    return {
      ok: false,
      message: `Faltan configurar las variables: ${env.missingVars.join(', ')}`,
    };
  }

  try {
    const token = await acquireGraphToken();
    const url = `https://graph.microsoft.com/v1.0/drives/${encodeURIComponent(env.driveId)}/items/${encodeURIComponent(env.itemId)}/workbook/worksheets/${encodeURIComponent(env.worksheetName)}/tables/${encodeURIComponent(env.tableName)}`;
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) {
      const detail = await response.text();
      const message = `Microsoft Graph respondió ${response.status}. Verifica que el archivo Excel y la tabla "${env.tableName}" existan en la hoja "${env.worksheetName}". ${detail.slice(0, 160)}`;
      runtimeState.lastSyncOk = false;
      runtimeState.lastSyncError = message;
      return { ok: false, message };
    }

    runtimeState.lastSyncOk = true;
    runtimeState.lastSyncError = null;
    runtimeState.lastSyncAt = new Date().toISOString();
    return {
      ok: true,
      message: `Conexión verificada con la tabla "${env.tableName}" en OneDrive / SharePoint.`,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error inesperado al conectar con Microsoft Graph';
    runtimeState.lastSyncOk = false;
    runtimeState.lastSyncError = message;
    return { ok: false, message };
  }
}

export async function appendRecordToGraphTable(record: AttendanceRecord): Promise<{ synced: boolean; error?: string }> {
  const env = getGraphEnv();
  if (!env.configured) {
    return { synced: false };
  }

  try {
    const token = await acquireGraphToken();
    const url = `https://graph.microsoft.com/v1.0/drives/${encodeURIComponent(env.driveId)}/items/${encodeURIComponent(env.itemId)}/workbook/tables/${encodeURIComponent(env.tableName)}/rows/add`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        values: [
          [
            record.id,
            record.codigo,
            record.nombres,
            record.apellidos,
            record.fecha,
            record.hora,
            record.jornada,
            record.estado,
            record.createdAt,
          ],
        ],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      const message = `Error al insertar fila en Excel de OneDrive/SharePoint (${response.status}): ${errText.slice(0, 180)}`;
      runtimeState.lastSyncOk = false;
      runtimeState.lastSyncError = message;
      return { synced: false, error: message };
    }

    runtimeState.lastSyncOk = true;
    runtimeState.lastSyncError = null;
    runtimeState.lastSyncAt = new Date().toISOString();
    return { synced: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error de red al sincronizar con OneDrive/SharePoint';
    runtimeState.lastSyncOk = false;
    runtimeState.lastSyncError = message;
    return { synced: false, error: message };
  }
}

export async function uploadWorkbookToGraph(buffer: Buffer): Promise<{ ok: boolean; message: string }> {
  const env = getGraphEnv();
  if (!env.configured) {
    return {
      ok: false,
      message: `Configuración pendiente: faltan ${env.missingVars.join(', ')}`,
    };
  }

  try {
    const token = await acquireGraphToken();
    const url = `https://graph.microsoft.com/v1.0/drives/${encodeURIComponent(env.driveId)}/items/${encodeURIComponent(env.itemId)}/content`;
    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      },
      body: new Uint8Array(buffer),
    });

    if (!response.ok) {
      const errText = await response.text();
      const message = `No se pudo subir el archivo a OneDrive/SharePoint (${response.status}): ${errText.slice(0, 180)}`;
      runtimeState.lastSyncOk = false;
      runtimeState.lastSyncError = message;
      return { ok: false, message };
    }

    runtimeState.lastSyncOk = true;
    runtimeState.lastSyncError = null;
    runtimeState.lastSyncAt = new Date().toISOString();
    return {
      ok: true,
      message: 'Archivo BASE_DE_DATOS_ASISTENCIA_HUELLA_DE_BIENESTAR.xlsx sincronizado en OneDrive / SharePoint.',
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error inesperado al sincronizar el archivo.';
    runtimeState.lastSyncOk = false;
    runtimeState.lastSyncError = message;
    return { ok: false, message };
  }
}
