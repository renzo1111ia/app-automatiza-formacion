/**
 * PHONE HELPER
 * Utilities for normalizing phone numbers specifically for WhatsApp Cloud API.
 * Handles regional quirks like Mexico's "1" and Argentina's "9".
 */

export function normalizeWhatsAppNumber(phone: string): string {
    if (!phone) return "";
    
    // 1. Remove all non-numeric characters
    let cleanNumber = phone.replace(/\D/g, '');
    
    // 2. Logic for MEXICO (52)
    // Mobile numbers in Mexico for WhatsApp must be: 52 + 1 + 10 digits = 13 digits
    // If it's 12 digits (52 + 10 digits) and doesn't have the '1' at index 2
    if (cleanNumber.startsWith('52') && cleanNumber.length === 12 && cleanNumber[2] !== '1') {
        cleanNumber = `521${cleanNumber.substring(2)}`;
    }
    
    // 3. Logic for ARGENTINA (54)
    // WhatsApp requires a '9' after the country code for mobile numbers: 54 + 9 + 10 digits
    // If it starts with 54 and doesn't have the 9
    if (cleanNumber.startsWith('54') && !cleanNumber.startsWith('549')) {
        cleanNumber = `549${cleanNumber.substring(2)}`;
    }

    return cleanNumber;
}
