/**
 * =====================================================================
 * AUTENTICAÇÃO (LOGIN) — js/auth.js
 * =====================================================================
 * Lógica exclusiva da página login.html: submissão do formulário,
 * alternância de visibilidade da senha, e redirecionamento se já
 * existir uma sessão válida.
 * =====================================================================
 */

document.addEventListener('DOMContentLoaded', function () {

  // Se já houver sessão ativa, vai direto para o dashboard
  if (API.estaAutenticado()) {
    window.location.href = 'dashboard.html';
    return;
  }

  carregarIdentidadeEmpresa();

  const form = document.getElementById('form-login');
  const botaoEntrar = document.getElementById('botao-entrar');
  const campoUtilizador = document.getElementById('campo-utilizador');
  const campoSenha = document.getElementById('campo-senha');
  const alternarSenha = document.getElementById('alternar-visibilidade-senha');
  const areaErro = document.getElementById('login-erro');

  if (campoUtilizador) campoUtilizador.focus();

  if (alternarSenha) {
    alternarSenha.addEventListener('click', function () {
      const oculto = campoSenha.type === 'password';
      campoSenha.type = oculto ? 'text' : 'password';
      alternarSenha.innerHTML = oculto
        ? '<i class="fa-solid fa-eye-slash"></i>'
        : '<i class="fa-solid fa-eye"></i>';
    });
  }

  form.addEventListener('submit', async function (e) {
    e.preventDefault();
    esconderErro();

    const utilizador = campoUtilizador.value.trim();
    const senha = campoSenha.value;

    if (!utilizador || !senha) {
      mostrarErro('Preencha o utilizador e a senha para continuar.');
      return;
    }

    Utils.definirBotaoCarregando(botaoEntrar, true, 'A entrar...');

    const resposta = await API.chamar('login', { utilizador: utilizador, senha: senha });

    Utils.definirBotaoCarregando(botaoEntrar, false);

    if (!resposta.success) {
      mostrarErro(resposta.error || 'Não foi possível iniciar sessão.');
      return;
    }

    API.guardarSessao(resposta.data.token, resposta.data.utilizador);
    window.location.href = 'dashboard.html';
  });

  function mostrarErro(mensagem) {
    if (!areaErro) { Alertas.erro('Erro ao entrar', mensagem); return; }
    areaErro.textContent = mensagem;
    areaErro.classList.remove('oculto');
  }

  function esconderErro() {
    if (areaErro) areaErro.classList.add('oculto');
  }

  /**
   * Preenche o nome e o logotipo da empresa na coluna de identidade desta
   * página, a partir das Configurações. login.html é a única página do
   * sistema sem sessão ativa nesta altura, por isso não passa por
   * Layout.inicializar()/carregarNomeEmpresa() — obterConfiguracoes não
   * exige autenticação, então esta chamada funciona da mesma forma aqui.
   */
  async function carregarIdentidadeEmpresa() {
    const resposta = await API.chamar('obterConfiguracoes', {});
    if (!resposta.success) return;

    if (resposta.data.nomeEmpresa) {
      const elNome = document.querySelector('[data-config="nomeEmpresa"]');
      if (elNome) elNome.textContent = resposta.data.nomeEmpresa;
    }

    if (resposta.data.logotipoUrl) {
      const elLogo = document.querySelector('[data-config="logotipoUrl"]');
      if (elLogo) {
        elLogo.innerHTML = '<img src="' + Utils.escaparHtml(resposta.data.logotipoUrl) + '" alt="Logotipo" class="login-identidade__logo-imagem">';
      }
    }

    // O bloco de credenciais de exemplo (admin/admin123, operador/operador123)
    // fica OCULTO por padrão — é útil só durante avaliação/demonstração do
    // sistema, mas deixá-lo sempre visível numa instalação real exporia a
    // senha padrão de Administrador para qualquer pessoa que chegasse à
    // tela de login, antes mesmo de a empresa trocar essas senhas. Só
    // aparece se um Administrador ativar explicitamente a opção
    // correspondente em Configurações (ver docs/INSTALACAO.md).
    if (resposta.data.mostrarCredenciaisTeste === true || resposta.data.mostrarCredenciaisTeste === 'true' || resposta.data.mostrarCredenciaisTeste === 'TRUE') {
      const elCredenciais = document.getElementById('login-credenciais-teste');
      if (elCredenciais) elCredenciais.classList.remove('oculto');
    }
  }
});
