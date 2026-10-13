/**
 * editor/sdg/CorrectGeometricConfiguration.js — native stereo geometry correction.
 *
 * Copyright (c) 2026 BioInception PVT LTD, Cambridge, UK and Syed Asad Rahman.
 * Licensed under the Apache License, Version 2.0 - see LICENSE.txt
 *
 * For each E/Z (cis/trans) double bond, checks whether the depicted 2D
 * coordinates match the chemical configuration encoded in
 * bond.cipLabel (set by editor/CIPStereo.js). If the depicted
 * configuration is inverted, reflects the smaller-half substituents
 * across the double-bond axis.
 *
 * Status (v1.8.17): FULL implementation. Replaces the v1.8.13 stub.
 */
(function (global) {
    'use strict';

    var EPS = 1e-9;

    var CorrectGeometricConfiguration = {};

    /**
     * correct(mol) — top-level entry. Returns the count of corrections
     * applied (number of double bonds reflected).
     */
    CorrectGeometricConfiguration.correct = function (mol) {
        if (!mol || !mol.atoms || !mol.bonds) return 0;
        var corrected = 0;
        for (var b = 0; b < mol.bonds.length; b++) {
            var bnd = mol.bonds[b];
            if (bnd.type !== 2) continue;
            if (bnd.cipLabel !== 'E' && bnd.cipLabel !== 'Z') continue;
            if (CorrectGeometricConfiguration._correctOne(mol, bnd)) corrected++;
        }
        return corrected;
    };

    /**
     * _correctOne(mol, bond) — correct one E/Z double bond.
     */
    CorrectGeometricConfiguration._correctOne = function (mol, bond) {
        var a1 = mol.getAtom(bond.atom1);
        var a2 = mol.getAtom(bond.atom2);
        if (!a1 || !a2) return false;

        // v3.2.0: a two-substituent end whose substituents are not fanned
        // either side of the double bond (both on one side, or one nearly in
        // line with it) has no drawable cis/trans. Restore a 120° fan first.
        var normalised = CorrectGeometricConfiguration._normaliseEnd(mol, a1.id, a2.id);
        normalised = CorrectGeometricConfiguration._normaliseEnd(mol, a2.id, a1.id) || normalised;

        // Find the priority-1 substituent on each side.
        var sub1 = CorrectGeometricConfiguration._priorityNeighbour(mol, a1.id, a2.id);
        var sub2 = CorrectGeometricConfiguration._priorityNeighbour(mol, a2.id, a1.id);
        if (!sub1 || !sub2) return false;
        var s1 = mol.getAtom(sub1);
        var s2 = mol.getAtom(sub2);
        if (!s1 || !s2) return false;

        // Bond axis direction.
        var bdx = a2.x - a1.x, bdy = a2.y - a1.y;
        var blen = Math.hypot(bdx, bdy);
        if (blen < EPS) return false;
        var nx = -bdy / blen, ny = bdx / blen;  // perpendicular

        // Side of axis (sign of perpendicular projection).
        var s1Side = (s1.x - a1.x) * nx + (s1.y - a1.y) * ny;
        var s2Side = (s2.x - a2.x) * nx + (s2.y - a2.y) * ny;

        // Same sign → cis (Z); opposite → trans (E).
        var measuredZ = (s1Side * s2Side > 0);
        var wantsZ = bond.cipLabel === 'Z';
        if (measuredZ === wantsZ) return normalised;  // already correct

        // Need to flip ONE side. Pick the smaller-subtree side.
        // v3.2.0: reflect the WHOLE smaller end — every substituent of the pivot
        // atom and their subtrees. Reflecting only the top-priority branch left a
        // two-substituent end with both groups on one side of the double bond
        // (e.g. C/C(=C/CC)CO). When the two ends stay connected (the double
        // bond is in a ring) there is no separate end to reflect; keep the
        // pre-3.2 top-priority-branch reflection there.
        var end1 = CorrectGeometricConfiguration._collectEnd(mol, a1.id, a2.id);
        var end2 = CorrectGeometricConfiguration._collectEnd(mol, a2.id, a1.id);
        if (!end1 || !end2) {
            end1 = CorrectGeometricConfiguration._collectSubtree(mol, sub1, a1.id);
            end2 = CorrectGeometricConfiguration._collectSubtree(mol, sub2, a2.id);
        }
        var flipSide, pivotAtom;
        if (end1.length <= end2.length) {
            flipSide = end1; pivotAtom = a1;
        } else {
            flipSide = end2; pivotAtom = a2;
        }

        // Reflect each atom across the line through the bond axis.
        var dx = bdx / blen, dy = bdy / blen;
        for (var i = 0; i < flipSide.length; i++) {
            var pa = mol.getAtom(flipSide[i]);
            if (!pa) continue;
            var px = pa.x - pivotAtom.x, py = pa.y - pivotAtom.y;
            var t = px * dx + py * dy;
            var prx = pivotAtom.x + t * dx;
            var pry = pivotAtom.y + t * dy;
            pa.x = 2 * prx - pa.x;
            pa.y = 2 * pry - pa.y;
        }
        return true;
    };

    /**
     * _priorityNeighbour(mol, atomId, excludeId) — highest-CIP-priority
     * neighbour. v1.8.19: prefers full CIP priorities from
     * editor/CIPStereo.js (depth-N digraph traversal with rules 1a-4a),
     * falling back to atomic-number-only proxy if CIPStereo isn't loaded.
     *
     * The CIPStereo path correctly resolves degenerate first-sphere
     * cases (e.g., two C-substituents on the same sp² carbon where
     * priority depends on the second sphere).
     */
    CorrectGeometricConfiguration._priorityNeighbour = function (mol, atomId, excludeId) {
        // Try full CIP first.
        try {
            var glob = (typeof globalThis !== 'undefined') ? globalThis :
                       (typeof window !== 'undefined') ? window : null;
            if (glob && glob.CIPStereo && glob.CIPStereo.cipPriorities) {
                var entries = glob.CIPStereo.cipPriorities(mol, atomId);
                if (entries && entries.length > 0) {
                    // entries are sorted high-to-low priority. Find the
                    // first non-phantom, non-excluded neighbour.
                    for (var ei = 0; ei < entries.length; ei++) {
                        var e = entries[ei];
                        if (e.neighborId === excludeId) continue;
                        if (e.neighborId < 0) continue;  // phantom H
                        return e.neighborId;
                    }
                }
            }
        } catch (cipE) { /* fall through to proxy */ }

        // Fall-back: atomic number proxy.
        var nbrs = mol.getNeighbors(atomId) || [];
        var best = null, bestPri = -1;
        var ATOMIC_NUMBERS = {
            H: 1, B: 5, C: 6, N: 7, O: 8, F: 9, P: 15, S: 16,
            Cl: 17, Br: 35, I: 53
        };
        for (var i = 0; i < nbrs.length; i++) {
            if (nbrs[i] === excludeId) continue;
            var na = mol.getAtom(nbrs[i]);
            if (!na) continue;
            var pri = ATOMIC_NUMBERS[na.symbol] || 0;
            if (pri > bestPri || best === null) {
                best = nbrs[i];
                bestPri = pri;
            }
        }
        return best;
    };

    /**
     * _collectSubtree(mol, startId, blockedId) — BFS reachability set.
     */
    CorrectGeometricConfiguration._collectSubtree = function (mol, startId, blockedId) {
        var visited = {};
        var queue = [startId];
        var result = [];
        visited[blockedId] = true;
        visited[startId] = true;
        while (queue.length > 0) {
            var cur = queue.shift();
            result.push(cur);
            var nbrs = mol.getNeighbors(cur) || [];
            for (var i = 0; i < nbrs.length; i++) {
                if (visited[nbrs[i]]) continue;
                visited[nbrs[i]] = true;
                queue.push(nbrs[i]);
            }
        }
        return result;
    };

    /**
     * _normaliseEnd(mol, endId, partnerId) — v3.2.0. If `endId` has exactly two
     * substituents (besides the double-bond partner) that are not fanned either
     * side of the double bond — both on one side, or one within 30° of the bond
     * line — rotate them rigidly about `endId` into an ideal 120° fan:
     * the substituent with the larger subtree keeps its direction; the partner
     * end and the other substituent are rotated to ±120° from it, keeping the
     * partner end as close as possible to where it was. When the double bond
     * or the end is in a ring, only a single exocyclic substituent is moved
     * (to the open side); otherwise the end is left as placed. Returns true if
     * anything moved.
     */
    CorrectGeometricConfiguration._normaliseEnd = function (mol, endId, partnerId) {
        var E = mol.getAtom(endId), P = mol.getAtom(partnerId);
        if (!E || !P) return false;
        var subs = (mol.getNeighbors(endId) || []).filter(function (x) { return x !== partnerId; });
        if (subs.length !== 2) return false;
        var A = mol.getAtom(subs[0]), B = mol.getAtom(subs[1]);
        if (!A || !B) return false;
        function ang(a) { return Math.atan2(a.y - E.y, a.x - E.x); }
        function norm(t) { while (t <= -Math.PI) t += 2 * Math.PI; while (t > Math.PI) t -= 2 * Math.PI; return t; }
        var aP = ang(P), dA = norm(ang(A) - aP), dB = norm(ang(B) - aP);
        var LIM = Math.PI / 6;   // 30°
        var fanned = (dA > 0) !== (dB > 0) &&
                     Math.abs(dA) > LIM && Math.abs(dA) < Math.PI - LIM &&
                     Math.abs(dB) > LIM && Math.abs(dB) < Math.PI - LIM;
        if (fanned) return false;
        var partnerEnd = CorrectGeometricConfiguration._collectEnd(mol, partnerId, endId);
        var subA = CorrectGeometricConfiguration._collectSubtree(mol, subs[0], endId);
        var subB = CorrectGeometricConfiguration._collectSubtree(mol, subs[1], endId);
        function has(list, id) { return list.indexOf(id) !== -1; }
        function rotate(ids, by) {
            var c = Math.cos(by), s = Math.sin(by);
            for (var i = 0; i < ids.length; i++) {
                var a = mol.getAtom(ids[i]); if (!a) continue;
                var x = a.x - E.x, y = a.y - E.y;
                a.x = E.x + c * x - s * y; a.y = E.y + s * x + c * y;
            }
        }
        var ringA = has(subA, partnerId) || has(subA, subs[1]);
        var ringB = has(subB, partnerId) || has(subB, subs[0]);
        if (!partnerEnd || ringA || ringB) {
            // v3.2.0 (T017a): the double bond or this end lies in a ring, so the
            // ring neighbours stay put. If exactly one substituent is exocyclic
            // (its subtree reaches neither the partner nor the other
            // substituent), swing it rigidly to the open side: opposite the
            // sum of the partner and ring-neighbour directions.
            if (ringA === ringB) return false;
            var exo = ringA ? B : A, exoTree = ringA ? subB : subA, ringNb = ringA ? A : B;
            var ux = (P.x - E.x), uy = (P.y - E.y), lp = Math.hypot(ux, uy);
            var vx = (ringNb.x - E.x), vy = (ringNb.y - E.y), lr = Math.hypot(vx, vy);
            if (lp < EPS || lr < EPS) return false;
            var sx = ux / lp + vx / lr, sy = uy / lp + vy / lr;
            if (Math.hypot(sx, sy) < 1e-6) return false;         // partner and ring neighbour collinear
            rotate(exoTree, norm(Math.atan2(-sy, -sx) - ang(exo)));
            return true;
        }
        var big = subA.length >= subB.length ? A : B;
        var small = big === A ? B : A;
        var smallTree = big === A ? subB : subA;
        var aBig = ang(big);
        var cand = [aBig + 2 * Math.PI / 3, aBig - 2 * Math.PI / 3];
        var pTarget = Math.abs(norm(cand[0] - aP)) <= Math.abs(norm(cand[1] - aP)) ? cand[0] : cand[1];
        var sTarget = pTarget === cand[0] ? cand[1] : cand[0];
        rotate([partnerId].concat(partnerEnd), norm(pTarget - aP));
        rotate(smallTree, norm(sTarget - ang(small)));
        return true;
    };

    /**
     * _collectEnd(mol, endId, partnerId) — every atom reachable from `endId`
     * without crossing to `partnerId`, excluding `endId` itself: the substituents
     * of one end of a double bond and their subtrees. Returns null when the
     * partner is reachable (the double bond is in a ring).
     */
    CorrectGeometricConfiguration._collectEnd = function (mol, endId, partnerId) {
        var visited = {};
        visited[endId] = true;
        visited[partnerId] = true;
        var queue = [], result = [];
        var start = mol.getNeighbors(endId) || [];
        for (var s = 0; s < start.length; s++) {
            if (start[s] === partnerId) continue;
            visited[start[s]] = true;
            queue.push(start[s]);
        }
        while (queue.length > 0) {
            var cur = queue.shift();
            result.push(cur);
            var nbrs = mol.getNeighbors(cur) || [];
            for (var i = 0; i < nbrs.length; i++) {
                if (nbrs[i] === partnerId && cur !== endId) return null;   // ring
                if (visited[nbrs[i]]) continue;
                visited[nbrs[i]] = true;
                queue.push(nbrs[i]);
            }
        }
        return result;
    };

    global.SDG = global.SDG || {};
    global.SDG.CorrectGeometricConfiguration = CorrectGeometricConfiguration;
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = CorrectGeometricConfiguration;
    }
})(typeof globalThis !== 'undefined' ? globalThis :
   typeof window !== 'undefined' ? window : this);
