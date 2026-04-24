import { redirect } from "next/navigation";

/**
 * /dashboard/orchestrator → Redirige a /dashboard/onboarding
 * El Orquestador ahora está integrado dentro del módulo de Onboarding
 * como un sistema nodal unificado.
 */
export default function OrchestratorRedirectPage() {
    redirect("/dashboard/onboarding");
}
