import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import path from "path";

// Load env from root
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

async function seedCalendar() {
    const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!url || !key) return console.error("Missing credentials");

    const supabase = createClient(url, key);
    
    // 1. Get a tenant
    const { data: tenant } = await supabase.from('tenants').select('id').limit(1).single();
    if (!tenant) return console.error("No tenant found");

    console.log(`Seeding calendar for tenant: ${tenant.id}`);

    // 2. Create sample advisors
    const advisors = [
        { tenant_id: tenant.id, name: 'Asesor Senior 1', email: 'asesor1@esden.com', is_active: true },
        { tenant_id: tenant.id, name: 'Asesor Senior 2', email: 'asesor2@esden.com', is_active: true }
    ];

    const { data: createdAdvisors, error: advError } = await supabase
        .from('advisors')
        .upsert(advisors, { onConflict: 'email' })
        .select();

    if (advError) return console.error("Error creating advisors:", advError);
    console.log(`Created/Updated ${createdAdvisors.length} advisors`);

    // 3. Create sample slots for the next 7 days
    const slots = [];
    const now = new Date();
    
    for (const advisor of createdAdvisors) {
        for (let i = 1; i <= 5; i++) {
            const start = new Date(now);
            start.setDate(now.getDate() + i);
            start.setHours(10 + i, 0, 0, 0); 
            
            const end = new Date(start);
            end.setMinutes(start.getMinutes() + 30);

            slots.push({
                tenant_id: tenant.id,
                advisor_id: advisor.id,
                start_time: start.toISOString(),
                end_time: end.toISOString(),
                is_booked: false
            });
        }
    }

    const { error: slotError } = await supabase
        .from('availability_slots')
        .insert(slots);

    if (slotError) console.error("Error creating slots (might already exist):", slotError.message);
    else console.log(`Created ${slots.length} available slots`);
}

seedCalendar();
