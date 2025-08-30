let db;

// IndexedDB setup
function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('BarTabDB', 1);
    request.onerror = () => reject('DB error');
    request.onsuccess = () => { db = request.result; resolve(db); };
    request.onupgradeneeded = e => {
      db = e.target.result;
      if(!db.objectStoreNames.contains('customers')) {
        db.createObjectStore('customers', { keyPath: 'id' });
      }
    };
  });
}

// CRUD helpers
async function saveCustomer(cust) { const tx=db.transaction('customers','readwrite'); const store=tx.objectStore('customers'); await store.put(cust); return tx.complete; }
async function getAllCustomers() { return new Promise(resolve=>{ const tx=db.transaction('customers','readonly'); const store=tx.objectStore('customers'); const req=store.getAll(); req.onsuccess=()=>resolve(req.result); }); }
async function deleteCustomerDB(id){ const tx=db.transaction('customers','readwrite'); const store=tx.objectStore('customers'); await store.delete(id); return tx.complete; }
async function clearAllDB(){ const tx=db.transaction('customers','readwrite'); const store=tx.objectStore('customers'); await store.clear(); return tx.complete; }

// Utils
function now(){return new Date().toLocaleString();}
function server(){return document.getElementById("serverName").value.trim()||"Unknown";}

// CRUD Operations
async function addCustomer(){const name=document.getElementById("newName").value.trim();if(!name)return;const id="c"+Date.now().toString();const cust={id,name,purchases:[],payments:[],pending:[]};await saveCustomer(cust);document.getElementById("newName").value="";await render();}
async function updateCustomer(c){await saveCustomer(c);await render();}
async function deleteCustomer(cid){if(!confirm("Delete this customer?"))return;await deleteCustomerDB(cid);await render();}
async function clearBalance(cid){const c=(await getAllCustomers()).find(c=>c.id===cid);if(!c)return;c.purchases=[];c.payments=[];c.pending=[];await updateCustomer(c);}

// Orders & Payments
async function addPending(cid,price,title="Item"){const c=(await getAllCustomers()).find(c=>c.id===cid);if(!c)return;c.pending.push({title,price,qty:1,date:now(),server:server()});await updateCustomer(c);}
async function confirmPending(cid,index){const c=(await getAllCustomers()).find(c=>c.id===cid);if(!c)return;c.purchases.push(c.pending.splice(index,1)[0]);await updateCustomer(c);}
async function confirmAllPending(cid){const c=(await getAllCustomers()).find(c=>c.id===cid);if(!c)return;c.purchases.push(...c.pending);c.pending=[];await updateCustomer(c);}
async function cancelPending(cid,index){const c=(await getAllCustomers()).find(c=>c.id===cid);if(!c)return;c.pending.splice(index,1);await updateCustomer(c);}
async function addCustomPurchase(cid){const amt=parseFloat(prompt("Price?","10"));if(isNaN(amt))return;const qty=parseInt(prompt("Quantity?","1"));const c=(await getAllCustomers()).find(c=>c.id===cid);if(!c)return;c.pending.push({title:"Custom",price:amt,qty,date:now(),server:server()});await updateCustomer(c);}
async function addPayment(cid){const amt=parseFloat(prompt("Payment amount:","10"));if(isNaN(amt)||amt<=0)return;const c=(await getAllCustomers()).find(c=>c.id===cid);if(!c)return;c.payments.push({amount:amt,date:now(),server:server()});await updateCustomer(c);}

// Balances
function subtotal(p){return p.price*(p.qty||1);}
function totalPurchases(c){return c.purchases.reduce((s,p)=>s+subtotal(p),0);}
function totalPayments(c){return c.payments.reduce((s,p)=>s+p.amount,0);}
function balance(c){return totalPurchases(c)-totalPayments(c);}

// Statements
function toggleStatement(cid){const el=document.getElementById("statement-"+cid);if(el)el.style.display=(el.style.display==="none"?"block":"none");}
async function showAllStatements(){const div=document.getElementById("allStatements");div.style.display=div.style.display==="none"?"block":"none";if(div.style.display==="none")return;div.innerHTML="<h2>📑 All Accounts Statement</h2>";const customers=await getAllCustomers();customers.forEach(c=>{const bal=balance(c);const balText=bal<0?`In Credit: $${Math.abs(bal).toFixed(2)}`:`Owing: $${bal.toFixed(2)}`;let purchaseList=c.purchases.map(p=>`<li>${p.title} ×${p.qty} — $${subtotal(p).toFixed(2)} <small>(${p.date}, ${p.server})</small></li>`).join("")||"<li>None</li>";let paymentList=c.payments.map(p=>`<li>Payment — $${p.amount.toFixed(2)} <small>(${p.date}, ${p.server})</small></li>`).join("")||"<li>None</li>";div.innerHTML+=`<div style="margin:1em 0;padding:1em;border:1px solid #444;border-radius:6px;"><strong>${c.name}</strong><br>Purchases: $${totalPurchases(c).toFixed(2)}<br>Payments: $${totalPayments(c).toFixed(2)}<br><strong>${balText}</strong><h4>Purchases</h4><ul>${purchaseList}</ul><h4>Payments</h4><ul>${paymentList}</ul></div>`;});}

// Render UI
async function render(){const div=document.getElementById("customers");div.innerHTML="";const search=document.getElementById("searchBox").value.toLowerCase();const customers=await getAllCustomers
