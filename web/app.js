'use strict';
const $ = s => document.querySelector(s);
let pending = 0, thermal = null, studyData = null, performanceData = null, backpropData = null;
function status(message, error = false) {
    $('#status').textContent = message;
    $('#status').classList.toggle('error', error);
}
async function api(path, body = '') {
    pending++;
    $('#busy-state').textContent = 'C++ operation running · safe completion';
    try {
        const response = await fetch(
            '/api/' + path, {method : 'POST', headers : {'Content-Type' : 'text/plain'}, body});
        const data = await response.json();
        if (!response.ok)
            throw Error(data.error || 'Backend request failed');
        return data;
    } finally {
        pending--;
        if (!pending)
            $('#busy-state').textContent = '';
    }
}
async function task(button, message, fn) {
    if (button.disabled)
        return;
    button.disabled = true;
    status(message);
    try {
        await fn();
        if (!$('#status').classList.contains('error'))
            status('Operation completed. Results are ready to inspect or export.');
    } catch (e) {
        status(e.message, true);
    } finally {
        button.disabled = false;
    }
}
function download(name, text, type = 'text/csv') {
    const url = URL.createObjectURL(new Blob([ text ], {type}));
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.hidden = true;
    document.body.append(a);
    a.click();
    status('Download requested: ' + name + '. Check your browser downloads.');
    setTimeout(() => {
        a.remove();
        URL.revokeObjectURL(url);
    }, 30000);
}
function table(headers, rows) {
    const t = document.createElement('table'), head = t.createTHead().insertRow();
    headers.forEach(h => {
        const th = document.createElement('th');
        th.textContent = h;
        head.append(th);
    });
    const body = t.createTBody();
    rows.forEach(row => {
        const tr = body.insertRow();
        row.forEach(v => { tr.insertCell().textContent = String(v); });
    });
    return t;
}
function plot(canvas, series, xLabel, yLabel, logY = false) {
    const c = canvas.getContext('2d'), w = canvas.width, h = canvas.height;
    c.clearRect(0, 0, w, h);
    c.font = '13px sans-serif';
    const all = series.flatMap(s => s.points).filter(p => p.every(Number.isFinite));
    if (!all.length)
        return;
    const transform = y => logY ? Math.log10(Math.max(y, 1e-20)) : y;
    let xmin = Infinity, xmax = -Infinity, ymin = Infinity, ymax = -Infinity;
    for (const p of all) {
        xmin = Math.min(xmin, p[0]);
        xmax = Math.max(xmax, p[0]);
        ymin = Math.min(ymin, transform(p[1]));
        ymax = Math.max(ymax, transform(p[1]));
    }
    if (xmax === xmin)
        xmax++;
    if (ymax === ymin)
        ymax++;
    let pad = (ymax - ymin) * .1;
    ymin -= pad;
    ymax += pad;
    const px = x => 65 + (x - xmin) / (xmax - xmin) * (w - 100),
          py = y => h - 48 - (transform(y) - ymin) / (ymax - ymin) * (h - 90);
    c.strokeStyle = '#dce5ed';
    c.fillStyle = '#5b7186';
    for (let i = 0; i <= 4; i++) {
        const y = ymin + (ymax - ymin) * i / 4, yy = h - 48 - i * (h - 90) / 4;
        c.beginPath();
        c.moveTo(65, yy);
        c.lineTo(w - 35, yy);
        c.stroke();
        c.fillText(logY ? '10^' + y.toFixed(1) : y.toPrecision(4), 3, yy + 4);
        const x = xmin + (xmax - xmin) * i / 4;
        c.fillText(x.toPrecision(3), px(x) - 12, h - 28);
    }
    series.forEach((s, i) => {
        c.strokeStyle = s.color;
        c.lineWidth = 2;
        c.beginPath();
        s.points.forEach((p, j) => {
            if (j)
                c.lineTo(px(p[0]), py(p[1]));
            else
                c.moveTo(px(p[0]), py(p[1]));
        });
        c.stroke();
        c.fillStyle = s.color;
        c.fillText(s.name, 75 + (i % 3) * 290, 20 + Math.floor(i / 3) * 16);
    });
    c.fillStyle = '#334e68';
    c.fillText(xLabel, w / 2 - 35, h - 6);
    c.fillText(yLabel, 8, 20);
}
document.querySelectorAll('[data-tab]').forEach(button => button.onclick = () => {
    document.querySelectorAll('.view').forEach(s => s.hidden = s.id !== button.dataset.tab);
    document.querySelectorAll('[data-tab]')
        .forEach(b => b.classList.toggle('active', b === button));
    if (button.dataset.tab === 'geometry')
        drawScene();
});
// Dependency-free orthographic 3D renderer. Geometry and CSV parsing occur in C++.
const scene = {
    vertices : [],
    nodes : [],
    yaw : .65,
    pitch : -.4,
    zoom : 1,
    panX : 0,
    panY : 0,
    center : [ 0, 0, 0 ],
    radius : 1,
    projected : []
};
function fit() {
    const points = scene.nodes.length ? scene.nodes.map(n => n.slice(1, 4)) : scene.vertices;
    if (!points.length)
        return;
    const lo = [ Infinity, Infinity, Infinity ], hi = [ -Infinity, -Infinity, -Infinity ];
    points.forEach(p => p.forEach((v, i) => {
        lo[i] = Math.min(lo[i], v);
        hi[i] = Math.max(hi[i], v);
    }));
    scene.center = lo.map((v, i) => (v + hi[i]) / 2);
    scene.radius = Math.max(...lo.map((v, i) => hi[i] - v), 1e-12);
    scene.zoom = 1;
    scene.panX = scene.panY = 0;
    drawScene();
}
function project(p) {
    let [x, y, z] = p.map((v, i) => (v - scene.center[i]) / scene.radius), a = scene.yaw,
               b = scene.pitch;
    let xx = x * Math.cos(a) + z * Math.sin(a), zz = -x * Math.sin(a) + z * Math.cos(a),
        yy = y * Math.cos(b) - zz * Math.sin(b);
    return [
        500 + xx * 350 * scene.zoom + scene.panX, 255 - yy * 350 * scene.zoom + scene.panY,
        y * Math.sin(b) + zz * Math.cos(b)
    ];
}
function temperatureColor(t, min, max) {
    const f = (t - min) / (max - min || 1);
    return `hsl(${240 * (1 - f)},75%,48%)`;
}
function drawScene() {
    const canvas = $('#scene'), c = canvas.getContext('2d');
    c.clearRect(0, 0, 1000, 510);
    c.strokeStyle = '#e4ecf3';
    for (let x = 0; x < 1000; x += 50) {
        c.beginPath();
        c.moveTo(x, 0);
        c.lineTo(x, 510);
        c.stroke();
    }
    for (let y = 0; y < 510; y += 50) {
        c.beginPath();
        c.moveTo(0, y);
        c.lineTo(1000, y);
        c.stroke();
    }
    if (scene.vertices.length) {
        let triangles = [];
        for (let i = 0; i < scene.vertices.length; i += 3) {
            const p = scene.vertices.slice(i, i + 3).map(project);
            triangles.push({p, z : p.reduce((s, v) => s + v[2], 0)});
        }
        triangles.sort((a, b) => a.z - b.z);
        triangles.forEach(({p}, i) => {
            c.beginPath();
            p.forEach((v, j) => j ? c.lineTo(v[0], v[1]) : c.moveTo(v[0], v[1]));
            c.closePath();
            c.fillStyle = `hsl(202,38%,${64 + i % 5 * 3}%)`;
            if (!scene.wireframe)
                c.fill();
            c.strokeStyle = '#234d6b';
            c.stroke();
        });
    }
    scene.projected = [];
    if (scene.nodes.length) {
        const temps = scene.nodes.map(n => n[4]), min = Math.min(...temps),
              max = Math.max(...temps);
        scene.nodes.map(n => ({n, p : project(n.slice(1, 4))}))
            .sort((a, b) => a.p[2] - b.p[2])
            .forEach(({n, p}) => {
                c.fillStyle = temperatureColor(n[4], min, max);
                c.beginPath();
                c.arc(p[0], p[1], 7, 0, Math.PI * 2);
                c.fill();
                c.strokeStyle = 'white';
                c.stroke();
                scene.projected.push({n, p});
            });
        $('#legend').textContent = `Temperature: ${min.toFixed(2)} °C (blue) → ${
            max.toFixed(2)} °C (red) · coordinates: m`;
    } else
        $('#legend').textContent = 'STL coordinates: source units (sample: m)';
    c.fillStyle = '#668097';
    c.font = '13px sans-serif';
    const selected = scene.projected.find(p => p.n[0] === scene.selectedNode);
    if (selected) {
        c.strokeStyle = '#172c41';
        c.lineWidth = 3;
        c.beginPath();
        c.arc(selected.p[0], selected.p[1], 12, 0, 2 * Math.PI);
        c.stroke();
        c.lineWidth = 1;
    }
    c.fillText('Orthographic 3D · drag to rotate · Shift-drag to pan', 18, 490);
}
let drag = null;
$('#scene').onpointerdown = e => {
    drag = {x : e.clientX, y : e.clientY, moved : false};
    e.currentTarget.setPointerCapture(e.pointerId);
};
$('#scene').onpointermove = e => {
    if (!drag)
        return;
    let dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    if (Math.abs(dx) + Math.abs(dy) > 1)
        drag.moved = true;
    if (e.shiftKey) {
        scene.panX += dx;
        scene.panY += dy;
    } else {
        scene.yaw += dx * .01;
        scene.pitch += dy * .01;
    }
    drag.x = e.clientX;
    drag.y = e.clientY;
    drawScene();
};
$('#scene').onpointerup = e => {
    if (drag && !drag.moved) {
        const rect = e.currentTarget.getBoundingClientRect(),
              x = (e.clientX - rect.left) * 1000 / rect.width,
              y = (e.clientY - rect.top) * 510 / rect.height;
        const nearest = scene.projected.map(v => ({...v, d : Math.hypot(v.p[0] - x, v.p[1] - y)}))
                            .sort((a, b) => a.d - b.d)[0];
        if (nearest && nearest.d < 25) {
            const n = nearest.n;
            $('#inspection').textContent =
                `Node ${n[0]} · x=${n[1]} m, y=${n[2]} m, z=${n[3]} m · ${n[4]} °C`;
        }
    }
    drag = null;
};
$('#scene').onwheel = e => {
    e.preventDefault();
    scene.zoom = Math.min(15, Math.max(.1, scene.zoom * Math.exp(-e.deltaY * .001)));
    drawScene();
};
$('#fit').onclick = fit;
async function loadGeometry(kind, text, name) {
    const data = await api(kind, text);
    scene.vertices = data.vertices || [];
    scene.nodes = data.nodes || [];
    scene.selectedNode = null;
    nodePage = 0;
    renderNodeExplorer();
    const details = $('#geometry-details'), summary = data.summary;
    details.replaceChildren();
    if (kind === 'stl')
        details.append(table([ 'C++ mesh diagnostic', 'Value' ], [
            [ 'Triangles', summary.triangles ],
            [ 'Surface area (source units²)', summary.surface_area_source_units2.toPrecision(7) ],
            [ 'Degenerate triangles', summary.degenerate_triangles ],
            [ 'Bounds minimum', summary.bounds_min.join(', ') ],
            [ 'Bounds maximum', summary.bounds_max.join(', ') ]
        ]));
    else
        details.append(table([ 'C++ temperature diagnostic', 'Value' ], [
            [ 'Nodes', summary.count ], [ 'Minimum (°C)', summary.min_temperature_C ],
            [ 'Maximum (°C)', summary.max_temperature_C ],
            [ 'Mean (°C)', summary.mean_temperature_C.toPrecision(7) ]
        ]));
    $('#inspection').textContent =
        kind === 'stl'
            ? `${name}: ${scene.vertices.length / 3} triangles loaded.`
            : `${name}: ${scene.nodes.length} temperature nodes loaded. Click a point to inspect.`;
    fit();
}
['stl', 'csv'].forEach(kind => {
    $('#' + kind + '-file').onchange = async e => {
        const file = e.target.files[0];
        if (!file)
            return;
        status('Validating ' + file.name + ' in C++…');
        try {
            if (file.size > 20 * 1024 * 1024)
                throw Error('File exceeds 20 MiB.');
            await loadGeometry(kind, await file.text(), file.name);
            status('File validated and loaded.');
        } catch (err) {
            status(err.message, true);
        }
    };
    $('#sample-' + kind).onclick = e => task(e.target, 'Loading bundled sample…', async () => {
        const path = kind === 'stl' ? '/sample.stl' : '/temperatures.csv';
        await loadGeometry(kind, await (await fetch(path)).text(),
                           kind === 'stl' ? 'Self-created tetrahedron'
                                          : 'Synthetic temperature example');
    });
});
function showThermal(run) {
    thermal = run;
    $('#convergence-chart').hidden = !studyData;
    const parameters = run.parameters;
    $('#analysis-context').textContent = `Displayed result: L=${parameters.length_m} m · A=${
        parameters.area_m2} m² · k=${parameters.conductivity_W_mK} W/(m K) · q=${
        parameters.heat_generation_W_m3} W/m³ · boundaries ${parameters.left_C} / ${
        parameters.right_C} °C · N=${run.elements}.`;
    renderDiagnostics(run);
    const exact = [];
    for (let i = 0; i < run.nodes.length - 1; i++) {
        exact.push([ run.nodes[i][0], run.nodes[i][2] ],
                   [ run.midpoints[i][0], run.midpoints[i][2] ]);
    }
    exact.push([ run.nodes.at(-1)[0], run.nodes.at(-1)[2] ]);
    plot($('#thermal-chart'),
         [
             {
                 name : 'FEA temperature',
                 color : '#236f9d',
                 points : run.nodes.map(n => n.slice(0, 2))
             },
             {name : 'Analytical temperature', color : '#c16c2c', points : exact}
         ],
         'Position x (m)', 'T (°C)');
    $('#thermal-summary').textContent = `${run.elements} elements · maximum midpoint error ${
        run.midpoint_error_C.toExponential(6)} °C`;
    $('#thermal-export').disabled = false;
}
$('#thermal-form').onsubmit = e => {
    e.preventDefault();
    const button = e.target.querySelector('button'),
          values = [...new FormData(e.target).values() ].join(' ');
    task(button, 'Solving in C++…', async () => {
        const result = await api('thermal', values);
        studyData = null;
        $('#mesh-selector').disabled = true;
        $('#mesh-selector').replaceChildren();
        $('#convergence-export').disabled = true;
        const canvas = $('#convergence-chart');
        canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
        showThermal(result);
    });
};
$('#study')
    .onclick = e => task(e.target, 'Running four meshes and analytical checks…', async () => {
    studyData = await api('study');
    showThermal(studyData.runs.at(-1));
    populateMeshSelector();
    plotStudy();
    $('#thermal-summary')
        .replaceChildren(table(
            [ 'Elements', 'Max midpoint error (°C)', 'Error ratio' ],
            studyData.runs.map(
                (r,
                 i) => [r.elements, r.midpoint_error_C.toExponential(6),
                        i ? (studyData.runs[i - 1].midpoint_error_C / r.midpoint_error_C).toFixed(4)
                          : '—'])));
    plot($('#convergence-chart'), [ {
             name : 'Midpoint error (log scale)',
             color : '#236f9d',
             points : studyData.runs.map(r => [r.elements, r.midpoint_error_C])
         } ],
         'Elements', 'Error (°C)', true);
    $('#convergence-export').disabled = false;
});
$('#thermal-export').onclick = () => download(
    'temperature.csv', 'x_m,FEA_C,exact_C\n' + thermal.nodes.map(n => n.join(',')).join('\n'));
$('#convergence-export').onclick = () =>
    download('convergence.csv',
             'elements,midpoint_max_error_C\n' +
                 studyData.runs.map(r => `${r.elements},${r.midpoint_error_C}`).join('\n'));
$('#benchmark-form').onsubmit = e => {
    e.preventDefault();
    const form = new FormData(e.target);
    task(e.target.querySelector('[type=submit]'),
         'Benchmark running: warm-up and five repetitions per worker count…', async () => {
             const cancel = $('#cancel-benchmark'), progress = $('#benchmark-progress');
             cancel.disabled = true;
             progress.value = 0;
             $('#progress-label').textContent = 'Starting benchmark…';
             let monitoring = true;
             const timer = setInterval(async () => {
                 try {
                     const response = await fetch('/api/progress', {method : 'POST'});
                     const state = await response.json();
                     if (!monitoring)
                         return;
                     cancel.disabled = !state.running || state.cancel_requested;
                     progress.max = Math.max(1, state.total);
                     progress.value = state.completed;
                     $('#progress-label').textContent =
                         `${state.completed.toLocaleString()} / ${
                             state.total.toLocaleString()} solves completed` +
                         (state.cancel_requested ? ' · cancellation requested' : '');
                 } catch {
                     $('#progress-label').textContent = 'Waiting for backend…';
                 }
             }, 250);
             try {
                 performanceData =
                     await api('benchmark', form.get('cases') + ' ' + form.get('elements'));
                 progress.value = progress.max;
                 $('#progress-label').textContent = 'Completed · all repetitions verified';
             } catch (error) {
                 $('#progress-label').textContent =
                     'Stopped. Any earlier completed results remain available.';
                 throw error;
             } finally {
                 monitoring = false;
                 clearInterval(timer);
                 cancel.disabled = true;
             }
             const d = performanceData;
             $('#benchmark-results')
                 .replaceChildren(table(
                     [ 'Workers', 'Median (s)', 'Speedup', 'Efficiency', 'Max difference (°C)' ],
                     d.rows.map(r => [r.workers, r.median_s.toFixed(6), r.speedup.toFixed(3),
                                      r.efficiency.toFixed(3), r.max_difference_C])));
             const p = document.createElement('p');
             p.textContent = `${d.logical_cpus} logical CPUs · ${d.cases} cases × ${
                                 d.elements} elements · agreement threshold ≤ 1e-8 °C. ` +
                             (d.rows.every(r => r.max_difference_C <= 1e-8) ? 'PASS' : 'FAIL');
             $('#benchmark-results').append(p);
             $('#benchmark-export').disabled = false;
         });
};
$('#benchmark-export').onclick = () => download(
    'benchmark.csv',
    'workers,repetition,compute_s,median_s,speedup,efficiency,max_difference_C\n' +
        performanceData.rows
            .flatMap(r => r.samples_s.map((v, i) => [r.workers, i + 1, v, r.median_s, r.speedup,
                                                     r.efficiency, r.max_difference_C]
                                                        .join(',')))
            .join('\n'));
[[ 'microcontroller', 'STM32 Nucleo-F401RE' ], [ 'fpga', 'Digilent Arty A7-35T' ],
 [ 'jtag', 'ST-LINK/V2 debug adapter' ]]
    .forEach(([ id, title ]) => {
        const card = document.createElement('article');
        card.className = 'card';
        const h = document.createElement('h3');
        h.textContent = title;
        card.append(h);
        const state = document.createElement('p');
        state.id = 'device-state-' + id;
        state.textContent = 'Simulated · disconnected';
        card.append(state);
        ['inspect', 'connect', 'telemetry', 'timeout', 'disconnect'].forEach(action => {
            const button = document.createElement('button');
            button.textContent = action;
            button.onclick = () => task(button, 'Running simulated ' + action + '…', async () => {
                const result = await api('hardware', id + ' ' + action);
                state.textContent =
                    'Simulated · ' + (result.connected ? 'connected' : 'disconnected');
                $('#hardware-output').textContent = JSON.stringify(result, null, 2);
                await refreshHardwareEvents();
                if (result.error)
                    status(result.error, true);
            });
            card.append(button);
        });
        $('#device-cards').append(card);
    });
$('#backprop').onclick = e =>
    task(e.target, 'Computing chain-rule gradients and central differences…', async () => {
        backpropData = await api('backprop');
        const b = backpropData;
        $('#backprop-results')
            .replaceChildren(table(
                [ 'Parameter', 'Analytic gradient', 'Finite difference', 'After first update' ],
                [ 'w', 'b', 'v', 'c' ].map(
                    (p, i) => [p, b.gradient[i].toFixed(9), b.numerical[i].toFixed(9),
                               b.updated[i].toFixed(9)])));
        const p = document.createElement('p');
        p.textContent = `Initial h=${b.hidden.toFixed(9)}; prediction=${
            b.prediction.toFixed(9)}; loss=${b.initial_loss.toFixed(9)}. Max gradient error=${
            b.max_gradient_error.toExponential(
                3)} (${b.max_gradient_error <= 1e-5 ? 'PASS' : 'FAIL'}).`;
        $('#backprop-results').append(p);
        plot($('#loss-chart'), [ {
                 name : 'Training loss (log scale)',
                 color : '#236f9d',
                 points :
                     [ [ 0, b.initial_loss ], ...b.loss_after_updates.map((v, i) => [i + 1, v]) ]
             } ],
             'Update', 'Loss', true);
        $('#loss-export').disabled = false;
    });
$('#loss-export').onclick = () => download(
    'loss.csv', 'update,loss\n0,' + backpropData.initial_loss + '\n' +
                    backpropData.loss_after_updates.map((v, i) => `${i + 1},${v}`).join('\n'));

// Additional inspection controls operate on completed C++ result payloads only.
function create(tag, text, id) {
    const e = document.createElement(tag);
    if (text)
        e.textContent = text;
    if (id)
        e.id = id;
    return e;
}
function control(text, id, fn) {
    const b = create('button', text, id);
    b.type = 'button';
    b.onclick = fn;
    return b;
}
function installEnhancedControls() {
    $('#convergence-chart').hidden = true;
    const context = create('p', 'No analysis selected. Run a solver or study.', 'analysis-context');
    context.className = 'note';
    $('#thermal-chart').before(context);
    $('#thermal > p.note:last-child').textContent =
        'Each temperature curve is labelled. Midpoint errors use FE interpolation. Heat flux is positive in the +x direction; outward boundary heat flows include source contributions. Energy imbalance and equation residuals provide independent numerical checks.';
    const geometryDetails = create('div', null, 'geometry-details');
    $('#inspection').after(geometryDetails);
    const thermalBar = $('#study').parentElement;
    thermalBar.append(control('Study current parameters', 'custom-study', e => {
        const form = $('#thermal-form');
        if (!form.reportValidity())
            return;
        task(e.target, 'Running convergence study with current rod parameters…', async () => {
            studyData = await api('custom-study', [...new FormData(form).values() ].join(' '));
            showThermal(studyData.runs.at(-1));
            populateMeshSelector();
            plotStudy();
            $('#thermal-summary')
                .replaceChildren(
                    table([ 'Elements', 'Midpoint error (°C)', 'Observed order' ],
                          studyData.runs.map(
                              (r, i) => [r.elements, r.midpoint_error_C.toExponential(6),
                                         i && r.midpoint_error_C > 1e-12 &&
                                                 studyData.runs[i - 1].midpoint_error_C > 1e-12
                                             ? (Math.log2(studyData.runs[i - 1].midpoint_error_C /
                                                          r.midpoint_error_C))
                                                   .toFixed(4)
                                             : '—'])));
            $('#convergence-export').disabled = false;
            plot($('#convergence-chart'), [ {
                     name : 'Custom midpoint error',
                     color : '#236f9d',
                     points : studyData.runs.map(r => [r.elements, r.midpoint_error_C])
                 } ],
                 'Elements', 'Error (°C)', true);
        });
    }));
    const meshLabel = create('label', 'Inspect mesh');
    const selector = create('select', null, 'mesh-selector');
    selector.disabled = true;
    selector.onchange = () => {
        if (selector.value === 'all') {
            showThermal(studyData.runs.at(-1));
            plotStudy();
        } else
            showThermal(studyData.runs.find(r => r.elements === Number(selector.value)));
    };
    meshLabel.append(selector);
    thermalBar.append(meshLabel);
    const midpoint = control(
        'Export midpoint & flux CSV', 'midpoint-export',
        () => download(
            'midpoint_flux.csv',
            'x_m,FEA_C,exact_C,error_C,heat_flux_W_m2,heat_flow_W\n' +
                thermal.midpoints
                    .map((m, i) => [...m, m[1] - m[2], thermal.flux[i][1], thermal.flux[i][2]].join(
                             ','))
                    .join('\n')));
    midpoint.disabled = true;
    thermalBar.append(midpoint);
    const json = control('Export analysis JSON', 'analysis-export',
                         () => download('thermal_analysis.json',
                                        JSON.stringify({
                                            exported_at : new Date().toISOString(),
                                            selected_result : thermal,
                                            study : studyData
                                        },
                                                       null, 2),
                                        'application/json'));
    json.disabled = true;
    thermalBar.append(json);
    const diagnostics = create('div', null, 'thermal-diagnostics');
    diagnostics.className = 'metric-grid';
    $('#thermal-summary').after(diagnostics);
    const flux = create('canvas', null, 'flux-chart');
    flux.width = 1000;
    flux.height = 300;
    flux.setAttribute('aria-label', 'Heat flux along the rod');
    diagnostics.after(flux);
    const progressBox = create('div', null, 'progress-panel');
    progressBox.className = 'progress-panel';
    const progress = create('progress', null, 'benchmark-progress');
    progress.max = 1;
    progress.value = 0;
    progress.setAttribute('aria-label', 'Benchmark progress');
    const label = create('span', 'Ready to run', 'progress-label');
    label.setAttribute('role', 'status');
    const cancel = control('Cancel benchmark safely', 'cancel-benchmark', async () => {
        try {
            const result = await api('cancel');
            cancel.disabled = true;
            $('#progress-label').textContent =
                result.requested ? 'Cancellation requested; finishing active cases…'
                                 : 'No active benchmark; awaiting completed results.';
        } catch (e) {
            status(e.message, true);
        }
    });
    cancel.disabled = true;
    progressBox.append(progress, label, cancel);
    $('#benchmark-form').after(progressBox);
    const views = create('div');
    views.className = 'toolbar';
    for (const [name, yaw, pitch] of [[ 'Front view', 0, 0 ], [ 'Top view', 0, Math.PI / 2 ],
                                      [ 'Isometric view', .65, -.4 ]])
        views.append(control(name, null, () => {
            scene.yaw = yaw;
            scene.pitch = pitch;
            fit();
        }));
    $('#fit').parentElement.after(views);
    views.append(control('Toggle wireframe', null, () => {
        scene.wireframe = !scene.wireframe;
        drawScene();
    }));
}
function populateMeshSelector() {
    const select = $('#mesh-selector');
    select.replaceChildren();
    for (const value of ['all', ...studyData.runs.map(r => r.elements)]) {
        const option =
            create('option', value === 'all' ? 'Compare all meshes' : String(value) + ' elements');
        option.value = value;
        select.append(option);
    }
    select.disabled = false;
}
function plotStudy() {
    const colors = [ '#236f9d', '#278765', '#8c53a0', '#c16c2c' ];
    const series = studyData.runs.map((r, i) => ({
                                          name : 'FEA · N=' + r.elements,
                                          color : colors[i],
                                          points : r.nodes.map(n => n.slice(0, 2))
                                      }));
    const r = studyData.runs.at(-1), points = [];
    r.nodes.forEach((n, i) => {
        points.push([ n[0], n[2] ]);
        if (r.midpoints[i])
            points.push([ r.midpoints[i][0], r.midpoints[i][2] ]);
    });
    series.push({name : 'Analytical', color : '#202e40', points});
    plot($('#thermal-chart'), series, 'Position x (m)', 'T (°C)');
}
function renderDiagnostics(run) {
    $('#probe-position').max = run.parameters.length_m;
    if (Number($('#probe-position').value) > run.parameters.length_m)
        $('#probe-position').value = run.parameters.length_m / 2;
    $('#probe-result').textContent =
        'Choose a position inside the displayed rod and evaluate the C++ interpolation.';
    $('#evaluate-probe').disabled = false;
    const box = $('#thermal-diagnostics');
    if (!box)
        return;
    const d = run.diagnostics;
    box.replaceChildren();
    for (const [label, value, unit] of [[ 'Left outward heat', d.left_outflow_W, 'W' ],
                                        [ 'Right outward heat', d.right_outflow_W, 'W' ],
                                        [ 'Generated heat', d.generated_heat_W, 'W' ],
                                        [ 'Energy imbalance', d.energy_imbalance_W, 'W' ],
                                        [ 'Max equation residual', d.max_residual_W, 'W' ],
                                        [ 'Max nodal error', d.nodal_error_C, '°C' ]]) {
        const card = create('div');
        card.className = 'metric';
        card.append(create('span', label),
                    create('strong', Math.abs(value) < 1e-5 ? value.toExponential(3) + ' ' + unit
                                                            : value.toPrecision(6) + ' ' + unit));
        box.append(card);
    }
    plot($('#flux-chart'), [ {
             name : 'Element heat flux (+x direction)',
             color : '#278765',
             points : run.flux.map(v => v.slice(0, 2))
         } ],
         'Position x (m)', 'Flux (W/m²)');
    $('#midpoint-export').disabled = false;
    $('#analysis-export').disabled = false;
}
let nodePage = 0, filteredNodes = [], hardwareEventData = null;
function renderNodeExplorer() {
    const section = $('#node-explorer');
    if (!section)
        return;
    section.hidden = !scene.nodes.length;
    if (section.hidden)
        return;
    const query = $('#node-search').value.trim().toLowerCase();
    filteredNodes = scene.nodes.filter(
        n => !query || n.some(value => String(value).toLowerCase().includes(query)));
    const sort = $('#node-sort').value;
    filteredNodes.sort((a, b) => sort === 'temperature' ? b[4] - a[4] : a[0] - b[0]);
    const pages = Math.max(1, Math.ceil(filteredNodes.length / 100));
    nodePage = Math.min(nodePage, pages - 1);
    const visible = filteredNodes.slice(nodePage * 100, nodePage * 100 + 100);
    const grid = table([ 'Node ID', 'x (m)', 'y (m)', 'z (m)', 'Temperature (°C)' ], visible);
    [...grid.tBodies[0].rows].forEach((row, i) => {
        row.tabIndex = 0;
        row.title = 'Select this node in the 3D view';
        const select = () => {
            const n = visible[i];
            scene.selectedNode = n[0];
            $('#inspection').textContent =
                `Node ${n[0]} · x=${n[1]} m, y=${n[2]} m, z=${n[3]} m · ${n[4]} °C`;
            drawScene();
        };
        row.onclick = select;
        row.onkeydown = e => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                select();
            }
        };
    });
    $('#node-table').replaceChildren(grid);
    $('#node-page-status').textContent = `${filteredNodes.length} matching nodes · page ${
        nodePage + 1} of ${pages} · select a row to highlight a node`;
    $('#nodes-prev').disabled = nodePage === 0;
    $('#nodes-next').disabled = nodePage >= pages - 1;
    $('#nodes-export').disabled = !filteredNodes.length;
}
async function refreshHardwareEvents() {
    const response = await fetch('/api/hardware-events', {method : 'POST'});
    if (!response.ok)
        throw Error('Cannot retrieve hardware event log.');
    hardwareEventData = await response.json();
    $('#hardware-event-table')
        .replaceChildren(table([ 'Event', 'Time', 'Device', 'Action', 'Outcome' ],
                               hardwareEventData.events.slice().reverse().map(
                                   e => [e.sequence, new Date(e.epoch_ms).toLocaleTimeString(),
                                         e.device, e.action, e.outcome])));
}
async function discoverHardware() {
    const data = await api('devices');
    for (const d of data.devices) {
        $('#device-state-' + d.device).textContent =
            'Simulated · ' + (d.connected ? 'connected' : 'disconnected');
        let text = $('#device-capabilities-' + d.device);
        if (!text) {
            text = create('p', null, 'device-capabilities-' + d.device);
            text.className = 'note';
            $('#device-state-' + d.device).after(text);
        }
        text.textContent = d.protocol + ' · ' + d.capabilities.join(', ');
    }
    await refreshHardwareEvents();
}
function installExplorationControls() {
    const probeSection = create('section');
    probeSection.className = 'inspection-panel';
    probeSection.append(create('h3', 'Probe the displayed rod'));
    const probeBar = create('div');
    probeBar.className = 'toolbar';
    const label = create('label', 'Position x (m)');
    const position = create('input', null, 'probe-position');
    position.type = 'number';
    position.required = true;
    position.min = 0;
    position.max = 1;
    position.step = 'any';
    position.value = .5;
    label.htmlFor = position.id;
    label.append(position);
    const button = control(
        'Evaluate probe', 'evaluate-probe',
        e => task(e.target, 'Evaluating shape functions in C++…', async () => {
            if (!position.reportValidity())
                throw Error('Enter a probe position between 0 and the displayed rod length.');
            const p = thermal.parameters;
            const values = [
                position.value, p.length_m, p.area_m2, p.conductivity_W_mK, p.heat_generation_W_m3,
                p.left_C, p.right_C, thermal.elements
            ].join(' ');
            const r = await api('probe', values);
            $('#probe-result')
                .replaceChildren(table(
                    [
                        'x (m)', 'FEA (°C)', 'Exact (°C)', 'Abs error (°C)', 'Flux (W/m²)',
                        'Element (1-based)'
                    ],
                    [ [
                        r.x_m, r.FEA_C.toPrecision(9), r.exact_C.toPrecision(9),
                        r.absolute_error_C.toExponential(4), r.heat_flux_W_m2.toPrecision(8),
                        r.element_index + 1
                    ] ]));
        }));
    button.disabled = true;
    probeBar.append(label, button);
    probeSection.append(probeBar, create('div', 'Run a thermal analysis first.', 'probe-result'));
    $('#flux-chart').after(probeSection);
    const section = create('section', null, 'node-explorer');
    section.hidden = true;
    section.className = 'inspection-panel';
    section.append(create('h3', 'Temperature node explorer'));
    const bar = create('div');
    bar.className = 'toolbar';
    const searchLabel = create('label', 'Search node values');
    const search = create('input', null, 'node-search');
    search.type = 'search';
    searchLabel.htmlFor = search.id;
    search.placeholder = 'Node ID, position or temperature';
    search.oninput = () => {
        nodePage = 0;
        renderNodeExplorer();
    };
    searchLabel.append(search);
    const sortLabel = create('label', 'Sort nodes');
    const sort = create('select', null, 'node-sort');
    sortLabel.htmlFor = sort.id;
    for (const [value, name] of [[ 'id', 'Node ID ascending' ],
                                 [ 'temperature', 'Temperature descending' ]]) {
        const option = create('option', name);
        option.value = value;
        sort.append(option);
    }
    sort.onchange = () => {
        nodePage = 0;
        renderNodeExplorer();
    };
    sortLabel.append(sort);
    bar.append(searchLabel, sortLabel,
               control('Export filtered nodes', 'nodes-export',
                       () => download('filtered_nodes.csv',
                                      'node_id,x_m,y_m,z_m,temperature_C\n' +
                                          filteredNodes.map(n => n.join(',')).join('\n'))));
    section.append(bar, create('p', null, 'node-page-status'), create('div', null, 'node-table'));
    const paging = create('div');
    paging.className = 'toolbar';
    paging.append(control('Previous page', 'nodes-prev', () => {
                      nodePage--;
                      renderNodeExplorer();
                  }), control('Next page', 'nodes-next', () => {
                      nodePage++;
                      renderNodeExplorer();
                  }));
    section.append(paging);
    $('#geometry-details').after(section);
    const events = create('section');
    events.className = 'inspection-panel';
    events.append(create('h3', 'Simulated hardware event log'));
    const eventBar = create('div');
    eventBar.className = 'toolbar';
    eventBar.append(
        control('Discover devices', 'discover-devices',
                e => task(e.target, 'Discovering C++ mock adapters…', discoverHardware)),
        control('Refresh event log', 'refresh-events',
                e => task(e.target, 'Loading event log…', refreshHardwareEvents)),
        control('Export event log JSON', 'events-export', () => {
            if (hardwareEventData)
                download('hardware_events.json', JSON.stringify(hardwareEventData, null, 2),
                         'application/json');
        }));
    const historyDetails = create('details');
    historyDetails.append(create('summary', 'Show recent hardware actions'),
                          create('div', null, 'hardware-event-table'));
    events.append(
        eventBar,
        create(
            'p',
            'Last 100 actions from this application session; timestamps are generated in C++. All events and telemetry are simulated.'),
        historyDetails);
    $('#hardware-output').after(events);
    discoverHardware().catch(e => status(e.message, true));
}
installEnhancedControls();
installExplorationControls();
fetch('/api/health')
    .then(r => r.json())
    .then(d => {
        $('#connection').textContent = d.backend + ' · ready';
        status('C++ backend connected. Select a view to begin.');
        drawScene();
    })
    .catch(e => {
        $('#connection').textContent = 'Disconnected';
        status('Backend unavailable: ' + e.message, true);
    });
