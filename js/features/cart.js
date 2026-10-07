import { cleanLine } from '../lib/text.js';

// Carrito de pedido. Es lógica pura (sin DOM), por eso se puede probar en Node.
//
// - Cada línea guarda solo: producto, presentación, cantidad y nota.
// - Los precios SIEMPRE se calculan desde el menú; nunca se guardan ni se
//   confían del almacenamiento del navegador.
// - Lo guardado en localStorage se valida al cargar (puede haber sido alterado).

export const MAX_QTY = 20;
export const MAX_LINES = 30;
export const NOTE_MAX = 80;
const STORAGE_KEY = 'bg-pedido-v1';

/** Opciones de compra de un producto: la normal y, si existen, sus presentaciones. */
export function productOptions(product) {
  return [
    { label: 'Individual', variant: null, price: product.price },
    ...(product.variants ?? []).map((v) => ({ label: v.label, variant: v.label, price: v.price })),
  ];
}

/** Precio unitario de una presentación, o null si no existe. */
export function unitPrice(product, variant) {
  if (variant === null || variant === undefined) return product.price;
  return product.variants?.find((v) => v.label === variant)?.price ?? null;
}

const clampQty = (value) => Math.min(Math.max(Number.isInteger(value) ? value : 1, 1), MAX_QTY);

export function createCart({ productsById, storage = null, storageKey = STORAGE_KEY }) {
  let seq = 0;
  const listeners = new Set();

  function sanitizeLine(item) {
    if (typeof item !== 'object' || item === null) return null;
    const product = productsById.get(item.p);
    if (!product || !Number.isInteger(item.q) || item.q < 1) return null;
    const variant = typeof item.v === 'string' ? item.v : null;
    if (unitPrice(product, variant) === null) return null;
    return {
      id: `l${++seq}`,
      productId: product.id,
      variant,
      qty: clampQty(item.q),
      note: cleanLine(item.n, NOTE_MAX),
    };
  }

  function restore() {
    if (!storage) return [];
    try {
      const data = JSON.parse(storage.getItem(storageKey) ?? 'null');
      if (!data || data.v !== 1 || !Array.isArray(data.lines)) return [];
      return data.lines.slice(0, MAX_LINES).map(sanitizeLine).filter(Boolean);
    } catch {
      return [];
    }
  }

  let lines = restore();

  function persist() {
    if (!storage) return;
    try {
      const data = { v: 1, lines: lines.map((l) => ({ p: l.productId, v: l.variant, q: l.qty, n: l.note })) };
      storage.setItem(storageKey, JSON.stringify(data));
    } catch {
      /* almacenamiento lleno o bloqueado: el carrito sigue funcionando en memoria */
    }
  }

  function emit(reason) {
    persist();
    for (const listener of listeners) listener(reason);
  }

  function view(line) {
    const product = productsById.get(line.productId);
    const unit = unitPrice(product, line.variant);
    return Object.freeze({
      id: line.id,
      product,
      variant: line.variant,
      name: line.variant ? `${product.name} (${line.variant})` : product.name,
      qty: line.qty,
      note: line.note,
      unit,
      total: unit * line.qty,
    });
  }

  const find = (id) => lines.find((l) => l.id === id);

  return {
    /** Agrega al pedido. Devuelve la línea, o null si no se pudo. */
    add(productId, { variant = null, qty = 1, note = '' } = {}) {
      const product = productsById.get(productId);
      if (!product || unitPrice(product, variant) === null) return null;
      const clean = cleanLine(note, NOTE_MAX);
      const existing = lines.find((l) => l.productId === productId && l.variant === variant && l.note === clean);
      if (existing) {
        existing.qty = Math.min(MAX_QTY, existing.qty + clampQty(qty));
        emit('qty');
        return view(existing);
      }
      if (lines.length >= MAX_LINES) return null;
      const line = { id: `l${++seq}`, productId, variant, qty: clampQty(qty), note: clean };
      lines.push(line);
      emit('add');
      return view(line);
    },

    setQty(id, qty) {
      const line = find(id);
      if (!line) return;
      if (!(qty >= 1)) {
        this.remove(id);
        return;
      }
      line.qty = clampQty(Math.trunc(qty));
      emit('qty');
    },

    /** Suma o resta unidades de la presentación normal (usado por el botón rápido +/−). */
    adjust(productId, delta) {
      const line = [...lines].reverse().find((l) => l.productId === productId && l.variant === null);
      if (!line) return delta > 0 ? this.add(productId) : null;
      this.setQty(line.id, line.qty + delta);
      return view(line);
    },

    setNote(id, note) {
      const line = find(id);
      if (!line) return;
      line.note = cleanLine(note, NOTE_MAX);
      emit('note');
    },

    remove(id) {
      lines = lines.filter((l) => l.id !== id);
      emit('remove');
    },

    clear() {
      lines = [];
      emit('clear');
    },

    getLines: () => lines.map(view),
    count: () => lines.reduce((sum, l) => sum + l.qty, 0),
    subtotal: () => lines.reduce((sum, l) => sum + view(l).total, 0),
    qtyOf: (productId) => lines.filter((l) => l.productId === productId).reduce((sum, l) => sum + l.qty, 0),

    /** Escucha cambios. Devuelve la función para dejar de escuchar. */
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
