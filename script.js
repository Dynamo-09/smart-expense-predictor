// GoogleGenerativeAI can be loaded separately if needed
/* ================================
   GLOBAL VARIABLES
================================ */
let rawData = [];
let filteredData = [];
let monthlyTotals = {};
let chart;
let anomalyThreshold = 2;

/* ================================
   EVENT LISTENERS
================================ */
document.getElementById("loadBtn").addEventListener("click", loadData);
document.getElementById("budgetBtn").addEventListener("click", checkBudget);
document.getElementById("householdFilter").addEventListener("change", applyFilter);

document.getElementById("thresholdSlider").addEventListener("input", function () {
    anomalyThreshold = parseFloat(this.value);
    document.getElementById("thresholdValue").innerText = anomalyThreshold;

    if (Object.keys(monthlyTotals).length > 0) {
        const months = Object.keys(monthlyTotals).sort();
        const values = months.map(m => monthlyTotals[m]);
        renderChart(months, values);
    }
});

/* ================================
   MOBILE SIDEBAR TOGGLE
================================ */
const mobileToggle = document.getElementById("mobileToggle");
const sidebar = document.getElementById("sidebar");

if (mobileToggle && sidebar) {
    mobileToggle.addEventListener("click", () => {
        sidebar.classList.toggle("open");
    });

    // Close sidebar when clicking outside on mobile
    document.addEventListener("click", (e) => {
        if (window.innerWidth <= 768 &&
            !sidebar.contains(e.target) &&
            !mobileToggle.contains(e.target)) {
            sidebar.classList.remove("open");
        }
    });
}

/* ================================
   FILE INPUT LABEL UPDATE
================================ */
const csvInput = document.getElementById("csvFile");
const fileLabel = document.getElementById("fileLabel");

if (csvInput && fileLabel) {
    csvInput.addEventListener("change", () => {
        const name = csvInput.files[0]?.name;
        if (name) {
            fileLabel.querySelector("span:last-child").textContent = name;
        }
    });
}

/* ================================
   LOAD & PARSE CSV
================================ */
function loadData() {
    const file = document.getElementById("csvFile").files[0];
    if (!file) { alert("Upload CSV first"); return; }

    const reader = new FileReader();
    reader.onload = function (e) {
        parseCSV(e.target.result);
        populateHouseholds();
        applyFilter();
    };
    reader.readAsText(file);
}

function parseCSV(text) {
    const rows = text.split("\n").map(r => r.trim());
    const headers = rows[0].split(",");
    rawData = [];

    for (let i = 1; i < rows.length; i++) {
        if (!rows[i]) continue;

        const values = rows[i].split(",");
        let obj = {};
        headers.forEach((h, j) => obj[h.trim()] = values[j]?.trim());

        const parts = obj.Purchase_Date?.split(".");
        if (parts && parts.length === 3) {
            obj.Month = "20" + parts[2] + "-" + parts[1].padStart(2, "0");
        }

        obj.Quantity = parseFloat(obj.Quantity) || 0;
        obj.Price = parseFloat(obj.Price) || 0;
        obj.Total = obj.Quantity * obj.Price;

        rawData.push(obj);
    }
}

/* ================================
   FILTER
================================ */
function populateHouseholds() {
    const select = document.getElementById("householdFilter");
    select.innerHTML = '<option value="all">All Households</option>';

    [...new Set(rawData.map(r => r.Household_ID))]
        .forEach(id => {
            const op = document.createElement("option");
            op.value = id;
            op.textContent = id;
            select.appendChild(op);
        });
}

function applyFilter() {
    const selected = document.getElementById("householdFilter").value;
    filteredData = selected === "all"
        ? rawData
        : rawData.filter(r => r.Household_ID == selected);

    analyzeData();
}

/* ================================
   ANALYSIS
================================ */
function analyzeData() {

    monthlyTotals = {};
    let total = 0;

    filteredData.forEach(r => {
        if (!monthlyTotals[r.Month]) monthlyTotals[r.Month] = 0;
        monthlyTotals[r.Month] += r.Total;
        total += r.Total;
    });

    const months = Object.keys(monthlyTotals).sort();
    const values = months.map(m => monthlyTotals[m]);

    if (values.length === 0) return;

    const avg = total / values.length;
    const prediction = mlPrediction(values);

    document.getElementById("totalSpending").innerText = total.toFixed(2);
    document.getElementById("avgSpending").innerText = avg.toFixed(2);
    document.getElementById("prediction").innerText = prediction.toFixed(2);

    renderChart(months, values);
    categoryAnalysis();
    itemPopularity();
}

/* ================================
   ML PREDICTION
================================ */
function mlPrediction(values) {
    if (values.length < 3) return values[values.length - 1];
    const n = values.length;
    return (values[n - 1] * 0.6) + (values[n - 2] * 0.3) + (values[n - 3] * 0.1);
}

/* ================================
   ANOMALY DETECTION
================================ */
function detectAnomalies(values) {

    const mean = values.reduce((a, b) => a + b, 0) / values.length;

    const stdDev = Math.sqrt(
        values.map(v => Math.pow(v - mean, 2))
            .reduce((a, b) => a + b, 0) / values.length
    );

    let anomalyIndex = [];

    values.forEach((value, index) => {
        const zScore = (value - mean) / stdDev;
        if (Math.abs(zScore) > anomalyThreshold) {
            anomalyIndex.push(index);
        }
    });

    document.getElementById("anomalyText").innerText =
        anomalyIndex.length > 0
            ? `⚠ ${anomalyIndex.length} anomaly month(s) detected`
            : "✅ No anomaly detected";

    return anomalyIndex;
}

/* ================================
   CHART — Modern Theme
================================ */
function renderChart(labels, data) {

    const ctx = document.getElementById("spendingChart");
    if (chart) chart.destroy();

    const anomalies = detectAnomalies(data);

    // Create gradient fill
    const chartCtx = ctx.getContext("2d");
    const gradient = chartCtx.createLinearGradient(0, 0, 0, 320);
    gradient.addColorStop(0, "rgba(0, 212, 255, 0.25)");
    gradient.addColorStop(0.5, "rgba(124, 58, 237, 0.08)");
    gradient.addColorStop(1, "rgba(0, 212, 255, 0)");

    chart = new Chart(ctx, {
        type: "line",
        data: {
            labels: labels,
            datasets: [{
                label: "Monthly Spending (₹)",
                data: data,
                borderColor: "#00d4ff",
                borderWidth: 2.5,
                backgroundColor: gradient,
                fill: true,
                tension: 0.4,
                pointBackgroundColor: data.map((v, i) =>
                    anomalies.includes(i) ? "#ef4444" : "#00d4ff"
                ),
                pointBorderColor: data.map((v, i) =>
                    anomalies.includes(i) ? "#ef4444" : "#00d4ff"
                ),
                pointBorderWidth: 2,
                pointRadius: 5,
                pointHoverRadius: 8,
                pointHoverBackgroundColor: "#fff",
                pointHoverBorderWidth: 3
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                mode: 'index',
                intersect: false
            },
            plugins: {
                legend: {
                    labels: {
                        color: "#9a9ab0",
                        font: { family: "'Inter', sans-serif", size: 12, weight: 500 },
                        usePointStyle: true,
                        pointStyle: 'circle'
                    }
                },
                tooltip: {
                    backgroundColor: "rgba(17, 17, 39, 0.95)",
                    titleColor: "#f0f0f5",
                    bodyColor: "#9a9ab0",
                    borderColor: "rgba(255,255,255,0.1)",
                    borderWidth: 1,
                    cornerRadius: 10,
                    padding: 14,
                    titleFont: { family: "'Inter', sans-serif", weight: 600, size: 13 },
                    bodyFont: { family: "'Inter', sans-serif", size: 12 },
                    displayColors: false,
                    callbacks: {
                        label: function (context) {
                            return `Spending: ₹${context.parsed.y.toFixed(2)}`;
                        }
                    }
                }
            },
            scales: {
                x: {
                    ticks: {
                        color: "#5e5e78",
                        font: { family: "'Inter', sans-serif", size: 11 }
                    },
                    grid: {
                        color: "rgba(255,255,255,0.04)",
                        drawBorder: false
                    }
                },
                y: {
                    ticks: {
                        color: "#5e5e78",
                        font: { family: "'Inter', sans-serif", size: 11 },
                        callback: function (value) {
                            return '₹' + value.toLocaleString();
                        }
                    },
                    grid: {
                        color: "rgba(255,255,255,0.04)",
                        drawBorder: false
                    }
                }
            }
        }
    });
}

/* ================================
   BUDGET CHECK
================================ */
function checkBudget() {

    const entered = parseFloat(document.getElementById("budgetInput").value);
    const values = Object.values(monthlyTotals);
    const warning = document.getElementById("warningMsg");

    if (values.length === 0) {
        warning.innerText = "Load data first!";
        warning.style.color = "#9a9ab0";
        return;
    }

    const avg = values.reduce((a, b) => a + b, 0) / values.length;

    if (entered > avg) {
        warning.innerText = "⚠ Budget exceeds average monthly spending!";
        warning.style.color = "#ef4444";
    } else {
        warning.innerText = "✅ Budget is within average monthly spending.";
        warning.style.color = "#34d399";
    }
}

/* ================================
   CATEGORY ANALYSIS
================================ */
function categoryAnalysis() {

    const categoryMap = {};

    filteredData.forEach(r => {

        const category = r.Category || "Other";

        if (!categoryMap[category]) {
            categoryMap[category] = 0;
        }

        categoryMap[category] += r.Total;

    });

    const list = document.getElementById("categoryList");
    list.innerHTML = "";

    Object.entries(categoryMap)
        .sort((a, b) => b[1] - a[1])
        .forEach(([cat, val]) => {

            const li = document.createElement("li");
            li.textContent = `${cat} — ₹${val.toFixed(2)}`;
            list.appendChild(li);

        });
}

/* ================================
   ITEM POPULARITY
================================ */
function itemPopularity() {

    const itemMap = {};

    filteredData.forEach(r => {

        if (!itemMap[r.Item]) {
            itemMap[r.Item] = 0;
        }

        itemMap[r.Item] += r.Quantity;

    });

    const topItems = Object.entries(itemMap)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);

    const list = document.getElementById("itemList");
    list.innerHTML = "";

    topItems.forEach(([item, count]) => {

        const li = document.createElement("li");
        li.textContent = `${item} (${count})`;
        list.appendChild(li);

    });
}

/* ================================
   CHATBOT ENGINE — Advanced Local AI (No API Key)
================================ */
(function () {
    const chatPanel = document.getElementById("chatbotPanel");
    const chatFab = document.getElementById("chatbotFab");
    const chatClose = document.getElementById("chatbotClose");
    const chatMessages = document.getElementById("chatbotMessages");
    const chatInput = document.getElementById("chatbotInput");
    const chatSend = document.getElementById("chatbotSend");
    const chipContainer = document.getElementById("chatbotChips");

    let chatOpen = false;
    let isSending = false;

    /* ---------- Local Responses & Data Analysis ---------- */
    async function getLocalResponse(userMessage) {
        // Simulate thinking time
        await new Promise(resolve => setTimeout(resolve, 800));

        if (!rawData || rawData.length === 0) {
            return "⚠️ Please upload a CSV file first before I can analyze your data!";
        }

        const msg = userMessage.toLowerCase();

        // 1. Predict next 6 months
        if (msg.includes("predict") && msg.includes("6 month")) {
            let vals = Object.values(monthlyTotals);
            if (vals.length < 3) return "I need at least 3 months of data to make a reliable 6-month prediction.";
            
            let tempVals = [...vals];
            let preds = [];
            for (let i = 0; i < 6; i++) {
                let next = mlPrediction(tempVals); // Uses your existing ML function
                preds.push(next);
                tempVals.push(next);
            }
            let resp = "📈 **6-Month Spending Prediction:**\n";
            preds.forEach((p, i) => resp += `• Month ${i + 1}: ₹${p.toFixed(2)}\n`);
            return resp;
        }

        // 2. Top 10 expensive items
        if (msg.includes("top 10") && (msg.includes("expensive") || msg.includes("item"))) {
            let uniqueItems = {};
            rawData.forEach(r => {
                if (!uniqueItems[r.Item] || r.Price > uniqueItems[r.Item]) {
                    uniqueItems[r.Item] = r.Price;
                }
            });
            let sorted = Object.entries(uniqueItems).sort((a, b) => b[1] - a[1]).slice(0, 10);
            let resp = "💎 **Top 10 Most Expensive Items:**\n";
            sorted.forEach((item, i) => resp += `${i + 1}. ${item[0]} — ₹${item[1].toFixed(2)}\n`);
            return resp;
        }

        // 3. Which item costs the most?
        if (msg.includes("item") && (msg.includes("costs the most") || msg.includes("most expensive"))) {
            let maxItem = rawData.reduce((max, r) => r.Price > max.Price ? r : max, rawData[0]);
            return `💰 The most expensive item purchased is **${maxItem.Item}**, costing **₹${maxItem.Price.toFixed(2)}**.`;
        }

        // 4. Which household spends the most? / wastes money
        if (msg.includes("household") && (msg.includes("spends the most") || msg.includes("wastes"))) {
            let map = {};
            rawData.forEach(r => map[r.Household_ID] = (map[r.Household_ID] || 0) + r.Total);
            let sorted = Object.entries(map).sort((a, b) => b[1] - a[1]);
            return `🏠 **Household ${sorted[0][0]}** spends the most, with a grand total of **₹${sorted[0][1].toFixed(2)}**.`;
        }

        // 5. Month with highest spending
        if (msg.includes("month") && (msg.includes("highest") || msg.includes("most"))) {
            let sorted = Object.entries(monthlyTotals).sort((a, b) => b[1] - a[1]);
            return `📅 **${sorted[0][0]}** was your highest spending month at **₹${sorted[0][1].toFixed(2)}**.`;
        }

        // 6. Top spending category / Which category to reduce?
        if (msg.includes("category") && (msg.includes("top") || msg.includes("reduce") || msg.includes("highest"))) {
            let map = {};
            filteredData.forEach(r => map[r.Category] = (map[r.Category] || 0) + r.Total);
            let sorted = Object.entries(map).sort((a, b) => b[1] - a[1]);
            return `📊 Your highest spending category is **${sorted[0][0]}** at **₹${sorted[0][1].toFixed(2)}**.\n💡 *Suggestion: If you want to cut costs, start by reducing expenses here!*`;
        }

        // 7. Abnormal spending households
        if (msg.includes("abnormal") && msg.includes("household")) {
            let map = {}; // Household -> { month: total }
            rawData.forEach(r => {
                if (!map[r.Household_ID]) map[r.Household_ID] = {};
                map[r.Household_ID][r.Month] = (map[r.Household_ID][r.Month] || 0) + r.Total;
            });
            let abnormal = [];
            for (let hh in map) {
                let vals = Object.values(map[hh]);
                if (vals.length > 2) {
                    let mean = vals.reduce((a, b) => a + b, 0) / vals.length;
                    let stdDev = Math.sqrt(vals.map(v => Math.pow(v - mean, 2)).reduce((a, b) => a + b, 0) / vals.length);
                    // Using the UI's anomaly threshold
                    let hasAnomaly = vals.some(v => Math.abs((v - mean) / stdDev) > anomalyThreshold);
                    if (hasAnomaly) abnormal.push(hh);
                }
            }
            if (abnormal.length === 0) return "✅ No households are showing abnormal spending spikes right now.";
            return `⚠️ **Households with abnormal spending spikes:**\n${abnormal.map(h => `• Household ${h}`).join('\n')}`;
        }

        // 8. Trending up / Increased spending last month
        if (msg.includes("trending up") || msg.includes("increased spending")) {
            let months = Object.keys(monthlyTotals).sort();
            if (months.length < 2) return "I need at least 2 months of data to calculate trends.";
            let currentMonth = months[months.length - 1];
            let prevMonth = months[months.length - 2];

            let itemMap = {};
            filteredData.forEach(r => {
                if (r.Month === currentMonth || r.Month === prevMonth) {
                    if (!itemMap[r.Item]) itemMap[r.Item] = { current: 0, prev: 0 };
                    if (r.Month === currentMonth) itemMap[r.Item].current += r.Total;
                    if (r.Month === prevMonth) itemMap[r.Item].prev += r.Total;
                }
            });

            let increases = [];
            for (let item in itemMap) {
                let diff = itemMap[item].current - itemMap[item].prev;
                if (diff > 0) increases.push({ item, diff });
            }
            increases.sort((a, b) => b.diff - a.diff);

            if (increases.length === 0) return "📉 Good news! No items increased in spending last month.";
            let resp = `🔥 **Items Trending Up (Latest Month vs Previous):**\n`;
            increases.slice(0, 5).forEach((x, i) => resp += `${i + 1}. **${x.item}** (+₹${x.diff.toFixed(2)})\n`);
            return resp;
        }

        // Fallbacks for original general help questions
        if (msg.includes("fix anomalies") || msg.includes("anomalies")) {
            return "🔧 **How to fix anomalies:**\n• Adjust the **Anomaly Sensitivity** slider.\n• Check your CSV for typos or incorrect values.\n• Remove extreme outliers if they are data entry errors.";
        } else if (msg.includes("how to use") || msg.includes("dashboard")) {
            return "❓ **How to use this dashboard:**\n1. Upload your CSV.\n2. Filter by **Household**.\n3. Ask me complex questions like *'Which category should I reduce?'* or *'Predict spending for the next 6 months'*!";
        } else {
            return "I'm not quite sure how to answer that! Try asking things like:\n• *'Which household spends the most?'*\n• *'Which category should I reduce?'*\n• *'Predict spending for the next 6 months'*\n• *'Which item is trending up?'*";
        }
    }

    /* ---------- UI Functions ---------- */
    function addMessage(text, sender) {
        const msgDiv = document.createElement("div");
        msgDiv.className = `chat-msg ${sender}`;

        const iconDiv = document.createElement("div");
        iconDiv.className = "chat-msg-icon";
        const icon = document.createElement("span");
        icon.className = "material-icons-round";
        icon.textContent = sender === "bot" ? "smart_toy" : "person";
        iconDiv.appendChild(icon);

        const bubble = document.createElement("div");
        bubble.className = "chat-msg-bubble";
        bubble.innerHTML = text
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            .replace(/`(.*?)`/g, '<code style="background:rgba(0,212,255,0.1);padding:1px 5px;border-radius:4px;font-size:0.82em">$1</code>')
            .replace(/\n/g, '<br>');

        msgDiv.appendChild(iconDiv);
        msgDiv.appendChild(bubble);
        chatMessages.appendChild(msgDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    function showTyping() {
        const typing = document.createElement("div");
        typing.className = "chat-msg bot";
        typing.id = "typingIndicator";
        typing.innerHTML = `
            <div class="chat-msg-icon"><span class="material-icons-round">smart_toy</span></div>
            <div class="chat-msg-bubble typing-indicator"><span></span><span></span><span></span></div>
        `;
        chatMessages.appendChild(typing);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    function removeTyping() {
        const typing = document.getElementById("typingIndicator");
        if (typing) typing.remove();
    }

    async function handleSend() {
        const text = chatInput.value.trim();
        if (!text || isSending) return;

        isSending = true;
        chatSend.style.opacity = "0.5";
        chatSend.style.pointerEvents = "none";

        addMessage(text, "user");
        chatInput.value = "";
        showTyping();

        try {
            const response = await getLocalResponse(text);
            removeTyping();
            addMessage(response, "bot");
        } catch (err) {
            console.error(err);
            removeTyping();
            addMessage("Sorry, an error occurred analyzing the data.", "bot");
        } finally {
            isSending = false;
            chatSend.style.opacity = "1";
            chatSend.style.pointerEvents = "auto";
        }
    }

    /* ---------- Event Listeners ---------- */
    chatFab.addEventListener("click", () => {
        chatOpen = !chatOpen;
        chatPanel.classList.toggle("open", chatOpen);
        chatFab.classList.toggle("active", chatOpen);
        document.getElementById("fabIcon").textContent = chatOpen ? "close" : "smart_toy";
        if (chatOpen) chatInput.focus();
    });

    chatClose.addEventListener("click", () => {
        chatOpen = false;
        chatPanel.classList.remove("open");
        chatFab.classList.remove("active");
        document.getElementById("fabIcon").textContent = "smart_toy";
    });

    chatSend.addEventListener("click", handleSend);

    chatInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") handleSend();
    });

    chipContainer.addEventListener("click", (e) => {
        const chip = e.target.closest(".chip");
        if (!chip) return;
        const query = chip.dataset.query;
        chatInput.value = query;
        handleSend();
    });

    // Welcome message
    addMessage("👋 Hi! I'm **DataAssist**, your advanced local data AI.\n\nUpload a CSV, then ask me things like:\n• 📊 Which category should I reduce?\n• 📈 Predict spending for 6 months\n• 🔥 Which item is trending up?", "bot");

})();
/* ================================
   BLOCK 'e' IN BUDGET INPUT
================================ */
document.getElementById("budgetInput").addEventListener("keydown", function(event) {
    // Block 'e', 'E', '+', and '-'
    if (["e", "E", "+", "-"].includes(event.key)) {
        event.preventDefault();
    }
});