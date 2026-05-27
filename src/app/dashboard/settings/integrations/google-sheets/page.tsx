// Sprint 4 - Wizard de configuracion Google Sheets como CRM.
//
// Ruta dedicada para minimizar conflicto con el chat 'experience' que pueda
// estar tocando IntegrationsManager.tsx. Server Component que delega a
// SheetsWizardClient.tsx para la interactividad.

import { Suspense } from "react";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import {
  getConnectionStatusAction,
  listConnectedSheetsAction,
} from "@/lib/integrations/sheets/actions";
import { SheetsWizardClient } from "./SheetsWizardClient";

export const dynamic = "force-dynamic";

export default async function GoogleSheetsSettingsPage(props: {
  searchParams: Promise<{ error?: string; connected?: string }>;
}) {
  const searchParams = await props.searchParams;
  const status = await getConnectionStatusAction();
  const sheets = await listConnectedSheetsAction();

  const oauthError = searchParams?.error ?? null;
  const oauthSuccess = searchParams?.connected === "1";

  return (
    <div className="container mx-auto max-w-5xl px-4 py-8">
      <div className="mb-6">
        <Link
          href="/dashboard/settings"
          className="text-muted-foreground hover:text-foreground inline-flex items-center text-sm"
        >
          <ChevronLeft className="mr-1 size-4" />
          Volver a Settings
        </Link>
      </div>

      <header className="mb-8">
        <h1 className="text-3xl font-bold">Google Sheets como CRM</h1>
        <p className="text-muted-foreground mt-2 max-w-3xl">
          Conecta una o varias hojas de cálculo para que cada nueva fila se procese automáticamente
          como lead en el sistema agéntico. Cada tenant trae sus propias credenciales OAuth de
          Google Cloud (esto evita compartir cuotas API entre clientes).
        </p>
      </header>

      <Suspense fallback={<div className="text-muted-foreground p-8 text-center">Cargando...</div>}>
        <SheetsWizardClient
          initialStatus={status.ok ? status : null}
          initialSheets={sheets.ok ? sheets.sheets : []}
          oauthError={oauthError}
          oauthSuccess={oauthSuccess}
        />
      </Suspense>
    </div>
  );
}
