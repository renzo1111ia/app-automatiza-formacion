import { ICRMProvider } from "./interface";
import { ZohoCRMProvider } from "./providers/zoho";

/**
 * CRM FACTORY
 * Returns the relevant CRM provider instance for a tenant.
 */
export class CRMFactory {
    private static instances: Record<string, ICRMProvider> = {};

    /**
     * GET PROVIDER
     * Based on tenant config, initializes and returns the correct CRM client.
     */
    static getProvider(tenantId: string, config: any): ICRMProvider {
        const crmConfig = config?.crm || {};
        const providerName = (crmConfig.provider || "zoho").toLowerCase();
        
        // Cache instance per tenant to reuse tokens
        const cacheKey = `${tenantId}:${providerName}`;
        if (this.instances[cacheKey]) return this.instances[cacheKey];

        const credentials = {
            clientId: crmConfig.credentials?.client_id || process.env.ZOHO_CLIENT_ID || "",
            clientSecret: crmConfig.credentials?.client_secret || process.env.ZOHO_CLIENT_SECRET || "",
            refreshToken: crmConfig.credentials?.refresh_token || process.env.ZOHO_REFRESH_TOKEN || "",
            apiBase: crmConfig.credentials?.api_base,
            tokenUrl: crmConfig.credentials?.token_url,
        };

        let provider: ICRMProvider;

        switch (providerName) {
            case "zoho":
                provider = new ZohoCRMProvider(credentials);
                break;
            case "hubspot":
                // future implementation
                provider = new ZohoCRMProvider(credentials); 
                break;
            default:
                provider = new ZohoCRMProvider(credentials);
        }

        this.instances[cacheKey] = provider;
        return provider;
    }
}
