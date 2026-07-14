# E-mails do BuzzUp — confirmação de conta e recuperação de senha

O código novo já está pronto: cadastro pede confirmação de senha e, ao criar a
conta, mostra a tela "Confirme seu e-mail". Para os e-mails saírem de
**contato@usebuzzup.com.br** com as mensagens personalizadas abaixo, faça estas
configurações no painel do Supabase (projeto `twwcnudhfvzbkdrtfmtu`).

---

## 1) Remetente próprio (SMTP) — contato@usebuzzup.com.br

O Supabase só envia de um domínio seu se você plugar um provedor de e-mail.
Recomendação: **Resend** (grátis até 3.000 e-mails/mês) ou Brevo.

1. Crie a conta no provedor e **verifique o domínio `usebuzzup.com.br`**
   (o provedor mostra 2–3 registros DNS — SPF e DKIM — para adicionar onde o
   domínio está registrado, ex.: Registro.br/Cloudflare).
2. No provedor, gere as credenciais SMTP.
3. No Supabase: **Authentication → SMTP Settings** (em "Emails") → **Enable Custom SMTP**:
   - Sender email: `contato@usebuzzup.com.br`
   - Sender name: `BuzzUp`
   - Host / Port / Username / Password: os do provedor
     (Resend: host `smtp.resend.com`, porta `465`, user `resend`, senha = API key)
4. Em **Authentication → Rate Limits**, ajuste "emails per hour" se precisar
   (com SMTP próprio o limite é seu, o padrão de 30/h costuma bastar).

## 2) Ligar a confirmação de e-mail

**Authentication → Sign In / Providers → Email** → ative **"Confirm email"**.

> Importante: só ative DEPOIS que o deploy novo estiver no ar (já está, se você
> está lendo isso depois do push) e o SMTP configurado — senão o e-mail sai do
> remetente padrão do Supabase.

## 2b) Tempo de validade do link (deixe em pelo menos 10 minutos)

O link de confirmação/redefinição vale pelo tempo do **Email OTP Expiration**.
Em **Authentication → Sign In / Providers → Email** (role até "Email OTP
Expiration"), deixe **3600** (1 hora, padrão) ou no mínimo **600** (10 min).
Nunca deixe abaixo de 600.

> Se aparecer "link expirado" mesmo com tempo alto, quase sempre é uma destas
> causas — e não o tempo:
> - **O link já foi usado.** Cada link vale UMA vez. Peça um novo "esqueci a
>   senha"; use sempre o e-mail mais recente.
> - **Antivírus/varredura de e-mail abriu o link antes de você** (comum em
>   e-mail corporativo/Outlook), consumindo o token. Abra o link num navegador
>   normal, ou peça um novo e clique rápido.
> - Você testou com um link antigo de antes do último deploy.

## 3) URLs de redirecionamento

**Authentication → URL Configuration**:
- Site URL: `https://buzzup0.vercel.app`
- Redirect URLs (adicionar TODAS — sem a de `/email-confirmado` o link de
  confirmação cai na raiz e entra direto no app, em vez de mostrar a tela
  "E-mail confirmado"):
  - `https://buzzup0.vercel.app/email-confirmado`
  - `https://buzzup0.vercel.app/welcome`
  - `https://buzzup0.vercel.app/reset-password`
  - `http://localhost:8080/email-confirmado`
  - `http://localhost:8080/welcome`
  - `http://localhost:8080/reset-password`

## 4) Templates personalizados

**Authentication → Email Templates**. Cole cada HTML no template correspondente.

### 4a) "Confirm signup" — confirmação de existência do e-mail

Assunto sugerido: `Confirme seu e-mail para ativar sua conta no BuzzUp 🚀`

```html
<table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f2f7f9;padding:32px 12px;font-family:Arial,Helvetica,sans-serif;">
  <tr><td align="center">
    <table width="480" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e3edf1;">
      <tr>
        <td style="background:linear-gradient(135deg,#00B4D8,#063b5d);background-color:#00B4D8;padding:28px 32px;text-align:center;">
          <span style="font-size:26px;font-weight:800;color:#ffffff;letter-spacing:-0.5px;">BuzzUp</span>
        </td>
      </tr>
      <tr>
        <td style="padding:36px 32px 8px;">
          <h1 style="margin:0 0 12px;font-size:22px;color:#0f2a3a;">Falta pouco! 🎉</h1>
          <p style="margin:0 0 8px;font-size:15px;line-height:1.6;color:#40565f;">
            Que bom ter você no <strong>BuzzUp</strong>! Para ativar sua conta e
            começar a organizar as demandas da sua entidade, confirme que este
            e-mail é seu clicando no botão abaixo.
          </p>
        </td>
      </tr>
      <tr>
        <td style="padding:20px 32px 8px;" align="center">
          <a href="{{ .ConfirmationURL }}"
             style="display:inline-block;background-color:#00B4D8;color:#ffffff;font-size:16px;font-weight:700;text-decoration:none;padding:15px 40px;border-radius:999px;">
            Confirmar meu e-mail
          </a>
        </td>
      </tr>
      <tr>
        <td style="padding:20px 32px 8px;">
          <p style="margin:0;font-size:12px;line-height:1.6;color:#8ba0a8;">
            Se o botão não funcionar, copie e cole este link no navegador:<br>
            <a href="{{ .ConfirmationURL }}" style="color:#00B4D8;word-break:break-all;">{{ .ConfirmationURL }}</a>
          </p>
        </td>
      </tr>
      <tr>
        <td style="padding:20px 32px 32px;">
          <p style="margin:0;font-size:12px;line-height:1.6;color:#8ba0a8;">
            Não foi você que criou esta conta? Pode ignorar este e-mail com
            tranquilidade — nada será ativado sem a confirmação.
          </p>
        </td>
      </tr>
      <tr>
        <td style="background-color:#f7fafb;padding:16px 32px;text-align:center;border-top:1px solid #e3edf1;">
          <span style="font-size:11px;color:#9db1b8;">BuzzUp · Gestão da sua entidade na palma da mão · contato@usebuzzup.com.br</span>
        </td>
      </tr>
    </table>
  </td></tr>
</table>
```

### 4b) "Reset password" — esquecimento de senha

Assunto sugerido: `Redefinir sua senha do BuzzUp 🔐`

```html
<table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f2f7f9;padding:32px 12px;font-family:Arial,Helvetica,sans-serif;">
  <tr><td align="center">
    <table width="480" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e3edf1;">
      <tr>
        <td style="background:linear-gradient(135deg,#00B4D8,#063b5d);background-color:#00B4D8;padding:28px 32px;text-align:center;">
          <span style="font-size:26px;font-weight:800;color:#ffffff;letter-spacing:-0.5px;">BuzzUp</span>
        </td>
      </tr>
      <tr>
        <td style="padding:36px 32px 8px;">
          <h1 style="margin:0 0 12px;font-size:22px;color:#0f2a3a;">Esqueceu a senha? Acontece! 🔐</h1>
          <p style="margin:0 0 8px;font-size:15px;line-height:1.6;color:#40565f;">
            Recebemos um pedido para redefinir a senha da sua conta no
            <strong>BuzzUp</strong>. Clique no botão abaixo para criar uma senha
            nova — o link vale por 1 hora.
          </p>
        </td>
      </tr>
      <tr>
        <td style="padding:20px 32px 8px;" align="center">
          <a href="{{ .ConfirmationURL }}"
             style="display:inline-block;background-color:#00B4D8;color:#ffffff;font-size:16px;font-weight:700;text-decoration:none;padding:15px 40px;border-radius:999px;">
            Criar nova senha
          </a>
        </td>
      </tr>
      <tr>
        <td style="padding:20px 32px 8px;">
          <p style="margin:0;font-size:12px;line-height:1.6;color:#8ba0a8;">
            Se o botão não funcionar, copie e cole este link no navegador:<br>
            <a href="{{ .ConfirmationURL }}" style="color:#00B4D8;word-break:break-all;">{{ .ConfirmationURL }}</a>
          </p>
        </td>
      </tr>
      <tr>
        <td style="padding:20px 32px 32px;">
          <p style="margin:0;font-size:12px;line-height:1.6;color:#8ba0a8;">
            <strong>Não pediu a troca de senha?</strong> Ignore este e-mail —
            sua senha atual continua valendo e ninguém consegue alterá-la sem
            este link.
          </p>
        </td>
      </tr>
      <tr>
        <td style="background-color:#f7fafb;padding:16px 32px;text-align:center;border-top:1px solid #e3edf1;">
          <span style="font-size:11px;color:#9db1b8;">BuzzUp · Gestão da sua entidade na palma da mão · contato@usebuzzup.com.br</span>
        </td>
      </tr>
    </table>
  </td></tr>
</table>
```

---

## Como fica o fluxo depois de tudo configurado

1. **Criar conta**: nome + e-mail + senha + **confirmar senha** (o app valida
   se as senhas batem antes de enviar).
2. Se o e-mail **já existe** → aviso "E-mail já cadastrado. Tente fazer login."
3. Se é novo → conta criada **pendente** e tela "Confirme seu e-mail" com botão
   de reenviar. O e-mail chega de `contato@usebuzzup.com.br`.
4. A pessoa clica em **Confirmar meu e-mail** → entra direto no `/welcome`.
5. **Esqueci a senha** → e-mail de `contato@usebuzzup.com.br` com o botão
   "Criar nova senha" → página `/reset-password` do app.

> Segurança extra incluída: o endpoint antigo `/api/signup` (que criava contas
> já confirmadas por fora) foi desativado — agora retorna 410.
