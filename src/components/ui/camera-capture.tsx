import { useRef, useState, useCallback } from 'react';
import Webcam from 'react-webcam';
import { Camera, X, RefreshCw } from 'lucide-react';
import { Button } from './button';

interface CameraCaptureProps {
  onCapture: (imageSrc: string) => void;
  onCancel: () => void;
}

export function CameraCapture({ onCapture, onCancel }: CameraCaptureProps) {
  const webcamRef = useRef<Webcam>(null);
  const [imageSrc, setImageSrc] = useState<string | null>(null);

  const capture = useCallback(() => {
    if (webcamRef.current) {
      const imageSrc = webcamRef.current.getScreenshot();
      if (imageSrc) {
        setImageSrc(imageSrc);
      }
    }
  }, [webcamRef]);

  const handleRetake = () => {
    setImageSrc(null);
  };

  const handleConfirm = () => {
    if (imageSrc) {
      onCapture(imageSrc);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center space-y-4 p-4 bg-slate-50 border border-slate-200 rounded-xl w-full max-w-sm mx-auto">
      <div className="relative w-full aspect-square bg-slate-900 rounded-lg overflow-hidden flex items-center justify-center">
        {imageSrc ? (
          <img src={imageSrc} alt="Captured" className="w-full h-full object-cover" />
        ) : (
          <Webcam
            audio={false}
            ref={webcamRef}
            screenshotFormat="image/jpeg"
            videoConstraints={{
              width: 320,
              height: 320,
              facingMode: "user"
            }}
            className="w-full h-full object-cover"
          />
        )}
      </div>
      
      <div className="flex gap-2 w-full">
        {imageSrc ? (
          <>
            <Button variant="outline" className="flex-1" onClick={handleRetake}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Retake
            </Button>
            <Button className="flex-1 bg-teal-600 hover:bg-teal-700" onClick={handleConfirm}>
              <Camera className="w-4 h-4 mr-2" />
              Confirm
            </Button>
          </>
        ) : (
          <>
            <Button variant="outline" className="flex-1" onClick={onCancel}>
              <X className="w-4 h-4 mr-2" />
              Cancel
            </Button>
            <Button className="flex-1 bg-teal-600 hover:bg-teal-700" onClick={capture}>
              <Camera className="w-4 h-4 mr-2" />
              Capture
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
