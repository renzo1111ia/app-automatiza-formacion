
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function checkSlots() {
    const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!url || !key) {
        console.error('Missing credentials');
        return;
    }

    const supabase = createClient(url, key);

    const { data: slots, error } = await supabase
        .from('availability_slots')
        .select('*, advisors(name, tenant_id)')
        .order('day_of_week', { ascending: true })
        .order('start_time', { ascending: true });

    if (error) {
        console.error('Error fetching slots:', error);
        return;
    }

    console.log('--- ALL SLOTS ---');
    slots?.forEach(s => {
        console.log(`Day: ${s.day_of_week} | Time: ${s.start_time} | Advisor: ${s.advisors?.name}`);
    });
}

checkSlots();
