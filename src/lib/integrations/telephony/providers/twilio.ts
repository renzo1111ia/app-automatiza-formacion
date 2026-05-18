import { ITelephonyProvider, CallParams, CallResult } from "../types";

/**
 * TWILIO PROVIDER
 * Implementation of the Telephony interface for Twilio.
 * Uses TwiML to connect a call to an Ultravox Stream joinUrl.
 */
export class TwilioProvider implements ITelephonyProvider {
    private accountSid: string;
    private authToken: string;

    constructor(accountSid: string, authToken: string) {
        this.accountSid = accountSid;
        this.authToken = authToken;
    }

    public async triggerCall(params: CallParams): Promise<CallResult> {
        try {
            // For production, we'd use the twilio npm package, but here we'll use standard fetch 
            // to avoid dependency issues if it's not pre-installed.
            const twiml = `<Response><Connect><Stream url="${params.joinUrl}"/></Connect></Response>`;
            
            const formData = new URLSearchParams();
            formData.append('To', params.to);
            formData.append('From', params.from);
            formData.append('Twiml', twiml);
            if (params.recordingEnabled) {
                formData.append('Record', 'true');
            }

            const auth = Buffer.from(`${this.accountSid}:${this.authToken}`).toString('base64');
            const response = await fetch(
                `https://api.twilio.com/2010-04-01/Accounts/${this.accountSid}/Calls.json`,
                {
                    method: 'POST',
                    headers: {
                        'Authorization': `Basic ${auth}`,
                        'Content-Type': 'application/x-www-form-urlencoded'
                    },
                    body: formData
                }
            );

            if (!response.ok) {
                const errorData = await response.json();
                console.error("[TELEPHONY TWILIO] Twilio API Error:", errorData);
                return { success: false, errorMessage: errorData.message || "Twilio API Failure" };
            }

            const data = await response.json();
            return { success: true, providerCallId: data.sid };
        } catch (error: any) {
            console.error("[TELEPHONY TWILIO] Error triggering call:", error.message || error);
            return { success: false, errorMessage: error.message || "Unknown error" };
        }
    }

    public async getCallStatus(providerCallId: string): Promise<any> {
        const auth = Buffer.from(`${this.accountSid}:${this.authToken}`).toString('base64');
        const response = await fetch(
            `https://api.twilio.com/2010-04-01/Accounts/${this.accountSid}/Calls/${providerCallId}.json`,
            {
                headers: { 'Authorization': `Basic ${auth}` }
            }
        );
        if (!response.ok) throw new Error("Failed to fetch Twilio call status");
        return await response.json();
    }
}
