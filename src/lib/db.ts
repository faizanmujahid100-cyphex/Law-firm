/* eslint-disable @typescript-eslint/no-explicit-any -- Dynamic Firestore document adapter for the existing domain model. */
import "server-only";
import { Timestamp, type WriteBatch } from "firebase-admin/firestore";
import { firestore } from "@/lib/firebase/admin";

type Entity = "user" | "teamProfile" | "serviceCategory" | "service" | "serviceVersion" | "application" | "applicationStatusHistory" | "applicationNote" | "task" | "taskAssignmentHistory" | "taskComment" | "document" | "legalCase" | "caseParty" | "hearing" | "invoice" | "payment" | "expense" | "notification" | "contactMessage" | "auditLog" | "firmSettings" | "fAQ" | "testimonial" | "session";
interface RecordType { [key: string]: any; id: string; name: string; reference: string; question: string; published: boolean; documents: RecordType[]; history: RecordType[]; tasks: RecordType[]; notes: RecordType[]; invoices: RecordType[]; payments: RecordType[]; hearings: RecordType[]; cases: RecordType[]; applications: RecordType[]; comments: RecordType[] }
type Args = { where?: Record<string, any>; include?: Record<string, any>; select?: Record<string, any>; orderBy?: Record<string, any>; take?: number; data?: Record<string, any>; create?: Record<string, any>; update?: Record<string, any>; by?: string[]; _count?: Record<string, any> };
type Table = { findMany(args?: Args): Promise<RecordType[]>; findUnique(args: Args): Promise<RecordType | null>; findUniqueOrThrow(args: Args): Promise<RecordType>; count(args?: Args): Promise<number>; create(args: Args): Promise<RecordType>; createMany(args: { data: Record<string, any>[] }): Promise<{ count: number }>; update(args: Args): Promise<RecordType>; updateMany(args: Args): Promise<{ count: number }>; deleteMany(args: Args): Promise<{ count: number }>; upsert(args: Args): Promise<RecordType>; groupBy(args: Args): Promise<RecordType[]> };

const collections: Record<Entity, string> = { user: "users", teamProfile: "users", serviceCategory: "serviceCategories", service: "services", serviceVersion: "serviceVersions", application: "applications", applicationStatusHistory: "applicationStatusHistory", applicationNote: "applicationNotes", task: "tasks", taskAssignmentHistory: "taskAssignmentHistory", taskComment: "taskComments", document: "documents", legalCase: "legalCases", caseParty: "caseParties", hearing: "hearings", invoice: "invoices", payment: "payments", expense: "expenses", notification: "notifications", contactMessage: "contactMessages", auditLog: "auditLogs", firmSettings: "firmSettings", fAQ: "faqs", testimonial: "testimonials", session: "sessions" };

type Relation = { entity: Entity; many: boolean; foreign?: string; local?: string };
const relations: Partial<Record<Entity, Record<string, Relation>>> = {
  user: { applications: { entity: "application", many: true, foreign: "clientId" }, assignedTasks: { entity: "task", many: true, foreign: "assigneeId" }, cases: { entity: "legalCase", many: true, foreign: "clientId" }, notifications: { entity: "notification", many: true, foreign: "userId" }, teamProfile: { entity: "teamProfile", many: false, local: "id" } },
  teamProfile: { user: { entity: "user", many: false, local: "userId" } },
  service: { versions: { entity: "serviceVersion", many: true, foreign: "serviceId" }, category: { entity: "serviceCategory", many: false, local: "categoryId" }, applications: { entity: "application", many: true, foreign: "serviceId" } },
  application: { client: { entity: "user", many: false, local: "clientId" }, service: { entity: "service", many: false, local: "serviceId" }, version: { entity: "serviceVersion", many: false, local: "versionId" }, history: { entity: "applicationStatusHistory", many: true, foreign: "applicationId" }, notes: { entity: "applicationNote", many: true, foreign: "applicationId" }, tasks: { entity: "task", many: true, foreign: "applicationId" }, documents: { entity: "document", many: true, foreign: "applicationId" }, invoices: { entity: "invoice", many: true, foreign: "applicationId" } },
  task: { application: { entity: "application", many: false, local: "applicationId" }, assignee: { entity: "user", many: false, local: "assigneeId" }, history: { entity: "taskAssignmentHistory", many: true, foreign: "taskId" }, comments: { entity: "taskComment", many: true, foreign: "taskId" }, documents: { entity: "document", many: true, foreign: "taskId" } },
  document: { application: { entity: "application", many: false, local: "applicationId" }, legalCase: { entity: "legalCase", many: false, local: "caseId" }, uploader: { entity: "user", many: false, local: "uploaderId" } },
  legalCase: { client: { entity: "user", many: false, local: "clientId" }, parties: { entity: "caseParty", many: true, foreign: "caseId" }, hearings: { entity: "hearing", many: true, foreign: "caseId" }, documents: { entity: "document", many: true, foreign: "caseId" } },
  invoice: { application: { entity: "application", many: false, local: "applicationId" }, payments: { entity: "payment", many: true, foreign: "invoiceId" } },
  payment: { invoice: { entity: "invoice", many: false, local: "invoiceId" } },
  auditLog: { actor: { entity: "user", many: false, local: "actorId" } },
  notification: { user: { entity: "user", many: false, local: "userId" } },
};

function clean(value: any): any {
  if (value === undefined) return undefined;
  if (value instanceof Timestamp) return value.toDate();
  if (value instanceof Date) return value;
  if (Array.isArray(value)) return value.map(clean);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined).map(([k, v]) => [k, clean(v)]));
  return value;
}

function document(entity: Entity, id: string) { return firestore().collection(collections[entity]).doc(id); }

async function rawOne(entity: Entity, where: Record<string, any>): Promise<any | null> {
  if (entity === "teamProfile") {
    const id = where.userId ?? where.id;
    if (id) { const u = await rawOne("user", { id }); return u?.teamProfile ? { id, userId: id, ...u.teamProfile } : null; }
  }
  if (where.id) { const snap = await document(entity, where.id).get(); return snap.exists ? { id: snap.id, ...clean(snap.data()) } : null; }
  const field = Object.keys(where)[0];
  if (!field) return null;
  const snap = await firestore().collection(collections[entity]).where(field, "==", where[field]).limit(1).get();
  const doc = snap.docs[0];
  return doc ? { id: doc.id, ...clean(doc.data()) } : null;
}

async function rawMany(entity: Entity, where?: Record<string, any>): Promise<any[]> {
  if (entity === "teamProfile") {
    const users = await rawMany("user", { role: "TEAM" });
    return users.filter(u => u.teamProfile).map(u => ({ id: u.id, userId: u.id, ...u.teamProfile }));
  }
  if (typeof where?.id === "string") {
    const found = await rawOne(entity, { id: where.id });
    return found ? [found] : [];
  }
  const scalar = where && Object.entries(where).find(([key, value]) => key !== "id" && key !== "OR" && key !== "AND" && (value === null || ["string", "number", "boolean"].includes(typeof value)));
  let query: FirebaseFirestore.Query = firestore().collection(collections[entity]);
  if (scalar) query = query.where(scalar[0], "==", scalar[1]);
  const snap = await query.get();
  return snap.docs.map(doc => ({ id: doc.id, ...clean(doc.data()) }));
}

async function relation(entity: Entity, record: any, key: string, args?: any): Promise<any> {
  if (entity === "user" && key === "teamProfile") return record.teamProfile ? { id: record.id, userId: record.id, ...record.teamProfile } : null;
  if (entity === "user" && key === "clientProfile") return record.clientProfile ?? null;
  const spec = relations[entity]?.[key];
  if (!spec) return record[key];
  if (spec.many) return queryMany(spec.entity, { ...(typeof args === "object" ? args : {}), where: { ...(typeof args === "object" ? args.where : {}), [spec.foreign!]: record.id } });
  const id = record[spec.local!];
  if (!id) return null;
  return queryOne(spec.entity, { where: { id }, ...(typeof args === "object" ? args : {}) });
}

async function matches(entity: Entity, record: any, where?: Record<string, any>): Promise<boolean> {
  if (!where) return true;
  for (const [key, expected] of Object.entries(where)) {
    if (key === "OR") { if (!(await Promise.all(expected.map((x: any) => matches(entity, record, x)))).some(Boolean)) return false; continue; }
    if (key === "AND") { if (!(await Promise.all(expected.map((x: any) => matches(entity, record, x)))).every(Boolean)) return false; continue; }
    if (relations[entity]?.[key] || (entity === "teamProfile" && key === "user")) {
      if (expected?.some) { const found = await relation(entity, record, key, { where: expected.some, take: 1 }); if (!found?.length) return false; }
      else { const related = await relation(entity, record, key); if (!related || !(await matches(relations[entity]?.[key]?.entity ?? "user", related, expected))) return false; }
      continue;
    }
    const actual = record[key];
    if (expected && typeof expected === "object" && !Array.isArray(expected) && !(expected instanceof Date)) {
      if ("notIn" in expected && expected.notIn.includes(actual)) return false;
      if ("in" in expected && !expected.in.includes(actual)) return false;
      if ("not" in expected && actual === expected.not) return false;
      if ("gte" in expected && !(actual >= expected.gte)) return false;
      if ("lte" in expected && !(actual <= expected.lte)) return false;
      if ("gt" in expected && !(actual > expected.gt)) return false;
      if ("lt" in expected && !(actual < expected.lt)) return false;
      if ("contains" in expected && !(typeof actual === "string" && actual.toLowerCase().includes(String(expected.contains).toLowerCase()))) return false;
      if ("has" in expected && !(Array.isArray(actual) && actual.includes(expected.has))) return false;
      if (!["notIn", "in", "not", "gte", "lte", "gt", "lt", "contains", "has", "mode"].some(k => k in expected) && !(await matches(entity, actual ?? {}, expected))) return false;
    } else if (actual !== expected) return false;
  }
  return true;
}

function sort(records: any[], orderBy?: Record<string, any>) {
  if (!orderBy) return records;
  const [field, direction] = Object.entries(orderBy)[0] ?? [];
  if (!field) return records;
  return records.sort((a, b) => {
    const av = typeof direction === "object" ? a[field]?.[Object.keys(direction)[0]] : a[field];
    const bv = typeof direction === "object" ? b[field]?.[Object.keys(direction)[0]] : b[field];
    const comparison = av === bv ? 0 : av == null ? -1 : bv == null ? 1 : av > bv ? 1 : -1;
    return (direction === "desc" || (typeof direction === "object" && Object.values(direction)[0] === "desc")) ? -comparison : comparison;
  });
}

async function shape(entity: Entity, record: any, args?: Args): Promise<any> {
  if (!record || !args) return record;
  const output: any = args.select ? {} : { ...record };
  for (const [key, value] of Object.entries(args.select ?? args.include ?? {})) {
    if (!value) continue;
    if (key === "_count") {
      output._count = {};
      for (const relationKey of Object.keys(value.select ?? {})) {
        const related = await relation(entity, record, relationKey);
        output._count[relationKey] = Array.isArray(related) ? related.length : related ? 1 : 0;
      }
    } else if (relations[entity]?.[key] || key === "teamProfile" || key === "clientProfile") output[key] = await relation(entity, record, key, value);
    else output[key] = record[key];
  }
  return output;
}

async function queryMany(entity: Entity, args: Args = {}): Promise<any[]> {
  const all = await rawMany(entity, args.where);
  const filtered: any[] = [];
  for (const item of all) if (await matches(entity, item, args.where)) filtered.push(item);
  const ordered = sort(filtered, args.orderBy);
  return Promise.all((args.take ? ordered.slice(0, args.take) : ordered).map(item => shape(entity, item, args)));
}

async function queryOne(entity: Entity, args: Args): Promise<any | null> {
  const simple = args.where && Object.entries(args.where).length === 1 && Object.entries(args.where).every(([, v]) => v === null || ["string", "number", "boolean"].includes(typeof v));
  const found = simple ? await rawOne(entity, args.where!) : (await queryMany(entity, { where: args.where, take: 1 }))[0];
  if (!found || !(await matches(entity, found, args.where))) return null;
  return shape(entity, found, args);
}

function table(entity: Entity, batch?: WriteBatch): Table {
  const write = (ref: FirebaseFirestore.DocumentReference, value: any, merge = false) => batch ? batch.set(ref, clean(value), { merge }) : ref.set(clean(value), { merge });
  return {
    findMany: async args => queryMany(entity, args) as Promise<RecordType[]>,
    findUnique: async args => queryOne(entity, args) as Promise<RecordType | null>,
    findUniqueOrThrow: async args => { const record = await queryOne(entity, args); if (!record) throw new Error(`${entity} not found`); return record as RecordType; },
    count: async args => (await queryMany(entity, { where: args?.where })).length,
    create: async args => {
      const data = { ...args.data };
      const id = data.id ?? firestore().collection(collections[entity]).doc().id;
      delete data.id;
      if (entity === "user") { if (data.teamProfile?.create) data.teamProfile = data.teamProfile.create; if (data.clientProfile?.create) data.clientProfile = data.clientProfile.create; }
      const defaults: Partial<Record<Entity, Record<string, any>>> = { application: { priority: 2 }, applicationStatusHistory: { clientVisible: true }, document: { status: "PENDING" }, invoice: { status: "OPEN" }, payment: { status: "PENDING" }, notification: { readAt: null }, fAQ: { sortOrder: 0 }, testimonial: { sortOrder: 0 } };
      Object.assign(data, { ...(defaults[entity] ?? {}), ...data });
      if (!data.createdAt) data.createdAt = new Date();
      if (["user", "service", "application", "task", "legalCase"].includes(entity)) data.updatedAt = new Date();
      await write(document(entity, id), data);
      return { id, ...data } as unknown as RecordType;
    },
    createMany: async args => { for (const data of args.data) await table(entity, batch).create({ data }); return { count: args.data.length }; },
    update: async args => {
      const old = await queryOne(entity, { where: args.where });
      if (!old) throw new Error(`${entity} not found`);
      if (entity === "teamProfile") {
        const profile = Object.fromEntries(Object.entries(args.data ?? {}).filter(([, value]) => value !== undefined));
        await write(document("user", old.userId), { teamProfile: { ...old, ...profile } }, true);
        return { ...old, ...profile } as unknown as RecordType;
      }
      const data = Object.fromEntries(Object.entries(args.data ?? {}).filter(([, value]) => value !== undefined));
      if (["user", "service", "application", "task", "legalCase"].includes(entity)) data.updatedAt = new Date();
      await write(document(entity, old.id), data, true);
      return { ...old, ...data } as unknown as RecordType;
    },
    updateMany: async args => { const found = await queryMany(entity, { where: args.where }); for (const item of found) await table(entity, batch).update({ where: { id: item.id }, data: args.data }); return { count: found.length }; },
    deleteMany: async args => { const found = await queryMany(entity, { where: args.where }); for (const item of found) { const ref = document(entity, item.id); if (batch) batch.delete(ref); else await ref.delete(); } return { count: found.length }; },
    upsert: async args => { const old = await queryOne(entity, { where: args.where }); return old ? table(entity, batch).update({ where: { id: old.id }, data: args.update }) : table(entity, batch).create({ data: { ...args.create, id: args.where?.id } }); },
    groupBy: async args => { const all = await queryMany(entity, { where: args.where }); const key = args.by?.[0]; if (!key) return []; const groups = new Map<string, number>(); for (const item of all) groups.set(item[key], (groups.get(item[key]) ?? 0) + 1); return [...groups].map(([value, count]) => ({ [key]: value, _count: { _all: count } })) as unknown as RecordType[]; },
  };
}

const names = Object.keys(collections) as Entity[];
type Database = Record<Entity, Table> & { $transaction<T>(fn: (tx: Database) => Promise<T>, options?: any): Promise<T> };
function database(batch?: WriteBatch): Database {
  const result: any = {};
  for (const name of names) result[name] = table(name, batch);
  result.$transaction = async (fn: (tx: Database) => Promise<any>) => {
    const nextBatch = firestore().batch();
    const value = await fn(database(nextBatch));
    await nextBatch.commit();
    return value;
  };
  return result as Database;
}
export const db = database();
