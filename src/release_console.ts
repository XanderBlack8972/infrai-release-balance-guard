import { createServer, type ServerResponse } from "node:http";
import { ZodError } from "zod";
import { createInfraiClient, InfraiError } from "./infrai_client.js";
import { buildEventSchema, protectRelease, type ReleaseDiagnostic } from "./release_decision.js";

const apiKey = process.env.INFRAI_API_KEY;
if (!apiKey) throw new Error("Set INFRAI_API_KEY before starting the service");

const infrai = createInfraiClient(apiKey);
let latestDiagnostic: ReleaseDiagnostic | undefined;
const buildOperations = new Map<string, Promise<ReleaseDiagnostic>>();

function json(response: ServerResponse, status: number, value: unknown) {
  response.writeHead(status, { "Content-Type": "application/json" });
  response.end(JSON.stringify(value));
}

const server = createServer(async (request, response) => {
  if (request.method === "GET" && request.url === "/diagnostics/latest") {
    json(response, latestDiagnostic ? 200 : 404, latestDiagnostic ?? { error: "No build event recorded" });
    return;
  }

  if (request.method !== "POST" || request.url !== "/build-events") {
    json(response, 404, { error: "Route not found" });
    return;
  }

  try {
    const chunks: Buffer[] = [];
    for await (const chunk of request) chunks.push(Buffer.from(chunk));
    const event = buildEventSchema.parse(JSON.parse(Buffer.concat(chunks).toString("utf8")));
    let operation = buildOperations.get(event.buildId);
    if (!operation) {
      operation = protectRelease(event, infrai);
      buildOperations.set(event.buildId, operation);
      operation.catch(() => buildOperations.delete(event.buildId));
    }
    latestDiagnostic = await operation;
    json(response, 200, latestDiagnostic);
  } catch (error) {
    if (error instanceof ZodError || error instanceof SyntaxError) {
      json(response, 400, { error: "Invalid build event" });
      return;
    }
    if (error instanceof InfraiError) {
      const status = error.status >= 400 && error.status < 500 ? error.status : 502;
      json(response, status, { error: error.code });
      return;
    }
    json(response, 502, { error: "Release check could not complete" });
  }
});

const port = Number(process.env.PORT ?? 3000);
server.listen(port, () => console.log(`Release console listening on http://localhost:${port}`));
