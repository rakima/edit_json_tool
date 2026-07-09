"use client";

import { useEffect, useMemo, useState, type ChangeEvent, type ReactNode } from "react";
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

type Language = "en" | "ja";

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

const translations = {
  en: {
    language: "Language",
    switchToEnglish: "English",
    switchToJapanese: "日本語",
    title: "Browser-based JSON editor",
    subtitle: "Load JSON from a file or paste it directly, edit the structure, and export a formatted document.",
    loadFile: "Load file",
    applyJson: "Apply JSON",
    downloadJson: "Download JSON",
    copyJson: "Copy JSON",
    jsonInput: "JSON input",
    jsonInputHint: "Paste text or load a file, then apply it to the editor.",
    treeView: "Tree view",
    textView: "Text view",
    selectedNode: "Selected node",
    selectedNodeHint: "Inspect or modify the currently chosen value.",
    path: "Path",
    root: "root",
    type: "Type",
    value: "Value",
    applyValue: "Apply value",
    duplicate: "Duplicate",
    delete: "Delete",
    editNode: "Edit node",
    renameKey: "Rename key",
    addChild: "Add child",
    key: "Key",
    addChildButton: "Add child to selected node",
    nodeTypes: {
      string: "string",
      number: "number",
      boolean: "boolean",
      null: "null",
      object: "object",
      array: "array",
    },
    errors: {
      invalidJson: "Invalid JSON",
      clipboard: "Clipboard access is unavailable in this browser.",
      download: "Unable to download JSON",
      updateValue: "Unable to update value",
      renameKey: "Unable to rename key",
      notJsonFile: "Please drop a JSON file",
    },
  },
  ja: {
    language: "表示言語",
    switchToEnglish: "English",
    switchToJapanese: "日本語",
    title: "ブラウザ版 JSON エディタ",
    subtitle: "JSON を読み込んで編集し、整形した内容をそのまま書き出せます。",
    loadFile: "ファイルを読み込む",
    applyJson: "JSON を適用",
    downloadJson: "JSON をダウンロード",
    copyJson: "JSON をコピー",
    jsonInput: "JSON 入力",
    jsonInputHint: "テキストを貼り付けるかファイルを読み込んで、エディタに反映してください。",
    treeView: "ツリー表示",
    textView: "テキスト表示",
    selectedNode: "選択中のノード",
    selectedNodeHint: "選択した値を確認・編集できます。",
    path: "パス",
    root: "ルート",
    type: "型",
    value: "値",
    applyValue: "値を適用",
    duplicate: "複製",
    delete: "削除",
    editNode: "ノードを編集",
    renameKey: "キー名を変更",
    addChild: "子要素を追加",
    key: "キー",
    addChildButton: "選択したノードに子要素を追加",
    nodeTypes: {
      string: "文字列",
      number: "数値",
      boolean: "真偽値",
      null: "null",
      object: "オブジェクト",
      array: "配列",
    },
    errors: {
      invalidJson: "JSON の形式が正しくありません",
      clipboard: "このブラウザではクリップボードを利用できません。",
      download: "JSON をダウンロードできませんでした",
      updateValue: "値を更新できませんでした",
      renameKey: "キー名を変更できませんでした",
      notJsonFile: "JSON ファイルをドロップしてください",
    },
  },
} as const;

function readFromFile(file: File): Promise<string> {
  return file.text();
}

function getTypeLabel(type: JsonNodeType, language: Language) {
  return translations[language].nodeTypes[type];
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
  const [language, setLanguage] = useState<Language>("en");
  const [isDraggingOver, setIsDraggingOver] = useState(false);

  useEffect(() => {
    const savedLanguage = window.localStorage.getItem("json-editor-language");
    if (savedLanguage === "en" || savedLanguage === "ja") {
      setLanguage(savedLanguage);
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem("json-editor-language", language);
  }, [language]);

  const t = translations[language];
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
  const selectedTypeLabel = getTypeLabel(selectedType, language);

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
    } catch {
      setError(t.errors.invalidJson);
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
    } catch {
      setError(t.errors.invalidJson);
    }
  };

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDraggingOver(true);
  };

  const handleDragLeave = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    if (event.currentTarget === event.target) {
      setIsDraggingOver(false);
    }
  };

  const handleDrop = async (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDraggingOver(false);
    const files = event.dataTransfer.files;
    if (files.length === 0) return;
    const file = files[0];
    if (!file.type.includes("json") && !file.name.endsWith(".json")) {
      setError(t.errors.notJsonFile);
      return;
    }
    try {
      const text = await readFromFile(file);
      const parsed = JSON.parse(text);
      applyData(parsed, text);
      setSelectedPath([]);
      setActiveTab("tree");
    } catch {
      setError(t.errors.invalidJson);
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
    } catch {
      setError(t.errors.download);
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(data, null, 2));
    } catch {
      setError(t.errors.clipboard);
    }
  };

  const handleApplyValue = () => {
    if (!selectedNode) return;
    try {
      const nextValue = parseJsonValueText(editValue, selectedType);
      const nextData = updateValueAtPath(data, selectedPath, nextValue);
      applyData(nextData);
      setEditValue(formatJsonValue(nextValue));
    } catch {
      setError(t.errors.updateValue);
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
    } catch {
      setError(t.errors.renameKey);
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
    const label = node.key === "root" ? t.root : node.key;
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
              <h1 className="text-3xl font-semibold">{t.title}</h1>
              <p className="mt-2 text-sm text-slate-600" style={{ maxWidth: "40rem" }}>
                {t.subtitle}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <div className="flex gap-2 rounded-lg border border-slate-200 bg-white p-1">
                <button type="button" onClick={() => setLanguage("en")} className={language === "en" ? "button-primary" : "button-secondary"}>
                  {t.switchToEnglish}
                </button>
                <button type="button" onClick={() => setLanguage("ja")} className={language === "ja" ? "button-primary" : "button-secondary"}>
                  {t.switchToJapanese}
                </button>
              </div>
              <label className="button-secondary" style={{ padding: "0.65rem 0.9rem" }}>
                {t.loadFile}
                <input type="file" accept=".json,application/json" onChange={handleFileSelect} style={{ marginLeft: "0.5rem" }} />
              </label>
              <button type="button" onClick={handleLoadJson} className="button-primary">
                {t.applyJson}
              </button>
              <button type="button" onClick={handleDownload} className="button-secondary">
                {t.downloadJson}
              </button>
              <button type="button" onClick={handleCopy} className="button-secondary">
                {t.copyJson}
              </button>
            </div>
          </div>
        </header>

        <section className="grid grid-2">
          <div
            className="card p-4"
            style={{
              backgroundColor: isDraggingOver ? "#f0f9ff" : undefined,
              borderColor: isDraggingOver ? "#3b82f6" : undefined,
              borderWidth: isDraggingOver ? "2px" : undefined,
              transition: "all 0.2s ease",
            }}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <div className="flex justify-between items-center" style={{ marginBottom: "0.75rem" }}>
              <div>
                <h2 className="text-lg font-semibold">{t.jsonInput}</h2>
                <p className="mt-1 text-sm text-slate-600">{t.jsonInputHint}</p>
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={() => setActiveTab("tree")} className={activeTab === "tree" ? "button-primary" : "button-secondary"}>
                  {t.treeView}
                </button>
                <button type="button" onClick={() => setActiveTab("text")} className={activeTab === "text" ? "button-primary" : "button-secondary"}>
                  {t.textView}
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
              <h2 className="text-lg font-semibold">{t.selectedNode}</h2>
              <p className="mt-1 text-sm text-slate-600">{t.selectedNodeHint}</p>
              <div className="mt-4" style={{ display: "grid", gap: "0.75rem" }}>
                <div>
                  <label className="text-sm font-medium text-slate-700">{t.path}</label>
                  <div className="mt-1 rounded-lg bg-slate-50 p-3 text-sm text-slate-700">
                    {selectedPath.length === 0 ? t.root : selectedPath.join(" / ")}
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700">{t.type}</label>
                  <div className="mt-1 rounded-lg bg-slate-50 p-3 text-sm text-slate-700">{selectedTypeLabel}</div>
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700">{t.value}</label>
                  <textarea value={editValue} onChange={(event) => setEditValue(event.target.value)} className="input-field mt-1" style={{ minHeight: "6rem", fontFamily: "monospace" }} />
                </div>
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={handleApplyValue} className="button-primary">
                    {t.applyValue}
                  </button>
                  <button type="button" onClick={handleDuplicateSelected} className="button-secondary">
                    {t.duplicate}
                  </button>
                  <button type="button" onClick={handleRemoveSelected} className="button-danger">
                    {t.delete}
                  </button>
                </div>
              </div>
            </div>

            <div className="card p-4">
              <h2 className="text-lg font-semibold">{t.editNode}</h2>
              <div className="mt-3" style={{ display: "grid", gap: "0.75rem" }}>
                <div>
                  <label className="text-sm font-medium text-slate-700">{t.renameKey}</label>
                  <input value={renameKey} onChange={(event) => setRenameKey(event.target.value)} className="input-field mt-1" />
                </div>
                <button type="button" onClick={handleRenameKey} className="button-secondary">
                  {t.renameKey}
                </button>
              </div>
            </div>

            <div className="card p-4">
              <h2 className="text-lg font-semibold">{t.addChild}</h2>
              <div className="mt-3" style={{ display: "grid", gap: "0.75rem" }}>
                <div>
                  <label className="text-sm font-medium text-slate-700">{t.key}</label>
                  <input value={newKey} onChange={(event) => setNewKey(event.target.value)} className="input-field mt-1" />
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700">{t.type}</label>
                  <select value={newType} onChange={(event) => setNewType(event.target.value as JsonNodeType)} className="input-field mt-1">
                    <option value="string">{t.nodeTypes.string}</option>
                    <option value="number">{t.nodeTypes.number}</option>
                    <option value="boolean">{t.nodeTypes.boolean}</option>
                    <option value="null">{t.nodeTypes.null}</option>
                    <option value="object">{t.nodeTypes.object}</option>
                    <option value="array">{t.nodeTypes.array}</option>
                  </select>
                </div>
                <button type="button" onClick={handleAddChild} className="button-primary">
                  {t.addChildButton}
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
