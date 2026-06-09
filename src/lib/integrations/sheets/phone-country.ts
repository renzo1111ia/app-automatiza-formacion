// Sprint 4 — Deriva el país de un lead a partir del prefijo de su teléfono.
//
// Requisito 03-06-2026: si la fila de Sheet no trae País explícito, lo
// derivamos del número (+34 → España, +54 → Argentina, ...). Si no se puede
// derivar (número sin prefijo internacional reconocible), devuelve null y la UI
// pedirá el País durante el mapeo.
//
// Usa libphonenumber-js (ya en deps, sin dependencia nueva).

import { parsePhoneNumberFromString, type CountryCode } from "libphonenumber-js";

// Nombres en español de los países del mercado AF (ES + Latam) + comunes.
const COUNTRY_ES: Partial<Record<CountryCode, string>> = {
  ES: "España",
  MX: "México",
  AR: "Argentina",
  CO: "Colombia",
  CL: "Chile",
  PE: "Perú",
  EC: "Ecuador",
  VE: "Venezuela",
  GT: "Guatemala",
  BO: "Bolivia",
  DO: "República Dominicana",
  HN: "Honduras",
  PY: "Paraguay",
  SV: "El Salvador",
  NI: "Nicaragua",
  CR: "Costa Rica",
  PA: "Panamá",
  UY: "Uruguay",
  PR: "Puerto Rico",
  US: "Estados Unidos",
  PT: "Portugal",
  FR: "Francia",
  IT: "Italia",
  DE: "Alemania",
  GB: "Reino Unido",
};

/**
 * Devuelve el nombre de país en español derivado del teléfono, o null si no se
 * puede determinar (número vacío, sin prefijo internacional, o inválido).
 *
 * `defaultCountry` ayuda a parsear números nacionales sin "+" (ej. asume ES si
 * el número viene como "666...").
 */
export function deriveCountryFromPhone(
  phone: string | null | undefined,
  defaultCountry: CountryCode = "ES"
): string | null {
  if (!phone || String(phone).trim() === "") return null;

  const raw = String(phone).trim();
  // Cuántos dígitos reales tiene (ignora "+", espacios, guiones). Un teléfono
  // nacional tiene al menos ~7 dígitos; menos que eso = no es un teléfono.
  const digitCount = raw.replace(/\D/g, "").length;
  if (digitCount < 7) return null;

  // Si NO trae prefijo internacional "+", se asume el país por defecto (ES = +34).
  // Regla de negocio (08-06-2026): un número sin código de país se trata como
  // español. En ese caso devolvemos directamente el país por defecto sin depender
  // de la validación estricta de libphonenumber (que rechaza algunos móviles).
  const hasIntlPrefix = raw.startsWith("+") || raw.startsWith("00");
  if (!hasIntlPrefix) {
    return COUNTRY_ES[defaultCountry] ?? defaultCountry;
  }

  try {
    const parsed = parsePhoneNumberFromString(raw, defaultCountry);
    // isPossible es menos estricto que isValid (acepta móviles cuyos rangos no
    // estén en la metadata reducida). Para derivar país basta con que el número
    // sea plausible y tenga country detectado.
    if (parsed && (parsed.isValid() || parsed.isPossible()) && parsed.country) {
      return COUNTRY_ES[parsed.country] ?? parsed.country;
    }
  } catch {
    // libphonenumber puede lanzar si la metadata no está disponible en algún
    // runtime: caemos al fallback por prefijo de abajo en vez de devolver null.
  }

  // Fallback por prefijo conocido (cubre fallos de libphonenumber). Mapea los
  // códigos de país más comunes del mercado AF (ES + Latam) a su nombre.
  const country = countryFromDialPrefix(raw);
  if (country) return country;

  // Último recurso: si empieza por "+" pero no reconocemos el prefijo, no
  // inventamos país (podría ser cualquier país). Devolvemos null.
  return null;
}

// Prefijos telefónicos internacionales → país (ES + Latam + comunes). Respaldo
// determinista cuando libphonenumber no resuelve.
const DIAL_PREFIX: Array<[string, string]> = [
  ["34", "España"],
  ["52", "México"],
  ["54", "Argentina"],
  ["57", "Colombia"],
  ["56", "Chile"],
  ["51", "Perú"],
  ["593", "Ecuador"],
  ["58", "Venezuela"],
  ["502", "Guatemala"],
  ["591", "Bolivia"],
  ["1809", "República Dominicana"],
  ["1829", "República Dominicana"],
  ["1849", "República Dominicana"],
  ["504", "Honduras"],
  ["595", "Paraguay"],
  ["503", "El Salvador"],
  ["505", "Nicaragua"],
  ["506", "Costa Rica"],
  ["507", "Panamá"],
  ["598", "Uruguay"],
  ["1787", "Puerto Rico"],
  ["1", "Estados Unidos"],
  ["351", "Portugal"],
  ["33", "Francia"],
  ["39", "Italia"],
  ["49", "Alemania"],
  ["44", "Reino Unido"],
];

function countryFromDialPrefix(raw: string): string | null {
  const digits = raw.replace(/^\+/, "").replace(/^00/, "").replace(/\D/g, "");
  if (!digits) return null;
  // Ordenar por longitud de prefijo descendente para que "1809" gane a "1".
  const sorted = [...DIAL_PREFIX].sort((a, b) => b[0].length - a[0].length);
  for (const [prefix, name] of sorted) {
    if (digits.startsWith(prefix)) return name;
  }
  return null;
}
