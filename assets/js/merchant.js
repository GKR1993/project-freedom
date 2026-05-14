// Merchant portal logic

// ── Dashboard ────────────────────────────────────────────────
async function restGet(path, token) {
  const res = await fetch(SUPABASE_URL + '/rest/v1/' + path, {
    headers: {
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': 'Bearer ' + token,
      'Accept': 'application/json',
    },
  });
  if (!res.ok) throw new Error((await res.text()) || res.statusText);
  return res.json();
}

async function loadDashboard() {
  const session = await requireMerchantAuth();
  if (!session) return;

  const token = session.access_token;
  document.getElementById('merchant-email').textContent = session.user.email;

  try {
    const merchants = await restGet(`merchants?id=eq.${session.user.id}&limit=1`, token);
    if (merchants[0]) {
      document.getElementById('store-name').textContent = merchants[0].store_name;
    }
  } catch (e) {
    console.error('Merchants fetch error:', e);
  }

  let products;
  try {
    products = await restGet(
      `products?merchant_id=eq.${session.user.id}&status=neq.deleted&order=created_at.desc`,
      token
    );
  } catch (e) {
    const tbody = document.getElementById('products-tbody');
    if (tbody) tbody.innerHTML = `<tr><td colspan="7" class="text-center py-10 text-red-400">Erro ao carregar produtos: ${e.message}</td></tr>`;
    return;
  }

  if (!products) return;

  // Stats
  const totalRevenue = products.reduce((sum, p) => sum + p.accepted_offers_sum, 0);
  const totalSold = products.reduce((sum, p) => sum + p.accepted_offers_count, 0);
  const activeProducts = products.filter(p => p.status === 'active').length;

  document.getElementById('stat-revenue').textContent = formatCurrency(totalRevenue);
  document.getElementById('stat-sold').textContent = totalSold;
  document.getElementById('stat-active').textContent = activeProducts;

  // Products table
  const tbody = document.getElementById('products-tbody');
  if (products.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="text-center py-10 text-gray-400">Nenhum produto cadastrado ainda.</td></tr>`;
    return;
  }

  tbody.innerHTML = products.map(p => {
    const avg = p.accepted_offers_count > 0
      ? formatCurrency(p.accepted_offers_sum / p.accepted_offers_count)
      : '—';
    const statusBadge = {
      active: '<span class="badge-green">Ativo</span>',
      paused: '<span class="badge-yellow">Pausado</span>',
      sold_out: '<span class="badge-red">Esgotado</span>',
    }[p.status] || '';

    return `
      <tr class="border-b border-gray-100 hover:bg-gray-50">
        <td class="py-3 px-4">
          <div class="flex items-center gap-3">
            ${p.images[0] ? `<img src="${p.images[0]}" class="w-10 h-10 rounded-lg object-cover">` : '<div class="w-10 h-10 rounded-lg bg-gray-200"></div>'}
            <div>
              <div class="font-medium text-gray-900">${p.name}</div>
              <div class="text-xs text-gray-400">${p.category}</div>
            </div>
          </div>
        </td>
        <td class="py-3 px-4 text-sm">${formatCurrency(p.min_price)}</td>
        <td class="py-3 px-4 text-sm">${formatCurrency(p.market_price)}</td>
        <td class="py-3 px-4 text-sm">${p.stock_remaining}/${p.stock_quantity}</td>
        <td class="py-3 px-4 text-sm">${p.accepted_offers_count} <span class="text-gray-400 text-xs">(med: ${avg})</span></td>
        <td class="py-3 px-4">${statusBadge}</td>
        <td class="py-3 px-4">
          <div class="flex gap-2">
            <button onclick="toggleProduct('${p.id}','${p.status}')" class="btn-sm ${p.status === 'active' ? 'btn-sm-yellow' : 'btn-sm-green'}">
              ${p.status === 'active' ? 'Pausar' : 'Ativar'}
            </button>
            <button onclick="deleteProduct('${p.id}')" class="btn-sm btn-sm-red">Excluir</button>
          </div>
        </td>
      </tr>`;
  }).join('');
}

async function toggleProduct(id, currentStatus) {
  const newStatus = currentStatus === 'active' ? 'paused' : 'active';
  const session = await requireMerchantAuth();
  if (!session) return;
  await fetch(SUPABASE_URL + `/rest/v1/products?id=eq.${id}`, {
    method: 'PATCH',
    headers: {
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': 'Bearer ' + session.access_token,
      'Content-Type': 'application/json',
      'Prefer': 'return=minimal',
    },
    body: JSON.stringify({ status: newStatus }),
  });
  loadDashboard();
}

async function deleteProduct(id) {
  if (!confirm('Excluir este produto? Esta ação não pode ser desfeita.')) return;
  const session = await requireMerchantAuth();
  if (!session) return;
  await fetch(SUPABASE_URL + `/rest/v1/products?id=eq.${id}`, {
    method: 'PATCH',
    headers: {
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': 'Bearer ' + session.access_token,
      'Content-Type': 'application/json',
      'Prefer': 'return=minimal',
    },
    body: JSON.stringify({ status: 'deleted' }),
  });
  loadDashboard();
}

// ── New Product ───────────────────────────────────────────────
async function initNewProduct() {
  const session = await requireMerchantAuth();
  if (!session) return;

  // Populate category select
  const catSelect = document.getElementById('category');
  CATEGORIES.forEach(c => {
    const opt = document.createElement('option');
    opt.value = c;
    opt.textContent = c;
    catSelect.appendChild(opt);
  });

  // Image previews
  document.getElementById('images').addEventListener('change', function() {
    const preview = document.getElementById('image-preview');
    preview.innerHTML = '';
    Array.from(this.files).slice(0, 5).forEach(file => {
      const reader = new FileReader();
      reader.onload = e => {
        const img = document.createElement('img');
        img.src = e.target.result;
        img.className = 'w-24 h-24 object-cover rounded-lg border';
        preview.appendChild(img);
      };
      reader.readAsDataURL(file);
    });
  });

  document.getElementById('product-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    await saveProduct(session);
  });
}

async function saveProduct(session) {
  const btn = document.getElementById('submit-btn');
  btn.disabled = true;
  btn.textContent = 'Salvando...';

  try {
    // Upload images (or use imported URL)
    const imageUrls = [];
    const importedUrl = document.getElementById('image-preview')?.dataset?.importedUrl;
    if (importedUrl) imageUrls.push(importedUrl);
    const files = document.getElementById('images').files;
    for (const file of Array.from(files).slice(0, 5 - imageUrls.length)) {
      const ext = file.name.split('.').pop();
      const path = `${session.user.id}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
      const { data, error } = await supabase.storage
        .from('product-images')
        .upload(path, file, { contentType: file.type });
      if (!error) {
        const { data: { publicUrl } } = supabase.storage.from('product-images').getPublicUrl(path);
        imageUrls.push(publicUrl);
      }
    }

    const qty = parseInt(document.getElementById('stock_quantity').value);
    const insertRes = await fetch(SUPABASE_URL + '/rest/v1/products', {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': 'Bearer ' + session.access_token,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal',
      },
      body: JSON.stringify({
        merchant_id: session.user.id,
        name: document.getElementById('name').value.trim(),
        description: document.getElementById('description').value.trim(),
        category: document.getElementById('category').value,
        condition: document.getElementById('condition').value,
        images: imageUrls,
        stock_quantity: qty,
        stock_remaining: qty,
        min_price: parseFloat(document.getElementById('min_price').value),
        market_price: parseFloat(document.getElementById('market_price').value),
      }),
    });
    if (!insertRes.ok) throw new Error((await insertRes.text()) || insertRes.statusText);
    window.location.href = '/merchant/dashboard.html?added=1';
  } catch (err) {
    showToast('Erro ao salvar produto: ' + err.message, 'error');
    btn.disabled = false;
    btn.textContent = 'Publicar Produto';
  }
}

// ── Login / Register ──────────────────────────────────────────
async function merchantLogin(e) {
  e.preventDefault();
  const email = document.getElementById('email').value;
  const password = document.getElementById('password').value;
  const btn = document.getElementById('submit-btn');
  btn.disabled = true;
  btn.textContent = 'Entrando...';

  try {
    const timeout = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Tempo esgotado — verifique se o projeto Supabase está ativo em supabase.com')), 10000)
    );
    const loginCall = supabase.auth.signInWithPassword({ email, password });
    const { error } = await Promise.race([loginCall, timeout]);

    if (error) {
      const msg = error.message.includes('Email not confirmed')
        ? 'Email não confirmado. Confirme o usuário no painel do Supabase (Authentication → Users).'
        : error.message.includes('Invalid login') || error.message.includes('invalid_grant')
        ? 'Email ou senha incorretos.'
        : error.message;
      showToast(msg, 'error');
      btn.disabled = false;
      btn.textContent = 'Entrar';
    } else {
      window.location.href = '/merchant/dashboard.html';
    }
  } catch (err) {
    showToast(err.message, 'error');
    btn.disabled = false;
    btn.textContent = 'Entrar';
  }
}

async function merchantRegister(e) {
  e.preventDefault();
  const btn = document.getElementById('submit-btn');
  btn.disabled = true;
  btn.textContent = 'Criando conta...';

  const email = document.getElementById('email').value;
  const password = document.getElementById('password').value;
  const storeName = document.getElementById('store_name').value.trim();
  const ownerName = document.getElementById('owner_name').value.trim();
  const phone = document.getElementById('phone').value.trim();

  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) {
    showToast(error.message, 'error');
    btn.disabled = false;
    btn.textContent = 'Criar Conta';
    return;
  }

  if (data.user) {
    await supabase.from('merchants').insert({
      id: data.user.id,
      email,
      store_name: storeName,
      owner_name: ownerName,
      phone,
    });
  }

  showToast('Conta criada! Verifique seu email para confirmar.', 'success');
  setTimeout(() => window.location.href = '/merchant/login.html', 2500);
}
