const OPENAI_ENDPOINT = 'https://api.openai.com/v1/responses';

function send(res, status, data) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(data));
}

function safeText(value, limit = 4000) {
  return String(value || '').replace(/\u0000/g, '').slice(0, limit);
}

function buildProductContext(products = []) {
  if (!Array.isArray(products) || !products.length) return 'Produk belum dimuat dari web.';
  return products.slice(0, 20).map((p, i) => {
    const variants = Array.isArray(p.varians) && p.varians.length
      ? p.varians.map(v => `${v.name || '-'}: ${v.price || '-'}`).join(', ')
      : '-';
    const features = Array.isArray(p.features) && p.features.length
      ? p.features.map(f => f.name || f.desc || '').filter(Boolean).join(', ')
      : '-';
    return `${i + 1}. ${p.title || 'Produk'} | Harga: ${p.price || '-'} | Stok: ${p.available || '-'} | Kategori: ${p.cat || '-'} | Deskripsi: ${p.desc || '-'} | Varian: ${variants} | Fitur: ${features}`;
  }).join('\n');
}

function extractOutputText(data) {
  if (typeof data.output_text === 'string' && data.output_text.trim()) return data.output_text.trim();
  const out = Array.isArray(data.output) ? data.output : [];
  for (const item of out) {
    const content = Array.isArray(item.content) ? item.content : [];
    for (const c of content) {
      if (typeof c.text === 'string' && c.text.trim()) return c.text.trim();
    }
  }
  return '';
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return send(res, 405, { error: 'Method not allowed' });

  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return send(res, 500, { error: 'OPENAI_API_KEY belum diatur di Environment Variables hosting.' });

    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const userMessage = safeText(body.message, 1200);
    if (!userMessage) return send(res, 400, { error: 'Pesan kosong.' });

    const csName = safeText(body.csName || 'Una', 60);
    const storeName = safeText(body.storeName || 'Yonz Official', 80);
    const adminPrompt = safeText(body.prompt, 5000);
    const productContext = buildProductContext(body.products);
    const history = Array.isArray(body.history) ? body.history.slice(-8) : [];

    const input = [
      {
        role: 'system',
        content: [{ type: 'input_text', text: `${adminPrompt}

INSTRUKSI TAMBAHAN SERVER:
Kamu adalah ${csName}, AI chat assistant untuk ${storeName}. Tugasmu bukan hanya jualan: kamu boleh merespons sapaan, obrolan santai, pertanyaan umum, curhatan ringan, dan permintaan bantuan secara natural dalam bahasa Indonesia. Tetap prioritaskan jawaban yang membantu dan nyambung dengan pesan customer. Jika percakapan menyangkut produk, harga, stok, cara order, pembayaran, atau aktivasi, gunakan data produk di bawah sebagai sumber utama. Jangan mengarang harga, stok, promo, garansi, bonus, atau janji aktivasi. Jika butuh keputusan admin, arahkan ke WhatsApp admin. Jangan menyebut bahwa kamu memakai API/OpenAI.` }]
      },
      {
        role: 'system',
        content: [{ type: 'input_text', text: `DATA PRODUK TERBARU DARI WEB:\n${productContext}` }]
      },
      ...history.map(h => ({
        role: h.role === 'assistant' ? 'assistant' : 'user',
        content: [{ type: h.role === 'assistant' ? 'output_text' : 'input_text', text: safeText(h.content, 900) }]
      })),
      { role: 'user', content: [{ type: 'input_text', text: userMessage }] }
    ];

    const r = await fetch(OPENAI_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || 'gpt-4.1-mini',
        input,
        temperature: 0.85,
        max_output_tokens: 350
      })
    });

    const data = await r.json().catch(() => ({}));
    if (!r.ok) {
      console.error('OpenAI error:', data);
      return send(res, r.status, { error: data.error?.message || 'OpenAI request gagal.' });
    }

    const reply = extractOutputText(data);
    if (!reply) return send(res, 500, { error: 'OpenAI tidak mengirim jawaban.' });
    return send(res, 200, { reply });
  } catch (err) {
    console.error('AI CS handler error:', err);
    return send(res, 500, { error: 'Server AI CS error.' });
  }
};
