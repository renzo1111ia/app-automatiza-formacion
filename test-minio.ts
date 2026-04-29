import * as dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.join(process.cwd(), '.env.local') });

import { uploadToMinio } from './src/lib/integrations/minio';

async function testConnection() {
    console.log("🚀 Probando conexión con MinIO...");
    console.log("Endpoint:", process.env.MINIO_ENDPOINT);
    console.log("Bucket:", process.env.MINIO_BUCKET);

    try {
        const testContent = "Prueba de conexión " + new Date().toISOString();
        const buffer = Buffer.from(testContent);
        const key = `test/connection_test_${Date.now()}.txt`;

        console.log("📤 Intentando subir archivo de prueba...");
        const result = await uploadToMinio(key, buffer, 'text/plain');
        console.log("✅ ÉxITO:", result);
    } catch (error: any) {
        console.error("❌ ERROR CRíTICO EN LA PRUEBA:");
        console.error("Nombre:", error.name);
        console.error("Mensaje:", error.message);
        console.error("Metadatos:", JSON.stringify(error.$metadata, null, 2));
    }
}

testConnection();
