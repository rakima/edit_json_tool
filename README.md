# edit_json_tool

This is the browser-based version of edit_json_tool.
The desktop version is available as edit_json_tool_desktop.

## Overview

edit_json_tool is a lightweight browser-based JSON editor for loading, editing, and exporting JSON files without requiring a server. It is inspired by the desktop editor workflow and focuses on a simple, mouse-friendly tree-based experience.

## Main features

- Load JSON from a local `.json` file
- Paste JSON text directly into the editor
- Validate JSON syntax on load
- View JSON in a tree structure
- Edit values, add new fields, delete nodes, and duplicate entries
- Export the edited JSON as a formatted file
- Copy the formatted JSON to the clipboard

## Usage

1. Open the app in a browser.
2. Load a JSON file or paste JSON text into the editor.
3. Select a node in the tree view to inspect or update it.
4. Add, edit, duplicate, or delete nodes as needed.
5. Download the result as a JSON file or copy it to the clipboard.

## Setup

```bash
npm install
npm run dev
```

Then open http://localhost:3000.

## Development commands

```bash
npm run dev
npm run build
npm run start
npm run lint
```

## GitHub Pages

The app is configured for static export, which makes it suitable for GitHub Pages deployment.

To publish to GitHub Pages:

1. Build the project with `npm run build`.
2. Publish the generated `out` directory from the repository's GitHub Pages settings.

## Relationship to the desktop version

This project follows the same editing philosophy as the desktop version, but adapts it for the browser with a simpler, client-side workflow. The desktop application remains the reference point for the overall interaction model and feature set.
