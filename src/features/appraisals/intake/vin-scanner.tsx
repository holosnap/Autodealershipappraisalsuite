"use client";

import { useEffect, useRef, useState } from "react";
import { extractVin } from "@/lib/vin";

type Detector = { detect: (src: ImageBitmapSource) => Promise<{ rawValue: string }[]> };
const FORMATS = ["code_39", "code_128", "data_matrix", "qr_code", "pdf417"];

/** Native BarcodeDetector where available (Chrome/Android), otherwise a WASM ponyfill (iOS Safari, Firefox). */
async function createDetector(): Promise<Detector> {
  if ("BarcodeDetector" in window) {
    const Native = (window as unknown as { BarcodeDetector: new (o: object) => Detector }).BarcodeDetector;
    return new Native({ formats: FORMATS });
  }
  const { BarcodeDetector, setZXingModuleOverrides } = await import("barcode-detector/ponyfill");
  // Serve the decoder WASM from our own origin (bundled) rather than the library's default CDN, which
  // a dealership network may block and which would otherwise be a third-party dependency at runtime.
  const wasmUrl = new URL("zxing-wasm/reader/zxing_reader.wasm", import.meta.url).href;
  setZXingModuleOverrides({ locateFile: (path: string, prefix: string) => (path.endsWith(".wasm") ? wasmUrl : prefix + path) });
  return new BarcodeDetector({ formats: FORMATS as never }) as unknown as Detector;
}

export function VinScanner({ onDetect, onClose }: { onDetect: (vin: string) => void; onClose: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const detectorRef = useRef<Detector | null>(null);
  const [message, setMessage] = useState("Starting camera…");
  const [live, setLive] = useState(false);
  const doneRef = useRef(false);

  useEffect(() => {
    let stream: MediaStream | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let cancelled = false;

    async function start() {
      try {
        detectorRef.current = await createDetector();
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 } },
          audio: false,
        });
        if (cancelled) return stream.getTracks().forEach((t) => t.stop());
        const video = videoRef.current!;
        video.srcObject = stream;
        await video.play();
        setLive(true);
        setMessage("Point at the VIN barcode on the driver door jamb, or the dash plate.");

        const tick = async () => {
          if (cancelled || doneRef.current) return;
          try {
            for (const code of await detectorRef.current!.detect(video)) {
              const vin = extractVin(code.rawValue);
              if (vin) {
                doneRef.current = true;
                return onDetect(vin);
              }
            }
          } catch {
            // a failed frame is fine, try the next one
          }
          timer = setTimeout(tick, 250);
        };
        void tick();
      } catch {
        setMessage("Camera unavailable. Take a photo of the barcode instead, or type the VIN.");
      }
    }
    void start();
    return () => {
      cancelled = true;
      clearTimeout(timer);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [onDetect]);

  // Fallback / helper: decode a still photo (often more reliable than live video on phones).
  async function onPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setMessage("Reading barcode…");
    try {
      detectorRef.current ??= await createDetector();
      const bitmap = await createImageBitmap(file);
      for (const code of await detectorRef.current.detect(bitmap)) {
        const vin = extractVin(code.rawValue);
        if (vin) {
          doneRef.current = true;
          return onDetect(vin);
        }
      }
      setMessage("No VIN found in that photo. Get closer and try again, or type it in.");
    } catch {
      setMessage("Couldn't read that photo. Type the VIN instead.");
    }
  }

  return (
    <div role="dialog" aria-modal="true" aria-label="Scan VIN barcode" className="fixed inset-0 z-50 flex flex-col bg-black text-white">
      <div className="relative flex-1 overflow-hidden">
        <video ref={videoRef} playsInline muted className="h-full w-full object-cover" />
        {live && (
          <div className="pointer-events-none absolute inset-x-6 top-1/2 h-24 -translate-y-1/2 rounded-lg border-2 border-white/80" />
        )}
      </div>
      <div className="flex flex-col gap-3 p-4">
        <p aria-live="polite" className="text-center text-sm">{message}</p>
        <label className="flex h-12 cursor-pointer items-center justify-center rounded-lg border border-white/40 text-sm font-medium">
          Take a photo of the barcode
          <input type="file" accept="image/*" capture="environment" className="sr-only" onChange={onPhoto} />
        </label>
        <button type="button" onClick={onClose} className="h-12 rounded-lg bg-white font-medium text-black">
          Cancel
        </button>
      </div>
    </div>
  );
}
