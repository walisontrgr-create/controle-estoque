package com.estoque.backend.repository;

import com.estoque.backend.model.Movimentacao;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

@Repository
public interface MovimentacaoRepository extends JpaRepository<Movimentacao, Long> {

    @Transactional
    void deleteByProdutoId(Long produtoId);
}