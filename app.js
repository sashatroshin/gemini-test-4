let config = {};
let saveTimer;
let webhookTimer;
let pageBusinessDate;

async function loadConfig() {
    try {
        const urlParams = new URLSearchParams(window.location.search);
        const barId = urlParams.get('bar');
        const configFile = barId ? `configs/${barId}.json` : 'config.json';

        const response = await fetch(configFile);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        config = await response.json();
        config.barId = barId; // Store barId in config for later use
    } catch (error) {
        console.error("Failed to load config:", error);
        config = { businessDate: { changeTime: "09:00" }, messages: {}, expenseCategories: [] };
    }
}

function getBusinessDate() {
    const now = new Date();
    const timeZone = config.businessDate.timezone;
    const shiftStartHour = parseInt(config.businessDate.changeTime.split(':')[0], 10);

    if (!timeZone) {
        console.error("Timezone not found in config. Falling back to local time.");
        let businessDate = new Date(now);
        if (now.getHours() < shiftStartHour) {
            businessDate.setDate(businessDate.getDate() - 1);
        }
        return businessDate.toLocaleDateString('ru-RU');
    }

    const parts = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hour12: false }).formatToParts(now).reduce((acc, part) => { acc[part.type] = part.value; return acc; }, {});
    const currentHourInTimezone = parseInt(parts.hour, 10);
    let businessDate = new Date(`${parts.year}-${parts.month}-${parts.day}T00:00:00`);

    if (currentHourInTimezone < shiftStartHour) {
        businessDate.setDate(businessDate.getDate() - 1);
    }
    return businessDate.toLocaleDateString('ru-RU');
}

function setBusinessDate() {
    pageBusinessDate = getBusinessDate();
    document.getElementById('summary-businessdate').textContent = pageBusinessDate;
}

function checkForBusinessDateChange() {
    const correctBusinessDate = getBusinessDate();
    if (pageBusinessDate !== correctBusinessDate) {
        saveToLocalStorage();
        location.reload();
    }
}

function handleFocus(event) {
    const input = event.target;
    if (input.dataset.expression) {
        input.value = input.dataset.expression;
    }
}

function handleCalculation(event) {
    const input = event.target;
    let value = input.value.trim();
    if (value.includes('+')) {
        try {
            input.dataset.expression = value;
            value = value.replace(/,/g, '.');
            const result = value.split('+').reduce((sum, term) => sum + (parseFloat(term.trim()) || 0), 0);
            input.value = result.toFixed(2);
        } catch (error) {
            console.error('Calculation error:', error);
        }
    } else {
        delete input.dataset.expression;
    }
    updateSummary();
}

function addExpenseRow(expense = { amount: '', category: '', comment: '' }) {
    const container = document.getElementById('expenses-container');
    const newRow = document.createElement('div');
    newRow.classList.add('expense-row');
    newRow.innerHTML = `
        <div class="form-group expense-group">
            <input type="text" placeholder="Сумма" class="expense-amount" value="${expense.amount}" inputmode="decimal">
            <select class="expense-category">
                <option value="" disabled ${expense.category ? '' : 'selected'}>Выберите категорию</option>
                ${config.expenseCategories.map(c => `<option value="${c}" ${c === expense.category ? 'selected' : ''}>${c}</option>`).join('')}
            </select>
            <input type="text" placeholder="Комментарий" class="expense-comment" value="${expense.comment}">
            <button type="button" class="remove-expense-btn">-</button>
        </div>
    `;
    container.appendChild(newRow);
    const amountInput = newRow.querySelector('.expense-amount');
    amountInput.addEventListener('focus', handleFocus);
    amountInput.addEventListener('blur', handleCalculation);
    newRow.querySelector('.remove-expense-btn').addEventListener('click', () => { newRow.remove(); updateSummary(); });
    newRow.querySelectorAll('input, select').forEach(el => el.addEventListener('input', updateSummary));
}

function getFormValues() {
    const values = {};
    document.querySelectorAll('#shift-form input[type="text"]:not(.expense-comment):not(.expense-amount), #shift-form select:not(.expense-category)').forEach(el => {
        if (el.id) values[el.id] = el.value;
    });
    values.rashodi = Array.from(document.querySelectorAll('.expense-row')).map(row => ({
        summa: row.querySelector('.expense-amount').value,
        kategoriya: row.querySelector('.expense-category').value,
        kommentariy: row.querySelector('.expense-comment').value
    }));
    return values;
}

function updateSyncStatus(status) {
    const statusEl = document.getElementById('summary-sync-status');
    if (!statusEl) return;

    if (status === 'synced') {
        statusEl.textContent = 'Синхронизировано';
        statusEl.classList.remove('local');
        statusEl.classList.add('synced');
    } else {
        statusEl.textContent = 'Сохранено локально';
        statusEl.classList.remove('synced');
        statusEl.classList.add('local');
    }
}

function updateSummary() {
    clearTimeout(saveTimer);
    clearTimeout(webhookTimer);
    const values = getFormValues();

    const requiredFields = [
        'razmen', 'presto_nalichnie', 'presto_karti',
        'dostavka', 'samovivoz', 'nalichnie_vsego', 'terminal_sverka'
    ];

    const allMainFieldsFilled = requiredFields.every(id => {
        const el = document.getElementById(id);
        return el && el.value.trim() !== '';
    });

    const allExpensesValid = values.rashodi.every(expense => {
        return expense.summa.trim() !== '' && expense.kategoriya.trim() !== '' && expense.kommentariy.trim() !== '';
    });

    const allFieldsFilled = allMainFieldsFilled && allExpensesValid;

    const razmen = parseFloat(values.razmen) || 0;
    const prestoNalichnie = parseFloat(values.presto_nalichnie) || 0;
    const prestoKarti = parseFloat(values.presto_karti) || 0;
    const dostavka = parseFloat(values.dostavka) || 0;
    const samovivoz = parseFloat(values.samovivoz) || 0;
    const nalichnieVsego = parseFloat(values.nalichnie_vsego) || 0;
    const terminalSverka = parseFloat(values.terminal_sverka) || 0;

    const totalExpenses = values.rashodi.reduce((sum, ex) => sum + (parseFloat(ex.summa) || 0), 0);
    document.getElementById('summary-obschie_rashodi').textContent = totalExpenses.toFixed(2);

    const expectedCash = razmen + prestoNalichnie - totalExpenses;
    document.getElementById('summary-ozhidaemie_nalichnie').textContent = expectedCash.toFixed(2);

    const cashDifference = nalichnieVsego - expectedCash;
    document.getElementById('summary-raznica_nalichnie').textContent = cashDifference.toFixed(2);

    const actualCashless = terminalSverka + dostavka + samovivoz;
    document.getElementById('summary-fakt_beznal').textContent = actualCashless.toFixed(2);

    const cashlessDifference = actualCashless - prestoKarti;
    document.getElementById('summary-raznica_beznal').textContent = cashlessDifference.toFixed(2);

    const totalRevenue = prestoNalichnie + prestoKarti;
    document.getElementById('summary-obschaya_vyruchka').textContent = totalRevenue.toFixed(2);

    const netCashRevenue = nalichnieVsego - razmen;
    document.getElementById('summary-chistie_nalichnie').textContent = netCashRevenue.toFixed(2);

    const container = document.getElementById('summary-messages');
    if (allFieldsFilled) {
        if (cashDifference === 0 && cashlessDifference === 0) {
            renderCashflowMessage(prestoNalichnie, totalExpenses, razmen);
        } else {
            renderDiscrepancyMessages(cashDifference, cashlessDifference);
        }
    } else {
        container.innerHTML = '<div class="summary-message placeholder"><p>✏️ Заполните все поля для отображения подсказок</p></div>';
    }

    saveTimer = setTimeout(saveToLocalStorage, 500);
    webhookTimer = setTimeout(sendWebhook, 60000); // 1 minute
    updateSyncStatus('local');
}

function renderDiscrepancyMessages(cashDiff, cashlessDiff) {
    const container = document.getElementById('summary-messages');
    container.innerHTML = '';
    let message;

    if (cashDiff > 0) message = config.messages.cashSurplus;
    else if (cashDiff < 0) message = config.messages.cashShortage;

    if (message) {
        const el = document.createElement('div');
        el.classList.add('summary-message', cashDiff > 0 ? 'surplus' : 'shortage');
        el.innerHTML = `<strong>${message.title}</strong><p>${message.template.replace('{amount}', Math.abs(cashDiff).toFixed(2))}</p>`;
        container.appendChild(el);
    }

    message = null;
    if (cashlessDiff > 0) message = config.messages.cashlessDiscrepancyPositive;
    else if (cashlessDiff < 0) message = config.messages.cashlessDiscrepancyNegative;

    if (message) {
        const el = document.createElement('div');
        el.classList.add('summary-message', 'discrepancy');
        el.innerHTML = `<strong>${message.title}</strong><p>${message.template.replace('{amount}', Math.abs(cashlessDiff).toFixed(2))}</p>`;
        container.appendChild(el);
    }
}

function renderCashflowMessage(prestoNalichnie, totalExpenses, razmen) {
    const container = document.getElementById('summary-messages');
    container.innerHTML = '';
    const el = document.createElement('div');
    el.classList.add('summary-message', 'info');
    let title = 'Движение наличных';
    let text = '';

    if (prestoNalichnie < totalExpenses) {
        const diff = razmen + prestoNalichnie - totalExpenses;
        text = `➡️ В размене осталось: ${diff.toFixed(2)}`;
    } else if (prestoNalichnie > totalExpenses) {
        const diff = prestoNalichnie - totalExpenses;
        text = `📤 Изъятие из кассы: ${diff.toFixed(2)}`;
    } else {
        text = '✅ Инкассация не требуется, так как расходы равны выручке по наличным.';
    }

    el.innerHTML = `<strong>${title}</strong><p>${text}</p>`;
    container.appendChild(el);
}

function saveToLocalStorage() {
    const values = getFormValues();
    const key = `shiftData_${config.barId || 'default'}_${pageBusinessDate}`;
    localStorage.setItem(key, JSON.stringify(values));
}

function loadFromLocalStorage() {
    const key = `shiftData_${config.barId || 'default'}_${pageBusinessDate}`;
    const savedData = localStorage.getItem(key);
    if (savedData) {
        const values = JSON.parse(savedData);
        Object.keys(values).forEach(key => {
            if (key !== 'rashodi') {
                const el = document.getElementById(key);
                if (el) el.value = values[key];
            }
        });
        document.getElementById('expenses-container').innerHTML = '';
        if (values.rashodi) {
            values.rashodi.forEach(expense => {
                addExpenseRow({
                    amount: expense.summa,
                    category: expense.kategoriya,
                    comment: expense.kommentariy
                });
            });
        }
    }
}

async function sendWebhook() {
    if (!config.webhookUrl) return;
    const data = getFormValues();
    data.biznes_data = pageBusinessDate;
    // Add summary data
    data.svodka = {
        obshchie_rashodi: document.getElementById('summary-obschie_rashodi').textContent,
        ozhidaemie_nalichnie: document.getElementById('summary-ozhidaemie_nalichnie').textContent,
        raznica_nalichnie: document.getElementById('summary-raznica_nalichnie').textContent,
        fakt_beznal: document.getElementById('summary-fakt_beznal').textContent,
        raznica_beznal: document.getElementById('summary-raznica_beznal').textContent,
        obshchaya_vyruchka: document.getElementById('summary-obschaya_vyruchka').textContent,
        chistie_nalichnie: document.getElementById('summary-chistie_nalichnie').textContent
    };

    try {
        const response = await fetch(config.webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        if (response.ok) {
            console.log('Webhook sent successfully');
            updateSyncStatus('synced');
        } else {
            console.error('Webhook failed:', response.statusText);
            updateSyncStatus('local');
        }
    } catch (error) {
        console.error('Error sending webhook:', error);
        updateSyncStatus('local');
    }
}

async function loadInstruction() {
    try {
        const response = await fetch('instruction.md');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const markdown = await response.text();
        const html = marked.parse(markdown);
        document.getElementById('instruction-container').innerHTML = html;
    } catch (error) {
        console.error("Failed to load instruction:", error);
        document.getElementById('instruction-container').innerHTML = '<p>Не удалось загрузить инструкцию.</p>';
    }
}

function initializeApp() {
    loadConfig().then(() => {
        document.getElementById('app-name').textContent = config.appName || 'Shift Report';
        document.getElementById('bar-name').textContent = config.barName || 'My Bar';
        setBusinessDate();
        loadInstruction(); // Load instructions
        document.getElementById('add-expense-btn').addEventListener('click', () => addExpenseRow());
        const inputs = document.querySelectorAll('#shift-form input[type="text"]');
        inputs.forEach(input => {
            if (input.inputMode === 'decimal') {
                input.addEventListener('focus', handleFocus);
                input.addEventListener('blur', handleCalculation);
            }
            input.addEventListener('input', updateSummary);
        });
        loadFromLocalStorage();
        updateSummary();
        setInterval(checkForBusinessDateChange, 60000);
    });
}

document.addEventListener('DOMContentLoaded', initializeApp);
