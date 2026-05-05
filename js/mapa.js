// js/mapa.js  —  ARGOS · Salud
require([
    "js/capas", "js/uiSetup", "js/mapSetup", "js/queryGeometria"
], function (capasModule, setupUI, mapSetup, iniciarQueryGeometria) {

    const map  = mapSetup.crearMapaBase();
    const view = mapSetup.crearMapView(map);

    // ── Estado ────────────────────────────────────────────────────────────────
    let atencionesLayer  = null;
    let queryGeomActiva  = null;   // radar (sketch)
    let queryGeomZona    = null;   // zona seleccionada
    let queryZonaActiva  = false;

    // ── Conteo ────────────────────────────────────────────────────────────────
    const conteoDiv = document.createElement("div");
    conteoDiv.style.minWidth = "200px";

    function contarEntidades(layer, geometry) {
        if (!layer) return Promise.resolve({ title: "", count: 0 });
        const query = layer.createQuery();
        query.where = layer.definitionExpression || "1=1";
        if (geometry) {
            query.geometry = geometry;
            query.spatialRelationship = "intersects";
        }
        return layer.queryFeatureCount(query)
            .then(function (count) { return { title: layer.title, count }; })
            .catch(function ()     { return { title: layer.title, count: 0 }; });
    }

    function actualizarConteo(geometry) {
        const capasAContar = [
            atencionesLayer, atencionesPHLayer,
            poiLayer, agasLayer, sectoresLayer, vulnerablesLayer
        ];

        Promise.all(capasAContar.map(function (l) {
            return contarEntidades(l, geometry);
        })).then(function (results) {
            const [rAtenciones, rAtencionesPH, rPoi, rAgas, rSectores, rVulnerables] = results;
            const esFiltrado  = !!geometry || queryZonaActiva;
            const colorFondo  = esFiltrado ? "rgba(0,119,182,0.12)" : "transparent";
            const tituloLabel = esFiltrado ? "Registros filtrados" : "Totales";

            conteoDiv.innerHTML =
                `<div style="padding:10px;box-sizing:border-box;font-size:0.85em;
                    background:${colorFondo};border-radius:4px;">

                <h4 style="margin:0 0 8px;color:#0077b6;border-bottom:1px solid
                    rgba(0,119,182,0.25);padding-bottom:4px;">${tituloLabel}</h4>

                <div style="margin-bottom:8px;">
                    <strong style="color:#e84646;">Brigadas Médicas</strong>
                    <div style="padding-left:8px;margin-top:2px;">
                        ${rAtenciones.count.toLocaleString()} atenciones</div></div>

                <div style="margin-bottom:8px;">
                    <strong style="color:#e84646;">Atenciones PH</strong>
                    <div style="padding-left:8px;margin-top:2px;">
                        ${rAtencionesPH.count.toLocaleString()} atenciones</div></div>

                <div style="border-top:1px solid rgba(0,119,182,0.15);padding-top:6px;">
                    <strong style="color:#0077b6;">Establecimientos</strong>
                    <div style="padding-left:8px;margin-top:2px;">
                        ${rPoi.count.toLocaleString()} establecimientos</div></div>

                <div style="border-top:1px solid rgba(0,119,182,0.15);padding-top:6px;margin-top:6px;">
                    <strong style="color:#0077b6;">Zonas</strong>
                    <div style="padding-left:8px;margin-top:2px;">
                        ${rAgas.count} AGAs<br>
                        ${rSectores.count} Sectores<br>
                        ${rVulnerables.count} Vulnerables
                    </div></div></div>`;
        });
    }

    // ── Capas ─────────────────────────────────────────────────────────────────
    const { atencionesPHLayer, poiLayer, agasLayer, sectoresLayer, vulnerablesLayer } =
        capasModule.crearCapas(function (layer) {
            atencionesLayer         = layer;
            atencionesLayer.visible = true;
            map.add(atencionesLayer);
            traerGraficosAlFrente();
            actualizarConteo(queryGeomZona || queryGeomActiva);

            ui.agregarCheckboxes("puntos-slot", [
                { layer: atencionesLayer,  label: "Brigadas Médicas",       color: "#0077b6", onChange: traerGraficosAlFrente },
                { layer: atencionesPHLayer, label: "Atenciones PH",         color: "#28a745", conFiltroGrupos: true, onChange: traerGraficosAlFrente },
                { layer: poiLayer,         label: "Establecimientos Salud", color: "#e84646", onChange: traerGraficosAlFrente }
            ]);
        });

    // ── Helpers ───────────────────────────────────────────────────────────────
    function traerGraficosAlFrente() {
        requestAnimationFrame(function () {
            const capasAlFrente = [atencionesLayer, atencionesPHLayer, poiLayer]
                .filter(function (l) { return l && map.layers.indexOf(l) !== -1; });
            capasAlFrente.forEach(function (layer, i) {
                map.reorder(layer, map.layers.length - capasAlFrente.length + i);
            });
        });
    }

    // ── Agregar capas al mapa ─────────────────────────────────────────────────
    [atencionesPHLayer, agasLayer, sectoresLayer, vulnerablesLayer].forEach(function (layer) {
        layer.visible = false;
        map.add(layer);
    });
    map.add(poiLayer);

    // ── UI ────────────────────────────────────────────────────────────────────
    const ui = setupUI(view, {
        capas: {
            get atencionesLayer() { return atencionesLayer; },
            atencionesPHLayer, poiLayer, agasLayer, sectoresLayer, vulnerablesLayer
        },
        conteoDiv,
        onFiltroChange: function (activo, geomZona) {
            queryZonaActiva = activo;
            queryGeomZona   = geomZona || null;
            actualizarConteo(queryGeomZona || queryGeomActiva);
        }
    });

    // ── Query por geometría (radar) ───────────────────────────────────────────
    view.when().then(function () {
        iniciarQueryGeometria(
            view, map,
            function (geom) { queryGeomActiva = geom; actualizarConteo(queryGeomZona || geom); },
            function ()     { queryGeomActiva = null; actualizarConteo(queryGeomZona || null); }
        );
        actualizarConteo(null);
    });

    map.layers.on("change", function (e) {
        if (e.added || e.moved) traerGraficosAlFrente();
    });
});