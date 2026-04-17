const express = require("express");
const axios = require("axios");
const { HttpsProxyAgent } = require("https-proxy-agent");
const pLimit = require("p-limit").default;

const app = express();
app.use(express.json());

// ================= CONFIG =================
const CONCURRENCY = 100;
const TIMEOUT = 4000;
const LOOP_TIME = 10 * 60 * 1000;

const NOTE_API = "https://zit-note.onrender.com/api/note";

// 👉 NOTE MASTER (tạo sẵn 1 cái rồi lấy ID)
const MASTER_NOTE_ID = "8bac9c8e-4550-4381-ab8d-5baf2fb9e5c2";
const MASTER_API = `https://zit-note.onrender.com/note/${MASTER_NOTE_ID}`;

let currentProxies = [];

// ================= FULL SOURCES =================
const SOURCES = [

  "https://api.proxyscrape.com/v2/?request=getproxies&protocol=http",
  "https://api.proxyscrape.com/v2/?request=getproxies&protocol=https",
  "https://api.proxyscrape.com/v2/?request=getproxies&protocol=socks4",
  "https://api.proxyscrape.com/v2/?request=getproxies&protocol=socks5",

  "https://www.proxyscan.io/download?type=http",
  "https://www.proxyscan.io/download?type=https",
  "https://www.proxyscan.io/download?type=socks4",
  "https://www.proxyscan.io/download?type=socks5",

  "https://www.proxy-list.download/api/v1/get?type=http",
  "https://www.proxy-list.download/api/v1/get?type=https",
  "https://www.proxy-list.download/api/v1/get?type=socks4",
  "https://www.proxy-list.download/api/v1/get?type=socks5",

  "https://openproxy.space/list/http",
  "https://openproxy.space/list/socks4",
  "https://openproxy.space/list/socks5",

  "https://proxyspace.pro/http.txt",
  "https://proxyspace.pro/https.txt",
  "https://proxyspace.pro/socks4.txt",
  "https://proxyspace.pro/socks5.txt",

  "https://spys.me/proxy.txt",
  "https://spys.me/socks.txt",

  "https://rootjazz.com/proxies/proxies.txt",

  "https://raw.githubusercontent.com/TheSpeedX/PROXY-List/master/http.txt",
  "https://raw.githubusercontent.com/TheSpeedX/PROXY-List/master/socks4.txt",
  "https://raw.githubusercontent.com/TheSpeedX/PROXY-List/master/socks5.txt",

  "https://raw.githubusercontent.com/ShiftyTR/Proxy-List/master/http.txt",
  "https://raw.githubusercontent.com/ShiftyTR/Proxy-List/master/socks4.txt",
  "https://raw.githubusercontent.com/ShiftyTR/Proxy-List/master/socks5.txt",

  "https://raw.githubusercontent.com/monosans/proxy-list/main/proxies/http.txt",
  "https://raw.githubusercontent.com/monosans/proxy-list/main/proxies/socks4.txt",
  "https://raw.githubusercontent.com/monosans/proxy-list/main/proxies/socks5.txt",

  "https://raw.githubusercontent.com/clarketm/proxy-list/master/proxy-list-raw.txt",
  "https://raw.githubusercontent.com/sunny9577/proxy-scraper/master/proxies.txt",
  "https://raw.githubusercontent.com/hookzof/socks5_list/master/proxy.txt",
  "https://raw.githubusercontent.com/mmpx12/proxy-list/master/http.txt",
  "https://raw.githubusercontent.com/roosterkid/openproxylist/main/HTTPS_RAW.txt",
  "https://raw.githubusercontent.com/opsxcq/proxy-list/master/list.txt"
];

// ================= FETCH =================
async function fetchProxies() {
  const results = await Promise.all(
    SOURCES.map(url =>
      axios.get(url, {
        timeout: 10000,
        headers: { "User-Agent": "Mozilla/5.0" }
      }).then(r => r.data).catch(() => "")
    )
  );

  const set = new Set();

  results.join("\n").split("\n").forEach(line => {
    line = line.trim();
    if (!line) return;

    if (/^\d+\.\d+\.\d+\.\d+:\d+$/.test(line)) {
      set.add("http://" + line);
    } else if (line.startsWith("http")) {
      set.add(line);
    }
  });

  return [...set];
}

// ================= CHECK =================
async function check(proxy) {
  try {
    const agent = new HttpsProxyAgent(proxy);

    const res = await axios.get("https://httpbin.org/ip", {
      httpAgent: agent,
      httpsAgent: agent,
      timeout: TIMEOUT
    });

    if (res.status === 200) return proxy;
    return null;

  } catch {
    return null;
  }
}

// ================= CREATE NOTE =================
async function createNote(content) {
  const res = await axios.post(NOTE_API, {
    content: JSON.stringify(content)
  });
  return res.data;
}

// ================= UPDATE MASTER =================
async function updateMaster(link, total, live) {
  const data = {
    content: JSON.stringify({
      proxies: [
        {
          proxy: link,
          so_luong: total,
          live: live
        }
      ]
    })
  };

  await axios.post(MASTER_API, data);
}

// ================= MAIN =================
async function run() {
  console.log("===== RUN =====");

  const raw = await fetchProxies();
  console.log("RAW:", raw.length);

  const limit = pLimit(CONCURRENCY);

  const results = await Promise.all(
    raw.map(p => limit(() => check(p)))
  );

  let live = results.filter(Boolean);
  console.log("LIVE:", live.length);

  // giữ proxy nhanh
  live = live.slice(0, 1000);
  currentProxies = live;

  // tạo note proxy
  const proxyNote = await createNote({
    proxies: live
  });

  const link = proxyNote.url || proxyNote.id;

  // update master
  await updateMaster(link, raw.length, live.length);

  console.log("UPDATED MASTER");
}

// ================= LOOP =================
setInterval(run, LOOP_TIME);
run();

// ================= API =================
app.get("/", (req, res) => {
  res.send("PROXY SYSTEM RUNNING");
});

app.get("/get-proxy", (req, res) => {
  if (currentProxies.length === 0) {
    return res.status(404).json({ error: "no proxy" });
  }

  const proxy = currentProxies[Math.floor(Math.random() * currentProxies.length)];

  res.json({ proxy });
});

// ================= START =================
const PORT = process.env.PORT || 10000;

app.listen(PORT, () => {
  console.log("Server running on port", PORT);
});
