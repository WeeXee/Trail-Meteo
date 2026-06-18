/* ============================================================
   TRAIL MÉTÉO — logique
   API : Open-Meteo (géocodage + prévisions), gratuite, sans clé.
   ============================================================ */

"use strict";

const GEO_URL = "https://geocoding-api.open-meteo.com/v1/search";
const FORECAST_URL = "https://api.open-meteo.com/v1/forecast";
const FAVS_KEY = "trailmeteo:favs";
const LAST_KEY = "trailmeteo:last";

/* ---------- Référentiel des codes météo WMO ---------- */
const WMO = {
  0:  ["Ciel clair", "☀️"],
  1:  ["Plutôt dégagé", "🌤️"],
  2:  ["Partiellement nuageux", "⛅"],
  3:  ["Couvert", "☁️"],
  45: ["Brouillard", "🌫️"], 48: ["Brouillard givrant", "🌫️"],
  51: ["Bruine légère", "🌦️"], 53: ["Bruine", "🌦️"], 55: ["Bruine dense", "🌧️"],
  56: ["Bruine verglaçante", "🧊"], 57: ["Bruine verglaçante", "🧊"],
  61: ["Pluie faible", "🌧️"], 63: ["Pluie", "🌧️"], 65: ["Forte pluie", "🌧️"],
  66: ["Pluie verglaçante", "🧊"], 67: ["Pluie verglaçante", "🧊"],
  71: ["Neige faible", "🌨️"], 73: ["Neige", "🌨️"], 75: ["Forte neige", "❄️"],
  77: ["Grésil", "🌨️"],
  80: ["Averses faibles", "🌦️"], 81: ["Averses", "🌦️"], 82: ["Averses violentes", "⛈️"],
  85: ["Averses de neige", "🌨️"], 86: ["Averses de neige", "❄️"],
  95: ["Orage", "⛈️"], 96: ["Orage + grêle", "⛈️"], 99: ["Orage + grêle", "⛈️"],
};
const wmoLabel = (c) => (WMO[c] ? WMO[c][0] : "—");
const wmoIcon  = (c) => (WMO[c] ? WMO[c][1] : "🛰️");

/* ---------- Direction du vent ---------- */
function windArrow(deg) {
  const dirs = ["N", "NE", "E", "SE", "S", "SO", "O", "NO"];
  return dirs[Math.round(deg / 45) % 8];
}

/* ============================================================
   Indice de roulabilité (0–100)
   Pondère les facteurs qui comptent en trail/enduro.
   ============================================================ */
function computeScore({ apparent, precip, precipProb = 0, wind, gusts, visibility, code }) {
  let score = 100;
  const flags = [];

  // --- Pluie / averses ---
  if (precip >= 6 || precipProb >= 80) { score -= 38; flags.push(["danger", "🌧️", "Pluie forte — terrain détrempé, prudence maximale"]); }
  else if (precip >= 2 || precipProb >= 55) { score -= 22; flags.push(["warn", "🌧️", "Pluie attendue — boue probable en enduro"]); }
  else if (precip >= 0.3 || precipProb >= 30) { score -= 9; flags.push(["warn", "💧", "Risque d'averses — adhérence réduite"]); }

  // --- Vent moyen ---
  if (wind >= 55) { score -= 24; flags.push(["danger", "💨", `Vent fort (${Math.round(wind)} km/h)`]); }
  else if (wind >= 35) { score -= 12; flags.push(["warn", "💨", `Vent soutenu (${Math.round(wind)} km/h)`]); }

  // --- Rafales (le vrai danger sur la moto) ---
  if (gusts >= 75) { score -= 26; flags.push(["danger", "🌬️", `Rafales dangereuses (${Math.round(gusts)} km/h)`]); }
  else if (gusts >= 55) { score -= 14; flags.push(["warn", "🌬️", `Rafales marquées (${Math.round(gusts)} km/h)`]); }

  // --- Ressenti ---
  if (apparent <= 0) { score -= 22; flags.push(["danger", "🥶", `Froid mordant (${Math.round(apparent)} °C ressentis)`]); }
  else if (apparent <= 6) { score -= 11; flags.push(["warn", "🧊", `Frais (${Math.round(apparent)} °C ressentis)`]); }
  else if (apparent >= 36) { score -= 14; flags.push(["warn", "🥵", `Chaleur lourde (${Math.round(apparent)} °C ressentis)`]); }
  else if (apparent >= 30) { score -= 6; }

  // --- Visibilité ---
  if (visibility != null) {
    if (visibility < 1000) { score -= 30; flags.push(["danger", "🌫️", "Visibilité très réduite"]); }
    else if (visibility < 3000) { score -= 13; flags.push(["warn", "🌫️", "Brume — visibilité limitée"]); }
  }
  if ([45, 48].includes(code)) { score -= 8; if (visibility == null || visibility >= 3000) flags.push(["warn", "🌫️", "Brouillard signalé"]); }

  // --- Phénomènes sévères ---
  if ([95, 96, 99].includes(code)) { score -= 30; flags.push(["danger", "⛈️", "Orage — sortie déconseillée"]); }
  if ([71, 73, 75, 77, 85, 86].includes(code)) { score -= 30; flags.push(["danger", "❄️", "Neige / verglas possible"]); }
  if ([56, 57, 66, 67].includes(code)) { score -= 26; flags.push(["danger", "🧊", "Verglas — risque de chute"]); }

  score = Math.max(0, Math.min(100, Math.round(score)));
  if (flags.length === 0) flags.push(["ok", "✅", "Aucune alerte — feu vert pour rouler"]);
  return { score, flags };
}

function verdictFor(score) {
  if (score >= 80) return { word: "GO", color: "var(--go)", note: "Conditions idéales pour sortir le trail. Profite-en." };
  if (score >= 60) return { word: "BON", color: "var(--bon)", note: "Bonne fenêtre pour rouler, garde juste un œil sur la météo." };
  if (score >= 40) return { word: "PRUDENCE", color: "var(--prudence)", note: "Roulable mais conditions exigeantes. Adapte ta vitesse et ton terrain." };
  return { word: "NO-GO", color: "var(--nogo)", note: "Conditions difficiles. Mieux vaut reporter ou rester sur du roulant." };
}

/* ============================================================
   Réseau
   ============================================================ */
async function geocode(query) {
  const url = `${GEO_URL}?name=${encodeURIComponent(query)}&count=6&language=fr&format=json`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("Géocodage indisponible");
  const data = await res.json();
  return data.results || [];
}

async function fetchForecast(lat, lon) {
  const params = new URLSearchParams({
    latitude: lat,
    longitude: lon,
    current: "temperature_2m,apparent_temperature,relative_humidity_2m,precipitation,weather_code,wind_speed_10m,wind_direction_10m,wind_gusts_10m",
    hourly: "temperature_2m,precipitation,precipitation_probability,weather_code,wind_speed_10m,wind_gusts_10m,visibility",
    daily: "weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,wind_speed_10m_max,wind_gusts_10m_max",
    timezone: "auto",
    forecast_days: "7",
    wind_speed_unit: "kmh",
  });
  const res = await fetch(`${FORECAST_URL}?${params}`);
  if (!res.ok) throw new Error("Prévisions indisponibles");
  return res.json();
}

/* ============================================================
   Rendu
   ============================================================ */
const $ = (sel) => document.querySelector(sel);
const els = {
  status: $("#status"), dash: $("#dash"),
  placeName: $("#placeName"), placeSub: $("#placeSub"),
  gaugeFill: $("#gaugeFill"), gaugeNeedle: $("#gaugeNeedle"), gaugeScore: $("#gaugeScore"),
  verdictWord: $("#verdictWord"), verdictNote: $("#verdictNote"), flags: $("#flags"),
  tiles: $("#tiles"), hours: $("#hours"), days: $("#days"),
  favs: $("#favs"), favToggle: $("#favToggle"),
};

let currentPlace = null;

function setStatus(html, isError = false) {
  els.status.innerHTML = html;
  els.status.classList.toggle("error", isError);
  els.status.style.display = html ? "block" : "none";
}

function renderGauge(score) {
  const ARC = 251.3;
  els.gaugeFill.style.strokeDashoffset = ARC * (1 - score / 100);
  const v = verdictFor(score);
  els.gaugeFill.style.stroke = v.color;
  const angle = (score / 100) * 180 - 90;
  els.gaugeNeedle.style.transform = `rotate(${angle}deg)`;
  els.gaugeScore.textContent = score;
  els.verdictWord.textContent = v.word;
  els.verdictWord.style.color = v.color;
  els.verdictNote.textContent = v.note;
}

function renderFlags(flags) {
  els.flags.innerHTML = flags
    .map(([type, icon, text]) => `<li class="${type}"><span>${icon}</span>${text}</li>`)
    .join("");
}

function tile(label, icon, value, unit, sub) {
  return `<div class="tile">
    <div class="tile-label"><span class="tile-icon">${icon}</span>${label}</div>
    <div class="tile-value">${value}${unit ? `<small>${unit}</small>` : ""}</div>
    ${sub ? `<div class="tile-sub">${sub}</div>` : ""}
  </div>`;
}

function renderTiles(cur) {
  els.tiles.innerHTML = [
    tile("Ressenti", "🌡️", Math.round(cur.apparent_temperature), "°C", `Réel ${Math.round(cur.temperature_2m)} °C`),
    tile("Vent", "💨", Math.round(cur.wind_speed_10m), "km/h", `Direction ${windArrow(cur.wind_direction_10m)}`),
    tile("Rafales", "🌬️", Math.round(cur.wind_gusts_10m), "km/h", "Pics de vent"),
    tile("Pluie", "🌧️", cur.precipitation.toFixed(1), "mm", "Dernière heure"),
    tile("Humidité", "💧", Math.round(cur.relative_humidity_2m), "%", null),
    tile("Ciel", "🛰️", wmoIcon(cur.weather_code), "", wmoLabel(cur.weather_code)),
  ].join("");
}

function renderHours(hourly, startIndex) {
  const slots = [];
  for (let i = startIndex; i < Math.min(startIndex + 12, hourly.time.length); i++) {
    const { score } = computeScore({
      apparent: hourly.temperature_2m[i],
      precip: hourly.precipitation[i],
      precipProb: hourly.precipitation_probability[i] ?? 0,
      wind: hourly.wind_speed_10m[i],
      gusts: hourly.wind_gusts_10m[i],
      visibility: hourly.visibility[i],
      code: hourly.weather_code[i],
    });
    slots.push({ i, score });
  }
  // Marque les 3 meilleurs créneaux (s'ils sont au moins corrects)
  const best = new Set(
    [...slots].sort((a, b) => b.score - a.score).slice(0, 3).filter((s) => s.score >= 55).map((s) => s.i)
  );

  els.hours.innerHTML = slots.map(({ i, score }) => {
    const h = new Date(hourly.time[i]).getHours();
    const v = verdictFor(score);
    const rain = hourly.precipitation_probability[i] ?? 0;
    return `<div class="hour ${best.has(i) ? "best" : ""}">
      <div class="hour-time">${String(h).padStart(2, "0")}h</div>
      <div class="hour-dot" style="background:${v.color}" title="Indice ${score}"></div>
      <div class="hour-temp">${Math.round(hourly.temperature_2m[i])}°</div>
      <div class="hour-rain">${rain}%</div>
    </div>`;
  }).join("");
}

function renderDays(daily) {
  const fmtDay = new Intl.DateTimeFormat("fr-FR", { weekday: "short" });
  const fmtDate = new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "2-digit" });
  els.days.innerHTML = daily.time.map((t, i) => {
    const { score } = computeScore({
      apparent: (daily.temperature_2m_max[i] + daily.temperature_2m_min[i]) / 2,
      precip: daily.precipitation_sum[i],
      precipProb: daily.precipitation_probability_max[i] ?? 0,
      wind: daily.wind_speed_10m_max[i],
      gusts: daily.wind_gusts_10m_max[i],
      visibility: null,
      code: daily.weather_code[i],
    });
    const v = verdictFor(score);
    const d = new Date(t);
    const name = i === 0 ? "Auj." : fmtDay.format(d).replace(".", "");
    return `<div class="day">
      <div class="day-name">${name}<small>${fmtDate.format(d)}</small></div>
      <div class="day-ico" title="${wmoLabel(daily.weather_code[i])}">${wmoIcon(daily.weather_code[i])}</div>
      <div class="day-bar-wrap">
        <div class="day-bar"><span style="width:${score}%;background:${v.color}"></span></div>
        <div class="day-score">${score}/100</div>
      </div>
      <div class="day-temp"><b>${Math.round(daily.temperature_2m_max[i])}°</b> <span>/ ${Math.round(daily.temperature_2m_min[i])}°</span></div>
    </div>`;
  }).join("");
}

/* Trouve l'index horaire le plus proche de maintenant */
function nearestHourIndex(times) {
  const now = Date.now();
  let bestIdx = 0, bestDiff = Infinity;
  for (let i = 0; i < times.length; i++) {
    const diff = Math.abs(new Date(times[i]).getTime() - now);
    if (diff < bestDiff) { bestDiff = diff; bestIdx = i; }
  }
  return bestIdx;
}

/* ============================================================
   Orchestration
   ============================================================ */
async function loadPlace(place) {
  currentPlace = place;
  setStatus(`<div class="spinner"></div>Lecture des conditions à ${place.name}…`);
  els.dash.hidden = true;

  try {
    const data = await fetchForecast(place.latitude, place.longitude);
    const cur = data.current;
    const idx = nearestHourIndex(data.hourly.time);
    const visibility = data.hourly.visibility[idx];

    const { score, flags } = computeScore({
      apparent: cur.apparent_temperature,
      precip: cur.precipitation,
      precipProb: data.hourly.precipitation_probability[idx] ?? 0,
      wind: cur.wind_speed_10m,
      gusts: cur.wind_gusts_10m,
      visibility,
      code: cur.weather_code,
    });

    els.placeName.textContent = place.name;
    const bits = [place.admin1, place.country].filter(Boolean).join(" · ");
    els.placeSub.textContent = `${bits} — ${place.latitude.toFixed(2)}, ${place.longitude.toFixed(2)}`;

    renderGauge(score);
    renderFlags(flags);
    renderTiles(cur);
    renderHours(data.hourly, idx);
    renderDays(data.daily);
    updateFavToggle();

    setStatus("");
    els.dash.hidden = false;

    localStorage.setItem(LAST_KEY, JSON.stringify(place));
  } catch (err) {
    console.error(err);
    setStatus(`Impossible de récupérer la météo. Vérifie ta connexion puis réessaie.`, true);
  }
}

/* ---------- Recherche + autocomplétion ---------- */
const input = $("#cityInput");
const sugList = $("#suggestions");
const form = $("#searchForm");
let sugItems = [];
let sugActive = -1;
let debounceTimer = null;

function closeSug() {
  sugList.hidden = true;
  sugList.innerHTML = "";
  input.setAttribute("aria-expanded", "false");
  sugItems = []; sugActive = -1;
}

function openSug(results) {
  sugItems = results;
  if (!results.length) { closeSug(); return; }
  sugList.innerHTML = results.map((r, i) => {
    const meta = [r.admin1, r.country_code].filter(Boolean).join(" · ");
    return `<li role="option" data-i="${i}"><span class="sug-name">${r.name}</span><span class="sug-meta">${meta}</span></li>`;
  }).join("");
  sugList.hidden = false;
  input.setAttribute("aria-expanded", "true");
  sugActive = -1;
}

sugList.addEventListener("click", (e) => {
  const li = e.target.closest("li");
  if (!li) return;
  const r = sugItems[Number(li.dataset.i)];
  input.value = r.name;
  closeSug();
  loadPlace(r);
});

input.addEventListener("input", () => {
  const q = input.value.trim();
  clearTimeout(debounceTimer);
  if (q.length < 2) { closeSug(); return; }
  debounceTimer = setTimeout(async () => {
    try { openSug(await geocode(q)); } catch { closeSug(); }
  }, 280);
});

input.addEventListener("keydown", (e) => {
  if (sugList.hidden) return;
  const items = [...sugList.children];
  if (e.key === "ArrowDown") { e.preventDefault(); sugActive = Math.min(sugActive + 1, items.length - 1); }
  else if (e.key === "ArrowUp") { e.preventDefault(); sugActive = Math.max(sugActive - 1, 0); }
  else if (e.key === "Enter" && sugActive >= 0) { e.preventDefault(); items[sugActive].click(); return; }
  else if (e.key === "Escape") { closeSug(); return; }
  else return;
  items.forEach((it, i) => it.setAttribute("aria-selected", i === sugActive));
});

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const q = input.value.trim();
  if (!q) return;
  if (sugActive >= 0 && sugItems[sugActive]) { loadPlace(sugItems[sugActive]); closeSug(); return; }
  try {
    const results = await geocode(q);
    if (results.length) { closeSug(); loadPlace(results[0]); }
    else setStatus(`Aucune ville trouvée pour « ${q} ».`, true);
  } catch { setStatus("Recherche indisponible pour le moment.", true); }
});

document.addEventListener("click", (e) => {
  if (!form.contains(e.target)) closeSug();
});

/* ---------- Favoris (localStorage) ---------- */
function getFavs() {
  try { return JSON.parse(localStorage.getItem(FAVS_KEY)) || []; } catch { return []; }
}
function saveFavs(favs) { localStorage.setItem(FAVS_KEY, JSON.stringify(favs)); }

function favKey(p) { return `${p.latitude.toFixed(3)},${p.longitude.toFixed(3)}`; }

function isFav(p) { return getFavs().some((f) => favKey(f) === favKey(p)); }

function renderFavs() {
  const favs = getFavs();
  els.favs.innerHTML = favs.map((f, i) =>
    `<button class="fav-chip" data-i="${i}" data-active="${currentPlace && favKey(currentPlace) === favKey(f)}">${f.name}</button>`
  ).join("");
}

els.favs.addEventListener("click", (e) => {
  const chip = e.target.closest(".fav-chip");
  if (!chip) return;
  loadPlace(getFavs()[Number(chip.dataset.i)]);
});

function updateFavToggle() {
  const fav = currentPlace && isFav(currentPlace);
  els.favToggle.setAttribute("aria-pressed", String(!!fav));
  els.favToggle.querySelector("span").textContent = fav ? "Enregistrée" : "Enregistrer";
  renderFavs();
}

els.favToggle.addEventListener("click", () => {
  if (!currentPlace) return;
  let favs = getFavs();
  if (isFav(currentPlace)) favs = favs.filter((f) => favKey(f) !== favKey(currentPlace));
  else favs.push(currentPlace);
  saveFavs(favs);
  updateFavToggle();
});

/* ---------- Démarrage ---------- */
(function init() {
  renderFavs();
  let start = null;
  try { start = JSON.parse(localStorage.getItem(LAST_KEY)); } catch {}
  if (!start) {
    start = { name: "Toulouse", admin1: "Occitanie", country: "France", latitude: 43.6045, longitude: 1.444 };
  }
  loadPlace(start);
})();
