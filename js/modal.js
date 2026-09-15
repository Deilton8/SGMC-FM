/**
 * =====================================================================
 * MODAIS GENÉRICOS — js/modal.js
 * =====================================================================
 * Fornece duas funcionalidades reutilizáveis em toda a aplicação:
 *   Modal.abrir(idModal) / Modal.fechar(idModal)  -> mostra/esconde um
 *     modal já existente no HTML da página (usado pelos formulários
 *     de cadastro/edição de cada módulo).
 *   Modal.confirmar({...}) -> cria dinamicamente um modal de
 *     confirmação (usado antes de excluir/cancelar registos).
 * =====================================================================
 */

const Modal = (function () {

  function abrir(idModal) {
    const fundo = document.getElementById(idModal);
    if (!fundo) { console.warn('Modal não encontrado:', idModal); return; }
    fundo.classList.add('visivel');
    document.body.style.overflow = 'hidden';

    const primeiroInput = fundo.querySelector('input, select, textarea');
    if (primeiroInput) setTimeout(function () { primeiroInput.focus(); }, 80);
  }

  function fechar(idModal) {
    const fundo = document.getElementById(idModal);
    if (!fundo) return;
    fundo.classList.remove('visivel');
    document.body.style.overflow = '';
  }

  /**
   * Cria e mostra um modal de confirmação temporário.
   * opcoes: { titulo, texto, textoConfirmar, tipoPerigo (bool), aoConfirmar: fn }
   */
  function confirmar(opcoes) {
    const idTemporario = 'modal-confirmacao-temp';
    let existente = document.getElementById(idTemporario);
    if (existente) existente.remove();

    const icone = opcoes.tipoPerigo ? 'fa-trash-can' : 'fa-circle-question';
    const classeIcone = opcoes.tipoPerigo ? 'modal-confirmacao__icone--perigo' : 'modal-confirmacao__icone--aviso';
    const classeBotao = opcoes.tipoPerigo ? 'botao--perigo' : 'botao--primario';

    const fundo = document.createElement('div');
    fundo.id = idTemporario;
    fundo.className = 'modal-fundo';
    fundo.innerHTML =
      '<div class="modal modal--pequeno">' +
        '<div class="modal__corpo" style="padding-top: var(--espaco-6); text-align:center;">' +
          '<div class="modal-confirmacao__icone ' + classeIcone + '" style="margin-left:auto;margin-right:auto;">' +
            '<i class="fa-solid ' + icone + '"></i>' +
          '</div>' +
          '<div class="modal__titulo" style="margin-bottom:var(--espaco-2);">' + Utils.escaparHtml(opcoes.titulo || 'Confirmar ação') + '</div>' +
          '<div class="modal-confirmacao__texto">' + Utils.escaparHtml(opcoes.texto || 'Tem a certeza que deseja continuar?') + '</div>' +
        '</div>' +
        '<div class="modal__rodape" style="justify-content:center;">' +
          '<button class="botao botao--secundario" data-acao="cancelar">Cancelar</button>' +
          '<button class="botao ' + classeBotao + '" data-acao="confirmar">' + Utils.escaparHtml(opcoes.textoConfirmar || 'Confirmar') + '</button>' +
        '</div>' +
      '</div>';

    document.body.appendChild(fundo);
    document.body.style.overflow = 'hidden';
    requestAnimationFrame(function () { fundo.classList.add('visivel'); });

    function encerrar() {
      fundo.classList.remove('visivel');
      document.body.style.overflow = '';
      setTimeout(function () { fundo.remove(); }, 200);
    }

    fundo.querySelector('[data-acao="cancelar"]').addEventListener('click', encerrar);
    fundo.addEventListener('click', function (e) { if (e.target === fundo) encerrar(); });

    fundo.querySelector('[data-acao="confirmar"]').addEventListener('click', function () {
      encerrar();
      if (typeof opcoes.aoConfirmar === 'function') opcoes.aoConfirmar();
    });
  }

  // Fecha modais ao clicar no fundo escuro ou no botão com [data-modal-fechar]
  document.addEventListener('click', function (e) {
    if (e.target.classList && e.target.classList.contains('modal-fundo')) {
      e.target.classList.remove('visivel');
      document.body.style.overflow = '';
    }
    const botaoFechar = e.target.closest('[data-modal-fechar]');
    if (botaoFechar) {
      const idModal = botaoFechar.getAttribute('data-modal-fechar');
      fechar(idModal);
    }
  });

  // Fecha o modal visível ao pressionar Escape
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      document.querySelectorAll('.modal-fundo.visivel').forEach(function (fundo) {
        fundo.classList.remove('visivel');
      });
      document.body.style.overflow = '';
    }
  });

  return { abrir: abrir, fechar: fechar, confirmar: confirmar };
})();
