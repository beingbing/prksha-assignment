
var app = angular.module("chatRoom", ['LocalStorageModule']);

app.config(function (localStorageServiceProvider) {
    localStorageServiceProvider
    .setStorageType('localStorage');
});

app.factory('socket', function ($rootScope) {
    var socket = io(); //default connection to the server that deploys the site
    return {
        on: function (eventName, callback) {
            socket.on(eventName, function () {
                var args = arguments;
                $rootScope.$apply(function () {   //manually perform dirty checks
                    callback.apply(socket, args);
                });
            });
        },
        emit: function (eventName, data, callback) {
            socket.emit(eventName, data, function () {
                var args = arguments;
                $rootScope.$apply(function () {
                    if (callback) {
                        callback.apply(socket, args);
                    }
                });
            });
        }
    };
});

app.factory('randomColor', function ($rootScope) {
    return {
        newColor: function () {
            return '#' + ('00000' + (Math.random() * 0x1000000 << 0).toString(16)).slice(-6);
        }
    };
});

app.factory('userService', function ($rootScope, $window, localStorageService) {
    return {
        get: function (users, nickname) {
            if (users instanceof Array) {
                localStorageService.set('users', users);
                for (var i = 0; i < users.length; i++) {
                    if (users[i].nickname === nickname) {
                        return users[i];
                    }
                }
            } else {
                return null;
            }
        }
    };
});

app.controller("chatCtrl", ['$scope', 'socket', 'randomColor', 'userService', 'localStorageService', function ($scope, socket, randomColor, userService, localStorageService) {
    var messageWrapper = $('.message-wrapper');
    $scope.hasLogined = false;

    var oldUsers = localStorageService.get('users');

    if (oldUsers && oldUsers.length > 0) {
        var newArray = oldUsers.filter(function (value) {
            return Object.keys(value).length !== 0;
        });
        console.log('oldUsers', oldUsers);
        console.log('newArray', newArray);
        newArray.forEach(element => {
            if (element && element.nickname && element.nickname !== "") {
                socket.emit("addUser", { nickname: element.nickname, color: element.color });
            }
        });
        $scope.hasLogined = true;
        socket.emit("addUser", { nickname: $scope.nickname, color: $scope.color });
    }

    $scope.receiver = "";//the default is group chat
    $scope.publicMessages = [];//group chat message
    $scope.privateMessages = {};//private message
    $scope.messages = $scope.publicMessages;//show group chat by default
    $scope.users = [];//
    $scope.color = randomColor.newColor();//current user avatar color
    $scope.login = function () {   //log in to chat room
        socket.emit("addUser", { nickname: $scope.nickname, color: $scope.color });
    }
    $scope.scrollToBottom = function () {
        messageWrapper.scrollTop(messageWrapper[0].scrollHeight);
    }

    $scope.postMessage = function () {
        var msg = { text: $scope.words, type: "normal", color: $scope.color, from: $scope.nickname, to: $scope.receiver };
        var rec = $scope.receiver;
        if (rec) {  //personal communication
            if (!$scope.privateMessages[rec]) {
                $scope.privateMessages[rec] = [];
            }
            $scope.privateMessages[rec].push(msg);
        } else { //group chat
            $scope.publicMessages.push(msg);
        }
        $scope.words = "";
        if (rec !== $scope.nickname) { //exclude the situation: send to yourself
            socket.emit("addMessage", msg);
        }
    }
    $scope.setReceiver = function (receiver) {
        $scope.receiver = receiver;
        if (receiver) { //private message receiver
            if (!$scope.privateMessages[receiver]) {
                $scope.privateMessages[receiver] = [];
            }
            $scope.messages = $scope.privateMessages[receiver];
        } else {//broadcast
            $scope.messages = $scope.publicMessages;
        }
        var user = userService.get($scope.users, receiver);
        if (user) {
            user.hasNewMessage = false;
        }
    }

    //received login
    socket.on('userAddingResult', function (data) {
        if (data.result) {
            $scope.userExisted = false;
            $scope.hasLogined = true;
        } else {//nickname is occupied
            $scope.userExisted = true;
        }
    });

    //new user added
    socket.on('userAdded', function (data) {
        if (!$scope.hasLogined) return;
        $scope.publicMessages.push({ text: data.nickname, type: "welcome" });
        $scope.users.push(data);
    });

    //received online user message
    socket.on('allUser', function (data) {
        if (!$scope.hasLogined) return;
        $scope.users = data;
    });

    //received user exit message
    socket.on('userRemoved', function (data) {
        if (!$scope.hasLogined) return;
        $scope.publicMessages.push({ text: data.nickname, type: "bye" });
        for (var i = 0; i < $scope.users.length; i++) {
            if ($scope.users[i].nickname == data.nickname) {
                $scope.users.splice(i, 1);
                return;
            }
        }
    });

    //received new message
    socket.on('messageAdded', function (data) {
        if (!$scope.hasLogined) return;
        if (data.to) { //personal communication
            if (!$scope.privateMessages[data.from]) {
                $scope.privateMessages[data.from] = [];
            }
            $scope.privateMessages[data.from].push(data);
        } else {
            $scope.publicMessages.push(data);
        }
        var fromUser = userService.get($scope.users, data.from);
        var toUser = userService.get($scope.users, data.to);
        if ($scope.receiver !== data.to) {//prompt for new messages when the party is not chatting
            if (fromUser && toUser.nickname) {
                fromUser.hasNewMessage = true;//personal communication
            } else {
                toUser.hasNewMessage = true;
            }
        }
    });



}]);

app.directive('message', ['$timeout', function ($timeout) {
    return {
        restrict: 'E',
        templateUrl: 'message.html',
        scope: {
            info: "=",
            self: "=",
            scrolltothis: "&"
        },
        link: function (scope, elem, attrs) {
            scope.time = new Date();
            $timeout(scope.scrolltothis);
            $timeout(function () {
                elem.find('.avatar').css('background', scope.info.color);
            });
        }
    };
}])
    .directive('user', ['$timeout', function ($timeout) {
        return {
            restrict: 'E',
            templateUrl: 'user.html',
            scope: {
                info: "=",
                iscurrentreceiver: "=",
                setreceiver: "&"
            },
            link: function (scope, elem, attrs, chatCtrl) {
                $timeout(function () {
                    elem.find('.avatar').css('background', scope.info.color);
                });
            }
        };
    }]);
