import React, { useRef, useState, useCallback } from 'react';
import { Camera, X, Check } from 'lucide-react';

interface CameraViewProps {
  onCapture: (image: string) => void;
  onClose: () => void;
}

export const CameraView: React.FC<CameraViewProps> = ({ onCapture, onClose }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isReady, setIsReady] = useState(false);

  const startCamera = useCallback(async () => {
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      setStream(s);
      if (videoRef.current) {
        videoRef.current.srcObject = s;
      }
      setIsReady(true);
    } catch (err) {
      console.error("Error accessing camera:", err);
    }
  }, []);

  React.useEffect(() => {
    startCamera();
    return () => {
      stream?.getTracks().forEach(track => track.stop());
    };
  }, []);

  const capture = () => {
    if (!videoRef.current) return;
    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(videoRef.current, 0, 0);
      onCapture(canvas.toDataURL('image/jpeg'));
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center"
      style={{ background: 'radial-gradient(ellipse at center, #1a120a 0%, #050302 100%)' }}
    >
      <div className="relative w-full max-w-2xl aspect-[3/4] overflow-hidden rounded-xl"
        style={{
          background: '#0a0604',
          boxShadow: '0 16px 48px rgba(0,0,0,0.6), inset 0 0 0 1px rgba(196,112,75,0.1)',
        }}
      >
        <video
          ref={videoRef}
          autoPlay
          playsInline
          className="w-full h-full object-cover"
        />

        <div className="absolute bottom-8 left-0 right-0 flex justify-center items-center gap-8 px-4">
          <button
            onClick={onClose}
            className="p-4 rounded-full transition-all active:scale-95"
            style={{ background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.6)' }}
          >
            <X size={28} />
          </button>

          <button
            onClick={capture}
            className="p-5 rounded-full transition-all active:scale-90"
            style={{
              background: 'linear-gradient(135deg, #faf5eb 0%, #e8d5b8 100%)',
              color: '#2c1810',
              boxShadow: '0 4px 20px rgba(232,213,184,0.3), inset 0 1px 0 rgba(255,255,255,0.5)',
            }}
          >
            <Camera size={36} />
          </button>
        </div>
      </div>
      <p className="mt-5 font-serif italic text-sm tracking-wide" style={{ color: 'rgba(232,213,184,0.4)' }}>
        Capture a material for your collage
      </p>
    </div>
  );
};
