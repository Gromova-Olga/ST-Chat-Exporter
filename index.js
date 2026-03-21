import { extension_settings } from "../../../extensions.js";
import { saveSettingsDebounced } from "../../../../script.js";
import { getContext } from "../../../extensions.js";

const extensionName = "ST-Chat-Exporter";
const extensionFolderPath = `scripts/extensions/third-party/${extensionName}`;

const defaultSettings = {
    includePlainText: true,
    includeNames: true,
    includeTimestamp: false,
    includeNumbers: false,
};

function loadSettings() {
    extension_settings[extensionName] = extension_settings[extensionName] || {};
    if (Object.keys(extension_settings[extensionName]).length === 0) {
        Object.assign(extension_settings[extensionName], defaultSettings);
    }
    const s = extension_settings[extensionName];
    $("#ce_plain_text").prop("checked", s.includePlainText);
    $("#ce_names").prop("checked", s.includeNames);
    $("#ce_timestamp").prop("checked", s.includeTimestamp);
    $("#ce_numbers").prop("checked", s.includeNumbers);
}

function onCheckboxChange(key, event) {
    extension_settings[extensionName][key] = Boolean($(event.target).prop("checked"));
    saveSettingsDebounced();
}

function getMessages() {
    const context = getContext();
    if (!context || !context.chat) return [];
    return context.chat;
}

function formatMessages(messages, indices) {
    const s = extension_settings[extensionName];
    const lines = [];

    indices.forEach((globalIdx) => {
        const msg = messages[globalIdx];
        if (!msg) return;
        const parts = [];

        if (s.includeNumbers) parts.push(`[${globalIdx + 1}]`);
        if (s.includeNames) {
            const name = msg.is_user
                ? (getContext().name1 || "User")
                : (msg.name || getContext().name2 || "Bot");
            parts.push(`${name}:`);
        }
        if (s.includeTimestamp && msg.send_date) {
            parts.push(`(${msg.send_date})`);
        }

        const header = parts.join(" ");
        const text = (msg.mes || "").trim();

        if (header) {
            lines.push(header);
            lines.push(s.includePlainText ? `  ${text.replace(/\n/g, "\n  ")}` : text);
        } else {
            lines.push(s.includePlainText ? `  ${text.replace(/\n/g, "\n  ")}` : text);
        }
        lines.push("");
    });

    return lines.join("\n");
}

function setupSearch() {
    let matches = [];
    let currentMatch = -1;

    function renderDisplay(query) {
        const text = $("#ce-output").val();
        const display = document.getElementById("ce-output-display");

        if (!query) {
            display.textContent = text;
            return;
        }

        const lowerText = text.toLowerCase();
        const lowerQuery = query.toLowerCase();
        let result = "";
        let pos = 0;

        while (pos < text.length) {
            const found = lowerText.indexOf(lowerQuery, pos);
            if (found === -1) {
                result += escapeHtml(text.substring(pos));
                break;
            }
            result += escapeHtml(text.substring(pos, found));
            result += `<mark class="ce-highlight">${escapeHtml(text.substring(found, found + query.length))}</mark>`;
            pos = found + query.length;
        }

        display.innerHTML = result;
    }

    function escapeHtml(str) {
        return str
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/\n/g, "<br>");
    }

    function findMatches() {
        const text = $("#ce-output").val();
        const query = $("#ce-search").val().trim();
        matches = [];
        currentMatch = -1;
        $("#ce-search-info").text("");

        renderDisplay(query);

        if (!query || !text) return;

        const lowerText = text.toLowerCase();
        const lowerQuery = query.toLowerCase();
        let pos = 0;
        while ((pos = lowerText.indexOf(lowerQuery, pos)) !== -1) {
            matches.push(pos);
            pos += lowerQuery.length;
        }

        if (matches.length === 0) {
            $("#ce-search-info").text("не найдено");
        } else {
            currentMatch = 0;
            jumpTo(currentMatch);
        }
    }

    function jumpTo(idx) {
        if (matches.length === 0) return;
        currentMatch = (idx + matches.length) % matches.length;
        $("#ce-search-info").text(`${currentMatch + 1} / ${matches.length}`);

        // Скроллим к активному highlight
        const highlights = document.querySelectorAll(".ce-highlight");
        if (highlights[currentMatch]) {
            highlights.forEach(el => el.classList.remove("ce-highlight-active"));
            highlights[currentMatch].classList.add("ce-highlight-active");
            highlights[currentMatch].scrollIntoView({ block: "center", behavior: "smooth" });
        }
    }

    $("#ce-search").on("input", findMatches);
    $("#ce-search-next").on("click", () => jumpTo(currentMatch + 1));
    $("#ce-search-prev").on("click", () => jumpTo(currentMatch - 1));

    $("#ce-preview-btn").on("click", () => {
        setTimeout(() => {
            const query = $("#ce-search").val().trim();
            renderDisplay(query);
            if (query) findMatches();
        }, 50);
    });
}

function openExporterWindow() {
    if ($("#ce-modal").length) {
        $("#ce-modal").show();
        // Сбрасываем инлайн-координаты. Если окно улетело, оно вернется в центр
        $("#ce-modal").css({ left: "", top: "", right: "", bottom: "" });
        return;
    }

    const messages = getMessages();
    const total = messages.length;

    if (total === 0) {
        toastr.warning("Нет сообщений в текущем чате!", "Chat Exporter");
        return;
    }

    const modal = $(`
        <div id="ce-modal">
            <div id="ce-modal-header">
                <span>📋 Chat Exporter</span>
                <button id="ce-modal-close">✕</button>
            </div>
            <div id="ce-modal-body">
               <div id="ce-range-row">
                    <label>От: <input id="ce-from" type="number" min="1" max="${total}" value="1" /></label>
                    <label>До: <input id="ce-to" type="number" min="1" max="${total}" value="${total}" /></label>
                    <span class="ce-separator">или конкретные:</span>
                    <input id="ce-specific" type="text" placeholder="1, 3, 7, 12..." title="Номера через запятую (приоритет над диапазоном)" />
                </div>
               <div id="ce-filter-row">
                    <label>Автор:
                        <select id="ce-author-filter">
                            <option value="all">Все</option>
                            <option value="user">Только юзер</option>
                            <option value="bot">Только бот</option>
                        </select>
                    </label>
                    <button id="ce-preview-btn" class="menu_button">Показать</button>
                </div>
                <div id="ce-search-row">
                    <input id="ce-search" type="text" placeholder="Поиск по тексту..." />
                    <button id="ce-search-prev" class="menu_button" title="Предыдущее">▲</button>
                    <button id="ce-search-next" class="menu_button" title="Следующее">▼</button>
                    <span id="ce-search-info"></span>
                </div>
                <div id="ce-output-wrapper">
                    <div id="ce-output-display" readonly></div>
                    <textarea id="ce-output" readonly style="display:none"></textarea>
                </div>
                <div id="ce-modal-footer">
                    <button id="ce-copy-btn" class="menu_button">📋 Копировать</button>
                    <button id="ce-export-btn" class="menu_button">💾 Скачать TXT</button>
                    <button id="ce-export-html-btn" class="menu_button">🌐 Скачать HTML</button>
                </div>
            </div>
        </div>
    `);

    $("body").append(modal);

    // Закрытие
    $("#ce-modal-close").on("click", () => $("#ce-modal").hide());

   // Предпросмотр
    $("#ce-preview-btn").on("click", () => {
        const messages = getMessages();
        const total = messages.length;
        const authorFilter = $("#ce-author-filter").val();
        let indices = [];

        const specificVal = $("#ce-specific").val().trim();

        if (specificVal) {
            indices = specificVal
                .split(",")
                .map(s => parseInt(s.trim()) - 1)
                .filter(n => !isNaN(n) && n >= 0 && n < total);

            if (indices.length === 0) {
                toastr.error("Не удалось распознать номера сообщений!", "Chat Exporter");
                return;
            }
        } else {
            const from = Math.max(0, parseInt($("#ce-from").val()) - 1);
            const to = Math.min(total - 1, parseInt($("#ce-to").val()) - 1);
            if (from > to) {
                toastr.error("'От' не может быть больше 'До'!", "Chat Exporter");
                return;
            }
            for (let i = from; i <= to; i++) indices.push(i);
        }

        // Применяем фильтр по автору
        if (authorFilter === "user") {
            indices = indices.filter(i => messages[i].is_user);
        } else if (authorFilter === "bot") {
            indices = indices.filter(i => !messages[i].is_user);
        }

        if (indices.length === 0) {
            toastr.warning("Нет сообщений по выбранным фильтрам!", "Chat Exporter");
            return;
        }

        const result = formatMessages(messages, indices);
        $("#ce-output").val(result);
    });

    // Копировать
    $("#ce-copy-btn").on("click", () => {
        const text = $("#ce-output").val();
        if (!text) { toastr.warning("Сначала нажми 'Показать'!"); return; }
        navigator.clipboard.writeText(text).then(() => {
            toastr.success("Скопировано в буфер обмена!", "Chat Exporter");
        });
    });

    // Скачать TXT
    $("#ce-export-btn").on("click", () => {
        const text = $("#ce-output").val();
        if (!text) { toastr.warning("Сначала нажми 'Показать'!"); return; }
        const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `chat-export-${Date.now()}.txt`;
        a.click();
        URL.revokeObjectURL(url);
    });

    // Скачать HTML
    $("#ce-export-html-btn").on("click", () => {
        const text = $("#ce-output").val();
        if (!text) { toastr.warning("Сначала нажми 'Показать'!"); return; }

        const messages = getMessages();
        const context = getContext();
        const chatName = context?.characters?.[context?.characterId]?.name || "Chat";
        const date = new Date().toLocaleString();

        // Собираем сообщения заново для HTML
        const s = extension_settings[extensionName];
        const indices = text === "" ? [] : (() => {
            const from = Math.max(0, parseInt($("#ce-from").val()) - 1);
            const to = Math.min(messages.length - 1, parseInt($("#ce-to").val()) - 1);
            const arr = [];
            for (let i = from; i <= to; i++) arr.push(i);
            return arr;
        })();

        const messagesHtml = indices.map(idx => {
            const msg = messages[idx];
            if (!msg) return "";
            const isUser = msg.is_user;
            const name = isUser
                ? (context.name1 || "User")
                : (msg.name || context.name2 || "Bot");
            const timestamp = msg.send_date || "";
            const msgText = (msg.mes || "").trim()
                .replace(/&/g, "&amp;")
                .replace(/</g, "&lt;")
                .replace(/>/g, "&gt;")
                .replace(/\n/g, "<br>");

            const metaParts = [];
            if (s.includeNumbers) metaParts.push(`<span class="msg-num">#${idx + 1}</span>`);
            if (s.includeTimestamp && timestamp) metaParts.push(`<span class="msg-time">${timestamp}</span>`);
            const meta = metaParts.length ? `<div class="msg-meta">${metaParts.join(" ")}</div>` : "";

            return `
            <div class="message ${isUser ? "message-user" : "message-bot"}">
                <div class="message-header">
                    <span class="message-name">${name}</span>
                    ${meta}
                </div>
                <div class="message-body">${msgText}</div>
            </div>`;
        }).join("\n");

        const html = `<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${chatName} — Chat Export</title>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Crimson+Pro:ital,wght@0,300;0,400;0,600;1,300;1,400&family=JetBrains+Mono:wght@300;400&display=swap');

        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        body {
            background: #0d0d14;
            color: #c8c8d8;
            font-family: 'Crimson Pro', Georgia, serif;
            font-size: 18px;
            line-height: 1.7;
            min-height: 100vh;
            padding: 0;
        }

        .page-wrapper {
            max-width: 860px;
            margin: 0 auto;
            padding: 60px 40px 100px;
        }

        header {
            border-bottom: 1px solid #2a2a3a;
            padding-bottom: 28px;
            margin-bottom: 52px;
        }

        header h1 {
            font-size: 2em;
            font-weight: 300;
            letter-spacing: 0.04em;
            color: #e8e0f0;
        }

        header .export-meta {
            font-family: 'JetBrains Mono', monospace;
            font-size: 0.62em;
            color: #555568;
            margin-top: 8px;
            letter-spacing: 0.06em;
            text-transform: uppercase;
        }

        .messages {
            display: flex;
            flex-direction: column;
            gap: 0;
        }

        .message {
            padding: 28px 0;
            border-bottom: 1px solid #1a1a26;
            position: relative;
        }

        .message:last-child { border-bottom: none; }

        .message-header {
            display: flex;
            align-items: baseline;
            gap: 14px;
            margin-bottom: 10px;
        }

        .message-name {
            font-weight: 600;
            font-size: 0.78em;
            letter-spacing: 0.1em;
            text-transform: uppercase;
        }

        .message-user .message-name { color: #a0c4ff; }
        .message-bot .message-name { color: #c9a0ff; }

        .msg-meta {
            display: flex;
            gap: 10px;
            align-items: center;
        }

        .msg-num {
            font-family: 'JetBrains Mono', monospace;
            font-size: 0.6em;
            color: #444458;
            letter-spacing: 0.05em;
        }

        .msg-time {
            font-family: 'JetBrains Mono', monospace;
            font-size: 0.6em;
            color: #444458;
        }

        .message-body {
            font-size: 1em;
            color: #b8b8cc;
            line-height: 1.75;
            font-weight: 300;
        }

        .message-user .message-body { color: #ccd8ee; }

        em, i { font-style: italic; color: #9898b8; }

        footer {
            margin-top: 60px;
            padding-top: 24px;
            border-top: 1px solid #1a1a26;
            font-family: 'JetBrains Mono', monospace;
            font-size: 0.58em;
            color: #333344;
            letter-spacing: 0.08em;
            text-transform: uppercase;
            text-align: center;
        }
    </style>
</head>
<body>
    <div class="page-wrapper">
        <header>
            <h1>${chatName}</h1>
            <div class="export-meta">Exported ${date} &nbsp;·&nbsp; ${indices.length} messages</div>
        </header>
        <div class="messages">
            ${messagesHtml}
        </div>
        <footer>Chat Exporter · SillyTavern</footer>
    </div>
</body>
</html>`;

        const blob = new Blob([html], { type: "text/html;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${chatName}-export-${Date.now()}.html`;
        a.click();
        URL.revokeObjectURL(url);
    });

    // Поиск
    setupSearch();

    // Перетаскивание
    let isDragging = false, startX, startY, origLeft, origTop;

    $("#ce-modal-header").on("mousedown touchstart", (e) => {
        isDragging = true;
        // Определяем, мышь это или палец
        const event = e.type.includes("touch") ? e.originalEvent.touches[0] : e;
        startX = event.clientX;
        startY = event.clientY;
        
        // Используем getBoundingClientRect для точных координат fixed-элемента
        const rect = $("#ce-modal")[0].getBoundingClientRect();
        origLeft = rect.left;
        origTop = rect.top;
        
        if (!e.type.includes("touch")) e.preventDefault();
    });

    $(document).on("mousemove.ce touchmove.ce", (e) => {
        if (!isDragging) return;
        const event = e.type.includes("touch") ? e.originalEvent.touches[0] : e;
        const dx = event.clientX - startX;
        const dy = event.clientY - startY;

        let newLeft = origLeft + dx;
        let newTop = origTop + dy;

        const modal = $("#ce-modal");
        
        // Вычисляем границы видимой области экрана
        const maxX = window.innerWidth - modal.outerWidth();
        const maxY = window.innerHeight - modal.outerHeight();

        // Ограничиваем координаты, чтобы модалка не улетела за пределы
        newLeft = Math.max(0, Math.min(newLeft, maxX));
        newTop = Math.max(0, Math.min(newTop, maxY));

        modal.css({ left: newLeft, top: newTop, right: "auto", bottom: "auto" });
    });

    $(document).on("mouseup.ce touchend.ce", () => { isDragging = false; });
}

jQuery(async () => {
    console.log(`[${extensionName}] Loading...`);
    try {
        const settingsHtml = await $.get(`${extensionFolderPath}/example.html`);
        $("#extensions_settings2").append(settingsHtml);

        $("#ce_plain_text").on("input", (e) => onCheckboxChange("includePlainText", e));
        $("#ce_names").on("input", (e) => onCheckboxChange("includeNames", e));
        $("#ce_timestamp").on("input", (e) => onCheckboxChange("includeTimestamp", e));
        $("#ce_numbers").on("input", (e) => onCheckboxChange("includeNumbers", e));
        $("#ce_open_btn").on("click", openExporterWindow);

        // Кнопка в тулбаре сообщений
        $(document).on("click", "#ce-scroll-btn", function() {
            openExporterWindow();
        });

        // Добавляем кнопку в каждое новое сообщение
        const addExportButton = () => {
            $(".mes_buttons").each(function() {
                if ($(this).find("#ce-scroll-btn").length === 0) {
                    $(this).prepend(`<div id="ce-scroll-btn" class="mes_button fa-solid fa-scroll interactable" title="Chat Exporter" tabindex="0" role="button"></div>`);
                }
            });
        };

        // Добавляем в существующие сообщения
        addExportButton();

        // Следим за новыми сообщениями
        const observer = new MutationObserver(addExportButton);
        observer.observe(document.getElementById("chat"), {
            childList: true,
            subtree: true
        });

        loadSettings();
        console.log(`[${extensionName}] ✅ Loaded successfully`);
    } catch (error) {
        console.error(`[${extensionName}] ❌ Failed to load:`, error);
    }
});
