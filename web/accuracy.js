'use strict';
// Presets populate inputs only. Mesh selection, solving and error evaluation execute in C++.
(() => {
    const form = $('#thermal-form');
    const section = create('section');
    section.className = 'inspection-panel';
    section.append(create('h3', 'Choose a mesh by accuracy'));
    section.append(create('p', 'For this constant-property rod, the midpoint interpolation error is |q|L²/(8kN²). Choose a target; C++ selects a uniform mesh and checks the actual FEM error, including roundoff.'));
    const bar = create('div');
    bar.className = 'toolbar';
    const label = create('label', 'Target midpoint error (°C)');
    const target = create('input', null, 'accuracy-target');
    Object.assign(target, {type: 'number', min: '1e-12', step: 'any', value: '0.1', required: true});
    label.append(target);
    let latest = null;
    const exportButton = control('Export accuracy evidence JSON', 'accuracy-export', () =>
        download('mesh_accuracy.json', JSON.stringify(latest, null, 2), 'application/json'));
    exportButton.disabled = true;
    bar.append(label, control('Select mesh & solve', 'accuracy-solve', e => {
        if (!form.reportValidity() || !target.reportValidity()) return;
        task(e.target, 'Selecting a mesh and verifying the FEM error in C++…', async () => {
            const result = await api('accuracy', target.value + ' ' + [...new FormData(form).values()].join(' '));
            latest = {captured_at: new Date().toISOString(), ...result};
            studyData = null;
            $('#mesh-selector').disabled = true;
            $('#mesh-selector').replaceChildren();
            $('#convergence-export').disabled = true;
            form.elements.namedItem('elements').value = result.run.elements;
            showThermal(result.run);
            $('#accuracy-result').replaceChildren(table(
                ['Elements', 'Target (°C)', 'Predicted error (°C)', 'Measured error (°C)', 'Target met'],
                [[result.run.elements, result.target_error_C, result.predicted_error_C.toExponential(6),
                  result.run.midpoint_error_C.toExponential(6), result.target_met ? 'YES' : 'NO - floating-point error exceeds target']]));
            exportButton.disabled = false;
            if (!result.target_met) status('Measured FEM error exceeds the requested target. Inspect roundoff and choose a less strict tolerance.', true);
        });
    }), exportButton);
    section.append(bar, create('div', 'No accuracy solve yet. Maximum 200000 elements. Prediction is specific to this rod model.', 'accuracy-result'));
    $('#analysis-context').before(section);

    const presets = create('div');
    presets.className = 'toolbar';
    presets.append(create('span', 'Parameter examples:'));
    for (const [name, values] of [
        ['Required defaults', [1, 0.0001, 10, 10000, 100, 20, 20]],
        ['Zero-source linear rod', [2, 0.0001, 10, 0, -20, 80, 20]],
        ['Cooling with heat removal', [1, 0.0001, 10, -10000, 20, 20, 20]]
    ]) {
        presets.append(control(name, null, () => {
            ['length', 'area', 'k', 'q', 'left', 'right', 'elements'].forEach((key, i) =>
                form.elements.namedItem(key).value = values[i]);
            status(name + ' loaded into inputs. Run a solve to update the displayed results.');
        }));
    }
    form.before(presets);
})();
