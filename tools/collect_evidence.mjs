import {execFileSync} from 'node:child_process';
import {readFile,writeFile,readdir,stat,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
const root=resolve('.'),out='results/generated';await mkdir(out,{recursive:true});
const clean=s=>s.replaceAll(root,'.').replaceAll(/\/opt\/homebrew\/[^\s]+/g,'[toolchain]');
function run(command,args){return clean(execFileSync(command,args,{encoding:'utf8',maxBuffer:16*1024*1024}));}
await writeFile(out+'/core_tests.log',new Date().toISOString()+'\n'+run('build/mac/core_tests',[]));
await writeFile(out+'/sanitizer_tests.log',new Date().toISOString()+'\n'+run('build/sanitized/core_tests',[]));
const imports=run('x86_64-w64-mingw32-objdump',['-p','build/windows/Launch.exe']).split('\n').filter(l=>l.includes('DLL Name:'));
await writeFile(out+'/windows_imports.log','Windows PE32+ x64 build; runtime not executed\n'+imports.join('\n')+'\n');
const metadata={timestamp:new Date().toISOString(),cpu:'Apple M5',physical_cores:10,logical_cpus:10,ram_bytes:17179869184,os:run('sw_vers',[]).trim(),compiler:run('clang++',['--version']).split('\n')[0],flags:'CMake Release: -O3 -DNDEBUG -std=c++17',benchmark_cases:2000,elements_per_case:5000,windows_runtime_verified:false};
await writeFile(out+'/environment.json',JSON.stringify(metadata,null,2));
const files=(await readdir('results/screenshots')).filter(f=>f.endsWith('.png'));
const shots=[];for(const f of files){const s=await stat('results/screenshots/'+f);shots.push({file:f,captured_utc:s.mtime.toISOString()});}
await writeFile('results/screenshots/manifest.json',JSON.stringify(shots,null,2));
const descriptions={'geometry.png':'Self-created ASCII STL: four triangles loaded. Rotate/pan/zoom/fit controls are available.','temperature-cloud.png':'Synthetic temperature nodes, units and legend; clicked node 8 inspected at 185 C.','thermal.png':'Required four-mesh thermal study and analytical comparison; factor-four error reduction.','performance.png':'Actual browser benchmark (1000 cases x 500 elements); full report uses separately recorded 2000 x 5000 workload.','backpropagation.png':'Explicit gradients, central-difference agreement and 101 updates displayed.','hardware-timeout.png':'Simulated microcontroller timeout leaves backend and UI disconnected.','hardware-recovery.png':'Reconnect restores simulated device state and telemetry.'};
descriptions['geometry-enhanced.png']='Version 1.1 C++ mesh summary, surface area/bounds, camera presets and wireframe view.';
descriptions['thermal-enhanced.png']='Version 1.1 mesh comparison, outward heat flows, energy balance, flux and richer exports.';
descriptions['benchmark-cancellation.png']='Active benchmark cancelled safely. Partial results were discarded and the earlier completed result table remained available.';
const body=shots.map(s=>`<section><h2>${s.file}</h2><p>Captured ${s.captured_utc} UTC on Mac. ${descriptions[s.file]||''}</p><img src="screenshots/${s.file}" alt="${s.file}"></section>`).join('\n');
await writeFile('results/WALKTHROUGH.html',`<!doctype html><html lang="en"><meta charset="utf-8"><title>Workbench demonstration evidence</title><style>body{font:16px system-ui;max-width:1050px;margin:40px auto;color:#19364d}img{max-width:100%;border:1px solid #ccd7e0}section{margin:40px 0}p{line-height:1.6}</style><h1>Engineering Workbench: timestamped walkthrough</h1><p>Actual Mac browser captures, accompanied by core/integration logs and raw numerical CSVs in generated/. This is the screenshot-walkthrough alternative to a demo video. Windows x64 builds but actual Windows launch has not been verified. The browser CSV export was exercised; downloads require normal browser support.</p>${body}</html>`);
console.log('Saved test logs, Windows imports, environment and timestamped screenshot walkthrough.');
