import type {
  PersistedClient,
  Persister,
} from "@tanstack/query-persist-client-core";

const DATABASE = "fuscabot-query-cache";
const STORE = "cache";
const KEY = "persisted-client";

export const indexedDbPersister: Persister = {
  persistClient: (client: PersistedClient) => write(client),
  restoreClient: () => read(),
  removeClient: () => remove(),
};

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function write(client: PersistedClient): Promise<void> {
  const database = await openDatabase();
  await transaction(database, "readwrite", (store) => store.put(client, KEY));
}

async function read(): Promise<PersistedClient | undefined> {
  const database = await openDatabase();
  return await transaction(database, "readonly", (store) => store.get(KEY)) as
    | PersistedClient
    | undefined;
}

async function remove(): Promise<void> {
  const database = await openDatabase();
  await transaction(database, "readwrite", (store) => store.delete(KEY));
}

function transaction(
  database: IDBDatabase,
  mode: IDBTransactionMode,
  operation: (store: IDBObjectStore) => IDBRequest,
): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const tx = database.transaction(STORE, mode);
    const request = operation(tx.objectStore(STORE));
    let result: unknown;
    request.onsuccess = () => result = request.result;
    request.onerror = () => {
      database.close();
      reject(request.error);
    };
    tx.oncomplete = () => {
      database.close();
      resolve(result);
    };
    tx.onerror = () => {
      database.close();
      reject(tx.error);
    };
  });
}
