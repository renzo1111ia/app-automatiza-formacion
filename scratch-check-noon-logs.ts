import { Client } from "pg";
import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error("DATABASE_URL is not set");
    return;
  }
  const client = new Client({ connectionString });
  await client.connect();

  console.log("Fetching all system logs from today:");
  const sysLogsQuery = `
    SELECT created_at, level, message, metadata
    FROM public.system_logs
    WHERE created_at >= '2026-06-15 00:00:00+00'
    ORDER BY created_at ASC;
  `;
  const sysLogs = await client.query(sysLogsQuery);
  console.log(`Found ${sysLogs.rows.length} logs.`);
  sysLogs.rows.forEach((row) => {
    console.log(`[SYS] ${row.created_at.toISOString()} [${row.level}] ${row.message} | Metadata: ${JSON.stringify(row.metadata)}`);
  });

  console.log("\nFetching all chat messages from today:");
  const chatMessagesQuery = `
    SELECT created_at, direction, content, status, lead_id
    FROM public.chat_messages
    WHERE created_at >= '2026-06-15 00:00:00+00'
    ORDER BY created_at ASC;
  `;
  const chatMessages = await client.query(chatMessagesQuery);
  console.log(`Found ${chatMessages.rows.length} messages.`);
  chatMessages.rows.forEach((row) => {
    console.log(`[CHAT] ${row.created_at.toISOString()} [${row.direction}] ${row.content} | Status: ${row.status} | Lead ID: ${row.lead_id}`);
  });

  await client.end();
}

main().catch(console.error);
