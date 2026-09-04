import { createInterface } from "node:readline";
import { stdin, stdout } from "node:process";

import { GiabanApplication, ownerContext } from "../../server/application/giaban.ts";
import { MemoryStore } from "../../server/persistence/memory/store.ts";
import { handleMcpRequest } from "./server.ts";

const app = new GiabanApplication(new MemoryStore());
const context = ownerContext({ channel: "mcp", clientId: "mcp-stdio" });

const rl = createInterface({ input: stdin, crlfDelay: Infinity });
for await (const line of rl) {
  const trimmed = line.trim();
  if (!trimmed) continue;
  let parsed: { id?: unknown };
  try {
    parsed = JSON.parse(trimmed) as { id?: unknown };
  } catch {
    continue;
  }
  const response = await handleMcpRequest(
    new Request("http://stdio/mcp", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: trimmed,
    }),
    app,
    context,
  );
  if (parsed.id === undefined || parsed.id === null) continue;
  const text = await response.text();
  if (!text) continue;
  stdout.write(text.endsWith("\n") ? text : `${text}\n`);
}
