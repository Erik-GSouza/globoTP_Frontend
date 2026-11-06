# Verificação do frontend TPGlobo

## Testes automatizados

Na raiz do projeto:

```sh
pnpm install --frozen-lockfile
pnpm test
pnpm run build
```

Resultado da entrega anterior: **30 testes aprovados**, build de produção aprovado, Node **24.22.1**, pnpm **10.34.3**. O build final gerou aproximadamente 379 kB de JavaScript/CSS antes de compressão e passou pela verificação estrita de templates.

`run.mjs` transpila apenas os módulos exercitados para uma pasta temporária, executa o test runner nativo do Node e remove essa pasta ao terminar. O build do Angular complementa esses testes com validação de tipos e templates.

| Arquivo | O que verifica |
| --- | --- |
| `domain.test.mjs` | Formatação segura, palavras e parágrafos, contrato de blocos, validação, alinhamento de fala e protocolo de projeção |
| `api.test.mjs` | Corpo de login, Bearer, 401/403, ausência de repetição automática de POST/PATCH/DELETE, 204 sem corpo, respostas tardias após logout |
| `speech.test.mjs` | Reconhecedor substituto, interrupção e retomada, callbacks antigos, permissão recusada, limite de reinício, modo manual, preservação da posição e conclusão |

Os substitutos de `fetch` e `SpeechRecognition` testam o frontend; não chamam a API da equipe nem comprovam a qualidade da transcrição de um microfone real.

## Validação real informada pelo usuário em 05/11/2026

O usuário testou a aplicação Angular local conectada à API da equipe no Render (sem respostas artificiais):

| Fluxo | Evidência comunicada |
| --- | --- |
| Autenticação e roteiros | Login admin, listagem, cadastro, consulta, edição real (`PATCH`) e arquivamento lógico (`DELETE`) funcionaram |
| Apresentação manual | 7/7 verificações passaram |
| Fonte, espaçamento, contraste e espelhamento | 7/7 passaram, com posição preservada |
| Reconhecimento de voz com microfone | 7/7 passaram, incluindo salto de trecho e pausa |
| Janela externa vinculada | 7/7 passaram, inclusive atualização por voz e reabertura |
| Tela cheia e Esc | 5/5 verificações executadas passaram |
| Responsividade 390/768/1440 px | 6/6 passaram |
| Segundo monitor físico | **Não testado** |

**Total: 39 verificações manuais executadas e aprovadas, com uma verificação adicional não executada.** Trata-se de relato do usuário sobre o comportamento da aplicação em seu ambiente, não de testes automatizados feitos pelo revisor. Não equivale a garantia de funcionamento em todos os navegadores, dispositivos ou redes.

Ações de acabamento posteriores a essas verificações: favicon próprio `public/favicon.svg`, metadados de guia e documentação. Neste ambiente, **15 testes isolados de domínio passaram (15/15)**, **22 arquivos TypeScript** passaram na análise de sintaxe e os novos SVG/HTML passaram na checagem estrutural. O pacote ainda exige **a suíte completa e o build na máquina com dependências**; os 30 testes do pacote anterior não foram executados de novo aqui.

### Diagnóstico pendente: acentuação dos dados históricos

Alguns registros antigos exibem `�` no lugar de letras acentuadas (por exemplo, `Come�a` e `not�cias`). Para localizar a origem, examine o texto retornado em `GET /api/roteiros` na aba **Network > Response** do DevTools. Se o JSON já contiver `�`, investigar origem/armazenamento com o backend; se o JSON contiver a letra correta, investigar o frontend. Não mascarar a falha com uma substituição automática no Angular nem alterar dados da equipe sem autorização.

## Conferência de interface nesta entrega

Foi usada a compilação Angular em uma prévia estática, com `fixture-browser.js` injetado apenas em uma cópia separada de QA. Essa fixture responde às quatro operações HTTP consumidas e mantém os registros fictícios somente em memória. Não é importada pelo aplicativo, não está em `public/` e não integra o build de produção.

Observado na interface:

- Login com resposta de teste, listagem e consulta.
- Cadastro com categoria, bloco de fala formatado e bloco de orientação.
- Cancelar o descarte mantém o rascunho; salvar exibe o registro retornado.
- Operador abre em 0%, apresenta somente a fala e permite selecionar uma palavra.
- Ajuste de fonte, espelhamento e alternância para a visão limpa.
- Retorno ao operador preserva a posição.
- O botão de projeção abriu outra janela e manteve o operador aberto.
- A recusa de tela cheia foi tratada com aviso, preservando a visão limpa.
- Login/lista/editor e leitor foram inspecionados em contêineres de 390 e 768 px, sem rolagem horizontal da página. A área útil do leitor móvel mediu cerca de 274 px. A navegação foi ajustada e conferida com rolagem em zero ao abrir a nova tela após um formulário longo.

Foi corrigido um defeito da base em endereços HTTP comuns: a ausência de `crypto.randomUUID` impedia a abertura do leitor. Os identificadores agora usam `getRandomValues` como alternativa, preservando o modo manual. A voz continua exigindo o contexto apropriado do navegador.

### Limites desta conferência

A prévia gerenciada não conseguiu executar o compilador Angular, por uma falha de infraestrutura em `uv_resident_set_memory`; o build executado normalmente passou. A alternativa estática permitiu conferir a interface, mas não oferece fallback das rotas. Por isso, a janela `/projecao/...` abriu com `Cannot GET` nessa prévia: a vinculação e sincronização completas não foram validadas ali.

Naquela prévia, a entrada em tela cheia foi recusada; Esc físico, monitor externo, microfone real e outros navegadores não puderam ser testados **na prévia**. Posteriormente, o usuário confirmou Esc e microfone no ambiente local, mas não o monitor físico. Os resultados de verificação da base estática desta seção são **históricos** e não substituem a validação real do usuário registrada acima. Os resultados antigos de 97/228 checagens do Make não são reapresentados como resultados desta versão.

## Roteiro para testar localmente

Com o backend em execução e o frontend em `http://localhost:4200`:

1. **Login:** credenciais incorretas mostram erro; uma conta admin válida abre a lista. Recarregar exige login novamente. Abrir `/roteiros` sem sessão redireciona à entrada.
2. **Roteiro de teste:** use um título identificável, categoria e dois blocos de fala, mais uma orientação. A prévia deve preservar acentos, parágrafos e formatação. Reordene os blocos antes de salvar.
3. **Rascunho:** tente cancelar, sair e escolher outro roteiro; recuse o descarte e confirme que os campos permanecem.
4. **API real:** salve, atualize a lista e entre novamente. O registro deve vir do backend. Conferir a requisição no DevTools é mais conclusivo que apenas ver a mensagem de sucesso.
5. **Edição:** no roteiro de teste, clique em Editar, altere o título e um bloco, salve e confira a mensagem. Atualize a lista e faça novo login; os dados editados devem permanecer. Teste também Cancelar e recuse a confirmação de descarte para manter o texto.
6. **Arquivamento:** use APENAS um roteiro de teste autorizado. Clique em Arquivar, cancele uma vez para confirmar que nada mudou, repita e confirme. O item deve desaparecer da lista ativa e continuar ausente após novo login. A operação não apaga fisicamente o registro.
7. **Operador:** confira título, contagem, início parado em 0%, seleção de palavra e fonte. As orientações ficam no painel; não entram na fala. Reiniciar preserva os ajustes.
8. **Voz:** inicie, conceda a permissão e leia devagar. Faça uma pausa, retome e altere a fonte. Leia uma frase única de pelo menos quatro palavras em outro trecho para conferir reposicionamento. Fala sem correspondência deve manter a posição.
9. **Interrupções:** pause, escolha uma palavra, mude para manual e volte aos roteiros. O navegador deve encerrar a escuta. Teste também a recusa da permissão e a perda de conexão do serviço de voz.
10. **Janela externa:** abra pelo botão do operador, mantendo-o aberto. Compare a posição após avançar, voltar e alterar os ajustes do apresentador. Feche só a projeção e reabra; ela deve recuperar o ponto atual. Recarregue só a projeção. Por fim, volte aos roteiros no controlador: o texto externo deve desaparecer.
11. **Tela cheia:** teste pelo botão na visão limpa; saia com Esc físico e confira que posição e botão continuam corretos. Se houver segundo monitor, mova a projeção manualmente para ele.
12. **Larguras:** confira 390 px, 768 px e desktop. Verifique leitura útil, controles acessíveis, editor por blocos e ausência de rolagem horizontal da página.

Cadastros e alterações reais de teste persistem no banco. Use o ambiente de desenvolvimento acordado pela equipe. Arquivar um roteiro o retira da listagem ativa, mas não o apaga fisicamente.
