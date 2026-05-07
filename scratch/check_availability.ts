
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config({ path: '.env.local' });
import { AppointmentService } from "../src/lib/services/appointment-service";

async function check() {
    const tenantId = "47e84fa2-73f3-4e23-9267-1e49d4442f70";
    const res = await AppointmentService.checkAvailability(tenantId, "2026-05-07");
    console.log("Availability for May 7th:");
    console.log(JSON.stringify(res, null, 2));
}

check();
