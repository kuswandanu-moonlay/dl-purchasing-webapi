var Router = require('restify-router').Router;
var router = new Router();
var db = require("../../../db");
var ObjectId = require("mongodb").ObjectId;
var UnitReceiptNoteManager = require("dl-module").managers.purchasing.UnitReceiptNoteManager;
var resultFormatter = require("../../../result-formatter");
var passport = require('../../../passports/jwt-passport');
const apiVersion = '1.0.0';

router.get('/', passport, (request, response, next) => {
    db.get().then(db => {
        var manager = new UnitReceiptNoteManager(db, request.user);

        var no = request.params.no;
        var supplierId = request.params.supplierId;
        var categoryId = request.params.categoryId;
        var unitId = request.params.unitId;
        var dateFrom = request.params.dateFrom;
        var dateTo = request.params.dateTo;

        manager.getUnitReceiptNotes(no, unitId, categoryId, supplierId, dateFrom, dateTo)
            .then(docs => {
                var dateFormat = "DD MMM YYYY";
                    var locale = 'id-ID';
                    var moment = require('moment');
                    moment.locale(locale);
                    
                    var data = [];
                    var index = 0;
                    for (var unitReceiptNote of docs) {
                        for (var item of unitReceiptNote.items) {
                            var sisa = 0;
                            for(var poItem of item.purchaseOrder.items){
                                var productIdPoItem = new ObjectId(poItem.product._id);
                                var productIdUnitReceiptNoteItem = new ObjectId(item.product._id);
                                if (productIdPoItem.equals(productIdUnitReceiptNoteItem)) {
                                    for (var poItemFulfillment of poItem.fulfillments) {
                                        var qty = poItemFulfillment.unitReceiptNoteDeliveredQuantity || 0;
                                        sisa += qty;
                                    }
                                    break;
                                }
                            }
                            
                            index++;
                            var _item = {
                                "No": index,
                                "Unit": `${item.purchaseOrder.unit.division} - ${item.purchaseOrder.unit.subDivision}`,
                                "Kategori": item.purchaseOrder.category.name,
                                "No PO Internal": item.purchaseOrder.refNo || "-",
                                "Nama Barang": item.product.name,
                                "Kode Barang": item.product.code,
                                "Supplier": unitReceiptNote.supplier.name,
                                "Tanggal Bon Terima Unit": moment(new Date(unitReceiptNote.date)).format(dateFormat),
                                "No Bon Terima Unit": unitReceiptNote.no,
                                "Jumlah Diminta": item.purchaseOrderQuantity,
                                "Satuan Diminta": item.deliveredUom.unit,
                                "Jumlah Diterima": item.deliveredQuantity,
                                "Satuan Diterima": item.deliveredUom.unit,
                                "Jumlah (+/-/0)": (item.purchaseOrderQuantity || 0) - sisa
                            }
                            data.push(_item);
                        }
                    }
                    
                if ((request.headers.accept || '').toString().indexOf("application/xls") < 0) {
                    var result = resultFormatter.ok(apiVersion, 200, data);
                    response.send(200, result);
                }
                else {
                    var options = {
                        "No": "number",
                        "Unit": "string",
                        "Kategori": "string",
                        "No PO Internal": "string",
                        "Nama Barang": "string",
                        "Kode Barang": "string",
                        "Supplier": "string",
                        "Tanggal Bon Terima Unit": "string",
                        "No Bon Terima Unit": "string",
                        "Jumlah Diminta": "number",
                        "Satuan Diminta": "string",
                        "Jumlah Diterima": "number",
                        "Satuan Diterima": "string",
                        "Jumlah (+/-/0)": "number"
                    };


                    response.xls(`Monitoring Bon Terima Unit - ${moment(new Date()).format(dateFormat)}.xlsx`, data, options);
                }
            })
            .catch(e => {
                var error = resultFormatter.fail(apiVersion, 400, e);
                response.send(400, error);
            })
    })
});

module.exports = router
