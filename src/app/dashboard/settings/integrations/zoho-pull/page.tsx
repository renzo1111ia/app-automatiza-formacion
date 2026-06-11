// Sprint 5 - Página de configuración Zoho CRM entrada de leads (event-driven).
//
// Server Component. Resuelve el estado inicial y delega el renderizado a
// ZohoSyncClient (interactividad). Patrón de google-sheets/page.tsx.

import { Suspense } from "react";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { getZohoSyncStatusAction } from "@/lib/integrations/zoho-pull/actions";
import { ZohoSyncClient } from "./ZohoSyncClient";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ success?: string; error?: string }>;
}

export default async function ZohoPullSettingsPage({ searchParams }: PageProps) {
  const status = await getZohoSyncStatusAction();
  const { success, error } = await searchParams;

  return (
    <div className="container mx-auto max-w-4xl px-4 py-8">
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
        <h1 className="text-3xl font-bold">Zoho CRM — Entrada de leads</h1>
        <p className="text-muted-foreground mt-2 max-w-3xl">
          Recibe leads de Zoho en tiempo real mediante webhooks event-driven. Cada vez que se cree o
          modifique un lead en Zoho, entrará automáticamente en el sistema agéntico en segundos.
        </p>
      </header>

      <Suspense
        fallback={<div className="text-muted-foreground p-8 text-center">Cargando estado...</div>}
      >
        <ZohoSyncClient
          initialStatus={status.ok ? status : null}
          oauthError={error ?? null}
          oauthSuccess={success === "1"}
        />
      </Suspense>
    </div>
  );
}
