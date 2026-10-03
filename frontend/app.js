/**
 * Modelos de Dados Seguros (Camada Model)
 * Padronizam e garantem os tipos corretos de dados inseridos na aplicação.
 */

class Produto {
    constructor(id, nome, codigo, categoria, preco, quantidade, estoqueMinimo) {
        this.id = String(id).trim();
        this.nome = String(nome).trim();
        this.codigo = String(codigo).trim().toUpperCase();
        this.categoria = String(categoria).trim();
        this.preco = parseFloat(preco) || 0;
        this.quantidade = parseInt(quantidade, 10) || 0;
        this.estoqueMinimo = parseInt(estoqueMinimo, 10) || 0;
    }
}

class Movimentacao {
    constructor(id, produtoId, tipo, quantidade, data, observacao, hora) {
        this.id = String(id).trim();
        this.produtoId = String(produtoId).trim();
        this.tipo = String(tipo).trim().toLowerCase(); // "entrada" ou "saida"
        this.quantidade = parseInt(quantidade, 10) || 0;
        this.data = String(data).trim(); // formato YYYY-MM-DD
        this.observacao = String(observacao).trim();
        this.hora = String(hora).trim(); // formato HH:MM
    }
}


/**
 * Comunicação com o backend (API Spring Boot)
 * Endereço do servidor e função auxiliar para fazer as chamadas fetch.
 */
const API_URL = 'http://localhost:8080';

async function requisitarApi(caminho, opcoes = {}) {
    let resposta;
    try {
        resposta = await fetch(API_URL + caminho, opcoes);
    } catch (erro) {
        throw new Error('Não foi possível conectar ao servidor. Verifique se o backend está ligado.');
    }

    if (!resposta.ok) {
        let mensagem = 'Erro ao comunicar com o servidor.';
        try {
            const corpo = await resposta.json();
            if (corpo && corpo.erro) mensagem = corpo.erro;
        } catch (erro) {
            // resposta sem corpo JSON: mantém a mensagem padrão
        }
        throw new Error(mensagem);
    }

    if (resposta.status === 204) return null;
    return resposta.json();
}


/**
 * Controller de Estoque (Camada de Dados)
 * Agora os dados ficam no banco MySQL, acessados pela API do backend.
 * A lista local (this.produtos / this.movimentacoes) é só uma cópia para a tela.
 */
class EstoqueController {
    constructor() {
        this.produtos = [];
        this.movimentacoes = [];
    }

    /**
     * Busca produtos e movimentações no backend e atualiza as listas locais.
     */
    async carregarDados() {
        const [produtosApi, movimentacoesApi] = await Promise.all([
            requisitarApi('/produtos'),
            requisitarApi('/movimentacoes')
        ]);

        this.produtos = produtosApi.map(p =>
            new Produto(p.id, p.nome, p.codigo, p.categoria, p.preco, p.quantidade, p.estoqueMinimo)
        );

        // O backend devolve o produto inteiro dentro da movimentação (m.produto)
        this.movimentacoes = movimentacoesApi.map(m =>
            new Movimentacao(m.id, m.produto ? m.produto.id : '', m.tipo, m.quantidade, m.data, m.observacao || '', m.hora || '')
        );
    }

    /**
     * Cadastra um novo produto no backend.
     */
    async adicionarProduto(dados) {
        if (!dados.nome || !dados.codigo || !dados.categoria || dados.preco === undefined || dados.quantidade === undefined || dados.estoqueMinimo === undefined) {
            throw new Error("Campos obrigatórios ausentes para a criação do produto.");
        }

        // Verificação rápida no front; o backend também confere o código único
        const codigoNormalizado = String(dados.codigo).trim().toUpperCase();
        if (this.produtos.some(p => p.codigo === codigoNormalizado)) {
            throw new Error("Um produto com este código identificador já existe.");
        }

        await requisitarApi('/produtos', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                nome: String(dados.nome).trim(),
                codigo: codigoNormalizado,
                categoria: String(dados.categoria).trim(),
                preco: dados.preco,
                quantidade: dados.quantidade,
                estoqueMinimo: dados.estoqueMinimo
            })
        });

        await this.carregarDados();
    }

    /**
     * Registra uma movimentação no backend. É o servidor que atualiza a
     * quantidade do produto e recusa saídas maiores que o estoque.
     */
    async adicionarMovimentacao(dados) {
        if (!dados.produtoId || !dados.tipo || dados.quantidade === undefined || !dados.data) {
            throw new Error("Campos obrigatórios ausentes para registrar a movimentação.");
        }

        const produto = this.produtos.find(p => p.id === dados.produtoId);
        if (!produto) {
            throw new Error("O produto selecionado para a movimentação não existe.");
        }

        const quantidadeDesejada = parseInt(dados.quantidade, 10);
        if (isNaN(quantidadeDesejada) || quantidadeDesejada <= 0) {
            throw new Error("A quantidade de movimentação deve ser maior que zero.");
        }

        await requisitarApi('/movimentacoes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                produtoId: Number(dados.produtoId),
                tipo: dados.tipo.toLowerCase(),
                quantidade: quantidadeDesejada,
                data: dados.data,
                observacao: dados.observacao || ""
            })
        });

        await this.carregarDados();
    }

    /**
     * Remove um produto (e suas movimentações) no backend.
     */
    async excluirProduto(id) {
        await requisitarApi('/produtos/' + id, { method: 'DELETE' });
        await this.carregarDados();
        return true;
    }
}


/**
 * Controller de Interface (UI)
 * Responsável exclusivamente por gerenciar o estado visual global da aplicação.
 */
class UIController {
    constructor() {
        this.inicializarTema();
    }

    inicializarTema() {
        const temaSalvo = localStorage.getItem('tema_selecionado') || 'claro';
        this.aplicarTema(temaSalvo);
        
        const seletorTema = document.getElementById('seletor-tema');
        if (seletorTema) {
            seletorTema.value = temaSalvo;
        }
    }

    aplicarTema(tema) {
        document.documentElement.setAttribute('data-theme', tema);
        localStorage.setItem('tema_selecionado', tema);
    }
}


// Inicialização segura após o carregamento da árvore do DOM
document.addEventListener('DOMContentLoaded', async () => {
    // Instancia os respectivos Controllers locais de forma isolada
    const ui = new UIController();
    const estoque = new EstoqueController();

    // Referências de DOM mantidas de forma idêntica
    const menuNavegacao = document.getElementById('menu-navegacao');
    const seletorTema = document.getElementById('seletor-tema');
    
    // Referências do formulário de cadastro e listagem
    const formCadastro = document.getElementById('form-cadastro');
    const listaEstoqueCorpo = document.getElementById('lista-estoque-corpo');
    const toast = document.getElementById('toast');

    // Referências de Movimentações
    const selectMovProduto = document.getElementById('mov-produto');
    const formMovimentacao = document.getElementById('form-movimentacao');
    const inputMovData = document.getElementById('mov-data');

    // Referências do Histórico
    const listaHistoricoCorpo = document.getElementById('lista-historico-corpo');

    // Referências do Dashboard (ETAPA 8)
    const totalProdutosEl = document.getElementById('total-produtos');
    const valorTotalEl = document.getElementById('valor-total');
    const itensAlertaEl = document.getElementById('itens-alerta');

    // --- ELEMENTOS DE CONTROLE DA ETAPA 6 e 7 ---
    // Aba Estoque
    const buscaEstoque = document.getElementById('busca-estoque');
    const filtroCategoria = document.getElementById('filtro-categoria');
    const ordenarEstoque = document.getElementById('ordenar-estoque');
    const btnPagAnt = document.querySelector('#tab-estoque .btn-pagination:first-child');
    const btnPagProx = document.querySelector('#tab-estoque .btn-pagination:last-child');
    const pagInfo = document.querySelector('#tab-estoque .pagination-info');

    // Aba Histórico
    const buscaHistorico = document.getElementById('busca-historico');
    const filtroHistoricoTipo = document.getElementById('filtro-historico-tipo');

    // Referências de Configurações (ETAPA 9)
    const btnExportar = document.getElementById('btn-exportar');
    const btnImportar = document.getElementById('btn-importar');
    const inputImportarArquivo = document.getElementById('input-importar-arquivo');
    const btnLimpar = document.getElementById('btn-limpar');

    // Estado local da paginação do estoque
    let paginaAtualEstoque = 1;
    const ITENS_POR_PAGINA = 5;

    let timeoutToast = null;

    /**
     * Auxiliar contra ataques de injeção de script (XSS).
     * Escapa caracteres sensíveis do HTML vindos dos inputs do usuário.
     */
    function escapeHTML(str) {
        return String(str).replace(/[&<>'"/]/g, (s) => {
            const entidades = {
                '&': '&amp;',
                '<': '&lt;',
                '>': '&gt;',
                '"': '&quot;',
                "'": '&#x27;',
                '/': '&#x2F;'
            };
            return entidades[s] || s;
        });
    }

    /**
     * Gerenciador de Avisos Globais (Toast)
     * Exibe alertas temporários com estilos contextuais de sucesso ou erro.
     */
    function mostrarNotificacao(mensagem, erro = false) {
        if (!toast) return;

        clearTimeout(timeoutToast);

        toast.textContent = mensagem;
        toast.className = 'toast'; // Reseta classes anteriores

        if (erro) {
            toast.style.backgroundColor = 'var(--danger)';
        } else {
            toast.style.backgroundColor = 'var(--success)';
        }

        toast.classList.remove('hidden');

        // Oculta a notificação suavemente após 3 segundos
        timeoutToast = setTimeout(() => {
            toast.classList.add('hidden');
        }, 3000);
    }

    /**
     * Renderização Dinâmica da Tabela de Inventário (ATUALIZADA NA ETAPA 7)
     * Aplica busca, filtragem por categoria, ordenação, paginação e badges dinâmicos de status.
     */
    function renderizarTabelaEstoque() {
        if (!listaEstoqueCorpo) return;

        // 1. FILTRAGEM (Busca Textual + Categoria)
        const termoBusca = buscaEstoque ? buscaEstoque.value.toLowerCase().trim() : "";
        const categoriaSel = filtroCategoria ? filtroCategoria.value : "todos";

        let produtosFiltrados = estoque.produtos.filter(produto => {
            const atendeBusca = produto.nome.toLowerCase().includes(termoBusca) || 
                                 produto.codigo.toLowerCase().includes(termoBusca);
            const atendeCategoria = (categoriaSel === "todos" || produto.categoria === categoriaSel);
            return atendeBusca && atendeCategoria;
        });

        // 2. ORDENAÇÃO
        const criterioOrdenacao = ordenarEstoque ? ordenarEstoque.value : "nome-asc";
        produtosFiltrados.sort((a, b) => {
            if (criterioOrdenacao === "nome-asc") {
                return a.nome.localeCompare(b.nome);
            } else if (criterioOrdenacao === "nome-desc") {
                return b.nome.localeCompare(a.nome);
            } else if (criterioOrdenacao === "qtd-asc") {
                return a.quantidade - b.quantidade;
            } else if (criterioOrdenacao === "qtd-desc") {
                return b.quantidade - a.quantidade;
            }
            return 0;
        });

        // 3. PAGINAÇÃO
        const totalItens = produtosFiltrados.length;
        const totalPaginas = Math.ceil(totalItens / ITENS_POR_PAGINA) || 1;

        // Garante que a página atual não ultrapasse os limites reais de dados resultantes
        if (paginaAtualEstoque > totalPaginas) {
            paginaAtualEstoque = totalPaginas;
        }
        if (paginaAtualEstoque < 1) {
            paginaAtualEstoque = 1;
        }

        const indiceInicial = (paginaAtualEstoque - 1) * ITENS_POR_PAGINA;
        const indiceFinal = indiceInicial + ITENS_POR_PAGINA;
        const produtosPaginados = produtosFiltrados.slice(indiceInicial, indiceFinal);

        // Atualiza os controles visuais de paginação
        if (pagInfo) {
            pagInfo.textContent = `Página ${paginaAtualEstoque} de ${totalPaginas}`;
        }
        if (btnPagAnt) {
            btnPagAnt.disabled = (paginaAtualEstoque === 1);
        }
        if (btnPagProx) {
            btnPagProx.disabled = (paginaAtualEstoque === totalPaginas);
        }

        // Se o resultado filtrado estiver vazio, exibe o placeholder correspondente
        if (produtosPaginados.length === 0) {
            listaEstoqueCorpo.innerHTML = `
                <tr>
                    <td colspan="8" class="table-empty">Nenhum produto encontrado com os filtros aplicados.</td>
                </tr>
            `;
            return;
        }

        // Mapeia e constrói a tabela sob validação estrita de strings seguras contra XSS
        listaEstoqueCorpo.innerHTML = produtosPaginados.map(produto => {
            const precoFormatado = Number(produto.preco).toLocaleString('pt-BR', {
                style: 'currency',
                currency: 'BRL'
            });

            // LÓGICA DE ALERTA DE ESTOQUE (ETAPA 7)
            let statusHTML = '';
            let classeLinha = '';

            if (produto.quantidade === 0) {
                statusHTML = `<span class="badge-status badge-danger">Zerado</span>`;
                classeLinha = 'row-alert-danger';
            } else if (produto.quantidade <= produto.estoqueMinimo) {
                statusHTML = `<span class="badge-status badge-warning">Estoque Baixo</span>`;
                classeLinha = 'row-alert-warning';
            } else {
                statusHTML = `<span class="badge-status badge-success">Normal</span>`;
            }

            return `
                <tr class="${classeLinha}">
                    <td>${escapeHTML(produto.nome)}</td>
                    <td><code>${escapeHTML(produto.codigo)}</code></td>
                    <td>${escapeHTML(produto.categoria)}</td>
                    <td>${produto.quantidade}</td>
                    <td>${produto.estoqueMinimo}</td>
                    <td>${precoFormatado}</td>
                    <td>${statusHTML}</td>
                    <td>
                        <button class="btn-icon delete btn-excluir-produto" data-id="${produto.id}" title="Excluir Produto">
                            <i class="fa-solid fa-trash-can"></i>
                        </button>
                    </td>
                </tr>
            `;
        }).join('');
    }

    /**
     * Sincronização Dinâmica do Seletor de Produtos para Movimentações
     * Preenche o select com os produtos cadastrados ou exibe um placeholder adequado se vazio.
     */
    function popularSelectProdutos() {
        if (!selectMovProduto) return;

        if (estoque.produtos.length === 0) {
            selectMovProduto.innerHTML = `<option value="" disabled selected>Nenhum produto cadastrado</option>`;
            return;
        }

        // Reconstrói a lista garantindo a sanitização e formatação padrão das opções
        const optionsHTML = estoque.produtos.map(produto => {
            return `<option value="${produto.id}">${escapeHTML(produto.nome)} (${escapeHTML(produto.codigo)})</option>`;
        }).join('');

        selectMovProduto.innerHTML = `
            <option value="" disabled selected>Selecione o produto...</option>
            ${optionsHTML}
        `;
    }

    /**
     * Inicializa o campo de data com o dia de hoje (formato YYYY-MM-DD)
     */
    function inicializarDataHoje() {
        if (inputMovData) {
            const hoje = new Date();
            const ano = hoje.getFullYear();
            const mes = String(hoje.getMonth() + 1).padStart(2, '0');
            const dia = String(hoje.getDate()).padStart(2, '0');
            inputMovData.value = `${ano}-${mes}-${dia}`;
        }
    }

    /**
     * Renderização Dinâmica do Histórico de Movimentações
     * Exibe o histórico aplicando busca textual e filtro de tipo.
     */
    function renderizarTabelaHistorico() {
        if (!listaHistoricoCorpo) return;

        // 1. FILTRAGEM (Busca por Produto/Observação + Tipo de Transação)
        const termoBusca = buscaHistorico ? buscaHistorico.value.toLowerCase().trim() : "";
        const tipoSel = filtroHistoricoTipo ? filtroHistoricoTipo.value.toLowerCase() : "todos";

        let movimentacoesFiltradas = estoque.movimentacoes.filter(mov => {
            // Obtém o nome do produto mesmo que ele tenha sido removido para a comparação textual
            const produtoAssociado = estoque.produtos.find(p => p.id === mov.produtoId);
            const nomeProduto = produtoAssociado ? produtoAssociado.nome.toLowerCase() : "produto removido";
            const observacaoText = mov.observacao.toLowerCase();

            const atendeBusca = nomeProduto.includes(termoBusca) || observacaoText.includes(termoBusca);
            const atendeTipo = (tipoSel === "todos" || mov.tipo === tipoSel);

            return atendeBusca && atendeTipo;
        });

        if (movimentacoesFiltradas.length === 0) {
            listaHistoricoCorpo.innerHTML = `
                <tr>
                    <td colspan="6" class="table-empty">Nenhuma movimentação localizada com os filtros aplicados.</td>
                </tr>
            `;
            return;
        }

        // 2. ORDENAÇÃO (Mais recente para a mais antiga)
        movimentacoesFiltradas.sort((a, b) => {
            const datetimeA = `${a.data}T${a.hora || '00:00'}`;
            const datetimeB = `${b.data}T${b.hora || '00:00'}`;
            return datetimeB.localeCompare(datetimeA);
        });

        // 3. IMPRESSÃO EM TELA
        listaHistoricoCorpo.innerHTML = movimentacoesFiltradas.map(mov => {
            let dataFormatada = mov.data;
            if (mov.data.includes('-')) {
                const partes = mov.data.split('-');
                if (partes.length === 3) {
                    dataFormatada = `${partes[2]}/${partes[1]}/${partes[0]}`;
                }
            }

            const produtoAssociado = estoque.produtos.find(p => p.id === mov.produtoId);
            const nomeProduto = produtoAssociado ? produtoAssociado.nome : "Produto removido";
            const tipoAmigavel = mov.tipo === 'entrada' ? 'Entrada' : 'Saída';

            return `
                <tr>
                    <td>${dataFormatada}</td>
                    <td>${mov.hora || '-'}</td>
                    <td>${escapeHTML(nomeProduto)}</td>
                    <td>${tipoAmigavel}</td>
                    <td>${mov.quantidade}</td>
                    <td>${escapeHTML(mov.observacao)}</td>
                </tr>
            `;
        }).join('');
    }

    /**
     * Atualização dos Indicadores do Dashboard (ETAPA 8)
     * Reaproveita a mesma regra de alerta (quantidade <= estoqueMinimo) usada na
     * tabela de Estoque, para que os dois pontos da interface nunca divirjam.
     */
    function atualizarDashboard() {
        if (!totalProdutosEl && !valorTotalEl && !itensAlertaEl) return;

        const totalProdutos = estoque.produtos.length;

        const valorTotal = estoque.produtos.reduce((soma, produto) => {
            return soma + (produto.preco * produto.quantidade);
        }, 0);

        const itensEmAlerta = estoque.produtos.filter(produto => {
            return produto.quantidade <= produto.estoqueMinimo;
        }).length;

        if (totalProdutosEl) totalProdutosEl.textContent = totalProdutos;
        if (valorTotalEl) {
            valorTotalEl.textContent = valorTotal.toLocaleString('pt-BR', {
                style: 'currency',
                currency: 'BRL'
            });
        }
        if (itensAlertaEl) itensAlertaEl.textContent = itensEmAlerta;
    }

    /**
     * Exportação de Dados (ETAPA 9)
     * Empacota produtos e movimentações num único JSON, com metadados de
     * versão/data, para permitir restauração posterior via importação.
     */
    function exportarDados() {
        try {
            const pacoteExportacao = {
                versao: 1,
                exportadoEm: new Date().toISOString(),
                produtos: estoque.produtos,
                movimentacoes: estoque.movimentacoes
            };

            const conteudoJSON = JSON.stringify(pacoteExportacao, null, 2);
            const blob = new Blob([conteudoJSON], { type: 'application/json' });
            const url = URL.createObjectURL(blob);

            const dataAtual = new Date().toISOString().slice(0, 10);
            const link = document.createElement('a');
            link.href = url;
            link.download = `stockmaster-backup-${dataAtual}.json`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            // Libera a URL temporária do objeto assim que o download é disparado
            URL.revokeObjectURL(url);

            mostrarNotificacao("Dados exportados com sucesso!", false);
        } catch (error) {
            console.error("Falha ao exportar dados:", error);
            mostrarNotificacao("Não foi possível exportar os dados.", true);
        }
    }

    /**
     * Importação de Dados
     * Desativada nesta versão: os dados agora ficam no banco MySQL e o backend
     * ainda não tem endpoint para importação em lote.
     */
    function importarDados() {
        mostrarNotificacao("Importação indisponível: os dados agora ficam no banco de dados.", true);
    }

    /**
     * Limpeza Total do Banco de Dados (ETAPA 9)
     * Ação destrutiva e irreversível: exige confirmação explícita do usuário
     * antes de remover produtos e movimentações do banco de dados.
     */
    async function limparBancoDados() {
        const confirmado = confirm(
            "Tem certeza que deseja apagar TODOS os produtos e movimentações? Esta ação não pode ser desfeita."
        );
        if (!confirmado) return;

        try {
            for (const produto of [...estoque.produtos]) {
                await requisitarApi('/produtos/' + produto.id, { method: 'DELETE' });
            }
            await estoque.carregarDados();

            paginaAtualEstoque = 1;
            renderizarTabelaEstoque();
            popularSelectProdutos();
            renderizarTabelaHistorico();
            atualizarDashboard();

            mostrarNotificacao("Banco de dados limpo com sucesso.", false);
        } catch (error) {
            mostrarNotificacao(error.message, true);
        }
    }

    // --- TRATADORES DE EVENTO ---

    /**
     * Submissão do Formulário de Cadastro (Adicionar Produto)
     */
    if (formCadastro) {
        formCadastro.addEventListener('submit', async (e) => {
            e.preventDefault();

            try {
                const dadosInput = {
                    nome: document.getElementById('cad-nome').value,
                    codigo: document.getElementById('cad-codigo').value,
                    categoria: document.getElementById('cad-categoria').value,
                    preco: parseFloat(document.getElementById('cad-preco').value),
                    quantidade: parseInt(document.getElementById('cad-qtd').value, 10),
                    estoqueMinimo: parseInt(document.getElementById('cad-minimo').value, 10)
                };

                await estoque.adicionarProduto(dadosInput);

                mostrarNotificacao(`Produto "${dadosInput.nome}" cadastrado com sucesso!`, false);
                formCadastro.reset();
                
                paginaAtualEstoque = 1; // Reseta a paginação para a primeira página
                renderizarTabelaEstoque();
                popularSelectProdutos();
                atualizarDashboard();
            } catch (error) {
                mostrarNotificacao(error.message, true);
            }
        });
    }

    /**
     * Delegação de Eventos para Exclusão de Produtos
     */
    if (listaEstoqueCorpo) {
        listaEstoqueCorpo.addEventListener('click', async (e) => {
            const botaoExcluir = e.target.closest('.btn-excluir-produto');
            if (botaoExcluir) {
                const idProduto = botaoExcluir.dataset.id;
                
                try {
                    await estoque.excluirProduto(idProduto);
                    mostrarNotificacao("Produto removido do estoque.", false);
                    
                    paginaAtualEstoque = 1; // Reseta a paginação para a primeira página
                    renderizarTabelaEstoque();
                    popularSelectProdutos();
                    renderizarTabelaHistorico();
                    atualizarDashboard();
                } catch (error) {
                    mostrarNotificacao(error.message, true);
                }
            }
        });
    }

    /**
     * Submissão do Formulário de Movimentações (Entrada / Saída)
     */
    if (formMovimentacao) {
        formMovimentacao.addEventListener('submit', async (e) => {
            e.preventDefault();

            try {
                const dadosMovimentacao = {
                    tipo: document.getElementById('mov-tipo').value,
                    produtoId: document.getElementById('mov-produto').value,
                    quantidade: parseInt(document.getElementById('mov-qtd').value, 10),
                    data: document.getElementById('mov-data').value,
                    observacao: document.getElementById('mov-obs').value
                };

                await estoque.adicionarMovimentacao(dadosMovimentacao);

                mostrarNotificacao("Movimentação de estoque registrada com sucesso!", false);
                formMovimentacao.reset();
                inicializarDataHoje();
                
                renderizarTabelaEstoque();
                popularSelectProdutos();
                renderizarTabelaHistorico();
                atualizarDashboard();
            } catch (error) {
                mostrarNotificacao(error.message, true);
            }
        });
    }

    // --- CONTROLES DE INTERAÇÃO (LISTENERS) ---
    // Listeners da aba Estoque (AJUSTADOS NA ETAPA 7)
    if (buscaEstoque) {
        buscaEstoque.addEventListener('input', () => {
            paginaAtualEstoque = 1; // Ajuste Pontual: sempre volta para a primeira página
            renderizarTabelaEstoque();
        });
    }

    if (filtroCategoria) {
        filtroCategoria.addEventListener('change', () => {
            paginaAtualEstoque = 1; // Ajuste Pontual: sempre volta para a primeira página
            renderizarTabelaEstoque();
        });
    }

    if (ordenarEstoque) {
        ordenarEstoque.addEventListener('change', () => {
            paginaAtualEstoque = 1; // Ajuste Pontual: sempre volta para a primeira página
            renderizarTabelaEstoque();
        });
    }

    // Ações de Paginação da aba Estoque
    if (btnPagAnt) {
        btnPagAnt.addEventListener('click', () => {
            if (paginaAtualEstoque > 1) {
                paginaAtualEstoque--;
                renderizarTabelaEstoque();
            }
        });
    }

    if (btnPagProx) {
        btnPagProx.addEventListener('click', () => {
            paginaAtualEstoque++;
            renderizarTabelaEstoque();
        });
    }

    // Listeners da aba Histórico
    if (buscaHistorico) {
        buscaHistorico.addEventListener('input', () => {
            renderizarTabelaHistorico();
        });
    }

    if (filtroHistoricoTipo) {
        filtroHistoricoTipo.addEventListener('change', () => {
            renderizarTabelaHistorico();
        });
    }

    // Gerenciador de navegação via SPA
    if (menuNavegacao) {
        menuNavegacao.addEventListener('click', (e) => {
            const botaoClicado = e.target.closest('.nav-btn');
            
            if (botaoClicado) {
                const tabDesejada = botaoClicado.dataset.tab;

                document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
                botaoClicado.classList.add('active');

                document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
                
                const elementTab = document.getElementById(`tab-${tabDesejada}`);
                if (elementTab) {
                    elementTab.classList.add('active');
                }
            }
        });
    }

    // Gerenciador de Alteração de Tema
    if (seletorTema) {
        seletorTema.addEventListener('change', (e) => {
            const novoTema = e.target.value;
            ui.aplicarTema(novoTema);
        });
    }

    // Listeners da aba Configurações (ETAPA 9)
    if (btnExportar) {
        btnExportar.addEventListener('click', () => {
            exportarDados();
        });
    }

    // O botão visível apenas aciona o input de arquivo real, que fica oculto
    if (btnImportar && inputImportarArquivo) {
        btnImportar.addEventListener('click', () => {
            importarDados();
        });
    }

    if (inputImportarArquivo) {
        inputImportarArquivo.addEventListener('change', (e) => {
            const arquivoSelecionado = e.target.files[0];
            importarDados(arquivoSelecionado);
            // Limpa o valor para permitir selecionar o mesmo arquivo novamente, se necessário
            e.target.value = '';
        });
    }

    if (btnLimpar) {
        btnLimpar.addEventListener('click', () => {
            limparBancoDados();
        });
    }

    // Fluxo inicial de renderização e preenchimento
    try {
        await estoque.carregarDados();
    } catch (error) {
        mostrarNotificacao(error.message, true);
    }
    renderizarTabelaEstoque();
    popularSelectProdutos();
    inicializarDataHoje();
    renderizarTabelaHistorico();
    atualizarDashboard();
});