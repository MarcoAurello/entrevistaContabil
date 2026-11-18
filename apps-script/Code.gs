/**
 * Entrevista Contábil — recebe as respostas do formulário e grava na planilha.
 *
 * COMO USAR (resumo; passo a passo completo no README.md):
 *  1. Crie uma Planilha Google em branco.
 *  2. Extensões → Apps Script. Apague o conteúdo e cole ESTE arquivo.
 *  3. Execute a função `configurarPlanilha` uma vez (autorize quando pedir).
 *  4. Implantar → Nova implantação → Aplicativo da Web
 *       Executar como: Eu     |     Quem tem acesso: Qualquer pessoa
 *  5. Copie a URL terminada em /exec e cole em js/config.js (APPS_SCRIPT_URL).
 *
 * Toda vez que mudar este código, faça Implantar → Gerenciar implantações → Editar → Nova versão.
 */

var NOME_ABA = 'Respostas';

// Opcional: e-mail para receber aviso a cada resposta. Deixe '' para não receber.
var EMAIL_AVISO = '';

// Ordem das colunas na planilha. As chaves vêm do formulário (atributo name dos campos).
var COLUNAS = [
  ['id', 'ID do envio'],
  ['recebido_em', 'Recebido em'],
  ['nome', 'Nome'],
  ['escritorio', 'Escritório'],
  ['contato', 'Contato (WhatsApp/e-mail)'],
  ['cidade_uf', 'Cidade/UF'],
  ['qtd_clientes', 'Nº de clientes'],
  ['regimes', 'Regimes'],
  ['sistema', 'Sistema usado'],
  ['origem_xml', 'Origem dos XMLs'],
  ['urgencia', 'Urgência (1-5)'],
  ['ja_fez', 'O que já fez'],
  ['preocupacoes', 'Preocupações'],
  ['clientes_perguntaram', 'Clientes já perguntaram?'],
  ['usou_simulador', 'Usou simulador da Receita?'],
  ['simulador_opiniao', 'Opinião sobre o simulador'],
  ['reacao_relatorio', 'Reação ao relatório (1-5)'],
  ['utilidade_relatorio', 'O que faria / o que faltou'],
  ['cobrar_consultoria', 'Pretende cobrar adaptação?'],
  ['preco_faz_sentido', 'Faixa de preço que faz sentido'],
  ['preco_caro', 'Valor a partir do qual fica caro (R$)'],
  ['assinaria', 'Assinaria hoje?'],
  ['aceita_piloto', 'Aceita ser piloto?'],
  ['aceita_enviar_xml', 'Aceita enviar XMLs?'],
  ['melhor_horario', 'Melhor horário'],
  ['comentarios', 'Comentários'],
  ['consentimento', 'Consentimento LGPD'],
  ['enviado_em', 'Enviado em (navegador)'],
  ['versao_form', 'Versão do formulário'],
  ['origem', 'Origem da visita'],
  ['navegador', 'Navegador']
];

var LIMITE_TEXTO = 2000;

/** Rode uma vez: cria a aba, o cabeçalho e a formatação. */
function configurarPlanilha() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var aba = ss.getSheetByName(NOME_ABA) || ss.insertSheet(NOME_ABA);
  var cab = COLUNAS.map(function (c) { return c[1]; });
  aba.getRange(1, 1, 1, cab.length).setValues([cab])
    .setFontWeight('bold').setBackground('#1e4f9c').setFontColor('#ffffff')
    .setWrap(true).setVerticalAlignment('middle');
  aba.setFrozenRows(1);
  aba.setFrozenColumns(3);
  aba.setColumnWidth(1, 120);
  aba.setColumnWidth(2, 140);
  aba.setColumnWidths(3, cab.length - 2, 170);
  aba.getRange(2, 1, 999, cab.length).setWrap(true).setVerticalAlignment('top');
  Logger.log('Planilha configurada. Agora implante como Aplicativo da Web.');
}

/** Teste de saúde: abra a URL /exec no navegador. */
function doGet() {
  return json_({ ok: true, servico: 'entrevistaContabil' });
}

/** Recebe o envio do formulário. */
function doPost(e) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);
  } catch (err) {
    return json_({ ok: false, erro: 'Servidor ocupado, tente novamente.' });
  }

  try {
    if (!e || !e.postData || !e.postData.contents) {
      return json_({ ok: false, erro: 'Corpo vazio.' });
    }
    var dados;
    try { dados = JSON.parse(e.postData.contents); }
    catch (_) { return json_({ ok: false, erro: 'JSON inválido.' }); }

    // validações mínimas no servidor (o navegador também valida)
    if (!dados || typeof dados !== 'object') return json_({ ok: false, erro: 'Dados inválidos.' });
    if (!texto_(dados.nome) || !texto_(dados.contato)) return json_({ ok: false, erro: 'Nome e contato são obrigatórios.' });
    if (dados.consentimento !== 'Sim') return json_({ ok: false, erro: 'Consentimento é obrigatório.' });
    if (!texto_(dados.id)) return json_({ ok: false, erro: 'ID ausente.' });

    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var aba = ss.getSheetByName(NOME_ABA);
    if (!aba) { configurarPlanilha(); aba = ss.getSheetByName(NOME_ABA); }

    // duplicata: mesmo ID já gravado (acontece em reenvio após falha de rede)
    var ultima = aba.getLastRow();
    if (ultima >= 2) {
      var ids = aba.getRange(2, 1, ultima - 1, 1).getValues();
      for (var i = 0; i < ids.length; i++) {
        if (String(ids[i][0]) === String(dados.id)) return json_({ ok: true, duplicado: true });
      }
    }

    dados.recebido_em = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'dd/MM/yyyy HH:mm:ss');

    var linha = COLUNAS.map(function (c) { return limpar_(dados[c[0]]); });
    aba.appendRow(linha);

    avisar_(dados);
    return json_({ ok: true });
  } catch (err) {
    return json_({ ok: false, erro: 'Falha ao gravar.' });
  } finally {
    lock.releaseLock();
  }
}

/* ---------- auxiliares ---------- */

function texto_(v) { return v !== undefined && v !== null && String(v).trim() !== ''; }

/** Limita o tamanho e neutraliza fórmulas (=, +, -, @) para evitar injeção na planilha. */
function limpar_(v) {
  if (v === undefined || v === null) return '';
  var s = String(v).slice(0, LIMITE_TEXTO);
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return s;
}

function avisar_(d) {
  if (!EMAIL_AVISO) return;
  try {
    MailApp.sendEmail(
      EMAIL_AVISO,
      'Nova resposta — Entrevista Contábil',
      'Nome: ' + limpar_(d.nome) + '\n' +
      'Escritório: ' + limpar_(d.escritorio) + '\n' +
      'Contato: ' + limpar_(d.contato) + '\n' +
      'Urgência: ' + limpar_(d.urgencia) + '\n' +
      'Assinaria: ' + limpar_(d.assinaria) + '\n' +
      'Aceita piloto: ' + limpar_(d.aceita_piloto) + '\n\n' +
      'Veja todos os detalhes na planilha.'
    );
  } catch (_) { /* aviso é opcional; nunca derruba o registro */ }
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
