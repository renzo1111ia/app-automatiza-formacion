#!/bin/bash
# Barrido HTTP de las 28 rutas dashboard + endpoints clave con cookie admin
# Output: tabla URL | HTTP | tiempo
COOKIE='esden-tenant-id=e3ec5649-5d75-4917-89f3-4b75dfceac54; esden-tenant-name=Automatiza%20Formaci%C3%B3n'

# Solo necesito la cookie sb-127-auth-token (la otra es UX); para evitar pegar gigante uso archivo separado
# Aqui asumo que ya está en la sesión browser; usamos curl --cookie-jar/--cookie via -b

ROUTES_DASHBOARD=(
  "/"
  "/login"
  "/auth/reset-password"
  "/dashboard"
  "/dashboard/admin"
  "/dashboard/agents"
  "/dashboard/calendar"
  "/dashboard/calls"
  "/dashboard/campanas"
  "/dashboard/campanas/nuevo"
  "/dashboard/conversaciones"
  "/dashboard/costs"
  "/dashboard/demo"
  "/dashboard/docs"
  "/dashboard/docs-admin"
  "/dashboard/docs-clientes"
  "/dashboard/historial"
  "/dashboard/knowledge"
  "/dashboard/logs"
  "/dashboard/minutos"
  "/dashboard/onboarding"
  "/dashboard/orchestrator"
  "/dashboard/playground"
  "/dashboard/settings"
  "/dashboard/simulator"
  "/dashboard/voice-agents"
  "/dashboard/web-chatbot"
  "/dashboard/whatsapp"
)

ENDPOINTS_AUTH=(
  "/api/health"
  "/api/version"
)

echo "## Rutas dashboard (con sesión admin)"
echo "| Ruta | HTTP | Tiempo (ms) |"
echo "|---|---|---|"
for r in "${ROUTES_DASHBOARD[@]}"; do
  result=$(curl -s -o /dev/null -w "%{http_code}|%{time_total}" --max-time 10 "http://localhost:8500${r}")
  http=$(echo "$result" | cut -d'|' -f1)
  ttime=$(echo "$result" | cut -d'|' -f2)
  ttime_ms=$(echo "$ttime * 1000" | bc | cut -d'.' -f1)
  echo "| ${r} | ${http} | ${ttime_ms} |"
done

echo ""
echo "## Endpoints sin auth"
echo "| Endpoint | HTTP | Tiempo (ms) |"
echo "|---|---|---|"
for r in "${ENDPOINTS_AUTH[@]}"; do
  result=$(curl -s -o /dev/null -w "%{http_code}|%{time_total}" --max-time 10 "http://localhost:8500${r}")
  http=$(echo "$result" | cut -d'|' -f1)
  ttime=$(echo "$result" | cut -d'|' -f2)
  ttime_ms=$(echo "$ttime * 1000" | bc | cut -d'.' -f1)
  echo "| ${r} | ${http} | ${ttime_ms} |"
done
