#!/usr/bin/env node
/**
 * tools/layout-bench.js — maintainer benchmark for 2D layout quality
 * (Feature 002, specs/002-reaction-layout-overlaps).
 *
 * Copyright (c) 2026 BioInception PVT LTD, Cambridge, UK and Syed Asad Rahman.
 * Licensed under the Apache License, Version 2.0 - see LICENSE.txt
 *
 * Lays out every molecule of tests/data/layout_corpus.json in one process, in
 * fixture order, with the engine the CLI loads (tools/bime-cli.js loadEditor),
 * and reports per size bin: share of molecules with a bond crossing, mean
 * crossings, mean close pairs, severe clashes and median layout time — next to
 * the stored baseline and RDKit reference. This tool reports; the guard test
 * (tests/test_v3_2_0_layout_quality.js) judges. It is not a `bime` subcommand.
 *
 *   node tools/layout-bench.js [--json] [--no-repair] [--bin 51-80] [--runs N]
 *   node tools/layout-bench.js --write-baseline [--runs 3] [--pilot-runs 5]
 *
 * --write-baseline records baseline.{moduleSet, perBin, pilots, timing} into
 * the fixture. Run it only on code without Feature 002's source changes.
 * Pilot figures are measured in fresh child processes (layout depends on
 * process history; docs/known-defects.md).
 */
'use strict';

var fs = require('fs');
var path = require('path');
var childProcess = require('child_process');

var ROOT = path.join(__dirname, '..');
var FIXTURE = path.join(ROOT, 'tests', 'data', 'layout_corpus.json');
var PILOTS = path.join(ROOT, 'tests', 'data', 'reaction_map_pilot.json');
var CLI = path.join(__dirname, 'bime-cli.js');

function parseArgs(argv) {
    var a = { flags: {} };
    for (var i = 0; i < argv.length; i++) {
        if (argv[i].indexOf('--') !== 0) { continue; }
        var k = argv[i].slice(2), v = argv[i + 1];
        if (v !== undefined && v.indexOf('--') !== 0) { a.flags[k] = v; i++; } else { a.flags[k] = true; }
    }
    return a;
}

// ---- reporting metric (data-model "Layout defect") -------------------------

function segmentsCross(a, b, c, d) {
    function o(p, q, r) { return (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x); }
    var d1 = o(c, d, a), d2 = o(c, d, b), d3 = o(a, b, c), d4 = o(a, b, d);
    return ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0));
}

function defects(mol, atomIds, bondLength) {
    var inSet = null;
    if (atomIds) { inSet = {}; atomIds.forEach(function (id) { inSet[id] = true; }); }
    var atoms = mol.atoms.filter(function (a) { return !inSet || inSet[a.id]; });
    var bonds = mol.bonds.filter(function (b) { return !inSet || (inSet[b.atom1] && inSet[b.atom2]); });
    var bonded = {};
    bonds.forEach(function (b) { bonded[b.atom1 + ',' + b.atom2] = true; bonded[b.atom2 + ',' + b.atom1] = true; });
    var r = { crossings: 0, closePairs: 0, severe: 0, abnormalBonds: 0 };
    for (var i = 0; i < bonds.length; i++) {
        for (var j = i + 1; j < bonds.length; j++) {
            var p = bonds[i], q = bonds[j];
            if (p.atom1 === q.atom1 || p.atom1 === q.atom2 || p.atom2 === q.atom1 || p.atom2 === q.atom2) { continue; }
            if (segmentsCross(mol.getAtom(p.atom1), mol.getAtom(p.atom2), mol.getAtom(q.atom1), mol.getAtom(q.atom2))) {
                r.crossings++;
            }
        }
    }
    for (var m = 0; m < atoms.length; m++) {
        for (var n = m + 1; n < atoms.length; n++) {
            if (bonded[atoms[m].id + ',' + atoms[n].id]) { continue; }
            var d = Math.hypot(atoms[m].x - atoms[n].x, atoms[m].y - atoms[n].y) / bondLength;
            if (d < 0.35) { r.severe++; } else if (d < 0.6) { r.closePairs++; }
        }
    }
    bonds.forEach(function (b) {
        var u = mol.getAtom(b.atom1), v = mol.getAtom(b.atom2);
        var l = Math.hypot(u.x - v.x, u.y - v.y) / bondLength;
        if (l < 0.65 || l > 1.25) { r.abnormalBonds++; }
    });
    return r;
}

function median(xs) {
    if (!xs.length) { return 0; }
    var s = xs.slice().sort(function (a, b) { return a - b; });
    var h = s.length >> 1;
    return s.length % 2 ? s[h] : (s[h - 1] + s[h]) / 2;
}

function moduleSetName() {
    var g = globalThis;
    return (g.SDG && g.SMSDLayout && g.Templates) ? 'engine' : 'cli-3.1-pre';
}

// ---- corpus run ------------------------------------------------------------

function runCorpus(fx, opts) {
    var BL = globalThis.Molecule.BOND_LENGTH;
    var rows = [];
    fx.molecules.forEach(function (m) {
        if (opts.bin && m.bin !== opts.bin) { return; }
        var t0 = process.hrtime.bigint();
        var mol = globalThis.SmilesParser.parse(m.smiles);
        globalThis.Layout.layout(mol);
        var ms = Number(process.hrtime.bigint() - t0) / 1e6;
        var d = defects(mol, null, BL);
        rows.push({ file: m.file, smiles: m.smiles, atoms: m.atoms, bin: m.bin, ms: ms,
                    crossings: d.crossings, closePairs: d.closePairs, severe: d.severe, abnormalBonds: d.abnormalBonds,
                    rdkit: m.rdkit });
    });
    return rows;
}

function summarise(rows, binOrder) {
    var perBin = {};
    binOrder.forEach(function (key) {
        var b = rows.filter(function (r) { return r.bin === key; });
        if (!b.length) { return; }
        var sum = function (f) { return b.reduce(function (s, r) { return s + f(r); }, 0); };
        perBin[key] = {
            n: b.length,
            withCrossingsPct: +(100 * b.filter(function (r) { return r.crossings > 0; }).length / b.length).toFixed(1),
            meanCrossings: +(sum(function (r) { return r.crossings; }) / b.length).toFixed(2),
            meanClosePairs: +(sum(function (r) { return r.closePairs; }) / b.length).toFixed(2),
            severe: sum(function (r) { return r.severe; }),
            medianMs: +median(b.map(function (r) { return r.ms; })).toFixed(1),
            rdkitWithCrossingsPct: +(100 * b.filter(function (r) { return r.rdkit.crossings > 0; }).length / b.length).toFixed(1),
            rdkitMeanCrossings: +(sum(function (r) { return r.rdkit.crossings; }) / b.length).toFixed(2)
        };
    });
    var tot = { crossings: 0, closePairs: 0, severe: 0 };
    rows.forEach(function (r) { tot.crossings += r.crossings; tot.closePairs += r.closePairs; tot.severe += r.severe; });
    var worst = rows.slice().sort(function (a, b) {
        return (b.crossings - a.crossings) || (b.closePairs - a.closePairs);
    }).slice(0, 10).map(function (r) {
        return { file: r.file, atoms: r.atoms, crossings: r.crossings, closePairs: r.closePairs };
    });
    return { perBin: perBin, totals: tot, worst: worst };
}

function binKeys(fx) {
    return fx.bins.map(function (b) { return b[1] === null ? b[0] + '+' : b[0] + '-' + b[1]; });
}

// ---- pilot figures (fresh child process per pilot) ---------------------------

function pilotChild(id) {
    var cli = require(CLI);
    cli.loadEditor();
    var p = JSON.parse(fs.readFileSync(PILOTS, 'utf8')).reactions.filter(function (r) { return r.id === id; })[0];
    var rxn = globalThis.SmilesParser.parse(p.smiles);
    var res = globalThis.RDT.mapReaction(rxn, {});
    globalThis.ImageExport.toReactionMapSVG(rxn, res, {});
    var BL = globalThis.Molecule.BOND_LENGTH;
    var tot = { crossings: 0, closePairs: 0, severe: 0, abnormalBonds: 0 };
    rxn.getComponents().forEach(function (ids) {
        var d = defects(rxn, ids, BL);
        Object.keys(tot).forEach(function (k) { tot[k] += d[k]; });
    });
    process.stdout.write(JSON.stringify(tot) + '\n');
}

function pilotMetrics() {
    var out = {};
    JSON.parse(fs.readFileSync(PILOTS, 'utf8')).reactions.forEach(function (p) {
        var s = childProcess.execFileSync(process.execPath, [__filename, '--pilot-child', p.id],
                                          { encoding: 'utf8', maxBuffer: 1 << 26 });
        out[p.id] = JSON.parse(s.trim().split('\n').pop());
    });
    return out;
}

function pilotTiming(runs) {
    var out = {};
    JSON.parse(fs.readFileSync(PILOTS, 'utf8')).reactions.forEach(function (p) {
        var times = [];
        for (var i = 0; i < runs; i++) {
            var t0 = process.hrtime.bigint();
            childProcess.execFileSync(process.execPath, [CLI, 'aam', p.smiles, '--format', 'svg', '--no-stamp'],
                                      { encoding: 'utf8', maxBuffer: 1 << 26 });
            times.push(Number(process.hrtime.bigint() - t0) / 1e6);
        }
        out[p.id] = { medianMs: +median(times).toFixed(0), runs: times.map(function (t) { return Math.round(t); }) };
    });
    return out;
}

// ---- report ----------------------------------------------------------------

function pad(s, w) { s = String(s); return s.length >= w ? s : new Array(w - s.length + 1).join(' ') + s; }

function printTable(rep, fx) {
    var base = (fx.baseline && fx.baseline.perBin) || {};
    console.log('module set: ' + rep.moduleSet + '   repair: ' + (rep.repair ? 'on' : 'off'));
    console.log(pad('bin', 6) + pad('n', 5) + ' | ' + pad('%cross', 7) + pad('mean', 7) + pad('close', 7) + pad('sev', 5) + pad('medMs', 8) +
                ' | base:' + pad('%cross', 7) + pad('mean', 7) + pad('medMs', 8) + ' | rdkit:' + pad('%cross', 7) + pad('mean', 7));
    Object.keys(rep.perBin).forEach(function (k) {
        var r = rep.perBin[k], b = base[k] || {};
        console.log(pad(k, 6) + pad(r.n, 5) + ' | ' + pad(r.withCrossingsPct, 7) + pad(r.meanCrossings, 7) + pad(r.meanClosePairs, 7) +
                    pad(r.severe, 5) + pad(r.medianMs, 8) + ' |      ' + pad(b.withCrossingsPct === undefined ? '-' : b.withCrossingsPct, 7) +
                    pad(b.meanCrossings === undefined ? '-' : b.meanCrossings, 7) + pad(b.medianMs === undefined ? '-' : b.medianMs, 8) +
                    ' |       ' + pad(r.rdkitWithCrossingsPct, 7) + pad(r.rdkitMeanCrossings, 7));
    });
    var bt = fx.baseline && fx.baseline.totals;
    console.log('totals: crossings ' + rep.totals.crossings + (bt ? ' (baseline ' + bt.crossings + ')' : '') +
                ', close pairs ' + rep.totals.closePairs + ', severe ' + rep.totals.severe);
    console.log('worst: ' + rep.worst.slice(0, 5).map(function (w) { return w.file + '(' + w.atoms + '): ' + w.crossings + 'x/' + w.closePairs + 'c'; }).join('; '));
}

function main() {
    var args = parseArgs(process.argv.slice(2));
    if (args.flags['pilot-child']) { pilotChild(args.flags['pilot-child']); return; }

    require(CLI).loadEditor();
    var fx = JSON.parse(fs.readFileSync(FIXTURE, 'utf8'));
    var repair = !args.flags['no-repair'];
    if (!repair) { globalThis.Layout.options.foldBackRepair = false; }

    var runs = parseInt(args.flags.runs, 10) || (args.flags['write-baseline'] ? 3 : 1);
    var keys = binKeys(fx);
    var all = [];
    for (var r = 0; r < runs; r++) { all.push(runCorpus(fx, { bin: args.flags.bin })); }
    // Defect counts come from the first run; times are the median over runs.
    var rows = all[0].map(function (row, i) {
        var copy = Object.assign({}, row);
        copy.ms = median(all.map(function (run) { return run[i].ms; }));
        return copy;
    });
    var rep = summarise(rows, keys);
    rep.moduleSet = moduleSetName();
    rep.repair = repair;

    if (args.flags['write-baseline']) {
        var pilotRuns = parseInt(args.flags['pilot-runs'], 10) || 5;
        fx.baseline = {
            moduleSet: rep.moduleSet,
            recorded: new Date().toISOString().slice(0, 10),
            perBin: rep.perBin,
            totals: rep.totals,
            pilots: pilotMetrics(),
            timing: {
                corpusRuns: runs,
                medianMsPerBin: Object.keys(rep.perBin).reduce(function (o, k) { o[k] = rep.perBin[k].medianMs; return o; }, {}),
                pilotEndToEnd: pilotTiming(pilotRuns),
                machine: require('os').cpus()[0].model + ' x' + require('os').cpus().length + ', node ' + process.version
            }
        };
        fs.writeFileSync(FIXTURE, JSON.stringify(fx, null, 1) + '\n');
        console.log('baseline written to ' + path.relative(ROOT, FIXTURE));
    }
    if (args.flags.json) { process.stdout.write(JSON.stringify(rep, null, 1) + '\n'); return; }
    printTable(rep, fx);
}

if (require.main === module) { main(); }

module.exports = { defects: defects, summarise: summarise };
