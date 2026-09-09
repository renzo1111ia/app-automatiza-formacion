"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  INITIAL_TABLES,
  INITIAL_RESERVATIONS,
  INITIAL_ZONES,
  formatCLP,
} from "@/lib/mock-pedidos-data";
import { Table, Reservation, TableStatus, Zone } from "@/types/pedidos";
import { TablesCanvas } from "@/components/pedidos/TablesCanvas";
import { TableDetailModal } from "@/components/pedidos/TableDetailModal";
import { OrderListTable } from "@/components/pedidos/OrderListTable";
import { SimulationModal } from "@/components/pedidos/SimulationModal";
import { EditTableModal } from "@/components/pedidos/EditTableModal";
import { ZoneManagerModal } from "@/components/pedidos/ZoneManagerModal";
import { InventoryPanel } from "@/components/pedidos/InventoryPanel";

import { useTenantStore } from "@/store/tenant";
import {
  Utensils,
  UtensilsCrossed,
  LayoutGrid,
  List,
  Sparkles,
  Users,
  Clock,
  TrendingUp,
  Bot,
  Filter,
  Move,
  Plus,
  Layers,
  Check,
  RefreshCw,
  RotateCcw,
} from "lucide-react";
import { cn } from "@/lib/utils";

export default function PedidosPage() {
  const { tenantId } = useTenantStore();
  const [zones, setZones] = useState<Zone[]>(INITIAL_ZONES);
  const [tables, setTables] = useState<Table[]>(INITIAL_TABLES);
  const [reservations, setReservations] =
    useState<Record<string, Reservation>>(INITIAL_RESERVATIONS);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);

  const [selectedZone, setSelectedZone] = useState<string>("all");
  const [viewMode, setViewMode] = useState<"canvas" | "list" | "inventory">("canvas");
  const [isEditMode, setIsEditMode] = useState<boolean>(false);

  // Modals state
  const [activeTable, setActiveTable] = useState<Table | null>(null);
  const [editingTable, setEditingTable] = useState<Table | null | undefined>(undefined); // undefined means modal closed
  const [isSimulating, setIsSimulating] = useState<boolean>(false);
  const [isZoneManagerOpen, setIsZoneManagerOpen] = useState<boolean>(false);

  // Sincronización en vivo con el servidor / WhatsApp
  const loadRestaurantData = useCallback(async () => {
    if (!tenantId) return;
    try {
      const res = await fetch(`/api/restaurant/state?tenantId=${tenantId}`);
      if (res.ok) {
        const data = await res.json();
        if (data.tables) setTables(data.tables);
        if (data.reservations) setReservations(data.reservations);
        if (data.zones) setZones(data.zones);
      }
    } catch (e) {
      console.warn("[PedidosPage] Error loading state:", e);
    }
  }, [tenantId]);

  useEffect(() => {
    loadRestaurantData();
    const interval = setInterval(loadRestaurantData, 6000);
    return () => clearInterval(interval);
  }, [loadRestaurantData]);

  const persistServerState = async (
    updatedTables?: Table[],
    updatedReservations?: Record<string, Reservation>,
    updatedZones?: Zone[]
  ) => {
    if (!tenantId) return;
    setIsSyncing(true);
    try {
      await fetch(`/api/restaurant/state`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantId,
          state: {
            tables: updatedTables || tables,
            reservations: updatedReservations || reservations,
            zones: updatedZones || zones,
          },
        }),
      });
    } catch (e) {
      console.error("[PedidosPage] Error persisting state:", e);
    } finally {
      setIsSyncing(false);
    }
  };

  // Stats KPIs
  const totalTables = tables.length;
  const occupiedTables = tables.filter((t) => t.status === "ocupada").length;
  const reservedTables = tables.filter((t) => t.status === "reservada").length;
  const occupancyPercentage =
    totalTables > 0 ? Math.round(((occupiedTables + reservedTables) / totalTables) * 100) : 0;
  const totalBillings = Object.values(reservations).reduce((sum, r) => sum + r.totalAmount, 0);

  // Table Status update
  const handleUpdateStatus = (tableId: string, newStatus: TableStatus) => {
    const updated = tables.map((t) => (t.id === tableId ? { ...t, status: newStatus } : t));
    setTables(updated);
    if (activeTable && activeTable.id === tableId) {
      setActiveTable((prev) => (prev ? { ...prev, status: newStatus } : null));
    }
    persistServerState(updated);
  };

  const handleSaveReservation = (updatedRes: Reservation) => {
    const updated = {
      ...reservations,
      [updatedRes.id]: updatedRes,
    };
    setReservations(updated);
    persistServerState(undefined, updated);
  };

  const handleSimulateReservation = (newRes: Reservation, targetTableId: string) => {
    const updatedRes = {
      ...reservations,
      [newRes.id]: newRes,
    };
    setReservations(updatedRes);

    const updatedTables = tables.map((t) =>
      t.id === targetTableId
        ? { ...t, status: "reservada" as const, currentReservationId: newRes.id }
        : t
    );
    setTables(updatedTables);
    persistServerState(updatedTables, updatedRes);
  };

  const handleResetToZero = async () => {
    if (
      !confirm(
        "¿Deseas reiniciar todas las mesas a 'Disponible' y vaciar las reservas para empezar desde cero?"
      )
    )
      return;
    const cleanTables = INITIAL_TABLES.map((t) => ({
      ...t,
      status: "disponible" as const,
      currentReservationId: undefined,
    }));
    setTables(cleanTables);
    setReservations({});
    await persistServerState(cleanTables, {});
  };

  // Table CRUD
  const handleSaveTableData = (tableData: Partial<Table>) => {
    if (!tableData.id) return;

    let updated: Table[];
    const exists = tables.some((t) => t.id === tableData.id);
    if (exists) {
      updated = tables.map((t) => (t.id === tableData.id ? ({ ...t, ...tableData } as Table) : t));
    } else {
      updated = [...tables, tableData as Table];
    }
    setTables(updated);
    persistServerState(updated);
  };

  const handleDeleteTable = (tableId: string) => {
    const updated = tables.filter((t) => t.id !== tableId);
    setTables(updated);
    persistServerState(updated);
  };

  const handleDuplicateTable = (sourceTable: Table) => {
    // Calcular siguiente número de mesa disponible
    const existingNumbers = tables.map((t) => t.number || 0);
    const nextNumber = existingNumbers.length > 0 ? Math.max(...existingNumbers) + 1 : 1;

    // Generar nombre sugerido sin perder la convención
    const hasNumberedName = /mesa\s*\d+/i.test(sourceTable.name);
    const newName = hasNumberedName ? `Mesa ${nextNumber}` : `${sourceTable.name} (Copia)`;

    // Posición con desplazamiento leve para que se distinga inmediatamente
    const nextX =
      sourceTable.position.x >= 85 ? sourceTable.position.x - 6 : sourceTable.position.x + 6;
    const nextY =
      sourceTable.position.y >= 85 ? sourceTable.position.y - 6 : sourceTable.position.y + 6;

    const duplicatedTable: Table = {
      id: `table-${Date.now()}`,
      name: newName,
      number: nextNumber,
      capacity: sourceTable.capacity,
      shape: sourceTable.shape,
      zone: sourceTable.zone,
      status: "disponible",
      position: {
        x: Math.min(92, Math.max(8, nextX)),
        y: Math.min(92, Math.max(8, nextY)),
      },
    };

    const updated = [...tables, duplicatedTable];
    setTables(updated);
    persistServerState(updated);
  };

  const handleUpdateTablePosition = (tableId: string, position: { x: number; y: number }) => {
    const updated = tables.map((t) => (t.id === tableId ? { ...t, position } : t));
    setTables(updated);
    persistServerState(updated);
  };

  // Zone CRUD
  const handleAddZone = (newZone: Zone) => {
    const updated = [...zones, newZone];
    setZones(updated);
    persistServerState(undefined, undefined, updated);
  };

  const handleDeleteZone = (zoneId: string) => {
    const updated = zones.filter((z) => z.id !== zoneId);
    setZones(updated);
    if (selectedZone === zoneId) setSelectedZone("all");
    persistServerState(undefined, undefined, updated);
  };

  const currentReservation = activeTable?.currentReservationId
    ? reservations[activeTable.currentReservationId] || null
    : null;

  return (
    <div className="mx-auto max-w-[1600px] space-y-6 p-6">
      {/* HEADER TITLE & ACTIONS */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="rounded-xl border border-indigo-500/30 bg-indigo-500/10 p-2 text-indigo-400">
              <Utensils className="h-6 w-6" />
            </div>
            <h1 className="text-2xl font-black tracking-tight text-white">
              Gestión de Pedidos & Plano de Mesas
            </h1>
          </div>
          <p className="mt-1 text-xs text-slate-400">
            Diseño interactivo del local (restaurante, pub, bar) con reservas automatizadas vía IA.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Layout Edit Toggle Button */}
          <button
            onClick={() => setIsEditMode(!isEditMode)}
            className={cn(
              "flex items-center gap-2 rounded-xl border px-4 py-2.5 text-xs font-bold shadow-lg transition-all",
              isEditMode
                ? "border-amber-400 bg-amber-500 text-slate-950 shadow-amber-500/20"
                : "border-slate-800 bg-slate-900 text-slate-300 hover:bg-slate-800 hover:text-white"
            )}
          >
            {isEditMode ? (
              <>
                <Check className="h-4 w-4" /> Finalizar Edición del Plano
              </>
            ) : (
              <>
                <Move className="h-4 w-4 text-amber-400" /> Modo Edición del Plano
              </>
            )}
          </button>

          {/* Edit Mode Quick Tools */}
          {isEditMode && (
            <>
              <button
                onClick={() => setEditingTable(null)} // null = create new table
                className="flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 py-2.5 text-xs font-bold text-white shadow-lg shadow-indigo-600/30 transition-all hover:bg-indigo-500"
              >
                <Plus className="h-4 w-4" /> Añadir Mesa
              </button>

              <button
                onClick={() => setIsZoneManagerOpen(true)}
                className="flex items-center gap-1.5 rounded-xl bg-purple-600 px-3.5 py-2.5 text-xs font-bold text-white shadow-lg shadow-purple-600/30 transition-all hover:bg-purple-500"
              >
                <Layers className="h-4 w-4" /> Espacios & Zonas
              </button>
            </>
          )}

          {/* Simulate AI reservation & Live Sync buttons */}
          {!isEditMode && (
            <>
              <button
                onClick={loadRestaurantData}
                disabled={isSyncing}
                className="flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900 px-3.5 py-2.5 text-xs font-bold text-slate-300 shadow-lg transition-all hover:bg-slate-800 hover:text-white"
                title="Actualizar mesas y reservas en vivo desde WhatsApp"
              >
                <RefreshCw
                  className={cn("h-4 w-4 text-emerald-400", isSyncing && "animate-spin")}
                />
                <span>{isSyncing ? "Sincronizando..." : "Sincronizar"}</span>
              </button>

              <button
                onClick={handleResetToZero}
                disabled={isSyncing}
                className="flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900 px-3.5 py-2.5 text-xs font-bold text-slate-300 shadow-lg transition-all hover:bg-slate-800 hover:text-amber-300"
                title="Reiniciar todas las mesas a 'Disponible' y vaciar reservas para empezar completamente de cero"
              >
                <RotateCcw className="h-4 w-4 text-amber-400" />
                <span>Empezar de Cero</span>
              </button>

              <button
                onClick={() => setIsSimulating(true)}
                className="flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-xs font-bold text-white shadow-lg shadow-indigo-600/30 transition-all hover:bg-indigo-500"
              >
                <Sparkles className="h-4 w-4" /> Simular Reserva IA
              </button>
            </>
          )}

          {/* View Mode Switcher (Canvas vs List) */}
          <div className="flex items-center rounded-xl border border-slate-800 bg-slate-900 p-1 text-xs">
            <button
              onClick={() => setViewMode("canvas")}
              className={cn(
                "flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-semibold transition-all",
                viewMode === "canvas"
                  ? "bg-slate-800 text-white shadow-sm"
                  : "text-slate-400 hover:text-white"
              )}
            >
              <LayoutGrid className="h-4 w-4" /> Plano (Canvas)
            </button>
            <button
              onClick={() => setViewMode("list")}
              className={cn(
                "flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-semibold transition-all",
                viewMode === "list"
                  ? "bg-slate-800 text-white shadow-sm"
                  : "text-slate-400 hover:text-white"
              )}
            >
              <List className="h-4 w-4" /> Lista de Pedidos
            </button>
            <button
              onClick={() => setViewMode("inventory")}
              className={cn(
                "flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-semibold transition-all",
                viewMode === "inventory"
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "text-slate-400 hover:text-white"
              )}
            >
              <UtensilsCrossed className="h-4 w-4 text-amber-400" /> Carta & Stock
            </button>
          </div>
        </div>
      </div>

      {/* KPI METRIC CARDS */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="flex items-center justify-between rounded-2xl border border-slate-800/80 bg-slate-900/80 p-5 shadow-xl">
          <div>
            <span className="mb-1 block text-xs font-semibold text-slate-400">Ocupación Total</span>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black text-white">{occupancyPercentage}%</span>
              <span className="text-xs font-medium text-slate-400">
                ({occupiedTables + reservedTables}/{totalTables} mesas)
              </span>
            </div>
          </div>
          <div className="rounded-xl border border-indigo-500/20 bg-indigo-500/10 p-3 text-indigo-400">
            <Users className="h-6 w-6" />
          </div>
        </div>

        <div className="flex items-center justify-between rounded-2xl border border-slate-800/80 bg-slate-900/80 p-5 shadow-xl">
          <div>
            <span className="mb-1 block text-xs font-semibold text-slate-400">
              Reservas Activas IA
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black text-amber-300">{reservedTables}</span>
              <span className="text-xs font-medium text-amber-400">vía WhatsApp/Voz</span>
            </div>
          </div>
          <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-3 text-amber-400">
            <Bot className="h-6 w-6" />
          </div>
        </div>

        <div className="flex items-center justify-between rounded-2xl border border-slate-800/80 bg-slate-900/80 p-5 shadow-xl">
          <div>
            <span className="mb-1 block text-xs font-semibold text-slate-400">Mesas Ocupadas</span>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black text-rose-400">{occupiedTables}</span>
              <span className="text-xs font-medium text-rose-300/80">En servicio</span>
            </div>
          </div>
          <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 p-3 text-rose-400">
            <Clock className="h-6 w-6" />
          </div>
        </div>

        <div className="flex items-center justify-between rounded-2xl border border-slate-800/80 bg-slate-900/80 p-5 shadow-xl">
          <div>
            <span className="mb-1 block text-xs font-semibold text-slate-400">
              Consumo Estimado
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black text-emerald-400">
                {formatCLP(totalBillings)}
              </span>
              <span className="text-xs font-medium text-emerald-500/80">acumulado</span>
            </div>
          </div>
          <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3 text-emerald-400">
            <TrendingUp className="h-6 w-6" />
          </div>
        </div>
      </div>

      {/* DYNAMIC ZONES SELECTOR TABS (Visible in canvas and list modes) */}
      {viewMode !== "inventory" && (
        <div className="flex items-center justify-between gap-4 overflow-x-auto border-b border-slate-800/80 pb-3 text-xs">
          <div className="flex items-center gap-2">
            <span className="mr-2 flex items-center gap-1 font-semibold text-slate-400">
              <Filter className="h-3.5 w-3.5" /> Espacio / Zona:
            </span>

            <button
              onClick={() => setSelectedZone("all")}
              className={cn(
                "rounded-xl px-3.5 py-2 font-semibold whitespace-nowrap transition-all",
                selectedZone === "all"
                  ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/20"
                  : "border border-slate-800 bg-slate-900/60 text-slate-400 hover:text-white"
              )}
            >
              Plano General (Todas)
            </button>

            {zones.map((zone) => (
              <button
                key={zone.id}
                onClick={() => setSelectedZone(zone.id)}
                className={cn(
                  "rounded-xl px-3.5 py-2 font-semibold whitespace-nowrap capitalize transition-all",
                  selectedZone === zone.id
                    ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/20"
                    : "border border-slate-800 bg-slate-900/60 text-slate-400 hover:text-white"
                )}
              >
                {zone.name}
              </button>
            ))}
          </div>

          <button
            onClick={() => setIsZoneManagerOpen(true)}
            className="flex items-center gap-1 font-semibold whitespace-nowrap text-purple-400 transition-colors hover:text-purple-300"
          >
            <Layers className="h-3.5 w-3.5" /> Editar Espacios
          </button>
        </div>
      )}

      {/* MAIN VIEW CONTENT (CANVAS, LIST OR INVENTORY) */}
      {viewMode === "inventory" ? (
        <InventoryPanel tenantId={tenantId || "default-tenant"} />
      ) : viewMode === "canvas" ? (
        <TablesCanvas
          tables={tables}
          reservations={reservations}
          zones={zones}
          selectedZone={selectedZone}
          isEditMode={isEditMode}
          onSelectTable={(table) => setActiveTable(table)}
          onEditTable={(table) => setEditingTable(table)}
          onDeleteTable={handleDeleteTable}
          onDuplicateTable={handleDuplicateTable}
          onUpdateTablePosition={handleUpdateTablePosition}
        />
      ) : (
        <OrderListTable
          tables={tables}
          reservations={reservations}
          onSelectTable={(table) => setActiveTable(table)}
        />
      )}

      {/* TABLE DETAIL MODAL / DRAWER */}
      {activeTable && (
        <TableDetailModal
          table={activeTable}
          reservation={currentReservation}
          onClose={() => setActiveTable(null)}
          onUpdateStatus={handleUpdateStatus}
          onSaveReservation={handleSaveReservation}
        />
      )}

      {/* EDIT / CREATE TABLE MODAL */}
      {editingTable !== undefined && (
        <EditTableModal
          table={editingTable}
          zones={zones}
          onClose={() => setEditingTable(undefined)}
          onSave={handleSaveTableData}
          onDelete={handleDeleteTable}
          onDuplicate={handleDuplicateTable}
        />
      )}

      {/* ZONE MANAGER MODAL */}
      {isZoneManagerOpen && (
        <ZoneManagerModal
          zones={zones}
          onClose={() => setIsZoneManagerOpen(false)}
          onAddZone={handleAddZone}
          onDeleteZone={handleDeleteZone}
        />
      )}

      {/* SIMULATION MODAL */}
      {isSimulating && (
        <SimulationModal
          tables={tables}
          onClose={() => setIsSimulating(false)}
          onSimulate={handleSimulateReservation}
        />
      )}
    </div>
  );
}
