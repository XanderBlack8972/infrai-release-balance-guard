import { z } from "zod";
import type { InfraiClient } from "./infrai_client.js";

export const buildEventSchema = z.object({
  project: z.string().min(1),
  release: z.string().min(1),
  buildId: z.string().min(1),
  notify: z.string().email(),
  triggerBalance: z.number().nonnegative(),
  rechargeAmount: z.number().positive()
}).strict();

export type BuildEvent = z.infer<typeof buildEventSchema>;

const balanceSchema = z.object({ balance: z.number() }).passthrough();
const messageSchema = z.object({ message_id: z.string() }).passthrough();

export type ReleaseDiagnostic = {
  buildId: string;
  release: string;
  balance: number;
  state: "balance-ok" | "recharge-triggered";
  messageId?: string;
};

export async function protectRelease(
  event: BuildEvent,
  infrai: InfraiClient
): Promise<ReleaseDiagnostic> {
  const balanceData = balanceSchema.parse(await infrai.account.balance());

  if (balanceData.balance > event.triggerBalance) {
    return {
      buildId: event.buildId,
      release: event.release,
      balance: balanceData.balance,
      state: "balance-ok"
    };
  }

  await infrai.account.autorecharge.configure(event.triggerBalance, event.rechargeAmount);
  const emailData = messageSchema.parse(await infrai.email.send(
    event.notify,
    `Recharge triggered for ${event.project}`,
    `Build ${event.buildId} for release ${event.release} reached the recharge threshold. Current balance: ${balanceData.balance}.`
  ));

  return {
    buildId: event.buildId,
    release: event.release,
    balance: balanceData.balance,
    state: "recharge-triggered",
    messageId: emailData.message_id
  };
}
