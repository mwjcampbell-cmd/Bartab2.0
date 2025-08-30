// Print / Export PDF via browser
function printStatement(){
  const allContent = document.getElementById('customers').innerHTML;
  const win = window.open('','', 'width=800,height=600');
  win.document.write(`
    <html>
      <head>
        <title>Bar Tab Statement</title>
        <style>
          body{font-family:Arial,sans-serif;padding:1em;background:#fff;color:#000;}
          h1{text-align:center;}
          .customer{border:1px solid #444;margin:1em 0;padding:1em;border-radius:6px;}
        </style>
      </head>
      <body>
        <h1>📒 Bar Tabs</h1>
        ${allContent}
      </body>
    </html>
  `);
  win.document.close();
  win.print();
}
