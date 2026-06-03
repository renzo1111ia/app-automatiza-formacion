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

  // Normalizar: el row-mapper ya quita todo menos dígitos y "+". Si no tiene
  // "+", anteponerlo solo si parece prefijo internacional (heurística mínima);
  // libphonenumber se encarga del resto con defaultCountry.
  const raw = String(phone).trim();
  const withPlus = raw.startsWith("+") ? raw : raw.length > 9 ? `+${raw}` : raw;

  try {
    const parsed = parsePhoneNumberFromString(withPlus, defaultCountry);
    if (!parsed || !parsed.isValid()) return null;
    const cc = parsed.country;
    if (!cc) return null;
    return COUNTRY_ES[cc] ?? cc; // fallback al código ISO si no está en el mapa
  } catch {
    return null;
  }
}
