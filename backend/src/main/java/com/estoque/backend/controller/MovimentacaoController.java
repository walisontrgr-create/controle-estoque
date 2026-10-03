package com.estoque.backend.controller;

import com.estoque.backend.model.Movimentacao;
import com.estoque.backend.model.Produto;
import com.estoque.backend.repository.MovimentacaoRepository;
import com.estoque.backend.repository.ProdutoRepository;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.time.LocalTime;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@RestController
@RequestMapping("/movimentacoes")
public class MovimentacaoController {

    private final MovimentacaoRepository movimentacaoRepository;
    private final ProdutoRepository produtoRepository;

    public MovimentacaoController(MovimentacaoRepository movimentacaoRepository, ProdutoRepository produtoRepository) {
        this.movimentacaoRepository = movimentacaoRepository;
        this.produtoRepository = produtoRepository;
    }

    @GetMapping
    public ResponseEntity<List<Movimentacao>> listarTodas() {
        return ResponseEntity.ok(movimentacaoRepository.findAll());
    }

    @PostMapping
    public ResponseEntity<?> criar(@RequestBody Map<String, Object> payload) {
        Long produtoId;
        Integer quantidade;
        LocalDate data;
        String tipo;

        try {
            if (payload.get("produtoId") == null || payload.get("tipo") == null
                    || payload.get("quantidade") == null || payload.get("data") == null) {
                return erro(HttpStatus.BAD_REQUEST, "produtoId, tipo, quantidade e data são obrigatórios");
            }
            produtoId = Long.valueOf(payload.get("produtoId").toString());
            quantidade = Integer.valueOf(payload.get("quantidade").toString());
            data = LocalDate.parse(payload.get("data").toString());
            tipo = payload.get("tipo").toString().toLowerCase();
        } catch (NumberFormatException | DateTimeParseException e) {
            return erro(HttpStatus.BAD_REQUEST, "Dados inválidos (use data no formato AAAA-MM-DD)");
        }

        String observacao = payload.get("observacao") == null ? null : payload.get("observacao").toString();

        if (quantidade <= 0) {
            return erro(HttpStatus.BAD_REQUEST, "A quantidade deve ser maior que zero");
        }
        if (!tipo.equals("entrada") && !tipo.equals("saida")) {
            return erro(HttpStatus.BAD_REQUEST, "Tipo de movimentação inválido");
        }

        Optional<Produto> produtoOptional = produtoRepository.findById(produtoId);
        if (produtoOptional.isEmpty()) {
            return erro(HttpStatus.NOT_FOUND, "Produto não encontrado");
        }
        Produto produto = produtoOptional.get();

        if (tipo.equals("saida")) {
            if (produto.getQuantidade() < quantidade) {
                return erro(HttpStatus.BAD_REQUEST, "Estoque insuficiente");
            }
            produto.setQuantidade(produto.getQuantidade() - quantidade);
        } else {
            produto.setQuantidade(produto.getQuantidade() + quantidade);
        }

        produtoRepository.save(produto);

        Movimentacao movimentacao = new Movimentacao();
        movimentacao.setProduto(produto);
        movimentacao.setTipo(tipo);
        movimentacao.setQuantidade(quantidade);
        movimentacao.setData(data);
        movimentacao.setHora(LocalTime.now().format(DateTimeFormatter.ofPattern("HH:mm")));
        movimentacao.setObservacao(observacao);

        Movimentacao salva = movimentacaoRepository.save(movimentacao);
        return ResponseEntity.status(HttpStatus.CREATED).body(salva);
    }

    private ResponseEntity<?> erro(HttpStatus status, String mensagem) {
        return ResponseEntity.status(status).body(Collections.singletonMap("erro", mensagem));
    }
}