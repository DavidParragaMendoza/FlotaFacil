# Testes de integração do Notification Service

A suíte executa o processo real do `notification-service`, publica mensagens persistentes em `app.events` e verifica o RabbitMQ e o MailHog. Ela não substitui consumidor, transporte SMTP ou broker por mocks.

## Por que os testes ficam aqui

O fluxo começa no consumidor do `notification-service` e termina no envio SMTP. Por isso, `notification-service/tests` é o local adequado: o `core-service` publica os eventos, mas não implementa o consumo nem o envio.

## Guia passo a passo

1. Instale Node.js 22 ou mais recente.

2. Abra um terminal na pasta `notification-service` e instale as dependências:

   ```sh
   npm ci
   ```

3. Garanta que RabbitMQ com o plugin Management e MailHog estejam disponíveis na máquina. Os endereços padrão são:

   - RabbitMQ AMQP: `localhost:5672`
   - RabbitMQ Management: `localhost:15672`
   - MailHog SMTP: `localhost:1025`
   - MailHog API e interface: `localhost:8025`

   Veja os containers já ativos antes de criar outros:

   ```sh
   docker ps --format 'table {{.Names}}\t{{.Ports}}\t{{.Status}}'
   ```

   Se RabbitMQ e MailHog já estiverem nessas portas, reutilize-os. Caso contrário, inicie-os em terminais separados:

   ```sh
   docker run -d --name flota-test-rabbitmq \
     -p 5672:5672 -p 15672:15672 \
     -e RABBITMQ_DEFAULT_USER=admin \
     -e RABBITMQ_DEFAULT_PASS=admin \
     rabbitmq:3-management
   ```

   ```sh
   docker run -d --name flota-test-mailhog \
     -p 1025:1025 -p 8025:8025 \
     mailhog/mailhog
   ```

   Aguarde RabbitMQ iniciar. Acesse `http://localhost:15672` e `http://localhost:8025` para conferir o Management e o MailHog.

4. Configure `notification-service/.env` com as credenciais válidas do RabbitMQ e os endereços locais. Para os containers do exemplo acima:

   ```env
   RABBITMQ_AMQP_HOST=localhost
   RABBITMQ_AMQP_PORT=5672
   RABBITMQ_USER=admin
   RABBITMQ_PASS=admin
   SMTP_HOST=localhost
   SMTP_PORT=1025
   ```

   Não substitua credenciais reais por `admin/admin`; use esses valores somente se forem as credenciais do seu broker.

5. Rode a suíte na pasta `notification-service`:

   ```sh
   npm run test:integration
   ```

   Se RabbitMQ estiver em outros endereços, configure os URLs. Use as mesmas credenciais nos URLs AMQP e no `.env`:

   ```sh
   TEST_RABBITMQ_URL=amqp://usuario:senha@localhost:5672 \
   TEST_MAILHOG_URL=http://localhost:8025 \
   TEST_RABBITMQ_MANAGEMENT_URL=http://localhost:15672 \
   npm run test:integration
   ```

   O usuário RabbitMQ precisa ter permissão administrativa para criar um vhost, atribuir permissões e definir uma policy nele. Cada execução cria um vhost temporário, usa nele a exchange e a fila com os nomes reais e configura uma DLQ de teste para observar rejeições. Ao final, remove o vhost. Isso isola os testes de outras instâncias do Notification e evita que consumidores concorrentes retirem as mensagens; a policy não é aplicada ao vhost normal. Se a criação/configuração retornar HTTP 401/403, use credenciais de um usuário RabbitMQ com essas permissões.

6. Leia o resultado do Node no terminal. O caso de indisponibilidade SMTP inicia o processo com `SMTP_HOST=127.0.0.1` e `SMTP_PORT=1`. O caso de duplicidade fica como ignorado enquanto o serviço não declara suporte à idempotência. Para exigir essa garantia depois de implementá-la, rode com `NOTIFICATION_IDEMPOTENCY_SUPPORTED=true`.

7. Se você criou os containers do passo 3, remova apenas esses containers ao terminar:

   ```sh
   docker rm -f flota-test-rabbitmq flota-test-mailhog
   ```

## Sobre localhost e Docker

O processo de teste roda diretamente na máquina; por isso, ele usa `localhost` para acessar as portas publicadas pelo Docker. `host.docker.internal` é normalmente usado por um processo dentro de um container para alcançar a máquina host. O teste constrói o endereço AMQP do seu `TEST_RABBITMQ_URL` e passa o host e o vhost temporário ao Notification iniciado pela suíte.

## Estado atual do serviço

Executar a integração pode revelar falhas reais do código atual. `sendEmail` usa um IP fixo em vez de `SMTP_HOST`/`SMTP_PORT`, e o consumidor monta o corpo do email sem usar o campo `message`. O consumidor também não valida o formato do destinatário nem exige `data.requestId`. No tratamento de erros, o consumidor captura a exceção, mas não executa `nack`; por isso, os casos de rejeição para DLQ podem falhar até o serviço aplicar a política configurada. Esses casos expõem o comportamento do serviço, não são falhas causadas pelo uso de `localhost`.

## Escopo coberto

A suíte cobre evento válido com ACK e envio, destinatário inválido, ausência de destinatário/identificador, JSON inválido, duplicidade condicional, falha SMTP, persistência sem consumidor e correspondência de destinatário, assunto e corpo do email.
