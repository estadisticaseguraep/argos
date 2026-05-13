// js/mapa.js  —  ARGOS · Salud
require([
    "js/capas", "js/uiSetup", "js/mapSetup", "js/queryGeometria"
], function (capasModule, setupUI, mapSetup, iniciarQueryGeometria) {

    const map = mapSetup.crearMapaBase();
    const view = mapSetup.crearMapView(map);

    // ── Estado ────────────────────────────────────────────────────────────────
    let atencionesLayer = null;
    let queryGeomActiva = null;
    let queryGeomZona = null;
    let queryZonaActiva = false;

    // ── Conteo — estructura fija, sin parpadeo ────────────────────────────────
    const conteoDiv = document.createElement("div");
    conteoDiv.style.minWidth = "220px";

    conteoDiv.innerHTML = `
    <div style="padding:4px 8px;font-size:11px;font-weight:600;color:var(--calcite-color-text-2);
        border-bottom:1px solid var(--calcite-color-border-2);margin-bottom:2px;">
        <span id="cnt-titulo">Totales</span>
    </div>
    <calcite-accordion selection-mode="multiple" scale="s">
        <calcite-accordion-item heading="Brigadas Médicas" icon-start="map-pin" expanded>
            <span id="cnt-brigadas" style="font-size:11px;padding:0 4px;">—</span>
        </calcite-accordion-item>
        <calcite-accordion-item heading="Atenciones PH" icon-start="map-pin" expanded>
            <span id="cnt-ph" style="font-size:10px;padding:0 4px;">—</span>
            <div id="cnt-top5" style="margin-top:6px;padding:0 4px;"></div>
        </calcite-accordion-item>
        <calcite-accordion-item heading="Establecimientos" icon-start="organization">
            <span id="cnt-poi" style="font-size:11px;padding:0 4px;">—</span>
        </calcite-accordion-item>
        <calcite-accordion-item heading="Zonas" icon-start="map">
            <div id="cnt-zonas" style="font-size:11px;line-height:1.8;padding:0 4px;">—</div>
        </calcite-accordion-item>
    </calcite-accordion>
    <style>
        calcite-accordion-item::part(content) { padding: 4px 8px 8px; }
    </style>`;

    if (window.customElements) customElements.upgrade(conteoDiv);

    const elBlock = conteoDiv.querySelector("#cnt-titulo");
    const elBrigadas = conteoDiv.querySelector("#cnt-brigadas");
    const elPH = conteoDiv.querySelector("#cnt-ph");
    const elTop5 = conteoDiv.querySelector("#cnt-top5");
    const elPoi = conteoDiv.querySelector("#cnt-poi");
    const elZonas = conteoDiv.querySelector("#cnt-zonas");

    // ── Helpers de query ──────────────────────────────────────────────────────
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
            .catch(function () { return { title: layer.title, count: 0 }; });
    }

    function top5Tipos(geometry) {
        if (!atencionesPHLayer) return Promise.resolve([]);
        const query = atencionesPHLayer.createQuery();
        query.where = atencionesPHLayer.definitionExpression || "1=1";
        query.outFields = ["Tipo"];
        query.returnGeometry = false;
        if (geometry) {
            query.geometry = geometry;
            query.spatialRelationship = "intersects";
        }
        return atencionesPHLayer.queryFeatures(query).then(function (result) {
            const conteos = {};
            result.features.forEach(function (f) {
                const tipo = f.attributes.Tipo || f.attributes.tipo || "Sin tipo";
                conteos[tipo] = (conteos[tipo] || 0) + 1;
            });
            return Object.entries(conteos)
                .sort(function (a, b) { return b[1] - a[1]; })
                .slice(0, 5);
        }).catch(function () { return []; });
    }

    // ── Actualizar conteo — solo toca texto, sin recrear HTML ─────────────────
    function actualizarConteo(geometry) {
        const capasAContar = [
            atencionesLayer, atencionesPHLayer,
            poiLayer, agasLayer, sectoresLayer, vulnerablesLayer
        ];

        Promise.all([
            ...capasAContar.map(function (l) { return contarEntidades(l, geometry); }),
            top5Tipos(geometry)
        ]).then(function (results) {
            const [rAtenciones, rAtencionesPH, rPoi, rAgas, rSectores, rVulnerables, top5] = results;
            const esFiltrado = !!geometry || queryZonaActiva;

            elBlock.textContent = esFiltrado ? "🔵 Registros filtrados" : "Totales";
            elBlock.style.color = esFiltrado ? "#0077b6" : "";

            elBrigadas.textContent = rAtenciones.count.toLocaleString() + " atenciones";
            elPH.textContent = rAtencionesPH.count.toLocaleString() + " atenciones";
            elPoi.textContent = rPoi.count.toLocaleString() + " establecimientos";
            elZonas.innerHTML = `${rAgas.count} AGAs<br>${rSectores.count} Sectores<br>${rVulnerables.count} Vulnerables`;

            const maxTop5 = top5.length > 0 ? top5[0][1] : 1;
            elTop5.innerHTML = top5.length === 0
                ? '<div style="opacity:0.5;font-size:11px;">Sin datos</div>'
                : top5.map(function (item) {
                    const pct = Math.round((item[1] / maxTop5) * 100);
                    return `
                        <div style="margin-bottom:5px;">
                            <div style="display:flex;justify-content:space-between;font-size:11px;margin-bottom:2px;">
                                <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:140px;"
                                    title="${item[0]}">${item[0]}</span>
                                <span style="font-weight:bold;color:#0077b6;margin-left:4px;">${item[1].toLocaleString()}</span>
                            </div>
                            <div style="background:rgba(0,119,182,0.12);border-radius:3px;height:5px;">
                                <div style="width:${pct}%;background:#0077b6;height:5px;border-radius:3px;transition:width 0.4s;"></div>
                            </div>
                        </div>`;
                }).join("");
        });
    }

    // ── Capas ─────────────────────────────────────────────────────────────────
    const { atencionesPHLayer, poiLayer, agasLayer, sectoresLayer, vulnerablesLayer, inundacionLayer, deslizamientosLayer } =
        capasModule.crearCapas(function (layer) {
            atencionesLayer = layer;
            atencionesLayer.visible = true;
            map.add(atencionesLayer);
            traerGraficosAlFrente();
            actualizarConteo(queryGeomZona || queryGeomActiva);

            ui.agregarCheckboxes("puntos-slot", [
                { layer: atencionesLayer, label: "Brigadas Médicas", color: "#0077b6", onChange: traerGraficosAlFrente },
                { layer: atencionesPHLayer, label: "Atenciones PH", color: "#28a745", conFiltroGrupos: true, onChange: traerGraficosAlFrente },
                { layer: poiLayer, label: "Establecimientos Salud", color: "#e84646", onChange: traerGraficosAlFrente }
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
    [atencionesPHLayer, agasLayer, sectoresLayer, vulnerablesLayer, inundacionLayer, deslizamientosLayer].forEach(function (layer) {
        layer.visible = false;
        map.add(layer);
    });
    map.add(poiLayer);

    // ── UI ────────────────────────────────────────────────────────────────────
    const ui = setupUI(view, {
        capas: {
            get atencionesLayer() { return atencionesLayer; },
            atencionesPHLayer, poiLayer, agasLayer, sectoresLayer, vulnerablesLayer,
            inundacionLayer, deslizamientosLayer
        },
        conteoDiv,
        onFiltroChange: function (activo, geomZona) {
            queryZonaActiva = activo;
            queryGeomZona = geomZona || null;
            actualizarConteo(queryGeomZona || queryGeomActiva);
        }
    });

    // ── Query por geometría (radar) ───────────────────────────────────────────
    view.when().then(function () {
        iniciarQueryGeometria(
            view, map,
            function (geom) { queryGeomActiva = geom; actualizarConteo(queryGeomZona || geom); },
            function () { queryGeomActiva = null; actualizarConteo(queryGeomZona || null); }
        );
        actualizarConteo(null);
    });

    map.layers.on("change", function (e) {
        if (e.added || e.moved) traerGraficosAlFrente();
    });
});