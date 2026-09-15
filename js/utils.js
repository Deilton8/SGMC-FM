/**
 * =====================================================================
 * UTILITÁRIOS DO FRONTEND — js/utils.js
 * =====================================================================
 * Formatação de moeda/data, máscaras de telefone e valores monetários,
 * validação de formulários, e o sistema de alertas (toasts) usado em
 * toda a aplicação.
 * =====================================================================
 */

/* =====================================================================
   FORMATAÇÃO
   ===================================================================== */

const Formato = {

  /** Formata um número como Metical: 15000 -> "15.000,00 MT" */
  moeda: function (valor) {
    const numero = parseFloat(valor) || 0;
    const partes = numero.toFixed(2).split('.');
    partes[0] = partes[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    return partes[0] + ',' + partes[1] + ' MT';
  },

  /** Formata um número sem símbolo de moeda, com separador de milhares. */
  numero: function (valor, casasDecimais) {
    const numero = parseFloat(valor) || 0;
    casasDecimais = casasDecimais === undefined ? 0 : casasDecimais;
    const partes = numero.toFixed(casasDecimais).split('.');
    partes[0] = partes[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    return partes.join(',');
  },

  /** Converte uma data (Date, ISO string, ou DD/MM/AAAA) para exibição DD/MM/AAAA. */
  data: function (valor) {
    if (!valor) return '—';
    const d = (valor instanceof Date) ? valor : new Date(valor);
    if (isNaN(d.getTime())) return String(valor);
    const dia = String(d.getDate()).padStart(2, '0');
    const mes = String(d.getMonth() + 1).padStart(2, '0');
    const ano = d.getFullYear();
    return dia + '/' + mes + '/' + ano;
  },

  /** Formata data e hora: DD/MM/AAAA HH:MM */
  dataHora: function (valor) {
    if (!valor) return '—';
    const d = (valor instanceof Date) ? valor : new Date(valor);
    if (isNaN(d.getTime())) return String(valor);
    const hora = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    return this.data(d) + ' ' + hora + ':' + min;
  },

  /** Converte uma data DD/MM/AAAA (string) para um objeto Date válido. */
  paraDate: function (dataBR) {
    if (!dataBR) return null;
    if (dataBR instanceof Date) return dataBR;
    const partes = String(dataBR).split('/');
    if (partes.length === 3) {
      return new Date(parseInt(partes[2], 10), parseInt(partes[1], 10) - 1, parseInt(partes[0], 10));
    }
    const d = new Date(dataBR);
    return isNaN(d.getTime()) ? null : d;
  },

  /** Converte uma data para o formato yyyy-mm-dd exigido por <input type="date">. */
  paraInputDate: function (valor) {
    if (!valor) return '';
    const d = (valor instanceof Date) ? valor : new Date(valor);
    if (isNaN(d.getTime())) return '';
    const ano = d.getFullYear();
    const mes = String(d.getMonth() + 1).padStart(2, '0');
    const dia = String(d.getDate()).padStart(2, '0');
    return ano + '-' + mes + '-' + dia;
  },

  /** Capitaliza a primeira letra de cada palavra (para nomes próprios). */
  tituloCaso: function (texto) {
    if (!texto) return '';
    return String(texto).toLowerCase().replace(/(^|\s)\S/g, function (letra) { return letra.toUpperCase(); });
  },

  /** Gera as iniciais de um nome completo (até 2 letras) para avatares. */
  iniciais: function (nomeCompleto) {
    if (!nomeCompleto) return '?';
    const partes = String(nomeCompleto).trim().split(/\s+/);
    if (partes.length === 1) return partes[0].substring(0, 2).toUpperCase();
    return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase();
  },

  /** Converte o estado de um badge para uma classe CSS segura (sem espaços/acentos). */
  classeBadge: function (estado) {
    return String(estado || '')
      .toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // remove acentos
      .replace(/\s+/g, '-');
  }
};

/* =====================================================================
   MÁSCARAS DE ENTRADA
   ===================================================================== */

const Mascara = {

  /**
   * Aplica máscara de telefone moçambicano ao digitar: 84 123 4567
   * Aceita 9 dígitos (formato local). Uso: Mascara.telefone(inputElement)
   */
  telefone: function (input) {
    input.addEventListener('input', function () {
      let digitos = input.value.replace(/\D/g, '').substring(0, 9);
      let formatado = digitos;
      if (digitos.length > 2) formatado = digitos.substring(0, 2) + ' ' + digitos.substring(2);
      if (digitos.length > 5) formatado = digitos.substring(0, 2) + ' ' + digitos.substring(2, 5) + ' ' + digitos.substring(5);
      input.value = formatado;
    });
  },

  /**
   * Aplica máscara monetária ao digitar (separador de milhares em tempo
   * real). O valor numérico "limpo" pode ser obtido com Mascara.valorNumerico(input).
   */
  moeda: function (input) {
    input.addEventListener('input', function () {
      let digitos = input.value.replace(/\D/g, '');
      if (!digitos) { input.value = ''; return; }
      digitos = digitos.replace(/^0+(?=\d)/, '');
      const numero = parseInt(digitos, 10);
      input.value = numero.toLocaleString('pt-PT').replace(/,/g, '.');
    });
  },

  /** Extrai o valor numérico puro de um campo com máscara de moeda aplicada. */
  valorNumerico: function (input) {
    const limpo = String(input.value || '').replace(/\./g, '').replace(/,/g, '.').replace(/[^\d.]/g, '');
    return parseFloat(limpo) || 0;
  },

  /** Aplica máscara de BI moçambicano (13 dígitos + 1 letra): 110100123456A */
  bi: function (input) {
    input.addEventListener('input', function () {
      let valor = input.value.toUpperCase().replace(/[^0-9A-Z]/g, '');
      valor = valor.substring(0, 14);
      input.value = valor;
    });
  },

  /** Aplica máscara de NUIT (9 dígitos). */
  nuit: function (input) {
    input.addEventListener('input', function () {
      input.value = input.value.replace(/\D/g, '').substring(0, 9);
    });
  }
};

/* =====================================================================
   VALIDAÇÃO DE FORMULÁRIOS
   ===================================================================== */

const Validacao = {

  /**
   * Valida um formulário HTML com base nos atributos "required" e
   * data-validacao dos campos. Marca visualmente os campos inválidos
   * e devolve true/false. Uso: Validacao.validarFormulario(formElement)
   */
  validarFormulario: function (form) {
    let valido = true;
    const campos = form.querySelectorAll('[required], [data-validacao]');

    campos.forEach(function (campo) {
      const erro = Validacao._validarCampo(campo);
      Validacao._exibirErroCampo(campo, erro);
      if (erro) valido = false;
    });

    return valido;
  },

  _validarCampo: function (campo) {
    const valor = campo.value.trim();
    const tipo = campo.dataset.validacao;

    if (campo.hasAttribute('required') && !valor) {
      return 'Este campo é obrigatório.';
    }
    if (!valor) return null; // campos opcionais vazios não são validados quanto ao tipo

    if (tipo === 'telefone') {
      const digitos = valor.replace(/\D/g, '');
      if (digitos.length < 9) return 'Introduza um número de telefone válido (9 dígitos).';
    }
    if (tipo === 'email') {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(valor)) return 'Introduza um email válido.';
    }
    if (tipo === 'numerico') {
      if (isNaN(parseFloat(valor.replace(/\./g, '').replace(',', '.')))) return 'Introduza um valor numérico.';
    }
    if (tipo === 'positivo') {
      const numero = Mascara.valorNumerico(campo);
      if (numero <= 0) return 'O valor deve ser maior que zero.';
    }
    if (tipo === 'bi') {
      if (valor.length < 12) return 'O número de BI parece incompleto.';
    }

    return null;
  },

  _exibirErroCampo: function (campo, mensagemErro) {
    campo.classList.toggle('campo-erro', !!mensagemErro);
    const container = campo.closest('.campo-grupo');
    if (!container) return;
    let elementoErro = container.querySelector('.campo-erro-texto');
    if (!elementoErro) {
      elementoErro = document.createElement('div');
      elementoErro.className = 'campo-erro-texto';
      container.appendChild(elementoErro);
    }
    elementoErro.textContent = mensagemErro || '';
    elementoErro.classList.toggle('visivel', !!mensagemErro);
  },

  /** Limpa todos os indicadores de erro visual de um formulário. */
  limparErros: function (form) {
    form.querySelectorAll('.campo-erro').forEach(function (c) { c.classList.remove('campo-erro'); });
    form.querySelectorAll('.campo-erro-texto').forEach(function (e) { e.classList.remove('visivel'); });
  }
};

/* =====================================================================
   SISTEMA DE ALERTAS (TOASTS)
   ===================================================================== */

const Alertas = (function () {

  function garantirContentor() {
    let contentor = document.getElementById('contentor-alertas');
    if (!contentor) {
      contentor = document.createElement('div');
      contentor.id = 'contentor-alertas';
      contentor.className = 'contentor-alertas';
      document.body.appendChild(contentor);
    }
    return contentor;
  }

  const ICONES = {
    sucesso: 'fa-circle-check',
    erro: 'fa-circle-exclamation',
    aviso: 'fa-triangle-exclamation',
    info: 'fa-circle-info'
  };

  function mostrar(tipo, titulo, texto, duracaoMs) {
    duracaoMs = duracaoMs || 4500;
    const contentor = garantirContentor();

    const toast = document.createElement('div');
    toast.className = 'alerta-toast alerta-toast--' + tipo;
    toast.innerHTML =
      '<i class="fa-solid ' + ICONES[tipo] + ' alerta-toast__icone"></i>' +
      '<div class="alerta-toast__conteudo">' +
        '<div class="alerta-toast__titulo">' + Utils.escaparHtml(titulo) + '</div>' +
        (texto ? '<div class="alerta-toast__texto">' + Utils.escaparHtml(texto) + '</div>' : '') +
      '</div>' +
      '<button class="alerta-toast__fechar" aria-label="Fechar"><i class="fa-solid fa-xmark"></i></button>' +
      '<div class="alerta-toast__barra" style="animation-duration:' + duracaoMs + 'ms"></div>';

    contentor.appendChild(toast);

    const remover = function () {
      toast.classList.add('saindo');
      setTimeout(function () { toast.remove(); }, 200);
    };

    toast.querySelector('.alerta-toast__fechar').addEventListener('click', remover);
    const temporizador = setTimeout(remover, duracaoMs);
    toast.addEventListener('mouseenter', function () { clearTimeout(temporizador); });

    return toast;
  }

  return {
    sucesso: function (titulo, texto) { return mostrar('sucesso', titulo, texto); },
    erro: function (titulo, texto) { return mostrar('erro', titulo, texto, 6000); },
    aviso: function (titulo, texto) { return mostrar('aviso', titulo, texto); },
    info: function (titulo, texto) { return mostrar('info', titulo, texto); }
  };
})();

/* =====================================================================
   HELPERS GERAIS
   ===================================================================== */

const Utils = {

  /**
   * Evita XSS ao inserir texto vindo de dados do utilizador em innerHTML,
   * seja como conteúdo de texto (ex.: dentro de <td>...</td>) ou como valor
   * de um atributo delimitado por aspas (ex.: data-nome="...").
   *
   * A técnica de escrever em textContent e ler de volta innerHTML escapa
   * corretamente & < > (que têm significado estrutural em conteúdo de
   * texto), mas NÃO escapa aspas simples ou duplas — estas só têm
   * significado especial dentro de um valor de atributo, contexto que essa
   * técnica não cobre. Sem o passo extra abaixo, um nome como
   * João D'Alva "O Rápido" fecharia prematuramente um atributo
   * data-nome="...", quebrando o HTML da página (confirmado com um nome
   * real durante uma validação completa do sistema).
   */
  escaparHtml: function (texto) {
    if (texto === null || texto === undefined) return '';
    const div = document.createElement('div');
    div.textContent = String(texto);
    return div.innerHTML.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  },

  /** Atraso simples baseado em Promise, útil para debounce/UX. */
  aguardar: function (ms) {
    return new Promise(function (resolver) { setTimeout(resolver, ms); });
  },

  /** Cria uma versão "debounced" de uma função (para pesquisa em tabelas). */
  debounce: function (funcao, atrasoMs) {
    let temporizador;
    return function () {
      const contexto = this, args = arguments;
      clearTimeout(temporizador);
      temporizador = setTimeout(function () { funcao.apply(contexto, args); }, atrasoMs);
    };
  },

  /** Lê parâmetros da query string da URL atual. */
  obterParametroUrl: function (nome) {
    return new URLSearchParams(window.location.search).get(nome);
  },

  /** Mostra/oculta o loader de página inteira. */
  mostrarCarregamento: function (mostrar, texto) {
    let tela = document.getElementById('tela-carregamento');
    if (mostrar) {
      if (!tela) {
        tela = document.createElement('div');
        tela.id = 'tela-carregamento';
        tela.className = 'tela-carregamento';
        tela.innerHTML = '<div class="girador"></div><div class="tela-carregamento__texto">' + Utils.escaparHtml(texto || 'A carregar...') + '</div>';
        document.body.appendChild(tela);
      } else {
        tela.style.display = 'flex';
      }
    } else if (tela) {
      tela.style.display = 'none';
    }
  },

  /** Ativa o estado "a processar" de um botão (usado ao submeter formulários). */
  definirBotaoCarregando: function (botao, carregando, textoCarregando) {
    if (carregando) {
      botao.dataset.textoOriginal = botao.innerHTML;
      botao.disabled = true;
      botao.innerHTML = '<span class="girador girador--pequeno"></span> ' + Utils.escaparHtml(textoCarregando || 'A processar...');
    } else {
      botao.disabled = false;
      if (botao.dataset.textoOriginal) botao.innerHTML = botao.dataset.textoOriginal;
    }
  }
};
