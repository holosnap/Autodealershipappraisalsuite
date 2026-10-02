"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/session";
import { decodeVin, type DecodedVin } from "@/lib/vin-decode";
import { normalizeVin } from "@/lib/vin";
import {
  ForbiddenError,
  NotFoundError,
  ValidationError,
  confirmPhotoUpload,
  createDraft,
  decideAppraisal,
  deletePhoto,
  discardDraft,
  requestPhotoUpload,
  saveDraft,
  submitAppraisal,
  type DraftStep,
} from "./service";

export type FormState = { error?: string };
export type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string; missing?: string[] };

/** Turns expected failures into values the client can show; unexpected ones still throw. */
async function run<T extends object>(fn: (user: Awaited<ReturnType<typeof requireUser>>) => Promise<T>): Promise<Result<T>> {
  const user = await requireUser();
  try {
    return { ok: true, ...(await fn(user)) };
  } catch (e) {
    if (e instanceof ValidationError) return { ok: false, error: e.message, missing: e.missing };
    if (e instanceof NotFoundError) return { ok: false, error: "Appraisal not found" };
    if (e instanceof ForbiddenError) return { ok: false, error: "You don't have permission to do that" };
    throw e;
  }
}

export async function decodeVinAction(vin: string): Promise<DecodedVin | null> {
  await requireUser();
  return decodeVin(normalizeVin(vin));
}

export async function createDraftAction(input: unknown) {
  return run(async (user) => ({ id: (await createDraft(user, input)).id }));
}

export async function saveDraftAction(id: string, step: DraftStep, data: unknown, stepNumber: number) {
  return run((user) => saveDraft(user, id, step, data, stepNumber));
}

export async function requestPhotoUploadAction(id: string, input: unknown) {
  return run((user) => requestPhotoUpload(user, id, input));
}

export async function confirmPhotoUploadAction(photoId: string, dims: { width?: number; height?: number }) {
  return run((user) => confirmPhotoUpload(user, photoId, dims));
}

export async function deletePhotoAction(photoId: string) {
  return run(async (user) => (await deletePhoto(user, photoId), {}));
}

export async function submitAppraisalAction(id: string) {
  return run(async (user) => {
    await submitAppraisal(user, id);
    revalidatePath("/appraisals");
    return {};
  });
}

export async function discardDraftAction(id: string) {
  return run(async (user) => {
    await discardDraft(user, id);
    revalidatePath("/appraisals");
    return {};
  });
}

export async function decideAppraisalAction(id: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  try {
    await decideAppraisal(user, id, Object.fromEntries(formData));
  } catch (e) {
    if (e instanceof ValidationError) return { error: e.message };
    throw e;
  }
  revalidatePath(`/appraisals/${id}`);
  revalidatePath("/appraisals");
  return {};
}
