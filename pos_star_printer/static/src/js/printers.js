
odoo.define('pos_star_printer.Printer', function (require) {
"use strict";

var core = require('web.core');
var { PrinterMixin, PrintResult, PrintResultGenerator } = require('point_of_sale.Printer');

var QWeb = core.qweb;
var _t = core._t;

class StarPrintResultGenerator extends PrintResultGenerator {
    constructor(address) {
        super();
        this.address = address;
    }

    IoTActionError() {
        var printRes = new PrintResult({
            successful: false,
            message: {
                title: _t('Connection to the printer failed'),
                body: _t('Please check if the printer is still connected.'),
            }
        });

        if (window.location.protocol === 'https:') {
            printRes.message.body += _.str.sprintf(
                _t('If you are on a secure server (HTTPS) please make sure you manually accepted the certificate by accessing %s'),
                this.address
            );
        }

        return printRes;
    }

    IoTResultError() {
        return new PrintResult({
            successful: false,
            message: {
                title: _t('Printing failed'),
                body: _t('Please check if the printer has enough paper and is ready to print.'),
            },
        });
    }
}

var StarPrinter = core.Class.extend(PrinterMixin, {
    init(ip) {
        PrinterMixin.init.call(this, arguments);
        var url = window.location.protocol + '//' + ip;
        this.address = url + ':8001/StarWebPRNT/SendMessage';
        this.printResultGenerator = new StarPrintResultGenerator(url);
    },

     /**
     * Transform a (potentially colored) canvas into a monochrome raster image.
     * We will use Floyd-Steinberg dithering.
     */
    _canvasToRaster(canvas) {
        var imageData = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height);
        var pixels = imageData.data;
        var width = imageData.width;
        var height = imageData.height;
        var errors = Array.from(Array(width), _ => Array(height).fill(0));
        var rasterData = new Array(width * height).fill(0);

        for (var y = 0; y < height; y++) {
            for (var x = 0; x < width; x++) {
                var idx, oldColor, newColor;

                // Compute grayscale level. Those coefficients were found online
                // as R, G and B have different impacts on the darkness
                // perception (e.g. pure blue is darker than red or green).
                idx = (y * width + x) * 4;
                oldColor = pixels[idx] * 0.299 + pixels[idx+1] * 0.587 + pixels[idx+2] * 0.114;

                // Propagate the error from neighbor pixels
                oldColor += errors[x][y];
                oldColor = Math.min(255, Math.max(0, oldColor));

                if (oldColor < 128) {
                    // This pixel should be black
                    newColor = 0;
                    rasterData[y * width + x] = 1;
                } else {
                    // This pixel should be white
                    newColor = 255;
                    rasterData[y * width + x] = 0;
                }

                // Propagate the error to the following pixels, based on
                // Floyd-Steinberg dithering.
                var error = oldColor - newColor;
                if (error) {
                    if (x < width - 1) {
                        // Pixel on the right
                        errors[x + 1][y] += 7/16 * error;
                    }
                    if (x > 0 && y < height - 1) {
                        // Pixel on the bottom left
                        errors[x - 1][y + 1] += 3/16 * error;
                    }
                    if (y < height - 1) {
                        // Pixel below
                        errors[x][y + 1] += 5/16 * error;
                    }
                    if (x < width - 1 && y < height - 1) {
                        // Pixel on the bottom right
                        errors[x + 1][y + 1] += 1/16 * error;
                    }
                }
            }
        }

        return rasterData.join('');
    },

    /**
     * Base 64 encode a raster image
     */
    _encodeRaster(rasterData) {
        var encodedData = '';
        for(var i = 0; i < rasterData.length; i+=8){
            var sub = rasterData.substr(i, 8);
            encodedData += String.fromCharCode(parseInt(sub, 2));
        }
        return btoa(encodedData);
    },

    /**
     * @override
     */
    htmlToImg: function (receipt) {
        receipt = receipt.replace('class="pos-receipt"', 'class="pos-receipt" style="width:390px"');
         var self = this;
        $('.pos-receipt-print').html(receipt);
        var promise = new Promise(function (resolve, reject) {
            self.receipt = $('.pos-receipt-print>.pos-receipt');
            html2canvas(self.receipt[0], {
                onparsed: function(queue) {
                    queue.stack.ctx.height = Math.ceil(self.receipt.outerHeight() + self.receipt.offset().top);
                },
                onrendered: function (canvas) {
                    $('.pos-receipt-print').empty();
                    resolve(self.process_canvas(canvas));
                },
                letterRendering: self.htmlToImgLetterRendering,
            })
        });
        return promise;
    },
     /**
     * @override
     */
    process_canvas(canvas) {
        var context = canvas.getContext('2d');

        var builder = new StarWebPrintBuilder();

        var request = '';

        request += builder.createInitializationElement();

        request += builder.createBitImageElement({context:context, x:0, y:0, width:canvas.width, height:canvas.height});

        request += builder.createCutPaperElement({feed:true});

        var rasterData = this._canvasToRaster(canvas);
        var encodedData = this._encodeRaster(rasterData);
//        return QWeb.render('starWebPrnt', {
//            image: encodedData,
//            width: canvas.width,
//            height: canvas.height,
//            request: request,
//        });

        return request;
    },

    /**
     * @override
     */
    open_cashbox() {
        var builder = new StarWebPrintBuilder();
        var request = builder.createPeripheralElement({channel:1, on:200, off:200});
        this.send_printing_job(request);
    },

    /**
     * @override
     */
//    async send_printing_job(img) {
//        const res = await $.ajax({
//            url: this.address,
//            method: 'POST',
//            data: img,
//        });
//        return $(res).find('response').attr('success') === 'true';
//    },

    /**
     * @override
     */
    async send_printing_job(img) {
        var trader = new StarWebPrintTrader({url:this.address, papertype:'normal'});

        trader.onReceive = function (response) {

            var msg = '- onReceive -\n\n';

            msg += 'TraderSuccess : [ ' + response.traderSuccess + ' ]\n';

    //      msg += 'TraderCode : [ ' + response.traderCode + ' ]\n';

            msg += 'TraderStatus : [ ' + response.traderStatus + ',\n';

            if (trader.isCoverOpen            ({traderStatus:response.traderStatus})) {msg += '\tCoverOpen,\n';}
            if (trader.isOffLine              ({traderStatus:response.traderStatus})) {msg += '\tOffLine,\n';}
            if (trader.isCompulsionSwitchClose({traderStatus:response.traderStatus})) {msg += '\tCompulsionSwitchClose,\n';}
            if (trader.isEtbCommandExecute    ({traderStatus:response.traderStatus})) {msg += '\tEtbCommandExecute,\n';}
            if (trader.isHighTemperatureStop  ({traderStatus:response.traderStatus})) {msg += '\tHighTemperatureStop,\n';}
            if (trader.isNonRecoverableError  ({traderStatus:response.traderStatus})) {msg += '\tNonRecoverableError,\n';}
            if (trader.isAutoCutterError      ({traderStatus:response.traderStatus})) {msg += '\tAutoCutterError,\n';}
            if (trader.isBlackMarkError       ({traderStatus:response.traderStatus})) {msg += '\tBlackMarkError,\n';}
            if (trader.isPaperEnd             ({traderStatus:response.traderStatus})) {msg += '\tPaperEnd,\n';}
            if (trader.isPaperNearEnd         ({traderStatus:response.traderStatus})) {msg += '\tPaperNearEnd,\n';}

            msg += '\tEtbCounter = ' + trader.extractionEtbCounter({traderStatus:response.traderStatus}).toString() + ' ]\n';
        }

        // throw exception for further handling
        trader.onError = function (response) {
            return false;
        }

        // send request to starWebPrnt
        trader.sendMessage({request:img});
        return true;
    },
});

return StarPrinter;

});
