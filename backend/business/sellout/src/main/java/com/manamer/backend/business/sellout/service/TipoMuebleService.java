package com.manamer.backend.business.sellout.service;

import java.io.IOException;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;

import org.apache.poi.ss.usermodel.Cell;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.ss.usermodel.Workbook;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import com.manamer.backend.business.sellout.models.Cliente;
import com.manamer.backend.business.sellout.models.TipoMueble;
import com.manamer.backend.business.sellout.repositories.ClienteRepository;
import com.manamer.backend.business.sellout.repositories.TipoMuebleRepository;
@Service
public class TipoMuebleService {

    private final TipoMuebleRepository tipoMuebleRepository;

    private final ClienteRepository ClienteRepository;
    
    @Autowired
    public TipoMuebleService(TipoMuebleRepository tipoMuebleRepository, ClienteRepository ClienteRepository) {
        this.tipoMuebleRepository = tipoMuebleRepository;
        this.ClienteRepository = ClienteRepository;
    }

    public TipoMueble guardarTipoMueble(TipoMueble tipoMueble) {
        return tipoMuebleRepository.save(tipoMueble);
    }

    public List<TipoMueble> obtenerTodosLosTiposMueble() {
        return tipoMuebleRepository.findAll();
    }

    public List<TipoMueble> obtenerTodosLosTiposMuebleDeprati() {
        Long idCliente = 5970L;
        return tipoMuebleRepository.findAll().stream()
                .filter(tipoMueble -> tipoMueble.getCliente() != null && tipoMueble.getCliente().getId().equals(idCliente))
                .collect(Collectors.toList());
    }

    public Optional<TipoMueble> obtenerTipoMueblePorId(Long id) {
        return tipoMuebleRepository.findById(id);
    }

    public TipoMueble actualizarTipoMueble(Long id, TipoMueble nuevoTipoMueble) {
        return tipoMuebleRepository.findById(id).map(tipoMueble -> {
            tipoMueble.setCodPdv(nuevoTipoMueble.getCodPdv());
            tipoMueble.setNombrePdv(nuevoTipoMueble.getNombrePdv());
            tipoMueble.setTipoMuebleEssence(nuevoTipoMueble.getTipoMuebleEssence());
            tipoMueble.setTipoMuebleCatrice(nuevoTipoMueble.getTipoMuebleCatrice());
            tipoMueble.setCliente(nuevoTipoMueble.getCliente());
            tipoMueble.setCiudad(nuevoTipoMueble.getCiudad());;
            tipoMueble.setMarca(nuevoTipoMueble.getMarca()); // Nuevo campo
            return tipoMuebleRepository.save(tipoMueble);
        }).orElseThrow(() -> new RuntimeException("TipoMueble no encontrado con el ID: " + id));
    }

    public boolean eliminarTipoMueble(Long id) {
        return tipoMuebleRepository.findById(id).map(tipoMueble -> {
            tipoMuebleRepository.delete(tipoMueble);
            return true;
        }).orElse(false);
    }

    public List<TipoMueble> cargarTipoMueblesDesdeArchivo(MultipartFile file) {
        List<TipoMueble> tipoMuebles = new ArrayList<>();
        try (Workbook workbook = new XSSFWorkbook(file.getInputStream())) {
            Sheet sheet = workbook.getSheetAt(0);
            for (Row row : sheet) {
                if (row.getRowNum() == 0) {
                    continue; // Skip header row
                }
                TipoMueble tipoMueble = new TipoMueble();
                tipoMueble.setCodPdv(getCellValueAsString(row.getCell(0)));
                tipoMueble.setNombrePdv(getCellValueAsString(row.getCell(1)));
                tipoMueble.setTipoMuebleEssence(getCellValueAsString(row.getCell(2)));
                tipoMueble.setTipoMuebleCatrice(getCellValueAsString(row.getCell(3)));
                tipoMueble.setCiudad(getCellValueAsString(row.getCell(4)));
                tipoMueble.setMarca(getCellValueAsString(row.getCell(5))); // Nuevo campo

                // Asignar siempre el clienteId 5969
                Long clienteId = 5969L;
                Cliente Cliente = ClienteRepository.findById(clienteId)
                        .orElseThrow(() -> new RuntimeException("liente no encontrado con el ID: " + clienteId));
                tipoMueble.setCliente(Cliente);

                tipoMuebles.add(tipoMueble);
            }
            tipoMuebleRepository.saveAll(tipoMuebles);
        } catch (IOException e) {
            e.printStackTrace();
            throw new RuntimeException("Error al cargar el archivo: " + e.getMessage());
        }
        return tipoMuebles;
    }
    
    private String getCellValueAsString(Cell cell) {
        if (cell == null) {
            return "";
        }
        switch (cell.getCellType()) {
            case STRING:
                return cell.getStringCellValue();
            case NUMERIC:
                return String.valueOf((long) cell.getNumericCellValue());
            case BOOLEAN:
                return String.valueOf(cell.getBooleanCellValue());
            case FORMULA:
                return cell.getCellFormula();
            default:
                return "";
        }
    }

    public boolean eliminarTiposMueble(List<Long> ids) {
        List<TipoMueble> tiposMuebles = tipoMuebleRepository.findAllById(ids);
        if (tiposMuebles.isEmpty()) {
            return false;
        }
        tipoMuebleRepository.deleteAll(tiposMuebles);
        return true;
    }

    public List<TipoMueble> obtenerTiposMueblePorCliente(Long idCliente) {
        return tipoMuebleRepository.findAll().stream()
                .filter(tipoMueble -> tipoMueble.getCliente() != null && tipoMueble.getCliente().getId().equals(idCliente))
                .collect(Collectors.toList());
    }
    
    public List<TipoMueble> cargarTipoMueblesDesdeArchivoDeprati(MultipartFile file) {
        List<TipoMueble> tipoMuebles = new ArrayList<>();
        try (Workbook workbook = new XSSFWorkbook(file.getInputStream())) {
            Sheet sheet = workbook.getSheetAt(0);
            for (Row row : sheet) {
                if (row.getRowNum() == 0) {
                    continue; // Skip header row
                }
                TipoMueble tipoMueble = new TipoMueble();
                tipoMueble.setCodPdv(getCellValueAsString(row.getCell(0)));
                tipoMueble.setNombrePdv(getCellValueAsString(row.getCell(1)));
                tipoMueble.setTipoMuebleEssence(getCellValueAsString(row.getCell(2)));
                tipoMueble.setTipoMuebleCatrice(getCellValueAsString(row.getCell(3)));
                tipoMueble.setCiudad(getCellValueAsString(row.getCell(4)));
                tipoMueble.setMarca(getCellValueAsString(row.getCell(5))); // Nuevo campo

                // Asignar siempre el clienteId 5969
                Long clienteId = 5970L;
                Cliente Cliente = ClienteRepository.findById(clienteId)
                        .orElseThrow(() -> new RuntimeException("MantenimientoCliente no encontrado con el ID: " + clienteId));
                tipoMueble.setCliente(Cliente);

                tipoMuebles.add(tipoMueble);
            }
            tipoMuebleRepository.saveAll(tipoMuebles);
        } catch (IOException e) {
            e.printStackTrace();
            throw new RuntimeException("Error al cargar el archivo: " + e.getMessage());
        }
        return tipoMuebles;
    }

     
}