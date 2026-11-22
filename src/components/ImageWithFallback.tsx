import { useState } from 'react';
import { HeartHandshake } from 'lucide-react';

interface ImageWithFallbackProps {
  src: string;
  alt: string;
  className?: string;
  fallbackTitle?: string;
}

export function ImageWithFallback({
  src,
  alt,
  className = '',
  fallbackTitle = 'Mi Huella de Bienestar',
}: ImageWithFallbackProps) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <div
        role="img"
        aria-label={alt}
        className={`flex flex-col items-center justify-center bg-gradient-to-br from-[#EFEAFD] via-[#FAF8F5] to-[#E6F7F0] text-[#4C3A78] p-6 text-center ${className}`}
      >
        <HeartHandshake className="w-10 h-10 mb-2 text-[#5B3FD9]" />
        <span className="text-sm font-medium">{fallbackTitle}</span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={className}
    />
  );
}
