let config = {};
let saveTimer;
let webhookTimer;
let pageBusinessDate;

// ... (business date logic) ...

// --- Core Application Logic ---
// ... (loadConfig, initializeApp, etc.) ...

function updateSummary() {
    // ... (calculations for summary values) ...

    // Update summary display
    // ... (update textContent for summary items)

    // Update discrepancy messages
    renderDiscrepancyMessages(raznica_nalichnie, raznica_beznal);
}

function renderDiscrepancyMessages(cashDiff, cashlessDiff) {
    const messagesContainer = document.getElementById('summary-messages');
    messagesContainer.innerHTML = ''; // Clear previous messages

    if (cashDiff > 0) {
        renderMessage('cashSurplus', cashDiff);
    } else if (cashDiff < 0) {
        renderMessage('cashShortage', -cashDiff);
    }

    if (cashlessDiff > 0) {
        renderMessage('cashlessDiscrepancyPositive', cashlessDiff);
    } else if (cashlessDiff < 0) {
        renderMessage('cashlessDiscrepancyNegative', -cashlessDiff);
    }
}

function renderMessage(messageKey, amount) {
    const messagesContainer = document.getElementById('summary-messages');
    const messageConfig = config.messages[messageKey];
    if (!messageConfig) return;

    const messageElement = document.createElement('div');
    messageElement.classList.add('summary-message');

    const title = document.createElement('h3');
    title.textContent = messageConfig.title;

    const text = document.createElement('p');
    text.textContent = messageConfig.template.replace('{amount}', amount.toFixed(2));

    messageElement.appendChild(title);
    messageElement.appendChild(text);
    messagesContainer.appendChild(messageElement);
}

// ... (rest of the app.js file)
