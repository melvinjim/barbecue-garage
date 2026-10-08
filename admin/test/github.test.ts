import assert from "node:assert/strict";
import { test } from "node:test";
import { GithubConflictError, GithubError, createGithubClient } from "../lib/github.ts";
import { createGithubImageStore, createGithubMenuStore } from "../lib/github-store.ts";
import type { RawMenu } from "../lib/menu-types.ts";
import { MenuValidationError } from "../lib/menu-store.ts";

// "GitHub falso" en memoria: imita la parte de la API de contenidos que usa el panel,
// incluida la regla clave (si el sha no coincide, rechaza la escritura).

const TOKEN = "ghp_SECRETO_NO_DEBE_SALIR_EN_NINGUN_ERROR";
const REPO = "dueno/repositorio";

type FakeFile = { data: Buffer; sha: string };

function fakeGithub(initial: Record<string, string | Buffer> = {}) {
  const files = new Map<string, FakeFile>();
  let counter = 0;
  const sha = () => `sha-${++counter}`;
  for (const [file, data] of Object.entries(initial)) files.set(file, { data: Buffer.from(data), sha: sha() });

  const log: string[] = [];
  const headersSeen: Record<string, string>[] = [];
  const hooks: { beforePut?: (file: string) => void; failWith?: number } = {};

  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

  const fetchImpl = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(String(input));
    const method = init?.method ?? "GET";
    const file = decodeURIComponent(url.pathname.replace(/^\/repos\/[^/]+\/[^/]+\/contents\//, ""));
    const body = init?.body ? (JSON.parse(String(init.body)) as { sha?: string; content?: string; message?: string; branch?: string }) : undefined;
    headersSeen.push(init?.headers as Record<string, string>);
    log.push(`${method} ${file}`);
    if (hooks.failWith) return json({ message: "boom" }, hooks.failWith);

    const existing = files.get(file);
    if (method === "GET") {
      if (!existing) return json({ message: "Not Found" }, 404);
      return json({ type: "file", sha: existing.sha, encoding: "base64", content: existing.data.toString("base64") });
    }
    if (method === "PUT") {
      hooks.beforePut?.(file);
      const current = files.get(file);
      if (current && body?.sha !== current.sha) return json({ message: "sha mismatch" }, 409);
      if (!current && body?.sha) return json({ message: "no existe" }, 422);
      files.set(file, { data: Buffer.from(body?.content ?? "", "base64"), sha: sha() });
      return json({ content: { sha: files.get(file)?.sha } }, current ? 200 : 201);
    }
    if (method === "DELETE") {
      if (!existing) return json({ message: "Not Found" }, 404);
      if (body?.sha !== existing.sha) return json({ message: "sha mismatch" }, 409);
      files.delete(file);
      return json({}, 200);
    }
    return json({}, 405);
  }) as typeof fetch;

  return { files, log, headersSeen, hooks, fetchImpl, newSha: sha };
}

const menu = (extra: Partial<RawMenu> = {}): RawMenu => ({
  categories: [{ id: "burgers", name: "Burgers" }],
  recommended: [],
  products: [{ id: "gaucha", name: "Gaucha", price: 34900, categories: ["burgers"] }],
  ...extra,
});

const setup = (initial: Record<string, string | Buffer> = {}) => {
  const fake = fakeGithub({ "data/menu.json": JSON.stringify(menu()), ...initial });
  const client = createGithubClient({ token: TOKEN, repo: REPO, branch: "main", fetchImpl: fake.fetchImpl });
  return { fake, client, store: createGithubMenuStore({ client }) };
};

const saved = (fake: ReturnType<typeof fakeGithub>): RawMenu => JSON.parse(fake.files.get("data/menu.json")?.data.toString("utf8") ?? "{}") as RawMenu;

test("cliente: la configuración inválida se rechaza antes de hacer nada", () => {
  const bad = [
    { token: "", repo: REPO },
    { token: TOKEN, repo: "sin-barra" },
    { token: TOKEN, repo: "a/b/c" },
    { token: TOKEN, repo: "../../etc/passwd" },
    { token: TOKEN, repo: REPO, branch: "main; rm -rf" },
    { token: TOKEN, repo: REPO, branch: "" },
  ];
  for (const options of bad) assert.throws(() => createGithubClient(options), /Configuración de GitHub inválida/);
});

test("cliente: solo toca data/menu.json y fotos assets/menu/<nombre>.webp", async () => {
  const { client } = setup();
  for (const strange of ["admin/.env.local", "data/site.json", "../data/menu.json", "assets/menu/../../x.webp", "assets/menu/MAYUS.webp", "assets/menu/a.png", ".github/workflows/x.yml", "data/menu.json/../../x"]) {
    await assert.rejects(() => client.getFile(strange), /no permitida/, strange);
    await assert.rejects(() => client.putFile(strange, "x", "m"), /no permitida/, strange);
    await assert.rejects(() => client.deleteFile(strange, "s", "m"), /no permitida/, strange);
  }
});

test("cliente: manda el token solo en la cabecera y nunca lo deja en un error", async () => {
  const { fake, client } = setup();
  await client.getFile("data/menu.json");
  assert.equal(fake.headersSeen[0].Authorization, `Bearer ${TOKEN}`);

  for (const status of [401, 403, 429, 500]) {
    fake.hooks.failWith = status;
    await assert.rejects(
      () => client.getFile("data/menu.json"),
      (error: unknown) => error instanceof GithubError && error.status === status && !error.message.includes(TOKEN),
      String(status),
    );
  }

  const exploding = createGithubClient({
    token: TOKEN,
    repo: REPO,
    fetchImpl: (async () => {
      throw new Error(`fallo de red con ${TOKEN}`);
    }) as typeof fetch,
  });
  await assert.rejects(
    () => exploding.getFile("data/menu.json"),
    (error: unknown) => error instanceof GithubError && !error.message.includes(TOKEN) && !String((error as Error).stack).includes(TOKEN),
  );
});

test("cliente: crear, leer, reemplazar y borrar; conflicto si el sha está viejo", async () => {
  const fake = fakeGithub();
  const client = createGithubClient({ token: TOKEN, repo: REPO, fetchImpl: fake.fetchImpl });
  const file = "assets/menu/nueva-1a2b3c4d.webp";

  assert.equal(await client.getFile(file), null);
  await client.putFile(file, new Uint8Array([1, 2, 3]), "foto");
  const first = await client.getFile(file);
  assert.deepEqual([...(first?.data ?? [])], [1, 2, 3]);

  await assert.rejects(() => client.putFile(file, new Uint8Array([9]), "otra vez"), GithubConflictError, "existe y no se mandó sha");
  await assert.rejects(() => client.putFile(file, new Uint8Array([9]), "viejo", "sha-viejo"), GithubConflictError);
  await client.putFile(file, new Uint8Array([4, 5]), "ok", first?.sha);

  await assert.rejects(() => client.deleteFile(file, "sha-viejo", "borrar"), GithubConflictError);
  const second = await client.getFile(file);
  await client.deleteFile(file, second?.sha ?? "", "borrar");
  assert.equal(await client.getFile(file), null);
  await assert.doesNotReject(() => client.deleteFile(file, "x", "ya no existe"), "borrar lo inexistente no falla");
});

test("carta: leer y guardar un cambio como commit; se conserva todo lo demás", async () => {
  const { fake, store } = setup();
  assert.equal((await store.read()).products.length, 1);

  const result = await store.update((current) => {
    current.products.push({ id: "otra", name: "Otra", price: 100, categories: ["burgers"] });
    return "listo";
  }, "crear producto Otra");

  assert.equal(result, "listo");
  assert.deepEqual(saved(fake).products.map((p) => p.id), ["gaucha", "otra"]);
  assert.ok(fake.log.includes("PUT data/menu.json"));
});

test("carta: si el cambio dejaría la carta inválida, NO se escribe nada", async () => {
  const { fake, store } = setup();
  const before = fake.files.get("data/menu.json")?.sha;

  await assert.rejects(
    () => store.update((current) => void (current.products[0].categories = ["no-existe"])),
    MenuValidationError,
  );
  await assert.rejects(() => store.update((current) => void (current.products[0].price = -5)), MenuValidationError);

  assert.equal(fake.files.get("data/menu.json")?.sha, before, "el archivo no cambió");
  assert.equal(fake.log.filter((line) => line.startsWith("PUT")).length, 0);
});

test("carta: si otra persona guardó en medio, se vuelve a leer y se reaplica el cambio sin perder el suyo", async () => {
  const { fake, store } = setup();
  let intruded = false;
  fake.hooks.beforePut = (file) => {
    if (file !== "data/menu.json" || intruded) return;
    intruded = true; // otra instancia guarda justo antes que nosotros
    const other = menu({ products: [...menu().products, { id: "ajena", name: "Ajena", price: 1, categories: ["burgers"] }] });
    fake.files.set("data/menu.json", { data: Buffer.from(JSON.stringify(other)), sha: fake.newSha() });
  };

  let runs = 0;
  await store.update((current) => {
    runs += 1;
    current.products.push({ id: "mia", name: "Mía", price: 2, categories: ["burgers"] });
  });

  assert.equal(runs, 2, "el cambio se reaplicó sobre la versión nueva");
  assert.deepEqual(saved(fake).products.map((p) => p.id), ["gaucha", "ajena", "mia"]);
});

test("carta: con conflictos permanentes se rinde con un error en vez de insistir para siempre", async () => {
  const { fake, store } = setup();
  fake.hooks.beforePut = () => {
    fake.files.set("data/menu.json", { data: Buffer.from(JSON.stringify(menu())), sha: fake.newSha() });
  };
  let runs = 0;
  await assert.rejects(() => store.update(() => void (runs += 1)), GithubConflictError);
  assert.equal(runs, 4);
});

test("carta: dos guardados a la vez en la misma instancia se aplican uno tras otro", async () => {
  const { fake, store } = setup();
  const add = (id: string) => store.update((current) => void current.products.push({ id, name: id, price: 1, categories: ["burgers"] }));
  await Promise.all([add("a"), add("b"), add("c")]);
  assert.deepEqual(saved(fake).products.map((p) => p.id), ["gaucha", "a", "b", "c"]);
});

test("carta: el mensaje del commit va en una línea y sin caracteres raros", async () => {
  const { fake, store } = setup();
  let message = "";
  const original = fake.fetchImpl;
  const spying = (async (input: string | URL | Request, init?: RequestInit) => {
    if ((init?.method ?? "GET") === "PUT") message = (JSON.parse(String(init?.body)) as { message: string }).message;
    return original(input, init);
  }) as typeof fetch;
  const client = createGithubClient({ token: TOKEN, repo: REPO, fetchImpl: spying });
  const nul = String.fromCharCode(0);
  await createGithubMenuStore({ client }).update(() => undefined, `producto\nmalicioso${nul} ${"x".repeat(200)}`);
  assert.ok(!message.includes("\n") && !message.includes(nul));
  assert.ok(message.startsWith("Carta: producto malicioso"));
  assert.ok(message.length <= 80);
});

test("carta: si falta data/menu.json o GitHub falla, lo dice con claridad", async () => {
  const empty = fakeGithub();
  const client = createGithubClient({ token: TOKEN, repo: REPO, fetchImpl: empty.fetchImpl });
  await assert.rejects(() => createGithubMenuStore({ client }).read(), /No se encontró data\/menu\.json/);

  const { fake, store } = setup();
  fake.hooks.failWith = 500;
  await assert.rejects(() => store.read(), GithubError);
});

test("fotos: guardar, leer y borrar en GitHub; el nombre se vuelve a comprobar", async () => {
  const fake = fakeGithub();
  const client = createGithubClient({ token: TOKEN, repo: REPO, fetchImpl: fake.fetchImpl });
  const images = createGithubImageStore(client);

  await images.put("gaucha-1a2b3c4d.webp", new Uint8Array([7, 7, 7]));
  assert.deepEqual([...((await images.get("gaucha-1a2b3c4d.webp")) ?? [])], [7, 7, 7]);
  assert.ok(fake.files.has("assets/menu/gaucha-1a2b3c4d.webp"));
  assert.equal(await images.get("otra-ffffffff.webp"), null);

  await images.remove("gaucha-1a2b3c4d.webp");
  assert.equal(fake.files.size, 0);
  await assert.doesNotReject(() => images.remove("gaucha-1a2b3c4d.webp"), "borrar lo inexistente no falla");

  for (const strange of ["../x.webp", "a/b.webp", "MAYUS.webp", "x.png", ".env", "x.webp/../../y"]) {
    await assert.rejects(() => images.put(strange, new Uint8Array([1])), /no permitido/, strange);
    await assert.rejects(() => images.get(strange), /no permitido/, strange);
    await assert.rejects(() => images.remove(strange), /no permitido/, strange);
  }
});
