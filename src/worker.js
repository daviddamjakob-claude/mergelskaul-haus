export default {
  async fetch(request, env) {
    const url    = new URL(request.url);
    const path   = url.pathname;
    const method = request.method;

    // ── Items ──────────────────────────────────────────────
    if (path === "/api/items" && method === "GET")  return getItems(env);
    if (path === "/api/items" && method === "POST") return createItem(request, env);

    const itemMatch = path.match(/^\/api\/items\/(\d+)$/);
    if (itemMatch) {
      const id = itemMatch[1];
      if (method === "GET")    return getItem(id, env);
      if (method === "PUT")    return updateItem(id, request, env);
      if (method === "DELETE") return deleteItem(id, env);
    }

    // ── Reactions ───────────────────────────────────────────
    if (path === "/api/reactions" && method === "POST")   return upsertReaction(request, env);
    if (path === "/api/reactions" && method === "DELETE") return removeReaction(request, env);

    return new Response("Not found", { status: 404 });
  },
};

// ── Items ────────────────────────────────────────────────────────────────────
async function getItems(env) {
  try {
    const { results } = await env.DB.prepare(`
      SELECT i.*,
        COALESCE((
          SELECT json_group_array(json_object('account', account, 'reaction', reaction))
          FROM reactions r WHERE r.item_id = i.id
        ), '[]') AS reactions
      FROM items i ORDER BY i.created_at DESC
    `).all();
    return json(results);
  } catch (e) {
    return json({ error: e.message }, 500);
  }
}

async function createItem(request, env) {
  try {
    const { item, raum, notes, entscheidung, images } = await request.json();
    if (!item || !raum) return json({ error: "item und raum sind Pflichtfelder" }, 400);

    const { meta } = await env.DB.prepare(
      "INSERT INTO items (item, raum, notes, entscheidung, images) VALUES (?, ?, ?, ?, ?)"
    ).bind(item, raum, notes ?? "", entscheidung ?? "Noch unklar", JSON.stringify(images ?? [])).run();

    const created = await env.DB.prepare(`
      SELECT i.*, '[]' AS reactions FROM items i WHERE i.id = ?
    `).bind(meta.last_row_id).first();
    return json(created, 201);
  } catch (e) {
    return json({ error: e.message }, 500);
  }
}

async function getItem(id, env) {
  try {
    const row = await env.DB.prepare(`
      SELECT i.*,
        COALESCE((
          SELECT json_group_array(json_object('account', account, 'reaction', reaction))
          FROM reactions r WHERE r.item_id = i.id
        ), '[]') AS reactions
      FROM items i WHERE i.id = ?
    `).bind(id).first();
    if (!row) return json({ error: "Nicht gefunden" }, 404);
    return json(row);
  } catch (e) {
    return json({ error: e.message }, 500);
  }
}

async function updateItem(id, request, env) {
  try {
    const { item, raum, notes, entscheidung, images } = await request.json();
    await env.DB.prepare(
      "UPDATE items SET item=?, raum=?, notes=?, entscheidung=?, images=?, updated_at=CURRENT_TIMESTAMP WHERE id=?"
    ).bind(item, raum, notes ?? "", entscheidung ?? "Noch unklar", JSON.stringify(images ?? []), id).run();

    const updated = await getItem(id, env);
    return updated;
  } catch (e) {
    return json({ error: e.message }, 500);
  }
}

async function deleteItem(id, env) {
  try {
    await env.DB.prepare("DELETE FROM reactions WHERE item_id = ?").bind(id).run();
    await env.DB.prepare("DELETE FROM items WHERE id = ?").bind(id).run();
    return json({ ok: true });
  } catch (e) {
    return json({ error: e.message }, 500);
  }
}

// ── Reactions ────────────────────────────────────────────────────────────────
async function upsertReaction(request, env) {
  try {
    const { item_id, account, reaction } = await request.json();
    if (!item_id || !account || !reaction) return json({ error: "item_id, account und reaction sind Pflichtfelder" }, 400);

    await env.DB.prepare(
      "INSERT INTO reactions (item_id, account, reaction) VALUES (?, ?, ?) ON CONFLICT(item_id, account) DO UPDATE SET reaction=excluded.reaction, created_at=CURRENT_TIMESTAMP"
    ).bind(item_id, account, reaction).run();

    return json({ ok: true });
  } catch (e) {
    return json({ error: e.message }, 500);
  }
}

async function removeReaction(request, env) {
  try {
    const { item_id, account } = await request.json();
    await env.DB.prepare("DELETE FROM reactions WHERE item_id = ? AND account = ?").bind(item_id, account).run();
    return json({ ok: true });
  } catch (e) {
    return json({ error: e.message }, 500);
  }
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
