// ── Config ──────────────────────────────────────────────────────────────────
const CLOUDINARY_CLOUD  = "YOUR_CLOUD_NAME";
const CLOUDINARY_PRESET = "YOUR_UPLOAD_PRESET";

// ── State ────────────────────────────────────────────────────────────────────
let allItems     = [];
let pendingImages = [];   // { url } already uploaded to Cloudinary
let editingId    = null;
let selectedEntsch = "Noch unklar";
let filterRaum   = "";
let filterEntsch = "";

// ── DOM ───────────────────────────────────────────────────────────────────────
const pageOverview  = document.getElementById("pageOverview");
const pageForm      = document.getElementById("pageForm");
const itemList      = document.getElementById("itemList");
const emptyState    = document.getElementById("emptyState");
const statsBar      = document.getElementById("statsBar");
const statsText     = document.getElementById("statsText");
const filterSheet   = document.getElementById("filterSheet");
const lightbox      = document.getElementById("lightbox");
const lightboxImg   = document.getElementById("lightboxImg");
const search        = document.getElementById("search");
const formPageTitle = document.getElementById("formPageTitle");
const fieldItem     = document.getElementById("fieldItem");
const fieldRaum     = document.getElementById("fieldRaum");
const fieldNotes    = document.getElementById("fieldNotes");
const fieldImages   = document.getElementById("fieldImages");
const imgPreview    = document.getElementById("imagePreview");
const formError     = document.getElementById("formError");
const btnFilter     = document.getElementById("btnFilter");
const filterLabel   = document.getElementById("filterLabel");

// ── Init ──────────────────────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  loadItems();

  document.getElementById("fab").addEventListener("click", openNewForm);
  document.getElementById("btnBack").addEventListener("click", showOverview);
  document.getElementById("btnSave").addEventListener("click", handleSave);
  document.getElementById("clearFilter").addEventListener("click", clearFilters);

  search.addEventListener("input", renderList);

  btnFilter.addEventListener("click", openSheet);
  document.getElementById("sheetBackdrop").addEventListener("click", closeSheet);
  document.getElementById("applyFilter").addEventListener("click", applySheet);

  document.getElementById("lightboxBackdrop").addEventListener("click", closeLightbox);
  document.getElementById("lightboxClose").addEventListener("click", closeLightbox);

  fieldImages.addEventListener("change", handleImageSelect);

  // Chip selection on form
  document.getElementById("chipGroup").addEventListener("click", e => {
    const chip = e.target.closest(".chip");
    if (!chip) return;
    selectedEntsch = chip.dataset.value;
    document.querySelectorAll("#chipGroup .chip").forEach(c => c.classList.remove("active"));
    chip.classList.add("active");
  });

  // Sheet filter chips
  document.querySelectorAll("[data-filter]").forEach(chip => {
    chip.addEventListener("click", () => {
      const group = chip.dataset.filter;
      document.querySelectorAll(`[data-filter="${group}"]`).forEach(c => c.classList.remove("active"));
      chip.classList.add("active");
    });
  });
});

// ── Navigation ────────────────────────────────────────────────────────────────
function showOverview() {
  pageOverview.classList.add("active");
  pageOverview.classList.remove("slide-left");
  pageForm.classList.remove("active");
}

function showForm() {
  pageOverview.classList.add("slide-left");
  pageForm.classList.add("active");
}

// ── API ───────────────────────────────────────────────────────────────────────
async function loadItems() {
  try {
    const res = await fetch("/api/items");
    allItems = await res.json();
    if (!Array.isArray(allItems)) allItems = [];
  } catch {
    allItems = [];
  }
  renderList();
}

async function apiSave(data) {
  const url    = editingId ? `/api/items/${editingId}` : "/api/items";
  const method = editingId ? "PUT" : "POST";
  const res = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const e = await res.json().catch(() => ({}));
    throw new Error(e.error || "Fehler beim Speichern");
  }
  return res.json();
}

async function apiDelete(id) {
  await fetch(`/api/items/${id}`, { method: "DELETE" });
}

// ── Cloudinary ────────────────────────────────────────────────────────────────
async function uploadImage(file) {
  const fd = new FormData();
  fd.append("file", file);
  fd.append("upload_preset", CLOUDINARY_PRESET);
  const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD}/image/upload`, {
    method: "POST", body: fd,
  });
  if (!res.ok) throw new Error("Upload fehlgeschlagen");
  return res.json();
}

async function handleImageSelect(e) {
  const files = [...e.target.files];
  if (!files.length) return;

  const label = document.querySelector(".image-add-btn");
  const origText = label.querySelector("span") ? label.querySelector("span").textContent : "Foto hinzufügen";
  label.style.opacity = "0.6";

  for (const file of files) {
    try {
      const data = await uploadImage(file);
      pendingImages.push({ url: data.secure_url });
      addThumb(data.secure_url, pendingImages.length - 1);
    } catch {
      alert(`Upload fehlgeschlagen: ${file.name}`);
    }
  }

  label.style.opacity = "";
  fieldImages.value = "";
}

function addThumb(url, index) {
  const wrap = document.createElement("div");
  wrap.className = "thumb-wrap";
  wrap.dataset.index = index;

  const img = document.createElement("img");
  img.src = url;
  img.addEventListener("click", () => openLightbox(url));

  const rm = document.createElement("button");
  rm.className = "thumb-remove";
  rm.type = "button";
  rm.textContent = "×";
  rm.addEventListener("click", () => {
    pendingImages.splice(parseInt(wrap.dataset.index, 10), 1);
    wrap.remove();
    [...imgPreview.querySelectorAll(".thumb-wrap")].forEach((w, i) => { w.dataset.index = i; });
  });

  wrap.appendChild(img);
  wrap.appendChild(rm);
  imgPreview.appendChild(wrap);
}

// ── Form ──────────────────────────────────────────────────────────────────────
function openNewForm() {
  editingId = null;
  formPageTitle.textContent = "Neuer Eintrag";
  fieldItem.value = "";
  fieldRaum.value = "";
  fieldNotes.value = "";
  pendingImages = [];
  imgPreview.innerHTML = "";
  setChip("Noch unklar");
  hideError();
  showForm();
  setTimeout(() => fieldItem.focus(), 350);
}

function openEditForm(item) {
  editingId = item.id;
  formPageTitle.textContent = "Bearbeiten";
  fieldItem.value = item.item;
  fieldRaum.value = item.raum;
  fieldNotes.value = item.notes ?? "";
  setChip(item.entscheidung ?? "Noch unklar");

  const images = parseImages(item.images);
  pendingImages = images.map(url => ({ url }));
  imgPreview.innerHTML = "";
  pendingImages.forEach((img, i) => addThumb(img.url, i));

  hideError();
  showForm();
}

function setChip(value) {
  selectedEntsch = value;
  document.querySelectorAll("#chipGroup .chip").forEach(c => {
    c.classList.toggle("active", c.dataset.value === value);
  });
}

async function handleSave() {
  hideError();

  const item  = fieldItem.value.trim();
  const raum  = fieldRaum.value;
  if (!item || !raum) {
    showError("Bitte Gegenstand und Raum ausfüllen.");
    return;
  }

  const btn = document.getElementById("btnSave");
  btn.disabled = true;
  btn.textContent = "…";

  try {
    const saved = await apiSave({
      item,
      raum,
      notes: fieldNotes.value.trim(),
      entscheidung: selectedEntsch,
      images: pendingImages.map(i => i.url),
    });

    if (editingId) {
      const idx = allItems.findIndex(i => i.id === editingId);
      if (idx !== -1) allItems[idx] = saved; else allItems.unshift(saved);
    } else {
      allItems.unshift(saved);
    }

    renderList();
    showOverview();
  } catch (err) {
    showError(err.message);
  } finally {
    btn.disabled = false;
    btn.textContent = "Speichern";
  }
}

// ── Filter sheet ──────────────────────────────────────────────────────────────
function openSheet() { filterSheet.classList.remove("hidden"); }
function closeSheet() { filterSheet.classList.add("hidden"); }

function applySheet() {
  const raumChip  = document.querySelector('[data-filter="raum"].active');
  const entschChip = document.querySelector('[data-filter="entsch"].active');
  filterRaum  = raumChip  ? raumChip.dataset.value  : "";
  filterEntsch = entschChip ? entschChip.dataset.value : "";
  closeSheet();
  renderList();
  updateFilterUI();
}

function clearFilters() {
  filterRaum = "";
  filterEntsch = "";
  document.querySelectorAll('[data-filter="raum"]').forEach((c, i) => c.classList.toggle("active", i === 0));
  document.querySelectorAll('[data-filter="entsch"]').forEach((c, i) => c.classList.toggle("active", i === 0));
  search.value = "";
  renderList();
  updateFilterUI();
}

function updateFilterUI() {
  const active = filterRaum || filterEntsch || search.value;
  btnFilter.classList.toggle("active", !!(filterRaum || filterEntsch));
  filterLabel.textContent = (filterRaum || filterEntsch) ? "Aktiv" : "Filter";
}

// ── Render ────────────────────────────────────────────────────────────────────
function renderList() {
  const q = search.value.toLowerCase();
  const filtered = allItems.filter(item => {
    if (filterRaum  && item.raum !== filterRaum)  return false;
    if (filterEntsch && item.entscheidung !== filterEntsch) return false;
    if (q && !item.item.toLowerCase().includes(q) && !(item.notes ?? "").toLowerCase().includes(q)) return false;
    return true;
  });

  updateFilterUI();

  const isFiltered = filterRaum || filterEntsch || q;
  if (isFiltered) {
    statsBar.classList.remove("hidden");
    statsText.textContent = `${filtered.length} von ${allItems.length} Einträgen`;
    document.getElementById("clearFilter").classList.toggle("hidden", !filterRaum && !filterEntsch && !q);
  } else {
    statsBar.classList.add("hidden");
  }

  itemList.innerHTML = "";

  if (!filtered.length) {
    emptyState.classList.remove("hidden");
    return;
  }
  emptyState.classList.add("hidden");

  filtered.forEach(item => {
    const images = parseImages(item.images);
    const card = buildCard(item, images);
    itemList.appendChild(card);
  });
}

function buildCard(item, images) {
  const card = document.createElement("div");
  card.className = "card";

  // Thumbnail
  const thumb = document.createElement("div");
  thumb.className = "card-thumb";
  if (images.length) {
    const img = document.createElement("img");
    img.src = images[0];
    img.alt = item.item;
    img.addEventListener("click", () => openLightbox(images[0]));
    thumb.appendChild(img);
    if (images.length > 1) {
      const cnt = document.createElement("span");
      cnt.className = "card-thumb-count";
      cnt.textContent = `+${images.length - 1}`;
      thumb.appendChild(cnt);
    }
  } else {
    const ph = document.createElement("div");
    ph.className = "card-thumb-placeholder";
    ph.textContent = raumEmoji(item.raum);
    thumb.appendChild(ph);
  }

  // Body
  const body = document.createElement("div");
  body.className = "card-body";

  const title = document.createElement("div");
  title.className = "card-title";
  title.textContent = item.item;

  const meta = document.createElement("div");
  meta.className = "card-meta";

  const raumEl = document.createElement("span");
  raumEl.className = "card-raum";
  raumEl.textContent = item.raum;

  const badge = document.createElement("span");
  badge.className = `badge badge-${badgeClass(item.entscheidung)}`;
  badge.textContent = item.entscheidung;

  meta.appendChild(raumEl);
  meta.appendChild(badge);
  body.appendChild(title);
  body.appendChild(meta);

  if (item.notes) {
    const notes = document.createElement("div");
    notes.className = "card-notes";
    notes.textContent = item.notes;
    body.appendChild(notes);
  }

  // Actions
  const actions = document.createElement("div");
  actions.className = "card-actions";

  const editBtn = document.createElement("button");
  editBtn.className = "card-action-btn";
  editBtn.setAttribute("aria-label", "Bearbeiten");
  editBtn.innerHTML = `<svg viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`;
  editBtn.addEventListener("click", () => openEditForm(item));

  const delBtn = document.createElement("button");
  delBtn.className = "card-action-btn del";
  delBtn.setAttribute("aria-label", "Löschen");
  delBtn.innerHTML = `<svg viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>`;
  delBtn.addEventListener("click", async () => {
    if (!confirm(`"${item.item}" wirklich löschen?`)) return;
    await apiDelete(item.id);
    allItems = allItems.filter(i => i.id !== item.id);
    renderList();
  });

  actions.appendChild(editBtn);
  actions.appendChild(delBtn);

  card.appendChild(thumb);
  card.appendChild(body);
  card.appendChild(actions);
  return card;
}

// ── Lightbox ──────────────────────────────────────────────────────────────────
function openLightbox(url) {
  lightboxImg.src = url;
  lightbox.classList.remove("hidden");
}
function closeLightbox() {
  lightbox.classList.add("hidden");
  lightboxImg.src = "";
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function parseImages(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  try { return JSON.parse(raw); } catch { return []; }
}

function badgeClass(e) {
  return {
    "Noch unklar": "unklar",
    "Kleinmachnow": "kleinmachnow",
    "Lager": "lager",
    "David": "david",
    "Nicki": "nicki",
    "Tizi": "tizi",
    "Tara": "tara",
    "Im Haus lassen / Entrümpelung": "entsorgen",
  }[e] ?? "unklar";
}

function raumEmoji(raum) {
  return { Keller: "🏚", Wohnzimmer: "🛋", Küche: "🍳", Garten: "🌿", Badezimmer: "🚿", Schlafzimmer: "🛏", "Zimmer Papa": "👔", "Zimmer Oma": "🧶", Dachgeschoss: "🏠" }[raum] ?? "📦";
}

function showError(msg) { formError.textContent = msg; formError.classList.remove("hidden"); }
function hideError()    { formError.classList.add("hidden"); }
