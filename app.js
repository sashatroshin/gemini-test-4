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
        // Provide a default config to prevent further errors
        config = {
            businessDate: { changeTime: "09:00" },
            messages: {},
            expenseCategories: []
        };
    }
}

function setBusinessDate() {
    const now = new Date();
    const shiftStartHour = parseInt(config.businessDate.changeTime.split(':')[0], 10);
    let businessDate = new Date(now);

    if (now.getHours() < shiftStartHour) {
        businessDate.setDate(businessDate.getDate() - 1);
    }
    
    pageBusinessDate = businessDate.toLocaleDateString('ru-RU');
    document.getElementById('summary-businessdate').textContent = pageBusinessDate;
}

function initializeApp() {
    loadConfig().then(() => {
        setBusinessDate();
        // ... other initialization logic that depends on config
    });
}

document.addEventListener('DOMContentLoaded', initializeApp);

// ... (the rest of your functions: updateSummary, renderDiscrepancyMessages, etc.)