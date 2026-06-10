import { Langfuse } from "langfuse";
import { createLogger } from "@/lib/utils/logger";

const log = createLogger("observability.langfuse");

const LANGFUSE_PUBLIC_KEY = process.env.LANGFUSE_PUBLIC_KEY;
const LANGFUSE_SECRET_KEY = process.env.LANGFUSE_SECRET_KEY;
const LANGFUSE_BASE_URL = process.env.LANGFUSE_BASE_URL || "https://us.cloud.langfuse.com";

let langfuseClient: Langfuse | null = null;

if (LANGFUSE_PUBLIC_KEY && LANGFUSE_SECRET_KEY) {
  langfuseClient = new Langfuse({
    publicKey: LANGFUSE_PUBLIC_KEY,
    secretKey: LANGFUSE_SECRET_KEY,
    baseUrl: LANGFUSE_BASE_URL,
  });
  log.info("Langfuse client initialized successfully");
} else {
  log.warn("Langfuse API keys are missing. Tracing is disabled.");
}

export const langfuse = langfuseClient;

export function getLangfuseClient() {
  return langfuseClient;
}
