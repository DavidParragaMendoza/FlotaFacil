# Plano de Teste

**Nome do Projeto:** Sistema de Apoio a Tomada de Decisão

### Pessoas Envolvidas / Responsabilidade
* **Usuário 2** - Criação de casos de testes e execução dos testes
* **Usuário 1** - Criação de casos de testes e execução dos testes

### Funcionalidades ou Módulos
Cadastro de clientes, classificação de dados e relatórios.

### Equipamentos / Softwares
O sistema deve funcionar em um servidor Web com acesso via browser.

### Cronograma
* **Data de Início e Fim do Projeto:** 01/08/2009 - 01/10/2010
* **Data de Início e Fim do Teste:** 01/02/2010 a 01/10/2010

### Local dos Testes
O sistema não possui um local para teste específico. Os mesmos serão executados nas máquinas das pessoas envolvidas em locais aleatórios.

### Critério para considerar o teste finalizado
O teste será considerado finalizado ao preencher a coluna resultado do teste do documento de caso de teste como "Executado com sucesso".

### Observações
* O relatório de incidente será enviado para todos os desenvolvedores por e-mail assim que alguma alteração tenha sido feita.
* Serão criados os casos de testes, os relatórios de incidentes e o relatório resumo de teste.

---

# Casos de Teste

**Nome do Projeto:** Sistema de Apoio a Tomada de Decisão

| ID | Módulo | Descrição | Roteiro | Resultado Esperado | Resultado do Desenvolvedor | Resultado do Teste |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| 1 | Alteração do Usuário | Alterar dados cadastrais do usuário | 1. Escolher a opção Listar Usuário<br>2. Clicar em alterar do usuário na lista | Exibir na lista de usuários cadastrados. | Usuário 2 - 15/02/2010<br>Executado com sucesso | Usuário 1 - 25/02/2010<br>Mostra um erro ao alterar usuário |
| 2 | Alteração do Usuário | Verificar a validação dos campos | 1. Escolher a opção Inserir Usuário<br>2. Enviar nome, email e senha em branco | Mensagem "Campo de preenchimento obrigatório" para os campos nome, senha e e-mail. | Usuário 2 - 15/02/2010<br>Executado com sucesso | Usuário 1 - 25/02/2010<br>Executado com sucesso |
| 3 | Alteração do Usuário | Verificar a validação dos campos | 1. Escolher a opção Inserir Usuário<br>2. Enviar senha com menos de 6 ou mais de 32 caracteres | Mostrar a mensagem "O valor fornecido para este campo não pode ter menos que $6$ e mais que $32$ caracteres" para o campo senha. | Usuário 2 - 15/02/2010<br>Executado com sucesso | Usuário 1 - 25/02/2010<br>O campo senha aceita menos de $6$ caracteres |
| 4 | Alteração do Usuário | Verificar a validação dos campos | 1. Escolher a opção Inserir Usuário<br>2. Enviar email inválido | Mostrar a mensagem "O e-mail informado não é válido". | Usuário 2 - 15/02/2010<br>Executado com sucesso | Usuário 1 - 25/02/2010<br>Executado com sucesso |

---

# Relatório de Incidente

**Nome do Projeto:** Sistema de Apoio a Tomada de Decisão

| ID | Status | Responsável pela correção | Prioridade de correção | Descrição do erro | Data e Nome de quem corrigiu |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 1 | Pronto para testar novamente | Usuário 2 | Alta | Mostra um erro ao alterar usuário | 01/03/2010 - Usuário 2 |
| 3 | Pronto para testar novamente | Usuário 2 | Alta | O campo senha aceita menos de $6$ caracteres | 14/03/2010 - Usuário 2 |
| 5 | Pronto para testar novamente | Usuário 1 | Baixa | No cabeçalho o nome do relatório está errado | 10/03/2010 - Usuário 1 |
| 8 | Aberto | Usuário 2 | Alta | Erro ao classificar dados | |

---

# Relatório de Resumo de Teste

* **Nome do Projeto:** Sistema de Apoio a Tomada de Decisão
* **Data início teste:** 01/02/2010
* **Data fim teste:** 01/10/2010

### Descrição
Com a criação dos casos de teste previamente facilitou a detecção e a correção dos erros. O relatório de incidência de teste demonstrou de forma clara a correção do programador e o momento certo para o retorno para equipe de teste, na qual foi realizado o teste novamente.

### Pessoas envolvidas
Usuário 1, Usuário 2 e Usuário 3

### Números dos testes

| Métrica | Quantidade |
| :--- | :--- |
| Casos de testes criados antes do teste | $30$ |
| Casos de testes criados durante o teste | $3$ |
| Casos de testes executados | $33$ |
| Casos de teste com sucesso | $20$ |
| Casos de teste com erro | $13$ |
| Casos de testes enviados para correção | $13$ |

### Percentual

| Métrica | Percentual |
| :--- | :--- |
| Casos de testes executados | $100\%$ |
| Casos de testes executados com sucesso | $66,67\%$ |
| Casos de testes com incidência de erro | $43,33\%$ |
| Casos de testes corrigidos pelo desenvolvedor | $100\%$ |