import {spawn} from 'node:child_process';
import {resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {mkdir,writeFile} from 'node:fs/promises';
const binary=resolve(process.argv[2]||'build/mac/Launch');
const samples=[];
for(let i=0;i<5;i++){
  const start=performance.now();
  const child=spawn(binary,['--no-browser'],{cwd:tmpdir(),stdio:['ignore','pipe','pipe']});
  try{
    const url=await new Promise((ok,fail)=>{
      let output='';const timer=setTimeout(()=>fail(Error('Launcher readiness timed out')),10000);
      child.on('error',e=>{clearTimeout(timer);fail(e);});
      child.on('exit',code=>{clearTimeout(timer);fail(Error('Launcher exited '+code));});
      child.stdout.on('data',chunk=>{output+=chunk;const match=output.match(/Workbench ready: (http:\/\/127\.0\.0\.1:\d+)/);if(match){clearTimeout(timer);ok(match[1]);}});
    });
    const response=await fetch(url+'/api/health');
    if(!response.ok||(await response.json()).status!=='ready')throw Error('Readiness failed');
    const page=await fetch(url);if(!page.ok||!(await page.text()).includes('Engineering Workbench'))throw Error('Executable-relative assets failed');
    samples.push((performance.now()-start)/1000);
  } finally {child.kill('SIGTERM');await new Promise(r=>child.once('close',r));}
}
const sorted=[...samples].sort((a,b)=>a-b);
const result={timestamp:new Date().toISOString(),platform:process.platform,method:'Process spawn to health response and HTML response, launched from temporary working directory; excludes browser visual readiness',samples_s:samples,median_s:sorted[2],windows_runtime_verified:false};
await mkdir('results/generated',{recursive:true});await writeFile('results/generated/launch_timing.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
