import type { ApiRuntime } from "@fuscabot/api";
import type { RequestHandler } from "./$types";

export function _proxyApiRequest(request: Request, runtime: ApiRuntime): Promise<Response> {
  return runtime.fetch(request);
}

export const fallback: RequestHandler = ({ locals, request }) =>
  _proxyApiRequest(request, locals.backend);
