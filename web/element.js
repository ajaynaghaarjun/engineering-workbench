'use strict';
(() => {
    let selectedRun = null, latest = null, revision = 0;
    const panel = create('section');
    panel.className = 'inspection-panel';
    panel.append(create('h3', 'Peak temperature'), create('div', 'Solve a rod to compare its maxima.', 'peak-summary'));
    panel.append(create('p', 'The FEM maximum occurs at a node. The continuous analytical maximum can lie between nodes. For a flat maximum, the first location is reported.'));
    panel.append(create('h3', 'Inspect element assembly'));
    panel.append(create('p', 'Kₑ = (kA/h)[1, −1; −1, 1], fₑ = (qAh/2)[1, 1]. Nodal contributions KₑTₑ − fₑ assemble with neighbouring elements; an individual contribution need not be zero.'));
    const bar = create('div');
    bar.className = 'toolbar';
    const label = create('label', 'Element index (starts at 0)');
    const index = create('input', null, 'element-index');
    Object.assign(index, {type: 'number', min: '0', step: '1', value: '0', required: true});
    label.append(index);
    const output = create('div', 'Run a thermal analysis first.', 'element-result');
    const exportButton = control('Export element JSON', 'element-export', () =>
        download('element_assembly.json', JSON.stringify(latest, null, 2), 'application/json'));
    exportButton.disabled = true;
    const inspect = control('Inspect element in C++', 'element-inspect', e => {
        if (!index.reportValidity() || !selectedRun) return;
        const run = selectedRun, snapshotRevision = revision, p = run.parameters;
        const body = [index.value, p.length_m, p.area_m2, p.conductivity_W_mK,
                      p.heat_generation_W_m3, p.left_C, p.right_C, run.elements].join(' ');
        task(e.target, 'Solving and inspecting element assembly in C++…', async () => {
            const result = await api('element', body);
            // A different displayed mesh invalidates an in-flight inspection.
            if (revision !== snapshotRevision) return;
            latest = {captured_at: new Date().toISOString(), ...result};
            const k = result.stiffness_W_K;
            output.replaceChildren(
                table(['Local row', 'K row (W/K)', 'Source load (W)', 'Temperature (°C)', 'Nodal contribution (W)'],
                      [0, 1].map(i => [i, k[i].join(', '), result.load_W[i], result.temperature_C[i], result.nodal_contributions_W[i]])),
                create('p', `Element ${result.element_index}: x = ${result.x_m.join(' to ')} m · heat flux = ${result.heat_flux_W_m2.toPrecision(7)} W/m².`));
            exportButton.disabled = false;
        });
    });
    inspect.disabled = true;
    bar.append(label, inspect, exportButton);
    panel.append(bar, output);
    $('#flux-chart').after(panel);
    document.addEventListener('workbench:thermal-result', event => {
        selectedRun = event.detail;
        revision++;
        index.max = selectedRun.elements - 1;
        if (Number(index.value) >= selectedRun.elements) index.value = 0;
        inspect.disabled = false;
        exportButton.disabled = true;
        latest = null;
        output.textContent = 'Choose an element in the displayed mesh. This inspection uses the displayed result parameters, even if form inputs have since changed.';
    });
})();
