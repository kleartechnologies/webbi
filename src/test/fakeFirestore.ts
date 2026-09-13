/**
 * Just enough of the Admin SDK's Firestore for the payment and publish write
 * paths to run under vitest: documents, equality queries, and transactions
 * whose writes land only when the callback returns (and are dropped when it
 * throws), with Firestore's reads-before-writes rule enforced.
 */
type Data = Record<string, unknown>;

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

function autoId(): string {
  let id = "";
  for (let i = 0; i < 20; i++) id += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  return id;
}

export class FakeDocRef {
  constructor(
    private readonly store: FakeFirestore,
    readonly path: string,
  ) {}

  get id(): string {
    return this.path.slice(this.path.lastIndexOf("/") + 1);
  }

  async get(): Promise<FakeSnapshot> {
    return this.store.snapshot(this.path);
  }

  async set(data: Data, options?: { merge?: boolean }): Promise<void> {
    this.store.write(this.path, data, options?.merge === true);
  }

  async update(data: Data): Promise<void> {
    this.store.patch(this.path, data);
  }
}

export class FakeSnapshot {
  constructor(
    readonly ref: FakeDocRef,
    private readonly value: Data | undefined,
  ) {}

  get exists(): boolean {
    return this.value !== undefined;
  }

  get id(): string {
    return this.ref.id;
  }

  data(): Data | undefined {
    return this.value && { ...this.value };
  }
}

class FakeQuery {
  constructor(
    protected readonly store: FakeFirestore,
    protected readonly path: string,
    private readonly filters: ReadonlyArray<readonly [string, unknown]> = [],
    private readonly max = Number.POSITIVE_INFINITY,
  ) {}

  where(field: string, op: string, value: unknown): FakeQuery {
    if (op !== "==") throw new Error(`FakeFirestore only supports == queries (got ${op})`);
    return new FakeQuery(this.store, this.path, [...this.filters, [field, value]], this.max);
  }

  limit(max: number): FakeQuery {
    return new FakeQuery(this.store, this.path, this.filters, max);
  }

  async get() {
    const docs = this.store
      .list(this.path)
      .filter((snap) => this.filters.every(([field, value]) => snap.data()?.[field] === value))
      .slice(0, this.max);
    return { docs, size: docs.length, empty: docs.length === 0 };
  }
}

class FakeCollection extends FakeQuery {
  doc(id: string = autoId()): FakeDocRef {
    return new FakeDocRef(this.store, `${this.path}/${id}`);
  }
}

export class FakeTransaction {
  private readonly writes: Array<() => void> = [];

  constructor(private readonly store: FakeFirestore) {}

  private assertReading(): void {
    if (this.writes.length) throw new Error("Firestore transactions require all reads to be executed before all writes.");
  }

  async get(ref: FakeDocRef): Promise<FakeSnapshot> {
    this.assertReading();
    return this.store.snapshot(ref.path);
  }

  async getAll(...refs: FakeDocRef[]): Promise<FakeSnapshot[]> {
    this.assertReading();
    return refs.map((ref) => this.store.snapshot(ref.path));
  }

  set(ref: FakeDocRef, data: Data, options?: { merge?: boolean }): this {
    this.writes.push(() => this.store.write(ref.path, data, options?.merge === true));
    return this;
  }

  update(ref: FakeDocRef, data: Data): this {
    this.writes.push(() => this.store.patch(ref.path, data));
    return this;
  }

  commit(): void {
    for (const write of this.writes) write();
  }
}

export class FakeFirestore {
  private docs = new Map<string, Data>();

  doc(path: string): FakeDocRef {
    return new FakeDocRef(this, path);
  }

  collection(path: string): FakeCollection {
    return new FakeCollection(this, path);
  }

  async getAll(...refs: FakeDocRef[]): Promise<FakeSnapshot[]> {
    return refs.map((ref) => this.snapshot(ref.path));
  }

  async runTransaction<T>(fn: (tx: FakeTransaction) => Promise<T>): Promise<T> {
    const tx = new FakeTransaction(this);
    const result = await fn(tx); // a throw here discards every queued write
    const before = new Map(this.docs);
    try {
      tx.commit();
    } catch (error) {
      this.docs = before; // all or nothing, like a real commit
      throw error;
    }
    return result;
  }

  /** Test helper: put a document in place without going through a write path. */
  seed(path: string, data: Data): void {
    this.docs.set(path, { ...data });
  }

  /** Test helper: the stored document, or undefined. */
  read(path: string): Data | undefined {
    const value = this.docs.get(path);
    return value && { ...value };
  }

  /** Test helper: ids of the documents directly inside a collection. */
  ids(collection: string): string[] {
    return this.list(collection).map((snap) => snap.id);
  }

  snapshot(path: string): FakeSnapshot {
    return new FakeSnapshot(new FakeDocRef(this, path), this.docs.get(path));
  }

  write(path: string, data: Data, merge: boolean): void {
    this.docs.set(path, merge ? { ...this.docs.get(path), ...data } : { ...data });
  }

  patch(path: string, data: Data): void {
    const current = this.docs.get(path);
    if (!current) throw new Error(`NOT_FOUND: no document to update at ${path}`);
    this.docs.set(path, { ...current, ...data });
  }

  list(collection: string): FakeSnapshot[] {
    const prefix = `${collection}/`;
    return [...this.docs.keys()]
      .filter((path) => path.startsWith(prefix) && !path.slice(prefix.length).includes("/"))
      .map((path) => this.snapshot(path));
  }
}
