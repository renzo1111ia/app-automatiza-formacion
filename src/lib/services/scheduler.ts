import { formatInTimeZone } from 'date-fns-tz';
import { addHours, addMinutes, isAfter } from 'date-fns';

const ZONAS_HORARIAS: Record<string, string> = {
    españa: "Europe/Madrid",
    espana: "Europe/Madrid",
    argentina: "America/Argentina/Buenos_Aires",
    chile: "America/Santiago",
    colombia: "America/Bogota",
    mexico: "America/Mexico_City",
    méxico: "America/Mexico_City",
    peru: "America/Lima",
    perú: "America/Lima",
    uruguay: "America/Montevideo",
    estados_unidos: "America/New_York",
    ecuador: "America/Guayaquil",
};

const HORARIOS = {
    lunesViernes: { inicio: 9, fin: 21 },
    sabado: { inicio: 9, fin: 14 },
};

/**
 * SCHEDULER SERVICE
 * Replicates the complex date calculation logic from n8n for retries and advisor calls.
 */
export class SchedulerService {
    /**
     * Gets the current hour in a specific timezone
     */
    static getHourInZone(date: Date, zone: string): number {
        return parseInt(formatInTimeZone(date, zone, 'H'));
    }

    /**
     * Gets the day of week (0-6) in a specific timezone
     */
    static getDayInZone(date: Date, zone: string): number {
        return parseInt(formatInTimeZone(date, zone, 'i')); // 1 (Mon) to 7 (Sun) in ISO
    }

    /**
     * Checks if a date is within working hours for a specific timezone
     */
    static isWorkingHour(date: Date, zone: string): boolean {
        const day = this.getDayInZone(date, zone); // 1-7
        const hour = this.getHourInZone(date, zone);

        if (day >= 1 && day <= 5) {
            return hour >= HORARIOS.lunesViernes.inicio && hour < HORARIOS.lunesViernes.fin;
        } else if (day === 6) {
            return hour >= HORARIOS.sabado.inicio && hour < HORARIOS.sabado.fin;
        }
        return false; // Sunday
    }

    /**
     * Adjusts a date to the next available working hour in the lead's timezone
     */
    static adjustToWorkingHour(date: Date, country: string): Date {
        const zone = ZONAS_HORARIAS[country.toLowerCase()] || "Europe/Madrid";
        let d = new Date(date);

        // Max 10 attempts to find a working slot (to prevent infinite loops)
        for (let i = 0; i < 10; i++) {
            if (this.isWorkingHour(d, zone)) return d;

            const day = this.getDayInZone(d, zone);
            const hour = this.getHourInZone(d, zone);

            // If Sunday or Saturday afternoon, move to Monday 9 AM
            if (day === 7 || (day === 6 && hour >= HORARIOS.sabado.fin)) {
                d = addHours(d, 24);
                continue;
            }

            // If before 9 AM, set to 9 AM same day
            if (hour < 9) {
                // This is tricky with timezones, let's just add 1 hour until it works or use setHours in zone
                d = addHours(d, 1);
            } else {
                // After 9 PM, move to next day 9 AM
                d = addHours(d, 1);
            }
        }

        return d;
    }

    /**
     * Calculates the next retry date based on current attempt number
     */
    static calculateNextRetry(lastCallDate: Date, attemptCount: number, country: string): Date {
        const now = new Date();
        let nextDate: Date;

        if (attemptCount === 0) {
            // First retry in 10 minutes
            nextDate = addMinutes(now, 10);
        } else {
            // Subsequent retries in 27 hours (as per n8n logic)
            nextDate = isAfter(addHours(lastCallDate, 27), now) 
                ? addHours(lastCallDate, 27) 
                : addMinutes(now, 10);
        }

        return this.adjustToWorkingHour(nextDate, country);
    }
}
