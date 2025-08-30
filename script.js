let db;
let showAllFlag = false; // global toggle

function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("bartabDB", 1);
    request.onupgradeneeded = e => {
      db = e.target.result;
      const store = db.createObjectStore("customers", { keyPath: "id", autoIncrement: true });
      store.createIndex("name", "name", { unique: false });
    };
    request.onsuccess = e => { db = e.target.result; resolve(); };
    request.onerror = e => reject(e);
  });
}

function saveCustomer(cust) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction("customers", "readwrite");
    tx.objectStore("customers").put(cust);
    tx.oncomplete = () => resolve();
    tx.onerror = e => reject(e);
  });
}

function getAllCustomers() {
  return new Promise((resolve, reject) => {
    const tx = db.transaction("customers", "readonly");
    const req = tx.objectStore("customers").getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = e => reject(e);
  });
}

async function addCustomer() {
  const name = document.getElementById("newName").value.trim();
  if (!name) return;
  const tx = db.transaction("customers", "readwrite");
  tx.objectStore("customers").add({ name, beers: 0, payments: 0, history: [] });
  tx.oncomplete = () => { document.getElementById("newName").value = ""; render(); };
}

async function addBeer(id) {
  const tx = db.transaction("customers", "readwrite");
  const store = tx.objectStore("customers");
  const req = store.get(id);
  req.onsuccess = async () => {
    let cust = req.result;
    cust.beers++;
    cust.history.push({ type: "beer", date: new Date().toLocaleString() });
    await saveCustomer(cust);
    render();
  };
}

async function addPayment(id) {
  const amount = parseFloat(prompt("Enter payment amount:"));
  if (isNaN(amount) || amount <= 0) return;
  const tx = db.transaction("customers", "readwrite");
  const store = tx.objectStore("customers");
  const req = store.get(id);
  req.onsuccess = async () => {
    let cust = req.result;
    cust.payments += amount;
    cust.history.push({ type: "payment", amount, date: new Date().toLocaleString() });
    await saveCustomer(cust);
    render();
  };
}

async function confirmPending(id) {
  const tx = db.transaction("customers", "readwrite");
  const store = tx.objectStore("customers");
  const req = store.get(id);
  req.onsuccess = async () => {
    let cust = req.result;
    cust.history.push({ type: "confirm", date: new Date().toLocaleString() });
    await saveCustomer(cust);
    render();
  };
}

async function clearAllDB() {
  if (!confirm("Clear ALL customers?")) return;
  const tx = db.transaction("customers", "readwrite");
  tx.objectStore("customers").clear();
  tx.oncomplete = () => render();
}

async function render() {
  const search = document.getElementById("searchBox").value.toLowerCase();
  const customers = await getAllCustomers();
  const div = document.getElementById("customers");
  const scrollY = window.scrollY; // save position

  div.innerHTML = "";
  customers
    .filter(c => c.name.toLowerCase().includes(search))
    .forEach(cust => {
      let bal = cust.payments - cust.beers * 10;
      const cdiv = document.createElement("div");
      cdiv.className = "customer";
      cdiv.innerHTML = `
        <strong>${cust.name}</strong>
        <div class="balance ${bal >= 0 ? "credit" : "debt"}">
          Balance: $${bal}
        </div>
        <button onclick="addBeer(${cust.id})">🍺 Beer</button>
        <button onclick="addPayment(${cust.id})">💵 Payment</button>
        <button onclick="confirmPending(${cust.id})">✅ Confirm</button>
        <button onclick="toggleStatement(${cust.id})">📄 Statement</button>
        <div class="statement" id="st${cust.id}" style="display:${showAllFlag ? "block" : "none"}">
          <h3>Statement</h3>
          <ul>${cust.history.map(h => `<li>${h.date}: ${h.type}${h.amount ? " $" + h.amount : ""}</li>`).join("")}</ul>
        </div>
      `;
      div.appendChild(cdiv);
    });

  window.scrollTo(0, scrollY); // restore scroll
}

function toggleStatement(id) {
  const st = document.getElementById("st" + id);
  st.style.display = st.style.display === "block" ? "none" : "block";
}

function showAllStatements() {
  showAllFlag = !showAllFlag; // toggle global
  render();
}

function printStatement() {
  const content = document.getElementById("customers").innerHTML;
  const win = window.open("", "", "width=800,height=600");
  win.document.write(`<html><head><title>Print</title></head><body>${content}</body></html>`);
  win.document.close();
  win.print();
}

// Initialize
window.onload = async () => {
  await openDB();
  render();
};
