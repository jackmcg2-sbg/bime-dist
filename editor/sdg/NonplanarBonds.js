/**
 * editor/sdg/NonplanarBonds.js — native wedge/dash assignment (v1.8.17 full).
 *
 * Copyright (c) 2026 BioInception PVT LTD, Cambridge, UK and Syed Asad Rahman.
 * Licensed under the Apache License, Version 2.0 - see LICENSE.txt
 *
 * Determines which bond at each tetrahedral stereo centre to draw as a
 * wedge (up) or dash (down). Algorithm:
 *
 *   1. Find every atom marked as a stereo centre (via atom.chirality
 *      = '@' or '@@', or atom.cipLabel = 'R'/'S' set by editor/CIPStereo.js).
 *   2. For each stereo centre, score every potential wedge/dash
 *      candidate bond by:
 *        a. Whether it makes the depiction unambiguous (avoids eclipsing).
 *        b. Bond length (prefer chemically-relevant bonds).
 *        c. Ring membership (prefer non-ring bonds — drawing a wedge
 *           inside a ring is visually confusing).
 *        d. Atom valence and degree (prefer terminal bonds).
 *   3. Pick the highest-scoring candidate; assign bond.stereo =
 *      STEREO_WEDGE (1) or STEREO_DASH (6) based on which 3D
 *      direction matches the R/S configuration.
 *
 * Status (v1.8.17): FULL implementation. Replaces the v1.8.13 stub.
 *
 * Caveat: requires editor/CIPStereo.js to have run R/S perception
 * (sets atom.cipLabel) before NonplanarBonds.assign is called. If
 * cipLabel is empty but atom.chirality is set, assign() will infer
 * from the SMILES @ / @@ ordering.
 */
(function (global) {
    'use strict';

    var STEREO_NONE = 0;
    var STEREO_WEDGE = 1;
    var STEREO_DASH = 6;

    var NonplanarBonds = {};

    /**
     * assign(mol) — top-level entry. Walks every atom; for each stereo
     * centre, picks the best wedge/dash bond and sets bond.stereo.
     *
     * Returns the count of stereo bonds assigned.
     */
    NonplanarBonds.assign = function (mol) {
        if (!mol || !mol.atoms || !mol.bonds) return 0;
        var assigned = 0;
        // Build bond-by-atom lookup once.
        var bondsByAtom = {};
        for (var b = 0; b < mol.bonds.length; b++) {
            var bnd = mol.bonds[b];
            if (!bondsByAtom[bnd.atom1]) bondsByAtom[bnd.atom1] = [];
            if (!bondsByAtom[bnd.atom2]) bondsByAtom[bnd.atom2] = [];
            bondsByAtom[bnd.atom1].push(bnd);
            bondsByAtom[bnd.atom2].push(bnd);
        }
        // Build ring-atom lookup once (avoid mol.findRings on every atom).
        var ringAtomSet = NonplanarBonds._computeRingAtomSet(mol);

        // v1.8.19: only reset depictStereo (our depiction-only field)
        // before re-deriving. bond.stereo is owned by SmilesWriter (for
        // / \ E/Z markers) and by MolEditor (for MOL-imported wedge/dash);
        // we don't touch it.
        for (var b2 = 0; b2 < mol.bonds.length; b2++) {
            mol.bonds[b2].depictStereo = STEREO_NONE;
            mol.bonds[b2].depictStereoFromAtom = null;
        }

        for (var i = 0; i < mol.atoms.length; i++) {
            var atom = mol.atoms[i];
            // Skip if not a stereo centre.
            var hasCipLabel = atom.cipLabel === 'R' || atom.cipLabel === 'S';
            var hasChirality = atom.chirality === '@' || atom.chirality === '@@';
            if (!hasCipLabel && !hasChirality) continue;
            // Heuristic: only sp3 atoms can be stereo centres. Skip
            // aromatic atoms.
            if (atom.aromatic) continue;
            var ab = bondsByAtom[atom.id] || [];
            if (ab.length < 3) continue;
            // v1.8.17 perf: pass bondsByAtom to avoid O(N·M) re-scan
            // inside assignTetrahedral.
            var assignedCount = NonplanarBonds.assignTetrahedral(mol, atom, ab, ringAtomSet, bondsByAtom);
            if (assignedCount > 0) assigned += assignedCount;
        }
        return assigned;
    };

    /**
     * assignTetrahedral(mol, atom, bonds, ringAtomSet) — pick the best
     * single bond at `atom` to mark as wedge/dash so the depicted 2D
     * geometry visually conveys the R/S configuration.
     *
     * Returns the count of stereo bonds set (0 or 1).
     */
    NonplanarBonds.assignTetrahedral = function (mol, atom, bonds, ringAtomSet, bondsByAtom) {
        if (!atom || !bonds || bonds.length < 3) return 0;
        // v3.2.0: wedge sense comes from the drawn geometry and the atom's
        // @/@@ token (FR-004a). Without a token there is nothing to draw.
        if (atom.chirality !== '@' && atom.chirality !== '@@') return 0;
        var candidates = [];

        for (var i = 0; i < bonds.length; i++) {
            var b = bonds[i];
            // Only single bonds can be wedge/dash.
            if (b.type !== 1 && b.type !== undefined) continue;
            // The other end of the bond.
            var otherId = (b.atom1 === atom.id) ? b.atom2 : b.atom1;
            var other = mol.getAtom(otherId);
            if (!other) continue;
            var score = 0;
            // Prefer non-ring bonds.
            if (!ringAtomSet[atom.id] || !ringAtomSet[otherId]) score += 100;
            // Prefer bonds to terminal atoms (degree 1 — usually H or
            // explicit end groups). The clearest wedge. Use the
            // pre-computed bondsByAtom map when available (O(1)) instead
            // of an O(M) linear scan.
            var otherBonds;
            if (bondsByAtom && bondsByAtom[otherId]) {
                otherBonds = bondsByAtom[otherId].length;
            } else {
                otherBonds = 0;
                for (var ob = 0; ob < mol.bonds.length; ob++) {
                    if (mol.bonds[ob].atom1 === otherId || mol.bonds[ob].atom2 === otherId) otherBonds++;
                }
            }
            if (otherBonds === 1) score += 50;
            // Prefer hydrogens (or atoms with implicit H).
            if (other.symbol === 'H') score += 30;
            // Penalise existing-stereo bonds (don't overwrite double-bond
            // stereo on adjacent E/Z bonds).
            if (b.cipLabel === 'E' || b.cipLabel === 'Z') score -= 200;
            // Prefer the bond pointing most "outward" from the molecule
            // (away from neighbours). Compute angular distance from the
            // bond axis to the centroid of OTHER bonds at `atom`.
            var dx = other.x - atom.x, dy = other.y - atom.y;
            var bondAng = Math.atan2(dy, dx);
            var sumX = 0, sumY = 0, oc = 0;
            for (var ob2 = 0; ob2 < bonds.length; ob2++) {
                if (bonds[ob2] === b) continue;
                var oid = (bonds[ob2].atom1 === atom.id) ? bonds[ob2].atom2 : bonds[ob2].atom1;
                var oa = mol.getAtom(oid);
                if (!oa) continue;
                sumX += (oa.x - atom.x);
                sumY += (oa.y - atom.y);
                oc++;
            }
            if (oc > 0) {
                var avgAng = Math.atan2(sumY / oc, sumX / oc);
                var diff = Math.abs(bondAng - avgAng);
                while (diff > Math.PI) diff = Math.abs(diff - 2 * Math.PI);
                // Larger diff = more outward = better.
                score += (diff / Math.PI) * 40;
            }
            candidates.push({ bond: b, otherId: otherId, score: score, order: i });
        }

        // Best-scoring bond first (ties: bond order at the atom, as before).
        candidates.sort(function (p, q) { return (q.score - p.score) || (p.order - q.order); });
        var bestBond = null, stereoVal = STEREO_NONE;
        for (var c = 0; c < candidates.length && !bestBond; c++) {
            var sense = NonplanarBonds._wedgeSense(mol, atom, candidates[c].otherId);
            if (sense === null) continue;   // degenerate geometry for this bond; try the next
            bestBond = candidates[c].bond;
            stereoVal = sense;
        }
        if (!bestBond) return 0;
        // v1.8.19: write to bond.depictStereo (depiction-only field)
        // INSTEAD of bond.stereo. bond.stereo is read by SmilesWriter
        // for E/Z directional markers (/ and \) — overwriting it would
        // break SMILES round-trip on previously-stereo-free bonds.
        // ImageExport reads bond.depictStereo first, falling back to
        // bond.stereo for backward compatibility (MOL-imported wedges).
        bestBond.depictStereo = stereoVal;
        // Record the stereocentre end of the wedge (drawn as the narrow
        // point by ImageExport) so the depicter knows which way to draw it.
        // We DO NOT mutate bond.atom1 / bond.atom2
        // because that would break SmilesWriter's directional encoding.
        bestBond.depictStereoFromAtom = atom.id;
        return 1;
    };

    /**
     * _wedgeSense(mol, atom, wedgeNbId) — v3.2.0. STEREO_WEDGE or STEREO_DASH
     * for a wedge from `atom` to neighbour `wedgeNbId` such that the drawing
     * reads back as the atom's @/@@ token, or null when the 2D arrangement is
     * degenerate. The token's frame is the parser's: heavy neighbours in
     * getNeighbors() order, implicit H last (placed in-plane opposite the mean
     * neighbour direction). Coordinates are screen (y down), so y is negated.
     */
    NonplanarBonds._wedgeSense = function (mol, atom, wedgeNbId) {
        var nbs = mol.getNeighbors(atom.id) || [];
        var v = [];
        for (var i = 0; i < nbs.length; i++) {
            var a = mol.getAtom(nbs[i]);
            if (!a) return null;
            v.push([a.x - atom.x, -(a.y - atom.y), nbs[i] === wedgeNbId ? 1 : 0]);
        }
        if (v.length === 3) {
            var sx = 0, sy = 0;
            for (var k = 0; k < 3; k++) {
                var l = Math.sqrt(v[k][0] * v[k][0] + v[k][1] * v[k][1]) || 1;
                sx += v[k][0] / l; sy += v[k][1] / l;
            }
            v.push([-sx, -sy, 0]);
        }
        if (v.length !== 4) return null;
        var r = [];
        for (var j = 1; j < 4; j++) { r.push([v[j][0] - v[0][0], v[j][1] - v[0][1], v[j][2] - v[0][2]]); }
        var vol = r[0][0] * (r[1][1] * r[2][2] - r[1][2] * r[2][1]) -
                  r[0][1] * (r[1][0] * r[2][2] - r[1][2] * r[2][0]) +
                  r[0][2] * (r[1][0] * r[2][1] - r[1][1] * r[2][0]);
        if (Math.abs(vol) < 1e-6) return null;
        // A wedge (neighbour toward the viewer) with positive volume reads '@@'.
        var wedgeReads = vol > 0 ? '@@' : '@';
        return wedgeReads === atom.chirality ? STEREO_WEDGE : STEREO_DASH;
    };

    /**
     * assignAtropisomer(mol, bond) — placeholder for atropisomer
     * (axial chirality) wedge assignment on biaryls with restricted
     * rotation. Tracked for v1.9.x.
     */
    NonplanarBonds.assignAtropisomer = function (mol, bond) {
        return 0;
    };

    /**
     * _computeRingAtomSet(mol) — build {atomId: true} for atoms in any
     * ring up to size 16 (covers all common rings + small macrocycles).
     */
    NonplanarBonds._computeRingAtomSet = function (mol) {
        var set = {};
        if (!mol || !mol.findRings) return set;
        try {
            var rings = mol.findRings(16);
            for (var i = 0; i < rings.length; i++) {
                var ra = rings[i].atoms || rings[i];
                for (var j = 0; j < ra.length; j++) set[ra[j]] = true;
            }
        } catch (e) { /* no-op on findRings failures */ }
        return set;
    };

    global.SDG = global.SDG || {};
    global.SDG.NonplanarBonds = NonplanarBonds;
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = NonplanarBonds;
    }
})(typeof globalThis !== 'undefined' ? globalThis :
   typeof window !== 'undefined' ? window : this);
