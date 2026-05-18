import postgres from 'postgres';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function runMigration() {
    console.log('--- Migración de Agendamiento (Agent Maestro) ---');
    
    const query = `
        -- Añadir configuración de agendamiento a las variantes
        ALTER TABLE ai_agent_variants 
        ADD COLUMN IF NOT EXISTS scheduling_config JSONB 
        DEFAULT '{"enabled": false, "duration": 30, "buffer": 15, "advisor_ids": []}';
    `;

    const combinations = [
        'postgresql://postgres:postgres@46.62.193.169:5432/postgres',
        'postgresql://postgres:postgres@localhost:5432/postgres',
        'postgresql://postgres:postgres@db:5432/postgres'
    ];

    for (const url of combinations) {
        const sql = postgres(url, { timeout: 3000 });
        try {
            await sql.unsafe(query);
            console.log('✅ Base de datos preparada para Agendamiento.');
            await sql.end();
            return;
        } catch (e) {
            // Silently try next
        } finally {
            await sql.end();
        }
    }

    console.log('⚠️ No se pudo conectar. Por favor ejecuta esto en Supabase SQL Editor:');
    console.log(query);
}

runMigration();
