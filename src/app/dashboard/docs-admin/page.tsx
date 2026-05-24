import { HelpPageShell } from "@/components/docs/HelpPageShell";
import { redirect } from "next/navigation";
import { getAdminStatus } from "@/lib/actions/auth";

export const dynamic = "force-dynamic";

export default async function DocAdminPage() {
  const isAdmin = await getAdminStatus();
  if (!isAdmin) {
    redirect("/dashboard");
  }

  return (
    <div className="h-full">
      <HelpPageShell
        scope="admin"
        heading="Documentación Técnica"
        subheading="Para administradores de plataforma: tenants, despliegues, RLS, troubleshooting."
        accentClass="from-indigo-500 to-violet-500"
      />
    </div>
  );
}
