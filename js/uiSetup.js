// js/uiSetup.js  —  ARGOS · Salud
define([
    "esri/widgets/Expand",
    "esri/widgets/Fullscreen",
    "esri/widgets/BasemapGallery",
    "esri/widgets/Legend",
    "esri/geometry/geometryEngine"
], function (Expand, Fullscreen, BasemapGallery, Legend, geometryEngine) {

    function obtenerGeometriaZona(layer, campo, valores) {
        if (!valores || valores.length === 0) return Promise.resolve(null);
        const q = layer.createQuery();
        q.where = campo + " IN (" + valores.map(function (v) { return "'" + v + "'"; }).join(",") + ")";
        q.returnGeometry = true;
        q.outFields = [];
        return layer.queryFeatures(q).then(function (result) {
            if (!result.features || result.features.length === 0) return null;
            const geoms = result.features.map(function (f) { return f.geometry; });
            return geoms.length === 1 ? geoms[0] : geometryEngine.union(geoms);
        });
    }

    function aplicarFiltroEspacial(layer, geometry) {
        if (!layer) return;
        if (!geometry) {
            layer.featureEffect = null;
            return;
        }
        require(["esri/layers/support/FeatureEffect", "esri/layers/support/FeatureFilter"],
            function (FeatureEffect, FeatureFilter) {
                layer.featureEffect = new FeatureEffect({
                    filter: new FeatureFilter({
                        geometry: geometry,
                        spatialRelationship: "intersects"
                    }),
                    excludedEffect: "grayscale(80%) opacity(20%)"
                });
            }
        );
    }

    return function setupUI(view, opciones) {
        const { capas, conteoDiv, onFiltroChange } = opciones;
        const { agasLayer, sectoresLayer, vulnerablesLayer } = capas;

        view.ui.add(new Fullscreen({ view }), "top-right");
        view.ui.add(new Expand({
            view,
            content: new BasemapGallery({ view }),
            expandIcon: "basemap",
            expandTooltip: "Cambiar mapa base",
            expanded: false
        }), "top-right");

        view.ui.add(new Expand({
            view,
            content: conteoDiv,
            expandIcon: "graph-bar",
            expandTooltip: "Estadisticas",
            expanded: true
        }), "bottom-right");

        // ── Panel top-left ────────────────────────────────────────────────────
        const panel = document.createElement("div");
        panel.className = "cp-panel";

        const TABS = [
            { id: "puntos", label: "Capas",  icon: "layers"   },
            { id: "zonas",  label: "Zonas",  icon: "map-pin"  },
            { id: "radar",  label: "Radar",  icon: "analysis" }
        ];

        const tabBar = document.createElement("div");
        tabBar.className = "cp-tabs";

        const body = document.createElement("div");
        body.className = "cp-body";

        const panes = {};

        TABS.forEach(function (t) {
            const tab = document.createElement("div");
            tab.className = "cp-tab" + (t.id === "puntos" ? " active" : "");
            tab.dataset.tab = t.id;

            const ci = document.createElement("calcite-icon");
            ci.setAttribute("icon", t.icon);
            ci.setAttribute("scale", "s");
            tab.appendChild(ci);

            const ls = document.createElement("span");
            ls.textContent = t.label;
            tab.appendChild(ls);

            tab.addEventListener("click", function () {
                tabBar.querySelectorAll(".cp-tab").forEach(function (x) { x.classList.remove("active"); });
                body.querySelectorAll(".cp-pane").forEach(function (x) { x.classList.remove("active"); });
                tab.classList.add("active");
                panes[t.id].classList.add("active");
            });

            tabBar.appendChild(tab);

            const pane = document.createElement("div");
            pane.className = "cp-pane" + (t.id === "puntos" ? " active" : "");
            panes[t.id] = pane;
            body.appendChild(pane);
        });

        // ── Tab Capas ─────────────────────────────────────────────────────────
        const slotPuntos = document.createElement("div");
        slotPuntos.setAttribute("data-slot", "puntos-slot");
        panes["puntos"].appendChild(slotPuntos);

        // ── Tab Zonas ─────────────────────────────────────────────────────────
        const accordion = document.createElement("calcite-accordion");
        accordion.setAttribute("selection-mode", "multiple");
        accordion.setAttribute("scale", "s");

        function crearItemZona(cfg) {
            const item = document.createElement("calcite-accordion-item");
            item.setAttribute("heading", cfg.heading);
            item.setAttribute("icon-start", "basemap");

            const chk = document.createElement("input");
            chk.type = "checkbox";
            chk.checked = false;
            chk.style.accentColor = cfg.color;

            const chkLabel = document.createElement("label");
            chkLabel.className = "cp-row";
            const dot = document.createElement("span");
            dot.className = "cp-dot";
            dot.style.background = cfg.color;
            const txt = document.createElement("span");
            txt.textContent = cfg.heading;
            chkLabel.appendChild(chk);
            chkLabel.appendChild(dot);
            chkLabel.appendChild(txt);
            item.appendChild(chkLabel);

            const combo = document.createElement("calcite-combobox");
            combo.setAttribute("placeholder", "Seleccionar...");
            combo.setAttribute("selection-mode", "multiple");
            combo.setAttribute("scale", "s");
            combo.setAttribute("overlay-positioning", "fixed");
            combo.style.marginTop = "6px";
            combo.style.display = "none";
            item.appendChild(combo);

            let cargado = false;

            chk.addEventListener("change", function () {
                cfg.layer.visible = chk.checked;

                if (chk.checked) {
                    combo.style.display = "";
                    if (!cargado) {
                        cargado = true;
                        fetch(cfg.geojson)
                            .then(function (r) { return r.json(); })
                            .then(function (data) {
                                const valores = [...new Set(
                                    data.features
                                        .map(function (f) { return f.properties[cfg.campo]; })
                                        .filter(function (v) { return v != null && v !== ""; })
                                )].sort();
                                valores.forEach(function (v) {
                                    const ci = document.createElement("calcite-combobox-item");
                                    ci.setAttribute("value", v);
                                    ci.setAttribute("text-label", v);
                                    combo.appendChild(ci);
                                });
                            });
                    }
                } else {
                    combo.style.display = "none";
                    combo.querySelectorAll("calcite-combobox-item")
                        .forEach(function (ci) { ci.removeAttribute("selected"); });
                    cfg.layer.definitionExpression = "1=1";
                    aplicarFiltroEspacial(capas.poiLayer, null);
                    if (capas.atencionesLayer)   aplicarFiltroEspacial(capas.atencionesLayer, null);
                    if (capas.atencionesPHLayer)  aplicarFiltroEspacial(capas.atencionesPHLayer, null);
                    if (onFiltroChange) onFiltroChange(false, null);
                }
            });

            combo.addEventListener("calciteComboboxChange", function () {
                const sel = Array.from(combo.selectedItems).map(function (i) { return i.value; });

                if (sel.length === 0) {
                    cfg.layer.definitionExpression = "1=1";
                    aplicarFiltroEspacial(capas.poiLayer, null);
                    if (capas.atencionesLayer)   aplicarFiltroEspacial(capas.atencionesLayer, null);
                    if (capas.atencionesPHLayer)  aplicarFiltroEspacial(capas.atencionesPHLayer, null);
                    if (onFiltroChange) onFiltroChange(false, null);
                    return;
                }

                obtenerGeometriaZona(cfg.layer, cfg.campo, sel).then(function (geom) {
                    if (!geom) return;
                    aplicarFiltroEspacial(capas.poiLayer, geom);
                    if (capas.atencionesLayer)   aplicarFiltroEspacial(capas.atencionesLayer, geom);
                    if (capas.atencionesPHLayer)  aplicarFiltroEspacial(capas.atencionesPHLayer, geom);

                    const whereIn = sel.map(function (v) { return "'" + v + "'"; }).join(",");
                    cfg.layer.definitionExpression = cfg.campo + " IN (" + whereIn + ")";

                    if (onFiltroChange) onFiltroChange(true, geom);

                    const q = cfg.layer.createQuery();
                    q.where = cfg.layer.definitionExpression;
                    q.returnGeometry = true;
                    cfg.layer.queryExtent(q).then(function (result) {
                        if (result && result.extent) {
                            view.goTo(result.extent.expand(1.3), { duration: 800 });
                        }
                    });
                });
            });

            return item;
        }

        [
            { heading: "Coberturas AGAs",        color: "#00b4d8", layer: agasLayer,        geojson: "geojson/agas.geojson",        campo: "AGA"        },
            { heading: "Sectores",               color: "#0077b6", layer: sectoresLayer,    geojson: "geojson/sectores.geojson",    campo: "SECT_NOMEN" },
            { heading: "Habitantes Vulnerables", color: "#1eb600", layer: vulnerablesLayer, geojson: "geojson/vulnerables.geojson", campo: "AGA"        }
        ].forEach(function (cfg) { accordion.appendChild(crearItemZona(cfg)); });

        panes["zonas"].appendChild(accordion);

        // ── Tab Radar ─────────────────────────────────────────────────────────
        const radarPane = panes["radar"];

        const watsonTitle = document.createElement("p");
        watsonTitle.className = "watson-title";
        watsonTitle.textContent = "Seleccione una geometria:";
        radarPane.appendChild(watsonTitle);

        const watsonBtnBar = document.createElement("div");
        watsonBtnBar.className = "watson-btnbar";
        [
            { id: "queryPoint",   icon: "pin",     label: "Punto",   type: "point"    },
            { id: "queryLine",    icon: "line",     label: "Linea",   type: "polyline" },
            { id: "queryPolygon", icon: "polygon",  label: "Poligono",type: "polygon"  }
        ].forEach(function (dt) {
            const btn = document.createElement("button");
            btn.className = "watson-tool-btn";
            btn.id = dt.id;
            btn.dataset.drawType = dt.type;
            btn.title = dt.label;
            const bci = document.createElement("calcite-icon");
            bci.setAttribute("icon", dt.icon);
            bci.setAttribute("scale", "s");
            const bsp = document.createElement("span");
            bsp.textContent = dt.label;
            btn.appendChild(bci);
            btn.appendChild(bsp);
            watsonBtnBar.appendChild(btn);
        });
        radarPane.appendChild(watsonBtnBar);

        const bufferWrap = document.createElement("div");
        bufferWrap.className = "watson-buffer-wrap";
        const bufLabel = document.createElement("label");
        bufLabel.className = "watson-label";
        bufLabel.innerHTML = "Buffer: <strong id=\"bufferValueLabel\">0</strong> m";
        const bufSlider = document.createElement("input");
        bufSlider.type = "range";
        bufSlider.id = "queryBufferSlider";
        bufSlider.min = "0";
        bufSlider.max = "2000";
        bufSlider.value = "0";
        bufSlider.step = "10";
        bufSlider.style.width = "100%";
        bufSlider.style.accentColor = "#0077b6";
        bufferWrap.appendChild(bufLabel);
        bufferWrap.appendChild(bufSlider);
        radarPane.appendChild(bufferWrap);

        const clearBtn = document.createElement("button");
        clearBtn.className = "watson-clear-btn";
        const trashIcon = document.createElement("calcite-icon");
        trashIcon.setAttribute("icon", "trash");
        trashIcon.setAttribute("scale", "s");
        clearBtn.appendChild(trashIcon);
        clearBtn.appendChild(document.createTextNode(" Limpiar"));
        radarPane.appendChild(clearBtn);

        // ── Montar panel ──────────────────────────────────────────────────────
        panel.appendChild(tabBar);
        panel.appendChild(body);

        view.ui.add(new Expand({
            view,
            content: panel,
            expandIcon: "layers",
            expandTooltip: "Panel de Control",
            expanded: true
        }), "top-left");

        // ── Leyenda Vulnerables ───────────────────────────────────────────────
        const legend = new Legend({
            view,
            layerInfos: [{ layer: vulnerablesLayer, title: "Población Vulnerable por AGA" }]
        });
        const legendExpand = new Expand({
            view,
            content: legend,
            expandIcon: "legend",
            expandTooltip: "Población Vulnerable por AGA",
            expanded: true
        });
        legendExpand.visible = false;
        vulnerablesLayer.watch("visible", function (isVisible) {
            legendExpand.visible = isVisible;
            if (!isVisible) legendExpand.collapse();
        });
        view.ui.add(legendExpand, "bottom-left");

        // ── API pública ───────────────────────────────────────────────────────
        return {
            agregarCheckboxes: function (slotId, items) {
                const slot = panel.querySelector("[data-slot=\"" + slotId + "\"]");
                if (!slot) return;
                slot.innerHTML = "";

                items.forEach(function (cfg) {
                    const row = document.createElement("label");
                    row.className = "cp-row";
                    const chk = document.createElement("input");
                    chk.type = "checkbox";
                    chk.checked = cfg.layer ? !!cfg.layer.visible : false;
                    chk.style.accentColor = cfg.color || "#0077b6";
                    const dot = document.createElement("span");
                    dot.className = "cp-dot";
                    dot.style.background = cfg.color || "#0077b6";
                    const sp = document.createElement("span");
                    sp.textContent = cfg.label;
                    row.appendChild(chk);
                    row.appendChild(dot);
                    row.appendChild(sp);

                    const wrapper = document.createElement("div");
                    wrapper.appendChild(row);

                    if (cfg.conFiltroGrupos) {
                        const combo = document.createElement("calcite-combobox");
                        combo.setAttribute("placeholder", "Filtrar estado...");
                        combo.setAttribute("selection-mode", "single");
                        combo.setAttribute("scale", "s");
                        combo.setAttribute("overlay-positioning", "fixed");
                        combo.style.cssText = "display:none;margin-top:4px;width:100%;";
                        ["RESUELTAS", "PENDIENTES"].forEach(function (v) {
                            const ci = document.createElement("calcite-combobox-item");
                            ci.setAttribute("value", v);
                            ci.setAttribute("text-label", v);
                            combo.appendChild(ci);
                        });
                        wrapper.appendChild(combo);

                        chk.addEventListener("change", function () {
                            cfg.layer.visible = chk.checked;
                            combo.style.display = chk.checked ? "" : "none";
                            if (!chk.checked) { cfg.layer.definitionExpression = null; combo.value = ""; }
                            if (cfg.onChange) cfg.onChange();
                        });
                        combo.addEventListener("calciteComboboxChange", function (e) {
                            cfg.layer.definitionExpression = e.target.value
                                ? "Finalizacion_grupos = '" + e.target.value + "'"
                                : null;
                            if (onFiltroChange) onFiltroChange(!!e.target.value, null);
                        });
                    } else {
                        chk.addEventListener("change", function () {
                            cfg.layer.visible = chk.checked;
                            if (cfg.onChange) cfg.onChange();
                        });
                    }

                    slot.appendChild(wrapper);
                });
            }
        };
    };
});