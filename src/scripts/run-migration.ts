import postgres from 'postgres';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const migrationSql = fs.readFileSync(path.resolve(process.cwd(), 'supabase/migrations/20260427_web_widgets.sql'), 'utf8');

async function tryConnect(url: string) {
    console.log(`Trying ${url}...`);
    const sql = postgres(url, { timeout: 5000 });
    try {
        await sql.unsafe(migrationSql);
        console.log('✅ Migration success with:', url);
        return true;
    } catch (e) {
        console.error('❌ Failed:', (e as Error).message);
        return false;
    } finally {
        await sql.end();
    }
}

async function main() {
    const combinations = [
        'postgresql://postgres:postgres@localhost:5432/postgres',
        'postgresql://postgres:postgres@db:5432/postgres',
        'postgresql://postgres:postgres@127.0.0.1:5432/postgres',
        // Try to derive from SUPABASE_URL
        'postgresql://postgres:postgres@interno-supabase-a201be-46-62-193-169:5432/postgres'
    ];

    for (const url of combinations) {
        if (await tryConnect(url)) break;
    }
}

main();
