import { parsePhoneNumber } from "libphonenumber-js";
import ct from "countries-and-timezones";

/**
 * Client-side utility to resolve country name from phone number.
 */
export function resolveCountryFromPhone(phone?: string | null): string | null {
    if (!phone) return null;
    try {
        const cleanPhone = phone.startsWith("+") ? phone : `+${phone.replace(/\D/g, "")}`;
        const phoneNumber = parsePhoneNumber(cleanPhone);
        
        if (phoneNumber && phoneNumber.country) {
            const countryInfo = ct.getCountry(phoneNumber.country);
            return countryInfo?.name || null;
        }
    } catch (e) {
        console.warn("[LOCATION UTILS] Failed to resolve country:", e);
    }
    return null;
}

export function resolveTimezoneFromPhone(phone?: string | null): string {
    if (!phone) return "Europe/Madrid";
    try {
        const cleanPhone = phone.startsWith("+") ? phone : `+${phone.replace(/\D/g, "")}`;
        const phoneNumber = parsePhoneNumber(cleanPhone);
        
        if (phoneNumber && phoneNumber.country) {
            const countryInfo = ct.getCountry(phoneNumber.country);
            return countryInfo?.timezones[0] || "Europe/Madrid";
        }
    } catch (e) {
        console.warn("[LOCATION UTILS] Failed to resolve timezone:", e);
    }
    return "Europe/Madrid";
}
