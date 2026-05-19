
export function parseFilters(params: any) {
    const preset = params.preset || params.range || "30d";
    const from = params.from;
    const to = params.to;

    const now = new Date();
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    let fromDateObj: Date;
    let toDateObj: Date = to ? new Date(to + "T23:59:59.999Z") : endOfToday;

    if (preset === "today") {
        fromDateObj = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        toDateObj = endOfToday;
    } else if (preset === "yesterday") {
        fromDateObj = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
        toDateObj = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 23, 59, 59, 999);
    } else if (preset === "7d") {
        fromDateObj = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        toDateObj = endOfToday;
    } else if (preset === "30d") {
        fromDateObj = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        toDateObj = endOfToday;
    } else if (preset === "this_month") {
        fromDateObj = new Date(now.getFullYear(), now.getMonth(), 1);
        toDateObj = endOfToday;
    } else if (preset === "this_year") {
        fromDateObj = new Date(now.getFullYear(), 0, 1);
        toDateObj = endOfToday;
    } else if (preset === "all") {
        fromDateObj = new Date(2000, 0, 1);
        toDateObj = new Date(now.getFullYear() + 10, 11, 31, 23, 59, 59, 999);
    } else if (from) {
        fromDateObj = new Date(from);
    } else {
        // Default to 30d if nothing matches
        fromDateObj = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        toDateObj = endOfToday;
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
