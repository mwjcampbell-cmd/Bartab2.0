// ======================= IndexedDB Setup =========================
let db;
function openDB(){
  return new Promise((resolve,reject)=>{
    const request = indexedDB.open("BarTabsDB",1);
    request.onupgradeneeded = e=>{
      db = e.target.result;
      if(!db.objectStoreNames.contains("customers")){
        const store = db.createObjectStore("customers",{keyPath:"id"});
      }
    };
    request.onsuccess = e=>{db = e.target.result; resolve();};
    request.onerror = e=>reject(e);
  });
}
function saveCustomer(customer){
  return new Promise((resolve,reject)=>{
    const tx = db.transaction("customers","readwrite");
    tx.objectStore("customers").put(customer);
    tx.oncomplete = ()=>resolve();
    tx.onerror = e=>reject(e);
  });
}
function getCustomer(id){
  return new Promise((resolve,reject)=>{
    const tx = db.transaction("customers","readonly");
    const req = tx.objectStore("customers").get(id);
    req.onsuccess = ()=>resolve(req.result);
    req.onerror = e=>reject(e);
  });
}
function getAllCustomers(){
  return new Promise((resolve,reject)=>{
    const tx = db.transaction("customers","readonly");
    const req = tx.objectStore("customers").getAll();
    req.onsuccess = ()=>resolve(req.result||[]);
    req.onerror = e=>reject(e);
  });
}
function deleteCustomerFromDB(id){
  return new Promise((resolve,reject)=>{
    const tx = db.transaction("customers","readwrite");
    tx.objectStore("customers").delete(id);
    tx.oncomplete = ()=>resolve();
    tx.onerror = e=>reject(e);
  });
}

// ======================= Helpers =========================
function formatDate(){return new Date().toLocaleString();}
function subtotal(item){return item.qty*item.price;}
function totalPurchases(c){return c.purchases.reduce((s,p)=>s+subtotal(p),0);}
function totalPayments(c){return c.payments.reduce((s,p)=>s+p.amount,0);}
function balance(c){return totalPurchases(c)-totalPayments(c);}
function getServer(){return document.getElementById('serverName').value||"Anon";}

// ======================= Core Functions =========================
async function addCustomer(){
  const name=document.getElementById('newName').value.trim();
  if(!name) return;
  const customer={id:Date.now().toString(),name,purchases:[],payments:[],pending:[]};
  await saveCustomer(customer);
  document.getElementById('newName').value='';
  render();
}
async function addPending(id,price,title){
  const c=await getCustomer(id);
  c.pending.push({title,price,qty:1,date:formatDate(),server:getServer()});
  await saveCustomer(c); render();
}
async function addCustomPurchase(id){
  const title=prompt("Item name?");
  if(!title) return;
  const price=parseFloat(prompt("Price?"));
  if(isNaN(price)) return;
  const qty=parseInt(prompt("Quantity?"))||1;
  const c=await getCustomer(id);
  c.pending.push({title,price,qty,date:formatDate(),server:getServer()});
  await saveCustomer(c); render();
}
async function confirmPending(id,i){
  const c=await getCustomer(id);
  const item=c.pending.splice(i,1)[0];
  c.purchases.push(item);
  await saveCustomer(c); render();
}
async function cancelPending(id,i){
  const c=await getCustomer(id);
  c.pending.splice(i,1);
  await saveCustomer(c); render();
}
async function confirmAllPending(id){
  const c=await getCustomer(id);
  c.purchases.push(...c.pending);
  c.pending=[];
  await saveCustomer(c); render();
}
async function addPayment(id){
  const amount=parseFloat(prompt("Payment amount?"));
  if(isNaN(amount)) return;
  const c=await getCustomer(id);
  c.payments.push({amount,date:formatDate(),server:getServer()});
  await saveCustomer(c); render();
}
async function clearBalance(id){
  const c=await getCustomer(id);
  const bal=balance(c);
  if(bal>0){
    c.payments.push({amount:bal,date:formatDate(),server:getServer()});
  } else if(bal<0){
    c.purchases.push({title:"Balance Reset",price:-bal,qty:1,date:formatDate(),server:getServer()});
  }
  await saveCustomer(c); render();
}
async function deleteCustomer(id){
  if(confirm("Delete this customer?")){
    await deleteCustomerFromDB(id);
    render();
  }
}
async function clearAllDB(){
  if(confirm("Clear ALL balances?")){
    const customers=await getAllCustomers();
    for(let c of customers){
      c.purchases=[]; c.payments=[]; c.pending=[];
      await saveCustomer(c);
    }
    render();
  }
}
function toggleStatement(id){
  const el=document.getElementById("statement-"+id);
  el.style.display=(el.style.display==="none"||!el.style.display)?"block":"none";
}
async function showAllStatements(){
  const customers=await getAllCustomers();
  let html="<h2>All Accounts Statement</h2>";
  customers.forEach(c=>{
    html+=`<h3>${c.name}</h3>`;
    html+="<ul>"+c.purchases.map(p=>`<li>${p.title} $${subtotal(p).toFixed(2)} (${p.date})</li>`).join('')+"</ul>";
    html+="<ul>"+c.payments.map(p=>`<li>Payment $${p.amount.toFixed(2)} (${p.date})</li>`).join('')+"</ul>";
    html+=`<strong>Balance: $${balance(c).toFixed(2)}</strong><hr>`;
  });
  const win=window.open("","","width=800,height=600");
  win.document.write(html);
  win.document.close();
}

// ======================= Render =========================
async function render(){
  const div=document.getElementById('customers');

  // ✅ Save scroll before clearing
  const scrollPos = window.scrollY;

  div.innerHTML='';
  const search=document.getElementById('searchBox').value.toLowerCase();
  const customers=(await getAllCustomers()).filter(c=>c.name.toLowerCase().includes(search));

  customers.forEach(c=>{
    const el=document.createElement('div'); el.className='customer';
    const bal=balance(c);
    const balClass=bal<0?'credit':(bal>0?'debt':'');
    const balText=bal<0?`In Credit: $${Math.abs(bal).toFixed(2)}`:`Owing: $${bal.toFixed(2)}`;

    let pendingList=c.pending.map((p,i)=>`
      <li>${p.title} ×${p.qty} — $${subtotal(p).toFixed(2)} (${p.date}, ${p.server})
      <button onclick="confirmPending('${c.id}',${i})">✔️</button>
      <button onclick="cancelPending('${c.id}',${i})">❌</button>
      </li>`).join('')||"<li>None</li>";

    let purchaseList=c.purchases.map(p=>`<li>${p.title} ×${p.qty} — $${subtotal(p).toFixed(2)} (${p.date}, ${p.server})</li>`).join('')||"<li>None</li>";
    let paymentList=c.payments.map(p=>`<li>Payment — $${p.amount.toFixed(2)} (${p.date}, ${p.server})</li>`).join('')||"<li>None</li>";

    el.innerHTML=`
      <div><strong>${c.name}</strong></div>
      <div>Purchases: $${totalPurchases(c).toFixed(2)}</div>
      <div>Payments: $${totalPayments(c).toFixed(2)}</div>
      <div class="balance ${balClass}">${balText}</div>
      <h4>Pending Orders</h4>
      <ul>${pendingList}</ul>
      ${c.pending.length>0?`<button onclick="confirmAllPending('${c.id}')">✔️ Confirm All Pending</button>`:''}
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

  // ✅ Restore scroll position
  window.scrollTo(0, scrollPos);
}

// ======================= Print =========================
function printStatement(){
  const allContent=document.getElementById('customers').innerHTML;
  const win=window.open('','', 'width=800,height=600');
  win.document.write(`
    <html><head><title>Bar Tab Statement</title>
    <style>
      body{font-family:Arial,sans-serif;padding:1em;background:#fff;color:#000;}
      h1{text-align:center;}
      .customer{border:1px solid #444;margin:1em 0;padding:1em;border-radius:6px;}
    </style></head><body>
      <h1>📒 Bar Tabs</h1>${allContent}
    </body></html>`);
  win.document.close();
  win.print();
}

// ======================= Init =========================
window.onload=async()=>{
  await openDB();
  render();
};
