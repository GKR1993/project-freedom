export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === '/worker-test') {
      return new Response('Worker v2 OK - deploy funcionando', { status: 200 });
    }

    if (url.pathname === '/api/fetch-product') {
      return handleFetchProduct(url);
    }

    const response = await env.ASSETS.fetch(request);
    const headers = new Headers(response.headers);
    headers.set('Cache-Control', 'no-store, no-cache');
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  },
};

async function handleFetchProduct(url) {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store',
  };

  const targetUrl = url.searchParams.get('url');
  if (!targetUrl) {
    return new Response(JSON.stringify({ error: 'url param required' }), { status: 400, headers: corsHeaders });
  }

  try {
    const res = await fetch(targetUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
      redirect: 'follow',
    });

    if (!res.ok) {
      return new Response(JSON.stringify({ error: `HTTP ${res.status}` }), { status: 422, headers: corsHeaders });
    }

    const html = await res.text();
    const result = parseProduct(html, targetUrl);
    return new Response(JSON.stringify(result), { headers: corsHeaders });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: corsHeaders });
  }
}

function parseProduct(html, pageUrl) {
  const result = { name: '', description: '', image: '', price: '' };

  // 1. Try JSON-LD
  const ldScripts = [...html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
  for (const match of ldScripts) {
    try {
      let data = JSON.parse(match[1]);
      if (!Array.isArray(data)) data = [data];
      const product = data.find(d => d['@type'] === 'Product') ||
        data.flatMap(d => d['@graph'] || []).find(d => d['@type'] === 'Product');
      if (product) {
        result.name = String(product.name || '').trim();
        result.description = String(product.description || '').replace(/<[^>]+>/g, '').trim();
        const img = product.image;
        result.image = Array.isArray(img) ? img[0] : (typeof img === 'object' ? img?.url : img) || '';
        const offers = product.offers;
        if (offers) {
          const offer = Array.isArray(offers) ? offers[0] : offers;
          result.price = String(offer?.price || offer?.lowPrice || '').replace(/[^\d.,]/g, '');
        }
        break;
      }
    } catch (_) { /* continue */ }
  }

  // 2. Fallback: Open Graph
  function ogAttr(prop) {
    const m = html.match(new RegExp(`<meta[^>]+property=["']og:${prop}["'][^>]+content=["']([^"']+)["']`, 'i')) ||
              html.match(new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:${prop}["']`, 'i'));
    return m ? m[1].trim() : '';
  }

  if (!result.name) result.name = ogAttr('title');
  if (!result.description) result.description = ogAttr('description');
  if (!result.image) result.image = ogAttr('image');

  // 3. Fallback: <title> tag
  if (!result.name) {
    const t = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    if (t) result.name = t[1].replace(/\s+/g, ' ').trim();
  }

  // 4. Fallback: meta description
  if (!result.description) {
    const m = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i) ||
              html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']description["']/i);
    if (m) result.description = m[1].trim();
  }

  result.name = result.name.substring(0, 200);
  result.description = result.description.replace(/<[^>]+>/g, '').substring(0, 1000);

  return result;
}
