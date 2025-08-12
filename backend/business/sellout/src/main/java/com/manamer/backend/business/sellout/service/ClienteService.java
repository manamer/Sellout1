package com.manamer.backend.business.sellout.service;
import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.io.InputStream;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;

import org.apache.poi.ss.usermodel.Workbook;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import com.manamer.backend.business.sellout.models.Cliente;
import com.manamer.backend.business.sellout.repositories.ClienteRepository;


@Service
public class ClienteService {

    @Autowired
    private ClienteRepository ClienteRepository;

    // Cambia el parámetro de String a Long
    public Optional<Cliente> findById(Long id) {
        return ClienteRepository.findById(id);  // Ahora el id es de tipo Long
    }
     @Autowired
    private ClienteRepository repository;

    // Crear o actualizar un cliente
    public Cliente saveOrUpdate(Cliente cliente) {
        return repository.save(cliente);
    }

    // Obtener todos los clientes
    public List<Cliente> getAllClientes() {
        return repository.findAll();
    }

    // Obtener un cliente por ID
    public Optional<Cliente> getClienteById(Long id) {
        return repository.findById(id);
    }

    // Eliminar un cliente por ID
    public void deleteCliente(Long id) {
        repository.deleteById(id);
    }
    
     //Método para cargar clientes desde un archivo XLSX
    public String uploadClientesFromExcel(MultipartFile file) {
        try (InputStream is = file.getInputStream()) {
            Workbook workbook = new XSSFWorkbook(is);
            Sheet sheet = workbook.getSheetAt(0); // Obtener la primera hoja

            List<Cliente> clientes = new ArrayList<>();
            for (Row row : sheet) {
                // Suponiendo que los datos comienzan en la segunda fila (índice 1)
                if (row.getRowNum() == 0) continue; // Saltar la primera fila (cabecera)

                Cliente cliente = new Cliente();
                cliente.setCodCliente(row.getCell(0).getStringCellValue()); // Primera columna (cod_Cliente)
                cliente.setNombreCliente(row.getCell(1).getStringCellValue()); // Segunda columna (nombre_Cliente)
                clientes.add(cliente);
            }

            // Guardar los clientes en la base de datos
            repository.saveAll(clientes);

            return "Archivo cargado con éxito. Se cargaron " + clientes.size() + " clientes.";
        } catch (IOException e) {
            return "Error al procesar el archivo: " + e.getMessage();
        }
    }
    
}
