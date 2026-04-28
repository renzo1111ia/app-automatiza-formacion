import { addMinutes, addHours, addDays, getHours, getMinutes, setHours, setMinutes, isBefore } from "date-fns";
import { toZonedTime, fromZonedTime } from "date-fns-tz";

/**
 * COMPLIANCE SERVICE v2.1
 * Handles calling windows, timezone resolution, and working-day enforcement.
 */

export interface ComplianceConfig {
    startHour: number;     // e.g. 9
    endHour: number;       // e.g. 20
    timezone: string;      // e.g. "Europe/Madrid"
    workingDays?: number[]; // [1,2,3,4,5] Mon-Fri. Default: all days
}

export interface ComplianceDecision {
    canExecuteNow: boolean;
    timezone: string;
    localTimeStr: string;       // Human readable "14:32 CET"
    delayMs: number;            // 0 if immediate, else ms to wait
    scheduledFor: Date | null;  // null if immediate
    reason: string;
}

import { parsePhoneNumber } from "libphonenumber-js";
import ct from "countries-and-timezones";

/**
 * Resolves timezone from phone prefix, country code, or defaults to a given headquarters timezone.
 */
export function resolveTimezone(
    phone?: string | null,
    country?: string | null,
    defaultTimezone: string = "Europe/Madrid"
): string {
    // 1. Try to parse phone number to get ISO country code
    if (phone) {
        try {
            const cleanPhone = phone.startsWith("+") ? phone : `+${phone.replace(/\D/g, "")}`;
            const phoneNumber = parsePhoneNumber(cleanPhone);
            
            if (phoneNumber && phoneNumber.country) {
                const countryInfo = ct.getCountry(phoneNumber.country);
                if (countryInfo && countryInfo.timezones.length > 0) {
                    // Return the first/primary timezone of the country
                    return countryInfo.timezones[0];
                }
            }
        } catch (e) {
            console.warn(`[COMPLIANCE] Failed to parse phone ${phone} for timezone:`, e);
        }
    }

    // 2. Try explicit country string
    if (country) {
        const c = country.toLowerCase().trim();
        // Simple mapping for common names to ISO codes if needed, 
        // but countries-and-timezones mostly uses ISO. 
        // We can use a search if needed.
        const allCountries = ct.getAllCountries();
        const found = Object.values(allCountries).find(
            cc => cc.name.toLowerCase() === c || cc.id.toLowerCase() === c
        );
        if (found && found.timezones.length > 0) return found.timezones[0];
        
        // Manual aliases for common Spanish names
        if (["españa", "spain", "esp"].includes(c)) return "Europe/Madrid";
        if (["méxico", "mexico", "mex"].includes(c)) return "America/Mexico_City";
        if (["perú", "peru", "per"].includes(c)) return "America/Lima";
    }

    // 3. Fallback to Headquarters Timezone
    return defaultTimezone;
}

/**
 * Determines if it's currently within a legal calling window.
 */
export function isWithinLegalWindow(config: ComplianceConfig): boolean {
    const nowZoned = toZonedTime(new Date(), config.timezone);
    const dayOfWeek = nowZoned.getDay();
    const currentHour = getHours(nowZoned);
    const currentMinute = getMinutes(nowZoned);
    
    const currentMinutes = currentHour * 60 + currentMinute;
    
    // Default hours
    let startH = config.startHour;
    let endH = config.endHour;

    // Specific logic for Saturday (matching n8n: 9:00 - 14:00)
    // In JS Date: 0=Sun, 1=Mon... 6=Sat
    if (dayOfWeek === 6) {
        endH = Math.min(endH, 14);
    }

    const startMinutes = startH * 60;
    const endMinutes = endH * 60;
    
    return currentMinutes >= startMinutes && currentMinutes < endMinutes;
}

/**
 * Checks if today is a working day in the given timezone.
 */
export function isWorkingDay(timezone: string, workingDays: number[] = [1, 2, 3, 4, 5, 6]): boolean {
    const nowZoned = toZonedTime(new Date(), timezone);
    const dayOfWeek = nowZoned.getDay(); // 0=Sun, 1=Mon...6=Sat
    return workingDays.includes(dayOfWeek);
}

/**
 * Calculates the Date of the next window start (next working day at startHour).
 */
export function getNextWindowStart(config: ComplianceConfig, workingDays: number[] = [1, 2, 3, 4, 5, 6]): Date {
    const timezone = config.timezone;
    let candidate = toZonedTime(new Date(), timezone);

    // Try up to 7 days ahead to find next working day
    for (let i = 0; i < 7; i++) {
        const dayOfWeek = candidate.getDay();
        
        // Adjust endHour for Saturday check in the future
        const effectiveEndHour = dayOfWeek === 6 ? Math.min(config.endHour, 14) : config.endHour;

        // Set to startHour:00 of the candidate day
        const dayStart = setMinutes(setHours(candidate, config.startHour), 0);
        const isWorking = workingDays.includes(dayOfWeek);
        
        // We only care if it's a working day and the window hasn't passed today, 
        // OR it's a working day in the future.
        const dayEnd = setMinutes(setHours(candidate, effectiveEndHour), 0);
        const isPastToday = isBefore(fromZonedTime(dayEnd, timezone), new Date());

        if (isWorking && (i > 0 || !isPastToday)) {
            // Return the start of the window
            const result = fromZonedTime(dayStart, timezone);
            // If the start is in the past (e.g. it's 10:00 and we start at 09:00), 
            // but we are within the window, we might returning a past date.
            // But getNextWindowStart is usually called when we are NOT in the window.
            if (isBefore(result, new Date())) {
                // If the start is past, but we are before the end, we can technically call now, 
                // but this function is for the NEXT window. So if today is valid and it's e.g. 8am, 
                // it returns 9am. If today is valid and it's 10pm, it skips to tomorrow.
                if (i === 0 && isPastToday) {
                   // move to next day
                } else {
                   return result;
                }
            } else {
                return result;
            }
        }
        candidate = addDays(candidate, 1);
    }

    // Fallback: 24 hours from now
    return addHours(new Date(), 24);
}

/**
 * Master compliance decision function.
 * Given a lead phone and tenant config, returns whether to execute now or when.
 */
export function buildComplianceDecision(
    phone: string | null | undefined,
    country: string | null | undefined,
    timezoneRules: {
        start: string;
        end: string;
        working_days: number[];
        default_timezone?: string;
        phone_prefix_map?: Record<string, string>;
    }
): ComplianceDecision {
    const timezone = resolveTimezone(phone, country, timezoneRules.default_timezone || "Europe/Madrid");

    const [startH] = timezoneRules.start.split(":").map(Number);
    const [endH] = timezoneRules.end.split(":").map(Number);

    const config: ComplianceConfig = {
        timezone,
        startHour: startH,
        endHour: endH,
        workingDays: timezoneRules.working_days,
    };

    const inWindow = isWithinLegalWindow(config);
    const inWorkingDay = isWorkingDay(timezone, timezoneRules.working_days);

    // Format local time for logging
    const nowZoned = toZonedTime(new Date(), timezone);
    const localTimeStr = `${String(getHours(nowZoned)).padStart(2, "0")}:${String(getMinutes(nowZoned)).padStart(2, "0")} (${timezone})`;

    // Sat hack: if it's Saturday and past 14:00, it's NOT in window
    const dayOfWeek = nowZoned.getDay();
    const effectiveEnd = (dayOfWeek === 6) ? "14:00" : timezoneRules.end;

    if (inWindow && inWorkingDay) {
        return {
            canExecuteNow: true,
            timezone,
            localTimeStr,
            delayMs: 0,
            scheduledFor: null,
            reason: `✅ Dentro de ventana laboral [${timezoneRules.start}-${effectiveEnd}]`,
        };
    }

    // Calculate delay until next window
    const nextWindow = getNextWindowStart(config, timezoneRules.working_days);
    const delayMs = nextWindow.getTime() - Date.now();

    const reason = !inWorkingDay
        ? `⏸ Día no laboral. Programado para: ${nextWindow.toISOString()}`
        : `⏸ Fuera de ventana horaria [${timezoneRules.start}-${effectiveEnd}]. Hora local: ${localTimeStr}`;

    return {
        canExecuteNow: false,
        timezone,
        localTimeStr,
        delayMs: Math.max(0, delayMs),
        scheduledFor: nextWindow,
        reason,
    };
}
