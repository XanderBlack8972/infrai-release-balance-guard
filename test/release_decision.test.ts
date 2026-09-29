import assert from "node:assert/strict";
import test from "node:test";
import type { InfraiClient } from "../src/infrai_client.js";
import { protectRelease } from "../src/release_decision.js";

test("a captions build at the threshold configures recharge and sends its receipt", async () => {
  const calls: string[] = [];
  const infrai = {
    account: {
      balance: async () => ({ balance: 10 }),
      autorecharge: {
        configure: async (trigger: number, amount: number) => {
          calls.push(`recharge:${trigger}:${amount}`);
          return {};
        }
      }
    },
    email: {
      send: async (to: string, subject: string) => {
        calls.push(`email:${to}:${subject}`);
        return { message_id: "message-42" };
      }
    }
  } as unknown as InfraiClient;

  const result = await protectRelease({
    project: "creator-studio",
    release: "captions-v4",
    buildId: "build-1842",
    notify: "developer@example.com",
    triggerBalance: 10,
    rechargeAmount: 50
  }, infrai);

  assert.equal(result.state, "recharge-triggered");
  assert.equal(result.messageId, "message-42");
  assert.deepEqual(calls, [
    "recharge:10:50",
    "email:developer@example.com:Recharge triggered for creator-studio"
  ]);
});
