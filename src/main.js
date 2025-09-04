const { convertJsonToSav, convertSavToJson, convertRawToSav, convertSavToRaw } = require("gvas-json-converter");

function downloadJson(filename, jsonString) {
    const element = document.createElement("a");
    element.setAttribute("href", "data:text/json;charset=utf-8," + encodeURIComponent(jsonString));
    element.setAttribute("download", filename);
    element.click();
}

function downloadSav(filename, savArrayBuffer) {
    const blob = new Blob([savArrayBuffer], { type: "octet/stream" });

    const element = document.createElement("a");
    element.setAttribute("href", window.URL.createObjectURL(blob));
    element.setAttribute("download", filename);
    element.click();
}

function loadSavFile() {
    const fileReader = new FileReader();
    fileReader.fileName = this.files[0].name;

    fileReader.onload = function (e) {
        downloadJson(fileReader.fileName + ".json", convertSavToJson(e.target.result));
    };

    fileReader.readAsArrayBuffer(this.files[0]);
}

function loadJsonFile() {
    const fileReader = new FileReader();
    fileReader.fileName = this.files[0].name;

    fileReader.onload = function (e) {
        downloadSav(fileReader.fileName + ".sav", convertJsonToSav(e.target.result));
    };

    fileReader.readAsText(this.files[0]);
}

//document.getElementById("sav-input").addEventListener("change", loadSavFile);
//document.getElementById("json-input").addEventListener("change", loadJsonFile);


// Game state
let currentTool = 'paint';
let selectedTileType = 'belt';
let selectedDirection = 'up';
let selectedCells = new Set();
let isDragging = false;
let isSelecting = false;
let startCell = null;
let dragOffset = { x: 0, y: 0 };
let grid = Array(40).fill().map(() => Array(50).fill(null));
let levelData = null;
let deposits = [];
let toErase = [];
let selectedDeposit = null;
let depositMode = false;


// Tile types for conveyor system
const tileTypes = [
    { type: 'belt', class: '/Game/Core/Blueprints/Actors/ConveyorBelt/BP_ConveyorBelt_Straight_Tier1.BP_ConveyorBelt_Straight_Tier1_C' },
    { type: 'corner', class: '/Game/Core/Blueprints/Actors/ConveyorBelt/BP_ConveyorBelt_Corner_Tier1.BP_ConveyorBelt_Corner_Tier1_C' },
    { type: 'loader', class: '/Game/Core/Blueprints/Actors/ConveyorBelt/Loader/BP_ConveyorBelt_Loader.BP_ConveyorBelt_Loader_C' },
    { type: 'unloader', class: '/Game/Core/Blueprints/Actors/ConveyorBelt/Loader/BP_ConveyorBelt_Unloader.BP_ConveyorBelt_Unloader_C' },
    { type: 'joiner', class: '/Game/Core/Blueprints/Actors/ConveyorBelt/Joiner/BP_ConveyorBelt_Joiner.BP_ConveyorBelt_Joiner_C' },
    { type: 'pauser', class: '/Game/Core/Blueprints/Actors/ConveyorBelt/Pauser/BP_ConveyorBelt_Pauser.BP_ConveyorBelt_Pauser_C' },
    { type: 'serial', class: '/Game/Core/Blueprints/Actors/ConveyorBelt/CriteriaScanner/BP_ConveyorBelt_CriteriaScanner_SerialNumber.BP_ConveyorBelt_CriteriaScanner_SerialNumber_C' },
    { type: 'weight', class: '/Game/Core/Blueprints/Actors/ConveyorBelt/CriteriaScanner/BP_ConveyorBelt_CriteriaScanner_Weight.BP_ConveyorBelt_CriteriaScanner_Weight_C' },
    { type: 'country', class: '/Game/Core/Blueprints/Actors/ConveyorBelt/CriteriaScanner/BP_ConveyorBelt_CriteriaScanner_Country.BP_ConveyorBelt_CriteriaScanner_Country_C' },
    { type: 'rack_red', class: '/Game/Core/Blueprints/Actors/Storage/Medium/BP_StorageRack_ExtraLarge_Red.BP_StorageRack_ExtraLarge_Red_C' },
    { type: 'sticker_deny', class: '/Game/Core/Blueprints/Actors/ConveyorBelt/StickerApplier/BP_ConveyorBelt_StickerApplier_Deny.BP_ConveyorBelt_StickerApplier_Deny_C' },
    { type: 'sticker_approve', class: '/Game/Core/Blueprints/Actors/ConveyorBelt/StickerApplier/BP_ConveyorBelt_StickerApplier_Approve.BP_ConveyorBelt_StickerApplier_Approve_C' },
    { type: 'stamp', class: '/Game/Core/Blueprints/Actors/ConveyorBelt/CriteriaScanner/BP_ConveyorBelt_CriteriaScanner_Stamp.BP_ConveyorBelt_CriteriaScanner_Stamp_C' },
    { type: 'scanner', class: '/Game/Core/Blueprints/Actors/ConveyorBelt/Scanner2/BP_ConveyorBelt_Scanner2_Tier1.BP_ConveyorBelt_Scanner2_Tier1_C' },
    { type: 'diverter', class: '/Game/Core/Blueprints/Actors/ConveyorBelt/Diverter/BP_ConveyorBelt_Diverter.BP_ConveyorBelt_Diverter_C' },
    { type: 'bridger', class: '/Game/Core/Blueprints/Actors/ConveyorBelt/Bridger/BP_ConveyorBelt_Bridger.BP_ConveyorBelt_Bridger_C' },
    { type: 'contents_prohibited', class: '/Game/Core/Blueprints/Actors/ConveyorBelt/CriteriaScanner/BP_ConveyorBelt_CriteriaScanner_ContentsProhibited.BP_ConveyorBelt_CriteriaScanner_ContentsProhibited_C' },
    { type: 'cargo_type', class: '/Game/Core/Blueprints/Actors/ConveyorBelt/CriteriaScanner/BP_ConveyorBelt_CriteriaScanner_CargoType.BP_ConveyorBelt_CriteriaScanner_CargoType_C' },
    { type: 'joiner_3way', class: '/Game/Core/Blueprints/Actors/ConveyorBelt/Joiner/BP_ConveyorBelt_Joiner_3Way.BP_ConveyorBelt_Joiner_3Way_C' },
    { type: 'splitter', class: '/Game/Core/Blueprints/Actors/ConveyorBelt/Splitter/BP_ConveyorBelt_Splitter.BP_ConveyorBelt_Splitter_C' },
    { type: 'splitter_2way', class: '/Game/Core/Blueprints/Actors/ConveyorBelt/Splitter/BP_ConveyorBelt_Splitter_2Way.BP_ConveyorBelt_Splitter_2Way_C' },
    { type: 'launcher', class: '/Game/Core/Blueprints/Actors/ConveyorBelt/Launcher/BP_ConveyorBelt_Launcher.BP_ConveyorBelt_Launcher_C' }
];

// Initialize the editor
function init() {
    createTileBank();
    createGrid();
    setupEventListeners();
    updateDepositCount();
}

function createTileBank() {
    const tileBank = document.getElementById('tileBank');
    tileTypes.forEach(tileData => {
        const tile = document.createElement('div');
        tile.className = `bank-tile`;
        tile.style.background = `url("css/${tileData.type}.png") no-repeat center`;
        tile.dataset.tileType = tileData.type;
        tile.title = tileData.name;
        if (tileData.type === selectedTileType) {
            tile.classList.add('selected');
        }
        tileBank.appendChild(tile);
    });
}

function createGrid() {
    const gameGrid = document.getElementById('gameGrid');
    for (let row = 0; row < 40; row++) {
        for (let col = 0; col < 50; col++) {
            const cell = document.createElement('div');
            cell.className = 'grid-cell';
            cell.dataset.row = row;
            cell.dataset.col = col;
            gameGrid.appendChild(cell);
        }
    }
}

function setupEventListeners() {
    // Tool selection
    document.querySelectorAll('[data-tool]').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('[data-tool]').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentTool = btn.dataset.tool;
            document.getElementById('currentTool').textContent =
                currentTool.charAt(0).toUpperCase() + currentTool.slice(1);
            clearSelection();
        });
    });

    // Tile bank selection
    document.getElementById('tileBank').addEventListener('click', (e) => {
        if (e.target.classList.contains('bank-tile')) {
            document.querySelectorAll('.bank-tile').forEach(t => t.classList.remove('selected'));
            e.target.classList.add('selected');
            selectedTileType = e.target.dataset.tileType;
        }
    });

    // Grid interactions
    const gameGrid = document.getElementById('gameGrid');

    gameGrid.addEventListener('mousedown', handleMouseDown);
    gameGrid.addEventListener('mousemove', handleMouseMove);
    gameGrid.addEventListener('mouseup', handleMouseUp);
    gameGrid.addEventListener('contextmenu', (e) => e.preventDefault());

    // Deposit zone interactions
    document.querySelectorAll('.deposit-zones').forEach(zone => {
        zone.addEventListener('click', handleDepositZoneClick);
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Delete' || e.key === 'Backspace') {
            eraseSelectedCells();
        } else if (e.key === 'Escape') {
            clearSelection();
        } else if (e.ctrlKey && e.key === 'a') {
            e.preventDefault();
            selectAll();
        }
        // Rotate cell on 'r' key when mouse is over a cell
        else if (e.key === 'r') {
            if (window._hoveredCellRow !== undefined && window._hoveredCellCol !== undefined) {
                rotateCell(window._hoveredCellRow, window._hoveredCellCol);
            }
        }
        else if (e.key === 'x') {
            if (window._hoveredCellRow !== undefined && window._hoveredCellCol !== undefined) {
                flipCell(window._hoveredCellRow, window._hoveredCellCol);
            }
        }
    });
}
// Track hovered cell
gameGrid.addEventListener('mouseover', (e) => {
    if (e.target.classList.contains('grid-cell')) {
        window._hoveredCellRow = parseInt(e.target.dataset.row);
        window._hoveredCellCol = parseInt(e.target.dataset.col);
    }
});
gameGrid.addEventListener('mouseout', (e) => {
    if (e.target.classList.contains('grid-cell')) {
        window._hoveredCellRow = undefined;
        window._hoveredCellCol = undefined;
    }
});

function handleMouseDown(e) {
    if (!e.target.classList.contains('grid-cell')) return;

    const row = parseInt(e.target.dataset.row);
    const col = parseInt(e.target.dataset.col);

    if (currentTool === 'paint') {
        paintCell(row, col);
    } else if (currentTool === 'erase') {
        eraseCell(row, col);
    } else if (currentTool === 'rotate') {
        rotateCell(row, col);
    } else if (currentTool === 'flip') {
        flipCell(row, col);
    } else if (currentTool === 'select') {
        if (e.ctrlKey) {
            toggleCellSelection(row, col);
        } else if (selectedCells.has(`${row},${col}`)) {
            startDrag(e, row, col);
        } else {
            startSelection(e, row, col);
        }
    }
}

function handleDepositZoneClick(e) {
    if (currentTool === 'deposit') {
        const side = e.currentTarget.dataset.side;
        const rect = e.currentTarget.getBoundingClientRect();
        const gridRect = document.getElementById('gameGrid').getBoundingClientRect();

        let tileCol, tileRow;

        // Calculate which tile this deposit should connect to
        if (side === 'top' || side === 'bottom') {
            tileCol = Math.floor((e.clientX - gridRect.left - 2) / 17);
            tileRow = side === 'top' ? 0 : 39;
        } else {
            tileRow = Math.floor((e.clientY - gridRect.top - 2) / 17);
            tileCol = side === 'left' ? 0 : 49;
        }

        // Ensure valid tile coordinates
        if (tileRow < 0 || tileRow >= 40 || tileCol < 0 || tileCol >= 50) return;

        // Check if there's already a deposit for this tile
        const existingDeposit = deposits.find(d =>
            d.tileRow === tileRow && d.tileCol === tileCol && d.side === side
        );

        if (existingDeposit) {
            selectDeposit(existingDeposit);
        } else {
            createDeposit(side, tileRow, tileCol);
        }
    }
}

function handleMouseMove(e) {
    if (currentTool === 'select' && isSelecting) {
        updateSelection(e);
    } else if (currentTool === 'select' && isDragging) {
        updateDragPreview(e);
    }
}

function handleMouseUp(e) {
    if (isSelecting) {
        finishSelection();
    } else if (isDragging) {
        finishDrag(e);
    }
}

function paintCell(row, col) {
    const cell = getCellElement(row, col);
    const tileData = tileTypes.find(t => t.type === selectedTileType);

    cell.className = `grid-cell`;
    cell.style.background = `url("css/${tileData.type}.png") no-repeat center`;
    cell.style.transform = '';
    if (grid[row][col] && grid[row][col].guid) {
        toErase.push(grid[row][col].guid);
    }
    grid[row][col] = {
        type: selectedTileType,
        dirty: true,
        x: col,
        y: row,
        quat: {
            x: 0,
            y: 0,
            z: 0,
            w: 1
        }
    };
}

function eraseCell(row, col) {
    const cell = getCellElement(row, col);
    cell.className = 'grid-cell';
    cell.style.background = '';
    cell.style.transform = '';
    if (grid[row][col] && grid[row][col].guid) {
        toErase.push(grid[row][col].guid);
    }
    grid[row][col] = null;
}

function rotateQuatBy90(cellData, axis = 'z') {
    // Assume cellData.quat = { x, y, z, w }
    // 90 degrees in radians
    const angle = Math.PI / 2;
    let q90;
    if (axis === 'x') {
        q90 = { x: Math.sin(angle / 2), y: 0, z: 0, w: Math.cos(angle / 2) };
    } else if (axis === 'y') {
        q90 = { x: 0, y: Math.sin(angle / 2), z: 0, w: Math.cos(angle / 2) };
    } else { // 'z'
        q90 = { x: 0, y: 0, z: Math.sin(angle / 2), w: Math.cos(angle / 2) };
    }

    // Quaternion multiplication: q * r
    function multiplyQuat(q, r) {
        return {
            w: q.w * r.w - q.x * r.x - q.y * r.y - q.z * r.z,
            x: q.w * r.x + q.x * r.w + q.y * r.z - q.z * r.y,
            y: q.w * r.y - q.x * r.z + q.y * r.w + q.z * r.x,
            z: q.w * r.z + q.x * r.y - q.y * r.x + q.z * r.w
        };
    }

    cellData.quat = multiplyQuat(q90, cellData.quat);
}

function rotateCell(row, col) {
    const cellData = grid[row][col];
    if (!cellData) {
        return;
    }

    const cell = getCellElement(row, col);

    rotateQuatBy90(cellData, 'z');
    cellData.dirty = true;

    updateCellTransform(cell, cellData);
}

function flipCell(row, col) {
    const cellData = grid[row][col];
    if (!cellData) {
        return;
    }

    const cell = getCellElement(row, col);

    cellData.flipped = !cellData.flipped;
    cellData.dirty = true;
    updateCellTransform(cell, cellData);
}

function toggleCellSelection(row, col) {
    const cellId = `${row},${col}`;
    const cell = getCellElement(row, col);

    if (selectedCells.has(cellId)) {
        selectedCells.delete(cellId);
        cell.classList.remove('selected');
    } else {
        selectedCells.add(cellId);
        cell.classList.add('selected');
    }

    updateSelectedCount();
}

function startSelection(e, row, col) {
    clearSelection();
    isSelecting = true;
    startCell = { row, col };

    const rect = e.target.getBoundingClientRect();
    const selectionBox = document.getElementById('selectionBox');
    selectionBox.style.left = rect.left + 'px';
    selectionBox.style.top = rect.top + 'px';
    selectionBox.style.width = '16px';
    selectionBox.style.height = '16px';
    selectionBox.style.display = 'block';
}

function updateSelection(e) {
    if (!startCell) return;

    const gameGrid = document.getElementById('gameGrid');
    const gridRect = gameGrid.getBoundingClientRect();
    const selectionBox = document.getElementById('selectionBox');

    const currentRow = Math.floor((e.clientY - gridRect.top - 2) / 17);
    const currentCol = Math.floor((e.clientX - gridRect.left - 2) / 17);

    const minRow = Math.max(0, Math.min(startCell.row, currentRow));
    const maxRow = Math.min(39, Math.max(startCell.row, currentRow));
    const minCol = Math.max(0, Math.min(startCell.col, currentCol));
    const maxCol = Math.min(49, Math.max(startCell.col, currentCol));

    // Update visual selection box
    const startCellElement = getCellElement(startCell.row, startCell.col);
    const startRect = startCellElement.getBoundingClientRect();

    selectionBox.style.left = (gridRect.left + minCol * 17 + 2) + 'px';
    selectionBox.style.top = (gridRect.top + minRow * 17 + 2) + 'px';
    selectionBox.style.width = ((maxCol - minCol + 1) * 17 - 1) + 'px';
    selectionBox.style.height = ((maxRow - minRow + 1) * 17 - 1) + 'px';

    // Update selected cells
    clearSelection();
    for (let r = minRow; r <= maxRow; r++) {
        for (let c = minCol; c <= maxCol; c++) {
            selectedCells.add(`${r},${c}`);
            getCellElement(r, c).classList.add('selected');
        }
    }

    updateSelectedCount();
}

function finishSelection() {
    isSelecting = false;
    startCell = null;
    document.getElementById('selectionBox').style.display = 'none';
}

function startDrag(e, row, col) {
    isDragging = true;
    const rect = e.target.getBoundingClientRect();
    dragOffset.x = e.clientX - rect.left;
    dragOffset.y = e.clientY - rect.top;

    // Create drag preview
    selectedCells.forEach(cellId => {
        const [r, c] = cellId.split(',').map(Number);
        const cell = getCellElement(r, c);
        cell.classList.add('drag-preview');
    });
}

function updateDragPreview(e) {
    // Visual feedback during drag (could add ghost image here)
}

function finishDrag(e) {
    if (!isDragging) return;

    const gameGrid = document.getElementById('gameGrid');
    const gridRect = gameGrid.getBoundingClientRect();

    const dropRow = Math.floor((e.clientY - gridRect.top - 2) / 17);
    const dropCol = Math.floor((e.clientX - gridRect.left - 2) / 17);

    if (dropRow >= 0 && dropRow < 40 && dropCol >= 0 && dropCol < 50) {
        // Calculate offset from original selection
        const originalCells = Array.from(selectedCells);
        const [firstRow, firstCol] = originalCells[0].split(',').map(Number);
        const rowOffset = dropRow - firstRow;
        const colOffset = dropCol - firstCol;

        // Store original tiles
        const tilesToMove = [];
        originalCells.forEach(cellId => {
            const [r, c] = cellId.split(',').map(Number);
            tilesToMove.push({ row: r, col: c, tileType: grid[r][c] });
        });

        // Clear original positions
        eraseSelectedCells();

        // Place tiles in new positions
        tilesToMove.forEach(tile => {
            const newRow = tile.row + rowOffset;
            const newCol = tile.col + colOffset;

            if (newRow >= 0 && newRow < 40 && newCol >= 0 && newCol < 50) {
                if (tile.tileType) {

                    grid[newRow][newCol] = { ...tile.tileType };

                    const newCellId = `${newRow},${newCol}`;
                    selectedCells.add(newCellId);
                    getCellElement(newRow, newCol).classList.add('selected');
                }
            }
        });
    }
    updateGrid();

    // Clean up drag state
    document.querySelectorAll('.drag-preview').forEach(cell => {
        cell.classList.remove('drag-preview');
    });

    isDragging = false;
    updateSelectedCount();
}

function clearSelection() {
    selectedCells.forEach(cellId => {
        const [row, col] = cellId.split(',').map(Number);
        getCellElement(row, col).classList.remove('selected');
    });
    selectedCells.clear();
    updateSelectedCount();
}

function selectAll() {
    clearSelection();
    for (let row = 0; row < 40; row++) {
        for (let col = 0; col < 50; col++) {
            if (grid[row][col]) {
                const cellId = `${row},${col}`;
                selectedCells.add(cellId);
                getCellElement(row, col).classList.add('selected');
            }
        }
    }
    updateSelectedCount();
}

function eraseSelectedCells() {
    selectedCells.forEach(cellId => {
        const [row, col] = cellId.split(',').map(Number);
        eraseCell(row, col);
    });
    clearSelection();
}

function getCellElement(row, col) {
    return document.querySelector(`[data-row="${row}"][data-col="${col}"]`);
}

function updateSelectedCount() {
    document.getElementById('selectedCount').textContent = selectedCells.size;
}

function updateDepositCount() {
    document.getElementById('depositCount').textContent = deposits.length;
}

function createDeposit(side, tileRow, tileCol) {
    const label = document.getElementById('depositLabel').value || 'A';
    const color = document.getElementById('depositColor').value;

    // Calculate deposit position based on the connected tile
    let x, y;
    if (side === 'top' || side === 'bottom') {
        x = tileCol * 17;
        y = 0;
    } else {
        x = 0;
        y = tileRow * 17;
    }

    const deposit = {
        id: Date.now(),
        side,
        x,
        y,
        tileRow,
        tileCol,
        label,
        color
    };

    deposits.push(deposit);
    renderDeposits();
    updateDepositCount();
    updateGridCellConnections();

    // Clear the label input
    document.getElementById('depositLabel').value = '';
}

function selectDeposit(deposit) {
    // Clear previous selection
    deposits.forEach(d => d.selected = false);

    deposit.selected = true;
    selectedDeposit = deposit;

    // Update UI
    document.getElementById('depositLabel').value = deposit.label;
    document.getElementById('depositColor').value = deposit.color;

    renderDeposits();
}

function deleteSelectedDeposit() {
    if (selectedDeposit) {
        deposits = deposits.filter(d => d.id !== selectedDeposit.id);
        selectedDeposit = null;
        renderDeposits();
        updateDepositCount();
        updateGridCellConnections();

        document.getElementById('depositLabel').value = '';
    }
}

function renderDeposits() {
    // Clear existing deposit elements
    document.querySelectorAll('.deposit-zone').forEach(el => el.remove());

    deposits.forEach(deposit => {
        const element = document.createElement('div');
        element.className = `deposit-zone ${deposit.side}`;
        element.style.left = deposit.x + 'px';
        element.style.top = deposit.y + 'px';
        element.style.borderColor = deposit.color;
        element.style.backgroundColor = deposit.color + '28';
        element.style.color = deposit.color;
        element.textContent = deposit.label;
        element.dataset.depositId = deposit.id;

        if (deposit.selected) {
            element.classList.add('selected');
        }

        // Add click handler for individual deposits
        element.addEventListener('click', (e) => {
            e.stopPropagation();
            selectDeposit(deposit);
        });

        const zoneContainer = document.querySelector(`.deposits-${deposit.side}`);
        zoneContainer.appendChild(element);
    });
}

function updateGridCellConnections() {
    // Clear all existing connection indicators
    document.querySelectorAll('.grid-cell').forEach(cell => {
        cell.classList.remove('has-deposit', 'top', 'bottom', 'left', 'right');
    });

    // Add connection indicators for cells with deposits
    deposits.forEach(deposit => {
        const cell = getCellElement(deposit.tileRow, deposit.tileCol);
        if (cell) {
            cell.classList.add('has-deposit', deposit.side);
        }
    });
}

function getDepositZoneWidth(side) {
    const zone = document.querySelector(`.deposits-${side}`);
    return zone.offsetWidth;
}

function getDepositZoneHeight(side) {
    const zone = document.querySelector(`.deposits-${side}`);
    return zone.offsetHeight;
}

function toggleDepositMode() {
    depositMode = !depositMode;
    const controls = document.getElementById('depositControls');
    const modeText = document.getElementById('depositModeText');

    if (depositMode) {
        controls.style.display = 'block';
        modeText.textContent = 'Exit Deposits';
        currentTool = 'deposit';
        document.querySelectorAll('[data-tool]').forEach(b => b.classList.remove('active'));
        document.querySelector('[data-tool="deposit"]').classList.add('active');
        document.getElementById('currentTool').textContent = 'Deposit';
    } else {
        controls.style.display = 'none';
        modeText.textContent = 'Add Deposits';
        currentTool = 'paint';
        document.querySelectorAll('[data-tool]').forEach(b => b.classList.remove('active'));
        document.querySelector('[data-tool="paint"]').classList.add('active');
        document.getElementById('currentTool').textContent = 'Paint';
    }
}

function clearGrid() {
    if (confirm('Are you sure you want to clear the entire grid?')) {
        for (let row = 0; row < 40; row++) {
            for (let col = 0; col < 50; col++) {
                eraseCell(row, col);
            }
        }
        clearSelection();
    }
}

function randomHex32() {
    let hex = '';
    for (let i = 0; i < 32; i++) {
        hex += Math.floor(Math.random() * 16).toString(16);
    }
    return hex;
}
function floatToInt64String(float) {
    const buffer = new ArrayBuffer(8);
    const view = new DataView(buffer);
    view.setFloat64(0, float, true); // true for little-endian
    const int64 = view.getBigUint64(0, true); // true for little-endian
    return int64.toString();
}

export function exportLevel() {
    if (!levelData) {
        alert('No level data loaded.');
        return;
    }
    let toAdd = [];

    for (let row = 0; row < 40; row++) {
        for (let col = 0; col < 50; col++) {
            const tileData = grid[row][col];
            if (!tileData || !tileData.dirty) {
                continue;
            }
            console.log(`Updating tile at (${row}, ${col}):`, tileData);
            tileData.dirty = false;
            if (!tileData.interactable) {
                toAdd.push(tileData);
                continue;
            }
            tileData.interactable[2].value[2].value.y = tileData.flipped ? -1 : 1;
            const quat = tileData.interactable[2].value[0].value;
            quat.ix = floatToInt64String(tileData.quat.x);
            quat.iy = floatToInt64String(tileData.quat.y);
            quat.iz = floatToInt64String(tileData.quat.z);
            quat.iw = floatToInt64String(tileData.quat.w);
            quat.x = tileData.quat.x;
            quat.y = tileData.quat.y;
            quat.z = tileData.quat.z;
            quat.w = tileData.quat.w;
        }
    }
    let interactables = null;
    for (let i = 0; i < levelData.length; i++) {
        if (levelData[i].name === "InteractablesToSpawn") {
            interactables = levelData[i].value;
        }
    }

    for (const toAddItem of toAdd) {
        const tt = tileTypes.find(t => t.type === toAddItem.type);
        let newValue = [
            {
                "type": "ObjectProperty",
                "name": "InteractableClass_2_49D7327649606F5E929CCDA26205B409",
                "value": tt.class
            },
            {
                "name": "IsPlaced?_5_8EC8D1054597FECFB32F61A385B4C8CD",
                "type": "BoolProperty",
                "value": false,
                "hasGuid": false
            },
            {
                "type": "StructProperty",
                "name": "Transform_8_05415F444B3539F6DA40C3AF9EFDC195",
                "subtype": "Transform",
                "guid": "00000000000000000000000000000000",
                "value": [
                    {
                        "type": "StructProperty",
                        "name": "Rotation",
                        "subtype": "Quat",
                        "guid": "00000000000000000000000000000000",
                        "value": {
                            "ix": floatToInt64String(toAddItem.quat.x),
                            "iy": floatToInt64String(toAddItem.quat.y),
                            "iz": floatToInt64String(toAddItem.quat.z),
                            "iw": floatToInt64String(toAddItem.quat.w),
                            "x": toAddItem.quat.x,
                            "y": toAddItem.quat.y,
                            "z": toAddItem.quat.z,
                            "w": toAddItem.quat.w
                        }
                    },
                    {
                        "type": "StructProperty",
                        "name": "Translation",
                        "subtype": "Vector",
                        "guid": "00000000000000000000000000000000",
                        "value": {
                            "x": toAddItem.x * 100 + 7060,
                            "y": toAddItem.y * 100 - 3450,
                            "z": 0
                        }
                    },
                    {
                        "type": "StructProperty",
                        "name": "Scale3D",
                        "subtype": "Vector",
                        "guid": "00000000000000000000000000000000",
                        "value": {
                            "x": 1,
                            "y": toAddItem.flipped ? -1 : 1,
                            "z": 1
                        }
                    },
                    {
                        "type": "NoneProperty"
                    }
                ]
            },
            {
                "name": "GridCellIdentifier_13_54D6E0814F9B2836626175BCF956C204",
                "type": "StrProperty",
                "hasGuid": false,
                "value": ""
            },
            {
                "type": "StructProperty",
                "name": "InteractableGUID_16_A8C04C4D4B541E2ABB9E14813A3981BD",
                "subtype": "Guid",
                "guid": "00000000000000000000000000000000",
                "value": randomHex32()
            },
            {
                "type": "NoneProperty"
            }
        ]
        interactables.push(newValue);
    }

    for (let toEraseGuid of toErase) {
        for (let i = interactables.length - 1; i >= 0; i--) {
            const interactable = interactables[i];
            if (interactable[4].value === toEraseGuid) {
                interactables.splice(i, 1);
                break;
            }
        }
    }

    const dataStr = convertRawToSav(levelData);

    const dataBlob = new Blob([dataStr], { type: 'octet/stream' });

    const link = document.createElement('a');
    link.href = URL.createObjectURL(dataBlob);
    link.download = 'Save1.sav';
    link.click();
}
window.exportLevel = exportLevel;


function processInteractable(interactable) {
    let transform = interactable[2].value;
    let ObjectName = interactable[0].value;
    let translation = transform[1].value;
    let quat = transform[0].value;
    let Scale3D = transform[2].value;
    let x = (translation.x - 7060) / 100;
    let y = (translation.y + 3450) / 100;
    x = Math.floor(x);
    y = Math.floor(y);
    if (x < 0 || x >= 50 || y < 0 || y >= 40) {
        console.warn("Skipping out-of-bounds tile at:", x, y);
        return;
    }

    if (!ObjectName.includes("/ConveyorBelt/") && !ObjectName.includes("/Storage/")) {
        console.warn("Skipping:", ObjectName);
        return;
    }
    let type = 'unknown';
    switch (ObjectName) {
        case "/Game/Core/Blueprints/Actors/ConveyorBelt/BP_ConveyorBelt_Straight_Tier1.BP_ConveyorBelt_Straight_Tier1_C":
            type = 'belt';
            break;
        case "/Game/Core/Blueprints/Actors/ConveyorBelt/BP_ConveyorBelt_Corner_Tier1.BP_ConveyorBelt_Corner_Tier1_C":
            type = 'corner';
            break;
        case "/Game/Core/Blueprints/Actors/ConveyorBelt/Loader/BP_ConveyorBelt_Loader.BP_ConveyorBelt_Loader_C":
            type = 'loader';
            break;
        case "/Game/Core/Blueprints/Actors/ConveyorBelt/Loader/BP_ConveyorBelt_Unloader.BP_ConveyorBelt_Unloader_C":
            type = 'unloader';
            break;
        case "/Game/Core/Blueprints/Actors/ConveyorBelt/Joiner/BP_ConveyorBelt_Joiner.BP_ConveyorBelt_Joiner_C":
            type = 'joiner';
            break;
        case "/Game/Core/Blueprints/Actors/ConveyorBelt/Pauser/BP_ConveyorBelt_Pauser.BP_ConveyorBelt_Pauser_C":
            type = 'pauser';
            break;
        case "/Game/Core/Blueprints/Actors/ConveyorBelt/CriteriaScanner/BP_ConveyorBelt_CriteriaScanner_SerialNumber.BP_ConveyorBelt_CriteriaScanner_SerialNumber_C":
            type = 'serial';
            break;
        case "/Game/Core/Blueprints/Actors/ConveyorBelt/CriteriaScanner/BP_ConveyorBelt_CriteriaScanner_Weight.BP_ConveyorBelt_CriteriaScanner_Weight_C":
            type = 'weight';
            break;
        case "/Game/Core/Blueprints/Actors/ConveyorBelt/CriteriaScanner/BP_ConveyorBelt_CriteriaScanner_Country.BP_ConveyorBelt_CriteriaScanner_Country_C":
            type = 'country';
            break;
        case "/Game/Core/Blueprints/Actors/Storage/Medium/BP_StorageRack_ExtraLarge_Red.BP_StorageRack_ExtraLarge_Red_C":
            type = 'rack_red';
            break;
        case "/Game/Core/Blueprints/Actors/ConveyorBelt/StickerApplier/BP_ConveyorBelt_StickerApplier_Deny.BP_ConveyorBelt_StickerApplier_Deny_C":
            type = 'sticker_deny';
            break;
        case "/Game/Core/Blueprints/Actors/ConveyorBelt/StickerApplier/BP_ConveyorBelt_StickerApplier_Approve.BP_ConveyorBelt_StickerApplier_Approve_C":
            type = 'sticker_approve';
            break;
        case "/Game/Core/Blueprints/Actors/ConveyorBelt/CriteriaScanner/BP_ConveyorBelt_CriteriaScanner_Stamp.BP_ConveyorBelt_CriteriaScanner_Stamp_C":
            type = 'stamp';
            break;
        case "/Game/Core/Blueprints/Actors/ConveyorBelt/Scanner2/BP_ConveyorBelt_Scanner2_Tier1.BP_ConveyorBelt_Scanner2_Tier1_C":
            type = 'scanner';
            break;
        case "/Game/Core/Blueprints/Actors/ConveyorBelt/Diverter/BP_ConveyorBelt_Diverter.BP_ConveyorBelt_Diverter_C":
            type = 'diverter';
            break;
        case "/Game/Core/Blueprints/Actors/ConveyorBelt/Bridger/BP_ConveyorBelt_Bridger.BP_ConveyorBelt_Bridger_C":
            type = 'bridger';
            break;
        case "/Game/Core/Blueprints/Actors/ConveyorBelt/CriteriaScanner/BP_ConveyorBelt_CriteriaScanner_ContentsProhibited.BP_ConveyorBelt_CriteriaScanner_ContentsProhibited_C":
            type = 'contents_prohibited';
            break;
        case "/Game/Core/Blueprints/Actors/ConveyorBelt/CriteriaScanner/BP_ConveyorBelt_CriteriaScanner_CargoType.BP_ConveyorBelt_CriteriaScanner_CargoType_C":
            type = 'cargo_type';
            break;
        case "/Game/Core/Blueprints/Actors/ConveyorBelt/Joiner/BP_ConveyorBelt_Joiner_3Way.BP_ConveyorBelt_Joiner_3Way_C":
            type = 'joiner_3way';
            break;
        case "/Game/Core/Blueprints/Actors/ConveyorBelt/Splitter/BP_ConveyorBelt_Splitter.BP_ConveyorBelt_Splitter_C":
            type = 'splitter';
            break;
        case "/Game/Core/Blueprints/Actors/ConveyorBelt/Splitter/BP_ConveyorBelt_Splitter_2Way.BP_ConveyorBelt_Splitter_2Way_C":
            type = 'splitter_2way';
            break;
        case "/Game/Core/Blueprints/Actors/ConveyorBelt/Launcher/BP_ConveyorBelt_Launcher.BP_ConveyorBelt_Launcher_C":
            type = 'launcher';
            break;
        default:
            console.warn("Unknown object:", ObjectName);
            break;
    }

    const tileData = {
        type: type,
        flipped: Scale3D.y < 0,
        quat: quat,
        guid: interactable[4].value,
        x: translation.x,
        y: translation.y,
        interactable: interactable
    };

    if (type == 'bridger') {
        // Racks are 3x1 so occupy extra tiles
        const s = Math.sqrt(1 - quat.w * quat.w);
        if (!(s < 0.0001)) {
            if (x + 1 < 50) {
                grid[y][x + 1] = { ...tileData };
                grid[y][x + 1].type = 'bridger_up';
                if (tileData.flipped) {
                    grid[y][x + 1].type = 'bridger_down';
                }
            }
            if (x + 1 > 0) {
                grid[y][x - 1] = { ...tileData };
                grid[y][x - 1].type = 'bridger_down';
                if (tileData.flipped) {
                    grid[y][x - 1].type = 'bridger_up';
                }
            }
        } else {
            if (y + 1 < 50) {
                grid[y + 1][x] = { ...tileData };
                grid[y + 1][x].type = 'bridger_up';
                if (tileData.flipped) {
                    grid[y + 1][x].type = 'bridger_down';
                }
            }
            if (y + 1 > 0) {
                grid[y - 1][x] = { ...tileData };
                grid[y - 1][x].type = 'bridger_down';
                if (tileData.flipped) {
                    grid[y - 1][x].type = 'bridger_up';
                }
            }

        }
        return;
    }

    if (grid[y][x] != null) {
        console.warn("Tile already occupied at:", x, y);
        return;
    }

    grid[y][x] = tileData;

    if (type == 'rack_red') {
        // Racks are 3x1 so occupy extra tiles
        const s = Math.sqrt(1 - quat.w * quat.w);
        if (s < 0.0001) {
            if (x + 1 < 50)
                grid[y][x + 1] = grid[y][x];
            if (x + 1 > 0)
                grid[y][x - 1] = grid[y][x];
        } else {
            if (y + 1 < 50)
                grid[y + 1][x] = grid[y][x];
            if (y + 1 > 0)
                grid[y - 1][x] = grid[y][x];

        }
    }

    if (type == 'bridger') {
        // Racks are 3x1 so occupy extra tiles
        const s = Math.sqrt(1 - quat.w * quat.w);
        if (s < 0.0001) {
            if (x + 1 < 50)
                grid[y][x + 1] = grid[y][x];
            if (x + 1 > 0)
                grid[y][x - 1] = grid[y][x];
        } else {
            if (y + 1 < 50)
                grid[y + 1][x] = grid[y][x];
            if (y + 1 > 0)
                grid[y - 1][x] = grid[y][x];

        }
    }
}

function quatToRotate3d(q) {
    const x = q.x;
    const y = q.y;
    const z = q.z;
    const w = q.w;

    // Clamp w to valid range for acos to avoid NaNs due to floating-point errors
    const clampedW = Math.min(1, Math.max(-1, w));

    // Step 1: compute angle (in radians)
    let angle = 2 * Math.acos(clampedW);

    // Step 2: compute axis
    const s = Math.sqrt(1 - clampedW * clampedW);

    let axisX, axisY, axisZ;
    if (s < 0.0001) {
        // If s is close to zero, axis direction doesn't matter
        return "";
    } else {
        axisX = x / s;
        axisY = y / s;
        axisZ = z / s;
    }

    //console.log(`W: ${w}, Angle (rad): ${angle}, Axis: (${axisX}, ${axisY}, ${axisZ})`);

    return `rotate3d(${axisX}, ${axisY}, ${axisZ}, ${angle}rad)`;
}

function updateCellTransform(cell, tileData) {
    if (tileData.quat) {
        cell.style.transform = quatToRotate3d(tileData.quat);
    }
    if (tileData.flipped) {
        cell.style.transform += 'scaleY(-1)'
    }
}
function updateGrid() {
    // Update visual grid
    for (let row = 0; row < 40; row++) {
        for (let col = 0; col < 50; col++) {
            const cell = getCellElement(row, col);
            const tileData = grid[row][col];
            if (tileData) {
                cell.style.background = `url("css/${tileData.type}.png") no-repeat center`;
                updateCellTransform(cell, tileData);

                cell.dataset.guid = tileData.guid;
                cell.dataset.x = tileData.x;
                cell.dataset.y = tileData.y;
            } else {
                cell.className = 'grid-cell';
            }
        }
    }
}

export function importLevel() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.sav';

    input.onchange = (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
                try {
                    levelData = convertSavToRaw(event.target.result);
                    window.levelData = levelData;

                    // grid = levelData.tiles;

                    // // Import deposits if they exist
                    // if (levelData.deposits) {
                    //     deposits = levelData.deposits.map(d => ({
                    //         id: Date.now() + Math.random(),
                    //         side: d.side,
                    //         tileRow: d.tileRow,
                    //         tileCol: d.tileCol,
                    //         x: (d.side === 'top' || d.side === 'bottom') ? d.tileCol * 17 : 0,
                    //         y: (d.side === 'left' || d.side === 'right') ? d.tileRow * 17 : 0,
                    //         label: d.label,
                    //         color: d.color,
                    //         selected: false
                    //     }));
                    //     renderDeposits();
                    //     updateGridCellConnections();
                    // } else {
                    //     deposits = [];
                    // }



                    for (let i = 0; i < levelData.length; i++) {
                        if (levelData[i].name === "InteractablesToSpawn") {
                            let interactables = levelData[i].value;
                            for (let j = 0; j < interactables.length; j++) {
                                processInteractable(interactables[j]);
                            }
                        }
                        if (levelData[i].name === "StorageRacksAndParcels") {
                            let racks = levelData[i].value;
                            for (let j = 0; j < racks.length; j++) {
                                if (racks[j][0].subtype == "F_InteractableToSave") {
                                    processInteractable(racks[j][0].value);
                                }
                            }
                        }
                    }


                    updateGrid();

                    clearSelection();
                    updateDepositCount();
                    //alert('Level imported successfully!');
                } catch (error) {
                    alert('Error importing level: ' + error.message);
                }
            };
            reader.readAsArrayBuffer(file);
        }
    };

    input.click();
}

window.importLevel = importLevel;

// Initialize the editor when the page loads
init();