/**
 * =====================================================================
 * MÓDULO DE NOTIFICAÇÕES — Notificacoes.gs
 * =====================================================================
 * Envia lembretes automáticos de vencimento (alguns dias antes da
 * parcela vencer) e avisos de atraso (assim que uma parcela passa a
 * "Atrasada"), e mantém um registo de auditoria de tudo o que foi
 * (tentado) enviar, na folha "Notificacoes".
 *
 * CANAL DE ENVIO: implementado agora por e-mail (MailApp, nativo do
 * Apps Script — funciona de imediato, sem contratar nada, mas sujeito à
 * quota diária da conta Google usada para publicar o sistema). SMS e
 * WhatsApp são os canais mais comuns para os clientes deste tipo de
 * negócio em Moçambique (ver docs/PROPOSTAS_FUNCIONALIDADES.md), mas
 * exigem contratar um gateway externo (ex.: Twilio, 360dialog, ou um
 * agregador de SMS local) e configurar as respetivas credenciais — algo
 * que só quem opera o negócio pode decidir e obter. _enviar(), abaixo,
 * está estruturado para que ligar um desses canais seja só preencher o
 * respetivo bloco, sem tocar em mais nada do módulo.
 *
 * IMPORTANTE: só deve ser chamado pelo trigger diário
 * (tarefaDiariaAtualizarAtrasos, em Setup.gs) — nunca de forma síncrona
 * a um pedido do frontend, para não reenviar a mesma notificação sempre
 * que alguém abrir a lista de empréstimos ou o dashboard (ver comentário
 * em tarefaDiariaAtualizarAtrasos sobre porque isto está separado de
 * EmprestimosModulo.atualizarAtrasos()).
 * =====================================================================
 */

const NotificacoesModulo = {

  /**
   * Percorre todas as parcelas em aberto (Pendente/Parcial/Atrasada) de
   * contratos Ativos/Em atraso e dispara:
   *  - o lembrete "antes do vencimento", quando faltam
   *    <= notificacoesDiasAntesVencimento dias (e ainda não foi enviado
   *    para esta parcela — ver notificadoVencimentoEm);
   *  - o aviso de "atraso", quando a parcela já está "Atrasada" (e ainda
   *    não foi enviado para esta parcela — ver notificadoAtrasoEm).
   * Cada tipo é enviado NO MÁXIMO uma vez por parcela — o aviso de atraso
   * não se repete todos os dias enquanto a parcela continuar em atraso,
   * para não sobrecarregar o cliente de mensagens. Se preferirem um
   * lembrete repetido a cada X dias em atraso, é só trocar a condição
   * "!notificadoAtrasoEm" abaixo por uma verificação de quantos dias se
   * passaram desde o último envio.
   */
  processarNotificacoesDiarias: function () {
    const config = ConfigModulo.obter({}).data;

    if (config.notificacoesAtivas !== true && String(config.notificacoesAtivas).toLowerCase() !== 'true') {
      return { ativo: false, motivo: 'notificacoesAtivas está desligado em Configurações.' };
    }

    const diasAntes = parseInt(config.notificacoesDiasAntesVencimento || 2, 10);
    const canal = config.notificacoesCanal || 'email';

    const clientes = lerFolhaComoObjetos_(NOMES_FOLHAS.CLIENTES);
    const mapaClientes = {};
    clientes.forEach(function (cl) { mapaClientes[cl.codigo] = cl; });

    const emprestimos = lerFolhaComoObjetos_(NOMES_FOLHAS.EMPRESTIMOS);
    const mapaEmprestimos = {};
    emprestimos.forEach(function (e) { mapaEmprestimos[String(e.numeroContrato)] = e; });

    const folhaParcelas = obterFolha_(NOMES_FOLHAS.PARCELAS);
    const dados = folhaParcelas.getDataRange().getValues();
    const cabecalhos = dados[0];

    const colNumeroContrato = cabecalhos.indexOf('numeroContrato');
    const colNumero = cabecalhos.indexOf('numero');
    const colVencimento = cabecalhos.indexOf('vencimento');
    const colTotal = cabecalhos.indexOf('total');
    const colEstado = cabecalhos.indexOf('estado');
    const colNotifVencimento = cabecalhos.indexOf('notificadoVencimentoEm');
    const colNotifAtraso = cabecalhos.indexOf('notificadoAtrasoEm');

    if (colNotifVencimento === -1 || colNotifAtraso === -1) {
      return {
        ativo: true,
        erro: 'Colunas de notificação em falta na folha "Parcelas". Execute a função "atualizarEstruturaParaNovasFuncionalidades" no editor do Apps Script uma vez (ver Setup.gs) antes de ativar as notificações.'
      };
    }

    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    let enviadasVencimento = 0;
    let enviadasAtraso = 0;
    let falhas = 0;
    let ignoradasPorErro = 0;

    for (let i = 1; i < dados.length; i++) {
      try {
        const estadoParcela = dados[i][colEstado];
        if (['Pendente', 'Parcial', 'Atrasada'].indexOf(estadoParcela) === -1) continue;

        const numeroContrato = String(dados[i][colNumeroContrato]);
        const emprestimo = mapaEmprestimos[numeroContrato];
        if (!emprestimo || ['Ativo', 'Em atraso'].indexOf(emprestimo.estado) === -1) continue;

        const cliente = mapaClientes[emprestimo.clienteCodigo];
        if (!cliente) continue;

        const vencimento = new Date(dados[i][colVencimento]);
        vencimento.setHours(0, 0, 0, 0);
        const diasParaVencimento = Math.round((vencimento.getTime() - hoje.getTime()) / 86400000);

        const dadosMensagem = {
          nomeCliente: cliente.nomeCompleto || 'Cliente',
          numeroContrato: numeroContrato,
          numeroParcela: dados[i][colNumero],
          valorParcela: Formato_.moeda_(dados[i][colTotal], config.moeda),
          dataVencimento: formatarDataBR_(vencimento),
          nomeEmpresa: config.nomeEmpresa || 'a nossa empresa'
        };

        // --- Lembrete antes do vencimento (ainda não atrasada) ---
        if (!dados[i][colNotifVencimento] && estadoParcela !== 'Atrasada' &&
            diasParaVencimento >= 0 && diasParaVencimento <= diasAntes) {
          const resultado = this._enviarComRegisto_({
            tipo: 'Vencimento', canal: canal, cliente: cliente, config: config,
            numeroContrato: numeroContrato, numeroParcela: dados[i][colNumero],
            mensagem: this._preencherModelo_(config.notificacoesMensagemAntes, dadosMensagem)
          });
          if (resultado.sucesso) {
            folhaParcelas.getRange(i + 1, colNotifVencimento + 1).setValue(agoraISO_());
            enviadasVencimento++;
          } else {
            falhas++;
          }
        }

        // --- Aviso de atraso ---
        if (!dados[i][colNotifAtraso] && estadoParcela === 'Atrasada') {
          const resultado = this._enviarComRegisto_({
            tipo: 'Atraso', canal: canal, cliente: cliente, config: config,
            numeroContrato: numeroContrato, numeroParcela: dados[i][colNumero],
            mensagem: this._preencherModelo_(config.notificacoesMensagemAtraso, dadosMensagem)
          });
          if (resultado.sucesso) {
            folhaParcelas.getRange(i + 1, colNotifAtraso + 1).setValue(agoraISO_());
            enviadasAtraso++;
          } else {
            falhas++;
          }
        }
      } catch (erroLinha) {
        // Uma parcela com dados inconsistentes não deve impedir o
        // processamento de todas as outras — regista e continua.
        ignoradasPorErro++;
        LoggerApp.erro('NotificacoesModulo.processarNotificacoesDiarias (linha ' + (i + 1) + ')', erroLinha, {});
      }
    }

    return {
      ativo: true,
      enviadasVencimento: enviadasVencimento,
      enviadasAtraso: enviadasAtraso,
      falhas: falhas,
      ignoradasPorErro: ignoradasPorErro
    };
  },

  /** Substitui {chave} no modelo pelos valores correspondentes em 'dados'. */
  _preencherModelo_: function (modelo, dados) {
    let texto = String(modelo || '');
    Object.keys(dados).forEach(function (chave) {
      texto = texto.split('{' + chave + '}').join(String(dados[chave]));
    });
    return texto;
  },

  /** Envia a mensagem pelo canal escolhido e grava sempre um registo de auditoria (sucesso ou falha). */
  _enviarComRegisto_: function (info) {
    const destinatario = this._destinatarioParaCanal_(info.canal, info.cliente);
    let sucesso = false;
    let erro = '';

    if (!destinatario) {
      erro = 'Cliente "' + (info.cliente.nomeCompleto || info.cliente.codigo) + '" sem contacto cadastrado para o canal "' + info.canal + '".';
    } else {
      try {
        this._enviar(info.canal, destinatario, info.mensagem, info.config);
        sucesso = true;
      } catch (e) {
        erro = e && e.message ? e.message : String(e);
        LoggerApp.erro('NotificacoesModulo._enviar', e, { numeroContrato: info.numeroContrato, canal: info.canal });
      }
    }

    const folha = obterFolha_(NOMES_FOLHAS.NOTIFICACOES);
    folha.appendRow([
      Utilities.getUuid(),
      info.numeroContrato,
      info.cliente.codigo,
      info.numeroParcela,
      info.tipo,
      info.canal,
      destinatario || '(sem contacto)',
      info.mensagem,
      agoraISO_(),
      sucesso,
      erro
    ]);

    return { sucesso: sucesso, erro: erro };
  },

  _destinatarioParaCanal_: function (canal, cliente) {
    if (canal === 'email') return cliente.email || '';
    // 'sms' e 'whatsapp' usam o número de telefone do cliente.
    return cliente.telefone || '';
  },

  /**
   * Ponto único de envio real. Hoje só "email" está implementado. Para
   * ligar SMS ou WhatsApp, acrescente aqui a chamada HTTP ao gateway
   * escolhido, por exemplo:
   *
   *   UrlFetchApp.fetch('https://api.seugateway.com/sms', {
   *     method: 'post',
   *     headers: { Authorization: 'Bearer ' + PropertiesService.getScriptProperties().getProperty('SMS_API_KEY') },
   *     payload: JSON.stringify({ to: destinatario, text: mensagem })
   *   });
   *
   * Guarde sempre credenciais em PropertiesService (Configurações do
   * Projeto no editor), nunca escritas diretamente aqui no código.
   */
  _enviar: function (canal, destinatario, mensagem, config) {
    if (canal === 'email') {
      if (MailApp.getRemainingDailyQuota() <= 0) {
        throw new Error('Quota diária de e-mail da conta Google esgotada. Tente novamente amanhã ou mude o canal em Configurações.');
      }
      MailApp.sendEmail({
        to: destinatario,
        subject: (config.nomeEmpresa || 'Microcrédito') + ' — Aviso de prestação',
        body: mensagem
      });
      return;
    }

    if (canal === 'sms' || canal === 'whatsapp') {
      throw new Error('O canal "' + canal + '" ainda não tem um gateway configurado. Ver o comentário em NotificacoesModulo._enviar (apps-script/Notificacoes.gs) para o ligar.');
    }

    throw new Error('Canal de notificação desconhecido: "' + canal + '".');
  },

  /** Lista o histórico de notificações, opcionalmente filtrado por contrato. Usado no detalhe do empréstimo. */
  listar: function (params) {
    let notificacoes = lerFolhaComoObjetos_(NOMES_FOLHAS.NOTIFICACOES);
    if (params.numeroContrato) {
      notificacoes = notificacoes.filter(function (n) { return String(n.numeroContrato) === String(params.numeroContrato); });
    }
    notificacoes.sort(function (a, b) { return new Date(b.dataEnvio) - new Date(a.dataEnvio); });

    const limite = parseInt(params.limite || '100', 10);
    return sucesso_(notificacoes.slice(0, limite));
  },

  /**
   * Dispara o processamento manualmente, sem esperar pelo trigger das
   * 06:00 — útil sobretudo para testar a configuração (modelo de
   * mensagem, canal, dias de antecedência) antes de a deixar a correr
   * sozinha. Restrito a Administrador.
   */
  processarAgora: function (params) {
    exigirPerfil_(params._utilizador, ['Administrador']);
    return sucesso_(this.processarNotificacoesDiarias(), 'Processamento de notificações executado.');
  }
};

/**
 * Pequeno formatador local só para não criar dependência cruzada com
 * frontend/js/utils.js (que teria o mesmo nome "Formato" mas vive num
 * mundo diferente, o do browser). Mantido deliberadamente minúsculo.
 */
const Formato_ = {
  moeda_: function (valor, moeda) {
    const numero = parseFloat(valor) || 0;
    return numero.toFixed(2) + ' ' + (moeda || 'MZN');
  }
};
