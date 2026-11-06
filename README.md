# TPGlobo — frontend Angular

Frontend do **TP Inteligente**, baseado no visual aprovado no Figma Make.

O MVP usa apenas o perfil **admin**.

## Começar no Windows

Abra a pasta `tpglobo-frontend` no VS Code. No terminal dessa pasta:

```powershell
pnpm install --frozen-lockfile
pnpm run dev
```

Abra **http://localhost:4200**.

O backend da equipe está hospedado em **https://tpglobo-back-end.onrender.com**, com acesso ao banco e uma conta `admin` válida. Entre com essa conta.

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

As rotas protegidas recebem `Authorization: Bearer <token>`. O adaptador aceita o `_id` de 24 caracteres hexadecimais, datas `createdAt`/`updatedAt` e os blocos entregues pela API.

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

**Tela cheia** exige clique. Se o navegador recusar, um aviso é mostrado e a leitura continua. **O segundo monitor físico ainda não foi testado**; veja `tests/README.md`.

## Sessão e dados

O token não vai para localStorage ou sessionStorage. Recarregar a página exige novo login. O vencimento do token ou um HTTP 401 encerra a sessão; HTTP 403 apresenta a recusa sem inventar permissão. Sair encerra também a escuta e a apresentação.

Roteiros salvos pertencem ao backend. Rascunhos e ajustes de leitura são temporários. O descarte de um rascunho pede confirmação; recusar mantém a edição. Em caso de sessão expirada durante o cadastro ou a edição, copie o rascunho antes de sair. Recarregar/fechar pode apresentar o aviso nativo do navegador, conforme suas regras.

Os dados antigos em `tpglobo.demo.scripts.v1` não são usados, apagados nem migrados automaticamente para o servidor.

## Identidade visual

O favicon em `public/favicon.svg` foi desenhado para esta aplicação com o mesmo motivo de **monitor e linhas de leitura** da marca exibida no cabeçalho. `index.html` aponta para esse arquivo e declara a cor escura da interface.


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

## Verificação e evidências atualizadas em 05/11/2026

O ambiente utilizado na elaboração desta revisão não tinha dependências Angular instaladas nem acesso ao registro npm; por isso não foi possível executar a suíte completa ou o build. Foram realizados **15 testes isolados de domínio (15/15 aprovados)** com TypeScript do ambiente, análise de sintaxe de **22 arquivos TypeScript (sem erros)** e validação da estrutura SVG/HTML/UTF-8. Esses testes parciais não substituem `pnpm test` nem `pnpm run build`.
