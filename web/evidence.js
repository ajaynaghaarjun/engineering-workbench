'use strict';
// Evidence navigation and explanations are presentation; the checks execute in C++.
(() => {
    let latest = null;
    const view = create('section', null, 'evidence');
    view.className = 'view';
    view.hidden = true;
    const intro = create('div');
    intro.className = 'intro';
    intro.append(
        create('h2', 'Verification & evidence'),
        create(
            'p',
            'Run the numerical checks again, inspect the evidence behind the rubric, and track the remaining submission gates.'));
    view.append(intro);
    const toolbar = create('div');
    toolbar.className = 'toolbar';
    toolbar.append(control(
        'Run C++ verification', 'run-verification',
        e => task(e.target, 'Running independent numerical checks in C++…', async () => {
            latest = await api('verify');
            $('#verification-environment').textContent =
                `C++ build target: ${latest.platform} / ${latest.architecture} · ${
                    latest.logical_cpus} logical CPUs · version ${latest.version}.`;
            $('#verification-results')
                .replaceChildren(
                    table([ 'Check', 'Result', 'Measured error', 'Tolerance', 'Why it matters' ],
                          latest.checks.map(
                              c => [c.name, c.passed ? 'PASS' : 'FAIL', c.error.toExponential(4),
                                    c.tolerance.toExponential(1), c.explanation])));
            $('#verification-scope').textContent = latest.scope;
            $('#verification-export').disabled = false;
            if (!latest.all_passed)
                status('One or more numerical checks failed. Inspect the results before exporting.',
                       true);
        })));
    const exportButton = control('Export verification JSON', 'verification-export', () => {
        download('verification.json',
                 JSON.stringify({captured_at : new Date().toISOString(), ...latest}, null, 2),
                 'application/json');
    });
    exportButton.disabled = true;
    toolbar.append(exportButton);
    view.append(toolbar);
    view.append(
        create('p', 'Run the checks to identify this process and see measured numerical errors.',
               'verification-environment'),
        create(
            'p',
            'These checks cover selected numerical properties. They are not a company grade or proof of clean-machine Windows delivery.',
            'verification-scope'),
        create('div', null, 'verification-results'));
    view.append(create('h3', 'Submission gates that still need your evidence'));
    view.append(table([ 'Gate', 'Current evidence', 'Required action' ], [
        [
            'Windows standalone launch', 'Windows x64 cross-build; Mac runtime verified',
            'Extract on Windows 11 x64 and record a real launch/workflow check.'
        ],
        [
            'Handwritten backpropagation', 'Typed verified guide and C++ gradient/loss results',
            'Write and scan your own derivation, maximum two pages.'
        ],
        [
            'Candidate understanding', 'Explanations, source and defence guide supplied',
            'Reproduce a test and explain the implementation in your own words.'
        ],
        [
            'Final identity and delivery', 'Portable ZIP, hashes, Git bundle and report prepared',
            'Use your actual Candidate ID, confirm personal effort/ownership and upload before the deadline.'
        ]
    ]));
    view.append(create('h3', 'Rubric evidence map'));
    view.append(table([ 'Criterion', 'Max points', 'Evidence and review focus' ], [
        [
            'Interface / webpage design', 8,
            'Five engineering views plus evidence view; input validation, progress, cancellation, exports.'
        ],
        [
            'C++ backend and testing', 12,
            'Core, mock registry and verification modules; core/API tests and sanitizer logs.'
        ],
        [
            'Folder architecture', 6,
            'Source, web, tests, data, results, docs, licences and CMake configuration.'
        ],
        [
            'Code readability', 6,
            'Formatted C++; clear data structures; larger transport/frontend files remain a maintenance limitation.'
        ],
        [
            'Version control', 5,
            'Meaningful local commits, readable log and verified Git bundle; history was not backdated.'
        ],
        [
            'Thermal FEA and adoption', 14,
            'Assembly, prescribed boundaries, midpoint errors, convergence, energy/residual checks and explanations.'
        ],
        [
            'CAD / ANSYS visualization', 10,
            'Both C++ imports, 3D interaction, temperature legend/units, node inspection and negative tests.'
        ],
        [
            'Multicore performance', 10,
            'Real parallel solves, fixed input generation, five-run medians, agreement and limitations.'
        ],
        [
            'Embedded integration', 8,
            'Referenced design/pin assumptions, three distinct mocks, failure recovery and event history.'
        ],
        [
            'Backpropagation', 7,
            'C++ explicit gradients, finite differences and loss plot; handwritten portion remains outstanding.'
        ],
        [
            'Prompt engineering / AI judgement', 8,
            'AI-use log, actual corrected suggestions, independent checks and ownership disclosure.'
        ],
        [
            'One-click delivery / report', 6,
            'Portable x64 executable, editor task, six-page report, walkthrough, hashes; Windows runtime still unverified.'
        ]
    ]));
    const links = create('div');
    links.className = 'toolbar';
    for (const [label, href] of [
             [ 'Read full rubric review', '/docs/RUBRIC_REVIEW.md' ],
             [ 'Open six-page report', '/docs/Report.pdf' ],
             [ 'Windows acceptance steps', '/docs/WINDOWS_ACCEPTANCE.md' ],
             [ 'Prepare for the verification discussion', '/docs/DEFENCE_GUIDE.md' ]]) {
        const a = create('a', label);
        a.href = href;
        a.target = '_blank';
        a.rel = 'noopener';
        links.append(a);
    }
    view.append(links);
    $('main').append(view);
    const button = create('button', 'Verification & evidence');
    button.dataset.tab = 'evidence';
    button.onclick = () => {
        document.querySelectorAll('.view').forEach(v => v.hidden = v.id !== 'evidence');
        document.querySelectorAll('[data-tab]')
            .forEach(b => b.classList.toggle('active', b === button));
    };
    $('nav').append(button);
})();
