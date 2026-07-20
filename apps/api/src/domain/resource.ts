export { CaptureSchema, ResourcePatchSchema } from "@fuscabot/contracts";
export type { Capture as CaptureInput, ResourcePatch } from "@fuscabot/contracts";
import type { Resource as ContractResource } from "@fuscabot/contracts";

export type Resource = ContractResource & { workspaceId: string };
