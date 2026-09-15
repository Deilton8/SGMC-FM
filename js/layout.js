/**
 * =====================================================================
 * CONTROLO DE LAYOUT — js/layout.js
 * =====================================================================
 * Gere o comportamento da casca da aplicação (app-shell) partilhada
 * por todas as páginas internas: recolher/expandir a barra lateral,
 * abrir/fechar o menu em ecrãs móveis, marcar o item de menu ativo,
 * preencher os dados do utilizador na barra superior, e alimentar a
 * pesquisa global.
 *
 * Este ficheiro deve ser incluído em TODAS as páginas exceto login.html,
 * e Layout.inicializar() deve ser chamado no DOMContentLoaded de cada
 * módulo de página (dashboard.js, clientes.js, etc.).
 * =====================================================================
 */

const Layout = (function () {

  const CHAVE_LATERAL_RECOLHIDA = 'mc_lateral_recolhida';

  function inicializar(paginaAtual) {
    protegerRota();
    montarInformacaoUtilizador();
    carregarNomeEmpresa();
    restaurarEstadoLateral();
    ligarEventosLateral();
    marcarItemMenuAtivo(paginaAtual);
    ligarPesquisaGlobal();
    ligarLogout();
  }

  /** Redireciona para o login se não houver sessão válida. */
  function protegerRota() {
    if (!API.estaAutenticado()) {
      window.location.href = 'login.html';
    }
  }

  function montarInformacaoUtilizador() {
    const utilizador = API.obterUtilizadorAtual();
    if (!utilizador) return;

    const nomeEls = document.querySelectorAll('[data-utilizador-nome]');
    nomeEls.forEach(function (el) { el.textContent = utilizador.nome; });

    const cargoEls = document.querySelectorAll('[data-utilizador-perfil]');
    cargoEls.forEach(function (el) { el.textContent = utilizador.perfil; });

    const iniciaisEls = document.querySelectorAll('[data-utilizador-iniciais]');
    iniciaisEls.forEach(function (el) { el.textContent = Formato.iniciais(utilizador.nome); });

    // Oculta elementos restritos ao Administrador (data-somente-admin)
    if (utilizador.perfil !== 'Administrador') {
      document.querySelectorAll('[data-somente-admin]').forEach(function (el) {
        el.style.display = 'none';
      });
    }
  }

  /**
   * Preenche o nome da empresa ([data-config="nomeEmpresa"]) e o logotipo
   * ([data-config="logotipoUrl"], usado na barra lateral) a partir das
   * Configurações. Sem isto, apenas configuracoes.html atualizava esse
   * texto — nas restantes páginas o nome ficava sempre fixo em
   * "MicroCrédito MZ", mesmo depois de a empresa configurar o seu próprio
   * nome. O logotipo, quando configurado, substitui a letra "F" que serve
   * de marca por defeito; quando não há logotipo, a letra continua a
   * aparecer normalmente — nada muda para quem ainda não carregou uma
   * imagem.
   */
  async function carregarNomeEmpresa() {
    const elementosNome = document.querySelectorAll('[data-config="nomeEmpresa"]');
    const elementosLogo = document.querySelectorAll('[data-config="logotipoUrl"]');
    if (!elementosNome.length && !elementosLogo.length) return;

    const resposta = await API.chamar('obterConfiguracoes', {});
    if (!resposta.success) return;

    if (resposta.data.nomeEmpresa) {
      elementosNome.forEach(function (el) { el.textContent = resposta.data.nomeEmpresa; });
    }

    if (resposta.data.logotipoUrl) {
      elementosLogo.forEach(function (el) {
        el.innerHTML = '<img src="' + Utils.escaparHtml(resposta.data.logotipoUrl) + '" alt="Logotipo" class="lateral__logo-marca-imagem">';
      });
    }
  }

  function restaurarEstadoLateral() {
    const recolhida = localStorage.getItem(CHAVE_LATERAL_RECOLHIDA) === '1';
    const shell = document.querySelector('.app-shell');
    if (shell && recolhida && window.innerWidth > 1024) {
      shell.classList.add('lateral-recolhida');
    }
  }

  function ligarEventosLateral() {
    const shell = document.querySelector('.app-shell');
    if (!shell) return;

    const botaoRecolher = document.getElementById('botao-recolher-lateral');
    if (botaoRecolher) {
      botaoRecolher.addEventListener('click', function () {
        shell.classList.toggle('lateral-recolhida');
        const recolhida = shell.classList.contains('lateral-recolhida');
        localStorage.setItem(CHAVE_LATERAL_RECOLHIDA, recolhida ? '1' : '0');
      });
    }

    const botaoMenuMovel = document.getElementById('botao-menu-movel');
    const sobreposicao = document.getElementById('sobreposicao-lateral-movel');
    if (botaoMenuMovel) {
      botaoMenuMovel.addEventListener('click', function () {
        shell.classList.add('lateral-movel-aberta');
      });
    }
    if (sobreposicao) {
      sobreposicao.addEventListener('click', function () {
        shell.classList.remove('lateral-movel-aberta');
      });
    }
    // Fecha o menu móvel ao navegar
    document.querySelectorAll('.item-menu').forEach(function (item) {
      item.addEventListener('click', function () {
        shell.classList.remove('lateral-movel-aberta');
      });
    });
  }

  function marcarItemMenuAtivo(paginaAtual) {
    document.querySelectorAll('.item-menu[data-pagina]').forEach(function (item) {
      item.classList.toggle('ativo', item.dataset.pagina === paginaAtual);
    });
  }

  function ligarLogout() {
    document.querySelectorAll('[data-acao-logout]').forEach(function (botao) {
      botao.addEventListener('click', function () {
        Modal.confirmar({
          titulo: 'Terminar sessão',
          texto: 'Tem a certeza que deseja sair do sistema?',
          textoConfirmar: 'Sair',
          aoConfirmar: function () {
            API.limparSessao();
            window.location.href = 'login.html';
          }
        });
      });
    });
  }

  /** Liga o campo de pesquisa da barra superior à ação de pesquisa global. */
  function ligarPesquisaGlobal() {
    const input = document.getElementById('pesquisa-global-input');
    const resultados = document.getElementById('pesquisa-global-resultados');
    if (!input || !resultados) return;

    const executarPesquisa = Utils.debounce(async function () {
      const termo = input.value.trim();
      if (termo.length < 2) {
        resultados.classList.add('oculto');
        resultados.innerHTML = '';
        return;
      }

      const resposta = await API.chamar('pesquisaGlobal', { termo: termo });
      if (!resposta.success) return;

      renderizarResultadosPesquisa(resultados, resposta.data, termo);
    }, 350);

    input.addEventListener('input', executarPesquisa);
    input.addEventListener('focus', function () { if (input.value.trim().length >= 2) executarPesquisa(); });

    document.addEventListener('click', function (e) {
      if (!e.target.closest('.topo__pesquisa')) {
        resultados.classList.add('oculto');
      }
    });
  }

  function renderizarResultadosPesquisa(container, dados, termo) {
    const temResultados = (dados.clientes.length + dados.emprestimos.length) > 0;

    if (!temResultados) {
      container.innerHTML = '<div style="padding:var(--espaco-4);font-size:var(--tamanho-sm);color:var(--cor-texto-secundario);">Nenhum resultado para "' + Utils.escaparHtml(termo) + '".</div>';
      container.classList.remove('oculto');
      return;
    }

    let html = '';

    if (dados.clientes.length) {
      html += '<div style="padding:var(--espaco-2) var(--espaco-4);font-size:var(--tamanho-xs);font-weight:600;color:var(--cor-texto-secundario);">CLIENTES</div>';
      dados.clientes.forEach(function (c) {
        html += '<a href="cliente-perfil.html?codigo=' + encodeURIComponent(c.codigo) + '" style="display:flex;justify-content:space-between;padding:var(--espaco-3) var(--espaco-4);text-decoration:none;color:var(--cor-texto-principal);border-top:1px solid var(--cor-borda);">' +
          '<span>' + Utils.escaparHtml(c.nomeCompleto || '(sem nome)') + '</span>' +
          '<span style="color:var(--cor-texto-secundario);font-size:var(--tamanho-xs);">' + Utils.escaparHtml(c.codigo) + '</span>' +
        '</a>';
      });
    }

    if (dados.emprestimos.length) {
      html += '<div style="padding:var(--espaco-2) var(--espaco-4);font-size:var(--tamanho-xs);font-weight:600;color:var(--cor-texto-secundario);">EMPRÉSTIMOS</div>';
      dados.emprestimos.forEach(function (e) {
        html += '<a href="emprestimo-detalhe.html?contrato=' + encodeURIComponent(e.numeroContrato) + '" style="display:flex;justify-content:space-between;padding:var(--espaco-3) var(--espaco-4);text-decoration:none;color:var(--cor-texto-principal);border-top:1px solid var(--cor-borda);">' +
          '<span>Contrato #' + Utils.escaparHtml(e.numeroContrato) + ' — ' + Utils.escaparHtml(e.clienteNome) + '</span>' +
          '<span style="color:var(--cor-texto-secundario);font-size:var(--tamanho-xs);">' + Utils.escaparHtml(e.estado) + '</span>' +
        '</a>';
      });
    }

    container.innerHTML = html;
    container.classList.remove('oculto');
  }

  return { inicializar: inicializar, carregarNomeEmpresa: carregarNomeEmpresa };
})();
