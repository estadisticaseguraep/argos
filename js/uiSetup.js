// js/uiSetup.js  —  ARGOS · Salud
define([
    "esri/widgets/Expand",
    "esri/widgets/Fullscreen",
    "esri/widgets/BasemapGallery"
], function (Expand, Fullscreen, BasemapGallery) {

    return function setupUI(view, opciones) {
        const { capas, conteoDiv, onFiltroChange } = opciones;
        const { agasLayer, sectoresLayer } = capas;

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

        // ── Tabs ──────────────────────────────────────────────────────────────
        const TABS = [
            { id: "puntos", label: "Capas", icon: "layers" },
            { id: "zonas", label: "Zonas", icon: "map-pin" },
            { id: "radar", label: "Radar", icon: "analysis" }
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

        // ── Tab Capas: slot checkboxes ────────────────────────────────────────
        const slotPuntos = document.createElement("div");
        slotPuntos.setAttribute("data-slot", "puntos-slot");
        panes["puntos"].appendChild(slotPuntos);

        // ── Tab Zonas: acordeón con combobox dinámico ─────────────────────────
        const accordion = document.createElement("calcite-accordion");
        accordion.setAttribute("selection-mode", "multiple");
        accordion.setAttribute("scale", "s");

        // Helper: crea un accordion-item con checkbox de capa + combobox dinámico
        function crearItemZona(cfg) {
            const item = document.createElement("calcite-accordion-item");
            item.setAttribute("heading", cfg.heading);
            item.setAttribute("icon-start", "basemap");

            // Checkbox para activar/desactivar la capa
            const chk = document.createElement("input");
            chk.type = "checkbox";
            chk.checked = false;
            chk.style.accentColor = cfg.color;
            chk.title = "Activar capa";

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

            // combobox — se puebla al activar la capa
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
                    combo.querySelectorAll("calcite-combobox-item").forEach(function (ci) {
                        ci.removeAttribute("selected");
                    });
                    cfg.layer.definitionExpression = "1=1";
                    cfg.atencionesLayer.definitionExpression = "1=1";
                    cfg.poiLayer.definitionExpression = "1=1";
                    if (onFiltroChange) onFiltroChange(false);
                }
            });

            // Filtrar capas + zoom al seleccionar en el combobox
            combo.addEventListener("calciteComboboxChange", function () {
                const sel = Array.from(combo.selectedItems).map(function (i) { return i.value; });

                if (sel.length === 0) {
                    cfg.layer.definitionExpression = "1=1";
                    cfg.atencionesLayer.definitionExpression = "1=1";
                    cfg.poiLayer.definitionExpression = "1=1";
                    if (onFiltroChange) onFiltroChange(false);
                    return;
                }

                const whereIn = sel.map(function (v) { return "'" + v + "'"; }).join(",");
                const expr = cfg.campo + " IN (" + whereIn + ")";

                // Filtrar la capa de zona y la capa de atenciones
                cfg.layer.definitionExpression = expr;
                cfg.atencionesLayer.definitionExpression = expr;
                cfg.poiLayer.definitionExpression = expr;

                // Notificar para actualizar el conteo
                if (onFiltroChange) onFiltroChange(true);

                // Zoom a la extensión de los polígonos seleccionados
                const q = cfg.layer.createQuery();
                q.where = expr;
                q.returnGeometry = true;
                cfg.layer.queryExtent(q).then(function (result) {
                    if (result && result.extent) {
                        view.goTo(result.extent.expand(1.3), { duration: 800 });
                    }
                });
            });

            return item;
        }

        accordion.appendChild(crearItemZona({
            heading: "Coberturas AGAs",
            color: "#00b4d8",
            layer: agasLayer,
            atencionesLayer: capas.atencionesLayer,
            poiLayer: capas.poiLayer,
            geojson: "geojson/agas.geojson",
            campo: "AGA"
        }));

        accordion.appendChild(crearItemZona({
            heading: "Sectores",
            color: "#0077b6",
            layer: sectoresLayer,
            atencionesLayer: capas.atencionesLayer,
            poiLayer: capas.poiLayer,
            geojson: "geojson/sectores.geojson",
            campo: "SECT_NOMEN"
        }));

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
            { id: "queryPoint", icon: "pin", label: "Punto", type: "point" },
            { id: "queryLine", icon: "line", label: "Linea", type: "polyline" },
            { id: "queryPolygon", icon: "polygon", label: "Poligono", type: "polygon" }
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
                    chk.addEventListener("change", function () {
                        if (cfg.layer) cfg.layer.visible = chk.checked;
                        if (cfg.onChange) cfg.onChange(chk.checked, cfg.layer);
                    });

                    const dot = document.createElement("span");
                    dot.className = "cp-dot";
                    dot.style.background = cfg.color || "#0077b6";

                    const sp = document.createElement("span");
                    sp.textContent = cfg.label;

                    row.appendChild(chk);
                    row.appendChild(dot);
                    row.appendChild(sp);
                    slot.appendChild(row);
                });
            }
        };
    };
});