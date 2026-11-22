import { useEffect, useState } from 'react';
import { Check, Copy, Download, ExternalLink, Printer, QrCode } from 'lucide-react';
import QRCode from 'qrcode';
import { fetchPublicInfo, fetchQrDataUrl } from '../api';
import { getPublicWorkshopConfig } from '../services/firestoreAttendance';
import { ImageWithFallback } from './ImageWithFallback';
import { CEREBRO_ZEN_IMG } from './MascotGuide';

export function QrShareView({ onGoToForm }: { onGoToForm: () => void }) {
  const defaultOrigin =
    typeof window !== 'undefined' ? `${window.location.origin}/?registro=1` : '';

  const [targetUrl, setTargetUrl] = useState(defaultOrigin);
  const [suggestedPublicUrl, setSuggestedPublicUrl] = useState<string | null>(null);
  const [activeJornada, setActiveJornada] = useState<string>('');
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const [cloudConfig, info] = await Promise.all([
          getPublicWorkshopConfig().catch(() => null),
          fetchPublicInfo().catch(() => null),
        ]);

        if (cloudConfig?.activeJornada) {
          setActiveJornada(cloudConfig.activeJornada);
        } else if (info?.config?.activeJornada) {
          setActiveJornada(info.config.activeJornada);
        }

        if (info?.publicAppUrl) {
          const cleanPublic = `${info.publicAppUrl.replace(/\/$/, '')}/?registro=1`;
          setSuggestedPublicUrl(cleanPublic);
        }
      } catch {
        // Non-blocking
      }
    })();
  }, []);

  useEffect(() => {
    if (!targetUrl) return;
    let active = true;
    setLoading(true);
    setError(null);

    void (async () => {
      try {
        try {
          const res = await fetchQrDataUrl(targetUrl);
          if (active) {
            setQrDataUrl(res.dataUrl);
            return;
          }
        } catch {
          // Fallback to client-side QR generation
        }

        const localDataUrl = await QRCode.toDataURL(targetUrl, {
          width: 480,
          margin: 2,
          color: { dark: '#241B35', light: '#FFFFFF' },
        });
        if (active) {
          setQrDataUrl(localDataUrl);
        }
      } catch (err) {
        if (active) {
          setError(err instanceof Error ? err.message : 'No se pudo generar el QR.');
        }
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [targetUrl]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(targetUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard fallback ignored
    }
  };

  const handleDownloadPlainPng = () => {
    if (!qrDataUrl) return;
    const link = document.createElement('a');
    link.href = qrDataUrl;
    link.download = 'QR_MI_HUELLA_DE_BIENESTAR.png';
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  const handleDownloadPosterPng = async () => {
    if (!qrDataUrl) return;
    const canvas = document.createElement('canvas');
    canvas.width = 900;
    canvas.height = 1220;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = '#F6F2FF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const grad = ctx.createLinearGradient(0, 0, canvas.width, 0);
    grad.addColorStop(0, '#522FD6');
    grad.addColorStop(1, '#7C4DFF');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, canvas.width, 210);

    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 42px Outfit, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('MI HUELLA DE BIENESTAR', canvas.width / 2, 95);

    ctx.fillStyle = '#FDE68A';
    ctx.font = '600 24px Plus Jakarta Sans, system-ui, sans-serif';
    ctx.fillText('Jornada de Evaluación · Trabajo Social V Ciclo', canvas.width / 2, 146);

    ctx.fillStyle = '#FFFFFF';
    ctx.strokeStyle = '#D5C5FB';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.roundRect(80, 245, 740, 815, 36);
    ctx.fill();
    ctx.stroke();

    const qrImg = new Image();
    qrImg.crossOrigin = 'anonymous';
    await new Promise<void>((resolve, reject) => {
      qrImg.onload = () => resolve();
      qrImg.onerror = () => reject(new Error('QR load failed'));
      qrImg.src = qrDataUrl;
    });

    try {
      const brainImg = new Image();
      brainImg.crossOrigin = 'anonymous';
      await new Promise<void>((resolve, reject) => {
        brainImg.onload = () => resolve();
        brainImg.onerror = () => reject(new Error('Mascot load failed'));
        brainImg.src = CEREBRO_ZEN_IMG;
      });

      ctx.save();
      ctx.beginPath();
      ctx.arc(450, 325, 66, 0, Math.PI * 2);
      ctx.closePath();
      ctx.clip();
      ctx.drawImage(brainImg, 384, 259, 132, 132);
      ctx.restore();

      ctx.strokeStyle = '#8FE0BA';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.arc(450, 325, 66, 0, Math.PI * 2);
      ctx.stroke();
    } catch {
      // Proceed cleanly
    }

    ctx.drawImage(qrImg, (canvas.width - 440) / 2, 415, 440, 440);

    ctx.fillStyle = '#241B35';
    ctx.font = 'bold 30px Outfit, system-ui, sans-serif';
    ctx.fillText('Escanea para registrar tu asistencia', canvas.width / 2, 910);

    ctx.fillStyle = '#5A4E73';
    ctx.font = '500 22px Plus Jakarta Sans, system-ui, sans-serif';
    const sessionLine = activeJornada
      ? activeJornada.slice(0, 56)
      : 'De la mochila a las herramientas';
    ctx.fillText(sessionLine, canvas.width / 2, 956);

    ctx.fillStyle = '#0F7A53';
    ctx.font = '600 20px Plus Jakarta Sans, system-ui, sans-serif';
    ctx.fillText('¡Suelta el estrés y deja tu huella! · Sin instalar apps', canvas.width / 2, 1006);

    ctx.fillStyle = '#6B5F84';
    ctx.font = '400 18px JetBrains Mono, monospace';
    ctx.fillText(targetUrl.slice(0, 68), canvas.width / 2, 1135);

    const pngUrl = canvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.href = pngUrl;
    link.download = 'TARJETA_QR_MI_HUELLA_DE_BIENESTAR.png';
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  return (
    <section className="bg-gradient-to-b from-[#EDE4FF] via-[#FAF8F5] to-[#E6FAF0] py-6 sm:py-10 min-h-[calc(100vh-8rem)]">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left: Printable & Shareable QR Card */}
        <div className="lg:col-span-5 bg-white rounded-[2rem] border-2 border-[#DECFFA] overflow-hidden flex flex-col items-center text-center shadow-[0_18px_40px_-14px_rgba(91,63,217,0.2)]">
          <div className="w-full bg-gradient-to-r from-[#522FD6] to-[#7C4DFF] px-6 py-5 text-white flex items-center justify-center gap-3.5">
            <div className="w-14 h-14 rounded-2xl overflow-hidden border-2 border-[#8FE0BA] bg-[#E8FBF1] shrink-0">
              <ImageWithFallback
                src={CEREBRO_ZEN_IMG}
                alt="Cerebrín en calma"
                className="w-full h-full object-cover"
              />
            </div>
            <div className="text-left">
              <p className="text-xs font-semibold text-[#FDE68A]">Trabajo Social · V Ciclo</p>
              <p className="text-lg font-bold">Mi Huella de Bienestar</p>
            </div>
          </div>

          <div className="p-6 sm:p-8 flex flex-col items-center w-full">
            <div className="w-full max-w-[290px] aspect-square rounded-3xl bg-[#F8F5FF] border-2 border-[#DFD4FA] p-4 flex items-center justify-center">
              {loading ? (
                <div className="text-sm text-[#6B5F84]">Generando código QR...</div>
              ) : error ? (
                <div className="text-sm text-[#B42318]">{error}</div>
              ) : (
                <img
                  src={qrDataUrl}
                  alt="Código QR para registrar asistencia en Mi Huella de Bienestar"
                  className="w-full h-full object-contain rounded-xl"
                />
              )}
            </div>

            <h2 className="text-lg font-bold text-[#241B35] mt-5">
              Escanea para registrar tu asistencia
            </h2>
            {activeJornada && (
              <p className="text-xs font-medium text-[#5A4E73] mt-1">{activeJornada}</p>
            )}
            <p className="text-xs text-[#0F7A53] font-semibold mt-2">
              ¡Suelta el estrés y deja tu huella! · Sin instalar aplicaciones
            </p>
          </div>
        </div>

        {/* Right: Configuration & Export Actions */}
        <div className="lg:col-span-7 bg-white rounded-[2rem] border-2 border-[#DECFFA] p-6 sm:p-8 space-y-6 no-print shadow-[0_14px_34px_-12px_rgba(91,63,217,0.14)]">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 text-xs font-semibold text-[#6D4AFF]">
              <QrCode className="w-4 h-4" />
              <span>Acceso público mediante QR</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-[#241B35] text-balance">
              Comparte la tarjeta QR de Cerebrín
            </h1>
            <p className="text-sm text-[#5A4E73] leading-relaxed">
              Descarga el código QR o la tarjeta ilustrada en formato PNG para enviarla por WhatsApp, imprimirla o proyectarla al iniciar la jornada. Todos los celulares registran al mismo tiempo en la nube.
            </p>
          </div>

          <div className="space-y-2">
            <label htmlFor="qr-url" className="block text-sm font-semibold text-[#241B35]">
              Dirección web pública del formulario
            </label>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                id="qr-url"
                type="url"
                value={targetUrl}
                onChange={(e) => setTargetUrl(e.target.value)}
                className="flex-1 min-h-[48px] px-4 py-2.5 rounded-xl bg-[#FAF8FC] border border-[#DCD4ED] text-sm font-mono text-[#241B35] focus:outline-none focus:ring-2 focus:ring-[#5B3FD9]"
              />
              <button
                type="button"
                onClick={() => void handleCopy()}
                className="min-h-[48px] px-4 py-2.5 rounded-xl bg-[#EFEAFD] text-[#3E2A8A] font-semibold text-sm inline-flex items-center justify-center gap-2 hover:bg-[#E2D9FA] transition-colors shrink-0 cursor-pointer"
              >
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                <span>{copied ? 'Copiado' : 'Copiar enlace'}</span>
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => setTargetUrl(defaultOrigin)}
                className="text-xs font-medium text-[#5B3FD9] hover:underline cursor-pointer"
              >
                Usar dirección actual
              </button>
              {suggestedPublicUrl && suggestedPublicUrl !== targetUrl && (
                <>
                  <span className="text-xs text-[#9C90B8]">·</span>
                  <button
                    type="button"
                    onClick={() => setTargetUrl(suggestedPublicUrl)}
                    className="text-xs font-medium text-[#0F7A53] hover:underline cursor-pointer"
                  >
                    Usar enlace público publicado
                  </button>
                </>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
            <button
              type="button"
              onClick={handleDownloadPlainPng}
              disabled={loading || !qrDataUrl}
              className="min-h-[50px] px-5 py-3 rounded-xl bg-[#5B3FD9] hover:bg-[#4A30BF] disabled:opacity-60 text-white font-semibold text-sm inline-flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              <Download className="w-4 h-4 shrink-0" />
              <span>Descargar QR (PNG)</span>
            </button>

            <button
              type="button"
              onClick={() => void handleDownloadPosterPng()}
              disabled={loading || !qrDataUrl}
              className="min-h-[50px] px-5 py-3 rounded-xl bg-[#E6FAEF] hover:bg-[#D1F4E3] disabled:opacity-60 text-[#0F533B] font-semibold text-sm inline-flex items-center justify-center gap-2 transition-colors cursor-pointer border border-[#A7E8CB]"
            >
              <Download className="w-4 h-4 shrink-0" />
              <span>Descargar tarjeta ilustrada (PNG)</span>
            </button>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-[#F0EBF8]">
            <button
              type="button"
              onClick={() => window.print()}
              className="min-h-[44px] px-4 py-2 rounded-xl border border-[#DCD4ED] text-[#3D2E61] text-sm font-medium inline-flex items-center gap-2 hover:bg-[#FAF8FC] transition-colors cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>Imprimir o proyectar tarjeta</span>
            </button>

            <button
              type="button"
              onClick={onGoToForm}
              className="min-h-[44px] px-4 py-2 text-sm font-semibold text-[#5B3FD9] inline-flex items-center gap-1.5 hover:underline cursor-pointer"
            >
              <span>Abrir formulario de registro</span>
              <ExternalLink className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
