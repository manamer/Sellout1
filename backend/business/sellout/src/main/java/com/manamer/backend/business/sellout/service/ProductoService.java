package com.manamer.backend.business.sellout.service;

import java.io.IOException;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import org.apache.poi.ss.usermodel.*;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import com.manamer.backend.business.sellout.models.Producto;
import com.manamer.backend.business.sellout.repositories.ProductoRepository;

@Service
public class ProductoService {

    @Autowired
    private ProductoRepository repository;

    public Optional<Producto> findById(Long id) {
        return repository.findById(id); // Llama al repositorio para obtener el producto por ID
    }

    // Método para guardar o actualizar un producto
    public Producto saveOrUpdate(Producto producto) {
        return repository.save(producto);
    }

    // Método para obtener todos los productos
    public List<Producto> getAllProductos() {
        return repository.findAll();
    }

    // Método para eliminar un producto por su ID
    public void deleteProductoById(Long id) {
        if (repository.existsById(id)) {
            repository.deleteById(id);
        } else {
            throw new IllegalArgumentException("El producto con el ID especificado no existe.");
        }
    }

    // Método para eliminar varios productos
    public void deleteProductos(List<Long> ids) {
        if (ids == null || ids.isEmpty()) {
            throw new IllegalArgumentException("No se proporcionaron IDs para eliminar.");
        }

        List<Producto> productos = repository.findAllById(ids);
        if (productos.isEmpty()) {
            throw new IllegalArgumentException("No existen productos con los IDs proporcionados.");
        }

        repository.deleteAllInBatch(productos); // Optimizado para eliminar en lotes
    }
   

    // Método para cargar productos desde un archivo XLSX
    public String cargarProductosDesdeArchivo(MultipartFile file) {
        if (file.isEmpty()) {
            return "El archivo está vacío.";
        }

        try (InputStream inputStream = file.getInputStream()) {
            Workbook workbook = new XSSFWorkbook(inputStream);
            Sheet sheet = workbook.getSheetAt(0);
            List<Producto> productos = new ArrayList<>();

            // Iterar sobre las filas del archivo
            for (Row row : sheet) {
                if (row.getRowNum() == 0) continue; // Salta la primera fila (encabezados)

                Producto producto = new Producto();
                producto.setCodItem(row.getCell(0).getStringCellValue());
                producto.setCodBarraSap(row.getCell(1).getStringCellValue());

                productos.add(producto);
            }

            // Guardar los productos en la base de datos
            repository.saveAll(productos);
            return "Productos cargados correctamente.";

        } catch (IOException e) {
            return "Error al cargar el archivo: " + e.getMessage();
        }
    }

    // Método para guardar una lista de productos
    public void guardarProductos(List<Producto> productos) {
        repository.saveAll(productos);
    }

    // Constructor para inyección de dependencias
    public ProductoService(ProductoRepository productoRepositorio) {
        this.repository = productoRepositorio;
    }
}