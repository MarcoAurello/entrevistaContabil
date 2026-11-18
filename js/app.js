(function () {
  "use strict";

  var CFG = window.ENTREVISTA_CONFIG || {};
  var TOTAL = 5;
  var DRAFT_KEY = "entrevistaContabil.rascunho.v1";
  var form = document.getElementById("form");
  var passos = Array.prototype.slice.call(document.querySelectorAll(".passo"));
  var btnVoltar = document.getElementById("voltar");
  var btnAvancar = document.getElementById("avancar");
  var btnEnviar = document.getElementById("enviar");
  var barra = document.getElementById("barra");
  var info = document.getElementById("passoInfo");
  var erro = document.getElementById("erro");
  var obrigado = document.getElementById("obrigado");
  var atual = 1;
  var enviando = false;

  var MODO_TESTE = !CFG.APPS_SCRIPT_URL || /[?&]demo\b/.test(location.search);

  /* ---------- rascunho local (opcional, nunca quebra a página) ---------- */
  function salvarRascunho() {
    try { localStorage.setItem(DRAFT_KEY, JSON.stringify(coletar(true))); } catch (e) {}
  }
  function restaurarRascunho() {
    var d;
    try { d = JSON.parse(localStorage.getItem(DRAFT_KEY) || "null"); } catch (e) { d = null; }
    if (!d) return;
    Object.keys(d).forEach(function (k) {
      var els = form.elements[k];
      if (!els) return;
      var lista = els.length !== undefined && els.tagName !== "SELECT" ? Array.prototype.slice.call(els) : [els];
      var valores = String(d[k]).split("; ");
      lista.forEach(function (el) {
        if (el.type === "checkbox" || el.type === "radio") el.checked = valores.indexOf(el.value) !== -1;
        else el.value = d[k];
      });
    });
  }
  function limparRascunho() { try { localStorage.removeItem(DRAFT_KEY); } catch (e) {} }

  /* ---------- coleta ---------- */
  function coletar(semMeta) {
    var out = {};
    Array.prototype.forEach.call(form.elements, function (el) {
      if (!el.name || el.name === "site") return;
      if (el.type === "checkbox") {
        if (el.checked) out[el.name] = out[el.name] ? out[el.name] + "; " + el.value : el.value;
      } else if (el.type === "radio") {
        if (el.checked) out[el.name] = el.value;
      } else if (el.value !== "") {
        out[el.name] = el.value.trim();
      }
    });
    if (!semMeta) {
      out.id = novoId();
      out.enviado_em = new Date().toISOString();
      out.versao_form = CFG.VERSAO_FORM || "";
      out.origem = (document.referrer || "").slice(0, 100);
      out.navegador = (navigator.userAgent || "").slice(0, 160);
    }
    return out;
  }

  var idEnvio = null;
  function novoId() {
    if (idEnvio) return idEnvio; // reenvio usa o mesmo id: o servidor descarta duplicata
    idEnvio = (window.crypto && crypto.randomUUID) ? crypto.randomUUID()
      : "id-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 10);
    return idEnvio;
  }

  /* ---------- validação por passo ---------- */
  function marcar(nome, ok) {
    var el = form.elements[nome];
    var primeiro = el && el.length !== undefined && el.tagName !== "SELECT" ? el[0] : el;
    var campo = primeiro && primeiro.closest(".campo");
    if (campo) campo.classList.toggle("invalido", !ok);
    return ok;
  }
  function marcado(nome) {
    return !!form.querySelector('[name="' + nome + '"]:checked');
  }
  function preenchido(nome) {
    var el = form.elements[nome];
    return !!(el && el.value && el.value.trim());
  }
  function validar(passo) {
    var ok = true;
    function req(cond, nome) { if (!marcar(nome, cond)) ok = false; }
    if (passo === 1) {
      req(preenchido("nome"), "nome");
      req(preenchido("contato"), "contato");
      req(preenchido("qtd_clientes"), "qtd_clientes");
      req(marcado("regimes"), "regimes");
    } else if (passo === 2) {
      req(marcado("urgencia"), "urgencia");
    } else if (passo === 3) {
      req(marcado("reacao_relatorio"), "reacao_relatorio");
    } else if (passo === 4) {
      req(marcado("preco_faz_sentido"), "preco_faz_sentido");
      req(marcado("assinaria"), "assinaria");
    } else if (passo === 5) {
      req(marcado("aceita_piloto"), "aceita_piloto");
      req(document.getElementById("consentimento").checked, "consentimento");
    }
    return ok;
  }

  function mostrarErro(msg) {
    erro.textContent = msg;
    erro.hidden = !msg;
  }

  /* ---------- navegação ---------- */
  function ir(n, semRolar) {
    atual = n;
    passos.forEach(function (p) { p.hidden = Number(p.dataset.passo) !== n; });
    barra.style.width = ((n - 1) / TOTAL * 100 + 100 / TOTAL * 0.4) + "%";
    info.textContent = "Passo " + n + " de " + TOTAL;
    btnVoltar.hidden = n === 1;
    btnAvancar.hidden = n === TOTAL;
    btnEnviar.hidden = n !== TOTAL;
    mostrarErro("");
    if (semRolar) return;
    var h = passos[n - 1].querySelector("h2");
    if (h) { h.setAttribute("tabindex", "-1"); h.focus({ preventScroll: true }); }
    window.scrollTo({ top: form.offsetTop - 60, behavior: "smooth" });
  }

  btnAvancar.addEventListener("click", function () {
    if (!validar(atual)) { mostrarErro("Preencha os campos marcados em vermelho para continuar."); return; }
    salvarRascunho();
    ir(atual + 1);
  });
  btnVoltar.addEventListener("click", function () { ir(atual - 1); });

  // Enter nos passos 1-4 avança em vez de enviar
  form.addEventListener("keydown", function (e) {
    if (e.key === "Enter" && e.target.tagName !== "TEXTAREA" && atual < TOTAL) {
      e.preventDefault();
      btnAvancar.click();
    }
  });

  // limite de 3 preocupações
  form.addEventListener("change", function (e) {
    if (e.target.name === "preocupacoes") {
      var marcados = form.querySelectorAll('[name="preocupacoes"]:checked');
      if (marcados.length > 3) {
        e.target.checked = false;
        mostrarErro("Marque no máximo 3 preocupações.");
        return;
      }
      mostrarErro("");
    }
    if (e.target.name) {
      var campo = e.target.closest(".campo");
      if (campo) campo.classList.remove("invalido");
    }
    salvarRascunho();
  });
  form.addEventListener("input", function (e) {
    var campo = e.target.closest && e.target.closest(".campo");
    if (campo) campo.classList.remove("invalido");
  });

  /* ---------- envio ---------- */
  function enviarParaPlanilha(payload) {
    var corpo = JSON.stringify(payload);
    var opts = { method: "POST", body: corpo, headers: { "Content-Type": "text/plain;charset=utf-8" } };
    return fetch(CFG.APPS_SCRIPT_URL, opts)
      .then(function (r) { return r.json(); })
      .then(function (j) {
        if (!j || j.ok !== true) throw new Error((j && j.erro) || "Resposta inesperada do servidor");
        return j;
      })
      .catch(function (e) {
        if (e instanceof TypeError) {
          // Falha de rede/CORS: tenta de novo sem ler a resposta. O servidor ignora duplicata pelo id.
          return fetch(CFG.APPS_SCRIPT_URL, { method: "POST", mode: "no-cors", body: corpo,
            headers: { "Content-Type": "text/plain;charset=utf-8" } }).then(function () { return { ok: true, naoConfirmado: true }; });
        }
        throw e;
      });
  }

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    if (enviando) return;
    if (atual !== TOTAL) { btnAvancar.click(); return; }
    // revalida todos os passos
    for (var i = 1; i <= TOTAL; i++) {
      if (!validar(i)) { ir(i); mostrarErro("Falta preencher algum campo obrigatório neste passo."); return; }
    }
    // honeypot: robô preencheu o campo escondido, finge sucesso e descarta
    if (form.elements.site && form.elements.site.value) { concluir(); return; }

    var payload = coletar(false);
    enviando = true;
    btnEnviar.disabled = true;
    btnEnviar.textContent = "Enviando...";
    mostrarErro("");

    var promessa = MODO_TESTE
      ? new Promise(function (res) { console.info("[MODO TESTE] nada foi enviado. Dados:", payload); setTimeout(function () { res({ ok: true }); }, 500); })
      : enviarParaPlanilha(payload);

    promessa.then(function () {
      concluir();
    }).catch(function (err) {
      console.error(err);
      mostrarErro("Não consegui enviar agora. Suas respostas continuam aqui; tente de novo em instantes. Se persistir, me avise por WhatsApp.");
      enviando = false;
      btnEnviar.disabled = false;
      btnEnviar.textContent = "Enviar respostas";
    });
  });

  function concluir() {
    limparRascunho();
    form.hidden = true;
    document.querySelector(".progresso").hidden = true;
    info.hidden = true;
    document.getElementById("dados").hidden = true;
    obrigado.hidden = false;
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  /* ---------- início ---------- */
  restaurarRascunho();
  if (MODO_TESTE) {
    var aviso = document.createElement("p");
    aviso.className = "peq";
    aviso.style.cssText = "background:#fff6d6;color:#6a5200;padding:6px 10px;border-radius:6px;margin:0 0 12px";
    aviso.textContent = "Modo teste: as respostas não estão sendo enviadas para a planilha.";
    document.querySelector("main").insertBefore(aviso, document.getElementById("dados"));
  }
  ir(1, true);
})();
