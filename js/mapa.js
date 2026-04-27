// js/mapa.js  —  ARGOS · Salud
require([
    "js/capas", "js/uiSetup", "js/mapSetup", "js/queryGeometria"
], function (
    capasModule, setupUI, mapSetup, iniciarQueryGeometria
) {

    const map = mapSetup.crearMapaBase();
    const view = mapSetup.crearMapView(map);

    const conteoDiv = document.createElement("div");
    conteoDiv.style.minWidth = "200px";

    // ── Estado ────────────────────────────────────────────────────────────────
    let atencionesLayer = null;   // se asigna cuando el CSV termina de cargar
    let queryGeomActiva = null;
    let queryZonaActiva = false;

    // ── Conteo ────────────────────────────────────────────────────────────────
    function contarEntidades(layer, geometry) {
        if (!layer) return Promise.resolve({ title: "", count: 0 });

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
            contarEntidades(atencionesPHLayer, geometry),
            contarEntidades(poiLayer, geometry),
            contarEntidades(agasLayer, geometry),
            contarEntidades(sectoresLayer, geometry),
            contarEntidades(vulnerablesLayer, geometry)
        ]).then(function (results) {
            const rAtenciones = results[0];
            const rAtencionesPH = results[1];
            const rPoi = results[2];
            const rAgas = results[3];
            const rSectores = results[4];
            const rVulnerables = results[5];

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

                "<div style=\"margin-bottom:8px;\">" +
                "<strong style=\"color:#e84646;\">Atenciones PH</strong>" +
                "<div style=\"padding-left:8px;margin-top:2px;\">" +
                results[1].count.toLocaleString() + " atenciones</div></div>" +

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
                "</div></div></div>";
        });
    }

    // ── Capas síncronas ───────────────────────────────────────────────────────
    const { atencionesPHLayer, poiLayer, agasLayer, sectoresLayer, vulnerablesLayer } =
        capasModule.crearCapas(function (layer) {
            // Callback: atencionesLayer lista → agregar al mapa y contar
            atencionesLayer = layer;
            atencionesLayer.visible = false;
            map.add(atencionesLayer);
            traerGraficosAlFrente();
            actualizarConteo(queryGeomActiva);

            // Registrar en UI el checkbox de Brigadas Médicas
            ui.agregarCheckboxes("puntos-slot", puntosConfig());
        });

    // ── Helpers ───────────────────────────────────────────────────────────────
    function traerGraficosAlFrente() {
        requestAnimationFrame(function () {
            const n = map.layers.length;
            const capasAlFrente = [atencionesLayer, atencionesPHLayer, poiLayer]
                .filter(function (l) { return l && map.layers.indexOf(l) !== -1; });
            capasAlFrente.forEach(function (layer, i) {
                map.reorder(layer, n - capasAlFrente.length + i);
            });
        });
    }

    function puntosConfig() {
        return [
            {
                layer: atencionesLayer, label: "Brigadas Médicas", color: "#0077b6",
                onChange: function () { traerGraficosAlFrente(); }
            },
            {
                layer: atencionesPHLayer, label: "Atenciones PH", color: "#28a745",  // ← AGREGAR
                onChange: function () { traerGraficosAlFrente(); }
            },
            {
                layer: poiLayer, label: "Establecimientos Salud", color: "#e84646",
                onChange: function () { traerGraficosAlFrente(); }
            }
        ];
    }

    // ── Capas síncronas al mapa (polígonos abajo, poi encima) ─────────────────
    [atencionesPHLayer, agasLayer, sectoresLayer, vulnerablesLayer, poiLayer].forEach(function (layer) {
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

    // Checkboxes de POI ya disponible; Brigadas se registra en el callback
    ui.agregarCheckboxes("puntos-slot", [
        {
            layer: atencionesPHLayer, label: "Atenciones PH", color: "#28a745",  conFiltroGrupos: true,
            onChange: function () { traerGraficosAlFrente(); }
        },
        {
            layer: poiLayer, label: "Establecimientos Salud", color: "#e84646",
            onChange: function () { traerGraficosAlFrente(); }
        }
    ]);

    // ── Query por geometría ───────────────────────────────────────────────────
    view.when().then(function () {
        iniciarQueryGeometria(
            view, map,
            function (geom) { queryGeomActiva = geom; actualizarConteo(geom); },
            function () { queryGeomActiva = null; actualizarConteo(null); }
        );
        actualizarConteo(null);
    });

    map.layers.on("change", function (e) {
        if (e.added || e.moved) traerGraficosAlFrente();
    });
});