import type { Delivery, DeliveryKind, MessageSnapshot } from "../domain/delivery.ts";

export interface DeliveryRepository {
  createPending(
    input: {
      resourceId: string;
      channelId: string;
      discordChannelId: string;
      kind: DeliveryKind;
      snapshot: MessageSnapshot;
    },
  ): Promise<Delivery>;
  markSent(id: string, messageId: string, externalUrl: string): Promise<Delivery>;
  markFailed(id: string, error: string): Promise<Delivery>;
  markUnknown(id: string, error: string): Promise<Delivery>;
  findActive(resourceId: string, channelId: string, kind: DeliveryKind): Promise<Delivery | null>;
}

export class DuplicateDeliveryError extends Error {}

export class InMemoryDeliveryRepository implements DeliveryRepository {
  #rows = new Map<string, Delivery>();
  findActive(resourceId: string, channelId: string, kind: DeliveryKind) {
    return Promise.resolve(
      [...this.#rows.values()].find((row) =>
        row.resourceId === resourceId && row.channelId === channelId && row.kind === kind &&
        (row.status === "pending" || row.status === "sent" || row.status === "unknown")
      ) ?? null,
    );
  }
  async createPending(
    input: {
      resourceId: string;
      channelId: string;
      discordChannelId: string;
      kind: DeliveryKind;
      snapshot: MessageSnapshot;
    },
  ) {
    if (await this.findActive(input.resourceId, input.channelId, input.kind)) {
      throw new DuplicateDeliveryError("Delivery already pending or sent");
    }
    const now = new Date().toISOString();
    const row: Delivery = {
      id: crypto.randomUUID(),
      ...input,
      status: "pending",
      externalMessageId: null,
      externalUrl: null,
      error: null,
      sentAt: null,
      createdAt: now,
      updatedAt: now,
    };
    this.#rows.set(row.id, row);
    return row;
  }
  markSent(id: string, messageId: string, externalUrl: string) {
    return this.update(id, {
      status: "sent",
      externalMessageId: messageId,
      externalUrl,
      sentAt: new Date().toISOString(),
      error: null,
    });
  }
  markFailed(id: string, error: string) {
    return this.update(id, { status: "failed", error });
  }
  markUnknown(id: string, error: string) {
    return this.update(id, { status: "unknown", error });
  }
  private update(id: string, patch: Partial<Delivery>) {
    const current = this.#rows.get(id);
    if (!current) throw new Error("Delivery not found");
    const row = { ...current, ...patch, updatedAt: new Date().toISOString() };
    this.#rows.set(id, row);
    return Promise.resolve(row);
  }
}
