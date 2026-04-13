

# Plan: Desativar verificação de e-mail no cadastro

## Resumo
Ativar auto-confirmação de e-mail para que o usuário possa criar conta e fazer login imediatamente, sem precisar verificar o e-mail.

## Mudanças

1. **Configurar auto-confirm no backend** — Usar a ferramenta `configure_auth` para ativar `auto_confirm_email: true`, permitindo login imediato após cadastro.

2. **Atualizar LoginPage.tsx** — Alterar a mensagem de sucesso no cadastro de "Verifique seu e-mail para confirmar" para algo como "Conta criada! Entrando..." e fazer login automático logo após o signup.

## Detalhes técnicos
- Chamar `cloud--configure_auth` com `auto_confirm_email: true`
- No `signUp`, após sucesso, chamar `signIn` automaticamente para logar o usuário direto
- Remover a mensagem sobre verificação de e-mail

