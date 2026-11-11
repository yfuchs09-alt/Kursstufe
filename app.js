/* ==========================================================================
   KETTENREGEL LAB - APPLICATION LOGIC
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {

    // Helper: Safe KaTeX Rendering
    function renderMathIn(element) {
        if (window.renderMathInElement) {
            window.renderMathInElement(element || document.body, {
                delimiters: [
                    {left: '$$', right: '$$', display: true},
                    {left: '$', right: '$', display: false}
                ],
                throwOnError: false
            });
        }
    }

    // Initial Math Render
    setTimeout(() => renderMathIn(document.body), 100);

    /* ==========================================================================
       1. NAVIGATION & TAB SWITCHING
       ========================================================================== */
    const tabButtons = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');

    tabButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const targetTab = btn.getAttribute('data-tab');

            tabButtons.forEach(b => b.classList.remove('active'));
            tabContents.forEach(c => c.classList.remove('active'));

            btn.classList.add('active');
            const targetContent = document.getElementById(`tab-${targetTab}`);
            if (targetContent) {
                targetContent.classList.add('active');
                renderMathIn(targetContent);
            }

            // Trigger canvas resize if switching to lab tab
            if (targetTab === 'lab') {
                setTimeout(resizeAndDrawLabCanvas, 50);
            }
        });
    });

    /* ==========================================================================
       2. TAB 1: MASCHINEN MODELL LOGIC
       ========================================================================== */
    const presets = {
        preset1: {
            texF: "f(x) = 2x + 1",
            texG: "g(u) = u^3",
            texH: "h(x) = (2x + 1)^3",
            f: x => 2 * x + 1,
            df: x => 2,
            g: u => Math.pow(u, 3),
            dg: u => 3 * Math.pow(u, 2),
            fName: "2x + 1",
            gName: "u³"
        },
        preset2: {
            texF: "f(x) = x^2",
            texG: "g(u) = \\sin(u)",
            texH: "h(x) = \\sin(x^2)",
            f: x => x * x,
            df: x => 2 * x,
            g: u => Math.sin(u),
            dg: u => Math.cos(u),
            fName: "x²",
            gName: "\\sin(u)"
        },
        preset3: {
            texF: "f(x) = 3x",
            texG: "g(u) = e^u",
            texH: "h(x) = e^{3x}",
            f: x => 3 * x,
            df: x => 3,
            g: u => Math.exp(Math.min(u, 8)), // clamp to avoid Infinity
            dg: u => Math.exp(Math.min(u, 8)),
            fName: "3x",
            gName: "e^u"
        },
        preset4: {
            texF: "f(x) = x^2 + 1",
            texG: "g(u) = \\ln(u)",
            texH: "h(x) = \\ln(x^2 + 1)",
            f: x => x * x + 1,
            df: x => 2 * x,
            g: u => Math.log(Math.max(u, 0.001)),
            dg: u => 1 / Math.max(u, 0.001),
            fName: "x² + 1",
            gName: "\\ln(u)"
        }
    };

    let activePresetKey = 'preset1';
    const sliderX0 = document.getElementById('machine-x-slider');
    const sliderDx = document.getElementById('machine-dx-slider');

    // Preset button click
    const presetBtns = document.querySelectorAll('.preset-btn');
    presetBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            presetBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            activePresetKey = btn.getAttribute('data-preset');
            updateMachineView();
        });
    });

    sliderX0.addEventListener('input', updateMachineView);
    sliderDx.addEventListener('input', updateMachineView);

    function updateMachineView() {
        const p = presets[activePresetKey];
        const x0 = parseFloat(sliderX0.value);
        const dx = parseFloat(sliderDx.value);

        // Calculate values
        const u0 = p.f(x0);
        const y0 = p.g(u0);
        const dfVal = p.df(x0);
        const dgVal = p.dg(u0);
        const dhVal = dgVal * dfVal;

        const duApprox = dfVal * dx;
        const dyApprox = dhVal * dx;

        // UI text updates
        document.getElementById('val-x0').textContent = x0.toFixed(2);
        document.getElementById('val-dx').textContent = (dx >= 0 ? '+' : '') + dx.toFixed(2);

        document.getElementById('m-val-x').textContent = x0.toFixed(2);
        document.getElementById('m-delta-x').textContent = `+${dx.toFixed(2)} (Δx)`;

        document.getElementById('m-fn-f').innerHTML = `$$${p.texF}$$`;
        document.getElementById('m-val-u').textContent = u0.toFixed(2);
        document.getElementById('m-slope-f').textContent = dfVal.toFixed(2);
        document.getElementById('m-delta-u').textContent = `${duApprox >= 0 ? '+' : ''}${duApprox.toFixed(2)} (Δu ≈ f'·Δx)`;

        document.getElementById('m-fn-g').innerHTML = `$$${p.texG}$$`;
        document.getElementById('m-val-y').textContent = y0.toFixed(2);
        document.getElementById('m-slope-g').textContent = dgVal.toFixed(2);
        document.getElementById('m-delta-y').textContent = `${dyApprox >= 0 ? '+' : ''}${dyApprox.toFixed(2)} (Δy ≈ g'·Δu)`;

        const numFormulaEl = document.getElementById('m-formula-numeric');
        numFormulaEl.innerHTML = `$$h'(${x0.toFixed(2)}) = ${dgVal.toFixed(2)} \\cdot ${dfVal.toFixed(2)} = \\mathbf{${dhVal.toFixed(2)}}$$`;

        const calloutEl = document.getElementById('m-callout-text');
        calloutEl.innerHTML = `
            Wenn du $x$ um <strong>${dx.toFixed(2)}</strong> vergrößerst, verändert sich $u$ um das <strong>${dfVal.toFixed(2)}</strong>-fache (also ${duApprox >= 0 ? '+' : ''}${duApprox.toFixed(2)}).
            Dieses neue $u$ verändert $y$ wiederum um das <strong>${dgVal.toFixed(2)}</strong>-fache von $\\Delta u$ (also ${dyApprox >= 0 ? '+' : ''}${dyApprox.toFixed(2)}).<br>
            Insgesamt ändert sich $y$ um das $( ${dgVal.toFixed(2)} \\times ${dfVal.toFixed(2)} ) = \\mathbf{${dhVal.toFixed(2)}}$-fache der ursprünglichen Änderung $\\Delta x$!
        `;

        const machineCard = document.querySelector('.machine-summary');
        renderMathIn(machineCard);
        renderMathIn(document.querySelector('.machine-visual'));
    }

    updateMachineView();

    /* ==========================================================================
       3. TAB 2: INTERAKTIVER GRAPH & LAB CANVAS
       ========================================================================== */
    const labPresetSelect = document.getElementById('lab-select-preset');
    const labXSlider = document.getElementById('lab-x-slider');
    const toggleTangents = document.getElementById('toggle-tangents');
    const toggleComponents = document.getElementById('toggle-components');

    const labPresets = {
        p1: {
            texF: "f(x) = 2x - 1",
            texG: "g(u) = u^3",
            texH: "h(x) = (2x - 1)^3",
            f: x => 2 * x - 1,
            df: x => 2,
            g: u => Math.pow(u, 3),
            dg: u => 3 * Math.pow(u, 2),
            rangeX: [-2.5, 2.5], rangeY: [-8, 8]
        },
        p2: {
            texF: "f(x) = x^2",
            texG: "g(u) = \\sin(u)",
            texH: "h(x) = \\sin(x^2)",
            f: x => x * x,
            df: x => 2 * x,
            g: u => Math.sin(u),
            dg: u => Math.cos(u),
            rangeX: [-3, 3], rangeY: [-2.5, 3]
        },
        p3: {
            texF: "f(x) = -x^2",
            texG: "g(u) = e^u",
            texH: "h(x) = e^{-x^2}",
            f: x => -x * x,
            df: x => -2 * x,
            g: u => Math.exp(Math.max(u, -6)),
            dg: u => Math.exp(Math.max(u, -6)),
            rangeX: [-3, 3], rangeY: [-1.5, 2.5]
        },
        p4: {
            texF: "f(x) = x^2 + 1",
            texG: "g(u) = \\ln(u)",
            texH: "h(x) = \\ln(x^2 + 1)",
            f: x => x * x + 1,
            df: x => 2 * x,
            g: u => Math.log(Math.max(u, 0.01)),
            dg: u => 1 / Math.max(u, 0.01),
            rangeX: [-3, 3], rangeY: [-1.5, 3.5]
        },
        p5: {
            texF: "f(x) = 2x",
            texG: "g(u) = \\cos(u)",
            texH: "h(x) = \\cos(2x)",
            f: x => 2 * x,
            df: x => 2,
            g: u => Math.cos(u),
            dg: u => -Math.sin(u),
            rangeX: [-3.14, 3.14], rangeY: [-2.5, 2.5]
        },
        p6: {
            texF: "f(x) = x^2 + 2",
            texG: "g(u) = \\sqrt{u}",
            texH: "h(x) = \\sqrt{x^2 + 2}",
            f: x => x * x + 2,
            df: x => 2 * x,
            g: u => Math.sqrt(Math.max(u, 0)),
            dg: u => 0.5 / Math.sqrt(Math.max(u, 0.01)),
            rangeX: [-3.5, 3.5], rangeY: [-1, 4.5]
        }
    };

    let activeLabKey = 'p2';
    const canvas = document.getElementById('lab-canvas');
    const ctx = canvas.getContext('2d');
    const tooltip = document.getElementById('canvas-tooltip');

    function updateLabSidebar() {
        const p = labPresets[activeLabKey];

        document.getElementById('lab-tex-f').innerHTML = `$$${p.texF}$$`;
        document.getElementById('lab-tex-g').innerHTML = `$$${p.texG}$$`;
        document.getElementById('lab-tex-h').innerHTML = `$$${p.texH}$$`;

        const x0 = parseFloat(labXSlider.value);
        const u0 = p.f(x0);
        const dfVal = p.df(x0);
        const dgVal = p.dg(u0);
        const dhVal = dgVal * dfVal;

        document.getElementById('lab-val-x0').textContent = x0.toFixed(2);
        document.getElementById('t-pt-f').textContent = `x = ${x0.toFixed(2)}`;
        document.getElementById('t-sl-f').textContent = dfVal.toFixed(2);

        document.getElementById('t-pt-g').textContent = `u = ${u0.toFixed(2)}`;
        document.getElementById('t-sl-g').textContent = dgVal.toFixed(2);

        document.getElementById('t-pt-h').textContent = `x = ${x0.toFixed(2)}`;
        document.getElementById('t-sl-h').textContent = `${dgVal.toFixed(2)} × ${dfVal.toFixed(2)} = ${dhVal.toFixed(2)}`;

        renderMathIn(document.querySelector('.lab-sidebar'));
    }

    labPresetSelect.addEventListener('change', (e) => {
        activeLabKey = e.target.value;
        updateLabSidebar();
        drawLabCanvas();
    });

    labXSlider.addEventListener('input', () => {
        updateLabSidebar();
        drawLabCanvas();
    });

    toggleTangents.addEventListener('change', drawLabCanvas);
    toggleComponents.addEventListener('change', drawLabCanvas);

    function resizeAndDrawLabCanvas() {
        if (!canvas) return;
        const rect = canvas.parentElement.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;
        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;
        ctx.scale(dpr, dpr);
        drawLabCanvas();
    }

    window.addEventListener('resize', resizeAndDrawLabCanvas);

    function drawLabCanvas() {
        if (!canvas) return;
        const width = canvas.width / (window.devicePixelRatio || 1);
        const height = canvas.height / (window.devicePixelRatio || 1);

        ctx.clearRect(0, 0, width, height);

        const p = labPresets[activeLabKey];
        const minX = p.rangeX[0], maxX = p.rangeX[1];
        const minY = p.rangeY[0], maxY = p.rangeY[1];

        // Coordinate transforms
        const toScreenX = x => ((x - minX) / (maxX - minX)) * width;
        const toScreenY = y => height - ((y - minY) / (maxY - minY)) * height;

        // Draw Grid
        ctx.strokeStyle = '#e0f2fe';
        ctx.lineWidth = 1;
        ctx.beginPath();

        for (let x = Math.ceil(minX); x <= Math.floor(maxX); x++) {
            const sx = toScreenX(x);
            ctx.moveTo(sx, 0); ctx.lineTo(sx, height);
        }
        for (let y = Math.ceil(minY); y <= Math.floor(maxY); y++) {
            const sy = toScreenY(y);
            ctx.moveTo(0, sy); ctx.lineTo(width, sy);
        }
        ctx.stroke();

        // Draw Axes
        ctx.strokeStyle = '#0f172a';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        // X axis
        const zeroY = toScreenY(0);
        ctx.moveTo(0, zeroY); ctx.lineTo(width, zeroY);
        // Y axis
        const zeroX = toScreenX(0);
        ctx.moveTo(zeroX, 0); ctx.lineTo(zeroX, height);
        ctx.stroke();

        // Helper: Plot Function
        function plotCurve(fn, color, lineWidth = 2.5) {
            ctx.strokeStyle = color;
            ctx.lineWidth = lineWidth;
            ctx.beginPath();
            let started = false;
            const steps = width;
            for (let i = 0; i <= steps; i++) {
                const x = minX + (i / steps) * (maxX - minX);
                const y = fn(x);
                if (isNaN(y) || !isFinite(y)) { started = false; continue; }
                const sx = toScreenX(x);
                const sy = toScreenY(y);
                if (!started) { ctx.moveTo(sx, sy); started = true; }
                else { ctx.lineTo(sx, sy); }
            }
            ctx.stroke();
        }

        const showComponents = toggleComponents.checked;
        const showTangents = toggleTangents.checked;

        // Plot Curves
        if (showComponents) {
            plotCurve(p.f, '#38bdf8', 2); // f(x) sky blue
            plotCurve(p.g, '#0f172a', 2); // g(u) dark slate
        }

        // Composite Function h(x) = g(f(x))
        const hFn = x => p.g(p.f(x));
        plotCurve(hFn, '#0284c7', 3.5); // h(x) bold blue

        // Draw Inspection Point & Tangents
        const x0 = parseFloat(labXSlider.value);
        const u0 = p.f(x0);
        const y0 = hFn(x0);

        const dfVal = p.df(x0);
        const dgVal = p.dg(u0);
        const dhVal = dgVal * dfVal;

        // Tangent Helper
        function drawTangentLine(px, py, slope, color) {
            if (isNaN(slope) || !isFinite(slope)) return;
            const delta = 1.5;
            const x1 = px - delta, y1 = py - slope * delta;
            const x2 = px + delta, y2 = py + slope * delta;

            ctx.strokeStyle = color;
            ctx.lineWidth = 1.5;
            ctx.setLineDash([5, 4]);
            ctx.beginPath();
            ctx.moveTo(toScreenX(x1), toScreenY(y1));
            ctx.lineTo(toScreenX(x2), toScreenY(y2));
            ctx.stroke();
            ctx.setLineDash([]);
        }

        if (showTangents) {
            if (showComponents) {
                drawTangentLine(x0, p.f(x0), dfVal, '#38bdf8');
                drawTangentLine(u0, p.g(u0), dgVal, '#0f172a');
            }
            drawTangentLine(x0, y0, dhVal, '#0284c7');
        }

        // Highlight Points
        function drawPoint(px, py, color, radius = 5) {
            const sx = toScreenX(px);
            const sy = toScreenY(py);
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.arc(sx, sy, radius, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 2;
            ctx.stroke();
        }

        if (showComponents) {
            drawPoint(x0, p.f(x0), '#38bdf8');
            drawPoint(u0, p.g(u0), '#0f172a');
        }
        drawPoint(x0, y0, '#0284c7', 7);
    }

    // Canvas Interactive Hover / Dragging
    let isDraggingCanvas = false;

    function handleCanvasPointer(e) {
        const rect = canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const width = rect.width;

        const p = labPresets[activeLabKey];
        const minX = p.rangeX[0], maxX = p.rangeX[1];
        let calcX = minX + (mouseX / width) * (maxX - minX);
        calcX = Math.max(minX, Math.min(maxX, calcX));

        labXSlider.value = calcX.toFixed(2);
        updateLabSidebar();
        drawLabCanvas();
    }

    canvas.addEventListener('mousedown', (e) => {
        isDraggingCanvas = true;
        handleCanvasPointer(e);
    });

    canvas.addEventListener('mousemove', (e) => {
        if (isDraggingCanvas) handleCanvasPointer(e);
    });

    window.addEventListener('mouseup', () => { isDraggingCanvas = false; });

    // Initial load for Tab 2
    updateLabSidebar();

    /* ==========================================================================
       4. TAB 3: KETTENREGEL CHALLENGE MINI-GAME
       ========================================================================== */
    const gameQuestions = [
        {
            level: 1,
            targetTex: "h(x) = (3x^2 + 5)^4",
            step1: {
                question: "Innere Funktion f(x) und äußere Funktion g(u)?",
                options: [
                    { text: "f(x) = 3x² + 5,  g(u) = u⁴", correct: true },
                    { text: "f(x) = x⁴,  g(u) = 3u² + 5", correct: false },
                    { text: "f(x) = 3x²,  g(u) = (u + 5)⁴", correct: false }
                ]
            },
            step2: {
                question: "Ableitungen f'(x) und g'(u)?",
                options: [
                    { text: "f'(x) = 6x,  g'(u) = 4u³", correct: true },
                    { text: "f'(x) = 3x,  g'(u) = 4u⁴", correct: false },
                    { text: "f'(x) = 6x + 5,  g'(u) = u³", correct: false }
                ]
            },
            step3: {
                question: "Gesamte Ableitung h'(x) = g'(f(x)) · f'(x)?",
                options: [
                    { text: "h'(x) = 4(3x² + 5)³ · 6x = 24x(3x² + 5)³", correct: true },
                    { text: "h'(x) = 24(3x² + 5)³", correct: false },
                    { text: "h'(x) = 4(6x)³", correct: false }
                ]
            }
        },
        {
            level: 2,
            targetTex: "h(x) = \\sin(4x - 2)",
            step1: {
                question: "Innere Funktion f(x) und äußere Funktion g(u)?",
                options: [
                    { text: "f(x) = 4x - 2,  g(u) = \\sin(u)", correct: true },
                    { text: "f(x) = \\sin(x),  g(u) = 4u - 2", correct: false },
                    { text: "f(x) = 4x,  g(u) = \\sin(u - 2)", correct: false }
                ]
            },
            step2: {
                question: "Ableitungen f'(x) und g'(u)?",
                options: [
                    { text: "f'(x) = 4,  g'(u) = \\cos(u)", correct: true },
                    { text: "f'(x) = 4,  g'(u) = -\\cos(u)", correct: false },
                    { text: "f'(x) = 1,  g'(u) = \\cos(4u)", correct: false }
                ]
            },
            step3: {
                question: "Gesamte Ableitung h'(x)?",
                options: [
                    { text: "h'(x) = \\cos(4x - 2) · 4 = 4\\cos(4x - 2)", correct: true },
                    { text: "h'(x) = \\cos(4x - 2)", correct: false },
                    { text: "h'(x) = -4\\sin(4x - 2)", correct: false }
                ]
            }
        },
        {
            level: 3,
            targetTex: "h(x) = e^{-x^3}",
            step1: {
                question: "Innere Funktion f(x) und äußere Funktion g(u)?",
                options: [
                    { text: "f(x) = -x³,  g(u) = e^u", correct: true },
                    { text: "f(x) = e^x,  g(u) = -u³", correct: false },
                    { text: "f(x) = x³,  g(u) = e^{-u}", correct: false }
                ]
            },
            step2: {
                question: "Ableitungen f'(x) und g'(u)?",
                options: [
                    { text: "f'(x) = -3x²,  g'(u) = e^u", correct: true },
                    { text: "f'(x) = -x²,  g'(u) = e^u", correct: false },
                    { text: "f'(x) = -3x²,  g'(u) = u e^{u-1}", correct: false }
                ]
            },
            step3: {
                question: "Gesamte Ableitung h'(x)?",
                options: [
                    { text: "h'(x) = e^{-x^3} · (-3x²) = -3x² e^{-x^3}", correct: true },
                    { text: "h'(x) = -3x² e^{-3x²}", correct: false },
                    { text: "h'(x) = e^{-3x²}", correct: false }
                ]
            }
        },
        {
            level: 4,
            targetTex: "h(x) = \\ln(x^2 + 4)",
            step1: {
                question: "Innere Funktion f(x) und äußere Funktion g(u)?",
                options: [
                    { text: "f(x) = x² + 4,  g(u) = \\ln(u)", correct: true },
                    { text: "f(x) = \\ln(x),  g(u) = u² + 4", correct: false },
                    { text: "f(x) = x²,  g(u) = \\ln(u + 4)", correct: false }
                ]
            },
            step2: {
                question: "Ableitungen f'(x) und g'(u)?",
                options: [
                    { text: "f'(x) = 2x,  g'(u) = \\frac{1}{u}", correct: true },
                    { text: "f'(x) = 2x + 4,  g'(u) = \\frac{1}{u}", correct: false },
                    { text: "f'(x) = x,  g'(u) = e^u", correct: false }
                ]
            },
            step3: {
                question: "Gesamte Ableitung h'(x)?",
                options: [
                    { text: "h'(x) = \\frac{1}{x^2 + 4} · 2x = \\frac{2x}{x^2 + 4}", correct: true },
                    { text: "h'(x) = \\frac{2x}{2x + 4}", correct: false },
                    { text: "h'(x) = \\frac{1}{2x}", correct: false }
                ]
            }
        },
        {
            level: 5,
            targetTex: "h(x) = \\sqrt{5x^2 + 1}",
            step1: {
                question: "Innere Funktion f(x) und äußere Funktion g(u)?",
                options: [
                    { text: "f(x) = 5x² + 1,  g(u) = \\sqrt{u}", correct: true },
                    { text: "f(x) = \\sqrt{x},  g(u) = 5u² + 1", correct: false },
                    { text: "f(x) = 5x²,  g(u) = \\sqrt{u + 1}", correct: false }
                ]
            },
            step2: {
                question: "Ableitungen f'(x) und g'(u)?",
                options: [
                    { text: "f'(x) = 10x,  g'(u) = \\frac{1}{2\\sqrt{u}}", correct: true },
                    { text: "f'(x) = 5x,  g'(u) = \\frac{1}{\\sqrt{u}}", correct: false },
                    { text: "f'(x) = 10x,  g'(u) = -\\frac{1}{2}u^{-2}", correct: false }
                ]
            },
            step3: {
                question: "Gesamte Ableitung h'(x)?",
                options: [
                    { text: "h'(x) = \\frac{1}{2\\sqrt{5x^2 + 1}} · 10x = \\frac{5x}{\\sqrt{5x^2 + 1}}", correct: true },
                    { text: "h'(x) = \\frac{10x}{\\sqrt{5x^2 + 1}}", correct: false },
                    { text: "h'(x) = 5x \\sqrt{5x^2 + 1}", correct: false }
                ]
            }
        }
    ];

    let currentLevelIndex = 0;
    let score = 0;
    let streak = 0;
    let currentStep = 1;

    function loadGameLevel() {
        const qData = gameQuestions[currentLevelIndex];

        document.getElementById('game-level').textContent = `${currentLevelIndex + 1} / ${gameQuestions.length}`;
        document.getElementById('q-num').textContent = currentLevelIndex + 1;
        document.getElementById('game-target-formula').innerHTML = `$$${qData.targetTex}$$`;
        document.getElementById('game-feedback').classList.add('hidden');

        currentStep = 1;
        renderStepOptions(1);
        renderStepOptions(2);
        renderStepOptions(3);

        document.getElementById('step-1-block').classList.remove('disabled');
        document.getElementById('step-2-block').classList.add('disabled');
        document.getElementById('step-3-block').classList.add('disabled');

        renderMathIn(document.querySelector('.game-card'));
    }

    function renderStepOptions(stepNum) {
        const qData = gameQuestions[currentLevelIndex];
        const stepData = qData[`step${stepNum}`];
        const container = document.getElementById(`step-${stepNum}-options`);
        container.innerHTML = '';

        // Shuffle options deterministically for variety
        const opts = [...stepData.options].sort(() => Math.sin(stepNum + currentLevelIndex) - 0.5);

        opts.forEach((opt, idx) => {
            const card = document.createElement('div');
            card.className = 'opt-card';
            card.innerHTML = `$$${opt.text}$$`;
            card.addEventListener('click', () => handleOptionClick(stepNum, opt.correct, card));
            container.appendChild(card);
        });
    }

    function handleOptionClick(stepNum, isCorrect, clickedCard) {
        if (stepNum !== currentStep) return;

        const container = document.getElementById(`step-${stepNum}-options`);
        const allCards = container.querySelectorAll('.opt-card');

        allCards.forEach(c => c.classList.remove('selected-correct', 'selected-wrong'));

        if (isCorrect) {
            clickedCard.classList.add('selected-correct');
            score += 100 * stepNum;
            streak++;
            document.getElementById('game-score').textContent = score;
            document.getElementById('game-streak').textContent = `🔥 ${streak}`;

            if (stepNum < 3) {
                currentStep = stepNum + 1;
                document.getElementById(`step-${currentStep}-block`).classList.remove('disabled');
            } else {
                // Completed Level!
                showLevelSuccess();
            }
        } else {
            clickedCard.classList.add('selected-wrong');
            streak = 0;
            document.getElementById('game-streak').textContent = `🔥 0`;
        }
    }

    function showLevelSuccess() {
        const feedback = document.getElementById('game-feedback');
        feedback.classList.remove('hidden');

        const title = document.getElementById('feedback-title');
        const desc = document.getElementById('feedback-desc');
        const nextBtn = document.getElementById('next-level-btn');

        if (currentLevelIndex < gameQuestions.length - 1) {
            title.textContent = "Super gemacht! Level geschafft! 🎉";
            desc.textContent = "Du hast alle Schritte der Kettenregel perfekt vorbereitet und gelöst.";
            nextBtn.textContent = "Nächstes Level ➔";
        } else {
            title.textContent = "HERZLICHEN GLÜCKWUNSCH! 🏆";
            desc.textContent = `Du hast alle ${gameQuestions.length} Level meisterhaft absolviert! Endstand: ${score} Punkte.`;
            nextBtn.textContent = "Erneut Spielen 🔄";
        }
    }

    document.getElementById('next-level-btn').addEventListener('click', () => {
        if (currentLevelIndex < gameQuestions.length - 1) {
            currentLevelIndex++;
        } else {
            currentLevelIndex = 0;
            score = 0;
            streak = 0;
            document.getElementById('game-score').textContent = score;
            document.getElementById('game-streak').textContent = `🔥 ${streak}`;
        }
        loadGameLevel();
    });

    document.getElementById('game-restart-btn').addEventListener('click', () => {
        currentLevelIndex = 0;
        score = 0;
        streak = 0;
        document.getElementById('game-score').textContent = score;
        document.getElementById('game-streak').textContent = `🔥 ${streak}`;
        loadGameLevel();
    });

    // Load initial level
    loadGameLevel();
});
