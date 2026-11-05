**INSTITUTO FEDERAL DE EDUCAÇÃO, CIÊNCIA E TECNOLOGIA DO RIO GRANDE DO NORTE**  
**CAMPUS PAU DOS FERROS**  
BR 405, KM 154, Chico Cajá

---

# Descrição do Projeto Integrador de Desenvolvimento de Sistemas Corporativos - Teste de Software

## APRESENTAÇÃO
O objetivo deste documento é orientar as equipes na estruturação da qualidade de software ao longo do desenvolvimento do projeto corporativo. Testes em ambientes corporativos não são feitos de forma improvisada; eles exigem planejamento formal, métricas claras e automação integrada ao ciclo de vida de desenvolvimento (CI/CD).

---

## 1ª ENTREGA - PLANEJAMENTO E ARQUITETURA DE TESTES
Nesta etapa, o foco é o design, a especificação e o planejamento estratégico da qualidade. Como o código estrutural ainda está sendo concebido no escopo corporativo, os artefatos desta entrega devem ser estritamente documentais e metodológicos.

### 1. Escopo e Pirâmide de Testes
* **Delimitação do Escopo:** Defina claramente o que será testado (ex.: regras de negócio críticas, fluxos de mensageria, segurança via Keycloak) e o que não será escopo de teste nesta versão.
* **Pirâmide de Testes:** Apresente a proporção adotada pela equipe (base maior de testes unitários, camada intermediária de integração/mensageria e topo enxuto de testes ponta a ponta/UI). Justifique as escolhas baseadas na arquitetura de microsserviços.

### 2. Ferramentas e Infraestrutura de Teste
* **Stack Tecnológica:** Liste as ferramentas escolhidas para cada nível (ex.: Jest ou Pytest para unitários; Cypress, Selenium ou Playwright para interface/sistema; K6 ou Locust para testes de carga).
* **Integração Contínua (CI):** Explique como o pipeline do GitHub Actions foi configurado para disparar a validação automática a cada commit ou Pull Request.

### 3. Critérios de Entrada (Entry Criteria) e de Saída (Exit Criteria)
A equipe deve definir formalmente as condições que permitem iniciar e encerrar cada fase de teste:

#### 3.1. Testes Unitários:
* **Critérios de Entrada:** Código da funcionalidade commitado na branch de desenvolvimento; pipeline base configurado e compilando.
* **Critérios de Saída:** $100\%$ dos testes unitários passando; cobertura de código (code coverage) mínima estipulada pela equipe (ex: $80\%$).

#### 3.2. Testes de Integração e Mensageria (Filas e Broker):
* **Critérios de Entrada:** Ambientes de infraestrutura inicializados via Docker Compose (banco de dados, broker de mensagens, MinIO); contratos de API definidos.
* **Critérios de Saída:** Cenários de publicação e consumo de filas validados, com evidências do tratamento de falhas e redirecionamento para a Dead Letter Queue (DLQ).

#### 3.3. Testes de Carga e Desempenho (Planejamento):
* **Critérios de Entrada:** Endpoints críticos mapeados; parâmetros de estresse definidos (ex.: volumetria esperada de requisições simultâneas).
* **Critérios de Saída:** Cenários de teste de carga estruturados e prontos para execução na fase final.

### 4. Casos de Teste Iniciais
* **Derivação de Requisitos:** Apresente uma tabela inicial contendo IDs, descrição, pré-condições, passos de execução e resultados esperados derivados diretamente das histórias de usuário priorizadas.

---

## 2ª ENTREGA - EXECUÇÃO, QUALIDADE, CARGA E RESILIÊNCIA
Nesta etapa, o sistema estará em pleno funcionamento em ambiente de produção/staging. A avaliação medirá a robustez técnica, a eficácia da automação e a resiliência do microsserviço diante de falhas e estresse.

### 1. Execução da Pirâmide de Testes e Cobertura
* **Relatórios de Cobertura:** Apresentar os relatórios gerados pelas ferramentas (Pytest, Jest, etc.) comprovando o percentual de cobertura de código alcançado.
* **Testes de Sistema / E2E:** Demonstração prática dos fluxos críticos de negócio utilizando ferramentas de automação web (Cypress, Playwright ou Selenium) apontando para a URL de produção.

### 2. Validação de Resiliência e Arquitetura Distribuída
* **Testes de Mensageria:** Simulação e evidência de falha no consumidor da fila. O relatório deve demonstrar o comportamento do sistema, a retenção/redirecionamento para a DLQ e o posterior mecanismo de reprocessamento.
* **Testes de Carga, Escalabilidade e Monitoramento:**
  * Execução de testes de estresse (via K6 ou Locust).
  * Comparativo prático de desempenho entre $1$ instância versus $N$ instâncias do microsserviço.
  * Identificação e explicação técnica do gargalo encontrado, utilizando os painéis do Grafana para correlacionar o uso de CPU, memória e latência.

### 3. Métricas Avançadas de Qualidade
* **Teste de Mutação:** Aplicação de ferramentas de mutação na suíte de testes. A equipe deve apresentar e defender o escore de mutação obtido (indicando o quão sensíveis e eficientes são os casos de teste criados).
* **Teste de Regressão e Análise de Falhas:**
  * Efetuar propositalmente uma alteração/quebra em uma funcionalidade existente do sistema.
  * Executar a suíte de regressão automatizada.
  * Reportar métricas formais: Quantos casos de teste falharam? Qual foi a porcentagem em relação ao total da suíte?

### 4. Governança e CI/CD Consolidado
* **Pipeline Completo:** Pipeline de CI/CD em pleno funcionamento executando automaticamente o build, análise estática de código, suíte completa de testes e o deploy final.
* **Documentação de Encerramento:** Relatório de incidentes encontrados durante os testes e resumo executivo consolidado da qualidade do produto entregue.