// Shared auth utilities

async function getSession() {
  const { data: { session } } = await supabase.auth.getSession();
  return session;
}

async function requireMerchantAuth() {
  const session = await getSession();
  if (!session) {
    window.location.href = '/merchant/login.html';
    return null;
  }
  return session;
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
  toast.className = `fixed bottom-6 right-6 px-5 py-3 rounded-xl text-white text-sm font-medium shadow-lg z-50 transition-all ${
    type === 'success' ? 'bg-green-600' : type === 'error' ? 'bg-red-600' : 'bg-yellow-600'
  }`;
  toast.classList.remove('hidden');
  setTimeout(() => toast.classList.add('hidden'), 4000);
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
