import { google } from 'googleapis';
import { getAdminSupabaseClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const tenantId = searchParams.get('state'); // We passed tenantId as state

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

    if (!code || !tenantId) {
        return NextResponse.redirect(`${appUrl}/dashboard/settings?error=missing_params`);
    }

    const oauth2Client = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
        `${appUrl}/api/integrations/google/callback`
    );

    try {
        // Exchange authorization code for access and refresh tokens
        const { tokens } = await oauth2Client.getToken(code);
        
        const supabase = await getAdminSupabaseClient();

        // 1. Fetch current tenant config
        const { data: tenant, error: fetchError } = await supabase
            .from('tenants')
            .select('config')
            .eq('id', tenantId)
            .single();

        if (fetchError || !tenant) {
            console.error("[GOOGLE CALLBACK] Tenant not found:", tenantId);
            return NextResponse.redirect(`${appUrl}/dashboard/settings?error=tenant_not_found`);
        }

        const currentConfig = (tenant.config as any) || {};
        
        // 2. Update config with new Google tokens
        // We store tokens securely in the JSON config for simplicity in this testing phase
        const updatedConfig = {
            ...currentConfig,
            google: {
                ...(currentConfig.google || {}),
                tokens: tokens,
                connected: true,
                lastConnectedAt: new Date().toISOString()
            }
        };

        const { error: updateError } = await supabase
            .from('tenants')
            .update({ config: updatedConfig })
            .eq('id', tenantId);

        if (updateError) {
            console.error("[GOOGLE CALLBACK] Failed to update tenant config:", updateError);
            return NextResponse.redirect(`${appUrl}/dashboard/settings?error=db_update_failed`);
        }

        console.log(`[GOOGLE CALLBACK] ✅ Successfully connected Google account for tenant ${tenantId}`);
        
        return NextResponse.redirect(`${appUrl}/dashboard/settings?google=success`);
    } catch (error) {
        console.error("[GOOGLE CALLBACK] ❌ Error exchanging token:", error);
        return NextResponse.redirect(`${appUrl}/dashboard/settings?error=google_auth_failed`);
    }
}
