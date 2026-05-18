
export function parseFilters(params: any) {
    const preset = params.preset || params.range || "30d";
    const from = params.from;
    const to = params.to;

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
            search: params.q || undefined,
            pais: params.pais || undefined,
            origen: params.origen || undefined,
            campana: params.campana || undefined,
            tipoLead: params.tipoLead || undefined,
            cualificacion: params.cualificacion || undefined,
        }
    };
}
