import { parse } from "@babel/parser";
import type { ParserOptions } from "@babel/parser";
import _traverse from "@babel/traverse";
import type { NodePath } from "@babel/traverse";
import type { JSXElement, JSXOpeningElement } from "@babel/types";

import { shortHash } from "./hash";
import { DEFAULT_STAMP_ATTR, type DiscoveredElement } from "./types";

// @babel/traverse is CJS; its callable default lands under `.default` on some
// ESM interop paths and directly on others.
const traverse = ((_traverse as unknown as { default?: typeof _traverse }).default ??
  _traverse) as typeof _traverse;

export interface DiscoverOptions {
  /** Attribute treated as the stamp (excluded from `sig`). Default `data-aun`. */
  attr?: string;
  /** Extra @babel/parser plugins. */
  parserPlugins?: ParserOptions["plugins"];
}

const BASE_PLUGINS: NonNullable<ParserOptions["plugins"]> = [
  "jsx",
  "typescript",
  "decorators-legacy",
  "explicitResourceManagement",
];

/** Parse a JSX/TSX source file into a Babel AST. Throws on syntax errors. */
export function parseSource(code: string, file: string, options: DiscoverOptions = {}) {
  return parse(code, {
    sourceType: "unambiguous",
    sourceFilename: file,
    allowReturnOutsideFunction: true,
    plugins: [...BASE_PLUGINS, ...(options.parserPlugins ?? [])],
  });
}

/** PascalCase a path segment, for the anonymous-component fallback name. */
function pascalCase(input: string): string {
  const out = input
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean)
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join("");
  return out || "Anonymous";
}

/**
 * Component name for a file with no named enclosing function, e.g.
 * `export default function () { ... }`. Uses the file name (or the directory
 * name, for `index.*`) so ids stay deterministic.
 */
export function fallbackComponentName(file: string): string {
  const parts = file.split(/[\\/]/).filter(Boolean);
  let base = (parts.pop() ?? "module").replace(/\.[^.]+$/, "");
  if (/^index$/i.test(base) && parts.length) base = parts[parts.length - 1];
  return pascalCase(base);
}

/**
 * Name of the nearest enclosing named function/class/arrow declaration.
 *
 * Anonymous functions (a `.map()` callback, say) are skipped so elements inside
 * a list render still belong to the component that renders the list. A call
 * wrapper (`memo(...)`, `forwardRef(...)`) is only honoured when the variable it
 * is assigned to looks like a component, so `const rows = items.map(...)` does
 * not become the "component".
 */
function enclosingName(path: NodePath): string | undefined {
  let current: NodePath | null = path.parentPath;
  while (current) {
    const node = current.node;
    if (
      (node.type === "FunctionDeclaration" ||
        node.type === "ClassDeclaration" ||
        node.type === "FunctionExpression" ||
        node.type === "ClassExpression") &&
      node.id
    ) {
      return node.id.name;
    }
    if (
      node.type === "ArrowFunctionExpression" ||
      node.type === "FunctionExpression" ||
      node.type === "ClassExpression"
    ) {
      const parent = current.parentPath?.node;
      if (parent?.type === "VariableDeclarator" && parent.id.type === "Identifier") {
        return parent.id.name;
      }
      if (parent?.type === "AssignmentExpression" && parent.left.type === "Identifier") {
        return parent.left.name;
      }
      if (parent?.type === "CallExpression") {
        const grand = current.parentPath?.parentPath?.node;
        if (
          grand?.type === "VariableDeclarator" &&
          grand.id.type === "Identifier" &&
          /^[A-Z]/.test(grand.id.name)
        ) {
          return grand.id.name;
        }
      }
    }
    current = current.parentPath;
  }
  return undefined;
}

function attributeName(attr: JSXOpeningElement["attributes"][number]): string | undefined {
  if (attr.type !== "JSXAttribute") return undefined;
  const name = attr.name;
  return name.type === "JSXIdentifier" ? name.name : `${name.namespace.name}:${name.name.name}`;
}

/** Sorted static attribute names, excluding the stamp attribute itself. */
function staticAttributeNames(open: JSXOpeningElement, stampAttr: string): string[] {
  const names: string[] = [];
  for (const attr of open.attributes) {
    const name = attributeName(attr);
    if (name === undefined || name === stampAttr) continue;
    names.push(name);
  }
  return names.sort();
}

/**
 * Static text of the element's own children, whitespace-collapsed.
 * Direct children only, so editing a deeply nested label does not invalidate
 * every ancestor's signature.
 */
function staticText(element: JSXElement): string {
  const parts: string[] = [];
  for (const child of element.children) {
    if (child.type === "JSXText") {
      parts.push(child.value);
    } else if (child.type === "JSXExpressionContainer") {
      const expr = child.expression;
      if (expr.type === "StringLiteral") {
        parts.push(expr.value);
      } else if (expr.type === "TemplateLiteral" && expr.expressions.length === 0) {
        parts.push(expr.quasis.map((q) => q.value.cooked ?? "").join(""));
      }
    }
  }
  return parts.join(" ").replace(/\s+/g, " ").trim().slice(0, 120);
}

/**
 * The fuzzy source signature: tag + sorted attribute names + static text.
 *
 * Carries no positions, so it survives reformatting, insertions above the
 * element, and reordering. It also carries no *surroundings* - not the file,
 * not the enclosing component - on purpose. Those are stored as their own
 * fields on the map entry, which is what lets re-matching vary exactly one
 * dimension at a time: a moved file holds component+tag+sig fixed, a renamed
 * component holds file+tag+sig fixed. Folding the component into the hash would
 * make a component rename change the signature, and a renamed component would
 * be indistinguishable from a deleted element.
 */
export function computeSig(input: { tag: string; attrNames: string[]; text: string }): string {
  return shortHash([input.tag, input.attrNames.join(","), input.text].join(" | "));
}

function existingStampValue(
  open: JSXOpeningElement,
  stampAttr: string,
): { has: boolean; value?: string } {
  for (const attr of open.attributes) {
    if (attributeName(attr) !== stampAttr) continue;
    const value = attr.type === "JSXAttribute" ? attr.value : null;
    if (value && value.type === "StringLiteral") return { has: true, value: value.value };
    return { has: true };
  }
  return { has: false };
}

/**
 * Find every stampable JSX host element in one source file.
 *
 * Only lowercase host elements are returned: fragments, capitalized component
 * elements and member/namespaced element names are not DOM nodes and cannot
 * carry a stamp. Ordinals are counted per (component, tag initial) rather than
 * strictly per tag so two tags sharing an initial (`<button>` / `<br>`) can
 * never collide on the same id.
 */
export function discoverElements(
  code: string,
  file: string,
  options: DiscoverOptions = {},
): DiscoveredElement[] {
  const stampAttr = options.attr ?? DEFAULT_STAMP_ATTR;
  const ast = parseSource(code, file, options);
  const fallback = fallbackComponentName(file);
  const counters = new Map<string, number>();
  const found: DiscoveredElement[] = [];

  traverse(ast, {
    JSXElement(path) {
      const open = path.node.openingElement;
      const name = open.name;
      if (name.type !== "JSXIdentifier") return; // member/namespaced: not a host element
      const tag = name.name;
      if (!/^[a-z]/.test(tag)) return; // capitalized: a component, not a DOM node

      const component = enclosingName(path) ?? fallback;
      const initial = tag[0].toLowerCase();
      const counterKey = `${component} ${initial}`;
      const ordinal = (counters.get(counterKey) ?? 0) + 1;
      counters.set(counterKey, ordinal);

      const attrNames = staticAttributeNames(open, stampAttr);
      const text = staticText(path.node);
      const sig = computeSig({ tag, attrNames, text });
      const stamp = existingStampValue(open, stampAttr);
      const attrs = open.attributes;
      const insertPos =
        (attrs.length ? attrs[attrs.length - 1].end : name.end) ?? name.end ?? open.start ?? 0;

      found.push({
        id: `${component}.${initial}${ordinal}`,
        file,
        component,
        tag,
        sig,
        ordinal,
        initial,
        insertPos,
        hasStamp: stamp.has,
        existingStamp: stamp.value,
        line: open.loc?.start.line ?? 0,
        column: open.loc?.start.column ?? 0,
      });
    },
  });

  return found;
}

/**
 * Ids that more than one element in the project would claim by default.
 *
 * Possible when two files declare components with the same name. Callers should
 * surface these: a tour pointing at a colliding id is ambiguous.
 */
export function findIdCollisions(
  elements: readonly { id: string; file: string }[],
): { id: string; files: string[] }[] {
  const byId = new Map<string, Set<string>>();
  for (const el of elements) {
    let files = byId.get(el.id);
    if (!files) byId.set(el.id, (files = new Set()));
    files.add(el.file);
  }
  const collisions: { id: string; files: string[] }[] = [];
  for (const [id, files] of byId) {
    if (files.size > 1) collisions.push({ id, files: [...files].sort() });
  }
  return collisions.sort((a, b) => a.id.localeCompare(b.id));
}
