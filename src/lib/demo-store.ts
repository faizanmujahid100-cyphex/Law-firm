/* eslint-disable @typescript-eslint/no-explicit-any -- Minimal in-memory Firestore adapter, used only in demo mode. */
import "server-only";
import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { createDemoData } from "./demo-data";

export const demoCookie = "amanah_demo";
export function parseDemoSession(value?: string) {
  const match = value?.match(/^([0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})\.(ADMIN|TEAM|CLIENT)$/);
  return match ? { id: match[1], role: match[2] } : null;
}
type Store = { expires: number; collections: Map<string, Map<string, any>> };
const globalDemo = globalThis as typeof globalThis & { amanahDemoStores?: Map<string, Store> };
const stores = globalDemo.amanahDemoStores ??= new Map();
async function store() {
  const session = parseDemoSession((await cookies()).get(demoCookie)?.value);
  const key = session?.id ?? "public";
  for (const [id, value] of stores) if (value.expires < Date.now()) stores.delete(id);
  if (!stores.has(key)) {
    if (stores.size >= 200) stores.delete(stores.keys().next().value!);
    stores.set(key, { expires: Date.now() + 3600000, collections: new Map(Object.entries(createDemoData()).map(([name, rows]) => [name, new Map(rows.map(row => [row.id, structuredClone(row)]))])) });
  }
  return stores.get(key)!;
}
async function collectionData(name: string) {
  const s = await store();
  if (!s.collections.has(name)) s.collections.set(name, new Map());
  return s.collections.get(name)!;
}
function snapshot(id: string, value: any) {
  return { id, exists: value !== undefined, data: () => value === undefined ? undefined : structuredClone(value), get: (key: string) => value?.[key] };
}
function doc(name: string, id: string = randomUUID()) {
  return {
    id,
    get: async () => snapshot(id, (await collectionData(name)).get(id)),
    set: async (value: any, options?: { merge?: boolean }) => { const data = await collectionData(name); data.set(id, structuredClone(options?.merge ? { ...data.get(id), ...value, id } : { ...value, id })); },
    create: async (value: any) => { const data = await collectionData(name); if (data.has(id)) throw new Error("Record already exists"); data.set(id, structuredClone({ ...value, id })); },
    update: async (value: any) => { const data = await collectionData(name); if (!data.has(id)) throw new Error("Record not found"); data.set(id, structuredClone({ ...data.get(id), ...value })); },
    delete: async () => { (await collectionData(name)).delete(id); },
  };
}
function collection(name: string, filters: [string, string, any][] = [], take?: number) {
  return {
    doc: (id?: string) => doc(name, id),
    add: async (value: any) => { const ref = doc(name); await ref.set(value); return ref; },
    where: (field: string, op: string, value: any) => collection(name, [...filters, [field, op, value]], take),
    limit: (count: number) => collection(name, filters, count),
    get: async () => {
      let rows = [...(await collectionData(name)).entries()].filter(([, row]) => filters.every(([field, op, value]) => {
        if (op === "==") return row[field] === value;
        if (op === "in") return value.includes(row[field]);
        throw new Error(`Unsupported demo query: ${op}`);
      }));
      if (take !== undefined) rows = rows.slice(0, take);
      const docs = rows.map(([id, value]) => snapshot(id, value));
      return { docs, empty: !docs.length, size: docs.length };
    },
  };
}
function batch() {
  const writes: (() => Promise<unknown>)[] = [];
  const tx = {
    get: (ref: any) => ref.get(),
    set: (ref: any, value: any, options?: any) => { writes.push(() => ref.set(value, options)); return tx; },
    update: (ref: any, value: any) => { writes.push(() => ref.update(value)); return tx; },
    create: (ref: any, value: any) => { writes.push(() => ref.create(value)); return tx; },
    delete: (ref: any) => { writes.push(() => ref.delete()); return tx; },
    commit: async () => { for (const write of writes) await write(); },
  };
  return tx;
}
// Serialize demo transactions so task claims and payment checks cannot race.
let transactionQueue: Promise<unknown> = Promise.resolve();
export const demoFirestore = {
  collection,
  batch,
  runTransaction: async (fn: (tx: ReturnType<typeof batch>) => Promise<any>) => {
    const run = transactionQueue.then(async () => { const tx = batch(); const result = await fn(tx); await tx.commit(); return result; });
    transactionQueue = run.catch(() => undefined);
    return run;
  },
};
