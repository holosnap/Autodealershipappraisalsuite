"use client";

import { useCallback, useRef, useState } from "react";
import { decodeVinAction } from "../actions";
import { isValidVin, normalizeVin } from "@/lib/vin";
import type { VehicleForm } from "./types";
import { Field, inputCls } from "./ui";
import { VinScanner } from "./vin-scanner";

type Patch = Partial<VehicleForm> | ((current: VehicleForm) => Partial<VehicleForm>);

export function StepVehicle({ value, onChange }: { value: VehicleForm; onChange: (patch: Patch) => void }) {
  const [scanning, setScanning] = useState(false);
  const [decoding, setDecoding] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const decodedFor = useRef<string | null>(null);

  const decode = useCallback(
    async (vin: string) => {
      if (decodedFor.current === vin) return;
      decodedFor.current = vin;
      setDecoding(true);
      setNote(null);
      try {
        const d = await decodeVinAction(vin);
        if (!d) return setNote("Couldn't look up that VIN. Enter year, make and model by hand.");
        // evaluated against the latest form state, and only fills blanks, so manual edits are never overwritten
        onChange((cur) => ({
          year: cur.year || (d.year ? String(d.year) : ""),
          make: cur.make || d.make || "",
          model: cur.model || d.model || "",
          trim: cur.trim || d.trim || "",
        }));
      } catch {
        setNote("Couldn't look up that VIN. Enter year, make and model by hand.");
      } finally {
        setDecoding(false);
      }
    },
    [onChange],
  );

  function onVinChange(raw: string) {
    const vin = normalizeVin(raw).slice(0, 17);
    onChange({ vin });
    if (isValidVin(vin)) void decode(vin);
  }

  const onScan = useCallback(
    (vin: string) => {
      setScanning(false);
      onVinChange(vin);
    },
    // onChange is stable in practice (reads refs / functional setState), and the scanner must not restart on re-render
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const vinInvalid = value.vin.length > 0 && !isValidVin(value.vin);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Field label="VIN" hint={vinInvalid ? "17 characters, letters and digits (no I, O or Q)" : undefined}>
          <input
            value={value.vin}
            onChange={(e) => onVinChange(e.target.value)}
            maxLength={17}
            autoCapitalize="characters"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            aria-invalid={vinInvalid}
            className={`${inputCls} font-mono uppercase tracking-wide`}
          />
        </Field>
        <button
          type="button"
          onClick={() => setScanning(true)}
          className="h-12 rounded-lg border border-blue-600 font-medium text-blue-600"
        >
          Scan VIN barcode
        </button>
        {decoding && <p className="text-sm text-neutral-500">Looking up vehicle…</p>}
        {note && <p className="text-sm text-amber-700">{note}</p>}
      </div>

      <Field label="Odometer (miles)">
        <input
          value={value.odometer}
          onChange={(e) => onChange({ odometer: e.target.value.replace(/\D/g, "") })}
          inputMode="numeric"
          pattern="[0-9]*"
          className={inputCls}
        />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Year">
          <input value={value.year} onChange={(e) => onChange({ year: e.target.value.replace(/\D/g, "").slice(0, 4) })} inputMode="numeric" className={inputCls} />
        </Field>
        <Field label="Make">
          <input value={value.make} onChange={(e) => onChange({ make: e.target.value })} className={inputCls} />
        </Field>
        <Field label="Model">
          <input value={value.model} onChange={(e) => onChange({ model: e.target.value })} className={inputCls} />
        </Field>
        <Field label="Trim">
          <input value={value.trim} onChange={(e) => onChange({ trim: e.target.value })} className={inputCls} />
        </Field>
      </div>

      {scanning && <VinScanner onDetect={onScan} onClose={() => setScanning(false)} />}
    </div>
  );
}
