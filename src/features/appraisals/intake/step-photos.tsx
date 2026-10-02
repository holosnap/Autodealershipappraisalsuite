/* eslint-disable @next/next/no-img-element -- photos are served by an authenticated route, not optimizable static assets */
"use client";

import { useState } from "react";
import { compressImage } from "@/lib/image-compress";
import { confirmPhotoUploadAction, deletePhotoAction, requestPhotoUploadAction } from "../actions";
import { MAX_DAMAGE_PHOTOS, photoSlots, type PhotoSlot } from "../photo-slots";
import type { PhotoRef } from "./types";

type Attempt = {
  tid: string;
  slot: PhotoSlot;
  status: "working" | "failed";
  error?: string;
  blob?: Blob;
  dims?: { width: number; height: number };
};

export function StepPhotos({
  appraisalId,
  photos,
  onPhotos,
}: {
  appraisalId: string;
  photos: PhotoRef[];
  onPhotos: (update: (prev: PhotoRef[]) => PhotoRef[]) => void;
}) {
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const patch = (tid: string, p: Partial<Attempt>) => setAttempts((a) => a.map((x) => (x.tid === tid ? { ...x, ...p } : x)));

  async function run(tid: string, slot: PhotoSlot, source: File | Attempt) {
    patch(tid, { status: "working", error: undefined });
    try {
      let blob: Blob | undefined;
      let dims: { width: number; height: number } | undefined;
      if (source instanceof File) {
        const c = await compressImage(source); // downscale + JPEG before it ever touches the network
        blob = c.blob;
        dims = { width: c.width, height: c.height };
        patch(tid, { blob, dims }); // kept so "Retry" doesn't need the original again
      } else {
        blob = source.blob;
        dims = source.dims;
      }
      const req = await requestPhotoUploadAction(appraisalId, { slot, contentType: "image/jpeg", sizeBytes: blob!.size });
      if (!req.ok) throw new Error(req.error);
      const put = await fetch(req.upload.url, { method: "PUT", headers: req.upload.headers, body: blob });
      if (!put.ok) throw new Error("Upload failed. Check your connection and retry.");
      const done = await confirmPhotoUploadAction(req.photoId, dims ?? {});
      if (!done.ok) throw new Error(done.error);

      const multiple = photoSlots.find((s) => s.slot === slot)?.multiple;
      onPhotos((prev) => [...(multiple ? prev : prev.filter((p) => p.slot !== slot)), { id: req.photoId, slot }]);
      setAttempts((a) => a.filter((x) => x.tid !== tid));
    } catch (e) {
      patch(tid, { status: "failed", error: e instanceof Error ? e.message : "Upload failed. Check your connection and retry." });
    }
  }

  function addFiles(slot: PhotoSlot, files: FileList | null) {
    if (!files) return;
    for (const file of Array.from(files)) {
      const tid = crypto.randomUUID();
      setAttempts((a) => [...a, { tid, slot, status: "working" }]);
      void run(tid, slot, file);
    }
  }

  async function remove(photo: PhotoRef) {
    const prev = photos;
    onPhotos((p) => p.filter((x) => x.id !== photo.id));
    const res = await deletePhotoAction(photo.id).catch(() => null);
    if (!res?.ok) onPhotos(() => prev); // couldn't delete: put it back
  }

  return (
    <div className="flex flex-col gap-4">
      {photoSlots.map((def) => {
        const mine = photos.filter((p) => p.slot === def.slot);
        const inFlight = attempts.filter((a) => a.slot === def.slot);
        const busy = inFlight.some((a) => a.status === "working");
        const full = def.multiple && mine.length >= MAX_DAMAGE_PHOTOS;
        const hasPhoto = mine.length > 0;

        return (
          <section key={def.slot} className="flex flex-col gap-3 rounded-xl border border-neutral-200 p-4 dark:border-neutral-800">
            <header className="flex items-start justify-between gap-2">
              <div>
                <h3 className="font-semibold">{def.label}</h3>
                <p className="text-sm text-neutral-500">{def.hint}</p>
              </div>
              <span
                className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
                  hasPhoto ? "bg-green-100 text-green-900" : def.required ? "bg-amber-100 text-amber-900" : "bg-neutral-100 text-neutral-600"
                }`}
              >
                {hasPhoto ? "Done" : def.required ? "Required" : "Optional"}
              </span>
            </header>

            {(hasPhoto || inFlight.length > 0) && (
              <ul className={def.multiple ? "grid grid-cols-3 gap-2" : ""}>
                {mine.map((p) => (
                  <li key={p.id} className="relative">
                    <img
                      src={`/api/photos/${p.id}`}
                      alt={`${def.label} photo`}
                      loading="lazy"
                      className={`w-full rounded-lg object-cover ${def.multiple ? "aspect-square" : "aspect-[4/3]"}`}
                    />
                    {def.multiple && (
                      <button
                        type="button"
                        aria-label="Remove photo"
                        onClick={() => void remove(p)}
                        className="absolute right-1 top-1 flex h-8 w-8 items-center justify-center rounded-full bg-black/70 text-white"
                      >
                        ×
                      </button>
                    )}
                  </li>
                ))}
                {inFlight.map((a) => (
                  <li key={a.tid} className={`flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-neutral-300 p-3 text-center text-sm ${def.multiple ? "aspect-square" : "aspect-[4/3]"}`}>
                    {a.status === "working" ? (
                      <span role="status">Uploading…</span>
                    ) : (
                      <>
                        <span role="alert" className="text-red-600">{a.error}</span>
                        <span className="flex gap-2">
                          {a.blob && (
                            <button type="button" onClick={() => void run(a.tid, a.slot, a)} className="h-10 rounded-lg bg-blue-600 px-3 font-medium text-white">
                              Retry
                            </button>
                          )}
                          <button type="button" onClick={() => setAttempts((x) => x.filter((y) => y.tid !== a.tid))} className="h-10 rounded-lg border px-3">
                            Dismiss
                          </button>
                        </span>
                      </>
                    )}
                  </li>
                ))}
              </ul>
            )}

            {!full && (
              <div className="grid grid-cols-[1fr_auto] gap-2">
                <label className={`flex h-12 cursor-pointer items-center justify-center rounded-lg font-medium ${busy ? "bg-neutral-300 text-neutral-600" : "bg-blue-600 text-white"}`}>
                  {hasPhoto && !def.multiple ? "Retake" : def.multiple && hasPhoto ? "Add another" : "Take photo"}
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    disabled={busy && !def.multiple}
                    className="sr-only"
                    onChange={(e) => {
                      addFiles(def.slot, e.target.files);
                      e.target.value = "";
                    }}
                  />
                </label>
                <label className="flex h-12 cursor-pointer items-center justify-center rounded-lg border border-neutral-300 px-4 text-sm dark:border-neutral-700">
                  Library
                  <input
                    type="file"
                    accept="image/*"
                    multiple={def.multiple}
                    disabled={busy && !def.multiple}
                    className="sr-only"
                    onChange={(e) => {
                      addFiles(def.slot, e.target.files);
                      e.target.value = "";
                    }}
                  />
                </label>
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
