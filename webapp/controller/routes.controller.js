sap.ui.define([
	"com/epam/uiorders/controller/base.controller",
	'sap/m/Text',
	"com/epam/uiorders/model/models"
], function (BaseController, Text, Models) {
	"use strict";
	var STATUSES_MAPPING = {
		I: "rgb(240,255,0)",
		D: "rgb(0,255,0)",
		P: "rgb(152,152,152)"
	};

	var MODELS = {
		"routesFiltersModel": Models.createRoutesFiltersModel(),
		"mapData": Models.createMapDataModel(),
		"technicalModel": Models.createEmptyJSONModel()
	};
	MODELS.technicalModel.setProperty("/lineWidth", 6);
	MODELS.technicalModel.setProperty("/selectionEnabled", false);
	MODELS.technicalModel.setProperty("/legendVisible", false);

	return BaseController.extend("com.epam.uiorders.controller.routes", {
		onInit: function () {
			this.MODELS = MODELS;
			var component = this.getOwnerComponent();
			var i18n = component.getModel("i18n");
			MODELS.technicalModel.setProperty("/legend", [{
				color: "rgb(0,255,0)",
				state: "Success",
				description: i18n.getProperty("order.status.D")
			},{
				color: "rgb(240,255,0)",
				state: "Warning",
				description: i18n.getProperty("order.status.I")
			}, {
				color: "rgb(152,152,152)",
				state: "Inactive",
				description: i18n.getProperty("order.status.P")
			}]);
			BaseController.prototype.onInit.apply(this, arguments);
			this._mapDataLoadingTask = this.createPeriodicalyTask(function () {
				$.ajax({
					type: "GET",
					url: "/services/getOrders.xsjs",
					async: true,
					success: function (data, textStatus, jqXHR) {
						data.results.forEach(function (order, i) {
							order.index = i + 1;
							order.color = STATUSES_MAPPING[order.status];
						});
						MODELS.mapData.setData(data);
					},
					error: function (data, textStatus, jqXHR) {
						console.log("error to post " + textStatus, jqXHR, data);
					}
				});
			}, 20000);
		},

		onExit: function () {
			this._mapDataLoadingTask.stop();
		},

		onAfterRendering: function () {
			this._mapDataLoadingTask.start();
		},

		onClickRoute: function (evt) {
			var context = evt.getSource().getBindingContext("mapData");
			var order = context.getProperty();
			var fgetService = sap.ushell && sap.ushell.Container && sap.ushell.Container.getService;
			var oCrossAppNavigator = fgetService && fgetService("CrossApplicationNavigation");
			oCrossAppNavigator.toExternal({
				target: {
					semanticObject: "uiordersdetails",
					action: "Display"
				},
				params: {
					"orderId": order.id
				}
			});
		},

		onLegendItemClick: function (evt) {
			var context = evt.getSource().getBindingContext("mapData");
			var data = context.getProperty();
			var colorPath = context.getPath() + "/color";
			var color = data.color;
			var colorHighlighter = function (counter, enableHighlighting) {
				if (counter < 6) {
					setTimeout(function () {
						if (enableHighlighting) {
							context.getModel().setProperty(colorPath, "RGB(51;255;255)");
						} else {
							context.getModel().setProperty(colorPath, color);
						}
						counter++;
						colorHighlighter(counter, !enableHighlighting);
					}, 600);
				}
			};
			colorHighlighter(0, true);
		},

		onFiltersChanged: function (evt) {
			var oMap = this.getMapControl();
			var oMapLegend = this.getMapLegend();
			var binding = oMap.getBinding("vos");
			var key = evt.getParameters().selectedItem.getKey();
			var filters = [];
			if (key === "All") {
				filters = [
					new sap.ui.model.Filter("status", sap.ui.model.FilterOperator.EQ, "I"),
					new sap.ui.model.Filter("status", sap.ui.model.FilterOperator.EQ, "D"),
					new sap.ui.model.Filter("status", sap.ui.model.FilterOperator.EQ, "P")
				];
			} else {
				filters = [
					new sap.ui.model.Filter("status", sap.ui.model.FilterOperator.EQ, key)
				];
			}
			binding.filter([new sap.ui.model.Filter({
				filters: filters,
				and: false
			})]);
			oMapLegend.getBinding("items").filter([new sap.ui.model.Filter({
				filters: filters,
				and: false
			})]);
		},

		onZoomChanged: function (evt) {
			BaseController.prototype.onZoomChanged.apply(this, arguments);
			var zoomLevel = parseInt(evt.getParameter("zoomLevel"));
			zoomLevel = zoomLevel > 15 ? zoomLevel : zoomLevel - 6
			MODELS.technicalModel.setProperty("/lineWidth", zoomLevel);
		},

		vosFactoryFunction: function (sId, oContext) {
			var currentObject = oContext.getProperty();
			var routes = new sap.ui.vbm.Routes({
				items: [new sap.ui.vbm.Route({
					colorBorder: "rgb(255,255,255)",
					linewidth: "{= ${mapData>lineWidth} !== undefined ? ${mapData>lineWidth} : ${technicalModel>/lineWidth}}",
					position: "{mapData>coordinates}",
					tooltip: "{= ${i18n>order.title} + ' ' + ${mapData>id} + ': ' + ${mapData>description} }",
					end: "0",
					start: "0",
					color: "{mapData>color}",
					click: [this.onClickRoute, this]
				})]
			});
			return routes;
		},

		// legendFactoryFunction: function (sId, oContext) {
		// 	var currentObject = oContext.getProperty();
		// 	var that = this;
		// 	var item = new sap.ui.vbm.LegendItem(sId, {
		// 		text: "{= ${i18n>order.title} + ' ' + ${mapData>id} + ': ' + ${mapData>description} }",
		// 		color: "{mapData>color}",
		// 		click: [this.onLegendItemClick, this]
		// 	});

		// 	return item;
		// },
		
		legendFactoryFunction: function (sId, oContext) {
			return new sap.ui.vbm.LegendItem(sId, {
				text: "{technicalModel>description}",
				color: "{technicalModel>color}"
			});
		},

		onVosElementsSelect: function (evt) {
			var selected = evt.getParameter("selected");
			var ids = selected.map(function (route) {
				var context = route.getBindingContext("mapData");
				return context.getProperty("id");
			});
			console.log(ids);
			var fgetService = sap.ushell && sap.ushell.Container && sap.ushell.Container.getService;
			var oCrossAppNavigator = fgetService && fgetService("CrossApplicationNavigation");
			oCrossAppNavigator.toExternal({
				target: {
					semanticObject: "uiordersdetails",
					action: "Display"
				},
				params: {
					"orderId": ids
				}
			});
		}
	});
});