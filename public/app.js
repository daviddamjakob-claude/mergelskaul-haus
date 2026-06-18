// ── Config ────────────────────────────────────────────────────────────────────
const CLOUDINARY_CLOUD  = "dglx8phdf";
const CLOUDINARY_PRESET = "claude_mergelskaul_verkauf";

const ACCOUNTS = {
  "Admin": { initials: "AD", color: "#1c3d3b" },
  "C&C":   { initials: "CC", color: "#7c3aed" },
  "David": { initials: "DA", color: "#1e40af" },
  "Nicki": { initials: "NI", color: "#b45309" },
  "Tizi":  { initials: "TI", color: "#166534" },
  "Tara":  { initials: "TA", color: "#991b1b" },
};

// ── State ─────────────────────────────────────────────────────────────────────
let allItems      = [];
let pendingImages = [];
let editingId     = null;
let selectedEntsch = "Noch unklar";
let filterRaum    = "";
let filterEntsch  = "";
let currentAccount = null;

// ── DOM ───────────────────────────────────────────────────────────────────────
const pageLogin    = document.getElementById("pageLogin");
const pageOverview = document.getElementById("pageOverview");
const pageForm     = document.getElementById("pageForm");
const itemList     = document.getElementById("itemList");
const emptyState   = document.getElementById("emptyState");
const statsBar     = document.getElementById("statsBar");
const statsText    = document.getElementById("statsText");
const filterSheet  = document.getElementById("filterSheet");
const reactionSheet = document.getElementById("reactionSheet");
const lightbox     = document.getElementById("lightbox");
const lightboxImg  = document.getElementById("lightboxImg");
const search       = document.getElementById("search");
const formPageTitle = document.getElementById("formPageTitle");
const fieldItem    = document.getElementById("fieldItem");
const fieldRaum    = document.getElementById("fieldRaum");
const fieldNotes   = document.getElementById("fieldNotes");
const fieldImages  = document.getElementById("fieldImages");
const imgPreview   = document.getElementById("imagePreview");
const formError    = document.getElementById("formError");
const btnFilter    = document.getElementById("btnFilter");
const filterLabel  = document.getElementById("filterLabel");
const userChip     = document.getElementById("userChip");
const fab          = document.getElementById("fab");

// ── Init ──────────────────────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  // Login
  document.querySelectorAll(".account-btn").forEach(btn => {
    btn.addEventListener("click", () => login(btn.dataset.account));
  });

  // Overview
  document.getElementById("fab").addEventListener("click", openNewForm);
  document.getElementById("btnLogout").addEventListener("click", logout);
  document.getElementById("clearFilter").addEventListener("click", clearFilters);
  search.addEventListener("input", renderList);
  btnFilter.addEventListener("click", () => filterSheet.classList.remove("hidden"));
  document.getElementById("sheetBackdrop").addEventListener("click", () => filterSheet.classList.add("hidden"));
  document.getElementById("applyFilter").addEventListener("click", applySheet);

  // Reaction sheet
  document.getElementById("reactionSheetBackdrop").addEventListener("click", () => reactionSheet.classList.add("hidden"));

  // Form
  document.getElementById("btnBack").addEventListener("click", showOverview);
  document.getElementById("btnSave").addEventListener("click", handleSave);
  fieldImages.addEventListener("change", handleImageSelect);
  document.getElementById("chipGroup").addEventListener("click", e => {
    const chip = e.target.closest(".chip");
    if (!chip) return;
    selectedEntsch = chip.dataset.value;
    document.querySelectorAll("#chipGroup .chip").forEach(c => c.classList.remove("active"));
    chip.classList.add("active");
  });

  // Filter sheet chips
  document.querySelectorAll("[data-filter]").forEach(chip => {
    chip.addEventListener("click", () => {
      const group = chip.dataset.filter;
      document.querySelectorAll(`[data-filter="${group}"]`).forEach(c => c.classList.remove("active"));
      chip.classList.add("active");
    });
  });

  // Lightbox
  document.getElementById("lightboxBackdrop").addEventListener("click", closeLightbox);
  document.getElementById("lightboxClose").addEventListener("click", closeLightbox);
  document.getElementById("lightboxPrev").addEventListener("click", () => showLightboxImage(lbIndex - 1));
  document.getElementById("lightboxNext").addEventListener("click", () => showLightboxImage(lbIndex + 1));
  lightboxImg.addEventListener("touchstart", e => { lbTouchStartX = e.touches[0].clientX; }, { passive: true });
  lightboxImg.addEventListener("touchend", e => {
    const dx = e.changedTouches[0].clientX - lbTouchStartX;
    if (Math.abs(dx) > 50) showLightboxImage(lbIndex + (dx < 0 ? 1 : -1));
  }, { passive: true });

  // Restore session
  const saved = localStorage.getItem("mgh_account");
  if (saved && ACCOUNTS[saved]) {
    login(saved, true);
  }
});

// ── Auth ──────────────────────────────────────────────────────────────────────
function login(account, silent = false) {
  currentAccount = account;
  localStorage.setItem("mgh_account", account);

  // User chip in header
  const cfg = ACCOUNTS[account];
  userChip.innerHTML = `
    <span class="user-chip-avatar" style="background:${cfg.color}">${cfg.initials}</span>
    ${account}
  `;

  // Show/hide FAB based on role
  fab.classList.toggle("hidden", account !== "Admin");

  // Transition to overview
  pageLogin.classList.remove("active");
  pageOverview.classList.add("active");
  pageOverview.classList.remove("slide-left");

  if (!silent || allItems.length === 0) loadItems();
}

function logout() {
  currentAccount = null;
  localStorage.removeItem("mgh_account");
  pageOverview.classList.remove("active");
  pageOverview.classList.add("slide-left");
  pageForm.classList.remove("active");
  pageLogin.classList.add("active");
}

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
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || "Fehler"); }
  return res.json();
}

async function apiDelete(id) {
  await fetch(`/api/items/${id}`, { method: "DELETE" });
}

async function apiReact(itemId, reaction) {
  const reactions = parseReactions(allItems.find(i => i.id === itemId)?.reactions);
  const mine = reactions.find(r => r.account === currentAccount);

  if (mine && mine.reaction === reaction) {
    // Toggle off
    await fetch("/api/reactions", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ item_id: itemId, account: currentAccount }),
    });
    updateLocalReaction(itemId, null);
  } else {
    await fetch("/api/reactions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ item_id: itemId, account: currentAccount, reaction }),
    });
    updateLocalReaction(itemId, reaction);
  }
  renderList();
}

function updateLocalReaction(itemId, reaction) {
  const item = allItems.find(i => i.id === itemId);
  if (!item) return;
  let reactions = parseReactions(item.reactions);
  reactions = reactions.filter(r => r.account !== currentAccount);
  if (reaction) reactions.push({ account: currentAccount, reaction });
  item.reactions = JSON.stringify(reactions);
}

// ── Cloudinary ────────────────────────────────────────────────────────────────
async function uploadImage(file) {
  const fd = new FormData();
  fd.append("file", file);
  fd.append("upload_preset", CLOUDINARY_PRESET);
  const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD}/image/upload`, { method: "POST", body: fd });
  if (!res.ok) throw new Error("Upload fehlgeschlagen");
  return res.json();
}

async function handleImageSelect(e) {
  const files = [...e.target.files];
  if (!files.length) return;
  const label = document.querySelector(".image-add-btn");
  label.style.opacity = "0.6";
  for (const file of files) {
    try {
      const data = await uploadImage(file);
      pendingImages.push({ url: data.secure_url });
      addThumb(data.secure_url, pendingImages.length - 1);
    } catch { alert(`Upload fehlgeschlagen: ${file.name}`); }
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
  img.addEventListener("click", () => openLightbox(pendingImages.map(i => i.url), parseInt(wrap.dataset.index, 10)));
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
  const item = fieldItem.value.trim();
  const raum = fieldRaum.value;
  if (!item || !raum) { showError("Bitte Gegenstand und Raum ausfüllen."); return; }

  const btn = document.getElementById("btnSave");
  btn.disabled = true;
  btn.textContent = "…";
  try {
    const saved = await apiSave({ item, raum, notes: fieldNotes.value.trim(), entscheidung: selectedEntsch, images: pendingImages.map(i => i.url) });
    if (editingId) {
      const idx = allItems.findIndex(i => i.id === editingId);
      if (idx !== -1) allItems[idx] = { ...saved, reactions: allItems[idx].reactions ?? "[]" };
      else allItems.unshift(saved);
    } else {
      allItems.unshift({ ...saved, reactions: "[]" });
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

// ── Filter ────────────────────────────────────────────────────────────────────
function applySheet() {
  filterRaum  = document.querySelector('[data-filter="raum"].active')?.dataset.value  ?? "";
  filterEntsch = document.querySelector('[data-filter="entsch"].active')?.dataset.value ?? "";
  filterSheet.classList.add("hidden");
  renderList();
  updateFilterUI();
}

function clearFilters() {
  filterRaum = ""; filterEntsch = "";
  document.querySelectorAll('[data-filter="raum"]').forEach((c, i)  => c.classList.toggle("active", i === 0));
  document.querySelectorAll('[data-filter="entsch"]').forEach((c, i) => c.classList.toggle("active", i === 0));
  search.value = "";
  renderList();
  updateFilterUI();
}

function updateFilterUI() {
  const on = filterRaum || filterEntsch;
  btnFilter.classList.toggle("active", !!on);
  filterLabel.textContent = on ? "Aktiv" : "Filter";
}

// ── Render ────────────────────────────────────────────────────────────────────
function renderList() {
  const q = search.value.toLowerCase();
  const filtered = allItems.filter(item => {
    if (filterRaum  && item.raum !== filterRaum)   return false;
    if (filterEntsch && item.entscheidung !== filterEntsch) return false;
    if (q && !item.item.toLowerCase().includes(q) && !(item.notes ?? "").toLowerCase().includes(q)) return false;
    return true;
  });

  updateFilterUI();
  const isFiltered = filterRaum || filterEntsch || q;
  if (isFiltered) {
    statsBar.classList.remove("hidden");
    statsText.textContent = `${filtered.length} von ${allItems.length} Einträgen`;
  } else {
    statsBar.classList.add("hidden");
  }

  itemList.innerHTML = "";
  if (!filtered.length) { emptyState.classList.remove("hidden"); return; }
  emptyState.classList.add("hidden");

  filtered.forEach(item => {
    itemList.appendChild(buildCard(item));
  });
}

function buildCard(item) {
  const images   = parseImages(item.images);
  const reactions = parseReactions(item.reactions);
  const isAdmin  = currentAccount === "Admin";
  const myReact  = reactions.find(r => r.account === currentAccount)?.reaction ?? null;
  const hearts   = reactions.filter(r => r.reaction === "heart");
  const crosses  = reactions.filter(r => r.reaction === "cross");

  const card = document.createElement("div");
  card.className = "card";

  // ── Main row ────────────────────────────────────────────
  const main = document.createElement("div");
  main.className = "card-main";

  // Thumb
  const thumb = document.createElement("div");
  thumb.className = "card-thumb";
  if (images.length) {
    const img = document.createElement("img");
    img.src = images[0];
    img.alt = item.item;
    img.addEventListener("click", () => openLightbox(images, 0));
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

  if (isAdmin) {
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
  } else {
    const heartBtn = document.createElement("button");
    heartBtn.className = `card-action-btn react-heart${myReact === "heart" ? " active" : ""}`;
    heartBtn.setAttribute("aria-label", "Herz");
    heartBtn.textContent = "❤️";
    heartBtn.addEventListener("click", () => apiReact(item.id, "heart"));

    const crossBtn = document.createElement("button");
    crossBtn.className = `card-action-btn react-cross${myReact === "cross" ? " active" : ""}`;
    crossBtn.setAttribute("aria-label", "Ablehnen");
    crossBtn.textContent = "✕";
    crossBtn.addEventListener("click", () => apiReact(item.id, "cross"));

    actions.appendChild(heartBtn);
    actions.appendChild(crossBtn);
  }

  main.appendChild(thumb);
  main.appendChild(body);
  main.appendChild(actions);
  card.appendChild(main);

  // ── Reaction footer ──────────────────────────────────────
  const footer = document.createElement("div");
  footer.className = "card-footer";

  const heartCount = document.createElement("button");
  heartCount.className = "reaction-count";
  heartCount.innerHTML = `<span class="rc-icon">❤️</span><span class="rc-num">${hearts.length}</span>`;
  heartCount.addEventListener("click", () => showReactionDetail(item.item, reactions));

  const crossCount = document.createElement("button");
  crossCount.className = "reaction-count";
  crossCount.innerHTML = `<span class="rc-icon" style="font-size:0.85rem;color:var(--text3)">✕</span><span class="rc-num">${crosses.length}</span>`;
  crossCount.addEventListener("click", () => showReactionDetail(item.item, reactions));

  footer.appendChild(heartCount);
  footer.appendChild(crossCount);
  card.appendChild(footer);

  return card;
}

// ── Reaction detail sheet ─────────────────────────────────────────────────────
function showReactionDetail(itemName, reactions) {
  const title = document.getElementById("reactionSheetTitle");
  const body  = document.getElementById("reactionSheetBody");

  title.textContent = itemName;
  body.innerHTML = "";

  if (!reactions.length) {
    body.innerHTML = `<p style="color:var(--text2);text-align:center;padding:16px">Noch keine Reaktionen</p>`;
  } else {
    const hearts = reactions.filter(r => r.reaction === "heart");
    const crosses = reactions.filter(r => r.reaction === "cross");
    [...hearts, ...crosses].forEach(r => {
      const cfg = ACCOUNTS[r.account] ?? { initials: r.account.slice(0,2).toUpperCase(), color: "#78716c" };
      const row = document.createElement("div");
      row.className = "reaction-detail-row";
      row.innerHTML = `
        <span class="reaction-detail-avatar" style="background:${cfg.color}">${cfg.initials}</span>
        <span class="reaction-detail-name">${esc(r.account)}</span>
        <span class="reaction-detail-icon">${r.reaction === "heart" ? "❤️" : "✕"}</span>
      `;
      body.appendChild(row);
    });
  }

  reactionSheet.classList.remove("hidden");
}

// ── Lightbox ──────────────────────────────────────────────────────────────────
let lbImages = [], lbIndex = 0, lbTouchStartX = 0;

function openLightbox(images, index) {
  lbImages = Array.isArray(images) ? images : [images];
  showLightboxImage(index ?? 0);
  lightbox.classList.remove("hidden");
}

function showLightboxImage(index) {
  lbIndex = Math.max(0, Math.min(index, lbImages.length - 1));
  lightboxImg.src = lbImages[lbIndex];
  const multi = lbImages.length > 1;
  document.getElementById("lightboxPrev").classList.toggle("hidden", !multi || lbIndex === 0);
  document.getElementById("lightboxNext").classList.toggle("hidden", !multi || lbIndex === lbImages.length - 1);
  document.getElementById("lightboxCounter").textContent = multi ? `${lbIndex + 1} / ${lbImages.length}` : "";
}

function closeLightbox() {
  lightbox.classList.add("hidden");
  lightboxImg.src = "";
  lbImages = [];
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function parseImages(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  try { return JSON.parse(raw); } catch { return []; }
}

function parseReactions(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  try { return JSON.parse(raw); } catch { return []; }
}

function badgeClass(e) {
  return { "Noch unklar":"unklar", "Kleinmachnow":"kleinmachnow", "Lager":"lager", "David":"david", "Nicki":"nicki", "Tizi":"tizi", "Tara":"tara", "Im Haus lassen / Entrümpelung":"entsorgen" }[e] ?? "unklar";
}

function raumEmoji(raum) {
  return { Keller:"🏚", Wohnzimmer:"🛋", Küche:"🍳", Garten:"🌿", Badezimmer:"🚿", Schlafzimmer:"🛏", "Zimmer Papa":"👔", "Zimmer Oma":"🧶", Dachgeschoss:"🏠", "Flur & Treppenhaus":"🚪" }[raum] ?? "📦";
}

function showError(msg) { formError.textContent = msg; formError.classList.remove("hidden"); }
function hideError()    { formError.classList.add("hidden"); }
function esc(str)       { return String(str ?? "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;"); }
