// js/capas.js  —  ARGOS · Salud
define([
    "esri/layers/GeoJSONLayer",
    "esri/symbols/SimpleFillSymbol"
], function (GeoJSONLayer, SimpleFillSymbol) {

    // ── Consultas médicas (puntos con icono PNG) ──────────────────────────────
    function createAtencionesLayer(url) {
        return new GeoJSONLayer({
            url: url,
            title: "Consultas Médicas",
            renderer: {
                type: "simple",
                symbol: {
                    type: "picture-marker",
                    url: "img/doctors.png",
                    width: "42px",
                    height: "42px"
                }
            },
            popupTemplate: {
                title: "Consulta Médica",
                content: [{
                    type: "fields",
                    fieldInfos: [
                        { fieldName: "Nombre",         label: "Detalle"       },
                        { fieldName: "AÑO",            label: "Año"    },
                        { fieldName: "Descripcio",     label: "Descripción"},
                        { fieldName: "SECT_NOMEN",     label: "Sector"          },
                        { fieldName: "AGA",            label: "Aga"}
                    ]
                }]
            }
        });
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
                        { fieldName: "NOMBRE",    label: "Nombre"      },
                        { fieldName: "SECTOR",    label: "Sector"      },
                        { fieldName: "DESCRIPCI", label: "Descripción"   },
                        { fieldName: "DIRECCION",  label: "Dirección"    },
                        { fieldName: "HORARIO",   label: "Horario"     }
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
                        { fieldName: "PARROQUIA",  label: "Parroquia"      },
                        { fieldName: "AGA",        label: "Aga"      }
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
                        { fieldName: "Cuadrante",    label: "Cuadrante"     },
                        { fieldName: "Ordenanza",    label: "Ordenanza"     },
                        { fieldName: "Aprobacion",   label: "Aprobación"    }
                    ]
                }]
            }
        });
    }

    // ── Exportación ───────────────────────────────────────────────────────────
    function crearCapas() {
        return {
            atencionesLayer: createAtencionesLayer("geojson/atenciones.geojson"),
            poiLayer:        createPoiLayer("geojson/poi.geojson"),
            agasLayer:       createAgasLayer("geojson/agas.geojson"),
            sectoresLayer:   createSectoresLayer("geojson/sectores.geojson")
        };
    }

    return { crearCapas };
});