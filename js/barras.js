var es_ES = {
          "decimal": ",",
          "thousands": ".",
          "grouping": [3],
          "currency": ["$", ""],
          "dateTime": "%a %b %e %X %Y",
          "date": "%d/%m/%Y",
          "time": "%H:%M:%S",
          "periods": ["AM", "PM"],
          "days": ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"],
          "shortDays": ["Dom", "Lun", "Mar", "Mie", "Jue", "Vie", "Sab"],
          "months": ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
          "shortMonths": ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
      };
        var ES = d3.locale(es_ES),
            formatNumber = {
                "Presos": ES.numberFormat(','),
                "Presupuesto": ES.numberFormat('$,.0f'),
                "Costo_Preso_Mes": ES.numberFormat('$,.0f'),
                "Reincidencia": ES.numberFormat('.1%'),
                "No_Trabaja": ES.numberFormat('.1%'),
                "No_Tuvo_Capacitación_Laboral": ES.numberFormat('%'),
                "No_Estudia": ES.numberFormat('.1%'),
            },
            formatData = function (data, format) {
              var number = parseFloat(data),
                  value = (data.match(/%/)) ? number/100 : number,
                  prefix = d3.formatPrefix(value);
              value = value || "Sin datos";
              switch(prefix.symbol) {
                case "M":
                  value = format(prefix.scale(parseFloat(value))) + " M";
                  break;
                case "G":
                  value = format(prefix.scale(parseFloat(value)*1000)) + " M";
                  break;
                case "T":
                  value = format(prefix.scale(parseFloat(value))) + " B";
                  break;
                default:
              };
              return (isNaN(value)) ? value : format(value);
            };
        
        var BarsGenerator = (function (window, undefined) {
      
                function maxValue (dataSelector,data) {
                    return  d3.max(data,function (d) {
                                return parseFloat(d[dataSelector]);
                            });
                };

                function create (selection, dataSelector, callback) {

                    if (callback) {
                        callback(selection);
                    }

                    return selection
                             .append("div")
                             .attr("id", "bars-" + dataSelector)
                             .attr("class", "bars");
                             
                             
                }

                function initialize (selection, dataSelector, data) {

                    var barsParent = create(selection, dataSelector, function (selection) {
                        selection.select("div[id|='bars']").remove();
                    });

                    return draw(barsParent, dataSelector, data);
                }

                function draw (selection, dataSelector, data) {

                    var bars = selection.selectAll("div.bar")
                                        .data(data)
                                        .enter()
                                        .append("div")
                                        .attr("class", function (d) {
                                            return "bar " + d.Jurisdiccion.toLowerCase();
                                        })
                                        .attr("style", "width: 0;");

                    update(bars, dataSelector, data);

                    return bars;
                };

                function update (selection, dataSelector, data) {

                    var thisMaxValue = maxValue(dataSelector, data);

                    selection
                        .transition()
                        .duration(850)
                        .attr("style", function (d) {
                            var width = (d[dataSelector].match(/%/)) ?
                                            d[dataSelector] :
                                            (parseFloat(d[dataSelector]) / thisMaxValue * 100) + "%";
                            return "width:" + width + ";";
                        });

                    return selection;
                };

              return {
                        update: update,
                        initialize: initialize
                    };
              
            })(window);
     
      queue()
          .defer(d3.tsv, "data/estadisticas_jurisdiccionales.tsv")
          .awaitAll(function(error, data) {
            data = data[0].sort(function (a,b) {
                return (a.Jurisdiccion.toLowerCase() == 'spf') ? -1 : d3.ascending(a.Provincia, b.Provincia);
            });

            var selection = d3.select("#mySelect").node().value;

            var myBars = BarsGenerator.initialize(d3.select('#barrasPuras'),selection, data);

            var dataName = myBars
                            .data()
                            .map(function (d) {
                                return d.Provincia;
                            });

            d3.select("#barrasProvincias")
                 .selectAll("div")
                 .data(dataName)
                 .enter()
                 .append("div")
                 .text(function (d) {
                     return d;
                 });

            var barrasNumeros = d3.select("#barrasNumeros")
                .selectAll("div")
                .data(data)
                .enter()
                .append("div")
                .text(function(d) {
                  return formatData(d[selection],formatNumber[selection]);
                
                });
                

            d3.select("#mySelect").on("change", function (d) {
                var selection = d3.select("#mySelect").node().value;
                BarsGenerator.update(myBars, selection, data);
                barrasNumeros.text(function (d) {
                  return formatData(d[selection],formatNumber[selection]);
                });
            });

        });
