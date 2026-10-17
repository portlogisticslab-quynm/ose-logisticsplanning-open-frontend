/* OSE backend selector: home server first, Render as fallback.
 * Logistics Planning — phiên bản mở (không qua cổng đăng ký, không database).
 * Sửa 4 URL dưới đây nếu tên miền / service Render khác.
 */
(function () {
  if (window.oseFetch) return; // already loaded
  const BACKENDS = {
    home:   "https://api-logisticsplanning.ose.vn",                 // Worker ose-failover (lớp 1)
    render: "https://ose-logisticsplanning-open-backend.onrender.com",
    local:  "http://127.0.0.1:8014",
  };
  // Gọi thẳng tunnel cho /api/solve: bài MILP có thể > 5 giây, đi qua Worker sẽ bị gửi lại sang Render (chạy 2 lần).
  const HOME_DIRECT = "https://api-logisticsplanning-home.ose.vn";
  window.OSE_BACKENDS = BACKENDS;

  const CACHE_KEY = "ose_api_auto";
  const CACHE_MS = 5 * 60 * 1000;
  const FAIL = [502, 503, 504, 520, 521, 522, 523, 524, 530];
  let auto = false;
  const set = (base) => (window.OSE_API_BASE = base);

  function remember(name) {
    try { sessionStorage.setItem(CACHE_KEY, JSON.stringify({ name, t: Date.now() })); } catch (e) {}
  }
  function recalled() {
    try {
      const c = JSON.parse(sessionStorage.getItem(CACHE_KEY));
      if (c && BACKENDS[c.name] && Date.now() - c.t < CACHE_MS) return c.name;
    } catch (e) {}
    return null;
  }
  async function alive(base, ms) {
    const c = new AbortController(); const t = setTimeout(() => c.abort(), ms);
    try { return (await fetch(base + "/api/health", { signal: c.signal, cache: "no-store" })).ok; }
    catch (e) { return false; } finally { clearTimeout(t); }
  }

  function resolve() {
    if (["localhost", "127.0.0.1"].includes(location.hostname)) return Promise.resolve(set(BACKENDS.local));
    // ?api=home | render | local (ghim)   ?api=auto (bỏ ghim)
    let forced = new URLSearchParams(location.search).get("api");
    try {
      if (forced === "auto") { localStorage.removeItem("ose_api"); forced = null; }
      else if (forced && BACKENDS[forced]) localStorage.setItem("ose_api", forced);
      else if (forced) forced = null;
      else forced = localStorage.getItem("ose_api");
    } catch (e) {}
    if (forced && BACKENDS[forced]) return Promise.resolve(set(BACKENDS[forced]));

    auto = true;
    const cached = recalled();
    if (cached) return Promise.resolve(set(BACKENDS[cached]));
    set(BACKENDS.home);
    return (async () => {
      if (await alive(BACKENDS.home, 4000)) { remember("home"); return BACKENDS.home; }
      console.warn("[OSE] Máy chủ chính không phản hồi, chuyển sang Render");
      remember("render");
      return set(BACKENDS.render);
    })();
  }

  window.OSE_API_READY = resolve();

  // Dùng thay cho fetch(): oseFetch("/api/xxx", options). Home chết giữa phiên -> gửi lại sang Render.
  window.oseFetch = async function (path, options) {
    const base = await window.OSE_API_READY;
    const canFailover = auto && base === BACKENDS.home;
    try {
      const res = await fetch(base + path, options);
      if (!canFailover || !FAIL.includes(res.status)) return res;
    } catch (e) {
      if (!canFailover) throw e;
    }
    console.warn("[OSE] Máy chủ chính mất kết nối, chuyển sang Render");
    remember("render");
    window.OSE_API_READY = Promise.resolve(set(BACKENDS.render));
    return fetch(BACKENDS.render + path, options);
  };

  // Tác vụ dài (/api/solve): home gọi thẳng tunnel (không qua giới hạn 5 giây của Worker);
  // tunnel lỗi thì gửi sang Render. Ghim Render/Cục bộ thì gọi đúng máy chủ đã ghim.
  window.oseSolveFetch = async function (path, options) {
    const base = await window.OSE_API_READY;
    if (base !== BACKENDS.home) return fetch(base + path, options);
    try {
      const res = await fetch(HOME_DIRECT + path, options);
      if (!FAIL.includes(res.status)) return res;
    } catch (e) { /* tunnel không tới được */ }
    if (!auto) throw new Error("Home server không phản hồi. Chọn Render hoặc Tự động.");
    console.warn("[OSE] Home server lỗi khi giải bài toán, chuyển sang Render");
    remember("render");
    window.OSE_API_READY = Promise.resolve(set(BACKENDS.render));
    return fetch(BACKENDS.render + path, options);
  };
})();
