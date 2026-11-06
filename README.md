# TPGlobo — frontend Angular

Frontend do **TP Inteligente**, baseado no visual aprovado no Figma Make.
Angular **21.2.25**, CLI/build **21.2.29**, TypeScript, componentes standalone e HTML/CSS separados.

Esta versão substitui o acesso demonstrativo pela integração com a API da equipe e acrescenta cadastro por blocos, formatação e acompanhamento por voz. O MVP usa apenas o perfil **admin**. Backend e frontend continuam em projetos separados.

## Começar no Windows

Use **Node 24** e **pnpm 10.34.3**. O Node 24.15.0 também atende aos requisitos. Extraia o ZIP e abra a pasta `tpglobo-frontend` no VS Code. No terminal dessa pasta:

```powershell
pnpm install --frozen-lockfile
pnpm run dev
```

Abra **http://localhost:4200**.

O backend da equipe está hospedado em **https://tpglobo-back-end.onrender.com**, com acesso ao banco e uma conta `admin` válida. Entre com essa conta. As credenciais públicas do antigo protótipo não funcionam nesta versão.

O arquivo `proxy.conf.json` encaminha `/api/**` para o backend durante o desenvolvimento. Para trocar o destino do backend, ajuste apenas `target` e reinicie `pnpm run dev`. A URL não deve terminar em `/api` nem `/api-docs/`. Não coloque senha de banco, segredo JWT ou credenciais em arquivos do frontend.

```powershell
pnpm test
pnpm run build
```

O build gera `dist/`. Não abra os arquivos de `dist` diretamente por `file://`.

## O que está implementado

- Login pela API, token somente em memória, guards e encerramento de sessão.
- Listagem, busca por título, consulta e criação de roteiros pela API existente.
- Edição de roteiros por `PATCH` com leitura posterior pelo `GET` para conferir o conteúdo persistido.
- Arquivamento por `DELETE` com confirmação explícita e atualização da lista via `GET`.
- Título, categoria e blocos de fala, vinheta, pausa e orientação, com ordenação.
- Formatação de trechos, prévia visual e proteção contra descarte de rascunhos.
- Operador vinculado ao roteiro salvo, visão limpa e janela externa de apresentação.
- Controles manuais, atalhos, progresso, ajuste independente de fonte/espaçamento/contraste e espelhamento horizontal/vertical.
- Leitura por voz em português usando a implementação de `SpeechRecognition` do navegador, quando disponível, com controle manual alternativo.

**Edição e arquivamento foram confirmados pelo usuário contra a API real do Render em 05/11/2026.** `DELETE` é arquivamento lógico, não exclusão física. O frontend verifica a gravação e atualiza a lista com operações reais; se uma confirmação falhar, a UI não finge sucesso nem repete automaticamente a gravação.

Não há administração de usuários, integração iNews ou sincronização entre computadores nesta entrega.

## Contrato consumido do backend

| Operação | Rota | Dados usados |
| --- | --- | --- |
| Entrar | `POST /api/auth/login` | Envia `email`, `senha`; recebe `token`, `usuario` |
| Listar | `GET /api/roteiros` | Recebe `roteiros` |
| Consultar | `GET /api/roteiros/:id` | Recebe `roteiro` |
| Cadastrar | `POST /api/roteiros` | Envia `titulo`, `categoria`, `blocos`; recebe `roteiro` |
| Editar | `PATCH /api/roteiros/:id` | Envia `titulo`, `categoria`, `blocos`; confirma a alteração por `GET /api/roteiros/:id` |
| Arquivar | `DELETE /api/roteiros/:id` | Sem corpo; confirma a remoção da listagem ativa por `GET /api/roteiros` |

As rotas protegidas recebem `Authorization: Bearer <token>`. O adaptador aceita o `_id` de 24 caracteres hexadecimais, datas `createdAt`/`updatedAt` e os blocos entregues pela API. As regras de autorização continuam no backend; o guard do Angular só controla a navegação.

Exemplo do corpo de cadastro:

```json
{
  "titulo": "Boletim da noite",
  "categoria": "outros",
  "blocos": [
    { "ordem": 1, "tipo": "fala", "texto": "**Boa noite.** Estas são as notícias." },
    { "ordem": 2, "tipo": "orientacao", "texto": "Preparar câmera dois." }
  ]
}
```

O título tem de 3 a 160 caracteres; cada bloco, até 5.000. Os tipos e as categorias correspondem aos enums do backend recebido. A ordem enviada é recalculada após mover blocos. Apenas blocos `fala` entram no texto do teleprompter; os demais aparecem em **Notas de produção**.

Erros da API aparecem na tela. Falha de rede ao cadastrar não dispara nova tentativa automática, pois a gravação pode ter ocorrido: atualize a lista antes de repetir. O rascunho permanece em memória em caso de erro.

## Convenção de formatação

O backend atual armazena `blocos[].texto` como string. Para preservar a formatação sem inventar campos na API, o frontend usa estes marcadores dentro dessa string:

| Marcador | Resultado |
| --- | --- |
| `**trecho**` | Negrito |
| `*trecho*` | Itálico |
| `==trecho==` | Destaque |
| `[trecho]{azul}` | Azul |
| `[trecho]{amarelo}` | Amarelo |
| `[trecho]{verde}` / `[trecho]{vermelho}` | Cores adicionais reconhecidas |

A barra do editor aplica negrito, itálico, destaque, azul e amarelo ao trecho selecionado. Os marcadores ficam visíveis no campo e são interpretados na prévia e no leitor. Uma barra invertida permite escapar um caractere literal. É uma notação pequena, não um interpretador completo de Markdown.

Esta convenção precisa ser conhecida pela equipe: outros consumidores que exibirem o campo diretamente verão os marcadores. HTML não é executado; a renderização usa texto e classes permitidas. Os marcadores de formatação não entram na contagem nem no acompanhamento por voz.

## Leitura por voz e controles

1. Abra um roteiro salvo com **Apresentar**. A leitura começa parada, em 0%.
2. Em **Modo de leitura**, escolha **Acompanhar minha voz**, quando disponível.
3. Clique **Iniciar leitura por voz** e permita o microfone no navegador.
4. Leia o roteiro. O destaque aponta para a próxima palavra ainda não reconhecida.
5. **Pausar**, avançar/voltar manualmente ou selecionar uma palavra interrompe a escuta. Retomar continua da posição escolhida.

O reconhecimento é configurado para `pt-BR`. A disponibilidade varia conforme navegador, serviço e permissão. Use `localhost` no computador ou HTTPS em uma hospedagem. Em um endereço HTTP comum a leitura manual continua disponível, mas o recurso de voz fica desabilitado.

A correspondência usa as palavras reconhecidas, ignorando diferenças de acentos, maiúsculas e pontuação. Um salto distante exige uma frase final reconhecida de pelo menos quatro palavras, com destino único no trecho restante. Frases ambíguas, silêncio ou fala sem correspondência mantêm a posição. **Dizer “vá para esportes” não é um comando de navegação**: é necessário falar um trecho do roteiro de destino ou reposicionar manualmente. A voz não volta automaticamente a trechos anteriores.

Não há compreensão semântica de tópicos nem garantia de reconhecer paráfrases, números por extenso, nomes próprios ou fala improvisada. Os controles manuais permitem corrigir o ponto sem encerrar a apresentação. O avanço temporal da demonstração foi retirado; no modo de voz, a velocidade acompanha as palavras reconhecidas.

O navegador pode enviar áudio ao seu próprio serviço de reconhecimento. A aplicação não grava áudio, não envia transcrição ao backend e mantém apenas o último trecho reconhecido em memória. Disponibilidade offline não é garantida. Referência: [SpeechRecognition — MDN](https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition).

| Controle | Ação |
| --- | --- |
| Espaço | Iniciar, pausar ou retomar a voz |
| Seta esquerda/direita | Palavra anterior/próxima, pausando a voz |
| Home / Reiniciar | Voltar a 0%, preservando os ajustes |
| Clique em uma palavra | Reposicionar e pausar |

Os atalhos não capturam digitação, controles de formulário, botões ou links. No modo manual, Espaço não inicia avanço automático. Ao chegar ao fim, a leitura para em 100%.

## Operador e apresentador

| Ajuste | Operador | Apresentador |
| --- | --- | --- |
| Fonte | 28–96 px; padrão 48 | 28–144 px; padrão 64 |
| Espaçamento | 1,2–2,0; padrão 1,55 | 1,2–2,0; padrão 1,55 |
| Alto contraste | Independente | Independente |
| Espelhamento H/V | Não | Combináveis |

Ajustes preservam a palavra lógica. Cada leitor a alinha perto de 35% da área útil. O espelhamento transforma somente o texto. As visões da mesma aba compartilham posição e execução.

**Abrir apresentador em outra janela** mantém o operador como controlador. Mova a janela manualmente para o segundo monitor, se houver. A projeção recebe somente o texto e o estado necessários, por mensagens entre janelas da mesma origem; não recebe o token de login. Não abra a rota da projeção digitando o endereço: ela precisa do vínculo com a janela que a abriu.

Há validação de origem, janela remetente, identificadores, formato e sequência. A projeção é passiva. Fechar somente a projeção preserva o operador; voltar aos roteiros, sair ou encerrar o controlador retira seu conteúdo. A perda de vínculo tem prazo nominal de 15 segundos, sujeito à temporização do navegador.

**Tela cheia** exige clique. Se o navegador recusar, um aviso é mostrado e a leitura continua. O usuário validou abertura, sincronização da janela externa, tela cheia e saída por Esc em sua máquina em 05/11/2026. **O segundo monitor físico ainda não foi testado**; veja `tests/README.md`.

## Sessão e dados

O token não vai para localStorage ou sessionStorage. Recarregar a página exige novo login. O vencimento do token ou um HTTP 401 encerra a sessão; HTTP 403 apresenta a recusa sem inventar permissão. Sair encerra também a escuta e a apresentação.

Roteiros salvos pertencem ao backend. Rascunhos e ajustes de leitura são temporários. O descarte de um rascunho pede confirmação; recusar mantém a edição. Em caso de sessão expirada durante o cadastro ou a edição, copie o rascunho antes de sair. Recarregar/fechar pode apresentar o aviso nativo do navegador, conforme suas regras.

Os dados antigos em `tpglobo.demo.scripts.v1` não são usados, apagados nem migrados automaticamente para o servidor.

## Hospedagem futura

- Servir `dist/` por HTTPS.
- Encaminhar `/api/**` para o backend real, preservando o caminho e os cabeçalhos necessários.
- Aplicar fallback de rotas Angular para `index.html`, inclusive `/operador/...` e `/projecao/...`. Não transformar respostas de `/api` em HTML.
- `proxy.conf.json` funciona somente no servidor de desenvolvimento; não configura uma hospedagem de produção.
- Manter as duas janelas na mesma origem. Políticas que rompam a relação com `window.opener` precisam ser consideradas ao configurar a hospedagem.

## Identidade visual e acentuação

O favicon em `public/favicon.svg` foi desenhado para esta aplicação com o mesmo motivo de **monitor e linhas de leitura** da marca exibida no cabeçalho. `index.html` aponta para esse arquivo e declara a cor escura da interface. A mudança é visual e não altera autenticação ou requisições à API.

Alguns roteiros **antigos** exibidos pelo backend apresentaram o caractere de substituição `�` em palavras acentuadas, por exemplo `Come�a` e `not�cias`. Não há evidência suficiente de que o frontend esteja corrompendo a resposta. Para localizar a origem, consulte a resposta de `GET /api/roteiros` nas ferramentas de rede do navegador: se o texto já vier com `�` no JSON, o conteúdo recebido está incorreto; se o JSON estiver correto e a tela estiver diferente, investigue a renderização. **Não aplique substituições automáticas aos dados**, pois a letra original pode ter sido perdida. Com autorização, o registro afetado pode ser corrigido manualmente pelo editor.

## Organização e limpeza

| Caminho | Responsabilidade |
| --- | --- |
| `src/app/core/` | Sessão HTTP e acesso a roteiros |
| `src/app/models/` | Contrato, formatação e adaptação para o leitor |
| `src/app/pages/` | Login, roteiros, operador e entrada da projeção |
| `src/app/presentation/` | Estado da leitura, reconhecimento e comunicação entre janelas |
| `src/app/script-reader/` | Texto, seleção e alinhamento |
| `src/app/presenter-view/` | Visão limpa e tela cheia |
| `tests/` | Testes de contrato/lógica e roteiro de verificação local |

Foram retirados os scripts/configurações exclusivos do Make, instruções antigas duplicadas, login público demonstrativo, serviços de CRUD local, conteúdo de exemplo de produção e estilos sem uso. O ZIP original foi preservado. README e AGENTS foram atualizados porque continuam úteis à manutenção. O pacote não contém `node_modules`, `dist`, caches, `.env` ou histórico Git.

Nenhuma dependência foi acrescentada e as versões existentes foram mantidas. Nenhum commit, push, publicação, colaborador ou coautoria de IA foi criado. A identidade dos commits deve continuar sendo a dos integrantes humanos da equipe.

## Verificação e evidências atualizadas em 05/11/2026

- **API real:** o usuário confirmou login admin, listagem, cadastro, consulta, edição (`PATCH`) e arquivamento lógico (`DELETE`) no Render, com o roteiro de integração exibido após salvamento.
- **Testes manuais:** **39 de 39 verificações executadas passaram**: apresentação manual (7), personalização (7), voz real (7), janela externa (7), tela cheia (5) e responsividade em 390/768/1440 px (6). A verificação de segundo monitor físico foi marcada **não testada**, não aprovada.
- **Teste automatizado anterior:** 30 testes aprovados e build de produção aprovado em Node 24.22.1 / pnpm 10.34.3 **antes** desta rodada de alterações; esse resultado não é atribuído ao novo pacote.
- **Pendências:** executar `pnpm test` e `pnpm run build` após aplicar os arquivos mais recentes; conferir o favicon na guia, investigar os roteiros históricos com acentos quebrados, e testar segundo monitor/mais navegadores quando houver ambiente disponível.

O ambiente utilizado na elaboração desta revisão não tinha dependências Angular instaladas nem acesso ao registro npm; por isso não foi possível executar aqui a suíte completa ou o build. Foram realizados **15 testes isolados de domínio (15/15 aprovados)** com TypeScript do ambiente, análise de sintaxe de **22 arquivos TypeScript (sem erros)** e validação da estrutura SVG/HTML/UTF-8. Esses testes parciais não substituem `pnpm test` nem `pnpm run build`. As alterações desta rodada são limitadas a favicon, metadados HTML e documentação. Os resultados detalhados e limites estão em [`tests/README.md`](tests/README.md).
