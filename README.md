# Caça às vulnerabilidades (MC536)

Jogo de sala de aula no estilo "resolva o desafio" com placar ao vivo. O aluno entra com um nome, vê uma
**lista de cenários** e, ao abrir um, cai num ambiente simulado próprio onde precisa reproduzir
a falha de segurança daquele cenário. O apresentador controla início e fim por um painel com chave.
Placar em tempo real.

- **frontend/**: Angular, mobile-first (os alunos entram pelo celular via QR)
- **backend/**: Node + Socket.IO; cada jogador recebe um SQLite **em memória por cenário**
  (`node:sqlite`), então a injeção é real, isolada por cenário e um aluno não atrapalha o outro.

## Como funciona

- A lista mostra só um **nome vago** e uma frase de cada cenário. Você não sabe de cara qual é a falha.
- Dentro do cenário há a premissa, o ambiente (login, busca, estatística ou relatório) e o SQL que o app monta.
- Reproduza a falha: o servidor detecta sozinho (ou, nos cenários de dedução, você envia a resposta).
- Cada cenário tem uma **dica paga** opcional (custa parte dos pontos).
- Pontos = base por dificuldade + bônus de rapidez + bônus para a primeira pessoa a achar.

## Os 8 cenários (um por tema da aula)

| # | Nome (pista vaga) | Falha | Tema |
|---|---|---|---|
| 1 | Sésamo | login sem senha (`admin'--`) | Injeção de SQL |
| 2 | O departamento vizinho | furar o filtro de linhas (`' OR 1=1--`) | Injeção / visões |
| 3 | O cofre | `UNION SELECT ... FROM segredos--` | Conta super-privilegiada |
| 4 | Fora da vista | vazar coluna escondida (salário) por `UNION` | Visões |
| 5 | A média de um | dedução estatística (`COUNT=1` depois `AVG`) | BD estatístico |
| 6 | O elo fraco | vazar e quebrar hash MD5 sem sal | Hash de senha |
| 7 | Confidencial | ler a linha de classe S por `UNION` | MAC / rótulos |
| 8 | A ordem dos fatores | injeção no `ORDER BY` | Injeção em identificador |

## Rodar com Docker (recomendado)

```bash
docker compose up --build
```

A porta e a chave do admin estão fixas no `docker-compose.yml` (sem `.env`, repositório privado).
Para trocar, edite direto o `environment:` do arquivo.

O `--build` compila o frontend e o backend **dentro do container** (nada é compilado na sua máquina).
Use sempre `--build` depois de mexer no código, para o container recompilar o front.

Alunos em `http://SEU_IP:7125`, apresentador em `http://SEU_IP:7125/admin`.

## Rodar sem Docker (desenvolvimento)

```bash
# 1) backend  (porta 3000)
cd backend && npm install && npm run dev

# 2) frontend (porta 4200; fala com o backend na 3000 por WebSocket)
cd frontend && npm install && npm start
```

Jogador em `http://localhost:4200`, apresentador em `http://localhost:4200/admin`.
Chave padrão do admin: `lucas123miranda` (defina `ADMIN_KEY` no ambiente do backend para trocar).

## Fluxo da aula

1. Abra `/admin`, entre com a chave, escolha a duração (~20 min).
2. Projete o `/admin`: a grade enche ao vivo (uma coluna por cenário).
3. Clique em **Iniciar**. Os alunos resolvem; o placar atualiza sozinho.
4. **Encerrar** (ou o tempo acaba) e o ranking final aparece para todos.
5. **Resetar** zera tudo para outra turma.

## Gabarito e linha de raciocínio (uso do professor)

Uso interno: este arquivo fica no repositório, não em nenhuma tela que o aluno acesse, mas
não cole estes payloads em nada que a turma possa ver (slide, chat da aula, etc.) antes do jogo
acabar: eles entregam a resposta pronta, sem o raciocínio.

Cada payload abaixo foi conferido automaticamente contra o motor do jogo (ver auditoria em
`backend/`), então nunca deve divergir do que o jogo aceita de verdade. Se você mudar algo em
`scenarios.ts`, revise esta seção.

### 1. Sésamo (fácil, 100 pts, tema: injeção de SQL no login)

**Objetivo:** entrar no portal com o papel de admin, sem saber a senha do admin.

**Gabarito:** usuário `admin'--` (senha qualquer), ou `' OR '1'='1'--` em qualquer um dos dois campos.

**Linha de raciocínio:** este é o único cenário que mostra o SQL montado (aba Fonte). A pessoa
precisa ler que a consulta é `...WHERE login='<usuario>' AND senha='<senha>'` e perceber que
tudo o que ela digita entra dentro das aspas. `admin'--` fecha a aspa do login, e `--` comenta
o resto da linha (inclusive o `AND senha=...`), deixando a consulta como
`WHERE login='admin'`. Corresponde ao slide "Entrar sem saber a senha" (30.4), que usa
`x' OR 'x'='x` como senha: a mesma ideia, aplicada em outro ponto de entrada.

### 2. O departamento vizinho (médio, 200 pts, tema: injeção / visões)

**Objetivo:** fazer a busca devolver um funcionário que não é do departamento 5 (o seu).

**Gabarito:** nome = `' OR 1=1--`

**Linha de raciocínio:** a aba Fonte revela `...WHERE nome='<nome>' AND depto=5`. A pessoa
precisa concluir duas coisas: (a) uma condição sempre verdadeira depois do `OR` faz o filtro de
nome não importar mais; (b) ainda sobra o `AND depto=5` depois dela, então precisa comentá-lo
com `--`. O organograma (aba Organograma) serve só para mostrar que existem outros
departamentos a descobrir. Mesma técnica do slide "Como nasce uma injeção" (30.4), aplicada a
um filtro em vez de um login.

### 3. O cofre (médio, 250 pts, tema: conta super-privilegiada / UNION)

**Objetivo:** ler o conteúdo da tabela `segredos`, que nenhuma tela do app deveria mostrar.

**Gabarito:** nome = `x' UNION SELECT chave, valor FROM segredos--` (resultado esperado:
`cofre` e `COFRE-9F3A-2025`)

**Linha de raciocínio:** a busca sempre devolve 2 colunas. A aba Esquema mostra que a tabela
`segredos` também tem exatamente 2 colunas (`chave, valor`): o número de colunas do
`UNION SELECT` precisa bater com o da consulta original, senão dá erro de sintaxe. A ideia de
"a conta do app vê tabelas que a tela não deveria mostrar" é o slide "Na web, o usuário é o
aplicativo" (30.3) combinado com o novo slide "Ler outras tabelas: UNION" (30.4).

### 4. Fora da vista (médio, 200 pts, tema: visões / colunas escondidas)

**Objetivo:** descobrir o salário de um funcionário, coluna que a busca nunca exibe.

**Gabarito:** nome = `x' UNION SELECT nome, salario FROM funcionario--`

**Linha de raciocínio:** a ficha da tabela (aba Tabela) mostra que `funcionario` tem a coluna
`salario`, mas a busca só pede `nome, depto`. A pessoa troca uma das duas colunas do
`SELECT` original por `salario` via `UNION`. É o mesmo exemplo do slide de UNION (o salário
no lugar do depto), e mostra por que uma visão (slide 30.2, "Visões como mecanismo de
autorização") só esconde dado na consulta pretendida, não numa consulta diferente colada
por injeção.

### 5. A média de um (difícil, 400 pts, tema: banco de dados estatístico)

**Objetivo:** descobrir a renda exata de uma pessoa específica (Jane Silva), usando só
consultas agregadas (o painel nunca entrega uma linha individual).

**Gabarito, em duas consultas na aba Consultar:**
1. `COUNT(*)` com `escolaridade='Ph.D.' AND sexo='F' AND cidade='Curitiba'`: resultado `1`
2. `AVG(renda)` com a mesma condição: resultado `17350` (a renda da única pessoa do grupo)

**Resposta a enviar:** `17350` (também aceita `17.350`; **não** aceita `17350,00` nem
`R$ 17.350,00`: é só o número, sem separador de centavos nem símbolo de moeda).

**Linha de raciocínio:** é exatamente o exemplo do slide "Só agregados, por favor" (30.5): o
painel só permite `COUNT/AVG/SUM/MIN/MAX` (a aba Consultar recusa qualquer outra coisa), mas
nada impede uma condição tão específica que a população vire 1 pessoa. Aí a "média do grupo"
é, na prática, o dado individual. A aba Dicionário dá as colunas disponíveis para montar a
condição (escolaridade, sexo, cidade); a pessoa precisa primeiro achar uma combinação com
`COUNT(*)=1` antes de pedir o `AVG`.

### 6. O elo fraco (difícil, 400 pts, tema: hash de senha sem sal)

**Objetivo:** descobrir, em texto puro, a senha da conta `estagiario`.

**Gabarito, em duas etapas:**
1. Nome = `x' UNION SELECT login, senha_hash FROM usuarios--`, revela entre outras linhas
   `estagiario` com o hash `e10adc3949ba59abbe56e057f20f883e`
2. Resposta a enviar: `123456` (a senha em texto puro; **não** a resposta final aceitar o hash colado de volta)

**Linha de raciocínio:** a tabela Contas diz que contas migradas "guardam só o hash", e a
Migração explica que é MD5 sem sal. O hash `e10adc39...` é, de propósito, o MD5 mais famoso
que existe (o de `123456`), reconhecível de cabeça por quem já viu uma lista de vazamentos, ou
achável em segundos em qualquer site de consulta de hash (rainbow table). É o contraponto
direto do slide "E as senhas? Hash com sal" (30.7): sem sal e com senha fraca, o hash não
protege nada.

### 7. Confidencial (difícil, 350 pts, tema: MAC / segurança por linha)

**Objetivo:** ler o campo `desempenho` da linha classificada como secreta (classe S), que a
busca normal esconde.

**Gabarito:** nome = `x' UNION SELECT nome, desempenho FROM funcionario--`, revela entre
outras linhas `Edu Sá` com o desempenho `TOP-SECRET-A7`

**Linha de raciocínio:** a aba Classificação diz que a consulta "normal" já tem um
`AND classe<>'S'` embutido (confirmado na aba Fonte), ou seja, o filtro está na consulta
pretendida pelo app, não imposto pelo SGBD. Uma segunda consulta colada por `UNION` não passa
por esse `AND`, porque ele só se aplica à primeira metade da consulta. É a diferença entre
MAC de verdade (regra imposta pelo banco, como em 30.3) e um filtro de aplicação que parece
seguro até alguém injetar ao lado dele.

### 8. A ordem dos fatores (médio, 250 pts, tema: injeção em identificador)

**Objetivo:** provar que o campo "Ordenar por" aceita SQL de verdade, não só o nome de uma
coluna (qualquer entrada que não seja `nome`, `depto` ou vazia, e que mude a consulta, conta).

**Gabarito:** campo "Ordenar por" = `2` (ordena pela 2ª coluna do `SELECT`). Também funciona
qualquer expressão não trivial, como `(CASE WHEN 1=1 THEN nome ELSE depto END)`.

**Linha de raciocínio:** a aba Fonte mostra `ORDER BY` mais a entrada colada sem nenhum
tratamento. O slide "Como se proteger" (30.4) é explícito: parâmetro troca **valor**, nunca
**nome de coluna nem a ordenação**. Por isso `ORDER BY` não dá para proteger só com
comandos parametrizados, precisa de uma lista fixa de colunas permitidas no código. Pedir um
número de posição (em vez de `nome`/`depto`) ou uma expressão como `CASE` prova que o campo
aceita SQL de verdade, não só o nome de uma coluna.

## Testes

```bash
cd backend && npm run test:e2e
```

Sobe o servidor e exercita, de ponta a ponta, todas as funções (entrar, ação por cenário, resposta,
dica, resetar ambiente, admin) e cada um dos 8 cenários, além de pontuação, first-blood, dica paga e placar.
