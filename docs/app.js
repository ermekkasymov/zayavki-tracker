(() => {
  "use strict";

  const STORAGE_KEY = "zayavkiTrackerState_v1";
  const PALETTE = ["status-blue", "status-yellow", "status-purple", "status-green"];

  const DEFAULT_STATE = {
    nextId: 1,
    threshold: 5,
    customers: Array.from({ length: 10 }, (_, i) => `Заказчик ${i + 1}`),
    suppliers: Array.from({ length: 3 }, (_, i) => `Поставщик ${i + 1}`),
    statuses: [
      "Принято в работу",
      "Запрос цены",
      "Отправлено предложение",
      "На согласовании у Заказчика",
      "Отправлено",
    ],
    orders: [],
  };

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return structuredClone(DEFAULT_STATE);
      const parsed = JSON.parse(raw);
      return Object.assign(structuredClone(DEFAULT_STATE), parsed);
    } catch (e) {
      console.error("Не удалось загрузить сохранённые данные, использую значения по умолчанию", e);
      return structuredClone(DEFAULT_STATE);
    }
  }

  let state = loadState();

  function saveState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function todayISO() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }

  function daysBetween(dateISO) {
    const [y, m, d] = dateISO.split("-").map(Number);
    const then = new Date(y, m - 1, d);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return Math.round((today - then) / 86400000);
  }

  function fmtDate(iso) {
    if (!iso) return "";
    const [y, m, d] = iso.split("-");
    return `${d}.${m}.${y}`;
  }

  function isClosedStatus(status) {
    return state.statuses.length > 0 && status === state.statuses[state.statuses.length - 1];
  }

  function statusClass(status) {
    const idx = state.statuses.indexOf(status);
    if (idx === -1) return "";
    if (isClosedStatus(status)) return "status-gray";
    return PALETTE[idx % PALETTE.length];
  }

  // ---------------------------------------------------------------------
  // Tabs
  // ---------------------------------------------------------------------
  document.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".tab-btn").forEach((b) => b.classList.remove("active"));
      document.querySelectorAll(".tab-panel").forEach((p) => p.classList.remove("active"));
      btn.classList.add("active");
      document.getElementById(`tab-${btn.dataset.tab}`).classList.add("active");
    });
  });

  // ---------------------------------------------------------------------
  // Orders table
  // ---------------------------------------------------------------------
  function renderOrdersHead() {
    const row = document.getElementById("ordersHeadRow");
    row.innerHTML = "";
    const cols = ["№", "Дата поступления", "Заказчик", "Поставщик", "Текущий статус"]
      .concat(state.statuses)
      .concat(["Дней на статусе", "Комментарий", ""]);
    cols.forEach((c) => {
      const th = document.createElement("th");
      th.textContent = c;
      row.appendChild(th);
    });
  }

  function makeSelect(options, value, onChange) {
    const sel = document.createElement("select");
    sel.className = "status-select";
    let hasValue = options.includes(value);
    if (value && !hasValue) options = options.concat([value]);
    const blank = document.createElement("option");
    blank.value = "";
    blank.textContent = "—";
    sel.appendChild(blank);
    options.forEach((opt) => {
      const o = document.createElement("option");
      o.value = opt;
      o.textContent = opt;
      if (opt === value) o.selected = true;
      sel.appendChild(o);
    });
    sel.addEventListener("change", () => onChange(sel.value));
    return sel;
  }

  function renderOrdersBody() {
    const body = document.getElementById("ordersBody");
    body.innerHTML = "";

    state.orders.forEach((order, idx) => {
      const tr = document.createElement("tr");
      if (isClosedStatus(order.status)) tr.classList.add("closed-row");

      const tdNum = document.createElement("td");
      tdNum.textContent = idx + 1;
      tr.appendChild(tdNum);

      const tdDateIn = document.createElement("td");
      const dateInInput = document.createElement("input");
      dateInInput.type = "date";
      dateInInput.className = "cell-input";
      dateInInput.value = order.dateIn || "";
      dateInInput.addEventListener("change", () => {
        order.dateIn = dateInInput.value;
        saveState();
      });
      tdDateIn.appendChild(dateInInput);
      tr.appendChild(tdDateIn);

      const tdCustomer = document.createElement("td");
      tdCustomer.appendChild(
        makeSelect(state.customers, order.customer, (v) => {
          order.customer = v;
          saveState();
        })
      );
      tr.appendChild(tdCustomer);

      const tdSupplier = document.createElement("td");
      tdSupplier.appendChild(
        makeSelect(state.suppliers, order.supplier, (v) => {
          order.supplier = v;
          saveState();
        })
      );
      tr.appendChild(tdSupplier);

      const tdStatus = document.createElement("td");
      tdStatus.className = statusClass(order.status);
      tdStatus.appendChild(
        makeSelect(state.statuses, order.status, (v) => {
          order.status = v;
          saveState();
          renderOrders();
        })
      );
      tr.appendChild(tdStatus);

      state.statuses.forEach((status) => {
        const td = document.createElement("td");
        const value = order.statusDates[status] || "";
        const isActive = order.status === status;

        if (isActive && !value) {
          td.classList.add("missing-date");
          const placeholder = document.createElement("span");
          placeholder.className = "date-cell-value empty";
          placeholder.title = "Клик — проставить сегодняшнюю дату";
          placeholder.addEventListener("click", () => {
            order.statusDates[status] = todayISO();
            saveState();
            renderOrders();
          });
          td.appendChild(placeholder);
        } else {
          const input = document.createElement("input");
          input.type = "date";
          input.className = "cell-input";
          input.value = value;
          input.addEventListener("change", () => {
            if (input.value) order.statusDates[status] = input.value;
            else delete order.statusDates[status];
            saveState();
            renderOrders();
          });
          td.appendChild(input);
        }
        tr.appendChild(td);
      });

      const tdDays = document.createElement("td");
      const activeDate = order.status ? order.statusDates[order.status] : null;
      if (activeDate) {
        const days = daysBetween(activeDate);
        tdDays.textContent = days;
        if (days > state.threshold) tdDays.classList.add("overdue");
      } else {
        tdDays.textContent = "—";
      }
      tr.appendChild(tdDays);

      const tdComment = document.createElement("td");
      const commentInput = document.createElement("input");
      commentInput.type = "text";
      commentInput.className = "cell-input comment-input";
      commentInput.value = order.comment || "";
      commentInput.addEventListener("change", () => {
        order.comment = commentInput.value;
        saveState();
      });
      tdComment.appendChild(commentInput);
      tr.appendChild(tdComment);

      const tdDel = document.createElement("td");
      const delBtn = document.createElement("button");
      delBtn.className = "del-btn";
      delBtn.textContent = "✕";
      delBtn.title = "Удалить заявку";
      delBtn.addEventListener("click", () => {
        if (confirm("Удалить эту заявку?")) {
          state.orders = state.orders.filter((o) => o.id !== order.id);
          saveState();
          renderOrders();
        }
      });
      tdDel.appendChild(delBtn);
      tr.appendChild(tdDel);

      body.appendChild(tr);
    });
  }

  function renderOrders() {
    renderOrdersHead();
    renderOrdersBody();
    renderSummary();
  }

  document.getElementById("addOrderBtn").addEventListener("click", () => {
    const firstStatus = state.statuses[0] || "";
    const order = {
      id: state.nextId++,
      dateIn: todayISO(),
      customer: "",
      supplier: "",
      status: firstStatus,
      statusDates: firstStatus ? { [firstStatus]: todayISO() } : {},
      comment: "",
    };
    state.orders.push(order);
    saveState();
    renderOrders();
  });

  // ---------------------------------------------------------------------
  // Справочники
  // ---------------------------------------------------------------------
  function renderRefList(listName, elId) {
    const ul = document.getElementById(elId);
    ul.innerHTML = "";
    state[listName].forEach((value, i) => {
      const li = document.createElement("li");
      const input = document.createElement("input");
      input.value = value;
      input.addEventListener("change", () => {
        state[listName][i] = input.value;
        saveState();
        renderOrders();
      });
      const rm = document.createElement("button");
      rm.className = "remove-btn";
      rm.textContent = "×";
      rm.title = "Удалить из списка";
      rm.addEventListener("click", () => {
        state[listName].splice(i, 1);
        saveState();
        renderRefs();
        renderOrders();
      });
      li.appendChild(input);
      li.appendChild(rm);
      ul.appendChild(li);
    });
  }

  function renderRefs() {
    renderRefList("customers", "customersList");
    renderRefList("suppliers", "suppliersList");
    renderRefList("statuses", "statusesList");
    document.getElementById("thresholdInput").value = state.threshold;
  }

  document.querySelectorAll(".ref-add button").forEach((btn) => {
    btn.addEventListener("click", () => {
      const listName = btn.dataset.list;
      const inputId = { customers: "newCustomer", suppliers: "newSupplier", statuses: "newStatus" }[listName];
      const input = document.getElementById(inputId);
      const value = input.value.trim();
      if (!value) return;
      state[listName].push(value);
      input.value = "";
      saveState();
      renderRefs();
      renderOrders();
    });
  });

  document.getElementById("thresholdInput").addEventListener("change", (e) => {
    const v = parseInt(e.target.value, 10);
    state.threshold = Number.isFinite(v) && v > 0 ? v : 1;
    saveState();
    renderOrders();
  });

  // ---------------------------------------------------------------------
  // Сводка
  // ---------------------------------------------------------------------
  function renderSummary() {
    const tbody = document.querySelector("#summaryTable tbody");
    tbody.innerHTML = "";
    const counts = state.statuses.map(
      (status) => state.orders.filter((o) => o.status === status).length
    );

    state.statuses.forEach((status, i) => {
      const tr = document.createElement("tr");
      const tdName = document.createElement("td");
      tdName.textContent = status;
      const tdCount = document.createElement("td");
      tdCount.textContent = counts[i];
      tdCount.style.textAlign = "center";
      tdCount.style.fontWeight = "bold";
      tr.appendChild(tdName);
      tr.appendChild(tdCount);
      tbody.appendChild(tr);
    });

    document.getElementById("totalCount").textContent = state.orders.length;
    const overdue = state.orders.filter((o) => {
      const d = o.status ? o.statusDates[o.status] : null;
      return d && daysBetween(d) > state.threshold;
    }).length;
    document.getElementById("overdueCount").textContent = overdue;

    const chart = document.getElementById("chart");
    chart.innerHTML = "";
    const max = Math.max(1, ...counts);
    state.statuses.forEach((status, i) => {
      const wrap = document.createElement("div");
      wrap.className = "chart-bar-wrap";
      const bar = document.createElement("div");
      bar.className = `chart-bar ${statusClass(status)}`;
      bar.style.height = `${(counts[i] / max) * 100}%`;
      bar.style.minHeight = counts[i] > 0 ? "4px" : "0";
      const val = document.createElement("div");
      val.className = "bar-value";
      val.textContent = counts[i];
      bar.appendChild(val);
      const label = document.createElement("div");
      label.className = "chart-label";
      label.textContent = status;
      wrap.appendChild(bar);
      wrap.appendChild(label);
      chart.appendChild(wrap);
    });
  }

  // ---------------------------------------------------------------------
  // Экспорт / импорт
  // ---------------------------------------------------------------------
  document.getElementById("exportBtn").addEventListener("click", () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `zayavki-backup-${todayISO()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  });

  document.getElementById("importInput").addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result);
        if (!parsed || !Array.isArray(parsed.orders)) throw new Error("Некорректный формат файла");
        state = Object.assign(structuredClone(DEFAULT_STATE), parsed);
        saveState();
        renderOrders();
        renderRefs();
      } catch (err) {
        alert("Не удалось импортировать файл: " + err.message);
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  });

  // ---------------------------------------------------------------------
  renderOrders();
  renderRefs();
})();
