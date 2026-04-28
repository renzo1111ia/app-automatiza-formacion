import * as dotenv from "dotenv";
import * as path from "path";

// Load env BEFORE other imports that might use process.env
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

import { createClient } from "@supabase/supabase-js";
import { listFiles, deleteFromMinio } from "../lib/integrations/minio";

async function cleanupOrphanedFiles() {
    console.log("🔍 [CLEANUP] Iniciando auditoría de archivos huérfanos en MinIO...");

    const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
        console.error("❌ Error: Credenciales de Supabase no encontradas.");
        return;
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // 1. Get all file_keys from DB
    const { data: dbItems, error } = await supabase
        .from("knowledge_base")
        .select("file_key");

    if (error) {
        console.error("❌ Error consultando base de datos:", error.message);
        return;
    }

    const validKeys = new Set((dbItems || []).map(item => item.file_key));
    console.log(`✅ [DB] Se encontraron ${validKeys.size} archivos registrados.`);

    // 2. List all files in MinIO (under 'kb/' prefix)
    const minioFiles = await listFiles("kb/");
    console.log(`✅ [MINIO] Se encontraron ${minioFiles.length} archivos físicos.`);

    // 3. Find Orphans
    const orphans = minioFiles.filter(file => !validKeys.has(file.Key!));

    if (orphans.length === 0) {
        console.log("✨ [RESULTADO] No se encontraron archivos huérfanos. Todo está limpio.");
        return;
    }

    console.log(`⚠️ [ALERTA] Se encontraron ${orphans.length} archivos huérfanos.`);

    // 4. Delete Orphans
    for (const orphan of orphans) {
        console.log(`🗑️ Borrando archivo huérfano: ${orphan.Key}`);
        await deleteFromMinio(orphan.Key!);
    }

    console.log("🚀 [FIN] Limpieza completada exitosamente.");
}

cleanupOrphanedFiles().catch(console.error);
