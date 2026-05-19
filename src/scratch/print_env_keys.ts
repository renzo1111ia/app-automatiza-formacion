import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

console.log("=== ENV KEYS ===");
console.log("SUPABASE_SERVICE_ROLE_KEY length:", process.env.SUPABASE_SERVICE_ROLE_KEY?.length);
console.log("NEXT_PUBLIC_SUPABASE_ANON_KEY length:", process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.length);
console.log("SUPABASE_URL:", process.env.SUPABASE_URL);
