import { PhoneCall } from "lucide-react";
import { fetchUltravoxLeadCalls } from "@/lib/actions/ultravox-calls";
import { LeadCallsTable } from "@/components/calls/LeadCallsTable";

export const dynamic = "force-dynamic";

export default async function LeadLlamadasPage() {
  const result = await fetchUltravoxLeadCalls({ limit: 100 });

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div className="flex items-center gap-4">
          <div className="rounded-[20px] border border-blue-500/20 bg-blue-500/10 p-3 text-blue-600 dark:text-blue-400">
            <PhoneCall className="h-8 w-8" />
          </div>
          <div>
            <h1 className="text-[32px] font-bold tracking-tight text-foreground">
              Lead <span className="text-blue-600 dark:text-blue-400">Llamadas</span>
            </h1>
            <p className="text-[15px] font-medium text-muted-foreground">
              Historial de llamadas de agentes de voz Ultravox y variables capturadas en tiempo real.
            </p>
          </div>
        </div>
      </div>

      {/* Main Interactive Table & Drawer */}
      <LeadCallsTable
        initialCalls={result.calls}
        totalCount={result.total}
        apiKeyFound={result.apiKeyFound}
        error={result.error}
      />
    </div>
  );
}
