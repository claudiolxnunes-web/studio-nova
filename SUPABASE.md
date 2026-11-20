# Supabase + login com Gmail

Projeto Supabase já criado:

```text
https://qouxoyrtdikknueavqhc.supabase.co
```

Falta apenas a **chave pública `anon`** para o app conectar.

## 1. Pegar a chave anon

No Supabase Dashboard:

```text
Project Settings (engrenagem) → API → Project API keys
```

Copie a chave **`anon` / `public`**.

> Não copie a `service_role` para o navegador nem para o chat. Ela é secreta e
> só pode ficar no `.env` do servidor.

Depois escolha uma opção:

- cole a chave anon no `.env` local:
  ```env
  VITE_SUPABASE_URL=https://qouxoyrtdikknueavqhc.supabase.co
  VITE_SUPABASE_ANON_KEY=COLE_A_CHAVE_ANON_AQUI
  ```
- ou me passe a chave anon e eu configuro o `.env` local.

## 2. Criar as tabelas e políticas

Abra:

```text
Supabase Dashboard → SQL Editor → New query
```

Cole o conteúdo de:

```text
supabase/schema.sql
```

E clique em **Run**.

Isso cria:

- `profiles` — nome, e-mail e avatar;
- `projects` — projetos com JSON completo;
- `project_assets` — metadados das mídias;
- bucket privado `media` para os arquivos;
- políticas RLS: cada usuário só acessa os próprios dados.

## 3. Ativar login com Google

### 3.1 Google Cloud

1. Abra https://console.cloud.google.com/
2. Crie/selecione um projeto.
3. **APIs & Services → OAuth consent screen**:
   - tipo **External**;
   - nome do app: `Studio Nova`;
   - e-mail de suporte;
   - salve.
4. **Credentials → Create Credentials → OAuth client ID**:
   - tipo **Web application**;
   - nome: `Studio Nova Web`;
   - **Authorized JavaScript origins**:
     ```text
     http://localhost:3000
     ```
   - **Authorized redirect URIs**:
     ```text
     https://qouxoyrtdikknueavqhc.supabase.co/auth/v1/callback
     ```
5. Copie o **Client ID** e o **Client Secret**.

### 3.2 Supabase

1. Abra **Authentication → Providers → Google**.
2. Ative.
3. Cole o **Client ID** e o **Client Secret** do Google.
4. Salve.

Depois em **Authentication → URL Configuration**:

- **Site URL**:
  ```text
  http://localhost:3000
  ```
- **Redirect URLs**:
  ```text
  http://localhost:3000/**
  ```

## 4. O que será implementado no app

Quando a chave estiver configurada:

- botão **Entrar com Google**;
- sessão persistente;
- avatar/nome/e-mail no topo;
- sincronização dos projetos com `projects`;
- upload das mídias para o bucket `media`;
- “baixar da nuvem” em outro computador;
- modo local continua funcionando sem login.

## 5. Segurança

- A chave `anon` é pública por design; a RLS protege os dados.
- A `service_role` ignora RLS; nunca vai para o navegador.
- Não versione `.env` (já está no `.gitignore`).
- Em produção, adicione o domínio real em Google OAuth e Supabase.
