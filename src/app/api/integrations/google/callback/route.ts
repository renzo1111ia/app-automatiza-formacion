import { google } from 'googleapis';
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const tenantId = searchParams.get('state'); // We passed tenantId in state

    if (!code || !tenantId) {
        return NextResponse.json({ error: 'Missing code or tenantId' }, { status: 400 });
    }

    const oauth2Client = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
        `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/integrations/google/callback`
    );

    try {
        const { tokens } = await oauth2Client.getToken(code);
        
        // Save tokens to Supabase
        const supabase = createClient(
            process.env.SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!
        );

        // Fetch current config
        const { data: tenant } = await supabase.from('tenants').select('config').eq('id', tenantId).single();
        const currentConfig = tenant?.config || {};

        const updatedConfig = {
            ...currentConfig,
            google: {
                ...(currentConfig.google || {}),
                connected: true,
                tokens: tokens,
                connectedAt: new Date().toISOString()
            }
        };

        await supabase.from('tenants').update({ config: updatedConfig }).eq('id', tenantId);

        // Redirect back to settings
        return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/dashboard/settings?google=success`);
    } catch (error) {
        console.error('[GOOGLE CALLBACK] Error:', error);
        return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/dashboard/settings?google=error`);
    }
}
