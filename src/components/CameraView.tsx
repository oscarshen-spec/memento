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
    <div className="fixed inset-0 z-50 bg-black flex flex-col items-center justify-center">
      <div className="relative w-full max-w-2xl aspect-[3/4] bg-neutral-900 overflow-hidden rounded-lg shadow-2xl">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          className="w-full h-full object-cover"
        />
        
        <div className="absolute bottom-8 left-0 right-0 flex justify-center gap-8 px-4">
          <button
            onClick={onClose}
            className="p-4 bg-white/10 hover:bg-white/20 rounded-full text-white backdrop-blur-md transition-all"
          >
            <X size={32} />
          </button>
          
          <button
            onClick={capture}
            className="p-6 bg-white hover:bg-neutral-100 rounded-full text-black shadow-xl transition-all active:scale-95"
          >
            <Camera size={40} />
          </button>
        </div>
      </div>
      <p className="mt-6 text-white/60 font-medium tracking-widest uppercase text-xs">
        Capture a material for your collage
      </p>
    </div>
  );
};
