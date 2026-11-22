import { LogIn, LogOut } from 'lucide-react';
import { CEREBRO_ESTRESADO_IMG } from './MascotGuide';
import { ImageWithFallback } from './ImageWithFallback';

export type AppSection = 'registro' | 'qr' | 'panel' | 'historial';

interface NavbarProps {
  activeSection: AppSection;
  onNavigate: (section: AppSection) => void;
  isAuthenticated: boolean;
  onAuthAction: () => void;
}

export function Navbar({
  activeSection,
  onNavigate,
  isAuthenticated,
  onAuthAction,
}: NavbarProps) {
  const navItems: { id: AppSection; label: string }[] = [
    { id: 'registro', label: 'Registro' },
    { id: 'qr', label: 'Código QR' },
    { id: 'panel', label: 'Panel' },
    { id: 'historial', label: 'Historial' },
  ];

  return (
    <header className="no-print sticky top-0 z-30 h-14 bg-white/95 backdrop-blur-md border-b border-[#E3D9F7]">
      <div className="max-w-6xl mx-auto h-full px-4 sm:px-6 flex items-center justify-between gap-8">
        {/* Zone 1: Single-line Brand Title */}
        <button
          type="button"
          onClick={() => onNavigate('registro')}
          className="inline-flex items-center gap-2.5 text-base sm:text-lg font-bold tracking-tight text-[#241B35] whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#5B3FD9] rounded-md"
        >
          <span className="w-8 h-8 rounded-full overflow-hidden border-2 border-[#D2C2F8] bg-[#FFF8E6] shrink-0">
            <ImageWithFallback
              src={CEREBRO_ESTRESADO_IMG}
              alt=""
              className="w-full h-full object-cover"
            />
          </span>
          <span>Mi Huella de Bienestar</span>
        </button>

        {/* Zone 2: Concise single-line navigation links */}
        <nav
          aria-label="Navegación principal"
          className="hidden md:flex items-center gap-6 text-sm font-medium text-[#5A4E73]"
        >
          {navItems.map((item) => {
            const isActive = activeSection === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onNavigate(item.id)}
                className={`py-1.5 border-b-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#5B3FD9] ${
                  isActive
                    ? 'text-[#5B3FD9] border-[#5B3FD9] font-semibold'
                    : 'border-transparent hover:text-[#241B35]'
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </nav>

        {/* Zone 3: Single primary action */}
        <div className="flex items-center shrink-0">
          <button
            type="button"
            onClick={onAuthAction}
            className={`inline-flex items-center gap-2 px-4 py-2 min-h-[40px] rounded-xl text-xs sm:text-sm font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#5B3FD9] ${
              isAuthenticated
                ? 'bg-[#EFEAFD] text-[#3E2A8A] hover:bg-[#E2D9FA]'
                : 'bg-[#5B3FD9] text-white hover:bg-[#4A30BF]'
            }`}
          >
            {isAuthenticated ? (
              <>
                <LogOut className="w-4 h-4 shrink-0" />
                <span>Cerrar sesión</span>
              </>
            ) : (
              <>
                <LogIn className="w-4 h-4 shrink-0" />
                <span>Acceso facilitadora</span>
              </>
            )}
          </button>
        </div>
      </div>
    </header>
  );
}
