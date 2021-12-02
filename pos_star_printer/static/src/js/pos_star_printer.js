odoo.define('pos_star_printer.pos_star_printer', function (require) {
"use strict";

var models = require('point_of_sale.models');
var StarPrinter = require('pos_star_printer.Printer');

var posmodel_super = models.PosModel.prototype;
models.PosModel = models.PosModel.extend({
    after_load_server_data: function () {
        var self = this;
        return posmodel_super.after_load_server_data.apply(this, arguments).then(function () {
            if (self.config.other_devices && self.config.star_printer_ip) {
                self.proxy.printer = new StarPrinter(self.config.star_printer_ip , self);
            }
        });
    },
});

});
