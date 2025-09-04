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
    const timeZone = config.businessDate.timezone;
    if (!timeZone) {
        console.error("Timezone not found in config. Falling back to local time.");
        // Keep original logic as a fallback
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

    // Get date and hour in the target timezone
    const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        hour12: false
    }).formatToParts(now).reduce((acc, part) => {
        acc[part.type] = part.value;
        return acc;
    }, {});

    const currentHourInTimezone = parseInt(parts.hour, 10);
    
    // Create a date object representing the calendar date in the target timezone
    let businessDate = new Date(`${parts.year}-${parts.month}-${parts.day}T00:00:00`);

    if (currentHourInTimezone < shiftStartHour) {
        // If it's before the shift change, the business date is the previous day
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