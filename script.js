let db;

// IndexedDB setup
async function openDB() {
  return new Promise((resolve, reject)=>{
    const request = indexedDB.open("BarTabDB",1);
    request.onerror = ()=>reject("DB open error");
    request.onsuccess = ()=>{ db = request.result; resolve(db); };
    request.onupgradeneeded = e=>{
      db = e.target.result;
      if(!db.objectStoreNames.contains("customers")) db.createObjectStore("customers",{ keyPath:"id" });
    };
  });
}

function getStore(name,mode="readonly"){ return db.transaction(name,mode).objectStore(name); }

async function saveCustomer(cust){
  return new Promise(resolve=>{
    const tx = getStore("customers","readwrite");
    tx.put(cust);
    tx.transaction.oncomplete = ()=>resolve();
  });
}

async function getAllCustomers(){
  return new Promise(resolve=>{
    const tx = getStore("customers");
    const req = tx.getAll();
    req.onsuccess = ()=>resolve(req.result);
  });
}

async function deleteCustomerDB(id){
  return new Promise(resolve=>{
    const tx = getStore("customers","readwrite");
    tx.delete(id);
    tx.transaction.oncomplete = ()=>resolve();
  });
}

async function clearAllDB(){
  const customers = await getAllCustomers();
  for(let c of customers){ c.purchases=[]; c.payments=[]; c.pending=[]; await saveCustomer(c); }
  render();
}

function now(){ return new Date().toLocaleString(); }
function server(){ return document.getElementById("serverName").value.trim()||"Unknown"; }
function subtotal(p){ return p.price*(p.qty||1); }
function totalPurchases(c){ return c.purchases.reduce((s,p)=>s+subtotal(p),0); }
function totalPayments(c){ return c.payments.reduce((s,p)=>s+p.amount,0); }
function balance(c){ return totalPurchases(c)-totalPayments(c); }

async function addCustomer(){
  const name = document.getElementById("newName").value.trim();
  if(!name) return alert("Enter a name!");
  const id="c"+Date.now();
  await saveCustomer({id,name,purchases:[],payments:[],pending:[]});
  document.getElementById("newName").value="";
  render();
}

async function deleteCustomer(id){
  if(!confirm("Delete this customer and all records?")) return;
  await deleteCustomerDB(id);
  render();
}

async function clearBalance(id){
  const customers = await getAllCustomers();
  const c = customers.find(c=>c.id===id);
  if(!c) return;
  c.purchases=[]; c.payments=[]; c.pending=[];
  await saveCustomer(c);
  render();
}

async function addPending(id,price,title="Item"){
  const customers = await getAllCustomers();
  const c = customers.find(c=>c.id===id);
  if(!c) return;
  c.pending.push({title,price,qty:1,date:now(),server:server()});
  await saveCustomer(c);
  render();
}

async function confirmPending(id,index){
  const customers = await getAllCustomers();
  const c = customers.find(c=>c.id===id);
  if(!c) return;
  c.purchases.push(c.pending.splice(index,1)[0]);
  await saveCustomer(c);
  render();
}

async function confirmAllPending(id){
  const customers = await getAllCustomers();
  const c = customers.find(c=>c.id===id);
  if(!c) return;
  c.purchases.push(...c.pending);
  c.pending=[];
  await saveCustomer(c);
  render();
}

async function cancelPending(id,index){
  const customers = await getAllCustomers();
  const c = customers.find(c=>c.id===id);
  if(!c) return;
  c.pending.splice(index,1);
  await saveCustomer(c);
  render();
}

async function addCustomPurchase(id){
  const amt = parseFloat(prompt("Price?","10"));
  if(isNaN(amt)) return;
  const qty = parseInt(prompt("Quantity?","1"));
  const customers = await getAllCustomers();
  const c = customers.find(c=>c.id===id);
  if(!c) return;
  c.pending.push({title:"Custom",price:amt,qty,date:now(),server:server()});
  await saveCustomer(c);
  render();
}

async function addPayment(id){
  const amt=parseFloat(prompt("Payment amount:","10"));
  if(isNaN(amt)||amt<=0) return;
  const customers = await getAllCustomers();
  const c = customers.find(c=>c.id===id);
  if(!c) return;
  c.payments.push({amount:amt,date:now(),server:server()});
  await saveCustomer(c);
  render();
}

function toggleStatement(id){
  const el=document.getElementById("statement-"+id);
  if(el) el.style.display=el.style.display==="none"?"block":"none";
}

async function showAllStatements(){
  const div=document.getElementById("allStatements");
  div.style.display=div.style.display==="none"?"block":"none";
  if(div.style.display==="none") return;
  div.innerHTML="<h2>📑 All Accounts Statement</h2>";
  const customers=await getAllCustomers();
  customers.forEach(c=>{
    const bal=balance(c);
    const balText=bal<0?`In Credit: $${Math.abs(bal).toFixed(2)}`:`Owing: $${bal.toFixed(2)}`;
    let purchases=c.purchases.map(p=>`<li>${p.title} ×${p.qty} — $${subtotal(p).toFixed(2)} (${p.date}, ${p.server})</li>`).join('')||"<li>None</li>";
    let payments=c.payments.map(p=>`<li>Payment — $${p.amount.toFixed(2)} (${p.date}, ${p.server})</li>`).join('')||"<li>None</li>";
    div.innerHTML+=`<div style="margin:1em 0;padding:1em;border:1px solid #444;border-radius:6px;">
      <strong>${c.name}</strong><br>Purchases: $${totalPurchases(c).toFixed(2)}<br>Payments: $${totalPayments(c).toFixed(2)}<br>
      <strong>${balText}</strong>
      <h4>Purchases</h4><ul>${purchases}</ul>
      <h4>Payments</h4><ul>${payments}</ul>
    </div>`;
  });
}

async function render(){
  const div=document.getElementById("customers");
  div.innerHTML="";
  const search=document.getElementById("searchBox").value.toLowerCase();
  const customers=(await getAllCustomers()).filter(c=>c.name.toLowerCase().includes(search));
  customers.forEach(c=>{
    const el=document.createElement("div");
    el.className="customer";
    const bal=balance(c);
    const balClass=bal<0?"credit":(bal>0?"debt":"");
    const balText=bal<0?`In Credit: $${Math.abs(bal).toFixed(2)}`:`Owing: $${bal.toFixed(2)}`;

    let pendingList=c.pending.map((p,i)=>`
      <li>${p.title} ×${p.qty} — $${subtotal(p).toFixed(2)} (${p.date}, ${p.server})
      <button onclick="confirmPending('${c.id}',${i})">✔️</button>
      <button onclick="cancelPending('${c.id}',${i})">❌</button>
      </li>`).join("")||"<li>None</li>";

    let purchaseList=c.purchases.map(p=>`<li>${p.title} ×${p.qty} — $${subtotal(p).toFixed(2)} (${p.date}, ${p.server})</li>`).join("")||"<li>None</li>";
    let paymentList=c.payments.map(p=>`<li>Payment — $${p.amount.toFixed(2)} (${p.date}, ${p.server})</li>`).join("")||"<li>None</li>";

    el.innerHTML=`
      <div><strong>${c.name}</strong></div>
      <div>Purchases: $${totalPurchases(c).toFixed(2)}</div>
      <div>Payments: $${totalPayments(c).toFixed(2)}</div>
      <div class="balance ${balClass}">${balText}</div>

      <h4>Pending Orders</h4>
      <ul>${pendingList}</ul>
      ${c.pending.length>0?`<button onclick="confirmAllPending('${c.id}')">✔️ Confirm All Pending</button>`:""}

      <div>
        <button onclick="addPending('${c.id}',4,'Beer')">🍺 Beer $4</button>
        <button onclick="addPending('${c.id}',5,'RTD')">🥤 RTD $5</button>
        <button onclick="addPending('${c.id}',2,'Soft Drink')">🧃 Soft $2</button>
        <button onclick="addCustomPurchase('${c.id}')">➕ Custom</button>
        <button onclick="addPayment('${c.id}')">💵 Payment</button>
      </div>
      <div>
        <button onclick="clearBalance('${c.id}')">🧹 Clear Balance</button>
        <button onclick="deleteCustomer('${c.id}')">🗑️ Delete Customer</button>
        <button onclick="toggleStatement('${c.id}')">📄 Statement</button>
      </div>
      <div class="statement" id="statement-${c.id}">
        <h3>Purchases</h3><ul>${purchaseList}</ul>
        <h3>Payments</h3><ul>${paymentList}</ul>
        <strong>${balText}</strong>
      </div>
    `;
    div.appendChild(el);
  });
}

function printStatement(){
  const allContent=document.getElementById("customers").innerHTML;
  const win=window.open('','','width=800,height=600');
  win.document.write(`<html><head><title>Bar Tab Statement</title>
    <style>body{font-family:Arial;padding:1em;background:#fff;color:#000;}
    h1{text-align:center;} .customer{border:1px solid #444;margin:1em 0;padding:1em;border-radius:6px;}</style>
    </head><body><h1>📒 Bar Tabs</h1>${allContent}</body></html>`);
  win.document.close();
  win.print();
}

// Initialize
window.onload=async ()=>{
  await openDB();
  render();
  document.getElementById("addCustomerBtn").addEventListener("click", addCustomer);
  document.getElementById("clearAllBtn").addEventListener("click", clearAllDB);
  document.getElementById("showAllBtn").addEventListener("click", showAllStatements);
  document.getElementById("printBtn").addEventListener("click", printStatement);
  document.getElementById("searchBox").addEventListener("input", render);
};
