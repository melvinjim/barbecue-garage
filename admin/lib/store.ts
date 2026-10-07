import "server-only";

import { createMenuStore } from "./menu-store.ts";
import { BACKUP_DIR, DATA_FILE } from "./paths.ts";

/** Único punto de acceso a la carta para todo el panel (lectura y escritura con validación). */
export const menuStore = createMenuStore({ dataFile: DATA_FILE, backupDir: BACKUP_DIR });
