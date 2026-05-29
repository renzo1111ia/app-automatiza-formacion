type FilterParams = Record<string, string | string[] | undefined>;

// Next.js searchParams pueden ser string[] cuando hay claves repetidas (?k=a&k=b).
// Normalizamos al primer valor para uso típico en filtros UI.
function first(v: string | string[] | undefined): string | undefined {
  if (Array.isArray(v)) return v[0];
  return v;
}

export function parseFilters(params: FilterParams) {
  const preset = first(params.preset) || first(params.range) || "30d";
  const from = first(params.from);
  const to = first(params.to);

  const now = new Date();
  let fromDateObj: Date;
  let toDateObj: Date = to ? new Date(to + "T23:59:59.999Z") : now;

  if (preset === "today") {
    fromDateObj = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    toDateObj = now;
  } else if (preset === "yesterday") {
    fromDateObj = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
    toDateObj = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  } else if (preset === "7d") {
    fromDateObj = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    toDateObj = now;
  } else if (preset === "30d") {
    fromDateObj = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    toDateObj = now;
  } else if (preset === "this_month") {
    fromDateObj = new Date(now.getFullYear(), now.getMonth(), 1);
    toDateObj = now;
  } else if (preset === "this_year") {
    fromDateObj = new Date(now.getFullYear(), 0, 1);
    toDateObj = now;
  } else if (preset === "all") {
    fromDateObj = new Date(2000, 0, 1);
    toDateObj = now;
  } else if (from) {
    fromDateObj = new Date(from);
  } else {
    // Default to 30d if nothing matches
    fromDateObj = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  }

  return {
    from: fromDateObj.toISOString(),
    to: toDateObj.toISOString(),
    filters: {
      search: first(params.q),
      pais: first(params.pais),
      origen: first(params.origen),
      campana: first(params.campana),
      tipoLead: first(params.tipoLead),
      cualificacion: first(params.cualificacion),
    },
  };
}
