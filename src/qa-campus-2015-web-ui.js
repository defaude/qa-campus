(function () {

    'use strict';

    var module = angular.module('qaCampus2015WebUi', ['ngLodash']);

    /**
     * Factory that creates the TileViewModel constructor.
     */
    module.factory('TileViewModel', function () {
        /**
         * The constructor (object definition) for a single tile.
         *
         * The tile can be bound to an angular scope. It does not contain the raw pixel data itself.
         *
         * @param colorFunction   function that is used to create the pixel's color
         * @param maxIterations   number of max iterations of the calculation
         * @param tileSize        the widht and height for this tile in pixels
         * @constructor
         */
        function TileViewModel (colorFunction, maxIterations, tileSize) {
            this.colorFunction = colorFunction;
            this.maxIterations = maxIterations;
            this.tileSize = tileSize;

            var updateListener = [];

            /**
             * Register and update listener.
             *
             * A listener has to have two methods onDataUpdate(data) and onSettingsUpdate().
             *
             * @param listener listener that gets inform on state changes
             */
            this.registerListener = function (listener) {
                updateListener.push(listener);
            };

            /**
             * Removes the given listener
             *
             * @param listener  listener that should no longer be informed
             */
            this.removeListener = function (listener) {
                var index = updateListener.indexOf(listener);
                if (index > -1) {
                    updateListener.splice(index, 1);
                }
            };

            /**
             * Updates the tile data (by informing all registered listeners)
             *
             * @param data  the pixel data
             */
            this.update = function (data) {
                for (var i = 0; i < updateListener.length; i++) {
                    updateListener[i].onDataUpdate(data);
                }
            };

            /**
             * @param colorFunction
             */
            this.setColorFunction = function (colorFunction) {
                this.colorFunction = colorFunction;
                for (var i = 0; i < updateListener.length; i++) {
                    updateListener[i].onSettingsUpdate();
                }
            };
        }

        return TileViewModel;
    });

    /**
     * This directive renders one single tile using a &lt;canvas&gt;.
     *
     * It needs an instance of TileViewModel provided in its view-model attribute.
     */
    module.directive('tile', function () {
        function getBase (x, y, width) { return y * width * 4 + x * 4; }

        // Used to create a pixel from plain data, as the canvas needs pixels
        function toPixel (value, index, colorize, maxIterations, tileSize) {
            var colors = colorize(value, maxIterations);

            return {
                r: colors.r,
                g: colors.g,
                b: colors.b,
                x: index % tileSize,
                y: (index - index % tileSize) / tileSize
            };
        }

        function linkFn ($scope, $element) {
            var domElement = $element[0];
            var ctx = domElement.getContext('2d');
            var width = domElement.width;
            var height = domElement.height;

            // for performance reasons we store the plain data outside of the scope
            var plainData;

            // copy the now-empty image data into a new one that we can use to reset the image.
            var blankData = ctx.getImageData(0, 0, width, height).data;

            function updateCanvas (plainData, colorFunction, maxIterations, tileSize) {
                var colorizedData = plainData.map(function (value, index) {
                    return toPixel(value, index, colorFunction, maxIterations, tileSize);
                });

                var imgData = ctx.getImageData(0, 0, width, height);

                // reset all pixels
                imgData.data.set(blankData);

                if (!colorizedData) {
                    return;
                }

                // set only the ones in the given array
                colorizedData.forEach(function (pixel) {
                    var i = getBase(pixel.x, pixel.y, imgData.width);
                    imgData.data[i] = pixel.r;
                    imgData.data[i + 1] = pixel.g;
                    imgData.data[i + 2] = pixel.b;
                    imgData.data[i + 3] = 255; // alpha channel
                });

                // pump imgData back to the canvas
                ctx.putImageData(imgData, 0, 0);
            }

            // create a listener object that updates the plainData and canvas
            var listener = {
                onDataUpdate: function (data) {
                    plainData = data;
                    updateCanvas(plainData, $scope.viewModel.colorFunction, $scope.viewModel.maxIterations, $scope.viewModel.tileSize);
                },
                onSettingsUpdate: function () {
                    updateCanvas(plainData, $scope.viewModel.colorFunction, $scope.viewModel.maxIterations, $scope.viewModel.tileSize);
                }
            };

            // watch for changes and update the canvas accordingly
            $scope.viewModel.registerListener(listener);

            $scope.$on('$destroy', function () {
                $scope.viewModel.removeListener(listener);
            });
        }

        return {
            restrict: 'E',
            replace: true,
            scope: { viewModel: '=' },
            template: '<canvas width="{{viewModel.tileSize}}" height="{{viewModel.tileSize}}"></canvas>',
            link: linkFn
        };
    });

    /**
     * Factory that creates the PictureViewModel constructor.
     */
    module.factory('PictureViewModel', ['TileViewModel', 'lodash', function (TileViewModel, _) {

        var defaults = {
            iterations: 0,
            tileSize: 0,
            rowAndColumnCount: 0,
            colorFunction: _.noop,
            xOffset: 0,
            yOffset: 0
        };

        function reset (instance, input) {
            _.assign(instance, defaults, input);
            instance.canvasArray = [];
        }

        /**
         * The constructor (object definition) for the view model of the picture.
         *
         * Use this object as "backing bean" for the result rendering.
         * @constructor
         */
        function PictureViewModel () {
            reset(this);
            /**
             * Initialize the model with the given values.
             */
            this.init = function (input) {
                reset(this, input);

                for (var i = 0; i < this.rowAndColumnCount; ++i) {
                    this.canvasArray[i] = new Array(this.rowAndColumnCount);
                    for (var j = 0; j < this.rowAndColumnCount; ++j) {
                        this.canvasArray[i][j] = new TileViewModel(this.colorFunction, this.iterations, this.tileSize);
                    }
                }
            };

            this.setColorFunction = function (colorFunction) {
                for (var i = 0; i < this.rowAndColumnCount; ++i) {
                    for (var j = 0; j < this.rowAndColumnCount; ++j) {
                        this.canvasArray[i][j].setColorFunction(colorFunction);
                    }
                }
            };

            this.onTileResult = function (row, col, data) {
                this.canvasArray[row][col].update(data);
            };

            this.getTileSize = function () {
                return this.tileSize;
            };

            this.getRowAndColumnCount = function () {
                return this.rowAndColumnCount;
            };
        }

        return PictureViewModel;
    }]);

    /**
     * This directive renders a tiled picture.
     *
     * It needs an instance of PictureViewModel provided in its view-model attribute.
     */
    module.directive('picture', function () {
        function makeRelativePointFromClickEvent (element, clickEvent) {
            var offset = $(element).offset();
            var x = Math.floor(clickEvent.pageX - offset.left);
            var y = Math.floor(clickEvent.pageY - offset.top);
            return { x: x, y: y };
        }

        function linkFn (scope, $element) {
            if (scope.onRightClick) {
                // Right-Click-Listener
                $element.on("contextmenu", function (e) {
                    var clickedPoint = makeRelativePointFromClickEvent(this, e);
                    scope.onRightClick(clickedPoint);
                    return false;
                });
            }

            if (scope.onLeftClick) {
                // Left-Click-Listener
                $element.on("click", function (e) {
                    var clickedPoint = makeRelativePointFromClickEvent(this, e);
                    scope.onLeftClick(clickedPoint);
                });
            }

            // returns the translation defined by the offset
            scope.getTranslation = function () {
                return 'translate(' + (scope.viewModel.xOffset || 0) + 'px,' + (scope.viewModel.yOffset || 0) + 'px)';
            };

            scope.getActualSize = function () {
                return scope.viewModel.getRowAndColumnCount() * scope.viewModel.getTileSize();
            };
        }

        return {
            restrict: 'E',
            replace: true,
            scope: {
                viewModel: '=',
                onLeftClick: '=',
                onRightClick: '='
            },
            template: [
                '<div class="canvas-table" data-ng-style="{ width: getActualSize(), height: getActualSize(), transform: getTranslation() }">',
                '  <div class="tile-row" data-ng-repeat="row in viewModel.canvasArray">',
                '    <tile class="tile-cell" data-ng-repeat="col in row" view-model="col"></tile>',
                '  </div>',
                '</div>'
            ].join(''),
            link: linkFn
        };
    });

    /**
     * This provides the colorSchemeService instance.
     */
    module.service('colorSchemeService', ['lodash', function (_) {
        function Color (r, g, b) {
            this.r = r;
            this.g = g;
            this.b = b;
        }

        function Scheme (name, fn) {
            this.name = name;
            this.fn = fn;
        }

        var schemes = [
            new Scheme('Contrast Black',
                function (value) {
                    var r, g, b;
                    if (value >= 1) {
                        r = b = g = 255;
                    } else {
                        r = b = g = 0;
                    }
                    return new Color(r, g, b);
                }
            ),
            new Scheme('Contrast White',
                function (value) {
                    var r, g, b;
                    if (value >= 1) {
                        r = b = g = 0;
                    } else {
                        r = b = g = 255;
                    }

                    return new Color(r, g, b);
                }
            ),
            new Scheme('Frosty',
                function (value) {
                    var r = (value >> 16) & 0xFF;
                    var g = (value >> 8) & 0xFF;
                    var b = (value & 0xFF) + 80;

                    return new Color(r, g, b);
                }
            ),
            new Scheme('Funky',
                function (value, maxIterations) {
                    var newValue = value / maxIterations * 16581375;

                    var r = (newValue >> 16) & 0xFF;
                    var g = (newValue >> 8) & 0xFF;
                    var b = newValue & 0xFF;

                    return new Color(r, g, b);
                }
            ),
            new Scheme('Egg-White',
                function (value) {
                    var newValue = value / 30000 * 16581375;

                    var r = (newValue >> 16) & 0xFF;
                    var g = (newValue >> 8) & 0xFF;
                    var b = newValue & 0xFF;

                    return new Color(r, g, b);
                }
            ),
            new Scheme('Burning',
                function (value, maxIterations) {
                    var r, g, b;
                    if (value >= maxIterations) {
                        r = b = g = 0;

                    } else {
                        // fancy-pants color magic here that I found in the interwebs.
                        var c = 3 * Math.log(value) / Math.log(maxIterations - 1);
                        var cr, cg, cb;

                        if (c < 1) {
                            cr = c;
                            cg = cb = 0;
                        } else if (c < 2) {
                            cr = 1;
                            cg = c - 1;
                            cb = 0;
                        } else {
                            cr = cg = 1;
                            cb = c - 2;
                        }

                        r = 255 * cr;
                        g = 255 * cg;
                        b = 255 * cb;
                    }
                    return new Color(r, g, b);
                }
            ),
            new Scheme('Black and White',
                function (value) {
                    var r, g, b;
                    if (value % 2 === 0) {
                        r = b = g = 255;
                    } else {
                        r = b = g = 0;
                    }
                    return new Color(r, g, b);
                }
            ),
            new Scheme('Mystic Blue',
                function (value, maxIterations) {
                    var percent = value / maxIterations;
                    return new Color(0, 0, percent * 255);
                }
            )
        ];

        return {
            getSchemes: function () {
                return schemes;
            },
            getFunctionFor: function (schemeName) {
                var scheme = _.find(schemes, { 'name': schemeName });

                return scheme ? scheme.fn : schemes[0].fn;
            }
        };
    }]);

    module.service('defaultValuesService', function () {
        /**
         * Default values for the calculation.
         */
        this.getDefaultValues = function () {
            return {
                pR: -2.2,
                pI: -1.4,
                extent: 2.8,
                iterations: 100,
                width: 600
            };
        };
    });

    module.service('mandelbrotService', ['lodash', function (_) {
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

        function log (msg) {
            if (loggingActive) { console.info(msg); }
        }

        var backendUrl = 'ws://localhost:8080/mandelbrot';
        var loggingActive = false;
        var callbacks = {
            onSetup: _.noop,
            onMessage: _.noop,
            onClose: _.noop,
            onError: _.noop
        };

        var socket = null;

        var param_keys = ['width', 'pR', 'pI', 'extent', 'iterations'];

        this.setBackendUrl = function (url) { backendUrl = url; };

        this.activateLogging = function () { loggingActive = true; };

        this.deactivateLogging = function () { loggingActive = false; };

        this.onSetup = function (fn) { callbacks.onSetup = fn; };

        this.onMessage = function (fn) { callbacks.onMessage = fn; };

        this.onClose = function (fn) { callbacks.onClose = fn; };

        this.onError = function (fn) { callbacks.onError = fn; };

        this.calculate = function (input) {
            if (socket) {
                log('closing previous socket.');
                socket.close();
            }

            var params = _.pick(input, param_keys);

            // open the connection
            log('opening socket...');
            socket = new WebSocket(backendUrl + '?' + getQueryParams(params));

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
    }]);

}());
