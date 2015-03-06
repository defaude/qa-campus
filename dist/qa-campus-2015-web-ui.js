(function () {

    'use strict';

    angular.module('qaCampus', ['ngLodash'])

        .directive('qaCanvas', function () {
            function getBase (x, y, width) {
                return y * width * 4 + x * 4;
            }

            function linkFn ($scope, $element) {
                var domElement = $element[0];
                var ctx = domElement.getContext('2d');
                var width = domElement.width;
                var height = domElement.height;

                // copy the now-empty image data into a new one that we can use to reset the image.
                var blankData = ctx.getImageData(0, 0, width, height).data;

                // watch for changes and update the canvas accordingly
                $scope.$watchCollection('pixels', function (pixels) {
                    var imgData = ctx.getImageData(0, 0, width, height);

                    // reset all pixels
                    imgData.data.set(blankData);

                    if (!pixels) {
                        return;
                    }

                    // set only the ones in the given array
                    pixels.forEach(function (pixel) {
                        var i = getBase(pixel.x, pixel.y, imgData.width);
                        imgData.data[i] = pixel.r;
                        imgData.data[i + 1] = pixel.g;
                        imgData.data[i + 2] = pixel.b;
                        imgData.data[i + 3] = 255; // alpha channel
                    });

                    // pump imgData back to the canvas
                    ctx.putImageData(imgData, 0, 0);
                });
            }

            return {
                restrict: 'E',
                replace: true,
                scope: { pixels: '=', width: '@', height: '@' },
                template: '<canvas width="{{width}}" height="{{height}}"></canvas>',
                link: linkFn
            };
        })

        .factory('MandelbrotService', ['lodash', function (_) {
            /**
             * Translates a simple param object into a query-string-like representation.
             *
             * Does not work with multi-value parameters, though! :)
             */
            function getQueryParams (params) {
                return _.map(params, function (value, key) {
                    return key + '=' + encodeURIComponent(value);
                }).join('&');
            }

            var callback_keys = ['onSetup', 'onMessage', 'onClose', 'onError'];
            var param_keys = ['width', 'pR', 'pI', 'extent', 'iterations'];
            var callback_defaults = {
                onSetup: _.noop,
                onMessage: _.noop,
                onClose: _.noop,
                onError: _.noop
            };

            /**
             * Creates a new MandelbrotService instance.
             *
             * @param {String} socketUrl URL of the WebSocket to connect to.
             * @param {Object} callbacks Object containing onSetup, onMessage, onClose and onError (all optional, though).
             * @param {boolean} connectionLogging Set this to true if you want "debug" messages about the connection.
             */
            function MandelbrotService (socketUrl, callbacks, connectionLogging) {
                var socket = null;

                function log (msg) {
                    if (connectionLogging) {
                        console.info(msg);
                    }
                }

                // callbacks are somewhat optional
                callbacks = _.defaults(_.pick(callbacks, callback_keys), callback_defaults);

                this.startNewCalculation = function (params) {
                    if (socket) {
                        log('closing previous socket.');
                        socket.close();
                    }

                    params = _.pick(params, param_keys);
                    log('opening socket...');

                    // open the connection
                    socket = new WebSocket(socketUrl + '?' + getQueryParams(params));

                    socket.onopen = function () {
                        log('socket open.');
                    };

                    /**
                     * Called when a message arrived from the endpoint.
                     */
                    socket.onmessage = function (event) {
                        // onMessage => splitten nach setup und message
                        var data;
                        try {
                            data = JSON.parse(event.data);
                        } catch (e) {
                            console.error('unintelligible message received', event.data);
                            return;
                        }

                        if (data.hasOwnProperty('rowAndColumnCount')) {
                            callbacks.onSetup(data);
                        } else {
                            callbacks.onMessage(data);
                        }
                    };

                    /**
                     * Called when the socket closes (either expected or unexpected).
                     */
                    socket.onclose = function (event) {
                        var CLOSE_NORMAL = 1000;
                        socket = null;

                        if (event.wasClean || event.code === CLOSE_NORMAL) {
                            log('socket was closed cleanly.');
                            callbacks.onClose();

                        } else {
                            console.error('socket was closed unexpectedly.', event.reason, '(' + event.code + ')');
                            callbacks.onError(event.reason);
                        }
                    };
                };
            }

            return MandelbrotService;
        }]);

}());
