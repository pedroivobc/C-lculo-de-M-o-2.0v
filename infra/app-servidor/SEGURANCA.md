# Segurança no servidor da Clemente (antes do lançamento)

Passos para rodar no console do servidor (ClementeServidor). Nenhum deles pede para colar chave ou senha em chat:
as senhas são digitadas só no próprio terminal.

## 1. Painéis do n8n e da Evolution com usuário e senha (nginx)

Hoje `n8n.vps.clementeassessoria.cloud` e `evolution.vps.clementeassessoria.cloud` respondem para qualquer IP.
A ideia: os acessos internos (o próprio servidor e os containers) continuam passando direto; quem vem de fora
precisa de usuário e senha antes de chegar ao painel. Os webhooks do n8n (`/webhook/...`) continuam abertos,
porque a Evolution e outros serviços chamam por eles.

### 1.1 Achar os arquivos do nginx dos dois domínios

```bash
grep -rl "n8n.vps.clementeassessoria.cloud\|evolution.vps.clementeassessoria.cloud" /etc/nginx/
```

### 1.2 Ver de que IP o n8n chama a Evolution (antes de fechar)

O fluxo do agente manda as respostas para `https://evolution.vps.clementeassessoria.cloud/message/...`.
Mande uma mensagem de teste ao agente no WhatsApp e rode:

```bash
grep "/message/" /var/log/nginx/access.log | tail -5 | awk '{print $1}'
```

O primeiro campo de cada linha é o IP de origem. Normalmente é `2.24.79.129` (o próprio servidor) ou um
`172.x.x.x` (rede do Docker); os dois já estão liberados abaixo. Se aparecer outro, acrescente um `allow` com ele.

### 1.3 Criar o usuário e a senha do painel

```bash
sudo sh -c 'printf "pedro:%s\n" "$(openssl passwd -apr1)" > /etc/nginx/.senha-paineis'
sudo chmod 640 /etc/nginx/.senha-paineis && sudo chown root:www-data /etc/nginx/.senha-paineis
```

O `openssl` pede a senha duas vezes no terminal. Use uma senha longa e diferente do login do n8n.

### 1.4 Arquivo com as regras (uma vez só)

```bash
sudo tee /etc/nginx/snippets/painel-restrito.conf > /dev/null <<'NGINX'
# Interno passa direto; de fora, usuário e senha.
satisfy any;
allow 127.0.0.1;
allow ::1;
allow 2.24.79.129;
allow 172.16.0.0/12;
deny all;
auth_basic "Area restrita";
auth_basic_user_file /etc/nginx/.senha-paineis;
NGINX
```

### 1.5 Ligar nos dois domínios

No arquivo da **Evolution** (achado no 1.1), dentro do bloco `server { ... }` do HTTPS (o que tem `listen 443`),
logo acima do `location / {`, acrescente:

```nginx
    include snippets/painel-restrito.conf;
```

No arquivo do **n8n**, acrescente o mesmo `include` dentro do `location / { ... }` e crie, ao lado dele, um bloco só
para os webhooks (copie para dentro dele as mesmas linhas `proxy_pass` e `proxy_set_header` que já existem no
`location /`):

```nginx
    location /webhook/ {
        # webhooks continuam abertos (sem o include)
        proxy_pass http://127.0.0.1:5678;   # use o mesmo endereço do location / existente
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
```

Se o `location /` do n8n tiver linhas de websocket (`Upgrade`/`Connection`), deixe-as como estão.

### 1.6 Testar e aplicar

```bash
sudo nginx -t && sudo systemctl reload nginx
```

Conferir:

1. Abrir `https://n8n.vps.clementeassessoria.cloud` no navegador: deve pedir usuário e senha antes da tela do n8n.
2. Abrir `https://evolution.vps.clementeassessoria.cloud/manager`: idem.
3. Mandar uma mensagem ao agente no WhatsApp: a resposta tem de chegar normalmente.
4. Se a resposta não chegar, `tail -20 /var/log/nginx/access.log | grep " 401 "` mostra o IP barrado;
   acrescente um `allow` com ele no arquivo do 1.4 e rode o 1.6 de novo.

Para desfazer: apague as linhas `include snippets/painel-restrito.conf;` e recarregue o nginx.

## 2. Conferir o tamanho das chaves no .env (sem mostrar o valor)

```bash
cd /opt/orcaai/infra/app-servidor
awk -F= '/^(AGENT_API_KEY|VERIFICACAO_SEGREDO|EVOLUTION_API_KEY)=/{print $1, length($2), "caracteres"}' .env
```

Cada uma deve ter **64 caracteres ou mais** e ser diferente das outras. `VERIFICACAO_SEGREDO` vazio faz o app
usar a `AGENT_API_KEY` no lugar; defina um valor próprio.

Para trocar uma chave curta:

```bash
openssl rand -hex 32   # gera 64 caracteres; copie direto para o .env no editor (nano .env)
```

- `AGENT_API_KEY`: trocar no `.env` **e** no header `x-agent-key` do nó HTTP do fluxo do agente no n8n
  (depois clicar em Publish). Depois rodar o deploy.
- `VERIFICACAO_SEGREDO`: só no `.env`. Códigos de confirmação do WhatsApp ainda não usados deixam de valer.
- `EVOLUTION_API_KEY`: é a `AUTHENTICATION_API_KEY` da Evolution; trocar nos dois lugares e no n8n de uma vez.

Chave do n8n (`N8N_ENCRYPTION_KEY`), no container do n8n:

```bash
docker ps --format '{{.Names}}' | grep -i n8n
docker exec <nome-do-container-n8n> sh -c 'printf %s "$N8N_ENCRYPTION_KEY" | wc -c'
```

Se der `0`, o n8n usa a chave que ele mesmo gerou no volume (`/home/node/.n8n/config`): não troque sem antes
exportar as credenciais, porque trocar a chave invalida as credenciais salvas.

Nada disso vai para o git: o `.env` já fica fora do repositório.

## 3. Trava de assinatura

No `.env` do app, `EXIGIR_ASSINATURA=true` trava o site **e** a API (cálculo, arquivo do orçamento e exportação)
para quem não tem plano liberado. Depois de mudar, rode o deploy (o valor entra no build do site).

## 4. Se alguma tela quebrar por causa da CSP

O app agora manda a Content-Security-Policy. Se algo do site parar de carregar (imagem, login), dá para desligar só
a CSP enquanto se corrige: `CSP_DESLIGADA=sim` no `.env` e `docker compose up -d` (sem `--build`).
