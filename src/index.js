angular.module('WebsocketPoc', ['qaCampus2015WebUi'])
    .controller('MainController', [
        '$scope',
        'mandelbrotService',
        'defaultValuesService',
        'colorSchemeService',
        'PictureViewModel',
        function ($scope, mandelbrotService, defaultValuesService, colorSchemeService, PictureViewModel) {
            var callbacks = {
                onSetup: function (setup) {
                    $scope.pictureViewModel.init({
                        iterations: $scope.input.iterations,
                        tileSize: setup.tileSize,
                        rowAndColumnCount: setup.rowAndColumnCount,
                        colorFunction: colorSchemeService.getFunctionFor('Mystic Blue')
                    });
                    $scope.$digest();
                },
                onMessage: function (message) {
                    $scope.pictureViewModel.onTileResult(message.row, message.column, message.data);
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

            $scope.input = defaultValuesService.getDefaultValues();
            $scope.input.width = 800;
            $scope.pictureViewModel = new PictureViewModel();

            function resetImage () {
                $scope.pictureViewModel = new PictureViewModel();
            }

            mandelbrotService.onSetup(callbacks.onSetup);
            mandelbrotService.onMessage(callbacks.onMessage);
            mandelbrotService.onClose(callbacks.onClose);
            mandelbrotService.onError(callbacks.onError);

            $scope.calculate = function () {
                resetImage();
                mandelbrotService.calculate($scope.input);
            };
        }]);
