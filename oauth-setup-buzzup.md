# Login com Google e Apple no BuzzUp

O frontend usa `supabase.auth.signInWithOAuth` e retorna para `/welcome`. Contas sociais são validadas pelo próprio provedor e não passam pela confirmação de e-mail do cadastro por senha.

## URLs do projeto

- Site URL: `https://usebuzzup.com.br`
- Redirect de produção: `https://usebuzzup.com.br/welcome`
- Redirect local: `http://localhost:8080/welcome`
- Redirect local alternativo: `http://127.0.0.1:8080/welcome`
- Callback do Supabase: `https://twwcnudhfvzbkdrtfmtu.supabase.co/auth/v1/callback`

Adicione as três URLs de retorno em **Supabase > Authentication > URL Configuration > Redirect URLs**.

## Google

1. No Google Auth Platform, crie um cliente OAuth do tipo **Web application**.
2. Em **Authorized JavaScript origins**, adicione `https://usebuzzup.com.br`.
3. Em **Authorized redirect URIs**, adicione o callback do Supabase informado acima.
4. No Supabase, abra **Authentication > Sign In / Providers > Google**.
5. Ative o provedor e informe o Client ID e o Client Secret do Google.

## Apple

1. Na conta Apple Developer, crie ou use um App ID com **Sign in with Apple**.
2. Crie um Services ID para o site e vincule-o ao App ID.
3. Configure `twwcnudhfvzbkdrtfmtu.supabase.co` como domínio e o callback do Supabase como Return URL.
4. Gere uma chave de assinatura e o Client Secret da Apple.
5. No Supabase, abra **Authentication > Sign In / Providers > Apple** e informe Services ID e Client Secret.
6. Agende a rotação do Client Secret a cada seis meses, exigida pela Apple para OAuth web.

Nunca salve Client Secrets no repositório ou em variáveis `VITE_*`.
