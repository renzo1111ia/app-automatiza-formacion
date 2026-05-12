export const countryToTimezone: Record<string, string> = {
    "Bolivia": "America/La_Paz",
    "España": "Europe/Madrid",
    "Spain": "Europe/Madrid",
    "México": "America/Mexico_City",
    "Mexico": "America/Mexico_City",
    "Colombia": "America/Bogota",
    "Argentina": "America/Argentina/Buenos_Aires",
    "Chile": "America/Santiago",
    "Perú": "America/Lima",
    "Peru": "America/Lima",
    "Ecuador": "America/Guayaquil",
    "Venezuela": "America/Caracas",
    "Uruguay": "America/Montevideo",
    "Paraguay": "America/Asuncion",
    "Panamá": "America/Panama",
    "Panama": "America/Panama",
    "Costa Rica": "America/Costa_Rica",
    "Guatemala": "America/Guatemala",
    "Honduras": "America/Tegucigalpa",
    "El Salvador": "America/El_Salvador",
    "Nicaragua": "America/Managua",
    "República Dominicana": "America/Santo_Domingo",
    "Dominican Republic": "America/Santo_Domingo",
    "Puerto Rico": "America/Puerto_Rico",
    "Estados Unidos": "America/New_York",
    "USA": "America/New_York",
    "Reino Unido": "Europe/London",
    "UK": "Europe/London",
    "Francia": "Europe/Paris",
    "France": "Europe/Paris",
    "Alemania": "Europe/Berlin",
    "Germany": "Europe/Berlin",
    "Italia": "Europe/Rome",
    "Italy": "Europe/Rome",
    "Portugal": "Europe/Lisbon",
};

export function getTimezoneByCountry(country: string): string {
    if (!country) return "Europe/Madrid";
    
    // Normalize country name
    const normalized = country.trim();
    
    // Try exact match
    if (countryToTimezone[normalized]) return countryToTimezone[normalized];
    
    // Try case-insensitive match
    const found = Object.entries(countryToTimezone).find(
        ([name]) => name.toLowerCase() === normalized.toLowerCase()
    );
    
    if (found) return found[1];
    
    return "Europe/Madrid"; // Default
}
