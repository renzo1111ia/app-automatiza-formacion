/**
 * TELEPHONY PROVIDER INTERFACE
 * Unified interface for different voice providers (Twilio, Telnyx, Plivo, etc.)
 */

export type TelephonyProviderType = 'twilio' | 'telnyx' | 'plivo' | 'vonage';

export interface TelephonyConfig {
    provider: TelephonyProviderType;
    credentials: {
        accountSid?: string;
        authToken?: string;
        apiKey?: string;
        apiSecret?: string;
        fromNumber: string;
    };
}

export interface CallParams {
    to: string;
    from: string;
    joinUrl: string; // The URL from Ultravox/AI provider to stream into the call
    metadata?: Record<string, any>;
    recordingEnabled?: boolean;
}

export interface CallResult {
    success: boolean;
    providerCallId?: string;
    errorMessage?: string;
}

export interface ITelephonyProvider {
    triggerCall(params: CallParams): Promise<CallResult>;
    getCallStatus(providerCallId: string): Promise<any>;
}
