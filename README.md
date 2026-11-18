# Entrevista Contábil

Questionário de 5 minutos para contadores sobre a preparação para a CBS e o IBS. HTML, CSS e JavaScript puros, sem build. As respostas vão para uma **Planilha Google** por meio de um Google Apps Script.

Inclui um **relatório de exemplo (dados fictícios)** e uma explicação de quais dados a ferramenta leria, para o contador entender o que está sendo proposto.

## Estrutura

```
index.html                 questionário em 5 passos
exemplo-relatorio.html     relatório fictício + página "quais dados a ferramenta acessa"
css/style.css
js/app.js                  validação, passos, rascunho local e envio
js/config.js               URL do Apps Script (preencher)
apps-script/Code.gs        código para colar no Google Apps Script
```

## 1. Criar a planilha e o script (uma vez, ~5 minutos)

1. Crie uma **Planilha Google** em branco (pode chamar de "Entrevistas Contábil").
2. Menu **Extensões → Apps Script**.
3. Apague o conteúdo do editor e cole todo o arquivo [`apps-script/Code.gs`](apps-script/Code.gs). Salve.
4. Escolha a função **`configurarPlanilha`** na barra superior e clique em **Executar**. Autorize quando o Google pedir (é a sua própria conta). Isso cria a aba `Respostas` com o cabeçalho.
5. **Implantar → Nova implantação → Tipo: Aplicativo da Web**
   - Executar como: **Eu**
   - Quem tem acesso: **Qualquer pessoa**
6. Clique em **Implantar** e copie a **URL do aplicativo da Web** (termina em `/exec`).
7. Teste: abra essa URL no navegador. Deve aparecer `{"ok":true,"servico":"entrevistaContabil"}`.

## 2. Ligar o formulário à planilha

Abra `js/config.js` e cole a URL:

```js
window.ENTREVISTA_CONFIG = {
  APPS_SCRIPT_URL: "https://script.google.com/macros/s/XXXXXXXX/exec",
  VERSAO_FORM: "1.0"
};
```

Faça commit e publique. Sem a URL, o formulário roda em **modo teste** (nada é enviado e aparece um aviso amarelo).

> Sempre que alterar o `Code.gs`: **Implantar → Gerenciar implantações → editar (lápis) → Versão: Nova versão → Implantar**. A URL continua a mesma.

## 3. Publicar

Qualquer hospedagem estática serve. Opção mais simples, **GitHub Pages**: *Settings → Pages → Deploy from a branch → `main` / root*. O link fica em `https://marcoaurello.github.io/entrevistaContabil/`.

## 4. Testar localmente

```
python -m http.server 8080
```

Abra `http://localhost:8080`. Para simular o envio sem planilha, use `http://localhost:8080/?demo`.

## Como funciona o envio

- O navegador faz `POST` com JSON em `text/plain` (evita bloqueio de CORS) para o Apps Script.
- Cada envio tem um **ID único**. Se a rede falhar e o navegador reenviar, o script reconhece o ID e **não duplica** a linha.
- O script confere nome, contato e consentimento, limita o tamanho dos textos e **neutraliza fórmulas** (valores começando com `=`, `+`, `-`, `@`) para evitar injeção na planilha.
- Há um campo escondido anti-robô (honeypot).
- Se quiser receber um e-mail a cada resposta, preencha `EMAIL_AVISO` no `Code.gs`.

## Dados pessoais (LGPD)

O formulário pede nome e contato, com caixa de consentimento obrigatória. Os dados ficam só na sua planilha. Combine uma rotina para excluir linhas quando alguém pedir. O formulário **não pede dados de clientes** dos contadores.

## Observações

- A URL do Apps Script em `config.js` é pública. Qualquer pessoa que a descubra pode enviar linhas; por isso há validação e anti-robô, mas não é um sistema à prova de abuso. Se isso virar problema, troque a implantação (gera nova URL).
- Esta é uma pesquisa independente, sem vínculo com a Receita Federal. O relatório de exemplo usa dados inventados.
