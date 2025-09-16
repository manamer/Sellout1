package com.manamer.backend.business.sellout.controller;

import com.manamer.backend.business.sellout.models.TipoMueble;
import com.manamer.backend.business.sellout.models.Venta;
import com.manamer.backend.business.sellout.service.ClienteService;
import com.manamer.backend.business.sellout.service.DepratiVentaService;
import com.manamer.backend.business.sellout.service.ProductoService;
import com.manamer.backend.business.sellout.service.TipoMuebleService;
import com.manamer.backend.business.sellout.service.VentaService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;

@RestController
@CrossOrigin(
        origins = "*",
        allowedHeaders = "*",
        methods = {RequestMethod.GET, RequestMethod.POST, RequestMethod.PUT, RequestMethod.DELETE}
)
@RequestMapping("/api/deprati")
public class DepratiController {

    private static final Logger logger = LoggerFactory.getLogger(DepratiController.class);

    private final DepratiVentaService depratiVentaService;
    private final TipoMuebleService tipoMuebleService;
    private final ClienteService clienteService;
    private final ProductoService productoService;
    private final VentaService ventaService;

    @Autowired
    public DepratiController(DepratiVentaService depratiVentaService,
                             TipoMuebleService tipoMuebleService,
                             ClienteService clienteService,
                             ProductoService productoService,
                             VentaService ventaService) {
        this.depratiVentaService = depratiVentaService;
        this.tipoMuebleService = tipoMuebleService;
        this.clienteService = clienteService;
        this.productoService = productoService;
        this.ventaService = ventaService;
    }

    // ---------- Ventas ----------
    @GetMapping("/venta")
    public ResponseEntity<List<Venta>> obtenerTodasLasVentas() {
        return ResponseEntity.ok(depratiVentaService.obtenerTodasLasVentasDeprati());
    }

    @GetMapping("/venta/{id}")
    public ResponseEntity<Venta> obtenerVentaPorId(@PathVariable Long id) {
        return depratiVentaService.obtenerVentaDepratiPorId(id)
                .map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.notFound().build());
    }

    @PutMapping("/venta/{id}")
    public ResponseEntity<Venta> actualizarVenta(@PathVariable Long id, @RequestBody Venta nuevaVenta) {
        try {
            var actualizada = depratiVentaService.actualizarVentaDeprati(id, nuevaVenta);
            return ResponseEntity.ok(actualizada);
        } catch (RuntimeException e) {
            logger.warn("No se pudo actualizar venta {}: {}", id, e.getMessage());
            return ResponseEntity.status(HttpStatus.NOT_FOUND).build();
        }
    }

    @DeleteMapping("/venta/{id}")
    public ResponseEntity<Void> eliminarVenta(@PathVariable Long id) {
        boolean ok = depratiVentaService.eliminarVentaDeprati(id);
        return ok ? ResponseEntity.noContent().build()
                  : ResponseEntity.status(HttpStatus.NOT_FOUND).build();
    }

    @DeleteMapping("/ventas-forma-masiva")
    public ResponseEntity<Void> eliminarVentas(@RequestBody List<Long> ids) {
        boolean ok = depratiVentaService.eliminarVentasDeprati(ids);
        return ok ? ResponseEntity.ok().build()
                  : ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
    }

    // ---------- Cargas Excel (ventas) ----------
    @PostMapping("/subir-archivos-motor-maping")
    public ResponseEntity<Map<String, Object>> procesarArchivoExcelFlexible(@RequestParam("file") MultipartFile file) {
        return depratiVentaService.procesarArchivoExcelFlexible(file);
    }

    @PostMapping("/subir-archivo-venta")
    public ResponseEntity<Map<String, Object>> procesarArchivoExcelDeprati(@RequestParam("file") MultipartFile file) {
        return depratiVentaService.procesarArchivoExcelDeprati(file);
    }


    @GetMapping("/tipo-mueble")
    public ResponseEntity<List<TipoMueble>> obtenerTiposMuebleDeprati() {
        return ResponseEntity.ok(tipoMuebleService.obtenerTodosLosTiposMuebleDeprati());
    }

    // ---------- Descargables ----------
    @PostMapping("/descargas/codigos-no-encontrados")
    public ResponseEntity<Resource> descargarCodigosNoEncontrados(@RequestBody List<String> codigos) {
        return ventaService.obtenerArchivoCodigosNoEncontrados(codigos);
    }

    @PostMapping("/descargas/log-carga")
    public ResponseEntity<Resource> descargarLogCarga(@RequestBody Map<String, Object> resumen) {
        StringBuilder sb = new StringBuilder();
        sb.append("LOG DE CARGA - DEPRATI").append(System.lineSeparator());
        sb.append("Archivo: ").append(resumen.getOrDefault("archivo", "N/D")).append(System.lineSeparator());
        sb.append("Filas leídas: ").append(resumen.getOrDefault("filasLeidas", 0)).append(System.lineSeparator());
        sb.append("Filas procesadas: ").append(resumen.getOrDefault("filasProcesadas", 0)).append(System.lineSeparator());
        sb.append("Insertados: ").append(resumen.getOrDefault("insertados", 0)).append(System.lineSeparator());
        sb.append("Actualizados: ").append(resumen.getOrDefault("actualizados", 0)).append(System.lineSeparator());
        sb.append("Omitidos: ").append(resumen.getOrDefault("omitidos", 0)).append(System.lineSeparator());
        sb.append("Errores: ").append(resumen.getOrDefault("errores", 0)).append(System.lineSeparator());

        Object inc = resumen.get("incidencias");
        if (inc instanceof Collection<?> col && !col.isEmpty()) {
            sb.append(System.lineSeparator()).append("Incidencias:").append(System.lineSeparator());
            for (Object o : col) {
                sb.append("- ").append(String.valueOf(o)).append(System.lineSeparator());
            }
        }

        byte[] bytes = sb.toString().getBytes(java.nio.charset.StandardCharsets.UTF_8);
        var resource = new org.springframework.core.io.InputStreamResource(new java.io.ByteArrayInputStream(bytes));
        String filename = "log_carga_deprati_" +
                LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyyMMdd_HHmmss")) + ".txt";

        return ResponseEntity.ok()
                .header(org.springframework.http.HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=" + filename)
                .contentType(org.springframework.http.MediaType.TEXT_PLAIN)
                .contentLength(bytes.length)
                .body(resource);
    }
}
