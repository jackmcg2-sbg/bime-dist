// Scratch: emulate module parity for a test run (no repo edits).
const path=require('path');const root=process.env.BIME_ROOT;
const shim=require(path.join(root,'tests/shim.js'));shim.loadAll();
const UI=new Set(["Renderer.js","Tools.js","MolEditor.js","CanvasView.js","CanvasSurface.js","FocusLens.js","PageFormats.js","History.js","ToolbarPrefs.js"]);
for(const f of require(path.join(root,'tools/editor-files.js')).FILES){if(!UI.has(f))require(path.join(root,'editor',f));}
