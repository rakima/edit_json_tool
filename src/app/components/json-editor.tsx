"use client";

import { useMemo, useState, type ChangeEvent, type ReactNode } from "react";

export type JsonValue = null | string | number | boolean | JsonObject | JsonArray;
export type JsonObject = { [key: string]: JsonValue };
export type JsonArray = JsonValue[];

type JsonNodeType = "object" | "array" | "string" | "number" | "boolean" | "null";

type JsonNode = {
  id: string;
  key: string;
  value: JsonValue;
  type: JsonNodeType;
  children?: JsonNode[];
};

type NodePath = string[];

const SAMPLE_JSON: JsonObject = {
  name: "Sample project",
  version: 1,
  enabled: true,
  tags: ["alpha", "beta"],
  metadata: {
    owner: "Ada",
    active: false,
  },
};

function getType(value: JsonValue): JsonNodeType {
  if (value === null) return "null";
  if (typeof value === "boolean") return "boolean";
  if (typeof value === "number") return "number";
  if (typeof value === "string") return "string";
  if (Array.isArray(value)) return "array";
  return "object";
}

function formatValue(value: JsonValue): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean" || value === null) {
    return String(value);
  }
  return JSON.stringify(value, null, 2);
}

function buildTree(value: JsonValue, path: NodePath = []): JsonNode {
  const id = path.join(".") || "root";
  const type = getType(value);
  if (type === "object") {
    const entries = Object.entries(value as JsonObject);
    return {
      id,
      key: path[path.length - 1] ?? "root",
      value,
      type,
      children: entries.map(([childKey]) => buildTree((value as JsonObject)[childKey], [...path, childKey])),
    };
  }
  if (type === "array") {
    return {
      id,
      key: path[path.length - 1] ?? "root",
      value,
      type,
      children: (value as JsonArray).map((childValue, index) => buildTree(childValue, [...path, String(index)])),
    };
  }
  return {
    id,
    key: path[path.length - 1] ?? "root",
    value,
    type,
  };
}

function cloneValue(value: JsonValue): JsonValue {
  if (Array.isArray(value)) return value.map(cloneValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value as JsonObject).map(([k, v]) => [k, cloneValue(v)]));
  }
  return value;
}

function updateValueAtPath(target: JsonValue, path: NodePath, nextValue: JsonValue): JsonValue {
  if (path.length === 0) return nextValue;
  const [head, ...rest] = path;
  if (Array.isArray(target)) {
    const nextArray = [...target];
    const current = nextArray[Number(head)] as JsonValue;
    nextArray[Number(head)] = rest.length === 0 ? nextValue : updateValueAtPath(current, rest, nextValue);
    return nextArray;
  }
  const nextObject = { ...(target as JsonObject) };
  if (rest.length === 0) {
    nextObject[head] = nextValue;
  } else {
    nextObject[head] = updateValueAtPath(nextObject[head] as JsonValue, rest, nextValue);
  }
  return nextObject;
}

function removeValueAtPath(target: JsonValue, path: NodePath): JsonValue {
  if (path.length === 0) return target;
  const [head, ...rest] = path;
  if (Array.isArray(target)) {
    const nextArray = [...target];
    nextArray.splice(Number(head), 1);
    return nextArray;
  }
  const nextObject = { ...(target as JsonObject) };
  if (rest.length === 0) {
    delete nextObject[head];
  } else {
    nextObject[head] = removeValueAtPath(nextObject[head] as JsonValue, rest);
  }
  return nextObject;
}

function addChildToPath(target: JsonValue, path: NodePath, key: string, type: JsonNodeType): JsonValue {
  const childValue = createEmptyValue(type);
  if (path.length === 0) {
    if (target && typeof target === "object" && !Array.isArray(target)) {
      return { ...(target as JsonObject), [key]: childValue };
    }
    return childValue;
  }
  const [head, ...rest] = path;
  if (Array.isArray(target)) {
    const nextArray = [...target];
    const current = nextArray[Number(head)] as JsonValue;
    nextArray[Number(head)] = rest.length === 0 ? addChildToNode(current, key, type) : addChildToPath(current, rest, key, type);
    return nextArray;
  }
  const nextObject = { ...(target as JsonObject) };
  const currentValue = nextObject[head] as JsonValue;
  nextObject[head] = rest.length === 0 ? addChildToNode(currentValue, key, type) : addChildToPath(currentValue, rest, key, type);
  return nextObject;
}

function addChildToNode(target: JsonValue, key: string, type: JsonNodeType): JsonValue {
  if (Array.isArray(target)) {
    return [...target, createEmptyValue(type)];
  }
  if (target && typeof target === "object") {
    return { ...(target as JsonObject), [key]: createEmptyValue(type) };
  }
  return { [key]: createEmptyValue(type) };
}

function createEmptyValue(type: JsonNodeType): JsonValue {
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

function isObject(value: JsonValue): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isArray(value: JsonValue): value is JsonArray {
  return Array.isArray(value);
}

function parseValue(valueText: string, type: JsonNodeType): JsonValue {
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

export function JsonEditor() {
  const [jsonText, setJsonText] = useState(JSON.stringify(SAMPLE_JSON, null, 2));
  const [data, setData] = useState<JsonValue>(SAMPLE_JSON);
  const [selectedPath, setSelectedPath] = useState<NodePath>([]);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"tree" | "text">("tree");
  const [newKey, setNewKey] = useState("newField");
  const [newType, setNewType] = useState<JsonNodeType>("string");
  const [editValue, setEditValue] = useState("");

  const tree = useMemo(() => buildTree(data), [data]);

  const selectedNode = useMemo(() => {
    if (selectedPath.length === 0) {
      return {
        id: "root",
        key: "root",
        value: data,
        type: getType(data),
      } as JsonNode;
    }
    let current: JsonValue = data;
    for (const segment of selectedPath) {
      if (isArray(current)) {
        current = current[Number(segment)];
      } else if (isObject(current)) {
        current = current[segment];
      } else {
        return undefined;
      }
    }
    return {
      id: selectedPath.join("."),
      key: selectedPath[selectedPath.length - 1] ?? "root",
      value: current,
      type: getType(current),
    } as JsonNode;
  }, [data, selectedPath]);

  const selectedType = selectedNode?.type ?? "object";

  const updateSelectedValue = () => {
    if (!selectedNode) return;
    const nextValue = parseValue(editValue, selectedType);
    const nextData = updateValueAtPath(data, selectedPath, nextValue);
    setData(nextData);
    setJsonText(JSON.stringify(nextData, null, 2));
    setError(null);
  };

  const handleLoadJson = () => {
    try {
      const parsed = JSON.parse(jsonText);
      setData(parsed);
      setError(null);
      setSelectedPath([]);
      setActiveTab("tree");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid JSON");
    }
  };

  const handleFileSelect = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    try {
      const parsed = JSON.parse(text);
      setData(parsed);
      setJsonText(text);
      setError(null);
      setSelectedPath([]);
      setActiveTab("tree");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid JSON");
    }
  };

  const handleDownload = () => {
    try {
      const pretty = JSON.stringify(data, null, 2);
      const blob = new Blob([pretty], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "edited.json";
      anchor.click();
      URL.revokeObjectURL(url);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to download JSON");
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(data, null, 2));
      setError(null);
    } catch {
      setError("Clipboard access is unavailable in this browser.");
    }
  };

  const handleAddChild = () => {
    if (!selectedNode) return;
    const nextData = addChildToPath(data, selectedPath, newKey, newType);
    setData(nextData);
    setJsonText(JSON.stringify(nextData, null, 2));
    setError(null);
  };

  const handleRemoveSelected = () => {
    if (!selectedNode) return;
    const nextData = removeValueAtPath(data, selectedPath);
    setData(nextData);
    setJsonText(JSON.stringify(nextData, null, 2));
    setError(null);
  };

  const handleDuplicateSelected = () => {
    if (!selectedNode) return;
    const nextData = updateValueAtPath(data, selectedPath, cloneValue(selectedNode.value));
    setData(nextData);
    setJsonText(JSON.stringify(nextData, null, 2));
    setError(null);
  };

  const handleSelectNode = (path: NodePath) => {
    setSelectedPath(path);
  };

  const renderNode = (node: JsonNode): ReactNode => {
    const isSelected = selectedPath.join(".") === node.id;
    const label = node.key === "root" ? "root" : node.key;
    return (
      <div key={node.id} className="ml-2">
        <button
          type="button"
          className={`tree-node ${isSelected ? "tree-node-active" : ""}`}
          onClick={() => {
            handleSelectNode(node.id === "root" ? [] : node.id.split("."));
            setEditValue(formatValue(node.value));
          }}
        >
          <span className="text-xs font-semibold uppercase text-slate-500">{node.type}</span>
          <span className="ml-2">{label}</span>
        </button>
        {node.children ? <div className="tree-children">{node.children.map((child) => renderNode(child))}</div> : null}
      </div>
    );
  };

  return (
    <main className="container" style={{ paddingTop: "1rem", paddingBottom: "2rem" }}>
      <div className="flex" style={{ flexDirection: "column", gap: "1rem" }}>
        <header className="card p-6">
          <div className="flex" style={{ justifyContent: "space-between", alignItems: "flex-end", gap: "1rem", flexWrap: "wrap" }}>
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-blue-600">edit_json_tool</p>
              <h1 className="text-3xl font-semibold">Browser-based JSON editor</h1>
              <p className="mt-2 text-sm text-slate-600" style={{ maxWidth: "40rem" }}>
                Load JSON from a file or paste it directly, edit the structure, and export a formatted document.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <label className="button-secondary" style={{ padding: "0.65rem 0.9rem" }}>
                Load file
                <input type="file" accept=".json,application/json" onChange={handleFileSelect} style={{ marginLeft: "0.5rem" }} />
              </label>
              <button type="button" onClick={handleLoadJson} className="button-primary">
                Apply JSON
              </button>
              <button type="button" onClick={handleDownload} className="button-secondary">
                Download JSON
              </button>
              <button type="button" onClick={handleCopy} className="button-secondary">
                Copy JSON
              </button>
            </div>
          </div>
        </header>

        <section className="grid grid-2">
          <div className="card p-4">
            <div className="flex justify-between items-center" style={{ marginBottom: "0.75rem" }}>
              <div>
                <h2 className="text-lg font-semibold">JSON input</h2>
                <p className="mt-1 text-sm text-slate-600">Paste text or load a file, then apply it to the editor.</p>
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={() => setActiveTab("tree")} className={activeTab === "tree" ? "button-primary" : "button-secondary"}>
                  Tree view
                </button>
                <button type="button" onClick={() => setActiveTab("text")} className={activeTab === "text" ? "button-primary" : "button-secondary"}>
                  Text view
                </button>
              </div>
            </div>
            {activeTab === "tree" ? (
              <div className="card bg-slate-50 p-3" style={{ maxHeight: "520px", overflow: "auto" }}>
                {renderNode(tree)}
              </div>
            ) : (
              <textarea value={jsonText} onChange={(event) => setJsonText(event.target.value)} className="input-field" style={{ minHeight: "480px", fontFamily: "monospace" }} />
            )}
          </div>

          <div className="flex" style={{ flexDirection: "column", gap: "1rem" }}>
            <div className="card p-4">
              <h2 className="text-lg font-semibold">Selected node</h2>
              <p className="mt-1 text-sm text-slate-600">Inspect or modify the currently chosen value.</p>
              <div className="mt-4" style={{ display: "grid", gap: "0.75rem" }}>
                <div>
                  <label className="text-sm font-medium text-slate-700">Path</label>
                  <div className="mt-1 rounded-lg bg-slate-50 p-3 text-sm text-slate-700">
                    {selectedPath.length === 0 ? "root" : selectedPath.join(" / ")}
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700">Type</label>
                  <div className="mt-1 rounded-lg bg-slate-50 p-3 text-sm text-slate-700">{selectedType}</div>
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700">Value</label>
                  <textarea value={editValue} onChange={(event) => setEditValue(event.target.value)} className="input-field mt-1" style={{ minHeight: "6rem", fontFamily: "monospace" }} />
                </div>
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={updateSelectedValue} className="button-primary">
                    Apply value
                  </button>
                  <button type="button" onClick={handleDuplicateSelected} className="button-secondary">
                    Duplicate
                  </button>
                  <button type="button" onClick={handleRemoveSelected} className="button-danger">
                    Delete
                  </button>
                </div>
              </div>
            </div>

            <div className="card p-4">
              <h2 className="text-lg font-semibold">Add child</h2>
              <div className="mt-3" style={{ display: "grid", gap: "0.75rem" }}>
                <div>
                  <label className="text-sm font-medium text-slate-700">Key</label>
                  <input value={newKey} onChange={(event) => setNewKey(event.target.value)} className="input-field mt-1" />
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700">Type</label>
                  <select value={newType} onChange={(event) => setNewType(event.target.value as JsonNodeType)} className="input-field mt-1">
                    <option value="string">string</option>
                    <option value="number">number</option>
                    <option value="boolean">boolean</option>
                    <option value="null">null</option>
                    <option value="object">object</option>
                    <option value="array">array</option>
                  </select>
                </div>
                <button type="button" onClick={handleAddChild} className="button-primary">
                  Add child to selected node
                </button>
              </div>
            </div>

            {error ? <div className="card p-3 text-red-700" style={{ background: "#fef2f2", borderColor: "#fecaca" }}>{error}</div> : null}
          </div>
        </section>
      </div>
    </main>
  );
}
