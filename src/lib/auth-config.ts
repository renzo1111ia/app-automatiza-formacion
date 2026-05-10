/**
 * Credenciales del Supabase de AUTH (instancia interna del servidor).
 * Esta instancia maneja el login de los usuarios del dashboard.
 * Las credenciales del Supabase de DATOS del cliente se guardan en Settings.
 */
const isServer = typeof window === "undefined";

export const AUTH_SUPABASE_URL = isServer
    ? (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "https://api-db.automatizaformacion.com")
    : (process.env.NEXT_PUBLIC_SUPABASE_URL || "https://api-db.automatizaformacion.com");

export const AUTH_SUPABASE_ANON_KEY =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpYXQiOjE3NzgzOTI5MzQsImV4cCI6MTg5MzQ1NjAwMCwicm9sZSI6ImFub24iLCJpc3MiOiJzdXBhYmFzZSJ9.ZzJZGBn42ZpSlp3q42X4O48wWjciQQts4ftXVch4od8";

export const AUTH_SUPABASE_SERVICE_ROLE_KEY =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SERVICE_ROLE_KEY ||
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpYXQiOjE3NzgzOTI5MzQsImV4cCI6MTg5MzQ1NjAwMCwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlzcyI6InN1cGFiYXNlIn0.dc0tXGNDPsriOwj6qR9dbJm-GffhvoNTBhl88YEB_hg";
