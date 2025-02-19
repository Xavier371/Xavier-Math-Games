document.addEventListener('DOMContentLoaded', (event) => {
    const canvas = document.getElementById('gameCanvas');
    const ctx = canvas.getContext('2d');
    const isMobile = window.innerWidth <= 768;

    let origin, width, height;

    function resizeCanvas() {
        if (isMobile) {
            const containerWidth = Math.min(window.innerWidth - 40, window.innerHeight - 300);
            canvas.width = containerWidth;
            canvas.height = containerWidth;
        } else {
            canvas.width = 600;
            canvas.height = 600;
        }
        
        // Update dimensions after resize
        origin = { x: canvas.width / 2, y: canvas.height / 2 };
        width = canvas.width;
        height = canvas.height;
        
        // Redraw if game is initialized
        if (typeof draw === 'function') {
            draw();
        }
    }

    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();

    // Scale factor for mobile
    const scaleFactor = isMobile ? 0.6 : 1;
    const baseVectorLength = 50 * scaleFactor;

    const initialUnitVectorX = { x: baseVectorLength, y: 0 };
    const initialUnitVectorY = { x: 0, y: -baseVectorLength };
    let unitVectorX = { ...initialUnitVectorX };
    let unitVectorY = { ...initialUnitVectorY };

    let dragging = null;
    let moveCounter = 0;
    let gameWon = false;
    let gameStarted = false;
    let timer = null;
    let elapsedTime = 0;
    let isPaused = false;
    let solveClicked = false;

    function getRandomPoint() {
        const min = -5;
        const max = 5;
        let x, y;
        do {
            x = Math.floor(Math.random() * (max - min + 1)) + min;
            y = Math.floor(Math.random() * (max - min + 1)) + min;
        } while ((x === 1 && y === 0) || (x === 0 && y === 1));
        return { x: x, y: y };
    }

    function hasIntegerSolution(bluePoint, redPoint) {
        const [b1, b2] = [bluePoint.x, bluePoint.y];
        const [r1, r2] = [redPoint.x, redPoint.y];
        let bestSolution = null;
        let minSum = Infinity;

        for (let a = -6; a <= 6; a++) {
            for (let b = -6; b <= 6; b++) {
                const x1 = a * b1 + b * b2;
                for (let c = -6; c <= 6; c++) {
                    for (let d = -6; d <= 6; d++) {
                        const x2 = c * b1 + d * b2;
                        if (x1 === r1 && x2 === r2) {
                            const sum = Math.abs(a) + Math.abs(b) + Math.abs(c) + Math.abs(d);
                            if (sum < minSum) {
                                minSum = sum;
                                bestSolution = { a, b, c, d };
                            }
                        }
                    }
                }
            }
        }
        return bestSolution;
    }

    function generateValidPoints() {
        let bluePoint, redPoint, solution;
        do {
            bluePoint = getRandomPoint();
            redPoint = getRandomPoint();
            solution = hasIntegerSolution(bluePoint, redPoint);
        } while (bluePoint.x === redPoint.x && bluePoint.y === redPoint.y || !solution);
        return { bluePoint, redPoint, solution };
    }

    let { bluePoint, redPoint, solution } = generateValidPoints();

    function gridToCanvas(point) {
        const scaledX = point.x * baseVectorLength;
        const scaledY = point.y * baseVectorLength;
        return { 
            x: origin.x + scaledX, 
            y: origin.y - scaledY 
        };
    }

    function canvasToGrid(point) {
        return { 
            x: Math.round((point.x - origin.x) / baseVectorLength), 
            y: Math.round((origin.y - point.y) / baseVectorLength) 
        };
    }
        function drawGrid() {
        ctx.clearRect(0, 0, width, height);
        ctx.strokeStyle = 'lightgray';
        const gridSize = baseVectorLength;

        for (let i = -Math.ceil(width / (2 * gridSize)); i <= Math.ceil(width / (2 * gridSize)); i++) {
            ctx.beginPath();
            ctx.moveTo(origin.x + i * gridSize, 0);
            ctx.lineTo(origin.x + i * gridSize, height);
            ctx.stroke();
        }

        for (let j = -Math.ceil(height / (2 * gridSize)); j <= Math.ceil(height / (2 * gridSize)); j++) {
            ctx.beginPath();
            ctx.moveTo(0, origin.y + j * gridSize);
            ctx.lineTo(width, origin.y + j * gridSize);
            ctx.stroke();
        }
    }

    function drawAxes() {
        ctx.beginPath();
        ctx.moveTo(0, origin.y);
        ctx.lineTo(width, origin.y);
        ctx.strokeStyle = 'black';
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(origin.x, 0);
        ctx.lineTo(origin.x, height);
        ctx.stroke();

        const fontSize = isMobile ? '10px' : '12px';
        ctx.font = `${fontSize} Arial`;
        ctx.fillStyle = 'black';
        ctx.fillText('X', width - 10, origin.y - 10);
        ctx.fillText('Y', origin.x + 10, 10);
    }

    function drawArrow(start, end, color, label = '') {
        const headLength = isMobile ? 7 : 10;
        const dx = end.x - start.x;
        const dy = end.y - start.y;
        const angle = Math.atan2(dy, dx);

        ctx.beginPath();
        ctx.moveTo(start.x, start.y);
        ctx.lineTo(end.x, end.y);
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(end.x, end.y);
        ctx.lineTo(end.x - headLength * Math.cos(angle - Math.PI / 6), 
                  end.y - headLength * Math.sin(angle - Math.PI / 6));
        ctx.lineTo(end.x - headLength * Math.cos(angle + Math.PI / 6), 
                  end.y - headLength * Math.sin(angle + Math.PI / 6));
        ctx.lineTo(end.x, end.y);
        ctx.fillStyle = color;
        ctx.fill();

        if (label) {
            const fontSize = isMobile ? '10px' : '12px';
            ctx.font = `${fontSize} Arial`;
            ctx.fillStyle = color;
            ctx.fillText(label, end.x + 5, end.y - 5);
        }
    }

    function drawPoints() {
        const pointRadius = isMobile ? 3 : 5;
        
        let redCanvasPoint = gridToCanvas(redPoint);
        ctx.beginPath();
        ctx.arc(redCanvasPoint.x, redCanvasPoint.y, pointRadius, 0, Math.PI * 2);
        ctx.fillStyle = 'red';
        ctx.fill();

        let blueCanvasPoint = gridToCanvas(bluePoint);
        ctx.beginPath();
        ctx.arc(blueCanvasPoint.x, blueCanvasPoint.y, pointRadius, 0, Math.PI * 2);
        ctx.fillStyle = 'blue';
        ctx.fill();

        drawArrow(origin, blueCanvasPoint, 'blue', '');
    }

    function drawTransformedVector() {
        const A = [
            [(unitVectorX.x / baseVectorLength), (unitVectorY.x / baseVectorLength)],
            [(-unitVectorX.y / baseVectorLength), (-unitVectorY.y / baseVectorLength)]
        ];

        const transformedBluePoint = {
            x: (A[0][0] * bluePoint.x) + (A[0][1] * bluePoint.y),
            y: (A[1][0] * bluePoint.x) + (A[1][1] * bluePoint.y)
        };

        const transformedBlueCanvasPoint = gridToCanvas(transformedBluePoint);
        const pointRadius = isMobile ? 3 : 5;
        ctx.beginPath();
        ctx.arc(transformedBlueCanvasPoint.x, transformedBlueCanvasPoint.y, pointRadius, 0, Math.PI * 2);
        ctx.fillStyle = 'lightblue';
        ctx.fill();

        drawArrow(origin, transformedBlueCanvasPoint, 'lightblue');

        if (Math.round(transformedBluePoint.x) === redPoint.x && 
            Math.round(transformedBluePoint.y) === redPoint.y) {
            gameWon = true;
            stopTimer();
            document.getElementById('winMessage').innerText = 
                `Congratulations! You won in ${moveCounter} moves and ${elapsedTime} seconds!`;
            disableButtonsAfterWin();
        }
    }

    function draw() {
        drawGrid();
        drawAxes();
        drawArrow(origin, 
                 { x: origin.x + initialUnitVectorX.x, y: origin.y + initialUnitVectorX.y }, 
                 'black', 'i');
        drawArrow(origin, 
                 { x: origin.x + initialUnitVectorY.x, y: origin.y + initialUnitVectorY.y }, 
                 'black', 'j');

        const labelIX = (unitVectorX.x !== initialUnitVectorX.x || 
                        unitVectorX.y !== initialUnitVectorX.y) ? "i'" : '';
        const labelJY = (unitVectorY.x !== initialUnitVectorY.x || 
                        unitVectorY.y !== initialUnitVectorY.y) ? "j'" : '';
        
        drawArrow(origin, 
                 { x: origin.x + unitVectorX.x, y: origin.y + unitVectorX.y }, 
                 'green', labelIX);
        drawArrow(origin, 
                 { x: origin.x + unitVectorY.x, y: origin.y + unitVectorY.y }, 
                 'green', labelJY);
        drawPoints();
    }

    function handleMouseMove(event) {
        if (dragging && !isPaused) {
            const rect = canvas.getBoundingClientRect();
            const x = event.clientX - rect.left;
            const y = event.clientY - rect.top;
            const gridPoint = canvasToGrid({ x, y });

            const snappedX = Math.round(gridPoint.x) * baseVectorLength;
            const snappedY = Math.round(gridPoint.y) * -baseVectorLength;

            if (dragging === 'unitVectorX') {
                unitVectorX = { x: snappedX, y: snappedY };
            } else if (dragging === 'unitVectorY') {
                unitVectorY = { x: snappedX, y: snappedY };
            }

            draw();
        }
    }

    function handleTouchMove(event) {
        event.preventDefault();
        const touch = event.touches[0];
        const simulatedEvent = {
            clientX: touch.clientX,
            clientY: touch.clientY
        };
        handleMouseMove(simulatedEvent);
    }

    function isOnVector(point, vector) {
        const vectorPoint = { 
            x: origin.x + vector.x, 
            y: origin.y + vector.y 
        };
        const distance = Math.sqrt(
            (point.x - vectorPoint.x) ** 2 + 
            (point.y - vectorPoint.y) ** 2
        );
        return distance < (isMobile ? 20 : 10);
    }

    canvas.addEventListener('mousedown', (event) => {
        if (gameWon || isPaused) return;

        const rect = canvas.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;
        const clickPoint = { x: x, y: y };

        if (isOnVector(clickPoint, unitVectorX)) {
            dragging = 'unitVectorX';
        } else if (isOnVector(clickPoint, unitVectorY)) {
            dragging = 'unitVectorY';
        }
    });

    canvas.addEventListener('touchstart', (event) => {
        event.preventDefault();
        const touch = event.touches[0];
        const simulatedEvent = {
            clientX: touch.clientX,
            clientY: touch.clientY
        };
        canvas.dispatchEvent(new MouseEvent('mousedown', simulatedEvent));
    });

    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('touchmove', handleTouchMove, { passive: false });

    canvas.addEventListener('mouseup', () => {
        dragging = null;
    });

    canvas.addEventListener('touchend', () => {
        dragging = null;
    });

    function startTimer() {
        if (!timer) {
            timer = setInterval(() => {
                elapsedTime += 1;
                document.getElementById('timer').innerText = 
                    `Timer: ${elapsedTime} seconds`;
            }, 1000);
        }
    }

    function stopTimer() {
        clearInterval(timer);
        timer = null;
    }

    function updateEquationText() {
        const equationText = `
            \\[
            \\begin{bmatrix}
            a & b \\\\
            c & d \\\\
            \\end{bmatrix}
            \\begin{bmatrix}
            ${bluePoint.x} \\\\
            ${bluePoint.y} \\\\
            \\end{bmatrix}
            =
            \\begin{bmatrix}
            ${redPoint.x} \\\\
            ${redPoint.y} \\\\
            \\end{bmatrix}
            \\]
        `;

        const systemText1 = `
            \\[
            a \\cdot ${bluePoint.x} + b \\cdot ${bluePoint.y} = ${redPoint.x}
            \\]
        `;

        const systemText2 = `
            \\[
            c \\cdot ${bluePoint.x} + d \\cdot ${bluePoint.y} = ${redPoint.y}
            \\]
        `;

        const solutionText = `
            \\[
            a = ${solution.a}, \\ b = ${solution.b}, \\ c = ${solution.c}, \\ d = ${solution.d}
            \\]
        `;

        const vectorMapping = `
            \\[
            i' \\rightarrow (${solution.a}, ${solution.c}), \\ 
            j' \\rightarrow (${solution.b}, ${solution.d})
            \\]
        `;

        document.getElementById('equation').innerHTML = equationText;
        document.getElementById('equationText').innerHTML = 
            systemText1 + systemText2;
        document.getElementById('solutionText').innerHTML = solutionText;
        document.getElementById('vectorMapping').innerHTML = vectorMapping;

        MathJax.typeset();
    }

    function toggleSolution() {
        const equationContainer = document.getElementById('equationContainer');
        if (isMobile) {
            if (equationContainer.style.display === 'none') {
                canvas.style.display = 'none';
                updateEquationText();
                equationContainer.style.display = 'block';
            } else {
                canvas.style.display = 'block';
                equationContainer.style.display = 'none';
                draw();
            }
        } else {
            if (equationContainer.style.display === 'none') {
                updateEquationText();
                equationContainer.style.display = 'block';
            } else {
                equationContainer.style.display = 'none';
            }
        }
    }

    function disableButtonsAfterWin() {
        document.getElementById('goButton').disabled = true;
        document.getElementById('pauseButton').disabled = true;
    }

    document.getElementById('solveButton').addEventListener('click', toggleSolution);

    document.getElementById('goButton').addEventListener('click', () => {
        if (gameWon) return;
        if (!gameStarted) {
            gameStarted = true;
            draw();
            startTimer();
        }
        moveCounter += 1;
        document.getElementById('moveCounter').innerText = `${moveCounter}`;
        drawTransformedVector();
    });

    document.getElementById('resetButton').addEventListener('click', () => {
        const points = generateValidPoints();
        bluePoint = points.bluePoint;
        redPoint = points.redPoint;
        solution = points.solution;

        unitVectorX = { ...initialUnitVectorX };
        unitVectorY = { ...initialUnitVectorY };
        moveCounter = 0;
        gameWon = false;
        gameStarted = false;
        elapsedTime = 0;
        
        document.getElementById('goButton').disabled = false;
        document.getElementById('moveCounter').innerText = `${moveCounter}`;
        document.getElementById('winMessage').innerText = '';
        document.getElementById('timer').innerText = `Timer: ${elapsedTime} seconds`;

        const equationContainer = document.getElementById('equationContainer');
        equationContainer.style.display = 'none';
        
        if (isMobile) {
            canvas.style.display = 'block';
        }

        solveClicked = false;
        document.getElementById('solveButton').disabled = false;
        document.getElementById('pauseButton').disabled = false;

        if (isPaused) {
            togglePause();
        }
        draw();
        startTimer();
    });

    document.getElementById('pauseButton').addEventListener('click', () => {
        if (!gameWon) {
            togglePause();
        }
    });

    function togglePause() {
        if (gameWon) return;

        if (isPaused) {
            isPaused = false;
            document.getElementById('pauseButton').innerText = 'Pause';
            startTimer();
            draw();
        } else {
            isPaused = true;
            document.getElementById('pauseButton').innerText = 'Resume';
            stopTimer();
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            drawGrid();
            drawAxes();
        }
    }

    // Initial draw and start timer
    draw();
    startTimer();
});
