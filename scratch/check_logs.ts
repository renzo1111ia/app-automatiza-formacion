import { getSystemLogs } from "./src/lib/actions/orchestration";

async function checkLogs() {
    console.log("Fetching system logs...");
    const res = await getSystemLogs(20);
    if (res.success) {
        console.log("Recent Logs:", JSON.stringify(res.data, null, 2));
    } else {
        console.log("Error fetching logs:", res.error);
    }
}

checkLogs();
