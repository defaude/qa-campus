angular.module('qaCampus').controller('TestController', [
    '$scope',
    'lodash',
    function ($scope, _) {

        $scope.tileSize = 100;

        $scope.thePixels = [];

        $scope.doStuff = function () {
            var newPixels = [];
            _.times(10000, function (i) {
                var row = Math.floor(i / 100);
                var col = i % 100;

                newPixels.push({
                    x: col, y: row,
                    r: (col / 100) * 255,
                    g: (row / 100) * 255,
                    b: ((100 - col) / 100) * 255
                });

                $scope.thePixels = newPixels;
            });
        };

    }]);