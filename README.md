# GAMPILON HUB

Site estático em português, sem instalação ou compilação. HTML, CSS e JavaScript nativos. Seis abas, biblioteca com pesquisa e paginação, conta, publicação, importação por ID, visualização X/Z e download JSON.

## Experimentar agora

Sirva esta pasta com um servidor HTTP (por exemplo, `npx serve .`) e abra o endereço informado. Não abra como `file://`: módulos JavaScript exigem HTTP. Sem configuração, três rotas de exemplo ficam disponíveis. Conta e publicação não são simuladas e exigem Supabase. A validação de JSON funciona sem credenciais.

## Publicar no repositório solicitado

1. Entre no GitHub e abra https://github.com/KerbHeh/gampilonhub.github.io.
2. Se já houver arquivos, guarde uma cópia antes de substituí-los. Envie **o conteúdo desta pasta** para a raiz da branch `main` usando Add file → Upload files. `index.html` deve ficar na raiz, sem pasta intermediária.
3. Em Settings → Pages, escolha **Deploy from a branch**, branch `main`, pasta `/ (root)`, e salve.
4. Aguarde o deployment do Pages e abra o endereço mostrado nas configurações. Para esse nome de repositório, ele normalmente será https://kerbheh.github.io/gampilonhub.github.io/ (o domínio raiz especial do usuário seria um repositório chamado `KerbHeh.github.io`).
5. Sem Supabase, a versão publicada continuará como demonstração. Nenhuma chave secreta é necessária para hospedar os arquivos.

## Ativar a biblioteca comunitária

1. Crie um projeto em https://supabase.com/dashboard.
2. No SQL Editor de um projeto **novo**, execute `supabase.sql` por completo. O script é uma migração inicial, não deve ser repetido em banco existente sem revisão. Ele não foi executado por este projeto.
3. Em Authentication, habilite o provedor de e-mail/senha e mantenha confirmação de e-mail ativa. Em URL Configuration, use a URL real do Pages como Site URL e adicione-a às Redirect URLs. Configure SMTP para entrega confiável de e-mails de confirmação.
4. Em Project Settings → API, copie a Project URL e a chave **pública anon ou publishable**. Edite `config.js`:

```js
window.GAMPILON_CONFIG = {
  SUPABASE_URL: 'https://SEU-PROJETO.supabase.co',
  SUPABASE_ANON_KEY: 'SUA-CHAVE-PUBLICA'
};
```

Essas são variáveis públicas carregadas pelo navegador. GitHub Pages não injeta variáveis de ambiente em execução; o arquivo é a configuração pública. Não insira `service_role`, `sb_secret_…`, senha do banco ou token GitHub. O site não precisa dessas credenciais. Publique novamente `config.js`.

5. Cadastre uma conta, confirme o e-mail, entre e publique o exemplo em Publicar Rota. A primeira inserção bem-sucedida recebe um ID formatado como #00001. A sequência é gerada pelo banco e pode conter lacunas após transações abortadas; não é um contador garantidamente contínuo.
6. Abra outro navegador: confira pesquisa, importação e download do mesmo ID. Teste um ID inexistente e a perda de conexão. Confira que usuário sem sessão não consegue executar `publish_route` e que insert/update/delete diretos são negados.

## Formato de dados v1

```json
{"version":1,"fps":60,"frames":[{"t":0,"position":[0,0,0],"rotation":[0,0,0]},{"t":1,"position":[4,2,1],"rotation":[0,0.5,0]}]}
```

Tempo em segundos, posição X/Y/Z nas unidades do jogo, rotação Euler X/Y/Z em radianos. Ordem de aplicação das rotações deve ser definida pelo importador do jogo. Entre 2 e 10.000 frames; FPS inteiro 1–240; t estritamente crescente entre 0 e 3600; componentes numéricos finitos até ±1.000.000. Campos adicionais são rejeitados. Limite conservador de 2 MB (o banco mede a representação JSONB textual e pode rejeitar um JSON compacto próximo ao teto).

**Compatibilidade:** esse é um contrato novo e documentado, pois não foi fornecido um formato de gravação existente. Importar aqui significa recuperar e baixar dados. Não há conexão automática com Roblox, execução de Luau ou garantia de compatibilidade com scripts antigos. Integre um importador confiável no seu próprio jogo para reproduzir os dados.

## Segurança e operação

- RLS ativa. Somente leitura pública das colunas da rota; `owner_id` não é disponibilizado pela API. Nenhum e-mail é salvo na tabela pública.
- Publicação somente pela função autenticada, que atribui o proprietário a partir da sessão e exige e-mail confirmado. Nome do autor é um apelido autodeclarado, não prova de identidade Roblox.
- Validação no cliente e no banco. Um envio por minuto e no máximo 30 por dia por usuário, com bloqueio transacional contra concorrência.
- Sem edição ou remoção pela API do navegador. O administrador pode moderar/remover rotas pelo painel do Supabase. Não há painel administrativo neste site.
- Textos de usuários são escapados antes de aparecer na página. CSP permite somente scripts locais e conexão com projetos `*.supabase.co`. Para domínio Supabase personalizado, ajuste `connect-src` no HTML.
- Sessão e refresh token somente em memória: recarregar encerra a sessão local. Senhas nunca são gravadas pelo aplicativo. Evite scripts de terceiros e mantenha confirmação de e-mail ativa.
- Configure limites do Auth, CAPTCHA e SMTP no Supabase conforme o público crescer. O limite por usuário não impede abuso com múltiplas contas. Monitore custos, cotas e retenção; não há garantia de plano gratuito permanente.
- Dados das rotas e nomes de autor são públicos. Não envie dados pessoais. O administrador deve estabelecer um canal de contato e regras de moderação antes de abrir a comunidade amplamente.

## Verificação

`node --test tests/validation.test.mjs` executa testes do contrato dos frames e IDs. Integração real de autenticação, banco e políticas exige configurar um projeto Supabase e executar os passos acima. SQL não foi validado contra um banco real sem credenciais.

Referências oficiais: https://supabase.com/docs/guides/database/postgres/row-level-security e https://supabase.com/docs/guides/auth/passwords.
