"use client";

// Sprint 4 - Google Picker boton.
//
// Carga dinamica del API Picker de Google (script externo). Cuando el usuario
// selecciona una Sheet, llamamos a getAccessTokenForPickerAction para obtener
// el access_token y a suggestMappingAction para inferir mapping inicial. Luego
// connectSheetAction la persiste.

import { useEffect, useState, useTransition } from "react";
import { Loader2, FileSpreadsheet, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { connectSheetAction, suggestMappingAction } from "@/lib/integrations/sheets/actions";
import { getPickerAccessTokenAction, getAppClientIdForPickerAction } from "./picker-actions";

interface PickerDocument {
  id: string;
  name: string;
}

interface PickerCallback {
  action: string;
  docs?: PickerDocument[];
}

declare global {
  interface Window {
    gapi?: {
      load: (libs: string, cb: () => void) => void;
    };
    google?: {
      picker?: {
        PickerBuilder: new () => GooglePickerBuilder;
        ViewId: { SPREADSHEETS: string };
        Action: { PICKED: string; CANCEL: string };
        Feature: { MULTISELECT_ENABLED: string };
      };
    };
  }
}

interface GooglePickerBuilder {
  addView(viewId: string): GooglePickerBuilder;
  setOAuthToken(token: string): GooglePickerBuilder;
  setDeveloperKey(key: string): GooglePickerBuilder;
  setAppId(appId: string): GooglePickerBuilder;
  setCallback(cb: (data: PickerCallback) => void): GooglePickerBuilder;
  setTitle(title: string): GooglePickerBuilder;
  enableFeature(feature: string): GooglePickerBuilder;
  build(): { setVisible(v: boolean): void };
}

const GAPI_SRC = "https://apis.google.com/js/api.js";

export function GooglePickerButton({ disabled }: { disabled?: boolean }) {
  const [scriptReady, setScriptReady] = useState(false);
  const [pickerReady, setPickerReady] = useState(false);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (typeof window === "undefined") return;
    let cancelled = false;

    const markReady = () => {
      if (!cancelled) setScriptReady(true);
    };

    if (window.gapi) {
      // Async to avoid set-state-in-effect rule
      Promise.resolve().then(markReady);
      return () => {
        cancelled = true;
      };
    }
    const existing = document.querySelector(`script[src="${GAPI_SRC}"]`);
    if (existing) {
      existing.addEventListener("load", markReady);
      return () => {
        cancelled = true;
        existing.removeEventListener("load", markReady);
      };
    }
    const s = document.createElement("script");
    s.src = GAPI_SRC;
    s.async = true;
    s.defer = true;
    s.onload = markReady;
    document.body.appendChild(s);
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!scriptReady || pickerReady) return;
    if (!window.gapi) return;
    let cancelled = false;
    window.gapi.load("picker", () => {
      if (!cancelled) setPickerReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, [scriptReady, pickerReady]);

  const openPicker = () => {
    if (!pickerReady || !window.google?.picker) {
      toast({ variant: "error", description: "Picker no listo aún, reintenta en un momento." });
      return;
    }
    startTransition(async () => {
      const [tokenRes, appIdRes] = await Promise.all([
        getPickerAccessTokenAction(),
        getAppClientIdForPickerAction(),
      ]);
      if (!tokenRes.ok) {
        toast({
          variant: "error",
          description: `No se pudo obtener access token: ${tokenRes.error}`,
        });
        return;
      }
      if (!appIdRes.ok) {
        toast({ variant: "error", description: `No se pudo obtener app id: ${appIdRes.error}` });
        return;
      }

      const builder = new window.google!.picker!.PickerBuilder()
        .addView(window.google!.picker!.ViewId.SPREADSHEETS)
        .setOAuthToken(tokenRes.accessToken)
        .setAppId(appIdRes.projectNumber)
        .enableFeature(window.google!.picker!.Feature.MULTISELECT_ENABLED)
        .setTitle("Selecciona una o varias Sheets")
        .setCallback((data) => handlePicked(data));

      builder.build().setVisible(true);
    });
  };

  const handlePicked = (data: PickerCallback) => {
    if (data.action !== window.google?.picker?.Action.PICKED) return;
    const docs = data.docs ?? [];
    if (docs.length === 0) return;

    startTransition(async () => {
      let connected = 0;
      let failed = 0;
      const mappingWarnings: string[] = [];
      for (const doc of docs) {
        const sug = await suggestMappingAction({
          spreadsheetId: doc.id,
          sheetTabName: "Hoja 1",
        });
        const mapping =
          sug.ok && sug.suggestedMapping
            ? sug.suggestedMapping
            : {
                header_row: 1,
                data_start_row: 2,
                columns: [
                  {
                    letter: "A",
                    header: "Columna A",
                    target: "metadata.notas",
                    type: "string" as const,
                    writeback: false,
                  },
                ],
              };
        const res = await connectSheetAction({
          spreadsheetId: doc.id,
          spreadsheetName: doc.name,
          sheetTabName: "Hoja 1",
          purpose: "leads_inbound",
          columnMapping: mapping,
          writebackEnabled: false,
        });
        if (res.ok) {
          connected++;
          mappingWarnings.push(...res.mappingWarnings);
        } else {
          failed++;
        }
      }
      if (connected > 0) {
        toast({
          variant: "success",
          description: `${connected} hoja${connected === 1 ? "" : "s"} conectada${connected === 1 ? "" : "s"}.`,
        });
      }
      // Avisos NO bloqueantes sobre columnas obligatorias faltantes (dedup).
      const uniqueWarnings = Array.from(new Set(mappingWarnings));
      for (const w of uniqueWarnings) {
        toast({ variant: "warning", description: w });
      }
      if (failed > 0) {
        toast({
          variant: "error",
          description: `${failed} hoja${failed === 1 ? "" : "s"} fallaron al conectar`,
        });
      }
      if (connected > 0) {
        setTimeout(() => window.location.reload(), 800);
      }
    });
  };

  return (
    <Button
      onClick={openPicker}
      disabled={disabled || pending || !pickerReady}
      variant="outline"
      className="gap-2"
    >
      {pending ? (
        <Loader2 className="size-4 animate-spin" />
      ) : (
        <>
          <Plus className="size-4" />
          <FileSpreadsheet className="size-4" />
        </>
      )}
      Conectar hoja(s)
    </Button>
  );
}
