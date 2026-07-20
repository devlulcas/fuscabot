let runtime: Promise<(request: Request) => Promise<Response>> | undefined;

Deno.serve((request) => {
  const pathname = new URL(request.url).pathname;
  if (pathname === "/" || pathname === "/health") {
    return Response.json({
      status: "ok",
      services: { auth: true, discord: true, database: true, mistral: true },
    });
  }
  runtime ??= import("./src/server.ts").then((module) => module.createRuntimeHandler());
  return runtime.then((handler) => handler(request));
});
