/**
 * =====================================================================
 * LÓGICA DE CONFIGURAÇÕES — js/config.js
 * =====================================================================
 */

let EmModoEdicaoUtilizador = false;
let UtilizadoresCarregados = [];

document.addEventListener('DOMContentLoaded', function () {
  Layout.inicializar('configuracoes');

  ligarNavegacaoSecoes();

  const perfilAtual = API.obterUtilizadorAtual() ? API.obterUtilizadorAtual().perfil : null;
  const ehAdministrador = perfilAtual === 'Administrador';

  document.getElementById('form-alterar-senha').addEventListener('submit', submeterAlterarSenha);

  // As secções administrativas (Empresa, Financeiro, Numeração, Utilizadores)
  // já ficam ocultas na interface via [data-somente-admin] para quem não é
  // Administrador (ver Layout.montarInformacaoUtilizador). Evita-se aqui
  // também disparar as chamadas ao servidor associadas a essas secções —
  // que o backend rejeitaria de qualquer forma — poupando pedidos de rede
  // destinados a falhar para um Operador.
  if (ehAdministrador) {
    carregarConfiguracoes();
    carregarUtilizadores();

    document.getElementById('form-config-geral').addEventListener('submit', function (e) { salvarSecaoConfig(e, ['nomeEmpresa', 'telefoneEmpresa', 'emailEmpresa', 'enderecoEmpresa', 'logotipoUrl', 'moeda']); });
    document.getElementById('form-config-financeiro').addEventListener('submit', function (e) { salvarSecaoConfig(e, ['taxaJurosPadrao', 'multaPadrao', 'tipoMulta', 'valorFixoMultaDiaria']); });
    document.getElementById('form-config-numeracao').addEventListener('submit', function (e) { salvarSecaoConfig(e, ['numeroInicialContratos', 'numeroInicialRecibos']); });
    document.getElementById('form-config-seguranca').addEventListener('submit', function (e) { salvarSecaoConfig(e, ['mostrarCredenciaisTeste']); });

    document.getElementById('config-logotipo-arquivo').addEventListener('change', processarUploadLogotipo);

    document.getElementById('botao-novo-utilizador').addEventListener('click', abrirModalNovoUtilizador);
    document.getElementById('form-utilizador').addEventListener('submit', submeterFormularioUtilizador);
  }
});

/* =====================================================================
   NAVEGAÇÃO ENTRE SECÇÕES
   ===================================================================== */

function ligarNavegacaoSecoes() {
  document.querySelectorAll('.menu-config__item').forEach(function (item) {
    item.addEventListener('click', function () {
      document.querySelectorAll('.menu-config__item').forEach(function (i) { i.classList.remove('ativo'); });
      document.querySelectorAll('.secao-config').forEach(function (s) { s.classList.add('oculto'); });
      item.classList.add('ativo');
      document.querySelector('[data-secao-config="' + item.dataset.secao + '"]').classList.remove('oculto');
    });
  });
}

/* =====================================================================
   CARREGAMENTO E GRAVAÇÃO DE CONFIGURAÇÕES GERAIS
   ===================================================================== */

async function carregarConfiguracoes() {
  const resposta = await API.chamar('obterConfiguracoes', {});
  if (!resposta.success) {
    Alertas.erro('Erro ao carregar configurações', resposta.error);
    return;
  }

  const c = resposta.data;

  document.getElementById('config-nome-empresa').value = c.nomeEmpresa || '';
  document.getElementById('config-telefone-empresa').value = c.telefoneEmpresa || '';
  document.getElementById('config-email-empresa').value = c.emailEmpresa || '';
  document.getElementById('config-endereco-empresa').value = c.enderecoEmpresa || '';
  document.getElementById('config-logotipo-url').value = c.logotipoUrl || '';
  if (c.logotipoUrl) {
    document.getElementById('preview-logotipo').innerHTML = '<img src="' + c.logotipoUrl + '" alt="Logotipo">';
  }

  document.getElementById('config-taxa-padrao').value = c.taxaJurosPadrao || 10;
  document.getElementById('config-multa-padrao').value = c.multaPadrao || 5;
  document.getElementById('config-valor-fixo-multa').value = c.valorFixoMultaDiaria || 50;
  const radioMulta = document.querySelector('input[name="config-tipo-multa"][value="' + (c.tipoMulta || 'percentual') + '"]');
  if (radioMulta) radioMulta.checked = true;

  document.getElementById('config-numero-inicial-contratos').value = c.numeroInicialContratos || 1;
  document.getElementById('config-numero-inicial-recibos').value = c.numeroInicialRecibos || 1;

  // Trata ausência (instalações antigas, campo nunca gravado) e o valor
  // 'FALSE' que o próprio Google Sheets pode devolver como texto da célula
  // da mesma forma: como desligado. Só liga explicitamente para true/'true'/'TRUE'.
  document.getElementById('config-mostrar-credenciais-teste').checked = (
    c.mostrarCredenciaisTeste === true || c.mostrarCredenciaisTeste === 'true' || c.mostrarCredenciaisTeste === 'TRUE'
  );
}

async function salvarSecaoConfig(e, camposRelevantes) {
  e.preventDefault();

  const dados = {};
  if (camposRelevantes.indexOf('nomeEmpresa') !== -1) dados.nomeEmpresa = document.getElementById('config-nome-empresa').value.trim();
  if (camposRelevantes.indexOf('telefoneEmpresa') !== -1) dados.telefoneEmpresa = document.getElementById('config-telefone-empresa').value.trim();
  if (camposRelevantes.indexOf('emailEmpresa') !== -1) dados.emailEmpresa = document.getElementById('config-email-empresa').value.trim();
  if (camposRelevantes.indexOf('enderecoEmpresa') !== -1) dados.enderecoEmpresa = document.getElementById('config-endereco-empresa').value.trim();
  if (camposRelevantes.indexOf('logotipoUrl') !== -1) dados.logotipoUrl = document.getElementById('config-logotipo-url').value;
  if (camposRelevantes.indexOf('moeda') !== -1) dados.moeda = document.getElementById('config-moeda').value;
  if (camposRelevantes.indexOf('taxaJurosPadrao') !== -1) dados.taxaJurosPadrao = parseFloat(document.getElementById('config-taxa-padrao').value);
  if (camposRelevantes.indexOf('multaPadrao') !== -1) dados.multaPadrao = parseFloat(document.getElementById('config-multa-padrao').value);
  if (camposRelevantes.indexOf('tipoMulta') !== -1) dados.tipoMulta = document.querySelector('input[name="config-tipo-multa"]:checked').value;
  if (camposRelevantes.indexOf('valorFixoMultaDiaria') !== -1) dados.valorFixoMultaDiaria = parseFloat(document.getElementById('config-valor-fixo-multa').value);
  if (camposRelevantes.indexOf('numeroInicialContratos') !== -1) dados.numeroInicialContratos = parseInt(document.getElementById('config-numero-inicial-contratos').value, 10);
  if (camposRelevantes.indexOf('numeroInicialRecibos') !== -1) dados.numeroInicialRecibos = parseInt(document.getElementById('config-numero-inicial-recibos').value, 10);
  if (camposRelevantes.indexOf('mostrarCredenciaisTeste') !== -1) dados.mostrarCredenciaisTeste = document.getElementById('config-mostrar-credenciais-teste').checked;

  const botao = e.target.querySelector('button[type="submit"]');
  Utils.definirBotaoCarregando(botao, true, 'A guardar...');

  const resposta = await API.chamar('atualizarConfiguracoes', dados);

  Utils.definirBotaoCarregando(botao, false);

  if (!resposta.success) {
    Alertas.erro('Não foi possível guardar', resposta.error);
    return;
  }

  Alertas.sucesso('Configurações guardadas', '');
  carregarConfiguracoes();

  // Se o nome da empresa foi um dos campos guardados nesta secção, atualiza
  // imediatamente a barra lateral desta página (as restantes páginas já o
  // fazem sozinhas em Layout.inicializar, na próxima vez que forem abertas).
  if (camposRelevantes.indexOf('nomeEmpresa') !== -1) {
    Layout.carregarNomeEmpresa();
  }
}

/**
 * O logotipo é guardado como Data URL (Base64) diretamente numa célula da
 * folha "Configuracoes" no Google Sheets — não há upload para um servidor
 * de ficheiros. Uma célula do Google Sheets aceita no máximo 50 000
 * caracteres; Base64 expande o tamanho original em ~33%, por isso mesmo
 * uma imagem "razoável" de 100KB já gera uma string de ~137 000
 * caracteres e falha ao gravar. O limite abaixo (35KB de ficheiro) é o
 * máximo que a arquitetura atual (célula de folha de cálculo) permite com
 * uma margem de segurança confortável — não pode ser aumentado muito além
 * disto sem mudar a forma de armazenamento (ex.: Google Drive), o que
 * exigiria pedir uma nova permissão à conta Google. Há uma segunda
 * verificação depois da conversão, para apanhar com segurança qualquer
 * imagem cuja expansão real ultrapasse a estimativa.
 */
const TAMANHO_MAXIMO_LOGOTIPO_BYTES = 35 * 1024;
const TAMANHO_MAXIMO_DATA_URL_CARACTERES = 48000;

function processarUploadLogotipo(e) {
  const arquivo = e.target.files[0];
  if (!arquivo) return;

  if (arquivo.size > TAMANHO_MAXIMO_LOGOTIPO_BYTES) {
    Alertas.aviso(
      'Imagem muito grande',
      'O logotipo é guardado dentro de uma célula da folha de cálculo, que tem um limite de tamanho. Escolha uma imagem com menos de 35KB (experimente reduzir as dimensões para algo como 150x150px e guardar como PNG ou JPG comprimido).'
    );
    e.target.value = '';
    return;
  }

  const leitor = new FileReader();
  leitor.onload = function (evento) {
    const dataUrl = evento.target.result;

    if (dataUrl.length > TAMANHO_MAXIMO_DATA_URL_CARACTERES) {
      Alertas.aviso(
        'Imagem muito grande',
        'Mesmo dentro do limite de tamanho de ficheiro, esta imagem ficou demasiado grande depois de convertida. Tente uma imagem mais pequena ou mais comprimida.'
      );
      e.target.value = '';
      return;
    }

    document.getElementById('config-logotipo-url').value = dataUrl;
    document.getElementById('preview-logotipo').innerHTML = '<img src="' + dataUrl + '" alt="Logotipo">';
  };
  leitor.readAsDataURL(arquivo);
}

/* =====================================================================
   GESTÃO DE UTILIZADORES
   ===================================================================== */

async function carregarUtilizadores() {
  const corpo = document.getElementById('tabela-utilizadores-corpo');
  const resposta = await API.chamar('listarUtilizadores', {});

  if (!resposta.success) {
    corpo.innerHTML = '<tr><td colspan="5"><div class="estado-vazio"><i class="fa-solid fa-triangle-exclamation"></i><div class="estado-vazio__titulo">Erro ao carregar</div><div class="estado-vazio__texto">' + Utils.escaparHtml(resposta.error) + '</div></div></td></tr>';
    return;
  }

  if (!resposta.data.length) {
    corpo.innerHTML = '<tr><td colspan="5"><div class="estado-vazio"><i class="fa-solid fa-users"></i><div class="estado-vazio__titulo">Nenhum utilizador</div></div></td></tr>';
    return;
  }

  const utilizadorAtual = API.obterUtilizadorAtual();
  UtilizadoresCarregados = resposta.data;

  corpo.innerHTML = resposta.data.map(function (u) {
    const classeBadge = Formato.classeBadge(u.estado);
    const ehEuMesmo = utilizadorAtual && String(u.id) === String(utilizadorAtual.id);
    return (
      '<tr>' +
        '<td>' + Utils.escaparHtml(u.nome) + (ehEuMesmo ? ' <span class="texto-secundario" style="font-size:var(--tamanho-xs);">(você)</span>' : '') + '</td>' +
        '<td>' + Utils.escaparHtml(u.utilizador) + '</td>' +
        '<td>' + Utils.escaparHtml(u.perfil) + '</td>' +
        '<td><span class="badge badge--' + classeBadge + '">' + Utils.escaparHtml(u.estado) + '</span></td>' +
        '<td class="col-acoes">' +
          '<div class="grupo-acoes-tabela">' +
            '<button class="botao-acao-tabela" title="Editar" data-acao="editar-utilizador" data-id="' + Utils.escaparHtml(u.id) + '"><i class="fa-solid fa-pen"></i></button>' +
            (!ehEuMesmo ? '<button class="botao-acao-tabela botao-acao-tabela--perigo" title="Excluir" data-acao="excluir-utilizador" data-id="' + Utils.escaparHtml(u.id) + '" data-nome="' + Utils.escaparHtml(u.nome) + '"><i class="fa-solid fa-trash-can"></i></button>' : '') +
          '</div>' +
        '</td>' +
      '</tr>'
    );
  }).join('');
}

/**
 * Delegação de eventos para os botões de ação da tabela de utilizadores.
 * Em vez de serializar o objeto utilizador (ou o seu nome) diretamente
 * dentro de um atributo onclick="..." — o que quebra a página assim que o
 * nome contém uma aspa ou um apóstrofo, comum em nomes como "D'Almeida" —
 * os botões referenciam apenas o id (sempre gerado pelo sistema, seguro em
 * qualquer atributo) e o objeto completo é procurado em UtilizadoresCarregados.
 */
document.addEventListener('click', function (e) {
  const botao = e.target.closest('[data-acao]');
  if (!botao) return;

  const acao = botao.dataset.acao;
  const id = botao.dataset.id;

  if (acao === 'editar-utilizador') {
    const utilizador = UtilizadoresCarregados.find(function (u) { return String(u.id) === String(id); });
    if (utilizador) editarUtilizador(utilizador);
  } else if (acao === 'excluir-utilizador') {
    confirmarExclusaoUtilizador(id, botao.dataset.nome);
  }
});

function abrirModalNovoUtilizador() {
  EmModoEdicaoUtilizador = false;
  document.getElementById('form-utilizador').reset();
  document.getElementById('utilizador-id-original').value = '';
  document.getElementById('modal-utilizador-titulo').textContent = 'Novo Utilizador';
  document.getElementById('utilizador-senha').required = true;
  document.getElementById('utilizador-senha-obrigatorio').style.display = 'inline';
  document.getElementById('utilizador-senha-ajuda').textContent = 'Mínimo de 4 caracteres.';
  document.getElementById('grupo-utilizador-estado').style.display = 'none';
  Validacao.limparErros(document.getElementById('form-utilizador'));
  Modal.abrir('modal-utilizador');
}

function editarUtilizador(utilizador) {
  EmModoEdicaoUtilizador = true;
  document.getElementById('form-utilizador').reset();
  document.getElementById('utilizador-id-original').value = utilizador.id;
  document.getElementById('utilizador-nome').value = utilizador.nome;
  document.getElementById('utilizador-login').value = utilizador.utilizador;
  document.getElementById('modal-utilizador-titulo').textContent = 'Editar Utilizador — ' + utilizador.nome;

  document.getElementById('utilizador-senha').required = false;
  document.getElementById('utilizador-senha-obrigatorio').style.display = 'none';
  document.getElementById('utilizador-senha-ajuda').textContent = 'Deixe em branco para manter a senha atual.';

  const radioPerfil = document.querySelector('input[name="utilizador-perfil"][value="' + utilizador.perfil + '"]');
  if (radioPerfil) radioPerfil.checked = true;

  document.getElementById('grupo-utilizador-estado').style.display = 'block';
  const radioEstado = document.querySelector('input[name="utilizador-estado"][value="' + utilizador.estado + '"]');
  if (radioEstado) radioEstado.checked = true;

  Validacao.limparErros(document.getElementById('form-utilizador'));
  Modal.abrir('modal-utilizador');
}

async function submeterFormularioUtilizador(e) {
  e.preventDefault();

  if (!Validacao.validarFormulario(e.target)) {
    Alertas.aviso('Verifique o formulário', 'Preencha os campos obrigatórios.');
    return;
  }

  const senha = document.getElementById('utilizador-senha').value;
  if (!EmModoEdicaoUtilizador && senha.length < 4) {
    Alertas.aviso('Senha muito curta', 'A senha deve ter pelo menos 4 caracteres.');
    return;
  }

  const dados = {
    nome: document.getElementById('utilizador-nome').value.trim(),
    utilizador: document.getElementById('utilizador-login').value.trim(),
    perfil: document.querySelector('input[name="utilizador-perfil"]:checked').value
  };
  if (senha) dados.senha = senha;

  const botao = document.getElementById('botao-guardar-utilizador');
  Utils.definirBotaoCarregando(botao, true, 'A guardar...');

  let resposta;
  if (EmModoEdicaoUtilizador) {
    dados.id = document.getElementById('utilizador-id-original').value;
    dados.estado = document.querySelector('input[name="utilizador-estado"]:checked').value;
    resposta = await API.chamar('atualizarUtilizador', dados);
  } else {
    resposta = await API.chamar('criarUtilizador', dados);
  }

  Utils.definirBotaoCarregando(botao, false);

  if (!resposta.success) {
    Alertas.erro('Não foi possível guardar', resposta.error);
    return;
  }

  Modal.fechar('modal-utilizador');
  Alertas.sucesso('Utilizador guardado', '');
  carregarUtilizadores();
}

function confirmarExclusaoUtilizador(id, nome) {
  Modal.confirmar({
    titulo: 'Excluir utilizador',
    texto: 'Tem a certeza que deseja excluir "' + nome + '"? Esta ação não pode ser desfeita.',
    textoConfirmar: 'Excluir',
    tipoPerigo: true,
    aoConfirmar: async function () {
      Utils.mostrarCarregamento(true, 'A excluir...');
      const resposta = await API.chamar('excluirUtilizador', { id: id });
      Utils.mostrarCarregamento(false);

      if (!resposta.success) { Alertas.erro('Não foi possível excluir', resposta.error); return; }
      Alertas.sucesso('Utilizador excluído', '');
      carregarUtilizadores();
    }
  });
}

/* =====================================================================
   A MINHA CONTA — alteração da própria senha
   ===================================================================== */

async function submeterAlterarSenha(e) {
  e.preventDefault();

  const form = e.target;
  const senhaAtual = document.getElementById('conta-senha-atual').value;
  const senhaNova = document.getElementById('conta-senha-nova').value;
  const senhaConfirmar = document.getElementById('conta-senha-confirmar').value;

  if (senhaNova.length < 4) {
    Alertas.aviso('Senha muito curta', 'A nova senha deve ter pelo menos 4 caracteres.');
    return;
  }

  if (senhaNova !== senhaConfirmar) {
    Alertas.aviso('As senhas não coincidem', 'A confirmação deve ser igual à nova senha digitada.');
    return;
  }

  const botao = form.querySelector('button[type="submit"]');
  Utils.definirBotaoCarregando(botao, true, 'A alterar...');

  const resposta = await API.chamar('alterarSenha', { senhaAtual: senhaAtual, senhaNova: senhaNova });

  Utils.definirBotaoCarregando(botao, false);

  if (!resposta.success) {
    Alertas.erro('Não foi possível alterar a senha', resposta.error);
    return;
  }

  form.reset();
  Alertas.sucesso('Senha alterada', 'A sua senha foi atualizada com sucesso.');
}
