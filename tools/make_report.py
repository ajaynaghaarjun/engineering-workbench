"""Generate report and standalone SVG plots from actual saved C++ outputs.

Documentation only: no application calculation or file-import backend is implemented here.
"""
import csv
import json
from pathlib import Path
from datetime import datetime, timezone
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.lib.enums import TA_LEFT
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak
from reportlab.graphics.shapes import Drawing, String, Line, PolyLine, Rect
from reportlab.graphics import renderSVG
from math import log10

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'results/generated'
PLOTS = ROOT / 'results/plots'
PLOTS.mkdir(parents=True, exist_ok=True)
thermal = json.loads((OUT/'thermal.json').read_text())
bench = json.loads((OUT/'benchmark.json').read_text())
back = json.loads((OUT/'backprop.json').read_text())
styles = getSampleStyleSheet()
styles['Normal'].fontSize = 10
styles['Normal'].leading = 14
styles['Normal'].spaceAfter = 8
styles['Heading1'].textColor = colors.HexColor('#173d5a')
styles['Heading2'].textColor = colors.HexColor('#173d5a')
story = []

def p(text):
    story.append(Paragraph(text, styles['Normal']))

def h(text):
    story.append(Paragraph(text, styles['Heading1']))

def table(headers, rows, widths=None):
    data = [[Paragraph(str(x), styles['Normal']) for x in row] for row in [headers]+rows]
    t = Table(data, colWidths=widths, repeatRows=1, hAlign='LEFT')
    t.setStyle(TableStyle([('BACKGROUND',(0,0),(-1,0),colors.HexColor('#e5edf4')),
                          ('VALIGN',(0,0),(-1,-1),'TOP'),
                          ('LINEBELOW',(0,0),(-1,-1),.3,colors.HexColor('#c9d6df')),
                          ('LEFTPADDING',(0,0),(-1,-1),7),('RIGHTPADDING',(0,0),(-1,-1),7)]))
    story.append(t)
    story.append(Spacer(1,12))

def chart(name, series, xlabel, ylabel, log=False, height=230):
    width = 490
    d = Drawing(width,height)
    pts = [p for _,_,data in series for p in data]
    xmin,xmax=min(x for x,y in pts),max(x for x,y in pts)
    trans=lambda y: log10(max(y,1e-22)) if log else y
    ymin,ymax=min(trans(y) for x,y in pts),max(trans(y) for x,y in pts)
    if xmin==xmax: xmax+=1
    if ymin==ymax: ymax+=1
    left,bottom,pw,ph=58,38,width-80,height-74
    px=lambda x:left+(x-xmin)/(xmax-xmin)*pw
    py=lambda y:bottom+(trans(y)-ymin)/(ymax-ymin)*ph
    for i in range(5):
        x=xmin+(xmax-xmin)*i/4
        yy=ymin+(ymax-ymin)*i/4
        y=bottom+ph*i/4
        d.add(Line(left,y,left+pw,y,strokeColor=colors.HexColor('#dfe7ee')))
        d.add(String(2,y-3,f'10^{yy:.1f}' if log else f'{yy:.3g}',fontSize=8))
        d.add(String(px(x)-10,bottom-14,f'{x:.3g}',fontSize=8))
    for i,(label,color,data) in enumerate(series):
        d.add(PolyLine([v for x,y in data for v in (px(x),py(y))],strokeColor=colors.HexColor(color),strokeWidth=1.6))
        d.add(String(65+i*(85 if len(series)>2 else 205),height-12,label,fontSize=8,fillColor=colors.HexColor(color)))
    d.add(String(width/2-45,5,xlabel,fontSize=9))
    d.add(String(2,height-13,ylabel,fontSize=9))
    renderSVG.drawToFile(d,str(PLOTS/(name+'.svg')))
    return d

def page(): story.append(PageBreak())

h('Unified Engineering Workbench')
p('Assessment prototype | C++17 | Windows 11 x64 target | 1 November 2026')
p('<b>Delivery status:</b> a Windows x64 executable has been cross-compiled on Apple Silicon. Mac release builds, numerical tests and HTTP/browser workflows have been exercised. Actual Windows 11 launch is unverified. The candidate handwritten appendix is outstanding. These are explicit limitations, not claimed successes.')
story.append(Paragraph('1. Design and reproducibility',styles['Heading2']))
p('A portable C++ executable serves a bundled browser interface over loopback only. C++ owns numerical work, parsers, benchmarks and hardware mock state. HTML/CSS/JavaScript provide presentation, an orthographic 3D view and plots. No external frontend or solver libraries are needed, and no CDN is used.')
table(['Layer','Implementation'],[['Numerical core','Two-node rod FEA, tridiagonal solve, analytical comparison, explicit backpropagation'],['Input','Strict ASCII STL and five-column nodal CSV parsing in C++'],['Concurrency','Bounded numerical workers; independently bounded HTTP request pool; deterministic result ordering'],['Presentation','Geometry, Thermal, Performance, Hardware and Backpropagation views; validation, status, errors, exports'],['Delivery','CMake source build; Windows Launch.exe; VS Code task; relative runtime asset paths']],[100,390])
p('After ZIP extraction, Launch.exe starts the backend and opens the default browser. The console remains open and closing it stops the app. Runtime data and web paths are resolved relative to the executable, rather than the current working directory. Windows system DLLs are not redistributed; MinGW/GCC runtime code is statically linked.')
p('See README.md for exact build/test commands, data/PROVENANCE.md for input contracts, dependencies.lock.json and LICENSES.md for dependencies, and the Git bundle for actual development history. A typed guide is supplied for the candidate to prepare their own handwritten appendix.')
page()

h('2. Thermal formulation and verification')
p('Assumptions: uniform rod, steady state, constant k and A, uniform volumetric source q, insulated lateral surface, prescribed temperatures at both ends. Defaults: L=1 m, A=1e-4 m², k=10 W/(m K), q=10000 W/m³; T(0)=100 °C and T(L)=20 °C.')
p('For element length h: K_e=(kA/h)[[1,-1],[-1,1]], f_e=(qAh/2)[1,1]. Element contributions are assembled into a tridiagonal system. Prescribed boundary contributions are transferred into the neighbouring right-hand sides before boundary rows are replaced. Thomas elimination/back-substitution solves the system in O(N) time.')
p('T_exact(x)=100-80x/L+[q/(2k)]x(L-x). The FE field is interpolated at each midpoint before computing the maximum absolute error. Checking nodes alone would hide interpolation error for this uniform, constant-source problem.')
rows=[]
for i,r in enumerate(thermal['runs']):
    rows.append([r['elements'],f"{r['midpoint_error_C']:.9f}",'-' if i==0 else f"{thermal['runs'][i-1]['midpoint_error_C']/r['midpoint_error_C']:.6f}"])
table(['Elements','Max midpoint error (°C)','Previous/current'],rows,[90,210,190])
palette=['#236f9d','#1e8260','#8a57a2','#bd6b28']
curves=[(f"FE N={r['elements']}",palette[i],[(n[0],n[1]) for n in r['nodes']]) for i,r in enumerate(thermal['runs'])]
curves.append(('Exact','#263443',[(i/160,100-80*(i/160)+500*(i/160)*(1-i/160)) for i in range(161)]))
story.append(chart('temperature',curves,'Position x (m)','T (°C)',False,150))
story.append(chart('convergence',[('Midpoint error','#236f9d',[(r['elements'],r['midpoint_error_C']) for r in thermal['runs']])],'Elements','Error (°C)',True,150))
p('Observed convergence is second order: halving h reduces error by four. Independent expected midpoint error is |q|h²/(8k). Boundary, zero-source linear, non-default-temperature and invalid-parameter tests supplement analytical agreement. Raw nodal and convergence CSVs are included.')
page()

h('3. Reproducible multicore experiment')
p('Measured on Apple M5, 10 physical / 10 logical CPUs reported by macOS, 16 GiB RAM. Compiler: Apple Clang 21.0.0; CMake Release flags -O3 -DNDEBUG, C++17. These measurements are from the Mac and are not Windows timing claims.')
p(f"Workload: {bench['cases']} independent cases, {bench['elements']} elements each. mt19937 seed {bench['seed']}; explicit integer-to-double mapping produces k in [2,30] and q in [100,20000]. The serial and parallel paths call the identical solver on identical input cases. An atomic index distributes independent cases into fixed output slots.")
p('Protocol: one warm-up per worker count and five timed repetitions; steady_clock wall time; median reported. Timings include thread startup, allocation, solver diagnostics and result storage. Generation, agreement comparison, file loading, rendering and compilation are excluded. Every node is compared outside timing. UI runs also incur optional atomic progress-counter overhead; CLI evidence omits those counters.')
table(['Workers','Median (s)','Speedup','Efficiency','Max diff (°C)'],[[r['workers'],f"{r['median_s']:.6f}",f"{r['speedup']:.3f}",f"{r['efficiency']:.3f}",f"{r['max_difference_C']:.1e}"] for r in bench['rows']],[65,105,100,105,115])
story.append(chart('performance',[('Median compute time','#236f9d',[(r['workers'],r['median_s']) for r in bench['rows']])],'Workers','Time (s)',False,200))
p('All observed serial/parallel differences are zero, below 1e-8 °C. Scaling is affected by allocation, memory bandwidth, worker scheduling and thread startup. Shorter workloads amplify overhead; no minimum speedup is assumed. A single-logical-CPU system can only report its supported path and cannot establish multicore speedup. Raw five-repetition timing CSV is supplied. Launch-to-ready measurements are recorded separately in results/generated/launch_timing.json.')
page()

h('4. Geometry, input validation and tests')
p('ASCII STL is parsed as explicit solid/facet/normal/outer-loop/three-vertex/endloop/endfacet/endsolid records in C++. Binary STL and native CAD solids are outside scope. CSV requires the exact header node_id,x_m,y_m,z_m,temperature_C and five finite numeric fields, with unique non-negative integer IDs.')
p('The self-created tetrahedron has four triangles; its intended units are metres because STL itself has no unit metadata. The supplied temperature CSV has ten synthetic nodes following the analytical rod profile. It is labelled synthetic and is not presented as an actual ANSYS export. No mesh-to-result registration is performed.')
p('The custom orthographic renderer supports rotation, pan, zoom and fit. Triangles are depth-sorted; temperature points have a colour legend, coordinate units and clickable ID/location/temperature inspection. It is a small software renderer rather than a CAD engine.')
table(['Validation area','Evidence'],[['Numerical','Boundary conditions, analytical nodal agreement, midpoint error formula, convergence ratios, zero-source linear case'],['Negative imports','Empty input, no triangles/nodes, malformed structures, wrong fields, non-finite values, duplicate IDs and trailing numeric garbage'],['Input limits','20 MiB per file; 10000 triangles or nodes; coordinate magnitude limits; tested boundary and oversize cases'],['Concurrency','Five repetitions, serial/parallel agreement across all nodal values, deterministic case order'],['Integration','Health, custom/default solves, imports, invalid inputs, benchmark, three mock recovery sequences, gradients, traversal and cross-origin rejection']],[105,385])
p('Version 1.1 adds live benchmark progress and safe cancellation between cases, tested with responsive health requests and a successful restart. Partial cancelled results are discarded. Thermal diagnostics expose boundary heat flows, source total, energy imbalance, equation residual and heat flux. Custom-parameter studies, all-mesh overlay, mesh selection and midpoint/flux/JSON exports improve inspection. Core and API evidence is in the actual logs.')
p('Review fixes included preserving timeout messages, removing argument-spread extrema on large plots, bounding HTTP concurrency and replacing implementation-dependent random distributions. Windows runtime validation remains pending; an executable import-table check is not substituted for a real launch test.')
page()

h('5. Embedded design and recovery')
p('Three distinct C++ mock adapters represent an STM32 NUCLEO-F401RE, Digilent Arty A7-35T and genuine ST-LINK/V2 JTAG/SWD adapter. All behaviour is labelled simulated. Each provides discovery/inspection, capabilities, connect/disconnect and one deterministic telemetry message. Timeout disconnects the mock; reconnect restores service. HTTP tests exercise this for all three types.')
diagram=Drawing(490,125)
for x,label in [(0,'NUCLEO / MCU'),(170,'Arty / FPGA'),(340,'ST-LINK / debug')]:
    diagram.add(Rect(x,10,150,34,strokeColor=colors.HexColor('#236f9d'),fillColor=colors.HexColor('#edf4f8')))
    diagram.add(String(x+10,23,label,fontSize=10))
    diagram.add(Line(245,94,x+75,44,strokeColor=colors.HexColor('#236f9d')))
diagram.add(Rect(140,94,210,26,strokeColor=colors.HexColor('#236f9d'),fillColor=colors.HexColor('#edf4f8')))
diagram.add(String(155,103,'Host PC / powered USB hub',fontSize=10))
story.append(diagram)
table(['Link','Electrical/interface assumption'],[['Nucleo CN1 USB','USB power and onboard VCP bridge; MCU domain 3.3 V; USART2 PA2/PA3 routing checked per revision'],['Arty J10 USB','Onboard USB UART/JTAG; board-specific interface; FPGA UART firmware/logic is not supplied'],['ST-LINK CN3 to STM32','VAPP pin 1 senses target 3.3 V; GND pin 4; SWDIO pin 7; SWCLK pin 9; NRST pin 15; pin 19 not used for target power'],['Signal ownership','Probe drives clock/control; target drives TDO in JTAG mode; SWDIO is bidirectional. One debug master per target.']],[105,385])
p('ST-LINK is a debug bridge, not an interchangeable compute board. This design uses its SWD mode for the STM32. Arty retains its own supported debug bridge. Isolate the onboard STM32 debug master before attaching an external probe, verify target-side pin access, share ground, sense Vref and prevent power back-feed. Use level translation when domains differ. No physical wiring or programming was performed.')
p('Vendor sources: ST UM1724 (Nucleo connectors), ST UM1075 Table 4 (ST-LINK pinout), Digilent Arty A7 E.2 schematic and Digilent-authored reference manual. Exact links, interface table, assumptions and safe integration sequence are in docs/EMBEDDED_DESIGN.md.')
page()

h('6. Backpropagation, learning and limitations')
p('For x=1, y=2, w=0.5, b=0, v=1, c=0: z=wx+b; h=tanh(z); prediction=vh+c; J=0.5(prediction-y)². Initial hidden output is 0.462117157260 and loss is 1.182541818997. With e=prediction-y, gradients are e*v*(1-h²)*x, e*v*(1-h²), e*h and e for w,b,v,c respectively.')
table(['Parameter','Initial gradient','First simultaneous update'],[[name,f"{back['gradient'][i]:.9f}",f"{back['updated'][i]:.9f}"] for i,name in enumerate(['w','b','v','c'])],[95,195,200])
p(f"Central finite differences use epsilon=1e-6. Maximum gradient discrepancy is {back['max_gradient_error']:.3e}, below 1e-5. All updates use gradients from the same parameter state. Initial negative gradients increase the parameters and raise an underprediction locally. The first updated loss is {back['loss_after_updates'][0]:.9f}; 100 subsequent steps reduce it to {back['loss_after_updates'][-1]:.3e}.")
story.append(chart('loss',[('Training loss','#236f9d',[(0,back['initial_loss'])]+list(enumerate(back['loss_after_updates'],1)))],'Update','Loss',True,170))
p('<b>Learning insight:</b> exact nodal temperatures do not prove an exact FE field; midpoint interpolation reveals error. Likewise numerical gradients independently check the chain rule, and parallel results require full-array comparison. Fitting one sample does not establish generalisation.')
p('<b>AI and ownership:</b> substantial AI-generated code and documentation are disclosed. The candidate must review, understand and defend them. AI suggestions were corrected and tested; logs identify real examples. Actual personal effort and handwritten work are not fabricated. Outstanding items are actual Windows testing, candidate ID naming, handwritten appendix and candidate confirmation before upload.')

def footer(canvas,doc):
    canvas.setFont('Helvetica',8);canvas.setFillColor(colors.HexColor('#65788a'))
    canvas.drawString(42,25,'Unified Engineering Workbench | assessment prototype | 1 November 2026')
    canvas.drawRightString(553,25,str(doc.page))

SimpleDocTemplate(str(ROOT/'docs/Report.pdf'),pagesize=(595.28,841.89),rightMargin=45,leftMargin=45,topMargin=40,bottomMargin=40).build(story,onFirstPage=footer,onLaterPages=footer)
print('Created docs/Report.pdf and four standalone SVG plots from saved C++ evidence.')
