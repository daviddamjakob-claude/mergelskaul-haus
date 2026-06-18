export async function onRequestGet({ params, env }) {
  try {
    const row = await env.DB.prepare("SELECT * FROM items WHERE id = ?")
      .bind(params.id)
      .first();
    if (!row) return Response.json({ error: "Nicht gefunden" }, { status: 404 });
    return Response.json(row);
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}

export async function onRequestPut({ params, request, env }) {
  try {
    const body = await request.json();
    const { item, raum, notes, entscheidung, images } = body;

    await env.DB.prepare(
      `UPDATE items
       SET item = ?, raum = ?, notes = ?, entscheidung = ?, images = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`
    )
      .bind(item, raum, notes ?? "", entscheidung ?? "Noch unklar", JSON.stringify(images ?? []), params.id)
      .run();

    const updated = await env.DB.prepare("SELECT * FROM items WHERE id = ?")
      .bind(params.id)
      .first();

    return Response.json(updated);
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}

export async function onRequestDelete({ params, env }) {
  try {
    await env.DB.prepare("DELETE FROM items WHERE id = ?").bind(params.id).run();
    return Response.json({ ok: true });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
