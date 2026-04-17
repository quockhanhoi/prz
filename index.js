const axios = require("axios");
const { HttpsProxyAgent } = require("https-proxy-agent");
const pLimit = require("p-limit");

// ================= CONFIG =================
const CONCURRENCY = 100;
const TIMEOUT = 4000;
const BATCH_SIZE = 50;

const API = "https://zit-note.onrender.com/api/note";

// ================= ALL SOURCES =================
const SOURCES = [

  // ProxyScrape
  "https://api.proxyscrape.com/v2/?request=getproxies&protocol=http",
  "https://api.proxyscrape.com/v2/?request=getproxies&protocol=https",
  "https://api.proxyscrape.com/v2/?request=getproxies&protocol=socks4",
  "https://api.proxyscrape.com/v2/?request=getproxies&protocol=socks5",

  // ProxyScan
  "https://www.proxyscan.io/download?type=http",
  "https://www.proxyscan.io/download?type=https",
  "https://www.proxyscan.io/download?type=socks4",
  "https://www.proxyscan.io/download?type=socks5",

  // Proxy-list.download
  "https://www.proxy-list.download/api/v1/get?type=http",
  "https://www.proxy-list.download/api/v1/get?type=https",
  "https://www.proxy-list.download/api/v1/get?type=socks4",
  "https://www.proxy-list.download/api/v1/get?type=socks5",

  // GitHub lớn
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
  "https://raw.githubusercontent.com/opsxcq/proxy-list/master/list.txt",

  // Extra hiếm
  "https://openproxy.space/list/http",
  "https://openproxy.space/list/socks4",
  "https://openproxy.space/list/socks5",

  "https://proxyspace.pro/http.txt",
  "https://proxyspace.pro/https.txt",
  "https://proxyspace.pro/socks4.txt",
  "https://proxyspace.pro/socks5.txt",

  "https://spys.me/proxy.txt",
  "https://spys.me/socks.txt",

  "https://rootjazz.com/proxies/proxies.txt"
];

// ================= TEST URL =================
const TEST_URLS = [
  "https://httpbin.org/ip",
  "https://api.ipify.org",
  "https://ifconfig.me/ip"
];

// ================= FETCH =================
async function fetchProxies() {
  const results = await Promise.all(
    SOURCES.map(url =>
      axios.get(url, { timeout: 10000 }).then(r => r.data).catch(() => "")
    )
  );

  const set = new Set();

  results.join("\n").split("\n").forEach(line => {
    line = line.trim();
    if (line.includes(":")) {
      if (!line.startsWith("http")) line = "http://" + line;
      set.add(line);
    }
  });

  return [...set];
}

// ================= CHECK =================
async function check(proxy) {
  try {
    const agent = new HttpsProxyAgent(proxy);
    const url = TEST_URLS[Math.floor(Math.random() * TEST_URLS.length)];

    const start = Date.now();

    const res = await axios.get(url, {
      httpAgent: agent,
      httpsAgent: agent,
      timeout: TIMEOUT
    });

    const latency = Date.now() - start;

    if (res.status === 200 && latency < 3000) {
      return {
        proxy,
        latency,
        score: 5000 - latency
      };
    }

    return null;
  } catch {
    return null;
  }
}

// ================= PUSH =================
async function pushBatch(list) {
  try {
    await axios.post(API, { proxies: list });
    console.log("Pushed:", list.length);
  } catch {
    console.log("Push fail");
  }
}

// ================= MAIN =================
async function main() {
  console.log("Fetching...");
  const raw = await fetchProxies();

  console.log("RAW:", raw.length);

  const limit = pLimit(CONCURRENCY);

  const results = await Promise.all(
    raw.map(p => limit(() => check(p)))
  );

  let live = results.filter(Boolean);

  // sort theo chất lượng
  live.sort((a, b) => b.score - a.score);

  console.log("LIVE:", live.length);

  // push batch
  for (let i = 0; i < live.length; i += BATCH_SIZE) {
    const chunk = live.slice(i, i + BATCH_SIZE);
    await pushBatch(chunk);
  }
}

// ================= LOOP =================
setInterval(main, 10 * 60 * 1000);
main();
