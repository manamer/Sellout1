package com.manamer.backend.business.sellout.repositories;



import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.manamer.backend.business.sellout.models.Producto;

@Repository
public interface ProductoRepository extends JpaRepository<Producto, Long> {
    
    
}

