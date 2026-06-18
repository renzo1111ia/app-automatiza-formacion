import { AppointmentService } from "./src/lib/services/appointment-service";

async function main() {
  const tenantId = "47e84fa2-73f3-4e23-9267-1e49d4442f70"; // From previous context
  const leadId = "c89d2c20-80a5-4f30-8d5d-c6a9925fa7d1"; // I will need to get a real lead ID

  // Get a lead first
  const { createClient } = require("@supabase/supabase-js");
  const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  
  const { data: tenant } = await s.from("tenants").select("id").limit(1).single();
  const tId = tenant.id;

  const { data: lead } = await s.from("lead").select("id").eq("tenant_id", tId).limit(1).single();
  const lId = lead.id;

  console.log("Tenant:", tId);
  console.log("Lead:", lId);

  try {
    console.log("--- TEST CHECK AVAILABILITY ---");
    const avail = await AppointmentService.checkAvailability(tId, "2026-06-16", "Europe/Madrid");
    console.log(avail);

    if (avail.available_slots.length > 0) {
      const slot = avail.available_slots[0];
      console.log("--- TEST BOOK APPOINTMENT ---");
      const book = await AppointmentService.bookAppointment(tId, lId, "2026-06-16", slot.madrid_time, "Prueba");
      console.log(book);

      console.log("--- TEST GET APPOINTMENTS ---");
      const apps = await AppointmentService.getLeadAppointments(lId);
      console.log(apps);

      const appId = apps[apps.length - 1].id;

      console.log("--- TEST RESCHEDULE APPOINTMENT ---");
      // Let's reschedule for tomorrow same time
      const resched = await AppointmentService.rescheduleAppointment(appId, "2026-06-17", slot.madrid_time);
      console.log(resched);

      console.log("--- TEST CANCEL APPOINTMENT ---");
      const cancel = await AppointmentService.cancelAppointment(appId);
      console.log(cancel);
    } else {
      console.log("No availability slots found to test booking.");
    }
  } catch (err: any) {
    console.error("ERROR CAUGHT:", err.message);
  }
}

main();
