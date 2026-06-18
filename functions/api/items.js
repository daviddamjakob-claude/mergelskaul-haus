export async function onRequestGet({ env }) {
  try {
    const { results } = await env.DB.prepare(
      "SELECT * FROM items ORDER BY created_at DESC"
    ).all();
    return Response.json(results);
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}

export async function onRequestPost({ request, env }) {
  try {
    const body = await request.json();
    const { item, raum, notes, entscheidung, images } = body;

    if (!item || !raum) {
      return Response.json({ error: "item und raum sind Pflichtfelder" }, { status: 400 });
    }

    const { meta } = await env.DB.prepare(
      "INSERT INTO items (item, raum, notes, entscheidung, images) VALUES (?, ?, ?, ?, ?)"
    )
      .bind(item, raum, notes ?? "", entscheidung ?? "Noch unklar", JSON.stringify(images ?? []))
      .run();

    const created = await env.DB.prepare("SELECT * FROM items WHERE id = ?")
      .bind(meta.last_row_id)
      .first();

    return Response.json(created, { status: 201 });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
