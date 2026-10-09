/**
 * tests/shim.js — Minimal Node.js compatibility shim for BIME editor modules
 *
 * Editor modules use a `(function(global) { ... })(window)` IIFE pattern that
 * attaches to `window`. This shim aliases `window = globalThis` and provides
 * just enough of `document`/`fetch` so accidental DOM/network usage in code
 * paths exercised by tests fails fast instead of silently swallowing errors.
 *
 * Modules are loaded in bundle order: tools/editor-files.js ENGINE_FILES, i.e.
 * every editor module except the UI-only ones (ADR-0001).
 */
'use strict';

if (typeof globalThis.window === 'undefined') globalThis.window = globalThis;

if (typeof globalThis.document === 'undefined') {
    var stubElement = function() {
        return {
            setAttribute: function() {},
            getAttribute: function() { return null; },
            appendChild: function() {},
            removeChild: function() {},
            remove: function() {},
            style: {},
            textContent: '',
            innerHTML: '',
            children: [],
            classList: { add: function() {}, remove: function() {}, contains: function() { return false; } },
            getComputedTextLength: function() { return 0; },
            getBoundingClientRect: function() { return { x: 0, y: 0, width: 0, height: 0 }; }
        };
    };
    globalThis.document = {
        createElement: stubElement,
        createElementNS: stubElement,
        body: { appendChild: function() {}, removeChild: function() {} },
        documentElement: stubElement(),
        head: stubElement()
    };
}

if (typeof globalThis.fetch === 'undefined') {
    globalThis.fetch = function() {
        throw new Error('fetch not allowed in tests');
    };
}

var path = require('path');

function require_editor(name) {
    return require(path.join(__dirname, '..', 'editor', name + '.js'));
}

// Load editor modules once per process. Returns the populated globalThis so
// tests can pull Molecule, SmilesParser, ... off it.
var loaded = false;
function loadAll() {
    if (loaded) return globalThis;
    // Pre-bundled binaries (bun --compile) load the editor statically before
    // calling in, so the engine is already on globalThis. Skip the
    // filesystem-relative dynamic requires below, which a static bundler
    // cannot follow. Under Node/pkg the engine is not yet present, so this
    // is a no-op on first call and the normal load path runs.
    if (globalThis.Molecule && globalThis.SmilesParser) { loaded = true; return globalThis; }
    // v3.2.0 (ADR-0001): load the browser's engine — every non-UI module of
    // the bundle, in bundle order — so tests and the CLI run the same layout
    // as the browser. (Before 3.2.0 this was a hand-written subset that lacked
    // Templates, SMSDLayout, SDGLayout and editor/sdg/*.)
    var ENGINE_FILES = require(path.join(__dirname, '..', 'tools', 'editor-files.js')).ENGINE_FILES;
    for (var i = 0; i < ENGINE_FILES.length; i++) {
        require(path.join(__dirname, '..', 'editor', ENGINE_FILES[i]));
    }
    loaded = true;
    return globalThis;
}

// Tiny test runner used by every tests/test_*.js file.
function makeRunner(label) {
    var passed = 0, failed = 0;
    var failures = [];
    var results = [];

    function test(name, fn) {
        try {
            fn();
            passed++;
            results.push({ name: name, pass: true });
            console.log('  ✓ ' + name);
        } catch (e) {
            failed++;
            var reason = (e && e.message) ? e.message : String(e);
            failures.push({ name: name, reason: reason, stack: e && e.stack });
            results.push({ name: name, pass: false, reason: reason });
            console.log('  ✗ ' + name + ' (' + reason + ')');
        }
    }

    function summary() {
        return { label: label, passed: passed, failed: failed, failures: failures, results: results };
    }

    return { test: test, summary: summary };
}

module.exports = {
    require_editor: require_editor,
    loadAll: loadAll,
    makeRunner: makeRunner
};
