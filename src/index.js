angular.module('WebsocketPoc', ['qaCampus'])
    .controller('MainController', ['$scope', 'MandelbrotService', function ($scope, MandelbrotService) {

        // array of rows
        // each row is an array of tiles.
        // each tile is like this: {
        //    pixels: an array containing objects with r, g, b, x and y values
        // }
        $scope.rows = [];

        // parameters for the mandelbrot calculation call
        $scope.pR = 0;
        $scope.pI = 0;
        $scope.extent = 2;
        $scope.iterations = 100;

        // flag that can be used to hide / show the picture area
        $scope.showTiles = false;

        var url = 'ws://localhost:8080/mandelbrot-server-1.0-SNAPSHOT/mandelbrot';
        var desiredImageWidth = 500; // hard-coded for now
        var rowAndColumnCount = 0;
        var xOffset = 0;
        var yOffset = 0;
        var tileSize = 0;

        this.desiredImageWidth = function () { return desiredImageWidth };
        this.xOffset = function () { return xOffset; };
        this.yOffset = function () { return yOffset; };
        this.tileSize = function () { return tileSize; };
        this.pictureDimension = function () { return rowAndColumnCount * tileSize + 'px'; };

        var callbacks = {
            onSetup: function (setup) {
                rowAndColumnCount = setup.rowAndColumnCount;

                $scope.rows = new Array(rowAndColumnCount);
                for (var i = 0; i < rowAndColumnCount; ++i) {
                    $scope.rows[i] = new Array(rowAndColumnCount);
                    for (var j = 0; j < rowAndColumnCount; ++j) {
                        $scope.rows[i][j] = [];
                    }
                }

                tileSize = setup.tileSize;
                xOffset = setup.xOffset;
                yOffset = setup.yOffset;
                $scope.showTiles = true;
                $scope.$digest();
            },
            onMessage: function (message) {
                $scope.rows[message.row][message.column] = message.data.map(toPixel);
                $scope.$digest();
            },
            onClose: function () {
                console.info('done');
            },
            onError: function (error) {
                resetImage();
                alert(error);
                $scope.$digest();
            }
        };

        $scope.service = new MandelbrotService(url, callbacks);

        function toPixel (value, index) {
            var r, g, b;

            if (value >= $scope.iterations) {
                r = b = g = 0;

            } else {
                // fancy-pants color magic here that I found in the interwebs.
                var c = 3 * Math.log(value) / Math.log($scope.iterations - 1);
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

            return {
                r: r, g: g, b: b,
                x: index % tileSize,
                y: (index - index % tileSize) / tileSize
            };
        }

        $scope.calculate = function () {
            resetImage();

            $scope.service.startNewCalculation({
                width: desiredImageWidth,
                pR: $scope.pR,
                pI: $scope.pI,
                extent: $scope.extent,
                iterations: $scope.iterations
            });
        };

        function resetImage () {
            $scope.rows = [];
            rowAndColumnCount = 0;
            tileSize = 0;
            xOffset = 0;
            yOffset = 0;
        }

    }]);