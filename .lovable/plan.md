

# Plano: Exibir nome do workspace no header

## Resumo
Mostrar o `displayName` do usuário (definido na criação da conta) ao lado do ícone de notificações no header, tanto no desktop quanto no mobile.

## Mudanças

### `src/components/AppLayout.tsx`

**Desktop** — No header (barra superior), adicionar o `displayName` à esquerda do ícone de notificações:
```
[Search] .................. [WorkspaceName | Bell | ...]
```

**Mobile** — No header fixo do topo, adicionar o `displayName` entre o logo "MktFlow" e os ícones:
```
[MktFlow] ... [WorkspaceName | Bell | Logout]
```

Nenhuma mudança no banco de dados ou em outros arquivos.

