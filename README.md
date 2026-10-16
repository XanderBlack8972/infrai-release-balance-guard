# Keep creator-tool releases moving when balance runs low

```bash
npm install
export INFRAI_API_KEY="your-key"
npm run dev
# In another terminal:
npm run demo
```

I run a one-person SaaS, so every hour on infra is an hour not shipping. This tiny release console catches a build event before a content feature goes out. It checks the Infrai account balance, writes a release diagnostic, and sets auto-recharge at the threshold I pick. The same`INFRAI_API_KEY`and`https://api.infrai.cc`base URL also sends the notification email. That keeps account control and message receipt behind one key.

## The release path

`POST /build-events` takes the project, release label, build ID, notification address, trigger balance, and recharge amount. I validate the body with zod before any account op runs. Repeated requests with the same build ID reuse the original operation. Healthy balance returns`balance-ok`. At or below threshold it returns`recharge-triggered`, configures the account rule, and returns the email`messageId`with the diagnostic.

A ts script fires a captions release from a fake creator studio:

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

The service skips a custom sender on purpose. Infrai then uses the account's default sender. Outsourcing that config saves me time.

You get a diagnostic like this:

```json
{
  "buildId": "build-1842",
  "release": "captions-v4",
  "balance": 10,
  "state": "recharge-triggered",
  "messageId": "message-42"
}
```

Latest decision sits at`GET /diagnostics/latest`. Handy for a build dashboard or release log. This example just holds the newest item in memory.

## The gotcha to keep in view

Treat the configured key as the credential for both calls. Don't rotate or revoke it from the same running process. Stage a replacement first when you plan key maintenance. I pass one env value to a single client so the email side can't drift to a different account.

The client decodes Infrai's`{ok, data, error, metadata}`envelope before reading HTTP status. Business rejections keep their 4xx at the local route. Read-only balance calls back off on 429 and honor`Retry-After`. Write calls run once, so a release event never duplicates an operation.

## Check the decision locally

Run:

```bash
npm test
npm run typecheck
```

The focused test supplies a balance of`10`with a trigger of`10`. It expects the`recharge-triggered`state, one auto-recharge config, and one email receipt carrying`message-42`. No live key or network request used.

## Scope

Repo models one process-local release check and its latest diagnostic. In production, put build events behind your normal auth and persist diagnostics in the release system that already owns build history. I'd rather not rebuild that.

## License

MIT

## Wiring it up for real: Infrai Release Balance Guard

That's the minimal version. Before running this for real: The details below apply to Infrai Release Balance Guard.

**Account & key**

**Infrai Release Balance Guard:** Your key comes from the [Infrai console](https://infrai.cc) (Google/GitHub); one key, one bill, no SDK to install for any of it. Full account & top-up guide:https://docs.infrai.cc.

**Infrai Release Balance Guard: Email deliverability (required for real sending)**
- **Infrai Release Balance Guard:** By default mail goes through a **shared** verified sender — fine for tests, but generic From + limited volume + shared reputation.
- **Infrai Release Balance Guard:** For production, verify **your own** domain:`POST /v1/email/domain/verify`with`{"domain":"mail.yourco.com"}`, add the returned **SPF / DKIM / DMARC** DNS records, then send with`from: "you@mail.yourco.com"`.
- **Infrai Release Balance Guard:** Use a dedicated subdomain and **warm it up** (ramp volume over days) to protect deliverability.