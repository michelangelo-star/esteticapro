# Logos do sistema

Arquivos servidos em `/logos/<nome>`. Onde cada um é usado:

| Arquivo | Uso |
|---|---|
| `VPBeauty-logo-cores-transparente.svg` | Marca completa, fundo transparente, para fundo claro — modais de login e redefinição de senha (`Logo` em `src/App.js`) |
| `VPBeauty-icone-fundo-ameixa.svg` | Ícone em tile ameixa — cabeçalhos, menu lateral, área da afiliada, painel admin, landing (`LogoMark` em `src/App.js`) |
| `VPBeauty-logo-fundo-claro.svg` / `VPBeauty-logo-fundo-ameixa.svg` | Variantes com tile de fundo, disponíveis para impressos ou materiais externos |
| `VPBeauty-logo-clara-transparente.svg` / `VPBeauty-icone-claro-transparente.svg` | Variantes para fundo escuro (o sistema hoje não tem fundo escuro) |
| `VPBeauty-icone-cores-transparente.svg` / `VPBeauty-icone-fundo-claro.svg` | Variantes de ícone para fundo claro, sem ou com tile |

Os ícones do navegador e do app instalado (`public/favicon.ico`, `public/logo192.png`, `public/logo512.png`) foram gerados a partir de `VPBeauty-icone-fundo-ameixa.svg`. Se a logo mudar, gere-os de novo a partir do SVG.
