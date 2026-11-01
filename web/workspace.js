'use strict';
// Saved items are presentation configuration. All engineering calculations execute in C++.
(() => {
    const keys = ['length', 'area', 'k', 'q', 'left', 'right', 'elements'];
    const form = $('#thermal-form'), storageKey = 'ew-workspace-v1';
    let saved = [], sweepResult = null, comparison = null;
    function read(key, fallback) {
        try { const value = localStorage.getItem(key); return value && value.length < 65536 ? JSON.parse(value) : fallback; }
        catch { return fallback; }
    }
    function persist(key, value) {
        try { localStorage.setItem(key, JSON.stringify(value)); return true; }
        catch { status('Browser storage unavailable or full. This session still works; export important results.', true); return false; }
    }
    function validValues(v) {
        return Array.isArray(v) && v.length === 7 && v.every(x => typeof x === 'string' && x.trim() && Number.isFinite(Number(x)));
    }
    const initial = read(storageKey, []);
    if (Array.isArray(initial)) saved = initial.slice(0, 12).filter(s =>
        s && typeof s.id === 'string' && typeof s.name === 'string' && s.name.length <= 60 && validValues(s.values));
    const values = () => keys.map(key => form.querySelector('[name="' + key + '"]').value);
    const runValues = run => {
        const p = run.parameters;
        return [p.length_m, p.area_m2, p.conductivity_W_mK, p.heat_generation_W_m3, p.left_C, p.right_C, run.elements].map(String);
    };
    function fill(v) { keys.forEach((key, i) => form.querySelector('[name="' + key + '"]').value = v[i]); }
    function activate(id) { document.querySelector('[data-tab="' + id + '"]').click(); }
    const view = create('section', null, 'workspace');
    view.className = 'view'; view.hidden = true;
    view.append(create('h2', 'Scenario workspace'), create('p', 'Save solved parameter sets, compare two cases and explore a bounded parameter sweep. Calculations run in C++; saved scenarios and notes stay in this browser profile.'));
    const guide = create('a', 'Read the workspace guide'); guide.href = '/docs/WORKSPACE_GUIDE.md'; guide.target = '_blank'; guide.rel = 'noopener'; view.append(guide);
    const library = create('section'); library.className = 'inspection-panel';
    library.append(create('h3', 'Saved scenarios (maximum 12)'));
    const bar = create('div'); bar.className = 'toolbar';
    const nameLabel = create('label', 'Scenario name'), name = create('input', null, 'scenario-name');
    name.maxLength = 60; name.placeholder = 'e.g. Baseline rod'; nameLabel.append(name);
    const picker = create('select', null, 'scenario-picker'); picker.setAttribute('aria-label', 'Saved scenario');
    const a = create('select', null, 'compare-a'), b = create('select', null, 'compare-b');
    a.setAttribute('aria-label', 'Comparison scenario A'); b.setAttribute('aria-label', 'Comparison scenario B');
    const librarySummary = create('div', null, 'scenario-summary');
    function refresh() {
        for (const select of [picker, a, b]) {
            const previous = select.value; select.replaceChildren();
            for (const item of saved) { const o = create('option', item.name); o.value = item.id; select.append(o); }
            if (saved.some(s => s.id === previous)) select.value = previous;
        }
        if (saved.length > 1 && a.value === b.value) b.value = saved.find(s => s.id !== a.value).id;
        librarySummary.textContent = saved.length ? `${saved.length} saved. Restore only fills inputs; re-run to calculate fresh results.` : 'Solve a thermal case, then save its displayed parameters here.';
        return persist(storageKey, saved);
    }
    bar.append(nameLabel, control('Save displayed analysis', 'scenario-save', () => {
        if (!thermal) return status('Solve a thermal analysis before saving a scenario.', true);
        if (!name.value.trim()) return status('Enter a scenario name.', true);
        if (saved.length >= 12) return status('The library is full. Delete a scenario before saving another.', true);
        saved.push({id: crypto.randomUUID(), name: name.value.trim(), values: runValues(thermal), captured_at: new Date().toISOString()});
        const persisted = refresh(); picker.value = saved.at(-1).id;
        if (persisted) status('Displayed analysis parameters saved in this browser.');
    }), picker, control('Restore inputs', 'scenario-restore', () => {
        const item = saved.find(s => s.id === picker.value); if (!item) return status('Save a scenario first.', true);
        fill(item.values); activate('thermal'); status('Restored ' + item.name + ' into inputs. Solve to update results.');
    }), control('Re-run selected', 'scenario-run', e => {
        const item = saved.find(s => s.id === picker.value); if (!item) return status('Save a scenario first.', true);
        task(e.target, 'Re-running saved parameters in C++…', async () => {
            const run = await api('thermal', item.values.join(' '));
            fill(item.values); selectSingleThermal(run); activate('thermal');
        });
    }), control('Delete selected', 'scenario-delete', () => {
        saved = saved.filter(s => s.id !== picker.value);
        if (refresh()) status('Selected scenario removed from the local library.');
    }));
    bar.append(control('Export scenario library', 'library-export', () => download('saved_scenarios.json', JSON.stringify({exported_at:new Date().toISOString(),scenarios:saved}, null, 2), 'application/json')));
    library.append(bar, librarySummary); view.append(library);

    const comparePanel = create('section'); comparePanel.className = 'inspection-panel';
    comparePanel.append(create('h3', 'Two-scenario comparison'), create('p', 'Compare physical coordinates in metres; unequal rod lengths are shown on the same absolute x axis. Differences are B minus A. Maximum 10000 elements per case.'));
    const compareBar = create('div'); compareBar.className = 'toolbar';
    const compareTable = create('div', null, 'compare-results'), compareChart = create('canvas', null, 'compare-chart');
    compareChart.width = 1000; compareChart.height = 360; compareChart.hidden = true;
    const comparisonExport = control('Export comparison JSON', 'compare-export', () => download('scenario_comparison.json', JSON.stringify(comparison, null, 2), 'application/json'));
    comparisonExport.disabled = true;
    compareBar.append(a, b, control('Compare in C++', 'compare-run', e => {
        const first = saved.find(s => s.id === a.value), second = saved.find(s => s.id === b.value);
        if (!first || !second) return status('Save two scenarios before comparing.', true);
        task(e.target, 'Comparing two scenarios in C++…', async () => {
            const result = await api('compare', first.values.join(' ') + '\n' + second.values.join(' '));
            comparison = {captured_at: new Date().toISOString(), names: [first.name, second.name], ...result};
            const d = result.difference_B_minus_A;
            compareTable.replaceChildren(table(['Metric', first.name + ' (A)', second.name + ' (B)', 'B − A'], [
                ['Analytical peak (°C)', result.a.peak.analytical_C, result.b.peak.analytical_C, d.analytical_peak_C],
                ['Midpoint error (°C)', result.a.midpoint_error_C, result.b.midpoint_error_C, d.midpoint_error_C],
                ['Generated heat (W)', result.a.diagnostics.generated_heat_W, result.b.diagnostics.generated_heat_W, d.generated_heat_W]
            ]));
            compareChart.hidden = false;
            plot(compareChart, [{name: first.name + ' (FEA)', color: '#236f9d', points: result.a.nodes.map(n => n.slice(0,2))},
                                {name: second.name + ' (FEA)', color: '#a85225', points: result.b.nodes.map(n => n.slice(0,2))}], 'Position x (m)', 'T (°C)');
            comparisonExport.disabled = false;
        });
    }), comparisonExport);
    comparePanel.append(compareBar, compareTable, compareChart); view.append(comparePanel);

    const sweepPanel = create('section'); sweepPanel.className = 'inspection-panel';
    sweepPanel.append(create('h3', 'Parameter sweep'), create('p', 'Uses the current Thermal Analysis form as the baseline. C++ changes one property by evenly spaced multipliers and solves every case. Limits: 2–9 cases, factors 0.001–100, at most 10000 elements.'));
    const sweepBar = create('form'); sweepBar.className = 'toolbar'; sweepBar.id = 'sweep-form';
    const parameterLabel = create('label', 'Property'), parameter = create('select', null, 'sweep-parameter');
    for (const [key, title] of [['k','Conductivity (W/m K)'],['q','Heat source (W/m³)'],['length','Length (m)'],['area','Area (m²)']]) {
        const option = create('option', title); option.value = key; parameter.append(option);
    }
    parameterLabel.append(parameter); sweepBar.append(parameterLabel);
    const fields = [];
    for (const [id, title, value, min, max, step] of [['sweep-start','Start multiplier','0.5','.001','100','any'],['sweep-end','End multiplier','2','.001','100','any'],['sweep-samples','Cases','5','2','9','1']]) {
        const label = create('label', title), input = create('input', null, id);
        Object.assign(input, {type:'number', value, min, max, step, required:true}); fields.push(input); label.append(input); sweepBar.append(label);
    }
    const sweepButton = create('button', 'Run C++ sweep', 'sweep-run'); sweepButton.type = 'submit'; sweepBar.append(sweepButton);
    const sweepContext = create('p', 'No sweep completed yet.', 'sweep-context');
    const sweepTable = create('div', null, 'sweep-results'), sweepChart = create('canvas', null, 'sweep-chart');
    sweepChart.width = 1000; sweepChart.height = 360; sweepChart.hidden = true;
    const sweepJSON = control('Export sweep JSON', 'sweep-json', () => download('parameter_sweep.json', JSON.stringify(sweepResult, null, 2), 'application/json'));
    const sweepCSV = control('Export sweep CSV', 'sweep-csv', () => download('parameter_sweep.csv', 'factor,parameter_value,analytical_peak_C,peak_x_m,midpoint_error_C,generated_heat_W,energy_imbalance_W\n' + sweepResult.rows.map(r => [r.factor,r.parameter_value,r.analytical_peak_C,r.peak_x_m,r.midpoint_error_C,r.generated_heat_W,r.energy_imbalance_W].join(',')).join('\n')));
    sweepJSON.disabled = sweepCSV.disabled = true;
    sweepBar.onsubmit = e => {
        e.preventDefault();
        if (!form.checkValidity()) { activate('thermal'); form.reportValidity(); return status('Correct the highlighted thermal inputs, then return to the workspace to run the sweep.', true); }
        const body = [parameter.value, ...fields.map(f => f.value), ...values()].join(' ');
        task(sweepButton, 'Solving parameter sweep in C++…', async () => {
            sweepResult = {captured_at: new Date().toISOString(), ...await api('sweep', body)};
            const p = sweepResult.baseline.parameters;
            sweepContext.textContent = `Completed sweep of ${sweepResult.parameter}. Baseline: L=${p.length_m} m, A=${p.area_m2} m², k=${p.conductivity_W_mK} W/(m K), q=${p.heat_generation_W_m3} W/m³, boundaries ${p.left_C}/${p.right_C} °C, N=${sweepResult.baseline.elements}.`;
            sweepTable.replaceChildren(table(['Multiplier','Property value','Analytical peak (°C)','Peak x (m)','Midpoint error (°C)','Generated heat (W)'],
                sweepResult.rows.map(r => [r.factor,r.parameter_value,r.analytical_peak_C,r.peak_x_m,r.midpoint_error_C,r.generated_heat_W])));
            sweepChart.hidden = false;
            plot(sweepChart, [{name:'Analytical peak',color:'#236f9d',points:sweepResult.rows.map(r=>[r.factor,r.analytical_peak_C])}], 'Property multiplier', 'Peak (°C)');
            sweepJSON.disabled = sweepCSV.disabled = false;
        });
    };
    const sweepExports = create('div'); sweepExports.className = 'toolbar'; sweepExports.append(sweepJSON, sweepCSV);
    sweepPanel.append(sweepBar, sweepExports, sweepContext, sweepTable, sweepChart); view.append(sweepPanel);

    const notesPanel = create('section'); notesPanel.className = 'inspection-panel';
    const notes = create('textarea', null, 'workspace-notes'); notes.maxLength = 4000; notes.rows = 5;
    notes.setAttribute('aria-label','Experiment notes'); notes.placeholder = 'Observations and questions for your demonstration…';
    const storedNotes = read('ew-notes-v1', ''); notes.value = typeof storedNotes === 'string' ? storedNotes.slice(0,4000) : '';
    notes.oninput = () => persist('ew-notes-v1', notes.value);
    notesPanel.append(create('h3','Experiment notes'), notes, control('Export notes', 'notes-export', () => download('experiment_notes.txt', notes.value, 'text/plain')));
    view.append(notesPanel); $('main').append(view);
    const tab = create('button','Scenario workspace'); tab.dataset.tab = 'workspace';
    tab.onclick = () => { document.querySelectorAll('.view').forEach(v => v.hidden = v.id !== 'workspace'); document.querySelectorAll('[data-tab]').forEach(b => b.classList.toggle('active', b === tab)); };
    $('nav').append(tab); refresh();

    // Draft restoration is explicit and never replaces displayed results.
    form.addEventListener('input', () => persist('ew-draft-v1', values()));
    const utilities = create('div'); utilities.className = 'toolbar workspace-tools';
    utilities.append(control('Restore last input draft','restore-draft', () => {
        const draft = read('ew-draft-v1', null);
        if (!validValues(draft)) return status('No valid browser draft is available.', true);
        fill(draft); status('Draft restored into inputs. Run a solve to update displayed results.');
    }));
    form.before(utilities);
    const displayTools = create('div'); displayTools.className = 'toolbar display-tools';
    const contrast = control('High contrast','contrast-toggle', () => {
        const enabled = document.body.classList.toggle('high-contrast'); contrast.setAttribute('aria-pressed', String(enabled)); persist('ew-contrast-v1', enabled);
    });
    const contrastEnabled = read('ew-contrast-v1', false) === true;
    document.body.classList.toggle('high-contrast',contrastEnabled); contrast.setAttribute('aria-pressed', String(contrastEnabled));
    displayTools.append(contrast, control('Print current view','print-view', () => window.print()), create('span','Shortcuts: Alt+1…7 switches views (outside input fields).'));
    $('nav').after(displayTools);
    document.addEventListener('keydown', e => {
        if (!e.altKey || e.ctrlKey || e.metaKey || /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
        const buttons = [...document.querySelectorAll('[data-tab]')], i = /^Digit[1-7]$/.test(e.code) ? Number(e.code.slice(-1))-1 : -1;
        if (Number.isInteger(i) && i >= 0 && i < buttons.length) { e.preventDefault(); buttons[i].click(); buttons[i].focus(); }
    });
    for (const id of ['scene','thermal-chart','convergence-chart','flux-chart','loss-chart','compare-chart','sweep-chart']) {
        const canvas = $('#'+id); if (!canvas) continue;
        const tools = create('div'); tools.className = 'toolbar chart-tools';
        tools.append(control('Save chart PNG', null, () => {
            if (canvas.hidden || (id === 'scene' ? !scene.vertices.length && !scene.nodes.length : id === 'compare-chart' ? !comparison : id === 'sweep-chart' ? !sweepResult : id === 'loss-chart' ? !backpropData : !thermal))
                return status('Generate this chart before exporting.', true);
            const link = create('a'); link.download = id+'.png'; link.href = canvas.toDataURL('image/png'); document.body.append(link); link.click(); link.remove();
            status('Chart PNG download requested.');
        }), control('Expand chart', null, e => task(e.target, 'Expanding chart…', async () => {
            if (!canvas.requestFullscreen) throw Error('Fullscreen is unavailable in this browser.');
            await canvas.requestFullscreen();
        })));
        canvas.after(tools);
    }
})();
