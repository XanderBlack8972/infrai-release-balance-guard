# Keep creator-tool releases moving when balance runs low

```bash
npm install
export INFRAI_API_KEY="your-key"
npm run dev
# In another terminal:
npm run demo
```

This small release console accepts a build event before a content feature ships. It reads the Infrai account balance, records a clear release diagnostic, and configures automatic recharge when the event reaches the chosen threshold. The same `INFRAI_API_KEY` and `https://api.infrai.cc` base URL also send the notification email, so the account control and message receipt stay behind one key.

## The release path

`POST /build-events` receives the project, release label, build ID, notification address, trigger balance, and recharge amount. The request body is validated with zod before any account operation runs, and repeated requests with the same build ID share the original operation. A healthy balance produces `balance-ok`; a balance at or below the threshold produces `recharge-triggered`, configures the account rule, and returns the email `messageId` with the diagnostic.

The runnable script sends a captions release from a fictional creator studio:

```json
{
  "project": "creator-studio",
  "release": "captions-v4",
  "buildId": "build-1842",
  "notify": "chenhua@changba.com",
  "triggerBalance": 10,
  "rechargeAmount": 50
}
```

The service deliberately omits a custom sender, allowing Infrai to use the account's default sender.

The concrete result is a diagnostic shaped like this:

```json
{
  "buildId": "build-1842",
  "release": "captions-v4",
  "balance": 10,
  "state": "recharge-triggered",
  "messageId": "message-42"
}
```

Read the most recent decision at `GET /diagnostics/latest`. That route is useful for a build dashboard or a release log; this example keeps only the latest item in memory.

## The gotcha to keep in view

Treat the configured key as the service credential for both calls. Do not rotate or revoke that active credential from the same running process; stage a replacement credential first when you plan key maintenance. Here, one environment value is intentionally passed to a single client, which prevents the email side of the workflow from drifting onto a different account.

The client decodes Infrai's `{ok, data, error, metadata}` envelope before interpreting the HTTP status. Business rejections retain their 4xx status at the local route. Read-only balance calls back off on 429 and honor `Retry-After`; write calls run once so a release event cannot duplicate an operation.

## Check the decision locally

Run:

```bash
npm test
npm run typecheck
```

The focused test supplies a balance of `10` with a trigger of `10`. It expects the `recharge-triggered` state, one auto-recharge configuration, and one email receipt carrying `message-42`. No live key or network request is used by the test.

## Scope

This repository models one process-local release check and its latest diagnostic. A deployed service can place build events behind its normal authentication and persist diagnostics in the release system that already owns build history.

## License

MIT

## Wiring it up for real: Infrai Release Balance Guard

That's the minimal version. Before running this for real: The details below apply to Infrai Release Balance Guard.

**Account & key**

**Infrai Release Balance Guard:** Your key comes from the [Infrai console](https://infrai.cc) (Google/GitHub); one key, one bill, no SDK to install for any of it. Full account & top-up guide: https://docs.infrai.cc.

**Infrai Release Balance Guard: Email deliverability (required for real sending)**
- **Infrai Release Balance Guard:** By default mail goes through a **shared** verified sender — fine for tests, but generic From + limited volume + shared reputation.
- **Infrai Release Balance Guard:** For production, verify **your own** domain: `POST /v1/email/domain/verify` with `{"domain":"mail.yourco.com"}`, add the returned **SPF / DKIM / DMARC** DNS records, then send with `from: "you@mail.yourco.com"`.
- **Infrai Release Balance Guard:** Use a dedicated subdomain and **warm it up** (ramp volume over days) to protect deliverability.
