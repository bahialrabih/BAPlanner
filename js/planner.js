const DATA_URL = {
    students: 'https://schaledb.com/data/en/students.min.json',
    summons: 'https://schaledb.com/data/en/summons.min.json',
    raids: 'https://schaledb.com/data/en/raids.min.json',
    equipment: 'https://schaledb.com/data/en/equipment.min.json',
    items: 'https://schaledb.com/data/en/items.min.json',
    currency: 'https://schaledb.com/data/en/currency.min.json',
    enemies: 'https://schaledb.com/data/en/enemies.min.json',
    furniture: 'https://schaledb.com/data/en/furniture.min.json',
    shops: 'https://schaledb.com/data/shops.min.json'
};

const LOCAL_STORAGE_KEY = 'PlannerSelectionData';

document.addEventListener('DOMContentLoaded', async () => {
    // Show loading overlay
    const loadingOverlay = document.getElementById('loadingOverlay');

    try {
        const studData = await fetchData(DATA_URL.students);
        const eqiupData = await fetchData(DATA_URL.equipment);
        const itemsData = await fetchData(DATA_URL.items);
        const shopsData = await fetchData(DATA_URL.shops);

        if (!studData || !eqiupData || !itemsData || !shopsData) {
            throw new Error('Failed to load required data.');
        }

        const ctrl = new Controller(studData, eqiupData, itemsData, shopsData);
        ctrl.constructStudentTable();
        ctrl.constructArtifactTable();
        ctrl.constructEquipmentTable();
        ctrl.constructSchoolTable();
        ctrl.updateStats();

        // Hide loading overlay after data is loaded
        setTimeout(() => {
            loadingOverlay.classList.add('hidden');
        }, 500);

    }
    catch (error) {
        console.error('Error loading data:', error);
        alert('Failed to load data. Please refresh the page and try again.');
        loadingOverlay.classList.add('hidden');
    }

    document.querySelector('#searchBar').value = '';
});




class Controller {

    constructor(studentData, equipmentData, itemsData, shopsData) {
        this.studentData = studentData;
        this.equipmentData = equipmentData;
        this.shopsData = shopsData;
        this.artifactsData = Object.fromEntries(
            Object.entries(itemsData).filter(([, value]) => value.SubCategory === "Artifact")
        );
        this.techNotes = Object.values(itemsData).filter(item => item.Category === 'Material' && item.SubCategory === "BookItem").sort((a, b) => a.Quality - b.Quality);
        this.blueRays = Object.values(itemsData).filter(item => item.Category === 'Material' && item.SubCategory === "CDItem").sort((a, b) => a.Quality - b.Quality);
        this.selectionData;
        this.headers = {
            students: [
                { label: "Student", sortFuncName: null },
                { label: "Name", sortFuncName: 'localeCompareSort' },
                { label: "School", sortFuncName: 'localeCompareSort' },
                { label: "Equipment", sortFuncName: 'boolCompareSort', cacheKey: "Equipment" },
                { label: "Artifact", sortFuncName: 'boolCompareSort', cacheKey: "Artifact" }
            ],
            artifacts: [
                { label: "Artifact", sortFuncName: null },
                { label: "Name", sortFuncName: 'localeCompareSort' },
                { label: "JFD?", sortFuncName: 'localeCompareSort' },
                { label: "Total", sortFuncName: 'artifactTotalSort' },
                { label: "Students", sortFuncName: null }
            ],
            equipment: [
                { label: "Equipment", sortFuncName: null },
                { label: "Total", sortFuncName: 'numberCompareSort' },
                { label: "Students", sortFuncName: null }
            ],
            school: [
                { label: "School", sortFuncName: null },
                { label: "Total", sortFuncName: 'numberCompareSort' },
                { label: "Students", sortFuncName: null },
                { label: "Tech Notes", sortFuncName: null },
                { label: "Blue Rays", sortFuncName: null },
            ]
        };
        this.modifyData();
        this.initSelectionData();
    }

    initSelectionData() {
        this.selectionData = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEY)) ?? { Artifact: [], Equipment: [] };
    }
    updateLocalStorage() {
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(this.selectionData));
        this.updateStats();
    }

    updateStats() {
        // Count students selected for artifacts only
        const artifactStudentsCount = this.selectionData.Artifact.length;

        // Count students selected for equipment only
        const equipmentStudentsCount = this.selectionData.Equipment.length;

        // Update DOM elements for individual counts
        document.getElementById('artifactStudentsCount').textContent = artifactStudentsCount;
        document.getElementById('equipmentStudentsCount').textContent = equipmentStudentsCount;
    }

    modifyData() {
        Object.values(this.studentData).forEach(student => {
            student.href = `https://schaledb.com/student/${student.PathName}`;
            student.IconUrl = `https://schaledb.com/images/student/collection/${student.Id}.webp`;
            student.TotalMaterialUsage = aggregateMaterialUsage(student);
        });
        Object.values(this.artifactsData).forEach(arti => {
            arti.href = `https://schaledb.com/item/${arti.Id}`;
            arti.IconUrl = `https://schaledb.com/images/item/full/${arti.Icon}.webp`;
        });
        Object.values(this.equipmentData).forEach(equip => {
            equip.href = `https://schaledb.com/equipment/${equip.Id}`;
            equip.IconUrl = `https://schaledb.com/images/equipment/full/${equip.Icon}.webp`;
        });
    }

    constructStudentTable() {
        let studentsDataArr = Object.values(this.studentData).sort();
        let selectionData = this.selectionData;
        let headers = this.headers.students;
        const table = document.getElementById('char_list_table');
        table.innerHTML = "";
        const thead = table.createTHead();
        // thead.insertRow().innerHTML = headers.map(header => `<th>${header.label}</th>`).join('');
        thead.appendChild(constructHeaderTR(headers, '#char_list_table'));
        const tbody = table.createTBody();
        studentsDataArr.forEach((student, rowIndex) => {
            let count = 0;
            // create empty row
            const row = tbody.insertRow(rowIndex);
            row.setAttribute('student-id', student.Id);
            // Cell 1: icon
            const cell1 = row.insertCell(0);
            const iconContainerDiv = document.createElement('div');
            iconContainerDiv.setAttribute('search-key', student.Name);
            iconContainerDiv.setAttribute('Title', student.Name);
            const hyperlink = document.createElement('a');
            hyperlink.href = student.href;
            hyperlink.target = "_blank";
            const iconElement = document.createElement('img')
            iconElement.src = student.IconUrl;
            iconElement.alt = student.Name;
            hyperlink.appendChild(iconElement);
            iconContainerDiv.appendChild(hyperlink);
            cell1.appendChild(iconContainerDiv);
            cell1.setAttribute('header-name', headers[count++].label);
            // Cell 2: name
            const cell2 = row.insertCell(1);
            cell2.setAttribute('header-name', headers[count++].label);
            cell2.innerHTML = student.Name;
            // Cell 3: school
            const cell3 = row.insertCell(2);
            cell3.innerHTML = student.School;
            cell3.setAttribute('header-name', headers[count++].label);
            // Cell 4: user input
            const cell4 = row.insertCell(3);
            const cell4Checkbox = createCheckbox();
            cell4Checkbox.title = headers[count].label;
            cell4.appendChild(cell4Checkbox);
            cell4.setAttribute('header-name', headers[count].label);

            if (selectionData[headers[count].cacheKey] && selectionData[headers[count].cacheKey].includes(String(student.Id))) {
                cell4.querySelector('input').checked = true;
            }
            count++;
            // Cell 5: user input
            const cell5 = row.insertCell(4);
            const cell5Checkbox = createCheckbox();
            cell5Checkbox.title = headers[count].label;
            cell5.appendChild(cell5Checkbox);
            cell5.setAttribute('header-name', headers[count].label);

            if (selectionData[headers[count].cacheKey] && selectionData[headers[count].cacheKey].includes(String(student.Id))) {
                cell5.querySelector('input').checked = true;
            }
            count++;
        });
        // ----- Handle checkbox changes ----- Use a debounce for constructing the whole table
        const refreshLocalStorageAndTables = debounce(() => {
            this.updateLocalStorage();
            // Refresh all tables (except the first one since that one is controlled by user selection)
            this.constructArtifactTable();
            this.constructEquipmentTable();
            this.constructSchoolTable();
        }, 300);
        tbody.addEventListener('change', (event) => {
            if (event.target.tagName === 'INPUT' && event.target.type === 'checkbox') {
                const checkbox = event.target;
                const tr = checkbox.closest('tr');
                const studentId = tr.getAttribute('student-id');
                const headerName = checkbox.closest('td').getAttribute('header-name');
                if (selectionData[headerName]) {
                    if (checkbox.checked && !selectionData[headerName].includes(studentId)) {
                        selectionData[headerName].push(studentId);
                    }
                    else {
                        selectionData[headerName] = selectionData[headerName].filter(id => id !== studentId);
                    }
                }
                refreshLocalStorageAndTables();
            }
        });
    }
    constructArtifactTable() {
        // we target only the students that are selected in the student table for artifacts
        const targetStudentIds = this.selectionData.Artifact;
        let artifactDataList = Object.values(this.artifactsData).sort((a, b) => b.Quality - a.Quality);
        const table = document.getElementById('artifact_list_table');
        table.innerHTML = ""; // Clear the table before populating it again
        const thead = table.createTHead();
        const headers = this.headers.artifacts;
        // thead.insertRow().innerHTML = headers.map(header => `<th>${header.label}</th>`).join('');
        thead.appendChild(constructHeaderTR(headers, '#artifact_list_table'));
        const tbody = table.createTBody();
        artifactDataList.forEach((arti, rowIndex) => {
            const studentIdsOfThisArtifact = targetStudentIds.filter(id => this.studentData[id].TotalMaterialUsage[arti.Id] > 0);
            let count = 0;
            // create empty row
            const row = tbody.insertRow(rowIndex);
            row.setAttribute('arti-id', arti.Id);
            row.setAttribute('arti-quality', arti.Quality);
            // Cell 1: icon
            const cell1 = row.insertCell(0);
            cell1.setAttribute('header-name', headers[count++].label);
            const iconContainerDiv = document.createElement('div');
            iconContainerDiv.setAttribute('search-key', arti.Name);
            iconContainerDiv.setAttribute('Title', arti.Name);
            const hyperlink = document.createElement('a');
            hyperlink.href = arti.href;
            hyperlink.target = "_blank";
            const iconElement = document.createElement('img');
            iconElement.src = arti.IconUrl;
            iconElement.alt = arti.Name;
            hyperlink.appendChild(iconElement);
            iconContainerDiv.appendChild(hyperlink);
            cell1.appendChild(iconContainerDiv);
            // Cell 2: name
            const cell2 = row.insertCell(1);
            cell2.innerHTML = arti.Name;
            cell2.setAttribute('header-name', headers[count++].label);
            // Cell 3: is JFD?
            const cell3 = row.insertCell(2);
            const isJFD = this.shopsData[0].TimeAttack.find(elem => elem.Reward.Id === arti.Id);
            cell3.innerHTML = isJFD
                ? '<span title="Yes" class="jfd-yes">✔️</span>'
                : '<span title="No" class="jfd-no">❌</span>';
            cell3.setAttribute('header-name', headers[count++].label);
            // Cell 4: total
            const cell4 = row.insertCell(3);
            cell4.innerHTML = studentIdsOfThisArtifact.reduce((acc, id) => acc + this.studentData[id].TotalMaterialUsage[arti.Id], 0);
            cell4.setAttribute('header-name', headers[count++].label);
            // Cell 5: Student List
            const cell5 = row.insertCell(4);
            cell5.setAttribute('header-name', headers[count++].label);
            // const studentIds = ["10000", "10001", "10002", "10003", "10004", "10005", "10006", "10007", "10008", "10009", "10010", "10011", "10012", "10013", "10014", "10015", "10016", "10017", "10018", "10019", "10020"];
            cell5.appendChild(this.createImageListWithArtiQuantity(studentIdsOfThisArtifact, arti.Id));
        });
    }
    constructEquipmentTable() {
        const bprintAggregatedUses = getAggregateBlueprint();
        const EQUIPMENT_DATA_CATEGORIES = ["Hat","Gloves","Shoes","Bag","Badge","Hairpin","Charm","Watch","Necklace"];
        const equipmentDataList = Object.values(this.equipmentData)
                                .filter(dt=>EQUIPMENT_DATA_CATEGORIES.includes(dt.Category) && !dt.Name.endsWith(" Blueprint") && !dt.Name.endsWith("の設計図") && dt.Tier > 1)
                                .sort((a, b) => a.Tier === b.Tier ? a.Name.localeCompare(b.Name) : b.Tier - a.Tier);
        const table = document.getElementById('equipment_list_table');
        table.innerHTML = ""; // Clear the table before populating it again
        const thead = table.createTHead();
        const headers = this.headers.equipment;
        // thead.insertRow().innerHTML = headers.map(header => `<th>${header.label}</th>`).join('');
        thead.appendChild(constructHeaderTR(headers, '#equipment_list_table'));
        const tbody = table.createTBody();
        equipmentDataList.forEach((equip, rowIndex) => {
            const studentIdsOfThisEquipment = this.selectionData.Equipment.filter(id => this.studentData[id].Equipment.includes(equip.Category));
            let count = 0;
            // create empty row
            const row = tbody.insertRow(rowIndex);
            row.setAttribute('equip-id', equip.Id);
            row.setAttribute('equip-quality', equip.Tier);
            // Cell 1: icon
            const cell1 = row.insertCell(0);
            cell1.setAttribute('header-name', headers[count++].label);
            const hyperlink = document.createElement('a');
            hyperlink.href = equip.href;
            hyperlink.target = "_blank";
            const iconElement = document.createElement('div');
            iconElement.setAttribute('search-key', equip.Name);
            iconElement.setAttribute('Title', equip.Name);
            iconElement.setAttribute('class', 'image-with-quantity');
            iconElement.innerHTML = `
                <img src="${equip.IconUrl}"/>
                <span class="quantity-badge">${equip.Category} T${equip.Tier}</span>`;
            hyperlink.appendChild(iconElement);
            cell1.appendChild(hyperlink);
            // Cell 2: Total Quantity
            const cell2 = row.insertCell(1);
            cell2.setAttribute('header-name', headers[count++].label);
            cell2.textContent = bprintAggregatedUses[equip.Tier] * studentIdsOfThisEquipment.length;
            // Cell 3: Students
            const cell3 = row.insertCell(2);
            cell3.setAttribute('header-name', headers[count++].label);
            cell3.appendChild(this.createImageList(studentIdsOfThisEquipment));
        });
    }
    constructSchoolTable() {
        const table = document.getElementById('school_list_table');
        table.innerHTML = ""; // Clear the table before populating it again
        const thead = table.createTHead();
        const headers = this.headers.school;
        thead.appendChild(constructHeaderTR(headers, '#school_list_table'));
        const tbody = table.createTBody();

        const allSelectedIds = new Set([
            ...this.selectionData.Artifact,
            ...this.selectionData.Equipment
        ]);
        const selectedStudentsBySchool =
            Object.values(this.studentData)
                            .filter(student => allSelectedIds.has(String(student.Id)))
                            .reduce((acc, student) => {
                                let school = student.School || "Unknown";
                                school = school === 'SRT' ? 'Valkyrie' : school; // Handle SRT as Valkyrie since they grouped together in game
                                acc[school] ||= [];
                                acc[school].push(student.Id);
                                return acc;
                            }, {});

        const schools = Object.keys(selectedStudentsBySchool).sort();
        schools.forEach((school, rowIndex) => {
            const studentIdsOfThisSchool = selectedStudentsBySchool[school];
            let count = 0;
            // create empty row
            const row = tbody.insertRow(rowIndex);
            row.setAttribute('school-name', school);
            // Cell 1: icon
            const cell1 = row.insertCell(0);
            cell1.setAttribute('header-name', headers[count++].label);
            cell1.textContent = school;
            // Cell 2: Total Quantity
            const totalQuantity = studentIdsOfThisSchool.length;
            const cell2 = row.insertCell(1);
            cell2.setAttribute('header-name', headers[count++].label);
            cell2.textContent = totalQuantity;
            // Cell 3: Students
            const cell3 = row.insertCell(2);
            cell3.setAttribute('header-name', headers[count++].label);
            cell3.appendChild(this.createImageList(studentIdsOfThisSchool));
            // Cell 4: Tech notes
                /* Sample data format:
    data = [
        {
            imgSrc: 'https://example.com/image1.jpg',
            Quantity: 1,
            name: 'Item 1'
        }
    ]
    */
            // Assumes need x25 for Quality 1-3 and x20 for Quality 4 - needs improvement to by dynamically fetched from studentData (todo later)
            // The above quantity is then multiplied by 3 (for 3 skills)
            // This assumption is mostly correct, but will not work for collab students since they dont have standard material usage
            const cell4 = row.insertCell(3);
            cell4.setAttribute('header-name', headers[count++].label);
            // Todo the filter function is weak matching by name -> should later by matched from studentData by IDs
            const techNoteData = this.techNotes.filter(tn => tn.Name.toLowerCase().replaceAll(' ', '').includes(school.toLowerCase().replaceAll(' ', '')))
                                    .map(tn => ({
                                        imgSrc: `https://schaledb.com/images/item/full/${tn.Icon}.webp`,
                                        Quantity: 3 * totalQuantity * (tn.Quality===4 ? 20 : 25),
                                        name: tn.Name
                                    }));
            cell4.appendChild(createGenericImageList(techNoteData));

            // Assumes need 30 for Quality 1-3 and x8 for Quality 4 - needs improvement to by dynamically fetched from studentData (todo later)
            // This assumption is mostly correct, but will not work for collab students since they dont have standard material usage
            const cell5 = row.insertCell(4);
            cell5.setAttribute('header-name', headers[count++].label);
            const blueRayData = this.blueRays.filter(tn => tn.Name.toLowerCase().replaceAll(' ', '').includes(school.toLowerCase().replaceAll(' ', '')))
                                    .map(tn => ({
                                        imgSrc: `https://schaledb.com/images/item/full/${tn.Icon}.webp`,
                                        Quantity: totalQuantity * (tn.Quality===4 ? 8 : 30),
                                        name: tn.Name
                                    }));
            cell5.appendChild(createGenericImageList(blueRayData));
        });
    }
    createImageListWithArtiQuantity(studentIds, artifactId) {
        const flexbox = document.createElement('div');
        flexbox.setAttribute('class', 'image-list-container');
        studentIds.forEach(id => {
            const student = this.studentData[id];
            const quantity = student.TotalMaterialUsage[artifactId];
            const imgDiv = document.createElement('div');
            imgDiv.setAttribute('class', 'image-with-quantity');
            imgDiv.setAttribute('search-key', student.Name);
            imgDiv.setAttribute('Title', student.Name);
            imgDiv.innerHTML = `
            <a href="${student.href}" target="_blank">
                <img src="${student.IconUrl}" alt="${student.Name}"/>
                <span class="quantity-badge">x ${quantity}</span>
            </a>`;
            flexbox.appendChild(imgDiv);
        });
        return flexbox;
    }
    createImageList(studentIds) {
        const flexbox = document.createElement('div');
        flexbox.setAttribute('class', 'image-list-container');
        studentIds.forEach(id => {
            const student = this.studentData[id];
            const imgDiv = document.createElement('div');
            imgDiv.setAttribute('search-key', student.Name);
            imgDiv.setAttribute('Title', student.Name);
            const hyperlink = document.createElement('a');
            hyperlink.href = student.href;
            hyperlink.target = "_blank";
            const img = document.createElement('img');
            img.alt = student.Name;
            img.src = student.IconUrl;
            hyperlink.appendChild(img);
            imgDiv.appendChild(hyperlink);
            flexbox.appendChild(imgDiv);
        });
        return flexbox;
    }
}

function createGenericImageList(dataList=[]) {
    /* Sample data format:
    data = [
        {
            imgSrc: 'https://example.com/image1.jpg',
            Quantity: 1,
            name: 'Item 1'
        }
    ]
    */
    const flexbox = document.createElement('div');
    flexbox.setAttribute('class', 'image-list-container');
    dataList.forEach(data => {
        const imgDiv = document.createElement('div');
        imgDiv.setAttribute('search-key', data.name);
        imgDiv.setAttribute('Title', data.name);
        const img = document.createElement('img');
        img.alt = data.name;
        img.src = data.imgSrc;
        imgDiv.appendChild(img);
        if (data.Quantity != null) {
            imgDiv.setAttribute('class', 'image-with-quantity');
            const span = document.createElement('span');
            span.setAttribute('class', 'quantity-badge');
            span.textContent = `x ${data.Quantity}`;
            imgDiv.appendChild(span);
        }
        flexbox.appendChild(imgDiv);
    });
    return flexbox;
}

async function fetchData(url) {
    // Create AbortController with 30 second timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    try {
        const response = await fetch(url, { signal: controller.signal });
        clearTimeout(timeoutId);

        if (!response.ok) {
            console.error('Failed to fetch data from ', url, ':', response.statusText);
            return null;
        }
        const data = await response.json();
        return data;
    }
    catch (error) {
        clearTimeout(timeoutId);
        if (error.name === 'AbortError') {
            console.error('Request to', url, 'timed out after 30 seconds');
        }
        else {
            console.error('Error fetching data from', url, ':', error.message);
        }
        throw error; // Re-throw the error to be handled by the caller
    }
}
function createCheckbox() {
    const container = document.createElement('div');
    container.setAttribute('class', 'checkbox-container');
    const wrapper = document.createElement('div');
    wrapper.setAttribute('class', 'checkbox-wrapper');
    const checkbox = document.createElement('input');
    checkbox.setAttribute('type', 'checkbox');
    const checkboxDiv = document.createElement('div');
    checkboxDiv.setAttribute('class', 'checkbox');
    wrapper.appendChild(checkboxDiv);
    checkboxDiv.appendChild(checkbox);
    container.appendChild(wrapper);
    return container;
    /* Sample:
    <div class="checkbox-container">
        <div class="checkbox-wrapper">
            <div class="checkbox">
                <input type="checkbox"/>
            </div>
        </div>
    </div>
    */
}

function aggregateMaterialUsage(studentData) {
    const materialTotals = {};
    function process(materialList, amountList, count) {
        for (let i = 0; i < materialList.length; i++) {
            const ids = materialList[i];
            const amounts = amountList[i];

            for (let j = 0; j < ids.length; j++) {
                const id = ids[j];
                const amount = amounts[j];

                if (!materialTotals[id]) {
                    materialTotals[id] = 0;
                }
                materialTotals[id] += amount * count;
            }
        }
    }
    process(studentData.SkillExMaterial, studentData.SkillExMaterialAmount, 1);
    process(studentData.SkillMaterial, studentData.SkillMaterialAmount, 3);
    /* Sample
    {
    '150': 81,
    '151': 70,
    '152': 57,
    '153': 22,
    '3030': 30,
    '3031': 30,
    '3032': 30,
    '3033': 8,
    '4030': 25,
    '4031': 25,
    '4032': 25,
    '4033': 20
    }
    */
    return materialTotals;
}


function getAggregateBlueprint() {
    const blueprintsPerTier = {
        "2": {
            "2": 15
        },
        "3": {
            "3": 20
        },
        "4": {
            "4": 30,
            "2": 10
        },
        "5": {
            "5": 35,
            "3": 20,
            "2": 15
        },
        "6": {
            "6": 40,
            "4": 15,
            "3": 5
        },
        "7": {
            "7": 40,
            "5": 15,
            "4": 5
        },
        "8": {
            "8": 40,
            "6": 15,
            "5": 5
        },
        "9": {
            "9": 50,
            "7": 15,
            "6": 10
        },
        "10": {
            "10": 60,
            "8": 20,
            "7": 10,
        }
    }

    const blueprintsAggregated = {
        "2": 0,
        "3": 0,
        "4": 0,
        "5": 0,
        "6": 0,
        "7": 0,
        "8": 0,
        "9": 0,
        "10": 0
    };

    for (const tier in blueprintsPerTier) {
        for (const subTier in blueprintsPerTier[tier]) {
            blueprintsAggregated[subTier] += blueprintsPerTier[tier][subTier];
        }
    }
    return blueprintsAggregated;
}

function debounce(func, timeout = 300){
    // console.log('debounce --------------------------------- start'); // only seen once in the console log
    let timer;
    return function(...args) {
        // console.log('Clearing previous timer: id=', timer);
        clearTimeout(timer);
        // timer = setTimeout(func, timeout, ...args);
        timer = setTimeout(() => func.apply(this, args), timeout);
    };
}

function searchBarOnInput(event) {
    // console.log('searchBarOnInput --------------------------------- called'); // this should be seen only once in the console log
    event.target.oninput = debounce(filterTable, 300); // override the oninput handler by the debouncer
    // event.target.addEventListener('input', debounce(filterTable, 300)); // wrong - we should override the oninput handler by the debouncer. Otherwise, we will have multiple calls to searchBarOnInput
}


function filterTable(event) {
    const filter = event.target.value?.toLowerCase();
    if (!filter) {
        clearFilter();
        return;
    }

    const rows = document.querySelectorAll('table[apply-filter="true"] tr');
    rows.forEach(tr => {
        let found = false;
        tr.querySelectorAll('td').forEach(cell => {
            if (cell.textContent.toLowerCase().includes(filter)) {
                found = true;
            }
        });
        tr.querySelectorAll('[search-key]').forEach(ele => {
            const searchKey = ele.getAttribute('search-key');
            if (searchKey && searchKey.toLowerCase().includes(filter)) {
                found = true;
            }
        });
        if (found) {
            tr.classList.remove('hide');
        }
        else {
            tr.classList.add('hide');
        }
    });
}

function clearFilter() {
    document.querySelectorAll('tr').forEach(row => {
        row.classList.remove('hide');
    });
}

function sortTableRows(tableSelector, sortFunctionName, sortFunctionArgs) {
    // const sortFunc = sortFunctions[sortFunctionName];
    const sortFunc = sortFunctionFactory[sortFunctionName](...sortFunctionArgs);
    if (!sortFunc) {
        console.error(`Sort function "${sortFunctionName}" not found.`);
        return;
    }

    const tableBody = document.querySelector(tableSelector + ' tbody');
    const rows = Array.from(tableBody.querySelectorAll('tr'));
    rows.sort(sortFunc);
    tableBody.innerHTML = ''; // Clear the table body before appending sorted rows

    const fragment = document.createDocumentFragment();
    rows.forEach(tr => {
        fragment.appendChild(tr);
    });
    tableBody.appendChild(fragment);
}

function constructHeaderTR(headers, tableSelector) {
    const tr = document.createElement('tr');
    headers.forEach(header => {
        const th = document.createElement('th');
        // Step 1: insert Text
        const headerTextNode = document.createTextNode(header.label);
        th.appendChild(headerTextNode);

        // Step 2: sort button (if applicable)
        if (header.sortFuncName) {
            const button = document.createElement('button');
            button.setAttribute('class', 'sort-button');
            button.textContent = '🔽';
            let ascending = false;
            button.addEventListener('click', () => {
                const sortArgs = [{ headerName: header.label, ascending }];
                sortTableRows(tableSelector, header.sortFuncName, sortArgs, ascending);
                ascending = !ascending;
                button.textContent = ascending ? "🔼" : "🔽";
            });
            th.appendChild(button);
        }

        // Step 3: Add unselect all button for Equipment and Artifact columns in char_list_table
        if (tableSelector === '#char_list_table' && header.cacheKey && (header.cacheKey === 'Equipment' || header.cacheKey === 'Artifact')) {
            // Create select all button
            const selectButton = document.createElement('button');
            selectButton.setAttribute('class', 'toggle-select-all-button');
            selectButton.innerHTML = '<i class="fas fa-check-double"></i>';
            selectButton.title = `Select all ${header.cacheKey}`;
            selectButton.addEventListener('click', () => {
                selectOrUnselectAllInCategory(header.cacheKey, true); // true means select
            });
            th.appendChild(selectButton);

            // Create unselect all button
            const unselectButton = document.createElement('button');
            unselectButton.setAttribute('class', 'toggle-select-all-button');
            unselectButton.innerHTML = '<i class="fas fa-times-circle"></i>';
            unselectButton.title = `Unselect all ${header.cacheKey}`;
            unselectButton.addEventListener('click', () => {
                selectOrUnselectAllInCategory(header.cacheKey, false); // false means unselect
            });
            th.appendChild(unselectButton);
        }

        tr.appendChild(th);
    });
    return tr;
}

const sortFunctionFactory = {
    localeCompareSort: ({ headerName, ascending }) => {
        return (rowA, rowB) => {
            const textA = rowA.querySelector(`td[header-name="${headerName}"]`)?.textContent.toLowerCase() ?? '';
            const textB = rowB.querySelector(`td[header-name="${headerName}"]`)?.textContent.toLowerCase() ?? '';
            return textA.localeCompare(textB) * (ascending ? 1 : -1);
        };
    },
    boolCompareSort: ({ headerName, ascending }) => {
        return (rowA, rowB) => {
            const boolA = rowA.querySelector(`td[header-name="${headerName}"] input[type="checkbox"]`).checked;
            const boolB = rowB.querySelector(`td[header-name="${headerName}"] input[type="checkbox"]`).checked;
            return (boolA - boolB) * (ascending ? 1 : -1);
        };
    },
    numberCompareSort: ({ headerName, ascending }) => {
        return (rowA, rowB) => {
            const numA = Number(rowA.querySelector(`td[header-name="${headerName}"]`).textContent);
            const numB = Number(rowB.querySelector(`td[header-name="${headerName}"]`).textContent);
            return (numA - numB) * (ascending ? 1 : -1);
        };
    },
    artifactTotalSort: ({ headerName='Total', ascending }) => {
        return (rowA, rowB) => {
            const qualityA = Number(rowA.closest('tr').getAttribute('arti-quality') ?? 0);
            const qualityB = Number(rowB.closest('tr').getAttribute('arti-quality') ?? 0);
            const numA = Number(rowA.querySelector(`td[header-name="${headerName}"]`).textContent);
            const numB = Number(rowB.querySelector(`td[header-name="${headerName}"]`).textContent);
            return (qualityB - qualityA) || ((numA - numB) * (ascending ? 1 : -1));
        };
    }
};

function selectOrUnselectAllInCategory(categoryKey, select = true) {
    // Find all checkboxes in the specified category column
    const table = document.getElementById('char_list_table');
    const headerCells = table.querySelectorAll(`td[header-name="${categoryKey}"]`);

    headerCells.forEach(cell => {
        const checkbox = cell.querySelector('input[type="checkbox"]');
        if (checkbox && checkbox.checked !== select) {
            checkbox.checked = select;
            // Trigger change event to update the data
            checkbox.dispatchEvent(new Event('change', { bubbles: true }));
        }
    });
}

// Enhanced utility functions for modern UI features
function scrollToTop() {
    document.body.scrollTo({
        top: 0,
        behavior: 'smooth'
    });
}

function showNotification(message, type = 'info') {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
        <div class="notification-content">
            <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle'}"></i>
            <span>${message}</span>
        </div>
    `;

    // Add to DOM
    document.body.appendChild(notification);

    // Show notification
    setTimeout(() => notification.classList.add('show'), 100);

    // Remove after 3 seconds
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => document.body.removeChild(notification), 300);
    }, 3000);
}