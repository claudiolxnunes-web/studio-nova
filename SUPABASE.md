# Supabase + login com Gmail

Projeto Supabase:

```text
https://qouxoyrtdikknueavqhc.supabase.co
```

A chave publicável (`sb_publishable_...`, equivalente à antiga `anon`) já está
configurada no `.env` local como `VITE_SUPABASE_ANON_KEY`. Ela é pública por
design e pode ficar no navegador; a RLS protege os dados.

> A chave `service_role` / `sb_secret_...` é secreta. Nunca coloque no frontend,
> no Git ou no chat. Ela só pode ser usada no servidor.

## 1. Rodar o schema

Se o banco está vazio, abra:

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
- `projects` — projetos com o JSON completo;
- `project_assets` — metadados das mídias;
- bucket privado `media` para os arquivos;
- políticas RLS: cada usuário só acessa os próprios dados;
- trigger que cria o perfil no primeiro login.

### Se o schema já rodou mas o app dá erro

Sintomas:

```text
permission denied for table projects
Bucket not found
```

Rode o complemento idempotente:

```text
supabase/fix-existing.sql
```

Ele garante permissões para `authenticated`, cria o bucket `media`, recria as
políticas e os triggers. Pode ser executado mais de uma vez.

## 2. Ativar login com Google

### 2.1 Google Cloud

1. Abra https://console.cloud.google.com/
2. Crie/selecione um projeto.
3. **APIs & Services → OAuth consent screen** (ou **Google Auth Platform →
   Branding**):
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

### 2.2 Supabase

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

## 3. Testar

Abra:

```text
http://localhost:3000
```

Clique em **Entrar com Gmail**.

## 4. O que já está implementado

- botão **Entrar com Gmail** na home e no editor;
- sessão persistente via Supabase Auth;
- avatar, nome, e-mail e botão **Sair**;
- schema, bucket e políticas;
- modo local continua funcionando sem login.

A sincronização já está implementada no botão **Nuvem** da home:

- envia para o Supabase os projetos locais mais novos;
- baixa para o navegador os projetos da nuvem mais novos;
- sobe as mídias para o bucket `media`, em `userId/projectId/assetId`;
- baixa as mídias que faltam ao abrir um projeto em outro computador;
- exclui a cópia na nuvem quando o projeto é apagado com a sessão ativa.

A primeira sincronização pode demorar se houver muitos vídeos, pois todos os
blobs serão enviados. As próximas pulam as mídias que já estão na nuvem.

## 5. Segurança

- A chave publicável é pública por design; a RLS protege os dados.
- A `service_role` ignora RLS; nunca vai para o navegador.
- Não versione `.env` (já está no `.gitignore`).
- Em produção, adicione o domínio real em Google OAuth e Supabase.
