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

  // Fallback: extract product name from URL slug
  const slugFallback = extractSlugName(targetUrl);
  const result = { name: slugFallback, description: '', image: '', price: '', partial: false };

  try {
    const res = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'pt-BR,pt;q=0.9',
        'Referer': 'https://www.google.com.br/',
      },
      redirect: 'follow',
    });

    const html = await res.text();

    // Detect bot/anti-scraping block pages
    const isBlocked = !res.ok ||
      html.includes('Não é possível acessar a página') ||
      html.includes('Access Denied') ||
      html.includes('Robot Check') ||
      html.includes('captcha') ||
      html.length < 500;

    if (isBlocked) {
      result.partial = true;
      result.blocked = true;
      return new Response(JSON.stringify(result), { headers: corsHeaders });
    }

    const parsed = parseProduct(html, targetUrl);
    if (parsed.name) result.name = parsed.name;
    if (parsed.description) result.description = parsed.description;
    if (parsed.image) result.image = parsed.image;
    if (parsed.price) result.price = parsed.price;

  } catch (e) {
    result.partial = true;
    result.error = e.message;
  }

  return new Response(JSON.stringify(result), { headers: corsHeaders });
}

function extractSlugName(rawUrl) {
  try {
    const u = new URL(rawUrl);
    const parts = u.pathname.split('/').filter(Boolean);
    // Pick the longest segment that looks like a product slug (has hyphens)
    const slug = parts.sort((a, b) => b.length - a.length).find(p => p.includes('-') && p.length > 10) || parts[0] || '';
    return slug
      .replace(/-/g, ' ')
      .replace(/\b\w/g, c => c.toUpperCase())
      .substring(0, 150);
  } catch (_) {
    return '';
  }
}

function parseProduct(html, pageUrl) {
  const result = { name: '', description: '', image: '', price: '' };

  // Helper: extract meta content by property or name
  function meta(attr, val) {
    const r = new RegExp(`<meta[^>]+${attr}=["']${val}["'][^>]+content=["']([^"']+)["']|<meta[^>]+content=["']([^"']+)["'][^>]+${attr}=["']${val}["']`, 'i');
    const m = html.match(r);
    return m ? (m[1] || m[2] || '').trim() : '';
  }

  // 1. JSON-LD Product schema
  const ldScripts = [...html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
  for (const match of ldScripts) {
    try {
      let data = JSON.parse(match[1]);
      if (!Array.isArray(data)) data = [data];
      const flat = data.flatMap(d => [d, ...(d['@graph'] || [])]);
      const product = flat.find(d => d['@type'] === 'Product');
      if (product) {
        result.name = String(product.name || '').trim();
        result.description = String(product.description || '').replace(/<[^>]+>/g, '').trim();
        const img = product.image;
        result.image = Array.isArray(img) ? img[0] : (img?.url || img || '');
        const offers = product.offers;
        if (offers) {
          const offer = Array.isArray(offers) ? offers[0] : offers;
          result.price = String(offer?.price || offer?.lowPrice || '').replace(/[^\d.,]/g, '');
        }
        break;
      }
    } catch (_) {}
  }

  // 2. Next.js / Nuxt __NEXT_DATA__ / __NUXT__ inline JSON
  if (!result.name) {
    const nextMatch = html.match(/<script[^>]*id=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/i);
    if (nextMatch) {
      try {
        const next = JSON.parse(nextMatch[1]);
        const page = next?.props?.pageProps;
        const p = page?.product || page?.item || page?.data?.product || page?.initialData?.product;
        if (p) {
          result.name = p.name || p.title || p.productName || '';
          result.description = (p.description || p.longDescription || '').replace(/<[^>]+>/g, '');
          result.image = p.image || p.imageUrl || p.images?.[0]?.url || p.images?.[0] || '';
          result.price = String(p.price?.value || p.price || p.salePrice || p.currentPrice || '').replace(/[^\d.,]/g, '');
        }
      } catch (_) {}
    }
  }

  // 3. Open Graph tags
  if (!result.name) result.name = meta('property', 'og:title');
  if (!result.description) result.description = meta('property', 'og:description');
  if (!result.image) result.image = meta('property', 'og:image');
  if (!result.price) result.price = meta('property', 'product:price:amount') || meta('property', 'og:price:amount');

  // 4. Twitter card tags
  if (!result.name) result.name = meta('name', 'twitter:title');
  if (!result.description) result.description = meta('name', 'twitter:description');
  if (!result.image) result.image = meta('name', 'twitter:image');

  // 5. Standard meta tags
  if (!result.name) {
    const t = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    if (t) result.name = t[1].replace(/\s+/g, ' ').trim();
  }
  if (!result.description) result.description = meta('name', 'description');

  // 6. Mercado Livre / common SPA: look for price patterns in raw HTML
  if (!result.price) {
    const priceMatch = html.match(/"price"\s*:\s*([\d]+(?:[.,]\d+)?)/i) ||
                       html.match(/"valor"\s*:\s*([\d]+(?:[.,]\d+)?)/i) ||
                       html.match(/"salePrice"\s*:\s*([\d]+(?:[.,]\d+)?)/i);
    if (priceMatch) result.price = priceMatch[1];
  }

  // 7. Look for product name in common JSON keys in page source
  if (!result.name) {
    const nameMatch = html.match(/"productName"\s*:\s*"([^"]{3,200})"/i) ||
                      html.match(/"itemName"\s*:\s*"([^"]{3,200})"/i) ||
                      html.match(/"product_name"\s*:\s*"([^"]{3,200})"/i);
    if (nameMatch) result.name = nameMatch[1];
  }

  result.name = result.name.substring(0, 200);
  result.description = result.description.replace(/<[^>]+>/g, '').substring(0, 1000);
  result.image = result.image.startsWith('//') ? 'https:' + result.image : result.image;

  return result;
}
