// --- IndexedDB Setup ---
let db;
function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open("BarTabDB", 1);
    req.onerror = () => reject("Error opening DB");
    req.onupgradeneeded = e => {
      db = e.target.result;
      if (!db.objectStoreNames.contains("customers")) {
        db.createObjectStore("customers", { keyPath: "id", autoIncrement: true });
      }
    };
    req.onsuccess = e => {
      db = e.target.result;
      resolve();
    };
  });
}

function getStore(mode = "readonly") {
  return db.transaction("customers", mode).objectStore("customers");
}

// --- Customer Functions ---
async function addCustomer() {
  const name = document.getElementById("newName").value.trim();
  if (!name) return;
  const store = getStore("readwrite");
  store.add({ name, purchases: [], payments: [], pending: [] }).onsuccess = render;
  document.getElementById("newName").value = "";
}

async function addPending(cid, price, title) {
  const tx = db.transaction("customers", "readwrite");
  const store = tx.objectStore("customers");
  const req = store.get(cid);
  req.onsuccess = async () => {
    const c = req.result;
    c.pending.push({ title, price, qty: 1, date: new Date().toLocaleString() });
    store.put(c).onsuccess = render;
  };
}

async function addCustomPurchase(cid) {
  const price = parseFloat(prompt("Price?", "10"));
  if (isNaN(price)) return;
  const qty = parseInt(prompt("Quantity?", "1")) || 1;
  const tx = db.transaction("customers", "readwrite");
  const store = tx.objectStore("customers");
  const req = store.get(cid);
  req.onsuccess = () => {
    const c = req.result;
    c.pending.push({ title: "Custom", price, qty, date: new Date().toLocaleString() });
    store.put(c).onsuccess = render;
  };
}

async function addPayment(cid) {
  const amount = parseFloat(prompt("Payment amount:", "10"));
  if (isNaN(amount) || amount <= 0) return;
  const tx = db.transaction("customers", "readwrite");
  const store = tx.objectStore("customers");
  const req = store.get(cid);
  req.onsuccess = () => {
    const c = req.result;
    c.payments.push({ amount, date: new Date().toLocaleString() });
    store.put(c).onsuccess = render;
  };
}

async function confirmPending(cid, index = null) {
  const tx = db.transaction("customers", "readwrite");
  const store = tx.objectStore("customers");
  const req = store.get(cid);
  req.onsuccess = () => {
    const c = req.result;
    if (index !== null) {
      const order = c.pending.splice(index, 1)[0];
      c.purchases.push(order);
    } else {
      c.purchases.push(...c.pending);
      c.pending = [];
    }
    store.put(c).onsuccess = render;
  };
}

async function cancelPending(cid, index) {
  const tx = db.transaction("customers", "readwrite");
  const store = tx.objectStore("customers");
  const req = store.get(cid);
  req.onsuccess = () => {
    const c = req.result;
    c.pending.splice(index, 1);
    store.put(c).onsuccess = render;
  };
}

async function clearAllDB() {
  if (!confirm("Delete all customer data?")) return;
  const tx = db.transaction("customers", "readwrite");
  tx.objectStore("customers").clear().onsuccess = render;
}

// --- Helper Functions ---
function subtotal(p) { return p.price * (p.qty || 1); }
function totalPurchases(c) { return c.purchases.reduce((s, p) => s + subtotal(p), 0); }
function totalPayments(c) { return c.payments.reduce((s, p) => s + p.amount, 0); }
function balance(c) { return totalPurchases(c) - totalPayments(c); }

// --- Render Customers ---
async function render() {
  const customersDiv = document.getElementById("customers");
  const search = document.getElementById("searchBox").value.toLowerCase();
  const scrollY = window.scrollY;

  customersDiv.innerHTML = "";
  const tx = db.transaction("customers", "readonly");
  const store = tx.objectStore("customers");
  store.openCursor().onsuccess = e => {
    const cursor = e.target.result;
    if (cursor) {
      const c = cursor.value;
      if (c.name.toLowerCase().includes(search)) {
        const bal = balance(c);
        const balClass = bal < 0 ? "credit" : (bal > 0 ? "debt" : "");
        let pendingList = c.pending.map((p, i) =>
          `<li>${p.title} ×${p.qty} — $${subtotal(p).toFixed(2)}
            <small>(${p.date})</small>
            <button onclick="confirmPending(${c.id},${i})">✔️</button>
            <button onclick="cancelPending(${c.id},${i})">❌</button>
          </li>`).join("") || "<li>None</li>";

        let purchaseList = c.purchases.map(p =>
          `<li>${p.title} ×${p.qty} — $${subtotal(p).toFixed(2)} <small>(${p.date})</small></li>`
        ).join("") || "<li>None</li>";

        let paymentList = c.payments.map(p =>
          `<li>Payment — $${p.amount.toFixed(2)} <small>(${p.date})</small></li>`
        ).join("") || "<li>None</li>";

        const div = document.createElement("div");
        div.className = "customer";
        div.innerHTML = `
          <div><strong>${c.name}</strong></div>
          <div class="balance ${balClass}">Balance: $${bal.toFixed(2)}</div>
          <h4>Pending Orders</h4>
          <ul>${pendingList}</ul>
          ${c.pending.length ? `<button onclick="confirmPending(${c.id})">✔️ Confirm All Pending</button>` : ""}
          <div>
            <button onclick="addPending(${c.id},4,'Beer')">🍺 Beer $4</button>
            <button onclick="addPending(${c.id},5,'RTD')">🥤 RTD $5</button>
            <button onclick="addPending(${c.id},2,'Soft Drink')">🧃 Soft $2</button>
            <button onclick="addCustomPurchase(${c.id})">➕ Custom</button>
            <button onclick="addPayment(${c.id})">💵 Payment</button>
          </div>
          <div>
            <button onclick="confirmPending(${c.id})">✔️ Confirm All</button>
          </div>
          <div class="statement" id="st${c.id}" style="display:none;">
            <h3>Purchases</h3><ul>${purchaseList}</ul>
            <h3>Payments</h3><ul>${paymentList}</ul>
            <strong>Balance: $${bal.toFixed(2)}</strong>
          </div>
        `;
        customersDiv.appendChild(div);
      }
      cursor.continue();
    }
  };

  window.scrollTo(0, scrollY);
}

// --- Statement Toggle ---
function toggleStatement(id) {
  const st = document.getElementById("st" + id);
  st.style.display = st.style.display === "block" ? "none" : "block";
}

// --- Show All ---
function showAllStatements() {
  const statements = document.querySelectorAll(".statement");
  statements.forEach(s => s.style.display = "block");
}

// --- Print ---
function printStatement() {
  const content = document.getElementById("customers").innerHTML;
  const win = window.open("", "", "width=800,height=600");
  win.document.write(`<html><head><title>Print</title></head><body>${content}</body></html>`);
  win.document.close();
  win.print();
}

// --- Initialize ---
window.onload = async () => {
  await openDB();
  render();
};
