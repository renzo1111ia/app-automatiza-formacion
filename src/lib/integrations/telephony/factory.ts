import { ITelephonyProvider, TelephonyConfig } from "./types";
import { TwilioProvider } from "./providers/twilio";

/**
 * TELEPHONY FACTORY
 * Resolves the appropriate Telephony Provider based on tenant configuration.
 */
export class TelephonyFactory {
    public static getProvider(config: Record<string, any>): ITelephonyProvider {
        const telephony = (config?.telephony as TelephonyConfig) || { provider: 'twilio' };
        
        switch (telephony.provider) {
            case 'twilio':
                const twilio = telephony.credentials || {};
                if (!twilio.accountSid || !twilio.authToken) {
                    throw new Error("Missing Twilio Account SID or Auth Token in telephony config");
                }
                return new TwilioProvider(twilio.accountSid, twilio.authToken);
            
            // Other providers (Telnyx, Plivo) will be added here
            case 'telnyx':
                throw new Error("Telnyx provider not yet implemented. Please use Twilio.");
            case 'plivo':
                throw new Error("Plivo provider not yet implemented. Please use Twilio.");
                
            default:
                throw new Error(`Unsupported telephony provider: ${telephony.provider}`);
        }
    }
}
