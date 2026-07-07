"use client";

import { useMemo, useState, type ChangeEvent, type ReactNode } from "react";
import {
  addChildToPath,
  buildJsonTree,
  cloneJsonValue,
  formatJsonValue,
  getJsonNodeType,
  getValueAtPath,
  parseJsonValueText,
  removeValueAtPath,
  renamePropertyAtPath,
  type JsonNodeType,
  type JsonPath,
  type JsonTreeNode,
  type JsonValue,
  type JsonObject,
  updateValueAtPath,
} from "@/app/lib/json-model";

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

function readFromFile(file: File): Promise<string> {
  return file.text();
}

export function JsonEditor() {
  const [jsonText, setJsonText] = useState(JSON.stringify(SAMPLE_JSON, null, 2));
  const [data, setData] = useState<JsonValue>(SAMPLE_JSON);
  const [selectedPath, setSelectedPath] = useState<JsonPath>([]);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"tree" | "text">("tree");
  const [newKey, setNewKey] = useState("newField");
  const [newType, setNewType] = useState<JsonNodeType>("string");
  const [editValue, setEditValue] = useState("");
  const [renameKey, setRenameKey] = useState("");

  const tree = useMemo(() => buildJsonTree(data), [data]);

  const selectedNode = useMemo(() => {
    if (selectedPath.length === 0) {
      return {
        id: "root",
        key: "root",
        value: data,
        type: getJsonNodeType(data),
      } as JsonTreeNode;
    }
    const value = getValueAtPath(data, selectedPath) ?? null;
    return {
      id: selectedPath.join("."),
      key: selectedPath[selectedPath.length - 1] ?? "root",
      value,
      type: getJsonNodeType(value),
    } as JsonTreeNode;
  }, [data, selectedPath]);

  const selectedType = selectedNode?.type ?? "object";

  const applyData = (nextData: JsonValue, nextText?: string) => {
    setData(nextData);
    setJsonText(nextText ?? JSON.stringify(nextData, null, 2));
    setError(null);
  };

  const handleLoadJson = () => {
    try {
      const parsed = JSON.parse(jsonText);
      applyData(parsed, jsonText);
      setSelectedPath([]);
      setActiveTab("tree");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid JSON");
    }
  };

  const handleFileSelect = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const text = await readFromFile(file);
      const parsed = JSON.parse(text);
      applyData(parsed, text);
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
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to download JSON");
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(data, null, 2));
    } catch {
      setError("Clipboard access is unavailable in this browser.");
    }
  };

  const handleApplyValue = () => {
    if (!selectedNode) return;
    try {
      const nextValue = parseJsonValueText(editValue, selectedType);
      const nextData = updateValueAtPath(data, selectedPath, nextValue);
      applyData(nextData);
      setEditValue(formatJsonValue(nextValue));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update value");
    }
  };

  const handleAddChild = () => {
    if (!selectedNode) return;
    const nextData = addChildToPath(data, selectedPath, newKey, newType);
    applyData(nextData);
  };

  const handleRemoveSelected = () => {
    if (!selectedNode) return;
    const nextData = removeValueAtPath(data, selectedPath);
    applyData(nextData);
    setSelectedPath([]);
  };

  const handleDuplicateSelected = () => {
    if (!selectedNode) return;
    const nextData = updateValueAtPath(data, selectedPath, cloneJsonValue(selectedNode.value));
    applyData(nextData);
  };

  const handleRenameKey = () => {
    if (!selectedNode || selectedPath.length < 1 || !renameKey.trim()) return;
    try {
      const nextData = renamePropertyAtPath(data, selectedPath, renameKey.trim());
      applyData(nextData);
      setRenameKey("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to rename key");
    }
  };

  const handleSelectNode = (path: JsonPath) => {
    setSelectedPath(path);
    const value = getValueAtPath(data, path) ?? null;
    setEditValue(formatJsonValue(value));
    if (path.length > 0) {
      setRenameKey(String(path[path.length - 1]));
    } else {
      setRenameKey("");
    }
  };

  const renderNode = (node: JsonTreeNode): ReactNode => {
    const isSelected = selectedPath.join(".") === node.id;
    const label = node.key === "root" ? "root" : node.key;
    return (
      <div key={node.id} className="ml-2">
        <button
          type="button"
          className={`tree-node ${isSelected ? "tree-node-active" : ""}`}
          onClick={() => handleSelectNode(node.id === "root" ? [] : node.id.split("."))}
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
                  <button type="button" onClick={handleApplyValue} className="button-primary">
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
              <h2 className="text-lg font-semibold">Edit node</h2>
              <div className="mt-3" style={{ display: "grid", gap: "0.75rem" }}>
                <div>
                  <label className="text-sm font-medium text-slate-700">Rename key</label>
                  <input value={renameKey} onChange={(event) => setRenameKey(event.target.value)} className="input-field mt-1" />
                </div>
                <button type="button" onClick={handleRenameKey} className="button-secondary">
                  Rename key
                </button>
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
