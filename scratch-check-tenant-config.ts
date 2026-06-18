import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

async function main() {
    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    const { data: tenant } = await supabase
        .from("tenants")
        .select("id, name, config")
        .eq("id", "122f5c53-d773-4306-9c79-eaa7b1d4f7f7")
        .single();
    
    console.log("Tenant config for 'Demo - Academia AF':");
    console.log("ID:", tenant?.id);
    console.log("Name:", tenant?.name);
    console.log("Config:", JSON.stringify(tenant?.config, null, 2));
}

main();
