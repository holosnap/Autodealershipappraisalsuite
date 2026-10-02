"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/session";
import { createAppraisal, decideAppraisal, ValidationError } from "./service";

export type FormState = { error?: string };

export async function createAppraisalAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  let id: string;
  try {
    id = (await createAppraisal(user, Object.fromEntries(formData))).id;
  } catch (e) {
    if (e instanceof ValidationError) return { error: e.message };
    throw e;
  }
  revalidatePath("/appraisals");
  redirect(`/appraisals/${id}`);
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
