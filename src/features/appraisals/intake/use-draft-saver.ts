"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { saveDraftAction } from "../actions";
import type { DraftStep } from "../service";

export type SaveStatus = "saved" | "saving" | "retrying" | "error";
type Pending = Partial<Record<DraftStep, unknown>>;

const mirrorKey = (id: string) => `appraisal-draft:${id}`;
const RETRY_MS = 4000;

/**
 * Debounced, ordered autosave for the intake wizard.
 *  - Saves are serialized so an older request can never overwrite a newer one.
 *  - Unsaved changes are mirrored to localStorage, so a locked phone / killed tab / dead network
 *    loses nothing: the mirror is re-applied and re-sent the next time the draft opens.
 *  - Network failures retry forever; server-side validation failures surface once and wait for the next edit.
 */
export function useDraftSaver(appraisalId: string) {
  const [status, setStatus] = useState<SaveStatus>("saved");
  const [error, setError] = useState<string | null>(null);
  const pending = useRef<Pending>({});
  const stepNo = useRef(1);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const chain = useRef<Promise<void>>(Promise.resolve());
  const retry = useRef<() => void>(() => {});

  const writeMirror = useCallback(() => {
    try {
      const p = pending.current;
      if (Object.keys(p).length === 0) localStorage.removeItem(mirrorKey(appraisalId));
      else localStorage.setItem(mirrorKey(appraisalId), JSON.stringify({ at: Date.now(), step: stepNo.current, pending: p }));
    } catch {
      // storage unavailable (private mode / quota): server autosave still works
    }
  }, [appraisalId]);

  const flush = useCallback((): Promise<void> => {
    clearTimeout(timer.current);
    chain.current = chain.current.then(async () => {
      while (Object.keys(pending.current).length > 0) {
        const [step, data] = Object.entries(pending.current)[0] as [DraftStep, unknown];
        setStatus("saving");
        let res;
        try {
          res = await saveDraftAction(appraisalId, step, data, stepNo.current);
        } catch {
          setStatus("retrying"); // offline / server hiccup: keep the data, try again shortly
          timer.current = setTimeout(() => retry.current(), RETRY_MS);
          return;
        }
        if (pending.current[step] === data) delete pending.current[step]; // else edited meanwhile: resend newer value
        writeMirror();
        if (!res.ok) {
          setError(res.error);
          setStatus("error");
          return;
        }
        setError(null);
      }
      setStatus("saved");
    });
    return chain.current;
  }, [appraisalId, writeMirror]);

  useEffect(() => {
    retry.current = () => void flush();
  }, [flush]);

  const schedule = useCallback(
    (step: DraftStep, data: unknown, stepNumber: number) => {
      pending.current[step] = data;
      stepNo.current = stepNumber;
      setStatus("saving");
      writeMirror();
      clearTimeout(timer.current);
      timer.current = setTimeout(() => void flush(), 700);
    },
    [flush, writeMirror],
  );

  /** Re-queue anything left unsaved by a previous session. Returns it so the UI can show it. */
  const restore = useCallback((): { step: number; pending: Pending } | null => {
    try {
      const raw = localStorage.getItem(mirrorKey(appraisalId));
      if (!raw) return null;
      const m = JSON.parse(raw) as { step: number; pending: Pending };
      if (!m.pending || Object.keys(m.pending).length === 0) return null;
      pending.current = { ...m.pending };
      stepNo.current = m.step;
      void flush();
      return m;
    } catch {
      return null;
    }
  }, [appraisalId, flush]);

  // Save immediately when the page is hidden (phone locked, app switched, tab closed).
  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === "hidden" && Object.keys(pending.current).length > 0) void flush();
    };
    const onPageHide = () => void flush();
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", onPageHide);
    window.addEventListener("online", onPageHide);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", onPageHide);
      window.removeEventListener("online", onPageHide);
    };
  }, [flush]);

  const clearMirror = useCallback(() => {
    pending.current = {};
    try {
      localStorage.removeItem(mirrorKey(appraisalId));
    } catch {}
  }, [appraisalId]);

  return { status, error, schedule, flush, restore, clearMirror };
}
