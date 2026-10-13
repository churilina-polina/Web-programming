"use strict";

// ---------- Константы ----------

const STORAGE_KEY = "todoListState";
const MAX_TEXT_LENGTH = 120;
const INTERFACE_SCALE = 0.0125;
const SVG_NS = "http://www.w3.org/2000/svg";
const STYLES_URL = "css/style.css";
const FONTS_URL =
  "https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@500;600;700&family=Montserrat:wght@400;500;600&display=swap";

const FILTERS = [
  { value: "all", label: "Все" },
  { value: "active", label: "Невыполненные" },
  { value: "done", label: "Выполненные" },
];

const ICONS = {
  grip: ["M9 6h.01", "M15 6h.01", "M9 12h.01", "M15 12h.01", "M9 18h.01", "M15 18h.01"],
  edit: ["M12 20h9", "M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"],
  trash: [
    "M3 6h18",
    "M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2",
    "M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6",
    "M10 11v6",
    "M14 11v6",
  ],
  check: ["M20 6 9 17l-5-5"],
  close: ["M18 6 6 18", "M6 6l12 12"],
};

// ---------- Состояние ----------

const state = {
  tasks: [],
  filter: "all",
  query: "",
  editingId: null,
};

const ui = {};

// ---------- Помощники для работы с DOM ----------

function el(tag, props = {}, ...children) {
  const node = document.createElement(tag);

  for (const [key, value] of Object.entries(props)) {
    if (value === undefined || value === null || value === false) continue;

    if (key === "text") node.textContent = value;
    else if (key === "dataset") Object.assign(node.dataset, value);
    else if (/^on[A-Z]/.test(key)) node.addEventListener(key.slice(2).toLowerCase(), value);
    else if (key === "role" || key.startsWith("aria-")) node.setAttribute(key, value);
    else node[key] = value;
  }

  node.append(...children.filter((child) => child !== null && child !== undefined && child !== false));
  return node;
}

function icon(name) {
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", name === "grip" ? "3" : "2");
  svg.setAttribute("stroke-linecap", "round");
  svg.setAttribute("stroke-linejoin", "round");
  svg.setAttribute("aria-hidden", "true");

  for (const d of ICONS[name]) {
    const path = document.createElementNS(SVG_NS, "path");
    path.setAttribute("d", d);
    svg.append(path);
  }

  return svg;
}

function iconButton({ name, label, description, onClick, className = "", type = "button" }) {
  return el(
    "button",
    {
      className: `icon-btn ${className}`.trim(),
      type,
      title: label,
      "aria-label": description || label,
      onClick,
    },
    icon(name)
  );
}

function field(labelText, input) {
  return el("label", { className: "field" }, el("span", { className: "field__label", text: labelText }), input);
}

function loadStylesheet(href) {
  return new Promise((resolve) => {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = href;
    link.addEventListener("load", resolve, { once: true });
    link.addEventListener("error", resolve, { once: true });
    document.head.append(link);
  });
}

// ---------- Даты и идентификаторы ----------

function todayISO() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

function formatDate(iso) {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function compareDates(a, b) {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

function createId() {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

// ---------- localStorage ----------

function isValidTask(task) {
  return (
    task !== null &&
    typeof task === "object" &&
    typeof task.id === "string" &&
    typeof task.text === "string" &&
    typeof task.done === "boolean" &&
    typeof task.date === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(task.date)
  );
}

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (!saved || !Array.isArray(saved.tasks)) return;

    state.tasks = saved.tasks.filter(isValidTask).map((task) => ({ ...task, createdAt: Number(task.createdAt) || 0 }));
    if (FILTERS.some((filter) => filter.value === saved.filter)) state.filter = saved.filter;
  } catch {
    state.tasks = [];
  }
}

function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ tasks: state.tasks, filter: state.filter }));
  } catch {
    // хранилище недоступно (приватный режим, переполнение) — приложение продолжает работать без сохранения
  }
}

function commit() {
  saveState();
  render();
}

// ---------- Действия над задачами ----------

function addTask(text, date) {
  state.tasks.push({ id: createId(), text, date, done: false, createdAt: Date.now() });
  commit();
}

function deleteTask(id) {
  state.tasks = state.tasks.filter((task) => task.id !== id);
  commit();
}

function toggleTask(id) {
  const task = state.tasks.find((item) => item.id === id);
  if (!task) return;
  task.done = !task.done;
  commit();
}

function startEdit(id) {
  state.editingId = id;
  render();

  const input = ui.list.querySelector(".task__edit-text");
  if (input) {
    input.focus();
    input.select();
  }
}

function cancelEdit() {
  state.editingId = null;
  render();
}

function saveEdit(id, text, date) {
  const task = state.tasks.find((item) => item.id === id);
  if (task) {
    task.text = text;
    task.date = date;
  }
  state.editingId = null;
  commit();
}

function sortByDate(direction) {
  state.tasks.sort((a, b) => direction * compareDates(a.date, b.date) || a.createdAt - b.createdAt);
  commit();
}

function setFilter(value) {
  state.filter = value;
  saveState();
  render();
}

function moveTask(id, offset) {
  const visible = getVisibleTasks();
  const index = visible.findIndex((task) => task.id === id);
  const target = visible[index + offset];
  if (index === -1 || !target) return false;

  const from = state.tasks.findIndex((task) => task.id === id);
  const to = state.tasks.findIndex((task) => task.id === target.id);
  [state.tasks[from], state.tasks[to]] = [state.tasks[to], state.tasks[from]];
  commit();
  return true;
}

function getVisibleTasks() {
  const query = state.query.trim().toLowerCase();

  return state.tasks.filter((task) => {
    if (state.filter === "active" && task.done) return false;
    if (state.filter === "done" && !task.done) return false;
    return task.text.toLowerCase().includes(query);
  });
}

// ---------- Построение интерфейса ----------

function createViewItem(task) {
  const overdue = !task.done && task.date < todayISO();

  const handle = el(
    "button",
    {
      className: "icon-btn task__handle",
      type: "button",
      title: "Перетащите, чтобы изменить порядок",
      "aria-label": `Переместить задачу «${task.text}»`,
    },
    icon("grip")
  );

  const check = el("input", {
    className: "task__check",
    type: "checkbox",
    checked: task.done,
    "aria-label": `Отметить выполненной: ${task.text}`,
    onChange: () => toggleTask(task.id),
  });

  const meta = el(
    "p",
    { className: "task__meta" },
    el("time", { dateTime: task.date, text: `до ${formatDate(task.date)}` }),
    overdue ? el("span", { className: "badge", text: "Просрочено" }) : null
  );

  const actions = el(
    "div",
    { className: "task__actions" },
    iconButton({
      name: "edit",
      label: "Редактировать",
      description: `Редактировать задачу «${task.text}»`,
      onClick: () => startEdit(task.id),
    }),
    iconButton({
      name: "trash",
      label: "Удалить",
      description: `Удалить задачу «${task.text}»`,
      className: "icon-btn--danger",
      onClick: () => deleteTask(task.id),
    })
  );

  const classes = ["task", task.done && "task--done", overdue && "task--overdue"].filter(Boolean).join(" ");

  return el(
    "li",
    { className: classes, dataset: { id: task.id } },
    handle,
    check,
    el("div", { className: "task__body" }, el("p", { className: "task__text", text: task.text }), meta),
    actions
  );
}

function createEditItem(task) {
  const textInput = el("input", {
    className: "field__input task__edit-text",
    type: "text",
    value: task.text,
    required: true,
    maxLength: MAX_TEXT_LENGTH,
    "aria-label": "Название задачи",
    onInput: () => textInput.setCustomValidity(""),
  });

  const dateInput = el("input", {
    className: "field__input",
    type: "date",
    value: task.date,
    required: true,
    "aria-label": "Срок выполнения",
  });

  const handleSubmit = (event) => {
    event.preventDefault();
    const text = textInput.value.trim();

    if (!text) {
      textInput.setCustomValidity("Введите название задачи");
      textInput.reportValidity();
      return;
    }

    saveEdit(task.id, text, dateInput.value);
  };

  const form = el(
    "form",
    {
      className: "task__edit-form",
      onSubmit: handleSubmit,
      onKeydown: (event) => {
        if (event.key === "Escape") cancelEdit();
      },
    },
    textInput,
    dateInput,
    el(
      "div",
      { className: "task__actions" },
      iconButton({ name: "check", label: "Сохранить", description: "Сохранить изменения", className: "icon-btn--ok", type: "submit" }),
      iconButton({ name: "close", label: "Отмена", description: "Отменить редактирование", onClick: cancelEdit })
    )
  );

  return el("li", { className: "task task--editing", dataset: { id: task.id } }, form);
}

function createTaskItem(task) {
  return state.editingId === task.id ? createEditItem(task) : createViewItem(task);
}

function handleAddSubmit(event) {
  event.preventDefault();
  const text = ui.titleInput.value.trim();

  if (!text) {
    ui.titleInput.setCustomValidity("Введите название задачи");
    ui.titleInput.reportValidity();
    return;
  }

  addTask(text, ui.dateInput.value || todayISO());
  ui.titleInput.value = "";
  ui.titleInput.focus();
}

function buildHeader() {
  return el(
    "header",
    { className: "app-header" },
    el("h1", { className: "app-title", text: "Мои задачи" }),
    el("p", { className: "app-subtitle", text: "Планируйте дела, ищите, сортируйте и перетаскивайте" })
  );
}

function buildAddSection() {
  ui.titleInput = el("input", {
    className: "field__input",
    type: "text",
    name: "text",
    placeholder: "Что нужно сделать?",
    required: true,
    maxLength: MAX_TEXT_LENGTH,
    autocomplete: "off",
    onInput: () => ui.titleInput.setCustomValidity(""),
  });

  ui.dateInput = el("input", {
    className: "field__input",
    type: "date",
    name: "date",
    value: todayISO(),
    required: true,
  });

  return el(
    "section",
    { className: "panel", "aria-label": "Добавление задачи" },
    el(
      "form",
      { className: "task-form", onSubmit: handleAddSubmit },
      field("Новая задача", ui.titleInput),
      field("Срок", ui.dateInput),
      el("button", { className: "btn btn--primary", type: "submit", text: "Добавить" })
    )
  );
}

function buildToolbar() {
  ui.searchInput = el("input", {
    className: "field__input",
    type: "search",
    placeholder: "Поиск по названию…",
    autocomplete: "off",
    "aria-label": "Поиск задач по названию",
    onInput: (event) => {
      state.query = event.target.value;
      render();
    },
  });

  ui.filterButtons = new Map(
    FILTERS.map((filter) => [
      filter.value,
      el("button", { className: "chip", type: "button", text: filter.label, onClick: () => setFilter(filter.value) }),
    ])
  );

  return el(
    "section",
    { className: "panel toolbar", "aria-label": "Поиск, фильтр и сортировка" },
    el("form", { role: "search", className: "toolbar__search", onSubmit: (event) => event.preventDefault() }, ui.searchInput),
    el(
      "div",
      { className: "toolbar__row" },
      el("div", { className: "chips", role: "group", "aria-label": "Фильтр по статусу" }, ...ui.filterButtons.values()),
      el(
        "div",
        { className: "chips", role: "group", "aria-label": "Сортировка по дате" },
        el("button", { className: "chip chip--ghost", type: "button", text: "Сначала ранние", onClick: () => sortByDate(1) }),
        el("button", { className: "chip chip--ghost", type: "button", text: "Сначала поздние", onClick: () => sortByDate(-1) })
      )
    )
  );
}

function buildListSection() {
  ui.counter = el("p", { className: "counter", "aria-live": "polite" });
  ui.list = el("ul", { className: "task-list" });
  ui.empty = el("p", { className: "empty" });

  setupDragAndDrop(ui.list);
  setupKeyboardReorder(ui.list);

  return el("section", { className: "list-section", "aria-label": "Список задач" }, ui.counter, ui.list, ui.empty);
}

function buildApp() {
  const page = el(
    "div",
    { className: "page" },
    buildHeader(),
    el("main", { className: "app-main" }, buildAddSection(), buildToolbar(), buildListSection()),
    el("footer", { className: "app-footer", text: "Порядок задач можно менять перетаскиванием за значок слева." })
  );

  document.body.prepend(page);
}

// ---------- Отрисовка ----------

function render() {
  const visible = getVisibleTasks();

  if (!visible.some((task) => task.id === state.editingId)) state.editingId = null;

  ui.list.replaceChildren(...visible.map(createTaskItem));

  const remaining = state.tasks.filter((task) => !task.done).length;
  ui.counter.textContent = `Осталось выполнить: ${remaining} из ${state.tasks.length}`;
  ui.counter.hidden = state.tasks.length === 0;

  ui.empty.textContent = state.tasks.length === 0 ? "Список пуст — добавьте первую задачу." : "Ничего не найдено.";
  ui.empty.hidden = visible.length > 0;

  for (const [value, button] of ui.filterButtons) {
    const active = value === state.filter;
    button.classList.toggle("chip--active", active);
    button.setAttribute("aria-pressed", String(active));
  }
}

// ---------- Drag-and-drop ----------

function findNextSibling(list, dragged, pointerY) {
  const siblings = [...list.children].filter((child) => child !== dragged);

  return (
    siblings.find((sibling) => {
      const box = sibling.getBoundingClientRect();
      return pointerY < box.top + box.height / 2;
    }) ?? null
  );
}

function autoScroll(pointerY) {
  const edge = 70;
  if (pointerY < edge) window.scrollBy(0, -14);
  else if (window.innerHeight - pointerY < edge) window.scrollBy(0, 14);
}

function applyDomOrder(list) {
  const orderedIds = [...list.children].map((item) => item.dataset.id);
  const tasksById = new Map(state.tasks.map((task) => [task.id, task]));
  const reordered = orderedIds.map((id) => tasksById.get(id));
  const slots = [];

  state.tasks.forEach((task, index) => {
    if (orderedIds.includes(task.id)) slots.push(index);
  });

  if (slots.every((slot, index) => state.tasks[slot] === reordered[index])) return;

  slots.forEach((slot, index) => {
    state.tasks[slot] = reordered[index];
  });
  commit();
}

function setupDragAndDrop(list) {
  list.addEventListener("pointerdown", (event) => {
    const handle = event.target.closest(".task__handle");
    if (!handle || (event.pointerType === "mouse" && event.button !== 0)) return;

    event.preventDefault();

    const item = handle.closest(".task");
    list.setPointerCapture(event.pointerId);
    item.classList.add("task--dragging");
    document.body.classList.add("is-sorting");

    const onMove = (moveEvent) => {
      const next = findNextSibling(list, item, moveEvent.clientY);
      if (next !== item.nextElementSibling) list.insertBefore(item, next);
      autoScroll(moveEvent.clientY);
    };

    const onEnd = () => {
      list.removeEventListener("pointermove", onMove);
      list.removeEventListener("pointerup", onEnd);
      list.removeEventListener("pointercancel", onEnd);
      item.classList.remove("task--dragging");
      document.body.classList.remove("is-sorting");
      applyDomOrder(list);
    };

    list.addEventListener("pointermove", onMove);
    list.addEventListener("pointerup", onEnd);
    list.addEventListener("pointercancel", onEnd);
  });
}

function setupKeyboardReorder(list) {
  list.addEventListener("keydown", (event) => {
    const handle = event.target.closest(".task__handle");
    if (!handle || (event.key !== "ArrowUp" && event.key !== "ArrowDown")) return;

    event.preventDefault();
    const id = handle.closest(".task").dataset.id;

    if (moveTask(id, event.key === "ArrowUp" ? -1 : 1)) {
      list.querySelector(`[data-id="${id}"] .task__handle`)?.focus();
    }
  });
}

// ---------- Масштаб интерфейса ----------

function scaleInterface() {
  const width = document.documentElement.clientWidth;
  document.documentElement.style.fontSize = `${Math.max(16, width * INTERFACE_SCALE)}px`;
}

// ---------- Запуск ----------

window.addEventListener("resize", scaleInterface);
scaleInterface();

loadStylesheet(FONTS_URL);
loadStylesheet(STYLES_URL).then(() => {
  loadState();
  buildApp();
  render();
});
