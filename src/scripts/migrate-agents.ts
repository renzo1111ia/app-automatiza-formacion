import postgres from 'postgres';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function runMigration() {
    console.log('--- Intentando Conexión Remota a DB (Agent Maestro) ---');
    
    const query = `
        -- Añadir columnas a ai_agents
        ALTER TABLE ai_agents ADD COLUMN IF NOT EXISTS automation_rules JSONB DEFAULT '{}';
        ALTER TABLE ai_agents ADD COLUMN IF NOT EXISTS crm_config JSONB DEFAULT '{}';

        -- Añadir columnas críticas a ai_agent_variants
        ALTER TABLE ai_agent_variants ADD COLUMN IF NOT EXISTS automation_rules JSONB DEFAULT '{}';
        ALTER TABLE ai_agent_variants ADD COLUMN IF NOT EXISTS crm_config JSONB DEFAULT '{}';
        ALTER TABLE ai_agent_variants ADD COLUMN IF NOT EXISTS knowledge_base_ids UUID[] DEFAULT '{}';
    `;

    const combinations = [
        'postgresql://postgres:postgres@46.62.193.169:5432/postgres',
        'postgresql://postgres:postgres@46.62.193.169:6432/postgres', // Puerto alternativo pgbouncer
        'postgresql://postgres:postgres@localhost:5432/postgres',
        'postgresql://postgres:postgres@db:5432/postgres'
    ];

    for (const url of combinations) {
        console.log(`Probando: ${url}`);
        const sql = postgres(url, { timeout: 4000 });
        try {
            await sql.unsafe(query);
            console.log('✅ ¡CONEXIÓN ESTABLECIDA! Base de datos actualizada.');
            await sql.end();
            return;
        } catch (e: any) {
            console.log(`❌ Falló: ${e.message}`);
        } finally {
            await sql.end();
        }
    }

    console.error('No se pudo establecer conexión directa. Por favor, ejecuta el SQL manualmente en el Dashboard de Supabase.');
    console.log('\n--- SQL A EJECUTAR ---');
    console.log(query);
}

runMigration();
