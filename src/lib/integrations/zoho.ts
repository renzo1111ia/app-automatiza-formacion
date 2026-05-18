/**
 * ZOHO CRM INTEGRATION
 * Handles OAuth2 authentication and CRM operations (Search, Update, Tag, Blueprints).
 */

export interface ZohoLead {
    id: string;
    Full_Name?: string;
    First_Name?: string;
    Last_Name?: string;
    Phone?: string;
    Email?: string;
    Country?: string;
    Lead_Source?: string;
    Tag?: string[];
    [key: string]: any;
}

class ZohoClient {
    private clientId: string;
    private clientSecret: string;
    private refreshToken: string;
    private apiBase: string;
    private tokenUrl: string;
    private accessToken: string | null = null;
    private tokenExpiry: number = 0;

    constructor() {
        this.clientId = process.env.ZOHO_CLIENT_ID || "";
        this.clientSecret = process.env.ZOHO_CLIENT_SECRET || "";
        this.refreshToken = process.env.ZOHO_REFRESH_TOKEN || "";
        this.apiBase = process.env.ZOHO_API_BASE_URL || "https://www.zohoapis.com/crm/v2";
        this.tokenUrl = process.env.ZOHO_ACCESS_TOKEN_URL || "https://accounts.zoho.com/oauth/v2/token";
    }

    private async refreshAccessToken() {
        if (this.accessToken && Date.now() < this.tokenExpiry) return;

        console.log("[ZOHO] Refreshing access token...");
        const response = await fetch(this.tokenUrl, {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
                grant_type: "refresh_token",
                client_id: this.clientId,
                client_secret: this.clientSecret,
                refresh_token: this.refreshToken,
            }),
        });

        const data = await response.json();
        if (!response.ok) {
            throw new Error(`Zoho Auth Error: ${data.error || response.statusText}`);
        }

        this.accessToken = data.access_token;
        this.tokenExpiry = Date.now() + (data.expires_in - 60) * 1000;
    }

    private async request(path: string, options: RequestInit = {}) {
        await this.refreshAccessToken();

        const url = path.startsWith("http") ? path : `${this.apiBase}${path}`;
        const response = await fetch(url, {
            ...options,
            headers: {
                ...options.headers,
                Authorization: `Zoho-oauthtoken ${this.accessToken}`,
                "Content-Type": "application/json",
            },
        });

        if (response.status === 204) return null; // No Content

        const data = await response.json();
        if (!response.ok) {
            console.error(`[ZOHO] API Error (${response.status}):`, data);
            throw new Error(data.message || `Zoho API Error ${response.status}`);
        }

        return data;
    }

    /**
     * SEARCH LEADS
     * Uses COQL or Search API to find leads matching criteria.
     */
    async searchLeads(criteria: string): Promise<ZohoLead[]> {
        // Example criteria: "(Lead_Source:equals:Meta) and (Tag:not_contains:VirginIA)"
        const data = await this.request(`/Leads/search?criteria=${encodeURIComponent(criteria)}`);
        return data?.data || [];
    }

    /**
     * UPDATE LEAD
     * Updates fields like Owner, Status, or any custom field.
     */
    async updateLead(leadId: string, data: Record<string, any>) {
        return this.request(`/Leads/${leadId}`, {
            method: "PUT",
            body: JSON.stringify({ data: [data] }),
        });
    }

    /**
     * ADD TAGS
     * Adds tags to a lead without overwriting existing ones.
     */
    async addTags(leadId: string, tags: string[]) {
        return this.request(`/Leads/${leadId}/actions/add_tags?tag_names=${tags.join(",")}`, {
            method: "POST"
        });
    }

    /**
     * BLUEPRINT TRANSITION
     * Transitions a lead through a blueprint state.
     */
    async transitionBlueprint(leadId: string, transitionId: string, data: Record<string, any> = {}) {
        return this.request(`/Leads/${leadId}/actions/blueprint`, {
            method: "PUT",
            body: JSON.stringify({
                blueprint: [{
                    transition_id: transitionId,
                    data: data
                }]
            })
        });
    }

    /**
     * GET CONTACT/LEAD DATA
     * Fetches full record by ID.
     */
    async getLead(leadId: string): Promise<ZohoLead> {
        const data = await this.request(`/Leads/${leadId}`);
        return data.data[0];
    }
}

export const zohoClient = new ZohoClient();
