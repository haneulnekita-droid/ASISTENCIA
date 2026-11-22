import { useCallback, useEffect, useState } from 'react';
import { MotionConfig } from 'motion/react';
import { ApiError, fetchAdminDashboard, fetchAuthStatus } from './api';
import { AdminDashboardView } from './components/AdminDashboardView';
import { AdminLoginView } from './components/AdminLoginView';
import { HistorialView } from './components/HistorialView';
import { Navbar, type AppSection } from './components/Navbar';
import { QrShareView } from './components/QrShareView';
import { RegistroView } from './components/RegistroView';
import type { AdminDashboardResponse, AuthStatusResponse } from './types';

function resolveInitialSection(): AppSection {
  if (typeof window === 'undefined') return 'registro';
  const params = new URLSearchParams(window.location.search);
  const vista = params.get('vista');
  if (vista === 'qr') return 'qr';
  if (vista === 'panel') return 'panel';
  if (vista === 'historial') return 'historial';
  return 'registro';
}

const TOKEN_STORAGE_KEY = 'huella_admin_token';
const USER_STORAGE_KEY = 'huella_admin_user';

function readStoredSession(): { token: string | null; username: string } {
  if (typeof window === 'undefined') return { token: null, username: 'facilitadora' };
  try {
    const sessionToken = window.sessionStorage.getItem(TOKEN_STORAGE_KEY);
    const localToken = window.localStorage.getItem(TOKEN_STORAGE_KEY);
    const token = sessionToken || localToken || null;
    const username =
      window.sessionStorage.getItem(USER_STORAGE_KEY) ||
      window.localStorage.getItem(USER_STORAGE_KEY) ||
      'facilitadora';
    return { token, username };
  } catch {
    return { token: null, username: 'facilitadora' };
  }
}

function saveStoredSession(token: string | null, username: string, rememberDevice: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    if (!token) {
      window.sessionStorage.removeItem(TOKEN_STORAGE_KEY);
      window.sessionStorage.removeItem(USER_STORAGE_KEY);
      window.localStorage.removeItem(TOKEN_STORAGE_KEY);
      window.localStorage.removeItem(USER_STORAGE_KEY);
      return;
    }
    window.sessionStorage.setItem(TOKEN_STORAGE_KEY, token);
    window.sessionStorage.setItem(USER_STORAGE_KEY, username);
    if (rememberDevice) {
      window.localStorage.setItem(TOKEN_STORAGE_KEY, token);
      window.localStorage.setItem(USER_STORAGE_KEY, username);
    } else {
      window.localStorage.removeItem(TOKEN_STORAGE_KEY);
      window.localStorage.removeItem(USER_STORAGE_KEY);
    }
  } catch {
    // Ignore storage quota / privacy mode errors
  }
}

export default function App() {
  const initialSession = readStoredSession();
  const [activeSection, setActiveSection] = useState<AppSection>(resolveInitialSection);
  const [token, setToken] = useState<string | null>(initialSession.token);
  const [adminUser, setAdminUser] = useState<string>(initialSession.username);
  const [authStatus, setAuthStatus] = useState<AuthStatusResponse | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [dashboardData, setDashboardData] = useState<AdminDashboardResponse | null>(null);
  const [loadingDashboard, setLoadingDashboard] = useState<boolean>(false);
  const [dashboardError, setDashboardError] = useState<string | null>(null);
  const [historialDatePrefill, setHistorialDatePrefill] = useState<string>('');

  const refreshAuthStatus = useCallback(async (currentToken: string | null) => {
    try {
      setAuthError(null);
      const status = await fetchAuthStatus(currentToken);
      setAuthStatus(status);
      if (status.authenticated && status.username) {
        setAdminUser(status.username);
      } else if (currentToken) {
        saveStoredSession(null, 'facilitadora', false);
        setToken(null);
        setDashboardData(null);
      }
    } catch {
      setAuthError('No se pudo conectar con el servidor para verificar el acceso.');
    }
  }, []);

  const loadDashboard = useCallback(async (activeToken: string) => {
    setLoadingDashboard(true);
    setDashboardError(null);
    try {
      const data = await fetchAdminDashboard(activeToken);
      setDashboardData(data);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        saveStoredSession(null, 'facilitadora', false);
        setToken(null);
        setDashboardData(null);
        void refreshAuthStatus(null);
      } else {
        setDashboardError(
          err instanceof Error ? err.message : 'No se pudieron cargar los registros.'
        );
      }
    } finally {
      setLoadingDashboard(false);
    }
  }, [refreshAuthStatus]);

  useEffect(() => {
    void refreshAuthStatus(token);
  }, [token, refreshAuthStatus]);

  useEffect(() => {
    if (token && (activeSection === 'panel' || activeSection === 'historial')) {
      void loadDashboard(token);
    }
  }, [token, activeSection, loadDashboard]);

  const handleAuthenticated = (newToken: string, username: string, rememberDevice = true) => {
    saveStoredSession(newToken, username, rememberDevice);
    setToken(newToken);
    setAdminUser(username);
    setAuthError(null);
    setAuthStatus((prev) =>
      prev
        ? { ...prev, initialized: true, authenticated: true, username }
        : {
            initialized: true,
            envConfigured: false,
            usernameHint: username,
            authenticated: true,
            username,
          }
    );
    if (activeSection !== 'historial') {
      setActiveSection('panel');
    }
  };

  const handleLogout = () => {
    saveStoredSession(null, 'facilitadora', false);
    setToken(null);
    setDashboardData(null);
    setActiveSection('registro');
  };

  const handleAuthAction = () => {
    if (token) {
      handleLogout();
    } else {
      setActiveSection('panel');
    }
  };

  const handleOpenHistorialForDate = (fecha: string) => {
    setHistorialDatePrefill(fecha);
    setActiveSection('historial');
  };

  const isAuthenticated = Boolean(token);
  const mobileNavItems: { id: AppSection; label: string }[] = [
    { id: 'registro', label: 'Registro' },
    { id: 'qr', label: 'Código QR' },
    { id: 'panel', label: 'Panel' },
    { id: 'historial', label: 'Historial' },
  ];

  return (
    <MotionConfig reducedMotion="user">
    <div className="min-h-screen flex flex-col bg-[#FAF8F5] text-[#241B35]">
      <Navbar
        activeSection={activeSection}
        onNavigate={(section) => {
          if (section === 'historial') setHistorialDatePrefill('');
          setActiveSection(section);
        }}
        isAuthenticated={isAuthenticated}
        onAuthAction={handleAuthAction}
      />

      {/* Non-sticky compact mobile tab strip */}
      <div className="no-print md:hidden border-b border-[#E7E1F4] bg-white px-4 py-2">
        <div className="grid grid-cols-4 gap-1 bg-[#F4F0FC] p-1 rounded-xl">
          {mobileNavItems.map((item) => {
            const active = activeSection === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  if (item.id === 'historial') setHistorialDatePrefill('');
                  setActiveSection(item.id);
                }}
                className={`min-h-[38px] px-2 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap truncate cursor-pointer ${
                  active
                    ? 'bg-white text-[#5B3FD9] shadow-xs'
                    : 'text-[#5A4E73] hover:text-[#241B35]'
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </div>
      </div>

      <main className="flex-1">
        {activeSection === 'registro' && <RegistroView />}

        {activeSection === 'qr' && (
          <QrShareView onGoToForm={() => setActiveSection('registro')} />
        )}

        {(activeSection === 'panel' || activeSection === 'historial') && (
          <>
            {!isAuthenticated ? (
              authStatus ? (
                <AdminLoginView
                  authStatus={authStatus}
                  onAuthenticated={handleAuthenticated}
                />
              ) : authError ? (
                <div className="max-w-xl mx-auto px-4 py-16 text-center space-y-4">
                  <p className="text-sm text-[#991B1B]">{authError}</p>
                  <button
                    type="button"
                    onClick={() => void refreshAuthStatus(token)}
                    className="px-5 py-2.5 rounded-xl bg-[#5B3FD9] text-white text-sm font-semibold cursor-pointer"
                  >
                    Reintentar conexión
                  </button>
                </div>
              ) : (
                <div className="max-w-5xl mx-auto px-4 py-16 text-center text-sm text-[#5A4E73]">
                  Verificando acceso privado...
                </div>
              )
            ) : loadingDashboard && !dashboardData ? (
              <div className="max-w-6xl mx-auto px-4 py-16 text-center text-sm text-[#5A4E73]">
                Cargando base de datos de asistencias...
              </div>
            ) : dashboardError && !dashboardData ? (
              <div className="max-w-xl mx-auto px-4 py-16 text-center space-y-4">
                <p className="text-sm text-[#991B1B]">{dashboardError}</p>
                <button
                  type="button"
                  onClick={() => token && void loadDashboard(token)}
                  className="px-5 py-2.5 rounded-xl bg-[#5B3FD9] text-white text-sm font-semibold cursor-pointer"
                >
                  Reintentar
                </button>
              </div>
            ) : dashboardData && token ? (
              activeSection === 'panel' ? (
                <AdminDashboardView
                  token={token}
                  username={adminUser}
                  data={dashboardData}
                  onRefresh={() => loadDashboard(token)}
                  onOpenHistorialForDate={handleOpenHistorialForDate}
                />
              ) : (
                <HistorialView
                  key={historialDatePrefill || 'all'}
                  token={token}
                  data={dashboardData}
                  initialDateFilter={historialDatePrefill}
                  onRefresh={() => loadDashboard(token)}
                />
              )
            ) : null}
          </>
        )}
      </main>

      <footer className="no-print border-t border-[#E3D9F7] bg-white py-5 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-[#6B5F84]">
          <span>
            Mi Huella de Bienestar · Trabajo Social V Ciclo · “De la mochila a las herramientas”
          </span>
          <span>Registro de asistencia con base de datos Excel</span>
        </div>
      </footer>
    </div>
    </MotionConfig>
  );
}
