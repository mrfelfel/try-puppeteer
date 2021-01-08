const rayconnect = new Rayconnect(
  {
    scopes: "apps",
    appID: "main",
    space: "main",
    type: "micros",
  },
  undefined,
  true
);

rayconnect.OnConnect(async () => {
  console.log("[RAYConnect]: connected to server");

  const data = await rayconnect.GetGuestAccess();

  console.log(data.token);
});

await sleep(8000);
