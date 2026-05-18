import { Loader2 } from "lucide-react";

export default function DashboardLoading() {
    return (
        <div className="flex h-full w-full items-center justify-center p-8">
            <div className="flex flex-col items-center gap-4 text-muted-foreground animate-pulse">
                <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 border border-primary/20 shadow-xl shadow-primary/5">
                    <Loader2 className="h-8 w-8 text-primary animate-spin" />
                </div>
                <div className="text-center">
                    <h3 className="text-lg font-black uppercase tracking-tight text-foreground">Cargando Módulo</h3>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 mt-1">Sincronizando base de datos...</p>
                </div>
            </div>
        </div>
    );
}
