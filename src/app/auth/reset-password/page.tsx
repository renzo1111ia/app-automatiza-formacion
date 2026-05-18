"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createBrowserClient } from "@supabase/ssr";
import { AUTH_SUPABASE_URL, AUTH_SUPABASE_ANON_KEY } from "@/lib/auth-config";
import { CheckCircle2, ShieldCheck } from "lucide-react";
import NextImage from "next/image";

export default function ResetPasswordPage() {
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);
    const router = useRouter();

    const supabase = createBrowserClient(AUTH_SUPABASE_URL, AUTH_SUPABASE_ANON_KEY);

    async function handleReset(e: React.FormEvent) {
        e.preventDefault();
        if (password !== confirmPassword) {
            setError("Las contraseñas no coinciden");
            return;
        }
        if (password.length < 6) {
            setError("La contraseña debe tener al menos 6 caracteres");
            return;
        }

        setLoading(true);
        setError(null);

        const { error } = await supabase.auth.updateUser({ password });

        if (error) {
            setError(error.message);
            setLoading(false);
        } else {
            setSuccess(true);
            setLoading(false);
            setTimeout(() => {
                router.push("/login");
            }, 3000);
        }
    }

    return (
        <div className="relative min-h-screen flex items-center justify-center bg-[#f8fafc]">
            <div className="w-full max-w-[440px] px-6 py-12">
                <div className="mb-10 flex items-center justify-start">
                    <NextImage src="/logo.png" alt="App Automatiza" width={240} height={64} className="h-16 w-auto object-contain" priority />
                </div>

                {success ? (
                    <div className="text-center">
                        <div className="flex justify-center mb-6">
                            <div className="h-20 w-20 bg-emerald-50 rounded-full flex items-center justify-center text-emerald-500">
                                <CheckCircle2 className="h-10 w-10" />
                            </div>
                        </div>
                        <h1 className="text-2xl font-black tracking-tight text-[#0f172a] mb-3">
                            ¡Contraseña actualizada!
                        </h1>
                        <p className="text-slate-500 font-medium mb-8">
                            Tu contraseña ha sido cambiada con éxito. Serás redirigido al login en unos segundos.
                        </p>
                        <Button
                            onClick={() => router.push("/login")}
                            className="h-12 w-full bg-[#0ea5e9] text-white font-black text-base shadow-lg shadow-blue-200/50 transition-all hover:bg-[#0284c7] rounded-xl"
                        >
                            Ir al Login ahora
                        </Button>
                    </div>
                ) : (
                    <>
                        <div className="mb-10 text-center">
                            <div className="flex justify-center mb-4">
                                <div className="h-12 w-12 bg-blue-50 rounded-xl flex items-center justify-center text-blue-500">
                                    <ShieldCheck className="h-6 w-6" />
                                </div>
                            </div>
                            <h1 className="text-3xl font-black tracking-tight text-[#0f172a]">
                                Nueva contraseña
                            </h1>
                            <p className="mt-2 text-base text-slate-500 font-medium">
                                Por favor ingresá tu nueva contraseña de acceso.
                            </p>
                        </div>

                        <form onSubmit={handleReset} className="space-y-6">
                            <div className="space-y-2">
                                <Label htmlFor="password" title="password" className="text-slate-700 font-bold text-sm">
                                    Contraseña Nueva
                                </Label>
                                <Input
                                    id="password"
                                    type="password"
                                    placeholder="••••••••"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                    className="h-12 border-slate-200 bg-white text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:ring-blue-100 transition-all rounded-xl"
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="confirmPassword" title="confirmPassword" className="text-slate-700 font-bold text-sm">
                                    Confirmar Contraseña
                                </Label>
                                <Input
                                    id="confirmPassword"
                                    type="password"
                                    placeholder="••••••••"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    required
                                    className="h-12 border-slate-200 bg-white text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:ring-blue-100 transition-all rounded-xl"
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
                                className="h-12 w-full bg-[#0ea5e9] text-white font-black text-base shadow-lg shadow-blue-200/50 transition-all hover:bg-[#0284c7] rounded-xl active:scale-[0.98]"
                            >
                                {loading ? "Actualizando..." : "Cambiar contraseña"}
                            </Button>
                        </form>
                    </>
                )}

                <p className="mt-12 text-center text-xs font-bold text-slate-400 tracking-widest uppercase">
                    © {new Date().getFullYear()} App Automatiza
                </p>
            </div>
        </div>
    );
}
