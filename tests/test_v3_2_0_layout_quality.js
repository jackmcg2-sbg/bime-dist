/**
 * tests/test_v3_2_0_layout_quality.js — 2D layout quality guard (Feature 002,
 * specs/002-reaction-layout-overlaps): module parity, cis/trans and wedge
 * correctness, and the fold-back repair, measured on the committed corpus
 * sample (tests/data/layout_corpus.json) and the Feature 001 pilot reactions.
 *
 * Copyright (c) 2026 BioInception PVT LTD, Cambridge, UK and Syed Asad Rahman.
 * All rights reserved. Licensed under the Apache License, Version 2.0 - see LICENSE.txt
 *
 * The helpers here are oracles independent of the code under test: the defect
 * metric (shared with tools/layout-bench.js, which is a report, not the code
 * under test), an E/Z side check, a stereo read-back from drawn coordinates +
 * wedges (research R5 b) and a ring-geometry comparer. Process-sensitive checks
 * (parity, determinism) run in fresh child processes, because layout depends on
 * process history (docs/known-defects.md).
 *
 *   node tests/test_v3_2_0_layout_quality.js
 */
'use strict';

var assert = require('assert');
var fs = require('fs');
var path = require('path');
var childProcess = require('child_process');

var ROOT = path.join(__dirname, '..');
var CLI_PATH = path.join(ROOT, 'tools', 'bime-cli.js');
require(CLI_PATH).loadEditor();          // the engine the CLI uses (research R1)

var shim = require(path.join(__dirname, 'shim.js'));
var bench = require(path.join(ROOT, 'tools', 'layout-bench.js'));

var Molecule = globalThis.Molecule;
var SmilesParser = globalThis.SmilesParser;
var Layout = globalThis.Layout;
var CIPStereo = globalThis.CIPStereo;
var BL = Molecule.BOND_LENGTH;

var FX = JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'layout_corpus.json'), 'utf8'));
var PILOT_FX = JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'reaction_map_pilot.json'), 'utf8'));

var runner = shim.makeRunner('Layout quality (v3.2.0)');
// NS_ONLY=<regex> runs a subset (development convenience; the suite runs all).
var NS_ONLY = process.env.NS_ONLY ? new RegExp(process.env.NS_ONLY) : null;
var NS_TIME = !!process.env.NS_TIME;   // print per-test wall time (development)
var test = function (name, fn) {
    if (NS_ONLY && !NS_ONLY.test(name)) { return; }
    if (!NS_TIME) { runner.test(name, fn); return; }
    var t0 = Date.now();
    runner.test(name, fn);
    console.log('      [' + ((Date.now() - t0) / 1000).toFixed(1) + ' s]');
};
console.log('Layout quality (v3.2.0)');

// ---------------------------------------------------------------------------
// Helpers (oracles)
// ---------------------------------------------------------------------------

function laid(smiles) {
    var mol = SmilesParser.parse(smiles);
    assert.ok(mol && mol.atoms.length, 'parsed ' + smiles.slice(0, 40));
    Layout.layout(mol);
    return mol;
}

// Reporting metric: crossings, close pairs (<0.6 BL), severe (<0.35 BL), abnormal bonds.
function defects(mol, atomIds) { return bench.defects(mol, atomIds || null, BL); }

// Which side of the line a->b point p lies on (screen coordinates).
function side(a, b, p) {
    var v = (b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x);
    return v > 0 ? 1 : (v < 0 ? -1 : 0);
}

// Drawn geometry of the first C=C (or any double bond between two
// 2-substituted atoms): 'cis' | 'trans' | null.
function drawnEZ(mol, bond) {
    var a = mol.getAtom(bond.atom1), b = mol.getAtom(bond.atom2);
    var na = mol.getNeighbors(bond.atom1).filter(function (x) { return x !== bond.atom2; });
    var nb = mol.getNeighbors(bond.atom2).filter(function (x) { return x !== bond.atom1; });
    if (!na.length || !nb.length) { return null; }
    var sa = side(a, b, mol.getAtom(na[0])), sb = side(a, b, mol.getAtom(nb[0]));
    if (!sa || !sb) { return null; }
    return sa === sb ? 'cis' : 'trans';
}

// Signed volume of three vectors (rows), right-handed.
function det3(u, v, w) {
    return u[0] * (v[1] * w[2] - v[2] * w[1]) - u[1] * (v[0] * w[2] - v[2] * w[0]) + u[2] * (v[0] * w[1] - v[1] * w[0]);
}

// z of neighbour `nb` as seen from stereocentre `c`: +1 toward the viewer, -1 away, 0 in plane.
function wedgeZ(mol, c, nb) {
    var bond = mol.bonds.filter(function (b) {
        return (b.atom1 === c && b.atom2 === nb) || (b.atom2 === c && b.atom1 === nb);
    })[0];
    if (!bond) { return 0; }
    var st = (bond.depictStereo !== undefined && bond.depictStereo !== 0) ? bond.depictStereo : 0;
    if (!st) { return 0; }
    var z = (st === 1) ? 1 : (st === 6 ? -1 : 0);
    var from = bond.depictStereoFromAtom;
    // A wedge whose narrow (stereo) end is the other atom says nb's end is the
    // raised one relative to that atom; seen from c, the sign flips.
    return (from === undefined || from === null || from === c) ? z : -z;
}

// Read a stereocentre's @/@@ back from the drawing, in the parser's frame
// (heavy neighbours in getNeighbors() order, implicit H last). Returns
// '@' | '@@' | null (undetermined: no wedge, or degenerate geometry).
// The sign convention is calibrated by H3 below against RDKit labels.
function readBackChirality(mol, cId) {
    var c = mol.getAtom(cId);
    var nbs = mol.getNeighbors(cId);
    var vecs = nbs.map(function (n) {
        var a = mol.getAtom(n);
        return [a.x - c.x, -(a.y - c.y), wedgeZ(mol, cId, n)];   // math y-up
    });
    if (vecs.every(function (v) { return v[2] === 0; })) { return null; }
    if (vecs.length === 3) {
        // Implicit H: opposite the mean in-plane direction, in plane.
        var sx = 0, sy = 0;
        vecs.forEach(function (v) { var l = Math.hypot(v[0], v[1]) || 1; sx += v[0] / l; sy += v[1] / l; });
        vecs.push([-sx, -sy, 0]);
    }
    if (vecs.length !== 4) { return null; }
    var p0 = vecs[0];
    var rel = vecs.slice(1).map(function (v) { return [v[0] - p0[0], v[1] - p0[1], v[2] - p0[2]]; });
    var vol = det3(rel[0], rel[1], rel[2]);
    if (Math.abs(vol) < 1e-6) { return null; }
    return vol > 0 ? READBACK_POSITIVE : (READBACK_POSITIVE === '@' ? '@@' : '@');
}
var READBACK_POSITIVE = '@@';   // calibrated by H3 (R5: simple molecules read back correctly today)

// CIP labels (R/S) the drawing implies, by atom index (SMILES order).
function readBackCIP(mol) {
    var saved = mol.atoms.map(function (a) { return { chir: a.chirality, cip: a.cipLabel }; });
    mol.atoms.forEach(function (a) {
        if (a.chirality) { a.chirality = readBackChirality(mol, a.id) || ''; }
    });
    CIPStereo.assignRS(mol);
    var out = mol.atoms.map(function (a) { return a.cipLabel || ''; });
    mol.atoms.forEach(function (a, i) { a.chirality = saved[i].chir; a.cipLabel = saved[i].cip; });
    return out;
}

// Ring bond lengths and internal angles, keyed by ring atom ids.
function ringGeometry(mol) {
    var g = {};
    mol.findRings(20).forEach(function (r) {
        var A = r.atoms, n = A.length;
        for (var i = 0; i < n; i++) {
            var p = mol.getAtom(A[(i + n - 1) % n]), q = mol.getAtom(A[i]), s = mol.getAtom(A[(i + 1) % n]);
            g['b' + A[i] + ',' + A[(i + 1) % n]] = Math.hypot(q.x - s.x, q.y - s.y);
            var a1 = Math.atan2(p.y - q.y, p.x - q.x), a2 = Math.atan2(s.y - q.y, s.x - q.x);
            var d = Math.abs(a1 - a2); if (d > Math.PI) { d = 2 * Math.PI - d; }
            g['a' + A.join('-') + '@' + i] = d;
        }
    });
    return g;
}
function ringGeometryDiff(g1, g2) {
    var worst = 0;
    Object.keys(g1).forEach(function (k) {
        if (!(k in g2) || !g1[k]) { return; }
        worst = Math.max(worst, Math.abs(g2[k] - g1[k]) / g1[k]);
    });
    return worst;
}

// True when SMILES has a bare `*` atom (outside brackets), which the parser drops.
function hasBareStar(smiles) { return /(^|[^\[])\*/.test(smiles.replace(/\[[^\]]*\]/g, '')); }

// Run a snippet in a fresh Node process; returns stdout.
function fresh(js) {
    return childProcess.execFileSync(process.execPath, ['-e', js], { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 26 });
}

// ---------------------------------------------------------------------------
// H. Helper self-tests (pass on unmodified code)
// ---------------------------------------------------------------------------

test('H1 fixture: 367 corpus molecules, stereo and E/Z sets, provenance', function () {
    assert.strictEqual(FX.molecules.length, 367);
    assert.ok(FX.provenance && FX.provenance.toolkit === 'RDKit');
    assert.ok(FX.stereoSet.length >= 6 && FX.ezSet.length === 6);
    // Parsed in the shared fresh-process corpus run (T021a), not again here.
    corpusRuns().on.forEach(function (r) {
        // Pre-existing parser defect: a bare `*` (a valid SMILES wildcard) is
        // reported as "Unexpected character" and its atom is DROPPED (4 molecules,
        // one atom per bare `*`). Baseline and repair runs measure the same
        // reduced structure. Any other parse error fails.
        var errs = r.errors.filter(function (e) { return !/Unexpected character "\*"/.test(e); });
        assert.ok(errs.length === 0, r.file + ' parses: ' + errs.join('; '));
        var bareStars = r.errors.length - errs.length;
        // `atoms` is RDKit's atom count of the stored SMILES: heavy atoms plus
        // any explicit [H] kept for double-bond stereo (e.g. [H]/N=C, 23
        // molecules) — the counting the exploration and baseline bins used.
        assert.strictEqual(r.n + bareStars, r.atoms, r.file + ' atom count matches');
    });
});

test('H2 defect metric counts a constructed crossing, close pair and clash', function () {
    var m = new Molecule();
    var a = m.addAtom('C', 0, 0), b = m.addAtom('C', BL, BL), c = m.addAtom('C', 0, BL), d = m.addAtom('C', BL, 0);
    m.addBond(a.id, b.id, 1); m.addBond(c.id, d.id, 1);
    var e = m.addAtom('O', 3 * BL, 0), f = m.addAtom('O', 3 * BL + 0.5 * BL, 0), g = m.addAtom('O', 3 * BL + 0.6 * BL, 0.1 * BL);
    var r = defects(m);
    assert.strictEqual(r.crossings, 1, 'one crossing');
    assert.ok(r.closePairs >= 1, 'close pair e-f');
    assert.ok(r.severe >= 1, 'severe f-g');
    void e; void f; void g;
});

test('H3 stereo read-back is calibrated: simple centres match RDKit labels', function () {
    // Wedges come from SDG.NonplanarBonds, which the pre-feature CLI never
    // loads; assign them explicitly so the calibration runs on any module set.
    // (R5: the existing assignment is right for these simple centres.)
    require(path.join(ROOT, 'editor', 'sdg', 'NonplanarBonds.js'));
    ['L-alanine', 'D-alanine', 'L-lactate'].forEach(function (name) {
        var s = FX.stereoSet.filter(function (x) { return x.name === name; })[0];
        var mol = laid(s.smiles);
        globalThis.SDG.NonplanarBonds.assign(mol);
        var cip = readBackCIP(mol);
        s.stereo.forEach(function (st) {
            assert.strictEqual(cip[st.atomIndex], st.cip, name + ' atom ' + st.atomIndex + ' reads back ' + st.cip);
        });
    });
});

test('H4 E/Z side check reads a hand-drawn cis and trans', function () {
    var m = new Molecule();
    var a = m.addAtom('C', 0, 0), b = m.addAtom('C', BL, 0), c = m.addAtom('C', -BL / 2, BL), d = m.addAtom('C', 1.5 * BL, BL);
    var db = m.addBond(a.id, b.id, 2); m.addBond(a.id, c.id, 1); m.addBond(b.id, d.id, 1);
    assert.strictEqual(drawnEZ(m, db), 'cis');
    d.y = -BL;
    assert.strictEqual(drawnEZ(m, db), 'trans');
});

test('H5 ring comparer detects a 5% ring distortion and ignores rigid motion', function () {
    var m = laid('c1ccccc1CCO');
    var g0 = ringGeometry(m);
    m.atoms.forEach(function (a) { var x = a.x; a.x = a.y + 7; a.y = -x + 3; });
    assert.ok(ringGeometryDiff(g0, ringGeometry(m)) < 1e-9, 'rotation + translation is not distortion');
    var r = m.findRings(20)[0].atoms;
    m.getAtom(r[0]).x += 0.05 * BL * 2;
    assert.ok(ringGeometryDiff(g0, ringGeometry(m)) > 0.01, 'distortion detected');
});

test('H6 baseline recorded on unmodified code (T003)', function () {
    var b = FX.baseline || {};
    assert.ok(b.perBin && b.pilots && b.timing, 'baseline perBin, pilots and timing present');
    assert.strictEqual(b.moduleSet, 'cli-3.1-pre', 'baseline taken with the pre-feature CLI module set');
});

// ---------------------------------------------------------------------------
// US1 — correct stereochemistry in every figure (module parity + wedges)
// ---------------------------------------------------------------------------


// Molecules for process-level comparisons: every pilot component + every 9th
// corpus molecule (fixture order).
function paritySet() {
    var out = [];
    PILOT_FX.reactions.forEach(function (r) {
        r.smiles.split('>>').forEach(function (side) { side.split('.').forEach(function (c) { out.push(c); }); });
    });
    FX.molecules.forEach(function (m, i) { if (i % 9 === 0) { out.push(m.smiles); } });
    return out;
}

// Child-process program: load an engine, lay out each SMILES in order, print
// rounded coordinates. `loader` is 'cli' (tools/bime-cli.js loadEditor) or
// 'engine' (shim + every ENGINE_FILES module, i.e. the browser's engine).
function coordsProgram(loader, smilesList) {
    return [
        'var path = require("path"), ROOT = ' + JSON.stringify(ROOT) + ';',
        'if (' + JSON.stringify(loader) + ' === "cli") { require(path.join(ROOT, "tools", "bime-cli.js")).loadEditor(); }',
        'else { require(path.join(ROOT, "tests", "shim.js")).loadAll();',
        '  var EF = require(path.join(ROOT, "tools", "editor-files.js")).ENGINE_FILES;',
        '  if (!EF) { throw new Error("tools/editor-files.js has no ENGINE_FILES"); }',
        '  EF.forEach(function (f) { require(path.join(ROOT, "editor", f)); }); }',
        'var out = ' + JSON.stringify(smilesList) + '.map(function (s) {',
        '  var m = SmilesParser.parse(s); Layout.layout(m);',
        '  return m.atoms.map(function (a) { return [Math.round(a.x * 1e4) / 1e4, Math.round(a.y * 1e4) / 1e4]; }); });',
        'process.stdout.write(JSON.stringify(out));'
    ].join('\n');
}

test('US1-a ENGINE_FILES and UI_FILES partition FILES, in bundle order (ADR-0001)', function () {
    var ef = require(path.join(ROOT, 'tools', 'editor-files.js'));
    assert.ok(Array.isArray(ef.ENGINE_FILES) && Array.isArray(ef.UI_FILES), 'ENGINE_FILES and UI_FILES exported');
    var seen = {};
    ef.ENGINE_FILES.concat(ef.UI_FILES).forEach(function (f) {
        assert.ok(ef.FILES.indexOf(f) !== -1, f + ' is a bundle file');
        assert.ok(!seen[f], f + ' classified once'); seen[f] = true;
    });
    assert.strictEqual(Object.keys(seen).length, ef.FILES.length, 'every bundle file classified');
    var order = ef.ENGINE_FILES.map(function (f) { return ef.FILES.indexOf(f); });
    assert.deepStrictEqual(order, order.slice().sort(function (a, b) { return a - b; }), 'bundle order kept');
});

test('US1-b CLI and browser engine lay out identically, fresh processes (SC-001)', function () {
    var list = paritySet();
    var cli = JSON.parse(jobs().cliA.out), eng = JSON.parse(jobs().engine.out);
    var diff = [];
    list.forEach(function (s, i) {
        if (JSON.stringify(cli[i]) !== JSON.stringify(eng[i])) { diff.push(s.slice(0, 40)); }
    });
    assert.strictEqual(diff.length, 0, diff.length + '/' + list.length + ' differ, e.g. ' + diff.slice(0, 3).join(' | '));
});

test('US1-c CLI draws specified cis/trans as specified (SC-002, FR-004)', function () {
    // From the shared fresh-process CLI run (T021a): the named set, and every
    // corpus double bond with specified geometry (fixture `ez` pairs from
    // RDKit's depiction; bare-`*` molecules skipped, see H1). Macrocycle
    // cramped ends are listed, not failed (FR-004 exception); the relation is
    // always checked.
    var r = corpusRuns(), checked = 0, bad = [];
    var badNamed = r.named.filter(function (x) { return x.drawn !== x.expect; });
    assert.strictEqual(badNamed.length, 0, 'named set wrong: ' + badNamed.map(function (x) { return x.name + ' drawn ' + x.drawn; }).join(', '));
    r.on.forEach(function (row, i) {
        var m = FX.molecules[i];
        if (!m.ez || !m.ez.length || hasBareStar(m.smiles)) { return; }
        checked += m.ez.length;
        row.ez.forEach(function (p) {
            var real = p.split('; ').filter(function (x) { return !isListed(x); });
            if (real.length) { bad.push(row.file + ' ' + real.join('; ')); }
        });
    });
    assert.ok(checked > 0, 'corpus has specified double bonds');
    assert.strictEqual(bad.length, 0, bad.length + '/' + checked + ' corpus double bonds drawn wrong, e.g. ' + bad.slice(0, 3).join(' | '));
});

// Both ends of each specified double bond: a two-substituent end has its
// substituents on opposite sides of the bond axis, and the a/d pair is drawn
// with the expected relation.
// Spec FR-004 exception (slice-3 stop-and-report): a double bond inside a
// macrocycle (both atoms in one ring of >= 8 atoms, a ring neighbour on each
// end) may have a cramped end; that is LISTED ("listed: ..."), not failed.
// The cis/trans relation is always enforced.
function checkDoubleBond(mol, ids, expect) {
    var P = ids.map(function (i) { return mol.atoms[i]; });
    var b = P[1], c = P[2], problems = [];
    var macro = mol.findRings(64).filter(function (r) {
        return r.atoms.length >= 8 && r.atoms.indexOf(b.id) !== -1 && r.atoms.indexOf(c.id) !== -1;
    })[0];
    [[b, c], [c, b]].forEach(function (end) {
        var subs = mol.getNeighbors(end[0].id).filter(function (x) { return x !== end[1].id; });
        if (subs.length === 2) {
            var s0 = side(b, c, mol.getAtom(subs[0])), s1 = side(b, c, mol.getAtom(subs[1]));
            if (s0 === s1) {
                var msg = 'both substituents of atom ' + mol.atoms.indexOf(end[0]) + ' on one side';
                var exempt = macro && [b, c].every(function (e) {
                    return mol.getNeighbors(e.id).some(function (x) { return x !== b.id && x !== c.id && macro.atoms.indexOf(x) !== -1; });
                });
                problems.push(exempt ? 'listed: ' + msg + ' (macrocycle, FR-004 exception)' : msg);
            }
        }
    });
    var sa = side(b, c, P[0]), sd = side(b, c, P[3]);
    var drawn = (sa && sd) ? (sa === sd ? 'cis' : 'trans') : 'undetermined';
    if (drawn !== expect) { problems.push('drawn ' + drawn + ', expected ' + expect); }
    return problems;
}
function isListed(p) { return p.indexOf('listed: ') === 0; }

test('US1-c2 E/Z correction flips the whole end of a trisubstituted alkene (T009a)', function () {
    // [SMILES, [a, b, c, d] in SMILES atom order (b=c the double bond), a/d relation
    // read straight from the directional markers: X/C=C/Y trans, X/C=C\\Y cis].
    [['C/C(=C/CC)CO', [0, 1, 2, 3], 'trans'],
     ['C/C(=C\\CC)CO', [0, 1, 2, 3], 'cis'],
     ['OC/C(C)=C/CC', [1, 2, 4, 5], 'trans'],
     ['OC/C(C)=C\\CC', [1, 2, 4, 5], 'cis']].forEach(function (t) {
        var problems = checkDoubleBond(laid(t[0]), t[1], t[2]).filter(function (p) { return !isListed(p); });
        assert.deepStrictEqual(problems, [], t[0] + ': ' + problems.join('; '));
    });
});

test('US1-c3 corpus double bonds that 3.1 mis-draws (T009a): VITEBTENALCt, PHEPROARGr', function () {
    ['VITEBTENALCt.rxn', 'PHEPROARGr.rxn'].forEach(function (file) {
        FX.molecules.filter(function (m) { return m.file === file && m.ez && m.ez.length; }).forEach(function (m) {
            var mol = laid(m.smiles);
            m.ez.forEach(function (z) {
                var all = checkDoubleBond(mol, z.atoms, z.expect);
                all.filter(isListed).forEach(function (p) { console.log('    (info) ' + file + ' ' + p); });
                var problems = all.filter(function (p) { return !isListed(p); });
                assert.deepStrictEqual(problems, [], file + ' bond ' + z.atoms.join(',') + ': ' + problems.join('; '));
            });
        });
    });
});

// Every stereo-labelled centre in the stereo set and the corpus (bare-`*`
// molecules skipped: atom indices shift, see H1).
function stereoCases() {
    var cases = [];
    FX.stereoSet.forEach(function (s) { if (s.stereo.length) { cases.push({ name: s.name, smiles: s.smiles, stereo: s.stereo }); } });
    FX.molecules.forEach(function (m) {
        if (m.stereo && m.stereo.length && !hasBareStar(m.smiles)) { cases.push({ name: m.file, smiles: m.smiles, stereo: m.stereo }); }
    });
    return cases;
}

test('US1-e every drawn stereocentre reads back as its input configuration (SC-002a, FR-004a)', function () {
    // (1) The drawing (coordinates + wedges) reads back as the input's own @/@@,
    //     for every centre. (2) External anchor: the read-back R/S equals RDKit's
    //     label wherever BIME's CIP labeller agrees with RDKit on the input.
    //     Labeller disagreements on the input are listed, not failed: they are
    //     about CIP ranking, not about the drawing.
    var total = 0, tokenWrong = [], cipWrong = [], labellerDiffer = [];
    stereoCases().forEach(function (c) {
        var mol = laid(c.smiles);
        var input = SmilesParser.parse(c.smiles);
        CIPStereo.assignRS(input);
        var cip = readBackCIP(mol);
        c.stereo.forEach(function (st) {
            total++;
            var atom = mol.atoms[st.atomIndex];
            var rb = readBackChirality(mol, atom.id);
            if (rb !== atom.chirality) { tokenWrong.push(c.name + '#' + st.atomIndex + ' ' + atom.chirality + '->' + (rb || '?')); }
            var bimeInput = input.atoms[st.atomIndex].cipLabel || '';
            if (bimeInput !== st.cip) { labellerDiffer.push(c.name + '#' + st.atomIndex + ' RDKit ' + st.cip + ' / BIME ' + (bimeInput || '-')); return; }
            if (cip[st.atomIndex] !== st.cip) { cipWrong.push(c.name + '#' + st.atomIndex + ' ' + st.cip + '->' + (cip[st.atomIndex] || '?')); }
        });
    });
    assert.ok(total >= 80, 'enough centres checked (' + total + ')');
    assert.strictEqual(tokenWrong.length, 0, tokenWrong.length + '/' + total + ' centres drawn against their @/@@, e.g. ' + tokenWrong.slice(0, 5).join(', '));
    assert.strictEqual(cipWrong.length, 0, cipWrong.length + ' centres read back with the wrong R/S, e.g. ' + cipWrong.slice(0, 5).join(', '));
    if (labellerDiffer.length) { console.log('    (info) CIP labellers disagree on the input (not a drawing issue): ' + labellerDiffer.join(', ')); }
});

test('US1-f wedges start at stereocentres; undrawn centres are listed', function () {
    var bad = [], undrawn = [];
    stereoCases().forEach(function (c) {
        var mol = laid(c.smiles);
        mol.bonds.forEach(function (b) {
            if (!b.depictStereo) { return; }
            var from = mol.getAtom(b.depictStereoFromAtom);
            if (!from || !from.chirality) { bad.push(c.name + ' bond ' + b.atom1 + '-' + b.atom2); }
        });
        c.stereo.forEach(function (st) {
            var a = mol.atoms[st.atomIndex];
            var hasWedge = mol.bonds.some(function (b) { return b.depictStereo && b.depictStereoFromAtom === a.id; });
            if (!hasWedge) { undrawn.push(c.name + '#' + st.atomIndex); }
        });
    });
    assert.strictEqual(bad.length, 0, 'wedges not starting at a stereocentre: ' + bad.slice(0, 5).join(', '));
    if (undrawn.length) { console.log('    (info) stereocentres without a wedge: ' + undrawn.length + ' — ' + undrawn.slice(0, 8).join(', ')); }
});

test('US1-d static bundle without layout modules warns once on stderr (R9, FR-005)', function () {
    function run(withLayoutModules) {
        var prog = [
            'globalThis.RDT = {}; globalThis.SmilesParser = {}; globalThis.Layout = {};',
            withLayoutModules ? 'globalThis.SDG = {}; globalThis.SDGLayout = {}; globalThis.SMSDLayout = {}; globalThis.Templates = {};' : '',
            'require(' + JSON.stringify(CLI_PATH) + ').loadEditor();',
            'process.stdout.write(globalThis.Molecule ? "reloaded" : "kept");'
        ].join('\n');
        var res = childProcess.spawnSync(process.execPath, ['-e', prog], { cwd: ROOT, encoding: 'utf8' });
        return { out: res.stdout, err: res.stderr };
    }
    var full = run(true), partial = run(false);
    assert.strictEqual(full.out, 'kept', 'complete static bundle is not reloaded');
    assert.strictEqual(full.err, '', 'no warning for a complete static bundle');
    assert.strictEqual(partial.out, 'kept', 'static bundle is not reloaded (cannot load files there)');
    assert.strictEqual(partial.err.trim(),
        'bime: layout modules missing from this build; figures may differ from the browser',
        'one-line warning when layout modules are absent');
});

// ---------------------------------------------------------------------------
// US2 — fold-back repair (Step 16R). The corpus is laid out once with the
// repair and once without (internal switch, FR-012a) and shared by the tests.
// ---------------------------------------------------------------------------

// Process-level checks run once, as one batch of fresh child processes started
// IN PARALLEL (T021a: test time). Each corpus run lays out the whole corpus in
// fixture order, so the "off" and "on" runs share the same process history
// (layout depends on it; docs/known-defects.md) and differ only in the switch.
function corpusProgram(repair) {
    return [
        'var path = require("path"), ROOT = ' + JSON.stringify(ROOT) + ';',
        'require(path.join(ROOT, "tools", "bime-cli.js")).loadEditor();',
        'var bench = require(path.join(ROOT, "tools", "layout-bench.js"));',
        'Layout.options.foldBackRepair = ' + JSON.stringify(repair) + ';',
        side.toString(), ringGeometry.toString(), checkDoubleBond.toString(), isListed.toString(), hasBareStar.toString(),
        'var FX = require(path.join(ROOT, "tests", "data", "layout_corpus.json"));',
        'var mols = FX.molecules.map(function (m) {',
        '  var mol = SmilesParser.parse(m.smiles); Layout.layout(mol);',
        '  var ez = [];',
        '  if (m.ez && m.ez.length && !hasBareStar(m.smiles)) { m.ez.forEach(function (z) {',
        '    var p = checkDoubleBond(mol, z.atoms, z.expect); if (p.length) { ez.push(p.join("; ")); } }); }',
        '  return { n: mol.atoms.length, errors: mol.parseErrors || [],',
        '           d: bench.defects(mol, null, Molecule.BOND_LENGTH), ring: ringGeometry(mol), ez: ez,',
        '           coords: mol.atoms.map(function (a) { return [a.x, a.y]; }) }; });',
        // Named cis/trans set (SC-002), drawn by the CLI engine.
        'var named = FX.ezSet.map(function (e) {',
        '  var m = SmilesParser.parse(e.smiles); Layout.layout(m);',
        '  var b = m.bonds.filter(function (x) { return x.type === 2 && CIPStereo.doubleBondEZ(m, x); })[0];',
        '  var na = m.getNeighbors(b.atom1).filter(function (x) { return x !== b.atom2; })[0];',
        '  var nb = m.getNeighbors(b.atom2).filter(function (x) { return x !== b.atom1; })[0];',
        '  var A = m.getAtom(b.atom1), B = m.getAtom(b.atom2);',
        '  return { name: e.name, expect: e.expect, drawn: side(A, B, m.getAtom(na)) === side(A, B, m.getAtom(nb)) ? "cis" : "trans" }; });',
        'process.stdout.write(JSON.stringify({ mols: mols, named: named }));'
    ].join('\n');
}

// A function, not a var: H1 runs before this point of the file is evaluated.
function jobDriver() { return [
    'var fs = require("fs"), cp = require("child_process");',
    'var job = JSON.parse(fs.readFileSync(process.argv[1], "utf8")), names = Object.keys(job.specs), out = {}, left = names.length;',
    'names.forEach(function (n) {',
    '  var c = cp.spawn(process.execPath, job.specs[n], { cwd: job.cwd }), buf = [], err = [];',
    '  c.stdout.on("data", function (d) { buf.push(d); }); c.stderr.on("data", function (d) { err.push(d); });',
    '  c.on("close", function (code) {',
    '    out[n] = { code: code, out: Buffer.concat(buf).toString(), err: Buffer.concat(err).toString().slice(0, 2000) };',
    '    if (--left === 0) { process.stdout.write(JSON.stringify(out)); } }); });'
].join('\n'); }

var JOBS;          // no initialiser: H1 may fill it before this line runs
function jobs() {
    if (JOBS) { return JOBS; }
    var bench = path.join(ROOT, 'tools', 'layout-bench.js');
    var ggh = PILOT_FX.reactions.filter(function (r) { return r.id === 'GGH_10FTHF7GLUl'; })[0];
    var list = paritySet();
    var specs = {
        off: ['-e', corpusProgram(false)], on: ['-e', corpusProgram(true)],
        svgA: [CLI_PATH, 'aam', ggh.smiles, '--format', 'svg', '--no-stamp'],
        svgB: [CLI_PATH, 'aam', ggh.smiles, '--format', 'svg', '--no-stamp'],
        cliA: ['-e', coordsProgram('cli', list)], cliB: ['-e', coordsProgram('cli', list)],
        engine: ['-e', coordsProgram('engine', list)]
    };
    PILOT_FX.reactions.forEach(function (p) { specs['pilot:' + p.id] = [bench, '--pilot-child', p.id]; });
    var file = path.join(require('os').tmpdir(), 'bime-ns-jobs-' + process.pid + '.json');
    fs.writeFileSync(file, JSON.stringify({ cwd: ROOT, specs: specs }));
    try {
        var res = JSON.parse(childProcess.execFileSync(process.execPath, ['-e', jobDriver(), file],
                                                       { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 28 }));
        Object.keys(res).forEach(function (n) {
            if (res[n].code !== 0) { throw new Error('job ' + n + ' exited ' + res[n].code + ': ' + res[n].err); }
        });
        JOBS = res;
    } finally { try { fs.unlinkSync(file); } catch (e) { /* already gone */ } }
    return JOBS;
}

var CORPUS_RUNS;   // no initialiser: H1 may fill it before this line runs
function corpusRuns() {
    if (CORPUS_RUNS) { return CORPUS_RUNS; }
    function rows(name) {
        var r = JSON.parse(jobs()[name].out);
        return { named: r.named, mols: r.mols.map(function (x, i) {
            var m = FX.molecules[i];
            return { file: m.file, atoms: m.atoms, bin: m.bin, n: x.n, errors: x.errors, d: x.d, ring: x.ring, ez: x.ez, coords: x.coords };
        }) };
    }
    var off = rows('off'), on = rows('on');
    CORPUS_RUNS = { off: off.mols, on: on.mols, named: on.named };
    return CORPUS_RUNS;
}

function binStats(rows, bin) {
    var b = rows.filter(function (r) { return r.bin === bin; });
    return {
        n: b.length,
        pct: 100 * b.filter(function (r) { return r.d.crossings > 0; }).length / b.length,
        mean: b.reduce(function (s, r) { return s + r.d.crossings; }, 0) / b.length
    };
}

test('US2-a corpus crossings meet SC-003 against the baseline', function () {
    var on = corpusRuns().on, base = FX.baseline.perBin;
    var b3 = binStats(on, '31-50'), b5 = binStats(on, '51-80');
    var total = on.reduce(function (s, r) { return s + r.d.crossings; }, 0);
    var worst = on.slice().sort(function (p, q) { return q.d.crossings - p.d.crossings; }).slice(0, 10)
        .map(function (r) { return r.file + '(' + r.atoms + '):' + r.d.crossings; });
    var msg = ' [31-50 ' + b3.pct.toFixed(1) + '%, 51-80 ' + b5.pct.toFixed(1) + '% mean ' + b5.mean.toFixed(2) +
              ', total ' + total + ' vs baseline ' + FX.baseline.totals.crossings + '; worst: ' + worst.join(' ') + ']';
    assert.ok(b3.pct <= 15, '31-50 atoms: ≤15% with crossings (baseline ' + base['31-50'].withCrossingsPct + '%)' + msg);
    assert.ok(b5.pct <= 35, '51-80 atoms: ≤35% with crossings (baseline ' + base['51-80'].withCrossingsPct + '%)' + msg);
    assert.ok(b5.mean <= 1.0, '51-80 atoms: mean crossings ≤1.0 (baseline ' + base['51-80'].meanCrossings + ')' + msg);
    assert.ok(total <= 0.15 * FX.baseline.totals.crossings, 'total crossings −85%' + msg);
});

test('US2-b no molecule ends worse than with the repair off (SC-004)', function () {
    var r = corpusRuns(), worse = [];
    r.on.forEach(function (on, i) {
        var off = r.off[i];
        ['crossings', 'closePairs', 'severe'].forEach(function (k) {
            if (on.d[k] > off.d[k]) { worse.push(on.file + ' ' + k + ' ' + off.d[k] + '->' + on.d[k]); }
        });
    });
    assert.strictEqual(worse.length, 0, worse.length + ' regressions, e.g. ' + worse.slice(0, 5).join(', '));
});

test('US2-c pilot figures: total crossings −75%, no severe clash (SC-005)', function () {
    // SC-005: total crossings over the three pilots fall by at least 75% against
    // the baseline (48 / 7 / 25), and no pilot has a severe clash. Per-pilot
    // counts are reported in the message.
    var was = 0, now = 0, per = [], severe = [];
    PILOT_FX.reactions.forEach(function (p) {
        var r = JSON.parse(jobs()['pilot:' + p.id].out.trim().split('\n').pop()), b = FX.baseline.pilots[p.id];
        was += b.crossings; now += r.crossings;
        per.push(p.id + ' ' + b.crossings + '->' + r.crossings);
        if (r.severe > 0) { severe.push(p.id + ' severe ' + r.severe); }
    });
    assert.ok(now <= 0.25 * was, 'total ' + was + '->' + now + ' (' + per.join(', ') + ')');
    assert.strictEqual(severe.length, 0, severe.join('; '));
});

test('US2-d ring bond lengths and angles unchanged by the repair, within 1% (SC-006, FR-007)', function () {
    var r = corpusRuns(), bad = [];
    r.on.forEach(function (on, i) {
        var off = r.off[i];
        if (!Object.keys(on.ring).length) { return; }
        var worst = ringGeometryDiff(off.ring, on.ring);
        if (worst > 0.01) { bad.push(on.file + ' ' + (100 * worst).toFixed(1) + '%'); }
    });
    assert.strictEqual(bad.length, 0, bad.length + ' molecules with distorted rings, e.g. ' + bad.slice(0, 5).join(', '));
});

test('US2-e specified cis/trans survives the repair (FR-008)', function () {
    var bad = [];
    FX.ezSet.forEach(function (e) {
        var mol = laid(e.smiles);
        var db = mol.bonds.filter(function (x) { return x.type === 2 && CIPStereo.doubleBondEZ(mol, x); })[0];
        if (drawnEZ(mol, db) !== e.expect) { bad.push(e.name); }
    });
    corpusRuns().on.forEach(function (on) {
        on.ez.forEach(function (p) {
            if (p.split('; ').every(isListed)) { console.log('    (info) ' + on.file + ' ' + p); }
            else { bad.push(on.file + ' ' + p.split('; ').filter(function (x) { return !isListed(x); }).join('; ')); }
        });
    });
    assert.strictEqual(bad.length, 0, bad.slice(0, 5).join(', '));
});

test('US2-f defect-free molecules are not moved by the repair (FR-011)', function () {
    var r = corpusRuns(), moved = [];
    r.off.forEach(function (off, i) {
        if (off.d.crossings || off.d.closePairs || off.d.severe) { return; }
        if (JSON.stringify(off.coords) !== JSON.stringify(r.on[i].coords)) { moved.push(off.file); }
    });
    ['c1ccccc1O', 'CC(C)Cc1ccc(cc1)C(C)C(=O)O', 'OC[C@H]1O[C@H](O)[C@H](O)[C@@H](O)[C@@H]1O'].forEach(function (s) {
        var save = Layout.options.foldBackRepair;
        Layout.options.foldBackRepair = false; var a = laid(s); var dA = defects(a);
        Layout.options.foldBackRepair = save; var b = laid(s);
        if (!dA.crossings && !dA.closePairs && !dA.severe &&
            JSON.stringify(a.atoms.map(function (x) { return [x.x, x.y]; })) !== JSON.stringify(b.atoms.map(function (x) { return [x.x, x.y]; }))) {
            moved.push(s);
        }
    });
    assert.strictEqual(moved.length, 0, 'moved: ' + moved.slice(0, 5).join(', '));
});

test('US2-g same input, fresh processes: byte-identical figure and coordinates (SC-007, FR-014)', function () {
    var J = jobs();
    assert.ok(J.svgA.out.length > 0 && J.svgA.out === J.svgB.out, 'pilot figure identical across two fresh processes');
    assert.strictEqual(J.cliA.out, J.cliB.out, 'corpus subset coordinates identical');
});

test('US2-h the repair never introduces an abnormal bond length (FR-010)', function () {
    var r = corpusRuns(), bad = [];
    r.on.forEach(function (on, i) {
        if (on.d.abnormalBonds > r.off[i].d.abnormalBonds) { bad.push(on.file + ' ' + r.off[i].d.abnormalBonds + '->' + on.d.abnormalBonds); }
    });
    assert.strictEqual(bad.length, 0, bad.slice(0, 5).join(', '));
});

test('US2-i effort bound: >300 atoms skipped, evaluation cap respected (FR-012)', function () {
    // 320-atom branched alkane: a long chain carrying a methyl on every other carbon.
    var big = 'C'; for (var k = 0; k < 106; k++) { big += 'C(C)C'; }
    var mol = laid(big);
    assert.ok(mol.atoms.length > 300, 'synthetic molecule has ' + mol.atoms.length + ' atoms');
    var st = Layout._lastRepairStats;
    assert.ok(st && st.skipped === true, 'repair skipped above 300 atoms');
    var m120 = FX.molecules.filter(function (m) { return m.atoms >= 90; })[0];
    laid(m120.smiles);
    st = Layout._lastRepairStats;
    assert.ok(st && st.skipped === false && st.evaluations <= 50000,
              m120.file + ' (' + m120.atoms + ' atoms): evaluations ' + (st && st.evaluations) + ' ≤ 50000');
});

void ringGeometry;

module.exports = runner.summary;
if (require.main === module) {
    var s = runner.summary();
    console.log('\n' + s.passed + ' passed, ' + s.failed + ' failed');
    process.exit(s.failed > 0 ? 1 : 0);
}
