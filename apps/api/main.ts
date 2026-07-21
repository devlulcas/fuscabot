import { createRuntimeHandler } from "./src/server.ts";

Deno.serve(createRuntimeHandler());
