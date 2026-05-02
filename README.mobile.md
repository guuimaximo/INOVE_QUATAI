# Inove Mobile Shell

Esta aplicacao agora usa a mesma base web do Inove para alimentar:

- o site
- a PWA instalada no navegador
- o app Android/iPhone via Capacitor

## Comandos

- `npm run build`
- `npm run cap:sync`
- `npm run cap:android`
- `npm run cap:ios`

## Fluxo

1. Ajuste o frontend web normalmente
2. Gere o build com `npm run build`
3. Sincronize com `npm run cap:sync`
4. Abra o projeto nativo desejado

Mudancas de interface continuam centralizadas nesta mesma aplicacao React.
