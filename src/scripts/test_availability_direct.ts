import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

import { AppointmentService } from '../lib/services/appointment-service';

async function main() {
  const tenantId = '47e84fa2-73f3-4e23-9267-1e49d4442f70'; // esden
  
  // Tuesday, May 19, 2026
  const date = '2026-05-19'; 
  
  console.log('Running checkAvailability for Tuesday...');
  const res = await AppointmentService.checkAvailability(tenantId, date, 'America/Bogota');
  console.log('RESULT FOR Tuesday (America/Bogota timezone):');
  console.log(JSON.stringify(res, null, 2));
}

main();
