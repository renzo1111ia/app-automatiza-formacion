"use client";

import { useState } from "react";
import { loginAction, resetPasswordAction } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, CheckCircle2 } from "lucide-react";
import NextImage from "next/image";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [resetSuccess, setResetSuccess] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const result = await loginAction(email, password);

    if (result.error) {
      setError(result.error);
      setLoading(false);
    } else {
      window.location.href = "/dashboard";
    }
  }

  async function handleResetPassword(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const result = await resetPasswordAction(email);

    if (result.error) {
      setError(result.error);
      setLoading(false);
    } else {
      setResetSuccess(true);
      setLoading(false);
    }
  }

  if (isForgotPassword) {
    return (
      <div className="relative flex min-h-screen items-center justify-center bg-[#f8fafc]">
        <div className="w-full max-w-[440px] px-6 py-12">
          <div className="mb-10 flex items-center justify-start">
            <NextImage
              src="/logo.png"
              alt="App Automatiza"
              width={240}
              height={64}
              className="h-16 w-auto object-contain"
              priority
            />
          </div>

          {resetSuccess ? (
            <div className="text-center">
              <div className="mb-6 flex justify-center">
                <div className="flex h-20 w-20 items-center justify-center rounded-full bg-emerald-50 text-emerald-500">
                  <CheckCircle2 className="h-10 w-10" />
                </div>
              </div>
              <h1 className="mb-3 text-2xl font-black tracking-tight text-[#0f172a]">
                ¡Correo enviado!
              </h1>
              <p className="mb-8 font-medium text-slate-500">
                Si el correo <b>{email}</b> existe en nuestro sistema, recibirás instrucciones para
                restablecer tu contraseña en unos minutos.
              </p>
              <Button
                onClick={() => {
                  setIsForgotPassword(false);
                  setResetSuccess(false);
                }}
                className="h-12 w-full rounded-xl bg-[#0ea5e9] text-base font-black text-white shadow-lg shadow-blue-200/50 transition-all hover:bg-[#0284c7]"
              >
                Volver al inicio
              </Button>
            </div>
          ) : (
            <>
              <div className="mb-10">
                <button
                  onClick={() => {
                    setIsForgotPassword(false);
                    setError(null);
                  }}
                  className="group mb-4 flex items-center gap-2 text-sm font-bold text-slate-400 transition-colors hover:text-slate-600"
                >
                  <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-1" />
                  Volver atrás
                </button>
                <h1 className="text-3xl font-black tracking-tight text-[#0f172a]">
                  Recuperar contraseña
                </h1>
                <p className="mt-2 text-base font-medium text-slate-500">
                  Ingresá tu email y te enviaremos un link para crear una nueva contraseña.
                </p>
              </div>

              <form onSubmit={handleResetPassword} className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="reset-email" className="text-sm font-bold text-slate-700">
                    Email Registrado
                  </Label>
                  <Input
                    id="reset-email"
                    type="email"
                    placeholder="nombre@ejemplo.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="h-12 rounded-xl border-slate-200 bg-white text-slate-900 transition-all placeholder:text-slate-400 focus:border-blue-500 focus:ring-blue-100"
                  />
                </div>

                {error && (
                  <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-600">
                    {error}
                  </div>
                )}

                <Button
                  type="submit"
                  disabled={loading}
                  className="h-12 w-full rounded-xl bg-[#0ea5e9] text-base font-black text-white shadow-lg shadow-blue-200/50 transition-all hover:bg-[#0284c7] active:scale-[0.98]"
                >
                  {loading ? "Enviando..." : "Enviar link de recuperación"}
                </Button>
              </form>
            </>
          )}

          <p className="mt-12 text-center text-xs font-bold tracking-widest text-slate-400 uppercase">
            © {new Date().getFullYear()} App Automatiza
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-[#f8fafc]">
      <div className="w-full max-w-[440px] px-6 py-12">
        <div className="mb-10 flex items-center justify-start">
          <NextImage
            src="/logo.png"
            alt="App Automatiza"
            width={240}
            height={64}
            className="h-16 w-auto object-contain"
            priority
          />
        </div>

        <div className="mb-10">
          <h1 className="text-3xl font-black tracking-tight text-[#0f172a]">Bienvenido de nuevo</h1>
          <p className="mt-2 text-base font-medium text-slate-500">
            Ingresa tus credenciales para acceder a tu cuenta
          </p>
        </div>

        <form onSubmit={handleLogin} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="email" className="text-sm font-bold text-slate-700">
              Email
            </Label>
            <Input
              id="email"
              type="email"
              placeholder="nombre@ejemplo.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="h-12 rounded-xl border-slate-200 bg-white text-slate-900 transition-all placeholder:text-slate-400 focus:border-blue-500 focus:ring-blue-100"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="password" className="text-sm font-bold text-slate-700">
                Contraseña
              </Label>
              <button
                type="button"
                onClick={() => {
                  setIsForgotPassword(true);
                  setError(null);
                }}
                className="text-sm font-bold text-blue-500 transition-colors hover:text-blue-600"
              >
                ¿Olvidaste tu contraseña?
              </button>
            </div>
            <Input
              id="password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required={!isForgotPassword}
              className="h-12 rounded-xl border-slate-200 bg-white text-slate-900 transition-all placeholder:text-slate-400 focus:border-blue-500 focus:ring-blue-100"
            />
          </div>

          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-600">
              {error}
            </div>
          )}

          <Button
            type="submit"
            disabled={loading}
            className="h-12 w-full rounded-xl bg-[#0ea5e9] text-base font-black text-white shadow-lg shadow-blue-200/50 transition-all hover:bg-[#0284c7] active:scale-[0.98]"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                Iniciando sesión...
              </span>
            ) : (
              "Iniciar sesión"
            )}
          </Button>
        </form>

        <p className="mt-12 text-center text-xs font-bold tracking-widest text-slate-400 uppercase">
          © {new Date().getFullYear()} App Automatiza
        </p>
      </div>
    </div>
  );
}
