"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ChangeEvent, type ReactNode } from "react";
import {
  addChildToPath,
  buildClipboardPayload,
  buildJsonTree,
  duplicateValueAtPath,
  formatJsonValue,
  getJsonNodeType,
  getValueAtPath,
  pasteClipboardPayload,
  parseJsonValueText,
  removeValueAtPath,
  renamePropertyAtPath,
  reorderValueAtPath,
  type ClipboardPayload,
  type JsonNodeType,
  type JsonPath,
  type JsonTreeNode,
  type JsonValue,
  type JsonObject,
  updateValueAtPath,
} from "@/app/lib/json-model";

type Language = "en" | "ja";

const LANGUAGE_STORAGE_KEY = "json-editor-language";
const LANGUAGE_CHANGE_EVENT = "json-editor-language-change";

type HistoryEntry = {
  data: JsonValue;
  text: string;
  selectedPath: JsonPath;
};

type DropPosition = "before" | "after";

type TreeDropTarget = {
  path: JsonPath;
  position: DropPosition;
};

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
    copyNode: "Copy node",
    undo: "Undo",
    redo: "Redo",
    pasteNode: "Paste node",
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
      nothingToUndo: "There is nothing to undo.",
      nothingToRedo: "There is nothing to redo.",
      nothingToPaste: "There is no copied node to paste.",
      pasteRootOnly: "Copied root data can only replace the document root.",
      pasteObjectMemberOnly: "Copied object keys can only be pasted into an object.",
      pasteArrayItemOnly: "Copied array items can only be pasted into an array.",
      reorderSameParentOnly: "Items can only be reordered within the same parent.",
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
    copyNode: "ノードをコピー",
    undo: "元に戻す",
    redo: "やり直し",
    pasteNode: "ノードを貼り付け",
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
      nothingToUndo: "元に戻す操作がありません。",
      nothingToRedo: "やり直す操作がありません。",
      nothingToPaste: "貼り付けるコピー済みノードがありません。",
      pasteRootOnly: "コピーした root データはドキュメントルートにのみ貼り付けできます。",
      pasteObjectMemberOnly: "コピーした object キーは object 内にのみ貼り付けできます。",
      pasteArrayItemOnly: "コピーした配列要素は array 内にのみ貼り付けできます。",
      reorderSameParentOnly: "同じ親の中でのみ並べ替えできます。",
    },
  },
} as const;

function readFromFile(file: File): Promise<string> {
  return file.text();
}

function getTypeLabel(type: JsonNodeType, language: Language) {
  return translations[language].nodeTypes[type];
}

function isTextEditingTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
}

function formatTreeNodeValue(value: JsonValue, type: JsonNodeType) {
  if (type === "object" || type === "array") return "";
  const text = formatJsonValue(value);
  return text.length > 80 ? `${text.slice(0, 77)}...` : text;
}

function arePathsEqual(left: JsonPath, right: JsonPath) {
  return left.length === right.length && left.every((segment, index) => segment === right[index]);
}

function haveSameParentPath(left: JsonPath, right: JsonPath) {
  return arePathsEqual(left.slice(0, -1), right.slice(0, -1));
}

function getStoredLanguage(): Language {
  if (typeof window === "undefined") return "en";
  const savedLanguage = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
  return savedLanguage === "en" || savedLanguage === "ja" ? savedLanguage : "en";
}

function getServerLanguageSnapshot(): Language {
  return "en";
}

function subscribeToLanguageChanges(onStoreChange: () => void) {
  window.addEventListener("storage", onStoreChange);
  window.addEventListener(LANGUAGE_CHANGE_EVENT, onStoreChange);
  return () => {
    window.removeEventListener("storage", onStoreChange);
    window.removeEventListener(LANGUAGE_CHANGE_EVENT, onStoreChange);
  };
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
  const [isValueDirty, setIsValueDirty] = useState(false);
  const [renameKey, setRenameKey] = useState("");
  const language = useSyncExternalStore(subscribeToLanguageChanges, getStoredLanguage, getServerLanguageSnapshot);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [draggingPath, setDraggingPath] = useState<JsonPath | null>(null);
  const [treeDropTarget, setTreeDropTarget] = useState<TreeDropTarget | null>(null);
  const [copiedNode, setCopiedNode] = useState<ClipboardPayload | null>(null);
  const [undoStack, setUndoStack] = useState<HistoryEntry[]>([]);
  const [redoStack, setRedoStack] = useState<HistoryEntry[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const valueInputRef = useRef<HTMLTextAreaElement>(null);

  const setLanguage = useCallback((nextLanguage: Language) => {
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, nextLanguage);
    window.dispatchEvent(new Event(LANGUAGE_CHANGE_EVENT));
  }, []);

  const t = translations[language];
  const tree = useMemo(() => buildJsonTree(data), [data]);

  const selectedNode = useMemo(() => {
    if (selectedPath.length === 0) {
      return {
        id: "root",
        key: "root",
        path: [],
        value: data,
        type: getJsonNodeType(data),
      } as JsonTreeNode;
    }
    const value = getValueAtPath(data, selectedPath) ?? null;
    return {
      id: selectedPath.join("."),
      key: selectedPath[selectedPath.length - 1] ?? "root",
      path: selectedPath,
      value,
      type: getJsonNodeType(value),
    } as JsonTreeNode;
  }, [data, selectedPath]);

  const selectedType = selectedNode?.type ?? "object";
  const selectedTypeLabel = getTypeLabel(selectedType, language);

  const pushHistory = useCallback((historyData = data, historyText = jsonText, historyPath = selectedPath) => {
    setUndoStack((stack) => [...stack, { data: historyData, text: historyText, selectedPath: historyPath }]);
    setRedoStack([]);
  }, [data, jsonText, selectedPath]);

  const applyData = useCallback((nextData: JsonValue, nextText?: string) => {
    setData(nextData);
    setJsonText(nextText ?? JSON.stringify(nextData, null, 2));
    setError(null);
  }, []);

  const handleLoadJson = useCallback(() => {
    try {
      const parsed = JSON.parse(jsonText);
      pushHistory();
      applyData(parsed, jsonText);
      setSelectedPath([]);
      setEditValue(formatJsonValue(parsed));
      setIsValueDirty(false);
      setActiveTab("tree");
    } catch {
      setError(t.errors.invalidJson);
    }
  }, [applyData, jsonText, pushHistory, t.errors.invalidJson]);

  const handleNewFile = useCallback(() => {
    pushHistory();
    applyData({}, JSON.stringify({}, null, 2));
    setSelectedPath([]);
    setEditValue(formatJsonValue({}));
    setIsValueDirty(false);
    setRenameKey("");
    setActiveTab("tree");
  }, [applyData, pushHistory]);

  const handleFileSelect = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const text = await readFromFile(file);
      const parsed = JSON.parse(text);
      pushHistory();
      applyData(parsed, text);
      setSelectedPath([]);
      setEditValue(formatJsonValue(parsed));
      setIsValueDirty(false);
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
      pushHistory();
      applyData(parsed, text);
      setSelectedPath([]);
      setEditValue(formatJsonValue(parsed));
      setIsValueDirty(false);
      setActiveTab("tree");
    } catch {
      setError(t.errors.invalidJson);
    }
  };

  const handleDownload = useCallback(() => {
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
  }, [data, t.errors.download]);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(data, null, 2));
    } catch {
      setError(t.errors.clipboard);
    }
  }, [data, t.errors.clipboard]);

  const handleApplyValue = () => {
    if (!selectedNode) return;
    try {
      const nextValue = parseJsonValueText(editValue, selectedType);
      const nextData = updateValueAtPath(data, selectedPath, nextValue);
      pushHistory();
      applyData(nextData);
      setEditValue(formatJsonValue(nextValue));
      setIsValueDirty(false);
    } catch {
      setError(t.errors.updateValue);
    }
  };

  const commitSelectedValueIfChanged = useCallback(() => {
    if (!selectedNode || !isValueDirty) return data;
    if (editValue === formatJsonValue(selectedNode.value)) return data;

    const nextValue = parseJsonValueText(editValue, selectedType);
    const nextData = updateValueAtPath(data, selectedPath, nextValue);
    pushHistory();
    applyData(nextData);
    setEditValue(formatJsonValue(nextValue));
    setIsValueDirty(false);
    return nextData;
  }, [applyData, data, editValue, isValueDirty, pushHistory, selectedNode, selectedPath, selectedType]);

  const handleAddChild = () => {
    if (!selectedNode) return;
    const nextData = addChildToPath(data, selectedPath, newKey, newType);
    pushHistory();
    applyData(nextData);
  };

  const handleRemoveSelected = useCallback(() => {
    if (!selectedNode || selectedPath.length === 0) return;
    const nextData = removeValueAtPath(data, selectedPath);
    pushHistory();
    applyData(nextData);
    setSelectedPath([]);
    setEditValue(formatJsonValue(nextData));
    setIsValueDirty(false);
  }, [applyData, data, pushHistory, selectedNode, selectedPath]);

  const handleDuplicateSelected = () => {
    if (!selectedNode) return;
    const result = duplicateValueAtPath(data, selectedPath);
    pushHistory();
    applyData(result.data);
    handleSelectNode(result.path, result.data);
  };

  const handleRenameKey = () => {
    if (!selectedNode || selectedPath.length < 1 || !renameKey.trim()) return;
    try {
      const nextData = renamePropertyAtPath(data, selectedPath, renameKey.trim());
      pushHistory();
      applyData(nextData);
      setSelectedPath([...selectedPath.slice(0, -1), renameKey.trim()]);
      setRenameKey("");
    } catch {
      setError(t.errors.renameKey);
    }
  };

  const handleSelectNode = useCallback((path: JsonPath, sourceData: JsonValue = data, commitPendingValue = false) => {
    let nextSourceData = sourceData;
    if (commitPendingValue) {
      try {
        nextSourceData = commitSelectedValueIfChanged();
      } catch {
        setError(t.errors.updateValue);
        return;
      }
    }

    setSelectedPath(path);
    const value = getValueAtPath(nextSourceData, path) ?? null;
    setEditValue(formatJsonValue(value));
    setIsValueDirty(false);
    if (path.length > 0) {
      setRenameKey(String(path[path.length - 1]));
    } else {
      setRenameKey("");
    }
  }, [commitSelectedValueIfChanged, data, t.errors.updateValue]);

  const handleTreeNodeDragStart = useCallback((event: React.DragEvent<HTMLButtonElement>, path: JsonPath) => {
    event.stopPropagation();
    if (path.length === 0) {
      event.preventDefault();
      return;
    }
    setDraggingPath(path);
    setTreeDropTarget(null);
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("application/json-editor-path", JSON.stringify(path));
  }, []);

  const handleTreeNodeDragOver = useCallback((event: React.DragEvent<HTMLButtonElement>, path: JsonPath) => {
    event.stopPropagation();
    if (!draggingPath || path.length === 0 || !haveSameParentPath(draggingPath, path)) {
      setTreeDropTarget(null);
      return;
    }

    event.preventDefault();
    const bounds = event.currentTarget.getBoundingClientRect();
    const position: DropPosition = event.clientY >= bounds.top + bounds.height / 2 ? "after" : "before";
    setTreeDropTarget({ path, position });
    event.dataTransfer.dropEffect = "move";
  }, [draggingPath]);

  const handleTreeNodeDrop = useCallback((event: React.DragEvent<HTMLButtonElement>, path: JsonPath) => {
    event.preventDefault();
    event.stopPropagation();
    if (!draggingPath || path.length === 0 || !haveSameParentPath(draggingPath, path)) {
      setTreeDropTarget(null);
      setDraggingPath(null);
      setError(t.errors.reorderSameParentOnly);
      return;
    }

    const dropPosition = treeDropTarget?.path && arePathsEqual(treeDropTarget.path, path) ? treeDropTarget.position : "after";
    setTreeDropTarget(null);
    setDraggingPath(null);

    try {
      const baseData = commitSelectedValueIfChanged();
      const result = reorderValueAtPath(baseData, draggingPath, path, dropPosition === "after");
      if (result.data === baseData) return;
      pushHistory(baseData, JSON.stringify(baseData, null, 2), selectedPath);
      applyData(result.data);
      handleSelectNode(result.path, result.data);
    } catch (caughtError) {
      const message = caughtError instanceof Error ? caughtError.message : "";
      setError(message === "reorderSameParentOnly" ? t.errors.reorderSameParentOnly : t.errors.updateValue);
    }
  }, [applyData, commitSelectedValueIfChanged, draggingPath, handleSelectNode, pushHistory, selectedPath, t.errors.reorderSameParentOnly, t.errors.updateValue, treeDropTarget]);

  const handleTreeNodeDragEnd = useCallback(() => {
    setDraggingPath(null);
    setTreeDropTarget(null);
  }, []);

  const handleCopySelectedNode = useCallback(async () => {
    const payload = buildClipboardPayload(data, selectedPath);
    if (!payload) return;
    setCopiedNode(payload);
    try {
      const clipboardValue =
        payload.sourceKind === "object_members"
          ? Object.fromEntries(payload.items.map((item) => [item.key, item.value]))
          : payload.items.length === 1
            ? payload.items[0].value
            : payload.items.map((item) => item.value);
      await navigator.clipboard.writeText(JSON.stringify(clipboardValue, null, 2));
      setError(null);
    } catch {
      setError(t.errors.clipboard);
    }
  }, [data, selectedPath, t.errors.clipboard]);

  const handlePasteCopiedNode = useCallback(() => {
    if (!copiedNode) {
      setError(t.errors.nothingToPaste);
      return;
    }
    try {
      const result = pasteClipboardPayload(data, selectedPath, copiedNode);
      pushHistory();
      applyData(result.data);
      handleSelectNode(result.path, result.data);
    } catch (caughtError) {
      const message = caughtError instanceof Error ? caughtError.message : "";
      if (message === "pasteRootOnly") setError(t.errors.pasteRootOnly);
      else if (message === "pasteObjectMemberOnly") setError(t.errors.pasteObjectMemberOnly);
      else if (message === "pasteArrayItemOnly") setError(t.errors.pasteArrayItemOnly);
      else setError(t.errors.updateValue);
    }
  }, [applyData, copiedNode, data, handleSelectNode, pushHistory, selectedPath, t.errors.nothingToPaste, t.errors.pasteArrayItemOnly, t.errors.pasteObjectMemberOnly, t.errors.pasteRootOnly, t.errors.updateValue]);

  const handleUndo = useCallback(() => {
    const entry = undoStack[undoStack.length - 1];
    if (!entry) {
      setError(t.errors.nothingToUndo);
      return;
    }
    setUndoStack((stack) => stack.slice(0, -1));
    setRedoStack((stack) => [...stack, { data, text: jsonText, selectedPath }]);
    applyData(entry.data, entry.text);
    handleSelectNode(entry.selectedPath, entry.data);
  }, [applyData, data, handleSelectNode, jsonText, selectedPath, t.errors.nothingToUndo, undoStack]);

  const handleRedo = useCallback(() => {
    const entry = redoStack[redoStack.length - 1];
    if (!entry) {
      setError(t.errors.nothingToRedo);
      return;
    }
    setRedoStack((stack) => stack.slice(0, -1));
    setUndoStack((stack) => [...stack, { data, text: jsonText, selectedPath }]);
    applyData(entry.data, entry.text);
    handleSelectNode(entry.selectedPath, entry.data);
  }, [applyData, data, handleSelectNode, jsonText, redoStack, selectedPath, t.errors.nothingToRedo]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      const modifier = event.ctrlKey || event.metaKey;
      const editingText = isTextEditingTarget(event.target);

      if (modifier && key === "n") {
        event.preventDefault();
        handleNewFile();
        return;
      }
      if (modifier && key === "o") {
        event.preventDefault();
        fileInputRef.current?.click();
        return;
      }
      if (modifier && key === "s") {
        event.preventDefault();
        handleDownload();
        return;
      }
      if (event.key === "F5") {
        event.preventDefault();
        handleLoadJson();
        return;
      }
      if (event.key === "F2") {
        event.preventDefault();
        valueInputRef.current?.focus();
        valueInputRef.current?.select();
        return;
      }
      if (editingText) return;

      if (modifier && key === "c") {
        event.preventDefault();
        void handleCopySelectedNode();
      } else if (modifier && key === "v") {
        event.preventDefault();
        handlePasteCopiedNode();
      } else if (modifier && key === "z") {
        event.preventDefault();
        handleUndo();
      } else if (modifier && key === "y") {
        event.preventDefault();
        handleRedo();
      } else if (event.key === "Delete") {
        event.preventDefault();
        handleRemoveSelected();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    handleCopySelectedNode,
    handleDownload,
    handleLoadJson,
    handleNewFile,
    handlePasteCopiedNode,
    handleRedo,
    handleRemoveSelected,
    handleUndo,
  ]);

  const renderNode = (node: JsonTreeNode): ReactNode => {
    const isSelected = arePathsEqual(selectedPath, node.path);
    const isDragging = draggingPath ? arePathsEqual(draggingPath, node.path) : false;
    const dropPosition = treeDropTarget && arePathsEqual(treeDropTarget.path, node.path) ? treeDropTarget.position : null;
    const label = node.key === "root" ? t.root : node.key;
    const valuePreview = formatTreeNodeValue(node.value, node.type);
    return (
      <div key={node.id} className="ml-2 tree-node-row">
        <button
          type="button"
          className={`tree-node ${isSelected ? "tree-node-active" : ""} ${isDragging ? "tree-node-dragging" : ""} ${dropPosition ? `tree-node-drop-${dropPosition}` : ""}`}
          draggable={node.path.length > 0}
          onClick={() => handleSelectNode(node.path, data, true)}
          onDragStart={(event) => handleTreeNodeDragStart(event, node.path)}
          onDragOver={(event) => handleTreeNodeDragOver(event, node.path)}
          onDrop={(event) => handleTreeNodeDrop(event, node.path)}
          onDragEnd={handleTreeNodeDragEnd}
        >
          <span className="tree-node-type">{node.type}</span>
          <span className="tree-node-label">{label}</span>
          {valuePreview ? <span className="tree-node-value">{valuePreview}</span> : null}
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
                <input ref={fileInputRef} type="file" accept=".json,application/json" onChange={handleFileSelect} style={{ marginLeft: "0.5rem" }} />
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
              <button type="button" onClick={handleUndo} className="button-secondary">
                {t.undo}
              </button>
              <button type="button" onClick={handleRedo} className="button-secondary">
                {t.redo}
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
                  <textarea
                    ref={valueInputRef}
                    value={editValue}
                    onChange={(event) => {
                      setEditValue(event.target.value);
                      setIsValueDirty(true);
                    }}
                    className="input-field mt-1"
                    style={{ minHeight: "6rem", fontFamily: "monospace" }}
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={handleApplyValue} className="button-primary">
                    {t.applyValue}
                  </button>
                  <button type="button" onClick={handleCopySelectedNode} className="button-secondary">
                    {t.copyNode}
                  </button>
                  <button type="button" onClick={handlePasteCopiedNode} className="button-secondary">
                    {t.pasteNode}
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
