/**
 * ImageExport.js -- Publication-quality image export for BIME molecular structures
 * Copyright (c) 2026 BioInception PVT LTD, Cambridge, UK and Syed Asad Rahman.
 * All rights reserved. Licensed under the Apache License, Version 2.0 -- see LICENSE.txt
 * If you use BIME, please cite: S. A. Rahman, BIME: BioInception Molecular Editor (2026)
 *
 * Provides SVG, PNG, print-ready SVG, batch export, clipboard copy,
 * and download helpers for molecular structures rendered by BIME.
 */
(function(global) {
    'use strict';

    var ELEMENTS = Molecule.ELEMENTS;
    var BOND_LENGTH = Molecule.BOND_LENGTH;

    // ---------------------------------------------------------------------------
    // Default rendering constants (screen)
    // ---------------------------------------------------------------------------
    var DEFAULTS = {
        width: 500,
        height: 400,
        padding: 40,
        background: '#ffffff',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        fontSize: 13,
        bondWidth: 1.8,
        doubleBondGap: 3,
        tripleBondGap: 4,
        wedgeWidth: 5,
        labelPad: 4,
        showHydrogens: true,
        showAtomNumbers: false,
        showAromaticCircles: true,
        watermark: false,
        title: ''
    };

    // Print overrides
    var PRINT = {
        fontSize: 16,
        bondWidth: 2.5
    };

    // CMYK-safe CPK colours for print
    var PRINT_COLORS = {
        'C': '#000000', 'N': '#0000cc', 'O': '#cc0000', 'S': '#ccaa00',
        'P': '#cc6600', 'F': '#009900', 'Cl': '#009900', 'Br': '#660099',
        'I': '#660099', 'H': '#000000'
    };

    // v2.4.7: Publication preset -- the drawing conventions journals expect for
    // figures: journal-standard Helvetica/Arial atom labels + CMYK-safe element
    // colours (both via printMode), Kekule double bonds (no aromatic circles),
    // slightly heavier bonds and larger labels for print legibility, and no
    // watermark. The background is intentionally NOT set here -- the caller picks
    // white (opaque figure) or 'transparent' (drop onto any page / slide).
    var PUBLICATION = {
        fontSize: 16,
        bondWidth: 2.2,
        doubleBondGap: 4,
        tripleBondGap: 5,
        wedgeWidth: 6,
        showAromaticCircles: false,
        watermark: false,
        printMode: true
    };

    // v2.4.13: reaction-mapping overlay palettes, ported verbatim from
    // Renderer.js so the static export matches the on-screen view. Per-atom
    // soft halos tint mapped sub-fragments (the "trace" colouring) WITHOUT
    // touching the CPK atom-label colours; bond-change strokes + a dashed
    // reaction-centre ring mark the chemistry. All overlays are off unless the
    // caller supplies the data, so the single-molecule export path is unchanged.
    var COMPONENT_PAIR_PALETTE = [
        '#a5d8d2', '#c7e8b9', '#fbd5a5', '#d8c5e7', '#a8d8e8',
        '#fbc4c1', '#e8d8a5', '#c5e2c7', '#e5b8d8', '#b8c5e5'
    ];
    var COMPONENT_PAIR_NEUTRAL = '#cccccc';
    // Bond-change stroke colours by kind: cleaved red, formed green, order
    // amber, stereo purple — with CMYK-safe variants for printMode.
    var BOND_CHANGE_COLORS = {
        cleaved: '#dc2626', formed: '#16a34a', order: '#d97706', stereo: '#7c3aed'
    };
    var BOND_CHANGE_COLORS_PRINT = {
        cleaved: '#cc0000', formed: '#008800', order: '#cc6600', stereo: '#660099'
    };
    var REACTION_CENTRE_RING = '#d97706'; // dashed amber halo behind RC atoms

    // Normalise an RDT bondChange.type (cleaved / formed / orderChange /
    // hydrogenChange / stereo...) onto a BOND_CHANGE_COLORS key.
    function _bcColorKey(type) {
        var t = String(type || 'order').toLowerCase();
        if (t.indexOf('cleav') >= 0 || t.indexOf('break') >= 0) { return 'cleaved'; }
        if (t.indexOf('form') >= 0 || t.indexOf('make') >= 0) { return 'formed'; }
        if (t.indexOf('stereo') >= 0) { return 'stereo'; }
        return 'order'; // orderChange + any other bond-level change
    }

    // v2.4.7: resolve caller options against the right base. When opts.publication
    // is set, the PUBLICATION preset is folded in ABOVE DEFAULTS but BELOW the
    // caller's explicit options, so an explicit background / width / height still
    // wins (e.g. publication + transparent, or publication at a custom size).
    function _resolveOpts(options) {
        var base = (options && options.publication)
            ? _mergeOpts(DEFAULTS, PUBLICATION)
            : DEFAULTS;
        return _mergeOpts(base, options || {});
    }

    // ---------------------------------------------------------------------------
    // True text measurement via hidden SVG element
    //
    // FIX: previously the measurement <svg> was lazily attached to document.body
    // on first use and never detached, leaking a DOM node for the lifetime of
    // the page (and held a strong ref to <text> children created during builds).
    // We now attach it for the duration of a build via _beginMeasureSession() /
    // _endMeasureSession() so it leaves no residue on document.body when idle.
    // ---------------------------------------------------------------------------
    var _measureSVG = null;
    var _measureDepth = 0; // re-entrant session counter

    function _beginMeasureSession() {
        if (typeof document === 'undefined') return;
        _measureDepth++;
        if (!_measureSVG) {
            _measureSVG = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            _measureSVG.setAttribute('style', 'position:absolute;visibility:hidden;width:0;height:0;pointer-events:none');
        }
        if (!_measureSVG.parentNode) {
            document.body.appendChild(_measureSVG);
        }
    }

    function _endMeasureSession() {
        if (typeof document === 'undefined') return;
        if (_measureDepth > 0) _measureDepth--;
        if (_measureDepth === 0 && _measureSVG && _measureSVG.parentNode) {
            _measureSVG.parentNode.removeChild(_measureSVG);
        }
    }

    function measureText(text, fSize, fFamily) {
        if (typeof document === 'undefined') return text.length * fSize * 0.6;
        // If no session is open (defensive: ad-hoc measurement) attach lazily
        // and detach immediately so we still don't leak.
        var ownSession = false;
        if (!_measureSVG || !_measureSVG.parentNode) {
            _beginMeasureSession();
            ownSession = true;
        }
        var t = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        t.setAttribute('font-size', fSize);
        t.setAttribute('font-family', fFamily || 'sans-serif');
        t.textContent = text;
        _measureSVG.appendChild(t);
        var w = t.getComputedTextLength();
        _measureSVG.removeChild(t);
        if (ownSession) _endMeasureSession();
        return w;
    }

    // ---------------------------------------------------------------------------
    // v3.1.0: label legibility for the mapped-reaction figure. Pure helpers —
    // WCAG 2.x relative luminance / contrast, halo compositing, and a same-hue
    // lightness remedy for text that is too faint on the fill beneath it.
    // Used only on the reaction-map path (opts.legibleLabels); exposed
    // read-only as ImageExport._legibility for tests.
    // ---------------------------------------------------------------------------
    var LEGIBLE_MIN_CONTRAST = 3;      // WCAG minimum for bold/large text
    var LEGIBLE_L_MIN = 0.10;          // keep remedied colours off pure black/white
    var LEGIBLE_L_MAX = 0.90;          // so the element hue stays recognisable

    function _parseColor(c) {
        if (c && typeof c === 'object' && c.length === 3) { return [c[0], c[1], c[2]]; }
        var s = String(c || '').trim();
        var m = s.match(/^#([0-9a-f]{3})$/i);
        if (m) {
            return [parseInt(m[1][0] + m[1][0], 16), parseInt(m[1][1] + m[1][1], 16), parseInt(m[1][2] + m[1][2], 16)];
        }
        m = s.match(/^#([0-9a-f]{6})$/i);
        if (m) {
            return [parseInt(m[1].substr(0, 2), 16), parseInt(m[1].substr(2, 2), 16), parseInt(m[1].substr(4, 2), 16)];
        }
        m = s.match(/^rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)$/i);
        if (m) { return [parseInt(m[1], 10), parseInt(m[2], 10), parseInt(m[3], 10)]; }
        return null;
    }

    function _luminance(rgb) {
        var v = [0, 0, 0];
        for (var i = 0; i < 3; i++) {
            var c = rgb[i] / 255;
            v[i] = c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
        }
        return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2];
    }

    function _contrast(a, b) {
        var A = _parseColor(a), B = _parseColor(b);
        if (!A || !B) { return Infinity; }
        var la = _luminance(A), lb = _luminance(B);
        return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
    }

    // `top` painted at `alpha` over `under` -> [r,g,b] (unrounded).
    function _composite(top, alpha, under) {
        var T = _parseColor(top), U = _parseColor(under);
        return [0, 1, 2].map(function (i) { return T[i] * alpha + U[i] * (1 - alpha); });
    }

    function _toHex(rgb) {
        var s = '#';
        for (var i = 0; i < 3; i++) {
            var v = Math.max(0, Math.min(255, Math.round(rgb[i])));
            s += (v < 16 ? '0' : '') + v.toString(16);
        }
        return s;
    }

    function _rgbToHsl(rgb) {
        var r = rgb[0] / 255, g = rgb[1] / 255, b = rgb[2] / 255;
        var mx = Math.max(r, g, b), mn = Math.min(r, g, b);
        var l = (mx + mn) / 2, d = mx - mn, h = 0, s = 0;
        if (d > 0) {
            s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
            if (mx === r) { h = (g - b) / d + (g < b ? 6 : 0); }
            else if (mx === g) { h = (b - r) / d + 2; }
            else { h = (r - g) / d + 4; }
            h /= 6;
        }
        return [h, s, l];
    }

    function _hslToRgb(hsl) {
        var h = hsl[0], s = hsl[1], l = hsl[2];
        if (s === 0) { return [l * 255, l * 255, l * 255]; }
        function hue(p, q, t) {
            if (t < 0) { t += 1; }
            if (t > 1) { t -= 1; }
            if (t < 1 / 6) { return p + (q - p) * 6 * t; }
            if (t < 1 / 2) { return q; }
            if (t < 2 / 3) { return p + (q - p) * (2 / 3 - t) * 6; }
            return p;
        }
        var q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
        return [hue(p, q, h + 1 / 3) * 255, hue(p, q, h) * 255, hue(p, q, h - 1 / 3) * 255];
    }

    // Smallest same-hue lightness shift (1-point steps, darker first on a tie)
    // that lifts `colour` to `min` contrast on `fill`. Returns `colour` itself
    // when it already passes, or null when no shade in [L_MIN, L_MAX] does
    // (the caller then draws a patch instead).
    function _remedyColour(colour, fill, min) {
        return _remedyColourAll(colour, [fill], min);
    }

    // As _remedyColour, but the colour must reach `min` on every fill.
    function _remedyColourAll(colour, fills, min) {
        var rgb = _parseColor(colour);
        if (!rgb) { return null; }
        var fs = [];
        for (var fi = 0; fi < fills.length; fi++) {
            var f = _parseColor(fills[fi]);
            if (!f) { return null; }
            fs.push(f);
        }
        function passes(c) {
            for (var k = 0; k < fs.length; k++) { if (_contrast(c, fs[k]) < min) { return false; } }
            return true;
        }
        if (passes(rgb)) { return typeof colour === 'string' ? colour : _toHex(rgb); }
        var hsl = _rgbToHsl(rgb);
        var l0 = Math.round(hsl[2] * 100);
        for (var step = 1; step <= 100; step++) {
            var cands = [l0 - step, l0 + step];
            for (var ci = 0; ci < 2; ci++) {
                var l = cands[ci] / 100;
                if (l < LEGIBLE_L_MIN || l > LEGIBLE_L_MAX) { continue; }
                var hex = _toHex(_hslToRgb([hsl[0], hsl[1], l]));
                if (passes(hex)) { return hex; }
            }
        }
        return null;
    }

    // Positive-area overlap of two {x,y,w,h} boxes (touching edges = 0).
    function _boxOverlap(a, b) {
        var w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
        var h = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
        return (w > 0 && h > 0) ? w * h : 0;
    }

    // Length of segment {x1,y1,x2,y2} inside box (Liang-Barsky clip).
    function _segInBox(sg, b) {
        var dx = sg.x2 - sg.x1, dy = sg.y2 - sg.y1;
        var p = [-dx, dx, -dy, dy];
        var q = [sg.x1 - b.x, b.x + b.w - sg.x1, sg.y1 - b.y, b.y + b.h - sg.y1];
        var t0 = 0, t1 = 1;
        for (var i = 0; i < 4; i++) {
            if (p[i] === 0) { if (q[i] < 0) { return 0; } continue; }
            var r = q[i] / p[i];
            if (p[i] < 0) { if (r > t1) { return 0; } if (r > t0) { t0 = r; } }
            else { if (r < t0) { return 0; } if (r < t1) { t1 = r; } }
        }
        return Math.max(0, t1 - t0) * Math.sqrt(dx * dx + dy * dy);
    }

    // ---------------------------------------------------------------------------
    // ImageExport namespace
    // ---------------------------------------------------------------------------
    var ImageExport = {};

    ImageExport._legibility = Object.freeze({
        parseColor: _parseColor,
        luminance: function (c) { var p = _parseColor(c); return p ? _luminance(p) : NaN; },
        contrast: _contrast,
        composite: _composite,
        remedyColour: _remedyColour,
        boxOverlap: _boxOverlap,
        segInBox: _segInBox,
        MIN_CONTRAST: LEGIBLE_MIN_CONTRAST
    });

    // ---------------------------------------------------------------------------
    // 1. SVG Export (publication quality)
    // ---------------------------------------------------------------------------

    /**
     * Render a Molecule to a self-contained SVG string.
     * @param {Molecule} mol
     * @param {Object} [options]
     * @returns {string} standalone SVG markup
     */
    ImageExport.toSVG = function(mol, options) {
        return _buildSVG(mol, _resolveOpts(options));
    };

    /**
     * Render a Molecule to a publication-quality SVG (journal-standard conventions).
     * Convenience wrapper for toSVG({ publication: true, ... }). Pass
     * background:'transparent' for a transparent figure, or '#ffffff' for opaque.
     * @param {Molecule} mol
     * @param {Object} [options]
     * @returns {string} standalone SVG markup
     */
    ImageExport.toPublicationSVG = function(mol, options) {
        return _buildSVG(mol, _resolveOpts(_mergeOpts({ publication: true }, options)));
    };

    /**
     * v2.4.13: render a MAPPED reaction as a publication-quality figure — the
     * static, batchable equivalent of the workbench's reaction-mapping view:
     * colour mol + atom-atom map numbers + bond changes (red cleaved / green
     * formed / amber order / purple stereo) + sub-fragment trace colouring. No
     * confidence caption (intentionally omitted).
     *
     * @param {Molecule} mol     a laid-out reaction (reactionArrow + components);
     *                           e.g. Layout.layout(SmilesParser.parse('A>>B')).
     * @param {Object}   result  the RDT.mapReaction(mol) result ({mapping, sides,
     *                           bondChanges}). If absent/failed, the reaction is
     *                           still drawn, just without overlays.
     * @param {Object}   [options]  caller overrides (publication default ON;
     *                           background, width/height, showReactionCenter,
     *                           colorAtoms, showBondChanges, showMapNumbers).
     * @note  MUTATES `mol` in place: cleans the reaction-scheme layout
     *        (re-positions atoms, replaces reactionArrow + reactionPlusSigns)
     *        and assigns atom.mapNumber. Pass a mol you don't mind being
     *        relocated; callers must NOT pre-run Layout.layout.
     * @returns {string} standalone SVG markup.
     */
    // v2.4.13: clean reaction-scheme layout for the static figure. Layout.layout
    // alone refines each component's geometry but SCRAMBLES the scheme — it
    // re-packs the components yet leaves reactionArrow + reactionPlusSigns at
    // their stale parse positions, so the arrow lands mis-placed (over a
    // product, wrong height). Fix: capture the reactant/product split + order
    // from the (correct) parse layout, refine geometry, then re-pack
    // reactants -> arrow -> products, vertically centred, and re-derive the
    // arrow + plus signs from the new positions (Molecule.computeReactionPlusSigns).
    function _layoutReactionScheme(mol) {
        if (typeof Layout === 'undefined' || !Layout.layout || !mol) { return; }
        if (!mol.reactionArrow || typeof mol.getComponents !== 'function') {
            Layout.layout(mol); return;   // single molecule: just refine geometry
        }
        var mid0 = (mol.reactionArrow.x1 + mol.reactionArrow.x2) / 2;
        var arrowType = mol.reactionArrow.type || 'forward';
        var groups = mol.getComponents().map(function (ids) {
            var sx = 0;
            for (var i = 0; i < ids.length; i++) { var a = mol.getAtom(ids[i]); sx += a ? a.x : 0; }
            return { ids: ids, cx0: sx / Math.max(1, ids.length) };
        });
        Layout.layout(mol);   // refine each component's internal geometry
        function bounds(ids) {
            var b = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
            for (var i = 0; i < ids.length; i++) {
                var a = mol.getAtom(ids[i]); if (!a) { continue; }
                if (a.x < b.minX) { b.minX = a.x; } if (a.y < b.minY) { b.minY = a.y; }
                if (a.x > b.maxX) { b.maxX = a.x; } if (a.y > b.maxY) { b.maxY = a.y; }
            }
            return b;
        }
        var byCx = function (a, b) { return a.cx0 - b.cx0; };
        var reactants = groups.filter(function (g) { return g.cx0 < mid0; }).sort(byCx);
        var products  = groups.filter(function (g) { return g.cx0 >= mid0; }).sort(byCx);
        var gMinY = Infinity, gMaxY = -Infinity;
        groups.forEach(function (g) {
            var b = bounds(g.ids);
            if (b.minY < gMinY) { gMinY = b.minY; }
            if (b.maxY > gMaxY) { gMaxY = b.maxY; }
        });
        var centreY = (gMinY + gMaxY) / 2;
        var FRAG_GAP = BOND_LENGTH * 1.6, ARROW_PAD = BOND_LENGTH * 1.3, ARROW_LEN = BOND_LENGTH * 3;
        var cursorX = 0;
        function place(list) {
            for (var i = 0; i < list.length; i++) {
                var b = bounds(list[i].ids);
                var shiftX = cursorX - b.minX, shiftY = centreY - (b.minY + b.maxY) / 2;
                for (var j = 0; j < list[i].ids.length; j++) {
                    var a = mol.getAtom(list[i].ids[j]); if (a) { a.x += shiftX; a.y += shiftY; }
                }
                cursorX += (b.maxX - b.minX) + FRAG_GAP;
            }
        }
        place(reactants);
        var ax1 = (reactants.length ? cursorX - FRAG_GAP : 0) + ARROW_PAD;
        var ax2 = ax1 + ARROW_LEN;
        cursorX = ax2 + ARROW_PAD;
        place(products);
        mol.reactionArrow = { x1: ax1, y1: centreY, x2: ax2, y2: centreY, type: arrowType, conditions: '' };
        if (typeof mol.computeReactionPlusSigns === 'function') {
            mol.reactionPlusSigns = mol.computeReactionPlusSigns(mol.reactionArrow);
        }
    }

    ImageExport.toReactionMapSVG = function(mol, result, options) {
        options = options || {};
        // Clean reaction-scheme layout (refine geometry, then correctly place
        // the arrow + plus signs). Expects a freshly parsed + mapped reaction;
        // callers must NOT pre-run Layout.layout (it would scramble the scheme).
        _layoutReactionScheme(mol);
        // Assign atom-atom map numbers from the mapping so reactant + product
        // partners share one number (the AAM read-out + the trace pairing).
        if (result && result.mapping && mol && mol.getAtom) {
            var num = 0;
            var rIds = Object.keys(result.mapping);
            for (var k = 0; k < rIds.length; k++) {
                var rId = parseInt(rIds[k], 10);
                var pId = result.mapping[rIds[k]];
                num++;
                var ra = mol.getAtom(rId); if (ra) { ra.mapNumber = num; }
                if (pId !== undefined && pId !== null) {
                    var pa = mol.getAtom(pId); if (pa) { pa.mapNumber = num; }
                }
            }
        }
        // Sub-fragment trace colouring (mapped components share a pale tint).
        var pairs = (typeof RDT !== 'undefined' && RDT.deriveSubFragments && result)
            ? RDT.deriveSubFragments(result, { minSize: 1 })
            : [];
        // Figures default to publication quality + the four overlays ON; the
        // dashed reaction-centre ring stays opt-in (the coloured bonds already
        // mark the chemistry). Caller options win.
        var opts = _mergeOpts({
            publication: true,
            colorAtoms: true,
            showBondChanges: true,
            showMapNumbers: true,
            showReactionCenter: false,
            background: '#ffffff'
        }, options);
        opts.componentPairs = options.componentPairs || pairs;
        // v3.1.0: the mapped-reaction figure always uses the legibility rules
        // (contrast-aware labels instead of unconditional white knockouts).
        // Forced after the merge: there is deliberately no way to opt out.
        opts.legibleLabels = true;
        if (typeof options.minContrast === 'number' && options.minContrast >= 1) {
            opts.minContrast = options.minContrast;
        }
        opts.bondChanges = options.bondChanges || (result && result.bondChanges) || [];

        // v2.4.14: per-component compound labels. Caption each reactant/product
        // structure with its name (or KEGG id with showIds) when known — auto-
        // resolved via MetaboliteLibrary by canonical SMILES, falling back to a
        // component's own .name. "If present": unknown components get no label.
        // Off when labels:false, or when the library / SMILES writer is absent.
        var componentLabels = [];
        if (options.labels !== false && result && result.sides &&
            typeof SmilesWriter !== 'undefined' && SmilesWriter.write) {
            var _ML = (typeof MetaboliteLibrary !== 'undefined') ? MetaboliteLibrary : null;
            var _comps = (result.sides.reactants || []).concat(result.sides.products || []);
            for (var _si = 0; _si < _comps.length; _si++) {
                var _comp = _comps[_si];
                if (!_comp || !_comp.atoms || !_comp.atoms.length) { continue; }
                var _entry = (_ML && _ML.findBySmiles) ? _ML.findBySmiles(SmilesWriter.write(_comp)) : null;
                var _label = _entry
                    ? (options.showIds && _entry.kegg ? _entry.kegg : _entry.name)
                    : (_comp.name || '');
                if (!_label) { continue; }
                // Position the caption from the LAID-OUT main mol via the
                // component's (id-preserved) atoms: centred under its lowest atom.
                var _sumX = 0, _maxY = -Infinity, _n = 0;
                for (var _ai = 0; _ai < _comp.atoms.length; _ai++) {
                    var _ma = mol.getAtom(_comp.atoms[_ai].id);
                    if (!_ma) { continue; }
                    _sumX += _ma.x; if (_ma.y > _maxY) { _maxY = _ma.y; } _n++;
                }
                if (_n > 0) { componentLabels.push({ cx: _sumX / _n, bottomY: _maxY, name: _label }); }
            }
        }
        opts.componentLabels = componentLabels;

        // Auto-size the canvas to the content at a fixed, legible scale so the
        // figure is tightly cropped (no dead whitespace) and the halos +
        // map-number labels never clip at the viewBox edge — unless the caller
        // pinned an explicit size.
        if (options.width === undefined && options.height === undefined) {
            var _b = (mol && mol.getBounds) ? mol.getBounds() : { w: 1, h: 1 };
            var _fs = options.fixedScale || 34;   // px per bond length
            var _pad = 30;                         // room for halos + map-number labels
            opts.fixedScale = _fs;
            opts.padding = _pad;
            opts.width = Math.ceil((_b.w / BOND_LENGTH) * _fs) + _pad * 2;
            // +16 map-number row; +20 more when component captions are drawn.
            opts.height = Math.ceil((_b.h / BOND_LENGTH) * _fs) + _pad * 2 + 16 +
                (componentLabels.length ? 20 : 0);
        }
        return _buildSVG(mol, _resolveOpts(opts));
    };

    // ---------------------------------------------------------------------------
    // 2. PNG Export (high resolution)
    // ---------------------------------------------------------------------------

    /**
     * Render a Molecule to a PNG Blob via offscreen canvas.
     * @param {Molecule} mol
     * @param {Object} [options]  scale: 1|2|4, width, height, background
     * @returns {Promise<Blob>}
     */
    ImageExport.toPNG = function(mol, options) {
        var opts = _resolveOpts(options);
        var scale = Math.max(1, Math.min(10, opts.scale || 2));
        var svgStr = _buildSVG(mol, opts);

        var w = opts.width;
        var h = opts.height;
        // Enforce minimum 1024px at 4x for publication quality
        if (scale === 4 && w * scale < 1024) {
            var factor = 1024 / (w * scale);
            w = Math.ceil(w * factor);
            h = Math.ceil(h * factor);
            svgStr = _buildSVG(mol, _mergeOpts(opts, { width: w, height: h }));
        }

        return new Promise(function(resolve, reject) {
            var canvas = document.createElement('canvas');
            canvas.width = w * scale;
            canvas.height = h * scale;
            var ctx = canvas.getContext('2d');
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';

            // Background
            if (opts.background && opts.background !== 'transparent') {
                var canvasBackground = _safePaint(opts.background, DEFAULTS.background);
                if (canvasBackground !== 'transparent' && canvasBackground !== 'none' && canvasBackground !== 'currentColor') {
                    ctx.fillStyle = canvasBackground;
                    ctx.fillRect(0, 0, canvas.width, canvas.height);
                }
            }

            var img = new Image();
            var blob = new Blob([svgStr], { type: 'image/svg+xml;charset=utf-8' });
            var url = URL.createObjectURL(blob);

            img.onload = function() {
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                URL.revokeObjectURL(url);
                canvas.toBlob(function(pngBlob) {
                    if (pngBlob) resolve(pngBlob);
                    else reject(new Error('PNG encoding failed'));
                }, 'image/png');
            };
            img.onerror = function() {
                URL.revokeObjectURL(url);
                reject(new Error('SVG rasterisation failed'));
            };
            img.src = url;
        });
    };

    // ---------------------------------------------------------------------------
    // 3. PDF-ready SVG (print optimised)
    // ---------------------------------------------------------------------------

    /**
     * Return SVG optimised for print/PDF embedding.
     * @param {Molecule} mol
     * @param {Object} [options]
     * @returns {string} SVG string
     */
    ImageExport.toPrintSVG = function(mol, options) {
        var printOpts = _mergeOpts(DEFAULTS, {
            fontSize: PRINT.fontSize,
            bondWidth: PRINT.bondWidth,
            background: '#ffffff',
            watermark: false,
            printMode: true
        });
        printOpts = _mergeOpts(printOpts, options);
        return _buildSVG(mol, printOpts);
    };

    // ---------------------------------------------------------------------------
    // 3b. PDF Export (via browser print dialog)
    // ---------------------------------------------------------------------------

    /**
     * Open a print dialog for "Save as PDF" -- works in all browsers
     * without external dependencies.
     * @param {Molecule} mol
     * @param {Object} [options]
     */
    ImageExport.toPDF = function(mol, options) {
        var svg = ImageExport.toPrintSVG(mol, options);
        // Build a complete HTML document and open via a Blob URL.
        // Avoids document.write (deprecated, triggers cross-origin warnings, and was
        // flagged in the BIME security audit as defense-in-depth regression).
        var html =
            '<!DOCTYPE html><html><head><meta charset="utf-8"><title>BIME Export</title>' +
            '<style>@page{margin:0.5in}html,body{margin:0;padding:0}' +
            'body{display:flex;justify-content:center;align-items:center;min-height:100vh}</style>' +
            '</head><body>' + svg + '</body></html>';
        var blob = new Blob([html], { type: 'text/html;charset=utf-8' });
        var url = URL.createObjectURL(blob);
        var win = window.open(url, '_blank');
        if (!win) { URL.revokeObjectURL(url); return; }
        // Print once the new window has loaded the Blob document.
        var printed = false;
        var doPrint = function() {
            if (printed) return;
            printed = true;
            try { win.print(); } catch (e) { /* ignore */ }
            // Revoke after a delay so the print preview can finish reading the URL.
            setTimeout(function() { URL.revokeObjectURL(url); }, 60000);
        };
        if (win.document && win.document.readyState === 'complete') {
            doPrint();
        } else {
            win.addEventListener('load', doPrint);
            // Fallback in case the load event fires before the listener attaches.
            setTimeout(doPrint, 1500);
        }
    };

    // ---------------------------------------------------------------------------
    // 4. Batch Export
    // ---------------------------------------------------------------------------

    /**
     * Batch-convert an array of {name, smiles} to SVG strings.
     * @param {Array<{name:string, smiles:string}>} molecules
     * @param {Object} [options]
     * @returns {Array<string>}
     */
    ImageExport.batchSVG = function(molecules, options) {
        var results = [];
        for (var i = 0; i < molecules.length; i++) {
            var entry = molecules[i];
            var mol = _parseSMILES(entry.smiles);
            if (!mol) { results.push(''); continue; }
            var opts = _mergeOpts(DEFAULTS, options);
            opts.title = entry.name || '';
            results.push(_buildSVG(mol, opts));
        }
        return results;
    };

    /**
     * Batch-convert an array of {name, smiles} to PNG Blobs.
     * @param {Array<{name:string, smiles:string}>} molecules
     * @param {Object} [options]
     * @returns {Promise<Array<Blob>>}
     */
    ImageExport.batchPNG = function(molecules, options) {
        var promises = [];
        for (var i = 0; i < molecules.length; i++) {
            var entry = molecules[i];
            var mol = _parseSMILES(entry.smiles);
            if (!mol) {
                promises.push(Promise.resolve(null));
                continue;
            }
            var opts = _mergeOpts(DEFAULTS, options);
            opts.title = entry.name || '';
            promises.push(ImageExport.toPNG(mol, opts));
        }
        return Promise.all(promises);
    };

    // ---------------------------------------------------------------------------
    // 5. Download Helpers
    // ---------------------------------------------------------------------------

    /**
     * Trigger browser download of an SVG string.
     * @param {string} svg
     * @param {string} [filename]
     */
    ImageExport.downloadSVG = function(svg, filename) {
        filename = filename || 'molecule.svg';
        _downloadBlob(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }), filename);
    };

    /**
     * Trigger browser download of a PNG Blob.
     * @param {Blob} blob
     * @param {string} [filename]
     */
    ImageExport.downloadPNG = function(blob, filename) {
        filename = filename || 'molecule.png';
        _downloadBlob(blob, filename);
    };

    /**
     * Download all molecules as images (ZIP if JSZip available, else sequential).
     * @param {Array<{name:string, smiles:string}>} molecules
     * @param {string} [format]  'svg' or 'png'
     * @param {Object} [options]
     * @returns {Promise<void>}
     */
    ImageExport.downloadAll = function(molecules, format, options) {
        format = (format || 'svg').toLowerCase();

        if (format === 'svg') {
            var svgs = ImageExport.batchSVG(molecules, options);
            if (typeof JSZip !== 'undefined') {
                return _zipDownload(molecules, svgs, null, 'svg');
            }
            // Sequential download fallback
            for (var i = 0; i < svgs.length; i++) {
                if (svgs[i]) {
                    var name = _safeName(molecules[i].name || ('molecule_' + (i + 1)));
                    ImageExport.downloadSVG(svgs[i], name + '.svg');
                }
            }
            return Promise.resolve();
        }

        // PNG
        return ImageExport.batchPNG(molecules, options).then(function(blobs) {
            if (typeof JSZip !== 'undefined') {
                return _zipDownload(molecules, null, blobs, 'png');
            }
            for (var i = 0; i < blobs.length; i++) {
                if (blobs[i]) {
                    var name = _safeName(molecules[i].name || ('molecule_' + (i + 1)));
                    ImageExport.downloadPNG(blobs[i], name + '.png');
                }
            }
        });
    };

    // ---------------------------------------------------------------------------
    // 6. Clipboard
    // ---------------------------------------------------------------------------

    /**
     * Copy molecule as PNG to clipboard.
     * @param {Molecule} mol
     * @param {Object} [options]
     * @param {HTMLElement} [statusBar] optional element to show "Copied!" confirmation
     * @returns {Promise<void>}
     */
    ImageExport.copyToClipboard = function(mol, options, statusBar) {
        return ImageExport.toPNG(mol, _mergeOpts({ scale: 2 }, options)).then(function(blob) {
            if (!navigator.clipboard || !navigator.clipboard.write) {
                throw new Error('Clipboard API not available');
            }
            // Include SMILES (with name if present) as plain text alongside the PNG
            var smilesText = '';
            if (typeof SmilesWriter !== 'undefined') {
                var rawSmiles = SmilesWriter.write ? SmilesWriter.write(mol) : '';
                // Strip any name already appended by SmilesWriter.write, then re-add cleanly
                var baseSmiles = rawSmiles.split(/[ \t]/)[0];
                smilesText = baseSmiles + (mol.name ? ' ' + mol.name : '');
            }
            var clipItems = { 'image/png': blob };
            if (smilesText && typeof ClipboardItem !== 'undefined') {
                clipItems['text/plain'] = new Blob([smilesText], { type: 'text/plain' });
            }
            var item = new ClipboardItem(clipItems);
            return navigator.clipboard.write([item]);
        }).then(function() {
            if (statusBar) {
                var info = statusBar.querySelector('#bime-info');
                if (info) {
                    info.textContent = 'Copied!';
                    setTimeout(function() { info.textContent = ''; }, 2000);
                }
            }
        });
    };

    /**
     * Copy molecule as MOL V2000 text to clipboard.
     * @param {Molecule} mol
     * @returns {Promise<void>}
     */
    ImageExport.copyMOL = function(mol) {
        if (typeof MolfileWriter === 'undefined') {
            return Promise.reject(new Error('MolfileWriter not available'));
        }
        // FIX: MolfileWriter exposes write() / writeSDF(); there is no toMolfile().
        // The previous typo caused copyMOL to throw TypeError.
        var molText = MolfileWriter.write(mol);
        return navigator.clipboard.writeText(molText);
    };

    // =========================================================================
    // Internal: SVG builder
    // =========================================================================

    /**
     * Build a complete, self-contained SVG string for a molecule.
     */
    function _buildSVG(mol, opts) {
        if (!mol || mol.isEmpty()) {
            return _emptySVG(opts);
        }
        _beginMeasureSession();
        try {
            return _buildSVGImpl(mol, opts);
        } finally {
            _endMeasureSession();
        }
    }

    function _buildSVGImpl(mol, opts) {

        var fontSize = opts.fontSize || DEFAULTS.fontSize;
        var bondWidth = opts.bondWidth || DEFAULTS.bondWidth;
        var padding = opts.padding !== undefined ? opts.padding : DEFAULTS.padding;
        var doubleBondGap = opts.doubleBondGap || DEFAULTS.doubleBondGap;
        var tripleBondGap = opts.tripleBondGap || DEFAULTS.tripleBondGap;
        var wedgeWidth = opts.wedgeWidth || DEFAULTS.wedgeWidth;
        var labelPad = opts.labelPad || DEFAULTS.labelPad;
        var showH = opts.showHydrogens !== false;
        var showAtomNums = !!opts.showAtomNumbers;
        var showAromCircles = opts.showAromaticCircles !== false;
        var printMode = !!opts.printMode;
        var aromaticStyle = opts.aromaticStyle || 'dashed';
        var background = _safePaint(opts.background, DEFAULTS.background);

        // v2.4.17: Kekulisation for the circles-off / publication path. Aromatic
        // ring bonds are stored single, so with the aromatic circle suppressed a
        // benzene ring would render as a bare (saturated-looking) hexagon — a
        // chemically false picture. When circles are off, assign a valid
        // alternating double-bond pattern by a perfect-matching backtracking
        // search over the aromatic subgraph and draw those bonds double. (A
        // perfect matching — not merely maximum-cardinality — is required so no
        // aromatic atom is left without its double bond.) Returns null (and
        // the circle is kept) only if a ring cannot be kekulised.
        function _kekulizeAromatic(km) {
            var VAL = { C: 4, N: 3, O: 2, S: 2, P: 3, B: 3, Se: 2 };
            var need = {}, needList = [];
            for (var ki = 0; ki < km.atoms.length; ki++) {
                var ka = km.atoms[ki];
                if (!ka.aromatic || VAL[ka.symbol] === undefined) { continue; }
                var deficit = VAL[ka.symbol] - km.bondOrderSum(ka.id) - km.calcHydrogens(ka.id) - Math.abs(ka.charge || 0);
                if (deficit >= 1) { need[ka.id] = true; needList.push(ka.id); }
            }
            needList.sort(function (x, y) { return x - y; });
            var matched = {}, usedBond = {};
            function tryMatch(idx) {
                while (idx < needList.length && matched[needList[idx]] !== undefined) { idx++; }
                if (idx >= needList.length) { return true; }
                var a = needList[idx];
                var bs = km.getBondsOfAtom(a).slice().sort(function (b1, b2) { return b1.otherAtom(a) - b2.otherAtom(a); });
                for (var bi2 = 0; bi2 < bs.length; bi2++) {
                    var bd = bs[bi2];
                    if (bd.type !== Molecule.BOND_SINGLE) { continue; }
                    var other = bd.otherAtom(a);
                    if (!need[other] || matched[other] !== undefined) { continue; }
                    matched[a] = bd.id; matched[other] = bd.id; usedBond[bd.id] = true;
                    if (tryMatch(idx + 1)) { return true; }
                    delete matched[a]; delete matched[other]; delete usedBond[bd.id];
                }
                return false;
            }
            return tryMatch(0) ? usedBond : null;
        }
        var kekuleSet = (!showAromCircles) ? _kekulizeAromatic(mol) : null;
        if (!showAromCircles && !kekuleSet) { showAromCircles = true; } // un-kekulisable -> keep the circle

        // v2.4.7: for a transparent figure the atom-label "knockout" rects must
        // NOT paint a solid box (that would defeat the transparency); set them to
        // no-fill, relying on the bold glyph drawn on top to stay legible. For an
        // opaque background the knockout keeps masking bonds behind labels as before.
        var haloFill = (background === 'transparent') ? 'none' : background;

        // v2.4.13: reaction-mapping overlays. Each is inert unless the caller
        // passes the data (componentPairs / bondChanges); single-molecule
        // exports never set them, so their render is byte-identical to before.
        var componentPairs = opts.componentPairs || [];
        var bondChangesOv = opts.bondChanges || [];
        var colorAtoms = opts.colorAtoms !== false;     // halos paint when pairs are present
        var showMappedAtoms = !!opts.showMappedAtoms;
        var showReactionCentre = !!opts.showReactionCenter;
        var showBondChangesOv = !!opts.showBondChanges;
        var showMapNumbers = opts.showMapNumbers !== false;
        // v3.1.0: legibility rules (set only by toReactionMapSVG; every other
        // export leaves this false and renders exactly as before).
        var legible = !!opts.legibleLabels;
        var minContrast = (typeof opts.minContrast === 'number' && opts.minContrast >= 1)
            ? opts.minContrast : LEGIBLE_MIN_CONTRAST;
        var bcColors = printMode ? BOND_CHANGE_COLORS_PRINT : BOND_CHANGE_COLORS;

        // atomId -> pale halo colour (mapped sub-fragment / trace colouring).
        var atomHalo = {};
        for (var _cp = 0; _cp < componentPairs.length; _cp++) {
            var _pair = componentPairs[_cp];
            var _pColor = _pair.color || (_pair.paletteIndex >= 0
                ? COMPONENT_PAIR_PALETTE[_pair.paletteIndex % COMPONENT_PAIR_PALETTE.length]
                : COMPONENT_PAIR_NEUTRAL);
            var _pids = (_pair.reactantAtomIds || []).concat(_pair.productAtomIds || []);
            for (var _pp = 0; _pp < _pids.length; _pp++) { atomHalo[_pids[_pp]] = _pColor; }
        }
        // changed-bond id -> colour key + reaction-centre atom set, from the
        // RDT bondChange shape {type, reactantBond, productBond, atoms:[...]}.
        // reactantBond/productBond are bond ids in this mol's id space (the
        // side mols preserve ids). hydrogenChange records carry no bond (no
        // stroke override) but their atoms still mark the reaction centre.
        var rcAtom = {};
        var changedBond = {};   // bondId -> colour key (cleaved/formed/order/stereo)
        for (var _bc = 0; _bc < bondChangesOv.length; _bc++) {
            var _chg = bondChangesOv[_bc];
            var _ck = _bcColorKey(_chg.type || _chg.kind);
            if (_chg.reactantBond !== undefined && _chg.reactantBond !== null) { changedBond[_chg.reactantBond] = _ck; }
            if (_chg.productBond !== undefined && _chg.productBond !== null) { changedBond[_chg.productBond] = _ck; }
            var _catoms = (_chg.atoms || []).concat([_chg.atom, _chg.productAtom]);
            for (var _ci = 0; _ci < _catoms.length; _ci++) {
                if (_catoms[_ci] !== undefined && _catoms[_ci] !== null) { rcAtom[_catoms[_ci]] = true; }
            }
        }

        // Print mode uses journal-standard font stack.
        var fontFamily = printMode
            ? '"Helvetica Neue", Helvetica, Arial, sans-serif'
            : (opts.fontFamily || DEFAULTS.fontFamily);

        // v1.8.6: emit fontFamily into SVG attributes safely. The default
        // stack contains "Segoe UI" with literal double quotes, which —
        // when interpolated into a double-quoted attribute (font-family="..."
        // or style="...") — produces malformed XML that strict parsers
        // reject (e.g. browsers loading via <object>, <img>, or copy-paste
        // into another tool). The bug manifested as "broken" depicts on
        // search-result hover tooltips for any molecule, because the
        // tooltip's <object>-style consumption tripped the strict path.
        // Fix: XML-escape font-family before attribute insertion.
        var fontFamilyAttr = _esc(fontFamily);

        // Compute molecule bounds and auto-scale
        var bounds = mol.getBounds();
        var molW = bounds.w || 1;
        var molH = bounds.h || 1;

        var targetW = opts.width || DEFAULTS.width;
        var targetH = opts.height || DEFAULTS.height;
        var innerW = targetW - padding * 2;
        var innerH = targetH - padding * 2;

        var scaleX = innerW / molW;
        var scaleY = innerH / molH;
        var scale;
        if (opts.fixedScale) {
            // Fixed scale: pixels per bond length (e.g., 30 = 30px per bond)
            scale = opts.fixedScale / BOND_LENGTH;
        } else {
            scale = Math.min(scaleX, scaleY, 3);
        }
        scale = Math.max(scale, 0.2);

        var offsetX = (targetW / scale - molW) / 2 - bounds.x;
        var offsetY = (targetH / scale - molH) / 2 - bounds.y;

        function tx(x) { return (x + offsetX) * scale; }
        function ty(y) { return (y + offsetY) * scale; }

        function atomColor(symbol) {
            if (printMode && PRINT_COLORS[symbol]) return PRINT_COLORS[symbol];
            var elem = ELEMENTS[symbol];
            return elem ? elem.color : '#333333';
        }

        function estimateTextWidth(text) {
            return measureText(text, fontSize, fontFamily);
        }

        // v3.1.0: on the legibility path, fall back to the 0.6 x size width
        // estimate when the environment reports zero (under Node the test/CLI
        // shim stubs getComputedTextLength to 0). Bonds are then trimmed clear
        // of the glyph, which the removed knockout rect used to hide (FR-006).
        function legibleWidth(text, size) {
            var w = measureText(text, size, fontFamily);
            return w > 0 ? w : String(text).length * size * 0.6;
        }

        function labelRadius(atom) {
            if (atom.symbol === 'C' && atom.charge === 0 && atom.isotope === 0 && mol.degree(atom.id) > 0) return 0;
            return (legible ? legibleWidth(atom.symbol, fontSize) : estimateTextWidth(atom.symbol)) / 2 + labelPad;
        }

        // Collect ring info for double bond offset and aromatic circles
        var ringInfo = (typeof Layout !== 'undefined' && Layout.getRingInfo) ? Layout.getRingInfo(mol) : [];

        function findRingForBond(bond) {
            for (var i = 0; i < ringInfo.length; i++) {
                var ring = ringInfo[i];
                var atoms = ring.atoms;
                var idx1 = atoms.indexOf(bond.atom1);
                var idx2 = atoms.indexOf(bond.atom2);
                if (idx1 >= 0 && idx2 >= 0) {
                    var diff = Math.abs(idx1 - idx2);
                    if (diff === 1 || diff === atoms.length - 1) return ring;
                }
            }
            return null;
        }

        // Hydrogen placement direction
        function hydrogenDirection(atom) {
            var neighbors = mol.getNeighbors(atom.id);
            if (neighbors.length === 0) return 'right';
            var sumX = 0, sumY = 0;
            for (var i = 0; i < neighbors.length; i++) {
                var n = mol.getAtom(neighbors[i]);
                if (!n) continue;
                var dx = n.x - atom.x;
                var dy = n.y - atom.y;
                var len = Math.sqrt(dx * dx + dy * dy);
                if (len > 0) { sumX += dx / len; sumY += dy / len; }
            }
            var angle = Math.atan2(-sumY, -sumX);
            if (angle > -Math.PI / 4 && angle <= Math.PI / 4) return 'right';
            if (angle > Math.PI / 4 && angle <= 3 * Math.PI / 4) return 'down';
            if (angle > -3 * Math.PI / 4 && angle <= -Math.PI / 4) return 'up';
            return 'left';
        }

        var parts = [];

        // --- Aromatic circles ---
        if (showAromCircles) {
            for (var ri = 0; ri < ringInfo.length; ri++) {
                var ring = ringInfo[ri];
                if (!ring.aromatic) continue;
                var rcx = tx(ring.center.x);
                var rcy = ty(ring.center.y);
                // FIX: guard against stale ringInfo referencing a removed atom
                var totalDist = 0;
                var counted = 0;
                for (var ai = 0; ai < ring.atoms.length; ai++) {
                    var ra = mol.getAtom(ring.atoms[ai]);
                    if (!ra) continue;
                    var rdx = tx(ra.x) - rcx;
                    var rdy = ty(ra.y) - rcy;
                    totalDist += Math.sqrt(rdx * rdx + rdy * rdy);
                    counted++;
                }
                if (counted === 0) continue;
                var avgR = totalDist / counted;
                var innerR = avgR * 0.6;
                var circColor = printMode ? '#666666' : '#999999';
                if (aromaticStyle !== 'none') {
                    var dashAttr = aromaticStyle === 'solid' ? '' : ' stroke-dasharray="3,2"';
                    parts.push('<circle cx="' + _r(rcx) + '" cy="' + _r(rcy) + '" r="' + _r(innerR) +
                        '" fill="none" stroke="' + circColor + '" stroke-width="1"' + dashAttr + '/>');
                }
            }
        }

        // --- Reaction-mapping halos (behind bonds + atoms) ---
        // Soft per-atom tint for mapped sub-fragments (trace), plus an optional
        // dashed reaction-centre ring. Pushed before the bond/atom layers so
        // they sit behind; CPK label colours are untouched.
        var haloDiscs = [];     // v3.1.0: painted halos, for the contrast check
        if (colorAtoms || showMappedAtoms || showReactionCentre) {
            var haloR = Math.max(fontSize * 0.9, 9);
            for (var _hi = 0; _hi < mol.atoms.length; _hi++) {
                var _ha = mol.atoms[_hi];
                var _hcx = tx(_ha.x), _hcy = ty(_ha.y);
                var _fill = null;
                if (colorAtoms && atomHalo[_ha.id]) {
                    _fill = atomHalo[_ha.id];
                } else if (showMappedAtoms && _ha.mapNumber > 0) {
                    _fill = COMPONENT_PAIR_NEUTRAL;
                }
                if (_fill) {
                    haloDiscs.push({ cx: _hcx, cy: _hcy, r: haloR, fill: _fill, id: _ha.id });
                    parts.push('<circle cx="' + _r(_hcx) + '" cy="' + _r(_hcy) + '" r="' + _r(haloR) +
                        '" fill="' + _fill + '" stroke="none" opacity="0.85"/>');
                }
                if (showReactionCentre && rcAtom[_ha.id]) {
                    parts.push('<circle cx="' + _r(_hcx) + '" cy="' + _r(_hcy) + '" r="' + _r(haloR + 2) +
                        '" fill="none" stroke="' + REACTION_CENTRE_RING +
                        '" stroke-width="1.5" stroke-dasharray="3,2"/>');
                }
            }
        }

        // --- Bonds ---
        for (var bi = 0; bi < mol.bonds.length; bi++) {
            var bond = mol.bonds[bi];
            var a1 = mol.getAtom(bond.atom1);
            var a2 = mol.getAtom(bond.atom2);
            if (!a1 || !a2) continue;

            var x1 = tx(a1.x), y1 = ty(a1.y);
            var x2 = tx(a2.x), y2 = ty(a2.y);

            var dx = x2 - x1, dy = y2 - y1;
            var len = Math.sqrt(dx * dx + dy * dy);
            if (len < 1) continue;
            var nx = dx / len, ny = dy / len;

            // Trim bonds at atom label boundaries
            var trim1 = labelRadius(a1);
            var trim2 = labelRadius(a2);
            x1 += nx * trim1; y1 += ny * trim1;
            x2 -= nx * trim2; y2 -= ny * trim2;

            var bColor = printMode ? '#000000' : '#333333';
            // v2.4.13: bond-change stroke override (red cleaved / green formed /
            // amber order / purple stereo) for bonds named in bondChanges.
            if (showBondChangesOv && bond.id !== undefined && changedBond[bond.id]) {
                bColor = bcColors[changedBond[bond.id]] || bColor;
            }

            // v1.8.19: read depictStereo (set by SDG.NonplanarBonds.assign
            // for sp³ wedge/dash) FIRST; fall back to bond.stereo for
            // backward compatibility with MOL-imported wedge/dash.
            // bond.stereo is also used by SmilesWriter for E/Z markers,
            // so we don't want NonplanarBonds to mutate it. depictStereo
            // is depiction-only.
            var depictWedge = (bond.depictStereo !== undefined && bond.depictStereo !== 0)
                              ? bond.depictStereo : bond.stereo;
            var depictFromAtomId = bond.depictStereoFromAtom;
            // If a depict-from atom is recorded, ensure x1,y1 corresponds
            // to it (the WIDE end of the wedge). Otherwise use bond.atom1
            // direction as before.
            if (depictFromAtomId !== null && depictFromAtomId !== undefined &&
                depictFromAtomId !== bond.atom1 &&
                depictFromAtomId === bond.atom2) {
                // Swap (x1,y1) <-> (x2,y2) for depict.
                var sx = x1, sy = y1;
                x1 = x2; y1 = y2;
                x2 = sx; y2 = sy;
                var snx = nx; nx = -nx; var sny = ny; ny = -ny;  // reverse
            }
            if (depictWedge === Molecule.STEREO_WEDGE) {
                // Wedge bond (filled triangle)
                var wdx = x2 - x1, wdy = y2 - y1;
                var wlen = Math.sqrt(wdx * wdx + wdy * wdy);
                if (wlen < 0.5) continue;
                var wnx = -wdy / wlen, wny = wdx / wlen;
                var w = wedgeWidth;
                parts.push('<polygon points="' +
                    _r(x1) + ',' + _r(y1) + ' ' +
                    _r(x2 + wnx * w) + ',' + _r(y2 + wny * w) + ' ' +
                    _r(x2 - wnx * w) + ',' + _r(y2 - wny * w) +
                    '" fill="' + bColor + '" stroke="' + bColor + '" stroke-width="0.5" stroke-linejoin="round"/>');

            } else if (depictWedge === Molecule.STEREO_DASH) {
                // Dashed wedge bond
                var ddx = x2 - x1, ddy = y2 - y1;
                var dlen = Math.sqrt(ddx * ddx + ddy * ddy);
                if (dlen < 0.5) continue;
                var dnx = -ddy / dlen, dny = ddx / dlen;
                var segments = 7;
                for (var si = 1; si <= segments; si++) {
                    var t = si / segments;
                    var cx = x1 + ddx * t, cy = y1 + ddy * t;
                    var dw = wedgeWidth * t;
                    parts.push('<line x1="' + _r(cx - dnx * dw) + '" y1="' + _r(cy - dny * dw) +
                        '" x2="' + _r(cx + dnx * dw) + '" y2="' + _r(cy + dny * dw) +
                        '" stroke="' + bColor + '" stroke-width="1.5" stroke-linecap="round"/>');
                }

            } else if (bond.type === Molecule.BOND_DOUBLE || (kekuleSet && kekuleSet[bond.id])) {
                var ringForBond = findRingForBond(bond);
                if (ringForBond) {
                    // Ring double bond: main + offset
                    var rcx2 = tx(ringForBond.center.x);
                    var rcy2 = ty(ringForBond.center.y);
                    var mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
                    var perpX = -ny, perpY = nx;
                    var dot = (rcx2 - mx) * perpX + (rcy2 - my) * perpY;
                    var sign = dot >= 0 ? 1 : -1;
                    var offX = perpX * doubleBondGap * 1.5 * sign;
                    var offY = perpY * doubleBondGap * 1.5 * sign;

                    parts.push(_svgLine(x1, y1, x2, y2, bColor, bondWidth));
                    var trimFrac = 0.15;
                    var bdx2 = x2 - x1, bdy2 = y2 - y1;
                    var blen2 = Math.sqrt(bdx2 * bdx2 + bdy2 * bdy2);
                    parts.push(_svgLine(
                        x1 + offX + nx * blen2 * trimFrac, y1 + offY + ny * blen2 * trimFrac,
                        x2 + offX - nx * blen2 * trimFrac, y2 + offY - ny * blen2 * trimFrac,
                        bColor, bondWidth * 0.8));
                } else {
                    // Chain double bond: symmetric
                    var px2 = -ny * doubleBondGap, py2 = nx * doubleBondGap;
                    parts.push(_svgLine(x1 + px2, y1 + py2, x2 + px2, y2 + py2, bColor, bondWidth));
                    parts.push(_svgLine(x1 - px2, y1 - py2, x2 - px2, y2 - py2, bColor, bondWidth));
                }

            } else if (bond.type === Molecule.BOND_TRIPLE) {
                var px3 = -ny * tripleBondGap, py3 = nx * tripleBondGap;
                parts.push(_svgLine(x1, y1, x2, y2, bColor, bondWidth));
                parts.push(_svgLine(x1 + px3, y1 + py3, x2 + px3, y2 + py3, bColor, bondWidth * 0.7));
                parts.push(_svgLine(x1 - px3, y1 - py3, x2 - px3, y2 - py3, bColor, bondWidth * 0.7));

            } else {
                // Single bond
                parts.push(_svgLine(x1, y1, x2, y2, bColor, bondWidth));
            }
        }

        // v3.1.0: contrast-aware atom text (legibility path only). The fill
        // beneath a text box is the canvas plus every halo disc it touches,
        // composited at the halo opacity; the lowest-contrast fill governs
        // (FR-001). A transparent canvas is judged as white.
        var legibleCanvas = _parseColor(background === 'transparent' ? '#ffffff' : background) || [255, 255, 255];
        var legiblePatchFill = _toHex(legibleCanvas);

        function legibleFills(box) {
            var fills = [], stacked = legibleCanvas, hits = 0, inside = false;
            for (var di = 0; di < haloDiscs.length; di++) {
                var d = haloDiscs[di];
                var nx = Math.max(box.x, Math.min(d.cx, box.x + box.w));
                var ny = Math.max(box.y, Math.min(d.cy, box.y + box.h));
                if ((nx - d.cx) * (nx - d.cx) + (ny - d.cy) * (ny - d.cy) >= d.r * d.r) { continue; }
                var fx = Math.max(Math.abs(box.x - d.cx), Math.abs(box.x + box.w - d.cx));
                var fy = Math.max(Math.abs(box.y - d.cy), Math.abs(box.y + box.h - d.cy));
                if (fx * fx + fy * fy <= d.r * d.r) { inside = true; }
                fills.push(_composite(d.fill, 0.85, legibleCanvas));
                stacked = _composite(d.fill, 0.85, stacked);
                hits++;
            }
            if (hits > 1) { fills.push(stacked); }
            if (!inside) { fills.push(legibleCanvas); }
            return fills;
        }

        // Push a patch if one is needed and return the colour to draw `text`
        // with: unchanged when it already passes, else the smallest same-hue
        // lightness shift, else the original colour over a tight rounded
        // canvas-coloured patch (FR-003..FR-005). Box as research D6.
        var legibleTextBoxes = [];     // every atom text drawn so far (obstacles)
        function legibleColour(colour, x, baseline, size, anchor, text) {
            var w = legibleWidth(text, size);
            var left = anchor === 'start' ? x : (anchor === 'end' ? x - w : x - w / 2);
            var box = { x: left, y: baseline - size * 0.35 - size / 2, w: w, h: size };
            legibleTextBoxes.push(box);
            var fixed = _remedyColourAll(colour, legibleFills(box), minContrast);
            if (fixed) { return fixed; }
            parts.push('<rect x="' + _r(box.x - 1.5) + '" y="' + _r(box.y - 1) +
                '" width="' + _r(box.w + 3) + '" height="' + _r(box.h + 2) +
                '" rx="2" ry="2" fill="' + legiblePatchFill + '" stroke="none"/>');
            return colour;
        }

        // v3.1.0: collision-scored map-number placement (FR-007..FR-010,
        // research D5). Each number takes the least-overlapping of 8 compass
        // positions around its atom — free side first — tried at growing
        // offsets, then at 90% and 75% size. Overlapping a label or another
        // number is hard (x1000 per px^2); crossing a bond costs 10 per px;
        // sitting on another atom's halo 1 per px^2. A position nearer another
        // atom than its own is never used. Most crowded atoms choose first;
        // ties by atom id, so the result is deterministic.
        var MAP_FONT = 12;
        var MAP_RINGS = [[1, 1], [0.75, 1], [1.4, 1], [1.8, 1],
            [1, 0.9], [0.75, 0.9], [1.4, 0.9], [1.8, 0.9],
            [1, 0.75], [0.75, 0.75], [1.4, 0.75], [1.8, 0.75]];
        var mapQueue = [];

        function placeMapNumbers(queue) {
            var d0 = fontSize + 6;
            var P = {};
            for (var pi = 0; pi < mol.atoms.length; pi++) {
                P[mol.atoms[pi].id] = { x: tx(mol.atoms[pi].x), y: ty(mol.atoms[pi].y) };
            }
            // Bond strokes as drawn (trimmed at labels), widened for multiplicity.
            var segs = [];
            for (var sbi = 0; sbi < mol.bonds.length; sbi++) {
                var sb = mol.bonds[sbi], s1 = P[sb.atom1], s2 = P[sb.atom2];
                if (!s1 || !s2) { continue; }
                var sdx = s2.x - s1.x, sdy = s2.y - s1.y, slen = Math.sqrt(sdx * sdx + sdy * sdy);
                if (slen < 1) { continue; }
                var sa1 = mol.getAtom(sb.atom1), sa2 = mol.getAtom(sb.atom2);
                var st1 = labelRadius(sa1) / slen, st2 = labelRadius(sa2) / slen;
                var sw = sb.depictStereo || sb.stereo;
                var half = bondWidth / 2;
                if (sw === Molecule.STEREO_WEDGE || sw === Molecule.STEREO_DASH) { half = wedgeWidth; }
                else if (sb.type === Molecule.BOND_DOUBLE || (kekuleSet && kekuleSet[sb.id])) { half += doubleBondGap * 1.5; }
                else if (sb.type === Molecule.BOND_TRIPLE) { half += tripleBondGap; }
                segs.push({ x1: s1.x + sdx * st1, y1: s1.y + sdy * st1, x2: s2.x - sdx * st2, y2: s2.y - sdy * st2, half: half });
            }

            var reach = 2 * d0, R = 1.8 * d0 + 40;
            var order = queue.map(function (qa) {
                var p = P[qa.id], n = 0;
                for (var oi = 0; oi < mol.atoms.length; oi++) {
                    var o = mol.atoms[oi];
                    if (o.id === qa.id) { continue; }
                    var q = P[o.id], ddx = q.x - p.x, ddy = q.y - p.y;
                    if (ddx * ddx + ddy * ddy < reach * reach) { n++; }
                }
                return { atom: qa, n: n };
            });
            order.sort(function (a, b) { return (b.n - a.n) || (a.atom.id - b.atom.id); });

            var placedBoxes = [], result = [];
            for (var qi = 0; qi < order.length; qi++) {
                var atom = order[qi].atom, p = P[atom.id], text = '' + atom.mapNumber;
                var near = function (x, y) { return Math.abs(x - p.x) < R && Math.abs(y - p.y) < R; };
                var locLabels = legibleTextBoxes.filter(function (b) { return near(b.x + b.w / 2, b.y + b.h / 2); });
                var locMaps = placedBoxes.filter(function (b) { return near(b.x + b.w / 2, b.y + b.h / 2); });
                var locSegs = segs.filter(function (sg) {
                    return Math.min(sg.x1, sg.x2) - R < p.x && Math.max(sg.x1, sg.x2) + R > p.x &&
                        Math.min(sg.y1, sg.y2) - R < p.y && Math.max(sg.y1, sg.y2) + R > p.y;
                });
                var locHalos = haloDiscs.filter(function (d) { return d.id !== atom.id && near(d.cx, d.cy); });
                var locAtoms = mol.atoms.filter(function (o) { return o.id !== atom.id && near(P[o.id].x, P[o.id].y); });

                // Free side: away from the sum of bond directions (down if none).
                var vx = 0, vy = 0, nbs = mol.getNeighbors(atom.id);
                for (var ni = 0; ni < nbs.length; ni++) {
                    var nq = P[nbs[ni]], ux = nq.x - p.x, uy = nq.y - p.y, ul = Math.sqrt(ux * ux + uy * uy);
                    if (ul > 0) { vx -= ux / ul; vy -= uy / ul; }
                }
                var va = (vx * vx + vy * vy > 1e-6) ? Math.atan2(vy, vx) * 180 / Math.PI : 90;
                var dirs = [];
                for (var k = 0; k < 16; k++) {
                    dirs.push({ a: k * 22.5, diff: ((k * 22.5 - va + 540) % 360) - 180 });
                }
                dirs.sort(function (a, b) {
                    var da = Math.abs(a.diff), db = Math.abs(b.diff);
                    if (Math.abs(da - db) > 1e-9) { return da - db; }
                    return b.diff - a.diff;            // tie: clockwise first
                });

                var best = null, fallback = null;
                for (var ri = 0; ri < MAP_RINGS.length; ri++) {
                    var size = MAP_FONT * MAP_RINGS[ri][1], dist = d0 * MAP_RINGS[ri][0];
                    var w = legibleWidth(text, size), ringBest = null;
                    for (var di = 0; di < dirs.length; di++) {
                        var rad = dirs[di].a * Math.PI / 180;
                        var cx = p.x + Math.cos(rad) * dist, cy = p.y + Math.sin(rad) * dist;
                        var margin = Infinity;
                        for (var ai = 0; ai < locAtoms.length; ai++) {
                            var op = P[locAtoms[ai].id], ox = cx - op.x, oy = cy - op.y;
                            margin = Math.min(margin, Math.sqrt(ox * ox + oy * oy) - dist);
                        }
                        var box = { x: cx - w / 2, y: cy - size / 2, w: w, h: size };
                        if (margin < 0.01) {
                            // Nearer another atom: never chosen normally; kept only
                            // as the forced fallback with the widest margin.
                            var fhard = 0;
                            for (var fi2 = 0; fi2 < locLabels.length; fi2++) { fhard += _boxOverlap(box, locLabels[fi2]); }
                            for (fi2 = 0; fi2 < locMaps.length; fi2++) { fhard += _boxOverlap(box, locMaps[fi2]); }
                            if (!fallback || fhard < fallback.fhard - 1e-9 ||
                                (Math.abs(fhard - fallback.fhard) <= 1e-9 && margin > fallback.margin)) {
                                fallback = { fhard: fhard, margin: margin, box: box, size: size, cx: cx, cy: cy, hard: 1 };
                            }
                            continue;
                        }
                        var hard = 0, soft = 0, oi2;
                        for (oi2 = 0; oi2 < locLabels.length; oi2++) { hard += _boxOverlap(box, locLabels[oi2]); }
                        for (oi2 = 0; oi2 < locMaps.length; oi2++) { hard += _boxOverlap(box, locMaps[oi2]); }
                        for (oi2 = 0; oi2 < locSegs.length; oi2++) {
                            var hw = locSegs[oi2].half;
                            soft += 10 * _segInBox(locSegs[oi2], { x: box.x - hw, y: box.y - hw, w: box.w + 2 * hw, h: box.h + 2 * hw });
                        }
                        for (oi2 = 0; oi2 < locHalos.length; oi2++) {
                            var hd = locHalos[oi2];
                            soft += 0.785 * _boxOverlap(box, { x: hd.cx - hd.r, y: hd.cy - hd.r, w: 2 * hd.r, h: 2 * hd.r });
                        }
                        var score = hard * 1000 + soft;
                        if (!ringBest || score < ringBest.score) {
                            ringBest = { score: score, hard: hard, box: box, size: size, cx: cx, cy: cy };
                        }
                    }
                    if (!ringBest) { continue; }
                    if (!best || ringBest.score < best.score) { best = ringBest; }
                    if (ringBest.hard === 0) { best = ringBest; break; }
                }
                if (!best) { best = fallback; }         // crowded layout: least-bad spot (forced)
                placedBoxes.push(best.box);
                result.push({ atom: atom, cx: best.cx, cy: best.cy, size: best.size, forced: best.hard > 0 });
            }
            // Emit in molecule order so the SVG text order is stable.
            var idx = {};
            for (var ii = 0; ii < mol.atoms.length; ii++) { idx[mol.atoms[ii].id] = ii; }
            result.sort(function (a, b) { return idx[a.atom.id] - idx[b.atom.id]; });
            return result;
        }

        // --- Atoms ---
        for (var ai2 = 0; ai2 < mol.atoms.length; ai2++) {
            var atom = mol.atoms[ai2];
            var ax = tx(atom.x);
            var ay = ty(atom.y);
            var elemColor = atomColor(atom.symbol);

            var showLabel = atom.symbol !== 'C' || atom.charge !== 0 ||
                atom.isotope > 0 || mol.degree(atom.id) === 0;

            if (showLabel) {
                var tw = legible ? legibleWidth(atom.symbol, fontSize) : estimateTextWidth(atom.symbol);

                // White background behind label (v3.1.0: not on the legibility
                // path — there the contrast check decides, see legibleColour)
                if (!legible) {
                    parts.push('<rect x="' + _r(ax - tw / 2 - labelPad) + '" y="' + _r(ay - fontSize / 2 - 2) +
                        '" width="' + _r(tw + labelPad * 2) + '" height="' + _r(fontSize + 4) +
                        '" fill="' + haloFill + '" stroke="none"/>');
                }

                // Atom label
                var symColor = legible
                    ? legibleColour(elemColor, ax, ay + fontSize * 0.35, fontSize, 'middle', atom.symbol)
                    : elemColor;
                parts.push('<text x="' + _r(ax) + '" y="' + _r(ay + fontSize * 0.35) +
                    '" fill="' + symColor + '" font-size="' + fontSize + 'px" font-family="' + fontFamilyAttr +
                    '" font-weight="bold" text-anchor="middle">' + _esc(atom.symbol) + '</text>');

                // Charge
                if (atom.charge !== 0) {
                    var chargeStr = atom.charge > 0
                        ? (atom.charge === 1 ? '+' : atom.charge + '+')
                        : (atom.charge === -1 ? '\u2212' : Math.abs(atom.charge) + '\u2212');
                    var chgColor = legible
                        ? legibleColour(elemColor, ax + tw / 2 + 2, ay - fontSize * 0.2, 9, 'start', chargeStr)
                        : elemColor;
                    parts.push('<text x="' + _r(ax + tw / 2 + 2) + '" y="' + _r(ay - fontSize * 0.2) +
                        '" fill="' + chgColor + '" font-size="9px" font-family="' + fontFamilyAttr +
                        '" text-anchor="start">' + _esc(chargeStr) + '</text>');
                }

                // Implicit hydrogens
                if (showH) {
                    var hCount = mol.calcHydrogens(atom.id);
                    if (hCount > 0) {
                        var hStr = 'H';
                        var hCountStr = hCount > 1 ? '' + hCount : '';
                        var hDir = hydrogenDirection(atom);
                        var hFontSize = fontSize * 0.77;
                        var hTextW = legible
                            ? legibleWidth(hStr, fontSize) + (hCountStr ? legibleWidth(hCountStr, fontSize) * 0.6 : 0)
                            : estimateTextWidth(hStr) + (hCountStr ? estimateTextWidth(hCountStr) * 0.6 : 0);
                        var hx, hy, hAnchor;
                        if (hDir === 'left') {
                            hx = ax - tw / 2 - (atom.charge !== 0 ? 10 : 2) - hTextW / 2;
                            hy = ay + fontSize * 0.35;
                            hAnchor = 'end';
                        } else if (hDir === 'up') {
                            hx = ax; hy = ay - fontSize * 0.6; hAnchor = 'middle';
                        } else if (hDir === 'down') {
                            hx = ax; hy = ay + fontSize * 1.2; hAnchor = 'middle';
                        } else {
                            hx = ax + tw / 2 + (atom.charge !== 0 ? 10 : 2) + hTextW / 2;
                            hy = ay + fontSize * 0.35;
                            hAnchor = 'start';
                        }

                        // Background behind H label
                        if (!legible && (hDir === 'left' || hDir === 'right')) {
                            var hBgX = hDir === 'right'
                                ? ax + tw / 2 + (atom.charge !== 0 ? 10 : 2)
                                : ax - tw / 2 - (atom.charge !== 0 ? 10 : 2) - hTextW;
                            parts.push('<rect x="' + _r(hBgX - 1) + '" y="' + _r(ay - fontSize / 2 - 2) +
                                '" width="' + _r(hTextW + 2) + '" height="' + _r(fontSize + 4) +
                                '" fill="' + haloFill + '" stroke="none"/>');
                        }

                        var hLabel = hStr;
                        if (hCountStr) {
                            // Use tspan for subscript count
                            hLabel = 'H<tspan font-size="' + Math.round(hFontSize * 0.75) +
                                'px" dy="3">' + hCountStr + '</tspan>';
                        }
                        var hColor = legible
                            ? legibleColour('#666666', hx, hy, _r(hFontSize), hAnchor, hStr + hCountStr)
                            : '#666666';
                        parts.push('<text x="' + _r(hx) + '" y="' + _r(hy) +
                            '" fill="' + hColor + '" font-size="' + _r(hFontSize) + 'px" font-family="' + fontFamilyAttr +
                            '" text-anchor="' + hAnchor + '">' + hLabel + '</text>');
                    }
                }

                // Isotope
                if (atom.isotope > 0) {
                    var isoColor = legible
                        ? legibleColour(elemColor, ax - tw / 2 - 4, ay - fontSize * 0.2, 9, 'end', '' + atom.isotope)
                        : elemColor;
                    parts.push('<text x="' + _r(ax - tw / 2 - 4) + '" y="' + _r(ay - fontSize * 0.2) +
                        '" fill="' + isoColor + '" font-size="9px" font-family="' + fontFamilyAttr +
                        '" text-anchor="end">' + atom.isotope + '</text>');
                }
            }

            // Atom numbers (optional)
            if (showAtomNums) {
                parts.push('<text x="' + _r(ax) + '" y="' + _r(ay + fontSize + 8) +
                    '" fill="#999999" font-size="8px" font-family="' + fontFamilyAttr +
                    '" text-anchor="middle">' + (ai2 + 1) + '</text>');
            }

            // Atom-atom mapping numbers (v3.1.0: on the legibility path they
            // are placed after every label is known — see placeMapNumbers)
            if (showMapNumbers && atom.mapNumber > 0) {
                if (legible) {
                    mapQueue.push(atom);
                } else {
                    var mapY = ay + fontSize + 6;
                    parts.push('<text x="' + _r(ax) + '" y="' + _r(mapY + 12 * 0.3) +
                        '" fill="#0d9488" font-size="12px" font-family="' + fontFamilyAttr +
                        '" font-weight="bold" text-anchor="middle">' + atom.mapNumber + '</text>');
                }
            }
        }

        if (legible && mapQueue.length) {
            var placedMaps = placeMapNumbers(mapQueue);
            for (var pmi = 0; pmi < placedMaps.length; pmi++) {
                var pm = placedMaps[pmi];
                var pmText = '' + pm.atom.mapNumber;
                var pmBaseline = pm.cy + pm.size * 0.35;
                var pmColor = legibleColour('#0d9488', pm.cx, pmBaseline, pm.size, 'middle', pmText);
                parts.push('<text x="' + _r(pm.cx) + '" y="' + _r(pmBaseline) +
                    '" fill="' + pmColor + '" font-size="' + _r(pm.size) + 'px" font-family="' + fontFamilyAttr +
                    '" font-weight="bold" text-anchor="middle">' + pmText + '</text>');
            }
        }

        // --- Reaction arrow ---
        if (mol.reactionArrow) {
            var arrow = mol.reactionArrow;
            var ax1 = tx(arrow.x1), ay1 = ty(arrow.y1);
            var ax2 = tx(arrow.x2), ay2 = ty(arrow.y2);
            var arrowColor = printMode ? '#000000' : '#333333';
            var adx = ax2 - ax1, ady = ay2 - ay1;
            var alen = Math.sqrt(adx * adx + ady * ady);
            if (alen > 1) {
                var anx = adx / alen, any = ady / alen;
                var apx = -any, apy = anx;
                var hs = 12;
                var isRetro = (arrow.type === 'retro');

                if (isRetro) {
                    var shaftEnd = alen - hs;
                    parts.push(_svgLine(ax1, ay1, ax1 + anx * shaftEnd, ay1 + any * shaftEnd, arrowColor, 2.2));
                    var hw = hs * 0.5;
                    parts.push(_svgLine(ax2 - anx * hs + apx * hw, ay2 - any * hs + apy * hw, ax2, ay2, arrowColor, 2.2));
                    parts.push(_svgLine(ax2 - anx * hs - apx * hw, ay2 - any * hs - apy * hw, ax2, ay2, arrowColor, 2.2));
                } else {
                    var shaftEnd2 = alen - hs * 0.85;
                    parts.push(_svgLine(ax1, ay1, ax1 + anx * shaftEnd2, ay1 + any * shaftEnd2, arrowColor, 2.2));
                    var hw2 = hs * 0.45;
                    var baseX = ax2 - anx * hs, baseY = ay2 - any * hs;
                    parts.push('<polygon points="' +
                        _r(ax2) + ',' + _r(ay2) + ' ' +
                        _r(baseX + apx * hw2) + ',' + _r(baseY + apy * hw2) + ' ' +
                        _r(baseX - apx * hw2) + ',' + _r(baseY - apy * hw2) +
                        '" fill="' + arrowColor + '" stroke="' + arrowColor +
                        '" stroke-width="0.5" stroke-linejoin="round"/>');
                }

                // Conditions text
                if (arrow.conditions) {
                    var cmx = (ax1 + ax2) / 2;
                    var cmy = (ay1 + ay2) / 2 - 12;
                    parts.push('<text x="' + _r(cmx) + '" y="' + _r(cmy) +
                        '" fill="#666666" font-size="10px" font-family="' + fontFamilyAttr +
                        '" font-style="italic" text-anchor="middle">' + _esc(arrow.conditions) + '</text>');
                }
            }
        }

        // --- Plus signs ---
        if (mol.reactionPlusSigns) {
            for (var pi = 0; pi < mol.reactionPlusSigns.length; pi++) {
                var pos = mol.reactionPlusSigns[pi];
                parts.push('<text x="' + _r(tx(pos.x)) + '" y="' + _r(ty(pos.y) + 18 * 0.35) +
                    '" fill="#555555" font-size="18px" font-family="' + fontFamilyAttr +
                    '" font-weight="bold" text-anchor="middle">+</text>');
            }
        }

        // --- Watermark ---
        if (opts.watermark) {
            parts.push('<text x="' + (targetW - 8) + '" y="' + (targetH - 6) +
                '" fill="#cccccc" font-size="8px" font-family="' + fontFamilyAttr +
                '" text-anchor="end">Generated by BIME</text>');
        }

        // --- Molecule name label at the bottom ---
        var molDisplayName = mol.name || opts.title || '';
        if (molDisplayName) {
            var cx = targetW / 2;
            parts.push('<text x="' + _r(cx) + '" y="' + _r(targetH - 10) +
                '" text-anchor="middle" font-family="' + fontFamilyAttr +
                '" font-size="12" fill="#333333">' + _esc(molDisplayName) + '</text>');
        }

        // --- Per-component compound captions (v2.4.14) ---
        // Each reactant/product structure labelled with its name / KEGG id,
        // centred below the component (clear of the atom + map-number rows).
        if (opts.componentLabels && opts.componentLabels.length) {
            var _clFont = Math.max(11, fontSize * 0.78);
            for (var _cl = 0; _cl < opts.componentLabels.length; _cl++) {
                var _lab = opts.componentLabels[_cl];
                if (!_lab || !_lab.name) { continue; }
                parts.push('<text x="' + _r(tx(_lab.cx)) + '" y="' + _r(ty(_lab.bottomY) + fontSize + 18) +
                    '" text-anchor="middle" font-family="' + fontFamilyAttr +
                    '" font-size="' + _r(_clFont) + '" font-weight="600" fill="#333333">' +
                    _esc(_lab.name) + '</text>');
            }
        }

        // --- Assemble SVG ---
        // v2.4.7: omit the full-canvas background rect entirely for a transparent
        // figure (empty string), so the exported SVG has a truly transparent
        // backdrop; opaque backgrounds paint the rect exactly as before.
        var bgRect = (background === 'transparent')
            ? ''
            : '<rect width="' + targetW + '" height="' + targetH + '" fill="' + background + '"/>';

        // <title> from mol.name or opts.title
        var titleStr = mol.name || opts.title || 'Molecule';
        var metadata = '<title>' + _esc(titleStr) + '</title>';
        if (opts.title || mol.name) {
            var dcTitle = mol.name || opts.title;
            metadata += '<metadata><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"' +
                ' xmlns:dc="http://purl.org/dc/elements/1.1/">' +
                '<rdf:Description><dc:title>' + _esc(dcTitle) + '</dc:title>' +
                '<dc:creator>BIME - BioInception Molecular Editor</dc:creator>' +
                '</rdf:Description></rdf:RDF></metadata>';
        }

        var svgOpen = '<svg xmlns="http://www.w3.org/2000/svg" width="' + targetW + '" height="' + targetH +
            '" viewBox="0 0 ' + targetW + ' ' + targetH + '"' +
            ' font-family="' + fontFamilyAttr + '">';

        return svgOpen + metadata + bgRect + parts.join('') + '</svg>';
    }

    // =========================================================================
    // Internal helpers
    // =========================================================================

    function _emptySVG(opts) {
        var w = opts.width || DEFAULTS.width;
        var h = opts.height || DEFAULTS.height;
        var bg = _safePaint(opts.background, DEFAULTS.background);
        return '<svg xmlns="http://www.w3.org/2000/svg" width="' + w + '" height="' + h +
            '" viewBox="0 0 ' + w + ' ' + h + '">' +
            '<rect width="' + w + '" height="' + h + '" fill="' + bg + '"/></svg>';
    }

    function _svgLine(x1, y1, x2, y2, color, width) {
        return '<line x1="' + _r(x1) + '" y1="' + _r(y1) + '" x2="' + _r(x2) + '" y2="' + _r(y2) +
            '" stroke="' + color + '" stroke-width="' + _r(width) + '" stroke-linecap="round"/>';
    }

    function _r(n) {
        return Math.round(n * 100) / 100;
    }

    function _esc(str) {
        return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;')
            .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }

    function _safePaint(value, fallback) {
        var s = (value === null || value === undefined) ? '' : String(value).trim();
        if (!s) return fallback;
        if (/^(#[0-9a-fA-F]{3,8}|transparent|none|currentColor)$/i.test(s)) return s;
        if (/^[a-zA-Z]+$/.test(s)) return s;
        if (/^(rgb|rgba|hsl|hsla)\(\s*[-+0-9.,%\s]+\)$/i.test(s)) return s;
        return fallback;
    }

    function _mergeOpts(defaults, overrides) {
        var result = {};
        for (var k in defaults) {
            if (defaults.hasOwnProperty(k)) result[k] = defaults[k];
        }
        if (overrides) {
            for (var k2 in overrides) {
                if (overrides.hasOwnProperty(k2) && overrides[k2] !== undefined) result[k2] = overrides[k2];
            }
        }
        return result;
    }

    function _parseSMILES(smiles) {
        if (!smiles || typeof SmilesParser === 'undefined') return null;
        try {
            var mol = new Molecule();
            SmilesParser.parse(smiles.trim(), mol);
            if (mol.isEmpty()) return null;
            if (typeof Layout !== 'undefined' && Layout.layout) {
                Layout.layout(mol);
            }
            return mol;
        } catch (e) {
            return null;
        }
    }

    function _downloadBlob(blob, filename) {
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.style.display = 'none';
        document.body.appendChild(a);
        a.click();
        setTimeout(function() {
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }, 100);
    }

    function _safeName(name) {
        return name.replace(/[^a-zA-Z0-9_\-]/g, '_').substring(0, 64);
    }

    function _zipDownload(molecules, svgs, pngBlobs, ext) {
        var zip = new JSZip();
        for (var i = 0; i < molecules.length; i++) {
            var name = _safeName(molecules[i].name || ('molecule_' + (i + 1)));
            if (ext === 'svg' && svgs && svgs[i]) {
                zip.file(name + '.svg', svgs[i]);
            } else if (ext === 'png' && pngBlobs && pngBlobs[i]) {
                zip.file(name + '.png', pngBlobs[i]);
            }
        }
        return zip.generateAsync({ type: 'blob' }).then(function(content) {
            _downloadBlob(content, 'bime-molecules.' + ext + '.zip');
        });
    }

    // =========================================================================
    // Export
    // =========================================================================
    /**
     * Detach the hidden measurement <svg> from document.body if attached.
     * Useful for tests / teardown so the DOM is empty after exports complete.
     */
    ImageExport._cleanup = function() {
        if (_measureSVG && _measureSVG.parentNode) {
            _measureSVG.parentNode.removeChild(_measureSVG);
        }
        _measureDepth = 0;
    };

    global.ImageExport = ImageExport;

})(typeof window !== 'undefined' ? window : this);
