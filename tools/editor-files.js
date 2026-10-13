/**
 * Canonical browser/editor source load order for BIME.
 *
 * Copyright (c) 2026 BioInception PVT LTD, Cambridge, UK and Syed Asad Rahman.
 * Licensed under the Apache License, Version 2.0 - see LICENSE.txt
 *
 * This list feeds source-mode pages and dist bundles. Keep ordering changes
 * here so the build, pages, and release tests cannot drift independently.
 */
'use strict';

var FILES = [
    // v2.0.33: shared helpers loaded BEFORE the modules that depend on them.
    'XmlUtil.js',
    'CurlyArrowEndpoint.js',
    'Molecule.js',
    'Layout.js',
    'Templates.js',
    'MetaboliteLibrary.js',
    'SmilesParser.js',
    'SmilesWriter.js',
    'MolfileWriter.js',
    'Renderer.js',
    'History.js',
    'Tools.js',
    'CIPStereo.js',
    'SmartsParser.js',
    'SmartsMatch.js',
    'SmartsWriter.js',
    'ImageExport.js',
    'ExportStamp.js',
    'ToolbarPrefs.js',
    'MolEditor.js',
    'SMSDVersion.js',
    'SMSDGraph.js',
    'SMSDVF2.js',
    'SMSDMCS.js',
    'SMSDRings.js',
    'SMSDBatch.js',
    'SMSDLayout.js',
    'SDGLayout.js',
    'sdg/Congestion.js',
    'sdg/LayoutQuality.js',
    'sdg/HydrogenPlacer.js',
    'sdg/OverlapResolver.js',
    'sdg/AtomPlacer.js',
    'sdg/RingPlacer.js',
    'sdg/MacroCycleLayout.js',
    'sdg/IdentityTemplateLibrary.js',
    'sdg/TemplateHandler.js',
    'sdg/LayoutRefiner.js',
    'sdg/CorrectGeometricConfiguration.js',
    'sdg/NonplanarBonds.js',
    'sdg/StructureDiagramGenerator.js',
    'MLDepict.js',
    'ml-depict-weights.js',
    'RDT.js',
    'AtomTrace.js',
    'PageFormats.js',
    'CanvasView.js',
    'CanvasSurface.js',
    'FocusLens.js',
];

// v3.2.0 (ADR-0001): every FILES entry is either an engine module or a UI
// module. Node consumers (tests/shim.js, hence the CLI and maintainer tools)
// load ENGINE_FILES so they run the same layout as the browser. A new editor
// module is engine by default; add it to UI_FILES only if it is UI-only.
var UI_FILES = [
    'Renderer.js',
    'Tools.js',
    'MolEditor.js',
    'PageFormats.js',
    'CanvasView.js',
    'CanvasSurface.js',
    'FocusLens.js'
];

var ENGINE_FILES = FILES.filter(function (file) { return UI_FILES.indexOf(file) === -1; });

function scriptTags(version) {
    return FILES.map(function (file) {
        var suffix = version ? '?v=' + version : '';
        return '<script src="editor/' + file + suffix + '"></script>';
    }).join('\n');
}

module.exports = {
    FILES: FILES,
    UI_FILES: UI_FILES,
    ENGINE_FILES: ENGINE_FILES,
    scriptTags: scriptTags
};
