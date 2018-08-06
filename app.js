var express = require('express');
var app = require('express')();
var http = require('http').createServer(app);
var io = require('socket.io')(http);

app.use(express.static(__dirname + '/public'));


app.get('/', function (req, res) {
    res.sendfile('index.html');
});

var connectedSockets={};
var allUsers=[{nickname:"",color:"#000"}];//the initial values of nickname
io.on('connection',function(socket){


    socket.on('addUser',function(data){ //new users enter the chatroom
        if(connectedSockets[data.nickname]){//nickname is already occupied
          socket.emit('userAddingResult',{result:false});
        }else{
            socket.emit('userAddingResult',{result:true});
            socket.nickname=data.nickname;
            connectedSockets[socket.nickname]=socket;//save each socket instance and send a private message
            allUsers.push(data);
            socket.broadcast.emit('userAdded',data);//broadcast -> new user welcomed, except for new user
            socket.emit('allUser',allUsers);//sends all online users to new user
        }

    });

    socket.on('addMessage',function(data){ //a user sends a new message
        if(data.to){//issued to a specific user
            connectedSockets[data.to].emit('messageAdded',data);
        }else{
            socket.broadcast.emit('messageAdded',data);//broadcast messages, except for the user
        }


    });



    socket.on('disconnect', function () {  //has user exited ?
            socket.broadcast.emit('userRemoved', {  //broadcast: has user exit
                nickname: socket.nickname
            });
            for(var i=0;i<allUsers.length;i++){
                if(allUsers[i].nickname==socket.nickname){
                    allUsers.splice(i,1);
                }
            }
            delete connectedSockets[socket.nickname]; //delete the corresponding socket instance

        }
    );
});

http.listen(3002, function () {
    console.log('listening on *:3002');
});