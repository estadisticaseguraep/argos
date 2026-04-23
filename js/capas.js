// js/capas.js  —  ARGOS · Salud
define([
    "esri/layers/GeoJSONLayer",
    "esri/symbols/SimpleFillSymbol",
    "esri/layers/GraphicsLayer",
    "esri/Graphic",
    "esri/geometry/Point"
], function (GeoJSONLayer, SimpleFillSymbol, GraphicsLayer, Graphic, Point) {

    const SHEETS_CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vRUBlj07rIgsuUc06O31K2jBG544KRSmL2GeHFdaAHarqx63yzFjZtNBWFUbi8iyCjyNmcvPQRgwo8X/pub?gid=249981787&single=true&output=csv";
                            
    // ── Helper: parsea CSV simple (sin dependencias) ─────────────────────────
    function parsearCSV(texto) {
        const filas = texto.trim().split("\n");
        const cabeceras = filas[0].split(",").map(function (c) { return c.trim().replace(/^"|"$/g, ""); });
        return filas.slice(1).map(function (fila) {
            const valores = fila.split(",").map(function (v) { return v.trim().replace(/^"|"$/g, ""); });
            const obj = {};
            cabeceras.forEach(function (c, i) { obj[c] = valores[i] || ""; });
            return obj;
        });
    }

    // ── Crea GraphicsLayer desde Google Sheets CSV ───────────────────────────
    function createAtencionesLayer() {
        const layer = new GraphicsLayer({
            title: "Brigadas Médicas"
        });

        // Guarda todos los gráficos para filtrar en memoria después
        layer._todosLosGraphics = [];

        const simbolo = {
            type: "picture-marker",
            url: "img/doctors.png",
            width: "32px",
            height: "32px"
        };

        // Carga inicial desde Sheets
        fetch(SHEETS_CSV_URL + "&t=" + Date.now())
            .then(function (r) { return r.text(); })
            .then(function (texto) {
                const registros = parsearCSV(texto);

                const graphics = registros
                    .filter(function (r) {
                        return r.Latitud && r.Longitud &&
                            !isNaN(parseFloat(r.Latitud)) &&
                            !isNaN(parseFloat(r.Longitud));
                    })
                    .map(function (r) {
                        return new Graphic({
                            geometry: new Point({
                                latitude: parseFloat(r.Latitud),
                                longitude: parseFloat(r.Longitud),
                                spatialReference: { wkid: 4326 }
                            }),
                            symbol: simbolo,
                            attributes: {
                                Nombre: r.Nombre || "",
                                Fecha_Brigada: r.Fecha_Brigada || "",
                                Año: r["Año"] || "",
                                Sector: r.Sector || "",
                                AGA: r.AGA || "",
                                Parroquia: r.Parroquia || "",
                                Telefono: r.Telefono || ""
                            },
                            popupTemplate: {
                                title: "Brigada Médica",
                                content: [{
                                    type: "fields",
                                    fieldInfos: [
                                        { fieldName: "Nombre", label: "Nombre" },
                                        { fieldName: "Fecha_Brigada", label: "Fecha Brigada" },
                                        { fieldName: "Año", label: "Año" },
                                        { fieldName: "Sector", label: "Sector" },
                                        { fieldName: "AGA", label: "AGA" },
                                        { fieldName: "Parroquia", label: "Parroquia" },
                                        { fieldName: "Telefono", label: "Teléfono" }
                                    ]
                                }]
                            }
                        });
                    });

                layer._todosLosGraphics = graphics;
                layer.addMany(graphics);
            })
            .catch(function (e) { console.error("Error cargando Sheets:", e); });

        // ── Método de filtrado en memoria (reemplaza definitionExpression) ───
        layer.filtrarPorCampo = function (campo, valores) {
            layer.removeAll();
            if (!valores || valores.length === 0) {
                layer.addMany(layer._todosLosGraphics);
                return;
            }
            const filtrados = layer._todosLosGraphics.filter(function (g) {
                return valores.indexOf(g.attributes[campo]) !== -1;
            });
            layer.addMany(filtrados);
        };

        return layer;
    }

    // ── Establecimientos de salud (POI, icono PNG) ────────────────────────────
    function createPoiLayer(url) {
        return new GeoJSONLayer({
            url: url,
            title: "Establecimientos de Salud",
            renderer: {
                type: "simple",
                symbol: {
                    type: "picture-marker",
                    url: "img/hospital.png",
                    width: "42px",
                    height: "42px"
                }
            },
            popupTemplate: {
                title: "{nombre}",
                content: [{
                    type: "fields",
                    fieldInfos: [
                        { fieldName: "NOMBRE", label: "Nombre" },
                        { fieldName: "SECTOR", label: "Sector" },
                        { fieldName: "DESCRIPCI", label: "Descripción" },
                        { fieldName: "DIRECCION", label: "Dirección" },
                        { fieldName: "HORARIO", label: "Horario" }
                    ]
                }]
            }
        });
    }

    function createAgasLayer(url) {
        return new GeoJSONLayer({
            url: url,
            title: "Coberturas AGAs",
            renderer: {
                type: "simple",
                symbol: new SimpleFillSymbol({
                    color: [0, 180, 216, 0.18],
                    outline: { color: [0, 119, 182], width: 1.8 }
                })
            },
            labelingInfo: [{
                labelExpressionInfo: { expression: '$feature.aga' },
                symbol: {
                    type: "text",
                    color: [0, 119, 182],
                    haloColor: "white",
                    haloSize: "2px",
                    font: { size: 14, family: "sans-serif", weight: "bold" }
                },
                placement: "center-center"
            }],
            popupTemplate: {
                title: "AGA: {AGA}",
                content: [{
                    type: "fields",
                    fieldInfos: [
                        { fieldName: "PARROQUIA", label: "Parroquia" },
                        { fieldName: "AGA", label: "Aga" }
                    ]
                }]
            }
        });
    }

    function createSectoresLayer(url) {
        return new GeoJSONLayer({
            url: url,
            title: "Sectores",
            renderer: {
                type: "simple",
                symbol: new SimpleFillSymbol({
                    color: [15, 196, 6, 0.12],
                    outline: { color: [15, 196, 6], width: 1 }
                })
            },
            labelingInfo: [{
                labelExpressionInfo: { expression: '$feature.SECT_NOMEN' },
                symbol: {
                    type: "text",
                    color: [0, 77, 128],
                    haloColor: "white",
                    haloSize: "2px",
                    font: { size: 10, family: "sans-serif", weight: "bold" }
                },
                placement: "center-center"
            }],
            popupTemplate: {
                title: "Sector: {SECT_NOMEN}",
                content: [{
                    type: "fields",
                    fieldInfos: [
                        { fieldName: "Cuadrante", label: "Cuadrante" },
                        { fieldName: "Ordenanza", label: "Ordenanza" },
                        { fieldName: "Aprobacion", label: "Aprobación" }
                    ]
                }]
            }
        });
    }

    function createVulnerablesLayer(url) {

        const redRamp = {
            Q1: { color: [254, 242, 242, 0.5], border: [254, 202, 202] },
            Q2: { color: [254, 202, 202, 0.5], border: [252, 165, 165] },
            Q3: { color: [252, 165, 165, 0.5], border: [248, 113, 113] },
            Q4: { color: [239, 68, 68, 0.5], border: [220, 38, 38] },
            Q5: { color: [153, 27, 27, 0.6], border: [127, 29, 29] }
        };

        const createSymbol = (level) => ({
            type: "simple-fill",
            color: redRamp[level].color,
            outline: { color: redRamp[level].border, width: 1.2 }
        });

        return new GeoJSONLayer({
            url: url,
            title: "Análisis de Vulnerabilidad por Sector (Rojo)",
            outFields: ["*"],
            renderer: {
                type: "unique-value",
                field: "Escala",
                uniqueValueInfos: [
                    { value: "Q1", label: "Bajo", symbol: createSymbol("Q1") },
                    { value: "Q2", label: "Medio - Bajo", symbol: createSymbol("Q2") },
                    { value: "Q3", label: "Medio", symbol: createSymbol("Q3") },
                    { value: "Q4", label: "Medio - Alto", symbol: createSymbol("Q4") },
                    { value: "Q5", label: "Alto", symbol: createSymbol("Q5") }
                ]
            },
            labelingInfo: [{
                labelExpressionInfo: { expression: "$feature.AGA" },
                symbol: {
                    type: "text",
                    color: [255, 255, 255],
                    haloColor: [127, 29, 29],
                    haloSize: "1.5px",
                    font: { size: 11, weight: "bold", family: "Ubuntu Mono" }
                },
                labelPlacement: "always-horizontal"
            }],
            popupTemplate: {
                title: "Sector: {AGA}",
                content: [{
                    type: "fields",
                    fieldInfos: [
                        {
                            fieldName: "Parroquia",
                            label: "Parroquia"
                        }, {
                            fieldName: "TOTAL_BENEF",
                            label: "Total de Personas Vulnerables",
                            format: {
                                digitSeparator: true
                            }
                        }, {
                            fieldName: "TOTAL_AGA",
                            label: "Total de Habitantes por AGA",
                            format: {
                                digitSeparator: true
                            }
                        },
                        {
                            fieldName: "TASA_10K",
                            label: "Tasa por 10k Habitantes",
                            format: {
                                places: 2,
                                digitSeparator: true
                            }
                        },
                        {
                            fieldName: "Escala",
                            label: "Nivel de Vulnerabilidad"
                        }
                    ]
                }]
            }
        });
    }

    // ── Exportación ───────────────────────────────────────────────────────────
    function crearCapas() {
        return {
            atencionesLayer: createAtencionesLayer("geojson/atenciones.geojson"),
            poiLayer: createPoiLayer("geojson/poi.geojson"),
            agasLayer: createAgasLayer("geojson/agas.geojson"),
            sectoresLayer: createSectoresLayer("geojson/sectores.geojson"),
            vulnerablesLayer: createVulnerablesLayer("geojson/vulnerables.geojson")
        };
    }

    return { crearCapas };
});