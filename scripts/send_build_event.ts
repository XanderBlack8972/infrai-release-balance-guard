const port = Number(process.env.PORT ?? 3000);

const response = await fetch(`http://localhost:${port}/build-events`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    project: "creator-studio",
    release: "captions-v4",
    buildId: "build-1842",
    notify: "chenhua@changba.com",
    triggerBalance: 10,
    rechargeAmount: 50
  })
});

console.log(JSON.stringify(await response.json(), null, 2));
