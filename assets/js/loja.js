// Customer shop logic

// ── Browse products ───────────────────────────────────────────
async function loadShop() {
  const grid = document.getElementById('products-grid');
  const loading = document.getElementById('loading');
  const empty = document.getElementById('empty');

  let query = supabase
    .from('public_products')
    .select('*')
    .order('created_at', { ascending: false });

  const category = getParam('categoria');
  if (category) query = query.eq('category', category);

  const search = getParam('q');
  if (search) query = query.ilike('name', `%${search}%`);

  const { data: products, error } = await query;
  loading.classList.add('hidden');

  if (error || !products || products.length === 0) {
    empty.classList.remove('hidden');
    return;
  }

  grid.innerHTML = products.map(p => productCard(p)).join('');
}

function productCard(p) {
  const img = p.images[0] || 'https://placehold.co/400x300/f97316/fff?text=Produto';
  const stockLabel = p.stock_remaining === 0
    ? '<span class="text-xs text-red-500 font-semibold">Esgotado</span>'
    : `<span class="text-xs text-green-600 font-semibold">${p.stock_remaining} disponíve${p.stock_remaining === 1 ? 'l' : 'is'}</span>`;

  return `
    <a href="/loja/produto.html?id=${p.id}" class="group bg-white rounded-2xl shadow-sm hover:shadow-lg transition-all overflow-hidden border border-gray-100">
      <div class="relative overflow-hidden h-52">
        <img src="${img}" alt="${p.name}" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300">
        <span class="absolute top-3 left-3 bg-white/90 backdrop-blur text-xs font-medium px-2 py-1 rounded-full text-gray-700">${p.category}</span>
      </div>
      <div class="p-4">
        <h3 class="font-semibold text-gray-900 group-hover:text-orange-600 transition-colors leading-tight">${p.name}</h3>
        <p class="text-xs text-gray-500 mt-1">${p.store_name}</p>
        <div class="mt-3 flex items-end justify-between">
          <div>
            <p class="text-xs text-gray-400">Preço sugerido</p>
            <p class="text-xl font-bold text-orange-600">${formatCurrency(p.market_price)}</p>
          </div>
          ${stockLabel}
        </div>
        ${p.accepted_offers_count > 0 ? `<p class="text-xs text-gray-400 mt-2">${p.accepted_offers_count} oferta${p.accepted_offers_count > 1 ? 's' : ''} aceita${p.accepted_offers_count > 1 ? 's' : ''}</p>` : ''}
        <button class="mt-3 w-full bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold py-2 rounded-xl transition-colors ${p.stock_remaining === 0 ? 'opacity-50 cursor-not-allowed' : ''}">
          ${p.stock_remaining === 0 ? 'Esgotado' : 'Fazer Oferta'}
        </button>
      </div>
    </a>`;
}

// ── Product detail + offer ────────────────────────────────────
async function loadProduct() {
  const id = getParam('id');
  if (!id) { window.location.href = '/loja/'; return; }

  const { data: p, error } = await supabase
    .from('public_products')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !p) { window.location.href = '/loja/'; return; }

  document.getElementById('loading').classList.add('hidden');
  document.getElementById('product-content').classList.remove('hidden');

  // Images
  const imgMain = document.getElementById('img-main');
  const imgThumbs = document.getElementById('img-thumbs');
  const imgs = p.images.length ? p.images : ['https://placehold.co/600x450/f97316/fff?text=Produto'];
  imgMain.src = imgs[0];
  imgThumbs.innerHTML = imgs.map((src, i) =>
    `<img src="${src}" onclick="document.getElementById('img-main').src='${src}'" class="w-16 h-16 object-cover rounded-lg border-2 cursor-pointer hover:border-orange-400 transition-colors ${i === 0 ? 'border-orange-500' : 'border-gray-200'}">`
  ).join('');

  document.getElementById('product-name').textContent = p.name;
  document.getElementById('product-category').textContent = `${p.category} · ${CONDITIONS[p.condition] || p.condition}`;
  document.getElementById('product-store').textContent = p.store_name;
  document.getElementById('market-price').textContent = formatCurrency(p.market_price);
  document.getElementById('product-description').textContent = p.description || '';

  const stockEl = document.getElementById('product-stock');
  if (p.stock_remaining === 0) {
    stockEl.textContent = 'Esgotado';
    stockEl.className = 'text-red-500 font-semibold';
  } else {
    stockEl.textContent = `${p.stock_remaining} unidade${p.stock_remaining > 1 ? 's' : ''} disponível`;
    stockEl.className = 'text-green-600 font-semibold';
  }

  if (p.accepted_offers_count > 0) {
    document.getElementById('offer-stats').textContent =
      `${p.accepted_offers_count} oferta${p.accepted_offers_count > 1 ? 's' : ''} já aceita${p.accepted_offers_count > 1 ? 's'  : ''}`;
  }

  // Offer form
  const offerInput = document.getElementById('offer-amount');
  const offerSlider = document.getElementById('offer-slider');
  const minVal = Math.round(p.market_price * 0.5);
  const maxVal = Math.round(p.market_price * 1.3);

  offerSlider.min = minVal;
  offerSlider.max = maxVal;
  offerSlider.value = Math.round(p.market_price * 0.9);
  offerInput.value = offerSlider.value;

  offerSlider.addEventListener('input', () => offerInput.value = offerSlider.value);
  offerInput.addEventListener('input', () => offerSlider.value = offerInput.value);

  if (p.stock_remaining === 0) {
    document.getElementById('offer-form-wrap').innerHTML =
      '<div class="bg-red-50 border border-red-200 rounded-2xl p-6 text-center text-red-600 font-medium">Produto esgotado</div>';
    return;
  }

  document.getElementById('offer-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    await submitOffer(id, p);
  });
}

async function submitOffer(productId, product) {
  const btn = document.getElementById('offer-btn');
  btn.disabled = true;
  btn.textContent = 'Enviando...';

  const amount = parseFloat(document.getElementById('offer-amount').value);
  const name = document.getElementById('customer-name').value.trim();
  const phone = document.getElementById('customer-phone').value.trim();
  const email = document.getElementById('customer-email').value.trim();

  if (!amount || amount <= 0) {
    showToast('Informe um valor válido.', 'error');
    btn.disabled = false;
    btn.textContent = 'Enviar Oferta';
    return;
  }

  const { data, error } = await supabase.rpc('make_offer', {
    p_product_id: productId,
    p_customer_name: name,
    p_customer_phone: phone,
    p_customer_email: email || null,
    p_amount: amount,
  });

  btn.disabled = false;
  btn.textContent = 'Enviar Oferta';

  if (error) {
    showToast('Erro ao enviar oferta. Tente novamente.', 'error');
    return;
  }

  const result = document.getElementById('offer-result');
  result.classList.remove('hidden');
  document.getElementById('offer-form-wrap').classList.add('hidden');

  if (data.success) {
    result.innerHTML = `
      <div class="bg-green-50 border border-green-300 rounded-2xl p-6 text-center">
        <div class="text-4xl mb-3">🎉</div>
        <h3 class="text-xl font-bold text-green-700">Oferta Aceita!</h3>
        <p class="text-green-600 mt-2">Sua oferta de <strong>${formatCurrency(data.amount)}</strong> foi aceita!</p>
        <div class="mt-4 bg-white rounded-xl p-4 text-left">
          <p class="text-sm text-gray-600">O lojista <strong>${data.merchant_name}</strong> entrará em contato pelo WhatsApp:</p>
          <a href="https://wa.me/55${data.merchant_phone.replace(/\D/g,'')}" target="_blank"
            class="mt-2 flex items-center gap-2 text-green-600 hover:text-green-700 font-semibold">
            <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
            ${data.merchant_phone}
          </a>
        </div>
      </div>`;
  } else {
    result.innerHTML = `
      <div class="bg-red-50 border border-red-200 rounded-2xl p-6 text-center">
        <div class="text-4xl mb-3">😔</div>
        <h3 class="text-xl font-bold text-red-700">Oferta não aceita</h3>
        <p class="text-red-600 mt-2">${data.message}</p>
        <button onclick="document.getElementById('offer-result').classList.add('hidden');document.getElementById('offer-form-wrap').classList.remove('hidden');"
          class="mt-4 bg-orange-500 hover:bg-orange-600 text-white px-6 py-2 rounded-xl font-semibold transition-colors">
          Tentar novamente
        </button>
      </div>`;
  }
}

// ── Utils ─────────────────────────────────────────────────────
function getParam(key) {
  return new URLSearchParams(window.location.search).get(key);
}
