import type { Cenario, CenarioPublico, ResultadoSQL } from './types.js';
import { ALVOS, ADMIN_SENHA, HASH_FRACO, md5 } from './seed.js';
import { celulas } from './engine.js';

const temCelula = (res: ResultadoSQL, alvo: string) => celulas(res).has(alvo);
const temAlguma = (res: ResultadoSQL, alvos: string[]) => {
  const c = celulas(res);
  return alvos.some((a) => c.has(a));
};
const AGREGADOS = ['count', 'avg', 'sum', 'min', 'max'];

// Cada cenário é um mini-app de uma empresa fictícia (Nimbus Corp), com várias telas: a
// interativa, mais páginas de contexto (fonte do código, fichas, FAQ, métricas, um chat
// interno). O conteúdo dá pistas e clima; o passo exato do ataque continua com o jogador
// (guiado pelos slides e pela dica paga). Nome e resumo são vagos de propósito; nada aqui
// imprime um segredo ou a resposta.
export const CENARIOS: Cenario[] = [
  {
    id: 1,
    nome: 'Sésamo',
    resumo: 'Entre no painel sem ser convidado.',
    premissa: 'Portal de acesso da Nimbus Corp.',
    objetivo: 'Entre como admin, sem saber a senha do admin.',
    dica: "A consulta vira ...WHERE login='x' AND senha='x'. E se a condição ficar sempre verdadeira? Pense em OR '1'='1 e no comentário --",
    dificuldade: 'facil',
    base: 100,
    tipo: 'auto',
    kind: 'login',
    revelaSQL: true,
    paginas: [
      { tipo: 'form', id: 'entrar', nome: 'Entrar', titulo: 'Portal Nimbus Corp', instrucao: 'Acesso restrito a funcionários. Entre com usuário e senha.' },
      {
        tipo: 'tiles', id: 'status', nome: 'Status', titulo: 'Status do sistema',
        cards: [
          { rotulo: 'Uptime', valor: '99.?%', sub: 'alguém reiniciou o servidor de novo' },
          { rotulo: 'Tickets abertos', valor: '142', sub: 'ninguém sabe por quê' },
          { rotulo: 'Deploys hoje', valor: '3', sub: 'nenhum testado' },
          { rotulo: 'Online agora', valor: '14', sub: 'funcionários' },
        ],
      },
      {
        tipo: 'codigo', id: 'fonte', nome: 'Fonte', titulo: 'Como o login foi escrito', linguagem: 'python',
        codigo: [
          'usuario = request.form["usuario"]',
          'senha   = request.form["senha"]',
          '',
          'sql = "SELECT login, papel FROM usuarios " + \\',
          '      "WHERE login=\'" + usuario + "\' " + \\',
          '      "AND senha=\'" + senha + "\'"',
        ],
        nota: 'Sim, concatenado na mão. O que a sua entrada vira dentro das aspas, o banco executa.',
      },
      {
        tipo: 'texto', id: 'avisos', nome: 'Avisos', titulo: 'Bem-vindo',
        corpo: [
          'Este é o cenário de aquecimento: na tela Entrar, de graça, você vê a consulta final que o sistema monta. Os outros cenários não entregam a consulta de bandeja.',
          'Dica de casa: leia a aba Fonte e repare onde a sua entrada cai na consulta.',
        ],
      },
      {
        tipo: 'lista', id: 'chat', nome: 'Chat', titulo: '#geral',
        itens: [
          { de: 'rh_bot', txt: 'lembrete: a senha do admin segue a política de senha forte da empresa' },
          { de: 'dev_junior', txt: 'quem escreveu esse login concatenando string direto no SQL' },
          { de: 'estagiario', txt: 'pergunta: o que acontece se a condição do WHERE for sempre verdadeira?' },
          { de: 'sr_sistemas', txt: 'não discute vulnerabilidade aqui no geral, abre um ticket' },
        ],
      },
      {
        tipo: 'faq', id: 'ajuda', nome: 'Ajuda', titulo: 'Perguntas frequentes',
        qa: [
          { q: 'Esqueci minha senha.', a: 'Procure o admin. (O admin não responde há dias.)' },
          { q: 'Posso entrar sem conta?', a: 'Oficialmente não. Oficialmente.' },
        ],
      },
    ],
    montarSQL: (e) =>
      `SELECT login, papel FROM usuarios WHERE login='${e['usuario'] ?? ''}' AND senha='${e['senha'] ?? ''}'`,
    conferir: (res, e) => {
      const virouAdmin = res.linhas.some((l) => String(l['papel']) === ALVOS.papelAdmin);
      const legitima = e['usuario'] === 'admin' && e['senha'] === ADMIN_SENHA;
      return virouAdmin && !legitima;
    },
  },
  {
    id: 2,
    nome: 'O departamento vizinho',
    resumo: 'A busca só mostra o seu time. Será?',
    premissa: 'O diretório de funcionários insiste em te mostrar só o seu setor.',
    objetivo: 'Faça a busca devolver alguém de outro departamento.',
    dica: 'A busca filtra ...AND depto=5. Com OR 1=1 e comentando o resto da linha com -- você derruba o filtro e traz todo mundo.',
    dificuldade: 'medio',
    base: 200,
    tipo: 'auto',
    kind: 'busca',
    paginas: [
      { tipo: 'form', id: 'buscar', nome: 'Buscar', titulo: 'Diretório de funcionários', instrucao: 'Procure um funcionário pelo nome.' },
      {
        tipo: 'ficha', id: 'cracha', nome: 'Meu crachá', titulo: 'Seu crachá',
        campos: [
          { rotulo: 'Nome', valor: 'Você' },
          { rotulo: 'Setor', valor: '5 - Engenharia' },
          { rotulo: 'Crachá', valor: '#ENG-05' },
          { rotulo: 'Acesso', valor: 'apenas o seu setor' },
        ],
      },
      {
        tipo: 'tabela', id: 'organograma', nome: 'Organograma', titulo: 'Setores da empresa',
        colunas: ['Depto', 'Área'],
        linhas: [['5', 'Engenharia (o seu)'], ['7', 'Financeiro (sempre atrasado com reembolso)'], ['9', 'Diretoria (ninguém do resto da empresa já subiu lá)']],
        nota: 'A busca só lista o seu setor. Os outros existem, mas não aparecem por aqui.',
      },
      {
        tipo: 'codigo', id: 'fonte', nome: 'Fonte', titulo: 'Como a busca foi escrita',
        codigo: [
          'nome = request.args["nome"]',
          'sql  = "SELECT nome, depto FROM funcionario " + \\',
          '       "WHERE nome=\'" + nome + "\' AND depto=5"',
        ],
        nota: 'Tem um AND depto=5 grudado no fim. E se a sua entrada mandasse o banco ignorar o resto da linha?',
      },
      {
        tipo: 'lista', id: 'chat', nome: 'Fofoca', titulo: '#corredor',
        itens: [
          { de: 'ana', txt: 'por que a busca só mostra o depto 5? queria ver o pessoal do 7' },
          { de: 'beto', txt: 'dá pra enganar o filtro: só colocar uma condição que sempre vale e cortar o resto da linha' },
          { de: 'ana', txt: 'tipo deixar sempre verdadeiro e mandar o banco ignorar o que vem depois?' },
          { de: 'beto', txt: 'isso mesmo. não conta pra ninguém que eu te disse' },
        ],
      },
    ],
    montarSQL: (e) => `SELECT nome, depto FROM funcionario WHERE nome='${e['nome'] ?? ''}' AND depto=5`,
    conferir: (res) => temAlguma(res, ALVOS.nomesForaDaView),
  },
  {
    id: 3,
    nome: 'O cofre',
    resumo: 'Há coisas guardadas que a tela nunca mostra.',
    premissa: 'Diretório de funcionários. Mas nem tudo que a empresa guarda fica à vista.',
    objetivo: 'Leia o conteúdo da tabela segredos.',
    dica: 'A busca devolve 2 colunas. Com UNION SELECT você escolhe de qual tabela elas vêm, inclusive da tabela segredos.',
    dificuldade: 'medio',
    base: 250,
    tipo: 'auto',
    kind: 'busca',
    paginas: [
      { tipo: 'form', id: 'buscar', nome: 'Buscar', titulo: 'Diretório de funcionários', instrucao: 'Procure um funcionário pelo nome.' },
      {
        tipo: 'texto', id: 'mural', nome: 'Mural', titulo: 'Mural interno',
        corpo: [
          'Comunicado da diretoria: centralizamos os códigos e chaves sensíveis num cofre digital, numa tabela só para isso, chamada segredos.',
          'O conteúdo do cofre nunca deve aparecer numa tela comum. Se aparecer, é falha grave de segurança.',
        ],
      },
      {
        tipo: 'codigo', id: 'esquema', nome: 'Esquema', titulo: 'Tabelas da base',
        linguagem: 'sql',
        codigo: [
          'funcionario(id, nome, cpf, salario, depto, desempenho, classe)',
          'usuarios(id, login, senha, papel, senha_hash)',
          'segredos(chave, valor)   -- a nova, da migracao',
        ],
        nota: 'A busca devolve 2 colunas. A tabela segredos tem... 2 colunas. Coincidência?',
      },
      {
        tipo: 'ficha', id: 'cofre', nome: 'Cofre', titulo: 'Sobre o cofre',
        campos: [
          { rotulo: 'Tabela', valor: 'segredos' },
          { rotulo: 'Colunas', valor: 'chave, valor' },
          { rotulo: 'Acesso em tela', valor: 'proibido' },
          { rotulo: 'Observação', valor: 'nunca deve vazar' },
        ],
      },
      {
        tipo: 'lista', id: 'chat', nome: 'Thread', titulo: '#backend',
        itens: [
          { de: 'dev_pleno', txt: 'dá pra colar uma segunda consulta no fim da busca e escolher de onde vêm as colunas' },
          { de: 'dev_junior', txt: 'espera, isso é permitido aqui?' },
          { de: 'dev_pleno', txt: 'permitido não, possível sim' },
          { de: 'sec_ofc', txt: 'lembrete: este canal é monitorado' },
        ],
      },
    ],
    montarSQL: (e) => `SELECT nome, depto FROM funcionario WHERE nome='${e['nome'] ?? ''}' AND depto=5`,
    conferir: (res) => temCelula(res, ALVOS.segredo),
  },
  {
    id: 4,
    nome: 'Fora da vista',
    resumo: 'A tela escolheu o que te mostrar.',
    premissa: 'Diretório de funcionários que mostra pouco de cada um.',
    objetivo: 'Descubra o salário de um funcionário.',
    dica: 'A tela só mostra nome e depto. Com UNION SELECT dá para colocar o salário no lugar de uma dessas colunas.',
    dificuldade: 'medio',
    base: 200,
    tipo: 'auto',
    kind: 'busca',
    paginas: [
      { tipo: 'form', id: 'buscar', nome: 'Buscar', titulo: 'Diretório de funcionários', instrucao: 'Procure um funcionário. A tela mostra nome e departamento.' },
      {
        tipo: 'texto', id: 'politica', nome: 'Política', titulo: 'Dados confidenciais',
        corpo: [
          'O salário de cada funcionário é confidencial, por isso não aparece na busca.',
          'A tela foi feita para exibir apenas nome e departamento. O dado continua lá na tabela, só não é selecionado.',
        ],
      },
      {
        tipo: 'ficha', id: 'tabela', nome: 'Tabela', titulo: 'Tabela funcionario',
        campos: [
          { rotulo: 'Colunas', valor: 'id, nome, cpf, salario, depto, desempenho, classe' },
          { rotulo: 'Exibidas na busca', valor: 'nome, depto' },
          { rotulo: 'Escondidas', valor: 'o resto (inclusive salario)' },
        ],
        nota: 'O salário existe na tabela. A busca só não pede por ele.',
      },
      {
        tipo: 'codigo', id: 'fonte', nome: 'Fonte', titulo: 'Como a busca foi escrita',
        codigo: [
          'nome = request.args["nome"]',
          'sql  = "SELECT nome, depto FROM funcionario " + \\',
          '       "WHERE nome=\'" + nome + "\' AND depto=5"',
        ],
        nota: 'Duas colunas no SELECT. Nada impede você de dizer quais duas colunas quer ver.',
      },
      {
        tipo: 'tabela', id: 'amostra', nome: 'Amostra', titulo: 'O que a busca costuma mostrar',
        colunas: ['Nome', 'Depto'],
        linhas: [['Ana Prado', '5'], ['Beto Lima', '5']],
        nota: 'Só nome e depto. O resto a tela guarda para ela.',
      },
      {
        tipo: 'lista', id: 'chat', nome: 'Comentários', titulo: '#offtopic',
        itens: [
          { de: 'curioso', txt: 'queria ver o salário de alguém, a coluna existe mas não aparece na tela' },
          { de: 'colega2', txt: 'troca uma das colunas que a busca devolve pela coluna do salário' },
          { de: 'curioso', txt: 'e isso realmente funciona?' },
          { de: 'colega2', txt: 'funciona' },
        ],
      },
    ],
    montarSQL: (e) => `SELECT nome, depto FROM funcionario WHERE nome='${e['nome'] ?? ''}' AND depto=5`,
    conferir: (res) => temAlguma(res, ALVOS.salarios),
  },
  {
    id: 5,
    nome: 'A média de um',
    resumo: 'Só estatística. Nada individual. Certo?',
    premissa: 'Um painel que promete só soltar estatística, nunca entregar ninguém.',
    objetivo: 'Descubra a renda exata de uma pessoa, usando só consultas agregadas.',
    dica: 'Ache um filtro com COUNT(*)=1 (Ph.D., F, Curitiba, PR) e peça AVG(renda): a média de uma pessoa só é a renda dela.',
    dificuldade: 'dificil',
    base: 400,
    tipo: 'resposta',
    kind: 'stats',
    paginas: [
      { tipo: 'form', id: 'consultar', nome: 'Consultar', titulo: 'Painel estatístico', instrucao: 'Escolha uma agregação e uma condição. Só agregados são permitidos.' },
      {
        tipo: 'tiles', id: 'visao', nome: 'Visão geral', titulo: 'Números do painel',
        cards: [
          { rotulo: 'Pessoas', valor: '7', sub: 'na base' },
          { rotulo: 'Cidades', valor: '3', sub: 'Curitiba, São Paulo, Campinas' },
          { rotulo: 'Grupos minúsculos', valor: 'existem', sub: 'cuidado com eles' },
          { rotulo: 'Privacidade', valor: '?', sub: 'veja a aba Metodologia' },
        ],
      },
      {
        tipo: 'tabela', id: 'dicionario', nome: 'Dicionário', titulo: 'Colunas da tabela pessoa',
        colunas: ['Coluna', 'Descrição'],
        linhas: [
          ['id', 'identificador interno'], ['nome', 'nome da pessoa'], ['renda', 'renda mensal'],
          ['cidade', 'cidade'], ['estado', 'UF'], ['escolaridade', 'maior titulação'], ['sexo', 'F ou M'],
        ],
        nota: 'O painel só divulga estatística de grupo, nunca uma linha individual.',
      },
      {
        tipo: 'texto', id: 'metodologia', nome: 'Metodologia', titulo: 'Como lemos os números',
        corpo: [
          'Divulgamos apenas agregados (contagens, médias, somas) sobre populações.',
          'Uma população é o conjunto de pessoas que satisfazem uma condição. Quanto mais específica a condição, menor a população.',
          'E se a população tiver uma pessoa só? Aí a média dessa população é, na prática, ela.',
        ],
      },
      {
        tipo: 'faq', id: 'regras', nome: 'Regras', titulo: 'Perguntas frequentes',
        qa: [
          { q: 'Posso ver a renda de uma pessoa?', a: 'Não. Só agregados sobre grupos.' },
          { q: 'E se eu filtrar até sobrar uma pessoa?', a: 'Então o agregado é sobre uma pessoa só. Pois é.' },
        ],
      },
      {
        tipo: 'lista', id: 'chat', nome: 'Dilema', titulo: '#compliance',
        itens: [
          { de: 'analista', txt: 'se eu filtrar bem específico até sobrar 1 pessoa, o AVG entrega a renda dela' },
          { de: 'compliance', txt: 'isso é tecnicamente permitido e eticamente problemático' },
          { de: 'analista', txt: 'tipo juntar escolaridade, sexo e cidade até o COUNT dar 1' },
          { de: 'compliance', txt: 'para com isso antes que vire um caso no jurídico' },
        ],
      },
    ],
    validar: (e) => {
      const base = String(e['agregado'] ?? '').replace(/\(.*$/, '').trim().toLowerCase();
      return AGREGADOS.includes(base)
        ? null
        : 'Banco estatístico: só são permitidas funções de agregação (COUNT, AVG, SUM, MIN, MAX).';
    },
    montarSQL: (e) =>
      `SELECT ${e['agregado'] ?? 'COUNT(*)'} AS resultado FROM pessoa WHERE ${(e['onde'] ?? '').trim() || '1=1'}`,
    conferirResposta: (v) => Number(String(v).replace(/[.,\s]/g, '')) === ALVOS.rendaJane,
  },
  {
    id: 6,
    nome: 'O elo fraco',
    resumo: 'Uma conta antiga guardou mais do que devia.',
    premissa: 'Busca interna de uma base cheia de contas antigas migradas.',
    objetivo: 'Descubra, em texto puro, a senha da conta estagiario.',
    dica: 'Vaze o senha_hash do usuário estagiario (UNION na busca). É um MD5 sem sal de uma senha trivial: teste as campeãs de pior senha.',
    dificuldade: 'dificil',
    base: 400,
    tipo: 'resposta',
    kind: 'busca',
    paginas: [
      { tipo: 'form', id: 'buscar', nome: 'Buscar', titulo: 'Busca interna', instrucao: 'Procure um registro pelo nome.' },
      {
        tipo: 'tabela', id: 'contas', nome: 'Contas', titulo: 'Diretório de contas',
        colunas: ['Login', 'Papel', 'Status'],
        linhas: [
          ['admin', 'admin', 'ativa'], ['suporte', 'suporte', 'ativa'],
          ['estagiario', 'leitor', 'migrada (guardamos só o hash)'],
        ],
        nota: 'Nenhuma senha aparece aqui. Contas migradas guardam apenas o hash.',
      },
      {
        tipo: 'codigo', id: 'registro', nome: 'Registro', titulo: 'Como fica uma conta migrada',
        linguagem: 'sql',
        codigo: [
          '-- tabela usuarios',
          "login='estagiario', papel='leitor',",
          "senha=NULL, senha_hash='<md5 da senha antiga>'",
        ],
        nota: 'A senha em texto some na migração. Fica só o senha_hash, um MD5 sem sal.',
      },
      {
        tipo: 'ficha', id: 'padrao', nome: 'Padrão', titulo: 'Padrão de senha antigo',
        campos: [
          { rotulo: 'Formato', valor: 'numérico' },
          { rotulo: 'Tamanho', valor: '6 dígitos' },
          { rotulo: 'Força', valor: 'péssima' },
          { rotulo: 'Fama', valor: 'está em qualquer lista de senhas mais usadas' },
        ],
      },
      {
        tipo: 'texto', id: 'migracao', nome: 'Migração', titulo: 'Contas antigas',
        corpo: [
          'Contas antigas foram migradas. Delas, o sistema guarda apenas o hash da senha (MD5, sem sal), nunca o texto.',
          'Se a senha antiga for fraca, o hash não segura nada. E ainda tem gente usando a senha mais óbvia possível.',
        ],
      },
      {
        tipo: 'lista', id: 'chat', nome: 'Grupo', titulo: '#ti-legado',
        itens: [
          { de: 'ti_legado', txt: 'o estagiario usava a senha mais óbvia que existe, a que todo tutorial manda não usar' },
          { de: 'estagiario', txt: 'minha senha era segura, tinha até número' },
          { de: 'ti_legado', txt: 'isso não é senha, é um convite' },
          { de: 'dev', txt: 'vaza o senha_hash dele com um UNION e procura o hash num site qualquer' },
        ],
      },
    ],
    montarSQL: (e) => `SELECT nome, depto FROM funcionario WHERE nome='${e['nome'] ?? ''}'`,
    conferirResposta: (v) => v.trim() === ALVOS.senhaFraca || md5(v.trim()) === HASH_FRACO,
  },
  {
    id: 7,
    nome: 'Confidencial',
    resumo: 'Uma linha foi marcada como secreta.',
    premissa: 'Diretório de funcionários com registros classificados.',
    objetivo: 'Leia o desempenho da linha marcada como secreta.',
    dica: 'A tela esconde a linha de classe S. Com UNION SELECT nome, desempenho FROM funcionario você vê o que ela não mostra.',
    dificuldade: 'dificil',
    base: 350,
    tipo: 'auto',
    kind: 'busca',
    paginas: [
      { tipo: 'form', id: 'buscar', nome: 'Buscar', titulo: 'Diretório de funcionários', instrucao: 'Procure um funcionário pelo nome.' },
      {
        tipo: 'texto', id: 'classificacao', nome: 'Classificação', titulo: 'Níveis de classificação',
        corpo: [
          'Cada registro tem um nível. Registros de nível S (secreto) são ocultados das telas comuns.',
          'A busca já filtra os registros de nível S para que não apareçam no resultado. A tela filtra, mas a consulta nem sempre.',
        ],
      },
      {
        tipo: 'codigo', id: 'fonte', nome: 'Fonte', titulo: 'O filtro da busca',
        codigo: [
          'nome = request.args["nome"]',
          'sql  = "SELECT nome, depto FROM funcionario " + \\',
          '       "WHERE nome=\'" + nome + "\' AND depto=5 " + \\',
          '       "AND classe<>\'S\'"',
        ],
        nota: 'O "AND classe<>S" só vale pra linha de base. Uma segunda consulta colada não passa por ele.',
      },
      {
        tipo: 'ficha', id: 'oculto', nome: 'Registro oculto', titulo: 'O registro que some',
        campos: [
          { rotulo: 'Nível', valor: 'S (secreto)' },
          { rotulo: 'Campo sensível', valor: 'desempenho' },
          { rotulo: 'Visível na tela', valor: 'não' },
        ],
      },
      {
        tipo: 'tabela', id: 'auditoria', nome: 'Auditoria', titulo: 'Trilha de acessos',
        colunas: ['Quando', 'Evento', 'Alvo'],
        linhas: [
          ['09:14', 'leitura', 'registro comum'],
          ['09:20', 'leitura negada', 'registro de nível S'],
          ['09:21', 'leitura negada', 'registro de nível S'],
        ],
        nota: 'Existe pelo menos um registro de nível S que a interface insiste em esconder.',
      },
      {
        tipo: 'lista', id: 'chat', nome: 'Denúncia', titulo: '#anon',
        itens: [
          { de: 'anon', txt: 'tem uma linha marcada como secreta que ninguém consegue ver o desempenho' },
          { de: 'anon2', txt: 'dá pra montar a consulta do seu jeito e trazer até o que a tela esconde' },
          { de: 'anon', txt: 'teve uma auditoria sobre isso semana passada, ninguém explicou direito' },
          { de: 'anon2', txt: 'e continua sem resposta até hoje' },
        ],
      },
    ],
    montarSQL: (e) =>
      `SELECT nome, depto FROM funcionario WHERE nome='${e['nome'] ?? ''}' AND depto=5 AND classe<>'S'`,
    conferir: (res) => temCelula(res, ALVOS.desempenhoClassificado),
  },
  {
    id: 8,
    nome: 'A ordem dos fatores',
    resumo: 'Você só pode ordenar a lista. Só?',
    premissa: 'Relatório de uma equipe, com ordenação à sua escolha.',
    objetivo: 'Prove que o campo de ordenação aceita SQL, não só o nome de uma coluna.',
    dica: 'O relatório faz ORDER BY <sua entrada>. Parâmetro troca valor, não nome de coluna: tente ordenar por número de coluna (2) ou por um CASE.',
    dificuldade: 'medio',
    base: 250,
    tipo: 'auto',
    kind: 'relatorio',
    paginas: [
      { tipo: 'form', id: 'relatorio', nome: 'Relatório', titulo: 'Relatório do depto 5', instrucao: 'Gere o relatório e escolha por qual coluna ordenar.' },
      {
        tipo: 'texto', id: 'ajuda', nome: 'Ajuda', titulo: 'Sobre a ordenação',
        corpo: [
          'O relatório lista nome e departamento e pode ser ordenado.',
          'Normalmente você ordena por nome ou por departamento.',
        ],
      },
      {
        tipo: 'codigo', id: 'fonte', nome: 'Fonte', titulo: 'O relatório por dentro',
        codigo: [
          'ordem = request.args["ordem"]   # ex.: nome',
          'sql   = "SELECT nome, depto FROM funcionario " + \\',
          '        "WHERE depto=5 ORDER BY " + ordem',
        ],
        nota: 'A ordenação vai concatenada, sem parametrizar. Parâmetro troca valor, não a ordenação.',
      },
      {
        tipo: 'faq', id: 'duvidas', nome: 'Dúvidas', titulo: 'Perguntas frequentes',
        qa: [
          { q: 'Por que ordenar por coluna?', a: 'Para deixar a lista do seu jeito.' },
          { q: 'Dá pra por outra coisa ali?', a: 'Tecnicamente, o que você digita vira parte da consulta...' },
        ],
      },
      {
        tipo: 'lista', id: 'chat', nome: 'Code review', titulo: '#pull-requests',
        itens: [
          { de: 'revisor', txt: 'você concatenou a ordenação direto na query?' },
          { de: 'autor', txt: 'funciona' },
          { de: 'revisor', txt: 'funciona pro atacante também. dá pra abusar do ORDER BY de um jeito que nenhum valor legítimo faria' },
          { de: 'autor', txt: 'vou corrigir ainda hoje' },
        ],
      },
    ],
    montarSQL: (e) => {
      const col = (e['ordem'] ?? '').trim() === '' ? 'nome' : e['ordem'];
      return `SELECT nome, depto FROM funcionario WHERE depto=5 ORDER BY ${col}`;
    },
    conferir: (res, e) => {
      const ordem = String(e['ordem'] ?? '');
      const limpo = ordem.trim().toLowerCase();
      const permitido = limpo === 'nome' || limpo === 'depto' || limpo === '';
      const temCodigo = /[\s()]|--|\|\||^\d+$|case|select/i.test(ordem);
      return !permitido && temCodigo && res.erro === null;
    },
  },
];

export const CENARIO_POR_ID = new Map(CENARIOS.map((c) => [c.id, c]));

export function publico(c: Cenario): CenarioPublico {
  const { id, nome, resumo, premissa, objetivo, dificuldade, base, tipo, kind, paginas } = c;
  return { id, nome, resumo, premissa, objetivo, dificuldade, base, tipo, kind, paginas, revelaSQL: !!c.revelaSQL };
}

export const CENARIOS_PUBLICOS: CenarioPublico[] = CENARIOS.map(publico);
