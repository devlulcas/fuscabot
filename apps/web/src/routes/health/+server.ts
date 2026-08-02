import type { RequestHandler } from "./$types";

export const GET: RequestHandler = ({ locals, request }) => locals.backend.fetch(request);
