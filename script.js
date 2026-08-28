/**
 * Machine Maintenance & Inspection Portal
 * Dynamic JavaScript supporting both GitHub Pages (Static) and Flask Backend
 */

document.addEventListener("DOMContentLoaded", () => {
    // Determine API Base URL
    // If hosted on github.io, use configured API URL from localStorage or fallback
    const isGitHubPages = window.location.hostname.includes("github.io");
    const defaultApi = isGitHubPages ? "http://127.0.0.1:5000" : window.location.origin;
    let apiBase = localStorage.getItem("maintenance_api_url") || defaultApi;

    // Elements
    const recordsTable = document.getElementById("recordsTable");
    const tableBody = document.getElementById("tableBody");
    const tableLoading = document.getElementById("tableLoading");
    const tableEmpty = document.getElementById("tableEmpty");
    
    const searchInput = document.getElementById("searchInput");
    const statusFilter = document.getElementById("statusFilter");
    const refreshBtn = document.getElementById("refreshBtn");
    const exportCsvBtn = document.getElementById("exportCsvBtn");
    const recordCountBadge = document.getElementById("recordCountBadge");

    // Status Badge Elements
    const connectionBadge = document.getElementById("connectionBadge");
    const connectionBadgeText = document.getElementById("connectionBadgeText");

    // Summary Metric Elements
    const statTotal = document.getElementById("statTotal");
    const statPass = document.getElementById("statPass");
    const statFail = document.getElementById("statFail");
    const statRate = document.getElementById("statRate");

    // Modals
    const entryModal = document.getElementById("entryModal");
    const openModalBtn = document.getElementById("openModalBtn");
    const closeModalBtn = document.getElementById("closeModalBtn");
    const cancelModalBtn = document.getElementById("cancelModalBtn");
    const webEntryForm = document.getElementById("webEntryForm");
    const serviceDateInput = document.getElementById("serviceDate");

    const settingsModal = document.getElementById("settingsModal");
    const openSettingsBtn = document.getElementById("openSettingsBtn");
    const closeSettingsBtn = document.getElementById("closeSettingsBtn");
    const apiUrlInput = document.getElementById("apiUrlInput");
    const testApiBtn = document.getElementById("testApiBtn");
    const saveApiBtn = document.getElementById("saveApiBtn");

    const toastShelf = document.getElementById("toastShelf");

    let allRecords = [];
    let isServerOnline = false;

    // Set today's date in form
    if (serviceDateInput) {
        serviceDateInput.value = new Date().toISOString().split("T")[0];
    }

    /**
     * Show Toast Notification
     */
    function showToast(message, type = "success") {
        const toast = document.createElement("div");
        toast.className = `toast-item ${type === "success" ? "toast-ok" : "toast-bad"}`;
        toast.innerHTML = `<span>${type === "success" ? "✅" : "⚠️"}</span> <span>${escapeHtml(message)}</span>`;
        toastShelf.appendChild(toast);
        setTimeout(() => {
            toast.style.opacity = "0";
            toast.style.transform = "translateY(20px)";
            toast.style.transition = "all 0.3s ease";
            setTimeout(() => toast.remove(), 300);
        }, 3500);
    }

    /**
     * Update Connection Badge Status
     */
    function setConnectionStatus(online, hostName = "") {
        isServerOnline = online;
        if (online) {
            connectionBadge.className = "status-badge-online";
            connectionBadgeText.textContent = hostName ? `Connected (${hostName})` : "Server Online";
        } else {
            connectionBadge.className = "status-badge-offline";
            connectionBadgeText.textContent = "Server Offline (Demo Mode)";
        }
    }

    /**
     * Sample fallback data if backend server is not running
     */
    const DEMO_RECORDS = [
        {
            id: 101,
            service_date: new Date().toISOString().split("T")[0],
            machine_name: "CNC Milling Center 01",
            maintained_by: "John Doe (Tech)",
            checked_by: "Sarah Connor (QC)",
            status: "PASS",
            remarks: "Monthly spindle lubrication & calibration passed"
        },
        {
            id: 102,
            service_date: new Date(Date.now() - 86400000).toISOString().split("T")[0],
            machine_name: "Hydraulic Press #4",
            maintained_by: "Mike Tyson",
            checked_by: "Sarah Connor (QC)",
            status: "FAIL",
            remarks: "Hydraulic pressure sensor B-2 needs replacement"
        },
        {
            id: 103,
            service_date: new Date(Date.now() - 172800000).toISOString().split("T")[0],
            machine_name: "Surface Grinder G-12",
            maintained_by: "Alex Wong",
            checked_by: "David Miller",
            status: "PASS",
            remarks: "Replaced belt and aligned grinding wheel"
        }
    ];

    /**
     * Check Health & Load Records
     */
    async function checkHealthAndLoad(showSpinner = false) {
        if (showSpinner) {
            tableLoading.style.display = "flex";
            tableEmpty.style.display = "none";
        }

        const normalizedApi = apiBase.replace(/\/+$/, "");

        try {
            const healthRes = await fetch(`${normalizedApi}/api/health`, { method: "GET", mode: "cors" });
            if (healthRes.ok) {
                const urlObj = new URL(normalizedApi);
                setConnectionStatus(true, urlObj.host);
                await Promise.all([loadStats(normalizedApi), loadRecords(normalizedApi)]);
                return;
            }
        } catch (e) {
            // Server offline or CORS issue
        }

        // Offline / Fallback
        setConnectionStatus(false);
        useFallbackData();
    }

    function useFallbackData() {
        tableLoading.style.display = "none";
        allRecords = DEMO_RECORDS;
        updateStatsFromRecords(allRecords);
        filterAndRenderTable();
    }

    /**
     * Load Stats from Server
     */
    async function loadStats(api) {
        try {
            const res = await fetch(`${api}/api/stats`, { mode: "cors" });
            const data = await res.json();
            if (data.success && data.stats) {
                statTotal.textContent = data.stats.total;
                statPass.textContent = data.stats.pass_count;
                statFail.textContent = data.stats.fail_count;
                statRate.textContent = `${data.stats.pass_rate}%`;
            }
        } catch (err) {
            console.warn("Could not fetch stats:", err);
        }
    }

    function updateStatsFromRecords(records) {
        const total = records.length;
        const pass = records.filter(r => r.status === "PASS").length;
        const fail = records.filter(r => r.status === "FAIL").length;
        const rate = total > 0 ? ((pass / total) * 100).toFixed(1) : "0";

        statTotal.textContent = total;
        statPass.textContent = pass;
        statFail.textContent = fail;
        statRate.textContent = `${rate}%`;
    }

    /**
     * Load Records from Server
     */
    async function loadRecords(api) {
        try {
            const res = await fetch(`${api}/api/records`, { mode: "cors" });
            const result = await res.json();

            tableLoading.style.display = "none";

            if (result.success) {
                allRecords = result.data || [];
                filterAndRenderTable();
            }
        } catch (err) {
            tableLoading.style.display = "none";
            console.error("Error fetching records:", err);
        }
    }

    /**
     * Filter & Render Table Rows
     */
    function filterAndRenderTable() {
        const query = searchInput.value.trim().toLowerCase();
        const status = statusFilter.value.trim().toUpperCase();

        const filtered = allRecords.filter(rec => {
            const matchesStatus = !status || rec.status === status;
            const matchesQuery = !query ||
                (rec.machine_name && rec.machine_name.toLowerCase().includes(query)) ||
                (rec.maintained_by && rec.maintained_by.toLowerCase().includes(query)) ||
                (rec.checked_by && rec.checked_by.toLowerCase().includes(query)) ||
                (rec.remarks && rec.remarks.toLowerCase().includes(query)) ||
                (rec.service_date && rec.service_date.includes(query));

            return matchesStatus && matchesQuery;
        });

        recordCountBadge.textContent = `${filtered.length} ${filtered.length === 1 ? "Record" : "Records"}`;

        if (filtered.length === 0) {
            tableBody.innerHTML = "";
            tableEmpty.style.display = "flex";
            return;
        }

        tableEmpty.style.display = "none";
        renderTable(filtered);
    }

    /**
     * Render HTML Table
     */
    function renderTable(records) {
        tableBody.innerHTML = records.map(rec => {
            const isPass = rec.status === "PASS";
            const badgeClass = isPass ? "status-badge-pass" : "status-badge-fail";
            const badgeIcon = isPass ? "✓" : "✕";

            const maintainerInitial = rec.maintained_by ? rec.maintained_by.charAt(0).toUpperCase() : "M";
            const checkerInitial = rec.checked_by ? rec.checked_by.charAt(0).toUpperCase() : "C";

            return `
                <tr data-id="${rec.id}">
                    <td><span class="id-badge">#${rec.id}</span></td>
                    <td><span class="date-pill">${escapeHtml(rec.service_date)}</span></td>
                    <td>
                        <div class="machine-name">
                            <span>⚙️</span>
                            <span>${escapeHtml(rec.machine_name)}</span>
                        </div>
                    </td>
                    <td>
                        <div class="person-tag">
                            <span class="person-avatar" style="background:#e0e7ff; color:#4338ca;">${maintainerInitial}</span>
                            <span>${escapeHtml(rec.maintained_by)}</span>
                        </div>
                    </td>
                    <td>
                        <div class="person-tag">
                            <span class="person-avatar" style="background:#fef3c7; color:#b45309;">${checkerInitial}</span>
                            <span>${escapeHtml(rec.checked_by)}</span>
                        </div>
                    </td>
                    <td>
                        <span class="status-badge ${badgeClass}">
                            <span>${badgeIcon}</span>
                            <span>${rec.status}</span>
                        </span>
                    </td>
                    <td><div class="remarks-text">${rec.remarks ? escapeHtml(rec.remarks) : '<span style="color:#cbd5e1;">—</span>'}</div></td>
                    <td style="text-align: center;">
                        <button class="btn-icon-action" title="Delete Record" onclick="deleteRecord(${rec.id})">
                            🗑️
                        </button>
                    </td>
                </tr>
            `;
        }).join("");
    }

    function escapeHtml(str) {
        if (!str) return "";
        return String(str)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    /**
     * Delete Record
     */
    window.deleteRecord = async function(id) {
        if (!confirm(`Are you sure you want to delete record #${id}?`)) return;

        const normalizedApi = apiBase.replace(/\/+$/, "");

        if (isServerOnline) {
            try {
                const res = await fetch(`${normalizedApi}/api/records/${id}`, { method: "DELETE", mode: "cors" });
                const data = await res.json();
                if (data.success) {
                    showToast(`Record #${id} deleted.`);
                    checkHealthAndLoad();
                } else {
                    showToast(data.error || "Failed to delete", "error");
                }
            } catch (err) {
                showToast("Network error deleting record.", "error");
            }
        } else {
            // Local array removal in demo mode
            allRecords = allRecords.filter(r => r.id !== id);
            updateStatsFromRecords(allRecords);
            filterAndRenderTable();
            showToast(`Record #${id} removed.`);
        }
    };

    /**
     * Submit New Record
     */
    webEntryForm.addEventListener("submit", async (e) => {
        e.preventDefault();

        const formData = new FormData(webEntryForm);
        const payload = {
            service_date: formData.get("service_date"),
            machine_name: formData.get("machine_name"),
            maintained_by: formData.get("maintained_by"),
            checked_by: formData.get("checked_by"),
            status: formData.get("status"),
            remarks: formData.get("remarks")
        };

        const normalizedApi = apiBase.replace(/\/+$/, "");

        if (isServerOnline) {
            try {
                const res = await fetch(`${normalizedApi}/api/records`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload),
                    mode: "cors"
                });

                const data = await res.json();
                if (data.success) {
                    showToast("Record saved successfully!");
                    closeEntryModal();
                    checkHealthAndLoad();
                } else {
                    const msg = data.errors ? data.errors.join(", ") : (data.error || "Error saving record.");
                    showToast(msg, "error");
                }
            } catch (err) {
                showToast("Network error saving record.", "error");
            }
        } else {
            // Add to local array in demo mode
            const newRec = {
                id: Math.floor(Math.random() * 900) + 100,
                ...payload
            };
            allRecords.unshift(newRec);
            updateStatsFromRecords(allRecords);
            filterAndRenderTable();
            closeEntryModal();
            showToast("Saved locally (Demo mode)");
        }
    });

    /**
     * Export Table to CSV
     */
    exportCsvBtn.addEventListener("click", () => {
        if (!allRecords || allRecords.length === 0) {
            showToast("No records to export.", "error");
            return;
        }

        const headers = ["ID", "Service Date", "Machine Name", "Maintained By", "Checked By", "Status", "Remarks"];
        const rows = allRecords.map(r => [
            r.id,
            `"${r.service_date}"`,
            `"${(r.machine_name || '').replace(/"/g, '""')}"`,
            `"${(r.maintained_by || '').replace(/"/g, '""')}"`,
            `"${(r.checked_by || '').replace(/"/g, '""')}"`,
            `"${r.status}"`,
            `"${(r.remarks || '').replace(/"/g, '""')}"`
        ]);

        const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `maintenance_records_${new Date().toISOString().split("T")[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        link.remove();
        showToast("Exported records to CSV.");
    });

    /**
     * Modal Controls - Entry
     */
    openModalBtn.addEventListener("click", () => entryModal.classList.add("is-open"));
    function closeEntryModal() {
        entryModal.classList.remove("is-open");
        webEntryForm.reset();
        serviceDateInput.value = new Date().toISOString().split("T")[0];
    }
    closeModalBtn.addEventListener("click", closeEntryModal);
    cancelModalBtn.addEventListener("click", closeEntryModal);

    /**
     * Modal Controls - Settings
     */
    openSettingsBtn.addEventListener("click", () => {
        apiUrlInput.value = apiBase;
        settingsModal.classList.add("is-open");
    });
    function closeSettings() {
        settingsModal.classList.remove("is-open");
    }
    closeSettingsBtn.addEventListener("click", closeSettings);

    testApiBtn.addEventListener("click", async () => {
        const testUrl = apiUrlInput.value.trim().replace(/\/+$/, "");
        testApiBtn.textContent = "Testing...";
        try {
            const res = await fetch(`${testUrl}/api/health`, { mode: "cors" });
            if (res.ok) {
                showToast("Connection Successful! Server is online.");
            } else {
                showToast(`Server returned status: ${res.status}`, "error");
            }
        } catch (e) {
            showToast("Failed to connect. Check URL or ensure CORS is allowed.", "error");
        } finally {
            testApiBtn.textContent = "⚡ Test Connection";
        }
    });

    saveApiBtn.addEventListener("click", () => {
        const newUrl = apiUrlInput.value.trim().replace(/\/+$/, "");
        if (newUrl) {
            apiBase = newUrl;
            localStorage.setItem("maintenance_api_url", newUrl);
            showToast("Saved API settings.");
            closeSettings();
            checkHealthAndLoad(true);
        }
    });

    // Event Listeners for Filters
    searchInput.addEventListener("input", filterAndRenderTable);
    statusFilter.addEventListener("change", filterAndRenderTable);
    refreshBtn.addEventListener("click", () => {
        checkHealthAndLoad(true);
        showToast("Refreshed data.");
    });

    // Initial Load
    checkHealthAndLoad(true);

    // Auto-refresh every 5 seconds when online
    setInterval(() => {
        if (isServerOnline) {
            const normalizedApi = apiBase.replace(/\/+$/, "");
            loadStats(normalizedApi);
            loadRecords(normalizedApi);
        }
    }, 5000);
});
