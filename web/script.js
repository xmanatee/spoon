//Create an account on Firebase, and use the credentials they give you in place of the following

var config = {
    apiKey: "AIzaSyDxU1dbXJhvJ_wFtAuKQiSNbi5rns3DPJs",
    authDomain: "webrtc-test-a172f.firebaseapp.com",
    databaseURL: "https://webrtc-test-a172f.firebaseio.com",
    projectId: "webrtc-test-a172f",
    storageBucket: "webrtc-test-a172f.appspot.com",
    messagingSenderId: "22161990912"
};

var servers = {'iceServers':[
        {'urls': 'stun:stun.l.google.com:19302'},
        {'urls': 'stun:stun.services.mozilla.com'}
    ]};

firebase.initializeApp(config);

var sessionRef = null;

var videoBox = null;
var yourVideo = null;
var friendsVideo = null;

var sessionIdInput = null;
var callButton = null;

var yourId = null;
var sessionId = null;

var pc = null;

function setupIds() {
    var hash_id = window.location.href.indexOf('#');
    if (hash_id !== -1) {
        sessionId = window.location.href.substring(hash_id + 1);
    // } else if (localStorage.getItem("session_id")) {
    //     sessionId = localStorage.getItem("session_id");
    } else {
        sessionId = Math.random().toString(16).substr(4);
    }
    localStorage.setItem("session_id", sessionId);
    sessionIdInput.value = sessionId;
    yourId = Math.floor(Math.random() * 1000000000);
}

function sendMessage(senderId, data) {
    var msg = sessionRef.push({ sender: senderId, message: data });
    msg.remove();
}

function readMessage(data) {
    // console.log("readMessage(data = ", data.val(), ")");
    var msg = JSON.parse(data.val().message);
    var sender = data.val().sender;
    if (sender != yourId) {
        if (msg.status != undefined) {
            if (msg.status == "ready") {
                console.log("receved status ready");
                pc.createOffer()
                    .then(offer => pc.setLocalDescription(offer))
                    .then(() => sendMessage(yourId, JSON.stringify({'sdp': pc.localDescription})));
                console.log("sent offer");
            } else if (msg.status == "disconnecting") {
                endCall();
            }
        } else if (msg.ice != undefined) {
            pc.addIceCandidate(new RTCIceCandidate(msg.ice));
            console.log("added ice candidate");
        } else if (msg.sdp.type == "offer") {
            console.log("received offer");
            pc.setRemoteDescription(new RTCSessionDescription(msg.sdp))
                .then(() => pc.createAnswer())
                .then(answer => pc.setLocalDescription(answer))
                .then(() => sendMessage(yourId, JSON.stringify({'sdp': pc.localDescription})));
            console.log("sent answer");
        } else if (msg.sdp.type == "answer") {
            console.log("received answer");
            pc.setRemoteDescription(new RTCSessionDescription(msg.sdp));
            console.log("set remote description");
        }
    }
};

function showMyFace() {
    navigator.mediaDevices.getUserMedia({audio:true, video:true})
        .then(stream => yourVideo.srcObject = stream)
        .then(stream => pc.addStream(stream));
}

function callClick() {
    console.log("callClick()");
    sessionId = sessionIdInput.value;
    localStorage.setItem("session_id", sessionId);

    var hash_id = window.location.href.indexOf('#');
    window.location.href = window.location.href.substring(0, hash_id) + "#" + sessionId;

    callButton.disabled = true;
    callButton.innerHTML = "Connecting...";
    sessionIdInput.style.display = 'none'; // .visibility='hidden';
    videoBox.style.height = '90%';

    sessionRef = firebase.database().ref(sessionId);
    sessionRef.on('child_added', readMessage);


    sendMessage(yourId, JSON.stringify({"status": "ready"}));
    console.log("sent status ready");
}

function startCall(event) {
    callButton.innerHTML = "Rock";
    console.log("startCall()");
    friendsVideo.srcObject = event.stream;
    console.log("addded stream");
}

function endCall(event) {
    callButton.innerHTML = "Call ended";
    console.log("endCall()");
    friendsVideo.srcObject = null;
    pc.close();
    sessionRef.remove()
        .then(() => console.log("deleted sessionRef."));
}

window.onload = function () {
    videoBox = document.getElementById("video_box")
    yourVideo = document.getElementById("your_video");
    friendsVideo = document.getElementById("friends_video");
    callButton = document.getElementById("call_button");
    sessionIdInput = document.getElementById("session_id");

    setupIds();

    pc = new RTCPeerConnection(servers);
    pc.onicecandidate = (event => event.candidate
        ? sendMessage(yourId, JSON.stringify({'ice': event.candidate}))
        : console.log("Sent All Ice"));
    pc.onaddstream = startCall;

    showMyFace();

    callButton.onclick = callClick;
    sessionIdInput.addEventListener("keyup", function(event) {
        event.preventDefault();
        if (event.keyCode === 13) {
            document.getElementById("id_of_button").click();
        }
    });
    sessionIdInput.onclick = function() {
        this.setSelectionRange(0, this.value.length);
    } //.select();
};

window.onbeforeunload = function () {
    sessionRef.off('child_added', readMessage);
    sendMessage(yourId, JSON.stringify({"status": "disconnecting"}));
    pc.close();
};