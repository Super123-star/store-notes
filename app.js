"use strict";

const STORAGE_KEY = "mama-store-notes-v1";

const storeForm = document.querySelector("#store-form");
const storesContainer = document.querySelector("#stores");
const emptyMessage = document.querySelector("#empty-message");
const storeCount = document.querySelector("#store-count");
const remindersContainer = document.querySelector("#reminders");
const backupStatus = document.querySelector("#backup-status");

let stores = loadStores();

function loadStores() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return [];

    const parsed = JSON.parse(saved);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.error("Не удалось прочитать сохранённые записи:", error);
    return [];
  }
}

function saveStores() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(stores));
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, character => {
    const replacements = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;"
    };
    return replacements[character];
  });
}

function todayString() {
  const date = new Date();
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return localDate.toISOString().slice(0, 10);
}

function formatDate(dateString) {
  if (!dateString) return "";
  const date = new Date(`${dateString}T12:00:00`);
  return new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric"
  }).format(date);
}

function makeId() {
  if (window.crypto && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function render() {
  storesContainer.innerHTML = "";
  emptyMessage.hidden = stores.length > 0;
  storeCount.textContent = stores.length
    ? `Всего: ${stores.length}`
    : "";

  for (const store of stores) {
    const notes = Array.isArray(store.notes) ? [...store.notes] : [];
    notes.sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));

    const notesHtml = notes.length
      ? notes.map(note => `
          <div class="note-item">
            <div class="note-date">${escapeHtml(note.dateLabel || "")}</div>
            <div class="note-text">${escapeHtml(note.text || "")}</div>
          </div>
        `).join("")
      : `<p class="muted">Заметок пока нет.</p>`;

    const card = document.createElement("article");
    card.className = "store-card";
    card.innerHTML = `
      <div class="store-heading">
        <h3>${escapeHtml(store.name)}</h3>
        <button class="danger" type="button" data-action="delete"
                data-id="${escapeHtml(store.id)}">Удалить</button>
      </div>

      ${store.address
        ? `<p class="store-address">${escapeHtml(store.address)}</p>`
        : ""}

      <p class="visit-label">
        Следующий визит:
        <strong>${store.nextVisit
          ? escapeHtml(formatDate(store.nextVisit))
          : "дата не указана"}</strong>
      </p>

      <form class="note-form" data-id="${escapeHtml(store.id)}">
        <label>
          Новая заметка
          <textarea name="note" maxlength="2000"
                    placeholder="Что нужно купить или о чём договорились?"></textarea>
        </label>

        <label>
          Дата следующего визита — необязательно
          <input type="date" name="nextVisit"
                 value="${escapeHtml(store.nextVisit || "")}">
        </label>

        <div class="note-actions">
          <button type="button" data-action="voice"
                  data-id="${escapeHtml(store.id)}">🎙 Надиктовать</button>
          <button type="submit">Сохранить заметку</button>
        </div>
        <p class="voice-status" data-status-for="${escapeHtml(store.id)}"
           aria-live="polite"></p>
      </form>

      <div class="history">
        <h4>История заметок</h4>
        ${notesHtml}
      </div>
    `;

    storesContainer.append(card);
  }renderReminders();
}

function renderReminders() {const upcoming = stores
    .filter(store => store.nextVisit)
    .sort((a, b) => a.nextVisit.localeCompare(b.nextVisit));

  if (!upcoming.length) {
    remindersContainer.innerHTML =
      `<p class="muted">Пока нет дат следующих визитов.</p>`;
    return;
  }

  const today = todayString();

  remindersContainer.innerHTML = upcoming.map(store => {
    const isOverdue = store.nextVisit < today;
    const dateText = isOverdue
      ? `Просрочено · ${formatDate(store.nextVisit)}`
      : formatDate(store.nextVisit);

    return `
      <div class="reminder-row">
        <strong>${escapeHtml(store.name)}</strong>
        <span class="reminder-date ${isOverdue ? "overdue" : ""}">
          ${escapeHtml(dateText)}
        </span>
      </div>
    `;
  }).join("");
}

storeForm.addEventListener("submit", event => {
  event.preventDefault();

  const name = document.querySelector("#store-name").value.trim();
  const address = document.querySelector("#store-address").value.trim();

  if (!name) return;

  stores.push({
    id: makeId(),
    name,
    address,
    nextVisit: "",
    notes: []
  });

  saveStores();
  storeForm.reset();
  render();
});

storesContainer.addEventListener("submit", event => {
  const form = event.target.closest(".note-form");
  if (!form) return;

  event.preventDefault();

  const store = stores.find(item => item.id === form.dataset.id);
  if (!store) return;

  const text = form.elements.note.value.trim();
  store.nextVisit = form.elements.nextVisit.value;

  if (text) {
    store.notes = Array.isArray(store.notes) ? store.notes : [];
    store.notes.push({
      text,
      createdAt: new Date().toISOString(),
      dateLabel: new Intl.DateTimeFormat("ru-RU", {
        dateStyle: "medium",
        timeStyle: "short"
      }).format(new Date())
    });
  }

  saveStores();
  render();
});

storesContainer.addEventListener("change", event => {
  if (!event.target.matches('input[name="nextVisit"]')) return;

  const form = event.target.closest(".note-form");
  const store = stores.find(item => item.id === form.dataset.id);

  if (store) {
    store.nextVisit = event.target.value;
    saveStores();
    renderReminders();
  }
});

storesContainer.addEventListener("click", event => {
  const button = event.target.closest("button[data-action]");
  if (!button) return;

  const store = stores.find(item => item.id === button.dataset.id);
  if (!store) return;

  if (button.dataset.action === "delete") {
    const confirmed = window.confirm(
      `Удалить «${store.name}» и все его заметки?`
    );

    if (confirmed) {
      stores = stores.filter(item => item.id !== store.id);
      saveStores();
      render();
    }
  }

  if (button.dataset.action === "voice") {
    startVoiceInput(store.id);
  }
});

function startVoiceInput(storeId) {
  const SpeechRecognition =
    window.SpeechRecognition || window.webkitSpeechRecognition;

  const status = document.querySelector(`[data-status-for="${CSS.escape(storeId)}"]`);
  const form = document.querySelector(`.note-form[data-id="${CSS.escape(storeId)}"]`);
  const textarea = form?.elements.note;

  if (!SpeechRecognition) {
    status.textContent =
      "Распознавание в этом браузере недоступно. Используйте микрофон на клавиатуре телефона.";
    return;
  }

  const recognition = new SpeechRecognition();
  recognition.lang = "ru-RU";
  recognition.interimResults = false;
  recognition.continuous = false;

  status.textContent = "Слушаю… Говорите после разрешения доступа к микрофону.";

  recognition.onresult = event => {
    const spokenText = event.results[0][0].transcript;
    textarea.value = textarea.value
      ? `${textarea.value} ${spokenText}`
      : spokenText;
    status.textContent = "Текст распознан. Проверьте его и сохраните заметку.";
  };

  recognition.onerror = event => {
    status.textContent =
      event.error === "not-allowed"
        ? "Нет доступа к микрофону. Разрешите его в настройках браузера.": "Не удалось распознать речь. Попробуйте ещё раз или используйте клавиатуру.";
  };recognition.onend = () => {
    if (status.textContent === "Слушаю… Говорите после разрешения доступа к микрофону.") {
      status.textContent = "Запись завершена.";
    }
  };

  recognition.start();
}

document.querySelector("#export-button").addEventListener("click", () => {
  const file = new Blob(
    [JSON.stringify({ version: 1, stores }, null, 2)],
    { type: "application/json" }
  );

  const link = document.createElement("a");
  link.href = URL.createObjectURL(file);
  link.download = `moi-magaziny-${todayString()}.json`;
  link.click();
  URL.revokeObjectURL(link.href);

  backupStatus.textContent = "Копия скачана. Сохраните файл в надёжном месте.";
});

document.querySelector("#import-file").addEventListener("change", async event => {
  const file = event.target.files[0];
  if (!file) return;

  try {
    const parsed = JSON.parse(await file.text());

    if (!parsed || !Array.isArray(parsed.stores)) {
      throw new Error("В файле нет списка записей.");
    }

    const confirmed = window.confirm(
      "Заменить все записи на этом устройстве данными из файла? " +
      "Если нужно сохранить нынешние записи, сначала скачайте их копию."
    );

    if (!confirmed) {
      event.target.value = "";
      return;
    }

    stores = parsed.stores;
    saveStores();
    render();
    backupStatus.textContent = "Копия загружена.";
  } catch (error) {
    backupStatus.textContent =
      "Не удалось загрузить файл. Проверьте, что это копия из этого сайта.";
    console.error(error);
  }

  event.target.value = "";
});

render();

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(error => {
      console.log("Не удалось включить офлайн-режим:", error);
    });
  });
}