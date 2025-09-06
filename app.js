let config = {};
let saveTimer;
let webhookTimer;
let pageBusinessDate;

async function loadConfig() {
    try {
        const response = await fetch('config.json');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        config = await response.json();
    } catch (error) {
        console.error("Failed to load config:", error);
        config = { businessDate: { changeTime: "09:00" }, messages: {}, expenseCategories: [] };
    }
}

function setBusinessDate() {
    const now = new Date();
    const timeZone = config.businessDate.timezone;
    if (!timeZone) {
        console.error("Timezone not found in config. Falling back to local time.");
        const shiftStartHour = parseInt(config.businessDate.changeTime.split(':')[0], 10);
        let businessDate = new Date(now);
        if (now.getHours() < shiftStartHour) {
            businessDate.setDate(businessDate.getDate() - 1);
        }
        pageBusinessDate = businessDate.toLocaleDateString('ru-RU');
        document.getElementById('summary-businessdate').textContent = pageBusinessDate;
        return;
    }
    const shiftStartHour = parseInt(config.businessDate.changeTime.split(':')[0], 10);
    const parts = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hour12: false }).formatToParts(now).reduce((acc, part) => { acc[part.type] = part.value; return acc; }, {});
    const currentHourInTimezone = parseInt(parts.hour, 10);
    let businessDate = new Date(`${parts.year}-${parts.month}-${parts.day}T00:00:00`);
    if (currentHourInTimezone < shiftStartHour) {
        businessDate.setDate(businessDate.getDate() - 1);
    }
    pageBusinessDate = businessDate.toLocaleDateString('ru-RU');
    document.getElementById('summary-businessdate').textContent = pageBusinessDate;
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
    values.expenses = Array.from(document.querySelectorAll('.expense-row')).map(row => ({
        amount: row.querySelector('.expense-amount').value,
        category: row.querySelector('.expense-category').value,
        comment: row.querySelector('.expense-comment').value
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

    const allFieldsFilled = requiredFields.every(id => {
        const el = document.getElementById(id);
        return el && el.value.trim() !== '';
    });

    const razmen = parseFloat(values.razmen) || 0;
    const prestoNalichnie = parseFloat(values.presto_nalichnie) || 0;
    const prestoKarti = parseFloat(values.presto_karti) || 0;
    const dostavka = parseFloat(values.dostavka) || 0;
    const samovivoz = parseFloat(values.samovivoz) || 0;
    const nalichnieVsego = parseFloat(values.nalichnie_vsego) || 0;
    const terminalSverka = parseFloat(values.terminal_sverka) || 0;

    const totalExpenses = values.expenses.reduce((sum, ex) => sum + (parseFloat(ex.amount) || 0), 0);
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

    const netCashRevenue = nalichnieVsego - razmen - totalExpenses;
    document.getElementById('summary-chistie_nalichnie').textContent = netCashRevenue.toFixed(2);

    const container = document.getElementById('summary-messages');
    if (allFieldsFilled) {
        renderDiscrepancyMessages(cashDifference, cashlessDifference);
    } else {
        container.innerHTML = '<div class="summary-message placeholder"><p>Заполните все поля для отображения подсказок</p></div>';
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

function saveToLocalStorage() {
    const values = getFormValues();
    localStorage.setItem(`shiftData_${pageBusinessDate}`, JSON.stringify(values));
}

function loadFromLocalStorage() {
    const savedData = localStorage.getItem(`shiftData_${pageBusinessDate}`);
    if (savedData) {
        const values = JSON.parse(savedData);
        Object.keys(values).forEach(key => {
            if (key !== 'expenses') {
                const el = document.getElementById(key);
                if (el) el.value = values[key];
            }
        });
        document.getElementById('expenses-container').innerHTML = '';
        if (values.expenses) {
            values.expenses.forEach(expense => addExpenseRow(expense));
        }
    }
}

async function sendWebhook() {
    if (!config.webhookUrl) return;
    const data = getFormValues();
    data.businessDate = pageBusinessDate;
    // Add summary data
    data.summary = {
        totalExpenses: document.getElementById('summary-obschie_rashodi').textContent,
        expectedCash: document.getElementById('summary-ozhidaemie_nalichnie').textContent,
        cashDifference: document.getElementById('summary-raznica_nalichnie').textContent,
        actualCashless: document.getElementById('summary-fakt_beznal').textContent,
        cashlessDifference: document.getElementById('summary-raznica_beznal').textContent,
        totalRevenue: document.getElementById('summary-obschaya_vyruchka').textContent,
        netCashRevenue: document.getElementById('summary-chistie_nalichnie').textContent
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

function initializeApp() {
    loadConfig().then(() => {
        document.getElementById('app-name').textContent = config.appName || 'Shift Report';
        document.getElementById('bar-name').textContent = config.barName || 'My Bar';
        setBusinessDate();
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
    });
}

document.addEventListener('DOMContentLoaded', initializeApp);
