// Shared auth utilities

async function getSession() {
  const { data: { session } } = await supabase.auth.getSession();
  return session;
}

async function requireMerchantAuth() {
  const session = await getSession();
  if (session) {
    // Explicitly set session so the client attaches JWT to every subsequent request
    await supabase.auth.setSession({
      access_token: session.access_token,
      refresh_token: session.refresh_token,
    });
    return session;
  }

  // Session not in localStorage yet — wait briefly for auth state to resolve
  return new Promise((resolve) => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, s) => {
      subscription.unsubscribe();
      if (!s) {
        window.location.href = '/merchant/login.html';
        resolve(null);
      } else {
        await supabase.auth.setSession({
          access_token: s.access_token,
          refresh_token: s.refresh_token,
        });
        resolve(s);
      }
    });

    // Fallback: if auth state never fires within 2s, redirect to login
    setTimeout(() => {
      subscription.unsubscribe();
      window.location.href = '/merchant/login.html';
      resolve(null);
    }, 2000);
  });
}

async function logout() {
  await supabase.auth.signOut();
  window.location.href = '/merchant/login.html';
}

function formatCurrency(value) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

function formatDate(iso) {
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(iso));
}

function showToast(msg, type = 'success') {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = msg;
  const color = type === 'error' ? '#dc2626' : type === 'warning' ? '#d97706' : '#16a34a';
  toast.style.cssText = `position:fixed;bottom:24px;right:24px;padding:12px 20px;border-radius:12px;color:#fff;font-size:14px;font-weight:500;box-shadow:0 4px 12px rgba(0,0,0,.15);z-index:9999;background:${color};display:block`;
  toast.className = '';
  setTimeout(() => { toast.style.display = 'none'; }, 4000);
}

const CONDITIONS = {
  new: 'Novo',
  like_new: 'Seminovo',
  good: 'Bom estado',
  fair: 'Razoável'
};

const CATEGORIES = [
  'Eletrônicos', 'Eletrodomésticos', 'Móveis', 'Moda', 'Calçados',
  'Esportes', 'Brinquedos', 'Automotivo', 'Ferramentas', 'Outros'
];
