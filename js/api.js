/**
 * =====================================================================
 * CAMADA DE COMUNICAÇÃO COM A API — js/api.js
 * =====================================================================
 * Ponto único de contacto com o backend (Google Apps Script Web App).
 * Todos os outros módulos chamam API.chamar(...) em vez de usar fetch()
 * diretamente — isto centraliza tratamento de erros, envio do token
 * de sessão e serialização/deserialização de JSON.
 *
 * IMPORTANTE SOBRE O MÉTODO DE ENVIO:
 * O ContentService do Apps Script não permite configurar cabeçalhos
 * CORS de forma flexível. Para evitar problemas de CORS/preflight,
 * enviamos todos os pedidos como POST com Content-Type "text/plain"
 * (que não dispara preflight OPTIONS) e o Apps Script interpreta o
 * corpo como JSON manualmente em doPost(e) -> e.postData.contents.
 * =====================================================================
 */

const API = (function () {

  // >>> SUBSTITUA pela URL da sua implementação do Apps Script <<<
  // Exemplo: 'https://script.google.com/macros/s/AKfycb.../exec'
  const URL_BASE = 'https://script.google.com/macros/s/AKfycbxSlskmyTNXr0WpvG9J1ykEaHKcb344q0_p4rpT3WtrN31VzxmbID0ydGq5cHwg1cWfyw/exec';

  const CHAVE_TOKEN = 'mc_token';
  const CHAVE_UTILIZADOR = 'mc_utilizador';

  /**
   * Executa uma chamada à API. Devolve sempre um objeto no formato
   * { success, data, message, error, codigo }, nunca lança exceção
   * para erros de negócio (apenas para falhas de rede/formato).
   */
  async function chamar(action, parametros) {
    parametros = parametros || {};

    const corpo = Object.assign({}, parametros, {
      action: action,
      token: obterToken()
    });

    try {
      const resposta = await fetch(URL_BASE, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(corpo)
      });

      if (!resposta.ok) {
        return { success: false, error: 'Falha de comunicação com o servidor (HTTP ' + resposta.status + ').', codigo: 'ERRO_HTTP' };
      }

      const texto = await resposta.text();
      let json;
      try {
        json = JSON.parse(texto);
      } catch (erroParse) {
        console.error('Resposta não é JSON válido:', texto);
        return { success: false, error: 'O servidor devolveu uma resposta inesperada. Verifique se a Web App foi publicada corretamente.', codigo: 'RESPOSTA_INVALIDA' };
      }

      // Se a sessão expirou, força logout automático
      if (json.codigo === 'SESSAO_INVALIDA') {
        limparSessao();
        if (typeof window !== 'undefined' && !window.location.pathname.endsWith('login.html')) {
          Alertas.aviso('Sessão expirada', 'Por favor, inicie sessão novamente.');
          setTimeout(function () { window.location.href = 'login.html'; }, 1200);
        }
      }

      return json;

    } catch (erroRede) {
      console.error('Erro de rede ao chamar a API:', erroRede);
      return {
        success: false,
        error: 'Não foi possível ligar ao servidor. Verifique a sua ligação à internet ou se a URL da API está configurada em js/api.js.',
        codigo: 'ERRO_REDE'
      };
    }
  }

  function obterToken() {
    return localStorage.getItem(CHAVE_TOKEN) || '';
  }

  function guardarSessao(token, utilizador) {
    localStorage.setItem(CHAVE_TOKEN, token);
    localStorage.setItem(CHAVE_UTILIZADOR, JSON.stringify(utilizador));
  }

  function obterUtilizadorAtual() {
    try {
      const bruto = localStorage.getItem(CHAVE_UTILIZADOR);
      return bruto ? JSON.parse(bruto) : null;
    } catch (e) {
      return null;
    }
  }

  function limparSessao() {
    localStorage.removeItem(CHAVE_TOKEN);
    localStorage.removeItem(CHAVE_UTILIZADOR);
  }

  function estaAutenticado() {
    return !!obterToken() && !!obterUtilizadorAtual();
  }

  return {
    chamar: chamar,
    guardarSessao: guardarSessao,
    obterUtilizadorAtual: obterUtilizadorAtual,
    obterToken: obterToken,
    limparSessao: limparSessao,
    estaAutenticado: estaAutenticado
  };
})();
