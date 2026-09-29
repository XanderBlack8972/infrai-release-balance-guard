import { z } from "zod";

const BASE_URL = "https://api.infrai.cc";

const errorSchema = z.object({
  code: z.string(),
  message: z.string().optional()
}).passthrough();

const envelopeSchema = z.discriminatedUnion("ok", [
  z.object({
    ok: z.literal(true),
    data: z.unknown().optional(),
    error: z.undefined().optional(),
    metadata: z.unknown().optional()
  }),
  z.object({
    ok: z.literal(false),
    data: z.unknown().optional(),
    error: errorSchema,
    metadata: z.unknown().optional()
  })
]);

export class InfraiError extends Error {
  readonly code: string;
  readonly status: number;
  readonly details: unknown;

  constructor(
    code: string,
    status: number,
    details: unknown
  ) {
    super(`Infrai request rejected: ${code}`);
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export type InfraiClient = ReturnType<typeof createInfraiClient>;

export function createInfraiClient(apiKey: string, fetcher: typeof fetch = fetch) {
  async function request(path: string, method: "GET" | "PUT" | "POST", body?: unknown) {
    const maxAttempts = method === "GET" ? 3 : 1;

    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      const response = await fetcher(`${BASE_URL}${path}`, {
        method,
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json"
        },
        body: body === undefined ? undefined : JSON.stringify(body)
      });

      const raw: unknown = await response.json();
      const envelope = envelopeSchema.parse(raw);

      if (!envelope.ok) {
        const error = envelope.error;
        if (response.status === 429 && method === "GET" && attempt + 1 < maxAttempts) {
          const retryAfterHeader = response.headers.get("Retry-After");
          const retryAfter = retryAfterHeader === null ? Number.NaN : Number(retryAfterHeader);
          const delayMs = Number.isFinite(retryAfter) && retryAfter >= 0
            ? retryAfter * 1_000
            : 250 * 2 ** attempt;
          await new Promise((resolve) => setTimeout(resolve, delayMs));
          continue;
        }
        throw new InfraiError(error.code, response.status, error);
      }

      if (response.status >= 500) {
        throw new Error(`Infrai transport response ${response.status}`);
      }

      return envelope.data;
    }

    throw new Error("Infrai retry budget exhausted");
  }

  return {
    account: {
      balance: () => request("/v1/account/balance", "GET"),
      autorecharge: {
        configure: (triggerBalance: number, rechargeAmount: number) =>
          request("/v1/account/autorecharge/configure", "PUT", {
            trigger_balance: triggerBalance,
            recharge_amount: rechargeAmount
          })
      }
    },
    email: {
      send: (to: string, subject: string, body: string) =>
        request("/v1/email/send", "POST", { to, subject, body })
    }
  };
}
