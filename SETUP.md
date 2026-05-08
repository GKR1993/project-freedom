# Setup — Oferte e Compre

## Passo 1 — GitHub (rode no terminal dentro de `C:\Users\gugar\oferte-compre`)

```powershell
# Login no GitHub CLI (abre o browser)
gh auth login

# Cria o repositório e faz o push
gh repo create project-freedom --public --source=. --remote=origin --push
```

## Passo 2 — Supabase

1. Acesse [supabase.com](https://supabase.com) → **New Project**
   - Nome: `oferte-compre`
2. Depois de criado, vá em **SQL Editor** e cole todo o conteúdo de `supabase/schema.sql`
3. Copie a **URL** e a **anon key** em: Project Settings → API
4. Edite `assets/js/config.js` e substitua:
   - `https://SEU-PROJETO.supabase.co` → sua URL
   - `SUA-ANON-KEY` → sua anon key

## Passo 3 — Cloudflare Pages

1. Acesse [dash.cloudflare.com](https://dash.cloudflare.com) → **Pages** → **Create a project** → **Connect to Git**
2. Selecione o repositório `project-freedom`
3. Build settings:
   - Framework preset: **None**
   - Build command: *(deixe vazio)*
   - Build output directory: `/`
4. Em **Settings → Environment variables** do projeto Pages (não é necessário para static)

Para o **deploy automático via GitHub Actions** (alternativo ao Cloudflare Git integration):
1. Cloudflare → My Profile → **API Tokens** → Create Token → `Edit Cloudflare Workers` template
2. No GitHub repo → Settings → Secrets → Actions → adicione:
   - `CLOUDFLARE_API_TOKEN` → token criado acima
   - `CLOUDFLARE_ACCOUNT_ID` → seu Account ID (Cloudflare dashboard, lado direito)

> **Recomendação:** Use direto a integração Git do Cloudflare Pages (passo 3.1-3.3). É mais simples que o GitHub Actions para sites estáticos — qualquer push no `main` deploya automaticamente.

## Passo 4 — Commit do config e deploy

```powershell
cd C:\Users\gugar\oferte-compre
git add assets/js/config.js
git commit -m "config: add Supabase credentials"
git push
```

O site estará live em `https://oferte-compre.pages.dev` (ou URL customizada).

---

## Estrutura do projeto

```
oferte-compre/
├── index.html                  ← Landing page
├── loja/
│   ├── index.html              ← Vitrine para clientes
│   └── produto.html            ← Produto + formulário de oferta
├── merchant/
│   ├── login.html              ← Login do lojista
│   ├── register.html           ← Cadastro do lojista
│   ├── dashboard.html          ← Painel com produtos e stats
│   └── novo-produto.html       ← Cadastro de produto
├── assets/js/
│   ├── config.js               ← Credenciais Supabase (EDITAR)
│   ├── auth.js                 ← Utilitários compartilhados
│   ├── merchant.js             ← Lógica do painel lojista
│   └── loja.js                 ← Lógica da vitrine + oferta
└── supabase/schema.sql         ← Schema + função make_offer()
```
