// js/mapa.js  —  ARGOS · Salud
require([
    "js/capas", "js/uiSetup", "js/mapSetup", "js/queryGeometria"
], function (
    capasModule, setupUI, mapSetup, iniciarQueryGeometria
) {

    // ── Helpers ───────────────────────────────────────────────────────────────
    function traerGraficosAlFrente() {
        requestAnimationFrame(function () {
            const n = map.layers.length;
            const capasAlFrente = [atencionesLayer, poiLayer]
                .filter(function (l) { return map.layers.indexOf(l) !== -1; });
            capasAlFrente.forEach(function (layer, i) {
                map.reorder(layer, n - capasAlFrente.length + i);
            });
        });
    }

    // ── Capas ─────────────────────────────────────────────────────────────────
    const {
        atencionesLayer, poiLayer, agasLayer, sectoresLayer, vulnerablesLayer
    } = capasModule.crearCapas();

    const map = mapSetup.crearMapaBase();
    const view = mapSetup.crearMapView(map);

    const conteoDiv = document.createElement("div");
    conteoDiv.style.minWidth = "200px";

    // ── Estado de filtros activos ──────────────────────────────────────────────
    let queryGeomActiva = null;
    let queryZonaActiva = false;

    // ── Conteo ────────────────────────────────────────────────────────────────
    function contarEntidades(layer, geometry) {

        if (layer.type === "graphics") {
            return Promise.resolve({
                title: layer.title,
                count: layer.graphics.length
            });
        }

        const query = layer.createQuery();
        query.where = layer.definitionExpression || "1=1";
        if (geometry) {
            query.geometry = geometry;
            query.spatialRelationship = "intersects";
        }
        return layer.queryFeatureCount(query)
            .then(function (count) { return { title: layer.title, count: count }; })
            .catch(function () { return { title: layer.title, count: 0 }; });
    }

    function actualizarConteo(geometry) {
        Promise.all([
            contarEntidades(atencionesLayer, geometry),
            contarEntidades(poiLayer, geometry),
            contarEntidades(agasLayer, geometry),
            contarEntidades(sectoresLayer, geometry),
            contarEntidades(vulnerablesLayer, geometry)
        ]).then(function (results) {
            const rAtenciones = results[0];
            const rPoi = results[1];
            const rAgas = results[2];
            const rSectores = results[3];
            const rVulnerables = results[4];

            const esFiltrado = !!geometry || queryZonaActiva;
            const colorFondo = esFiltrado ? "rgba(0,119,182,0.12)" : "transparent";
            const tituloLabel = esFiltrado ? "Registros filtrados" : "Totales";

            conteoDiv.innerHTML =
                "<div style=\"padding:10px;box-sizing:border-box;font-size:0.85em;" +
                "background:" + colorFondo + ";border-radius:4px;\">" +

                "<h4 style=\"margin:0 0 8px;color:#0077b6;border-bottom:1px solid rgba(0,119,182,0.25);" +
                "padding-bottom:4px;\">" + tituloLabel + "</h4>" +

                "<div style=\"margin-bottom:8px;\">" +
                "<strong style=\"color:#e84646;\">Brigadas Médicas</strong>" +
                "<div style=\"padding-left:8px;margin-top:2px;\">" +
                rAtenciones.count.toLocaleString() + " atenciones</div></div>" +

                "<div style=\"border-top:1px solid rgba(0,119,182,0.15);padding-top:6px;\">" +
                "<strong style=\"color:#0077b6;\">Establecimientos</strong>" +
                "<div style=\"padding-left:8px;margin-top:2px;\">" +
                rPoi.count.toLocaleString() + " establecimientos</div></div>" +

                "<div style=\"border-top:1px solid rgba(0,119,182,0.15);padding-top:6px;margin-top:6px;\">" +
                "<strong style=\"color:#0077b6;\">Zonas</strong>" +
                "<div style=\"padding-left:8px;margin-top:2px;\">" +
                rAgas.count + "  AGAS" + "<br>" +
                rSectores.count + "  Sectores" + "<br>" +
                rVulnerables.count + "  Vulnerables" +

                "</div></div>" +
                "</div>";
        });
    }

    // ── Configuración de capas ────────────────────────────────────────────────
    const puntosConfig = [
        { layer: atencionesLayer, label: "Brigadas Médicas", color: "#0077b6" },
        { layer: poiLayer, label: "Establecimientos Salud", color: "#e84646" }
    ];

    // Polígonos primero (abajo), puntos encima
    [agasLayer, sectoresLayer, vulnerablesLayer, atencionesLayer, poiLayer].forEach(function (layer) {
        layer.visible = false;
        map.add(layer);
    });

    // ── UI ────────────────────────────────────────────────────────────────────
    const ui = setupUI(view, {
        capas: { atencionesLayer, poiLayer, agasLayer, sectoresLayer, vulnerablesLayer },
        conteoDiv: conteoDiv,
        onFiltroChange: function (activo) {
            queryZonaActiva = activo;
            actualizarConteo(queryGeomActiva);
        }
    });

    // Solo el tab Capas usa agregarCheckboxes — Zonas se maneja en uiSetup
    ui.agregarCheckboxes("puntos-slot", puntosConfig.map(function (c) {
        return Object.assign({}, c, { onChange: function () { traerGraficosAlFrente(); } });
    }));

    // ── Query por geometría ───────────────────────────────────────────────────
    view.when().then(function () {
        iniciarQueryGeometria(
            view, map,
            function (geom) {
                queryGeomActiva = geom;
                actualizarConteo(geom);
            },
            function () {
                queryGeomActiva = null;
                actualizarConteo(null);
            }
        );

        actualizarConteo(null);
    });

    map.layers.on("change", function (e) {
        if (e.added || e.moved) traerGraficosAlFrente();
    });
});