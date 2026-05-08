/**
 * Credenciales del Supabase de AUTH (instancia interna del servidor).
 * Esta instancia maneja el login de los usuarios del dashboard.
 * Las credenciales del Supabase de DATOS del cliente se guardan en Settings.
 */
export const AUTH_SUPABASE_URL =
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    "https://api-db.automatizaformacion.com";

export const AUTH_SUPABASE_ANON_KEY =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpYXQiOjE3NzI0OTEyMjksImV4cCI6MTg5MzQ1NjAwMCwicm9sZSI6ImFub24iLCJpc3MiOiJzdXBhYmFzZSJ9.v5lTSxmgC2pHuB19YxNQUgq4A-tAya678gI53V7DBkk";

export const AUTH_SUPABASE_SERVICE_ROLE_KEY =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SERVICE_ROLE_KEY ||
    "";
