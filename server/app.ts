import 'dotenv/config';
import express from 'express';
import QRCode from 'qrcode';
import {
  claimFirstRunAdmin,
  extractBearerToken,
  getAuthState,
  issueAdminToken,
  requireAdmin,
  verifyAdminLogin,
  verifyAdminToken,
} from './auth.ts';
import {
  buildExportBuffer,
  EXCEL_FILENAME,
  getAllAttendanceRecords,
  getDuplicateAttempts,
  getPersistenceSummary,
  getPulseStats,
  getWorkshopConfig,
  initializeExcelDatabase,
  readRawWorkbookBuffer,
  recordAnonymousPulse,
  registerAttendance,
  TABLE_NAME,
  updateWorkshopConfig,
  WORKSHEET_NAME,
} from './excelDb.ts';
import {
  appendRecordToGraphTable,
  getGraphStatus,
  testGraphConnection,
  uploadWorkbookToGraph,
} from './microsoftGraph.ts';
import { getServerTimeSnapshot } from './time.ts';

function sanitizeText(value: unknown, maxLength: number): string {
  if (typeof value !== 'string') return '';
  return value.replace(/\s+/g, ' ').trim().slice(0, maxLength);
}

function validateSafeHttpUrl(candidate: string): string | null {
  try {
    const parsed = new URL(candidate);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return null;
    }
    return parsed.toString();
  } catch {
    return null;
  }
}

export async function createApiApp() {
  await initializeExcelDatabase();

  const app = express();
  app.set('trust proxy', 1);
  app.use(express.json({ limit: '256kb' }));
  app.use('/api', (_req, res, next) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    next();
  });

  // Public info for attendance form (no PII or participant lists exposed)
  app.get('/api/public/info', async (_req, res) => {
    try {
      const [config, clock] = await Promise.all([
        getWorkshopConfig(),
        Promise.resolve(getServerTimeSnapshot()),
      ]);
      const vercelUrl = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null;
      const publicAppUrl =
        process.env.APP_URL && process.env.APP_URL !== 'MY_APP_URL'
          ? process.env.APP_URL
          : vercelUrl;

      res.json({
        clock,
        config,
        publicAppUrl,
      });
    } catch (err) {
      console.error('Error in /api/public/info:', err);
      res.status(500).json({ error: 'No se pudo obtener la información de la jornada.' });
    }
  });

  // Public participant attendance submission
  app.post('/api/attendance', async (req, res) => {
    try {
      const nombres = sanitizeText(req.body?.nombres, 80);
      const apellidos = sanitizeText(req.body?.apellidos, 80);
      const codigo = sanitizeText(req.body?.codigo, 40);
      const requestedJornada = sanitizeText(req.body?.jornada, 140);

      if (nombres.length < 2) {
        res.status(400).json({ error: 'Por favor ingresa tus nombres completos.' });
        return;
      }
      if (apellidos.length < 2) {
        res.status(400).json({ error: 'Por favor ingresa tus apellidos completos.' });
        return;
      }
      if (codigo.length < 2) {
        res.status(400).json({ error: 'Por favor ingresa tu código de estudiante o identificador.' });
        return;
      }

      const config = await getWorkshopConfig();
      let finalJornada = config.activeJornada;

      if (config.allowParticipantSessionSelect && requestedJornada) {
        if (!config.jornadas.includes(requestedJornada)) {
          res.status(400).json({ error: 'La jornada seleccionada no es válida.' });
          return;
        }
        finalJornada = requestedJornada;
      }

      const result = await registerAttendance({
        codigo,
        nombres,
        apellidos,
        jornada: finalJornada,
      });

      if (!result.ok) {
        res.status(409).json({
          duplicate: true,
          error: `Tu asistencia para "${result.existingRecord.jornada}" ya fue registrada el ${result.existingRecord.fecha} a las ${result.existingRecord.hora}.`,
          existingFecha: result.existingRecord.fecha,
          existingHora: result.existingRecord.hora,
          jornada: result.existingRecord.jornada,
        });
        return;
      }

      const graphResult = await appendRecordToGraphTable(result.record);

      await recordAnonymousPulse({
        semesterTrend: typeof req.body?.semesterTrend === 'string' ? req.body.semesterTrend : undefined,
        mochilaPeso: typeof req.body?.mochilaPeso === 'string' ? req.body.mochilaPeso : undefined,
      });
      const pulseStats = await getPulseStats();

      res.status(201).json({
        ok: true,
        message: '¡Asistencia registrada con éxito! 💜 Gracias por ser parte de esta experiencia',
        record: result.record,
        graphSynced: graphResult.synced,
        graphWarning: graphResult.error || null,
        pulseStats,
      });
    } catch (err) {
      console.error('Error in POST /api/attendance:', err);
      res.status(500).json({
        error: 'Ocurrió un error al guardar tu asistencia en la base de datos Excel. Intenta nuevamente.',
      });
    }
  });

  // QR Code PNG generator (data URL or binary PNG download)
  app.get('/api/qr', async (req, res) => {
    try {
      const rawUrl = typeof req.query.url === 'string' ? req.query.url.trim() : '';
      const fallbackOrigin = `${req.protocol}://${req.get('host')}`;
      const targetUrl = rawUrl
        ? validateSafeHttpUrl(rawUrl)
        : validateSafeHttpUrl(`${fallbackOrigin}/?registro=1`);

      if (!targetUrl || targetUrl.length > 500) {
        res.status(400).json({ error: 'La dirección web para el código QR no es válida.' });
        return;
      }

      const isDownload = req.query.download === '1';
      if (isDownload) {
        const pngBuffer = await QRCode.toBuffer(targetUrl, {
          type: 'png',
          width: 720,
          margin: 3,
          errorCorrectionLevel: 'H',
          color: {
            dark: '#241B35',
            light: '#FFFFFF',
          },
        });
        res.setHeader('Content-Type', 'image/png');
        res.setHeader(
          'Content-Disposition',
          'attachment; filename="QR_MI_HUELLA_DE_BIENESTAR.png"'
        );
        res.send(pngBuffer);
        return;
      }

      const dataUrl = await QRCode.toDataURL(targetUrl, {
        width: 520,
        margin: 2,
        errorCorrectionLevel: 'H',
        color: {
          dark: '#241B35',
          light: '#FFFFFF',
        },
      });
      res.json({ url: targetUrl, dataUrl });
    } catch (err) {
      console.error('Error generating QR code:', err);
      res.status(500).json({ error: 'No se pudo generar el código QR.' });
    }
  });

  // Admin auth status
  app.get('/api/auth/status', async (req, res) => {
    try {
      const state = await getAuthState();
      const token = extractBearerToken(req);
      const payload = token ? verifyAdminToken(token) : null;
      res.json({
        ...state,
        authenticated: Boolean(payload),
        username: payload?.sub || null,
      });
    } catch (err) {
      console.error('Error in /api/auth/status:', err);
      res.status(500).json({ error: 'No se pudo verificar el estado de autenticación.' });
    }
  });

  // First-run admin setup
  app.post('/api/auth/setup', async (req, res) => {
    try {
      const username = sanitizeText(req.body?.username || 'facilitadora', 40);
      const password = typeof req.body?.password === 'string' ? req.body.password : '';
      const result = await claimFirstRunAdmin(username, password);
      if (!result.ok || !result.username) {
        res.status(403).json({ error: result.error || 'No se pudo completar la configuración.' });
        return;
      }
      const token = issueAdminToken(result.username);
      res.status(201).json({ token, username: result.username });
    } catch (err) {
      console.error('Error in /api/auth/setup:', err);
      res.status(500).json({ error: 'Error al configurar el acceso administrativo.' });
    }
  });

  // Admin login
  app.post('/api/auth/login', async (req, res) => {
    try {
      const username = sanitizeText(req.body?.username, 40);
      const password = typeof req.body?.password === 'string' ? req.body.password : '';
      if (!username || !password) {
        res.status(400).json({ error: 'Ingresa tu usuario y contraseña.' });
        return;
      }
      const valid = await verifyAdminLogin(username, password);
      if (!valid) {
        res.status(401).json({ error: 'Usuario o contraseña incorrectos.' });
        return;
      }
      const token = issueAdminToken(username);
      res.json({ token, username });
    } catch (err) {
      console.error('Error in /api/auth/login:', err);
      res.status(500).json({ error: 'Error al iniciar sesión.' });
    }
  });

  // Protected Facilitator Dashboard data
  app.get('/api/admin/dashboard', requireAdmin, async (_req, res) => {
    try {
      const [records, duplicateAttempts, config, pulseStats] = await Promise.all([
        getAllAttendanceRecords(),
        getDuplicateAttempts(),
        getWorkshopConfig(),
        getPulseStats(),
      ]);

      const clock = getServerTimeSnapshot();
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

      res.json({
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
        graphStatus: getGraphStatus(),
        persistence: getPersistenceSummary(),
      });
    } catch (err) {
      console.error('Error in /api/admin/dashboard:', err);
      res.status(500).json({ error: 'No se pudo cargar el panel de facilitadoras.' });
    }
  });

  // Protected Workshop Session Config update
  app.put('/api/admin/config', requireAdmin, async (req, res) => {
    try {
      const activeJornada =
        typeof req.body?.activeJornada === 'string'
          ? sanitizeText(req.body.activeJornada, 140)
          : undefined;
      const allowParticipantSessionSelect =
        typeof req.body?.allowParticipantSessionSelect === 'boolean'
          ? req.body.allowParticipantSessionSelect
          : undefined;
      const jornadas = Array.isArray(req.body?.jornadas)
        ? req.body.jornadas
            .map((j: unknown) => sanitizeText(j, 140))
            .filter(Boolean)
        : undefined;

      const updated = await updateWorkshopConfig({
        activeJornada,
        allowParticipantSessionSelect,
        jornadas,
      });

      res.json({ ok: true, config: updated });
    } catch (err) {
      console.error('Error in PUT /api/admin/config:', err);
      res.status(500).json({ error: 'No se pudo actualizar la configuración de jornadas.' });
    }
  });

  // Protected Excel export
  app.get('/api/admin/export', requireAdmin, async (req, res) => {
    try {
      const dateFilter = typeof req.query.date === 'string' ? req.query.date.trim() : '';
      const jornadaFilter = typeof req.query.jornada === 'string' ? req.query.jornada.trim() : '';
      const searchFilter = typeof req.query.search === 'string' ? req.query.search.trim().toLowerCase() : '';

      const hasFilters = Boolean(dateFilter || jornadaFilter || searchFilter);

      if (!hasFilters) {
        const buffer = await readRawWorkbookBuffer();
        res.setHeader(
          'Content-Type',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        );
        res.setHeader('Content-Disposition', `attachment; filename="${EXCEL_FILENAME}"`);
        res.send(buffer);
        return;
      }

      const allRecords = await getAllAttendanceRecords();
      const filtered = allRecords.filter((r) => {
        if (dateFilter && r.fecha !== dateFilter) return false;
        if (jornadaFilter && r.jornada !== jornadaFilter) return false;
        if (searchFilter) {
          const haystack = `${r.codigo} ${r.nombres} ${r.apellidos} ${r.jornada}`.toLowerCase();
          if (!haystack.includes(searchFilter)) return false;
        }
        return true;
      });

      const buffer = await buildExportBuffer(filtered);
      const safeDateSlug = dateFilter ? dateFilter.replace(/[^0-9-]/g, '') : 'FILTRADO';
      const downloadName = `ASISTENCIA_HUELLA_DE_BIENESTAR_${safeDateSlug}.xlsx`;

      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      );
      res.setHeader('Content-Disposition', `attachment; filename="${downloadName}"`);
      res.send(buffer);
    } catch (err) {
      console.error('Error in /api/admin/export:', err);
      res.status(500).json({ error: 'No se pudo generar el archivo Excel para descarga.' });
    }
  });

  // Protected Microsoft Graph test & manual sync
  app.post('/api/admin/graph/test', requireAdmin, async (_req, res) => {
    try {
      const result = await testGraphConnection();
      res.json({ ...result, graphStatus: getGraphStatus() });
    } catch (err) {
      console.error('Error in /api/admin/graph/test:', err);
      res.status(500).json({ ok: false, message: 'Error al probar conexión con Microsoft Graph.' });
    }
  });

  app.post('/api/admin/graph/sync', requireAdmin, async (_req, res) => {
    try {
      const buffer = await readRawWorkbookBuffer();
      const result = await uploadWorkbookToGraph(buffer);
      res.json({ ...result, graphStatus: getGraphStatus() });
    } catch (err) {
      console.error('Error in /api/admin/graph/sync:', err);
      res.status(500).json({ ok: false, message: 'Error al sincronizar el archivo Excel.' });
    }
  });

  return app;
}
