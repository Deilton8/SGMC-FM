/**
 * =====================================================================
 * UTILITÁRIOS PARTILHADOS — Utilitarios.gs
 * =====================================================================
 * Funções puras usadas por vários módulos: acesso a folhas, geração de
 * IDs, formatação de datas, cálculos financeiros e logging simples.
 * =====================================================================
 */

const NOMES_FOLHAS = {
  UTILIZADORES: 'Utilizadores',
  CLIENTES: 'Clientes',
  EMPRESTIMOS: 'Emprestimos',
  PARCELAS: 'Parcelas',
  PAGAMENTOS: 'Pagamentos',
  CAIXA: 'Caixa',
  CONFIGURACOES: 'Configuracoes',
  SESSOES: 'Sessoes',
  LOGS: 'Logs',
  NOTIFICACOES: 'Notificacoes'
};

/**
 * Devolve a Sheet pedida, lançando um erro claro se não existir.
 */
function obterFolha_(nomeFolha) {
  const ss = getSpreadsheet_();
  const folha = ss.getSheetByName(nomeFolha);
  if (!folha) {
    throw new Error('Folha "' + nomeFolha + '" não encontrada. Execute a ação "inicializarBaseDados" primeiro.');
  }
  return folha;
}

/**
 * Lê todos os dados de uma folha e devolve um array de objetos,
 * usando a primeira linha como cabeçalho (nomes das colunas).
 */
function lerFolhaComoObjetos_(nomeFolha) {
  const folha = obterFolha_(nomeFolha);
  const intervalo = folha.getDataRange().getValues();
  if (intervalo.length < 2) return [];

  const cabecalhos = intervalo[0];
  const linhas = intervalo.slice(1);

  return linhas
    .map(function (linha, indice) {
      const objeto = {};
      cabecalhos.forEach(function (cabecalho, coluna) {
        objeto[cabecalho] = linha[coluna];
      });
      objeto._linha = indice + 2; // +2 = compensa o cabeçalho e o índice base-1 do Sheets
      return objeto;
    })
    .filter(function (obj) {
      // Ignora linhas completamente vazias (sem ID na primeira coluna)
      const cabecalhos2 = Object.keys(obj);
      return obj[cabecalhos2[0]] !== '' && obj[cabecalhos2[0]] !== undefined && obj[cabecalhos2[0]] !== null;
    });
}

/**
 * Localiza a linha (número de linha na folha) cujo valor na coluna
 * identificadora corresponde ao id fornecido. Devolve null se não achar.
 */
function encontrarLinhaPorId_(nomeFolha, colunaId, id) {
  const folha = obterFolha_(nomeFolha);
  const dados = folha.getDataRange().getValues();
  const cabecalhos = dados[0];
  const indiceColuna = cabecalhos.indexOf(colunaId);
  if (indiceColuna === -1) return null;

  for (let i = 1; i < dados.length; i++) {
    if (String(dados[i][indiceColuna]) === String(id)) {
      return { linha: i + 1, dados: dados[i], cabecalhos: cabecalhos };
    }
  }
  return null;
}

/**
 * Gera o próximo ID sequencial para uma folha, com prefixo e
 * preenchimento de zeros à esquerda. Ex.: gerarProximoId_('Clientes','CLI',4) -> "CLI0001"
 */
function gerarProximoId_(nomeFolha, prefixo, tamanhoNumero) {
  const folha = obterFolha_(nomeFolha);
  const ultimaLinha = folha.getLastRow();
  if (ultimaLinha < 2) return prefixo + '1'.padStart(tamanhoNumero, '0');

  const colunaId = folha.getRange(2, 1, ultimaLinha - 1, 1).getValues();
  let maiorNumero = 0;

  colunaId.forEach(function (linha) {
    const valor = String(linha[0] || '');
    const match = valor.match(/(\d+)$/);
    if (match) {
      const numero = parseInt(match[1], 10);
      if (numero > maiorNumero) maiorNumero = numero;
    }
  });

  return prefixo + String(maiorNumero + 1).padStart(tamanhoNumero, '0');
}

/**
 * Gera o próximo número de contrato usando o número inicial configurável
 * guardado na folha Configuracoes.
 */
function gerarProximoNumeroContrato_() {
  const config = ConfigModulo.obter({}).data;
  const numeroInicial = parseInt(config.numeroInicialContratos || '1', 10);

  const folha = obterFolha_(NOMES_FOLHAS.EMPRESTIMOS);
  const ultimaLinha = folha.getLastRow();
  if (ultimaLinha < 2) return String(numeroInicial);

  const colunaContrato = folha.getRange(2, 2, ultimaLinha - 1, 1).getValues(); // coluna B = numeroContrato
  let maior = numeroInicial - 1;
  colunaContrato.forEach(function (linha) {
    const numero = parseInt(linha[0], 10);
    if (!isNaN(numero) && numero > maior) maior = numero;
  });

  return String(maior + 1);
}

/**
 * Gera o próximo número de recibo usando o número inicial configurável.
 */
function gerarProximoNumeroRecibo_() {
  const config = ConfigModulo.obter({}).data;
  const numeroInicial = parseInt(config.numeroInicialRecibos || '1', 10);

  const pagamentos = lerFolhaComoObjetos_(NOMES_FOLHAS.PAGAMENTOS);
  let maior = numeroInicial - 1;
  pagamentos.forEach(function (p) {
    const numero = parseInt(p.numeroRecibo, 10);
    if (!isNaN(numero) && numero > maior) maior = numero;
  });

  return String(maior + 1);
}

/** Devolve a data/hora atual no formato ISO usado internamente (armazenamento). */
function agoraISO_() {
  return new Date().toISOString();
}

/** Formata uma data (Date ou string ISO) para DD/MM/AAAA, para exibição/recibos. */
function formatarDataBR_(data) {
  const d = (data instanceof Date) ? data : new Date(data);
  if (isNaN(d.getTime())) return '';
  const dia = String(d.getDate()).padStart(2, '0');
  const mes = String(d.getMonth() + 1).padStart(2, '0');
  const ano = d.getFullYear();
  return dia + '/' + mes + '/' + ano;
}

/** Soma um número de dias a uma data e devolve um novo objeto Date. */
function adicionarDias_(data, dias) {
  const d = new Date(data);
  d.setDate(d.getDate() + dias);
  return d;
}

/** Soma um número de meses a uma data e devolve um novo objeto Date. */
function adicionarMeses_(data, meses) {
  const d = new Date(data);
  d.setMonth(d.getMonth() + meses);
  return d;
}

/** Arredonda um valor monetário a 2 casas decimais, evitando erros de ponto flutuante. */
function arredondar2_(valor) {
  return Math.round((valor + Number.EPSILON) * 100) / 100;
}

/**
 * Gera um token de sessão aleatório (usado no login).
 */
function gerarToken_() {
  return Utilities.getUuid() + '-' + new Date().getTime();
}

/**
 * Número de iterações do hash de senha. O Apps Script não tem bcrypt/scrypt
 * nativo nem permite instalar bibliotecas nesse nível, mas aplicar SHA-256
 * repetidamente milhares de vezes (técnica equivalente a PBKDF2) já torna a
 * força bruta offline centenas de milhares de vezes mais lenta do que uma
 * única passada — sem exigir nenhuma infraestrutura ou biblioteca externa.
 * 10 000 iterações demoram uma fração de segundo no login de uma pessoa,
 * mas tornam inviável testar grandes listas de senhas caso a folha de
 * cálculo alguma vez seja exposta.
 */
const HASH_SENHA_ITERACOES = 10000;

/** Prefixo gravado no início do hash para identificar com que esquema foi gerado. */
const HASH_SENHA_PREFIXO_V2 = 'v2$';

/**
 * Calcula o hash de uma senha, aplicando SHA-256 repetidamente
 * (HASH_SENHA_ITERACOES vezes) sobre a senha combinada com o sal. Isto é
 * o novo esquema ("v2") — ver hashSenha_() para o esquema antigo, ainda
 * suportado apenas para validar logins de contas criadas antes desta
 * alteração.
 */
function hashSenhaV2_(senha, sal) {
  const saltado = senha + '::' + (sal || 'microcredito-mz');
  let atual = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, saltado, Utilities.Charset.UTF_8);
  for (let i = 1; i < HASH_SENHA_ITERACOES; i++) {
    // Cada volta re-hasheia os bytes anteriores; o Utilities.computeDigest
    // aceita um array de bytes diretamente, sem precisar convertê-los para
    // texto entre iterações.
    atual = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, atual);
  }
  return HASH_SENHA_PREFIXO_V2 + _bytesParaHex_(atual);
}

/**
 * Calcula o hash de uma senha usando o esquema ANTIGO: uma única passada de
 * SHA-256 (sem prefixo). Mantido apenas para conseguir validar contas
 * criadas antes da introdução do esquema "v2" — nunca é usado para GERAR
 * hashes novos. Ver verificarSenha_() e o mecanismo de upgrade automático
 * em AuthModulo.login().
 */
function hashSenhaV1Legado_(senha, sal) {
  const entrada = senha + '::' + (sal || 'microcredito-mz');
  const bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, entrada, Utilities.Charset.UTF_8);
  return _bytesParaHex_(bytes);
}

function _bytesParaHex_(bytes) {
  return bytes.map(function (byte) {
    const v = (byte < 0 ? byte + 256 : byte).toString(16);
    return v.length === 1 ? '0' + v : v;
  }).join('');
}

/**
 * Gera o hash de uma senha NOVA (usado ao criar utilizador, ao trocar a
 * própria senha, e ao fazer upgrade automático de um hash antigo). Sempre
 * usa o esquema mais recente disponível.
 */
function hashSenha_(senha, sal) {
  return hashSenhaV2_(senha, sal);
}

/**
 * Verifica se uma senha corresponde a um hash gravado, aceitando tanto o
 * esquema novo ("v2$...", com o prefixo) quanto o esquema antigo (sem
 * prefixo, uma única passada de SHA-256), para não invalidar o login de
 * contas criadas antes desta atualização.
 * Devolve { valido: boolean, precisaAtualizar: boolean } — quando
 * precisaAtualizar é true, o hash gravado é do esquema antigo e deve ser
 * regravado com hashSenha_() agora que a senha em texto puro está
 * disponível (só existe nesta janela, durante a própria validação).
 */
function verificarSenha_(senha, sal, hashGravado) {
  const gravado = String(hashGravado || '');

  if (gravado.indexOf(HASH_SENHA_PREFIXO_V2) === 0) {
    return { valido: hashSenhaV2_(senha, sal) === gravado, precisaAtualizar: false };
  }

  // Sem prefixo -> hash do esquema antigo (v1), gerado antes desta atualização.
  const validoNoEsquemaAntigo = hashSenhaV1Legado_(senha, sal) === gravado;
  return { valido: validoNoEsquemaAntigo, precisaAtualizar: validoNoEsquemaAntigo };
}

/**
 * Objeto simples de logging, grava erros na folha "Logs" (se existir)
 * e também no Logger nativo do Apps Script para depuração via editor.
 */
const LoggerApp = {
  erro: function (origem, err, contexto) {
    Logger.log('[ERRO] ' + origem + ': ' + (err && err.message ? err.message : err));
    try {
      const ss = getSpreadsheet_();
      const folha = ss.getSheetByName(NOMES_FOLHAS.LOGS);
      if (folha) {
        folha.appendRow([
          agoraISO_(),
          origem,
          (err && err.message) ? err.message : String(err),
          JSON.stringify(contexto || {}).substring(0, 500)
        ]);
      }
    } catch (e2) {
      // Se o próprio logging falhar, apenas ignoramos para não interromper o fluxo principal.
    }
  },
  info: function (origem, mensagem) {
    Logger.log('[INFO] ' + origem + ': ' + mensagem);
  }
};

/**
 * Validações básicas de campos, usadas pelos módulos antes de gravar dados.
 */
const Validador = {
  obrigatorio: function (valor, nomeCampo) {
    if (valor === undefined || valor === null || String(valor).trim() === '') {
      throw new Error('O campo "' + nomeCampo + '" é obrigatório.');
    }
  },
  numerico: function (valor, nomeCampo) {
    if (isNaN(parseFloat(valor))) {
      throw new Error('O campo "' + nomeCampo + '" deve ser numérico.');
    }
  },
  positivo: function (valor, nomeCampo) {
    if (parseFloat(valor) <= 0) {
      throw new Error('O campo "' + nomeCampo + '" deve ser maior que zero.');
    }
  },
  telefoneMocambicano: function (valor, nomeCampo) {
    const limpo = String(valor).replace(/\D/g, '');
    if (limpo.length < 9) {
      throw new Error('O campo "' + nomeCampo + '" deve ter um número de telefone válido (mín. 9 dígitos).');
    }
  },
  email: function (valor, nomeCampo) {
    if (!valor) return; // email é opcional em muitos formulários
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!regex.test(valor)) {
      throw new Error('O campo "' + nomeCampo + '" deve ser um email válido.');
    }
  }
};
