import { google } from 'googleapis';
import { getAdminSupabaseClient } from '@/lib/supabase/server';

/**
 * GOOGLE SHEETS SERVICE
 * Handles synchronization of lead data to Google Sheets via OAuth2.
 */
export class GoogleSheetsService {
    
    private static async getOAuthClient(tenantId: string, googleConfig: any) {
        const oauth2Client = new google.auth.OAuth2(
            process.env.GOOGLE_CLIENT_ID,
            process.env.GOOGLE_CLIENT_SECRET,
            `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/integrations/google/callback`
        );

        oauth2Client.setCredentials(googleConfig.tokens);

        // Listen for token refresh events to save new tokens
        oauth2Client.on('tokens', async (tokens) => {
            console.log(`[SHEETS SERVICE] 🔄 Tokens refreshed for tenant ${tenantId}`);
            const supabase = await getAdminSupabaseClient();
            const { data: tenant } = await supabase.from('tenants').select('config').eq('id', tenantId).single();
            const currentConfig = (tenant?.config as any) || {};
            
            const updatedConfig = {
                ...currentConfig,
                google: {
                    ...currentConfig.google,
                    tokens: { ...currentConfig.google.tokens, ...tokens }
                }
            };

            await supabase.from('tenants').update({ config: updatedConfig }).eq('id', tenantId);
        });

        return oauth2Client;
    }

    /**
     * Appends a lead row to the configured Google Sheet.
     */
    static async appendLead(tenantId: string, lead: any) {
        try {
            const supabase = await getAdminSupabaseClient();
            const { data: tenant } = await supabase
                .from('tenants')
                .select('config')
                .eq('id', tenantId)
                .single();

            const config = (tenant?.config as any)?.google;
            
            if (!config || !config.connected || !config.tokens || !config.spreadsheetId) {
                console.log(`[SHEETS SERVICE] ℹ️ Google Sheets not connected or configured for tenant ${tenantId}`);
                return;
            }

            const auth = await this.getOAuthClient(tenantId, config);
            const sheets = google.sheets({ version: 'v4', auth });

            // Prepare row data
            // Columns: Date | Name | Phone | Email | Country | Qualification | Origin | Campaign | Metadata
            const values = [[
                new Date().toLocaleString('es-ES', { timeZone: 'Europe/Madrid' }),
                `${lead.nombre || ''} ${lead.apellido || ''}`.trim(),
                lead.telefono || '',
                lead.email || '',
                lead.pais || '',
                lead.cualificacion || lead.tipo_lead || 'PENDIENTE',
                lead.origen || '',
                lead.campana || '',
                JSON.stringify(lead.metadata || {})
            ]];

            const sheetName = config.sheetName || 'Leads';

            await sheets.spreadsheets.values.append({
                spreadsheetId: config.spreadsheetId,
                range: `${sheetName}!A:A`,
                valueInputOption: 'USER_ENTERED',
                requestBody: {
                    values,
                },
            });

            console.log(`[SHEETS SERVICE] ✅ Lead ${lead.id} synced to Google Sheet ${config.spreadsheetId}`);
        } catch (error: any) {
            console.error(`[SHEETS SERVICE] ❌ Error syncing lead to Google Sheets:`, error.message);
            
            // Log error to system logs
            const supabase = await getAdminSupabaseClient();
            await supabase.from('system_logs').insert({
                tenant_id: tenantId,
                level: 'ERROR',
                message: `Error sincronizando con Google Sheets: ${error.message}`,
                metadata: { leadId: lead.id }
            } as any);
        }
    }
}
