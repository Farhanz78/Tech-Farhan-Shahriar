
'use client';

import { useState, useCallback } from 'react';
import Cropper from 'react-easy-crop';
import type { Area } from 'react-easy-crop';
import * as icons from 'lucide-react';

export default function ImageCropper({
  imageSrc,
  aspect,
  onCropDone,
  onCancel,
}: {
  imageSrc: string;
  aspect: number;
  onCropDone: (croppedFile: File) => void;
  onCancel: () => void;
}) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [busy, setBusy] = useState(false);

  const onCropComplete = useCallback((_croppedArea: Area, croppedAreaPixels: Area) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  async function handleSave() {
    if (!croppedAreaPixels) return;
    setBusy(true);
    try {
      const croppedBlob = await getCroppedImg(imageSrc, croppedAreaPixels);
      if (croppedBlob) {
        const file = new File([croppedBlob], 'cropped.jpg', { type: 'image/jpeg' });
        onCropDone(file);
      }
    } catch (e) {
      console.error(e);
    }
    setBusy(false);
  }

  return (
    <div className="fixed inset-0 z-[200] grid place-items-center p-4 bg-ink/90">
      <div className="relative w-full max-w-2xl bg-surface border border-hairline rounded-2xl overflow-hidden flex flex-col shadow-2xl">
        <div className="p-4 border-b border-hairline flex items-center justify-between bg-surface-2">
          <h3 className="font-semibold">Crop Image</h3>
          <button onClick={onCancel} className="p-1.5 rounded-lg hover:bg-surface-3 transition-colors text-subtle hover:text-text">
            <icons.X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="relative w-full h-[60vh] bg-ink">
          <Cropper
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            aspect={aspect}
            onCropChange={setCrop}
            onCropComplete={onCropComplete}
            onZoomChange={setZoom}
          />
        </div>

        <div className="p-4 bg-surface-2 border-t border-hairline flex flex-col sm:flex-row items-center gap-4 justify-between">
          <div className="flex items-center gap-3 w-full sm:w-1/2">
            <icons.ZoomOut className="w-4 h-4 text-subtle shrink-0" />
            <input
              type="range"
              value={zoom}
              min={1}
              max={3}
              step={0.1}
              aria-label="Zoom"
              onChange={(e) => setZoom(Number(e.target.value))}
              className="flex-1 accent-lime"
            />
            <icons.ZoomIn className="w-4 h-4 text-subtle shrink-0" />
          </div>
          
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              onClick={onCancel}
              disabled={busy}
              className="flex-1 sm:flex-none px-4 py-2 text-sm rounded-lg border border-hairline hover:bg-surface-3 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={busy}
              className="flex-1 sm:flex-none px-4 py-2 text-sm rounded-lg bg-lime text-ink font-semibold hover:bg-lime-dim transition-colors"
            >
              {busy ? 'Cropping...' : 'Crop & Save'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

async function getCroppedImg(
  imageSrc: string,
  pixelCrop: Area,
  rotation = 0,
  flip = { horizontal: false, vertical: false }
): Promise<Blob | null> {
  const image = await createImage(imageSrc);
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  if (!ctx) return null;

  canvas.width = image.width;
  canvas.height = image.height;
  ctx.translate(image.width / 2, image.height / 2);
  ctx.rotate((rotation * Math.PI) / 180);
  ctx.scale(flip.horizontal ? -1 : 1, flip.vertical ? -1 : 1);
  ctx.translate(-image.width / 2, -image.height / 2);
  ctx.drawImage(image, 0, 0);

  const croppedCanvas = document.createElement('canvas');
  const croppedCtx = croppedCanvas.getContext('2d');

  if (!croppedCtx) return null;

  croppedCanvas.width = pixelCrop.width;
  croppedCanvas.height = pixelCrop.height;

  croppedCtx.drawImage(
    canvas,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    pixelCrop.width,
    pixelCrop.height
  );

  return new Promise((resolve) => {
    croppedCanvas.toBlob((file) => resolve(file), 'image/jpeg', 0.9);
  });
}

function createImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener('load', () => resolve(image));
    image.addEventListener('error', (error) => reject(error));
    image.setAttribute('crossOrigin', 'anonymous');
    image.src = url;
  });
}
