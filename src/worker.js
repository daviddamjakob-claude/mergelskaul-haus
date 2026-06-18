export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    // API routes
    if (path === "/api/items" && request.method === "GET") {
      return getItems(env);
    }
    if (path === "/api/items" && request.method === "POST") {
      return createItem(request, env);
    }

    const itemMatch = path.match(/^\/api\/items\/(\d+)$/);
    if (itemMatch) {
      const id = itemMatch[1];
      if (request.method === "GET")    return getItem(id, env);
      if (request.method === "PUT")    return updateItem(id, request, env);
      if (request.method === "DELETE") return deleteItem(id, env);
    }

    // Static assets are served automatically via the assets binding
    return new Response("Not found", { status: 404 });
  },
};

async function getItems(env) {
  try {
    const { results } = await env.DB.prepare(
      "SELECT * FROM items ORDER BY created_at DESC"
    ).all();
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

    const created = await env.DB.prepare("SELECT * FROM items WHERE id = ?")
      .bind(meta.last_row_id).first();
    return json(created, 201);
  } catch (e) {
    return json({ error: e.message }, 500);
  }
}

async function getItem(id, env) {
  try {
    const row = await env.DB.prepare("SELECT * FROM items WHERE id = ?").bind(id).first();
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

    const updated = await env.DB.prepare("SELECT * FROM items WHERE id = ?").bind(id).first();
    return json(updated);
  } catch (e) {
    return json({ error: e.message }, 500);
  }
}

async function deleteItem(id, env) {
  try {
    await env.DB.prepare("DELETE FROM items WHERE id = ?").bind(id).run();
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
