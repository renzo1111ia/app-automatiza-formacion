import { Loader2 } from "lucide-react";

export default function DashboardLoading() {
  return (
    <div className="flex h-full w-full items-center justify-center p-8">
      <div className="text-muted-foreground flex animate-pulse flex-col items-center gap-4">
        <div className="bg-primary/10 border-primary/20 shadow-primary/5 relative flex h-16 w-16 items-center justify-center rounded-2xl border shadow-xl">
          <Loader2 className="text-primary h-8 w-8 animate-spin" />
        </div>
        <div className="text-center">
          <h3 className="text-foreground text-lg font-black tracking-tight uppercase">
            Cargando Módulo
          </h3>
          <p className="text-muted-foreground/60 mt-1 text-[10px] font-bold tracking-widest uppercase">
            Sincronizando base de datos...
          </p>
        </div>
      </div>
    </div>
  );
}
