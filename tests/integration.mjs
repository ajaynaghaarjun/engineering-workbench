import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
const base=process.env.WORKBENCH_URL||'http://127.0.0.1:8765';
const log=[];const check=(name,fn)=>Promise.resolve().then(fn).then(()=>{log.push('PASS '+name);});
async function api(path,body=''){const r=await fetch(base+'/api/'+path,{method:'POST',body});return {status:r.status,data:await r.json()};}
await check('backend health',async()=>assert.equal((await fetch(base+'/api/health').then(r=>r.json())).backend,'C++17'));
await check('thermal numerical study',async()=>{const {data}=await api('study');assert.equal(data.runs.length,4);for(const r of data.runs){assert.ok(Math.abs(r.midpoint_error_C-125/r.elements**2)<1e-8);assert.equal(r.nodes[0][1],100);assert.equal(r.nodes.at(-1)[1],20);}});
await check('custom rod and export payload',async()=>{const {status,data}=await api('thermal','2 0.0001 10 0 -20 80 20');assert.equal(status,200);assert.ok(Math.abs(data.nodes[10][1]-30)<1e-9);});
await check('reject invalid thermal parameter',async()=>assert.equal((await api('thermal','1 0.0001 0 10000 100 20 20')).status,400));
await check('bundled STL import',async()=>{const text=await readFile('data/sample.stl','utf8');assert.equal((await api('stl',text)).data.vertices.length,12);});
await check('bundled CSV import',async()=>{const text=await readFile('data/temperatures.csv','utf8');assert.equal((await api('csv',text)).data.nodes.length,10);});
await check('reject empty and malformed imports',async()=>{for(const path of ['stl','csv'])assert.equal((await api(path,'')).status,400);assert.equal((await api('csv','node_id,x_m,y_m,z_m,temperature_C\n1,0,0,0,NaN')).status,400);});
await check('parallel agreement and raw repetitions',async()=>{const {data}=await api('benchmark','100 100');for(const r of data.rows){assert.ok(r.max_difference_C<=1e-8);assert.equal(r.samples_s.length,5);}});
await check('all three mock adapters and timeout recovery',async()=>{for(const device of ['microcontroller','fpga','jtag']){assert.equal((await api('hardware',device+' connect')).data.connected,true);assert.equal((await api('hardware',device+' telemetry')).data.telemetry.temperature_C,32.5);assert.equal((await api('hardware',device+' timeout')).data.connected,false);assert.equal((await api('hardware',device+' telemetry')).status,400);assert.equal((await api('hardware',device+' connect')).data.connected,true);assert.equal((await api('hardware',device+' disconnect')).data.connected,false);}});
await check('backpropagation gradient and loss verification',async()=>{const {data}=await api('backprop');assert.ok(data.max_gradient_error<=1e-5);assert.equal(data.loss_after_updates.length,101);assert.ok(data.loss_after_updates.at(-1)<1e-12);});
await check('path traversal rejected',async()=>assert.equal((await fetch(base+'/%2e%2e/CMakeLists.txt')).status,400));
await check('cross-origin API request rejected',async()=>assert.equal((await fetch(base+'/api/thermal',{method:'POST',headers:{Origin:'https://example.com'},body:''})).status,400));
await mkdir('results/generated',{recursive:true});const output=new Date().toISOString()+'\n'+log.join('\n')+'\n';await writeFile('results/generated/integration.log',output);console.log(output);
