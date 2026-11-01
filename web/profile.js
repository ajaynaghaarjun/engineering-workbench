'use strict';
(() => {
    let latest = null, revision = 0;
    const panel = create('section'); panel.className = 'inspection-panel';
    panel.append(create('h3', 'Temperature limit & sampled profile'), create('p', 'Uses the displayed thermal result. The limit is assessed against the continuous analytical maximum, even if the sampling stations miss the peak. Up to 101 stations and 10000 elements.'));
    const form = create('form'); form.id = 'profile-form'; form.className = 'toolbar';
    const limitLabel = create('label', 'Your upper temperature limit (°C)'), limit = create('input', null, 'profile-limit');
    Object.assign(limit, {type:'number',step:'any',value:'180',required:true}); limitLabel.append(limit);
    const countLabel = create('label', 'Uniform stations'), count = create('input', null, 'profile-count');
    Object.assign(count, {type:'number',min:'2',max:'101',step:'1',value:'41',required:true}); countLabel.append(count);
    const run = create('button', 'Assess displayed rod in C++', 'profile-run'); run.type = 'submit';
    form.append(limitLabel, countLabel, run);
    const summary = create('div', 'Solve a rod first, then assess it here.', 'profile-summary');
    const context = create('p', '', 'profile-context');
    const curve = create('canvas', null, 'profile-chart'), errors = create('canvas', null, 'profile-error-chart');
    for (const canvas of [curve, errors]) { canvas.width=1000; canvas.height=350; canvas.hidden=true; }
    const output = create('div', null, 'profile-stations');
    const filterLabel = create('label', 'Show stations flagged above the limit only'), flagged = create('input', null, 'profile-flagged');
    flagged.type='checkbox'; filterLabel.prepend(flagged);
    function renderRows() {
        if (!latest) return;
        const rows = latest.stations.filter(p => !flagged.checked || p.FEA_exceeds_limit || p.analytical_exceeds_limit);
        output.replaceChildren(rows.length ? table(['x (m)','FEA (°C)','Exact (°C)','Absolute error (°C)','Flux (W/m²)','Element','FEA above limit','Exact above limit'],
            rows.map(p => [p.x_m,p.FEA_C,p.exact_C,p.absolute_error_C,p.heat_flux_W_m2,p.element_index,p.FEA_exceeds_limit?'YES':'NO',p.analytical_exceeds_limit?'YES':'NO'])) : create('p','No sampled station exceeds the limit. The global assessment above still includes the continuous maximum.'));
    }
    flagged.onchange=renderRows;
    const exports = create('div'); exports.className='toolbar';
    const json = control('Export assessment JSON','profile-json',()=>download('temperature_assessment.json',JSON.stringify(latest,null,2),'application/json'));
    const csv = control('Export all stations CSV','profile-csv',()=>download('sampled_stations.csv',
        'x_m,FEA_C,exact_C,absolute_error_C,heat_flux_W_m2,element_index,FEA_exceeds_limit,analytical_exceeds_limit\n'+latest.stations.map(p=>[p.x_m,p.FEA_C,p.exact_C,p.absolute_error_C,p.heat_flux_W_m2,p.element_index,p.FEA_exceeds_limit,p.analytical_exceeds_limit].join(',')).join('\n')));
    const png = control('Export error plot PNG','profile-png',()=>{
        const link=create('a');link.download='sampled_error.png';link.href=errors.toDataURL('image/png');document.body.append(link);link.click();link.remove();status('Error plot PNG download requested.');
    });
    const exportButtons=[json,csv,png]; exportButtons.forEach(b=>b.disabled=true); exports.append(...exportButtons);
    form.onsubmit=e=>{
        e.preventDefault(); if (!thermal) return status('Solve a rod in Thermal Analysis first.',true);
        const selected=thermal, capturedRevision=revision, p=selected.parameters;
        const body=[limit.value,count.value,p.length_m,p.area_m2,p.conductivity_W_mK,p.heat_generation_W_m3,p.left_C,p.right_C,selected.elements].join(' ');
        task(run,'Assessing the limit and sampling the solved field in C++…',async()=>{
            const result=await api('profile',body);
            if (revision!==capturedRevision) return status('The displayed rod changed during assessment. Run the assessment again.',true);
            latest={captured_at:new Date().toISOString(),...result};
            summary.replaceChildren(table(['Continuous peak (°C)','Peak x (m)','Your limit (°C)','Margin: limit − peak (°C)','Within user limit'],
                [[result.analysis.peak.analytical_C,result.analysis.peak.analytical_x_m,result.limit_C,result.margin_C,result.within_user_limit?'YES':'NO']]));
            context.textContent=`Assessed: L=${p.length_m} m, A=${p.area_m2} m², k=${p.conductivity_W_mK} W/(m K), q=${p.heat_generation_W_m3} W/m³, boundaries ${p.left_C}/${p.right_C} °C, N=${selected.elements}. ${result.scope} Flux uses the element on the right at internal nodes, with the last element used at x=L.`;
            curve.hidden=errors.hidden=false;
            plot(curve,[{name:'Sampled FEA',color:'#236f9d',points:result.stations.map(s=>[s.x_m,s.FEA_C])},
                        {name:'Sampled analytical',color:'#b05c25',points:result.stations.map(s=>[s.x_m,s.exact_C])},
                        {name:'User limit',color:'#9b3545',points:[[0,result.limit_C],[p.length_m,result.limit_C]]}], 'Position x (m)','T (°C)');
            plot(errors,[{name:'Sampled absolute error',color:'#72449a',points:result.stations.map(s=>[s.x_m,s.absolute_error_C])}],'Position x (m)','Error (°C)');
            renderRows(); exportButtons.forEach(b=>b.disabled=false);
        });
    };
    document.addEventListener('workbench:thermal-result',()=>{
        revision++;latest=null;summary.textContent='Displayed rod changed. Run a fresh temperature assessment.';
        output.replaceChildren();context.textContent='';curve.hidden=errors.hidden=true;exportButtons.forEach(b=>b.disabled=true);
    });
    panel.append(form,summary,context,curve,errors,exports,filterLabel,output);
    $('#workspace').append(panel);
})();
