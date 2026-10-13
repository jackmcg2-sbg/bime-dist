#!/bin/bash
# T021 measurement chain (sequential, so runs do not compete for CPU).
set -u
R=$(dirname "$0"); cd "$(git rev-parse --show-toplevel)"
echo "== load $(uptime | sed 's/.*load/load/')" > $R/t021.txt
node tools/layout-bench.js --runs 3 --json > $R/bench_final.json
node -e '
const cp=require("child_process");const P=require("./tests/data/reaction_map_pilot.json").reactions;const B=require("./tests/data/layout_corpus.json").baseline.timing.pilotEndToEnd;
for(const p of P){const t=[];for(let i=0;i<5;i++){const s=Date.now();cp.execFileSync(process.execPath,["tools/bime-cli.js","aam",p.smiles,"--format","svg","--no-stamp"],{maxBuffer:1<<26});t.push(Date.now()-s);}t.sort((a,b)=>a-b);
console.log("pilot",p.id,"median",t[2],"ms baseline",B[p.id].medianMs,"ratio",(t[2]/B[p.id].medianMs).toFixed(2));}' >> $R/t021.txt
s=$(date +%s); node tests/test_v3_2_0_layout_quality.js > $R/ns.log 2>&1; echo "NS exit=$? secs=$(( $(date +%s)-s ))" >> $R/t021.txt
s=$(date +%s); node tools/run-tests.js > $R/suite.log 2>&1; echo "suite exit=$? secs=$(( $(date +%s)-s )) $(tail -1 $R/suite.log)" >> $R/t021.txt
for c in "" aam clean export parse version; do echo "== bime help $c"; node tools/bime-cli.js help $c; done > $R/bime_help_after.txt 2>&1
if diff -q specs/002-reaction-layout-overlaps/agent-runs/20261008T1615Z-setup-baseline/bime_help.txt $R/bime_help_after.txt >/dev/null; then echo "help output: identical" >> $R/t021.txt; else echo "help output: DIFFERS" >> $R/t021.txt; fi
echo "== load $(uptime | sed 's/.*load/load/')" >> $R/t021.txt
echo done >> $R/t021.txt
