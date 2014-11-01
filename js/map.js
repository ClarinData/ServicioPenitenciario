var width = 500,
    height = 630,

    projection = d3.geo.transverseMercator()
    .center([2.5, -38.5])
    .rotate([66, 0])
    .scale((height * 56.5) / 33)
    .translate([(width / 2), (height / 2)]),

    svg = d3.select("#map")
    .append("svg")
    .attr("width", width)
    .attr("height", height),

    map = svg.append("g"),

    path = d3.geo.path()
    .projection(projection),

    groupMap = map.append("g"),

    groupData = {},

    radiusMultiplier = {
        // spf: .95,
        spf: .50,
        spp: .50
    };

groupData.Provincias = map.append("g")
             .attr("class","Provincias")
             .style("opacity", 1);

groupData.Ciudades = map.append("g")
         .attr("class","Ciudades")
         .style("opacity", 0);

var radiusCalc = function (value, total) {
        var radius = value * Math.sqrt(total / Math.PI)
        return d3.svg.arc()
            .outerRadius(radius - radius / 3)
            .innerRadius(radius);
    };

var backBtn = d3.select("#back")
                .on("click", function () {
                    groupMap.select("path").on("click").apply(this,null);
                });

queue()
  .defer(d3.json, "data/argentina_indec.json")
  .defer(d3.tsv, "data/condenados_procesados.tsv")
  .awaitAll(function(error, data) {
    console.log(error || '');

    (function (g, projection, json) {
        var mapData = topojson
                        .feature(json, json.objects.provincias)
                        .features
                        .sort(function (d) {
                            return (d.properties.administrative_area[0].id == "AMBA") ? 1 : 0;
                        });

        g.selectAll("undefined")
            .data(mapData, function (d) {
                return d.properties.administrative_area[0].id;
            })
            .enter()
            .append("path")
            .attr("class", function(d) {
                d.zoom = !d.properties.notzoom;
                var name = (
                                (d.properties.administrative_area[0].name) ?
                                 d.properties.administrative_area[0].name
                                                                    .replace(/\s+/g, "_")
                                                                    .toLowerCase() :
                                "notshow"
                            ),
                    classes = d.properties.administrative_area[0].class || "",
                    zoom = (d.zoom) ? "zoomout" : "";
                return "land " + classes + " " + name + " " + zoom;
            }, true)
            .attr("d", function (d) {
                switch (d.properties.administrative_area[0].id) {
                    case "TDF":
                        d.centroid = projection([-67.8515625,-54.43810280974017]);
                        break;
                    case "SAL":
                        d.centroid = projection([-65.2972412109375,-25.28443774698303]);
                        break;
                    default:
                        d.centroid = path.centroid(d);
                }                   

                return path(d);
            })
            .on("click", function (d) {
                if (!d || (d && d.zoom)) {
                    var b = path.bounds(d), // calculate bounding box
                        zoom = 0.95 / Math.max((b[1][0] - b[0][0]) / width, (b[1][1] - b[0][1]) / height),
                        translate = (d) ?
                                        [-(b[1][0] + b[0][0]) / 2, -(b[1][1] + b[0][1]) / 2] :
                                        [-width / 2, -height / 2],
                        thisPolygon = d3.select(this),
                        area = path.area(d),
                        duration = 500;

                    backBtn.classed("hidden", !zoom);

                    map.transition()
                        .duration(duration)
                        .attr("transform", "translate(" + width / 2  + "," + height / 2  + ") " +
                          "scale(" + (zoom || 1) + ") " +
                          "translate(" + translate + ")"
                        );

                    g.selectAll("path") // stroke with change on zoom
                        .classed("zoomout", function (g) {
                            g.zoom = !g.properties.notzoom && (d !== g);
                            return g.zoom;
                        })
                        .classed("zoomin", function (g) {
                            return !g.properties.notzoom && (d == g);
                        })
                        .transition()
                        .duration(duration)
                        .style("stroke-width", function() {
                          return (zoom) ? 1 / zoom + "px" : null;
                        });
                   
                    groupData['Provincias']
                        .transition()
                        .duration(duration)
                        .ease("cubic")
                        .style("opacity", function () {
                            return (d) ? 0 : 1;
                        });

                    groupData['Ciudades']
                        .transition()
                        .duration(duration)
                        .ease("cubic")
                        .style("opacity", function () {
                            return (!d) ? 0 : 1;
                        })
                        .selectAll("path")
                        .transition()
                        .duration(duration)
                        .attr("d", function(g) {
                            var m = (d) ? (37000/area)/zoom/6 : 0;
                                arc = (m) ? radiusCalc(m, g.data.total) : null;
                            return (d) ? arc(g) : '';
                        });
                };
                
            });
    })(
        groupMap,
        projection,
        data[0]
    );

    (function (g, projection, data) {

        var pie = d3.layout.pie()
            .sort(function(a, b) {
                return d3.ascending(a.type, b.type);
            })
            .value(function(d) {
                return d.value;
            });

        var markerCenter = function(marker, r) {
            var thisMarker = marker.append("g")
                                   .attr("class", function (d) {
                                        return "circle " + d.Jurisdiccion.toLowerCase();
                                   });
            thisMarker.append("circle")
                .attr("class", "select")
                .attr("r", r);
            return thisMarker;
        };

        var centroid = function (d) {
            return d3.select(d).datum().centroid;
        }

        var nestedData = {
            'Provincias': d3.nest()
                .key(function(d) {
                    return [d.Jurisdiccion, d.Provincia];
                })
                .rollup(function(d) {
                    return {
                        'Jurisdiccion': d[0].Jurisdiccion,
                        'Provincia': d[0].Provincia,
                        'Condenados': d3.sum(d, function(g) {
                            return g.Condenados;
                        }),
                        'Procesados': d3.sum(d, function(g) {
                            return g.Procesados;
                        })
                    };
                })
                .entries(data)
                .map(function(d) {
                    return d.values;
                }),
            'Ciudades': data
        };

        Object.keys(nestedData).forEach(function (level) {
            (function (g, data, levelRatio) {
                data
                    .sort(function (a,b) {
                        return (
                              parseInt(b.Condenados)
                            + parseInt(b.Procesados))
                            - (parseInt(a.Condenados)
                            + parseInt(a.Procesados)
                        );
                    })
                    .forEach(function(thisMarker) {

                        thisMarker.Total = parseInt(thisMarker.Procesados) + parseInt(thisMarker.Condenados);

                        var jurisdiccion = thisMarker.Jurisdiccion.toLowerCase(),

                        markerPoint = (
                                        thisMarker.geo_longitude && thisMarker.geo_latitude) ?
                                        projection([thisMarker.geo_longitude, thisMarker.geo_latitude]) :
                                        centroid("path.land." + thisMarker.Provincia
                                                                          .replace(/\s+/g, "_")
                                                                          .toLowerCase()
                                        );

                        (function (marker, arc) {
                            var centerCircleRadius = (parseInt(thisMarker.Total) == 0) ? 0 : (level=='Provincias') ? 1.5 : 0.5;
                            markerCenter(marker, centerCircleRadius);
                            (function (g) {
                                g.append("path")
                                    .attr("d", function(d) {
                                        // d.total = parseInt(thisMarker.Total);
                                        return (d.value) ? arc(d) : '';
                                    });

                            })(
                                marker.selectAll(".arc")
                                    .data(pie([{
                                        'type': 'Procesados',
                                        'value': parseInt(thisMarker.Procesados),
                                        'total': parseInt(thisMarker.Total),
                                        'domain': jurisdiccion
                                    }, {
                                        'type': 'Condenados',
                                        'value': parseInt(thisMarker.Condenados),
                                        'total': parseInt(thisMarker.Total),
                                        'domain': jurisdiccion
                                    }]))
                                    .enter().append("g")
                                    .attr("class", function(d) {
                                        return d.data.type
                                                     .toLowerCase() +
                                                     " arc " +
                                                     jurisdiccion;
                                    })
                            );
                        })(
                            // marker =
                            g.append("g")
                                    .datum(thisMarker)
                                    .attr("transform", "translate(" + markerPoint[0]
                                                     + "," + markerPoint[1] + ")")
                                    .attr("id", thisMarker.id)
                                    .attr("class", "marker")
                                    .on("click", function(d) {
                                        // console.log(!select.classed("active") && d);
                                        // select.classed("active", !select.classed("active"));
                                    }),
                            // arc =
                            radiusCalc(radiusMultiplier[jurisdiccion], thisMarker.Total)
                        );
                    });

            })(
                g[level],
                nestedData[level],
                (level=='Provincias') ? 30 : 1000
            );


        });

    })(
        groupData,
        projection,
        data[1]
    );

    /* Ajust heigth */

    d3.select(self.frameElement)
        .style("height", height + "px");

    /* Default marker ON & OFF by Form value */

    (function(formSelectorValue) {
        map.selectAll(".spp,.spf")
            .classed("hidden", function(d) {
                return (d.Jurisdiccion || d.data.domain).toLowerCase() != formSelectorValue;
            });
    })(
        d3.select("#formSelector input[type='radio']:checked").property("value")
    );

});