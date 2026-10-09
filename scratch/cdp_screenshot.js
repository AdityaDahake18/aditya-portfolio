const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');

async function wait(ms) {
  return new Promise(r => setTimeout(r, ms));
}

function getJson(url) {
  return new Promise((resolve, reject) => {
    http.get(url, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(JSON.parse(data)));
    }).on('error', reject);
  });
}

class CDPClient {
  constructor(wsUrl) {
    this.ws = new WebSocket(wsUrl);
    this.id = 1;
    this.callbacks = new Map();
    this.ws.onmessage = e => {
      const msg = JSON.parse(e.data);
      if (msg.id && this.callbacks.has(msg.id)) {
        const cb = this.callbacks.get(msg.id);
        this.callbacks.delete(msg.id);
        if (msg.error) cb.reject(msg.error);
        else cb.resolve(msg.result);
      }
    };
  }

  ready() {
    return new Promise((resolve, reject) => {
      if (this.ws.readyState === WebSocket.OPEN) return resolve();
      this.ws.onopen = () => resolve();
      this.ws.onerror = reject;
    });
  }

  send(method, params = {}) {
    const id = this.id++;
    return new Promise((resolve, reject) => {
      this.callbacks.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  close() {
    this.ws.close();
  }
}

async function run() {
  const targetSection = process.argv[2] || '';
  const outFile = process.argv[3] || 'screenshots/cdp_test.png';
  const width = parseInt(process.argv[4] || '1440', 10);
  const height = parseInt(process.argv[5] || '900', 10);
  const port = 9222 + (Math.random() * 1000 | 0);

  const chrome = spawn('google-chrome', [
    '--headless=new',
    '--no-sandbox',
    '--disable-gpu',
    `--remote-debugging-port=${port}`,
    `--window-size=${width},${height}`,
    'about:blank'
  ]);

  let cdp = null;
  try {
    let targets = null;
    for (let i = 0; i < 30; i++) {
      await wait(100);
      try {
        targets = await getJson(`http://127.0.0.1:${port}/json`);
        if (targets && targets.length > 0) break;
      } catch (e) {}
    }

    if (!targets || !targets[0]) throw new Error('Chrome not responding');

    const pageTarget = targets.find(t => t.type === 'page') || targets[0];
    cdp = new CDPClient(pageTarget.webSocketDebuggerUrl);
    await cdp.ready();

    await cdp.send('Page.enable');
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width,
      height,
      deviceScaleFactor: 1,
      mobile: width < 600
    });

    const fileUrl = 'file:///home/adyy/portfolio/index.html';
    await cdp.send('Page.navigate', { url: fileUrl });
    await wait(800);

    // Remove boot screen and scroll or target section
    await cdp.send('Runtime.evaluate', {
      expression: `
        const bt = document.getElementById('boot');
        if (bt) bt.remove();
      `
    });

    if (targetSection) {
      await cdp.send('Runtime.evaluate', {
        expression: `
          const target = document.getElementById('${targetSection}');
          if (target) {
            target.scrollIntoView({ behavior: 'instant', block: 'start' });
            target.classList.add('in');
            if (typeof set === 'function') set('${targetSection}');
          }
        `
      });
      // Wait for transitions/renders
      await wait(1200);
    } else {
      await wait(800);
    }

    const res = await cdp.send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(outFile, Buffer.from(res.data, 'base64'));
    console.log(`Saved screenshot to ${outFile} (${fs.statSync(outFile).size} bytes)`);

  } finally {
    if (cdp) cdp.close();
    chrome.kill('SIGKILL');
  }
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
