/**
 * tests/test_v3_1_0_reaction_map_legibility.js — legible labels + map numbers on
 * the mapped-reaction SVG figure (Feature 001, specs/001-reaction-map-label-legibility).
 *
 * Copyright (c) 2026 BioInception PVT LTD, Cambridge, UK and Syed Asad Rahman.
 * All rights reserved. Licensed under the Apache License, Version 2.0 - see LICENSE.txt
 *
 * The figure is measured from its own SVG output: text boxes, bond segments,
 * halo discs and knockout/patch rects are parsed back and checked against the
 * spec's success criteria on the three pilot reactions in
 * tests/data/reaction_map_pilot.json. The contrast audit here is an
 * independent oracle (it re-derives the fill under each text from the halo
 * circles in the SVG), not a call into the code under test.
 *
 *   node tests/test_v3_1_0_reaction_map_legibility.js
 *   node tests/test_v3_1_0_reaction_map_legibility.js --write-baseline   (T004 only)
 */
'use strict';

var assert = require('assert');
var fs = require('fs');
var path = require('path');
var crypto = require('crypto');
var shim = require(path.join(__dirname, 'shim.js'));
shim.loadAll();

[
    'Templates.js', 'SDGLayout.js', 'sdg/MacroCycleLayout.js', 'sdg/OverlapResolver.js',
    'sdg/HydrogenPlacer.js', 'sdg/CorrectGeometricConfiguration.js', 'sdg/LayoutRefiner.js',
    'sdg/RingPlacer.js', 'sdg/TemplateHandler.js', 'sdg/IdentityTemplateLibrary.js',
    'sdg/NonplanarBonds.js', 'Layout.js',
    'SMSDVersion.js', 'SMSDGraph.js', 'SMSDRings.js', 'SMSDMCS.js', 'SMSDBatch.js',
    'SMSDLayout.js', 'RDT.js', 'MetaboliteLibrary.js', 'ImageExport.js'
].forEach(function (f) { require(path.join(__dirname, '..', 'editor', f)); });

var Molecule = globalThis.Molecule;
var SmilesParser = globalThis.SmilesParser;
var Layout = globalThis.Layout;
var RDT = globalThis.RDT;
var ImageExport = globalThis.ImageExport;

var FIXTURE_PATH = path.join(__dirname, 'data', 'reaction_map_pilot.json');
var FX = JSON.parse(fs.readFileSync(FIXTURE_PATH, 'utf8'));

var runner = shim.makeRunner('Reaction-map legibility (v3.1.0)');
var test = runner.test;
console.log('Reaction-map legibility (v3.1.0)');

// ---------------------------------------------------------------------------
// Rendering + SVG measurement harness
// ---------------------------------------------------------------------------
var PILOT_FONT = 16;          // publication preset fontSize (reaction-map default)
var PILOT_SCALE = 34;         // toReactionMapSVG auto-size: px per bond length
var COINCIDENT = 0.3;         // near-coincident atoms (FR-006 check exclusion)
var CROWDED = 0.6;            // SC-002 (amended): atoms with a neighbour-in-space < 0.6 x BL excluded

function render(smi, opts) {
    var mol = SmilesParser.parse(smi);
    assert.ok(mol && mol.atoms.length, 'parsed ' + smi.slice(0, 40));
    var res = RDT.mapReaction(mol, {});
    var svg = ImageExport.toReactionMapSVG(mol, res, opts || {});
    return { mol: mol, res: res, svg: svg };
}

var _renderCache = {};
function renderPilot(id) {
    if (!_renderCache[id]) {
        var r = FX.reactions.filter(function (x) { return x.id === id; })[0];
        _renderCache[id] = render(r.smiles);
    }
    return _renderCache[id];
}

function attrs(tag) {
    var o = {}, re = /([a-zA-Z0-9-]+)="([^"]*)"/g, m;
    while ((m = re.exec(tag))) { o[m[1]] = m[2]; }
    return o;
}

// Text box per the plan (research D6): width = len x size x 0.6 (the Node
// measurement rule), height = size, centred on the glyph's visual centre
// (baseline - 0.35 x size), horizontally by text-anchor.
function textBox(x, y, size, anchor, len) {
    var w = len * size * 0.6;
    var left = anchor === 'start' ? x : (anchor === 'end' ? x - w : x - w / 2);
    var cy = y - size * 0.35;
    return { x: left, y: cy - size / 2, w: w, h: size };
}

function parseSvg(svg) {
    var g = { texts: [], lines: [], halos: [], rings: [], knockouts: [], patches: [], polygons: [] };
    var vb = svg.match(/viewBox="0 0 ([0-9.]+) ([0-9.]+)"/);
    g.width = vb ? parseFloat(vb[1]) : 0;
    g.height = vb ? parseFloat(vb[2]) : 0;
    var m, re;
    re = /<text([^>]*)>([\s\S]*?)<\/text>/g;
    while ((m = re.exec(svg))) {
        var a = attrs(m[1]);
        var content = m[2].replace(/<[^>]+>/g, '');
        var size = parseFloat(a['font-size']);
        var t = {
            x: parseFloat(a.x), y: parseFloat(a.y), size: size, fill: a.fill,
            bold: a['font-weight'] === 'bold', weight: a['font-weight'] || '',
            anchor: a['text-anchor'] || 'start', content: content
        };
        t.box = textBox(t.x, t.y, size, t.anchor, content.length);
        if (t.bold && /^[0-9]+$/.test(content)) { t.kind = 'map'; }
        else if (t.bold && content === '+' && size > PILOT_FONT) { t.kind = 'plus'; }
        else if (t.bold) { t.kind = 'symbol'; }
        else if (t.weight === '600') { t.kind = 'caption'; }
        else if (a.fill === '#999999' || a.fill === '#888888') { t.kind = 'other'; }
        else { t.kind = 'deco'; }                       // H labels, charges, isotopes
        g.texts.push(t);
    }
    re = /<line([^>]*)\/>/g;
    while ((m = re.exec(svg))) {
        var la = attrs(m[1]);
        g.lines.push({ x1: +la.x1, y1: +la.y1, x2: +la.x2, y2: +la.y2,
            width: parseFloat(la['stroke-width']) || 1 });
    }
    re = /<circle([^>]*)\/>/g;
    while ((m = re.exec(svg))) {
        var ca = attrs(m[1]);
        if (ca.opacity === '0.85') {
            g.halos.push({ cx: +ca.cx, cy: +ca.cy, r: +ca.r, fill: ca.fill, opacity: 0.85 });
        } else if (ca['stroke-dasharray']) {
            g.rings.push({ cx: +ca.cx, cy: +ca.cy, r: +ca.r });
        }
    }
    re = /<rect([^>]*)\/>/g;
    while ((m = re.exec(svg))) {
        var ra = attrs(m[1]);
        if (ra.x === undefined) { continue; }           // full-canvas background rect
        var rect = { x: +ra.x, y: +ra.y, w: +ra.width, h: +ra.height, fill: ra.fill };
        if (ra.rx !== undefined) { g.patches.push(rect); } else { g.knockouts.push(rect); }
    }
    re = /<polygon([^>]*)\/>/g;
    while ((m = re.exec(svg))) { g.polygons.push(attrs(m[1])); }
    return g;
}

// Atom centres in SVG px — replicates _buildSVGImpl's fixed-scale transform.
// Verified by the H1 sanity test against drawn element labels.
function atomPixels(mol, g) {
    var BL = Molecule.BOND_LENGTH;
    var b = mol.getBounds();
    var molW = b.w || 1, molH = b.h || 1;
    var scale = Math.max(PILOT_SCALE / BL, 0.2);
    var offX = (g.width / scale - molW) / 2 - b.x;
    var offY = (g.height / scale - molH) / 2 - b.y;
    var out = {};
    mol.atoms.forEach(function (a) {
        out[a.id] = { x: (a.x + offX) * scale, y: (a.y + offY) * scale, atom: a };
    });
    out._arrow = mol.reactionArrow ? {
        x1: (mol.reactionArrow.x1 + offX) * scale, y1: (mol.reactionArrow.y1 + offY) * scale,
        x2: (mol.reactionArrow.x2 + offX) * scale, y2: (mol.reactionArrow.y2 + offY) * scale
    } : null;
    return out;
}

function dist(ax, ay, bx, by) { var dx = ax - bx, dy = ay - by; return Math.sqrt(dx * dx + dy * dy); }
function boxCentre(b) { return { x: b.x + b.w / 2, y: b.y + b.h / 2 }; }

// Owner atom of a text item: map numbers -> nearest atom carrying that map
// number; element symbols / decorations -> nearest atom.
function ownerOf(t, px, mol) {
    var c = boxCentre(t.box), best = null, bd = Infinity;
    mol.atoms.forEach(function (a) {
        if (t.kind === 'map' && String(a.mapNumber) !== t.content) { return; }
        var p = px[a.id], d = dist(c.x, c.y, p.x, p.y);
        if (d < bd) { bd = d; best = a.id; }
    });
    return best;
}

function boxArea(a, b) {
    var w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
    var h = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
    return (w > 0 && h > 0) ? w * h : 0;
}

// Length of segment (x1,y1)-(x2,y2) inside box (Liang–Barsky clip).
function segInBox(s, b) {
    var x1 = s.x1, y1 = s.y1, dx = s.x2 - s.x1, dy = s.y2 - s.y1;
    var p = [-dx, dx, -dy, dy], q = [x1 - b.x, b.x + b.w - x1, y1 - b.y, b.y + b.h - y1];
    var t0 = 0, t1 = 1;
    for (var i = 0; i < 4; i++) {
        if (p[i] === 0) { if (q[i] < 0) { return 0; } continue; }
        var r = q[i] / p[i];
        if (p[i] < 0) { if (r > t1) { return 0; } if (r > t0) { t0 = r; } }
        else { if (r < t0) { return 0; } if (r < t1) { t1 = r; } }
    }
    return Math.max(0, t1 - t0) * Math.sqrt(dx * dx + dy * dy);
}

function inflate(b, d) { return { x: b.x - d, y: b.y - d, w: b.w + 2 * d, h: b.h + 2 * d }; }

function onArrow(l, arrow) {
    if (!arrow) { return false; }
    var minY = Math.min(arrow.y1, arrow.y2) - 12, maxY = Math.max(arrow.y1, arrow.y2) + 12;
    var minX = Math.min(arrow.x1, arrow.x2) - 12, maxX = Math.max(arrow.x1, arrow.x2) + 12;
    return l.x1 >= minX && l.x1 <= maxX && l.x2 >= minX && l.x2 <= maxX &&
        l.y1 >= minY && l.y1 <= maxY && l.y2 >= minY && l.y2 <= maxY;
}

// SC-002 / SC-003 counters (spec definitions).
function measure(out) {
    var g = parseSvg(out.svg);
    var px = atomPixels(out.mol, g);
    var bondPx = PILOT_SCALE;
    var maps = g.texts.filter(function (t) { return t.kind === 'map'; });
    var labels = g.texts.filter(function (t) { return t.kind === 'symbol' || t.kind === 'deco'; });
    maps.forEach(function (t) { t.owner = ownerOf(t, px, out.mol); });
    labels.forEach(function (t) { t.owner = ownerOf(t, px, out.mol); });
    function coincident(a, b) {
        if (a.owner == null || b.owner == null || a.owner === b.owner) { return false; }
        var pa = px[a.owner], pb = px[b.owner];
        return dist(pa.x, pa.y, pb.x, pb.y) < COINCIDENT * bondPx;
    }
    var crowdedIds = {};
    out.mol.atoms.forEach(function (a) {
        crowdedIds[a.id] = out.mol.atoms.some(function (o) {
            return o.id !== a.id && dist(px[o.id].x, px[o.id].y, px[a.id].x, px[a.id].y) < CROWDED * bondPx;
        });
    });
    function crowd(t) { return t.owner != null && crowdedIds[t.owner]; }
    var bonds = g.lines.filter(function (l) { return !onArrow(l, px._arrow); });
    var r = { maps: maps.length, labels: labels.length, bonds: bonds.length,
        mapMap: 0, mapLabel: 0, mapBond: 0, knockoutRects: g.knockouts.length, patches: g.patches.length,
        // SC-002/SC-003 as amended: owners not layout-crowded
        mapMapU: 0, mapLabelU: 0, mapBondU: 0,
        crowdedMaps: maps.filter(crowd).length };
    for (var i = 0; i < maps.length; i++) {
        for (var j = i + 1; j < maps.length; j++) {
            if (!coincident(maps[i], maps[j]) && boxArea(maps[i].box, maps[j].box) > 0) {
                r.mapMap++;
                if (!crowd(maps[i]) && !crowd(maps[j])) { r.mapMapU++; }
            }
        }
        for (var k = 0; k < labels.length; k++) {
            if (!coincident(maps[i], labels[k]) && boxArea(maps[i].box, labels[k].box) > 0) {
                r.mapLabel++;
                if (!crowd(maps[i]) && !crowd(labels[k])) { r.mapLabelU++; }
            }
        }
        for (var n = 0; n < bonds.length; n++) {
            if (segInBox(bonds[n], inflate(maps[i].box, bonds[n].width / 2)) > 0) {
                r.mapBond++;
                if (!crowd(maps[i])) { r.mapBondU++; }
            }
        }
    }
    r._g = g; r._px = px; r._maps = maps; r._labels = labels; r._bonds = bonds; r._crowded = crowdedIds;
    return r;
}

// --- Independent colour oracle (WCAG 2.x) ---
function hex(c) {
    c = String(c || '').trim();
    var m = c.match(/^#([0-9a-f]{3})$/i);
    if (m) { return [0, 1, 2].map(function (i) { return parseInt(m[1][i] + m[1][i], 16); }); }
    m = c.match(/^#([0-9a-f]{6})$/i);
    if (m) { return [0, 2, 4].map(function (i) { return parseInt(m[1].substr(i, 2), 16); }); }
    return null;
}
function lum(rgb) {
    var v = rgb.map(function (c) { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); });
    return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2];
}
function ratio(a, b) { var la = lum(a), lb = lum(b); return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05); }
function over(top, alpha, under) { return top.map(function (c, i) { return c * alpha + under[i] * (1 - alpha); }); }
function boxHitsDisc(b, d) {
    var nx = Math.max(b.x, Math.min(d.cx, b.x + b.w)), ny = Math.max(b.y, Math.min(d.cy, b.y + b.h));
    return dist(nx, ny, d.cx, d.cy) < d.r;
}
function boxInDisc(b, d) {
    return [[b.x, b.y], [b.x + b.w, b.y], [b.x, b.y + b.h], [b.x + b.w, b.y + b.h]].every(function (p) {
        return dist(p[0], p[1], d.cx, d.cy) <= d.r;
    });
}
function boxInRect(b, r) { return b.x >= r.x - 0.01 && b.y >= r.y - 0.01 && b.x + b.w <= r.x + r.w + 0.01 && b.y + b.h <= r.y + r.h + 0.01; }

// Lowest contrast of text t against every fill it can sit on (spec FR-001).
function worstContrast(t, g, canvasHex) {
    var col = hex(t.fill);
    if (!col) { return Infinity; }                      // currentColor etc. — not audited
    var canvas = hex(canvasHex) || [255, 255, 255];
    for (var p = 0; p < g.patches.length; p++) {        // a patch masks everything beneath
        if (boxInRect(t.box, g.patches[p])) { return ratio(col, hex(g.patches[p].fill) || canvas); }
    }
    var discs = g.halos.filter(function (d) { return boxHitsDisc(t.box, d); });
    var fills = [];
    if (!discs.some(function (d) { return boxInDisc(t.box, d); })) { fills.push(canvas); }
    var stacked = canvas;
    discs.forEach(function (d) {
        var c = hex(d.fill);
        if (!c) { return; }
        fills.push(over(c, d.opacity, canvas));
        stacked = over(c, d.opacity, stacked);
    });
    if (discs.length > 1) { fills.push(stacked); }
    return Math.min.apply(null, fills.map(function (f) { return ratio(col, f); }));
}

function sha(s) { return crypto.createHash('sha256').update(s).digest('hex'); }
function stripStamp(svg) { return svg.replace(/<metadata[\s\S]*?<\/metadata>/g, ''); }

var PINNED_MOLS = { phenol: 'c1ccccc1O', pyridine: 'c1ccncc1', chlorobenzene: 'c1ccccc1Cl' };
function pinnedHashes() {
    var out = {};
    Object.keys(PINNED_MOLS).forEach(function (k) {
        ['toSVG', 'toPublicationSVG', 'toPrintSVG'].forEach(function (fn) {
            var m = SmilesParser.parse(PINNED_MOLS[k]); Layout.layout(m);
            out[k + '.' + fn] = sha(ImageExport[fn](m, {}));
        });
    });
    return out;
}

// ---------------------------------------------------------------------------
// T004: --write-baseline records BIME 3.0.3 measurements into the fixture.
// Must only be run against unmodified 3.0.3 rendering code.
// ---------------------------------------------------------------------------
if (require.main === module && process.argv.indexOf('--write-baseline') !== -1) {
    FX.baseline = {};
    FX.reactions.forEach(function (r) {
        var m = measure(renderPilot(r.id));
        FX.baseline[r.id] = { maps: m.maps, labels: m.labels, bonds: m.bonds, mapMap: m.mapMap,
            mapLabel: m.mapLabel, mapBond: m.mapBond, knockoutRects: m.knockoutRects,
            mapMapU: m.mapMapU, mapLabelU: m.mapLabelU, mapBondU: m.mapBondU, crowdedMaps: m.crowdedMaps };
    });
    FX.pinnedSingleMolecule = pinnedHashes();
    fs.writeFileSync(FIXTURE_PATH, JSON.stringify(FX, null, 1) + '\n');
    var timing = {};
    FX.reactions.forEach(function (r) {
        var ts = [];
        for (var i = 0; i < 5; i++) {
            var mol = SmilesParser.parse(r.smiles), res = RDT.mapReaction(mol, {});
            var t0 = process.hrtime.bigint();
            ImageExport.toReactionMapSVG(mol, res, {});
            ts.push(Number(process.hrtime.bigint() - t0) / 1e6);
        }
        ts.sort(function (a, b) { return a - b; });
        timing[r.id] = ts[2];
    });
    console.log(JSON.stringify({ baseline: FX.baseline, renderMedianMs: timing }, null, 1));
    process.exit(0);
}

// BIME's layout + mapping depend on how many atoms the process has created
// before (atom ids are a global counter): the same SMILES lays out differently
// "cold" vs after other parses. --write-baseline rendered the pilots first, in
// fixture order, so render them first here too — otherwise baseline and
// current counts would be measured on different layouts.
FX.reactions.forEach(function (r) { renderPilot(r.id); });

// ---------------------------------------------------------------------------
// H. Harness sanity — the measurement itself is trustworthy.
// ---------------------------------------------------------------------------
test('H1 atom pixel transform matches drawn element labels (harness sanity)', function () {
    var out = renderPilot('CE2872DIOer');
    var g = parseSvg(out.svg), px = atomPixels(out.mol, g);
    var syms = g.texts.filter(function (t) { return t.kind === 'symbol'; });
    assert.ok(syms.length > 20, 'pilot draws heteroatom labels');
    var worst = 0;
    syms.forEach(function (t) {
        var c = boxCentre(t.box), bd = Infinity;
        out.mol.atoms.forEach(function (a) {
            if (a.symbol !== t.content) { return; }
            bd = Math.min(bd, Math.abs(px[a.id].x - t.x) + Math.abs(px[a.id].y - c.y));
        });
        worst = Math.max(worst, bd);
    });
    assert.ok(worst < 0.6, 'every symbol sits on an atom of that element (max deviation ' + worst.toFixed(2) + ' px)');
});

test('H2 overlap primitives behave (box/box, segment/box) and the parser reads bond coordinates', function () {
    var pg = parseSvg('<svg viewBox="0 0 10 10"><line x1="1" y1="2" x2="3" y2="4" stroke="#000" stroke-width="2"/></svg>');
    assert.deepStrictEqual([pg.lines[0].x1, pg.lines[0].y1, pg.lines[0].x2, pg.lines[0].y2], [1, 2, 3, 4], 'x1/y1/x2/y2 parsed');
    assert.strictEqual(boxArea({ x: 0, y: 0, w: 2, h: 2 }, { x: 1, y: 1, w: 2, h: 2 }), 1);
    assert.strictEqual(boxArea({ x: 0, y: 0, w: 1, h: 1 }, { x: 1, y: 0, w: 1, h: 1 }), 0, 'touching is not overlap');
    assert.ok(Math.abs(segInBox({ x1: -1, y1: 1, x2: 3, y2: 1 }, { x: 0, y: 0, w: 2, h: 2 }) - 2) < 1e-9);
    assert.strictEqual(segInBox({ x1: -1, y1: 5, x2: 3, y2: 5 }, { x: 0, y: 0, w: 2, h: 2 }), 0);
});

test('H3 contrast oracle matches WCAG reference values', function () {
    assert.ok(Math.abs(ratio([0, 0, 0], [255, 255, 255]) - 21) < 1e-9, 'black on white = 21');
    assert.strictEqual(ratio([10, 20, 30], [10, 20, 30]), 1, 'identical = 1');
});

test('H4 every pilot renders, maps, and draws map numbers', function () {
    FX.reactions.forEach(function (r) {
        var out = renderPilot(r.id);
        assert.strictEqual(out.res.status, 'mapped', r.id + ' maps');
        assert.ok(measure(out).maps > 20, r.id + ' draws map numbers');
    });
});

// ---------------------------------------------------------------------------
// P. Single-molecule export is pinned byte-identical to BIME 3.0.3 (FR-018).
//    Hashes captured by --write-baseline before any source change (T004).
// ---------------------------------------------------------------------------
test('P1 toSVG / toPublicationSVG / toPrintSVG are byte-identical to 3.0.3', function () {
    var pins = FX.pinnedSingleMolecule || {};
    assert.ok(Object.keys(pins).length === 9, 'fixture carries 9 pinned hashes');
    var now = pinnedHashes();
    Object.keys(pins).forEach(function (k) {
        assert.strictEqual(now[k], pins[k], k + ' output changed');
    });
});

// ---------------------------------------------------------------------------
// L. Pure legibility helpers (ImageExport._legibility) — research D3/D4.
// ---------------------------------------------------------------------------
function L() {
    assert.ok(ImageExport._legibility, 'ImageExport._legibility is exposed');
    return ImageExport._legibility;
}

function hsl(rgb) {
    var r = rgb[0] / 255, g = rgb[1] / 255, b = rgb[2] / 255;
    var mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn, h = 0, s = 0;
    if (d > 0) {
        s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
        h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : (mx === g ? (b - r) / d + 2 : (r - g) / d + 4);
        h *= 60;
    }
    return [h, s, l];
}

test('L1 parseColor reads #rgb, #rrggbb and rgb()', function () {
    assert.deepStrictEqual(L().parseColor('#fff'), [255, 255, 255]);
    assert.deepStrictEqual(L().parseColor('#0d9488'), [13, 148, 136]);
    assert.deepStrictEqual(L().parseColor('rgb(1, 2, 3)'), [1, 2, 3]);
    assert.strictEqual(L().parseColor('currentColor'), null);
});

test('L2 luminance / contrast match WCAG reference values', function () {
    assert.ok(Math.abs(L().contrast('#000000', '#ffffff') - 21) < 1e-9);
    assert.strictEqual(L().contrast('#0d9488', '#0d9488'), 1);
    assert.ok(Math.abs(L().contrast('#0000cc', '#ffffff') - ratio([0, 0, 204], [255, 255, 255])) < 1e-9);
});

test('L3 composite blends a halo at its opacity over the canvas', function () {
    var c = L().composite('#a5d8d2', 0.85, '#ffffff');
    [178.5, 221.85, 216.75].forEach(function (v, i) { assert.ok(Math.abs(c[i] - v) < 1e-9, 'channel ' + i); });
});

test('L4 remedyColour keeps hue + saturation and meets the threshold', function () {
    var fill = L().composite('#a5d8d2', 0.85, '#ffffff');
    ['#0d9488', '#2563eb', '#cc0000'].forEach(function (c) {
        var fixed = L().remedyColour(c, fill, 4.5);
        assert.ok(fixed, c + ' is remediable to 4.5:1');
        var a = hsl(L().parseColor(c)), b = hsl(L().parseColor(fixed));
        assert.ok(Math.abs(a[0] - b[0]) < 3, c + ' hue kept (' + a[0].toFixed(1) + ' vs ' + b[0].toFixed(1) + ')');
        assert.ok(Math.abs(a[1] - b[1]) < 0.06, c + ' saturation kept');
        assert.ok(L().contrast(fixed, fill) >= 4.5, c + ' -> ' + fixed + ' meets 4.5:1');
    });
});

test('L5 remedyColour returns the input when it already passes, null when unreachable', function () {
    assert.strictEqual(L().remedyColour('#0000cc', '#ffffff', 3), '#0000cc');
    assert.strictEqual(L().remedyColour('#0d9488', [128, 128, 128], 21), null, '21:1 on grey is unreachable');
});

test('L6 remedyColour is deterministic and only moves as far as needed', function () {
    var fill = [200, 200, 200];
    var a = L().remedyColour('#0d9488', fill, 3), b = L().remedyColour('#0d9488', fill, 3);
    assert.strictEqual(a, b, 'same input -> same output');
    assert.notStrictEqual(a, '#0d9488', 'teal on light grey needed a shift');
    // A 3:1 target needs a smaller lightness shift than 4.5:1 from the same start.
    var l0 = hsl(L().parseColor('#0d9488'))[2];
    var l3 = hsl(L().parseColor(a))[2], l45 = hsl(L().parseColor(L().remedyColour('#0d9488', fill, 4.5)))[2];
    assert.ok(Math.abs(l3 - l0) < Math.abs(l45 - l0), 'smaller target -> smaller shift');
});

// ---------------------------------------------------------------------------
// U1. User Story 1 — labels without unnecessary white boxes (SC-001, SC-004,
//     FR-001…FR-006). Pilots rendered with the default publication palette.
// ---------------------------------------------------------------------------
var ESTER = 'c1ccccc1C(=O)O.OCC>>c1ccccc1C(=O)OCC.O';
var AUDITED = { symbol: true, deco: true, map: true };

function auditContrast(svg, canvas, min) {
    var g = parseSvg(svg), fails = [];
    g.texts.forEach(function (t) {
        if (!AUDITED[t.kind]) { return; }
        var c = worstContrast(t, g, canvas);
        if (c < min) { fails.push(t.content + '@' + t.x + ',' + t.y + ' ' + t.fill + ' ' + c.toFixed(2)); }
    });
    return { g: g, fails: fails };
}

test('US1-a every atom text item meets 3:1 on every pilot (SC-001)', function () {
    FX.reactions.forEach(function (r) {
        var a = auditContrast(renderPilot(r.id).svg, '#ffffff', 3);
        assert.deepStrictEqual(a.fails.slice(0, 5), [], r.id + ': ' + a.fails.length + ' low-contrast text items');
    });
});

test('US1-b no unconditional knockout rects; any patch hides a genuinely failing colour (SC-004)', function () {
    FX.reactions.forEach(function (r) {
        var g = parseSvg(renderPilot(r.id).svg);
        assert.strictEqual(g.knockouts.length, 0, r.id + ': 3.0.3-style knockout rects remain (' + g.knockouts.length + ')');
        g.patches.forEach(function (p) {
            var t = g.texts.filter(function (x) { return AUDITED[x.kind] && boxInRect(x.box, p); })[0];
            assert.ok(t, r.id + ': every patch sits behind an atom text');
            var bare = { patches: [], halos: g.halos };
            assert.ok(worstContrast(t, bare, '#ffffff') < 3, r.id + ': patch behind ' + t.content + ' was unnecessary');
        });
    });
});

test('US1-c an O / N label on a pale halo gets neither box nor recolour (esterification)', function () {
    var out = render(ESTER);
    var g = parseSvg(out.svg);
    assert.strictEqual(g.knockouts.length + g.patches.length, 0, 'no rects behind labels');
    g.texts.filter(function (t) { return t.kind === 'symbol' && t.content === 'O'; }).forEach(function (t) {
        assert.strictEqual(t.fill, '#cc0000', 'publication O keeps its CPK colour when it already passes');
    });
});

test('US1-d a failing label is recoloured within its own hue (minContrast 6)', function () {
    var g = parseSvg(render(ESTER, { minContrast: 6 }).svg);
    var os = g.texts.filter(function (t) { return t.kind === 'symbol' && t.content === 'O'; });
    var shifted = os.filter(function (t) { return t.fill !== '#cc0000'; });
    assert.ok(shifted.length > 0, 'some O labels recoloured at 6:1');
    shifted.forEach(function (t) {
        var h0 = hsl([204, 0, 0]), h1 = hsl(hex(t.fill));
        assert.ok(Math.abs(h0[0] - h1[0]) < 3 && Math.abs(h0[1] - h1[1]) < 0.06, 'O stays red: ' + t.fill);
    });
    var a = auditContrast(render(ESTER, { minContrast: 6 }).svg, '#ffffff', 6);
    assert.deepStrictEqual(a.fails, [], 'all text meets 6:1');
});

test('US1-e unreachable contrast falls back to a tight rounded patch (minContrast 21)', function () {
    var g = parseSvg(render(ESTER, { minContrast: 21 }).svg);
    assert.ok(g.patches.length > 0, 'patches drawn');
    assert.strictEqual(g.knockouts.length, 0, 'no unrounded knockouts');
    g.patches.forEach(function (p) {
        var t = g.texts.filter(function (x) { return AUDITED[x.kind] && boxInRect(x.box, p); })[0];
        assert.ok(t, 'patch covers a text box');
        assert.ok(p.w <= t.box.w + 4 && p.h <= t.box.h + 3, 'patch is tight (' + p.w + 'x' + p.h + ' vs ' + t.box.w + 'x' + t.box.h + ')');
    });
});

test('US1-f transparent background is judged against white and stays legible', function () {
    var out = render(ESTER, { background: 'transparent' });
    var a = auditContrast(out.svg, '#ffffff', 3);
    assert.deepStrictEqual(a.fails, [], 'transparent figure passes against white');
    assert.strictEqual(a.g.knockouts.length, 0, 'no knockouts on transparent');
});

test('US1-g the screen palette also meets 3:1 (publication:false)', function () {
    var r = FX.reactions[2];
    var a = auditContrast(render(r.smiles, { publication: false }).svg, '#ffffff', 3);
    assert.deepStrictEqual(a.fails.slice(0, 5), [], 'screen palette: ' + a.fails.length + ' failures');
});

test('US1-h bonds stop short of their own atom label (FR-006)', function () {
    // FR-006 concerns a label and its OWN bonds: for each labelled atom, the
    // drawn segment of every incident bond (the line collinear with the
    // atom->neighbour ray) must stay outside the label's glyph core. Bonds of
    // other atoms crossing a label are layout overlap (Feature B), and atoms
    // with a near-coincident partner are excluded as in SC-002.
    var checked = 0, bad = [];
    FX.reactions.forEach(function (r) {
        var out = renderPilot(r.id), m = measure(out), mol = out.mol, px = m._px;
        m._labels.filter(function (t) { return t.kind === 'symbol'; }).forEach(function (t) {
            var A = px[t.owner], core = inflate(t.box, -1);
            var crowded = mol.atoms.some(function (o) {
                return o.id !== t.owner && dist(px[o.id].x, px[o.id].y, A.x, A.y) < COINCIDENT * PILOT_SCALE;
            });
            if (crowded) { return; }
            mol.getNeighbors(t.owner).forEach(function (nb) {
                var B = px[nb], len = dist(A.x, A.y, B.x, B.y), ux = (B.x - A.x) / len, uy = (B.y - A.y) / len;
                var best = null, bestD = Infinity;
                // The bond's own (on-axis) stroke: BOTH endpoints lie on the A->B
                // axis inside the bond span. Symmetric double bonds have no
                // on-axis stroke and are skipped; other atoms' bonds that merely
                // cross the axis are rejected.
                m._bonds.forEach(function (b) {
                    var ends = [[b.x1, b.y1], [b.x2, b.y2]].map(function (P) {
                        var dx = P[0] - A.x, dy = P[1] - A.y;
                        return { perp: Math.abs(dx * uy - dy * ux), along: dx * ux + dy * uy };
                    });
                    var onAxis = ends.every(function (e) { return e.perp < 0.75 && e.along > 0 && e.along < len; });
                    var near = Math.min(ends[0].along, ends[1].along);
                    if (onAxis && near < bestD) { bestD = near; best = b; }
                });
                if (!best) { return; }
                checked++;
                if (segInBox(best, core) > 0.5) { bad.push(r.id + ':' + t.content + '@' + t.x.toFixed(0) + ',' + t.y.toFixed(0)); }
            });
        });
    });
    assert.ok(checked > 100, 'checked own bonds of labelled atoms (' + checked + ')');
    assert.deepStrictEqual(bad.slice(0, 8), [], bad.length + ' own-bond ends run into their label: ' + bad.slice(0, 8).join(' '));
});

// ---------------------------------------------------------------------------
// U2. User Story 2 — map numbers that don't collide (SC-002, SC-003, SC-005,
//     FR-007…FR-011).
// ---------------------------------------------------------------------------
function coincidentAtom(id, px, mol) {
    return mol.atoms.some(function (o) {
        return o.id !== id && dist(px[o.id].x, px[o.id].y, px[id].x, px[id].y) < COINCIDENT * PILOT_SCALE;
    });
}

test('US2-0 placement primitives agree with the independent harness (boxOverlap, segInBox)', function () {
    var cases = [
        [{ x: 0, y: 0, w: 2, h: 2 }, { x: 1, y: 1, w: 2, h: 2 }],
        [{ x: 0, y: 0, w: 1, h: 1 }, { x: 1, y: 0, w: 1, h: 1 }],
        [{ x: 0, y: 0, w: 5, h: 3 }, { x: -2, y: 1, w: 3, h: 9 }]
    ];
    cases.forEach(function (c) { assert.strictEqual(L().boxOverlap(c[0], c[1]), boxArea(c[0], c[1])); });
    [{ x1: -1, y1: 1, x2: 3, y2: 1 }, { x1: -1, y1: 5, x2: 3, y2: 5 }, { x1: 0.5, y1: -3, x2: 1.5, y2: 4 }].forEach(function (sg) {
        assert.ok(Math.abs(L().segInBox(sg, { x: 0, y: 0, w: 2, h: 2 }) - segInBox(sg, { x: 0, y: 0, w: 2, h: 2 })) < 1e-9);
    });
});

test('US2-a zero map/map and map/label overlaps for uncrowded atoms (SC-002)', function () {
    FX.reactions.forEach(function (r) {
        var m = measure(renderPilot(r.id)), b = FX.baseline[r.id];
        console.log('    ' + r.id + ': map/map ' + m.mapMapU + ' (all ' + m.mapMap + '), map/label ' + m.mapLabelU +
            ' (all ' + m.mapLabel + '); 3.0.3 uncrowded ' + b.mapMapU + '/' + b.mapLabelU +
            '; crowded map atoms ' + m.crowdedMaps + '/' + m.maps);
        assert.strictEqual(m.mapMapU, 0, r.id + ': uncrowded map/map overlaps ' + m.mapMapU);
        assert.strictEqual(m.mapLabelU, 0, r.id + ': uncrowded map/label overlaps ' + m.mapLabelU);
    });
});

test('US2-b uncrowded map/bond overlaps fall by at least 75% vs 3.0.3 (SC-003)', function () {
    FX.reactions.forEach(function (r) {
        var m = measure(renderPilot(r.id)), cap = Math.floor(0.25 * FX.baseline[r.id].mapBondU);
        console.log('    ' + r.id + ': map/bond ' + m.mapBondU + ' (all ' + m.mapBond + '); 3.0.3 uncrowded ' +
            FX.baseline[r.id].mapBondU + ' (all ' + FX.baseline[r.id].mapBond + '), cap ' + cap);
        assert.ok(m.mapBondU <= cap, r.id + ': uncrowded map/bond ' + m.mapBondU + ' > ' + cap);
    });
});

test('US2-c every uncrowded map number sits nearer its own atom than any other atom (FR-010)', function () {
    FX.reactions.forEach(function (r) {
        var out = renderPilot(r.id), m = measure(out), bad = [];
        m._maps.forEach(function (t) {
            if (t.owner == null || m._crowded[t.owner]) { return; }
            var c = boxCentre(t.box), own = m._px[t.owner], dOwn = dist(c.x, c.y, own.x, own.y);
            out.mol.atoms.forEach(function (a) {
                if (a.id === t.owner) { return; }
                if (dist(c.x, c.y, m._px[a.id].x, m._px[a.id].y) < dOwn - 0.01) { bad.push(t.content); }
            });
        });
        assert.deepStrictEqual(bad.slice(0, 5), [], r.id + ': ' + bad.length + ' numbers nearer another atom');
    });
});

test('US2-d map-number font never drops below 75% of standard (FR-010)', function () {
    FX.reactions.forEach(function (r) {
        measure(renderPilot(r.id))._maps.forEach(function (t) {
            assert.ok(t.size >= 9 - 1e-9, r.id + ': map number ' + t.content + ' at ' + t.size + 'px');
        });
    });
});

test('US2-e the same reaction renders byte-identically twice (SC-005, FR-009)', function () {
    var r = FX.reactions[2];
    var a = stripStamp(render(r.smiles).svg), b = stripStamp(render(r.smiles).svg);
    assert.strictEqual(sha(a), sha(b), 'two renders differ');
});

test('US2-f esterification: no map number collides, none sits on its own bonds', function () {
    var out = render(ESTER), m = measure(out);
    assert.strictEqual(m.mapMap + m.mapLabel, 0, 'map/map + map/label overlaps');
    var own = 0;
    m._maps.forEach(function (t) {
        var A = m._px[t.owner];
        out.mol.getNeighbors(t.owner).forEach(function (nb) {
            var B = m._px[nb];
            if (segInBox({ x1: A.x, y1: A.y, x2: B.x, y2: B.y }, t.box) > 0) { own++; }
        });
    });
    assert.strictEqual(own, 0, own + ' map numbers sit on their own atom\'s bonds');
});

test('US2-g showMapNumbers:false draws no map numbers (FR-011)', function () {
    var g = parseSvg(render(ESTER, { showMapNumbers: false }).svg);
    assert.strictEqual(g.texts.filter(function (t) { return t.kind === 'map'; }).length, 0);
});

// ---------------------------------------------------------------------------
// U3. User Story 3 — heavy-atom figures built in (FR-012…FR-015, SC-007).
// ---------------------------------------------------------------------------
function strip(smi) {
    var m = SmilesParser.parse(smi);
    assert.strictEqual(typeof m.removeExplicitHydrogens, 'function', 'Molecule.prototype.removeExplicitHydrogens exists');
    var n = m.removeExplicitHydrogens();
    return { mol: m, removed: n };
}
function symbols(m) { return m.atoms.map(function (a) { return a.symbol; }).join(''); }

test('US3-a explicit H is removed into its neighbour (bracket count +1, auto stays auto)', function () {
    var r = strip('[CH3][H]');
    assert.strictEqual(r.removed, 1);
    assert.strictEqual(symbols(r.mol), 'C');
    assert.strictEqual(r.mol.atoms[0].hydrogens, 4, 'bracket count 3 -> 4');
    var a = strip('C[H]');
    assert.strictEqual(a.mol.atoms[0].hydrogens, -1, 'auto neighbour stays auto');
    assert.strictEqual(a.mol.calcHydrogens(a.mol.atoms[0].id), 4, 'auto H count re-derives to 4');
    var w = strip('[H]O[H]');
    assert.strictEqual(w.removed, 2);
    assert.strictEqual(w.mol.calcHydrogens(w.mol.atoms[0].id), 2, 'water oxygen keeps 2 H');
});

test('US3-b isotopic, charged, H-only and non-terminal hydrogens are kept (FR-013)', function () {
    assert.strictEqual(strip('[2H]C').removed, 0, 'deuterium kept');
    assert.strictEqual(strip('[H][H]').removed, 0, 'H2 kept');
    assert.strictEqual(strip('[H+]').removed, 0, 'proton kept');
    assert.strictEqual(strip('[H-]C').removed, 0, 'charged H kept');
    var m = new Molecule();
    var b1 = m.addAtom('B', 0, 0), b2 = m.addAtom('B', 30, 0), h = m.addAtom('H', 15, 10);
    m.addBond(b1.id, h.id, 1); m.addBond(b2.id, h.id, 1);
    assert.strictEqual(m.removeExplicitHydrogens(), 0, 'bridging H (two neighbours) kept');
    assert.strictEqual(m.atoms.length, 3);
});

test('US3-c stereocentre configuration survives stripping at every neighbour position (FR-014)', function () {
    ['[H][C@](F)(Cl)Br', 'F[C@]([H])(Cl)Br', 'F[C@](Cl)([H])Br', 'F[C@](Cl)(Br)[H]',
     '[H][C@@](F)(Cl)Br', 'F[C@@]([H])(Cl)Br', 'F[C@@](Cl)([H])Br', 'F[C@@](Cl)(Br)[H]',
     '[C@@]([H])(F)(Cl)Br'].forEach(function (smi) {
        var before = SmilesParser.parse(smi);
        CIPStereo.assignRS(before);
        var cBefore = before.atoms.filter(function (a) { return a.symbol === 'C'; })[0].cipLabel;
        assert.ok(cBefore === 'R' || cBefore === 'S', smi + ' has a CIP label before');
        var r = strip(smi);
        CIPStereo.assignRS(r.mol);
        var cAfter = r.mol.atoms.filter(function (a) { return a.symbol === 'C'; })[0].cipLabel;
        assert.strictEqual(cAfter, cBefore, smi + ': ' + cBefore + ' -> ' + cAfter);
    });
});

test('US3-d surviving atom/bond ids are unchanged and the return value counts removals', function () {
    var m = SmilesParser.parse('[H]C([H])([H])O[H]');
    var keep = m.atoms.filter(function (a) { return a.symbol !== 'H'; }).map(function (a) { return a.id; });
    var keepBond = m.bonds.filter(function (b) {
        return m.getAtom(b.atom1).symbol !== 'H' && m.getAtom(b.atom2).symbol !== 'H';
    }).map(function (b) { return b.id; });
    assert.strictEqual(m.removeExplicitHydrogens(), 4);
    assert.deepStrictEqual(m.atoms.map(function (a) { return a.id; }), keep);
    assert.deepStrictEqual(m.bonds.map(function (b) { return b.id; }), keepBond);
    assert.strictEqual(m.removeExplicitHydrogens(), 0, 'nothing left to strip');
});

// CLI (contracts/cli.md). Each call is a fresh process.
var childProcess = require('child_process');
var CLI = path.join(__dirname, '..', 'tools', 'bime-cli.js');
function cli(args) {
    return childProcess.execFileSync(process.execPath, [CLI].concat(args),
        { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
}
var XH = FX.explicitH.smiles;                                       // explicit-H fixture
var XH_PRE = '[C@H](N)(C)C(=O)OC.O>>[C@H](N)(C)C(=O)O.OC';          // same, H removed by hand

test('US3-e hand pre-stripped fixture is the same chemistry (oracle check)', function () {
    function labels(smi) {
        var m = SmilesParser.parse(smi); CIPStereo.assignRS(m);
        return m.atoms.filter(function (a) { return a.cipLabel; }).map(function (a) { return a.cipLabel; }).join('');
    }
    assert.strictEqual(labels(XH_PRE), labels(XH), 'CIP labels agree');
    assert.ok(labels(XH).length === 2, 'two stereocentres');
});

test('US3-f `aam --heavy-atoms` maps exactly the heavy atoms (json + text, FR-012/013)', function () {
    var withH = JSON.parse(cli(['aam', XH, '--format', 'json']));
    var heavy = JSON.parse(cli(['aam', XH, '--heavy-atoms', '--format', 'json']));
    var pre = JSON.parse(cli(['aam', XH_PRE, '--format', 'json']));
    assert.strictEqual(heavy.mappedCount, pre.mappedCount, 'same mapped count as hand-stripped');
    assert.ok(withH.mappedCount > heavy.mappedCount, 'without the flag the H atoms are mapped too (FR-015)');
    var txt = cli(['aam', XH, '--heavy-atoms', '--format', 'text']);
    assert.ok(new RegExp('Mapped atoms: ' + pre.mappedCount + '\\b').test(txt), 'text format reports the heavy count');
});

test('US3-g `aam --heavy-atoms --format svg` draws the hand-stripped figure (SC-007)', function () {
    var rawA = stripStamp(cli(['aam', XH, '--heavy-atoms', '--format', 'svg', '--no-stamp']));
    var rawB = stripStamp(cli(['aam', XH_PRE, '--format', 'svg', '--no-stamp']));
    assert.strictEqual(sha(rawA), sha(rawB), 'byte-identical to the hand-stripped figure');
    var a = parseSvg(rawA), b = parseSvg(rawB);
    function sig(g) {
        return JSON.stringify({
            symbols: g.texts.filter(function (t) { return t.kind === 'symbol' || t.kind === 'deco'; })
                .map(function (t) { return t.content; }).sort(),
            maps: g.texts.filter(function (t) { return t.kind === 'map'; }).map(function (t) { return t.content; }).sort(),
            bonds: g.lines.length, halos: g.halos.length
        });
    }
    assert.strictEqual(sig(a), sig(b), 'same atoms, H labels, map numbers, bonds and halos');
    assert.strictEqual(a.texts.filter(function (t) { return t.kind === 'symbol' && t.content === 'H'; }).length, 0,
        'no explicit H atoms drawn');
});

test('US3-h `--heavy-atoms --keep-mapping` uses the curated map numbers minus H', function () {
    var mapped = '[H:9][C@:1]([NH2:2])([CH3:3])[C:4](=[O:5])[O:6][CH3:7]>>[H:9][C@:1]([NH2:2])([CH3:3])[C:4](=[O:5])[OH:6].[CH3:7][OH:8]';
    var r = JSON.parse(cli(['aam', mapped, '--heavy-atoms', '--keep-mapping', '--format', 'json']));
    assert.strictEqual(r.mappedCount, 7, '7 heavy map pairs survive (H:9 dropped)');
});

module.exports = runner.summary;
if (require.main === module) {
    var s = runner.summary();
    console.log('\n' + s.passed + ' passed, ' + s.failed + ' failed');
    process.exit(s.failed > 0 ? 1 : 0);
}
