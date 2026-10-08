// Cliente mínimo de la API de GitHub para guardar la carta como commits en el repositorio.
//
// Seguridad:
//  - Solo puede tocar DOS tipos de archivo (lista cerrada en FILE_PATH): data/menu.json y
//    assets/menu/<nombre>.webp. Ninguna ruta se arma con texto que escriba una persona.
//  - El token va solo en la cabecera Authorization y NUNCA aparece en un mensaje de error ni en un registro.
//  - Cada llamada tiene tiempo límite y no usa caché (la carta siempre se lee fresca).
//  - Usa el control de versiones de GitHub (sha): si alguien más cambió el archivo, la escritura se
//    rechaza (GithubConflictError) en vez de pisar sus cambios.

export class GithubError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "GithubError";
    this.status = status;
  }
}

/** El archivo cambió mientras lo editábamos (sha desactualizado). */
export class GithubConflictError extends GithubError {
  constructor(status: number) {
    super(status, "El archivo cambió en GitHub mientras se guardaba.");
    this.name = "GithubConflictError";
  }
}

export type GithubFile = { data: Buffer; sha: string };

export type GithubClient = {
  /** null si el archivo no existe. */
  getFile(filePath: string): Promise<GithubFile | null>;
  /** Crea el archivo (sin `sha`) o lo reemplaza (con el `sha` que se leyó). */
  putFile(filePath: string, data: string | Uint8Array, message: string, sha?: string): Promise<void>;
  /** Borrar algo que ya no existe no es un error. */
  deleteFile(filePath: string, sha: string, message: string): Promise<void>;
};

export type GithubClientOptions = {
  token: string;
  repo: string; // "dueño/repositorio"
  branch?: string;
  fetchImpl?: typeof fetch; // para pruebas
  timeoutMs?: number;
};

const REPO = /^[A-Za-z0-9_.-]{1,100}\/[A-Za-z0-9_.-]{1,100}$/;
const BRANCH = /^[A-Za-z0-9._/-]{1,100}$/;
const FILE_PATH = /^(?:data\/menu\.json|assets\/menu\/[a-z0-9-]{1,200}\.webp)$/;

export function createGithubClient({ token, repo, branch = "main", fetchImpl = fetch, timeoutMs = 20_000 }: GithubClientOptions): GithubClient {
  if (!token || !REPO.test(repo) || !BRANCH.test(branch)) {
    throw new Error("Configuración de GitHub inválida: revisa GITHUB_TOKEN, GITHUB_REPO (dueño/repositorio) y GITHUB_BRANCH.");
  }

  const endpoint = (filePath: string) => {
    if (!FILE_PATH.test(filePath)) throw new Error("Ruta de archivo no permitida.");
    return `https://api.github.com/repos/${repo}/contents/${filePath}`;
  };

  async function call(method: "GET" | "PUT" | "DELETE", url: string, options: { body?: unknown; raw?: boolean } = {}) {
    try {
      return await fetchImpl(url, {
        method,
        cache: "no-store",
        signal: AbortSignal.timeout(timeoutMs),
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: options.raw ? "application/vnd.github.raw+json" : "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
          "User-Agent": "barbecue-garage-panel",
          ...(options.body === undefined ? {} : { "Content-Type": "application/json" }),
        },
        body: options.body === undefined ? undefined : JSON.stringify(options.body),
      });
    } catch {
      // Sin detalles del error original: podría incluir datos de la petición.
      throw new GithubError(0, "No se pudo conectar con GitHub.");
    }
  }

  function failure(response: Response, doing: string): GithubError {
    if (response.status === 401) return new GithubError(401, "GitHub rechazó el token (revisa que GITHUB_TOKEN sea válido y no haya vencido).");
    if (response.status === 403 || response.status === 429) {
      return new GithubError(response.status, "GitHub no permitió la operación (sin permiso de escritura en el repositorio o límite de uso alcanzado).");
    }
    if (response.status === 404) return new GithubError(404, "GitHub no encontró el repositorio o la rama (revisa GITHUB_REPO y GITHUB_BRANCH).");
    return new GithubError(response.status, `GitHub respondió ${response.status} al ${doing}.`);
  }

  const isConflict = (status: number) => status === 409 || status === 422;
  const withRef = (url: string) => `${url}?ref=${encodeURIComponent(branch)}`;

  return {
    async getFile(filePath) {
      const url = withRef(endpoint(filePath));
      const response = await call("GET", url);
      if (response.status === 404) return null;
      if (!response.ok) throw failure(response, "leer un archivo");

      const json = (await response.json()) as { type?: string; sha?: string; content?: string; encoding?: string };
      if (json.type !== "file" || typeof json.sha !== "string") throw new GithubError(response.status, "Respuesta inesperada de GitHub.");

      if (json.encoding === "base64" && typeof json.content === "string" && json.content.length > 0) {
        return { data: Buffer.from(json.content, "base64"), sha: json.sha };
      }
      // Archivos de más de 1 MB: GitHub no manda el contenido en el JSON, se pide en crudo.
      const raw = await call("GET", url, { raw: true });
      if (!raw.ok) throw failure(raw, "leer un archivo");
      return { data: Buffer.from(await raw.arrayBuffer()), sha: json.sha };
    },

    async putFile(filePath, data, message, sha) {
      const content = (typeof data === "string" ? Buffer.from(data, "utf8") : Buffer.from(data)).toString("base64");
      const response = await call("PUT", endpoint(filePath), { body: { message, content, branch, ...(sha ? { sha } : {}) } });
      if (response.ok) return;
      if (isConflict(response.status)) throw new GithubConflictError(response.status);
      throw failure(response, "guardar un archivo");
    },

    async deleteFile(filePath, sha, message) {
      const response = await call("DELETE", endpoint(filePath), { body: { message, sha, branch } });
      if (response.ok || response.status === 404) return;
      if (isConflict(response.status)) throw new GithubConflictError(response.status);
      throw failure(response, "borrar un archivo");
    },
  };
}
