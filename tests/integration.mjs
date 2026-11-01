import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createConnection} from 'node:net';
const base=process.env.WORKBENCH_URL||'http://127.0.0.1:8765';
const log=[];const check=(name,fn)=>Promise.resolve().then(fn).then(()=>{log.push('PASS '+name);});
async function rawRequest(headers,method='POST',version='HTTP/1.1'){
  const url=new URL(base);return await new Promise((resolve,reject)=>{
    const socket=createConnection({host:url.hostname,port:Number(url.port)});let response='';
    socket.setTimeout(3000,()=>{socket.destroy();reject(Error('Raw HTTP test timed out'));});
    socket.on('error',reject);socket.on('data',chunk=>response+=chunk);socket.on('end',()=>resolve(response));
    socket.on('connect',()=>socket.end(`${method} /api/health ${version}\r\nHost: ${url.host}\r\n${headers}\r\n\r\n`));
  });
}
async function api(path,body=''){const r=await fetch(base+'/api/'+path,{method:'POST',body});return {status:r.status,data:await r.json()};}
await check('backend health',async()=>assert.equal((await fetch(base+'/api/health').then(r=>r.json())).backend,'C++17'));
await check('thermal numerical study',async()=>{const {data}=await api('study');assert.equal(data.runs.length,4);for(const r of data.runs){assert.ok(Math.abs(r.midpoint_error_C-125/r.elements**2)<1e-8);assert.equal(r.nodes[0][1],100);assert.equal(r.nodes.at(-1)[1],20);}});
await check('custom rod and export payload',async()=>{const {status,data}=await api('thermal','2 0.0001 10 0 -20 80 20');assert.equal(status,200);assert.ok(Math.abs(data.nodes[10][1]-30)<1e-9);});
await check('reject invalid thermal parameter',async()=>assert.equal((await api('thermal','1 0.0001 0 10000 100 20 20')).status,400));
await check('bundled STL import',async()=>{const text=await readFile('data/sample.stl','utf8');const d=(await api('stl',text)).data;assert.equal(d.vertices.length,12);assert.equal(d.summary.triangles,4);assert.ok(Math.abs(d.summary.surface_area_source_units2-(1.5+Math.sqrt(3)/2))<1e-12);assert.deepEqual(d.summary.bounds_max,[1,1,1]);});
await check('bundled CSV import',async()=>{const text=await readFile('data/temperatures.csv','utf8');const d=(await api('csv',text)).data;assert.equal(d.nodes.length,10);assert.equal(d.summary.min_temperature_C,20);assert.equal(d.summary.max_temperature_C,185);});
await check('reject empty and malformed imports',async()=>{for(const path of ['stl','csv'])assert.equal((await api(path,'')).status,400);assert.equal((await api('csv','node_id,x_m,y_m,z_m,temperature_C\n1,0,0,0,NaN')).status,400);const invalid=await api('csv','node_id,x_m,y_m,z_m,temperature_C\n1,0,0,0,not-a-number');assert.equal(invalid.status,400);assert.match(invalid.data.error,/CSV line 2: Expected a numeric/);});
await check('parallel agreement and raw repetitions',async()=>{const {data}=await api('benchmark','100 100');for(const r of data.rows){assert.ok(r.max_difference_C<=1e-8);assert.equal(r.samples_s.length,5);}});
await check('all three mock adapters and timeout recovery',async()=>{for(const device of ['microcontroller','fpga','jtag']){assert.equal((await api('hardware',device+' connect')).data.connected,true);const t=(await api('hardware',device+' telemetry')).data.telemetry;if(device==='microcontroller')assert.equal(t.temperature_C,32.5);else if(device==='fpga')assert.ok(t.logic_cycles>0);else assert.equal(t.target_reference_V,3.3);assert.equal((await api('hardware',device+' timeout')).data.connected,false);assert.equal((await api('hardware',device+' telemetry')).status,400);assert.equal((await api('hardware',device+' connect')).data.connected,true);assert.equal((await api('hardware',device+' disconnect')).data.connected,false);}});
await check('backpropagation gradient and loss verification',async()=>{const {data}=await api('backprop');assert.ok(data.max_gradient_error<=1e-5);assert.equal(data.loss_after_updates.length,101);assert.ok(data.loss_after_updates.at(-1)<1e-12);});
await check('path traversal rejected',async()=>assert.equal((await fetch(base+'/%2e%2e/CMakeLists.txt')).status,400));
await check('cross-origin API request rejected',async()=>assert.equal((await fetch(base+'/api/thermal',{method:'POST',headers:{Origin:'https://example.com'},body:''})).status,400));
await check('thermal heat flux and energy conservation',async()=>{const {data}=await api('thermal');assert.equal(data.flux.length,20);assert.equal(data.parameters.length_m,1);for(const [x,flux,flow] of data.flux){assert.ok(Math.abs(flux-(-4200+10000*x))<1e-7);assert.ok(Math.abs(flow-flux*1e-4)<1e-10);}assert.ok(data.diagnostics.energy_imbalance_W<1e-9);assert.ok(data.diagnostics.max_residual_W<1e-9);assert.ok(Math.abs(data.diagnostics.left_outflow_W-.42)<1e-9);assert.ok(Math.abs(data.diagnostics.right_outflow_W-.58)<1e-9);});
await check('custom-parameter convergence study',async()=>{const {data}=await api('custom-study','2 0.002 15 2000 30 80 20');assert.equal(data.runs.length,4);for(const r of data.runs){assert.equal(r.nodes[0][1],30);assert.equal(r.nodes.at(-1)[1],80);assert.ok(Math.abs(r.midpoint_error_C-2000/(8*15)*(2/r.elements)**2)<1e-8);assert.ok(r.diagnostics.energy_imbalance_W<1e-8);}});
await check('live progress, responsive health, safe cancellation and restart',async()=>{
  const running=api('benchmark','2000 5000');let state;
  for(let i=0;i<100;i++){state=(await api('progress')).data;if(state.running)break;await new Promise(r=>setTimeout(r,10));}
  assert.equal(state.running,true);assert.ok(state.total>0);assert.ok(state.completed<=state.total);
  assert.equal((await fetch(base+'/api/health')).status,200);
  assert.equal((await api('cancel')).data.requested,true);
  const cancelled=await running;assert.equal(cancelled.status,400);assert.match(cancelled.data.error,/cancelled safely/);assert.equal(cancelled.data.rows,undefined);
  assert.equal((await api('progress')).data.running,false);
  assert.equal((await api('benchmark','20 40')).status,200);
});
await check('C++ probe interpolation, flux and range validation',async()=>{const {data}=await api('probe','.525 1 .0001 10 10000 100 20 20');assert.ok(Math.abs(data.absolute_error_C-.3125)<1e-9);assert.ok(Math.abs(data.heat_flux_W_m2-1050)<1e-7);assert.equal((await api('probe','1.1 1 .0001 10 10000 100 20 20')).status,400);assert.equal((await api('probe','1 1 .0001 10 10000 100 20 20')).data.FEA_C,20);});
await check('C++ discovery exposes distinct device capabilities',async()=>{const {data}=await api('devices');assert.equal(data.devices.length,3);assert.equal(data.simulated,true);assert.ok(data.devices.find(d=>d.device==='fpga').capabilities.includes('logic_counter'));assert.ok(data.devices.find(d=>d.device==='jtag').capabilities.includes('debug_status'));});
await check('telemetry sequence survives disconnect and reconnect',async()=>{await api('hardware','microcontroller connect');const a=(await api('hardware','microcontroller telemetry')).data.telemetry;await api('hardware','microcontroller disconnect');await api('hardware','microcontroller connect');const b=(await api('hardware','microcontroller telemetry')).data.telemetry;assert.equal(b.sequence,a.sequence+1);await api('hardware','microcontroller disconnect');});
await check('concurrent telemetry retains unique ordered sequence numbers',async()=>{await api('hardware','fpga connect');const samples=await Promise.all(Array.from({length:8},()=>api('hardware','fpga telemetry')));const ids=samples.map(s=>s.data.telemetry.sequence);assert.equal(new Set(ids).size,8);assert.equal(Math.max(...ids)-Math.min(...ids),7);await api('hardware','fpga disconnect');});
await check('hardware history is bounded, timestamped and ordered',async()=>{for(let i=0;i<105;i++)await api('hardware','jtag inspect');const {data}=await api('hardware-events');assert.equal(data.events.length,100);assert.equal(data.capacity,100);for(let i=0;i<data.events.length;i++){assert.ok(Number.isInteger(data.events[i].epoch_ms));if(i)assert.ok(data.events[i].sequence>data.events[i-1].sequence);}assert.equal((await api('hardware','jtag connect extra')).status,400);});
await check('runtime verification returns measured named checks and explicit scope',async()=>{const {data,status}=await api('verify');assert.equal(status,200);assert.equal(data.checks.length,10);assert.equal(data.all_passed,true);assert.ok(data.checks.every(c=>c.passed&&c.error<=c.tolerance));assert.match(data.scope,/does not certify/);assert.ok(['macos','windows','linux','other'].includes(data.platform));});
await check('rubric and acceptance evidence routes are bundled and whitelisted',async()=>{for(const path of ['/evidence.js','/docs/RUBRIC_REVIEW.md','/docs/WINDOWS_ACCEPTANCE.md','/docs/DEFENCE_GUIDE.md']){const response=await fetch(base+path);assert.equal(response.status,200);assert.ok((await response.text()).length>100);}const pdf=await fetch(base+'/docs/Report.pdf');assert.equal(pdf.status,200);assert.equal(pdf.headers.get('content-type'),'application/pdf');assert.equal((await pdf.arrayBuffer()).byteLength>1000,true);});
await check('malformed HTTP lengths, duplicate headers and unsupported methods fail safely',async()=>{for(const headers of ['Content-Length: 2junk','Content-Length: -1','Content-Length: 0\r\nContent-Length: 1','Transfer-Encoding: chunked','Host: duplicate\r\nContent-Length: 0'])assert.match(await rawRequest(headers),/^HTTP\/1.1 400/);assert.match(await rawRequest('Content-Length: 0','DELETE'),/^HTTP\/1.1 400/);assert.match(await rawRequest('Content-Length: 0','POST','INVALID'),/^HTTP\/1.1 400/);});
await check('accuracy-driven mesh selection measures achieved error and preserves parameters',async()=>{
  const {status,data}=await api('accuracy','1 1 .0001 10 10000 100 20 20');
  assert.equal(status,200);assert.equal(data.run.elements,12);assert.equal(data.target_met,true);
  assert.ok(data.run.midpoint_error_C<=1);assert.ok(125/11**2>1);
  assert.ok(Math.abs(data.predicted_error_C-data.run.midpoint_error_C)<1e-8);
  const cooling=(await api('accuracy','.1 1 .0001 10 -10000 20 20 20')).data;
  assert.equal(cooling.run.elements,36);assert.equal(cooling.target_met,true);assert.equal(cooling.run.parameters.heat_generation_W_m3,-10000);
  const linear=(await api('accuracy','.1 2 .0001 10 0 -20 80 20')).data;
  assert.equal(linear.run.elements,2);assert.equal(linear.predicted_error_C,0);assert.equal(linear.target_met,true);
  assert.equal((await fetch(base+'/accuracy.js')).status,200);
});
await check('accuracy selection rejects invalid, impossible and malformed targets',async()=>{
  for(const target of ['0','-1','NaN','1e-20'])assert.equal((await api('accuracy',target+' 1 .0001 10 10000 100 20 20')).status,400);
  assert.equal((await api('accuracy','1 1 .0001 0 10000 100 20 20')).status,400);
  assert.equal((await api('accuracy','1 garbage')).status,400);
});
await check('finite temperatures with overflowing flux fail with valid actionable JSON',async()=>{
  const response=await api('thermal','1e-200 1e-300 1e200 0 100 20 2');
  assert.equal(response.status,400);assert.match(response.data.error,/Heat flux exceeds/);
});
await check('C++ element matrices, source loads and shared-node assembly',async()=>{
  const a=(await api('element','0 1 .0001 10 10000 100 20 20')).data;
  const b=(await api('element','1 1 .0001 10 10000 100 20 20')).data;
  assert.equal(a.stiffness_W_K.length,2);assert.ok(Math.abs(a.stiffness_W_K[0][0]-.02)<1e-15);
  assert.equal(a.stiffness_W_K[0][1],-a.stiffness_W_K[0][0]);
  assert.ok(Math.abs(a.load_W[0]-.025)<1e-15);
  assert.ok(Math.abs(a.nodal_contributions_W[1]+b.nodal_contributions_W[0])<1e-12);
  assert.ok(Math.abs(a.nodal_contributions_W[0]+.42)<1e-12);
  assert.equal(a.parameters.heat_generation_W_m3,10000);
  assert.equal((await fetch(base+'/element.js')).status,200);
});
await check('element index validation and custom-parameter inspection',async()=>{
  for(const index of ['-1','20','1.5','abc','9999999'])assert.equal((await api('element',index+' 1 .0001 10 10000 100 20 20')).status,400);
  const {data,status}=await api('element','9 2 .0001 10 0 -20 80 20');
  assert.equal(status,200);assert.deepEqual(data.load_W,[0,0]);
  assert.ok(Math.abs(data.heat_flux_W_m2+500)<1e-8);
});
await check('continuous analytical and mesh-based peak temperatures',async()=>{
  const {data}=await api('thermal');
  assert.ok(Math.abs(data.peak.analytical_x_m-.42)<1e-12);
  assert.ok(Math.abs(data.peak.analytical_C-188.2)<1e-10);
  assert.ok(Math.abs(data.peak.FEA_C-188)<1e-9);
  assert.ok(Math.abs(data.peak.FEA_x_m-.4)<1e-12);
  const linear=(await api('thermal','2 .0001 10 0 -20 80 20')).data;
  assert.equal(linear.peak.analytical_C,80);assert.equal(linear.peak.analytical_x_m,2);
  const cooling=(await api('thermal','1 .0001 10 -10000 20 20 20')).data;
  assert.equal(cooling.peak.analytical_C,20);assert.equal(cooling.peak.analytical_x_m,0);
});
await check('parameter sweep independently verifies k, area and source effects',async()=>{
  const k=(await api('sweep','k .5 2 3 1 .0001 10 10000 100 20 20')).data;
  assert.equal(k.rows.length,3);assert.equal(k.rows[0].parameter_value,5);
  assert.ok(Math.abs(k.rows.at(-1).midpoint_error_C-.15625)<1e-8);
  assert.ok(Math.abs(k.rows.at(-1).analytical_peak_C-128.9)<1e-9);
  const a=(await api('sweep','area .5 2 2 1 .0001 10 10000 100 20 20')).data;
  assert.ok(Math.abs(a.rows[0].analytical_peak_C-a.rows[1].analytical_peak_C)<1e-9);
  assert.equal(a.rows[1].generated_heat_W,2);
  const q=(await api('sweep','q .5 2 2 1 .0001 10 -10000 20 20 20')).data;
  assert.equal(q.rows[1].parameter_value,-20000);assert.equal(q.rows[1].analytical_peak_C,20);
  const length=(await api('sweep','length .5 2 2 1 .0001 10 10000 100 20 20')).data;
  assert.ok(Math.abs(length.rows[1].midpoint_error_C-1.25)<1e-8);
});
await check('sweep rejects invalid factors, sample counts and resource limits',async()=>{
  for(const prefix of ['k 2 1 5','k 0 2 5','k .5 2 10','bad .5 2 5','k .5 200 5','k .5 2 2.5'])
    assert.equal((await api('sweep',prefix+' 1 .0001 10 10000 100 20 20')).status,400);
  assert.equal((await api('sweep','k .5 2 5 1 .0001 10 10000 100 20 10001')).status,400);
});
await check('two-scenario comparison preserves both inputs and reports B minus A',async()=>{
  const {data,status}=await api('compare','1 .0001 10 10000 100 20 20\n1 .0001 20 10000 100 20 20');
  assert.equal(status,200);assert.equal(data.a.parameters.conductivity_W_mK,10);
  assert.equal(data.b.parameters.conductivity_W_mK,20);
  assert.ok(Math.abs(data.difference_B_minus_A.analytical_peak_C+59.3)<1e-8);
  assert.ok(Math.abs(data.difference_B_minus_A.midpoint_error_C+.15625)<1e-8);
  assert.equal(data.difference_B_minus_A.generated_heat_W,0);
  assert.equal((await api('compare','1 .0001 10 10000 100 20 20')).status,400);
  assert.equal((await api('compare','\n')).status,400);
  assert.equal((await api('compare','1 .0001 10 10000 100 20 10001\n1 .0001 10 10000 100 20 20')).status,400);
});
await check('workspace assets are bundled and served offline',async()=>{
  for(const path of ['/workspace.js','/workspace.css','/docs/WORKSPACE_GUIDE.md']) assert.equal((await fetch(base+path)).status,200);
  const html=await fetch(base+'/').then(r=>r.text());assert.match(html,/workspace.js/);assert.match(html,/workspace.css/);
});
await check('temperature assessment catches peaks between sampled mesh nodes',async()=>{
  const {data,status}=await api('profile','188.1 21 1 .0001 10 10000 100 20 20');
  assert.equal(status,200);assert.equal(data.within_user_limit,false);
  assert.ok(Math.abs(data.margin_C+.1)<1e-10);assert.equal(data.stations.length,21);
  assert.ok(data.stations.every(s=>!s.FEA_exceeds_limit&&!s.analytical_exceeds_limit));
  assert.equal(data.stations[0].FEA_C,100);assert.equal(data.stations.at(-1).FEA_C,20);
  assert.equal((await api('profile','200 2 1 .0001 10 10000 100 20 20')).data.within_user_limit,true);
});
await check('profile error, per-station flags and right-element node convention',async()=>{
  const {data}=await api('profile','180 41 1 .0001 10 10000 100 20 20');
  assert.ok(Math.abs(data.stations[21].absolute_error_C-.3125)<1e-9);
  assert.ok(data.stations.some(s=>s.analytical_exceeds_limit));
  const node=(await api('probe','.3 1 .0001 10 10000 100 20 20')).data;
  assert.equal(node.element_index,6);assert.ok(Math.abs(node.heat_flux_W_m2+950)<1e-7);
  const cooling=(await api('profile','25 11 1 .0001 10 -10000 20 20 20')).data;
  assert.equal(cooling.within_user_limit,true);assert.equal(cooling.analysis.peak.analytical_C,20);
});
await check('assessment limits and offline profile asset',async()=>{
  for(const prefix of ['180 1','180 102','180 2.5','NaN 21'])assert.equal((await api('profile',prefix+' 1 .0001 10 10000 100 20 20')).status,400);
  assert.equal((await api('profile','180 21 1 .0001 10 10000 100 20 10001')).status,400);
  assert.equal((await fetch(base+'/profile.js')).status,200);
});
await mkdir('results/generated',{recursive:true});const output=new Date().toISOString()+'\n'+log.join('\n')+'\n';await writeFile('results/generated/integration.log',output);console.log(output);
