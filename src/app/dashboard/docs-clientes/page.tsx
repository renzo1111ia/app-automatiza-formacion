import { HelpPageShell } from "@/components/docs/HelpPageShell";

export const dynamic = "force-dynamic";

export default function DocClientesPage() {
  return (
    <div className="h-full">
      <HelpPageShell
        scope="clientes"
        heading="Manual de Uso"
        subheading="Cómo usar tu CRM día a día: leads, conversaciones, llamadas, campañas, métricas."
        accentClass="from-emerald-500 to-teal-500"
      />
    </div>
  );
}
