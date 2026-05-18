/**
 * GENERIC CRM PROVIDER INTERFACE
 * Standardizes lead operations across different CRMs.
 */

export interface CRMLead {
    id: string;
    fields: Record<string, any>; // Internal system format (nombre, email, telefono, etc.)
    raw?: any;                   // Original CRM format
}

export interface CRMProviderConfig {
    clientId: string;
    clientSecret: string;
    refreshToken: string;
    apiBase?: string;
    tokenUrl?: string;
}

export interface ICRMProvider {
    /**
     * SEARCH LEADS
     * Queries the CRM for leads matching a standardized criteria string.
     */
    searchLeads(criteria: string): Promise<CRMLead[]>;

    /**
     * UPDATE LEAD
     * Updates fields in the CRM using a mapped data object.
     * The keys in 'data' are the CRM's internal field names.
     */
    updateLead(leadId: string, data: Record<string, any>): Promise<any>;

    /**
     * ADD TAGS
     * Appends tags to a lead record.
     */
    addTags(leadId: string, tags: string[]): Promise<any>;

    /**
     * EXECUTE SPECIAL ACTION
     * Triggers CRM-specific logic like Blueprints (Zoho) or Workflows (HubSpot).
     */
    executeAction(leadId: string, actionId: string, data?: any): Promise<any>;

    /**
     * GET LEAD
     * Fetches a lead record by its CRM ID.
     */
    getLead(leadId: string): Promise<CRMLead | null>;

    /**
     * CREATE CALENDAR EVENT
     * Creates a meeting or event in the CRM's calendar.
     */
    createEvent(leadId: string, eventData: { subject: string; startTime: string; durationMinutes: number; description?: string }): Promise<any>;

    /**
     * CREATE TASK
     * Creates a task or activity in the CRM.
     */
    createTask(leadId: string, taskData: { subject: string; description?: string; dueDate?: string; priority?: string }): Promise<any>;
}
