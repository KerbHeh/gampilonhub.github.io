# GAMPILON HUB — formato v2 e identidade Roblox

Site: https://kerbheh.github.io/gampilonhub.github.io/

## Estado atual

- Biblioteca conectada ao Supabase; dados anteriores preservados.
- Formato aceito: **GAMPILON_ROUTE_JSON versão 2**, conforme o JSON fornecido pelo usuário.
- Conta por e-mail removida da interface. Login oficial Roblox preparado com PKCE; **provedor custom:roblox ativado para testes**.
- Aplicativo OAuth criado pelo titular. Provedor custom:roblox habilitado com openid/profile, e-mail opcional e retorno ao GitHub Pages. Aplicativo Roblox em modo privado, limitado a testes. O segredo fica somente no Supabase.
- Toda rota importada aparece como **Autoria não verificada**. Compatibilidade do formato não prova autoria.
- `mkv1`, código executável, versão 1 e formatos desconhecidos são rejeitados sem execução.

## Contrato de dados

```json
{"format":"GAMPILON_ROUTE_JSON","version":2,"name":"Rota exemplo","samples":[{"CF":[0,0,0,1,0,0,0,1,0,0,0,1],"Velocity":[1,0,0],"Time":0,"State":"Running"},{"CF":[1,0,0,1,0,0,0,1,0,0,0,1],"Velocity":[1,0,0],"Time":1,"State":"Running"}]}
```

CF contém os 12 componentes de CFrame: três de posição e nove da matriz de rotação, sem converter para Euler. Velocity contém três componentes, Time é medido em segundos e State é um estado reconhecido de Humanoid. Campos adicionais são rejeitados. Até 2 MB, entre 2 e 10.000 amostras, tempo estritamente crescente de 0 a 3600 s, posições e velocidades até ±1.000.000, componentes da matriz até ±1,001. O banco mede o tamanho da representação JSONB textual e pode rejeitar arquivos compactos muito próximos ao limite.

O arquivo real fornecido contém 142 amostras e passou na validação local. O conteúdo original não está incluído neste repositório. O arquivo mkv1 enviado foi rejeitado como esperado.

## Banco

Projeto existente: aplique `migration-v2.sql` uma vez. Instalação nova: execute `supabase.sql`. A migração existente já foi aplicada no projeto do HUB. Não repita scripts sem revisar o estado do banco.

`routes.publisher_roblox_id` identifica a conta de publicação; `authorship_status` permanece `unverified`. A função `publish_route` consulta `auth.identities` e exige o provedor `custom:roblox`; não usa nomes declarados, `p_author`, e-mail ou `user_metadata` editável como prova. A coluna author é derivada da identidade do provedor. Não existe ainda mecanismo de certificação da gravação.

RLS ativa, leitura pública somente das colunas da rota, nenhum acesso público a owner_id. Gravação direta negada. Publicação por função autenticada, um envio por minuto e 30 por dia por conta. Sessões antigas de e-mail não habilitam publicação. Rotas antigas não são convertidas nem apagadas automaticamente; formatos incompatíveis não podem ser importados pelo cliente v2.

## Ativar Entrar com Roblox

1. O titular precisa cumprir a verificação de identidade exigida pelo Roblox. Não envie documentos, senha, cookie ou código para o HUB ou para o chat.
2. No Creator Hub → OAuth 2.0 Apps, registre um aplicativo do HUB. A criação de credenciais e a aceitação de termos devem ser feitas/autorizadas pelo titular.
3. Solicite somente `openid profile`. Não solicite e-mail nem permissões de inventário, compras ou edição.
4. No Supabase → Authentication → Sign In / Providers → Custom Providers, prepare um provedor OIDC `custom:roblox`. Use discovery URL `https://apis.roblox.com/oauth/.well-known/openid-configuration`, deixe a validação do nonce e PKCE ativadas e marque `email_optional: true`.
5. Copie a Callback URL exibida pelo Supabase e cadastre-a como redirect URI do aplicativo Roblox. Guarde o client secret **apenas no provedor Supabase**, nunca em config.js, no GitHub ou em Luau.
6. Configure no Supabase o redirect do site `https://kerbheh.github.io/gampilonhub.github.io/`.
7. Só depois de criar/habilitar o provedor, altere `ROBLOX_AUTH_ENABLED` para `true` em config.js. Os demais valores de config.js são URL e chave pública.
8. Teste autorização, retorno PKCE, perfil Roblox correto, publicação, recarga, renovação e saída. O login depende de configuração e não foi testado de ponta a ponta sem o app OAuth.
9. Para ampliar o público, cumpra as regras de revisão/publicação do Roblox. Um aplicativo em modo privado tem limites próprios.

A interface nunca pede senha Roblox. A sessão Supabase fica no armazenamento local do navegador conforme a preferência do usuário. Tokens do provedor não são persistidos pelo aplicativo. O verificador PKCE fica temporariamente em sessionStorage e o código de retorno é removido da URL antes da troca.

## Formato proposto kerebus\Az()

O prefixo é um identificador público, não criptografia nem prova de autoria. O site ainda não aceita esse formato. O prompt entregue propõe um envelope de dados assinado por um serviço confiável, com chaves privadas fora do cliente e origem de gravação comprovada. Dados importados sem assinatura nunca devem receber autoria verificada.

## Testes

`node --test validation.test.mjs`: contrato v2, rejeição de mkv1 e campos forjados, vetores, estados, tempos, identidade e PKCE. Testes reais do banco confirmaram aceitação de v2 e rejeição de formato nulo, dados nulos e campos forjados. Nenhuma rota de teste foi publicada no banco.

## Publicar

GitHub Pages: arquivos na raiz da branch main, deploy a partir de `/ (root)`. Sirva via HTTP para testes locais. config.js contém somente configurações públicas; nunca use service_role ou sb_secret. Atualize a versão dos módulos no HTML/imports quando publicar mudanças para evitar cache antigo.

Referências oficiais:
- https://create.roblox.com/docs/cloud/auth/oauth2-overview
- https://create.roblox.com/docs/cloud/auth/oauth2-registration
- https://supabase.com/docs/guides/auth/custom-oauth-providers


