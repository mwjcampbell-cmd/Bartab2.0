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
  const tx = db.transaction("customers", "readwrite");
  const store = tx.objectStore("customers");
  await store.add({ name, beers: [], payments: [], pending: [] });
  await tx.complete;
  document.getElementById("newName").value = "";
  render();
}

async function addBeer(id) {
  const tx = db.transaction("customers", "readwrite");
  const store = tx.objectStore("customers");
  const customer = await store.get(id);
  customer.pending.push({ type: "beer", amount: 10, time: new Date().toISOString() });
  await store.put(customer);
  render();
}

async function addPayment(id) {
  const amount = parseFloat(prompt("Enter payment amount:", "10"));
  if (isNaN(amount) || amount <= 0) return;
  const tx = db.transaction("customers", "readwrite");
  const store = tx.objectStore("customers");
  const customer = await store.get(id);
  customer.pending.push({ type: "payment", amount, time: new Date().toISOString() });
  await store.put(customer);
  render();
}

async function confirmPending(id) {
  const tx = db.transaction("customers", "readwrite");
  const store = tx.objectStore("customers");
  const customer = await store.get(id);
  customer.pending.forEach(p => {
    if (p.type === "beer") customer.beers.push(p);
    else customer.payments.push(p);
  });
  customer.pending = [];
  await store.put(customer);
  render();
}

async function clearAllDB() {
  if (!confirm("Delete all customer data?")) return;
  const tx = db.transaction("customers", "readwrite");
  tx.objectStore("customers").clear();
  await tx.complete;
  render();
}

// --- Render Customers ---
async function render() {
  const customersDiv = document.getElementById("customers");
  customersDiv.innerHTML = "";
  const search = document.getElementById("searchBox").value.toLowerCase();

  const tx = db.transaction("customers", "readonly");
  const store = tx.objectStore("customers");
  store.openCursor().onsuccess = e => {
    const cursor = e.target.result;
    if (cursor) {
      const c = cursor.value;
      if (c.name.toLowerCase().includes(search)) {
        const balance = c.payments.reduce((s, p) => s + p.amount, 0) - c.beers.length * 10;
        const div = document.createElement("div");
        div.className = "customer";
        div.innerHTML = `
          <strong>${c.name}</strong>
          <div class="balance ${balance >= 0 ? "credit" : "debt"}">
            Balance: $${balance}
          </div>
          <button onclick="addBeer(${c.id})">🍺 Add Beer</button>
          <button onclick="addPayment(${c.id})">💵 Add Payment</button>
          <button onclick="confirmPending(${c.id})">✅ Confirm</button>
          <button onclick="toggleStatement(${c.id})">📑 Statement</button>
          <div class="statement" id="st${c.id}">
            <h3>Beers:</h3>
            <ul>${c.beers.map(b => `<li>$10 - ${new Date(b.time).toLocaleString()}</li>`).join("")}</ul>
            <h3>Payments:</h3>
            <ul>${c.payments.map(p => `<li>$${p.amount} - ${new Date(p.time).toLocaleString()}</li>`).join("")}</ul>
            <h3>Pending:</h3>
            <ul>${c.pending.map(p => `<li>${p.type} $${p.amount} - ${new Date(p.time).toLocaleString()}</li>`).join("")}</ul>
          </div>
        `;
        customersDiv.appendChild(div);
      }
      cursor.continue();
    }
  };
}

function toggleStatement(id) {
  const st = document.getElementById("st" + id);
  st.style.display = st.style.display === "block" ? "none" : "block";
}

function showAllStatements() {
  const statements = document.querySelectorAll(".statement");
  const allVisible = Array.from(statements).every(s => s.style.display === "block");
  statements.forEach(s => s.style.display = allVisible ? "none" : "block");
  document.querySelector('button[onclick="showAllStatements()"]').innerText =
    allVisible ? "📄 Show All" : "📄 Hide All";
}

// --- Print ---
function printStatement() {
  const content = document.getElementById("customers").innerHTML;
  const win = window.open("", "", "width=800,height=600");
  win.document.write(`<html><head><title>Print</title></head><body>${content}</body></html>`);
  win.document.close();
  win.print();
}

// --- Dark Mode ---
function toggleDarkMode() {
  document.body.classList.toggle("dark-mode");
  localStorage.setItem("darkMode", document.body.classList.contains("dark-mode"));
}

// --- Init ---
window.onload = async () => {
  await openDB();
  if (localStorage.getItem("darkMode") === "true") {
    document.body.classList.add("dark-mode");
  }
  render();
};
