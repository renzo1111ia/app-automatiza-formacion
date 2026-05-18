import { getAgentTrackedVariables } from '../lib/actions/inbox';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function main() {
  console.log('Testing getAgentTrackedVariables("6a02c14c-c5db-47fb-8857-99a28d3ee6ec")...');
  const res1 = await getAgentTrackedVariables("6a02c14c-c5db-47fb-8857-99a28d3ee6ec");
  console.log('Result with ID:', JSON.stringify(res1, null, 2));

  console.log('Testing getAgentTrackedVariables(null)...');
  const res2 = await getAgentTrackedVariables(null);
  console.log('Result with null:', JSON.stringify(res2, null, 2));
}

main();
