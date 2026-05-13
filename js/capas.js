// js/capas.js  —  ARGOS · Salud
define([
    "esri/layers/GeoJSONLayer",
    "esri/symbols/SimpleFillSymbol"
], function (GeoJSONLayer, SimpleFillSymbol) {

    const _hoy = new Date().toISOString().substring(0, 10);
    /* const _semanaAtras = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().substring(0, 10); */
    const _semanaAtras = "2025-02-11";

    const SHEETS_CSV_URL = "https://script.google.com/macros/s/AKfycbwxp5jY6ghqnUr0trGEISvu8iaZAhhuZSy5xvVTl5wIbVPZLNSPnf7nCuxCXdZgeGkjJA/exec";

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

    // ── Atenciones: carga CSV → Blob → GeoJSONLayer ──────────────────────────
    function createAtencionesLayer(onLista) {
        fetch(SHEETS_CSV_URL + "?t=" + Date.now())
            .then(function (r) { return r.json(); })
            .then(function (registros) {
                const features = registros
                    .filter(function (r) {
                        return r.Latitud && r.Longitud &&
                            !isNaN(parseFloat(r.Latitud)) &&
                            !isNaN(parseFloat(r.Longitud));
                    })
                    .map(function (r) {
                        const jitter = 0.000009;
                        return {
                            type: "Feature",
                            geometry: {
                                type: "Point",
                                coordinates: [
                                    parseFloat(r.Longitud) + (Math.random() - 0.5) * jitter,
                                    parseFloat(r.Latitud) + (Math.random() - 0.5) * jitter
                                ]
                            },
                            properties: {
                                Nombre: r.Nombre || "",
                                Fecha_Brigada: r.Fecha_Brigada || "",
                                Año: r["Año"] || "",
                                Sector: r.Sector || "",
                                AGA: r.AGA || "",
                                Parroquia: r.Parroquia || "",
                                Telefono: r.Telefono || ""
                            }
                        };
                    });

                const blob = new Blob(
                    [JSON.stringify({ type: "FeatureCollection", features: features })],
                    { type: "application/json" }
                );

                const layer = new GeoJSONLayer({
                    url: URL.createObjectURL(blob),
                    title: "Brigadas Médicas",
                    renderer: {
                        type: "simple",
                        symbol: {
                            type: "picture-marker",
                            url: "img/doctors.png",
                            width: "32px",
                            height: "32px"
                        }
                    },
                    popupTemplate: {
                        title: "Brigada Médica",
                        content: [{
                            type: "fields", fieldInfos: [
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

                layer.filtrarPorCampo = function (campo, valores) {
                    layer.definitionExpression = (!valores || valores.length === 0)
                        ? "1=1"
                        : campo + " IN (" + valores.map(function (v) { return "'" + v + "'"; }).join(",") + ")";
                };

                if (typeof onLista === "function") onLista(layer);
            })
            .catch(function (e) { console.error("Error cargando Sheets:", e); });
    }

    // ── POI ───────────────────────────────────────────────────────────────────
    function createPoiLayer(url) {
        return new GeoJSONLayer({
            url: url,
            visible: true,
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

    // ── AGAs ──────────────────────────────────────────────────────────────────
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
                labelExpressionInfo: { expression: "$feature.aga" },
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
                    type: "fields", fieldInfos: [
                        { fieldName: "PARROQUIA", label: "Parroquia" },
                        { fieldName: "AGA", label: "AGA" }
                    ]
                }]
            }
        });
    }

    // ── Sectores ──────────────────────────────────────────────────────────────
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
                labelExpressionInfo: { expression: "$feature.SECT_NOMEN" },
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
                    type: "fields", fieldInfos: [
                        { fieldName: "Cuadrante", label: "Cuadrante" },
                        { fieldName: "Ordenanza", label: "Ordenanza" },
                        { fieldName: "Aprobacion", label: "Aprobación" }
                    ]
                }]
            }
        });
    }

    // ── Vulnerables ───────────────────────────────────────────────────────────
    function createVulnerablesLayer(url) {
        const redRamp = {
            Q1: { color: [254, 242, 242, 0.5], border: [254, 202, 202] },
            Q2: { color: [254, 202, 202, 0.5], border: [252, 165, 165] },
            Q3: { color: [252, 165, 165, 0.5], border: [248, 113, 113] },
            Q4: { color: [239, 68, 68, 0.5], border: [220, 38, 38] },
            Q5: { color: [153, 27, 27, 0.6], border: [127, 29, 29] }
        };
        const createSymbol = function (level) {
            return {
                type: "simple-fill",
                color: redRamp[level].color,
                outline: { color: redRamp[level].border, width: 1.2 }
            };
        };

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
                    type: "fields", fieldInfos: [
                        { fieldName: "Parroquia", label: "Parroquia" },
                        { fieldName: "TOTAL_BENEF", label: "Total de Personas Vulnerables", format: { digitSeparator: true } },
                        { fieldName: "TOTAL_AGA", label: "Total de Habitantes por AGA", format: { digitSeparator: true } },
                        { fieldName: "TASA_10K", label: "Tasa por 10k Habitantes", format: { places: 2, digitSeparator: true } },
                        { fieldName: "Escala", label: "Nivel de Vulnerabilidad" }
                    ]
                }]
            }
        });
    }

    function createAtencionesPHLayer() {
        return new GeoJSONLayer({
            url: `https://siesep.seguraep.gob.ec/Lectura_Fichas/consulta_historico.php?desde=${_semanaAtras}&hasta=${_hoy}&agencia=ATENCI%20PH&estados=RESUELTAS,PENDIENTES&limit=30000`,
            title: "Atenciones PH",
            fields: [
                { name: "Fecha", type: "string" },
                { name: "Ficha", type: "string" },
                { name: "Estado", type: "string" },
                { name: "Agencia", type: "string" },
                { name: "Tipo", type: "string" },
                { name: "SubTipo", type: "string" },
                { name: "Finalizacion_grupos", type: "string" }
            ],
            objectIdField: "Ficha",
            renderer: {
                type: "unique-value",
                field: "Finalizacion_grupos",
                defaultSymbol: { type: "simple-marker", color: [255, 140, 0, 0.8], size: 6, outline: null },
                uniqueValueInfos: [
                    { value: "RESUELTAS", label: "Resueltas", symbol: { type: "picture-marker", url: "img/marker_1.png", width: "28px", height: "28px" } },
                    { value: "PENDIENTES", label: "Pendientes", symbol: { type: "picture-marker", url: "img/marker_2.png", width: "28px", height: "28px" } }
                ]
            },
            popupTemplate: {
                title: "Atención PH: {Ficha}",
                content: [{
                    type: "fields", fieldInfos: [
                        { fieldName: "Fecha", label: "Fecha" },
                        { fieldName: "Tipo", label: "Tipo" },
                        { fieldName: "SubTipo", label: "SubTipo" },
                        { fieldName: "Finalizacion_grupos", label: "Estado" }
                    ]
                }]
            }
        });
    }

    function createInundacionesLayer(url) {
        return new GeoJSONLayer({
            url: url,
            title: "Zonas Vulnerables Inundación",
            visible: true,
            outFields: ["*"],
            renderer: {
                type: "simple",
                symbol: new SimpleFillSymbol({
                    color: [89, 227, 255, 0.2],
                    outline: { color: "white", width: 1.0 }
                })
            }
        });
    }

    function createDeslizamientosLayer(url) {
        return new GeoJSONLayer({
            url: url,
            title: "Zonas Vulnerables Deslizamientos",
            visible: true,
            outFields: ["*"],
            renderer: {
                type: "simple",
                symbol: new SimpleFillSymbol({
                    color: [235, 217, 82, 0.2],
                    outline: { color: "white", width: 1.0 }
                })
            }
        });
    }

    // ── Exportación ───────────────────────────────────────────────────────────
    function crearCapas(onAtencionesLista) {
        createAtencionesLayer(onAtencionesLista);
        return {
            atencionesPHLayer: createAtencionesPHLayer(),
            poiLayer: createPoiLayer("geojson/poi.geojson"),
            agasLayer: createAgasLayer("geojson/agas.geojson"),
            sectoresLayer: createSectoresLayer("geojson/sectores.geojson"),
            vulnerablesLayer: createVulnerablesLayer("geojson/vulnerables.geojson"),
            inundacionLayer: createInundacionesLayer("geojson/zonas_inundacion.geojson"),
            deslizamientosLayer: createDeslizamientosLayer("geojson/deslizamientos.geojson")
        };
    }

    return { crearCapas };
});