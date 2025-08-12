package com.manamer.backend.business.sellout.repositories;

import com.manamer.backend.business.sellout.models.Cliente;
import com.manamer.backend.business.sellout.models.Producto;
import com.manamer.backend.business.sellout.models.Venta;
import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

@Repository
public interface VentaRepository extends JpaRepository<Venta, Long> {

   // Consulta para obtener el Producto por cod_Barra (pueden existir varios productos con el mismo código de barras)
   @Query(value = "SELECT * FROM SAPHANA..CG3_360CORP.SAP_Prod sapProd WHERE sapProd.CodBarra = :codBarra", nativeQuery = true)
   List<Producto> obtenerProductoPorCodBarra(@Param("codBarra") String codBarra);

   // Si solo se necesita un resultado, se toma el primero de la lista
   default Optional<Producto> obtenerPrimerProductoPorCodBarra(@Param("codBarra") String codBarra) {
       List<Producto> productos = obtenerProductoPorCodBarra(codBarra);
       return productos.isEmpty() ? Optional.empty() : Optional.of(productos.get(0));
   }

   // Consulta para obtener el Producto (pueden existir varios con el mismo cod_Barra_Sap)
   @Query(value = "SELECT * FROM SELLOUT.dbo.producto mp WHERE mp.cod_barra_sap = :codBarra", nativeQuery = true)
   List<Producto> obtenerProducto(@Param("codBarra") String codBarra);

   default Optional<Producto> obtenerPrimerProducto(@Param("codBarra") String codBarra) {
       List<Producto> productos = obtenerProducto(codBarra);
       return productos.isEmpty() ? Optional.empty() : Optional.of(productos.get(0));
   }

   // Consulta para obtener el Cliente (en este caso, se espera un solo resultado)
   @Query(value = "SELECT * FROM SELLOUT.dbo.cliente c WHERE c.id = :clienteId", nativeQuery = true)
   Optional<Cliente> obtenerCliente(@Param("clienteId") Long clienteId);

   // Método alternativo para obtener solo un resultado en Producto con cod_Barra_Sap
   @Query("SELECT mp FROM Producto mp WHERE mp.codBarraSap = :codBarra")
   List<Producto> findProductoByCodBarra(@Param("codBarra") String codBarra);

   default Optional<Producto> findPrimerProductoByCodBarra(@Param("codBarra") String codBarra) {
       List<Producto> productos = findProductoByCodBarra(codBarra);
       return productos.isEmpty() ? Optional.empty() : Optional.of(productos.get(0));
   }

   // Nueva consulta que valida y limpia el codBarra antes de la consulta
   default Optional<Producto> obtenerProductoPorCodBarraLimpio(@Param("codBarra") String codBarra) {
       if (codBarra != null) {
           codBarra = codBarra.trim();
       }

       if (codBarra == null || codBarra.isEmpty()) {
           return Optional.empty();
       }

       return obtenerPrimerProductoPorCodBarra(codBarra);
   }
   
    Optional<Venta> findByAnioAndMesAndCodBarraAndCodPdv(Integer anio, Integer mes, String codBarra, String codPdv);


    Optional<Venta> findByClienteIdAndAnioAndMesAndDiaAndCodBarraAndCodPdv(
        Long clienteId, Integer anio, Integer mes, Integer dia, String codBarra, String codPdv
    );


}
