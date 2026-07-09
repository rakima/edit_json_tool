export type JsonValue = null | string | number | boolean | JsonObject | JsonArray;
export type JsonObject = { [key: string]: JsonValue };
export type JsonArray = JsonValue[];

export type JsonNodeType = "object" | "array" | "string" | "number" | "boolean" | "null";

export type JsonTreeNode = {
  id: string;
  key: string;
  value: JsonValue;
  type: JsonNodeType;
  children?: JsonTreeNode[];
};

export type JsonPath = string[];

export type ClipboardPayload =
  | { sourceKind: "root"; items: [{ key: null; value: JsonValue }] }
  | { sourceKind: "object_members"; items: Array<{ key: string; value: JsonValue }> }
  | { sourceKind: "array_items"; items: Array<{ key: null; value: JsonValue }> };

export function getJsonNodeType(value: JsonValue): JsonNodeType {
  if (value === null) return "null";
  if (typeof value === "boolean") return "boolean";
  if (typeof value === "number") return "number";
  if (typeof value === "string") return "string";
  if (Array.isArray(value)) return "array";
  return "object";
}

export function formatJsonValue(value: JsonValue): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean" || value === null) {
    return String(value);
  }
  return JSON.stringify(value, null, 2);
}

export function createEmptyValue(type: JsonNodeType): JsonValue {
  switch (type) {
    case "object":
      return {};
    case "array":
      return [];
    case "string":
      return "";
    case "number":
      return 0;
    case "boolean":
      return false;
    default:
      return null;
  }
}

export function parseJsonValueText(valueText: string, type: JsonNodeType): JsonValue {
  switch (type) {
    case "string":
      return valueText;
    case "number":
      return Number(valueText);
    case "boolean":
      return valueText === "true";
    case "null":
      return null;
    case "object":
      return JSON.parse(valueText || "{}") as JsonObject;
    case "array":
      return JSON.parse(valueText || "[]") as JsonArray;
    default:
      return valueText;
  }
}

export function cloneJsonValue(value: JsonValue): JsonValue {
  if (Array.isArray(value)) return value.map(cloneJsonValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value as JsonObject).map(([key, child]) => [key, cloneJsonValue(child)]));
  }
  return value;
}

function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isArray(value: unknown): value is JsonArray {
  return Array.isArray(value);
}

function nextCopyKey(parent: JsonObject, key: string): string {
  const base = `${key}_copy`;
  if (!(base in parent)) return base;

  let suffix = 2;
  while (`${base}_${suffix}` in parent) {
    suffix += 1;
  }
  return `${base}_${suffix}`;
}

export function getValueAtPath(target: JsonValue, path: JsonPath): JsonValue | undefined {
  if (path.length === 0) return target;
  let current: JsonValue | undefined = target;
  for (const segment of path) {
    if (current === undefined) return undefined;
    if (isArray(current)) {
      current = current[Number(segment)];
    } else if (isObject(current)) {
      current = current[segment];
    } else {
      return undefined;
    }
  }
  return current;
}

export function updateValueAtPath(target: JsonValue, path: JsonPath, nextValue: JsonValue): JsonValue {
  if (path.length === 0) return nextValue;
  const [head, ...rest] = path;
  if (isArray(target)) {
    const nextArray = [...target];
    const current = nextArray[Number(head)] as JsonValue;
    nextArray[Number(head)] = rest.length === 0 ? nextValue : updateValueAtPath(current, rest, nextValue);
    return nextArray;
  }
  if (isObject(target)) {
    const nextObject = { ...(target as JsonObject) };
    if (rest.length === 0) {
      nextObject[head] = nextValue;
    } else {
      nextObject[head] = updateValueAtPath(nextObject[head] as JsonValue, rest, nextValue);
    }
    return nextObject;
  }
  return target;
}

export function removeValueAtPath(target: JsonValue, path: JsonPath): JsonValue {
  if (path.length === 0) return target;
  const [head, ...rest] = path;
  if (isArray(target)) {
    const nextArray = [...target];
    if (rest.length === 0) {
      nextArray.splice(Number(head), 1);
    } else {
      nextArray[Number(head)] = removeValueAtPath(nextArray[Number(head)] as JsonValue, rest);
    }
    return nextArray;
  }
  if (isObject(target)) {
    const nextObject = { ...(target as JsonObject) };
    if (rest.length === 0) {
      delete nextObject[head];
    } else {
      nextObject[head] = removeValueAtPath(nextObject[head] as JsonValue, rest);
    }
    return nextObject;
  }
  return target;
}

export function duplicateValueAtPath(target: JsonValue, path: JsonPath): { data: JsonValue; path: JsonPath } {
  if (path.length === 0) {
    return { data: cloneJsonValue(target), path: [] };
  }

  const parentPath = path.slice(0, -1);
  const key = path[path.length - 1] as string;
  const parent = getValueAtPath(target, parentPath);
  const value = getValueAtPath(target, path);
  if (value === undefined) return { data: target, path };

  if (isArray(parent)) {
    const index = Number(key);
    const nextParent = [...parent];
    nextParent.splice(index + 1, 0, cloneJsonValue(value));
    return {
      data: updateValueAtPath(target, parentPath, nextParent),
      path: [...parentPath, String(index + 1)],
    };
  }

  if (isObject(parent)) {
    const nextParent = { ...parent };
    const nextKey = nextCopyKey(nextParent, key);
    nextParent[nextKey] = cloneJsonValue(value);
    return {
      data: updateValueAtPath(target, parentPath, nextParent),
      path: [...parentPath, nextKey],
    };
  }

  return { data: target, path };
}

export function buildClipboardPayload(target: JsonValue, path: JsonPath): ClipboardPayload | null {
  const value = getValueAtPath(target, path);
  if (value === undefined) return null;
  if (path.length === 0) {
    return { sourceKind: "root", items: [{ key: null, value: cloneJsonValue(value) }] };
  }

  const parent = getValueAtPath(target, path.slice(0, -1));
  if (isArray(parent)) {
    return { sourceKind: "array_items", items: [{ key: null, value: cloneJsonValue(value) }] };
  }

  return { sourceKind: "object_members", items: [{ key: path[path.length - 1] as string, value: cloneJsonValue(value) }] };
}

export function pasteClipboardPayload(target: JsonValue, path: JsonPath, payload: ClipboardPayload): { data: JsonValue; path: JsonPath } {
  if (payload.sourceKind === "root") {
    if (path.length !== 0) {
      throw new Error("pasteRootOnly");
    }
    const rootItem = payload.items[0];
    return { data: cloneJsonValue(rootItem.value), path: [] };
  }

  const selectedValue = getValueAtPath(target, path);
  const parentPath = path.slice(0, -1);
  const parentValue = path.length > 0 ? getValueAtPath(target, parentPath) : undefined;

  if (payload.sourceKind === "array_items") {
    const values = payload.items.map((item) => cloneJsonValue(item.value));
    if (isArray(parentValue)) {
      const index = Number(path[path.length - 1] as string) + 1;
      const nextParent = [...parentValue];
      nextParent.splice(index, 0, ...values);
      return { data: updateValueAtPath(target, parentPath, nextParent), path: [...parentPath, String(index)] };
    }
    if (isArray(selectedValue)) {
      const start = selectedValue.length;
      const nextArray = [...selectedValue, ...values];
      return { data: updateValueAtPath(target, path, nextArray), path: [...path, String(start)] };
    }
    throw new Error("pasteArrayItemOnly");
  }

  if (payload.sourceKind === "object_members") {
    const pasteIntoObject = (objectPath: JsonPath, objectValue: JsonObject) => {
      const nextObject = { ...objectValue };
      let firstKey = "";
      for (const item of payload.items) {
        const key = item.key in nextObject ? nextCopyKey(nextObject, item.key) : item.key;
        nextObject[key] = cloneJsonValue(item.value);
        if (!firstKey) firstKey = key;
      }
      return {
        data: updateValueAtPath(target, objectPath, nextObject),
        path: [...objectPath, firstKey],
      };
    };

    if (isObject(selectedValue)) {
      return pasteIntoObject(path, selectedValue);
    }
    if (isObject(parentValue) && path.length > 0) {
      return pasteIntoObject(parentPath, parentValue);
    }
    throw new Error("pasteObjectMemberOnly");
  }

  return { data: target, path };
}

export function addChildToPath(target: JsonValue, path: JsonPath, key: string, type: JsonNodeType): JsonValue {
  const childValue = createEmptyValue(type);
  if (path.length === 0) {
    if (isObject(target)) {
      return { ...(target as JsonObject), [key]: childValue };
    }
    if (isArray(target)) {
      return [...target, childValue];
    }
    return childValue;
  }
  const [head, ...rest] = path;
  if (isArray(target)) {
    const nextArray = [...target];
    const current = nextArray[Number(head)] as JsonValue;
    nextArray[Number(head)] = rest.length === 0 ? addChildToNode(current, key, type) : addChildToPath(current, rest, key, type);
    return nextArray;
  }
  if (isObject(target)) {
    const nextObject = { ...(target as JsonObject) };
    const currentValue = nextObject[head] as JsonValue;
    nextObject[head] = rest.length === 0 ? addChildToNode(currentValue, key, type) : addChildToPath(currentValue, rest, key, type);
    return nextObject;
  }
  return target;
}

function addChildToNode(target: JsonValue, key: string, type: JsonNodeType): JsonValue {
  if (isArray(target)) {
    return [...target, createEmptyValue(type)];
  }
  if (isObject(target)) {
    return { ...(target as JsonObject), [key]: createEmptyValue(type) };
  }
  return { [key]: createEmptyValue(type) };
}

export function renamePropertyAtPath(target: JsonValue, path: JsonPath, newKey: string): JsonValue {
  if (path.length < 1) return target;
  const parentPath = path.slice(0, -1);
  const currentKey = path[path.length - 1];
  const parentValue = getValueAtPath(target, parentPath);
  if (!parentValue || !isObject(parentValue)) return target;
  if (newKey !== currentKey && newKey in parentValue) {
    throw new Error("Key already exists");
  }
  const nextParentValue = { ...parentValue };
  const childValue = nextParentValue[currentKey];
  delete nextParentValue[currentKey];
  nextParentValue[newKey] = childValue;
  return updateValueAtPath(target, parentPath, nextParentValue);
}

export function buildJsonTree(value: JsonValue, path: JsonPath = []): JsonTreeNode {
  const id = path.join(".") || "root";
  const type = getJsonNodeType(value);
  if (type === "object") {
    const entries = Object.entries(value as JsonObject);
    return {
      id,
      key: path[path.length - 1] ?? "root",
      value,
      type,
      children: entries.map(([childKey]) => buildJsonTree((value as JsonObject)[childKey], [...path, childKey])),
    };
  }
  if (type === "array") {
    return {
      id,
      key: path[path.length - 1] ?? "root",
      value,
      type,
      children: (value as JsonArray).map((childValue, index) => buildJsonTree(childValue, [...path, String(index)])),
    };
  }
  return {
    id,
    key: path[path.length - 1] ?? "root",
    value,
    type,
  };
}
