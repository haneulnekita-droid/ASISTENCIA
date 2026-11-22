import { useEffect, useState } from 'react';
import { onAuthStateChanged, signOut, type User } from 'firebase/auth';
import { MotionConfig } from 'motion/react';
import { AdminDashboardView } from './components/AdminDashboardView';
import { AdminLoginView } from './components/AdminLoginView';
import { ErrorBoundary } from './components/ErrorBoundary';
import { HistorialView } from './components/HistorialView';
import { Navbar, type AppSection } from './components/Navbar';
import { QrShareView } from './components/QrShareView';
import { RegistroView } from './components/RegistroView';
import { auth } from './firebase';
import {
  checkIsFacilitatorAuthorized,
  subscribeToDashboardData,
} from './services/firestoreAttendance';
import type { AdminDashboardResponse } from './types';

function resolveInitialSection(): AppSection {
  if (typeof window === 'undefined') return 'registro';
  const params = new URLSearchParams(window.location.search);
  const vista = params.get('vista');
  if (vista === 'qr') return 'qr';
  if (vista === 'panel') return 'panel';
  if (vista === 'historial') return 'historial';
  return 'registro';
}

export default function App() {
  const [activeSection, setActiveSection] = useState<AppSection>(resolveInitialSection);
  const [authReady, setAuthReady] = useState<boolean>(false);
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [isAdminAuthorized, setIsAdminAuthorized] = useState<boolean>(false);

  const [dashboardData, setDashboardData] = useState<AdminDashboardResponse | null>(null);
  const [loadingDashboard, setLoadingDashboard] = useState<boolean>(false);
  const [dashboardError, setDashboardError] = useState<string | null>(null);
  const [historialDatePrefill, setHistorialDatePrefill] = useState<string>('');
  const [subscriptionRevision, setSubscriptionRevision] = useState<number>(0);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);
      if (!user) {
        setIsAdminAuthorized(false);
        setDashboardData(null);
        setAuthReady(true);
        return;
      }

      const authorized = await checkIsFacilitatorAuthorized(
        user.uid,
        user.email,
        user.emailVerified
      );
      setIsAdminAuthorized(authorized);
      if (!authorized) {
        setDashboardData(null);
      }
      setAuthReady(true);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!authReady || !isAdminAuthorized) {
      return;
    }

    setLoadingDashboard(true);
    setDashboardError(null);

    const unsubscribe = subscribeToDashboardData(
      (data) => {
        setDashboardData(data);
        setLoadingDashboard(false);
        setDashboardError(null);
      },
      (err) => {
        setDashboardError(err.message || 'No se pudieron sincronizar los registros en tiempo real.');
        setLoadingDashboard(false);
      }
    );

    return () => unsubscribe();
  }, [authReady, isAdminAuthorized, subscriptionRevision]);

  const handleLogout = async () => {
    await signOut(auth);
    setDashboardData(null);
    setIsAdminAuthorized(false);
    setActiveSection('registro');
  };

  const handleAuthAction = () => {
    if (isAdminAuthorized) {
      void handleLogout();
    } else {
      setActiveSection('panel');
    }
  };

  const handleOpenHistorialForDate = (fecha: string) => {
    setHistorialDatePrefill(fecha);
    setActiveSection('historial');
  };

  const handleManualRefresh = async () => {
    setSubscriptionRevision((n) => n + 1);
  };

  const adminDisplayName =
    firebaseUser?.displayName || firebaseUser?.email || 'facilitadora';

  const mobileNavItems: { id: AppSection; label: string }[] = [
    { id: 'registro', label: 'Registro' },
    { id: 'qr', label: 'Código QR' },
    { id: 'panel', label: 'Panel' },
    { id: 'historial', label: 'Historial' },
  ];

  return (
    <ErrorBoundary>
      <MotionConfig reducedMotion="user">
        <div className="min-h-screen flex flex-col bg-[#FAF8F5] text-[#241B35]">
          <Navbar
            activeSection={activeSection}
            onNavigate={(section) => {
              if (section === 'historial') setHistorialDatePrefill('');
              setActiveSection(section);
            }}
            isAuthenticated={isAdminAuthorized}
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
                {!authReady ? (
                  <div className="max-w-5xl mx-auto px-4 py-16 text-center text-sm text-[#5A4E73]">
                    Conectando con la nube...
                  </div>
                ) : !isAdminAuthorized ? (
                  <AdminLoginView
                    currentUser={firebaseUser}
                    unauthorizedEmail={
                      firebaseUser && !isAdminAuthorized ? firebaseUser.email : null
                    }
                  />
                ) : loadingDashboard && !dashboardData ? (
                  <div className="max-w-6xl mx-auto px-4 py-16 text-center text-sm text-[#5A4E73]">
                    Cargando asistencias en tiempo real...
                  </div>
                ) : dashboardError && !dashboardData ? (
                  <div className="max-w-xl mx-auto px-4 py-16 text-center space-y-4">
                    <p className="text-sm text-[#991B1B]">{dashboardError}</p>
                    <button
                      type="button"
                      onClick={() => void handleManualRefresh()}
                      className="px-5 py-2.5 rounded-xl bg-[#5B3FD9] text-white text-sm font-semibold cursor-pointer"
                    >
                      Reintentar conexión
                    </button>
                  </div>
                ) : dashboardData ? (
                  activeSection === 'panel' ? (
                    <AdminDashboardView
                      username={adminDisplayName}
                      data={dashboardData}
                      onRefresh={handleManualRefresh}
                      onOpenHistorialForDate={handleOpenHistorialForDate}
                    />
                  ) : (
                    <HistorialView
                      key={historialDatePrefill || 'all'}
                      data={dashboardData}
                      initialDateFilter={historialDatePrefill}
                      onRefresh={handleManualRefresh}
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
              <span>Sincronización multi-dispositivo en tiempo real · Exportación Excel (.xlsx)</span>
            </div>
          </footer>
        </div>
      </MotionConfig>
    </ErrorBoundary>
  );
}
